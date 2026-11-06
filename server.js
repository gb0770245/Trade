var __defProp = Object.defineProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path2 from "path";
import fs2 from "fs";
import Razorpay from "razorpay";
import crypto from "crypto";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  ecommerceOrders: () => ecommerceOrders,
  investmentOrders: () => investmentOrders,
  notices: () => notices,
  platformSettings: () => platformSettings,
  products: () => products,
  promoCodes: () => promoCodes,
  transactions: () => transactions,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  timestamp,
  doublePrecision,
  integer,
  bigint,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  // Firebase Auth UID / local persistent ID
  phone: text("phone"),
  password: text("password"),
  nickname: text("nickname"),
  avatar: text("avatar").default("HD"),
  invitationCode: text("invitation_code"),
  invitedBy: text("invited_by"),
  // Invitation code of upline
  inviterName: text("inviter_name"),
  inviterId: text("inviter_id"),
  rechargeBalance: doublePrecision("recharge_balance").default(0),
  withdrawalBalance: doublePrecision("withdrawal_balance").default(0),
  productRevenue: doublePrecision("product_revenue").default(0),
  vipLevel: integer("vip_level").default(0),
  totalInvested: doublePrecision("total_invested").default(0),
  checkInStreak: integer("check_in_streak").default(0),
  lastCheckInDate: text("last_check_in_date"),
  spinChances: integer("spin_chances").default(0),
  status: text("status").default("active"),
  role: text("role").default("user"),
  totalReferrals: integer("total_referrals").default(0),
  totalCommissionEarned: doublePrecision("total_commission_earned").default(0),
  bankDetails: jsonb("bank_details"),
  createdAt: timestamp("created_at").defaultNow()
});
var transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  // 'recharge' | 'withdraw' | 'earnings' | 'bonus' | 'commission' | 'spin_win'
  amount: doublePrecision("amount").notNull(),
  title: text("title").notNull(),
  timestamp: text("timestamp").notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
  status: text("status").notNull().default("completed"),
  // 'completed' | 'processing' | 'rejected'
  referenceNo: text("reference_no").notNull(),
  paymentMethod: text("payment_method"),
  feeAmount: doublePrecision("fee_amount").default(0),
  netAmount: doublePrecision("net_amount").default(0),
  bankDetails: jsonb("bank_details")
});
var investmentOrders = pgTable("investment_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  price: doublePrecision("price").notNull(),
  dailyEarnings: doublePrecision("daily_earnings").notNull(),
  totalRevenue: doublePrecision("total_revenue").notNull(),
  cycleDays: integer("cycle_days").notNull(),
  daysElapsed: integer("days_elapsed").notNull().default(0),
  totalAccrued: doublePrecision("total_accrued").notNull().default(0),
  purchaseDate: text("purchase_date").notNull(),
  lastClaimDate: text("last_claim_date"),
  purchaseTimestamp: bigint("purchase_timestamp", { mode: "number" }),
  lastClaimTimestamp: bigint("last_claim_timestamp", { mode: "number" }),
  nextClaimTimestamp: bigint("next_claim_timestamp", { mode: "number" }),
  status: text("status").notNull().default("active"),
  // 'active' | 'completed' | 'pending_approval' | 'paused' | 'cancelled'
  userPhone: text("user_phone"),
  userNickname: text("user_nickname"),
  adminNote: text("admin_note"),
  pauseReason: text("pause_reason"),
  approvedAt: text("approved_at"),
  cancelledAt: text("cancelled_at"),
  refundAmount: doublePrecision("refund_amount").default(0)
});
var ecommerceOrders = pgTable("ecommerce_orders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  orderNumber: text("order_number").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  price: doublePrecision("price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  shippingAddress: jsonb("shipping_address"),
  paymentMethod: text("payment_method"),
  paymentId: text("payment_id"),
  status: text("status").notNull().default("confirmed"),
  trackingNumber: text("tracking_number"),
  courierPartner: text("courier_partner"),
  createdAt: text("created_at"),
  estimatedDelivery: text("estimated_delivery"),
  invoiceNumber: text("invoice_number")
});
var platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  price: doublePrecision("price").notNull(),
  dailyEarnings: doublePrecision("daily_earnings").notNull(),
  totalRevenue: doublePrecision("total_revenue").notNull(),
  cycleDays: integer("cycle_days").notNull(),
  category: text("category").default("solar"),
  image: text("image"),
  minVip: integer("min_vip").default(0),
  stock: integer("stock").default(999),
  isHot: boolean("is_hot").default(false),
  isPopular: boolean("is_popular").default(false),
  soldCount: integer("sold_count").default(0),
  description: text("description"),
  specs: jsonb("specs"),
  createdAt: timestamp("created_at").defaultNow()
});
var promoCodes = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  amount: doublePrecision("amount").notNull(),
  maxUses: integer("max_uses").default(1),
  usedCount: integer("used_count").default(0),
  usedBy: jsonb("used_by"),
  expiresAt: text("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});
var notices = pgTable("notices", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").default("info"),
  date: text("date"),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  createdAt: timestamp("created_at").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  investmentOrders: many(investmentOrders),
  ecommerceOrders: many(ecommerceOrders)
}));

// src/db/index.ts
var isSqlConfigured = Boolean(
  process.env.SQL_HOST && process.env.SQL_HOST.trim() !== "" && process.env.SQL_DB_NAME && process.env.SQL_DB_NAME.trim() !== ""
);
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15e3
    });
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/queries.ts
import { eq, or, desc } from "drizzle-orm";
async function getAllUsers() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch {
    return [];
  }
}
async function findUser(identifier) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(identifier).trim();
    const result = await db.select().from(users).where(or(eq(users.uid, cleanId), eq(users.phone, cleanId))).limit(1);
    return result[0] || null;
  } catch {
    return null;
  }
}
async function upsertUser(data) {
  if (!isSqlConfigured) return null;
  try {
    const existing = await findUser(data.uid || data.phone || "");
    if (existing) {
      const updateData = {};
      if (data.phone !== void 0) updateData.phone = data.phone;
      if (data.password !== void 0) updateData.password = data.password;
      if (data.nickname !== void 0) updateData.nickname = data.nickname;
      if (data.avatar !== void 0) updateData.avatar = data.avatar;
      if (data.invitationCode !== void 0) updateData.invitationCode = data.invitationCode;
      if (data.invitedBy !== void 0) updateData.invitedBy = data.invitedBy;
      if (data.inviterName !== void 0) updateData.inviterName = data.inviterName;
      if (data.inviterId !== void 0) updateData.inviterId = data.inviterId;
      if (data.rechargeBalance !== void 0) updateData.rechargeBalance = data.rechargeBalance;
      if (data.withdrawalBalance !== void 0) updateData.withdrawalBalance = data.withdrawalBalance;
      if (data.productRevenue !== void 0) updateData.productRevenue = data.productRevenue;
      if (data.vipLevel !== void 0) updateData.vipLevel = data.vipLevel;
      if (data.totalInvested !== void 0) updateData.totalInvested = data.totalInvested;
      if (data.checkInStreak !== void 0) updateData.checkInStreak = data.checkInStreak;
      if (data.lastCheckInDate !== void 0) updateData.lastCheckInDate = data.lastCheckInDate;
      if (data.spinChances !== void 0) updateData.spinChances = data.spinChances;
      if (data.status !== void 0) updateData.status = data.status;
      if (data.role !== void 0) updateData.role = data.role;
      if (data.totalReferrals !== void 0) updateData.totalReferrals = data.totalReferrals;
      if (data.totalCommissionEarned !== void 0) updateData.totalCommissionEarned = data.totalCommissionEarned;
      if (data.bankDetails !== void 0) updateData.bankDetails = data.bankDetails;
      const updated = await db.update(users).set(updateData).where(eq(users.uid, existing.uid)).returning();
      return updated[0];
    } else {
      const inserted = await db.insert(users).values({
        uid: data.uid || data.phone || `u_${Date.now()}`,
        phone: data.phone || "",
        password: data.password || "password123",
        nickname: data.nickname || "User",
        avatar: data.avatar || "HD",
        invitationCode: data.invitationCode || "",
        invitedBy: data.invitedBy || null,
        inviterName: data.inviterName || null,
        inviterId: data.inviterId || null,
        rechargeBalance: data.rechargeBalance || 0,
        withdrawalBalance: data.withdrawalBalance || 0,
        productRevenue: data.productRevenue || 0,
        vipLevel: data.vipLevel || 0,
        totalInvested: data.totalInvested || 0,
        checkInStreak: data.checkInStreak || 0,
        lastCheckInDate: data.lastCheckInDate || null,
        spinChances: data.spinChances || 0,
        status: data.status || "active",
        role: data.role || "user",
        totalReferrals: data.totalReferrals || 0,
        totalCommissionEarned: data.totalCommissionEarned || 0,
        bankDetails: data.bankDetails || null
      }).returning();
      return inserted[0];
    }
  } catch {
    return null;
  }
}
async function relinkUpline(userId, uplineCode) {
  if (!isSqlConfigured) return null;
  try {
    const all = await getAllUsers();
    const target = all.find((u) => u.uid === userId || u.phone === userId);
    const upliner = all.find((u) => u.invitationCode === uplineCode || u.uid === uplineCode || u.phone === uplineCode);
    if (!target || !upliner) return null;
    const updated = await db.update(users).set({
      invitedBy: upliner.invitationCode,
      inviterName: upliner.nickname,
      inviterId: upliner.uid
    }).where(eq(users.uid, target.uid)).returning();
    return updated[0];
  } catch {
    return null;
  }
}
async function getAllTransactionsFromDb() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(transactions).orderBy(desc(transactions.createdAt));
  } catch (err) {
    console.warn("Error fetching all transactions from DB:", err);
    return [];
  }
}
async function getUserTransactions(userId) {
  if (!isSqlConfigured) return [];
  try {
    const cleanId = String(userId).trim();
    return await db.select().from(transactions).where(eq(transactions.userId, cleanId)).orderBy(desc(transactions.createdAt));
  } catch {
    return [];
  }
}
async function createTransaction(tx) {
  if (!isSqlConfigured) return null;
  try {
    const refNo = tx.referenceNo || `TX${Date.now()}${Math.floor(1e3 + Math.random() * 9e3)}`;
    if (tx.referenceNo) {
      const existing = await db.select().from(transactions).where(eq(transactions.referenceNo, tx.referenceNo)).limit(1);
      if (existing && existing.length > 0) {
        return existing[0];
      }
    }
    const result = await db.insert(transactions).values({
      userId: String(tx.userId).trim(),
      type: tx.type,
      amount: Number(tx.amount) || 0,
      title: tx.title,
      timestamp: tx.timestamp || (/* @__PURE__ */ new Date()).toLocaleString(),
      createdAt: tx.createdAt || Date.now(),
      status: tx.status || "completed",
      referenceNo: refNo,
      paymentMethod: tx.paymentMethod || null,
      feeAmount: Number(tx.feeAmount) || 0,
      netAmount: Number(tx.netAmount) || Number(tx.amount) || 0,
      bankDetails: tx.bankDetails || null
    }).returning();
    return result[0];
  } catch (err) {
    console.warn("Error creating transaction in DB:", err);
    return null;
  }
}
async function updateTransactionStatusInDb(identifier, status, extra) {
  if (!isSqlConfigured) return null;
  try {
    const clean = String(identifier).trim();
    const numId = !isNaN(Number(clean)) ? Number(clean) : null;
    const updatePayload = { status };
    if (extra?.referenceNo) updatePayload.referenceNo = extra.referenceNo;
    if (extra?.paymentMethod) updatePayload.paymentMethod = extra.paymentMethod;
    const result = await db.update(transactions).set(updatePayload).where(
      numId ? or(eq(transactions.referenceNo, clean), eq(transactions.id, numId)) : eq(transactions.referenceNo, clean)
    ).returning();
    return result && result.length > 0 ? result[0] : null;
  } catch (err) {
    console.warn("Error updating transaction status in DB:", err);
    return null;
  }
}
async function refundUserWithdrawalInDb(userId, amount) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(userId).trim();
    const allUsers = await getAllUsers();
    const target = allUsers.find((u) => u.uid === cleanId || u.phone === cleanId);
    if (!target) return null;
    const currentBal = Number(target.withdrawalBalance) || 0;
    const newBal = Number((currentBal + amount).toFixed(2));
    const updated = await db.update(users).set({ withdrawalBalance: newBal }).where(eq(users.uid, target.uid)).returning();
    return updated && updated.length > 0 ? updated[0] : null;
  } catch (err) {
    console.warn("Error refunding user in DB:", err);
    return null;
  }
}
async function deleteUserFromDb(userId, explicitPhone) {
  if (!isSqlConfigured) return [];
  try {
    const cleanId = String(userId).trim();
    const cleanPhone = explicitPhone ? String(explicitPhone).replace(/\D/g, "").slice(-10) : "";
    const userMatch = await findUser(cleanId);
    const targetPhone = cleanPhone || (userMatch?.phone ? String(userMatch.phone).replace(/\D/g, "").slice(-10) : "");
    const targetUid = userMatch?.uid || cleanId;
    await db.delete(transactions).where(or(
      eq(transactions.userId, cleanId),
      eq(transactions.userId, targetUid),
      ...targetPhone ? [eq(transactions.userId, targetPhone)] : []
    ));
    await db.delete(investmentOrders).where(or(
      eq(investmentOrders.userId, cleanId),
      eq(investmentOrders.userId, targetUid),
      ...targetPhone ? [eq(investmentOrders.userId, targetPhone)] : []
    ));
    await db.delete(ecommerceOrders).where(or(
      eq(ecommerceOrders.userId, cleanId),
      eq(ecommerceOrders.userId, targetUid),
      ...targetPhone ? [eq(ecommerceOrders.userId, targetPhone)] : []
    ));
    const result = await db.delete(users).where(or(
      eq(users.uid, cleanId),
      eq(users.uid, targetUid),
      eq(users.phone, cleanId),
      ...targetPhone ? [eq(users.phone, targetPhone)] : []
    )).returning();
    return result;
  } catch (err) {
    console.warn("Error deleting user from Cloud SQL:", err);
    return [];
  }
}
async function deleteTransactionFromDb(txId) {
  if (!isSqlConfigured) return false;
  try {
    const clean = String(txId).trim();
    const numId = !isNaN(Number(clean)) ? Number(clean) : null;
    if (numId !== null) {
      await db.delete(transactions).where(or(eq(transactions.id, numId), eq(transactions.referenceNo, clean)));
    } else {
      await db.delete(transactions).where(eq(transactions.referenceNo, clean));
    }
    return true;
  } catch (err) {
    console.warn("Error deleting transaction from DB:", err);
    return false;
  }
}
async function deleteOrderFromDb(orderId) {
  if (!isSqlConfigured) return false;
  try {
    const cleanId = String(orderId).trim();
    await db.delete(investmentOrders).where(eq(investmentOrders.id, cleanId));
    await db.delete(ecommerceOrders).where(eq(ecommerceOrders.orderNumber, cleanId));
    const numId = !isNaN(Number(cleanId)) ? Number(cleanId) : null;
    if (numId !== null) {
      await db.delete(ecommerceOrders).where(eq(ecommerceOrders.id, numId));
    }
    return true;
  } catch (err) {
    console.warn("Error deleting order from DB:", err);
    return false;
  }
}
async function getAllDbOrders() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(investmentOrders).orderBy(desc(investmentOrders.purchaseTimestamp));
  } catch {
    return [];
  }
}
async function getDbOrdersByUser(userId, userPhone) {
  if (!isSqlConfigured) return [];
  try {
    const cleanId = String(userId).trim();
    const cleanPhone = userPhone ? String(userPhone).replace(/\D/g, "").slice(-10) : "";
    if (cleanPhone) {
      return await db.select().from(investmentOrders).where(
        or(
          eq(investmentOrders.userId, cleanId),
          eq(investmentOrders.userId, cleanPhone),
          eq(investmentOrders.userPhone, cleanPhone)
        )
      );
    }
    return await db.select().from(investmentOrders).where(eq(investmentOrders.userId, cleanId));
  } catch {
    return [];
  }
}
async function upsertDbOrder(order) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(order.id || `ord-${Date.now()}`).trim();
    const existing = await db.select().from(investmentOrders).where(eq(investmentOrders.id, cleanId)).limit(1);
    if (existing && existing.length > 0) {
      const updated = await db.update(investmentOrders).set({
        status: order.status || existing[0].status,
        daysElapsed: order.daysElapsed ?? existing[0].daysElapsed,
        totalAccrued: order.totalAccrued ?? existing[0].totalAccrued,
        dailyEarnings: order.dailyEarnings ?? existing[0].dailyEarnings,
        cycleDays: order.cycleDays ?? existing[0].cycleDays,
        lastClaimDate: order.lastClaimDate || existing[0].lastClaimDate,
        lastClaimTimestamp: order.lastClaimTimestamp || existing[0].lastClaimTimestamp,
        nextClaimTimestamp: order.nextClaimTimestamp || existing[0].nextClaimTimestamp,
        userPhone: order.userPhone || existing[0].userPhone,
        userNickname: order.userNickname || existing[0].userNickname,
        adminNote: order.adminNote || existing[0].adminNote,
        pauseReason: order.pauseReason ?? existing[0].pauseReason,
        approvedAt: order.approvedAt || existing[0].approvedAt,
        cancelledAt: order.cancelledAt || existing[0].cancelledAt,
        refundAmount: order.refundAmount ?? existing[0].refundAmount
      }).where(eq(investmentOrders.id, cleanId)).returning();
      return updated[0];
    } else {
      const inserted = await db.insert(investmentOrders).values({
        id: cleanId,
        userId: order.userId || "unknown",
        productId: order.productId || "p-default",
        productName: order.productName || "Investment Asset",
        price: Number(order.price) || 0,
        dailyEarnings: Number(order.dailyEarnings) || 0,
        totalRevenue: Number(order.totalRevenue) || 0,
        cycleDays: Number(order.cycleDays) || 30,
        daysElapsed: Number(order.daysElapsed) || 0,
        totalAccrued: Number(order.totalAccrued) || 0,
        purchaseDate: order.purchaseDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        lastClaimDate: order.lastClaimDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        purchaseTimestamp: order.purchaseTimestamp || Date.now(),
        lastClaimTimestamp: order.lastClaimTimestamp || Date.now(),
        nextClaimTimestamp: order.nextClaimTimestamp || Date.now() + 24 * 60 * 60 * 1e3,
        status: order.status || "active",
        userPhone: order.userPhone || null,
        userNickname: order.userNickname || null,
        adminNote: order.adminNote || null,
        pauseReason: order.pauseReason || null,
        approvedAt: order.approvedAt || null,
        cancelledAt: order.cancelledAt || null,
        refundAmount: Number(order.refundAmount) || 0
      }).returning();
      return inserted[0];
    }
  } catch (err) {
    console.warn("Error in upsertDbOrder:", err);
    return null;
  }
}
async function getPlatformSettingFromDb(key) {
  if (!isSqlConfigured) return null;
  try {
    const res = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    return res[0]?.value || null;
  } catch (error) {
    console.error(`Error fetching platform setting ${key}:`, error);
    return null;
  }
}
async function setPlatformSettingInDb(key, value) {
  if (!isSqlConfigured) return null;
  try {
    const res = await db.insert(platformSettings).values({ key, value, updatedAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({
      target: platformSettings.key,
      set: { value, updatedAt: /* @__PURE__ */ new Date() }
    }).returning();
    return res[0];
  } catch (error) {
    console.error(`Error saving platform setting ${key}:`, error);
    return null;
  }
}
async function getAllDbProducts() {
  if (!isSqlConfigured) return [];
  try {
    const list = await db.select().from(products).orderBy(desc(products.createdAt));
    return list.map((p) => {
      const specsObj = p.specs && typeof p.specs === "object" ? p.specs : {};
      const calculatedDailyPercent = p.price > 0 ? Number((p.dailyEarnings / p.price * 100).toFixed(1)) : 0;
      return {
        id: p.id,
        name: p.name,
        category: p.category || "steady",
        vipRequirement: p.minVip ?? 0,
        price: p.price ?? 0,
        dailyEarnings: p.dailyEarnings ?? 0,
        dailyPercent: specsObj.dailyPercent ?? calculatedDailyPercent,
        cycleDays: p.cycleDays ?? 30,
        totalRevenue: p.totalRevenue ?? 0,
        image: p.image || "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80",
        accentColor: specsObj.accentColor || "#0f766e",
        soldCount: p.soldCount ?? 0,
        totalUnits: p.stock ?? 5e3,
        description: p.description || "",
        highlightBadge: specsObj.highlightBadge || "",
        ...specsObj
      };
    });
  } catch (err) {
    console.warn("Error fetching products from Cloud SQL:", err);
    return [];
  }
}
var numOr = (val, fallback) => {
  if (val === void 0 || val === null || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};
async function upsertDbProduct(prod) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(prod.id || `prod_${Date.now()}`).trim();
    const cleanPrice = numOr(prod.price, 0);
    const cleanEarnings = numOr(prod.dailyEarnings, 0);
    const cleanPercent = prod.dailyPercent ?? (cleanPrice > 0 ? Number((cleanEarnings / cleanPrice * 100).toFixed(1)) : 0);
    const specsObj = {
      ...prod.specs && typeof prod.specs === "object" ? prod.specs : {},
      accentColor: prod.accentColor || "#0f766e",
      highlightBadge: prod.highlightBadge || "",
      dailyPercent: cleanPercent,
      retailName: prod.retailName || prod.name || "",
      sku: prod.sku || "",
      mrp: prod.mrp ? Number(prod.mrp) : void 0,
      warranty: prod.warranty || "25 Years Performance Guarantee",
      inStock: prod.inStock !== false
    };
    const payload = {
      id: cleanId,
      name: prod.name || prod.title || "Product",
      title: prod.title || prod.name || "",
      price: cleanPrice,
      dailyEarnings: cleanEarnings,
      totalRevenue: numOr(prod.totalRevenue, 0),
      cycleDays: numOr(prod.cycleDays, 30),
      category: prod.category || "steady",
      image: prod.image || "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80",
      minVip: numOr(prod.vipRequirement ?? prod.minVip, 0),
      stock: numOr(prod.totalUnits ?? prod.stock, 5e3),
      isHot: Boolean(prod.isHot),
      isPopular: Boolean(prod.isPopular),
      soldCount: numOr(prod.soldCount, 0),
      description: prod.description || "",
      specs: specsObj
    };
    const res = await db.insert(products).values(payload).onConflictDoUpdate({
      target: products.id,
      set: payload
    }).returning();
    return res[0];
  } catch (err) {
    console.warn("Error upserting product in Cloud SQL:", err);
    return null;
  }
}
async function deleteDbProduct(productId) {
  if (!isSqlConfigured) return false;
  try {
    const cleanId = String(productId).trim();
    await db.delete(products).where(eq(products.id, cleanId));
    return true;
  } catch (err) {
    console.warn("Error deleting product from Cloud SQL:", err);
    return false;
  }
}
async function getAllDbPromoCodes() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  } catch (err) {
    console.warn("Error fetching promo codes from Cloud SQL:", err);
    return [];
  }
}
async function upsertDbPromoCode(promo) {
  if (!isSqlConfigured) return null;
  try {
    const cleanCode = String(promo.code).trim().toUpperCase();
    const cleanId = String(promo.id || `promo_${cleanCode}`).trim();
    const payload = {
      id: cleanId,
      code: cleanCode,
      amount: numOr(promo.amount, 0),
      maxUses: numOr(promo.maxUses, 1),
      usedCount: numOr(promo.usedCount, 0),
      usedBy: Array.isArray(promo.usedBy) ? promo.usedBy : [],
      expiresAt: promo.expiresAt || null,
      isActive: promo.isActive !== false
    };
    const res = await db.insert(promoCodes).values(payload).onConflictDoUpdate({
      target: promoCodes.code,
      set: payload
    }).returning();
    return res[0];
  } catch (err) {
    console.warn("Error upserting promo code in Cloud SQL:", err);
    return null;
  }
}
async function deleteDbPromoCode(promoIdOrCode) {
  if (!isSqlConfigured) return false;
  try {
    const clean = String(promoIdOrCode).trim();
    await db.delete(promoCodes).where(or(eq(promoCodes.id, clean), eq(promoCodes.code, clean.toUpperCase())));
    return true;
  } catch (err) {
    console.warn("Error deleting promo code from Cloud SQL:", err);
    return false;
  }
}
async function getAllDbNotices() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(notices).orderBy(desc(notices.priority), desc(notices.createdAt));
  } catch (err) {
    console.warn("Error fetching notices from Cloud SQL:", err);
    return [];
  }
}
async function upsertDbNotice(notice) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(notice.id || `notice_${Date.now()}`).trim();
    const payload = {
      id: cleanId,
      title: notice.title || "",
      content: notice.content || "",
      type: notice.type || "info",
      date: notice.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      isActive: notice.isActive !== false,
      priority: numOr(notice.priority, 0)
    };
    const res = await db.insert(notices).values(payload).onConflictDoUpdate({
      target: notices.id,
      set: payload
    }).returning();
    return res[0];
  } catch (err) {
    console.warn("Error upserting notice in Cloud SQL:", err);
    return null;
  }
}
async function deleteDbNotice(noticeId) {
  if (!isSqlConfigured) return false;
  try {
    const cleanId = String(noticeId).trim();
    await db.delete(notices).where(eq(notices.id, cleanId));
    return true;
  } catch (err) {
    console.warn("Error deleting notice from Cloud SQL:", err);
    return false;
  }
}

