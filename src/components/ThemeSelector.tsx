import React from 'react';
import { Palette, Smartphone, Monitor } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ThemeMode } from '../types';

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme, deviceMode, setDeviceMode } = useApp();

  const themes: Array<{ id: ThemeMode; label: string; color: string }> = [
    { id: 'teal-clean', label: 'Emerald Mint', color: 'bg-teal-600' },
    { id: 'obsidian-gold', label: 'Obsidian 24K Gold', color: 'bg-amber-500' },
    { id: 'cyber-hydrogen', label: 'Cyber Hydrogen', color: 'bg-cyan-500' },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Theme Picker */}
      <div className="flex items-center p-1 rounded-xl bg-black/10 dark:bg-white/10 backdrop-blur-md border border-white/20">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            title={t.label}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              theme === t.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Device Viewport Switcher */}
      <div className="hidden md:flex items-center p-1 rounded-xl bg-black/10 dark:bg-white/10 backdrop-blur-md border border-white/20">
        <button
          type="button"
          onClick={() => setDeviceMode('mobile-frame')}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            deviceMode === 'mobile-frame'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 dark:text-slate-300'
          }`}
          title="Mobile Frame View"
        >
          <Smartphone className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setDeviceMode('expanded-desktop')}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            deviceMode === 'expanded-desktop'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 dark:text-slate-300'
          }`}
          title="Expanded Desktop View"
        >
          <Monitor className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
