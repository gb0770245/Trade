import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles, ExternalLink, ShieldCheck, Flame, Gift, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HomeBanner, BannerActionType } from '../types';
import { DEFAULT_HOME_BANNERS } from '../data/mockData';

export const HomeBannerSlider: React.FC = () => {
  const { platformSettings, setActiveTab, openModal } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Get active banners sorted by order
  const rawBanners = platformSettings.homeBanners && platformSettings.homeBanners.length > 0
    ? platformSettings.homeBanners
    : DEFAULT_HOME_BANNERS;

  const activeBanners: HomeBanner[] = rawBanners
    .filter((b) => b.isActive !== false && b.actionType !== 'spin' && !b.title?.toLowerCase().includes('spin'))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const banners = activeBanners.length > 0
    ? activeBanners
    : DEFAULT_HOME_BANNERS.filter((b) => b.actionType !== 'spin');
  const autoPlaySeconds = Math.max(2, platformSettings.bannerAutoPlaySpeedSeconds || 4);

  // Safe navigation
  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Auto-play timer
  useEffect(() => {
    if (isPaused || banners.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, autoPlaySeconds * 1000);

    return () => clearInterval(timer);
  }, [nextSlide, isPaused, autoPlaySeconds, banners.length]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;

    if (distance > minSwipeDistance) {
      // Swiped left -> next
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      // Swiped right -> prev
      prevSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Multi-action executor for banners
  const handleBannerAction = (banner: HomeBanner, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    switch (banner.actionType) {
      case 'invest':
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
        setActiveTab('notice');
        break;
      case 'rewards':
        openModal('rewards');
        break;
      case 'url':
        if (banner.actionUrl) {
          window.open(banner.actionUrl, '_blank', 'noopener,noreferrer');
        }
        break;
      default:
        setActiveTab('invest');
        break;
    }
  };

  const currentBanner = banners[currentIndex] || banners[0];

  const getActionIcon = (actionType: BannerActionType) => {
    switch (actionType) {
      case 'invest':
        return <ArrowRight className="w-3 h-3" />;
      case 'recharge':
        return <Flame className="w-3 h-3" />;
      case 'spin':
        return <Gift className="w-3 h-3" />;
      case 'team':
        return <Users className="w-3 h-3" />;
      case 'url':
        return <ExternalLink className="w-3 h-3" />;
      default:
        return <ArrowRight className="w-3 h-3" />;
    }
  };

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-xl border border-teal-600/30 bg-slate-900 select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: '190px' }}
    >
      {/* Background Slides */}
      {banners.map((banner, index) => {
        const isCurrent = index === currentIndex;
        return (
          <div
            key={banner.id || index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Background Image with Ken Burns zoom on active slide */}
            <div
              className={`absolute inset-0 bg-cover bg-center transition-transform duration-7000 ease-out ${
                isCurrent ? 'scale-105' : 'scale-100'
              }`}
              style={{
                backgroundImage: `url("${banner.imageUrl}")`,
              }}
            />

            {/* Deep dark & emerald gradient overlay to make text crystal clear */}
            <div className="absolute inset-0 bg-gradient-to-t from-teal-950 via-teal-950/60 to-black/35" />
            <div className="absolute inset-0 bg-gradient-to-r from-teal-950/80 via-transparent to-black/40" />
          </div>
        );
      })}

      {/* Slide Content Layer */}
      <div
        className="relative z-20 h-full p-4 flex flex-col justify-between cursor-pointer min-h-[190px]"
        onClick={() => handleBannerAction(currentBanner)}
      >
        {/* Top Row: Badge & Slide Index Pill */}
        <div className="flex items-center justify-between gap-2">
          {currentBanner.badge && (
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-white flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {currentBanner.badge}
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {banners.length > 1 && (
              <span className="text-[10px] font-mono font-bold bg-black/40 backdrop-blur-md text-teal-200/90 px-2 py-0.5 rounded-full border border-white/10">
                {currentIndex + 1} / {banners.length}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Row: Text Content & Action Button */}
        <div className="mt-auto pt-4 flex items-end justify-between gap-3">
          <div className="max-w-[70%] sm:max-w-[75%] space-y-1">
            <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
              {currentBanner.title}
            </h3>
            {currentBanner.subtitle && (
              <p className="text-[10.5px] sm:text-xs text-teal-200/90 font-medium leading-tight line-clamp-2 drop-shadow-sm">
                {currentBanner.subtitle}
              </p>
            )}
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={(e) => handleBannerAction(currentBanner, e)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-[11px] shadow-lg shadow-emerald-950/40 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center gap-1 border border-white/30"
          >
            <span>{currentBanner.buttonText || 'Explore'}</span>
            {getActionIcon(currentBanner.actionType)}
          </button>
        </div>
      </div>

      {/* Left/Right Navigation Arrows (Visible on hover on desktop, subtle on mobile) */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-70 hover:opacity-100 transition-all shadow-md"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-70 hover:opacity-100 transition-all shadow-md"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Navigation Dots */}
          <div className="absolute bottom-2 left-0 right-0 z-30 flex items-center justify-center gap-1.5 pointer-events-none">
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(idx);
                }}
                className={`pointer-events-auto h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? 'w-5 bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
