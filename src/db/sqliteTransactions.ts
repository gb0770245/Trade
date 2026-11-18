import fs from 'fs';
import path from 'path';
import { getSqliteDb } from './sqliteOrders.ts';

const TRANSACTIONS_BACKUP_PATH = path.resolve(process.cwd(), 'src/data/transactions_backup.json');
let initialized = false;

const getStatusRank = (status: any): number => {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'completed' || s === 'rejected') return 3;
  if (s === 'processing') return 1;
  return 0;
};

const isNumericOnly = (val: any): boolean =>
  val !== undefined && val !== null && /^\d+$/.test(String(val).trim());

function mergeTxRecords(existing: any, incoming: any): any {
  if (!existing) return { ...incoming };
  if (!incoming) return { ...existing };

  const existingRank = getStatusRank(existing.status);
  const incomingRank = getStatusRank(incoming.status);

  const merged: any = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null && v !== '') {
      merged[k] = v;
    }
  }

  const exId = existing.id !== undefined && existing.id !== null ? String(existing.id).trim() : '';
  const inId = incoming.id !== undefined && incoming.id !== null ? String(incoming.id).trim() : '';
  if (exId && !isNumericOnly(exId)) {
    merged.id = exId;
    if (isNumericOnly(inId)) merged.sqlId = Number(inId);
  } else if (inId && !isNumericOnly(inId)) {
    merged.id = inId;
    if (isNumericOnly(exId)) merged.sqlId = Number(exId);
  } else {
    merged.id = exId || inId;
  }
  if (existing.sqlId && !merged.sqlId) merged.sqlId = existing.sqlId;

  // Terminal status dominance: once completed or rejected, never revert to processing
  if (existingRank > incomingRank) {
    merged.status = existing.status;
    if (existing.utrNumber) merged.utrNumber = existing.utrNumber;
    if (existing.rejectReason) merged.rejectReason = existing.rejectReason;
    if (existing.updatedAt) merged.updatedAt = existing.updatedAt;
    if (existing.balanceAfter !== undefined) merged.balanceAfter = existing.balanceAfter;
    if (existing.rechargeBalanceAfter !== undefined) merged.rechargeBalanceAfter = existing.rechargeBalanceAfter;
    if (existing.withdrawalBalanceAfter !== undefined) merged.withdrawalBalanceAfter = existing.withdrawalBalanceAfter;
  }

  return merged;
}

