import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FlaskConical,
  Globe,
  LayoutTemplate,
  MonitorSmartphone,
  RefreshCw,
  Save,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AdMobPlacementConfig, PlatformSettings } from '../types';
import { AdMobBanner, deriveAdMobPublisherId } from './AdMobBanner';

const GOOGLE_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';
const GOOGLE_TEST_PUB_ID = 'pub-3940256099942544';

export const AdminAdMobManager: React.FC = () => {
  const { platformSettings, updatePlatformSettings, showToast } = useApp();

  const [isAdMobEnabled, setIsAdMobEnabled] = useState<boolean>(
    platformSettings.isAdMobEnabled !== false
  );
  const [adMobTestMode, setAdMobTestMode] = useState<boolean>(
    platformSettings.adMobTestMode !== false
  );
  const [adMobAppId, setAdMobAppId] = useState<string>(
    platformSettings.adMobAppId || GOOGLE_TEST_APP_ID
  );
  const [adMobBannerUnitId, setAdMobBannerUnitId] = useState<string>(
    platformSettings.adMobBannerUnitId || GOOGLE_TEST_BANNER_UNIT_ID
  );
  const [adMobPublisherId, setAdMobPublisherId] = useState<string>(
    platformSettings.adMobPublisherId || GOOGLE_TEST_PUB_ID
  );
  const [adSenseBannerSlot, setAdSenseBannerSlot] = useState<string>(
    platformSettings.adSenseBannerSlot || ''
  );
  const [adMobBannerSize, setAdMobBannerSize] = useState<
    'BANNER_320x50' | 'ADAPTIVE_BANNER' | 'LARGE_BANNER_320x100'
  >(platformSettings.adMobBannerSize || 'ADAPTIVE_BANNER');
  const [adMobPosition, setAdMobPosition] = useState<'inline' | 'top' | 'bottom'>(
    platformSettings.adMobPosition || 'inline'
  );
  const [adMobRefreshSeconds, setAdMobRefreshSeconds] = useState<number>(
    Number(platformSettings.adMobRefreshSeconds || 60)
  );
  const [adMobPlacements, setAdMobPlacements] = useState<AdMobPlacementConfig>({
    home: platformSettings.adMobPlacements?.home !== false,
    invest: platformSettings.adMobPlacements?.invest !== false,
    notice: platformSettings.adMobPlacements?.notice !== false,
    blog: platformSettings.adMobPlacements?.blog !== false,
    account: platformSettings.adMobPlacements?.account !== false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsAdMobEnabled(platformSettings.isAdMobEnabled !== false);
    setAdMobTestMode(platformSettings.adMobTestMode !== false);
    if (platformSettings.adMobAppId !== undefined) setAdMobAppId(platformSettings.adMobAppId);
    if (platformSettings.adMobBannerUnitId !== undefined)
      setAdMobBannerUnitId(platformSettings.adMobBannerUnitId);
    if (platformSettings.adMobPublisherId !== undefined)
      setAdMobPublisherId(platformSettings.adMobPublisherId);
    if (platformSettings.adSenseBannerSlot !== undefined)
      setAdSenseBannerSlot(platformSettings.adSenseBannerSlot);
    if (platformSettings.adMobBannerSize) setAdMobBannerSize(platformSettings.adMobBannerSize);
    if (platformSettings.adMobPosition) setAdMobPosition(platformSettings.adMobPosition);
    if (platformSettings.adMobRefreshSeconds)
      setAdMobRefreshSeconds(Number(platformSettings.adMobRefreshSeconds));
    if (platformSettings.adMobPlacements) {
      setAdMobPlacements({
        home: platformSettings.adMobPlacements.home !== false,
        invest: platformSettings.adMobPlacements.invest !== false,
        notice: platformSettings.adMobPlacements.notice !== false,
        blog: platformSettings.adMobPlacements.blog !== false,
        account: platformSettings.adMobPlacements.account !== false,
      });
    }
  }, [platformSettings]);

  const draftPreviewSettings: Partial<PlatformSettings> = {
    isAdMobEnabled,
    adMobTestMode,
    adMobAppId: adMobAppId.trim() || GOOGLE_TEST_APP_ID,
    adMobBannerUnitId: adMobBannerUnitId.trim() || GOOGLE_TEST_BANNER_UNIT_ID,
    adMobPublisherId: adMobPublisherId.trim(),
    adSenseBannerSlot: adSenseBannerSlot.trim(),
    adMobBannerSize,
    adMobPosition,
    adMobPlacements,
    adMobRefreshSeconds,
  };

  const derivedPubId = deriveAdMobPublisherId(draftPreviewSettings);
  const appAdsTxtLine = `google.com, ${derivedPubId}, DIRECT, f08c47fec0942fa0`;

  const handleLoadGoogleTestIds = () => {
    setAdMobTestMode(true);
    setAdMobAppId(GOOGLE_TEST_APP_ID);
    setAdMobBannerUnitId(GOOGLE_TEST_BANNER_UNIT_ID);
    setAdMobPublisherId(GOOGLE_TEST_PUB_ID);
    showToast('Google Official AdMob Test IDs loaded! Save to apply.', 'info');
  };

  const handleSaveAdMobSettings = async (override?: Partial<PlatformSettings>) => {
    setIsSaving(true);
    try {
      const payload: Partial<PlatformSettings> = {
        isAdMobEnabled,
        adMobTestMode,
        adMobAppId: adMobAppId.trim(),
        adMobBannerUnitId: adMobBannerUnitId.trim(),
        adMobPublisherId: derivedPubId,
        adSenseBannerSlot: adSenseBannerSlot.trim(),
        adMobBannerSize,
        adMobPosition,
        adMobPlacements,
        adMobRefreshSeconds: Math.max(30, Number(adMobRefreshSeconds) || 60),
        ...override,
      };
      await updatePlatformSettings(payload);
      showToast('Google AdMob Banner Ads settings saved & synced live!', 'success');
    } catch (err: any) {
      showToast(`Failed to save AdMob settings: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleScreen = (key: keyof AdMobPlacementConfig) => {
    setAdMobPlacements((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const screenList: { key: keyof AdMobPlacementConfig; label: string; desc: string }[] = [
    { key: 'home', label: 'Home Screen', desc: 'Main dashboard & wallets view' },
    { key: 'invest', label: 'Store / Invest', desc: 'Hardware products & yield plans' },
    { key: 'notice', label: 'Official Notices', desc: 'Platform updates & announcements' },
    { key: 'blog', label: 'Blog & News', desc: 'Clean energy articles feed' },
    { key: 'account', label: 'Account & Wallet', desc: 'User profile, VIP & menu screen' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <MonitorSmartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Google AdMob Banner Ads Integration
              </h2>
              <p className="text-xs text-slate-400">
                Configure Android/iOS AdMob SDK Bridge, Web AdSense fallback, /app-ads.txt & screen placements
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleLoadGoogleTestIds}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Load Official Test IDs</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveAdMobSettings()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save AdMob Settings'}</span>
          </button>
        </div>
      </div>

      {/* Master Toggles & Credentials Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: SDK Credentials & Mode */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">AdMob App & Banner Unit Credentials</h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isAdMobEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isAdMobEnabled ? (adMobTestMode ? 'TEST MODE' : 'LIVE MODE') : 'DISABLED'}
            </span>
          </div>

          {/* Toggle switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">Enable Banner Ads</div>
                <div className="text-[10px] text-slate-400">Master switch across User App</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isAdMobEnabled}
                onClick={() => {
                  const next = !isAdMobEnabled;
                  setIsAdMobEnabled(next);
                  handleSaveAdMobSettings({ isAdMobEnabled: next });
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  isAdMobEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    isAdMobEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">Google Test Mode</div>
                <div className="text-[10px] text-slate-400">Safe test ads while developing</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={adMobTestMode}
                onClick={() => setAdMobTestMode((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  adMobTestMode ? 'bg-amber-500' : 'bg-cyan-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    adMobTestMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Google AdMob App ID
              </label>
              <input
                type="text"
                value={adMobAppId}
                onChange={(e) => setAdMobAppId(e.target.value)}
                placeholder="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Used by Android/Capacitor AdMob SDK & app-ads.txt publisher detection
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Banner Ad Unit ID
              </label>
              <input
                type="text"
                value={adMobBannerUnitId}
                onChange={(e) => setAdMobBannerUnitId(e.target.value)}
                placeholder="ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  AdMob Publisher ID (app-ads.txt)
                </label>
                <input
                  type="text"
                  value={adMobPublisherId}
                  onChange={(e) => setAdMobPublisherId(e.target.value)}
                  placeholder="pub-xxxxxxxxxxxxxxxx"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Web AdSense Slot ID (Optional PWA)
                </label>
                <input
                  type="text"
                  value={adSenseBannerSlot}
                  onChange={(e) => setAdSenseBannerSlot(e.target.value)}
                  placeholder="e.g. 1234567890"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Banner Size, Docking Position & Screen Visibility */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <LayoutTemplate className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Banner Size, Position & Screen Placements</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Banner Format
              </label>
              <select
                value={adMobBannerSize}
                onChange={(e) => setAdMobBannerSize(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="ADAPTIVE_BANNER">Adaptive Banner</option>
                <option value="BANNER_320x50">Standard 320×50</option>
                <option value="LARGE_BANNER_320x100">Large 320×100</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Layout Position
              </label>
              <select
                value={adMobPosition}
                onChange={(e) => setAdMobPosition(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="inline">Inline (Inside Screens)</option>
                <option value="top">Docked Top</option>
                <option value="bottom">Docked Above Nav</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Refresh Interval (sec)
              </label>
              <div className="relative">
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={adMobRefreshSeconds}
                  onChange={(e) => setAdMobRefreshSeconds(Math.max(30, Number(e.target.value) || 60))}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-300">Active Screens</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {screenList.map((item) => {
                const active = adMobPlacements[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToggleScreen(item.key)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{item.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                    </div>
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview & /app-ads.txt Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Live Mobile Banner Preview */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Live User App Banner Preview</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{adMobBannerSize}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-w-md mx-auto">
            {isAdMobEnabled ? (
              <AdMobBanner
                placement="home"
                forceVisible={true}
                previewSettings={draftPreviewSettings}
              />
            ) : (
              <div className="py-4 text-center text-xs text-slate-500">
                Banner Ads are currently disabled
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            In Android/Capacitor APK builds, this slot automatically invokes{' '}
            <span className="font-mono text-slate-200">Capacitor.Plugins.AdMob</span> /{' '}
            <span className="font-mono text-slate-200">window.AndroidAdMob</span> with your Banner Unit ID.
          </p>
        </div>

        {/* app-ads.txt Verification Card */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Dynamic /app-ads.txt & /ads.txt</h3>
            </div>
            <a
              href="/app-ads.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1"
            >
              <span>Open /app-ads.txt</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
            <code className="text-xs font-mono text-emerald-300 break-all">
              {appAdsTxtLine}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(appAdsTxtLine);
                showToast('Copied /app-ads.txt line!', 'success');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Your Express server automatically serves this exact line at both{' '}
              <span className="font-mono text-slate-200">/app-ads.txt</span> and{' '}
              <span className="font-mono text-slate-200">/ads.txt</span> whenever you save your AdMob App ID or Publisher ID.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
