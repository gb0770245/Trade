import { InvestmentProduct, VIPTier, NoticeItem, NewsArticle, SpinPrizeConfig, HomeBanner } from '../types';
import realFirestoreProducts from './firestoreProducts.json';

export const DEFAULT_HOME_BANNERS: HomeBanner[] = [
  {
    id: 'banner-1',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80',
    badge: 'OFFICIAL HARDWARE STORE',
    title: 'Nexa Edge AI Compute Sticks & Processors',
    subtitle: 'Next-Gen Neural Co-processors with 16 TOPS · Free Express Delivery Across India',
    buttonText: 'Shop Products',
    actionType: 'invest',
    isActive: true,
    order: 1,
  },
  {
    id: 'banner-2',
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1000&q=80',
    badge: 'SMART EDGE AUTOMATION',
    title: 'Quantum NPU Home Hub & IoT Controller',
    subtitle: '100% Genuine Certified Hardware · 3-Year On-Site Manufacturer Warranty',
    buttonText: 'Order Now',
    actionType: 'invest',
    isActive: true,
    order: 2,
  },
  {
    id: 'banner-3',
    imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1000&q=80',
    badge: 'ENTERPRISE AI BLADES',
    title: 'Nexa High-Performance Cloud GPU Clusters',
    subtitle: 'Dedicated high-bandwidth compute nodes for AI rendering & inference',
    buttonText: 'View Specs',
    actionType: 'invest',
    isActive: true,
    order: 3,
  },
  {
    id: 'banner-4',
    imageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1000&q=80',
    badge: 'RAZORPAY VERIFIED STORE',
    title: 'Safe & Secure Shopping with 7-Day Returns',
    subtitle: 'Direct Razorpay UPI, Cards & NetBanking · Dispatched in 24-48 Hours',
    buttonText: 'Explore Catalog',
    actionType: 'invest',
    isActive: true,
    order: 4,
  },
];

export const INVESTMENT_PRODUCTS: InvestmentProduct[] = (realFirestoreProducts as unknown) as InvestmentProduct[];

export const VIP_TIERS: VIPTier[] = [
  {
    level: 0,
    name: 'VIP 0 - New Explorer',
    minInvestment: 0,
    dailyBonusRate: '0.0%',
    withdrawalFeePercent: 10,
    dailyWithdrawalLimit: 5000,
    perks: ['Standard product access', '1 Daily Lucky Spin', 'Standard customer care'],
  },
  {
    level: 1,
    name: 'VIP 1 - Green Partner',
    minInvestment: 280,
    dailyBonusRate: '+2.0%',
    withdrawalFeePercent: 8,
    dailyWithdrawalLimit: 25000,
    perks: ['Unlock Benefits category', '2 Daily Lucky Spins', 'Priority UPI withdrawal (< 15 mins)'],
  },
  {
    level: 2,
    name: 'VIP 2 - Clean Energy Pioneer',
    minInvestment: 1500,
    dailyBonusRate: '+4.5%',
    withdrawalFeePercent: 6,
    dailyWithdrawalLimit: 100000,
    perks: ['Unlock all Event projects', '3 Daily Lucky Spins', 'Dedicated Relationship Manager'],
  },
  {
    level: 3,
    name: 'VIP 3 - Industrial Elite',
    minInvestment: 5000,
    dailyBonusRate: '+7.0%',
    withdrawalFeePercent: 4,
    dailyWithdrawalLimit: 300000,
    perks: ['5 Daily Lucky Spins', 'Zero-fee monthly withdrawal quota', 'Exclusive anniversary red packets'],
  },
  {
    level: 4,
    name: 'VIP 4 - Global Benefactor',
    minInvestment: 15000,
    dailyBonusRate: '+10.0%',
    withdrawalFeePercent: 2,
    dailyWithdrawalLimit: 1000000,
    perks: ['Unlimited Daily Lucky Spins', 'Instant 1-minute RTGS / USDT withdrawal', 'VIP corporate physical gifting'],
  },
];

