# SuperDoc Document Translation - Implementation Plan

This document describes the implementation plan for a document translation module that can handle documents of 50-100+ pages while preserving formatting, layout, tables, images, and structure.

> **Note**: This plan uses the existing `docx-diff-editor` package API (`getContent()`, `setSource()`) for document access. No additional infrastructure is required.

---

## Project Structure & Evolution

### Implementation Strategy

The translation system is implemented as a **shared library** that can be used by multiple example apps and potentially extracted as an independent package in the future.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SHARED TRANSLATION SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  src/lib/translation/          ← SHARED CORE MODULES                    │
│  ├── batching-engine.ts           (reusable across apps)                │
│  ├── segment-translator.ts                                              │
│  ├── glossary-manager.ts                                                │
│  ├── industry-detector.ts                                               │
│  ├── rag-terminology.ts                                                 │
│  ├── terminology-cache.ts                                               │
│  ├── document-accumulator.ts                                            │
│  ├── translation-persistence.ts                                         │
│  └── translation-types.ts                                               │
│                                                                          │
│         ┌─────────────────────┬─────────────────────┐                   │
│         ▼                     ▼                     ▼                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  translation-   │  │  superdoc-      │  │  future-        │         │
│  │  example        │  │  example        │  │  example        │         │
│  │  (Phase 1)      │  │  (Phase 2)      │  │                 │         │
│  │                 │  │                 │  │                 │         │
│  │ • Full doc      │  │ • Full doc      │  │ • Reuses same   │         │
│  │   translation   │  │ • Section       │  │   translation   │         │
│  │ • Dedicated     │  │ • Selection     │  │   modules       │         │
│  │   showcase      │  │ • One of many   │  │                 │         │
│  │ • Clean RAG     │  │   features      │  │                 │         │
│  │   (terminology) │  │ • Mixed RAG     │  │                 │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: `translation-example` (This Plan)

A dedicated translation showcase app that:
- Demonstrates full document translation as the **primary feature**
- Has RAG content focused on **terminology and glossaries**
- Provides clean, focused UX for translation workflow
- Serves as reference implementation for the translation system

### Phase 2: `superdoc-example` Upgrade (Future)

Enhance the existing document editor with translation as **one of many features**:
- **Translate document** - Full document translation
- **Translate section** - Right-click section → translate
- **Translate selection** - Highlight text → translate
- Works with **mixed RAG content** (templates, policies, terminology)
- More nuanced UX integration with existing editing features

### Future Evolution

The shared translation library is designed for extraction:

| Evolution Path | Description |
|----------------|-------------|
| **npm package** | `@okidoki/translation-tools` - Standalone package for any project |
| **docx-diff-editor extension** | Built-in translation support in the editor package |
| **Other example apps** | Any new showcase can import from `lib/translation/` |

### Shared vs. App-Specific Code

| Module | Location | Shared? |
|--------|----------|---------|
| Batching engine | `lib/translation/` | ✅ Yes |
| Segment translator | `lib/translation/` | ✅ Yes |
| Glossary manager | `lib/translation/` | ✅ Yes |
| Industry detector | `lib/translation/` | ✅ Yes |
| RAG terminology | `lib/translation/` | ✅ Yes |
| Translation tools | `app/*/lib/` | ❌ App-specific |
| UI components | `app/*/components/` | ❌ App-specific (may vary) |
| Orchestrator | `lib/translation/` | ✅ Yes (core), app adapts |

---

## Problem Statement

### Requirements

1. **Full Document Translation**: Translate entire documents from one language to another
2. **Preserve Everything Except Text**: Tables, images, formatting (bold, italic), lists, layout must remain intact
3. **Scale to Large Documents**: Support 50-100+ page documents (25,000-50,000+ words)
4. **Maintain Consistency**: Same terms should be translated the same way throughout
5. **Industry-Aware Translation**: Detect document industry/domain for appropriate terminology
6. **Custom Terminology Support**: Leverage company's RAG knowledge base for preferred translations
7. **Progressive Feedback**: User sees translation progress with fluid UI updates
8. **Resilience**: Handle failures gracefully, persist state, allow resume
9. **Crash Recovery**: Persist translation state to localStorage to survive browser crashes

### Challenges

| Challenge | Impact | Solution |
|-----------|--------|----------|
| Context window limits | Can't send 100-page doc to LLM | Section-aware batching |
| Term consistency | "Agreement" translated differently in different sections | Glossary manager |
| Industry-specific terminology | "Consideration" means different things in legal vs casual | Industry detection |
| Company-specific terms | Each company has preferred translations | RAG terminology lookup |
| Formatting preservation | Bold text must stay bold after translation | Structured text segments |
| Long processing time | User waits 5+ minutes with no feedback | Progress overlay with fluid animations |
| Mid-translation failures | API error at batch 20/25 loses work | localStorage persistence + resume |
| Browser crash | All progress lost | localStorage state recovery |
| User edits during translation | Position corruption | Document locking with overlay |
| Word order changes | "Important text" → "Texto importante" (adjective moves) | Paragraph-level translation |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT TRANSLATION SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Translation Orchestrator                        │ │
│  │  • Coordinates the entire translation flow                          │ │
│  │  • Manages progress state (memory + localStorage)                   │ │
│  │  • Handles errors, cancellation, and resume logic                   │ │
│  │  • Detects incomplete translations on page load                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │            PREPARATION PHASE    │                                  │  │
│  │  ┌──────────────┐    ┌──────────▼─────────┐    ┌──────────────┐   │  │
│  │  │   Industry   │    │     Glossary       │    │     RAG      │   │  │
│  │  │   Detector   │───▶│     Manager        │◀───│  Terminology │   │  │
│  │  │              │    │    (Enhanced)      │    │    Lookup    │   │  │
│  │  │ • Analyze    │    │                    │    │              │   │  │
│  │  │   document   │    │ • Auto-extracted   │    │ • Query app  │   │  │
│  │  │ • Classify   │    │   terms            │    │   knowledge  │   │  │
│  │  │   industry   │    │ • RAG terms        │    │   base       │   │  │
│  │  │ • Set        │    │ • Merge &          │    │ • Company    │   │  │
│  │  │   context    │    │   prioritize       │    │   glossaries │   │  │
│  │  └──────────────┘    └────────────────────┘    └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│         ┌──────────────────────────┼──────────────────────────┐         │
│         ▼                          ▼                          ▼         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐    │
│  │   Batching   │         │   Segment    │         │  Document    │    │
│  │   Engine     │         │  Translator  │         │  Accumulator │    │
│  │              │         │              │         │              │    │
│  │ • Section-   │         │ • Industry   │         │ • Collect    │    │
│  │   aware      │         │   context in │         │   translated │    │
│  │   chunking   │         │   prompts    │         │   batches    │    │
│  │ • Keep       │         │ • Merged     │         │ • Rebuild    │    │
│  │   sections   │         │   glossary   │         │   JSON       │    │
│  │   together   │         │ • Format     │         │ • Milestone  │    │
│  │              │         │   preserve   │         │   updates    │    │
│  └──────────────┘         └──────────────┘         └──────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    docx-diff-editor API                             │ │
│  │  • getContent() - Get ProseMirror JSON                              │ │
│  │  • setSource(json | html) - Replace document at milestones          │ │
│  │  • Document is locked during translation (overlay)                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Okidoki Widget API                               │ │
│  │  • widget.ask() - LLM calls for translation                         │ │
│  │  • widget.ask({ searchKnowledgeBase: true }) - RAG terminology      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Industry Detection First**: Before translation begins, analyze the document to detect its industry/domain (legal, medical, technical, etc.). This context improves terminology selection.

2. **RAG-Powered Terminology**: Query the company's knowledge base (via `widget.ask({ searchKnowledgeBase: true })`) for glossaries, style guides, and preferred translations. Companies manage their terminology as regular RAG content.

3. **Merged Glossary**: Combine RAG terms (priority) + auto-extracted terms into a single glossary. RAG terms take precedence since they represent company preferences.

4. **No surgical updates**: Using `setSource()` for document updates avoids position corruption if anything goes wrong. The document is rebuilt from accumulated translations at milestone points.

5. **Document locking**: During translation, an overlay prevents user edits. This eliminates position drift issues entirely.

6. **Milestone-based updates**: Instead of updating after every batch (which causes flickering), the document updates 5-10 times during translation (e.g., at 15%, 30%, 50%, 70%, 85%, 100%).

7. **Dual persistence**: Translation state is kept in memory for speed AND persisted to localStorage for crash recovery.

8. **Section-aware batching**: Batches are created based on document structure (keeping sections together when possible) rather than enforcing hard word limits.

---

## Core Concepts

### 1. Text Segments with Format Markers

Instead of losing formatting information, we extract text with explicit markers:

**Input (ProseMirror JSON):**
```json
{
  "type": "paragraph",
  "content": [
    { "type": "text", "text": "This is " },
    { "type": "text", "text": "important", "marks": [{ "type": "bold" }] },
    { "type": "text", "text": " and " },
    { "type": "text", "text": "urgent", "marks": [{ "type": "italic" }] },
    { "type": "text", "text": " text." }
  ]
}
```

**Extracted Segments:**
```json
{
  "paragraphId": "p_0",
  "segments": [
    { "id": "s_0", "text": "This is ", "marks": [] },
    { "id": "s_1", "text": "important", "marks": ["bold"] },
    { "id": "s_2", "text": " and ", "marks": [] },
    { "id": "s_3", "text": "urgent", "marks": ["italic"] },
    { "id": "s_4", "text": " text.", "marks": [] }
  ]
}
```

