import { getSqliteDb } from './sqliteOrders.ts';

// Initialize platform_users table in SQLite
export function initSqliteUsersTable(): void {
  const db = getSqliteDb();
  db.exec(`
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

export interface SqlUserRecord {
  id: string;
  phone: string;
  password: string;
  nickname: string;
  avatar: string;
  invitationCode: string;
  invitedBy?: string | null;
  inviterName?: string | null;
  inviterId?: string | null;
  rechargeBalance: number;
  withdrawalBalance: number;
  productRevenue: number;
  vipLevel: number;
  totalInvested: number;
  checkInStreak: number;
  lastCheckInDate?: string | null;
  spinChances: number;
  status: string;
  role: string;
  totalReferrals: number;
  totalCommissionEarned: number;
  bankDetails?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    upiId?: string;
  } | null;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function parseBankDetails(r: any): any {
  if (r.bank_details_json) {
    try {
      const parsed = JSON.parse(r.bank_details_json);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  if (r.bank_account_number || r.bank_account_holder || r.bank_ifsc_code || r.bank_upi_id) {
    return {
      accountHolder: r.bank_account_holder || '',
      bankName: r.bank_name || 'Bank IMPS',
      accountNumber: r.bank_account_number || '',
      ifscCode: r.bank_ifsc_code || '',
      upiId: r.bank_upi_id || '',
    };
  }
  return null;
}

function mapSqlRowToUser(r: any): SqlUserRecord {
  const bankDetails = parseBankDetails(r);
  let invitedBy = r.invited_by || null;
  let inviterName = r.inviter_name || null;
  let inviterId = r.inviter_id || null;

  // Cleanse old Ravi Sahu dummy reference (R34VZ / 852539) to real Ravi Sahu (J9Y79 / 325697)
  if (
    invitedBy === 'R34VZ' ||
    inviterId === '852539' ||
    (inviterName && String(inviterName).trim().toLowerCase() === 'ravisahu')
  ) {
    invitedBy = 'J9Y79';
    inviterName = 'Ravi Sahu';
    inviterId = '325697';
  }

  // Cleanse old Anshusahu reference (EYAYY) to real Anshusahu (AAWFK / 406332)
  if (
    invitedBy === 'EYAYY' ||
    (inviterName && String(inviterName).trim().toLowerCase().includes('anshu') && (inviterId === '406332' || !inviterId))
  ) {
    invitedBy = 'AAWFK';
    inviterName = 'Anshusahu';
    inviterId = '406332';
  }

  return {
    id: String(r.id),
    phone: String(r.phone),
    password: String(r.password || 'password123'),
    nickname: r.nickname || `Member_${String(r.id).slice(-4)}`,
    avatar: r.avatar || 'HD',
    invitationCode: r.invitation_code || '4AB86',
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
    status: r.status || 'active',
    role: r.role || 'user',
    totalReferrals: Number(r.total_referrals) || 0,
    totalCommissionEarned: Number(r.total_commission_earned) || 0,
    bankDetails,
    isDeleted: Boolean(r.is_deleted === 1),
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}

export function upsertUserInSql(user: any): SqlUserRecord {
  const db = getSqliteDb();
  initSqliteUsersTable();

  const cleanPhone = String(user.phone || '').replace(/\D/g, '').slice(-10);
  const cleanId = String(user.id || user.uid || (cleanPhone ? `usr-${cleanPhone}` : `usr-${Date.now()}`)).trim();

  // Find existing row by ID or Phone to avoid dropping any existing field
  const existingRow = db.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? OR phone = ?
    LIMIT 1
  `).get(cleanId, cleanPhone) as any;

  // Resolve password: NEVER drop existing password
  let finalPassword = 'password123';
  if (user.password && String(user.password).trim().length > 0) {
    finalPassword = String(user.password).trim();
  } else if (existingRow?.password && String(existingRow.password).trim().length > 0) {
    finalPassword = String(existingRow.password).trim();
  }

  // Resolve Nickname
  const finalNickname = user.nickname?.trim() || existingRow?.nickname || (cleanPhone ? `Member_${cleanPhone.slice(-4)}` : 'Member');
  const finalAvatar = user.avatar || existingRow?.avatar || 'HD';
  const finalInviteCode = (user.invitationCode || existingRow?.invitation_code || '4AB86').trim().toUpperCase();

  // Resolve Referrer: allow updating if provided, fallback to existing only if undefined
  let finalInvitedBy = user.invitedBy !== undefined 
    ? (user.invitedBy ? String(user.invitedBy).trim().toUpperCase() : null) 
    : (existingRow?.invited_by || null);
  let finalInviterName = user.inviterName !== undefined 
    ? (user.inviterName ? String(user.inviterName).trim() : null) 
    : (existingRow?.inviter_name || null);
  let finalInviterId = user.inviterId !== undefined 
    ? (user.inviterId ? String(user.inviterId).trim() : null) 
    : (existingRow?.inviter_id || null);

  // Cleanse old Ravi Sahu dummy reference (R34VZ / 852539) to real Ravi Sahu (J9Y79 / 325697)
  if (
    finalInvitedBy === 'R34VZ' ||
    finalInviterId === '852539' ||
    (finalInviterName && finalInviterName.trim().toLowerCase() === 'ravisahu')
  ) {
    finalInvitedBy = 'J9Y79';
    finalInviterName = 'Ravi Sahu';
    finalInviterId = '325697';
  }

  // Cleanse old Anshusahu reference (EYAYY) to real Anshusahu (AAWFK / 406332)
  if (
    finalInvitedBy === 'EYAYY' ||
    (finalInviterName && String(finalInviterName).trim().toLowerCase().includes('anshu') && (finalInviterId === '406332' || !finalInviterId))
  ) {
    finalInvitedBy = 'AAWFK';
    finalInviterName = 'Anshusahu';
    finalInviterId = '406332';
  }

  // Resolve Balances safely: accept any valid numeric balance (including 0 when deducted or withdrawn)
  const rechargeBalance = user.rechargeBalance !== undefined && user.rechargeBalance !== null && !isNaN(Number(user.rechargeBalance))
    ? Math.max(0, Number(user.rechargeBalance))
    : Number(existingRow?.recharge_balance || 0);

  const withdrawalBalance = user.withdrawalBalance !== undefined && user.withdrawalBalance !== null && !isNaN(Number(user.withdrawalBalance))
    ? Math.max(0, Number(user.withdrawalBalance))
    : Number(existingRow?.withdrawal_balance || 0);

  const productRevenue = user.productRevenue !== undefined && user.productRevenue !== null && !isNaN(Number(user.productRevenue))
    ? Number(user.productRevenue)
    : Number(existingRow?.product_revenue || 0);

  const vipLevel = user.vipLevel !== undefined && user.vipLevel !== null && !isNaN(Number(user.vipLevel))
    ? Number(user.vipLevel)
    : Number(existingRow?.vip_level || 0);

  const totalInvested = user.totalInvested !== undefined && user.totalInvested !== null && !isNaN(Number(user.totalInvested))
    ? Number(user.totalInvested)
    : Number(existingRow?.total_invested || 0);

  const checkInStreak = user.checkInStreak !== undefined && user.checkInStreak !== null && !isNaN(Number(user.checkInStreak))
    ? Number(user.checkInStreak)
    : Number(existingRow?.check_in_streak || 0);

  const lastCheckInDate = user.lastCheckInDate || existingRow?.last_check_in_date || null;

  const spinChances = user.spinChances !== undefined && user.spinChances !== null && !isNaN(Number(user.spinChances))
    ? Number(user.spinChances)
    : Number(existingRow?.spin_chances || 0);

  const status = user.status || existingRow?.status || 'active';
  const role = user.role || existingRow?.role || 'user';

  const totalReferrals = Math.max(
    Number(user.totalReferrals) || 0,
    Number(existingRow?.total_referrals) || 0
  );

  const totalCommissionEarned = Math.max(
    Number(user.totalCommissionEarned) || 0,
    Number(existingRow?.total_commission_earned) || 0
  );

  // Resolve Bank Details: NEVER clear existing valid bank details with null or blank
  const existingBank = existingRow ? parseBankDetails(existingRow) : null;
  const incomingBank = user.bankDetails && typeof user.bankDetails === 'object' ? user.bankDetails : null;

  let finalBank = existingBank;
  if (incomingBank) {
    finalBank = {
      accountHolder: incomingBank.accountHolder?.trim() || existingBank?.accountHolder || '',
      bankName: incomingBank.bankName?.trim() || existingBank?.bankName || 'Bank IMPS',
      accountNumber: incomingBank.accountNumber?.trim() || existingBank?.accountNumber || '',
      ifscCode: (incomingBank.ifscCode?.trim() || existingBank?.ifscCode || '').toUpperCase(),
      upiId: incomingBank.upiId?.trim() || existingBank?.upiId || '',
    };
  }

  const bankHolder = finalBank?.accountHolder || null;
  const bankNumber = finalBank?.accountNumber || null;
  const bankIfsc = finalBank?.ifscCode || null;
  const bankName = finalBank?.bankName || null;
  const bankUpi = finalBank?.upiId || null;
  const bankDetailsJson = finalBank ? JSON.stringify(finalBank) : null;

  const nowIso = new Date().toISOString();
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
    updatedAt: nowIso,
  });

  const stmt = db.prepare(`
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
    cleanId, cleanPhone, finalPassword, finalNickname, finalAvatar, finalInviteCode,
    finalInvitedBy, finalInviterName, finalInviterId, rechargeBalance,
    withdrawalBalance, productRevenue, vipLevel, totalInvested,
    checkInStreak, lastCheckInDate, spinChances, status,
    role, totalReferrals, totalCommissionEarned,
    bankHolder, bankNumber, bankIfsc,
    bankName, bankUpi, bankDetailsJson, rawJson,
    createdAt, nowIso
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
    updatedAt: nowIso,
  };
}

export function getUserByIdOrPhoneFromSql(identifier: string): SqlUserRecord | null {
  const db = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(identifier || '').trim();
  const cleanPhone = raw.replace(/\D/g, '').slice(-10);

  const row = db.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? 
       OR phone = ? 
       OR invitation_code = ?
    LIMIT 1
  `).get(raw, cleanPhone, raw.toUpperCase()) as any;

  if (!row) return null;
  return mapSqlRowToUser(row);
}