export const INITIAL_NOTICES: NoticeItem[] = [
  {
    id: 'n-1',
    title: 'Dividend Distribution for Clean Hydrogen Alpha Completed',
    content: 'Today’s daily returns of $240.80 per VIP1 unit have been successfully settled directly into members’ Withdrawal Balance. Check your account records.',
    date: 'Today, 18:30',
    tag: 'Financial Settlement',
    isImportant: true,
  },
  {
    id: 'n-2',
    title: 'Instant UPI 2.0 Fast Deposit Channel Fully Active',
    content: 'To enhance deposit speed, members can now use PhonePe, Google Pay, and Paytm via instant automated QR confirmation with zero delay.',
    date: 'Yesterday, 14:15',
    tag: 'System Upgrade',
  },
  {
    id: 'n-3',
    title: 'Team Referral Commission Milestone: 10% Tier-1 Direct Bonus',
    content: 'Invite colleagues and friends to join Nexa AI clean energy projects. Earn instant 10% from Level 1, 3% from Level 2, and 1% from Level 3 deposits.',
    date: '23 Oct, 10:00',
    tag: 'Referral Rewards',
  },
  {
    id: 'n-4',
    title: 'Security Notice: Official Payment Verification Standards',
    content: 'Please ensure you always make add money transfers only through the dynamically generated UPI QR and payment links on our official platform.',
    date: '20 Oct, 09:00',
    tag: 'Security Alert',
  },
];

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 'art-1',
    title: 'Nexa AI Expands High-Yield Hydrogen Electrolyzer Grid',
    category: 'Industry Outlook',
    readTime: '3 min read',
    date: '24 Oct 2026',
    snippet: 'Official expansion milestones confirm additional 300MW clean hydrogen capacity, distributing heightened daily dividend yield to early individual stakeholders.',
    content: 'Clean energy transition continues to accelerate globally. Through smart decentralized financing and micro-stakeholder models, renewable installations generate reliable cash flow backed by real physical electrical output.',
    views: 12480,
  },
  {
    id: 'art-2',
    title: 'How Daily Compounding in Renewable Projects Maximizes Monthly ROI',
    category: 'Earning Guide',
    readTime: '4 min read',
    date: '22 Oct 2026',
    snippet: 'Strategic guidance on re-investing product dividends into short-cycle benefit tankers to optimize capital velocity and VIP tier status.',
    content: 'Members who regularly compound daily yields into complementary steady and flash benefit contracts achieve exponential cumulative returns while qualifying for lower withdrawal fees.',
    views: 9340,
  },
  {
    id: 'art-3',
    title: 'Government Subsidies and Carbon Credit Dividends Explained',
    category: 'Policy & Growth',
    readTime: '2 min read',
    date: '19 Oct 2026',
    snippet: 'Understanding the statutory framework that secures continuous tariff guarantees for solar and green hydrogen power producers.',
    content: 'Long-term Power Purchase Agreements (PPAs) with tier-1 industrial clients provide the steady foundation for daily member payouts, ensuring resilience against market volatility.',
    views: 7120,
  },
];

export const SPIN_PRIZES: SpinPrizeConfig[] = [
  { id: 'prize-1', label: '$20 Cash', value: 20, type: 'cash', color: '#10B981', probabilityWeight: 35, isEnabled: true },
  { id: 'prize-2', label: '$50 Bonus', value: 50, type: 'cash', color: '#0EA5E9', probabilityWeight: 25, isEnabled: true },
  { id: 'prize-3', label: 'VIP Pass', value: 100, type: 'vip_points', color: '#8B5CF6', probabilityWeight: 5, isEnabled: true },
  { id: 'prize-4', label: '$100 Cash', value: 100, type: 'cash', color: '#F59E0B', probabilityWeight: 10, isEnabled: true },
  { id: 'prize-5', label: '+2 Extra Spins', value: 2, type: 'spins', color: '#6366F1', probabilityWeight: 10, isEnabled: true },
  { id: 'prize-6', label: '$280 Mega', value: 280, type: 'cash', color: '#EC4899', probabilityWeight: 4, isEnabled: true },
  { id: 'prize-7', label: '$500 Jackpot', value: 500, type: 'cash', color: '#EF4444', probabilityWeight: 1, isEnabled: true },
  { id: 'prize-8', label: 'Better Luck', value: 0, type: 'luck', color: '#64748B', probabilityWeight: 10, isEnabled: true },
];
