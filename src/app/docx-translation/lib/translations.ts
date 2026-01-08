// Translations for the Document Translation showcase

export type Language = 'en' | 'es';

// Define the shape of translations
interface Translations {
  subtitle: string;
  download: string;
  downloading: string;
  loadDocx: string;
  changeLanguage: string;
  documentSummary: string;
  words: string;
  sections: string;
  noSections: string;
  untitled: string;
  tip: string;
  tips: string[];
  loadingEditor: string;
  failedToLoad: string;
  // Translation-specific
  translating: string;
  translateDocument: string;
  translationComplete: string;
  translationProgress: string;
  resumeTranslation: string;
  cancelTranslation: string;
  keepTranslated: string;
  restoreOriginal: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Header
    subtitle: 'AI-Powered Document Translation',
    download: 'Download',
    downloading: 'Downloading...',
    loadDocx: 'Load DOCX',
    changeLanguage: 'Change language',
    
    // Summary Panel
    documentSummary: 'Document Summary',
    words: 'Words',
    sections: 'Sections',
    noSections: 'No sections yet. Load a document or ask the AI to create one.',
    untitled: '(Untitled)',
    
    // Tip Bar
    tip: 'Tip',
    tips: [
      'Upload a document and ask the AI to translate it to any language.',
      'Try: "Translate this document to Spanish" or "Translate to French"',
      'The AI preserves formatting, tables, and document structure during translation.',
      'Large documents (50-100+ pages) are handled with smart batching for consistency.',
      'Industry-specific terminology is detected and translated appropriately.',
    ],
    
    // Loading states
    loadingEditor: 'Loading editor...',
    failedToLoad: 'Failed to load editor',
    
    // Translation-specific
    translating: 'Translating...',
    translateDocument: 'Translate Document',
    translationComplete: 'Translation complete!',
    translationProgress: 'Translation Progress',
    resumeTranslation: 'Resume Translation',
    cancelTranslation: 'Cancel Translation',
    keepTranslated: 'Keep translated content',
    restoreOriginal: 'Restore original document',
  },
  es: {
    // Header
    subtitle: 'Traducción de Documentos con IA',
    download: 'Descargar',
    downloading: 'Descargando...',
    loadDocx: 'Cargar DOCX',
    changeLanguage: 'Cambiar idioma',
    
    // Summary Panel
    documentSummary: 'Resumen del Documento',
    words: 'Palabras',
    sections: 'Secciones',
    noSections: 'Sin secciones aún. Carga un documento o pídele a la IA que cree uno.',
    untitled: '(Sin título)',
    
    // Tip Bar
    tip: 'Consejo',
    tips: [
      'Sube un documento y pídele a la IA que lo traduzca a cualquier idioma.',
      'Prueba: "Traduce este documento al inglés" o "Traducir al francés"',
      'La IA preserva el formato, tablas y estructura del documento durante la traducción.',
      'Documentos grandes (50-100+ páginas) se manejan con procesamiento inteligente por lotes.',
      'La terminología específica de cada industria se detecta y traduce apropiadamente.',
    ],
    
    // Loading states
    loadingEditor: 'Cargando editor...',
    failedToLoad: 'Error al cargar el editor',
    
    // Translation-specific
    translating: 'Traduciendo...',
    translateDocument: 'Traducir Documento',
    translationComplete: '¡Traducción completa!',
    translationProgress: 'Progreso de Traducción',
    resumeTranslation: 'Reanudar Traducción',
    cancelTranslation: 'Cancelar Traducción',
    keepTranslated: 'Mantener contenido traducido',
    restoreOriginal: 'Restaurar documento original',
  },
};

export type TranslationKey = keyof Translations;

// Type-safe string keys (excluding arrays)
export type StringTranslationKey = Exclude<TranslationKey, 'tips'>;

// Type-safe array keys
export type ArrayTranslationKey = 'tips';
