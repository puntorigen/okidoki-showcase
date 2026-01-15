'use client';

import React from 'react';
import { AspectRatio, ASPECT_RATIOS } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { TranslationKey } from '../lib/translations';

interface AspectRatioSelectorProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
}

// Map aspect ratio keys to translation keys
const ratioToTranslationKey: Record<AspectRatio, TranslationKey> = {
  portrait: 'portrait',
  standard: 'standard',
  landscape: 'landscape',
};

export function AspectRatioSelector({ 
  value, 
  onChange, 
  disabled = false 
}: AspectRatioSelectorProps) {
  const { t } = useLanguage();

  const options: { key: AspectRatio; icon: React.ReactNode }[] = [
    {
      key: 'portrait',
      icon: (
        <div className="w-3 h-5 border-2 border-current rounded-sm" />
      ),
    },
    {
      key: 'standard',
      icon: (
        <div className="w-4 h-3 border-2 border-current rounded-sm" />
      ),
    },
    {
      key: 'landscape',
      icon: (
        <div className="w-5 h-3 border-2 border-current rounded-sm" />
      ),
    },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
      {options.map(({ key, icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          disabled={disabled}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors cursor-pointer ${
            value === key
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={`${t(ratioToTranslationKey[key])} (${ASPECT_RATIOS[key].width}×${ASPECT_RATIOS[key].height})`}
        >
          {icon}
          <span className="text-xs">{ASPECT_RATIOS[key].label}</span>
        </button>
      ))}
    </div>
  );
}
