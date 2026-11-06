import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit,
  MoveUp,
  MoveDown,
  Eye,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  Save,
  RotateCcw,
  Sliders,
  Layers,
  ArrowRight,
  Flame,
  Gift,
  Users,
  Headphones,
  Download,
  Bell,
  Check,
  X,
  Play
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HomeBanner, BannerActionType } from '../types';
import { DEFAULT_HOME_BANNERS } from '../data/mockData';

const PRESET_PHOTOS = [
  {
    name: 'Modern HQ Glass Skyscraper',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
    badge: 'NEXA AI GREEN POWER',
    title: 'Clean Energy Infrastructure Fund',
    subtitle: 'Daily automated returns · 100% Guaranteed Tariff',
    action: 'invest' as BannerActionType,
  },
  {
    name: 'Solar Mega Grid Arrays',
    url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
    badge: 'INSTANT RETURNS',
    title: 'Photovoltaic Mega Grid Assets',
    subtitle: 'Invest $280 today · Receive $240.80 daily profits',
    action: 'recharge' as BannerActionType,
  },
  {
    name: 'Wind Kinetic Generator Farm',
    url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1000&q=80',
    badge: 'HIGH YIELD',
    title: 'Offshore Turbine Matrix Omega',
    subtitle: 'MNRE Certified · Commercial Clean Power Purchase Guarantee',
    action: 'invest' as BannerActionType,
  },
  {
    name: 'Golden Lucky Wheel & Prizes',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80',
    badge: 'DAILY CASH WHEEL',
    title: 'Spin & Win Mega Cash Dividends',
    subtitle: '1 Free daily spin for all members · Win up to $10,000 cash',
    action: 'spin' as BannerActionType,
  },
  {
    name: 'Partner Team Collaboration',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80',
    badge: '10% REWARD',
    title: 'Nexa AI Partner Team Program',
    subtitle: 'Earn 10% Level 1, 3% Level 2, 1% Level 3 direct bonus',
    action: 'team' as BannerActionType,
  },
  {
    name: 'Nexa AI Official Crest Logo Badge',
    url: '/logo.png',
    badge: 'OFFICIAL APP',
    title: 'Nexa AI — Smarter Today • Bigger Tomorrow',
    subtitle: 'Official clean energy hardware & daily dividend ecosystem',
    action: 'app_download' as BannerActionType,
  },
];

