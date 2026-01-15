/**
 * Translation Tools
 * Client-side tools for docx-diff-editor translation integration.
 */

import { DocumentState } from '../types';
import type { TranslationViewerRef } from '../components/TranslationViewer';
import {
  createTranslationOrchestrator,
  TranslationOrchestrator,
  TranslationProgress,
} from '@/lib/translation';
import { marked } from 'marked';
import type { EnrichedChange } from 'docx-diff-editor';

/**
 * Extract runs from a parsed ProseMirror JSON structure.
 * parseHtml returns the proper run structure with runProperties - we preserve this!
 * Each run contains text nodes with their marks AND the run has runProperties for DOCX export.
 */
function extractRunsFromParsed(node: any): any[] {
  const runs: any[] = [];
  
  const traverse = (n: any) => {
    if (!n) return;
    
    // Found a run - add it directly (preserves runProperties and text marks)
    if (n.type === 'run') {
      runs.push(n);
      return;
    }
    
    // Traverse children
    if (n.content && Array.isArray(n.content)) {
      for (const child of n.content) {
        traverse(child);
      }
    }
  };
  
  traverse(node);
  return runs;
}

/**
 * Get the combined text from a run's content (for logging/debugging)
 */
function getRunText(run: any): string {
  if (!run?.content) return '';
  return run.content
    .filter((n: any) => n.type === 'text')
    .map((n: any) => n.text || '')
    .join('');
}

// Cancel dialog resolver - used to connect UI dialog with orchestrator callback
let cancelChoiceResolver: ((choice: 'keep' | 'restore') => void) | null = null;

/**
 * Request translation cancellation
 * Call this when user clicks the cancel button
 */
export function requestTranslationCancel(): void {
  const orchestrator = getTranslationOrchestrator();
  orchestrator.cancel();
}

/**
 * Resolve the cancel choice after user picks from dialog
 * Call this when user clicks "Keep" or "Restore" in the cancel dialog
 */
export function resolveCancelChoice(choice: 'keep' | 'restore'): void {
  if (cancelChoiceResolver) {
    cancelChoiceResolver(choice);
    cancelChoiceResolver = null;
  }
}

// Virtual document structure for building content in memory
interface VirtualDocument {
  title: string;
  sections: Array<{ title: string; content: string }>;
}

// Complexity-based configuration for document length control
const COMPLEXITY_CONFIG = {
  simple: {
    maxTokens: 800,
    wordGuidance: '300-500 words total',
    sectionWordLimit: 150,
    targetSections: '2-3',
  },
  standard: {
    maxTokens: 2000,
    wordGuidance: '800-1200 words total',
    sectionWordLimit: 250,
    targetSections: '4-6',
  },
  complex: {
    maxTokens: 4000,
    wordGuidance: '1500-2500 words total',
    sectionWordLimit: 400,
    targetSections: '7-10',
  },
} as const;

interface ToolContext {
  viewerRef: React.MutableRefObject<TranslationViewerRef | null>;
  documentState: DocumentState;
  setDocumentState: React.Dispatch<React.SetStateAction<DocumentState>>;
  virtualDocumentRef?: React.MutableRefObject<VirtualDocument | null>;
}

// Global orchestrator instance for translation state management
let translationOrchestrator: TranslationOrchestrator | null = null;

// Event emitter for translation progress
type TranslationEventCallback = (progress: TranslationProgress) => void;
let progressCallback: TranslationEventCallback | null = null;

export function setTranslationProgressCallback(callback: TranslationEventCallback | null) {
  console.log('[TranslationTools] Setting progress callback:', callback ? 'function' : 'null');
  progressCallback = callback;
}

// Track applied changes within the current conversation turn to prevent infinite loops
// When the AI adds content and then reads it back, we need to exclude recently-added content
let appliedChangesInTurn: EnrichedChange[] = [];
let lastTurnTimestamp = 0;
const TURN_TIMEOUT_MS = 20000; // Consider a new turn after 20 seconds of inactivity

/**
 * Add new changes to the tracking array.
 * Called after each successful compareWith operation.
 */
function trackAppliedChanges(changes: EnrichedChange[]) {
  // Reset if too much time has passed (new conversation turn)
  const now = Date.now();
  if (now - lastTurnTimestamp > TURN_TIMEOUT_MS) {
    appliedChangesInTurn = [];
  }
  lastTurnTimestamp = now;
  
  // Add the new changes
  appliedChangesInTurn.push(...changes);
  console.log('[TranslationTools] Tracking', changes.length, 'new changes. Total:', appliedChangesInTurn.length);
}

/**
 * Reset the applied changes tracking (call at the start of a new user message/turn).
 */
export function resetAppliedChangesTracking() {
  appliedChangesInTurn = [];
  lastTurnTimestamp = Date.now();
  console.log('[TranslationTools] Reset applied changes tracking');
}

/**
 * Get a summary of changes already applied in this turn.
 * Used to inform the LLM about what has already been done.
 */