**Translation Prompt:**
```
Translate these text segments to Spanish. 
CRITICAL: Return the SAME number of segments with the SAME IDs.
You may reorder words within the translated text, but each segment 
must correspond to its original (same formatting will be applied).

Input:
[s_0] "This is "
[s_1] "important" (bold)
[s_2] " and "
[s_3] "urgent" (italic)
[s_4] " text."

Output format:
[s_0] "translated text"
[s_1] "translated text" (bold)
...
```

**AI Response:**
```
[s_0] "Este es un texto "
[s_1] "importante" (bold)
[s_2] " y "
[s_3] "urgente" (italic)
[s_4] "."
```

**Rebuilt Paragraph:**
```json
{
  "type": "paragraph",
  "content": [
    { "type": "text", "text": "Este es un texto " },
    { "type": "text", "text": "importante", "marks": [{ "type": "bold" }] },
    { "type": "text", "text": " y " },
    { "type": "text", "text": "urgente", "marks": [{ "type": "italic" }] },
    { "type": "text", "text": "." }
  ]
}
```

### 2. Glossary Management

**Pre-Translation Glossary Extraction:**
```typescript
// Before translating, scan document for key terms
const glossaryTerms = await extractGlossaryTerms(documentText, {
  types: ['proper_nouns', 'technical_terms', 'company_names', 'product_names'],
  maxTerms: 100,
});

// Result:
{
  "Acme Corporation": null,  // Will be filled during first use
  "Service Agreement": null,
  "Confidential Information": null,
  "Effective Date": null,
}
```

**Glossary Injection in Prompts:**
```
GLOSSARY (use these translations consistently):
- "Acme Corporation" → "Acme Corporation" (do not translate)
- "Service Agreement" → "Acuerdo de Servicio"
- "Confidential Information" → "Información Confidencial"
- "Effective Date" → "Fecha de Vigencia"
```

**Glossary Update After Each Batch:**
```typescript
// After translating a batch, update glossary with newly translated terms
glossary["Service Agreement"] = "Acuerdo de Servicio";  // Now locked in
```

### 3. Industry Detection

Before translation begins, we analyze the document to detect its industry/domain. This improves:
- Terminology selection (legal "consideration" vs casual "consideration")
- Translation tone and formality
- Glossary term extraction focus

**Supported Industries:**
| Industry | Examples | Characteristics |
|----------|----------|-----------------|
| Legal | Contracts, NDAs, Terms of Service | Formal language, specific legal terms |
| Medical | Clinical reports, research papers | Technical terminology, precision critical |
| Financial | Reports, statements, policies | Numbers, regulatory terms |
| Technical | Software docs, manuals | Technical jargon, product names |
| Marketing | Brochures, websites, ads | Brand voice, persuasive language |
| Academic | Research papers, theses | Formal, citation-aware |
| General | Letters, memos, general docs | Standard language |

**Detection Implementation:**
```typescript
// Simple AI classification during preparation phase
const industryResult = await widget.ask({
  prompt: `Analyze this document excerpt and classify its industry/domain.
           Return the most specific applicable category.`,
  context: documentText.substring(0, 3000),  // First ~3000 chars
  output: {
    industry: widget.helpers.select([
      'legal_contract', 'legal_litigation', 'legal_ip',
      'medical_clinical', 'medical_research', 'medical_pharmaceutical',
      'financial_banking', 'financial_insurance', 'financial_accounting',
      'technical_software', 'technical_engineering', 'technical_manufacturing',
      'marketing_advertising', 'marketing_branding',
      'academic_research', 'academic_education',
      'general'
    ], 'Primary industry classification'),
    confidence: widget.helpers.select(['high', 'medium', 'low'], 'Classification confidence'),
    reasoning: widget.helpers.string('Brief explanation for classification'),
  }
});

// Result example:
// {
//   industry: 'legal_contract',
//   confidence: 'high',
//   reasoning: 'Document contains party definitions, consideration clauses, and signature blocks typical of legal contracts'
// }
```

**Industry Context in Translation Prompts:**
```
You are translating a LEGAL CONTRACT from English to Spanish.
Use formal legal terminology appropriate for contracts.
Maintain precision in legal terms - do not paraphrase legal concepts.
```

### 4. RAG Terminology Lookup (Company Knowledge Base)

When the Okidoki widget supports RAG queries (`searchKnowledgeBase: true`), we can leverage the company's knowledge base for preferred terminology. Companies upload their glossaries, style guides, and approved translations as regular RAG content.

**Benefits:**
- No separate dictionary UI needed - companies manage terminology as RAG content
- Semantic search finds relevant terms even with varied phrasing
- Same workflow companies already use for knowledge base management
- Relevance scores help prioritize confident matches

**What Companies Upload to RAG:**
| Content Type | Example | What It Provides |
|--------------|---------|------------------|
| Glossary documents | "Legal-Terms-EN-ES.xlsx" | Direct term → translation mappings |
| Style guides | "Translation-Guidelines.pdf" | Tone, formality, preferences |
| Previous translations | "Contract-Template-Spanish.docx" | Examples of approved translations |
| Industry standards | "ISO-Medical-Terminology.pdf" | Domain-specific terms |
| Brand guidelines | "Acme-Brand-Voice.pdf" | How to handle brand names |

**RAG Terminology Lookup Implementation:**
```typescript
// Query company knowledge base for terminology during preparation
const ragTerminology = await widget.ask({
  prompt: `Extract translation guidelines and terminology for ${detectedIndustry} 
           documents from ${sourceLanguage} to ${targetLanguage}.
           Format as a list of term → translation pairs with context.`,
  searchKnowledgeBase: true,  // Enable RAG
  searchQuery: `translation glossary terminology ${detectedIndustry} ${sourceLanguage} ${targetLanguage}`,
  searchSource: 'documents',  // Company glossaries are likely uploaded documents
  searchLimit: 5,             // Get top 5 relevant results
  output: {
    terms: widget.helpers.array(
      widget.helpers.object({
        original: widget.helpers.string('Term in source language'),
        translation: widget.helpers.string('Preferred translation'),
        context: widget.helpers.string('When to use this translation'),
      })
    ),
    styleNotes: widget.helpers.string('Any general style/tone guidelines found'),
  }
});

// Result example:
// {
//   success: true,
//   result: {
//     terms: [
//       { original: "Force Majeure", translation: "Fuerza Mayor", context: "Legal contracts" },
//       { original: "Deliverables", translation: "Entregables", context: "Project scope sections" },
//       { original: "Acme Corp", translation: "Acme Corp", context: "Do not translate brand names" },
//     ],
//     styleNotes: "Use formal 'usted' form. Keep all product names in English."
//   },
//   sources: [
//     { title: "Acme Legal Glossary.xlsx", relevance: 0.89, type: "document", snippet: "..." },
//     { title: "Translation Style Guide.pdf", relevance: 0.76, type: "document", snippet: "..." }
//   ]
// }
```

**Merging Glossaries (RAG + Auto-Extracted):**
```typescript
// Priority: RAG terms > Auto-extracted terms
// RAG terms represent company preferences, so they take precedence

const mergedGlossary = new Map<string, GlossaryTerm>();

// 1. Add auto-extracted terms first (lower priority)
for (const term of autoExtractedTerms) {
  mergedGlossary.set(term.original.toLowerCase(), term);
}

// 2. Override with RAG terms (higher priority)
for (const term of ragTerminology.terms) {
  mergedGlossary.set(term.original.toLowerCase(), {
    ...term,
    source: 'rag',  // Mark as from company knowledge base
  });
}

// Result: Company preferences override auto-extracted guesses
```

**Graceful Degradation:**
- If RAG is not available (feature not deployed), skip RAG lookup
- If RAG returns no results, use only auto-extracted terms
- If RAG returns low-relevance results (< 0.55), treat with caution

**RAG Terminology Caching:**

RAG queries have latency (embedding generation + vector search + LLM processing), so we cache results to speed up subsequent translations with the same industry/language combination.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RAG TERMINOLOGY CACHE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Level 1: In-Memory (session)                                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Fast access during active translation                              │ │
│  │  Cleared when page refreshes                                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              ↑ miss                                      │
│                              │                                           │
│  Level 2: localStorage (persistent)                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Survives page refresh, browser restart                             │ │
│  │  TTL-based expiration (7 days default)                             │ │
│  │  Keyed by: industry + sourceLanguage + targetLanguage              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Cache Key Strategy:**
```typescript
// Key is specific enough to be useful, generic enough to hit cache
const cacheKey = `rag_terms_${industry}_${sourceLanguage}_${targetLanguage}`;
// Example: "rag_terms_legal_contract_en_es"

// Why not include query text in key?
// - Different queries for same industry/language likely return similar terms
// - E.g., "legal contract terminology" vs "translation glossary legal" → same terms
```

**Cache Entry Structure:**
```typescript
interface CachedTerminology {
  cacheKey: string;
  createdAt: number;
  expiresAt: number;  // TTL: 7 days default
  
  // The actual cached data
  terms: Array<{
    original: string;
    translation: string;
    context: string;
  }>;
  styleNotes: string;
  
  // Metadata
  sourceCount: number;  // How many RAG sources contributed
}
```

