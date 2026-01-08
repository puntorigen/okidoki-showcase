'use client';

import { ChevronDown, Download, Languages, Globe, Check, Upload } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Specialization } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { Language } from '../lib/translations';

const languages = [
  { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
  { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
];

interface HeaderProps {
  specializations: Specialization[];
  currentSpecialization: Specialization;
  onSpecializationChange: (spec: Specialization) => void;
  onDownload: () => void;
  isDownloading: boolean;
  onLoadFile: (file: File) => void;
}

export default function Header({
  specializations,
  currentSpecialization,
  onSpecializationChange,
  onDownload,
  isDownloading,
  onLoadFile,
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadFile(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setIsLangDropdownOpen(false);
  };

  const selectedLanguage = languages.find(l => l.code === language);

  return (
    <header className="bg-slate-900 text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg flex items-center justify-center">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">
              Okidoki <span className="text-slate-400">×</span> DocTranslate
            </h1>
            <p className="text-xs text-slate-400">{t('subtitle')}</p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Specialization Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <span className="text-sm">{currentSpecialization.name}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50">
                {specializations.map(spec => (
                  <button
                    key={spec.id}
                    onClick={() => {
                      onSpecializationChange(spec);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer ${
                      spec.id === currentSpecialization.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900">{spec.name}</div>
                    <div className="text-xs text-slate-500">{spec.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <div className="relative" ref={langDropdownRef}>
            <button
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              aria-label={t('changeLanguage')}
            >
              <Globe className="w-4 h-4 text-slate-300" />
              <span className="text-sm hidden sm:inline">{selectedLanguage?.flag}</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isLangDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50">
                {languages.map(lang => {
                  const isSelected = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{lang.flag}</span>
                        <span className={`text-sm font-medium ${isSelected ? 'text-indigo-600' : 'text-slate-900'}`}>
                          {lang.name}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Load DOCX Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
            title={t('loadDocx')}
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">{t('loadDocx')}</span>
          </button>

          {/* Download Button */}
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {isDownloading ? t('downloading') : t('download')}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
