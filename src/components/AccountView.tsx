import React, { useState } from 'react';
import {
  ChevronLeft,
  Settings,
  Edit3,
  Copy,
  CheckCircle2,
  ChevronRight,
  Crown,
  Sparkles,
  Wallet,
  FileText,
  Gift,
  Gem,
  Users,
  HelpCircle,
  LogOut,
  X,
  CreditCard,
  Coins,
  Layers,
  FileQuestion,
  Headphones,
  ThumbsUp,
  Smartphone,
  Download,
  Share2,
  ShieldCheck,
  User as UserIcon,
  LogIn,
  History,
  ExternalLink,
  Calendar,
  Ticket,
} from 'lucide-react';
import { useApp, normalizeRedirectUrl } from '../context/AppContext';
import { VIP_TIERS } from '../data/mockData';

export const AccountView: React.FC = () => {
  const {
    user,
    teamMembers,
    openModal,
    openRewardsModal,
    logout,
    updateNickname,
    goBack,
    showToast,
    theme,
    setIsAdminView,
    platformSettings,
  } = useApp();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [newNickname, setNewNickname] = useState(user?.nickname || 'gaurav');

  const tier1Rate = platformSettings?.tier1Commission ?? 10;
  const tier2Rate = platformSettings?.tier2Commission ?? 3;
  const tier3Rate = platformSettings?.tier3Commission ?? 1;
  const totalCommissionRate = tier1Rate + tier2Rate + tier3Rate;

  const activeHelpLinks = (platformSettings?.helpCenterLinks || []).filter(
    (l) => l.isActive !== false && l.url && l.url.trim()
  );
  const primaryHelpUrl = normalizeRedirectUrl(
    platformSettings?.helpCenterUrl || (activeHelpLinks.length > 0 ? activeHelpLinks[0].url : '')
  );
  const extraHelpLinks = activeHelpLinks.filter(
    (l) => normalizeRedirectUrl(l.url) && normalizeRedirectUrl(l.url) !== primaryHelpUrl
  );

  const currentLevel = user?.vipLevel || 0;
  const nextTier = VIP_TIERS.find((v) => v.level === currentLevel + 1);
  const neededMore = nextTier ? Math.max(0, nextTier.minInvestment - (user?.totalInvested || 0)) : 0;
  const progressPercent = nextTier
    ? Math.min(100, Math.round(((user?.totalInvested || 0) / nextTier.minInvestment) * 100))
    : 100;

  const handleOpenEditModal = () => {
    setShowEditModal(true);
    if (typeof window !== 'undefined') {
      window.history.pushState({ appletSubView: 'account-settings' }, '');
    }
  };

  const handleCloseEditModal = () => {
    if (typeof window !== 'undefined' && window.history.state?.appletSubView === 'account-settings') {
      window.history.back();
    } else {
      setShowEditModal(false);
    }
  };

  React.useEffect(() => {
    const handlePop = () => {
      if (showEditModal) {
        setShowEditModal(false);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [showEditModal]);

  // Lock background page scroll when local AccountView modals are open
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (showEditModal || showCompanyModal || showRulesModal) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      return () => {
        document.body.style.overflow = '';
        document.body.style.overscrollBehavior = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.overscrollBehavior = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showEditModal, showCompanyModal, showRulesModal]);

  const handleCopyId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    showToast('User ID copied to clipboard!', 'info');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyInvite = () => {
    if (!user?.invitationCode) return;
    navigator.clipboard.writeText(user.invitationCode);
    setCopiedInvite(true);
    showToast('Invitation code copied!', 'info');
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    updateNickname(newNickname);
    handleCloseEditModal();
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      {/* Top Header Bar matching Screenshot 7 */}
      <header className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
        <button
          type="button"
          onClick={goBack}
          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Back to Previous Page"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        </button>

        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">My Account</h2>

        <button
          type="button"
          onClick={handleOpenEditModal}
          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
      </header>

      {/* User Profile Card */}
      <div className="px-4 mt-2">
        {!user ? (
          <div className="rounded-3xl bg-gradient-to-b from-teal-800 to-teal-900 text-white p-5 shadow-xl text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto overflow-hidden shadow-md border-2 border-teal-300 bg-slate-900 mb-2.5 flex items-center justify-center">
              <UserIcon className="w-7 h-7 text-teal-300" />
            </div>
            <h3 className="text-base font-bold">Welcome to Nexa AI</h3>
            <p className="text-xs text-teal-200/90 mt-1 mb-3.5 max-w-xs mx-auto">
              Please sign in or register to manage your real balances, active yield contracts, and team network.
            </p>
            <button
              type="button"
              onClick={() => openModal('auth')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Log In / Sign Up</span>
            </button>
          </div>
        ) : (
          <div className="rounded-3xl bg-gradient-to-b from-teal-800 to-teal-900 text-white p-4 shadow-xl">
            {/* User info row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg border border-teal-500/40 bg-slate-950 p-1 shrink-0 flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="Nexa AI Profile"
                    className="w-full h-full object-contain select-none"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold capitalize">{user.nickname}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-teal-200 font-mono">ID {user.id}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 rounded hover:bg-white/10 text-teal-300"
                      title="Copy ID"
                    >
                      {copiedId ? <CheckCircle2 className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Personal Unique Referral Code & Inviter Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-teal-700/50 text-[11px]">
                    <div className="flex items-center gap-1 bg-black/25 px-2.5 py-1 rounded-xl border border-teal-600/40">
                      <span className="text-teal-300 font-medium">My Code:</span>
                      <strong className="font-mono font-black text-amber-300 tracking-wider">
                        {user.invitationCode || '4AB86'}
                      </strong>
                      <button
                        type="button"
                        onClick={handleCopyInvite}
                        className="p-0.5 rounded hover:bg-white/15 text-amber-300 ml-0.5"
                        title="Copy Referral Code"
                      >
                        {copiedInvite ? <CheckCircle2 className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    {user.invitedBy && (
                      <div className="flex items-center gap-1 bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-500/40 text-emerald-300 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Invited by: <strong>{user.inviterName || 'Sponsor'}</strong></span>
                        <span className="font-mono text-[10px] text-emerald-400">({user.invitedBy})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenEditModal}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-semibold backdrop-blur-sm transition-colors self-start"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            {/* 3 Wallets Strip (Add Money, Withdrawal, Product Income) */}
            <div className="mt-4 p-3 rounded-2xl bg-teal-950/60 backdrop-blur-md border border-teal-700/50 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-base font-extrabold text-white num-tabular">
                  ${(user.rechargeBalance || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-teal-200/80 mt-0.5">Add Money Balance</div>
              </div>

              <div className="border-x border-teal-700/60">
                <div className="text-base font-extrabold text-emerald-300 num-tabular">
                  ${(user.withdrawalBalance || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-teal-200/80 mt-0.5">Withdrawal Balance</div>
              </div>

              <div>
                <div className="text-base font-extrabold text-white num-tabular">
                  ${(user.productRevenue || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-teal-200/80 mt-0.5">Product Income</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Buttons (Core Feature Icons - Add Money, Withdraw, Check-In, Gift Card, Team, VIP, Orders, Download) */}
      <div className="px-4 mt-3">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
          {/* Row 1: Core Financial & Reward Actions */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Add Money */}
            <button
              type="button"
              onClick={() => openModal('recharge')}
              className="flex flex-col items-center group transition-transform active:scale-95 cursor-pointer"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 mt-1.5">Add Money</span>
            </button>

            {/* Withdraw */}
            <button
              type="button"
              onClick={() => openModal('withdraw')}
              className="flex flex-col items-center group transition-transform active:scale-95 cursor-pointer"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 mt-1.5">Withdraw</span>
            </button>

            {/* Gift Card */}
            <button
              type="button"
              onClick={() => openRewardsModal('giftcard')}
              className="flex flex-col items-center group transition-transform active:scale-95 cursor-pointer"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 mt-1.5">Gift Card</span>
            </button>

            {/* My Orders */}
            <button
              type="button"
              onClick={() => openModal('orders')}
              className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 mt-1.5">My Orders</span>
            </button>
          </div>

          {/* Row 2: Secondary Feature Icons (Team, VIP, Support, Guide) */}
          <div className="grid grid-cols-4 gap-2 text-center mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800">
            {/* Team */}
            <button
              type="button"
              onClick={() => openModal('team')}
              className="flex flex-col items-center group transition-transform active:scale-95 cursor-pointer"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5">Team</span>
            </button>

            {/* VIP */}
            <button
              type="button"
              onClick={() => openModal('vip')}
              className="flex flex-col items-center group transition-transform active:scale-95 cursor-pointer"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <Gem className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5">VIP</span>
            </button>

            {/* Support */}
            <button
              type="button"
              onClick={() => openModal('support')}
              className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5">Support</span>
            </button>

            {/* Guide */}
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <FileQuestion className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5">Guide</span>
            </button>
          </div>
        </div>

        {/* Dedicated Official Gift Card Voucher Banner Strip in Account */}
        <div className="mt-2.5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-orange-950/40 border border-amber-500/30 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-sm">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-white flex items-center gap-1.5">
                <span>Gift Card & Promo Center</span>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full font-bold">Voucher</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Redeemed Codes: <strong className="text-amber-300 font-mono">{user?.redeemedCodes?.length || 0}</strong> • Instant Cash Bonus
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openRewardsModal('giftcard')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-[11px] font-black shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Redeem Code
          </button>
        </div>

        {/* Quick App Download Banner Strip */}
        <div
          onClick={() => openModal('download')}
          className="mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-teal-600/10 border border-blue-500/20 dark:border-blue-400/20 flex items-center justify-between cursor-pointer hover:bg-blue-500/15 transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <span>Nexa AI Official Mobile App</span>
                <span className="text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded">Fast</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Install on phone · Claim $1.00 App Bonus & zero lag
              </div>
            </div>
          </div>
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px] shadow-sm flex items-center gap-1 shrink-0 group-hover:bg-blue-700 transition-colors"
          >
            <span>Download</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* VIP Level Card (Amber/Orange luxury card - Matching Screenshot 7) */}
      <div className="px-4 mt-3">
        <div
          onClick={() => openModal('vip')}
          className="rounded-2xl p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 shadow-md cursor-pointer hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-slate-950" />
              <span className="text-sm font-black uppercase tracking-wide">VIP Level {currentLevel}</span>
            </div>
            <button
              type="button"
              className="px-3 py-1 rounded-xl bg-white/30 hover:bg-white/40 text-xs font-black transition-colors flex items-center gap-1"
            >
              <span>Upgrade</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress requirement */}
          <div className="mt-2.5">
            <div className="text-[11px] font-bold text-slate-950/90 mb-1">
              {nextTier ? `Upgrade to VIP${nextTier.level} needs $${neededMore.toFixed(2)} more` : 'Max VIP tier unlocked'}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-950/20 overflow-hidden">
              <div
                className="h-full bg-slate-950 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Refer & Earn Active Card */}
      <div className="px-4 mt-3">
        <div className="rounded-2xl p-4 bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 text-white shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  Refer & Earn
                </span>
                <span className="text-[10px] font-bold text-emerald-200">{totalCommissionRate}% Multi-Tier</span>
              </div>
              <h4 className="text-xs font-bold mt-1 text-emerald-100">My Invitation Code</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-black tracking-widest font-mono text-amber-300">
                  {user?.invitationCode || '4AB86'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                >
                  {copiedInvite ? <CheckCircle2 className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedInvite ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openModal('team')}
              className="px-3.5 py-2 rounded-xl bg-white text-teal-900 text-xs font-black hover:bg-white/90 shadow-md transition-all flex items-center gap-1.5 shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share & Team</span>
            </button>
          </div>

          {/* Stats Bar */}
          <div className="mt-3 pt-2 border-t border-white/20 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-white/70">Network: </span>
              <strong className="font-extrabold">{Math.max(user?.totalReferrals || 0, teamMembers.length)} Members</strong>
            </div>
            <div className="text-right">
              <span className="text-white/70">Commissions: </span>
              <strong className="font-extrabold text-amber-300">
                ${(teamMembers.length > 0 ? teamMembers.reduce((sum, m) => sum + (m.commissionContributed || 0), 0) : (Number(user?.totalCommissionEarned) || 0)).toFixed(2)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Application Service List (Matching Screenshot 8) */}
      <div className="px-4 mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1 h-3.5 bg-teal-700 rounded-full" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Application Service</h3>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
          {/* History */}
          <button
            type="button"
            onClick={() => openModal('balance')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-400 flex items-center justify-center font-black text-sm">
                <History className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-800 dark:text-slate-200">History</span>
                <span className="text-[10px] text-slate-400 block">Transaction details & financial records</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-[11px]">View</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* My Orders */}
          <button
            type="button"
            onClick={() => openModal('orders')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200">My Orders</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* VIP Level */}
          <button
            type="button"
            onClick={() => openModal('vip')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Gem className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200">VIP Level</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-amber-500">V{currentLevel}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          {/* My Team */}
          <button
            type="button"
            onClick={() => openModal('team')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200">My Team</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Help Center (Direct Redirect if Admin set a link, otherwise Support Modal) */}
          {primaryHelpUrl ? (
            <a
              href={primaryHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Help Center</span>
                  {activeHelpLinks[0]?.title && !platformSettings?.helpCenterUrl && (
                    <span className="text-[10px] text-slate-400 block">{activeHelpLinks[0].title}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <ExternalLink className="w-3.5 h-3.5 text-pink-500" />
                <ChevronRight className="w-4 h-4" />
              </div>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openModal('support')}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200">Help Center</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* Additional Custom Help Center Links Added by Admin */}
          {extraHelpLinks.map((link) => {
            const href = normalizeRedirectUrl(link.url);
            if (!href) return null;
            return (
              <a
                key={link.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {link.title || 'Help Center Support'}
                    </span>
                    {link.subtitle && (
                      <span className="text-[10px] text-slate-400 block">{link.subtitle}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <ExternalLink className="w-3.5 h-3.5 text-pink-500" />
                  <ChevronRight className="w-4 h-4" />
                </div>
              </a>
            );
          })}

          {/* Download Mobile App */}
          <button
            type="button"
            onClick={() => openModal('download')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-blue-700 dark:text-blue-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Download className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100">Download Mobile App</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded font-black">
                    Official App
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Install directly onto phone · $1.00 Bonus</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={logout}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="font-bold">Logout</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold">Edit Profile</h3>
              <button onClick={handleCloseEditModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveNickname} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Change Nickname
                </label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="Enter new nickname"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                <div className="text-slate-400">Mobile Number:</div>
                <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {user?.phone ? `+91 ${user.phone}` : '—'}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-700 text-white font-bold text-xs hover:bg-teal-800 transition-colors shadow-md"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rules / Guide Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold">Platform Guide & Rules</h3>
              <button onClick={() => setShowRulesModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <strong className="block text-slate-900 dark:text-slate-100 mb-1">1. Daily Revenue Generation</strong>
                Project returns are calculated daily according to the contract. Returns can be claimed directly into your Withdrawal Balance under "My Orders".
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <strong className="block text-slate-900 dark:text-slate-100 mb-1">2. Fast Withdrawals</strong>
                Minimum withdrawal amount is $2.00. Processing operates 7 days a week, with typical credit inside 15-30 minutes.
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <strong className="block text-slate-900 dark:text-slate-100 mb-1">3. Team Referral System</strong>
                Share your invitation code to earn {tier1Rate}% direct bonus from Tier 1 friends, {tier2Rate}% from Tier 2, and {tier3Rate}% from Tier 3.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Profile Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold">Nexa AI Smart Energy Systems</h3>
              <button onClick={() => setShowCompanyModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                Nexa AI Clean Energy Division is a global infrastructure leader dedicated to renewable energy transition, AI-driven clean power optimization, utility-scale hydrogen catalytic plants, and smart power grids.
              </p>
              <div className="grid grid-cols-2 gap-2 text-center pt-2">
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/50">
                  <div className="text-lg font-bold text-teal-700 dark:text-teal-300">2.4 GW</div>
                  <div className="text-[10px] text-slate-400">Total Clean Capacity</div>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/50">
                  <div className="text-lg font-bold text-teal-700 dark:text-teal-300">$580M</div>
                  <div className="text-[10px] text-slate-400">Assets Managed</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                Registration No: NEXA-IND-2026-ENG · Certified Clean Energy Sponsor & Tariff Guarantor.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
