/**
 * RAG Terminology Lookup
 * Queries company knowledge base for custom terminology and glossaries.
 */

import { RagTerm, RagTerminologyResult, IndustryType } from './translation-types';
import { terminologyCache } from './terminology-cache';

export class RagTerminologyLookup {
  /**
   * Look up terminology from the company's RAG knowledge base
   * Uses caching to avoid repeated queries
   */
  async lookup(
    industry: IndustryType,
    sourceLanguage: string,
    targetLanguage: string,
    widget: any
  ): Promise<RagTerminologyResult> {
    // Check cache first
    const cached = terminologyCache.get(industry, sourceLanguage, targetLanguage);
    if (cached) {
      console.log('[RagTerminology] Using cached terminology:', cached.terms.length, 'terms');
      return {
        terms: cached.terms,
        sourceCount: 0,
        fromCache: true,
      };
    }

    // Query RAG if available
    if (!widget?.ask) {
      console.log('[RagTerminology] Widget not available, skipping RAG lookup');
      return { terms: [], sourceCount: 0, fromCache: false };
    }

    try {
      console.log('[RagTerminology] Querying knowledge base for terminology...');
      
      const result = await widget.ask({
        prompt: `Find any glossaries, terminology guides, or translation preferences for ${industry} documents.
        
I need to translate from ${sourceLanguage} to ${targetLanguage}. 

Look for:
1. Official glossaries or term lists
2. Preferred translations for specific terms
3. Company-specific terminology
4. Style guide recommendations for translations

Return the terms with their preferred translations.`,
        searchKnowledgeBase: true,
        searchQuery: `glossary terminology ${industry} translation ${sourceLanguage} ${targetLanguage}`,
        searchSource: 'documents',
        searchLimit: 5,
        output: {
          terms: widget.helpers?.array?.(
            widget.helpers.object({
              original: widget.helpers.string('Original term in source language'),
              translation: widget.helpers.string('Preferred translation in target language'),
              context: widget.helpers.string('When to use this translation (optional)'),
            })
          ) || undefined,
          foundGlossary: widget.helpers?.boolean?.('Whether a glossary was found in the knowledge base') || undefined,
        },
      });

      if (!result.success) {
        console.log('[RagTerminology] RAG query returned no results');
        return { terms: [], sourceCount: 0, fromCache: false };
      }

      // Extract terms from result
      const terms: RagTerm[] = [];
      
      if (result.result?.terms && Array.isArray(result.result.terms)) {
        for (const term of result.result.terms) {
          if (term.original && term.translation) {
            terms.push({
              original: term.original,
              translation: term.translation,
              context: term.context || undefined,
              source: 'rag',
            });
          }
        }
      }

      // Get source count from response
      const sourceCount = result.sources?.length || 0;

      console.log(`[RagTerminology] Found ${terms.length} terms from ${sourceCount} sources`);

      // Cache the results
      if (terms.length > 0) {
        terminologyCache.set(industry, sourceLanguage, targetLanguage, terms);
      }

      return {
        terms,
        sourceCount,
        fromCache: false,
      };
    } catch (error) {
      console.warn('[RagTerminology] RAG lookup failed:', error);
      return { terms: [], sourceCount: 0, fromCache: false };
    }
  }

  /**
   * Look up specific terms from RAG
   * Useful for per-batch terminology lookup
   */
  async lookupSpecificTerms(
    terms: string[],
    sourceLanguage: string,
    targetLanguage: string,
    widget: any
  ): Promise<RagTerm[]> {
    if (!widget?.ask || terms.length === 0) {
      return [];
    }

    try {
      const result = await widget.ask({
        prompt: `Find the preferred translations for these specific terms from ${sourceLanguage} to ${targetLanguage}:

${terms.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Search the knowledge base for any glossaries or terminology guides that define how these terms should be translated.`,
        searchKnowledgeBase: true,
        searchQuery: terms.slice(0, 5).join(' ') + ` translation ${targetLanguage}`,
        searchSource: 'documents',
        searchLimit: 3,
        output: {
          translations: widget.helpers?.array?.(
            widget.helpers.object({
              original: widget.helpers.string('Original term'),
              translation: widget.helpers.string('Preferred translation'),
            })
          ) || undefined,
        },
      });

      if (!result.success || !result.result?.translations) {
        return [];
      }

      return result.result.translations
        .filter((t: any) => t.original && t.translation)
        .map((t: any) => ({
          original: t.original,
          translation: t.translation,
          source: 'rag-specific',
        }));
    } catch (error) {
      console.warn('[RagTerminology] Specific term lookup failed:', error);
      return [];
    }
  }

  /**
   * Convert RAG terms to glossary format
   */
  toGlossary(terms: RagTerm[]): Record<string, string> {
    const glossary: Record<string, string> = {};
    for (const term of terms) {
      glossary[term.original] = term.translation;
    }
    return glossary;
  }
}

// Singleton instance
export const ragTerminology = new RagTerminologyLookup();
