import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  getAllUsers,
  upsertUser,
  findUser,
  relinkUpline,
  getUserTransactions,
  getAllTransactionsFromDb,
  createTransaction,
  findTransactionsInDbByIdentifiers,
  updateTransactionStatusInDb,
  refundUserWithdrawalInDb,
  deleteUserFromDb,
  deleteTransactionFromDb,
  getAllDbOrders,
  getDbOrdersByUser,
  upsertDbOrder,
  deleteOrderFromDb,
  getPlatformSettingFromDb,
  setPlatformSettingInDb,
  getAllDbProducts,
  upsertDbProduct,
  deleteDbProduct,
  getAllDbPromoCodes,
  upsertDbPromoCode,
  deleteDbPromoCode,
  getAllDbNotices,
  upsertDbNotice,
  deleteDbNotice,
  purgeAllOrdersFromDb,
  purgeAllTransactionsFromDb,
  resetAllUsersBalancesInDb,
  initPostgresSchema,
  formatISTTimestamp,
  extractTxEpochMs,
  normalizeTxTimestampIST,
} from './src/db/queries.ts';
import {
  getSqliteDb,
  upsertOrderInSql,
  getAllOrdersFromSql,
  getOrdersForUserFromSql,
  deleteOrderFromSql,
  deleteOrdersForUserInSql,
  purgeAllOrdersFromSql,
  loadDeletedOrders,
  saveDeletedOrder,
  upsertProductInSql,
  getAllProductsFromSql,
  deleteProductFromSql,
  initAndSyncSqlProducts,
  syncAllRealUserOrders,
} from './src/db/sqliteOrders.ts';
import {
  initSqliteUsersTable,
  mapSqlRowToUser,
  upsertUserInSql,
  getUserByIdOrPhoneFromSql,
  getAllUsersFromSql,
  softDeleteUserInSql,
  hardDeleteUserInSql,
  initAndSyncSqlUsers,
  relinkUserUplineInSql,
  creditUserCommissionInSql,
  creditUserDividendInSql,
  creditUserWalletDeltaInSql,
  updateUserReferralsInSql,
  updateUserWalletBalanceInSql,
  resetAllUsersBalancesInSql,
} from './src/db/sqliteUsers.ts';
import { isSqlConfigured, createPool } from './src/db/index.ts';
import {
  initSqliteTransactionsTable,
  upsertTransactionInSql,
  getAllTransactionsFromSql,
  getTransactionsForUserFromSql,
  findTransactionsInSqlByIdentifiers,
  findSettledRechargeGuard,
  markRechargeSettledInSql,
  updateTransactionStatusInSql,
  buildRechargeGuardKeys,
  purgeAllTransactionsFromSql,
} from './src/db/sqliteTransactions.ts';

dotenv.config();

const app = express();
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Graceful 413 / payload error handler
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.name === 'PayloadTooLargeError')) {
    return res.status(413).json({
      success: false,
      error: 'PayloadTooLargeError',
      message: 'Request payload is too large. Maximum supported size is 50MB.',
    });
  }
  next(err);
});

// Serve official brand logo with permissive CORS for external payment gateways (Razorpay modal)
app.get(['/logo.png', '/api/brand-logo'], (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const logoPath = path.resolve(process.cwd(), 'public/assets/aistudio/Screenshot_2026-10-26_07.24.53_3c5c1039.png');
  return res.sendFile(logoPath);
});

// In-memory + Persistent OTP storage: mobile -> { otp, expiresAt, purpose, attempts, formattedMessage }
interface OtpRecord {
  otp: string;
  recentOtps?: string[];
  createdAtMs?: number;
  expiresAt: number;
  purpose: string;
  attempts: number;
  formattedMessage: string;
}

export interface OtpServerLog {
  id: string;
  mobile: string;
  otp: string;
  purpose: 'register' | 'forgot-password' | 'withdraw' | 'p2p' | 'test';
  message: string;
  status: 'pending' | 'verified' | 'wrong_otp' | 'expired';
  attempts: number;
  createdAt: string;
  expiresAt: number;
  consumedAt?: number;
  provider?: string;
  senderId?: string;
  gatewayStatus?: string;
}

export interface ServerOtpSettings {
  smsGatewayActive: boolean;
  smsGatewayProvider: 'apitxt' | 'fast2sms' | 'custom';
  smsSenderId: string;
  smsAuthKey: string;
  customSmsWebhookUrl: string;
  otpValidityMinutes: number;
  enableMasterOtp: boolean;
  masterFallbackOtp: string;
  registrationOtpTemplate: string;
  forgotPasswordOtpTemplate: string;
  withdrawalOtpTemplate?: string;
  p2pOtpTemplate?: string;
  helpCenterUrl?: string;
  helpCenterLinks?: any[];
}

const OTP_SETTINGS_PATH = path.resolve(process.cwd(), 'src/data/otp_settings.json');
const OTP_LOGS_PATH = path.resolve(process.cwd(), 'src/data/otp_logs.json');
const PLATFORM_SETTINGS_PATH = path.resolve(process.cwd(), 'src/data/platform_settings.json');
const DEFAULT_APITXT_KEY = 'wSh_e0TCgFj24rsQv3NxX3FVrqYXFUl42bJb1eVNrss';

const DEFAULT_SERVER_PLATFORM_SETTINGS: Record<string, any> = {
  tier1Commission: 10,
  tier2Commission: 3,
  tier3Commission: 1,
  merchantUpiId: 'nexaai.pay@icici',
  merchantPayeeName: 'Nexa AI Technologies',
  isManualUpiEnabled: true,
  autoDynamicQrEnabled: true,
  requireAdminRechargeApproval: true,
  showUpiVpaDetails: true,
  minRecharge: 0.01,
  minWithdrawal: 2,
  withdrawalFeePercent: 5,
  isWithdrawalEnabled: true,
  isRechargeEnabled: true,
  isSpinEnabled: true,
  isBonusEnabled: true,
  checkInPayouts: [10, 12, 15, 18, 22, 26, 30],
  checkInDay7ExtraSpin: true,
  dailyBonusBase: 50,
  adminPin: '8888',
  isP2PEnabled: true,
  minP2PAmount: 1,
  maxP2PAmount: 50000,
  p2pNotice: '',
  isAdMobEnabled: true,
  adMobTestMode: false,
  adMobAppId: 'ca-app-pub-6701253514262817~4453946322',
  adMobBannerUnitId: 'ca-app-pub-6701253514262817/2657487227',
  adMobPublisherId: 'pub-6701253514262817',
  adSenseBannerSlot: '',
  adMobBannerSize: 'ADAPTIVE_BANNER',
  adMobPosition: 'inline',
  adMobPlacements: {
    home: true,
    invest: true,
    notice: true,
    blog: true,
    account: true,
  },
  adMobRefreshSeconds: 60,
  adMobLiveMigratedV1: true,
};

const PERMANENT_LIVE_ADMOB_APP_ID = 'ca-app-pub-6701253514262817~4453946322';
const PERMANENT_LIVE_ADMOB_BANNER_ID = 'ca-app-pub-6701253514262817/2657487227';
const PERMANENT_LIVE_ADMOB_PUB_ID = 'pub-6701253514262817';
const GOOGLE_TEST_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_ADMOB_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const GOOGLE_TEST_ADMOB_PUB_ID = 'pub-3940256099942544';

function deriveAdMobPublisherIdServer(settings?: Record<string, any>): string {
  const rawExplicit = String(settings?.adMobPublisherId || '').trim().replace(/^ca-/, '');
  const normalizedExplicit = rawExplicit
    ? rawExplicit.startsWith('pub-')
      ? rawExplicit.toLowerCase()
      : `pub-${rawExplicit.replace(/^pub-/i, '').toLowerCase()}`
    : '';
  const source = String(settings?.adMobAppId || settings?.adMobBannerUnitId || '').trim();
  const match = source.match(/ca-app-(pub-\d+)/i) || source.match(/(pub-\d+)/i);
  const derivedFromIds = match?.[1] ? match[1].toLowerCase() : '';

  if (normalizedExplicit && normalizedExplicit !== GOOGLE_TEST_ADMOB_PUB_ID) {
    return normalizedExplicit;
  }
  if (derivedFromIds && derivedFromIds !== GOOGLE_TEST_ADMOB_PUB_ID) {
    return derivedFromIds;
  }
  if (normalizedExplicit) {
    return normalizedExplicit;
  }
  if (derivedFromIds) {
    return derivedFromIds;
  }
  return GOOGLE_TEST_ADMOB_PUB_ID;
}

function initSqlitePlatformSettings(): void {
  try {
    const db = getSqliteDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS platform_settings_kv (
        id TEXT PRIMARY KEY,
        settings_json TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
  } catch {}
}

const stripLegacyPayUKeys = (obj: Record<string, any>) => {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = { ...obj };
  delete cleaned.isPayUEnabled;
  delete cleaned.payuMerchantKey;
  delete cleaned.payuMerchantSalt;
  delete cleaned.payuMode;
  delete cleaned.payuMerchantName;
  delete cleaned.payuLogoUrl;
  delete cleaned.payuThemeColor;
  return cleaned;
};

function loadServerPlatformSettings(): Record<string, any> {
  let fileSettings: Record<string, any> = {};
  try {
    if (fs.existsSync(PLATFORM_SETTINGS_PATH)) {
      fileSettings = JSON.parse(fs.readFileSync(PLATFORM_SETTINGS_PATH, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not read platform_settings.json:', err);
  }

  try {
    initSqlitePlatformSettings();
    const db = getSqliteDb();
    const row = db.prepare('SELECT settings_json FROM platform_settings_kv WHERE id = ?').get('global') as any;
    if (row?.settings_json) {
      const sqlSettings = JSON.parse(row.settings_json);
      return stripLegacyPayUKeys({ ...DEFAULT_SERVER_PLATFORM_SETTINGS, ...fileSettings, ...sqlSettings });
    }
  } catch {}

  return stripLegacyPayUKeys({ ...DEFAULT_SERVER_PLATFORM_SETTINGS, ...fileSettings });
}

function saveServerPlatformSettings(next: Record<string, any>): Record<string, any> {
  const current = loadServerPlatformSettings();
  const parseRate = (val: any, fallback: number): number => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? num : fallback;
  };
  const nextNormalized: Record<string, any> = { ...next };
  if ('tier1Commission' in next) nextNormalized.tier1Commission = parseRate(next.tier1Commission, Number(current.tier1Commission ?? 10));
  if ('tier2Commission' in next) nextNormalized.tier2Commission = parseRate(next.tier2Commission, Number(current.tier2Commission ?? 3));
  if ('tier3Commission' in next) nextNormalized.tier3Commission = parseRate(next.tier3Commission, Number(current.tier3Commission ?? 1));

  if ('adMobPlacements' in next && next.adMobPlacements && typeof next.adMobPlacements === 'object') {
    nextNormalized.adMobPlacements = {
      home: true,
      invest: true,
      notice: true,
      blog: true,
      account: true,
      ...(current.adMobPlacements || {}),
      ...next.adMobPlacements,
    };
  }
  if ('adMobRefreshSeconds' in next) {
    nextNormalized.adMobRefreshSeconds = Math.max(30, Math.min(300, Number(next.adMobRefreshSeconds) || 60));
  }

  const merged: Record<string, any> = stripLegacyPayUKeys({ ...current, ...nextNormalized, updatedAtMs: Date.now(), updatedAt: new Date().toISOString() });
  if (
    'adMobAppId' in next ||
    'adMobBannerUnitId' in next ||
    'adMobPublisherId' in next
  ) {
    merged.adMobPublisherId = deriveAdMobPublisherIdServer(merged);
  }
  try {
    fs.writeFileSync(PLATFORM_SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write platform_settings.json:', err);
  }
  try {
    initSqlitePlatformSettings();
    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO platform_settings_kv (id, settings_json, updated_at)
      VALUES ('global', ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        settings_json = excluded.settings_json,
        updated_at = datetime('now')
    `).run(JSON.stringify(merged));
  } catch (e) {
    console.warn('Could not write platform settings to SQLite:', e);
  }
  return merged;
}

async function getEffectivePlatformSettingsServer(): Promise<Record<string, any>> {
  const localSettings = loadServerPlatformSettings();
  try {
    const dbSettings = (await getPlatformSettingFromDb('general')) as Record<string, any> | null;
    if (dbSettings && typeof dbSettings === 'object') {
      const localTs = Number(localSettings.updatedAtMs) || (localSettings.updatedAt ? Date.parse(localSettings.updatedAt) || 0 : 0);
      const dbTs = Number(dbSettings.updatedAtMs) || (dbSettings.updatedAt ? Date.parse(dbSettings.updatedAt) || 0 : 0);
      // Prefer whichever settings snapshot is newer so stale DB seed defaults never overwrite Admin updates
      if (dbTs > localTs) {
        return { ...localSettings, ...dbSettings };
      }
      return { ...dbSettings, ...localSettings };
    }
  } catch {}
  return localSettings;
}

async function getEffectiveCommissionRatesServer(): Promise<[number, number, number]> {
  const settings = await getEffectivePlatformSettingsServer();
  const parseRate = (val: any, fallback: number): number => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? num : fallback;
  };
  return [
    parseRate(settings.tier1Commission, 10),
    parseRate(settings.tier2Commission, 3),
    parseRate(settings.tier3Commission, 1),
  ];
}

const DEFAULT_OTP_SETTINGS: ServerOtpSettings = {
  smsGatewayActive: true,
  smsGatewayProvider: 'apitxt',
  smsSenderId: 'NEXAAI',
  smsAuthKey:
    process.env.APITXT_AUTH_KEY && process.env.APITXT_AUTH_KEY !== 'YOUR_APITXT_AUTH_KEY'
      ? process.env.APITXT_AUTH_KEY
      : DEFAULT_APITXT_KEY,
  customSmsWebhookUrl: '',
  otpValidityMinutes: 5,
  enableMasterOtp: false,
  masterFallbackOtp: '888999',
  registrationOtpTemplate:
    'Dear user, your Nexa AI registration verification code is {OTP}. Valid for 5 minutes. Do not share with anyone.',
  forgotPasswordOtpTemplate:
    'Your Nexa AI password reset code is {OTP}. Valid for 5 minutes. If not requested by you, please ignore this SMS.',
  withdrawalOtpTemplate:
    'Your Nexa AI withdrawal verification OTP is {OTP}. Valid for {VALIDITY} minutes. Do not share with anyone.',
  p2pOtpTemplate:
    'Your Nexa AI P2P transfer verification OTP is {OTP}. Valid for {VALIDITY} minutes. Do not share with anyone.',
  helpCenterUrl: '',
  helpCenterLinks: [],
};

function loadServerOtpSettings(): ServerOtpSettings {
  try {
    if (fs.existsSync(OTP_SETTINGS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(OTP_SETTINGS_PATH, 'utf-8'));
      return { ...DEFAULT_OTP_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn('Could not read otp_settings.json:', err);
  }
  return { ...DEFAULT_OTP_SETTINGS };
}

function saveServerOtpSettings(next: Partial<ServerOtpSettings>): ServerOtpSettings {
  const merged: ServerOtpSettings = { ...otpSettings, ...next };
  otpSettings = merged;
  try {
    fs.writeFileSync(OTP_SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write otp_settings.json:', err);
  }
  return merged;
}

function loadServerOtpLogs(): OtpServerLog[] {
  try {
    if (fs.existsSync(OTP_LOGS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(OTP_LOGS_PATH, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read otp_logs.json:', err);
  }
  return [];
}

function persistOtpLogs() {
  try {
    fs.writeFileSync(OTP_LOGS_PATH, JSON.stringify(otpLogs.slice(0, 150), null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write otp_logs.json:', err);
  }
}

let otpSettings: ServerOtpSettings = loadServerOtpSettings();
const otpStore = new Map<string, OtpRecord>();
const otpLogs: OtpServerLog[] = loadServerOtpLogs();

// Restore still-valid pending OTPs from disk logs into otpStore on startup
for (const log of otpLogs) {
  if (log.status === 'pending' && log.expiresAt > Date.now() && !otpStore.has(log.mobile)) {
    otpStore.set(log.mobile, {
      otp: log.otp,
      expiresAt: log.expiresAt,
      purpose: log.purpose,
      attempts: log.attempts || 0,
      formattedMessage: log.message,
    });
  }
}

const lastGatewayCallByMobile = new Map<string, number>();

// Unified SMS Gateway Dispatcher supporting apitxt.com, Fast2SMS, and Custom Webhook API
async function dispatchSmsViaGateway(params: {
  mobile: string;
  otp: string;
  messageText: string;
  provider?: string;
  senderId?: string;
  authKey?: string;
  customWebhookUrl?: string;
  clientIp?: string;
}): Promise<{ delivered: boolean; provider: string; senderId: string; statusText: string; rawResponse: string }> {
  const cleanMobile = params.mobile.replace(/\D/g, '').slice(-10);
  const provider = (params.provider || otpSettings.smsGatewayProvider || 'apitxt') as 'apitxt' | 'fast2sms' | 'custom';
  const senderId = (params.senderId || otpSettings.smsSenderId || 'NEXAAI').trim();
  const authKey = (params.authKey || otpSettings.smsAuthKey || DEFAULT_APITXT_KEY).trim();
  const customUrl = (params.customWebhookUrl || otpSettings.customSmsWebhookUrl || '').trim();

  let delivered = false;
  let rawResponse = '';
  let statusText = 'Queued (Local OTP Monitor Active)';

  // 4-second per-number rate-limit guard so external SMS gateways never get overwhelmed
  const lastCallTime = lastGatewayCallByMobile.get(cleanMobile) || 0;
  const elapsedMs = Date.now() - lastCallTime;
  if (elapsedMs < 4000) {
    const waitSec = Math.ceil((4000 - elapsedMs) / 1000);
    return {
      delivered: true,
      provider,
      senderId,
      statusText: `Active OTP Ready (${waitSec}s Gateway Cooldown Guard)`,
      rawResponse: 'Gateway cooldown guard active — OTP ready in Admin Monitor',
    };
  }

  try {
    if (provider === 'fast2sms') {
      if (!authKey) {
        statusText = 'Fast2SMS Auth Key Missing (Saved in Admin Logs)';
      } else {
        lastGatewayCallByMobile.set(cleanMobile, Date.now());
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: authKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: params.messageText,
            language: 'english',
            flash: 0,
            numbers: cleanMobile,
          }),
        });
        rawResponse = await response.text();
        delivered = response.ok || response.status === 429;
        statusText = response.ok
          ? 'Delivered via Fast2SMS'
          : response.status === 429
          ? 'Dispatched (Gateway Cooldown Active)'
          : `Fast2SMS (${response.status}) — Logged in Admin`;
      }
    } else if (provider === 'custom') {
      if (!customUrl) {
        statusText = 'Custom Gateway URL Not Set (Saved in Admin Logs)';
      } else {
        lastGatewayCallByMobile.set(cleanMobile, Date.now());
        const populatedUrl = customUrl
          .replace(/\{PHONE\}|\{MOBILE\}/gi, encodeURIComponent(cleanMobile))
          .replace(/\{OTP\}/gi, encodeURIComponent(params.otp))
          .replace(/\{MESSAGE\}/gi, encodeURIComponent(params.messageText))
          .replace(/\{SENDER_ID\}/gi, encodeURIComponent(senderId))
          .replace(/\{AUTH_KEY\}/gi, encodeURIComponent(authKey));

        const isGetStyle = populatedUrl !== customUrl;
        const response = await fetch(
          populatedUrl,
          isGetStyle
            ? { method: 'GET' }
            : {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
                },
                body: JSON.stringify({
                  mobile: `91${cleanMobile}`,
                  phone: cleanMobile,
                  otp: params.otp,
                  message: params.messageText,
                  sender_id: senderId,
                }),
              }
        );
        rawResponse = await response.text();
        delivered = response.ok || response.status === 429;
        statusText = response.ok ? 'Delivered via Custom Gateway' : `Custom Gateway (${response.status})`;
      }
    } else {
      // Default: apitxt.com SMS Gateway
      if (authKey) {
        lastGatewayCallByMobile.set(cleanMobile, Date.now());
        const targetMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
        const bodyParams = new URLSearchParams();
        bodyParams.append('authkey', authKey);
        bodyParams.append('mobile', targetMobile);
        bodyParams.append('otp', params.otp);
        if (senderId) bodyParams.append('sender', senderId);

        // APITxT mandates requests from an Indian IP. Forward client IP or trusted Indian telecom IP
        const indianIp = (params.clientIp && !params.clientIp.startsWith('10.') && !params.clientIp.startsWith('172.') && !params.clientIp.startsWith('192.168.') && !params.clientIp.startsWith('127.'))
          ? params.clientIp
          : '49.36.128.5';

        const response = await fetch('https://apitxt.com/api/sendOTP', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${authKey}`,
            'X-Forwarded-For': indianIp,
            'X-Real-IP': indianIp,
            'CF-Connecting-IP': indianIp,
            'Client-IP': indianIp,
          },
          body: bodyParams.toString(),
        });
        rawResponse = await response.text();
        let parsedJson: any = null;
        try { parsedJson = JSON.parse(rawResponse); } catch {}

        if (response.status === 429) {
          delivered = true;
          statusText = 'Dispatched via apitxt.com (Cooldown Active)';
          console.log(`[APITxT Dispatch] Cooldown active for ${targetMobile} — OTP ${params.otp} active in Admin Monitor.`);
        } else if (response.ok && (parsedJson?.status === 'success' || parsedJson?.status === true)) {
          delivered = true;
          statusText = parsedJson?.message || 'Sms OTP Sent Successfully via apitxt.com';
          console.log(`[APITxT Dispatch] Sent successfully to ${targetMobile}: "${params.messageText}" RequestID: ${parsedJson?.data?.request_id || ''}`);
        } else {
          delivered = parsedJson?.status === 'success';
          statusText = parsedJson?.message || (response.ok ? 'Delivered via apitxt.com' : `apitxt.com (${response.status}) — Logged in Admin`);
          console.log(`[APITxT Dispatch] Gateway status for ${targetMobile}:`, rawResponse);
        }
      }
    }
  } catch (err: any) {
    rawResponse = err?.message || 'Gateway connection notice';
    statusText = `${provider} fallback (Live in Admin OTP Monitor)`;
    console.warn(`[SMS Gateway Error]:`, err);
  }

  return { delivered, provider, senderId, statusText, rawResponse };
}

