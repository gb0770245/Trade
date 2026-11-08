import React, { useState } from 'react';
import {
  ChevronLeft,
  Headphones,
  LayoutGrid,
  List,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Star,
  FileText,
  BadgePercent,
  CreditCard,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InvestmentProduct } from '../types';
import { triggerOfficialPayUPayment } from '../services/payuService';

export const InvestView: React.FC = () => {
  const {
    user,
    investInProduct,
    goBack,
    openModal,
    products,
    selectedProductForInvest: selectedProduct,
    setSelectedProductForInvest: setSelectedProduct,
    platformSettings,
    showToast,
    showPaymentFailedModal,
  } = useApp();

  const [viewMode, setViewMode] = useState<'store' | 'yield'>('store');
  const [activeCategory, setActiveCategory] = useState<'steady' | 'benefits' | 'event'>('steady');
  const [isGrid, setIsGrid] = useState(false);
  const [isInvesting, setIsInvesting] = useState(false);

  const productList = products;
  const filteredProducts = productList.filter((p) => p.category === activeCategory);

  const handleInvestClick = (product: InvestmentProduct) => {
    setSelectedProduct(product);
  };

  const handleDirectPayUForProduct = async (product: InvestmentProduct) => {
    if (!user) {
      openModal('auth');
      return;
    }
    setIsInvesting(true);
    try {
      const paymentInrAmount = Math.round(product.price * 100);
      const merchantKey = platformSettings.payuMerchantKey?.trim();
      const isCustomLiveKey = Boolean(merchantKey && merchantKey !== 'gtKFFx' && !merchantKey.toLowerCase().includes('test'));
      const merchantMode = (isCustomLiveKey || platformSettings.payuMode === 'live') ? 'live' : 'test';

      const res = await triggerOfficialPayUPayment({
        key: merchantKey,
        salt: platformSettings.payuMerchantSalt,
        mode: merchantMode,
        amount: paymentInrAmount,
        usdAmount: product.price,
        merchantName: platformSettings.payuMerchantName?.trim() || 'Nexa AI',
        themeColor: platformSettings.payuThemeColor || '#0f766e',
        userName: user.nickname || 'Member',
        userPhone: user.phone || '9999999999',
        userId: user.id,
        purpose: 'product_purchase',
        productId: product.id,
        productName: product.retailName || product.name,
        onSuccess: async (paymentId: string) => {
          showToast(`PayU payment verified! Activating ${product.name}...`, 'success');
          await investInProduct(product);
          setSelectedProduct(null);
          setIsInvesting(false);
        },
        onFailure: (reason: string) => {
          setIsInvesting(false);
          showPaymentFailedModal({
            reason: reason || 'Transaction declined by bank or user.',
            amountUsd: product.price,
            amountInr: paymentInrAmount,
            productName: product.name,
            onRetry: () => {
              handleDirectPayUForProduct(product);
            },
          });
        },
        onDismiss: () => {
          setIsInvesting(false);
          showPaymentFailedModal({
            reason: 'Payment window was closed before completion.',
            amountUsd: product.price,
            amountInr: paymentInrAmount,
            productName: product.name,
            onRetry: () => {
              handleDirectPayUForProduct(product);
            },
          });
        },
      });

      if (!res.success && res.message) {
        setIsInvesting(false);
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      setIsInvesting(false);
      showToast(`Payment error: ${err.message}`, 'error');
    }
  };

  const handleConfirmInvestment = async () => {
    if (!selectedProduct) return;
    setIsInvesting(true);
    try {
      const res = await investInProduct(selectedProduct);
      if (res.success) {
        setSelectedProduct(null);
      }
    } finally {
      setIsInvesting(false);
    }
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <header className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
        <button
          type="button"
          onClick={goBack}
          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Back to Previous Page"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        </button>

        <div className="text-center">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {platformSettings.storeName || 'Nexa AI Hardware Store'}
          </h2>
          <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
            Certified Clean Power Equipment (MCC 5732)
          </p>
        </div>

        <button
          type="button"
          onClick={() => openModal('support')}
          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Customer Care"
        >
          <Headphones className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
      </header>


      {/* View Switcher: Retail Storefront (Shopping) vs Asset Yield */}
      <div className="px-4 mt-3">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setViewMode('store')}
            className={`py-2 px-3 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'store'
                ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Retail Hardware Store</span>
            <span className="text-[9px] bg-amber-400 text-slate-950 px-1 rounded font-black">SHOP</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('yield')}
            className={`py-2 px-3 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'yield'
                ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Asset Performance</span>
          </button>
        </div>
      </div>

      {/* Subtabs Filter: Steady | Benefits | Event [Hot] */}
      <div className="px-4 mt-3">
        <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveCategory('steady')}
            className={`flex-1 py-2 text-xs rounded-xl font-bold transition-all ${
              activeCategory === 'steady'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Steady Commercial
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('benefits')}
            className={`flex-1 py-2 text-xs rounded-xl font-bold transition-all ${
              activeCategory === 'benefits'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Express Modular
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('event')}
            className={`flex-1 py-2 text-xs rounded-xl font-bold transition-all relative ${
              activeCategory === 'event'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Flagship Grid</span>
            <span className="absolute -top-1 -right-1 text-[9px] bg-rose-500 text-white px-1.5 py-0.2 rounded-full font-bold shadow-sm">
              HOT
            </span>
          </button>
        </div>

        {/* Section title & layout switch */}
        <div className="flex items-center justify-between mt-3 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-3.5 bg-teal-700 rounded-full" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {viewMode === 'store'
                ? 'Verified Clean Tech Hardware & Solar Equipment'
                : activeCategory === 'steady'
                ? 'Steady High-Yield Assets'
                : activeCategory === 'benefits'
                ? 'Short-Cycle Flash Tankers'
                : 'Limited Event Allocations'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsGrid(!isGrid)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {isGrid ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Product Cards List / Grid */}
      <div className={`px-4 mt-2 space-y-4 ${isGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 space-y-0' : ''}`}>
        {filteredProducts.map((product) => {
          const retailTitle = product.retailName || product.name;
          const sku = product.sku || `NEXA-${product.id.toUpperCase().slice(0, 10)}`;
          const mrp = product.mrp || Math.round(product.price * 1.25);
          const discountPct = Math.round(((mrp - product.price) / mrp) * 100);
          const soldPercent = Math.min(100, Math.round((product.soldCount / product.totalUnits) * 100));

          return (
            <div
              key={product.id}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              {/* Product Header Image Container */}
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                <img
                  src={product.image}
                  alt={retailTitle}
                  className="w-full h-full object-cover brightness-95 hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* SKU Badge (Left top) */}
                <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/20 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-md">
                  {sku}
                </span>

                {/* Warranty Badge (Right top) */}
                <span className="absolute top-3 right-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{product.warranty || '3 Yrs Warranty'}</span>
                </span>

                {/* Overlay details at bottom of image */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-amber-300 font-bold">
                    <Star className="w-3 h-3 fill-amber-300" />
                    <span>{product.rating || 4.9}</span>
                    <span className="text-[10px] text-slate-300 font-normal">
                      ({product.reviewCount || 128} verified reviews)
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    In Stock • Ready to Dispatch
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 line-clamp-2">
                    {retailTitle}
                  </h3>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {product.description}
                </p>

                {/* Price & Retail Discount Bar */}
                <div className="flex items-baseline gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-lg font-black text-teal-700 dark:text-teal-400 num-tabular">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 line-through num-tabular">
                    MRP ${mrp.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {discountPct}% OFF
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto">
                    Tax Included
                  </span>
                </div>

                {/* Daily Return (Yield) */}
                <div className="mt-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Daily Return (Yield):</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 num-tabular">
                      +${product.dailyEarnings.toFixed(2)} / Day ({product.dailyPercent || (product.price > 0 ? Number(((product.dailyEarnings / product.price) * 100).toFixed(1)) : 50)}%)
                    </span>
                  </div>
                </div>

                {/* Invest Now CTA Button */}
                <button
                  type="button"
                  onClick={() => handleInvestClick(product)}
                  className="w-full mt-3.5 py-3 rounded-xl font-bold text-white text-xs uppercase tracking-wide bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 transition-all shadow-md shadow-teal-700/20 active:scale-[0.99] flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Invest Now (${product.price.toFixed(2)})</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>


    </div>
  );
};

