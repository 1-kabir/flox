import React, { useState, useEffect } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Skill } from '../../types';

const PERMISSIONS = ['read_page', 'fill_forms', 'submit_forms', 'sensitive_data'] as const;

const DEFAULT_AUTHOR = 'You';

interface Props {
  initialSkill?: Skill | null;
  onSave: (skill: Skill) => Promise<void>;
  onClose: () => void;
}

export const CreateSkillModal: React.FC<Props> = ({ initialSkill, onSave, onClose }) => {
  const isEditing = !!initialSkill;

  const [name, setName] = useState(initialSkill?.name ?? '');
  const [author, setAuthor] = useState(initialSkill?.author ?? DEFAULT_AUTHOR);
  const [description, setDescription] = useState(initialSkill?.description ?? '');
  const [version, setVersion] = useState(initialSkill?.version ?? '1.0.0');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(initialSkill?.triggers_keywords ?? []);
  const [domainInput, setDomainInput] = useState('');
  const [domains, setDomains] = useState<string[]>(initialSkill?.triggers_domains ?? []);
  const [plannerPrompt, setPlannerPrompt] = useState(initialSkill?.planner_prompt ?? '');
  const [navigatorPrompt, setNavigatorPrompt] = useState(initialSkill?.navigator_prompt ?? '');
  const [permissions, setPermissions] = useState<string[]>(initialSkill?.permissions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialSkill) {
      setName(initialSkill.name);
      setAuthor(initialSkill.author);
      setDescription(initialSkill.description);
      setVersion(initialSkill.version);
      setKeywords(initialSkill.triggers_keywords);
      setDomains(initialSkill.triggers_domains);
      setPlannerPrompt(initialSkill.planner_prompt ?? '');
      setNavigatorPrompt(initialSkill.navigator_prompt ?? '');
      setPermissions(initialSkill.permissions);
    }
  }, [initialSkill]);

  const addChip = (
    value: string,
    list: string[],
    setter: (v: string[]) => void,
    inputSetter: (v: string) => void
  ) => {
    const items = value.split(',').map((s) => s.trim()).filter(Boolean);
    const newList = [...list, ...items.filter((i) => !list.includes(i))];
    setter(newList);
    inputSetter('');
  };

  const removeChip = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.filter((i) => i !== item));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const skill: Skill = {
        id: initialSkill?.id ?? '',
        name: name.trim(),
        author: author.trim() || DEFAULT_AUTHOR,
        description: description.trim(),
        version: version.trim() || '1.0.0',
        triggers_keywords: keywords,
        triggers_domains: domains,
        planner_prompt: plannerPrompt.trim() || undefined,
        navigator_prompt: navigatorPrompt.trim() || undefined,
        permissions,
        enabled: initialSkill?.enabled ?? true,
        installed_at: initialSkill?.installed_at ?? new Date().toISOString(),
        source_url: initialSkill?.source_url,
      };
      await onSave(skill);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
          <h2 className="text-base font-semibold text-white">
            {isEditing ? 'Edit Skill' : 'Create Skill'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#606060] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Name & Author */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Skill"
            />
            <Input
              label="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="You"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this skill do?"
              rows={2}
              className="bg-[#111111] border border-[#2a2a2a] text-white placeholder-[#404040] rounded-xl px-3 py-2 text-sm focus:border-violet-500 focus:outline-none resize-none"
            />
          </div>

          {/* Version */}
          <Input
            label="Version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
          />

          {/* Trigger Keywords */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">
              Trigger Keywords
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-[#1a1a1a] text-[#a0a0a0] border border-[#2a2a2a]"
                >
                  <Tag className="w-3 h-3" />
                  {kw}
                  <button
                    onClick={() => removeChip(kw, keywords, setKeywords)}
                    className="hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addChip(keywordInput, keywords, setKeywords, setKeywordInput);
                  }
                }}
                placeholder="login, sign in, authenticate…"
                className="flex-1 bg-[#111111] border border-[#2a2a2a] text-white placeholder-[#404040] rounded-xl px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => addChip(keywordInput, keywords, setKeywords, setKeywordInput)}
                className="px-3 py-1.5 rounded-xl bg-[#1a1a1a] text-[#a0a0a0] hover:bg-[#2a2a2a] text-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Trigger Domains */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">
              Trigger Domains
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {domains.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-[#1a1a1a] text-[#a0a0a0] border border-[#2a2a2a]"
                >
                  {d}
                  <button
                    onClick={() => removeChip(d, domains, setDomains)}
                    className="hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addChip(domainInput, domains, setDomains, setDomainInput);
                  }
                }}
                placeholder="github.com, *.shopify.com…"
                className="flex-1 bg-[#111111] border border-[#2a2a2a] text-white placeholder-[#404040] rounded-xl px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => addChip(domainInput, domains, setDomains, setDomainInput)}
                className="px-3 py-1.5 rounded-xl bg-[#1a1a1a] text-[#a0a0a0] hover:bg-[#2a2a2a] text-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Planner Prompt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">
              Planner Prompt (optional)
            </label>
            <textarea
              value={plannerPrompt}
              onChange={(e) => setPlannerPrompt(e.target.value)}
              placeholder="Instructions injected into the Planner's system prompt…"
              rows={3}
              className="bg-[#111111] border border-[#2a2a2a] text-white placeholder-[#404040] rounded-xl px-3 py-2 text-sm focus:border-violet-500 focus:outline-none resize-none font-mono"
            />
          </div>

          {/* Navigator Prompt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">
              Navigator Prompt (optional)
            </label>
            <textarea
              value={navigatorPrompt}
              onChange={(e) => setNavigatorPrompt(e.target.value)}
              placeholder="Instructions injected into the Navigator's system prompt…"
              rows={3}
              className="bg-[#111111] border border-[#2a2a2a] text-white placeholder-[#404040] rounded-xl px-3 py-2 text-sm focus:border-violet-500 focus:outline-none resize-none font-mono"
            />
          </div>

          {/* Permissions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">
              Permissions
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm)}
                    onChange={(e) => {
                      setPermissions((prev) =>
                        e.target.checked
                          ? [...prev, perm]
                          : prev.filter((p) => p !== perm)
                      );
                    }}
                    className="accent-violet-600 w-4 h-4"
                  />
                  <span className="text-sm text-[#a0a0a0]">{perm}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-[#1f1f1f] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {isEditing ? 'Save Changes' : 'Create Skill'}
          </Button>
        </div>
      </div>
    </div>
  );
};
