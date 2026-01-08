/**
 * Translation Library
 * Shared modules for document translation across multiple apps.
 */

// Types
export * from './translation-types';

// Core modules
export { industryDetector, INDUSTRY_TERMINOLOGY } from './industry-detector';
export { ragTerminology, RagTerminologyLookup } from './rag-terminology';
export { terminologyCache, TerminologyCache } from './terminology-cache';
export { createGlossaryManager, GlossaryManager } from './glossary-manager';
export { batchingEngine, BatchingEngine } from './batching-engine';
export { createSegmentTranslator, SegmentTranslator } from './segment-translator';
export { createDocumentAccumulator, DocumentAccumulator } from './document-accumulator';
export { translationPersistence, TranslationPersistence } from './translation-persistence';
export { createTranslationOrchestrator, TranslationOrchestrator } from './translation-orchestrator';
