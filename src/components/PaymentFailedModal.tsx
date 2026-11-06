import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertCircle, RefreshCw, X, ShieldCheck, ArrowRight, Ban, HelpCircle } from 'lucide-react';

export const PaymentFailedModal: React.FC = () => {
  const { paymentFailedData, closePaymentFailedModal, openModal } = useApp();

  if (!paymentFailedData) return null;

  const { reason, amountUsd, amountInr, productName, onRetry } = paymentFailedData;

  const handleRetry = () => {
    // 1. First close this failure modal
    closePaymentFailedModal();
    // 2. ONLY THEN trigger the payment gateway/option
    if (onRetry) {
      setTimeout(() => {
        onRetry();
      }, 150);
    }
  };

  const handleSupport = () => {
    closePaymentFailedModal();
    openModal('support');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overscroll-contain select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePaymentFailedModal();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl p-6 bg-white dark:bg-slate-900 border border-rose-500/30 text-slate-800 dark:text-slate-100 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={closePaymentFailedModal}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mt-1 mb-4">
          <div className="relative mb-3 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-rose-500/15 dark:bg-rose-950/60 flex items-center justify-center border border-rose-500/30 ring-4 ring-rose-500/10 animate-pulse">
              <Ban className="w-8 h-8 text-rose-500" />
            </span>
          </div>

          <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 px-3 py-1 rounded-full border border-rose-500/30 mb-1.5">
            Payment Unsuccessful • भुगतान असफल
          </span>

          <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Payment Failed
          </h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
            लेनदेन पूरा नहीं हो सका
          </p>
        </div>

        {/* Attempt Details */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 mb-3.5 space-y-2 text-xs">
          {productName && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="text-[11px] text-slate-400">Order Item:</span>
              <span className="font-bold truncate max-w-[190px]">{productName}</span>
            </div>
          )}

          {(amountUsd !== undefined || amountInr !== undefined) && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="text-[11px] text-slate-400">Attempted Amount:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                {amountUsd !== undefined && `$${amountUsd.toFixed(2)} USD `}
                {amountInr !== undefined && `(₹${amountInr.toLocaleString('en-IN')})`}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] text-slate-400 mb-0.5">Failure Reason / कारण:</div>
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
              <span>{reason || 'Transaction was declined by the bank or cancelled by user.'}</span>
            </div>
          </div>
        </div>

        {/* Bank & Safety Reassurance Note */}
        <div className="p-3 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-500/20 mb-5 text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-teal-900 dark:text-teal-200">
              Your money is 100% safe • आपका पैसा सुरक्षित है
            </p>
            <p className="text-[10px] text-teal-700 dark:text-teal-300/90 mt-0.5">
              यदि आपके खाते से पैसे कट गए हैं, तो वे बैंक नियमानुसार 24–48 घंटे के भीतर स्वतः वापस आ जाएंगे।
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again / पुनः प्रयास करें</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSupport}
              className="py-2.5 px-3 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-teal-500" />
              <span>Support</span>
            </button>

            <button
              type="button"
              onClick={closePaymentFailedModal}
              className="py-2.5 px-3 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel / बंद करें
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
