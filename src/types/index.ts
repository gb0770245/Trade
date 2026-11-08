export type ThemeMode = 'teal-clean' | 'obsidian-gold' | 'cyber-hydrogen';

export interface SpinPrizeConfig {
  id: string;
  label: string;
  value: number;
  type: 'cash' | 'spins' | 'vip_points' | 'luck';
  color: string;
  probabilityWeight: number; // e.g., 35 for 35% probability
  isEnabled: boolean;
}

export interface User {
  id: string;
  phone: string;
  password?: string;
  nickname: string;
  avatar: string;
  invitationCode: string;
  rechargeBalance: number;
  withdrawalBalance: number;
  productRevenue: number;
  vipLevel: number;
  totalInvested: number;
  checkInStreak: number;
  lastCheckInDate: string | null;
  spinChances: number;
  lastSpinDate?: string | null;
  dailySpinsUsedToday?: number;
  bonusSpins?: number;
  status?: 'active' | 'frozen' | 'suspended';
  role?: 'user' | 'admin';
  invitedBy?: string; // Invitation code of inviter who referred this user
  inviterName?: string; // Nickname / display name of the user who referred this user
  inviterId?: string; // User ID of direct Tier 1 inviter
  totalReferrals?: number; // Total direct invites
  totalCommissionEarned?: number; // Total commission earned in INR
  redeemedCodes?: string[]; // Promo and gift codes claimed by user
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId: string;
  };
  isExplicitZeroReset?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReferrerInfo {
  valid: boolean;
  name: string;
  code: string;
  phoneMasked?: string;
  id?: string;
}

export interface PlatformSettings {
  merchantUpiId: string;
  merchantPayeeName?: string;
  merchantQrUrl?: string;
  isManualUpiEnabled?: boolean;
  autoDynamicQrEnabled?: boolean;
  manualDepositInstructions?: string;
  requireAdminRechargeApproval?: boolean; // When true, no automatic wallet credit on deposit; admin must verify and approve
  showUpiVpaDetails?: boolean; // When false, hides raw UPI ID and app intent buttons (QR scan only)
  minRecharge: number;
  minWithdrawal: number;
  withdrawalFeePercent?: number; // Configurable platform withdrawal handling fee % (e.g. 5 for 5%, 0 for free)
  isWithdrawalEnabled: boolean;
  isRechargeEnabled: boolean;
  isSpinEnabled: boolean;
  isBonusEnabled?: boolean;
  tier1Commission: number;
  tier2Commission: number;
  tier3Commission: number;
  dailyBonusBase: number;
  smsGatewayActive: boolean;
  withdrawalNotice?: string;
  rechargeNotice?: string;
  adminPin?: string;
  systemAnnouncement?: string;

  // Lucky Spin Access & Control Fields
  dailyFreeSpins: number; // Free daily spins per user
  spinPrice: number; // Cost in INR to buy 1 extra spin with balance
  isSpinPurchaseEnabled: boolean; // Allow purchasing spins with balance
  dailyPrizeDistributionCap: number; // Max total INR cash prizes distributed per day
  totalPrizeDistributedToday?: number; // Total INR prize won today across all users
  lastDistributionResetDate?: string; // Date of last distribution pool reset

  // Extra Lucky Spin Automation Triggers
  extraSpinOnRecharge: boolean; // Award extra spin on recharge
  rechargeThresholdForSpin: number; // Amount needed per extra spin (e.g. $5)
  extraSpinOnInvite: boolean; // Award extra spin when invite registers/recharges
  spinsPerInvite: number; // Extra spins count per invite
  extraSpinOnInvestment: boolean; // Award extra spin on buying product contract
  spinsPerInvestment: number; // Extra spins count per product
  extraSpinOnCheckIn: boolean; // Award extra spin on daily check-in
  spinsPerCheckIn: number; // Extra spins count per check-in

  // Configurable Wheel Prizes
  spinPrizes?: SpinPrizeConfig[];

  // PayU India Payment Gateway Settings
  isPayUEnabled: boolean;
  payuMerchantKey: string;
  payuMerchantSalt?: string;
  payuMode?: 'test' | 'live';
  payuMerchantName?: string;
  payuLogoUrl?: string;
  payuThemeColor?: string;

  // Razorpay Gateway Settings (Legacy / Backward Compatibility)
  isRazorpayEnabled?: boolean;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  razorpayMerchantName?: string;
  razorpayLogoUrl?: string;
  razorpayThemeColor?: string;

  // E-Commerce Shopping & Compliance Settings
  isShoppingModeActive: boolean;
  storeName: string;
  companyLegalName: string;
  merchantAddress: string;
  supportEmail: string;
  supportPhone: string;
  gstNumber?: string;
  shippingDays: string;

  // Dynamic Home Banners Carousel Settings
  homeBanners?: HomeBanner[];
  bannerAutoPlaySpeedSeconds?: number;

  // 7-Day Daily Check-in Streak Payouts (Day 1 to Day 7 in INR)
  checkInPayouts?: number[];
  checkInDay7ExtraSpin?: boolean;

