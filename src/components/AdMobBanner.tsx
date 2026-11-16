import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AdMobPlacementConfig, PlatformSettings } from '../types';

export type AdMobScreenPlacement = keyof AdMobPlacementConfig;

interface AdMobBannerProps {
  placement: AdMobScreenPlacement;
  variant?: 'inline' | 'docked-top' | 'docked-bottom';
  previewSettings?: Partial<PlatformSettings>;
  forceVisible?: boolean;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
    Capacitor?: {
      Plugins?: {
        AdMob?: {
          initialize?: (opts?: Record<string, any>) => Promise<void>;
          showBanner?: (opts: Record<string, any>) => Promise<void>;
          hideBanner?: () => Promise<void>;
          removeBanner?: () => Promise<void>;
        };
      };
    };
    AndroidAdMob?: {
      showBanner?: (unitId: string, size: string, position: string, isTest: boolean) => void;
      hideBanner?: () => void;
    };
    ReactNativeWebView?: {
      postMessage: (msg: string) => void;
    };
  }
}

const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

export function deriveAdMobPublisherId(settings?: Partial<PlatformSettings>): string {
  const explicit = String(settings?.adMobPublisherId || '').trim();
  if (explicit) {
    const cleaned = explicit.replace(/^ca-/, '');
    return cleaned.startsWith('pub-') ? cleaned : `pub-${cleaned.replace(/^pub-/, '')}`;
  }
  const source = String(settings?.adMobAppId || settings?.adMobBannerUnitId || '').trim();
  const match = source.match(/ca-app-(pub-\d+)/i) || source.match(/(pub-\d+)/i);
  if (match?.[1]) return match[1].toLowerCase();
  return 'pub-3940256099942544';
}

const SAMPLE_CREATIVES = [
  {
    headline: 'Clean Grid Cloud Analytics',
    description: 'Track solar & hydrogen hardware output in real time on Android & iOS.',
    cta: 'Explore',
    actionModal: 'invest' as const,
  },
  {
    headline: 'Instant P2P & Wallet Protection',
    description: 'Zero-fee internal wallet transfers with instant verification.',
    cta: 'Open P2P',
    actionModal: 'p2p' as const,
  },
  {
    headline: 'Official Mobile App Bonus',
    description: 'Install Nexa AI PWA on your home screen for one-tap access.',
    cta: 'Install',
    actionModal: 'download' as const,
  },
];

