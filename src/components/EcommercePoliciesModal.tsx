import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Truck,
  RotateCcw,
  FileText,
  PhoneCall,
  Building,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const EcommercePoliciesModal: React.FC = () => {
  const { closeModal, platformSettings } = useApp();
  const [activePolicyTab, setActivePolicyTab] = useState<
    'terms' | 'shipping' | 'refund' | 'privacy' | 'contact'
  >(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('policy');
      if (p === 'shipping' || p === 'refund' || p === 'privacy' || p === 'contact' || p === 'terms') {
        return p;
      }
    }
    return 'terms';
  });

  const company = platformSettings.companyLegalName || 'Nexa AI Technologies India Pvt Ltd';
  const store = platformSettings.storeName || 'Nexa AI Retail Store';
  const address =
    platformSettings.merchantAddress ||
    'Plot 42, Cyber Green Park, Phase 2, Udyog Vihar, Gurugram, Haryana - 122016';
  const email = platformSettings.supportEmail || 'care@nexa-ai.shop';
  const phone = platformSettings.supportPhone || '+91 7307112738';
  const gst = platformSettings.gstNumber || '07AABCH8821K1Z3';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Compliance & E-Commerce Policies
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Razorpay Approved
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Retail Store Agreements for {company}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setActivePolicyTab('terms')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activePolicyTab === 'terms'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Sale</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePolicyTab('shipping')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activePolicyTab === 'shipping'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Shipping & Delivery</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePolicyTab('refund')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activePolicyTab === 'refund'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refund & Return</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePolicyTab('privacy')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activePolicyTab === 'privacy'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePolicyTab('contact')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activePolicyTab === 'contact'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Contact & Grievance</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed">
          {/* TAB 1: TERMS AND CONDITIONS */}
          {activePolicyTab === 'terms' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200">
                <span className="font-bold">E-Commerce Commercial Terms of Service</span>
                <p className="text-[11px] mt-0.5 text-teal-700 dark:text-teal-300">
                  Last revised: October 2026. Applicable to all retail hardware purchases of clean energy equipment.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  1. Acceptance of Terms
                </h4>
                <p>
                  These Terms and Conditions constitute a legally binding electronic agreement between you
                  ("Customer" or "Buyer") and <strong>{company}</strong> ("Company", "We", "Us") governing
                  your purchase of green power equipment, solar systems, fuel cells, and micro-generators
                  through {store}.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  2. Product Catalog, Specifications & Pricing
                </h4>
                <p>
                  All products displayed on our online storefront represent certified tangible consumer electronics
                  and renewable energy hardware (HSN Code 8541 / 8504). All listed prices are in Indian Rupees (INR)
                  and are inclusive of applicable Goods and Services Tax (GST 18%). We reserve the right to revise
                  inventory allocations, MRPs, and promotional discounts at our discretion prior to payment confirmation.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  3. Secure Payments & Gateway
                </h4>
                <p>
                  Payments are processed through Razorpay's RBI-authorized, PCI-DSS Level 1 compliant payment gateway.
                  Supported payment methods include UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking across 50+
                  Indian banks, Debit Cards, and Credit Cards. We do not store sensitive payment credentials such as
                  CVV numbers or UPI PINs.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  4. Manufacturer Warranty & Product Support
                </h4>
                <p>
                  All hardware units are backed by comprehensive on-site manufacturer replacement warranties ranging
                  from 1 Year to 5 Years depending on the equipment model. Warranty claims are serviced directly by
                  our certified field engineering team.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  5. Governing Law & Jurisdiction
                </h4>
                <p>
                  This agreement shall be interpreted in accordance with the Information Technology Act, 2000 and the
                  Consumer Protection (E-Commerce) Rules, 2020 of the Republic of India. Courts in Gurugram, Haryana
                  shall have exclusive jurisdiction.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SHIPPING AND DELIVERY POLICY */}
          {activePolicyTab === 'shipping' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">
                <span className="font-bold">Shipping & Logistics Fulfillment Policy</span>
                <p className="text-[11px] mt-0.5 text-blue-700 dark:text-blue-300">
                  Standard delivery timeline: 3 to 5 business days pan-India via express surface courier.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-emerald-600 font-extrabold text-base">24 - 48 Hrs</div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Order Dispatch Time</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-teal-600 font-extrabold text-base">3 - 5 Days</div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Doorstep Delivery</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-amber-600 font-extrabold text-base">FREE Delivery</div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-0.5">On All Orders Above $5</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  1. Logistics Partners & Coverage
                </h4>
                <p>
                  We partner with top-tier courier networks including <strong>Delhivery Surface Express</strong>,{' '}
                  <strong>BlueDart</strong>, and <strong>DTDC</strong> to ensure safe and tamper-evident delivery
                  of delicate solar hardware and power storage equipment across 19,000+ Indian PIN codes.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  2. Real-Time Tracking (AWB Consignment Number)
                </h4>
                <p>
                  Upon handover to our logistics partner, an Air Waybill (AWB) consignment tracking number is generated
                  and sent via SMS and Email to the customer. You can track package transit status in real time through
                  your account dashboard under the "My Orders" tab.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  3. Inspection Upon Delivery & Damaged Transit
                </h4>
                <p>
                  We encourage customers to verify the security seal and packaging condition before accepting delivery.
                  In the rare event of transit damage, please refuse delivery or notify our care desk within 24 hours
                  with photographs for an instant replacement dispatch.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: REFUND, RETURN AND CANCELLATION */}
          {activePolicyTab === 'refund' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                <span className="font-bold">7-Day Replacement & 100% Refund Guarantee</span>
                <p className="text-[11px] mt-0.5 text-emerald-700 dark:text-emerald-300">
                  Full buyer protection for damaged, defective, or incorrect equipment deliveries.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  1. Order Cancellation Policy
                </h4>
                <p>
                  You may cancel your retail order free of charge at any time prior to warehouse packaging and courier
                  dispatch. Once the consignment has been collected by the courier, standard return procedures apply.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  2. 7-Day Return & Replacement Window
                </h4>
                <p>
                  Customers are eligible for a replacement or return within 7 calendar days from the date of physical
                  delivery under the following circumstances:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Product arrived physically damaged or cosmetically compromised.</li>
                  <li>Delivered item does not match ordered model, SKU, or technical specifications.</li>
                  <li>Equipment fails initial electrical commissioning test or power output inspection.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  3. Refund Processing Timeline
                </h4>
                <p>
                  Approved refunds are processed within 24 to 48 hours of verification and are credited back to the
                  original payment method (UPI / Bank Account / Card) via Razorpay within <strong>5 to 7 business days</strong>,
                  in accordance with Reserve Bank of India settlement regulations.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY POLICY */}
          {activePolicyTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200">
                <span className="font-bold">Data Privacy & Security Safeguards</span>
                <p className="text-[11px] mt-0.5 text-purple-700 dark:text-purple-300">
                  Compliant with the Digital Personal Data Protection Act (DPDP), 2023.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  1. Information We Collect
                </h4>
                <p>
                  When you make a retail hardware purchase, we collect necessary contact information (name, phone number,
                  email) and physical shipping destination (street address, city, state, pincode) strictly to fulfill
                  courier delivery and comply with statutory GST tax invoice filing.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  2. Payment Data Protection
                </h4>
                <p>
                  All transactional payments are encrypted end-to-end via 256-bit TLS encryption by Razorpay Software
                  Pvt Ltd. Our servers never retain credit card numbers, CVVs, or bank login passwords.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  3. Third-Party Sharing Restrictions
                </h4>
                <p>
                  We do not sell, rent, or lease buyer personal information to any third-party marketing companies. Data is
                  shared solely with authorized logistics partners (Delhivery / BlueDart) for physical consignment delivery.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: CONTACT US & GRIEVANCE REDRESSAL (MANDATORY FOR RAZORPAY KYC) */}
          {activePolicyTab === 'contact' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  Registered Corporate Headquarters & Grievance Desk
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Official registered details verified for Razorpay Merchant Onboarding & Tax Compliance.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-xs">
                    <Building className="w-4 h-4" />
                    <span>Legal Corporate Entity</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{company}</div>
                  <div className="text-[11px] text-slate-500">Brand: {store}</div>
                  <div className="text-[11px] text-slate-500 font-mono">CIN: U40106HR2023PTC110294</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>GSTIN Registration</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">{gst}</div>
                  <div className="text-[11px] text-slate-500">Category: Renewable Solar & Electronic Equipment</div>
                  <div className="text-[11px] text-emerald-600 font-semibold">Active & Tax Compliant</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                    <MapPin className="w-4 h-4" />
                    <span>Registered Office Address</span>
                  </div>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{address}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    <Mail className="w-4 h-4" />
                    <span>Support Desk & Phone</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">Email: {email}</div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">Phone: {phone}</div>
                  <div className="text-[11px] text-slate-500">Hours: Mon-Sat, 9:30 AM to 6:30 PM IST</div>
                </div>
              </div>

              {/* Grievance Officer details per IT Act */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <h5 className="font-bold text-xs text-slate-900 dark:text-white mb-1">
                  Statutory Grievance Redressal Officer
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  In accordance with Information Technology Act 2000 and rules made thereunder:
                </p>
                <div className="mt-2 text-[11px] space-y-0.5 text-slate-700 dark:text-slate-300">
                  <div><strong>Officer Name:</strong> Mr. Gaurav Kumar</div>
                  <div><strong>Designation:</strong> Head of Compliance & Logistics</div>
                  <div><strong>Email:</strong> grievance@hdenergy.shop</div>
                  <div><strong>Response Time:</strong> Within 48 business hours</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px]">Merchant Category Code (MCC): 5732 (Retail Electronics & Hardware)</span>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors shadow-sm"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
