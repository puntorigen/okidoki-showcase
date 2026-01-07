'use client';

/**
 * SuperDoc Viewer Component
 * Uses docx-diff-editor for document viewing/editing with track changes support.
 */

import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { DocxDiffEditor, DocxDiffEditorRef } from 'docx-diff-editor';
import 'docx-diff-editor/styles.css';
import { useLanguage } from '../lib/LanguageContext';
import { DocumentState, DocumentSummary } from '../types';

const AUTHOR = {
  name: 'Okidoki User',
  email: 'user@okidoki.chat',
};

interface SuperDocViewerProps {
  onSummaryUpdate: (summary: DocumentSummary) => void;
  onDocumentStateChange: React.Dispatch<React.SetStateAction<DocumentState>>;
  documentState: DocumentState;
}

export interface SuperDocViewerRef {
  setSource: (content: string) => Promise<void>;
  compareWith: (content: string) => Promise<any>;
  getContent: () => any;
  exportDocx: () => Promise<Blob>;
  resetComparison: () => void;
  isReady: () => boolean;
}

const SuperDocViewer = forwardRef<SuperDocViewerRef, SuperDocViewerProps>(
  ({ onSummaryUpdate, onDocumentStateChange }, ref) => {
    const { t } = useLanguage();
    const editorRef = useRef<DocxDiffEditorRef>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      setSource: async (content: string) => {
        if (editorRef.current) {
          await editorRef.current.setSource(content);
        }
      },
      compareWith: async (content: string) => {
        if (editorRef.current) {
          return await editorRef.current.compareWith(content);
        }
        return null;
      },
      getContent: () => {
        if (editorRef.current) {
          return editorRef.current.getContent();
        }
        return null;
      },
      exportDocx: async () => {
        if (editorRef.current) {
          return await editorRef.current.exportDocx();
        }
        throw new Error('Editor not ready');
      },
      resetComparison: () => {
        if (editorRef.current) {
          editorRef.current.resetComparison();
        }
      },
      isReady: () => {
        return editorRef.current !== null && !isLoading;
      },
    }));

    const handleReady = () => {
      console.log('[DocxDiffEditor] Ready');
      setIsLoading(false);
    };

    const handleSourceLoaded = (json: any) => {
      console.log('[DocxDiffEditor] Source loaded');
      // Update summary when source is loaded
      const textContent = extractTextContent(json);
      const wordCount = textContent.split(/\s+/).filter((w: string) => w.length > 0).length;
      const sections = extractSections(json);
      
      onSummaryUpdate({
        wordCount,
        sections,
      });
      
      onDocumentStateChange({ createdByAI: true, userHasEdited: false });
    };

    const handleComparisonComplete = (result: any) => {
      console.log('[DocxDiffEditor] Comparison complete:', result);
    };

    const handleError = (err: Error) => {
      console.error('[DocxDiffEditor] Error:', err);
      setError(err.message);
    };

    // Helper to extract text content from ProseMirror JSON
    const extractTextContent = (json: any): string => {
      if (!json) return '';
      if (json.text) return json.text;
      if (json.content) {
        return json.content.map((node: any) => extractTextContent(node)).join(' ');
      }
      return '';
    };

    // Helper to extract sections from ProseMirror JSON
    const extractSections = (json: any): Array<{ text: string; level: number; pos: number; nodeSize: number }> => {
      const sections: Array<{ text: string; level: number; pos: number; nodeSize: number }> = [];
      let currentPos = 0;
      
      const traverse = (node: any) => {
        if (!node) return;
        if (node.type === 'heading' && node.attrs?.level) {
          const text = extractTextContent(node);
          if (text.trim()) {
            sections.push({ 
              text: text.trim(), 
              level: node.attrs.level,
              pos: currentPos,
              nodeSize: text.length + 2, // Approximate node size
            });
          }
        }
        if (node.content) {
          node.content.forEach((child: any) => {
            traverse(child);
            currentPos += (child.nodeSize || child.text?.length || 1);
          });
        }
      };
      
      traverse(json);
      return sections;
    };

    // Show error state
    if (error) {
      return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden items-center justify-center">
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">{t('failedToLoad')}</h3>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600">{t('loadingSuperDoc')}</p>
            </div>
          </div>
        )}

        <DocxDiffEditor
          ref={editorRef}
          initialSource="<p></p>"
          showToolbar
          showRulers={false}
          author={AUTHOR}
          onReady={handleReady}
          onSourceLoaded={handleSourceLoaded}
          onComparisonComplete={handleComparisonComplete}
          onError={handleError}
          className="flex-1 min-h-0 flex flex-col"
          toolbarClassName="border-b border-slate-200 bg-slate-50 flex-shrink-0"
          editorClassName="flex-1 min-h-0 overflow-auto"
        />
      </div>
    );
  }
);

SuperDocViewer.displayName = 'SuperDocViewer';

export default SuperDocViewer;