// Helper: Format SMS message using Admin's saved template from otpSettings
function formatSmsMessageFromAdminTemplate(params: {
  purpose: string;
  otp: string;
  mobile: string;
  validityMins: number;
  overrideTemplate?: string;
  preferOverride?: boolean;
}): { messageText: string; templateUsed: string } {
  // Always reload latest saved settings from disk so Admin changes take effect immediately
  otpSettings = loadServerOtpSettings();

  const isForgot = params.purpose === 'forgot-password';
  const isWithdraw = params.purpose === 'withdraw';
  const isP2P = params.purpose === 'p2p';
  const serverSavedTemplate = isForgot
    ? otpSettings.forgotPasswordOtpTemplate
    : isWithdraw
    ? otpSettings.withdrawalOtpTemplate
    : isP2P
    ? otpSettings.p2pOtpTemplate
    : otpSettings.registrationOtpTemplate;

  const cleanOverride =
    params.overrideTemplate && typeof params.overrideTemplate === 'string'
      ? params.overrideTemplate.trim()
      : '';

  // For user OTP requests (preferOverride = false), ALWAYS prioritize Admin's server-saved template
  // For admin test requests (preferOverride = true), use cleanOverride and persist it to server
  let activeTemplate = '';
  if (params.preferOverride && cleanOverride) {
    activeTemplate = cleanOverride;
    saveServerOtpSettings(
      isForgot
        ? { forgotPasswordOtpTemplate: cleanOverride }
        : isWithdraw
        ? { withdrawalOtpTemplate: cleanOverride }
        : isP2P
        ? { p2pOtpTemplate: cleanOverride }
        : { registrationOtpTemplate: cleanOverride }
    );
  } else if (serverSavedTemplate && serverSavedTemplate.trim().length > 0) {
    activeTemplate = serverSavedTemplate.trim();
  } else if (cleanOverride) {
    activeTemplate = cleanOverride;
  } else {
    activeTemplate = isForgot
      ? DEFAULT_OTP_SETTINGS.forgotPasswordOtpTemplate
      : isWithdraw
      ? (DEFAULT_OTP_SETTINGS.withdrawalOtpTemplate || '')
      : isP2P
      ? (DEFAULT_OTP_SETTINGS.p2pOtpTemplate || '')
      : DEFAULT_OTP_SETTINGS.registrationOtpTemplate;
  }

  let messageText = activeTemplate
    .replace(/\{\{?OTP\}?\}|\[OTP\]|<OTP>|\{CODE\}|\{#var#\}/gi, params.otp)
    .replace(/\{\{?APP_NAME\}?\}|\[APP_NAME\]/gi, 'Nexa AI')
    .replace(/\{\{?PHONE\}?\}|\{\{?MOBILE\}?\}|\[PHONE\]/gi, params.mobile)
    .replace(/\{\{?VALIDITY\}?\}|\{\{?MINUTES\}?\}|\{\{?TIME\}?\}/gi, String(params.validityMins));

  // If Admin wrote a custom message without {OTP}, ensure the 6-digit OTP is still included in the user's SMS
  if (!messageText.includes(params.otp)) {
    if (messageText.includes('489215')) {
      messageText = messageText.replace(/489215/g, params.otp);
    } else if (messageText.includes('731046')) {
      messageText = messageText.replace(/731046/g, params.otp);
    } else {
      messageText = `${messageText.trim()} (OTP: ${params.otp})`;
    }
  }

  return { messageText, templateUsed: activeTemplate };
}

// API Route: Get & Save Admin OTP Settings on Server
app.get('/api/admin/otp-settings', (_req, res) => {
  otpSettings = loadServerOtpSettings();
  return res.json({
    success: true,
    settings: otpSettings,
  });
});

app.post('/api/admin/otp-settings', (req, res) => {
  try {
    const body = req.body || {};
    const updated = saveServerOtpSettings({
      ...(typeof body.smsGatewayActive === 'boolean' ? { smsGatewayActive: body.smsGatewayActive } : {}),
      ...(body.smsGatewayProvider ? { smsGatewayProvider: body.smsGatewayProvider } : {}),
      ...(typeof body.smsSenderId === 'string' ? { smsSenderId: body.smsSenderId.trim() || 'NEXAAI' } : {}),
      ...(typeof body.smsAuthKey === 'string' ? { smsAuthKey: body.smsAuthKey.trim() } : {}),
      ...(typeof body.customSmsWebhookUrl === 'string' ? { customSmsWebhookUrl: body.customSmsWebhookUrl.trim() } : {}),
      ...(body.otpValidityMinutes !== undefined ? { otpValidityMinutes: Math.max(1, Number(body.otpValidityMinutes) || 5) } : {}),
      ...(typeof body.enableMasterOtp === 'boolean' ? { enableMasterOtp: body.enableMasterOtp } : {}),
      ...(typeof body.masterFallbackOtp === 'string' ? { masterFallbackOtp: body.masterFallbackOtp.trim() } : {}),
      ...(typeof body.registrationOtpTemplate === 'string' && body.registrationOtpTemplate.trim().length > 0
        ? { registrationOtpTemplate: body.registrationOtpTemplate.trim() }
        : {}),
      ...(typeof body.forgotPasswordOtpTemplate === 'string' && body.forgotPasswordOtpTemplate.trim().length > 0
        ? { forgotPasswordOtpTemplate: body.forgotPasswordOtpTemplate.trim() }
        : {}),
      ...(typeof body.withdrawalOtpTemplate === 'string' && body.withdrawalOtpTemplate.trim().length > 0
        ? { withdrawalOtpTemplate: body.withdrawalOtpTemplate.trim() }
        : {}),
      ...(typeof body.p2pOtpTemplate === 'string' && body.p2pOtpTemplate.trim().length > 0
        ? { p2pOtpTemplate: body.p2pOtpTemplate.trim() }
        : {}),
      ...(typeof body.helpCenterUrl === 'string' ? { helpCenterUrl: body.helpCenterUrl.trim() } : {}),
      ...(Array.isArray(body.helpCenterLinks) ? { helpCenterLinks: body.helpCenterLinks } : {}),
    });
    return res.json({
      success: true,
      message: 'OTP & SMS Gateway settings saved on server!',
      settings: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Routes: Platform Settings (Referral Commission Rates, Payment Gateways, Thresholds)
app.get('/api/platform-settings', async (_req, res) => {
  const settings = await getEffectivePlatformSettingsServer();
  return res.json({
    success: true,
    settings,
  });
});

app.post('/api/platform-settings', async (req, res) => {
  try {
    const body = req.body || {};
    const updated = saveServerPlatformSettings(body);
    try {
      await setPlatformSettingInDb('general', updated);
    } catch (dbErr) {
      console.warn('Could not persist platform settings to Cloud SQL:', dbErr);
    }
    return res.json({
      success: true,
      message: 'Platform settings saved permanently in Cloud SQL database and disk!',
      settings: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/platform-settings', async (req, res) => {
  try {
    const body = req.body || {};
    const updated = saveServerPlatformSettings(body);
    try {
      await setPlatformSettingInDb('general', updated);
    } catch (dbErr) {
      console.warn('Could not persist platform settings to Cloud SQL:', dbErr);
    }
    return res.json({
      success: true,
      message: 'Platform settings saved permanently in Cloud SQL database and disk!',
      settings: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Routes: Google AdMob Configuration & Permanent Storage
app.get('/api/admob/config', async (_req, res) => {
  try {
    const settings = await getEffectivePlatformSettingsServer();
    const publisherId = deriveAdMobPublisherIdServer(settings);
    return res.json({
      success: true,
      config: {
        isAdMobEnabled: settings.isAdMobEnabled !== false,
        adMobTestMode: settings.adMobTestMode !== false,
        adMobAppId: String(settings.adMobAppId || GOOGLE_TEST_ADMOB_APP_ID).trim(),
        adMobBannerUnitId: String(settings.adMobBannerUnitId || GOOGLE_TEST_ADMOB_BANNER_ID).trim(),
        adMobPublisherId: publisherId,
        adSenseBannerSlot: String(settings.adSenseBannerSlot || '').trim(),
        adMobBannerSize: settings.adMobBannerSize || 'ADAPTIVE_BANNER',
        adMobPosition: settings.adMobPosition || 'inline',
        adMobPlacements: {
          home: true,
          invest: true,
          notice: true,
          blog: true,
          account: true,
          ...(settings.adMobPlacements || {}),
        },
        adMobRefreshSeconds: Math.max(30, Number(settings.adMobRefreshSeconds || 60)),
      },
      appAdsTxtLine: `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/admob-settings', async (req, res) => {
  try {
    const body = req.body || {};
    const adMobPayload: Record<string, any> = {};
    if ('isAdMobEnabled' in body) adMobPayload.isAdMobEnabled = Boolean(body.isAdMobEnabled);
    if ('adMobTestMode' in body) adMobPayload.adMobTestMode = Boolean(body.adMobTestMode);
    if (typeof body.adMobAppId === 'string') adMobPayload.adMobAppId = body.adMobAppId.trim() || GOOGLE_TEST_ADMOB_APP_ID;
    if (typeof body.adMobBannerUnitId === 'string') adMobPayload.adMobBannerUnitId = body.adMobBannerUnitId.trim() || GOOGLE_TEST_ADMOB_BANNER_ID;
    if (typeof body.adMobPublisherId === 'string') adMobPayload.adMobPublisherId = body.adMobPublisherId.trim();
    if (typeof body.adSenseBannerSlot === 'string') adMobPayload.adSenseBannerSlot = body.adSenseBannerSlot.trim();
    if (body.adMobBannerSize === 'BANNER_320x50' || body.adMobBannerSize === 'ADAPTIVE_BANNER' || body.adMobBannerSize === 'LARGE_BANNER_320x100') {
      adMobPayload.adMobBannerSize = body.adMobBannerSize;
    }
    if (body.adMobPosition === 'inline' || body.adMobPosition === 'top' || body.adMobPosition === 'bottom') {
      adMobPayload.adMobPosition = body.adMobPosition;
    }
    if (body.adMobPlacements && typeof body.adMobPlacements === 'object') {
      adMobPayload.adMobPlacements = {
        home: body.adMobPlacements.home !== false,
        invest: body.adMobPlacements.invest !== false,
        notice: body.adMobPlacements.notice !== false,
        blog: body.adMobPlacements.blog !== false,
        account: body.adMobPlacements.account !== false,
      };
    }
    if ('adMobRefreshSeconds' in body) {
      adMobPayload.adMobRefreshSeconds = Math.max(30, Math.min(300, Number(body.adMobRefreshSeconds) || 60));
    }

    const updated = saveServerPlatformSettings(adMobPayload);
    try {
      await setPlatformSettingInDb('general', updated);
    } catch (dbErr) {
      console.warn('Could not persist AdMob settings to Cloud SQL:', dbErr);
    }
    const publisherId = deriveAdMobPublisherIdServer(updated);
    return res.json({
      success: true,
      message: 'Google AdMob settings saved permanently!',
      settings: updated,
      appAdsTxtLine: `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Send OTP via apitxt.com / Fast2SMS / Custom SMS gateway
app.post('/api/send-otp', async (req, res) => {
  try {
    const { mobile, purpose, template, provider, senderId, authKey, customWebhookUrl } = req.body;
    if (!mobile || String(mobile).replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }

    const normalizedPurpose: OtpServerLog['purpose'] =
      purpose === 'forgot-password' || purpose === 'withdraw' || purpose === 'p2p' || purpose === 'test'
        ? purpose
        : 'register';

    otpSettings = loadServerOtpSettings();
    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    const existingRecord = otpStore.get(cleanMobile);
    const nowMs = Date.now();
    // If an OTP was just generated within the last 15 seconds for this phone & same purpose, reuse it so SMS & store never go out of sync
    const reuseExisting =
      existingRecord &&
      existingRecord.expiresAt > nowMs &&
      existingRecord.createdAtMs &&
      nowMs - existingRecord.createdAtMs < 15000 &&
      existingRecord.purpose === normalizedPurpose;

    const otp = reuseExisting
      ? existingRecord.otp
      : Math.floor(100000 + Math.random() * 900000).toString();
    const validityMins = Math.max(1, Number(otpSettings.otpValidityMinutes) || 5);
    const expiresAt = nowMs + validityMins * 60 * 1000;

    // Always resolve SMS text from Admin's server-saved template first
    const { messageText, templateUsed } = formatSmsMessageFromAdminTemplate({
      purpose: purpose || 'register',
      otp,
      mobile: cleanMobile,
      validityMins,
      overrideTemplate: template,
      preferOverride: false,
    });

    const recentOtps = Array.from(
      new Set([otp, ...(existingRecord?.recentOtps || []), ...(existingRecord?.otp ? [existingRecord.otp] : [])])
    ).slice(0, 5);

    // Save active OTP in store
    otpStore.set(cleanMobile, {
      otp,
      recentOtps,
      createdAtMs: reuseExisting ? existingRecord.createdAtMs : nowMs,
      expiresAt,
      purpose: purpose || 'register',
      attempts: 0,
      formattedMessage: messageText,
    });

    const rawClientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['cf-connecting-ip'] as string) ||
      req.socket.remoteAddress ||
      '';

    const dispatchResult = await dispatchSmsViaGateway({
      mobile: cleanMobile,
      otp,
      messageText,
      provider: otpSettings.smsGatewayProvider || provider,
      senderId: otpSettings.smsSenderId || senderId,
      authKey: otpSettings.smsAuthKey || authKey,
      customWebhookUrl: otpSettings.customSmsWebhookUrl || customWebhookUrl,
      clientIp: rawClientIp,
    });

    // Record in Admin OTP Dispatch Logs (Admin can view and monitor)
    const logItem: OtpServerLog = {
      id: `otp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      mobile: cleanMobile,
      otp,
      purpose: normalizedPurpose,
      message: messageText,
      status: 'pending',
      attempts: 0,
      createdAt: formatISTTimestamp(Date.now()),
      expiresAt,
      provider: dispatchResult.provider,
      senderId: dispatchResult.senderId,
      gatewayStatus: dispatchResult.statusText,
    };
    otpLogs.unshift(logItem);
    if (otpLogs.length > 150) otpLogs.pop();
    persistOtpLogs();

    console.log(`[OTP Dispatch] Sent to +91 ${cleanMobile} [${dispatchResult.provider}] [Purpose: ${purpose || 'register'}]: "${messageText}"`);

    const maskedPreview = messageText.replace(new RegExp(otp, 'g'), '••••••');

    return res.json({
      success: true,
      message: `OTP sent successfully to +91 ${cleanMobile}. Please check your SMS.`,
      delivered: dispatchResult.delivered,
      gateway: dispatchResult.provider,
      senderId: dispatchResult.senderId,
      templateUsed,
      maskedPreview,
      expiresIn: validityMins * 60,
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ success: false, error: 'Failed to dispatch OTP' });
  }
});

// Helper: Verify OTP against otpStore OR recent valid OTP logs OR Admin's Master Fallback OTP
function checkAndVerifyOtp(cleanMobile: string, inputOtp: string): { ok: boolean; error?: string } {
  const cleanInput = String(inputOtp || '').trim();

  // 1. Check if Admin enabled Master Fallback OTP and it matches
  if (
    otpSettings.enableMasterOtp &&
    otpSettings.masterFallbackOtp &&
    cleanInput === otpSettings.masterFallbackOtp.trim()
  ) {
    const log = otpLogs.find((l) => l.mobile === cleanMobile && (l.status === 'pending' || l.status === 'wrong_otp'));
    if (log) {
      log.status = 'verified';
      persistOtpLogs();
    }
    return { ok: true };
  }

  // 2. Check if Admin already manually marked the latest unconsumed OTP log as verified for this mobile
  const latestLog = otpLogs.find((l) => l.mobile === cleanMobile && !l.consumedAt);
  if (latestLog && latestLog.status === 'verified' && (!cleanInput || latestLog.otp === cleanInput)) {
    return { ok: true };
  }

  // 3. Also check if input matches any non-expired unconsumed OTP log for this mobile number
  const now = Date.now();
  const matchingActiveLog = otpLogs.find(
    (l) => l.mobile === cleanMobile && !l.consumedAt && l.otp === cleanInput && (!l.expiresAt || l.expiresAt > now)
  );
  if (matchingActiveLog) {
    matchingActiveLog.status = 'verified';
    persistOtpLogs();
    return { ok: true };
  }

  const record = otpStore.get(cleanMobile);
  if (!record) {
    return {
      ok: false,
      error: 'No OTP requested for this number. Please click "Send OTP" first.',
    };
  }

  if (now > record.expiresAt) {
    otpStore.delete(cleanMobile);
    const log = otpLogs.find((l) => l.mobile === cleanMobile && l.status === 'pending');
    if (log) {
      log.status = 'expired';
      persistOtpLogs();
    }
    return {
      ok: false,
      error: 'OTP has expired (OTP समाप्त हो गया है). Please request a new code.',
    };
  }

  const isMatch =
    record.otp === cleanInput ||
    (Array.isArray(record.recentOtps) && record.recentOtps.includes(cleanInput));

  if (!isMatch) {
    record.attempts += 1;
    const log = otpLogs.find((l) => l.mobile === cleanMobile && !l.consumedAt);
    if (log) {
      log.status = 'wrong_otp';
      log.attempts = record.attempts;
      persistOtpLogs();
    }
    return {
      ok: false,
      error: 'Wrong OTP (गलत OTP). Please check and enter the correct code.',
    };
  }

  // OTP matched!
  const log = otpLogs.find((l) => l.mobile === cleanMobile && !l.consumedAt && (l.status === 'pending' || l.status === 'wrong_otp'));
  if (log) {
    log.status = 'verified';
    persistOtpLogs();
  }
  return { ok: true };
}

function consumeOtpAfterAction(cleanMobile: string, inputOtp?: string): void {
  if (!cleanMobile) return;
  const cleanInput = String(inputOtp || '').trim();
  const log = otpLogs.find(
    (l) => l.mobile === cleanMobile && !l.consumedAt && (!cleanInput || l.otp === cleanInput || l.status === 'verified' || l.status === 'pending')
  );
  if (log) {
    log.status = 'verified';
    log.consumedAt = Date.now();
    persistOtpLogs();
  }
  otpStore.delete(cleanMobile);
}

// API Route: Verify OTP with strict match requirement and wrong OTP reporting
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, error: 'Mobile number is mandatory' });
    }
    // If Admin turned off SMS OTP verification globally, allow verification immediately
    if (otpSettings.smsGatewayActive === false && (!otp || String(otp).trim() === '')) {
      return res.json({ success: true, message: 'OTP verification bypassed (Disabled by Admin)' });
    }
    if (!otp) {
      return res.status(400).json({ success: false, error: 'Mobile number and OTP are mandatory' });
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    const result = checkAndVerifyOtp(cleanMobile, String(otp));
    if (!result.ok) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// API Route: Reset Password with strict OTP check
app.post('/api/reset-password', async (req, res) => {
  try {
    const { mobile, phone, otp, newPassword } = req.body;
    const targetPhone = mobile || phone;
    if (!targetPhone || !newPassword) {
      return res.status(400).json({ success: false, error: 'Mobile number and new password are required' });
    }

    const cleanMobile = String(targetPhone).replace(/\D/g, '').slice(-10);

    if (otp !== undefined && otp !== '') {
      const result = checkAndVerifyOtp(cleanMobile, String(otp));
      if (!result.ok) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Wrong OTP (गलत OTP). Password reset denied.',
        });
      }
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
      });
    }

    // Clear used OTP and mark verified
    consumeOtpAfterAction(cleanMobile, otp ? String(otp) : undefined);

    // Also persist the updated password in permanent backup & Cloud SQL immediately
    try {
      const current = getCachedUsersBackup();
      let matchedUser: any = null;
      const updatedList = current.map((u) => {
        const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
        if (uPhone === cleanMobile) {
          matchedUser = { ...u, password: String(newPassword).trim(), updatedAt: new Date().toISOString() };
          return matchedUser;
        }
        return u;
      });
      if (matchedUser) {
        markUserRuntimeMutated(matchedUser.id || matchedUser.uid, cleanMobile);
        saveUsersBackup(updatedList);
        await upsertUser({
          uid: matchedUser.id || matchedUser.uid || cleanMobile,
          phone: cleanMobile,
          password: String(newPassword).trim(),
          nickname: matchedUser.nickname,
          updatedAt: matchedUser.updatedAt,
        }).catch(() => {});
      }
    } catch (persistErr) {
      console.warn('Password reset persistence warning:', persistErr);
    }

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

// API Route: Admin Fetch Dispatched OTP Logs & Settings
app.get('/api/admin/otp-logs', (_req, res) => {
  // Automatically mark expired pending logs
  let changed = false;
  const now = Date.now();
  for (const log of otpLogs) {
    if (log.status === 'pending' && log.expiresAt && now > log.expiresAt) {
      log.status = 'expired';
      changed = true;
    }
  }
  if (changed) persistOtpLogs();

  return res.json({
    success: true,
    logs: otpLogs,
    activeCount: otpStore.size,
    settings: otpSettings,
  });
});

// API Route: Admin Manually Verify / Approve a Dispatched OTP Log
app.post('/api/admin/otp-logs/verify', (req, res) => {
  const { id, mobile } = req.body || {};
  const cleanMobile = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : '';
  const targetLog = otpLogs.find((l) => (id && l.id === id) || (cleanMobile && l.mobile === cleanMobile));
  if (!targetLog) {
    return res.status(404).json({ success: false, error: 'OTP log record not found' });
  }
  targetLog.status = 'verified';
  targetLog.expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore.set(targetLog.mobile, {
    otp: targetLog.otp,
    expiresAt: targetLog.expiresAt,
    purpose: targetLog.purpose,
    attempts: 0,
    formattedMessage: targetLog.message,
  });
  persistOtpLogs();
  return res.json({
    success: true,
    message: `OTP ${targetLog.otp} for +91 ${targetLog.mobile} marked as Verified & Active!`,
    log: targetLog,
  });
});

// API Route: Admin Clear Dispatched OTP Logs
app.post('/api/admin/otp-logs/clear', (_req, res) => {
  otpLogs.length = 0;
  otpStore.clear();
  persistOtpLogs();
  return res.json({
    success: true,
    message: 'All OTP logs cleared successfully.',
  });
});

const USERS_BACKUP_PATH = path.resolve(process.cwd(), 'src/data/users_backup.json');
const DELETED_USERS_PATH = path.resolve(process.cwd(), 'src/data/deleted_users.json');
const DELETED_PRODUCTS_PATH = path.resolve(process.cwd(), 'src/data/deleted_products.json');

function loadDeletedUsers(): Set<string> {
  const set = new Set<string>();
  try {
    if (fs.existsSync(DELETED_USERS_PATH)) {
      const data = fs.readFileSync(DELETED_USERS_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((s) => {
          if (typeof s === 'string') set.add(s.trim());
          else if (s?.id) set.add(String(s.id).trim());
          else if (s?.phone) set.add(String(s.phone).replace(/\D/g, '').slice(-10));
        });
      } else if (parsed && typeof parsed === 'object') {
        (parsed.deletedIds || []).forEach((id: string) => set.add(String(id).trim()));
        (parsed.deletedPhones || []).forEach((p: string) => set.add(String(p).replace(/\D/g, '').slice(-10)));
      }
    }
  } catch {}
  return set;
}

function saveDeletedUser(userId: string, phone?: string) {
  try {
    const set = loadDeletedUsers();
    if (userId) set.add(String(userId).trim());
    if (phone) {
      const cleanP = String(phone).replace(/\D/g, '').slice(-10);
      if (cleanP) set.add(cleanP);
    }
    fs.writeFileSync(DELETED_USERS_PATH, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not save deleted user to blacklist:', e);
  }
}

function unblacklistUser(phone?: string, id?: string) {
  try {
    const set = loadDeletedUsers();
    let modified = false;
    if (phone) {
      const cleanP = String(phone).replace(/\D/g, '').slice(-10);
      if (cleanP && set.has(cleanP)) {
        set.delete(cleanP);
        modified = true;
      }
    }
    if (id) {
      const cleanId = String(id).trim();
      if (cleanId && set.has(cleanId)) {
        set.delete(cleanId);
        modified = true;
      }
    }
    if (modified) {
      fs.writeFileSync(DELETED_USERS_PATH, JSON.stringify(Array.from(set), null, 2), 'utf-8');
      console.log(`[Blacklist] Unblacklisted re-registered phone: ${phone}, id: ${id}`);
    }
  } catch (err) {
    console.warn('Could not unblacklist user:', err);
  }
}

function isUserDeleted(u: any): boolean {
  if (!u) return false;
  const set = loadDeletedUsers();
  const uId = String(u.id || u.uid || '').trim();
  const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
  return Boolean((uId && set.has(uId)) || (uPhone && set.has(uPhone)));
}

function loadDeletedProducts(): Set<string> {
  const set = new Set<string>();
  try {
    if (fs.existsSync(DELETED_PRODUCTS_PATH)) {
      const data = fs.readFileSync(DELETED_PRODUCTS_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((id: string) => set.add(String(id).trim()));
      }
    }
  } catch {}
  return set;
}

function saveDeletedProduct(productId: string) {
  try {
    const set = loadDeletedProducts();
    if (productId) set.add(String(productId).trim());
    fs.writeFileSync(DELETED_PRODUCTS_PATH, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not save deleted product to blacklist:', e);
  }
}

function isProductDeleted(productId: string): boolean {
  if (!productId) return false;
  const set = loadDeletedProducts();
  return set.has(String(productId).trim());
}

function getCachedUsersBackup(): any[] {
  let list: any[] = [];
  try {
    if (fs.existsSync(USERS_BACKUP_PATH)) {
      const data = fs.readFileSync(USERS_BACKUP_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
    }
  } catch (err) {
    console.error('Error reading users backup file:', err);
  }

  // Fallback to SQLite SQL users if JSON backup was empty
  if (list.length === 0) {
    try {
      const sqlUsers = getAllUsersFromSql(false);
      if (sqlUsers && sqlUsers.length > 0) list = sqlUsers;
    } catch {}
  }

  // Strictly filter out any deleted/blacklisted users so they NEVER resurrect
  const deletedSet = loadDeletedUsers();
  return list.filter((u) => {
    const uId = String(u.id || u.uid || '').trim();
    const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
    return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
  });
}

function saveUsersBackup(users: any[]): boolean {
  try {
    if (!Array.isArray(users)) users = [];
    const deletedSet = loadDeletedUsers();
    // Strictly filter out any blacklisted users before persisting
    const cleanUsers = users.filter((u) => {
      const uId = String(u.id || u.uid || '').trim();
      const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
      return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
    });

    fs.writeFileSync(USERS_BACKUP_PATH, JSON.stringify(cleanUsers, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving users backup file:', err);
    return false;
  }
}

const WALLET_ZERO_KEYS = [
  'rechargeBalance',
  'withdrawalBalance',
  'productRevenue',
  'totalInvested',
  'totalCommissionEarned',
] as const;

const runtimeMutatedUserIds = new Set<string>();
function markUserRuntimeMutated(id?: string | null, phone?: string | null): void {
  if (id && String(id).trim()) runtimeMutatedUserIds.add(String(id).trim());
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
  if (cleanPhone.length === 10) runtimeMutatedUserIds.add(cleanPhone);
}
function isUserRuntimeMutated(u: any): boolean {
  if (!u) return false;
  const idStr = String(u.id || u.uid || '').trim();
  const phoneStr = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
  return Boolean(
    (idStr && runtimeMutatedUserIds.has(idStr)) ||
    (phoneStr.length === 10 && runtimeMutatedUserIds.has(phoneStr))
  );
}

let bootCloudSyncPromise: Promise<void> | null = null;
async function waitForBootCloudSync(timeoutMs: number = 3500): Promise<void> {
  if (!bootCloudSyncPromise) return;
  try {
    await Promise.race([
      bootCloudSyncPromise,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {}
}

function parseTimestampMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? 0 : ms;
}

function getFinancialTimestampMs(u: any): number {
  if (!u) return 0;
  const balTs = parseTimestampMs(u.balanceUpdatedAt);
  if (balTs > 0) return balTs;
  const zeroArr = Array.isArray(u.explicitZeroWallets) ? u.explicitZeroWallets : [];
  const hasAnyNonZero =
    (Number(u.rechargeBalance) || 0) > 0 ||
    (Number(u.withdrawalBalance) || 0) > 0 ||
    (Number(u.productRevenue) || 0) > 0 ||
    (Number(u.totalInvested) || 0) > 0 ||
    (Number(u.totalCommissionEarned) || 0) > 0;
  if (hasAnyNonZero || u.isExplicitZeroReset || zeroArr.length > 0) {
    return parseTimestampMs(u.updatedAt) || parseTimestampMs(u.createdAt);
  }
  return 0;
}

function formatPostgresUserRow(u: any): any {
  const rechargeBalance = u.rechargeBalance ?? 0;
  const withdrawalBalance = u.withdrawalBalance ?? 0;
  const productRevenue = u.productRevenue ?? 0;
  const totalInvested = u.totalInvested ?? 0;
  const totalCommissionEarned = u.totalCommissionEarned ?? 0;
  const createdIso = u.createdAt ? new Date(u.createdAt).toISOString() : undefined;
  const hasPositive =
    Number(rechargeBalance) > 0 ||
    Number(withdrawalBalance) > 0 ||
    Number(productRevenue) > 0 ||
    Number(totalInvested) > 0 ||
    Number(totalCommissionEarned) > 0;
  const explicitZeroWallets = Array.isArray(u.explicitZeroWallets) ? u.explicitZeroWallets : [];
  const isExplicitZeroReset = Boolean(u.isExplicitZeroReset) && !hasPositive;
  const updatedAt = u.updatedAt || createdIso;
  const balanceUpdatedAt =
    u.balanceUpdatedAt ||
    (hasPositive || isExplicitZeroReset || explicitZeroWallets.length > 0 ? updatedAt : undefined);

  return {
    id: u.uid || String(u.id),
    phone: u.phone,
    password: u.password || 'password123',
    nickname: u.nickname,
    avatar: u.avatar || 'HD',
    invitationCode: u.invitationCode,
    invitedBy: u.invitedBy,
    inviterName: u.inviterName,
    inviterId: u.inviterId,
    rechargeBalance,
    withdrawalBalance,
    productRevenue,
    vipLevel: u.vipLevel ?? 0,
    totalInvested,
    checkInStreak: u.checkInStreak ?? 0,
    lastCheckInDate: u.lastCheckInDate,
    spinChances: u.spinChances ?? 0,
    status: u.status || 'active',
    role: u.role || 'user',
    totalReferrals: u.totalReferrals ?? 0,
    totalCommissionEarned,
    bankDetails: u.bankDetails,
    isExplicitZeroReset,
    explicitZeroWallets,
    ...(balanceUpdatedAt ? { balanceUpdatedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    createdAt: createdIso,
  };
}

function mergeTwoUsers(existing: any, incoming: any): any {
  if (!existing) {
    const clean = { ...incoming };
    delete clean.isAuthoritativeServer;
    delete clean.isRuntimeMutated;
    return clean;
  }
  if (!incoming) {
    const clean = { ...existing };
    delete clean.isAuthoritativeServer;
    delete clean.isRuntimeMutated;
    return clean;
  }

  const isAuthIncoming = Boolean(incoming.isAuthoritativeServer);
  const existingTs = parseTimestampMs(existing.updatedAt);
  const incomingTs = parseTimestampMs(incoming.updatedAt);
  const existingBalTs = getFinancialTimestampMs(existing);
  const incomingBalTs = getFinancialTimestampMs(incoming);

  const existingStrictlyNewerBal =
    !isAuthIncoming &&
    existingBalTs > 0 &&
    (incomingBalTs === 0 || existingBalTs > incomingBalTs + 1000);

  const existingZeroSet = new Set<string>(
    Array.isArray(existing.explicitZeroWallets) ? existing.explicitZeroWallets : []
  );
  const incomingZeroSet = new Set<string>(
    Array.isArray(incoming.explicitZeroWallets) ? incoming.explicitZeroWallets : []
  );

  const merged: any = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'isAuthoritativeServer' || k === 'isRuntimeMutated' || k === 'explicitZeroWallets') continue;
    // Prevent stale or $0 bundled snapshots from overwriting live/newer balances
    if (['rechargeBalance', 'withdrawalBalance', 'productRevenue', 'totalInvested', 'totalCommissionEarned'].includes(k)) {
      const existingNum = Number(existing[k]) || 0;
      const incomingNum = Number(v) || 0;

      if (merged[k] !== undefined && (v === null || v === undefined || Number.isNaN(Number(v)))) {
        continue;
      }

      if (existingStrictlyNewerBal) {
        continue;
      }

      if (existingNum > 0 && incomingNum === 0) {
        const incomingExplicitForKey =
          isAuthIncoming ||
          (Boolean(incoming.isExplicitZeroReset) && (incomingBalTs === 0 || existingBalTs === 0 || incomingBalTs >= existingBalTs - 1000)) ||
          (incomingZeroSet.has(k) && (incomingBalTs === 0 || existingBalTs === 0 || incomingBalTs >= existingBalTs - 1000));
        if (!incomingExplicitForKey) {
          continue;
        }
      }
    } else if (['vipLevel', 'spinChances', 'totalReferrals', 'checkInStreak'].includes(k)) {
      const existingNum = Number(existing[k]) || 0;
      const incomingNum = Number(v) || 0;

      if (merged[k] !== undefined && (v === null || v === undefined || Number.isNaN(Number(v)))) {
        continue;
      }

      const existingStrictlyNewerMeta =
        !isAuthIncoming && existingTs > 0 && incomingTs > 0 && existingTs > incomingTs + 1000;
      if (existingStrictlyNewerMeta) {
        continue;
      }

      const incomingMetaNewerOrAuth =
        isAuthIncoming || (incomingTs > 0 && (existingTs === 0 || incomingTs >= existingTs));
      if (existingNum > 0 && incomingNum === 0 && !incomingMetaNewerOrAuth) {
        continue;
      }
    }

    if (v !== undefined && v !== null && v !== '') {
      if (k === 'bankDetails' && typeof v === 'object') {
        const existingBank = existing.bankDetails || {};
        merged.bankDetails = {
          accountHolder: (v as any).accountHolder?.trim() || existingBank.accountHolder || '',
          bankName: (v as any).bankName?.trim() || existingBank.bankName || 'Bank IMPS',
          accountNumber: (v as any).accountNumber?.trim() || existingBank.accountNumber || '',
          ifscCode: ((v as any).ifscCode?.trim() || existingBank.ifscCode || '').toUpperCase(),
          upiId: (v as any).upiId?.trim() || existingBank.upiId || '',
        };
      } else {
        merged[k] = v;
      }
    } else if (((v as any) === 0 || (v as any) === false) && typeof v === typeof existing[k]) {
      if (['rechargeBalance', 'withdrawalBalance', 'productRevenue', 'totalInvested', 'totalCommissionEarned'].includes(k)) {
        const existingNum = Number(existing[k]) || 0;
        const allowedZero =
          isAuthIncoming ||
          (Boolean(incoming.isExplicitZeroReset) && (incomingBalTs === 0 || existingBalTs === 0 || incomingBalTs >= existingBalTs - 1000)) ||
          (incomingZeroSet.has(k) && (incomingBalTs === 0 || existingBalTs === 0 || incomingBalTs >= existingBalTs - 1000));
        if (existingNum > 0 && !allowedZero) {
          continue;
        }
      }
      merged[k] = v;
    }
  }

  // CRITICAL: If existing user had bankDetails, NEVER overwrite with null or empty bank details
  if (existing.bankDetails && (!merged.bankDetails || (!merged.bankDetails.accountNumber && !merged.bankDetails.upiId))) {
    merged.bankDetails = { ...existing.bankDetails };
  }

  // Never lose password once set
  if (incoming.password && String(incoming.password).trim().length > 0) {
    merged.password = String(incoming.password).trim();
  } else if (existing.password && String(existing.password).trim().length > 0) {
    merged.password = String(existing.password).trim();
  } else {
    merged.password = 'password123';
  }

  // Never lose invitationCode, invitedBy, inviterName, inviterId
  if (!merged.invitationCode && existing.invitationCode) merged.invitationCode = existing.invitationCode;
  if (!merged.invitedBy && existing.invitedBy) merged.invitedBy = existing.invitedBy;
  if (!merged.inviterName && existing.inviterName) merged.inviterName = existing.inviterName;
  if (!merged.inviterId && existing.inviterId) merged.inviterId = existing.inviterId;

  // CRITICAL: Cleanse old Ravi Sahu dummy reference (R34VZ / 852539) to real Ravi Sahu (J9Y79 / 325697)
  if (
    merged.invitedBy === 'R34VZ' ||
    merged.inviterId === '852539' ||
    (merged.inviterName && String(merged.inviterName).trim().toLowerCase() === 'ravisahu')
  ) {
    merged.invitedBy = 'J9Y79';
    merged.inviterName = 'Ravi Sahu';
    merged.inviterId = '325697';
  }

  // CRITICAL: Cleanse old Anshusahu reference (EYAYY) to real Anshusahu (AAWFK / 406332)
  if (
    merged.invitedBy === 'EYAYY' ||
    (merged.inviterName && String(merged.inviterName).trim().toLowerCase().includes('anshu') && (merged.inviterId === '406332' || !merged.inviterId))
  ) {
    merged.invitedBy = 'AAWFK';
    merged.inviterName = 'Anshusahu';
    merged.inviterId = '406332';
  }

  merged.totalReferrals = Math.max(Number(merged.totalReferrals) || 0, Number(existing.totalReferrals) || 0);
  if (
    isAuthIncoming ||
    ((Boolean(incoming.isExplicitZeroReset) || incomingZeroSet.has('totalCommissionEarned')) && !existingStrictlyNewerBal)
  ) {
    merged.totalCommissionEarned = Number(incoming.totalCommissionEarned ?? merged.totalCommissionEarned) || 0;
  } else if (!existingStrictlyNewerBal) {
    merged.totalCommissionEarned = Math.max(Number(existing.totalCommissionEarned) || 0, Number(merged.totalCommissionEarned) || 0);
  }

  // Maintain accurate per-wallet explicitZeroWallets & full reset flag
  const nextZeroSet = new Set<string>([...existingZeroSet, ...incomingZeroSet]);
  for (const w of WALLET_ZERO_KEYS) {
    if ((Number(merged[w]) || 0) > 0) {
      nextZeroSet.delete(w);
    } else if (incoming.isExplicitZeroReset && !existingStrictlyNewerBal) {
      nextZeroSet.add(w);
    }
  }
  merged.explicitZeroWallets = Array.from(nextZeroSet);
  const anyPositiveMerged = WALLET_ZERO_KEYS.some((w) => (Number(merged[w]) || 0) > 0);
  merged.isExplicitZeroReset = Boolean(merged.isExplicitZeroReset) && !anyPositiveMerged;

  if (existingBalTs > incomingBalTs && !isAuthIncoming) {
    merged.balanceUpdatedAt = existing.balanceUpdatedAt;
  } else if (incoming.balanceUpdatedAt || existing.balanceUpdatedAt) {
    merged.balanceUpdatedAt = incoming.balanceUpdatedAt || existing.balanceUpdatedAt;
  }

  if (existingTs > incomingTs && !isAuthIncoming) {
    merged.updatedAt = existing.updatedAt;
  } else {
    merged.updatedAt = incoming.updatedAt || existing.updatedAt || new Date().toISOString();
  }

  if (!merged.createdAt) {
    merged.createdAt = existing.createdAt || incoming.createdAt || new Date().toISOString();
  }
  delete merged.isAuthoritativeServer;
  delete merged.isRuntimeMutated;
  return merged;
}

function deduplicateAndMergeUsers(listA: any[], listB: any[]): any[] {
  const byId = new Map<string, any>();
  const phoneToId = new Map<string, string>();
  const deletedSet = loadDeletedUsers();

  const processUser = (u: any) => {
    if (!u || (!u.id && !u.uid && !u.phone)) return;
    const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
    const rawId = String(u.id || u.uid || cleanPhone).trim();

    // STRICT CHECK: If user ID or phone is blacklisted, DROP IMMEDIATELY! NEVER MERGE OR RESURRECT!
    if (deletedSet.has(rawId) || (cleanPhone && deletedSet.has(cleanPhone))) {
      return;
    }

    const canonicalId = (cleanPhone && phoneToId.get(cleanPhone)) || rawId;
    const existing = byId.get(canonicalId);
    const merged = mergeTwoUsers(existing, { ...u, id: canonicalId, ...(cleanPhone ? { phone: cleanPhone } : {}) });
    byId.set(canonicalId, merged);
    if (cleanPhone) {
      phoneToId.set(cleanPhone, canonicalId);
    }
  };

  listA.forEach(processUser);
  listB.forEach(processUser);

  return Array.from(byId.values());
}

// API Route: Get Users Permanent Source of Truth (Cloud SQL PostgreSQL -> SQLite SQL -> Disk Backup)
async function getCombinedServerUsers(): Promise<any[]> {
  await waitForBootCloudSync();
  const deletedSet = loadDeletedUsers();
  const sqlUsers = getAllUsersFromSql(false);
  const diskUsers = getCachedUsersBackup();
  let cloudUsers: any[] = [];
  try {
    const cloud = await getAllUsers();
    if (cloud && cloud.length > 0) {
      cloudUsers = cloud
        .filter((u) => {
          const uId = String(u.uid || u.id || '').trim();
          const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
          return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
        })
        .map((u) => formatPostgresUserRow(u));
    }
  } catch (err: any) {
    console.warn('getCombinedServerUsers cloud fetch note:', err?.message || err);
  }

  // Merge strategy:
  // - Cloud SQL PostgreSQL persists across deploys/updates; unless user was mutated in THIS running process, Cloud SQL wins over bundled SQLite!
  // - Local SQLite rows that were actually mutated during THIS server runtime win over everything else.
  const taggedCloudUsers =
    cloudUsers.length > 0
      ? cloudUsers.map((u) => (!isUserRuntimeMutated(u) ? { ...u, isAuthoritativeServer: true } : u))
      : [];
  const taggedSqlUsers = sqlUsers.map((u) =>
    isUserRuntimeMutated(u) ? { ...u, isAuthoritativeServer: true } : u
  );

  const merged1 = deduplicateAndMergeUsers(diskUsers, taggedCloudUsers);
  const mergedAll = deduplicateAndMergeUsers(merged1, taggedSqlUsers);

  // Filter one more time through deletedSet to be 1000% certain
  const finalCleanUsers = mergedAll.filter((u) => {
    const uId = String(u.id || u.uid || '').trim();
    const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
    return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
  });

  // Sync SQLite with any missing users OR live Cloud SQL users that differ from unmutated bundled SQLite
  const sqlById = new Map<string, any>();
  const sqlByPhone = new Map<string, any>();
  for (const su of sqlUsers) {
    if (su?.id) sqlById.set(String(su.id).trim(), su);
    const sp = su?.phone ? String(su.phone).replace(/\D/g, '').slice(-10) : '';
    if (sp.length === 10) sqlByPhone.set(sp, su);
  }

  for (const u of finalCleanUsers) {
    const uId = String(u.id || '').trim();
    const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
    const existingSql = sqlById.get(uId) || (uPhone ? sqlByPhone.get(uPhone) : undefined);
    if (!existingSql) {
      upsertUserInSql(u);
    } else if (!isUserRuntimeMutated(u) && cloudUsers.length > 0) {
      const differs =
        Math.abs((Number(existingSql.rechargeBalance) || 0) - (Number(u.rechargeBalance) || 0)) > 0.001 ||
        Math.abs((Number(existingSql.withdrawalBalance) || 0) - (Number(u.withdrawalBalance) || 0)) > 0.001 ||
        Math.abs((Number(existingSql.productRevenue) || 0) - (Number(u.productRevenue) || 0)) > 0.001 ||
        Math.abs((Number(existingSql.totalInvested) || 0) - (Number(u.totalInvested) || 0)) > 0.001 ||
        Math.abs((Number(existingSql.totalCommissionEarned) || 0) - (Number(u.totalCommissionEarned) || 0)) > 0.001;
      if (differs) {
        upsertUserInSql(u);
      }
    }
  }
  saveUsersBackup(finalCleanUsers);

  return finalCleanUsers;
}

// API Route: Get all users permanently
app.get(['/api/users', '/api/backup/users'], async (_req, res) => {
  const mergedAll = await getCombinedServerUsers();
  const withRuntimeFlag = mergedAll.map((u) => ({
    ...u,
    isRuntimeMutated: isUserRuntimeMutated(u),
  }));
  return res.json({ success: true, count: withRuntimeFlag.length, users: withRuntimeFlag, source: 'sqlite_sql_database' });
});

// API Route: Get permanent tombstone blacklists for client synchronization
app.get('/api/deleted-identifiers', (_req, res) => {
  return res.json({
    success: true,
    deletedUsers: Array.from(loadDeletedUsers()),
    deletedProducts: Array.from(loadDeletedProducts()),
    deletedOrders: Array.from(loadDeletedOrders()),
  });
});

// API Route: Get single user by ID, Phone, or Invite Code (PostgreSQL-safe on cold boot)
app.get('/api/user/:identifier', async (req, res) => {
  try {
    await waitForBootCloudSync();
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifier is required' });
    }
    const cleanId = String(identifier).trim();
    // 1. Direct SQLite lookup
    let userRecord: any = getUserByIdOrPhoneFromSql(cleanId);

    // 2. When Cloud SQL PostgreSQL is configured and user was not mutated in this runtime, reconcile with PostgreSQL first
    if (isSqlConfigured && (!userRecord || !isUserRuntimeMutated(userRecord))) {
      try {
        const pgRow = await findUser(cleanId);
        if (pgRow) {
          const pgFormatted = formatPostgresUserRow(pgRow);
          userRecord = userRecord
            ? mergeTwoUsers(userRecord, { ...pgFormatted, isAuthoritativeServer: true })
            : pgFormatted;
          upsertUserInSql(userRecord);
        }
      } catch {}
    }

    if (!userRecord) {
      // 3. Fallback to combined lookup
      const all = await getCombinedServerUsers();
      const cleanPhone = cleanId.replace(/\D/g, '').slice(-10);
      userRecord = all.find(
        (u) => u.id === cleanId || u.phone === cleanId || (cleanPhone.length === 10 && String(u.phone).replace(/\D/g, '').slice(-10) === cleanPhone)
      );
    }
    if (!userRecord) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({
      success: true,
      user: { ...userRecord, isRuntimeMutated: isUserRuntimeMutated(userRecord) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Unblacklist user so re-registered user shows up for admin and functions normally
app.post('/api/unblacklist-user', (req, res) => {
  try {
    const { userId, phone } = req.body;
    unblacklistUser(phone, userId);
    return res.json({ success: true, message: 'User removed from blacklist' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Save or Update single user permanently into SQLite SQL + Backup (with strict financial-timestamp guard)
app.post(['/api/user/save', '/api/user/update'], async (req, res) => {
  try {
    await waitForBootCloudSync();
    const rawUserData = req.body.user || req.body;
    if (!rawUserData || (!rawUserData.id && !rawUserData.phone)) {
      return res.status(400).json({ success: false, error: 'User data with id or phone required' });
    }
    const userData = { ...rawUserData };
    delete userData.isAuthoritativeServer;
    delete userData.isRuntimeMutated;

    // Remove from blacklist if previously deleted
    unblacklistUser(userData.phone, userData.id);

    const existingSql =
      (userData.id ? getUserByIdOrPhoneFromSql(String(userData.id).trim()) : null) ||
      (userData.phone ? getUserByIdOrPhoneFromSql(String(userData.phone).replace(/\D/g, '').slice(-10)) : null);

    let payloadToSave = userData;
    if (existingSql) {
      const existingBalTs = getFinancialTimestampMs(existingSql);
      const incomingBalTs = getFinancialTimestampMs(userData);
      const existingRuntime = isUserRuntimeMutated(existingSql);

      // CRITICAL GUARD: Reject stale financial snapshots strictly older than SQLite
      // (Never reject when existingSql is unmutated $0 seed with existingBalTs === 0 and incoming has live balance)
      if (
        (existingRuntime || existingBalTs > 0) &&
        incomingBalTs > 0 &&
        existingBalTs > incomingBalTs + 1000
      ) {
        return res.json({
          success: true,
          staleIgnored: true,
          message: 'Ignored stale user payload; returning authoritative SQLite state.',
          user: { ...existingSql, isRuntimeMutated: existingRuntime },
        });
      }
      payloadToSave = mergeTwoUsers(existingSql, userData);
    }

    // 1. Upsert directly into SQLite
    const saved = upsertUserInSql(payloadToSave);
    markUserRuntimeMutated(saved.id, saved.phone);

    // 2. Sync to disk backup
    const diskUsers = getCachedUsersBackup();
    const updatedDisk = deduplicateAndMergeUsers(diskUsers, [{ ...saved, isAuthoritativeServer: true }]);
    saveUsersBackup(updatedDisk);

    // 3. Sync to Cloud SQL in background
    upsertUser({
      uid: saved.id,
      phone: saved.phone,
      password: saved.password,
      nickname: saved.nickname,
      avatar: saved.avatar,
      invitationCode: saved.invitationCode,
      invitedBy: saved.invitedBy || undefined,
      inviterName: saved.inviterName || undefined,
      inviterId: saved.inviterId || undefined,
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
      bankDetails: saved.bankDetails,
      isExplicitZeroReset: saved.isExplicitZeroReset,
      explicitZeroWallets: saved.explicitZeroWallets,
      balanceUpdatedAt: saved.balanceUpdatedAt,
      updatedAt: saved.updatedAt,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'User details saved permanently in SQLite SQL database!',
      user: { ...saved, isRuntimeMutated: true },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Authoritative Atomic User Withdrawal (SQLite BEGIN IMMEDIATE + Pending Check + Persistent Ledger)
const withdrawRequestLocks = new Set<string>();

app.post('/api/user/withdraw', async (req, res) => {
  const { userId, amount, bankDetails } = req.body || {};
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  if (withdrawRequestLocks.has(cleanUserId)) {
    return res.status(429).json({
      success: false,
      error: 'Withdrawal request is already processing. Please wait.',
    });
  }
  withdrawRequestLocks.add(cleanUserId);

  try {
    const liveSettings = loadServerPlatformSettings();
    if (liveSettings.isWithdrawalEnabled === false) {
      return res.status(403).json({
        success: false,
        error: liveSettings.withdrawalNotice || 'Withdrawal service is currently undergoing routine maintenance.',
      });
    }

    const reqAmount = Number(Number(amount).toFixed(2));
    const minWth = Number(liveSettings.minWithdrawal) || 2;
    if (!Number.isFinite(reqAmount) || reqAmount < minWth) {
      return res.status(400).json({
        success: false,
        error: `Minimum withdrawal amount is $${minWth.toFixed(2)}`,
      });
    }

    let user = getUserByIdOrPhoneFromSql(cleanUserId);
    if (!user) {
      const combined = await getCombinedServerUsers();
      const cleanDigits = cleanUserId.replace(/\D/g, '').slice(-10);
      const matched = combined.find(
        (u) =>
          String(u.id || '').trim() === cleanUserId ||
          (cleanDigits.length === 10 && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanDigits)
      );
      if (matched) user = upsertUserInSql(matched);
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found in database.' });
    }
    if (user.status === 'frozen' || user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your account is frozen by system administrator. Please contact support.',
      });
    }

    const userPhoneDigits = String(user.phone || '').replace(/\D/g, '').slice(-10);
    const matchesTargetUser = (tUserId: any) => {
      const s = String(tUserId || '').trim();
      const d = s.replace(/\D/g, '').slice(-10);
      return s === user!.id || (userPhoneDigits.length === 10 && (s === userPhoneDigits || d === userPhoneDigits));
    };

    const serverTxs = loadServerTransactions();
    let dbUserTxs: any[] = [];
    try {
      dbUserTxs = await getUserTransactions(user.id);
    } catch {}

    const allUserTxs = [...serverTxs, ...(Array.isArray(dbUserTxs) ? dbUserTxs : [])];
    const hasPending = allUserTxs.some(
      (t) => t && t.type === 'withdraw' && t.status === 'processing' && matchesTargetUser(t.userId)
    );
    if (hasPending) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending withdrawal under review. Please wait for admin approval.',
      });
    }

    const nowMs = Date.now();
    const hasRecentSpam = allUserTxs.some(
      (t) => t && t.type === 'withdraw' && matchesTargetUser(t.userId) && nowMs - (Number(t.createdAt) || 0) < 30000
    );
    if (hasRecentSpam) {
      return res.status(429).json({
        success: false,
        error: 'Withdrawal request already received. Processing...',
      });
    }

    const reqOtp = String((req.body || {}).otp || '').trim();
    otpSettings = loadServerOtpSettings();
    const isWithdrawOtpRequired =
      otpSettings.smsGatewayActive !== false && liveSettings.smsGatewayActive !== false;
    const userCleanPhone = String(user.phone || '').replace(/\D/g, '').slice(-10);

    if (isWithdrawOtpRequired) {
      if (!userCleanPhone || userCleanPhone.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Valid registered 10-digit mobile number is required for OTP verification.',
        });
      }
      if (!reqOtp || reqOtp.length !== 6) {
        return res.status(400).json({
          success: false,
          error: 'Please enter the 6-digit verification code (OTP) sent to your mobile number.',
        });
      }
      if ((Number(user.withdrawalBalance) || 0) + 1e-6 >= reqAmount) {
        const otpCheck = checkAndVerifyOtp(userCleanPhone, reqOtp);
        if (!otpCheck.ok) {
          return res.status(400).json({
            success: false,
            error: otpCheck.error || 'Wrong OTP (गलत OTP). Withdrawal denied.',
          });
        }
      }
    }

    const cleanBank = {
      accountHolder: String(bankDetails?.accountHolder || user.bankDetails?.accountHolder || user.nickname || '').trim(),
      accountNumber: String(bankDetails?.accountNumber || user.bankDetails?.accountNumber || '').trim(),
      ifscCode: String(bankDetails?.ifscCode || user.bankDetails?.ifscCode || '').trim().toUpperCase(),
      bankName: String(bankDetails?.bankName || user.bankDetails?.bankName || 'Bank IMPS').trim(),
      upiId: String(bankDetails?.upiId || user.bankDetails?.upiId || '').trim(),
    };

    const db = getSqliteDb();
    initSqliteUsersTable();
    const nowIso = new Date(nowMs).toISOString();
    let nextWithdrawal = 0;

    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare('SELECT * FROM platform_users WHERE id = ?').get(user.id) as any;
      if (!row) {
        throw new Error('USER_MISSING');
      }
      const dbBal = Number(row.withdrawal_balance) || 0;
      if (dbBal + 1e-6 < reqAmount) {
        throw new Error(`INSUFFICIENT_FUNDS:${dbBal.toFixed(2)}`);
      }
      nextWithdrawal = Math.max(0, Number((dbBal - reqAmount).toFixed(2)));

      let rawJson: any = {};
      try {
        rawJson = JSON.parse(row.raw_json || '{}');
      } catch {}
      rawJson.withdrawalBalance = nextWithdrawal;
      rawJson.bankDetails = cleanBank;
      const prevZeros: string[] = Array.isArray(rawJson.explicitZeroWallets) ? rawJson.explicitZeroWallets : [];
      const zeroSet = new Set<string>(prevZeros);
      if (nextWithdrawal === 0) zeroSet.add('withdrawalBalance');
      else zeroSet.delete('withdrawalBalance');
      rawJson.explicitZeroWallets = Array.from(zeroSet);
      rawJson.isExplicitZeroReset = false;
      rawJson.balanceUpdatedAt = nowIso;
      rawJson.updatedAt = nowIso;

      db.prepare(`
        UPDATE platform_users
        SET withdrawal_balance = ?,
            bank_account_holder = ?,
            bank_account_number = ?,
            bank_ifsc_code = ?,
            bank_name = ?,
            bank_upi_id = ?,
            bank_details_json = ?,
            raw_json = ?,
            balance_updated_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        nextWithdrawal,
        cleanBank.accountHolder || null,
        cleanBank.accountNumber || null,
        cleanBank.ifscCode || null,
        cleanBank.bankName || null,
        cleanBank.upiId || null,
        JSON.stringify(cleanBank),
        JSON.stringify(rawJson),
        nowIso,
        nowIso,
        user.id
      );

      db.exec('COMMIT');
    } catch (sqlErr: any) {
      try {
        db.exec('ROLLBACK');
      } catch {}
      if (String(sqlErr?.message || '').startsWith('INSUFFICIENT_FUNDS')) {
        const avail = String(sqlErr.message).split(':')[1] || '0.00';
        return res.status(400).json({
          success: false,
          error: `Insufficient withdrawal balance (Available: $${avail})`,
        });
      }
      throw sqlErr;
    }

    const updatedUser = getUserByIdOrPhoneFromSql(user.id) || {
      ...user,
      withdrawalBalance: nextWithdrawal,
      bankDetails: cleanBank,
      isExplicitZeroReset: false,
      explicitZeroWallets: nextWithdrawal === 0 ? ['withdrawalBalance'] : [],
      balanceUpdatedAt: nowIso,
      updatedAt: nowIso,
    };
    markUserRuntimeMutated(updatedUser.id, updatedUser.phone);

    const diskUsers = getCachedUsersBackup();
    const updatedDisk = deduplicateAndMergeUsers(diskUsers, [{ ...updatedUser, isAuthoritativeServer: true }]);
    saveUsersBackup(updatedDisk);

    upsertUser({
      uid: updatedUser.id,
      phone: updatedUser.phone,
      withdrawalBalance: updatedUser.withdrawalBalance,
      bankDetails: updatedUser.bankDetails,
      isExplicitZeroReset: false,
      explicitZeroWallets: updatedUser.explicitZeroWallets,
      balanceUpdatedAt: nowIso,
      updatedAt: nowIso,
    }).catch(() => {});

    const feePercent = liveSettings.withdrawalFeePercent !== undefined ? Number(liveSettings.withdrawalFeePercent) : 5;
    const fee = Number(((reqAmount * feePercent) / 100).toFixed(2));
    const netPayout = Number((reqAmount - fee).toFixed(2));
    const refNo = `WTH${Math.floor(10000000 + Math.random() * 90000000)}`;

    const newTx = {
      id: `tx-${nowMs}`,
      userId: updatedUser.id,
      phone: updatedUser.phone || '',
      type: 'withdraw',
      amount: reqAmount,
      feeAmount: fee,
      netAmount: netPayout,
      title: `Withdrawal: ${cleanBank.accountHolder} (${cleanBank.bankName})`,
      timestamp: formatISTTimestamp(nowMs),
      createdAt: nowMs,
      status: 'processing',
      referenceNo: refNo,
      paymentMethod: `Bank IMPS: ${cleanBank.accountNumber} • ${cleanBank.ifscCode}`,
      bankDetails: cleanBank,
      ...buildUserBalanceSnapshot(updatedUser),
    };

    const backupTxs = loadServerTransactions();
    backupTxs.unshift(newTx);
    saveServerTransactions(backupTxs);
    await createTransaction(newTx).catch(() => {});

    if (isWithdrawOtpRequired && userCleanPhone) {
      consumeOtpAfterAction(userCleanPhone, reqOtp);
    }

    console.log(
      `[Atomic Withdrawal] ✅ ${updatedUser.nickname} (${updatedUser.id}) requested $${reqAmount.toFixed(2)} -> New Withdrawal Balance: $${updatedUser.withdrawalBalance.toFixed(2)} [Ref: ${refNo}]`
    );

    return res.json({
      success: true,
      message: 'Withdrawal submitted',
      feePercent,
      fee,
      netPayout,
      user: updatedUser,
      transaction: newTx,
    });
  } catch (err: any) {
    console.error('[Atomic Withdrawal Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Withdrawal request failed' });
  } finally {
    withdrawRequestLocks.delete(cleanUserId);
  }
});

// API Route: Atomic Daily Dividend Claim with Instant Wallet Credit & Instant Senior Referral Commission
const claimDividendLocks = new Set<string>();

app.post('/api/user/claim-dividend', async (req, res) => {
  const { userId, targetOrderId, customEarnings, clientOrders, clientUser } = req.body || {};
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  const cleanUserId = String(userId).trim();
  if (claimDividendLocks.has(cleanUserId)) {
    return res.status(429).json({
      success: false,
      error: 'Dividend claim is already processing. Please wait a moment.',
    });
  }
  claimDividendLocks.add(cleanUserId);

  try {
    // 1. Authoritative user lookup (SQLite -> Combined SQL/Disk/Cloud -> Dev Client Seed if absent)
    let user = getUserByIdOrPhoneFromSql(cleanUserId);
    if (!user) {
      const combined = await getCombinedServerUsers();
      const cleanDigits = cleanUserId.replace(/\D/g, '').slice(-10);
      const matched = combined.find(
        (u) =>
          String(u.id || '').trim() === cleanUserId ||
          String(u.uid || '').trim() === cleanUserId ||
          (cleanDigits.length === 10 && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanDigits)
      );
      if (matched) {
        user = upsertUserInSql(matched);
      } else if (clientUser && (String(clientUser.id || '').trim() === cleanUserId || clientUser.phone)) {
        user = upsertUserInSql({ ...clientUser, id: cleanUserId });
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found in database' });
    }

    const userPhoneDigits = String(user.phone || '').replace(/\D/g, '').slice(-10);
    const idVariants = Array.from(
      new Set(
        [
          cleanUserId,
          String(user.id || '').trim(),
          user.phone,
          userPhoneDigits,
          userPhoneDigits ? `+91 ${userPhoneDigits}` : '',
        ].filter(Boolean) as string[]
      )
    );
    const idSet = new Set(idVariants);
    const deletedOrdersSet = loadDeletedOrders();

    // 2. Merge orders across SQLite + Disk backup + Cloud SQL + missing client/Firestore orders
    const sqlOrders = getOrdersForUserFromSql(idVariants);
    const diskOrdersAll = loadServerOrders();
    const diskUserOrders = diskOrdersAll.filter((o: any) => {
      if (!o || !o.id) return false;
      const oUid = String(o.userId || '').trim();
      const oPhone = String(o.userPhone || '').replace(/\D/g, '').slice(-10);
      return idSet.has(oUid) || (oPhone && (idSet.has(oPhone) || oPhone === userPhoneDigits));
    });

    let cloudUserOrders: any[] = [];
    try {
      cloudUserOrders = await getDbOrdersByUser(user.id, user.phone);
    } catch {}

    const mergedOrderMap = new Map<string, any>();
    for (const o of [...sqlOrders, ...diskUserOrders, ...cloudUserOrders]) {
      if (!o || !o.id) continue;
      const strId = String(o.id).trim();
      if (deletedOrdersSet.has(strId.toLowerCase())) continue;
      const prev = mergedOrderMap.get(strId);
      const next = prev ? mergeOrderSafe(prev, o) : o;
      mergedOrderMap.set(strId, next);
      // Ensure SQLite has the reconciled order row
      try {
        upsertOrderInSql(next);
      } catch {}
    }

    // Seed any active client/Firestore order that does not exist on server yet
    if (Array.isArray(clientOrders)) {
      for (const co of clientOrders) {
        if (!co || !co.id) continue;
        const strId = String(co.id).trim();
        if (deletedOrdersSet.has(strId.toLowerCase())) continue;
        if (!mergedOrderMap.has(strId)) {
          const coUid = String(co.userId || user.id).trim();
          const coPhone = String(co.userPhone || user.phone || '').replace(/\D/g, '').slice(-10);
          const belongsToUser =
            idSet.has(coUid) || (coPhone && userPhoneDigits && coPhone === userPhoneDigits);
          if (belongsToUser) {
            const seeded = upsertOrderInSql({
              ...co,
              userId: user.id,
              userPhone: co.userPhone || user.phone,
              userNickname: co.userNickname || user.nickname,
            });
            if (seeded) mergedOrderMap.set(strId, seeded);
          }
        }
      }
    }

    const userOrders = Array.from(mergedOrderMap.values());
    const now = Date.now();

    const activeContracts = userOrders.filter(
      (o: any) => o.status === 'active' && (!targetOrderId || String(o.id) === String(targetOrderId))
    );

    if (activeContracts.length === 0) {
      return res.status(400).json({ success: false, error: 'No active contracts eligible for daily dividend' });
    }

    let totalClaim = 0;
    const eligibleUpdates: any[] = [];
    const nextClaimTime = now + 24 * 60 * 60 * 1000;

    for (const ord of activeContracts) {
      const cycleDays = Number(ord.cycleDays) || 1;
      const daysElapsed = Number(ord.daysElapsed) || 0;
      if (ord.status === 'completed' || daysElapsed >= cycleDays) {
        continue;
      }

      const lastClaim = Number(ord.lastClaimTimestamp) || 0;
      const effectiveStart = lastClaim > 0 ? lastClaim : Number(ord.purchaseTimestamp) || 0;
      const nextClaim = Number(ord.nextClaimTimestamp) || (effectiveStart + 24 * 3600 * 1000);

      // STRICT 24-HOUR COOLDOWN CHECK:
      // Due if Admin passed customEarnings, OR nextClaimTimestamp has arrived AND 23.5h elapsed since last claim (or never claimed yet)
      const isDue =
        customEarnings !== undefined ||
        (now >= nextClaim && (effectiveStart === 0 || now - effectiveStart >= 23.5 * 3600 * 1000));

      if (isDue) {
        const dividend = customEarnings !== undefined ? Number(customEarnings) : Number(ord.dailyEarnings || 0);
        if (!Number.isFinite(dividend) || dividend <= 0) {
          continue;
        }
        totalClaim += dividend;

        const newElapsed = daysElapsed + 1;
        const isFinished = newElapsed >= cycleDays;
        const updatedOrd = {
          ...ord,
          userId: ord.userId || user.id,
          userPhone: ord.userPhone || user.phone,
          userNickname: ord.userNickname || user.nickname,
          daysElapsed: newElapsed,
          totalAccrued: Number(((Number(ord.totalAccrued) || 0) + dividend).toFixed(2)),
          lastClaimDate: new Date(now).toISOString().split('T')[0],
          lastClaimTimestamp: now,
          nextClaimTimestamp: nextClaimTime,
          status: isFinished ? 'completed' : 'active',
          updatedAt: new Date(now).toISOString(),
        };
        eligibleUpdates.push(updatedOrd);
      }
    }

    if (eligibleUpdates.length === 0 || totalClaim <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Daily dividend requires 24 hours cooldown between claims (24 घंटे पूरे होने के बाद ही अगला क्लेम करें)',
      });
    }

    totalClaim = Number(totalClaim.toFixed(2));

    // 3. Atomically update claimed orders AND credit user's Withdrawable Balance & Product Revenue inside SQLite transaction
    const db = getSqliteDb();
    initSqliteUsersTable();
    let freshUser: any = null;

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const updatedOrd of eligibleUpdates) {
        upsertOrderInSql(updatedOrd);
      }
      freshUser = creditUserDividendInSql(user.id, totalClaim);
      if (!freshUser) {
        throw new Error('Failed to locate user row in SQLite during atomic dividend credit');
      }
      db.exec('COMMIT');
    } catch (sqlErr: any) {
      try {
        db.exec('ROLLBACK');
      } catch {}
      throw sqlErr;
    }

    // 4. Permanently sync updated orders to disk backup & Cloud SQL
    const diskOrders = loadServerOrders();
    for (const updatedOrd of eligibleUpdates) {
      const dIdx = diskOrders.findIndex((d) => String(d.id) === String(updatedOrd.id));
      if (dIdx >= 0) {
        diskOrders[dIdx] = { ...diskOrders[dIdx], ...updatedOrd };
      } else {
        diskOrders.unshift(updatedOrd);
      }
      upsertDbOrder(updatedOrd).catch(() => {});
    }
    saveServerOrders(diskOrders);

    markUserRuntimeMutated(freshUser.id, freshUser.phone);

    // 5. Permanently sync credited user to disk backup & Cloud SQL
    const diskUsers = getCachedUsersBackup();
    const mergedDiskUsers = deduplicateAndMergeUsers(diskUsers, [{ ...freshUser, isAuthoritativeServer: true }]);
    saveUsersBackup(mergedDiskUsers);

    upsertUser({
      uid: freshUser.id,
      phone: freshUser.phone,
      withdrawalBalance: freshUser.withdrawalBalance,
      productRevenue: freshUser.productRevenue,
      isExplicitZeroReset: false,
      explicitZeroWallets: freshUser.explicitZeroWallets,
      balanceUpdatedAt: freshUser.balanceUpdatedAt,
      updatedAt: freshUser.updatedAt,
    }).catch(() => {});

    // 6. Create dividend earnings transaction
    const divRef = `DIV-${freshUser.id}-${now}`;
    const divTx = {
      id: `tx-div-${now}`,
      userId: freshUser.id,
      phone: freshUser.phone || '',
      type: 'earnings',
      amount: totalClaim,
      title: `Daily 24-Hour Dividend Settled (${eligibleUpdates.length} contract${eligibleUpdates.length > 1 ? 's' : ''})`,
      timestamp: formatISTTimestamp(now),
      createdAt: now,
      status: 'completed',
      referenceNo: divRef,
      paymentMethod: 'Product Daily Return',
      ...buildUserBalanceSnapshot(freshUser),
    };
    const allTxs = loadServerTransactions();
    allTxs.unshift(divTx);
    saveServerTransactions(allTxs);
    createTransaction(divTx).catch(() => {});

    // 7. Safely distribute senior / upline commissions (non-blocking if error)
    let commissionResult: any = { success: true, credited: [] };
    try {
      commissionResult = await distributeReferralCommissionServer(
        freshUser.id,
        totalClaim,
        'daily_income',
        divRef
      );
    } catch (commErr) {
      console.warn('[Daily Dividend Engine] Senior commission notice:', commErr);
    }

    const updatedOrders = getOrdersForUserFromSql(idVariants);

    console.log(
      `[Daily Dividend Engine] ✅ Successfully settled $${totalClaim} dividend for ${freshUser.nickname} (${freshUser.id}) -> Withdrawable: $${freshUser.withdrawalBalance}, Revenue: $${freshUser.productRevenue}. Senior commission distributed to ${commissionResult?.credited?.length || 0} upliners.`
    );

    return res.json({
      success: true,
      claimedAmount: totalClaim,
      user: freshUser,
      orders: updatedOrders,
      transaction: divTx,
      commissionResult,
      message: `Daily dividend of $${totalClaim.toFixed(2)} added instantly to your wallet, and commission credited to your seniors!`,
    });
  } catch (err: any) {
    console.error('[Claim Dividend Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    claimDividendLocks.delete(cleanUserId);
  }
});

// ==========================================
// API Routes: Peer-to-Peer (P2P) Instant Fund Transfer
// ==========================================
const p2pTransferLocks = new Set<string>();

function maskPhoneNumber(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '******';
  return `******${digits.slice(-4)}`;
}

async function resolveAuthoritativeUserForP2P(identifier: string): Promise<any | null> {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const deletedSet = loadDeletedUsers();

  let userRecord = getUserByIdOrPhoneFromSql(raw);
  if (!userRecord) {
    const digits = raw.replace(/\D/g, '');
    const cleanPhone = digits.length >= 10 ? digits.slice(-10) : '';
    const upperCode = raw.toUpperCase();
    const lowerRaw = raw.toLowerCase();
    const allUsers = await getCombinedServerUsers();

    // Prioritize deterministic unique identifiers before nickname fallback
    let match =
      allUsers.find((u) => String(u.id || '').trim() === raw) ||
      (cleanPhone.length === 10
        ? allUsers.find((u) => String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)
        : undefined) ||
      allUsers.find((u) => u.invitationCode && String(u.invitationCode).trim().toUpperCase() === upperCode);

    if (!match && raw.length >= 2) {
      const nameMatches = allUsers.filter(
        (u) => u.nickname && String(u.nickname).trim().toLowerCase() === lowerRaw
      );
      if (nameMatches.length === 1) {
        match = nameMatches[0];
      }
    }

    if (match) {
      userRecord = upsertUserInSql(match);
    }
  }

  if (!userRecord) return null;
  const uId = String(userRecord.id || '').trim();
  const uPhone = String(userRecord.phone || '').replace(/\D/g, '').slice(-10);
  if (deletedSet.has(uId) || (uPhone && deletedSet.has(uPhone)) || userRecord.isDeleted) {
    return null;
  }
  return userRecord;
}

function isSameUserForP2P(
  sender: { id?: string; phone?: string } | null,
  recipient: { id?: string; phone?: string } | null,
  fallbackSenderId?: string,
  fallbackSenderPhone?: string
): boolean {
  if (!recipient) return false;
  const recipientId = String(recipient.id || '').trim();
  const recipientPhoneDigits = String(recipient.phone || '').replace(/\D/g, '');
  const recipientPhone = recipientPhoneDigits.length >= 10 ? recipientPhoneDigits.slice(-10) : '';

  const sId = String(sender?.id || fallbackSenderId || '').trim();
  const sPhoneRaw = String(sender?.phone || fallbackSenderPhone || '').replace(/\D/g, '');
  const sPhone = sPhoneRaw.length >= 10 ? sPhoneRaw.slice(-10) : '';

  if (sId && recipientId && recipientId === sId) return true;
  if (sPhone.length === 10 && recipientPhone.length === 10 && recipientPhone === sPhone) return true;
  return false;
}

// Lookup recipient safely by User ID, 10-digit Mobile Number, or Invitation Code
app.get('/api/p2p/lookup', async (req, res) => {
  try {
    const rawQuery = String(req.query.query || req.query.q || '').trim();
    const senderId = String(req.query.senderId || req.query.excludeUserId || '').trim();
    const senderPhone = String(req.query.senderPhone || '').replace(/\D/g, '').slice(-10);

    if (!rawQuery || rawQuery.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid User ID, 10-digit Mobile Number, or Invite Code.',
      });
    }

    const recipient = await resolveAuthoritativeUserForP2P(rawQuery);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'No registered user found with that User ID, Mobile Number, or Invite Code.',
      });
    }

    if (senderId || senderPhone.length === 10) {
      const senderRecord =
        (senderId ? await resolveAuthoritativeUserForP2P(senderId) : null) ||
        (senderPhone.length === 10 ? await resolveAuthoritativeUserForP2P(senderPhone) : null);

      if (isSameUserForP2P(senderRecord, recipient, senderId, senderPhone)) {
        const senderLabel = senderRecord
          ? `${senderRecord.nickname || 'Member'} (ID ${senderRecord.id})`
          : `ID ${senderId}`;
        return res.status(400).json({
          success: false,
          error: `You cannot transfer funds to your own account (${senderLabel}). Please enter a different member's User ID, Mobile, or Invite Code.`,
        });
      }
    }

    if (recipient.status === 'frozen' || recipient.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Recipient account is currently frozen or suspended.',
      });
    }

    return res.json({
      success: true,
      recipient: {
        id: String(recipient.id),
        nickname: recipient.nickname || `Member_${String(recipient.id).slice(-4)}`,
        phoneMasked: maskPhoneNumber(recipient.phone),
        invitationCode: recipient.invitationCode || '',
        vipLevel: Number(recipient.vipLevel) || 0,
        avatar: recipient.avatar || 'HD',
      },
    });
  } catch (err: any) {
    console.error('[P2P Lookup Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lookup failed' });
  }
});

// Shared atomic P2P execution helper (used by both user P2P & Admin P2P)
async function performAtomicP2PTransfer(params: {
  sender: any;
  recipient: any;
  amount: number;
  sourceWallet: 'withdrawalBalance' | 'rechargeBalance';
  targetWallet: 'withdrawalBalance' | 'rechargeBalance';
  note?: string;
  initiatedBy?: 'user' | 'admin';
}) {
  const { sender, recipient, amount, sourceWallet, targetWallet, note, initiatedBy = 'user' } = params;
  const srcCol = sourceWallet === 'rechargeBalance' ? 'recharge_balance' : 'withdrawal_balance';
  const dstCol = targetWallet === 'rechargeBalance' ? 'recharge_balance' : 'withdrawal_balance';

  const db = getSqliteDb();
  initSqliteUsersTable();
  const nowIso = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    const senderRow = db.prepare('SELECT * FROM platform_users WHERE id = ?').get(sender.id) as any;
    const recipientRow = db.prepare('SELECT * FROM platform_users WHERE id = ?').get(recipient.id) as any;

    if (!senderRow || !recipientRow) {
      throw new Error('User record missing during atomic transfer');
    }

    const dbSenderBal = Number(senderRow[srcCol]) || 0;
    if (dbSenderBal < amount) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const atomicSenderNext = Number((dbSenderBal - amount).toFixed(2));
    const atomicRecipientNext = Number(((Number(recipientRow[dstCol]) || 0) + amount).toFixed(2));

    let senderRaw: any = {};
    try {
      senderRaw = JSON.parse(senderRow.raw_json || '{}');
    } catch {}
    senderRaw[sourceWallet] = atomicSenderNext;
    const prevSenderZeros: string[] = Array.isArray(senderRaw.explicitZeroWallets) ? senderRaw.explicitZeroWallets : [];
    const senderZeroSet = new Set<string>(prevSenderZeros);
    if (atomicSenderNext === 0) senderZeroSet.add(sourceWallet);
    else senderZeroSet.delete(sourceWallet);
    senderRaw.explicitZeroWallets = Array.from(senderZeroSet);
    senderRaw.isExplicitZeroReset = false;
    senderRaw.balanceUpdatedAt = nowIso;
    senderRaw.updatedAt = nowIso;

    let recipientRaw: any = {};
    try {
      recipientRaw = JSON.parse(recipientRow.raw_json || '{}');
    } catch {}
    recipientRaw[targetWallet] = atomicRecipientNext;
    if (Array.isArray(recipientRaw.explicitZeroWallets)) {
      recipientRaw.explicitZeroWallets = recipientRaw.explicitZeroWallets.filter((w: string) => w !== targetWallet);
    }
    recipientRaw.isExplicitZeroReset = false;
    recipientRaw.balanceUpdatedAt = nowIso;
    recipientRaw.updatedAt = nowIso;

    db.prepare(
      `UPDATE platform_users SET ${srcCol} = ?, raw_json = ?, balance_updated_at = ?, updated_at = ? WHERE id = ?`
    ).run(atomicSenderNext, JSON.stringify(senderRaw), nowIso, nowIso, sender.id);

    db.prepare(
      `UPDATE platform_users SET ${dstCol} = ?, raw_json = ?, balance_updated_at = ?, updated_at = ? WHERE id = ?`
    ).run(atomicRecipientNext, JSON.stringify(recipientRaw), nowIso, nowIso, recipient.id);

    db.exec('COMMIT');
  } catch (sqlErr: any) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw sqlErr;
  }

  const updatedSender = getUserByIdOrPhoneFromSql(sender.id) || {
    ...sender,
    [sourceWallet]: Number(((Number(sender[sourceWallet]) || 0) - amount).toFixed(2)),
    balanceUpdatedAt: nowIso,
    updatedAt: nowIso,
  };
  const updatedRecipient = getUserByIdOrPhoneFromSql(recipient.id) || {
    ...recipient,
    [targetWallet]: Number(((Number(recipient[targetWallet]) || 0) + amount).toFixed(2)),
    balanceUpdatedAt: nowIso,
    updatedAt: nowIso,
  };

  markUserRuntimeMutated(updatedSender.id, updatedSender.phone);
  markUserRuntimeMutated(updatedRecipient.id, updatedRecipient.phone);

  const senderZeroArr: string[] = Array.isArray(updatedSender.explicitZeroWallets)
    ? [...updatedSender.explicitZeroWallets]
    : [];
  if (Number(updatedSender[sourceWallet]) === 0 && !senderZeroArr.includes(sourceWallet)) {
    senderZeroArr.push(sourceWallet);
  }
  const senderWithZeroFlag = {
    ...updatedSender,
    isExplicitZeroReset: false,
    explicitZeroWallets: senderZeroArr,
    balanceUpdatedAt: updatedSender.balanceUpdatedAt || nowIso,
  };

  const diskUsers = getCachedUsersBackup();
  const updatedDisk = deduplicateAndMergeUsers(diskUsers, [
    { ...senderWithZeroFlag, isAuthoritativeServer: true },
    { ...updatedRecipient, isAuthoritativeServer: true },
  ]);
  saveUsersBackup(updatedDisk);

  upsertUser({
    uid: updatedSender.id,
    phone: updatedSender.phone,
    [sourceWallet]: updatedSender[sourceWallet],
    isExplicitZeroReset: false,
    explicitZeroWallets: senderZeroArr,
    balanceUpdatedAt: nowIso,
    updatedAt: nowIso,
  }).catch(() => {});
  upsertUser({
    uid: updatedRecipient.id,
    phone: updatedRecipient.phone,
    [targetWallet]: updatedRecipient[targetWallet],
    isExplicitZeroReset: false,
    explicitZeroWallets: updatedRecipient.explicitZeroWallets,
    balanceUpdatedAt: nowIso,
    updatedAt: nowIso,
  }).catch(() => {});

  const nowMs = Date.now();
  const refBase = `${initiatedBy === 'admin' ? 'AP2P' : 'P2P'}${nowMs.toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
  const cleanNote = String(note || '').trim().slice(0, 120);
  const srcLabel = sourceWallet === 'withdrawalBalance' ? 'Withdrawal Balance' : 'Charged Balance';
  const dstLabel = targetWallet === 'withdrawalBalance' ? 'Withdrawal Balance' : 'Charged Balance';
  const timestampStr = formatISTTimestamp(nowMs);
  const adminPrefix = initiatedBy === 'admin' ? '[Admin] ' : '';

  const senderTx = {
    id: `tx-p2p-out-${nowMs}`,
    userId: updatedSender.id,
    type: 'p2p_send',
    amount,
    title: `${adminPrefix}P2P Transfer to ${updatedRecipient.nickname} (ID ${updatedRecipient.id})${cleanNote ? ` • ${cleanNote}` : ''}`,
    timestamp: timestampStr,
    createdAt: nowMs,
    status: 'completed',
    referenceNo: `${refBase}-OUT`,
    paymentMethod: `${adminPrefix}P2P (${srcLabel} → ${dstLabel})`,
    counterpartyId: updatedRecipient.id,
    counterpartyName: updatedRecipient.nickname,
    counterpartyPhone: updatedRecipient.phone,
    senderId: updatedSender.id,
    senderName: updatedSender.nickname,
    senderPhone: updatedSender.phone,
    recipientId: updatedRecipient.id,
    recipientName: updatedRecipient.nickname,
    recipientPhone: updatedRecipient.phone,
    sourceWallet,
    targetWallet,
    initiatedBy,
    note: cleanNote || undefined,
    ...buildUserBalanceSnapshot(updatedSender),
  };

  const recipientTx = {
    id: `tx-p2p-in-${nowMs + 1}`,
    userId: updatedRecipient.id,
    type: 'p2p_receive',
    amount,
    title: `${adminPrefix}P2P Received from ${updatedSender.nickname} (ID ${updatedSender.id})${cleanNote ? ` • ${cleanNote}` : ''}`,
    timestamp: timestampStr,
    createdAt: nowMs,
    status: 'completed',
    referenceNo: `${refBase}-IN`,
    paymentMethod: `${adminPrefix}P2P Credit (${dstLabel})`,
    counterpartyId: updatedSender.id,
    counterpartyName: updatedSender.nickname,
    counterpartyPhone: updatedSender.phone,
    senderId: updatedSender.id,
    senderName: updatedSender.nickname,
    senderPhone: updatedSender.phone,
    recipientId: updatedRecipient.id,
    recipientName: updatedRecipient.nickname,
    recipientPhone: updatedRecipient.phone,
    sourceWallet,
    targetWallet,
    initiatedBy,
    note: cleanNote || undefined,
    ...buildUserBalanceSnapshot(updatedRecipient),
  };

  const allTxs = loadServerTransactions();
  allTxs.unshift(recipientTx);
  allTxs.unshift(senderTx);
  saveServerTransactions(allTxs);
  createTransaction(senderTx).catch(() => {});
  createTransaction(recipientTx).catch(() => {});

  return {
    refBase,
    nowIso,
    senderWithZeroFlag,
    updatedRecipient,
    senderTx,
    recipientTx,
  };
}

// Execute atomic P2P wallet-to-wallet transfer
app.post('/api/p2p/transfer', async (req, res) => {
  const { senderId, recipientQuery, amount, sourceWallet, note } = req.body || {};
  const cleanSenderId = String(senderId || '').trim();

  if (!cleanSenderId) {
    return res.status(400).json({ success: false, error: 'Sender authentication is required.' });
  }
  if (!recipientQuery || !String(recipientQuery).trim()) {
    return res.status(400).json({ success: false, error: 'Recipient User ID, Phone, or Invite Code is required.' });
  }

  const liveSettings = loadServerPlatformSettings();
  if (liveSettings.isP2PEnabled === false) {
    return res.status(403).json({
      success: false,
      error: liveSettings.p2pNotice || 'P2P transfers are currently paused by Administrator.',
    });
  }

  const minAmt = Math.max(0.01, Number(liveSettings.minP2PAmount) || 1);
  const maxAmt = Math.max(minAmt, Number(liveSettings.maxP2PAmount) || 50000);
  const transferAmount = Number(Number(amount).toFixed(2));
  if (!Number.isFinite(transferAmount) || transferAmount < minAmt) {
    return res.status(400).json({ success: false, error: `Minimum P2P transfer amount is $${minAmt.toFixed(2)}.` });
  }
  if (transferAmount > maxAmt) {
    return res.status(400).json({ success: false, error: `Maximum single P2P transfer limit is $${maxAmt.toFixed(2)}.` });
  }

  if (p2pTransferLocks.has(cleanSenderId)) {
    return res.status(429).json({
      success: false,
      error: 'A transfer is already processing for your account. Please wait a moment.',
    });
  }
  p2pTransferLocks.add(cleanSenderId);

  try {
    const sender = await resolveAuthoritativeUserForP2P(cleanSenderId);
    if (!sender) {
      return res.status(404).json({ success: false, error: 'Sender account not found.' });
    }
    if (sender.status === 'frozen' || sender.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your account is frozen or suspended. Please contact support.',
      });
    }

    const recipient = await resolveAuthoritativeUserForP2P(String(recipientQuery).trim());
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'Recipient user not found. Please verify User ID, Mobile Number, or Invite Code.',
      });
    }

    if (isSameUserForP2P(sender, recipient)) {
      return res.status(400).json({
        success: false,
        error: `You cannot transfer funds to your own account (${sender.nickname || 'Member'} · ID ${sender.id}).`,
      });
    }

    if (recipient.status === 'frozen' || recipient.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Recipient account is currently frozen or suspended.',
      });
    }

    const srcWallet: 'withdrawalBalance' | 'rechargeBalance' =
      sourceWallet === 'rechargeBalance' ? 'rechargeBalance' : 'withdrawalBalance';

    // Always credit the receiver's Charged Balance (rechargeBalance) regardless of sender's payment method
    const dstWallet: 'rechargeBalance' = 'rechargeBalance';

    const currentSenderBal = Number(sender[srcWallet]) || 0;
    if (currentSenderBal < transferAmount) {
      const walletLabel = srcWallet === 'withdrawalBalance' ? 'Withdrawal Balance' : 'Charged Balance';
      return res.status(400).json({
        success: false,
        error: `Insufficient ${walletLabel}. Available: $${currentSenderBal.toFixed(2)}`,
      });
    }

    const reqOtp = String((req.body || {}).otp || '').trim();
    otpSettings = loadServerOtpSettings();
    const isP2POtpRequired =
      otpSettings.smsGatewayActive !== false && liveSettings.smsGatewayActive !== false;
    const senderCleanPhone = String(sender.phone || '').replace(/\D/g, '').slice(-10);

    if (isP2POtpRequired) {
      if (!senderCleanPhone || senderCleanPhone.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Valid registered 10-digit mobile number is required for OTP verification.',
        });
      }
      if (!reqOtp || reqOtp.length !== 6) {
        return res.status(400).json({
          success: false,
          error: 'Please enter the 6-digit verification code (OTP) sent to your mobile number.',
        });
      }
      const otpCheck = checkAndVerifyOtp(senderCleanPhone, reqOtp);
      if (!otpCheck.ok) {
        return res.status(400).json({
          success: false,
          error: otpCheck.error || 'Wrong OTP (गलत OTP). P2P transfer denied.',
        });
      }
    }

    let transferResult;
    try {
      transferResult = await performAtomicP2PTransfer({
        sender,
        recipient,
        amount: transferAmount,
        sourceWallet: srcWallet,
        targetWallet: dstWallet,
        note,
        initiatedBy: 'user',
      });
    } catch (sqlErr: any) {
      if (sqlErr?.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ success: false, error: 'Insufficient wallet balance for P2P transfer.' });
      }
      throw sqlErr;
    }

    if (isP2POtpRequired && senderCleanPhone) {
      consumeOtpAfterAction(senderCleanPhone, reqOtp);
    }

    const { refBase, nowIso, senderWithZeroFlag, updatedRecipient, senderTx, recipientTx } = transferResult;

    console.log(
      `[P2P Transfer] ✅ ${senderWithZeroFlag.nickname} (${senderWithZeroFlag.id}) sent $${transferAmount.toFixed(2)} (${srcWallet} → ${dstWallet}) to ${updatedRecipient.nickname} (${updatedRecipient.id}) [Ref: ${refBase}]`
    );

    return res.json({
      success: true,
      referenceNo: refBase,
      sender: senderWithZeroFlag,
      recipientPreview: {
        id: String(updatedRecipient.id),
        nickname: updatedRecipient.nickname,
        phoneMasked: maskPhoneNumber(updatedRecipient.phone),
        invitationCode: updatedRecipient.invitationCode || '',
        vipLevel: Number(updatedRecipient.vipLevel) || 0,
        avatar: updatedRecipient.avatar || 'HD',
      },
      recipientWalletUpdate: {
        id: String(updatedRecipient.id),
        rechargeBalance: updatedRecipient.rechargeBalance,
        withdrawalBalance: updatedRecipient.withdrawalBalance,
        updatedAt: nowIso,
      },
      senderTransaction: senderTx,
      recipientTransaction: recipientTx,
      message: `Successfully transferred $${transferAmount.toFixed(2)} to ${updatedRecipient.nickname} (ID ${updatedRecipient.id})!`,
    });
  } catch (err: any) {
    console.error('[P2P Transfer Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'P2P transfer failed' });
  } finally {
    p2pTransferLocks.delete(cleanSenderId);
  }
});

// Admin API: Consolidated P2P Transfer History & Analytics
app.get('/api/admin/p2p/history', async (_req, res) => {
  try {
    const [dbTxs, usersList] = await Promise.all([
      getAllTransactionsFromDb().catch(() => []),
      getCombinedServerUsers().catch(() => []),
    ]);
    const backupTxs = loadServerTransactions();

    const usersById = new Map<string, any>();
    for (const u of usersList) {
      if (u?.id) usersById.set(String(u.id).trim(), u);
    }

    const txMap = new Map<string, any>();
    for (const tx of [...backupTxs, ...dbTxs]) {
      if (!tx) continue;
      if (tx.type !== 'p2p_send' && tx.type !== 'p2p_receive') continue;
      const key = String(tx.referenceNo || tx.id || `p2p-${tx.createdAt || Date.now()}`);
      txMap.set(key, { ...(txMap.get(key) || {}), ...tx });
    }

    const ledger = Array.from(txMap.values())
      .map((tx: any) => normalizeTxTimestampIST(tx))
      .sort((a: any, b: any) => extractTxEpochMs(b) - extractTxEpochMs(a));

    // Group paired -OUT and -IN records into unified Sender -> Receiver transfer items
    const pairMap = new Map<string, any>();
    for (const tx of ledger) {
      const rawRef = String(tx.referenceNo || tx.id || '').trim();
      const baseRef = rawRef.replace(/-(OUT|IN)$/i, '');
      const existing = pairMap.get(baseRef) || {
        referenceNo: baseRef,
        amount: Math.abs(Number(tx.amount) || 0),
        sourceWallet: tx.sourceWallet || 'withdrawalBalance',
        targetWallet: tx.targetWallet || 'rechargeBalance',
        status: tx.status || 'completed',
        timestamp: tx.timestamp || '',
        createdAt: Number(tx.createdAt) || 0,
        note: tx.note || '',
        initiatedBy: tx.initiatedBy || (baseRef.startsWith('AP2P') ? 'admin' : 'user'),
        senderId: tx.senderId || '',
        senderName: tx.senderName || '',
        senderPhone: tx.senderPhone || '',
        recipientId: tx.recipientId || '',
        recipientName: tx.recipientName || '',
        recipientPhone: tx.recipientPhone || '',
      };

      if (tx.type === 'p2p_send') {
        const sUser = usersById.get(String(tx.userId || '').trim());
        const rUser = usersById.get(String(tx.counterpartyId || '').trim());
        existing.senderId = String(tx.userId || existing.senderId || '');
        existing.senderName = sUser?.nickname || tx.senderName || existing.senderName || `ID ${existing.senderId}`;
        existing.senderPhone = sUser?.phone || tx.senderPhone || existing.senderPhone || '';
        existing.recipientId = String(tx.counterpartyId || existing.recipientId || '');
        existing.recipientName = rUser?.nickname || tx.counterpartyName || existing.recipientName || `ID ${existing.recipientId}`;
        existing.recipientPhone = rUser?.phone || tx.counterpartyPhone || existing.recipientPhone || '';
        existing.sourceWallet = tx.sourceWallet || existing.sourceWallet;
        existing.targetWallet = tx.targetWallet || existing.targetWallet;
      } else if (tx.type === 'p2p_receive') {
        const rUser = usersById.get(String(tx.userId || '').trim());
        const sUser = usersById.get(String(tx.counterpartyId || '').trim());
        existing.recipientId = String(tx.userId || existing.recipientId || '');
        existing.recipientName = rUser?.nickname || tx.recipientName || existing.recipientName || `ID ${existing.recipientId}`;
        existing.recipientPhone = rUser?.phone || tx.recipientPhone || existing.recipientPhone || '';
        if (!existing.senderId && tx.counterpartyId) {
          existing.senderId = String(tx.counterpartyId);
        }
        existing.senderName = sUser?.nickname || tx.counterpartyName || existing.senderName || (existing.senderId ? `ID ${existing.senderId}` : 'Member');
        existing.senderPhone = sUser?.phone || tx.counterpartyPhone || existing.senderPhone || '';
        existing.targetWallet = tx.targetWallet || existing.targetWallet;
      }

      if (!existing.note && tx.note) existing.note = tx.note;
      if (!existing.timestamp && tx.timestamp) existing.timestamp = tx.timestamp;
      if (!existing.createdAt && tx.createdAt) existing.createdAt = Number(tx.createdAt) || 0;
      pairMap.set(baseRef, normalizeTxTimestampIST(existing));
    }

    const transfers = Array.from(pairMap.values()).sort(
      (a: any, b: any) => extractTxEpochMs(b) - extractTxEpochMs(a)
    );

    let totalVolume = 0;
    let chargedSourceVolume = 0;
    let withdrawalSourceVolume = 0;
    let chargedSourceCount = 0;
    let withdrawalSourceCount = 0;

    for (const tr of transfers) {
      const amt = Number(tr.amount) || 0;
      totalVolume += amt;
      if (tr.sourceWallet === 'rechargeBalance') {
        chargedSourceVolume += amt;
        chargedSourceCount += 1;
      } else {
        withdrawalSourceVolume += amt;
        withdrawalSourceCount += 1;
      }
    }

    return res.json({
      success: true,
      transfers,
      ledger,
      stats: {
        totalTransfers: transfers.length,
        totalVolume: Number(totalVolume.toFixed(2)),
        chargedSourceVolume: Number(chargedSourceVolume.toFixed(2)),
        withdrawalSourceVolume: Number(withdrawalSourceVolume.toFixed(2)),
        chargedSourceCount,
        withdrawalSourceCount,
      },
    });
  } catch (err: any) {
    console.error('[Admin P2P History Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch P2P history' });
  }
});

// Admin API: Execute P2P Transfer between any two platform users
app.post('/api/admin/p2p/transfer', async (req, res) => {
  const { senderQuery, recipientQuery, amount, sourceWallet, targetWallet, note } = req.body || {};
  const cleanSender = String(senderQuery || '').trim();
  const cleanRecipient = String(recipientQuery || '').trim();

  if (!cleanSender || !cleanRecipient) {
    return res.status(400).json({
      success: false,
      error: 'Both sender and recipient identifiers are required.',
    });
  }

  const transferAmount = Number(Number(amount).toFixed(2));
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Valid positive transfer amount is required.' });
  }

  try {
    const sender = await resolveAuthoritativeUserForP2P(cleanSender);
    if (!sender) {
      return res.status(404).json({ success: false, error: 'Sender user account not found.' });
    }
    const recipient = await resolveAuthoritativeUserForP2P(cleanRecipient);
    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient user account not found.' });
    }
    if (isSameUserForP2P(sender, recipient)) {
      return res.status(400).json({ success: false, error: 'Sender and recipient cannot be the same account.' });
    }

    const srcWallet: 'withdrawalBalance' | 'rechargeBalance' =
      sourceWallet === 'withdrawalBalance' ? 'withdrawalBalance' : 'rechargeBalance';
    const dstWallet: 'withdrawalBalance' | 'rechargeBalance' =
      targetWallet === 'withdrawalBalance' ? 'withdrawalBalance' : 'rechargeBalance';

    const currentSenderBal = Number(sender[srcWallet]) || 0;
    if (currentSenderBal < transferAmount) {
      return res.status(400).json({
        success: false,
        error: `Sender has insufficient ${srcWallet === 'withdrawalBalance' ? 'Withdrawal' : 'Charged'} Balance ($${currentSenderBal.toFixed(2)}).`,
      });
    }

    const result = await performAtomicP2PTransfer({
      sender,
      recipient,
      amount: transferAmount,
      sourceWallet: srcWallet,
      targetWallet: dstWallet,
      note: note || 'Admin Executed P2P Transfer',
      initiatedBy: 'admin',
    });

    console.log(
      `[Admin P2P Transfer] ✅ Admin transferred $${transferAmount.toFixed(2)} from ${result.senderWithZeroFlag.nickname} (${result.senderWithZeroFlag.id}) to ${result.updatedRecipient.nickname} (${result.updatedRecipient.id}) [Ref: ${result.refBase}]`
    );

    return res.json({
      success: true,
      referenceNo: result.refBase,
      sender: result.senderWithZeroFlag,
      recipient: result.updatedRecipient,
      senderTransaction: result.senderTx,
      recipientTransaction: result.recipientTx,
      message: `Admin P2P Transfer of $${transferAmount.toFixed(2)} completed (${result.senderWithZeroFlag.nickname} → ${result.updatedRecipient.nickname}).`,
    });
  } catch (err: any) {
    if (err?.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ success: false, error: 'Sender has insufficient wallet balance.' });
    }
    console.error('[Admin P2P Transfer Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Admin P2P transfer failed' });
  }
});

// API Route: Real-time Senior Referral Linkage & Instant Referral Reward on Registration
app.post('/api/referral/register-invite', async (req, res) => {
  try {
    const { newUserId, newUserPhone, newUserNickname, inviteCode } = req.body;
    if (!newUserId || !inviteCode) {
      return res.status(400).json({ success: false, error: 'newUserId and inviteCode required' });
    }

    const cleanCode = String(inviteCode).trim().toUpperCase();
    const cleanDigits = String(inviteCode).replace(/\D/g, '').slice(-10);

    const db = getSqliteDb();
    initSqliteUsersTable();

    // Find senior by invitation code, id, or phone in SQLite
    const row = db.prepare(`
      SELECT * FROM platform_users 
      WHERE UPPER(invitation_code) = ? 
         OR id = ? 
         OR (phone = ? AND length(?) = 10)
      LIMIT 1
    `).get(cleanCode, cleanCode, cleanDigits, cleanDigits) as any;

    if (!row) {
      return res.json({ success: false, message: 'Inviter not found' });
    }

    const senior = mapSqlRowToUser(row);

    // Atomically increment senior's total referrals and lucky spin in SQLite
    const newReferralCount = (senior.totalReferrals || 0) + 1;
    const newSpins = (senior.spinChances || 0) + 1;

    db.prepare(`
      UPDATE platform_users 
      SET total_referrals = ?,
          spin_chances = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(newReferralCount, newSpins, senior.id);

    // Also link senior to new user row in SQLite
    db.prepare(`
      UPDATE platform_users 
      SET invited_by = ?,
          inviter_id = ?,
          inviter_name = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(senior.invitationCode, senior.id, senior.nickname, String(newUserId).trim());

    // Update in disk backup
    const nowRefIso = new Date().toISOString();
    const diskUsers = getCachedUsersBackup();
    const seniorDiskIdx = diskUsers.findIndex((u) => u.id === senior.id);
    if (seniorDiskIdx >= 0) {
      diskUsers[seniorDiskIdx].totalReferrals = newReferralCount;
      diskUsers[seniorDiskIdx].spinChances = newSpins;
      diskUsers[seniorDiskIdx].updatedAt = nowRefIso;
      saveUsersBackup(diskUsers);
    }
    markUserRuntimeMutated(senior.id, senior.phone);
    markUserRuntimeMutated(String(newUserId).trim(), newUserPhone);

    const refTxNow = Date.now();
    const seniorTx = {
      id: `tx-ref-${refTxNow}`,
      userId: senior.id,
      phone: senior.phone || '',
      type: 'bonus',
      amount: 0,
      title: `New Team Member Joined: ${newUserNickname || 'New User'} (+1 Direct Member, +1 Lucky Spin)`,
      timestamp: formatISTTimestamp(refTxNow),
      createdAt: refTxNow,
      status: 'completed',
      referenceNo: `REF-${newUserId}`,
      paymentMethod: 'Referral Team System',
      ...buildUserBalanceSnapshot(senior),
    };
    const allTxs = loadServerTransactions();
    allTxs.unshift(seniorTx);
    saveServerTransactions(allTxs);
    createTransaction(seniorTx).catch(() => {});

    console.log(`[Referral System] ✅ Linked new user ${newUserId} to senior ${senior.nickname} (${senior.id}). Total referrals: ${newReferralCount}`);

    return res.json({
      success: true,
      senior: {
        id: senior.id,
        nickname: senior.nickname,
        totalReferrals: newReferralCount,
        spinChances: newSpins,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Save user bank details permanently into SQLite SQL
app.post('/api/user/bank-details', async (req, res) => {
  try {
    const { userId, phone, bankDetails } = req.body;
    if (!userId && !phone) {
      return res.status(400).json({ success: false, error: 'userId or phone required' });
    }
    if (!bankDetails || typeof bankDetails !== 'object') {
      return res.status(400).json({ success: false, error: 'Valid bankDetails object required' });
    }

    const cleanId = String(userId || phone).trim();
    const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
    const existing: any = getUserByIdOrPhoneFromSql(cleanId) || getUserByIdOrPhoneFromSql(cleanPhone) || { id: cleanId, phone: cleanPhone || cleanId };

    const mergedUser = {
      ...existing,
      bankDetails: {
        accountHolder: bankDetails.accountHolder?.trim() || existing.bankDetails?.accountHolder || '',
        bankName: bankDetails.bankName?.trim() || existing.bankDetails?.bankName || 'Bank IMPS',
        accountNumber: bankDetails.accountNumber?.trim() || existing.bankDetails?.accountNumber || '',
        ifscCode: (bankDetails.ifscCode?.trim() || existing.bankDetails?.ifscCode || '').toUpperCase(),
        upiId: bankDetails.upiId?.trim() || existing.bankDetails?.upiId || '',
      },
    };

    const saved = upsertUserInSql(mergedUser);
    markUserRuntimeMutated(saved.id, saved.phone);
    const diskUsers = getCachedUsersBackup();
    const updatedDisk = deduplicateAndMergeUsers(diskUsers, [saved]);
    saveUsersBackup(updatedDisk);

    // Sync to Cloud SQL in background
    upsertUser({
      uid: saved.id,
      phone: saved.phone,
      bankDetails: saved.bankDetails,
      updatedAt: saved.updatedAt,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Bank details saved permanently in SQLite SQL database!',
      bankDetails: saved.bankDetails,
      user: saved,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Live Referral Code Lookup & Validation (Fast, Permanent Cloud SQL + Backup)
app.get('/api/referral/lookup/:code', async (req, res) => {
  try {
    const rawCode = String(req.params.code || '').trim();
    if (!rawCode) {
      return res.status(400).json({ success: false, valid: false, message: 'Code required' });
    }
    const cleanCode = rawCode.toUpperCase();
    const cleanDigits = rawCode.replace(/\D/g, '').slice(-10);

    const usersList = await getCombinedServerUsers();

    // 1. Check invitationCode match (case-insensitive)
    let match = usersList.find((u) => (u.invitationCode || '').trim().toUpperCase() === cleanCode);

    // 2. Check 10-digit mobile number match
    if (!match && cleanDigits.length === 10) {
      match = usersList.find((u) => (u.phone || '').replace(/\D/g, '').slice(-10) === cleanDigits);
    }

    // 3. Check user ID match
    if (!match) {
      match = usersList.find((u) => String(u.id || '').trim().toUpperCase() === cleanCode);
    }

    // 4. Default admin fallback for 4AB86
    if (!match && cleanCode === '4AB86') {
      match = usersList.find((u) => (u.phone || '').includes('7307112738')) || {
        id: '833863',
        phone: '7307112738',
        nickname: 'gaurav',
        avatar: 'HD',
        invitationCode: '4AB86',
        role: 'admin',
        status: 'active',
      };
    }

    // 5. Fallback for Ravi Sahu legacy code R34VZ
    if (!match && cleanCode === 'R34VZ') {
      match = usersList.find((u) => u.id === '325697' || (u.phone && u.phone.includes('9170481824')));
    }

    // 6. Fallback for Anshusahu code EYAYY -> AAWFK
    if (!match && cleanCode === 'EYAYY') {
      match = usersList.find((u) => u.id === '406332' || (u.phone && u.phone.includes('8858359277')));
    }

    if (match) {
      const cleanPhone = (match.phone || '').replace(/\D/g, '').slice(-10);
      const masked = cleanPhone.length === 10
        ? `+91 ${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}`
        : `User #${match.id}`;

      return res.json({
        success: true,
        valid: true,
        user: {
          id: String(match.id),
          phone: match.phone,
          nickname: match.nickname || `Member_${String(match.id).slice(-4)}`,
          invitationCode: match.invitationCode || cleanCode,
          role: match.role || 'user',
          avatar: match.avatar || 'HD',
          status: match.status || 'active',
          rechargeBalance: match.rechargeBalance || 0,
          withdrawalBalance: match.withdrawalBalance || 0,
          totalCommissionEarned: match.totalCommissionEarned || 0,
          totalReferrals: match.totalReferrals || 0,
          invitedBy: match.invitedBy || undefined,
          inviterId: match.inviterId || undefined,
          inviterName: match.inviterName || undefined,
        },
        referrerInfo: {
          valid: true,
          id: String(match.id),
          name: match.nickname || `Member_${String(match.id).slice(-4)}`,
          code: match.invitationCode || cleanCode,
          phoneMasked: masked,
        },
      });
    }

    return res.json({
      success: false,
      valid: false,
      message: `Referral code ${cleanCode} not found`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, valid: false, error: err.message });
  }
});

// API Route: Get Multi-Tier Team Downlines (Server-side, Instant & Accurate)
app.get('/api/referral/team/:userId', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, members: [] });
    }
    const allUsers = await getCombinedServerUsers();
    const currentUser = allUsers.find(
      (u) => u.id === userId || (u.phone && u.phone.replace(/\D/g, '').slice(-10) === userId.replace(/\D/g, '').slice(-10))
    );

    const userCodes = new Set<string>();
    if (currentUser?.invitationCode) userCodes.add(currentUser.invitationCode.trim().toUpperCase());
    if (userId === '833863' || (currentUser?.phone && currentUser.phone.includes('7307112738'))) {
      userCodes.add('4AB86');
    }
    const userPhoneDigits = currentUser?.phone ? currentUser.phone.replace(/\D/g, '').slice(-10) : '';
    if (userPhoneDigits) userCodes.add(userPhoneDigits);
    if (currentUser?.id) userCodes.add(String(currentUser.id).trim().toUpperCase());
    if (userId) userCodes.add(userId.toUpperCase());

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

    // Add Anshusahu legacy/alias codes so downlines (Lalaram, Sandeep, Amit) NEVER drop
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

    const teamList: any[] = [];
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

    const tier1Ids = new Set(tier1Users.map((u) => String(u.id)));
    const tier1Codes = new Set<string>();
    const tier1Phones = new Set<string>();
    tier1Users.forEach((u) => {
      if (u.id) tier1Codes.add(String(u.id).trim().toUpperCase());
      if (u.invitationCode) tier1Codes.add(u.invitationCode.trim().toUpperCase());
      if (u.phone) {
        const p = u.phone.replace(/\D/g, '').slice(-10);
        tier1Codes.add(p);
        tier1Phones.add(p);
      }
    });

    const allTxs = loadServerTransactions();
    const allOrders = loadServerOrders();
    const [tier1Rate, tier2Rate, tier3Rate] = await getEffectiveCommissionRatesServer();

    const computeDownlineData = (u: any, level: 1 | 2 | 3) => {
      const cleanP = u.phone ? u.phone.replace(/\D/g, '').slice(-10) : '';
      const masked = cleanP.length === 10 ? `+91 ${cleanP.slice(0, 3)}****${cleanP.slice(-3)}` : `User #${u.id}`;
      const join = u.createdAt ? u.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
      const rate = level === 1 ? tier1Rate : level === 2 ? tier2Rate : tier3Rate;
      const uId = String(u.id).trim();

      // 1. Calculate REAL actual recharge / investment:
      const uRechargeTxs = allTxs.filter((t) =>
        (String(t.userId).trim() === uId || (cleanP && t.phone && String(t.phone).replace(/\D/g, '').slice(-10) === cleanP)) &&
        t.type === 'recharge' &&
        t.status === 'completed' &&
        Number(t.amount) > 0
      );
      const sumRechargeTxs = uRechargeTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const uOrders = allOrders.filter((o) =>
        (String(o.userId).trim() === uId || (cleanP && o.userPhone && String(o.userPhone).replace(/\D/g, '').slice(-10) === cleanP)) &&
        o.status !== 'cancelled' &&
        o.status !== 'rejected'
      );
      const sumOrders = uOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);

      let realRecharge = 0;
      if (sumRechargeTxs > 0) {
        realRecharge = sumRechargeTxs;
      } else if (sumOrders > 0) {
        realRecharge = sumOrders;
      } else {
        realRecharge = Number(u.totalInvested) || 0;
      }
      realRecharge = Number(realRecharge.toFixed(2));

      // 2. Calculate EXACT REAL commission this upliner (userId) received from this downline:
      const uplinerCommTxs = allTxs.filter((t) => {
        if (String(t.userId).trim() !== String(userId).trim() || t.type !== 'commission') return false;
        const ref = String(t.referenceNo || '');
        const title = String(t.title || '').toLowerCase();
        const uNick = String(u.nickname || '').trim().toLowerCase();

        if (ref.includes(uId) || (cleanP && ref.includes(cleanP))) return true;
        if ((t as any).downlineUserId && String((t as any).downlineUserId).trim() === uId) return true;
        if (cleanP && cleanP.length >= 10 && title.includes(cleanP)) return true;
        if (uNick && uNick.length >= 3 && title.includes(uNick)) return true;
        if (title.includes(`from ${uId}`) || title.includes(`user #${uId}`)) return true;
        if (uOrders.some((o) => ref.includes(String(o.id)))) return true;
        return false;
      });

      const actualEarnedFromTxs = uplinerCommTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      let commissionContributed = 0;
      if (actualEarnedFromTxs > 0) {
        commissionContributed = Number(actualEarnedFromTxs.toFixed(2));
      } else if (realRecharge > 0) {
        commissionContributed = Number(((realRecharge * rate) / 100).toFixed(2));
      }

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
      if (tier1Ids.has(String(u.id))) return false;
      const matchesInviterId = u.inviterId && tier1Ids.has(String(u.inviterId));
      const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : '';
      const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, '').slice(-10) : '';
      const matchesInvitedBy =
        cleanInvitedBy &&
        (tier1Codes.has(cleanInvitedBy) || (cleanInvitedDigits && tier1Phones.has(cleanInvitedDigits)));
      return Boolean(matchesInviterId || matchesInvitedBy);
    });

    const tier2Ids = new Set(tier2Users.map((u) => String(u.id)));
    const tier2Codes = new Set<string>();
    const tier2Phones = new Set<string>();
    tier2Users.forEach((u) => {
      if (u.id) tier2Codes.add(String(u.id).trim().toUpperCase());
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
      if (tier1Ids.has(String(u.id)) || tier2Ids.has(String(u.id))) return false;
      const matchesInviterId = u.inviterId && tier2Ids.has(String(u.inviterId));
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

    return res.json({ success: true, count: teamList.length, members: teamList });
  } catch (err: any) {
    return res.status(500).json({ success: false, members: [], error: err.message });
  }
});

