/**
 * Sketch Canvas Types
 */

// Aspect ratio options
export type AspectRatio = 'portrait' | 'landscape' | 'standard';

export interface CanvasSize {
  width: number;
  height: number;
  label: string;
}

export const ASPECT_RATIOS: Record<AspectRatio, CanvasSize> = {
  portrait: { width: 768, height: 1365, label: '9:16' },
  landscape: { width: 1365, height: 768, label: '16:9' },
  standard: { width: 1024, height: 768, label: '4:3' },
};

// Grid configuration per aspect ratio
export interface GridConfig {
  cols: number;
  rows: number;
}

export const GRID_CONFIGS: Record<AspectRatio, GridConfig> = {
  portrait: { cols: 3, rows: 4 },   // 12 cells
  landscape: { cols: 4, rows: 3 },  // 12 cells
  standard: { cols: 3, rows: 3 },   // 9 cells
};

// Drawing tool options
export type DrawingTool = 'pencil' | 'eraser';

// Sketch layer uses semi-translucent red
export const SKETCH_COLOR = 'rgba(255, 0, 0, 0.6)';
export const SKETCH_LINE_WIDTH = 4;
export const ERASER_LINE_WIDTH = 20;

// Scene state from describe-after-render
export interface SceneState {
  description: string;
  hasColorReference: boolean;
}

// Canvas history for undo
export interface CanvasHistoryState {
  sketches: string[];  // Base64 snapshots
  maxSize: number;
}

// Render result from Gemini
export interface RenderResult {
  success: boolean;
  image?: string;
  error?: string;
}

// Describe result from Gemini
export interface DescribeResult {
  success: boolean;
  description?: string;
  error?: string;
}

// Note: Window.OkidokiWidget type is declared in docx-translation/lib/LanguageContext.tsx
