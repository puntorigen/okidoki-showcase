'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Language, translations, TranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    
    // Sync with Okidoki widget
    if (typeof window !== 'undefined' && window.OkidokiWidget?.setLanguage) {
      window.OkidokiWidget.setLanguage(lang);
      console.log('[Language] Changed to:', lang);
    }
  }, []);

  // Get a translation string
  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key];
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
