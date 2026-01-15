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

// Global window type for Okidoki widget
declare global {
  interface Window {
    OkidokiWidget?: {
      reinitialize: (publicKey: string) => void;
      setLanguage?: (lang: string) => void;
      registerTools: (tools: unknown[]) => void;
      unregisterTools?: () => void;
      setToolNotification?: (message: string | null) => void;
      ask?: (params: {
        prompt: string;
        context?: string;
        maxTokens?: number;
      }) => Promise<{ success: boolean; result?: string; error?: string }>;
      insertMessage?: (message: string, options?: { send?: boolean }) => void;
    };
  }
}
