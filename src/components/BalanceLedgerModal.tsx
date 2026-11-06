import React, { useState } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  History,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Coins,
  Wallet,
  TrendingUp,
  CreditCard,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useApp, deduplicateTransactions } from '../context/AppContext';
import { getTransactionTime } from '../services/dbService';
import { Transaction } from '../types';

export const BalanceLedgerModal: React.FC = () => {
  const { user, transactions, closeModal, theme } = useApp();
  const [filter, setFilter] = useState<'all' | 'recharge' | 'withdraw' | 'earnings'>('all');
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Guarantee strict line-by-line chronological descending order & reference deduplication
  const sortedTxs = deduplicateTransactions(transactions);

  const filteredTxs = sortedTxs.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'recharge') return tx.type === 'recharge';
    if (filter === 'withdraw') return tx.type === 'withdraw';
    if (filter === 'earnings') {
      return (
        tx.type === 'earnings' ||
        tx.type === 'bonus' ||
        tx.type === 'spin_win' ||
        tx.type === 'commission'
      );
    }
    return true;
  });

  const handleCopyRef = (ref: string) => {
    if (!ref) return;
    try {
      navigator.clipboard?.writeText(ref);
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 2000);
    } catch (e) {
      console.warn('Failed to copy ref:', e);
    }
  };

  const getTxIcon = (tx: Transaction) => {
    if (tx.type === 'withdraw') {
      return <ArrowDownLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
    if (tx.type === 'recharge') {
      return <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (tx.type === 'earnings') {
      return <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (tx.type === 'spin_win') {
      return <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    return <Gift className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in overscroll-contain"
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
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  History
                </h3>
                <span className="text-[10px] bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-extrabold px-2 py-0.5 rounded-full border border-teal-200/50 dark:border-teal-800/40">
                  {transactions.length} Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Complete financial history (Newest first • Line by line)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Wallets Strip */}
        <div className="grid grid-cols-3 gap-2 my-3 p-3 rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white shrink-0 shadow-md text-center">
          <div>
            <div className="text-[10px] opacity-80 flex items-center justify-center gap-1">
              <Coins className="w-3 h-3 text-amber-300" />
              Add Money
            </div>
            <div className="text-sm font-black num-tabular mt-0.5">
              ${(user?.rechargeBalance || 0).toFixed(2)}
            </div>
          </div>
          <div className="border-x border-white/20">
            <div className="text-[10px] opacity-80 flex items-center justify-center gap-1">
              <Wallet className="w-3 h-3 text-emerald-300" />
              Withdrawal
            </div>
            <div className="text-sm font-black num-tabular text-emerald-300 mt-0.5">
              ${(user?.withdrawalBalance || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] opacity-80 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-cyan-300" />
              Product Income
            </div>
            <div className="text-sm font-black num-tabular mt-0.5">
              ${(user?.productRevenue || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 mb-3 shrink-0 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All History' },
            { key: 'recharge', label: 'Add Money' },
            { key: 'withdraw', label: 'Withdrawal' },
            { key: 'earnings', label: 'Income & Bonus' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filter === tab.key
                  ? 'bg-teal-700 text-white shadow-sm ring-1 ring-teal-500'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transactions list - Guaranteed Line-by-Line chronological ordering */}
        <div className="overflow-y-auto overscroll-contain space-y-2.5 pr-1 flex-1 min-h-0">
          {filteredTxs.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-50" />
              No transaction records found in this category.
            </div>
          ) : (
            filteredTxs.map((tx, idx) => {
              const isWithdraw = tx.type === 'withdraw';
              const isRecharge = tx.type === 'recharge';
              const isEarnings = tx.type === 'earnings';
              const isBonus = tx.type === 'bonus' || tx.type === 'commission' || tx.type === 'spin_win';

              return (
                <div
                  key={tx.id ? `${tx.id}-${idx}` : `tx-${idx}`}
                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-teal-500/40 transition-colors text-xs"
                >
                  {/* Top Row: Icon, Title & Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isWithdraw
                            ? 'bg-amber-100 dark:bg-amber-950/60'
                            : isRecharge
                            ? 'bg-blue-100 dark:bg-blue-950/60'
                            : isEarnings
                            ? 'bg-emerald-100 dark:bg-emerald-950/60'
                            : 'bg-purple-100 dark:bg-purple-950/60'
                        }`}
                      >
                        {getTxIcon(tx)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {tx.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{tx.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-black num-tabular text-sm ${
                          isWithdraw
                            ? 'text-amber-600 dark:text-amber-400'
                            : isRecharge
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isWithdraw
                          ? `-$${Math.abs(tx.amount).toFixed(2)}`
                          : `+$${Math.abs(tx.amount).toFixed(2)}`}
                      </div>

                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 mt-1 ${
                          tx.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40'
                            : tx.status === 'processing'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40'
                        }`}
                      >
                        {tx.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {tx.status === 'processing' && <Clock className="w-2.5 h-2.5 animate-spin" />}
                        {tx.status === 'rejected' && <AlertCircle className="w-2.5 h-2.5" />}
                        <span className="capitalize">{tx.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Reference Number & Copy Row */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-400 font-mono">
                      <span>Ref:</span>
                      <span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[160px]">
                        {tx.referenceNo || tx.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(tx.referenceNo || tx.id)}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-teal-600 dark:text-teal-400"
                        title="Copy Reference ID"
                      >
                        {copiedRef === (tx.referenceNo || tx.id) ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {tx.paymentMethod && (
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[170px]">
                        {tx.paymentMethod}
                      </span>
                    )}
                  </div>

                  {/* Withdrawal Specific Detail Breakdown (Fee, Net Payout, Bank A/C) */}
                  {isWithdraw && tx.bankDetails && (
                    <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-slate-600 dark:text-slate-300 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Account Holder:</span>
                        <strong className="text-slate-800 dark:text-slate-100">
                          {tx.bankDetails.accountHolder}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-slate-400">Bank / A/C:</span>
                        <span>
                          {tx.bankDetails.bankName} • {tx.bankDetails.accountNumber}
                        </span>
                      </div>
                      <div className="flex justify-between items-center font-mono">
                        <span className="text-slate-400">IFSC Code:</span>
                        <span>{tx.bankDetails.ifscCode}</span>
                      </div>
                      {tx.feeAmount !== undefined && tx.netAmount !== undefined && (
                        <div className="flex justify-between items-center pt-1 border-t border-amber-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                          <span>Net Payout (After Fee):</span>
                          <span>${tx.netAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
