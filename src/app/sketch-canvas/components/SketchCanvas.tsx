'use client';

import React, { 
  useRef, 
  useEffect, 
  useCallback, 
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { 
  CanvasSize, 
  DrawingTool, 
  SKETCH_COLOR, 
  SKETCH_LINE_WIDTH,
  ERASER_LINE_WIDTH,
} from '../types';

export interface SketchCanvasRef {
  // Get canvas as base64
  getSketchBase64: () => string;
  
  // Clear the canvas
  clear: () => void;
  
  // Undo last action
  undo: () => void;
  
  // Check if can undo
  canUndo: () => boolean;
  
  // Save current state to history
  saveState: () => void;
  
  // Draw image to canvas
  drawImage: (imageBase64: string) => Promise<void>;
}

interface SketchCanvasProps {
  size: CanvasSize;
  activeTool: DrawingTool;
  isRendering: boolean;
  isSketchMode: boolean;
  drawColor: string;
}

const MAX_HISTORY = 20;

export const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  function SketchCanvas({ size, activeTool, isRendering, isSketchMode, drawColor }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    
    // Drawing state
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    
    // History for undo
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);

    // Initialize canvas with white background
    const initCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Save initial state
      historyRef.current = [canvas.toDataURL()];
      historyIndexRef.current = 0;
    }, []);

    // Setup canvas on size change
    useEffect(() => {
      initCanvas();
    }, [size, initCanvas]);

    // Calculate scale for responsive canvas
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateScale = () => {
        const { clientWidth, clientHeight } = container;
        const scaleX = (clientWidth - 32) / size.width;
        const scaleY = (clientHeight - 32) / size.height;
        setScale(Math.min(scaleX, scaleY, 1));
      };

      updateScale();
      
      const resizeObserver = new ResizeObserver(updateScale);
      resizeObserver.observe(container);
      
      return () => resizeObserver.disconnect();
    }, [size]);

    // Configure drawing context based on tool and mode
    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      if (activeTool === 'pencil') {
        ctx.globalCompositeOperation = 'source-over';
        // Use sketch color (red) in sketch mode, custom color in color mode
        ctx.strokeStyle = isSketchMode ? SKETCH_COLOR : drawColor;
        ctx.lineWidth = SKETCH_LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else if (activeTool === 'eraser') {
        // Draw white to "erase" (restore canvas background)
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = ERASER_LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }, [activeTool, isSketchMode, drawColor]);

    // Get mouse position relative to canvas
    const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    }, [scale]);

    // Get touch position relative to canvas
    const getTouchPos = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const touch = e.touches[0];
      if (!canvas || !touch) return { x: 0, y: 0 };
      
      const rect = canvas.getBoundingClientRect();
      return {
        x: (touch.clientX - rect.left) / scale,
        y: (touch.clientY - rect.top) / scale,
      };
    }, [scale]);

    // Save state before drawing
    const saveStateBeforeStroke = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Truncate future history if we're not at the end
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      }
      
      // Add current state
      historyRef.current.push(canvas.toDataURL());
      
      // Limit history size
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      }
      
      historyIndexRef.current = historyRef.current.length - 1;
    }, []);

    // Drawing handlers
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isRendering) return;
      
      saveStateBeforeStroke();
      isDrawing.current = true;
      lastPos.current = getMousePos(e);
    }, [isRendering, getMousePos, saveStateBeforeStroke]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || isRendering) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      const currentPos = getMousePos(e);
      
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
      
      lastPos.current = currentPos;
    }, [isRendering, getMousePos]);

    const handleMouseUp = useCallback(() => {
      isDrawing.current = false;
    }, []);

    const handleMouseLeave = useCallback(() => {
      isDrawing.current = false;
    }, []);

    // Touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      if (isRendering) return;
      e.preventDefault();
      
      saveStateBeforeStroke();
      isDrawing.current = true;
      lastPos.current = getTouchPos(e);
    }, [isRendering, getTouchPos, saveStateBeforeStroke]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || isRendering) return;
      e.preventDefault();
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      const currentPos = getTouchPos(e);
      
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
      
      lastPos.current = currentPos;
    }, [isRendering, getTouchPos]);

    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      isDrawing.current = false;
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getSketchBase64: () => {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        return canvas.toDataURL('image/png');
      },
      
      clear: () => {
        saveStateBeforeStroke();
        initCanvas();
      },
      
      undo: () => {
        if (historyIndexRef.current <= 0) return;
        
        historyIndexRef.current--;
        const previousState = historyRef.current[historyIndexRef.current];
        
        if (previousState) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (!ctx || !canvas) return;
          
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = previousState;
        }
      },
      
      canUndo: () => {
        return historyIndexRef.current > 0;
      },
      
      saveState: () => {
        saveStateBeforeStroke();
      },
      
      drawImage: async (imageBase64: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            saveStateBeforeStroke();
            resolve();
          };
          img.onerror = reject;
          img.src = imageBase64;
        });
      },
    }), [initCanvas, saveStateBeforeStroke]);

    // Cursor based on tool
    const getCursor = () => {
      if (isRendering) return 'wait';
      return activeTool === 'eraser' ? 'crosshair' : 'crosshair';
    };

    return (
      <div 
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          style={{
            width: size.width * scale,
            height: size.height * scale,
            cursor: getCursor(),
            touchAction: 'none',
          }}
          className="rounded-lg shadow-2xl border-2 border-slate-600"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
    );
  }
);
