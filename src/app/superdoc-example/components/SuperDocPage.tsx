'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Header from './Header';
import SuperDocViewer, { SuperDocViewerRef } from './SuperDocViewer';
import SummaryPanel from './SummaryPanel';
import TipBar from './TipBar';
import { specializations, defaultSpecialization } from '../lib/specializations';
import { createSuperDocTools } from '../lib/superdoc-tools';
import { initialDocumentState } from '../lib/document-state';
import { DocumentState, DocumentSummary, Specialization } from '../types';
import { LanguageProvider, useLanguage } from '../lib/LanguageContext';

// Inner component that uses the language context
function SuperDocPageInner() {
  const { language } = useLanguage();
  // State
  const [currentSpecialization, setCurrentSpecialization] = useState<Specialization>(defaultSpecialization);
  const [documentState, setDocumentState] = useState<DocumentState>(initialDocumentState);
  const [summary, setSummary] = useState<DocumentSummary>({ wordCount: 0, sections: [] });
  const [isDownloading, setIsDownloading] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  // Refs
  const viewerRef = useRef<SuperDocViewerRef>(null);
  const toolsRegisteredRef = useRef(false);
  // Persistent state for document creation (prevents retries and survives re-renders)
  const documentCreationStateRef = useRef<{
    inProgress: boolean;
    completedSuccessfully: boolean;
    lastCreatedTitle?: string;
  }>({
    inProgress: false,
    completedSuccessfully: false,
    lastCreatedTitle: undefined,
  });
  // Virtual document state for reliable section updates
  const virtualDocumentRef = useRef<{
    title: string;
    sections: Array<{ title: string; content: string }>;
  } | null>(null);

  // Wait for Okidoki widget to be ready, then reinitialize with showcase app
  useEffect(() => {
    let isMounted = true;
    
    const checkWidget = setInterval(() => {
      if (window.OkidokiWidget?.reinitialize && isMounted) {
        clearInterval(checkWidget);
        
        // Reinitialize widget with showcase app ID
        console.log('[Okidoki] Reinitializing with showcase app:', defaultSpecialization.publicKey);
        window.OkidokiWidget.reinitialize(defaultSpecialization.publicKey);
        
        // Sync widget language with current language
        window.OkidokiWidget.setLanguage?.(language);
        
        if (isMounted) {
          setWidgetReady(true);
          console.log('[Okidoki] Widget ready (switched to showcase app)');
        }
      }
    }, 100);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkWidget);
      console.warn('[Okidoki] Widget initialization timed out after 10s');
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(checkWidget);
      clearTimeout(timeout);
    };
  }, [language]);

  // Register tools when both widget and viewer are ready
  useEffect(() => {
    if (!widgetReady || toolsRegisteredRef.current) return;

    const checkAndRegister = () => {
      const viewer = viewerRef.current;

      if (!viewer?.isReady() || !window.OkidokiWidget?.registerTools) {
        return false;
      }

      // Create tools with context
      const tools = createSuperDocTools({
        viewerRef,
        documentState,
        setDocumentState,
        documentCreationStateRef,
        virtualDocumentRef,
      });

      // Register tools
      window.OkidokiWidget.registerTools(tools);
      toolsRegisteredRef.current = true;
      console.log('[Okidoki] Tools registered:', tools.map(t => t.name));
      return true;
    };

    // Try immediately
    if (checkAndRegister()) return;

    // Retry with interval
    const interval = setInterval(() => {
      if (checkAndRegister()) {
        clearInterval(interval);
      }
    }, 500);

    // Cleanup
    return () => clearInterval(interval);
  }, [widgetReady, documentState]);

  // Re-register tools when document state changes (for track changes logic)
  useEffect(() => {
    if (!toolsRegisteredRef.current) return;

    const viewer = viewerRef.current;

    if (!viewer?.isReady() || !window.OkidokiWidget?.registerTools) return;

    // Re-create tools with updated document state
    const tools = createSuperDocTools({
      viewerRef,
      documentState,
      setDocumentState,
      documentCreationStateRef,
      virtualDocumentRef,
    });

    // Unregister and re-register
    window.OkidokiWidget.unregisterTools?.();
    window.OkidokiWidget.registerTools(tools);
    console.log('[Okidoki] Tools re-registered with updated state');
  }, [documentState.userHasEdited]);

  // Handle specialization change (switches to different Okidoki app)
  const handleSpecializationChange = useCallback((spec: Specialization) => {
    setCurrentSpecialization(spec);

    // Reinitialize widget with new app ID
    if (window.OkidokiWidget?.reinitialize) {
      window.OkidokiWidget.reinitialize(spec.publicKey);
      
      // Sync widget language with current language
      window.OkidokiWidget.setLanguage?.(language);
      
      console.log('[Okidoki] Switched to app:', spec.publicKey);
      
      // Re-register tools after reinitializing
      toolsRegisteredRef.current = false;
    }
  }, [language]);

  // Handle download
  const handleDownload = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer?.isReady()) {
      console.error('[Download] Viewer not ready');
      return;
    }

    setIsDownloading(true);
    try {
      const blob = await viewer.exportDocx();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('[Download] Document exported');
    } catch (error) {
      console.error('[Download] Export failed:', error);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  // Handle summary update from editor
  const handleSummaryUpdate = useCallback((newSummary: DocumentSummary) => {
    setSummary(newSummary);
  }, []);

  // Handle section click in summary panel
  const handleSectionClick = useCallback(async (pos: number) => {
    // Section navigation is not directly supported with docx-diff-editor
    // This would need to be implemented via the editor's scroll functionality
    console.log('[SectionClick] Position:', pos);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header - Fixed height */}
      <Header
        specializations={specializations}
        currentSpecialization={currentSpecialization}
        onSpecializationChange={handleSpecializationChange}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />

      {/* Main Content Area - Grid layout for predictable sizing */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_280px] overflow-hidden">
        {/* Editor Section */}
        <main className="min-h-0 p-3 lg:p-4 overflow-hidden">
          <SuperDocViewer
            ref={viewerRef}
            onSummaryUpdate={handleSummaryUpdate}
            onDocumentStateChange={setDocumentState}
            documentState={documentState}
          />
        </main>

        {/* Summary Panel - Always visible on md+ */}
        <aside className="hidden md:block border-l border-slate-200 bg-white overflow-auto">
          <div className="p-3 lg:p-4">
            <SummaryPanel
              summary={summary}
              onSectionClick={handleSectionClick}
            />
          </div>
        </aside>
      </div>

      {/* Tip Bar - Fixed height */}
      <TipBar />
    </div>
  );
}

// Main export wrapped with LanguageProvider
export default function SuperDocPage() {
  return (
    <LanguageProvider>
      <SuperDocPageInner />
    </LanguageProvider>
  );
}

// Window.OkidokiWidget interface is defined in lib/LanguageContext.tsx
