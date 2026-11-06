import React, { useState } from 'react';
import {
  X,
  Gift,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RewardsModal: React.FC = () => {
  const {
    user,
    redeemGiftCode,
    closeModal,
    theme,
  } = useApp();

  const [giftCode, setGiftCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRedeem = async (e?: React.FormEvent, codeToUse?: string) => {
    if (e) e.preventDefault();
    const code = (codeToUse || giftCode).trim().toUpperCase();
    if (!code) return;
    setIsSubmitting(true);
    await redeemGiftCode(code);
    setGiftCode('');
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div
        className={`w-full max-w-md rounded-3xl p-5 sm:p-6 relative overflow-hidden transition-all shadow-2xl max-h-[92vh] flex flex-col ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-md">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                Gift Card Center (गिफ्ट कार्ड केंद्र)
              </h3>
              <p className="text-[11px] text-slate-400">
                Redeem promotional gift cards & cash vouchers
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-0.5">
          {/* Luxury Digital Gift Card Visual */}
          <div className="p-5 rounded-3xl bg-gradient-to-tr from-slate-950 via-slate-900 to-amber-950 text-white border border-amber-500/40 shadow-xl relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black tracking-wider uppercase text-amber-400 block">
                    Nexa AI Official Gift Card
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">INSTANT WALLET VOUCHER</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% Real Payout
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Beneficiary Account:</span>
                <span className="font-bold text-slate-200">{user?.nickname || 'Member'} (+91 {user?.phone || '••••••••••'})</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Withdrawal Balance:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  ${(user?.withdrawalBalance || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Gift Code Input & Form */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span>Enter Gift Card / Voucher Code (कोड दर्ज करें)</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Instant Credit</span>
            </label>

            <form onSubmit={(e) => handleRedeem(e)} className="flex gap-2">
              <input
                type="text"
                value={giftCode}
                onChange={(e) => setGiftCode(e.target.value.toUpperCase().trim())}
                placeholder="e.g. WELCOME50, NEXA2026"
                className="flex-1 text-xs uppercase px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none font-mono font-bold tracking-wider focus:border-amber-500 text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!giftCode.trim() || isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Redeeming...' : 'Redeem'}
              </button>
            </form>
          </div>

          {/* Security & Instructions Notice */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Official Voucher Security & Rules
            </h5>
            <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span><strong>Exclusive Redemption:</strong> Gift cards and promo vouchers are official codes issued by platform management.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span><strong>Direct Wallet Credit:</strong> The voucher amount is added instantly to your Withdrawal Balance.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span><strong>Single Use:</strong> Each promotional code can only be redeemed once per account.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
