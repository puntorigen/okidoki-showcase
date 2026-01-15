'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  AspectRatio, 
  ASPECT_RATIOS, 
  DrawingTool,
  SceneState,
} from './types';
import { SketchCanvas, SketchCanvasRef } from './components/SketchCanvas';
import { CanvasToolbar } from './components/CanvasToolbar';
import { AspectRatioSelector } from './components/AspectRatioSelector';
import { ScenePanel } from './components/ScenePanel';
import { RenderModal } from './components/RenderModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { createSketchTools } from './lib/sketch-tools';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';

// Okidoki public key - same as docx-translation app
const SKETCH_CANVAS_PUBLIC_KEY = 'pk_9e90fab19e5a64da2576238a33b2bfe2d9c18a592189ab77';

export default function SketchCanvasPage() {
  return (
    <LanguageProvider>
      <SketchCanvasContent />
    </LanguageProvider>
  );
}

function SketchCanvasContent() {
  const { t } = useLanguage();
  // Canvas state
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('landscape');
  const [activeTool, setActiveTool] = useState<DrawingTool>('pencil');
  const [isRendering, setIsRendering] = useState(false);
  const [sceneState, setSceneState] = useState<SceneState>({
    description: '',
    hasColorReference: false,
  });
  
  // Drawing mode state
  const [isSketchMode, setIsSketchMode] = useState(true);
  const [drawColor, setDrawColor] = useState('#3b82f6'); // blue default for color mode
  
  // Modal state
  const [showRenderModal, setShowRenderModal] = useState(false);
  const [lastFinalRender, setLastFinalRender] = useState<string | null>(null);
  
  // Widget state
  const [widgetReady, setWidgetReady] = useState(false);
  
  // Refs
  const canvasRef = useRef<SketchCanvasRef>(null);
  const toolsRegisteredRef = useRef(false);
  
  // Canvas size from aspect ratio
  const canvasSize = ASPECT_RATIOS[aspectRatio];

  // Wait for Okidoki widget to be ready
  useEffect(() => {
    let isMounted = true;
    
    const checkWidget = setInterval(() => {
      if (window.OkidokiWidget?.reinitialize && isMounted) {
        clearInterval(checkWidget);
        
        console.log('[Okidoki] Reinitializing with sketch canvas app');
        window.OkidokiWidget.reinitialize(SKETCH_CANVAS_PUBLIC_KEY);
        
        if (isMounted) {
          setWidgetReady(true);
          console.log('[Okidoki] Widget ready');
        }
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(checkWidget);
      console.warn('[Okidoki] Widget initialization timed out after 10s');
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(checkWidget);
      clearTimeout(timeout);
    };
  }, []);

  // Register tools when widget is ready
  useEffect(() => {
    if (!widgetReady || toolsRegisteredRef.current) return;
    if (!canvasRef.current) return;

    const tools = createSketchTools({
      canvasRef,
      setIsRendering,
      setSceneState,
      setLastFinalRender,
      setShowRenderModal,
    });

    window.OkidokiWidget?.registerTools(tools);
    toolsRegisteredRef.current = true;
    console.log('[Okidoki] Tools registered:', tools.map((t: { name: string }) => t.name));
  }, [widgetReady]);

  // Handle clear canvas
  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setSceneState({ description: '', hasColorReference: false });
  }, []);

  // Handle undo
  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  // Handle aspect ratio change
  const handleAspectRatioChange = useCallback((ratio: AspectRatio) => {
    setAspectRatio(ratio);
    // Clear canvas when changing aspect ratio
    setTimeout(() => {
      canvasRef.current?.clear();
      setSceneState({ description: '', hasColorReference: false });
    }, 100);
  }, []);

  // Handle render with AI button
  const handleRenderWithAI = useCallback(() => {
    setShowRenderModal(true);
  }, []);

  // Handle final render request
  const handleFinalRender = useCallback(async (style: string) => {
    if (!canvasRef.current) return;
    
    setIsRendering(true);
    setShowRenderModal(false);
    
    try {
      const sketchBase64 = canvasRef.current.getSketchBase64();
      
      // Import and call the server action
      const { finalRender } = await import('./services/gemini');
      const result = await finalRender(sketchBase64, style);
      
      if (result.success && result.image) {
        setLastFinalRender(result.image);
        setShowRenderModal(true);
      } else {
        console.error('[Render] Failed:', result.error);
      }
    } catch (error) {
      console.error('[Render] Error:', error);
    } finally {
      setIsRendering(false);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <Link href="/" className="text-white hover:text-rose-300 transition-colors cursor-pointer">Okidoki</Link>
              <span className="text-slate-500 mx-2">×</span>
              <span className="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
                Sketch Canvas
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {t('subtitle')}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <AspectRatioSelector
              value={aspectRatio}
              onChange={handleAspectRatioChange}
              disabled={isRendering}
            />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Canvas area */}
        <main className="flex-1 flex flex-col min-w-0 p-4">
          {/* Toolbar */}
          <CanvasToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onClear={handleClear}
            onUndo={handleUndo}
            onRenderWithAI={handleRenderWithAI}
            isRendering={isRendering}
            canUndo={canvasRef.current?.canUndo() ?? false}
            drawColor={drawColor}
            onColorChange={setDrawColor}
            isSketchMode={isSketchMode}
            onModeChange={setIsSketchMode}
          />
          
          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center min-h-0 mt-4">
            <SketchCanvas
              ref={canvasRef}
              size={canvasSize}
              activeTool={activeTool}
              isRendering={isRendering}
              isSketchMode={isSketchMode}
              drawColor={drawColor}
            />
          </div>
        </main>

        {/* Scene panel (collapsible sidebar) */}
        <aside className="hidden lg:block w-72 border-l border-slate-700 bg-slate-800/50">
          <ScenePanel
            sceneState={sceneState}
            canvasRef={canvasRef}
          />
        </aside>
      </div>

      {/* Render modal */}
      {showRenderModal && (
        <RenderModal
          isOpen={showRenderModal}
          onClose={() => {
            setShowRenderModal(false);
            setLastFinalRender(null); // Reset so next open shows style picker
          }}
          onRender={handleFinalRender}
          lastRender={lastFinalRender}
          isRendering={isRendering}
        />
      )}

      {/* Loading overlay */}
      {isRendering && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-rose-500 border-r-orange-500 border-b-rose-500 border-l-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white text-lg mt-4">{t('rendering')}</p>
            <p className="text-slate-400 text-sm">{t('aiWorking')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
