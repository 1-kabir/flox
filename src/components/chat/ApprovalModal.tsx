import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import type { ApprovalRequest } from '../../types';

export const ApprovalModal: React.FC = () => {
  const { pendingApprovals, removeApproval } = useAppStore();

  if (pendingApprovals.length === 0) return null;

  const approval = pendingApprovals[0];

  const respond = async (approved: boolean) => {
    try {
      await invoke('resolve_approval', { approvalId: approval.approval_id, approved });
    } catch (e) {
      console.error('Failed to resolve approval:', e);
    } finally {
      removeApproval(approval.approval_id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-amber-300">Approval Required</h2>
            <p className="text-xs text-amber-400/70">The agent wants to perform a potentially risky action</p>
          </div>
          <span className="ml-auto text-xs text-gray-500">
            {pendingApprovals.length > 1 && `+${pendingApprovals.length - 1} more`}
          </span>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <ActionPreview approval={approval} />

          <div className="bg-gray-800/50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-gray-400 mb-1">Reason for review</p>
            <p className="text-sm text-gray-300">{approval.reason}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <Button
            variant="danger"
            onClick={() => respond(false)}
            className="flex-1"
          >
            <X className="w-4 h-4" />
            Reject
          </Button>
          <Button
            onClick={() => respond(true)}
            className="flex-1"
          >
            <Check className="w-4 h-4" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
};

const ActionPreview: React.FC<{ approval: ApprovalRequest }> = ({ approval }) => {
  const { action } = approval;
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</span>
        <span className="px-2 py-0.5 rounded-lg text-xs bg-amber-500/20 text-amber-400 font-medium">
          {action.action_type}
        </span>
      </div>
      {action.url && (
        <div>
          <span className="text-xs text-gray-500">URL: </span>
          <span className="text-xs text-gray-300 break-all">{action.url}</span>
        </div>
      )}
      {action.selector && (
        <div>
          <span className="text-xs text-gray-500">Selector: </span>
          <code className="text-xs text-violet-300">{action.selector}</code>
        </div>
      )}
      {action.value && (
        <div>
          <span className="text-xs text-gray-500">Value: </span>
          <span className="text-xs text-gray-300">{action.value}</span>
        </div>
      )}
    </div>
  );
};
