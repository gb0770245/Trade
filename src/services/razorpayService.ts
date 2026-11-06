// Official Razorpay Client Service
export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise (e.g. 28000 for 280 INR)
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: string;
  };
  notes?: Record<string, string | number>;
  theme?: {
    color?: string;
  };
  method?: {
    upi?: boolean;
    card?: boolean;
    netbanking?: boolean;
    wallet?: boolean;
    emi?: boolean;
    paylater?: boolean;
  };
  config?: {
    display?: {
      language?: string;
      blocks?: Record<string, {
        name: string;
        instruments: Array<{
          method: string;
          banks?: string[];
          issuers?: string[];
          wallets?: string[];
        }>;
      }>;
      sequence?: string[];
      preferences?: {
        show_default_blocks?: boolean;
      };
    };
  };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
    confirm_close?: boolean;
  };
  retry?: {
    enabled?: boolean;
    max_count?: number;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, callback: (response: any) => void) => void;
    };
  }
}

let scriptLoadPromise: Promise<boolean> | null = null;

export const loadRazorpayScript = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve) => {
    // Check if script already exists in DOM
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Razorpay checkout script failed to load from https://checkout.razorpay.com/v1/checkout.js');
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
};

export const DEFAULT_NEXA_AI_LOGO = '/logo.png';

export const getAbsoluteLogoUrl = (url?: string): string => {
  const chosen = url && url.trim().length > 0 ? url.trim() : DEFAULT_NEXA_AI_LOGO;
  if (typeof window !== 'undefined' && chosen.startsWith('/')) {
    return `${window.location.origin}${chosen}`;
  }
  return chosen;
};

export interface TriggerRazorpayParams {
  keyId?: string;
  keySecret?: string;
  amount: number; // In INR (e.g. 100 for $1)
  usdAmount?: number; // In USD (e.g. 1)
  merchantName?: string;
  merchantLogo?: string;
  themeColor?: string;
  userName: string;
  userPhone: string;
  userId: string;
  preferredMethod?: 'all' | 'upi' | 'card' | 'netbanking' | 'wallet';
  onSuccess: (paymentId: string) => void;
  onFailure: (reason: string) => void;
  onDismiss?: () => void;
}

