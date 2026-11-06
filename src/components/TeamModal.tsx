import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  CheckCircle2,
  Share2,
  Award,
  TrendingUp,
  Sparkles,
  RefreshCw,
  UserCheck,
  Calendar,
  Wallet,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TeamModal: React.FC = () => {
  const {
    user,
    teamMembers,
    refreshTeamMembers,
    closeModal,
    showToast,
    theme,
    lookupReferrer,
    platformSettings,
  } = useApp();
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(1);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviterName, setInviterName] = useState<string>(user?.inviterName || '');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh team downlines on modal mount
  useEffect(() => {
    let isSubscribed = true;
    const fetchFreshTeam = async () => {
      try {
        await refreshTeamMembers();
      } catch (err) {
        console.warn('Initial team members refresh notice:', err);
      }
    };
    fetchFreshTeam();
    return () => {
      isSubscribed = false;
    };
  }, [refreshTeamMembers]);

  // Lookup inviter details
  useEffect(() => {
    if (user?.invitedBy && !inviterName) {
      lookupReferrer(user.invitedBy).then((info) => {
        if (info && info.valid && info.name) {
          setInviterName(info.name);
        }
      });
    }
  }, [user?.invitedBy, user?.inviterName, lookupReferrer, inviterName]);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const freshList = await refreshTeamMembers();
      showToast(`Team members synced! Total ${freshList.length} member(s) found.`, 'info');
    } catch {
      showToast('Network error while refreshing team members', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const tier1Rate = platformSettings?.tier1Commission ?? 10;
  const tier2Rate = platformSettings?.tier2Commission ?? 3;
  const tier3Rate = platformSettings?.tier3Commission ?? 1;
  const totalCommissionRate = tier1Rate + tier2Rate + tier3Rate;

  const inviteCode = user?.invitationCode || '4AB86';
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${inviteCode}`
    : `https://nexa-ai.app/?ref=${inviteCode}`;

  const shareText = `⚡ Join Nexa AI with my invitation code ${inviteCode}!\n\n🌿 Daily Returns & High-Yield Dividends (${tier1Rate}% Tier 1, ${tier2Rate}% Tier 2, ${tier3Rate}% Tier 3 Commission).\n🔗 Join link: ${inviteLink}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    showToast('Invitation code copied!', 'info');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    showToast('Referral link copied to clipboard!', 'info');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Nexa AI Referral',
          text: shareText,
          url: inviteLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    copyLink();
  };

  const tier1Members = teamMembers.filter((m) => m.level === 1);
  const tier2Members = teamMembers.filter((m) => m.level === 2);
  const tier3Members = teamMembers.filter((m) => m.level === 3);

  const filteredMembers = selectedTier === 1 ? tier1Members : selectedTier === 2 ? tier2Members : tier3Members;

  const totalRecharge = teamMembers.reduce((sum, m) => sum + (m.rechargeTotal || 0), 0);
  const totalCommission = teamMembers.reduce((sum, m) => sum + (m.commissionContributed || 0), 0);

  const tierTotalRecharge = filteredMembers.reduce((sum, m) => sum + (m.rechargeTotal || 0), 0);
  const tierTotalCommission = filteredMembers.reduce((sum, m) => sum + (m.commissionContributed || 0), 0);

  const currentTierRate = selectedTier === 1 ? tier1Rate : selectedTier === 2 ? tier2Rate : tier3Rate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in overscroll-contain touch-pan-y"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl p-4 sm:p-6 relative overflow-hidden transition-all shadow-2xl max-h-[90vh] flex flex-col overscroll-contain ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {/* Sticky Modal Header with Title and Refresh Button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">My Team & Commissions</h3>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-full">
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-400">{totalCommissionRate}% Multi-tier referral earnings network</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh Team Data"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unified Scrollable Body so entire My Team modal & user list scrolls smoothly up/down */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3 pt-3 pb-2">
          {/* Upline Sponsor info */}
          {user?.invitedBy && (
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-teal-500/15 via-emerald-500/10 to-teal-500/15 border border-teal-500/30 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-700 text-white font-black flex items-center justify-center text-xs shadow-sm">
                  {(inviterName || user.inviterName || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[10px] text-teal-700 dark:text-teal-300 font-bold uppercase tracking-wide">
                    Your Inviter / Sponsor (इन्होंने आमंत्रित किया है)
                  </div>
                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{inviterName || user.inviterName || 'Sponsor'}</span>
                    <span className="text-[11px] font-mono font-medium text-teal-600 dark:text-teal-300">
                      ({user.invitedBy})
                    </span>
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> VERIFIED
              </span>
            </div>
          )}

          {/* Overall Team Stats Banner */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 text-white shadow-md">
            <div className="text-center">
              <div className="text-[10px] opacity-85 font-medium">Total Team</div>
              <div className="text-lg font-extrabold">{teamMembers.length}</div>
            </div>
            <div className="text-center border-x border-white/20">
              <div className="text-[10px] opacity-85 font-medium">Team Deposits</div>
              <div className="text-lg font-extrabold num-tabular">${totalRecharge.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] opacity-85 font-medium">Total Income</div>
              <div className="text-lg font-extrabold num-tabular">${(teamMembers.length > 0 ? totalCommission : (Number(user?.totalCommissionEarned) || 0)).toFixed(2)}</div>
            </div>
          </div>

          {/* Real-time referral earnings notice */}
          <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>
                Referral Income: <strong className="font-extrabold text-emerald-600 dark:text-emerald-400">${(teamMembers.length > 0 ? totalCommission : (Number(user?.totalCommissionEarned) || 0)).toFixed(2)}</strong> (Directly in Withdrawable Balance)
              </span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-bold">Live & Active</span>
          </div>

          {/* Invite Code & Link Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <span>My Personal Referral Code</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                    UNIQUE
                  </span>
                </div>
                <div className="text-base font-black tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                  {inviteCode}
                </div>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm"
              >
                {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                Aapke link ya code se judne wale user ka record yahan <strong>real-time</strong> automatic update hoga!
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="text-xs truncate text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {inviteLink}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  <span>Share WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors shadow-sm shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Commission Tier Tabs + Sub-Banner inside scroll area */}
          <div
            className={`sticky top-0 z-10 pt-1 pb-2 space-y-2 ${
              theme === 'obsidian-gold' || theme === 'cyber-hydrogen'
                ? 'bg-slate-900/95 backdrop-blur-md'
                : 'bg-white/95 backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTier(1)}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  selectedTier === 1
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>Tier 1 ({tier1Rate}%)</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    selectedTier === 1 ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {tier1Members.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTier(2)}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  selectedTier === 2
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>Tier 2 ({tier2Rate}%)</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    selectedTier === 2 ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {tier2Members.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTier(3)}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  selectedTier === 3
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>Tier 3 ({tier3Rate}%)</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    selectedTier === 3 ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {tier3Members.length}
                </span>
              </button>
            </div>

            {/* Selected Tier Sub-Banner */}
            <div className="px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-300 font-bold">
                <Award className="w-3.5 h-3.5" />
                <span>Tier {selectedTier} ({currentTierRate}% Commission Rate)</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Total Earned: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">${tierTotalCommission.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2 pb-2">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  No members found in Tier {selectedTier}
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  {selectedTier === 1
                    ? 'Aapke direct referral link ya code se register hone wale log yahan dikhenge.'
                    : `Tier ${selectedTier - 1} ke members dwara invite kiye gaye partners yahan aate hain.`}
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="mt-2 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Invite Friends to Tier {selectedTier}</span>
                </button>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isActive = (member.rechargeTotal || 0) > 0;
                const initial = (member.nickname || 'M').charAt(0).toUpperCase();
                return (
                  <div
                    key={member.id}
                    className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0 ${
                          selectedTier === 1
                            ? 'bg-gradient-to-br from-orange-500 to-amber-600'
                            : selectedTier === 2
                            ? 'bg-gradient-to-br from-teal-500 to-emerald-600'
                            : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                        }`}
                      >
                        {initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{member.nickname}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {isActive ? 'Active Investor' : 'Registered'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{member.phoneMasked}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {member.joinDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 num-tabular flex items-center justify-end gap-0.5">
                        <span>+${member.commissionContributed.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 num-tabular mt-0.5">
                        Deposit: ${member.rechargeTotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
