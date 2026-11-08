import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  PhoneCall,
  Search,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  CreditCard,
  MapPin,
  Mail,
  Phone,
  User,
  Star,
  Info,
  Clock,
  Package,
  Layers,
  Cpu,
  Zap,
  ArrowRight,
  X,
  FileText,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InvestmentProduct } from '../types';
import { triggerOfficialPayUPayment } from '../services/payuService';

interface CheckoutFormState {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export const EcommerceStorefront: React.FC<{ onOpenLogin?: () => void }> = ({ onOpenLogin }) => {
  const {
    products,
    user,
    openModal,
    platformSettings,
    showToast,
    showPaymentFailedModal,
    investInProduct,
    setActiveTab,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCheckoutProduct, setActiveCheckoutProduct] = useState<InvestmentProduct | null>(null);
  const [activeSpecsProduct, setActiveSpecsProduct] = useState<InvestmentProduct | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [completedOrderDetails, setCompletedOrderDetails] = useState<{
    orderId: string;
    productName: string;
    amountInr: number;
    deliveryDate: string;
  } | null>(null);

  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormState>({
    fullName: user?.nickname || '',
    phone: user?.phone || '',
    email: user ? `${user.phone}@nexa-ai.shop` : '',
    address: 'Plot 12, Tech Innovation Zone, Sector 44',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122003',
  });

  const company = platformSettings.companyLegalName || 'Nexa AI Technologies India Pvt Ltd';
  const store = platformSettings.storeName || 'Nexa AI Technologies & Smart Electronics Store';
  const address =
    platformSettings.merchantAddress ||
    'Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016';
  const supportEmail = platformSettings.supportEmail || 'care@nexa-ai.shop';
  const supportPhone = platformSettings.supportPhone || '+91 7307112738';
  const gst = platformSettings.gstNumber || '07AABCH8821K1Z3';