export function getAllUsersFromSql(includeDeleted: boolean = false): SqlUserRecord[] {
  const db = getSqliteDb();
  initSqliteUsersTable();

  // Load deleted users blacklist
  const deletedSet = new Set<string>();
  try {
    const fs = require('fs');
    const path = require('path');
    const delPath = path.resolve(process.cwd(), 'src/data/deleted_users.json');
    if (fs.existsSync(delPath)) {
      const parsed = JSON.parse(fs.readFileSync(delPath, 'utf-8'));
      if (Array.isArray(parsed)) {
        parsed.forEach((x: any) => {
          if (typeof x === 'string') deletedSet.add(x.trim());
          else if (x?.id) deletedSet.add(String(x.id).trim());
          else if (x?.phone) deletedSet.add(String(x.phone).replace(/\D/g, '').slice(-10));
        });
      }
    }
  } catch {}

  const query = includeDeleted
    ? `SELECT * FROM platform_users ORDER BY rowid DESC`
    : `SELECT * FROM platform_users WHERE is_deleted = 0 ORDER BY rowid DESC`;

  const rows = db.prepare(query).all() as any[];
  const mapped = rows.map(mapSqlRowToUser);
  return mapped.filter((u) => {
    const uId = String(u.id || '').trim();
    const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
    return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
  });
}

