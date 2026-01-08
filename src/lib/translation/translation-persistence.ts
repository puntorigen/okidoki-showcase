/**
 * Translation Persistence (localStorage)
 * Saves translation state for crash recovery and resume capability.
 */

import { PersistedTranslationState, TranslatedBatchResult } from './translation-types';

const STORAGE_KEY = 'okidoki_translation_state';

export class TranslationPersistence {
  /**
   * Save translation state to localStorage
   * Called after each batch completes
   */
  save(state: PersistedTranslationState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...state,
        lastUpdated: Date.now(),
      }));
    } catch (e) {
      console.warn('[TranslationPersistence] Failed to save state:', e);
      // localStorage might be full - continue without persistence
    }
  }

  /**
   * Update just the completed batches (more efficient for frequent updates)
   */
  updateBatch(newBatch: TranslatedBatchResult): void {
    try {
      const current = this.load();
      if (!current) return;

      current.completedBatches.push(newBatch);
      current.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('[TranslationPersistence] Failed to update batch:', e);
    }
  }

  /**
   * Load incomplete translation state (if any)
   */
  load(): PersistedTranslationState | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      console.warn('[TranslationPersistence] Failed to load state:', e);
      return null;
    }
  }

  /**
   * Check if there's an incomplete translation for this document
   */
  hasIncompleteTranslation(documentId: string): boolean {
    const state = this.load();
    if (!state) return false;
    return state.documentId === documentId && 
           state.completedBatches.length < state.totalBatches;
  }

  /**
   * Check if there's any incomplete translation
   */
  hasAnyIncompleteTranslation(): boolean {
    const state = this.load();
    if (!state) return false;
    return state.completedBatches.length < state.totalBatches;
  }

  /**
   * Get summary of incomplete translation (for UI display)
   */
  getIncompleteSummary(): {
    sourceLanguage: string;
    targetLanguage: string;
    progress: number;
    startedAt: Date;
    lastUpdated: Date;
  } | null {
    const state = this.load();
    if (!state) return null;
    if (state.completedBatches.length >= state.totalBatches) return null;

    return {
      sourceLanguage: state.sourceLanguage,
      targetLanguage: state.targetLanguage,
      progress: Math.round((state.completedBatches.length / state.totalBatches) * 100),
      startedAt: new Date(state.startedAt),
      lastUpdated: new Date(state.lastUpdated),
    };
  }

  /**
   * Clear persisted state (on complete or discard)
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[TranslationPersistence] Failed to clear state:', e);
    }
  }

  /**
   * Generate a document ID from content (simple hash)
   */
  static generateDocumentId(content: string): string {
    let hash = 0;
    const len = Math.min(content.length, 10000);
    for (let i = 0; i < len; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;  // Convert to 32-bit integer
    }
    return `doc_${Math.abs(hash).toString(36)}`;
  }
}

// Singleton instance for easy access
export const translationPersistence = new TranslationPersistence();
