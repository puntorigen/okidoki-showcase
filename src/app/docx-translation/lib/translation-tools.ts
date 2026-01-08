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
  documentCreationStateRef?: React.MutableRefObject<{
    inProgress: boolean;
    completedSuccessfully: boolean;
    lastCreatedTitle?: string;
  }>;
  virtualDocumentRef?: React.MutableRefObject<VirtualDocument | null>;
}

// Global orchestrator instance for translation state management
let translationOrchestrator: TranslationOrchestrator | null = null;

// Event emitter for translation progress
type TranslationEventCallback = (progress: TranslationProgress) => void;
let progressCallback: TranslationEventCallback | null = null;

export function setTranslationProgressCallback(callback: TranslationEventCallback | null) {
  progressCallback = callback;
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
      description:
        'Create a new document from scratch. Provide a detailed description of what to create. Include ALL relevant details from the conversation: parties involved, specific terms, dates, amounts, requirements, section names, etc.',
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
        const creationState = context.documentCreationStateRef?.current || {
          inProgress: false,
          completedSuccessfully: false,
          lastCreatedTitle: undefined,
        };

        if (creationState.inProgress) {
          return {
            success: false,
            error: 'ALREADY_IN_PROGRESS: Document creation is still running.',
          };
        }

        if (creationState.completedSuccessfully) {
          return {
            success: true,
            message: `ALREADY_COMPLETED: Document "${creationState.lastCreatedTitle}" was already created.`,
          };
        }

        const viewer = getViewer();
        if (!viewer) return { success: false, error: 'Editor not ready' };

        const widget = (window as any).OkidokiWidget;
        if (!widget?.ask) {
          return { success: false, error: 'OkidokiWidget.ask not available' };
        }

        const language = widget.getLanguage?.() || 'en';
        const isSpanish = language === 'es';

        if (context.documentCreationStateRef) {
          context.documentCreationStateRef.current = {
            inProgress: true,
            completedSuccessfully: false,
            lastCreatedTitle: undefined,
          };
        }

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
            if (context.documentCreationStateRef) {
              context.documentCreationStateRef.current = {
                inProgress: false,
                completedSuccessfully: false,
                lastCreatedTitle: undefined,
              };
            }
            setNotification(null);
            return { success: false, error: result.error || 'Failed to generate content' };
          }

          const html = cleanHtml(result.result);
          await viewer.setSource(html);
          setDocumentState({ createdByAI: true, userHasEdited: false });

          if (context.documentCreationStateRef) {
            context.documentCreationStateRef.current = {
              inProgress: false,
              completedSuccessfully: true,
              lastCreatedTitle: title,
            };
          }

          setNotification(null);
          return {
            success: true,
            summary: `Created "${title}"`,
          };
        } catch (error) {
          console.error('[Tool] create_document error:', error);
          setNotification(null);
          if (context.documentCreationStateRef) {
            context.documentCreationStateRef.current = {
              inProgress: false,
              completedSuccessfully: false,
              lastCreatedTitle: undefined,
            };
          }
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
        'Translate the entire document from one language to another while preserving all formatting, tables, and structure. This tool handles large documents (50-100+ pages) with smart batching and term consistency.',
      input: {
        source_language: {
          type: 'string',
          description: 'Source language (e.g., "English", "Spanish", "French")',
        },
        target_language: {
          type: 'string',
          description: 'Target language to translate to (e.g., "Spanish", "English", "French")',
        },
      },
      handler: async ({
        source_language,
        target_language,
      }: {
        source_language: string;
        target_language: string;
      }) => {
        const viewer = getViewer();
        if (!viewer) return { success: false, error: 'Editor not ready' };

        const widget = (window as any).OkidokiWidget;
        if (!widget?.ask) {
          return { success: false, error: 'OkidokiWidget.ask not available' };
        }

        try {
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

          // Start translation
          await orchestrator.translate(
            documentJson,
            {
              sourceLanguage: source_language,
              targetLanguage: target_language,
              useRag: true,
            },
            widget,
            {
              onProgress: (progress) => {
                // Update notification with progress
                const message = isSpanish
                  ? `Traduciendo: ${progress.percentage}% (${progress.currentSection || '...'})`
                  : `Translating: ${progress.percentage}% (${progress.currentSection || '...'})`;
                widget.setToolNotification?.(message);
                
                // Emit progress for overlay
                progressCallback?.(progress);
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
                // This will be called when user cancels
                // Return 'keep' to keep partial translation, 'restore' to restore original
                return 'keep';
              },
            },
            async (json) => {
              // Milestone update - refresh the visible document
              await viewer.setSource(json);
            }
          );

          return {
            success: true,
            message: `Translation from ${source_language} to ${target_language} complete.`,
          };
        } catch (error) {
          console.error('[Tool] translate_document error:', error);
          widget.setToolNotification?.(null);
          return { success: false, error: String(error) };
        }
      },
    },

    // 4. UPDATE DOCUMENT - Surgical updates using segment mapping
    {
      name: 'update_document',
      description:
        'Make any change to the existing document. Use for: replacing placeholders, updating text, fixing typos, modifying sections, etc.',
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

          // Extract segments with position info
          const segments: Array<{
            id: string;
            nodeIndex: number;
            segmentIndex: number;
            text: string;
            marks: any[];
          }> = [];

          const extractSegments = (nodes: any[], nodeIndex: number) => {
            let segmentIndex = 0;
            const extract = (content: any[]) => {
              for (const child of content) {
                if (child.type === 'text' && child.text) {
                  segments.push({
                    id: `n${nodeIndex}_s${segmentIndex}`,
                    nodeIndex,
                    segmentIndex: segmentIndex++,
                    text: child.text,
                    marks: child.marks || [],
                  });
                } else if (child.content) {
                  extract(child.content);
                }
              }
            };
            extract(nodes);
          };

          // Process all content nodes
          for (let i = 0; i < json.content.length; i++) {
            const node = json.content[i];
            if (node.content) {
              extractSegments(node.content, i);
            }
          }

          if (segments.length === 0) {
            widget.setToolNotification?.(null);
            return { success: false, error: 'Document has no text content' };
          }

          // Build segment list for LLM
          const segmentList = segments.map(s => `[${s.id}] "${s.text}"`).join('\n');

          const today = new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          // Ask LLM for only the changes needed
          const result = await widget.ask({
            prompt: `You are given a document as a list of text segments. The user wants to make a change.

CRITICAL: Return ONLY the segments that need to change. Do NOT return unchanged segments.

For each segment that needs modification, return its ID and the new text.`,
            context: `TODAY'S DATE: ${today}

USER REQUEST: ${request}

DOCUMENT SEGMENTS:
${segmentList}`,
            output: widget.helpers ? {
              changes: widget.helpers.array(
                widget.helpers.object({
                  id: widget.helpers.string('Segment ID (e.g., n0_s0)'),
                  newText: widget.helpers.string('The new text for this segment'),
                })
              ),
            } : undefined,
          });

          if (!result.success || !result.result?.changes) {
            widget.setToolNotification?.(null);
            return { success: false, error: 'Failed to determine changes' };
          }

          const changes = result.result.changes as Array<{ id: string; newText: string }>;
          
          if (changes.length === 0) {
            widget.setToolNotification?.(null);
            return { success: true, message: 'No changes needed.' };
          }

          // Create a map of changes by segment ID
          const changeMap = new Map<string, string>();
          for (const change of changes) {
            changeMap.set(change.id, change.newText);
          }

          // Apply changes to a deep clone of the document
          const updatedJson = JSON.parse(JSON.stringify(json));
          let changesApplied = 0;

          const applyChanges = (content: any[], nodeIndex: number) => {
            let segmentIndex = 0;
            const apply = (nodes: any[]) => {
              for (const node of nodes) {
                if (node.type === 'text' && node.text) {
                  const id = `n${nodeIndex}_s${segmentIndex}`;
                  const newText = changeMap.get(id);
                  if (newText !== undefined) {
                    node.text = newText;
                    changesApplied++;
                  }
                  segmentIndex++;
                } else if (node.content) {
                  apply(node.content);
                }
              }
            };
            apply(content);
          };

          for (let i = 0; i < updatedJson.content.length; i++) {
            const node = updatedJson.content[i];
            if (node.content) {
              applyChanges(node.content, i);
            }
          }

          // Use compareWith to show track changes
          await viewer.compareWith(updatedJson);

          widget.setToolNotification?.(null);
          return {
            success: true,
            message: `Applied ${changesApplied} change(s) with track changes.`,
            changes: changesApplied,
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