**Cache Lookup Flow:**
```typescript
async function getRAGTerminology(
  industry: string,
  sourceLanguage: string,
  targetLanguage: string,
  widget: any
): Promise<CachedTerminology | null> {
  const cacheKey = `rag_terms_${industry}_${sourceLanguage}_${targetLanguage}`;
  
  // 1. Check memory cache (fastest)
  if (memoryCache.has(cacheKey)) {
    console.log('[RAG Cache] Memory hit');
    return memoryCache.get(cacheKey);
  }
  
  // 2. Check localStorage cache
  const cached = loadFromLocalStorage(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[RAG Cache] localStorage hit');
    memoryCache.set(cacheKey, cached);  // Promote to memory
    return cached;
  }
  
  // 3. Cache miss - query RAG
  console.log('[RAG Cache] Miss - querying RAG');
  const ragResult = await queryRAGTerminology(industry, sourceLanguage, targetLanguage, widget);
  
  if (ragResult) {
    const entry: CachedTerminology = {
      cacheKey,
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),  // 7 days
      terms: ragResult.terms,
      styleNotes: ragResult.styleNotes,
      sourceCount: ragResult.sources?.length || 0,
    };
    
    // Store in both caches
    memoryCache.set(cacheKey, entry);
    saveToLocalStorage(cacheKey, entry);
    
    return entry;
  }
  
  return null;
}
```

**Cache Invalidation:**
| Strategy | When | Implementation |
|----------|------|----------------|
| **TTL-based** | Default | Entries expire after 7 days |
| **Manual clear** | User updates RAG content | Optional "Refresh terminology" button |
| **On error** | Cache corrupted | Catch JSON parse errors, clear and re-query |

**Cache Benefits:**
| Scenario | Without Cache | With Cache |
|----------|---------------|------------|
| Same company translates 2nd legal contract EN→ES | RAG query (~2-3 sec) | Instant |
| Same document retranslated after error | RAG query (~2-3 sec) | Instant |
| Page refresh during translation | Re-query RAG | Instant from localStorage |

### 5. Batching Strategy

The batching strategy is **section-aware** rather than size-limited. The goal is to keep logical document sections together for better translation quality and context.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SECTION-AWARE BATCHING                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Document (100 pages, ~50,000 words)                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Section 1: Introduction (2 pages)                                  │ │
│  │ Section 2: Definitions (3 pages)                                   │ │
│  │ Section 3: Terms and Conditions (15 pages) ← Large section         │ │
│  │ Section 4: Payment (4 pages)                                       │ │
│  │ ...                                                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  Batching Rules:                                                         │
│  1. Keep sections together whenever possible                             │
│  2. NO hard word/size limits - let sections be natural batches          │
│  3. For very large sections (15+ pages), split at heading boundaries    │
│  4. Include previous section summary as context for continuity          │
│                                    │                                     │
│                                    ▼                                     │
│  Resulting Batches:                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Batch 1: Section 1 - Introduction (2 pages)                      │   │
│  │ Batch 2: Section 2 - Definitions (3 pages)                       │   │
│  │ Batch 3: Section 3.1-3.3 - Terms Part 1 (5 pages) + context      │   │
│  │ Batch 4: Section 3.4-3.6 - Terms Part 2 (5 pages) + context      │   │
│  │ Batch 5: Section 3.7-3.9 - Terms Part 3 (5 pages) + context      │   │
│  │ Batch 6: Section 4 - Payment (4 pages)                           │   │
│  │ ...                                                               │   │
│  │ Batch N: Final section                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Document Updates (5-10 times during translation):                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Milestone 1: After ~15% batches complete → setSource()         │   │
│  │ • Milestone 2: After ~30% batches complete → setSource()         │   │
│  │ • Milestone 3: After ~50% batches complete → setSource()         │   │
│  │ • Milestone 4: After ~70% batches complete → setSource()         │   │
│  │ • Milestone 5: After ~85% batches complete → setSource()         │   │
│  │ • Final: After 100% complete → setSource()                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6. State Persistence Strategy

Translation state is persisted to both memory and localStorage:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DUAL PERSISTENCE                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  In-Memory State (fast access during translation):                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ {                                                                  │ │
│  │   status: 'translating',                                          │ │
│  │   industry: 'legal_contract', // Detected industry                 │ │
│  │   translatedBatches: [...],   // Accumulated results               │ │
│  │   glossary: {...},            // Merged: RAG + auto-extracted      │ │
│  │   ragTermsFound: true,        // Whether RAG returned results      │ │
│  │   currentBatchIndex: 12,                                          │ │
│  │ }                                                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼ (sync after each batch)             │
│                                                                          │
│  localStorage State (crash recovery):                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ {                                                                  │ │
│  │   documentId: "hash-of-original-content",                         │ │
│  │   sourceLanguage: "en",                                           │ │
│  │   targetLanguage: "es",                                           │ │
│  │   industry: "legal_contract", // Preserved for resume              │ │
│  │   startedAt: 1704700000000,                                       │ │
│  │   completedBatches: [...],    // Translated content                │ │
│  │   glossary: {...},            // Merged glossary for consistency   │ │
│  │   originalDocumentJson: {...}, // For restore option               │ │
│  │   totalBatches: 25,                                               │ │
│  │   lastUpdated: 1704700300000,                                     │ │
│  │ }                                                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Shared Translation Library

```
src/lib/translation/                    # SHARED - Reusable across all apps
├── index.ts                            # Main exports
├── translation-orchestrator.ts         # Coordinates translation flow + recovery
├── industry-detector.ts                # Document industry/domain classification
├── rag-terminology.ts                  # RAG-based terminology lookup
├── terminology-cache.ts                # Two-level cache (memory + localStorage)
├── glossary-manager.ts                 # Term extraction, merging, consistency
├── batching-engine.ts                  # Section-aware chunking
├── segment-translator.ts               # Format-preserving translation
├── document-accumulator.ts             # Collects batches, rebuilds JSON
├── translation-persistence.ts          # localStorage state management
└── translation-types.ts                # Type definitions
```

### Translation Example App (Phase 1)

```
src/app/translation-example/            # DEDICATED translation showcase
├── page.tsx                            # Main page (clone of superdoc-example baseline)
├── layout.tsx                          # App layout
├── lib/
│   ├── translation-tools.ts            # translate_document tool
│   └── LanguageContext.tsx             # UI language context
├── components/
│   ├── TranslationViewer.tsx           # Document viewer (based on SuperDocViewer)
│   ├── TranslationOverlay.tsx          # Progress overlay (locks document)
│   ├── TranslationResumeDialog.tsx     # Resume incomplete translation dialog
│   ├── TranslationCancelDialog.tsx     # Cancel with keep/restore choice
│   └── Header.tsx                      # App header
└── types.ts                            # App-specific types
```

### SuperDoc Example Upgrade (Phase 2 - Future)

```
src/app/superdoc-example/               # EXISTING app - add translation features
├── lib/
│   └── superdoc-tools.ts               # Add translate_document, translate_section, translate_selection
├── components/
│   ├── TranslationOverlay.tsx          # Shared or adapted from translation-example
│   └── ...existing components
└── ...existing files
```

---

## Implementation Details

### Step 1: Translation Types & State Management

```typescript
// translation-types.ts

export interface TranslationState {
  status: 'idle' | 'preparing' | 'translating' | 'paused' | 'completed' | 'error';
  sourceLanguage: string;
  targetLanguage: string;
  
  // Progress tracking
  totalBatches: number;
  completedBatches: number;
  currentBatchIndex: number;
  
  // Glossary for term consistency
  glossary: Record<string, string>;
  
  // Accumulated translated content (rebuilt JSON)
  accumulatedTranslations: TranslatedBatchResult[];
  
  // For resume capability
  completedBatchIndices: number[];
  
  // Error info
  error?: string;
  failedBatchIndex?: number;
}

export interface TranslatedBatchResult {
  batchIndex: number;
  sectionId: string;
  sectionTitle: string;
  translatedParagraphs: Array<{
    paragraphIndex: number;
    segments: Array<{
      id: string;
      originalText: string;
      translatedText: string;
      marks: string[];
    }>;
  }>;
  glossaryAdditions: Record<string, string>;
}

export interface TranslationProgress {
  status: TranslationState['status'];
  percentage: number;
  currentSection: string;
  completedBatches: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;  // seconds
}

// localStorage persistence structure
export interface PersistedTranslationState {
  documentId: string;  // Hash of original document for identification
  sourceLanguage: string;
  targetLanguage: string;
  startedAt: number;
  lastUpdated: number;
  totalBatches: number;
  completedBatches: TranslatedBatchResult[];
  glossary: Record<string, string>;
  originalDocumentJson: any;  // For restore option on cancel
}
```

### Step 1b: Translation Persistence (localStorage)

```typescript
// translation-persistence.ts

const STORAGE_KEY = 'superdoc_translation_state';

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
   * Clear persisted state (on complete or discard)
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
  
  /**
   * Generate a document ID from content (simple hash)
   */
  static generateDocumentId(content: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(content.length, 10000); i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `doc_${Math.abs(hash).toString(36)}`;
  }
}
```

### Step 2: Glossary Manager

