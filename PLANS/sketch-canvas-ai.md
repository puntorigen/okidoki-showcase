# Sketch Canvas AI - Implementation Plan

## Overview

A collaborative drawing canvas where users can build sketches incrementally through natural language prompts. The AI (via okidoki widget) calls client-side tools to render content onto the canvas, maintaining an **accumulative prompt** that tracks all scene elements.

### Key Features

- 🎨 **User Drawing**: Free-hand drawing with pencil/eraser tools
- 🤖 **AI Rendering**: Natural language commands to add/modify/remove elements
- 📝 **Accumulative Prompts**: Each instruction builds on previous ones
- 🖼️ **Final Render**: Transform sketches into polished artwork

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Okidoki Widget                            │
│  User: "add a sun to the right"                                 │
│  AI → calls render_sketch({ action: "add bright sun top right" })│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Client-Side Tools                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │render_sketch│  │render_image │  │      clear_canvas       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prompt Accumulator                            │
│  Instructions: [                                                 │
│    "add bright sun in top right corner",                        │
│    "add green grass at the bottom with flowers",                │
│    "add snowy mountains in the background"                      │
│  ]                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gemini Image API                              │
│  Input: current canvas (base64) + accumulated prompt            │
│  Output: new sketch image                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Canvas Component                            │
│  Draws AI result, user can continue drawing on top              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Two Rendering Modes

### 1. Sketch Mode (Iterative Building)

Used during scene construction. Each `render_sketch` call:
- Adds instruction to the accumulator
- Passes current canvas + full prompt to Gemini
- Renders result as a sketch/work-in-progress style

**Style**: Simple lines, sketch-like, work-in-progress aesthetic

### 2. Render Mode (Final Polish)

Used when user wants a finished artwork. The `render_image` tool:
- Takes current canvas as reference
- Applies a specific artistic style (watercolor, oil painting, etc.)
- Creates polished final output

**Style**: User-specified (watercolor, digital art, pencil, etc.)

---

## Client-Side Tools

### `render_sketch`

Adds, modifies, or removes elements from the sketch. Uses describe-after-render for state management.

```typescript
{
  name: 'render_sketch',
  description: 'Add, modify, or remove elements in the sketch. Each call builds on what is currently visible on the canvas. Use for: adding ("add a sun"), modifying ("make the tree taller"), or removing ("remove the flowers").',
  input: {
    action: {
      type: 'string',
      description: 'What to do: add, modify, or remove something from the scene. Be descriptive. Examples: "add a bright yellow sun in the top right", "make the tree much taller", "remove the sun completely"'
    }
  },
  handler: async ({ action }) => {
    // 1. Save canvas state for undo
    canvasHistory.push(canvas.toDataURL());
    
    // 2. Get current canvas and scene description
    const canvasBase64 = canvas.toDataURL('image/png');
    const currentScene = sceneState.getDescription();
    
    // 3. Build prompt with current scene + action
    const prompt = buildSketchPrompt(currentScene, action);
    
    // 4. Render with Gemini
    try {
      const result = await generateSketch(canvasBase64, prompt);
      await drawImageToCanvas(result);
      
      // 5. IMPORTANT: Describe the new canvas and update state
      const newCanvasBase64 = canvas.toDataURL('image/png');
      const newDescription = await describeCanvas(newCanvasBase64);
      sceneState.setDescription(newDescription);
      
      return { 
        success: true, 
        currentScene: newDescription
      };
    } catch (error) {
      // Rollback on failure
      const previousState = canvasHistory.pop();
      if (previousState) await drawImageToCanvas(previousState);
      throw error;
    }
  }
}

function buildSketchPrompt(currentScene: string, action: string): string {
  const basePrompt = `You are creating a sketch drawing.

STYLE: Simple sketch lines, hand-drawn feel, work-in-progress aesthetic.

`;

  if (!currentScene || currentScene === 'empty canvas') {
    return basePrompt + `The canvas is currently BLANK.
    
Create a sketch with: ${action}`;
  }
  
  return basePrompt + `The canvas currently shows: ${currentScene}

IMPORTANT: Preserve all existing elements visible on the canvas.
Now apply this change: ${action}

