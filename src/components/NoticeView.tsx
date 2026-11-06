import React from 'react';
import { ChevronLeft, Bell, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { INITIAL_NOTICES } from '../data/mockData';

export const NoticeView: React.FC = () => {
  const { goBack, notices } = useApp();
  const noticeList = notices && notices.length > 0 ? notices : INITIAL_NOTICES;

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      {/* Top Header */}
      <header className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
        <button
          type="button"
          onClick={goBack}
          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Back to Previous Page"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        </button>

        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Official Notices</h2>

        <div className="w-6" />
      </header>

      {/* Notice List */}
      <div className="px-4 mt-3 space-y-3">
        {noticeList.map((notice) => (
          <div
            key={notice.id}
            className={`p-4 rounded-2xl border transition-all ${
              notice.isImportant
                ? 'border-teal-500/50 bg-teal-50/30 dark:bg-teal-950/20 shadow-sm'
                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                  notice.isImportant
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {notice.tag}
              </span>
              <span className="text-[10px] text-slate-400">{notice.date}</span>
            </div>

            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 leading-snug">
              {notice.title}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {notice.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
