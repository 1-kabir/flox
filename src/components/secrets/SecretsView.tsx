import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  Info,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { SecretSummary } from '../../types';

// ---------------------------------------------------------------------------
// SecretsView — main page
// ---------------------------------------------------------------------------

export const SecretsView: React.FC = () => {
  const { secrets, setSecrets, addSecret, updateSecret, removeSecret } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSecret, setEditingSecret] = useState<SecretSummary | null>(null);

  const loadSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<SecretSummary[]>('get_secrets');
      setSecrets(list);
    } catch (e) {
      console.error('Failed to load secrets:', e);
    } finally {
      setLoading(false);
    }
  }, [setSecrets]);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_secret', { id });
      removeSecret(id);
    } catch (e) {
      console.error('Failed to delete secret:', e);
    }
  };

  const handleSave = (secret: SecretSummary) => {
    if (editingSecret) {
      updateSecret(secret.id, secret);
    } else {
      addSecret(secret);
    }
    setShowForm(false);
    setEditingSecret(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#000000]">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Secrets</h1>
              <p className="text-sm text-[#606060]">
                Store passwords, API keys, and other sensitive values locally
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadSecrets} loading={loading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingSecret(null);
                setShowForm(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Add Secret
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-violet-400 shrink-0" />
            <h3 className="text-sm font-medium text-violet-300">How Secrets Work</h3>
          </div>
          <p className="text-xs text-[#a0a0a0] leading-relaxed">
            Secrets are stored only on your device. Agents <strong className="text-white">never</strong> see
            the actual values — they use a placeholder like{' '}
            <code className="px-1 py-0.5 bg-[#1a1a1a] rounded text-violet-300 text-xs">
              {'{{my_api_key}}'}
            </code>{' '}
            in task instructions. The real value is substituted immediately before the browser action
            executes, entirely within the local Rust runtime.
          </p>
          <p className="text-xs text-[#a0a0a0]">
            Example task: <em>"Log in to GitHub using {'{{github_password}}'}"</em>
          </p>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <SecretForm
            initial={editingSecret}
            onSave={handleSave}
            onClose={() => {
              setShowForm(false);
              setEditingSecret(null);
            }}
          />
        )}

        {/* Secret list */}
        {secrets.length === 0 && !showForm ? (
          <div className="text-center py-12">
            <KeyRound className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
            <p className="text-sm text-[#606060]">No secrets stored yet</p>
            <p className="text-xs text-[#404040] mt-1">
              Add your first secret to use it in agent tasks
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {secrets.map((secret) => (
              <SecretCard
                key={secret.id}
                secret={secret}
                onEdit={() => {
                  setEditingSecret(secret);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(secret.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SecretForm — create / edit
// ---------------------------------------------------------------------------

interface SecretFormProps {
  initial: SecretSummary | null;
  onSave: (secret: SecretSummary) => void;
  onClose: () => void;
}

const SecretForm: React.FC<SecretFormProps> = ({ initial, onSave, onClose }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!initial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    // For edits, allow saving without changing the value (empty = keep existing).
    if (!isEdit && !value.trim()) {
      setError('Value is required');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const updated = await invoke<SecretSummary>('update_secret', {
          id: initial.id,
          name: name.trim(),
          description: description.trim(),
          value: value, // empty string = keep existing value (handled by backend)
        });
        onSave({ ...initial, ...updated });
      } else {
        const created = await invoke<SecretSummary>('create_secret', {
          name: name.trim(),
          description: description.trim(),
          value: value.trim(),
        });
        onSave(created);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-5 space-y-4"
    >
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-violet-400" />
        {isEdit ? 'Edit Secret' : 'New Secret'}
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-[#606060] mb-1 block">
            Name{' '}
            <span className="text-[#404040]">(used as {'{{name}}'} placeholder)</span>
          </label>
          <Input
            placeholder="e.g. github_api_key"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-mono"
          />
        </div>

        <div>
          <label className="text-xs text-[#606060] mb-1 block">Description (optional)</label>
          <Input
            placeholder="e.g. Personal GitHub token with repo access"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-[#606060] mb-1 block">
            Value{isEdit && <span className="text-[#404040]"> (leave blank to keep existing)</span>}
          </label>
          <div className="relative">
            <input
              type={showValue ? 'text' : 'password'}
              placeholder={isEdit ? '••••••••' : 'Enter secret value'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full pr-10 pl-3 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl text-sm text-white placeholder-[#404040] font-mono focus:outline-none focus:border-violet-600/50"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowValue((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-[#a0a0a0]"
              tabIndex={-1}
            >
              {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={saving}>
          {isEdit ? 'Save Changes' : 'Add Secret'}
        </Button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// SecretCard — single secret row
// ---------------------------------------------------------------------------

interface SecretCardProps {
  secret: SecretSummary;
  onEdit: () => void;
  onDelete: () => void;
}

const SecretCard: React.FC<SecretCardProps> = ({ secret, onEdit, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const placeholder = `{{${secret.name}}}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(placeholder);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white font-mono">{secret.name}</span>
            <button
              onClick={handleCopy}
              title="Copy placeholder"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] text-violet-400 transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {placeholder}
            </button>
          </div>
          {secret.description && (
            <p className="text-xs text-[#606060]">{secret.description}</p>
          )}
          <p className="text-xs text-[#404040]">
            Added {new Date(secret.created_at).toLocaleDateString()}
            {secret.updated_at !== secret.created_at &&
              ` · Updated ${new Date(secret.updated_at).toLocaleDateString()}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#a0a0a0] transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>

          {confirmDelete ? (
            <>
              <button
                onClick={onDelete}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1.5 rounded-xl text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#a0a0a0] transition-colors"
              >
                Cancel
              </button>
            </>
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