```typescript
// glossary-manager.ts

export interface GlossaryTerm {
  original: string;
  translated: string | null;  // null = not yet translated
  type: 'proper_noun' | 'technical_term' | 'company_name' | 'product_name' | 'other';
  occurrences: number;
}

export class GlossaryManager {
  private glossary: Map<string, GlossaryTerm> = new Map();
  
  /**
   * Extract potential glossary terms from document text
   * Uses AI to identify names, technical terms, etc.
   */
  async extractTerms(
    documentText: string,
    sourceLanguage: string,
    widget: any
  ): Promise<GlossaryTerm[]> {
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
      
DOCUMENT TEXT (first 5000 chars):
${documentText.substring(0, 5000)}`,
      output: {
        terms: widget.helpers.array(
          widget.helpers.object({
            term: widget.helpers.string('The term in original language'),
            type: widget.helpers.enumType(['proper_noun', 'technical_term', 'company_name', 'product_name', 'other']),
            action: widget.helpers.enumType(['TRANSLATE', 'KEEP', 'SPECIFIC']),
            suggestedTranslation: widget.helpers.string('Suggested translation if SPECIFIC, empty otherwise'),
          })
        ),
      },
      maxTokens: 2000,
    });
    
    if (!result.success) return [];
    
    return result.result.terms.map((t: any) => ({
      original: t.term,
      translated: t.action === 'KEEP' ? t.term : 
                  t.action === 'SPECIFIC' ? t.suggestedTranslation : null,
      type: t.type,
      occurrences: this.countOccurrences(documentText, t.term),
    }));
  }
  
  /**
   * Build glossary prompt section for translation requests
   */
  buildGlossaryPrompt(): string {
    const translatedTerms = Array.from(this.glossary.values())
      .filter(t => t.translated !== null)
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 50);  // Top 50 most frequent
    
    if (translatedTerms.length === 0) return '';
    
    let prompt = 'GLOSSARY (use these translations consistently):\n';
    for (const term of translatedTerms) {
      prompt += `- "${term.original}" → "${term.translated}"\n`;
    }
    return prompt;
  }
  
  /**
   * Update glossary with translations from a completed batch
   */
  updateFromBatch(originalText: string, translatedText: string): void {
    // Extract any glossary terms that appeared in this batch
    // and now have translations
    for (const [original, term] of this.glossary.entries()) {
      if (term.translated !== null) continue;  // Already translated
      
      const originalLower = original.toLowerCase();
      const origIndex = originalText.toLowerCase().indexOf(originalLower);
      if (origIndex === -1) continue;  // Term not in this batch
      
      // Try to find corresponding translation
      // This is heuristic - works best for proper nouns that appear similarly
      // For complex cases, AI will provide in subsequent batches
    }
  }
  
  /**
   * Get glossary as plain object (for persistence)
   */
  getGlossary(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [original, term] of this.glossary.entries()) {
      if (term.translated !== null) {
        result[original] = term.translated;
      }
    }
    return result;
  }
  
  /**
   * Restore glossary from persisted state
   */
  restoreGlossary(glossary: Record<string, string>): void {
    for (const [original, translated] of Object.entries(glossary)) {
      this.glossary.set(original, {
        original,
        translated,
        type: 'other',
        occurrences: 0,
      });
    }
  }
  
  private countOccurrences(text: string, term: string): number {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (text.match(regex) || []).length;
  }
}
```

### Step 3: Batching Engine (Section-Aware)

```typescript
// batching-engine.ts

export interface TranslationBatch {
  batchIndex: number;
  sectionId: string;
  sectionTitle: string;
  isPartialSection: boolean;
  partIndex?: number;
  totalParts?: number;
  
  // Content
  paragraphs: ParagraphContent[];
  wordCount: number;
  
  // Context for continuity
  previousContext?: string;  // Summary of previous section for context
}

export interface ParagraphContent {
  paragraphIndex: number;
  segments: TextSegment[];
  plainText: string;
}

export interface TextSegment {
  id: string;
  text: string;
  marks: string[];  // ['bold', 'italic', etc.]
}

// Threshold for splitting very large sections (e.g., 15+ pages)
const LARGE_SECTION_THRESHOLD = 7500;  // ~15 pages worth of words

export class BatchingEngine {
  
  /**
   * Split document into translation batches.
   * Section-aware: keeps sections together unless extremely large.
   */
  createBatches(documentJson: any): TranslationBatch[] {
    const sections = this.extractSections(documentJson);
    const batches: TranslationBatch[] = [];
    let batchIndex = 0;
    let previousContext: string | undefined;
    
    for (const section of sections) {
      const sectionParagraphs = this.extractParagraphs(section.content);
      const wordCount = this.countWords(sectionParagraphs);
      
      if (wordCount <= LARGE_SECTION_THRESHOLD) {
        // Section fits in one batch (most common case)
        batches.push({
          batchIndex: batchIndex++,
          sectionId: section.id,
          sectionTitle: section.title,
          isPartialSection: false,
          paragraphs: sectionParagraphs,
          wordCount,
          previousContext,
        });
        
        // Update context: brief summary of this section for continuity
        previousContext = `Previous section: "${section.title}"`;
      } else {
        // Very large section - split at subsection or paragraph boundaries
        const parts = this.splitLargeSection(section, sectionParagraphs);
        
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
          batches.push({
            batchIndex: batchIndex++,
            sectionId: section.id,
            sectionTitle: section.title,
            isPartialSection: true,
            partIndex,
            totalParts: parts.length,
            paragraphs: parts[partIndex],
            wordCount: this.countWords(parts[partIndex]),
            previousContext,
          });
          
          previousContext = `Previous: "${section.title}" (part ${partIndex + 1})`;
        }
      }
    }
    
    return batches;
  }
  
  /**
   * Extract sections from ProseMirror JSON (by headings)
   */
  private extractSections(doc: any): Array<{id: string; title: string; content: any[]}> {
    const sections: Array<{id: string; title: string; content: any[]}> = [];
    let currentSection: {id: string; title: string; content: any[]} | null = null;
    let sectionIndex = 0;
    
    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'heading') {
          // Save previous section
          if (currentSection && currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          
          // Start new section
          const title = this.extractTextFromNode(node);
          currentSection = {
            id: `section_${sectionIndex++}`,
            title: title || `Section ${sectionIndex}`,
            content: [],
          };
        } else if (currentSection) {
          currentSection.content.push(node);
        } else {
          // Content before first heading - create implicit section
          if (!currentSection) {
            currentSection = {
              id: `section_${sectionIndex++}`,
              title: 'Introduction',
              content: [],
            };
          }
          currentSection.content.push(node);
        }
      }
    };
    
    if (doc.content) {
      traverse(doc.content);
    }
    
    // Don't forget last section
    if (currentSection && currentSection.content.length > 0) {
      sections.push(currentSection);
    }
    
    return sections;
  }
  
  /**
   * Extract paragraphs with text segments from section content
   */
  private extractParagraphs(contentNodes: any[]): ParagraphContent[] {
    const paragraphs: ParagraphContent[] = [];
    let paragraphIndex = 0;
    
    const processNode = (node: any) => {
      if (node.type === 'paragraph' || node.type === 'listItem') {
        const segments = this.extractSegments(node, paragraphIndex);
        if (segments.length > 0) {
          paragraphs.push({
            paragraphIndex: paragraphIndex++,
            segments,
            plainText: segments.map(s => s.text).join(''),
          });
        }
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        // Process list items
        if (node.content) {
          for (const item of node.content) {
            processNode(item);
          }
        }
      } else if (node.type === 'table') {
        // Process table cells
        this.processTableNode(node, paragraphs, paragraphIndex);
      } else if (node.content) {
        // Recurse into other container nodes
        for (const child of node.content) {
          processNode(child);
        }
      }
    };
    
    for (const node of contentNodes) {
      processNode(node);
    }
    
    return paragraphs;
  }
  
  /**
   * Extract text segments with formatting marks
   */
  private extractSegments(node: any, paragraphIndex: number): TextSegment[] {
    const segments: TextSegment[] = [];
    let segmentIndex = 0;
    
    const extractFromContent = (content: any[]) => {
      for (const child of content) {
        if (child.type === 'text' && child.text) {
          segments.push({
            id: `s_${paragraphIndex}_${segmentIndex++}`,
            text: child.text,
            marks: (child.marks || []).map((m: any) => m.type),
          });
        } else if (child.content) {
          extractFromContent(child.content);
        }
      }
    };
    
    if (node.content) {
      extractFromContent(node.content);
    }
    
    return segments;
  }
  
  /**
   * Process table nodes - extract text from each cell
   */
  private processTableNode(
    tableNode: any, 
    paragraphs: ParagraphContent[], 
    startIndex: number
  ): void {
    let paragraphIndex = startIndex;
    
    const processCell = (cell: any) => {
      if (cell.content) {
        for (const cellContent of cell.content) {
          if (cellContent.type === 'paragraph') {
            const segments = this.extractSegments(cellContent, paragraphIndex);
            if (segments.length > 0) {
              paragraphs.push({
                paragraphIndex: paragraphIndex++,
                segments,
                plainText: segments.map(s => s.text).join(''),
              });
            }
          }
        }
      }
    };
    
    if (tableNode.content) {
      for (const row of tableNode.content) {
        if (row.content) {
          for (const cell of row.content) {
            processCell(cell);
          }
        }
      }
    }
  }
  
  /**
   * Split a very large section into multiple batches
   */
  private splitLargeSection(
    section: {id: string; title: string; content: any[]},
    paragraphs: ParagraphContent[]
  ): ParagraphContent[][] {
    const parts: ParagraphContent[][] = [];
    const targetPartsCount = Math.ceil(
      this.countWords(paragraphs) / LARGE_SECTION_THRESHOLD
    );
    const paragraphsPerPart = Math.ceil(paragraphs.length / targetPartsCount);
    
    for (let i = 0; i < paragraphs.length; i += paragraphsPerPart) {
      parts.push(paragraphs.slice(i, i + paragraphsPerPart));
    }
    
    return parts;
  }
  
  /**
   * Extract plain text from a node
   */
  private extractTextFromNode(node: any): string {
    if (node.text) return node.text;
    if (!node.content) return '';
    return node.content.map((child: any) => this.extractTextFromNode(child)).join('');
  }
  
  private countWords(paragraphs: ParagraphContent[]): number {
    return paragraphs.reduce(
      (sum, p) => sum + p.plainText.split(/\s+/).filter(w => w.length > 0).length,
      0
    );
  }
}
```

### Step 4: Segment Translator

```typescript
// segment-translator.ts

