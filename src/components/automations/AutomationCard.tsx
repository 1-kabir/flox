import React from 'react';
import { Play, Trash2, Clock, Calendar, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn, formatRelativeTime } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';
import type { Automation } from '../../types';

interface AutomationCardProps {
  automation: Automation;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onRunNow: () => void;
  isRunning?: boolean;
}

export const AutomationCard: React.FC<AutomationCardProps> = ({
  automation,
  onToggle,
  onDelete,
  onRunNow,
  isRunning,
}) => {
  const statusBadge = automation.last_result?.startsWith('success')
    ? 'success'
    : automation.last_result?.startsWith('error')
    ? 'danger'
    : 'default';

  return (
    <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-200">{automation.name}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{automation.prompt}</p>
        </div>
        <Toggle checked={automation.enabled} onChange={onToggle} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Every {automation.interval_minutes}m</span>
        </div>

        {automation.last_run && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Last: {formatRelativeTime(automation.last_run)}</span>
          </div>
        )}

        {automation.next_run && automation.enabled && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Next: {formatRelativeTime(automation.next_run)}</span>
          </div>
        )}
      </div>

      {automation.last_result && (
        <div className={cn(
          'flex items-start gap-2 px-3 py-2 rounded-xl text-xs',
          statusBadge === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {statusBadge === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          )}
          <span>{automation.last_result}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Badge variant={automation.enabled ? 'success' : 'default'}>
          {automation.enabled ? 'Active' : 'Inactive'}
        </Badge>

        <div className="flex items-center gap-2">
          <button
            onClick={onRunNow}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 transition-colors disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Run Now
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
