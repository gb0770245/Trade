import React, { useState } from 'react';
import { X, Sparkles, Gift, Trophy, RefreshCw, ShoppingCart, AlertCircle, Coins, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SPIN_PRIZES } from '../data/mockData';
import { SpinPrizeConfig } from '../types';

export const SpinWheelModal: React.FC = () => {
  const {
    user,
    platformSettings,
    spinWheelPrize,
    getAvailableSpins,
    buyExtraSpinWithBalance,
    closeModal,
    showToast,
    theme,
  } = useApp();

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<SpinPrizeConfig | null>(null);
  const [isBuying, setIsBuying] = useState(false);

  // Active prizes configured by admin (or fallback to default)
  const prizes: SpinPrizeConfig[] =
    platformSettings.spinPrizes && platformSettings.spinPrizes.length > 0
      ? platformSettings.spinPrizes.filter((p) => p.isEnabled)
      : SPIN_PRIZES;

  const totalSegments = Math.max(1, prizes.length);
  const segmentAngle = 360 / totalSegments;

  const spinStats = user
    ? getAvailableSpins(user)
    : { total: 0, dailyRemaining: 0, bonusSpins: 0 };

  const spinCost = platformSettings.spinPrice || 50;
  const isPurchaseEnabled = platformSettings.isSpinPurchaseEnabled && spinCost > 0;

  const handleBuySpin = async () => {
    setIsBuying(true);
    try {
      await buyExtraSpinWithBalance();
    } finally {
      setIsBuying(false);
    }
  };

  const handleSpin = () => {
    if (!user) return;
    if (!platformSettings.isSpinEnabled) {
      showToast('Lucky Spin is currently paused by administrator.', 'info');
      return;
    }

    if (spinStats.total <= 0) {
      if (isPurchaseEnabled) {
        showToast(
          `No spins left! You can buy an extra spin for $${spinCost.toFixed(2)} or wait for tomorrow's free spin.`,
          'info'
        );
      } else {
        showToast('You have 0 spins left. Check in or add money to earn more spins!', 'info');
      }
      return;
    }

    if (isSpinning) return;

    setIsSpinning(true);
    setWonPrize(null);

    // Pick winning index according to admin's configured probabilityWeight
    const totalWeight = prizes.reduce((sum, p) => sum + Math.max(1, p.probabilityWeight || 1), 0);
    const rand = Math.random() * totalWeight;
    let accumulated = 0;
    let winningIndex = 0;
    for (let i = 0; i < prizes.length; i++) {
      accumulated += Math.max(1, prizes[i].probabilityWeight || 1);
      if (rand <= accumulated) {
        winningIndex = i;
        break;
      }
    }

    // Safety: check daily prize pool cap set by admin
    const candidatePrize = prizes[winningIndex];
    const todayDistributed = platformSettings.totalPrizeDistributedToday || 0;
    const dailyCap = platformSettings.dailyPrizeDistributionCap || 5000;

    let actualWinningIndex = winningIndex;
    if (candidatePrize.type === 'cash' && candidatePrize.value > 0 && todayDistributed + candidatePrize.value > dailyCap) {
      // Find fallback prize (luck or smallest value)
      const luckIdx = prizes.findIndex((p) => p.type === 'luck' || p.value <= 10);
      if (luckIdx >= 0) {
        actualWinningIndex = luckIdx;
      }
    }

    const finalPrize = prizes[actualWinningIndex];

    // Calculate rotation: 5 full spins (1800 deg) + angle to target
    const extraRounds = 5 * 360;
    const targetDegree = extraRounds + (360 - actualWinningIndex * segmentAngle - segmentAngle / 2);
    const finalRotation = rotation + targetDegree;
    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setWonPrize(finalPrize);
      spinWheelPrize(finalPrize.label, finalPrize.value, finalPrize.type);
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div
        className={`w-full max-w-sm rounded-3xl p-5 sm:p-6 relative overflow-hidden transition-all shadow-2xl my-auto ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-500/10 transition-colors z-20"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white mb-1 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lucky Spin the Wheel</span>
          </div>
          <h3 className="text-lg font-black tracking-tight">Win Instant Cash & Prizes</h3>

          {/* Maintenance Notice if disabled */}
          {!platformSettings.isSpinEnabled && (
            <div className="mt-2 p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Lucky Spin is currently paused by admin</span>
            </div>
          )}

          {/* Available Spins Breakdown */}
          <div className="mt-2.5 flex items-center justify-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
              Today's Free: {spinStats.dailyRemaining} / {platformSettings.dailyFreeSpins ?? 1}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
              Bonus Spins: {spinStats.bonusSpins}
            </span>
          </div>
        </div>

        {/* Wheel Container */}
        <div className="relative w-64 h-64 mx-auto my-3 flex items-center justify-center">
          {/* Top Indicator Arrow */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-amber-500 drop-shadow-md" />

          {/* Rotating Wheel Circle */}
          <div
            className="w-full h-full rounded-full border-4 border-amber-400 shadow-2xl relative overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'transform 4s cubic-bezier(0.15, 0.9, 0.2, 1)' : 'none',
            }}
          >
            {/* SVG Wheel Segments */}
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {prizes.map((prize, idx) => {
                const angle = 360 / totalSegments;
                const startAngle = idx * angle;
                const endAngle = (idx + 1) * angle;

                // Arc coordinates
                const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
                const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
                const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
                const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);

                const textAngle = startAngle + angle / 2;
                const tx = 50 + 32 * Math.cos((Math.PI * textAngle) / 180);
                const ty = 50 + 32 * Math.sin((Math.PI * textAngle) / 180);

                return (
                  <g key={prize.id || idx}>
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                      fill={prize.color}
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill="#ffffff"
                      fontSize={totalSegments > 8 ? '4' : '4.8'}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${textAngle + 90}, ${tx}, ${ty})`}
                    >
                      {prize.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Outer Decorative Gold Rim Dots */}
            <div className="absolute inset-0 rounded-full border-2 border-white/40 pointer-events-none" />
          </div>

          {/* Center Hub / Spin Trigger */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning || !platformSettings.isSpinEnabled || spinStats.total <= 0}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 border-4 border-white text-slate-950 font-black text-xs uppercase shadow-xl flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-transform z-10 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSpinning ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>SPIN</span>
                <span className="text-[9px] font-bold">({spinStats.total})</span>
              </>
            )}
          </button>
        </div>

        {/* Won Prize Banner */}
        {wonPrize && (
          <div className="mt-2 p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-center animate-bounce">
            <div className="text-xs font-bold text-amber-500 flex items-center justify-center gap-1.5">
              <Trophy className="w-4 h-4" />
              <span>You Won {wonPrize.label}!</span>
            </div>
          </div>
        )}

        {/* Buy Extra Spin Button if 0 spins remain and feature is enabled by admin */}
        {spinStats.total <= 0 && isPurchaseEnabled && (
          <div className="mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 border border-teal-500/30 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                <span>Buy 1 Extra Spin Ticket</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Cost: <span className="font-bold text-emerald-600 dark:text-emerald-400">${spinCost.toFixed(2)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleBuySpin}
              disabled={isBuying || (user?.rechargeBalance || 0) < spinCost}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black transition-all shadow-sm disabled:opacity-50"
            >
              {isBuying ? 'Buying...' : 'Buy Ticket'}
            </button>
          </div>
        )}

        {/* Bottom Rules / Info */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>
              Daily Free Limit: <strong className="text-slate-700 dark:text-slate-200">{platformSettings.dailyFreeSpins ?? 1} spin/day</strong> (resets midnight)
            </span>
          </div>
          {platformSettings.extraSpinOnRecharge && (
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                Add Money ${platformSettings.rechargeThresholdForSpin || 5}+ awards <strong>+1 Extra Lucky Spin</strong>
              </span>
            </div>
          )}
          {platformSettings.extraSpinOnCheckIn && (
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Daily Check-in awards <strong>+{platformSettings.spinsPerCheckIn || 1} Free Spin</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

