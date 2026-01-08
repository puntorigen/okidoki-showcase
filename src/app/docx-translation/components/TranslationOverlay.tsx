'use client';

/**
 * TranslationOverlay Component
 * Shows translation progress with a fluid UI and locks the document during translation.
 */

import { useEffect, useState } from 'react';
import { Languages, X, Loader2 } from 'lucide-react';
import { TranslationProgress } from '@/lib/translation';
import { useLanguage } from '../lib/LanguageContext';

interface TranslationOverlayProps {
  progress: TranslationProgress | null;
  onCancel: () => void;
}

export default function TranslationOverlay({ progress, onCancel }: TranslationOverlayProps) {
  const { t } = useLanguage();
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  // Smooth animation for progress bar
  useEffect(() => {
    if (!progress) {
      setAnimatedPercentage(0);
      return;
    }
    
    const target = progress.percentage;
    const step = () => {
      setAnimatedPercentage(current => {
        const diff = target - current;
        if (Math.abs(diff) < 0.5) return target;
        return current + diff * 0.1;
      });
    };
    
    const interval = setInterval(step, 50);
    return () => clearInterval(interval);
  }, [progress?.percentage]);

  if (!progress || progress.status === 'idle' || progress.status === 'completed') {
    return null;
  }

  const isPreparing = progress.status === 'preparing';
  const isTranslating = progress.status === 'translating';
  const isPaused = progress.status === 'paused';
  const isError = progress.status === 'error';

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Languages className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('translationProgress')}</h3>
                  <p className="text-sm text-white/80">
                    {progress.sourceLanguage} → {progress.targetLanguage}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label={t('cancelTranslation')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-600">
                  {isPreparing ? t('translating') + '...' :
                   isError ? t('failedToLoad') :
                   `${Math.round(animatedPercentage)}%`}
                </span>
                <span className="text-slate-400">
                  {progress.completedBatches}/{progress.totalBatches} batches
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    isError ? 'bg-red-500' :
                    isPaused ? 'bg-amber-500' :
                    'bg-gradient-to-r from-indigo-500 to-indigo-600'
                  }`}
                  style={{ width: `${animatedPercentage}%` }}
                />
              </div>
            </div>

            {/* Current Section */}
            {progress.currentSection && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  <span className="text-sm text-slate-600 truncate">
                    {progress.currentSection}
                  </span>
                </div>
              </div>
            )}

            {/* Time Estimate */}
            {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
              <p className="text-sm text-slate-400 text-center">
                ~{formatTime(progress.estimatedTimeRemaining)} remaining
              </p>
            )}

            {/* Status Messages */}
            {isPreparing && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing document and preparing translation...</span>
              </div>
            )}

            {isError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Translation encountered an error. Please try again.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Document is locked during translation to preserve formatting
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
