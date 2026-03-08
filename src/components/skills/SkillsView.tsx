import React, { useState, useEffect, useCallback } from 'react';
import {
  Puzzle,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Shield,
  Globe,
  Tag,
  Edit2,
  Download,
  Copy,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  BookOpen,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { CreateSkillModal } from './CreateSkillModal';
import type { Skill, SkillUsage } from '../../types';

type SortKey = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';

export const SkillsView: React.FC = () => {
  const { skills, setSkills, addSkill, updateSkill, removeSkill } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState('');
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date-newest');

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await invoke<Skill[]>('get_skills');
      setSkills(fetched);
    } catch (e) {
      console.error('Failed to load skills:', e);
    } finally {
      setLoading(false);
    }
  }, [setSkills]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await invoke('toggle_skill', { skillId: id, enabled });
      updateSkill(id, { enabled });
    } catch (e) {
      console.error('Failed to toggle skill:', e);
    }
  };

  const handleUninstall = async (id: string) => {
    try {
      await invoke('uninstall_skill', { skillId: id });
      removeSkill(id);
    } catch (e) {
      console.error('Failed to uninstall skill:', e);
    }
  };

  const handleInstallFromUrl = async () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    setInstallError('');
    try {
      const skill = await invoke<Skill>('install_skill', {
        req: { url: installUrl.trim(), skill: null },
      });
      addSkill(skill);
      setInstallUrl('');
      setShowInstallForm(false);
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handleCreate = async (skill: Skill) => {
    const created = await invoke<Skill>('create_skill', { skill });
    addSkill(created);
  };

  const handleEdit = async (skill: Skill) => {
    const updated = await invoke<Skill>('update_skill', { skill });
    updateSkill(updated.id, updated);
  };

  const handleExport = (skill: Skill) => {
    const json = JSON.stringify(skill, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skill.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDuplicate = (skill: Skill) => {
    const clone: Skill = {
      ...skill,
      id: '',
      name: `Copy of ${skill.name}`,
      installed_at: new Date().toISOString(),
    };
    setEditingSkill(clone);
    setShowCreateModal(true);
  };

  const permissionColor = (perm: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    if (perm === 'sensitive_data') return 'danger';
    if (perm === 'submit_forms') return 'warning';
    if (perm === 'fill_forms') return 'info';
    return 'default';
  };

  // Filter and sort
  const searchLower = search.toLowerCase();
  const filteredSkills = skills
    .filter((s) => {
      if (!searchLower) return true;
      return (
        s.name.toLowerCase().includes(searchLower) ||
        s.triggers_keywords.some((kw) => kw.toLowerCase().includes(searchLower)) ||
        s.triggers_domains.some((d) => d.toLowerCase().includes(searchLower))
      );
    })
    .sort((a, b) => {
      switch (sortKey) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'date-oldest':
          return a.installed_at.localeCompare(b.installed_at);
        case 'date-newest':
        default:
          return b.installed_at.localeCompare(a.installed_at);
      }
    });

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'date-newest', label: 'Newest first' },
    { value: 'date-oldest', label: 'Oldest first' },
    { value: 'name-asc', label: 'Name A → Z' },
    { value: 'name-desc', label: 'Name Z → A' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#000000]">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Agent Skills</h1>
              <p className="text-sm text-[#606060]">Installable prompt packages that teach agents specialized tasks</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadSkills} loading={loading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowInstallForm((v) => !v)}>
              <ExternalLink className="w-4 h-4" />
              Install URL
            </Button>
            <Button size="sm" onClick={() => { setEditingSkill(null); setShowCreateModal(true); }}>
              <Plus className="w-4 h-4" />
              Create
            </Button>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, keyword, or domain…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl text-sm text-white placeholder-[#606060] focus:outline-none focus:border-violet-600/50"
            />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl text-sm text-[#a0a0a0] px-3 py-2 focus:outline-none focus:border-violet-600/50"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Install from URL */}
        {showInstallForm && (
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-violet-400" />
              Install from URL
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/skills/my-skill.json"
                value={installUrl}
                onChange={(e) => setInstallUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInstallFromUrl()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleInstallFromUrl}
                loading={installing}
                disabled={!installUrl.trim()}
              >
                Install
              </Button>
            </div>
            {installError && (
              <p className="text-xs text-red-400">{installError}</p>
            )}
          </div>
        )}

        {/* Explanation */}
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
          <h3 className="text-sm font-medium text-violet-300 mb-1">How Skills Work</h3>
          <p className="text-xs text-[#a0a0a0] leading-relaxed">
            Skills are injected into the Planner and Navigator system prompts when their trigger
            keywords match your task objective or the current page domain matches. They teach
            agents best-practices for specific tasks.
          </p>
        </div>

        {/* Skill list */}
        {filteredSkills.length === 0 ? (
          <div className="text-center py-12">
            <Puzzle className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
            <p className="text-sm text-[#606060]">
              {search ? 'No skills match your search.' : 'No skills installed'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={(enabled) => handleToggle(skill.id, enabled)}
                onUninstall={() => handleUninstall(skill.id)}
                onEdit={() => { setEditingSkill(skill); setShowCreateModal(true); }}
                onExport={() => handleExport(skill)}
                onDuplicate={() => handleDuplicate(skill)}
                permissionColor={permissionColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {showCreateModal && (
        <CreateSkillModal
          initialSkill={editingSkill}
          onSave={editingSkill ? handleEdit : handleCreate}
          onClose={() => { setShowCreateModal(false); setEditingSkill(null); }}
        />
      )}
    </div>
  );
};

interface SkillCardProps {
  skill: Skill;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  permissionColor: (perm: string) => 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  onToggle,
  onUninstall,
  onEdit,
  onExport,
  onDuplicate,
  permissionColor,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [usage, setUsage] = useState<SkillUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && usage === null) {
      setLoadingUsage(true);
      try {
        const result = await invoke<SkillUsage>('get_skill_usage', { skillId: skill.id });
        setUsage(result);
      } catch {
        setUsage({ automations: [], conversations: [] });
      } finally {
        setLoadingUsage(false);
      }
    }
  };

  return (
    <div
      className={`bg-[#0f0f0f] border rounded-2xl overflow-hidden transition-colors ${
        skill.enabled ? 'border-l-2 border-l-violet-600 border-[#1f1f1f]' : 'border-[#1f1f1f]'
      }`}
    >
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
              <span className="text-xs text-[#606060]">v{skill.version}</span>
            </div>
            <p className="text-xs text-[#606060] mt-0.5">by {skill.author}</p>
            <p className="text-sm text-[#a0a0a0] mt-1.5">{skill.description}</p>
          </div>
          <Toggle checked={skill.enabled} onChange={onToggle} />
        </div>

        {/* Triggers */}
        {(skill.triggers_keywords.length > 0 || skill.triggers_domains.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {skill.triggers_keywords.slice(0, 4).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-[#1a1a1a] text-[#a0a0a0]"
              >
                <Tag className="w-3 h-3" />
                {kw}
              </span>
            ))}
            {skill.triggers_domains.slice(0, 3).map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-[#1a1a1a] text-[#a0a0a0]"
              >
                <Globe className="w-3 h-3" />
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Permissions */}
        {skill.permissions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Shield className="w-3.5 h-3.5 text-[#606060] shrink-0" />
            {skill.permissions.map((perm) => (
              <Badge key={perm} variant={permissionColor(perm)}>
                {perm}
              </Badge>
            ))}
          </div>
        )}

        {/* Prompt / Usage expand toggle */}
        {(skill.planner_prompt || skill.navigator_prompt) && (
          <button
            className="text-xs text-violet-400 hover:text-violet-300 underline flex items-center gap-1"
            onClick={handleExpand}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Collapse details' : 'View prompts & usage'}
          </button>
        )}

        {expanded && (
          <div className="space-y-3 pt-1">
            {skill.planner_prompt && (
              <div>
                <p className="text-xs font-medium text-[#606060] mb-1">Planner prompt:</p>
                <pre className="text-xs text-[#a0a0a0] bg-[#0a0a0a] rounded-xl p-3 whitespace-pre-wrap overflow-auto max-h-32">
                  {skill.planner_prompt}
                </pre>
              </div>
            )}
            {skill.navigator_prompt && (
              <div>
                <p className="text-xs font-medium text-[#606060] mb-1">Navigator prompt:</p>
                <pre className="text-xs text-[#a0a0a0] bg-[#0a0a0a] rounded-xl p-3 whitespace-pre-wrap overflow-auto max-h-32">
                  {skill.navigator_prompt}
                </pre>
              </div>
            )}

            {/* Usage section */}
            <div>
              <p className="text-xs font-medium text-[#606060] mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Used in
              </p>
              {loadingUsage ? (
                <p className="text-xs text-[#606060]">Loading…</p>
              ) : usage ? (
                <div className="space-y-1">
                  {usage.automations.length === 0 && usage.conversations.length === 0 ? (
                    <p className="text-xs text-[#606060]">No references found.</p>
                  ) : (
                    <>
                      {usage.automations.length > 0 && (
                        <div>
                          <p className="text-xs text-[#606060] mb-0.5">Automations:</p>
                          {usage.automations.map((name) => (
                            <span key={name} className="inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded-lg text-xs bg-[#1a1a1a] text-[#a0a0a0]">
                              <CheckCircle className="w-3 h-3 text-violet-400" />
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {usage.conversations.length > 0 && (
                        <div>
                          <p className="text-xs text-[#606060] mb-0.5">Conversations:</p>
                          {usage.conversations.map((title) => (
                            <span key={title} className="inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded-lg text-xs bg-[#1a1a1a] text-[#a0a0a0]">
                              <CheckCircle className="w-3 h-3 text-violet-400" />
                              {title}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center justify-between">
        <Badge variant={skill.enabled ? 'success' : 'default'}>
          {skill.enabled ? 'Active' : 'Inactive'}
        </Badge>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#a0a0a0] transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={onDuplicate}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#a0a0a0] transition-colors"
          >
            <Copy className="w-3 h-3" />
            Duplicate
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#a0a0a0] transition-colors"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onUninstall}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex items-center px-2.5 py-1.5 rounded-xl text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#a0a0a0] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
