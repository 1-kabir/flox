import React from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { ModelConfig } from '../../types';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq', label: 'Groq' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
  ollama: [
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'qwen2.5', label: 'Qwen 2.5' },
    { value: 'mistral', label: 'Mistral' },
  ],
  custom: [{ value: 'custom', label: 'Custom Model' }],
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
  const update = (field: keyof ModelConfig, value: string | number | undefined) => {
    onChange({ ...config, [field]: value });
  };

  const models = MODELS_BY_PROVIDER[config.provider] || [
    { value: config.model, label: config.model },
  ];

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
            const firstModel = (MODELS_BY_PROVIDER[provider] || [{ value: '', label: '' }])[0].value;
            onChange({ ...config, provider, model: firstModel });
          }}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Model</label>
          {config.provider === 'custom' || config.provider === 'ollama' ? (
            <Input
              value={config.model}
              onChange={(e) => update('model', e.target.value)}
              placeholder="Model name"
            />
          ) : (
            <Select
              options={models}
              value={config.model}
              onChange={(e) => update('model', e.target.value)}
            />
          )}
        </div>
      </div>

      <Input
        label="API Key"
        type="password"
        value={config.api_key}
        onChange={(e) => update('api_key', e.target.value)}
        placeholder={config.provider === 'ollama' ? 'Not required' : 'sk-...'}
        hint={config.provider === 'ollama' ? 'Ollama runs locally, no API key needed' : undefined}
      />

      {(config.provider === 'custom' || config.provider === 'ollama') && (
        <Input
          label="Base URL"
          value={config.base_url || ''}
          onChange={(e) => update('base_url', e.target.value || undefined)}
          placeholder="https://api.example.com/v1"
          hint="OpenAI-compatible API endpoint"
        />
      )}

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
    </div>
  );
};
