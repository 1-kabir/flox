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
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import type { Skill } from '../../types';

export const SkillsView: React.FC = () => {
  const { skills, setSkills, addSkill, updateSkill, removeSkill } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState('');
  const [showInstallForm, setShowInstallForm] = useState(false);

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

  const permissionColor = (perm: string) => {
    if (perm === 'sensitive_data') return 'danger';
    if (perm === 'submit_forms') return 'warning';
    if (perm === 'fill_forms') return 'info';
    return 'default';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-100">Agent Skills</h1>
              <p className="text-sm text-gray-500">Installable prompt packages that teach agents specialized tasks</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadSkills} loading={loading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={() => setShowInstallForm((v) => !v)}>
              <Plus className="w-4 h-4" />
              Install Skill
            </Button>
          </div>
        </div>

        {/* Install from URL */}
        {showInstallForm && (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-violet-400" />
              Install from URL
            </h3>
            <p className="text-xs text-gray-500">
              Paste a URL pointing to a JSON skill manifest. Skills can also come from the
              community marketplace.
            </p>
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
          <p className="text-xs text-gray-400 leading-relaxed">
            Skills are injected into the Planner and Navigator system prompts when their trigger
            keywords match your task objective or the current page domain matches. They teach
            agents best-practices for specific tasks without modifying automations.
          </p>
        </div>

        {/* Skill list */}
        {skills.length === 0 ? (
          <div className="text-center py-12">
            <Puzzle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No skills installed</p>
          </div>
        ) : (
          <div className="space-y-4">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={(enabled) => handleToggle(skill.id, enabled)}
                onUninstall={() => handleUninstall(skill.id)}
                permissionColor={permissionColor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface SkillCardProps {
  skill: Skill;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
  permissionColor: (perm: string) => 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, onToggle, onUninstall, permissionColor }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-200">{skill.name}</h3>
              <span className="text-xs text-gray-600">v{skill.version}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">by {skill.author}</p>
            <p className="text-sm text-gray-400 mt-1.5">{skill.description}</p>
          </div>
          <Toggle checked={skill.enabled} onChange={onToggle} />
        </div>

        {/* Triggers */}
        {(skill.triggers_keywords.length > 0 || skill.triggers_domains.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {skill.triggers_keywords.slice(0, 4).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-gray-700 text-gray-300"
              >
                <Tag className="w-3 h-3" />
                {kw}
              </span>
            ))}
            {skill.triggers_domains.slice(0, 3).map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-gray-700 text-gray-300"
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
            <Shield className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            {skill.permissions.map((perm) => (
              <Badge key={perm} variant={permissionColor(perm)}>
                {perm}
              </Badge>
            ))}
          </div>
        )}

        {/* Prompt preview */}
        {(skill.planner_prompt || skill.navigator_prompt) && (
          <button
            className="text-xs text-violet-400 hover:text-violet-300 underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide prompts' : 'View prompt fragments'}
          </button>
        )}

        {expanded && (
          <div className="space-y-3 pt-1">
            {skill.planner_prompt && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Planner prompt:</p>
                <pre className="text-xs text-gray-400 bg-gray-900/60 rounded-xl p-3 whitespace-pre-wrap overflow-auto max-h-32">
                  {skill.planner_prompt}
                </pre>
              </div>
            )}
            {skill.navigator_prompt && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Navigator prompt:</p>
                <pre className="text-xs text-gray-400 bg-gray-900/60 rounded-xl p-3 whitespace-pre-wrap overflow-auto max-h-32">
                  {skill.navigator_prompt}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center justify-between">
        <Badge variant={skill.enabled ? 'success' : 'default'}>
          {skill.enabled ? 'Active' : 'Inactive'}
        </Badge>
        <button
          onClick={onUninstall}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Uninstall
        </button>
      </div>
    </div>
  );
};
