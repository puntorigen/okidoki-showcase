import { DocumentState } from '../types';
import { marked } from 'marked';
import type { SuperDocViewerRef } from '../components/SuperDocViewer';

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
  viewerRef: React.MutableRefObject<SuperDocViewerRef | null>;
  documentState: DocumentState;
  setDocumentState: React.Dispatch<React.SetStateAction<DocumentState>>;
  // Ref to persist document creation state across re-renders
  documentCreationStateRef?: React.MutableRefObject<{
    inProgress: boolean;
    completedSuccessfully: boolean;
    lastCreatedTitle?: string;
  }>;
  // Ref to persist virtual document state for updates
  virtualDocumentRef?: React.MutableRefObject<VirtualDocument | null>;
}

/**
 * Create client-side tools for docx-diff-editor integration
 * 
 * Simplified to just 3 essential tools:
 * 1. create_document - Create a new document from scratch
 * 2. get_document_content - Read the current document content
 * 3. update_document - Make ANY change to the document (smart AI-powered)
 */
export function createSuperDocTools(context: ToolContext) {
  const { viewerRef, setDocumentState } = context;

  const getViewer = () => viewerRef.current;

  return [
    // 1. CREATE DOCUMENT
    {
      name: 'create_document',
      description:
        'Create a new document from scratch. Provide a detailed description of what to create. Include ALL relevant details from the conversation: parties involved, specific terms, dates, amounts, requirements, section names, etc. The more detail you provide, the better the generated document.',
      input: {
        title: {
          type: 'string',
          description: 'A suitable title for the document',
        },
        description: {
          type: 'string',
          description:
            'Detailed description of what document to create. Include: document type, all parties/names/companies mentioned, specific values (dates, amounts, durations), required sections, any special clauses or requirements from the conversation.',
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'standard', 'complex'],
          description:
            'simple: 1-3 sections, short documents. standard: 4-7 sections, medium documents. complex: 8+ sections or detailed legal/technical documents.',
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
            error: 'ALREADY_IN_PROGRESS: Document creation is still running. Do NOT retry.',
          };
        }

        if (creationState.completedSuccessfully) {
          return {
            success: true,
            message: `ALREADY_COMPLETED: Document "${creationState.lastCreatedTitle}" was already created successfully. Use update_document if changes are needed.`,
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
          ? 'IMPORTANTE: Generate ALL content in Spanish (section titles, paragraphs, everything).'
          : '';

        const notifications = {
          creating: isSpanish ? 'Creando documento...' : 'Creating document...',
          generatingOutline: isSpanish ? 'Generando estructura...' : 'Generating outline...',
          generatingSection: (n: number, total: number) => 
            isSpanish ? `Generando sección ${n}/${total}...` : `Generating section ${n}/${total}...`,
          finalizing: isSpanish ? 'Finalizando documento...' : 'Finalizing document...',
        };

        const setNotification = (message: string | null) => {
          widget.setToolNotification?.(message);
        };

        const cleanHtml = (html: string): string => {
          if (typeof html !== 'string') return '';
          return html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
        };

        const renderVirtualDoc = (doc: VirtualDocument): string => {
          let html = `<h1>${doc.title}</h1>\n`;
          doc.sections.forEach((section, i) => {
            html += `<h2>${i + 1}. ${section.title}</h2>\n${section.content}\n`;
          });
          return html;
        };

        try {
          console.log(`[Tool] create_document: Starting (complexity: ${complexity})`);
          setNotification(notifications.creating);

          const config = COMPLEXITY_CONFIG[complexity];

          if (complexity === 'simple') {
            console.log('[Tool] create_document: Using single-shot generation');

            const result = await widget.ask({
              prompt: `Generate a CONCISE document based on the description below.
Target length: ${config.wordGuidance}. Use ${config.targetSections} sections maximum.
${languageInstruction}
Output ONLY HTML content. No JSON, no markdown code blocks.
Use <h1> for title, <h2> for sections, <h3> for subsections, <p> for paragraphs.
Start directly with <h1> tag. Be brief and focused.`,
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
            
            // Use setSource to load the content
            await viewer.setSource(html);
            setDocumentState({ createdByAI: true, userHasEdited: false });

            const sectionCount = (html.match(/<h2[^>]*>/gi) || []).length;

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
              summary: `Created "${title}" with ${sectionCount} sections`,
            };
          }

          // STANDARD/COMPLEX MODE
          console.log('[Tool] create_document: Using progressive generation');
          setNotification(notifications.generatingOutline);

          const virtualDoc: VirtualDocument = {
            title: title || 'Document',
            sections: [],
          };

          console.log('[Tool] create_document: Generating outline...');
          const outlineResult = await widget.ask({
            prompt: `Create an outline for this document. List the section titles that should be included.
${languageInstruction}
Output ONLY a numbered list of section titles, one per line. No additional text.
${isSpanish ? 'Ejemplo:' : 'Example:'}
1. ${isSpanish ? 'Introducción' : 'Introduction'}
2. ${isSpanish ? 'Alcance' : 'Scope'}
3. ${isSpanish ? 'Términos' : 'Terms'}`,
            context: `DOCUMENT: ${title}\n\nREQUEST:\n${description}`,
          });

          if (!outlineResult.success || !outlineResult.result) {
            return { success: false, error: 'Failed to generate outline' };
          }

          const outlineText = outlineResult.result;
          const sectionTitles = outlineText
            .split('\n')
            .map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').trim())
            .filter((title: string) => title.length > 0);

          if (sectionTitles.length === 0) {
            return { success: false, error: 'No sections found in outline' };
          }

          console.log(`[Tool] create_document: Outline has ${sectionTitles.length} sections`);

          let keyTerms: string[] = [];
          let previousSectionTitle = '';

          for (let i = 0; i < sectionTitles.length; i++) {
            const sectionTitle = sectionTitles[i];
            console.log(`[Tool] create_document: Generating section ${i + 1}/${sectionTitles.length}: ${sectionTitle}`);
            setNotification(notifications.generatingSection(i + 1, sectionTitles.length));

            const sectionResult = await widget.ask({
              prompt: `Generate CONCISE content for section "${sectionTitle}" of this document.
Keep to approximately ${config.sectionWordLimit} words or less. Be direct and avoid unnecessary elaboration.
${languageInstruction}
Output ONLY the section content as HTML (paragraphs, lists, etc). Do NOT include the section heading.
Start directly with <p> or other content tags.`,
              context: `DOCUMENT: ${title}
TODAY'S DATE: ${today}
ALL SECTIONS: ${sectionTitles.map((t: string, idx: number) => `${idx + 1}. ${t}`).join(', ')}
${keyTerms.length > 0 ? `KEY TERMS (use consistently): ${keyTerms.join(', ')}` : ''}
${previousSectionTitle ? `PREVIOUS SECTION: ${previousSectionTitle}` : ''}
ORIGINAL REQUEST: ${description}`,
              maxTokens: config.sectionWordLimit * 3,
            });

            if (sectionResult.success && sectionResult.result) {
              const sectionHtml = cleanHtml(sectionResult.result);

              virtualDoc.sections.push({
                title: sectionTitle,
                content: sectionHtml,
              });

              if (i === 0) {
                console.log('[Tool] create_document: Extracting key terms...');
                const termsResult = await widget.ask({
                  prompt: `List the key terms, names, or entities from this text that should be used consistently throughout the document. Output ONLY a comma-separated list.`,
                  context: sectionHtml,
                });
                if (termsResult.success && termsResult.result) {
                  keyTerms = termsResult.result
                    .split(',')
                    .map((t: string) => t.trim())
                    .filter(Boolean)
                    .slice(0, 10);
                  console.log(`[Tool] create_document: Key terms: ${keyTerms.join(', ')}`);
                }
              }

              previousSectionTitle = sectionTitle;
            } else {
              virtualDoc.sections.push({
                title: sectionTitle,
                content: `<p><em>[Content generation incomplete - please review]</em></p>`,
              });
            }
          }

          setNotification(notifications.finalizing);
          console.log('[Tool] create_document: Writing final document to editor...');
          const finalHtml = renderVirtualDoc(virtualDoc);
          
          // Use setSource to load the content
          await viewer.setSource(finalHtml);
          setDocumentState({ createdByAI: true, userHasEdited: false });

          console.log(`[Tool] create_document: Complete (${virtualDoc.sections.length} sections)`);

          if (context.virtualDocumentRef) {
            context.virtualDocumentRef.current = virtualDoc;
            console.log(`[Tool] create_document: Stored virtual document state (${virtualDoc.sections.length} sections)`);
          }

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
            message: `SUCCESS: "${title}" created with ${virtualDoc.sections.length} sections. Document is complete and ready. Do NOT call create_document again.`,
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
        'Read the current document to understand its content before making changes. Returns the document text, sections/headings, and word count.',
      input: {},
      handler: async () => {
        const viewer = getViewer();
        if (!viewer) return { success: false, error: 'Editor not ready' };

        try {
          const json = viewer.getContent();
          if (!json) {
            return { success: false, error: 'No content available' };
          }

          // Extract text content from ProseMirror JSON
          const extractText = (node: any): string => {
            if (!node) return '';
            if (node.text) return node.text;
            if (node.content) {
              return node.content.map((child: any) => extractText(child)).join(' ');
            }
            return '';
          };

          // Extract headings from ProseMirror JSON
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
          const sections = headings.map(
            h => `${'  '.repeat(h.level - 1)}${h.text}`
          );

          return {
            content: text,
            wordCount: text.split(/\s+/).filter((w: string) => w.length > 0).length,
            sections,
          };
        } catch (error) {
          console.error('[Tool] get_document_content error:', error);
          return { success: false, error: String(error) };
        }
      },
    },

    // 3. UPDATE DOCUMENT
    {
      name: 'update_document',
      description:
        'Make ANY change to the existing document. This intelligent tool analyzes the document and applies the requested changes with track changes visualization. Use for: replacing placeholders, updating dates, changing text, fixing typos, updating names/companies, modifying sections, replacing words, adding content, restructuring, etc. ALWAYS use this tool for document modifications instead of creating a new document.',
      input: {
        request: {
          type: 'string',
          description: 'Natural language description of what to change (e.g., "replace date placeholders with today\'s date", "change company name from X to Y", "update all dates to March 15, 2026", "add a new section about termination", "improve the Signatures section layout")',
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
        
        const setNotification = (message: string | null) => {
          widget.setToolNotification?.(message);
        };

        setNotification(notificationText);

        try {
          // Get current document content
          const json = viewer.getContent();
          if (!json) {
            setNotification(null);
            return { success: false, error: 'Document is empty' };
          }

          // Extract text for analysis
          const extractText = (node: any): string => {
            if (!node) return '';
            if (node.text) return node.text;
            if (node.content) {
              return node.content.map((child: any) => extractText(child)).join(' ');
            }
            return '';
          };

          const documentText = extractText(json);
          
          if (!documentText.trim()) {
            setNotification(null);
            return { success: false, error: 'Document is empty' };
          }

          const today = new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          // Get the virtual document state if available
          const virtualDoc = context.virtualDocumentRef?.current;

          const renderVirtualDoc = (doc: VirtualDocument): string => {
            let html = `<h1>${doc.title}</h1>\n`;
            doc.sections.forEach((section, i) => {
              html += `<h2>${i + 1}. ${section.title}</h2>\n${section.content}\n`;
            });
            return html;
          };

          const ensureHtml = (content: string): string => {
            let cleaned = content
              .replace(/^```html?\s*/i, '')
              .replace(/\s*```$/i, '')
              .trim();
            
            if (cleaned.match(/^<[a-z]/i)) {
              return cleaned;
            }
            
            const html = marked.parse(cleaned, { async: false }) as string;
            return html.trim();
          };

          console.log('[Tool] update_document: Generating modified document...');
          
          // Generate the modified document
          let currentHtml: string;
          
          if (virtualDoc) {
            currentHtml = renderVirtualDoc(virtualDoc);
          } else {
            // If no virtual doc, we need to reconstruct from current content
            // For now, ask the AI to modify based on the text content
            currentHtml = `<p>${documentText}</p>`;
          }

          const modifyResult = await widget.ask({
            prompt: `Apply the user's requested changes to this document and return the COMPLETE modified document as HTML.

CRITICAL: Output ONLY valid HTML. NO markdown, NO plain text.
- Use <h1> for document title (only one)
- Use <h2> for section headings
- Use <h3> for subsection headings
- Use <p> for paragraphs
- Use <ul>/<ol> and <li> for lists
- Use <strong> for bold, <em> for italic
- Do NOT use markdown syntax like # or * or **
- Start directly with <h1> tag

Keep all existing content that should not change. Only modify what the user requested.`,
            context: `TODAY'S DATE: ${today}

USER REQUEST: ${request}

CURRENT DOCUMENT HTML:
${currentHtml}`,
          });
          
          if (!modifyResult.success || !modifyResult.result) {
            setNotification(null);
            return { success: false, error: 'Failed to generate modified document' };
          }
          
          const modifiedHtml = ensureHtml(modifyResult.result);
          
          // Use compareWith to show track changes
          console.log('[Tool] update_document: Applying changes with track changes...');
          const comparisonResult = await viewer.compareWith(modifiedHtml);
          
          // Update virtual document state if we have one
          if (context.virtualDocumentRef) {
            context.virtualDocumentRef.current = null; // Reset - user may have made changes
          }

          setNotification(null);
          return {
            success: true,
            message: `Document has been updated. The changes requested ("${request.substring(0, 50)}${request.length > 50 ? '...' : ''}") have been applied with track changes.`,
            method: 'compare_with',
            summary: 'Document modified with track changes visualization',
            changes: comparisonResult?.totalChanges || 0,
          };
        } catch (error) {
          console.error('[Tool] update_document error:', error);
          setNotification(null);
          return { success: false, error: String(error) };
        }
      },
    },
  ];
}