let capacitorAdMobInitialized = false;

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  placement,
  variant = 'inline',
  previewSettings,
  forceVisible = false,
  className = '',
}) => {
  const { platformSettings, theme, setActiveTab, openModal, showToast } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const [creativeIndex, setCreativeIndex] = useState(0);
  const [showAdInfo, setShowAdInfo] = useState(false);
  const adContainerRef = useRef<HTMLDivElement | null>(null);
  const adsensePushedRef = useRef<string>('');

  const effective = useMemo(
    () => ({
      ...platformSettings,
      ...(previewSettings || {}),
      adMobPlacements: {
        home: true,
        invest: true,
        notice: true,
        blog: true,
        account: true,
        ...(platformSettings.adMobPlacements || {}),
        ...(previewSettings?.adMobPlacements || {}),
      },
    }),
    [platformSettings, previewSettings]
  );

  const isEnabled = effective.isAdMobEnabled !== false;
  const isPlacementAllowed = effective.adMobPlacements?.[placement] !== false;
  const configuredPosition = effective.adMobPosition || 'inline';

  const matchesVariant = useMemo(() => {
    if (forceVisible) return true;
    if (variant === 'inline') return configuredPosition === 'inline';
    if (variant === 'docked-top') return configuredPosition === 'top';
    if (variant === 'docked-bottom') return configuredPosition === 'bottom';
    return false;
  }, [forceVisible, variant, configuredPosition]);

  const isTestMode = effective.adMobTestMode !== false;
  const appId = effective.adMobAppId?.trim() || TEST_APP_ID;
  const bannerUnitId = effective.adMobBannerUnitId?.trim() || TEST_BANNER_UNIT_ID;
  const publisherId = deriveAdMobPublisherId(effective);
  const adSenseSlot = effective.adSenseBannerSlot?.trim() || '';
  const bannerSize = effective.adMobBannerSize || 'ADAPTIVE_BANNER';
  const refreshSeconds = Math.max(30, Number(effective.adMobRefreshSeconds || 60));

  const isNativeAdMobAvailable =
    typeof window !== 'undefined' &&
    Boolean(
      window.Capacitor?.Plugins?.AdMob ||
        window.AndroidAdMob ||
        window.ReactNativeWebView
    );

  const shouldRenderWebAdSense =
    !forceVisible &&
    !isNativeAdMobAvailable &&
    !isTestMode &&
    Boolean(adSenseSlot) &&
    publisherId !== 'pub-3940256099942544';

  // Auto-refresh rotating creative index for web preview/test mode
  useEffect(() => {
    if (!isEnabled || !isPlacementAllowed || !matchesVariant || dismissed || shouldRenderWebAdSense) {
      return;
    }
    const timer = setInterval(() => {
      setCreativeIndex((prev) => (prev + 1) % SAMPLE_CREATIVES.length);
    }, refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [isEnabled, isPlacementAllowed, matchesVariant, dismissed, shouldRenderWebAdSense, refreshSeconds]);

  // Native Hybrid AdMob Bridge (Capacitor / Android WebView / React Native WebView)
  useEffect(() => {
    if (forceVisible || !isEnabled || !isPlacementAllowed || !matchesVariant || dismissed) {
      return;
    }
    if (typeof window === 'undefined') return;

    const nativePos = configuredPosition === 'top' ? 'TOP_CENTER' : 'BOTTOM_CENTER';

    if (window.Capacitor?.Plugins?.AdMob) {
      const admobPlugin = window.Capacitor.Plugins.AdMob;
      const runCapacitorBanner = async () => {
        try {
          if (!capacitorAdMobInitialized && admobPlugin.initialize) {
            await admobPlugin.initialize({
              requestTrackingAuthorization: true,
              initializeForTesting: isTestMode,
            });
            capacitorAdMobInitialized = true;
          }
          if (admobPlugin.showBanner) {
            await admobPlugin.showBanner({
              adId: isTestMode ? TEST_BANNER_UNIT_ID : bannerUnitId,
              adSize:
                bannerSize === 'LARGE_BANNER_320x100'
                  ? 'LARGE_BANNER'
                  : bannerSize === 'BANNER_320x50'
                  ? 'BANNER'
                  : 'ADAPTIVE_BANNER',
              position: nativePos,
              margin: configuredPosition === 'bottom' ? 68 : 0,
              isTesting: isTestMode,
            });
          }
        } catch (err) {
          console.warn('Capacitor AdMob showBanner notice:', err);
        }
      };
      runCapacitorBanner();
      return () => {
        admobPlugin.hideBanner?.().catch(() => {});
      };
    }

    if (window.AndroidAdMob?.showBanner) {
      try {
        window.AndroidAdMob.showBanner(
          isTestMode ? TEST_BANNER_UNIT_ID : bannerUnitId,
          bannerSize,
          nativePos,
          isTestMode
        );
      } catch {}
      return () => {
        try {
          window.AndroidAdMob?.hideBanner?.();
        } catch {}
      };
    }

    if (window.ReactNativeWebView?.postMessage) {
      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'ADMOB_SHOW_BANNER',
            appId,
            adUnitId: isTestMode ? TEST_BANNER_UNIT_ID : bannerUnitId,
            size: bannerSize,
            position: nativePos,
            isTesting: isTestMode,
          })
        );
      } catch {}
      return () => {
        try {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ADMOB_HIDE_BANNER' }));
        } catch {}
      };
    }
  }, [
    forceVisible,
    isEnabled,
    isPlacementAllowed,
    matchesVariant,
    dismissed,
    isTestMode,
    appId,
    bannerUnitId,
    bannerSize,
    configuredPosition,
  ]);

  // Dynamic Web AdSense script injection when Live Mode + AdSense slot configured
  useEffect(() => {
    if (!shouldRenderWebAdSense || !isEnabled || !isPlacementAllowed || !matchesVariant || dismissed) {
      return;
    }
    if (typeof document === 'undefined') return;

    const clientAttr = `ca-${publisherId}`;
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-nexa-adsense="true"]'
    );

    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.nexaAdsense = 'true';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        clientAttr
      )}`;
      document.head.appendChild(script);
    }

    const pushKey = `${clientAttr}:${adSenseSlot}:${placement}:${variant}`;
    if (adsensePushedRef.current !== pushKey) {
      adsensePushedRef.current = pushKey;
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch {}
    }
  }, [
    shouldRenderWebAdSense,
    isEnabled,
    isPlacementAllowed,
    matchesVariant,
    dismissed,
    publisherId,
    adSenseSlot,
    placement,
    variant,
  ]);

  if (!isEnabled || !isPlacementAllowed || !matchesVariant || dismissed) {
    return null;
  }

  // If native Android/Capacitor AdMob SDK owns the overlay, reserve compact spacing when docked
  if (isNativeAdMobAvailable && !forceVisible) {
    return (
      <div
        className={`w-full ${
          bannerSize === 'LARGE_BANNER_320x100' && variant === 'inline' ? 'h-[100px]' : 'h-[54px]'
        }`}
        aria-hidden="true"
      />
    );
  }

  const effectiveSize =
    variant === 'docked-bottom' || variant === 'docked-top'
      ? bannerSize === 'LARGE_BANNER_320x100'
        ? 'ADAPTIVE_BANNER'
        : bannerSize
      : bannerSize;

  const heightClass =
    effectiveSize === 'LARGE_BANNER_320x100'
      ? 'min-h-[96px]'
      : effectiveSize === 'BANNER_320x50'
      ? 'min-h-[50px]'
      : 'min-h-[58px]';

  const getThemeCardClasses = () => {
    if (theme === 'obsidian-gold') {
      return {
        shell:
          'bg-slate-900/95 border-amber-500/30 text-slate-100 shadow-lg shadow-black/40',
        badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/35',
        subtext: 'text-slate-400',
        cta: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
      };
    }
    if (theme === 'cyber-hydrogen') {
      return {
        shell:
          'bg-slate-900/95 border-cyan-500/30 text-slate-100 shadow-lg shadow-black/40',
        badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35',
        subtext: 'text-slate-400',
        cta: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400',
      };
    }
    return {
      shell:
        'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-sm',
      badge:
        'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30',
      subtext: 'text-slate-500 dark:text-slate-400',
      cta: 'bg-teal-700 text-white hover:bg-teal-800',
    };
  };

  const styles = getThemeCardClasses();
  const creative = SAMPLE_CREATIVES[creativeIndex % SAMPLE_CREATIVES.length];

  const handleCreativeClick = () => {
    if (forceVisible) {
      showToast('Preview banner clicked — opens configured destination in User App', 'info');
      return;
    }
    if (creative.actionModal === 'invest') {
      setActiveTab('invest');
    } else if (creative.actionModal === 'p2p') {
      openModal('p2p');
    } else {
      openModal('download');
    }
  };

  const bannerContent = (
    <div
      ref={adContainerRef}
      data-admob-unit={bannerUnitId}
      data-admob-placement={placement}
      className={`w-full rounded-xl border ${styles.shell} ${heightClass} px-3 py-2 flex items-center justify-between gap-2.5 relative overflow-hidden transition-colors`}
    >
      {shouldRenderWebAdSense ? (
        <div className="w-full flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${styles.badge}`}>
              Ad
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Close ad"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ins
            className="adsbygoogle block w-full overflow-hidden"
            style={{ display: 'block', minHeight: effectiveSize === 'BANNER_320x50' ? 50 : 60 }}
            data-ad-client={`ca-${publisherId}`}
            data-ad-slot={adSenseSlot}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        <>
          {/* Google AdMob Adaptive / Test Banner Layout */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${styles.badge}`}>
                  Ad
                </span>
                <span className="text-[11px] font-bold truncate">
                  {isTestMode ? `AdMob Test Banner · ${creative.headline}` : creative.headline}
                </span>
              </div>
              <p className={`text-[10px] truncate mt-0.5 ${styles.subtext}`}>
                {effectiveSize === 'LARGE_BANNER_320x100'
                  ? creative.description
                  : isTestMode
                  ? `Unit: ${bannerUnitId.slice(-14)} • Adaptive ${effectiveSize === 'BANNER_320x50' ? '320×50' : 'Banner'}`
                  : creative.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCreativeClick}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer ${styles.cta}`}
            >
              <span>{creative.cta}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowAdInfo((prev) => !prev)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Ad choices & verification"
              aria-label="Ad information"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>

            {!forceVisible && (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Hide banner"
                aria-label="Hide banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}

      {showAdInfo && (
        <div
          onClick={() => setShowAdInfo(false)}
          className="absolute inset-0 bg-slate-950/92 text-white px-3 py-1.5 flex items-center justify-between gap-2 text-[10px] z-10 cursor-pointer"
        >
          <span className="truncate font-mono text-emerald-300">
            AdMob {isTestMode ? 'Test' : 'Live'} • {publisherId} • Unit {bannerUnitId}
          </span>
          <span className="text-slate-300 font-bold shrink-0">Tap to close</span>
        </div>
      )}
    </div>
  );

  if (variant === 'docked-top') {
    return (
      <div className={`w-full px-3 pt-2 pb-1 z-20 ${className}`}>
        {bannerContent}
      </div>
    );
  }

  if (variant === 'docked-bottom') {
    return (
      <div
        className={`fixed bottom-16 left-0 right-0 z-30 flex justify-center pointer-events-none px-2 pb-1.5 ${className}`}
      >
        <div className="w-full max-w-md pointer-events-auto">{bannerContent}</div>
      </div>
    );
  }

  return <div className={`w-full ${className}`}>{bannerContent}</div>;
};
