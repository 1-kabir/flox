use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

/// A single agent Skill — metadata + prompts + trigger rules.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub version: String,
    /// List of domain patterns that activate this skill (e.g. "github.com", "*.shopify.com").
    pub triggers_domains: Vec<String>,
    /// List of keyword patterns in the task objective that activate this skill.
    pub triggers_keywords: Vec<String>,
    /// Prompt text injected into Planner system prompt when the skill is active.
    pub planner_prompt: Option<String>,
    /// Prompt text injected into Navigator system prompt when the skill is active.
    pub navigator_prompt: Option<String>,
    /// Declared permissions (e.g. "read_page", "fill_forms", "submit_forms", "sensitive_data").
    pub permissions: Vec<String>,
    pub enabled: bool,
    pub installed_at: String,
    /// Optional registry URL this skill was installed from.
    pub source_url: Option<String>,
}

impl Default for Skill {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: String::new(),
            author: String::new(),
            description: String::new(),
            version: "1.0.0".to_string(),
            triggers_domains: Vec::new(),
            triggers_keywords: Vec::new(),
            planner_prompt: None,
            navigator_prompt: None,
            permissions: Vec::new(),
            enabled: true,
            installed_at: chrono::Utc::now().to_rfc3339(),
            source_url: None,
        }
    }
}

/// Request payload for installing a skill from a URL.
#[derive(Debug, Deserialize)]
pub struct InstallSkillRequest {
    pub url: Option<String>,
    pub skill: Option<Skill>,
}

#[tauri::command]
pub async fn get_skills(app: tauri::AppHandle) -> Result<Vec<Skill>, String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;
    let skills: Vec<Skill> = store
        .get("skills")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(default_skills);
    Ok(skills)
}

