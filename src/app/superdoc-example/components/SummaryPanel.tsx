'use client';

import { FileText, ChevronRight } from 'lucide-react';
import { DocumentSummary } from '../types';
import { useLanguage } from '../lib/LanguageContext';

interface SummaryPanelProps {
  summary: DocumentSummary;
  onSectionClick: (pos: number) => void;
}

export default function SummaryPanel({ summary, onSectionClick }: SummaryPanelProps) {
  const { t } = useLanguage();
  const { wordCount, sections } = summary;

  return (
    <div className="bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-800">{t('documentSummary')}</h3>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{t('words')}</span>
          <span className="font-medium text-slate-800">{wordCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-slate-600">{t('sections')}</span>
          <span className="font-medium text-slate-800">{sections.length}</span>
        </div>
      </div>

      {/* Sections List */}
      <div className="px-2 py-2 max-h-[400px] overflow-y-auto">
        {sections.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4 px-2">
            {t('noSections')}
          </p>
        ) : (
          <ul className="space-y-1">
            {sections.map((section, index) => (
              <li key={`${section.pos}-${index}`}>
                <button
                  onClick={() => onSectionClick(section.pos)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white transition-colors text-left group"
                  style={{ paddingLeft: `${(section.level - 1) * 12 + 8}px` }}
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-teal-500 flex-shrink-0" />
                  <span className="text-xs text-slate-700 group-hover:text-slate-900 truncate">
                    {section.text || t('untitled')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

