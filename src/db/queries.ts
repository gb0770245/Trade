import { db, isSqlConfigured } from './index.ts';
import {
  users,
  transactions,
  investmentOrders,
  ecommerceOrders,
  platformSettings,
  products,
  promoCodes,
  notices,
} from './schema.ts';
import { eq, or, desc } from 'drizzle-orm';

// Fetch all users from Cloud SQL
export async function getAllUsers() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch {
    return [];
  }
}

// Find user by UID or Phone
export async function findUser(identifier: string) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(identifier).trim();
    const result = await db
      .select()
      .from(users)
      .where(or(eq(users.uid, cleanId), eq(users.phone, cleanId)))
      .limit(1);
    return result[0] || null;
  } catch {
    return null;
  }
}

// Upsert user into Cloud SQL
export async function upsertUser(data: {
  uid: string;
  phone?: string;
  password?: string;
  nickname?: string;
  avatar?: string;
  invitationCode?: string;
  invitedBy?: string;
  inviterName?: string;
  inviterId?: string;
  rechargeBalance?: number;
  withdrawalBalance?: number;
  productRevenue?: number;
  vipLevel?: number;
  totalInvested?: number;
  checkInStreak?: number;
  lastCheckInDate?: string | null;
  spinChances?: number;
  status?: string;
  role?: string;
  totalReferrals?: number;
  totalCommissionEarned?: number;
  bankDetails?: any;
}) {
  if (!isSqlConfigured) return null;
  try {
    const existing = await findUser(data.uid || data.phone || '');
    if (existing) {
      const updateData: any = {};
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.password !== undefined) updateData.password = data.password;
      if (data.nickname !== undefined) updateData.nickname = data.nickname;
      if (data.avatar !== undefined) updateData.avatar = data.avatar;
      if (data.invitationCode !== undefined) updateData.invitationCode = data.invitationCode;
      if (data.invitedBy !== undefined) updateData.invitedBy = data.invitedBy;
      if (data.inviterName !== undefined) updateData.inviterName = data.inviterName;
      if (data.inviterId !== undefined) updateData.inviterId = data.inviterId;
      if (data.rechargeBalance !== undefined) updateData.rechargeBalance = data.rechargeBalance;
      if (data.withdrawalBalance !== undefined) updateData.withdrawalBalance = data.withdrawalBalance;
      if (data.productRevenue !== undefined) updateData.productRevenue = data.productRevenue;
      if (data.vipLevel !== undefined) updateData.vipLevel = data.vipLevel;
      if (data.totalInvested !== undefined) updateData.totalInvested = data.totalInvested;
      if (data.checkInStreak !== undefined) updateData.checkInStreak = data.checkInStreak;
      if (data.lastCheckInDate !== undefined) updateData.lastCheckInDate = data.lastCheckInDate;
      if (data.spinChances !== undefined) updateData.spinChances = data.spinChances;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.totalReferrals !== undefined) updateData.totalReferrals = data.totalReferrals;
      if (data.totalCommissionEarned !== undefined) updateData.totalCommissionEarned = data.totalCommissionEarned;
      if (data.bankDetails !== undefined) updateData.bankDetails = data.bankDetails;

      const updated = await db
        .update(users)
        .set(updateData)
        .where(eq(users.uid, existing.uid))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(users)
        .values({
          uid: data.uid || data.phone || `u_${Date.now()}`,
          phone: data.phone || '',
          password: data.password || 'password123',
          nickname: data.nickname || 'User',
          avatar: data.avatar || 'HD',
          invitationCode: data.invitationCode || '',
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
          status: data.status || 'active',
          role: data.role || 'user',
          totalReferrals: data.totalReferrals || 0,
          totalCommissionEarned: data.totalCommissionEarned || 0,
          bankDetails: data.bankDetails || null,
        })
        .returning();
      return inserted[0];
    }
  } catch {
    return null;
  }
}

