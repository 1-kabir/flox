import React from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import type { ModelConfig } from '../../types';

const PROVIDERS = [
  { value: 'openai',      label: 'OpenAI' },
  { value: 'anthropic',   label: 'Anthropic' },
  { value: 'gemini',      label: 'Google Gemini' },
  { value: 'groq',        label: 'Groq' },
  { value: 'cerebras',    label: 'Cerebras' },
  { value: 'cohere',      label: 'Cohere' },
  { value: 'mistral',     label: 'Mistral' },
  { value: 'together',    label: 'Together AI' },
  { value: 'openrouter',  label: 'OpenRouter' },
  { value: 'perplexity',  label: 'Perplexity' },
  { value: 'ollama',      label: 'Ollama (Local)' },
  { value: 'custom',      label: 'Custom (OpenAI-compatible)' },
];

/** Default base URLs shown as placeholder hints in the UI. */
const DEFAULT_BASE_URL: Record<string, string> = {
  openai:     'https://api.openai.com/v1',
  anthropic:  'https://api.anthropic.com/v1',
  gemini:     'https://generativelanguage.googleapis.com/v1beta/openai',
  groq:       'https://api.groq.com/openai/v1',
  cerebras:   'https://api.cerebras.ai/v1',
  cohere:     'https://api.cohere.com/compatibility/v1',
  mistral:    'https://api.mistral.ai/v1',
  together:   'https://api.together.xyz/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  perplexity: 'https://api.perplexity.ai',
  ollama:     'http://localhost:11434/v1',
};

const SUGGESTED_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o',            label: 'GPT-4o (vision)' },
    { value: 'gpt-4o-mini',       label: 'GPT-4o Mini (vision)' },
    { value: 'gpt-4-turbo',       label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo',     label: 'GPT-3.5 Turbo' },
    { value: 'o1',                label: 'o1' },
    { value: 'o1-mini',           label: 'o1-mini' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229',     label: 'Claude 3 Opus' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash (vision)' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'gemini-1.5-pro',        label: 'Gemini 1.5 Pro (vision)' },
    { value: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash (vision)' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile',   label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant',      label: 'Llama 3.1 8B' },
    { value: 'mixtral-8x7b-32768',        label: 'Mixtral 8x7B' },
    { value: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11B Vision' },
  ],
  cerebras: [
    { value: 'llama3.1-8b',  label: 'Llama 3.1 8B' },
    { value: 'llama3.1-70b', label: 'Llama 3.1 70B' },
    { value: 'llama3.3-70b', label: 'Llama 3.3 70B' },
  ],
  cohere: [
    { value: 'command-r-plus',  label: 'Command R+' },
    { value: 'command-r',       label: 'Command R' },
    { value: 'command',         label: 'Command' },
  ],
  mistral: [
    { value: 'mistral-large-latest',  label: 'Mistral Large' },
    { value: 'mistral-small-latest',  label: 'Mistral Small' },
    { value: 'codestral-latest',      label: 'Codestral' },
    { value: 'open-mistral-7b',       label: 'Open Mistral 7B' },
  ],
  together: [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo' },
    { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',  label: 'Llama 3.1 8B Turbo' },
    { value: 'mistralai/Mixtral-8x7B-Instruct-v0.1',          label: 'Mixtral 8x7B' },
  ],
  openrouter: [
    { value: 'openai/gpt-4o',                    label: 'GPT-4o (via OpenRouter)' },
    { value: 'anthropic/claude-3-5-sonnet',       label: 'Claude 3.5 Sonnet (via OpenRouter)' },
    { value: 'google/gemini-2.0-flash-001',       label: 'Gemini 2.0 Flash (via OpenRouter)' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (via OpenRouter)' },
  ],
  perplexity: [
    { value: 'sonar-pro',   label: 'Sonar Pro' },
    { value: 'sonar',       label: 'Sonar' },
    { value: 'sonar-deep-research', label: 'Sonar Deep Research' },
  ],
  ollama: [
    { value: 'llama3.2',  label: 'Llama 3.2' },
    { value: 'llava',     label: 'LLaVA (vision)' },
    { value: 'qwen2.5',   label: 'Qwen 2.5' },
    { value: 'mistral',   label: 'Mistral' },
    { value: 'phi3',      label: 'Phi-3' },
  ],
};

interface ModelConfigCardProps {
  title: string;
  description: string;
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}

export const ModelConfigCard: React.FC<ModelConfigCardProps> = ({
  title,
  description,
  config,
  onChange,
}) => {
  const update = (field: keyof ModelConfig, value: string | number | boolean | undefined) => {
    onChange({ ...config, [field]: value });
  };

  const suggestions = SUGGESTED_MODELS[config.provider] || [];
  const baseUrlPlaceholder = DEFAULT_BASE_URL[config.provider] || 'https://api.example.com/v1';
  const isLocalProvider = config.provider === 'ollama';

  return (
    <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Provider"
          value={config.provider}
          options={PROVIDERS}
          onChange={(e) => {
            const provider = e.target.value;
            const firstModel = (SUGGESTED_MODELS[provider] || [{ value: '', label: '' }])[0].value;
            onChange({ ...config, provider, model: firstModel, base_url: undefined });
          }}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Model</label>
          {suggestions.length > 0 ? (
            <Select
              options={[...suggestions, { value: '__custom__', label: 'Other (type below)' }]}
              value={suggestions.some((s) => s.value === config.model) ? config.model : '__custom__'}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  update('model', e.target.value);
                }
              }}
            />
          ) : null}
          {(suggestions.length === 0 || !suggestions.some((s) => s.value === config.model)) && (
            <Input
              value={config.model}
              onChange={(e) => update('model', e.target.value)}
              placeholder="Model name (e.g. gpt-4o)"
            />
          )}
        </div>
      </div>

      <Input
        label="API Key"
        type="password"
        value={config.api_key}
        onChange={(e) => update('api_key', e.target.value)}
        placeholder={isLocalProvider ? 'Not required' : 'Your API key'}
        hint={isLocalProvider ? 'Ollama runs locally — no API key needed' : undefined}
      />

      <Input
        label="Base URL"
        value={config.base_url || ''}
        onChange={(e) => update('base_url', e.target.value || undefined)}
        placeholder={baseUrlPlaceholder}
        hint={
          config.base_url
            ? undefined
            : `Default: ${baseUrlPlaceholder}`
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Temperature</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature}
              onChange={(e) => update('temperature', parseFloat(e.target.value))}
              className="flex-1 accent-violet-600"
            />
            <span className="text-sm text-gray-400 w-8 text-right">
              {config.temperature.toFixed(1)}
            </span>
          </div>
        </div>

        <Input
          label="Max Tokens"
          type="number"
          value={config.max_tokens}
          onChange={(e) => update('max_tokens', parseInt(e.target.value, 10))}
          min={256}
          max={8192}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm font-medium text-gray-200">Vision Mode</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Send a page screenshot to the model (requires a vision-capable model)
          </p>
        </div>
        <Toggle
          checked={config.vision ?? false}
          onChange={(v) => update('vision', v)}
        />
      </div>
    </div>
  );
};
