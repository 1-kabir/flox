import React from 'react';
import {
  MessageSquare,
  Calendar,
  Settings,
  ScrollText,
  Zap,
  Puzzle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const navItems = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'automations', icon: Calendar, label: 'Automations' },
  { id: 'skills', icon: Puzzle, label: 'Skills' },
  { id: 'logs', icon: ScrollText, label: 'Logs' },
  { id: 'settings', icon: Settings, label: 'Settings' },
] as const;

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, isOnline } = useAppStore();

  return (
    <aside className="w-14 flex flex-col items-center py-4 gap-2 border-r border-[#1a1a1a] bg-[#000000]">
      {/* Logo */}
      <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center mb-2">
        <Zap className="w-4 h-4 text-white" />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            title={label}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200',
              activeTab === id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'text-[#606060] hover:text-[#a0a0a0] hover:bg-[#111111]'
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </nav>

      {/* Network status indicator */}
      <div
        title={isOnline ? 'Online' : 'Offline — waiting for network'}
        className="w-10 h-10 flex items-center justify-center"
      >
        {isOnline ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-500 animate-pulse" />
        )}
      </div>
    </aside>
  );
};
