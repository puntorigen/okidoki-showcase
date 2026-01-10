/**
 * Language Detector
 * Detects the source language of a document using AI.
 */

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

export class LanguageDetector {
  /**
   * Create a representative sample from the document text
   * Takes excerpts from beginning, middle, and end for better coverage
   */
  private createSample(text: string): string {
    const CHUNK_SIZE = 600;
    const TOTAL_THRESHOLD = 2000;

    if (text.length < TOTAL_THRESHOLD) {
      return text;
    }

    const start = text.substring(0, CHUNK_SIZE);
    const middleStart = Math.floor((text.length - CHUNK_SIZE) / 2);
    const middle = text.substring(middleStart, middleStart + CHUNK_SIZE);
    const end = text.substring(text.length - CHUNK_SIZE);

    return `${start}\n[...]\n${middle}\n[...]\n${end}`;
  }

  /**
   * Detect language using AI
   * Analyzes excerpts from multiple positions in the document
   */
  async detect(
    documentText: string,
    widget: any
  ): Promise<LanguageDetectionResult> {
    try {
      const sample = this.createSample(documentText);

      const result = await widget.ask({
        prompt: `What language is this text written in? Return the language name in English.`,
        context: `TEXT:\n${sample}`,
        output: widget.helpers ? {
          language: widget.helpers.string('The language name in English'),
          confidence: widget.helpers.number('Confidence score from 0 to 100'),
        } : undefined,
      });

      if (result.success && result.result) {
        return {
          language: result.result.language,
          confidence: (result.result.confidence ?? 90) / 100,
        };
      }
    } catch (error) {
      console.warn('[LanguageDetector] Detection failed:', error);
    }

    return {
      language: 'Unknown',
      confidence: 0,
    };
  }
}

// Singleton instance
export const languageDetector = new LanguageDetector();