Generate the updated sketch incorporating the change while keeping existing content.`;
}
```

### `render_image`

Transforms the current canvas into a polished artwork.

```typescript
{
  name: 'render_image',
  description: 'Render the current canvas as a finished artwork in a specific artistic style. Use when the user wants a polished final version of their sketch.',
  input: {
    style: {
      type: 'string',
      description: 'Artistic style: "watercolor painting", "oil painting", "digital art", "pencil drawing", "anime style", etc.'
    }
  },
  handler: async ({ style }) => {
    const currentCanvas = canvas.toDataURL('image/png');
    
    const prompt = `Transform this sketch into a finished ${style}.
Preserve the composition and all elements exactly as shown.
Apply professional ${style} techniques, textures, and finishing.
The result should look like a completed artwork, not a sketch.`;
    
    const result = await generateFinalRender(currentCanvas, prompt);
    
    // Show in modal (don't replace sketch canvas)
    showRenderedImage(result);
    
    return { success: true, style };
  }
}
```

### `clear_canvas`

Resets everything for a fresh start.

```typescript
{
  name: 'clear_canvas',
  description: 'Clear the canvas and reset all accumulated instructions. Use when user wants to start a new drawing from scratch.',
  input: {},
  handler: async () => {
    // Clear canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Reset accumulator
    promptAccumulator.clear();
    
    // Clear history
    canvasHistory.clear();
    
    return { success: true, message: 'Canvas cleared and ready for new drawing' };
  }
}
```

---

## Scene State Design

### Key Insight: Canvas as Source of Truth

Instead of maintaining complex state with active/inactive elements, we use a simpler approach:

1. **After every successful render**, ask Gemini to describe the current canvas
2. **Use that description** as the base state for the next render
3. **The canvas itself is the source of truth** - no state synchronization issues

This is simpler and more robust:
- ✅ No complex active/inactive tracking
- ✅ Removals are automatically "forgotten" after the next describe
- ✅ Canvas and state can never get out of sync
- ✅ User drawings are automatically included in the description

### State Structure

```typescript
interface SceneState {
  description: string;  // Current canvas description (from Gemini)
  
  // Update after each render
  setDescription(desc: string): void;
  
  // Get current scene for prompts
  getDescription(): string;
  
  // Reset everything
  clear(): void;
}
```

### Flow: Describe After Every Change

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User: "add a sun"                                           │
│  2. Prompt: "Empty canvas. Add: bright sun top right"           │
│  3. Gemini renders → sun appears on canvas                      │
│  4. Gemini describes canvas → "a bright yellow sun..."          │
│  5. State.description = "a bright yellow sun in the corner"     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. User: "add grass"                                           │
│  2. Prompt: "Scene: a bright yellow sun. Add: green grass"      │
│  3. Gemini renders → grass added, sun preserved                 │
│  4. Gemini describes → "sun in corner, green grass below"       │
│  5. State.description = "sun in corner, green grass below"      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. User: "remove the sun"                                      │
│  2. Prompt: "Scene: sun and grass. Remove: the sun completely"  │
│  3. Gemini renders → sun removed, grass remains                 │
│  4. Gemini describes → "green grass field"                      │
│  5. State.description = "green grass field"                     │
│     ↑ Sun is now COMPLETELY FORGOTTEN - not in state!           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. User: "add mountains"                                       │
│  2. Prompt: "Scene: green grass field. Add: snowy mountains"    │
│     ↑ No mention of sun - it won't be re-added!                 │
│  3. Gemini renders → mountains added to grass scene             │
│  4. Gemini describes → "grass field with snowy mountains"       │
│  5. State.description = "grass field with snowy mountains"      │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
class SceneState {
  private description: string = '';

  setDescription(desc: string): void {
    this.description = desc;
  }

  getDescription(): string {
    return this.description;
  }

  clear(): void {
    this.description = '';
  }
}

