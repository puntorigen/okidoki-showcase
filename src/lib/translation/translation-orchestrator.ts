/**
 * Translation Orchestrator
 * Coordinates the entire translation flow including:
 * - Industry detection
 * - RAG terminology lookup
 * - Glossary management
 * - Batch translation
 * - Progress updates
 * - Crash recovery
 */

import {
  TranslationState,
  TranslationProgress,
  TranslationOptions,
  TranslationCallbacks,
  PersistedTranslationState,
  DocumentBatch,
  initialTranslationState,
} from './translation-types';
import { industryDetector } from './industry-detector';
import { ragTerminology } from './rag-terminology';
import { createGlossaryManager, GlossaryManager } from './glossary-manager';
import { batchingEngine } from './batching-engine';
import { createSegmentTranslator, SegmentTranslator } from './segment-translator';
import { createDocumentAccumulator, DocumentAccumulator } from './document-accumulator';
import { translationPersistence, TranslationPersistence } from './translation-persistence';

export class TranslationOrchestrator {
  private state: TranslationState = { ...initialTranslationState };
  private glossaryManager: GlossaryManager;
  private segmentTranslator: SegmentTranslator;
  private documentAccumulator: DocumentAccumulator;
  private batches: DocumentBatch[] = [];
  private originalDocumentJson: any = null;
  private documentId: string = '';
  private widget: any = null;
  private callbacks: TranslationCallbacks | null = null;
  private isCancelled: boolean = false;

  constructor() {
    this.glossaryManager = createGlossaryManager();
    this.segmentTranslator = createSegmentTranslator();
    this.documentAccumulator = createDocumentAccumulator();
  }

  /**
   * Check if there's an incomplete translation to resume
   */
  checkForIncompleteTranslation(): PersistedTranslationState | null {
    return translationPersistence.load();
  }

  /**
   * Get summary of incomplete translation for UI display
   */
  getIncompleteSummary() {
    return translationPersistence.getIncompleteSummary();
  }

  /**
   * Discard incomplete translation and start fresh
   */
  discardIncomplete(): void {
    translationPersistence.clear();
    this.reset();
  }

  /**
   * Resume an incomplete translation
   */
  async resume(
    persistedState: PersistedTranslationState,
    widget: any,
    callbacks: TranslationCallbacks,
    onDocumentUpdate: (json: any) => void
  ): Promise<void> {
    this.widget = widget;
    this.callbacks = callbacks;
    this.isCancelled = false;

    // Restore state
    this.state = {
      ...initialTranslationState,
      status: 'translating',
      sourceLanguage: persistedState.sourceLanguage,
      targetLanguage: persistedState.targetLanguage,
      industry: persistedState.industry,
      totalBatches: persistedState.totalBatches,
      completedBatches: persistedState.completedBatches.length,
      currentBatchIndex: persistedState.completedBatches.length,
      glossary: persistedState.glossary,
      ragTermsFound: persistedState.ragTermsFound,
      accumulatedTranslations: persistedState.completedBatches,
      completedBatchIndices: persistedState.completedBatches.map(b => b.batchIndex),
    };

    this.originalDocumentJson = persistedState.originalDocumentJson;
    this.documentId = persistedState.documentId;

    // Restore glossary
    this.glossaryManager.restoreGlossary(persistedState.glossary);
    if (persistedState.industry) {
      this.glossaryManager.setContext(
        persistedState.industry as any,
        persistedState.targetLanguage
      );
    }

    // Recreate batches
    this.batches = batchingEngine.createBatches(this.originalDocumentJson);

    // Initialize accumulator with completed batches
    this.documentAccumulator.initialize(
      this.originalDocumentJson,
      this.batches.length,
      onDocumentUpdate
    );
    this.documentAccumulator.restoreBatches(persistedState.completedBatches);

    // Setup segment translator
    this.segmentTranslator.setGlossaryPrompt(this.glossaryManager.buildGlossaryPrompt());
    if (persistedState.industry) {
      this.segmentTranslator.setIndustryContext(persistedState.industry);
    }

    // Report progress
    this.reportProgress();

    // Continue translation from where we left off
    await this.translateRemainingBatches();
  }