function getAppliedChangesSummary(): string {
  if (appliedChangesInTurn.length === 0) return '';
  
  const insertions = appliedChangesInTurn.filter(c => c.type === 'insertion');
  const replacements = appliedChangesInTurn.filter(c => c.type === 'replacement');
  const formatChanges = appliedChangesInTurn.filter(c => c.type === 'format');
  const deletions = appliedChangesInTurn.filter(c => c.type === 'deletion');
  
  const summaryParts: string[] = [];
  
  if (insertions.length > 0) {
    summaryParts.push(`- ${insertions.length} insertion(s): ${insertions.slice(0, 3).map(c => `"${(c.text || '').slice(0, 50)}${(c.text || '').length > 50 ? '...' : ''}"`).join(', ')}${insertions.length > 3 ? ` and ${insertions.length - 3} more` : ''}`);
  }
  if (replacements.length > 0) {
    summaryParts.push(`- ${replacements.length} replacement(s): ${replacements.slice(0, 3).map(c => `"${(c.oldText || '').slice(0, 30)}" → "${(c.newText || '').slice(0, 30)}"`).join(', ')}${replacements.length > 3 ? ` and ${replacements.length - 3} more` : ''}`);
  }
  if (formatChanges.length > 0) {
    summaryParts.push(`- ${formatChanges.length} format change(s)`);
  }
  if (deletions.length > 0) {
    summaryParts.push(`- ${deletions.length} deletion(s)`);
  }
  
  return summaryParts.join('\n');
}

/**
 * Get the texts of recently inserted content to exclude from segment list.
 * This prevents the AI from re-processing content it just added.
 */
function getRecentlyInsertedTexts(): Set<string> {
  const insertedTexts = new Set<string>();
  
  for (const change of appliedChangesInTurn) {
    if (change.type === 'insertion' && change.text) {
      // Add the full text
      insertedTexts.add(change.text.trim());
      // Also add normalized version (no extra spaces)
      insertedTexts.add(change.text.replace(/\s+/g, ' ').trim());
    }
    if (change.type === 'replacement' && change.newText) {
      insertedTexts.add(change.newText.trim());
      insertedTexts.add(change.newText.replace(/\s+/g, ' ').trim());
    }
  }
  
  return insertedTexts;
}

export function getTranslationOrchestrator(): TranslationOrchestrator {
  if (!translationOrchestrator) {
    translationOrchestrator = createTranslationOrchestrator();
  }
  return translationOrchestrator;
}

/**
 * Create client-side tools for translation integration
 */
