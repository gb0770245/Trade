import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  ArrowLeftRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Coins,
  Send,
  UserCheck,
  Copy,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Share2,
  ArrowRight,
  Users,
} from 'lucide-react';
import { useApp, deduplicateTransactions } from '../context/AppContext';
import { computeUserTotalBalance, enrichTransactionsWithBalanceAfter } from '../services/dbService';
import { P2PRecipientPreview, Transaction } from '../types';

const QUICK_AMOUNTS = [5, 10, 25, 50, 100];
const USD_TO_INR = 100;

export const P2PTransferModal: React.FC = () => {
  const {
    user,
    transactions,
    platformSettings,
    closeModal,
    lookupP2PRecipient,
    transferP2PFunds,
    showToast,
    theme,
  } = useApp();

  const [activeMode, setActiveMode] = useState<'send' | 'receive'>('send');
  const [sourceWallet, setSourceWallet] = useState<'rechargeBalance' | 'withdrawalBalance'>('rechargeBalance');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [verifiedRecipient, setVerifiedRecipient] = useState<P2PRecipientPreview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [amount, setAmount] = useState('10');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const [activityFilter, setActivityFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [receipt, setReceipt] = useState<{
    referenceNo: string;
    amount: number;
    recipient: P2PRecipientPreview;
    sourceWallet: 'rechargeBalance' | 'withdrawalBalance';
    tx?: Transaction;
  } | null>(null);

  const isDarkTheme = theme === 'obsidian-gold' || theme === 'cyber-hydrogen';
  const isP2PEnabled = platformSettings?.isP2PEnabled !== false;
  const minP2PAmount = Math.max(0.01, Number(platformSettings?.minP2PAmount) || 1);
  const maxP2PAmount = Math.max(minP2PAmount, Number(platformSettings?.maxP2PAmount) || 50000);

  const chargedBal = Number(user?.rechargeBalance) || 0;
  const withdrawalBal = Number(user?.withdrawalBalance) || 0;
  const totalBal = computeUserTotalBalance(user);
  const availableBal = sourceWallet === 'rechargeBalance' ? chargedBal : withdrawalBal;

  const numAmount = parseFloat(amount) || 0;
  const isAmountValid =
    Number.isFinite(numAmount) &&
    numAmount >= minP2PAmount &&
    numAmount <= Math.min(availableBal, maxP2PAmount);

  const enrichedTransactions = useMemo(
    () => enrichTransactionsWithBalanceAfter(deduplicateTransactions(transactions), user),
    [transactions, user]
  );

  const allP2PTxs = useMemo(
    () => enrichedTransactions.filter((tx) => tx.type === 'p2p_send' || tx.type === 'p2p_receive'),
    [enrichedTransactions]
  );

  const sentP2PTxs = useMemo(
    () => allP2PTxs.filter((tx) => tx.type === 'p2p_send'),
    [allP2PTxs]
  );

  const receivedP2PTxs = useMemo(
    () => allP2PTxs.filter((tx) => tx.type === 'p2p_receive'),
    [allP2PTxs]
  );

  const totalSentUsd = useMemo(
    () => sentP2PTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0),
    [sentP2PTxs]
  );

  const totalReceivedUsd = useMemo(
    () => receivedP2PTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0),
    [receivedP2PTxs]
  );

  // Extract unique previous recipients for instant 1-tap repeat transfer
  const quickRecipients = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const tx of sentP2PTxs) {
      if (tx.counterpartyId && !seen.has(tx.counterpartyId)) {
        seen.set(tx.counterpartyId, {
          id: tx.counterpartyId,
          name: tx.counterpartyName || `ID ${tx.counterpartyId}`,
        });
      }
      if (seen.size >= 4) break;
    }
    return Array.from(seen.values());
  }, [sentP2PTxs]);

  const filteredActivityTxs = useMemo(() => {
    if (activityFilter === 'sent') return sentP2PTxs.slice(0, 8);
    if (activityFilter === 'received') return receivedP2PTxs.slice(0, 8);
    return allP2PTxs.slice(0, 8);
  }, [activityFilter, allP2PTxs, sentP2PTxs, receivedP2PTxs]);

  const handleCopyValue = (value: string, label: string) => {
    if (!value) return;
    try {
      navigator.clipboard?.writeText(value);
      setCopiedField(label);
      showToast(`${label} copied!`, 'info');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handleShareReceiveDetails = async () => {
    if (!user) return;
    const shareText = `Send P2P funds to ${user.nickname} on Nexa AI\nUser ID: ${user.id}\nMobile: ${user.phone}\nInvite Code: ${user.invitationCode}\n(Funds credit instantly to Charged Balance)`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Nexa AI P2P Receive Details',
          text: shareText,
        });
        return;
      }
    } catch {}
    handleCopyValue(shareText, 'Receive Details');
  };

  const handleRecipientInputChange = (val: string) => {
    setRecipientQuery(val);
    setVerifiedRecipient(null);
    setLookupError(null);
  };

  const handleVerifyRecipient = async (overrideQuery?: string) => {
    const clean = (overrideQuery ?? recipientQuery).trim();
    if (overrideQuery !== undefined) {
      setRecipientQuery(clean);
    }
    if (!clean || clean.length < 3) {
      setLookupError('Enter recipient User ID, 10-digit Mobile, or Invite Code.');
      setVerifiedRecipient(null);
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    try {
      const res = await lookupP2PRecipient(clean);
      if (!res.success || !res.recipient) {
        setVerifiedRecipient(null);
        setLookupError(res.error || 'User not found.');
      } else {
        setVerifiedRecipient(res.recipient);
        setLookupError(null);
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (isSubmittingRef.current || isSubmitting) return;

    if (!recipientQuery.trim()) {
      showToast('Please enter recipient User ID or mobile number.', 'error');
      return;
    }

    if (!verifiedRecipient) {
      await handleVerifyRecipient();
      return;
    }

    if (!isP2PEnabled) {
      showToast(platformSettings?.p2pNotice || 'P2P transfers are currently paused by Administrator.', 'error');
      return;
    }

    if (numAmount < minP2PAmount) {
      showToast(`Minimum P2P transfer amount is $${minP2PAmount.toFixed(2)}.`, 'error');
      return;
    }
    if (numAmount > maxP2PAmount) {
      showToast(`Maximum single P2P transfer limit is $${maxP2PAmount.toFixed(2)}.`, 'error');
      return;
    }
    if (numAmount > availableBal) {
      showToast('Transfer amount exceeds selected payment wallet balance.', 'error');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await transferP2PFunds({
        recipientQuery: verifiedRecipient.id,
        amount: Number(numAmount.toFixed(2)),
        sourceWallet,
        targetWallet: 'rechargeBalance', // Always credits receiver's Charged Balance
        note: note.trim(),
      });

      if (res.success && res.recipientPreview) {
        setReceipt({
          referenceNo: res.referenceNo || res.transaction?.referenceNo || `P2P-${Date.now()}`,
          amount: Number(numAmount.toFixed(2)),
          recipient: res.recipientPreview,
          sourceWallet,
          tx: res.transaction,
        });
      }
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1200);
    }
  };

  const handleResetForNewTransfer = () => {
    setReceipt(null);
    setRecipientQuery('');
    setVerifiedRecipient(null);
    setLookupError(null);
    setAmount('10');
    setNote('');
  };

  const containerClasses =
    theme === 'obsidian-gold'
      ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
      : theme === 'cyber-hydrogen'
      ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
      : 'bg-white border border-slate-200 text-slate-900';

  const subtleSurface = isDarkTheme
    ? 'bg-slate-800/70 border-slate-700/80 text-slate-100'
    : 'bg-slate-50 border-slate-200/90 text-slate-800';

  const inputClasses = isDarkTheme
    ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400'
    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-600';

  const heroWalletGradient =
    theme === 'obsidian-gold'
      ? 'from-slate-900 via-amber-950/70 to-slate-900 border-amber-500/30'
      : theme === 'cyber-hydrogen'
      ? 'from-slate-900 via-cyan-950/70 to-slate-900 border-cyan-500/30'
      : 'from-teal-900 via-teal-800 to-emerald-900 border-teal-700/50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className={`w-full max-w-md rounded-3xl p-4 sm:p-6 relative overflow-hidden transition-all shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain ${containerClasses}`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold tracking-tight truncate">P2P Wallet Transfer</h3>
              <p className="text-[11px] text-slate-400 truncate">
                0% Fee · Instant Charged Balance Credit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close P2P Transfer"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Dual-Balance Summary */}
        <div className={`mt-4 p-4 rounded-2xl bg-gradient-to-br border text-white shadow-lg ${heroWalletGradient}`}>
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/15">
            <span className="text-[11px] font-medium text-white/75">Total Balance</span>
            <span className="text-base font-black tabular-nums text-white">${totalBal.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="pr-2 border-r border-white/15">
              <div className="flex items-center gap-1.5 text-[11px] text-white/75 font-medium">
                <Coins className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">Charged Balance</span>
              </div>
              <div className="text-xl font-black mt-1 tabular-nums text-white">
                ${chargedBal.toFixed(2)}
              </div>
              <div className="text-[10px] text-white/65 tabular-nums mt-0.5">
                ₹{Math.round(chargedBal * USD_TO_INR).toLocaleString()} INR
              </div>
            </div>

            <div className="pl-1">
              <div className="flex items-center gap-1.5 text-[11px] text-white/75 font-medium">
                <Wallet className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="truncate">Withdrawal Balance</span>
              </div>
              <div className="text-xl font-black mt-1 tabular-nums text-emerald-300">
                ${withdrawalBal.toFixed(2)}
              </div>
              <div className="text-[10px] text-white/65 tabular-nums mt-0.5">
                ₹{Math.round(withdrawalBal * USD_TO_INR).toLocaleString()} INR
              </div>
            </div>
          </div>
        </div>

        {/* Send / Receive Segmented Switcher */}
        <div
          className={`mt-3.5 p-1 rounded-2xl border grid grid-cols-2 gap-1 ${
            isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setActiveMode('send');
              setReceipt(null);
            }}
            className={`min-h-[44px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeMode === 'send'
                ? 'bg-teal-600 text-white shadow-sm'
                : isDarkTheme
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 shrink-0" />
            <span>Send Money</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('receive')}
            className={`min-h-[44px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeMode === 'receive'
                ? 'bg-emerald-600 text-white shadow-sm'
                : isDarkTheme
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 shrink-0" />
            <span>Receive Money</span>
          </button>
        </div>

        {/* MODE 1: SEND MONEY */}
        {activeMode === 'send' && (
          <>
            {receipt ? (
              <div className="mt-4 space-y-4 animate-in fade-in">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-center shadow-lg">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-2.5">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-xs font-bold text-emerald-100">
                    Payment Sent Successfully
                  </div>
                  <div className="text-3xl font-black mt-1 tabular-nums">
                    ${receipt.amount.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-emerald-100 mt-1">
                    Credited instantly to {receipt.recipient.nickname}'s Charged Balance
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${subtleSurface}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Reference No</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold">
                      <span>{receipt.referenceNo}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyValue(receipt.referenceNo, 'Reference')}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-teal-600 dark:text-teal-400 cursor-pointer"
                        aria-label="Copy Reference Number"
                      >
                        {copiedField === 'Reference' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Paid From</span>
                    <span className="font-bold">
                      {receipt.sourceWallet === 'rechargeBalance' ? 'Charged Balance' : 'Withdrawal Balance'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Recipient</span>
                    <span className="font-bold">
                      {receipt.recipient.nickname} · ID {receipt.recipient.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Credited Wallet</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Receiver Charged Balance
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Transfer Fee</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">$0.00 (Free)</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400">New Total Balance</span>
                    <span className="font-black tabular-nums">${totalBal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleResetForNewTransfer}
                    className={`min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                      isDarkTheme
                        ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100'
                        : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    Send Another
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">

                {!isP2PEnabled && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {platformSettings?.p2pNotice || 'P2P wallet transfers are currently paused by Administrator.'}
                    </span>
                  </div>
                )}

                {/* Quick Repeat Recipients */}
                {quickRecipients.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-teal-500" />
                      <span>Quick Repeat</span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {quickRecipients.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleVerifyRecipient(item.id)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-left transition-all shrink-0 cursor-pointer ${
                            verifiedRecipient?.id === item.id
                              ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300'
                              : subtleSurface
                          }`}
                        >
                          <div className="text-[11px] font-bold truncate max-w-[110px]">
                            {item.name}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400">
                            ID {item.id}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1. Recipient Lookup */}
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    1. Recipient Details (User ID / Mobile / Invite Code)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={recipientQuery}
                      onChange={(e) => handleRecipientInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleVerifyRecipient();
                        }
                      }}
                      placeholder="Enter User ID, Mobile or Code"
                      className={`flex-1 min-h-[44px] text-xs px-3.5 rounded-xl border outline-none transition-colors font-mono ${inputClasses}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyRecipient()}
                      disabled={isLookingUp || recipientQuery.trim().length < 3}
                      className="min-h-[44px] px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      {isLookingUp ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Verify</span>
                        </>
                      )}
                    </button>
                  </div>

                  {lookupError && (
                    <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{lookupError}</span>
                    </div>
                  )}

                  {verifiedRecipient && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 truncate">
                            {verifiedRecipient.nickname}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            ID {verifiedRecipient.id} · {verifiedRecipient.phoneMasked} · VIP {verifiedRecipient.vipLevel}
                          </div>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    </div>
                  )}
                </div>

                {/* 2. Choose Payment Method (Charged Balance or Withdrawal Balance) */}
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    2. Select Payment Method (Pay From)
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSourceWallet('rechargeBalance')}
                      className={`min-h-[76px] p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        sourceWallet === 'rechargeBalance'
                          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                          : subtleSurface
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold flex items-center gap-1.5 truncate">
                          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">Charged Balance</span>
                        </span>
                      </div>
                      <div className="text-base font-black mt-1 tabular-nums">
                        ${chargedBal.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        Add Money Wallet
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSourceWallet('withdrawalBalance')}
                      className={`min-h-[76px] p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        sourceWallet === 'withdrawalBalance'
                          ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                          : subtleSurface
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold flex items-center gap-1.5 truncate">
                          <Wallet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">Withdrawal</span>
                        </span>
                      </div>
                      <div className="text-base font-black mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">
                        ${withdrawalBal.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        Withdrawable Wallet
                      </div>
                    </button>
                  </div>
                </div>

                {/* Live Route Strip */}
                <div className={`px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-[11px] ${subtleSurface}`}>
                  <span className="font-bold truncate">
                    {sourceWallet === 'rechargeBalance' ? 'Your Charged' : 'Your Withdrawal'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                    Receiver's Charged Balance
                  </span>
                </div>

                {/* 3. Amount & Note */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span>3. Enter Amount (USD)</span>
                    <button
                      type="button"
                      onClick={() => setAmount(availableBal.toFixed(2))}
                      className="text-teal-600 dark:text-teal-400 hover:underline text-[11px] font-bold whitespace-nowrap cursor-pointer"
                    >
                      Use Max (${availableBal.toFixed(2)})
                    </button>
                  </div>

                  <div
                    className={`flex items-center justify-between rounded-xl border px-3.5 min-h-[50px] transition-colors ${inputClasses}`}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="text-lg font-black text-teal-600 dark:text-teal-400 mr-2">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={minP2PAmount}
                        max={availableBal > 0 ? Math.min(availableBal, maxP2PAmount) : maxP2PAmount}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-lg font-black bg-transparent outline-none tabular-nums"
                        required
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums shrink-0 ml-2">
                      ₹{Math.round(Math.max(0, numAmount) * USD_TO_INR).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {QUICK_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border transition-colors tabular-nums whitespace-nowrap cursor-pointer ${
                          numAmount === preset
                            ? 'bg-teal-600 text-white border-teal-600'
                            : subtleSurface
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Transfer Note (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Plan activation / Settlement"
                    className={`w-full min-h-[42px] text-xs px-3.5 rounded-xl border outline-none transition-colors ${inputClasses}`}
                  />
                </div>

                {/* Summary Box */}
                <div className={`p-3 rounded-2xl border text-[11px] space-y-1.5 ${subtleSurface}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Payment Method</span>
                    <span className="font-bold">
                      {sourceWallet === 'rechargeBalance' ? 'Charged Balance' : 'Withdrawal Balance'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Receiver Wallet Credit</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Charged Balance (Instant)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">P2P Service Fee</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">$0.00 (Free)</span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-700/60 text-[10px] text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span>Receiver gets funds directly in Charged Balance for instant use.</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isP2PEnabled || isSubmitting || isLookingUp || (Boolean(verifiedRecipient) && !isAmountValid)}
                  className="w-full min-h-[48px] py-3 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-500 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] transition-all whitespace-nowrap cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : !verifiedRecipient ? (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Verify Recipient First</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span className="tabular-nums truncate">
                        Send ${numAmount > 0 ? numAmount.toFixed(2) : '0.00'} to {verifiedRecipient.nickname}
                      </span>
                    </>
                  )}
                </button>
              </form>
            )}
          </>
        )}

        {/* MODE 2: RECEIVE MONEY */}
        {activeMode === 'receive' && (
          <div className="mt-4 space-y-4 animate-in fade-in">
            <div className={`p-4 rounded-2xl border space-y-3 ${subtleSurface}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold">My P2P Receive Details</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Share any ID below to receive funds in your Charged Balance
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleShareReceiveDetails}
                  className="min-h-[40px] px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { label: 'User ID', value: user?.id || '' },
                  { label: 'Mobile Number', value: user?.phone || '' },
                  { label: 'Invite Code', value: user?.invitationCode || '' },
                ]
                  .filter((row) => Boolean(row.value))
                  .map((row) => (
                    <div
                      key={row.label}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        isDarkTheme ? 'bg-slate-900 border-slate-700/70' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-400">{row.label}</div>
                        <div className="text-sm font-black font-mono truncate">{row.value}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyValue(row.value, row.label)}
                        className="min-h-[40px] px-3 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copiedField === row.label ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
              </div>

              <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  All incoming P2P payments from Charged or Withdrawal wallets are credited directly to your Charged Balance.
                </span>
              </div>
            </div>

            {/* P2P Received vs Sent Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className={`p-3 rounded-2xl border ${subtleSurface}`}>
                <div className="text-[11px] text-slate-400">Total Received</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  +${totalReceivedUsd.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {receivedP2PTxs.length} incoming transfers
                </div>
              </div>
              <div className={`p-3 rounded-2xl border ${subtleSurface}`}>
                <div className="text-[11px] text-slate-400">Total Sent</div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
                  -${totalSentUsd.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {sentP2PTxs.length} outgoing transfers
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveMode('send')}
              className="w-full min-h-[44px] py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Switch to Send Money</span>
            </button>
          </div>
        )}

        {/* P2P Transfer Ledger with All / Sent / Received Filter */}
        <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h4 className="text-xs font-extrabold">P2P Activity</h4>
            <div
              className={`flex items-center gap-1 p-0.5 rounded-xl border text-[11px] ${
                isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              {[
                { key: 'all', label: 'All' },
                { key: 'sent', label: 'Sent' },
                { key: 'received', label: 'Received' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActivityFilter(tab.key as any)}
                  className={`min-h-[32px] px-2.5 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    activityFilter === tab.key
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredActivityTxs.length === 0 ? (
            <div className={`p-4 rounded-2xl border text-center text-xs text-slate-400 ${subtleSurface}`}>
              No {activityFilter === 'all' ? 'P2P' : activityFilter} transactions yet.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActivityTxs.map((tx) => {
                const isSent = tx.type === 'p2p_send';
                return (
                  <div
                    key={tx.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 text-xs ${subtleSurface}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSent
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isSent ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate">{tx.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {tx.paymentMethod || (isSent ? 'Sent P2P' : 'Received in Charged Balance')} · {tx.timestamp}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div
                        className={`font-black ${
                          isSent
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isSent ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                      </div>
                      {tx.balanceAfter !== undefined && tx.balanceAfter !== null && (
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Bal: ${Number(tx.balanceAfter).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
