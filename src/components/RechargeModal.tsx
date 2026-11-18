import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Lock,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Smartphone,
  Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatISTDateTime } from '../services/dbService';

export const RechargeModal: React.FC = () => {
  const {
    user,
    submitManualRecharge,
    closeModal,
    showToast,
    theme,
    platformSettings,
  } = useApp();

  const minDeposit =
    typeof platformSettings?.minRecharge === 'number' && !isNaN(platformSettings.minRecharge) && platformSettings.minRecharge > 0
      ? platformSettings.minRecharge
      : 0.01;
  const isRechargeAllowed = platformSettings?.isRechargeEnabled !== false;

  const PRESETS =
    minDeposit < 25
      ? [minDeposit, 1, 5, 10, 20, 25, 50, 100].filter((v, idx, arr) => arr.indexOf(v) === idx && v >= minDeposit)
      : [20, 25, 50, 100, 200, 500, 1000].filter((v) => v >= minDeposit);
  const [selectedAmount, setSelectedAmount] = useState<number>(() => (minDeposit < 25 ? minDeposit : 25));
  const [customAmount, setCustomAmount] = useState<string>('');
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
  // 1 USD converts to 100 INR in payment mode (minimum 1 INR for micro-deposits)
  const paymentInrAmount = Math.max(1, Math.round(activeAmount * 100));
  const isAboveGalleryLimit = paymentInrAmount > 2000;
  const showDirectPayAndVpa = platformSettings?.showUpiVpaDetails !== false || isAboveGalleryLimit;

  // Admin Configured UPI ID & Name
  const adminUpiId = (platformSettings?.merchantUpiId || 'nexaai.pay@icici').replace(/\s+/g, '').trim();
  const adminPayeeName = (platformSettings?.merchantPayeeName || 'Nexa AI Technologies').trim();
  const cleanPayeeName = adminPayeeName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'NexaAI';
  const hasCustomMerchantQr = Boolean(platformSettings?.merchantQrUrl && platformSettings.merchantQrUrl.trim() !== '');

  // Clean NPCI UPI QR Payload (no %40 encoding, clean alphanumeric pn/tn)
  const cleanUserRef = String(user?.id || user?.phone || 'USER').replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'USER';
  const upiNote = `NX${cleanUserRef}`;
  const cleanAmountStr = Number.isInteger(paymentInrAmount) ? String(paymentInrAmount) : paymentInrAmount.toFixed(2);
  const embedAmountInQr = platformSettings?.autoDynamicQrEnabled !== false;
  const baseUpiParams = `pa=${adminUpiId}&pn=${cleanPayeeName}`;
  const dynamicUpiString = embedAmountInQr
    ? `upi://pay?${baseUpiParams}&am=${cleanAmountStr}&cu=INR&tn=${upiNote}`
    : `upi://pay?${baseUpiParams}&cu=INR&tn=${upiNote}`;

  // Official Uploaded Merchant QR (e.g. BharatPe) or Auto-Generated Dynamic QR
  const dynamicQrCodeUrl = hasCustomMerchantQr
    ? platformSettings!.merchantQrUrl!.trim()
    : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        dynamicUpiString
      )}&margin=10`;

  // Copy UPI ID
  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(adminUpiId);
    setCopiedUpi(true);
    showToast(`UPI ID Copied: ${adminUpiId} — Ab PhonePe / Navi / GPay me "To UPI ID" se pay karein!`, 'success');
    setTimeout(() => setCopiedUpi(false), 3000);
  };

  // Copy Exact INR Amount
  const handleCopyAmount = () => {
    navigator.clipboard?.writeText(paymentInrAmount.toString());
    setCopiedAmount(true);
    showToast(`Copied Amount: ₹${paymentInrAmount}`, 'success');
    setTimeout(() => setCopiedAmount(false), 2500);
  };

  // Download QR Image safely
  const handleDownloadQr = async () => {
    try {
      const link = document.createElement('a');
      if (dynamicQrCodeUrl.startsWith('data:')) {
        link.href = dynamicQrCodeUrl;
      } else {
        const res = await fetch(dynamicQrCodeUrl);
        const blob = await res.blob();
        link.href = URL.createObjectURL(blob);
      }
      link.download = `BharatPe-UPI-QR-${paymentInrAmount}INR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('QR Code downloaded! (Note: Phone Gallery upload ₹2,000 tak allowed hai)', 'success');
    } catch {
      showToast('QR save karne ke liye QR par long-press / screenshot lein.', 'info');
    }
  };

  // Submit Manual UPI Deposit
  const handleSubmitManualUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRechargeAllowed) {
      showToast('Add Money is currently paused by platform administrator.', 'error');
      return;
    }
    if (activeAmount < minDeposit) {
      showToast(`Minimum deposit is $${minDeposit < 1 ? minDeposit.toFixed(2) : minDeposit} (₹${Math.max(1, Math.round(minDeposit * 100)).toLocaleString()})`, 'error');
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
          time: formatISTDateTime(Date.now()),
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
            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Select Amount ($ USD)
              </label>
              <div className="grid grid-cols-4 gap-2">
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
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 hover:border-emerald-500'
                      }`}
                    >
                      ${amt < 1 ? amt.toString() : amt.toLocaleString()}
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
                  min={minDeposit}
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`Or enter custom amount (Min $${minDeposit < 1 ? minDeposit.toFixed(2) : minDeposit})`}
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
            {/* DYNAMIC UPI QR GATEWAY + HIGH-AMOUNT (>₹2,000) BYPASS */}
            {/* ============================================================== */}
            <div className="space-y-4">
              {/* Smart Alert when Amount > ₹2,000 explaining NPCI Gallery Cap & Zero-Error Methods */}
              {isAboveGalleryLimit && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs space-y-2">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-extrabold">
                        ₹2,000+ Payment Guide (₹1,00,000 Limit • Zero Error)
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                        NPCI rules ke mutabik PhonePe / Navi / GPay me <strong>QR Screenshot Gallery Upload</strong> se maximum <strong>₹2,000</strong> aur direct browser link par <strong>Security Block</strong> aata hai. <strong>₹{paymentInrAmount.toLocaleString()}</strong> 100% pass karne ke liye:
                      </p>
                      <ul className="text-[11px] space-y-0.5 list-disc pl-4 text-amber-900 dark:text-amber-200">
                        <li>
                          <strong>Same Phone (100% Working up to ₹1,00,000):</strong> Neeche se <strong>Copy UPI ID</strong> karein → PhonePe / Navi / GPay kholkar <strong>"To Bank / UPI ID"</strong> se pay karein.
                        </li>
                        <li>
                          <strong>Camera Scan (₹1,00,000 Limit):</strong> Doosre phone ke live camera se neeche wala QR scan karein.
                        </li>
                      </ul>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAmount(20);
                      setCustomAmount('');
                      showToast('Amount set to $20 (₹2,000) — Ab aap QR screenshot gallery se bhi pay kar sakte hain!', 'success');
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-800 dark:text-amber-200 transition-colors cursor-pointer"
                  >
                    Ya ₹2,000 ($20) Select Karein (Gallery QR Upload ke liye)
                  </button>
                </div>
              )}

              {/* Merchant / Dynamic QR Code Card */}
              <div className="p-4 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 text-white shadow-xl flex flex-col items-center relative overflow-hidden">
                <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px]">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {hasCustomMerchantQr ? 'Official BharatPe / Merchant QR' : 'Dynamic NPCI QR Generated'}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    Payee: <strong className="text-slate-200">{adminPayeeName}</strong>
                  </span>
                </div>

                {/* QR Image Frame */}
                <div className="relative p-3 bg-white rounded-2xl shadow-2xl border-4 border-emerald-500/50 my-1 group">
                  <img
                    src={dynamicQrCodeUrl}
                    alt="Merchant UPI QR Code"
                    className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-lg transition-transform group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 rounded-xl pointer-events-none border border-emerald-400/30 animate-pulse" />
                </div>

                {/* Highlighted Amount + Download QR */}
                <div className="mt-2 text-center space-y-1.5">
                  <div className="text-[11px] text-slate-400">Exact Amount to Pay</div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight flex items-center justify-center gap-1.5">
                    <span>₹{paymentInrAmount.toLocaleString()} INR</span>
                    <button
                      type="button"
                      onClick={handleCopyAmount}
                      title="Copy INR Amount"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                    >
                      {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                    <span>Save QR Image</span>
                  </button>
                </div>

                {/* Clean helper badge for QR scan */}
                <div className="mt-3 px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium flex items-center gap-2 shadow-xs text-center">
                  <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {isAboveGalleryLimit
                      ? 'Camera se Scan karein ya neeche UPI ID Copy karke Pay karein'
                      : 'PhonePe, Navi, GPay ya Paytm se QR Scan karke pay karein'}
                  </span>
                </div>

                {/* 100% Working UPI ID Payment Flow (Zero Security Reason / Zero ₹2k Gallery Error) */}
                {showDirectPayAndVpa && (
                  <div className="w-full mt-3.5 pt-3 border-t border-slate-800/90 space-y-2.5">
                    {/* UPI ID Display with 1-Click Copy */}
                    <div className="w-full p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/50 flex items-center justify-between gap-2 shadow-inner">
                      <div className="min-w-0">
                        <span className="text-[9px] text-emerald-400 block uppercase font-mono tracking-wider font-bold">
                          100% Working • Zero Security Error • ₹1,00,000 Limit
                        </span>
                        <span className="text-xs sm:text-sm font-mono font-bold text-white truncate block mt-0.5">
                          {adminUpiId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer active:scale-95"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy UPI ID</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Step-by-step Same-Phone Payment Guide */}
                    <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-300 space-y-1.5">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Same Phone se Bina Error Pay Kaise Karein (3 Easy Steps):</span>
                      </div>
                      <ol className="list-decimal pl-4 space-y-1 text-[10px] text-slate-300 leading-relaxed">
                        <li>
                          Upar <strong>Copy UPI ID</strong> par tap karein (aur amount <strong className="text-emerald-300">₹{paymentInrAmount.toLocaleString()}</strong> note/copy karein).
                        </li>
                        <li>
                          Apna <strong>PhonePe / Navi / GPay / Paytm</strong> app kholein aur <strong className="text-white">"To Bank / UPI ID"</strong> par jaayein.
                        </li>
                        <li>
                          UPI ID paste karke <strong className="text-emerald-300">₹{paymentInrAmount.toLocaleString()}</strong> pay karein, fir 12-digit UTR neeche submit karein.
                        </li>
                      </ol>
                    </div>
                  </div>
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
                  💡 Payment करने के बाद आपके PhonePe / Navi / GPay में 12 अंकों का <strong>UTR / UPI Ref ID</strong> मिलता है, उसे यहाँ डालकर सबमिट करें। एडमिन वेरिफाई करके तुरंत वॉलेट में क्रेडिट कर देगा।
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