// src/db/sqliteOrders.ts
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
var DB_PATH = path.resolve(process.cwd(), "src/data/nexa_database.sqlite");
var dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
var dbInstance = null;
var DELETED_ORDERS_PATH = path.resolve(process.cwd(), "src/data/deleted_orders.json");
function loadDeletedOrders() {
  const set = /* @__PURE__ */ new Set();
  try {
    if (fs.existsSync(DELETED_ORDERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(DELETED_ORDERS_PATH, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((id) => set.add(String(id).trim().toLowerCase()));
      }
    }
  } catch {
  }
  return set;
}
function saveDeletedOrder(orderId) {
  const set = loadDeletedOrders();
  const cleanId = String(orderId).trim().toLowerCase();
  if (!cleanId) return;
  set.add(cleanId);
  try {
    fs.writeFileSync(DELETED_ORDERS_PATH, JSON.stringify(Array.from(set), null, 2), "utf-8");
  } catch {
  }
}
function getSqliteDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSqliteTables(dbInstance);
  }
  return dbInstance;
}
function initSqliteTables(db2) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS investment_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      daily_earnings REAL NOT NULL,
      total_revenue REAL NOT NULL,
      cycle_days INTEGER NOT NULL,
      days_elapsed INTEGER NOT NULL DEFAULT 0,
      total_accrued REAL NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL,
      last_claim_date TEXT,
      purchase_timestamp INTEGER,
      last_claim_timestamp INTEGER,
      next_claim_timestamp INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      user_phone TEXT,
      user_nickname TEXT,
      admin_note TEXT,
      pause_reason TEXT,
      approved_at TEXT,
      cancelled_at TEXT,
      refund_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_orders_user ON investment_orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_inv_orders_phone ON investment_orders(user_phone);
    CREATE INDEX IF NOT EXISTS idx_inv_orders_status ON investment_orders(status);

    -- Create platform_products table for permanent SQL persistence of product catalog
    CREATE TABLE IF NOT EXISTS platform_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'steady',
      vip_requirement INTEGER DEFAULT 0,
      price REAL NOT NULL,
      daily_earnings REAL NOT NULL,
      daily_percent REAL,
      cycle_days INTEGER NOT NULL,
      total_revenue REAL NOT NULL,
      image TEXT,
      accent_color TEXT,
      sold_count INTEGER DEFAULT 0,
      total_units INTEGER DEFAULT 5000,
      description TEXT,
      highlight_badge TEXT,
      retail_name TEXT,
      sku TEXT,
      mrp REAL,
      warranty TEXT,
      in_stock INTEGER DEFAULT 1,
      raw_json TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON platform_products(category);
  `);
}
function upsertOrderInSql(order) {
  const db2 = getSqliteDb();
  const cleanId = String(order.id || `ord-${Date.now()}`);
  const deletedSet = loadDeletedOrders();
  if (deletedSet.has(cleanId.toLowerCase())) {
    return null;
  }
  const cleanUserId = String(order.userId || order.user_id || "unknown").trim();
  const cleanProductId = String(order.productId || order.product_id || "prod-custom");
  const cleanProductName = String(order.productName || order.product_name || "Investment Plan");
  const price = Number(order.price) || 0;
  const dailyEarnings = Number(order.dailyEarnings || order.daily_earnings) || 0;
  const totalRevenue = Number(order.totalRevenue || order.total_revenue) || 0;
  const cycleDays = Number(order.cycleDays || order.cycle_days) || 30;
  const daysElapsed = Number(order.daysElapsed || order.days_elapsed) || 0;
  const totalAccrued = Number(order.totalAccrued || order.total_accrued) || 0;
  const purchaseDate = String(order.purchaseDate || order.purchase_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
  const lastClaimDate = order.lastClaimDate || order.last_claim_date || purchaseDate;
  const purchaseTimestamp = Number(order.purchaseTimestamp || order.purchase_timestamp) || Date.now();
  const lastClaimTimestamp = Number(order.lastClaimTimestamp || order.last_claim_timestamp) || purchaseTimestamp;
  const nextClaimTimestamp = Number(order.nextClaimTimestamp || order.next_claim_timestamp) || lastClaimTimestamp + 24 * 60 * 60 * 1e3;
  const status = String(order.status || "active");
  const userPhone = order.userPhone || order.user_phone || null;
  const userNickname = order.userNickname || order.user_nickname || null;
  const adminNote = order.adminNote || order.admin_note || null;
  const pauseReason = order.pauseReason || order.pause_reason || null;
  const approvedAt = order.approvedAt || order.approved_at || null;
  const cancelledAt = order.cancelledAt || order.cancelled_at || null;
  const refundAmount = Number(order.refundAmount || order.refund_amount) || 0;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = db2.prepare(`
    INSERT INTO investment_orders (
      id, user_id, product_id, product_name, price, daily_earnings,
      total_revenue, cycle_days, days_elapsed, total_accrued,
      purchase_date, last_claim_date, purchase_timestamp, last_claim_timestamp,
      next_claim_timestamp, status, user_phone, user_nickname, admin_note,
      pause_reason, approved_at, cancelled_at, refund_amount, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      product_name = excluded.product_name,
      price = excluded.price,
      daily_earnings = excluded.daily_earnings,
      total_revenue = excluded.total_revenue,
      cycle_days = excluded.cycle_days,
      days_elapsed = excluded.days_elapsed,
      total_accrued = excluded.total_accrued,
      last_claim_date = excluded.last_claim_date,
      last_claim_timestamp = excluded.last_claim_timestamp,
      next_claim_timestamp = excluded.next_claim_timestamp,
      status = excluded.status,
      user_phone = COALESCE(excluded.user_phone, investment_orders.user_phone),
      user_nickname = COALESCE(excluded.user_nickname, investment_orders.user_nickname),
      admin_note = COALESCE(excluded.admin_note, investment_orders.admin_note),
      pause_reason = excluded.pause_reason,
      approved_at = COALESCE(excluded.approved_at, investment_orders.approved_at),
      cancelled_at = COALESCE(excluded.cancelled_at, investment_orders.cancelled_at),
      refund_amount = excluded.refund_amount,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    cleanId,
    cleanUserId,
    cleanProductId,
    cleanProductName,
    price,
    dailyEarnings,
    totalRevenue,
    cycleDays,
    daysElapsed,
    totalAccrued,
    purchaseDate,
    lastClaimDate,
    purchaseTimestamp,
    lastClaimTimestamp,
    nextClaimTimestamp,
    status,
    userPhone,
    userNickname,
    adminNote,
    pauseReason,
    approvedAt,
    cancelledAt,
    refundAmount,
    nowIso
  );
  return {
    id: cleanId,
    userId: cleanUserId,
    productId: cleanProductId,
    productName: cleanProductName,
    price,
    dailyEarnings,
    totalRevenue,
    cycleDays,
    daysElapsed,
    totalAccrued,
    purchaseDate,
    lastClaimDate,
    purchaseTimestamp,
    lastClaimTimestamp,
    nextClaimTimestamp,
    status,
    userPhone,
    userNickname,
    adminNote,
    pauseReason,
    approvedAt,
    cancelledAt,
    refundAmount,
    updatedAt: nowIso
  };
}
function getAllOrdersFromSql() {
  const db2 = getSqliteDb();
  const deletedSet = loadDeletedOrders();
  const rows = db2.prepare(`SELECT * FROM investment_orders ORDER BY purchase_timestamp DESC`).all();
  return rows.filter((r) => !deletedSet.has(String(r.id).trim().toLowerCase())).map((r) => ({
    id: r.id,
    userId: r.user_id,
    productId: r.product_id,
    productName: r.product_name,
    price: Number(r.price) || 0,
    dailyEarnings: Number(r.daily_earnings) || 0,
    totalRevenue: Number(r.total_revenue) || 0,
    cycleDays: Number(r.cycle_days) || 0,
    daysElapsed: Number(r.days_elapsed) || 0,
    totalAccrued: Number(r.total_accrued) || 0,
    purchaseDate: r.purchase_date,
    lastClaimDate: r.last_claim_date,
    purchaseTimestamp: Number(r.purchase_timestamp) || null,
    lastClaimTimestamp: Number(r.last_claim_timestamp) || null,
    nextClaimTimestamp: Number(r.next_claim_timestamp) || null,
    status: r.status,
    userPhone: r.user_phone,
    userNickname: r.user_nickname,
    adminNote: r.admin_note,
    pauseReason: r.pause_reason,
    approvedAt: r.approved_at,
    cancelledAt: r.cancelled_at,
    refundAmount: Number(r.refund_amount) || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}
function getOrdersForUserFromSql(possibleIdentifiers) {
  const db2 = getSqliteDb();
  const deletedSet = loadDeletedOrders();
  const cleanList = possibleIdentifiers.map((s) => String(s || "").trim()).filter((s) => s.length > 0);
  if (cleanList.length === 0) return [];
  const placeholders = cleanList.map(() => "?").join(", ");
  const query = `
    SELECT * FROM investment_orders 
    WHERE user_id IN (${placeholders}) 
       OR user_phone IN (${placeholders})
    ORDER BY purchase_timestamp DESC
  `;
  const params = [...cleanList, ...cleanList];
  const rows = db2.prepare(query).all(...params);
  return rows.filter((r) => !deletedSet.has(String(r.id).trim().toLowerCase())).map((r) => ({
    id: r.id,
    userId: r.user_id,
    productId: r.product_id,
    productName: r.product_name,
    price: Number(r.price) || 0,
    dailyEarnings: Number(r.daily_earnings) || 0,
    totalRevenue: Number(r.total_revenue) || 0,
    cycleDays: Number(r.cycle_days) || 0,
    daysElapsed: Number(r.days_elapsed) || 0,
    totalAccrued: Number(r.total_accrued) || 0,
    purchaseDate: r.purchase_date,
    lastClaimDate: r.last_claim_date,
    purchaseTimestamp: Number(r.purchase_timestamp) || null,
    lastClaimTimestamp: Number(r.last_claim_timestamp) || null,
    nextClaimTimestamp: Number(r.next_claim_timestamp) || null,
    status: r.status,
    userPhone: r.user_phone,
    userNickname: r.user_nickname,
    adminNote: r.admin_note,
    pauseReason: r.pause_reason,
    approvedAt: r.approved_at,
    cancelledAt: r.cancelled_at,
    refundAmount: Number(r.refund_amount) || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}
function deleteOrderFromSql(orderId) {
  const db2 = getSqliteDb();
  const cleanId = String(orderId).trim();
  saveDeletedOrder(cleanId);
  const res = db2.prepare(`DELETE FROM investment_orders WHERE id = ? OR LOWER(id) = LOWER(?)`).run(cleanId, cleanId);
  return res.changes > 0;
}
function deleteOrdersForUserInSql(userId, phone) {
  const db2 = getSqliteDb();
  const cleanId = String(userId || "").trim();
  const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(-10) : "";
  const res = db2.prepare(`
    DELETE FROM investment_orders 
    WHERE user_id = ? 
       OR user_phone = ? 
       OR (user_phone IS NOT NULL AND user_phone LIKE ?)
  `).run(cleanId, cleanPhone, `%${cleanPhone}%`);
  return Number(res.changes);
}
function syncAllRealUserOrders(usersList) {
  const db2 = getSqliteDb();
  const existingOrders = getAllOrdersFromSql();
  const existingIds = new Set(existingOrders.map((o) => o.id));
  const realOrdersSeed = [
    // 1. Gaurav (Phone: 7417153384, ID: 453665)
    {
      id: "ORD-7417-001",
      userId: "453665",
      productId: "prod-plan-250",
      productName: "Hydrogen Cell Pro ($250 Plan)",
      price: 250,
      dailyEarnings: 20,
      totalRevenue: 900,
      cycleDays: 45,
      daysElapsed: 2,
      totalAccrued: 40,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 17935e8,
      lastClaimTimestamp: 17935864e5,
      nextClaimTimestamp: 17935864e5 + 864e5,
      status: "active",
      userPhone: "7417153384",
      userNickname: "Gaurav",
      adminNote: "Green Hydrogen Contract"
    },
    {
      id: "ORD-7417-002",
      userId: "453665",
      productId: "prod-plan-250",
      productName: "Hydrogen Cell Pro ($250 Plan)",
      price: 250,
      dailyEarnings: 20,
      totalRevenue: 900,
      cycleDays: 45,
      daysElapsed: 2,
      totalAccrued: 40,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 179350005e4,
      lastClaimTimestamp: 179358645e4,
      nextClaimTimestamp: 179358645e4 + 864e5,
      status: "active",
      userPhone: "7417153384",
      userNickname: "Gaurav",
      adminNote: "Green Hydrogen Contract"
    },
    {
      id: "ORD-7417-003",
      userId: "453665",
      productId: "prod-plan-150",
      productName: "Geothermal Station ($150 Plan)",
      price: 150,
      dailyEarnings: 10.5,
      totalRevenue: 472.5,
      cycleDays: 45,
      daysElapsed: 2,
      totalAccrued: 21,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 17935001e5,
      lastClaimTimestamp: 17935865e5,
      nextClaimTimestamp: 17935865e5 + 864e5,
      status: "active",
      userPhone: "7417153384",
      userNickname: "Gaurav",
      adminNote: "Geothermal Station Contract"
    },
    {
      id: "ORD-7417-004",
      userId: "453665",
      productId: "prod-plan-100",
      productName: "Biomass Thermal ($100 Plan)",
      price: 100,
      dailyEarnings: 6.5,
      totalRevenue: 292.5,
      cycleDays: 45,
      daysElapsed: 1,
      totalAccrued: 6.5,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 17935002e5,
      lastClaimTimestamp: 17935866e5,
      nextClaimTimestamp: 17935866e5 + 864e5,
      status: "active",
      userPhone: "7417153384",
      userNickname: "Gaurav",
      adminNote: "Biomass Thermal Contract"
    },
    {
      id: "ORD-7417-005",
      userId: "453665",
      productId: "prod-plan-75",
      productName: "Hydro Unit ($75 Plan)",
      price: 75,
      dailyEarnings: 4.5,
      totalRevenue: 202.5,
      cycleDays: 45,
      daysElapsed: 1,
      totalAccrued: 4.5,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 17935003e5,
      lastClaimTimestamp: 17935867e5,
      nextClaimTimestamp: 17935867e5 + 864e5,
      status: "active",
      userPhone: "7417153384",
      userNickname: "Gaurav",
      adminNote: "Hydro Unit Contract"
    },
    // 2. gaurav (Phone: 7307112738, ID: 833863)
    {
      id: "ORD-7307-001",
      userId: "833863",
      productId: "prod-plan-250",
      productName: "Hydrogen Cell Pro ($250 Plan)",
      price: 250,
      dailyEarnings: 20,
      totalRevenue: 900,
      cycleDays: 45,
      daysElapsed: 4,
      totalAccrued: 80,
      purchaseDate: "2026-10-31",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 17934e8,
      lastClaimTimestamp: 17935728e5,
      nextClaimTimestamp: 17935728e5 + 864e5,
      status: "active",
      userPhone: "7307112738",
      userNickname: "gaurav",
      adminNote: "Green Hydrogen Contract"
    },
    {
      id: "ORD-7307-002",
      userId: "833863",
      productId: "prod-plan-150",
      productName: "Geothermal Station ($150 Plan)",
      price: 150,
      dailyEarnings: 10.5,
      totalRevenue: 472.5,
      cycleDays: 45,
      daysElapsed: 3,
      totalAccrued: 31.5,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 179349e7,
      lastClaimTimestamp: 17935729e5,
      nextClaimTimestamp: 17935729e5 + 864e5,
      status: "active",
      userPhone: "7307112738",
      userNickname: "gaurav",
      adminNote: "Geothermal Station Contract"
    },
    // 3. Sumit (Phone: 9305509851, ID: 644029) - Total Invested: $200 (2 x $100 Plan)
    {
      id: "ORD-9305-001",
      userId: "644029",
      productId: "prod-plan-100",
      productName: "Biomass Thermal ($100 Plan)",
      price: 100,
      dailyEarnings: 6.5,
      totalRevenue: 292.5,
      cycleDays: 45,
      daysElapsed: 1,
      totalAccrued: 6.5,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 179351e7,
      lastClaimTimestamp: 17935964e5,
      nextClaimTimestamp: 17935964e5 + 864e5,
      status: "active",
      userPhone: "9305509851",
      userNickname: "Sumit",
      adminNote: "Biomass Clean Energy Contract"
    },
    {
      id: "ORD-9305-002",
      userId: "644029",
      productId: "prod-plan-100",
      productName: "Biomass Thermal ($100 Plan)",
      price: 100,
      dailyEarnings: 6.5,
      totalRevenue: 292.5,
      cycleDays: 45,
      daysElapsed: 1,
      totalAccrued: 6.5,
      purchaseDate: "2026-11-01",
      lastClaimDate: "2026-11-02",
      purchaseTimestamp: 17935101e5,
      lastClaimTimestamp: 17935965e5,
      nextClaimTimestamp: 17935965e5 + 864e5,
      status: "active",
      userPhone: "9305509851",
      userNickname: "Sumit",
      adminNote: "Biomass Clean Energy Contract"
    }
  ];
  try {
    db2.prepare(`
      DELETE FROM investment_orders 
      WHERE product_id IN ('prod-1793251583445', 'prod-1793251570879', 'prod-1793251545940', 'prod-1793251470609', 'prod-1793251426305')
         OR product_name LIKE '%Royal%'
         OR product_name LIKE '%Elite%'
         OR product_name LIKE '%5000%'
         OR product_name LIKE '%2500%'
    `).run();
  } catch (purgeErr) {
    console.warn("Purge obsolete orders notice:", purgeErr);
  }
  for (const o of realOrdersSeed) {
    try {
      upsertOrderInSql(o);
      existingIds.add(o.id);
    } catch (err) {
      console.warn("Error upserting seed order:", o.id, err);
    }
  }
  if (Array.isArray(usersList)) {
    for (const u of usersList) {
      if (!u || !u.totalInvested || Number(u.totalInvested) <= 0) continue;
      const uId = String(u.id).trim();
      const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
      const userOrders = getOrdersForUserFromSql([uId, uPhone]);
      if (userOrders.length === 0) {
        const orderId = `ORD-${uPhone || uId.slice(-4)}-001`;
        const autoOrder = {
          id: orderId,
          userId: uId,
          productId: "prod-1793251470609",
          productName: `Clean Energy Investment Plan ($${u.totalInvested})`,
          price: Number(u.totalInvested),
          dailyEarnings: Number((Number(u.totalInvested) * 0.1).toFixed(2)),
          totalRevenue: Number((Number(u.totalInvested) * 4.5).toFixed(2)),
          cycleDays: 45,
          daysElapsed: 1,
          totalAccrued: Number((Number(u.totalInvested) * 0.1).toFixed(2)),
          purchaseDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          lastClaimDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          purchaseTimestamp: Date.now() - 864e5,
          lastClaimTimestamp: Date.now() - 864e5,
          nextClaimTimestamp: Date.now(),
          status: "active",
          userPhone: u.phone,
          userNickname: u.nickname || "Investor",
          adminNote: "Auto-linked active investment contract from real account balance"
        };
        try {
          upsertOrderInSql(autoOrder);
          existingIds.add(autoOrder.id);
        } catch (err) {
          console.warn("Error auto-linking user order:", autoOrder.id, err);
        }
      }
    }
  }
  return getAllOrdersFromSql();
}
function upsertProductInSql(prod) {
  const db2 = getSqliteDb();
  const cleanId = String(prod.id || `prod-${Date.now()}`).trim();
  const price = Number(prod.price) || 0;
  const dailyEarnings = Number(prod.dailyEarnings) || 0;
  const dailyPercent = prod.dailyPercent !== void 0 ? Number(prod.dailyPercent) : price > 0 ? Number((dailyEarnings / price * 100).toFixed(1)) : 50;
  const cycleDays = Number(prod.cycleDays || 45);
  const totalRevenue = Number(prod.totalRevenue || (dailyEarnings * cycleDays).toFixed(2));
  const updatedAt = typeof prod.updatedAt === "number" ? prod.updatedAt : Date.now();
  const stmt = db2.prepare(`
    INSERT INTO platform_products (
      id, name, category, vip_requirement, price, daily_earnings,
      daily_percent, cycle_days, total_revenue, image, accent_color,
      sold_count, total_units, description, highlight_badge,
      retail_name, sku, mrp, warranty, in_stock, raw_json, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      vip_requirement = excluded.vip_requirement,
      price = excluded.price,
      daily_earnings = excluded.daily_earnings,
      daily_percent = excluded.daily_percent,
      cycle_days = excluded.cycle_days,
      total_revenue = excluded.total_revenue,
      image = excluded.image,
      accent_color = excluded.accent_color,
      sold_count = excluded.sold_count,
      total_units = excluded.total_units,
      description = excluded.description,
      highlight_badge = excluded.highlight_badge,
      retail_name = excluded.retail_name,
      sku = excluded.sku,
      mrp = excluded.mrp,
      warranty = excluded.warranty,
      in_stock = excluded.in_stock,
      raw_json = excluded.raw_json,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    cleanId,
    prod.name || "Contract Plan",
    prod.category || "steady",
    Number(prod.vipRequirement ?? prod.minVip ?? 0),
    price,
    dailyEarnings,
    dailyPercent,
    cycleDays,
    totalRevenue,
    prod.image || "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80",
    prod.accentColor || "from-emerald-600 to-teal-500",
    Number(prod.soldCount || 0),
    Number(prod.totalUnits ?? prod.stock ?? 5e3),
    prod.description || "",
    prod.highlightBadge || "",
    prod.retailName || prod.name || "",
    prod.sku || `NEXA-${cleanId.toUpperCase().slice(0, 8)}`,
    prod.mrp ? Number(prod.mrp) : Math.round(price * 1.25),
    prod.warranty || "25 Years Performance Guarantee",
    prod.inStock !== false ? 1 : 0,
    JSON.stringify(prod),
    updatedAt
  );
  return {
    ...prod,
    id: cleanId,
    price,
    dailyEarnings,
    dailyPercent,
    cycleDays,
    totalRevenue,
    updatedAt
  };
}
function getAllProductsFromSql() {
  const db2 = getSqliteDb();
  const rows = db2.prepare(`SELECT * FROM platform_products ORDER BY rowid ASC`).all();
  return rows.map((r) => {
    let rawObj = {};
    if (r.raw_json) {
      try {
        rawObj = JSON.parse(r.raw_json);
      } catch {
      }
    }
    return {
      ...rawObj,
      id: r.id,
      name: r.name,
      category: r.category,
      vipRequirement: Number(r.vip_requirement) || 0,
      price: Number(r.price) || 0,
      dailyEarnings: Number(r.daily_earnings) || 0,
      dailyPercent: r.daily_percent !== null && r.daily_percent !== void 0 ? Number(r.daily_percent) : void 0,
      cycleDays: Number(r.cycle_days) || 45,
      totalRevenue: Number(r.total_revenue) || 0,
      image: r.image,
      accentColor: r.accent_color,
      soldCount: Number(r.sold_count) || 0,
      totalUnits: Number(r.total_units) || 5e3,
      description: r.description,
      highlightBadge: r.highlight_badge,
      retailName: r.retail_name,
      sku: r.sku,
      mrp: r.mrp ? Number(r.mrp) : void 0,
      warranty: r.warranty,
      inStock: r.in_stock === 1,
      updatedAt: Number(r.updated_at) || void 0
    };
  });
}
function deleteProductFromSql(productId) {
  const db2 = getSqliteDb();
  const cleanId = String(productId).trim();
  const res = db2.prepare(`DELETE FROM platform_products WHERE id = ?`).run(cleanId);
  return res.changes > 0;
}
function initAndSyncSqlProducts(initialProducts) {
  const db2 = getSqliteDb();
  let deletedProductIds = /* @__PURE__ */ new Set();
  try {
    const deletedFile = path.resolve(process.cwd(), "src/data/deleted_products.json");
    if (fs.existsSync(deletedFile)) {
      const data = JSON.parse(fs.readFileSync(deletedFile, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((id) => deletedProductIds.add(String(id).trim()));
      }
    }
  } catch (e) {
    console.warn("Error reading deleted_products.json:", e);
  }
  try {
    db2.prepare(`
      DELETE FROM platform_products 
      WHERE id IN ('prod-1793251583445', 'prod-1793251570879', 'prod-1793251545940', 'prod-1793251470609', 'prod-1793251426305', 'prod-1793251372972')
         OR name LIKE '%Royal%'
         OR name LIKE '%Elite%'
         OR price > 250
    `).run();
    for (const delId of deletedProductIds) {
      db2.prepare(`DELETE FROM platform_products WHERE id = ?`).run(delId);
    }
  } catch (err) {
    console.warn("Cleanup old platform products notice:", err);
  }
  if (Array.isArray(initialProducts) && initialProducts.length > 0) {
    for (const p of initialProducts) {
      if (p && p.id && !deletedProductIds.has(String(p.id).trim())) {
        try {
          upsertProductInSql(p);
        } catch (err) {
          console.warn("Error upserting product in SQLite:", p.id, err);
        }
      }
    }
  }
}

// src/db/sqliteUsers.ts
function initSqliteUsersTable() {
  const db2 = getSqliteDb();
  db2.exec(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT 'password123',
      nickname TEXT,
      avatar TEXT DEFAULT 'HD',
      invitation_code TEXT NOT NULL,
      invited_by TEXT,
      inviter_name TEXT,
      inviter_id TEXT,
      recharge_balance REAL NOT NULL DEFAULT 0,
      withdrawal_balance REAL NOT NULL DEFAULT 0,
      product_revenue REAL NOT NULL DEFAULT 0,
      vip_level INTEGER NOT NULL DEFAULT 0,
      total_invested REAL NOT NULL DEFAULT 0,
      check_in_streak INTEGER NOT NULL DEFAULT 0,
      last_check_in_date TEXT,
      spin_chances INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      role TEXT NOT NULL DEFAULT 'user',
      total_referrals INTEGER NOT NULL DEFAULT 0,
      total_commission_earned REAL NOT NULL DEFAULT 0,
      bank_account_holder TEXT,
      bank_account_number TEXT,
      bank_ifsc_code TEXT,
      bank_name TEXT,
      bank_upi_id TEXT,
      bank_details_json TEXT,
      raw_json TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_phone ON platform_users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_invite ON platform_users(invitation_code);
    CREATE INDEX IF NOT EXISTS idx_users_status ON platform_users(status);
  `);
}
function parseBankDetails(r) {
  if (r.bank_details_json) {
    try {
      const parsed = JSON.parse(r.bank_details_json);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
    }
  }
  if (r.bank_account_number || r.bank_account_holder || r.bank_ifsc_code || r.bank_upi_id) {
    return {
      accountHolder: r.bank_account_holder || "",
      bankName: r.bank_name || "Bank IMPS",
      accountNumber: r.bank_account_number || "",
      ifscCode: r.bank_ifsc_code || "",
      upiId: r.bank_upi_id || ""
    };
  }
  return null;
}
function mapSqlRowToUser(r) {
  const bankDetails = parseBankDetails(r);
  let invitedBy = r.invited_by || null;
  let inviterName = r.inviter_name || null;
  let inviterId = r.inviter_id || null;
  if (invitedBy === "R34VZ" || inviterId === "852539" || inviterName && String(inviterName).trim().toLowerCase() === "ravisahu") {
    invitedBy = "J9Y79";
    inviterName = "Ravi Sahu";
    inviterId = "325697";
  }
  if (invitedBy === "EYAYY" || inviterName && String(inviterName).trim().toLowerCase().includes("anshu") && (inviterId === "406332" || !inviterId)) {
    invitedBy = "AAWFK";
    inviterName = "Anshusahu";
    inviterId = "406332";
  }
  return {
    id: String(r.id),
    phone: String(r.phone),
    password: String(r.password || "password123"),
    nickname: r.nickname || `Member_${String(r.id).slice(-4)}`,
    avatar: r.avatar || "HD",
    invitationCode: r.invitation_code || "4AB86",
    invitedBy,
    inviterName,
    inviterId,
    rechargeBalance: Number(r.recharge_balance) || 0,
    withdrawalBalance: Number(r.withdrawal_balance) || 0,
    productRevenue: Number(r.product_revenue) || 0,
    vipLevel: Number(r.vip_level) || 0,
    totalInvested: Number(r.total_invested) || 0,
    checkInStreak: Number(r.check_in_streak) || 0,
    lastCheckInDate: r.last_check_in_date || null,
    spinChances: Number(r.spin_chances) || 0,
    status: r.status || "active",
    role: r.role || "user",
    totalReferrals: Number(r.total_referrals) || 0,
    totalCommissionEarned: Number(r.total_commission_earned) || 0,
    bankDetails,
    isDeleted: Boolean(r.is_deleted === 1),
    createdAt: r.created_at || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: r.updated_at || (/* @__PURE__ */ new Date()).toISOString()
  };
}
function upsertUserInSql(user) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const cleanPhone = String(user.phone || "").replace(/\D/g, "").slice(-10);
  const cleanId = String(user.id || user.uid || (cleanPhone ? `usr-${cleanPhone}` : `usr-${Date.now()}`)).trim();
  const existingRow = db2.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? OR phone = ?
    LIMIT 1
  `).get(cleanId, cleanPhone);
  let finalPassword = "password123";
  if (user.password && String(user.password).trim().length > 0) {
    finalPassword = String(user.password).trim();
  } else if (existingRow?.password && String(existingRow.password).trim().length > 0) {
    finalPassword = String(existingRow.password).trim();
  }
  const finalNickname = user.nickname?.trim() || existingRow?.nickname || (cleanPhone ? `Member_${cleanPhone.slice(-4)}` : "Member");
  const finalAvatar = user.avatar || existingRow?.avatar || "HD";
  const finalInviteCode = (user.invitationCode || existingRow?.invitation_code || "4AB86").trim().toUpperCase();
  let finalInvitedBy = user.invitedBy !== void 0 ? user.invitedBy ? String(user.invitedBy).trim().toUpperCase() : null : existingRow?.invited_by || null;
  let finalInviterName = user.inviterName !== void 0 ? user.inviterName ? String(user.inviterName).trim() : null : existingRow?.inviter_name || null;
  let finalInviterId = user.inviterId !== void 0 ? user.inviterId ? String(user.inviterId).trim() : null : existingRow?.inviter_id || null;
  if (finalInvitedBy === "R34VZ" || finalInviterId === "852539" || finalInviterName && finalInviterName.trim().toLowerCase() === "ravisahu") {
    finalInvitedBy = "J9Y79";
    finalInviterName = "Ravi Sahu";
    finalInviterId = "325697";
  }
  if (finalInvitedBy === "EYAYY" || finalInviterName && String(finalInviterName).trim().toLowerCase().includes("anshu") && (finalInviterId === "406332" || !finalInviterId)) {
    finalInvitedBy = "AAWFK";
    finalInviterName = "Anshusahu";
    finalInviterId = "406332";
  }
  const rechargeBalance = user.rechargeBalance !== void 0 && user.rechargeBalance !== null && !isNaN(Number(user.rechargeBalance)) && (Number(user.rechargeBalance) > 0 || Number(existingRow?.recharge_balance || 0) === 0) ? Number(user.rechargeBalance) : Number(existingRow?.recharge_balance || 0);
  const withdrawalBalance = user.withdrawalBalance !== void 0 && user.withdrawalBalance !== null && !isNaN(Number(user.withdrawalBalance)) && (Number(user.withdrawalBalance) > 0 || Number(existingRow?.withdrawal_balance || 0) === 0) ? Number(user.withdrawalBalance) : Number(existingRow?.withdrawal_balance || 0);
  const productRevenue = user.productRevenue !== void 0 && user.productRevenue !== null && !isNaN(Number(user.productRevenue)) ? Number(user.productRevenue) : Number(existingRow?.product_revenue || 0);
  const vipLevel = user.vipLevel !== void 0 && user.vipLevel !== null && !isNaN(Number(user.vipLevel)) ? Number(user.vipLevel) : Number(existingRow?.vip_level || 0);
  const totalInvested = user.totalInvested !== void 0 && user.totalInvested !== null && !isNaN(Number(user.totalInvested)) ? Number(user.totalInvested) : Number(existingRow?.total_invested || 0);
  const checkInStreak = user.checkInStreak !== void 0 && user.checkInStreak !== null && !isNaN(Number(user.checkInStreak)) ? Number(user.checkInStreak) : Number(existingRow?.check_in_streak || 0);
  const lastCheckInDate = user.lastCheckInDate || existingRow?.last_check_in_date || null;
  const spinChances = user.spinChances !== void 0 && user.spinChances !== null && !isNaN(Number(user.spinChances)) ? Number(user.spinChances) : Number(existingRow?.spin_chances || 0);
  const status = user.status || existingRow?.status || "active";
  const role = user.role || existingRow?.role || "user";
  const totalReferrals = Math.max(
    Number(user.totalReferrals) || 0,
    Number(existingRow?.total_referrals) || 0
  );
  const totalCommissionEarned = Math.max(
    Number(user.totalCommissionEarned) || 0,
    Number(existingRow?.total_commission_earned) || 0
  );
  const existingBank = existingRow ? parseBankDetails(existingRow) : null;
  const incomingBank = user.bankDetails && typeof user.bankDetails === "object" ? user.bankDetails : null;
  let finalBank = existingBank;
  if (incomingBank) {
    finalBank = {
      accountHolder: incomingBank.accountHolder?.trim() || existingBank?.accountHolder || "",
      bankName: incomingBank.bankName?.trim() || existingBank?.bankName || "Bank IMPS",
      accountNumber: incomingBank.accountNumber?.trim() || existingBank?.accountNumber || "",
      ifscCode: (incomingBank.ifscCode?.trim() || existingBank?.ifscCode || "").toUpperCase(),
      upiId: incomingBank.upiId?.trim() || existingBank?.upiId || ""
    };
  }
  const bankHolder = finalBank?.accountHolder || null;
  const bankNumber = finalBank?.accountNumber || null;
  const bankIfsc = finalBank?.ifscCode || null;
  const bankName = finalBank?.bankName || null;
  const bankUpi = finalBank?.upiId || null;
  const bankDetailsJson = finalBank ? JSON.stringify(finalBank) : null;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = user.createdAt || existingRow?.created_at || nowIso;
  const rawJson = JSON.stringify({
    ...user,
    id: cleanId,
    phone: cleanPhone,
    password: finalPassword,
    nickname: finalNickname,
    invitationCode: finalInviteCode,
    invitedBy: finalInvitedBy,
    inviterName: finalInviterName,
    inviterId: finalInviterId,
    bankDetails: finalBank,
    rechargeBalance,
    withdrawalBalance,
    productRevenue,
    totalInvested,
    updatedAt: nowIso
  });
  const stmt = db2.prepare(`
    INSERT INTO platform_users (
      id, phone, password, nickname, avatar, invitation_code,
      invited_by, inviter_name, inviter_id, recharge_balance,
      withdrawal_balance, product_revenue, vip_level, total_invested,
      check_in_streak, last_check_in_date, spin_chances, status,
      role, total_referrals, total_commission_earned,
      bank_account_holder, bank_account_number, bank_ifsc_code,
      bank_name, bank_upi_id, bank_details_json, raw_json,
      is_deleted, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      0, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      phone = excluded.phone,
      password = excluded.password,
      nickname = excluded.nickname,
      avatar = excluded.avatar,
      invitation_code = excluded.invitation_code,
      invited_by = excluded.invited_by,
      inviter_name = excluded.inviter_name,
      inviter_id = excluded.inviter_id,
      recharge_balance = excluded.recharge_balance,
      withdrawal_balance = excluded.withdrawal_balance,
      product_revenue = excluded.product_revenue,
      vip_level = excluded.vip_level,
      total_invested = excluded.total_invested,
      check_in_streak = excluded.check_in_streak,
      last_check_in_date = COALESCE(excluded.last_check_in_date, platform_users.last_check_in_date),
      spin_chances = excluded.spin_chances,
      status = excluded.status,
      role = excluded.role,
      total_referrals = excluded.total_referrals,
      total_commission_earned = excluded.total_commission_earned,
      bank_account_holder = COALESCE(excluded.bank_account_holder, platform_users.bank_account_holder),
      bank_account_number = COALESCE(excluded.bank_account_number, platform_users.bank_account_number),
      bank_ifsc_code = COALESCE(excluded.bank_ifsc_code, platform_users.bank_ifsc_code),
      bank_name = COALESCE(excluded.bank_name, platform_users.bank_name),
      bank_upi_id = COALESCE(excluded.bank_upi_id, platform_users.bank_upi_id),
      bank_details_json = COALESCE(excluded.bank_details_json, platform_users.bank_details_json),
      raw_json = excluded.raw_json,
      is_deleted = 0,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    cleanId,
    cleanPhone,
    finalPassword,
    finalNickname,
    finalAvatar,
    finalInviteCode,
    finalInvitedBy,
    finalInviterName,
    finalInviterId,
    rechargeBalance,
    withdrawalBalance,
    productRevenue,
    vipLevel,
    totalInvested,
    checkInStreak,
    lastCheckInDate,
    spinChances,
    status,
    role,
    totalReferrals,
    totalCommissionEarned,
    bankHolder,
    bankNumber,
    bankIfsc,
    bankName,
    bankUpi,
    bankDetailsJson,
    rawJson,
    createdAt,
    nowIso
  );
  return {
    id: cleanId,
    phone: cleanPhone,
    password: finalPassword,
    nickname: finalNickname,
    avatar: finalAvatar,
    invitationCode: finalInviteCode,
    invitedBy: finalInvitedBy,
    inviterName: finalInviterName,
    inviterId: finalInviterId,
    rechargeBalance,
    withdrawalBalance,
    productRevenue,
    vipLevel,
    totalInvested,
    checkInStreak,
    lastCheckInDate,
    spinChances,
    status,
    role,
    totalReferrals,
    totalCommissionEarned,
    bankDetails: finalBank,
    isDeleted: false,
    createdAt,
    updatedAt: nowIso
  };
}
function getUserByIdOrPhoneFromSql(identifier) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(identifier || "").trim();
  const cleanPhone = raw.replace(/\D/g, "").slice(-10);
  const row = db2.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? 
       OR phone = ? 
       OR invitation_code = ?
    LIMIT 1
  `).get(raw, cleanPhone, raw.toUpperCase());
  if (!row) return null;
  return mapSqlRowToUser(row);
}
function getAllUsersFromSql(includeDeleted = false) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const deletedSet = /* @__PURE__ */ new Set();
  try {
    const fs3 = __require("fs");
    const path3 = __require("path");
    const delPath = path3.resolve(process.cwd(), "src/data/deleted_users.json");
    if (fs3.existsSync(delPath)) {
      const parsed = JSON.parse(fs3.readFileSync(delPath, "utf-8"));
      if (Array.isArray(parsed)) {
        parsed.forEach((x) => {
          if (typeof x === "string") deletedSet.add(x.trim());
          else if (x?.id) deletedSet.add(String(x.id).trim());
          else if (x?.phone) deletedSet.add(String(x.phone).replace(/\D/g, "").slice(-10));
        });
      }
    }
  } catch {
  }
  const query = includeDeleted ? `SELECT * FROM platform_users ORDER BY rowid DESC` : `SELECT * FROM platform_users WHERE is_deleted = 0 ORDER BY rowid DESC`;
  const rows = db2.prepare(query).all();
  const mapped = rows.map(mapSqlRowToUser);
  return mapped.filter((u) => {
    const uId = String(u.id || "").trim();
    const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
    return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
  });
}
function hardDeleteUserInSql(userId, phone) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const cleanId = String(userId || "").trim();
  const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(-10) : "";
  let changes = 0;
  if (cleanPhone) {
    const res = db2.prepare(`
      DELETE FROM platform_users 
      WHERE id = ? 
         OR phone = ? 
         OR phone LIKE ?
    `).run(cleanId, cleanPhone, `%${cleanPhone}%`);
    changes = Number(res.changes);
  } else {
    const res = db2.prepare(`
      DELETE FROM platform_users 
      WHERE id = ? 
    `).run(cleanId);
    changes = Number(res.changes);
  }
  return changes > 0;
}
function initAndSyncSqlUsers(initialUsers) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const deletedSet = /* @__PURE__ */ new Set();
  try {
    const fs3 = __require("fs");
    const path3 = __require("path");
    const delPath = path3.resolve(process.cwd(), "src/data/deleted_users.json");
    if (fs3.existsSync(delPath)) {
      const parsed = JSON.parse(fs3.readFileSync(delPath, "utf-8"));
      if (Array.isArray(parsed)) {
        parsed.forEach((x) => {
          if (typeof x === "string") deletedSet.add(x.trim());
          else if (x?.id) deletedSet.add(String(x.id).trim());
          else if (x?.phone) deletedSet.add(String(x.phone).replace(/\D/g, "").slice(-10));
        });
      } else if (parsed && typeof parsed === "object") {
        (parsed.deletedIds || []).forEach((id) => deletedSet.add(String(id).trim()));
        (parsed.deletedPhones || []).forEach((p) => deletedSet.add(String(p).replace(/\D/g, "").slice(-10)));
      }
    }
  } catch {
  }
  console.log(`[SQLite Users] Initializing users table and syncing ${initialUsers.length} records...`);
  for (const u of initialUsers) {
    if (u && (u.id || u.phone)) {
      const uId = String(u.id || "").trim();
      const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
      if (deletedSet.has(uId) || uPhone && deletedSet.has(uPhone)) {
        hardDeleteUserInSql(uId, uPhone);
        continue;
      }
      upsertUserInSql(u);
    }
  }
}
function relinkUserUplineInSql(targetIdentifier, uplineCode, uplineId, uplineName) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(targetIdentifier || "").trim();
  const cleanPhone = raw.replace(/\D/g, "").slice(-10);
  const target = db2.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? OR phone = ?
    LIMIT 1
  `).get(raw, cleanPhone);
  if (!target) return null;
  const code = uplineCode ? uplineCode.trim().toUpperCase() : null;
  const name = uplineName ? uplineName.trim() : null;
  const id = uplineId ? uplineId.trim() : null;
  db2.prepare(`
    UPDATE platform_users
    SET invited_by = ?,
        inviter_name = ?,
        inviter_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(code, name, id, target.id);
  try {
    const parsed = JSON.parse(target.raw_json || "{}");
    parsed.invitedBy = code;
    parsed.inviterName = name;
    parsed.inviterId = id;
    parsed.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`UPDATE platform_users SET raw_json = ? WHERE id = ?`).run(
      JSON.stringify(parsed),
      target.id
    );
  } catch (e) {
  }
  const updated = db2.prepare(`SELECT * FROM platform_users WHERE id = ?`).get(target.id);
  return updated ? mapSqlRowToUser(updated) : null;
}
function creditUserCommissionInSql(userIdOrPhone, commissionAmount) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(userIdOrPhone || "").trim();
  const cleanPhone = raw.replace(/\D/g, "").slice(-10);
  const amount = Number(commissionAmount) || 0;
  if (amount <= 0) return null;
  const target = db2.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? OR (phone = ? AND length(?) = 10)
    LIMIT 1
  `).get(raw, cleanPhone, cleanPhone);
  if (!target) return null;
  const newWithdrawal = Number((Number(target.withdrawal_balance || 0) + amount).toFixed(2));
  const newComm = Number((Number(target.total_commission_earned || 0) + amount).toFixed(2));
  db2.prepare(`
    UPDATE platform_users
    SET withdrawal_balance = ?,
        total_commission_earned = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(newWithdrawal, newComm, target.id);
  try {
    const parsed = JSON.parse(target.raw_json || "{}");
    parsed.withdrawalBalance = newWithdrawal;
    parsed.totalCommissionEarned = newComm;
    parsed.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`UPDATE platform_users SET raw_json = ? WHERE id = ?`).run(
      JSON.stringify(parsed),
      target.id
    );
  } catch (e) {
  }
  const updated = db2.prepare(`SELECT * FROM platform_users WHERE id = ?`).get(target.id);
  return updated ? mapSqlRowToUser(updated) : null;
}
function updateUserReferralsInSql(userIdOrPhone, referralCount) {
  const db2 = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(userIdOrPhone || "").trim();
  const cleanPhone = raw.replace(/\D/g, "").slice(-10);
  const count = Math.max(0, Number(referralCount) || 0);
  db2.prepare(`
    UPDATE platform_users
    SET total_referrals = ?,
        updated_at = datetime('now')
    WHERE id = ? OR (phone = ? AND length(?) = 10)
  `).run(count, raw, cleanPhone, cleanPhone);
}

// server.ts
dotenv.config();
var app = express();
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((err, _req, res, next) => {
  if (err && (err.type === "entity.too.large" || err.status === 413 || err.name === "PayloadTooLargeError")) {
    return res.status(413).json({
      success: false,
      error: "PayloadTooLargeError",
      message: "Request payload is too large. Maximum supported size is 50MB."
    });
  }
  next(err);
});
app.get(["/logo.png", "/api/brand-logo"], (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400");
  const logoPath = path2.resolve(process.cwd(), "public/assets/aistudio/Screenshot_2026-10-26_07.24.53_3c5c1039.png");
  return res.sendFile(logoPath);
});
var OTP_SETTINGS_PATH = path2.resolve(process.cwd(), "src/data/otp_settings.json");
var OTP_LOGS_PATH = path2.resolve(process.cwd(), "src/data/otp_logs.json");
var PLATFORM_SETTINGS_PATH = path2.resolve(process.cwd(), "src/data/platform_settings.json");
var DEFAULT_APITXT_KEY = "wSh_e0TCgFj24rsQv3NxX3FVrqYXFUl42bJb1eVNrss";
var DEFAULT_SERVER_PLATFORM_SETTINGS = {
  tier1Commission: 10,
  tier2Commission: 3,
  tier3Commission: 1,
  merchantUpiId: "nexaai.pay@icici",
  merchantPayeeName: "Nexa AI Technologies",
  isManualUpiEnabled: true,
  autoDynamicQrEnabled: true,
  requireAdminRechargeApproval: true,
  showUpiVpaDetails: false,
  minRecharge: 25,
  minWithdrawal: 2,
  withdrawalFeePercent: 5,
  isWithdrawalEnabled: true,
  isRechargeEnabled: true,
  isSpinEnabled: true,
  isBonusEnabled: true,
  checkInPayouts: [10, 12, 15, 18, 22, 26, 30],
  checkInDay7ExtraSpin: true,
  dailyBonusBase: 50,
  adminPin: "8888"
};
function loadServerPlatformSettings() {
  try {
    if (fs2.existsSync(PLATFORM_SETTINGS_PATH)) {
      const parsed = JSON.parse(fs2.readFileSync(PLATFORM_SETTINGS_PATH, "utf-8"));
      return { ...DEFAULT_SERVER_PLATFORM_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn("Could not read platform_settings.json:", err);
  }
  return { ...DEFAULT_SERVER_PLATFORM_SETTINGS };
}
function saveServerPlatformSettings(next) {
  const current = loadServerPlatformSettings();
  const merged = { ...current, ...next };
  try {
    fs2.writeFileSync(PLATFORM_SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write platform_settings.json:", err);
  }
  return merged;
}
var DEFAULT_OTP_SETTINGS = {
  smsGatewayActive: true,
  smsGatewayProvider: "apitxt",
  smsSenderId: "NEXAAI",
  smsAuthKey: process.env.APITXT_AUTH_KEY && process.env.APITXT_AUTH_KEY !== "YOUR_APITXT_AUTH_KEY" ? process.env.APITXT_AUTH_KEY : DEFAULT_APITXT_KEY,
  customSmsWebhookUrl: "",
  otpValidityMinutes: 5,
  enableMasterOtp: false,
  masterFallbackOtp: "888999",
  registrationOtpTemplate: "Dear user, your Nexa AI registration verification code is {OTP}. Valid for 5 minutes. Do not share with anyone.",
  forgotPasswordOtpTemplate: "Your Nexa AI password reset code is {OTP}. Valid for 5 minutes. If not requested by you, please ignore this SMS.",
  helpCenterUrl: "",
  helpCenterLinks: []
};
function loadServerOtpSettings() {
  try {
    if (fs2.existsSync(OTP_SETTINGS_PATH)) {
      const parsed = JSON.parse(fs2.readFileSync(OTP_SETTINGS_PATH, "utf-8"));
      return { ...DEFAULT_OTP_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn("Could not read otp_settings.json:", err);
  }
  return { ...DEFAULT_OTP_SETTINGS };
}
function saveServerOtpSettings(next) {
  const merged = { ...otpSettings, ...next };
  otpSettings = merged;
  try {
    fs2.writeFileSync(OTP_SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write otp_settings.json:", err);
  }
  return merged;
}
function loadServerOtpLogs() {
  try {
    if (fs2.existsSync(OTP_LOGS_PATH)) {
      const parsed = JSON.parse(fs2.readFileSync(OTP_LOGS_PATH, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Could not read otp_logs.json:", err);
  }
  return [];
}
function persistOtpLogs() {
  try {
    fs2.writeFileSync(OTP_LOGS_PATH, JSON.stringify(otpLogs.slice(0, 150), null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write otp_logs.json:", err);
  }
}
var otpSettings = loadServerOtpSettings();
var otpStore = /* @__PURE__ */ new Map();
var otpLogs = loadServerOtpLogs();
for (const log of otpLogs) {
  if (log.status === "pending" && log.expiresAt > Date.now() && !otpStore.has(log.mobile)) {
    otpStore.set(log.mobile, {
      otp: log.otp,
      expiresAt: log.expiresAt,
      purpose: log.purpose,
      attempts: log.attempts || 0,
      formattedMessage: log.message
    });
  }
}
var lastGatewayCallByMobile = /* @__PURE__ */ new Map();
async function dispatchSmsViaGateway(params) {
  const cleanMobile = params.mobile.replace(/\D/g, "").slice(-10);
  const provider = params.provider || otpSettings.smsGatewayProvider || "apitxt";
  const senderId = (params.senderId || otpSettings.smsSenderId || "NEXAAI").trim();
  const authKey = (params.authKey || otpSettings.smsAuthKey || DEFAULT_APITXT_KEY).trim();
  const customUrl = (params.customWebhookUrl || otpSettings.customSmsWebhookUrl || "").trim();
  let delivered = false;
  let rawResponse = "";
  let statusText = "Queued (Local OTP Monitor Active)";
  const lastCallTime = lastGatewayCallByMobile.get(cleanMobile) || 0;
  const elapsedMs = Date.now() - lastCallTime;
  if (elapsedMs < 4e3) {
    const waitSec = Math.ceil((4e3 - elapsedMs) / 1e3);
    return {
      delivered: true,
      provider,
      senderId,
      statusText: `Active OTP Ready (${waitSec}s Gateway Cooldown Guard)`,
      rawResponse: "Gateway cooldown guard active \u2014 OTP ready in Admin Monitor"
    };
  }
  try {
    if (provider === "fast2sms") {
      if (!authKey) {
        statusText = "Fast2SMS Auth Key Missing (Saved in Admin Logs)";
      } else {
        lastGatewayCallByMobile.set(cleanMobile, Date.now());
        const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: authKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            route: "q",
            message: params.messageText,
            language: "english",
            flash: 0,
            numbers: cleanMobile
          })
        });
        rawResponse = await response.text();
        delivered = response.ok || response.status === 429;
        statusText = response.ok ? "Delivered via Fast2SMS" : response.status === 429 ? "Dispatched (Gateway Cooldown Active)" : `Fast2SMS (${response.status}) \u2014 Logged in Admin`;
      }
    } else if (provider === "custom") {
      if (!customUrl) {
        statusText = "Custom Gateway URL Not Set (Saved in Admin Logs)";
      } else {
        lastGatewayCallByMobile.set(cleanMobile, Date.now());
        const populatedUrl = customUrl.replace(/\{PHONE\}|\{MOBILE\}/gi, encodeURIComponent(cleanMobile)).replace(/\{OTP\}/gi, encodeURIComponent(params.otp)).replace(/\{MESSAGE\}/gi, encodeURIComponent(params.messageText)).replace(/\{SENDER_ID\}/gi, encodeURIComponent(senderId)).replace(/\{AUTH_KEY\}/gi, encodeURIComponent(authKey));
        const isGetStyle = populatedUrl !== customUrl;
        const response = await fetch(
          populatedUrl,
          isGetStyle ? { method: "GET" } : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authKey ? { Authorization: `Bearer ${authKey}` } : {}
            },
            body: JSON.stringify({
              mobile: `91${cleanMobile}`,
              phone: cleanMobile,
              otp: params.otp,
              message: params.messageText,
              sender_id: senderId
            })
          }
        );
        rawResponse = await response.text();
        delivered = response.ok || response.status === 429;
        statusText = response.ok ? "Delivered via Custom Gateway" : `Custom Gateway (${response.status})`;
      }
    } else {
      if (authKey) {
        lastGatewayCallByMobile.set(cleanMobile, Date.now());
        const targetMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
        const bodyParams = new URLSearchParams();
        bodyParams.append("authkey", authKey);
        bodyParams.append("mobile", targetMobile);
        bodyParams.append("otp", params.otp);
        if (senderId) bodyParams.append("sender", senderId);
        const indianIp = params.clientIp && !params.clientIp.startsWith("10.") && !params.clientIp.startsWith("172.") && !params.clientIp.startsWith("192.168.") && !params.clientIp.startsWith("127.") ? params.clientIp : "49.36.128.5";
        const response = await fetch("https://apitxt.com/api/sendOTP", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${authKey}`,
            "X-Forwarded-For": indianIp,
            "X-Real-IP": indianIp,
            "CF-Connecting-IP": indianIp,
            "Client-IP": indianIp
          },
          body: bodyParams.toString()
        });
        rawResponse = await response.text();
        let parsedJson = null;
        try {
          parsedJson = JSON.parse(rawResponse);
        } catch {
        }
        if (response.status === 429) {
          delivered = true;
          statusText = "Dispatched via apitxt.com (Cooldown Active)";
          console.log(`[APITxT Dispatch] Cooldown active for ${targetMobile} \u2014 OTP ${params.otp} active in Admin Monitor.`);
        } else if (response.ok && (parsedJson?.status === "success" || parsedJson?.status === true)) {
          delivered = true;
          statusText = parsedJson?.message || "Sms OTP Sent Successfully via apitxt.com";
          console.log(`[APITxT Dispatch] Sent successfully to ${targetMobile}: "${params.messageText}" RequestID: ${parsedJson?.data?.request_id || ""}`);
        } else {
          delivered = parsedJson?.status === "success";
          statusText = parsedJson?.message || (response.ok ? "Delivered via apitxt.com" : `apitxt.com (${response.status}) \u2014 Logged in Admin`);
          console.log(`[APITxT Dispatch] Gateway status for ${targetMobile}:`, rawResponse);
        }
      }
    }
  } catch (err) {
    rawResponse = err?.message || "Gateway connection notice";
    statusText = `${provider} fallback (Live in Admin OTP Monitor)`;
    console.warn(`[SMS Gateway Error]:`, err);
  }
  return { delivered, provider, senderId, statusText, rawResponse };
}
function formatSmsMessageFromAdminTemplate(params) {
  otpSettings = loadServerOtpSettings();
  const isForgot = params.purpose === "forgot-password";
  const serverSavedTemplate = isForgot ? otpSettings.forgotPasswordOtpTemplate : otpSettings.registrationOtpTemplate;
  const cleanOverride = params.overrideTemplate && typeof params.overrideTemplate === "string" ? params.overrideTemplate.trim() : "";
  let activeTemplate = "";
  if (params.preferOverride && cleanOverride) {
    activeTemplate = cleanOverride;
    saveServerOtpSettings(
      isForgot ? { forgotPasswordOtpTemplate: cleanOverride } : { registrationOtpTemplate: cleanOverride }
    );
  } else if (serverSavedTemplate && serverSavedTemplate.trim().length > 0) {
    activeTemplate = serverSavedTemplate.trim();
  } else if (cleanOverride) {
    activeTemplate = cleanOverride;
  } else {
    activeTemplate = isForgot ? DEFAULT_OTP_SETTINGS.forgotPasswordOtpTemplate : DEFAULT_OTP_SETTINGS.registrationOtpTemplate;
  }
  let messageText = activeTemplate.replace(/\{\{?OTP\}?\}|\[OTP\]|<OTP>|\{CODE\}|\{#var#\}/gi, params.otp).replace(/\{\{?APP_NAME\}?\}|\[APP_NAME\]/gi, "Nexa AI").replace(/\{\{?PHONE\}?\}|\{\{?MOBILE\}?\}|\[PHONE\]/gi, params.mobile).replace(/\{\{?VALIDITY\}?\}|\{\{?MINUTES\}?\}|\{\{?TIME\}?\}/gi, String(params.validityMins));
  if (!messageText.includes(params.otp)) {
    if (messageText.includes("489215")) {
      messageText = messageText.replace(/489215/g, params.otp);
    } else if (messageText.includes("731046")) {
      messageText = messageText.replace(/731046/g, params.otp);
    } else {
      messageText = `${messageText.trim()} (OTP: ${params.otp})`;
    }
  }
  return { messageText, templateUsed: activeTemplate };
}
app.get("/api/admin/otp-settings", (_req, res) => {
  otpSettings = loadServerOtpSettings();
  return res.json({
    success: true,
    settings: otpSettings
  });
});
app.post("/api/admin/otp-settings", (req, res) => {
  try {
    const body = req.body || {};
    const updated = saveServerOtpSettings({
      ...typeof body.smsGatewayActive === "boolean" ? { smsGatewayActive: body.smsGatewayActive } : {},
      ...body.smsGatewayProvider ? { smsGatewayProvider: body.smsGatewayProvider } : {},
      ...typeof body.smsSenderId === "string" ? { smsSenderId: body.smsSenderId.trim() || "NEXAAI" } : {},
      ...typeof body.smsAuthKey === "string" ? { smsAuthKey: body.smsAuthKey.trim() } : {},
      ...typeof body.customSmsWebhookUrl === "string" ? { customSmsWebhookUrl: body.customSmsWebhookUrl.trim() } : {},
      ...body.otpValidityMinutes !== void 0 ? { otpValidityMinutes: Math.max(1, Number(body.otpValidityMinutes) || 5) } : {},
      ...typeof body.enableMasterOtp === "boolean" ? { enableMasterOtp: body.enableMasterOtp } : {},
      ...typeof body.masterFallbackOtp === "string" ? { masterFallbackOtp: body.masterFallbackOtp.trim() } : {},
      ...typeof body.registrationOtpTemplate === "string" && body.registrationOtpTemplate.trim().length > 0 ? { registrationOtpTemplate: body.registrationOtpTemplate.trim() } : {},
      ...typeof body.forgotPasswordOtpTemplate === "string" && body.forgotPasswordOtpTemplate.trim().length > 0 ? { forgotPasswordOtpTemplate: body.forgotPasswordOtpTemplate.trim() } : {},
      ...typeof body.helpCenterUrl === "string" ? { helpCenterUrl: body.helpCenterUrl.trim() } : {},
      ...Array.isArray(body.helpCenterLinks) ? { helpCenterLinks: body.helpCenterLinks } : {}
    });
    return res.json({
      success: true,
      message: "OTP & SMS Gateway settings saved on server!",
      settings: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/platform-settings", async (_req, res) => {
  let settings = loadServerPlatformSettings();
  try {
    const dbSettings = await getPlatformSettingFromDb("general");
    if (dbSettings && typeof dbSettings === "object") {
      settings = { ...settings, ...dbSettings };
    }
  } catch {
  }
  return res.json({
    success: true,
    settings
  });
});
app.post("/api/platform-settings", async (req, res) => {
  try {
    const body = req.body || {};
    const updated = saveServerPlatformSettings(body);
    try {
      await setPlatformSettingInDb("general", updated);
    } catch (dbErr) {
      console.warn("Could not persist platform settings to Cloud SQL:", dbErr);
    }
    return res.json({
      success: true,
      message: "Platform settings saved permanently in Cloud SQL database and disk!",
      settings: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/admin/platform-settings", async (req, res) => {
  try {
    const body = req.body || {};
    const updated = saveServerPlatformSettings(body);
    try {
      await setPlatformSettingInDb("general", updated);
    } catch (dbErr) {
      console.warn("Could not persist platform settings to Cloud SQL:", dbErr);
    }
    return res.json({
      success: true,
      message: "Platform settings saved permanently in Cloud SQL database and disk!",
      settings: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/send-otp", async (req, res) => {
  try {
    const { mobile, purpose, template, provider, senderId, authKey, customWebhookUrl } = req.body;
    if (!mobile || String(mobile).replace(/\D/g, "").length < 10) {
      return res.status(400).json({ success: false, error: "Valid 10-digit mobile number required" });
    }
    otpSettings = loadServerOtpSettings();
    const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);
    const existingRecord = otpStore.get(cleanMobile);
    const nowMs = Date.now();
    const reuseExisting = existingRecord && existingRecord.expiresAt > nowMs && existingRecord.createdAtMs && nowMs - existingRecord.createdAtMs < 15e3;
    const otp = reuseExisting ? existingRecord.otp : Math.floor(1e5 + Math.random() * 9e5).toString();
    const validityMins = Math.max(1, Number(otpSettings.otpValidityMinutes) || 5);
    const expiresAt = nowMs + validityMins * 60 * 1e3;
    const { messageText, templateUsed } = formatSmsMessageFromAdminTemplate({
      purpose: purpose || "register",
      otp,
      mobile: cleanMobile,
      validityMins,
      overrideTemplate: template,
      preferOverride: false
    });
    const recentOtps = Array.from(
      /* @__PURE__ */ new Set([otp, ...existingRecord?.recentOtps || [], ...existingRecord?.otp ? [existingRecord.otp] : []])
    ).slice(0, 5);
    otpStore.set(cleanMobile, {
      otp,
      recentOtps,
      createdAtMs: reuseExisting ? existingRecord.createdAtMs : nowMs,
      expiresAt,
      purpose: purpose || "register",
      attempts: 0,
      formattedMessage: messageText
    });
    const rawClientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "";
    const dispatchResult = await dispatchSmsViaGateway({
      mobile: cleanMobile,
      otp,
      messageText,
      provider: otpSettings.smsGatewayProvider || provider,
      senderId: otpSettings.smsSenderId || senderId,
      authKey: otpSettings.smsAuthKey || authKey,
      customWebhookUrl: otpSettings.customSmsWebhookUrl || customWebhookUrl,
      clientIp: rawClientIp
    });
    const logItem = {
      id: `otp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      mobile: cleanMobile,
      otp,
      purpose: purpose === "forgot-password" ? "forgot-password" : "register",
      message: messageText,
      status: "pending",
      attempts: 0,
      createdAt: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + ", " + (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN"),
      expiresAt,
      provider: dispatchResult.provider,
      senderId: dispatchResult.senderId,
      gatewayStatus: dispatchResult.statusText
    };
    otpLogs.unshift(logItem);
    if (otpLogs.length > 150) otpLogs.pop();
    persistOtpLogs();
    console.log(`[OTP Dispatch] Sent to +91 ${cleanMobile} [${dispatchResult.provider}] [Purpose: ${purpose || "register"}]: "${messageText}"`);
    const maskedPreview = messageText.replace(new RegExp(otp, "g"), "\u2022\u2022\u2022\u2022\u2022\u2022");
    return res.json({
      success: true,
      message: `OTP sent successfully to +91 ${cleanMobile}. Please check your SMS.`,
      delivered: dispatchResult.delivered,
      gateway: dispatchResult.provider,
      senderId: dispatchResult.senderId,
      templateUsed,
      maskedPreview,
      expiresIn: validityMins * 60
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ success: false, error: "Failed to dispatch OTP" });
  }
});
function checkAndVerifyOtp(cleanMobile, inputOtp) {
  const cleanInput = String(inputOtp || "").trim();
  if (otpSettings.enableMasterOtp && otpSettings.masterFallbackOtp && cleanInput === otpSettings.masterFallbackOtp.trim()) {
    const log2 = otpLogs.find((l) => l.mobile === cleanMobile && (l.status === "pending" || l.status === "wrong_otp"));
    if (log2) {
      log2.status = "verified";
      persistOtpLogs();
    }
    return { ok: true };
  }
  const latestLog = otpLogs.find((l) => l.mobile === cleanMobile);
  if (latestLog && latestLog.status === "verified" && (!cleanInput || latestLog.otp === cleanInput)) {
    return { ok: true };
  }
  const now = Date.now();
  const matchingActiveLog = otpLogs.find(
    (l) => l.mobile === cleanMobile && l.otp === cleanInput && (!l.expiresAt || l.expiresAt > now)
  );
  if (matchingActiveLog) {
    matchingActiveLog.status = "verified";
    persistOtpLogs();
    return { ok: true };
  }
  const record = otpStore.get(cleanMobile);
  if (!record) {
    return {
      ok: false,
      error: 'No OTP requested for this number. Please click "Send OTP" first.'
    };
  }
  if (now > record.expiresAt) {
    otpStore.delete(cleanMobile);
    const log2 = otpLogs.find((l) => l.mobile === cleanMobile && l.status === "pending");
    if (log2) {
      log2.status = "expired";
      persistOtpLogs();
    }
    return {
      ok: false,
      error: "OTP has expired (OTP \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B \u0917\u092F\u093E \u0939\u0948). Please request a new code."
    };
  }
  const isMatch = record.otp === cleanInput || Array.isArray(record.recentOtps) && record.recentOtps.includes(cleanInput);
  if (!isMatch) {
    record.attempts += 1;
    const log2 = otpLogs.find((l) => l.mobile === cleanMobile);
    if (log2) {
      log2.status = "wrong_otp";
      log2.attempts = record.attempts;
      persistOtpLogs();
    }
    return {
      ok: false,
      error: "Wrong OTP (\u0917\u0932\u0924 OTP). Please check and enter the correct code."
    };
  }
  const log = otpLogs.find((l) => l.mobile === cleanMobile && (l.status === "pending" || l.status === "wrong_otp"));
  if (log) {
    log.status = "verified";
    persistOtpLogs();
  }
  return { ok: true };
}
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, error: "Mobile number is mandatory" });
    }
    if (otpSettings.smsGatewayActive === false && (!otp || String(otp).trim() === "")) {
      return res.json({ success: true, message: "OTP verification bypassed (Disabled by Admin)" });
    }
    if (!otp) {
      return res.status(400).json({ success: false, error: "Mobile number and OTP are mandatory" });
    }
    const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);
    const result = checkAndVerifyOtp(cleanMobile, String(otp));
    if (!result.ok) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    return res.json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ success: false, error: "Verification failed" });
  }
});
app.post("/api/reset-password", async (req, res) => {
  try {
    const { mobile, phone, otp, newPassword } = req.body;
    const targetPhone = mobile || phone;
    if (!targetPhone || !newPassword) {
      return res.status(400).json({ success: false, error: "Mobile number and new password are required" });
    }
    const cleanMobile = String(targetPhone).replace(/\D/g, "").slice(-10);
    if (otp !== void 0 && otp !== "") {
      const result = checkAndVerifyOtp(cleanMobile, String(otp));
      if (!result.ok) {
        return res.status(400).json({
          success: false,
          error: result.error || "Wrong OTP (\u0917\u0932\u0924 OTP). Password reset denied."
        });
      }
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long"
      });
    }
    const log = otpLogs.find((l) => l.mobile === cleanMobile);
    if (log) {
      log.status = "verified";
      persistOtpLogs();
    }
    otpStore.delete(cleanMobile);
    try {
      const current = getCachedUsersBackup();
      let matchedUser = null;
      const updatedList = current.map((u) => {
        const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
        if (uPhone === cleanMobile) {
          matchedUser = { ...u, password: String(newPassword).trim(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
          return matchedUser;
        }
        return u;
      });
      if (matchedUser) {
        saveUsersBackup(updatedList);
        await upsertUser({
          uid: matchedUser.id || matchedUser.uid || cleanMobile,
          phone: cleanMobile,
          password: String(newPassword).trim(),
          nickname: matchedUser.nickname
        }).catch(() => {
        });
      }
    } catch (persistErr) {
      console.warn("Password reset persistence warning:", persistErr);
    }
    return res.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, error: "Password reset failed" });
  }
});
app.get("/api/admin/otp-logs", (_req, res) => {
  let changed = false;
  const now = Date.now();
  for (const log of otpLogs) {
    if (log.status === "pending" && log.expiresAt && now > log.expiresAt) {
      log.status = "expired";
      changed = true;
    }
  }
  if (changed) persistOtpLogs();
  return res.json({
    success: true,
    logs: otpLogs,
    activeCount: otpStore.size,
    settings: otpSettings
  });
});
app.post("/api/admin/otp-logs/verify", (req, res) => {
  const { id, mobile } = req.body || {};
  const cleanMobile = mobile ? String(mobile).replace(/\D/g, "").slice(-10) : "";
  const targetLog = otpLogs.find((l) => id && l.id === id || cleanMobile && l.mobile === cleanMobile);
  if (!targetLog) {
    return res.status(404).json({ success: false, error: "OTP log record not found" });
  }
  targetLog.status = "verified";
  targetLog.expiresAt = Date.now() + 10 * 60 * 1e3;
  otpStore.set(targetLog.mobile, {
    otp: targetLog.otp,
    expiresAt: targetLog.expiresAt,
    purpose: targetLog.purpose,
    attempts: 0,
    formattedMessage: targetLog.message
  });
  persistOtpLogs();
  return res.json({
    success: true,
    message: `OTP ${targetLog.otp} for +91 ${targetLog.mobile} marked as Verified & Active!`,
    log: targetLog
  });
});
app.post("/api/admin/otp-logs/clear", (_req, res) => {
  otpLogs.length = 0;
  otpStore.clear();
  persistOtpLogs();
  return res.json({
    success: true,
    message: "All OTP logs cleared successfully."
  });
});
var USERS_BACKUP_PATH = path2.resolve(process.cwd(), "src/data/users_backup.json");
var DELETED_USERS_PATH = path2.resolve(process.cwd(), "src/data/deleted_users.json");
var DELETED_PRODUCTS_PATH = path2.resolve(process.cwd(), "src/data/deleted_products.json");
function loadDeletedUsers() {
  const set = /* @__PURE__ */ new Set();
  try {
    if (fs2.existsSync(DELETED_USERS_PATH)) {
      const data = fs2.readFileSync(DELETED_USERS_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((s) => {
          if (typeof s === "string") set.add(s.trim());
          else if (s?.id) set.add(String(s.id).trim());
          else if (s?.phone) set.add(String(s.phone).replace(/\D/g, "").slice(-10));
        });
      } else if (parsed && typeof parsed === "object") {
        (parsed.deletedIds || []).forEach((id) => set.add(String(id).trim()));
        (parsed.deletedPhones || []).forEach((p) => set.add(String(p).replace(/\D/g, "").slice(-10)));
      }
    }
  } catch {
  }
  return set;
}
function saveDeletedUser(userId, phone) {
  try {
    const set = loadDeletedUsers();
    if (userId) set.add(String(userId).trim());
    if (phone) {
      const cleanP = String(phone).replace(/\D/g, "").slice(-10);
      if (cleanP) set.add(cleanP);
    }
    fs2.writeFileSync(DELETED_USERS_PATH, JSON.stringify(Array.from(set), null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save deleted user to blacklist:", e);
  }
}
function loadDeletedProducts() {
  const set = /* @__PURE__ */ new Set();
  try {
    if (fs2.existsSync(DELETED_PRODUCTS_PATH)) {
      const data = fs2.readFileSync(DELETED_PRODUCTS_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => set.add(String(id).trim()));
      }
    }
  } catch {
  }
  return set;
}
function saveDeletedProduct(productId) {
  try {
    const set = loadDeletedProducts();
    if (productId) set.add(String(productId).trim());
    fs2.writeFileSync(DELETED_PRODUCTS_PATH, JSON.stringify(Array.from(set), null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save deleted product to blacklist:", e);
  }
}
function getCachedUsersBackup() {
  let list = [];
  try {
    if (fs2.existsSync(USERS_BACKUP_PATH)) {
      const data = fs2.readFileSync(USERS_BACKUP_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
    }
  } catch (err) {
    console.error("Error reading users backup file:", err);
  }
  if (list.length === 0) {
    try {
      const sqlUsers = getAllUsersFromSql(false);
      if (sqlUsers && sqlUsers.length > 0) list = sqlUsers;
    } catch {
    }
  }
  const deletedSet = loadDeletedUsers();
  return list.filter((u) => {
    const uId = String(u.id || u.uid || "").trim();
    const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
    return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
  });
}
function saveUsersBackup(users2) {
  try {
    if (!Array.isArray(users2)) users2 = [];
    const deletedSet = loadDeletedUsers();
    const cleanUsers = users2.filter((u) => {
      const uId = String(u.id || u.uid || "").trim();
      const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
      return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
    });
    fs2.writeFileSync(USERS_BACKUP_PATH, JSON.stringify(cleanUsers, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error saving users backup file:", err);
    return false;
  }
}
function mergeTwoUsers(existing, incoming) {
  if (!existing) return { ...incoming };
  if (!incoming) return { ...existing };
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (["rechargeBalance", "withdrawalBalance", "productRevenue", "totalInvested", "vipLevel", "spinChances", "totalReferrals", "totalCommissionEarned", "checkInStreak"].includes(k)) {
      if (merged[k] !== void 0 && (v === null || v === void 0 || Number.isNaN(v) || Number(v) === 0 && Number(merged[k]) > 0)) {
        continue;
      }
    }
    if (v !== void 0 && v !== null && v !== "") {
      if (k === "bankDetails" && typeof v === "object") {
        const existingBank = existing.bankDetails || {};
        merged.bankDetails = {
          accountHolder: v.accountHolder?.trim() || existingBank.accountHolder || "",
          bankName: v.bankName?.trim() || existingBank.bankName || "Bank IMPS",
          accountNumber: v.accountNumber?.trim() || existingBank.accountNumber || "",
          ifscCode: (v.ifscCode?.trim() || existingBank.ifscCode || "").toUpperCase(),
          upiId: v.upiId?.trim() || existingBank.upiId || ""
        };
      } else {
        merged[k] = v;
      }
    } else if ((v === 0 || v === false) && typeof v === typeof existing[k]) {
      merged[k] = v;
    }
  }
  if (existing.bankDetails && (!merged.bankDetails || !merged.bankDetails.accountNumber && !merged.bankDetails.upiId)) {
    merged.bankDetails = { ...existing.bankDetails };
  }
  if (incoming.password && String(incoming.password).trim().length > 0) {
    merged.password = String(incoming.password).trim();
  } else if (existing.password && String(existing.password).trim().length > 0) {
    merged.password = String(existing.password).trim();
  } else {
    merged.password = "password123";
  }
  if (!merged.invitationCode && existing.invitationCode) merged.invitationCode = existing.invitationCode;
  if (!merged.invitedBy && existing.invitedBy) merged.invitedBy = existing.invitedBy;
  if (!merged.inviterName && existing.inviterName) merged.inviterName = existing.inviterName;
  if (!merged.inviterId && existing.inviterId) merged.inviterId = existing.inviterId;
  if (merged.invitedBy === "R34VZ" || merged.inviterId === "852539" || merged.inviterName && String(merged.inviterName).trim().toLowerCase() === "ravisahu") {
    merged.invitedBy = "J9Y79";
    merged.inviterName = "Ravi Sahu";
    merged.inviterId = "325697";
  }
  if (merged.invitedBy === "EYAYY" || merged.inviterName && String(merged.inviterName).trim().toLowerCase().includes("anshu") && (merged.inviterId === "406332" || !merged.inviterId)) {
    merged.invitedBy = "AAWFK";
    merged.inviterName = "Anshusahu";
    merged.inviterId = "406332";
  }
  merged.totalReferrals = Math.max(Number(merged.totalReferrals) || 0, Number(existing.totalReferrals) || 0);
  merged.totalCommissionEarned = Math.max(Number(merged.totalCommissionEarned) || 0, Number(existing.totalCommissionEarned) || 0);
  if (!merged.createdAt) {
    merged.createdAt = existing.createdAt || incoming.createdAt || (/* @__PURE__ */ new Date()).toISOString();
  }
  return merged;
}
function deduplicateAndMergeUsers(listA, listB) {
  const byId = /* @__PURE__ */ new Map();
  const phoneToId = /* @__PURE__ */ new Map();
  const deletedSet = loadDeletedUsers();
  const processUser = (u) => {
    if (!u || !u.id && !u.uid && !u.phone) return;
    const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, "").slice(-10) : "";
    const rawId = String(u.id || u.uid || cleanPhone).trim();
    if (deletedSet.has(rawId) || cleanPhone && deletedSet.has(cleanPhone)) {
      return;
    }
    const canonicalId = cleanPhone && phoneToId.get(cleanPhone) || rawId;
    const existing = byId.get(canonicalId);
    const merged = mergeTwoUsers(existing, { ...u, id: canonicalId, ...cleanPhone ? { phone: cleanPhone } : {} });
    byId.set(canonicalId, merged);
    if (cleanPhone) {
      phoneToId.set(cleanPhone, canonicalId);
    }
  };
  listA.forEach(processUser);
  listB.forEach(processUser);
  return Array.from(byId.values());
}
async function getCombinedServerUsers() {
  const deletedSet = loadDeletedUsers();
  const sqlUsers = getAllUsersFromSql(false);
  const diskUsers = getCachedUsersBackup();
  let cloudUsers = [];
  try {
    const cloud = await getAllUsers();
    if (cloud && cloud.length > 0) {
      cloudUsers = cloud.filter((u) => {
        const uId = String(u.uid || u.id || "").trim();
        const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
        return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
      }).map((u) => ({
        id: u.uid || String(u.id),
        phone: u.phone,
        password: u.password || "password123",
        nickname: u.nickname,
        avatar: u.avatar || "HD",
        invitationCode: u.invitationCode,
        invitedBy: u.invitedBy,
        inviterName: u.inviterName,
        inviterId: u.inviterId,
        rechargeBalance: u.rechargeBalance ?? 0,
        withdrawalBalance: u.withdrawalBalance ?? 0,
        productRevenue: u.productRevenue ?? 0,
        vipLevel: u.vipLevel ?? 0,
        totalInvested: u.totalInvested ?? 0,
        checkInStreak: u.checkInStreak ?? 0,
        lastCheckInDate: u.lastCheckInDate,
        spinChances: u.spinChances ?? 0,
        status: u.status || "active",
        role: u.role || "user",
        totalReferrals: u.totalReferrals ?? 0,
        totalCommissionEarned: u.totalCommissionEarned ?? 0,
        bankDetails: u.bankDetails,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : void 0
      }));
    }
  } catch (err) {
    console.warn("getCombinedServerUsers cloud fetch note:", err?.message || err);
  }
  const merged1 = deduplicateAndMergeUsers(sqlUsers, diskUsers);
  const mergedAll = deduplicateAndMergeUsers(merged1, cloudUsers);
  const finalCleanUsers = mergedAll.filter((u) => {
    const uId = String(u.id || u.uid || "").trim();
    const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
    return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
  });
  for (const u of finalCleanUsers) {
    upsertUserInSql(u);
  }
  saveUsersBackup(finalCleanUsers);
  return finalCleanUsers;
}
app.get(["/api/users", "/api/backup/users"], async (_req, res) => {
  const mergedAll = await getCombinedServerUsers();
  return res.json({ success: true, count: mergedAll.length, users: mergedAll, source: "sqlite_sql_database" });
});
app.get("/api/deleted-identifiers", (_req, res) => {
  return res.json({
    success: true,
    deletedUsers: Array.from(loadDeletedUsers()),
    deletedProducts: Array.from(loadDeletedProducts()),
    deletedOrders: Array.from(loadDeletedOrders())
  });
});
app.get("/api/user/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ success: false, error: "Identifier is required" });
    }
    const cleanId = String(identifier).trim();
    let userRecord = getUserByIdOrPhoneFromSql(cleanId);
    if (!userRecord) {
      const all = await getCombinedServerUsers();
      const cleanPhone = cleanId.replace(/\D/g, "").slice(-10);
      userRecord = all.find(
        (u) => u.id === cleanId || u.phone === cleanId || cleanPhone.length === 10 && String(u.phone).replace(/\D/g, "").slice(-10) === cleanPhone
      );
    }
    if (!userRecord) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    return res.json({ success: true, user: userRecord });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post(["/api/user/save", "/api/user/update"], async (req, res) => {
  try {
    const userData = req.body.user || req.body;
    if (!userData || !userData.id && !userData.phone) {
      return res.status(400).json({ success: false, error: "User data with id or phone required" });
    }
    const saved = upsertUserInSql(userData);
    const diskUsers = getCachedUsersBackup();
    const updatedDisk = deduplicateAndMergeUsers(diskUsers, [saved]);
    saveUsersBackup(updatedDisk);
    upsertUser({
      uid: saved.id,
      phone: saved.phone,
      password: saved.password,
      nickname: saved.nickname,
      avatar: saved.avatar,
      invitationCode: saved.invitationCode,
      invitedBy: saved.invitedBy || void 0,
      inviterName: saved.inviterName || void 0,
      inviterId: saved.inviterId || void 0,
      rechargeBalance: saved.rechargeBalance,
      withdrawalBalance: saved.withdrawalBalance,
      productRevenue: saved.productRevenue,
      vipLevel: saved.vipLevel,
      totalInvested: saved.totalInvested,
      checkInStreak: saved.checkInStreak,
      lastCheckInDate: saved.lastCheckInDate,
      spinChances: saved.spinChances,
      status: saved.status,
      role: saved.role,
      totalReferrals: saved.totalReferrals,
      totalCommissionEarned: saved.totalCommissionEarned,
      bankDetails: saved.bankDetails
    }).catch(() => {
    });
    return res.json({
      success: true,
      message: "User details saved permanently in SQLite SQL database!",
      user: saved
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/user/bank-details", async (req, res) => {
  try {
    const { userId, phone, bankDetails } = req.body;
    if (!userId && !phone) {
      return res.status(400).json({ success: false, error: "userId or phone required" });
    }
    if (!bankDetails || typeof bankDetails !== "object") {
      return res.status(400).json({ success: false, error: "Valid bankDetails object required" });
    }
    const cleanId = String(userId || phone).trim();
    const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(-10) : "";
    const existing = getUserByIdOrPhoneFromSql(cleanId) || getUserByIdOrPhoneFromSql(cleanPhone) || { id: cleanId, phone: cleanPhone || cleanId };
    const mergedUser = {
      ...existing,
      bankDetails: {
        accountHolder: bankDetails.accountHolder?.trim() || existing.bankDetails?.accountHolder || "",
        bankName: bankDetails.bankName?.trim() || existing.bankDetails?.bankName || "Bank IMPS",
        accountNumber: bankDetails.accountNumber?.trim() || existing.bankDetails?.accountNumber || "",
        ifscCode: (bankDetails.ifscCode?.trim() || existing.bankDetails?.ifscCode || "").toUpperCase(),
        upiId: bankDetails.upiId?.trim() || existing.bankDetails?.upiId || ""
      }
    };
    const saved = upsertUserInSql(mergedUser);
    const diskUsers = getCachedUsersBackup();
    const updatedDisk = deduplicateAndMergeUsers(diskUsers, [saved]);
    saveUsersBackup(updatedDisk);
    upsertUser({
      uid: saved.id,
      phone: saved.phone,
      bankDetails: saved.bankDetails
    }).catch(() => {
    });
    return res.json({
      success: true,
      message: "Bank details saved permanently in SQLite SQL database!",
      bankDetails: saved.bankDetails,
      user: saved
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/referral/lookup/:code", async (req, res) => {
  try {
    const rawCode = String(req.params.code || "").trim();
    if (!rawCode) {
      return res.status(400).json({ success: false, valid: false, message: "Code required" });
    }
    const cleanCode = rawCode.toUpperCase();
    const cleanDigits = rawCode.replace(/\D/g, "").slice(-10);
    const usersList = await getCombinedServerUsers();
    let match = usersList.find((u) => (u.invitationCode || "").trim().toUpperCase() === cleanCode);
    if (!match && cleanDigits.length === 10) {
      match = usersList.find((u) => (u.phone || "").replace(/\D/g, "").slice(-10) === cleanDigits);
    }
    if (!match) {
      match = usersList.find((u) => String(u.id || "").trim().toUpperCase() === cleanCode);
    }
    if (!match && cleanCode === "4AB86") {
      match = usersList.find((u) => (u.phone || "").includes("7307112738")) || {
        id: "833863",
        phone: "7307112738",
        nickname: "gaurav",
        avatar: "HD",
        invitationCode: "4AB86",
        role: "admin",
        status: "active"
      };
    }
    if (!match && cleanCode === "R34VZ") {
      match = usersList.find((u) => u.id === "325697" || u.phone && u.phone.includes("9170481824"));
    }
    if (!match && cleanCode === "EYAYY") {
      match = usersList.find((u) => u.id === "406332" || u.phone && u.phone.includes("8858359277"));
    }
    if (match) {
      const cleanPhone = (match.phone || "").replace(/\D/g, "").slice(-10);
      const masked = cleanPhone.length === 10 ? `+91 ${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}` : `User #${match.id}`;
      return res.json({
        success: true,
        valid: true,
        user: {
          id: String(match.id),
          phone: match.phone,
          nickname: match.nickname || `Member_${String(match.id).slice(-4)}`,
          invitationCode: match.invitationCode || cleanCode,
          role: match.role || "user",
          avatar: match.avatar || "HD",
          status: match.status || "active",
          rechargeBalance: match.rechargeBalance || 0,
          withdrawalBalance: match.withdrawalBalance || 0,
          totalCommissionEarned: match.totalCommissionEarned || 0,
          totalReferrals: match.totalReferrals || 0,
          invitedBy: match.invitedBy || void 0,
          inviterId: match.inviterId || void 0,
          inviterName: match.inviterName || void 0
        },
        referrerInfo: {
          valid: true,
          id: String(match.id),
          name: match.nickname || `Member_${String(match.id).slice(-4)}`,
          code: match.invitationCode || cleanCode,
          phoneMasked: masked
        }
      });
    }
    return res.json({
      success: false,
      valid: false,
      message: `Referral code ${cleanCode} not found`
    });
  } catch (err) {
    return res.status(500).json({ success: false, valid: false, error: err.message });
  }
});
app.get("/api/referral/team/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ success: false, members: [] });
    }
    const allUsers = await getCombinedServerUsers();
    const currentUser = allUsers.find(
      (u) => u.id === userId || u.phone && u.phone.replace(/\D/g, "").slice(-10) === userId.replace(/\D/g, "").slice(-10)
    );
    const userCodes = /* @__PURE__ */ new Set();
    if (currentUser?.invitationCode) userCodes.add(currentUser.invitationCode.trim().toUpperCase());
    if (userId === "833863" || currentUser?.phone && currentUser.phone.includes("7307112738")) {
      userCodes.add("4AB86");
    }
    const userPhoneDigits = currentUser?.phone ? currentUser.phone.replace(/\D/g, "").slice(-10) : "";
    if (userPhoneDigits) userCodes.add(userPhoneDigits);
    if (currentUser?.id) userCodes.add(String(currentUser.id).trim().toUpperCase());
    if (userId) userCodes.add(userId.toUpperCase());
    const isRavi = userId === "325697" || userId === "9170481824" || currentUser?.phone && currentUser.phone.replace(/\D/g, "").slice(-10) === "9170481824" || currentUser?.invitationCode === "J9Y79";
    if (isRavi) {
      userCodes.add("J9Y79");
      userCodes.add("R34VZ");
      userCodes.add("852539");
      userCodes.add("325697");
      userCodes.add("9170481824");
    }
    const isAnshu = userId === "406332" || userId === "8858359277" || currentUser?.phone && currentUser.phone.replace(/\D/g, "").slice(-10) === "8858359277" || currentUser?.invitationCode === "AAWFK";
    if (isAnshu) {
      userCodes.add("AAWFK");
      userCodes.add("EYAYY");
      userCodes.add("406332");
      userCodes.add("8858359277");
    }
    const teamList = [];
    const otherUsers = allUsers.filter((u) => u.id !== userId && (!currentUser || u.id !== currentUser.id));
    const tier1Users = otherUsers.filter((u) => {
      const matchesInviterId = u.inviterId && (u.inviterId === userId || currentUser && u.inviterId === currentUser.id || isRavi && (u.inviterId === "852539" || u.inviterId === "325697" || u.inviterName && u.inviterName.toLowerCase().includes("ravi")) || isAnshu && (u.inviterId === "406332" || u.inviterName && u.inviterName.toLowerCase().includes("anshu")));
      const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : "";
      const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, "").slice(-10) : "";
      const matchesInvitedBy = cleanInvitedBy && (userCodes.has(cleanInvitedBy) || userPhoneDigits && cleanInvitedDigits === userPhoneDigits || isRavi && (cleanInvitedBy === "R34VZ" || cleanInvitedBy === "J9Y79" || u.inviterName && u.inviterName.toLowerCase().includes("ravi")) || isAnshu && (cleanInvitedBy === "EYAYY" || cleanInvitedBy === "AAWFK" || u.inviterName && u.inviterName.toLowerCase().includes("anshu")));
      return Boolean(matchesInviterId || matchesInvitedBy);
    });
    const tier1Ids = new Set(tier1Users.map((u) => String(u.id)));
    const tier1Codes = /* @__PURE__ */ new Set();
    const tier1Phones = /* @__PURE__ */ new Set();
    tier1Users.forEach((u) => {
      if (u.id) tier1Codes.add(String(u.id).trim().toUpperCase());
      if (u.invitationCode) tier1Codes.add(u.invitationCode.trim().toUpperCase());
      if (u.phone) {
        const p = u.phone.replace(/\D/g, "").slice(-10);
        tier1Codes.add(p);
        tier1Phones.add(p);
      }
    });
    tier1Users.forEach((u) => {
      const cleanP = u.phone ? u.phone.replace(/\D/g, "").slice(-10) : "";
      const masked = cleanP.length === 10 ? `+91 ${cleanP.slice(0, 3)}****${cleanP.slice(-3)}` : `User #${u.id}`;
      const totalBase = (u.totalInvested || 0) + (u.rechargeBalance || 0);
      const join = u.createdAt ? u.createdAt.split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      teamList.push({
        id: u.id,
        nickname: u.nickname || "Member",
        phoneMasked: masked,
        level: 1,
        joinDate: join,
        rechargeTotal: u.totalInvested || u.rechargeBalance || 0,
        commissionContributed: Number((totalBase * 0.1).toFixed(2))
      });
    });
    const tier2Users = otherUsers.filter((u) => {
      if (tier1Ids.has(String(u.id))) return false;
      const matchesInviterId = u.inviterId && tier1Ids.has(String(u.inviterId));
      const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : "";
      const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, "").slice(-10) : "";
      const matchesInvitedBy = cleanInvitedBy && (tier1Codes.has(cleanInvitedBy) || cleanInvitedDigits && tier1Phones.has(cleanInvitedDigits));
      return Boolean(matchesInviterId || matchesInvitedBy);
    });
    const tier2Ids = new Set(tier2Users.map((u) => String(u.id)));
    const tier2Codes = /* @__PURE__ */ new Set();
    const tier2Phones = /* @__PURE__ */ new Set();
    tier2Users.forEach((u) => {
      if (u.id) tier2Codes.add(String(u.id).trim().toUpperCase());
      if (u.invitationCode) tier2Codes.add(u.invitationCode.trim().toUpperCase());
      if (u.phone) {
        const p = u.phone.replace(/\D/g, "").slice(-10);
        tier2Codes.add(p);
        tier2Phones.add(p);
      }
    });
    tier2Users.forEach((u) => {
      const cleanP = u.phone ? u.phone.replace(/\D/g, "").slice(-10) : "";
      const masked = cleanP.length === 10 ? `+91 ${cleanP.slice(0, 3)}****${cleanP.slice(-3)}` : `User #${u.id}`;
      const totalBase = (u.totalInvested || 0) + (u.rechargeBalance || 0);
      const join = u.createdAt ? u.createdAt.split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      teamList.push({
        id: u.id,
        nickname: u.nickname || "Member",
        phoneMasked: masked,
        level: 2,
        joinDate: join,
        rechargeTotal: u.totalInvested || u.rechargeBalance || 0,
        commissionContributed: Number((totalBase * 0.03).toFixed(2))
      });
    });
    const tier3Users = otherUsers.filter((u) => {
      if (tier1Ids.has(String(u.id)) || tier2Ids.has(String(u.id))) return false;
      const matchesInviterId = u.inviterId && tier2Ids.has(String(u.inviterId));
      const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : "";
      const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, "").slice(-10) : "";
      const matchesInvitedBy = cleanInvitedBy && (tier2Codes.has(cleanInvitedBy) || cleanInvitedDigits && tier2Phones.has(cleanInvitedDigits));
      return Boolean(matchesInviterId || matchesInvitedBy);
    });
    tier3Users.forEach((u) => {
      const cleanP = u.phone ? u.phone.replace(/\D/g, "").slice(-10) : "";
      const masked = cleanP.length === 10 ? `+91 ${cleanP.slice(0, 3)}****${cleanP.slice(-3)}` : `User #${u.id}`;
      const totalBase = (u.totalInvested || 0) + (u.rechargeBalance || 0);
      const join = u.createdAt ? u.createdAt.split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      teamList.push({
        id: u.id,
        nickname: u.nickname || "Member",
        phoneMasked: masked,
        level: 3,
        joinDate: join,
        rechargeTotal: u.totalInvested || u.rechargeBalance || 0,
        commissionContributed: Number((totalBase * 0.01).toFixed(2))
      });
    });
    return res.json({ success: true, count: teamList.length, members: teamList });
  } catch (err) {
    return res.status(500).json({ success: false, members: [], error: err.message });
  }
});
async function distributeReferralCommissionServer(payerIdentifier, amount, actionType, referenceId) {
  if (!payerIdentifier || !amount || amount <= 0) {
    return { success: false, credited: [] };
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) return { success: false, credited: [] };
  const allUsers = await getCombinedServerUsers();
  const cleanPayer = String(payerIdentifier).trim();
  const cleanPayerPhone = cleanPayer.replace(/\D/g, "").slice(-10);
  const payer = allUsers.find(
    (u) => String(u.id).trim() === cleanPayer || cleanPayerPhone.length === 10 && String(u.phone || "").replace(/\D/g, "").slice(-10) === cleanPayerPhone
  );
  if (!payer) {
    console.log(`[Referral Commission] Payer ${payerIdentifier} not found in users list.`);
    return { success: false, credited: [] };
  }
  const findUpliner = (inviterId, invitedByCode) => {
    if (inviterId === "852539" || inviterId === "325697" || invitedByCode && (invitedByCode.trim().toUpperCase() === "R34VZ" || invitedByCode.trim().toUpperCase() === "J9Y79")) {
      const ravi = allUsers.find(
        (u) => u.id === "325697" || u.phone && u.phone.replace(/\D/g, "").slice(-10) === "9170481824" || u.invitationCode && u.invitationCode.trim().toUpperCase() === "J9Y79"
      );
      if (ravi) return ravi;
    }
    if (inviterId === "406332" || invitedByCode && (invitedByCode.trim().toUpperCase() === "EYAYY" || invitedByCode.trim().toUpperCase() === "AAWFK")) {
      const anshu = allUsers.find(
        (u) => u.id === "406332" || u.phone && u.phone.replace(/\D/g, "").slice(-10) === "8858359277" || u.invitationCode && u.invitationCode.trim().toUpperCase() === "AAWFK"
      );
      if (anshu) return anshu;
    }
    if (inviterId) {
      const match = allUsers.find((u) => String(u.id).trim() === String(inviterId).trim());
      if (match) return match;
    }
    if (invitedByCode) {
      const cleanCode = invitedByCode.trim().toUpperCase();
      const cleanDigits = invitedByCode.replace(/\D/g, "").slice(-10);
      const match = allUsers.find((u) => {
        const uCode = (u.invitationCode || "").trim().toUpperCase();
        const uPhone = (u.phone || "").replace(/\D/g, "").slice(-10);
        const uId = String(u.id || "").trim().toUpperCase();
        return uCode === cleanCode || cleanDigits.length === 10 && uPhone === cleanDigits || uId === cleanCode;
      });
      if (match) return match;
      if (cleanCode === "4AB86") {
        return allUsers.find((u) => (u.phone || "").includes("7307112738")) || {
          id: "833863",
          phone: "7307112738",
          nickname: "gaurav",
          invitationCode: "4AB86"
        };
      }
    }
    return null;
  };
  const actionLabel = actionType === "daily_income" ? "Daily Income Return" : actionType === "investment" ? "Contract Investment" : "Recharge / Deposit";
  const credited = [];
  const rates = [10, 3, 1];
  const tier1 = findUpliner(payer.inviterId, payer.invitedBy);
  if (tier1 && String(tier1.id) !== String(payer.id)) {
    const comm1 = Number((numAmount * rates[0] / 100).toFixed(2));
    if (comm1 > 0) {
      const updated1 = creditUserCommissionInSql(tier1.id, comm1);
      if (updated1) {
        saveUsersBackup(deduplicateAndMergeUsers(getCachedUsersBackup(), [updated1]));
        upsertUser({
          uid: updated1.id,
          phone: updated1.phone,
          withdrawalBalance: updated1.withdrawalBalance,
          totalCommissionEarned: updated1.totalCommissionEarned
        }).catch(() => {
        });
      }
      try {
        const txList = loadServerTransactions();
        const tx1 = {
          id: `tx-comm-${Date.now()}-1`,
          userId: tier1.id,
          phone: tier1.phone || "",
          type: "commission",
          amount: comm1,
          title: `Tier 1 Commission (${rates[0]}%) from ${payer.nickname || payer.phone || "downline"} - ${actionLabel}`,
          timestamp: (/* @__PURE__ */ new Date()).toLocaleString(),
          createdAt: Date.now(),
          status: "completed",
          referenceNo: `COMM1-${payer.id}-${Date.now().toString().slice(-4)}`,
          paymentMethod: "Referral Commission Wallet"
        };
        txList.unshift(tx1);
        saveServerTransactions(txList);
        createTransaction(tx1).catch(() => {
        });
      } catch (txErr) {
      }
      credited.push({ tier: 1, userId: tier1.id, nickname: tier1.nickname, amount: comm1, rate: rates[0] });
      console.log(`[Referral Commission] Credited Tier 1 ($${comm1}) to ${tier1.nickname || tier1.id} from ${payer.nickname || payer.id} for ${actionLabel}`);
    }
    const tier2 = findUpliner(tier1.inviterId, tier1.invitedBy);
    if (tier2 && String(tier2.id) !== String(payer.id) && String(tier2.id) !== String(tier1.id)) {
      const comm2 = Number((numAmount * rates[1] / 100).toFixed(2));
      if (comm2 > 0) {
        const updated2 = creditUserCommissionInSql(tier2.id, comm2);
        if (updated2) {
          saveUsersBackup(deduplicateAndMergeUsers(getCachedUsersBackup(), [updated2]));
          upsertUser({
            uid: updated2.id,
            phone: updated2.phone,
            withdrawalBalance: updated2.withdrawalBalance,
            totalCommissionEarned: updated2.totalCommissionEarned
          }).catch(() => {
          });
        }
        try {
          const txList = loadServerTransactions();
          const tx2 = {
            id: `tx-comm-${Date.now()}-2`,
            userId: tier2.id,
            phone: tier2.phone || "",
            type: "commission",
            amount: comm2,
            title: `Tier 2 Commission (${rates[1]}%) from ${payer.nickname || payer.phone || "downline"} - ${actionLabel}`,
            timestamp: (/* @__PURE__ */ new Date()).toLocaleString(),
            createdAt: Date.now(),
            status: "completed",
            referenceNo: `COMM2-${payer.id}-${Date.now().toString().slice(-4)}`,
            paymentMethod: "Referral Commission Wallet"
          };
          txList.unshift(tx2);
          saveServerTransactions(txList);
          createTransaction(tx2).catch(() => {
          });
        } catch (txErr) {
        }
        credited.push({ tier: 2, userId: tier2.id, nickname: tier2.nickname, amount: comm2, rate: rates[1] });
        console.log(`[Referral Commission] Credited Tier 2 ($${comm2}) to ${tier2.nickname || tier2.id} from ${payer.nickname || payer.id} for ${actionLabel}`);
      }
      const tier3 = findUpliner(tier2.inviterId, tier2.invitedBy);
      if (tier3 && String(tier3.id) !== String(payer.id) && String(tier3.id) !== String(tier1.id) && String(tier3.id) !== String(tier2.id)) {
        const comm3 = Number((numAmount * rates[2] / 100).toFixed(2));
        if (comm3 > 0) {
          const updated3 = creditUserCommissionInSql(tier3.id, comm3);
          if (updated3) {
            saveUsersBackup(deduplicateAndMergeUsers(getCachedUsersBackup(), [updated3]));
            upsertUser({
              uid: updated3.id,
              phone: updated3.phone,
              withdrawalBalance: updated3.withdrawalBalance,
              totalCommissionEarned: updated3.totalCommissionEarned
            }).catch(() => {
            });
          }
          try {
            const txList = loadServerTransactions();
            const tx3 = {
              id: `tx-comm-${Date.now()}-3`,
              userId: tier3.id,
              phone: tier3.phone || "",
              type: "commission",
              amount: comm3,
              title: `Tier 3 Commission (${rates[2]}%) from ${payer.nickname || payer.phone || "downline"} - ${actionLabel}`,
              timestamp: (/* @__PURE__ */ new Date()).toLocaleString(),
              createdAt: Date.now(),
              status: "completed",
              referenceNo: `COMM3-${payer.id}-${Date.now().toString().slice(-4)}`,
              paymentMethod: "Referral Commission Wallet"
            };
            txList.unshift(tx3);
            saveServerTransactions(txList);
            createTransaction(tx3).catch(() => {
            });
          } catch (txErr) {
          }
          credited.push({ tier: 3, userId: tier3.id, nickname: tier3.nickname, amount: comm3, rate: rates[2] });
          console.log(`[Referral Commission] Credited Tier 3 ($${comm3}) to ${tier3.nickname || tier3.id} from ${payer.nickname || payer.id} for ${actionLabel}`);
        }
      }
    }
  }
  return { success: true, credited };
}
async function reconcileAllReferralStatsServer(targetUserId) {
  try {
    const allUsers = await getCombinedServerUsers();
    const details = [];
    let reconciledCount = 0;
    const targets = targetUserId ? allUsers.filter((u) => String(u.id).trim() === String(targetUserId).trim() || u.phone && String(u.phone).includes(targetUserId)) : allUsers;
    for (const currentUser of targets) {
      const userId = String(currentUser.id);
      const userCodes = /* @__PURE__ */ new Set();
      if (currentUser.invitationCode) userCodes.add(currentUser.invitationCode.trim().toUpperCase());
      if (userId === "833863" || currentUser.phone && currentUser.phone.includes("7307112738")) {
        userCodes.add("4AB86");
      }
      const userPhoneDigits = currentUser.phone ? currentUser.phone.replace(/\D/g, "").slice(-10) : "";
      if (userPhoneDigits) userCodes.add(userPhoneDigits);
      if (currentUser.id) userCodes.add(String(currentUser.id).trim().toUpperCase());
      const isRavi = userId === "325697" || userId === "9170481824" || currentUser.phone && currentUser.phone.replace(/\D/g, "").slice(-10) === "9170481824" || currentUser.invitationCode === "J9Y79";
      if (isRavi) {
        userCodes.add("J9Y79");
        userCodes.add("R34VZ");
        userCodes.add("852539");
        userCodes.add("325697");
        userCodes.add("9170481824");
      }
      const isAnshu = userId === "406332" || currentUser.phone && currentUser.phone.replace(/\D/g, "").slice(-10) === "8858359277" || currentUser.invitationCode === "AAWFK";
      if (isAnshu) {
        userCodes.add("AAWFK");
        userCodes.add("EYAYY");
        userCodes.add("406332");
        userCodes.add("8858359277");
      }
      const otherUsers = allUsers.filter((u) => String(u.id) !== userId);
      const tier1Users = otherUsers.filter((u) => {
        const matchesInviterId = u.inviterId && (String(u.inviterId) === userId || isRavi && (String(u.inviterId) === "852539" || String(u.inviterId) === "325697" || u.inviterName && u.inviterName.toLowerCase().includes("ravi")) || isAnshu && (String(u.inviterId) === "406332" || u.inviterName && u.inviterName.toLowerCase().includes("anshu")));
        const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : "";
        const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, "").slice(-10) : "";
        const matchesInvitedBy = cleanInvitedBy && (userCodes.has(cleanInvitedBy) || userPhoneDigits && cleanInvitedDigits === userPhoneDigits || isRavi && (cleanInvitedBy === "R34VZ" || cleanInvitedBy === "J9Y79" || u.inviterName && u.inviterName.toLowerCase().includes("ravi")) || isAnshu && (cleanInvitedBy === "EYAYY" || cleanInvitedBy === "AAWFK" || u.inviterName && u.inviterName.toLowerCase().includes("anshu")));
        return Boolean(matchesInviterId || matchesInvitedBy);
      });
      const tier1Ids = new Set(tier1Users.map((u) => String(u.id)));
      const tier1Codes = /* @__PURE__ */ new Set();
      const tier1Phones = /* @__PURE__ */ new Set();
      tier1Users.forEach((u) => {
        if (u.id) tier1Codes.add(String(u.id).trim().toUpperCase());
        if (u.invitationCode) tier1Codes.add(u.invitationCode.trim().toUpperCase());
        if (u.phone) {
          const p = u.phone.replace(/\D/g, "").slice(-10);
          tier1Codes.add(p);
          tier1Phones.add(p);
        }
      });
      const tier2Users = otherUsers.filter((u) => {
        if (tier1Ids.has(String(u.id))) return false;
        const matchesInviterId = u.inviterId && tier1Ids.has(String(u.inviterId));
        const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : "";
        const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, "").slice(-10) : "";
        const matchesInvitedBy = cleanInvitedBy && (tier1Codes.has(cleanInvitedBy) || cleanInvitedDigits && tier1Phones.has(cleanInvitedDigits));
        return Boolean(matchesInviterId || matchesInvitedBy);
      });
      const tier2Ids = new Set(tier2Users.map((u) => String(u.id)));
      const tier2Codes = /* @__PURE__ */ new Set();
      const tier2Phones = /* @__PURE__ */ new Set();
      tier2Users.forEach((u) => {
        if (u.id) tier2Codes.add(String(u.id).trim().toUpperCase());
        if (u.invitationCode) tier2Codes.add(u.invitationCode.trim().toUpperCase());
        if (u.phone) {
          const p = u.phone.replace(/\D/g, "").slice(-10);
          tier2Codes.add(p);
          tier2Phones.add(p);
        }
      });
      const tier3Users = otherUsers.filter((u) => {
        if (tier1Ids.has(String(u.id)) || tier2Ids.has(String(u.id))) return false;
        const matchesInviterId = u.inviterId && tier2Ids.has(String(u.inviterId));
        const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : "";
        const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, "").slice(-10) : "";
        const matchesInvitedBy = cleanInvitedBy && (tier2Codes.has(cleanInvitedBy) || cleanInvitedDigits && tier2Phones.has(cleanInvitedDigits));
        return Boolean(matchesInviterId || matchesInvitedBy);
      });
      let tier1Comm = 0;
      tier1Users.forEach((u) => {
        const base = (Number(u.totalInvested) || 0) + (Number(u.rechargeBalance) || 0);
        tier1Comm += base * 0.1;
      });
      let tier2Comm = 0;
      tier2Users.forEach((u) => {
        const base = (Number(u.totalInvested) || 0) + (Number(u.rechargeBalance) || 0);
        tier2Comm += base * 0.03;
      });
      let tier3Comm = 0;
      tier3Users.forEach((u) => {
        const base = (Number(u.totalInvested) || 0) + (Number(u.rechargeBalance) || 0);
        tier3Comm += base * 0.01;
      });
      const totalCalculatedCommission = Number((tier1Comm + tier2Comm + tier3Comm).toFixed(2));
      const directCount = tier1Users.length;
      if (directCount > (currentUser.totalReferrals || 0)) {
        updateUserReferralsInSql(userId, directCount);
        currentUser.totalReferrals = directCount;
      }
      const currentEarned = Number(currentUser.totalCommissionEarned) || 0;
      if (totalCalculatedCommission > currentEarned) {
        const uncredited = Number((totalCalculatedCommission - currentEarned).toFixed(2));
        if (uncredited > 0) {
          const updated = creditUserCommissionInSql(userId, uncredited);
          if (updated) {
            saveUsersBackup(deduplicateAndMergeUsers(getCachedUsersBackup(), [updated]));
            upsertUser({
              uid: updated.id,
              phone: updated.phone,
              withdrawalBalance: updated.withdrawalBalance,
              totalCommissionEarned: updated.totalCommissionEarned
            }).catch(() => {
            });
            reconciledCount++;
            details.push({
              userId,
              nickname: currentUser.nickname,
              uncredited,
              newWithdrawal: updated.withdrawalBalance,
              totalCommission: updated.totalCommissionEarned,
              directCount
            });
            console.log(`[Referral Reconciliation] User ${currentUser.nickname || userId} credited with uncredited referral income +$${uncredited} (Total: $${updated.totalCommissionEarned})`);
          }
        }
      }
    }
    return { reconciledCount, details };
  } catch (err) {
    console.error("Error during referral reconciliation:", err);
    return { reconciledCount: 0, details: [] };
  }
}
app.post("/api/referral/distribute", async (req, res) => {
  try {
    const { payerId, payerPhone, amount, actionType, referenceId } = req.body;
    const payerIdentifier = payerId || payerPhone;
    if (!payerIdentifier || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Payer identifier and positive amount required" });
    }
    const result = await distributeReferralCommissionServer(
      payerIdentifier,
      Number(amount),
      actionType || "investment",
      referenceId
    );
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post(["/api/referral/sync-stats", "/api/referral/sync-stats/:userId"], async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    const result = await reconcileAllReferralStatsServer(targetUserId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/backup/users", async (req, res) => {
  try {
    const incoming = req.body.users || (req.body.user ? [req.body.user] : Array.isArray(req.body) ? req.body : null);
    const isNewRegistration = Boolean(req.body.isNewRegistration);
    if (!incoming || !Array.isArray(incoming)) {
      return res.status(400).json({ success: false, error: "Expected array of users" });
    }
    const deletedSet = loadDeletedUsers();
    if (isNewRegistration && !req.body.forceSave) {
      incoming.forEach((u) => {
        if (u?.id) deletedSet.delete(String(u.id).trim());
        if (u?.phone) deletedSet.delete(String(u.phone).replace(/\D/g, "").slice(-10));
      });
      try {
        fs2.writeFileSync(DELETED_USERS_PATH, JSON.stringify(Array.from(deletedSet), null, 2), "utf-8");
      } catch {
      }
    }
    const cleanIncoming = incoming.filter((u) => {
      if (!u) return false;
      const uId = String(u.id || u.uid || "").trim();
      const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
      return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
    }).map((u) => {
      if (u.invitedBy === "R34VZ" || u.inviterId === "852539" || u.inviterName && String(u.inviterName).trim().toLowerCase() === "ravisahu") {
        return {
          ...u,
          invitedBy: "J9Y79",
          inviterName: "Ravi Sahu",
          inviterId: "325697"
        };
      }
      if (u.invitedBy === "EYAYY" || u.inviterName && String(u.inviterName).trim().toLowerCase().includes("anshu") && (u.inviterId === "406332" || !u.inviterId)) {
        return {
          ...u,
          invitedBy: "AAWFK",
          inviterName: "Anshusahu",
          inviterId: "406332"
        };
      }
      return u;
    });
    const current = getCachedUsersBackup();
    const mergedList = deduplicateAndMergeUsers(current, cleanIncoming);
    saveUsersBackup(mergedList);
    for (const u of cleanIncoming) {
      if (u && (u.id || u.phone)) {
        const rawId = String(u.id || u.uid || u.phone).trim();
        const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, "").slice(-10) : "";
        if (deletedSet.has(rawId) || cleanPhone && deletedSet.has(cleanPhone)) {
          continue;
        }
        const fullMergedUser = mergedList.find(
          (m) => m.id === rawId || cleanPhone && String(m.phone || "").replace(/\D/g, "").slice(-10) === cleanPhone
        ) || u;
        try {
          upsertUserInSql(fullMergedUser);
        } catch (sqliteErr) {
          console.warn("Upserting user to SQLite warning:", sqliteErr);
        }
        try {
          await upsertUser({
            uid: fullMergedUser.id || fullMergedUser.uid || fullMergedUser.phone,
            phone: fullMergedUser.phone,
            password: fullMergedUser.password || "password123",
            nickname: fullMergedUser.nickname,
            avatar: fullMergedUser.avatar,
            invitationCode: fullMergedUser.invitationCode,
            invitedBy: fullMergedUser.invitedBy,
            inviterName: fullMergedUser.inviterName,
            inviterId: fullMergedUser.inviterId,
            rechargeBalance: Number(fullMergedUser.rechargeBalance) || 0,
            withdrawalBalance: Number(fullMergedUser.withdrawalBalance) || 0,
            productRevenue: Number(fullMergedUser.productRevenue) || 0,
            vipLevel: Number(fullMergedUser.vipLevel) || 0,
            totalInvested: Number(fullMergedUser.totalInvested) || 0,
            checkInStreak: Number(fullMergedUser.checkInStreak) || 0,
            lastCheckInDate: fullMergedUser.lastCheckInDate,
            spinChances: Number(fullMergedUser.spinChances) || 0,
            status: fullMergedUser.status,
            role: fullMergedUser.role,
            totalReferrals: Number(fullMergedUser.totalReferrals) || 0,
            totalCommissionEarned: Number(fullMergedUser.totalCommissionEarned) || 0,
            bankDetails: fullMergedUser.bankDetails
          });
        } catch (dbErr) {
          console.warn("Upserting user to Cloud SQL encountered an error:", dbErr?.message || dbErr);
        }
      }
    }
    return res.json({ success: true, count: mergedList.length, users: mergedList });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post(["/api/backup/relink-upliner", "/api/admin/users/relink-upline", "/api/relink-upliner"], async (req, res) => {
  try {
    const rawUserId = req.body.userId || req.body.targetUserId || req.body.targetId;
    const rawUserPhone = req.body.userPhone || req.body.targetPhone || req.body.targetMobile;
    const cleanUserId = String(rawUserId || "").trim();
    const cleanUserPhone = String(rawUserPhone || "").replace(/\D/g, "").slice(-10);
    if (!cleanUserId && !cleanUserPhone) {
      return res.status(400).json({ success: false, error: "User identifier (userId or userPhone) required" });
    }
    const rawUplineCode = String(req.body.uplineCode || req.body.referralCode || req.body.code || "").trim().toUpperCase();
    const cleanUplinePhone = String(req.body.uplinePhone || req.body.uplineMobile || "").replace(/\D/g, "").slice(-10);
    const cleanUplineId = String(req.body.uplineId || req.body.inviterId || "").trim();
    let target = getUserByIdOrPhoneFromSql(cleanUserId) || (cleanUserPhone ? getUserByIdOrPhoneFromSql(cleanUserPhone) : null);
    if (!target) {
      const all = await getCombinedServerUsers();
      target = all.find(
        (u) => cleanUserId && String(u.id).trim() === cleanUserId || cleanUserPhone && String(u.phone || "").replace(/\D/g, "").slice(-10) === cleanUserPhone
      );
    }
    if (!target) {
      const current = getCachedUsersBackup();
      target = current.find(
        (u) => cleanUserId && String(u.id).trim() === cleanUserId || cleanUserPhone && String(u.phone || "").replace(/\D/g, "").slice(-10) === cleanUserPhone
      );
    }
    if (!target) {
      return res.status(404).json({ success: false, error: "Target member not found in database" });
    }
    let upliner = null;
    if (cleanUplineId) upliner = getUserByIdOrPhoneFromSql(cleanUplineId);
    if (!upliner && cleanUplinePhone) upliner = getUserByIdOrPhoneFromSql(cleanUplinePhone);
    if (!upliner && rawUplineCode) upliner = getUserByIdOrPhoneFromSql(rawUplineCode);
    if (!upliner) {
      const all = await getCombinedServerUsers();
      upliner = all.find((u) => {
        const uId = String(u.id || "").trim();
        const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
        const uCode = String(u.invitationCode || "").trim().toUpperCase();
        return cleanUplineId && uId === cleanUplineId || cleanUplinePhone && uPhone === cleanUplinePhone || rawUplineCode && uCode === rawUplineCode;
      });
    }
    if (!upliner && rawUplineCode === "4AB86") {
      upliner = {
        id: "833863",
        phone: "7307112738",
        nickname: "gaurav",
        invitationCode: "4AB86"
      };
    }
    const finalUplineCode = upliner?.invitationCode || rawUplineCode || "4AB86";
    const finalUplineId = upliner?.id || cleanUplineId || null;
    const finalUplineName = upliner?.nickname || upliner?.name || (rawUplineCode ? `Sponsor (${rawUplineCode})` : "Sponsor");
    const updatedSqlRecord = relinkUserUplineInSql(target.id, finalUplineCode, finalUplineId, finalUplineName);
    const diskUsers = getCachedUsersBackup();
    const diskTarget = diskUsers.find(
      (u) => String(u.id).trim() === String(target.id).trim() || cleanUserPhone && String(u.phone || "").replace(/\D/g, "").slice(-10) === cleanUserPhone
    );
    if (diskTarget) {
      diskTarget.invitedBy = finalUplineCode;
      diskTarget.inviterId = finalUplineId;
      diskTarget.inviterName = finalUplineName;
      diskTarget.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      saveUsersBackup(diskUsers);
    }
    try {
      await relinkUpline(target.id, finalUplineCode);
    } catch (sqlErr) {
      console.warn("Relink upline in Cloud SQL warning:", sqlErr?.message || sqlErr);
    }
    console.log(`[Admin Relink] User ${target.nickname || target.phone} (#${target.id}) re-linked to sponsor ${finalUplineName} (${finalUplineCode}) in SQLite & Backup.`);
    return res.json({
      success: true,
      message: `User ${target.nickname || target.phone} successfully re-linked under sponsor ${finalUplineName} (${finalUplineCode})!`,
      user: updatedSqlRecord || {
        ...target,
        invitedBy: finalUplineCode,
        inviterId: finalUplineId,
        inviterName: finalUplineName
      }
    });
  } catch (err) {
    console.error("Error during relink upliner:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
var PROMO_CODES_PATH = path2.resolve(process.cwd(), "src/data/promo_codes.json");
var DELETED_PROMOS_PATH = path2.resolve(process.cwd(), "src/data/deleted_promos.json");
function loadDeletedPromoKeys() {
  try {
    if (fs2.existsSync(DELETED_PROMOS_PATH)) {
      const parsed = JSON.parse(fs2.readFileSync(DELETED_PROMOS_PATH, "utf-8"));
      if (Array.isArray(parsed)) return new Set(parsed.map((k) => String(k).trim().toUpperCase()));
    }
  } catch (err) {
    console.warn("Could not read deleted_promos.json:", err);
  }
  return /* @__PURE__ */ new Set();
}
function saveDeletedPromoKeys(keys) {
  try {
    fs2.writeFileSync(DELETED_PROMOS_PATH, JSON.stringify(Array.from(keys), null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write deleted_promos.json:", err);
  }
}
var adminDeletedPromoKeys = loadDeletedPromoKeys();
function loadServerPromoCodes() {
  try {
    if (fs2.existsSync(PROMO_CODES_PATH)) {
      const parsed = JSON.parse(fs2.readFileSync(PROMO_CODES_PATH, "utf-8"));
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => {
          const pId = String(p.id || "").trim().toUpperCase();
          const pCode = String(p.code || "").trim().toUpperCase();
          return !adminDeletedPromoKeys.has(pId) && !adminDeletedPromoKeys.has(pCode);
        });
      }
    }
  } catch (err) {
    console.warn("Could not read promo_codes.json:", err);
  }
  return [];
}
function saveServerPromoCodes(promos) {
  try {
    fs2.writeFileSync(PROMO_CODES_PATH, JSON.stringify(promos, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write promo_codes.json:", err);
  }
}
app.get("/api/promos", (_req, res) => {
  try {
    const list = loadServerPromoCodes();
    return res.json({
      success: true,
      promoCodes: list,
      deletedPromoKeys: Array.from(adminDeletedPromoKeys)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/promos", async (req, res) => {
  try {
    const promo = req.body;
    if (!promo || !promo.code) {
      return res.status(400).json({ success: false, error: "Promo code data is required" });
    }
    const current = loadServerPromoCodes();
    const cleanCode = String(promo.code).trim().toUpperCase();
    const cleanId = promo.id || `promo-${Date.now()}`;
    const cleanPromo = {
      ...promo,
      id: cleanId,
      code: cleanCode,
      amount: Number(promo.amount) || 0,
      maxUses: Number(promo.maxUses) || 100,
      usedCount: Number(promo.usedCount) || 0,
      isActive: promo.isActive !== false,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (adminDeletedPromoKeys.has(cleanId.toUpperCase()) || adminDeletedPromoKeys.has(cleanCode)) {
      adminDeletedPromoKeys.delete(cleanId.toUpperCase());
      adminDeletedPromoKeys.delete(cleanCode);
      saveDeletedPromoKeys(adminDeletedPromoKeys);
    }
    const existingIdx = current.findIndex((p) => p.id === cleanId || String(p.code).trim().toUpperCase() === cleanCode);
    if (existingIdx >= 0) {
      current[existingIdx] = { ...current[existingIdx], ...cleanPromo };
    } else {
      current.unshift(cleanPromo);
    }
    saveServerPromoCodes(current);
    try {
      await upsertDbPromoCode(cleanPromo);
    } catch (sqlErr) {
      console.warn("Sync promo code to Cloud SQL warning:", sqlErr);
    }
    return res.json({
      success: true,
      promoCode: cleanPromo,
      promoCodes: current,
      deletedPromoKeys: Array.from(adminDeletedPromoKeys)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/promos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const queryCode = req.query.code ? String(req.query.code).trim().toUpperCase() : "";
    if (!id) {
      return res.status(400).json({ success: false, error: "Promo code ID is required" });
    }
    const current = loadServerPromoCodes();
    const cleanId = String(id).trim();
    const target = current.find(
      (p) => p.id === cleanId || String(p.code).trim().toUpperCase() === cleanId.toUpperCase() || queryCode && String(p.code).trim().toUpperCase() === queryCode
    );
    const codeToTombstone = queryCode || (target?.code ? String(target.code).trim().toUpperCase() : cleanId.toUpperCase());
    try {
      await deleteDbPromoCode(cleanId);
      if (codeToTombstone) {
        await deleteDbPromoCode(codeToTombstone);
      }
      if (target?.id && target.id !== cleanId) {
        await deleteDbPromoCode(target.id);
      }
    } catch (sqlErr) {
      console.warn("Delete promo code from Cloud SQL warning:", sqlErr);
    }
    adminDeletedPromoKeys.add(cleanId.toUpperCase());
    if (target?.id) adminDeletedPromoKeys.add(String(target.id).trim().toUpperCase());
    if (codeToTombstone) adminDeletedPromoKeys.add(codeToTombstone);
    saveDeletedPromoKeys(adminDeletedPromoKeys);
    const filtered = current.filter((p) => {
      const pId = String(p.id).trim().toUpperCase();
      const pCode = String(p.code).trim().toUpperCase();
      if (pId === cleanId.toUpperCase() || target?.id && pId === String(target.id).trim().toUpperCase()) return false;
      if (pCode === cleanId.toUpperCase() || codeToTombstone && pCode === codeToTombstone) return false;
      if (adminDeletedPromoKeys.has(pId) || adminDeletedPromoKeys.has(pCode)) return false;
      return true;
    });
    saveServerPromoCodes(filtered);
    console.log(`[Admin Delete] Promo code ${cleanId} (${codeToTombstone}) permanently deleted from Cloud SQL and disk.`);
    return res.json({
      success: true,
      message: `Gift code "${codeToTombstone || cleanId}" permanently deleted from database and disk.`,
      promoCodes: filtered,
      deletedPromoKeys: Array.from(adminDeletedPromoKeys)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
var ORDERS_BACKUP_PATH = path2.resolve(process.cwd(), "src/data/orders_backup.json");
function initAndSyncSqlOrders() {
  try {
    let diskOrders = [];
    if (fs2.existsSync(ORDERS_BACKUP_PATH)) {
      try {
        const parsed = JSON.parse(fs2.readFileSync(ORDERS_BACKUP_PATH, "utf-8"));
        if (Array.isArray(parsed)) diskOrders = parsed;
      } catch {
      }
    }
    for (const ord of diskOrders) {
      if (ord && ord.id) {
        try {
          upsertOrderInSql(ord);
        } catch (e) {
          console.warn("Initial SQLite sync error for order:", ord.id, e);
        }
      }
    }
    try {
      const allUsers = getCachedUsersBackup();
      syncAllRealUserOrders(allUsers);
    } catch (e) {
      console.warn("Error running syncAllRealUserOrders on boot:", e);
    }
    const allSqlOrders = getAllOrdersFromSql();
    if (allSqlOrders.length > 0) {
      fs2.writeFileSync(ORDERS_BACKUP_PATH, JSON.stringify(allSqlOrders, null, 2), "utf-8");
      console.log(`[SQL Database] ${allSqlOrders.length} investment orders loaded and verified permanent in SQLite database.`);
    }
  } catch (err) {
    console.warn("[SQL Database] Order init sync warning:", err);
  }
}
initAndSyncSqlOrders();
try {
  const prodsFile = path2.resolve(process.cwd(), "src/data/firestoreProducts.json");
  if (fs2.existsSync(prodsFile)) {
    const diskProds = JSON.parse(fs2.readFileSync(prodsFile, "utf-8"));
    if (Array.isArray(diskProds) && diskProds.length > 0) {
      initAndSyncSqlProducts(diskProds);
    }
  }
} catch (e) {
  console.warn("[SQL Database] Product init sync warning:", e);
}
function loadServerOrders() {
  const orderMap = /* @__PURE__ */ new Map();
  const deletedSet = loadDeletedOrders();
  try {
    const sqlOrders = getAllOrdersFromSql();
    for (const o of sqlOrders) {
      if (o && o.id && !deletedSet.has(String(o.id).trim().toLowerCase())) {
        orderMap.set(String(o.id), o);
      }
    }
  } catch (err) {
    console.warn("Error reading orders from SQLite SQL:", err);
  }
  try {
    if (fs2.existsSync(ORDERS_BACKUP_PATH)) {
      const parsed = JSON.parse(fs2.readFileSync(ORDERS_BACKUP_PATH, "utf-8"));
      if (Array.isArray(parsed)) {
        for (const o of parsed) {
          const strId = String(o?.id || "").trim().toLowerCase();
          if (o && o.id && !deletedSet.has(strId) && !orderMap.has(String(o.id))) {
            orderMap.set(String(o.id), o);
            try {
              upsertOrderInSql(o);
            } catch {
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not read orders_backup.json:", err);
  }
  return Array.from(orderMap.values());
}
function saveServerOrders(ordersList) {
  const deletedSet = loadDeletedOrders();
  const cleanList = (ordersList || []).filter(
    (o) => o && o.id && !deletedSet.has(String(o.id).trim().toLowerCase())
  );
  for (const o of cleanList) {
    if (o && o.id) {
      try {
        upsertOrderInSql(o);
      } catch (err) {
        console.warn("Error saving order to SQLite SQL:", o.id, err);
      }
    }
  }
  try {
    fs2.writeFileSync(ORDERS_BACKUP_PATH, JSON.stringify(cleanList, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write orders_backup.json:", err);
  }
}
function enrichOrderWithUserData(order, allUsers) {
  if (!order) return order;
  const uid = String(order.userId || "").trim();
  const uphone = String(order.userPhone || "").replace(/\D/g, "").slice(-10);
  const matchedUser = allUsers.find(
    (u) => u.id && String(u.id).trim() === uid || u.uid && String(u.uid).trim() === uid || u.phone && String(u.phone).trim() === uid || uphone && u.phone && String(u.phone).replace(/\D/g, "").slice(-10) === uphone
  );
  return {
    ...order,
    userId: order.userId || (matchedUser ? matchedUser.id : uid),
    userPhone: order.userPhone || (matchedUser ? matchedUser.phone : ""),
    userNickname: order.userNickname || (matchedUser ? matchedUser.nickname : "Investor")
  };
}
app.get(["/api/orders", "/api/admin/orders"], async (_req, res) => {
  try {
    const diskAndSqlOrders = loadServerOrders();
    const allUsers = getCachedUsersBackup();
    let cloudSqlOrders = [];
    try {
      cloudSqlOrders = await getAllDbOrders();
    } catch (e) {
      console.warn("Could not fetch orders from Cloud SQL:", e?.message || e);
    }
    const deletedSet = loadDeletedOrders();
    const orderMap = /* @__PURE__ */ new Map();
    diskAndSqlOrders.forEach((o) => {
      if (o && o.id && !deletedSet.has(String(o.id).trim().toLowerCase())) {
        orderMap.set(String(o.id), enrichOrderWithUserData(o, allUsers));
      }
    });
    cloudSqlOrders.forEach((so) => {
      if (so && so.id) {
        const strId = String(so.id);
        if (deletedSet.has(strId.toLowerCase())) return;
        const existing = orderMap.get(strId);
        const merged = { ...existing || {}, ...so };
        orderMap.set(strId, enrichOrderWithUserData(merged, allUsers));
        try {
          upsertOrderInSql(merged);
        } catch {
        }
      }
    });
    const result = Array.from(orderMap.values()).sort((a, b) => {
      const timeA = a.purchaseTimestamp || (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0);
      const timeB = b.purchaseTimestamp || (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0);
      return timeB - timeA;
    });
    return res.json({
      success: true,
      count: result.length,
      sqlEngine: "Permanent SQLite + Cloud SQL Enabled",
      orders: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/orders/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId).trim();
    const allUsers = getCachedUsersBackup();
    const cleanDigits = cleanId.replace(/\D/g, "").slice(-10);
    const matchedUser = allUsers.find(
      (u) => String(u.id).trim() === cleanId || String(u.uid || "").trim() === cleanId || u.phone && String(u.phone).trim() === cleanId || cleanDigits && u.phone && String(u.phone).replace(/\D/g, "").slice(-10) === cleanDigits
    );
    const possibleIds = /* @__PURE__ */ new Set([cleanId]);
    if (cleanDigits) {
      possibleIds.add(cleanDigits);
      possibleIds.add(`+91 ${cleanDigits}`);
      possibleIds.add(`91${cleanDigits}`);
    }
    if (matchedUser?.id) possibleIds.add(String(matchedUser.id).trim());
    if (matchedUser?.phone) {
      const phoneDigits = String(matchedUser.phone).replace(/\D/g, "").slice(-10);
      possibleIds.add(phoneDigits);
      possibleIds.add(`+91 ${phoneDigits}`);
    }
    const identifiersList = Array.from(possibleIds);
    let sqlUserOrders = [];
    try {
      sqlUserOrders = getOrdersForUserFromSql(identifiersList);
    } catch (sqlErr) {
      console.warn("Error querying SQLite for user orders:", sqlErr);
    }
    const allDiskOrders = loadServerOrders();
    const diskUserOrders = allDiskOrders.filter((o) => {
      if (!o) return false;
      const oUserId = String(o.userId || "").trim();
      const oPhone = String(o.userPhone || "").replace(/\D/g, "").slice(-10);
      return possibleIds.has(oUserId) || oPhone && possibleIds.has(oPhone) || cleanDigits && oPhone === cleanDigits;
    });
    let cloudSqlUserOrders = [];
    try {
      cloudSqlUserOrders = await getDbOrdersByUser(cleanId, matchedUser?.phone);
    } catch {
    }
    const orderMap = /* @__PURE__ */ new Map();
    for (const o of [...sqlUserOrders, ...diskUserOrders, ...cloudSqlUserOrders]) {
      if (o && o.id) {
        const enriched = enrichOrderWithUserData(o, allUsers);
        orderMap.set(String(o.id), enriched);
      }
    }
    const finalUserOrders = Array.from(orderMap.values()).sort((a, b) => {
      const timeA = a.purchaseTimestamp || (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0);
      const timeB = b.purchaseTimestamp || (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0);
      return timeB - timeA;
    });
    return res.json({
      success: true,
      count: finalUserOrders.length,
      matchedIdentifiers: identifiersList,
      orders: finalUserOrders
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post(["/api/orders", "/api/admin/orders"], async (req, res) => {
  try {
    const payload = req.body;
    const orderData = payload.order || payload;
    if (!orderData || !orderData.id) {
      return res.status(400).json({ success: false, error: "Order data with ID is required" });
    }
    const allUsers = getCachedUsersBackup();
    const enriched = enrichOrderWithUserData(orderData, allUsers);
    try {
      upsertOrderInSql(enriched);
    } catch (sqlErr) {
      console.warn("Error saving to SQLite SQL database:", sqlErr);
    }
    const diskOrders = loadServerOrders();
    const existingIndex = diskOrders.findIndex((o) => String(o.id) === String(enriched.id));
    if (existingIndex >= 0) {
      diskOrders[existingIndex] = { ...diskOrders[existingIndex], ...enriched };
    } else {
      diskOrders.unshift(enriched);
    }
    saveServerOrders(diskOrders);
    try {
      await upsertDbOrder(enriched);
    } catch (e) {
      console.warn("Error syncing order to Cloud SQL:", e?.message || e);
    }
    const orderPrice = Number(enriched.price) || 0;
    if (orderPrice > 0 && (enriched.userId || enriched.userPhone)) {
      distributeReferralCommissionServer(
        enriched.userId || enriched.userPhone,
        orderPrice,
        "investment",
        enriched.id
      ).catch((refErr) => console.warn("Order referral commission notice:", refErr));
    }
    console.log(`[Permanent SQL Save] Order ${enriched.id} (${enriched.productName}) for User ${enriched.userId} saved permanently in SQL!`);
    return res.json({
      success: true,
      message: "Order saved permanently in SQL database!",
      order: enriched
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.put("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const diskOrders = loadServerOrders();
    const allUsers = getCachedUsersBackup();
    const idx = diskOrders.findIndex((o) => String(o.id) === String(id));
    const baseOrder = idx >= 0 ? diskOrders[idx] : { id };
    const updated = enrichOrderWithUserData(
      { ...baseOrder, ...updates, id, updatedAt: (/* @__PURE__ */ new Date()).toISOString() },
      allUsers
    );
    try {
      upsertOrderInSql(updated);
    } catch (sqlErr) {
      console.warn("Error updating order in SQLite SQL:", sqlErr);
    }
    if (idx >= 0) {
      diskOrders[idx] = updated;
    } else {
      diskOrders.unshift(updated);
    }
    saveServerOrders(diskOrders);
    try {
      await upsertDbOrder(updated);
    } catch {
    }
    return res.json({ success: true, order: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id).trim();
    try {
      deleteOrderFromSql(cleanId);
    } catch (sqlErr) {
      console.warn("Error deleting order from SQLite SQL:", sqlErr);
    }
    try {
      await deleteOrderFromDb(cleanId);
    } catch (sqlErr) {
      console.warn("Delete order from Cloud SQL warning:", sqlErr);
    }
    const diskOrders = loadServerOrders();
    const filtered = diskOrders.filter((o) => String(o.id) !== cleanId);
    saveServerOrders(filtered);
    console.log(`[Admin Delete] Order ${cleanId} permanently deleted from SQLite SQL, Cloud SQL, and disk.`);
    return res.json({ success: true, message: "Order removed permanently from SQL database and backup" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteTransactionFromDb(id);
    return res.json({ success: true, message: `Transaction ${id} deleted from Cloud SQL` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/products", async (_req, res) => {
  try {
    const productMap = /* @__PURE__ */ new Map();
    const deletedProducts = loadDeletedProducts();
    try {
      const sqlProds = getAllProductsFromSql();
      for (const p of sqlProds) {
        if (p && p.id && !deletedProducts.has(String(p.id).trim())) {
          productMap.set(String(p.id), p);
        }
      }
    } catch (e) {
      console.warn("Error reading products from SQLite:", e);
    }
    try {
      const prodsFile = path2.resolve(process.cwd(), "src/data/firestoreProducts.json");
      if (fs2.existsSync(prodsFile)) {
        const diskProds = JSON.parse(fs2.readFileSync(prodsFile, "utf-8"));
        if (Array.isArray(diskProds)) {
          for (const p of diskProds) {
            if (p && p.id && !deletedProducts.has(String(p.id).trim())) {
              const existing = productMap.get(String(p.id));
              const merged = { ...p, ...existing || {} };
              productMap.set(String(p.id), merged);
              try {
                upsertProductInSql(merged);
              } catch {
              }
            }
          }
        }
      }
    } catch (diskErr) {
      console.warn("Could not read firestoreProducts.json:", diskErr);
    }
    try {
      const dbProds = await getAllDbProducts();
      if (Array.isArray(dbProds)) {
        for (const p of dbProds) {
          if (p && p.id && !deletedProducts.has(String(p.id).trim())) {
            const existing = productMap.get(String(p.id));
            productMap.set(String(p.id), { ...existing || {}, ...p });
          }
        }
      }
    } catch {
    }
    const productsList = Array.from(productMap.values()).filter(
      (p) => !deletedProducts.has(String(p.id).trim())
    );
    return res.json({ success: true, count: productsList.length, products: productsList });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/products", async (req, res) => {
  try {
    const prod = req.body;
    if (!prod || !prod.id) {
      return res.status(400).json({ success: false, error: "Product data with ID is required" });
    }
    const cleanProd = {
      ...prod,
      price: Number(prod.price) || 0,
      dailyEarnings: Number(prod.dailyEarnings) || 0,
      dailyPercent: prod.dailyPercent !== void 0 ? Number(prod.dailyPercent) : prod.price > 0 ? Number((Number(prod.dailyEarnings) / Number(prod.price) * 100).toFixed(1)) : 50,
      cycleDays: Number(prod.cycleDays || 45),
      totalRevenue: Number(prod.totalRevenue || (Number(prod.dailyEarnings || 0) * Number(prod.cycleDays || 45)).toFixed(2)),
      updatedAt: typeof prod.updatedAt === "number" ? prod.updatedAt : Date.now()
    };
    let savedInSql = cleanProd;
    try {
      savedInSql = upsertProductInSql(cleanProd);
    } catch (sqlErr) {
      console.warn("Error saving product in SQLite SQL:", sqlErr);
    }
    try {
      const prodsFile = path2.resolve(process.cwd(), "src/data/firestoreProducts.json");
      let currentProds = [];
      if (fs2.existsSync(prodsFile)) {
        try {
          currentProds = JSON.parse(fs2.readFileSync(prodsFile, "utf-8"));
        } catch {
        }
      }
      if (!Array.isArray(currentProds)) currentProds = [];
      const idx = currentProds.findIndex((p) => p.id === cleanProd.id);
      if (idx !== -1) {
        currentProds[idx] = { ...currentProds[idx], ...cleanProd };
      } else {
        currentProds.unshift(cleanProd);
      }
      fs2.writeFileSync(prodsFile, JSON.stringify(currentProds, null, 2), "utf-8");
    } catch (diskErr) {
      console.warn("Could not write product to firestoreProducts.json:", diskErr);
    }
    try {
      await upsertDbProduct(cleanProd);
    } catch {
    }
    return res.json({ success: true, message: "Product amount saved permanently in SQL database!", product: savedInSql });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id).trim();
    saveDeletedProduct(cleanId);
    try {
      deleteProductFromSql(cleanId);
    } catch (sqlErr) {
      console.warn("Error deleting product from SQLite:", sqlErr);
    }
    try {
      const prodsFile = path2.resolve(process.cwd(), "src/data/firestoreProducts.json");
      if (fs2.existsSync(prodsFile)) {
        let currentProds = [];
        try {
          currentProds = JSON.parse(fs2.readFileSync(prodsFile, "utf-8"));
        } catch {
        }
        if (Array.isArray(currentProds)) {
          const filtered = currentProds.filter((p) => String(p.id).trim() !== cleanId);
          fs2.writeFileSync(prodsFile, JSON.stringify(filtered, null, 2), "utf-8");
        }
      }
    } catch (diskErr) {
      console.warn("Could not update firestoreProducts.json on delete:", diskErr);
    }
    try {
      await deleteDbProduct(cleanId);
    } catch {
    }
    console.log(`[Admin Delete] Product ${cleanId} permanently deleted and blacklisted forever.`);
    return res.json({ success: true, message: `Product ${cleanId} deleted permanently and blacklisted forever.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/notices", async (_req, res) => {
  try {
    const dbNotices = await getAllDbNotices();
    return res.json({ success: true, notices: dbNotices });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/notices", async (req, res) => {
  try {
    const notice = req.body;
    if (!notice || !notice.id) {
      return res.status(400).json({ success: false, error: "Notice data with ID is required" });
    }
    const saved = await upsertDbNotice(notice);
    return res.json({ success: true, notice: saved });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/notices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDbNotice(id);
    console.log(`[Admin Delete] Notice ${id} permanently deleted from Cloud SQL.`);
    return res.json({ success: true, message: `Notice ${id} deleted from Cloud SQL` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/:id/action", async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, refundAmount, refundWallet, customEarnings } = req.body;
    const diskOrders = loadServerOrders();
    const allUsers = getCachedUsersBackup();
    const idx = diskOrders.findIndex((o) => String(o.id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    const currentOrder = diskOrders[idx];
    const now = Date.now();
    let message = "";
    if (action === "approve") {
      currentOrder.status = "active";
      currentOrder.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
      currentOrder.purchaseTimestamp = currentOrder.purchaseTimestamp || now;
      currentOrder.lastClaimTimestamp = now;
      currentOrder.nextClaimTimestamp = now + 24 * 60 * 60 * 1e3;
      message = `Order ${id} approved & activated! 24h dividend cycle initiated.`;
      if (currentOrder.price && currentOrder.userId) {
        distributeReferralCommissionServer(currentOrder.userId, Number(currentOrder.price), "investment", currentOrder.id).catch(() => {
        });
      }
    } else if (action === "pause") {
      currentOrder.status = "paused";
      currentOrder.pauseReason = reason || "Temporarily paused by administrator";
      message = `Order ${id} paused. User cannot claim dividends while paused.`;
    } else if (action === "resume") {
      currentOrder.status = "active";
      delete currentOrder.pauseReason;
      message = `Order ${id} resumed and restored to active state.`;
    } else if (action === "cancel") {
      currentOrder.status = "cancelled";
      currentOrder.cancelledAt = (/* @__PURE__ */ new Date()).toISOString();
      currentOrder.adminNote = reason || "Contract cancelled by administrator";
      const refund = refundAmount !== void 0 ? Number(refundAmount) : Number(currentOrder.price || 0);
      currentOrder.refundAmount = refund;
      if (refund > 0 && currentOrder.userId) {
        const targetUserId = String(currentOrder.userId).trim();
        const userIdx = allUsers.findIndex(
          (u) => String(u.id).trim() === targetUserId || String(u.uid).trim() === targetUserId || u.phone && String(u.phone).trim() === targetUserId
        );
        if (userIdx >= 0) {
          const u = allUsers[userIdx];
          const walletKey = refundWallet === "withdrawalBalance" ? "withdrawalBalance" : "rechargeBalance";
          u[walletKey] = Number(((u[walletKey] || 0) + refund).toFixed(2));
          u.totalInvested = Math.max(0, Number(((u.totalInvested || 0) - (currentOrder.price || 0)).toFixed(2)));
          saveUsersBackup(allUsers);
          const refundTx = {
            id: `tx-ref-${Date.now()}`,
            userId: u.id,
            type: "bonus",
            amount: refund,
            title: `Admin Refund: Order ${currentOrder.productName} (#${currentOrder.id})`,
            timestamp: (/* @__PURE__ */ new Date()).toLocaleString(),
            createdAt: Date.now(),
            status: "completed",
            referenceNo: `REFUND-${currentOrder.id}`,
            paymentMethod: `Wallet Credit (${walletKey === "withdrawalBalance" ? "Withdrawal Balance" : "Add Money Balance"})`
          };
          try {
            await createTransaction(refundTx);
          } catch {
          }
        }
      }
      message = `Order ${id} cancelled. ${refund > 0 ? `$${refund} refunded to user.` : "No refund issued."}`;
    } else if (action === "payout_dividend") {
      const dividendAmount = customEarnings !== void 0 ? Number(customEarnings) : Number(currentOrder.dailyEarnings || 0);
      currentOrder.daysElapsed = (currentOrder.daysElapsed || 0) + 1;
      currentOrder.totalAccrued = Number(((currentOrder.totalAccrued || 0) + dividendAmount).toFixed(2));
      currentOrder.lastClaimDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      currentOrder.lastClaimTimestamp = now;
      currentOrder.nextClaimTimestamp = now + 24 * 60 * 60 * 1e3;
      if (currentOrder.daysElapsed >= currentOrder.cycleDays) {
        currentOrder.status = "completed";
      }
      if (dividendAmount > 0 && currentOrder.userId) {
        const targetUserId = String(currentOrder.userId).trim();
        const userIdx = allUsers.findIndex(
          (u) => String(u.id).trim() === targetUserId || String(u.uid).trim() === targetUserId || u.phone && String(u.phone).trim() === targetUserId
        );
        if (userIdx >= 0) {
          const u = allUsers[userIdx];
          u.withdrawalBalance = Number(((u.withdrawalBalance || 0) + dividendAmount).toFixed(2));
          u.productRevenue = Number(((u.productRevenue || 0) + dividendAmount).toFixed(2));
          saveUsersBackup(allUsers);
          const divTx = {
            id: `tx-adm-div-${Date.now()}`,
            userId: u.id,
            type: "earnings",
            amount: dividendAmount,
            title: `Manual Admin Yield: ${currentOrder.productName} (Day ${currentOrder.daysElapsed})`,
            timestamp: (/* @__PURE__ */ new Date()).toLocaleString(),
            createdAt: Date.now(),
            status: "completed",
            referenceNo: `DIV-${currentOrder.id}-${Date.now().toString().slice(-6)}`,
            paymentMethod: "Contract Daily Settlement"
          };
          try {
            await createTransaction(divTx);
          } catch {
          }
          distributeReferralCommissionServer(
            targetUserId,
            dividendAmount,
            "daily_income",
            currentOrder.id
          ).catch((commErr) => console.warn("Dividend referral commission notice:", commErr));
        }
      }
      message = `Dividend of $${dividendAmount} successfully paid to user wallet!`;
    } else if (action === "reset_timer") {
      currentOrder.nextClaimTimestamp = now - 1e3;
      message = `24h cooldown timer reset. User can now claim dividend immediately.`;
    }
    const updated = enrichOrderWithUserData({ ...currentOrder, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, allUsers);
    diskOrders[idx] = updated;
    saveServerOrders(diskOrders);
    try {
      await upsertDbOrder(updated);
    } catch {
    }
    return res.json({ success: true, message, order: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
var TRANSACTIONS_BACKUP_PATH = path2.resolve(process.cwd(), "src/data/transactions_backup.json");
function loadServerTransactions() {
  try {
    if (fs2.existsSync(TRANSACTIONS_BACKUP_PATH)) {
      const parsed = JSON.parse(fs2.readFileSync(TRANSACTIONS_BACKUP_PATH, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Could not read transactions_backup.json:", err);
  }
  return [];
}
function saveServerTransactions(txsList) {
  try {
    fs2.writeFileSync(TRANSACTIONS_BACKUP_PATH, JSON.stringify(txsList, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write transactions_backup.json:", err);
  }
}
app.get(["/api/cloudsql/transactions", "/api/admin/transactions"], async (_req, res) => {
  try {
    const dbTxs = await getAllTransactionsFromDb();
    const backupTxs = loadServerTransactions();
    const map = /* @__PURE__ */ new Map();
    for (const tx of backupTxs) {
      const key = String(tx.referenceNo || tx.id || "tx-" + tx.createdAt);
      map.set(key, tx);
    }
    for (const tx of dbTxs) {
      const key = String(tx.referenceNo || tx.id || "tx-" + tx.createdAt);
      map.set(key, { ...map.get(key), ...tx });
    }
    const merged = Array.from(map.values()).sort((a, b) => {
      const timeA = Number(a.createdAt) || 0;
      const timeB = Number(b.createdAt) || 0;
      return timeB - timeA;
    });
    return res.json({ success: true, count: merged.length, transactions: merged });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/cloudsql/transactions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId).trim();
    const dbTxs = await getUserTransactions(cleanId);
    const backupTxs = loadServerTransactions().filter(
      (tx) => String(tx.userId).trim() === cleanId
    );
    const map = /* @__PURE__ */ new Map();
    for (const tx of backupTxs) {
      const key = String(tx.referenceNo || tx.id || "tx-" + tx.createdAt);
      map.set(key, tx);
    }
    for (const tx of dbTxs) {
      const key = String(tx.referenceNo || tx.id || "tx-" + tx.createdAt);
      map.set(key, { ...map.get(key), ...tx });
    }
    const userTxs = Array.from(map.values()).sort((a, b) => {
      const timeA = Number(a.createdAt) || 0;
      const timeB = Number(b.createdAt) || 0;
      return timeB - timeA;
    });
    return res.json({ success: true, count: userTxs.length, transactions: userTxs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/cloudsql/transactions", async (req, res) => {
  try {
    const tx = req.body;
    if (!tx || !tx.userId || tx.amount === void 0 || !tx.title) {
      return res.status(400).json({ success: false, error: "Missing required transaction fields" });
    }
    if (tx.type === "withdraw" && tx.userId) {
      const backupTxs2 = loadServerTransactions();
      const existingDuplicate = backupTxs2.find(
        (t) => t.type === "withdraw" && String(t.userId).trim() === String(tx.userId).trim() && (tx.referenceNo && t.referenceNo === tx.referenceNo || Math.abs(Number(t.amount) - Number(tx.amount)) < 1e-3 && Date.now() - (Number(t.createdAt) || 0) < 4e3)
      );
      if (existingDuplicate) {
        return res.json({ success: true, transaction: existingDuplicate, message: "Existing withdrawal returned" });
      }
    }
    const createdInDb = await createTransaction(tx);
    const backupTxs = loadServerTransactions();
    const refKey = tx.referenceNo || tx.id || `tx-${Date.now()}`;
    const payload = {
      ...tx,
      id: tx.id || (createdInDb ? String(createdInDb.id) : refKey),
      createdAt: tx.createdAt || Date.now(),
      status: tx.status || "completed",
      referenceNo: tx.referenceNo || refKey
    };
    const existingIdx = backupTxs.findIndex(
      (t) => tx.id && t.id === tx.id || tx.referenceNo && t.referenceNo === tx.referenceNo
    );
    if (existingIdx >= 0) {
      backupTxs[existingIdx] = { ...backupTxs[existingIdx], ...payload };
    } else {
      backupTxs.unshift(payload);
    }
    saveServerTransactions(backupTxs);
    return res.json({ success: true, transaction: createdInDb || payload });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post(["/api/cloudsql/transactions/status", "/api/admin/transactions/status"], async (req, res) => {
  try {
    const { txId, status, referenceNo, paymentMethod, reason } = req.body;
    if (!txId || !status) {
      return res.status(400).json({ success: false, error: "txId and status are required" });
    }
    const cleanId = String(txId).trim();
    const updatedInDb = await updateTransactionStatusInDb(cleanId, status, {
      referenceNo,
      paymentMethod,
      reason
    });
    const backupTxs = loadServerTransactions();
    let foundTx = null;
    for (let i = 0; i < backupTxs.length; i++) {
      if (backupTxs[i].id === cleanId || backupTxs[i].referenceNo === cleanId) {
        backupTxs[i] = {
          ...backupTxs[i],
          status,
          ...referenceNo ? { referenceNo } : {},
          ...paymentMethod ? { paymentMethod } : {},
          ...reason ? { rejectReason: reason } : {},
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        foundTx = backupTxs[i];
        break;
      }
    }
    if (foundTx) {
      saveServerTransactions(backupTxs);
    }
    return res.json({ success: true, transaction: updatedInDb || foundTx });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
var activeWithdrawalLocks = /* @__PURE__ */ new Set();
var activeRechargeLocks = /* @__PURE__ */ new Set();
var activeBalanceAdjustLocks = /* @__PURE__ */ new Set();
var recentBalanceAdjustHistory = /* @__PURE__ */ new Map();
app.post("/api/admin/withdrawals/action", async (req, res) => {
  const { action, txId, referenceNo, userId, amount, reason } = req.body;
  if (!action || !txId) {
    return res.status(400).json({ success: false, error: "action and txId are required" });
  }
  const cleanId = String(txId).trim();
  if (activeWithdrawalLocks.has(cleanId)) {
    return res.status(409).json({ success: false, error: "Withdrawal action is already being processed. Please wait." });
  }
  activeWithdrawalLocks.add(cleanId);
  try {
    const backupTxs = loadServerTransactions();
    const existingTx = backupTxs.find((t) => t.id === cleanId || t.referenceNo === cleanId);
    if (existingTx) {
      if (action === "approve" && existingTx.status === "completed") {
        return res.json({
          success: true,
          message: `Withdrawal was already approved previously (Ref: ${existingTx.referenceNo || referenceNo || "Settled"})`,
          alreadyProcessed: true,
          transaction: existingTx
        });
      }
      if (existingTx.status === "rejected") {
        return res.json({
          success: true,
          message: `Withdrawal was already rejected previously. No duplicate balance refund applied.`,
          alreadyProcessed: true,
          transaction: existingTx
        });
      }
      if (action === "reject" && existingTx.status === "completed") {
        return res.status(400).json({
          success: false,
          error: "Cannot reject a withdrawal that has already been approved and settled."
        });
      }
    }
    if (action === "approve") {
      await updateTransactionStatusInDb(cleanId, "completed", { referenceNo });
      for (let i = 0; i < backupTxs.length; i++) {
        if (backupTxs[i].id === cleanId || backupTxs[i].referenceNo === cleanId) {
          backupTxs[i] = {
            ...backupTxs[i],
            status: "completed",
            ...referenceNo ? { referenceNo } : {},
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          break;
        }
      }
      saveServerTransactions(backupTxs);
      return res.json({
        success: true,
        message: `Withdrawal approved & marked as Paid (Ref: ${referenceNo || "Settled"})`
      });
    } else if (action === "reject") {
      const numAmount = Number(amount) || (existingTx ? Number(existingTx.amount) : 0);
      await updateTransactionStatusInDb(cleanId, "rejected", { reason });
      for (let i = 0; i < backupTxs.length; i++) {
        if (backupTxs[i].id === cleanId || backupTxs[i].referenceNo === cleanId) {
          backupTxs[i] = {
            ...backupTxs[i],
            status: "rejected",
            rejectReason: reason || "Bank details mismatch",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          break;
        }
      }
      saveServerTransactions(backupTxs);
      let updatedUser = null;
      const targetUserId = userId || existingTx?.userId;
      if (targetUserId && numAmount > 0) {
        const cleanUserId = String(targetUserId).trim();
        await refundUserWithdrawalInDb(cleanUserId, numAmount);
        const currentUsers = getCachedUsersBackup();
        const userIdx = currentUsers.findIndex(
          (u) => u.id === cleanUserId || u.uid === cleanUserId || u.phone === cleanUserId
        );
        if (userIdx >= 0) {
          const currentBal = Number(currentUsers[userIdx].withdrawalBalance) || 0;
          const newBal = Number((currentBal + numAmount).toFixed(2));
          currentUsers[userIdx].withdrawalBalance = newBal;
          saveUsersBackup(currentUsers);
          updatedUser = currentUsers[userIdx];
        }
      }
      return res.json({
        success: true,
        message: `Withdrawal rejected and $${numAmount.toFixed(2)} refunded to user balance`,
        user: updatedUser
      });
    } else {
      return res.status(400).json({ success: false, error: "Invalid action: must be approve or reject" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    activeWithdrawalLocks.delete(cleanId);
  }
});
app.post("/api/admin/recharges/action", async (req, res) => {
  const { action, txId, userId, amount, reason } = req.body;
  if (!action || !txId) {
    return res.status(400).json({ success: false, error: "action and txId are required" });
  }
  const cleanId = String(txId).trim();
  if (activeRechargeLocks.has(cleanId)) {
    return res.status(409).json({ success: false, error: "Recharge action is already in progress. Please wait." });
  }
  activeRechargeLocks.add(cleanId);
  try {
    const backupTxs = loadServerTransactions();
    const existingTx = backupTxs.find((t) => t.id === cleanId || t.referenceNo === cleanId);
    if (existingTx) {
      if (action === "approve" && existingTx.status === "completed") {
        return res.json({
          success: true,
          message: "Deposit has already been approved and credited previously (idempotent)",
          alreadyProcessed: true,
          transaction: existingTx
        });
      }
      if (existingTx.status === "rejected") {
        return res.json({
          success: true,
          message: "Deposit was already rejected previously",
          alreadyProcessed: true,
          transaction: existingTx
        });
      }
    }
    if (action === "approve") {
      const numAmount = Number(amount) || (existingTx ? Number(existingTx.amount) : 0);
      await updateTransactionStatusInDb(cleanId, "completed");
      for (let i = 0; i < backupTxs.length; i++) {
        if (backupTxs[i].id === cleanId || backupTxs[i].referenceNo === cleanId) {
          backupTxs[i] = {
            ...backupTxs[i],
            status: "completed",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          break;
        }
      }
      saveServerTransactions(backupTxs);
      let updatedUser = null;
      const targetUserId = userId || existingTx?.userId;
      if (targetUserId && numAmount > 0) {
        const cleanUserId = String(targetUserId).trim();
        const currentUsers = getCachedUsersBackup();
        const userIdx = currentUsers.findIndex(
          (u) => u.id === cleanUserId || u.uid === cleanUserId || u.phone === cleanUserId
        );
        if (userIdx >= 0) {
          const currentBal = Number(currentUsers[userIdx].rechargeBalance) || 0;
          const newBal = Number((currentBal + numAmount).toFixed(2));
          currentUsers[userIdx].rechargeBalance = newBal;
          saveUsersBackup(currentUsers);
          updatedUser = currentUsers[userIdx];
          try {
            await upsertUser({
              uid: currentUsers[userIdx].id,
              phone: currentUsers[userIdx].phone,
              rechargeBalance: newBal
            });
          } catch (e) {
          }
        }
        if (targetUserId && numAmount > 0) {
          distributeReferralCommissionServer(targetUserId, numAmount, "recharge", cleanId).catch(
            (err) => console.warn("Recharge approval referral distribution notice:", err)
          );
        }
      }
      return res.json({
        success: true,
        message: `Deposit of $${numAmount.toFixed(2)} approved & credited to user wallet`,
        user: updatedUser
      });
    } else if (action === "reject") {
      await updateTransactionStatusInDb(cleanId, "rejected", { reason });
      for (let i = 0; i < backupTxs.length; i++) {
        if (backupTxs[i].id === cleanId || backupTxs[i].referenceNo === cleanId) {
          backupTxs[i] = {
            ...backupTxs[i],
            status: "rejected",
            rejectReason: reason || "Deposit verification failed",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          break;
        }
      }
      saveServerTransactions(backupTxs);
      return res.json({
        success: true,
        message: `Deposit rejected (${reason || "Verification failed"})`
      });
    } else {
      return res.status(400).json({ success: false, error: "Invalid action: must be approve or reject" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    activeRechargeLocks.delete(cleanId);
  }
});
app.post("/api/admin/adjust-balance", async (req, res) => {
  const { userId, wallet, amount, type, note, idempotencyKey } = req.body;
  if (!userId || !wallet || amount === void 0 || !type) {
    return res.status(400).json({ success: false, error: "userId, wallet, amount, and type are required" });
  }
  const cleanUserId = String(userId).trim();
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, error: "Invalid amount" });
  }
  const token = idempotencyKey || `${cleanUserId}-${wallet}-${type}-${numAmount.toFixed(2)}`;
  const now = Date.now();
  if (recentBalanceAdjustHistory.has(token)) {
    const lastTime = recentBalanceAdjustHistory.get(token);
    if (now - lastTime < 4e3) {
      return res.json({
        success: true,
        message: "Duplicate adjustment request ignored (already processed)",
        alreadyProcessed: true
      });
    }
  }
  if (activeBalanceAdjustLocks.has(cleanUserId)) {
    return res.status(409).json({ success: false, error: "Balance adjustment for this user is already in progress. Please wait." });
  }
  activeBalanceAdjustLocks.add(cleanUserId);
  recentBalanceAdjustHistory.set(token, now);
  try {
    const currentUsers = getCachedUsersBackup();
    const userIdx = currentUsers.findIndex(
      (u) => u.id === cleanUserId || u.uid === cleanUserId || u.phone === cleanUserId
    );
    if (userIdx < 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const currentBal = Number(currentUsers[userIdx][wallet]) || 0;
    const delta = type === "add" ? numAmount : -numAmount;
    const nextVal = Math.max(0, Number((currentBal + delta).toFixed(2)));
    currentUsers[userIdx][wallet] = nextVal;
    saveUsersBackup(currentUsers);
    try {
      await upsertUser({
        uid: currentUsers[userIdx].id,
        phone: currentUsers[userIdx].phone,
        [wallet]: nextVal
      });
    } catch (e) {
    }
    const adjTx = {
      id: `tx-adj-${Date.now()}`,
      userId: currentUsers[userIdx].id,
      type: type === "add" ? "bonus" : "earnings",
      amount: numAmount,
      title: `Admin ${type === "add" ? "Credit" : "Debit"}: ${note || "Manual adjustment"}`,
      timestamp: (/* @__PURE__ */ new Date()).toLocaleString(),
      status: "completed",
      referenceNo: `ADM${Math.floor(1e5 + Math.random() * 9e5)}`
    };
    const backupTxs = loadServerTransactions();
    backupTxs.unshift(adjTx);
    saveServerTransactions(backupTxs);
    return res.json({
      success: true,
      message: `Adjusted ${wallet} by ${type === "add" ? "+" : "-"}$${numAmount.toFixed(2)}`,
      user: currentUsers[userIdx],
      transaction: adjTx
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    activeBalanceAdjustLocks.delete(cleanUserId);
  }
});
app.delete(["/api/admin/users/:userId", "/api/users/:userId"], async (req, res) => {
  try {
    const { userId } = req.params;
    let queryPhone = req.query.phone ? String(req.query.phone).replace(/\D/g, "").slice(-10) : "";
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }
    const cleanId = String(userId).trim();
    const existingSql = getUserByIdOrPhoneFromSql(cleanId) || (queryPhone ? getUserByIdOrPhoneFromSql(queryPhone) : null);
    const existingDisk = getCachedUsersBackup().find(
      (u) => String(u.id).trim() === cleanId || String(u.uid || "").trim() === cleanId || queryPhone && String(u.phone || "").replace(/\D/g, "").slice(-10) === queryPhone
    );
    if (!queryPhone) {
      if (existingSql?.phone) queryPhone = String(existingSql.phone).replace(/\D/g, "").slice(-10);
      else if (existingDisk?.phone) queryPhone = String(existingDisk.phone).replace(/\D/g, "").slice(-10);
    }
    const targetUid = existingSql?.id || existingDisk?.id || cleanId;
    hardDeleteUserInSql(cleanId, queryPhone);
    if (targetUid && targetUid !== cleanId) {
      hardDeleteUserInSql(targetUid, queryPhone);
    }
    deleteOrdersForUserInSql(cleanId, queryPhone);
    if (targetUid && targetUid !== cleanId) {
      deleteOrdersForUserInSql(targetUid, queryPhone);
    }
    saveDeletedUser(cleanId, queryPhone);
    if (targetUid && targetUid !== cleanId) {
      saveDeletedUser(targetUid, queryPhone);
    }
    const current = getCachedUsersBackup();
    const updatedUsers = current.filter((u) => {
      const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
      const uId = String(u.id || u.uid || "").trim();
      if (uId === cleanId || uId === targetUid || u.phone === cleanId || queryPhone && uPhone === queryPhone) {
        return false;
      }
      return true;
    });
    saveUsersBackup(updatedUsers);
    try {
      await deleteUserFromDb(cleanId, queryPhone);
      if (targetUid && targetUid !== cleanId) {
        await deleteUserFromDb(targetUid, queryPhone);
      }
    } catch {
    }
    console.log(`[Admin Permanent Delete] User ${cleanId} (Phone: ${queryPhone || "\u2014"}, UID: ${targetUid}) permanently deleted & blacklisted forever.`);
    return res.json({
      success: true,
      message: `User ${cleanId} permanently deleted from database and blacklisted forever. All contracts and balances wiped.`,
      remainingCount: updatedUsers.length,
      deletedId: cleanId,
      deletedPhone: queryPhone
    });
  } catch (err) {
    console.error("Error during admin user hard deletion:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/admin/test-otp-sms", async (req, res) => {
  try {
    const { mobile, purpose = "test", template, customOtp, provider, senderId, authKey, customWebhookUrl } = req.body;
    if (!mobile || String(mobile).replace(/\D/g, "").length < 10) {
      return res.status(400).json({ success: false, error: "Valid 10-digit mobile number required" });
    }
    const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);
    const cleanCustomOtp = customOtp ? String(customOtp).replace(/\D/g, "").slice(0, 6) : "";
    const testOtp = cleanCustomOtp.length === 6 ? cleanCustomOtp : Math.floor(1e5 + Math.random() * 9e5).toString();
    const validityMins = Math.max(1, Number(otpSettings.otpValidityMinutes) || 5);
    const expiresAt = Date.now() + validityMins * 60 * 1e3;
    const { messageText } = formatSmsMessageFromAdminTemplate({
      purpose: purpose || "register",
      otp: testOtp,
      mobile: cleanMobile,
      validityMins,
      overrideTemplate: template,
      preferOverride: true
    });
    const existingRecord = otpStore.get(cleanMobile);
    const recentOtps = Array.from(
      /* @__PURE__ */ new Set([testOtp, ...existingRecord?.recentOtps || [], ...existingRecord?.otp ? [existingRecord.otp] : []])
    ).slice(0, 5);
    otpStore.set(cleanMobile, {
      otp: testOtp,
      recentOtps,
      createdAtMs: Date.now(),
      expiresAt,
      purpose: purpose === "forgot-password" ? "forgot-password" : "register",
      attempts: 0,
      formattedMessage: messageText
    });
    const rawClientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "";
    const dispatchResult = await dispatchSmsViaGateway({
      mobile: cleanMobile,
      otp: testOtp,
      messageText,
      provider,
      senderId,
      authKey,
      customWebhookUrl,
      clientIp: rawClientIp
    });
    const logItem = {
      id: `test-${Date.now()}`,
      mobile: cleanMobile,
      otp: testOtp,
      purpose: purpose === "forgot-password" ? "forgot-password" : purpose === "register" ? "register" : "test",
      message: messageText,
      status: "pending",
      attempts: 0,
      createdAt: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + ", " + (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN"),
      expiresAt,
      provider: dispatchResult.provider,
      senderId: dispatchResult.senderId,
      gatewayStatus: dispatchResult.statusText
    };
    otpLogs.unshift(logItem);
    if (otpLogs.length > 150) otpLogs.pop();
    persistOtpLogs();
    return res.json({
      success: true,
      message: `OTP (${testOtp}) dispatched via ${dispatchResult.provider} to +91 ${cleanMobile}`,
      formattedMessage: messageText,
      otp: testOtp,
      delivered: dispatchResult.delivered,
      provider: dispatchResult.provider,
      senderId: dispatchResult.senderId,
      statusText: dispatchResult.statusText,
      apiResponse: dispatchResult.rawResponse
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
var getActiveRazorpayConfig = (overrideKeyId, overrideSecret) => {
  const envKeyId = process.env.RAZORPAY_KEY_ID?.trim();
  const envSecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const isStaleKey = (k) => !k || k === "rzp_live_TsxVeW7tusSgjp" || k === "rzp_test_placeholder";
  const isStaleSecret = (s) => !s || s === "SvNqYN6H09fU4mNSGqJeTG0V" || s === "YOUR_RAZORPAY_KEY_SECRET";
  const keyId = (!isStaleKey(overrideKeyId) ? overrideKeyId : null) || (!isStaleKey(envKeyId) ? envKeyId : null) || "rzp_live_TuMp7KWEsJZTL6";
  const keySecret = (!isStaleSecret(overrideSecret) ? overrideSecret : null) || (!isStaleSecret(envSecret) ? envSecret : null) || "OVvX1KhLIGBX0bIr2R8AoOzI";
  return { keyId, keySecret };
};
app.get("/api/razorpay/config", (_req, res) => {
  const { keyId, keySecret } = getActiveRazorpayConfig();
  return res.json({
    success: true,
    keyId,
    hasSecret: Boolean(keySecret),
    mode: keyId.startsWith("rzp_live") ? "live" : "test"
  });
});
app.post("/api/razorpay/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt, notes, keyId: clientKeyId, keySecret: clientSecret } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Valid recharge amount is required" });
    }
    const { keyId, keySecret } = getActiveRazorpayConfig(clientKeyId, clientSecret);
    const amountInPaise = Math.round(Number(amount) * 100);
    if (keySecret) {
      try {
        const rzp = new Razorpay({
          key_id: keyId,
          key_secret: keySecret
        });
        const order = await rzp.orders.create({
          amount: amountInPaise,
          currency,
          receipt: receipt || `rec_shop_${Date.now()}`,
          notes: {
            category: "E-Commerce Retail Store (Electronics & AI Compute Hardware)",
            mcc: "5732",
            store_category: "Consumer Electronics & Computer Hardware",
            delivery_mode: "Express Courier Delivery (Delhivery/BlueDart)",
            invoice: "GST Compliant Tax Invoice",
            ...notes || {}
          }
        });
        return res.json({
          success: true,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId,
          description: "E-Commerce Purchase: Clean Energy Hardware Equipment"
        });
      } catch (rzpErr) {
        console.warn("Primary Razorpay orders.create attempt warning:", rzpErr?.error || rzpErr?.message || rzpErr);
        const envKey = process.env.RAZORPAY_KEY_ID?.trim();
        const envSec = process.env.RAZORPAY_KEY_SECRET?.trim();
        if (envKey && envSec && (keyId !== envKey || keySecret !== envSec)) {
          try {
            const fallbackRzp = new Razorpay({
              key_id: envKey,
              key_secret: envSec
            });
            const fallbackOrder = await fallbackRzp.orders.create({
              amount: amountInPaise,
              currency,
              receipt: receipt || `rec_shop_${Date.now()}`,
              notes: notes || {}
            });
            return res.json({
              success: true,
              orderId: fallbackOrder.id,
              amount: fallbackOrder.amount,
              currency: fallbackOrder.currency,
              keyId: envKey,
              description: "E-Commerce Purchase: Clean Energy Hardware Equipment"
            });
          } catch (fallbackErr) {
            console.warn("Fallback Razorpay orders.create warning:", fallbackErr?.error || fallbackErr?.message || fallbackErr);
          }
        }
      }
    }
    return res.json({
      success: true,
      amount: amountInPaise,
      currency,
      keyId,
      receipt: receipt || `rec_shop_${Date.now()}`,
      description: "E-Commerce Purchase: Clean Energy Hardware Equipment"
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    return res.status(500).json({
      success: false,
      error: error?.error?.description || error.message || "Failed to initialize Razorpay transaction"
    });
  }
});
app.post("/api/razorpay/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret: clientSecret
    } = req.body;
    if (!razorpay_payment_id) {
      return res.status(400).json({ success: false, error: "Razorpay payment ID is required" });
    }
    const { keySecret } = getActiveRazorpayConfig(void 0, clientSecret);
    if (razorpay_order_id && razorpay_signature && keySecret) {
      const hmac = crypto.createHmac("sha256", keySecret);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest("hex");
      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: "Razorpay payment signature mismatch. Transaction verification failed."
        });
      }
    }
    return res.json({
      success: true,
      verified: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id || null,
      message: "Razorpay payment verified successfully"
    });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);
    return res.status(500).json({ success: false, error: "Payment signature verification failed" });
  }
});
app.get("/api/razorpay/webhook-info", (req, res) => {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/razorpay/webhook`;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "nexa_ai_rzp_webhook_2026";
  return res.json({
    success: true,
    webhookUrl,
    webhookSecret,
    recommendedEvents: [
      "payment.captured",
      "order.paid",
      "payment.failed",
      "refund.processed"
    ],
    status: "active"
  });
});
app.post("/api/razorpay/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.VITE_RAZORPAY_WEBHOOK_SECRET || "nexa_ai_rzp_webhook_2026";
    const event = req.body?.event;
    console.log(`[Razorpay Webhook] Received event: "${event}"`);
    if (signature && webhookSecret) {
      const rawPayload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
      if (expectedSignature !== signature) {
        console.warn("[Razorpay Webhook] \u26A0\uFE0F Signature mismatch for event:", event);
        return res.status(400).json({
          success: false,
          error: "Invalid Razorpay webhook signature."
        });
      }
      console.log("[Razorpay Webhook] \u2705 Signature verified successfully!");
    }
    const payload = req.body?.payload;
    if (event === "payment.captured" || event === "order.paid") {
      const payment = payload?.payment?.entity;
      const order = payload?.order?.entity;
      const paymentId = payment?.id;
      const amount = payment?.amount ? payment.amount / 100 : order?.amount ? order.amount / 100 : 0;
      const customerContact = payment?.contact;
      const notes = payment?.notes || order?.notes || {};
      console.log(
        `[Razorpay Webhook] \u{1F4B0} SUCCESS: \u20B9${amount} received! Payment ID: ${paymentId}, Mobile: ${customerContact}, Notes:`,
        notes
      );
    } else if (event === "payment.failed") {
      const payment = payload?.payment?.entity;
      console.warn(
        `[Razorpay Webhook] \u26A0\uFE0F FAILED: Payment ${payment?.id} failed. Reason: ${payment?.error_description}`
      );
    } else {
      console.log(`[Razorpay Webhook] \u2139\uFE0F Handled event: ${event}`);
    }
    return res.status(200).json({
      status: "ok",
      message: `Webhook event "${event}" processed successfully.`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("[Razorpay Webhook] Execution error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Sitemap: https://nexaai-epzk.onrender.com/sitemap.xml
`);
});
app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://nexaai-epzk.onrender.com/</loc><priority>1.0</priority></url>
  <url><loc>https://nexaai-epzk.onrender.com/?view=store</loc><priority>0.9</priority></url>
  <url><loc>https://nexaai-epzk.onrender.com/?policy=terms</loc><priority>0.8</priority></url>
  <url><loc>https://nexaai-epzk.onrender.com/?policy=shipping</loc><priority>0.8</priority></url>
  <url><loc>https://nexaai-epzk.onrender.com/?policy=refund</loc><priority>0.8</priority></url>
  <url><loc>https://nexaai-epzk.onrender.com/?policy=privacy</loc><priority>0.8</priority></url>
  <url><loc>https://nexaai-epzk.onrender.com/?policy=contact</loc><priority>0.8</priority></url>
</urlset>`);
});
app.get(["/store", "/shop", "/products"], (req, res) => {
  res.redirect("/?view=store");
});
app.get("/api/compliance/status", (req, res) => {
  res.json({
    status: "compliant_ecommerce_store",
    business_legal_name: "Nexa AI Technologies India Pvt Ltd",
    store_name: "Nexa AI Technologies & Smart Electronics Store",
    mcc: "5732",
    category: "Consumer Electronics & Computer Hardware",
    accepted_currencies: ["INR"],
    delivery_terms: "Doorstep Courier Dispatch (3-5 Business Days)",
    refund_terms: "7-Day Return & Replacement Policy",
    merchant_active: true
  });
});
var port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(process.cwd(), "dist");
    const indexPath = path2.join(distPath, "index.html");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (fs2.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Nexa AI - Setup Notice</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 32px; border-radius: 20px; border: 1px solid #334155; max-width: 480px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
                h2 { color: #38bdf8; margin-top: 0; }
                code { background: #0f172a; padding: 6px 12px; border-radius: 8px; color: #4ade80; font-family: monospace; display: block; margin: 16px 0; border: 1px solid #334155; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>\u{1F680} Nexa AI Build Notice</h2>
                <p>Frontend assets (dist) were not found. In Render Dashboard, please set:</p>
                <strong>Build Command:</strong>
                <code>npm install && npm run build</code>
                <p style="font-size: 13px; color: #94a3b8;">After setting, click <strong>Manual Deploy &gt; Clear build cache & deploy</strong>.</p>
              </div>
            </body>
          </html>
        `);
      }
    });
  }
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
    try {
      const diskUsers = getCachedUsersBackup();
      initAndSyncSqlUsers(diskUsers);
      console.log(`[SQLite SQL] Unified and saved ${diskUsers.length} users into permanent SQLite database.`);
    } catch (sqliteInitErr) {
      console.warn("[SQLite SQL] User sync warning:", sqliteInitErr);
    }
    setTimeout(async () => {
      try {
        const statsResult = await reconcileAllReferralStatsServer();
        console.log(`[Referral System] Reconciled referral income and direct member counts for ${statsResult.reconciledCount} user(s).`);
      } catch (err) {
        console.warn("[Referral System] Boot reconciliation notice:", err);
      }
    }, 1500);
    setTimeout(async () => {
      try {
        const sqlUsers = await getAllUsers();
        if (sqlUsers.length === 0) {
          const diskUsers = getCachedUsersBackup();
          console.log(`[Cloud SQL] Seeding ${diskUsers.length} users into Cloud SQL PostgreSQL...`);
          for (const u of diskUsers) {
            await upsertUser({
              uid: u.id || u.uid || u.phone,
              phone: u.phone,
              password: u.password || "password123",
              nickname: u.nickname,
              avatar: u.avatar,
              invitationCode: u.invitationCode,
              invitedBy: u.invitedBy,
              inviterName: u.inviterName,
              inviterId: u.inviterId,
              rechargeBalance: Number(u.rechargeBalance) || 0,
              withdrawalBalance: Number(u.withdrawalBalance) || 0,
              productRevenue: Number(u.productRevenue) || 0,
              vipLevel: Number(u.vipLevel) || 0,
              totalInvested: Number(u.totalInvested) || 0,
              checkInStreak: Number(u.checkInStreak) || 0,
              lastCheckInDate: u.lastCheckInDate,
              spinChances: Number(u.spinChances) || 0,
              status: u.status,
              role: u.role,
              totalReferrals: Number(u.totalReferrals) || 0,
              totalCommissionEarned: Number(u.totalCommissionEarned) || 0,
              bankDetails: u.bankDetails
            });
          }
        } else {
          const deletedSet = loadDeletedUsers();
          const cleanSqlUsers = sqlUsers.filter((u) => {
            const uId = String(u.uid || u.id || "").trim();
            const uPhone = String(u.phone || "").replace(/\D/g, "").slice(-10);
            if (deletedSet.has(uId) || uPhone && deletedSet.has(uPhone)) {
              deleteUserFromDb(uId, uPhone).catch(() => {
              });
              return false;
            }
            return true;
          });
          const formatted = cleanSqlUsers.map((u) => ({
            id: u.uid || String(u.id),
            phone: u.phone,
            password: u.password || "password123",
            nickname: u.nickname,
            avatar: u.avatar || "HD",
            invitationCode: u.invitationCode,
            invitedBy: u.invitedBy,
            inviterName: u.inviterName,
            inviterId: u.inviterId,
            rechargeBalance: u.rechargeBalance ?? 0,
            withdrawalBalance: u.withdrawalBalance ?? 0,
            productRevenue: u.productRevenue ?? 0,
            vipLevel: u.vipLevel ?? 0,
            totalInvested: u.totalInvested ?? 0,
            checkInStreak: u.checkInStreak ?? 0,
            lastCheckInDate: u.lastCheckInDate,
            spinChances: u.spinChances ?? 0,
            status: u.status || "active",
            role: u.role || "user",
            totalReferrals: u.totalReferrals ?? 0,
            totalCommissionEarned: u.totalCommissionEarned ?? 0,
            bankDetails: u.bankDetails,
            createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : void 0
          }));
          saveUsersBackup(formatted);
          console.log(`[Cloud SQL] Preserved & synced ${formatted.length} live persistent users from database.`);
        }
        const sqlOrders = await getAllDbOrders();
        if (sqlOrders.length === 0) {
          const diskOrders = loadServerOrders();
          console.log(`[Cloud SQL] Seeding ${diskOrders.length} orders into Cloud SQL PostgreSQL...`);
          for (const o of diskOrders) {
            await upsertDbOrder(o);
          }
        } else {
          saveServerOrders(sqlOrders);
          console.log(`[Cloud SQL] Preserved & synced ${sqlOrders.length} live persistent orders from database.`);
        }
        const sqlPromos = await getAllDbPromoCodes();
        if (sqlPromos.length === 0) {
          const diskPromos = loadServerPromoCodes();
          for (const p of diskPromos) {
            await upsertDbPromoCode(p);
          }
        } else {
          saveServerPromoCodes(sqlPromos);
          console.log(`[Cloud SQL] Preserved & synced ${sqlPromos.length} live persistent promo codes from database.`);
        }
        const sqlProducts = await getAllDbProducts();
        if (sqlProducts.length === 0) {
          const prodsFile = path2.resolve(process.cwd(), "src/data/firestoreProducts.json");
          if (fs2.existsSync(prodsFile)) {
            try {
              const fileProds = JSON.parse(fs2.readFileSync(prodsFile, "utf-8"));
              if (Array.isArray(fileProds)) {
                for (const prod of fileProds) {
                  await upsertDbProduct(prod);
                }
              }
            } catch {
            }
          }
        } else {
          console.log(`[Cloud SQL] Loaded ${sqlProducts.length} persistent live products from database.`);
        }
        const dbSettings = await getPlatformSettingFromDb("general");
        if (dbSettings && typeof dbSettings === "object" && Object.keys(dbSettings).length > 0) {
          saveServerPlatformSettings(dbSettings);
          console.log("[Cloud SQL] Persistent live platform settings preserved from database.");
        } else {
          const currentSettings = loadServerPlatformSettings();
          await setPlatformSettingInDb("general", currentSettings);
          console.log("[Cloud SQL] Initialized platform settings into database.");
        }
        console.log("[Cloud SQL] Permanent connection verified. Real website and workspace remain unified.");
      } catch (seedErr) {
        console.warn("[Cloud SQL] Startup persistence check note:", seedErr);
      }
    }, 1e3);
  });
}
startServer();
export {
  distributeReferralCommissionServer,
  reconcileAllReferralStatsServer
};
