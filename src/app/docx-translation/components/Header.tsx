'use client';

import Link from 'next/link';
import { ChevronDown, Download, Languages, Globe, Check, Upload } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Specialization } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { Language } from '../lib/translations';

const uiLanguages = [
  { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
  { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
];

const translateLanguages = [
  { code: 'Spanish', name: 'Spanish', flag: '🇪🇸' },
  { code: 'English', name: 'English', flag: '🇺🇸' },
  { code: 'French', name: 'French', flag: '🇫🇷' },
  { code: 'German', name: 'German', flag: '🇩🇪' },
  { code: 'Portuguese', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'Italian', name: 'Italian', flag: '🇮🇹' },
  { code: 'Chinese', name: 'Chinese', flag: '🇨🇳' },
  { code: 'Japanese', name: 'Japanese', flag: '🇯🇵' },
];

interface TranslationInfo {
  sourceLanguage: string;
  targetLanguage: string;
}

interface HeaderProps {
  specializations: Specialization[];
  currentSpecialization: Specialization;
  onSpecializationChange: (spec: Specialization) => void;
  onDownload: () => void;
  isDownloading: boolean;
  onLoadFile: (file: File) => void;
  hasContent?: boolean;
  isTranslating?: boolean;
  translationInfo?: TranslationInfo | null;
  onTranslate?: (targetLanguage: string) => void;
}

export default function Header({
  onDownload,
  isDownloading,
  onLoadFile,
  hasContent = false,
  isTranslating = false,
  translationInfo,
  onTranslate,
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isTranslateDropdownOpen, setIsTranslateDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const translateDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadFile(file);
      e.target.value = '';
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
      if (translateDropdownRef.current && !translateDropdownRef.current.contains(event.target as Node)) {
        setIsTranslateDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTranslateSelect = (targetLang: string) => {
    setIsTranslateDropdownOpen(false);
    onTranslate?.(targetLang);
  };

  const selectedLanguage = uiLanguages.find(l => l.code === language);

  const getFlagForLanguage = (langName: string) => {
    const lang = translateLanguages.find(l => 
      l.code.toLowerCase() === langName.toLowerCase() || 
      l.name.toLowerCase() === langName.toLowerCase()
    );
    return lang?.flag || '🌐';
  };

  return (
    <header className="bg-slate-900 text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-semibold">
                <Link href="/" className="hover:text-indigo-300 transition-colors">Okidoki</Link> <span className="text-slate-400">×</span> SuperDoc
              </h1>
              <p className="text-xs text-slate-400">{t('subtitle')}</p>
            </div>
            
            {/* Translation Badge */}
            {translationInfo && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full text-xs animate-fade-in">
                <span>{getFlagForLanguage(translationInfo.sourceLanguage)}</span>
                <span className="text-slate-400">→</span>
                <span>{getFlagForLanguage(translationInfo.targetLanguage)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Translate Button */}
          {hasContent && !isTranslating && onTranslate && (
            <div className="relative" ref={translateDropdownRef}>
              <button
                onClick={() => setIsTranslateDropdownOpen(!isTranslateDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-all duration-150 cursor-pointer hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
              >
                <Languages className="w-4 h-4" />
                <span className="text-sm font-medium">{t('translateDocument')}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isTranslateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTranslateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-[100] animate-dropdown">
                  <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {t('translateTo')}
                  </div>
                  {translateLanguages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleTranslateSelect(lang.code)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm font-medium text-slate-900">{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Translating Indicator */}
          {isTranslating && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">{t('translating')}</span>
            </div>
          )}

          {/* Load DOCX */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-600 hover:bg-slate-800 rounded-lg transition-all duration-150 cursor-pointer active:scale-[0.98]"
            title={t('loadDocx')}
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">{t('loadDocx')}</span>
          </button>

          {/* Download */}
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-600 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-150 cursor-pointer active:scale-[0.98]"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="text-sm font-medium hidden sm:inline">
              {isDownloading ? t('downloading') : t('download')}
            </span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* Language Selector */}
          <div className="relative" ref={langDropdownRef}>
            <button
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-2 hover:bg-slate-800 rounded-lg transition-all duration-150 cursor-pointer"
              aria-label={t('changeLanguage')}
            >
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-sm">{selectedLanguage?.flag}</span>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLangDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-[100] animate-dropdown">
                {uiLanguages.map(lang => {
                  const isSelected = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors duration-150 cursor-pointer ${isSelected ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{lang.flag}</span>
                        <span className={`text-sm font-medium ${isSelected ? 'text-indigo-600' : 'text-slate-900'}`}>
                          {lang.name}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
