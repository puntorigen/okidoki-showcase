'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Language, translations, StringTranslationKey, ArrayTranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: StringTranslationKey) => string;
  tArray: (key: ArrayTranslationKey) => string[];
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

  // Get a single translation string
  const t = useCallback((key: StringTranslationKey): string => {
    return translations[language][key];
  }, [language]);

  // Get an array of translations (for tips, etc.)
  const tArray = useCallback((key: ArrayTranslationKey): string[] => {
    return translations[language][key];
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tArray }}>
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

// Type declaration for window.OkidokiWidget
declare global {
  interface Window {
    OkidokiWidget?: {
      init?: (config: { publicKey: string; apiUrl?: string }) => void;
      reinitialize?: (publicKey: string, apiUrl?: string) => void;
      registerTools?: (tools: any[]) => void;
      unregisterTools?: (names?: string[]) => void;
      setLanguage?: (lang: 'en' | 'es') => void;
      getLanguage?: () => 'en' | 'es';
      setToolNotification?: (message: string | null) => void;
      sendEmail?: (fields: Record<string, any>) => void;
      scheduleMeeting?: (meetingType?: string) => void;
      ask?: (params: {
        prompt: string;
        context?: string;
        maxTokens?: number;
        output?: Record<string, any>;
      }) => Promise<{ success: boolean; result?: any; error?: string }>;
      helpers?: {
        string: (desc: string) => any;
        boolean: (desc: string) => any;
        array: (schema: any, desc: string) => any;
        object: (schema: Record<string, any>) => any;
      };
    };
  }
}

