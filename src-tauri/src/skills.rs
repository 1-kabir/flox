use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db;

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

/// Usage information for a skill: which automations and conversations reference it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillUsage {
    pub automations: Vec<String>,
    pub conversations: Vec<String>,
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

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_skills(_app: tauri::AppHandle) -> Result<Vec<Skill>, String> {
    let skills = db::with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT data FROM skills ORDER BY rowid")?;
        let rows = stmt.query_map([], |row| {
            let json: String = row.get(0)?;
            serde_json::from_str::<Skill>(&json)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        rows.collect::<rusqlite::Result<Vec<Skill>>>()
    })?;

    if skills.is_empty() {
        // Seed default skills on first run.
        let defaults = default_skills();
        for skill in &defaults {
            upsert_skill(skill)?;
        }
        return Ok(defaults);
    }

    Ok(skills)
}

#[tauri::command]
pub async fn install_skill(
    _app: tauri::AppHandle,
    req: InstallSkillRequest,
) -> Result<Skill, String> {
    let mut skill = if let Some(url) = &req.url {
        if !url.starts_with("https://") && !url.starts_with("http://") {
            return Err("Only http/https URLs are allowed for skill installation".to_string());
        }
        let client = reqwest::Client::new();
        let text = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Fetch error: {}", e))?
            .text()
            .await
            .map_err(|e| format!("Read error: {}", e))?;
        serde_json::from_str::<Skill>(&text).map_err(|e| format!("Parse error: {}", e))?
    } else if let Some(s) = req.skill {
        s
    } else {
        return Err("No skill data provided".to_string());
    };

    skill.id = Uuid::new_v4().to_string();
    skill.installed_at = chrono::Utc::now().to_rfc3339();

    upsert_skill(&skill)?;
    Ok(skill)
}

/// Create a new skill authored locally (no URL required).
#[tauri::command]
pub async fn create_skill(_app: tauri::AppHandle, skill: Skill) -> Result<Skill, String> {
    let mut s = skill;
    s.id = Uuid::new_v4().to_string();
    s.installed_at = chrono::Utc::now().to_rfc3339();
    upsert_skill(&s)?;
    Ok(s)
}

/// Update an existing skill (used by the Edit modal).
#[tauri::command]
pub async fn update_skill(_app: tauri::AppHandle, skill: Skill) -> Result<Skill, String> {
    upsert_skill(&skill)?;
    Ok(skill)
}

#[tauri::command]
pub async fn uninstall_skill(_app: tauri::AppHandle, skill_id: String) -> Result<(), String> {
    db::with_conn(|conn| {
        conn.execute("DELETE FROM skills WHERE id = ?1", [&skill_id])?;
        Ok(())
    })
}

#[tauri::command]
pub async fn toggle_skill(
    _app: tauri::AppHandle,
    skill_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut skills = get_all_skills()?;
    if let Some(skill) = skills.iter_mut().find(|s| s.id == skill_id) {
        skill.enabled = enabled;
        upsert_skill(skill)?;
    }
    Ok(())
}

