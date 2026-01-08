/**
 * Batching Engine
 * Section-aware chunking of documents for LLM translation.
 */

import { DocumentBatch, ParagraphData, TextSegment, MarkInfo } from './translation-types';

// Configuration
const MIN_WORDS_PER_BATCH = 300;
const TARGET_WORDS_PER_BATCH = 800;
const MAX_WORDS_PER_BATCH = 1500;

interface Section {
  id: string;
  title: string;
  level: number;
  startIndex: number;
  endIndex: number;
  wordCount: number;
  paragraphs: ParagraphData[];
}

export class BatchingEngine {
  /**
   * Create translation batches from ProseMirror JSON document
   * Uses section-aware batching to keep related content together
   */
  createBatches(documentJson: any): DocumentBatch[] {
    if (!documentJson?.content) {
      return [];
    }

    // Extract sections from document
    const sections = this.extractSections(documentJson);
    
    // Create batches from sections
    const batches: DocumentBatch[] = [];
    let batchIndex = 0;

    for (const section of sections) {
      if (section.wordCount <= MAX_WORDS_PER_BATCH) {
        // Section fits in one batch
        batches.push({
          batchIndex: batchIndex++,
          sectionId: section.id,
          sectionTitle: section.title,
          paragraphs: section.paragraphs,
          wordCount: section.wordCount,
        });
      } else {
        // Section too large - split at natural boundaries
        const splitBatches = this.splitLargeSection(section, batchIndex);
        for (const batch of splitBatches) {
          batches.push(batch);
          batchIndex++;
        }
      }
    }

    console.log(`[BatchingEngine] Created ${batches.length} batches from ${sections.length} sections`);
    return batches;
  }

  /**
   * Extract sections from document
   */
  private extractSections(documentJson: any): Section[] {
    const sections: Section[] = [];
    const content = documentJson.content || [];
    
    let currentSection: Section | null = null;
    let sectionCounter = 0;

    for (let nodeIndex = 0; nodeIndex < content.length; nodeIndex++) {
      const node = content[nodeIndex];
      
      // Check if this is a heading (section start)
      if (node.type === 'heading') {
        // Save previous section
        if (currentSection && currentSection.paragraphs.length > 0) {
          currentSection.endIndex = nodeIndex - 1;
          sections.push(currentSection);
        }

        // Start new section
        const title = this.extractTextFromNode(node);
        currentSection = {
          id: `section_${sectionCounter++}`,
          title: title || `Section ${sectionCounter}`,
          level: node.attrs?.level || 1,
          startIndex: nodeIndex,
          endIndex: nodeIndex,
          wordCount: 0,
          paragraphs: [],
        };
      }

      // Add paragraph to current section (or create default section)
      if (!currentSection) {
        currentSection = {
          id: `section_${sectionCounter++}`,
          title: 'Document Start',
          level: 1,
          startIndex: 0,
          endIndex: 0,
          wordCount: 0,
          paragraphs: [],
        };
      }

      // Process translatable nodes (paragraphs, list items, table cells)
      if (this.isTranslatableNode(node)) {
        const paragraphData = this.extractParagraphData(node, nodeIndex, currentSection.paragraphs.length);
        if (paragraphData.segments.length > 0) {
          currentSection.paragraphs.push(paragraphData);
          currentSection.wordCount += this.countWords(paragraphData);
        }
      }

      // Handle lists
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        const listParagraphs = this.extractListItems(node, nodeIndex, currentSection.paragraphs.length);
        for (const para of listParagraphs) {
          currentSection.paragraphs.push(para);
          currentSection.wordCount += this.countWords(para);
        }
      }

      // Handle tables
      if (node.type === 'table') {
        const tableParagraphs = this.extractTableCells(node, nodeIndex, currentSection.paragraphs.length);
        for (const para of tableParagraphs) {
          currentSection.paragraphs.push(para);
          currentSection.wordCount += this.countWords(para);
        }
      }
    }

