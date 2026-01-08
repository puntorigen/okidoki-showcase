/**
 * Glossary Manager
 * Manages term extraction, consistency, and glossary building for translations.
 */

import { GlossaryTerm, RagTerm, IndustryType } from './translation-types';
import { INDUSTRY_TERMINOLOGY } from './industry-detector';

export class GlossaryManager {
  private glossary: Map<string, GlossaryTerm> = new Map();
  private industry: IndustryType = 'general';
  private targetLanguage: string = 'en';

  /**
   * Set the industry and target language for terminology
   */
  setContext(industry: IndustryType, targetLanguage: string): void {
    this.industry = industry;
    this.targetLanguage = targetLanguage;
    
    // Pre-populate with industry-specific terminology
    const terminology = INDUSTRY_TERMINOLOGY[industry] || {};
    const langCode = targetLanguage.substring(0, 2).toLowerCase();
    
    for (const [term, translations] of Object.entries(terminology)) {
      if (translations[langCode]) {
        this.glossary.set(term.toLowerCase(), {
          original: term,
          translated: translations[langCode],
          type: 'technical_term',
          source: 'extracted',
          occurrences: 0,
        });
      }
    }
  }

  /**
   * Merge RAG terms into the glossary
   * RAG terms take priority over extracted terms
   */
  mergeRagTerms(ragTerms: RagTerm[]): void {
    for (const term of ragTerms) {
      const key = term.original.toLowerCase();
      this.glossary.set(key, {
        original: term.original,
        translated: term.translation,
        type: 'rag_term',
        source: 'rag',
        occurrences: 0,
      });
    }
  }

  /**
   * Extract potential glossary terms from document text
   * Uses AI to identify names, technical terms, etc.
   */
  async extractTerms(
    documentText: string,
    sourceLanguage: string,
    widget: any
  ): Promise<GlossaryTerm[]> {
    if (!widget?.ask) {
      return [];
    }

    try {
      const result = await widget.ask({
        prompt: `Analyze this document and extract terms that should be translated consistently throughout.

Categories to identify:
1. Proper nouns (company names, person names, place names)
2. Technical terms specific to this document's domain
3. Product or service names
4. Legal or formal terms that have specific translations

For each term, indicate if it should be:
- TRANSLATE: Normal translation
- KEEP: Keep in original language (brand names, etc.)
- SPECIFIC: Has a standard translation in this domain`,
        context: `SOURCE LANGUAGE: ${sourceLanguage}
INDUSTRY: ${this.industry}

DOCUMENT TEXT (first 5000 chars):
${documentText.substring(0, 5000)}`,
        output: widget.helpers ? {
          terms: widget.helpers.array(
            widget.helpers.object({
              term: widget.helpers.string('The term in original language'),
              type: widget.helpers.select(['proper_noun', 'technical_term', 'company_name', 'product_name', 'other'], 'Term category'),
              action: widget.helpers.select(['TRANSLATE', 'KEEP', 'SPECIFIC'], 'How to handle'),
              suggestedTranslation: widget.helpers.string('Suggested translation if SPECIFIC, empty otherwise'),
            })
          ),
        } : undefined,
        maxTokens: 2000,
      });

      if (!result.success || !result.result?.terms) {
        return [];
      }

      const extractedTerms: GlossaryTerm[] = [];

      for (const t of result.result.terms) {
        const term: GlossaryTerm = {
          original: t.term,
          translated: t.action === 'KEEP' ? t.term :
                      t.action === 'SPECIFIC' ? t.suggestedTranslation : null,
          type: t.type,
          source: 'extracted',
          occurrences: this.countOccurrences(documentText, t.term),
        };

        extractedTerms.push(term);

        // Add to glossary if not already present from RAG
        const key = t.term.toLowerCase();
        if (!this.glossary.has(key) || this.glossary.get(key)?.source !== 'rag') {
          this.glossary.set(key, term);
        }
      }

      return extractedTerms;
    } catch (error) {
      console.warn('[GlossaryManager] Term extraction failed:', error);
      return [];
    }
  }

  /**
   * Build glossary prompt section for translation requests
   */
  buildGlossaryPrompt(): string {
    const translatedTerms = Array.from(this.glossary.values())
      .filter(t => t.translated !== null)
      .sort((a, b) => {
        // Prioritize RAG terms, then by occurrences
        if (a.source === 'rag' && b.source !== 'rag') return -1;
        if (b.source === 'rag' && a.source !== 'rag') return 1;
        return b.occurrences - a.occurrences;
      })
      .slice(0, 50);  // Top 50 most important

    if (translatedTerms.length === 0) return '';

    let prompt = 'GLOSSARY (use these translations consistently):\n';
    for (const term of translatedTerms) {
      const source = term.source === 'rag' ? ' [company preferred]' : '';
      prompt += `- "${term.original}" → "${term.translated}"${source}\n`;
    }
    return prompt;
  }

  /**
   * Update glossary with translations from a completed batch
   */
  updateFromBatch(additions: Record<string, string>): void {
    for (const [original, translated] of Object.entries(additions)) {
      const key = original.toLowerCase();
      const existing = this.glossary.get(key);
      
      if (existing) {
        // Update with translation if not already set
        if (existing.translated === null) {
          existing.translated = translated;
        }
      } else {
        // Add new term
        this.glossary.set(key, {
          original,
          translated,
          type: 'other',
          source: 'extracted',
          occurrences: 0,
        });
      }
    }
  }

  /**
   * Get glossary as plain object (for persistence)
   */
  getGlossary(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [, term] of this.glossary.entries()) {
      if (term.translated !== null) {
        result[term.original] = term.translated;
      }
    }
    return result;
  }

  /**
   * Restore glossary from persisted state
   */
  restoreGlossary(glossary: Record<string, string>): void {
    for (const [original, translated] of Object.entries(glossary)) {
      this.glossary.set(original.toLowerCase(), {
        original,
        translated,
        type: 'other',
        source: 'extracted',
        occurrences: 0,
      });
    }
  }

  /**
   * Clear glossary
   */
  clear(): void {
    this.glossary.clear();
    this.industry = 'general';
  }

  /**
   * Get term count
   */
  getTermCount(): number {
    return this.glossary.size;
  }

  /**
   * Get translated term count
   */
  getTranslatedTermCount(): number {
    return Array.from(this.glossary.values()).filter(t => t.translated !== null).length;
  }

  private countOccurrences(text: string, term: string): number {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (text.match(regex) || []).length;
  }
}

// Factory function for creating new instances
export function createGlossaryManager(): GlossaryManager {
  return new GlossaryManager();
}
