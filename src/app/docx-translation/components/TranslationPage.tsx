'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Header from './Header';
import TranslationViewer, { TranslationViewerRef, DocumentProperties } from './TranslationViewer';
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

interface TranslationInfo {
  sourceLanguage: string;
  targetLanguage: string;
}

// Inner component that uses the language context
function TranslationPageInner() {
  const { language, t } = useLanguage();
  // State
  const [currentSpecialization, setCurrentSpecialization] = useState<Specialization>(defaultSpecialization);
  const [documentState, setDocumentState] = useState<DocumentState>(initialDocumentState);
  const [summary, setSummary] = useState<DocumentSummary>({ wordCount: 0, pageCount: 1, sections: [] });
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

  // New state for enhanced UI
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationInfo | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [translationComplete, setTranslationComplete] = useState(false);
  const [documentProperties, setDocumentProperties] = useState<DocumentProperties | null>(null);

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
  const summaryContentHashRef = useRef<string>('');
  const summaryDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const summaryLanguageRef = useRef<string>('');

  // Set up translation progress callback
  useEffect(() => {
    console.log('[TranslationPage] Setting up progress callback');
    setTranslationProgressCallback((progress) => {
      console.log(`[TranslationPage] Progress received: ${progress.percentage}% status=${progress.status}`);
      setTranslationProgress(progress);

      // Capture detected language from progress
      if (progress?.sourceLanguage && !detectedLanguage) {
        setDetectedLanguage(progress.sourceLanguage);
      }

      // Track completion
      if (progress?.status === 'completed') {
        setTranslationComplete(true);
        setTranslationInfo({
          sourceLanguage: progress.sourceLanguage,
          targetLanguage: progress.targetLanguage,
        });
        // Reset after showing success
        setTimeout(() => setTranslationComplete(false), 5000);
      }
    });

    return () => {
      setTranslationProgressCallback(null);
    };
  }, [detectedLanguage]);

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
      console.log('[Okidoki] Tools registered:', tools.map((t: { name: string }) => t.name));
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

  // Generate executive summary when content changes
  useEffect(() => {
    if (summary.wordCount < 50) {
      setExecutiveSummary('');
      return;
    }

    // Simple hash of word count + section count for change detection
    const contentHash = `${summary.wordCount}-${summary.sections.length}`;
    
    // Check if language changed - if so, regenerate regardless of content changes
    const languageChanged = summaryLanguageRef.current && summaryLanguageRef.current !== language;
    
    // Check if content changed significantly (>5% word count change)
    const lastHash = summaryContentHashRef.current;
    if (lastHash && !languageChanged) {
      const lastWordCount = parseInt(lastHash.split('-')[0]) || 0;
      const changePercent = Math.abs(summary.wordCount - lastWordCount) / Math.max(lastWordCount, 1);
      if (changePercent < 0.05 && executiveSummary) {
        return; // Not enough change
      }
    }

    // Debounce summary generation
    // Use shorter debounce (500ms) when language changes, longer (20s) for content changes
    const debounceTime = languageChanged ? 500 : 20000;
    
    if (summaryDebounceRef.current) {
      clearTimeout(summaryDebounceRef.current);
    }

    // Show generating state immediately when language changes for better UX
    if (languageChanged) {
      setIsGeneratingSummary(true);
    }

    summaryDebounceRef.current = setTimeout(async () => {
      if (!window.OkidokiWidget?.ask) return;
      
      setIsGeneratingSummary(true);
      try {
        const viewer = viewerRef.current;
        if (!viewer) return;
        
        const content = viewer.getContent();
        if (!content) return;

        // Extract text for summary
        const extractText = (node: { text?: string; content?: unknown[] }): string => {
          if (node.text) return node.text;
          if (node.content) {
            return (node.content as { text?: string; content?: unknown[] }[])
              .map(n => extractText(n))
              .join(' ');
          }
          return '';
        };
        const text = extractText(content).substring(0, 3000);

        // Generate summary prompt in the correct UI language
        const summaryPrompt = language === 'es'
          ? 'Resume este documento en 1-2 oraciones. Incluye el tipo de documento, tema principal y propósito. Responde en español.'
          : 'Summarize this document in 1-2 sentences. Include the document type, main subject, and purpose.';
        
        const result = await window.OkidokiWidget.ask({
          prompt: summaryPrompt,
          context: text,
        }) as { success: boolean; result?: string };

        if (result?.success && result.result) {
          setExecutiveSummary(result.result);
          summaryContentHashRef.current = contentHash;
          summaryLanguageRef.current = language;
        }
      } catch (error) {
        console.error('[Summary] Failed to generate:', error);
      } finally {
        setIsGeneratingSummary(false);
      }
    }, 20000); // 20 second debounce

    return () => {
      if (summaryDebounceRef.current) {
        clearTimeout(summaryDebounceRef.current);
      }
    };
  }, [summary.wordCount, summary.sections.length, executiveSummary, language]);

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
      // Try to set author before exporting (don't block if it fails)
      try {
        await viewer.setProperties({
          author: 'Okidoki Translator',
          modified: new Date(),
        });
      } catch (propError) {
        console.warn('[Download] Could not set properties:', propError);
      }

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

  // Translation cancel handler
  const handleCancelTranslation = useCallback(() => {
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
          onComplete: async () => {
            setTranslationProgress(null);
          },
          onError: (error: string) => {
            console.error('[Resume] Error:', error);
            setTranslationProgress(null);
          },
        },
        (json: unknown) => {
          viewerRef.current?.updateContent(json);
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
    resolveCancelChoice('keep');
    setShowCancelDialog(false);
    setTranslationProgress(null);
  }, []);

  // Restore original document
  const handleRestoreOriginal = useCallback(() => {
    resolveCancelChoice('restore');
    setShowCancelDialog(false);
    setTranslationProgress(null);
    
    const orchestrator = getTranslationOrchestrator();
    const persistedState = orchestrator.checkForIncompleteTranslation();
    
    if (persistedState?.originalDocumentJson && viewerRef.current) {
      viewerRef.current.updateContent(persistedState.originalDocumentJson);
    }
    
    // Clear translation info on revert
    setTranslationInfo(null);
  }, []);

  // Handle loading a DOCX file
  const handleLoadFile = useCallback(async (file: File) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      await viewer.setSource(file);
      setDocumentState({ createdByAI: false, userHasEdited: false });
      // Reset translation state on new file
      setTranslationInfo(null);
      setDetectedLanguage(null);
      setExecutiveSummary('');
      setDocumentProperties(null);
      
      // Fetch document properties
      const props = await viewer.getProperties();
      if (props) {
        setDocumentProperties(props);
        console.log('[Load] Document properties:', props);
      }
      
      console.log('[Load] DOCX loaded:', file.name);
    } catch (error) {
      console.error('[Load] Failed to load DOCX:', error);
    }
  }, []);

  // Handle translate action from header dropdown
  const handleTranslate = useCallback(async (targetLanguage: string) => {
    const widget = window.OkidokiWidget;
    if (!widget) {
      console.warn('[Translate] Widget not available');
      return;
    }
    
    // Use invokeTool to call translate_document directly (without going through chat)
    if (widget.invokeTool) {
      try {
        const result = await widget.invokeTool('translate_document', { target_language: targetLanguage });
        console.log('[Translate] invokeTool result:', result);
      } catch (error) {
        console.error('[Translate] invokeTool error:', error);
        // Fallback to chat message if direct invocation fails
        widget.insertMessage?.(`Please translate the document to ${targetLanguage}`, { send: true });
      }
    } else {
      // Fallback for older widget versions
      widget.insertMessage?.(`Please translate the document to ${targetLanguage}`, { send: true });
    }
  }, []);

  // Handle quick actions from TipBar
  const handleQuickAction = useCallback((action: string) => {
    const widget = window.OkidokiWidget;
    if (!widget?.insertMessage) return;

    const messages: Record<string, string> = {
      contract: t('contractPrompt'),
      report: t('reportPrompt'),
      help: t('helpPrompt'),
    };

    const message = messages[action];
    if (message) {
      widget.insertMessage(message, { send: true });
    }
  }, [t]);


  // Handle refresh summary
  const handleRefreshSummary = useCallback(() => {
    summaryContentHashRef.current = ''; // Clear hash to force regeneration
    setExecutiveSummary('');
  }, []);

  // Handle update document properties
  const handleUpdateProperties = useCallback(async (props: Partial<DocumentProperties>) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      await viewer.setProperties(props);
      // Update local state
      setDocumentProperties(prev => prev ? { ...prev, ...props } : props);
      console.log('[Properties] Updated:', props);
    } catch (error) {
      console.error('[Properties] Failed to update:', error);
    }
  }, []);

  // Determine if we have content
  const hasContent = summary.wordCount > 0;
  const isTranslating = translationProgress?.status === 'translating' || translationProgress?.status === 'preparing';

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
        hasContent={hasContent}
        isTranslating={isTranslating}
        translationInfo={translationInfo}
        onTranslate={handleTranslate}
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_300px] overflow-hidden">
        {/* Editor Section */}
        <main className="min-h-0 p-3 lg:p-4 overflow-hidden relative">
          <TranslationViewer
            ref={viewerRef}
            onSummaryUpdate={handleSummaryUpdate}
            onDocumentStateChange={setDocumentState}
            documentState={documentState}
          />
        </main>

        {/* Summary Panel */}
        <aside className="hidden md:block border-l border-slate-200 bg-slate-50 overflow-auto">
          <div className="p-4">
            <SummaryPanel
              wordCount={summary.wordCount}
              pageCount={summary.pageCount}
              detectedLanguage={detectedLanguage || undefined}
              translationInfo={translationInfo}
              executiveSummary={executiveSummary}
              isGeneratingSummary={isGeneratingSummary}
              onRefreshSummary={handleRefreshSummary}
              documentProperties={documentProperties}
              onUpdateProperties={handleUpdateProperties}
            />
          </div>
        </aside>
      </div>

      {/* Tip Bar */}
      <TipBar 
        hasContent={hasContent}
        isTranslating={isTranslating}
        translationComplete={translationComplete}
        onQuickAction={handleQuickAction}
      />

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

      {/* Translation Overlay - covers full page */}
      <TranslationOverlay
        progress={translationProgress}
        onCancel={handleCancelTranslation}
      />
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
