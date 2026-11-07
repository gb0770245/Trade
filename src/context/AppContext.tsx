import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { User, InvestmentProduct, InvestmentOrder, Transaction, TeamMember, ThemeMode, PlatformSettings, NoticeItem, CustomPromoCode, SpinPrizeConfig, ShippingAddress, EcommerceOrder, HomeBanner, ReferrerInfo } from '../types';
import { INITIAL_NOTICES, INVESTMENT_PRODUCTS, SPIN_PRIZES, DEFAULT_HOME_BANNERS } from '../data/mockData';
import { dbService, getTransactionTime, mergeUserSafe } from '../services/dbService';
import { getOrderClaimStatus, formatCountdownHuman } from '../utils/dividendUtils';

interface SupportMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

export interface PaymentFailedInfo {
  reason?: string;
  amountUsd?: number;
  amountInr?: number;
  productName?: string;
  onRetry?: () => void;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  deviceMode: 'mobile-frame' | 'expanded-desktop';
  setDeviceMode: (m: 'mobile-frame' | 'expanded-desktop') => void;
  activeTab: 'home' | 'invest' | 'notice' | 'blog' | 'account';
  setActiveTab: (t: 'home' | 'invest' | 'notice' | 'blog' | 'account') => void;
  goBack: () => void;
  
  // Auth
  login: (phone: string, password?: string) => Promise<boolean>;
  register: (phone: string, password: string, nickname: string, inviteCode: string) => Promise<boolean>;
  resetUserPassword: (phone: string, newPass: string) => Promise<boolean>;
  logout: () => void;
  updateNickname: (name: string) => void;
  saveBankDetails: (details: NonNullable<User['bankDetails']>) => void;

  // Referral Lookup & Details
  lookupReferrer: (code: string) => Promise<ReferrerInfo | null>;
  activeReferrer: ReferrerInfo | null;

  // Financial actions
  recharge: (amount: number, method: string, referenceNo?: string) => Promise<{ success: boolean; message: string }>;
  submitManualRecharge: (amount: number, utrNumber: string, screenshotUrl?: string) => Promise<{ success: boolean; message: string }>;
  withdraw: (amount: number, details: NonNullable<User['bankDetails']>) => Promise<{ success: boolean; message: string }>;
  investInProduct: (product: InvestmentProduct) => Promise<{ success: boolean; message: string }>;
  claimDailyDividends: (targetOrderId?: string) => Promise<{ success: boolean; claimedAmount: number }>;
  dailyCheckIn: () => Promise<{ success: boolean; bonus: number; message: string }>;
  spinWheelPrize: (prizeLabel: string, prizeValue: number, type: string) => Promise<{ success: boolean; message: string }>;
  redeemGiftCode: (code: string) => Promise<{ success: boolean; amount: number; message: string }>;

  // Orders and Transactions
  orders: InvestmentOrder[];
  refreshOrders: () => Promise<InvestmentOrder[]>;
  transactions: Transaction[];
  teamMembers: TeamMember[];
  refreshTeamMembers: () => Promise<TeamMember[]>;
  
  // E-Commerce Orders
  ecommerceOrders: EcommerceOrder[];
  createEcommerceOrder: (product: InvestmentProduct, address: ShippingAddress, paymentId: string) => Promise<{ success: boolean; order: EcommerceOrder }>;
  selectedProductForCheckout: InvestmentProduct | null;
  setSelectedProductForCheckout: (p: InvestmentProduct | null) => void;

  // Modals
  activeModal: 'recharge' | 'withdraw' | 'spin' | 'support' | 'orders' | 'team' | 'vip' | 'balance' | 'rewards' | 'auth' | 'download' | 'policies' | null;
  openModal: (modal: 'recharge' | 'withdraw' | 'spin' | 'support' | 'orders' | 'team' | 'vip' | 'balance' | 'rewards' | 'auth' | 'download' | 'policies') => void;
  closeModal: () => void;
  rewardsModalTab: 'checkin' | 'giftcard';
  setRewardsModalTab: (tab: 'checkin' | 'giftcard') => void;
  openRewardsModal: (tab?: 'checkin' | 'giftcard') => void;
  selectedProductForInvest: InvestmentProduct | null;
  setSelectedProductForInvest: (p: InvestmentProduct | null) => void;

  // Dedicated Payment Failed Modal
  paymentFailedData: PaymentFailedInfo | null;
  showPaymentFailedModal: (info: PaymentFailedInfo) => void;
  closePaymentFailedModal: () => void;

  // Support Chat
  supportMessages: SupportMessage[];
  sendSupportMessage: (text: string) => void;
  isSupportTyping: boolean;

  // Database sync state
  isCloudSynced: boolean;

  // Admin Console View State
  isAdminView: boolean;
  setIsAdminView: (val: boolean) => void;

  // Platform & Financial Settings
  platformSettings: PlatformSettings;
  updatePlatformSettings: (settings: Partial<PlatformSettings>) => Promise<void>;

  // Products
  products: InvestmentProduct[];
  addProduct: (product: InvestmentProduct) => Promise<void>;
  updateProduct: (product: InvestmentProduct) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;

  // Notices
  notices: NoticeItem[];
  addNotice: (notice: NoticeItem) => Promise<void>;
  deleteNotice: (noticeId: string) => Promise<void>;

  // Promo Codes
  promoCodes: CustomPromoCode[];
  addPromoCode: (promo: CustomPromoCode) => Promise<void>;
  deletePromoCode: (codeId: string, code?: string) => Promise<void>;

  // Admin Users & Balances
  adminUsers: User[];
  loadAdminUsers: () => Promise<void>;
  adminCreateUser: (newUserData: Partial<User>) => Promise<{ success: boolean; message: string; user?: User }>;
  adminUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
  adminDeleteUser: (userId: string, userPhone?: string) => Promise<void>;
  adminManualBalanceAdjust: (
    userId: string,
    wallet: 'rechargeBalance' | 'withdrawalBalance' | 'productRevenue',
    amount: number,
    type: 'add' | 'deduct',
    note: string
  ) => Promise<void>;

  // Admin Transactions
  adminTransactions: Transaction[];
  loadAdminTransactions: () => Promise<void>;
  adminApproveRecharge: (txId: string, userId: string, amount: number) => Promise<void>;
  adminRejectRecharge: (txId: string, reason?: string) => Promise<void>;
  adminApproveWithdrawal: (txId: string, referenceNo?: string) => Promise<void>;
  adminRejectWithdrawal: (txId: string, userId: string, amount: number, reason?: string) => Promise<void>;

  // Admin Investment Orders Control Center
  adminOrders: InvestmentOrder[];
  loadAdminOrders: () => Promise<void>;
  adminApproveOrder: (orderId: string) => Promise<void>;
  adminPauseOrder: (orderId: string, reason?: string) => Promise<void>;
  adminResumeOrder: (orderId: string) => Promise<void>;
  adminCancelOrder: (orderId: string, refundAmount?: number, refundWallet?: 'rechargeBalance' | 'withdrawalBalance', reason?: string) => Promise<void>;
  adminPayoutOrderDividend: (orderId: string, customEarnings?: number) => Promise<void>;
  adminResetOrderTimer: (orderId: string) => Promise<void>;
  adminUpdateOrder: (orderId: string, updates: Partial<InvestmentOrder>) => Promise<void>;
  adminDeleteOrder: (orderId: string) => Promise<void>;

  // Lucky Spin Methods
  getAvailableSpins: (user: User) => { total: number; dailyRemaining: number; bonusSpins: number };
  buyExtraSpinWithBalance: () => Promise<{ success: boolean; message: string }>;
  adminGrantExtraSpins: (userId: string, count: number, reason?: string) => Promise<void>;
  updateSpinPrizes: (prizes: SpinPrizeConfig[]) => Promise<void>;