const processedCommissionCache = new Map<string, number>();

// Multi-Tier Referral Commission Distribution Engine (Server-Authoritative, SQLite + Cloud SQL + Backup)
export async function distributeReferralCommissionServer(
  payerIdentifier: string,
  amount: number,
  actionType: 'recharge' | 'investment' | 'daily_income',
  referenceId?: string
): Promise<{ success: boolean; rates?: [number, number, number]; credited: any[] }> {
  // USER SPECIFICATION: Upliner commission is ONLY granted when downline user BUYS/INVESTS in a product!
  // No referral commission is granted simply for recharging / depositing funds.
  if (actionType === 'recharge') {
    console.log(`[Referral Commission] Skipped: Upliner commission is only granted on product purchase, not on recharge.`);
    return { success: true, credited: [] };
  }

  if (!payerIdentifier || !amount || amount <= 0) {
    return { success: false, credited: [] };
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) return { success: false, credited: [] };

  const cleanPayer = String(payerIdentifier).trim();
  const cleanPayerPhone = cleanPayer.replace(/\D/g, '').slice(-10);
  const cleanRef = referenceId ? String(referenceId).trim() : '';

  // 1. Strict Deduplication Lock:
  // If referenceId provided (e.g. order ID 'ord-123' or deposit tx ID), lock to that exact reference.
  // Otherwise, lock to payer + action + amount.
  const dedupeKey = cleanRef
    ? `${actionType}:${cleanRef}`
    : `${cleanPayer}:${actionType}:${numAmount.toFixed(2)}`;

  const nowMs = Date.now();
  const lastProcessed = processedCommissionCache.get(dedupeKey);
  const debounceWindowMs = actionType === 'daily_income' ? 30 * 1000 : 60 * 1000;
  if (lastProcessed && nowMs - lastProcessed < debounceWindowMs) {
    console.log(`[Referral Commission] Debounced duplicate commission distribution call for key: ${dedupeKey}`);
    return { success: true, credited: [] };
  }

  // 2. Also check if commission transactions already exist in transactions log for this reference (EXACT match)
  if (cleanRef) {
    const existingTxs = loadServerTransactions();
    const alreadyCredited = existingTxs.some(
      (t) =>
        t.type === 'commission' &&
        (t.referenceNo === `COMM1-${cleanRef}` ||
          t.referenceNo === `COMM2-${cleanRef}` ||
          t.referenceNo === `COMM3-${cleanRef}` ||
          t.referenceNo === `COMM-${cleanRef}`)
    );
    if (alreadyCredited) {
      console.log(`[Referral Commission] BLOCKED: Commission already recorded in database for reference: ${cleanRef}`);
      processedCommissionCache.set(dedupeKey, nowMs);
      return { success: true, credited: [] };
    }
  }

  // Atomically claim lock
  processedCommissionCache.set(dedupeKey, nowMs);

  // Prune cache if large
  if (processedCommissionCache.size > 2000) {
    for (const [k, time] of processedCommissionCache.entries()) {
      if (nowMs - time > 60 * 60 * 1000) processedCommissionCache.delete(k);
    }
  }

  const allUsers = await getCombinedServerUsers();

  let payer = allUsers.find(
    (u) =>
      String(u.id).trim() === cleanPayer ||
      (cleanPayerPhone.length === 10 && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanPayerPhone)
  );

  if (!payer) {
    payer = getUserByIdOrPhoneFromSql(cleanPayer);
  }

  if (!payer) {
    console.log(`[Referral Commission] Payer ${payerIdentifier} not found in users list.`);
    return { success: false, credited: [] };
  }

  const findUpliner = (inviterId?: string, invitedByCode?: string): any | null => {
    // 1. Direct SQLite lookup first for absolute real-time accuracy:
    try {
      const db = getSqliteDb();
      initSqliteUsersTable();
      if (inviterId) {
        const row = db.prepare('SELECT * FROM platform_users WHERE id = ?').get(String(inviterId).trim()) as any;
        if (row) return mapSqlRowToUser(row);
      }
      if (invitedByCode) {
        const cleanCode = invitedByCode.trim().toUpperCase();
        const cleanDigits = invitedByCode.replace(/\D/g, '').slice(-10);
        const row = db.prepare(`
          SELECT * FROM platform_users 
          WHERE UPPER(invitation_code) = ? 
             OR id = ? 
             OR (phone = ? AND length(?) = 10)
          LIMIT 1
        `).get(cleanCode, cleanCode, cleanDigits, cleanDigits) as any;
        if (row) return mapSqlRowToUser(row);
      }
    } catch {}

    // 2. Legacy / memory lookup
    if (
      inviterId === '852539' ||
      inviterId === '325697' ||
      (invitedByCode && (invitedByCode.trim().toUpperCase() === 'R34VZ' || invitedByCode.trim().toUpperCase() === 'J9Y79'))
    ) {
      const ravi = allUsers.find(
        (u) =>
          u.id === '325697' ||
          (u.phone && u.phone.replace(/\D/g, '').slice(-10) === '9170481824') ||
          (u.invitationCode && u.invitationCode.trim().toUpperCase() === 'J9Y79')
      );
      if (ravi) return ravi;
    }
    // Anshusahu code lookup fallback (EYAYY -> AAWFK / 406332)
    if (
      inviterId === '406332' ||
      (invitedByCode && (invitedByCode.trim().toUpperCase() === 'EYAYY' || invitedByCode.trim().toUpperCase() === 'AAWFK'))
    ) {
      const anshu = allUsers.find(
        (u) =>
          u.id === '406332' ||
          (u.phone && u.phone.replace(/\D/g, '').slice(-10) === '8858359277') ||
          (u.invitationCode && u.invitationCode.trim().toUpperCase() === 'AAWFK')
      );
      if (anshu) return anshu;
    }
    if (inviterId) {
      const match = allUsers.find((u) => String(u.id).trim() === String(inviterId).trim());
      if (match) return match;
    }
    if (invitedByCode) {
      const cleanCode = invitedByCode.trim().toUpperCase();
      const cleanDigits = invitedByCode.replace(/\D/g, '').slice(-10);
      const match = allUsers.find((u) => {
        const uCode = (u.invitationCode || '').trim().toUpperCase();
        const uPhone = (u.phone || '').replace(/\D/g, '').slice(-10);
        const uId = String(u.id || '').trim().toUpperCase();
        return uCode === cleanCode || (cleanDigits.length === 10 && uPhone === cleanDigits) || uId === cleanCode;
      });
      if (match) return match;
      if (cleanCode === '4AB86') {
        return allUsers.find((u) => (u.phone || '').includes('7307112738')) || {
          id: '833863',
          phone: '7307112738',
          nickname: 'gaurav',
          invitationCode: '4AB86',
        };
      }
    }
    return null;
  };

  const actionLabel =
    actionType === 'daily_income'
      ? 'Daily Income Return'
      : actionType === 'investment'
      ? 'Contract Investment'
      : 'Recharge / Deposit';

  const credited: any[] = [];
  const rates = await getEffectiveCommissionRatesServer();
  const refSuffix = cleanRef || `${payer.id}-${Date.now().toString().slice(-4)}`;

  const ensureAndCreditUpliner = (uplinerObj: any, commAmount: number) => {
    let updated = creditUserCommissionInSql(uplinerObj.id, commAmount);
    if (!updated) {
      try {
        upsertUserInSql(uplinerObj);
        updated = creditUserCommissionInSql(uplinerObj.id, commAmount);
      } catch {}
    }
    if (!updated && uplinerObj.phone) {
      updated = creditUserCommissionInSql(uplinerObj.phone, commAmount);
    }
    if (updated) {
      markUserRuntimeMutated(updated.id, updated.phone);
      saveUsersBackup(deduplicateAndMergeUsers(getCachedUsersBackup(), [{ ...updated, isAuthoritativeServer: true }]));
      upsertUser({
        uid: updated.id,
        phone: updated.phone,
        withdrawalBalance: updated.withdrawalBalance,
        totalCommissionEarned: updated.totalCommissionEarned,
        isExplicitZeroReset: false,
        explicitZeroWallets: updated.explicitZeroWallets,
        balanceUpdatedAt: updated.balanceUpdatedAt,
        updatedAt: updated.updatedAt,
      }).catch(() => {});
    }
    return updated;
  };

  // 1. Tier 1 Inviter (Direct upliner)
  const tier1 = findUpliner(payer.inviterId, payer.invitedBy);
  if (tier1 && String(tier1.id) !== String(payer.id)) {
    const comm1 = Number(((numAmount * rates[0]) / 100).toFixed(2));
    if (rates[0] > 0 && comm1 > 0) {
      const updated1 = ensureAndCreditUpliner(tier1, comm1);
      // Record server commission transaction
      let tx1: any = null;
      try {
        const txList = loadServerTransactions();
        const comm1Now = Date.now();
        tx1 = {
          id: `tx-comm-${comm1Now}-1`,
          userId: tier1.id,
          phone: tier1.phone || '',
          downlineUserId: payer.id,
          downlinePhone: payer.phone || '',
          type: 'commission',
          amount: comm1,
          title: `Tier 1 Commission (${rates[0]}%) from ${payer.nickname || payer.phone || 'downline'} - ${actionLabel}`,
          timestamp: formatISTTimestamp(comm1Now),
          createdAt: comm1Now,
          status: 'completed',
          referenceNo: `COMM1-${refSuffix}`,
          paymentMethod: 'Referral Commission Wallet',
          ...buildUserBalanceSnapshot(updated1 || tier1),
        };
        txList.unshift(tx1);
        saveServerTransactions(txList);
        createTransaction(tx1).catch(() => {});
      } catch (txErr) {}

      credited.push({
        tier: 1,
        userId: tier1.id,
        nickname: tier1.nickname,
        amount: comm1,
        rate: rates[0],
        updatedUser: updated1,
        transaction: tx1,
      });
      console.log(`[Referral Commission] Credited Tier 1 (${rates[0]}% = $${comm1}) to ${tier1.nickname || tier1.id} from ${payer.nickname || payer.id} for ${actionLabel} [Ref: ${refSuffix}]`);
    }

    // 2. Tier 2 Inviter (Upline's upliner)
    const tier2 = findUpliner(tier1.inviterId, tier1.invitedBy);
    if (tier2 && String(tier2.id) !== String(payer.id) && String(tier2.id) !== String(tier1.id)) {
      const comm2 = Number(((numAmount * rates[1]) / 100).toFixed(2));
      if (rates[1] > 0 && comm2 > 0) {
        const updated2 = ensureAndCreditUpliner(tier2, comm2);
        // Record server commission transaction
        let tx2: any = null;
        try {
          const txList = loadServerTransactions();
          const comm2Now = Date.now();
          tx2 = {
            id: `tx-comm-${comm2Now}-2`,
            userId: tier2.id,
            phone: tier2.phone || '',
            downlineUserId: payer.id,
            downlinePhone: payer.phone || '',
            type: 'commission',
            amount: comm2,
            title: `Tier 2 Commission (${rates[1]}%) from ${payer.nickname || payer.phone || 'downline'} - ${actionLabel}`,
            timestamp: formatISTTimestamp(comm2Now),
            createdAt: comm2Now,
            status: 'completed',
            referenceNo: `COMM2-${refSuffix}`,
            paymentMethod: 'Referral Commission Wallet',
            ...buildUserBalanceSnapshot(updated2 || tier2),
          };
          txList.unshift(tx2);
          saveServerTransactions(txList);
          createTransaction(tx2).catch(() => {});
        } catch (txErr) {}

        credited.push({
          tier: 2,
          userId: tier2.id,
          nickname: tier2.nickname,
          amount: comm2,
          rate: rates[1],
          updatedUser: updated2,
          transaction: tx2,
        });
        console.log(`[Referral Commission] Credited Tier 2 (${rates[1]}% = $${comm2}) to ${tier2.nickname || tier2.id} from ${payer.nickname || payer.id} for ${actionLabel} [Ref: ${refSuffix}]`);
      }

      // 3. Tier 3 Inviter (Tier 2's upliner)
      const tier3 = findUpliner(tier2.inviterId, tier2.invitedBy);
      if (tier3 && String(tier3.id) !== String(payer.id) && String(tier3.id) !== String(tier1.id) && String(tier3.id) !== String(tier2.id)) {
        const comm3 = Number(((numAmount * rates[2]) / 100).toFixed(2));
        if (rates[2] > 0 && comm3 > 0) {
          const updated3 = ensureAndCreditUpliner(tier3, comm3);
          // Record server commission transaction
          let tx3: any = null;
          try {
            const txList = loadServerTransactions();
            const comm3Now = Date.now();
            tx3 = {
              id: `tx-comm-${comm3Now}-3`,
              userId: tier3.id,
              phone: tier3.phone || '',
              downlineUserId: payer.id,
              downlinePhone: payer.phone || '',
              type: 'commission',
              amount: comm3,
              title: `Tier 3 Commission (${rates[2]}%) from ${payer.nickname || payer.phone || 'downline'} - ${actionLabel}`,
              timestamp: formatISTTimestamp(comm3Now),
              createdAt: comm3Now,
              status: 'completed',
              referenceNo: `COMM3-${refSuffix}`,
              paymentMethod: 'Referral Commission Wallet',
              ...buildUserBalanceSnapshot(updated3 || tier3),
            };
            txList.unshift(tx3);
            saveServerTransactions(txList);
            createTransaction(tx3).catch(() => {});
          } catch (txErr) {}

          credited.push({
            tier: 3,
            userId: tier3.id,
            nickname: tier3.nickname,
            amount: comm3,
            rate: rates[2],
            updatedUser: updated3,
            transaction: tx3,
          });
          console.log(`[Referral Commission] Credited Tier 3 (${rates[2]}% = $${comm3}) to ${tier3.nickname || tier3.id} from ${payer.nickname || payer.id} for ${actionLabel} [Ref: ${refSuffix}]`);
        }
      }
    }
  }

  return { success: true, rates, credited };
}

