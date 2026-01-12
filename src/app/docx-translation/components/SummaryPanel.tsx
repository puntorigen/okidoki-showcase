'use client';

import { useState } from 'react';
import { FileText, RefreshCw, Pencil, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { DocumentProperties } from './TranslationViewer';

interface TranslationInfo {
  sourceLanguage: string;
  targetLanguage: string;
}

interface SummaryPanelProps {
  wordCount: number;
  pageCount: number;
  detectedLanguage?: string;
  translationInfo?: TranslationInfo | null;
  executiveSummary?: string;
  isGeneratingSummary?: boolean;
  onRefreshSummary?: () => void;
  documentProperties?: DocumentProperties | null;
  onUpdateProperties?: (props: Partial<DocumentProperties>) => void;
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
  return flags[langName.toLowerCase()] || '🌐';
};

export default function SummaryPanel({ 
  wordCount,
  pageCount,
  detectedLanguage,
  translationInfo,
  executiveSummary,
  isGeneratingSummary,
  onRefreshSummary,
  documentProperties,
  onUpdateProperties,
}: SummaryPanelProps) {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editedProps, setEditedProps] = useState<Partial<DocumentProperties>>({});

  // Determine current language to display
  const currentLanguage = translationInfo?.targetLanguage || detectedLanguage;

  const handleOpenModal = () => {
    setEditedProps({
      title: documentProperties?.title || '',
      author: documentProperties?.author || '',
      subject: documentProperties?.subject || '',
      keywords: documentProperties?.keywords || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    onUpdateProperties?.(editedProps);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">{t('documentSummary')}</h3>
            </div>
            {onUpdateProperties && (
              <button
                onClick={handleOpenModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                title={t('editProperties')}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Document Title & Author */}
          {(documentProperties?.title || documentProperties?.author) && (
            <div className="space-y-1">
              {documentProperties.title && (
                <p className="text-sm font-medium text-slate-800 line-clamp-2">
                  {documentProperties.title}
                </p>
              )}
              {documentProperties.author && (
                <p className="text-xs text-slate-500">
                  {t('by')} {documentProperties.author}
                </p>
              )}
            </div>
          )}

          {/* Language */}
          {currentLanguage && (
            <div className="flex items-center gap-2">
              <span className="text-lg">{getFlagForLanguage(currentLanguage)}</span>
              <span className="text-sm font-medium text-slate-700">{currentLanguage}</span>
              {!translationInfo && detectedLanguage && (
                <span className="text-xs text-slate-400">({t('detectedLanguage')})</span>
              )}
            </div>
          )}

          {/* Translated from indicator */}
          {translationInfo && (
            <div className="text-xs text-slate-500 flex items-center gap-1.5 -mt-2">
              <span>{t('translatedFrom')}</span>
              <span>{getFlagForLanguage(translationInfo.sourceLanguage)}</span>
              <span>{translationInfo.sourceLanguage}</span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <div className="text-xs text-slate-500">{t('pages')}</div>
              <div className="text-lg font-semibold text-slate-800">{pageCount}</div>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <div className="text-xs text-slate-500">{t('words')}</div>
              <div className="text-lg font-semibold text-slate-800">{wordCount.toLocaleString()}</div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('summary')}</h4>
              {executiveSummary && onRefreshSummary && !isGeneratingSummary && (
                <button
                  onClick={onRefreshSummary}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Refresh summary"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {isGeneratingSummary ? (
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-4/5" />
              </div>
            ) : executiveSummary ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                {executiveSummary}
              </p>
            ) : wordCount > 50 ? (
              <p className="text-sm text-slate-400 italic">
                {t('generatingSummary')}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                {t('noSummaryYet')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Properties Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t('documentProperties')}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('title')}</label>
                <input
                  type="text"
                  value={editedProps.title || ''}
                  onChange={(e) => setEditedProps({ ...editedProps, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('documentTitle')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('author')}</label>
                <input
                  type="text"
                  value={editedProps.author || ''}
                  onChange={(e) => setEditedProps({ ...editedProps, author: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('authorName')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('subject')}</label>
                <input
                  type="text"
                  value={editedProps.subject || ''}
                  onChange={(e) => setEditedProps({ ...editedProps, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('documentSubject')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('keywords')}</label>
                <input
                  type="text"
                  value={editedProps.keywords || ''}
                  onChange={(e) => setEditedProps({ ...editedProps, keywords: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('keywordsPlaceholder')}
                />
              </div>

              {/* Read-only dates */}
              {(documentProperties?.created || documentProperties?.modified) && (
                <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
                  {documentProperties.created && (
                    <div>
                      <div className="text-xs text-slate-500">{t('created')}</div>
                      <div className="text-sm text-slate-700">
                        {documentProperties.created.toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  {documentProperties.modified && (
                    <div>
                      <div className="text-xs text-slate-500">{t('modified')}</div>
                      <div className="text-sm text-slate-700">
                        {documentProperties.modified.toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
