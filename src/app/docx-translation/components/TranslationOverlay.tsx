'use client';

/**
 * TranslationOverlay Component
 * Full-page overlay with elegant progress display.
 */

import { useEffect, useState } from 'react';
import { Languages, StopCircle } from 'lucide-react';
import { TranslationProgress } from '@/lib/translation';
import { useLanguage } from '../lib/LanguageContext';

interface TranslationOverlayProps {
  progress: TranslationProgress | null;
  onCancel: () => void;
}

// Get flag for a language name
const getFlagForLanguage = (langName: string) => {
  const flags: Record<string, string> = {
    english: '🇺🇸',
    spanish: '🇪🇸',
    french: '🇫🇷',
    german: '🇩🇪',
    portuguese: '🇧🇷',
    italian: '🇮🇹',
    chinese: '🇨🇳',
    japanese: '🇯🇵',
    korean: '🇰🇷',
    russian: '🇷🇺',
    arabic: '🇸🇦',
  };
  return flags[langName?.toLowerCase()] || '🌐';
};

export default function TranslationOverlay({ progress, onCancel }: TranslationOverlayProps) {
  const { t } = useLanguage();
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const [dots, setDots] = useState('');
  
  // Animated dots for preparing state
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Smooth animation for progress
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
        return current + diff * 0.15;
      });
    };
    
    const interval = setInterval(step, 50);
    return () => clearInterval(interval);
  }, [progress?.percentage]);

  if (!progress || progress.status === 'idle' || progress.status === 'completed') {
    return null;
  }

  const isPreparing = progress.status === 'preparing';
  const isError = progress.status === 'error';

  // Calculate stroke properties for circular progress
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  // Get a friendly section description
  const getSectionText = () => {
    if (isPreparing) return null;
    if (progress.totalBatches <= 1) return t('translatingDocument');
    return `${t('part')} ${progress.completedBatches + 1} ${t('of')} ${progress.totalBatches}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-800/60 to-indigo-900/70 backdrop-blur-sm" />
      
      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Card */}
      <div className="relative z-10 bg-white/95 backdrop-blur rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-white/20">
        {/* Gradient header accent */}
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        
        {/* Content */}
        <div className="p-8 flex flex-col items-center">
          {/* Language flags with animation */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <span className="text-4xl drop-shadow-lg">{getFlagForLanguage(progress.sourceLanguage)}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Languages className="w-5 h-5 text-indigo-500" />
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
            <div className="relative">
              <span className="text-4xl drop-shadow-lg">{getFlagForLanguage(progress.targetLanguage)}</span>
            </div>
          </div>

          {/* Circular Progress */}
          <div className="relative w-36 h-36 mb-6">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-xl" />
            
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90 relative">
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
              />
              {/* Progress circle */}
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={isPreparing ? circumference * 0.75 : strokeDashoffset}
                className={`transition-all duration-500 ease-out ${isPreparing ? 'animate-spin origin-center' : ''}`}
                style={isPreparing ? { animationDuration: '1.5s', transformOrigin: '72px 72px' } : undefined}
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Percentage text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {isPreparing ? dots || '...' : `${Math.round(animatedPercentage)}%`}
              </span>
            </div>
          </div>

          {/* Status text */}
          <div className="text-center space-y-1 mb-6">
            <p className="text-lg font-semibold text-slate-800">
              {isPreparing ? (
                t('analyzingDocument')
              ) : isError ? (
                <span className="text-red-500">{t('translationError')}</span>
              ) : (
                t('translating')
              )}
            </p>
            {getSectionText() && (
              <p className="text-sm text-slate-500">
                {getSectionText()}
              </p>
            )}
          </div>

          {/* Info text */}
          <p className="text-xs text-slate-400 text-center mb-6 max-w-xs">
            {t('overlayHint')}
          </p>
        </div>

        {/* Cancel button */}
        <div className="px-6 pb-6">
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 rounded-xl transition-all shadow-lg hover:shadow-xl cursor-pointer active:scale-[0.98]"
          >
            <StopCircle className="w-4 h-4" />
            {t('stopTranslation')}
          </button>
        </div>
      </div>
    </div>
  );
}
