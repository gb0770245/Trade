import { InvestmentOrder } from '../types';

export const CYCLE_24_HOURS_MS = 24 * 60 * 60 * 1000; // 86,400,000 ms

export interface OrderClaimStatus {
  canClaim: boolean;
  isCompleted: boolean;
  isPending?: boolean;
  isPaused?: boolean;
  isCancelled?: boolean;
  remainingMs: number;
  nextClaimTime: number;
  formattedCountdown: string;
}

export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '00:00:00';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  return `${hStr}:${mStr}:${sStr}`;
}

export function formatCountdownHuman(remainingMs: number): string {
  if (remainingMs <= 0) return 'Ready to claim';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function getOrderClaimStatus(order: InvestmentOrder, now: number = Date.now()): OrderClaimStatus {
  if (order.status === 'pending_approval') {
    return {
      canClaim: false,
      isCompleted: false,
      isPending: true,
      remainingMs: 0,
      nextClaimTime: 0,
      formattedCountdown: 'Pending Approval',
    };
  }

  if (order.status === 'paused') {
    return {
      canClaim: false,
      isCompleted: false,
      isPaused: true,
      remainingMs: 0,
      nextClaimTime: 0,
      formattedCountdown: 'Paused by Admin',
    };
  }

  if (order.status === 'cancelled') {
    return {
      canClaim: false,
      isCompleted: false,
      isCancelled: true,
      remainingMs: 0,
      nextClaimTime: 0,
      formattedCountdown: 'Cancelled',
    };
  }

  const cycleDays = Number(order.cycleDays) || 1;
  const daysElapsed = Number(order.daysElapsed) || 0;
  if (order.status === 'completed' || daysElapsed >= cycleDays) {
    return {
      canClaim: false,
      isCompleted: true,
      remainingMs: 0,
      nextClaimTime: 0,
      formattedCountdown: 'Completed',
    };
  }

  // STRICT 24-HOUR COOLDOWN ENFORCEMENT:
  // If order was claimed within the last 24 hours, cooldown is strictly active from lastClaimTimestamp
  const lastClaim = Number(order.lastClaimTimestamp) || 0;
  if (lastClaim > 0 && (now - lastClaim) < CYCLE_24_HOURS_MS) {
    const cooldownEnd = lastClaim + CYCLE_24_HOURS_MS;
    const remainingMs = Math.max(0, cooldownEnd - now);
    if (remainingMs > 0) {
      return {
        canClaim: false,
        isCompleted: false,
        remainingMs,
        nextClaimTime: cooldownEnd,
        formattedCountdown: formatCountdown(remainingMs),
      };
    }
  }

  let nextClaimTime = Number(order.nextClaimTimestamp) || 0;
  if (!nextClaimTime) {
    if (lastClaim > 0) {
      nextClaimTime = lastClaim + CYCLE_24_HOURS_MS;
    } else if (order.purchaseTimestamp) {
      nextClaimTime = Number(order.purchaseTimestamp) + CYCLE_24_HOURS_MS;
    } else if (order.lastClaimDate) {
      const parsed = new Date(order.lastClaimDate).getTime();
      nextClaimTime = !isNaN(parsed) ? parsed + CYCLE_24_HOURS_MS : (now - 1000);
    } else {
      nextClaimTime = now;
    }
  }

  const remainingMs = Math.max(0, nextClaimTime - now);
  const canClaim = remainingMs === 0;

  return {
    canClaim,
    isCompleted: false,
    remainingMs,
    nextClaimTime,
    formattedCountdown: formatCountdown(remainingMs),
  };
}