import { TranslationBatch, ParagraphContent, TextSegment } from './batching-engine';
import { GlossaryManager } from './glossary-manager';
import { TranslatedBatchResult } from './translation-types';

export interface TranslatedParagraph {
  paragraphIndex: number;
  segments: TranslatedSegment[];
}

export interface TranslatedSegment {
  id: string;
  originalText: string;
  translatedText: string;
  marks: string[];
}

export class SegmentTranslator {
  constructor(
    private glossaryManager: GlossaryManager,
    private widget: any
  ) {}
  
  /**
   * Translate a batch while preserving segment structure
   */
  async translateBatch(
    batch: TranslationBatch,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslatedBatchResult & { success: boolean; error?: string }> {
    try {
      // Build the translation request
      const segmentList = this.buildSegmentList(batch.paragraphs);
      const glossaryPrompt = this.glossaryManager.buildGlossaryPrompt();
      
      const result = await this.widget.ask({
        prompt: `Translate the following text segments from ${sourceLanguage} to ${targetLanguage}.

CRITICAL RULES:
1. Return EXACTLY the same number of segments with the SAME IDs
2. Preserve the meaning and intent of each segment
3. Each segment will have its original formatting (bold, italic, etc.) applied
4. Natural word reordering within segments is OK
5. Keep proper nouns and technical terms consistent with the glossary

${glossaryPrompt}

OUTPUT FORMAT:
Return a JSON array with this structure:
[
  { "id": "s_0_0", "text": "translated text here" },
  { "id": "s_0_1", "text": "translated text here" },
  ...
]`,
        context: `${batch.previousContext ? `PREVIOUS CONTEXT (for continuity, do not translate):\n${batch.previousContext}\n\n` : ''}
SECTION: ${batch.sectionTitle}${batch.isPartialSection ? ` (Part ${batch.partIndex! + 1}/${batch.totalParts})` : ''}

SEGMENTS TO TRANSLATE:
${segmentList}`,
      });
      
      if (!result.success) {
        return {
          batchIndex: batch.batchIndex,
          sectionId: batch.sectionId,
          sectionTitle: batch.sectionTitle,
          translatedParagraphs: [],
          glossaryAdditions: {},
          success: false,
          error: result.error,
        };
      }
      
      // Parse and validate response
      const translatedSegments = this.parseTranslationResponse(result.result);
      const translatedParagraphs = this.rebuildParagraphs(
        batch.paragraphs,
        translatedSegments
      );
      
      return {
        batchIndex: batch.batchIndex,
        sectionId: batch.sectionId,
        sectionTitle: batch.sectionTitle,
        translatedParagraphs,
        glossaryAdditions: {},  // Could extract new terms here
        success: true,
      };
      
    } catch (error) {
      return {
        batchIndex: batch.batchIndex,
        sectionId: batch.sectionId,
        sectionTitle: batch.sectionTitle,
        translatedParagraphs: [],
        glossaryAdditions: {},
        success: false,
        error: String(error),
      };
    }
  }
  
  /**
   * Build formatted segment list for AI prompt
   */
  private buildSegmentList(paragraphs: ParagraphContent[]): string {
    const lines: string[] = [];
    
    for (const para of paragraphs) {
      for (const seg of para.segments) {
        const marksStr = seg.marks.length > 0 ? ` (${seg.marks.join(', ')})` : '';
        lines.push(`[${seg.id}] "${seg.text}"${marksStr}`);
      }
      lines.push('');  // Paragraph break
    }
    
    return lines.join('\n');
  }
  
  /**
   * Parse AI response into segment map
   */
  private parseTranslationResponse(
    response: string
  ): Map<string, string> {
    const segmentMap = new Map<string, string>();
    
    try {
      // Try JSON parsing first
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          if (item.id && item.text !== undefined) {
            segmentMap.set(item.id, item.text);
          }
        }
        return segmentMap;
      }
      
      // Fallback: line-by-line parsing
      const lines = response.split('\n');
      for (const line of lines) {
        const match = line.match(/\[([^\]]+)\]\s*"([^"]*)"/);
        if (match) {
          segmentMap.set(match[1], match[2]);
        }
      }
      
    } catch (e) {
      console.error('[SegmentTranslator] Failed to parse response:', e);
    }
    
    return segmentMap;
  }
  
  /**
   * Rebuild paragraph structure with translated segments
   */
  private rebuildParagraphs(
    originalParagraphs: ParagraphContent[],
    translations: Map<string, string>
  ): TranslatedParagraph[] {
    const result: TranslatedParagraph[] = [];
    
    for (const para of originalParagraphs) {
      const translatedSegments: TranslatedSegment[] = [];
      
      for (const seg of para.segments) {
        const translatedText = translations.get(seg.id);
        
        translatedSegments.push({
          id: seg.id,
          originalText: seg.text,
          translatedText: translatedText ?? seg.text,  // Fallback to original
          marks: seg.marks,
        });
      }
      
      result.push({
        paragraphIndex: para.paragraphIndex,
        segments: translatedSegments,
      });
    }
    
    return result;
  }
}
```

### Step 5: Document Accumulator (Milestone-Based Updates)

Instead of surgical updates, we accumulate translated batches in memory and update the document at milestone points (5-10 times during translation).

```typescript
// document-accumulator.ts

import { TranslatedBatchResult, TranslationProgress } from './translation-types';

// Milestones at which to update the visible document (percentage)
const UPDATE_MILESTONES = [15, 30, 50, 70, 85, 100];

export class DocumentAccumulator {
  private originalJson: any;
  private translatedBatches: Map<number, TranslatedBatchResult> = new Map();
  private lastAppliedMilestone = 0;
  
  constructor(
    private viewer: any,  // SuperDocViewerRef
    private onProgress: (progress: TranslationProgress) => void
  ) {}
  
  /**
   * Store the original document for reference and restore
   */
  setOriginalDocument(json: any): void {
    this.originalJson = JSON.parse(JSON.stringify(json));  // Deep clone
  }
  
  /**
   * Get original document (for localStorage persistence)
   */
  getOriginalDocument(): any {
    return this.originalJson;
  }
  
  /**
   * Add a translated batch to the accumulator
   */
  addBatch(batch: TranslatedBatchResult): void {
    this.translatedBatches.set(batch.batchIndex, batch);
  }
  
  /**
   * Check if we should update the visible document (milestone reached)
   */
  shouldUpdateDocument(completedBatches: number, totalBatches: number): boolean {
    const percentage = Math.round((completedBatches / totalBatches) * 100);
    
    for (const milestone of UPDATE_MILESTONES) {
      if (percentage >= milestone && this.lastAppliedMilestone < milestone) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Apply accumulated translations to the document
   * Called at milestone points (5-10 times during translation)
   */
  async applyToDocument(completedBatches: number, totalBatches: number): Promise<void> {
    const percentage = Math.round((completedBatches / totalBatches) * 100);
    
    // Find which milestone we're at
    for (const milestone of UPDATE_MILESTONES) {
      if (percentage >= milestone && this.lastAppliedMilestone < milestone) {
        this.lastAppliedMilestone = milestone;
        break;
      }
    }
    
    // Rebuild the document with all accumulated translations
    const translatedJson = this.rebuildDocument();
    
    // Update the visible document using setSource
    await this.viewer.setSource(translatedJson);
    
    console.log(`[DocumentAccumulator] Applied ${this.translatedBatches.size} batches at ${percentage}%`);
  }
  
  /**
   * Rebuild the full document JSON with accumulated translations
   */
  private rebuildDocument(): any {
    // Deep clone original
    const newDoc = JSON.parse(JSON.stringify(this.originalJson));
    
    // Get all batches sorted by index
    const sortedBatches = Array.from(this.translatedBatches.values())
      .sort((a, b) => a.batchIndex - b.batchIndex);
    
    // Build a map of original paragraph text -> translated segments
    const translationMap = new Map<string, Map<string, string>>();
    
    for (const batch of sortedBatches) {
      for (const para of batch.translatedParagraphs) {
        const segmentMap = new Map<string, string>();
        for (const seg of para.segments) {
          segmentMap.set(seg.originalText, seg.translatedText);
        }
        // Use original paragraph text as key
        const originalText = para.segments.map(s => s.originalText).join('');
        translationMap.set(originalText, segmentMap);
      }
    }
    
    // Walk through document and apply translations
    this.applyTranslationsToNode(newDoc, translationMap);
    
    return newDoc;
  }
  
  /**
   * Recursively apply translations to document nodes
   */
  private applyTranslationsToNode(
    node: any, 
    translationMap: Map<string, Map<string, string>>
  ): void {
    if (!node) return;
    
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') {
      // Extract current text
      const currentText = this.extractText(node);
      const segmentMap = translationMap.get(currentText);
      
      if (segmentMap && node.content) {
        // Apply translations to text nodes
        for (const child of node.content) {
          if (child.type === 'text' && child.text) {
            const translated = segmentMap.get(child.text);
            if (translated !== undefined) {
              child.text = translated;
            }
          }
        }
      }
    }
    
    // Recurse into children
    if (node.content) {
      for (const child of node.content) {
        this.applyTranslationsToNode(child, translationMap);
      }
    }
  }
  
  /**
   * Extract plain text from a node
   */
  private extractText(node: any): string {
    if (node.text) return node.text;
    if (!node.content) return '';
    return node.content.map((child: any) => this.extractText(child)).join('');
  }
  
  /**
   * Update progress indicator (called after each batch)
   */
  updateProgress(
    completedBatches: number,
    totalBatches: number,
    currentSection: string,
    startTime: number
  ): void {
    const elapsed = (Date.now() - startTime) / 1000;
    const avgTimePerBatch = completedBatches > 0 ? elapsed / completedBatches : 30;
    const remaining = (totalBatches - completedBatches) * avgTimePerBatch;
    
    this.onProgress({
      status: 'translating',
      percentage: Math.round((completedBatches / totalBatches) * 100),
      currentSection,
      completedBatches,
      totalBatches,
      estimatedTimeRemaining: Math.round(remaining),
    });
  }
  
  /**
   * Get all accumulated batches (for persistence)
   */
  getAccumulatedBatches(): TranslatedBatchResult[] {
    return Array.from(this.translatedBatches.values());
  }
  
  /**
   * Restore accumulated batches (for resume)
   */
  restoreAccumulatedBatches(batches: TranslatedBatchResult[]): void {
    for (const batch of batches) {
      this.translatedBatches.set(batch.batchIndex, batch);
    }
  }
  
  /**
   * Reset accumulator
   */
  reset(): void {
    this.translatedBatches.clear();
    this.lastAppliedMilestone = 0;
  }
}
```

### Step 6: Translation Orchestrator

```typescript
// translation-orchestrator.ts

import { GlossaryManager } from './glossary-manager';
import { BatchingEngine, TranslationBatch } from './batching-engine';
import { SegmentTranslator } from './segment-translator';
import { DocumentAccumulator } from './document-accumulator';
import { TranslationPersistence, PersistedTranslationState } from './translation-persistence';
import { TranslationState, TranslationProgress, TranslatedBatchResult } from './translation-types';

export interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  onProgress?: (progress: TranslationProgress) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onCancelRequest?: () => Promise<'keep' | 'restore' | 'continue'>;
}

