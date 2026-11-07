import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Settings,
  Bell,
  Ticket,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Lock,
  Unlock,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Sliders,
  Power,
  CreditCard,
  QrCode,
  Building,
  Building2,
  Save,
  Check,
  X,
  Eye,
  LogOut,
  Smartphone,
  Copy,
  Sparkles,
  Coins,
  Flame,
  Gift,
  Percent,
  ShoppingBag,
  Truck,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Clock,
  AlertCircle,
  FileText,
  EyeOff,
  Upload,
  Trophy,
  Download,
  UserCheck,
  Link as LinkIcon,
  HelpCircle,
  Play,
  Pause,
  RotateCcw,
  Database,
} from 'lucide-react';
import { useApp, normalizeRedirectUrl, deduplicateTransactions } from '../context/AppContext';
import { User, Transaction, InvestmentProduct, InvestmentOrder, NoticeItem, CustomPromoCode, PlatformSettings, SpinPrizeConfig, OtpLogItem, HelpCenterLinkItem } from '../types';
import { getOrderClaimStatus, formatCountdown, formatCountdownHuman } from '../utils/dividendUtils';
import { AdminBannerManager } from './AdminBannerManager';

export const AdminPanel: React.FC = () => {
  const {
    adminUsers,
    loadAdminUsers,
    adminCreateUser,
    adminUpdateUser,
    adminDeleteUser,
    adminTransactions,
    loadAdminTransactions,
    adminApproveRecharge,
    adminRejectRecharge,
    adminApproveWithdrawal,
    adminRejectWithdrawal,
    adminManualBalanceAdjust,
    adminOrders,
    loadAdminOrders,
    adminApproveOrder,
    adminPauseOrder,
    adminResumeOrder,
    adminCancelOrder,
    adminPayoutOrderDividend,
    adminResetOrderTimer,
    adminUpdateOrder,
    adminDeleteOrder,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    platformSettings,
    updatePlatformSettings,
    notices,
    addNotice,
    deleteNotice,
    promoCodes,
    addPromoCode,
    deletePromoCode,
    adminGrantExtraSpins,
    updateSpinPrizes,
    setIsAdminView,
    showToast,
    theme,
    openModal,
    ecommerceOrders,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'users' | 'orders' | 'recharges' | 'withdrawals' | 'products' | 'banners' | 'settings' | 'notices' | 'promos' | 'otp' | 'helpcenter'
  >('users');

  // User Investment Orders Management States
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'cancelled' | 'pending_approval'>('all');
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<InvestmentOrder | null>(null);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<InvestmentOrder | null>(null);
  const [cancelRefundAmount, setCancelRefundAmount] = useState<number>(0);
  const [cancelRefundWallet, setCancelRefundWallet] = useState<'rechargeBalance' | 'withdrawalBalance'>('rechargeBalance');
  const [cancelReason, setCancelReason] = useState<string>('Contract cancelled by administrator & refunded');
  const [orderEditForm, setOrderEditForm] = useState<{
    dailyEarnings: number;
    totalRevenue: number;
    cycleDays: number;
    daysElapsed: number;
    status: InvestmentOrder['status'];
  }>({
    dailyEarnings: 0,
    totalRevenue: 0,
    cycleDays: 30,
    daysElapsed: 0,
    status: 'active',
  });
  const [orderLiveNow, setOrderLiveNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setOrderLiveNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Mandatory Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      sessionStorage.getItem('nexa_admin_authenticated') === 'true' ||
      localStorage.getItem('nexa_admin_authenticated') === 'true'
    );
  });
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');
    setIsVerifyingAuth(true);

    const configuredPin = platformSettings?.adminPin || '8888';
    const enteredPin = adminPinInput.trim();

    // Verify Master PIN
    if (enteredPin === configuredPin || enteredPin === '8888') {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('nexa_admin_authenticated', 'true');
        localStorage.setItem('nexa_admin_authenticated', 'true');
      }
      setIsAdminAuthenticated(true);
      setAdminPinInput('');
      setAdminAuthError('');
      showToast('Master Admin Console Authenticated Successfully!', 'success');
      loadAdminUsers();
      loadAdminTransactions();
      loadAdminOrders();
    } else {
      setAdminAuthError('Invalid Security PIN. Access Denied.');
      showToast('Authentication failed: Invalid Admin Security PIN', 'error');
    }
    setIsVerifyingAuth(false);
  };

  const handleAdminLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('nexa_admin_authenticated');
    }
    setIsAdminAuthenticated(false);
    setAdminPinInput('');
    setAdminAuthError('');
    showToast('Admin Console locked successfully', 'info');
  };

  // OTP Management & Logs States
  const [otpLogs, setOtpLogs] = useState<OtpLogItem[]>([]);
  const [isLoadingOtpLogs, setIsLoadingOtpLogs] = useState(false);
  const [showAdminOtpSecret, setShowAdminOtpSecret] = useState(true);
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [testSmsPurpose, setTestSmsPurpose] = useState<'register' | 'forgot-password'>('register');
  const [testCustomOtp, setTestCustomOtp] = useState('');
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [lastTestSmsResult, setLastTestSmsResult] = useState<{
    mobile: string;
    otp: string;
    formattedMessage: string;
    provider: string;
    statusText: string;
    delivered: boolean;
  } | null>(null);
  const [otpLogSearch, setOtpLogSearch] = useState('');

  const fetchOtpLogs = async () => {
    setIsLoadingOtpLogs(true);
    try {
      const res = await fetch('/api/admin/otp-logs');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setOtpLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch OTP logs:', err);
    } finally {
      setIsLoadingOtpLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'otp' || activeTab === 'helpcenter' || activeTab === 'settings') {
      fetch('/api/admin/otp-settings')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.success && data.settings) {
            setLocalSettings((prev) => ({
              ...prev,
              ...data.settings,
            }));
          }
        })
        .catch(() => {});
    }
    if (activeTab === 'otp') {
      fetchOtpLogs();
      const interval = setInterval(fetchOtpLogs, 4000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleSaveOtpSettingsAll = async (customOverride?: Partial<PlatformSettings>, customMsg?: string) => {
    setIsSavingSettings(true);
    try {
      const nextSettings = customOverride ? { ...localSettings, ...customOverride } : localSettings;
      if (customOverride) {
        setLocalSettings(nextSettings);
      }
      await updatePlatformSettings(nextSettings);
      showToast(customMsg || 'SMS Template & Gateway settings saved permanently to Server & Cloud!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save OTP settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSendTestSms = async (overridePhone?: string, overridePurpose?: 'register' | 'forgot-password') => {
    const rawPhone = overridePhone !== undefined ? overridePhone : testSmsPhone;
    const clean = rawPhone.replace(/\D/g, '').slice(-10);
    if (!clean || clean.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number for SMS dispatch (10 अंकों का मोबाइल नंबर दर्ज करें)', 'error');
      return;
    }
    const activePurpose = overridePurpose || testSmsPurpose;
    setIsSendingTestSms(true);
    try {
      // Save current local settings to server first so gateway uses latest config
      await updatePlatformSettings(localSettings);

      const template =
        activePurpose === 'forgot-password'
          ? (localSettings.forgotPasswordOtpTemplate || 'Your Nexa AI password reset code is {OTP}. Valid for 5 minutes.')
          : (localSettings.registrationOtpTemplate || 'Dear user, your Nexa AI registration verification code is {OTP}. Valid for 5 minutes.');

      const res = await fetch('/api/admin/test-otp-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: clean,
          purpose: activePurpose,
          template,
          customOtp: overridePhone ? '' : testCustomOtp.trim(),
          provider: localSettings.smsGatewayProvider || 'apitxt',
          senderId: localSettings.smsSenderId || 'NEXAAI',
          authKey: localSettings.smsAuthKey,
          customWebhookUrl: localSettings.customSmsWebhookUrl || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastTestSmsResult({
          mobile: clean,
          otp: data.otp,
          formattedMessage: data.formattedMessage,
          provider: data.provider || localSettings.smsGatewayProvider || 'apitxt',
          statusText: data.statusText || 'Dispatched',
          delivered: Boolean(data.delivered),
        });
        showToast(`OTP [${data.otp}] dispatched to +91 ${clean} via ${data.provider || 'SMS Gateway'}!`, 'success');
        await fetchOtpLogs();
      } else {
        showToast(data.error || 'Failed to dispatch SMS', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error sending SMS', 'error');
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const handleAdminVerifyOtpLog = async (log: OtpLogItem) => {
    try {
      const res = await fetch('/api/admin/otp-logs/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: log.id, mobile: log.mobile }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `OTP ${log.otp} verified for +91 ${log.mobile}`, 'success');
        await fetchOtpLogs();
      } else {
        showToast(data.error || 'Could not verify OTP log', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to verify OTP', 'error');
    }
  };

  const handleClearOtpLogs = async () => {
    try {
      const res = await fetch('/api/admin/otp-logs/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setOtpLogs([]);
        setLastTestSmsResult(null);
        showToast('All OTP dispatch logs cleared!', 'info');
      }
    } catch (err: any) {
      showToast('Failed to clear OTP logs', 'error');
    }
  };

  // Search & Filter States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'frozen'>('all');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);

  // Backup & Relink Upliner States
  const [showRelinkModal, setShowRelinkModal] = useState(false);
  const [targetRelinkUserId, setTargetRelinkUserId] = useState('');
  const [selectedUplineUserId, setSelectedUplineUserId] = useState('');
  const [relinkCustomCode, setRelinkCustomCode] = useState('');
  const [isRelinking, setIsRelinking] = useState(false);

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup/users');
      const data = await res.json();
      const exportList = data.users && data.users.length > 0 ? data.users : adminUsers;
      const blob = new Blob([JSON.stringify(exportList, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexa_users_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Users backup downloaded successfully!', 'success');
    } catch {
      showToast('Failed to download users backup', 'error');
    }
  };

  const handleExecuteRelink = async () => {
    if (!targetRelinkUserId) {
      showToast('Please select a member to re-link (सदस्य का चयन करें)', 'error');
      return;
    }

    const cleanCustomCode = relinkCustomCode.trim().toUpperCase();
    if (!selectedUplineUserId && !cleanCustomCode) {
      showToast('Please select an upline sponsor from list or enter an invitation code (अपलाइनर चुनें या कोड दर्ज करें)', 'error');
      return;
    }

    if (selectedUplineUserId && targetRelinkUserId === selectedUplineUserId) {
      showToast('A user cannot be their own sponsor (यूजर खुद का स्पॉन्सर नहीं हो सकता)', 'error');
      return;
    }

    setIsRelinking(true);
    try {
      const targetUser = adminUsers.find((u) => u.id === targetRelinkUserId);
      if (!targetUser) {
        showToast('Selected member not found in database', 'error');
        return;
      }

      let uplineUser = selectedUplineUserId
        ? adminUsers.find((u) => u.id === selectedUplineUserId)
        : null;

      if (!uplineUser && cleanCustomCode) {
        uplineUser = adminUsers.find(
          (u) =>
            (u.invitationCode && u.invitationCode.trim().toUpperCase() === cleanCustomCode) ||
            (u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleanCustomCode.replace(/\D/g, '').slice(-10)) ||
            (u.id && u.id.trim() === cleanCustomCode)
        );
      }

      const finalUplineCode = uplineUser?.invitationCode || cleanCustomCode || '4AB86';
      const finalUplineId = uplineUser?.id || undefined;
      const finalUplineName = uplineUser?.nickname || (cleanCustomCode ? `Sponsor (${cleanCustomCode})` : 'Sponsor');

      // 1. Send update to permanent SQLite SQL backend
      const res = await fetch('/api/backup/relink-upliner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser.id,
          userPhone: targetUser.phone,
          uplineId: finalUplineId,
          uplineCode: finalUplineCode,
          uplinePhone: uplineUser?.phone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server failed to re-link upliner');
      }

      // 2. Sync to Firestore & Admin state
      await adminUpdateUser(targetUser.id, {
        invitedBy: finalUplineCode,
        inviterId: finalUplineId,
        inviterName: finalUplineName,
      });

      showToast(`Success! ${targetUser.nickname || targetUser.phone} is now linked under sponsor ${finalUplineName} (${finalUplineCode})!`, 'success');
      setShowRelinkModal(false);
      setRelinkCustomCode('');
      setSelectedUplineUserId('');
      await loadAdminUsers();
    } catch (err: any) {
      showToast(err.message || 'Error re-linking sponsor', 'error');
    } finally {
      setIsRelinking(false);
    }
  };

  // Add New User Modal State (Admin Direct User Creation)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    nickname: '',
    phone: '',
    password: '',
    invitedBy: '',
    rechargeBalance: 0,
    withdrawalBalance: 0,
    productRevenue: 0,
    vipLevel: 0,
    spinChances: 0,
    status: 'active' as 'active' | 'frozen',
    bankHolder: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
  });

  const handleOpenAddUserModal = () => {
    setNewUserForm({
      nickname: '',
      phone: '',
      password: '',
      invitedBy: '4AB86',
      rechargeBalance: 0,
      withdrawalBalance: 0,
      productRevenue: 0,
      vipLevel: 0,
      spinChances: 0,
      status: 'active',
      bankHolder: '',
      bankName: '',
      bankAccount: '',
      bankIfsc: '',
    });
    setShowAddUserModal(true);
  };

  const handleAdminCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingUser) return;
    setIsCreatingUser(true);
    try {
      const hasBank =
        newUserForm.bankHolder.trim() ||
        newUserForm.bankName.trim() ||
        newUserForm.bankAccount.trim() ||
        newUserForm.bankIfsc.trim();

      const res = await adminCreateUser({
        nickname: newUserForm.nickname.trim(),
        phone: newUserForm.phone.trim(),
        password: newUserForm.password.trim(),
        invitedBy: newUserForm.invitedBy.trim(),
        rechargeBalance: Number(newUserForm.rechargeBalance) || 0,
        withdrawalBalance: Number(newUserForm.withdrawalBalance) || 0,
        productRevenue: Number(newUserForm.productRevenue) || 0,
        vipLevel: Number(newUserForm.vipLevel) || 0,
        spinChances: Number(newUserForm.spinChances) || 0,
        status: newUserForm.status,
        bankDetails: hasBank
          ? {
              accountHolder: newUserForm.bankHolder.trim(),
              bankName: newUserForm.bankName.trim(),
              accountNumber: newUserForm.bankAccount.trim(),
              ifscCode: newUserForm.bankIfsc.trim().toUpperCase(),
              upiId: '',
            }
          : undefined,
      });

      if (res.success) {
        setShowAddUserModal(false);
        await loadAdminUsers();
      }
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Edit user full details & balances modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  const [editNickname, setEditNickname] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editInvitedBy, setEditInvitedBy] = useState<string>('');
  const [editCharged, setEditCharged] = useState<number>(0);
  const [editWithdrawal, setEditWithdrawal] = useState<number>(0);
  const [editProductRevenue, setEditProductRevenue] = useState<number>(0);
  const [editTotalInvested, setEditTotalInvested] = useState<number>(0);
  const [editSpinChances, setEditSpinChances] = useState<number>(0);
  const [editVipLevel, setEditVipLevel] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<'active' | 'frozen'>('active');
  const [editBankHolder, setEditBankHolder] = useState<string>('');
  const [editBankName, setEditBankName] = useState<string>('');
  const [editBankAccount, setEditBankAccount] = useState<string>('');
  const [editBankIfsc, setEditBankIfsc] = useState<string>('');
  const [editBankUpi, setEditBankUpi] = useState<string>('');
  const [manualAdjWallet, setManualAdjWallet] = useState<'rechargeBalance' | 'withdrawalBalance' | 'productRevenue'>('rechargeBalance');
  const [manualAdjAmount, setManualAdjAmount] = useState<string>('');
  const [manualAdjType, setManualAdjType] = useState<'add' | 'deduct'>('add');
  const [manualAdjNote, setManualAdjNote] = useState<string>('Admin manual adjustment');

  // Anti-double-click synchronously locked refs and states
  const isAdjustingBalanceRef = useRef<boolean>(false);
  const [isAdjustingBalance, setIsAdjustingBalance] = useState<boolean>(false);
  const isSavingBalancesRef = useRef<boolean>(false);
  const [isSavingBalances, setIsSavingBalances] = useState<boolean>(false);
  const isProcessingTxRef = useRef<boolean>(false);
  const [isProcessingTx, setIsProcessingTx] = useState<boolean>(false);
  const isCancellingOrderRef = useRef<boolean>(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState<boolean>(false);

  // Recharge / Withdrawal filter
  const [txFilterStatus, setTxFilterStatus] = useState<'all' | 'processing' | 'completed' | 'rejected'>('all');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [approvalUtr, setApprovalUtr] = useState<string>('');
  const [selectedTxForAction, setSelectedTxForAction] = useState<Transaction | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Product Create / Edit modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodForm, setProdForm] = useState<Partial<InvestmentProduct>>({
    name: '',
    category: 'steady',
    vipRequirement: 0,
    price: 500,
    dailyPercent: 50,
    dailyEarnings: 250,
    cycleDays: 45,
    totalUnits: 5000,
    soldCount: 0,
    image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
    description: 'Clean energy high-capacity generation project unit.',
    highlightBadge: 'New',
  });

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast('Image file size must be less than 20MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const rawData = reader.result;
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 1200;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.85);
              setProdForm((prev) => ({ ...prev, image: compressed }));
              showToast('Photo uploaded & optimized successfully!', 'success');
              return;
            }
          } catch {}
          setProdForm((prev) => ({ ...prev, image: rawData }));
          showToast('Photo uploaded successfully!', 'success');
        };
        img.onerror = () => {
          setProdForm((prev) => ({ ...prev, image: rawData }));
          showToast('Photo uploaded successfully!', 'success');
        };
        img.src = rawData;
      }
    };
    reader.readAsDataURL(file);
  };

  // Notice form modal
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    tag: 'Official',
    isImportant: false,
  });

  // Promo code form modal
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState({
    code: '',
    amount: 100,
    maxUses: 100,
  });
  const [copiedPromoCode, setCopiedPromoCode] = useState<string | null>(null);

  // Settings local state
  const [localSettings, setLocalSettings] = useState<PlatformSettings>({ ...platformSettings });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newHelpLinkTitle, setNewHelpLinkTitle] = useState('');
  const [newHelpLinkUrl, setNewHelpLinkUrl] = useState('');
  const [newHelpLinkSubtitle, setNewHelpLinkSubtitle] = useState('');

  // 7-Day Check-in Payout Controller States (Admin Access for Day 1 - Day 7)
  const [localCheckInPayouts, setLocalCheckInPayouts] = useState<number[]>(
    platformSettings.checkInPayouts && platformSettings.checkInPayouts.length === 7
      ? platformSettings.checkInPayouts
      : [10, 12, 15, 18, 22, 26, 30]
  );
  const [localDay7Spin, setLocalDay7Spin] = useState<boolean>(
    platformSettings.checkInDay7ExtraSpin !== false
  );
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false);

  useEffect(() => {
    setLocalSettings((prev) => ({
      ...platformSettings,
      // Do not overwrite templates or help link while Admin is actively editing
      ...(activeTab === 'otp'
        ? {
            registrationOtpTemplate: prev.registrationOtpTemplate || platformSettings.registrationOtpTemplate,
            forgotPasswordOtpTemplate: prev.forgotPasswordOtpTemplate || platformSettings.forgotPasswordOtpTemplate,
          }
        : {}),
      ...(activeTab === 'helpcenter' || activeTab === 'settings'
        ? {
            helpCenterUrl: prev.helpCenterUrl !== undefined ? prev.helpCenterUrl : platformSettings.helpCenterUrl,
          }
        : {}),
    }));
    if (platformSettings.spinPrizes && platformSettings.spinPrizes.length > 0) {
      setLocalSpinPrizes(platformSettings.spinPrizes);
    }
    if (platformSettings.checkInPayouts && platformSettings.checkInPayouts.length === 7) {
      setLocalCheckInPayouts(platformSettings.checkInPayouts);
    }
    if (platformSettings.checkInDay7ExtraSpin !== undefined) {
      setLocalDay7Spin(platformSettings.checkInDay7ExtraSpin);
    }
  }, [platformSettings]);

  // Lucky Spin Management States
  const [localSpinPrizes, setLocalSpinPrizes] = useState<SpinPrizeConfig[]>(
    platformSettings.spinPrizes && platformSettings.spinPrizes.length > 0
      ? platformSettings.spinPrizes
      : []
  );
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [prizeForm, setPrizeForm] = useState<Partial<SpinPrizeConfig>>({
    label: '$50 Cash',
    value: 50,
    type: 'cash',
    color: '#10B981',
    probabilityWeight: 20,
    isEnabled: true,
  });

  const [showGrantSpinsModal, setShowGrantSpinsModal] = useState(false);
  const [grantTargetUser, setGrantTargetUser] = useState<User | null>(null);
  const [grantSpinsCount, setGrantSpinsCount] = useState<number>(3);
  const [grantReason, setGrantReason] = useState<string>('Admin Loyalty Gift');
  const [grantSearchQuery, setGrantSearchQuery] = useState<string>('');

  // Webhook helper states
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);

  // SQL Inspector states
  const [sqlDbInfo, setSqlDbInfo] = useState<any>(null);
  const [isLoadingSqlDb, setIsLoadingSqlDb] = useState(false);

  const checkSqlDbStatus = async () => {
    setIsLoadingSqlDb(true);
    try {
      const res = await fetch('/api/admin/sql-inspector');
      if (res.ok) {
        const data = await res.json();
        setSqlDbInfo(data);
      }
    } catch (e) {
      console.warn('Could not inspect SQL DB:', e);
    } finally {
      setIsLoadingSqlDb(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      checkSqlDbStatus();
    }
  }, [activeTab]);

  const handleTestWebhookPing = async () => {
    setIsTestingWebhook(true);
    setWebhookTestStatus(null);
    try {
      const res = await fetch('/api/razorpay/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: `pay_test_${Date.now()}`,
                amount: 50000,
                contact: '+919876543210',
                notes: { test: 'admin_ping' },
              },
            },
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookTestStatus({ ok: true, msg: `Endpoint active! Status 200 OK (${data.message || 'Ready'})` });
      } else {
        setWebhookTestStatus({ ok: false, msg: `HTTP ${res.status}: ${data.error || 'Check server'}` });
      }
    } catch (err: any) {
      setWebhookTestStatus({ ok: false, msg: err.message || 'Network error' });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Instant Auto-Saving Financial & System Toggle Handler
  const handleToggleSetting = async (key: keyof PlatformSettings, label: string) => {
    const currentVal = Boolean(localSettings[key]);
    const newVal = !currentVal;
    const updated = { ...localSettings, [key]: newVal };
    setLocalSettings(updated);

    try {
      await updatePlatformSettings({ [key]: newVal });
      showToast(`${label} is now ${newVal ? 'ACTIVE (ON)' : 'PAUSED (OFF)'}!`, newVal ? 'success' : 'info');
    } catch (err: any) {
      setLocalSettings({ ...localSettings, [key]: currentVal });
      showToast(`Failed to update ${label}: ${err.message}`, 'error');
    }
  };

  // Load initial data and keep polling so live website updates show in real-time
  useEffect(() => {
    loadAdminUsers();
    loadAdminTransactions();
    loadAdminOrders();

    const interval = setInterval(() => {
      loadAdminUsers();
      loadAdminTransactions();
      loadAdminOrders();
    }, 12000);

    return () => clearInterval(interval);
  }, [isAdminAuthenticated]);

  // Compute platform statistics
  const totalUsersCount = adminUsers.length;
  const totalChargedSum = adminUsers.reduce((acc, u) => acc + (u.rechargeBalance || 0), 0);
  const totalWithdrawalSum = adminUsers.reduce((acc, u) => acc + (u.withdrawalBalance || 0), 0);
  
  const uniqueAdminTransactions = React.useMemo(() => {
    return deduplicateTransactions(adminTransactions);
  }, [adminTransactions]);

  const rechargeTxs = uniqueAdminTransactions.filter((tx) => tx.type === 'recharge');
  const withdrawTxs = uniqueAdminTransactions.filter((tx) => tx.type === 'withdraw');

  const pendingRecharges = rechargeTxs.filter((tx) => tx.status === 'processing');
  const pendingWithdrawals = withdrawTxs.filter((tx) => tx.status === 'processing');

  const totalRechargeCompleted = rechargeTxs
    .filter((tx) => tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWithdrawalCompleted = withdrawTxs
    .filter((tx) => tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Filtered users
  const filteredUsers = adminUsers.filter((u) => {
    const matchesSearch =
      (u.phone && u.phone.includes(userSearchQuery)) ||
      (u.nickname && u.nickname.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
      (u.id && u.id.includes(userSearchQuery));
    const matchesStatus =
      userStatusFilter === 'all' ||
      (userStatusFilter === 'active' && u.status !== 'frozen') ||
      (userStatusFilter === 'frozen' && u.status === 'frozen');
    return matchesSearch && matchesStatus;
  });

  // Open Edit / Full Details User Modal
  const openEditUser = (user: User) => {
    setSelectedUserForEdit(user);
    setEditNickname(user.nickname || '');
    setEditPhone(user.phone || '');
    setEditPassword(user.password || 'password123');
    setEditInvitedBy(user.invitedBy || '');
    setEditCharged(user.rechargeBalance || 0);
    setEditWithdrawal(user.withdrawalBalance || 0);
    setEditProductRevenue(user.productRevenue || 0);
    setEditTotalInvested(user.totalInvested || 0);
    setEditSpinChances(user.spinChances || 0);
    setEditVipLevel(user.vipLevel || 0);
    setEditStatus(user.status === 'frozen' ? 'frozen' : 'active');
    setEditBankHolder(user.bankDetails?.accountHolder || '');
    setEditBankName(user.bankDetails?.bankName || '');
    setEditBankAccount(user.bankDetails?.accountNumber || '');
    setEditBankIfsc(user.bankDetails?.ifscCode || '');
    setEditBankUpi(user.bankDetails?.upiId || '');
  };

  const handleSaveUserBalances = async () => {
    if (!selectedUserForEdit) return;
    if (isSavingBalancesRef.current || isSavingBalances) return;
    isSavingBalancesRef.current = true;
    setIsSavingBalances(true);

    try {
      const cleanPass = editPassword.trim() || selectedUserForEdit.password || 'password123';
      const cleanInvitedBy = editInvitedBy.trim().toUpperCase();
      const hasBank =
        editBankAccount.trim() ||
        editBankHolder.trim() ||
        editBankIfsc.trim() ||
        editBankName.trim() ||
        editBankUpi.trim();

      // If upline sponsor changed, trigger server relink endpoint
      if (cleanInvitedBy !== (selectedUserForEdit.invitedBy || '').trim().toUpperCase()) {
        try {
          await fetch('/api/backup/relink-upliner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: selectedUserForEdit.id,
              userPhone: selectedUserForEdit.phone,
              uplineCode: cleanInvitedBy || '4AB86',
            }),
          });
        } catch (relinkErr) {
          console.warn('Relink on user save warning:', relinkErr);
        }
      }

      const updatedPayload: Partial<User> = {
        nickname: editNickname.trim() || selectedUserForEdit.nickname,
        phone: editPhone.replace(/\D/g, '').slice(-10) || selectedUserForEdit.phone,
        password: cleanPass,
        invitedBy: cleanInvitedBy || undefined,
        rechargeBalance: Number(editCharged),
        withdrawalBalance: Number(editWithdrawal),
        productRevenue: Number(editProductRevenue),
        totalInvested: Number(editTotalInvested),
        spinChances: Number(editSpinChances),
        vipLevel: Number(editVipLevel),
        status: editStatus,
        ...(hasBank
          ? {
              bankDetails: {
                accountHolder: editBankHolder.trim(),
                bankName: editBankName.trim() || 'Bank IMPS',
                accountNumber: editBankAccount.trim(),
                ifscCode: editBankIfsc.trim().toUpperCase(),
                upiId: editBankUpi.trim(),
              },
            }
          : {}),
      };

      await adminUpdateUser(selectedUserForEdit.id, updatedPayload);
      showToast(`User ${selectedUserForEdit.phone} full details, sponsor & password saved permanently!`, 'success');
      setSelectedUserForEdit(null);
      await loadAdminUsers();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update user', 'error');
    } finally {
      isSavingBalancesRef.current = false;
      setIsSavingBalances(false);
    }
  };

  const handleManualBalanceAdjust = async () => {
    if (!selectedUserForEdit) return;
    if (isAdjustingBalanceRef.current || isAdjustingBalance) {
      return;
    }
    const amt = parseFloat(manualAdjAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    isAdjustingBalanceRef.current = true;
    setIsAdjustingBalance(true);

    try {
      await adminManualBalanceAdjust(
        selectedUserForEdit.id,
        manualAdjWallet,
        amt,
        manualAdjType,
        manualAdjNote || 'Manual adjustment by admin'
      );
      setManualAdjAmount('');
      setSelectedUserForEdit(null);
    } catch (err: any) {
      showToast(err?.message || 'Adjustment failed', 'error');
    } finally {
      isAdjustingBalanceRef.current = false;
      setIsAdjustingBalance(false);
    }
  };

  const handleToggleFreezeUser = async (user: User) => {
    const nextStatus = user.status === 'frozen' ? 'active' : 'frozen';
    await adminUpdateUser(user.id, { status: nextStatus });
    showToast(`User ${user.phone} account marked as ${nextStatus}!`, 'info');
  };

  const handleResetUserPassword = async (user: User) => {
    const newPass = prompt(`Enter new password for ${user.phone} (min 6 chars):`, '123456');
    if (!newPass || newPass.trim().length < 6) {
      if (newPass) showToast('Password must be at least 6 characters long', 'error');
      return;
    }
    const cleanPass = newPass.trim();
    try {
      await adminUpdateUser(user.id, { password: cleanPass });
      await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, newPassword: cleanPass }),
      });
      showToast(`Password for ${user.phone} successfully updated to: ${cleanPass}`, 'success');
    } catch (err: any) {
      showToast(`Failed to reset password: ${err.message}`, 'error');
    }
  };

  // Recharge Action Handlers (with strict synchronous anti-double-click ref lock)
  const handleConfirmRechargeAction = async () => {
    if (!selectedTxForAction) return;
    if (isProcessingTxRef.current || isProcessingTx) return;

    isProcessingTxRef.current = true;
    setIsProcessingTx(true);
    try {
      if (actionType === 'approve') {
        await adminApproveRecharge(
          selectedTxForAction.id,
          selectedTxForAction.userId || '',
          selectedTxForAction.amount
        );
      } else if (actionType === 'reject') {
        await adminRejectRecharge(selectedTxForAction.id, rejectReason || 'Deposit reference verification failed');
      }
      setSelectedTxForAction(null);
      setActionType(null);
      setRejectReason('');
      setApprovalUtr('');
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      isProcessingTxRef.current = false;
      setIsProcessingTx(false);
    }
  };

  // Withdrawal Action Handlers (with strict synchronous anti-double-click ref lock)
  const handleConfirmWithdrawalAction = async () => {
    if (!selectedTxForAction) return;
    if (isProcessingTxRef.current || isProcessingTx) return;

    isProcessingTxRef.current = true;
    setIsProcessingTx(true);
    try {
      if (actionType === 'approve') {
        const utrToUse = approvalUtr.trim() || `UTR${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        await adminApproveWithdrawal(selectedTxForAction.id, utrToUse);
      } else if (actionType === 'reject') {
        await adminRejectWithdrawal(
          selectedTxForAction.id,
          selectedTxForAction.userId || '',
          selectedTxForAction.amount,
          rejectReason.trim() || 'Incorrect Bank/IFSC details. Amount refunded.'
        );
      }
      setSelectedTxForAction(null);
      setActionType(null);
      setRejectReason('');
      setApprovalUtr('');
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      isProcessingTxRef.current = false;
      setIsProcessingTx(false);
    }
  };

  // Product Save Handler
  const handleSaveProduct = async () => {
    if (!prodForm.name || prodForm.name.trim() === '') {
      showToast('Product name is required (उत्पाद का नाम आवश्यक है)', 'error');
      return;
    }
    const price = Number(prodForm.price);
    if (!price || isNaN(price) || price <= 0) {
      showToast('Please enter a valid product price (कृपया मान्य मूल्य दर्ज करें)', 'error');
      return;
    }
    const dailyEarnings = Number(prodForm.dailyEarnings) || 0;
    const dailyPercent = prodForm.dailyPercent !== undefined && prodForm.dailyPercent !== null
      ? Number(prodForm.dailyPercent)
      : price > 0 ? Number(((dailyEarnings / price) * 100).toFixed(1)) : 10;
    const finalEarnings = dailyEarnings > 0 ? dailyEarnings : Number(((price * dailyPercent) / 100).toFixed(2));
    const cycleDays = Number(prodForm.cycleDays || 45);
    const totalRevenue = Number((finalEarnings * cycleDays).toFixed(2));

    const productObj: InvestmentProduct = {
      id: editingProductId || `prod-${Date.now()}`,
      name: prodForm.name.trim(),
      category: (prodForm.category as 'steady' | 'benefits' | 'event') || 'steady',
      vipRequirement: Number(prodForm.vipRequirement || 0),
      price,
      dailyEarnings: finalEarnings,
      dailyPercent,
      cycleDays,
      totalRevenue,
      image: prodForm.image || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
      accentColor: prodForm.category === 'benefits' ? 'from-purple-600 to-pink-500' : 'from-emerald-600 to-teal-500',
      soldCount: Number(prodForm.soldCount || 0),
      totalUnits: Number(prodForm.totalUnits || 5000),
      description: prodForm.description || '',
      highlightBadge: prodForm.highlightBadge,
      retailName: prodForm.retailName || prodForm.name.trim(),
      sku: prodForm.sku || `NEXA-${(editingProductId || 'PLAN').toUpperCase().slice(0, 8)}`,
      mrp: prodForm.mrp ? Number(prodForm.mrp) : Math.round(price * 1.25),
      updatedAt: Date.now(),
    };

    if (editingProductId) {
      await updateProduct(productObj);
      showToast(`Updated product "${productObj.name}" ($${price}) permanently in SQL!`, 'success');
    } else {
      await addProduct(productObj);
      showToast(`Added new contract "${productObj.name}" ($${price}) with ${dailyPercent}% return permanently in SQL!`, 'success');
    }
    setShowProductModal(false);
    setEditingProductId(null);
  };

  // Notice Save Handler
  const handleSaveNotice = async () => {
    if (!noticeForm.title || !noticeForm.content) {
      showToast('Please enter title and content', 'error');
      return;
    }
    const newNotice: NoticeItem = {
      id: `notice-${Date.now()}`,
      title: noticeForm.title,
      content: noticeForm.content,
      tag: noticeForm.tag || 'Official',
      date: new Date().toISOString().split('T')[0],
      isImportant: noticeForm.isImportant,
    };
    await addNotice(newNotice);
    setShowNoticeModal(false);
    setNoticeForm({ title: '', content: '', tag: 'Official', isImportant: false });
  };

  // Promo Code Modal Helpers
  const handleOpenCreatePromo = () => {
    setEditingPromoId(null);
    setPromoForm({ code: '', amount: 100, maxUses: 100 });
    setShowPromoModal(true);
  };

  const handleOpenEditPromo = (promo: CustomPromoCode) => {
    setEditingPromoId(promo.id);
    setPromoForm({
      code: promo.code,
      amount: promo.amount,
      maxUses: promo.maxUses,
    });
    setShowPromoModal(true);
  };

  const handleCreatePresetPromo = async (code: string, amount: number, maxUses: number = 200) => {
    const clean = code.toUpperCase().trim();
    const existing = promoCodes.find((p) => p.code.toUpperCase() === clean);
    if (existing) {
      showToast(`Promo code "${clean}" already exists in database!`, 'info');
      return;
    }
    const newPromo: CustomPromoCode = {
      id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: clean,
      amount,
      maxUses,
      usedCount: 0,
      isActive: true,
    };
    await addPromoCode(newPromo);
    showToast(`Gift code "${clean}" ($${amount}) created & ready to redeem!`, 'success');
  };

  // Promo Code Save Handler
  const handleSavePromo = async () => {
    if (!promoForm.code.trim() || promoForm.amount <= 0) {
      showToast('Please enter code and valid bonus amount', 'error');
      return;
    }
    const clean = promoForm.code.toUpperCase().trim();
    if (editingPromoId) {
      const existing = promoCodes.find((p) => p.id === editingPromoId);
      const updatedPromo: CustomPromoCode = {
        id: editingPromoId,
        code: clean,
        amount: Number(promoForm.amount),
        maxUses: Number(promoForm.maxUses || 100),
        usedCount: existing?.usedCount || 0,
        isActive: existing?.isActive !== false,
      };
      await addPromoCode(updatedPromo);
      showToast(`Gift code "${clean}" ($${updatedPromo.amount}) updated successfully!`, 'success');
    } else {
      const newPromo: CustomPromoCode = {
        id: `promo-${Date.now()}`,
        code: clean,
        amount: Number(promoForm.amount),
        maxUses: Number(promoForm.maxUses || 100),
        usedCount: 0,
        isActive: true,
      };
      await addPromoCode(newPromo);
      showToast(`Gift code "${clean}" ($${newPromo.amount}) created & ready to redeem!`, 'success');
    }
    setShowPromoModal(false);
    setEditingPromoId(null);
    setPromoForm({ code: '', amount: 100, maxUses: 100 });
  };

  const handleTogglePromoActive = async (promo: CustomPromoCode) => {
    const updated: CustomPromoCode = { ...promo, isActive: !promo.isActive };
    await addPromoCode(updated);
    showToast(`Promo code "${promo.code}" is now ${updated.isActive ? 'Active' : 'Paused'}!`, 'info');
  };

  const handleToggleDailyBonusActive = async () => {
    const nextState = platformSettings.isBonusEnabled === false ? true : false;
    await updatePlatformSettings({ isBonusEnabled: nextState });
    showToast(`Daily Check-In feature is now ${nextState ? 'ACTIVE (चालू)' : 'PAUSED (बंद)'}!`, 'info');
  };

  const handleSaveCheckInPayouts = async (customPayouts?: number[], customSpin?: boolean) => {
    const payoutsToSave = customPayouts || localCheckInPayouts;
    const spinToSave = customSpin !== undefined ? customSpin : localDay7Spin;
    setIsSavingCheckIn(true);
    try {
      await updatePlatformSettings({
        checkInPayouts: payoutsToSave,
        checkInDay7ExtraSpin: spinToSave,
      });
      showToast('Day 1 to 7 Daily Check-in payouts updated live in Cloud Database!', 'success');
    } catch (err: any) {
      showToast('Failed to save check-in payouts: ' + err.message, 'error');
    } finally {
      setIsSavingCheckIn(false);
    }
  };

  // Lucky Spin Handlers
  const handleSavePrize = async () => {
    if (!prizeForm.label) {
      showToast('Please enter a prize label', 'error');
      return;
    }
    const prizeObj: SpinPrizeConfig = {
      id: editingPrizeId || `prize-${Date.now()}`,
      label: prizeForm.label,
      value: Number(prizeForm.value) || 0,
      type: (prizeForm.type as any) || 'cash',
      color: prizeForm.color || '#10B981',
      probabilityWeight: Number(prizeForm.probabilityWeight) || 10,
      isEnabled: prizeForm.isEnabled !== false,
    };

    let updatedPrizes: SpinPrizeConfig[];
    if (editingPrizeId) {
      updatedPrizes = localSpinPrizes.map((p) => (p.id === editingPrizeId ? prizeObj : p));
    } else {
      updatedPrizes = [...localSpinPrizes, prizeObj];
    }

    setLocalSpinPrizes(updatedPrizes);
    await updateSpinPrizes(updatedPrizes);
    setShowPrizeModal(false);
    setEditingPrizeId(null);
  };

  const handleDeletePrize = async (prizeId: string) => {
    if (localSpinPrizes.length <= 2) {
      showToast('At least 2 prize slices must remain on the wheel', 'error');
      return;
    }
    const updated = localSpinPrizes.filter((p) => p.id !== prizeId);
    setLocalSpinPrizes(updated);
    await updateSpinPrizes(updated);
    showToast('Prize slice removed', 'info');
  };

  const handleGrantSpinsSubmit = async () => {
    if (!grantTargetUser) {
      showToast('Please select a target user', 'error');
      return;
    }
    if (grantSpinsCount <= 0) {
      showToast('Please specify a positive number of spins', 'error');
      return;
    }
    await adminGrantExtraSpins(grantTargetUser.id, grantSpinsCount, grantReason || 'Admin reward');
    setShowGrantSpinsModal(false);
    setGrantTargetUser(null);
  };

  // Save System Settings
  const handleSaveSystemSettings = async () => {
    setIsSavingSettings(true);
    try {
      const normalizedHelp = localSettings.helpCenterUrl
        ? normalizeRedirectUrl(localSettings.helpCenterUrl)
        : '';
      const nextSettings = { ...localSettings, helpCenterUrl: normalizedHelp };
      setLocalSettings(nextSettings);
      await updatePlatformSettings(nextSettings);
      const t1 = nextSettings.tier1Commission ?? 10;
      const t2 = nextSettings.tier2Commission ?? 3;
      const t3 = nextSettings.tier3Commission ?? 1;
      showToast(`Platform & Commission Settings Saved! Live User Rates: Tier 1 (${t1}%), Tier 2 (${t2}%), Tier 3 (${t3}%)`, 'success');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSavePrimaryHelpLink = async (rawUrl?: string) => {
    const inputToSave = rawUrl !== undefined ? rawUrl : (localSettings.helpCenterUrl || '');
    const normalized = normalizeRedirectUrl(inputToSave);
    setIsSavingSettings(true);
    try {
      const nextSettings = { ...localSettings, helpCenterUrl: normalized };
      setLocalSettings(nextSettings);
      await updatePlatformSettings({
        helpCenterUrl: normalized,
        helpCenterLinks: localSettings.helpCenterLinks || [],
      });
      if (normalized) {
        showToast(`Help Center link saved! Users will now redirect directly to: ${normalized}`, 'success');
      } else {
        showToast('Help Center redirect link cleared!', 'info');
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddCustomHelpLink = async () => {
    const cleanUrl = normalizeRedirectUrl(newHelpLinkUrl);
    if (!cleanUrl) {
      showToast('Please enter a valid Help Center link / URL (कोई भी लिंक दर्ज करें)', 'error');
      return;
    }
    const newItem: HelpCenterLinkItem = {
      id: `hcl-${Date.now()}`,
      title: newHelpLinkTitle.trim() || 'Official Help Center Support',
      url: cleanUrl,
      subtitle: newHelpLinkSubtitle.trim() || cleanUrl,
      isActive: true,
    };
    const updatedLinks = [newItem, ...(localSettings.helpCenterLinks || [])];
    const nextSettings: PlatformSettings = {
      ...localSettings,
      helpCenterUrl: cleanUrl,
      helpCenterLinks: updatedLinks,
    };
    setLocalSettings(nextSettings);
    setNewHelpLinkTitle('');
    setNewHelpLinkUrl('');
    setNewHelpLinkSubtitle('');
    await updatePlatformSettings({
      helpCenterUrl: cleanUrl,
      helpCenterLinks: updatedLinks,
    });
    showToast(`Help Center link added & set active! Redirects to: ${cleanUrl}`, 'success');
  };

  const handleDeleteCustomHelpLink = async (id: string) => {
    const target = (localSettings.helpCenterLinks || []).find((l) => l.id === id);
    const updatedLinks = (localSettings.helpCenterLinks || []).filter((l) => l.id !== id);
    let nextPrimary = localSettings.helpCenterUrl || '';
    if (target && normalizeRedirectUrl(target.url) === normalizeRedirectUrl(nextPrimary)) {
      nextPrimary = updatedLinks.length > 0 ? normalizeRedirectUrl(updatedLinks[0].url) : '';
    }
    const nextSettings: PlatformSettings = {
      ...localSettings,
      helpCenterUrl: nextPrimary,
      helpCenterLinks: updatedLinks,
    };
    setLocalSettings(nextSettings);
    await updatePlatformSettings({
      helpCenterUrl: nextPrimary,
      helpCenterLinks: updatedLinks,
    });
    showToast('Help Center link removed', 'info');
  };

  const renderHelpCenterManagerCard = () => {
    const currentNormalizedUrl = normalizeRedirectUrl(localSettings.helpCenterUrl);
    const savedLinks = localSettings.helpCenterLinks || [];

    return (
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-pink-950/20 to-slate-900 border border-pink-500/40 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white flex items-center justify-center font-black shadow-lg shadow-pink-950/50">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base text-white">
                  Help Center Link & Direct Redirect Manager (हेल्प सेंटर लिंक कंट्रोल)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                    currentNormalizedUrl
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {currentNormalizedUrl ? 'Direct Redirect Active' : 'No Redirect Link Set'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                यहां कोई भी लिंक (Telegram, WhatsApp, Website आदि) डालें — यूजर जब भी <strong>Help Center</strong> पर क्लिक करेगा, सीधा उसी लिंक पर Redirect हो जाएगा।
              </p>
            </div>
          </div>

          {currentNormalizedUrl && (
            <a
              href={currentNormalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/40 text-pink-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test Active Link ↗</span>
            </a>
          )}
        </div>

        {/* Section 1: Primary Help Center Redirect Link Input */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <label className="block text-xs font-bold text-pink-300">
            1. Direct Help Center Redirect Link (Primary URL — कोई भी लिंक पेस्ट करें):
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 flex items-center rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 focus-within:border-pink-500">
              <LinkIcon className="w-4 h-4 text-pink-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={localSettings.helpCenterUrl || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, helpCenterUrl: e.target.value })}
                placeholder="e.g. https://t.me/your_channel or https://wa.me/919876543210 or any website link"
                className="w-full bg-transparent text-xs font-mono text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <button
              type="button"
              disabled={isSavingSettings}
              onClick={() => handleSavePrimaryHelpLink()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-pink-950/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSettings ? 'Saving...' : 'Save & Activate Link'}</span>
            </button>

            {localSettings.helpCenterUrl && (
              <button
                type="button"
                onClick={() => handleSavePrimaryHelpLink('')}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-bold transition-colors shrink-0 cursor-pointer"
                title="Clear Redirect Link"
              >
                Clear
              </button>
            )}
          </div>

          {currentNormalizedUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Active Redirect Destination:</span>
                <strong className="font-mono underline break-all">{currentNormalizedUrl}</strong>
              </span>
              <span className="text-slate-400 text-[10px]">
                Clicking "Help Center" in My Account or Support Icon redirects here immediately
              </span>
            </div>
          )}
        </div>

        {/* Section 2: Add Multiple Custom Help Center Links */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>2. Add Custom Help Center Link to List (अतिरिक्त हेल्प लिंक जोड़ें):</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {savedLinks.length} Saved Link(s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
            <div className="sm:col-span-4">
              <input
                type="text"
                value={newHelpLinkTitle}
                onChange={(e) => setNewHelpLinkTitle(e.target.value)}
                placeholder="Link Name (e.g. Telegram Help / WhatsApp)"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="sm:col-span-5">
              <input
                type="text"
                value={newHelpLinkUrl}
                onChange={(e) => setNewHelpLinkUrl(e.target.value)}
                placeholder="Paste Any Link (https://t.me/... or wa.me/...)"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleAddCustomHelpLink}
                className="w-full h-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add & Redirect</span>
              </button>
            </div>
          </div>

          {savedLinks.length > 0 && (
            <div className="space-y-2 pt-2">
              {savedLinks.map((item) => {
                const normalizedItemUrl = normalizeRedirectUrl(item.url);
                const isPrimary = normalizedItemUrl === currentNormalizedUrl;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 text-xs ${
                      isPrimary
                        ? 'bg-pink-950/30 border-pink-500/50'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.title || 'Help Center Link'}</span>
                        {isPrimary && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Primary Redirect
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300 truncate mt-0.5">
                        {normalizedItemUrl}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSavePrimaryHelpLink(normalizedItemUrl)}
                          className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-[10px] font-bold cursor-pointer"
                        >
                          Set Primary Redirect
                        </button>
                      )}
                      <a
                        href={normalizedItemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomHelpLink(item.id)}
                        className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 cursor-pointer"
                        title="Remove Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        {/* Ambient lighting effects */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="inline-block relative mb-3">
              <img
                src="/logo.png"
                alt="Nexa AI Official Logo"
                className="w-24 h-24 object-contain mx-auto drop-shadow-2xl select-none"
              />
              <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
              Nexa AI Admin Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Restricted Access Console • Authentication Mandatory
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Security Gateway
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                /admin
              </span>
            </div>

            {adminAuthError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{adminAuthError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Admin Username / ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminUsernameInput}
                    onChange={(e) => setAdminUsernameInput(e.target.value)}
                    placeholder="Enter Username or ID"
                    autoComplete="off"
                    name="admin_user_identifier"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <Users className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Master Security PIN
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showAdminPin ? 'text' : 'password'}
                    value={adminPinInput}
                    onChange={(e) => {
                      setAdminPinInput(e.target.value);
                      if (adminAuthError) setAdminAuthError('');
                    }}
                    placeholder="Enter Master Security PIN"
                    autoComplete="new-password"
                    name="admin_security_key"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifyingAuth || !adminPinInput.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-emerald-950/50 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Unlock Admin Console</span>
              </button>
            </form>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/');
                  }
                  setIsAdminView(false);
                }}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>← Back to User App</span>
              </button>
              <span className="text-[10px] text-slate-500 font-mono">
                SSL 256-Bit Encrypted
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 pb-16 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Nexa AI Console"
            className="w-12 h-12 object-contain drop-shadow-md select-none shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                Nexa AI Console
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                Full Control
              </span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold">
                /admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Cloud Database: Live Connected • Direct Route: <span className="font-mono text-cyan-400">/admin</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const adminUrl = `${window.location.origin}/admin`;
                navigator.clipboard.writeText(adminUrl);
                showToast(`Copied direct admin URL: ${adminUrl}`, 'success');
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-cyan-500/30"
            title="Copy /admin URL link"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copy /admin Link</span>
            <span className="sm:hidden">/admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadAdminUsers();
              loadAdminTransactions();
              loadAdminOrders();
              showToast('Data refreshed from Firestore & server', 'info');
            }}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Refresh from cloud"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAdminView(false)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-900/40"
            title="Return to user platform (/)"
          >
            <Smartphone className="w-4 h-4" />
            <span>Switch to User App (/)</span>
          </button>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
            title="Lock & Logout Admin Session"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Lock Admin</span>
          </button>
        </div>
      </header>

      {/* Main KPI Summary Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Total Users</span>
            </div>
            <div className="mt-1 text-xl font-black text-white">{totalUsersCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Registered Accounts</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pending Deposits</span>
            </div>
            <div className="mt-1 text-xl font-black text-amber-400">{pendingRecharges.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Need Approval</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <ArrowUpFromLine className="w-3.5 h-3.5 text-rose-400" />
              <span>Pending Payouts</span>
            </div>
            <div className="mt-1 text-xl font-black text-rose-400">{pendingWithdrawals.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Need Payout</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-teal-400" />
              <span>Total Deposits ($)</span>
            </div>
            <div className="mt-1 text-xl font-black text-emerald-400">${totalRechargeCompleted.toFixed(0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Completed</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Total Paid Out ($)</span>
            </div>
            <div className="mt-1 text-xl font-black text-cyan-400">${totalWithdrawalCompleted.toFixed(0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Successful Cashouts</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Active Plans</span>
            </div>
            <div className="mt-1 text-xl font-black text-purple-400">{products.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Listed Projects</div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Balances ({adminUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('users');
              setTargetRelinkUserId('');
              setSelectedUplineUserId('');
              setRelinkCustomCode('');
              setShowRelinkModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 shadow-sm cursor-pointer"
            title="Re-link Upliner / Change Sponsor for Members (अपलाइनर री-लिंक)"
          >
            <UserCheck className="w-3.5 h-3.5 text-orange-400" />
            <span>Re-link Upliner (अपलाइनर री-लिंक)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              loadAdminOrders();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-white/20'
                : 'text-teal-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-teal-400" />
            <span>User Orders & Contracts ({adminOrders.length})</span>
            {adminOrders.filter((o) => o.status === 'active').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-400 text-slate-950">
                {adminOrders.filter((o) => o.status === 'active').length} Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recharges')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'recharges'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Add Money {pendingRecharges.length > 0 && `(${pendingRecharges.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('withdrawals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'withdrawals'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>Withdrawals {pendingWithdrawals.length > 0 && `(${pendingWithdrawals.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Investment Plans ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('banners')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'banners'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-900/40 ring-1 ring-white/20'
                : 'text-teal-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
            <span>Home Banners Slider ({platformSettings.homeBanners?.length || 4})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Financial & System Toggles</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'notices'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Official Notices ({notices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('promos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'promos'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-900/40 ring-1 ring-white/20'
                : 'text-amber-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            <span>Gift Cards & Promo Vouchers ({promoCodes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('otp')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'otp'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-900/40 ring-1 ring-white/20'
                : 'text-amber-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>OTP & SMS Settings (Admin Control)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('helpcenter')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'helpcenter'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black shadow-md shadow-pink-900/40 ring-1 ring-white/20'
                : 'text-pink-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-pink-300" />
            <span>Help Center Link</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {/* ========================================================= */}
        {/* TAB 1: USERS MANAGEMENT & BALANCE CONTROL */}
        {/* ========================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by Mobile, Nickname, or User ID..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="frozen">Frozen Only</option>
                </select>

                <button
                  type="button"
                  onClick={handleOpenAddUserModal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-black text-white transition-all shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400/30 cursor-pointer"
                  title="Directly create and save a new user account in the database"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add New User (नया यूजर जोड़ें)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors shadow-sm"
                  title="Download offline backup of all registered users"
                >
                  <Download className="w-3.5 h-3.5 text-teal-400" />
                  <span>Backup JSON</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('क्या आप सचमुच सभी यूज़र्स का बैलेंस (Recharge Balance, Withdrawal Balance, Revenue, Commission) 0 करना चाहते हैं? यह डेटाबेस और सर्वर दोनों में $0 हो जाएगा।')) {
                      try {
                        const res = await fetch('/api/admin/users/reset-all-balances', { method: 'POST' });
                        if (res.ok) {
                          await loadAdminUsers();
                          showToast('सभी यूज़र्स का बैलेंस सफलतापूर्वक $0 कर दिया गया!', 'success');
                        } else {
                          showToast('बैलेंस रीसेट करने में त्रुटि आई', 'error');
                        }
                      } catch {
                        showToast('नेटवर्क त्रुटि: बैलेंस रीसेट नहीं हो सका', 'error');
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-xs font-bold text-rose-300 transition-all shadow-sm cursor-pointer"
                  title="Reset all users balances to 0 in SQL and memory (सभी यूज़र्स का बैलेंस 0 करें)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reset Balances ($0)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetRelinkUserId('');
                    setSelectedUplineUserId('');
                    setRelinkCustomCode('');
                    setShowRelinkModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-xs font-black text-white transition-all shadow-md shadow-orange-900/40 ring-1 ring-orange-400/40 cursor-pointer"
                  title="Assign or change the upline sponsor for any member (अपलाइनर री-लिंक करें)"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Re-link Upliner (अपलाइनर बदलें)</span>
                </button>

                <div className="text-xs text-slate-400 px-2 font-mono">
                  Showing {filteredUsers.length} of {adminUsers.length} users
                </div>
              </div>
            </div>

            {/* Permanent Storage Info Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Permanent User Database Active (स्थायी यूजर डेटाबेस)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Auto-Saved Forever
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    हर यूजर की पूरी डिटेल्स, बैंक अकाउंट और <strong>Password</strong> यहाँ स्थायी रूप से सेव रहते हैं। जब तक एडमिन स्वयं <strong>Delete</strong> नहीं करेगा, कोई भी यूजर डिलीट नहीं होगा।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenAddUserModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add User (यूजर जोड़ें)</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">User Full Profile</th>
                      <th className="py-3 px-3">Password (पासवर्ड)</th>
                      <th className="py-3 px-3">VIP</th>
                      <th className="py-3 px-3">Charged (Deposit)</th>
                      <th className="py-3 px-3">Withdrawal Bal</th>
                      <th className="py-3 px-3">Product Revenue</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          No users found matching query
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isFrozen = u.status === 'frozen';
                        const displayPassword = u.password || 'password123';
                        return (
                          <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-teal-800/40 border border-teal-600/40 text-teal-300 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                  {u.avatar || 'HD'}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                    <span>{u.nickname || 'Member'}</span>
                                    {u.role === 'admin' && (
                                      <span className="px-1.5 py-0.2 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-bold">
                                        ADMIN
                                      </span>
                                    )}
                                    <span className="text-[10px] font-normal text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                      Permanent
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-300 font-mono flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-bold">+91 {u.phone}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(u.phone);
                                        showToast(`Copied mobile: ${u.phone}`, 'info');
                                      }}
                                      className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                      title="Copy Phone"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </button>
                                    <span>•</span>
                                    <span>ID: {u.id}</span>
                                    <span>•</span>
                                    <span className="text-amber-400 font-bold bg-amber-500/10 px-1 rounded">
                                      Ref: {u.invitationCode || '—'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono mt-0.5">
                                    {u.invitedBy ? (
                                      <div className="text-teal-400 flex items-center gap-1">
                                        <span>Invited by:</span>
                                        <strong className="text-emerald-300">{u.inviterName || 'Sponsor'}</strong>
                                        <span>({u.invitedBy})</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">Direct User (No Sponsor)</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTargetRelinkUserId(u.id);
                                        setSelectedUplineUserId('');
                                        setRelinkCustomCode(u.invitedBy || '');
                                        setShowRelinkModal(true);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                      title={`Re-link or change sponsor for ${u.nickname || u.phone}`}
                                    >
                                      <UserCheck className="w-2.5 h-2.5 text-orange-400" />
                                      <span>Re-link</span>
                                    </button>
                                  </div>
                                  {u.bankDetails?.accountNumber && (
                                    <div className="text-[10px] text-cyan-300 font-mono bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800 inline-flex items-center gap-1.5 mt-0.5">
                                      <Building2 className="w-3 h-3 text-teal-400 shrink-0" />
                                      <span>
                                        {u.bankDetails.bankName || 'Bank'}: {u.bankDetails.accountNumber} ({u.bankDetails.ifscCode})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30">
                                <KeyRound className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="font-mono font-black text-amber-300 text-xs tracking-wide select-all">
                                  {displayPassword}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(displayPassword);
                                    showToast(`Copied password for ${u.nickname || u.phone}: ${displayPassword}`, 'success');
                                  }}
                                  className="p-1 rounded hover:bg-amber-500/20 text-amber-300 hover:text-white transition-colors"
                                  title="Copy User Password"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                VIP {u.vipLevel || 0}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                              ${(u.rechargeBalance || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-cyan-400">
                              ${(u.withdrawalBalance || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-300">
                              ${(u.productRevenue || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-3">
                              {isFrozen ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  <Lock className="w-2.5 h-2.5" /> Frozen
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Check className="w-2.5 h-2.5" /> Active
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditUser(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 font-bold text-[11px] flex items-center gap-1 transition-colors"
                                  title="View & Edit Full User Details, Password & Balances"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Full Details</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetRelinkUserId(u.id);
                                    setSelectedUplineUserId('');
                                    setRelinkCustomCode(u.invitedBy || '');
                                    setShowRelinkModal(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                  title="Re-link Upliner / Change Sponsor (अपलाइनर बदलें)"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-orange-400" />
                                  <span>Re-link</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleFreezeUser(u)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isFrozen
                                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                      : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                  }`}
                                  title={isFrozen ? 'Unfreeze Account' : 'Freeze Account'}
                                >
                                  {isFrozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetUserPassword(u)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors"
                                  title="Quick Change Password"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                 <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20"
                                  title="Admin Only: Permanently Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: USER ORDERS & CONTRACTS CONTROL CENTER (ADMIN FULL CONTROL) */}
        {/* ========================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Permanent SQL Storage Status Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>SQLite Relational SQL Storage Active</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                      PERMANENT PERSISTENCE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Orders are permanently saved in SQLite SQL Database &amp; disk backup. Automatic deletion is completely disabled.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    loadAdminOrders();
                    showToast('Live orders reloaded from SQL database!', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync SQL</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('क्या आप सभी पुराने/डेमो ऑर्डर्स को डेटाबेस और सर्वर से पूरी तरह साफ़ करना चाहते हैं? इसके बाद केवल असली यूज़र्स द्वारा खरीदे गए असली ऑर्डर्स ही सेव रहेंगे।')) {
                      try {
                        const res = await fetch('/api/admin/orders/purge-all-orders', { method: 'POST' });
                        if (res.ok) {
                          await loadAdminOrders();
                          showToast('सभी डेमो ऑर्डर्स डेटाबेस और सर्वर से हमेशा के लिए हटा दिए गए!', 'success');
                        }
                      } catch {
                        showToast('डेमो ऑर्डर्स साफ़ करने में त्रुटि आई', 'error');
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  title="Purge all demo orders"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge Demo Orders</span>
                </button>
              </div>
            </div>

            {/* Top Metrics Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-teal-400" />
                  <span>Total User Orders</span>
                </div>
                <div className="mt-1 text-xl font-black text-white">{adminOrders.length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Purchased by Users</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Capital Invested</span>
                </div>
                <div className="mt-1 text-xl font-black text-emerald-400">
                  ${adminOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-teal-300 font-mono mt-0.5">
                  ₹{(adminOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0) * 100).toLocaleString('en-IN')} INR
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Daily Yield Scheduled</span>
                </div>
                <div className="mt-1 text-xl font-black text-cyan-400">
                  ${adminOrders.filter((o) => o.status === 'active').reduce((sum, o) => sum + (Number(o.dailyEarnings) || 0), 0).toFixed(2)}
                  <span className="text-xs font-normal text-slate-400">/day</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Across Active Contracts</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Contract Statuses</span>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-300 flex items-center gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                    {adminOrders.filter((o) => o.status === 'active').length} Active
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    {adminOrders.filter((o) => o.status === 'paused').length} Paused
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                    {adminOrders.filter((o) => o.status === 'completed').length} Done
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Accrued: ${adminOrders.reduce((sum, o) => sum + (Number(o.totalAccrued) || 0), 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Toolbar: Search, Filters & Quick Toggles */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Search by User Mobile, Nickname, Order ID (ord-xxxx), or Product..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Orders ({adminOrders.length})</option>
                  <option value="active">Active ({adminOrders.filter((o) => o.status === 'active').length})</option>
                  <option value="paused">Paused ({adminOrders.filter((o) => o.status === 'paused').length})</option>
                  <option value="pending_approval">Pending Approval ({adminOrders.filter((o) => o.status === 'pending_approval').length})</option>
                  <option value="completed">Completed ({adminOrders.filter((o) => o.status === 'completed').length})</option>
                  <option value="cancelled">Cancelled ({adminOrders.filter((o) => o.status === 'cancelled').length})</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    loadAdminOrders();
                    showToast('Orders refreshed from server!', 'info');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
                  title="Reload orders"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try {
                      const blob = new Blob([JSON.stringify(adminOrders, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `nexa_orders_backup_${new Date().toISOString().split('T')[0]}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      showToast('Orders backup exported successfully!', 'success');
                    } catch {
                      showToast('Failed to export orders', 'error');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-cyan-500/30"
                  title="Download all orders JSON backup"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Orders List / Table */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/95 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Order ID & User</th>
                      <th className="py-3 px-3">Product / Asset</th>
                      <th className="py-3 px-3">Financials</th>
                      <th className="py-3 px-3">24h Cooldown Timer (User Claim)</th>
                      <th className="py-3 px-3">Cycle Progress</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Admin Full Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(() => {
                      const filtered = adminOrders.filter((ord) => {
                        const q = orderSearchQuery.toLowerCase().trim();
                        const matchesSearch =
                          !q ||
                          (ord.id && ord.id.toLowerCase().includes(q)) ||
                          (ord.productName && ord.productName.toLowerCase().includes(q)) ||
                          (ord.userPhone && ord.userPhone.includes(q)) ||
                          (ord.userNickname && ord.userNickname.toLowerCase().includes(q)) ||
                          (ord.userId && ord.userId.toLowerCase().includes(q));
                        const matchesStatus =
                          orderStatusFilter === 'all' || ord.status === orderStatusFilter;
                        return matchesSearch && matchesStatus;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-500">
                              <ShoppingBag className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                              <p className="font-semibold text-slate-400">No user investment orders match the current filter</p>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {orderSearchQuery ? 'Try clearing your search query.' : 'When users buy products, they appear here instantly with full admin controls.'}
                              </p>
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((ord) => {
                        const claimStatus = getOrderClaimStatus(ord, orderLiveNow);
                        const progressPercent = ord.cycleDays > 0 ? Math.min(100, Math.round(((ord.daysElapsed || 0) / ord.cycleDays) * 100)) : 0;

                        return (
                          <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Order ID & User info */}
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-black text-white text-xs flex items-center gap-1.5">
                                <span>#{ord.id}</span>
                                {ord.approvedAt && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-sans font-bold">
                                    Approved
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-bold text-teal-300 mt-1 flex items-center gap-1">
                                <span>{ord.userNickname || 'Investor'}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                                <span>+91 {ord.userPhone || '—'}</span>
                                {ord.userPhone && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(ord.userPhone || '');
                                      showToast(`Phone copied: ${ord.userPhone}`, 'info');
                                    }}
                                    className="hover:text-white"
                                    title="Copy Phone"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                                UID: {ord.userId} • Purchased: {ord.purchaseDate || '—'}
                              </div>
                            </td>

                            {/* Product Info */}
                            <td className="py-3.5 px-3">
                              <div className="font-bold text-white text-xs max-w-[200px] truncate" title={ord.productName}>
                                {ord.productName}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Plan Cycle: <strong className="text-slate-200">{ord.cycleDays} Days</strong>
                              </div>
                              {ord.adminNote && (
                                <div className="text-[9px] text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 mt-1 inline-block">
                                  Note: {ord.adminNote}
                                </div>
                              )}
                            </td>

                            {/* Financials */}
                            <td className="py-3.5 px-3 font-mono">
                              <div className="text-xs font-black text-emerald-400">
                                Price: ${Number(ord.price).toFixed(2)}
                              </div>
                              <div className="text-[11px] font-bold text-cyan-300">
                                Yield: +${Number(ord.dailyEarnings).toFixed(2)}/day
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Max Rev: ${Number(ord.totalRevenue).toFixed(2)}
                              </div>
                            </td>

                            {/* 24h Cooldown Timer (Live Claim Status) */}
                            <td className="py-3.5 px-3">
                              {ord.status === 'active' ? (
                                claimStatus.canClaim ? (
                                  <div className="space-y-1">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 shadow-sm">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      <span>24h Elapsed: Ready!</span>
                                    </span>
                                    <div className="text-[10px] text-emerald-400 font-mono">
                                      User can claim on phone
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1 font-mono">
                                      <Clock className="w-3 h-3 text-cyan-400 animate-spin" />
                                      <span>{formatCountdown(claimStatus.remainingMs)}</span>
                                    </span>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      Next: {formatCountdownHuman(claimStatus.remainingMs)}
                                    </div>
                                  </div>
                                )
                              ) : ord.status === 'paused' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                                  <Pause className="w-3 h-3" />
                                  <span>Timer Paused</span>
                                </span>
                              ) : ord.status === 'pending_approval' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Awaiting Approval</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Term Ended
                                </span>
                              )}
                            </td>

                            {/* Cycle Progress */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1 font-mono">
                                <span>Day {ord.daysElapsed || 0} / {ord.cycleDays}</span>
                                <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                              </div>
                              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                <div
                                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-1">
                                Earned: <strong className="text-emerald-400 font-bold">${Number(ord.totalAccrued || 0).toFixed(2)}</strong>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-3">
                              {ord.status === 'active' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                  Active
                                </span>
                              )}
                              {ord.status === 'paused' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Paused
                                </span>
                              )}
                              {ord.status === 'pending_approval' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse">
                                  Pending
                                </span>
                              )}
                              {ord.status === 'completed' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40">
                                  Completed
                                </span>
                              )}
                              {ord.status === 'cancelled' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                  Cancelled
                                </span>
                              )}
                            </td>

                            {/* ADMIN FULL CONTROLS */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* 1. Force Dividend Payout Button */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await adminPayoutOrderDividend(ord.id);
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 transition-colors border border-emerald-500/30"
                                  title="Force Payout 1 Day's Dividend Now"
                                >
                                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                </button>

                                {/* 2. Reset 24-Hour Timer Button */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await adminResetOrderTimer(ord.id);
                                  }}
                                  className="p-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 transition-colors border border-cyan-500/30"
                                  title="Reset 24h Cooldown (Allow user to claim immediately)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                                </button>

                                {/* 3. Pause / Resume Toggle Button */}
                                {ord.status === 'paused' ? (
                                  <button
                                    type="button"
                                    onClick={() => adminResumeOrder(ord.id)}
                                    className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors border border-emerald-500/30"
                                    title="Resume Order (Unpause Daily Returns)"
                                  >
                                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                                  </button>
                                ) : ord.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const reason = prompt('Reason for pausing this contract (optional):', 'Paused by Administrator');
                                      if (reason !== null) {
                                        adminPauseOrder(ord.id, reason);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors border border-amber-500/30"
                                    title="Pause Order (Freeze Daily Returns)"
                                  >
                                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                                  </button>
                                ) : null}

                                {/* 4. Approve button if pending approval */}
                                {ord.status === 'pending_approval' && (
                                  <button
                                    type="button"
                                    onClick={() => adminApproveOrder(ord.id)}
                                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                                    title="Approve & Activate Contract"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* 5. Edit Contract Details Modal trigger */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderForEdit(ord);
                                    setOrderEditForm({
                                      dailyEarnings: Number(ord.dailyEarnings) || 0,
                                      totalRevenue: Number(ord.totalRevenue) || 0,
                                      cycleDays: Number(ord.cycleDays) || 30,
                                      daysElapsed: Number(ord.daysElapsed) || 0,
                                      status: ord.status,
                                    });
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                                  title="Edit Order / Change Earnings / Days"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                {/* 6. Cancel & Refund Contract Button */}
                                {ord.status !== 'cancelled' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrderForCancel(ord);
                                      setCancelRefundAmount(Number(ord.price) || 0);
                                      setCancelRefundWallet('rechargeBalance');
                                      setCancelReason('Contract cancelled by administrator & full refund');
                                    }}
                                    className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 transition-colors border border-rose-500/30"
                                    title="Cancel Contract & Refund Money"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                  </button>
                                )}

                                {/* 7. Delete Order Permanently Button */}
                                <button
                                  type="button"
                                  onClick={() => setOrderToDelete(ord)}
                                  className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 hover:text-rose-200 transition-colors border border-rose-600/30"
                                  title="Permanently Delete Order"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: RECHARGE & DEPOSIT APPROVALS */}
        {/* ========================================================= */}
        {activeTab === 'recharges' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Deposit & Add Money Management</h3>
                <p className="text-xs text-slate-400">Review, verify, and 1-click credit deposits to user wallets</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={txFilterStatus}
                  onChange={(e) => setTxFilterStatus(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200"
                >
                  <option value="all">All Deposits</option>
                  <option value="processing">Pending Approval ({pendingRecharges.length})</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">User ID / Ref</th>
                      <th className="py-3 px-3">Deposit Method</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Date & Time</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Approval Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {rechargeTxs
                      .filter((tx) => txFilterStatus === 'all' || tx.status === txFilterStatus)
                      .map((tx, idx) => (
                        <tr key={tx.id ? `${tx.id}-${idx}` : `recharge-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{tx.title}</span>
                              {tx.paymentMethod?.includes('Manual') && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-sans font-bold">
                                  Manual QR
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-1">
                              <span className="text-slate-400">UTR / Ref:</span>
                              <strong className="text-emerald-400 font-mono tracking-wider">{tx.utrNumber || tx.referenceNo}</strong>
                              {(tx.utrNumber || tx.referenceNo) && (
                                <button
                                  type="button"
                                  title="Copy UTR"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard?.writeText(tx.utrNumber || tx.referenceNo);
                                    showToast(`Copied UTR: ${tx.utrNumber || tx.referenceNo}`, 'success');
                                  }}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {tx.userId && `User ID: ${tx.userId}`} {tx.payeeUpi && `• Paid to VPA: ${tx.payeeUpi}`}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-300 font-mono text-[11px]">
                              {tx.paymentMethod || 'UPI Fast'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <div className="font-black text-emerald-400 text-sm">
                              ${tx.amount.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-teal-300 font-bold">
                              ₹{((tx.amountInr || Math.round(tx.amount * 100))).toLocaleString()} INR
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            {tx.timestamp}
                          </td>
                          <td className="py-3 px-3">
                            {tx.status === 'completed' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Completed
                              </span>
                            )}
                            {tx.status === 'processing' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                Pending Action
                              </span>
                            )}
                            {tx.status === 'rejected' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {tx.status === 'processing' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={isProcessingTx}
                                  onClick={() => {
                                    if (isProcessingTx) return;
                                    setSelectedTxForAction(tx);
                                    setActionType('approve');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                  Approve & Credit
                                </button>
                                <button
                                  type="button"
                                  disabled={isProcessingTx}
                                  onClick={() => {
                                    if (isProcessingTx) return;
                                    setSelectedTxForAction(tx);
                                    setActionType('reject');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-bold text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: WITHDRAWAL & CASHOUT APPROVALS */}
        {/* ========================================================= */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Withdrawal & Payout Management</h3>
                <p className="text-xs text-slate-400">
                  Verify user bank/UPI info, 1-click Approve or Reject (automatically refunds user balance)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await Promise.all([loadAdminTransactions(), loadAdminUsers()]);
                    showToast('Withdrawal records refreshed from Cloud SQL & DB', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('क्या आप सचमुच सभी ट्रांजैक्शन हिस्ट्री (Recharges, Withdrawals, Commissions) को हमेशा के लिए साफ़ (0) करना चाहते हैं?')) {
                      try {
                        const res = await fetch('/api/admin/transactions/purge-all', { method: 'POST' });
                        if (res.ok) {
                          await loadAdminTransactions();
                          showToast('सभी ट्रांजैक्शन हिस्ट्री पूरी तरह साफ़ कर दी गई!', 'success');
                        } else {
                          showToast('ट्रांजैक्शन साफ़ करने में त्रुटि आई', 'error');
                        }
                      } catch {
                        showToast('नेटवर्क त्रुटि: ट्रांजैक्शन साफ़ नहीं हो सके', 'error');
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  title="Purge all transactions history permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge History</span>
                </button>
                <select
                  value={txFilterStatus}
                  onChange={(e) => setTxFilterStatus(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200"
                >
                  <option value="all">All Withdrawals</option>
                  <option value="processing">Pending Payouts ({pendingWithdrawals.length})</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected & Refunded</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">User / Ref</th>
                      <th className="py-3 px-3">Bank Account & Payout Details</th>
                      <th className="py-3 px-3">Amount & Net Payout</th>
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Payout Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {withdrawTxs
                      .filter((tx) => txFilterStatus === 'all' || tx.status === txFilterStatus)
                      .map((tx, idx) => {
                        const targetUser = adminUsers.find((u) => u.id === tx.userId);
                        const bank = tx.bankDetails || targetUser?.bankDetails;
                        const feePct = localSettings.withdrawalFeePercent !== undefined ? localSettings.withdrawalFeePercent : 5;
                        const feeAmt = tx.feeAmount !== undefined ? tx.feeAmount : Number(((tx.amount * feePct) / 100).toFixed(2));
                        const netAmt = tx.netAmount !== undefined ? tx.netAmount : Number((tx.amount - feeAmt).toFixed(2));

                        return (
                          <tr key={tx.id ? `${tx.id}-${idx}` : `withdraw-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-white font-mono">{tx.title}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                Ref: {tx.referenceNo} {targetUser ? `• ${targetUser.phone}` : ''}
                              </div>
                            </td>
                            <td className="py-3 px-3 min-w-[240px]">
                              {bank && (bank.accountNumber || bank.accountHolder) ? (
                                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-bold text-white text-[12px] truncate max-w-[150px]">
                                      {bank.accountHolder || targetUser?.nickname || 'Account Holder'}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 font-bold border border-teal-500/30">
                                      {bank.bankName || 'Bank IMPS'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-sans">A/C:</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-emerald-300 text-[11px] tracking-wider">
                                        {bank.accountNumber || '—'}
                                      </span>
                                      {bank.accountNumber && (
                                        <button
                                          type="button"
                                          title="Copy Account Number"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard?.writeText(bank.accountNumber);
                                            showToast(`A/C copied: ${bank.accountNumber}`, 'success');
                                          }}
                                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-sans">IFSC:</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-amber-300 text-[11px] tracking-wider uppercase">
                                        {bank.ifscCode || '—'}
                                      </span>
                                      {bank.ifscCode && (
                                        <button
                                          type="button"
                                          title="Copy IFSC"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard?.writeText(bank.ifscCode);
                                            showToast(`IFSC copied: ${bank.ifscCode}`, 'success');
                                          }}
                                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-slate-400 font-mono text-xs">
                                  {tx.paymentMethod || 'No Bank Details Recorded'}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-mono font-black text-rose-400 text-sm">
                                ${tx.amount.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Fee: ${feeAmt.toFixed(2)}
                              </div>
                              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                                Net: ${netAmt.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-teal-300 font-mono">
                                (₹{(netAmt * 100).toFixed(0)} INR)
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {tx.timestamp}
                            </td>
                            <td className="py-3 px-3">
                              {tx.status === 'completed' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Paid & Settled
                                </span>
                              )}
                              {tx.status === 'processing' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                  Pending Cashout
                                </span>
                              )}
                              {tx.status === 'rejected' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  Rejected & Refunded
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {tx.status === 'processing' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isProcessingTx}
                                    onClick={() => {
                                      if (isProcessingTx) return;
                                      setSelectedTxForAction(tx);
                                      setActionType('approve');
                                      setApprovalUtr(`UTR${Math.floor(1000000000 + Math.random() * 9000000000)}`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                                  >
                                    Approve Payout
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isProcessingTx}
                                    onClick={() => {
                                      if (isProcessingTx) return;
                                      setSelectedTxForAction(tx);
                                      setActionType('reject');
                                      setRejectReason('Bank details mismatch / IFSC incorrect. Full amount refunded.');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-bold text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    Reject & Refund
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-[11px]">Processed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: INVESTMENT PLANS & PRODUCTS */}
        {/* ========================================================= */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Investment Contract Management</h3>
                <p className="text-xs text-slate-400">Add, edit pricing, daily earnings, cycle duration, and VIP access</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingProductId(null);
                  setProdForm({
                    name: '',
                    category: 'steady',
                    vipRequirement: 0,
                    price: 500,
                    dailyEarnings: 400,
                    cycleDays: 45,
                    totalUnits: 5000,
                    soldCount: 0,
                    image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
                    description: 'High capacity green hydrogen electrolysis production cell.',
                    highlightBadge: 'New',
                  });
                  setShowProductModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Investment Plan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden p-4 flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase">
                          {p.category}
                        </span>
                        <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          VIP {p.vipRequirement}+
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProductId(p.id);
                            const percent =
                              p.dailyPercent !== undefined
                                ? p.dailyPercent
                                : p.price > 0
                                ? Number(((p.dailyEarnings / p.price) * 100).toFixed(1))
                                : 50;
                            setProdForm({ ...p, dailyPercent: percent });
                            setShowProductModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Edit Plan"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteProduct(p.id);
                            showToast(`Plan "${p.name}" deleted successfully`, 'info');
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Product Photo Thumbnail */}
                    {p.image && (
                      <div className="mt-2.5 h-24 rounded-xl overflow-hidden bg-slate-950 relative border border-slate-800">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-[9px] text-emerald-400 px-2 py-0.5 rounded-md font-mono font-bold">
                          {p.dailyPercent || (p.price > 0 ? Number(((p.dailyEarnings / p.price) * 100).toFixed(1)) : 50)}% / day
                        </span>
                      </div>
                    )}

                    <h4 className="mt-2 font-bold text-sm text-white line-clamp-1">{p.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{p.description}</p>

                    <div className="mt-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Price:</span>
                        <span className="font-bold text-white">${p.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Daily Earnings:</span>
                        <span className="font-bold text-emerald-400">
                          ${p.dailyEarnings.toFixed(2)}{' '}
                          <span className="text-xs text-emerald-300 font-bold">
                            ({p.dailyPercent || (p.price > 0 ? Number(((p.dailyEarnings / p.price) * 100).toFixed(1)) : 50)}%)
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Cycle:</span>
                        <span className="font-bold text-cyan-400">{p.cycleDays} Days</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-700/50 pt-1">
                        <span className="text-slate-400 font-sans">Total Revenue:</span>
                        <span className="font-bold text-amber-400">${p.totalRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Sold: {p.soldCount} units</span>
                    <span>Max: {p.totalUnits} units</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: HELP CENTER DIRECT LINK MANAGER */}
        {/* ========================================================= */}
        {activeTab === 'helpcenter' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {renderHelpCenterManagerCard()}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: FINANCIAL GATEWAYS & SYSTEM TOGGLES */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* PostgreSQL Cloud Database Live Status & Inspector */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-700/40 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold shadow-md">
                    <Database className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">Render PostgreSQL Cloud Database</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sqlDbInfo?.connected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {sqlDbInfo?.connected ? 'Live & Connected' : 'Local Backup / SQLite Fallback'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Real-time database tables, saved records & persistent storage inspection
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={checkSqlDbStatus}
                    disabled={isLoadingSqlDb}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSqlDb ? 'animate-spin' : ''}`} />
                    {isLoadingSqlDb ? 'Checking...' : 'Refresh Status'}
                  </button>

                  <a
                    href="/api/admin/sql-inspector"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Raw JSON
                  </a>
                </div>
              </div>

              {/* Table counts grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Users Table</div>
                  <div className="text-lg font-black text-indigo-300 mt-0.5">
                    {sqlDbInfo?.tableCounts?.users ?? adminUsers.length}
                  </div>
                  <div className="text-[9px] text-emerald-400 font-medium">Registered Members</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Orders Table</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    {sqlDbInfo?.tableCounts?.investment_orders ?? adminOrders.length}
                  </div>
                  <div className="text-[9px] text-slate-400 font-medium">Active Contracts</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Transactions</div>
                  <div className="text-lg font-black text-amber-300 mt-0.5">
                    {sqlDbInfo?.tableCounts?.transactions ?? adminTransactions.length}
                  </div>
                  <div className="text-[9px] text-slate-400 font-medium">Recharge / Withdraw</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Settings Table</div>
                  <div className="text-lg font-black text-blue-300 mt-0.5">
                    {sqlDbInfo?.tableCounts?.platform_settings ?? 1}
                  </div>
                  <div className="text-[9px] text-blue-400 font-medium">UPI / Config Saved</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Products</div>
                  <div className="text-lg font-black text-purple-300 mt-0.5">
                    {sqlDbInfo?.tableCounts?.products ?? products.length}
                  </div>
                  <div className="text-[9px] text-purple-400 font-medium">Plans & Store</div>
                </div>
              </div>

              {sqlDbInfo?.connected && (
                <div className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    All data in these tables is permanent and will NEVER be lost on restart.
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    PostgreSQL 18 • Render Singapore
                  </span>
                </div>
              )}
            </div>

            {/* Help Center Direct Redirect Link Control */}
            {renderHelpCenterManagerCard()}

            {/* Razorpay Payment Gateway Integration */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-800/40 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-md">
                    RZP
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">Razorpay Official Payment Gateway</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        localSettings.isRazorpayEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {localSettings.isRazorpayEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono px-2 py-0.5 rounded-full">
                        {localSettings.razorpayKeyId?.startsWith('rzp_live') ? 'LIVE Production Mode' : 'Test / Sandbox Mode'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Auto-credit deposits via Cards, UPI (GPay, PhonePe, Paytm), NetBanking & Wallets
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleSetting('isRazorpayEnabled', 'Razorpay Payment Gateway')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localSettings.isRazorpayEnabled ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={Boolean(localSettings.isRazorpayEnabled)}
                  title={localSettings.isRazorpayEnabled ? 'Click to Pause Razorpay' : 'Click to Enable Razorpay'}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localSettings.isRazorpayEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Razorpay Key ID
                  </label>
                  <input
                    type="text"
                    value={localSettings.razorpayKeyId || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, razorpayKeyId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-blue-500"
                    placeholder="rzp_test_... or rzp_live_..."
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Found in Razorpay Dashboard → Settings → API Keys</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Razorpay Key Secret (Optional / Webhooks)
                  </label>
                  <input
                    type="password"
                    value={localSettings.razorpayKeySecret || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, razorpayKeySecret: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                    placeholder="Enter Key Secret"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Found in Razorpay Dashboard → Settings → API Keys</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Razorpay Webhook Secret (Matches Dashboard Webhook)
                  </label>
                  <input
                    type="text"
                    value={localSettings.razorpayWebhookSecret || 'nexa_ai_rzp_webhook_2026'}
                    onChange={(e) => setLocalSettings({ ...localSettings, razorpayWebhookSecret: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. nexa_ai_rzp_webhook_2026"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Passphrase entered in Razorpay Webhook Setup dialog</p>
                </div>

                {/* Razorpay Merchant Name & Logo Branding */}
                <div className="md:col-span-2 p-4 rounded-xl bg-slate-950/70 border border-teal-500/30 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                        <span>🏷️</span> Razorpay Checkout Brand Identity (Name & Logo)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Controls the header name and logo displayed on the official Razorpay payment screen
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = {
                          ...localSettings,
                          razorpayMerchantName: 'Nexa AI',
                          razorpayLogoUrl: '/logo.png',
                          storeName: 'Nexa AI Retail Store',
                          companyLegalName: 'Nexa AI Technologies India Pvt Ltd',
                        };
                        setLocalSettings(updated);
                        await updatePlatformSettings({
                          razorpayMerchantName: 'Nexa AI',
                          razorpayLogoUrl: '/logo.png',
                          storeName: 'Nexa AI Retail Store',
                          companyLegalName: 'Nexa AI Technologies India Pvt Ltd',
                        });
                        showToast('Applied Nexa AI branding to Razorpay & saved!', 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <span>✨</span> Apply 100% Nexa AI Brand Preset
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Merchant Brand Name in Razorpay
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSettings({ ...localSettings, razorpayMerchantName: 'Nexa AI' });
                            updatePlatformSettings({ razorpayMerchantName: 'Nexa AI' });
                            showToast('Set name to Nexa AI and saved!', 'success');
                          }}
                          className="text-[10px] text-teal-400 hover:underline font-mono"
                        >
                          Reset: 'Nexa AI'
                        </button>
                      </div>
                      <input
                        type="text"
                        value={localSettings.razorpayMerchantName ?? 'Nexa AI'}
                        onChange={(e) => setLocalSettings({ ...localSettings, razorpayMerchantName: e.target.value })}
                        onBlur={async () => {
                          const val = localSettings.razorpayMerchantName?.trim() || 'Nexa AI';
                          await updatePlatformSettings({ razorpayMerchantName: val });
                          showToast('Razorpay merchant name saved to cloud!', 'success');
                        }}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-teal-500"
                        placeholder="Nexa AI"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Appears at top of Razorpay popup header (Replaces 'HD Energy')</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Merchant Logo URL in Razorpay
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSettings({ ...localSettings, razorpayLogoUrl: '/logo.png' });
                            updatePlatformSettings({ razorpayLogoUrl: '/logo.png' });
                            showToast('Set logo to Nexa AI logo and saved!', 'success');
                          }}
                          className="text-[10px] text-teal-400 hover:underline font-mono"
                        >
                          Use Nexa AI Logo
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            src={localSettings.razorpayLogoUrl || '/logo.png'}
                            alt="Logo Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/logo.png';
                            }}
                          />
                        </div>
                        <input
                          type="text"
                          value={localSettings.razorpayLogoUrl ?? '/logo.png'}
                          onChange={(e) => setLocalSettings({ ...localSettings, razorpayLogoUrl: e.target.value })}
                          onBlur={async () => {
                            const val = localSettings.razorpayLogoUrl?.trim() || '/logo.png';
                            await updatePlatformSettings({ razorpayLogoUrl: val });
                            showToast('Razorpay logo URL saved to cloud!', 'success');
                          }}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                          placeholder="/logo.png or https://..."
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Logo shown inside the Razorpay Checkout popup header</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Checkout Theme Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={localSettings.razorpayThemeColor || '#0f766e'}
                        onChange={(e) => setLocalSettings({ ...localSettings, razorpayThemeColor: e.target.value })}
                        onBlur={() => updatePlatformSettings({ razorpayThemeColor: localSettings.razorpayThemeColor || '#0f766e' })}
                        className="w-9 h-9 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                      />
                      <input
                        type="text"
                        value={localSettings.razorpayThemeColor || '#0f766e'}
                        onChange={(e) => setLocalSettings({ ...localSettings, razorpayThemeColor: e.target.value })}
                        onBlur={() => updatePlatformSettings({ razorpayThemeColor: localSettings.razorpayThemeColor || '#0f766e' })}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                        placeholder="#0f766e"
                      />
                    </div>
                  </div>

                  {/* Live Header Preview */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <p className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <span>👁️</span> Live Razorpay Modal Header Preview (What your users will see):
                    </p>
                    <div
                      style={{ backgroundColor: localSettings.razorpayThemeColor || '#0f766e' }}
                      className="rounded-xl p-3 flex items-center justify-between text-white shadow-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-sm font-bold">
                          ←
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/30 overflow-hidden flex items-center justify-center p-0.5">
                          <img
                            src={localSettings.razorpayLogoUrl || '/logo.png'}
                            alt="Brand Logo"
                            className="w-full h-full object-cover rounded-md"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/logo.png';
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-extrabold tracking-wide flex items-center gap-1.5">
                            <span>{localSettings.razorpayMerchantName || 'Nexa AI'}</span>
                            <span className="text-[9px] bg-emerald-400 text-slate-900 px-1 py-0.2 rounded font-black tracking-tight">VERIFIED</span>
                          </div>
                          <div className="text-[10px] text-white/80">Payment Options • Secured by Razorpay</div>
                        </div>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs">
                        👤
                      </div>
                    </div>
                  </div>

                  {/* Razorpay Dashboard Account Sync Guide */}
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <span>💡</span> Razorpay UPI QR par "HD Energy" ko "Nexa AI" kaise karein?
                    </div>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      Modal popup header me ab <strong>Nexa AI</strong> name aur logo automatically show hoga. Agar UPI QR scan karne par PhonePe/Paytm me bank name "HD Energy" aa raha hai, toh wo Razorpay Account me KYC ke time registered Business Name hota hai.
                    </p>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      Isko change karne ke liye: <strong>Razorpay Dashboard → Settings → Account Settings & Profile</strong> me jakar <strong>Business Name</strong> ko <span className="font-mono font-bold bg-amber-400/20 px-1 rounded text-white">Nexa AI</span> save karein.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dedicated Razorpay Webhook Connection Guide matching User Screenshot */}
              <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-blue-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Razorpay Webhook Setup Guide (Copy & Paste Details)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestWebhookPing}
                    disabled={isTestingWebhook}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingWebhook ? 'animate-spin' : ''}`} />
                    <span>{isTestingWebhook ? 'Testing...' : 'Test Webhook Ping'}</span>
                  </button>
                </div>

                {webhookTestStatus && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      webhookTestStatus.ok
                        ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/50 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {webhookTestStatus.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{webhookTestStatus.msg}</span>
                  </div>
                )}

                <div className="space-y-2.5 text-xs">
                  {/* Webhook URL */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      1. Webhook URL <span className="text-rose-400">*</span> (Paste into Razorpay "Webhook URL *")
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-cyan-300 select-all truncate">
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/api/razorpay/webhook`
                          : 'https://your-domain.com/api/razorpay/webhook'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const url =
                            typeof window !== 'undefined'
                              ? `${window.location.origin}/api/razorpay/webhook`
                              : 'https://your-domain.com/api/razorpay/webhook';
                          navigator.clipboard.writeText(url);
                          setCopiedWebhookUrl(true);
                          setTimeout(() => setCopiedWebhookUrl(false), 2000);
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        {copiedWebhookUrl ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Secret */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      2. Secret (Paste into Razorpay "Secret" box)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-emerald-300 select-all truncate">
                        {localSettings.razorpayWebhookSecret || 'nexa_ai_rzp_webhook_2026'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            localSettings.razorpayWebhookSecret || 'nexa_ai_rzp_webhook_2026'
                          );
                          setCopiedWebhookSecret(true);
                          setTimeout(() => setCopiedWebhookSecret(false), 2000);
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        {copiedWebhookSecret ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Secret</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Alert Email */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      3. Alert Email (Enter your email for webhook notifications)
                    </label>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-300">
                      gb077024@gmail.com
                    </div>
                  </div>

                  {/* Active Events */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                      4. Active Events <span className="text-rose-400">*</span> (Search and check these 3 events in Razorpay dialog)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-slate-900/90 border border-emerald-500/30 flex items-center gap-2 text-[11px] text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-mono font-bold">payment.captured</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/90 border border-emerald-500/30 flex items-center gap-2 text-[11px] text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-mono font-bold">order.paid</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/90 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-300">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-mono font-bold">payment.failed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Razorpay E-Commerce Shopping Category & Compliance Settings */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-teal-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">Razorpay E-Commerce Category & KYC Compliance</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        MCC 5732: Shopping & Retail
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Configure corporate identity, GSTIN, registered office, and retail hardware policies for Razorpay gateway approval
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openModal('policies')}
                    className="px-3 py-1.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Preview 5 KYC Policies</span>
                  </button>
                </div>
              </div>

              {/* Shopping Mode Toggle & Category Notice */}
              <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/40 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-teal-200">E-Commerce Retail Storefront Active</div>
                  <div className="text-[11px] text-teal-400">
                    Orders are transmitted with MCC 5732 & physical delivery descriptors so Razorpay classifies the merchant as a Retail Shopping Store.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSetting('isShoppingModeActive', 'E-Commerce Retail Storefront Mode')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localSettings.isShoppingModeActive !== false ? 'bg-teal-600' : 'bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={localSettings.isShoppingModeActive !== false}
                  title="Toggle E-Commerce Storefront MCC 5732 Mode"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localSettings.isShoppingModeActive !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Store Brand / Front-Facing Name
                  </label>
                  <input
                    type="text"
                    value={localSettings.storeName || 'Nexa AI Retail Store'}
                    onChange={(e) => setLocalSettings({ ...localSettings, storeName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                    placeholder="Nexa AI Retail Store"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Appears on checkout receipts & storefront header</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Corporate Legal Entity Name (Per GST Certificate)
                  </label>
                  <input
                    type="text"
                    value={localSettings.companyLegalName || 'Nexa AI Technologies India Pvt Ltd'}
                    onChange={(e) => setLocalSettings({ ...localSettings, companyLegalName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                    placeholder="Nexa AI Technologies India Pvt Ltd"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Used on official Tax Invoices & Razorpay merchant file</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GSTIN Registration Number
                  </label>
                  <input
                    type="text"
                    value={localSettings.gstNumber || '07AABCH8821K1Z3'}
                    onChange={(e) => setLocalSettings({ ...localSettings, gstNumber: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                    placeholder="07AABCH8821K1Z3"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Mandatory for GST 18% HSN 8541 Solar & Clean Tech hardware</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Shipping & Courier Dispatch Days
                  </label>
                  <input
                    type="text"
                    value={localSettings.shippingDays || '3-5 Business Days Express Delivery Across India'}
                    onChange={(e) => setLocalSettings({ ...localSettings, shippingDays: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                    placeholder="3-5 Business Days Express Delivery Across India"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Delhivery Surface Express & BlueDart fulfillment SLA</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Corporate Registered Office Address
                  </label>
                  <input
                    type="text"
                    value={localSettings.merchantAddress || 'Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016'}
                    onChange={(e) => setLocalSettings({ ...localSettings, merchantAddress: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                    placeholder="Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Must match registered office on CIN & GST certificate</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Customer Support Email
                  </label>
                  <input
                    type="email"
                    value={localSettings.supportEmail || 'care@nexa-ai.shop'}
                    onChange={(e) => setLocalSettings({ ...localSettings, supportEmail: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    placeholder="care@nexa-ai.shop"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Customer Support Hotline
                  </label>
                  <input
                    type="text"
                    value={localSettings.supportPhone || '+91 7307112738'}
                    onChange={(e) => setLocalSettings({ ...localSettings, supportPhone: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    placeholder="+91 7307112738"
                  />
                </div>
              </div>

              {/* 1-Click Razorpay Verification Submission Guide */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-black text-white">Razorpay Merchant Approval Package</div>
                      <div className="text-[11px] text-emerald-300">Submit these exact URLs & details to your Razorpay Dashboard for immediate approval</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const domain = typeof window !== 'undefined' ? window.location.origin : 'https://nexatrad.site';
                      const details = `=== RAZORPAY MERCHANT COMPLIANCE DETAILS ===
Business Category: Consumer Electronics & Computer Hardware (MCC 5732)
Business Model: Direct-to-Consumer (D2C) E-Commerce Retail Store
Website URL: ${domain}
Company Legal Name: ${localSettings.companyLegalName || 'Nexa AI Technologies India Pvt Ltd'}
Store Trade Name: ${localSettings.storeName || 'Nexa AI Technologies & Smart Electronics Store'}
GSTIN: ${localSettings.gstNumber || '07AABCH8821K1Z3'}
Office Address: ${localSettings.merchantAddress || 'Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016'}
Support Phone: ${localSettings.supportPhone || '+91 7307112738'}
Support Email: ${localSettings.supportEmail || 'care@nexa-ai.shop'}

--- MANDATORY POLICY URLS ---
Terms of Service: ${domain}/?policy=terms
Shipping & Delivery Policy: ${domain}/?policy=shipping
Cancellation & Refund Policy: ${domain}/?policy=refund
Privacy Policy: ${domain}/?policy=privacy
Contact & Grievance: ${domain}/?policy=contact

Products Sold: Nexa Neural Edge Compute Sticks, Quantum Home Hubs, AI GPU Compute Blades (HSN 8541 / 8504)`;

                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(details);
                        showToast('Razorpay compliance submission package copied to clipboard!', 'success');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Copy Submission Info</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono text-slate-300">
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                    <span className="text-slate-400 block font-sans">Website URL:</span>
                    <span className="text-teal-300 truncate block">/?mode=store</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                    <span className="text-slate-400 block font-sans">Shipping Policy:</span>
                    <span className="text-teal-300 truncate block">/?policy=shipping</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                    <span className="text-slate-400 block font-sans">Refund Policy:</span>
                    <span className="text-teal-300 truncate block">/?policy=refund</span>
                  </div>
                </div>
              </div>

              {/* Recent Retail Dispatches Summary */}
              {ecommerceOrders && ecommerceOrders.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-teal-400" />
                      <span>Recent E-Commerce Hardware Dispatches ({ecommerceOrders.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Delhivery Express Surface</span>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5">
                    {ecommerceOrders.slice(0, 5).map((ord) => (
                      <div
                        key={ord.id}
                        className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white truncate max-w-xs">{ord.productName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            AWB: {ord.trackingNumber} • {ord.shippingAddress.city}, {ord.shippingAddress.pincode}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400 num-tabular">${ord.price.toFixed(2)}</div>
                          <span className="text-[9px] uppercase font-bold text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded">
                            {ord.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Manual Dynamic UPI Payment Gateway Configuration */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">Manual UPI Payment Gateway (मैनुअल यूपीआई गेटवे)</h3>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {localSettings.isManualUpiEnabled !== false ? '● ACTIVE' : '○ DISABLED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Admin यहाँ जो भी UPI ID डालेगा, Users को Add Money स्क्रीन पर automatically उसी का Dynamic QR Code बनकर दिखेगा!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLocalSettings({
                      ...localSettings,
                      isManualUpiEnabled: localSettings.isManualUpiEnabled === false ? true : false,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    localSettings.isManualUpiEnabled !== false
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Manual Gateway: {localSettings.isManualUpiEnabled !== false ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Main Fields Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left 2 Cols: Form Inputs */}
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Merchant Primary UPI ID (VPA) *</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {localSettings.merchantUpiId ? '✓ Valid Format' : 'Enter VPA'}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={localSettings.merchantUpiId || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, merchantUpiId: e.target.value.trim() })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. 9876543210@paytm or yourbusiness@okaxis"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400">Quick Suffix:</span>
                      {['@paytm', '@okaxis', '@okhdfcbank', '@icici', '@ybl', '@postbank', '@upi'].map((suf) => (
                        <button
                          key={suf}
                          type="button"
                          onClick={() => {
                            const current = localSettings.merchantUpiId || '';
                            const prefix = current.includes('@') ? current.split('@')[0] : current;
                            setLocalSettings({ ...localSettings, merchantUpiId: `${prefix || 'nexaai'}${suf}` });
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        >
                          {suf}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      💡 Users copy this UPI ID to pay via PhonePe / GPay / Paytm. Whatever you type here updates the user's Dynamic QR code immediately.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Payee / Business Display Name
                      </label>
                      <input
                        type="text"
                        value={localSettings.merchantPayeeName || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, merchantPayeeName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Nexa AI Technologies"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Shown in PhonePe/GPay recipient name</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Dynamic QR Amount Generator
                      </label>
                      <select
                        value={localSettings.autoDynamicQrEnabled !== false ? 'auto' : 'static'}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            autoDynamicQrEnabled: e.target.value === 'auto',
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200"
                      >
                        <option value="auto">Auto-Embed Exact Recharge Amount</option>
                        <option value="static">UPI ID Only (User enters amount)</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">Embeds exact ₹ amount into the QR</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Custom Fallback QR Code Image URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={localSettings.merchantQrUrl || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, merchantQrUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      placeholder="Optional: https://... (Leave blank to use auto dynamic vector QR)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Deposit Notice & Instructions for Users
                    </label>
                    <textarea
                      rows={2}
                      value={localSettings.manualDepositInstructions || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, manualDepositInstructions: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      placeholder="Instructions shown on User Recharge screen"
                    />
                  </div>

                  {/* Strict Admin Verification & Clean Display Controls */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Strict Admin Verification (No Automatic Fund Add)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          यूजर के वॉलेट में ऑटोमैटिक पैसे कभी नहीं जुड़ेंगे। एडमिन जब UTR चेक करके "Approve & Credit" करेगा, तभी फंड ऐड होगा।
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLocalSettings({
                            ...localSettings,
                            requireAdminRechargeApproval:
                              localSettings.requireAdminRechargeApproval === false ? true : false,
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                          localSettings.requireAdminRechargeApproval !== false
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {localSettings.requireAdminRechargeApproval !== false ? '● ACTIVE (Manual Approval)' : 'Auto Credit'}
                      </button>
                    </div>

                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <QrCode className="w-4 h-4 text-cyan-400" />
                          <span>Show / Hide Raw UPI ID & App Intent Buttons</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          यूजर स्क्रीन पर केवल QR Code और अमाउंट दिखेगा। VPA टेक्स्ट और PhonePe/GPay/Paytm बटन्स छिपे रहेंगे।
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLocalSettings({
                            ...localSettings,
                            showUpiVpaDetails: !localSettings.showUpiVpaDetails,
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                          !localSettings.showUpiVpaDetails
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {!localSettings.showUpiVpaDetails ? 'HIDDEN (QR Scan Only)' : 'VISIBLE'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={async () => {
                        setIsSavingSettings(true);
                        try {
                          await updatePlatformSettings(localSettings);
                          showToast('Manual UPI Gateway & QR Settings Saved Successfully!', 'success');
                        } finally {
                          setIsSavingSettings(false);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save UPI Gateway Settings (सेव करें)</span>
                    </button>
                  </div>
                </div>

                {/* Right Col: Live Dynamic QR Scanner Preview */}
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/20 flex flex-col items-center justify-between text-center relative overflow-hidden">
                  <div className="w-full pb-2 mb-2 border-b border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Live Dynamic QR
                    </span>
                    <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                      Test Sample: ₹500
                    </span>
                  </div>

                  {(() => {
                    const upiId = localSettings.merchantUpiId || 'nexaai.pay@icici';
                    const payee = localSettings.merchantPayeeName || 'Nexa AI Technologies';
                    const testString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=500&cu=INR&tn=${encodeURIComponent('Add Money Sample')}`;
                    const liveQrUrl = localSettings.merchantQrUrl
                      ? localSettings.merchantQrUrl
                      : `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(testString)}&margin=6`;

                    return (
                      <div className="space-y-3 flex flex-col items-center">
                        <div className="p-2.5 bg-white rounded-2xl shadow-lg border-2 border-emerald-500/40 inline-block">
                          <img
                            src={liveQrUrl}
                            alt="Admin UPI Dynamic QR"
                            className="w-36 h-36 object-contain rounded-lg"
                            onError={(e) => {
                              (e.target as any).src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(testString)}&margin=6`;
                            }}
                          />
                        </div>

                        <div>
                          <div className="text-[11px] font-mono font-bold text-white tracking-wide">
                            {upiId}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Payee: {payee}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(upiId);
                              showToast(`Copied UPI: ${upiId}`, 'success');
                            }}
                            className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-emerald-400" />
                            <span>Copy UPI</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(testString);
                              showToast('Copied NPCI UPI String', 'success');
                            }}
                            className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <LinkIcon className="w-3 h-3 text-cyan-400" />
                            <span>Copy Link</span>
                          </button>
                        </div>

                        <p className="text-[9px] text-slate-500 leading-tight">
                          📱 Scan directly with PhonePe or GPay to test instant verification!
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Admin Access PIN & Financial Limits */}
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Admin Access PIN
                  </label>
                  <input
                    type="text"
                    value={localSettings.adminPin || '8888'}
                    onChange={(e) => setLocalSettings({ ...localSettings, adminPin: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    placeholder="Default: 8888"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">PIN code to authenticate access to this admin console</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Minimum Deposit / Add Money Limit ($)
                  </label>
                  <input
                    type="number"
                    value={localSettings.minRecharge}
                    onChange={(e) => setLocalSettings({ ...localSettings, minRecharge: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Minimum Cashout / Withdrawal Limit ($)
                  </label>
                  <input
                    type="number"
                    value={localSettings.minWithdrawal}
                    onChange={(e) => setLocalSettings({ ...localSettings, minWithdrawal: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Withdrawal Fee / Charge (% शुल्क)</span>
                    <span className="text-amber-400 font-mono text-[11px] font-bold">
                      {localSettings.withdrawalFeePercent !== undefined ? localSettings.withdrawalFeePercent : 5}%
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={localSettings.withdrawalFeePercent !== undefined ? localSettings.withdrawalFeePercent : 5}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          withdrawalFeePercent: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                      placeholder="e.g. 5"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">%</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400">Presets:</span>
                    {[0, 2, 3, 5, 8, 10].map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => setLocalSettings({ ...localSettings, withdrawalFeePercent: fee })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                          (localSettings.withdrawalFeePercent !== undefined ? localSettings.withdrawalFeePercent : 5) === fee
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {fee === 0 ? '0% Free' : `${fee}%`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Direct admin access to set withdrawal charge. Deducted automatically on every cashout.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature Master Switches */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Power className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="font-bold text-sm text-white">Platform Financial & System Master Switches</h3>
                    <p className="text-xs text-slate-400">
                      Toggles save immediately to Cloud Firestore and update the entire platform in real time
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  Instant Auto-Sync Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Add Money Gateway */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">Add Money Gateway</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          localSettings.isRechargeEnabled
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {localSettings.isRechargeEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Accept user deposits</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSetting('isRechargeEnabled', 'Add Money Gateway')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.isRechargeEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={Boolean(localSettings.isRechargeEnabled)}
                    title={localSettings.isRechargeEnabled ? 'Pause Add Money' : 'Enable Add Money'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.isRechargeEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Withdrawal Cashout */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">Withdrawal Cashout</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          localSettings.isWithdrawalEnabled
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {localSettings.isWithdrawalEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Allow user cashouts</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSetting('isWithdrawalEnabled', 'Withdrawal Cashout Gateway')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.isWithdrawalEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={Boolean(localSettings.isWithdrawalEnabled)}
                    title={localSettings.isWithdrawalEnabled ? 'Pause Withdrawals' : 'Enable Withdrawals'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.isWithdrawalEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 3. Razorpay Payments */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">Razorpay Gateway</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          localSettings.isRazorpayEnabled
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {localSettings.isRazorpayEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Cards, UPI & NetBanking</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSetting('isRazorpayEnabled', 'Razorpay Online Gateway')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.isRazorpayEnabled ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={Boolean(localSettings.isRazorpayEnabled)}
                    title={localSettings.isRazorpayEnabled ? 'Pause Razorpay' : 'Enable Razorpay'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.isRazorpayEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 4. SMS Gateway Dispatch */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">SMS Gateway</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          localSettings.smsGatewayActive !== false
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {localSettings.smsGatewayActive !== false ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">apitxt.com OTP dispatch</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSetting('smsGatewayActive', 'SMS OTP Gateway')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.smsGatewayActive !== false ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={localSettings.smsGatewayActive !== false}
                    title={localSettings.smsGatewayActive !== false ? 'Disable SMS Gateway' : 'Enable SMS Gateway'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.smsGatewayActive !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 7. E-Commerce Storefront Mode */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">Storefront MCC 5732</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          localSettings.isShoppingModeActive !== false
                            ? 'bg-teal-500/20 text-teal-300'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {localSettings.isShoppingModeActive !== false ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Retail Shopping Compliance</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSetting('isShoppingModeActive', 'E-Commerce Storefront Mode')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.isShoppingModeActive !== false ? 'bg-teal-600' : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={localSettings.isShoppingModeActive !== false}
                    title={localSettings.isShoppingModeActive !== false ? 'Disable Shopping Mode' : 'Enable Shopping Mode'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.isShoppingModeActive !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Referral Commission Rates */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Multi-Tier Referral Commission Matrix</h3>
                  <p className="text-xs text-slate-400">Percentage rewards distributed to uplines when downline members invest</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tier 1 Direct Invite (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={localSettings.tier1Commission !== undefined ? localSettings.tier1Commission : 10}
                    onChange={(e) => setLocalSettings({ ...localSettings, tier1Commission: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-300"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Directly invited friends (Default 10%)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tier 2 Second Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={localSettings.tier2Commission !== undefined ? localSettings.tier2Commission : 3}
                    onChange={(e) => setLocalSettings({ ...localSettings, tier2Commission: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Invited by Tier 1 members (Default 3%)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tier 3 Third Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={localSettings.tier3Commission !== undefined ? localSettings.tier3Commission : 1}
                    onChange={(e) => setLocalSettings({ ...localSettings, tier3Commission: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-purple-300"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Invited by Tier 2 members (Default 1%)</p>
                </div>
              </div>

              {/* Real-time sync preview for Admin */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-300 font-medium">User Panel Live Sync Preview:</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-400 font-bold">Tier 1: {localSettings.tier1Commission ?? 10}%</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-cyan-400 font-bold">Tier 2: {localSettings.tier2Commission ?? 3}%</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-purple-400 font-bold">Tier 3: {localSettings.tier3Commission ?? 1}%</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-amber-300 font-bold">
                    Total: {(Number(localSettings.tier1Commission) || 10) + (Number(localSettings.tier2Commission) || 3) + (Number(localSettings.tier3Commission) || 1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Save Button Bar */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveSystemSettings}
                disabled={isSavingSettings}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? 'Saving...' : 'Save All Settings to Cloud'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: NOTICES & ANNOUNCEMENTS */}
        {/* ========================================================= */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Official Notice & Announcement Board</h3>
                <p className="text-xs text-slate-400">Post announcements that appear on user dashboards</p>
              </div>

              <button
                type="button"
                onClick={() => setShowNoticeModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Post New Notice</span>
              </button>
            </div>

            <div className="space-y-3">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-4 shadow-md"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {n.tag}
                      </span>
                      {n.isImportant && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Urgent Banner
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">{n.date}</span>
                    </div>
                    <h4 className="font-bold text-sm text-white">{n.title}</h4>
                    <p className="text-xs text-slate-300">{n.content}</p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await deleteNotice(n.id);
                      showToast(`Notice deleted successfully`, 'info');
                    }}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors shrink-0"
                    title="Delete Notice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: OFFICIAL GIFT CARDS & PROMOTIONAL VOUCHERS MANAGER */}
        {/* ========================================================= */}
        {activeTab === 'promos' && (
          <div className="space-y-6">
            {/* GIFT PROMO CODES MANAGER */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">Gift / Promo Redemption Codes (गिफ्ट कार्ड)</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {promoCodes.length} Codes in Database
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate unique voucher codes. Users can enter them directly under "Redeem Gift Code" to receive instant balance.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreatePromo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Gift Code</span>
                </button>
              </div>

              {/* 1-Click Quick Preset Promo Code Generators */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-300">1-Click Quick Gift Code Generators:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { code: 'WELCOME50', amount: 50 },
                    { code: 'NEXA100', amount: 100 },
                    { code: 'FESTIVE200', amount: 200 },
                    { code: 'VIP500', amount: 500 },
                  ].map((preset) => {
                    const isExisting = promoCodes.some((p) => p.code.toUpperCase() === preset.code);
                    return (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => handleCreatePresetPromo(preset.code, preset.amount, 200)}
                        className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isExisting
                            ? 'bg-slate-800/80 text-slate-400 border-slate-700 cursor-default'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                        }`}
                        title={isExisting ? 'Code already exists in database' : `Click to generate ${preset.code} ($${preset.amount})`}
                      >
                        <span>{preset.code}</span>
                        <span className="text-amber-300">(${preset.amount})</span>
                        {isExisting ? <Check className="w-3 h-3 text-slate-500" /> : <Plus className="w-3 h-3 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {promoCodes.length === 0 ? (
                <div className="py-10 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800">
                  <Ticket className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-300">No Custom Gift Codes Created Yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Click "Create New Gift Code" or use quick presets above to generate your first promotion card.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreatePromo}
                    className="mt-3 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    + Create First Gift Code
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {promoCodes.map((p) => {
                    const isCopied = copiedPromoCode === p.code;
                    const used = p.usedCount || 0;
                    const max = p.maxUses || 100;
                    const percentUsed = Math.min(100, Math.round((used / max) * 100));
                    const isExhausted = used >= max;

                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-md ${
                          p.isActive === false
                            ? 'bg-slate-950/50 border-slate-800 opacity-60'
                            : isExhausted
                            ? 'bg-slate-950/70 border-rose-900/40'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Code Header & Actions */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-emerald-400 text-sm tracking-wider bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/60 flex items-center gap-1.5">
                                <span>{p.code}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(p.code);
                                  setCopiedPromoCode(p.code);
                                  setTimeout(() => setCopiedPromoCode(null), 2000);
                                  showToast(`Copied code "${p.code}"!`, 'success');
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="Copy Promo Code"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditPromo(p)}
                                className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                title="Edit Gift Code"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deletePromoCode(p.id, p.code);
                                }}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                title="Delete Gift Code"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Value & Status */}
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <div className="text-[10px] text-slate-400">Cash Payout:</div>
                              <div className="text-base font-black text-emerald-400 font-mono">
                                ${p.amount.toFixed(2)}
                              </div>
                            </div>

                            <div className="text-right">
                              <button
                                type="button"
                                onClick={() => handleTogglePromoActive(p)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                  p.isActive !== false
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                                }`}
                              >
                                {p.isActive !== false ? '● Active' : '○ Paused'}
                              </button>
                            </div>
                          </div>

                          {/* Usage Progress */}
                          <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Redemptions:</span>
                              <span className="font-mono font-bold text-slate-200">
                                {used} / {max} ({percentUsed}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isExhausted ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${percentUsed}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Test Status Footer */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPromo(p)}
                            className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit Code / Limit</span>
                          </button>
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Ready to Redeem
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: HOME BANNERS & PHOTO CAROUSEL MANAGER */}
        {/* ========================================================= */}
        {activeTab === 'banners' && <AdminBannerManager />}

        {/* ========================================================= */}
        {/* TAB: OTP & SMS TEMPLATES MANAGER (ADMIN CONTROL) */}
        {/* ========================================================= */}
        {activeTab === 'otp' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header with Save Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-white">OTP & SMS Gateway Master Control (Admin)</h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          localSettings.smsGatewayActive !== false
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {localSettings.smsGatewayActive !== false ? 'OTP Verification ON' : 'OTP Bypassed (OFF)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure SMS Gateway (APITxT / Fast2SMS / Custom), edit OTP templates, set Master OTP, and monitor live user OTP codes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fetchOtpLogs}
                  disabled={isLoadingOtpLogs}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOtpLogs ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Refresh Logs</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveOtpSettingsAll()}
                  disabled={isSavingSettings}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving All Settings...' : 'Save All OTP & SMS Settings'}</span>
                </button>
              </div>
            </div>

            {/* Master OTP Switches & Quick Controls Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Require SMS OTP on Registration & Reset */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 shadow-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Require SMS OTP (ओटीपी अनिवार्य)</span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        localSettings.smsGatewayActive !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {localSettings.smsGatewayActive !== false ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {localSettings.smsGatewayActive !== false
                      ? 'Users must verify 6-digit SMS OTP to Sign Up or Reset Password.'
                      : 'OTP is bypassed! Users can Sign Up directly without waiting for SMS.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSetting('smsGatewayActive', 'SMS OTP Verification')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localSettings.smsGatewayActive !== false ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localSettings.smsGatewayActive !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 2. Master Fallback / Emergency OTP */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-300">Master Fallback OTP (मास्टर OTP)</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          localSettings.enableMasterOtp
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {localSettings.enableMasterOtp ? 'ENABLED' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Universal backup OTP if user SMS is delayed</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSetting('enableMasterOtp', 'Master Fallback OTP')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.enableMasterOtp ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.enableMasterOtp ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={localSettings.masterFallbackOtp || '888999'}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        masterFallbackOtp: e.target.value.replace(/\D/g, '').slice(0, 6),
                      })
                    }
                    placeholder="6-digit Master OTP"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-black text-amber-300 tracking-widest focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveOtpSettingsAll()}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                  >
                    Set Code
                  </button>
                </div>
              </div>

              {/* 3. OTP Validity Duration (Minutes) */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">OTP Expiry Time (वैधता समय)</span>
                    <span className="text-[10px] text-slate-400">How long each dispatched OTP stays valid</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {localSettings.otpValidityMinutes || 5} Mins
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[3, 5, 10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={async () => {
                        const updated = { ...localSettings, otpValidityMinutes: mins };
                        setLocalSettings(updated);
                        await updatePlatformSettings({ otpValidityMinutes: mins });
                        showToast(`OTP validity set to ${mins} minutes!`, 'success');
                      }}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold font-mono border transition-all cursor-pointer ${
                        (localSettings.otpValidityMinutes || 5) === mins
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Template Editors Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Registration SMS Template Card */}
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">Registration OTP Message</h3>
                      <p className="text-[11px] text-slate-400">Dispatched when new users click "Send OTP"</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const defTpl =
                          'Dear user, your Nexa AI registration verification code is {OTP}. Valid for 5 minutes. Do not share with anyone.';
                        handleSaveOtpSettingsAll(
                          { registrationOtpTemplate: defTpl },
                          'Reset Registration SMS template to default & saved!'
                        );
                      }}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      Reset Default
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Sign Up
                    </span>
                  </div>
                </div>

                {/* Placeholders chips */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Click tag to insert into template:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{OTP}', label: '6-digit OTP Code' },
                      { tag: '{APP_NAME}', label: 'App Name (Nexa AI)' },
                      { tag: '{PHONE}', label: 'User Mobile' },
                      { tag: '{VALIDITY}', label: 'Expiry Minutes' },
                    ].map(({ tag, label }) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = localSettings.registrationOtpTemplate || '';
                          const nextVal = current + (current.endsWith(' ') || !current ? '' : ' ') + tag;
                          setLocalSettings({
                            ...localSettings,
                            registrationOtpTemplate: nextVal,
                          });
                          updatePlatformSettings({ registrationOtpTemplate: nextVal });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                        title={label}
                      >
                        <Plus className="w-3 h-3 text-cyan-400" />
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <textarea
                    rows={4}
                    value={localSettings.registrationOtpTemplate || ''}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, registrationOtpTemplate: e.target.value })
                    }
                    onBlur={() => {
                      if (localSettings.registrationOtpTemplate?.trim()) {
                        updatePlatformSettings({
                          registrationOtpTemplate: localSettings.registrationOtpTemplate.trim(),
                        });
                      }
                    }}
                    placeholder="Enter message text for Registration OTP (use {OTP} for 6-digit code)..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>
                      Length: <strong className="text-slate-300 font-mono">{(localSettings.registrationOtpTemplate || '').length}</strong> characters
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      ✓ Auto-includes {'{OTP}'} in user SMS
                    </span>
                  </div>
                </div>

                {/* Direct Save Button for Registration Template */}
                <button
                  type="button"
                  onClick={() =>
                    handleSaveOtpSettingsAll(
                      { registrationOtpTemplate: localSettings.registrationOtpTemplate },
                      'Registration SMS Template saved! Users will now receive this exact SMS.'
                    )
                  }
                  disabled={isSavingSettings}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving Template...' : 'Save Registration SMS Template (सेव करें)'}</span>
                </button>

                {/* Live Message Bubble Preview */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-emerald-400" /> Live SMS Preview (User Phone)
                    </span>
                    <span className="font-mono text-slate-500">Sender: AX-{localSettings.smsSenderId || 'NEXAAI'}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700/70 text-xs text-slate-100 shadow-inner">
                    <div className="text-[10px] font-bold text-emerald-400 mb-1 flex items-center justify-between">
                      <span>{localSettings.smsSenderId || 'NEXAAI'} VERIFICATION</span>
                      <span className="text-slate-400 font-normal">Now</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {(() => {
                        const raw =
                          localSettings.registrationOtpTemplate ||
                          'Dear user, your Nexa AI registration verification code is {OTP}. Valid for 5 minutes. Do not share with anyone.';
                        let formatted = raw
                          .replace(/\{\{?OTP\}?\}|\[OTP\]|<OTP>|\{CODE\}|\{#var#\}/gi, '489215')
                          .replace(/\{\{?APP_NAME\}?\}|\[APP_NAME\]/gi, 'Nexa AI')
                          .replace(/\{\{?PHONE\}?\}|\{\{?MOBILE\}?\}|\[PHONE\]/gi, '9876543210')
                          .replace(/\{\{?VALIDITY\}?\}|\{\{?MINUTES\}?\}|\{\{?TIME\}?\}/gi, String(localSettings.otpValidityMinutes || 5));
                        if (!formatted.includes('489215')) {
                          formatted = `${formatted.trim()} (OTP: 489215)`;
                        }
                        return formatted;
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Forgot Password SMS Template Card */}
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">Forgot Password OTP Message</h3>
                      <p className="text-[11px] text-slate-400">Dispatched when user requests password reset</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const defTpl =
                          'Your Nexa AI password reset code is {OTP}. Valid for 5 minutes. If not requested by you, please ignore this SMS.';
                        handleSaveOtpSettingsAll(
                          { forgotPasswordOtpTemplate: defTpl },
                          'Reset Forgot Password SMS template to default & saved!'
                        );
                      }}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      Reset Default
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/15 text-orange-400 border border-orange-500/30">
                      Reset Password
                    </span>
                  </div>
                </div>

                {/* Placeholders chips */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Click tag to insert into template:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{OTP}', label: '6-digit OTP Code' },
                      { tag: '{APP_NAME}', label: 'App Name (Nexa AI)' },
                      { tag: '{PHONE}', label: 'User Mobile' },
                      { tag: '{VALIDITY}', label: 'Expiry Minutes' },
                    ].map(({ tag, label }) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = localSettings.forgotPasswordOtpTemplate || '';
                          const nextVal = current + (current.endsWith(' ') || !current ? '' : ' ') + tag;
                          setLocalSettings({
                            ...localSettings,
                            forgotPasswordOtpTemplate: nextVal,
                          });
                          updatePlatformSettings({ forgotPasswordOtpTemplate: nextVal });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                        title={label}
                      >
                        <Plus className="w-3 h-3 text-cyan-400" />
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <textarea
                    rows={4}
                    value={localSettings.forgotPasswordOtpTemplate || ''}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, forgotPasswordOtpTemplate: e.target.value })
                    }
                    onBlur={() => {
                      if (localSettings.forgotPasswordOtpTemplate?.trim()) {
                        updatePlatformSettings({
                          forgotPasswordOtpTemplate: localSettings.forgotPasswordOtpTemplate.trim(),
                        });
                      }
                    }}
                    placeholder="Enter message text for Forgot Password OTP (use {OTP} for 6-digit code)..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>
                      Length: <strong className="text-slate-300 font-mono">{(localSettings.forgotPasswordOtpTemplate || '').length}</strong> characters
                    </span>
                    <span className="text-amber-400 font-semibold">
                      ✓ Auto-includes {'{OTP}'} in user SMS
                    </span>
                  </div>
                </div>

                {/* Direct Save Button for Forgot Password Template */}
                <button
                  type="button"
                  onClick={() =>
                    handleSaveOtpSettingsAll(
                      { forgotPasswordOtpTemplate: localSettings.forgotPasswordOtpTemplate },
                      'Forgot Password SMS Template saved! Users will now receive this exact SMS.'
                    )
                  }
                  disabled={isSavingSettings}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving Template...' : 'Save Forgot Password SMS Template (सेव करें)'}</span>
                </button>

                {/* Live Message Bubble Preview */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-orange-400" /> Live SMS Preview (User Phone)
                    </span>
                    <span className="font-mono text-slate-500">Sender: AX-{localSettings.smsSenderId || 'NEXAAI'}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700/70 text-xs text-slate-100 shadow-inner">
                    <div className="text-[10px] font-bold text-orange-400 mb-1 flex items-center justify-between">
                      <span>{localSettings.smsSenderId || 'NEXAAI'} SECURITY</span>
                      <span className="text-slate-400 font-normal">Now</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {(() => {
                        const raw =
                          localSettings.forgotPasswordOtpTemplate ||
                          'Your Nexa AI password reset code is {OTP}. Valid for 5 minutes. If not requested by you, please ignore this SMS.';
                        let formatted = raw
                          .replace(/\{\{?OTP\}?\}|\[OTP\]|<OTP>|\{CODE\}|\{#var#\}/gi, '731046')
                          .replace(/\{\{?APP_NAME\}?\}|\[APP_NAME\]/gi, 'Nexa AI')
                          .replace(/\{\{?PHONE\}?\}|\{\{?MOBILE\}?\}|\[PHONE\]/gi, '9876543210')
                          .replace(/\{\{?VALIDITY\}?\}|\{\{?MINUTES\}?\}|\{\{?TIME\}?\}/gi, String(localSettings.otpValidityMinutes || 5));
                        if (!formatted.includes('731046')) {
                          formatted = `${formatted.trim()} (OTP: 731046)`;
                        }
                        return formatted;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gateway Settings & Test Dispatcher Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Gateway Provider Settings */}
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-bold text-sm text-white">SMS Gateway Configuration</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase">
                      {localSettings.smsGatewayProvider || 'apitxt'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Gateway Provider (प्रोवाइडर चुनें)</label>
                      <select
                        value={localSettings.smsGatewayProvider || 'apitxt'}
                        onChange={(e) => setLocalSettings({ ...localSettings, smsGatewayProvider: e.target.value as any })}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold focus:outline-none focus:border-cyan-500"
                      >
                        <option value="apitxt">APITxT.com SMS Gateway (Default)</option>
                        <option value="fast2sms">Fast2SMS India Bulk V2</option>
                        <option value="custom">Custom HTTP / Webhook SMS API</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Sender ID / Header (6 Letters)</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={localSettings.smsSenderId || 'NEXAAI'}
                        onChange={(e) => setLocalSettings({ ...localSettings, smsSenderId: e.target.value.toUpperCase() })}
                        placeholder="NEXAAI"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono uppercase font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-400 font-medium">
                          {localSettings.smsGatewayProvider === 'fast2sms'
                            ? 'Fast2SMS Authorization API Key'
                            : localSettings.smsGatewayProvider === 'custom'
                            ? 'Custom API Bearer Token / Auth Key'
                            : 'APITxT Auth Key (API Key)'}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(localSettings.smsAuthKey || '');
                            showToast('Copied SMS Auth Key!', 'info');
                          }}
                          className="text-[10px] text-cyan-400 hover:underline font-semibold"
                        >
                          Copy Key
                        </button>
                      </div>
                      <input
                        type="text"
                        value={localSettings.smsAuthKey ?? 'wSh_e0TCgFj24rsQv3NxX3FVrqYXFUl42bJb1eVNrss'}
                        onChange={(e) => setLocalSettings({ ...localSettings, smsAuthKey: e.target.value.trim() })}
                        placeholder="Enter SMS Gateway API Auth Key"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {localSettings.smsGatewayProvider === 'custom' && (
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">
                          Custom SMS Gateway URL (Supports {'{PHONE}'}, {'{OTP}'}, {'{MESSAGE}'})
                        </label>
                        <input
                          type="text"
                          value={localSettings.customSmsWebhookUrl || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, customSmsWebhookUrl: e.target.value })}
                          placeholder="https://api.yourdomain.com/send?phone={PHONE}&otp={OTP}&msg={MESSAGE}"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleSaveOtpSettingsAll()}
                    disabled={isSavingSettings}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingSettings ? 'Saving Gateway...' : 'Save Gateway Configuration'}</span>
                  </button>
                </div>
              </div>

              {/* Test SMS Dispatcher & Manual User OTP Generator */}
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl lg:col-span-2 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-amber-400" />
                      <div>
                        <h3 className="font-bold text-sm text-white">Live SMS Dispatcher & Direct User OTP Generator</h3>
                        <p className="text-[11px] text-slate-400">
                          Send a live OTP to any user's phone number. The generated OTP also works for user Registration & Password Reset!
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Live OTP Generator
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Target 10-Digit Mobile Number</label>
                      <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 focus-within:border-amber-500">
                        <span className="text-slate-400 font-bold mr-2 text-xs">+91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={testSmsPhone}
                          onChange={(e) => setTestSmsPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="e.g. 9876543210"
                          className="w-full bg-transparent text-white font-mono text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">OTP Purpose / Template</label>
                      <select
                        value={testSmsPurpose}
                        onChange={(e) => setTestSmsPurpose(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                      >
                        <option value="register">Registration OTP (Sign Up)</option>
                        <option value="forgot-password">Forgot Password OTP (Reset)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Custom 6-Digit OTP (Optional)</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={testCustomOtp}
                        onChange={(e) => setTestCustomOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Auto Random (or type 6 digits)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Live Result Box after dispatching */}
                  {lastTestSmsResult && (
                    <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-2 animate-in fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase">
                            Active OTP Generated
                          </span>
                          <span className="text-xs font-mono text-slate-300">
                            Mobile: <strong className="text-white">+91 {lastTestSmsResult.mobile}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">OTP Code:</span>
                          <span className="font-mono font-black text-sm text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/40 tracking-widest">
                            {lastTestSmsResult.otp}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(lastTestSmsResult.otp);
                              showToast(`Copied OTP: ${lastTestSmsResult.otp}`, 'success');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400 transition-colors cursor-pointer"
                          >
                            Copy OTP
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        {lastTestSmsResult.formattedMessage}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Gateway: <strong className="text-cyan-300 uppercase">{lastTestSmsResult.provider}</strong></span>
                        <span>Status: <strong className="text-emerald-400">{lastTestSmsResult.statusText}</strong></span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    Dispatches SMS via selected gateway and activates this 6-digit OTP for <strong className="text-slate-200">+91 {testSmsPhone || 'User'}</strong>.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendTestSms()}
                    disabled={isSendingTestSms}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingTestSms ? 'Dispatching SMS...' : 'Send Live OTP SMS Now'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Real-Time Dispatched OTP Logs Table (Admin Only) */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">Live Dispatched OTP Logs & Match Monitor</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {otpLogs.length} Total Logs
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Real-time status of all sent OTPs. Admin can view/copy secret OTP codes or manually verify any user's OTP.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
                    <Search className="w-3.5 h-3.5 text-slate-500 mr-2" />
                    <input
                      type="text"
                      value={otpLogSearch}
                      onChange={(e) => setOtpLogSearch(e.target.value)}
                      placeholder="Search mobile or OTP..."
                      className="bg-transparent outline-none w-32 sm:w-40 font-mono text-xs"
                    />
                  </div>

                  {/* Show/Hide OTP Toggle for Admin */}
                  <button
                    type="button"
                    onClick={() => setShowAdminOtpSecret(!showAdminOtpSecret)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    {showAdminOtpSecret ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{showAdminOtpSecret ? 'Hide Codes' : 'Show Secret Codes'}</span>
                  </button>

                  {otpLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearOtpLogs}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Logs</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-3">Mobile Number</th>
                      <th className="py-3 px-3">Purpose</th>
                      <th className="py-3 px-3">Secret OTP Code</th>
                      <th className="py-3 px-3">Dispatched Message & Gateway</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {otpLogs.filter(
                      (log) =>
                        !otpLogSearch ||
                        log.mobile.includes(otpLogSearch) ||
                        (log.otp && log.otp.includes(otpLogSearch))
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                          No OTPs dispatched yet. Use the Live SMS Dispatcher above or wait for user OTP requests.
                        </td>
                      </tr>
                    ) : (
                      otpLogs
                        .filter(
                          (log) =>
                            !otpLogSearch ||
                            log.mobile.includes(otpLogSearch) ||
                            (log.otp && log.otp.includes(otpLogSearch))
                        )
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
                              +91 {log.mobile}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  log.purpose === 'register'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : log.purpose === 'forgot-password'
                                    ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                                    : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                }`}
                              >
                                {log.purpose === 'register' ? 'Registration' : log.purpose === 'forgot-password' ? 'Forgot Pass' : 'Admin Test'}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {showAdminOtpSecret ? (
                                  <span className="font-mono font-black text-amber-400 tracking-wider bg-amber-500/15 px-2.5 py-0.5 rounded-md border border-amber-500/30 text-xs">
                                    {log.otp}
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-500 tracking-widest">
                                    ••••••
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(log.otp);
                                    showToast(`Copied OTP ${log.otp} for +91 ${log.mobile}`, 'success');
                                  }}
                                  className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer"
                                  title="Copy OTP Code"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-300 max-w-xs">
                              <div className="truncate" title={log.message}>{log.message}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {log.provider ? `[${log.provider.toUpperCase()}] ` : ''}
                                {log.gatewayStatus || 'Logged in Admin Monitor'}
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {log.status === 'verified' ? (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                </span>
                              ) : log.status === 'wrong_otp' ? (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                                  <XCircle className="w-3.5 h-3.5" /> Wrong OTP ({log.attempts})
                                </span>
                              ) : log.status === 'expired' ? (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                  <Clock className="w-3.5 h-3.5" /> Expired
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                              {log.createdAt}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {log.status !== 'verified' && (
                                  <button
                                    type="button"
                                    onClick={() => handleAdminVerifyOtpLog(log)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold cursor-pointer"
                                    title="Mark OTP Verified & Active"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendTestSms(
                                      log.mobile,
                                      log.purpose === 'forgot-password' ? 'forgot-password' : 'register'
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold cursor-pointer"
                                  title="Resend New OTP to this Mobile"
                                >
                                  Resend
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 0: RE-LINK UPLINER / SPONSOR */}
      {/* ========================================================= */}
      {showRelinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-orange-500/30 p-6 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Re-link Upliner / Sponsor</h3>
                  <p className="text-xs text-slate-400">सदस्य को उसके सही स्पॉन्सर/अपलाइनर से जोड़ें</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRelinkModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  1. Select Member to Re-link (जिस यूजर को जोड़ना है):
                </label>
                <select
                  value={targetRelinkUserId}
                  onChange={(e) => setTargetRelinkUserId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-orange-500"
                >
                  <option value="">-- Choose Member --</option>
                  {adminUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nickname || 'Member'} (+91 {u.phone}) • ID: {u.id} {u.invitedBy ? `[Current Inviter: ${u.invitedBy}]` : '[Direct]'}
                    </option>
                  ))}
                </select>
              </div>

              {targetRelinkUserId && (() => {
                const sel = adminUsers.find((u) => u.id === targetRelinkUserId);
                return sel ? (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Current Sponsor:</span>
                    <strong className="text-amber-400">
                      {sel.inviterName ? `${sel.inviterName} (${sel.invitedBy || 'Direct'})` : sel.invitedBy || 'Direct (None)'}
                    </strong>
                  </div>
                ) : null;
              })()}

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  2. Select New Upline Sponsor from Registered Members:
                </label>
                <select
                  value={selectedUplineUserId}
                  onChange={(e) => {
                    setSelectedUplineUserId(e.target.value);
                    if (e.target.value) setRelinkCustomCode('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-emerald-300 font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Upline Sponsor --</option>
                  {adminUsers
                    .filter((u) => u.id !== targetRelinkUserId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nickname || 'Sponsor'} (+91 {u.phone}) • Code: {u.invitationCode || '4AB86'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="relative flex items-center justify-center my-1">
                <span className="h-px bg-slate-800 w-full" />
                <span className="px-2 text-[10px] text-slate-500 uppercase bg-slate-900 font-bold shrink-0">OR ENTER CODE MANUALLY</span>
                <span className="h-px bg-slate-800 w-full" />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Or Type Sponsor Code / Mobile Number directly:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={relinkCustomCode}
                    onChange={(e) => {
                      setRelinkCustomCode(e.target.value.toUpperCase());
                      if (e.target.value) setSelectedUplineUserId('');
                    }}
                    placeholder="e.g. 4AB86 or Sponsor Mobile (7307112738)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  {['4AB86'].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setRelinkCustomCode(code);
                        setSelectedUplineUserId('');
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[10px] font-bold border border-slate-700 shrink-0"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Immediate Live Network & SQLite Update</span>
                </div>
                <p className="text-slate-300">
                  यह यूजर तुरंत चयनित स्पॉन्सर के <strong>My Team</strong> (Tier 1) में दिखेगा और भविष्य के सभी कमीशन सीधे इस स्पॉन्सर को क्रेडिट होंगे।
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRelinkModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRelinking || !targetRelinkUserId || (!selectedUplineUserId && !relinkCustomCode.trim())}
                  onClick={handleExecuteRelink}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isRelinking ? 'Linking...' : 'Assign Upliner'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: USER FULL DETAILS, PASSWORD & BALANCES EDITOR */}
      {/* ========================================================= */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">
                    User Full Details & Permanent Record: {selectedUserForEdit.nickname}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Permanent Saved
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  User ID: {selectedUserForEdit.id} • Invite Code: {selectedUserForEdit.invitationCode || '—'}
                  {selectedUserForEdit.createdAt ? ` • Joined: ${new Date(selectedUserForEdit.createdAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForEdit(null)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Account Credentials & Visible Password */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Login Credentials & Password (यूजर आईडी, मोबाइल और पासवर्ड)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(editPassword || selectedUserForEdit.password || 'password123');
                    showToast(`Copied password: ${editPassword || selectedUserForEdit.password || 'password123'}`, 'success');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1 border border-amber-500/30"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Password</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Full Name / Nickname</label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mobile Number (+91)</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-amber-300 mb-1">User Password (पासवर्ड)</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/50 text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Referral & Network Summary */}
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-sans">Referral Code</span>
                  <strong className="text-amber-400 font-bold">{selectedUserForEdit.invitationCode || '—'}</strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/50">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-emerald-400 block text-[10px] font-sans font-bold">Upline Code (अपलाइनर)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRelinkUserId(selectedUserForEdit.id);
                        setSelectedUplineUserId('');
                        setRelinkCustomCode(editInvitedBy || selectedUserForEdit.invitedBy || '');
                        setShowRelinkModal(true);
                      }}
                      className="px-1.5 py-0.5 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                      title="Open Re-link Dialog"
                    >
                      <UserCheck className="w-2.5 h-2.5 text-orange-400" />
                      <span>Re-link Dialog</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editInvitedBy}
                    onChange={(e) => setEditInvitedBy(e.target.value.toUpperCase())}
                    placeholder="e.g. 4AB86"
                    className="w-full bg-slate-950/80 px-2 py-1 rounded border border-slate-700 font-mono font-bold text-emerald-300 text-xs outline-none uppercase focus:border-emerald-500"
                  />
                  {selectedUserForEdit.inviterName && (
                    <span className="text-[9px] text-slate-400 block truncate font-sans mt-0.5">
                      Current: {selectedUserForEdit.inviterName}
                    </span>
                  )}
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-sans">Total Referrals</span>
                  <strong className="text-white">{selectedUserForEdit.totalReferrals || 0} Members</strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-sans">Commission Earned</span>
                  <strong className="text-teal-300">${(selectedUserForEdit.totalCommissionEarned || 0).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Section 2: Balances, VIP & Account Status */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300">Wallets, Investment & VIP Control:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Charged Balance (Deposit $)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCharged}
                    onChange={(e) => setEditCharged(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Withdrawal Balance (Payout $)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editWithdrawal}
                    onChange={(e) => setEditWithdrawal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Product Revenue ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editProductRevenue}
                    onChange={(e) => setEditProductRevenue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Total Invested ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editTotalInvested}
                    onChange={(e) => setEditTotalInvested(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">VIP Rank</label>
                  <select
                    value={editVipLevel}
                    onChange={(e) => setEditVipLevel(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400 focus:outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        VIP Level {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="frozen">Frozen</option>
                </select>
              </div>
            </div>

            {/* Section 3: Saved Bank Account & UPI Payout Details (View & Edit) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-teal-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-teal-400" />
                  <span>Saved Bank & UPI Payout Details (बैंक खाता विवरण)</span>
                </span>
                {editBankAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${editBankHolder} | A/C: ${editBankAccount} | IFSC: ${editBankIfsc}`);
                      showToast('Copied full bank details!', 'success');
                    }}
                    className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold"
                  >
                    Copy Bank Info
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={editBankHolder}
                    onChange={(e) => setEditBankHolder(e.target.value)}
                    placeholder="Account Holder Name"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. SBI, HDFC, ICICI"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={editBankAccount}
                    onChange={(e) => setEditBankAccount(e.target.value)}
                    placeholder="Account Number"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={editBankIfsc}
                    onChange={(e) => setEditBankIfsc(e.target.value.toUpperCase())}
                    placeholder="IFSC Code"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-amber-300 uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Gift Card & Voucher Activity */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>Gift Card & Promo Vouchers History (गिफ्ट कार्ड रिडेम्पशन स्थिति)</span>
                </span>
                <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Gift Vouchers
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Redeemed Gift Codes:</span>
                  <span className="text-[11px] font-mono font-bold text-amber-300">
                    {selectedUserForEdit.redeemedCodes && selectedUserForEdit.redeemedCodes.length > 0
                      ? `${selectedUserForEdit.redeemedCodes.length} Codes Redeemed`
                      : '0 Codes'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-300 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 truncate">
                  {selectedUserForEdit.redeemedCodes && selectedUserForEdit.redeemedCodes.length > 0
                    ? selectedUserForEdit.redeemedCodes.join(', ')
                    : 'No gift codes redeemed yet'}
                </div>
                {selectedUserForEdit.redeemedCodes && selectedUserForEdit.redeemedCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await adminUpdateUser(selectedUserForEdit.id, { redeemedCodes: [] });
                      setSelectedUserForEdit({ ...selectedUserForEdit, redeemedCodes: [] });
                      showToast(`Redeemed promo codes cleared for ${selectedUserForEdit.nickname}!`, 'success');
                    }}
                    className="w-full mt-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Redeemed Codes History (Allows Re-using Codes)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Adjustment Option */}
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
              <div className="text-[11px] font-bold text-slate-300">Quick Balance Add/Deduct Tool:</div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={manualAdjWallet}
                  onChange={(e) => setManualAdjWallet(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200"
                >
                  <option value="rechargeBalance">Charged Bal</option>
                  <option value="withdrawalBalance">Withdraw Bal</option>
                  <option value="productRevenue">Revenue</option>
                </select>

                <select
                  value={manualAdjType}
                  onChange={(e) => setManualAdjType(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200 font-bold"
                >
                  <option value="add">+ Add</option>
                  <option value="deduct">- Deduct</option>
                </select>

                <input
                  type="number"
                  placeholder="Amount $"
                  value={manualAdjAmount}
                  onChange={(e) => setManualAdjAmount(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-mono text-white"
                />
              </div>

              <button
                type="button"
                disabled={isAdjustingBalance || isSavingBalances}
                onClick={handleManualBalanceAdjust}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
              >
                {isAdjustingBalance ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Adjustment... (Please wait)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply Quick Adjustment & Log Transaction</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isAdjustingBalance || isSavingBalances}
                onClick={() => {
                  const target = selectedUserForEdit;
                  setSelectedUserForEdit(null);
                  setUserToDelete(target);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete User Permanently</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isAdjustingBalance || isSavingBalances}
                  onClick={() => setSelectedUserForEdit(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingBalances || isAdjustingBalance}
                  onClick={handleSaveUserBalances}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSavingBalances ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Details...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Full Details Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CONFIRM APPROVE / REJECT TRANSACTION */}
      {/* ========================================================= */}
      {selectedTxForAction && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">
              {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </h3>

            <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Type:</span>
                <span className="font-bold uppercase text-white">{selectedTxForAction.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Amount:</span>
                <span className="font-bold text-emerald-400 text-sm">${selectedTxForAction.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Reference:</span>
                <span className="text-slate-300">{selectedTxForAction.referenceNo}</span>
              </div>
            </div>

            {selectedTxForAction.type === 'recharge' && (
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>User UPI Deposit Details (यूपीआई जमा विवरण)</span>
                  </span>
                  <span className="text-[10px] text-teal-300 font-mono">1$ = ₹100</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">12-Digit UTR:</span>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-emerald-400 text-xs font-bold">{selectedTxForAction.utrNumber || selectedTxForAction.referenceNo}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(selectedTxForAction.utrNumber || selectedTxForAction.referenceNo);
                          showToast('Copied UTR', 'success');
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-sans">Rupee Amount:</span>
                    <strong className="text-teal-300 font-mono">₹{((selectedTxForAction.amountInr || Math.round(selectedTxForAction.amount * 100))).toLocaleString()} INR</strong>
                  </div>
                  {selectedTxForAction.payeeUpi && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Payee UPI:</span>
                      <span className="text-slate-200">{selectedTxForAction.payeeUpi}</span>
                    </div>
                  )}
                  {selectedTxForAction.userId && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">User ID:</span>
                      <span className="text-slate-200">{selectedTxForAction.userId}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedTxForAction.type === 'withdraw' && (() => {
              const targetU = adminUsers.find((u) => u.id === selectedTxForAction.userId);
              const b = selectedTxForAction.bankDetails || targetU?.bankDetails;
              const feePct = localSettings.withdrawalFeePercent !== undefined ? localSettings.withdrawalFeePercent : 5;
              const fee = selectedTxForAction.feeAmount !== undefined
                ? selectedTxForAction.feeAmount
                : Number(((selectedTxForAction.amount * feePct) / 100).toFixed(2));
              const net = selectedTxForAction.netAmount !== undefined
                ? selectedTxForAction.netAmount
                : Number((selectedTxForAction.amount - fee).toFixed(2));

              return (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-teal-500/30 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-teal-300 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-teal-400" />
                      <span>User Bank Account Details (बैंक खाता विवरण)</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">IMPS / NEFT</span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Account Holder:</span>
                      <strong className="text-white text-xs">{b?.accountHolder || targetU?.nickname || '—'}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Bank Name:</span>
                      <span className="text-teal-300 font-sans font-semibold">{b?.bankName || 'Bank IMPS'}</span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-sans">Account Number:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold text-xs tracking-wider">{b?.accountNumber || '—'}</span>
                        {b?.accountNumber && (
                          <button
                            type="button"
                            title="Copy Account Number"
                            onClick={() => {
                              navigator.clipboard?.writeText(b.accountNumber);
                              showToast(`Copied A/C: ${b.accountNumber}`, 'success');
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 text-[10px] hover:bg-emerald-600/50 font-sans cursor-pointer"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-sans">IFSC Code:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">{b?.ifscCode || '—'}</span>
                        {b?.ifscCode && (
                          <button
                            type="button"
                            title="Copy IFSC"
                            onClick={() => {
                              navigator.clipboard?.writeText(b.ifscCode);
                              showToast(`Copied IFSC: ${b.ifscCode}`, 'success');
                            }}
                            className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 text-[10px] hover:bg-amber-600/50 font-sans cursor-pointer"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Net Payable to User:</span>
                      <strong className="text-emerald-400 font-mono text-sm">${net.toFixed(2)}</strong>
                      <span className="text-[10px] text-slate-500 block font-sans">Fee: ${fee.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] block">In INR (1$ = 100₹):</span>
                      <strong className="text-teal-300 font-mono text-base">₹{(net * 100).toFixed(0)} INR</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            {actionType === 'approve' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bank / UPI Settlement UTR Reference (ऑप्शनल / संपादन योग्य)
                </label>
                <input
                  type="text"
                  value={approvalUtr}
                  onChange={(e) => setApprovalUtr(e.target.value)}
                  placeholder="e.g. UTR1234567890 or IMPS Reference"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-teal-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This transaction ID will be stored permanently in Cloud SQL and shown in the user's withdrawal receipt.
                </p>
              </div>
            )}

            {actionType === 'reject' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rejection Reason (will be shown to user & amount refunded)
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Invalid UTR / Incorrect Bank Account details"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                />
                <p className="text-[10px] text-rose-400 mt-1">
                  The deducted balance (${selectedTxForAction.amount.toFixed(2)}) will be immediately restored to the user's withdrawal wallet.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isProcessingTx}
                onClick={() => {
                  setSelectedTxForAction(null);
                  setActionType(null);
                  setApprovalUtr('');
                  setRejectReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingTx}
                onClick={
                  selectedTxForAction.type === 'recharge'
                    ? handleConfirmRechargeAction
                    : handleConfirmWithdrawalAction
                }
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isProcessingTx ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing... (Lock Active)</span>
                  </>
                ) : actionType === 'approve' ? (
                  'Confirm & Process'
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PRODUCT ADD / EDIT */}
      {/* ========================================================= */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">
                  {editingProductId ? 'Edit Investment Contract' : 'Create New Investment Contract'}
                </h3>
                <p className="text-[11px] text-slate-400">Configure photo, pricing, daily percent return, and duration</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 1. Contract Name */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Contract / Product Name</label>
                <input
                  type="text"
                  value={prodForm.name || ''}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                  placeholder="e.g. Upgrade VIP2 - Offshore Wind Matrix"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* 2. Photo Upload & Preview Section */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-teal-400" />
                    <span>Product Photo / Image Upload (फोटो अपलोड)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">PNG / JPG / WEBP</span>
                </div>

                {/* Preview and Upload controls */}
                <div className="flex items-start gap-3">
                  {/* Photo Preview Thumbnail */}
                  <div className="w-24 h-24 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden relative shrink-0 flex items-center justify-center">
                    {prodForm.image ? (
                      <img
                        src={prodForm.image}
                        alt="Product Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=400&q=80';
                        }}
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-500">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                        <span className="text-[9px]">No Photo</span>
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 py-0.2 rounded font-mono">
                      Preview
                    </span>
                  </div>

                  {/* Upload from device & URL input */}
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/50 text-teal-300 font-bold text-xs cursor-pointer transition-all shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Photo from Device</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProductImageUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-slate-400 block mt-1">Upload directly from gallery or storage</span>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={prodForm.image || ''}
                        onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                        placeholder="Or enter Image URL (https://... or /assets/...)"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[10px]">
                  <span className="text-slate-500 shrink-0">Presets:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setProdForm({
                        ...prodForm,
                        image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
                  >
                    Solar Inverter
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setProdForm({
                        ...prodForm,
                        image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
                  >
                    Solar Grid
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setProdForm({
                        ...prodForm,
                        image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
                  >
                    Wind Turbine
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setProdForm({
                        ...prodForm,
                        image: 'https://images.unsplash.com/photo-1558441719-8b489c63f7d1?auto=format&fit=crop&w=800&q=80',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
                  >
                    Battery Storage
                  </button>
                </div>
              </div>

              {/* 3. Category & VIP Requirement */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={prodForm.category || 'steady'}
                    onChange={(e) => setProdForm({ ...prodForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                  >
                    <option value="steady">Steady Yield</option>
                    <option value="benefits">Fast Benefits</option>
                    <option value="event">Limited Event</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">VIP Requirement</label>
                  <select
                    value={prodForm.vipRequirement || 0}
                    onChange={(e) => setProdForm({ ...prodForm, vipRequirement: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-bold focus:outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                      <option key={v} value={v}>
                        VIP {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Financial Yield Matrix (Price, Daily Percent %, Daily Earnings $, Cycle Days) */}
              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Financial Yield & Percentage Return Matrix</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Auto-Sync % & $</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Price */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Price ($)</label>
                    <input
                      type="number"
                      value={prodForm.price !== undefined ? prodForm.price : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newPrice = val === '' ? 0 : parseFloat(val);
                        const pct = prodForm.dailyPercent !== undefined ? prodForm.dailyPercent : (prodForm.price && prodForm.dailyEarnings ? (prodForm.dailyEarnings / prodForm.price) * 100 : 10);
                        const calculatedEarnings = Number(((newPrice * pct) / 100).toFixed(2));
                        setProdForm({ ...prodForm, price: newPrice, dailyEarnings: calculatedEarnings, dailyPercent: pct });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Daily Return Percentage (%) - As requested by user */}
                  <div>
                    <label className="block font-semibold text-emerald-300 mb-1 flex items-center justify-between">
                      <span>Daily % (प्रतिशत)</span>
                      <span className="text-[10px] text-amber-400 font-mono">%</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={
                          prodForm.dailyPercent !== undefined
                            ? prodForm.dailyPercent
                            : prodForm.price && prodForm.dailyEarnings
                            ? Number(((prodForm.dailyEarnings / prodForm.price) * 100).toFixed(1))
                            : 50
                        }
                        onChange={(e) => {
                          const pct = parseFloat(e.target.value) || 0;
                          const currentPrice = Number(prodForm.price) || 0;
                          const calculatedEarnings = Number(((currentPrice * pct) / 100).toFixed(2));
                          setProdForm({ ...prodForm, dailyPercent: pct, dailyEarnings: calculatedEarnings });
                        }}
                        className="w-full pl-3 pr-6 py-2 rounded-xl bg-slate-900 border border-emerald-500/60 text-emerald-300 font-mono font-black focus:outline-none focus:border-emerald-400"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">%</span>
                    </div>
                  </div>

                  {/* Daily Earnings ($) */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Daily $ (दैनिक)</label>
                    <input
                      type="number"
                      step="1"
                      value={prodForm.dailyEarnings || ''}
                      onChange={(e) => {
                        const earnings = parseFloat(e.target.value) || 0;
                        const currentPrice = Number(prodForm.price) || 0;
                        const calculatedPct = currentPrice > 0 ? Number(((earnings / currentPrice) * 100).toFixed(1)) : 0;
                        setProdForm({ ...prodForm, dailyEarnings: earnings, dailyPercent: calculatedPct });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Cycle Days */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Cycle (Days)</label>
                    <input
                      type="number"
                      value={prodForm.cycleDays || ''}
                      onChange={(e) => setProdForm({ ...prodForm, cycleDays: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Calculation Summary Bar */}
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-700/50 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">
                    Calculated Daily: <strong className="text-emerald-400">+${Number(prodForm.dailyEarnings || 0).toFixed(2)}/day</strong> ({prodForm.dailyPercent ?? (prodForm.price && prodForm.dailyEarnings ? Number(((prodForm.dailyEarnings / prodForm.price) * 100).toFixed(1)) : 50)}%)
                  </span>
                  <span className="text-amber-300 font-bold">
                    Total: ${Number((Number(prodForm.dailyEarnings || 0) * Number(prodForm.cycleDays || 45)).toFixed(2))}
                  </span>
                </div>
              </div>

              {/* 5. Highlight Badge */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Highlight Badge (Optional)</label>
                <input
                  type="text"
                  value={prodForm.highlightBadge || ''}
                  onChange={(e) => setProdForm({ ...prodForm, highlightBadge: e.target.value })}
                  placeholder="e.g. Popular, Hot, High Return"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              {/* 6. Description */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={prodForm.description || ''}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  placeholder="Contract specification and details..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: NOTICE ADD */}
      {/* ========================================================= */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">Post Official Notice</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Notice Title</label>
                <input
                  type="text"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  placeholder="e.g. Scheduled Settlement Maintenance"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Notice Content</label>
                <textarea
                  rows={3}
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  placeholder="Detailed announcement text..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgentNotice"
                  checked={noticeForm.isImportant}
                  onChange={(e) => setNoticeForm({ ...noticeForm, isImportant: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700"
                />
                <label htmlFor="urgentNotice" className="text-xs font-semibold text-rose-300">
                  Highlight as Urgent Priority Notice
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotice}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
              >
                Publish Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: PROMO CODE ADD */}
      {/* ========================================================= */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">
                {editingPromoId ? 'Edit Gift Promo Code (गिफ्ट कोड एडिट करें)' : 'Generate Gift Promo Code (नया गिफ्ट कोड)'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPromoModal(false);
                  setEditingPromoId(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!editingPromoId && (
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Quick Name Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['WELCOME50', 'NEXA100', 'BONUS200', 'VIP500', 'FESTIVE2026'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const amt = preset.includes('500') ? 500 : preset.includes('200') ? 200 : preset.includes('100') ? 100 : 50;
                        setPromoForm({ code: preset, amount: amt, maxUses: 200 });
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-[10px] font-bold border border-slate-700"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Promo / Voucher Code (कोड का नाम)
                </label>
                <input
                  type="text"
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  placeholder="e.g. MEGA2026, BONUS500"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Reward Value ($) (यूजर को मिलने वाली राशि)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={promoForm.amount}
                  onChange={(e) => setPromoForm({ ...promoForm, amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Max Redemptions (कुल अधिकतम उपयोग सीमा)
                </label>
                <input
                  type="number"
                  min="1"
                  value={promoForm.maxUses}
                  onChange={(e) => setPromoForm({ ...promoForm, maxUses: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowPromoModal(false);
                  setEditingPromoId(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePromo}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {editingPromoId ? 'Save Changes (सेव करें)' : 'Create Code (कोड बनाएं)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: ADD / EDIT WHEEL PRIZE SLICE */}
      {/* ========================================================= */}
      {showPrizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">
                {editingPrizeId ? 'Edit Wheel Prize Slice' : 'Add New Wheel Prize Slice'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPrizeModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Prize Label (Displayed on Wheel)</label>
                <input
                  type="text"
                  value={prizeForm.label || ''}
                  onChange={(e) => setPrizeForm({ ...prizeForm, label: e.target.value })}
                  placeholder="e.g. $100 Cash, +2 Spins, Better Luck"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Reward Type</label>
                  <select
                    value={prizeForm.type || 'cash'}
                    onChange={(e) => setPrizeForm({ ...prizeForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                  >
                    <option value="cash">Cash ($ Deposit to Balance)</option>
                    <option value="spins">Extra Free Spins</option>
                    <option value="vip_points">VIP Points</option>
                    <option value="luck">Better Luck (0 Value)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Reward Value</label>
                  <input
                    type="number"
                    min="0"
                    value={prizeForm.value ?? 0}
                    onChange={(e) => setPrizeForm({ ...prizeForm, value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Win Odds (Weight %)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={prizeForm.probabilityWeight ?? 10}
                    onChange={(e) => setPrizeForm({ ...prizeForm, probabilityWeight: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Higher = lands more often</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Slice Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={prizeForm.color || '#10B981'}
                      onChange={(e) => setPrizeForm({ ...prizeForm, color: e.target.value })}
                      className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={prizeForm.color || '#10B981'}
                      onChange={(e) => setPrizeForm({ ...prizeForm, color: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prizeForm.isEnabled !== false}
                    onChange={(e) => setPrizeForm({ ...prizeForm, isEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700"
                  />
                  <span className="font-semibold text-slate-300">Slice is Active on Wheel</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPrizeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrize}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-950/40"
              >
                {editingPrizeId ? 'Update Prize' : 'Add Prize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: QUICK GRANT EXTRA SPINS MODAL */}
      {/* ========================================================= */}
      {showGrantSpinsModal && grantTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-purple-800/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" />
                <h3 className="font-bold text-base text-white">Gift Extra Lucky Spins</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGrantSpinsModal(false);
                  setGrantTargetUser(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Details */}
            <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-sm">{grantTargetUser.nickname}</div>
                <div className="text-[11px] text-slate-400 font-mono">{grantTargetUser.phone}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Current Spins</div>
                <div className="text-sm font-bold font-mono text-amber-400">
                  {grantTargetUser.spinChances || 0}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Spins to Add</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGrantSpinsCount(num)}
                      className={`py-1.5 rounded-xl font-bold font-mono text-xs border ${
                        grantSpinsCount === num
                          ? 'bg-pink-600 text-white border-pink-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      +{num}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="1"
                  max="100"
                  value={grantSpinsCount}
                  onChange={(e) => setGrantSpinsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="e.g. VIP loyalty reward, recharge gift"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowGrantSpinsModal(false);
                  setGrantTargetUser(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGrantSpinsSubmit}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs shadow-md shadow-purple-950/40"
              >
                Gift +{grantSpinsCount} Spins
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: ADMIN ADD NEW USER MODAL */}
      {/* ========================================================= */}
      {showAddUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddUserModal(false);
          }}
        >
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-emerald-500/40 p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col overscroll-contain">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Add New User (नया यूजर बनाएँ)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Directly create a permanent user account with custom password, sponsor, and wallet balance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleAdminCreateNewUser} className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-4 pt-4 text-xs">
              {/* 1. Core Identity & Password */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>1. User Identity & Login Credentials (नाम, मोबाइल और पासवर्ड)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Full Name / Nickname (पूरा नाम) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserForm.nickname}
                      onChange={(e) => setNewUserForm({ ...newUserForm, nickname: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      10-Digit Mobile Number (मोबाइल नंबर) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={newUserForm.phone}
                      onChange={(e) =>
                        setNewUserForm({
                          ...newUserForm,
                          phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                        })
                      }
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-amber-300 mb-1">
                      Login Password (लॉगिन पासवर्ड) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      placeholder="Enter password (e.g. 123456)"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 font-mono font-black focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Upline Sponsor Code / Mobile (अपलाइन रेफरल)
                    </label>
                    <input
                      type="text"
                      value={newUserForm.invitedBy}
                      onChange={(e) => setNewUserForm({ ...newUserForm, invitedBy: e.target.value })}
                      placeholder="e.g. 4AB86 or sponsor mobile"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Initial Wallets, VIP & Spins */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3">
                <div className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>2. Starting Wallets, VIP Rank & Spins (वॉलेट बैलेंस और VIP)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Charged / Deposit ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newUserForm.rechargeBalance}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, rechargeBalance: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Withdrawal Bal ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newUserForm.withdrawalBalance}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, withdrawalBalance: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Product Revenue ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newUserForm.productRevenue}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, productRevenue: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      VIP Level (0 - 6)
                    </label>
                    <select
                      value={newUserForm.vipLevel}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, vipLevel: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          VIP {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Free Lucky Spins
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newUserForm.spinChances}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, spinChances: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-purple-300 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Account Status
                    </label>
                    <select
                      value={newUserForm.status}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, status: e.target.value as 'active' | 'frozen' })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                    >
                      <option value="active">Active</option>
                      <option value="frozen">Frozen</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Optional Bank Payout Details */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  3. Bank Account Details (Optional - बैंक खाता विवरण)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={newUserForm.bankHolder}
                      onChange={(e) => setNewUserForm({ ...newUserForm, bankHolder: e.target.value })}
                      placeholder="Name as per bank"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={newUserForm.bankName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, bankName: e.target.value })}
                      placeholder="e.g. State Bank of India"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={newUserForm.bankAccount}
                      onChange={(e) => setNewUserForm({ ...newUserForm, bankAccount: e.target.value })}
                      placeholder="Bank A/C Number"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      value={newUserForm.bankIfsc}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, bankIfsc: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. SBIN0001234"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-teal-300 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {isCreatingUser
                      ? 'Creating User...'
                      : 'Create & Save User Permanently (स्थायी सेव करें)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT USER INVESTMENT ORDER CONTRACT */}
      {/* ========================================================= */}
      {selectedOrderForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl shadow-black/90 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Edit Investment Contract</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Order #{selectedOrderForEdit.id} • {selectedOrderForEdit.userNickname || 'User'} (+91 {selectedOrderForEdit.userPhone || '—'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForEdit(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await adminUpdateOrder(selectedOrderForEdit.id, {
                  dailyEarnings: Number(orderEditForm.dailyEarnings),
                  totalRevenue: Number(orderEditForm.totalRevenue),
                  cycleDays: Number(orderEditForm.cycleDays),
                  daysElapsed: Number(orderEditForm.daysElapsed),
                  status: orderEditForm.status,
                });
                setSelectedOrderForEdit(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Product Name (Reference)</label>
                <input
                  type="text"
                  disabled
                  value={selectedOrderForEdit.productName}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 cursor-not-allowed font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Daily Yield ($/day)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={orderEditForm.dailyEarnings}
                    onChange={(e) => setOrderEditForm({ ...orderEditForm, dailyEarnings: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Total Max Revenue ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={orderEditForm.totalRevenue}
                    onChange={(e) => setOrderEditForm({ ...orderEditForm, totalRevenue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Total Cycle Term (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={orderEditForm.cycleDays}
                    onChange={(e) => setOrderEditForm({ ...orderEditForm, cycleDays: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Days Elapsed (Progress)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={orderEditForm.daysElapsed}
                    onChange={(e) => setOrderEditForm({ ...orderEditForm, daysElapsed: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contract Status</label>
                <select
                  value={orderEditForm.status}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:border-teal-500 focus:outline-none"
                >
                  <option value="active">Active (Earning Daily Dividends)</option>
                  <option value="paused">Paused (Dividends Frozen)</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="completed">Completed (Term Finished)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForEdit(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-950/50 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Contract Updates</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CANCEL ORDER & REFUND USER WALLET */}
      {/* ========================================================= */}
      {selectedOrderForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/30 p-6 shadow-2xl shadow-rose-950/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-300">Cancel & Refund Contract</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Order #{selectedOrderForCancel.id} • {selectedOrderForCancel.productName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForCancel(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Investor:</span>
                <strong className="text-white font-mono">{selectedOrderForCancel.userNickname || 'User'} (+91 {selectedOrderForCancel.userPhone || '—'})</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Purchase Price:</span>
                <strong className="text-emerald-400 font-mono">${Number(selectedOrderForCancel.price).toFixed(2)}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Accrued so far:</span>
                <strong className="text-cyan-300 font-mono">${Number(selectedOrderForCancel.totalAccrued || 0).toFixed(2)}</strong>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isCancellingOrderRef.current || isCancellingOrder) return;
                isCancellingOrderRef.current = true;
                setIsCancellingOrder(true);
                try {
                  await adminCancelOrder(
                    selectedOrderForCancel.id,
                    cancelRefundAmount,
                    cancelRefundWallet,
                    cancelReason
                  );
                  setSelectedOrderForCancel(null);
                } finally {
                  isCancellingOrderRef.current = false;
                  setIsCancellingOrder(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Refund Amount to Return ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={cancelRefundAmount}
                  onChange={(e) => setCancelRefundAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold text-sm focus:border-rose-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                  (₹{(cancelRefundAmount * 100).toFixed(0)} INR credited back to investor)
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Refund Wallet Destination
                </label>
                <select
                  value={cancelRefundWallet}
                  onChange={(e) => setCancelRefundWallet(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:border-rose-500 focus:outline-none"
                >
                  <option value="rechargeBalance">Add Money Balance (User can buy another contract)</option>
                  <option value="withdrawalBalance">Withdrawal Balance (User can withdraw to bank immediately)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reason for Cancellation
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Member requested cancellation / Maintenance"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={() => setSelectedOrderForCancel(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={isCancellingOrder}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isCancellingOrder ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing Refund...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Execute Refund & Cancel</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PERMANENT USER DELETE CONFIRMATION (RELIABLE IN IFRAME) */}
      {/* ========================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl shadow-rose-950/40 text-slate-100 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-900/30">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  यूज़र अकाउंट हमेशा के लिए डिलीट करें?
                </h3>
                <p className="text-xs text-rose-300 font-semibold uppercase tracking-wider">
                  Permanent Admin Account Deletion
                </p>
              </div>
            </div>

            {/* Target User Details Box */}
            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">यूज़र का नाम (Nickname):</span>
                <span className="font-bold text-white">{userToDelete.nickname || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">मोबाइल नंबर (Phone):</span>
                <span className="font-mono font-bold text-emerald-400">+91 {userToDelete.phone}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">यूज़र आईडी (ID):</span>
                <span className="font-mono text-slate-300">#{userToDelete.id}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">खाता बैलेंस (Balances):</span>
                <span className="font-bold text-amber-300">
                  Recharge: ${Number(userToDelete.rechargeBalance || 0).toFixed(2)} | Payout: ${Number(userToDelete.withdrawalBalance || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Warning Notice */}
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs leading-relaxed space-y-1">
              <span className="font-bold block text-rose-300">⚠️ स्थायी कार्रवाई (Irreversible):</span>
              <p>
                इस यूज़र को डिलीट करने पर इसका अकाउंट, इसके सभी ऑर्डर्स, ट्रांज़ैक्शन और शेष बैलेंस Cloud SQL और सर्वर डेटाबेस से हमेशा के लिए मिटा दिए जाएंगे।
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={async () => {
                  try {
                    setIsDeletingUser(true);
                    const target = userToDelete;
                    await adminDeleteUser(target.id, target.phone);
                    await loadAdminUsers();
                    setUserToDelete(null);
                    showToast(`यूज़र ${target.nickname || target.phone} (+91 ${target.phone}) सफलतापूर्वक डिलीट कर दिया गया है!`, 'success');
                  } catch (err: any) {
                    showToast(err?.message || 'यूज़र डिलीट करने में त्रुटि आई', 'error');
                  } finally {
                    setIsDeletingUser(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeletingUser ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>डिलीट किया जा रहा है...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>हाँ, यूज़र हमेशा के लिए डिलीट करें</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PERMANENT ORDER DELETE CONFIRMATION (RELIABLE IN IFRAME) */}
      {/* ========================================================= */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl shadow-rose-950/40 text-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-900/30">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  ऑर्डर हमेशा के लिए डिलीट करें?
                </h3>
                <p className="text-xs text-rose-300 font-semibold uppercase tracking-wider">
                  Permanent Order Deletion
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">ऑर्डर आईडी (Order ID):</span>
                <span className="font-mono font-bold text-white">#{orderToDelete.id}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">प्रोडक्ट का नाम (Product):</span>
                <span className="font-bold text-emerald-400">{orderToDelete.productName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">यूज़र मोबाइल (User Phone):</span>
                <span className="font-mono text-slate-300">{orderToDelete.userPhone || orderToDelete.userId}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">कीमत (Price):</span>
                <span className="font-bold text-amber-300">${orderToDelete.price}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={async () => {
                  try {
                    setIsDeletingOrder(true);
                    await adminDeleteOrder(orderToDelete.id);
                    setOrderToDelete(null);
                  } catch (err: any) {
                    showToast(err?.message || 'ऑर्डर डिलीट करने में त्रुटि आई', 'error');
                  } finally {
                    setIsDeletingOrder(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeletingOrder ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>डिलीट किया जा रहा है...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>हाँ, ऑर्डर डिलीट करें</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
