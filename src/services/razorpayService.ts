// Backward compatibility shim: Razorpay to PayU Gateway
import { triggerOfficialPayUPayment, PayUPaymentParams } from './payuService';

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface TriggerRazorpayParams {
  keyId?: string;
  keySecret?: string;
  amount: number;
  usdAmount?: number;
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
  console.log('[Payment Gateway] Forwarding transaction to PayU India gateway...');
  const payuParams: PayUPaymentParams = {
    amount: params.amount,
    usdAmount: params.usdAmount,
    userName: params.userName,
    userPhone: params.userPhone,
    userId: params.userId,
    merchantName: params.merchantName,
    themeColor: params.themeColor,
    onSuccess: params.onSuccess,
    onFailure: params.onFailure,
    onDismiss: params.onDismiss,
  };
  return triggerOfficialPayUPayment(payuParams);
};

export const openRazorpayCheckout = async (
  params: any
): Promise<{ success: boolean; message?: string }> => {
  return triggerOfficialPayUPayment({
    amount: params.amount,
    userName: params.prefill?.name || 'Customer',
    userPhone: params.prefill?.contact || '9999999999',
    userEmail: params.prefill?.email,
    userId: 'guest',
    onSuccess: (id) => params.onSuccess?.({ razorpay_payment_id: id }),
    onFailure: params.onFailure,
    onDismiss: params.onDismiss,
  });
};
