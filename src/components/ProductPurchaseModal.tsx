import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Wallet,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ProductPurchaseModal: React.FC = () => {
  const {
    user,
    investInProduct,
    openModal,
    selectedProductForInvest: selectedProduct,
    setSelectedProductForInvest: setSelectedProduct,
  } = useApp();

  const [isInvesting, setIsInvesting] = useState(false);

  if (!selectedProduct) return null;

  const userBalance = user?.rechargeBalance || 0;
  const hasEnoughBalance = userBalance >= selectedProduct.price;

  // Direct Pay from Charged Balance
  const handleConfirmInvestment = async () => {
    if (!user) {
      openModal('auth');
      return;
    }
    setIsInvesting(true);
    try {
      const res = await investInProduct(selectedProduct);
      if (res.success) {
        setSelectedProduct(null);
      }
    } finally {
      setIsInvesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedProduct(null);
      }}
    >
      <div className="w-full max-w-sm rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setSelectedProduct(null)}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 px-3 py-1 rounded-full inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-teal-600" />
            Direct Purchase & Investment
          </span>
          <h3 className="text-base font-extrabold mt-2.5 text-slate-900 dark:text-white line-clamp-1">
            {selectedProduct.retailName || selectedProduct.name}
          </h3>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              Duration: {selectedProduct.cycleDays} Days
            </span>
            <span>•</span>
            <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {selectedProduct.sku || 'NEXA-EQUIP'}
            </span>
          </div>
        </div>

        {/* Calculation Summary Box */}
        <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Equipment Price:</span>
            <span className="font-black text-amber-600 dark:text-amber-400 num-tabular text-sm">
              ${selectedProduct.price.toFixed(2)}
            </span>
          </div>
          {(() => {
            const dailyPct =
              selectedProduct.dailyPercent !== undefined
                ? selectedProduct.dailyPercent
                : selectedProduct.price > 0
                ? Number(((selectedProduct.dailyEarnings / selectedProduct.price) * 100).toFixed(1))
                : 50;
            return (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Daily Return (Yield):</span>
                <span className="font-bold text-teal-600 dark:text-teal-400 num-tabular">
                  +${selectedProduct.dailyEarnings.toFixed(2)} / Day ({dailyPct}%)
                </span>
              </div>
            );
          })()}
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Total Guaranteed Return:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 num-tabular">
              ${selectedProduct.totalRevenue.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center pt-2.5 border-t border-slate-200/80 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-teal-600" />
              Charged Balance:
            </span>
            <span
              className={`font-black num-tabular ${
                hasEnoughBalance ? 'text-teal-600 dark:text-teal-400' : 'text-rose-500'
              }`}
            >
              ${userBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Insufficient balance notice if needed */}
        {!hasEnoughBalance && (
          <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl mt-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span>Charged balance is ${userBalance.toFixed(2)}. Please add money to your wallet via UPI QR to purchase.</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 mt-4">
          {hasEnoughBalance ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInvestment}
                disabled={isInvesting}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-xs transition-all shadow-md shadow-teal-700/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isInvesting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Buy with Balance (${selectedProduct.price.toFixed(2)})</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(null);
                  openModal('recharge');
                }}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Add Money to Wallet</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
