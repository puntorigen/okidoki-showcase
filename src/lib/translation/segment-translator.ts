/**
 * Segment Translator
 * Format-preserving translation of text segments.
 */

import {
  DocumentBatch,
  TranslatedBatchResult,
  TranslatedParagraph,
  TranslatedSegment,
} from './translation-types';

export class SegmentTranslator {
  private glossaryPrompt: string = '';
  private industryContext: string = '';

  /**
   * Set glossary prompt for consistent terminology
   */
  setGlossaryPrompt(prompt: string): void {
    this.glossaryPrompt = prompt;
  }

  /**
   * Set industry context for appropriate terminology
   */
  setIndustryContext(industry: string): void {
    this.industryContext = industry ? `DOCUMENT TYPE: ${industry} document\n` : '';
  }

  /**
   * Translate a batch of paragraphs while preserving formatting
   */
  async translateBatch(
    batch: DocumentBatch,
    sourceLanguage: string,
    targetLanguage: string,
    widget: any
  ): Promise<TranslatedBatchResult | null> {
    if (!widget?.ask) {
      console.error('[SegmentTranslator] Widget not available');
      return null;
    }

    try {
      // Build translation request
      const segmentsList = this.buildSegmentsList(batch);
      
      const prompt = this.buildTranslationPrompt(
        sourceLanguage,
        targetLanguage,
        batch.sectionTitle,
        batch.isPartialSection,
        batch.partNumber
      );

      const result = await widget.ask({
        prompt,
        context: `${this.industryContext}${this.glossaryPrompt}\n\nSEGMENTS TO TRANSLATE:\n${segmentsList}`,
        output: widget.helpers ? {
          translations: widget.helpers.array(
            widget.helpers.object({
              id: widget.helpers.string('Segment ID (e.g., p0_s0)'),
              text: widget.helpers.string('Translated text'),
            })
          ),
          newTerms: widget.helpers.array(
            widget.helpers.object({
              original: widget.helpers.string('Original term'),
              translated: widget.helpers.string('Translation used'),
            })
          ),
        } : undefined,
        maxTokens: batch.wordCount * 3, // Allow for expansion
      });

      if (!result.success || !result.result) {
        console.error('[SegmentTranslator] Translation failed:', result.error);
        return null;
      }

      // Parse response and rebuild paragraphs
      const translatedParagraphs = this.rebuildParagraphs(batch, result.result.translations || []);
      const glossaryAdditions = this.extractGlossaryAdditions(result.result.newTerms || []);

      return {
        batchIndex: batch.batchIndex,
        sectionId: batch.sectionId,
        sectionTitle: batch.sectionTitle,
        translatedParagraphs,
        glossaryAdditions,
      };
    } catch (error) {
      console.error('[SegmentTranslator] Translation error:', error);
      return null;
    }
  }