#[tauri::command]
pub async fn install_skill(
    app: tauri::AppHandle,
    req: InstallSkillRequest,
) -> Result<Skill, String> {
    let mut skill = if let Some(url) = &req.url {
        // Fetch skill manifest from URL
        let client = reqwest::Client::new();
        let text = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Fetch error: {}", e))?
            .text()
            .await
            .map_err(|e| format!("Read error: {}", e))?;
        serde_json::from_str::<Skill>(&text)
            .map_err(|e| format!("Parse error: {}", e))?
    } else if let Some(s) = req.skill {
        s
    } else {
        return Err("No skill data provided".to_string());
    };

    // Assign new id and timestamp
    skill.id = Uuid::new_v4().to_string();
    skill.installed_at = chrono::Utc::now().to_rfc3339();

    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;
    let mut skills: Vec<Skill> = store
        .get("skills")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    skills.push(skill.clone());
    store.set(
        "skills",
        serde_json::to_value(&skills).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(skill)
}

#[tauri::command]
pub async fn uninstall_skill(app: tauri::AppHandle, skill_id: String) -> Result<(), String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;
    let mut skills: Vec<Skill> = store
        .get("skills")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    skills.retain(|s| s.id != skill_id);

    store.set(
        "skills",
        serde_json::to_value(&skills).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn toggle_skill(
    app: tauri::AppHandle,
    skill_id: String,
    enabled: bool,
) -> Result<(), String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;
    let mut skills: Vec<Skill> = store
        .get("skills")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if let Some(skill) = skills.iter_mut().find(|s| s.id == skill_id) {
        skill.enabled = enabled;
    }

    store.set(
        "skills",
        serde_json::to_value(&skills).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Get skill prompt fragments relevant to the given objective and URL.
pub async fn get_relevant_skill_prompts(
    app: &tauri::AppHandle,
    objective: &str,
    current_url: Option<&str>,
) -> (Option<String>, Option<String>) {
    let store = match app.store("flox_store.bin") {
        Ok(s) => s,
        Err(_) => return (None, None),
    };

    let skills: Vec<Skill> = store
        .get("skills")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(default_skills);

    let mut planner_fragments: Vec<String> = Vec::new();
    let mut navigator_fragments: Vec<String> = Vec::new();

    for skill in skills.iter().filter(|s| s.enabled) {
        if is_skill_relevant(skill, objective, current_url) {
            if let Some(p) = &skill.planner_prompt {
                planner_fragments.push(format!("## Skill: {}\n{}", skill.name, p));
            }
            if let Some(n) = &skill.navigator_prompt {
                navigator_fragments.push(format!("## Skill: {}\n{}", skill.name, n));
            }
        }
    }

    let planner = if planner_fragments.is_empty() {
        None
    } else {
        Some(format!("\n\n---\n**Installed Skills:**\n{}", planner_fragments.join("\n\n")))
    };

    let navigator = if navigator_fragments.is_empty() {
        None
    } else {
        Some(format!("\n\n---\n**Installed Skills:**\n{}", navigator_fragments.join("\n\n")))
    };

    (planner, navigator)
}

fn is_skill_relevant(skill: &Skill, objective: &str, current_url: Option<&str>) -> bool {
    let obj_lower = objective.to_lowercase();

    // Check keyword triggers
    for kw in &skill.triggers_keywords {
        if obj_lower.contains(&kw.to_lowercase()) {
            return true;
        }
    }

    // Check domain triggers
    if let Some(url) = current_url {
        for domain in &skill.triggers_domains {
            let pattern = domain.trim_start_matches("*.");
            if url.contains(pattern) {
                return true;
            }
        }
    }

    false
}

/// Built-in sample skills shipped with the app.
fn default_skills() -> Vec<Skill> {
    vec![
        Skill {
            id: "skill-login".to_string(),
            name: "Universal Login".to_string(),
            author: "Flox".to_string(),
            description: "Helps the agent fill login forms correctly on any website.".to_string(),
            version: "1.0.0".to_string(),
            triggers_domains: vec!["*".to_string()],
            triggers_keywords: vec!["login".to_string(), "sign in".to_string(), "log in".to_string(), "authenticate".to_string()],
            planner_prompt: Some("When logging in: navigate to the login page, locate the username/email field, type the credential, then locate the password field, type it, and click the submit button. Handle CAPTCHA by waiting for manual input if needed.".to_string()),
            navigator_prompt: Some("To fill a login form: use selector 'input[type=\"email\"],input[type=\"text\"][name*=\"user\"],input[name*=\"email\"]' for username and 'input[type=\"password\"]' for password. After filling, click 'button[type=\"submit\"],input[type=\"submit\"]'. Wait 2000ms for redirect.".to_string()),
            permissions: vec!["fill_forms".to_string(), "submit_forms".to_string()],
            enabled: true,
            installed_at: chrono::Utc::now().to_rfc3339(),
            source_url: None,
        },
        Skill {
            id: "skill-data-scrape".to_string(),
            name: "Data Scraper".to_string(),
            author: "Flox".to_string(),
            description: "Teaches the agent how to extract structured data from web pages.".to_string(),
            version: "1.0.0".to_string(),
            triggers_domains: vec![],
            triggers_keywords: vec!["scrape".to_string(), "extract".to_string(), "collect".to_string(), "gather data".to_string(), "get all".to_string()],
            planner_prompt: Some("For data scraping tasks: first navigate to the target page, then use JavaScript evaluation to extract structured data. Prefer document.querySelectorAll with specific selectors. Return data as JSON. Handle pagination by checking for next-page buttons.".to_string()),
            navigator_prompt: Some("To scrape data use the 'evaluate' action with JavaScript like: Array.from(document.querySelectorAll('selector')).map(el => ({text: el.textContent.trim(), href: el.href})). For tables: Array.from(document.querySelectorAll('tr')).map(r => Array.from(r.cells).map(c => c.textContent.trim())).".to_string()),
            permissions: vec!["read_page".to_string()],
            enabled: true,
            installed_at: chrono::Utc::now().to_rfc3339(),
            source_url: None,
        },
        Skill {
            id: "skill-purchase".to_string(),
            name: "E-commerce Checkout".to_string(),
            author: "Flox".to_string(),
            description: "Guides the agent through product selection and checkout flows.".to_string(),
            version: "1.0.0".to_string(),
            triggers_domains: vec!["shopify.com".to_string(), "amazon.com".to_string(), "ebay.com".to_string()],
            triggers_keywords: vec!["buy".to_string(), "purchase".to_string(), "checkout".to_string(), "add to cart".to_string(), "order".to_string()],
            planner_prompt: Some("For purchase tasks: 1) Search/navigate to the product, 2) Select options (size/color/qty), 3) Click 'Add to Cart', 4) Navigate to cart, 5) Click Checkout, 6) Fill shipping details, 7) Review order before final submit. ALWAYS verify the order before submitting payment.".to_string()),
            navigator_prompt: Some("Common checkout selectors: add-to-cart: '[data-action*=\"cart\"],[id*=\"add-to-cart\"],button:contains(\"Add to Cart\")', quantity: 'input[name*=\"qty\"],input[id*=\"quantity\"]', checkout button: '[href*=\"checkout\"],button:contains(\"Checkout\")'. Always screenshot before and after payment steps.".to_string()),
            permissions: vec!["fill_forms".to_string(), "submit_forms".to_string(), "sensitive_data".to_string()],
            enabled: false,
            installed_at: chrono::Utc::now().to_rfc3339(),
            source_url: None,
        },
    ]
}
