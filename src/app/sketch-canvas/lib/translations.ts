// Translations for the Sketch Canvas AI showcase

export type Language = 'en' | 'es';

// Define the shape of translations
interface Translations {
  // Header
  subtitle: string;
  
  // Mode toggle
  sketchMode: string;
  colorMode: string;
  redGuides: string;
  
  // Tools
  pencilSketch: string;
  pencilColor: string;
  eraser: string;
  undo: string;
  redo: string;
  clearCanvas: string;
  renderWithAI: string;
  
  // Aspect ratios
  portrait: string;
  standard: string;
  landscape: string;
  
  // Scene panel
  sceneInfo: string;
  canvasPreview: string;
  sceneDescription: string;
  noSceneDescription: string;
  tips: string;
  tipDraw: string;
  tipAddSun: string;
  tipRemove: string;
  tipRender: string;
  noContent: string;
  
  // Render modal
  renderModalTitle: string;
  yourRender: string;
  chooseStyle: string;
  watercolor: string;
  watercolorDesc: string;
  oilPainting: string;
  oilPaintingDesc: string;
  pencilSketchStyle: string;
  pencilSketchDesc: string;
  digitalArt: string;
  digitalArtDesc: string;
  animeStyle: string;
  animeStyleDesc: string;
  impressionist: string;
  impressionistDesc: string;
  custom: string;
  customDesc: string;
  describeStyle: string;
  stylePlaceholder: string;
  createArtwork: string;
  download: string;
  renderAgain: string;
  
  // Loading
  rendering: string;
  aiWorking: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Header
    subtitle: 'Draw and let AI help you build your scene',
    
    // Mode toggle
    sketchMode: 'Sketch',
    colorMode: 'Color',
    redGuides: 'Red guides',
    
    // Tools
    pencilSketch: 'Pencil (draw in red)',
    pencilColor: 'Pencil (draw with selected color)',
    eraser: 'Eraser',
    undo: 'Undo',
    redo: 'Redo',
    clearCanvas: 'Clear canvas',
    renderWithAI: 'Render with AI',
    
    // Aspect ratios
    portrait: 'Portrait',
    standard: 'Standard',
    landscape: 'Landscape',
    
    // Scene panel
    sceneInfo: 'Scene Info',
    canvasPreview: 'Canvas Preview',
    sceneDescription: 'Scene Description',
    noSceneDescription: 'No scene description yet. Start drawing or ask AI to add elements.',
    tips: 'Tips',
    tipDraw: 'Draw with the red pencil to create guides',
    tipAddSun: 'Ask AI: "add a sun to the right"',
    tipRemove: 'Ask AI: "remove the tree"',
    tipRender: 'Use "Render with AI" for final art',
    noContent: 'No content',
    
    // Render modal
    renderModalTitle: 'Render with AI',
    yourRender: 'Your Render',
    chooseStyle: 'Choose a Style',
    watercolor: 'Watercolor',
    watercolorDesc: 'Soft, flowing watercolor painting',
    oilPainting: 'Oil Painting',
    oilPaintingDesc: 'Rich, textured oil painting style',
    pencilSketchStyle: 'Pencil Sketch',
    pencilSketchDesc: 'Detailed pencil drawing',
    digitalArt: 'Digital Art',
    digitalArtDesc: 'Modern digital illustration',
    animeStyle: 'Anime Style',
    animeStyleDesc: 'Japanese anime aesthetic',
    impressionist: 'Impressionist',
    impressionistDesc: 'Impressionist painting style',
    custom: 'Custom',
    customDesc: 'Describe your own style',
    describeStyle: 'Describe your style',
    stylePlaceholder: 'e.g., Studio Ghibli style with soft colors',
    createArtwork: 'Create Artwork',
    download: 'Download',
    renderAgain: 'Render Again',
    
    // Loading
    rendering: 'Rendering...',
    aiWorking: 'AI is working on your sketch',
  },
  es: {
    // Header
    subtitle: 'Dibuja y deja que la IA te ayude a construir tu escena',
    
    // Mode toggle
    sketchMode: 'Boceto',
    colorMode: 'Color',
    redGuides: 'Guías rojas',
    
    // Tools
    pencilSketch: 'Lápiz (dibujar en rojo)',
    pencilColor: 'Lápiz (dibujar con color seleccionado)',
    eraser: 'Borrador',
    undo: 'Deshacer',
    redo: 'Rehacer',
    clearCanvas: 'Limpiar lienzo',
    renderWithAI: 'Renderizar con IA',
    
    // Aspect ratios
    portrait: 'Vertical',
    standard: 'Estándar',
    landscape: 'Horizontal',
    
    // Scene panel
    sceneInfo: 'Info de Escena',
    canvasPreview: 'Vista Previa',
    sceneDescription: 'Descripción de Escena',
    noSceneDescription: 'Sin descripción aún. Comienza a dibujar o pídele a la IA que añada elementos.',
    tips: 'Consejos',
    tipDraw: 'Dibuja con el lápiz rojo para crear guías',
    tipAddSun: 'Pídele a la IA: "añade un sol a la derecha"',
    tipRemove: 'Pídele a la IA: "quita el árbol"',
    tipRender: 'Usa "Renderizar con IA" para el arte final',
    noContent: 'Sin contenido',
    
    // Render modal
    renderModalTitle: 'Renderizar con IA',
    yourRender: 'Tu Renderizado',
    chooseStyle: 'Elige un Estilo',
    watercolor: 'Acuarela',
    watercolorDesc: 'Pintura de acuarela suave y fluida',
    oilPainting: 'Óleo',
    oilPaintingDesc: 'Estilo de pintura al óleo con textura',
    pencilSketchStyle: 'Boceto a Lápiz',
    pencilSketchDesc: 'Dibujo detallado a lápiz',
    digitalArt: 'Arte Digital',
    digitalArtDesc: 'Ilustración digital moderna',
    animeStyle: 'Estilo Anime',
    animeStyleDesc: 'Estética de anime japonés',
    impressionist: 'Impresionista',
    impressionistDesc: 'Estilo de pintura impresionista',
    custom: 'Personalizado',
    customDesc: 'Describe tu propio estilo',
    describeStyle: 'Describe tu estilo',
    stylePlaceholder: 'ej., Estilo Studio Ghibli con colores suaves',
    createArtwork: 'Crear Arte',
    download: 'Descargar',
    renderAgain: 'Renderizar de Nuevo',
    
    // Loading
    rendering: 'Renderizando...',
    aiWorking: 'La IA está trabajando en tu boceto',
  },
};

export type TranslationKey = keyof Translations;