export class TranslationOrchestrator {
  private state: TranslationState;
  private glossaryManager: GlossaryManager;
  private batchingEngine: BatchingEngine;
  private segmentTranslator: SegmentTranslator;
  private documentAccumulator: DocumentAccumulator;
  private persistence: TranslationPersistence;
  private isCancelled = false;
  
  constructor(
    private viewer: any,  // SuperDocViewerRef
    private widget: any
  ) {
    this.glossaryManager = new GlossaryManager();
    this.batchingEngine = new BatchingEngine();
    this.persistence = new TranslationPersistence();
    this.state = this.createInitialState();
  }
  
  /**
   * Check if there's an incomplete translation to resume
   */
  checkForIncompleteTranslation(): PersistedTranslationState | null {
    return this.persistence.load();
  }
  
  /**
   * Start document translation
   */
  async translate(options: TranslationOptions): Promise<void> {
    const { sourceLanguage, targetLanguage, onProgress, onComplete, onError } = options;
    this.isCancelled = false;
    
    try {
      // Initialize
      this.state.status = 'preparing';
      this.state.sourceLanguage = sourceLanguage;
      this.state.targetLanguage = targetLanguage;
      
      this.documentAccumulator = new DocumentAccumulator(
        this.viewer,
        onProgress || (() => {})
      );
      
      this.segmentTranslator = new SegmentTranslator(
        this.glossaryManager,
        this.widget
      );
      
      // Step 1: Get document content
      onProgress?.({ status: 'preparing', percentage: 0, currentSection: 'Parsing document...', completedBatches: 0, totalBatches: 0 });
      const documentJson = this.viewer.getContent();
      if (!documentJson) {
        throw new Error('Document is empty');
      }
      
      // Store original for restore option
      this.documentAccumulator.setOriginalDocument(documentJson);
      
      // Generate document ID for persistence
      const plainText = this.extractPlainText(documentJson);
      const documentId = TranslationPersistence.generateDocumentId(plainText);
      
      // Step 2: Extract glossary terms
      onProgress?.({ status: 'preparing', percentage: 5, currentSection: 'Building glossary...', completedBatches: 0, totalBatches: 0 });
      const terms = await this.glossaryManager.extractTerms(
        plainText,
        sourceLanguage,
        this.widget
      );
      console.log(`[Translation] Extracted ${terms.length} glossary terms`);
      
      // Step 3: Create batches
      onProgress?.({ status: 'preparing', percentage: 10, currentSection: 'Creating translation batches...', completedBatches: 0, totalBatches: 0 });
      const batches = this.batchingEngine.createBatches(documentJson);
      this.state.totalBatches = batches.length;
      console.log(`[Translation] Created ${batches.length} batches`);
      
      // Initialize persistence
      this.persistence.save({
        documentId,
        sourceLanguage,
        targetLanguage,
        startedAt: Date.now(),
        lastUpdated: Date.now(),
        totalBatches: batches.length,
        completedBatches: [],
        glossary: {},
        originalDocumentJson: documentJson,
      });
      
      // Step 4: Translate batches
      this.state.status = 'translating';
      const startTime = Date.now();
      
      for (let i = 0; i < batches.length; i++) {
        // Check for cancellation
        if (this.isCancelled) {
          console.log('[Translation] Cancelled by user');
          return;
        }
        
        const batch = batches[i];
        this.state.currentBatchIndex = i;
        
        // Update progress UI
        this.documentAccumulator.updateProgress(
          i,
          batches.length,
          batch.sectionTitle,
          startTime
        );
        
        // Translate batch
        console.log(`[Translation] Translating batch ${i + 1}/${batches.length}: ${batch.sectionTitle}`);
        const result = await this.segmentTranslator.translateBatch(
          batch,
          sourceLanguage,
          targetLanguage
        );
        
        if (!result.success) {
          console.error(`[Translation] Batch ${i} failed:`, result.error);
          this.state.status = 'error';
          this.state.error = result.error;
          this.state.failedBatchIndex = i;
          onError?.(result.error || 'Translation failed');
          return;
        }
        
        // Add to accumulator
        this.documentAccumulator.addBatch(result);
        
        // Update state
        this.state.completedBatches = i + 1;
        this.state.accumulatedTranslations.push(result);
        
        // Persist to localStorage after each batch
        this.persistence.save({
          documentId,
          sourceLanguage,
          targetLanguage,
          startedAt,
          lastUpdated: Date.now(),
          totalBatches: batches.length,
          completedBatches: this.documentAccumulator.getAccumulatedBatches(),
          glossary: this.glossaryManager.getGlossary(),
          originalDocumentJson: documentJson,
        });
        
        // Check if we should update the visible document (milestone)
        if (this.documentAccumulator.shouldUpdateDocument(i + 1, batches.length)) {
          await this.documentAccumulator.applyToDocument(i + 1, batches.length);
        }
      }
      
      // Final update
      await this.documentAccumulator.applyToDocument(batches.length, batches.length);
      
      // Complete - clear persistence
      this.state.status = 'completed';
      this.persistence.clear();
      
      onProgress?.({
        status: 'completed',
        percentage: 100,
        currentSection: 'Complete',
        completedBatches: batches.length,
        totalBatches: batches.length,
      });
      onComplete?.();
      
    } catch (error) {
      this.state.status = 'error';
      this.state.error = String(error);
      onError?.(String(error));
    }
  }
  
  /**
   * Resume translation from persisted state
   */
  async resume(
    persistedState: PersistedTranslationState,
    options: TranslationOptions
  ): Promise<void> {
    const { onProgress, onComplete, onError } = options;
    this.isCancelled = false;
    
    try {
      // Restore state
      this.state.status = 'translating';
      this.state.sourceLanguage = persistedState.sourceLanguage;
      this.state.targetLanguage = persistedState.targetLanguage;
      this.state.totalBatches = persistedState.totalBatches;
      
      // Restore glossary
      this.glossaryManager.restoreGlossary(persistedState.glossary);
      
      // Initialize accumulator with restored batches
      this.documentAccumulator = new DocumentAccumulator(
        this.viewer,
        onProgress || (() => {})
      );
      this.documentAccumulator.setOriginalDocument(persistedState.originalDocumentJson);
      this.documentAccumulator.restoreAccumulatedBatches(persistedState.completedBatches);
      
      this.segmentTranslator = new SegmentTranslator(
        this.glossaryManager,
        this.widget
      );
      
      // Recreate batches
      const batches = this.batchingEngine.createBatches(persistedState.originalDocumentJson);
      const startBatchIndex = persistedState.completedBatches.length;
      
      console.log(`[Translation] Resuming from batch ${startBatchIndex + 1}/${batches.length}`);
      
      // Continue from where we left off
      const startTime = Date.now() - (startBatchIndex * 20000);  // Estimate previous time
      
      for (let i = startBatchIndex; i < batches.length; i++) {
        if (this.isCancelled) return;
        
        const batch = batches[i];
        this.state.currentBatchIndex = i;
        
        this.documentAccumulator.updateProgress(
          i,
          batches.length,
          batch.sectionTitle,
          startTime
        );
        
        const result = await this.segmentTranslator.translateBatch(
          batch,
          persistedState.sourceLanguage,
          persistedState.targetLanguage
        );
        
        if (!result.success) {
          this.state.status = 'error';
          this.state.error = result.error;
          onError?.(result.error || 'Translation failed');
          return;
        }
        
        this.documentAccumulator.addBatch(result);
        this.state.completedBatches = i + 1;
        
        // Persist progress
        this.persistence.save({
          ...persistedState,
          lastUpdated: Date.now(),
          completedBatches: this.documentAccumulator.getAccumulatedBatches(),
          glossary: this.glossaryManager.getGlossary(),
        });
        
        if (this.documentAccumulator.shouldUpdateDocument(i + 1, batches.length)) {
          await this.documentAccumulator.applyToDocument(i + 1, batches.length);
        }
      }
      
      // Complete
      await this.documentAccumulator.applyToDocument(batches.length, batches.length);
      this.state.status = 'completed';
      this.persistence.clear();
      
      onProgress?.({
        status: 'completed',
        percentage: 100,
        currentSection: 'Complete',
        completedBatches: batches.length,
        totalBatches: batches.length,
      });
      onComplete?.();
      
    } catch (error) {
      this.state.status = 'error';
      this.state.error = String(error);
      onError?.(String(error));
    }
  }
  