// Describe the current canvas using Gemini
async function describeCanvas(canvasBase64: string): Promise<string> {
  const response = await callGemini({
    image: canvasBase64,
    prompt: `Describe this sketch in one concise sentence. 
Focus on: what objects/elements are present and their positions.
Example: "A bright sun in the top right corner, green grass at the bottom, and snow-capped mountains in the background."
If the canvas is blank/empty, respond with: "empty canvas"`
  });
  
  return response.text;
}
```

### Render Flow with Auto-Describe

```typescript
async function renderSketch(action: string): Promise<void> {
  // 1. Save canvas for undo
  canvasHistory.push(canvas.toDataURL());
  
  // 2. Build prompt with current scene + new action
  const currentScene = sceneState.getDescription();
  const prompt = buildPrompt(currentScene, action);
  
  // 3. Get current canvas
  const canvasBase64 = canvas.toDataURL('image/png');
  
  // 4. Render with Gemini
  const newImage = await generateSketch(canvasBase64, prompt);
  await drawImageToCanvas(newImage);
  
  // 5. IMPORTANT: Describe the new canvas and update state
  const newDescription = await describeCanvas(canvas.toDataURL('image/png'));
  sceneState.setDescription(newDescription);
  
  console.log('[Scene] Updated:', newDescription);
}

function buildPrompt(currentScene: string, action: string): string {
  if (!currentScene || currentScene === 'empty canvas') {
    return `Create a sketch on a blank canvas: ${action}`;
  }
  
  return `The canvas currently shows: ${currentScene}

PRESERVE all existing elements visible on the canvas.
Now apply this change: ${action}

Generate the updated sketch.`;
}
```

### Benefits of This Approach

| Aspect | Complex State Tracking | Describe-After-Render |
|--------|----------------------|----------------------|
| Removals | Track active/inactive | Automatic - not in description |
| User drawings | Need separate tracking | Included in description |
| State sync | Can drift from canvas | Always in sync |
| Implementation | Complex | Simple |
| API calls | 1 per render | 2 per render (render + describe) |

The extra API call for describing is worth the simplicity and reliability.

---

## Gemini Prompt Templates

### For Sketch Rendering

```typescript
function buildSketchPrompt(instructions: string[]): string {
  return `You are creating a sketch drawing. The canvas shows a work-in-progress sketch.

CRITICAL RULES:
1. PRESERVE everything currently visible on the canvas (user drawings and previous AI content)
2. Apply these changes to the scene:

${instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

STYLE:
- Simple sketch lines
- Work-in-progress aesthetic  
- Hand-drawn feel
- Cohesive composition

Generate the updated sketch incorporating all changes while preserving existing content.`;
}
```

### For Final Render

```typescript
function buildRenderPrompt(style: string): string {
  return `Transform this sketch into a finished ${style}.

RULES:
1. Preserve the exact composition and all elements
2. Apply professional ${style} techniques
3. Add appropriate textures, shading, and details
4. The result should look like a completed artwork

Style: ${style}`;
}
```

---

## UI Components

### Canvas Area

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │                    CANVAS                            │   │
│  │                                                      │   │
│  │              (user draws here)                       │   │
│  │              (AI renders here)                       │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐         ┌──────────────┐  │
│  │ ✏️  │ │ 🧹 │ │ ↩️  │ │ 🗑️  │         │ 🎨 Render AI │  │
│  └─────┘ └─────┘ └─────┘ └─────┘         └──────────────┘  │
│  Pencil  Eraser  Undo   Clear            Final render btn  │
└─────────────────────────────────────────────────────────────┘
```

### Toolbar Components

- **Pencil**: Draw on canvas (red/black ink)
- **Eraser**: Erase drawn content
- **Undo**: Restore previous canvas state
- **Clear**: Reset canvas (triggers `clear_canvas`)
- **Render with AI**: Opens style picker modal, triggers `render_image`

### Scene Panel (Optional)

Shows current accumulated instructions:

```
┌─────────────────────────┐
│ 📝 Current Scene        │
│ ─────────────────────── │
│ 1. bright sun top right │
│ 2. green grass bottom   │
│ 3. snowy mountains      │
│                         │
│ [Collapse] [Clear]      │
└─────────────────────────┘
```

---

## File Structure

