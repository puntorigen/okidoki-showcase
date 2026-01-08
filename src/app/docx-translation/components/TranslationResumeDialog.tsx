'use client';

/**
 * TranslationResumeDialog Component
 * Shows when there's an incomplete translation to resume.
 */

import { Languages, Play, RotateCcw, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface TranslationResumeDialogProps {
  sourceLanguage: string;
  targetLanguage: string;
  progress: number;
  lastUpdated: Date;
  onResume: () => void;
  onStartOver: () => void;
  onDismiss: () => void;
}

export default function TranslationResumeDialog({
  sourceLanguage,
  targetLanguage,
  progress,
  lastUpdated,
  onResume,
  onStartOver,
  onDismiss,
}: TranslationResumeDialogProps) {
  const { t } = useLanguage();

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Incomplete Translation Found</h3>
              <p className="text-sm text-white/80">
                {sourceLanguage} → {targetLanguage}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium text-amber-600">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Last updated: {formatDate(lastUpdated)}
            </p>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            A previous translation was interrupted. Would you like to resume where you left off?
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onResume}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              {t('resumeTranslation')}
            </button>
            
            <button
              onClick={onStartOver}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start Over
            </button>
            
            <button
              onClick={onDismiss}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-slate-500 hover:text-slate-700 rounded-xl font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
