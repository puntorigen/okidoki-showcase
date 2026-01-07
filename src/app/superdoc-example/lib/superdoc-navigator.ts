/**
 * Navigate to sections/headings in SuperDoc (works with PresentationEditor)
 * NOTE: Uses npm package version of SuperDoc
 */

interface Heading {
  level: number;
  text: string;
  pos: number;
  nodeSize: number;
}

interface LayoutSnapshot {
  layout?: {
    pageSize?: { h: number; w: number };
    pages?: unknown[];
  };
}

interface LayoutOptions {
  virtualization?: {
    gap?: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperDocInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PresentationEditorInstance = any;

export class SuperDocNavigator {
  private superdoc: SuperDocInstance;

  constructor(superdoc: SuperDocInstance) {
    this.superdoc = superdoc;
  }

  get editor(): EditorInstance | null {
    return this.superdoc?.activeEditor ?? null;
  }

  /**
   * Get the PresentationEditor instance
   */
  getPresentationEditor(): PresentationEditorInstance | null {
    const doc = this.superdoc?.superdocStore?.documents?.[0];
    return doc?.getPresentationEditor?.() ?? null;
  }

  /**
   * Get all headings in the document
   */
  getHeadings(): Heading[] {
    if (!this.editor?.state?.doc) return [];

    const headings: Heading[] = [];
    this.editor.state.doc.descendants((node: { type: { name: string }; attrs?: { paragraphProperties?: { styleId?: string } }; textContent: string; nodeSize: number }, pos: number) => {
      if (node.type.name === 'paragraph') {
        const styleId = node.attrs?.paragraphProperties?.styleId || '';
        const match = styleId.match(/^Heading(\d+)$/i);
        if (match) {
          headings.push({
            level: parseInt(match[1], 10),
            text: node.textContent.trim(),
            pos,
            nodeSize: node.nodeSize,
          });
        }
      }
      return true;
    });
    return headings;
  }

  /**
   * Wait for a page element to be mounted in the DOM (handles virtualization)
   * @private
   */
  private async _waitForPageMount(
    container: HTMLElement,
    pageIndex: number,
    timeout = 2000
  ): Promise<Element | null> {
    const startTime = performance.now();

    return new Promise((resolve) => {
      const check = () => {
        // Use the correct selector that matches PresentationEditor's DOM structure
        const pageEl = container.querySelector(
          `.superdoc-page[data-page-index="${pageIndex}"]`
        );
        if (pageEl) {
          resolve(pageEl);
          return;
        }

        if (performance.now() - startTime > timeout) {
          resolve(null);
          return;
        }

        requestAnimationFrame(check);
      };

      check();
    });
  }

  /**
   * Scroll using flow mode (uses TipTap/editor commands)
   * @private
   */
  private async _scrollFlowMode(pos: number): Promise<boolean> {
    if (!this.editor?.state?.doc) {
      console.warn('[SuperDocNavigator] Editor not ready for flow mode navigation');
      return false;
    }

    try {
      // Ensure position is valid
      const docSize = this.editor.state.doc.content.size;
      const safePos = Math.min(Math.max(0, pos), docSize);
      
      // Use TipTap's built-in commands
      if (this.editor.commands?.setTextSelection) {
        this.editor.commands.setTextSelection({ from: safePos, to: safePos });
        this.editor.commands.scrollIntoView?.();
      } else if (this.editor.view) {
        // Fallback: directly manipulate view if commands not available
        const { tr } = this.editor.state;
        // Access TextSelection from the editor's schema/state
        const Selection = this.editor.state.selection.constructor;
        if (Selection && typeof Selection.create === 'function') {
          const newTr = tr.setSelection(Selection.create(this.editor.state.doc, safePos));
          newTr.scrollIntoView();
          this.editor.view.dispatch(newTr);
        }
      }
      
      // Also focus the editor to ensure cursor is visible
      if (typeof this.editor.view?.focus === 'function') {
        this.editor.view.focus();
      }
      
      console.log('[SuperDocNavigator] Flow mode navigation to position:', safePos);
      return true;
    } catch (error) {
      console.warn('[SuperDocNavigator] Flow mode navigation error:', error);
      return false;
    }
  }

  /**
   * Scroll to a document position (works with pagination!)
   */
  async scrollToPosition(pos: number): Promise<boolean> {
    const presentationEditor = this.getPresentationEditor();

    if (presentationEditor) {
      // === TRY PAGINATED MODE ===
      try {
        // 1. Get the rect for this position (includes pageIndex)
        const rects = presentationEditor.getRangeRects?.(pos, pos + 1);

        if (rects && rects.length > 0) {
          const rect = rects[0];
          const pageIndex = rect.pageIndex;

          // 2. Get layout info from PresentationEditor's public APIs
          const snapshot: LayoutSnapshot = presentationEditor.getLayoutSnapshot();
          const options: LayoutOptions = presentationEditor.getLayoutOptions();

          // Page height is in pixels at 72dpi (NOT inches!)
          // Default is 792 (11 inches * 72dpi = Letter size)
          const pageHeight = snapshot.layout?.pageSize?.h ?? 792;

          // Get virtualization gap (default 0 if not virtualized)
          const virtualGap = options.virtualization?.gap ?? 0;

          // 3. Get the scrollable container
          const container = presentationEditor.element as HTMLElement;

          // 4. Calculate scroll position using the same formula as #scrollPageIntoView
          const targetScrollTop = pageIndex * (pageHeight + virtualGap);

          // 5. Scroll the container (instant to trigger virtualization mount)
          container.scrollTop = targetScrollTop;

          // 6. Wait for virtualization to render the page
          const pageElement = await this._waitForPageMount(
            container,
            pageIndex,
            2000
          );

          if (pageElement) {
            // 7. Fine-tune: scroll the specific page element into view
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }

          // 8. Set selection to move caret
          const activeEditor = presentationEditor.getActiveEditor();
          if (activeEditor?.commands?.setTextSelection) {
            activeEditor.commands.setTextSelection({ from: pos, to: pos });
          }

          console.log('[SuperDocNavigator] Paginated mode navigation to page:', pageIndex);
          return true;
        }
      } catch (error) {
        console.warn('[SuperDocNavigator] Paginated mode failed, falling back to flow mode:', error);
      }
      
      // Paginated mode didn't work, fall through to flow mode
      console.log('[SuperDocNavigator] Falling back to flow mode (no rects available)');
    }

    // === FLOW MODE (non-paginated) ===
    return this._scrollFlowMode(pos);
  }

  /**
   * Navigate to a heading by title (partial match)
   */
  async goToHeading(title: string): Promise<boolean> {
    const headings = this.getHeadings();
    const target = headings.find((h) =>
      h.text.toLowerCase().includes(title.toLowerCase())
    );

    if (!target) {
      console.warn(`[SuperDocNavigator] Heading "${title}" not found`);
      return false;
    }

    // Position inside the heading (pos + 1 to be inside the paragraph)
    return await this.scrollToPosition(target.pos + 1);
  }

  /**
   * Navigate to heading by index (0-based)
   */
  async goToHeadingByIndex(index: number): Promise<boolean> {
    const headings = this.getHeadings();
    if (index < 0 || index >= headings.length) {
      console.warn(
        `[SuperDocNavigator] Heading index ${index} out of range (0-${headings.length - 1})`
      );
      return false;
    }

    return await this.scrollToPosition(headings[index].pos + 1);
  }

  /**
   * Navigate to a specific page (1-based page number)
   */
  async goToPage(pageNumber: number): Promise<boolean> {
    const presentationEditor = this.getPresentationEditor();
    if (!presentationEditor) {
      console.warn('[SuperDocNavigator] PresentationEditor not available');
      return false;
    }

    const container = presentationEditor.element as HTMLElement;
    const pageIndex = pageNumber - 1; // Convert to 0-based

    // Get layout dimensions from public APIs
    const snapshot: LayoutSnapshot = presentationEditor.getLayoutSnapshot();
    const options: LayoutOptions = presentationEditor.getLayoutOptions();

    const pageHeight = snapshot.layout?.pageSize?.h ?? 792;
    const virtualGap = options.virtualization?.gap ?? 0;

    // Calculate and set scroll position
    const targetScrollTop = pageIndex * (pageHeight + virtualGap);
    container.scrollTop = targetScrollTop;

    // Wait for page to mount
    const pageElement = await this._waitForPageMount(
      container,
      pageIndex,
      2000
    );

    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    return false;
  }

  /**
   * Get current page number (1-based)
   */
  getCurrentPage(): number {
    const presentationEditor = this.getPresentationEditor();
    if (!presentationEditor) return 1;

    const container = presentationEditor.element as HTMLElement;
    const snapshot: LayoutSnapshot = presentationEditor.getLayoutSnapshot();
    const options: LayoutOptions = presentationEditor.getLayoutOptions();

    const pageHeight = snapshot.layout?.pageSize?.h ?? 792;
    const virtualGap = options.virtualization?.gap ?? 0;

    const scrollTop = container.scrollTop;
    const pageIndex = Math.floor(scrollTop / (pageHeight + virtualGap));

    return pageIndex + 1; // Convert to 1-based
  }

  /**
   * Get total page count
   */
  getPageCount(): number {
    const presentationEditor = this.getPresentationEditor();
    if (!presentationEditor) return 1;

    const snapshot: LayoutSnapshot = presentationEditor.getLayoutSnapshot();
    return snapshot.layout?.pages?.length ?? 1;
  }
}

