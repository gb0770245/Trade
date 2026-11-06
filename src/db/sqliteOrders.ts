import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve(process.cwd(), 'src/data/nexa_database.sqlite');

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

let dbInstance: DatabaseSync | null = null;

const DELETED_ORDERS_PATH = path.resolve(process.cwd(), 'src/data/deleted_orders.json');

export function loadDeletedOrders(): Set<string> {
  const set = new Set<string>();
  try {
    if (fs.existsSync(DELETED_ORDERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(DELETED_ORDERS_PATH, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach((id: string) => set.add(String(id).trim().toLowerCase()));
      }
    }
  } catch {}
  return set;
}

export function saveDeletedOrder(orderId: string): void {
  const set = loadDeletedOrders();
  const cleanId = String(orderId).trim().toLowerCase();
  if (!cleanId) return;
  set.add(cleanId);
  try {
    fs.writeFileSync(DELETED_ORDERS_PATH, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch {}
}

export function getSqliteDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSqliteTables(dbInstance);
  }
  return dbInstance;
}

function initSqliteTables(db: DatabaseSync) {
  // Create investment_orders table
  db.exec(`
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

export interface SqlOrderRecord {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  price: number;
  dailyEarnings: number;
  totalRevenue: number;
  cycleDays: number;
  daysElapsed: number;
  totalAccrued: number;
  purchaseDate: string;
  lastClaimDate?: string | null;
  purchaseTimestamp?: number | null;
  lastClaimTimestamp?: number | null;
  nextClaimTimestamp?: number | null;
  status: string;
  userPhone?: string | null;
  userNickname?: string | null;
  adminNote?: string | null;
  pauseReason?: string | null;
  approvedAt?: string | null;
  cancelledAt?: string | null;
  refundAmount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export function upsertOrderInSql(order: any): SqlOrderRecord | null {
  const db = getSqliteDb();
  const cleanId = String(order.id || `ord-${Date.now()}`);
  const deletedSet = loadDeletedOrders();
  if (deletedSet.has(cleanId.toLowerCase())) {
    return null;
  }
  const cleanUserId = String(order.userId || order.user_id || 'unknown').trim();
  const cleanProductId = String(order.productId || order.product_id || 'prod-custom');
  const cleanProductName = String(order.productName || order.product_name || 'Investment Plan');
  const price = Number(order.price) || 0;
  const dailyEarnings = Number(order.dailyEarnings || order.daily_earnings) || 0;
  const totalRevenue = Number(order.totalRevenue || order.total_revenue) || 0;
  const cycleDays = Number(order.cycleDays || order.cycle_days) || 30;
  const daysElapsed = Number(order.daysElapsed || order.days_elapsed) || 0;
  const totalAccrued = Number(order.totalAccrued || order.total_accrued) || 0;
  const purchaseDate = String(order.purchaseDate || order.purchase_date || new Date().toISOString().split('T')[0]);
  const lastClaimDate = order.lastClaimDate || order.last_claim_date || purchaseDate;
  const purchaseTimestamp = Number(order.purchaseTimestamp || order.purchase_timestamp) || Date.now();
  const lastClaimTimestamp = Number(order.lastClaimTimestamp || order.last_claim_timestamp) || purchaseTimestamp;
  const nextClaimTimestamp = Number(order.nextClaimTimestamp || order.next_claim_timestamp) || (lastClaimTimestamp + 24 * 60 * 60 * 1000);
  const status = String(order.status || 'active');
  const userPhone = order.userPhone || order.user_phone || null;
  const userNickname = order.userNickname || order.user_nickname || null;
  const adminNote = order.adminNote || order.admin_note || null;
  const pauseReason = order.pauseReason || order.pause_reason || null;
  const approvedAt = order.approvedAt || order.approved_at || null;
  const cancelledAt = order.cancelledAt || order.cancelled_at || null;
  const refundAmount = Number(order.refundAmount || order.refund_amount) || 0;
  const nowIso = new Date().toISOString();

  const stmt = db.prepare(`
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
    cleanId, cleanUserId, cleanProductId, cleanProductName, price, dailyEarnings,
    totalRevenue, cycleDays, daysElapsed, totalAccrued,
    purchaseDate, lastClaimDate, purchaseTimestamp, lastClaimTimestamp,
    nextClaimTimestamp, status, userPhone, userNickname, adminNote,
    pauseReason, approvedAt, cancelledAt, refundAmount, nowIso
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
    updatedAt: nowIso,
  };
}

export function getAllOrdersFromSql(): any[] {
  const db = getSqliteDb();
  const deletedSet = loadDeletedOrders();
  const rows = db.prepare(`SELECT * FROM investment_orders ORDER BY purchase_timestamp DESC`).all() as any[];
  return rows
    .filter((r) => !deletedSet.has(String(r.id).trim().toLowerCase()))
    .map((r) => ({
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
      updatedAt: r.updated_at,
    }));
}

export function getOrdersForUserFromSql(possibleIdentifiers: string[]): any[] {
  const db = getSqliteDb();
  const deletedSet = loadDeletedOrders();
  const cleanList = possibleIdentifiers
    .map((s) => String(s || '').trim())
    .filter((s) => s.length > 0);

  if (cleanList.length === 0) return [];

  const placeholders = cleanList.map(() => '?').join(', ');
  const query = `
    SELECT * FROM investment_orders 
    WHERE user_id IN (${placeholders}) 
       OR user_phone IN (${placeholders})
    ORDER BY purchase_timestamp DESC
  `;

  const params = [...cleanList, ...cleanList];
  const rows = db.prepare(query).all(...params) as any[];

  return rows
    .filter((r) => !deletedSet.has(String(r.id).trim().toLowerCase()))
    .map((r) => ({
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
      updatedAt: r.updated_at,
    }));
}

export function deleteOrderFromSql(orderId: string): boolean {
  const db = getSqliteDb();
  const cleanId = String(orderId).trim();
  saveDeletedOrder(cleanId);
  const res = db.prepare(`DELETE FROM investment_orders WHERE id = ? OR LOWER(id) = LOWER(?)`).run(cleanId, cleanId);
  return res.changes > 0;
}

export function deleteOrdersForUserInSql(userId: string, phone?: string): number {
  const db = getSqliteDb();
  const cleanId = String(userId || '').trim();
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';

  try {
    const matching = db.prepare(`
      SELECT id FROM investment_orders 
      WHERE user_id = ? 
         OR user_phone = ? 
         OR (user_phone IS NOT NULL AND user_phone LIKE ?)
    `).all(cleanId, cleanPhone, `%${cleanPhone}%`) as { id: string }[];

    for (const m of matching) {
      if (m?.id) {
        saveDeletedOrder(String(m.id).trim());
      }
    }
  } catch (err) {
    console.warn('Error archiving deleted order IDs:', err);
  }

  const res = db.prepare(`
    DELETE FROM investment_orders 
    WHERE user_id = ? 
       OR user_phone = ? 
       OR (user_phone IS NOT NULL AND user_phone LIKE ?)
  `).run(cleanId, cleanPhone, `%${cleanPhone}%`);
  return Number(res.changes);
}

export function purgeAllOrdersFromSql(): void {
  const db = getSqliteDb();
  db.prepare(`DELETE FROM investment_orders`).run();
}

export function syncAllRealUserOrders(_usersList?: any[]): any[] {
  // Pure live state: strictly no demo or hardcoded mock orders
  return getAllOrdersFromSql();
}

// ========================================================
// SQLite Products Persistence Functions
// ========================================================
export function upsertProductInSql(prod: any): any {
  const db = getSqliteDb();
  const cleanId = String(prod.id || `prod-${Date.now()}`).trim();
  const price = Number(prod.price) || 0;
  const dailyEarnings = Number(prod.dailyEarnings) || 0;
  const dailyPercent = prod.dailyPercent !== undefined ? Number(prod.dailyPercent) : (price > 0 ? Number(((dailyEarnings / price) * 100).toFixed(1)) : 50);
  const cycleDays = Number(prod.cycleDays || 45);
  const totalRevenue = Number(prod.totalRevenue || (dailyEarnings * cycleDays).toFixed(2));
  const updatedAt = typeof prod.updatedAt === 'number' ? prod.updatedAt : Date.now();

  const stmt = db.prepare(`
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
    prod.name || 'Contract Plan',
    prod.category || 'steady',
    Number(prod.vipRequirement ?? prod.minVip ?? 0),
    price,
    dailyEarnings,
    dailyPercent,
    cycleDays,
    totalRevenue,
    prod.image || 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    prod.accentColor || 'from-emerald-600 to-teal-500',
    Number(prod.soldCount || 0),
    Number(prod.totalUnits ?? prod.stock ?? 5000),
    prod.description || '',
    prod.highlightBadge || '',
    prod.retailName || prod.name || '',
    prod.sku || `NEXA-${cleanId.toUpperCase().slice(0, 8)}`,
    prod.mrp ? Number(prod.mrp) : Math.round(price * 1.25),
    prod.warranty || '25 Years Performance Guarantee',
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
    updatedAt,
  };
}

export function getAllProductsFromSql(): any[] {
  const db = getSqliteDb();
  const rows = db.prepare(`SELECT * FROM platform_products ORDER BY rowid ASC`).all() as any[];
  return rows.map((r) => {
    let rawObj: any = {};
    if (r.raw_json) {
      try { rawObj = JSON.parse(r.raw_json); } catch {}
    }
    return {
      ...rawObj,
      id: r.id,
      name: r.name,
      category: r.category,
      vipRequirement: Number(r.vip_requirement) || 0,
      price: Number(r.price) || 0,
      dailyEarnings: Number(r.daily_earnings) || 0,
      dailyPercent: r.daily_percent !== null && r.daily_percent !== undefined ? Number(r.daily_percent) : undefined,
      cycleDays: Number(r.cycle_days) || 45,
      totalRevenue: Number(r.total_revenue) || 0,
      image: r.image,
      accentColor: r.accent_color,
      soldCount: Number(r.sold_count) || 0,
      totalUnits: Number(r.total_units) || 5000,
      description: r.description,
      highlightBadge: r.highlight_badge,
      retailName: r.retail_name,
      sku: r.sku,
      mrp: r.mrp ? Number(r.mrp) : undefined,
      warranty: r.warranty,
      inStock: r.in_stock === 1,
      updatedAt: Number(r.updated_at) || undefined,
    };
  });
}

export function deleteProductFromSql(productId: string): boolean {
  const db = getSqliteDb();
  const cleanId = String(productId).trim();
  const res = db.prepare(`DELETE FROM platform_products WHERE id = ?`).run(cleanId);
  return res.changes > 0;
}

export function initAndSyncSqlProducts(initialProducts: any[]): void {
  const db = getSqliteDb();

  // 1. Read deleted products blacklist so admin-deleted products NEVER restore
  let deletedProductIds = new Set<string>();
  try {
    const deletedFile = path.resolve(process.cwd(), 'src/data/deleted_products.json');
    if (fs.existsSync(deletedFile)) {
      const data = JSON.parse(fs.readFileSync(deletedFile, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach((id: string) => deletedProductIds.add(String(id).trim()));
      }
    }
  } catch (e) {
    console.warn('Error reading deleted_products.json:', e);
  }

  // 2. Remove obsolete old products (like old $5000, $2500, $1000, $500, $280 products) or blacklisted products
  try {
    db.prepare(`
      DELETE FROM platform_products 
      WHERE id IN ('prod-1793251583445', 'prod-1793251570879', 'prod-1793251545940', 'prod-1793251470609', 'prod-1793251426305', 'prod-1793251372972')
         OR name LIKE '%Royal%'
         OR name LIKE '%Elite%'
         OR price > 250
    `).run();

    for (const delId of deletedProductIds) {
      db.prepare(`DELETE FROM platform_products WHERE id = ?`).run(delId);
    }
  } catch (err) {
    console.warn('Cleanup old platform products notice:', err);
  }

  // 3. Upsert canonical 6 products ($25, $50, $75, $100, $150, $250)
  if (Array.isArray(initialProducts) && initialProducts.length > 0) {
    for (const p of initialProducts) {
      if (p && p.id && !deletedProductIds.has(String(p.id).trim())) {
        try {
          upsertProductInSql(p);
        } catch (err) {
          console.warn('Error upserting product in SQLite:', p.id, err);
        }
      }
    }
  }
}