  // OTP & SMS Gateway Templates & Configuration
  registrationOtpTemplate?: string;
  forgotPasswordOtpTemplate?: string;
  smsGatewayProvider?: 'apitxt' | 'fast2sms' | 'custom';
  smsSenderId?: string;
  smsAuthKey?: string;
  customSmsWebhookUrl?: string;
  otpValidityMinutes?: number;
  enableMasterOtp?: boolean;
  masterFallbackOtp?: string;

  // Product Investment Purchase & Admin Control Settings
  requireAdminOrderApproval?: boolean; // When true, user product purchases require admin approval before activating
  isInvestmentEnabled?: boolean; // Master toggle to enable or pause investment product purchases
  investmentDisabledNotice?: string;
  allowUserDividendClaims?: boolean; // Master toggle to allow or pause daily dividend claims

  // Help Center Direct Redirect Link & Custom Links (Admin Configurable)
  helpCenterUrl?: string;
  helpCenterLinks?: HelpCenterLinkItem[];
}

export interface HelpCenterLinkItem {
  id: string;
  title: string;
  url: string;
  subtitle?: string;
  isActive?: boolean;
}

export interface OtpLogItem {
  id: string;
  mobile: string;
  otp: string;
  purpose: 'register' | 'forgot-password' | 'test';
  message: string;
  status: 'pending' | 'verified' | 'wrong_otp' | 'expired';
  attempts: number;
  createdAt: string;
  expiresAt: number;
  provider?: string;
  senderId?: string;
  gatewayStatus?: string;
}

export type BannerActionType =
  | 'invest'
  | 'recharge'
  | 'spin'
  | 'team'
  | 'support'
  | 'app_download'
  | 'notice'
  | 'rewards'
  | 'url';

export interface HomeBanner {
  id: string;
  imageUrl: string;
  badge?: string;
  title: string;
  subtitle?: string;
  buttonText?: string;
  actionType: BannerActionType;
  actionUrl?: string;
  isActive: boolean;
  order: number;
}

export interface CustomPromoCode {
  id: string;
  code: string;
  amount: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
}

export interface InvestmentProduct {
  id: string;
  name: string;
  category: 'steady' | 'benefits' | 'event';
  vipRequirement: number;
  price: number;
  dailyEarnings: number;
  dailyPercent?: number;
  cycleDays: number;
  totalRevenue: number;
  image: string;
  accentColor: string;
  soldCount: number;
  totalUnits: number;
  description: string;
  highlightBadge?: string;
  // Retail E-Commerce Shopping Fields
  retailName?: string;
  sku?: string;
  mrp?: number;
  warranty?: string;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  shippingWeight?: string;
  updatedAt?: number | string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
}

export interface EcommerceOrder {
  id: string;
  orderNumber: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentId: string;
  status: 'confirmed' | 'processing' | 'dispatched' | 'delivered';
  trackingNumber?: string;
  courierPartner?: string;
  createdAt: string;
  estimatedDelivery: string;
  invoiceNumber: string;
}

export interface InvestmentOrder {
  id: string;
  productId: string;
  productName: string;
  price: number;
  dailyEarnings: number;
  totalRevenue: number;
  cycleDays: number;
  daysElapsed: number;
  totalAccrued: number;
  purchaseDate: string;
  lastClaimDate: string;
  purchaseTimestamp?: number; // epoch ms of contract purchase
  lastClaimTimestamp?: number; // epoch ms of last claimed dividend
  nextClaimTimestamp?: number; // epoch ms when next dividend can be claimed (strictly 24h later)
  status: 'active' | 'completed' | 'pending_approval' | 'paused' | 'cancelled';
  userId?: string;
  userPhone?: string;
  userNickname?: string;
  adminNote?: string;
  pauseReason?: string;
  approvedAt?: string;
  cancelledAt?: string;
  refundAmount?: number;
}

export interface Transaction {
  id: string;
  userId?: string;
  type: 'recharge' | 'withdraw' | 'earnings' | 'bonus' | 'commission' | 'spin_win';
  amount: number;
  title: string;
  timestamp: string;
  createdAt?: number; // Numeric epoch ms for chronological line-by-line ordering
  status: 'completed' | 'processing' | 'rejected';
  referenceNo: string;
  paymentMethod?: string;
  feeAmount?: number;
  netAmount?: number;
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
  };
  utrNumber?: string;
  screenshotUrl?: string;
  payeeUpi?: string;
  amountInr?: number;
  adminNote?: string;
}

export interface TeamMember {
  id: string;
  phoneMasked: string;
  nickname: string;
  level: 1 | 2 | 3; // Tier 1 (10%), Tier 2 (3%), Tier 3 (1%)
  joinDate: string;
  rechargeTotal: number;
  commissionContributed: number;
}

export interface VIPTier {
  level: number;
  name: string;
  minInvestment: number;
  dailyBonusRate: string;
  withdrawalFeePercent: number;
  dailyWithdrawalLimit: number;
  perks: string[];
}

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  date: string;
  tag: string;
  isImportant?: boolean;
}

export interface NewsArticle {
  id: string;
  title: string;
  category: string;
  readTime: string;
  date: string;
  snippet: string;
  content: string;
  views: number;
}

export interface OrderSuccessData {
  orderId: string;
  userName: string;
  userPhone?: string;
  productName: string;
  amount: number;
  dailyEarnings?: number;
  cycleDays?: number;
  totalRevenue?: number;
  category?: string;
  timestamp?: string;
  status?: string;
}
