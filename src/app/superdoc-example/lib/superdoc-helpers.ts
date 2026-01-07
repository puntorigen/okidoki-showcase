import { DocumentHeading, DocumentSummary } from '../types';

/**
 * Extract all headings from the document with their hierarchy
 */
export function getDocumentHeadings(editor: any): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  
  if (!editor?.state?.doc) return headings;

  editor.state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'paragraph') {
      const styleId =
        node.attrs?.paragraphProperties?.styleId ||
        node.attrs?.styleId ||
        '';

      const match = styleId.match(/^Heading(\d+)$/i);

      if (match) {
        headings.push({
          level: parseInt(match[1], 10),
          text: node.textContent,
          pos,
          nodeSize: node.nodeSize,
        });
      }
    }
    return true; // Continue traversing
  });

  return headings;
}

/**
 * Get plain text from editor
 */
export function getEditorText(editor: any): string {
  if (!editor?.state?.doc) return '';
  
  // Try different methods to get text
  if (typeof editor.getText === 'function') {
    return editor.getText() || '';
  }
  
  // Fallback: extract text from doc nodes
  let text = '';
  editor.state.doc.descendants((node: any) => {
    if (node.isText) {
      text += node.text;
    } else if (node.isBlock) {
      text += '\n';
    }
    return true;
  });
  
  return text.trim();
}

/**
 * Get document summary (word count + sections)
 */
export function getDocumentSummary(editor: any): DocumentSummary {
  if (!editor) {
    return { wordCount: 0, sections: [] };
  }

  const text = getEditorText(editor);
  const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;
  const sections = getDocumentHeadings(editor);

  return { wordCount, sections };
}

/**
 * Find a heading by text and return the position to insert after its section
 * Returns the position RIGHT BEFORE the next sibling heading (so content goes between sections)
 */
export function findInsertPositionAfterSection(
  editor: any,
  sectionTitle: string
): { pos: number; foundSection: string } | null {
  const headings = getDocumentHeadings(editor);

  console.log('[findInsertPosition] Looking for section:', sectionTitle);
  console.log('[findInsertPosition] Available headings:', headings.map(h => `"${h.text}" at pos ${h.pos}`));

  const targetIndex = headings.findIndex(h =>
    h.text.toLowerCase().includes(sectionTitle.toLowerCase())
  );

  if (targetIndex === -1) {
    console.log('[findInsertPosition] Section not found');
    return null;
  }

  const targetHeading = headings[targetIndex];
  console.log('[findInsertPosition] Found target:', targetHeading.text, 'at index', targetIndex);

  // Find next heading at same or higher level (sibling or parent, not child)
  const nextHeading = headings
    .slice(targetIndex + 1)
    .find(h => h.level <= targetHeading.level);

  // Position to insert:
  // - If there's a next sibling heading, insert RIGHT AT its position (pushes it down)
  // - Otherwise, insert at end of document
  if (nextHeading) {
    console.log('[findInsertPosition] Next sibling heading:', nextHeading.text, 'at pos', nextHeading.pos);
    // Insert AT the next heading's position - this will push it down
    return { pos: nextHeading.pos, foundSection: targetHeading.text };
  }

  console.log('[findInsertPosition] No next sibling, inserting at end');
  return { pos: editor.state.doc.content.size, foundSection: targetHeading.text };
}

/**
 * Get selected text from editor
 */
export function getSelectedText(editor: any): string | null {
  if (!editor?.state) return null;

  const { selection } = editor.state;
  
  if (selection.empty) return null;

  return editor.state.doc.textBetween(selection.from, selection.to, ' ');
}

/**
 * Check if there's an active selection
 */
export function hasSelection(editor: any): boolean {
  return editor?.state?.selection && !editor.state.selection.empty;
}

