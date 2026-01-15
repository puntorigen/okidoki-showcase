'use client';

import React, { useState } from 'react';
import { useLanguage } from '../lib/LanguageContext';
import { TranslationKey } from '../lib/translations';

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRender: (style: string) => void;
  lastRender: string | null;
  isRendering: boolean;
}

interface StylePreset {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}

const STYLE_PRESETS: StylePreset[] = [
  { id: 'watercolor', labelKey: 'watercolor', descriptionKey: 'watercolorDesc' },
  { id: 'oil-painting', labelKey: 'oilPainting', descriptionKey: 'oilPaintingDesc' },
  { id: 'pencil-sketch', labelKey: 'pencilSketchStyle', descriptionKey: 'pencilSketchDesc' },
  { id: 'digital-art', labelKey: 'digitalArt', descriptionKey: 'digitalArtDesc' },
  { id: 'anime', labelKey: 'animeStyle', descriptionKey: 'animeStyleDesc' },
  { id: 'impressionist', labelKey: 'impressionist', descriptionKey: 'impressionistDesc' },
];

export function RenderModal({
  isOpen,
  onClose,
  onRender,
  lastRender,
  isRendering,
}: RenderModalProps) {
  const { t } = useLanguage();
  const [selectedStyle, setSelectedStyle] = useState<string>('watercolor');
  const [customStyle, setCustomStyle] = useState('');

  if (!isOpen) return null;

  const handleRender = () => {
    const style = selectedStyle === 'custom' 
      ? customStyle 
      : t(STYLE_PRESETS.find(p => p.id === selectedStyle)?.labelKey || 'watercolor');
    onRender(style);
  };

  const handleDownload = () => {
    if (!lastRender) return;
    
    const link = document.createElement('a');
    link.href = lastRender;
    link.download = `sketch-render-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">
            {lastRender ? t('yourRender') : t('renderModalTitle')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-auto flex-1">
          {/* Show last render if available */}
          {lastRender ? (
            <div className="space-y-4">
              <div className="bg-slate-700 rounded-lg p-2 flex items-center justify-center">
                <img
                  src={lastRender}
                  alt={t('yourRender')}
                  className="max-w-full max-h-[60vh] w-auto h-auto rounded object-contain"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('download')}
                </button>
                <button
                  onClick={() => {
                    // Reset to show style picker
                    onClose();
                    setTimeout(() => onRender(selectedStyle), 100);
                  }}
                  disabled={isRendering}
                  className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('renderAgain')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Style selection */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">{t('chooseStyle')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedStyle(preset.id)}
                      className={`p-3 rounded-lg text-left transition-all cursor-pointer ${
                        selectedStyle === preset.id
                          ? 'bg-rose-500/20 border-2 border-rose-500'
                          : 'bg-slate-700 border-2 border-transparent hover:border-slate-500'
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{t(preset.labelKey)}</div>
                      <div className="text-xs text-slate-400 mt-1">{t(preset.descriptionKey)}</div>
                    </button>
                  ))}
                  
                  {/* Custom style option */}
                  <button
                    onClick={() => setSelectedStyle('custom')}
                    className={`p-3 rounded-lg text-left transition-all cursor-pointer ${
                      selectedStyle === 'custom'
                        ? 'bg-rose-500/20 border-2 border-rose-500'
                        : 'bg-slate-700 border-2 border-transparent hover:border-slate-500'
                    }`}
                  >
                    <div className="font-medium text-white text-sm">{t('custom')}</div>
                    <div className="text-xs text-slate-400 mt-1">{t('customDesc')}</div>
                  </button>
                </div>
              </div>

              {/* Custom style input */}
              {selectedStyle === 'custom' && (
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
                    {t('describeStyle')}
                  </label>
                  <input
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder={t('stylePlaceholder')}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {/* Render button */}
              <button
                onClick={handleRender}
                disabled={isRendering || (selectedStyle === 'custom' && !customStyle.trim())}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-lg font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                {t('createArtwork')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