export function hardDeleteUserInSql(userId: string, phone?: string): boolean {
  const db = getSqliteDb();
  initSqliteUsersTable();
  const cleanId = String(userId || '').trim();
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';

  let changes = 0;
  if (cleanPhone) {
    const res = db.prepare(`
      DELETE FROM platform_users 
      WHERE id = ? 
         OR phone = ? 
         OR phone LIKE ?
    `).run(cleanId, cleanPhone, `%${cleanPhone}%`);
    changes = Number(res.changes);
  } else {
    const res = db.prepare(`
      DELETE FROM platform_users 
      WHERE id = ? 
    `).run(cleanId);
    changes = Number(res.changes);
  }

  return changes > 0;
}

export function softDeleteUserInSql(userId: string, phone?: string): boolean {
  const db = getSqliteDb();
  initSqliteUsersTable();
  const cleanId = String(userId).trim();
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';

  // Soft delete: keep the record, balances, bank details, and history intact!
  const res = db.prepare(`
    UPDATE platform_users 
    SET is_deleted = 1, status = 'suspended', updated_at = datetime('now')
    WHERE id = ? OR phone = ?
  `).run(cleanId, cleanPhone);

  return res.changes > 0;
}

export function initAndSyncSqlUsers(initialUsers: any[]): void {
  const db = getSqliteDb();
  initSqliteUsersTable();

  // Read deleted users blacklist so deleted accounts NEVER restore
  const deletedSet = new Set<string>();
  try {
    const fs = require('fs');
    const path = require('path');
    const delPath = path.resolve(process.cwd(), 'src/data/deleted_users.json');
    if (fs.existsSync(delPath)) {
      const parsed = JSON.parse(fs.readFileSync(delPath, 'utf-8'));
      if (Array.isArray(parsed)) {
        parsed.forEach((x: any) => {
          if (typeof x === 'string') deletedSet.add(x.trim());
          else if (x?.id) deletedSet.add(String(x.id).trim());
          else if (x?.phone) deletedSet.add(String(x.phone).replace(/\D/g, '').slice(-10));
        });
      } else if (parsed && typeof parsed === 'object') {
        (parsed.deletedIds || []).forEach((id: string) => deletedSet.add(String(id).trim()));
        (parsed.deletedPhones || []).forEach((p: string) => deletedSet.add(String(p).replace(/\D/g, '').slice(-10)));
      }
    }
  } catch {}

  console.log(`[SQLite Users] Initializing users table and syncing ${initialUsers.length} records...`);
  for (const u of initialUsers) {
    if (u && (u.id || u.phone)) {
      const uId = String(u.id || '').trim();
      const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
      if (deletedSet.has(uId) || (uPhone && deletedSet.has(uPhone))) {
        // Blacklisted permanently: remove if present in DB
        hardDeleteUserInSql(uId, uPhone);
        continue;
      }
      upsertUserInSql(u);
    }
  }
}

