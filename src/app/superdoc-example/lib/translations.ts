// Translations for the SuperDoc showcase

export type Language = 'en' | 'es';

// Define the shape of translations
interface Translations {
  subtitle: string;
  download: string;
  downloading: string;
  changeLanguage: string;
  documentSummary: string;
  words: string;
  sections: string;
  noSections: string;
  untitled: string;
  tip: string;
  tips: string[];
  loadingEditor: string;
  loadingSuperDoc: string;
  failedToLoad: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Header
    subtitle: 'AI-Powered Document Assistant',
    download: 'Download',
    downloading: 'Downloading...',
    changeLanguage: 'Change language',
    
    // Summary Panel
    documentSummary: 'Document Summary',
    words: 'Words',
    sections: 'Sections',
    noSections: 'No sections yet. Start typing or ask the AI to create a document.',
    untitled: '(Untitled)',
    
    // Tip Bar
    tip: 'Tip',
    tips: [
      'Select text and ask the AI to modify it, or describe what you need.',
      'Try: "Create a service agreement for software development with TechFlow Inc"',
      'Ask the AI to add sections, modify clauses, or format your document.',
      'Your changes are tracked when you edit after the AI creates content.',
    ],
    
    // Loading states
    loadingEditor: 'Loading document editor...',
    loadingSuperDoc: 'Loading SuperDoc...',
    failedToLoad: 'Failed to load editor',
  },
  es: {
    // Header
    subtitle: 'Asistente de Documentos con IA',
    download: 'Descargar',
    downloading: 'Descargando...',
    changeLanguage: 'Cambiar idioma',
    
    // Summary Panel
    documentSummary: 'Resumen del Documento',
    words: 'Palabras',
    sections: 'Secciones',
    noSections: 'Sin secciones aún. Comienza a escribir o pídele a la IA que cree un documento.',
    untitled: '(Sin título)',
    
    // Tip Bar
    tip: 'Consejo',
    tips: [
      'Selecciona texto y pídele a la IA que lo modifique, o describe lo que necesitas.',
      'Prueba: "Crea un contrato de servicios para desarrollo de software con TechFlow Inc"',
      'Pídele a la IA que agregue secciones, modifique cláusulas o formatee tu documento.',
      'Tus cambios se rastrean cuando editas después de que la IA crea contenido.',
    ],
    
    // Loading states
    loadingEditor: 'Cargando editor de documentos...',
    loadingSuperDoc: 'Cargando SuperDoc...',
    failedToLoad: 'Error al cargar el editor',
  },
};

export type TranslationKey = keyof Translations;

// Type-safe string keys (excluding arrays)
export type StringTranslationKey = Exclude<TranslationKey, 'tips'>;

// Type-safe array keys
export type ArrayTranslationKey = 'tips';

