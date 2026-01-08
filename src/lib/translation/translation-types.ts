/**
 * Translation Types & State Management
 * Shared types for the document translation system.
 */

// =============================================================================
// CORE TRANSLATION STATE
// =============================================================================

export interface TranslationState {
  status: 'idle' | 'preparing' | 'translating' | 'paused' | 'completed' | 'error';
  sourceLanguage: string;
  targetLanguage: string;
  
  // Industry detection
  industry?: string;
  
  // Progress tracking
  totalBatches: number;
  completedBatches: number;
  currentBatchIndex: number;
  
  // Glossary for term consistency
  glossary: Record<string, string>;
  
  // RAG terms found from company knowledge base
  ragTermsFound: boolean;
  
  // Accumulated translated content
  accumulatedTranslations: TranslatedBatchResult[];
  
  // For resume capability
  completedBatchIndices: number[];
  
  // Error info
  error?: string;
  failedBatchIndex?: number;
}

// =============================================================================
// BATCH TRANSLATION
// =============================================================================

export interface DocumentBatch {
  batchIndex: number;
  sectionId: string;
  sectionTitle: string;
  paragraphs: ParagraphData[];
  wordCount: number;
  isPartialSection?: boolean;
  partNumber?: number;
  totalParts?: number;
}

export interface ParagraphData {
  paragraphIndex: number;
  nodeIndex: number;  // Index in the document's content array
  segments: TextSegment[];
  originalNode: any;  // ProseMirror node reference
}

export interface TextSegment {
  id: string;
  text: string;
  marks: MarkInfo[];
}

export interface MarkInfo {
  type: string;
  attrs?: Record<string, any>;
}

export interface TranslatedBatchResult {
  batchIndex: number;
  sectionId: string;
  sectionTitle: string;
  translatedParagraphs: TranslatedParagraph[];
  glossaryAdditions: Record<string, string>;
}

export interface TranslatedParagraph {
  paragraphIndex: number;
  nodeIndex: number;
  segments: TranslatedSegment[];
}

export interface TranslatedSegment {
  id: string;
  originalText: string;
  translatedText: string;
  marks: MarkInfo[];
}

// =============================================================================
// PROGRESS TRACKING
// =============================================================================

export interface TranslationProgress {
  status: TranslationState['status'];
  percentage: number;
  currentSection: string;
  completedBatches: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;  // seconds
  sourceLanguage: string;
  targetLanguage: string;
}

// =============================================================================
// PERSISTENCE (localStorage)
// =============================================================================

export interface PersistedTranslationState {
  documentId: string;  // Hash of original document for identification
  sourceLanguage: string;
  targetLanguage: string;
  industry?: string;
  ragTermsFound: boolean;
  startedAt: number;
  lastUpdated: number;
  totalBatches: number;
  completedBatches: TranslatedBatchResult[];
  glossary: Record<string, string>;
  originalDocumentJson: any;  // For restore option on cancel
}

// =============================================================================
// GLOSSARY
// =============================================================================

export interface GlossaryTerm {
  original: string;
  translated: string | null;  // null = not yet translated
  type: 'proper_noun' | 'technical_term' | 'company_name' | 'product_name' | 'rag_term' | 'other';
  source: 'extracted' | 'rag' | 'user';
  occurrences: number;
}

// =============================================================================
// INDUSTRY DETECTION
// =============================================================================

export type IndustryType = 
  | 'legal'
  | 'medical'
  | 'technical'
  | 'financial'
  | 'marketing'
  | 'academic'
  | 'general';

export interface IndustryDetectionResult {
  industry: IndustryType;
  confidence: number;
  keywords: string[];
}

// =============================================================================
// RAG TERMINOLOGY
// =============================================================================

export interface RagTerminologyResult {
  terms: RagTerm[];
  sourceCount: number;
  fromCache: boolean;
}

export interface RagTerm {
  original: string;
  translation: string;
  context?: string;
  source: string;  // Which RAG document it came from
}

export interface CachedTerminology {
  terms: RagTerm[];
  cachedAt: number;
  expiresAt: number;
  industry: string;
  sourceLanguage: string;
  targetLanguage: string;
}

// =============================================================================
// CALLBACKS
// =============================================================================

export interface TranslationCallbacks {
  onProgress: (progress: TranslationProgress) => void;
  onComplete: (documentJson: any) => void;
  onError: (error: string, batchIndex?: number) => void;
  onCancelRequest?: () => Promise<'keep' | 'restore'>;
}

// =============================================================================
// ORCHESTRATOR OPTIONS
// =============================================================================

export interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  useRag?: boolean;
  skipIndustryDetection?: boolean;
  resumeFrom?: PersistedTranslationState;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialTranslationState: TranslationState = {
  status: 'idle',
  sourceLanguage: '',
  targetLanguage: '',
  industry: undefined,
  totalBatches: 0,
  completedBatches: 0,
  currentBatchIndex: 0,
  glossary: {},
  ragTermsFound: false,
  accumulatedTranslations: [],
  completedBatchIndices: [],
  error: undefined,
  failedBatchIndex: undefined,
};

// =============================================================================
// MILESTONE CONFIGURATION
// =============================================================================

// Percentages at which to update the visible document
export const UPDATE_MILESTONES = [10, 25, 40, 55, 70, 85, 100];
