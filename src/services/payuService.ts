// Official PayU India Client Service
export interface PayUPaymentParams {
  key?: string;
  salt?: string;
  mode?: 'test' | 'live';
  amount: number; // In INR (e.g. 100 for $1)
  usdAmount?: number; // In USD (e.g. 1)
  userName: string;
  userPhone: string;
  userEmail?: string;
  userId: string;
  purpose?: 'recharge' | 'product_purchase';
  productId?: string;
  productName?: string;
  merchantName?: string;
  themeColor?: string;
  onSuccess?: (paymentId: string) => void;
  onFailure?: (reason: string) => void;
  onDismiss?: () => void;
}

export interface PayUCreatePaymentResponse {
  success: boolean;
  actionUrl?: string;
  params?: Record<string, string>;
  txnid?: string;
  error?: string;
  message?: string;
}

/**
 * Triggers official PayU India Hosted Checkout
 * Generates secure server-side SHA-512 hash and redirects seamlessly to PayU India gateway
 */
export const triggerOfficialPayUPayment = async (
  params: PayUPaymentParams
): Promise<{ success: boolean; message?: string; txnid?: string }> => {
  try {
    const formattedPhone = (params.userPhone || '').replace(/\D/g, '').slice(-10) || '9999999999';
    const formattedEmail =
      params.userEmail?.trim() ||
      `${formattedPhone}@nexa-ai.shop`;

    const res = await fetch('/api/payu/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amount,
        usdAmount: params.usdAmount || Number((params.amount / 100).toFixed(2)),
        userId: params.userId,
        userName: params.userName || 'Customer',
        userPhone: formattedPhone,
        userEmail: formattedEmail,
        purpose: params.purpose || 'recharge',
        productId: params.productId,
        productName: params.productName || 'Nexa AI Tech Hardware',
        key: params.key,
        salt: params.salt,
        mode: params.mode,
      }),
    });

    const data: PayUCreatePaymentResponse = await res.json();

    if (!res.ok || !data.success || !data.actionUrl || !data.params) {
      const errMsg = data.error || data.message || 'Failed to initialize PayU payment session';
      if (params.onFailure) params.onFailure(errMsg);
      return { success: false, message: errMsg };
    }

    // Persist current pending transaction context in sessionStorage for post-redirect verification
    try {
      sessionStorage.setItem(
        'payu_pending_payment',
        JSON.stringify({
          txnid: data.txnid,
          amount: params.amount,
          usdAmount: params.usdAmount,
          userId: params.userId,
          purpose: params.purpose || 'recharge',
          productId: params.productId,
          timestamp: Date.now(),
        })
      );
    } catch {}

    // Build and submit dynamic HTML form to PayU gateway
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.actionUrl;
    form.style.display = 'none';

    Object.entries(data.params).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value ?? '');
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    return { success: true, txnid: data.txnid };
  } catch (err: any) {
    console.error('[PayU Service] Checkout launch exception:', err);
    const msg = err.message || 'Failed to connect to PayU payment gateway.';
    if (params.onFailure) params.onFailure(msg);
    return { success: false, message: msg };
  }
};

/**
 * Check if current session contains a newly returned PayU payment status
 */
export const checkPayUReturnStatus = (): {
  hasPaymentParam: boolean;
  status?: 'success' | 'failed';
  txnid?: string;
  amount?: string;
  ref?: string;
  reason?: string;
} => {
  if (typeof window === 'undefined') return { hasPaymentParam: false };

  const searchParams = new URLSearchParams(window.location.search);
  const paymentStatus = searchParams.get('payment');
  const gateway = searchParams.get('gateway');

  if (paymentStatus === 'success' || paymentStatus === 'failed') {
    return {
      hasPaymentParam: true,
      status: paymentStatus,
      txnid: searchParams.get('txnid') || undefined,
      amount: searchParams.get('amount') || undefined,
      ref: searchParams.get('ref') || undefined,
      reason: searchParams.get('reason') || (paymentStatus === 'failed' ? 'Payment was declined or cancelled.' : undefined),
    };
  }

  // Also check standard PayU callback query params if forwarded
  if (gateway === 'payu') {
    return {
      hasPaymentParam: true,
      status: searchParams.get('status') === 'success' ? 'success' : 'failed',
      txnid: searchParams.get('txnid') || undefined,
      amount: searchParams.get('amount') || undefined,
      ref: searchParams.get('mihpayid') || undefined,
      reason: searchParams.get('msg') || undefined,
    };
  }

  return { hasPaymentParam: false };
};