export function createTranslationTools(context: ToolContext) {
  const { viewerRef, setDocumentState } = context;

  const getViewer = () => viewerRef.current;

  return [
    // 1. CREATE DOCUMENT (same as superdoc-example)
    {
      name: 'create_document',
      lockGroup: 'doc_mutation',
      parallel: false,
      description:
        'Create a NEW document from scratch, replacing any existing content entirely. ONLY use this when the user explicitly asks to CREATE, GENERATE, or WRITE a completely new document (e.g., "create a contract", "write a report", "generate a proposal"). Do NOT use this for modifying, updating, changing, or replacing parts of an existing document - use update_document for that instead.',
      input: {
        title: {
          type: 'string',
          description: 'A suitable title for the document',
        },
        description: {
          type: 'string',
          description:
            'Detailed description of what document to create. Include: document type, all parties/names/companies mentioned, specific values (dates, amounts, durations), required sections, any special clauses or requirements.',
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'standard', 'complex'],
          description:
            'simple: 1-3 sections. standard: 4-7 sections. complex: 8+ sections.',
        },
      },
      handler: async ({
        title,
        description,
        complexity,
      }: {
        title: string;
        description: string;
        complexity: 'simple' | 'standard' | 'complex';
      }) => {
        // Note: Duplicate call prevention is handled by Okidoki widget's groupId lock
        const viewer = getViewer();
        if (!viewer) return { success: false, error: 'Editor not ready' };

        const widget = (window as any).OkidokiWidget;
        if (!widget?.ask) {
          return { success: false, error: 'OkidokiWidget.ask not available' };
        }

        const language = widget.getLanguage?.() || 'en';
        const isSpanish = language === 'es';

        const today = new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const languageInstruction = isSpanish 
          ? 'IMPORTANTE: Generate ALL content in Spanish.'
          : '';

        const setNotification = (message: string | null) => {
          widget.setToolNotification?.(message);
        };

        const cleanHtml = (html: string): string => {
          if (typeof html !== 'string') return '';
          return html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
        };

        try {
          console.log(`[Tool] create_document: Starting (complexity: ${complexity})`);
          setNotification(isSpanish ? 'Creando documento...' : 'Creating document...');

          const config = COMPLEXITY_CONFIG[complexity];

          const result = await widget.ask({
            prompt: `Generate a document based on the description below.
Target length: ${config.wordGuidance}.
${languageInstruction}
Output ONLY HTML content. Use <h1> for title, <h2> for sections, <p> for paragraphs.`,
            context: `TODAY'S DATE: ${today}\nTITLE: ${title}\n\nDOCUMENT REQUEST:\n${description}`,
            maxTokens: config.maxTokens,
          });

          if (!result.success || !result.result) {
            setNotification(null);
            return { success: false, error: result.error || 'Failed to generate content' };
          }

          const html = cleanHtml(result.result);
          await viewer.setSource(html);
          setDocumentState({ createdByAI: true, userHasEdited: false });

          setNotification(null);
          return {
            success: true,
            summary: `Created "${title}"`,
          };
        } catch (error) {
          console.error('[Tool] create_document error:', error);
          setNotification(null);
          return { success: false, error: String(error) };
        }
      },
    },

    // 2. GET DOCUMENT CONTENT
    {
      name: 'get_document_content',
      description:
        'Read the current document to understand its content before translating or making changes.',
      input: {},
      handler: async () => {
        const viewer = getViewer();
        if (!viewer) return { success: false, error: 'Editor not ready' };

        try {
          const json = viewer.getContent();
          if (!json) {
            return { success: false, error: 'No content available' };
          }

          const extractText = (node: any): string => {
            if (!node) return '';
            if (node.text) return node.text;
            if (node.content) {
              return node.content.map((child: any) => extractText(child)).join(' ');
            }
            return '';
          };

          const extractHeadings = (node: any): Array<{ text: string; level: number }> => {
            const headings: Array<{ text: string; level: number }> = [];
            
            const traverse = (n: any) => {
              if (!n) return;
              if (n.type === 'heading' && n.attrs?.level) {
                const text = extractText(n);
                if (text.trim()) {
                  headings.push({ text: text.trim(), level: n.attrs.level });
                }
              }
              if (n.content) {
                n.content.forEach((child: any) => traverse(child));
              }
            };
            
            traverse(node);
            return headings;
          };

          const text = extractText(json);
          const headings = extractHeadings(json);

          return {
            content: text,
            wordCount: text.split(/\s+/).filter((w: string) => w.length > 0).length,
            sections: headings.map(h => `${'  '.repeat(h.level - 1)}${h.text}`),
          };
        } catch (error) {
          console.error('[Tool] get_document_content error:', error);
          return { success: false, error: String(error) };
        }
      },
    },

    // 3. TRANSLATE DOCUMENT
    {
      name: 'translate_document',
      description:
        'Translate a document to another language. USE THIS TOOL whenever the user asks to translate, convert, or change the document language. Triggers include: "translate this document", "translate to Spanish", "convert to French", "change language to German", "make it in English", etc. Preserves all formatting, tables, and structure. Source language is auto-detected. Handles large documents (50-100+ pages) with smart batching.',
      timeout: 600000, // 10 minutes (default: 60s) - needed for large document translations
      input: {
        target_language: {
          type: 'string',
          description: 'The target language name in English (e.g., "Spanish", "English", "French", "German", "Portuguese", "Italian", "Chinese", "Japanese")',
        },
      },
      handler: async ({
        target_language,
      }: {
        target_language: string;
      }) => {
        const viewer = getViewer();
        if (!viewer) return { success: false, error: 'Editor not ready' };

        const widget = (window as any).OkidokiWidget;
        if (!widget?.ask) {
          return { success: false, error: 'OkidokiWidget.ask not available' };
        }

        try {
          // TODO: Uncomment when docx-diff-editor properly implements acceptAllChanges
          // Accept any pending track changes before translation
          // viewer.acceptAllChanges();
          
          const documentJson = viewer.getContent();
          if (!documentJson) {
            return { success: false, error: 'No document to translate' };
          }

          const orchestrator = getTranslationOrchestrator();

          // Set notification for translation start
          const uiLanguage = widget.getLanguage?.() || 'en';
          const isSpanish = uiLanguage === 'es';
          widget.setToolNotification?.(
            isSpanish ? 'Iniciando traducción...' : 'Starting translation...'
          );

          // Start translation (source language is auto-detected)
          const result = await orchestrator.translate(
            documentJson,
            {
              targetLanguage: target_language,
              useRag: true,
            },
            widget,
            {
              onProgress: (progress) => {
                console.log(`[TranslationTools] onProgress called: ${progress.percentage}% (${progress.completedBatches}/${progress.totalBatches})`);
                
                // Update notification with progress
                const message = isSpanish
                  ? `Traduciendo: ${progress.percentage}% (${progress.currentSection || '...'})`
                  : `Translating: ${progress.percentage}% (${progress.currentSection || '...'})`;
                widget.setToolNotification?.(message);
                
                // Emit progress for overlay
                if (progressCallback) {
                  console.log('[TranslationTools] Calling progressCallback');
                  progressCallback(progress);
                } else {
                  console.warn('[TranslationTools] progressCallback is null!');
                }
              },
              onComplete: async () => {
                // Document already updated via milestone callbacks
                setDocumentState({ createdByAI: true, userHasEdited: false });
                widget.setToolNotification?.(null);
              },
              onError: (error, batchIndex) => {
                console.error(`[Tool] translate_document error at batch ${batchIndex}:`, error);
                widget.setToolNotification?.(null);
              },
              onCancelRequest: async () => {
                // Wait for user to make a choice via the cancel dialog
                // The dialog will call resolveCancelChoice() when user picks
                return new Promise<'keep' | 'restore'>((resolve) => {
                  cancelChoiceResolver = resolve;
                });
              },
            },
            (json) => {
              // Milestone update - refresh the visible document
              // Use updateContent to preserve the original DOCX template (styles, numbering, etc.)
              try {
                viewer.updateContent(json);
              } catch (err) {
                console.error('[Translation] updateContent failed:', err);
                console.error('[Translation] Original JSON:', JSON.stringify(documentJson, null, 2));
                console.error('[Translation] Translated JSON:', JSON.stringify(json, null, 2));
                throw err;
              }
            }
          );

          // Clear notification
          widget.setToolNotification?.(null);

          // Return appropriate message based on result
          if (result.status === 'completed') {
            return {
              success: true,
              message: `Translation from ${result.sourceLanguage} to ${result.targetLanguage} completed successfully.`,
            };
          } else if (result.status === 'cancelled') {
            const choiceMessage = result.userChoice === 'keep'
              ? 'User chose to keep the partial translation.'
              : 'User chose to restore the original document.';
            return {
              success: true,
              message: `Translation cancelled at ${result.progress}% progress. ${choiceMessage}`,
              cancelled: true,
              userChoice: result.userChoice,
            };
          } else {
            return {
              success: false,
              error: result.error || 'Translation failed',
            };
          }
        } catch (error) {
          console.error('[Tool] translate_document error:', error);
          widget.setToolNotification?.(null);
          return { success: false, error: String(error) };
        }
      },
    },

    // 4. UPDATE DOCUMENT - Surgical updates with support for new content (tables, etc.)
    {
      name: 'update_document',
      lockGroup: 'doc_mutation',
      parallel: false,
      description:
        'Use this tool whenever the user wants to UPDATE, CHANGE, MODIFY, EDIT, FIX, REPLACE, ADD, INSERT, DELETE, or REMOVE anything in the existing document. This is the PRIMARY tool for any document modification. Examples: "replace the date", "change the title", "update the name", "fix the typo", "add a paragraph", "modify the section", "insert a table". Use this for ANY partial change to the document - do NOT use create_document unless the user wants an entirely new document.',
      input: {
        request: {
          type: 'string',
          description: 'Description of what to change',
        },
      },
      handler: async ({ request }: { request: string }) => {
        const viewer = getViewer();
        if (!viewer) return { success: false, error: 'Editor not ready' };

        const widget = (window as any).OkidokiWidget;
        if (!widget?.ask) {
          return { success: false, error: 'OkidokiWidget.ask not available' };
        }

        const language = widget.getLanguage?.() || 'en';
        const isSpanish = language === 'es';
        const notificationText = isSpanish ? 'Actualizando documento...' : 'Updating document...';
        
        widget.setToolNotification?.(notificationText);

        try {
          const json = viewer.getContent();
          if (!json?.content) {
            widget.setToolNotification?.(null);
            return { success: false, error: 'Document is empty' };
          }

          // Build a structured view of the document for the LLM
          // Format: [node_index] node_type: content_preview
          const nodeDescriptions: string[] = [];
          const segments: Array<{
            id: string;
            nodeIndex: number;
            segmentIndex: number;
            text: string;
            marks: any[];
          }> = [];

          const extractText = (node: any): string => {
            if (!node) return '';
            if (node.text) return node.text;
            if (node.content) {
              return node.content.map((child: any) => extractText(child)).join('');
            }
            return '';
          };

          const getNodeType = (node: any): string => {
            if (node.type === 'heading') return `heading${node.attrs?.level || 1}`;
            if (node.type === 'table') return 'table';
            if (node.type === 'bulletList') return 'bullet_list';
            if (node.type === 'orderedList') return 'ordered_list';
            return node.type || 'unknown';
          };

          // Process all content nodes
          for (let i = 0; i < json.content.length; i++) {
            const node = json.content[i];
            const nodeType = getNodeType(node);
            const text = extractText(node);
            const preview = text.length > 80 ? text.slice(0, 80) + '...' : text;
            nodeDescriptions.push(`[${i}] ${nodeType}: "${preview}"`);

            // Extract segments for text replacement
            if (node.content) {
              let segmentIndex = 0;
              const extractSegments = (content: any[]) => {
                for (const child of content) {
                  if (child.type === 'text' && child.text) {
                    segments.push({
                      id: `n${i}_s${segmentIndex}`,
                      nodeIndex: i,
                      segmentIndex: segmentIndex++,
                      text: child.text,
                      marks: child.marks || [],
                    });
                  } else if (child.content) {
                    extractSegments(child.content);
                  }
                }
              };
              extractSegments(node.content);
            }
          }

          const today = new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          // Note: We previously excluded recently inserted content from the segment list,
          // but this prevented the AI from fixing its own mistakes (e.g., moving misplaced content).
          // Now we show ALL segments to the AI, allowing it to modify any content including its own additions.
          const filteredSegments = segments;
          
          // Get summary of changes already applied in this turn
          const appliedChangesSummary = getAppliedChangesSummary();

          // Build segment list for text replacements (using filtered segments)
          const segmentList = filteredSegments.map(s => `[${s.id}] "${s.text}"`).join('\n');
          
          // Build the applied changes section if there are any (informational, not prohibitive)
          const appliedChangesSection = appliedChangesSummary 
            ? `\n\nCHANGES ALREADY APPLIED IN THIS SESSION:
${appliedChangesSummary}
Note: The above changes were just made. Only make additional changes if the user's request requires more work.`
            : '';

          // Ask LLM for changes, node replacements, and insertions
          const result = await widget.ask({
            prompt: `You are editing a document. The user wants to make changes.

DOCUMENT STRUCTURE (node index, type, preview):
${nodeDescriptions.join('\n')}${appliedChangesSection}

TEXT SEGMENTS (for text replacements):
${segmentList}

You can make four types of changes:

1. TEXT REPLACEMENTS - Edit text within existing document structures
   Use the segment ID (e.g., n0_s0) and provide the new text.
   Only return segments that actually need to change.
   IMPORTANT: Do NOT use markdown syntax (no -, *, #, etc.) - the document structure already exists.
   You can include HTML formatting for styles:
   - Bold: <strong>text</strong>
   - Italic: <em>text</em>
   - Color: <span style="color:red;">text</span> or <span style="color:#ff0000;">text</span>
   - Underline: <u>text</u>
   - Combine: <strong><span style="color:blue;">text</span></strong>
   Plain text without HTML is also fine for simple text changes.

2. NODE REPLACEMENTS - Replace an entire node with different structure
   Use when you need to change the structure (e.g., convert paragraph to list, paragraph to table).
   Specify the node index to replace and provide the new content as Markdown.
   One node can become multiple nodes.

3. NODE DELETIONS - Remove nodes from the document
   Use ONLY to remove content that YOU previously added in an incorrect position, or that the user explicitly asks to delete.
   NEVER delete original document content unless the user specifically requests it.
   Specify the node indices to delete.

4. CONTENT INSERTIONS - Add new content after a node
   Specify where to insert (after which node index, -1 for start) and provide content as Markdown.
   Use for adding new sections, tables, lists without replacing existing content.

MARKDOWN SYNTAX (for node replacements and insertions only):
- Tables: | Header | Header |\\n|---|---|\\n| Cell | Cell |
- Paragraphs: Just text
- Lists: - item or 1. item
- Headings: ## Heading

IMPORTANT:
- For TEXT REPLACEMENTS: Do NOT use markdown list syntax (- or *) - just provide the text content
- For NODE REPLACEMENTS and INSERTIONS: Use full Markdown syntax
- Return empty arrays if no changes of that type are needed`,
            context: `TODAY'S DATE: ${today}

USER REQUEST: ${request}`,
            output: widget.helpers ? {
              replacements: widget.helpers.array(
                widget.helpers.object({
                  id: widget.helpers.string('Segment ID (e.g., n0_s0)'),
                  newText: widget.helpers.string('The new text - plain text or HTML formatting, NO markdown'),
                })
              ),
              nodeReplacements: widget.helpers.array(
                widget.helpers.object({
                  nodeIndex: widget.helpers.number('The node index to replace'),
                  markdown: widget.helpers.string('New content as Markdown (can produce multiple nodes)'),
                })
              ),
              nodeDeletions: widget.helpers.array(
                widget.helpers.object({
                  nodeIndex: widget.helpers.number('The node index to delete'),
                  reason: widget.helpers.string('Brief reason for deletion (e.g., "misplaced content", "user requested removal")'),
                })
              ),
              insertions: widget.helpers.array(
                widget.helpers.object({
                  afterNodeIndex: widget.helpers.number('Insert after this node index (-1 for start)'),
                  markdown: widget.helpers.string('Content to insert as Markdown'),
                })
              ),
            } : undefined,
          });

          if (!result.success || !result.result) {
            widget.setToolNotification?.(null);
            return { success: false, error: 'Failed to determine changes' };
          }

          const replacements = (result.result.replacements || []) as Array<{ id: string; newText: string }>;
          const nodeReplacements = (result.result.nodeReplacements || []) as Array<{ nodeIndex: number; markdown: string }>;
          const nodeDeletions = (result.result.nodeDeletions || []) as Array<{ nodeIndex: number; reason: string }>;
          const insertions = (result.result.insertions || []) as Array<{ afterNodeIndex: number; markdown: string }>;
          
          if (replacements.length === 0 && nodeReplacements.length === 0 && nodeDeletions.length === 0 && insertions.length === 0) {
            widget.setToolNotification?.(null);
            return { success: true, message: 'No changes needed.' };
          }

          // Apply changes to a deep clone of the document
          const updatedJson = JSON.parse(JSON.stringify(json));
          let changesApplied = 0;

          // 1. Apply text replacements (with HTML formatting support)
          // KEY INSIGHT: parseHtml returns runs with proper runProperties for DOCX export.
          // We must preserve the run structure, not just extract text nodes!
          if (replacements.length > 0) {
            // Store parsed runs for each replacement
            // If the content has HTML, we store the full run structure from parseHtml
            // If plain text, we create a simple run with the text
            const parsedReplacements = new Map<string, { runs: any[]; isPlainText: boolean }>();
            // Track processed text (after stripping list prefixes) for plain text replacements
            const processedTextMap = new Map<string, string>();
            
            for (const change of replacements) {
              console.log('[Tool] update_document - Processing replacement:', change.id, 'newText:', change.newText);
              
              // Strip markdown list prefixes from text replacements
              // The LLM should NOT use markdown in replacements, but if it does, strip the prefix
              // since the list structure already exists in the document
              let processedText = change.newText;
              const listPrefixMatch = processedText.match(/^[\-\*]\s+([\s\S]+)$/);
              if (listPrefixMatch) {
                console.log('[Tool] update_document - Stripping markdown list prefix from replacement');
                processedText = listPrefixMatch[1];
              }
              // Also strip numbered list prefixes (e.g., "1. text")
              const numberedListMatch = processedText.match(/^\d+\.\s+([\s\S]+)$/);
              if (numberedListMatch) {
                console.log('[Tool] update_document - Stripping numbered list prefix from replacement');
                processedText = numberedListMatch[1];
              }
              
              // Store the processed text for later use
              processedTextMap.set(change.id, processedText);
              
              // Check if the newText contains HTML tags
              const hasHtml = /<[^>]+>/.test(processedText);
              // Check if the processedText contains markdown formatting:
              // - Headings: lines starting with # (1-6 hashes)
              // - Bold: **text** or __text__
              // - Italic: *text* or _text_
              // Note: We already stripped list prefixes above, so we don't check for them here
              const hasMarkdown = /^#{1,6}\s+.+/m.test(processedText) || // headings
                                  /\*\*[^*]+\*\*/.test(processedText) || // bold **
                                  /__[^_]+__/.test(processedText) ||     // bold __
                                  /(?<!\*)\*(?!\*)[^*]+\*(?!\*)/.test(processedText) || // italic *
                                  /(?<!_)_(?!_)[^_]+_(?!_)/.test(processedText);        // italic _
              console.log('[Tool] update_document - Has HTML:', hasHtml, 'Has Markdown:', hasMarkdown);
              
              if (hasHtml || hasMarkdown) {
                try {
                  // Convert markdown to HTML if needed, then parse
                  let htmlContent = processedText;
                  if (hasMarkdown && !hasHtml) {
                    // Convert markdown to HTML using marked
                    console.log('[Tool] update_document - Converting markdown to HTML');
                    const markedResult = await marked(processedText);
                    
                    // Null check for marked result
                    if (!markedResult) {
                      console.warn('[Tool] update_document - marked returned null/undefined, using original text');
                      parsedReplacements.set(change.id, { runs: [], isPlainText: true });
                      continue;
                    }
                    
                    htmlContent = markedResult;
                    // Since we're in the `hasMarkdown && !hasHtml` branch, the input was pure markdown
                    // The marked library only generates plain <p> tags without attributes
                    // So we can safely remove all <p> and </p> tags - they're all from marked
                    // We replace </p> with space to preserve separation between paragraphs
                    htmlContent = htmlContent
                      .replace(/<p>/g, '')        // Remove all <p> tags (all are from marked, no attributes)
                      .replace(/<\/p>/g, ' ')     // Replace </p> with space to separate paragraphs
                      .replace(/\s+/g, ' ')       // Normalize whitespace
                      .trim();
                    console.log('[Tool] update_document - Converted HTML:', htmlContent);
                  }
                  
                  // Parse the HTML - this returns the full structure with runs and runProperties
                  console.log('[Tool] update_document - Calling parseHtml with:', htmlContent);
                  const parsed = await viewer.parseHtml(htmlContent);
                  console.log('[Tool] update_document - Parsed HTML result:', parsed);
                  
                  if (!parsed) {
                    throw new Error('parseHtml returned null/undefined');
                  }
                  
                  // Extract runs from the parsed structure - these have proper runProperties!
                  const runs = extractRunsFromParsed(parsed);
                  console.log('[Tool] update_document - Extracted', runs.length, 'runs');
                  runs.forEach((run, i) => {
                    console.log(`[Tool] update_document - Run ${i}: "${getRunText(run)}" runProperties:`, JSON.stringify(run.attrs?.runProperties || {}));
                  });
                  
                  if (runs.length > 0) {
                    parsedReplacements.set(change.id, { runs, isPlainText: false });
                  } else {
                    // Fallback: create a simple run with the text
                    console.log('[Tool] update_document - No runs found, using as plain text');
                    parsedReplacements.set(change.id, {
                      runs: [],
                      isPlainText: true,
                    });
                  }
                } catch (err) {
                  console.error('[Tool] update_document - Failed to parse HTML/Markdown. Error:', err);
                  parsedReplacements.set(change.id, { runs: [], isPlainText: true });
                }
              } else {
                // Plain text, no formatting - will just update the text content
                console.log('[Tool] update_document - Plain text, no HTML or Markdown formatting');
                parsedReplacements.set(change.id, { runs: [], isPlainText: true });
              }
            }

            // Build a map of segment ID to processed text for plain text replacements
            const originalTextMap = new Map<string, string>();
            for (const change of replacements) {
              const parsed = parsedReplacements.get(change.id);
              if (parsed?.isPlainText) {
                // Use the processed text (with list prefixes stripped)
                originalTextMap.set(change.id, processedTextMap.get(change.id) || change.newText);
              }
            }

            // Apply replacements at the RUN level (not text node level)
            // This preserves the runProperties structure needed for DOCX export
            const applyChanges = (paragraphContent: any[], nodeIndex: number) => {
              let segmentIndex = 0;
              
              // Collect run positions with their segment IDs
              // A run contains one or more text nodes - we track by the text content
              const runPositions: Array<{
                parentArray: any[];
                runIndex: number;
                textNodeIndex: number;
                segmentId: string;
                originalRun: any;
              }> = [];
              
              // Traverse to find runs containing text
              const collectRuns = (nodes: any[], parentArray: any[]) => {
                for (let i = 0; i < nodes.length; i++) {
                  const node = nodes[i];
                  
                  if (node.type === 'run' && node.content) {
                    // Find text nodes in this run
                    for (let j = 0; j < node.content.length; j++) {
                      const child = node.content[j];
                      if (child.type === 'text' && child.text) {
                        runPositions.push({
                          parentArray: parentArray,
                          runIndex: i,
                          textNodeIndex: j,
                          segmentId: `n${nodeIndex}_s${segmentIndex}`,
                          originalRun: node,
                        });
                        segmentIndex++;
                      }
                    }
                  } else if (node.type === 'text' && node.text) {
                    // Text node directly in paragraph (not in a run)
                    runPositions.push({
                      parentArray: parentArray,
                      runIndex: i,
                      textNodeIndex: -1, // Indicates this is not inside a run
                      segmentId: `n${nodeIndex}_s${segmentIndex}`,
                      originalRun: null,
                    });
                    segmentIndex++;
                  } else if (node.content) {
                    // Recurse into other container types
                    collectRuns(node.content, node.content);
                  }
                }
              };
              
              collectRuns(paragraphContent, paragraphContent);
              
              // Process runs that have been replaced - group by run to avoid double processing
              const processedRunIndices = new Set<string>();
              
              // Apply replacements in reverse order to maintain valid indices
              for (let p = runPositions.length - 1; p >= 0; p--) {
                const pos = runPositions[p];
                const replacement = parsedReplacements.get(pos.segmentId);
                
                if (!replacement) continue;
                
                // Create a unique key for this run position
                const runKey = `${nodeIndex}_${pos.runIndex}`;
                if (processedRunIndices.has(runKey)) continue;
                processedRunIndices.add(runKey);
                
                console.log('[Tool] update_document - Applying replacement to', pos.segmentId);
                
                if (replacement.isPlainText) {
                  // Plain text replacement - just update the text content
                  const newText = originalTextMap.get(pos.segmentId) || '';
                  
                  if (pos.originalRun && pos.textNodeIndex >= 0) {
                    // Update text inside the run
                    console.log('[Tool] update_document - Plain text update in run:', newText.slice(0, 50) + '...');
                    pos.originalRun.content[pos.textNodeIndex].text = newText;
                  } else if (pos.textNodeIndex === -1) {
                    // Direct text node in paragraph
                    console.log('[Tool] update_document - Plain text update direct:', newText.slice(0, 50) + '...');
                    pos.parentArray[pos.runIndex].text = newText;
                  }
                  changesApplied++;
                } else {
                  // HTML replacement - replace the entire run with the new runs from parseHtml
                  const newRuns = replacement.runs;
                  
                  if (newRuns.length > 0) {
                    console.log('[Tool] update_document - Replacing run with', newRuns.length, 'new runs');
                    
                    // Deep clone the new runs to avoid mutation issues
                    const clonedRuns = JSON.parse(JSON.stringify(newRuns));
                    
                    // If the original run had additional properties we want to preserve
                    // (like rsidR, rsidRPr), we can merge them here
                    if (pos.originalRun?.attrs) {
                      for (const run of clonedRuns) {
                        if (run.attrs) {
                          // Preserve original rsid values if not set
                          if (pos.originalRun.attrs.rsidR && !run.attrs.rsidR) {
                            run.attrs.rsidR = pos.originalRun.attrs.rsidR;
                          }
                          if (pos.originalRun.attrs.rsidRPr && !run.attrs.rsidRPr) {
                            run.attrs.rsidRPr = pos.originalRun.attrs.rsidRPr;
                          }
                        }
                      }
                    }
                    
                    // Replace the original run with the new runs
                    pos.parentArray.splice(pos.runIndex, 1, ...clonedRuns);
                    changesApplied++;
                    
                    console.log('[Tool] update_document - Runs after replacement:', 
                      clonedRuns.map((r: any) => `"${getRunText(r)}" (bold: ${r.attrs?.runProperties?.bold || false})`).join(', '));
                  }
                }
              }
            };

            for (let i = 0; i < updatedJson.content.length; i++) {
              const node = updatedJson.content[i];
              if (node.content) {
                applyChanges(node.content, i);
              }
            }
          }

          // 2. Apply node replacements (replace entire nodes with new structure)
          // Process in reverse order to maintain indices
          if (nodeReplacements.length > 0) {
            // Sort by nodeIndex descending so we replace from end to start
            const sortedNodeReplacements = [...nodeReplacements].sort((a, b) => b.nodeIndex - a.nodeIndex);

            for (const replacement of sortedNodeReplacements) {
              try {
                console.log('[Tool] update_document - Node replacement at index', replacement.nodeIndex);
                
                // Convert markdown to HTML
                const html = await marked(replacement.markdown);
                
                // Convert HTML to ProseMirror JSON using the editor's parseHtml method
                const parsedContent = await viewer.parseHtml(html);
                
                if (parsedContent?.content && parsedContent.content.length > 0) {
                  // Replace the node at the specified index with the new node(s)
                  // One node can become multiple nodes
                  updatedJson.content.splice(replacement.nodeIndex, 1, ...parsedContent.content);
                  changesApplied += parsedContent.content.length;
                  console.log('[Tool] update_document - Replaced node with', parsedContent.content.length, 'new node(s)');
                }
              } catch (err) {
                console.error('[Tool] update_document node replacement error:', err);
                // Continue with other replacements
              }
            }
          }

          // 3. Apply node deletions (process in reverse order to maintain indices)
          if (nodeDeletions.length > 0) {
            // Sort by nodeIndex descending so we delete from end to start
            const sortedDeletions = [...nodeDeletions].sort((a, b) => b.nodeIndex - a.nodeIndex);

            for (const deletion of sortedDeletions) {
              try {
                const nodeIndex = deletion.nodeIndex;
                if (nodeIndex >= 0 && nodeIndex < updatedJson.content.length) {
                  console.log('[Tool] update_document - Deleting node at index', nodeIndex, 'reason:', deletion.reason);
                  updatedJson.content.splice(nodeIndex, 1);
                  changesApplied++;
                } else {
                  console.warn('[Tool] update_document - Invalid node index for deletion:', nodeIndex);
                }
              } catch (err) {
                console.error('[Tool] update_document node deletion error:', err);
                // Continue with other deletions
              }
            }
          }

          // 4. Apply content insertions (process in reverse order to maintain indices)
          if (insertions.length > 0) {
            // Sort by afterNodeIndex descending so we insert from end to start
            const sortedInsertions = [...insertions].sort((a, b) => b.afterNodeIndex - a.afterNodeIndex);

            for (const insertion of sortedInsertions) {
              try {
                // Convert markdown to HTML
                const html = await marked(insertion.markdown);
                
                // Convert HTML to ProseMirror JSON using the editor's parseHtml method (async)
                const parsedContent = await viewer.parseHtml(html);
                
                if (parsedContent?.content && parsedContent.content.length > 0) {
                  // Insert the new nodes at the specified position
                  const insertAt = insertion.afterNodeIndex + 1;
                  updatedJson.content.splice(insertAt, 0, ...parsedContent.content);
                  changesApplied += parsedContent.content.length;
                }
              } catch (err) {
                console.error('[Tool] update_document insertion error:', err);
                // Continue with other insertions
              }
            }
          }

          // Use compareWith to show track changes (including format changes)
          console.log('[Tool] update_document - Using compareWith');
          await viewer.compareWith(updatedJson);
          
          // Track the changes that were applied to prevent infinite loops
          // This allows us to exclude recently-inserted content from future segment lists
          const enrichedChanges = viewer.getEnrichedChangesContext();
          if (enrichedChanges.length > 0) {
            trackAppliedChanges(enrichedChanges);
            console.log('[Tool] update_document - Tracked', enrichedChanges.length, 'enriched changes');
          }

          widget.setToolNotification?.(null);
          
          const replacementCount = replacements.length;
          const nodeReplacementCount = nodeReplacements.length;
          const nodeDeletionCount = nodeDeletions.length;
          const insertionCount = insertions.length;
          
          // Build detailed message
          const parts: string[] = [];
          if (replacementCount > 0) parts.push(`${replacementCount} text replacement(s)`);
          if (nodeReplacementCount > 0) parts.push(`${nodeReplacementCount} node replacement(s)`);
          if (nodeDeletionCount > 0) parts.push(`${nodeDeletionCount} deletion(s)`);
          if (insertionCount > 0) parts.push(`${insertionCount} insertion(s)`);
          
          let message = `Applied ${changesApplied} change(s) with track changes`;
          if (parts.length > 0) {
            message += ` (${parts.join(', ')})`;
          }
          
          return {
            success: true,
            message: message + '.',
            changes: changesApplied,
            replacements: replacementCount,
            nodeReplacements: nodeReplacementCount,
            nodeDeletions: nodeDeletionCount,
            insertions: insertionCount,
          };
        } catch (error) {
          console.error('[Tool] update_document error:', error);
          widget.setToolNotification?.(null);
          return { success: false, error: String(error) };
        }
      },
    },
  ];
}