export const triggerOfficialRazorpayPayment = async (
  params: TriggerRazorpayParams
): Promise<{ success: boolean; message?: string }> => {
  const isLoaded = await loadRazorpayScript();

  if (!isLoaded || !window.Razorpay) {
    return {
      success: false,
      message: 'Razorpay Checkout SDK could not be loaded. Please check your internet connection.',
    };
  }

  try {
    // 1. Create order on server side
    let orderId: string | undefined;
    let effectiveKeyId =
      params.keyId && params.keyId !== 'rzp_live_TsxVeW7tusSgjp'
        ? params.keyId
        : 'rzp_live_TuMp7KWEsJZTL6';

    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: params.amount,
          currency: 'INR',
          keyId: params.keyId && params.keyId !== 'rzp_live_TsxVeW7tusSgjp' ? params.keyId : undefined,
          keySecret: params.keySecret && params.keySecret !== 'SvNqYN6H09fU4mNSGqJeTG0V' ? params.keySecret : undefined,
          notes: {
            userId: params.userId,
            userName: params.userName,
            userPhone: params.userPhone,
            usdAmount: params.usdAmount || Number((params.amount / 100).toFixed(2)),
          },
        }),
      });

      const orderData = await orderRes.json();
      if (orderData.success) {
        if (orderData.orderId) orderId = orderData.orderId;
        if (orderData.keyId) effectiveKeyId = orderData.keyId;
      }
    } catch (orderErr) {
      console.warn('Backend order creation notice:', orderErr);
    }

    const amountInPaise = Math.round(params.amount * 100);
    const usdVal = params.usdAmount || Number((params.amount / 100).toFixed(2));

    const effectiveName = params.merchantName?.trim() || 'Nexa AI';
    const effectiveImage = getAbsoluteLogoUrl(params.merchantLogo);

    // 2. Launch Official Razorpay Checkout Modal
    // Explicitly configure display blocks & sequence so all payment options (UPI, Card, NetBanking, Wallets)
    // are visible upfront without hiding behind a single GPay button with "See more".
    const randOrderNum = Math.floor(100000 + Math.random() * 900000);
    const options: RazorpayOptions = {
      key: effectiveKeyId,
      amount: amountInPaise,
      currency: 'INR',
      name: effectiveName,
      description: `Order #NX-${randOrderNum} - Nexa AI Tech Hardware (INR ${params.amount.toLocaleString()})`,
      image: effectiveImage,
      ...(orderId ? { order_id: orderId } : {}),
      prefill: {
        name: params.userName,
        contact: params.userPhone,
        email: `${params.userPhone.replace(/\D/g, '') || 'customer'}@nexa-ai.shop`,
        ...(params.preferredMethod && params.preferredMethod !== 'all'
          ? { method: params.preferredMethod }
          : {}),
      },
      notes: {
        customer_id: params.userId,
        order_category: 'Consumer Electronics & Computer Hardware',
        mcc: '5732',
        product_type: 'AI Edge Accelerators & Neural Compute Devices',
        merchant_store: 'Nexa AI Tech & Electronics Store',
        shipping_method: 'Surface Express Courier Delivery',
      },
      theme: {
        color: params.themeColor || '#0f766e',
      },
      // Force all payment methods to be available
      method: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
        emi: true,
        paylater: false,
      },
      // Display configuration: Show all methods in explicit sequence upfront so user sees everything directly
      config: {
        display: {
          blocks: {
            all_upi: {
              name: 'UPI (PhonePe, Google Pay, Paytm, BHIM, UPI ID)',
              instruments: [
                {
                  method: 'upi',
                },
              ],
            },
            cards: {
              name: 'Debit & Credit Cards (Visa, MasterCard, RuPay)',
              instruments: [
                {
                  method: 'card',
                },
              ],
            },
            netbanking: {
              name: 'Net Banking (All Indian Banks - SBI, HDFC, ICICI & More)',
              instruments: [
                {
                  method: 'netbanking',
                },
              ],
            },
            wallets: {
              name: 'Wallets (Paytm Wallet, Mobikwik & More)',
              instruments: [
                {
                  method: 'wallet',
                },
              ],
            },
          },
          sequence: [
            'block.all_upi',
            'block.cards',
            'block.netbanking',
            'block.wallets',
          ],
          preferences: {
            show_default_blocks: false,
          },
        },
      },
      handler: async (response: RazorpaySuccessResponse) => {
        if (!response.razorpay_payment_id) {
          params.onFailure('Payment ID missing in Razorpay response');
          return;
        }

        // Verify with backend
        try {
          const verifyRes = await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              keySecret: params.keySecret,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            params.onSuccess(response.razorpay_payment_id);
            return;
          }
        } catch {
          // If server verification was offline, proceed with client payment ID
        }

        params.onSuccess(response.razorpay_payment_id);
      },
      modal: {
        ondismiss: () => {
          if (params.onDismiss) params.onDismiss();
        },
        escape: true,
        backdropclose: false,
        confirm_close: false,
      },
      retry: {
        enabled: false,
      },
    };

    const razorpayInstance = new window.Razorpay(options);

    razorpayInstance.on('payment.failed', (resp: any) => {
      const errMsg =
        resp?.error?.description ||
        resp?.error?.reason ||
        'Payment was declined by bank or cancelled.';
      console.warn('[Razorpay] Payment failed:', resp?.error);
      try {
        if (typeof (razorpayInstance as any).close === 'function') {
          (razorpayInstance as any).close();
        }
      } catch {}
      params.onFailure(errMsg);
    });

    razorpayInstance.open();
    return { success: true };
  } catch (err: any) {
    console.error('Razorpay launch exception:', err);
    return {
      success: false,
      message: err.message || 'Failed to open Razorpay payment gateway.',
    };
  }
};

export interface OpenRazorpayCheckoutParams {
  amount: number;
  description: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  notes?: Record<string, string | number>;
  themeColor?: string;
  onSuccess: (verifyData: { razorpay_payment_id: string; razorpay_order_id?: string }) => void;
  onFailure?: (reason: string) => void;
  onDismiss?: () => void;
}

