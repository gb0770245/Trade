import React, { useState, useEffect } from 'react';
import { Smartphone, Lock, Eye, EyeOff, User as UserIcon, KeyRound, X, ShieldCheck, ArrowLeft, CheckCircle2, Gift, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  initialMode?: 'login' | 'register' | 'forgot';
  onClose?: () => void;
}

export const AuthModal: React.FC<Props> = ({ initialMode = 'login', onClose }) => {
  const { login, register, resetUserPassword, closeModal, showToast, theme, platformSettings, lookupReferrer, activeReferrer } = useApp();

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
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(detectedRef ? 'register' : initialMode);
  const [phone, setPhone] = useState(() => {
    if (typeof window !== 'undefined') {
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

  // Send OTP - Hidden from user, use admin configured templates from server
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
        setOtp(''); // Hidden: user must manually type what they receive
        showToast(
          `OTP sent to +91 ${cleanPhone}. Please enter the 6-digit code received.`,
          'success'
        );
      } else {
        showToast(data.error || 'Failed to dispatch OTP from SMS gateway', 'error');
      }
    } catch (err: any) {
      console.error('OTP request error:', err);
      showToast('Connection error while sending OTP. Please retry.', 'error');
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
        if (ok) {
          setAuthError(null);
          if (onClose) onClose();
          else closeModal();
        } else {
          setAuthError('Authentication failed: Mobile number or password did not match registered account.');
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
      if (!inviteCode || inviteCode.trim().length === 0) {
        const msg = 'Invitation code is mandatory. Please enter an invite code.';
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
        if (ok) {
          setAuthError(null);
          if (onClose) onClose();
          else closeModal();
        } else {
          setAuthError('Registration could not be completed. Check if phone is already registered.');
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

  // Theme-specific button and badge styles
  const getThemeStyles = () => {
    if (theme === 'obsidian-gold') {
      return {
        badge: 'bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 shadow-amber-500/20',
        activeTab: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-semibold shadow-md',
        btn: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-bold hover:brightness-105 shadow-lg shadow-amber-500/20',
        accentText: 'text-amber-500',
      };
    }
    if (theme === 'cyber-hydrogen') {
      return {
        badge: 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-cyan-500/20',
        activeTab: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-md',
        btn: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-105 shadow-lg shadow-cyan-500/20',
        accentText: 'text-cyan-500',
      };
    }
    return {
      badge: 'bg-gradient-to-b from-teal-700 to-teal-800 text-white shadow-teal-700/20',
      activeTab: 'bg-teal-700 text-white font-semibold shadow-sm',
      btn: 'bg-gradient-to-r from-teal-700 to-emerald-600 text-white font-semibold hover:from-teal-800 hover:to-emerald-700 shadow-md shadow-teal-700/20',
      accentText: 'text-teal-700',
    };
  };

  const style = getThemeStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-3xl p-6 relative overflow-hidden transition-all shadow-2xl max-h-[92vh] overflow-y-auto ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900/95 border border-amber-500/20 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900/95 border border-cyan-500/20 text-slate-100'
            : 'bg-white/95 border border-white/60 text-slate-800 shadow-teal-900/10'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose || closeModal}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-500/10 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
        </button>

        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-4">
          <div className="relative mb-2 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Nexa AI Official Logo"
              className="w-24 h-24 object-contain drop-shadow-xl select-none"
            />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'register'
              ? 'Create account'
              : 'Reset Password'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'login'
              ? 'Sign in to Nexa AI to continue'
              : mode === 'register'
              ? 'Join Nexa AI and start investing'
              : 'Verify via apitxt.com SMS OTP to reset'}
          </p>
        </div>

        {/* Mode Toggle Tabs (Shown only for Login / Sign Up) */}
        {mode !== 'forgot' ? (
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 mb-5">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-xs rounded-lg transition-all ${
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
              className={`flex-1 py-2 text-xs rounded-lg transition-all ${
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

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
          {/* Phone Number Input */}
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

          {/* Login Mode: Password + Forgot Password link */}
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

          {/* Register Mode Fields */}
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

              {/* Invitation Code with Live Sponsor Referrer Name Lookup */}
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

              {/* OTP Verification (Shown when Admin has SMS OTP Verification ON) */}
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

          {/* Forgot Password Mode Fields */}
          {mode === 'forgot' && (
            <>
              {/* OTP field with Send button */}
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
                    placeholder="Repeat new password"
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

        {/* Toggle Mode footer */}
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
    </div>
  );
};
