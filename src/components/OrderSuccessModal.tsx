import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, Copy, Check, Sparkles, ArrowRight, X, ShieldCheck, Zap, Calendar, TrendingUp } from 'lucide-react';

export const OrderSuccessModal: React.FC = () => {
  const { orderSuccessData, closeOrderSuccessModal, openModal, setActiveTab } = useApp();
  const [copied, setCopied] = useState(false);

  if (!orderSuccessData) return null;

  const {
    orderId,
    userName,
    userPhone,
    productName,
    amount,
    dailyEarnings,
    cycleDays,
    totalRevenue,
    timestamp,
    status = 'active',
  } = orderSuccessData;

  const handleCopyOrderId = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleViewOrders = () => {
    closeOrderSuccessModal();
    // Navigate user directly to their orders
    openModal('orders');
  };

  const inrAmount = Math.round(amount * 100);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overscroll-contain select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeOrderSuccessModal();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-teal-500/30 text-slate-800 dark:text-slate-100 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Decorative ambient background glows */}
        <div className="absolute -top-14 -right-14 w-36 h-36 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-14 w-36 h-36 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeOrderSuccessModal}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Celebratory Header Badge */}
        <div className="flex flex-col items-center text-center mt-1 mb-3">
          <div className="relative mb-2.5 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/30 ring-4 ring-teal-500/10 animate-bounce">
              <Sparkles className="w-8 h-8 text-white" />
            </span>
          </div>

          <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 mb-1 flex items-center gap-1.5 shadow-sm">
            <span>🎉</span> Congratulations! • बधाई हो!
          </span>
          <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight mt-0.5">
            Order Activated Successfully!
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            आपका ऑर्डर सफलतापूर्वक सक्रिय हो गया है
          </p>
        </div>

        {/* User & Order ID Highlight Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/90 dark:to-slate-850 border border-slate-200 dark:border-slate-700/80 mb-3 space-y-2">
          {/* User Name */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <span>👤</span> User Name (खरीदार):
            </span>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                {userName || 'Member'}
              </span>
              {userPhone && (
                <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono block">
                  +91 {userPhone.slice(-10)}
                </span>
              )}
            </div>
          </div>

          {/* Order ID with Instant Copy Button */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <span>🔖</span> Order ID (ऑर्डर आईडी):
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md border border-teal-500/20">
                {orderId}
              </span>
              <button
                type="button"
                onClick={handleCopyOrderId}
                className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-teal-500 hover:text-white text-slate-600 dark:text-slate-300 transition-all cursor-pointer flex items-center text-[10px] gap-1 px-1.5"
                title="Copy Order ID"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Contract Product Details Card */}
        <div className="p-3.5 rounded-2xl bg-teal-950/20 dark:bg-teal-950/40 border border-teal-500/30 mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px] flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {productName}
            </span>
            <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
              ${amount.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">(₹{inrAmount.toLocaleString()})</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-teal-500/20 text-[11px]">
            {dailyEarnings !== undefined && (
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Daily Return / दिन:</span>
                <span className="font-bold text-emerald-500 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +${dailyEarnings.toFixed(2)}
                </span>
              </div>
            )}
            {cycleDays !== undefined && (
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Cycle Period / अवधि:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-0.5">
                  <Calendar className="w-3 h-3 text-cyan-400" /> {cycleDays} Days
                </span>
              </div>
            )}
            {totalRevenue !== undefined && (
              <div className="col-span-2 flex items-center justify-between pt-1 border-t border-teal-500/10">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Total Estimated Return:</span>
                <span className="font-bold text-teal-400 font-mono">${totalRevenue.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Status Box */}
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mb-4 flex items-center gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            First daily dividend unlocks in <strong>24 hours</strong>. Claimed returns are credited directly to your withdrawable wallet!
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleViewOrders}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-98"
          >
            <span>View My Orders (मेरे ऑर्डर्स देखें)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={closeOrderSuccessModal}
            className="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer text-center"
          >
            Done • ठीक है
          </button>
        </div>
      </div>
    </div>
  );
};