    // Add last section
    if (currentSection && currentSection.paragraphs.length > 0) {
      currentSection.endIndex = content.length - 1;
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Split a large section into multiple batches
   */
  private splitLargeSection(section: Section, startBatchIndex: number): DocumentBatch[] {
    const batches: DocumentBatch[] = [];
    let currentBatch: ParagraphData[] = [];
    let currentWordCount = 0;
    let partNumber = 1;

    for (const paragraph of section.paragraphs) {
      const paragraphWords = this.countWords(paragraph);
      
      // Check if adding this paragraph would exceed the limit
      if (currentWordCount + paragraphWords > TARGET_WORDS_PER_BATCH && currentBatch.length > 0) {
        // Save current batch
        batches.push({
          batchIndex: startBatchIndex + batches.length,
          sectionId: section.id,
          sectionTitle: section.title,
          paragraphs: currentBatch,
          wordCount: currentWordCount,
          isPartialSection: true,
          partNumber: partNumber++,
        });
        
        currentBatch = [];
        currentWordCount = 0;
      }

      currentBatch.push(paragraph);
      currentWordCount += paragraphWords;
    }

    // Add remaining paragraphs
    if (currentBatch.length > 0) {
      batches.push({
        batchIndex: startBatchIndex + batches.length,
        sectionId: section.id,
        sectionTitle: section.title,
        paragraphs: currentBatch,
        wordCount: currentWordCount,
        isPartialSection: batches.length > 0,
        partNumber: batches.length > 0 ? partNumber : undefined,
        totalParts: batches.length > 0 ? partNumber : undefined,
      });
    }

    // Update total parts count
    if (batches.length > 1) {
      for (const batch of batches) {
        batch.totalParts = batches.length;
      }
    }

    return batches;
  }

  /**
   * Extract paragraph data from a node
   */
  private extractParagraphData(
    node: any,
    nodeIndex: number,
    paragraphIndex: number
  ): ParagraphData {
    const segments = this.extractSegments(node.content || []);
    
    return {
      paragraphIndex,
      nodeIndex,
      segments,
      originalNode: node,
    };
  }

  /**
   * Extract text segments with formatting marks
   */
  private extractSegments(content: any[]): TextSegment[] {
    const segments: TextSegment[] = [];
    let segmentIndex = 0;

    for (const child of content) {
      if (child.type === 'text' && child.text) {
        segments.push({
          id: `s_${segmentIndex++}`,
          text: child.text,
          marks: (child.marks || []).map((m: any) => ({
            type: m.type,
            attrs: m.attrs,
          })),
        });
      }
    }

    return segments;
  }

  /**
   * Extract list items as paragraphs
   */
  private extractListItems(
    listNode: any,
    nodeIndex: number,
    startParagraphIndex: number
  ): ParagraphData[] {
    const paragraphs: ParagraphData[] = [];
    let paragraphIndex = startParagraphIndex;

    const traverse = (node: any) => {
      if (node.type === 'listItem') {
        // Get text content from list item
        const segments: TextSegment[] = [];
        let segmentIndex = 0;

        const extractText = (n: any) => {
          if (n.type === 'text' && n.text) {
            segments.push({
              id: `s_${segmentIndex++}`,
              text: n.text,
              marks: (n.marks || []).map((m: any) => ({
                type: m.type,
                attrs: m.attrs,
              })),
            });
          }
          if (n.content) {
            n.content.forEach(extractText);
          }
        };

        if (node.content) {
          node.content.forEach(extractText);
        }

        if (segments.length > 0) {
          paragraphs.push({
            paragraphIndex: paragraphIndex++,
            nodeIndex,
            segments,
            originalNode: node,
          });
        }
      }

      if (node.content) {
        node.content.forEach(traverse);
      }
    };

    traverse(listNode);
    return paragraphs;
  }

  /**
   * Extract table cells as paragraphs
   */
  private extractTableCells(
    tableNode: any,
    nodeIndex: number,
    startParagraphIndex: number
  ): ParagraphData[] {
    const paragraphs: ParagraphData[] = [];
    let paragraphIndex = startParagraphIndex;

    const traverse = (node: any) => {
      if (node.type === 'tableCell' || node.type === 'tableHeader') {
        const segments: TextSegment[] = [];
        let segmentIndex = 0;

        const extractText = (n: any) => {
          if (n.type === 'text' && n.text) {
            segments.push({
              id: `s_${segmentIndex++}`,
              text: n.text,
              marks: (n.marks || []).map((m: any) => ({
                type: m.type,
                attrs: m.attrs,
              })),
            });
          }
          if (n.content) {
            n.content.forEach(extractText);
          }
        };

        if (node.content) {
          node.content.forEach(extractText);
        }

        if (segments.length > 0) {
          paragraphs.push({
            paragraphIndex: paragraphIndex++,
            nodeIndex,
            segments,
            originalNode: node,
          });
        }
      }

      if (node.content) {
        node.content.forEach(traverse);
      }
    };

    traverse(tableNode);
    return paragraphs;
  }

  /**
   * Check if a node type is translatable
   */
  private isTranslatableNode(node: any): boolean {
    return node.type === 'paragraph' || node.type === 'heading';
  }

  /**
   * Extract text content from a node
   */
  private extractTextFromNode(node: any): string {
    if (!node) return '';
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map((child: any) => this.extractTextFromNode(child)).join('');
    }
    return '';
  }

  /**
   * Count words in a paragraph
   */
  private countWords(paragraph: ParagraphData): number {
    const text = paragraph.segments.map(s => s.text).join('');
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Get total word count from batches
   */
  getTotalWordCount(batches: DocumentBatch[]): number {
    return batches.reduce((sum, batch) => sum + batch.wordCount, 0);
  }

  /**
   * Estimate translation time (rough estimate)
   */
  estimateTranslationTime(batches: DocumentBatch[]): number {
    // Roughly 3-5 seconds per batch (API call + processing)
    return batches.length * 4;
  }
}

// Singleton instance
export const batchingEngine = new BatchingEngine();
