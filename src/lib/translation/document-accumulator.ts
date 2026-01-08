/**
 * Document Accumulator
 * Collects translated batches and rebuilds the document JSON.
 * Updates visible document at milestone percentages.
 */

import {
  TranslatedBatchResult,
  TranslatedParagraph,
  UPDATE_MILESTONES,
} from './translation-types';

export class DocumentAccumulator {
  private originalDocument: any = null;
  private translatedBatches: Map<number, TranslatedBatchResult> = new Map();
  private totalBatches: number = 0;
  private lastMilestoneIndex: number = -1;
  private onUpdate: ((documentJson: any) => void) | null = null;

  /**
   * Initialize with the original document
   */
  initialize(
    documentJson: any,
    totalBatches: number,
    onUpdate: (documentJson: any) => void
  ): void {
    this.originalDocument = this.deepClone(documentJson);
    this.totalBatches = totalBatches;
    this.translatedBatches.clear();
    this.lastMilestoneIndex = -1;
    this.onUpdate = onUpdate;
  }

  /**
   * Add a translated batch and check if we should update the visible document
   */
  addBatch(batch: TranslatedBatchResult): void {
    this.translatedBatches.set(batch.batchIndex, batch);
    
    // Check if we've reached a milestone
    const progress = (this.translatedBatches.size / this.totalBatches) * 100;
    const milestoneIndex = this.getMilestoneIndex(progress);
    
    if (milestoneIndex > this.lastMilestoneIndex) {
      this.lastMilestoneIndex = milestoneIndex;
      this.updateVisibleDocument();
    }
  }

  /**
   * Force update the visible document (e.g., on completion)
   */
  forceUpdate(): void {
    this.updateVisibleDocument();
  }

  /**
   * Get the current milestone index based on progress
   */
  private getMilestoneIndex(progress: number): number {
    for (let i = UPDATE_MILESTONES.length - 1; i >= 0; i--) {
      if (progress >= UPDATE_MILESTONES[i]) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Rebuild the document with translated content and update the viewer
   */
  private updateVisibleDocument(): void {
    if (!this.originalDocument || !this.onUpdate) return;

    try {
      const rebuiltDocument = this.rebuildDocument();
      this.onUpdate(rebuiltDocument);
      console.log(`[DocumentAccumulator] Updated document at ${this.translatedBatches.size}/${this.totalBatches} batches`);
    } catch (error) {
      console.error('[DocumentAccumulator] Failed to update document:', error);
    }
  }

  /**
   * Rebuild the full document JSON with translated content
   */
  rebuildDocument(): any {
    if (!this.originalDocument) {
      throw new Error('No original document initialized');
    }

    // Deep clone the original document
    const document = this.deepClone(this.originalDocument);
    
    // Create a map of translations by nodeIndex
    const translationsByNode = new Map<number, TranslatedParagraph[]>();
    
    for (const batch of this.translatedBatches.values()) {
      for (const paragraph of batch.translatedParagraphs) {
        if (!translationsByNode.has(paragraph.nodeIndex)) {
          translationsByNode.set(paragraph.nodeIndex, []);
        }
        translationsByNode.get(paragraph.nodeIndex)!.push(paragraph);
      }
    }

    // Apply translations to the document
    this.applyTranslations(document, translationsByNode);

    return document;
  }

  /**
   * Apply translations to document nodes
   */
  private applyTranslations(
    document: any,
    translationsByNode: Map<number, TranslatedParagraph[]>
  ): void {
    if (!document.content) return;

    for (let nodeIndex = 0; nodeIndex < document.content.length; nodeIndex++) {
      const node = document.content[nodeIndex];
      const translations = translationsByNode.get(nodeIndex);
      
      // Handle nested structures with specialized methods first
      // (they have their own content structure that shouldn't be replaced)
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        this.applyListTranslations(node, translationsByNode, nodeIndex);
      } else if (node.type === 'table') {
        this.applyTableTranslations(node, translationsByNode, nodeIndex);
      } else if (translations && translations.length > 0) {
        // Regular nodes (paragraphs, headings) - apply direct translation
        this.applyNodeTranslation(node, translations[0]);
      }
    }
  }

  /**
   * Apply translation to a single node
   */
  private applyNodeTranslation(node: any, translation: TranslatedParagraph): void {
    if (!node.content || !translation.segments.length) return;

    // Rebuild the content array with translated text
    const newContent: any[] = [];

    for (const segment of translation.segments) {
      const textNode: any = {
        type: 'text',
        text: segment.translatedText,
      };

      // Apply marks (formatting)
      if (segment.marks && segment.marks.length > 0) {
        textNode.marks = segment.marks.map(m => ({
          type: m.type,
          ...(m.attrs ? { attrs: m.attrs } : {}),
        }));
      }

      newContent.push(textNode);
    }

    if (newContent.length > 0) {
      node.content = newContent;
    }
  }

  /**
   * Apply translations to list items
   */
  private applyListTranslations(
    listNode: any,
    translationsByNode: Map<number, TranslatedParagraph[]>,
    nodeIndex: number
  ): void {
    const translations = translationsByNode.get(nodeIndex);
    if (!translations) return;

    let translationIndex = 0;

    const traverseList = (node: any) => {
      if (node.type === 'listItem' && node.content) {
        for (const child of node.content) {
          if (child.type === 'paragraph' && translationIndex < translations.length) {
            this.applyNodeTranslation(child, translations[translationIndex]);
            translationIndex++;
          }
        }
      }

      if (node.content) {
        for (const child of node.content) {
          traverseList(child);
        }
      }
    };

    traverseList(listNode);
  }

  /**
   * Apply translations to table cells
   */
  private applyTableTranslations(
    tableNode: any,
    translationsByNode: Map<number, TranslatedParagraph[]>,
    nodeIndex: number
  ): void {
    const translations = translationsByNode.get(nodeIndex);
    if (!translations) return;

    let translationIndex = 0;

    const traverseTable = (node: any) => {
      if ((node.type === 'tableCell' || node.type === 'tableHeader') && node.content) {
        for (const child of node.content) {
          if (child.type === 'paragraph' && translationIndex < translations.length) {
            this.applyNodeTranslation(child, translations[translationIndex]);
            translationIndex++;
          }
        }
      }

      if (node.content) {
        for (const child of node.content) {
          traverseTable(child);
        }
      }
    };

    traverseTable(tableNode);
  }

  /**
   * Get the accumulated translations (for persistence)
   */
  getAccumulatedBatches(): TranslatedBatchResult[] {
    return Array.from(this.translatedBatches.values())
      .sort((a, b) => a.batchIndex - b.batchIndex);
  }

  /**
   * Restore accumulated batches (for resume)
   */
  restoreBatches(batches: TranslatedBatchResult[]): void {
    for (const batch of batches) {
      this.translatedBatches.set(batch.batchIndex, batch);
    }
  }

  /**
   * Get completion percentage
   */
  getProgress(): number {
    return this.totalBatches > 0
      ? Math.round((this.translatedBatches.size / this.totalBatches) * 100)
      : 0;
  }

  /**
   * Clear accumulated state
   */
  clear(): void {
    this.originalDocument = null;
    this.translatedBatches.clear();
    this.totalBatches = 0;
    this.lastMilestoneIndex = -1;
    this.onUpdate = null;
  }

  /**
   * Deep clone helper
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

// Factory function
export function createDocumentAccumulator(): DocumentAccumulator {
  return new DocumentAccumulator();
}