  /**
   * Build the segments list for the prompt
   * Format annotations in ⟨angle brackets⟩ indicate styling for context
   */
  private buildSegmentsList(batch: DocumentBatch): string {
    const lines: string[] = [];

    for (const paragraph of batch.paragraphs) {
      for (const segment of paragraph.segments) {
        const segmentId = `p${paragraph.paragraphIndex}_${segment.id}`;
        
        // Add format annotation in Unicode angle brackets if segment has marks
        const formats = segment.marks
          .map(m => m.type)
          .filter(Boolean);
        const formatAnnotation = formats.length > 0 ? ` ⟨${formats.join(', ')}⟩` : '';
        
        lines.push(`[${segmentId}] "${segment.text}"${formatAnnotation}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build the translation prompt
   */
  private buildTranslationPrompt(
    sourceLanguage: string,
    targetLanguage: string,
    sectionTitle: string,
    isPartialSection?: boolean,
    partNumber?: number
  ): string {
    const sectionContext = isPartialSection
      ? `SECTION: "${sectionTitle}" (Part ${partNumber})\n`
      : `SECTION: "${sectionTitle}"\n`;

    return `Translate text segments from ${sourceLanguage} to ${targetLanguage}.

${sectionContext}
FORMAT ANNOTATIONS:
Annotations in ⟨angle brackets⟩ like ⟨bold⟩ or ⟨italic⟩ indicate how text is styled in the source document. Use this to understand emphasis and tone, but return ONLY the translated text without any annotations.

CRITICAL RULES:
1. Return the SAME number of segments with the SAME IDs
2. Each segment must correspond to its original
3. You may adjust word order within segments to make natural translations
4. Keep proper nouns, brand names, and marked technical terms as instructed
5. Maintain consistency with the glossary terms provided
6. Return ONLY the translated text - never include ⟨format⟩ annotations in output

TRANSLATION GUIDELINES:
- Produce natural, fluent ${targetLanguage} translations
- Maintain the same level of formality as the source
- Keep punctuation appropriate for ${targetLanguage}
- Preserve any numbers, dates, and currencies

Return translations in the specified format.`;
  }

  /**
   * Rebuild translated paragraphs from API response
   */
  private rebuildParagraphs(
    batch: DocumentBatch,
    translations: Array<{ id: string; text: string }>
  ): TranslatedParagraph[] {
    // Create a map of translations by ID
    const translationMap = new Map<string, string>();
    for (const t of translations) {
      translationMap.set(t.id, t.text);
    }

    const result: TranslatedParagraph[] = [];

    for (const paragraph of batch.paragraphs) {
      const translatedSegments: TranslatedSegment[] = [];

      for (const segment of paragraph.segments) {
        const segmentId = `p${paragraph.paragraphIndex}_${segment.id}`;
        const translatedText = translationMap.get(segmentId) || segment.text;

        translatedSegments.push({
          id: segment.id,
          originalText: segment.text,
          translatedText,
          marks: segment.marks,
        });
      }

      result.push({
        paragraphIndex: paragraph.paragraphIndex,
        nodeIndex: paragraph.nodeIndex,
        segments: translatedSegments,
      });
    }

    return result;
  }

  /**
   * Extract glossary additions from the response
   */
  private extractGlossaryAdditions(
    newTerms: Array<{ original: string; translated: string }>
  ): Record<string, string> {
    const additions: Record<string, string> = {};
    for (const term of newTerms) {
      if (term.original && term.translated) {
        additions[term.original] = term.translated;
      }
    }
    return additions;
  }

  /**
   * Fallback: Simple translation without structured output
   * Used when the widget doesn't support structured output
   */
  async translateBatchSimple(
    batch: DocumentBatch,
    sourceLanguage: string,
    targetLanguage: string,
    widget: any
  ): Promise<TranslatedBatchResult | null> {
    if (!widget?.ask) {
      return null;
    }

    try {
      // Combine all text for simpler translation
      const allText = batch.paragraphs
        .map(p => p.segments.map(s => s.text).join(''))
        .join('\n\n');

      const result = await widget.ask({
        prompt: `Translate the following text from ${sourceLanguage} to ${targetLanguage}. 
${this.industryContext}
${this.glossaryPrompt}

Maintain the same paragraph structure. Return only the translated text.`,
        context: allText,
      });

      if (!result.success || !result.result) {
        return null;
      }

      // Parse the simple response - split by paragraphs
      const translatedParagraphs = result.result.split('\n\n');
      
      const paragraphs: TranslatedParagraph[] = [];

      for (let i = 0; i < batch.paragraphs.length; i++) {
        const originalPara = batch.paragraphs[i];
        const translatedText = translatedParagraphs[i] || '';

        // For simple mode, treat the whole paragraph as one segment
        paragraphs.push({
          paragraphIndex: originalPara.paragraphIndex,
          nodeIndex: originalPara.nodeIndex,
          segments: [{
            id: 's_0',
            originalText: originalPara.segments.map(s => s.text).join(''),
            translatedText: translatedText.trim(),
            marks: [], // Formatting might be lost in simple mode
          }],
        });
      }

      return {
        batchIndex: batch.batchIndex,
        sectionId: batch.sectionId,
        sectionTitle: batch.sectionTitle,
        translatedParagraphs: paragraphs,
        glossaryAdditions: {},
      };
    } catch (error) {
      console.error('[SegmentTranslator] Simple translation error:', error);
      return null;
    }
  }
}

// Factory function
export function createSegmentTranslator(): SegmentTranslator {
  return new SegmentTranslator();
}
