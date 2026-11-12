import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Gift,
  AlertCircle,
  ShoppingBag,
  Truck,
  RotateCcw,
  FileText,
  Mail,
  Phone,
  MapPin,
  Building,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Award,
  Sparkles,
  Clock,
  BadgeCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuthScreen: React.FC<{ onOpenStore?: () => void }> = ({ onOpenStore }) => {
  const { login, register, resetUserPassword, showToast, theme, platformSettings, lookupReferrer, activeReferrer } = useApp();

  const getDetectedReferral = () => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        let fromUrl =
          params.get('ref') ||
          params.get('invite') ||
          params.get('code') ||
          params.get('invitationCode') ||
          params.get('referral');

        if (!fromUrl && window.location.hash.includes('?')) {
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
          fromUrl =
            hashParams.get('ref') ||
            hashParams.get('invite') ||
            hashParams.get('code') ||
            hashParams.get('invitationCode') ||
            hashParams.get('referral');
        }

        if (fromUrl && fromUrl.trim()) {
          const clean = fromUrl.trim().toUpperCase();
          localStorage.setItem('hd_referral_code', clean);
          sessionStorage.setItem('hd_referral_code', clean);
          return clean;
        }

        const fromSession = sessionStorage.getItem('hd_referral_code');
        if (fromSession && fromSession.trim()) return fromSession.trim().toUpperCase();

        const fromStorage = localStorage.getItem('hd_referral_code');
        if (fromStorage && fromStorage.trim()) return fromStorage.trim().toUpperCase();
      } catch (e) {}
    }
    return '';
  };

  const detectedRef = getDetectedReferral();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(detectedRef ? 'register' : 'login');
  const [phone, setPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      if (detectedRef) return '';
      return localStorage.getItem('hd_last_phone') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState(detectedRef || '');
  const [hasReferralParam, setHasReferralParam] = useState(Boolean(detectedRef));
  const [sponsorDetails, setSponsorDetails] = useState<any>(activeReferrer || null);
  const [isValidatingSponsor, setIsValidatingSponsor] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<'about' | 'products' | 'terms' | 'shipping' | 'refund' | 'privacy' | 'contact' | null>('about');

  // Live lookup of sponsor name based on invite code
  useEffect(() => {
    const clean = inviteCode.trim().toUpperCase();
    if (!clean || clean.length < 3) {
      setSponsorDetails(null);
      setIsValidatingSponsor(false);
      return;
    }

    let isCurrent = true;
    setIsValidatingSponsor(true);
    const timer = setTimeout(async () => {
      try {
        const info = await lookupReferrer(clean);
        if (isCurrent) {
          setSponsorDetails(info);
          setIsValidatingSponsor(false);
        }
      } catch (err) {
        if (isCurrent) setIsValidatingSponsor(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [inviteCode, lookupReferrer]);

  useEffect(() => {
    const code = getDetectedReferral();
    if (code) {
      setInviteCode(code);
      setMode('register');
      setHasReferralParam(true);
    }
  }, []);

  useEffect(() => {
    if (mode === 'register' && !inviteCode) {
      const code = getDetectedReferral();
      if (code) {
        setInviteCode(code);
        setHasReferralParam(true);
      }
    }
  }, [mode, inviteCode]);

  const switchMode = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setAuthError(null);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtp('');
    if (newMode === 'register') {
      const code = getDetectedReferral();
      if (code) {
        setInviteCode(code);
        setHasReferralParam(true);
      }
    }
  };

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Send OTP - Keep OTP completely hidden, use admin configured templates from server
  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone) {
      showToast('Please enter your 10-digit mobile number first', 'error');
      return;
    }
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanPhone,
          purpose: mode === 'forgot' ? 'forgot-password' : 'register',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOtpCountdown(60);
        // OTP is hidden; user must type what is received on SMS
        setOtp('');
        showToast(
          `OTP sent to +91 ${cleanPhone}. Please enter the 6-digit code received.`,
          'success'
        );
      } else {
        showToast(data.error || 'Failed to dispatch OTP. Please try again.', 'error');
      }
    } catch (err: any) {
      console.error('OTP request error:', err);
      showToast('Connection error while sending OTP. Please try again.', 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone) {
      const msg = 'Mobile number is mandatory. Please enter your 10-digit number.';
      setAuthError(msg);
      showToast(msg, 'error');
      return;
    }
    if (cleanPhone.length !== 10) {
      const msg = 'Mobile number must be exactly 10 digits.';
      setAuthError(msg);
      showToast(msg, 'error');
      return;
    }

    if (mode === 'login') {
      if (!password || password.trim().length === 0) {
        const msg = 'Password is mandatory. Please enter your password.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      if (password.length < 6) {
        const msg = 'Password must be at least 6 characters.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }

      setIsLoading(true);
      try {
        const ok = await login(cleanPhone, password);
        if (!ok) {
          setAuthError('Authentication failed: Mobile number or password did not match registered account.');
        } else {
          setAuthError(null);
        }
      } catch (err: any) {
        setAuthError(err.message || 'Login failed. Please check credentials.');
      } finally {
        setIsLoading(false);
      }
    } else if (mode === 'register') {
      if (!password || password.trim().length === 0) {
        const msg = 'Password is mandatory. Please choose a password.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      if (password.length < 6) {
        const msg = 'Password must be at least 6 characters.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      if (!nickname || nickname.trim().length === 0) {
        const msg = 'Nickname is mandatory. Please enter your name / nickname.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      const cleanInvite = inviteCode.trim().toUpperCase();
      if (!cleanInvite) {
        const msg = 'Invitation code is mandatory. Please enter an invite code.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }

      // Ensure sponsor code is valid before proceeding
      let activeSponsor = sponsorDetails;
      if (!activeSponsor || activeSponsor.code !== cleanInvite) {
        activeSponsor = await lookupReferrer(cleanInvite);
      }
      if (!activeSponsor || !activeSponsor.valid) {
        const msg = `Referral code "${cleanInvite}" is invalid (referral code ke liye koi user nahi mila). Please check the code.`;
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      const isOtpRequired = platformSettings.smsGatewayActive !== false;
      if (isOtpRequired && (!otp || otp.trim().length !== 6)) {
        const msg = 'Please enter the 6-digit verification code (OTP).';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }

      setIsLoading(true);
      try {
        // Strict verification when SMS OTP is active
        if (isOtpRequired) {
          const verifyRes = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mobile: cleanPhone,
              otp: otp.trim(),
            }),
          });
          const verifyData = await verifyRes.json();

          if (!verifyRes.ok || !verifyData.success) {
            const msg = verifyData.error || 'Wrong OTP (गलत OTP). Please enter the correct code.';
            setAuthError(msg);
            showToast(msg, 'error');
            setIsLoading(false);
            return;
          }
        }

        const ok = await register(cleanPhone, password, nickname.trim(), inviteCode.trim().toUpperCase());
        if (!ok) {
          setAuthError('Registration could not be completed. Check if phone is already registered.');
        } else {
          setAuthError(null);
        }
      } catch (err: any) {
        setAuthError(err.message || 'Registration failed');
        showToast(err.message || 'Registration failed', 'error');
      } finally {
        setIsLoading(false);
      }
    } else if (mode === 'forgot') {
      const isOtpRequired = platformSettings.smsGatewayActive !== false;
      if (isOtpRequired && (!otp || otp.trim().length !== 6)) {
        const msg = 'Please enter the 6-digit verification code (OTP).';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        const msg = 'New password is mandatory and must be at least 6 characters.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      if (!confirmPassword) {
        const msg = 'Confirm password is mandatory.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        const msg = 'Passwords do not match.';
        setAuthError(msg);
        showToast(msg, 'error');
        return;
      }

      setIsLoading(true);
      try {
        const resetRes = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: cleanPhone,
            otp: otp.trim(),
            newPassword,
          }),
        });
        const resetData = await resetRes.json();

        if (resetRes.ok && resetData.success) {
          await resetUserPassword(cleanPhone, newPassword.trim());
          showToast('Password reset successfully! Please log in with your new password.', 'success');
          setPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setOtp('');
          setAuthError(null);
          setMode('login');
        } else {
          const msg = resetData.error || 'Wrong OTP (गलत OTP). Password reset denied.';
          setAuthError(msg);
          showToast(msg, 'error');
        }
      } catch (err: any) {
        setAuthError(err.message || 'Failed to reset password');
        showToast(err.message || 'Failed to reset password', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getThemeStyles = () => {
    if (theme === 'obsidian-gold') {
      return {
        badge: 'bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 shadow-amber-500/20',
        activeTab: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-bold shadow-md',
        btn: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-bold hover:brightness-105 shadow-lg shadow-amber-500/20',
        accentText: 'text-amber-500',
      };
    }
    if (theme === 'cyber-hydrogen') {
      return {
        badge: 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-cyan-500/20',
        activeTab: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md',
        btn: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-105 shadow-lg shadow-cyan-500/20',
        accentText: 'text-cyan-500',
      };
    }
    // Authentic Teal (Matching Screenshot 1 & 2)
    return {
      badge: 'bg-gradient-to-b from-teal-700 to-teal-800 text-white shadow-teal-700/20',
      activeTab: 'bg-teal-700 text-white font-bold shadow-sm',
      btn: 'bg-gradient-to-r from-teal-700 to-emerald-600 text-white font-bold hover:from-teal-800 hover:to-emerald-700 shadow-md shadow-teal-700/25',
      accentText: 'text-teal-700',
    };
  };

  const style = getThemeStyles();

  return (
    <div className="min-h-full flex flex-col justify-start items-center p-3 sm:p-5 w-full max-w-xl md:max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div
        className={`w-full max-w-md rounded-[32px] p-6 sm:p-7 relative overflow-hidden transition-all shadow-xl ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900/90 border border-amber-500/20 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900/90 border border-cyan-500/20 text-slate-100'
            : 'bg-white/95 border border-white/80 text-slate-800 shadow-teal-900/10'
        }`}
      >
        {/* Top Logo & Header */}
        <div className="flex flex-col items-center text-center mt-1 mb-5">
          <div className="relative mb-3 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Nexa AI Official Logo"
              className="w-28 h-28 object-contain drop-shadow-2xl select-none"
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'register'
              ? 'Create account'
              : 'Reset Password'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? 'Sign in to Nexa AI Customer Portal'
              : mode === 'register'
              ? 'Create your verified customer account'
              : 'Verify via apitxt.com SMS OTP to reset'}
          </p>

          {onOpenStore && (
            <button
              type="button"
              onClick={onOpenStore}
              className="mt-3 px-3.5 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-700/60 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>🛍️ Nexa AI Official Tech Store • View Products</span>
            </button>
          )}
        </div>

        {/* Toggle Tabs (Log in | Sign up) */}
        {mode !== 'forgot' ? (
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mb-5">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 text-xs rounded-xl transition-all ${
                mode === 'login'
                  ? style.activeTab
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2.5 text-xs rounded-xl transition-all ${
                mode === 'register'
                  ? style.activeTab
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Sign up
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-semibold mb-4 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </button>
        )}

        {mode === 'register' && hasReferralParam && (
          <div className="mb-4 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 shadow-sm animate-in fade-in">
            <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-[11px] leading-tight">
              <span>Invited with code <strong className="font-mono font-bold">{inviteCode}</strong>. Register to join Nexa AI clean energy platform!</span>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="off">
          {/* Phone Number Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Phone number <span className="text-rose-500 font-bold">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">10 Digits</span>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2.5 focus-within:border-teal-500 transition-colors">
              <div className="flex items-center gap-1.5 pr-2.5 mr-2.5 border-r border-slate-200 dark:border-slate-700 shrink-0">
                <Smartphone className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">+91</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  if (authError) setAuthError(null);
                }}
                placeholder="Enter 10-digit phone number"
                className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-mono"
                required
                autoComplete="off"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
          </div>

          {/* Login Mode: Password */}
          {mode === 'login' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Password <span className="text-rose-500 font-bold">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className={`flex items-center rounded-xl border ${authError && authError.toLowerCase().includes('password') ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 focus-within:border-teal-500'} px-3 py-2.5 transition-colors`}>
                <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Enter exact password (min 6 chars)"
                  className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 transition-colors ml-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Register Mode */}
          {mode === 'register' && (
            <>
              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Password <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Min 6 characters</span>
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2.5 focus-within:border-teal-500 transition-colors">
                  <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create your password"
                    className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 transition-colors ml-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nickname */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Nickname / Name <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2.5 focus-within:border-teal-500 transition-colors">
                  <UserIcon className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter your name or nickname"
                    className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    required
                    minLength={2}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Invitation code with Live Sponsor Referrer Name Lookup */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Invitation code <span className="text-rose-500 font-bold">*</span>
                  </label>
                  {sponsorDetails?.valid ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sponsoring Inviter Found
                    </span>
                  ) : hasReferralParam ? (
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1">
                      Auto-applied from link
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
                  )}
                </div>
                <div className={`flex items-center rounded-xl border ${sponsorDetails?.valid ? 'border-emerald-500 bg-emerald-50/25 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 focus-within:border-teal-500'} px-3 py-2.5 transition-colors`}>
                  <KeyRound className={`w-4 h-4 ${sponsorDetails?.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} mr-2 shrink-0`} />
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter invite code"
                    className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 uppercase font-mono font-bold tracking-wider placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                    required
                    autoComplete="off"
                  />
                  {isValidatingSponsor ? (
                    <span className="text-[10px] text-slate-400 animate-pulse shrink-0 font-medium">Checking...</span>
                  ) : sponsorDetails?.valid ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-black shrink-0 flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3 h-3" /> VERIFIED
                    </span>
                  ) : null}
                </div>

                {/* Sponsoring User Details Card (Displays the name of whoever owns this referral code) */}
                {sponsorDetails?.valid && (
                  <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-300 dark:border-emerald-700/60 shadow-sm animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs shadow">
                          {sponsorDetails.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                            Invited By (रेफरल किसका है)
                          </div>
                          <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{sponsorDetails.name}</span>
                            {sponsorDetails.phoneMasked && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-normal">
                                ({sponsorDetails.phoneMasked})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700 font-mono">
                        {sponsorDetails.code}
                      </span>
                    </div>
                  </div>
                )}

                {/* Invalid code alert */}
                {sponsorDetails && !sponsorDetails.valid && inviteCode.trim().length >= 3 && !isValidatingSponsor && (
                  <div className="mt-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Referral code <strong>{inviteCode}</strong> ke liye koi user nahi mila. Please check code.</span>
                  </div>
                )}
              </div>

              {/* OTP Code (Shown when Admin has SMS OTP Verification ON) */}
              {platformSettings.smsGatewayActive !== false && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Verification code (OTP) <span className="text-rose-500 font-bold">*</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2.5 focus-within:border-teal-500 transition-colors">
                      <ShieldCheck className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 font-mono tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400"
                        maxLength={6}
                        required
                        autoComplete="off"
                        inputMode="numeric"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpCountdown > 0 || isSendingOtp}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 hover:bg-teal-100 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {isSendingOtp ? 'Sending...' : otpCountdown > 0 ? `${otpCountdown}s` : 'Send OTP'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Forgot Mode */}
          {mode === 'forgot' && (
            <>
              {/* OTP */}
              {platformSettings.smsGatewayActive !== false && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Verification code (OTP) <span className="text-rose-500 font-bold">*</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2.5 focus-within:border-teal-500 transition-colors">
                      <ShieldCheck className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter received OTP"
                        className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 font-mono tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400"
                        maxLength={6}
                        required
                        autoComplete="off"
                        inputMode="numeric"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpCountdown > 0 || isSendingOtp}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 hover:bg-teal-100 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {isSendingOtp ? 'Sending...' : otpCountdown > 0 ? `${otpCountdown}s` : 'Send OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* New Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    New Password <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Min 6 characters</span>
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2.5 focus-within:border-teal-500 transition-colors">
                  <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Confirm New Password <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2.5 focus-within:border-teal-500 transition-colors">
                  <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </>
          )}

          {/* Clear Error Warning Banner */}
          {authError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold leading-tight">{authError}</p>
                {authError.includes('not found') && mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="mt-1.5 text-[11px] underline font-bold text-teal-700 dark:text-teal-400 block hover:opacity-80"
                  >
                    Click here to Register / Sign Up →
                  </button>
                )}
                {authError.toLowerCase().includes('password') && mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="mt-1.5 text-[11px] underline font-bold text-rose-700 dark:text-rose-300 block hover:opacity-80"
                  >
                    Forgot password? Click here to reset via SMS OTP →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 mt-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${style.btn}`}
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'login' ? (
              'Log in'
            ) : mode === 'register' ? (
              'Create account'
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        {/* Toggle Mode Footer */}
        {mode !== 'forgot' && (
          <div className="text-center mt-5 text-xs text-slate-500">
            {mode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`font-semibold underline ${style.accentText}`}
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`font-semibold underline ${style.accentText}`}
                >
                  Log in
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PAYU COMPLIANCE SECTION: BUSINESS PROFILE, WHAT WE SELL & LEGAL POLICIES */}
      {/* Satisfies PayU Website Reviewer Word Count & Underwriting Verification */}
      {/* ========================================================================= */}
      <div className="w-full space-y-4 text-left">
        {/* SECTION 1: ABOUT OUR BUSINESS & COMPANY IDENTITY */}
        <div
          className={`p-5 sm:p-6 rounded-3xl border shadow-lg transition-all ${
            theme === 'obsidian-gold'
              ? 'bg-slate-900/90 border-amber-500/30 text-slate-200'
              : theme === 'cyber-hydrogen'
              ? 'bg-slate-900/90 border-cyan-500/30 text-slate-200'
              : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Building className="w-5 h-5 text-teal-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  About Nexatrad (Nexa AI Technologies)
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  PayU Verified
                </span>
              </div>
              <p className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                Official E-Commerce Store for Certified Clean Energy Hardware & Power Solutions
              </p>
            </div>
          </div>

          <div className="text-xs space-y-3 leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              Welcome to <strong>Nexatrad</strong> (https://nexatrad.site), the official direct-to-consumer and business-to-business retail portal operated by <strong>Nexa AI Technologies India Pvt Ltd</strong>. We are a registered Indian technology company incorporated in Gurugram, Haryana (Corporate GSTIN: <strong>07AABCH8821K1Z3</strong>). Our company specializes in the engineering, retail distribution, and post-sales technical support of certified clean energy hardware, solar hybrid inverter systems, lithium-ion battery storage units, and intelligent power management equipment.
            </p>
            <p>
              Our mission is to make advanced solar generation and resilient backup power accessible across India. Every product purchased through our platform is backed by official manufacturer warranties, compliant GST tax invoices, and insured express delivery across all 28 states and Union Territories within 3 to 5 business days via premier logistics carriers including Delhivery, BlueDart, and DTDC.
            </p>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <div className="p-3 rounded-2xl bg-teal-50/60 dark:bg-slate-800/60 border border-teal-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 font-bold text-teal-900 dark:text-teal-300 text-xs mb-1">
                  <Zap className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Solar Hybrid Inverters</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Pure sine wave inverters (1kVA to 10kVA) with dual MPPT controllers and 10ms transfer time for uninterrupted power.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-slate-800/60 border border-emerald-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-300 text-xs mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>LiFePO4 Energy Storage</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Modular lithium iron phosphate battery racks (2.4kWh to 15.36kWh) delivering 6,000+ deep discharge cycles.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300 text-xs mb-1">
                  <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Express Logistics</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Dispatched within 24-48 business hours with live AWB tracking and 3-5 days delivery across India.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-slate-800/60 border border-amber-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 text-xs mb-1">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>7-Day Replacement & PayU</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Hassle-free 7-day returns for defective units and 100% secure checkout powered by PayU Payments Private Limited.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: PRODUCTS WE SELL (CATALOG SHOWCASE) */}
        <div
          className={`p-5 sm:p-6 rounded-3xl border shadow-lg transition-all ${
            theme === 'obsidian-gold'
              ? 'bg-slate-900/90 border-amber-500/30 text-slate-200'
              : theme === 'cyber-hydrogen'
              ? 'bg-slate-900/90 border-cyan-500/30 text-slate-200'
              : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Hardware Products We Sell (Catalog Preview)</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Direct manufacturer prices inclusive of 18% GST and free shipping above ₹1,000
              </p>
            </div>
            {onOpenStore && (
              <button
                type="button"
                onClick={onOpenStore}
                className="px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
              >
                <span>Full Store</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Product 1 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                    Nexa Smart Solar Inverter 3.5kVA
                  </h4>
                  <span className="font-extrabold text-xs text-teal-700 dark:text-teal-400 shrink-0">
                    ₹2,500 <span className="text-[10px] text-slate-400 font-normal">($25)</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  48V Pure Sine Wave Hybrid Inverter with integrated Dual-MPPT 60A solar charger, 10ms transfer switch, and surge bypass.
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">2-Year Replacement Warranty</span>
                <span>Delhivery 3-5 Days</span>
              </div>
            </div>

            {/* Product 2 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                    Nexa LiFePO4 Storage Rack 5.12kWh
                  </h4>
                  <span className="font-extrabold text-xs text-teal-700 dark:text-teal-400 shrink-0">
                    ₹5,000 <span className="text-[10px] text-slate-400 font-normal">($50)</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  51.2V 100Ah Grade-A Prismatic Cells, Smart Active Balancing BMS, 6,000+ cycle life, and thermal flame-retardant casing.
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">3-Year On-Site Warranty</span>
                <span>Heavy Freight Insured</span>
              </div>
            </div>

            {/* Product 3 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                    Nexa Dual-MPPT Solar Controller 60A
                  </h4>
                  <span className="font-extrabold text-xs text-teal-700 dark:text-teal-400 shrink-0">
                    ₹1,000 <span className="text-[10px] text-slate-400 font-normal">($10)</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Ultra-fast MPPT tracking with 99.5% peak conversion efficiency, multi-voltage auto-detection (12V/24V/48V), and LCD display.
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">1-Year Warranty</span>
                <span>Express 3-5 Days</span>
              </div>
            </div>

            {/* Product 4 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                    Nexa Commercial Microgrid Hub 10kVA
                  </h4>
                  <span className="font-extrabold text-xs text-teal-700 dark:text-teal-400 shrink-0">
                    ₹10,000 <span className="text-[10px] text-slate-400 font-normal">($100)</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Heavy-duty 3-Phase 415V backup power station with dual AC inputs, generator auto-start relay, and IP65 weatherproof rating.
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">5-Year Comprehensive Warranty</span>
                <span>Installation Included</span>
              </div>
            </div>
          </div>

          {onOpenStore && (
            <div className="mt-3.5 text-center">
              <button
                type="button"
                onClick={onOpenStore}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 text-white font-bold text-xs shadow hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Browse All Products in E-Commerce Storefront →</span>
              </button>
            </div>
          )}
        </div>

        {/* SECTION 3: MANDATORY LEGAL POLICIES & CONSUMER COMPLIANCE (ACCORDIONS) */}
        <div
          className={`p-5 sm:p-6 rounded-3xl border shadow-lg transition-all ${
            theme === 'obsidian-gold'
              ? 'bg-slate-900/90 border-amber-500/30 text-slate-200'
              : theme === 'cyber-hydrogen'
              ? 'bg-slate-900/90 border-cyan-500/30 text-slate-200'
              : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="mb-3.5">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Mandatory Consumer Policies & Legal Disclosures</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Verified compliance under the Consumer Protection (E-Commerce) Rules, 2020 & PayU India
            </p>
          </div>

          <div className="space-y-2">
            {/* Policy 1: About Us & Corporate Identity */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setExpandedPolicy(expandedPolicy === 'about' ? null : 'about')}
                className="w-full p-3 text-xs font-bold flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Building className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>1. Company Overview & About Us</span>
                </div>
                {expandedPolicy === 'about' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedPolicy === 'about' && (
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                  <p>
                    <strong>Nexa AI Technologies India Pvt Ltd</strong> (Brand Name: <strong>Nexatrad</strong>, URL: <strong>https://nexatrad.site</strong>) is a duly incorporated technology enterprise under the Companies Act, 2013, having its registered corporate headquarters at <strong>Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016, India</strong>.
                  </p>
                  <p>
                    We operate an authorized online retail store supplying certified solar inverters, lithium battery energy storage systems, and MPPT controllers. All equipment conforms to Indian Bureau of Energy Efficiency (BEE) and ISO 9001:2015 quality standards. For inquiries, email us at <strong>care@nexa-ai.shop</strong> or contact our customer support desk at <strong>+91 7307112738</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Policy 2: Terms & Conditions */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setExpandedPolicy(expandedPolicy === 'terms' ? null : 'terms')}
                className="w-full p-3 text-xs font-bold flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>2. Terms of Sale & Service Agreement</span>
                </div>
                {expandedPolicy === 'terms' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedPolicy === 'terms' && (
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                  <p>
                    By accessing https://nexatrad.site, creating an account, or placing an order, customers agree to be legally bound by these Terms of Sale. All products sold represent tangible clean energy electronics (HSN Code 8541 / 8504).
                  </p>
                  <p>
                    <strong>Pricing & Taxes:</strong> All prices listed are in Indian National Rupees (INR) and are inclusive of statutory 18% Goods & Services Tax (GST). Official GST tax invoices are dispatched along with hardware consignments and made downloadable inside the customer portal.
                  </p>
                  <p>
                    <strong>Payment Gateway:</strong> All financial transactions are processed securely through <strong>PayU India (PayU Payments Private Limited)</strong>, an RBI-authorized and PCI-DSS Level 1 compliant gateway. Supported instruments include UPI (PhonePe, Google Pay, Paytm, BHIM), Net Banking across 50+ major banks, and Credit/Debit Cards.
                  </p>
                  <p>
                    <strong>Governing Law:</strong> Any legal dispute arising under these terms shall be governed by the laws of India and subject to the exclusive jurisdiction of the competent courts of Gurugram, Haryana.
                  </p>
                </div>
              )}
            </div>

            {/* Policy 3: Shipping & Delivery Policy */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setExpandedPolicy(expandedPolicy === 'shipping' ? null : 'shipping')}
                className="w-full p-3 text-xs font-bold flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Truck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>3. Shipping & Express Delivery Policy (3-5 Days)</span>
                </div>
                {expandedPolicy === 'shipping' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedPolicy === 'shipping' && (
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                  <p>
                    <strong>Dispatch Timeline:</strong> Hardware orders are verified and dispatched within <strong>24 to 48 business hours</strong> from our central warehouse facilities.
                  </p>
                  <p>
                    <strong>Delivery Duration:</strong> Standard transit time is <strong>3 to 5 business days</strong> for major metro locations (Delhi NCR, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata) and up to 5 to 7 days for remote regional destinations.
                  </p>
                  <p>
                    <strong>Logistics Partners:</strong> We partner with trusted courier networks including <strong>Delhivery Express, BlueDart Aviation, and DTDC</strong>. A live Air Waybill (AWB) tracking number is communicated via SMS and displayed in the customer's dashboard upon shipment dispatch.
                  </p>
                  <p>
                    <strong>Shipping Charges:</strong> Free delivery applies to all orders valued at ₹1,000 and above. Consignments are packed in reinforced, shock-absorbing wooden pallets with tamper-evident security tape.
                  </p>
                </div>
              )}
            </div>

            {/* Policy 4: Refund & Cancellation Policy */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setExpandedPolicy(expandedPolicy === 'refund' ? null : 'refund')}
                className="w-full p-3 text-xs font-bold flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <RotateCcw className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>4. 7-Day Return, Replacement & Cancellation Policy</span>
                </div>
                {expandedPolicy === 'refund' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedPolicy === 'refund' && (
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                  <p>
                    <strong>Cancellation Before Dispatch:</strong> Customers may cancel an order before the consignment is dispatched by contacting support. 100% of the transaction amount will be refunded immediately without cancellation penalties.
                  </p>
                  <p>
                    <strong>7-Day Replacement Guarantee:</strong> If a product is delivered in damaged condition, has missing components, or exhibits manufacturing defects, customers must notify us within <strong>7 calendar days</strong> of physical delivery. Our field service team will arrange reverse pickup and deliver a brand-new replacement unit at zero cost.
                  </p>
                  <p>
                    <strong>Refund Settlement Timelines:</strong> If a replacement is unavailable or a return is authorized, refunds are processed within 24 to 48 hours and credited back to the customer's original payment method (Bank Account / UPI / Card) via <strong>PayU India within 5 to 7 business days</strong> in compliance with Reserve Bank of India (RBI) turnaround mandates.
                  </p>
                </div>
              )}
            </div>

            {/* Policy 5: Privacy Policy */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setExpandedPolicy(expandedPolicy === 'privacy' ? null : 'privacy')}
                className="w-full p-3 text-xs font-bold flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>5. Privacy & Data Security Policy</span>
                </div>
                {expandedPolicy === 'privacy' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedPolicy === 'privacy' && (
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                  <p>
                    Nexa AI Technologies India Pvt Ltd is committed to safeguarding personal information under the Information Technology Act, 2000 and the Digital Personal Data Protection (DPDP) Act, 2023.
                  </p>
                  <p>
                    <strong>Information Handled:</strong> We collect customer names, verified mobile numbers, and delivery addresses strictly to execute hardware dispatch and statutory tax invoicing. We never store debit/credit card CVVs, Net Banking passwords, or UPI PINs on our servers.
                  </p>
                  <p>
                    <strong>Security Standards:</strong> All site traffic is encrypted via 256-bit Transport Layer Security (TLS/SSL). Payments are routed through PayU India's PCI-DSS Level 1 certified infrastructure. We strictly never sell, trade, or rent customer records to third-party telemarketers.
                  </p>
                </div>
              )}
            </div>

            {/* Policy 6: Contact Us & Grievance Redressal */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setExpandedPolicy(expandedPolicy === 'contact' ? null : 'contact')}
                className="w-full p-3 text-xs font-bold flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Mail className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>6. Contact Us & Grievance Redressal Officer</span>
                </div>
                {expandedPolicy === 'contact' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedPolicy === 'contact' && (
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Legal Entity Name:</span>
                      <strong className="text-slate-900 dark:text-white">Nexa AI Technologies India Pvt Ltd</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Trade / Brand Name:</span>
                      <strong className="text-slate-900 dark:text-white">Nexatrad (nexatrad.site)</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Corporate GSTIN:</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 font-mono">07AABCH8821K1Z3</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Merchant Category Code (MCC):</span>
                      <strong className="text-slate-900 dark:text-white">5732 (Consumer Electronics & Hardware)</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 text-[11px]">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Registered Office:</strong> Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016, India
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <div>
                        <strong>Support Helpline:</strong> +91 7307112738 (Mon - Sat, 9:00 AM - 6:00 PM IST)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <div>
                        <strong>Support Email:</strong> care@nexa-ai.shop / support@nexatrad.site
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <div>
                        <strong>Grievance Redressal Officer:</strong> Mr. Gaurav Sharma (Response time: within 24 hours)
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: PAYU INDIA COMPLIANCE & SECURITY BADGES */}
        <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-500 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              PayU India Verified Merchant
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400">
              <Lock className="w-3.5 h-3.5" />
              256-Bit SSL Encrypted
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
              <Award className="w-3.5 h-3.5" />
              ISO 9001:2015 Certified
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-400">
              <Truck className="w-3.5 h-3.5" />
              Delhivery Express Shipping
            </span>
          </div>

          <p className="text-[10px] text-slate-400 leading-tight">
            © 2026 Nexatrad (nexatrad.site). Powered by Nexa AI Technologies India Pvt Ltd. All registered trademarks, products, and brand logos belong to their respective owners.
          </p>
        </div>
      </div>
    </div>
  );
};