  /**
   * Cancel translation
   * Returns the choice made by user: 'keep' or 'restore'
   */
  async cancel(choice: 'keep' | 'restore'): Promise<void> {
    this.isCancelled = true;
    
    if (choice === 'restore') {
      // Restore original document
      const persistedState = this.persistence.load();
      if (persistedState?.originalDocumentJson) {
        await this.viewer.setSource(persistedState.originalDocumentJson);
      }
    } else {
      // Keep current progress - apply all accumulated translations
      const batches = this.documentAccumulator.getAccumulatedBatches();
      if (batches.length > 0) {
        await this.documentAccumulator.applyToDocument(batches.length, this.state.totalBatches);
      }
    }
    
    // Clear persistence
    this.persistence.clear();
    this.state.status = 'idle';
  }
  
  /**
   * Discard incomplete translation (on page load, user chooses not to resume)
   */
  discardIncomplete(): void {
    this.persistence.clear();
  }
  
  /**
   * Get current translation state
   */
  getState(): TranslationState {
    return { ...this.state };
  }
  
  private extractPlainText(node: any): string {
    if (node.text) return node.text;
    if (!node.content) return '';
    return node.content.map((child: any) => this.extractPlainText(child)).join(' ');
  }
  
  private createInitialState(): TranslationState {
    return {
      status: 'idle',
      sourceLanguage: '',
      targetLanguage: '',
      totalBatches: 0,
      completedBatches: 0,
      currentBatchIndex: 0,
      glossary: {},
      accumulatedTranslations: [],
      completedBatchIndices: [],
    };
  }
}
```

### Step 7: Translation Tool

```typescript
// Add to superdoc-tools.ts

{
  name: 'translate_document',
  description: 'Translate the entire document to another language while preserving all formatting, layout, tables, and images. Supports documents up to 100+ pages with progressive translation.',
  input: {
    targetLanguage: {
      type: 'string',
      description: 'Target language code (e.g., "es" for Spanish, "fr" for French, "de" for German, "pt" for Portuguese, "zh" for Chinese)',
    },
    sourceLanguage: {
      type: 'string',
      description: 'Source language code (e.g., "en" for English). If not provided, will be auto-detected.',
    },
  },
  handler: async ({
    targetLanguage,
    sourceLanguage = 'en',
  }: {
    targetLanguage: string;
    sourceLanguage?: string;
  }) => {
    const editor = getEditor();
    const superdoc = getSuperdoc();
    const widget = (window as any).OkidokiWidget;
    
    if (!editor || !superdoc || !widget) {
      return { success: false, error: 'Editor or widget not ready' };
    }
    
    // Language display names
    const languageNames: Record<string, string> = {
      en: 'English', es: 'Spanish', fr: 'French', de: 'German',
      pt: 'Portuguese', it: 'Italian', zh: 'Chinese', ja: 'Japanese',
      ko: 'Korean', ar: 'Arabic', ru: 'Russian', hi: 'Hindi',
    };
    
    const targetName = languageNames[targetLanguage] || targetLanguage;
    const sourceName = languageNames[sourceLanguage] || sourceLanguage;
    
    // Set up progress notification
    widget.setToolNotification?.(`Preparing to translate to ${targetName}...`);
    
    const orchestrator = new TranslationOrchestrator(editor, superdoc, widget);
    
    return new Promise((resolve) => {
      orchestrator.translate({
        sourceLanguage,
        targetLanguage,
        onProgress: (progress) => {
          if (progress.status === 'translating') {
            const eta = progress.estimatedTimeRemaining 
              ? ` (${Math.ceil(progress.estimatedTimeRemaining / 60)}min remaining)`
              : '';
            widget.setToolNotification?.(
              `Translating: ${progress.percentage}% - ${progress.currentSection}${eta}`
            );
          }
        },
        onComplete: () => {
          widget.setToolNotification?.(null);
          resolve({
            success: true,
            message: `Document successfully translated from ${sourceName} to ${targetName}`,
            stats: orchestrator.getState(),
          });
        },
        onError: (error) => {
          widget.setToolNotification?.(null);
          resolve({
            success: false,
            error: `Translation failed: ${error}`,
            state: orchestrator.getState(),
            canResume: true,
          });
        },
      });
    });
  },
}
```

---

## UI Components

### Translation Progress Overlay

The overlay locks the document during translation and provides fluid progress feedback.

```tsx
// TranslationOverlay.tsx

interface TranslationOverlayProps {
  progress: TranslationProgress;
  sourceLanguage: string;
  targetLanguage: string;
  onCancel: () => void;
}

export function TranslationOverlay({ 
  progress, 
  sourceLanguage,
  targetLanguage,
  onCancel 
}: TranslationOverlayProps) {
  if (progress.status === 'idle' || progress.status === 'completed') return null;
  
  const languageNames: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    pt: 'Portuguese', it: 'Italian', zh: 'Chinese', ja: 'Japanese',
  };
  
  return (
    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 border border-slate-200">
        {/* Header with language info */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-lg font-medium text-slate-700">
            {languageNames[sourceLanguage] || sourceLanguage}
          </span>
          <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-lg font-medium text-slate-700">
            {languageNames[targetLanguage] || targetLanguage}
          </span>
        </div>
        
        {/* Animated progress bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div 
            className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        
        {/* Progress stats */}
        <div className="flex justify-between text-sm text-slate-500 mb-6">
          <span className="font-medium text-teal-600">{progress.percentage}%</span>
          <span>{progress.completedBatches} of {progress.totalBatches} sections</span>
        </div>
        
        {/* Current activity with subtle animation */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
            <span className="text-xs uppercase tracking-wide text-slate-400 font-medium">
              Currently translating
            </span>
          </div>
          <p className="text-slate-700 font-medium truncate">
            {progress.currentSection}
          </p>
        </div>
        
        {/* ETA */}
        {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
          <p className="text-center text-sm text-slate-400 mb-6">
            About {formatTimeRemaining(progress.estimatedTimeRemaining)} remaining
          </p>
        )}
        
        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="w-full py-3 px-4 border border-slate-200 rounded-lg text-slate-600 
                     hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium"
        >
          Cancel Translation
        </button>
      </div>
    </div>
  );
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return 'less than a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
}
```

### Translation Resume Dialog

Shown on page load when there's an incomplete translation.

```tsx
// TranslationResumeDialog.tsx

interface TranslationResumeDialogProps {
  persistedState: PersistedTranslationState;
  onResume: () => void;
  onStartFresh: () => void;
  onDismiss: () => void;
}

