import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Lock,
  Layers,
  Smartphone,
  CreditCard,
  Building2,
  Wallet,
  QrCode,
  Copy,
  Check,
  Zap,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerOfficialRazorpayPayment } from '../services/razorpayService';

export const RechargeModal: React.FC = () => {
  const {
    user,
    recharge,
    submitManualRecharge,
    closeModal,
    showToast,
    theme,
    platformSettings,
    showPaymentFailedModal,
  } = useApp();

  const minDeposit =
    platformSettings?.minRecharge && platformSettings.minRecharge >= 25
      ? platformSettings.minRecharge
      : 25;
  const isRechargeAllowed = platformSettings?.isRechargeEnabled !== false;
  const isRazorpayAllowed = platformSettings?.isRazorpayEnabled !== false;
  const isManualUpiAllowed = platformSettings?.isManualUpiEnabled !== false;

  // Active Gateway Tab: 'manual_upi' or 'razorpay'
  const [activeGateway, setActiveGateway] = useState<'manual_upi' | 'razorpay'>(
    isManualUpiAllowed ? 'manual_upi' : 'razorpay'
  );

  const PRESETS = [25, 50, 100, 200, 500, 1000];
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>('');

  // Razorpay method selector
  const [selectedMethod, setSelectedMethod] = useState<'all' | 'upi' | 'card' | 'netbanking' | 'wallet'>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  // Manual UPI State
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [submittedSuccessTx, setSubmittedSuccessTx] = useState<{
    utr: string;
    usd: number;
    inr: number;
    time: string;
  } | null>(null);

  // Active USD amount entered by the user
  const activeAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
  // 1 USD converts to 100 INR in payment mode
  const paymentInrAmount = Math.round(activeAmount * 100);

  // Admin Configured UPI ID & Name
  const adminUpiId = (platformSettings?.merchantUpiId || 'nexaai.pay@icici').trim();
  const adminPayeeName = (platformSettings?.merchantPayeeName || 'Nexa AI Technologies').trim();

  // Dynamic NPCI UPI Link string
  const upiNote = `Add Money ${user?.phone || user?.nickname || 'Member'}`;
  const dynamicUpiString = `upi://pay?pa=${encodeURIComponent(adminUpiId)}&pn=${encodeURIComponent(
    adminPayeeName
  )}&am=${paymentInrAmount}&cu=INR&tn=${encodeURIComponent(upiNote)}`;

  // Dynamic QR Code Image URL
  const dynamicQrCodeUrl =
    platformSettings?.merchantQrUrl && platformSettings.merchantQrUrl.trim() !== ''
      ? platformSettings.merchantQrUrl.trim()
      : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          dynamicUpiString
        )}&margin=10`;

  // Copy UPI ID
  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(adminUpiId);
    setCopiedUpi(true);
    showToast(`Copied UPI ID: ${adminUpiId}`, 'success');
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Copy Exact INR Amount
  const handleCopyAmount = () => {
    navigator.clipboard?.writeText(paymentInrAmount.toString());
    setCopiedAmount(true);
    showToast(`Copied Amount: ₹${paymentInrAmount}`, 'success');
    setTimeout(() => setCopiedAmount(false), 2500);
  };

  // Submit Manual UPI Deposit
  const handleSubmitManualUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRechargeAllowed) {
      showToast('Add Money is currently paused by platform administrator.', 'error');
      return;
    }
    if (activeAmount < minDeposit) {
      showToast(`Minimum deposit is $${minDeposit.toFixed(2)} (₹${(minDeposit * 100).toLocaleString()})`, 'error');
      return;
    }
    const cleanUtr = utrNumber.replace(/\D/g, '').trim();
    if (!cleanUtr || cleanUtr.length < 10) {
      showToast('Please enter a valid 12-digit UPI UTR / Reference number from your payment app.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await submitManualRecharge(activeAmount, cleanUtr);
      if (res.success) {
        setSubmittedSuccessTx({
          utr: cleanUtr,
          usd: activeAmount,
          inr: paymentInrAmount,
          time: new Date().toLocaleTimeString(),
        });
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to submit payment proof.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Trigger Official Razorpay Payment Gateway directly
  const handleRazorpayPayment = async () => {
    if (!isRechargeAllowed) {
      showToast('Add Money is currently paused by platform administrator.', 'error');
      return;
    }
    if (!isRazorpayAllowed) {
      showToast('Razorpay payment gateway is currently disabled by administrator.', 'error');
      return;
    }
    if (activeAmount < minDeposit) {
      showToast(`Minimum deposit is $${minDeposit.toFixed(2)}`, 'error');
      return;
    }
    setIsProcessing(true);

    try {
      const keyId =
        platformSettings?.razorpayKeyId && platformSettings.razorpayKeyId !== 'rzp_live_TsxVeW7tusSgjp'
          ? platformSettings.razorpayKeyId
          : undefined;
      const keySecret =
        platformSettings?.razorpayKeySecret && platformSettings.razorpayKeySecret !== 'SvNqYN6H09fU4mNSGqJeTG0V'
          ? platformSettings.razorpayKeySecret
          : undefined;
      const merchantName = platformSettings?.razorpayMerchantName?.trim() || 'Nexa AI';
      const merchantLogo = platformSettings?.razorpayLogoUrl?.trim() || '/logo.png';

      const result = await triggerOfficialRazorpayPayment({
        keyId,
        keySecret,
        amount: paymentInrAmount,
        usdAmount: activeAmount,
        merchantName,
        merchantLogo,
        themeColor: platformSettings?.razorpayThemeColor || '#0f766e',
        userName: user?.nickname || 'Investor',
        userPhone: user?.phone || '9999999999',
        userId: user?.id || '833863',
        preferredMethod: selectedMethod,
        onSuccess: async (paymentId: string) => {
          showToast(`Razorpay payment verified! $${activeAmount.toFixed(2)} added to your wallet (Ref: ${paymentId})`, 'success');
          await recharge(activeAmount, 'Razorpay Instant', paymentId);
          setIsProcessing(false);
          closeModal();
        },
        onFailure: (reason: string) => {
          setIsProcessing(false);
          showPaymentFailedModal({
            reason: reason || 'Transaction declined by bank or user.',
            amountUsd: activeAmount,
            amountInr: paymentInrAmount,
            onRetry: () => {
              handleRazorpayPayment();
            },
          });
        },
        onDismiss: () => {
          setIsProcessing(false);
          showPaymentFailedModal({
            reason: 'Payment window was closed before completion.',
            amountUsd: activeAmount,
            amountInr: paymentInrAmount,
            onRetry: () => {
              handleRazorpayPayment();
            },
          });
        },
      });

      if (!result.success && result.message) {
        setIsProcessing(false);
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      console.error('Razorpay trigger exception:', err);
      setIsProcessing(false);
      showToast(`Error opening Razorpay: ${err.message}`, 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 relative max-h-[92vh] overflow-y-auto overscroll-contain transition-all shadow-2xl ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Money</h3>
              <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Live Fast Gateway
              </span>
            </div>
            <p className="text-xs text-slate-400">Instant Wallet Recharge • 1 USD = 100 INR</p>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paused Banner if Disabled by Admin */}
        {!isRechargeAllowed && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Add Money Temporarily Paused</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {platformSettings?.rechargeNotice ||
                  'Deposit gateway is currently undergoing scheduled maintenance. Please check back shortly.'}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBMITTED SUCCESS VIEW */}
        {/* ============================================================== */}
        {submittedSuccessTx ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border-2 border-emerald-500/40 animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Payment Proof Submitted!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Admin is verifying your 12-digit UTR. Balance will be approved & credited to your wallet in 1-5 minutes.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left text-xs font-mono space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Deposit Amount:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  ${submittedSuccessTx.usd.toFixed(2)} (₹{submittedSuccessTx.inr.toLocaleString()} INR)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Submitted UTR:</span>
                <span className="font-bold text-slate-900 dark:text-white">{submittedSuccessTx.utr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Verification Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold border border-amber-500/30">
                  ● Under Admin Review
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Time:</span>
                <span className="text-slate-500">{submittedSuccessTx.time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSubmittedSuccessTx(null);
                  setUtrNumber('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Submit Another Deposit
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-md shadow-teal-600/30 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 space-y-4">
            {/* Gateway Tabs Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveGateway('manual_upi')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeGateway === 'manual_upi'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>UPI Dynamic QR</span>
                <span className="text-[9px] bg-emerald-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black">
                  FAST
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGateway('razorpay')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeGateway === 'razorpay'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Online Gateway</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Select Amount ($ USD)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESETS.map((amt) => {
                  const isSelected = !customAmount && selectedAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
                        isSelected
                          ? activeGateway === 'manual_upi'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500'
                            : 'bg-teal-700 text-white shadow-md shadow-teal-700/20 ring-2 ring-teal-500'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 hover:border-emerald-500'
                      }`}
                    >
                      ${amt.toLocaleString()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount input */}
            <div>
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                <span className="text-sm font-bold text-slate-400 mr-2">$</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`Or enter custom amount (Min $${minDeposit})`}
                  className="w-full text-xs font-semibold outline-none bg-transparent text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Conversion Display Banner */}
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 shadow-sm">
              <div className="flex items-center justify-between font-bold mb-1">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  NPCI Exchange Rate Conversion
                </span>
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-extrabold shadow-xs">
                  $1.00 USD = ₹100 INR
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Wallet Credits</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    ${activeAmount.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Exact Payable INR</span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                    ₹{paymentInrAmount.toLocaleString()} INR
                  </span>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* GATEWAY 1: MANUAL DYNAMIC UPI QR GATEWAY */}
            {/* ============================================================== */}
            {activeGateway === 'manual_upi' && (
              <div className="space-y-4">
                {/* Dynamic QR Code Card */}
                <div className="p-4 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 text-white shadow-xl flex flex-col items-center relative overflow-hidden">
                  <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px]">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Dynamic NPCI QR Generated
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      Payee: <strong className="text-slate-200">{adminPayeeName}</strong>
                    </span>
                  </div>

                  {/* QR Image Frame */}
                  <div className="relative p-3 bg-white rounded-2xl shadow-2xl border-4 border-emerald-500/50 my-1 group">
                    <img
                      src={dynamicQrCodeUrl}
                      alt="Dynamic UPI QR Code"
                      className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-lg transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 rounded-xl pointer-events-none border border-emerald-400/30 animate-pulse" />
                  </div>

                  {/* Highlighted Amount */}
                  <div className="mt-2 text-center">
                    <div className="text-[11px] text-slate-400">Exact Amount to Pay</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight flex items-center justify-center gap-1.5">
                      <span>₹{paymentInrAmount.toLocaleString()} INR</span>
                      <button
                        type="button"
                        onClick={handleCopyAmount}
                        title="Copy INR Amount"
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
                      >
                        {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Clean helper badge for QR scan */}
                  <div className="mt-3 px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium flex items-center gap-2 shadow-xs">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Open PhonePe, GPay, or Paytm & Scan this QR Code</span>
                  </div>

                  {/* Optional: UPI ID Display & App Intent Buttons (Hidden by default as requested in screenshot) */}
                  {platformSettings?.showUpiVpaDetails && (
                    <>
                      {/* UPI ID Display with 1-Click Copy */}
                      <div className="w-full mt-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[9px] text-slate-400 block uppercase font-mono tracking-wider">
                            Merchant UPI ID (VPA)
                          </span>
                          <span className="text-xs sm:text-sm font-mono font-bold text-emerald-300 truncate block">
                            {adminUpiId}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer active:scale-95"
                        >
                          {copiedUpi ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy UPI</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* 1-Click Direct Mobile UPI Intent Buttons */}
                      <div className="w-full mt-3 pt-2.5 border-t border-slate-800/90">
                        <div className="text-[10px] text-slate-400 text-center mb-1.5">
                          Or Open Directly in UPI App (Mobile Only):
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <a
                            href={dynamicUpiString}
                            className="py-1.5 px-1 rounded-lg bg-slate-800 hover:bg-purple-900/60 border border-purple-500/30 text-[10px] font-bold text-purple-300 text-center truncate block transition-colors"
                          >
                            PhonePe
                          </a>
                          <a
                            href={dynamicUpiString}
                            className="py-1.5 px-1 rounded-lg bg-slate-800 hover:bg-blue-900/60 border border-blue-500/30 text-[10px] font-bold text-blue-300 text-center truncate block transition-colors"
                          >
                            GPay
                          </a>
                          <a
                            href={dynamicUpiString}
                            className="py-1.5 px-1 rounded-lg bg-slate-800 hover:bg-sky-900/60 border border-sky-500/30 text-[10px] font-bold text-sky-300 text-center truncate block transition-colors"
                          >
                            Paytm
                          </a>
                          <a
                            href={dynamicUpiString}
                            className="py-1.5 px-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 text-center truncate block transition-colors"
                          >
                            Any UPI
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Step 2: Form to Submit 12-Digit UTR */}
                <form
                  onSubmit={handleSubmitManualUpi}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                        2
                      </span>
                      <span>Enter 12-Digit UPI UTR / Reference No.</span>
                    </label>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        utrNumber.trim().length === 12
                          ? 'text-emerald-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {utrNumber.trim().length} / 12 Digits
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      maxLength={16}
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value.replace(/\s+/g, ''))}
                      placeholder="e.g. 430987123456 (Found in UPI receipt)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-mono font-bold text-slate-900 dark:text-emerald-400 tracking-wider focus:outline-none focus:border-emerald-500"
                    />
                    {utrNumber.trim().length === 12 && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    💡 Payment करने के बाद आपके PhonePe / GPay में 12 अंकों का <strong>UTR / UPI Ref ID</strong> मिलता है, उसे यहाँ डालकर सबमिट करें। एडमिन वेरिफाई करके तुरंत वॉलेट में क्रेडिट कर देगा।
                  </p>

                  <button
                    type="submit"
                    disabled={isProcessing || !isRechargeAllowed || activeAmount < minDeposit}
                    className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Deposit Proof...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>Submit Payment Proof (पेमेंट सबमिट करें)</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ============================================================== */}
            {/* GATEWAY 2: RAZORPAY ONLINE GATEWAY */}
            {/* ============================================================== */}
            {activeGateway === 'razorpay' && (
              <div className="space-y-4">
                {/* Payment Method Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Payment Option (भुगतान का विकल्प चुनें)
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      All Options Unlocked
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('all')}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 col-span-2 cursor-pointer ${
                        selectedMethod === 'all'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Show All Options (सभी विकल्प देखें)
                          </span>
                          {selectedMethod === 'all' && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          UPI, Google Pay, PhonePe, Paytm, Cards & NetBanking direct screen par
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('upi')}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        selectedMethod === 'upi'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
                        <Smartphone className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 block truncate">
                          UPI Apps
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate">
                          PhonePe, GPay, Paytm
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('card')}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        selectedMethod === 'card'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 block truncate">
                          Cards
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate">
                          Debit / Credit Cards
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('netbanking')}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        selectedMethod === 'netbanking'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 block truncate">
                          Net Banking
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate">
                          All Indian Banks
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('wallet')}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        selectedMethod === 'wallet'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-amber-600 text-white shrink-0">
                        <Wallet className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 block truncate">
                          Wallets
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate">
                          Paytm, Mobikwik
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Razorpay Action CTA Button */}
                <button
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={isProcessing || !isRechargeAllowed || !isRazorpayAllowed || activeAmount < minDeposit}
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 hover:from-blue-700 hover:via-indigo-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Opening Razorpay Checkout...</span>
                    </>
                  ) : !isRechargeAllowed ? (
                    <span>Add Money Paused by Admin</span>
                  ) : !isRazorpayAllowed ? (
                    <span>Gateway Unavailable</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Pay ₹{paymentInrAmount.toLocaleString()} INR via Razorpay (Add ${activeAmount.toFixed(2)})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Trust & Compliance info */}
            <div className="pt-2 flex items-center justify-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-500" />
                NPCI & PCI-DSS
              </span>
              <span>•</span>
              <span>100% Verified Gateway</span>
              <span>•</span>
              <span>Fast Admin Verification</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
