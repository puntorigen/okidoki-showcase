'use client';

import { Lightbulb, FileText, PenLine, HelpCircle, Check } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

type TipState = 'empty' | 'hasContent' | 'translating' | 'complete' | 'reverted';

interface TipBarProps {
  state?: TipState;
  hasContent?: boolean;
  isTranslating?: boolean;
  translationComplete?: boolean;
  onQuickAction?: (action: string) => void;
}

export default function TipBar({ 
  state,
  hasContent = false, 
  isTranslating = false,
  translationComplete = false,
  onQuickAction 
}: TipBarProps) {
  const { t } = useLanguage();
  
  // Determine current state
  const currentState: TipState = state || (
    isTranslating ? 'translating' :
    translationComplete ? 'complete' :
    hasContent ? 'hasContent' :
    'empty'
  );

  // Get contextual tip based on state
  const getTip = () => {
    switch (currentState) {
      case 'translating':
        return t('tipTranslating');
      case 'complete':
        return t('tipComplete');
      case 'reverted':
        return t('tipReverted');
      case 'hasContent':
        return t('tipHasContent');
      case 'empty':
      default:
        return t('tipEmpty');
    }
  };

  // Get icon based on state
  const getIcon = () => {
    switch (currentState) {
      case 'complete':
        return <Check className="w-3.5 h-3.5 text-emerald-600" />;
      case 'translating':
        return (
          <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        );
      default:
        return <Lightbulb className="w-3.5 h-3.5 text-teal-600" />;
    }
  };

  // Get background color based on state
  const getBackgroundClass = () => {
    switch (currentState) {
      case 'complete':
        return 'from-emerald-50 to-slate-50';
      case 'translating':
        return 'from-blue-50 to-slate-50';
      default:
        return 'from-teal-50 to-slate-50';
    }
  };

  const getIconBgClass = () => {
    switch (currentState) {
      case 'complete':
        return 'bg-emerald-100';
      case 'translating':
        return 'bg-blue-100';
      default:
        return 'bg-teal-100';
    }
  };

  const handleQuickAction = (action: string) => {
    onQuickAction?.(action);
  };

  return (
    <div className={`bg-gradient-to-r ${getBackgroundClass()} border-t border-slate-200 px-6 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Tip message */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex-shrink-0 w-6 h-6 ${getIconBgClass()} rounded-full flex items-center justify-center`}>
            {getIcon()}
          </div>
          <p className="text-sm text-slate-600 truncate">
            {getTip()}
          </p>
        </div>

        {/* Quick action chips - only show in empty state */}
        {currentState === 'empty' && onQuickAction && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleQuickAction('contract')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3" />
              {t('createContract')}
            </button>
            <button
              onClick={() => handleQuickAction('report')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <PenLine className="w-3 h-3" />
              {t('writeReport')}
            </button>
            <button
              onClick={() => handleQuickAction('help')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-full transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3 h-3" />
              {t('askForHelp')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
