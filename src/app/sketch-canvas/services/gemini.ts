'use server';

/**
 * Gemini Server Services for Sketch Canvas
 * 
 * Using Next.js server actions for clean API without endpoint boilerplate.
 * Updated for Gemini 3 API (January 2025)
 * 
 * Models used:
 * - gemini-3-pro-image-preview: For image generation (sketch rendering, final artwork)
 * - gemini-3-flash-preview: For text-only tasks (canvas description)
 */

import { GoogleGenAI } from '@google/genai';

// Get API key from environment
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

if (!API_KEY) {
  console.error('[Gemini] API key not configured. Set GEMINI_API_KEY in environment.');
}

// Initialize Gemini client
const getClient = () => {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

// Strip base64 data URL prefix
const stripBase64Prefix = (base64: string): string => {
  return base64.replace(/^data:image\/\w+;base64,/, '');
};

/**
 * Generate/update a sketch based on current canvas + prompt
 * Uses gemini-3-pro-image-preview for image-to-image generation
 * 
 * Note: Grid positioning is handled via text prompt only (no grid image).
 * This prevents the AI from including grid lines in its output.
 * 
 * @param sketchBase64 - The canvas content (without grid)
 * @param prompt - The text prompt describing the action (includes grid position context if needed)
 */
export async function renderSketch(
  sketchBase64: string,
  prompt: string
): Promise<{ success: true; image: string } | { success: false; error: string }> {
  try {
    const ai = getClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: stripBase64Prefix(sketchBase64),
              mimeType: 'image/png',
            },
          },
          { text: prompt },
        ],
      },
      config: {
        // Request both text and image output
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const candidate = response?.candidates?.[0];

    if (!candidate?.content?.parts) {
      const blockReason = response?.promptFeedback?.blockReason;
      const blockMessage = response?.promptFeedback?.blockReasonMessage;
      let errorMessage = 'The API response was empty or malformed.';
      if (blockReason) {
        errorMessage = `Request blocked: ${blockReason}. ${blockMessage || ''}`.trim();
      }
      console.error('[Gemini] Invalid response:', JSON.stringify(response, null, 2));
      return { success: false, error: errorMessage };
    }

    // Find image in response
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return {
          success: true,
          image: `data:image/png;base64,${part.inlineData.data}`,
        };
      }
    }

    // Log the response for debugging
    console.warn('[Gemini] No image in response. Parts:', 
      candidate.content.parts.map(p => p.text ? 'text' : p.inlineData ? 'image' : 'unknown')
    );
    return { success: false, error: 'No image generated' };
  } catch (error) {
    console.error('[Gemini] renderSketch error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Describe what's currently visible on the canvas
 * Uses gemini-3-flash-preview for fast text-only response
 */
export async function describeCanvas(
  canvasBase64: string
): Promise<{ success: true; description: string } | { success: false; error: string }> {
  try {
    const ai = getClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: stripBase64Prefix(canvasBase64),
              mimeType: 'image/png',
            },
          },
          {
            text: `Describe this sketch in one concise sentence.
Focus on: what objects/elements are present and their approximate positions.
Example: "A bright sun in the top right corner, green grass at the bottom, and snow-capped mountains in the background."
If the canvas is blank, white, or nearly empty with no distinct elements, respond with exactly: "empty canvas"`,
          },
        ],
      },
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;

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
 * Uses gemini-3-pro-image-preview for high-quality image generation
 */
export async function finalRender(
  canvasBase64: string,
  style: string
): Promise<{ success: true; image: string } | { success: false; error: string }> {
  try {
    const ai = getClient();

    const prompt = `Transform this sketch into a finished ${style} artwork.

UNDERSTANDING THE SKETCH:
- **Red/pink lines**: These are shape and composition guides showing outlines, structure, and object boundaries
- **Colored areas** (non-red colors): These are COLOR REFERENCES indicating what colors should be used in those regions

IMPORTANT: The colored areas are NOT literal overlays. They are color palette hints. For example:
- A blue area on a shape means "render this shape in blue tones"
- Green patches at the bottom suggest "use green for the ground/grass here"
- Yellow near the top might indicate "make this area sunny/bright yellow"

RULES:
1. Interpret red lines as the shapes and objects to render
2. Use the colored areas as color guidance for those regions—apply colors naturally to the rendered objects, not as flat overlays
3. Apply professional ${style} techniques, textures, and artistic finishing
4. The result should look like a completed artwork, not a sketch
5. Maintain the positions and proportions of all elements
6. Add appropriate shading, details, and artistic flair that complement the indicated colors

Style: ${style}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: stripBase64Prefix(canvasBase64),
              mimeType: 'image/png',
            },
          },
          { text: prompt },
        ],
      },
      config: {
        // Request both text and image output
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const candidate = response?.candidates?.[0];

    if (!candidate?.content?.parts) {
      const blockReason = response?.promptFeedback?.blockReason;
      let errorMessage = 'The API response was empty or malformed.';
      if (blockReason) {
        errorMessage = `Request blocked: ${blockReason}`;
      }
      return { success: false, error: errorMessage };
    }

    // Find image in response
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return {
          success: true,
          image: `data:image/png;base64,${part.inlineData.data}`,
        };
      }
    }

    return { success: false, error: 'No image generated' };
  } catch (error) {
    console.error('[Gemini] finalRender error:', error);
    return { success: false, error: String(error) };
  }
}
