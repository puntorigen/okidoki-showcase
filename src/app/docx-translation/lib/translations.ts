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
  pages: string;
  sections: string;
  noSections: string;
  untitled: string;
  tip: string;
  tips: string[];
  loadingEditor: string;
  failedToLoad: string;
  // Translation-specific
  translating: string;
  translateTo: string;
  translateDocument: string;
  translationComplete: string;
  translationProgress: string;
  resumeTranslation: string;
  cancelTranslation: string;
  keepTranslated: string;
  restoreOriginal: string;
  // Contextual tips
  tipEmpty: string;
  tipHasContent: string;
  tipTranslating: string;
  tipComplete: string;
  tipReverted: string;
  // Summary
  detectedLanguage: string;
  translatedFrom: string;
  revertToOriginal: string;
  summary: string;
  generatingSummary: string;
  noSummaryYet: string;
  // Quick actions
  createContract: string;
  writeReport: string;
  askForHelp: string;
  // Translation overlay
  translatingDocument: string;
  analyzingDocument: string;
  translationError: string;
  stopTranslation: string;
  overlayHint: string;
  part: string;
  of: string;
  // Quick action prompts (sent to AI)
  contractPrompt: string;
  reportPrompt: string;
  helpPrompt: string;
  // Document properties
  editProperties: string;
  documentProperties: string;
  title: string;
  author: string;
  subject: string;
  keywords: string;
  documentTitle: string;
  authorName: string;
  documentSubject: string;
  keywordsPlaceholder: string;
  created: string;
  modified: string;
  by: string;
  cancel: string;
  save: string;
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
    documentSummary: 'Document',
    words: 'Words',
    pages: 'Pages',
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
    translateTo: 'Translate to',
    translateDocument: 'Translate',
    translationComplete: 'Translation complete!',
    translationProgress: 'Translation Progress',
    resumeTranslation: 'Resume Translation',
    cancelTranslation: 'Cancel Translation',
    keepTranslated: 'Keep translated content',
    restoreOriginal: 'Restore original document',
    
    // Contextual tips
    tipEmpty: 'Start typing, drop a DOCX file, or ask the assistant to help',
    tipHasContent: 'Ready to translate! Click "Translate" or ask the assistant',
    tipTranslating: 'Translation in progress — you can see the document updating',
    tipComplete: 'Translation complete! Click revert in sidebar if needed',
    tipReverted: 'Original document restored',
    
    // Summary
    detectedLanguage: 'detected',
    translatedFrom: 'from',
    revertToOriginal: 'Revert to original',
    summary: 'Summary',
    generatingSummary: 'Generating summary...',
    noSummaryYet: 'Add content to see a summary',
    
    // Quick actions
    createContract: 'Create a contract',
    writeReport: 'Write a report',
    askForHelp: 'Help',
    // Quick action prompts (sent to AI)
    contractPrompt: 'Write a formal contract document between two parties using placeholders for names, dates, and terms',
    reportPrompt: 'Create a professional business report in the document editor with executive summary, key findings, analysis, and recommendations sections',
    helpPrompt: 'What can you help me with in this document editor?',
    // Translation overlay
    translatingDocument: 'Translating document',
    analyzingDocument: 'Analyzing document',
    translationError: 'Translation error',
    stopTranslation: 'Stop Translation',
    overlayHint: 'You can see the document updating in real-time behind this overlay',
    part: 'Part',
    of: 'of',
    // Document properties
    editProperties: 'Edit properties',
    documentProperties: 'Document Properties',
    title: 'Title',
    author: 'Author',
    subject: 'Subject',
    keywords: 'Keywords',
    documentTitle: 'Document title',
    authorName: 'Author name',
    documentSubject: 'Document subject',
    keywordsPlaceholder: 'report, quarterly, finance',
    created: 'Created',
    modified: 'Modified',
    by: 'by',
    cancel: 'Cancel',
    save: 'Save',
  },
  es: {
    // Header
    subtitle: 'Traducción de Documentos con IA',
    download: 'Descargar',
    downloading: 'Descargando...',
    loadDocx: 'Cargar DOCX',
    changeLanguage: 'Cambiar idioma',
    
    // Summary Panel
    documentSummary: 'Documento',
    words: 'Palabras',
    pages: 'Páginas',
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
    translateTo: 'Traducir a',
    translateDocument: 'Traducir',
    translationComplete: '¡Traducción completa!',
    translationProgress: 'Progreso de Traducción',
    resumeTranslation: 'Reanudar Traducción',
    cancelTranslation: 'Cancelar Traducción',
    keepTranslated: 'Mantener contenido traducido',
    restoreOriginal: 'Restaurar documento original',
    
    // Contextual tips
    tipEmpty: 'Escribe, arrastra un DOCX, o pídele ayuda al asistente',
    tipHasContent: '¡Listo para traducir! Haz clic en "Traducir" o pregunta al asistente',
    tipTranslating: 'Traducción en progreso — puedes ver el documento actualizándose',
    tipComplete: '¡Traducción completa! Haz clic en revertir en el panel si lo necesitas',
    tipReverted: 'Documento original restaurado',
    
    // Summary
    detectedLanguage: 'detectado',
    translatedFrom: 'desde',
    revertToOriginal: 'Revertir al original',
    summary: 'Resumen',
    generatingSummary: 'Generando resumen...',
    noSummaryYet: 'Añade contenido para ver un resumen',
    
    // Quick actions
    createContract: 'Crear un contrato',
    writeReport: 'Escribir un informe',
    askForHelp: 'Ayuda',
    // Quick action prompts (sent to AI)
    contractPrompt: 'Escribe un contrato formal entre dos partes usando placeholders para nombres, fechas y términos',
    reportPrompt: 'Crea un informe empresarial profesional en el editor de documentos con resumen ejecutivo, hallazgos clave, análisis y secciones de recomendaciones',
    helpPrompt: '¿En qué puedes ayudarme con este editor de documentos?',
    // Translation overlay
    translatingDocument: 'Traduciendo documento',
    analyzingDocument: 'Analizando documento',
    translationError: 'Error de traducción',
    stopTranslation: 'Detener traducción',
    overlayHint: 'Puedes ver el documento actualizándose en tiempo real detrás de esta ventana',
    part: 'Parte',
    of: 'de',
    // Document properties
    editProperties: 'Editar propiedades',
    documentProperties: 'Propiedades del Documento',
    title: 'Título',
    author: 'Autor',
    subject: 'Asunto',
    keywords: 'Palabras clave',
    documentTitle: 'Título del documento',
    authorName: 'Nombre del autor',
    documentSubject: 'Asunto del documento',
    keywordsPlaceholder: 'informe, trimestral, finanzas',
    created: 'Creado',
    modified: 'Modificado',
    by: 'por',
    cancel: 'Cancelar',
    save: 'Guardar',
  },
};

export type TranslationKey = keyof Translations;

// Type-safe string keys (excluding arrays)
export type StringTranslationKey = Exclude<TranslationKey, 'tips'>;

// Type-safe array keys
export type ArrayTranslationKey = 'tips';
