import React from 'react';
import { Home, ShoppingBag, Bell, BookOpen, User as UserIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, theme } = useApp();

  const getThemeNavStyles = () => {
    if (theme === 'obsidian-gold') {
      return {
        bg: 'bg-slate-900/95 border-amber-500/20 text-slate-400',
        active: 'text-amber-400 font-semibold',
        centerBtn: 'bg-gradient-to-tr from-amber-500 to-yellow-600 text-slate-950 shadow-amber-500/40 ring-4 ring-slate-900',
        activeDot: 'bg-amber-400',
      };
    }
    if (theme === 'cyber-hydrogen') {
      return {
        bg: 'bg-slate-900/95 border-cyan-500/20 text-slate-400',
        active: 'text-cyan-400 font-semibold',
        centerBtn: 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/40 ring-4 ring-slate-900',
        activeDot: 'bg-cyan-400',
      };
    }
    // Screenshot authentic teal
    return {
      bg: 'bg-white/95 border-slate-200/80 text-slate-400 dark:bg-slate-900/95 dark:border-slate-800',
      active: 'text-teal-700 dark:text-teal-400 font-semibold',
      centerBtn: 'bg-gradient-to-tr from-teal-700 to-emerald-600 text-white shadow-teal-700/30 ring-4 ring-white dark:ring-slate-900',
      activeDot: 'bg-teal-700 dark:bg-teal-400',
    };
  };

  const style = getThemeNavStyles();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <nav
        className={`w-full max-w-md pointer-events-auto backdrop-blur-xl border-t shadow-2xl px-2 h-16 pb-[calc(env(safe-area-inset-bottom,0px))] flex items-center justify-around relative transition-colors ${style.bg}`}
      >
        {/* Home */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            activeTab === 'home' ? style.active : 'hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] font-semibold mt-0.5 tracking-tight">Home</span>
          {activeTab === 'home' && (
            <span className={`w-1 h-1 rounded-full absolute -top-1 ${style.activeDot}`} />
          )}
        </button>

        {/* Hardware Store & Invest */}
        <button
          type="button"
          onClick={() => setActiveTab('invest')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            activeTab === 'invest' ? style.active : 'hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[11px] font-semibold mt-0.5 tracking-tight">Store</span>
          {activeTab === 'invest' && (
            <span className={`w-1 h-1 rounded-full absolute -top-1 ${style.activeDot}`} />
          )}
        </button>

        {/* Center Raised Notice Button */}
        <div className="flex-1 flex justify-center relative -top-3">
          <button
            type="button"
            onClick={() => setActiveTab('notice')}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl active:scale-95 transition-transform ${style.centerBtn}`}
            aria-label="Official Notices"
          >
            <Bell className="w-5 h-5" />
            <span className="text-[9px] font-black mt-0.5 tracking-wide">Notice</span>
          </button>
        </div>

        {/* Blog / News */}
        <button
          type="button"
          onClick={() => setActiveTab('blog')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            activeTab === 'blog' ? style.active : 'hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[11px] font-semibold mt-0.5 tracking-tight">Blog</span>
          {activeTab === 'blog' && (
            <span className={`w-1 h-1 rounded-full absolute -top-1 ${style.activeDot}`} />
          )}
        </button>

        {/* Account */}
        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            activeTab === 'account' ? style.active : 'hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[11px] font-semibold mt-0.5 tracking-tight">Account</span>
          {activeTab === 'account' && (
            <span className={`w-1 h-1 rounded-full absolute -top-1 ${style.activeDot}`} />
          )}
        </button>
      </nav>
    </div>
  );
};
