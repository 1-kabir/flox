import React from 'react';
import {
  MessageSquare,
  Calendar,
  Settings,
  ScrollText,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const navItems = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'automations', icon: Calendar, label: 'Automations' },
  { id: 'logs', icon: ScrollText, label: 'Logs' },
  { id: 'settings', icon: Settings, label: 'Settings' },
] as const;

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, theme, toggleTheme } = useAppStore();

  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-2 border-r border-gray-800 bg-gray-950">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center mb-4">
        <Zap className="w-5 h-5 text-white" />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            title={label}
            className={cn(
              'w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200',
              activeTab === id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            )}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Toggle theme"
        className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all duration-200"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </button>
    </aside>
  );
};
