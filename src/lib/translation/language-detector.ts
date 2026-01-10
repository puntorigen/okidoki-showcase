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
   * Detect language using AI
   * Analyzes the first portion of document text to determine language
   */
  async detect(
    documentText: string,
    widget: any
  ): Promise<LanguageDetectionResult> {
    try {
      // Sample first ~2000 chars for efficient detection
      const sample = documentText.substring(0, 2000);

      const result = await widget.ask({
        prompt: `Detect the language of this document. Return the language name in English (e.g., "Spanish", "English", "French", "German", "Portuguese", "Italian", "Chinese", "Japanese", "Korean", "Arabic", "Russian", etc.)`,
        context: `DOCUMENT TEXT SAMPLE:\n${sample}`,
        output: widget.helpers ? {
          language: widget.helpers.string('The detected language name in English'),
          confidence: widget.helpers.number('Confidence score from 0 to 100'),
        } : undefined,
      });

      if (result.success && result.result) {
        return {
          language: result.result.language,
          confidence: (result.result.confidence ?? 90) / 100, // Normalize to 0-1
        };
      }
    } catch (error) {
      console.warn('[LanguageDetector] Detection failed:', error);
    }

    // Fallback - return unknown
    return {
      language: 'Unknown',
      confidence: 0,
    };
  }
}

// Singleton instance
export const languageDetector = new LanguageDetector();
