import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { NetworkBackground } from './components/NetworkBackground';
import { Navigation } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { InvestView } from './components/InvestView';
import { NoticeView } from './components/NoticeView';
import { BlogView } from './components/BlogView';
import { AccountView } from './components/AccountView';
import { AuthScreen } from './components/AuthScreen';
import { AuthModal } from './components/AuthModal';
import { RechargeModal } from './components/RechargeModal';
import { WithdrawModal } from './components/WithdrawModal';
import { SpinWheelModal } from './components/SpinWheelModal';
import { CustomerSupportChat } from './components/CustomerSupportChat';
import { OrdersModal } from './components/OrdersModal';
import { TeamModal } from './components/TeamModal';
import { VipModal } from './components/VipModal';
import { BalanceLedgerModal } from './components/BalanceLedgerModal';
import { RewardsModal } from './components/RewardsModal';
import { AppDownloadModal } from './components/AppDownloadModal';
import { EcommercePoliciesModal } from './components/EcommercePoliciesModal';
import { EcommerceStorefront } from './components/EcommerceStorefront';
import { ProductPurchaseModal } from './components/ProductPurchaseModal';
import { PaymentFailedModal } from './components/PaymentFailedModal';
import { AdminPanel } from './components/AdminPanel';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    isAuthenticated,
    openModal,
    theme,
    activeTab,
    activeModal,
    selectedProductForInvest,
    toast,
    isAdminView,
    paymentFailedData,
  } = useApp();

  const isAnyModalOpen = Boolean(activeModal || selectedProductForInvest || paymentFailedData);

  // Lock background page scroll whenever any modal is open so only the active modal scrolls
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;

    if (isAnyModalOpen) {
      const scrollY = window.scrollY;
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
      return () => {
        body.style.overflow = '';
        body.style.overscrollBehavior = '';
        html.style.overflow = '';
        html.style.overscrollBehavior = '';
        window.scrollTo(0, scrollY);
      };
    } else {
      body.style.overflow = '';
      body.style.overscrollBehavior = '';
      html.style.overflow = '';
      html.style.overscrollBehavior = '';
    }
  }, [isAnyModalOpen]);

  // Reset scroll to top when switching main navigation tabs
  React.useEffect(() => {
    if (!isAnyModalOpen && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [activeTab, isAdminView]);

  const getRootThemeClasses = () => {
    switch (theme) {
      case 'obsidian-gold':
        return 'bg-slate-950 text-slate-100 dark';
      case 'cyber-hydrogen':
        return 'bg-slate-950 text-slate-100 dark';
      case 'teal-clean':
      default:
        return 'bg-[#e7f7f6] text-slate-800';
    }
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'invest':
        return <InvestView />;
      case 'notice':
        return <NoticeView />;
      case 'blog':
        return <BlogView />;
      case 'account':
        return <AccountView />;
      case 'home':
      default:
        return <HomeView />;
    }
  };

  if (isAdminView) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <AdminPanel />
        {toast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-teal-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  const [showPublicStore, setShowPublicStore] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      // Auto-detect Razorpay reviewers, compliance crawlers, or direct store parameters
      return (
        p.get('view') === 'store' ||
        p.get('mode') === 'store' ||
        p.get('store') === '1' ||
        p.get('source') === 'razorpay' ||
        p.get('audit') === 'true' ||
        p.get('compliance') === 'true' ||
        window.location.pathname.startsWith('/store') ||
        window.location.pathname.startsWith('/shop')
      );
    }
    return false;
  });

  // STRICT ACCESS CONTROL: When unauthenticated, show ONLY the Login / Sign Up page by default!
  // Outside visitors see the secure Login/Registration portal.
  // Razorpay compliance bots and reviewers can auto-access the store via link or query parameters.
  if (!isAuthenticated) {
    if (showPublicStore) {
      return (
        <div className="min-h-screen relative flex flex-col bg-slate-50 dark:bg-slate-950">
          <EcommerceStorefront onOpenLogin={() => setShowPublicStore(false)} />

          {/* Guest Modals */}
          {activeModal === 'auth' && <AuthModal />}
          {activeModal === 'support' && <CustomerSupportChat />}
          {activeModal === 'policies' && <EcommercePoliciesModal />}
          <PaymentFailedModal />
        </div>
      );
    }

    return (
      <div className={`min-h-screen relative flex flex-col items-center justify-start overflow-x-hidden transition-colors duration-500 ${getRootThemeClasses()}`}>
        <NetworkBackground theme={theme} />
        <div className="w-full max-w-md min-h-screen bg-white dark:bg-slate-900 shadow-2xl relative flex flex-col mx-auto overflow-x-hidden border-x border-slate-200/40 dark:border-slate-800/60 z-10 py-2">
          <main className="flex-1 w-full relative flex flex-col">
            <AuthScreen onOpenStore={() => setShowPublicStore(true)} />
          </main>
        </div>

        {/* Essential Modals accessible for guests (Support Chat & Legal Policies) */}
        {activeModal === 'support' && <CustomerSupportChat />}
        {activeModal === 'policies' && <EcommercePoliciesModal />}
        <PaymentFailedModal />

        {/* Global Toast Feedback */}
        {toast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-teal-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative flex flex-col items-center justify-start overflow-x-hidden transition-colors duration-500 ${getRootThemeClasses()}`}>
      {/* Animated Constellation Network Background */}
      <NetworkBackground theme={theme} />

      {/* Unified Mobile App Container (Same sleek mobile presentation for everyone, outer clutter removed) */}
      <div className="w-full max-w-md min-h-screen bg-white dark:bg-slate-900 shadow-2xl relative flex flex-col mx-auto overflow-x-hidden border-x border-slate-200/40 dark:border-slate-800/60 z-10">
        {/* Main Content Stage */}
        <main className="flex-1 w-full relative flex flex-col">
          {renderActiveView()}
        </main>

        {/* Bottom App Navigation Bar (Home, Store, Notice, Blog, Account) */}
        <Navigation />
      </div>

      {/* Dynamic Modals */}
      {activeModal === 'auth' && <AuthModal />}
      {activeModal === 'recharge' && <RechargeModal />}
      {activeModal === 'withdraw' && <WithdrawModal />}
      {activeModal === 'support' && <CustomerSupportChat />}
      {activeModal === 'orders' && <OrdersModal />}
      {activeModal === 'team' && <TeamModal />}
      {activeModal === 'vip' && <VipModal />}
      {activeModal === 'balance' && <BalanceLedgerModal />}
      {activeModal === 'rewards' && <RewardsModal />}
      {activeModal === 'download' && <AppDownloadModal />}
      {activeModal === 'policies' && <EcommercePoliciesModal />}
      <ProductPurchaseModal />
      <PaymentFailedModal />

      {/* Global Toast Feedback */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-teal-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
