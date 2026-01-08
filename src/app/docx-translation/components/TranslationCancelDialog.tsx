'use client';

/**
 * TranslationCancelDialog Component
 * Shows when user cancels a translation in progress.
 * Offers choice to keep partial translation or restore original.
 */

import { Languages, Check, RotateCcw } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface TranslationCancelDialogProps {
  sourceLanguage: string;
  targetLanguage: string;
  progress: number;
  onKeep: () => void;
  onRestore: () => void;
}

export default function TranslationCancelDialog({
  sourceLanguage,
  targetLanguage,
  progress,
  onKeep,
  onRestore,
}: TranslationCancelDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">{t('cancelTranslation')}</h3>
              <p className="text-sm text-white/80">
                {sourceLanguage} → {targetLanguage} ({progress}% complete)
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 mb-6">
            What would you like to do with the partially translated document?
          </p>

          {/* Options */}
          <div className="space-y-3">
            <button
              onClick={onKeep}
              className="w-full flex items-start gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group"
            >
              <div className="w-10 h-10 bg-green-100 group-hover:bg-green-200 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{t('keepTranslated')}</p>
                <p className="text-sm text-slate-500 mt-1">
                  Keep the parts that have been translated. You can continue editing or translate again later.
                </p>
              </div>
            </button>
            
            <button
              onClick={onRestore}
              className="w-full flex items-start gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group"
            >
              <div className="w-10 h-10 bg-amber-100 group-hover:bg-amber-200 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{t('restoreOriginal')}</p>
                <p className="text-sm text-slate-500 mt-1">
                  Discard all translations and restore the original document.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
