import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Transaction, InvestmentOrder, PlatformSettings, InvestmentProduct, NoticeItem, CustomPromoCode, TeamMember, ReferrerInfo, P2PRecipientPreview } from '../types';

export const isProductionHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'nexatrad.site' ||
    host === 'www.nexatrad.site' ||
    host.endsWith('onrender.com') ||
    (!host.includes('localhost') &&
      !host.includes('127.0.0.1') &&
      !host.includes('asia-east1.run.app') &&
      !host.includes('aistudio') &&
      !host.includes('webcontainer'))
  );
};

export const getTransactionTime = (tx: Transaction): number => {
  if (typeof tx.createdAt === 'number' && !isNaN(tx.createdAt) && tx.createdAt > 0) {
    return tx.createdAt;
  }
  if (tx.id && tx.id.startsWith('tx-')) {
    const num = parseInt(tx.id.replace('tx-', ''), 10);
    if (!isNaN(num) && num > 1600000000000) return num;
  }
  if (tx.timestamp) {
    const parsed = Date.parse(tx.timestamp);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
};

const getTxStatusRank = (status: any): number => {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'completed' || s === 'rejected') return 3;
  if (s === 'processing') return 1;
  return 0;
};

const isNumericOnlyId = (val: any): boolean =>
  val !== undefined && val !== null && /^\d+$/.test(String(val).trim());

export const mergeTransactionSafe = (existing: Transaction | undefined | null, incoming: Transaction): Transaction => {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingRank = getTxStatusRank(existing.status);
  const incomingRank = getTxStatusRank(incoming.status);

  const merged: any = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null && v !== '') {
      merged[k] = v;
    }
  }

  // Never let a numeric SQL serial ID overwrite a canonical string ID ("tx-...")
  const exId = existing.id ? String(existing.id).trim() : '';
  const inId = incoming.id ? String(incoming.id).trim() : '';
  if (exId && !isNumericOnlyId(exId)) {
    merged.id = exId;
    if (isNumericOnlyId(inId)) merged.sqlId = Number(inId);
  } else if (inId && !isNumericOnlyId(inId)) {
    merged.id = inId;
    if (isNumericOnlyId(exId)) merged.sqlId = Number(exId);
  } else {
    merged.id = exId || inId;
  }
  if ((existing as any).sqlId && !merged.sqlId) merged.sqlId = (existing as any).sqlId;

  // Terminal status dominance: once 'completed' or 'rejected', NEVER downgrade back to 'processing'
  if (existingRank > incomingRank) {
    merged.status = existing.status;
    if (existing.utrNumber) merged.utrNumber = existing.utrNumber;
    if (existing.adminNote) merged.adminNote = existing.adminNote;
    if ((existing as any).rejectReason) merged.rejectReason = (existing as any).rejectReason;
    if ((existing as any).updatedAt) merged.updatedAt = (existing as any).updatedAt;
    if (existing.balanceAfter !== undefined) merged.balanceAfter = existing.balanceAfter;
    if (existing.rechargeBalanceAfter !== undefined) merged.rechargeBalanceAfter = existing.rechargeBalanceAfter;
    if (existing.withdrawalBalanceAfter !== undefined) merged.withdrawalBalanceAfter = existing.withdrawalBalanceAfter;
  } else if (!merged.utrNumber && existing.utrNumber) {
    merged.utrNumber = existing.utrNumber;
  }

  // Keep WTH.../REC... stable referenceNo and preserve UTR in utrNumber
  const exRef = String(existing.referenceNo || '').trim();
  const inRef = String(incoming.referenceNo || '').trim();
  if (exRef.startsWith('WTH') && inRef.startsWith('UTR')) {
    merged.referenceNo = exRef;
    if (!merged.utrNumber) merged.utrNumber = inRef;
  } else if (inRef.startsWith('WTH') && exRef.startsWith('UTR')) {
    merged.referenceNo = inRef;
    if (!merged.utrNumber) merged.utrNumber = exRef;
  }

  return merged as Transaction;
};

export const computeUserTotalBalance = (u?: Partial<User> | null): number => {
  if (!u) return 0;
  return Number(((Number(u.rechargeBalance) || 0) + (Number(u.withdrawalBalance) || 0)).toFixed(2));
};

export const buildUserBalanceSnapshot = (
  u?: Partial<User> | null
): { balanceAfter: number; rechargeBalanceAfter: number; withdrawalBalanceAfter: number } | undefined => {
  if (!u) return undefined;
  const r = Number((Number(u.rechargeBalance) || 0).toFixed(2));
  const w = Number((Number(u.withdrawalBalance) || 0).toFixed(2));
  return {
    balanceAfter: Number((r + w).toFixed(2)),
    rechargeBalanceAfter: r,
    withdrawalBalanceAfter: w,
  };
};

const getTransactionWalletDelta = (tx: Transaction): number => {
  const amt = Number(tx.amount) || 0;
  if (tx.status === 'rejected' || amt === 0) return 0;
  if (tx.type === 'withdraw' || tx.type === 'p2p_send') {
    return -Math.abs(amt);
  }
  if (tx.type === 'recharge') {
    if (amt < 0) return amt;
    if (tx.status === 'processing') return 0;
    return Math.abs(amt);
  }
  if (String(tx.title || '').startsWith('Admin Debit:')) {
    return -Math.abs(amt);
  }
  if (tx.status === 'processing') return 0;
  return Math.abs(amt);
};

export const enrichTransactionsWithBalanceAfter = (
  txs: Transaction[],
  currentUser?: Partial<User> | null
): Transaction[] => {
  if (!Array.isArray(txs) || txs.length === 0) return [];
  const sorted = [...txs].sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
  let runningTotal: number | null = currentUser ? computeUserTotalBalance(currentUser) : null;

  return sorted.map((tx) => {
    const delta = getTransactionWalletDelta(tx);
    const hasStored =
      tx.balanceAfter !== undefined &&
      tx.balanceAfter !== null &&
      Number.isFinite(Number(tx.balanceAfter));

    if (hasStored) {
      const storedTotal = Number(Number(tx.balanceAfter).toFixed(2));
      runningTotal = Math.max(0, Number((storedTotal - delta).toFixed(2)));
      return { ...tx, balanceAfter: storedTotal };
    }

    if (runningTotal !== null) {
      const computedBal = Math.max(0, Number(runningTotal.toFixed(2)));
      runningTotal = Math.max(0, Number((runningTotal - delta).toFixed(2)));
      return { ...tx, balanceAfter: computedBal };
    }

    return tx;
  });
};

export const mergeTxListsSafe = (lists: Transaction[][]): Transaction[] => {
  const mapById = new Map<string, Transaction>();
  const keyLookup = new Map<string, string>();

  for (const list of lists) {
    for (const t of list) {
      if (!t) continue;
      const rawId = String(t.id || (t as any)._id || `tx-${t.createdAt || Date.now()}`).trim();
      const rawSqlId = (t as any).sqlId ? String((t as any).sqlId).trim() : '';
      const rawRef = t.referenceNo ? String(t.referenceNo).trim() : '';
      const withdrawBucket =
        t.type === 'withdraw' && t.userId
          ? `w:${String(t.userId).trim()}_${Number(t.amount || 0).toFixed(2)}_${Math.floor(getTransactionTime(t) / 45000)}`
          : '';

      const targetId =
        (rawRef && keyLookup.get(`ref:${rawRef}`)) ||
        keyLookup.get(`id:${rawId}`) ||
        (rawSqlId && keyLookup.get(`id:${rawSqlId}`)) ||
        (withdrawBucket && keyLookup.get(withdrawBucket)) ||
        rawId;

      const merged = mergeTransactionSafe(mapById.get(targetId), { ...t, id: targetId });
      // Ensure canonical non-numeric ID is reflected as the map key if available
      const finalId = merged.id || targetId;
      if (finalId !== targetId && mapById.has(targetId)) {
        mapById.delete(targetId);
      }
      mapById.set(finalId, { ...merged, id: finalId });

      keyLookup.set(`id:${rawId}`, finalId);
      keyLookup.set(`id:${finalId}`, finalId);
      if (rawSqlId) keyLookup.set(`id:${rawSqlId}`, finalId);
      if (rawRef) keyLookup.set(`ref:${rawRef}`, finalId);
      if (merged.referenceNo) keyLookup.set(`ref:${String(merged.referenceNo).trim()}`, finalId);
      if (withdrawBucket) keyLookup.set(withdrawBucket, finalId);
    }
  }

  return Array.from(mapById.values()).sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
};

const parseTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? 0 : ms;
};

export const mergeUserSafe = (existing: Partial<User> | undefined | null, incoming: Partial<User>): User => {
  const base: any = { ...(existing || {}) };
  const isAuthIncoming = Boolean((incoming as any)?.isAuthoritativeServer);
  const existingTs = parseTimestampMs(existing?.updatedAt);
  const incomingTs = parseTimestampMs(incoming?.updatedAt);
  const existingStrictlyNewer =
    !isAuthIncoming &&
    existingTs > 0 &&
    incomingTs > 0 &&
    existingTs > incomingTs + 1000;
  const incomingIsNewerOrEqual =
    isAuthIncoming ||
    (incomingTs > 0 && (existingTs === 0 || incomingTs >= existingTs)) ||
    (Boolean((incoming as any).isExplicitZeroReset) && (incomingTs === 0 || existingTs === 0 || incomingTs >= existingTs - 1000));

  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'isAuthoritativeServer') continue;
    if (['rechargeBalance', 'withdrawalBalance', 'productRevenue', 'totalInvested', 'vipLevel', 'spinChances', 'totalReferrals', 'totalCommissionEarned', 'checkInStreak'].includes(k)) {
      const existingNum = Number(base[k]) || 0;
      const incomingNum = Number(v) || 0;

      if (base[k] !== undefined && (v === null || v === undefined || Number.isNaN(Number(v)))) {
        continue;
      }

      if (existingStrictlyNewer) {
        continue;
      }

      if (existingNum > 0 && incomingNum === 0 && !incomingIsNewerOrEqual) {
        continue;
      }
    }

    if (v !== undefined && v !== null && v !== '') {
      if (k === 'bankDetails' && typeof v === 'object') {
        const existingBank = base.bankDetails || {};
        base.bankDetails = {
          accountHolder: (v as any).accountHolder?.trim() || existingBank.accountHolder || '',
          bankName: (v as any).bankName?.trim() || existingBank.bankName || 'Bank IMPS',
          accountNumber: (v as any).accountNumber?.trim() || existingBank.accountNumber || '',
          ifscCode: ((v as any).ifscCode?.trim() || existingBank.ifscCode || '').toUpperCase(),
          upiId: (v as any).upiId?.trim() || existingBank.upiId || '',
        };
      } else {
        base[k] = v;
      }
    } else if (((v as any) === 0 || (v as any) === false) && typeof v === typeof base[k]) {
      if (['rechargeBalance', 'withdrawalBalance', 'productRevenue', 'totalInvested', 'totalCommissionEarned'].includes(k)) {
        if ((Number(base[k]) || 0) > 0 && !incomingIsNewerOrEqual) {
          continue;
        }
      }
      base[k] = v;
    }
  }

  // CRITICAL: Preserve existing bank details if incoming is missing or has blank account
  if (existing?.bankDetails && (!base.bankDetails || (!base.bankDetails.accountNumber && !base.bankDetails.upiId))) {
    base.bankDetails = { ...existing.bankDetails };
  }

  // Never lose invitationCode, invitedBy, inviterName, inviterId
  if (!base.invitationCode && existing?.invitationCode) base.invitationCode = existing.invitationCode;
  if (!base.invitedBy && existing?.invitedBy) base.invitedBy = existing.invitedBy;
  if (!base.inviterName && existing?.inviterName) base.inviterName = existing.inviterName;
  if (!base.inviterId && existing?.inviterId) base.inviterId = existing.inviterId;

  // CRITICAL: Cleanse old Ravi Sahu dummy reference (R34VZ / 852539) to real Ravi Sahu (J9Y79 / 325697)
  if (
    base.invitedBy === 'R34VZ' ||
    base.inviterId === '852539' ||
    (base.inviterName && String(base.inviterName).trim().toLowerCase() === 'ravisahu')
  ) {
    base.invitedBy = 'J9Y79';
    base.inviterName = 'Ravi Sahu';
    base.inviterId = '325697';
  }

  // CRITICAL: Cleanse old Anshusahu reference (EYAYY) to real Anshusahu (AAWFK / 406332)
  if (
    base.invitedBy === 'EYAYY' ||
    (base.inviterName && String(base.inviterName).trim().toLowerCase().includes('anshu') && (base.inviterId === '406332' || !base.inviterId))
  ) {
    base.invitedBy = 'AAWFK';
    base.inviterName = 'Anshusahu';
    base.inviterId = '406332';
  }

  base.totalReferrals = Math.max(Number(base.totalReferrals) || 0, Number(existing?.totalReferrals) || 0);
  if (isAuthIncoming || ((incoming as any).isExplicitZeroReset && !existingStrictlyNewer)) {
    base.totalCommissionEarned = Number(incoming.totalCommissionEarned ?? base.totalCommissionEarned) || 0;
  } else if (!existingStrictlyNewer) {
    base.totalCommissionEarned = Math.max(Number(existing?.totalCommissionEarned) || 0, Number(base.totalCommissionEarned) || 0);
  }

  if (incoming.password && String(incoming.password).trim().length > 0) {
    base.password = String(incoming.password).trim();
  } else if (existing?.password && String(existing.password).trim().length > 0) {
    base.password = String(existing.password).trim();
  } else if (!base.password) {
    base.password = 'password123';
  }
  if (!base.createdAt) {
    base.createdAt = existing?.createdAt || incoming?.createdAt || new Date().toISOString();
  }
  if (existingTs > incomingTs && !isAuthIncoming) {
    base.updatedAt = existing?.updatedAt || new Date().toISOString();
  } else {
    base.updatedAt = incoming?.updatedAt || existing?.updatedAt || new Date().toISOString();
  }
  delete base.isAuthoritativeServer;
  return base as User;
};