  /**
   * Start a new translation
   */
  async translate(
    documentJson: any,
    options: TranslationOptions,
    widget: any,
    callbacks: TranslationCallbacks,
    onDocumentUpdate: (json: any) => void
  ): Promise<void> {
    this.reset();
    this.widget = widget;
    this.callbacks = callbacks;
    this.isCancelled = false;
    this.originalDocumentJson = documentJson;

    // Generate document ID for persistence
    const textContent = this.extractTextContent(documentJson);
    this.documentId = TranslationPersistence.generateDocumentId(textContent);

    // Initialize state
    this.state = {
      ...initialTranslationState,
      status: 'preparing',
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
    };

    this.reportProgress();

    try {
      // Phase 1: Detect industry
      if (!options.skipIndustryDetection) {
        console.log('[Orchestrator] Detecting document industry...');
        const industryResult = await industryDetector.detectWithAI(textContent, widget);
        this.state.industry = industryResult.industry;
        console.log(`[Orchestrator] Detected industry: ${industryResult.industry} (${Math.round(industryResult.confidence * 100)}%)`);
      }

      // Phase 2: RAG terminology lookup
      if (options.useRag !== false && this.state.industry) {
        console.log('[Orchestrator] Looking up RAG terminology...');
        const ragResult = await ragTerminology.lookup(
          this.state.industry as any,
          options.sourceLanguage,
          options.targetLanguage,
          widget
        );
        
        if (ragResult.terms.length > 0) {
          this.glossaryManager.mergeRagTerms(ragResult.terms);
          this.state.ragTermsFound = true;
          console.log(`[Orchestrator] Found ${ragResult.terms.length} RAG terms`);
        }
      }

      // Phase 3: Extract glossary terms
      console.log('[Orchestrator] Extracting glossary terms...');
      this.glossaryManager.setContext(
        (this.state.industry as any) || 'general',
        options.targetLanguage
      );
      await this.glossaryManager.extractTerms(textContent, options.sourceLanguage, widget);

      // Phase 4: Create batches
      console.log('[Orchestrator] Creating translation batches...');
      this.batches = batchingEngine.createBatches(documentJson);
      this.state.totalBatches = this.batches.length;

      // Initialize accumulator
      this.documentAccumulator.initialize(
        documentJson,
        this.batches.length,
        onDocumentUpdate
      );

      // Setup segment translator
      this.segmentTranslator.setGlossaryPrompt(this.glossaryManager.buildGlossaryPrompt());
      this.segmentTranslator.setIndustryContext(this.state.industry || '');

      // Save initial state
      this.persistState();

      // Phase 5: Translate batches
      this.state.status = 'translating';
      this.reportProgress();

      await this.translateRemainingBatches();

    } catch (error) {
      console.error('[Orchestrator] Translation failed:', error);
      this.state.status = 'error';
      this.state.error = String(error);
      callbacks.onError(String(error));
    }
  }

  /**
   * Cancel the translation
   */
  async cancel(): Promise<void> {
    this.isCancelled = true;
    this.state.status = 'paused';

    if (this.callbacks?.onCancelRequest) {
      const choice = await this.callbacks.onCancelRequest();
      
      if (choice === 'restore') {
        // Restore original document
        translationPersistence.clear();
        this.reset();
      } else {
        // Keep translated content - document is already showing partial translation
        translationPersistence.clear();
      }
    }
  }

  /**
   * Get current translation state
   */
  getState(): TranslationState {
    return { ...this.state };
  }

