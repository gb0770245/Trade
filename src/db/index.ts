import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

const getDatabaseUrl = (): string => {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.Key?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    ''
  );
};

export const isSqlConfigured = Boolean(
  (getDatabaseUrl() !== '') ||
  (process.env.SQL_HOST &&
    process.env.SQL_HOST.trim() !== '' &&
    process.env.SQL_DB_NAME &&
    process.env.SQL_DB_NAME.trim() !== '')
);

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    const dbUrl = getDatabaseUrl();
    if (dbUrl !== '') {
      const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      global._postgresPool = new Pool({
        connectionString: dbUrl,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      const isSsl = process.env.SQL_SSL === 'true' || Boolean(process.env.SQL_HOST && !process.env.SQL_HOST.includes('localhost'));
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER || process.env.SQL_ADMIN_USER,
        password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
        ssl: isSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Auto-initialize PostgreSQL tables if connected
export async function initPostgresSchema() {
  if (!isSqlConfigured) return;
  try {
    const currentPool = createPool();
    await currentPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        phone TEXT,
        password TEXT,
        nickname TEXT,
        avatar TEXT DEFAULT 'HD',
        invitation_code TEXT,
        invited_by TEXT,
        inviter_name TEXT,
        inviter_id TEXT,
        recharge_balance DOUBLE PRECISION DEFAULT 0,
        withdrawal_balance DOUBLE PRECISION DEFAULT 0,
        product_revenue DOUBLE PRECISION DEFAULT 0,
        vip_level INTEGER DEFAULT 0,
        total_invested DOUBLE PRECISION DEFAULT 0,
        check_in_streak INTEGER DEFAULT 0,
        last_check_in_date TEXT,
        spin_chances INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        role TEXT DEFAULT 'user',
        total_referrals INTEGER DEFAULT 0,
        total_commission_earned DOUBLE PRECISION DEFAULT 0,
        bank_details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        title TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at BIGINT,
        status TEXT NOT NULL DEFAULT 'completed',
        reference_no TEXT NOT NULL,
        payment_method TEXT,
        fee_amount DOUBLE PRECISION DEFAULT 0,
        net_amount DOUBLE PRECISION DEFAULT 0,
        bank_details JSONB
      );

      CREATE TABLE IF NOT EXISTS investment_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        daily_earnings DOUBLE PRECISION NOT NULL,
        total_revenue DOUBLE PRECISION NOT NULL,
        cycle_days INTEGER NOT NULL,
        days_elapsed INTEGER NOT NULL DEFAULT 0,
        total_accrued DOUBLE PRECISION NOT NULL DEFAULT 0,
        purchase_date TEXT NOT NULL,
        last_claim_date TEXT,
        purchase_timestamp BIGINT,
        last_claim_timestamp BIGINT,
        next_claim_timestamp BIGINT,
        status TEXT NOT NULL DEFAULT 'active',
        user_phone TEXT,
        user_nickname TEXT,
        admin_note TEXT,
        pause_reason TEXT,
        approved_at TEXT,
        cancelled_at TEXT,
        refund_amount DOUBLE PRECISION DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ecommerce_orders (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_number TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        shipping_address JSONB,
        payment_method TEXT,
        payment_id TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        tracking_number TEXT,
        courier_partner TEXT,
        created_at TEXT,
        estimated_delivery TEXT,
        invoice_number TEXT
      );

      CREATE TABLE IF NOT EXISTS platform_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        price DOUBLE PRECISION NOT NULL,
        daily_earnings DOUBLE PRECISION NOT NULL,
        total_revenue DOUBLE PRECISION NOT NULL,
        cycle_days INTEGER NOT NULL,
        category TEXT DEFAULT 'solar',
        image TEXT,
        min_vip INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 999,
        is_hot BOOLEAN DEFAULT FALSE,
        is_popular BOOLEAN DEFAULT FALSE,
        sold_count INTEGER DEFAULT 0,
        description TEXT,
        specs JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promo_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        amount DOUBLE PRECISION NOT NULL,
        max_uses INTEGER DEFAULT 1,
        used_count INTEGER DEFAULT 0,
        used_by JSONB,
        expires_at TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        date TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[PostgreSQL] Database schema tables verified and ready.');
  } catch (err) {
    console.warn('[PostgreSQL] Schema initialization note:', err);
  }
}

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

