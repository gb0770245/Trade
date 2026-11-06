import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  Sparkles,
  Package,
  Truck,
  FileText,
  MapPin,
  ExternalLink,
  Hourglass,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/dbService';
import { getOrderClaimStatus, formatCountdown, formatCountdownHuman } from '../utils/dividendUtils';

export const OrdersModal: React.FC = () => {
  const { user, orders, refreshOrders, ecommerceOrders, claimDailyDividends, closeModal, theme, showToast } = useApp();
  const [tab, setTab] = useState<'contracts' | 'shipments'>('contracts');
  const [now, setNow] = useState(Date.now());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh real user orders directly from SQL database on modal open
  useEffect(() => {
    if (user?.id) {
      refreshOrders().catch(() => {});
    }
  }, [user?.id, refreshOrders]);

  // Live 1-second tick for accurate 24-hour countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeOrders = orders.filter((o) => o.status === 'active');
  const readyOrders = activeOrders.filter((o) => getOrderClaimStatus(o, now).canClaim);
  const readyDividendsTotal = readyOrders.reduce((sum, o) => sum + o.dailyEarnings, 0);

  // Find minimum remaining time for active orders waiting for 24 hours
  const waitingOrders = activeOrders.filter((o) => !getOrderClaimStatus(o, now).canClaim);
  const minWaitMs = waitingOrders.length > 0
    ? Math.min(...waitingOrders.map((o) => getOrderClaimStatus(o, now).remainingMs))
    : 0;

  const handleClaimSingle = async (orderId: string) => {
    setClaimingId(orderId);
    await claimDailyDividends(orderId);
    setClaimingId(null);
  };

  const handleClaimAll = async () => {
    setClaimingId('all');
    await claimDailyDividends();
    setClaimingId(null);
  };

  const handleSyncOrders = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      const freshOrders = await refreshOrders();
      if (freshOrders && freshOrders.length > 0) {
        showToast(`Synchronized ${freshOrders.length} orders permanently from SQL database!`, 'success');
      } else {
        showToast('Orders are up to date with SQL database.', 'info');
      }
    } catch {
      showToast('Error syncing with database', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 relative overflow-hidden transition-all shadow-2xl max-h-[90vh] flex flex-col overscroll-contain ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold">My Investment Contracts & Orders</h3>
            <p className="text-xs text-slate-400">Real-time SQL synced active contracts and daily dividend claims</p>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 my-3 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setTab('contracts')}
            className={`py-2 px-3 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'contracts'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Yield Contracts ({orders?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('shipments')}
            className={`py-2 px-3 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'shipments'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Hardware Shipments ({ecommerceOrders?.length || 0})</span>
          </button>
        </div>

        {/* Permanent SQL Database Status & Quick Refresh */}
        <div className="flex items-center justify-between px-3 py-1.5 mb-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Permanent SQL Database Active</span>
          </div>
          <button
            onClick={handleSyncOrders}
            disabled={isRefreshing}
            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 hover:underline cursor-pointer disabled:opacity-50"
            title="Sync with SQL Server"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync SQL'}</span>
          </button>
        </div>

        {/* TAB 1: E-COMMERCE HARDWARE SHIPMENTS */}
        {tab === 'shipments' && (
          <div className="overflow-y-auto overscroll-contain space-y-3 pr-1 flex-1 min-h-0 text-xs">
            {!ecommerceOrders || ecommerceOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                <p>No retail hardware orders yet.</p>
                <p className="text-[11px] text-teal-600 dark:text-teal-400">
                  Select any Solar Inverter or Energy Unit on the Invest Store to order with fast Delhivery delivery!
                </p>
              </div>
            ) : (
              ecommerceOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-400 text-[11px]">
                          {ord.orderNumber}
                        </span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase">
                          {ord.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 mt-1 line-clamp-1">
                        {ord.productName}
                      </h4>
                    </div>
                    <span className="font-black text-sm text-teal-700 dark:text-teal-400 num-tabular">
                      ${ord.price.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tracking (AWB):</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {ord.trackingNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Courier:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {ord.courierPartner}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tax Invoice:</span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {ord.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimated Delivery:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {ord.estimatedDelivery}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                    <span className="truncate">
                      Deliver to: {ord.shippingAddress.fullName}, {ord.shippingAddress.addressLine},{' '}
                      {ord.shippingAddress.city} - {ord.shippingAddress.pincode}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: YIELD CONTRACTS */}
        {tab === 'contracts' && (
          <div className="overflow-y-auto overscroll-contain space-y-3 pr-1 flex-1 min-h-0 text-xs">
            {/* Top Claim Banner */}
            {activeOrders.length > 0 && (
              <div
                className={`p-3.5 rounded-2xl text-white flex items-center justify-between shadow-md transition-all ${
                  readyOrders.length > 0
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 ring-1 ring-emerald-400/40'
                    : 'bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700'
                }`}
              >
                <div>
                  <div className="text-[11px] opacity-80 flex items-center gap-1.5">
                    {readyOrders.length > 0 ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                        <span className="font-semibold text-emerald-100">Dividends Ready to Collect</span>
                      </>
                    ) : (
                      <>
                        <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        <span className="font-semibold text-slate-300">24-Hour Cycle Cooldown Active</span>
                      </>
                    )}
                  </div>
                  <div className="text-lg font-extrabold num-tabular mt-0.5">
                    {readyOrders.length > 0 ? (
                      <span className="text-emerald-200">
                        +${readyDividendsTotal.toFixed(2)}{' '}
                        <span className="text-xs font-normal text-white/80">({readyOrders.length} ready)</span>
                      </span>
                    ) : (
                      <span className="text-amber-300 font-mono text-base">
                        Next claim in {formatCountdown(minWaitMs)}
                      </span>
                    )}
                  </div>
                </div>

                {readyOrders.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleClaimAll}
                    disabled={claimingId === 'all'}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-emerald-900 hover:bg-emerald-50 shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{claimingId === 'all' ? 'Claiming...' : 'Claim All'}</span>
                  </button>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-700 text-[11px] font-mono text-amber-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatCountdown(minWaitMs)}</span>
                  </div>
                )}
              </div>
            )}

            {orders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No active yield contracts. Browse products to start earning dividends!
              </div>
            ) : (
              orders.map((order) => {
                const progressPercent = Math.min(
                  100,
                  Math.round((order.daysElapsed / order.cycleDays) * 100)
                );
                const isCompleted = order.status === 'completed';
                const claimStatus = getOrderClaimStatus(order, now);
                const isThisClaiming = claimingId === order.id;

                return (
                  <div
                    key={order.id}
                    className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                      isCompleted
                        ? 'border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 opacity-70'
                        : claimStatus.canClaim
                        ? 'border-emerald-500/50 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md ring-1 ring-emerald-400/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono font-bold">
                          {order.id}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {order.productName}
                        </h4>
                      </div>

                      {/* 24-Hour Cycle Status Pill */}
                      {order.status === 'pending_approval' ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 flex items-center gap-1">
                          <Hourglass className="w-3 h-3 text-amber-500" />
                          <span>Pending Approval</span>
                        </span>
                      ) : order.status === 'paused' ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0 flex items-center gap-1">
                          <span>⏸️ Paused</span>
                        </span>
                      ) : order.status === 'cancelled' ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 flex items-center gap-1">
                          <span>❌ Cancelled</span>
                        </span>
                      ) : isCompleted ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                          Cycle Finished
                        </span>
                      ) : claimStatus.canClaim ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                          ● Ready to Claim
                        </span>
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>{claimStatus.formattedCountdown}</span>
                        </span>
                      )}
                    </div>

                    {/* Grid details */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                      <div>
                        <div className="text-slate-400 text-[10px]">Price</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 num-tabular">
                          ${order.price.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px]">Daily Return</div>
                        <div className="font-bold text-teal-600 dark:text-teal-400 num-tabular">
                          +${order.dailyEarnings.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px]">Total Earned</div>
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 num-tabular">
                          ${order.totalAccrued.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Cycle Progress</span>
                        <span>
                          Day {order.daysElapsed} / {order.cycleDays} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* 24-Hour Claim Action Row */}
                    {order.status === 'pending_approval' ? (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/50 dark:border-amber-900/50 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1.5">
                          <Hourglass className="w-3.5 h-3.5 animate-spin" />
                          <span>Awaiting Admin Verification — 24h dividend begins upon approval</span>
                        </span>
                      </div>
                    ) : order.status === 'paused' ? (
                      <div className="mt-3 pt-2.5 border-t border-orange-200/50 dark:border-orange-900/50 flex items-center justify-between text-[11px] text-orange-600 dark:text-orange-400">
                        <span>⏸️ Contract yields temporarily paused by Administrator</span>
                      </div>
                    ) : order.status === 'cancelled' ? (
                      <div className="mt-3 pt-2.5 border-t border-rose-200/50 dark:border-rose-900/50 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400">
                        <span>❌ Contract terminated {order.refundAmount ? `(Refunded $${order.refundAmount})` : ''}</span>
                      </div>
                    ) : !isCompleted && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {claimStatus.canClaim ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              24h reached! Collect ${order.dailyEarnings.toFixed(2)} today.
                            </span>
                          ) : (
                            <span className="font-mono text-slate-500">
                              Next 24h claim in: <strong className="text-amber-500 dark:text-amber-400">{claimStatus.formattedCountdown}</strong>
                            </span>
                          )}
                        </div>

                        {claimStatus.canClaim ? (
                          <button
                            type="button"
                            onClick={() => handleClaimSingle(order.id)}
                            disabled={isThisClaiming}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>{isThisClaiming ? 'Claiming...' : `Collect $${order.dailyEarnings.toFixed(2)}`}</span>
                          </button>
                        ) : (
                          <div className="px-2.5 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-900/60 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Locked (24h)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
