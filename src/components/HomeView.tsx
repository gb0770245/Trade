import React, { useState, useEffect } from 'react';
import {
  Bell,
  Headphones,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Gift,
  TrendingUp,
  CreditCard,
  Wallet,
  Star,
  Truck,
  Package,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Hourglass,
  Crown,
  Calendar,
  Ticket,
  FileText,
  Users,
} from 'lucide-react';
import { useApp, normalizeRedirectUrl } from '../context/AppContext';
import { HomeBannerSlider } from './HomeBannerSlider';
import { InvestmentProduct } from '../types';
import { getOrderClaimStatus, formatCountdown } from '../utils/dividendUtils';

export const HomeView: React.FC = () => {
  const {
    user,
    openModal,
    openRewardsModal,
    dailyCheckIn,
    redeemGiftCode,
    setActiveTab,
    orders,
    claimDailyDividends,
    setIsAdminView,
    products,
    setSelectedProductForInvest,
    lookupReferrer,
    activeReferrer,
    platformSettings,
  } = useApp();

  const [homeQuickGiftCode, setHomeQuickGiftCode] = useState('');

  const primaryHelpUrl = normalizeRedirectUrl(
    platformSettings?.helpCenterUrl ||
      (platformSettings?.helpCenterLinks || []).find((l) => l.isActive !== false && l.url?.trim())?.url
  );

  const [activeCategory, setActiveCategory] = useState<'steady' | 'benefits' | 'event'>('steady');

  const detectedRef = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('ref') ||
       new URLSearchParams(window.location.search).get('invite') ||
       new URLSearchParams(window.location.search).get('code') ||
       localStorage.getItem('hd_referral_code'))
    : null;

  const [guestInviterName, setGuestInviterName] = useState<string>(
    activeReferrer?.name || (typeof window !== 'undefined' ? sessionStorage.getItem('hd_referral_inviter_name') || '' : '')
  );

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (detectedRef && !guestInviterName) {
      lookupReferrer(detectedRef).then((info) => {
        if (info && info.valid && info.name) {
          setGuestInviterName(info.name);
        }
      });
    }
  }, [detectedRef, guestInviterName, lookupReferrer]);
  const [isClaiming, setIsClaiming] = useState(false);

  // Live 1-second ticker for accurate 24-hour cooldown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeOrders = orders.filter((o) => o.status === 'active');
  const readyOrders = activeOrders.filter((o) => getOrderClaimStatus(o, now).canClaim);
  const readyPendingReturns = readyOrders.reduce((sum, o) => sum + o.dailyEarnings, 0);

  const waitingOrders = activeOrders.filter((o) => !getOrderClaimStatus(o, now).canClaim);
  const minWaitMs = waitingOrders.length > 0
    ? Math.min(...waitingOrders.map((o) => getOrderClaimStatus(o, now).remainingMs))
    : 0;

  const productList = products;
  const filteredProducts = productList.filter((p) => p.category === activeCategory);

  const handleDirectBuy = (product: InvestmentProduct) => {
    if (!user) {
      openModal('auth');
      return;
    }
    setSelectedProductForInvest(product);
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <header className="px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Nexa AI Logo"
            className="w-10 h-10 object-contain drop-shadow-md select-none shrink-0"
          />
          <div>
            <span className="text-base font-extrabold tracking-tight text-slate-800 dark:text-slate-100 block leading-none">
              Nexa AI
            </span>
            <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider block mt-0.5">
              Official Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('notice')}
            className="w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-teal-600 relative transition-colors shadow-sm"
            aria-label="Notices"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
          </button>

          {primaryHelpUrl ? (
            <a
              href={primaryHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors shadow-sm"
              aria-label="Customer Care"
            >
              <Headphones className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openModal('support')}
              className="w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors shadow-sm"
              aria-label="Customer Care"
            >
              <Headphones className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Referral Invited Banner for Guests */}
      {!user && detectedRef && (
        <div className="px-4 mb-2">
          <div
            onClick={() => openModal('auth')}
            className="p-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-700 text-white shadow-lg cursor-pointer flex items-center justify-between animate-in fade-in hover:brightness-105 transition-all border border-emerald-400/40"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black flex items-center gap-1.5 flex-wrap">
                  {guestInviterName ? (
                    <span>Aapko <span className="text-amber-300 underline decoration-amber-300 underline-offset-2">{guestInviterName}</span> ne invite kiya hai!</span>
                  ) : (
                    <span>Invitation Code Applied:</span>
                  )}
                  <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider">
                    {detectedRef.toUpperCase()}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-100 mt-0.5">
                  {guestInviterName ? `Sponsor: ${guestInviterName} • ` : ''}Click to register with sponsor benefits!
                </div>
              </div>
            </div>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-extrabold shadow hover:bg-amber-300 shrink-0 ml-2"
            >
              Sign Up
            </button>
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="px-4 mt-1">
        <div className="rounded-3xl bg-gradient-to-b from-teal-800 via-teal-700 to-teal-900 text-white p-4 shadow-xl relative overflow-hidden">
          {/* Dynamic Interactive Banner Slider (Admin Configurable) */}
          <HomeBannerSlider />

          {/* 3 Wallets Strip (Charged, Withdrawal, Product Revenue) */}
          <div className="mt-4 p-3 rounded-2xl bg-teal-900/60 backdrop-blur-md border border-teal-600/40 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-base font-extrabold text-white num-tabular">
                ${(user?.rechargeBalance || 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-teal-200/80 mt-0.5">Charged Balance</div>
            </div>

            <div className="border-x border-teal-700/50">
              <div className="text-base font-extrabold text-emerald-300 num-tabular">
                ${(user?.withdrawalBalance || 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-teal-200/80 mt-0.5">Withdrawal Balance</div>
            </div>

            <div>
              <div className="text-base font-extrabold text-white num-tabular">
                ${(user?.productRevenue || 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-teal-200/80 mt-0.5">Product Revenue</div>
            </div>
          </div>

          {/* Daily Returns Claim Shortcut Banner if active orders exist */}
          {activeOrders.length > 0 && (
            <div
              className={`mt-3 p-3 rounded-2xl border flex items-center justify-between transition-all ${
                readyOrders.length > 0
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border-emerald-400/50 shadow-md'
                  : 'bg-black/25 border-teal-600/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {readyOrders.length > 0 ? (
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
                ) : (
                  <Hourglass className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div className="text-left">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <span>
                      {readyOrders.length > 0 ? 'Daily Dividend Ready' : '24h Dividend Cooldown'}
                    </span>
                    {readyOrders.length > 0 && (
                      <span className="text-[9px] bg-emerald-400/20 text-emerald-300 font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                        {readyOrders.length} Ready
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-emerald-200 num-tabular">
                    {readyOrders.length > 0 ? (
                      `+$${readyPendingReturns.toFixed(2)} available now`
                    ) : (
                      <span className="font-mono text-amber-300">
                        Next return unlocks in {formatCountdown(minWaitMs)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {readyOrders.length > 0 ? (
                <button
                  type="button"
                  onClick={async () => {
                    setIsClaiming(true);
                    await claimDailyDividends();
                    setIsClaiming(false);
                  }}
                  disabled={isClaiming}
                  className="px-3.5 py-1.5 rounded-xl bg-white text-teal-900 font-extrabold text-xs shadow hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isClaiming ? 'Claiming...' : 'Claim Now'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openModal('orders')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-100 font-mono text-[11px] flex items-center gap-1 transition-all"
                  title="View Contract Timers"
                >
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{formatCountdown(minWaitMs)}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Buttons Grid (8 Core Feature Icons in 2 Rows) */}
      <div className="px-4 mt-3">
        {/* Core Financial & Platform Quick Actions (4x2 Grid) */}
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1 */}
          <button
            type="button"
            onClick={() => openModal('recharge')}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Add Money</span>
          </button>

          <button
            type="button"
            onClick={() => openModal('withdraw')}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Withdraw</span>
          </button>

          <button
            type="button"
            onClick={() => openRewardsModal('giftcard')}
            className="p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-500/30 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 relative cursor-pointer"
          >
            <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-black text-[8px] px-1.5 py-0.2 rounded-full uppercase shadow-sm">
              Bonus
            </span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-sm">
              <Gift className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Gift Card</span>
          </button>

          <button
            type="button"
            onClick={() => openModal('orders')}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">My Orders</span>
          </button>

          {/* Row 2 */}
          <button
            type="button"
            onClick={() => openModal('vip')}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">VIP Plans</span>
          </button>

          <button
            type="button"
            onClick={() => openModal('team')}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              Invite {platformSettings?.tier1Commission ?? 10}%
            </span>
          </button>

          <button
            type="button"
            onClick={() => openModal('support')}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Help Desk</span>
          </button>

          <button
            type="button"
            onClick={() => openModal('download')}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Get App</span>
          </button>
        </div>

        {/* Dedicated Official Gift Card & Promo Voucher Zone */}
        <div className="mt-3">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-orange-950/40 border border-amber-500/30 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-md shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">Gift Card & Voucher Center</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase font-bold">
                      Instant Bonus
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Redeem promo codes & vouchers directly into your wallet balance
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openRewardsModal('giftcard')}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow transition-all active:scale-95 cursor-pointer shrink-0"
              >
                Gift Center
              </button>
            </div>

            {/* Fast Gift Card Redeem Strip */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2">
              <div className="relative flex-1">
                <Gift className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={homeQuickGiftCode}
                  onChange={(e) => setHomeQuickGiftCode(e.target.value.toUpperCase().trim())}
                  placeholder="Enter Gift Card Code (e.g. WELCOME50)"
                  className="w-full pl-8 pr-2 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono text-xs uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!homeQuickGiftCode.trim()) {
                    openRewardsModal('giftcard');
                    return;
                  }
                  await redeemGiftCode(homeQuickGiftCode);
                  setHomeQuickGiftCode('');
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow shrink-0 active:scale-95 cursor-pointer"
              >
                {homeQuickGiftCode.trim() ? 'Claim Bonus' : 'Open'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Performance Feature - Direct Buy & Investment Section */}
      <div className="px-4 mt-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-teal-700 rounded-full" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                Asset Performance & Store
              </span>
              <span className="text-[9px] bg-teal-600 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Direct Buy
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('invest')}
            className="text-[11px] text-teal-700 dark:text-teal-400 font-bold hover:underline flex items-center gap-0.5"
          >
            <span>Full Store</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Switcher Tabs */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mb-3 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveCategory('steady')}
            className={`flex-1 py-2 text-xs rounded-xl font-bold transition-all ${
              activeCategory === 'steady'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Steady Commercial
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('benefits')}
            className={`flex-1 py-2 text-xs rounded-xl font-bold transition-all ${
              activeCategory === 'benefits'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Express Modular
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('event')}
            className={`flex-1 py-2 text-xs rounded-xl font-bold transition-all relative ${
              activeCategory === 'event'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Flagship Grid</span>
            <span className="absolute -top-1 -right-1 text-[9px] bg-rose-500 text-white px-1.5 py-0.2 rounded-full font-bold shadow-sm">
              HOT
            </span>
          </button>
        </div>

        {/* Live Product Cards List */}
        <div className="space-y-3.5">
          {filteredProducts.map((product) => {
            const retailTitle = product.retailName || product.name;
            const sku = product.sku || `NEXA-${product.id.toUpperCase().slice(0, 10)}`;
            const mrp = product.mrp || Math.round(product.price * 1.25);
            const discountPct = Math.round(((mrp - product.price) / mrp) * 100);

            return (
              <div
                key={product.id}
                className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* Product Header Image */}
                <div className="relative h-44 bg-slate-900 overflow-hidden">
                  <img
                    src={product.image}
                    alt={retailTitle}
                    className="w-full h-full object-cover brightness-95 hover:scale-105 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* SKU Badge */}
                  <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/20 text-white font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-lg shadow-md">
                    {sku}
                  </span>

                  {/* Warranty Badge */}
                  <span className="absolute top-3 right-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-lg shadow-md flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{product.warranty || '3 Yrs Warranty'}</span>
                  </span>

                  {/* Overlay Ratings & Stock */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-amber-300 font-bold">
                      <Star className="w-3 h-3 fill-amber-300" />
                      <span>{product.rating || 4.9}</span>
                      <span className="text-[10px] text-slate-300 font-normal">
                        ({product.reviewCount || 128} reviews)
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      In Stock • Ready to Dispatch
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {retailTitle}
                  </h3>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>

                  {/* Price & Discount Bar */}
                  <div className="flex items-baseline gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-lg font-black text-teal-700 dark:text-teal-400 num-tabular">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 line-through num-tabular">
                      MRP ${mrp.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {discountPct}% OFF
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      GST 18% Included
                    </span>
                  </div>

                  {/* Asset Performance Yield Highlight Box */}
                  {(() => {
                    const dailyPct =
                      product.dailyPercent !== undefined
                        ? product.dailyPercent
                        : product.price > 0
                        ? Number(((product.dailyEarnings / product.price) * 100).toFixed(1))
                        : 50;
                    return (
                      <div className="mt-2.5 p-2.5 rounded-2xl bg-gradient-to-r from-teal-50/70 via-emerald-50/60 to-slate-50/70 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-slate-900/40 border border-teal-200/50 dark:border-teal-800/40 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            Daily Return (Yield):
                          </span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 num-tabular">
                            +${product.dailyEarnings.toFixed(2)} / Day ({dailyPct}% Return)
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-teal-200/40 dark:border-teal-800/30 text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            Cycle: {product.cycleDays} Days
                          </span>
                          <span className="font-extrabold text-teal-700 dark:text-teal-300 num-tabular">
                            Total: ${product.totalRevenue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Direct Buy & Invest CTA Button */}
                  <button
                    type="button"
                    onClick={() => handleDirectBuy(product)}
                    className="w-full mt-3 py-3 rounded-xl font-bold text-white text-xs uppercase tracking-wider bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 transition-all shadow-md shadow-teal-700/25 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Direct Buy • ${product.price.toFixed(2)}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating 24/7 Support Trigger Button */}
      {primaryHelpUrl ? (
        <a
          href={primaryHelpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-500 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
          aria-label="24/7 Live Support"
        >
          <Headphones className="w-6 h-6" />
        </a>
      ) : (
        <button
          type="button"
          onClick={() => openModal('support')}
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-500 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
          aria-label="24/7 Live Support"
        >
          <Headphones className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