  // Notification Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'hd_energy_user_v2';
const STORAGE_KEY_ORDERS = 'hd_energy_orders_v2';
const STORAGE_KEY_TXS = 'hd_energy_txs_v2';
const STORAGE_KEY_THEME = 'hd_energy_theme_v2';

const DEFAULT_USER: User = {
  id: '833863',
  phone: '7307112738',
  password: 'password123',
  nickname: 'gaurav',
  avatar: 'HD',
  invitationCode: '4AB86',
  rechargeBalance: 1100.0,
  withdrawalBalance: 207.0,
  productRevenue: 0.0,
  vipLevel: 1,
  totalInvested: 280.0,
  checkInStreak: 2,
  lastCheckInDate: '2026-10-30',
  spinChances: 4,
  role: 'admin',
  status: 'active',
  totalReferrals: 2,
  totalCommissionEarned: 28,
};

const INITIAL_ORDERS: InvestmentOrder[] = [];
const INITIAL_TXS: Transaction[] = [];
const INITIAL_TEAM: TeamMember[] = [];

export const deduplicateTransactions = (txs: Transaction[]): Transaction[] => {
  const map = new Map<string, Transaction>();
  const seenRefs = new Map<string, string>();

  for (const t of txs) {
    if (!t) continue;
    const id = String(t.id || (t as any)._id || `tx-${t.createdAt || Date.now()}`);
    const ref = t.referenceNo ? String(t.referenceNo).trim() : '';

    if (ref && seenRefs.has(ref)) {
      const targetId = seenRefs.get(ref)!;
      const existing = map.get(targetId);
      map.set(targetId, { ...(existing || {}), ...t, id: targetId });
      continue;
    }

    if (map.has(id)) {
      const existing = map.get(id);
      map.set(id, { ...(existing || {}), ...t, id });
      if (ref) seenRefs.set(ref, id);
      continue;
    }

    map.set(id, { ...t, id });
    if (ref) seenRefs.set(ref, id);
  }

  return Array.from(map.values()).sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
};

export const deduplicateOrders = (ordersList: InvestmentOrder[]): InvestmentOrder[] => {
  const map = new Map<string, InvestmentOrder>();
  for (const o of ordersList) {
    if (!o || !o.id) continue;
    const id = String(o.id);
    if (!map.has(id)) {
      map.set(id, o);
    } else {
      const existing = map.get(id)!;
      map.set(id, {
        ...existing,
        ...o,
        totalAccrued: Math.max(Number(existing.totalAccrued || 0), Number(o.totalAccrued || 0)),
        daysElapsed: Math.max(Number(existing.daysElapsed || 0), Number(o.daysElapsed || 0)),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.purchaseTimestamp || (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0) || 0;
    const timeB = b.purchaseTimestamp || (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0) || 0;
    return timeB - timeA;
  });
};

export const prependTxUnique = (prev: Transaction[], newTx: Transaction): Transaction[] => {
  const map = new Map<string, Transaction>();
  const seenRefs = new Set<string>();

  const newId = String(newTx.id || `tx-${Date.now()}`);
  const newRef = newTx.referenceNo ? String(newTx.referenceNo).trim() : '';
  map.set(newId, { ...newTx, id: newId });
  if (newRef) seenRefs.add(newRef);

  for (const t of prev) {
    if (!t) continue;
    const id = String(t.id || `tx-${t.createdAt || Math.random()}`);
    const ref = t.referenceNo ? String(t.referenceNo).trim() : '';

    if (ref && seenRefs.has(ref)) continue;
    if (map.has(id)) continue;

    map.set(id, { ...t, id });
    if (ref) seenRefs.add(ref);
  }
  return Array.from(map.values());
};

export const normalizeRedirectUrl = (rawUrl?: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|tg:\/\/|whatsapp:\/\/|mailto:|tel:|\/)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const triggerExternalRedirect = (rawUrl?: string): boolean => {
  const finalUrl = normalizeRedirectUrl(rawUrl);
  if (!finalUrl || typeof document === 'undefined') return false;
  const anchor = document.createElement('a');
  anchor.href = finalUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      // Cleanse any legacy R34VZ / EYAYY dummy reference in localStorage
      try {
        const rawBackup = localStorage.getItem('nexa_users_backup_v2');
        if (rawBackup && (rawBackup.includes('R34VZ') || rawBackup.includes('852539') || rawBackup.includes('EYAYY'))) {
          const cleansed = rawBackup
            .replace(/"invitedBy":\s*"R34VZ"/g, '"invitedBy":"J9Y79"')
            .replace(/"inviterId":\s*"852539"/g, '"inviterId":"325697"')
            .replace(/"inviterName":\s*"RaviSahu"/g, '"inviterName":"Ravi Sahu"')
            .replace(/"invitedBy":\s*"EYAYY"/g, '"invitedBy":"AAWFK"')
            .replace(/"inviterName":\s*"Anshusahu"/g, '"inviterName":"Anshusahu"')
            .replace(/"inviterId":\s*"EYAYY"/g, '"inviterId":"406332"');
          localStorage.setItem('nexa_users_backup_v2', cleansed);
        }
      } catch {}

      // 1. Check if an authenticated user session is already saved in localStorage
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.id || parsed.phone)) {
            let modified = false;
            if (
              parsed.invitedBy === 'R34VZ' ||
              parsed.inviterId === '852539' ||
              (parsed.inviterName && String(parsed.inviterName).trim().toLowerCase() === 'ravisahu')
            ) {
              parsed.invitedBy = 'J9Y79';
              parsed.inviterName = 'Ravi Sahu';
              parsed.inviterId = '325697';
              modified = true;
            }
            if (
              parsed.invitedBy === 'EYAYY' ||
              (parsed.inviterName && String(parsed.inviterName).trim().toLowerCase().includes('anshu') && (parsed.inviterId === '406332' || !parsed.inviterId))
            ) {
              parsed.invitedBy = 'AAWFK';
              parsed.inviterName = 'Anshusahu';
              parsed.inviterId = '406332';
              modified = true;
            }
            if (modified) {
              try {
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(parsed));
              } catch {}
            }
            return parsed;
          }
        } catch {}
      }

      // 2. If no existing user session, capture any referral code in the URL for registration
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = window.location.hash.includes('?')
        ? new URLSearchParams(window.location.hash.split('?')[1])
        : null;
      const refCode =
        searchParams.get('ref') ||
        searchParams.get('invite') ||
        searchParams.get('code') ||
        searchParams.get('invitationCode') ||
        searchParams.get('referral') ||
        hashParams?.get('ref') ||
        hashParams?.get('invite') ||
        hashParams?.get('code') ||
        hashParams?.get('invitationCode') ||
        hashParams?.get('referral');

      if (refCode && refCode.trim()) {
        try {
          localStorage.setItem('hd_referral_code', refCode.trim().toUpperCase());
        } catch {}
      }
    }
    return null;
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    return (saved as ThemeMode) || 'teal-clean';
  });

  const [deviceMode, setDeviceMode] = useState<'mobile-frame' | 'expanded-desktop'>('mobile-frame');
  const [activeTab, setActiveTabState] = useState<'home' | 'invest' | 'notice' | 'blog' | 'account'>('home');
  const [activeModal, setActiveModalState] = useState<AppContextType['activeModal']>(null);
  const [paymentFailedData, setPaymentFailedData] = useState<PaymentFailedInfo | null>(null);
  const [rewardsModalTab, setRewardsModalTab] = useState<'checkin' | 'giftcard'>('checkin');
  const [selectedProductForInvest, setSelectedProductForInvestState] = useState<InvestmentProduct | null>(null);
  const [selectedProductForCheckout, setSelectedProductForCheckout] = useState<InvestmentProduct | null>(null);
  const [ecommerceOrders, setEcommerceOrders] = useState<EcommerceOrder[]>(() => {
    const saved = localStorage.getItem('hd_ecommerce_orders_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  const [orders, setOrders] = useState<InvestmentOrder[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TXS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return [...parsed].sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
        }
      } catch { return []; }
    }
    return [];
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeReferrer, setActiveReferrer] = useState<ReferrerInfo | null>(null);
  const [toast, setToast] = useState<AppContextType['toast']>(null);

  const lookupReferrer = useCallback(async (code: string): Promise<ReferrerInfo | null> => {
    if (!code || !code.trim()) return null;
    try {
      const info = await dbService.getReferrerInfo(code.trim().toUpperCase());
      if (info && info.valid) {
        setActiveReferrer(info);
      }
      return info;
    } catch (e) {
      console.warn('Error looking up referrer:', e);
      return null;
    }
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([
    {
      id: 'msg-1',
      sender: 'agent',
      text: 'Namaste! Welcome to Nexa AI Official Support. How can we assist you with Add Money, Withdrawal, or VIP Investments today?',
      timestamp: 'Just now',
    },
  ]);
  const [isSupportTyping, setIsSupportTyping] = useState(false);

  const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
    merchantUpiId: 'nexaai.pay@icici',
    merchantPayeeName: 'Nexa AI Technologies',
    merchantQrUrl: '',
    isManualUpiEnabled: true,
    autoDynamicQrEnabled: true,
    manualDepositInstructions: '1. Scan this Dynamic QR using PhonePe, Google Pay, Paytm or any UPI App.\n2. Pay the EXACT amount shown on screen.\n3. Enter the 12-digit UPI UTR / Reference number below and tap Submit.\n4. Admin will verify and credit your wallet within 1-5 minutes.',
    requireAdminRechargeApproval: true, // User request: strict admin verification before fund is added to wallet
    showUpiVpaDetails: false, // User request: hide UPI ID and intent buttons shown in screenshot
    minRecharge: 25,
    minWithdrawal: 2,
    withdrawalFeePercent: 5, // Configurable admin fee % (default 5%)
    isWithdrawalEnabled: true,
    isRechargeEnabled: true,
    isSpinEnabled: true,
    isBonusEnabled: true,
    tier1Commission: 10,
    tier2Commission: 3,
    tier3Commission: 1,
    dailyBonusBase: 50,
    smsGatewayActive: true,
    withdrawalNotice: 'Normal withdrawal service is operating 24/7 (Arrival time: 5-30 minutes).',
    rechargeNotice: 'Please copy UPI ID and transfer exact amount to add money with UTR reference.',
    adminPin: '8888',
    systemAnnouncement: 'Welcome to Nexa AI. 100% verified clean power investment dividend platform.',

    // 7-Day Daily Check-in Streak Payouts (Day 1 to Day 7 in INR)
    checkInPayouts: [10, 12, 15, 18, 22, 26, 30],
    checkInDay7ExtraSpin: true,

    // Lucky Spin Controls & Price
    dailyFreeSpins: 1,
    spinPrice: 50,
    isSpinPurchaseEnabled: true,
    dailyPrizeDistributionCap: 5000,
    totalPrizeDistributedToday: 0,
    lastDistributionResetDate: new Date().toISOString().split('T')[0],

    // Extra Lucky Spin Automation Triggers
    extraSpinOnRecharge: true,
    rechargeThresholdForSpin: 5, // +1 spin per $5 recharged
    extraSpinOnInvite: true,
    spinsPerInvite: 1, // +1 spin per active invite
    extraSpinOnInvestment: true,
    spinsPerInvestment: 1, // +1 spin per product
    extraSpinOnCheckIn: true,
    spinsPerCheckIn: 1, // +1 spin per checkin

    // Wheel Prizes
    spinPrizes: SPIN_PRIZES,

    // Dynamic Home Banners Carousel
    homeBanners: DEFAULT_HOME_BANNERS,
    bannerAutoPlaySpeedSeconds: 4,

    // Razorpay Gateway Settings
    isRazorpayEnabled: true,
    razorpayKeyId: 'rzp_live_TsxVeW7tusSgjp',
    razorpayKeySecret: 'SvNqYN6H09fU4mNSGqJeTG0V',
    razorpayWebhookSecret: 'nexa_ai_rzp_webhook_2026',
    razorpayMerchantName: 'Nexa AI',
    razorpayLogoUrl: '/logo.png',
    razorpayThemeColor: '#0f766e',

    // Razorpay E-Commerce Shopping & Compliance Settings
    isShoppingModeActive: true,
    storeName: 'Nexa AI Retail Store',
    companyLegalName: 'Nexa AI Technologies India Pvt Ltd',
    merchantAddress: 'Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016',
    supportEmail: 'care@nexa-ai.shop',
    supportPhone: '+91 7307112738',
    gstNumber: '07AABCH8821K1Z3',
    shippingDays: '3-5 Business Days Express Delivery Across India',

    // OTP & SMS Message Templates (Admin Configurable)
    registrationOtpTemplate: 'Dear user, your Nexa AI registration verification code is {OTP}. Valid for 5 minutes. Do not share with anyone.',
    forgotPasswordOtpTemplate: 'Your Nexa AI password reset code is {OTP}. Valid for 5 minutes. If not requested by you, please ignore this SMS.',
    smsGatewayProvider: 'apitxt',
    smsSenderId: 'NEXAAI',
    smsAuthKey: 'wSh_e0TCgFj24rsQv3NxX3FVrqYXFUl42bJb1eVNrss',
    customSmsWebhookUrl: '',
    otpValidityMinutes: 5,
    enableMasterOtp: false,
    requireAdminOrderApproval: false,
    isInvestmentEnabled: true,
    investmentDisabledNotice: 'Product investment contracts are currently under scheduled maintenance. Please check back shortly.',
    allowUserDividendClaims: true,
    helpCenterUrl: '',
    helpCenterLinks: [],
  };

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('nexa_platform_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_PLATFORM_SETTINGS, ...parsed };
          }
        }
      }
    } catch {}
    return DEFAULT_PLATFORM_SETTINGS;
  });

  interface HistoryState {
    applet: 'hd-energy';
    entryIndex: number;
    tab: 'home' | 'invest' | 'notice' | 'blog' | 'account';
    modal: AppContextType['activeModal'];
    isAdmin: boolean;
    productModalId?: string | null;
  }

  const entryIndexRef = useRef<number>(1);
  const isPoppingStateRef = useRef<boolean>(false);
  const lastExitPressRef = useRef<number>(0);
  const isWithdrawalLockRef = useRef<boolean>(false);
  const userRef = useRef<User | null>(user);
  const lastUserActionTimestampRef = useRef<number>(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const checkIsAdminPath = (): boolean => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    return path === '/admin' || path.startsWith('/admin/');
  };

  const [isAdminView, setIsAdminViewState] = useState<boolean>(() => checkIsAdminPath());

  const setActiveTab = useCallback((newTab: 'home' | 'invest' | 'notice' | 'blog' | 'account') => {
    setActiveTabState(newTab);

    if (isPoppingStateRef.current) return;
    if (newTab === activeTab && activeModal === null && !isAdminView) return;

    const nextIndex = entryIndexRef.current + 1;
    entryIndexRef.current = nextIndex;

    if (typeof window !== 'undefined') {
      window.history.pushState(
        {
          applet: 'hd-energy',
          entryIndex: nextIndex,
          tab: newTab,
          modal: null,
          isAdmin: false,
        },
        '',
        '/'
      );
    }

    if (isAdminView) setIsAdminViewState(false);
    if (activeModal) setActiveModalState(null);
    if (selectedProductForInvest) setSelectedProductForInvestState(null);
    if (typeof document !== 'undefined') {
      document.title = 'Nexa AI - Premium Earning Platform';
    }
  }, [activeTab, activeModal, isAdminView, selectedProductForInvest]);

  const openModal = useCallback((modal: NonNullable<AppContextType['activeModal']>) => {
    if (modal === 'support') {
      const activeLinks = (platformSettings.helpCenterLinks || []).filter(
        (l) => l.isActive !== false && l.url && l.url.trim()
      );
      const directUrl = normalizeRedirectUrl(
        platformSettings.helpCenterUrl || (activeLinks.length > 0 ? activeLinks[0].url : '')
      );
      if (directUrl) {
        triggerExternalRedirect(directUrl);
        return;
      }
    }

    setActiveModalState(modal);

    if (isPoppingStateRef.current) return;

    const nextIndex = entryIndexRef.current + 1;
    entryIndexRef.current = nextIndex;

    if (typeof window !== 'undefined') {
      window.history.pushState(
        {
          applet: 'hd-energy',
          entryIndex: nextIndex,
          tab: activeTab,
          modal: modal,
          isAdmin: false,
        },
        ''
      );
    }
  }, [activeTab, platformSettings.helpCenterUrl, platformSettings.helpCenterLinks]);

  const openRewardsModal = useCallback((tab: 'checkin' | 'giftcard' = 'checkin') => {
    setRewardsModalTab(tab);
    openModal('rewards');
  }, [openModal]);

  const closeModal = useCallback(() => {
    if (!activeModal) return;

    if (
      typeof window !== 'undefined' &&
      window.history.state?.applet === 'hd-energy' &&
      window.history.state?.modal
    ) {
      window.history.back();
    } else {
      setActiveModalState(null);
    }
  }, [activeModal]);

  const showPaymentFailedModal = useCallback((info: PaymentFailedInfo) => {
    setPaymentFailedData(info);
  }, []);

  const closePaymentFailedModal = useCallback(() => {
    setPaymentFailedData(null);
  }, []);

  const setIsAdminView = useCallback((val: boolean) => {
    setIsAdminViewState(val);

    if (typeof window !== 'undefined') {
      const targetPath = val ? '/admin' : '/';
      if (typeof document !== 'undefined') {
        document.title = val
          ? 'Nexa AI — Master Admin Console (/admin)'
          : 'Nexa AI - Premium Earning Platform';
      }

      if (isPoppingStateRef.current) return;

      if (!val && window.history.state?.isAdmin) {
        window.history.back();
      } else {
        const nextIndex = entryIndexRef.current + 1;
        entryIndexRef.current = nextIndex;

        window.history.pushState(
          {
            applet: 'hd-energy',
            entryIndex: nextIndex,
            tab: activeTab,
            modal: null,
            isAdmin: val,
          },
          '',
          targetPath
        );
      }
    }
  }, [activeTab]);

  const setSelectedProductForInvest = useCallback((product: InvestmentProduct | null) => {
    setSelectedProductForInvestState(product);

    if (isPoppingStateRef.current) return;

    if (typeof window !== 'undefined') {
      if (product) {
        const nextIndex = entryIndexRef.current + 1;
        entryIndexRef.current = nextIndex;

        window.history.pushState(
          {
            applet: 'hd-energy',
            entryIndex: nextIndex,
            tab: activeTab,
            modal: null,
            productModalId: product.id,
            isAdmin: false,
          },
          ''
        );
      } else if (window.history.state?.productModalId) {
        window.history.back();
      }
    }
  }, [activeTab]);

  const goBack = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (activeModal) {
      closeModal();
      return;
    }

    if (selectedProductForInvest) {
      setSelectedProductForInvest(null);
      return;
    }

    if (isAdminView) {
      setIsAdminView(false);
      return;
    }

    if (entryIndexRef.current > 1) {
      window.history.back();
    } else if (activeTab !== 'home') {
      setActiveTab('home');
    }
  }, [activeModal, closeModal, selectedProductForInvest, setSelectedProductForInvest, isAdminView, setIsAdminView, activeTab, setActiveTab]);

  // Synchronize browser history and popstate (handles back/forward navigation)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialIsAdmin = checkIsAdminPath();

    if (initialIsAdmin) {
      setIsAdminViewState(true);
      document.title = 'Nexa AI — Master Admin Console (/admin)';
    }

    const currentState = window.history.state as HistoryState | null;
    if (!currentState || currentState.applet !== 'hd-energy') {
      // Step 0: Base root exit guard
      window.history.replaceState(
        {
          applet: 'hd-energy',
          entryIndex: 0,
          tab: 'home',
          modal: null,
          isAdmin: false,
        },
        ''
      );

      // Step 1: Active application state
      window.history.pushState(
        {
          applet: 'hd-energy',
          entryIndex: 1,
          tab: activeTab,
          modal: null,
          isAdmin: initialIsAdmin,
        },
        '',
        initialIsAdmin
          ? '/admin'
          : (window.location.pathname + (window.location.search || ''))
      );
      entryIndexRef.current = 1;
    } else {
      entryIndexRef.current = currentState.entryIndex || 1;
      if (currentState.tab) setActiveTabState(currentState.tab);
      if (currentState.modal) setActiveModalState(currentState.modal);
      if (currentState.isAdmin !== undefined) setIsAdminViewState(currentState.isAdmin);
    }

    const handlePopState = (event: PopStateEvent) => {
      isPoppingStateRef.current = true;
      const state = event.state as HistoryState | null;

      if (state && state.applet === 'hd-energy') {
        // User reached base root (entryIndex: 0)
        if (state.entryIndex === 0) {
          const now = Date.now();
          if (now - lastExitPressRef.current < 2000) {
            // Double tap within 2 seconds: exit app
            isPoppingStateRef.current = false;
            window.history.back();
            return;
          } else {
            lastExitPressRef.current = now;
            showToast('Press back again to exit (Dubara back dabayein)', 'info');

            // Restore entry 1 so user remains in app safely
            window.history.pushState(
              {
                applet: 'hd-energy',
                entryIndex: 1,
                tab: 'home',
                modal: null,
                isAdmin: false,
              },
              '',
              '/'
            );
            entryIndexRef.current = 1;
            setActiveTabState('home');
            setActiveModalState(null);
            setIsAdminViewState(false);
            setSelectedProductForInvestState(null);
            document.title = 'Nexa AI - Premium Earning Platform';

            setTimeout(() => {
              isPoppingStateRef.current = false;
            }, 50);
            return;
          }
        }

        entryIndexRef.current = state.entryIndex;

        // Sync Admin view
        const targetIsAdmin = Boolean(state.isAdmin);
        setIsAdminViewState(targetIsAdmin);
        document.title = targetIsAdmin
          ? 'Nexa AI — Master Admin Console (/admin)'
          : 'Nexa AI - Premium Earning Platform';

        // Sync Modal
        setActiveModalState(state.modal || null);

        // Sync Product Modal
        if (!state.productModalId) {
          setSelectedProductForInvestState(null);
        }

        // Sync Tab
        if (state.tab) {
          setActiveTabState(state.tab);
        }
      } else {
        const isAdmin = checkIsAdminPath();
        setIsAdminViewState(isAdmin);
        setActiveModalState(null);
        setSelectedProductForInvestState(null);
      }

      setTimeout(() => {
        isPoppingStateRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [products, setProducts] = useState<InvestmentProduct[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('nexa_platform_products');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading cached products:', e);
    }
    return INVESTMENT_PRODUCTS;
  });
  const [notices, setNotices] = useState<NoticeItem[]>(INITIAL_NOTICES);
  const [promoCodes, setPromoCodes] = useState<CustomPromoCode[]>([
    {
      id: 'promo-1',
      code: 'MEGA2026',
      amount: 100,
      maxUses: 1000,
      usedCount: 42,
      isActive: true,
    },
    {
      id: 'promo-2',
      code: 'HDVIP50',
      amount: 50,
      maxUses: 500,
      usedCount: 88,
      isActive: true,
    },
  ]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [adminOrders, setAdminOrders] = useState<InvestmentOrder[]>([]);

  // Load platform settings, products, notices from Cloud on mount concurrently
  useEffect(() => {
    let isMounted = true;
    const loadPlatformData = async () => {
      try {
        const [cloudSettings, serverPlatformRes, cloudProducts, cloudNotices, cloudPromos, serverOtpRes] = await Promise.all([
          dbService.getPlatformSettings(),
          fetch('/api/platform-settings')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          dbService.getAllProducts(),
          dbService.getAllNotices(),
          dbService.getAllPromoCodes(),
          fetch('/api/admin/otp-settings')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        if (!isMounted) return;

        const serverPlatform = serverPlatformRes?.settings || {};
        const serverOtp = serverOtpRes?.settings || {};

        if (cloudSettings || serverPlatformRes?.settings || serverOtpRes?.settings) {
          setPlatformSettings((prev) => {
            const combined: PlatformSettings = {
              ...prev,
              ...serverPlatform,
              ...(cloudSettings || {}),
              ...serverOtp,
              spinPrizes:
                cloudSettings?.spinPrizes && cloudSettings.spinPrizes.length > 0
                  ? cloudSettings.spinPrizes
                  : prev.spinPrizes,
            };
            try {
              localStorage.setItem('nexa_platform_settings', JSON.stringify(combined));
            } catch (e) {}
            return combined;
          });
        }

        if (cloudProducts && cloudProducts.length > 0) {
          setProducts(cloudProducts);
          try {
            localStorage.setItem('nexa_platform_products', JSON.stringify(cloudProducts));
          } catch (e) {}
        }

        if (cloudNotices && cloudNotices.length > 0) {
          setNotices(cloudNotices);
        }

        if (cloudPromos && cloudPromos.length > 0) {
          setPromoCodes(cloudPromos);
        }
      } catch (e) {
        console.warn('Initial platform data load notice:', e);
      }
    };

    loadPlatformData();

    const unsubscribeProducts = dbService.subscribeToProducts((cloudProducts) => {
      if (cloudProducts && cloudProducts.length > 0 && isMounted) {
        setProducts(cloudProducts);
        try {
          localStorage.setItem('nexa_platform_products', JSON.stringify(cloudProducts));
        } catch (e) {}
      }
    });

    const unsubscribeSettings = dbService.subscribeToPlatformSettings(async (cloudSettings) => {
      if (cloudSettings && isMounted) {
        let latestServerOtp: any = {};
        try {
          const r = await fetch('/api/admin/otp-settings');
          if (r.ok) {
            const j = await r.json();
            if (j?.settings) latestServerOtp = j.settings;
          }
        } catch {}

        if (!isMounted) return;
        setPlatformSettings((prev) => ({
          ...prev,
          ...cloudSettings,
          ...latestServerOtp,
          spinPrizes:
            cloudSettings.spinPrizes && cloudSettings.spinPrizes.length > 0
              ? cloudSettings.spinPrizes
              : prev.spinPrizes,
          checkInPayouts:
            cloudSettings.checkInPayouts && cloudSettings.checkInPayouts.length === 7
              ? cloudSettings.checkInPayouts
              : (prev.checkInPayouts || [10, 12, 15, 18, 22, 26, 30]),
        }));
      }
    });

    const unsubscribePromos = dbService.subscribeToPromoCodes((cloudPromos) => {
      if (cloudPromos && isMounted) {
        setPromoCodes(cloudPromos);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeProducts();
      unsubscribeSettings();
      unsubscribePromos();
    };
  }, []);

  // Sync to Cloud Firestore on boot or user change in parallel
  useEffect(() => {
    if (!user || !user.id) {
      return;
    }

    let isMounted = true;
    const initCloud = async () => {
      try {
        const [cloudUser, cloudOrders, cloudTxs, cloudTeam] = await Promise.all([
          dbService.getUser(user.id),
          dbService.getOrders(user.id),
          dbService.getTransactions(user.id),
          dbService.getTeamMembersForUser(user.id),
        ]);

        if (!isMounted) return;

        if (cloudUser) {
          let needsUpdate = false;
          // Guarantee that every single user has their own unique referral code
          if (!cloudUser.invitationCode || cloudUser.invitationCode.trim() === '') {
            cloudUser.invitationCode = dbService.generateReferralCode();
            needsUpdate = true;
          }
          // If user was invited but inviter's name wasn't stored, backfill it
          if (cloudUser.invitedBy && !cloudUser.inviterName) {
            try {
              const upline = await dbService.findUserByInviteCode(cloudUser.invitedBy);
              if (upline?.nickname) {
                cloudUser.inviterName = upline.nickname;
                needsUpdate = true;
              }
            } catch (e) {}
          }
          if (needsUpdate) {
            await dbService.saveUser(cloudUser);
          }
          const merged = mergeUserSafe(userRef.current, cloudUser);
          if (userRef.current && Date.now() - lastUserActionTimestampRef.current < 6000) {
            merged.rechargeBalance = userRef.current.rechargeBalance;
            merged.withdrawalBalance = userRef.current.withdrawalBalance;
            merged.totalInvested = Math.max(userRef.current.totalInvested || 0, cloudUser.totalInvested || 0);
          }
          userRef.current = merged;
          setUser(merged);
          try {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(merged));
          } catch (e) {}
          setIsCloudSynced(true);
        } else {
          // Guarantee demo/new user has a personal referral code
          const initialUser = { ...user };
          if (!initialUser.invitationCode) {
            initialUser.invitationCode = dbService.generateReferralCode();
          }
          dbService.saveUser(initialUser).catch(() => {});
          setUser(initialUser);
          try {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(initialUser));
          } catch (e) {}
          setIsCloudSynced(true);
        }

        // Server-authoritative orders: strictly respect deleted orders and never auto-resurrect from localStorage
        const incomingOrders = Array.isArray(cloudOrders) ? cloudOrders : [];
        const deletedBlacklist = dbService.getDeletedOrderBlacklist();
        const cleanOrders = incomingOrders.filter((o) => {
          const strId = String(o?.id || '').trim().toLowerCase();
          return o && o.id && !deletedBlacklist.has(strId);
        });
        setOrders(cleanOrders);
        try {
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(cleanOrders));
        } catch (e) {}

        // Permanent SQL + Cloud transactions merging: never wipe existing transactions
        const incomingTxs = Array.isArray(cloudTxs) ? cloudTxs : [];
        setTransactions((prev) => {
          if (incomingTxs.length > 0) {
            const combined = deduplicateTransactions([...incomingTxs, ...prev]);
            try {
              localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(combined));
            } catch (e) {}
            return combined;
          }
          if (prev.length > 0) {
            return prev;
          }
          return [];
        });
        setTeamMembers(cloudTeam || []);
      } catch (err) {
        console.warn('Cloud sync error:', err);
      }
    };

    initCloud();

    // Subscribe to real-time user changes
    const unsubUser = dbService.subscribeToUser(user.id, (updated) => {
      if (isMounted && updated) {
        const merged: User = mergeUserSafe(userRef.current, updated);
        // If a local balance change happened within the last 6 seconds, protect local balance from stale network reversion
        if (userRef.current && Date.now() - lastUserActionTimestampRef.current < 6000) {
          merged.rechargeBalance = userRef.current.rechargeBalance;
          merged.withdrawalBalance = userRef.current.withdrawalBalance;
          merged.totalInvested = Math.max(userRef.current.totalInvested || 0, updated.totalInvested || 0);
        }
        userRef.current = merged;
        setUser(merged);
        try {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(merged));
        } catch (e) {}
        setIsCloudSynced(true);
      }
    });

    // Subscribe to real-time transaction updates (deposits, payouts, commissions, bonuses)
    const unsubTxs = dbService.subscribeToUserTransactions(user.id, (updatedTxs) => {
      if (isMounted && updatedTxs) {
        const sorted = [...updatedTxs].sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
        setTransactions(sorted);
        try {
          localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(sorted));
        } catch (e) {}
      }
    });

    // Subscribe to real-time order updates (investment yield contracts)
    const unsubOrders = dbService.subscribeToUserOrders(
      user.id,
      (updatedOrders) => {
        if (isMounted && Array.isArray(updatedOrders)) {
          setOrders(updatedOrders);
          try {
            localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updatedOrders));
          } catch (e) {}
        }
      },
      user.phone
    );

    return () => {
      isMounted = false;
      unsubUser();
      unsubTxs();
      unsubOrders();
    };
  }, [user?.id, user?.phone]);

  const refreshOrders = useCallback(async (): Promise<InvestmentOrder[]> => {
    if (!user?.id) return [];
    try {
      const freshOrders = await dbService.getOrders(user.id, user.phone);
      if (freshOrders && Array.isArray(freshOrders)) {
        setOrders(freshOrders);
        try {
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(freshOrders));
        } catch {}
        return freshOrders;
      }
      return [];
    } catch (err) {
      console.warn('Error refreshing user orders:', err);
      return [];
    }
  }, [user?.id, user?.phone]);

  const refreshTeamMembers = useCallback(async (): Promise<TeamMember[]> => {
    if (!user?.id) return [];
    try {
      // 1. Trigger server-side referral reconciliation & credit check
      await dbService.syncReferralStats(user.id);

      // 2. Fetch fresh team downlines and updated user wallet simultaneously
      const [freshTeam, freshUser] = await Promise.all([
        dbService.getTeamMembersForUser(user.id),
        dbService.getUser(user.id),
      ]);

      setTeamMembers(freshTeam);

      if (freshUser) {
        const merged = mergeUserSafe(userRef.current, freshUser);
        userRef.current = merged;
        setUser(merged);
        try {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(merged));
        } catch {}
      }

      return freshTeam;
    } catch (err) {
      console.warn('Error refreshing team members:', err);
      return [];
    }
  }, [user?.id]);

  // Listen for referral codes from URL query parameters (?ref=CODE, ?invite=CODE, ?code=CODE, ?invitationCode=CODE)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        let refCode =
          params.get('ref') ||
          params.get('invite') ||
          params.get('code') ||
          params.get('invitationCode') ||
          params.get('referral');

        if (!refCode && window.location.hash.includes('?')) {
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
          refCode =
            hashParams.get('ref') ||
            hashParams.get('invite') ||
            hashParams.get('code') ||
            hashParams.get('invitationCode') ||
            hashParams.get('referral');
        }

        if (refCode && refCode.trim()) {
          const cleanRef = refCode.trim().toUpperCase();
          localStorage.setItem('hd_referral_code', cleanRef);
          sessionStorage.setItem('hd_referral_code', cleanRef);
          console.log('[Referral Auto-Capture] Detected & Saved Invite Code:', cleanRef);

          // Clean URL so subsequent page reloads won't stay dirty with query params
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch {}

          // If no active session, look up inviter's name for registration preview
          const savedSession = localStorage.getItem(STORAGE_KEY_USER);
          if (!savedSession && !userRef.current) {
            dbService.getReferrerInfo(cleanRef).then((info) => {
              if (info && info.valid) {
                setActiveReferrer(info);
                sessionStorage.setItem('hd_referral_inviter_name', info.name);
              }
            });
          }
        }
      } catch (err) {
        console.error('Error capturing referral code:', err);
      }
    }
  }, []);

  // Sync state to LocalStorage reliably
  useEffect(() => {
    if (user && (user.id || user.phone)) {
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      } catch (e) {}
    }
  }, [user]);

  // Load & refresh permanent user profile and balance from Cloud SQL on initial load ONLY if user is already authenticated
  useEffect(() => {
    let isMounted = true;
    const restorePermanentUserData = async () => {
      try {
        // Only restore if user actually has an active session in state or localStorage!
        const savedRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_USER) : null;
        let savedId: string | null = null;
        if (savedRaw) {
          try {
            const p = JSON.parse(savedRaw);
            savedId = p?.id || p?.phone || null;
          } catch {}
        }

        const targetId = user?.id || user?.phone || savedId;
        if (!targetId) {
          // No user session active; do NOT auto-login as admin!
          loadAdminUsers();
          return;
        }

        const fresh =
          (await dbService.getUser(targetId)) ||
          (user?.phone ? await dbService.findUserByPhone(user.phone) : null);
        if (fresh && isMounted) {
          setUser(fresh);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fresh));
            localStorage.setItem('hd_last_phone', fresh.phone || '');
          }
          try {
            const [uOrders, uTxs, uTeam] = await Promise.all([
              dbService.getOrders(fresh.id),
              dbService.getTransactions(fresh.id),
              dbService.getTeamMembersForUser(fresh.id),
            ]);
            if (isMounted) {
              if (uOrders) {
                const delBlacklist = dbService.getDeletedOrderBlacklist();
                const cleanUOrders = uOrders.filter((o) => {
                  const strId = String(o?.id || '').trim().toLowerCase();
                  return o && o.id && !delBlacklist.has(strId);
                });
                setOrders(cleanUOrders);
                try {
                  localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(cleanUOrders));
                } catch (e) {}
              }
              if (uTxs && uTxs.length > 0) {
                setTransactions((prev) => deduplicateTransactions([...uTxs, ...prev]));
              }
              if (uTeam && uTeam.length > 0) {
                setTeamMembers(uTeam);
              }
            }
          } catch (loadErr) {
            console.warn('Silent data load error:', loadErr);
          }
        }
        // Always pre-populate admin users from Cloud SQL on mount so admin console has live users immediately
        loadAdminUsers();
      } catch (err) {
        console.warn('Permanent profile sync error:', err);
      }
    };
    restorePermanentUserData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (orders.length > 0 || !user) {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
      } catch (e) {}
    }
  }, [orders, user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(transactions));
  }, [transactions]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY_THEME, newTheme);
  };

  // Auth Functions
  const login = async (phone: string, password?: string): Promise<boolean> => {
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (!cleaned || cleaned.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number (कृपया 10 अंकों का मोबाइल नंबर दर्ज करें)', 'error');
      return false;
    }
    if (!password || password.trim().length === 0) {
      showToast('Password is mandatory. Please enter your password (पासवर्ड दर्ज करें)', 'error');
      return false;
    }
    if (password.trim().length < 6) {
      showToast('Password must be at least 6 characters (पासवर्ड कम से कम 6 अक्षरों का होना चाहिए)', 'error');
      return false;
    }

    const inputPassword = password.trim();

    // 1. Fetch user by phone from Firestore cloud database
    let cloudUser = await dbService.findUserByPhone(cleaned);

    // 2. Special seed check for default admin/demo phone (7307112738)
    if (!cloudUser && cleaned === '7307112738') {
      const seedUser: User = {
        ...DEFAULT_USER,
        phone: cleaned,
        password: DEFAULT_USER.password || 'password123',
      };
      await dbService.saveUser(seedUser);
      cloudUser = seedUser;
    }

    // 3. User does not exist in database: STRICTLY BLOCK LOGIN and inform user to sign up
    if (!cloudUser) {
      showToast(`Account not found for +91 ${cleaned}! Please sign up first. (खाता नहीं मिला, कृपया पहले साइन अप करें)`, 'error');
      return false;
    }

    // 4. Check if account is frozen or suspended
    if (cloudUser.status === 'frozen' || cloudUser.status === 'suspended') {
      showToast('Your account is currently frozen/suspended. Please contact customer support.', 'error');
      return false;
    }

    // 5. STRICT PASSWORD VERIFICATION: match exact password
    if (cloudUser.password) {
      if (cloudUser.password !== inputPassword) {
        showToast('Incorrect password! Please check and enter the correct password. (गलत पासवर्ड! कृपया सही पासवर्ड दर्ज करें)', 'error');
        return false;
      }
    } else {
      // Legacy user who registered prior to password field: secure account by setting this password
      cloudUser.password = inputPassword;
      await dbService.updateUser(cloudUser.id, { password: inputPassword });
    }

    // 6. Credentials fully matched! Log user in
    setUser(cloudUser);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(cloudUser));
        localStorage.setItem('hd_last_phone', cleaned);
        if (window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {}
    }

    // Load real user data immediately from Firestore
    try {
      const [uOrders, uTxs, uTeam] = await Promise.all([
        dbService.getOrders(cloudUser.id),
        dbService.getTransactions(cloudUser.id),
        dbService.getTeamMembersForUser(cloudUser.id),
      ]);
      setOrders(uOrders || []);
      setTransactions(uTxs || []);
      setTeamMembers(uTeam || []);
      setEcommerceOrders([]);
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(uOrders || []));
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(uTxs || []));
      localStorage.removeItem('hd_ecommerce_orders_v1');
    } catch (e) {
      console.warn('Error loading real user data on login:', e);
    }

    showToast(`Login successful! Welcome back, ${cloudUser.nickname}!`, 'success');
    closeModal();
    return true;
  };

  // Multi-tier referral commission distribution (Tier 1: 10%, Tier 2: 3%, Tier 3: 1%)
  // Server-authoritative: Dispatches exactly ONCE to SQLite SQL + Disk + PostgreSQL
  const distributeMultiTierCommissions = async (
    payer: User,
    amount: number,
    actionType: 'recharge' | 'investment' | 'daily_income',
    referenceId?: string
  ) => {
    if (!payer || amount <= 0) return;
    if (!payer.inviterId && !payer.invitedBy) return;

    try {
      // Trigger authoritative server-side commission distribution to SQLite, disk backup, and Cloud SQL ONCE
      await dbService.distributeCommissionOnServer(payer.id || payer.phone, amount, actionType, referenceId);

      // If the current user is an upliner, refresh their active profile from server
      if (user?.id) {
        try {
          const freshUser = await dbService.getUser(user.id);
          if (freshUser) {
            const merged = mergeUserSafe(userRef.current, freshUser);
            userRef.current = merged;
            setUser(merged);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(merged));
          }
        } catch {}
      }
    } catch (err) {
      console.error('Error in referral commission distribution:', err);
    }
  };

  const register = async (phone: string, password: string, nickname: string, inviteCode: string): Promise<boolean> => {
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (!cleaned || cleaned.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number (कृपया 10 अंकों का मोबाइल नंबर दर्ज करें)', 'error');
      return false;
    }
    const inputPassword = password.trim();
    if (!inputPassword || inputPassword.length < 6) {
      showToast('Password is mandatory and must be at least 6 characters (पासवर्ड कम से कम 6 अक्षरों का होना चाहिए)', 'error');
      return false;
    }
    if (!nickname || !nickname.trim()) {
      showToast('Nickname is mandatory. Please enter your nickname / name (नाम दर्ज करें)', 'error');
      return false;
    }
    if (!inviteCode || !inviteCode.trim()) {
      showToast('Invitation code is mandatory. Please enter a valid invite code (निमंत्रण कोड दर्ज करें)', 'error');
      return false;
    }

    // STRICT CHECK: Disallow duplicate registrations on same mobile number
    const existing = await dbService.findUserByPhone(cleaned);
    if (existing) {
      showToast(`Mobile +91 ${cleaned} is already registered! Please switch to Log in. (यह मोबाइल नंबर पहले से पंजीकृत है, कृपया लॉगिन करें)`, 'error');
      return false;
    }

    const cleanInvite = inviteCode.trim().toUpperCase();
    let inviterUser: User | null = null;
    if (cleanInvite) {
      inviterUser = await dbService.findUserByInviteCode(cleanInvite);
    }

    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    // Unique personal referral code generated for every single user
    const userInviteCode = dbService.generateReferralCode();

    const newUser: User = {
      id: newId,
      phone: cleaned,
      password: inputPassword, // STRICTLY PERSIST PASSWORD
      nickname: nickname.trim() || `Invest_${cleaned.slice(-4)}`,
      avatar: 'HD',
      invitationCode: userInviteCode,
      invitedBy: inviterUser ? inviterUser.invitationCode : (cleanInvite || undefined),
      inviterName: inviterUser ? inviterUser.nickname : undefined, // Name of the user whose referral code it is
      inviterId: inviterUser ? inviterUser.id : undefined,
      totalReferrals: 0,
      totalCommissionEarned: 0,
      rechargeBalance: 0.0, // REAL: 0.00 initial balance (User must work/deposit to get balance)
      withdrawalBalance: 0.0,
      productRevenue: 0.0,
      vipLevel: 0,
      totalInvested: 0.0,
      checkInStreak: 0,
      lastCheckInDate: null,
      spinChances: 0, // REAL: 0 spins until earned
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // Clear any previous deletion blacklist for this phone number so re-registration is completely active
    dbService.removeDeletedUserFromBlacklist(newId, cleaned);

    // Save permanently to Cloud SQL, disk backup, and Firestore
    await dbService.saveUser(newUser, true);
    setUser(newUser);
    setAdminUsers((prev) => {
      const filtered = prev.filter((u) => u.id !== newUser.id && u.phone !== newUser.phone);
      return [newUser, ...filtered];
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
        localStorage.setItem('hd_last_phone', cleaned);
        if (window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {}
    }

    // Clear stale orders/transactions/team for new account: must start strictly with real data
    setOrders([]);
    setTransactions([]);
    setTeamMembers([]);
    setEcommerceOrders([]);
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify([]));
    localStorage.removeItem('hd_ecommerce_orders_v1');

    // If inviter found, reward with lucky spins and increment referral count
    if (inviterUser) {
      const extraSpins = platformSettings.extraSpinOnInvite ? (platformSettings.spinsPerInvite || 1) : 0;
      inviterUser.spinChances = (inviterUser.spinChances || 0) + extraSpins;
      inviterUser.totalReferrals = (inviterUser.totalReferrals || 0) + 1;
      await dbService.saveUser(inviterUser);

      if (extraSpins > 0) {
        const inviterTx: Transaction = {
          id: `tx-inv-${Date.now()}`,
          userId: inviterUser.id,
          type: 'bonus',
          amount: 0,
          title: `Referral Joined: ${newUser.nickname} (+${extraSpins} Lucky Spin)`,
          timestamp: new Date().toLocaleString(),
          status: 'completed',
          referenceNo: `INV${newUser.id}`,
        };
        await dbService.saveTransaction(inviterTx, inviterUser.id);
      }
    }

    // Clear stored referral code after registering
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hd_referral_code');
    }

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });

    const inviteMsg = inviterUser ? ` (Invited by ${inviterUser.nickname})` : '';
    showToast(`Account created successfully! Welcome to Nexa AI, ${newUser.nickname}!${inviteMsg}`, 'success');
    closeModal();
    return true;
  };

  const resetUserPassword = async (phone: string, newPass: string): Promise<boolean> => {
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (!cleaned || cleaned.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return false;
    }
    const inputPassword = newPass.trim();
    if (!inputPassword || inputPassword.length < 6) {
      showToast('New password must be at least 6 characters long', 'error');
      return false;
    }

    const updated = await dbService.updateUserPasswordByPhone(cleaned, inputPassword);
    if (updated) {
      setAdminUsers((prev) =>
        prev.map((u) => (u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleaned ? { ...u, password: inputPassword } : u))
      );
      if (user && user.phone.replace(/\D/g, '').slice(-10) === cleaned) {
        setUser({ ...user, password: inputPassword });
      }
      showToast('Password updated successfully in database! Please log in.', 'success');
      return true;
    } else {
      showToast('No user account found with this phone number to reset.', 'error');
      return false;
    }
  };

  const logout = () => {
    // Permanently save user's latest full details before ending active session
    if (user) {
      dbService.saveUser(user, true).catch(() => {});
    }
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ORDERS);
    localStorage.removeItem(STORAGE_KEY_TXS);
    localStorage.removeItem('hd_ecommerce_orders_v1');
    setUser(null);
    setOrders([]);
    setTransactions([]);
    setTeamMembers([]);
    setEcommerceOrders([]);
    closeModal();
    showToast('Logged out successfully! Your full account details are permanently saved.', 'info');
    setActiveTab('home');
  };

  const updateNickname = async (name: string) => {
    if (!user) return;
    if (!name.trim()) return;
    const updated = { ...user, nickname: name.trim() };
    setUser(updated);
    setAdminUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    await dbService.saveUser(updated, true);
    showToast('Nickname saved permanently to Database!', 'success');
  };

  const saveBankDetails = async (details: NonNullable<User['bankDetails']>) => {
    if (!user) return;
    const cleanDetails = {
      accountHolder: (details.accountHolder || user.nickname || '').trim(),
      bankName: (details.bankName || 'Bank IMPS').trim(),
      accountNumber: (details.accountNumber || '').trim(),
      ifscCode: (details.ifscCode || '').trim().toUpperCase(),
      upiId: (details.upiId || '').trim(),
    };
    const updated = { ...user, bankDetails: cleanDetails };
    setUser(updated);
    setAdminUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    await dbService.saveUserBankDetails(user.id, user.phone, cleanDetails);
    await dbService.saveUser(updated, true);
    showToast('Bank and UPI payout account saved permanently to SQL Database!', 'success');
  };

  // Recharge / Deposit
  const recharge = async (amount: number, method: string, referenceNo?: string): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      openModal('auth');
      return { success: false, message: 'Please login first' };
    }
    if (user.status === 'frozen') {
      return { success: false, message: 'Your account is frozen by system administrator. Please contact support.' };
    }
    if (!platformSettings.isRechargeEnabled) {
      return {
        success: false,
        message: platformSettings.rechargeNotice || 'Add Money service is currently undergoing scheduled maintenance.',
      };
    }
    const effectiveMin = platformSettings.minRecharge && platformSettings.minRecharge >= 25 ? platformSettings.minRecharge : 25;
    if (amount < effectiveMin) {
      return { success: false, message: `Minimum add money amount is $${effectiveMin.toFixed(2)}` };
    }

    // STRICT ADMIN VERIFICATION: If requireAdminRechargeApproval is enabled, do NOT auto-credit wallet!
    if (platformSettings.requireAdminRechargeApproval !== false) {
      const inrAmount = Math.round(amount * 100);
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        userId: user.id,
        type: 'recharge',
        amount,
        amountInr: inrAmount,
        title: `${method} Deposit ($${amount.toFixed(2)} / ₹${inrAmount.toLocaleString()})`,
        timestamp: new Date().toLocaleString(),
        status: 'processing', // Awaiting Admin verification & manual approval
        referenceNo: referenceNo || `DEP${Math.floor(10000000 + Math.random() * 90000000)}`,
        utrNumber: referenceNo || '',
        paymentMethod: method,
        payeeUpi: platformSettings.merchantUpiId || 'nexaai.pay@icici',
        createdAt: Date.now(),
      };
      await dbService.saveTransaction(newTx, user.id);
      setTransactions((prev) => prependTxUnique(prev, newTx));
      setAdminTransactions((prev) => prependTxUnique(prev, newTx));

      showToast(`Deposit of $${amount.toFixed(2)} submitted! Under verification by Admin. Balance will be added after Admin approves.`, 'info');
      closeModal();
      return { success: true, message: 'Deposit submitted for admin verification' };
    }

    // Add to recharge balance and check for bonus lucky spins
    const threshold = platformSettings.rechargeThresholdForSpin || 5;
    const extraSpinsAwarded =
      platformSettings.extraSpinOnRecharge && threshold > 0 ? Math.floor(amount / threshold) : 0;

    const updatedUser: User = {
      ...user,
      rechargeBalance: Number((user.rechargeBalance + amount).toFixed(2)),
      spinChances: (user.spinChances || 0) + extraSpinsAwarded,
    };
    setUser(updatedUser);
    await dbService.saveUser(updatedUser);

    // Record transaction
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'recharge',
      amount,
      title: `${method} Add Money${extraSpinsAwarded > 0 ? ` (+${extraSpinsAwarded} Lucky Spins)` : ''}`,
      timestamp: new Date().toLocaleString(),
      status: 'completed',
      referenceNo: referenceNo || `REC${Math.floor(10000000 + Math.random() * 90000000)}`,
      paymentMethod: method,
    };
    await dbService.saveTransaction(newTx, user.id);
    setTransactions((prev) => prependTxUnique(prev, newTx));
    setAdminTransactions((prev) => prependTxUnique(prev, newTx));

    // Distribute multi-tier referral commissions to uplines
    distributeMultiTierCommissions(updatedUser, amount, 'recharge', newTx.referenceNo);

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    const spinBonusText = extraSpinsAwarded > 0 ? ` (+${extraSpinsAwarded} Bonus Lucky Spins!)` : '';
    showToast(`Add Money of $${amount.toFixed(2)} successful!${spinBonusText} Saved to Database.`, 'success');
    closeModal();
    return { success: true, message: 'Add Money successful' };
  };

  // Submit Manual UPI Deposit Request (Awaiting Admin Approval)
  const submitManualRecharge = async (
    amount: number,
    utrNumber: string,
    screenshotUrl?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      openModal('auth');
      return { success: false, message: 'Please login first' };
    }
    if (user.status === 'frozen') {
      return { success: false, message: 'Your account is frozen by system administrator. Please contact support.' };
    }
    if (!platformSettings.isRechargeEnabled) {
      return {
        success: false,
        message: platformSettings.rechargeNotice || 'Add Money service is currently paused by platform administrator.',
      };
    }
    const cleanUtr = (utrNumber || '').trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      return { success: false, message: 'Please enter a valid 12-digit UPI UTR / Reference number.' };
    }

    const effectiveMin = platformSettings.minRecharge && platformSettings.minRecharge >= 25 ? platformSettings.minRecharge : 25;
    if (amount < effectiveMin) {
      return { success: false, message: `Minimum deposit amount is $${effectiveMin.toFixed(2)}` };
    }

    const inrAmount = Math.round(amount * 100);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'recharge',
      amount,
      amountInr: inrAmount,
      title: `UPI Fast Deposit ($${amount.toFixed(2)} / ₹${inrAmount.toLocaleString()})`,
      timestamp: new Date().toLocaleString(),
      status: 'processing',
      referenceNo: cleanUtr,
      utrNumber: cleanUtr,
      paymentMethod: 'Manual UPI (QR)',
      payeeUpi: platformSettings.merchantUpiId || 'nexaai.pay@icici',
      screenshotUrl: screenshotUrl || '',
      createdAt: Date.now(),
    };

    try {
      await dbService.saveTransaction(newTx, user.id);
      setTransactions((prev) => prependTxUnique(prev, newTx));
      setAdminTransactions((prev) => prependTxUnique(prev, newTx));
      showToast('Deposit submitted! Admin will verify your UTR and credit your balance.', 'success');
      return { success: true, message: 'Deposit submitted successfully' };
    } catch (err: any) {
      console.error('Failed to submit manual recharge:', err);
      // Even if cloud save fails momentarily, update state locally
      setTransactions((prev) => prependTxUnique(prev, newTx));
      setAdminTransactions((prev) => prependTxUnique(prev, newTx));
      showToast('Deposit submitted! Under review by administrator.', 'success');
      return { success: true, message: 'Deposit recorded' };
    }
  };

  // Withdraw
  const withdraw = async (amount: number, details: NonNullable<User['bankDetails']>): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      openModal('auth');
      return { success: false, message: 'Please login first' };
    }

    if (isWithdrawalLockRef.current) {
      return { success: false, message: 'Withdrawal is already in progress. Please wait.' };
    }
    isWithdrawalLockRef.current = true;

    try {
      if (user.status === 'frozen') {
        return { success: false, message: 'Your account is frozen by system administrator. Please contact support.' };
      }
      if (!platformSettings.isWithdrawalEnabled) {
        return {
          success: false,
          message: platformSettings.withdrawalNotice || 'Withdrawal service is currently undergoing routine maintenance.',
        };
      }
      const minWth = platformSettings.minWithdrawal || 2;
      if (amount < minWth) {
        return { success: false, message: `Minimum withdrawal amount is $${minWth.toFixed(2)}` };
      }
      if (amount > user.withdrawalBalance) {
        return { success: false, message: 'Insufficient withdrawal balance' };
      }

      // Check if user already has a pending withdrawal request awaiting admin approval
      const existingPending = transactions.find(
        (t) => t.type === 'withdraw' && t.status === 'processing' && (t.userId === user.id || (user.phone && t.userId === user.phone))
      );
      if (existingPending) {
        showToast('You already have a pending withdrawal under review. Please wait for admin approval.', 'error');
        return { success: false, message: 'You already have a pending withdrawal request under review.' };
      }

      // Check anti-spam: if user submitted a withdrawal in the last 30 seconds, ignore duplicate
      const now = Date.now();
      const duplicateRecent = transactions.find(
        (t) => t.type === 'withdraw' && t.userId === user.id && now - (t.createdAt || 0) < 30000
      );
      if (duplicateRecent) {
        showToast('Withdrawal request already received. Processing payout.', 'info');
        return { success: false, message: 'Withdrawal request already received. Processing...' };
      }

      // Admin-controlled withdrawal fee logic (defaults to platformSettings.withdrawalFeePercent or 5%)
      const feePercent = platformSettings.withdrawalFeePercent !== undefined ? platformSettings.withdrawalFeePercent : 5;
      const fee = Number(((amount * feePercent) / 100).toFixed(2));
      const netPayout = Number((amount - fee).toFixed(2));

      const cleanBankDetails = {
        accountHolder: (details.accountHolder || user.nickname || '').trim(),
        accountNumber: (details.accountNumber || '').trim(),
        ifscCode: (details.ifscCode || '').trim().toUpperCase(),
        bankName: (details.bankName || 'Bank IMPS').trim(),
        upiId: '',
      };

      const updatedUser: User = {
        ...user,
        withdrawalBalance: Number((user.withdrawalBalance - amount).toFixed(2)),
        bankDetails: cleanBankDetails,
      };
      setUser(updatedUser);
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === user.id || u.phone === user.phone ? updatedUser : u))
      );
      await dbService.saveUser(updatedUser, true);

      const refNo = `WTH${Math.floor(10000000 + Math.random() * 90000000)}`;
      const newTx: Transaction = {
        id: `tx-${now}`,
        userId: user.id,
        type: 'withdraw',
        amount,
        feeAmount: fee,
        netAmount: netPayout,
        title: `Withdrawal: ${cleanBankDetails.accountHolder} (${cleanBankDetails.bankName})`,
        timestamp: new Date().toLocaleString(),
        createdAt: now,
        status: 'processing',
        referenceNo: refNo,
        paymentMethod: `Bank IMPS: ${cleanBankDetails.accountNumber} • ${cleanBankDetails.ifscCode}`,
        bankDetails: cleanBankDetails,
      };
      await dbService.saveTransaction(newTx, user.id);
      setTransactions((prev) => prependTxUnique(prev, newTx));
      setAdminTransactions((prev) => prependTxUnique(prev, newTx));

      showToast(`Withdrawal requested: $${netPayout.toFixed(2)} (Fee: ${feePercent}% / $${fee.toFixed(2)}). Sent for admin payout.`, 'success');
      closeModal();
      return { success: true, message: 'Withdrawal submitted' };
    } finally {
      setTimeout(() => {
        isWithdrawalLockRef.current = false;
      }, 5000);
    }
  };

  // Invest in Product
  const investInProduct = async (product: InvestmentProduct): Promise<{ success: boolean; message: string }> => {
    // Read the most up-to-date user instance synchronously so consecutive purchases within 5 seconds deduct accurately
    const currentUser = userRef.current || user;
    if (!currentUser) {
      openModal('auth');
      return { success: false, message: 'Please login first' };
    }

    if (platformSettings.isInvestmentEnabled === false) {
      return {
        success: false,
        message: platformSettings.investmentDisabledNotice || 'Product purchases are currently paused by the administrator.',
      };
    }

    if (currentUser.vipLevel < product.vipRequirement) {
      return { success: false, message: `Requires VIP Level ${product.vipRequirement}. Please upgrade VIP first.` };
    }

    const currentBalance = Number(currentUser.rechargeBalance) || 0;
    if (currentBalance < product.price) {
      openModal('recharge');
      return { success: false, message: `Insufficient Added Balance. Need $${(product.price - currentBalance).toFixed(2)} more.` };
    }

    // Deduct price from recharge balance immediately
    const nextBalance = Number((currentBalance - product.price).toFixed(2));
    const newTotalInvested = Number(((currentUser.totalInvested || 0) + product.price).toFixed(2));

    // Calculate new VIP tier based on total investment
    let newVip = currentUser.vipLevel || 0;
    if (newTotalInvested >= 15000) newVip = Math.max(newVip, 4);
    else if (newTotalInvested >= 5000) newVip = Math.max(newVip, 3);
    else if (newTotalInvested >= 1500) newVip = Math.max(newVip, 2);
    else if (newTotalInvested >= 280) newVip = Math.max(newVip, 1);

    const updatedUser: User = {
      ...currentUser,
      rechargeBalance: nextBalance,
      totalInvested: newTotalInvested,
      vipLevel: newVip,
      spinChances: (currentUser.spinChances || 0) + 1, // Bonus spin per investment
    };

    // Synchronously update the ref, timestamp, state, and localStorage BEFORE any async work
    userRef.current = updatedUser;
    lastUserActionTimestampRef.current = Date.now();
    setUser(updatedUser);
    const updatedCleanPhone = updatedUser.phone ? String(updatedUser.phone).replace(/\D/g, '').slice(-10) : '';
    setAdminUsers((prev) =>
      prev.map((u) => {
        const uCleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
        if (u.id === updatedUser.id || (updatedCleanPhone && uCleanPhone === updatedCleanPhone)) {
          return { ...u, ...updatedUser };
        }
        return u;
      })
    );
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    } catch {}

    // Persist to database
    await dbService.saveUser(updatedUser);

    // Create Order - Check if admin approval is required
    const requiresApproval = Boolean(platformSettings.requireAdminOrderApproval);
    const purchaseNow = Date.now();
    const nextClaimTime = purchaseNow + 24 * 60 * 60 * 1000;

    const newOrder: InvestmentOrder = {
      id: `ord-${Math.floor(1000 + Math.random() * 9000)}`,
      productId: product.id,
      productName: product.name,
      price: product.price,
      dailyEarnings: product.dailyEarnings,
      totalRevenue: product.totalRevenue,
      cycleDays: product.cycleDays,
      daysElapsed: 0,
      totalAccrued: 0,
      purchaseDate: new Date(purchaseNow).toISOString().split('T')[0],
      lastClaimDate: new Date(purchaseNow).toISOString().split('T')[0],
      purchaseTimestamp: purchaseNow,
      lastClaimTimestamp: purchaseNow,
      nextClaimTimestamp: nextClaimTime,
      status: requiresApproval ? 'pending_approval' : 'active',
      userId: currentUser.id,
      userPhone: currentUser.phone,
      userNickname: currentUser.nickname,
      adminNote: requiresApproval ? 'Submitted for Admin Approval' : 'Direct Auto-Activation',
    };
    await dbService.saveOrder(newOrder, currentUser.id);
    setOrders((prev) => [newOrder, ...prev]);
    setAdminOrders((prev) => [newOrder, ...prev]);

    const investTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      type: 'recharge',
      amount: -product.price,
      title: `Contract Purchased: ${product.name}${requiresApproval ? ' (Pending Admin Approval)' : ''}`,
      timestamp: new Date().toLocaleString(),
      status: 'completed',
      referenceNo: `INV${Math.floor(10000000 + Math.random() * 90000000)}`,
    };
    await dbService.saveTransaction(investTx, currentUser.id);
    setTransactions((prev) => prependTxUnique(prev, investTx));
    setAdminTransactions((prev) => prependTxUnique(prev, investTx));

    // Distribute multi-tier referral commissions to uplines
    distributeMultiTierCommissions(updatedUser, product.price, 'investment', newOrder.id);

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
    });

    if (requiresApproval) {
      showToast(`Product purchase submitted! Awaiting Admin Approval before dividend activation.`, 'info');
    } else {
      showToast(`Invested in ${product.name} successfully! First daily dividend unlocks in 24 hours.`, 'success');
    }
    setSelectedProductForInvest(null);
    return { success: true, message: 'Investment successful' };
  };

  // E-Commerce Shopping Order Creation (Razorpay Shopping Category Compliant)
  const createEcommerceOrder = async (
    product: InvestmentProduct,
    address: ShippingAddress,
    paymentId: string
  ): Promise<{ success: boolean; order: EcommerceOrder }> => {
    const orderNumber = `HD-SHOP-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceNumber = `INV-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const trackingNumber = `DELHIVERY-${Math.floor(10000000 + Math.random() * 90000000)}`;

    const newOrder: EcommerceOrder = {
      id: `eord-${Date.now()}`,
      orderNumber,
      productId: product.id,
      productName: product.retailName || product.name,
      price: product.price,
      quantity: 1,
      shippingAddress: address,
      paymentMethod: 'Razorpay Instant',
      paymentId,
      status: 'confirmed',
      trackingNumber,
      courierPartner: 'Delhivery Surface Express',
      createdAt: new Date().toLocaleString(),
      estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      invoiceNumber,
    };

    setEcommerceOrders((prev) => {
      const updated = [newOrder, ...prev];
      localStorage.setItem('hd_ecommerce_orders_v1', JSON.stringify(updated));
      return updated;
    });

    // Also activate investment order in background so user receives daily returns after 24h
    if (user) {
      const purchaseNow = Date.now();
      const nextClaimTime = purchaseNow + 24 * 60 * 60 * 1000;

      const newInvOrder: InvestmentOrder = {
        id: `ord-${Math.floor(1000 + Math.random() * 9000)}`,
        productId: product.id,
        productName: product.retailName || product.name,
        price: product.price,
        dailyEarnings: product.dailyEarnings,
        totalRevenue: product.totalRevenue,
        cycleDays: product.cycleDays,
        daysElapsed: 0,
        totalAccrued: 0,
        purchaseDate: new Date(purchaseNow).toISOString().split('T')[0],
        lastClaimDate: new Date(purchaseNow).toISOString().split('T')[0],
        purchaseTimestamp: purchaseNow,
        lastClaimTimestamp: purchaseNow,
        nextClaimTimestamp: nextClaimTime,
        status: 'active',
      };
      await dbService.saveOrder(newInvOrder, user.id);
      setOrders((prev) => [newInvOrder, ...prev]);

      // Add spin chance and investment tracking
      const updatedUser: User = {
        ...user,
        totalInvested: Number((user.totalInvested + product.price).toFixed(2)),
        spinChances: (user.spinChances || 0) + 1,
      };
      setUser(updatedUser);
      await dbService.saveUser(updatedUser);

      // Distribute multi-tier referral commissions to uplines
      distributeMultiTierCommissions(updatedUser, product.price, 'investment', newInvOrder.id);
    }

    // Save transaction
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user?.id,
      type: 'recharge',
      amount: product.price,
      title: `E-Commerce Store Order #${orderNumber} (${product.sku || 'HD-HW'})`,
      timestamp: new Date().toLocaleString(),
      status: 'completed',
      referenceNo: paymentId,
      paymentMethod: 'Razorpay E-Commerce',
    };
    await dbService.saveTransaction(tx, user?.id || '833863');
    setTransactions((prev) => [tx, ...prev]);

    confetti({
      particleCount: 140,
      spread: 90,
      origin: { y: 0.5 },
    });

    showToast(`Order #${orderNumber} Confirmed! Shipping to ${address.city}.`, 'success');
    return { success: true, order: newOrder };
  };

  // Claim Daily Dividends (Strict 24-Hour Cycle from Purchase & Last Claim)
  const claimDailyDividends = async (targetOrderId?: string): Promise<{ success: boolean; claimedAmount: number }> => {
    if (!user || orders.length === 0) {
      showToast('No active investment contracts found', 'info');
      return { success: false, claimedAmount: 0 };
    }

    if (platformSettings.allowUserDividendClaims === false) {
      showToast('Daily dividend claims are temporarily paused by administrator for scheduled maintenance.', 'info');
      return { success: false, claimedAmount: 0 };
    }

    const now = Date.now();
    const activeContracts = orders.filter(
      (o) => o.status === 'active' && (!targetOrderId || o.id === targetOrderId)
    );

    if (activeContracts.length === 0) {
      showToast('All investment contracts have reached their full cycle term', 'info');
      return { success: false, claimedAmount: 0 };
    }

    // Filter only contracts where 24 hours have elapsed
    const eligibleOrders: InvestmentOrder[] = [];
    let minWaitMs = Infinity;

    for (const ord of activeContracts) {
      const status = getOrderClaimStatus(ord, now);
      if (status.canClaim) {
        eligibleOrders.push(ord);
      } else if (status.remainingMs < minWaitMs) {
        minWaitMs = status.remainingMs;
      }
    }

    if (eligibleOrders.length === 0) {
      const waitTimeText = formatCountdownHuman(minWaitMs);
      showToast(
        `Daily dividend requires 24 hours cooldown! Next claim available in: ${waitTimeText} (24 घंटे पूरे होने के बाद ही अगला क्लेम करें)`,
        'info'
      );
      return { success: false, claimedAmount: 0 };
    }

    let totalClaim = 0;
    const nextClaimTime = now + 24 * 60 * 60 * 1000; // strictly 24 hours from this claim!

    const updatedOrders = orders.map((o) => {
      const isEligible = eligibleOrders.some((el) => el.id === o.id);
      if (isEligible) {
        const dividend = o.dailyEarnings;
        totalClaim += dividend;
        const newElapsed = o.daysElapsed + 1;
        const isFinished = newElapsed >= o.cycleDays;
        return {
          ...o,
          daysElapsed: newElapsed,
          totalAccrued: Number((o.totalAccrued + dividend).toFixed(2)),
          lastClaimDate: new Date(now).toISOString().split('T')[0],
          lastClaimTimestamp: now,
          nextClaimTimestamp: nextClaimTime,
          status: isFinished ? ('completed' as const) : ('active' as const),
        };
      }
      return o;
    });

    setOrders(updatedOrders);
    for (const ord of updatedOrders) {
      if (eligibleOrders.some((el) => el.id === ord.id)) {
        await dbService.saveOrder(ord, user.id);
      }
    }

    const updatedUser: User = {
      ...user,
      withdrawalBalance: Number((user.withdrawalBalance + totalClaim).toFixed(2)),
      productRevenue: Number((user.productRevenue + totalClaim).toFixed(2)),
    };
    setUser(updatedUser);
    await dbService.saveUser(updatedUser);

    const divTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'earnings',
      amount: totalClaim,
      title: `Daily 24-Hour Dividend Settled (${eligibleOrders.length} contracts)`,
      timestamp: new Date().toLocaleString(),
      status: 'completed',
      referenceNo: `DIV${Date.now()}`,
    };
    await dbService.saveTransaction(divTx, user.id);
    setTransactions((prev) => prependTxUnique(prev, divTx));
    setAdminTransactions((prev) => prependTxUnique(prev, divTx));

    // Distribute multi-tier referral commissions to upliners on daily returns (Tier 1: 10%, Tier 2: 3%, Tier 3: 1%)
    await distributeMultiTierCommissions(updatedUser, totalClaim, 'daily_income', divTx.referenceNo);

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
    });

    showToast(`Claimed $${totalClaim.toFixed(2)} dividends! Next claim unlocked in 24 hours.`, 'success');
    return { success: true, claimedAmount: totalClaim };
  };

  // Daily Check-In
  const dailyCheckIn = async (): Promise<{ success: boolean; bonus: number; message: string }> => {
    if (!user) {
      openModal('auth');
      return { success: false, bonus: 0, message: 'Please login first' };
    }

    if (platformSettings.isBonusEnabled === false) {
      showToast('Daily check-in is currently disabled by administrator. (दैनिक चेक-इन अभी बंद है)', 'error');
      return { success: false, bonus: 0, message: 'Check-in disabled' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (user.lastCheckInDate === todayStr) {
      showToast('You have already checked in today! Come back tomorrow.', 'info');
      return { success: false, bonus: 0, message: 'Already checked in' };
    }

    const newStreak = (user.checkInStreak || 0) + 1;
    // 7-day cycle index: 0 for Day 1, up to 6 for Day 7
    const dayIndex = ((newStreak - 1) % 7);
    const dayNumber = dayIndex + 1;

    // Use admin configured payout, or fallback to default [10, 12, 15, 18, 22, 26, 30]
    const payouts =
      platformSettings.checkInPayouts && platformSettings.checkInPayouts.length === 7
        ? platformSettings.checkInPayouts
        : [10, 12, 15, 18, 22, 26, 30];

    const bonus = Number((payouts[dayIndex] ?? 10).toFixed(2));
    const isDay7 = dayNumber === 7;
    const extraSpinsToAdd = isDay7
      ? (platformSettings.checkInDay7ExtraSpin !== false ? 1 : 0)
      : platformSettings.extraSpinOnCheckIn
      ? (platformSettings.spinsPerCheckIn || 1)
      : 0;

    const updatedUser: User = {
      ...user,
      withdrawalBalance: Number((user.withdrawalBalance + bonus).toFixed(2)),
      checkInStreak: newStreak,
      lastCheckInDate: todayStr,
      spinChances: (user.spinChances || 0) + extraSpinsToAdd,
    };
    setUser(updatedUser);
    await dbService.saveUser(updatedUser);

    const checkInTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'bonus',
      amount: bonus,
      title: `Daily Check-In Dividend (Day ${dayNumber} Streak) + ${extraSpinsToAdd} Free Spin`,
      timestamp: new Date().toLocaleString(),
      status: 'completed',
      referenceNo: `CHK${Date.now()}`,
    };
    await dbService.saveTransaction(checkInTx, user.id);
    setTransactions((prev) => prependTxUnique(prev, checkInTx));
    setAdminTransactions((prev) => prependTxUnique(prev, checkInTx));

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
    });

    showToast(`Check-in successful! $${bonus.toFixed(2)} credited to Withdrawal Balance + ${extraSpinsToAdd} Free Spin!`, 'success');
    return { success: true, bonus, message: 'Checked in successfully' };
  };

  // Helper: Calculate daily available free spins and bonus spins for user
  const getAvailableSpins = (targetUser: User): { total: number; dailyRemaining: number; bonusSpins: number } => {
    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = platformSettings.dailyFreeSpins ?? 1;
    const usedToday = targetUser.lastSpinDate === today ? (targetUser.dailySpinsUsedToday || 0) : 0;
    const dailyRemaining = Math.max(0, dailyLimit - usedToday);
    const bonus = targetUser.spinChances || 0;
    return {
      total: dailyRemaining + bonus,
      dailyRemaining,
      bonusSpins: bonus,
    };
  };

  // Buy Extra Spin with balance
  const buyExtraSpinWithBalance = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      openModal('auth');
      return { success: false, message: 'Please login first' };
    }
    if (!platformSettings.isSpinEnabled) {
      return { success: false, message: 'Lucky spin is currently paused' };
    }
    if (!platformSettings.isSpinPurchaseEnabled || (platformSettings.spinPrice || 0) <= 0) {
      return { success: false, message: 'Purchasing extra spins with balance is disabled' };
    }
    const cost = platformSettings.spinPrice || 50;
    if (user.rechargeBalance < cost) {
      return {
        success: false,
        message: `Insufficient added balance. Spin ticket cost is $${cost.toFixed(2)}`,
      };
    }

    const updatedUser: User = {
      ...user,
      rechargeBalance: Number((user.rechargeBalance - cost).toFixed(2)),
      spinChances: (user.spinChances || 0) + 1,
    };
    setUser(updatedUser);
    await dbService.saveUser(updatedUser);

    const spinPurchaseTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'recharge',
      amount: -cost,
      title: 'Purchased +1 Lucky Spin Ticket',
      timestamp: new Date().toLocaleString(),
      status: 'completed',
      referenceNo: `SPNTKT${Date.now()}`,
    };
    await dbService.saveTransaction(spinPurchaseTx, user.id);
    setTransactions((prev) => [spinPurchaseTx, ...prev]);

    showToast(`Purchased +1 Lucky Spin for $${cost.toFixed(2)}!`, 'success');
    return { success: true, message: 'Extra spin purchased' };
  };

  // Admin: Grant Extra Lucky Spins to any user
  const adminGrantExtraSpins = async (userId: string, count: number, reason: string = 'Admin bonus reward'): Promise<void> => {
    try {
      const targetUser = adminUsers.find((u) => u.id === userId) || (user?.id === userId ? user : null);
      if (!targetUser) {
        showToast('Target user not found', 'error');
        return;
      }
      const newSpins = Math.max(0, (targetUser.spinChances || 0) + count);
      await dbService.updateUser(userId, { spinChances: newSpins });

      if (user && user.id === userId) {
        setUser({ ...user, spinChances: newSpins });
      }

      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, spinChances: newSpins } : u))
      );

      const grantTx: Transaction = {
        id: `tx-${Date.now()}`,
        userId,
        type: 'bonus',
        amount: 0,
        title: `Admin Granted +${count} Extra Lucky Spins (${reason})`,
        timestamp: new Date().toLocaleString(),
        status: 'completed',
        referenceNo: `ADM-SPN-${Date.now()}`,
      };
      await dbService.saveTransaction(grantTx, userId);
      setAdminTransactions((prev) => [grantTx, ...prev]);

      showToast(`Granted +${count} Lucky Spins to ${targetUser.nickname || targetUser.phone}!`, 'success');
    } catch (err: any) {
      console.error('Failed to grant extra spins:', err);
      showToast('Failed to grant spins', 'error');
    }
  };

  // Update wheel prize slices configuration in Platform Settings
  const updateSpinPrizes = async (prizes: SpinPrizeConfig[]): Promise<void> => {
    const updated = {
      ...platformSettings,
      spinPrizes: prizes,
    };
    setPlatformSettings(updated);
    await dbService.savePlatformSettings(updated);
    showToast('Lucky spin prizes & probability distribution saved!', 'success');
  };

  // Spin Wheel Prize Execution
  const spinWheelPrize = async (
    prizeLabel: string,
    prizeValue: number,
    type: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Login required' };
    if (!platformSettings.isSpinEnabled) {
      showToast('Lucky spin is currently paused by administrator.', 'error');
      return { success: false, message: 'Lucky spin disabled' };
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = platformSettings.dailyFreeSpins ?? 1;
    const usedToday = user.lastSpinDate === today ? (user.dailySpinsUsedToday || 0) : 0;
    const dailyRemaining = Math.max(0, dailyLimit - usedToday);
    const bonus = user.spinChances || 0;

    let updatedUsedToday = usedToday;
    let updatedBonus = bonus;
    let deductedFromBalance = false;

    if (dailyRemaining > 0) {
      // Consume 1 daily free spin
      updatedUsedToday += 1;
    } else if (bonus > 0) {
      // Consume 1 extra/bonus spin
      updatedBonus -= 1;
    } else if (platformSettings.isSpinPurchaseEnabled && (platformSettings.spinPrice || 0) > 0) {
      const cost = platformSettings.spinPrice || 50;
      if (user.rechargeBalance < cost) {
        showToast(`No spins remaining! Recharging balance needed for $${cost.toFixed(2)} ticket.`, 'error');
        return { success: false, message: 'Insufficient balance' };
      }
      deductedFromBalance = true;
    } else {
      showToast('No free or bonus spins remaining for today!', 'info');
      return { success: false, message: 'No chances left' };
    }

    let newRechargeBalance = user.rechargeBalance;
    if (deductedFromBalance) {
      const cost = platformSettings.spinPrice || 50;
      newRechargeBalance = Number((user.rechargeBalance - cost).toFixed(2));
    }

    let newWithdrawalBalance = user.withdrawalBalance;
    if (prizeValue > 0 && (type === 'cash' || type === 'vip_points')) {
      newWithdrawalBalance = Number((user.withdrawalBalance + prizeValue).toFixed(2));
    } else if (type === 'spins' && prizeValue > 0) {
      updatedBonus += prizeValue;
    }

    const updatedUser: User = {
      ...user,
      rechargeBalance: newRechargeBalance,
      withdrawalBalance: newWithdrawalBalance,
      spinChances: updatedBonus,
      lastSpinDate: today,
      dailySpinsUsedToday: updatedUsedToday,
    };

    setUser(updatedUser);
    await dbService.saveUser(updatedUser);

    // If prize won was cash, record transaction & update today's prize distribution pool in settings
    if (prizeValue > 0 && (type === 'cash' || type === 'vip_points')) {
      const spinTx: Transaction = {
        id: `tx-${Date.now()}`,
        userId: user.id,
        type: 'spin_win',
        amount: prizeValue,
        title: `Lucky Wheel Prize: ${prizeLabel}`,
        timestamp: new Date().toLocaleString(),
        status: 'completed',
        referenceNo: `SPN${Date.now()}`,
      };
      await dbService.saveTransaction(spinTx, user.id);
      setTransactions((prev) => prependTxUnique(prev, spinTx));
      setAdminTransactions((prev) => prependTxUnique(prev, spinTx));

      // Update platform settings total prize pool
      const currentResetDate = platformSettings.lastDistributionResetDate || today;
      const todayDistributed = currentResetDate === today ? (platformSettings.totalPrizeDistributedToday || 0) : 0;
      const updatedTotalPrize = Number((todayDistributed + prizeValue).toFixed(2));

      const newSettings: PlatformSettings = {
        ...platformSettings,
        totalPrizeDistributedToday: updatedTotalPrize,
        lastDistributionResetDate: today,
      };
      setPlatformSettings(newSettings);
      await dbService.savePlatformSettings(newSettings);

      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 },
      });

      showToast(`Congratulations! You won ${prizeLabel}!`, 'success');
    } else if (type === 'spins' && prizeValue > 0) {
      showToast(`Congratulations! You won +${prizeValue} Extra Lucky Spins!`, 'success');
    } else {
      showToast('Better luck next time! Try again.', 'info');
    }

    return { success: true, message: 'Spin processed' };
  };

  // Redeem Gift Code
  const redeemGiftCode = async (code: string): Promise<{ success: boolean; amount: number; message: string }> => {
    if (!user) {
      openModal('auth');
      return { success: false, amount: 0, message: 'Please login' };
    }

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      showToast('Please enter a valid promo or gift code (कृपया मान्य गिफ्ट कोड दर्ज करें)', 'error');
      return { success: false, amount: 0, message: 'Empty code' };
    }

    // Check if user already redeemed this promo code
    if (user.redeemedCodes && user.redeemedCodes.includes(cleanCode)) {
      showToast(`You have already redeemed code "${cleanCode}"! (आप यह कोड पहले ही रिडीम कर चुके हैं)`, 'info');
      return { success: false, amount: 0, message: 'Already redeemed' };
    }

    // 1. Look for admin-created custom promo code in local state or cloud
    let matchedPromo = promoCodes.find((p) => p.code.trim().toUpperCase() === cleanCode);
    if (!matchedPromo) {
      try {
        const cloudPromos = await dbService.getAllPromoCodes();
        matchedPromo = cloudPromos.find((p) => p.code.trim().toUpperCase() === cleanCode);
        if (cloudPromos && cloudPromos.length > 0) {
          setPromoCodes(cloudPromos);
        }
      } catch (err) {
        console.warn('Failed to query promo codes from cloud:', err);
      }
    }

    // Check if code was deleted by admin
    if (dbService.getDeletedPromoKeys().has(cleanCode)) {
      showToast(`Gift code "${cleanCode}" has been deleted by administrator. (यह कोड डिलीट किया जा चुका है)`, 'error');
      return { success: false, amount: 0, message: 'Code deleted' };
    }

    let giftValue = 0;
    let promoToUpdate: CustomPromoCode | null = null;

    if (matchedPromo) {
      if (matchedPromo.isActive === false) {
        showToast(`Gift code "${cleanCode}" is currently paused or inactive. (यह कोड निष्क्रिय है)`, 'error');
        return { success: false, amount: 0, message: 'Code inactive' };
      }
      if (matchedPromo.maxUses && (matchedPromo.usedCount || 0) >= matchedPromo.maxUses) {
        showToast(`Gift code "${cleanCode}" has reached maximum usage limit! (इस कोड की सीमा समाप्त हो चुकी है)`, 'error');
        return { success: false, amount: 0, message: 'Limit reached' };
      }
      giftValue = Number(matchedPromo.amount);
      promoToUpdate = {
        ...matchedPromo,
        usedCount: (matchedPromo.usedCount || 0) + 1,
      };
    } else {
      showToast(`Invalid or expired gift code "${cleanCode}". Please verify code. (अमान्य या समाप्त गिफ्ट कोड)`, 'error');
      return { success: false, amount: 0, message: 'Invalid code' };
    }

    if (giftValue <= 0) {
      showToast('This gift code has zero value.', 'error');
      return { success: false, amount: 0, message: 'Zero value' };
    }

    // Save incremented usage count for admin-created promo code
    if (promoToUpdate) {
      try {
        await dbService.savePromoCode(promoToUpdate);
        setPromoCodes((prev) => prev.map((p) => (p.id === promoToUpdate!.id ? promoToUpdate! : p)));
      } catch (err) {
        console.warn('Failed to record promo usage in cloud:', err);
      }
    }

    // Credit user's withdrawal balance and remember redeemed code
    const updatedRedeemed = Array.from(new Set([...(user.redeemedCodes || []), cleanCode]));
    const updatedUser: User = {
      ...user,
      withdrawalBalance: Number((user.withdrawalBalance + giftValue).toFixed(2)),
      redeemedCodes: updatedRedeemed,
    };
    setUser(updatedUser);
    await dbService.saveUser(updatedUser);

    const giftTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'bonus',
      amount: giftValue,
      title: `Redeemed Gift Card: ${cleanCode}`,
      timestamp: new Date().toLocaleString(),
      status: 'completed',
      referenceNo: `GIFT${Date.now()}`,
    };
    await dbService.saveTransaction(giftTx, user.id);
    setTransactions((prev) => prependTxUnique(prev, giftTx));
    setAdminTransactions((prev) => prependTxUnique(prev, giftTx));

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });

    showToast(`Gift code "${cleanCode}" redeemed! $${giftValue.toFixed(2)} added to Withdrawal Balance!`, 'success');
    return { success: true, amount: giftValue, message: 'Redeemed successfully' };
  };

  // Support Chat
  const sendSupportMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: SupportMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: 'Just now',
    };
    setSupportMessages((prev) => [...prev, userMsg]);
    setIsSupportTyping(true);

    setTimeout(() => {
      let reply = 'Thank you for contacting Nexa AI Support. Our automated financial gateway processes all verified deposits in real-time. All data is saved permanently in your Cloud Database.';
      const lower = text.toLowerCase();
      if (lower.includes('recharge') || lower.includes('deposit') || lower.includes('add money') || lower.includes('upi')) {
        reply = 'To add money: Click on the "Add Money" icon on the Home screen, select an amount (e.g. $10 or $20), and complete payment via Razorpay. It updates your Added Balance in the database automatically!';
      } else if (lower.includes('withdraw') || lower.includes('bank') || lower.includes('payout')) {
        reply = 'To withdraw: Go to "Withdraw", enter your withdrawal amount (min $2.00), fill in your Bank A/C or UPI VPA, and click submit. Funds are processed 24/7.';
      } else if (lower.includes('vip') || lower.includes('invest') || lower.includes('plan')) {
        reply = 'Our Steady and Benefit investment contracts start from $280 (VIP1 Hydrogen Unit) with $240.80 daily returns for 47 days. You can collect daily earnings anytime under "My Orders"!';
      } else if (lower.includes('refer') || lower.includes('team') || lower.includes('invite')) {
        const t1 = platformSettings?.tier1Commission ?? 10;
        const t2 = platformSettings?.tier2Commission ?? 3;
        const t3 = platformSettings?.tier3Commission ?? 1;
        reply = `You earn ${t1}% direct commission from Level 1 referrals, ${t2}% from Level 2, and ${t3}% from Level 3 whenever they invest! Share your invite code: ${user?.invitationCode || '4AB86'}`;
      }

      const agentMsg: SupportMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: reply,
        timestamp: 'Just now',
      };
      setSupportMessages((prev) => [...prev, agentMsg]);
      setIsSupportTyping(false);
    }, 1000);
  };

  // Real-time subscription for Admin Console users & transactions
  useEffect(() => {
    if (!isAdminView) return;
    let isMounted = true;
    const unsubUsers = dbService.subscribeToAllUsers((liveUsers) => {
      if (isMounted && liveUsers.length > 0) {
        setAdminUsers(liveUsers);
      }
    });
    const unsubTxs = dbService.subscribeToAllTransactions((liveTxs) => {
      if (isMounted && liveTxs.length > 0) {
        setAdminTransactions(liveTxs);
      }
    });
    return () => {
      isMounted = false;
      unsubUsers();
      unsubTxs();
    };
  }, [isAdminView]);

  // Admin actions implementation
  const loadAdminUsers = async () => {
    try {
      const list = await dbService.getAllUsers();
      if (list.length > 0) {
        setAdminUsers(list);
      } else if (user) {
        setAdminUsers([user]);
      }
    } catch (err) {
      console.warn('Failed to load admin users:', err);
    }
  };

  const adminCreateUser = async (newUserData: Partial<User>): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const cleanedPhone = String(newUserData.phone || '').replace(/\D/g, '').slice(-10);
      if (!cleanedPhone || cleanedPhone.length !== 10) {
        const msg = 'Please enter a valid 10-digit mobile number (10 अंकों का मोबाइल नंबर दर्ज करें)';
        showToast(msg, 'error');
        return { success: false, message: msg };
      }

      const inputPassword = String(newUserData.password || '').trim();
      if (!inputPassword) {
        const msg = 'Please enter a login password for the user (पासवर्ड दर्ज करें)';
        showToast(msg, 'error');
        return { success: false, message: msg };
      }

      const nickname = String(newUserData.nickname || '').trim() || `Member_${cleanedPhone.slice(-4)}`;

      // Check if phone number is already registered
      const existing = await dbService.findUserByPhone(cleanedPhone);
      if (existing) {
        const msg = `Mobile +91 ${cleanedPhone} is already registered (ID: #${existing.id})`;
        showToast(msg, 'error');
        return { success: false, message: msg };
      }

      // Resolve optional upline sponsor
      const cleanInvite = String(newUserData.invitedBy || '').trim().toUpperCase();
      let inviterUser: User | null = null;
      if (cleanInvite) {
        inviterUser = await dbService.findUserByInviteCode(cleanInvite);
      }

      const newId = newUserData.id?.trim() || Math.floor(100000 + Math.random() * 900000).toString();
      const userInviteCode = newUserData.invitationCode?.trim().toUpperCase() || dbService.generateReferralCode();

      const rechargeBal = Number(newUserData.rechargeBalance) || 0;
      const withdrawBal = Number(newUserData.withdrawalBalance) || 0;
      const prodRev = Number(newUserData.productRevenue) || 0;
      const totalInv = Number(newUserData.totalInvested) || rechargeBal;

      const createdUser: User = {
        id: newId,
        phone: cleanedPhone,
        password: inputPassword,
        nickname,
        avatar: 'HD',
        invitationCode: userInviteCode,
        invitedBy: inviterUser ? inviterUser.invitationCode : (cleanInvite || undefined),
        inviterName: inviterUser ? inviterUser.nickname : (newUserData.inviterName || undefined),
        inviterId: inviterUser ? inviterUser.id : (newUserData.inviterId || undefined),
        totalReferrals: 0,
        totalCommissionEarned: 0,
        rechargeBalance: rechargeBal,
        withdrawalBalance: withdrawBal,
        productRevenue: prodRev,
        vipLevel: Number(newUserData.vipLevel) || 0,
        totalInvested: totalInv,
        checkInStreak: 0,
        lastCheckInDate: null,
        spinChances: Number(newUserData.spinChances) || 0,
        status: newUserData.status === 'frozen' ? 'frozen' : 'active',
        bankDetails: newUserData.bankDetails,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save permanently across Cloud SQL, disk backup, localStorage, and Firestore
      await dbService.saveUser(createdUser, true);
      setAdminUsers((prev) => {
        const filtered = prev.filter((u) => u.id !== createdUser.id && u.phone !== createdUser.phone);
        return [createdUser, ...filtered];
      });

      // Update upline referral count if linked
      if (inviterUser) {
        inviterUser.totalReferrals = (inviterUser.totalReferrals || 0) + 1;
        await dbService.saveUser(inviterUser, true);
        setAdminUsers((prev) => prev.map((u) => (u.id === inviterUser!.id ? { ...inviterUser! } : u)));
      }

      // Record initial balance ledger entry if Admin gave starting balance
      if (rechargeBal > 0) {
        const initTx: Transaction = {
          id: `tx-adm-init-${Date.now()}`,
          userId: createdUser.id,
          type: 'recharge',
          amount: rechargeBal,
          title: 'Initial Deposit Balance Added by Admin',
          timestamp: new Date().toLocaleString(),
          createdAt: Date.now(),
          status: 'completed',
          referenceNo: `ADM-INIT-${createdUser.id}`,
          paymentMethod: 'Admin Direct Setup',
        };
        await dbService.saveTransaction(initTx, createdUser.id);
        setAdminTransactions((prev) => [initTx, ...prev]);
      }

      showToast(`New user ${createdUser.nickname} (+91 ${createdUser.phone}) created & saved permanently!`, 'success');
      return { success: true, message: 'User created successfully', user: createdUser };
    } catch (err: any) {
      const msg = err?.message || 'Failed to create user';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const adminUpdateUser = async (userId: string, data: Partial<User>) => {
    try {
      await dbService.updateUser(userId, data);
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data } : u)));
      if (user && user.id === userId) {
        setUser((prev) => (prev ? { ...prev, ...data } : null));
      }
      showToast('User full details saved permanently in database', 'success');
    } catch {
      showToast('Failed to update user', 'error');
    }
  };

  const adminDeleteUser = async (userId: string, userPhone?: string) => {
    try {
      const cleanTargetPhone = userPhone ? String(userPhone).replace(/\D/g, '').slice(-10) : '';
      await dbService.deleteUser(userId, cleanTargetPhone);
      setAdminUsers((prev) =>
        prev.filter((u) => {
          const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
          if (u.id === userId || u.phone === userId) return false;
          if (cleanTargetPhone && uPhone === cleanTargetPhone) return false;
          return true;
        })
      );
      // Also filter admin orders for this deleted user
      setAdminOrders((prev) =>
        prev.filter((o) => {
          const oPhone = String(o.userPhone || '').replace(/\D/g, '').slice(-10);
          if (o.userId === userId) return false;
          if (cleanTargetPhone && oPhone === cleanTargetPhone) return false;
          return true;
        })
      );
      // If the deleted user is currently logged in, clear session
      const curPhone = user?.phone ? String(user.phone).replace(/\D/g, '').slice(-10) : '';
      if (
        user &&
        (user.id === userId ||
          user.phone === userId ||
          (cleanTargetPhone && curPhone === cleanTargetPhone))
      ) {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_ORDERS);
        localStorage.removeItem(STORAGE_KEY_TXS);
        showToast('Your account was permanently removed by administrator.', 'info');
      } else {
        showToast('User permanently deleted from Cloud SQL and database.', 'info');
      }
    } catch {
      showToast('Failed to delete user', 'error');
    }
  };

  // Anti-double-click concurrency set for admin fund actions
  const activeFundOps = new Set<string>();

  const adminManualBalanceAdjust = async (
    userId: string,
    wallet: 'rechargeBalance' | 'withdrawalBalance' | 'productRevenue',
    amount: number,
    type: 'add' | 'deduct',
    note: string
  ) => {
    const lockKey = `adjust-${userId}`;
    if (activeFundOps.has(lockKey)) {
      showToast('Adjustment is already processing for this user. Please wait.', 'info');
      return;
    }
    activeFundOps.add(lockKey);

    try {
      const target = adminUsers.find((u) => u.id === userId) || (user?.id === userId ? user : null);
      if (!target) return;

      const idempotencyKey = `${userId}-${wallet}-${type}-${amount.toFixed(2)}-${Math.floor(Date.now() / 4000)}`;

      // 1. Backend atomic adjustment with anti-double-click deduplication
      const res = await dbService.adminAdjustBalance({
        userId,
        wallet,
        amount,
        type,
        note,
        idempotencyKey,
      });

      if (res.alreadyProcessed) {
        showToast('Balance was already adjusted (duplicate click prevented)', 'info');
        return;
      }

      const nextVal = res.user && res.user[wallet] !== undefined
        ? Number(res.user[wallet])
        : Math.max(0, Number(((target[wallet] || 0) + (type === 'add' ? amount : -amount)).toFixed(2)));

      // 2. Sync to Firestore
      await dbService.updateUser(userId, { [wallet]: nextVal });

      const adjTx: Transaction = res.transaction || {
        id: `tx-adj-${Date.now()}`,
        userId,
        type: type === 'add' ? 'bonus' : 'earnings',
        amount,
        title: `Admin ${type === 'add' ? 'Credit' : 'Debit'}: ${note}`,
        timestamp: new Date().toLocaleString(),
        status: 'completed',
        referenceNo: `ADM${Math.floor(100000 + Math.random() * 900000)}`,
      };

      await dbService.saveTransaction(adjTx, userId);

      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, [wallet]: nextVal } : u))
      );
      if (user && user.id === userId) {
        setUser((prev) => (prev ? { ...prev, [wallet]: nextVal } : null));
      }

      setAdminTransactions((prev) => prependTxUnique(prev, adjTx));
      if (user && user.id === userId) {
        setTransactions((prev) => prependTxUnique(prev, adjTx));
      }
      showToast(`Adjusted ${wallet} for User ${userId}`, 'success');
    } finally {
      activeFundOps.delete(lockKey);
    }
  };

  const loadAdminTransactions = async () => {
    try {
      const list = await dbService.getAllTransactions();
      if (list.length > 0) {
        setAdminTransactions(list);
      } else {
        setAdminTransactions(transactions);
      }
    } catch (err) {
      console.warn('Failed to load admin transactions:', err);
    }
  };

  const adminApproveRecharge = async (txId: string, userId: string, amount: number) => {
    const lockKey = `recharge-approve-${txId}`;
    if (activeFundOps.has(lockKey)) {
      showToast('Deposit approval is already in progress. Please wait.', 'info');
      return;
    }

    // Check if already completed in state
    const existing = adminTransactions.find((t) => t.id === txId || t.referenceNo === txId);
    if (existing && existing.status === 'completed') {
      showToast('This deposit is already approved and credited!', 'info');
      return;
    }

    activeFundOps.add(lockKey);
    try {
      // 1. Backend atomic approval & wallet credit with anti-double-click deduplication
      const apiRes = await dbService.adminRechargeAction({
        action: 'approve',
        txId,
        userId,
        amount,
      });

      if (apiRes.alreadyProcessed) {
        showToast('This deposit was already approved previously.', 'info');
        return;
      }

      // 2. Sync to Firestore
      await dbService.updateTransaction(txId, { status: 'completed' });
      setAdminTransactions((prev) =>
        prev.map((t) => (t.id === txId || t.referenceNo === txId ? { ...t, status: 'completed' } : t))
      );

      if (userId) {
        const targetUser = apiRes.user || (await dbService.getUser(userId));
        const newBal = targetUser && targetUser.rechargeBalance !== undefined
          ? Number(targetUser.rechargeBalance)
          : Number((((adminUsers.find(u => u.id === userId)?.rechargeBalance || 0) + amount)).toFixed(2));

        await dbService.updateUser(userId, { rechargeBalance: newBal });
        setAdminUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, rechargeBalance: newBal } : u))
        );
        if (user && user.id === userId) {
          setUser((prev) => (prev ? { ...prev, rechargeBalance: newBal } : null));
        }
      }
      showToast(`Add Money of $${amount} approved & credited to wallet!`, 'success');
    } finally {
      activeFundOps.delete(lockKey);
    }
  };

  const adminRejectRecharge = async (txId: string, reason?: string) => {
    const lockKey = `recharge-reject-${txId}`;
    if (activeFundOps.has(lockKey)) return;

    const existing = adminTransactions.find((t) => t.id === txId || t.referenceNo === txId);
    if (existing && (existing.status === 'rejected' || existing.status === 'completed')) {
      showToast(`Deposit is already ${existing.status}!`, 'info');
      return;
    }

    activeFundOps.add(lockKey);
    try {
      await dbService.adminRechargeAction({
        action: 'reject',
        txId,
        reason,
      });
      await dbService.updateTransaction(txId, { status: 'rejected' });
      setAdminTransactions((prev) =>
        prev.map((t) => (t.id === txId || t.referenceNo === txId ? { ...t, status: 'rejected' } : t))
      );
      showToast(`Add Money rejected (${reason || 'Verification failed'})`, 'info');
    } finally {
      activeFundOps.delete(lockKey);
    }
  };

  const adminApproveWithdrawal = async (txId: string, referenceNo?: string) => {
    const lockKey = `withdraw-approve-${txId}`;
    if (activeFundOps.has(lockKey)) {
      showToast('Withdrawal approval is already in progress.', 'info');
      return;
    }

    const existing = adminTransactions.find((t) => t.id === txId || t.referenceNo === txId);
    if (existing && existing.status === 'completed') {
      showToast('This withdrawal is already approved and completed!', 'info');
      return;
    }

    activeFundOps.add(lockKey);
    try {
      const update: Partial<Transaction> = { status: 'completed' };
      if (referenceNo) update.referenceNo = referenceNo;

      // 1. Sync to backend API & Cloud SQL with anti-double-click lock
      const apiRes = await dbService.adminWithdrawalAction({
        action: 'approve',
        txId,
        referenceNo,
      });

      if (apiRes.alreadyProcessed) {
        showToast('This withdrawal was already approved previously.', 'info');
        return;
      }

      // 2. Sync to Firestore
      await dbService.updateTransaction(txId, update);

      // 3. Update in-memory admin transactions state
      setAdminTransactions((prev) =>
        prev.map((t) => (t.id === txId || t.referenceNo === txId ? { ...t, ...update } : t))
      );

      // 4. Update logged-in user transactions state if applicable
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId || t.referenceNo === txId ? { ...t, ...update } : t))
      );

      showToast(`Withdrawal marked as Paid & Completed!${referenceNo ? ` (UTR: ${referenceNo})` : ''}`, 'success');
    } finally {
      activeFundOps.delete(lockKey);
    }
  };

  const adminRejectWithdrawal = async (txId: string, userId: string, amount: number, reason?: string) => {
    const lockKey = `withdraw-reject-${txId}`;
    if (activeFundOps.has(lockKey)) {
      showToast('Withdrawal rejection is already in progress.', 'info');
      return;
    }

    const existing = adminTransactions.find((t) => t.id === txId || t.referenceNo === txId);
    if (existing && (existing.status === 'rejected' || existing.status === 'completed')) {
      showToast(`This withdrawal is already ${existing.status}! Duplicate refund cannot be applied.`, 'info');
      return;
    }

    activeFundOps.add(lockKey);
    try {
      const update: Partial<Transaction> = { status: 'rejected' };
      const numAmount = Number(amount) || 0;

      // 1. Sync to backend API & Cloud SQL (which checks idempotency and refunds exactly once)
      const apiRes = await dbService.adminWithdrawalAction({
        action: 'reject',
        txId,
        userId,
        amount: numAmount,
        reason,
      });

      if (apiRes.alreadyProcessed) {
        showToast('This withdrawal was already rejected previously. Duplicate refund prevented.', 'info');
        return;
      }

      // 2. Sync to Firestore
      await dbService.updateTransaction(txId, update);

      // 3. Update admin transactions and user transactions state
      setAdminTransactions((prev) =>
        prev.map((t) => (t.id === txId || t.referenceNo === txId ? { ...t, status: 'rejected' } : t))
      );
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId || t.referenceNo === txId ? { ...t, status: 'rejected' } : t))
      );

      // 4. Refund money back to user withdrawal balance in React state ONLY if not already processed
      if (userId && numAmount > 0) {
        let targetUser = adminUsers.find((u) => u.id === userId || u.phone === userId) || null;
        if (!targetUser) {
          targetUser = await dbService.getUser(userId);
        }

        if (targetUser) {
          const newBal = apiRes?.user && apiRes.user.withdrawalBalance !== undefined
            ? Number(apiRes.user.withdrawalBalance)
            : Number(((targetUser.withdrawalBalance || 0) + numAmount).toFixed(2));

          await dbService.updateUser(targetUser.id, { withdrawalBalance: newBal });
          setAdminUsers((prev) =>
            prev.map((u) => (u.id === targetUser!.id || u.phone === targetUser!.phone ? { ...u, withdrawalBalance: newBal } : u))
          );
          if (user && (user.id === targetUser.id || user.phone === targetUser.phone)) {
            setUser((prev) => (prev ? { ...prev, withdrawalBalance: newBal } : null));
          }
        } else if (apiRes?.user) {
          setAdminUsers((prev) =>
            prev.map((u) => (u.id === apiRes.user.id || u.phone === apiRes.user.phone ? { ...u, ...apiRes.user } : u))
          );
          if (user && (user.id === apiRes.user.id || user.phone === apiRes.user.phone)) {
            setUser((prev) => (prev ? { ...prev, ...apiRes.user } : null));
          }
        }
      }
      showToast(`Withdrawal rejected & $${numAmount.toFixed(2)} refunded to user balance!`, 'info');
    } finally {
      activeFundOps.delete(lockKey);
    }
  };

  // Admin Investment Orders Control Center
  const loadAdminOrders = async () => {
    try {
      const list = await dbService.getAllOrders();
      if (Array.isArray(list)) {
        const delBlacklist = dbService.getDeletedOrderBlacklist();
        const cleanList = list.filter((o) => {
          const strId = String(o?.id || '').trim().toLowerCase();
          return o && o.id && !delBlacklist.has(strId);
        });
        setAdminOrders(cleanList);
      }
    } catch (err) {
      console.warn('Failed to load admin orders:', err);
    }
  };

  const adminApproveOrder = async (orderId: string) => {
    const res = await dbService.triggerOrderAction(orderId, { action: 'approve' });
    if (res.success && res.order) {
      setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      showToast(`Order #${orderId} approved and activated! 24h cycle initiated.`, 'success');
    } else {
      showToast(res.message || 'Failed to approve order', 'error');
    }
  };

  const adminPauseOrder = async (orderId: string, reason?: string) => {
    const res = await dbService.triggerOrderAction(orderId, { action: 'pause', reason });
    if (res.success && res.order) {
      setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      showToast(`Order #${orderId} paused. Dividends stopped.`, 'info');
    } else {
      showToast(res.message || 'Failed to pause order', 'error');
    }
  };

  const adminResumeOrder = async (orderId: string) => {
    const res = await dbService.triggerOrderAction(orderId, { action: 'resume' });
    if (res.success && res.order) {
      setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      showToast(`Order #${orderId} resumed and active.`, 'success');
    } else {
      showToast(res.message || 'Failed to resume order', 'error');
    }
  };

  const adminCancelOrder = async (
    orderId: string,
    refundAmount?: number,
    refundWallet: 'rechargeBalance' | 'withdrawalBalance' = 'rechargeBalance',
    reason?: string
  ) => {
    const res = await dbService.triggerOrderAction(orderId, {
      action: 'cancel',
      refundAmount,
      refundWallet,
      reason,
    });
    if (res.success) {
      if (res.order) {
        setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      }
      await loadAdminUsers();
      if (user && res.order?.userId === user.id) {
        const updated = await dbService.getUser(user.id);
        if (updated) setUser(updated);
      }
      showToast(res.message || `Order #${orderId} cancelled & refunded!`, 'success');
    } else {
      showToast(res.message || 'Failed to cancel order', 'error');
    }
  };

  const adminPayoutOrderDividend = async (orderId: string, customEarnings?: number) => {
    const res = await dbService.triggerOrderAction(orderId, { action: 'payout_dividend', customEarnings });
    if (res.success && res.order) {
      setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      await loadAdminUsers();
      if (user && res.order.userId === user.id) {
        const updated = await dbService.getUser(user.id);
        if (updated) setUser(updated);
      }
      showToast(res.message || `Dividend paid for Order #${orderId}!`, 'success');
    } else {
      showToast(res.message || 'Failed to payout dividend', 'error');
    }
  };

  const adminResetOrderTimer = async (orderId: string) => {
    const res = await dbService.triggerOrderAction(orderId, { action: 'reset_timer' });
    if (res.success && res.order) {
      setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
      showToast(`24-hour countdown reset! User can claim dividend right now.`, 'success');
    } else {
      showToast(res.message || 'Failed to reset cooldown', 'error');
    }
  };

  const adminUpdateOrder = async (orderId: string, updates: Partial<InvestmentOrder>) => {
    try {
      await dbService.updateOrder(orderId, updates);
      setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
      showToast(`Order #${orderId} updated successfully!`, 'success');
    } catch {
      showToast('Failed to update order', 'error');
    }
  };

  const adminDeleteOrder = async (orderId: string) => {
    try {
      const cleanId = String(orderId).trim();
      await dbService.deleteOrder(cleanId);
      setAdminOrders((prev) => prev.filter((o) => String(o.id).trim().toLowerCase() !== cleanId.toLowerCase()));
      setOrders((prev) => {
        const remaining = prev.filter((o) => String(o.id).trim().toLowerCase() !== cleanId.toLowerCase());
        try {
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(remaining));
        } catch (e) {}
        return remaining;
      });
      showToast(`Order #${cleanId} deleted permanently from all databases!`, 'info');
    } catch {
      showToast('Failed to delete order', 'error');
    }
  };

  const updatePlatformSettings = async (newSettings: Partial<PlatformSettings>) => {
    const merged = { ...platformSettings, ...newSettings };
    setPlatformSettings(merged);
    try {
      localStorage.setItem('nexa_platform_settings', JSON.stringify(merged));
    } catch (e) {}
    await Promise.all([
      fetch('/api/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      }).catch(() => {}),
      fetch('/api/admin/otp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smsGatewayActive: merged.smsGatewayActive !== false,
          smsGatewayProvider: merged.smsGatewayProvider || 'apitxt',
          smsSenderId: merged.smsSenderId || 'NEXAAI',
          smsAuthKey: merged.smsAuthKey || '',
          customSmsWebhookUrl: merged.customSmsWebhookUrl || '',
          otpValidityMinutes: merged.otpValidityMinutes || 5,
          enableMasterOtp: Boolean(merged.enableMasterOtp),
          masterFallbackOtp: merged.masterFallbackOtp || '888999',
          registrationOtpTemplate: merged.registrationOtpTemplate || '',
          forgotPasswordOtpTemplate: merged.forgotPasswordOtpTemplate || '',
          helpCenterUrl: merged.helpCenterUrl ?? '',
          helpCenterLinks: Array.isArray(merged.helpCenterLinks) ? merged.helpCenterLinks : [],
        }),
      }).catch(() => {}),
      dbService.savePlatformSettings(merged).catch(() => {}),
    ]);
  };

  const addProduct = async (product: InvestmentProduct) => {
    await dbService.saveProduct(product);
    setProducts((prev) => {
      const updated = [product, ...prev];
      try { localStorage.setItem('nexa_platform_products', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    showToast(`Investment product "${product.name}" launched!`, 'success');
  };

  const updateProduct = async (product: InvestmentProduct) => {
    await dbService.saveProduct(product);
    setProducts((prev) => {
      const updated = prev.map((p) => (p.id === product.id ? product : p));
      try { localStorage.setItem('nexa_platform_products', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    showToast(`Investment product "${product.name}" updated!`, 'success');
  };

  const deleteProduct = async (productId: string) => {
    await dbService.deleteProduct(productId);
    setProducts((prev) => {
      const updated = prev.filter((p) => p.id !== productId);
      try { localStorage.setItem('nexa_platform_products', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    showToast('Product removed from platform', 'info');
  };

  const addNotice = async (notice: NoticeItem) => {
    await dbService.saveNotice(notice);
    setNotices((prev) => [notice, ...prev]);
    showToast('Official notice published!', 'success');
  };

  const deleteNotice = async (noticeId: string) => {
    await dbService.deleteNotice(noticeId);
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    showToast('Notice removed', 'info');
  };

  const addPromoCode = async (promo: CustomPromoCode) => {
    await dbService.savePromoCode(promo);
    setPromoCodes((prev) => {
      const exists = prev.some((p) => p.id === promo.id);
      if (exists) {
        return prev.map((p) => (p.id === promo.id ? promo : p));
      }
      return [promo, ...prev];
    });
    showToast(`Promo code ${promo.code} saved!`, 'success');
  };

  const deletePromoCode = async (promoId: string, promoCode?: string) => {
    const target = promoCodes.find(
      (p) => p.id === promoId || (promoCode && p.code.toUpperCase() === promoCode.toUpperCase())
    );
    const code = promoCode || target?.code;
    await dbService.deletePromoCode(promoId, code);
    setPromoCodes((prev) =>
      prev.filter((p) => p.id !== promoId && (!code || p.code.toUpperCase() !== code.toUpperCase()))
    );
    showToast(`Gift code "${code || promoId}" permanently deleted (स्थायी रूप से हटा दिया गया)`, 'info');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        theme,
        setTheme,
        deviceMode,
        setDeviceMode,
        activeTab,
        setActiveTab,
        goBack,
        login,
        register,
        resetUserPassword,
        logout,
        updateNickname,
        saveBankDetails,
        lookupReferrer,
        activeReferrer,
        recharge,
        submitManualRecharge,
        withdraw,
        investInProduct,
        claimDailyDividends,
        dailyCheckIn,
        spinWheelPrize,
        redeemGiftCode,
        orders,
        refreshOrders,
        transactions,
        teamMembers,
        refreshTeamMembers,
        activeModal,
        openModal,
        closeModal,
        paymentFailedData,
        showPaymentFailedModal,
        closePaymentFailedModal,
        rewardsModalTab,
        setRewardsModalTab,
        openRewardsModal,
        selectedProductForInvest,
        setSelectedProductForInvest,
        ecommerceOrders,
        createEcommerceOrder,
        selectedProductForCheckout,
        setSelectedProductForCheckout,
        supportMessages,
        sendSupportMessage,
        isSupportTyping,
        isCloudSynced,
        isAdminView,
        setIsAdminView,
        platformSettings,
        updatePlatformSettings,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        notices,
        addNotice,
        deleteNotice,
        promoCodes,
        addPromoCode,
        deletePromoCode,
        adminUsers,
        loadAdminUsers,
        adminCreateUser,
        adminUpdateUser,
        adminDeleteUser,
        adminManualBalanceAdjust,
        adminTransactions,
        loadAdminTransactions,
        adminApproveRecharge,
        adminRejectRecharge,
        adminApproveWithdrawal,
        adminRejectWithdrawal,
        adminOrders,
        loadAdminOrders,
        adminApproveOrder,
        adminPauseOrder,
        adminResumeOrder,
        adminCancelOrder,
        adminPayoutOrderDividend,
        adminResetOrderTimer,
        adminUpdateOrder,
        adminDeleteOrder,
        getAvailableSpins,
        buyExtraSpinWithBalance,
        adminGrantExtraSpins,
        updateSpinPrizes,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