/// Returns automation names and conversation titles that reference this skill.
/// Matches are keyword-based: the skill's trigger keywords are searched in
/// automation prompts and conversation message content.
#[tauri::command]
pub async fn get_skill_usage(
    _app: tauri::AppHandle,
    skill_id: String,
) -> Result<SkillUsage, String> {
    let skills = get_all_skills()?;
    let skill = skills
        .iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| "Skill not found".to_string())?;

    let keywords: Vec<String> = skill
        .triggers_keywords
        .iter()
        .map(|k| k.to_lowercase())
        .filter(|k| !k.is_empty())
        .collect();

    if keywords.is_empty() {
        return Ok(SkillUsage {
            automations: Vec::new(),
            conversations: Vec::new(),
        });
    }

    // Check automations whose prompt contains any trigger keyword.
    let automations = db::with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT data FROM automations ORDER BY rowid")?;
        let rows: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    })?;

    let matching_automations: Vec<String> = automations
        .iter()
        .filter_map(|data| {
            let v: serde_json::Value = serde_json::from_str(data).ok()?;
            let prompt = v.get("prompt")?.as_str()?.to_lowercase();
            let name = v.get("name")?.as_str()?.to_string();
            if keywords.iter().any(|kw| prompt.contains(kw.as_str())) {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    // Fetch all (conversation_id, title, message_content) rows in one query,
    // then filter by keyword in Rust. Deduplicate by conversation id.
    let conv_rows: Vec<(String, String, String)> = db::with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT c.id, c.title, m.content
             FROM conversations c
             JOIN messages m ON m.conversation_id = c.id
             ORDER BY c.id",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    })?;

    // Group by conversation id and collect matching conversation titles.
    let mut seen_ids: Vec<String> = Vec::new();
    let matching_conversations: Vec<String> = conv_rows
        .iter()
        .filter_map(|(id, title, content)| {
            if seen_ids.contains(id) {
                return None;
            }
            let lower = content.to_lowercase();
            if keywords.iter().any(|kw| lower.contains(kw.as_str())) {
                seen_ids.push(id.clone());
                Some(title.clone())
            } else {
                None
            }
        })
        .collect();

    Ok(SkillUsage {
        automations: matching_automations,
        conversations: matching_conversations,
    })
}

// ---------------------------------------------------------------------------
// Internal helpers used by agents.rs
// ---------------------------------------------------------------------------

/// Get skill prompt fragments relevant to the given objective and URL.
pub async fn get_relevant_skill_prompts(
    _app: &tauri::AppHandle,
    objective: &str,
    current_url: Option<&str>,
    forced_skill_ids: Option<&[String]>,
) -> (Option<String>, Option<String>) {
    let skills = match get_all_skills() {
        Ok(s) => s,
        Err(_) => return (None, None),
    };

    let mut planner_fragments: Vec<String> = Vec::new();
    let mut navigator_fragments: Vec<String> = Vec::new();

    for skill in skills.iter().filter(|s| s.enabled) {
        let forced = forced_skill_ids
            .map(|ids| ids.contains(&skill.id))
            .unwrap_or(false);

        if forced || is_skill_relevant(skill, objective, current_url) {
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
        Some(format!(
            "\n\n---\n**Installed Skills:**\n{}",
            planner_fragments.join("\n\n")
        ))
    };

    let navigator = if navigator_fragments.is_empty() {
        None
    } else {
        Some(format!(
            "\n\n---\n**Installed Skills:**\n{}",
            navigator_fragments.join("\n\n")
        ))
    };

    (planner, navigator)
}

/// Collect permissions from skills that are relevant to the given objective/URL.
pub async fn get_active_skill_permissions(
    _app: &tauri::AppHandle,
    objective: &str,
    current_url: Option<&str>,
    forced_skill_ids: Option<&[String]>,
) -> Vec<String> {
    let skills = match get_all_skills() {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let mut perms: Vec<String> = Vec::new();
    for skill in skills.iter().filter(|s| s.enabled) {
        let forced = forced_skill_ids
            .map(|ids| ids.contains(&skill.id))
            .unwrap_or(false);
        if forced || is_skill_relevant(skill, objective, current_url) {
            for p in &skill.permissions {
                if !perms.contains(p) {
                    perms.push(p.clone());
                }
            }
        }
    }
    perms
}

fn get_all_skills() -> Result<Vec<Skill>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT data FROM skills ORDER BY rowid")?;
        let rows = stmt.query_map([], |row| {
            let json: String = row.get(0)?;
            serde_json::from_str::<Skill>(&json)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        rows.collect()
    })
}

fn upsert_skill(skill: &Skill) -> Result<(), String> {
    let json = serde_json::to_string(skill).map_err(|e| e.to_string())?;
    db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO skills (id, data) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            [&skill.id, &json],
        )?;
        Ok(())
    })
}

fn is_skill_relevant(skill: &Skill, objective: &str, current_url: Option<&str>) -> bool {
    let obj_lower = objective.to_lowercase();

    for kw in &skill.triggers_keywords {
        if obj_lower.contains(&kw.to_lowercase()) {
            return true;
        }
    }

    if let Some(url) = current_url {
        for domain in &skill.triggers_domains {
            let pattern = domain.strip_prefix("*.").unwrap_or(domain);
            if url.contains(pattern) {
                return true;
            }
        }
    }

    false
}

fn default_skills() -> Vec<Skill> {
    vec![
        Skill {
            id: "skill-login".to_string(),
            name: "Universal Login".to_string(),
            author: "Flox".to_string(),
            description: "Helps the agent fill login forms correctly on any website.".to_string(),
            version: "1.0.0".to_string(),
            triggers_domains: vec!["*".to_string()],
            triggers_keywords: vec![
                "login".to_string(),
                "sign in".to_string(),
                "log in".to_string(),
                "authenticate".to_string(),
            ],
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
            triggers_keywords: vec![
                "scrape".to_string(),
                "extract".to_string(),
                "collect".to_string(),
                "gather data".to_string(),
                "get all".to_string(),
            ],
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
            triggers_domains: vec![
                "shopify.com".to_string(),
                "amazon.com".to_string(),
                "ebay.com".to_string(),
            ],
            triggers_keywords: vec![
                "buy".to_string(),
                "purchase".to_string(),
                "checkout".to_string(),
                "add to cart".to_string(),
                "order".to_string(),
            ],
            planner_prompt: Some("For purchase tasks: 1) Search/navigate to the product, 2) Select options (size/color/qty), 3) Click 'Add to Cart', 4) Navigate to cart, 5) Click Checkout, 6) Fill shipping details, 7) Review order before final submit. ALWAYS verify the order before submitting payment.".to_string()),
            navigator_prompt: Some("Common checkout selectors: add-to-cart: '[data-action*=\"cart\"],[id*=\"add-to-cart\"],button:contains(\"Add to Cart\")', quantity: 'input[name*=\"qty\"],input[id*=\"quantity\"]', checkout button: '[href*=\"checkout\"],button:contains(\"Checkout\")'. Always screenshot before and after payment steps.".to_string()),
            permissions: vec![
                "fill_forms".to_string(),
                "submit_forms".to_string(),
                "sensitive_data".to_string(),
            ],
            enabled: false,
            installed_at: chrono::Utc::now().to_rfc3339(),
            source_url: None,
        },
    ]
}