export const AdminBannerManager: React.FC = () => {
  const { platformSettings, updatePlatformSettings, showToast, setActiveTab, openModal, setIsAdminView } = useApp();

  const [banners, setBanners] = useState<HomeBanner[]>(
    platformSettings.homeBanners && platformSettings.homeBanners.length > 0
      ? platformSettings.homeBanners
      : DEFAULT_HOME_BANNERS
  );

  const [autoPlaySeconds, setAutoPlaySeconds] = useState<number>(
    platformSettings.bannerAutoPlaySpeedSeconds || 4
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);

  // Form State
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formBadge, setFormBadge] = useState('NEXA AI GREEN POWER');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formButtonText, setFormButtonText] = useState('Explore Projects');
  const [formActionType, setFormActionType] = useState<BannerActionType>('invest');
  const [formActionUrl, setFormActionUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const handleOpenAddModal = () => {
    setEditingBannerId(null);
    setFormImageUrl('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80');
    setFormBadge('NEXA AI GREEN POWER');
    setFormTitle('Clean Energy Infrastructure Fund');
    setFormSubtitle('Daily automated returns · 100% Guaranteed Tariff');
    setFormButtonText('Explore Projects');
    setFormActionType('invest');
    setFormActionUrl('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: HomeBanner) => {
    setEditingBannerId(b.id);
    setFormImageUrl(b.imageUrl);
    setFormBadge(b.badge || '');
    setFormTitle(b.title);
    setFormSubtitle(b.subtitle || '');
    setFormButtonText(b.buttonText || 'Explore');
    setFormActionType(b.actionType || 'invest');
    setFormActionUrl(b.actionUrl || '');
    setFormIsActive(b.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSaveBannerModal = async () => {
    if (!formImageUrl.trim()) {
      showToast('Please provide a valid Photo URL for the banner', 'error');
      return;
    }
    if (!formTitle.trim()) {
      showToast('Please provide a Banner Title', 'error');
      return;
    }

    let updatedList: HomeBanner[] = [];

    if (editingBannerId) {
      // Edit existing
      updatedList = banners.map((b) =>
        b.id === editingBannerId
          ? {
              ...b,
              imageUrl: formImageUrl.trim(),
              badge: formBadge.trim(),
              title: formTitle.trim(),
              subtitle: formSubtitle.trim(),
              buttonText: formButtonText.trim(),
              actionType: formActionType,
              actionUrl: formActionUrl.trim(),
              isActive: formIsActive,
            }
          : b
      );
      showToast('Banner updated locally. Click "Save & Publish" to sync to live app.', 'info');
    } else {
      // Add new
      const newBanner: HomeBanner = {
        id: `banner-${Date.now()}`,
        imageUrl: formImageUrl.trim(),
        badge: formBadge.trim(),
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        buttonText: formButtonText.trim(),
        actionType: formActionType,
        actionUrl: formActionUrl.trim(),
        isActive: formIsActive,
        order: banners.length + 1,
      };
      updatedList = [...banners, newBanner];
      showToast('New banner added! Click "Save & Publish" to sync to live app.', 'success');
    }

    setBanners(updatedList);
    setIsModalOpen(false);
  };

  const handleDeleteBanner = (id: string) => {
    if (banners.length <= 1) {
      showToast('You must keep at least 1 banner for the home screen', 'error');
      return;
    }
    const filtered = banners.filter((b) => b.id !== id);
    setBanners(filtered);
    showToast('Banner removed. Remember to click "Save & Publish".', 'info');
  };

  const handleToggleActive = (id: string) => {
    const updated = banners.map((b) =>
      b.id === id ? { ...b, isActive: !b.isActive } : b
    );
    setBanners(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...banners];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;
    // update order
    const fixed = reordered.map((b, idx) => ({ ...b, order: idx + 1 }));
    setBanners(fixed);
  };

  const handleMoveDown = (index: number) => {
    if (index === banners.length - 1) return;
    const reordered = [...banners];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;
    // update order
    const fixed = reordered.map((b, idx) => ({ ...b, order: idx + 1 }));
    setBanners(fixed);
  };

  const handleSaveAllToCloud = async () => {
    try {
      await updatePlatformSettings({
        homeBanners: banners,
        bannerAutoPlaySpeedSeconds: autoPlaySeconds,
      });
      showToast('All Home Banners successfully saved to Cloud Firestore & Live App!', 'success');
    } catch (err: any) {
      showToast(`Error saving banners: ${err.message}`, 'error');
    }
  };

  const handleResetDefaults = () => {
    setBanners(DEFAULT_HOME_BANNERS);
    showToast('Banners reset to defaults. Click "Save & Publish" to update Cloud.', 'info');
  };

  const handleApplyPreset = (preset: typeof PRESET_PHOTOS[0]) => {
    setFormImageUrl(preset.url);
    setFormBadge(preset.badge);
    setFormTitle(preset.title);
    setFormSubtitle(preset.subtitle);
    setFormActionType(preset.action);
    setFormButtonText(
      preset.action === 'invest'
        ? 'Explore Projects'
        : preset.action === 'recharge'
        ? 'Add Money'
        : preset.action === 'spin'
        ? 'Spin & Win'
        : preset.action === 'team'
        ? 'Invite Team'
        : 'Open'
    );
  };

  // Test action from admin
  const handleTestAction = (banner: HomeBanner) => {
    switch (banner.actionType) {
      case 'invest':
        setIsAdminView(false);
        setActiveTab('invest');
        break;
      case 'recharge':
        openModal('recharge');
        break;
      case 'spin':
        openModal('spin');
        break;
      case 'team':
        openModal('team');
        break;
      case 'support':
        openModal('support');
        break;
      case 'app_download':
        openModal('download');
        break;
      case 'notice':
        setIsAdminView(false);
        setActiveTab('notice');
        break;
      case 'url':
        if (banner.actionUrl) {
          window.open(banner.actionUrl, '_blank');
        } else {
          showToast('No URL specified for this banner', 'info');
        }
        break;
    }
  };

  const getActionBadge = (actionType: BannerActionType) => {
    switch (actionType) {
      case 'invest':
        return (
          <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> Opens Invest Store
          </span>
        );
      case 'recharge':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
            <Flame className="w-3 h-3" /> Opens Add Money Modal
          </span>
        );
      case 'spin':
        return (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1">
            <Gift className="w-3 h-3" /> Opens Lucky Wheel Modal
          </span>
        );
      case 'team':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
            <Users className="w-3 h-3" /> Opens Team Referral Modal
          </span>
        );
      case 'support':
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1">
            <Headphones className="w-3 h-3" /> Opens Support Chat
          </span>
        );
      case 'app_download':
        return (
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1">
            <Download className="w-3 h-3" /> Opens App Download
          </span>
        );
      case 'notice':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1">
            <Bell className="w-3 h-3" /> Opens Notice Board
          </span>
        );
      case 'url':
        return (
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Opens External URL
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-950/70 via-slate-900 to-emerald-950/50 border border-teal-800/40 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center font-black shadow-lg shadow-teal-900/50 shrink-0">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">
                Home Banners & Photo Slider Manager
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {banners.filter((b) => b.isActive).length} Active Banners
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Add any image link, set multi-functional actions (Add Money, Projects, Wheel, Referral, Support), and control auto-play timing.
            </p>
          </div>
        </div>

        {/* Top Header Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Auto-play speed picker */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-semibold">Speed:</span>
            <select
              value={autoPlaySeconds}
              onChange={(e) => setAutoPlaySeconds(Number(e.target.value))}
              className="bg-transparent text-emerald-400 font-bold font-mono outline-none cursor-pointer"
            >
              <option value={2} className="bg-slate-900 text-white">2s (Fast)</option>
              <option value={3} className="bg-slate-900 text-white">3s</option>
              <option value={4} className="bg-slate-900 text-white">4s (Recommended)</option>
              <option value={5} className="bg-slate-900 text-white">5s</option>
              <option value={7} className="bg-slate-900 text-white">7s (Slow)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Reset to default Nexa AI banners"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-900/30 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Banner</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAllToCloud}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all hover:scale-105 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save & Publish Banners</span>
          </button>
        </div>
      </div>

      {/* Banner Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banners.map((banner, index) => {
          return (
            <div
              key={banner.id || index}
              className={`rounded-3xl border transition-all overflow-hidden flex flex-col justify-between ${
                banner.isActive
                  ? 'bg-slate-900/90 border-slate-800 hover:border-teal-500/50 shadow-lg'
                  : 'bg-slate-900/50 border-slate-800/60 opacity-60'
              }`}
            >
              {/* Top Banner Live Preview Container */}
              <div className="relative h-44 bg-slate-950 overflow-hidden group">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => {
                    // Fallback visual if link is broken
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80';
                  }}
                />
                {/* Deep Scrim Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-teal-950/95 via-teal-950/50 to-black/30" />

                {/* Top Overlay: Order Pill & Active Status */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-black/60 backdrop-blur-md text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-white/10">
                      #{index + 1}
                    </span>
                    {banner.badge && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-md border border-white/10">
                        {banner.badge}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(banner.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md border transition-all ${
                      banner.isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {banner.isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>

                {/* Bottom Overlay: Title & Button */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-white leading-tight drop-shadow truncate">
                      {banner.title}
                    </h4>
                    {banner.subtitle && (
                      <p className="text-[10px] text-teal-200/90 font-medium truncate mt-0.5">
                        {banner.subtitle}
                      </p>
                    )}
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[10px] shrink-0 shadow">
                    {banner.buttonText || 'Explore'}
                  </span>
                </div>
              </div>

              {/* Card Meta & Control Actions */}
              <div className="p-4 space-y-3 bg-slate-900/60 border-t border-slate-800">
                {/* Action Type & URL info */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Trigger:</span>
                    {getActionBadge(banner.actionType)}
                  </div>
                  {banner.actionType === 'url' && banner.actionUrl && (
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={banner.actionUrl}>
                      {banner.actionUrl}
                    </span>
                  )}
                </div>

                {/* Photo URL display */}
                <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800 truncate">
                  <ImageIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="truncate">{banner.imageUrl}</span>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                      title="Move Up"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === banners.length - 1}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                      title="Move Down"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestAction(banner)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-teal-950/60 text-teal-300 text-[11px] font-bold flex items-center gap-1 transition-colors border border-slate-700"
                      title="Test Click Action"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>Test Action</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(banner)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold text-xs flex items-center gap-1 border border-blue-500/30 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBanner(banner.id)}
                      className="p-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors"
                      title="Delete Banner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT BANNER */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[92vh] rounded-3xl bg-slate-900 border border-teal-800/50 shadow-2xl overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-white">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-white text-base">
                  {editingBannerId ? 'Edit Home Screen Banner' : 'Add New Home Screen Banner'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-5 space-y-4 text-xs">
              {/* Live Preview Box */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Live Banner Preview
                </label>
                <div className="rounded-2xl overflow-hidden relative shadow-lg h-44 bg-slate-950 border border-teal-600/40">
                  <img
                    src={formImageUrl || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80'}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-teal-950/95 via-teal-950/50 to-black/30" />

                  {/* Top Badge */}
                  {formBadge && (
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {formBadge}
                      </span>
                    </div>
                  )}

                  {/* Bottom Text & Button */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                    <div className="max-w-[70%]">
                      <h4 className="text-sm font-black text-white drop-shadow truncate">
                        {formTitle || 'Banner Title Goes Here'}
                      </h4>
                      <p className="text-[10px] text-teal-200/90 truncate">
                        {formSubtitle || 'Banner description & dividend information'}
                      </p>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[10px] shadow">
                      {formButtonText || 'Explore'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Photo Link URL Input */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Photo URL / Image Link (Direct web link)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... or any image link"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Admin jis photo ka link yaha daalega, wahi photo banner mein run karegi.
                </p>
              </div>

              {/* Quick Preset Photos */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5 text-[11px]">
                  Or Choose from 4K Presets:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_PHOTOS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-left transition-all group flex items-center gap-2"
                    >
                      <img
                        src={p.url}
                        alt={p.name}
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                      />
                      <span className="text-[10px] font-bold text-slate-300 group-hover:text-teal-300 truncate">
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Banner Title (Mukhya Headline)
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Clean Energy Infrastructure Fund"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-teal-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Top Badge Text
                  </label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="e.g. NEXA AI GREEN POWER"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Subtitle & Button Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Subtitle / Description
                  </label>
                  <input
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="e.g. Daily automated returns · 100% Guaranteed Tariff"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Action Button Text
                  </label>
                  <input
                    type="text"
                    value={formButtonText}
                    onChange={(e) => setFormButtonText(e.target.value)}
                    placeholder="e.g. Explore Projects, Add Money, Spin"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Banner Function / Action Type Selector */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-slate-200 font-bold text-xs flex items-center justify-between">
                  <span>Banner Click Functionality (Multiple Kaam Logic):</span>
                  <span className="text-[10px] text-teal-400 font-mono font-semibold">
                    What happens when user taps banner?
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {[
                    { type: 'invest' as BannerActionType, label: 'Explore Clean Projects (Invest Store)', icon: <ArrowRight className="w-3.5 h-3.5 text-teal-400" /> },
                    { type: 'recharge' as BannerActionType, label: 'Add Money / Deposit (Instant QR)', icon: <Flame className="w-3.5 h-3.5 text-emerald-400" /> },
                    { type: 'spin' as BannerActionType, label: 'Lucky Wheel (Daily Spin & Win)', icon: <Gift className="w-3.5 h-3.5 text-purple-400" /> },
                    { type: 'team' as BannerActionType, label: `Team Referral (${platformSettings?.tier1Commission ?? 10}% Commission)`, icon: <Users className="w-3.5 h-3.5 text-amber-400" /> },
                    { type: 'support' as BannerActionType, label: 'Customer Support (24/7 Chat)', icon: <Headphones className="w-3.5 h-3.5 text-blue-400" /> },
                    { type: 'app_download' as BannerActionType, label: 'Download App (Official APK)', icon: <Download className="w-3.5 h-3.5 text-cyan-400" /> },
                    { type: 'notice' as BannerActionType, label: 'Official Announcements', icon: <Bell className="w-3.5 h-3.5 text-rose-400" /> },
                    { type: 'url' as BannerActionType, label: 'Open External URL Link', icon: <ExternalLink className="w-3.5 h-3.5 text-indigo-400" /> },
                  ].map((act) => (
                    <button
                      key={act.type}
                      type="button"
                      onClick={() => setFormActionType(act.type)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        formActionType === act.type
                          ? 'bg-teal-950/80 border-teal-500 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {act.icon}
                      <span className="text-xs font-semibold">{act.label}</span>
                    </button>
                  ))}
                </div>

                {formActionType === 'url' && (
                  <div className="pt-2">
                    <label className="block text-slate-300 font-bold mb-1">
                      External URL Target
                    </label>
                    <input
                      type="url"
                      value={formActionUrl}
                      onChange={(e) => setFormActionUrl(e.target.value)}
                      placeholder="https://example.com/promo"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 bg-slate-800 border-slate-700"
                />
                <span className="text-slate-300 font-bold">
                  Banner Active (Visible on Home Screen Carousel)
                </span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end gap-2.5 bg-slate-900/95 sticky bottom-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBannerModal}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95"
              >
                {editingBannerId ? 'Update Banner' : 'Add to Carousel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
