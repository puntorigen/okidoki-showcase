/**
 * Sketch Canvas Tools
 * Client-side tools for Okidoki integration.
 */

import type { SketchCanvasRef } from '../components/SketchCanvas';
import type { SceneState, GridConfig } from '../types';
import { renderSketch, describeCanvas, finalRender } from '../services/gemini';

interface ToolContext {
  canvasRef: React.RefObject<SketchCanvasRef | null>;
  setIsRendering: (value: boolean) => void;
  setSceneState: (state: SceneState) => void;
  setLastFinalRender: (image: string | null) => void;
  setShowRenderModal: (show: boolean) => void;
  // Grid state - using getter to always have current value
  getShowGrid: () => boolean;
  setShowGrid: (show: boolean) => void;
  getGridConfig: () => GridConfig;
}

// Current scene description (updated after each render)
let currentSceneDescription = '';

/**
 * Build marker context for prompt when target cells are specified
 * Includes both visual marker description AND precise textual positioning
 */
function buildMarkerContext(targetCells: number[], gridConfig: GridConfig): string {
  const { cols, rows } = gridConfig;
  const plural = targetCells.length > 1;
  
  // Calculate cell size as percentage
  const cellWidthPercent = Math.round(100 / cols);
  const cellHeightPercent = Math.round(100 / rows);
  
  // Build detailed position descriptions for each cell
  const positionDescriptions = targetCells.map(cellNum => {
    const cellIndex = cellNum - 1;
    const col = cellIndex % cols;
    const row = Math.floor(cellIndex / cols);
    
    // Calculate cell boundaries as percentages
    const leftBound = Math.round(col / cols * 100);
    const rightBound = Math.round((col + 1) / cols * 100);
    const topBound = Math.round(row / rows * 100);
    const bottomBound = Math.round((row + 1) / rows * 100);
    const centerX = Math.round((col + 0.5) / cols * 100);
    const centerY = Math.round((row + 0.5) / rows * 100);
    
    return `Cell ${cellNum}: Center at (${centerX}%, ${centerY}%), boundaries: left ${leftBound}% to ${rightBound}%, top ${topBound}% to ${bottomBound}%`;
  }).join('\n');
  
  return `
PRECISE POSITIONING - READ CAREFULLY:

The canvas is divided into a ${cols}x${rows} grid. Each cell is ${cellWidthPercent}% wide and ${cellHeightPercent}% tall.

${positionDescriptions}

A small BLUE DOT marks ${plural ? 'each' : 'the'} target cell center on the canvas.

**CRITICAL REQUIREMENTS:**
1. Draw the element SMALL - it must FIT ENTIRELY WITHIN the cell boundaries above
2. CENTER the element on the blue dot position
3. The element should be roughly ${Math.min(cellWidthPercent, cellHeightPercent) * 0.7}% of canvas size (fitting inside the cell)
4. **REMOVE THE BLUE DOT** - your output must NOT contain any blue dots, circles, or markers
5. Draw ONLY in RED/pink color - no blue anywhere in your output
6. The blue dot is a PLACEMENT GUIDE ONLY - erase it and draw your element there instead
`;
}

/**
 * Build grid position description for prompt
 * Translates cell numbers to natural spatial positions (no grid image sent to AI)
 */
function buildGridContext(gridConfig: GridConfig): string {
  const { cols, rows } = gridConfig;
  
  // Build spatial mapping based on grid dimensions
  const topRow = `cells 1-${cols}`;
  const bottomRow = `cells ${(rows - 1) * cols + 1}-${rows * cols}`;
  
  return `
POSITION REFERENCE: The user sees a ${cols}x${rows} numbered grid overlay on their canvas.
If they reference cell numbers, translate to canvas positions:

Grid mapping (${cols} columns × ${rows} rows):
- ${topRow} = TOP of canvas (left to right)
- ${bottomRow} = BOTTOM of canvas (left to right)
- Left column (cells ${Array.from({length: rows}, (_, i) => 1 + i * cols).join(', ')}) = LEFT edge
- Right column (cells ${Array.from({length: rows}, (_, i) => cols + i * cols).join(', ')}) = RIGHT edge
- Center cells = MIDDLE/CENTER of canvas

Examples:
- "cell 1" = top-left corner
- "cell ${cols}" = top-right corner  
- "cell ${(rows - 1) * cols + 1}" = bottom-left corner
- "cell ${rows * cols}" = bottom-right corner
- "cells ${Math.ceil(cols/2)}, ${Math.ceil(cols/2) + cols}" = upper-center area

Position elements according to these spatial regions. Do NOT draw any grid lines or numbers.
`;
}

/**
 * Build the prompt for sketch rendering
 * 
 * The AI draws collaboratively with the user, using the SAME visual language:
 * - Semi-translucent RED for all shapes, outlines, and structural elements
 * - Other colors ONLY when explicitly adding color references/hints
 * - MINIMAL strokes - simple shapes a user could draw with a mouse
 */