  /**
   * Get current progress
   */
  getProgress(): TranslationProgress {
    const currentBatch = this.batches[this.state.currentBatchIndex];
    const completedBatches = this.state.completedBatches;
    const totalBatches = this.state.totalBatches;
    const percentage = totalBatches > 0
      ? Math.round((completedBatches / totalBatches) * 100)
      : 0;

    // Estimate remaining time (rough: ~4s per batch)
    const remainingBatches = totalBatches - completedBatches;
    const estimatedTimeRemaining = remainingBatches * 4;

    return {
      status: this.state.status,
      percentage,
      currentSection: currentBatch?.sectionTitle || '',
      completedBatches,
      totalBatches,
      estimatedTimeRemaining,
      sourceLanguage: this.state.sourceLanguage,
      targetLanguage: this.state.targetLanguage,
    };
  }

  /**
   * Translate remaining batches
   */
  private async translateRemainingBatches(): Promise<void> {
    for (let i = this.state.currentBatchIndex; i < this.batches.length; i++) {
      if (this.isCancelled) {
        console.log('[Orchestrator] Translation cancelled');
        return;
      }

      const batch = this.batches[i];
      this.state.currentBatchIndex = i;
      this.reportProgress();

      console.log(`[Orchestrator] Translating batch ${i + 1}/${this.batches.length}: ${batch.sectionTitle}`);

      const result = await this.segmentTranslator.translateBatch(
        batch,
        this.state.sourceLanguage,
        this.state.targetLanguage,
        this.widget
      );

      if (!result) {
        // Translation failed
        this.state.status = 'error';
        this.state.error = `Failed to translate batch ${i + 1}`;
        this.state.failedBatchIndex = i;
        this.callbacks?.onError(this.state.error, i);
        return;
      }

      // Add to accumulator (will update document at milestones)
      this.documentAccumulator.addBatch(result);
      this.state.accumulatedTranslations.push(result);
      this.state.completedBatchIndices.push(i);
      this.state.completedBatches = this.state.completedBatchIndices.length;

      // Update glossary with any new terms
      this.glossaryManager.updateFromBatch(result.glossaryAdditions);
      this.state.glossary = this.glossaryManager.getGlossary();

      // Persist state after each batch
      this.persistState();

      // Update the glossary prompt for subsequent batches
      this.segmentTranslator.setGlossaryPrompt(this.glossaryManager.buildGlossaryPrompt());
    }

    // Translation complete
    this.state.status = 'completed';
    this.state.completedBatches = this.batches.length;

    // Force final document update
    this.documentAccumulator.forceUpdate();

    // Clear persistence
    translationPersistence.clear();

    // Report completion
    this.callbacks?.onComplete(this.documentAccumulator.rebuildDocument());
    this.reportProgress();

    console.log('[Orchestrator] Translation complete!');
  }

  /**
   * Persist current state to localStorage
   */
  private persistState(): void {
    const persistedState: PersistedTranslationState = {
      documentId: this.documentId,
      sourceLanguage: this.state.sourceLanguage,
      targetLanguage: this.state.targetLanguage,
      industry: this.state.industry,
      ragTermsFound: this.state.ragTermsFound,
      startedAt: Date.now(),
      lastUpdated: Date.now(),
      totalBatches: this.state.totalBatches,
      completedBatches: this.state.accumulatedTranslations,
      glossary: this.state.glossary,
      originalDocumentJson: this.originalDocumentJson,
    };

    translationPersistence.save(persistedState);
  }

  /**
   * Report progress to callback
   */
  private reportProgress(): void {
    this.callbacks?.onProgress(this.getProgress());
  }

  /**
   * Reset orchestrator state
   */
  private reset(): void {
    this.state = { ...initialTranslationState };
    this.glossaryManager.clear();
    this.documentAccumulator.clear();
    this.batches = [];
    this.originalDocumentJson = null;
    this.documentId = '';
    this.isCancelled = false;
  }

  /**
   * Extract text content from ProseMirror JSON
   */
  private extractTextContent(json: any): string {
    if (!json) return '';
    if (json.text) return json.text;
    if (json.content) {
      return json.content.map((node: any) => this.extractTextContent(node)).join(' ');
    }
    return '';
  }
}

// Factory function
export function createTranslationOrchestrator(): TranslationOrchestrator {
  return new TranslationOrchestrator();
}