```
src/app/sketch-canvas/
├── page.tsx                      # Main page
├── layout.tsx                    # Metadata
├── components/
│   ├── SketchCanvas.tsx         # Main canvas with two-layer system
│   ├── CanvasToolbar.tsx        # Drawing tools (pencil, eraser, undo)
│   ├── AspectRatioSelector.tsx  # 9:16, 16:9, 4:3 picker
│   ├── RenderModal.tsx          # Style picker for final render
│   ├── ScenePanel.tsx           # Collapsible sidebar with scene info
│   └── LayerPreview.tsx         # Thumbnail previews of sketch + color layers
├── lib/
│   ├── sketch-tools.ts          # Okidoki client-side tools
│   ├── scene-state.ts           # Scene description state
│   ├── canvas-layers.ts         # Two-layer management (sketch + color ref)
│   └── canvas-utils.ts          # Canvas helpers (save, restore, draw image)
├── services/
│   └── gemini.ts                # Server-side Gemini service (with 'use server')
└── types.ts                      # TypeScript interfaces
```

### Types

```typescript
// types.ts

export type AspectRatio = 'portrait' | 'landscape' | 'standard';

export const ASPECT_RATIOS: Record<AspectRatio, { width: number; height: number; label: string }> = {
  portrait: { width: 768, height: 1365, label: '9:16' },
  landscape: { width: 1365, height: 768, label: '16:9' },
  standard: { width: 1024, height: 768, label: '4:3' },
};

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasLayers {
  sketch: HTMLCanvasElement;        // Red semi-translucent lines (composition)
  colorReference: HTMLCanvasElement; // Color swatches/regions
}

export interface SceneState {
  description: string;              // Current scene description
  hasColorReference: boolean;       // Whether color layer has content
}

export interface CanvasHistory {
  sketch: string[];                 // Base64 snapshots of sketch layer
  colorReference: string[];         // Base64 snapshots of color layer
  index: number;                    // Current position for undo/redo
}

// Sketch drawing uses semi-translucent red
export const SKETCH_COLOR = 'rgba(255, 0, 0, 0.6)';
export const SKETCH_LINE_WIDTH = 4;
```

### Server Actions (instead of API routes)

Using Next.js server actions for cleaner architecture:

#### `services/gemini.ts`

```typescript
'use server';

import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Generate/update a sketch based on current sketch layer + optional color reference
 */
export async function renderSketch(
  sketchBase64: string,
  colorRefBase64: string | null,
  prompt: string
): Promise<{ success: true; image: string } | { success: false; error: string }> {
  try {
    // Build parts array - sketch is required, color ref is optional
    const parts: any[] = [
      {
        inlineData: {
          data: sketchBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/png',
        },
      },
    ];

    // Add color reference if provided
    if (colorRefBase64) {
      parts.push({
        inlineData: {
          data: colorRefBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/png',
        },
      });
    }

    // Build prompt that explains the two-layer system
    const fullPrompt = colorRefBase64 
      ? `You are working with TWO reference images:

IMAGE 1 (SKETCH): Shows the composition using semi-translucent RED lines. 
These red lines are GUIDES showing shapes, positions, and layout.

IMAGE 2 (COLOR REFERENCE): Shows what colors to use for different elements.
Use these colors when generating the result.

${prompt}

Generate a sketch that follows the red-line composition and uses colors from the reference.`
      : prompt;

    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData?.data
    );

    if (!imagePart?.inlineData?.data) {
      return { success: false, error: 'No image in response' };
    }

    return { 
      success: true, 
      image: `data:image/png;base64,${imagePart.inlineData.data}` 
    };
  } catch (error) {
    console.error('[Gemini] renderSketch error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Update color reference to match new sketch elements
 */
export async function updateColorReference(
  previousColorRef: string,
  newSketch: string,
  changeDescription: string
): Promise<{ success: true; image: string } | { success: false; error: string }> {
  try {
    const prompt = `You are updating a color reference layer.

IMAGE 1: Previous color reference (shows existing color assignments)
IMAGE 2: Updated sketch with new elements (red lines show composition)

The sketch was just updated: ${changeDescription}

Update the color reference to:
1. Keep existing color assignments for unchanged elements
2. Add appropriate colors for new sketch elements
3. Remove colors for elements that were removed from the sketch