function buildSketchPrompt(currentScene: string, action: string, gridContext?: string): string {
  const basePrompt = `You are collaboratively sketching WITH the user on a shared canvas.

CRITICAL DRAWING RULES:

1. COLOR: Use ONLY semi-translucent RED (rgba 255,0,0 ~60% opacity) for shapes
   - Other colors ONLY if user explicitly asks for color hints

2. SIMPLICITY: Draw like someone using a MOUSE would draw:
   - Simple outlines with MINIMAL strokes (5-15 strokes max per object)
   - Basic geometric shapes (circles, rectangles, triangles, simple curves)
   - NO shading, NO hatching, NO texture lines, NO fill patterns
   - NO details like bricks, shingles, or intricate features
   - A house = rectangle + triangle roof + rectangle windows. That's it.
   - A sun = circle + a few lines for rays
   - A tree = vertical line + oval/cloud shape on top

3. THIS IS A GUIDE SKETCH, NOT ART:
   - Rough, imperfect lines are fine
   - The goal is to show WHAT and WHERE, not beauty
   - User will refine or add details themselves

${gridContext || ''}
`;

  if (!currentScene || currentScene === 'empty canvas') {
    return basePrompt + `The canvas is currently BLANK or has only rough user marks.

ACTION: ${action}

Draw using semi-translucent RED with minimal, simple strokes.
Keep it basic - the user will add details if they want them.`;
  }

  return basePrompt + `CURRENT CANVAS: ${currentScene}

ACTION TO APPLY: ${action}

MODIFICATION RULES:
- If ADDING something: Draw it with minimal strokes in semi-translucent red
- If REMOVING something: Erase/remove that element completely from the canvas
- If CHANGING something (resize, move, modify): Actually CHANGE it - don't just redraw the same thing
  - "make smaller" = draw it at REDUCED size
  - "make bigger" = draw it at LARGER size  
  - "move to the left" = reposition it to the left
- PRESERVE all other elements exactly as they are

Generate the updated sketch with the modification ACTUALLY APPLIED.`;
}

/**
 * Create client-side tools for Okidoki
 */
