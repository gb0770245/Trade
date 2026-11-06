import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { pwaService } from '../services/pwaService';
import {
  X,
  Download,
  Smartphone,
  ShieldCheck,
  Star,
  CheckCircle2,
  Sparkles,
  Share2,
  Apple,
  ExternalLink,
  Zap,
  Lock,
  Award,
} from 'lucide-react';

export const AppDownloadModal: React.FC = () => {
  const { closeModal } = useApp();
  const [canInstall, setCanInstall] = useState(pwaService.canInstall);
  const [isInstalled, setIsInstalled] = useState(pwaService.isInstalled);
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    // Detect OS
    if (pwaService.isIOSDevice) {
      setActiveTab('ios');
    } else {
      setActiveTab('android');
    }

    const unsubscribe = pwaService.subscribe(() => {
      setCanInstall(pwaService.canInstall);
      setIsInstalled(pwaService.isInstalled);
    });
    return unsubscribe;
  }, []);

  const handleInstallPWA = async () => {
    const outcome = await pwaService.triggerInstall();
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const shareText = encodeURIComponent(
      `⚡ Download Nexa AI Official Mobile App & Claim $1.00 Free Bonus! Daily investment earnings with 100% instant withdrawals: ${window.location.origin}`
    );
    window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Top Header Banner with Emerald/Teal Theme */}
        <div className="relative bg-gradient-to-br from-teal-700 via-emerald-700 to-teal-900 text-white p-5 pb-6">
          <button
            type="button"
            onClick={closeModal}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center text-white/90 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 p-1 shadow-xl shrink-0 flex items-center justify-center overflow-hidden border border-teal-500/40">
              <img
                src="/logo.png"
                alt="Nexa AI App Icon"
                className="w-full h-full object-contain select-none"
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold tracking-tight text-white">
                  Nexa AI Official App
                </h3>
                <span className="p-0.5 rounded-full bg-emerald-400 text-teal-950" title="Official Verified">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="text-xs text-teal-100 font-medium mt-0.5">
                Version 2.4.0 · Smart AI & Clean Energy
              </p>
              
              {/* Trust Metrics Pill */}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-teal-200">
                <span className="flex items-center gap-1 font-bold text-amber-300">
                  <Star className="w-3.5 h-3.5 fill-amber-300" />
                  4.9
                </span>
                <span>•</span>
                <span>500K+ Installs</span>
                <span>•</span>
                <span>18.5 MB</span>
              </div>
            </div>
          </div>

          {/* Bonus Incentive Tag */}
          <div className="mt-4 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Install Bonus: Claim $1.00 App Credit
            </span>
            <span className="text-[10px] bg-amber-400 text-teal-950 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
              Free
            </span>
          </div>
        </div>

        {/* Operating System Platform Selector */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'android'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'ios'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Apple className="w-3.5 h-3.5" />
              <span>iPhone / iOS</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'android' && (
            <div className="space-y-4">
              {/* Option 1: Native 1-Tap Home Screen Installation */}
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-200/60 dark:bg-teal-900/60 px-2 py-0.5 rounded-md">
                      Official · 1-Click
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                      Direct Home Screen Install
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Instantly adds official verified app icon to your phone with full offline capability.
                    </p>
                  </div>
                </div>

                {isInstalled ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>App is already installed on your mobile device!</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleInstallPWA}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20 active:scale-98 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Official App (1-Click)</span>
                  </button>
                )}
              </div>

              {/* Share actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Link Copied!' : 'Copy App Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
                  <Apple className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>Install on iPhone (Safari Browser)</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Apple iOS allows installing web applications directly from Safari without going to the App Store:
                </p>

                <div className="space-y-2.5 pt-1 text-xs text-slate-700 dark:text-slate-200">
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <p className="font-bold">Tap Safari Share Button</p>
                      <p className="text-[11px] text-slate-500">Tap the square icon with an upward arrow at the bottom of Safari.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <p className="font-bold">Select &quot;Add to Home Screen&quot;</p>
                      <p className="text-[11px] text-slate-500">Scroll down in the action sheet and tap <strong>&quot;Add to Home Screen&quot; (➕)</strong>.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <p className="font-bold">Tap &quot;Add&quot; on Top Right</p>
                      <p className="text-[11px] text-slate-500">The official Nexa AI icon will appear directly on your iPhone home screen!</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Share actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Link Copied!' : 'Copy App Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {/* Key Advantages Checklist */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              App Features & Security
            </h5>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <Zap className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">3x Speed</span>
                <span className="text-[9px] text-slate-400">Zero lag</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <Lock className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">Bank Grade</span>
                <span className="text-[9px] text-slate-400">256-bit SSL</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <Award className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">Auto Alerts</span>
                <span className="text-[9px] text-slate-400">Daily dividend</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Close Button */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
