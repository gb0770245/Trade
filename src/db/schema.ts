import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  timestamp,
  doublePrecision,
  integer,
  bigint,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';

// Users table with Firebase UID and complete profile / wallet / MLM team linkage
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID / local persistent ID
  phone: text('phone'),
  password: text('password'),
  nickname: text('nickname'),
  avatar: text('avatar').default('HD'),
  invitationCode: text('invitation_code'),
  invitedBy: text('invited_by'), // Invitation code of upline
  inviterName: text('inviter_name'),
  inviterId: text('inviter_id'),
  rechargeBalance: doublePrecision('recharge_balance').default(0),
  withdrawalBalance: doublePrecision('withdrawal_balance').default(0),
  productRevenue: doublePrecision('product_revenue').default(0),
  vipLevel: integer('vip_level').default(0),
  totalInvested: doublePrecision('total_invested').default(0),
  checkInStreak: integer('check_in_streak').default(0),
  lastCheckInDate: text('last_check_in_date'),
  spinChances: integer('spin_chances').default(0),
  status: text('status').default('active'),
  role: text('role').default('user'),
  totalReferrals: integer('total_referrals').default(0),
  totalCommissionEarned: doublePrecision('total_commission_earned').default(0),
  bankDetails: jsonb('bank_details'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Transactions table for recharge, withdraw, bonus, earnings, etc.
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(), // 'recharge' | 'withdraw' | 'earnings' | 'bonus' | 'commission' | 'spin_win'
  amount: doublePrecision('amount').notNull(),
  title: text('title').notNull(),
  timestamp: text('timestamp').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }),
  status: text('status').notNull().default('completed'), // 'completed' | 'processing' | 'rejected'
  referenceNo: text('reference_no').notNull(),
  paymentMethod: text('payment_method'),
  feeAmount: doublePrecision('fee_amount').default(0),
  netAmount: doublePrecision('net_amount').default(0),
  bankDetails: jsonb('bank_details'),
});

// Investment Orders table
export const investmentOrders = pgTable('investment_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  price: doublePrecision('price').notNull(),
  dailyEarnings: doublePrecision('daily_earnings').notNull(),
  totalRevenue: doublePrecision('total_revenue').notNull(),
  cycleDays: integer('cycle_days').notNull(),
  daysElapsed: integer('days_elapsed').notNull().default(0),
  totalAccrued: doublePrecision('total_accrued').notNull().default(0),
  purchaseDate: text('purchase_date').notNull(),
  lastClaimDate: text('last_claim_date'),
  purchaseTimestamp: bigint('purchase_timestamp', { mode: 'number' }),
  lastClaimTimestamp: bigint('last_claim_timestamp', { mode: 'number' }),
  nextClaimTimestamp: bigint('next_claim_timestamp', { mode: 'number' }),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'pending_approval' | 'paused' | 'cancelled'
  userPhone: text('user_phone'),
  userNickname: text('user_nickname'),
  adminNote: text('admin_note'),
  pauseReason: text('pause_reason'),
  approvedAt: text('approved_at'),
  cancelledAt: text('cancelled_at'),
  refundAmount: doublePrecision('refund_amount').default(0),
});

// Ecommerce Retail Orders
export const ecommerceOrders = pgTable('ecommerce_orders', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  orderNumber: text('order_number').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  price: doublePrecision('price').notNull(),
  quantity: integer('quantity').notNull().default(1),
  shippingAddress: jsonb('shipping_address'),
  paymentMethod: text('payment_method'),
  paymentId: text('payment_id'),
  status: text('status').notNull().default('confirmed'),
  trackingNumber: text('tracking_number'),
  courierPartner: text('courier_partner'),
  createdAt: text('created_at'),
  estimatedDelivery: text('estimated_delivery'),
  invoiceNumber: text('invoice_number'),
});

// Platform Settings (Key-Value)
export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Products table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title'),
  price: doublePrecision('price').notNull(),
  dailyEarnings: doublePrecision('daily_earnings').notNull(),
  totalRevenue: doublePrecision('total_revenue').notNull(),
  cycleDays: integer('cycle_days').notNull(),
  category: text('category').default('solar'),
  image: text('image'),
  minVip: integer('min_vip').default(0),
  stock: integer('stock').default(999),
  isHot: boolean('is_hot').default(false),
  isPopular: boolean('is_popular').default(false),
  soldCount: integer('sold_count').default(0),
  description: text('description'),
  specs: jsonb('specs'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Promo Codes / Gift Vouchers table
export const promoCodes = pgTable('promo_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  amount: doublePrecision('amount').notNull(),
  maxUses: integer('max_uses').default(1),
  usedCount: integer('used_count').default(0),
  usedBy: jsonb('used_by'),
  expiresAt: text('expires_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Notices & Announcements table
export const notices = pgTable('notices', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type').default('info'),
  date: text('date'),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  investmentOrders: many(investmentOrders),
  ecommerceOrders: many(ecommerceOrders),
}));

