import React, { useState } from 'react';
import { ChevronLeft, BookOpen, Clock, Eye, X, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NEWS_ARTICLES } from '../data/mockData';
import { NewsArticle } from '../types';

export const BlogView: React.FC = () => {
  const { goBack } = useApp();
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const handleOpenArticle = (article: NewsArticle) => {
    setSelectedArticle(article);
    if (typeof window !== 'undefined') {
      window.history.pushState({ appletSubView: 'blog-article', id: article.id }, '');
    }
  };

  const handleCloseArticle = () => {
    if (typeof window !== 'undefined' && window.history.state?.appletSubView === 'blog-article') {
      window.history.back();
    } else {
      setSelectedArticle(null);
    }
  };

  React.useEffect(() => {
    const handlePop = () => {
      if (selectedArticle) {
        setSelectedArticle(null);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [selectedArticle]);

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      {/* Top Header */}
      <header className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
        <button
          type="button"
          onClick={goBack}
          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Back to Previous Page"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        </button>

        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Industry News & Blog</h2>

        <div className="w-6" />
      </header>

      {/* Article feed */}
      <div className="px-4 mt-3 space-y-3.5">
        {NEWS_ARTICLES.map((article) => (
          <article
            key={article.id}
            onClick={() => handleOpenArticle(article)}
            className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2">
              <span className="font-semibold text-teal-600 dark:text-teal-400">{article.category}</span>
              <span>·</span>
              <span>{article.readTime}</span>
              <span>·</span>
              <span>{article.date}</span>
            </div>

            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors leading-snug">
              {article.title}
            </h3>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
              {article.snippet}
            </p>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>{article.views.toLocaleString()} reads</span>
              </span>
              <span className="text-teal-600 font-bold flex items-center gap-0.5">
                Read Article <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Article Detail Reading Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 px-2.5 py-0.5 rounded-full">
                {selectedArticle.category}
              </span>
              <button onClick={handleCloseArticle} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-sm font-bold mt-3 leading-snug">{selectedArticle.title}</h3>
            <div className="text-[10px] text-slate-400 mt-1 mb-4 flex items-center gap-2">
              <span>{selectedArticle.date}</span>
              <span>·</span>
              <span>{selectedArticle.readTime}</span>
            </div>

            <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 space-y-3">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedArticle.snippet}
              </p>
              <p>{selectedArticle.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