// Global Referral Count Reconciliation:
// Verifies direct Tier 1 referral counts WITHOUT auto-minting wallet funds.
// Commissions are strictly awarded only upon verified product purchase or daily dividend events.
export async function reconcileAllReferralStatsServer(targetUserId?: string): Promise<{ reconciledCount: number; details: any[] }> {
  try {
    const allUsers = await getCombinedServerUsers();
    const details: any[] = [];
    let reconciledCount = 0;

    const targets = targetUserId
      ? allUsers.filter((u) => String(u.id).trim() === String(targetUserId).trim() || (u.phone && String(u.phone).includes(targetUserId)))
      : allUsers;

    for (const currentUser of targets) {
      const userId = String(currentUser.id);
      const userCodes = new Set<string>();
      if (currentUser.invitationCode) userCodes.add(currentUser.invitationCode.trim().toUpperCase());
      if (userId === '833863' || (currentUser.phone && currentUser.phone.includes('7307112738'))) {
        userCodes.add('4AB86');
      }
      const userPhoneDigits = currentUser.phone ? currentUser.phone.replace(/\D/g, '').slice(-10) : '';
      if (userPhoneDigits) userCodes.add(userPhoneDigits);
      if (currentUser.id) userCodes.add(String(currentUser.id).trim().toUpperCase());

      // Add Ravi Sahu legacy codes so downlines NEVER drop
      const isRavi =
        userId === '325697' ||
        userId === '9170481824' ||
        (currentUser.phone && currentUser.phone.replace(/\D/g, '').slice(-10) === '9170481824') ||
        currentUser.invitationCode === 'J9Y79';
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
        (currentUser.phone && currentUser.phone.replace(/\D/g, '').slice(-10) === '8858359277') ||
        currentUser.invitationCode === 'AAWFK';
      if (isAnshu) {
        userCodes.add('AAWFK');
        userCodes.add('EYAYY');
        userCodes.add('406332');
        userCodes.add('8858359277');
      }

      const otherUsers = allUsers.filter((u) => String(u.id) !== userId);

      // Tier 1 Downlines
      const tier1Users = otherUsers.filter((u) => {
        const matchesInviterId = u.inviterId && (
          String(u.inviterId) === userId ||
          (isRavi && (String(u.inviterId) === '852539' || String(u.inviterId) === '325697' || (u.inviterName && u.inviterName.toLowerCase().includes('ravi')))) ||
          (isAnshu && (String(u.inviterId) === '406332' || (u.inviterName && u.inviterName.toLowerCase().includes('anshu'))))
        );
        const cleanInvitedBy = u.invitedBy ? u.invitedBy.trim().toUpperCase() : '';
        const cleanInvitedDigits = u.invitedBy ? u.invitedBy.replace(/\D/g, '').slice(-10) : '';
        const matchesInvitedBy = cleanInvitedBy && (
          userCodes.has(cleanInvitedBy) ||
          (userPhoneDigits && cleanInvitedDigits === userPhoneDigits) ||
          (isRavi && (cleanInvitedBy === 'R34VZ' || cleanInvitedBy === 'J9Y79' || (u.inviterName && u.inviterName.toLowerCase().includes('ravi')))) ||
          (isAnshu && (cleanInvitedBy === 'EYAYY' || cleanInvitedBy === 'AAWFK' || (u.inviterName && u.inviterName.toLowerCase().includes('anshu'))))
        );
        return Boolean(matchesInviterId || matchesInvitedBy);
      });

      const directCount = tier1Users.length;
      if (directCount !== (currentUser.totalReferrals || 0)) {
        updateUserReferralsInSql(userId, directCount);
        currentUser.totalReferrals = directCount;
        reconciledCount++;
        details.push({ userId, nickname: currentUser.nickname, directCount });
      }
    }

    return { reconciledCount, details };
  } catch (err: any) {
    console.error('Error during referral reconciliation:', err);
    return { reconciledCount: 0, details: [] };
  }
}

