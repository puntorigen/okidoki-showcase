/**
 * Sketch Canvas Tools
 * Client-side tools for Okidoki integration.
 */

import type { SketchCanvasRef } from '../components/SketchCanvas';
import type { SceneState } from '../types';
import { renderSketch, describeCanvas, finalRender } from '../services/gemini';

interface ToolContext {
  canvasRef: React.RefObject<SketchCanvasRef | null>;
  setIsRendering: (value: boolean) => void;
  setSceneState: (state: SceneState) => void;
  setLastFinalRender: (image: string | null) => void;
  setShowRenderModal: (show: boolean) => void;
}

// Current scene description (updated after each render)
let currentSceneDescription = '';

/**
 * Build the prompt for sketch rendering
 * 
 * The AI draws collaboratively with the user, using the SAME visual language:
 * - Semi-translucent RED for all shapes, outlines, and structural elements
 * - Other colors ONLY when explicitly adding color references/hints
 * - MINIMAL strokes - simple shapes a user could draw with a mouse
 */
function buildSketchPrompt(currentScene: string, action: string): string {
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
  const { canvasRef, setIsRendering, setSceneState, setLastFinalRender, setShowRenderModal } = context;

  const getCanvas = () => canvasRef.current;

  return [
    // 1. RENDER SKETCH - Add, modify, or remove elements
    {
      name: 'render_sketch',
      description: `Add, modify, or remove elements in the sketch. Each call builds on what's currently visible on the canvas. 
Examples: 
- "add a bright sun in the top right corner"
- "add green grass at the bottom"  
- "remove the sun from the scene"
- "make the mountains taller"
Use this for any scene modification.`,
      input: {
        action: {
          type: 'string',
          description: 'What to do: add, modify, or remove something from the scene. Be descriptive.',
        },
      },
      handler: async ({ action }: { action: string }) => {
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

          // 2. Get current canvas
          const sketchBase64 = canvas.getSketchBase64();

          // 3. Build prompt with current scene + action
          const prompt = buildSketchPrompt(currentSceneDescription, action);
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
  ];
}
