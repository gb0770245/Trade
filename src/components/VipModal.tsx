import React from 'react';
import { X, Crown, ShieldCheck, Zap, ArrowRight, Award } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VIP_TIERS } from '../data/mockData';

export const VipModal: React.FC = () => {
  const { user, closeModal, openModal, theme, platformSettings } = useApp();

  const currentLevel = user?.vipLevel || 0;
  const totalInvested = user?.totalInvested || 0;

  // Next level threshold
  const nextTier = VIP_TIERS.find((v) => v.level === currentLevel + 1);
  const neededMore = nextTier ? Math.max(0, nextTier.minInvestment - totalInvested) : 0;
  const progressPercent = nextTier
    ? Math.min(100, Math.round((totalInvested / nextTier.minInvestment) * 100))
    : 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 relative overflow-hidden transition-all shadow-2xl max-h-[90vh] flex flex-col overscroll-contain ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-lg font-bold">VIP Privileges</h3>
            <p className="text-xs text-slate-400">Exclusive member status and higher dividend yields</p>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3 pt-3 pb-2">
          {/* Current VIP Status Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Crown className="w-6 h-6 text-slate-950" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider opacity-80">Current Status</div>
                  <div className="text-xl font-black">VIP Level {currentLevel}</div>
                </div>
              </div>
              {nextTier && (
                <button
                  onClick={() => {
                    closeModal();
                    openModal('recharge');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-amber-400 text-xs font-bold hover:bg-slate-900 transition-all shadow-md active:scale-95"
                >
                  Upgrade Now
                </button>
              )}
            </div>

            {/* Progress */}
            {nextTier ? (
              <div className="mt-3 pt-3 border-t border-slate-950/20">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Upgrade to VIP{nextTier.level} needs ${neededMore.toFixed(2)} more</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950/20 overflow-hidden">
                  <div
                    className="h-full bg-slate-950 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs font-semibold opacity-90">
                Maximum VIP Level achieved! Enjoy top tier benefits.
              </div>
            )}
          </div>

          {/* VIP Tiers List */}
          <div className="space-y-3">
            {VIP_TIERS.map((tier) => {
              const isCurrent = tier.level === currentLevel;
              const isUnlocked = currentLevel >= tier.level;

              return (
                <div
                  key={tier.level}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm ring-1 ring-amber-500/40'
                      : isUnlocked
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30'
                      : 'border-slate-200/60 dark:border-slate-800/60 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award
                        className={`w-5 h-5 ${
                          isCurrent
                            ? 'text-amber-500'
                            : isUnlocked
                            ? 'text-teal-600'
                            : 'text-slate-400'
                        }`}
                      />
                      <div>
                        <h4 className="text-sm font-bold">{tier.name}</h4>
                        <p className="text-[11px] text-slate-400">
                          Deposit Required: ${tier.minInvestment.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950'
                          : isUnlocked
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}
                    >
                      {isCurrent ? 'Current' : isUnlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] bg-white/60 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400">Withdrawal Fee:</span>{' '}
                      <span className="font-bold text-teal-600">
                        {platformSettings?.withdrawalFeePercent !== undefined
                          ? `${platformSettings.withdrawalFeePercent}%`
                          : `${tier.withdrawalFeePercent}%`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Daily Limit:</span>{' '}
                      <span className="font-bold">${tier.dailyWithdrawalLimit.toLocaleString()}</span>
                    </div>
                  </div>

                  <ul className="mt-2.5 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {tier.perks.map((perk, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
