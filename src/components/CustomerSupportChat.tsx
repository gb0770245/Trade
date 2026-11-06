import React, { useState } from 'react';
import { X, Send, Headphones, Bot, User, CheckCheck, Sparkles, ExternalLink } from 'lucide-react';
import { useApp, normalizeRedirectUrl } from '../context/AppContext';

export const CustomerSupportChat: React.FC = () => {
  const { supportMessages, sendSupportMessage, isSupportTyping, closeModal, theme, platformSettings } = useApp();
  const [inputText, setInputText] = useState('');

  const activeHelpLinks = (platformSettings?.helpCenterLinks || []).filter(
    (l) => l.isActive !== false && l.url && l.url.trim()
  );
  const directHelpUrl = normalizeRedirectUrl(platformSettings?.helpCenterUrl);

  const quickQuestions = [
    'How do I add money via PhonePe/UPI?',
    'What is the minimum withdrawal amount?',
    'How do I upgrade to VIP 1?',
    'Explain the referral commission rates',
  ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendSupportMessage(inputText);
    setInputText('');
  };

  const handleQuickQuestion = (q: string) => {
    sendSupportMessage(q);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
      <div
        className={`w-full max-w-md h-[560px] rounded-3xl p-5 relative overflow-hidden transition-all shadow-2xl flex flex-col ${
          theme === 'obsidian-gold'
            ? 'bg-slate-900 border border-amber-500/30 text-slate-100'
            : theme === 'cyber-hydrogen'
            ? 'bg-slate-900 border border-cyan-500/30 text-slate-100'
            : 'bg-white border border-slate-100 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Nexa AI Support"
              className="w-10 h-10 object-contain drop-shadow-md select-none shrink-0"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold">Nexa AI Official Support</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-semibold">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Average response time: &lt; 30 seconds</p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Direct Help Center Links configured by Admin */}
        {(directHelpUrl || activeHelpLinks.length > 0) && (
          <div className="py-2.5 border-b border-slate-100 dark:border-slate-800/80 space-y-1.5 shrink-0">
            {directHelpUrl && (
              <a
                href={directHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-sm hover:brightness-110 transition-all"
              >
                <span>Open Official Help Center Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {activeHelpLinks.map((link) => {
              const href = normalizeRedirectUrl(link.url);
              if (!href || href === directHelpUrl) return null;
              return (
                <a
                  key={link.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-3 py-2 rounded-xl bg-teal-50 dark:bg-slate-800 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-bold flex items-center justify-between hover:bg-teal-100 transition-all"
                >
                  <span>{link.title || href}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              );
            })}
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 border-b border-slate-100 dark:border-slate-800/80">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickQuestion(q)}
              className="text-[10px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-700 dark:hover:text-teal-300 border border-slate-200/60 dark:border-slate-700 transition-colors shrink-0"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Message feed */}
        <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
          {supportMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {isUser ? (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 bg-teal-700 text-white">
                    <User className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <img
                    src="/logo.png"
                    alt="Nexa AI"
                    className="w-7 h-7 rounded-full object-cover shrink-0 shadow-xs ring-1 ring-amber-400/50"
                  />
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                    isUser
                      ? 'bg-teal-700 text-white rounded-tr-none'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  <p>{msg.text}</p>
                  <div
                    className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                      isUser ? 'text-teal-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {isUser && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })}

          {isSupportTyping && (
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Nexa AI"
                className="w-7 h-7 rounded-full object-cover shrink-0 shadow-xs ring-1 ring-amber-400/50"
              />
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2 text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200" />
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleSend} className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-1.5 pl-3 focus-within:border-teal-500">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about deposits, VIP, or withdrawals..."
              className="w-full text-xs outline-none bg-transparent text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition-colors disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