  // Handle URL query parameters for direct Razorpay reviewer compliance verification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const policyParam = params.get('policy');
    if (policyParam) {
      openModal('policies');
    }
  }, [openModal]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      (p.retailName || p.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'sticks') return p.price <= 30;
    if (selectedCategory === 'hubs') return p.price > 30 && p.price <= 80;
    if (selectedCategory === 'enterprise') return p.price > 80;
    return true;
  });

  const handleStartCheckout = (product: InvestmentProduct) => {
    setActiveCheckoutProduct(product);
  };

  const handleProceedPayUCheckout = async () => {
    if (!activeCheckoutProduct) return;

    if (!checkoutForm.fullName.trim() || !checkoutForm.phone.trim()) {
      showToast('Please provide your full name and 10-digit mobile number for courier dispatch.', 'error');
      return;
    }

    const cleanPhone = checkoutForm.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showToast('Please enter a valid 10-digit mobile number for SMS tracking updates.', 'error');
      return;
    }

    setIsProcessingPayment(true);
    const inrAmount = Math.round(activeCheckoutProduct.price * 100);
    const orderNumber = `NX-ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const merchantKey = platformSettings.payuMerchantKey?.trim();
      const isCustomLiveKey = Boolean(merchantKey && merchantKey !== 'gtKFFx' && !merchantKey.toLowerCase().includes('test'));
      const merchantMode = (isCustomLiveKey || platformSettings.payuMode === 'live') ? 'live' : 'test';

      const res = await triggerOfficialPayUPayment({
        key: merchantKey,
        salt: platformSettings.payuMerchantSalt,
        mode: merchantMode,
        amount: inrAmount,
        usdAmount: activeCheckoutProduct.price,
        merchantName: store,
        themeColor: platformSettings.payuThemeColor || '#0f766e',
        userName: checkoutForm.fullName.trim(),
        userPhone: cleanPhone,
        userEmail: checkoutForm.email?.trim(),
        userId: user?.id || `guest_${cleanPhone.slice(-6)}`,
        purpose: 'product_purchase',
        productId: activeCheckoutProduct.id,
        productName: activeCheckoutProduct.retailName || activeCheckoutProduct.name,
        onSuccess: async (paymentId: string) => {
          setIsProcessingPayment(false);
          showToast(`Payment successful! Order ${orderNumber} is confirmed.`, 'success');

          // If logged in, also record in customer account
          if (user) {
            try {
              await investInProduct(activeCheckoutProduct);
            } catch (e) {
              console.warn('Customer account order link notice:', e);
            }
          }

          // Calculate delivery date (4 business days from now)
          const delivery = new Date();
          delivery.setDate(delivery.getDate() + 4);
          const formattedDate = delivery.toLocaleDateString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          setCompletedOrderDetails({
            orderId: orderNumber,
            productName: activeCheckoutProduct.retailName || activeCheckoutProduct.name,
            amountInr: inrAmount,
            deliveryDate: formattedDate,
          });

          setActiveCheckoutProduct(null);
        },
        onFailure: (reason: string) => {
          setIsProcessingPayment(false);
          showPaymentFailedModal({
            reason: reason || 'Payment was declined by issuing bank or user cancelled.',
            amountUsd: activeCheckoutProduct.price,
            amountInr: inrAmount,
            productName: activeCheckoutProduct.retailName || activeCheckoutProduct.name,
            onRetry: () => {
              handleProceedPayUCheckout();
            },
          });
        },
        onDismiss: () => {
          setIsProcessingPayment(false);
        },
      });

      if (!res.success && res.message) {
        setIsProcessingPayment(false);
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      setIsProcessingPayment(false);
      showToast(`Checkout initialization notice: ${err?.message || 'Error connecting to gateway'}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Top E-Commerce Announcement Bar */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 text-white text-[11px] py-2 px-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wider">
              Pan-India Free Shipping
            </span>
            <span>Express Courier Dispatch within 24-48 Hours across 28,000+ PIN Codes</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-teal-100">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              100% Genuine Certified Hardware
            </span>
            <span className="flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              7 Days Hassle-Free Returns
            </span>
            <span className="hidden md:inline font-mono text-teal-200">
              GST: {gst}
            </span>
          </div>
        </div>
      </div>

      {/* Main E-Commerce Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Nexa AI Logo"
              className="w-10 h-10 object-contain drop-shadow-sm shrink-0"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">
                  NEXA<span className="text-teal-600">AI</span>
                </span>
                <span className="bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  STORE
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none font-medium">
                Smart Edge Hardware & Neural Compute Devices
              </p>
            </div>
          </div>

          {/* Search Bar on Desktop */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search AI compute sticks, neural hubs, edge processors..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => openModal('policies')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>Policies</span>
            </button>

            <button
              type="button"
              onClick={() => openModal('support')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 text-teal-600" />
              <span>Support</span>
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Dashboard ({user.nickname || 'Member'})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (onOpenLogin ? onOpenLogin() : openModal('auth'))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Customer Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Showcase Banner */}
      <section className="bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950 py-8 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-700">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Direct Manufacturer Wholesale Pricing & GST Invoice</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Next-Gen <span className="text-teal-600 dark:text-teal-400">Edge AI Compute Hardware</span> & Smart Neural Hubs
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Power your embedded smart projects and IoT automation with industrial-grade AI accelerators.
              Backed by verified PayU 256-bit secure checkout, pan-India doorstep delivery, and 3-year replacement warranties.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>100% RBI-Compliant Gateway</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-teal-500" />
                <span>Delhivery & BlueDart Express</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <span>7-Day Return Guarantee</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                Featured Deal · 30% Off
              </div>
              <img
                src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
                alt="Nexa Neural Stick"
                className="w-full h-44 object-cover rounded-2xl mb-4 shadow"
              />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Nexa Neural Edge AI Stick 25W
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    16 TOPS Neural Coprocessor · USB 3.2 Type-C Plug-and-Play
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-teal-700 dark:text-teal-400">
                    ₹2,500
                  </div>
                  <div className="text-xs text-slate-400 line-through">
                    ₹3,500
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  In Stock (428 units ready to ship)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const firstProd = products.find((p) => p.price === 25) || products[0];
                    if (firstProd) handleStartCheckout(firstProd);
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow hover:shadow-md transition-all flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Buy Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Tabs & Product Catalog */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Hardware Catalog & Compute Devices
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select any unit to inspect technical specifications or proceed directly to PayU checkout.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              All Hardware ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('sticks')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'sticks'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Neural Sticks
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('hubs')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'hubs'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Edge AI Hubs
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('enterprise')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'enterprise'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Enterprise Blades
            </button>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const inrPrice = Math.round(product.price * 100);
            const inrMrp = Math.round((product.mrp || product.price * 1.4) * 100);
            const discountPercent = Math.round(((inrMrp - inrPrice) / inrMrp) * 100);

            return (
              <div
                key={product.id}
                className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group"
              >
                {/* Product Image & Badges */}
                <div className="relative h-48 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.retailName || product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    <span className="bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-md tracking-wider">
                      {product.sku || `NX-${product.price}`}
                    </span>
                    {product.highlightBadge && (
                      <span className="bg-teal-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                        {product.highlightBadge}
                      </span>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow">
                    {discountPercent}% OFF
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {product.retailName || product.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Hardware Specifications Badges */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 font-medium">
                        <Cpu className="w-3 h-3 text-teal-600" />
                        16-128 TOPS NPU
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 font-medium">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {product.warranty || '3 Years Warranty'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 font-medium">
                        <Truck className="w-3 h-3 text-blue-600" />
                        Free Delivery
                      </span>
                    </div>
                  </div>

                  {/* Pricing and Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-slate-900 dark:text-white">
                            ₹{inrPrice.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400 line-through">
                            ₹{inrMrp.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          (Inclusive of all taxes & 18% GST)
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        In Stock
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSpecsProduct(product)}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Specs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartCheckout(product)}
                        className="py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Buy Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Why Buy From Nexa AI Store (Razorpay Trust Badges) */}
        <section className="mt-12 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
          <div className="text-center max-w-xl mx-auto mb-6">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Official Consumer Electronics & Smart Hardware Guarantee
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Authorized direct-to-consumer sales for enterprise neural compute units and edge processors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                RBI Compliant PayU India
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                256-bit encrypted card, UPI & NetBanking processing
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto mb-2">
                <Truck className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Express Courier Dispatch
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Shipped within 24-48 hours with real-time AWB tracking
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto mb-2">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                7 Days Replacement
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hassle-free reverse pickup & 5-day bank refunds
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center mx-auto mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                GST Tax Invoice
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Automated electronic invoice with 18% input credit
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Official Mandatory Razorpay Compliance Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 pt-12 pb-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-slate-800">
            {/* Col 1: Brand & Registration */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Nexa AI Logo" className="w-8 h-8 object-contain" />
                <span className="text-base font-black text-white">
                  {store}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm">
                Official online retail store operated by <strong>{company}</strong> for consumer sales of
                artificial intelligence compute hardware, neural network coprocessors, and smart IoT automation controllers.
              </p>
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <div>GSTIN: <span className="text-teal-400 font-bold">{gst}</span></div>
                <div>MCC Code: <span className="text-teal-400 font-bold">5732 (Electronic Sales & Hardware)</span></div>
                <div>HSN Classification: <span className="text-teal-400">8541 / 8504 (Semiconductor Devices)</span></div>
              </div>
            </div>

            {/* Col 2: Mandatory Razorpay Policies */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Store Policies
              </h4>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <button
                    type="button"
                    onClick={() => openModal('policies')}
                    className="hover:text-teal-400 transition-colors text-left"
                  >
                    Terms & Conditions of Sale
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openModal('policies')}
                    className="hover:text-teal-400 transition-colors text-left"
                  >
                    Shipping & Delivery Policy (3-5 Days)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openModal('policies')}
                    className="hover:text-teal-400 transition-colors text-left"
                  >
                    Cancellation & Refund Policy (7 Days)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openModal('policies')}
                    className="hover:text-teal-400 transition-colors text-left"
                  >
                    Privacy Policy (IT Act 2000)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openModal('policies')}
                    className="hover:text-teal-400 transition-colors text-left"
                  >
                    Customer Grievance Redressal
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Customer Care & Corporate Office */}
            <div className="lg:col-span-2 space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Corporate Office & Grievance Contact
              </h4>
              <div className="space-y-2 text-[11px] text-slate-300">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>{supportEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>{supportPhone} (Mon - Sat, 9:30 AM to 6:30 PM IST)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust & Copyright Row */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500">
            <div>
              © 2026 {company}. All Rights Reserved. Complies with Consumer Protection (E-Commerce) Rules, 2020.
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-400">
                <Lock className="w-3 h-3 text-emerald-400" />
                PayU Verified 256-Bit SSL Checkout
              </span>
              <span>·</span>
              <button
                type="button"
                onClick={() => openModal('auth')}
                className="text-teal-400 hover:underline"
              >
                Member Portal
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* E-Commerce Checkout / Shipping Address Modal */}
      {activeCheckoutProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Express Doorstep Delivery Checkout
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Order for {activeCheckoutProduct.retailName || activeCheckoutProduct.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCheckoutProduct(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Product Summary Row */}
              <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={activeCheckoutProduct.image}
                    alt={activeCheckoutProduct.name}
                    className="w-12 h-12 rounded-xl object-cover border border-teal-200 dark:border-teal-700"
                  />
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                      {activeCheckoutProduct.retailName || activeCheckoutProduct.name}
                    </div>
                    <div className="text-[10px] text-teal-700 dark:text-teal-300">
                      SKU: {activeCheckoutProduct.sku || `NX-${activeCheckoutProduct.price}`} · 1 Unit
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-teal-800 dark:text-teal-300">
                    ₹{Math.round(activeCheckoutProduct.price * 100).toLocaleString()}
                  </div>
                  <div className="text-[9px] text-emerald-600 font-bold uppercase">
                    Free Delivery
                  </div>
                </div>
              </div>

              {/* Shipping Address Form */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-teal-600" />
                  <span>Courier Delivery Address (Pan-India)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={checkoutForm.fullName}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, fullName: e.target.value })}
                      placeholder="Receiver's name"
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Mobile Number (For Courier SMS) *
                    </label>
                    <input
                      type="tel"
                      value={checkoutForm.phone}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Street Address / Flat / Floor / Building *
                  </label>
                  <input
                    type="text"
                    value={checkoutForm.address}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                    placeholder="Complete residential or office address"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={checkoutForm.city}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={checkoutForm.state}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, state: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={checkoutForm.pincode}
                      maxLength={6}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, pincode: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Unit Base Price:</span>
                  <span>₹{Math.round(activeCheckoutProduct.price * 84.75).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Goods & Services Tax (GST 18%):</span>
                  <span>₹{Math.round(activeCheckoutProduct.price * 15.25).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Express Courier Shipping:</span>
                  <span>FREE</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                  <span>Total Payable:</span>
                  <span className="text-teal-700 dark:text-teal-400">
                    ₹{Math.round(activeCheckoutProduct.price * 100).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* PayU Trust Notice */}
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-[11px] text-teal-800 dark:text-teal-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-teal-600" />
                <span>
                  Payments are processed securely via PayU India's RBI-authorized gateway. Supports UPI, Cards & NetBanking.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setActiveCheckoutProduct(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProceedPayUCheckout}
                disabled={isProcessingPayment}
                className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-black shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isProcessingPayment
                    ? 'Connecting to PayU...'
                    : `Pay ₹${Math.round(activeCheckoutProduct.price * 100).toLocaleString()} with PayU`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Technical Specifications Modal */}
      {activeSpecsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-teal-600" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Technical Specifications
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSpecsProduct(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Product Model:</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeSpecsProduct.retailName || activeSpecsProduct.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">SKU Code:</span>
                <span className="font-mono text-teal-600 font-bold">{activeSpecsProduct.sku || `NX-${activeSpecsProduct.price}`}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Neural Compute Power:</span>
                <span className="font-bold text-slate-900 dark:text-white">16 to 128 TOPS INT8</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Connectivity:</span>
                <span className="font-bold text-slate-900 dark:text-white">USB 3.2 Gen 2 / Dual Gigabit LAN</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Warranty Support:</span>
                <span className="font-bold text-emerald-600">{activeSpecsProduct.warranty || '3-Year On-Site Manufacturer Warranty'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Box Contents:</span>
                <span className="font-bold text-slate-900 dark:text-white">Compute Blade, USB-C Cable, Warranty Card, Manual</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const prod = activeSpecsProduct;
                setActiveSpecsProduct(null);
                handleStartCheckout(prod);
              }}
              className="w-full py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Proceed to Checkout</span>
            </button>
          </div>
        </div>
      )}

      {/* Order Confirmed Success Modal */}
      {completedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl overflow-hidden p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Order Confirmed & Payment Verified!
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Thank you for shopping with {store}. Your order has been placed successfully through PayU.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-left font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Order Reference:</span>
                <span className="font-bold text-teal-600">{completedOrderDetails.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Item:</span>
                <span className="font-bold text-slate-900 dark:text-white">{completedOrderDetails.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Amount Paid:</span>
                <span className="font-bold text-emerald-600">₹{completedOrderDetails.amountInr.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Estimated Delivery:</span>
                <span className="font-bold text-slate-900 dark:text-white">{completedOrderDetails.deliveryDate}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCompletedOrderDetails(null)}
              className="w-full py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow-md transition-all"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
