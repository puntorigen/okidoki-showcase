'use client';

import { Lightbulb } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useMemo } from 'react';

export default function TipBar() {
  const { t, tArray } = useLanguage();
  
  // Get tips array and select a random one (memoized to avoid changing on every render)
  const tip = useMemo(() => {
    const tips = tArray('tips');
    return tips[Math.floor(Math.random() * tips.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tArray]); // Intentionally re-randomize when language changes

  return (
    <div className="bg-gradient-to-r from-teal-50 to-slate-50 border-t border-slate-200 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex-shrink-0 w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center">
          <Lightbulb className="w-3.5 h-3.5 text-teal-600" />
        </div>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-teal-700">{t('tip')}:</span> {tip}
        </p>
      </div>
    </div>
  );
}