Generate an updated color reference image.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: previousColorRef.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/png',
            },
          },
          {
            inlineData: {
              data: newSketch.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/png',
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData?.data
    );

    if (!imagePart?.inlineData?.data) {
      return { success: false, error: 'No image in response' };
    }

    return { 
      success: true, 
      image: `data:image/png;base64,${imagePart.inlineData.data}` 
    };
  } catch (error) {
    console.error('[Gemini] updateColorReference error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Describe what's currently visible on the canvas
 */
export async function describeCanvas(
  canvasBase64: string
): Promise<{ success: true; description: string } | { success: false; error: string }> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',  // Text-only model is faster for description
      contents: {
        parts: [
          {
            inlineData: {
              data: canvasBase64.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/png',
            },
          },
          { 
            text: `Describe this sketch in one concise sentence.
Focus on: what objects/elements are present and their approximate positions.
Example: "A bright sun in the top right corner, green grass at the bottom, and snow-capped mountains in the background."
If the canvas is blank or nearly empty, respond with exactly: "empty canvas"` 
          },
        ],
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return { success: false, error: 'No description in response' };
    }

    return { success: true, description: text.trim() };
  } catch (error) {
    console.error('[Gemini] describeCanvas error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create a polished artistic render of the canvas
 */
export async function finalRender(
  canvasBase64: string, 
  style: string
): Promise<{ success: true; image: string } | { success: false; error: string }> {
  try {
    const prompt = `Transform this sketch into a finished ${style}.

RULES:
1. Preserve the exact composition and all elements
2. Apply professional ${style} techniques
3. Add appropriate textures, shading, and details
4. The result should look like a completed artwork, not a sketch

Style: ${style}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: canvasBase64.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/png',
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData?.data
    );

    if (!imagePart?.inlineData?.data) {
      return { success: false, error: 'No image in response' };
    }

    return { 
      success: true, 
      image: `data:image/png;base64,${imagePart.inlineData.data}` 
    };
  } catch (error) {
    console.error('[Gemini] finalRender error:', error);
    return { success: false, error: String(error) };
  }
}
```

### Usage in Client-Side Tools

```typescript
// In sketch-tools.ts
import { renderSketch, describeCanvas, finalRender } from '../services/gemini';

// These server actions can be called directly from client components
const result = await renderSketch(canvasBase64, prompt);
if (result.success) {
  await drawImageToCanvas(result.image);
}
```

### Benefits of Server Actions over API Routes

| Aspect | API Routes | Server Actions |
|--------|-----------|----------------|
| Boilerplate | More (request/response handling) | Less (direct function calls) |
| Type safety | Manual typing | Automatic TypeScript inference |
| Error handling | Try/catch + HTTP status | Try/catch only |
| Caching | Manual | Built-in Next.js caching options |
| File organization | Separate `/api` folder | Co-located with feature |

---

## User Flow Examples

### Building a Scene (with Describe-After-Render)

```
User: "let's make a new drawing"
AI: calls clear_canvas()
→ Canvas cleared, sceneState.description = ""
AI: "Canvas is ready! What would you like to draw?"

User: "add a sun in the corner"
AI: calls render_sketch({ action: "add a bright yellow sun in the top right corner" })
→ Prompt: "Canvas is BLANK. Create: bright yellow sun top right"
→ Gemini renders sun
→ describeCanvas() → "a bright yellow sun in the top right corner"
→ sceneState.description = "a bright yellow sun in the top right corner"
AI: "Added a sun! What else should we add?"

User: "add some grass and mountains"
AI: calls render_sketch({ action: "add green grass at the bottom and snowy mountains in the background" })
→ Prompt: "Canvas shows: a bright yellow sun. Add: grass and mountains"
→ Gemini renders grass + mountains, preserves sun
→ describeCanvas() → "sun in corner, green grass below, snowy mountains in background"
→ sceneState.description = "sun in corner, green grass below, snowy mountains"
AI: "Done! The landscape is taking shape."

User: "remove the sun"
AI: calls render_sketch({ action: "remove the sun completely from the scene" })
→ Prompt: "Canvas shows: sun, grass, mountains. Apply: remove the sun completely"
→ Gemini removes sun from canvas
→ describeCanvas() → "green grass field with snowy mountains in background"
→ sceneState.description = "green grass field with snowy mountains"
   ↑ SUN IS NOW COMPLETELY FORGOTTEN - not in state!
AI: "Removed the sun from the scene."

User: "add a crescent moon"
AI: calls render_sketch({ action: "add a crescent moon and stars in the night sky" })
→ Prompt: "Canvas shows: green grass with snowy mountains. Add: moon and stars"
   ↑ No mention of sun anywhere - it won't be re-added!
→ Gemini renders moon + stars
→ describeCanvas() → "nighttime scene with grass, mountains, crescent moon and stars"
→ sceneState.description = "nighttime scene with grass, mountains, moon and stars"
AI: "Added a crescent moon and stars! Beautiful night scene."
```

### Key Benefit: Automatic State Sync

The describe-after-render approach means:
- **Removals automatically disappear** from future prompts
- **User drawings are included** in the description
- **No complex state tracking** needed
- **Canvas is always the source of truth**

### Final Render

```
User: "this looks great, render it as a watercolor painting"
AI: calls render_image({ style: "watercolor painting" })
→ Gemini creates polished watercolor version
→ Shows in modal
AI: "Here's your watercolor version! You can download it or continue editing the sketch."
```

### Manual Render

User clicks "🎨 Render with AI" button:
1. Modal opens with style options
2. User selects "Oil Painting"
3. System calls `render_image({ style: "oil painting" })`
4. Result shown in modal

---

## Technical Considerations

### Canvas State Management

```typescript
interface CanvasState {
  current: string;           // Current canvas as base64
  history: string[];         // Previous states for undo (max ~10)
  historyIndex: number;      // Current position in history
}

function saveState(): void {
  state.history.push(canvas.toDataURL());
  if (state.history.length > 10) {
    state.history.shift();  // Keep only last 10
  }
}

function undo(): void {
  if (state.history.length > 0) {
    const previous = state.history.pop();
    drawImageToCanvas(previous);
    promptAccumulator.removeLast();  // Also undo prompt
  }
}
```

### Error Handling

```typescript
async function handleRenderError(error: Error): Promise<void> {
  // Restore previous canvas state
  undo();
  
  // Remove failed instruction
  promptAccumulator.removeLast();
  
  // Notify user
  showError("Couldn't render that. Please try a different description.");
}
```

### Loading States

During AI rendering:
1. Show overlay on canvas with spinner
2. Disable drawing tools
3. Show "Rendering..." in toolbar
4. Disable chat input (handled by okidoki widget)

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "@google/genai": "^x.x.x"  // Gemini API
  }
}
```

Note: Okidoki widget is loaded via script tag (same as docx-translation example).

---

## Gemini Configuration

### Models Used

| Purpose | Model | Why |
|---------|-------|-----|
| Sketch rendering | `gemini-2.5-flash-image-preview` | Fast image-to-image generation |
| Canvas description | `gemini-2.5-flash` | Fast text generation, no image output needed |
| Final artistic render | `gemini-2.5-flash-image-preview` | Higher quality for final output |

### Environment Variable

```env
GEMINI_API_KEY=your_api_key_here
```

---

## Okidoki Widget Configuration

### Initialization

```typescript
// Wait for widget to be ready
useEffect(() => {
  const checkWidget = setInterval(() => {
    if (window.OkidokiWidget?.reinitialize) {
      clearInterval(checkWidget);
      
      // Initialize with your app's public key
      window.OkidokiWidget.reinitialize(SKETCH_CANVAS_PUBLIC_KEY);
      window.OkidokiWidget.setLanguage?.('en');
      
      setWidgetReady(true);
    }
  }, 100);
  
  return () => clearInterval(checkWidget);
}, []);
```

### Tool Registration

```typescript
useEffect(() => {
  if (!widgetReady || !canvasReady) return;
  
  const tools = createSketchTools({
    canvasRef,
    promptAccumulator,
    setIsRendering,
  });
  
  window.OkidokiWidget.registerTools(tools);
  console.log('[Sketch] Tools registered:', tools.map(t => t.name));
}, [widgetReady, canvasReady]);
```

### Suggested System Context

The okidoki app should be configured with context like:

```
You are a collaborative sketch assistant. You help users create drawings on a canvas by:

1. Adding elements when they describe what to draw ("add a sun", "draw mountains")
2. Modifying the scene ("make the tree taller", "change to nighttime")
3. Removing elements ("remove the flowers", "delete the sun")
4. Creating polished final renders ("render as watercolor", "make it look like oil painting")

Always use the available tools to make changes to the canvas. Describe what you're doing briefly.

Available tools:
- render_sketch: Add, modify, or remove elements from the sketch
- render_image: Create a polished final version in a specific art style
- clear_canvas: Start fresh with a blank canvas
```

---

## Code Reuse from creative-canvas-ai

### Components to Reuse (with modifications)

| Component | Reuse Level | Notes |
|-----------|-------------|-------|
| Canvas drawing logic | High | Mouse/touch handling, pencil/eraser |
| Canvas export (toDataURL) | High | Get canvas as base64 for Gemini input |
| Image-to-image pattern | High | Pass current canvas + prompt → get new image |
| Loading overlay | High | Spinner and message display |
| drawImageToCanvas | High | Render Gemini result back to canvas |

### Key Pattern: Image-to-Image Generation

Every render passes the **current canvas as reference**:

```
┌─────────────────────────────────────────────────────────────┐
│  Current Canvas (base64)  +  Accumulated Prompt             │
│  ─────────────────────────────────────────────────────────  │
│  [Image of sun and grass] + "add snowy mountains"           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Gemini sees the image + understands the instruction        │
│  → Generates new image preserving sun/grass + adding mtns   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  New Canvas (with mountains added)                          │
└─────────────────────────────────────────────────────────────┘
```

This is similar to creative-canvas-ai's approach where `generateCompositeImage` creates the reference image. The difference is we use the canvas directly instead of compositing multiple image nodes.

### Components to Build New

| Component | Reason |
|-----------|--------|
| Scene state (describe-after-render) | New pattern for tracking canvas content |
| Okidoki tool handlers | Integration with okidoki widget |
| Scene panel | UI for showing current scene description |
| Render modal | Style picker for final artistic render |

---

## Implementation Order

1. ✅ **Phase 1: Basic Canvas**
   - Canvas component with drawing (pencil/eraser)
   - Clear and undo functionality
   - Basic layout

2. ✅ **Phase 2: Okidoki Integration**
   - Widget initialization
   - Register `clear_canvas` tool
   - Register `render_sketch` tool
   - Scene state (describe-after-render)

3. ✅ **Phase 3: Gemini Integration**
   - Server actions for generation
   - Connect tools to services
   - Handle responses and errors

4. ✅ **Phase 4: Final Render**
   - `render_image` tool
   - Render modal with style picker
   - "Render with AI" button

5. 🔄 **Phase 5: Polish** (Future)
   - Two-layer system (sketch + color reference)
   - Prompt collapse mechanism
   - Mobile responsiveness improvements

---

## Implementation Status

**Completed:** Basic implementation with all core features working.

**Files Created:**
- `src/app/sketch-canvas/page.tsx` - Main page component
- `src/app/sketch-canvas/layout.tsx` - Layout with metadata
- `src/app/sketch-canvas/types.ts` - TypeScript types
- `src/app/sketch-canvas/components/SketchCanvas.tsx` - Canvas with drawing
- `src/app/sketch-canvas/components/CanvasToolbar.tsx` - Drawing tools
- `src/app/sketch-canvas/components/AspectRatioSelector.tsx` - Size selector
- `src/app/sketch-canvas/components/ScenePanel.tsx` - Scene info sidebar
- `src/app/sketch-canvas/components/RenderModal.tsx` - Final render modal
- `src/app/sketch-canvas/services/gemini.ts` - Gemini server actions
- `src/app/sketch-canvas/lib/sketch-tools.ts` - Okidoki client-side tools

**Dependencies Added:**
- `@google/genai` - Gemini API client

---

## Resolved Questions

### 1. Canvas Size
**Answer**: Selectable aspect ratios like creative-canvas-ai.

```typescript
const ASPECT_RATIOS = {
  portrait: { width: 768, height: 1365, label: '9:16' },   // Mobile/Stories
  landscape: { width: 1365, height: 768, label: '16:9' },  // Widescreen
  standard: { width: 1024, height: 768, label: '4:3' },    // Classic
} as const;
```

### 2. Two-Layer System (Sketch + Color Reference)
**Answer**: Yes! Two distinct layers with different purposes:

#### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SKETCH LAYER (user draws here)                             │
│  - Semi-translucent RED color only                          │
│  - Shows composition, shapes, positions                     │
│  - Acts as "guide lines" for Gemini                         │
└─────────────────────────────────────────────────────────────┘
                              +
┌─────────────────────────────────────────────────────────────┐
│  COLOR REFERENCE LAYER                                       │
│  - User can add color swatches/regions                       │
│  - Could be uploaded images or color fills                   │
│  - Tells Gemini what colors to use                           │
│  - Updated alongside sketch changes                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GEMINI receives BOTH as separate images:                   │
│  Image 1: Sketch (red lines = composition guide)            │
│  Image 2: Color reference (= color palette/reference)       │
└─────────────────────────────────────────────────────────────┘
```

#### Multi-Call Strategy for Keeping Layers in Sync

When the sketch changes and we need to update the color reference:

```
Step 1: RENDER SKETCH
┌──────────────────┐     ┌──────────────────┐
│ Current Sketch   │  +  │ "add mountains"  │
│ (red lines)      │     │                  │
└──────────────────┘     └──────────────────┘
          │
          ▼
   New Sketch Layer (mountains added as red lines)

Step 2: UPDATE COLOR REFERENCE (if exists)
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Previous Color   │  +  │ New Sketch       │  +  │ "Update colors   │
│ Reference        │     │ (red lines)      │     │  to match new    │
└──────────────────┘     └──────────────────┘     │  sketch elements"│
          │                                        └──────────────────┘
          ▼
   Updated Color Reference (mountains now have colors)

Step 3: FINAL RENDER (when requested)
┌──────────────────┐     ┌──────────────────┐
│ Sketch Layer     │  +  │ Color Reference  │
│ (composition)    │     │ (colors)         │
└──────────────────┘     └──────────────────┘
          │
          ▼
   Polished artwork with correct composition + colors
```

#### Implementation Notes

```typescript
interface CanvasLayers {
  sketch: HTMLCanvasElement;        // Red semi-translucent lines
  colorReference: HTMLCanvasElement; // Color swatches/regions
  
  // Combined for Gemini calls
  getSketchBase64(): string;
  getColorRefBase64(): string;
}

// Sketch tool draws in semi-translucent red
const SKETCH_COLOR = 'rgba(255, 0, 0, 0.6)';  // Semi-translucent red

// When rendering, pass both layers to Gemini
async function renderWithColorRef(action: string): Promise<void> {
  const sketchBase64 = layers.getSketchBase64();
  const colorRefBase64 = layers.getColorRefBase64();
  
  const result = await renderSketchWithColorRef(
    sketchBase64,
    colorRefBase64,
    currentScene,
    action
  );
  
  // Update sketch layer
  await drawToLayer(layers.sketch, result.sketch);
  
  // Update color reference if provided
  if (result.colorRef) {
    await drawToLayer(layers.colorReference, result.colorRef);
  }
}
```

### 3. Scene Panel
**Suggestion**: Include it as a **collapsible sidebar** that shows:
- Current scene description (from describe-after-render)
- "What Gemini sees" preview (sketch + color ref thumbnails)
- History of actions for context

This helps users understand what the AI knows about the scene and debug if something goes wrong.

### 4. Download
**Answer**: Both sketch and final render downloadable.

```typescript
// Download options in toolbar/menu
const downloadOptions = [
  { label: 'Download Sketch', action: () => downloadCanvas(layers.sketch) },
  { label: 'Download Color Reference', action: () => downloadCanvas(layers.colorReference) },
  { label: 'Download Final Render', action: () => downloadImage(lastFinalRender) },
];
```

### 5. Sharing
**Answer**: Not yet (future scope).
