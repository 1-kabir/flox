import React, { useState, useEffect } from 'react';
import {
  Settings,
  Globe,
  RefreshCw,
  Brain,
  Save,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { Select } from '../ui/Select';
import { ModelConfigCard } from './ModelConfigCard';
import type { AppSettings, BrowserInfo, HilRoutingMode } from '../../types';

export const SettingsView: React.FC = () => {
  const { settings, setSettings, browsers, setBrowsers } = useAppStore();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const detectBrowsers = async () => {
    setDetecting(true);
    try {
      const detected = await invoke<BrowserInfo[]>('detect_browsers');
      setBrowsers(detected);
      if (detected.length > 0 && !localSettings.preferred_browser) {
        setLocalSettings((s) => ({ ...s, preferred_browser: detected[0].id }));
      }
    } catch (e) {
      console.error('Failed to detect browsers:', e);
    } finally {
      setDetecting(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await invoke('save_settings', { settings: localSettings });
      setSettings(localSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const browserOptions = [
    { value: '', label: 'Auto-select' },
    ...browsers.map((b) => ({ value: b.id, label: `${b.name} ${b.version || ''}` })),
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-100">Settings</h1>
              <p className="text-sm text-gray-500">Configure models, browsers, and behavior</p>
            </div>
          </div>
          <Button
            onClick={saveSettings}
            loading={saving}
            size="sm"
          >
            {saved ? (
              <><CheckCircle className="w-4 h-4" /> Saved!</>
            ) : (
              <><Save className="w-4 h-4" /> Save Settings</>
            )}
          </Button>
        </div>

        {/* Browser section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Browser
            </h2>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Detected Browsers</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {browsers.length > 0
                    ? `${browsers.length} browser(s) found`
                    : 'No browsers detected yet'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={detectBrowsers}
                loading={detecting}
              >
                <RefreshCw className="w-4 h-4" />
                Detect
              </Button>
            </div>

            {browsers.length > 0 && (
              <div className="space-y-2">
                {browsers.map((browser) => (
                  <div
                    key={browser.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-700/30"
                  >
                    <div>
                      <p className="text-sm text-gray-200">{browser.name}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{browser.path}</p>
                    </div>
                    {browser.version && (
                      <span className="text-xs text-gray-500">v{browser.version}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Select
              label="Preferred Browser"
              options={browserOptions}
              value={localSettings.preferred_browser || ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  preferred_browser: e.target.value || undefined,
                }))
              }
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Default Headless Mode</p>
                <p className="text-xs text-gray-500">Run automations without visible browser</p>
              </div>
              <Toggle
                checked={localSettings.headless_mode}
                onChange={(v) =>
                  setLocalSettings((s) => ({ ...s, headless_mode: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Capture Screenshots</p>
                <p className="text-xs text-gray-500">Take screenshots during automation (master on/off)</p>
              </div>
              <Toggle
                checked={localSettings.screenshots_enabled}
                onChange={(v) =>
                  setLocalSettings((s) => ({ ...s, screenshots_enabled: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Navigator Vision</p>
                <p className="text-xs text-gray-500">
                  {localSettings.navigator_vision
                    ? 'Navigator sees screenshots'
                    : 'Navigator reads page structure instead of screenshots'}
                </p>
              </div>
              <Toggle
                checked={localSettings.navigator_vision}
                onChange={(v) =>
                  setLocalSettings((s) => ({ ...s, navigator_vision: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Planner Vision</p>
                <p className="text-xs text-gray-500">
                  {localSettings.planner_vision
                    ? 'Planner sees screenshots'
                    : 'Planner uses text context only (faster/cheaper)'}
                </p>
              </div>
              <Toggle
                checked={localSettings.planner_vision}
                onChange={(v) =>
                  setLocalSettings((s) => ({ ...s, planner_vision: v }))
                }
              />
            </div>
          </div>
        </section>

        {/* Agent models */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              AI Models (BYOK/BYOM)
            </h2>
          </div>

          <ModelConfigCard
            title="🧠 Planner Agent"
            description="High-level task planning and strategy. Use a capable model."
            config={localSettings.planner_model}
            onChange={(config) =>
              setLocalSettings((s) => ({ ...s, planner_model: config }))
            }
          />

          <ModelConfigCard
            title="🧭 Navigator Agent"
            description="Executes browser actions step by step. Needs vision capability for screenshots."
            config={localSettings.navigator_model}
            onChange={(config) =>
              setLocalSettings((s) => ({ ...s, navigator_model: config }))
            }
          />

          <ModelConfigCard
            title="✅ Verifier Agent"
            description="Validates each action for safety and correctness. Lightweight model is fine."
            config={localSettings.verifier_model}
            onChange={(config) =>
              setLocalSettings((s) => ({ ...s, verifier_model: config }))
            }
          />
        </section>

        {/* Behavior */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Behavior
            </h2>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">
                Max Steps per Task
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={localSettings.max_steps}
                  onChange={(e) =>
                    setLocalSettings((s) => ({
                      ...s,
                      max_steps: parseInt(e.target.value, 10),
                    }))
                  }
                  className="flex-1 accent-violet-600"
                />
                <span className="text-sm text-gray-400 w-8">{localSettings.max_steps}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">
                Timeout (seconds)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="60"
                  max="600"
                  step="30"
                  value={localSettings.timeout_seconds}
                  onChange={(e) =>
                    setLocalSettings((s) => ({
                      ...s,
                      timeout_seconds: parseInt(e.target.value, 10),
                    }))
                  }
                  className="flex-1 accent-violet-600"
                />
                <span className="text-sm text-gray-400 w-16">
                  {localSettings.timeout_seconds}s
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Human-In-the-Loop Control */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Human-In-the-Loop Control
            </h2>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50 space-y-5">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-200">HIL Routing Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Controls when risky browser actions are sent for human review.
                </p>
              </div>

              {(
                [
                  {
                    value: 'all' as HilRoutingMode,
                    label: 'All',
                    description: 'Every risky action requires your approval.',
                  },
                  {
                    value: 'none' as HilRoutingMode,
                    label: 'None',
                    description: 'All actions auto-approved. Use with caution.',
                  },
                  {
                    value: 'auto' as HilRoutingMode,
                    label: 'Auto',
                    description:
                      'AI verifier decides; only uncertain/destructive actions reach you.',
                  },
                ] as { value: HilRoutingMode; label: string; description: string }[]
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                    localSettings.hil_routing_mode === option.value
                      ? 'border-violet-600/50 bg-violet-600/10'
                      : 'border-gray-700/40 hover:border-gray-600/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="hil_routing_mode"
                    value={option.value}
                    checked={localSettings.hil_routing_mode === option.value}
                    onChange={() =>
                      setLocalSettings((s) => ({
                        ...s,
                        hil_routing_mode: option.value,
                      }))
                    }
                    className="mt-0.5 accent-violet-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-200">{option.label}</p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Auto-try Alternatives</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  If an action is denied, agents automatically retry with a different approach.
                </p>
              </div>
              <Toggle
                checked={localSettings.auto_try_alternatives}
                onChange={(v) =>
                  setLocalSettings((s) => ({ ...s, auto_try_alternatives: v }))
                }
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
