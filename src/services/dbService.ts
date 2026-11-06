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
import { User, Transaction, InvestmentOrder, PlatformSettings, InvestmentProduct, NoticeItem, CustomPromoCode, TeamMember, ReferrerInfo } from '../types';

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

export const mergeUserSafe = (existing: Partial<User> | undefined | null, incoming: Partial<User>): User => {
  const base: any = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming)) {
    // Prevent accidental undefined or null or NaN overwriting of balances & stats (allow valid 0 when deducted or withdrawn)
    if (['rechargeBalance', 'withdrawalBalance', 'productRevenue', 'totalInvested', 'vipLevel', 'spinChances', 'totalReferrals', 'totalCommissionEarned', 'checkInStreak'].includes(k)) {
      if (base[k] !== undefined && (v === null || v === undefined || Number.isNaN(v))) {
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

  // Preserve highest stats
  base.totalReferrals = Math.max(Number(base.totalReferrals) || 0, Number(existing?.totalReferrals) || 0);
  base.totalCommissionEarned = Math.max(Number(base.totalCommissionEarned) || 0, Number(existing?.totalCommissionEarned) || 0);

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
  base.updatedAt = new Date().toISOString();
  return base as User;
};

export const dbService = {
  // Backup & Permanent SQLite SQL Synchronization
  async syncUsersToBackup(users: User[], forceSave: boolean = false): Promise<User[]> {
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
      const res = await fetch('/api/backup/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: mergedList, forceSave, isNewRegistration: forceSave }),
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
    // Ensure we merge with any existing record so password/bankDetails/etc. are never lost
    let completeUser = { ...user };
    try {
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('nexa_users_backup_v2');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            const cleanPhone = user.phone ? String(user.phone).replace(/\D/g, '').slice(-10) : '';
            const existing = parsed.find(
              (u: any) => u.id === user.id || (cleanPhone && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)
            );
            if (existing) {
              completeUser = mergeUserSafe(existing, user);
            }
          }
        }
      }
    } catch {}

    // 1. Permanent SQLite SQL database & disk backup
    await this.syncUsersToBackup([completeUser], forceSave);

    // Also call dedicated /api/user/save endpoint to ensure SQLite WAL commitment
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

    // 2. Firestore cloud sync
    try {
      await setDoc(doc(db, 'users', completeUser.id), {
        ...completeUser,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    try {
      await setDoc(doc(db, 'users', userId), {
        bankDetails,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (fsErr) {
      handleFirestoreError(fsErr, OperationType.WRITE, `users/${userId}`);
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

    // 3. Also check Firestore to ensure latest state and merge
    const path = `users/${backupMatch?.id || cleanId}`;
    try {
      const snap = await getDoc(doc(db, 'users', backupMatch?.id || cleanId));
      if (snap.exists()) {
        const fsUser = snap.data() as User;
        const merged = mergeUserSafe(backupMatch, fsUser);
        await this.syncUsersToBackup([merged], false);
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
    const path = `users/${userId}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists()) {
          const u = snap.data() as User;
          this.syncUsersToBackup([u], false);
          onUpdate(u);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsubscribe;
  },

  // Admin: Get all users permanently by merging Cloud SQL / disk backup + Firestore
  async getAllUsers(): Promise<User[]> {
    const deletedBlacklist = await this.syncDeletedBlacklistFromServer();
    const backupUsers = await this.getUsersFromBackup();
    const byId = new Map<string, User>();
    const phoneToId = new Map<string, string>();

    const addOrMerge = (u: User) => {
      if (!u || (!u.id && !u.phone)) return;
      const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      const rawId = String(u.id || cleanPhone).trim();

      // STRICTLY BLOCK BLACKLISTED USERS
      if (deletedBlacklist.has(rawId) || (cleanPhone && deletedBlacklist.has(cleanPhone))) {
        return;
      }

      const canonicalId = (cleanPhone && phoneToId.get(cleanPhone)) || rawId;
      const prev = byId.get(canonicalId);
      const merged = mergeUserSafe(prev, { ...u, id: canonicalId });
      byId.set(canonicalId, merged);
      if (cleanPhone) phoneToId.set(cleanPhone, canonicalId);
    };

    backupUsers.forEach(addOrMerge);

    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      querySnapshot.forEach((d) => {
        const data = d.data() as User;
        const uId = String(data.id || d.id || '').trim();
        const uPhone = data.phone ? String(data.phone).replace(/\D/g, '').slice(-10) : '';

        // If this document belongs to a deleted user, PURGE IT FROM FIRESTORE!
        if (deletedBlacklist.has(uId) || (uPhone && deletedBlacklist.has(uPhone))) {
          deleteDoc(d.ref).catch(() => {});
          return;
        }

        addOrMerge(data);
      });
    } catch (error) {
      console.warn('Firestore read throttled/quota-exceeded, using persistent backup:', error);
    }

    const combined = Array.from(byId.values()).filter((u) => {
      const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      const rawId = String(u.id || cleanPhone).trim();
      return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
    });

    if (combined.length > 0) {
      // Return fresh authoritative users immediately to prevent Admin Panel reverting to stale server cache
      this.syncUsersToBackup(combined, false).catch((err) =>
        console.warn('Background backup sync failed:', err)
      );
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
          backupUsers.forEach(addOrMerge);
          fsUsers.forEach(addOrMerge);
          const merged = Array.from(byId.values()).filter((u) => {
            const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
            const rawId = String(u.id || cleanPhone).trim();
            return !deletedBlacklist.has(rawId) && (!cleanPhone || !deletedBlacklist.has(cleanPhone));
          });
          onUpdate(merged);
          // Keep server backup and Cloud SQL in sync with live Firestore snapshots in background
          this.syncUsersToBackup(merged, false).catch(() => {});
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
    try {
      const existing = await this.getUser(cleanId);
      const merged: User = mergeUserSafe(existing || { id: cleanId }, data);
      await this.syncUsersToBackup([merged], true);
    } catch (e) {}

    const path = `users/${cleanId}`;
    try {
      await setDoc(doc(db, 'users', cleanId), {
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
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

    // 2. Sync to Firestore
    const path = `transactions/${tx.id}`;
    try {
      await setDoc(doc(db, 'transactions', tx.id), payload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    // 2. Fetch from Firestore
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

    // Merge and deduplicate by primary id and referenceNo
    const mapById = new Map<string, Transaction>();
    const mapByRef = new Map<string, string>();

    const addOrMerge = (t: Transaction) => {
      if (!t) return;
      const id = String(t.id || (t as any)._id || `tx-${t.createdAt || Date.now()}`);
      const ref = t.referenceNo ? String(t.referenceNo).trim() : '';

      let targetId = id;
      if (ref && mapByRef.has(ref)) {
        targetId = mapByRef.get(ref)!;
      }

      const existing = mapById.get(targetId);
      const merged: Transaction = {
        ...(existing || {}),
        ...t,
        id: targetId,
      };

      mapById.set(targetId, merged);
      if (ref) {
        mapByRef.set(ref, targetId);
      }
    };

    for (const t of apiList) addOrMerge(t);
    for (const t of firestoreList) addOrMerge(t);

    return Array.from(mapById.values()).sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
  },

  // Real-time listener for user's transactions
  subscribeToUserTransactions(userId: string, onUpdate: (txs: Transaction[]) => void): () => void {
    const path = 'transactions';
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', userId));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map<string, Transaction>();
          const seenRefs = new Map<string, string>();
          snapshot.forEach((d) => {
            const data = d.data() as Transaction;
            const id = String(data.id || d.id);
            const ref = data.referenceNo ? String(data.referenceNo).trim() : '';

            if (ref && seenRefs.has(ref)) {
              const targetId = seenRefs.get(ref)!;
              const existing = map.get(targetId);
              map.set(targetId, { ...(existing || {}), ...data, id: targetId });
              return;
            }

            map.set(id, { ...data, id });
            if (ref) seenRefs.set(ref, id);
          });
          const list = Array.from(map.values()).sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
          onUpdate(list);
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

    // 2. Fetch from Firestore
    const path = 'transactions';
    let firestoreList: Transaction[] = [];
    try {
      const querySnapshot = await getDocs(collection(db, 'transactions'));
      querySnapshot.forEach((d) => {
        firestoreList.push(d.data() as Transaction);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }

    // Merge and deduplicate by primary id and referenceNo
    const mapById = new Map<string, Transaction>();
    const mapByRef = new Map<string, string>();

    const addOrMerge = (t: Transaction) => {
      if (!t) return;
      const id = String(t.id || (t as any)._id || `tx-${t.createdAt || Date.now()}`);
      const ref = t.referenceNo ? String(t.referenceNo).trim() : '';

      let targetId = id;
      if (ref && mapByRef.has(ref)) {
        targetId = mapByRef.get(ref)!;
      }

      const existing = mapById.get(targetId);
      const merged: Transaction = {
        ...(existing || {}),
        ...t,
        id: targetId,
      };

      mapById.set(targetId, merged);
      if (ref) {
        mapByRef.set(ref, targetId);
      }
    };

    for (const t of apiList) addOrMerge(t);
    for (const t of firestoreList) addOrMerge(t);

    return Array.from(mapById.values()).sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
  },

  // Real-time listener for all admin transactions
  subscribeToAllTransactions(onUpdate: (txs: Transaction[]) => void): () => void {
    const path = 'transactions';
    try {
      const q = collection(db, 'transactions');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map<string, Transaction>();
          const seenRefs = new Map<string, string>();
          snapshot.forEach((d) => {
            const data = d.data() as Transaction;
            const id = String(data.id || d.id);
            const ref = data.referenceNo ? String(data.referenceNo).trim() : '';

            if (ref && seenRefs.has(ref)) {
              const targetId = seenRefs.get(ref)!;
              const existing = map.get(targetId);
              map.set(targetId, { ...(existing || {}), ...data, id: targetId });
              return;
            }

            map.set(id, { ...data, id });
            if (ref) seenRefs.set(ref, id);
          });
          const list = Array.from(map.values()).sort((a, b) => getTransactionTime(b) - getTransactionTime(a));
          onUpdate(list);
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

  // Admin: Update transaction status (Cloud SQL + Firestore)
  async updateTransaction(txId: string, data: Partial<Transaction>): Promise<void> {
    // 1. Update in Cloud SQL backend
    try {
      await fetch('/api/cloudsql/transactions/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId,
          status: data.status,
          referenceNo: data.referenceNo,
          paymentMethod: data.paymentMethod,
        }),
      });
    } catch (err) {
      console.warn('Backend update transaction status warning:', err);
    }

    // 2. Update in Firestore
    const path = `transactions/${txId}`;
    try {
      await setDoc(doc(db, 'transactions', txId), {
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    const path = `transactions/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'transactions', cleanId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Admin: Execute withdrawal action (Approve or Reject with automatic balance refund)
  async adminWithdrawalAction(payload: {
    action: 'approve' | 'reject';
    txId: string;
    referenceNo?: string;
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
  async saveOrder(order: InvestmentOrder, userId: string): Promise<void> {
    const payload = { ...order, userId };
    // 1. Sync to backend API (orders_backup.json + Cloud SQL)
    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: payload, userId }),
        });
      }
    } catch (e) {
      console.warn('Backend order sync warning:', e);
    }

    // 2. Sync to Firestore
    const path = `orders/${order.id}`;
    try {
      await setDoc(doc(db, 'orders', order.id), payload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    // 2. Fetch from Firestore (by userId and also by phone)
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
            this.saveOrder(o, cleanId).catch(() => {});
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
              this.saveOrder(o, cleanId).catch(() => {});
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

    // Firestore real-time listener
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

    // 2. Fallback & Cloud sync: Firestore
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
            // Save to SQL database in background so it is permanently archived
            this.saveOrder(o, o.userId || 'unknown').catch(() => {});
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

    const path = `orders/${orderId}`;
    try {
      await setDoc(doc(db, 'orders', orderId), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    const path = `orders/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'orders', cleanId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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
  ): Promise<{ success: boolean; message: string; order?: InvestmentOrder }> {
    try {
      if (typeof window !== 'undefined') {
        const res = await fetch(`/api/orders/${orderId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = await res.json();
          // Also update Firestore to keep in sync
          if (json.order) {
            await setDoc(doc(db, 'orders', orderId), json.order, { merge: true }).catch(() => {});
          }
          return { success: true, message: json.message || 'Action executed successfully', order: json.order };
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
    if (this._cachedSettings && (now - this._cachedSettings.timestamp < 30000)) {
      return this._cachedSettings.data;
    }
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
    this._cachedSettings = { data: settings, timestamp: Date.now() };
    const path = 'settings/platform';
    try {
      const cleanSettings = JSON.parse(JSON.stringify(settings));
      await setDoc(
        doc(db, 'settings', 'platform'),
        {
          ...cleanSettings,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Real-time listener for platform settings
  subscribeToPlatformSettings(onUpdate: (settings: PlatformSettings) => void): () => void {
    const path = 'settings/platform';
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as PlatformSettings);
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

    // 2. Sync to Firestore
    const path = `products/${enrichedProduct.id}`;
    try {
      await setDoc(doc(db, 'products', enrichedProduct.id), enrichedProduct, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    // 4. Delete from Firestore
    const path = `products/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'products', cleanId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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

    // 2. Sync to Firestore
    const path = `notices/${notice.id}`;
    try {
      await setDoc(doc(db, 'notices', notice.id), notice, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    // 2. Delete from Firestore
    const path = `notices/${noticeId}`;
    try {
      await deleteDoc(doc(db, 'notices', noticeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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

    // 2. Query Firestore
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

    // 3. Sync to Cloud Firestore
    const path = `promoCodes/${promo.id}`;
    try {
      await setDoc(doc(db, 'promoCodes', promo.id), promo, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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

    // 4. Delete from Firestore by doc ID
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
  },

  // Real-time listener for promo codes
  subscribeToPromoCodes(onUpdate: (promos: CustomPromoCode[]) => void): () => void {
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

  // Auth: Find user by mobile phone number (Cloud SQL permanent store first)
  async findUserByPhone(phone: string): Promise<User | null> {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // 1. Primary: Cloud SQL & permanent storage (Fast, zero quota limits, complete profile)
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

      const computeDownlineData = (u: any, level: 1 | 2 | 3) => {
        const cleanP = u.phone ? u.phone.replace(/\D/g, '').slice(-10) : '';
        const masked = cleanP.length === 10 ? `+91 ${cleanP.slice(0, 3)}****${cleanP.slice(-3)}` : `User #${u.id}`;
        const join = (u as any).createdAt ? (u as any).createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const rate = level === 1 ? 10 : level === 2 ? 3 : 1;
        const inv = Number(u.totalInvested) || 0;
        const rec = Number(u.rechargeBalance) || 0;
        const realRecharge = inv > 0 ? inv : rec;
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
          return await res.json();
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
};