export function createSketchTools(context: ToolContext) {
  const { 
    canvasRef, 
    setIsRendering, 
    setSceneState, 
    setLastFinalRender, 
    setShowRenderModal,
    getShowGrid,
    setShowGrid,
    getGridConfig,
  } = context;

  const getCanvas = () => canvasRef.current;
  
  // Get grid context string if grid is visible
  const getGridContextIfVisible = () => getShowGrid() ? buildGridContext(getGridConfig()) : undefined;

  return [
    // 1. RENDER SKETCH - Add, modify, or remove elements
    {
      name: 'render_sketch',
      description: `Add, modify, or remove elements in the sketch. Each call builds on what's currently visible on the canvas.

IMPORTANT: If the user mentions cell numbers (e.g., "cell 2", "cells 3,4,5"), you MUST extract those numbers and pass them in targetCells.

Examples:
- User: "add a sun" → action: "add a bright sun", targetCells: undefined
- User: "add a sun in cell 2" → action: "add a bright sun", targetCells: [2]
- User: "draw a tree in cells 5 and 6" → action: "draw a tree", targetCells: [5, 6]
- User: "put mountains across cells 9,10,11,12" → action: "draw mountains", targetCells: [9, 10, 11, 12]`,
      input: {
        action: {
          type: 'string',
          description: 'WHAT to draw/modify/remove. Describe the element WITHOUT the cell position (cell position goes in targetCells). Example: "add a bright yellow sun" or "remove the tree".',
        },
        targetCells: {
          type: 'array',
          items: { type: 'number' },
          description: 'REQUIRED if user mentions cell numbers. Extract ALL cell numbers from user request. Examples: "cell 2" → [2], "cells 3 and 4" → [3, 4], "cells 1-4" → [1, 2, 3, 4]. A position marker will be drawn at each cell center to guide the AI where to place the element.',
        },
      },
      handler: async ({ action, targetCells }: { action: string; targetCells?: number[] }) => {
        const canvas = getCanvas();
        if (!canvas) {
          return { success: false, error: 'Canvas not ready' };
        }

        const widget = window.OkidokiWidget;
        widget?.setToolNotification?.('Rendering sketch...');
        setIsRendering(true);

        try {
          // 1. Save current state for undo
          canvas.saveState();

          // 2. Get canvas - with target markers if cells are specified
          const hasTargetCells = targetCells && targetCells.length > 0;
          const sketchBase64 = hasTargetCells
            ? canvas.getSketchWithTargetMarkers(targetCells)
            : canvas.getSketchBase64();

          // 3. Build prompt with current scene + action + positioning context
          // Use marker context if specific cells provided, otherwise general grid context if visible
          const positionContext = hasTargetCells 
            ? buildMarkerContext(targetCells, getGridConfig())
            : getGridContextIfVisible();
          const prompt = buildSketchPrompt(currentSceneDescription, action, positionContext);
          console.log('[Tool] render_sketch prompt:', prompt.substring(0, 200) + '...');

          // 4. Render with Gemini
          const result = await renderSketch(sketchBase64, prompt);

          if (!result.success) {
            throw new Error(result.error || 'Failed to render');
          }

          // 5. Draw result to canvas
          await canvas.drawImage(result.image);

          // 6. IMPORTANT: Describe the new canvas and update state
          widget?.setToolNotification?.('Analyzing scene...');
          const describeResult = await describeCanvas(canvas.getSketchBase64());

          if (describeResult.success && describeResult.description) {
            currentSceneDescription = describeResult.description;
            setSceneState({
              description: describeResult.description,
              hasColorReference: false,
            });
            console.log('[Tool] Scene updated:', currentSceneDescription);
          }

          widget?.setToolNotification?.(null);
          setIsRendering(false);

          return {
            success: true,
            currentScene: currentSceneDescription,
          };
        } catch (error) {
          console.error('[Tool] render_sketch error:', error);
          widget?.setToolNotification?.(null);
          setIsRendering(false);
          return { success: false, error: String(error) };
        }
      },
    },

    // 2. CLEAR CANVAS - Start fresh
    {
      name: 'clear_canvas',
      description: 'Clear the canvas and start a new drawing from scratch. Use when the user wants to start over or create something completely new.',
      input: {},
      handler: async () => {
        const canvas = getCanvas();
        if (!canvas) {
          return { success: false, error: 'Canvas not ready' };
        }

        canvas.clear();
        currentSceneDescription = '';
        setSceneState({ description: '', hasColorReference: false });

        return {
          success: true,
          message: 'Canvas cleared and ready for a new drawing',
        };
      },
    },

    // 3. RENDER IMAGE - Create polished final artwork
    {
      name: 'render_image',
      description: `Transform the current sketch into a polished artwork in a specific artistic style.
Use when the user wants a finished version of their sketch.
Examples:
- "render as a watercolor painting"
- "make it look like an oil painting"
- "create a digital art version"`,
      input: {
        style: {
          type: 'string',
          description: 'The artistic style to render in (e.g., "watercolor painting", "oil painting", "digital art", "anime style")',
        },
      },
      handler: async ({ style }: { style: string }) => {
        const canvas = getCanvas();
        if (!canvas) {
          return { success: false, error: 'Canvas not ready' };
        }

        const widget = window.OkidokiWidget;
        widget?.setToolNotification?.(`Rendering ${style}...`);
        setIsRendering(true);

        try {
          const sketchBase64 = canvas.getSketchBase64();
          const result = await finalRender(sketchBase64, style);

          if (!result.success) {
            throw new Error(result.error || 'Failed to render');
          }

          // Show the result in modal
          setLastFinalRender(result.image);
          setShowRenderModal(true);

          widget?.setToolNotification?.(null);
          setIsRendering(false);

          return {
            success: true,
            message: `Created ${style} artwork! You can download it from the modal.`,
          };
        } catch (error) {
          console.error('[Tool] render_image error:', error);
          widget?.setToolNotification?.(null);
          setIsRendering(false);
          return { success: false, error: String(error) };
        }
      },
    },

    // 4. GET SCENE - Get current scene description (for AI context)
    {
      name: 'get_scene',
      description: 'Get a description of what is currently on the canvas. Use this to understand the current state of the drawing before making changes.',
      input: {},
      handler: async () => {
        const canvas = getCanvas();
        if (!canvas) {
          return { success: false, error: 'Canvas not ready' };
        }

        // If we don't have a description, get one
        if (!currentSceneDescription) {
          const result = await describeCanvas(canvas.getSketchBase64());
          if (result.success && result.description) {
            currentSceneDescription = result.description;
            setSceneState({
              description: result.description,
              hasColorReference: false,
            });
          }
        }

        return {
          success: true,
          scene: currentSceneDescription || 'empty canvas',
        };
      },
    },

    // 5. SHOW GRID - Show the position grid overlay
    {
      name: 'show_grid',
      description: `Show a numbered grid overlay on the canvas for positioning elements.
The grid divides the canvas into numbered cells (e.g., 1-12 for landscape/portrait, 1-9 for standard).
Use this when the user wants to place elements in specific positions like "add a sun in cell 3" or "put a tree in cells 7,8,10,11".
After showing the grid, element positions can be specified by cell number.`,
      input: {},
      handler: async () => {
        const config = getGridConfig();
        setShowGrid(true);
        return {
          success: true,
          message: `Grid is now visible with ${config.cols}x${config.rows} cells (${config.cols * config.rows} total). Cells are numbered 1-${config.cols * config.rows}, left-to-right, top-to-bottom.`,
          gridInfo: {
            cols: config.cols,
            rows: config.rows,
            totalCells: config.cols * config.rows,
          },
        };
      },
    },

    // 6. HIDE GRID - Hide the position grid overlay
    {
      name: 'hide_grid',
      description: 'Hide the numbered grid overlay from the canvas. Use when the user is done positioning elements or wants a cleaner view.',
      input: {},
      handler: async () => {
        setShowGrid(false);
        return {
          success: true,
          message: 'Grid is now hidden.',
        };
      },
    },
  ];
}
