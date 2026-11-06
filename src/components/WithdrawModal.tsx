import React, { useState } from 'react';
import { X, Building2, AlertCircle, ArrowDownToLine, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

const POPULAR_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Axis Bank',
  'Canara Bank',
  'Kotak Mahindra Bank',
];

export const WithdrawModal: React.FC = () => {
  const { user, withdraw, closeModal, showToast, theme, platformSettings } = useApp();
  const [amount, setAmount] = useState<string>('5.00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);

  // Form states with fallback to existing user.bankDetails
  const [accountHolder, setAccountHolder] = useState(user?.bankDetails?.accountHolder || user?.nickname || '');
  const [accountNumber, setAccountNumber] = useState(user?.bankDetails?.accountNumber || '');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(user?.bankDetails?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(user?.bankDetails?.ifscCode || '');
  const [bankName, setBankName] = useState(user?.bankDetails?.bankName || 'State Bank of India');

  // Admin-controlled fee percentage (defaults to 5% if not configured by admin)
  const feePercent =
    platformSettings?.withdrawalFeePercent !== undefined
      ? platformSettings.withdrawalFeePercent
      : 5;

  const numAmount = parseFloat(amount) || 0;
  const feeAmount = Number(((numAmount * feePercent) / 100).toFixed(2));
  const netArrival = Number((numAmount - feeAmount).toFixed(2));

  const minWithdraw = platformSettings?.minWithdrawal || 2;
  const isWithdrawAllowed = platformSettings?.isWithdrawalEnabled !== false;

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (isSubmittingRef.current || isSubmitting) {
      console.warn('Withdrawal submission already active. Ignoring double trigger.');
      return;
    }
    isSubmittingRef.current = true;

    if (!isWithdrawAllowed) {
      showToast('Withdrawals are currently paused by administrator.', 'error');
      isSubmittingRef.current = false;
      return;
    }

    if (numAmount < minWithdraw) {
      showToast(`Minimum withdrawal amount is $${minWithdraw.toFixed(2)}`, 'error');
      isSubmittingRef.current = false;
      return;
    }
    if (numAmount > user.withdrawalBalance) {
      showToast('Requested amount exceeds current Withdrawal Balance', 'error');
      isSubmittingRef.current = false;
      return;
    }

    const cleanHolder = accountHolder.trim();
    const cleanAccount = accountNumber.trim().replace(/\s+/g, '');
    const cleanConfirm = confirmAccountNumber.trim().replace(/\s+/g, '');
    const cleanIfsc = ifscCode.trim().toUpperCase();
    const cleanBank = bankName.trim();

    if (!cleanHolder) {
      showToast('Please enter Account Holder Name (खाता धारक का नाम)', 'error');
      isSubmittingRef.current = false;
      return;
    }
    if (!cleanAccount || cleanAccount.length < 8) {
      showToast('Please enter a valid Bank Account Number (कम से कम 8-18 अंक)', 'error');
      isSubmittingRef.current = false;
      return;
    }
    if (cleanAccount !== cleanConfirm) {
      showToast('Account Number & Confirm Account Number do not match!', 'error');
      isSubmittingRef.current = false;
      return;
    }
    if (!cleanIfsc || cleanIfsc.length !== 11) {
      showToast('Please enter a valid 11-character IFSC Code (e.g. SBIN0001234)', 'error');
      isSubmittingRef.current = false;
      return;
    }

    setIsSubmitting(true);
    try {
      await withdraw(numAmount, {
        accountHolder: cleanHolder,
        accountNumber: cleanAccount,
        ifscCode: cleanIfsc,
        bankName: cleanBank || 'Bank Account',
        upiId: '',
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className={`w-full max-w-md rounded-3xl p-6 relative overflow-hidden transition-all shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-slate-900 border border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bank Account Withdrawal</h3>
              <p className="text-xs text-slate-400">Fast 24/7 IMPS / NEFT Direct Settlement</p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paused Banner if Disabled by Admin */}
        {!isWithdrawAllowed && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Withdrawals Temporarily Paused</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {platformSettings?.withdrawalNotice ||
                  'Withdrawal service is currently undergoing scheduled audit. Please check back shortly.'}
              </div>
            </div>
          </div>
        )}

        {/* Balance Overview Card */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-teal-900 via-emerald-800 to-teal-800 text-white shadow-lg border border-teal-500/30">
          <div className="flex justify-between items-center text-xs opacity-90">
            <span className="font-medium">Withdrawal Balance Available</span>
            <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full text-[10px] text-emerald-200">
              VIP {user?.vipLevel || 0} Member
            </span>
          </div>
          <div className="text-2xl font-black mt-1 font-mono tracking-tight text-white">
            ${(user?.withdrawalBalance || 0).toFixed(2)}
          </div>
          <div className="flex justify-between items-center text-[11px] text-teal-100 mt-2 pt-2 border-t border-white/15">
            <span>Minimum: <strong>${minWithdraw.toFixed(2)}</strong></span>
            <span>Fee: <strong>{feePercent}%</strong> {feePercent === 0 ? '(Free)' : ''}</span>
          </div>
        </div>

        <form onSubmit={handleWithdrawSubmit} className="mt-4 space-y-4">
          {/* Amount input */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1.5">
              <span>Withdrawal Amount ($)</span>
              <button
                type="button"
                onClick={() => setAmount((user?.withdrawalBalance || 0).toString())}
                className="text-teal-400 hover:text-teal-300 font-bold hover:underline text-[11px]"
              >
                Withdraw All (${(user?.withdrawalBalance || 0).toFixed(2)})
              </button>
            </div>
            <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 transition-all">
              <span className="text-base font-bold text-teal-400 mr-2">$</span>
              <input
                type="number"
                step="0.01"
                min={minWithdraw}
                max={user?.withdrawalBalance || 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Enter amount (min $${minWithdraw})`}
                className="w-full text-base font-bold outline-none bg-transparent text-white font-mono"
                required
              />
            </div>
          </div>

          {/* Bank Destination Header */}
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Bank Account Details (खाता विवरण)</span>
              </span>
              <span className="text-[10px] text-teal-400 font-medium">IMPS / NEFT</span>
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Account Holder Full Name (खाता धारक का नाम)
              </label>
              <input
                type="text"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Full name as printed in bank passbook"
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white outline-none focus:border-teal-500 transition-colors"
                required
              />
            </div>

            {/* Bank Account Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Bank Account Number (खाता संख्या)
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter 9 to 18 digit bank account number"
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white font-mono outline-none focus:border-teal-500 transition-colors"
                required
              />
            </div>

            {/* Confirm Account Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Confirm Bank Account Number (खाता संख्या दोबारा दर्ज करें)
              </label>
              <input
                type="text"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="Re-enter bank account number"
                className={`w-full text-xs px-3 py-2.5 rounded-xl border bg-slate-900 text-white font-mono outline-none transition-colors ${
                  confirmAccountNumber && confirmAccountNumber !== accountNumber
                    ? 'border-rose-500 text-rose-300'
                    : 'border-slate-700 focus:border-teal-500'
                }`}
                required
              />
              {confirmAccountNumber && confirmAccountNumber !== accountNumber && (
                <p className="text-[10px] text-rose-400 mt-1 font-medium">Account numbers do not match</p>
              )}
            </div>

            {/* IFSC Code */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Bank IFSC Code (11 Letters)
              </label>
              <input
                type="text"
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234 or HDFC0000001"
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-teal-300 font-mono font-bold uppercase outline-none focus:border-teal-500 transition-colors"
                required
              />
            </div>

            {/* Bank Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Bank Name (बैंक का नाम)
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India, HDFC Bank"
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white outline-none focus:border-teal-500 transition-colors"
                required
              />
              {/* Quick Bank Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {POPULAR_BANKS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBankName(b)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors border ${
                      bankName === b
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Breakdown summary */}
          <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Withdrawal Amount</span>
              <span className="font-semibold text-white font-mono">
                ${numAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Withdrawal Fee ({feePercent}%)</span>
              <span className="text-amber-400 font-semibold font-mono">
                - ${feeAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-slate-700 text-sm font-bold">
              <span className="text-white">Actual Amount Credited</span>
              <span className="text-emerald-400 font-mono text-base font-black">
                ${Math.max(0, netArrival).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-teal-400 font-medium">
              <span>Estimated INR to Bank</span>
              <span className="font-mono font-bold">
                ₹{(Math.max(0, netArrival) * 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Safety Notice tip */}
          <div className="flex items-start gap-2 text-[11px] text-slate-400 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <AlertCircle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <span>
              Withdrawals are processed 24/7. Please verify your Account Number and IFSC Code carefully before submitting.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !isWithdrawAllowed}
            className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-500 hover:from-teal-500 hover:to-emerald-500 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-xl shadow-teal-950/50 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : !isWithdrawAllowed ? (
              <span>Withdrawals Currently Paused by Admin</span>
            ) : (
              <>
                <ArrowDownToLine className="w-4 h-4" />
                <span>Confirm Withdrawal of ${numAmount.toFixed(2)}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