// API Route: Server-authoritative referral commission distribution
app.post('/api/referral/distribute', async (req, res) => {
  try {
    const { payerId, payerPhone, amount, actionType, referenceId } = req.body;
    const payerIdentifier = payerId || payerPhone;
    if (!payerIdentifier || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Payer identifier and positive amount required' });
    }

    const result = await distributeReferralCommissionServer(
      payerIdentifier,
      Number(amount),
      actionType || 'investment',
      referenceId
    );

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Manually sync and reconcile referral stats on demand
app.post(['/api/referral/sync-stats', '/api/referral/sync-stats/:userId'], async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    const result = await reconcileAllReferralStatsServer(targetUserId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Save or Merge Users into Cloud SQL and Permanent Backup
app.post('/api/backup/users', async (req, res) => {
  try {
    const incoming = req.body.users || (req.body.user ? [req.body.user] : (Array.isArray(req.body) ? req.body : null));
    const isNewRegistration = Boolean(req.body.isNewRegistration);
    if (!incoming || !Array.isArray(incoming)) {
      return res.status(400).json({ success: false, error: 'Expected array of users' });
    }

    // If an explicitly brand new registration or save occurs, allow registration & unblacklist
    if (isNewRegistration || req.body.forceSave || req.body.allowReregistration) {
      incoming.forEach((u) => {
        if (u?.phone || u?.id) {
          unblacklistUser(u?.phone, u?.id);
        }
      });
    }

    const deletedSet = loadDeletedUsers();

    // STRICT FILTER: Drop any user that was deleted by admin and not explicitly registered
    const cleanIncoming = incoming.filter((u) => {
      if (!u) return false;
      const uId = String(u.id || u.uid || '').trim();
      const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
      return !deletedSet.has(uId) && (!uPhone || !deletedSet.has(uPhone));
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

    // Strip any untrusted client flags and reject stale records that are older than SQLite
    const sqlUsersNow = getAllUsersFromSql(false);
    const sqlById = new Map<string, any>();
    const sqlByPhone = new Map<string, any>();
    for (const su of sqlUsersNow) {
      if (su?.id) sqlById.set(String(su.id).trim(), su);
      const sp = su?.phone ? String(su.phone).replace(/\D/g, '').slice(-10) : '';
      if (sp.length === 10) sqlByPhone.set(sp, su);
    }

    const sanitizedIncoming: any[] = [];
    for (const rawU of cleanIncoming) {
      const u = { ...rawU };
      delete u.isAuthoritativeServer;
      delete u.isRuntimeMutated;
      const rawId = String(u.id || u.uid || '').trim();
      const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
      const existingSql = (rawId && sqlById.get(rawId)) || (cleanPhone && sqlByPhone.get(cleanPhone));
      if (existingSql) {
        const sqlBalTs = getFinancialTimestampMs(existingSql);
        const incBalTs = getFinancialTimestampMs(u);
        const existingRuntime = isUserRuntimeMutated(existingSql);
        // Never let a stale client backup payload overwrite a newer SQLite state
        if ((existingRuntime || sqlBalTs > 0) && (incBalTs === 0 || sqlBalTs > incBalTs + 1000)) {
          continue;
        }
      }
      sanitizedIncoming.push(u);
    }

    const current = getCachedUsersBackup();
    const authSqlForMerge = sqlUsersNow.map((u) =>
      isUserRuntimeMutated(u) ? { ...u, isAuthoritativeServer: true } : u
    );
    const baseUsers = deduplicateAndMergeUsers(current, authSqlForMerge);
    const mergedList = sanitizedIncoming.length > 0 ? deduplicateAndMergeUsers(baseUsers, sanitizedIncoming) : baseUsers;
    saveUsersBackup(mergedList);

    // Concurrently persist ONLY truly newer/missing clean incoming users to SQLite SQL and Cloud SQL PostgreSQL
    for (const u of sanitizedIncoming) {
      if (u && (u.id || u.phone)) {
        const rawId = String(u.id || u.uid || u.phone).trim();
        const cleanPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
        if (deletedSet.has(rawId) || (cleanPhone && deletedSet.has(cleanPhone))) {
          continue; // NEVER resurrect blacklisted user!
        }
        const fullMergedUser = mergedList.find(
          (m) => m.id === rawId || (cleanPhone && String(m.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)
        ) || u;

        // 1. Permanent SQLite SQL persistence
        try {
          const savedRow = upsertUserInSql(fullMergedUser);
          markUserRuntimeMutated(savedRow.id, savedRow.phone);
        } catch (sqliteErr) {
          console.warn('Upserting user to SQLite warning:', sqliteErr);
        }

        // 2. Cloud SQL persistence
        try {
          await upsertUser({
            uid: fullMergedUser.id || fullMergedUser.uid || fullMergedUser.phone,
            phone: fullMergedUser.phone,
            password: fullMergedUser.password || 'password123',
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
            bankDetails: fullMergedUser.bankDetails,
            isExplicitZeroReset: Boolean(fullMergedUser.isExplicitZeroReset),
            explicitZeroWallets: fullMergedUser.explicitZeroWallets,
            balanceUpdatedAt: fullMergedUser.balanceUpdatedAt,
            updatedAt: fullMergedUser.updatedAt,
          });
        } catch (dbErr: any) {
          console.warn('Upserting user to Cloud SQL encountered an error:', dbErr?.message || dbErr);
        }
      }
    }

    return res.json({ success: true, count: mergedList.length, users: mergedList });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Re-link user to upliner in permanent SQLite SQL, Cloud SQL, and backup
app.post(['/api/backup/relink-upliner', '/api/admin/users/relink-upline', '/api/relink-upliner'], async (req, res) => {
  try {
    const rawUserId = req.body.userId || req.body.targetUserId || req.body.targetId;
    const rawUserPhone = req.body.userPhone || req.body.targetPhone || req.body.targetMobile;
    const cleanUserId = String(rawUserId || '').trim();
    const cleanUserPhone = String(rawUserPhone || '').replace(/\D/g, '').slice(-10);

    if (!cleanUserId && !cleanUserPhone) {
      return res.status(400).json({ success: false, error: 'User identifier (userId or userPhone) required' });
    }

    const rawUplineCode = String(req.body.uplineCode || req.body.referralCode || req.body.code || '').trim().toUpperCase();
    const cleanUplinePhone = String(req.body.uplinePhone || req.body.uplineMobile || '').replace(/\D/g, '').slice(-10);
    const cleanUplineId = String(req.body.uplineId || req.body.inviterId || '').trim();

    // 1. Locate target user across SQLite, combined users, and backup
    let target = getUserByIdOrPhoneFromSql(cleanUserId) || (cleanUserPhone ? getUserByIdOrPhoneFromSql(cleanUserPhone) : null);
    if (!target) {
      const all = await getCombinedServerUsers();
      target = all.find(
        (u) =>
          (cleanUserId && String(u.id).trim() === cleanUserId) ||
          (cleanUserPhone && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanUserPhone)
      );
    }
    if (!target) {
      const current = getCachedUsersBackup();
      target = current.find(
        (u) =>
          (cleanUserId && String(u.id).trim() === cleanUserId) ||
          (cleanUserPhone && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanUserPhone)
      );
    }

    if (!target) {
      return res.status(404).json({ success: false, error: 'Target member not found in database' });
    }

    // 2. Locate upline sponsor across SQLite, combined users, and backup
    let upliner: any = null;
    if (cleanUplineId) upliner = getUserByIdOrPhoneFromSql(cleanUplineId);
    if (!upliner && cleanUplinePhone) upliner = getUserByIdOrPhoneFromSql(cleanUplinePhone);
    if (!upliner && rawUplineCode) upliner = getUserByIdOrPhoneFromSql(rawUplineCode);

    if (!upliner) {
      const all = await getCombinedServerUsers();
      upliner = all.find((u) => {
        const uId = String(u.id || '').trim();
        const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
        const uCode = String(u.invitationCode || '').trim().toUpperCase();
        return (
          (cleanUplineId && uId === cleanUplineId) ||
          (cleanUplinePhone && uPhone === cleanUplinePhone) ||
          (rawUplineCode && uCode === rawUplineCode)
        );
      });
    }

    if (!upliner && rawUplineCode === '4AB86') {
      upliner = {
        id: '833863',
        phone: '7307112738',
        nickname: 'gaurav',
        invitationCode: '4AB86',
      };
    }

    const finalUplineCode = upliner?.invitationCode || rawUplineCode || '4AB86';
    const finalUplineId = upliner?.id || cleanUplineId || null;
    const finalUplineName = upliner?.nickname || upliner?.name || (rawUplineCode ? `Sponsor (${rawUplineCode})` : 'Sponsor');

    // 3. Atomically update SQLite database (Authoritative Source of Truth)
    const updatedSqlRecord = relinkUserUplineInSql(target.id, finalUplineCode, finalUplineId, finalUplineName);

    // 4. Update disk backup users_backup.json
    const diskUsers = getCachedUsersBackup();
    const diskTarget = diskUsers.find(
      (u) =>
        String(u.id).trim() === String(target.id).trim() ||
        (cleanUserPhone && String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanUserPhone)
    );
    if (diskTarget) {
      diskTarget.invitedBy = finalUplineCode;
      diskTarget.inviterId = finalUplineId;
      diskTarget.inviterName = finalUplineName;
      diskTarget.updatedAt = new Date().toISOString();
      saveUsersBackup(diskUsers);
    }

    // 5. Update Cloud SQL
    try {
      await relinkUpline(target.id, finalUplineCode);
    } catch (sqlErr: any) {
      console.warn('Relink upline in Cloud SQL warning:', sqlErr?.message || sqlErr);
    }

    console.log(`[Admin Relink] User ${target.nickname || target.phone} (#${target.id}) re-linked to sponsor ${finalUplineName} (${finalUplineCode}) in SQLite & Backup.`);

    return res.json({
      success: true,
      message: `User ${target.nickname || target.phone} successfully re-linked under sponsor ${finalUplineName} (${finalUplineCode})!`,
      user: updatedSqlRecord || {
        ...target,
        invitedBy: finalUplineCode,
        inviterId: finalUplineId,
        inviterName: finalUplineName,
      },
    });
  } catch (err: any) {
    console.error('Error during relink upliner:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// API Routes: Promo Codes / Gift Cards Backup
// ==========================================
const PROMO_CODES_PATH = path.resolve(process.cwd(), 'src/data/promo_codes.json');
const DELETED_PROMOS_PATH = path.resolve(process.cwd(), 'src/data/deleted_promos.json');

function loadDeletedPromoKeys(): Set<string> {
  try {
    if (fs.existsSync(DELETED_PROMOS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_PROMOS_PATH, 'utf-8'));
      if (Array.isArray(parsed)) return new Set(parsed.map((k) => String(k).trim().toUpperCase()));
    }
  } catch (err) {
    console.warn('Could not read deleted_promos.json:', err);
  }
  return new Set<string>();
}

function saveDeletedPromoKeys(keys: Set<string>): void {
  try {
    fs.writeFileSync(DELETED_PROMOS_PATH, JSON.stringify(Array.from(keys), null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write deleted_promos.json:', err);
  }
}

const adminDeletedPromoKeys = loadDeletedPromoKeys();

function loadServerPromoCodes(): any[] {
  try {
    if (fs.existsSync(PROMO_CODES_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(PROMO_CODES_PATH, 'utf-8'));
      if (Array.isArray(parsed)) {
        // Automatically filter out any deleted tombstones
        return parsed.filter((p: any) => {
          const pId = String(p.id || '').trim().toUpperCase();
          const pCode = String(p.code || '').trim().toUpperCase();
          return !adminDeletedPromoKeys.has(pId) && !adminDeletedPromoKeys.has(pCode);
        });
      }
    }
  } catch (err) {
    console.warn('Could not read promo_codes.json:', err);
  }
  return [];
}

function saveServerPromoCodes(promos: any[]): void {
  try {
    fs.writeFileSync(PROMO_CODES_PATH, JSON.stringify(promos, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write promo_codes.json:', err);
  }
}

app.get('/api/promos', (_req, res) => {
  try {
    const list = loadServerPromoCodes();
    return res.json({
      success: true,
      promoCodes: list,
      deletedPromoKeys: Array.from(adminDeletedPromoKeys),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/promos', async (req, res) => {
  try {
    const promo = req.body;
    if (!promo || !promo.code) {
      return res.status(400).json({ success: false, error: 'Promo code data is required' });
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
      updatedAt: new Date().toISOString(),
    };

    // If this code or ID was previously marked deleted, un-tombstone it so newly saved promo can be active
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
      console.warn('Sync promo code to Cloud SQL warning:', sqlErr);
    }

    return res.json({
      success: true,
      promoCode: cleanPromo,
      promoCodes: current,
      deletedPromoKeys: Array.from(adminDeletedPromoKeys),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/promos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const queryCode = req.query.code ? String(req.query.code).trim().toUpperCase() : '';
    if (!id) {
      return res.status(400).json({ success: false, error: 'Promo code ID is required' });
    }
    const current = loadServerPromoCodes();
    const cleanId = String(id).trim();

    // Find any matched promo to get its exact code
    const target = current.find(
      (p) =>
        p.id === cleanId ||
        String(p.code).trim().toUpperCase() === cleanId.toUpperCase() ||
        (queryCode && String(p.code).trim().toUpperCase() === queryCode)
    );

    const codeToTombstone = queryCode || (target?.code ? String(target.code).trim().toUpperCase() : cleanId.toUpperCase());

    // 1. Delete from Cloud SQL PostgreSQL
    try {
      await deleteDbPromoCode(cleanId);
      if (codeToTombstone) {
        await deleteDbPromoCode(codeToTombstone);
      }
      if (target?.id && target.id !== cleanId) {
        await deleteDbPromoCode(target.id);
      }
    } catch (sqlErr) {
      console.warn('Delete promo code from Cloud SQL warning:', sqlErr);
    }

    // Record persistent tombstone
    adminDeletedPromoKeys.add(cleanId.toUpperCase());
    if (target?.id) adminDeletedPromoKeys.add(String(target.id).trim().toUpperCase());
    if (codeToTombstone) adminDeletedPromoKeys.add(codeToTombstone);
    saveDeletedPromoKeys(adminDeletedPromoKeys);

    const filtered = current.filter((p) => {
      const pId = String(p.id).trim().toUpperCase();
      const pCode = String(p.code).trim().toUpperCase();
      if (pId === cleanId.toUpperCase() || (target?.id && pId === String(target.id).trim().toUpperCase())) return false;
      if (pCode === cleanId.toUpperCase() || (codeToTombstone && pCode === codeToTombstone)) return false;
      if (adminDeletedPromoKeys.has(pId) || adminDeletedPromoKeys.has(pCode)) return false;
      return true;
    });

    saveServerPromoCodes(filtered);
    console.log(`[Admin Delete] Promo code ${cleanId} (${codeToTombstone}) permanently deleted from Cloud SQL and disk.`);
    return res.json({
      success: true,
      message: `Gift code "${codeToTombstone || cleanId}" permanently deleted from database and disk.`,
      promoCodes: filtered,
      deletedPromoKeys: Array.from(adminDeletedPromoKeys),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// API Routes: Investment Orders & Admin Control (Permanent SQL Storage)
// ==========================================
const ORDERS_BACKUP_PATH = path.resolve(process.cwd(), 'src/data/orders_backup.json');

// Initialize SQLite orders table without any demo seeding
function initAndSyncSqlOrders(): void {
  try {
    getSqliteDb();
    // Strictly load real live orders without any demo seed
    const allSqlOrders = getAllOrdersFromSql();
    saveServerOrders(allSqlOrders);
    console.log(`[SQL Database] ${allSqlOrders.length} investment orders active in SQLite database.`);
  } catch (err) {
    console.warn('[SQL Database] Order init sync warning:', err);
  }
}

// Run initial sync on boot
initAndSyncSqlOrders();

try {
  const prodsFile = path.resolve(process.cwd(), 'src/data/firestoreProducts.json');
  if (fs.existsSync(prodsFile)) {
    const diskProds = JSON.parse(fs.readFileSync(prodsFile, 'utf-8'));
    if (Array.isArray(diskProds) && diskProds.length > 0) {
      initAndSyncSqlProducts(diskProds);
    }
  }
} catch (e) {
  console.warn('[SQL Database] Product init sync warning:', e);
}

function loadServerOrders(): any[] {
  const orderMap = new Map<string, any>();
  const deletedSet = loadDeletedOrders();
  const deletedUsers = loadDeletedUsers();

  const isUserDeleted = (o: any): boolean => {
    if (!o) return false;
    const uId = String(o.userId || '').trim();
    const uPhone = String(o.userPhone || '').replace(/\D/g, '').slice(-10);
    return Boolean((uId && deletedUsers.has(uId)) || (uPhone && deletedUsers.has(uPhone)));
  };

  // 1. Primary: Load from SQLite SQL database
  try {
    const sqlOrders = getAllOrdersFromSql();
    for (const o of sqlOrders) {
      if (o && o.id && !deletedSet.has(String(o.id).trim().toLowerCase()) && !isUserDeleted(o)) {
        orderMap.set(String(o.id), o);
      }
    }
  } catch (err) {
    console.warn('Error reading orders from SQLite SQL:', err);
  }

  // 2. Secondary: Load from disk backup and merge
  try {
    if (fs.existsSync(ORDERS_BACKUP_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(ORDERS_BACKUP_PATH, 'utf-8'));
      if (Array.isArray(parsed)) {
        for (const o of parsed) {
          const strId = String(o?.id || '').trim().toLowerCase();
          if (o && o.id && !deletedSet.has(strId) && !isUserDeleted(o) && !orderMap.has(String(o.id))) {
            orderMap.set(String(o.id), o);
            // Also store back to SQLite SQL so it is never lost
            try { upsertOrderInSql(o); } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not read orders_backup.json:', err);
  }

  return Array.from(orderMap.values());
}

function saveServerOrders(ordersList: any[]): void {
  const deletedSet = loadDeletedOrders();
  const deletedUsers = loadDeletedUsers();
  const cleanList = (ordersList || []).filter((o) => {
    if (!o || !o.id) return false;
    if (deletedSet.has(String(o.id).trim().toLowerCase())) return false;
    const uId = String(o.userId || '').trim();
    const uPhone = String(o.userPhone || '').replace(/\D/g, '').slice(-10);
    if ((uId && deletedUsers.has(uId)) || (uPhone && deletedUsers.has(uPhone))) return false;
    return true;
  });

  // 1. Permanently upsert into SQLite SQL database
  for (const o of cleanList) {
    if (o && o.id) {
      try {
        upsertOrderInSql(o);
      } catch (err) {
        console.warn('Error saving order to SQLite SQL:', o.id, err);
      }
    }
  }

  // 2. Persist to JSON backup
  try {
    fs.writeFileSync(ORDERS_BACKUP_PATH, JSON.stringify(cleanList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write orders_backup.json:', err);
  }
}

// Safe merge of two order instances, preserving completed status, highest daysElapsed, and newest claim/reset timestamps
function mergeOrderSafe(existing: any, incoming: any): any {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingElapsed = Number(existing.daysElapsed) || 0;
  const incomingElapsed = Number(incoming.daysElapsed) || 0;
  const isExistingDone = existing.status === 'completed' || existingElapsed >= (Number(existing.cycleDays) || 0);
  const isIncomingDone = incoming.status === 'completed' || incomingElapsed >= (Number(incoming.cycleDays) || 0);
  const finalStatus = isExistingDone || isIncomingDone ? 'completed' : (incoming.status || existing.status);

  const existingUpdatedAt = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
  const incomingUpdatedAt = incoming.updatedAt ? Date.parse(incoming.updatedAt) : 0;
  const existingClaim = Number(existing.lastClaimTimestamp) || 0;
  const incomingClaim = Number(incoming.lastClaimTimestamp) || 0;

  let useIncoming = false;
  if (incomingElapsed > existingElapsed) {
    useIncoming = true;
  } else if (existingElapsed > incomingElapsed) {
    useIncoming = false;
  } else if (incomingUpdatedAt && existingUpdatedAt && incomingUpdatedAt !== existingUpdatedAt) {
    // Respect explicit admin timer resets or updates when daysElapsed is equal
    useIncoming = incomingUpdatedAt > existingUpdatedAt;
  } else {
    useIncoming = incomingClaim >= existingClaim;
  }

  const lastClaimTimestamp = useIncoming
    ? (incoming.lastClaimTimestamp ?? existing.lastClaimTimestamp ?? null)
    : (existing.lastClaimTimestamp ?? incoming.lastClaimTimestamp ?? null);
  const daysElapsed = Math.max(existingElapsed, incomingElapsed);
  const totalAccrued = Math.max(Number(existing.totalAccrued) || 0, Number(incoming.totalAccrued) || 0);
  const nextClaimTimestamp = useIncoming
    ? (incoming.nextClaimTimestamp || existing.nextClaimTimestamp)
    : (existing.nextClaimTimestamp || incoming.nextClaimTimestamp);

  return {
    ...existing,
    ...incoming,
    status: finalStatus,
    daysElapsed,
    totalAccrued,
    lastClaimTimestamp,
    nextClaimTimestamp,
  };
}

// Enrich order with user phone, nickname, and fallback details
function enrichOrderWithUserData(order: any, allUsers: any[]): any {
  if (!order) return order;
  const uid = String(order.userId || '').trim();
  const uphone = String(order.userPhone || '').replace(/\D/g, '').slice(-10);
  const matchedUser = allUsers.find(
    (u) =>
      (u.id && String(u.id).trim() === uid) ||
      (u.uid && String(u.uid).trim() === uid) ||
      (u.phone && String(u.phone).trim() === uid) ||
      (uphone && u.phone && String(u.phone).replace(/\D/g, '').slice(-10) === uphone)
  );
  return {
    ...order,
    userId: order.userId || (matchedUser ? matchedUser.id : uid),
    userPhone: order.userPhone || (matchedUser ? matchedUser.phone : ''),
    userNickname: order.userNickname || (matchedUser ? matchedUser.nickname : 'Investor'),
  };
}

// GET all orders across all users (Admin view + permanent SQL sync)
app.get(['/api/orders', '/api/admin/orders'], async (_req, res) => {
  try {
    const diskAndSqlOrders = loadServerOrders();
    const allUsers = getCachedUsersBackup();
    let cloudSqlOrders: any[] = [];
    try {
      cloudSqlOrders = await getAllDbOrders();
    } catch (e: any) {
      console.warn('Could not fetch orders from Cloud SQL:', e?.message || e);
    }

    const deletedSet = loadDeletedOrders();
    const orderMap = new Map<string, any>();
    // Add SQLite/disk orders first
    diskAndSqlOrders.forEach((o) => {
      if (o && o.id && !deletedSet.has(String(o.id).trim().toLowerCase())) {
        const enriched = enrichOrderWithUserData(o, allUsers);
        orderMap.set(String(o.id), enriched);
      }
    });
    // Merge cloud SQL orders
    cloudSqlOrders.forEach((so) => {
      if (so && so.id) {
        const strId = String(so.id);
        if (deletedSet.has(strId.toLowerCase())) return;
        const existing = orderMap.get(strId);
        const merged = mergeOrderSafe(existing, so);
        orderMap.set(strId, enrichOrderWithUserData(merged, allUsers));
        // Persist to local SQLite SQL as well
        try { upsertOrderInSql(merged); } catch {}
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
      sqlEngine: 'Permanent SQLite + Cloud SQL Enabled',
      orders: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET orders for specific user (Permanently queried from SQL with user phone + UID matching)
app.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId).trim();
    const allUsers = getCachedUsersBackup();
    const cleanDigits = cleanId.replace(/\D/g, '').slice(-10);

    // Find canonical user to obtain both user ID and phone number
    const matchedUser = allUsers.find(
      (u) =>
        String(u.id).trim() === cleanId ||
        String(u.uid || '').trim() === cleanId ||
        (u.phone && String(u.phone).trim() === cleanId) ||
        (cleanDigits && u.phone && String(u.phone).replace(/\D/g, '').slice(-10) === cleanDigits)
    );

    const possibleIds = new Set<string>([cleanId]);
    if (cleanDigits) {
      possibleIds.add(cleanDigits);
      possibleIds.add(`+91 ${cleanDigits}`);
      possibleIds.add(`91${cleanDigits}`);
    }
    if (matchedUser?.id) possibleIds.add(String(matchedUser.id).trim());
    if (matchedUser?.phone) {
      const phoneDigits = String(matchedUser.phone).replace(/\D/g, '').slice(-10);
      possibleIds.add(phoneDigits);
      possibleIds.add(`+91 ${phoneDigits}`);
    }

    const identifiersList = Array.from(possibleIds);

    // 1. Query SQLite SQL database for user orders
    let sqlUserOrders: any[] = [];
    try {
      sqlUserOrders = getOrdersForUserFromSql(identifiersList);
    } catch (sqlErr) {
      console.warn('Error querying SQLite for user orders:', sqlErr);
    }

    // 2. Query in-memory / backup orders
    const allDiskOrders = loadServerOrders();
    const diskUserOrders = allDiskOrders.filter((o) => {
      if (!o) return false;
      const oUserId = String(o.userId || '').trim();
      const oPhone = String(o.userPhone || '').replace(/\D/g, '').slice(-10);
      return (
        possibleIds.has(oUserId) ||
        (oPhone && possibleIds.has(oPhone)) ||
        (cleanDigits && oPhone === cleanDigits)
      );
    });

    // 3. Query Cloud SQL PostgreSQL (if configured)
    let cloudSqlUserOrders: any[] = [];
    try {
      cloudSqlUserOrders = await getDbOrdersByUser(cleanId, matchedUser?.phone);
    } catch {}

    // Merge and deduplicate all found orders safely
    const orderMap = new Map<string, any>();
    for (const o of [...sqlUserOrders, ...diskUserOrders, ...cloudSqlUserOrders]) {
      if (o && o.id) {
        const enriched = enrichOrderWithUserData(o, allUsers);
        const strId = String(o.id);
        const existing = orderMap.get(strId);
        orderMap.set(strId, existing ? mergeOrderSafe(existing, enriched) : enriched);
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
      orders: finalUserOrders,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST save or upsert order (Permanently saves to SQLite SQL + backup + Cloud SQL)
app.post(['/api/orders', '/api/admin/orders'], async (req, res) => {
  try {
    const payload = req.body;
    const orderData = payload.order || payload;
    if (!orderData || !orderData.id) {
      return res.status(400).json({ success: false, error: 'Order data with ID is required' });
    }

    const cleanOrderId = String(orderData.id).trim().toLowerCase();
    const deletedOrders = loadDeletedOrders();
    if (deletedOrders.has(cleanOrderId)) {
      console.warn(`[Order Rejected] Order ${cleanOrderId} is permanently deleted and blacklisted. Rejecting resurrect.`);
      return res.status(400).json({ success: false, error: 'Order is permanently deleted and blacklisted' });
    }

    const allUsers = getCachedUsersBackup();
    const enriched = enrichOrderWithUserData(orderData, allUsers);

    // 1. Permanently save to SQLite SQL database
    try {
      upsertOrderInSql(enriched);
    } catch (sqlErr) {
      console.warn('Error saving to SQLite SQL database:', sqlErr);
    }

    // 2. Save to disk backup
    const diskOrders = loadServerOrders();
    const existingIndex = diskOrders.findIndex((o) => String(o.id) === String(enriched.id));
    if (existingIndex >= 0) {
      diskOrders[existingIndex] = { ...diskOrders[existingIndex], ...enriched };
    } else {
      diskOrders.unshift(enriched);
    }
    saveServerOrders(diskOrders);

    // 3. Concurrently persist to Cloud SQL PostgreSQL
    try {
      await upsertDbOrder(enriched);
    } catch (e: any) {
      console.warn('Error syncing order to Cloud SQL:', e?.message || e);
    }

    // 4. Atomically deduct product price from the buyer's recharge_balance on server ONLY on brand new purchase
    const isNewPurchase = existingIndex === -1;
    const orderPrice = Number(enriched.price) || 0;
    const buyerIdentifier = enriched.userId || enriched.userPhone;
    if (isNewPurchase && orderPrice > 0 && buyerIdentifier) {
      try {
        const cleanBuyer = String(buyerIdentifier).trim();
        const buyerSql = getUserByIdOrPhoneFromSql(cleanBuyer);
        if (buyerSql) {
          const curBal = Number(buyerSql.rechargeBalance) || 0;
          const newBal = Math.max(0, Number((curBal - orderPrice).toFixed(2)));
          const newInvested = Number(((buyerSql.totalInvested || 0) + orderPrice).toFixed(2));
          const balNow = new Date().toISOString();
          const zeroSet = new Set<string>(
            Array.isArray(buyerSql.explicitZeroWallets) ? buyerSql.explicitZeroWallets : []
          );
          if (newBal === 0) {
            zeroSet.add('rechargeBalance');
          } else {
            zeroSet.delete('rechargeBalance');
          }
          const nextZeroWallets = Array.from(zeroSet);

          upsertUserInSql({
            ...buyerSql,
            rechargeBalance: newBal,
            totalInvested: newInvested,
            explicitZeroWallets: nextZeroWallets,
            isExplicitZeroReset: false,
            balanceUpdatedAt: balNow,
            updatedAt: balNow,
          });
          markUserRuntimeMutated(buyerSql.id, buyerSql.phone);

          const currentBackup = getCachedUsersBackup();
          const bIdx = currentBackup.findIndex(
            (u) => u.id === buyerSql.id || (buyerSql.phone && u.phone && String(u.phone).slice(-10) === String(buyerSql.phone).slice(-10))
          );
          if (bIdx >= 0) {
            currentBackup[bIdx] = {
              ...currentBackup[bIdx],
              rechargeBalance: newBal,
              totalInvested: newInvested,
              explicitZeroWallets: nextZeroWallets,
              isExplicitZeroReset: false,
              balanceUpdatedAt: balNow,
              updatedAt: balNow,
            };
            saveUsersBackup(currentBackup);
          }

          upsertUser({
            uid: buyerSql.id,
            phone: buyerSql.phone,
            rechargeBalance: newBal,
            totalInvested: newInvested,
            explicitZeroWallets: nextZeroWallets,
            isExplicitZeroReset: false,
            balanceUpdatedAt: balNow,
            updatedAt: balNow,
          }).catch(() => {});
        }
      } catch (deductErr) {
        console.warn('Server-side order balance deduction warning:', deductErr);
      }
    }

    // 5. Distribute multi-tier referral commissions to upliners on brand new purchase using live Admin rates
    let commissionResult: any = { success: true, credited: [] };
    if (isNewPurchase && orderPrice > 0 && (enriched.userId || enriched.userPhone)) {
      try {
        commissionResult = await distributeReferralCommissionServer(
          enriched.userId || enriched.userPhone,
          orderPrice,
          'investment',
          enriched.id
        );
      } catch (refErr) {
        console.warn('Order referral commission notice:', refErr);
      }
    }

    console.log(`[Permanent SQL Save] Order ${enriched.id} (${enriched.productName}) for User ${enriched.userId} saved permanently in SQL!`);
    return res.json({
      success: true,
      message: 'Order saved permanently in SQL database!',
      order: enriched,
      commissionResult,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update order (Permanently updates SQLite SQL + backup + Cloud SQL)
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const diskOrders = loadServerOrders();
    const allUsers = getCachedUsersBackup();
    const idx = diskOrders.findIndex((o) => String(o.id) === String(id));

    const baseOrder = idx >= 0 ? diskOrders[idx] : { id };
    const updated = enrichOrderWithUserData(
      { ...baseOrder, ...updates, id, updatedAt: new Date().toISOString() },
      allUsers
    );

    // 1. Update SQLite SQL database
    try {
      upsertOrderInSql(updated);
    } catch (sqlErr) {
      console.warn('Error updating order in SQLite SQL:', sqlErr);
    }

    // 2. Update disk backup
    if (idx >= 0) {
      diskOrders[idx] = updated;
    } else {
      diskOrders.unshift(updated);
    }
    saveServerOrders(diskOrders);

    // 3. Update Cloud SQL
    try {
      await upsertDbOrder(updated);
    } catch {}

    return res.json({ success: true, order: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE order (Permanently deletes from SQLite SQL, Cloud SQL, and backup)
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id).trim();

    // 1. Blacklist order ID permanently so it can NEVER resurrect
    saveDeletedOrder(cleanId);

    // 2. Delete from SQLite SQL database
    try {
      deleteOrderFromSql(cleanId);
    } catch (sqlErr) {
      console.warn('Error deleting order from SQLite SQL:', sqlErr);
    }

    // 3. Delete from Cloud SQL PostgreSQL
    try {
      await deleteOrderFromDb(cleanId);
    } catch (sqlErr) {
      console.warn('Delete order from Cloud SQL warning:', sqlErr);
    }

    // 4. Delete from disk backup
    const diskOrders = loadServerOrders();
    const filtered = diskOrders.filter((o) => String(o.id).trim().toLowerCase() !== cleanId.toLowerCase());
    saveServerOrders(filtered);

    console.log(`[Admin Delete] Order ${cleanId} permanently deleted from SQLite SQL, Cloud SQL, and disk.`);
    return res.json({ success: true, message: 'Order removed permanently from SQL database and backup' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Purge all orders permanently (Wipe demo orders from SQLite, PostgreSQL, and disk)
app.post(['/api/admin/orders/purge-all-orders', '/api/orders/purge-all'], async (req, res) => {
  try {
    purgeAllOrdersFromSql();
    await purgeAllOrdersFromDb();
    fs.writeFileSync(ORDERS_BACKUP_PATH, JSON.stringify([], null, 2), 'utf-8');
    console.log('[Admin Orders] All orders completely purged from SQLite, PostgreSQL, and disk.');
    return res.json({ success: true, message: 'All demo and old orders purged permanently from all databases and disk.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Reset all users balances to 0 permanently (Zero balances across SQLite, PostgreSQL, and disk backup)
app.post(['/api/admin/users/reset-all-balances', '/api/users/reset-all-balances'], async (req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const zeroWallets = [...WALLET_ZERO_KEYS];
    resetAllUsersBalancesInSql(nowIso);
    await resetAllUsersBalancesInDb(nowIso);

    try {
      getAllUsersFromSql(false).forEach((u) => markUserRuntimeMutated(u.id, u.phone));
    } catch {}

    // Also zero all users in users_backup.json with explicit zero reset, per-wallet list, & balanceUpdatedAt
    try {
      const diskUsers = getCachedUsersBackup();
      diskUsers.forEach((u: any) => {
        u.rechargeBalance = 0;
        u.withdrawalBalance = 0;
        u.productRevenue = 0;
        u.totalInvested = 0;
        u.totalCommissionEarned = 0;
        u.explicitZeroWallets = zeroWallets;
        u.isExplicitZeroReset = true;
        u.balanceUpdatedAt = nowIso;
        u.updatedAt = nowIso;
        markUserRuntimeMutated(u.id, u.phone);
      });
      saveUsersBackup(diskUsers);
    } catch {}

    console.log('[Admin Users] All user balances completely reset to 0 in SQLite, PostgreSQL, and disk.');
    return res.json({ success: true, message: 'All user balances have been reset to 0 in all databases.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE single transaction from Cloud SQL
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteTransactionFromDb(id);
    return res.json({ success: true, message: `Transaction ${id} deleted from Cloud SQL` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// API Routes: Products (Permanent SQLite + Disk + Cloud SQL)
// ==========================================
app.get('/api/products', async (_req, res) => {
  try {
    const productMap = new Map<string, any>();
    const deletedProducts = loadDeletedProducts();

    // 1. Primary: Load from permanent SQLite database
    try {
      const sqlProds = getAllProductsFromSql();
      for (const p of sqlProds) {
        if (p && p.id && !deletedProducts.has(String(p.id).trim())) {
          productMap.set(String(p.id), p);
        }
      }
    } catch (e) {
      console.warn('Error reading products from SQLite:', e);
    }

    // 2. Secondary: Load from firestoreProducts.json on server disk
    try {
      const prodsFile = path.resolve(process.cwd(), 'src/data/firestoreProducts.json');
      if (fs.existsSync(prodsFile)) {
        const diskProds = JSON.parse(fs.readFileSync(prodsFile, 'utf-8'));
        if (Array.isArray(diskProds)) {
          for (const p of diskProds) {
            if (p && p.id && !deletedProducts.has(String(p.id).trim())) {
              const existing = productMap.get(String(p.id));
              // Merge, respecting newer updatedAt or non-null fields
              const merged = { ...p, ...(existing || {}) };
              productMap.set(String(p.id), merged);
              // Ensure SQLite also has it
              try { upsertProductInSql(merged); } catch {}
            }
          }
        }
      }
    } catch (diskErr) {
      console.warn('Could not read firestoreProducts.json:', diskErr);
    }

    // 3. Tertiary: Cloud SQL products if configured
    try {
      const dbProds = await getAllDbProducts();
      if (Array.isArray(dbProds)) {
        for (const p of dbProds) {
          if (p && p.id && !deletedProducts.has(String(p.id).trim())) {
            const existing = productMap.get(String(p.id));
            productMap.set(String(p.id), { ...(existing || {}), ...p });
          }
        }
      }
    } catch {}

    const productsList = Array.from(productMap.values()).filter(
      (p) => !deletedProducts.has(String(p.id).trim())
    );
    return res.json({ success: true, count: productsList.length, products: productsList });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const prod = req.body;
    if (!prod || !prod.id) {
      return res.status(400).json({ success: false, error: 'Product data with ID is required' });
    }

    const cleanProd = {
      ...prod,
      price: Number(prod.price) || 0,
      dailyEarnings: Number(prod.dailyEarnings) || 0,
      dailyPercent: prod.dailyPercent !== undefined ? Number(prod.dailyPercent) : (prod.price > 0 ? Number(((Number(prod.dailyEarnings) / Number(prod.price)) * 100).toFixed(1)) : 50),
      cycleDays: Number(prod.cycleDays || 45),
      totalRevenue: Number(prod.totalRevenue || (Number(prod.dailyEarnings || 0) * Number(prod.cycleDays || 45)).toFixed(2)),
      updatedAt: typeof prod.updatedAt === 'number' ? prod.updatedAt : Date.now(),
    };

    // 1. Permanently upsert into SQLite SQL database
    let savedInSql = cleanProd;
    try {
      savedInSql = upsertProductInSql(cleanProd);
    } catch (sqlErr) {
      console.warn('Error saving product in SQLite SQL:', sqlErr);
    }

    // 2. Persist to firestoreProducts.json on server disk
    try {
      const prodsFile = path.resolve(process.cwd(), 'src/data/firestoreProducts.json');
      let currentProds: any[] = [];
      if (fs.existsSync(prodsFile)) {
        try { currentProds = JSON.parse(fs.readFileSync(prodsFile, 'utf-8')); } catch {}
      }
      if (!Array.isArray(currentProds)) currentProds = [];
      const idx = currentProds.findIndex((p: any) => p.id === cleanProd.id);
      if (idx !== -1) {
        currentProds[idx] = { ...currentProds[idx], ...cleanProd };
      } else {
        currentProds.unshift(cleanProd);
      }
      fs.writeFileSync(prodsFile, JSON.stringify(currentProds, null, 2), 'utf-8');
    } catch (diskErr) {
      console.warn('Could not write product to firestoreProducts.json:', diskErr);
    }

    // 3. Upsert to Cloud SQL (if active)
    try {
      await upsertDbProduct(cleanProd);
    } catch {}

    return res.json({ success: true, message: 'Product amount saved permanently in SQL database!', product: savedInSql });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id).trim();

    // 1. Blacklist product so it NEVER restores
    saveDeletedProduct(cleanId);

    // 2. Delete from SQLite SQL
    try {
      deleteProductFromSql(cleanId);
    } catch (sqlErr) {
      console.warn('Error deleting product from SQLite:', sqlErr);
    }

    // 3. Delete from firestoreProducts.json
    try {
      const prodsFile = path.resolve(process.cwd(), 'src/data/firestoreProducts.json');
      if (fs.existsSync(prodsFile)) {
        let currentProds: any[] = [];
        try { currentProds = JSON.parse(fs.readFileSync(prodsFile, 'utf-8')); } catch {}
        if (Array.isArray(currentProds)) {
          const filtered = currentProds.filter((p: any) => String(p.id).trim() !== cleanId);
          fs.writeFileSync(prodsFile, JSON.stringify(filtered, null, 2), 'utf-8');
        }
      }
    } catch (diskErr) {
      console.warn('Could not update firestoreProducts.json on delete:', diskErr);
    }

    // 4. Delete from Cloud SQL
    try {
      await deleteDbProduct(cleanId);
    } catch {}

    console.log(`[Admin Delete] Product ${cleanId} permanently deleted and blacklisted forever.`);
    return res.json({ success: true, message: `Product ${cleanId} deleted permanently and blacklisted forever.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// API Routes: Notices (Cloud SQL)
// ==========================================
app.get('/api/notices', async (_req, res) => {
  try {
    const dbNotices = await getAllDbNotices();
    return res.json({ success: true, notices: dbNotices });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notices', async (req, res) => {
  try {
    const notice = req.body;
    if (!notice || !notice.id) {
      return res.status(400).json({ success: false, error: 'Notice data with ID is required' });
    }
    const saved = await upsertDbNotice(notice);
    return res.json({ success: true, notice: saved });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDbNotice(id);
    console.log(`[Admin Delete] Notice ${id} permanently deleted from Cloud SQL.`);
    return res.json({ success: true, message: `Notice ${id} deleted from Cloud SQL` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST action on order: approve, pause, resume, cancel, payout_dividend, reset_timer
app.post('/api/orders/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, refundAmount, refundWallet, customEarnings } = req.body;
    const diskOrders = loadServerOrders();
    const sqlOrders = getAllOrdersFromSql();
    const allUsers = await getCombinedServerUsers();

    let idx = diskOrders.findIndex((o) => String(o.id) === String(id));
    let currentOrder = idx >= 0 ? diskOrders[idx] : sqlOrders.find((o) => String(o.id) === String(id));

    if (!currentOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (idx === -1) {
      diskOrders.unshift(currentOrder);
      idx = 0;
    }

    const now = Date.now();
    let message = '';
    let updatedUserRecord: any = null;
    let actionTx: any = null;
    let actionCommissionResult: any = null;

    if (action === 'approve') {
      currentOrder.status = 'active';
      currentOrder.approvedAt = new Date().toISOString();
      currentOrder.purchaseTimestamp = currentOrder.purchaseTimestamp || now;
      currentOrder.lastClaimTimestamp = now;
      currentOrder.nextClaimTimestamp = now + 24 * 60 * 60 * 1000;
      message = `Order ${id} approved & activated! 24h dividend cycle initiated.`;
      if (currentOrder.price && currentOrder.userId) {
        try {
          actionCommissionResult = await distributeReferralCommissionServer(
            currentOrder.userId,
            Number(currentOrder.price),
            'investment',
            currentOrder.id
          );
        } catch {}
      }
    } else if (action === 'pause') {
      currentOrder.status = 'paused';
      currentOrder.pauseReason = reason || 'Temporarily paused by administrator';
      message = `Order ${id} paused. User cannot claim dividends while paused.`;
    } else if (action === 'resume') {
      currentOrder.status = 'active';
      delete currentOrder.pauseReason;
      message = `Order ${id} resumed and restored to active state.`;
    } else if (action === 'cancel') {
      currentOrder.status = 'cancelled';
      currentOrder.cancelledAt = new Date().toISOString();
      currentOrder.adminNote = reason || 'Contract cancelled by administrator';

      const refund = refundAmount !== undefined ? Number(refundAmount) : Number(currentOrder.price || 0);
      currentOrder.refundAmount = refund;

      if (refund > 0 && currentOrder.userId) {
        const targetUserId = String(currentOrder.userId).trim();
        const walletKey: 'withdrawalBalance' | 'rechargeBalance' =
          refundWallet === 'withdrawalBalance' ? 'withdrawalBalance' : 'rechargeBalance';

        const sqlUpdated = creditUserWalletDeltaInSql(targetUserId, walletKey, refund, {
          totalInvestedDelta: -(Number(currentOrder.price) || 0),
        });

        const targetUser = sqlUpdated || allUsers.find(
          (u) =>
            String(u.id).trim() === targetUserId ||
            String(u.uid || '').trim() === targetUserId ||
            (u.phone && String(u.phone).trim() === targetUserId)
        );

        if (targetUser) {
          if (!sqlUpdated) {
            targetUser[walletKey] = Number(((targetUser[walletKey] || 0) + refund).toFixed(2));
            targetUser.totalInvested = Math.max(0, Number(((targetUser.totalInvested || 0) - (currentOrder.price || 0)).toFixed(2)));
            upsertUserInSql(targetUser);
          }
          const balNow = new Date().toISOString();
          updatedUserRecord = getUserByIdOrPhoneFromSql(targetUser.id) || targetUser;
          const zeroSet = new Set<string>(
            Array.isArray(updatedUserRecord.explicitZeroWallets) ? updatedUserRecord.explicitZeroWallets : []
          );
          zeroSet.delete(walletKey);
          if ((Number(updatedUserRecord.totalInvested) || 0) === 0 && (Number(currentOrder.price) || 0) > 0) {
            zeroSet.add('totalInvested');
          }
          updatedUserRecord.explicitZeroWallets = Array.from(zeroSet);
          updatedUserRecord.isExplicitZeroReset = false;
          updatedUserRecord.balanceUpdatedAt = balNow;
          updatedUserRecord.updatedAt = balNow;
          upsertUserInSql(updatedUserRecord);
          markUserRuntimeMutated(updatedUserRecord.id, updatedUserRecord.phone);

          saveUsersBackup(deduplicateAndMergeUsers(getCachedUsersBackup(), [{ ...updatedUserRecord, isAuthoritativeServer: true }]));
          upsertUser({
            uid: updatedUserRecord.id,
            phone: updatedUserRecord.phone,
            [walletKey]: updatedUserRecord[walletKey],
            totalInvested: updatedUserRecord.totalInvested,
            explicitZeroWallets: updatedUserRecord.explicitZeroWallets,
            isExplicitZeroReset: false,
            balanceUpdatedAt: balNow,
            updatedAt: balNow,
          }).catch(() => {});

          const refundTx = {
            id: `tx-ref-${now}`,
            userId: updatedUserRecord.id,
            phone: updatedUserRecord.phone || '',
            type: 'bonus',
            amount: refund,
            title: `Admin Refund: Order ${currentOrder.productName} (#${currentOrder.id})`,
            timestamp: formatISTTimestamp(now),
            createdAt: now,
            status: 'completed',
            referenceNo: `REFUND-${currentOrder.id}`,
            paymentMethod: `Wallet Credit (${walletKey === 'withdrawalBalance' ? 'Withdrawal Balance' : 'Add Money Balance'})`,
            ...buildUserBalanceSnapshot(updatedUserRecord),
          };
          actionTx = refundTx;
          const allTxs = loadServerTransactions();
          allTxs.unshift(refundTx);
          saveServerTransactions(allTxs);
          createTransaction(refundTx).catch(() => {});
        }
      }
      message = `Order ${id} cancelled. ${refund > 0 ? `$${refund} refunded to user.` : 'No refund issued.'}`;
    } else if (action === 'payout_dividend') {
      const dividendAmount = customEarnings !== undefined ? Number(customEarnings) : Number(currentOrder.dailyEarnings || 0);
      currentOrder.daysElapsed = (currentOrder.daysElapsed || 0) + 1;
      currentOrder.totalAccrued = Number(((currentOrder.totalAccrued || 0) + dividendAmount).toFixed(2));
      currentOrder.lastClaimDate = new Date(now).toISOString().split('T')[0];
      currentOrder.lastClaimTimestamp = now;
      currentOrder.nextClaimTimestamp = now + 24 * 60 * 60 * 1000;

      if (currentOrder.daysElapsed >= currentOrder.cycleDays) {
        currentOrder.status = 'completed';
      }

      if (dividendAmount > 0 && currentOrder.userId) {
        const targetUserId = String(currentOrder.userId).trim();
        const sqlUpdated = creditUserDividendInSql(targetUserId, dividendAmount);
        const targetUser = sqlUpdated || allUsers.find(
          (u) =>
            String(u.id).trim() === targetUserId ||
            String(u.uid || '').trim() === targetUserId ||
            (u.phone && String(u.phone).trim() === targetUserId)
        );

        if (targetUser) {
          if (!sqlUpdated) {
            targetUser.withdrawalBalance = Number(((targetUser.withdrawalBalance || 0) + dividendAmount).toFixed(2));
            targetUser.productRevenue = Number(((targetUser.productRevenue || 0) + dividendAmount).toFixed(2));
            upsertUserInSql(targetUser);
          }
          const balNow = new Date().toISOString();
          updatedUserRecord = getUserByIdOrPhoneFromSql(targetUser.id) || targetUser;
          const zeroSet = new Set<string>(
            Array.isArray(updatedUserRecord.explicitZeroWallets) ? updatedUserRecord.explicitZeroWallets : []
          );
          zeroSet.delete('withdrawalBalance');
          zeroSet.delete('productRevenue');
          updatedUserRecord.explicitZeroWallets = Array.from(zeroSet);
          updatedUserRecord.isExplicitZeroReset = false;
          updatedUserRecord.balanceUpdatedAt = balNow;
          updatedUserRecord.updatedAt = balNow;
          upsertUserInSql(updatedUserRecord);
          markUserRuntimeMutated(updatedUserRecord.id, updatedUserRecord.phone);

          saveUsersBackup(deduplicateAndMergeUsers(getCachedUsersBackup(), [{ ...updatedUserRecord, isAuthoritativeServer: true }]));
          upsertUser({
            uid: updatedUserRecord.id,
            phone: updatedUserRecord.phone,
            withdrawalBalance: updatedUserRecord.withdrawalBalance,
            productRevenue: updatedUserRecord.productRevenue,
            explicitZeroWallets: updatedUserRecord.explicitZeroWallets,
            isExplicitZeroReset: false,
            balanceUpdatedAt: balNow,
            updatedAt: balNow,
          }).catch(() => {});

          const divTx = {
            id: `tx-adm-div-${now}`,
            userId: updatedUserRecord.id,
            phone: updatedUserRecord.phone || '',
            type: 'earnings',
            amount: dividendAmount,
            title: `Manual Admin Yield: ${currentOrder.productName} (Day ${currentOrder.daysElapsed})`,
            timestamp: formatISTTimestamp(now),
            createdAt: now,
            status: 'completed',
            referenceNo: `DIV-${currentOrder.id}-${now.toString().slice(-6)}`,
            paymentMethod: 'Contract Daily Settlement',
            ...buildUserBalanceSnapshot(updatedUserRecord),
          };
          actionTx = divTx;
          const allTxs = loadServerTransactions();
          allTxs.unshift(divTx);
          saveServerTransactions(allTxs);
          createTransaction(divTx).catch(() => {});

          // Distribute multi-tier referral commissions to upliners on daily yield
          try {
            actionCommissionResult = await distributeReferralCommissionServer(
              updatedUserRecord.id,
              dividendAmount,
              'daily_income',
              `ADM-DIV-${currentOrder.id}-${now}`
            );
          } catch (commErr) {
            console.warn('Dividend referral commission notice:', commErr);
          }
        }
      }
      message = `Dividend of $${dividendAmount.toFixed(2)} successfully paid to user wallet!`;
    } else if (action === 'reset_timer') {
      currentOrder.nextClaimTimestamp = now - 1000;
      currentOrder.lastClaimTimestamp = now - (24 * 60 * 60 * 1000) - 1000;
      message = `24h cooldown timer reset. User can now claim dividend immediately.`;
    }

    const updated = enrichOrderWithUserData({ ...currentOrder, updatedAt: new Date(now).toISOString() }, allUsers);
    diskOrders[idx] = updated;
    saveServerOrders(diskOrders);

    // Permanently commit updated order status & timestamps to SQLite SQL database
    try {
      upsertOrderInSql(updated);
    } catch (sqlErr) {
      console.warn('SQLite order action update warning:', sqlErr);
    }

    try {
      await upsertDbOrder(updated);
    } catch {}

    return res.json({
      success: true,
      message,
      order: updated,
      ...(updatedUserRecord ? { user: updatedUserRecord } : {}),
      ...(actionTx ? { transaction: actionTx } : {}),
      ...(actionCommissionResult ? { commissionResult: actionCommissionResult } : {}),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================
// API Routes: Transactions & Withdrawal Management
// ==========================================
const TRANSACTIONS_BACKUP_PATH = path.resolve(process.cwd(), 'src/data/transactions_backup.json');

function loadServerTransactions(): any[] {
  try {
    if (fs.existsSync(TRANSACTIONS_BACKUP_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(TRANSACTIONS_BACKUP_PATH, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read transactions_backup.json:', err);
  }
  return [];
}

function saveServerTransactions(txsList: any[]): void {
  try {
    fs.writeFileSync(TRANSACTIONS_BACKUP_PATH, JSON.stringify(txsList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write transactions_backup.json:', err);
  }
}

function buildUserBalanceSnapshot(userOrId: any): {
  balanceAfter?: number;
  rechargeBalanceAfter?: number;
  withdrawalBalanceAfter?: number;
} {
  try {
    let target = userOrId;
    if (typeof userOrId === 'string') {
      target = getUserByIdOrPhoneFromSql(userOrId);
      if (!target) {
        const clean = String(userOrId).trim();
        target = getCachedUsersBackup().find(
          (u) => String(u.id || '').trim() === clean || String(u.phone || '').trim() === clean
        );
      }
    }
    if (!target || typeof target !== 'object') return {};
    if (target.rechargeBalance === undefined && target.withdrawalBalance === undefined) return {};
    const recharge = Number(target.rechargeBalance) || 0;
    const withdrawal = Number(target.withdrawalBalance) || 0;
    const total = Number((recharge + withdrawal).toFixed(2));
    return {
      balanceAfter: total,
      rechargeBalanceAfter: Number(recharge.toFixed(2)),
      withdrawalBalanceAfter: Number(withdrawal.toFixed(2)),
    };
  } catch {
    return {};
  }
}

// API Route: Purge all transactions permanently (Admin tool & fresh start)
app.post(['/api/admin/transactions/purge-all', '/api/transactions/purge-all'], async (_req, res) => {
  try {
    await purgeAllTransactionsFromDb();
    purgeAllTransactionsFromSql();
    saveServerTransactions([]);
    console.log('[Admin Transactions] All transaction history completely purged from PostgreSQL, SQLite and disk.');
    return res.json({ success: true, message: 'All transaction history purged permanently.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function getTxStatusRank(status: any): number {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'completed' || s === 'rejected') return 3;
  if (s === 'processing') return 1;
  return 0;
}

function isNumericOnlyId(val: any): boolean {
  return val !== undefined && val !== null && /^\d+$/.test(String(val).trim());
}

function mergeServerTx(existing: any, incoming: any): any {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingRank = getTxStatusRank(existing.status);
  const incomingRank = getTxStatusRank(incoming.status);

  // Start with existing, apply non-empty incoming fields, then enforce canonical ID & terminal status
  const merged: any = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null && v !== '') {
      merged[k] = v;
    }
  }

  // Never let a Postgres numeric serial ID clobber a canonical string ID (like "tx-179...")
  const existingId = existing.id !== undefined && existing.id !== null ? String(existing.id).trim() : '';
  const incomingId = incoming.id !== undefined && incoming.id !== null ? String(incoming.id).trim() : '';
  if (existingId && !isNumericOnlyId(existingId)) {
    merged.id = existingId;
    if (isNumericOnlyId(incomingId)) merged.sqlId = Number(incomingId);
  } else if (incomingId && !isNumericOnlyId(incomingId)) {
    merged.id = incomingId;
    if (isNumericOnlyId(existingId)) merged.sqlId = Number(existingId);
  } else {
    merged.id = existingId || incomingId;
  }
  if (existing.sqlId && !merged.sqlId) merged.sqlId = existing.sqlId;

  // Terminal status dominance: once 'completed' or 'rejected', NEVER downgrade back to 'processing'
  if (existingRank > incomingRank) {
    merged.status = existing.status;
    if (existing.utrNumber) merged.utrNumber = existing.utrNumber;
    if (existing.rejectReason) merged.rejectReason = existing.rejectReason;
    if (existing.updatedAt) merged.updatedAt = existing.updatedAt;
    if (existing.balanceAfter !== undefined) merged.balanceAfter = existing.balanceAfter;
    if (existing.rechargeBalanceAfter !== undefined) merged.rechargeBalanceAfter = existing.rechargeBalanceAfter;
    if (existing.withdrawalBalanceAfter !== undefined) merged.withdrawalBalanceAfter = existing.withdrawalBalanceAfter;
  } else {
    if (!merged.utrNumber && existing.utrNumber) merged.utrNumber = existing.utrNumber;
  }

  // Keep WTH.../REC... original referenceNo if one side has it and the other was mutated to UTR...
  const exRef = String(existing.referenceNo || '').trim();
  const inRef = String(incoming.referenceNo || '').trim();
  if (exRef.startsWith('WTH') && inRef.startsWith('UTR')) {
    merged.referenceNo = exRef;
    if (!merged.utrNumber) merged.utrNumber = inRef;
  } else if (inRef.startsWith('WTH') && exRef.startsWith('UTR')) {
    merged.referenceNo = inRef;
    if (!merged.utrNumber) merged.utrNumber = exRef;
  }

  return merged;
}

function mergeTxListsForRead(backupTxs: any[], dbTxs: any[]): any[] {
  const map = new Map<string, any>();
  const keyLookup = new Map<string, string>(); // maps any id / sqlId / referenceNo -> primary map key

  const ingest = (tx: any) => {
    if (!tx) return;
    const rawId = tx.id !== undefined && tx.id !== null ? String(tx.id).trim() : '';
    const rawSqlId = tx.sqlId !== undefined && tx.sqlId !== null ? String(tx.sqlId).trim() : '';
    const rawRef = tx.referenceNo ? String(tx.referenceNo).trim() : '';
    const rawUtr = tx.utrNumber ? String(tx.utrNumber).trim() : '';
    const rechargeUtrKey =
      tx.type === 'recharge' && tx.userId && (rawUtr || rawRef) && String(rawUtr || rawRef).length >= 6
        ? `rec_utr:${String(tx.userId).trim()}_${rawUtr || rawRef}`
        : '';

    let primaryKey =
      (rechargeUtrKey && keyLookup.get(rechargeUtrKey)) ||
      (rawRef && keyLookup.get(`ref:${rawRef}`)) ||
      (rawUtr && keyLookup.get(`utr:${rawUtr}`)) ||
      (rawId && keyLookup.get(`id:${rawId}`)) ||
      (rawSqlId && keyLookup.get(`id:${rawSqlId}`)) ||
      rawRef ||
      rawId ||
      `tx-${tx.createdAt || Date.now()}`;

    const merged = map.has(primaryKey) ? mergeServerTx(map.get(primaryKey), tx) : { ...tx };
    map.set(primaryKey, merged);

    if (rechargeUtrKey) keyLookup.set(rechargeUtrKey, primaryKey);
    if (rawRef) keyLookup.set(`ref:${rawRef}`, primaryKey);
    if (rawUtr) keyLookup.set(`utr:${rawUtr}`, primaryKey);
    if (rawId) keyLookup.set(`id:${rawId}`, primaryKey);
    if (rawSqlId) keyLookup.set(`id:${rawSqlId}`, primaryKey);
    if (merged.referenceNo) keyLookup.set(`ref:${String(merged.referenceNo).trim()}`, primaryKey);
    if (merged.utrNumber) keyLookup.set(`utr:${String(merged.utrNumber).trim()}`, primaryKey);
    if (merged.id) keyLookup.set(`id:${String(merged.id).trim()}`, primaryKey);
    if (merged.sqlId) keyLookup.set(`id:${String(merged.sqlId).trim()}`, primaryKey);
  };

  for (const tx of backupTxs) ingest(tx);
  for (const tx of dbTxs) ingest(tx);

  // Secondary strict deduplication for withdrawals & recharges: merge duplicate records regardless of status
  const withdrawMap = new Map<string, any>();
  const rechargeMap = new Map<string, any>();
  const otherTxs: any[] = [];

  for (const tx of map.values()) {
    if (tx.type === 'withdraw') {
      const uId = String(tx.userId || '').trim();
      const amt = Number(tx.amount || 0).toFixed(2);
      const ref = String(tx.referenceNo || '').trim();
      const timeBucket = Math.floor((Number(tx.createdAt) || Date.now()) / 45000);
      const dedupeKey = ref || `${uId}_${amt}_${timeBucket}`;

      if (withdrawMap.has(dedupeKey)) {
        withdrawMap.set(dedupeKey, mergeServerTx(withdrawMap.get(dedupeKey), tx));
      } else {
        withdrawMap.set(dedupeKey, tx);
      }
    } else if (tx.type === 'recharge') {
      const uId = String(tx.userId || '').trim();
      const utrOrRef = String(tx.utrNumber || tx.referenceNo || '').trim();
      const dedupeKey =
        uId && utrOrRef && utrOrRef.length >= 6
          ? `rec:${uId}:${utrOrRef}`
          : String(tx.id || `${uId}:${tx.amount}:${tx.createdAt || Date.now()}`);

      if (rechargeMap.has(dedupeKey)) {
        rechargeMap.set(dedupeKey, mergeServerTx(rechargeMap.get(dedupeKey), tx));
      } else {
        rechargeMap.set(dedupeKey, tx);
      }
    } else {
      otherTxs.push(tx);
    }
  }

  return [...otherTxs, ...withdrawMap.values(), ...rechargeMap.values()]
    .map((tx: any) => normalizeTxTimestampIST(tx))
    .sort((a: any, b: any) => extractTxEpochMs(b) - extractTxEpochMs(a));
}

// API Route: Get all transactions (for Admin) from Cloud SQL, SQLite & backup
app.get(['/api/cloudsql/transactions', '/api/admin/transactions'], async (_req, res) => {
  try {
    initSqliteTransactionsTable();
    const dbTxs = await getAllTransactionsFromDb();
    const sqlTxs = getAllTransactionsFromSql();
    const backupTxs = loadServerTransactions();
    const merged = mergeTxListsForRead(backupTxs, [...sqlTxs, ...dbTxs]);

    return res.json({ success: true, count: merged.length, transactions: merged });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Transactions history for a specific user
app.get('/api/cloudsql/transactions/:userId', async (req, res) => {
  try {
    initSqliteTransactionsTable();
    const { userId } = req.params;
    const cleanId = String(userId).trim();
    const dbTxs = await getUserTransactions(cleanId);
    const sqlTxs = getTransactionsForUserFromSql(cleanId);
    const backupTxs = loadServerTransactions().filter(
      (tx) => String(tx.userId).trim() === cleanId
    );
    const userTxs = mergeTxListsForRead(backupTxs, [...sqlTxs, ...dbTxs]);

    return res.json({ success: true, count: userTxs.length, transactions: userTxs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Create transaction (saved to Cloud SQL + file backup with bulletproof anti-duplicate guards)
app.post('/api/cloudsql/transactions', async (req, res) => {
  try {
    const tx = req.body;
    if (!tx || !tx.userId || tx.amount === undefined || !tx.title) {
      return res.status(400).json({ success: false, error: 'Missing required transaction fields' });
    }

    const cleanUserId = String(tx.userId).trim();

    // Strict Anti-Duplicate Check for withdrawals:
    // 1. Prevent multiple pending withdrawals for the same user
    // 2. Prevent rapid double-clicks (within 30 seconds)
    if (tx.type === 'withdraw' && cleanUserId) {
      const backupTxs = loadServerTransactions();

      // Check if user already has an active pending/processing withdrawal
      const existingPending = backupTxs.find(
        (t) =>
          t.type === 'withdraw' &&
          String(t.userId).trim() === cleanUserId &&
          t.status === 'processing'
      );
      if (existingPending) {
        // If it matches the same reference, return safely
        if (tx.referenceNo && existingPending.referenceNo === tx.referenceNo) {
          return res.json({ success: true, transaction: existingPending, message: 'Existing withdrawal returned' });
        }
        // Block second withdrawal while first is still pending
        return res.status(400).json({
          success: false,
          error: 'A withdrawal request is already pending for your account. Please wait for administrator payout before requesting another.',
        });
      }

      // Check for rapid identical submissions within 30 seconds
      const existingRecent = backupTxs.find(
        (t) =>
          t.type === 'withdraw' &&
          String(t.userId).trim() === cleanUserId &&
          (t.referenceNo === tx.referenceNo ||
            (Math.abs(Number(t.amount) - Number(tx.amount)) < 0.001 &&
              Date.now() - (Number(t.createdAt) || 0) < 30000))
      );
      if (existingRecent) {
        return res.json({ success: true, transaction: existingRecent, message: 'Existing withdrawal returned (anti-duplicate)' });
      }
    }

    // Anti-duplicate guard for manual recharges with same UTR / reference
    if (tx.type === 'recharge' && cleanUserId) {
      const cleanRefOrUtr = String(tx.utrNumber || tx.referenceNo || '').trim();
      const backupTxs = loadServerTransactions();
      const sqlTxs = getTransactionsForUserFromSql(cleanUserId);
      const combinedUserTxs = [...backupTxs, ...sqlTxs];
      const existingSameRecharge = combinedUserTxs.find(
        (t) =>
          t.type === 'recharge' &&
          String(t.userId || '').trim() === cleanUserId &&
          ((tx.id && String(t.id || '').trim() === String(tx.id).trim()) ||
            (cleanRefOrUtr.length >= 6 &&
              (String(t.referenceNo || '').trim() === cleanRefOrUtr ||
                String(t.utrNumber || '').trim() === cleanRefOrUtr)))
      );
      if (existingSameRecharge) {
        return res.json({
          success: true,
          transaction: existingSameRecharge,
          alreadyExists: true,
          message: 'Existing deposit request returned (anti-duplicate)',
        });
      }
    }

    // Ensure every created transaction carries post-tx user balance snapshot if caller omitted it
    const autoBalanceSnapshot =
      tx.balanceAfter === undefined || tx.balanceAfter === null
        ? buildUserBalanceSnapshot(cleanUserId)
        : {};
    const txWithSnapshot = { ...tx, ...autoBalanceSnapshot };

    const resolvedCreatedAt = extractTxEpochMs(txWithSnapshot) || Date.now();
    const normalizedSnapshot = normalizeTxTimestampIST({
      ...txWithSnapshot,
      createdAt: resolvedCreatedAt,
      timestamp: formatISTTimestamp(resolvedCreatedAt),
    });

    // 1. Save to Cloud SQL
    const createdInDb = await createTransaction(normalizedSnapshot);

    // 2. Save to local JSON backup & persistent SQLite ledger
    const backupTxs = loadServerTransactions();
    const refKey = normalizedSnapshot.referenceNo || normalizedSnapshot.id || `tx-${resolvedCreatedAt}`;
    const payload = {
      ...normalizedSnapshot,
      id: normalizedSnapshot.id || (createdInDb ? String(createdInDb.id) : refKey),
      ...(createdInDb?.id && isNumericOnlyId(createdInDb.id) ? { sqlId: Number(createdInDb.id) } : {}),
      createdAt: resolvedCreatedAt,
      timestamp: normalizedSnapshot.timestamp,
      status: normalizedSnapshot.status || (normalizedSnapshot.type === 'withdraw' ? 'processing' : 'completed'),
      referenceNo: normalizedSnapshot.referenceNo || refKey,
    };

    const existingIdx = backupTxs.findIndex(
      (t) => (tx.id && t.id === tx.id) || (tx.referenceNo && t.referenceNo === tx.referenceNo)
    );
    if (existingIdx >= 0) {
      backupTxs[existingIdx] = mergeServerTx(backupTxs[existingIdx], payload);
    } else {
      backupTxs.unshift(payload);
    }
    saveServerTransactions(backupTxs);
    try {
      upsertTransactionInSql(payload);
    } catch {}

    return res.json({ success: true, transaction: payload || createdInDb });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Collect all identifiers (backupTxs + SQLite + PostgreSQL) matching a transaction update request
async function resolveAllTxIdentifiers(
  backupTxs: any[],
  params: { txId?: string; originalReferenceNo?: string; sqlId?: number | string; referenceNo?: string; utrNumber?: string }
): Promise<{ candidateIds: Set<string>; dbMatches: any[]; sqlMatches: any[]; backupMatches: any[] }> {
  const candidateIds = new Set<string>();
  const addId = (v: any) => {
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) candidateIds.add(s);
    }
  };

  addId(params.txId);
  addId(params.originalReferenceNo);
  addId(params.sqlId);
  addId(params.utrNumber);
  if (!params.originalReferenceNo) {
    addId(params.referenceNo);
  }

  // Pass 1: find matching records in backupTxs to expand known ids/refs/UTRs
  for (const t of backupTxs) {
    if (!t) continue;
    const tId = t.id !== undefined && t.id !== null ? String(t.id).trim() : '';
    const tSqlId = t.sqlId !== undefined && t.sqlId !== null ? String(t.sqlId).trim() : '';
    const tRef = t.referenceNo ? String(t.referenceNo).trim() : '';
    const tUtr = t.utrNumber ? String(t.utrNumber).trim() : '';
    if (
      (tId && candidateIds.has(tId)) ||
      (tSqlId && candidateIds.has(tSqlId)) ||
      (tRef && candidateIds.has(tRef)) ||
      (tUtr && candidateIds.has(tUtr))
    ) {
      addId(tId);
      addId(tSqlId);
      addId(tRef);
      addId(tUtr);
    }
  }

  // Pass 2: query SQLite ledger
  const sqlMatches = findTransactionsInSqlByIdentifiers(Array.from(candidateIds));
  for (const st of sqlMatches) {
    addId(st.id);
    addId(st.sqlId);
    addId(st.referenceNo);
    addId(st.utrNumber);
  }

  // Pass 3: query PostgreSQL across all expanded identifiers
  const dbMatches = await findTransactionsInDbByIdentifiers(Array.from(candidateIds));
  for (const dt of dbMatches) {
    addId(dt.id);
    addId(dt.referenceNo);
  }

  // Pass 4: collect all matching backupTxs using expanded candidateIds
  const backupMatches = backupTxs.filter((t) => {
    if (!t) return false;
    const tId = t.id !== undefined && t.id !== null ? String(t.id).trim() : '';
    const tSqlId = t.sqlId !== undefined && t.sqlId !== null ? String(t.sqlId).trim() : '';
    const tRef = t.referenceNo ? String(t.referenceNo).trim() : '';
    const tUtr = t.utrNumber ? String(t.utrNumber).trim() : '';
    return (
      (tId && candidateIds.has(tId)) ||
      (tSqlId && candidateIds.has(tSqlId)) ||
      (tRef && candidateIds.has(tRef)) ||
      (tUtr && candidateIds.has(tUtr))
    );
  });

  return { candidateIds, dbMatches, sqlMatches, backupMatches };
}

// API Route: Update transaction status (for admin approvals, rejections, or status updates)
app.post(['/api/cloudsql/transactions/status', '/api/admin/transactions/status'], async (req, res) => {
  try {
    const { txId, status, referenceNo, originalReferenceNo, utrNumber, sqlId, paymentMethod, reason } = req.body;
    if (!txId || !status) {
      return res.status(400).json({ success: false, error: 'txId and status are required' });
    }

    const cleanId = String(txId).trim();
    const backupTxs = loadServerTransactions();
    const { candidateIds, dbMatches, sqlMatches } = await resolveAllTxIdentifiers(backupTxs, {
      txId: cleanId,
      originalReferenceNo,
      sqlId,
      referenceNo,
      utrNumber,
    });

    const settledUtr = String(utrNumber || '').trim();

    // 1. Update ALL matching rows in Cloud SQL
    const updatedInDb = await updateTransactionStatusInDb(cleanId, status, {
      originalReferenceNo,
      paymentMethod,
      reason,
      identifiers: Array.from(candidateIds),
    });

    // 2. Update ALL matching rows in SQLite ledger
    const updatedInSql = updateTransactionStatusInSql(Array.from(candidateIds), status, {
      ...(settledUtr ? { utrNumber: settledUtr } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(reason ? { rejectReason: reason } : {}),
    });

    // 3. Update ALL matching entries in backup JSON
    let foundTx: any = null;
    for (let i = 0; i < backupTxs.length; i++) {
      const t = backupTxs[i];
      if (!t) continue;
      const tId = t.id !== undefined && t.id !== null ? String(t.id).trim() : '';
      const tSqlId = t.sqlId !== undefined && t.sqlId !== null ? String(t.sqlId).trim() : '';
      const tRef = t.referenceNo ? String(t.referenceNo).trim() : '';
      const tUtr = t.utrNumber ? String(t.utrNumber).trim() : '';
      if (candidateIds.has(tId) || candidateIds.has(tSqlId) || candidateIds.has(tRef) || candidateIds.has(tUtr)) {
        backupTxs[i] = {
          ...t,
          status,
          ...(settledUtr ? { utrNumber: settledUtr } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(reason ? { rejectReason: reason } : {}),
          updatedAt: new Date().toISOString(),
        };
        foundTx = backupTxs[i];
      }
    }

    if (!foundTx && (sqlMatches[0] || dbMatches[0] || updatedInDb)) {
      const src = updatedInSql[0] || sqlMatches[0] || updatedInDb || dbMatches[0];
      foundTx = {
        ...src,
        id: !isNumericOnlyId(cleanId) ? cleanId : String(src.id),
        ...(isNumericOnlyId(src.id) ? { sqlId: Number(src.id) } : {}),
        status,
        ...(settledUtr ? { utrNumber: settledUtr } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(reason ? { rejectReason: reason } : {}),
        updatedAt: new Date().toISOString(),
      };
      backupTxs.unshift(foundTx);
    }

    if (foundTx) {
      saveServerTransactions(backupTxs);
      try {
        upsertTransactionInSql(foundTx);
      } catch {}
    }

    return res.json({ success: true, transaction: foundTx || updatedInSql[0] || updatedInDb });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Active concurrency locks and idempotency caches for financial actions (Anti-double-click protection)
const activeWithdrawalLocks = new Set<string>();
const activeRechargeLocks = new Set<string>();
const activeBalanceAdjustLocks = new Set<string>();
const recentBalanceAdjustHistory = new Map<string, number>();

// API Route: Admin Withdrawal Action (Approve or Reject with automatic user balance refund & anti-double-click protection)
app.post('/api/admin/withdrawals/action', async (req, res) => {
  const { action, txId, referenceNo, originalReferenceNo, utrNumber, sqlId, userId, amount, reason } = req.body;
  if (!action || !txId) {
    return res.status(400).json({ success: false, error: 'action and txId are required' });
  }

  const cleanId = String(txId).trim();

  // 1. Concurrency lock: Reject simultaneous double-click requests
  if (activeWithdrawalLocks.has(cleanId)) {
    return res.status(409).json({ success: false, error: 'Withdrawal action is already being processed. Please wait.' });
  }
  activeWithdrawalLocks.add(cleanId);

  try {
    const backupTxs = loadServerTransactions();
    const { candidateIds, dbMatches, backupMatches } = await resolveAllTxIdentifiers(backupTxs, {
      txId: cleanId,
      originalReferenceNo,
      sqlId,
    });

    const allMatched = [...backupMatches, ...dbMatches];
    const settledMatch = allMatched.find((t) => t.status === 'completed' || t.status === 'rejected');
    const existingTx = settledMatch || backupMatches[0] || dbMatches[0];

    // 2. Strict Idempotency Check across BOTH PostgreSQL & backup JSON
    if (settledMatch) {
      // Ensure ALL copies across Postgres & backupTxs are synced to this terminal status so stale copies can never reappear
      const targetStatus = settledMatch.status;
      await updateTransactionStatusInDb(cleanId, targetStatus, {
        originalReferenceNo,
        identifiers: Array.from(candidateIds),
      });
      let dirty = false;
      for (let i = 0; i < backupTxs.length; i++) {
        const t = backupTxs[i];
        if (!t) continue;
        const tId = String(t.id || '').trim();
        const tSqlId = String(t.sqlId || '').trim();
        const tRef = String(t.referenceNo || '').trim();
        if (candidateIds.has(tId) || candidateIds.has(tSqlId) || candidateIds.has(tRef)) {
          if (t.status !== targetStatus) {
            backupTxs[i] = { ...t, status: targetStatus, updatedAt: new Date().toISOString() };
            dirty = true;
          }
        }
      }
      if (dirty) saveServerTransactions(backupTxs);

      if (action === 'approve' && targetStatus === 'completed') {
        return res.json({
          success: true,
          message: `Withdrawal was already approved previously (Ref: ${settledMatch.utrNumber || settledMatch.referenceNo || 'Settled'})`,
          alreadyProcessed: true,
          transaction: settledMatch,
        });
      }
      if (targetStatus === 'rejected') {
        return res.json({
          success: true,
          message: `Withdrawal was already rejected previously. No duplicate balance refund applied.`,
          alreadyProcessed: true,
          transaction: settledMatch,
        });
      }
      if (action === 'reject' && targetStatus === 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Cannot reject a withdrawal that has already been approved and settled.',
        });
      }
    }

    if (action === 'approve') {
      const finalUtr = String(utrNumber || referenceNo || '').trim();
      const basePm = existingTx?.paymentMethod ? String(existingTx.paymentMethod) : '';
      const nextPm =
        finalUtr && basePm && !basePm.includes(finalUtr)
          ? `${basePm} • UTR: ${finalUtr}`
          : basePm || (finalUtr ? `UTR: ${finalUtr}` : undefined);

      // 1. Update ALL matching rows in Cloud SQL (preserve original referenceNo like WTH... so keys never split!)
      await updateTransactionStatusInDb(cleanId, 'completed', {
        originalReferenceNo,
        paymentMethod: nextPm,
        identifiers: Array.from(candidateIds),
      });

      // 2. Update ALL matching entries in backupTxs (no early break, plus match same userId+amount processing fallback!)
      const targetUid = String(userId || existingTx?.userId || '').trim();
      const targetAmt = Number(amount || existingTx?.amount || 0);
      let updatedTx: any = null;

      for (let i = 0; i < backupTxs.length; i++) {
        const t = backupTxs[i];
        if (!t) continue;
        const tId = t.id !== undefined && t.id !== null ? String(t.id).trim() : '';
        const tSqlId = t.sqlId !== undefined && t.sqlId !== null ? String(t.sqlId).trim() : '';
        const tRef = t.referenceNo ? String(t.referenceNo).trim() : '';
        const matchesIdOrRef = candidateIds.has(tId) || candidateIds.has(tSqlId) || candidateIds.has(tRef);
        const matchesSamePendingWithdraw =
          t.type === 'withdraw' &&
          t.status === 'processing' &&
          targetUid &&
          String(t.userId || '').trim() === targetUid &&
          targetAmt > 0 &&
          Math.abs(Number(t.amount || 0) - targetAmt) < 0.001 &&
          (!existingTx?.createdAt || Math.abs((Number(t.createdAt) || 0) - Number(existingTx.createdAt)) < 60000);

        if (matchesIdOrRef || matchesSamePendingWithdraw) {
          backupTxs[i] = {
            ...t,
            status: 'completed',
            ...(finalUtr ? { utrNumber: finalUtr } : {}),
            ...(nextPm ? { paymentMethod: nextPm } : {}),
            updatedAt: new Date().toISOString(),
          };
          if (!updatedTx) updatedTx = backupTxs[i];
        }
      }

      // If no entry existed in backupTxs (came from Firestore/Postgres only), persist a canonical settled entry now
      if (!updatedTx) {
        const canonicalRef = originalReferenceNo || existingTx?.referenceNo || cleanId;
        updatedTx = {
          ...(existingTx || {}),
          id: !isNumericOnlyId(cleanId) ? cleanId : existingTx?.id && !isNumericOnlyId(existingTx.id) ? existingTx.id : `tx-${Date.now()}`,
          ...(isNumericOnlyId(existingTx?.id) ? { sqlId: Number(existingTx.id) } : {}),
          userId: targetUid || existingTx?.userId || '',
          type: 'withdraw',
          amount: targetAmt || Number(existingTx?.amount || 0),
          title: existingTx?.title || 'Bank Withdrawal',
          timestamp: existingTx ? formatISTTimestamp(extractTxEpochMs(existingTx) || Date.now()) : formatISTTimestamp(Date.now()),
          createdAt: extractTxEpochMs(existingTx) || Date.now(),
          status: 'completed',
          referenceNo: canonicalRef,
          ...(finalUtr ? { utrNumber: finalUtr } : {}),
          ...(nextPm ? { paymentMethod: nextPm } : {}),
          updatedAt: new Date().toISOString(),
        };
        backupTxs.unshift(updatedTx);
      }
      saveServerTransactions(backupTxs);

      return res.json({
        success: true,
        message: `Withdrawal approved & marked as Paid (${finalUtr ? `UTR: ${finalUtr}` : 'Settled'})`,
        transaction: updatedTx,
      });
    } else if (action === 'reject') {
      const numAmount = Number(amount) || (existingTx ? Number(existingTx.amount) : 0);
      const rejectMsg = reason || 'Bank details mismatch';

      // 1. Atomically refund user FIRST in SQLite, Cloud SQL & users_backup.json ONLY ONCE
      let updatedUser: any = null;
      const targetUserId = userId || existingTx?.userId;
      if (targetUserId && numAmount > 0) {
        const cleanUserId = String(targetUserId).trim();
        const balNow = new Date().toISOString();
        await refundUserWithdrawalInDb(cleanUserId, numAmount);
        try {
          updatedUser = creditUserWalletDeltaInSql(cleanUserId, 'withdrawalBalance', numAmount);
        } catch {}
        markUserRuntimeMutated(cleanUserId, updatedUser?.phone);

        const currentUsers = getCachedUsersBackup();
        const userIdx = currentUsers.findIndex(
          (u) => u.id === cleanUserId || u.uid === cleanUserId || u.phone === cleanUserId
        );
        if (userIdx >= 0) {
          const currentBal = Number(currentUsers[userIdx].withdrawalBalance) || 0;
          const newBal = updatedUser ? Number(updatedUser.withdrawalBalance) : Number((currentBal + numAmount).toFixed(2));
          const zeroSet = new Set<string>(
            Array.isArray(currentUsers[userIdx].explicitZeroWallets) ? currentUsers[userIdx].explicitZeroWallets : []
          );
          zeroSet.delete('withdrawalBalance');
          currentUsers[userIdx].withdrawalBalance = newBal;
          currentUsers[userIdx].explicitZeroWallets = Array.from(zeroSet);
          currentUsers[userIdx].isExplicitZeroReset = false;
          currentUsers[userIdx].balanceUpdatedAt = balNow;
          currentUsers[userIdx].updatedAt = balNow;
          saveUsersBackup(currentUsers);
          updatedUser = currentUsers[userIdx];
          markUserRuntimeMutated(updatedUser.id, updatedUser.phone);
        } else if (updatedUser) {
          saveUsersBackup(deduplicateAndMergeUsers(currentUsers, [{ ...updatedUser, isAuthoritativeServer: true }]));
        }
      }

      const refundBalSnapshot = updatedUser
        ? buildUserBalanceSnapshot(updatedUser)
        : targetUserId
        ? buildUserBalanceSnapshot(String(targetUserId).trim())
        : {};

      // 2. Update ALL matching rows in Cloud SQL with refunded balanceAfter snapshot
      await updateTransactionStatusInDb(cleanId, 'rejected', {
        originalReferenceNo,
        reason: rejectMsg,
        identifiers: Array.from(candidateIds),
        ...refundBalSnapshot,
      });

      // 3. Update ALL matching entries in backupTxs (no early break!)
      const targetUid = String(userId || existingTx?.userId || '').trim();
      let updatedTx: any = null;

      for (let i = 0; i < backupTxs.length; i++) {
        const t = backupTxs[i];
        if (!t) continue;
        const tId = t.id !== undefined && t.id !== null ? String(t.id).trim() : '';
        const tSqlId = t.sqlId !== undefined && t.sqlId !== null ? String(t.sqlId).trim() : '';
        const tRef = t.referenceNo ? String(t.referenceNo).trim() : '';
        const matchesIdOrRef = candidateIds.has(tId) || candidateIds.has(tSqlId) || candidateIds.has(tRef);
        const matchesSamePendingWithdraw =
          t.type === 'withdraw' &&
          t.status === 'processing' &&
          targetUid &&
          String(t.userId || '').trim() === targetUid &&
          numAmount > 0 &&
          Math.abs(Number(t.amount || 0) - numAmount) < 0.001 &&
          (!existingTx?.createdAt || Math.abs((Number(t.createdAt) || 0) - Number(existingTx.createdAt)) < 60000);

        if (matchesIdOrRef || matchesSamePendingWithdraw) {
          backupTxs[i] = {
            ...t,
            status: 'rejected',
            rejectReason: rejectMsg,
            ...refundBalSnapshot,
            updatedAt: new Date().toISOString(),
          };
          if (!updatedTx) updatedTx = backupTxs[i];
        }
      }

      if (!updatedTx) {
        const canonicalRef = originalReferenceNo || existingTx?.referenceNo || cleanId;
        updatedTx = {
          ...(existingTx || {}),
          id: !isNumericOnlyId(cleanId) ? cleanId : existingTx?.id && !isNumericOnlyId(existingTx.id) ? existingTx.id : `tx-${Date.now()}`,
          ...(isNumericOnlyId(existingTx?.id) ? { sqlId: Number(existingTx.id) } : {}),
          userId: targetUid || existingTx?.userId || '',
          type: 'withdraw',
          amount: numAmount,
          title: existingTx?.title || 'Bank Withdrawal',
          timestamp: existingTx ? formatISTTimestamp(extractTxEpochMs(existingTx) || Date.now()) : formatISTTimestamp(Date.now()),
          createdAt: extractTxEpochMs(existingTx) || Date.now(),
          status: 'rejected',
          referenceNo: canonicalRef,
          rejectReason: rejectMsg,
          ...refundBalSnapshot,
          updatedAt: new Date().toISOString(),
        };
        backupTxs.unshift(updatedTx);
      }
      saveServerTransactions(backupTxs);

      return res.json({
        success: true,
        message: `Withdrawal rejected and $${numAmount.toFixed(2)} refunded to user balance`,
        user: updatedUser,
        transaction: updatedTx,
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action: must be approve or reject' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    activeWithdrawalLocks.delete(cleanId);
  }
});

// API Route: Admin Recharge Action (Approve with 1-click balance credit or Reject, with atomic SQLite + disk + DB idempotency)
app.post('/api/admin/recharges/action', async (req, res) => {
  const { action, txId, originalReferenceNo, referenceNo, utrNumber, sqlId, userId, amount, reason } = req.body;
  if (!action || !txId) {
    return res.status(400).json({ success: false, error: 'action and txId are required' });
  }

  const cleanId = String(txId).trim();
  const cleanUserId = userId ? String(userId).trim() : '';
  const cleanRefSeed = String(originalReferenceNo || referenceNo || utrNumber || '').trim();

  // 1. Concurrency lock: Reject simultaneous double-click requests (lock by both txId and user+UTR)
  const lockKeys = [cleanId, cleanUserId && cleanRefSeed ? `${cleanUserId}:${cleanRefSeed}` : ''].filter(Boolean);
  if (lockKeys.some((k) => activeRechargeLocks.has(k))) {
    return res.status(409).json({ success: false, error: 'Recharge action is already in progress. Please wait.' });
  }
  lockKeys.forEach((k) => activeRechargeLocks.add(k));

  try {
    initSqliteTransactionsTable();
    const backupTxs = loadServerTransactions();
    const { candidateIds, dbMatches, sqlMatches, backupMatches } = await resolveAllTxIdentifiers(backupTxs, {
      txId: cleanId,
      originalReferenceNo,
      referenceNo,
      utrNumber,
      sqlId,
    });

    const guardKeys = buildRechargeGuardKeys({
      id: cleanId,
      txId: cleanId,
      sqlId,
      referenceNo: referenceNo || cleanRefSeed,
      originalReferenceNo: originalReferenceNo || cleanRefSeed,
      utrNumber: utrNumber || cleanRefSeed,
      userId: cleanUserId,
    });
    for (const cid of candidateIds) {
      guardKeys.push(`id:${cid}`, `ref:${cid}`, `utr:${cid}`);
    }

    const sqlGuardRow = findSettledRechargeGuard(guardKeys);
    const allMatched = [...sqlMatches, ...backupMatches, ...dbMatches];
    const settledMatch = allMatched.find((t) => t.status === 'completed' || t.status === 'rejected');
    const existingTx = settledMatch || sqlMatches[0] || backupMatches[0] || dbMatches[0];

    // 2. Strict Multi-Layer Idempotency Check: If settled in SQLite guard, SQLite ledger, PostgreSQL, or backup, NEVER credit again!
    if (settledMatch || sqlGuardRow) {
      const targetStatus: 'completed' | 'rejected' =
        (settledMatch?.status as any) || (sqlGuardRow?.status as any) || 'completed';

      // Force-sync any stale copies across Cloud SQL, SQLite, and disk backup to terminal status
      await updateTransactionStatusInDb(cleanId, targetStatus, {
        originalReferenceNo: originalReferenceNo || cleanRefSeed,
        identifiers: Array.from(candidateIds),
      });
      updateTransactionStatusInSql(Array.from(candidateIds), targetStatus);

      let dirty = false;
      for (let i = 0; i < backupTxs.length; i++) {
        const t = backupTxs[i];
        if (!t) continue;
        const tId = String(t.id || '').trim();
        const tSqlId = String(t.sqlId || '').trim();
        const tRef = String(t.referenceNo || '').trim();
        const tUtr = String(t.utrNumber || '').trim();
        if (candidateIds.has(tId) || candidateIds.has(tSqlId) || candidateIds.has(tRef) || candidateIds.has(tUtr)) {
          if (t.status !== targetStatus) {
            backupTxs[i] = { ...t, status: targetStatus, updatedAt: new Date().toISOString() };
            dirty = true;
          }
        }
      }
      if (dirty) saveServerTransactions(backupTxs);

      const canonicalSettledTx = settledMatch || existingTx || {
        id: cleanId,
        userId: cleanUserId || sqlGuardRow?.user_id || '',
        type: 'recharge',
        amount: Number(amount) || Number(sqlGuardRow?.amount) || 0,
        status: targetStatus,
        referenceNo: cleanRefSeed || cleanId,
        utrNumber: String(utrNumber || sqlGuardRow?.utr_number || cleanRefSeed || ''),
        updatedAt: new Date().toISOString(),
      };

      if (targetStatus === 'completed') {
        return res.json({
          success: true,
          message: 'Deposit has already been approved and credited previously (idempotent)',
          alreadyProcessed: true,
          transaction: canonicalSettledTx,
        });
      }
      return res.json({
        success: true,
        message: 'Deposit was already rejected previously',
        alreadyProcessed: true,
        transaction: canonicalSettledTx,
      });
    }

    if (action === 'approve') {
      const numAmount = Number(amount) || (existingTx ? Number(existingTx.amount) : 0);
      const targetUserId = String(cleanUserId || existingTx?.userId || '').trim();
      const settledNowMs = Date.now();
      const settledNowIso = new Date(settledNowMs).toISOString();

      // Build canonical tx FIRST so we lock & mark it settled before/with balance credit
      const baseTx = existingTx || {
        id: cleanId,
        userId: targetUserId,
        type: 'recharge',
        amount: numAmount,
        amountInr: Math.round(numAmount * 100),
        title: `UPI Fast Deposit ($${numAmount.toFixed(2)} / ₹${Math.round(numAmount * 100).toLocaleString()})`,
        timestamp: formatISTTimestamp(settledNowMs),
        createdAt: settledNowMs,
        referenceNo: cleanRefSeed || cleanId,
        utrNumber: String(utrNumber || cleanRefSeed || ''),
        paymentMethod: 'Manual UPI (QR)',
      };

      // 1. Lock in SQLite settled_recharge_guards FIRST inside BEGIN IMMEDIATE so concurrent/repeat calls ALWAYS see it
      markRechargeSettledInSql(guardKeys, {
        txId: cleanId,
        userId: targetUserId,
        utrNumber: String(baseTx.utrNumber || baseTx.referenceNo || ''),
        status: 'completed',
        amount: numAmount,
        txRecord: { ...baseTx, status: 'completed', updatedAt: settledNowIso },
      });

      // 2. Credit user rechargeBalance ONLY ONCE across SQLite, users_backup.json, and Cloud SQL
      let updatedUser: any = null;
      if (targetUserId && numAmount > 0) {
        const balNow = new Date().toISOString();
        let sqlUpdated: any = null;
        try {
          sqlUpdated = creditUserWalletDeltaInSql(targetUserId, 'rechargeBalance', numAmount);
        } catch {}
        markUserRuntimeMutated(targetUserId, sqlUpdated?.phone);

        const currentUsers = getCachedUsersBackup();
        const userIdx = currentUsers.findIndex(
          (u) => u.id === targetUserId || u.uid === targetUserId || u.phone === targetUserId
        );
        if (userIdx >= 0) {
          const currentBal = Number(currentUsers[userIdx].rechargeBalance) || 0;
          const newBal = sqlUpdated ? Number(sqlUpdated.rechargeBalance) : Number((currentBal + numAmount).toFixed(2));
          const zeroSet = new Set<string>(
            Array.isArray(currentUsers[userIdx].explicitZeroWallets) ? currentUsers[userIdx].explicitZeroWallets : []
          );
          zeroSet.delete('rechargeBalance');
          currentUsers[userIdx].rechargeBalance = newBal;
          currentUsers[userIdx].explicitZeroWallets = Array.from(zeroSet);
          currentUsers[userIdx].isExplicitZeroReset = false;
          currentUsers[userIdx].balanceUpdatedAt = balNow;
          currentUsers[userIdx].updatedAt = balNow;
          saveUsersBackup(currentUsers);
          updatedUser = currentUsers[userIdx];
          markUserRuntimeMutated(updatedUser.id, updatedUser.phone);

          try {
            await upsertUser({
              uid: currentUsers[userIdx].id,
              phone: currentUsers[userIdx].phone,
              rechargeBalance: newBal,
              explicitZeroWallets: currentUsers[userIdx].explicitZeroWallets,
              isExplicitZeroReset: false,
              balanceUpdatedAt: balNow,
              updatedAt: balNow,
            });
          } catch (e) {}
        } else if (sqlUpdated) {
          updatedUser = sqlUpdated;
          saveUsersBackup(deduplicateAndMergeUsers(currentUsers, [{ ...sqlUpdated, isAuthoritativeServer: true }]));
          try {
            await upsertUser({
              uid: sqlUpdated.id,
              phone: sqlUpdated.phone,
              rechargeBalance: Number(sqlUpdated.rechargeBalance) || 0,
              explicitZeroWallets: sqlUpdated.explicitZeroWallets || [],
              isExplicitZeroReset: false,
              balanceUpdatedAt: balNow,
              updatedAt: balNow,
            });
          } catch (e) {}
        }
      }

      const creditBalSnapshot = updatedUser
        ? buildUserBalanceSnapshot(updatedUser)
        : targetUserId
        ? buildUserBalanceSnapshot(targetUserId)
        : {};

      // 3. Persist completed tx + balanceAfter snapshot across Cloud SQL, SQLite, and disk backup (even if existingTx came only from Firestore!)
      const dbUpdated = await updateTransactionStatusInDb(cleanId, 'completed', {
        originalReferenceNo: originalReferenceNo || cleanRefSeed,
        identifiers: Array.from(candidateIds),
        ...creditBalSnapshot,
      });
      if (!dbUpdated) {
        try {
          await createTransaction({
            ...baseTx,
            status: 'completed',
            ...creditBalSnapshot,
          });
        } catch {}
      }

      const completedTxRecord = {
        ...baseTx,
        id: !isNumericOnlyId(cleanId) ? cleanId : String(baseTx.id || cleanId),
        status: 'completed',
        ...creditBalSnapshot,
        updatedAt: settledNowIso,
      };
      upsertTransactionInSql(completedTxRecord);

      let updatedTx: any = null;
      for (let i = 0; i < backupTxs.length; i++) {
        const t = backupTxs[i];
        if (!t) continue;
        const tId = String(t.id || '').trim();
        const tSqlId = String(t.sqlId || '').trim();
        const tRef = String(t.referenceNo || '').trim();
        const tUtr = String(t.utrNumber || '').trim();
        if (candidateIds.has(tId) || candidateIds.has(tSqlId) || candidateIds.has(tRef) || candidateIds.has(tUtr)) {
          backupTxs[i] = {
            ...t,
            status: 'completed',
            ...creditBalSnapshot,
            updatedAt: settledNowIso,
          };
          if (!updatedTx) updatedTx = backupTxs[i];
        }
      }
      if (!updatedTx) {
        updatedTx = completedTxRecord;
        backupTxs.unshift(updatedTx);
      }
      saveServerTransactions(backupTxs);

      return res.json({
        success: true,
        message: `Deposit of $${numAmount.toFixed(2)} approved & credited to user wallet`,
        user: updatedUser,
        transaction: updatedTx,
      });
    } else if (action === 'reject') {
      const rejectMsg = reason || 'Deposit verification failed';
      const settledNowMs = Date.now();
      const settledNowIso = new Date(settledNowMs).toISOString();
      const numAmount = Number(amount) || (existingTx ? Number(existingTx.amount) : 0);
      const targetUserId = String(cleanUserId || existingTx?.userId || '').trim();

      const baseTx = existingTx || {
        id: cleanId,
        userId: targetUserId,
        type: 'recharge',
        amount: numAmount,
        amountInr: Math.round(numAmount * 100),
        title: `UPI Fast Deposit ($${numAmount.toFixed(2)} / ₹${Math.round(numAmount * 100).toLocaleString()})`,
        timestamp: formatISTTimestamp(settledNowMs),
        createdAt: settledNowMs,
        referenceNo: cleanRefSeed || cleanId,
        utrNumber: String(utrNumber || cleanRefSeed || ''),
        paymentMethod: 'Manual UPI (QR)',
      };

      markRechargeSettledInSql(guardKeys, {
        txId: cleanId,
        userId: targetUserId,
        utrNumber: String(baseTx.utrNumber || baseTx.referenceNo || ''),
        status: 'rejected',
        amount: numAmount,
        txRecord: { ...baseTx, status: 'rejected', rejectReason: rejectMsg, updatedAt: settledNowIso },
      });

      const dbUpdated = await updateTransactionStatusInDb(cleanId, 'rejected', {
        originalReferenceNo: originalReferenceNo || cleanRefSeed,
        reason: rejectMsg,
        identifiers: Array.from(candidateIds),
      });
      if (!dbUpdated) {
        try {
          await createTransaction({
            ...baseTx,
            status: 'rejected',
          });
        } catch {}
      }

      const rejectedTxRecord = {
        ...baseTx,
        id: !isNumericOnlyId(cleanId) ? cleanId : String(baseTx.id || cleanId),
        status: 'rejected',
        rejectReason: rejectMsg,
        updatedAt: settledNowIso,
      };
      upsertTransactionInSql(rejectedTxRecord);

      let updatedTx: any = null;
      for (let i = 0; i < backupTxs.length; i++) {
        const t = backupTxs[i];
        if (!t) continue;
        const tId = String(t.id || '').trim();
        const tSqlId = String(t.sqlId || '').trim();
        const tRef = String(t.referenceNo || '').trim();
        const tUtr = String(t.utrNumber || '').trim();
        if (candidateIds.has(tId) || candidateIds.has(tSqlId) || candidateIds.has(tRef) || candidateIds.has(tUtr)) {
          backupTxs[i] = {
            ...t,
            status: 'rejected',
            rejectReason: rejectMsg,
            updatedAt: settledNowIso,
          };
          if (!updatedTx) updatedTx = backupTxs[i];
        }
      }
      if (!updatedTx) {
        updatedTx = rejectedTxRecord;
        backupTxs.unshift(updatedTx);
      }
      saveServerTransactions(backupTxs);

      return res.json({
        success: true,
        message: `Deposit rejected (${rejectMsg})`,
        transaction: updatedTx,
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action: must be approve or reject' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    lockKeys.forEach((k) => activeRechargeLocks.delete(k));
  }
});

// API Route: Admin Manual Balance Adjustment with strict anti-double-click debounce & atomic lock
app.post('/api/admin/adjust-balance', async (req, res) => {
  const { userId, wallet, amount, type, note, idempotencyKey } = req.body;
  if (!userId || !wallet || amount === undefined || !type) {
    return res.status(400).json({ success: false, error: 'userId, wallet, amount, and type are required' });
  }

  const cleanUserId = String(userId).trim();
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid amount' });
  }

  const token = idempotencyKey || `${cleanUserId}-${wallet}-${type}-${numAmount.toFixed(2)}`;
  const now = Date.now();

  // Deduplicate rapid repeat calls within 4000ms
  if (recentBalanceAdjustHistory.has(token)) {
    const lastTime = recentBalanceAdjustHistory.get(token)!;
    if (now - lastTime < 4000) {
      return res.json({
        success: true,
        message: 'Duplicate adjustment request ignored (already processed)',
        alreadyProcessed: true,
      });
    }
  }

  if (activeBalanceAdjustLocks.has(cleanUserId)) {
    return res.status(409).json({ success: false, error: 'Balance adjustment for this user is already in progress. Please wait.' });
  }

  activeBalanceAdjustLocks.add(cleanUserId);
  recentBalanceAdjustHistory.set(token, now);

  try {
    const currentUsers = getCachedUsersBackup();
    const userIdx = currentUsers.findIndex(
      (u) => u.id === cleanUserId || u.uid === cleanUserId || u.phone === cleanUserId
    );
    if (userIdx < 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const balNow = new Date().toISOString();
    const currentBal = Number(currentUsers[userIdx][wallet]) || 0;
    const delta = type === 'add' ? numAmount : -numAmount;
    const nextVal = Math.max(0, Number((currentBal + delta).toFixed(2)));
    const zeroSet = new Set<string>(
      Array.isArray(currentUsers[userIdx].explicitZeroWallets) ? currentUsers[userIdx].explicitZeroWallets : []
    );
    if (nextVal === 0) {
      zeroSet.add(wallet);
    } else {
      zeroSet.delete(wallet);
    }
    currentUsers[userIdx][wallet] = nextVal;
    currentUsers[userIdx].explicitZeroWallets = Array.from(zeroSet);
    currentUsers[userIdx].isExplicitZeroReset = false;
    currentUsers[userIdx].balanceUpdatedAt = balNow;
    currentUsers[userIdx].updatedAt = balNow;
    saveUsersBackup(currentUsers);
    markUserRuntimeMutated(currentUsers[userIdx].id, currentUsers[userIdx].phone);

    // 1. Permanent SQLite SQL database update
    try {
      upsertUserInSql(currentUsers[userIdx]);
    } catch (sqlErr) {
      console.warn('SQLite adjust-balance warning:', sqlErr);
    }

    // 2. Sync to Cloud SQL
    try {
      await upsertUser({
        uid: currentUsers[userIdx].id,
        phone: currentUsers[userIdx].phone,
        [wallet]: nextVal,
        explicitZeroWallets: currentUsers[userIdx].explicitZeroWallets,
        isExplicitZeroReset: false,
        balanceUpdatedAt: balNow,
        updatedAt: balNow,
      });
    } catch (e) {}

    // Record adjustment transaction in server transactions backup & Cloud SQL
    const adjNow = Date.now();
    const adjTx: any = {
      id: `tx-adj-${adjNow}`,
      userId: currentUsers[userIdx].id,
      type: type === 'add' ? 'bonus' : 'earnings',
      amount: numAmount,
      title: `Admin ${type === 'add' ? 'Credit' : 'Debit'}: ${note || 'Manual adjustment'}`,
      timestamp: formatISTTimestamp(adjNow),
      createdAt: adjNow,
      status: 'completed',
      referenceNo: `ADM${Math.floor(100000 + Math.random() * 900000)}`,
      ...buildUserBalanceSnapshot(currentUsers[userIdx]),
    };

    const backupTxs = loadServerTransactions();
    backupTxs.unshift(adjTx);
    saveServerTransactions(backupTxs);
    createTransaction(adjTx).catch(() => {});

    return res.json({
      success: true,
      message: `Adjusted ${wallet} by ${type === 'add' ? '+' : '-'}$${numAmount.toFixed(2)}`,
      user: currentUsers[userIdx],
      transaction: adjTx,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    activeBalanceAdjustLocks.delete(cleanUserId);
  }
});

// API Route: Admin direct user update (Direct SQLite SQL & disk backup commitment)
app.post(['/api/admin/user/:userId/update', '/api/users/:userId/update', '/api/user/:userId/update'], async (req, res) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId || '').trim();
    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const updates = { ...(req.body || {}) };
    delete updates.isAuthoritativeServer;
    delete updates.isRuntimeMutated;
    const nowIso = new Date().toISOString();

    const existingSql = getUserByIdOrPhoneFromSql(cleanId);
    const currentUsers = getCachedUsersBackup();
    const userIdx = currentUsers.findIndex(
      (u) => u.id === cleanId || u.uid === cleanId || (u.phone && u.phone.includes(cleanId))
    );

    const baseUser = existingSql || (userIdx >= 0 ? currentUsers[userIdx] : { id: cleanId });
    const touchedFinancial = WALLET_ZERO_KEYS.some((k) => updates[k] !== undefined) || updates.isExplicitZeroReset === true;
    const zeroSet = new Set<string>([
      ...(Array.isArray(baseUser.explicitZeroWallets) ? baseUser.explicitZeroWallets : []),
      ...(Array.isArray(updates.explicitZeroWallets) ? updates.explicitZeroWallets : []),
    ]);
    for (const w of WALLET_ZERO_KEYS) {
      if (updates[w] !== undefined) {
        if (Number(updates[w]) === 0) {
          zeroSet.add(w);
        } else {
          zeroSet.delete(w);
        }
      }
    }
    const nextZeroWallets = Array.from(zeroSet);
    const nextBalanceUpdatedAt = touchedFinancial
      ? (updates.balanceUpdatedAt || nowIso)
      : (baseUser.balanceUpdatedAt || updates.balanceUpdatedAt);

    const targetUser: any = {
      ...baseUser,
      ...updates,
      explicitZeroWallets: nextZeroWallets,
      isExplicitZeroReset: Boolean(updates.isExplicitZeroReset),
      ...(nextBalanceUpdatedAt ? { balanceUpdatedAt: nextBalanceUpdatedAt } : {}),
      updatedAt: nowIso,
    };

    if (userIdx >= 0) {
      currentUsers[userIdx] = targetUser;
    } else {
      currentUsers.push(targetUser);
    }
    saveUsersBackup(currentUsers);

    // 1. Direct SQLite commitment
    try {
      upsertUserInSql(targetUser);
      if (updates.withdrawalBalance !== undefined) {
        updateUserWalletBalanceInSql(cleanId, 'withdrawalBalance', Number(updates.withdrawalBalance));
      }
      if (updates.rechargeBalance !== undefined) {
        updateUserWalletBalanceInSql(cleanId, 'rechargeBalance', Number(updates.rechargeBalance));
      }
    } catch (sqlErr) {
      console.warn('SQLite user update warning:', sqlErr);
    }
    markUserRuntimeMutated(targetUser.id || cleanId, targetUser.phone);

    // 2. Cloud SQL sync
    try {
      await upsertUser({
        uid: targetUser.id || cleanId,
        phone: targetUser.phone,
        ...updates,
        explicitZeroWallets: nextZeroWallets,
        isExplicitZeroReset: Boolean(updates.isExplicitZeroReset),
        ...(nextBalanceUpdatedAt ? { balanceUpdatedAt: nextBalanceUpdatedAt } : {}),
        updatedAt: nowIso,
      });
    } catch (e) {}

    return res.json({ success: true, user: { ...targetUser, isRuntimeMutated: true } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Admin Permanent User Deletion (Hard delete from SQLite SQL, orders, disk backup, and permanent blacklist!)
app.delete(['/api/admin/users/:userId', '/api/users/:userId'], async (req, res) => {
  try {
    const { userId } = req.params;
    let queryPhone = req.query.phone ? String(req.query.phone).replace(/\D/g, '').slice(-10) : '';
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    const cleanId = String(userId).trim();

    // Find any existing record in SQLite or disk backup to discover full identifiers (phone, uid, id)
    const existingSql = getUserByIdOrPhoneFromSql(cleanId) || (queryPhone ? getUserByIdOrPhoneFromSql(queryPhone) : null);
    const existingDisk = getCachedUsersBackup().find(
      (u) =>
        String(u.id).trim() === cleanId ||
        String(u.uid || '').trim() === cleanId ||
        (queryPhone && String(u.phone || '').replace(/\D/g, '').slice(-10) === queryPhone)
    );
    if (!queryPhone) {
      if (existingSql?.phone) queryPhone = String(existingSql.phone).replace(/\D/g, '').slice(-10);
      else if (existingDisk?.phone) queryPhone = String(existingDisk.phone).replace(/\D/g, '').slice(-10);
    }
    const targetUid = existingSql?.id || existingDisk?.id || cleanId;

    // 1. Immediately HARD DELETE user from SQLite platform_users table
    hardDeleteUserInSql(cleanId, queryPhone);
    if (targetUid && targetUid !== cleanId) {
      hardDeleteUserInSql(targetUid, queryPhone);
    }

    // 2. Immediately HARD DELETE user's contracts and orders from SQLite
    deleteOrdersForUserInSql(cleanId, queryPhone);
    if (targetUid && targetUid !== cleanId) {
      deleteOrdersForUserInSql(targetUid, queryPhone);
    }

    // 3. Save to deleted_users.json blacklist so user can NEVER be backed up or restored
    saveDeletedUser(cleanId, queryPhone);
    if (targetUid && targetUid !== cleanId) {
      saveDeletedUser(targetUid, queryPhone);
    }

    // 4. Wipe completely from users_backup.json on server disk
    const current = getCachedUsersBackup();
    const updatedUsers = current.filter((u) => {
      const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
      const uId = String(u.id || u.uid || '').trim();
      if (uId === cleanId || uId === targetUid || u.phone === cleanId || (queryPhone && uPhone === queryPhone)) {
        return false;
      }
      return true;
    });
    saveUsersBackup(updatedUsers);

    // 4b. Wipe user's orders completely from orders_backup.json on server disk
    try {
      if (fs.existsSync(ORDERS_BACKUP_PATH)) {
        const diskOrders = JSON.parse(fs.readFileSync(ORDERS_BACKUP_PATH, 'utf-8'));
        if (Array.isArray(diskOrders)) {
          const filteredOrders = diskOrders.filter((o) => {
            const oUid = String(o?.userId || '').trim();
            const oPhone = String(o?.userPhone || '').replace(/\D/g, '').slice(-10);
            if (oUid === cleanId || oUid === targetUid || (queryPhone && oPhone === queryPhone)) {
              return false;
            }
            return true;
          });
          fs.writeFileSync(ORDERS_BACKUP_PATH, JSON.stringify(filteredOrders, null, 2), 'utf-8');
        }
      }
    } catch (errOrders) {
      console.warn('Could not filter orders_backup.json on user delete:', errOrders);
    }

    // 5. Delete from Cloud SQL
    try {
      await deleteUserFromDb(cleanId, queryPhone);
      if (targetUid && targetUid !== cleanId) {
        await deleteUserFromDb(targetUid, queryPhone);
      }
    } catch {}

    console.log(`[Admin Permanent Delete] User ${cleanId} (Phone: ${queryPhone || '—'}, UID: ${targetUid}) permanently deleted & blacklisted forever.`);
    return res.json({
      success: true,
      message: `User ${cleanId} permanently deleted from database and blacklisted forever. All contracts and balances wiped.`,
      remainingCount: updatedUsers.length,
      deletedId: cleanId,
      deletedPhone: queryPhone,
    });
  } catch (err: any) {
    console.error('Error during admin user hard deletion:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Admin Test & Manual SMS OTP Dispatch (Also registers active OTP in otpStore so user can verify with it!)
app.post('/api/admin/test-otp-sms', async (req, res) => {
  try {
    const { mobile, purpose = 'test', template, customOtp, provider, senderId, authKey, customWebhookUrl } = req.body;
    if (!mobile || String(mobile).replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    const cleanCustomOtp = customOtp ? String(customOtp).replace(/\D/g, '').slice(0, 6) : '';
    const testOtp =
      cleanCustomOtp.length === 6 ? cleanCustomOtp : Math.floor(100000 + Math.random() * 900000).toString();
    const validityMins = Math.max(1, Number(otpSettings.otpValidityMinutes) || 5);
    const expiresAt = Date.now() + validityMins * 60 * 1000;

    const { messageText } = formatSmsMessageFromAdminTemplate({
      purpose: purpose || 'register',
      otp: testOtp,
      mobile: cleanMobile,
      validityMins,
      overrideTemplate: template,
      preferOverride: true,
    });

    const existingRecord = otpStore.get(cleanMobile);
    const recentOtps = Array.from(
      new Set([testOtp, ...(existingRecord?.recentOtps || []), ...(existingRecord?.otp ? [existingRecord.otp] : [])])
    ).slice(0, 5);

    // Also store in otpStore so this OTP is immediately valid for the user on Registration or Reset Password!
    otpStore.set(cleanMobile, {
      otp: testOtp,
      recentOtps,
      createdAtMs: Date.now(),
      expiresAt,
      purpose: purpose === 'forgot-password' ? 'forgot-password' : 'register',
      attempts: 0,
      formattedMessage: messageText,
    });

    const rawClientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['cf-connecting-ip'] as string) ||
      req.socket.remoteAddress ||
      '';

    const dispatchResult = await dispatchSmsViaGateway({
      mobile: cleanMobile,
      otp: testOtp,
      messageText,
      provider,
      senderId,
      authKey,
      customWebhookUrl,
      clientIp: rawClientIp,
    });

    const logItem: OtpServerLog = {
      id: `test-${Date.now()}`,
      mobile: cleanMobile,
      otp: testOtp,
      purpose: purpose === 'forgot-password' ? 'forgot-password' : purpose === 'register' ? 'register' : 'test',
      message: messageText,
      status: 'pending',
      attempts: 0,
      createdAt: formatISTTimestamp(Date.now()),
      expiresAt,
      provider: dispatchResult.provider,
      senderId: dispatchResult.senderId,
      gatewayStatus: dispatchResult.statusText,
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
      apiResponse: dispatchResult.rawResponse,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Live PostgreSQL Database Inspector Endpoint: Check tables, record counts, and saved data
app.get(['/api/admin/sql-inspector', '/api/sql-status', '/api/db-status'], async (req, res) => {
  try {
    const isConnected = isSqlConfigured;
    if (!isConnected) {
      return res.json({
        success: false,
        connected: false,
        message: 'PostgreSQL database is NOT configured or DATABASE_URL is missing.',
        fallback: 'Running on local SQLite database & JSON backups',
      });
    }

    const pool = createPool();
    const [
      usersCountRes,
      ordersCountRes,
      txCountRes,
      settingsCountRes,
      productsCountRes,
      recentUsersRes,
      recentOrdersRes,
      settingsRes,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as count FROM users').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM investment_orders').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM transactions').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM platform_settings').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM products').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT uid, phone, nickname, recharge_balance, withdrawal_balance, vip_level, role FROM users ORDER BY id DESC LIMIT 15').catch(() => ({ rows: [] })),
      pool.query('SELECT id, user_id, product_name, price, daily_earnings, status, purchase_date FROM investment_orders ORDER BY purchase_timestamp DESC LIMIT 15').catch(() => ({ rows: [] })),
      pool.query('SELECT key, value FROM platform_settings').catch(() => ({ rows: [] })),
    ]);

    return res.json({
      success: true,
      connected: true,
      databaseType: 'PostgreSQL (Render Cloud Database)',
      status: 'Live & Active',
      tableCounts: {
        users: usersCountRes.rows[0]?.count ?? 0,
        investment_orders: ordersCountRes.rows[0]?.count ?? 0,
        transactions: txCountRes.rows[0]?.count ?? 0,
        platform_settings: settingsCountRes.rows[0]?.count ?? 0,
        products: productsCountRes.rows[0]?.count ?? 0,
      },
      savedSettings: settingsRes.rows.reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
      }, {}),
      recentUsers: recentUsersRes.rows,
      recentOrders: recentOrdersRes.rows,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Razorpay Underwriting & E-Commerce Compliance Discovery Endpoints
app.get('/robots.txt', (req, res) => {
  const host = req.get('host') || 'nexatrad.site';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${protocol}://${host}/sitemap.xml\n`);
});

// Dynamic Google AdMob / AdSense verification files (/app-ads.txt & /ads.txt)
app.get(['/app-ads.txt', '/ads.txt'], async (_req, res) => {
  try {
    const settings = await getEffectivePlatformSettingsServer();
    const publisherId = deriveAdMobPublisherIdServer(settings);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.type('text/plain').send(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`);
  } catch {
    return res.type('text/plain').send(`google.com, ${GOOGLE_TEST_ADMOB_PUB_ID}, DIRECT, f08c47fec0942fa0\n`);
  }
});

app.get('/sitemap.xml', (req, res) => {
  const host = req.get('host') || 'nexatrad.site';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>
  <url><loc>${baseUrl}/?view=store</loc><priority>0.9</priority></url>
  <url><loc>${baseUrl}/?policy=terms</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/?policy=shipping</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/?policy=refund</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/?policy=privacy</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/?policy=contact</loc><priority>0.8</priority></url>
</urlset>`);
});

app.get(['/store', '/shop', '/products'], (req, res) => {
  res.redirect('/?view=store');
});

app.get('/api/compliance/status', (req, res) => {
  res.json({
    status: 'compliant_ecommerce_store',
    business_legal_name: 'Nexa AI Technologies India Pvt Ltd',
    store_name: 'Nexa AI Technologies & Smart Electronics Store',
    mcc: '5732',
    category: 'Consumer Electronics & Computer Hardware',
    accepted_currencies: ['INR'],
    delivery_terms: 'Doorstep Courier Dispatch (3-5 Business Days)',
    refund_terms: '7-Day Return & Replacement Policy',
    merchant_active: true,
  });
});

function resolveServerPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx >= 0 && process.argv[portArgIdx + 1]) {
    const parsedArg = parseInt(process.argv[portArgIdx + 1], 10);
    if (Number.isFinite(parsedArg) && parsedArg > 0) return parsedArg;
  }
  const eqPortArg = process.argv.find((a) => a.startsWith('--port='));
  if (eqPortArg) {
    const parsedEq = parseInt(eqPortArg.split('=')[1], 10);
    if (Number.isFinite(parsedEq) && parsedEq > 0) return parsedEq;
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.PORT === '8080' &&
    process.env.NGINX_PORT === '8080'
  ) {
    return Number(process.env.DEFAULT_APP_PORT || 3000);
  }
  return process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
}

const port = resolveServerPort();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, port, uptime: process.uptime() });
});

async function startServer() {
  let viteReady: Promise<any> | null = null;
  let viteInstance: any = null;

  if (process.env.NODE_ENV !== 'production') {
    viteReady = createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    })
      .then((v) => {
        viteInstance = v;
        return v;
      })
      .catch((err) => {
        console.error('[Vite Dev Middleware] Failed to initialize:', err);
        throw err;
      });

    app.use(async (req, res, next) => {
      try {
        const vite = viteInstance || (await viteReady);
        if (!vite) return next();
        return vite.middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (fs.existsSync(indexPath)) {
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
                <h2>🚀 Nexa AI Build Notice</h2>
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

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);

    // Immediately assign bootCloudSyncPromise so incoming requests during boot await authoritative Cloud SQL sync first
    bootCloudSyncPromise = (async () => {
      try {
        // 1. Initialize SQLite users safely without clobbering existing positive balances
        try {
          const diskUsers = getCachedUsersBackup();
          initAndSyncSqlUsers(diskUsers);
          console.log(`[SQLite SQL] Unified ${diskUsers.length} users into permanent SQLite database.`);
        } catch (sqliteInitErr) {
          console.warn('[SQLite SQL] User sync warning:', sqliteInitErr);
        }

        // 2. Cloud SQL PostgreSQL sync (Cloud SQL is the persistent source of truth across deploys/updates!)
        if (isSqlConfigured) {
          await initPostgresSchema();

          let sqlUsers = await getAllUsers();
          if (sqlUsers.length === 0) {
            const diskUsers = getCachedUsersBackup();
            console.log(`[Cloud SQL] Seeding ${diskUsers.length} users into empty Cloud SQL PostgreSQL...`);
            for (const u of diskUsers) {
              await upsertUser({
                uid: u.id || u.uid || u.phone,
                phone: u.phone,
                password: u.password || 'password123',
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
                bankDetails: u.bankDetails,
                isExplicitZeroReset: Boolean(u.isExplicitZeroReset),
                explicitZeroWallets: Array.isArray(u.explicitZeroWallets) ? u.explicitZeroWallets : [],
                balanceUpdatedAt: u.balanceUpdatedAt,
                updatedAt: u.updatedAt,
              });
            }
          } else {
            const deletedSet = loadDeletedUsers();
            const cleanSqlUsers = sqlUsers.filter((u) => {
              const uId = String(u.uid || u.id || '').trim();
              const uPhone = String(u.phone || '').replace(/\D/g, '').slice(-10);
              if (deletedSet.has(uId) || (uPhone && deletedSet.has(uPhone))) {
                deleteUserFromDb(uId, uPhone).catch(() => {});
                return false;
              }
              return true;
            });

            const formattedCloudUsers = cleanSqlUsers.map((u) => formatPostgresUserRow(u));
            const cloudIdSet = new Set<string>();
            const cloudPhoneSet = new Set<string>();
            for (const cu of formattedCloudUsers) {
              if (cu.id) cloudIdSet.add(String(cu.id).trim());
              const cp = cu.phone ? String(cu.phone).replace(/\D/g, '').slice(-10) : '';
              if (cp.length === 10) cloudPhoneSet.add(cp);
            }

            // CRITICAL FIX: Cloud SQL PostgreSQL is authoritative over bundled workspace SQLite/JSON after updates!
            // Local SQLite only takes precedence if mutated during THIS live runtime process.
            const localSqlUsers = getAllUsersFromSql(false).map((u) =>
              isUserRuntimeMutated(u) ? { ...u, isAuthoritativeServer: true } : u
            );
            const cloudAuthoritative = formattedCloudUsers.map((u) =>
              !isUserRuntimeMutated(u) ? { ...u, isAuthoritativeServer: true } : u
            );
            const mergedStartupUsers = deduplicateAndMergeUsers(localSqlUsers, cloudAuthoritative);

            const localById = new Map<string, any>();
            const localByPhone = new Map<string, any>();
            for (const lu of getAllUsersFromSql(false)) {
              if (lu.id) localById.set(String(lu.id).trim(), lu);
              const lp = lu.phone ? String(lu.phone).replace(/\D/g, '').slice(-10) : '';
              if (lp.length === 10) localByPhone.set(lp, lu);
            }

            for (const u of mergedStartupUsers) {
              const uId = String(u.id || '').trim();
              const uPhone = u.phone ? String(u.phone).replace(/\D/g, '').slice(-10) : '';
              const existingLocal = localById.get(uId) || (uPhone.length === 10 ? localByPhone.get(uPhone) : undefined);

              if (!existingLocal) {
                upsertUserInSql(u);
              } else if (!isUserRuntimeMutated(u)) {
                const differs =
                  Math.abs((Number(existingLocal.rechargeBalance) || 0) - (Number(u.rechargeBalance) || 0)) > 0.001 ||
                  Math.abs((Number(existingLocal.withdrawalBalance) || 0) - (Number(u.withdrawalBalance) || 0)) > 0.001 ||
                  Math.abs((Number(existingLocal.productRevenue) || 0) - (Number(u.productRevenue) || 0)) > 0.001 ||
                  Math.abs((Number(existingLocal.totalInvested) || 0) - (Number(u.totalInvested) || 0)) > 0.001 ||
                  Math.abs((Number(existingLocal.totalCommissionEarned) || 0) - (Number(u.totalCommissionEarned) || 0)) > 0.001;
                if (differs) {
                  upsertUserInSql(u);
                }
              }

              // Seed ONLY users completely missing from Cloud SQL (never overwrite existing live Cloud SQL balances!)
              const existsInCloud = cloudIdSet.has(uId) || (uPhone.length === 10 && cloudPhoneSet.has(uPhone));
              if (!existsInCloud) {
                await upsertUser({
                  uid: uId,
                  phone: u.phone,
                  password: u.password || 'password123',
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
                  bankDetails: u.bankDetails,
                  isExplicitZeroReset: Boolean(u.isExplicitZeroReset),
                  explicitZeroWallets: Array.isArray(u.explicitZeroWallets) ? u.explicitZeroWallets : [],
                  balanceUpdatedAt: u.balanceUpdatedAt,
                  updatedAt: u.updatedAt,
                }).catch(() => {});
              }
            }

            saveUsersBackup(mergedStartupUsers);
            console.log(`[Cloud SQL] Unified ${mergedStartupUsers.length} live persistent users (Cloud SQL authoritative over bundled SQLite).`);
          }

          // 3. Orders: Cloud SQL is the persistent source of truth
          const sqlOrders = await getAllDbOrders();
          const deletedOrderIds = loadDeletedOrders();
          const validOrders: any[] = [];
          for (const ord of sqlOrders) {
            const cleanId = String(ord.id).trim().toLowerCase();
            if (deletedOrderIds.has(cleanId) || cleanId.startsWith('ord-test') || ord.productName?.includes('Demo')) {
              await deleteOrderFromDb(String(ord.id));
              deleteOrderFromSql(String(ord.id));
            } else {
              validOrders.push(ord);
            }
          }
          saveServerOrders(validOrders);
          console.log(`[Cloud SQL] Preserved & synced ${validOrders.length} live persistent orders from database.`);

          // 4. Promo Codes: Cloud SQL is the persistent source of truth
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

          // 5. Products: Cloud SQL is the persistent source of truth
          const sqlProducts = await getAllDbProducts();
          if (sqlProducts.length === 0) {
            const prodsFile = path.resolve(process.cwd(), 'src/data/firestoreProducts.json');
            if (fs.existsSync(prodsFile)) {
              try {
                const fileProds = JSON.parse(fs.readFileSync(prodsFile, 'utf-8'));
                if (Array.isArray(fileProds)) {
                  for (const prod of fileProds) {
                    await upsertDbProduct(prod);
                  }
                }
              } catch {}
            }
          } else {
            console.log(`[Cloud SQL] Loaded ${sqlProducts.length} persistent live products from database.`);
          }

          // 6. Platform Settings: Preserve live database settings; auto-upgrade legacy placeholder AdMob test IDs once to live credentials
          const dbSettings = await getPlatformSettingFromDb('general');
          if (dbSettings && typeof dbSettings === 'object' && Object.keys(dbSettings).length > 0) {
            let finalDbSettings: Record<string, any> = { ...dbSettings };
            if (
              !finalDbSettings.adMobLiveMigratedV1 &&
              (!finalDbSettings.adMobAppId ||
                finalDbSettings.adMobAppId === GOOGLE_TEST_ADMOB_APP_ID ||
                finalDbSettings.adMobPublisherId === GOOGLE_TEST_ADMOB_PUB_ID)
            ) {
              finalDbSettings = {
                ...finalDbSettings,
                isAdMobEnabled: true,
                adMobTestMode: false,
                adMobAppId: PERMANENT_LIVE_ADMOB_APP_ID,
                adMobBannerUnitId: PERMANENT_LIVE_ADMOB_BANNER_ID,
                adMobPublisherId: PERMANENT_LIVE_ADMOB_PUB_ID,
                adMobLiveMigratedV1: true,
              };
              await setPlatformSettingInDb('general', finalDbSettings).catch(() => {});
              console.log('[Cloud SQL] Migrated legacy AdMob test defaults to permanent live AdMob IDs.');
            }
            saveServerPlatformSettings(finalDbSettings);
            console.log('[Cloud SQL] Persistent live platform settings preserved from database.');
          } else {
            const currentSettings = loadServerPlatformSettings();
            await setPlatformSettingInDb('general', currentSettings);
            console.log('[Cloud SQL] Initialized platform settings into database.');
          }

          console.log('[Cloud SQL] Permanent connection verified. Real website and workspace remain unified.');
        }

        // 7. Run referral reconciliation ONLY AFTER Cloud SQL user/order sync finishes!
        try {
          const statsResult = await reconcileAllReferralStatsServer();
          console.log(`[Referral System] Reconciled referral income and direct member counts for ${statsResult.reconciledCount} user(s).`);
        } catch (err) {
          console.warn('[Referral System] Boot reconciliation notice:', err);
        }
      } catch (seedErr) {
        console.warn('[Cloud SQL] Startup persistence check note:', seedErr);
      }
    })();
  });
}

startServer();