// Dedicated function to atomically relink a user to an upliner in SQLite
export function relinkUserUplineInSql(
  targetIdentifier: string,
  uplineCode: string,
  uplineId?: string,
  uplineName?: string
): SqlUserRecord | null {
  const db = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(targetIdentifier || '').trim();
  const cleanPhone = raw.replace(/\D/g, '').slice(-10);

  // First find the target user
  const target = db.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? OR phone = ?
    LIMIT 1
  `).get(raw, cleanPhone) as any;

  if (!target) return null;

  const code = uplineCode ? uplineCode.trim().toUpperCase() : null;
  const name = uplineName ? uplineName.trim() : null;
  const id = uplineId ? uplineId.trim() : null;

  // Direct SQL update
  db.prepare(`
    UPDATE platform_users
    SET invited_by = ?,
        inviter_name = ?,
        inviter_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(code, name, id, target.id);

  // Also update raw_json payload to keep embedded JSON synchronized
  try {
    const parsed = JSON.parse(target.raw_json || '{}');
    parsed.invitedBy = code;
    parsed.inviterName = name;
    parsed.inviterId = id;
    parsed.updatedAt = new Date().toISOString();
    db.prepare(`UPDATE platform_users SET raw_json = ? WHERE id = ?`).run(
      JSON.stringify(parsed),
      target.id
    );
  } catch (e) {
    // ignore json parse errors
  }

  const updated = db.prepare(`SELECT * FROM platform_users WHERE id = ?`).get(target.id) as any;
  return updated ? mapSqlRowToUser(updated) : null;
}