export function TranslationResumeDialog({
  persistedState,
  onResume,
  onStartFresh,
  onDismiss,
}: TranslationResumeDialogProps) {
  const completedPercentage = Math.round(
    (persistedState.completedBatches.length / persistedState.totalBatches) * 100
  );
  
  const languageNames: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    pt: 'Portuguese', it: 'Italian', zh: 'Chinese', ja: 'Japanese',
  };
  
  const timeAgo = getTimeAgo(persistedState.lastUpdated);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        {/* Icon */}
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-center mb-2">
          Incomplete Translation Found
        </h3>
        
        <p className="text-slate-600 text-center mb-6">
          You were translating this document to {languageNames[persistedState.targetLanguage]}.
        </p>
        
        {/* Progress info */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Progress</span>
            <span className="font-medium text-slate-700">{completedPercentage}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-teal-500 rounded-full"
              style={{ width: `${completedPercentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 text-center">
            {persistedState.completedBatches.length} of {persistedState.totalBatches} sections • Last active {timeAgo}
          </p>
        </div>
        
        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onResume}
            className="w-full py-3 px-4 bg-teal-600 text-white rounded-lg font-medium
                       hover:bg-teal-700 transition-colors"
          >
            Resume Translation
          </button>
          <button
            onClick={onStartFresh}
            className="w-full py-3 px-4 border border-slate-200 rounded-lg text-slate-600 font-medium
                       hover:bg-slate-50 transition-colors"
          >
            Start Over
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2 px-4 text-slate-400 text-sm hover:text-slate-600 transition-colors"
          >
            Dismiss (keep data for later)
          </button>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
```

### Translation Cancel Dialog

Shown when user clicks cancel during translation.

```tsx
// TranslationCancelDialog.tsx

interface TranslationCancelDialogProps {
  completedPercentage: number;
  completedSections: number;
  totalSections: number;
  onKeepProgress: () => void;
  onRestoreOriginal: () => void;
  onGoBack: () => void;
}

export function TranslationCancelDialog({
  completedPercentage,
  completedSections,
  totalSections,
  onKeepProgress,
  onRestoreOriginal,
  onGoBack,
}: TranslationCancelDialogProps) {
  const [choice, setChoice] = useState<'keep' | 'restore'>('keep');
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-2">
          Cancel Translation?
        </h3>
        
        <p className="text-slate-600 mb-6">
          Translation is {completedPercentage}% complete ({completedSections} of {totalSections} sections).
          What would you like to do?
        </p>
        
        {/* Options */}
        <div className="space-y-3 mb-6">
          <label 
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                       ${choice === 'keep' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <input
              type="radio"
              name="cancelChoice"
              value="keep"
              checked={choice === 'keep'}
              onChange={() => setChoice('keep')}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-slate-700">Keep translated content</p>
              <p className="text-sm text-slate-500">
                Sections 1-{completedSections} will remain translated. 
                Sections {completedSections + 1}-{totalSections} stay in original language.
              </p>
            </div>
          </label>
          
          <label 
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                       ${choice === 'restore' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <input
              type="radio"
              name="cancelChoice"
              value="restore"
              checked={choice === 'restore'}
              onChange={() => setChoice('restore')}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-slate-700">Restore original document</p>
              <p className="text-sm text-slate-500">
                Discard all translations and restore the original document.
              </p>
            </div>
          </label>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onGoBack}
            className="flex-1 py-3 px-4 border border-slate-200 rounded-lg text-slate-600 font-medium
                       hover:bg-slate-50 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={choice === 'keep' ? onKeepProgress : onRestoreOriginal}
            className="flex-1 py-3 px-4 bg-red-600 text-white rounded-lg font-medium
                       hover:bg-red-700 transition-colors"
          >
            Confirm Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Edge Cases and Handling

### 1. RTL Languages (Arabic, Hebrew)

```typescript
// After translation, if target is RTL:
if (['ar', 'he', 'fa', 'ur'].includes(targetLanguage)) {
  // Add RTL attribute to document
  superdoc.setDocumentDirection?.('rtl');
  
  // Or inject CSS
  const style = document.createElement('style');
  style.textContent = '.ProseMirror { direction: rtl; text-align: right; }';
  document.head.appendChild(style);
}
```

### 2. Language Expansion

Some translations are longer (Spanish ~20% longer than English):
- This is fine - text nodes just get longer
- Document may have more pages
- No special handling needed

### 3. Special Characters

UTF-8 handles all cases:
- Chinese: 你好世界
- Arabic: مرحبا بالعالم  
- Emoji: 👋🌍
- Mathematical: ∑∞∫

### 4. Tables with Complex Content

```typescript
// Tables are handled by recursive traversal
// Each cell is like a mini-document
function translateTableNode(tableNode: any): void {
  // Recursively translate text in each cell
  for (const row of tableNode.content) {
    for (const cell of row.content) {
      for (const para of cell.content) {
        translateParagraph(para);
      }
    }
  }
  // Table structure is unchanged
}
```

### 5. Crash Recovery and Resume

State is persisted to localStorage after each batch completes. On page load:

```typescript
// Check for incomplete translation on component mount
useEffect(() => {
  const orchestrator = new TranslationOrchestrator(viewer, widget);
  const incomplete = orchestrator.checkForIncompleteTranslation();
  
  if (incomplete) {
    // Show resume dialog
    setShowResumeDialog(true);
    setPersistedState(incomplete);
  }
}, []);

// User chooses to resume
const handleResume = async () => {
  setShowResumeDialog(false);
  await orchestrator.resume(persistedState, {
    onProgress: setProgress,
    onComplete: () => setShowOverlay(false),
    onError: handleError,
  });
};

// User chooses to start fresh
const handleStartFresh = () => {
  orchestrator.discardIncomplete();
  setShowResumeDialog(false);
  // Original document is already loaded
};

// User dismisses (keeps data for later)
const handleDismiss = () => {
  setShowResumeDialog(false);
  // Data remains in localStorage, can resume later
};
```

### 6. Cancellation Flow

```typescript
// User clicks cancel during translation
const handleCancelClick = () => {
  setShowCancelDialog(true);
};

// User confirms cancel with choice
const handleConfirmCancel = async (choice: 'keep' | 'restore') => {
  setShowCancelDialog(false);
  await orchestrator.cancel(choice);
  setShowOverlay(false);
};
```

---

## Implementation Phases

### Phase 1: Core Types and Persistence
**Priority: High | Effort: Low**

1. Implement `translation-types.ts` - All type definitions (including industry types)
2. Implement `translation-persistence.ts` - localStorage state management
3. Test persistence save/load/clear

### Phase 2: Industry Detection
**Priority: High | Effort: Low**

1. Implement `industry-detector.ts`
2. Define industry categories and classification prompts
3. Test with various document types (legal, medical, technical, etc.)
4. Handle "general" fallback for unclassified documents

### Phase 3: Batching Engine
**Priority: High | Effort: Medium**

1. Implement `batching-engine.ts` - Section-aware batching
2. Test with various document structures
3. Handle edge cases (no headings, nested content, tables)

### Phase 4: Glossary Manager
**Priority: High | Effort: Medium**

1. Implement `glossary-manager.ts` - Term extraction (industry-aware)
2. Build glossary injection prompts
3. Implement glossary merging (RAG + auto-extracted)
4. Test term consistency across batches

### Phase 5: RAG Terminology Lookup + Caching
**Priority: Medium | Effort: Medium**
**Note**: Requires `widget.ask({ searchKnowledgeBase: true })` to be deployed

1. Implement `terminology-cache.ts` - Two-level cache (memory + localStorage)
2. Implement `rag-terminology.ts` - Query with cache-first strategy
3. Query company knowledge base for glossaries/style guides
4. Parse RAG results into structured terms
5. Cache results with 7-day TTL
6. Graceful degradation when RAG unavailable
7. Test cache hit/miss scenarios

### Phase 6: Segment Translation
**Priority: High | Effort: High**

1. Implement `segment-translator.ts`
2. Build format-preserving prompts with industry context
3. Inject merged glossary into prompts
4. Implement response parsing and validation
5. Handle edge cases (mismatched segments, partial responses)

### Phase 7: Document Accumulator
**Priority: High | Effort: Medium**

1. Implement `document-accumulator.ts`
2. Milestone-based document updates
3. JSON rebuilding with translations
4. Test with partial translations

### Phase 8: UI Components
**Priority: High | Effort: Medium**

1. Implement `TranslationOverlay.tsx` - Progress with fluid animations
2. Implement `TranslationResumeDialog.tsx` - Incomplete translation recovery
3. Implement `TranslationCancelDialog.tsx` - Cancel with keep/restore choice
4. Integrate with existing page layout

### Phase 9: Orchestration
**Priority: High | Effort: High**

1. Implement `translation-orchestrator.ts`
2. Full translation flow: Industry Detection → RAG Lookup → Glossary → Translate
3. Resume capability from persisted state
4. Cancel handling with user choice
5. Add `translate_document` tool to superdoc-tools

### Phase 10: Polish and Edge Cases
**Priority: Medium | Effort: Medium**

1. RTL language support (Arabic, Hebrew)
2. Testing with large documents (50-100 pages)
3. Performance optimization if needed
4. Error handling improvements
5. Accessibility for overlay/dialogs
6. Test industry detection accuracy
7. Test RAG terminology integration end-to-end

---

## Performance Estimates

| Document Size | Batches | Est. Time | API Calls |
|---------------|---------|-----------|-----------|
| 10 pages | 3-4 | 30-60 sec | 5-6 |
| 25 pages | 7-10 | 1-2 min | 10-12 |
| 50 pages | 15-20 | 3-5 min | 18-22 |
| 100 pages | 25-35 | 5-10 min | 30-40 |

---

## Success Criteria

1. **Accuracy**: Translation quality matches single-batch translation (no consistency loss due to batching)
2. **Formatting**: 100% preservation of bold, italic, headings, lists, tables
3. **Scale**: Successfully translate 100-page document without failure
4. **Industry Awareness**: Correctly detects document industry with 80%+ accuracy
5. **Terminology Consistency**: Same terms translated identically throughout document
6. **RAG Integration**: Successfully retrieves and applies company terminology (when available)
7. **Progress UX**: User sees fluid progress overlay with accurate ETA (5-10 document updates)
8. **Crash Recovery**: Can resume from browser crash/close (localStorage persistence)
9. **User Control**: Can cancel and choose to keep progress or restore original
10. **Performance**: Complete 50-page document in under 5 minutes
11. **Document Integrity**: No position corruption or content loss during translation
12. **Graceful Degradation**: Works correctly even when RAG is unavailable

---

## Dependencies

No additional npm dependencies required. The implementation uses:
- `docx-diff-editor` (already installed) - for `getContent()` and `setSource()`
- Native `localStorage` API - for state persistence
- React hooks and components - for UI
- `OkidokiWidget.ask()` - for LLM calls (industry detection, translation)
- `OkidokiWidget.ask({ searchKnowledgeBase: true })` - for RAG terminology lookup (optional, graceful degradation when unavailable)

---

## References

- [docx-diff-editor package](https://www.npmjs.com/package/docx-diff-editor) - Document editing API
- [ProseMirror JSON format](https://prosemirror.net/docs/guide/#doc) - Document structure
- Internal: Widget `ask()` RAG Integration Plan (Okidoki project) - RAG terminology lookup API
- Best practices for neural machine translation batching