export function initSqliteTransactionsTable(): void {
  const db = getSqliteDb();
  if (!initialized) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions_ledger (
        id TEXT PRIMARY KEY,
        sql_id INTEGER,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'completed',
        reference_no TEXT,
        utr_number TEXT,
        created_at INTEGER DEFAULT 0,
        updated_at TEXT,
        raw_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tx_ledger_user ON transactions_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_tx_ledger_ref ON transactions_ledger(reference_no);
      CREATE INDEX IF NOT EXISTS idx_tx_ledger_utr ON transactions_ledger(utr_number);
      CREATE INDEX IF NOT EXISTS idx_tx_ledger_status ON transactions_ledger(status);

      CREATE TABLE IF NOT EXISTS settled_recharge_guards (
        guard_key TEXT PRIMARY KEY,
        tx_id TEXT NOT NULL,
        user_id TEXT,
        utr_number TEXT,
        status TEXT NOT NULL,
        amount REAL DEFAULT 0,
        settled_at TEXT NOT NULL
      );
    `);
    initialized = true;

    // Seed from transactions_backup.json if transactions_ledger is empty
    try {
      const countRow = db.prepare('SELECT COUNT(*) as cnt FROM transactions_ledger').get() as any;
      if ((countRow?.cnt || 0) === 0 && fs.existsSync(TRANSACTIONS_BACKUP_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(TRANSACTIONS_BACKUP_PATH, 'utf-8'));
        if (Array.isArray(parsed)) {
          for (const tx of parsed) {
            if (tx && (tx.id || tx.referenceNo)) {
              upsertTransactionInSql(tx);
              if (tx.type === 'recharge' && (tx.status === 'completed' || tx.status === 'rejected')) {
                const keys = buildRechargeGuardKeys(tx);
                markRechargeSettledInSql(keys, {
                  txId: String(tx.id || tx.referenceNo),
                  userId: String(tx.userId || ''),
                  utrNumber: String(tx.utrNumber || tx.referenceNo || ''),
                  status: tx.status,
                  amount: Number(tx.amount || 0),
                });
              }
            }
          }
        }
      }
    } catch {}
  }
}

export function buildRechargeGuardKeys(params: {
  id?: any;
  txId?: any;
  sqlId?: any;
  referenceNo?: any;
  originalReferenceNo?: any;
  utrNumber?: any;
  userId?: any;
}): string[] {
  const keys = new Set<string>();
  const addKey = (prefix: string, val: any) => {
    if (val === undefined || val === null) return;
    const s = String(val).trim();
    if (s) keys.add(`${prefix}:${s}`);
  };
  addKey('id', params.id);
  addKey('id', params.txId);
  addKey('sql', params.sqlId);
  addKey('ref', params.referenceNo);
  addKey('ref', params.originalReferenceNo);
  addKey('utr', params.utrNumber);

  const uId = String(params.userId || '').trim();
  const utr = String(params.utrNumber || params.originalReferenceNo || params.referenceNo || '').trim();
  if (uId && utr && utr.length >= 6) {
    keys.add(`user_utr:${uId}:${utr}`);
  }
  return Array.from(keys);
}

export function upsertTransactionInSql(tx: any): any {
  if (!tx) return null;
  initSqliteTransactionsTable();
  const db = getSqliteDb();

  const rawId = String(tx.id || tx.referenceNo || `tx-${tx.createdAt || Date.now()}`).trim();
  const rawSqlId = tx.sqlId && isNumericOnly(tx.sqlId) ? Number(tx.sqlId) : null;
  const rawRef = tx.referenceNo ? String(tx.referenceNo).trim() : '';
  const rawUtr = tx.utrNumber ? String(tx.utrNumber).trim() : '';
  const cleanUserId = String(tx.userId || '').trim();

  // Look for existing record by id, sql_id, reference_no, or utr_number
  let existingRow: any = db.prepare('SELECT raw_json FROM transactions_ledger WHERE id = ?').get(rawId);
  if (!existingRow && rawRef) {
    existingRow = db.prepare('SELECT raw_json FROM transactions_ledger WHERE reference_no = ? OR utr_number = ? LIMIT 1').get(rawRef, rawRef);
  }
  if (!existingRow && rawUtr) {
    existingRow = db.prepare('SELECT raw_json FROM transactions_ledger WHERE utr_number = ? OR reference_no = ? LIMIT 1').get(rawUtr, rawUtr);
  }
  if (!existingRow && rawSqlId) {
    existingRow = db.prepare('SELECT raw_json FROM transactions_ledger WHERE sql_id = ? LIMIT 1').get(rawSqlId);
  }

  let existingParsed: any = null;
  if (existingRow?.raw_json) {
    try {
      existingParsed = JSON.parse(existingRow.raw_json);
    } catch {}
  }

  const merged = mergeTxRecords(existingParsed, { ...tx, id: existingParsed?.id && !isNumericOnly(existingParsed.id) ? existingParsed.id : rawId });
  const canonicalId = String(merged.id || rawId).trim();
  const canonicalSqlId = merged.sqlId && isNumericOnly(merged.sqlId) ? Number(merged.sqlId) : rawSqlId;
  const canonicalStatus = String(merged.status || 'completed').trim();
  const canonicalRef = String(merged.referenceNo || rawRef || canonicalId).trim();
  const canonicalUtr = String(merged.utrNumber || rawUtr || '').trim();
  const createdAtNum = Number(merged.createdAt) || Date.now();
  const updatedAtIso = String(merged.updatedAt || new Date().toISOString());

  merged.id = canonicalId;
  if (canonicalSqlId) merged.sqlId = canonicalSqlId;
  merged.status = canonicalStatus;
  merged.referenceNo = canonicalRef;
  if (canonicalUtr) merged.utrNumber = canonicalUtr;
  merged.createdAt = createdAtNum;
  merged.updatedAt = updatedAtIso;

  db.prepare(`
    INSERT INTO transactions_ledger (
      id, sql_id, user_id, type, amount, status, reference_no, utr_number, created_at, updated_at, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sql_id = COALESCE(excluded.sql_id, transactions_ledger.sql_id),
      user_id = COALESCE(NULLIF(excluded.user_id, ''), transactions_ledger.user_id),
      type = excluded.type,
      amount = excluded.amount,
      status = CASE
        WHEN transactions_ledger.status IN ('completed', 'rejected') THEN transactions_ledger.status
        ELSE excluded.status
      END,
      reference_no = COALESCE(NULLIF(excluded.reference_no, ''), transactions_ledger.reference_no),
      utr_number = COALESCE(NULLIF(excluded.utr_number, ''), transactions_ledger.utr_number),
      created_at = CASE
        WHEN transactions_ledger.created_at > 0 THEN transactions_ledger.created_at
        ELSE excluded.created_at
      END,
      updated_at = excluded.updated_at,
      raw_json = excluded.raw_json
  `).run(
    canonicalId,
    canonicalSqlId,
    cleanUserId,
    String(merged.type || 'recharge'),
    Number(merged.amount) || 0,
    canonicalStatus,
    canonicalRef,
    canonicalUtr || null,
    createdAtNum,
    updatedAtIso,
    JSON.stringify(merged)
  );

  return merged;
}

export function getAllTransactionsFromSql(): any[] {
  initSqliteTransactionsTable();
  const db = getSqliteDb();
  const rows = db.prepare('SELECT raw_json FROM transactions_ledger ORDER BY created_at DESC').all() as any[];
  const out: any[] = [];
  for (const r of rows) {
    try {
      if (r?.raw_json) out.push(JSON.parse(r.raw_json));
    } catch {}
  }
  return out;
}

export function getTransactionsForUserFromSql(userId: string): any[] {
  initSqliteTransactionsTable();
  const db = getSqliteDb();
  const cleanId = String(userId || '').trim();
  const rows = db
    .prepare('SELECT raw_json FROM transactions_ledger WHERE user_id = ? ORDER BY created_at DESC')
    .all(cleanId) as any[];
  const out: any[] = [];
  for (const r of rows) {
    try {
      if (r?.raw_json) out.push(JSON.parse(r.raw_json));
    } catch {}
  }
  return out;
}

export function findTransactionsInSqlByIdentifiers(identifiers: string[]): any[] {
  initSqliteTransactionsTable();
  const db = getSqliteDb();
  const cleanList = Array.from(
    new Set(identifiers.map((x) => (x !== undefined && x !== null ? String(x).trim() : '')).filter(Boolean))
  );
  if (cleanList.length === 0) return [];

  const matchedMap = new Map<string, any>();
  const stmtText = db.prepare(
    'SELECT raw_json FROM transactions_ledger WHERE id = ? OR reference_no = ? OR utr_number = ?'
  );
  const stmtNum = db.prepare('SELECT raw_json FROM transactions_ledger WHERE sql_id = ?');

  for (const clean of cleanList) {
    const rows = stmtText.all(clean, clean, clean) as any[];
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.raw_json);
        if (parsed?.id) matchedMap.set(String(parsed.id), parsed);
      } catch {}
    }
    if (isNumericOnly(clean)) {
      const numRows = stmtNum.all(Number(clean)) as any[];
      for (const r of numRows) {
        try {
          const parsed = JSON.parse(r.raw_json);
          if (parsed?.id) matchedMap.set(String(parsed.id), parsed);
        } catch {}
      }
    }
  }
  return Array.from(matchedMap.values());
}

export function findSettledRechargeGuard(guardKeys: string[]): any | null {
  initSqliteTransactionsTable();
  const db = getSqliteDb();
  const cleanKeys = Array.from(new Set(guardKeys.map((k) => String(k || '').trim()).filter(Boolean)));
  if (cleanKeys.length === 0) return null;

  const stmtGuard = db.prepare('SELECT * FROM settled_recharge_guards WHERE guard_key = ? LIMIT 1');
  for (const key of cleanKeys) {
    const row = stmtGuard.get(key) as any;
    if (row) {
      return row;
    }
  }
  return null;
}

export function markRechargeSettledInSql(
  guardKeys: string[],
  info: {
    txId: string;
    userId?: string;
    utrNumber?: string;
    status: 'completed' | 'rejected';
    amount: number;
    txRecord?: any;
  }
): any {
  initSqliteTransactionsTable();
  const db = getSqliteDb();
  const nowIso = new Date().toISOString();

  let savedTx: any = null;
  db.exec('BEGIN IMMEDIATE');
  try {
    const stmtInsertGuard = db.prepare(`
      INSERT INTO settled_recharge_guards (guard_key, tx_id, user_id, utr_number, status, amount, settled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guard_key) DO NOTHING
    `);
    for (const k of guardKeys) {
      if (k) {
        stmtInsertGuard.run(
          k,
          info.txId,
          info.userId || null,
          info.utrNumber || null,
          info.status,
          Number(info.amount) || 0,
          nowIso
        );
      }
    }

    if (info.txRecord) {
      savedTx = upsertTransactionInSql({
        ...info.txRecord,
        status: info.status,
        updatedAt: nowIso,
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw err;
  }

  return savedTx;
}

export function updateTransactionStatusInSql(
  identifiers: string[],
  status: string,
  extra?: {
    utrNumber?: string;
    paymentMethod?: string;
    rejectReason?: string;
    balanceAfter?: number;
    rechargeBalanceAfter?: number;
    withdrawalBalanceAfter?: number;
  }
): any[] {
  const matched = findTransactionsInSqlByIdentifiers(identifiers);
  const updatedList: any[] = [];
  const nowIso = new Date().toISOString();
  for (const m of matched) {
    const updated = upsertTransactionInSql({
      ...m,
      status,
      ...(extra?.utrNumber ? { utrNumber: extra.utrNumber } : {}),
      ...(extra?.paymentMethod ? { paymentMethod: extra.paymentMethod } : {}),
      ...(extra?.rejectReason ? { rejectReason: extra.rejectReason } : {}),
      ...(extra?.balanceAfter !== undefined ? { balanceAfter: extra.balanceAfter } : {}),
      ...(extra?.rechargeBalanceAfter !== undefined ? { rechargeBalanceAfter: extra.rechargeBalanceAfter } : {}),
      ...(extra?.withdrawalBalanceAfter !== undefined ? { withdrawalBalanceAfter: extra.withdrawalBalanceAfter } : {}),
      updatedAt: nowIso,
    });
    if (updated) updatedList.push(updated);
  }
  return updatedList;
}

export function deleteTransactionInSql(txId: string): void {
  initSqliteTransactionsTable();
  const db = getSqliteDb();
  const cleanId = String(txId || '').trim();
  if (!cleanId) return;
  db.prepare('DELETE FROM transactions_ledger WHERE id = ? OR reference_no = ? OR utr_number = ?').run(
    cleanId,
    cleanId,
    cleanId
  );
  if (isNumericOnly(cleanId)) {
    db.prepare('DELETE FROM transactions_ledger WHERE sql_id = ?').run(Number(cleanId));
  }
}

export function purgeAllTransactionsFromSql(): void {
  initSqliteTransactionsTable();
  const db = getSqliteDb();
  db.exec('DELETE FROM transactions_ledger; DELETE FROM settled_recharge_guards;');
}
