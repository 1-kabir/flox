import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Automation } from '../../types';

interface AutomationFormProps {
  onSave: (automation: Partial<Automation>) => void;
  onClose: () => void;
  initial?: Partial<Automation>;
}

export const AutomationForm: React.FC<AutomationFormProps> = ({
  onSave,
  onClose,
  initial,
}) => {
  const [form, setForm] = useState({
    name: initial?.name || '',
    prompt: initial?.prompt || '',
    interval_minutes: initial?.interval_minutes || 60,
    enabled: initial?.enabled ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.prompt.trim()) errs.prompt = 'Prompt is required';
    if (form.interval_minutes < 1) errs.interval = 'Minimum 1 minute';
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSave({ ...initial, ...form, id: initial?.id || '' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-100">
            {initial?.id ? 'Edit Automation' : 'New Automation'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label="Automation Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Daily news summary"
            error={errors.name}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Prompt</label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              placeholder="Search for the latest tech news and summarize the top 5 articles..."
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-xl border bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
            {errors.prompt && (
              <p className="text-xs text-red-400">{errors.prompt}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">
              Run Interval (minutes)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="1440"
                step="5"
                value={form.interval_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    interval_minutes: parseInt(e.target.value, 10),
                  }))
                }
                className="flex-1 accent-violet-600"
              />
              <span className="text-sm text-gray-400 w-20 text-right">
                {form.interval_minutes >= 60
                  ? `${(form.interval_minutes / 60).toFixed(1)}h`
                  : `${form.interval_minutes}m`}
              </span>
            </div>
            {errors.interval && (
              <p className="text-xs text-red-400">{errors.interval}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit">
              {initial?.id ? 'Save Changes' : 'Create Automation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
