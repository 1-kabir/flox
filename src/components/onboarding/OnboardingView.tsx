import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Zap,
  CheckCircle,
  Circle,
  ArrowRight,
  Globe,
  Key,
  Wifi,
  Monitor,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import type { BrowserInfo, AppSettings } from '../../types';

type Step = 'welcome' | 'requirements' | 'api-key' | 'done';

const STEPS: Step[] = ['welcome', 'requirements', 'api-key', 'done'];

interface RequirementStatus {
  label: string;
  detected: boolean;
  icon: React.ReactNode;
}

export const OnboardingView: React.FC = () => {
  const { settings, setSettings, setActiveTab } = useAppStore();
  const [step, setStep] = useState<Step>('welcome');
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [isOnline, setIsOnlineLocal] = useState<boolean | null>(null);
  const [checkingReqs, setCheckingReqs] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const checkRequirements = async () => {
    setCheckingReqs(true);
    try {
      const [detected, online] = await Promise.all([
        invoke<BrowserInfo[]>('detect_browsers'),
        invoke<boolean>('check_network'),
      ]);
      setBrowsers(detected);
      setIsOnlineLocal(online);
    } catch {
      setIsOnlineLocal(false);
    } finally {
      setCheckingReqs(false);
    }
  };

  useEffect(() => {
    if (step === 'requirements') {
      checkRequirements();
    }
  }, [step]);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const handleDone = async () => {
    const updated: AppSettings = { ...settings, onboarding_complete: true };
    try {
      await invoke('save_settings', { settings: updated });
      setSettings(updated);
    } catch {
      // Continue even if saving fails.
    }
  };

  const requirements: RequirementStatus[] = [
    {
      label: browsers.length > 0
        ? `Chromium browser detected (${browsers[0]?.name ?? ''})`
        : 'No supported browser detected (Chrome, Edge, Brave, or Vivaldi)',
      detected: browsers.length > 0,
      icon: <Monitor className="w-4 h-4" />,
    },
    {
      label: isOnline === true
        ? 'Internet connection available'
        : isOnline === false
        ? 'No internet connection detected'
        : 'Checking connection…',
      detected: isOnline === true,
      icon: <Wifi className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center bg-[#000000] p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-violet-500' : 'bg-[#2a2a2a]'
                }`}
              />
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 ${i < stepIndex ? 'bg-violet-500' : 'bg-[#2a2a2a]'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Welcome to Flox</h1>
              <p className="text-[#a0a0a0] text-sm leading-relaxed">
                Flox is an AI-powered browser automation desktop app. It uses large language models
                to plan and execute tasks in your browser — fully locally, with your own API keys.
              </p>
            </div>
            <Button onClick={goNext} className="w-full justify-center">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 'requirements' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">System Requirements</h2>
              <p className="text-[#606060] text-sm">
                Flox needs a Chromium browser and an internet connection to operate.
              </p>
            </div>

            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-5 space-y-4">
              {requirements.map((req) => (
                <div key={req.label} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 ${req.detected ? 'text-green-400' : checkingReqs ? 'text-[#606060]' : 'text-red-400'}`}
                  >
                    {req.detected ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#a0a0a0]">
                    {req.icon}
                    {req.label}
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 mt-0.5 text-green-400" />
                <div className="flex items-center gap-2 text-sm text-[#a0a0a0]">
                  <Globe className="w-4 h-4" />
                  Node.js 18+ (only needed for building from source)
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={checkRequirements}
                loading={checkingReqs}
                className="flex-1 justify-center"
              >
                Re-check
              </Button>
              <Button onClick={goNext} className="flex-1 justify-center">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'api-key' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center mx-auto mb-3">
                <Key className="w-6 h-6 text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">API Key Setup</h2>
              <p className="text-[#606060] text-sm leading-relaxed">
                Flox requires API keys to call AI models. You can configure them in Settings at any
                time. Bring your own key from OpenAI, Anthropic, Groq, or use a local Ollama model.
              </p>
            </div>

            <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 text-sm text-[#a0a0a0] leading-relaxed">
              Your API keys are stored locally on this device and never sent to any Flox server.
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  goNext();
                }}
                className="flex-1 justify-center"
              >
                Skip for now
              </Button>
              <Button
                onClick={() => {
                  goNext();
                  setActiveTab('settings');
                }}
                className="flex-1 justify-center"
              >
                Go to Settings <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-green-600/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
              <p className="text-[#a0a0a0] text-sm leading-relaxed">
                Start by typing a task in the chat. For example:
                <br />
                <span className="text-violet-300 italic">"Search for the latest AI news on Hacker News"</span>
              </p>
            </div>
            <Button onClick={handleDone} className="w-full justify-center">
              Start Using Flox <Zap className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