// Relink upline
export async function relinkUpline(userId: string, uplineCode: string) {
  if (!isSqlConfigured) return null;
  try {
    const all = await getAllUsers();
    const target = all.find((u) => u.uid === userId || u.phone === userId);
    const upliner = all.find((u) => u.invitationCode === uplineCode || u.uid === uplineCode || u.phone === uplineCode);

    if (!target || !upliner) return null;

    const updated = await db
      .update(users)
      .set({
        invitedBy: upliner.invitationCode,
        inviterName: upliner.nickname,
        inviterId: upliner.uid,
      })
      .where(eq(users.uid, target.uid))
      .returning();

    return updated[0];
  } catch {
    return null;
  }
}

// Fetch all transactions (for Admin)
export async function getAllTransactionsFromDb() {
  if (!isSqlConfigured) return [];
  try {
    return await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt));
  } catch (err) {
    console.warn('Error fetching all transactions from DB:', err);
    return [];
  }
}

// Fetch transactions for a user
export async function getUserTransactions(userId: string) {
  if (!isSqlConfigured) return [];
  try {
    const cleanId = String(userId).trim();
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, cleanId))
      .orderBy(desc(transactions.createdAt));
  } catch {
    return [];
  }
}

// Insert transaction
export async function createTransaction(tx: {
  userId: string;
  type: string;
  amount: number;
  title: string;
  timestamp: string;
  createdAt?: number;
  status?: string;
  referenceNo?: string;
  paymentMethod?: string;
  feeAmount?: number;
  netAmount?: number;
  bankDetails?: any;
}) {
  if (!isSqlConfigured) return null;
  try {
    const refNo = tx.referenceNo || `TX${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    if (tx.referenceNo) {
      const existing = await db
        .select()
        .from(transactions)
        .where(eq(transactions.referenceNo, tx.referenceNo))
        .limit(1);
      if (existing && existing.length > 0) {
        return existing[0];
      }
    }

    const result = await db
      .insert(transactions)
      .values({
        userId: String(tx.userId).trim(),
        type: tx.type,
        amount: Number(tx.amount) || 0,
        title: tx.title,
        timestamp: tx.timestamp || new Date().toLocaleString(),
        createdAt: tx.createdAt || Date.now(),
        status: tx.status || 'completed',
        referenceNo: refNo,
        paymentMethod: tx.paymentMethod || null,
        feeAmount: Number(tx.feeAmount) || 0,
        netAmount: Number(tx.netAmount) || Number(tx.amount) || 0,
        bankDetails: tx.bankDetails || null,
      })
      .returning();
    return result[0];
  } catch (err) {
    console.warn('Error creating transaction in DB:', err);
    return null;
  }
}

// Update transaction status in DB (by referenceNo or id)
export async function updateTransactionStatusInDb(
  identifier: string,
  status: string,
  extra?: { referenceNo?: string; paymentMethod?: string; reason?: string }
) {
  if (!isSqlConfigured) return null;
  try {
    const clean = String(identifier).trim();
    const numId = !isNaN(Number(clean)) ? Number(clean) : null;

    const updatePayload: any = { status };
    if (extra?.referenceNo) updatePayload.referenceNo = extra.referenceNo;
    if (extra?.paymentMethod) updatePayload.paymentMethod = extra.paymentMethod;

    const result = await db
      .update(transactions)
      .set(updatePayload)
      .where(
        numId
          ? or(eq(transactions.referenceNo, clean), eq(transactions.id, numId))
          : eq(transactions.referenceNo, clean)
      )
      .returning();

    return result && result.length > 0 ? result[0] : null;
  } catch (err) {
    console.warn('Error updating transaction status in DB:', err);
    return null;
  }
}

// Refund withdrawal to user's withdrawalBalance in Cloud SQL
export async function refundUserWithdrawalInDb(userId: string, amount: number) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(userId).trim();
    const allUsers = await getAllUsers();
    const target = allUsers.find((u) => u.uid === cleanId || u.phone === cleanId);
    if (!target) return null;

    const currentBal = Number(target.withdrawalBalance) || 0;
    const newBal = Number((currentBal + amount).toFixed(2));

    const updated = await db
      .update(users)
      .set({ withdrawalBalance: newBal })
      .where(eq(users.uid, target.uid))
      .returning();

    return updated && updated.length > 0 ? updated[0] : null;
  } catch (err) {
    console.warn('Error refunding user in DB:', err);
    return null;
  }
}

// Delete user permanently from Cloud SQL (cascading transactions, orders, and user record)
export async function deleteUserFromDb(userId: string, explicitPhone?: string) {
  if (!isSqlConfigured) return [];
  try {
    const cleanId = String(userId).trim();
    const cleanPhone = explicitPhone ? String(explicitPhone).replace(/\D/g, '').slice(-10) : '';

    // Find any existing record to ensure we have all associated identifiers
    const userMatch = await findUser(cleanId);
    const targetPhone = cleanPhone || (userMatch?.phone ? String(userMatch.phone).replace(/\D/g, '').slice(-10) : '');
    const targetUid = userMatch?.uid || cleanId;

    // 1. Delete user transactions from Cloud SQL
    await db.delete(transactions).where(or(
      eq(transactions.userId, cleanId),
      eq(transactions.userId, targetUid),
      ...(targetPhone ? [eq(transactions.userId, targetPhone)] : [])
    ));

    // 2. Delete investment orders from Cloud SQL
    await db.delete(investmentOrders).where(or(
      eq(investmentOrders.userId, cleanId),
      eq(investmentOrders.userId, targetUid),
      ...(targetPhone ? [eq(investmentOrders.userId, targetPhone)] : [])
    ));

    // 3. Delete ecommerce orders from Cloud SQL
    await db.delete(ecommerceOrders).where(or(
      eq(ecommerceOrders.userId, cleanId),
      eq(ecommerceOrders.userId, targetUid),
      ...(targetPhone ? [eq(ecommerceOrders.userId, targetPhone)] : [])
    ));

    // 4. Delete user record permanently from Cloud SQL
    const result = await db
      .delete(users)
      .where(or(
        eq(users.uid, cleanId),
        eq(users.uid, targetUid),
        eq(users.phone, cleanId),
        ...(targetPhone ? [eq(users.phone, targetPhone)] : [])
      ))
      .returning();
    return result;
  } catch (err) {
    console.warn('Error deleting user from Cloud SQL:', err);
    return [];
  }
}

// Delete single transaction from Cloud SQL
export async function deleteTransactionFromDb(txId: string | number) {
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
    console.warn('Error deleting transaction from DB:', err);
    return false;
  }
}

// Delete single order from Cloud SQL
export async function deleteOrderFromDb(orderId: string | number) {
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
    console.warn('Error deleting order from DB:', err);
    return false;
  }
}

// Fetch all investment orders from Cloud SQL
export async function getAllDbOrders() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(investmentOrders).orderBy(desc(investmentOrders.purchaseTimestamp));
  } catch {
    return [];
  }
}

// Fetch investment orders by user
export async function getDbOrdersByUser(userId: string, userPhone?: string) {
  if (!isSqlConfigured) return [];
  try {
    const cleanId = String(userId).trim();
    const cleanPhone = userPhone ? String(userPhone).replace(/\D/g, '').slice(-10) : '';
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

// Upsert investment order into Cloud SQL
export async function upsertDbOrder(order: any) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(order.id || `ord-${Date.now()}`).trim();
    const existing = await db
      .select()
      .from(investmentOrders)
      .where(eq(investmentOrders.id, cleanId))
      .limit(1);

    if (existing && existing.length > 0) {
      const updated = await db
        .update(investmentOrders)
        .set({
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
          refundAmount: order.refundAmount ?? existing[0].refundAmount,
        })
        .where(eq(investmentOrders.id, cleanId))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(investmentOrders)
        .values({
          id: cleanId,
          userId: order.userId || 'unknown',
          productId: order.productId || 'p-default',
          productName: order.productName || 'Investment Asset',
          price: Number(order.price) || 0,
          dailyEarnings: Number(order.dailyEarnings) || 0,
          totalRevenue: Number(order.totalRevenue) || 0,
          cycleDays: Number(order.cycleDays) || 30,
          daysElapsed: Number(order.daysElapsed) || 0,
          totalAccrued: Number(order.totalAccrued) || 0,
          purchaseDate: order.purchaseDate || new Date().toISOString().split('T')[0],
          lastClaimDate: order.lastClaimDate || new Date().toISOString().split('T')[0],
          purchaseTimestamp: order.purchaseTimestamp || Date.now(),
          lastClaimTimestamp: order.lastClaimTimestamp || Date.now(),
          nextClaimTimestamp: order.nextClaimTimestamp || (Date.now() + 24 * 60 * 60 * 1000),
          status: order.status || 'active',
          userPhone: order.userPhone || null,
          userNickname: order.userNickname || null,
          adminNote: order.adminNote || null,
          pauseReason: order.pauseReason || null,
          approvedAt: order.approvedAt || null,
          cancelledAt: order.cancelledAt || null,
          refundAmount: Number(order.refundAmount) || 0,
        })
        .returning();
      return inserted[0];
    }
  } catch (err) {
    console.warn('Error in upsertDbOrder:', err);
    return null;
  }
}

// Platform Settings in Cloud SQL
export async function getPlatformSettingFromDb(key: string) {
  if (!isSqlConfigured) return null;
  try {
    const res = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    return res[0]?.value || null;
  } catch (error) {
    console.error(`Error fetching platform setting ${key}:`, error);
    return null;
  }
}

export async function setPlatformSettingInDb(key: string, value: any) {
  if (!isSqlConfigured) return null;
  try {
    const res = await db
      .insert(platformSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return res[0];
  } catch (error) {
    console.error(`Error saving platform setting ${key}:`, error);
    return null;
  }
}

// -------------------------------------------------------------
// Products in Cloud SQL (Add, Update, Fetch, Delete)
// -------------------------------------------------------------
export async function getAllDbProducts() {
  if (!isSqlConfigured) return [];
  try {
    const list = await db.select().from(products).orderBy(desc(products.createdAt));
    return list.map((p) => {
      const specsObj = p.specs && typeof p.specs === 'object' ? (p.specs as any) : {};
      const calculatedDailyPercent =
        p.price > 0 ? Number(((p.dailyEarnings / p.price) * 100).toFixed(1)) : 0;
      return {
        id: p.id,
        name: p.name,
        category: p.category || 'steady',
        vipRequirement: p.minVip ?? 0,
        price: p.price ?? 0,
        dailyEarnings: p.dailyEarnings ?? 0,
        dailyPercent: specsObj.dailyPercent ?? calculatedDailyPercent,
        cycleDays: p.cycleDays ?? 30,
        totalRevenue: p.totalRevenue ?? 0,
        image: p.image || 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
        accentColor: specsObj.accentColor || '#0f766e',
        soldCount: p.soldCount ?? 0,
        totalUnits: p.stock ?? 5000,
        description: p.description || '',
        highlightBadge: specsObj.highlightBadge || '',
        ...specsObj,
      };
    });
  } catch (err) {
    console.warn('Error fetching products from Cloud SQL:', err);
    return [];
  }
}

const numOr = (val: any, fallback: number): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

export async function upsertDbProduct(prod: any) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(prod.id || `prod_${Date.now()}`).trim();
    const cleanPrice = numOr(prod.price, 0);
    const cleanEarnings = numOr(prod.dailyEarnings, 0);
    const cleanPercent = prod.dailyPercent ?? (cleanPrice > 0 ? Number(((cleanEarnings / cleanPrice) * 100).toFixed(1)) : 0);

    const specsObj = {
      ...(prod.specs && typeof prod.specs === 'object' ? prod.specs : {}),
      accentColor: prod.accentColor || '#0f766e',
      highlightBadge: prod.highlightBadge || '',
      dailyPercent: cleanPercent,
      retailName: prod.retailName || prod.name || '',
      sku: prod.sku || '',
      mrp: prod.mrp ? Number(prod.mrp) : undefined,
      warranty: prod.warranty || '25 Years Performance Guarantee',
      inStock: prod.inStock !== false,
    };

    const payload = {
      id: cleanId,
      name: prod.name || prod.title || 'Product',
      title: prod.title || prod.name || '',
      price: cleanPrice,
      dailyEarnings: cleanEarnings,
      totalRevenue: numOr(prod.totalRevenue, 0),
      cycleDays: numOr(prod.cycleDays, 30),
      category: prod.category || 'steady',
      image: prod.image || 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
      minVip: numOr(prod.vipRequirement ?? prod.minVip, 0),
      stock: numOr(prod.totalUnits ?? prod.stock, 5000),
      isHot: Boolean(prod.isHot),
      isPopular: Boolean(prod.isPopular),
      soldCount: numOr(prod.soldCount, 0),
      description: prod.description || '',
      specs: specsObj,
    };

    const res = await db
      .insert(products)
      .values(payload)
      .onConflictDoUpdate({
        target: products.id,
        set: payload,
      })
      .returning();
    return res[0];
  } catch (err) {
    console.warn('Error upserting product in Cloud SQL:', err);
    return null;
  }
}

export async function deleteDbProduct(productId: string) {
  if (!isSqlConfigured) return false;
  try {
    const cleanId = String(productId).trim();
    await db.delete(products).where(eq(products.id, cleanId));
    return true;
  } catch (err) {
    console.warn('Error deleting product from Cloud SQL:', err);
    return false;
  }
}

// -------------------------------------------------------------
// Promo Codes in Cloud SQL (Add, Fetch, Delete)
// -------------------------------------------------------------
export async function getAllDbPromoCodes() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  } catch (err) {
    console.warn('Error fetching promo codes from Cloud SQL:', err);
    return [];
  }
}

export async function upsertDbPromoCode(promo: any) {
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
      isActive: promo.isActive !== false,
    };

    const res = await db
      .insert(promoCodes)
      .values(payload)
      .onConflictDoUpdate({
        target: promoCodes.code,
        set: payload,
      })
      .returning();
    return res[0];
  } catch (err) {
    console.warn('Error upserting promo code in Cloud SQL:', err);
    return null;
  }
}

export async function deleteDbPromoCode(promoIdOrCode: string) {
  if (!isSqlConfigured) return false;
  try {
    const clean = String(promoIdOrCode).trim();
    await db
      .delete(promoCodes)
      .where(or(eq(promoCodes.id, clean), eq(promoCodes.code, clean.toUpperCase())));
    return true;
  } catch (err) {
    console.warn('Error deleting promo code from Cloud SQL:', err);
    return false;
  }
}

// -------------------------------------------------------------
// Notices in Cloud SQL (Add, Fetch, Delete)
// -------------------------------------------------------------
export async function getAllDbNotices() {
  if (!isSqlConfigured) return [];
  try {
    return await db.select().from(notices).orderBy(desc(notices.priority), desc(notices.createdAt));
  } catch (err) {
    console.warn('Error fetching notices from Cloud SQL:', err);
    return [];
  }
}

export async function upsertDbNotice(notice: any) {
  if (!isSqlConfigured) return null;
  try {
    const cleanId = String(notice.id || `notice_${Date.now()}`).trim();
    const payload = {
      id: cleanId,
      title: notice.title || '',
      content: notice.content || '',
      type: notice.type || 'info',
      date: notice.date || new Date().toISOString().split('T')[0],
      isActive: notice.isActive !== false,
      priority: numOr(notice.priority, 0),
    };

    const res = await db
      .insert(notices)
      .values(payload)
      .onConflictDoUpdate({
        target: notices.id,
        set: payload,
      })
      .returning();
    return res[0];
  } catch (err) {
    console.warn('Error upserting notice in Cloud SQL:', err);
    return null;
  }
}

export async function deleteDbNotice(noticeId: string) {
  if (!isSqlConfigured) return false;
  try {
    const cleanId = String(noticeId).trim();
    await db.delete(notices).where(eq(notices.id, cleanId));
    return true;
  } catch (err) {
    console.warn('Error deleting notice from Cloud SQL:', err);
    return false;
  }
}