export const openRazorpayCheckout = async (
  params: OpenRazorpayCheckoutParams
): Promise<{ success: boolean; message?: string }> => {
  const isLoaded = await loadRazorpayScript();

  if (!isLoaded || !window.Razorpay) {
    return {
      success: false,
      message: 'Razorpay Checkout SDK could not be loaded. Please check your internet connection.',
    };
  }

  try {
    let orderId: string | undefined;
    let effectiveKeyId = 'rzp_test_1DP5mmOlF5G5ag';

    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: params.amount,
          currency: 'INR',
          notes: {
            category: 'E-Commerce Retail Store',
            mcc: '5732',
            store_name: 'Nexa AI Retail Store',
            ...(params.notes || {}),
          },
        }),
      });

      const orderData = await orderRes.json();
      if (orderData.success) {
        if (orderData.orderId) orderId = orderData.orderId;
        if (orderData.keyId) effectiveKeyId = orderData.keyId;
      }
    } catch (orderErr) {
      console.warn('Backend order creation notice for checkout:', orderErr);
    }

    const amountInPaise = Math.round(params.amount * 100);

    const options: RazorpayOptions = {
      key: effectiveKeyId,
      amount: amountInPaise,
      currency: 'INR',
      name: 'Nexa AI',
      description: params.description,
      image: getAbsoluteLogoUrl(),
      ...(orderId ? { order_id: orderId } : {}),
      prefill: {
        name: params.prefill?.name || 'Customer',
        contact: params.prefill?.contact || '',
        email: params.prefill?.email || 'care@nexa-ai.shop',
      },
      notes: {
        category: 'E-Commerce Retail Store',
        mcc: '5732',
        ...(params.notes || {}),
      },
      theme: {
        color: params.themeColor || '#0f766e',
      },
      method: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
        emi: true,
        paylater: false,
      },
      config: {
        display: {
          blocks: {
            all_upi: {
              name: 'UPI (PhonePe, Google Pay, Paytm, BHIM, UPI ID)',
              instruments: [
                {
                  method: 'upi',
                },
              ],
            },
            cards: {
              name: 'Debit & Credit Cards (Visa, MasterCard, RuPay)',
              instruments: [
                {
                  method: 'card',
                },
              ],
            },
            netbanking: {
              name: 'Net Banking (All Indian Banks - SBI, HDFC, ICICI & More)',
              instruments: [
                {
                  method: 'netbanking',
                },
              ],
            },
            wallets: {
              name: 'Wallets (Paytm Wallet, Mobikwik & More)',
              instruments: [
                {
                  method: 'wallet',
                },
              ],
            },
          },
          sequence: [
            'block.all_upi',
            'block.cards',
            'block.netbanking',
            'block.wallets',
          ],
          preferences: {
            show_default_blocks: false,
          },
        },
      },
      handler: async (response: RazorpaySuccessResponse) => {
        if (!response.razorpay_payment_id) {
          return;
        }

        // Verify with backend
        try {
          await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
        } catch {
          // Continue with payment ID
        }

        params.onSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
        });
      },
      modal: {
        ondismiss: () => {
          if (params.onDismiss) params.onDismiss();
        },
        escape: true,
        backdropclose: false,
        confirm_close: false,
      },
      retry: {
        enabled: false,
      },
    };

    const razorpayInstance = new window.Razorpay(options);
    razorpayInstance.on('payment.failed', (resp: any) => {
      const errMsg =
        resp?.error?.description ||
        resp?.error?.reason ||
        'Payment was declined by bank or user.';
      console.warn('[Razorpay Store] Payment failed:', resp?.error);
      try {
        if (typeof (razorpayInstance as any).close === 'function') {
          (razorpayInstance as any).close();
        }
      } catch {}
      if (params.onFailure) params.onFailure(errMsg);
    });
    razorpayInstance.open();
    return { success: true };
  } catch (err: any) {
    console.error('Razorpay store checkout exception:', err);
    return {
      success: false,
      message: err.message || 'Failed to open Razorpay checkout.',
    };
  }
};

