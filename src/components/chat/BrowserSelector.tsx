import React from 'react';
import { Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';

export const BrowserSelector: React.FC = () => {
  const { browsers, selectedBrowser, setSelectedBrowser } = useAppStore();

  if (browsers.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>No browsers detected. Check settings.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Globe className="w-4 h-4 text-gray-500 shrink-0" />
      <div className="flex gap-2">
        {browsers.map((browser) => (
          <button
            key={browser.id}
            onClick={() => setSelectedBrowser(browser.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all duration-200 shrink-0',
              selectedBrowser === browser.id
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700'
            )}
          >
            {selectedBrowser === browser.id && (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            <span>{browser.name}</span>
            {browser.version && (
              <span className="text-xs opacity-60">{browser.version.split('.')[0]}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
