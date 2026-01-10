'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Header from './Header';
import TranslationViewer, { TranslationViewerRef } from './TranslationViewer';
import SummaryPanel from './SummaryPanel';
import TipBar from './TipBar';
import TranslationOverlay from './TranslationOverlay';
import TranslationResumeDialog from './TranslationResumeDialog';
import TranslationCancelDialog from './TranslationCancelDialog';
import { specializations, defaultSpecialization } from '../lib/specializations';
import { createTranslationTools, getTranslationOrchestrator, setTranslationProgressCallback, requestTranslationCancel, resolveCancelChoice } from '../lib/translation-tools';
import { initialDocumentState } from '../lib/document-state';
import { DocumentState, DocumentSummary, Specialization } from '../types';
import { LanguageProvider, useLanguage } from '../lib/LanguageContext';
import { TranslationProgress } from '@/lib/translation';

// Inner component that uses the language context
function TranslationPageInner() {
  const { language } = useLanguage();
  // State
  const [currentSpecialization, setCurrentSpecialization] = useState<Specialization>(defaultSpecialization);
  const [documentState, setDocumentState] = useState<DocumentState>(initialDocumentState);
  const [summary, setSummary] = useState<DocumentSummary>({ wordCount: 0, sections: [] });
  const [isDownloading, setIsDownloading] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  // Translation state
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [incompleteSummary, setIncompleteSummary] = useState<{
    sourceLanguage: string;
    targetLanguage: string;
    progress: number;
    lastUpdated: Date;
  } | null>(null);

  // Refs
  const viewerRef = useRef<TranslationViewerRef>(null);
  const toolsRegisteredRef = useRef(false);
  const documentCreationStateRef = useRef<{
    inProgress: boolean;
    completedSuccessfully: boolean;
    lastCreatedTitle?: string;
  }>({
    inProgress: false,
    completedSuccessfully: false,
    lastCreatedTitle: undefined,
  });
  const virtualDocumentRef = useRef<{
    title: string;
    sections: Array<{ title: string; content: string }>;
  } | null>(null);

  // Set up translation progress callback
  useEffect(() => {
    setTranslationProgressCallback((progress) => {
      setTranslationProgress(progress);
    });

    return () => {
      setTranslationProgressCallback(null);
    };
  }, []);

  // Check for incomplete translation on mount
  useEffect(() => {
    const orchestrator = getTranslationOrchestrator();
    const summary = orchestrator.getIncompleteSummary();
    if (summary) {
      setIncompleteSummary(summary);
      setShowResumeDialog(true);
    }
  }, []);

  // Wait for Okidoki widget to be ready, then reinitialize with showcase app
  useEffect(() => {
    let isMounted = true;
    
    const checkWidget = setInterval(() => {
      if (window.OkidokiWidget?.reinitialize && isMounted) {
        clearInterval(checkWidget);
        
        console.log('[Okidoki] Reinitializing with showcase app:', defaultSpecialization.publicKey);
        window.OkidokiWidget.reinitialize(defaultSpecialization.publicKey);
        window.OkidokiWidget.setLanguage?.(language);
        
        if (isMounted) {
          setWidgetReady(true);
          console.log('[Okidoki] Widget ready (switched to showcase app)');
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
  }, [language]);

  // Register tools when both widget and viewer are ready
  useEffect(() => {
    if (!widgetReady || toolsRegisteredRef.current) return;

    const checkAndRegister = () => {
      const viewer = viewerRef.current;

      if (!viewer?.isReady() || !window.OkidokiWidget?.registerTools) {
        return false;
      }

      const tools = createTranslationTools({
        viewerRef,
        documentState,
        setDocumentState,
        documentCreationStateRef,
        virtualDocumentRef,
      });

      window.OkidokiWidget.registerTools(tools);
      toolsRegisteredRef.current = true;
      console.log('[Okidoki] Tools registered:', tools.map(t => t.name));
      return true;
    };

    if (checkAndRegister()) return;

    const interval = setInterval(() => {
      if (checkAndRegister()) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [widgetReady, documentState]);

  // Re-register tools when document state changes
  useEffect(() => {
    if (!toolsRegisteredRef.current) return;

    const viewer = viewerRef.current;
    if (!viewer?.isReady() || !window.OkidokiWidget?.registerTools) return;

    const tools = createTranslationTools({
      viewerRef,
      documentState,
      setDocumentState,
      documentCreationStateRef,
      virtualDocumentRef,
    });

    window.OkidokiWidget.unregisterTools?.();
    window.OkidokiWidget.registerTools(tools);
    console.log('[Okidoki] Tools re-registered with updated state');
  }, [documentState.userHasEdited]);

  // Handle specialization change
  const handleSpecializationChange = useCallback((spec: Specialization) => {
    setCurrentSpecialization(spec);

    if (window.OkidokiWidget?.reinitialize) {
      window.OkidokiWidget.reinitialize(spec.publicKey);
      window.OkidokiWidget.setLanguage?.(language);
      console.log('[Okidoki] Switched to app:', spec.publicKey);
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'translated-document.docx';
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
    console.log('[SectionClick] Position:', pos);
  }, []);

  // Translation cancel handler
  const handleCancelTranslation = useCallback(() => {
    // Request cancellation from orchestrator and show dialog
    requestTranslationCancel();
    setShowCancelDialog(true);
  }, []);

  // Resume translation handler
  const handleResumeTranslation = useCallback(async () => {
    setShowResumeDialog(false);
    const orchestrator = getTranslationOrchestrator();
    const persistedState = orchestrator.checkForIncompleteTranslation();
    
    if (persistedState && viewerRef.current) {
      await orchestrator.resume(
        persistedState,
        window.OkidokiWidget,
        {
          onProgress: setTranslationProgress,
          onComplete: async (json) => {
            await viewerRef.current?.setSource(json);
            setTranslationProgress(null);
          },
          onError: (error) => {
            console.error('[Resume] Error:', error);
            setTranslationProgress(null);
          },
        },
        async (json) => {
          await viewerRef.current?.setSource(json);
        }
      );
    }
  }, []);

  // Start over handler
  const handleStartOver = useCallback(() => {
    setShowResumeDialog(false);
    const orchestrator = getTranslationOrchestrator();
    orchestrator.discardIncomplete();
    setIncompleteSummary(null);
  }, []);

  // Dismiss resume dialog
  const handleDismissResume = useCallback(() => {
    setShowResumeDialog(false);
  }, []);

  // Keep translated content
  const handleKeepTranslated = useCallback(() => {
    // Resolve the cancel choice - this unblocks the orchestrator
    resolveCancelChoice('keep');
    setShowCancelDialog(false);
    setTranslationProgress(null);
  }, []);

  // Restore original document
  const handleRestoreOriginal = useCallback(() => {
    // Resolve the cancel choice - this unblocks the orchestrator
    resolveCancelChoice('restore');
    setShowCancelDialog(false);
    setTranslationProgress(null);
    
    // Restore the original document using updateContent (preserves template)
    const orchestrator = getTranslationOrchestrator();
    const persistedState = orchestrator.checkForIncompleteTranslation();
    
    if (persistedState?.originalDocumentJson && viewerRef.current) {
      viewerRef.current.updateContent(persistedState.originalDocumentJson);
    }
  }, []);

  // Handle loading a DOCX file
  const handleLoadFile = useCallback(async (file: File) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      await viewer.setSource(file);
      setDocumentState({ createdByAI: false, userHasEdited: false });
      console.log('[Load] DOCX loaded:', file.name);
    } catch (error) {
      console.error('[Load] Failed to load DOCX:', error);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <Header
        specializations={specializations}
        currentSpecialization={currentSpecialization}
        onSpecializationChange={handleSpecializationChange}
        onDownload={handleDownload}
        isDownloading={isDownloading}
        onLoadFile={handleLoadFile}
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_280px] overflow-hidden">
        {/* Editor Section */}
        <main className="min-h-0 p-3 lg:p-4 overflow-hidden relative">
          <TranslationViewer
            ref={viewerRef}
            onSummaryUpdate={handleSummaryUpdate}
            onDocumentStateChange={setDocumentState}
            documentState={documentState}
          />
          
          {/* Translation Overlay */}
          <TranslationOverlay
            progress={translationProgress}
            onCancel={handleCancelTranslation}
          />
        </main>

        {/* Summary Panel */}
        <aside className="hidden md:block border-l border-slate-200 bg-white overflow-auto">
          <div className="p-3 lg:p-4">
            <SummaryPanel
              summary={summary}
              onSectionClick={handleSectionClick}
            />
          </div>
        </aside>
      </div>

      {/* Tip Bar */}
      <TipBar />

      {/* Resume Dialog */}
      {showResumeDialog && incompleteSummary && (
        <TranslationResumeDialog
          sourceLanguage={incompleteSummary.sourceLanguage}
          targetLanguage={incompleteSummary.targetLanguage}
          progress={incompleteSummary.progress}
          lastUpdated={incompleteSummary.lastUpdated}
          onResume={handleResumeTranslation}
          onStartOver={handleStartOver}
          onDismiss={handleDismissResume}
        />
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && translationProgress && (
        <TranslationCancelDialog
          sourceLanguage={translationProgress.sourceLanguage}
          targetLanguage={translationProgress.targetLanguage}
          progress={translationProgress.percentage}
          onKeep={handleKeepTranslated}
          onRestore={handleRestoreOriginal}
        />
      )}
    </div>
  );
}

// Main export wrapped with LanguageProvider
export default function TranslationPage() {
  return (
    <LanguageProvider>
      <TranslationPageInner />
    </LanguageProvider>
  );
}