// Dedicated function to atomically credit commission to a user in SQLite
export function creditUserCommissionInSql(
  userIdOrPhone: string,
  commissionAmount: number
): SqlUserRecord | null {
  const db = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(userIdOrPhone || '').trim();
  const cleanPhone = raw.replace(/\D/g, '').slice(-10);
  const amount = Number(commissionAmount) || 0;
  if (amount <= 0) return null;

  const target = db.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? OR (phone = ? AND length(?) = 10)
    LIMIT 1
  `).get(raw, cleanPhone, cleanPhone) as any;

  if (!target) return null;

  const newWithdrawal = Number((Number(target.withdrawal_balance || 0) + amount).toFixed(2));
  const newComm = Number((Number(target.total_commission_earned || 0) + amount).toFixed(2));

  db.prepare(`
    UPDATE platform_users
    SET withdrawal_balance = ?,
        total_commission_earned = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(newWithdrawal, newComm, target.id);

  try {
    const parsed = JSON.parse(target.raw_json || '{}');
    parsed.withdrawalBalance = newWithdrawal;
    parsed.totalCommissionEarned = newComm;
    parsed.updatedAt = new Date().toISOString();
    db.prepare(`UPDATE platform_users SET raw_json = ? WHERE id = ?`).run(
      JSON.stringify(parsed),
      target.id
    );
  } catch (e) {}

  const updated = db.prepare(`SELECT * FROM platform_users WHERE id = ?`).get(target.id) as any;
  return updated ? mapSqlRowToUser(updated) : null;
}

// Dedicated function to update any wallet balance directly and atomically in SQLite
export function updateUserWalletBalanceInSql(
  userIdOrPhone: string,
  wallet: 'rechargeBalance' | 'withdrawalBalance' | 'productRevenue',
  newBalance: number
): SqlUserRecord | null {
  const db = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(userIdOrPhone || '').trim();
  const cleanPhone = raw.replace(/\D/g, '').slice(-10);
  const finalVal = Math.max(0, Number(newBalance) || 0);

  const colMap: Record<string, string> = {
    rechargeBalance: 'recharge_balance',
    withdrawalBalance: 'withdrawal_balance',
    productRevenue: 'product_revenue',
  };
  const col = colMap[wallet] || 'withdrawal_balance';

  const target = db.prepare(`
    SELECT * FROM platform_users 
    WHERE id = ? OR (phone = ? AND length(?) = 10)
    LIMIT 1
  `).get(raw, cleanPhone, cleanPhone) as any;

  if (!target) return null;

  db.prepare(`
    UPDATE platform_users
    SET ${col} = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(finalVal, target.id);

  try {
    const parsed = JSON.parse(target.raw_json || '{}');
    parsed[wallet] = finalVal;
    parsed.updatedAt = new Date().toISOString();
    db.prepare(`UPDATE platform_users SET raw_json = ? WHERE id = ?`).run(
      JSON.stringify(parsed),
      target.id
    );
  } catch (e) {}

  const updated = db.prepare(`SELECT * FROM platform_users WHERE id = ?`).get(target.id) as any;
  return updated ? mapSqlRowToUser(updated) : null;
}

// Dedicated function to update total referrals count for a user in SQLite
export function updateUserReferralsInSql(
  userIdOrPhone: string,
  referralCount: number
): void {
  const db = getSqliteDb();
  initSqliteUsersTable();
  const raw = String(userIdOrPhone || '').trim();
  const cleanPhone = raw.replace(/\D/g, '').slice(-10);
  const count = Math.max(0, Number(referralCount) || 0);

  db.prepare(`
    UPDATE platform_users
    SET total_referrals = ?,
        updated_at = datetime('now')
    WHERE id = ? OR (phone = ? AND length(?) = 10)
  `).run(count, raw, cleanPhone, cleanPhone);
}

// Reset all users' balances to 0 in SQLite
export function resetAllUsersBalancesInSql(): void {
  const db = getSqliteDb();
  initSqliteUsersTable();
  db.prepare(`
    UPDATE platform_users
    SET recharge_balance = 0,
        withdrawal_balance = 0,
        product_revenue = 0,
        total_invested = 0,
        total_commission_earned = 0,
        updated_at = datetime('now')
  `).run();
}