export const dbService = {
  // Backup & Permanent SQLite SQL Synchronization
  async syncUsersToBackup(users: User[], forceSave: boolean = false): Promise<User[]> {
    if (forceSave) {
      users.forEach((u) => {
        if (u) this.removeDeletedUserFromBlacklist(u.id, u.phone);
      });
    }
    const deletedBlacklist = this.getDeletedUserBlacklist();
    // Strictly filter out any deleted/blacklisted users and cleanse old Ravi Sahu references
    const cleanInput = users.filter((u) => {
      if (!u) return false;
      const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      const rawId = String(u.id || cleanPhone).trim();
      return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
    }).map((u) => {
      if (
        u.invitedBy === 'R34VZ' ||
        u.inviterId === '852539' ||
        (u.inviterName && String(u.inviterName).trim().toLowerCase() === 'ravisahu')
      ) {
        return {
          ...u,
          invitedBy: 'J9Y79',
          inviterName: 'Ravi Sahu',
          inviterId: '325697',
        };
      }
      if (
        u.invitedBy === 'EYAYY' ||
        (u.inviterName && String(u.inviterName).trim().toLowerCase().includes('anshu') && (u.inviterId === '406332' || !u.inviterId))
      ) {
        return {
          ...u,
          invitedBy: 'AAWFK',
          inviterName: 'Anshusahu',
          inviterId: '406332',
        };
      }
      return u;
    });

    let mergedList: User[] = [...cleanInput];
    try {
      if (typeof window !== 'undefined') {
        const existing = localStorage.getItem('nexa_users_backup_v2');
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            if (Array.isArray(parsed)) {
              const byId = new Map<string, User>();
              const phoneToId = new Map<string, string>();
              const addRecord = (u: User) => {
                if (!u || (!u.id && !u.phone)) return;
                const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
                const rawId = String(u.id || cleanPhone).trim();
                if (deletedBlacklist.has(rawId) || (cleanPhone && deletedBlacklist.has(cleanPhone))) {
                  return; // Blacklisted: NEVER resurrect!
                }
                const canonicalId = (cleanPhone && phoneToId.get(cleanPhone)) || rawId;
                const prev = byId.get(canonicalId);
                const merged = mergeUserSafe(prev, { ...u, id: canonicalId });
                byId.set(canonicalId, merged);
                if (cleanPhone) phoneToId.set(cleanPhone, canonicalId);
              };
              parsed.forEach(addRecord);
              cleanInput.forEach(addRecord);
              mergedList = Array.from(byId.values());
            }
          } catch {}
        }
        localStorage.setItem('nexa_users_backup_v2', JSON.stringify(mergedList));
      }
      // CRITICAL: Only upload the specific cleanInput user(s) to the server, NEVER re-upload stale cached records of other users from localStorage!
      if (cleanInput.length > 0) {
        const res = await fetch('/api/backup/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: cleanInput, forceSave, isNewRegistration: forceSave }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.users && Array.isArray(data.users) && typeof window !== 'undefined') {
            const cleanServerUsers = data.users.filter((u: User) => {
              const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
              const rawId = String(u.id || cleanPhone).trim();
              return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
            });
            localStorage.setItem('nexa_users_backup_v2', JSON.stringify(cleanServerUsers));
            return cleanServerUsers as User[];
          }
        }
      }
    } catch (e) {
      console.warn('Sync users to backend warning:', e);
    }
    return mergedList;
  },

  async getUsersFromBackup(): Promise<User[]> {
    const deletedBlacklist = this.getDeletedUserBlacklist();
    // 1. Primary: Server SQLite SQL + permanent backup endpoint
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/users');
        if (res.ok) {
          const json = await res.json();
          if (json.users && Array.isArray(json.users) && json.users.length > 0) {
            const cleanUsers = json.users.filter((u: User) => {
              const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
              const rawId = String(u.id || cleanPhone).trim();
              return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
            });
            localStorage.setItem('nexa_users_backup_v2', JSON.stringify(cleanUsers));
            return cleanUsers as User[];
          }
        }
      }
    } catch (e) {}

    // 2. Secondary: localStorage backup fallback
    try {
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('nexa_users_backup_v2');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((u: User) => {
              const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
              const rawId = String(u.id || cleanPhone).trim();
              return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
            });
          }
        }
      }
    } catch (e) {}

    return [];
  },

  // Save or update user permanently in SQLite SQL & persistent backup & Firestore
  async saveUser(user: User, forceSave: boolean = true): Promise<void> {
    const path = `users/${user.id}`;
    const hasExplicitZero =
      user.isExplicitZeroReset === true ||
      user.rechargeBalance === 0 ||
      user.withdrawalBalance === 0;
    const stampedUser: User = {
      ...user,
      isExplicitZeroReset: hasExplicitZero,
      updatedAt: new Date().toISOString(),
    };
    delete (stampedUser as any).isAuthoritativeServer;
    // Ensure we merge with any existing record so password/bankDetails/etc. are never lost
    let completeUser = { ...stampedUser };
    try {
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('nexa_users_backup_v2');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            const cleanPhone = stampedUser.phone ? String(stampedUser.phone).replace(/\D/g, '').slice(-10) : '';
            const existing = parsed.find(
              (u: any) => u.id === stampedUser.id || (cleanPhone && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)
            );
            if (existing) {
              completeUser = mergeUserSafe(existing, stampedUser);
              if (stampedUser.rechargeBalance !== undefined) completeUser.rechargeBalance = stampedUser.rechargeBalance;
              if (stampedUser.withdrawalBalance !== undefined) completeUser.withdrawalBalance = stampedUser.withdrawalBalance;
              if (stampedUser.totalInvested !== undefined) completeUser.totalInvested = stampedUser.totalInvested;
              if (stampedUser.productRevenue !== undefined) completeUser.productRevenue = stampedUser.productRevenue;
              if (stampedUser.totalCommissionEarned !== undefined) completeUser.totalCommissionEarned = stampedUser.totalCommissionEarned;
              if (stampedUser.spinChances !== undefined) completeUser.spinChances = stampedUser.spinChances;
              completeUser.isExplicitZeroReset = stampedUser.isExplicitZeroReset;
              completeUser.updatedAt = stampedUser.updatedAt;
            }
          }
        }
      }
    } catch {}

    // 1. Call dedicated /api/user/save endpoint for single-user SQLite WAL commitment
    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/user/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: completeUser }),
        });
      }
    } catch (apiErr) {
      console.warn('API user save warning:', apiErr);
    }

    // 2. Sync only this specific user into backup (never re-uploading unrelated cached users)
    await this.syncUsersToBackup([completeUser], forceSave);

    // 3. Firestore cloud sync (isolated to dev sandbox, never pollute or leak with production)
    if (!isProductionHost()) {
      try {
        await setDoc(doc(db, 'users', completeUser.id), {
          ...completeUser,
          updatedAt: completeUser.updatedAt || new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  // Dedicated permanent bank details save to SQLite SQL
  async saveUserBankDetails(userId: string, phone: string, bankDetails: any): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/user/bank-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, phone, bankDetails }),
        });
      }
    } catch (err) {
      console.warn('Backend bank-details save warning:', err);
    }

    if (!isProductionHost()) {
      try {
        await setDoc(doc(db, 'users', userId), {
          bankDetails,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.WRITE, `users/${userId}`);
      }
    }
  },

  // Get user permanently: Direct SQLite SQL lookup first, then Firestore
  async getUser(userId: string): Promise<User | null> {
    const cleanId = String(userId).trim();
    const cleanPhone = cleanId.replace(/\D/g, '').slice(-10);

    // 1. Direct SQLite server endpoint (Authoritative, Instant & Complete)
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch(`/api/user/${encodeURIComponent(cleanId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.user) {
            return json.user as User;
          }
        }
      }
    } catch (sqlErr) {
      console.warn('Direct SQL user lookup notice:', sqlErr);
    }

    // 2. Fetch from persistent backup cache
    const backupUsers = await this.getUsersFromBackup();
    const backupMatch = backupUsers.find(
      (u) => u.id === cleanId || u.phone === cleanId || (cleanPhone.length === 10 && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)
    );

    // In production, return SQL match directly without touching dev Firestore
    if (isProductionHost()) {
      return backupMatch || null;
    }

    // 3. Also check Firestore only if SQLite/backup didn't have the user (Dev sandbox only)
    const path = `users/${backupMatch?.id || cleanId}`;
    try {
      const snap = await getDoc(doc(db, 'users', backupMatch?.id || cleanId));
      if (snap.exists()) {
        const fsUser = snap.data() as User;
        if (!backupMatch) {
          return fsUser;
        }
        const merged = mergeUserSafe(fsUser, backupMatch);
        return merged;
      }
    } catch (error) {
      if (!backupMatch) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
    return backupMatch || null;
  },

  // Real-time listener for user state
  subscribeToUser(userId: string, onUpdate: (user: User) => void): () => void {
    if (isProductionHost()) {
      let active = true;
      const poll = async () => {
        if (!active || !userId) return;
        try {
          const u = await this.getUser(userId);
          if (u && active) {
            onUpdate(u);
          }
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 10000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const path = `users/${userId}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists()) {
          const fsUser = snap.data() as User;
          // Always defer to authoritative SQLite/server user so stale Firestore snapshots never resurrect old balances
          this.getUser(userId)
            .then((sqlUser) => {
              if (sqlUser) {
                onUpdate({ ...sqlUser, isAuthoritativeServer: true } as any);
              } else {
                onUpdate(fsUser);
              }
            })
            .catch(() => {
              onUpdate(fsUser);
            });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsubscribe;
  },

  // Admin: Get all users permanently (SQLite authoritative, merged cleanly over Firestore-only extras)
  async getAllUsers(): Promise<User[]> {
    const deletedBlacklist = await this.syncDeletedBlacklistFromServer();
    const backupUsers = await this.getUsersFromBackup();
    const byId = new Map<string, User>();
    const phoneToId = new Map<string, string>();
    const backupIdSet = new Set<string>();

    backupUsers.forEach((u) => {
      if (u?.id) backupIdSet.add(String(u.id).trim());
      if (u?.phone) backupIdSet.add(String(u.phone).replace(/\D/g, '').slice(-10));
    });

    const addOrMerge = (u: User) => {
      if (!u || (!u.id && !u.phone)) return;
      const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      const rawId = String(u.id || cleanPhone).trim();

      if (deletedBlacklist.has(rawId) || (cleanPhone && deletedBlacklist.has(cleanPhone))) {
        return;
      }

      const canonicalId = (cleanPhone && phoneToId.get(cleanPhone)) || rawId;
      const prev = byId.get(canonicalId);
      const merged = mergeUserSafe(prev, { ...u, id: canonicalId });
      byId.set(canonicalId, merged);
      if (cleanPhone) phoneToId.set(cleanPhone, canonicalId);
    };

    const missingFromBackup: User[] = [];
    if (!isProductionHost()) {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        querySnapshot.forEach((d) => {
          const data = d.data() as User;
          const uId = String(data.id || d.id || '').trim();
          const uPhone = data.phone ? String(data.phone).replace(/\D/g, '').slice(-10) : '';

          if (deletedBlacklist.has(uId) || (uPhone && deletedBlacklist.has(uPhone))) {
            deleteDoc(d.ref).catch(() => {});
            return;
          }

          addOrMerge(data);
          if (!backupIdSet.has(uId) && (!uPhone || !backupIdSet.has(uPhone))) {
            missingFromBackup.push(data);
          }
        });
      } catch (error) {
        console.warn('Firestore read throttled/quota-exceeded, using persistent backup:', error);
      }
    }

    // Apply authoritative SQLite backupUsers LAST so SQLite always overrides stale Firestore balances
    backupUsers.forEach((u) => addOrMerge({ ...u, isAuthoritativeServer: true } as any));

    const combined = Array.from(byId.values()).filter((u) => {
      const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      const rawId = String(u.id || cleanPhone).trim();
      return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
    });

    if (missingFromBackup.length > 0) {
      this.syncUsersToBackup(missingFromBackup, false).catch((err) =>
        console.warn('Background backup sync failed:', err)
      );
    }

    if (combined.length > 0) {
      return combined;
    }

    return backupUsers.filter((u) => {
      const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      const rawId = String(u.id || cleanPhone).trim();
      return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
    });
  },

  // User Deletion Blacklist: Ensure deleted accounts can NEVER be restored
  getDeletedUserBlacklist(): Set<string> {
    const set = new Set<string>();
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('nexa_deleted_user_identifiers');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((s) => set.add(String(s).trim()));
          }
        }
      }
    } catch {}
    return set;
  },

  async syncDeletedBlacklistFromServer(): Promise<Set<string>> {
    const set = this.getDeletedUserBlacklist();
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/deleted-identifiers');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.deletedUsers)) {
            data.deletedUsers.forEach((id: string) => set.add(String(id).trim()));
            localStorage.setItem('nexa_deleted_user_identifiers', JSON.stringify(Array.from(set)));
          }
        }
      }
    } catch {}
    return set;
  },

  addDeletedUserToBlacklist(cleanId: string, userPhone?: string): void {
    try {
      if (typeof window !== 'undefined') {
        const set = this.getDeletedUserBlacklist();
        if (cleanId) set.add(cleanId);
        if (userPhone) set.add(userPhone);
        localStorage.setItem('nexa_deleted_user_identifiers', JSON.stringify(Array.from(set)));
      }
    } catch {}
  },

  removeDeletedUserFromBlacklist(cleanId?: string, userPhone?: string): void {
    try {
      if (typeof window !== 'undefined') {
        const set = this.getDeletedUserBlacklist();
        if (cleanId) set.delete(String(cleanId).trim());
        if (userPhone) {
          const cleanP = String(userPhone).replace(/\D/g, '').slice(-10);
          set.delete(cleanP);
        }
        localStorage.setItem('nexa_deleted_user_identifiers', JSON.stringify(Array.from(set)));
      }
    } catch {}
    try {
      if (typeof window !== 'undefined') {
        fetch('/api/unblacklist-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: cleanId, phone: userPhone }),
        }).catch(() => {});
      }
    } catch {}
  },

  // Order Deletion Blacklist: Ensure deleted contracts can NEVER be restored
  getDeletedOrderBlacklist(): Set<string> {
    const set = new Set<string>(['ord-9519036732-001', 'ord-2299']);
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('nexa_deleted_order_identifiers');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((s) => set.add(String(s).trim().toLowerCase()));
          }
        }
      }
    } catch {}
    return set;
  },

  async syncDeletedOrderBlacklistFromServer(): Promise<Set<string>> {
    const set = this.getDeletedOrderBlacklist();
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/deleted-identifiers');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.deletedOrders)) {
            data.deletedOrders.forEach((id: string) => set.add(String(id).trim().toLowerCase()));
            localStorage.setItem('nexa_deleted_order_identifiers', JSON.stringify(Array.from(set)));
          }
        }
      }
    } catch {}
    return set;
  },

  addDeletedOrderToBlacklist(orderId: string): void {
    try {
      if (typeof window !== 'undefined') {
        const set = this.getDeletedOrderBlacklist();
        if (orderId) set.add(String(orderId).trim().toLowerCase());
        localStorage.setItem('nexa_deleted_order_identifiers', JSON.stringify(Array.from(set)));
      }
    } catch {}
  },

  // Real-time listener for all users (for Admin Panel)
  subscribeToAllUsers(onUpdate: (users: User[]) => void): () => void {
    if (isProductionHost()) {
      let active = true;
      const poll = async () => {
        if (!active) return;
        try {
          const list = await this.getAllUsers();
          if (list && list.length > 0 && active) {
            onUpdate(list);
          }
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 12000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const path = 'users';
    try {
      const q = collection(db, 'users');
      // Proactively pull server blacklists on subscribe
      this.syncDeletedBlacklistFromServer().catch(() => {});

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const fsUsers: User[] = [];
          const deletedBlacklist = this.getDeletedUserBlacklist();
          snapshot.forEach((d) => {
            const data = d.data() as User;
            const uId = String(data.id || d.id || '').trim();
            const uPhone = data.phone ? String(data.phone).replace(/\D/g, '').slice(-10) : '';
            if (deletedBlacklist.has(uId) || (uPhone && deletedBlacklist.has(uPhone))) {
              // Delete ghost Firestore document so it never lingers
              deleteDoc(d.ref).catch(() => {});
              return;
            }
            fsUsers.push(data);
          });

          const backupUsers = await this.getUsersFromBackup();
          const backupIdSet = new Set<string>();
          backupUsers.forEach((u) => {
            if (u?.id) backupIdSet.add(String(u.id).trim());
            if (u?.phone) backupIdSet.add(String(u.phone).replace(/\D/g, '').slice(-10));
          });
          const byId = new Map<string, User>();
          const phoneToId = new Map<string, string>();
          const addOrMerge = (u: User) => {
            if (!u || (!u.id && !u.phone)) return;
            const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
            const rawId = String(u.id || cleanPhone).trim();
            if (deletedBlacklist.has(rawId) || (cleanPhone && deletedBlacklist.has(cleanPhone))) {
              return; // Blacklisted: NEVER resurrect!
            }
            const canonicalId = (cleanPhone && phoneToId.get(cleanPhone)) || rawId;
            const prev = byId.get(canonicalId);
            const merged = mergeUserSafe(prev, { ...u, id: canonicalId });
            byId.set(canonicalId, merged);
            if (cleanPhone) phoneToId.set(cleanPhone, canonicalId);
          };
          // Merge Firestore first, then authoritative SQLite backupUsers LAST so stale Firestore docs never overwrite SQLite
          fsUsers.forEach(addOrMerge);
          backupUsers.forEach((u) => addOrMerge({ ...u, isAuthoritativeServer: true } as any));
          const merged = Array.from(byId.values()).filter((u) => {
            const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
            const rawId = String(u.id || cleanPhone).trim();
            return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
          });
          onUpdate(merged);

          const missingFromSql = fsUsers.filter((u) => {
            const rawId = String(u.id || '').trim();
            const cleanP = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
            return rawId && !backupIdSet.has(rawId) && (!cleanP || !backupIdSet.has(cleanP));
          });
          if (missingFromSql.length > 0) {
            this.syncUsersToBackup(missingFromSql, false).catch(() => {});
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
      return unsubscribe;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return () => {};
    }
  },

  // Admin: Update user partial permanently
  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const cleanId = String(userId).trim();
    const hasZeroBalance =
      (data as any).isExplicitZeroReset === true ||
      data.rechargeBalance === 0 ||
      data.withdrawalBalance === 0;
    const payload: Partial<User> = {
      ...data,
      isExplicitZeroReset: hasZeroBalance,
      updatedAt: new Date().toISOString(),
    };

    try {
      const existing = await this.getUser(cleanId);
      const merged: User = mergeUserSafe(existing || { id: cleanId }, payload);
      await this.syncUsersToBackup([merged], true);
    } catch (e) {}

    // Direct HTTP POST to server to immediately update SQLite & disk backup
    try {
      if (typeof window !== 'undefined') {
        await fetch(`/api/admin/user/${cleanId}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (apiErr) {
      console.warn('API /api/admin/user/:userId/update error:', apiErr);
    }

    if (!isProductionHost()) {
      const path = `users/${cleanId}`;
      try {
        await setDoc(doc(db, 'users', cleanId), payload, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  // Admin: Zero all Firestore & localStorage cached user balances after a server-wide balance reset
  async resetAllUsersBalancesInFirestore(): Promise<void> {
    const nowIso = new Date().toISOString();
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('nexa_users_backup_v2');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            const zeroed = parsed.map((u: any) => ({
              ...u,
              rechargeBalance: 0,
              withdrawalBalance: 0,
              productRevenue: 0,
              totalInvested: 0,
              totalCommissionEarned: 0,
              isExplicitZeroReset: true,
              updatedAt: nowIso,
            }));
            localStorage.setItem('nexa_users_backup_v2', JSON.stringify(zeroed));
          }
        }
      } catch {}
    }

    if (isProductionHost()) return;
    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const updates: Promise<void>[] = [];
      querySnapshot.forEach((d) => {
        updates.push(
          setDoc(
            d.ref,
            {
              rechargeBalance: 0,
              withdrawalBalance: 0,
              productRevenue: 0,
              totalInvested: 0,
              totalCommissionEarned: 0,
              isExplicitZeroReset: true,
              updatedAt: nowIso,
            },
            { merge: true }
          )
        );
      });
      await Promise.all(updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Admin: Delete user permanently (Admin-only action - Irreversible with permanent blacklist)
  async deleteUser(userId: string, explicitPhone?: string): Promise<void> {
    const cleanId = String(userId).trim();
    let userPhone = explicitPhone ? String(explicitPhone).replace(/\D/g, '').slice(-10) : '';
    if (!userPhone) {
      try {
        const existing = await this.getUser(cleanId);
        if (existing?.phone) {
          userPhone = String(existing.phone).replace(/\D/g, '').slice(-10);
        }
      } catch {}
    }

    // 1. Blacklist locally so client listeners never restore
    this.addDeletedUserToBlacklist(cleanId, userPhone);

    // 2. Remove from local backup cache
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('nexa_users_backup_v2');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(
              (u: User) =>
                u.id !== cleanId &&
                u.phone !== cleanId &&
                (!userPhone || String(u.phone || '').replace(/\D/g, '').slice(-10) !== userPhone)
            );
            localStorage.setItem('nexa_users_backup_v2', JSON.stringify(updated));
          }
        }
      } catch {}
    }

    // 3. Remove from server permanent storage (SQLite SQL hard delete + users_backup.json purge + Cloud SQL)
    try {
      const url = `/api/admin/users/${encodeURIComponent(cleanId)}${userPhone ? `?phone=${encodeURIComponent(userPhone)}` : ''}`;
      await fetch(url, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('Backend user delete warning:', e);
    }

    // 4. Delete EVERY possible document in Firestore matching user ID or phone
    const candidateDocs = [cleanId];
    if (userPhone) {
      candidateDocs.push(userPhone);
      candidateDocs.push(`usr-${userPhone}`);
      candidateDocs.push(`+91${userPhone}`);
      candidateDocs.push(`+91 ${userPhone}`);
    }

    for (const docId of candidateDocs) {
      try {
        await deleteDoc(doc(db, 'users', docId)).catch(() => {});
      } catch {}
    }

    // Query Firestore collection 'users' to find and delete ANY document where phone or id matches
    try {
      if (userPhone) {
        const qPhone = query(collection(db, 'users'), where('phone', '==', userPhone));
        const snap = await getDocs(qPhone);
        snap.forEach((d) => {
          deleteDoc(d.ref).catch(() => {});
        });
      }
      const qId = query(collection(db, 'users'), where('id', '==', cleanId));
      const snapId = await getDocs(qId);
      snapId.forEach((d) => {
        deleteDoc(d.ref).catch(() => {});
      });
    } catch {}
  },

  // Save transaction to cloud & backend with guaranteed numeric epoch createdAt
  async saveTransaction(tx: Transaction, userId: string): Promise<void> {
    const createdAt = tx.createdAt || (tx.id && tx.id.startsWith('tx-') ? parseInt(tx.id.replace('tx-', ''), 10) : 0) || Date.now();
    const payload: Transaction = {
      ...tx,
      userId,
      createdAt,
    };

    // 1. Sync to Cloud SQL and local backend backup
    try {
      await fetch('/api/cloudsql/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Backend Cloud SQL tx save warning:', e);
    }

    // 2. Sync to Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `transactions/${tx.id}`;
      try {
        await setDoc(doc(db, 'transactions', tx.id), payload, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  // Fetch transactions for user - strictly sorted newest first (Cloud SQL + Firestore)
  async getTransactions(userId: string): Promise<Transaction[]> {
    const cleanId = String(userId).trim();
    let apiList: Transaction[] = [];

    // 1. Fetch from Cloud SQL backend
    try {
      const res = await fetch(`/api/cloudsql/transactions/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.transactions)) {
          apiList = json.transactions;
        }
      }
    } catch (err) {
      console.warn('Could not fetch user transactions from backend:', err);
    }

    if (isProductionHost()) {
      return apiList.sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
    }

    // 2. Fetch from Firestore (Dev sandbox)
    const path = 'transactions';
    let firestoreList: Transaction[] = [];
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', cleanId));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((d) => {
        firestoreList.push(d.data() as Transaction);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }

    // Merge and deduplicate by id, referenceNo, and withdrawal signature with terminal status dominance
    return mergeTxListsSafe([apiList, firestoreList]);
  },

  // Real-time listener for user's transactions
  subscribeToUserTransactions(userId: string, onUpdate: (txs: Transaction[]) => void): () => void {
    if (isProductionHost()) {
      let active = true;
      const poll = async () => {
        if (!active || !userId) return;
        try {
          const list = await this.getTransactions(userId);
          if (list && active) {
            onUpdate(list);
          }
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 10000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const path = 'transactions';
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', userId));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const rawList: Transaction[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Transaction;
            const resolvedId = data.id && !isNumericOnlyId(data.id) ? String(data.id) : d.id || String(data.id);
            rawList.push({ ...data, id: resolvedId });
          });
          onUpdate(mergeTxListsSafe([rawList]));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
      return unsubscribe;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return () => {};
    }
  },

  // Admin: Get all platform transactions (Cloud SQL + Firestore)
  async getAllTransactions(): Promise<Transaction[]> {
    let apiList: Transaction[] = [];

    // 1. Fetch from Cloud SQL & backend backup
    try {
      const res = await fetch('/api/cloudsql/transactions');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.transactions)) {
          apiList = json.transactions;
        }
      }
    } catch (err) {
      console.warn('Could not fetch all transactions from backend:', err);
    }

    if (isProductionHost()) {
      return mergeTxListsSafe([apiList]);
    }

    // 2. Fetch from Firestore (Dev sandbox only)
    const path = 'transactions';
    let firestoreList: Transaction[] = [];
    try {
      const querySnapshot = await getDocs(collection(db, 'transactions'));
      querySnapshot.forEach((d) => {
        const data = d.data() as Transaction;
        const resolvedId = data.id && !isNumericOnlyId(data.id) ? String(data.id) : d.id || String(data.id);
        firestoreList.push({ ...data, id: resolvedId });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }

    // Merge and deduplicate cleanly with terminal status dominance (completed/rejected always beats processing)
    return mergeTxListsSafe([apiList, firestoreList]);
  },

  // Real-time listener for all admin transactions
  subscribeToAllTransactions(onUpdate: (txs: Transaction[]) => void): () => void {
    if (isProductionHost()) {
      let active = true;
      const poll = async () => {
        if (!active) return;
        try {
          const list = await this.getAllTransactions();
          if (list && active) {
            onUpdate(list);
          }
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 12000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const path = 'transactions';
    try {
      const q = collection(db, 'transactions');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const rawList: Transaction[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Transaction;
            const resolvedId = data.id && !isNumericOnlyId(data.id) ? String(data.id) : d.id || String(data.id);
            rawList.push({ ...data, id: resolvedId });
          });
          onUpdate(mergeTxListsSafe([rawList]));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
      return unsubscribe;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return () => {};
    }
  },

  // Admin: Update transaction status (Cloud SQL + ALL matching Firestore documents)
  async updateTransaction(txId: string, data: Partial<Transaction>, originalReferenceNo?: string): Promise<void> {
    const cleanId = String(txId || '').trim();
    const cleanOrigRef = originalReferenceNo ? String(originalReferenceNo).trim() : '';

    // 1. Update in Cloud SQL backend
    try {
      await fetch('/api/cloudsql/transactions/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: cleanId,
          originalReferenceNo: cleanOrigRef || undefined,
          status: data.status,
          referenceNo: data.referenceNo,
          utrNumber: data.utrNumber,
          paymentMethod: data.paymentMethod,
        }),
      });
    } catch (err) {
      console.warn('Backend update transaction status warning:', err);
    }

    // 2. Update ALL matching docs in Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `transactions/${cleanId}`;
      const updatePayload = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      try {
        const docIdsToUpdate = new Set<string>();

        // Query by id and referenceNo so numeric SQL IDs or reference-keyed calls still update the canonical doc ("tx-...")
        const searchQueries = [];
        if (cleanId) {
          searchQueries.push(query(collection(db, 'transactions'), where('id', '==', cleanId)));
          searchQueries.push(query(collection(db, 'transactions'), where('referenceNo', '==', cleanId)));
        }
        if (cleanOrigRef && cleanOrigRef !== cleanId) {
          searchQueries.push(query(collection(db, 'transactions'), where('referenceNo', '==', cleanOrigRef)));
        }

        const snapshots = await Promise.all(searchQueries.map((sq) => getDocs(sq).catch(() => null)));
        for (const snap of snapshots) {
          if (snap) {
            snap.forEach((d) => docIdsToUpdate.add(d.id));
          }
        }

        // Also check direct doc(db, 'transactions', cleanId)
        if (cleanId) {
          const directSnap = await getDoc(doc(db, 'transactions', cleanId)).catch(() => null);
          if (directSnap && directSnap.exists()) {
            docIdsToUpdate.add(cleanId);
          } else if (docIdsToUpdate.size === 0 && !isNumericOnlyId(cleanId)) {
            docIdsToUpdate.add(cleanId);
          }
        }

        await Promise.all(
          Array.from(docIdsToUpdate).map((docId) =>
            setDoc(doc(db, 'transactions', docId), updatePayload, { merge: true })
          )
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  // Delete transaction from Cloud SQL & Firestore
  async deleteTransaction(txId: string): Promise<void> {
    const cleanId = String(txId).trim();
    try {
      if (typeof window !== 'undefined') {
        await fetch(`/api/transactions/${encodeURIComponent(cleanId)}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.warn('Backend delete transaction warning:', e);
    }

    if (!isProductionHost()) {
      const path = `transactions/${cleanId}`;
      try {
        await deleteDoc(doc(db, 'transactions', cleanId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  // Admin: Execute withdrawal action (Approve or Reject with automatic balance refund)
  async adminWithdrawalAction(payload: {
    action: 'approve' | 'reject';
    txId: string;
    referenceNo?: string;
    originalReferenceNo?: string;
    utrNumber?: string;
    sqlId?: number;
    userId?: string;
    amount?: number;
    reason?: string;
  }): Promise<{ success: boolean; message: string; user?: any; alreadyProcessed?: boolean; transaction?: any }> {
    try {
      const res = await fetch('/api/admin/withdrawals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('API adminWithdrawalAction error:', err);
    }
    return { success: false, message: 'Server communication error' };
  },

  // Admin: Execute recharge action (Approve with 1-click balance credit or Reject, with idempotency protection)
  async adminRechargeAction(payload: {
    action: 'approve' | 'reject';
    txId: string;
    originalReferenceNo?: string;
    sqlId?: number;
    userId?: string;
    amount?: number;
    reason?: string;
  }): Promise<{ success: boolean; message: string; user?: any; alreadyProcessed?: boolean; transaction?: any }> {
    try {
      const res = await fetch('/api/admin/recharges/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('API adminRechargeAction error:', err);
    }
    return { success: false, message: 'Server communication error' };
  },

  // Admin: Adjust user balance atomically with anti-double-click token
  async adminAdjustBalance(payload: {
    userId: string;
    wallet: 'rechargeBalance' | 'withdrawalBalance' | 'productRevenue';
    amount: number;
    type: 'add' | 'deduct';
    note?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; message: string; user?: any; transaction?: any; alreadyProcessed?: boolean }> {
    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('API adminAdjustBalance error:', err);
    }
    return { success: false, message: 'Server communication error' };
  },

  // Save investment order to cloud & backend
  async saveOrder(order: InvestmentOrder, userId: string): Promise<{ commissionResult?: any } | void> {
    const payload = { ...order, userId };
    let commissionResult: any = null;
    // 1. Sync to backend API (orders_backup.json + Cloud SQL)
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: payload, userId }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.commissionResult) {
            commissionResult = json.commissionResult;
            if (Array.isArray(commissionResult.credited) && commissionResult.credited.length > 0) {
              await this.syncCommissionCreditedToFirestore(commissionResult.credited).catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      console.warn('Backend order sync warning:', e);
    }

    // 2. Sync to Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `orders/${order.id}`;
      try {
        await setDoc(doc(db, 'orders', order.id), payload, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }

    if (commissionResult) {
      return { commissionResult };
    }
  },

  // Fetch orders for user (Permanently queries SQL backend + Firestore cloud, merges & deduplicates)
  async getOrders(userId: string, userPhone?: string): Promise<InvestmentOrder[]> {
    const cleanId = String(userId || '').trim();
    const cleanPhone = userPhone ? String(userPhone).replace(/\D/g, '').slice(-10) : (cleanId.length === 10 ? cleanId : '');
    const map = new Map<string, InvestmentOrder>();
    const deletedBlacklist = this.getDeletedOrderBlacklist();

    // 1. Fetch from Permanent SQL backend
    try {
      if (typeof window !== 'undefined' && cleanId) {
        const res = await fetch(`/api/orders/user/${encodeURIComponent(cleanId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.orders && Array.isArray(json.orders)) {
            for (const o of json.orders) {
              const strId = String(o?.id || '').trim().toLowerCase();
              if (o && o.id && !deletedBlacklist.has(strId)) map.set(String(o.id), o);
            }
          }
        }

        // Also fetch by phone if cleanPhone is different from cleanId
        if (cleanPhone && cleanPhone !== cleanId) {
          const resPhone = await fetch(`/api/orders/user/${encodeURIComponent(cleanPhone)}`);
          if (resPhone.ok) {
            const jsonP = await resPhone.json();
            if (jsonP.orders && Array.isArray(jsonP.orders)) {
              for (const o of jsonP.orders) {
                const strId = String(o?.id || '').trim().toLowerCase();
                if (o && o.id && !deletedBlacklist.has(strId)) map.set(String(o.id), o);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Backend SQL user orders fetch warning:', e);
    }

    // In production, return SQL orders directly without touching dev Firestore
    if (isProductionHost()) {
      return Array.from(map.values()).sort((a, b) => {
        const timeA = a.purchaseTimestamp || (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0);
        const timeB = b.purchaseTimestamp || (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0);
        return timeB - timeA;
      });
    }

    // 2. Fetch from Firestore (Dev sandbox only)
    const path = 'orders';
    try {
      const q = query(collection(db, 'orders'), where('userId', '==', cleanId));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((d) => {
        const o = d.data() as InvestmentOrder;
        const strId = String(o?.id || d.id || '').trim().toLowerCase();
        if (deletedBlacklist.has(strId)) {
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        if (o && o.id) {
          if (!map.has(String(o.id))) {
            map.set(String(o.id), o);
          }
        }
      });

      if (cleanPhone && cleanPhone !== cleanId) {
        const qPhone = query(collection(db, 'orders'), where('userId', '==', cleanPhone));
        const snapPhone = await getDocs(qPhone);
        snapPhone.forEach((d) => {
          const o = d.data() as InvestmentOrder;
          const strId = String(o?.id || d.id || '').trim().toLowerCase();
          if (deletedBlacklist.has(strId)) {
            deleteDoc(d.ref).catch(() => {});
            return;
          }
          if (o && o.id) {
            if (!map.has(String(o.id))) {
              map.set(String(o.id), o);
            }
          }
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }

    const list = Array.from(map.values()).sort((a, b) => {
      const timeA = a.purchaseTimestamp || (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0);
      const timeB = b.purchaseTimestamp || (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0);
      return timeB - timeA;
    });

    return list;
  },

  // Real-time listener for user's investment orders (syncs Firestore + SQL backend)
  subscribeToUserOrders(
    userId: string,
    onUpdate: (orders: InvestmentOrder[]) => void,
    userPhone?: string
  ): () => void {
    const cleanId = String(userId || '').trim();
    const cleanPhone = userPhone ? String(userPhone).replace(/\D/g, '').slice(-10) : '';
    let isSubscribed = true;

    const fetchAndMerge = async () => {
      if (!isSubscribed || !cleanId) return;
      try {
        const freshOrders = await this.getOrders(cleanId, cleanPhone);
        if (isSubscribed) {
          onUpdate(freshOrders);
        }
      } catch (err) {
        console.warn('Real-time orders sync warning:', err);
      }
    };

    // Initial immediate fetch
    fetchAndMerge();

    if (isProductionHost()) {
      const pollInterval = setInterval(() => {
        if (isSubscribed) fetchAndMerge();
      }, 10000);
      return () => {
        isSubscribed = false;
        clearInterval(pollInterval);
      };
    }

    // Firestore real-time listener (Dev sandbox only)
    const path = 'orders';
    let unsubFirestore: (() => void) | null = null;
    try {
      const q = query(collection(db, 'orders'), where('userId', '==', cleanId));
      unsubFirestore = onSnapshot(
        q,
        () => {
          if (!isSubscribed) return;
          fetchAndMerge();
        },
        (error) => {
          console.warn('Firestore orders subscription notice:', error?.message || error);
        }
      );
    } catch (err) {
      console.warn('Could not setup Firestore orders onSnapshot:', err);
    }

    // Background poll every 8 seconds to catch any server-side or Cloud SQL updates
    const pollInterval = setInterval(() => {
      if (isSubscribed) {
        fetchAndMerge();
      }
    }, 8000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      if (unsubFirestore) {
        try { unsubFirestore(); } catch {}
      }
    };
  },

  // Admin: Get all platform investment orders across all users (Permanent SQL + Firestore)
  async getAllOrders(): Promise<InvestmentOrder[]> {
    const map = new Map<string, InvestmentOrder>();
    const deletedBlacklist = this.getDeletedOrderBlacklist();

    // 1. Primary: Server SQL endpoint (merges SQLite SQL + Cloud SQL + enriched user details)
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const json = await res.json();
          if (json.orders && Array.isArray(json.orders)) {
            for (const o of json.orders) {
              const strId = String(o?.id || '').trim().toLowerCase();
              if (o && o.id && !deletedBlacklist.has(strId)) map.set(String(o.id), o);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Backend SQL all orders fetch warning:', e);
    }

    if (isProductionHost()) {
      return Array.from(map.values()).sort((a, b) => {
        const timeA = a.purchaseTimestamp || (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0);
        const timeB = b.purchaseTimestamp || (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0);
        return timeB - timeA;
      });
    }

    // 2. Fallback & Cloud sync: Firestore (Dev sandbox only)
    const path = 'orders';
    try {
      const querySnapshot = await getDocs(collection(db, 'orders'));
      querySnapshot.forEach((d) => {
        const o = d.data() as InvestmentOrder;
        const strId = String(o?.id || d.id || '').trim().toLowerCase();
        if (deletedBlacklist.has(strId)) {
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        if (o && o.id) {
          if (!map.has(String(o.id))) {
            map.set(String(o.id), o);
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }

    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.purchaseTimestamp || (a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0);
      const timeB = b.purchaseTimestamp || (b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0);
      return timeB - timeA;
    });
  },

  // Admin: Update order
  async updateOrder(orderId: string, updates: Partial<InvestmentOrder>): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      }
    } catch {}

    if (!isProductionHost()) {
      const path = `orders/${orderId}`;
      try {
        await setDoc(doc(db, 'orders', orderId), updates, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  // Admin: Delete order
  async deleteOrder(orderId: string): Promise<void> {
    const cleanId = String(orderId || '').trim();
    this.addDeletedOrderToBlacklist(cleanId);
    try {
      if (typeof window !== 'undefined') {
        await fetch(`/api/orders/${cleanId}`, { method: 'DELETE' });
      }
    } catch {}

    if (!isProductionHost()) {
      const path = `orders/${cleanId}`;
      try {
        await deleteDoc(doc(db, 'orders', cleanId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  // Sync server-credited multi-tier referral commissions (upliners + commission txs) to Firestore (dev sandbox only)
  async syncCommissionCreditedToFirestore(credited: any[]): Promise<void> {
    if (isProductionHost() || !Array.isArray(credited) || credited.length === 0) return;
    for (const item of credited) {
      if (!item) continue;
      if (item.updatedUser?.id) {
        const upPath = `users/${item.updatedUser.id}`;
        try {
          await setDoc(
            doc(db, 'users', item.updatedUser.id),
            {
              withdrawalBalance: Number(item.updatedUser.withdrawalBalance) || 0,
              totalCommissionEarned: Number(item.updatedUser.totalCommissionEarned) || 0,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, upPath);
        }
      }
      if (item.transaction?.id) {
        const txPath = `transactions/${item.transaction.id}`;
        try {
          await setDoc(
            doc(db, 'transactions', item.transaction.id),
            item.transaction,
            { merge: true }
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, txPath);
        }
      }
    }
  },

  // Sync server-settled dividend claim state to Firestore (dev sandbox only) so onSnapshot stays synchronized with SQLite
  async syncDividendClaimToFirestore(payload: {
    user: User;
    orders?: InvestmentOrder[];
    transaction?: Transaction;
    credited?: any[];
  }): Promise<void> {
    if (isProductionHost()) return;
    if (payload.user?.id) {
      const userPath = `users/${payload.user.id}`;
      try {
        await setDoc(
          doc(db, 'users', payload.user.id),
          {
            ...payload.user,
            withdrawalBalance: Number(payload.user.withdrawalBalance) || 0,
            productRevenue: Number(payload.user.productRevenue) || 0,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      }
    }
    if (Array.isArray(payload.orders)) {
      for (const ord of payload.orders) {
        if (!ord?.id) continue;
        const ordPath = `orders/${ord.id}`;
        try {
          await setDoc(doc(db, 'orders', ord.id), { ...ord, userId: ord.userId || payload.user?.id }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, ordPath);
        }
      }
    }
    if (payload.transaction?.id) {
      const txPath = `transactions/${payload.transaction.id}`;
      try {
        await setDoc(
          doc(db, 'transactions', payload.transaction.id),
          { ...payload.transaction, userId: payload.transaction.userId || payload.user?.id },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, txPath);
      }
    }
    if (Array.isArray(payload.credited) && payload.credited.length > 0) {
      await this.syncCommissionCreditedToFirestore(payload.credited).catch(() => {});
    }
  },

  // Admin: Trigger action on order (approve, pause, resume, cancel, payout_dividend, reset_timer)
  async triggerOrderAction(
    orderId: string,
    payload: {
      action: 'approve' | 'pause' | 'resume' | 'cancel' | 'payout_dividend' | 'reset_timer';
      reason?: string;
      refundAmount?: number;
      refundWallet?: 'rechargeBalance' | 'withdrawalBalance';
      customEarnings?: number;
    }
  ): Promise<{ success: boolean; message: string; order?: InvestmentOrder; user?: User; transaction?: Transaction; commissionResult?: any }> {
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch(`/api/orders/${orderId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = await res.json();
          if (!isProductionHost()) {
            if (json.order) {
              await setDoc(doc(db, 'orders', orderId), json.order, { merge: true }).catch(() => {});
            }
            if (json.user?.id) {
              await setDoc(
                doc(db, 'users', json.user.id),
                { ...json.user, updatedAt: new Date().toISOString() },
                { merge: true }
              ).catch(() => {});
            }
            if (json.transaction?.id) {
              await setDoc(
                doc(db, 'transactions', json.transaction.id),
                json.transaction,
                { merge: true }
              ).catch(() => {});
            }
            if (Array.isArray(json.commissionResult?.credited) && json.commissionResult.credited.length > 0) {
              await this.syncCommissionCreditedToFirestore(json.commissionResult.credited).catch(() => {});
            }
          }
          return {
            success: true,
            message: json.message || 'Action executed successfully',
            order: json.order,
            user: json.user,
            transaction: json.transaction,
            commissionResult: json.commissionResult,
          };
        }
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Action failed' };
    }
    return { success: false, message: 'Server communication error' };
  },

  // Platform Settings with lightweight memory caching
  _cachedSettings: null as { data: PlatformSettings; timestamp: number } | null,

  async getPlatformSettings(): Promise<PlatformSettings | null> {
    const now = Date.now();
    if (this._cachedSettings && (now - this._cachedSettings.timestamp < 15000)) {
      return this._cachedSettings.data;
    }
    // 1. Fetch from server backend API (PostgreSQL / SQLite)
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/platform-settings');
        if (res.ok) {
          const json = await res.json();
          if (json?.settings && typeof json.settings === 'object') {
            this._cachedSettings = { data: json.settings, timestamp: now };
            return json.settings;
          }
        }
      }
    } catch {}

    // In production, return cached without touching dev Firestore
    if (isProductionHost()) {
      return this._cachedSettings?.data || null;
    }

    // 2. Fallback to Firestore (Dev sandbox only)
    const path = 'settings/platform';
    try {
      const snap = await getDoc(doc(db, 'settings', 'platform'));
      if (snap.exists()) {
        const data = snap.data() as PlatformSettings;
        this._cachedSettings = { data, timestamp: now };
        return data;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async savePlatformSettings(settings: PlatformSettings): Promise<void> {
    const nowMs = Date.now();
    const stampedSettings = { ...settings, updatedAtMs: nowMs } as PlatformSettings & { updatedAtMs: number };
    this._cachedSettings = { data: stampedSettings, timestamp: nowMs };
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/platform-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stampedSettings),
        });
      } catch {}
    }

    if (!isProductionHost()) {
      const path = 'settings/platform';
      try {
        const cleanSettings = JSON.parse(JSON.stringify(stampedSettings));
        await setDoc(
          doc(db, 'settings', 'platform'),
          {
            ...cleanSettings,
            updatedAtMs: nowMs,
            updatedAt: new Date(nowMs).toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  // Real-time listener for platform settings
  subscribeToPlatformSettings(onUpdate: (settings: PlatformSettings) => void): () => void {
    if (isProductionHost()) {
      let active = true;
      const poll = async () => {
        if (!active) return;
        try {
          const s = await this.getPlatformSettings();
          if (s && active) {
            onUpdate(s);
          }
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 15000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const path = 'settings/platform';
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          const fsData = snap.data() as PlatformSettings & { updatedAtMs?: number; updatedAt?: string };
          const cachedTs = Number((this._cachedSettings?.data as any)?.updatedAtMs) || 0;
          const fsTs = Number(fsData.updatedAtMs) || (fsData.updatedAt ? Date.parse(fsData.updatedAt) || 0 : 0);
          // Never overwrite newer SQLite/Admin saved settings with a stale Firestore doc
          if (cachedTs > fsTs && this._cachedSettings?.data) {
            onUpdate(this._cachedSettings.data);
          } else {
            this._cachedSettings = { data: fsData, timestamp: Date.now() };
            onUpdate(fsData);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsubscribe;
  },

  // Products Blacklist & Anti-Restoration: Ensure deleted products NEVER restore
  getDeletedProductBlacklist(): Set<string> {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('nexa_deleted_products');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return new Set(parsed.map((s) => String(s).trim()));
        }
      }
    } catch {}
    return new Set<string>();
  },

  addDeletedProductToBlacklist(productId: string): void {
    try {
      if (typeof window !== 'undefined') {
        const set = this.getDeletedProductBlacklist();
        if (productId) set.add(String(productId).trim());
        localStorage.setItem('nexa_deleted_products', JSON.stringify(Array.from(set)));
      }
    } catch {}
  },

  // Products CRUD
  subscribeToProducts(onUpdate: (products: InvestmentProduct[]) => void): () => void {
    if (isProductionHost()) {
      let active = true;
      const poll = async () => {
        if (!active) return;
        try {
          const prods = await this.getAllProducts();
          if (prods && prods.length > 0 && active) {
            onUpdate(prods);
          }
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 15000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const path = 'products';
    const deletedBlacklist = this.getDeletedProductBlacklist();
    const obsoleteIds = new Set([
      'prod-1793251583445', 'prod-1793251570879', 'prod-1793251545940',
      'prod-1793251470609', 'prod-1793251426305', 'prod-1793251372972'
    ]);

    try {
      const q = collection(db, 'products');
      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const fsList: InvestmentProduct[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as InvestmentProduct;
            const pId = String(data.id || d.id || '').trim();
            // Purge blacklisted or obsolete docs from Firestore
            if (deletedBlacklist.has(pId) || obsoleteIds.has(pId) || data.price > 250) {
              deleteDoc(d.ref).catch(() => {});
              return;
            }
            fsList.push(data);
          });

          // Fetch SQL products (Primary canonical authority)
          let sqlList: InvestmentProduct[] = [];
          try {
            if (typeof window !== 'undefined') {
              const res = await fetch('/api/products');
              if (res.ok) {
                const j = await res.json();
                if (j?.products && Array.isArray(j.products)) {
                  sqlList = j.products.filter(
                    (p: InvestmentProduct) => !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id) && p.price <= 250
                  );
                }
              }
            }
          } catch {}

          const map = new Map<string, InvestmentProduct>();
          // 1. Cached products
          try {
            if (typeof window !== 'undefined') {
              const cached = localStorage.getItem('nexa_platform_products');
              if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                  parsed.forEach((p) => {
                    if (p && p.id && !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id) && p.price <= 250) {
                      map.set(p.id, p);
                    }
                  });
                }
              }
            }
          } catch {}

          // 2. Merge SQL products (Primary canonical authority)
          sqlList.forEach((p) => {
            if (p && p.id && !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id)) {
              const existing = map.get(p.id);
              const existingTime = Number(existing?.updatedAt || 0);
              const sqlTime = Number(p.updatedAt || 0);
              if (!existing || sqlTime >= existingTime || !existing.price) {
                map.set(p.id, { ...existing, ...p });
              } else {
                map.set(p.id, { ...p, ...existing });
              }
            }
          });

          // 3. Merge Firestore products
          fsList.forEach((p) => {
            if (p && p.id && !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id)) {
              const existing = map.get(p.id);
              const existingTime = Number(existing?.updatedAt || 0);
              const fsTime = Number(p.updatedAt || 0);
              if (!existing || fsTime >= existingTime) {
                map.set(p.id, { ...existing, ...p });
              }
            }
          });

          const merged = Array.from(map.values()).filter(
            (p) => !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id)
          );
          if (merged.length > 0) {
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem('nexa_platform_products', JSON.stringify(merged));
              }
            } catch {}
            onUpdate(merged);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
      return unsubscribe;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return () => {};
    }
  },

  async getAllProducts(): Promise<InvestmentProduct[]> {
    const deletedBlacklist = this.getDeletedProductBlacklist();
    const obsoleteIds = new Set([
      'prod-1793251583445', 'prod-1793251570879', 'prod-1793251545940',
      'prod-1793251470609', 'prod-1793251426305', 'prod-1793251372972'
    ]);

    let sqlList: InvestmentProduct[] = [];
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/products');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.products)) {
            sqlList = json.products.filter(
              (p: InvestmentProduct) => !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id) && p.price <= 250
            );
          }
        }
      }
    } catch {}

    if (isProductionHost() && sqlList.length > 0) {
      return sqlList.sort((a, b) => a.price - b.price);
    }

    const path = 'products';
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const fsList: InvestmentProduct[] = [];
      querySnapshot.forEach((d) => {
        const data = d.data() as InvestmentProduct;
        const pId = String(data.id || d.id || '').trim();
        if (deletedBlacklist.has(pId) || obsoleteIds.has(pId) || data.price > 250) {
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        fsList.push(data);
      });

      const map = new Map<string, InvestmentProduct>();
      // 1. Cached products
      try {
        if (typeof window !== 'undefined') {
          const localStr = localStorage.getItem('nexa_platform_products');
          if (localStr) {
            const parsed = JSON.parse(localStr);
            if (Array.isArray(parsed)) {
              parsed.forEach((p) => {
                if (p && p.id && !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id) && p.price <= 250) {
                  map.set(p.id, p);
                }
              });
            }
          }
        }
      } catch {}

      // 2. SQL products
      sqlList.forEach((p) => {
        if (p && p.id && !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id)) {
          const existing = map.get(p.id);
          const existingTime = Number(existing?.updatedAt || 0);
          const sqlTime = Number(p.updatedAt || 0);
          if (!existing || sqlTime >= existingTime || !existing.price) {
            map.set(p.id, { ...existing, ...p });
          } else {
            map.set(p.id, { ...p, ...existing });
          }
        }
      });

      // 3. Firestore products
      fsList.forEach((p) => {
        if (p && p.id && !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id)) {
          const existing = map.get(p.id);
          const existingTime = Number(existing?.updatedAt || 0);
          const fsTime = Number(p.updatedAt || 0);
          if (!existing || fsTime >= existingTime) {
            map.set(p.id, { ...existing, ...p });
          }
        }
      });

      const finalProducts = Array.from(map.values()).filter(
        (p) => !deletedBlacklist.has(p.id) && !obsoleteIds.has(p.id)
      );
      if (typeof window !== 'undefined' && finalProducts.length > 0) {
        try {
          localStorage.setItem('nexa_platform_products', JSON.stringify(finalProducts));
        } catch {}
      }
      return finalProducts;
    } catch (error) {
      if (sqlList.length > 0) return sqlList;
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async saveProduct(product: InvestmentProduct): Promise<void> {
    const cleanId = String(product.id || '').trim();

    // Remove from blacklist if recreating
    const blacklist = this.getDeletedProductBlacklist();
    if (blacklist.has(cleanId)) {
      blacklist.delete(cleanId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexa_deleted_products', JSON.stringify(Array.from(blacklist)));
      }
    }

    const enrichedProduct: InvestmentProduct = {
      ...product,
      price: Number(product.price) || 0,
      dailyEarnings: Number(product.dailyEarnings) || 0,
      dailyPercent: product.dailyPercent !== undefined ? Number(product.dailyPercent) : (product.price > 0 ? Number(((Number(product.dailyEarnings) / Number(product.price)) * 100).toFixed(1)) : 50),
      cycleDays: Number(product.cycleDays || 45),
      totalRevenue: Number(product.totalRevenue || (Number(product.dailyEarnings || 0) * Number(product.cycleDays || 45)).toFixed(2)),
      updatedAt: Date.now(),
    };

    // 1. Sync to SQLite SQL backend
    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedProduct),
        });
      }
    } catch (e) {
      console.warn('SQL save product warning:', e);
    }

    // 2. Sync to Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `products/${enrichedProduct.id}`;
      try {
        await setDoc(doc(db, 'products', enrichedProduct.id), enrichedProduct, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  async deleteProduct(productId: string): Promise<void> {
    const cleanId = String(productId).trim();

    // 1. Blacklist locally so it can NEVER restore in browser
    this.addDeletedProductToBlacklist(cleanId);

    // 2. Remove immediately from localStorage
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('nexa_platform_products');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((p) => String(p.id).trim() !== cleanId);
            localStorage.setItem('nexa_platform_products', JSON.stringify(filtered));
          }
        }
      } catch {}
    }

    // 3. Delete from SQLite SQL and server disk blacklist via API
    try {
      if (typeof window !== 'undefined') {
        await fetch(`/api/products/${encodeURIComponent(cleanId)}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.warn('Server delete product warning:', e);
    }

    // 4. Delete from Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `products/${cleanId}`;
      try {
        await deleteDoc(doc(db, 'products', cleanId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  // Notices CRUD
  async getAllNotices(): Promise<NoticeItem[]> {
    let cloudSqlList: NoticeItem[] = [];
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/notices');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.notices)) {
            cloudSqlList = json.notices;
          }
        }
      }
    } catch {}

    if (isProductionHost() && cloudSqlList.length > 0) {
      return cloudSqlList;
    }

    const path = 'notices';
    try {
      const querySnapshot = await getDocs(collection(db, 'notices'));
      const list: NoticeItem[] = [];
      querySnapshot.forEach((d) => {
        list.push(d.data() as NoticeItem);
      });
      // Merge Cloud SQL and Firestore
      const noticeMap = new Map<string, NoticeItem>();
      cloudSqlList.forEach((n) => noticeMap.set(n.id, n));
      list.forEach((n) => noticeMap.set(n.id, { ...noticeMap.get(n.id), ...n }));
      return Array.from(noticeMap.values());
    } catch (error) {
      if (cloudSqlList.length > 0) return cloudSqlList;
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async saveNotice(notice: NoticeItem): Promise<void> {
    // 1. Sync to Cloud SQL PostgreSQL
    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/notices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notice),
        });
      }
    } catch (e) {
      console.warn('Cloud SQL save notice warning:', e);
    }

    // 2. Sync to Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `notices/${notice.id}`;
      try {
        await setDoc(doc(db, 'notices', notice.id), notice, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  async deleteNotice(noticeId: string): Promise<void> {
    // 1. Delete from Cloud SQL PostgreSQL
    try {
      if (typeof window !== 'undefined') {
        await fetch(`/api/notices/${encodeURIComponent(noticeId)}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.warn('Cloud SQL delete notice warning:', e);
    }

    // 2. Delete from Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `notices/${noticeId}`;
      try {
        await deleteDoc(doc(db, 'notices', noticeId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  // Promo Codes CRUD with Multi-Layer Sync (Server Backup + localStorage + Firestore)
  // Deleted promo tombstone helper
  getDeletedPromoKeys(): Set<string> {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('nexa_deleted_promos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return new Set(parsed.map((s) => String(s).trim().toUpperCase()));
        }
      }
    } catch {}
    return new Set<string>();
  },

  saveDeletedPromoKeys(keys: Set<string>): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexa_deleted_promos', JSON.stringify(Array.from(keys)));
      }
    } catch {}
  },

  async getAllPromoCodes(): Promise<CustomPromoCode[]> {
    const deletedTombstones = this.getDeletedPromoKeys();
    let serverList: CustomPromoCode[] = [];
    let serverFetched = false;

    // 1. Fetch from Server Backup
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/promos');
        if (res.ok) {
          serverFetched = true;
          const data = await res.json();
          if (data.deletedPromoKeys && Array.isArray(data.deletedPromoKeys)) {
            data.deletedPromoKeys.forEach((k: string) => deletedTombstones.add(String(k).trim().toUpperCase()));
            this.saveDeletedPromoKeys(deletedTombstones);
          }
          if (Array.isArray(data.promoCodes)) {
            serverList = data.promoCodes.filter((p: CustomPromoCode) => {
              const pId = String(p.id || '').trim().toUpperCase();
              const pCode = String(p.code || '').trim().toUpperCase();
              return !deletedTombstones.has(pId) && !deletedTombstones.has(pCode);
            });
            localStorage.setItem('nexa_promo_codes_backup', JSON.stringify(serverList));
          }
        }
      }
    } catch {}

    if (isProductionHost() && serverFetched) {
      return serverList;
    }

    // 2. Query Firestore (Dev sandbox only)
    const path = 'promoCodes';
    try {
      const querySnapshot = await getDocs(collection(db, 'promoCodes'));
      const firestoreList: CustomPromoCode[] = [];
      const docsToPurge: string[] = [];

      querySnapshot.forEach((d) => {
        const p = d.data() as CustomPromoCode;
        const pId = String(p.id || d.id || '').trim().toUpperCase();
        const pCode = String(p.code || '').trim().toUpperCase();

        if (deletedTombstones.has(pId) || deletedTombstones.has(pCode)) {
          docsToPurge.push(d.id);
        } else {
          firestoreList.push(p);
        }
      });

      // Purge ghost docs from Firestore so deleted promos never restore
      if (docsToPurge.length > 0) {
        for (const docId of docsToPurge) {
          deleteDoc(doc(db, 'promoCodes', docId)).catch(() => {});
        }
      }

      // Merge with server list
      const codeMap = new Map<string, CustomPromoCode>();
      serverList.forEach((p) => {
        const key = p.code.trim().toUpperCase();
        if (!deletedTombstones.has(key)) codeMap.set(key, p);
      });
      firestoreList.forEach((p) => {
        const key = p.code.trim().toUpperCase();
        if (!deletedTombstones.has(key)) {
          codeMap.set(key, { ...(codeMap.get(key) || {}), ...p });
        }
      });

      const combined = Array.from(codeMap.values());
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexa_promo_codes_backup', JSON.stringify(combined));
      }
      return combined;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }

    if (serverFetched) {
      return serverList;
    }

    // Local storage fallback (excluding tombstones)
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('nexa_promo_codes_backup');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            return parsed.filter((p: CustomPromoCode) => {
              const pId = String(p.id || '').trim().toUpperCase();
              const pCode = String(p.code || '').trim().toUpperCase();
              return !deletedTombstones.has(pId) && !deletedTombstones.has(pCode);
            });
          }
        }
      } catch {}
    }

    // Strict Anti-Restoration: DO NOT return hardcoded default promo codes!
    return [];
  },

  async savePromoCode(promo: CustomPromoCode): Promise<void> {
    const cleanId = String(promo.id || '').trim();
    const cleanCode = String(promo.code || '').trim().toUpperCase();

    // Remove from deleted tombstones if being created or re-enabled
    const deletedTombstones = this.getDeletedPromoKeys();
    if (deletedTombstones.has(cleanId.toUpperCase()) || deletedTombstones.has(cleanCode)) {
      deletedTombstones.delete(cleanId.toUpperCase());
      deletedTombstones.delete(cleanCode);
      this.saveDeletedPromoKeys(deletedTombstones);
    }

    // 1. Sync to server backup
    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/promos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(promo),
        });
      }
    } catch {}

    // 2. Sync to localStorage
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('nexa_promo_codes_backup');
        let list: CustomPromoCode[] = local ? JSON.parse(local) : [];
        const idx = list.findIndex((p) => p.id === promo.id || p.code.toUpperCase() === cleanCode);
        if (idx >= 0) list[idx] = promo;
        else list.unshift(promo);
        localStorage.setItem('nexa_promo_codes_backup', JSON.stringify(list));
      } catch {}
    }

    // 3. Sync to Cloud Firestore (Dev sandbox only)
    if (!isProductionHost()) {
      const path = `promoCodes/${promo.id}`;
      try {
        await setDoc(doc(db, 'promoCodes', promo.id), promo, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  async deletePromoCode(promoId: string, promoCode?: string): Promise<void> {
    const cleanId = String(promoId || '').trim();
    const cleanCode = String(promoCode || '').trim().toUpperCase();

    // 1. Add to localStorage tombstones immediately
    const tombstones = this.getDeletedPromoKeys();
    if (cleanId) tombstones.add(cleanId.toUpperCase());
    if (cleanCode) tombstones.add(cleanCode);
    this.saveDeletedPromoKeys(tombstones);

    // 2. Sync delete to server API with query code
    try {
      if (typeof window !== 'undefined') {
        const url = `/api/promos/${encodeURIComponent(cleanId)}?code=${encodeURIComponent(cleanCode)}`;
        await fetch(url, { method: 'DELETE' });
      }
    } catch {}

    // 3. Sync to localStorage
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('nexa_promo_codes_backup');
        if (local) {
          const list: CustomPromoCode[] = JSON.parse(local);
          const filtered = list.filter((p) => {
            const pId = String(p.id || '').trim().toUpperCase();
            const pCode = String(p.code || '').trim().toUpperCase();
            if (pId === cleanId.toUpperCase()) return false;
            if (cleanCode && pCode === cleanCode) return false;
            return true;
          });
          localStorage.setItem('nexa_promo_codes_backup', JSON.stringify(filtered));
        }
      } catch {}
    }

    // 4. Delete from Firestore by doc ID (Dev sandbox only)
    if (!isProductionHost()) {
      try {
        await deleteDoc(doc(db, 'promoCodes', cleanId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `promoCodes/${cleanId}`);
      }

      // Also delete by code query from Firestore if code is provided
      if (cleanCode) {
        try {
          const q = query(collection(db, 'promoCodes'), where('code', '==', cleanCode));
          const snapshot = await getDocs(q);
          for (const d of snapshot.docs) {
            deleteDoc(d.ref).catch(() => {});
          }
        } catch {}
      }
    }
  },

  // Real-time listener for promo codes
  subscribeToPromoCodes(onUpdate: (promos: CustomPromoCode[]) => void): () => void {
    if (isProductionHost()) {
      let active = true;
      const poll = async () => {
        if (!active) return;
        try {
          const list = await this.getAllPromoCodes();
          if (list && active) {
            onUpdate(list);
          }
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 20000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const path = 'promoCodes';
    const unsubscribe = onSnapshot(
      collection(db, 'promoCodes'),
      (snap) => {
        const deletedTombstones = this.getDeletedPromoKeys();
        const list: CustomPromoCode[] = [];
        snap.forEach((d) => {
          const p = d.data() as CustomPromoCode;
          const pId = String(p.id || d.id || '').trim().toUpperCase();
          const pCode = String(p.code || '').trim().toUpperCase();
          if (!deletedTombstones.has(pId) && !deletedTombstones.has(pCode)) {
            list.push(p);
          }
        });
        onUpdate(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return unsubscribe;
  },

  // Referral System: Generate unique clean referral code
  generateReferralCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, O, 1, I
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Referral System: Find user by invitation code
  async findUserByInviteCode(code: string): Promise<User | null> {
    if (!code || !code.trim()) return null;
    const cleanCode = code.trim().toUpperCase();
    const cleanDigits = code.replace(/\D/g, '').slice(-10);

    // 1. Primary: Server API lookup (Backed by Cloud SQL + Permanent storage, 100% reliable)
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch(`/api/referral/lookup/${encodeURIComponent(cleanCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            return data.user as User;
          }
        }
      }
    } catch (err) {
      console.warn('Server referral lookup notice:', err);
    }

    // 2. Secondary: Search local & server backup users
    try {
      const backupUsers = await this.getUsersFromBackup();
      const match = backupUsers.find((u) => {
        const uCode = (u.invitationCode || '').trim().toUpperCase();
        const uPhone = (u.phone || '').replace(/\D/g, '').slice(-10);
        const uId = String(u.id || '').trim().toUpperCase();
        return (
          uCode === cleanCode ||
          (cleanDigits.length === 10 && uPhone === cleanDigits) ||
          uId === cleanCode ||
          u.id === code.trim()
        );
      });
      if (match) return match;
    } catch (err) {
      console.warn('Backup findUserByInviteCode notice:', err);
    }

    // 2.5 Fallback check for Ravi Sahu legacy code R34VZ -> J9Y79
    if (cleanCode === 'R34VZ') {
      try {
        const ravi = await this.findUserByPhone('9170481824');
        if (ravi) return ravi;
      } catch {}
    }

    // 2.6 Fallback check for Anshusahu legacy code EYAYY -> AAWFK
    if (cleanCode === 'EYAYY') {
      try {
        const anshu = await this.findUserByPhone('8858359277');
        if (anshu) return anshu;
      } catch {}
    }

    // 3. Fallback check for demo / default admin account code '4AB86'
    if (cleanCode === '4AB86') {
      try {
        const adminByPhone = await this.findUserByPhone('7307112738');
        if (adminByPhone) {
          if (!adminByPhone.invitationCode) {
            adminByPhone.invitationCode = '4AB86';
          }
          return adminByPhone;
        }
      } catch {}
      return {
        id: '833863',
        phone: '7307112738',
        nickname: 'gaurav',
        avatar: 'HD',
        invitationCode: '4AB86',
        rechargeBalance: 0,
        withdrawalBalance: 0,
        productRevenue: 0,
        vipLevel: 0,
        totalInvested: 0,
        checkInStreak: 0,
        lastCheckInDate: null,
        spinChances: 0,
        status: 'active',
        role: 'admin',
      };
    }

    // 4. Firestore direct query fallback (isolated try/catch so permission errors never crash)
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), where('invitationCode', '==', cleanCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as User;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }

    return null;
  },

  // Referral System: Get referrer display details for live validation & UI
  async getReferrerInfo(code: string): Promise<ReferrerInfo | null> {
    if (!code || !code.trim()) return null;
    const cleanCode = code.trim().toUpperCase();

    // 1. Primary: Server API lookup (Instant, Cloud SQL validated)
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch(`/api/referral/lookup/${encodeURIComponent(cleanCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.referrerInfo) {
            return data.referrerInfo;
          }
        }
      }
    } catch (err) {
      console.warn('Server getReferrerInfo notice:', err);
    }

    // 2. Secondary: Internal lookup fallback
    const inviter = await this.findUserByInviteCode(cleanCode);
    if (inviter) {
      const cleanPhone = (inviter.phone || '').replace(/\D/g, '').slice(-10);
      const masked = cleanPhone.length === 10
        ? `+91 ${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}`
        : `User #${inviter.id}`;

      return {
        valid: true,
        name: inviter.nickname || `Member_${inviter.id.slice(-4)}`,
        code: inviter.invitationCode || cleanCode,
        phoneMasked: masked,
        id: inviter.id,
      };
    }

    return {
      valid: false,
      name: '',
      code: cleanCode,
    };
  },

  // Auth: Find user by mobile phone number (Direct authoritative SQLite endpoint first)
  async findUserByPhone(phone: string): Promise<User | null> {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // 1. Direct authoritative SQLite user lookup by phone
    try {
      if (typeof window !== 'undefined' && cleanPhone.length === 10) {
        const res = await fetch(`/api/user/${encodeURIComponent(cleanPhone)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.user) {
            return json.user as User;
          }
        }
      }
    } catch {}

    // 2. Fallback: Cloud SQL & permanent storage
    try {
      const backupUsers = await this.getUsersFromBackup();
      const match = backupUsers.find((u) => u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleanPhone);
      if (match) return match;
    } catch (e) {
      console.warn('Backup lookup error in findUserByPhone:', e);
    }

    const path = 'users';
    try {
      // 2. Query users by phone field in Firestore
      const q = query(collection(db, 'users'), where('phone', '==', cleanPhone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const u = snap.docs[0].data() as User;
        this.syncUsersToBackup([u]);
        return u;
      }

      // 3. Direct document ID lookup check
      const directSnap = await getDoc(doc(db, 'users', cleanPhone));
      if (directSnap.exists()) {
        const u = directSnap.data() as User;
        if (u.phone?.replace(/\D/g, '').slice(-10) === cleanPhone) {
          this.syncUsersToBackup([u]);
          return u;
        }
      }

      // 4. Special seed ID check for default demo user
      if (cleanPhone === '7307112738') {
        const seedSnap = await getDoc(doc(db, 'users', '833863'));
        if (seedSnap.exists()) {
          const u = seedSnap.data() as User;
          this.syncUsersToBackup([u]);
          return u;
        }
      }

      return null;
    } catch (error) {
      console.warn('Firestore findUserByPhone fallback error:', error);
      handleFirestoreError(error, OperationType.LIST, path);
      return null;
    }
  },

  // Auth: Update user password by phone number
  async updateUserPasswordByPhone(phone: string, newPassword: string): Promise<boolean> {
    if (!phone || !newPassword) return false;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    try {
      const user = await this.findUserByPhone(cleanPhone);
      if (!user) return false;
      await this.updateUser(user.id, { password: newPassword });
      return true;
    } catch (error) {
      console.error('Failed to update user password:', error);
      return false;
    }
  },

  // Referral System: Get team downlines across Tier 1, 2, and 3
  async getTeamMembersForUser(userId: string): Promise<TeamMember[]> {
    if (!userId) return [];

    // 1. Primary: Server computed team members (Fast, zero client overhead, Cloud SQL backed)
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch(`/api/referral/team/${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.members)) {
            return data.members as TeamMember[];
          }
        }
      }
    } catch (e) {
      console.warn('Server getTeamMembersForUser notice:', e);
    }

    const path = 'users';
    try {
      const allUsers = await this.getAllUsers();
      if (!allUsers || allUsers.length === 0) return [];

      let currentUser: User | null = allUsers.find(
        (u) => u.id === userId || (u.phone && userId && u.phone.replace(/\D/g, '').slice(-10) === userId.replace(/\D/g, '').slice(-10))
      ) || null;
      if (!currentUser) {
        currentUser = await this.getUser(userId);
      }

      const userCodes = new Set<string>();
      if (currentUser?.invitationCode) {
        userCodes.add(currentUser.invitationCode.trim().toUpperCase());
      }
      if (userId === '833863' || (currentUser?.phone && currentUser.phone.includes('7307112738'))) {
        userCodes.add('4AB86');
      }
      const userPhoneDigits = currentUser?.phone ? currentUser.phone.replace(/\D/g, '').slice(-10) : '';
      if (userPhoneDigits) {
        userCodes.add(userPhoneDigits);
      }
      if (currentUser?.id) {
        userCodes.add(currentUser.id.trim().toUpperCase());
      }
      if (userId) {
        userCodes.add(userId.trim().toUpperCase());
      }

      // Add Ravi Sahu legacy codes so downlines NEVER drop
      const isRavi =
        userId === '325697' ||
        userId === '9170481824' ||
        (currentUser?.phone && currentUser.phone.replace(/\D/g, '').slice(-10) === '9170481824') ||
        currentUser?.invitationCode === 'J9Y79';
      if (isRavi) {
        userCodes.add('J9Y79');
        userCodes.add('R34VZ');
        userCodes.add('852539');
        userCodes.add('325697');
        userCodes.add('9170481824');
      }

      // Add Anshusahu legacy/alias codes
      const isAnshu =
        userId === '406332' ||
        userId === '8858359277' ||
        (currentUser?.phone && currentUser.phone.replace(/\D/g, '').slice(-10) === '8858359277') ||
        currentUser?.invitationCode === 'AAWFK';
      if (isAnshu) {
        userCodes.add('AAWFK');
        userCodes.add('EYAYY');
        userCodes.add('406332');
        userCodes.add('8858359277');
      }

      const teamList: TeamMember[] = [];
      const otherUsers = allUsers.filter((u) => u.id !== userId && (!currentUser || u.id !== currentUser.id));

      // Tier 1: Directly invited by userId or by any of user's codes / phone
      const tier1Users = otherUsers.filter((u) => {
        const matchesInviterId = u.inviterId && (
          u.inviterId === userId ||
          (currentUser && u.inviterId === currentUser.id) ||
          (isRavi && (u.inviterId === '852539' || u.inviterId === '325697' || (u.inviterName && u.inviterName.toLowerCase().includes('ravi')))) ||
          (isAnshu && (u.inviterId === '406332' || (u.inviterName && u.inviterName.toLowerCase().includes('anshu'))))
        );
        const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : '';
        const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, '').slice(-10) : '';
        const matchesInvitedBy =
          cleanInvitedBy &&
          (userCodes.has(cleanInvitedBy) ||
           (userPhoneDigits && cleanInvitedDigits === userPhoneDigits) ||
           (isRavi && (cleanInvitedBy === 'R34VZ' || cleanInvitedBy === 'J9Y79' || (u.inviterName && u.inviterName.toLowerCase().includes('ravi')))) ||
           (isAnshu && (cleanInvitedBy === 'EYAYY' || cleanInvitedBy === 'AAWFK' || (u.inviterName && u.inviterName.toLowerCase().includes('anshu')))));
        return Boolean(matchesInviterId || matchesInvitedBy);
      });

      const tier1Ids = new Set(tier1Users.map((u) => u.id));
      const tier1Codes = new Set<string>();
      const tier1Phones = new Set<string>();
      tier1Users.forEach((u) => {
        if (u.id) tier1Codes.add(u.id.trim().toUpperCase());
        if (u.invitationCode) tier1Codes.add(u.invitationCode.trim().toUpperCase());
        if (u.phone) {
          const p = u.phone.replace(/\D/g, '').slice(-10);
          tier1Codes.add(p);
          tier1Phones.add(p);
        }
      });

      const liveSettings = await this.getPlatformSettings().catch(() => null);
      const t1Rate = liveSettings?.tier1Commission ?? 10;
      const t2Rate = liveSettings?.tier2Commission ?? 3;
      const t3Rate = liveSettings?.tier3Commission ?? 1;

      const computeDownlineData = (u: any, level: 1 | 2 | 3) => {
        const cleanP = u.phone ? u.phone.replace(/\D/g, '').slice(-10) : '';
        const masked = cleanP.length === 10 ? `+91 ${cleanP.slice(0, 3)}****${cleanP.slice(-3)}` : `User #${u.id}`;
        const join = (u as any).createdAt ? (u as any).createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const rate = level === 1 ? t1Rate : level === 2 ? t2Rate : t3Rate;
        const realRecharge = Number(u.totalInvested) || 0;
        const commissionContributed = Number(((realRecharge * rate) / 100).toFixed(2));
        return {
          id: u.id,
          nickname: u.nickname || 'Member',
          phoneMasked: masked,
          level,
          joinDate: join,
          rechargeTotal: realRecharge,
          commissionContributed,
        };
      };

      tier1Users.forEach((u) => {
        teamList.push(computeDownlineData(u, 1));
      });

      // Tier 2: Invited by Tier 1 members
      const tier2Users = otherUsers.filter((u) => {
        if (tier1Ids.has(u.id)) return false;
        const matchesInviterId = u.inviterId && tier1Ids.has(u.inviterId);
        const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : '';
        const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, '').slice(-10) : '';
        const matchesInvitedBy =
          cleanInvitedBy &&
          (tier1Codes.has(cleanInvitedBy) || (cleanInvitedDigits && tier1Phones.has(cleanInvitedDigits)));
        return Boolean(matchesInviterId || matchesInvitedBy);
      });

      const tier2Ids = new Set(tier2Users.map((u) => u.id));
      const tier2Codes = new Set<string>();
      const tier2Phones = new Set<string>();
      tier2Users.forEach((u) => {
        if (u.id) tier2Codes.add(u.id.trim().toUpperCase());
        if (u.invitationCode) tier2Codes.add(u.invitationCode.trim().toUpperCase());
        if (u.phone) {
          const p = u.phone.replace(/\D/g, '').slice(-10);
          tier2Codes.add(p);
          tier2Phones.add(p);
        }
      });

      tier2Users.forEach((u) => {
        teamList.push(computeDownlineData(u, 2));
      });

      // Tier 3: Invited by Tier 2 members
      const tier3Users = otherUsers.filter((u) => {
        if (tier1Ids.has(u.id) || tier2Ids.has(u.id)) return false;
        const matchesInviterId = u.inviterId && tier2Ids.has(u.inviterId);
        const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : '';
        const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, '').slice(-10) : '';
        const matchesInvitedBy =
          cleanInvitedBy &&
          (tier2Codes.has(cleanInvitedBy) || (cleanInvitedDigits && tier2Phones.has(cleanInvitedDigits)));
        return Boolean(matchesInviterId || matchesInvitedBy);
      });

      tier3Users.forEach((u) => {
        teamList.push(computeDownlineData(u, 3));
      });

      return teamList;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // Referral System: Distribute multi-tier commissions via server
  async distributeCommissionOnServer(
    payerId: string,
    amount: number,
    actionType: 'recharge' | 'investment' | 'daily_income',
    referenceId?: string
  ): Promise<any> {
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/referral/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payerId, amount, actionType, referenceId }),
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.credited) && json.credited.length > 0) {
            await this.syncCommissionCreditedToFirestore(json.credited).catch(() => {});
          }
          return json;
        }
      }
    } catch (e) {
      console.warn('Backend commission distribution notice:', e);
    }
    return null;
  },

  // Referral System: Reconcile and synchronize user referral stats on demand
  async syncReferralStats(userId?: string): Promise<any> {
    try {
      if (typeof window !== 'undefined') {
        const url = userId ? `/api/referral/sync-stats/${encodeURIComponent(userId)}` : '/api/referral/sync-stats';
        const res = await fetch(url, { method: 'POST' });
        if (res.ok) {
          return await res.json();
        }
      }
    } catch (e) {
      console.warn('Backend sync referral stats notice:', e);
    }
    return null;
  },

  // Peer-to-Peer (P2P) Recipient Lookup
  async lookupP2PRecipient(
    queryStr: string,
    senderId?: string,
    senderPhone?: string
  ): Promise<{ success: boolean; recipient?: P2PRecipientPreview; error?: string }> {
    const cleanQuery = String(queryStr || '').trim();
    if (!cleanQuery) {
      return { success: false, error: 'Please enter a User ID, Mobile Number, or Invite Code.' };
    }

    try {
      const params = new URLSearchParams({ query: cleanQuery });
      if (senderId) params.set('senderId', senderId);
      if (senderPhone) params.set('senderPhone', senderPhone.replace(/\D/g, '').slice(-10));

      let res = await fetch(`/api/p2p/lookup?${params.toString()}`);
      let json = await res.json();

      // Dev sandbox fallback: if user exists in Firestore but has not synced to SQLite yet, sync and retry once
      if (res.status === 404 && !isProductionHost()) {
        try {
          let fsMatch: User | null = null;
          const cleanDigits = cleanQuery.replace(/\D/g, '');
          const cleanPhone = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';
          const upperCode = cleanQuery.toUpperCase();

          const byIdSnap = await getDoc(doc(db, 'users', cleanQuery));
          if (byIdSnap.exists()) {
            fsMatch = byIdSnap.data() as User;
          }
          if (!fsMatch && cleanPhone.length === 10) {
            const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone));
            const snapPhone = await getDocs(qPhone);
            if (!snapPhone.empty) fsMatch = snapPhone.docs[0].data() as User;
          }
          if (!fsMatch && upperCode.length >= 3) {
            const qCode = query(collection(db, 'users'), where('invitationCode', '==', upperCode));
            const snapCode = await getDocs(qCode);
            if (!snapCode.empty) fsMatch = snapCode.docs[0].data() as User;
          }

          if (fsMatch && (fsMatch.id || fsMatch.phone)) {
            await fetch('/api/user/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user: fsMatch }),
            });
            res = await fetch(`/api/p2p/lookup?${params.toString()}`);
            json = await res.json();
          }
        } catch {}
      }

      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Recipient not found.' };
      }
      return { success: true, recipient: json.recipient as P2PRecipientPreview };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to verify recipient right now.' };
    }
  },

  // Peer-to-Peer (P2P) Atomic Transfer Execution
  async executeP2PTransfer(payload: {
    senderId: string;
    recipientQuery: string;
    amount: number;
    sourceWallet: 'withdrawalBalance' | 'rechargeBalance';
    targetWallet?: 'withdrawalBalance' | 'rechargeBalance';
    note?: string;
  }): Promise<{
    success: boolean;
    sender?: User;
    recipientPreview?: P2PRecipientPreview;
    senderTransaction?: Transaction;
    recipientTransaction?: Transaction;
    referenceNo?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/p2p/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'P2P transfer failed.' };
      }

      // Mirror updated balances and transactions to Firestore in dev sandbox
      if (!isProductionHost()) {
        const nowIso = new Date().toISOString();
        if (json.sender?.id) {
          setDoc(
            doc(db, 'users', String(json.sender.id)),
            {
              rechargeBalance: Number(json.sender.rechargeBalance) || 0,
              withdrawalBalance: Number(json.sender.withdrawalBalance) || 0,
              updatedAt: nowIso,
            },
            { merge: true }
          ).catch(() => {});
        }
        if (json.recipientWalletUpdate?.id) {
          setDoc(
            doc(db, 'users', String(json.recipientWalletUpdate.id)),
            {
              rechargeBalance: Number(json.recipientWalletUpdate.rechargeBalance) || 0,
              withdrawalBalance: Number(json.recipientWalletUpdate.withdrawalBalance) || 0,
              updatedAt: nowIso,
            },
            { merge: true }
          ).catch(() => {});
        }
        if (json.senderTransaction?.id) {
          setDoc(doc(db, 'transactions', String(json.senderTransaction.id)), json.senderTransaction, { merge: true }).catch(() => {});
        }
        if (json.recipientTransaction?.id) {
          setDoc(doc(db, 'transactions', String(json.recipientTransaction.id)), json.recipientTransaction, { merge: true }).catch(() => {});
        }
      }

      return json;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while transferring funds.' };
    }
  },

  // Admin: Fetch consolidated P2P transfer history and analytics
  async getAdminP2PHistory(): Promise<{
    success: boolean;
    transfers?: any[];
    ledger?: Transaction[];
    stats?: {
      totalTransfers: number;
      totalVolume: number;
      chargedSourceVolume: number;
      withdrawalSourceVolume: number;
      chargedSourceCount: number;
      withdrawalSourceCount: number;
    };
    error?: string;
  }> {
    try {
      const res = await fetch('/api/admin/p2p/history');
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to load P2P history' };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error loading P2P history' };
    }
  },

  // Admin: Execute P2P transfer between any two users
  async executeAdminP2PTransfer(payload: {
    senderQuery: string;
    recipientQuery: string;
    amount: number;
    sourceWallet: 'withdrawalBalance' | 'rechargeBalance';
    targetWallet: 'withdrawalBalance' | 'rechargeBalance';
    note?: string;
  }): Promise<{
    success: boolean;
    referenceNo?: string;
    sender?: User;
    recipient?: User;
    senderTransaction?: Transaction;
    recipientTransaction?: Transaction;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/admin/p2p/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Admin P2P transfer failed.' };
      }

      if (!isProductionHost()) {
        const nowIso = new Date().toISOString();
        if (json.sender?.id) {
          setDoc(
            doc(db, 'users', String(json.sender.id)),
            {
              rechargeBalance: Number(json.sender.rechargeBalance) || 0,
              withdrawalBalance: Number(json.sender.withdrawalBalance) || 0,
              updatedAt: nowIso,
            },
            { merge: true }
          ).catch(() => {});
        }
        if (json.recipient?.id) {
          setDoc(
            doc(db, 'users', String(json.recipient.id)),
            {
              rechargeBalance: Number(json.recipient.rechargeBalance) || 0,
              withdrawalBalance: Number(json.recipient.withdrawalBalance) || 0,
              updatedAt: nowIso,
            },
            { merge: true }
          ).catch(() => {});
        }
        if (json.senderTransaction?.id) {
          setDoc(doc(db, 'transactions', String(json.senderTransaction.id)), json.senderTransaction, { merge: true }).catch(() => {});
        }
        if (json.recipientTransaction?.id) {
          setDoc(doc(db, 'transactions', String(json.recipientTransaction.id)), json.recipientTransaction, { merge: true }).catch(() => {});
        }
      }

      return json;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error executing Admin P2P transfer' };
    }
  },

  // Authoritative Atomic User Withdrawal (SQLite BEGIN IMMEDIATE + Pending/Balance Verification)
  async submitWithdrawal(payload: {
    userId: string;
    amount: number;
    bankDetails: NonNullable<User['bankDetails']>;
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    feePercent?: number;
    fee?: number;
    netPayout?: number;
    user?: User;
    transaction?: Transaction;
  }> {
    try {
      const res = await fetch('/api/user/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Withdrawal request failed' };
      }

      if (!isProductionHost()) {
        const nowIso = new Date().toISOString();
        if (json.user?.id) {
          setDoc(
            doc(db, 'users', String(json.user.id)),
            {
              withdrawalBalance: Number(json.user.withdrawalBalance) || 0,
              bankDetails: json.user.bankDetails || payload.bankDetails,
              isExplicitZeroReset: Number(json.user.withdrawalBalance) === 0,
              updatedAt: json.user.updatedAt || nowIso,
            },
            { merge: true }
          ).catch(() => {});
        }
        if (json.transaction?.id) {
          setDoc(
            doc(db, 'transactions', String(json.transaction.id)),
            json.transaction,
            { merge: true }
          ).catch(() => {});
        }
      }

      return json;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error submitting withdrawal' };
    }
  },
};


