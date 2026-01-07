/**
 * Document Parser - Extract structured sections from the editor
 * 
 * This module provides utilities to parse document content into
 * structured sections for easier manipulation by AI tools.
 */

export interface ParsedSection {
  headingText: string;
  headingLevel: number;
  headingPos: number;
  contentStart: number;
  contentEnd: number;
  plainText: string;
}

/**
 * Parse the document into sections based on headings
 */
export function parseDocumentSections(editor: any): ParsedSection[] {
  if (!editor?.state?.doc) return [];

  const sections: ParsedSection[] = [];
  const headings: { text: string; level: number; pos: number; nodeSize: number }[] = [];

  // First pass: collect all headings
  editor.state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'paragraph') {
      const styleId =
        node.attrs?.paragraphProperties?.styleId ||
        node.attrs?.styleId ||
        '';

      const match = styleId.match(/^Heading(\d+)$/i);

      if (match) {
        headings.push({
          text: node.textContent,
          level: parseInt(match[1], 10),
          pos,
          nodeSize: node.nodeSize,
        });
      }
    }
    return true;
  });

  // If no headings, return empty array
  if (headings.length === 0) {
    return [];
  }

  // Second pass: create sections with content ranges
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    
    const contentStart = heading.pos + heading.nodeSize;
    const contentEnd = nextHeading ? nextHeading.pos : editor.state.doc.content.size;
    
    // Extract plain text content for this section
    let plainText = '';
    editor.state.doc.nodesBetween(contentStart, contentEnd, (node: any) => {
      if (node.isText) {
        plainText += node.text;
      } else if (node.isBlock) {
        plainText += '\n';
      }
      return true;
    });

    sections.push({
      headingText: heading.text,
      headingLevel: heading.level,
      headingPos: heading.pos,
      contentStart,
      contentEnd,
      plainText: plainText.trim(),
    });
  }

  return sections;
}

/**
 * Find a section by title (fuzzy match)
 */
export function findSectionByTitle(
  sections: ParsedSection[],
  targetTitle: string
): ParsedSection | null {
  const normalizedTarget = targetTitle.toLowerCase().trim();

  // First try exact match
  let section = sections.find(
    s => s.headingText.toLowerCase().trim() === normalizedTarget
  );
  if (section) return section;

  // Then try contains match
  section = sections.find(
    s => s.headingText.toLowerCase().includes(normalizedTarget) ||
         normalizedTarget.includes(s.headingText.toLowerCase())
  );
  if (section) return section;

  // Finally try word-based match
  const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 2);
  section = sections.find(s => {
    const sectionWords = s.headingText.toLowerCase().split(/\s+/);
    return targetWords.some(tw => 
      sectionWords.some(sw => sw.includes(tw) || tw.includes(sw))
    );
  });

  return section || null;
}

/**
 * Get all section titles
 */
export function getSectionTitles(sections: ParsedSection[]): string[] {
  return sections.map(s => s.headingText);
}

/**
 * Find section index by title
 */
export function findSectionIndex(
  sections: ParsedSection[],
  targetTitle: string
): number {
  const normalizedTarget = targetTitle.toLowerCase().trim();

  // First try exact match
  let idx = sections.findIndex(
    s => s.headingText.toLowerCase().trim() === normalizedTarget
  );
  if (idx !== -1) return idx;

  // Then try contains match
  idx = sections.findIndex(
    s => s.headingText.toLowerCase().includes(normalizedTarget) ||
         normalizedTarget.includes(s.headingText.toLowerCase())
  );
  if (idx !== -1) return idx;

  // Finally try word-based match
  const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 2);
  idx = sections.findIndex(s => {
    const sectionWords = s.headingText.toLowerCase().split(/\s+/);
    return targetWords.some(tw => 
      sectionWords.some(sw => sw.includes(tw) || tw.includes(sw))
    );
  });

  return idx;
}

