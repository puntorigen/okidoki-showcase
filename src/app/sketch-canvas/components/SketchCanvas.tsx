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
  GridConfig,
  SKETCH_COLOR, 
  SKETCH_LINE_WIDTH,
  ERASER_LINE_WIDTH,
} from '../types';

export interface SketchCanvasRef {
  // Get merged canvas as base64 (for AI) - WITHOUT grid
  getSketchBase64: () => string;
  
  // Get canvas WITH target markers at specified cell positions
  // Markers are blue crosshairs to indicate placement positions
  getSketchWithTargetMarkers: (targetCells: number[]) => string;
  
  // Get grid config for current aspect ratio
  getGridConfig: () => GridConfig;
  
  // Clear all layers
  clear: () => void;
  
  // Undo last action
  undo: () => void;
  
  // Redo last undone action
  redo: () => void;
  
  // Check if can undo
  canUndo: () => boolean;
  
  // Check if can redo
  canRedo: () => boolean;
  
  // Save current state to history
  saveState: () => void;
  
  // Draw image to sketch layer (from AI)
  drawImage: (imageBase64: string) => Promise<void>;
}

interface SketchCanvasProps {
  size: CanvasSize;
  activeTool: DrawingTool;
  isRendering: boolean;
  isSketchMode: boolean;
  drawColor: string;
  showGrid: boolean;
  gridConfig: GridConfig;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

interface LayerHistory {
  sketch: string;
  color: string;
}

const MAX_HISTORY = 20;

export const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  function SketchCanvas({ size, activeTool, isRendering, isSketchMode, drawColor, showGrid, gridConfig, onHistoryChange }, ref) {
    // Three canvases: sketch layer, color layer, display (composite)
    const sketchCanvasRef = useRef<HTMLCanvasElement>(null);
    const colorCanvasRef = useRef<HTMLCanvasElement>(null);
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const gridCanvasRef = useRef<HTMLCanvasElement>(null); // Grid overlay (visual only)
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    
    // Drawing state
    const isDrawing = useRef(false);
    const hasDrawnInStroke = useRef(false); // Track if anything was actually drawn
    const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    
    // History for undo (stores both layers)
    const historyRef = useRef<LayerHistory[]>([]);
    const historyIndexRef = useRef(-1);

    // Get the active layer canvas based on mode
    const getActiveCanvas = useCallback(() => {
      return isSketchMode ? sketchCanvasRef.current : colorCanvasRef.current;
    }, [isSketchMode]);

    // Draw grid onto a canvas context
    // Grid is translucent (no fill), only lines and numbers are visible
    const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const { cols, rows } = gridConfig;
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const fontSize = Math.min(cellWidth, cellHeight) * 0.25;
      
      // Grid lines - solid dark gray
      ctx.strokeStyle = 'rgba(60, 60, 60, 0.8)';
      ctx.lineWidth = 2;
      
      // Vertical lines
      for (let i = 1; i < cols; i++) {
        const x = i * cellWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let i = 1; i < rows; i++) {
        const y = i * cellHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Cell numbers with subtle background pill for readability
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let cellNum = 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cellWidth + cellWidth / 2;
          const y = row * cellHeight + cellHeight / 2;
          const text = String(cellNum);
          const textWidth = ctx.measureText(text).width;
          const padding = fontSize * 0.4;
          
          // Semi-transparent background pill behind number
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.roundRect(
            x - textWidth / 2 - padding, 
            y - fontSize / 2 - padding * 0.5, 
            textWidth + padding * 2, 
            fontSize + padding,
            fontSize * 0.3
          );
          ctx.fill();
          
          // Number text
          ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
          ctx.fillText(text, x, y);
          cellNum++;
        }
      }
    }, [gridConfig]);

    // Ref to track current grid visibility (avoids dependency issues)
    const showGridRef = useRef(showGrid);
    useEffect(() => {
      showGridRef.current = showGrid;
    }, [showGrid]);

    // Composite both layers onto the display canvas
    // Note: Uses showGridRef to avoid dependency chain that would cause canvas clearing
    const compositeDisplay = useCallback(() => {
      const display = displayCanvasRef.current;
      const sketch = sketchCanvasRef.current;
      const color = colorCanvasRef.current;
      const ctx = display?.getContext('2d');
      
      if (!ctx || !display || !sketch || !color) return;
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, display.width, display.height);
      
      // Draw color layer first (underneath)
      ctx.drawImage(color, 0, 0);
      
      // Draw sketch layer on top
      ctx.drawImage(sketch, 0, 0);
      
      // Draw grid overlay if enabled (read from ref to avoid dep chain)
      if (showGridRef.current) {
        drawGrid(ctx, display.width, display.height);
      }
    }, [drawGrid]);

    // Initialize all canvases (layers are transparent, display has white bg)
    // This also RESETS history completely
    const initCanvas = useCallback(() => {
      const sketch = sketchCanvasRef.current;
      const color = colorCanvasRef.current;
      const sketchCtx = sketch?.getContext('2d');
      const colorCtx = color?.getContext('2d');
      
      if (!sketchCtx || !colorCtx || !sketch || !color) return;
      
      // Clear both layers to transparent
      sketchCtx.clearRect(0, 0, sketch.width, sketch.height);
      colorCtx.clearRect(0, 0, color.width, color.height);
      
      // Composite to display
      compositeDisplay();
      
      // RESET history to fresh state (no undo available after clear)
      historyRef.current = [{
        sketch: sketch.toDataURL(),
        color: color.toDataURL(),
      }];
      historyIndexRef.current = 0;
      
      // Notify parent that history was reset
      onHistoryChange?.(false, false);
    }, [compositeDisplay, onHistoryChange]);

    // Setup canvases on size change
    useEffect(() => {
      initCanvas();
    }, [size, initCanvas]);

    // Re-composite when grid visibility changes
    useEffect(() => {
      // Update ref first, then re-composite
      showGridRef.current = showGrid;
      compositeDisplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showGrid]);

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
    const configureContext = useCallback((ctx: CanvasRenderingContext2D) => {
      if (activeTool === 'pencil') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = isSketchMode ? SKETCH_COLOR : drawColor;
        ctx.lineWidth = SKETCH_LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else if (activeTool === 'eraser') {
        // Use destination-out to erase on transparent layers
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = ERASER_LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }, [activeTool, isSketchMode, drawColor]);

    // Get mouse position relative to display canvas
    const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = displayCanvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    }, [scale]);

    // Get touch position relative to display canvas
    const getTouchPos = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = displayCanvasRef.current;
      const touch = e.touches[0];
      if (!canvas || !touch) return { x: 0, y: 0 };
      
      const rect = canvas.getBoundingClientRect();
      return {
        x: (touch.clientX - rect.left) / scale,
        y: (touch.clientY - rect.top) / scale,
      };
    }, [scale]);

    // Notify parent of history state changes
    const notifyHistoryChange = useCallback(() => {
      const canUndo = historyIndexRef.current > 0;
      const canRedo = historyIndexRef.current < historyRef.current.length - 1;
      onHistoryChange?.(canUndo, canRedo);
    }, [onHistoryChange]);

    // Save state before drawing
    const saveStateBeforeStroke = useCallback(() => {
      const sketch = sketchCanvasRef.current;
      const color = colorCanvasRef.current;
      if (!sketch || !color) return;
      
      // Truncate future history if we're not at the end
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      }
      
      // Add current state
      historyRef.current.push({
        sketch: sketch.toDataURL(),
        color: color.toDataURL(),
      });
      
      // Limit history size
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      }
      
      historyIndexRef.current = historyRef.current.length - 1;
      
      // Notify parent
      notifyHistoryChange();
    }, [notifyHistoryChange]);

    // Drawing handlers
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isRendering) return;
      
      isDrawing.current = true;
      hasDrawnInStroke.current = false;
      lastPos.current = getMousePos(e);
    }, [isRendering, getMousePos]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || isRendering) return;
      
      const canvas = getActiveCanvas();
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      configureContext(ctx);
      const currentPos = getMousePos(e);
      
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
      
      lastPos.current = currentPos;
      hasDrawnInStroke.current = true;
      
      // Update display
      compositeDisplay();
    }, [isRendering, getMousePos, getActiveCanvas, configureContext, compositeDisplay]);

    const handleMouseUp = useCallback(() => {
      if (isDrawing.current && hasDrawnInStroke.current) {
        // Save state AFTER drawing is complete
        saveStateBeforeStroke();
      }
      isDrawing.current = false;
      hasDrawnInStroke.current = false;
    }, [saveStateBeforeStroke]);

    const handleMouseLeave = useCallback(() => {
      if (isDrawing.current && hasDrawnInStroke.current) {
        // Save state if user drew something and left canvas
        saveStateBeforeStroke();
      }
      isDrawing.current = false;
      hasDrawnInStroke.current = false;
    }, [saveStateBeforeStroke]);

    // Touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      if (isRendering) return;
      e.preventDefault();
      
      isDrawing.current = true;
      hasDrawnInStroke.current = false;
      lastPos.current = getTouchPos(e);
    }, [isRendering, getTouchPos]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || isRendering) return;
      e.preventDefault();
      
      const canvas = getActiveCanvas();
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      configureContext(ctx);
      const currentPos = getTouchPos(e);
      
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
      
      lastPos.current = currentPos;
      hasDrawnInStroke.current = true;
      
      // Update display
      compositeDisplay();
    }, [isRendering, getTouchPos, getActiveCanvas, configureContext, compositeDisplay]);

    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (isDrawing.current && hasDrawnInStroke.current) {
        // Save state AFTER drawing is complete
        saveStateBeforeStroke();
      }
      isDrawing.current = false;
      hasDrawnInStroke.current = false;
    }, [saveStateBeforeStroke]);

    // Load image to a canvas
    const loadImageToCanvas = useCallback((canvas: HTMLCanvasElement, src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No context'));
          return;
        }
        
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve();
        };
        img.onerror = reject;
        img.src = src;
      });
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getSketchBase64: () => {
        // Return the composited display canvas (white bg + both layers, NO grid)
        const display = displayCanvasRef.current;
        const sketch = sketchCanvasRef.current;
        const color = colorCanvasRef.current;
        const ctx = display?.getContext('2d');
        
        if (!display || !sketch || !color || !ctx) return '';
        
        // Composite without grid
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, display.width, display.height);
        ctx.drawImage(color, 0, 0);
        ctx.drawImage(sketch, 0, 0);
        
        const result = display.toDataURL('image/png');
        
        // Restore grid if it was showing (use ref to avoid stale closure)
        if (showGridRef.current) {
          drawGrid(ctx, display.width, display.height);
        }
        
        return result;
      },
      
      getSketchWithTargetMarkers: (targetCells: number[]) => {
        // Return canvas WITH small target dot markers at specified cell positions
        // These markers indicate where to place elements - kept minimal to avoid AI copying them
        const display = displayCanvasRef.current;
        const sketch = sketchCanvasRef.current;
        const color = colorCanvasRef.current;
        const ctx = display?.getContext('2d');
        
        if (!display || !sketch || !color || !ctx) return '';
        
        const { cols, rows } = gridConfig;
        const cellWidth = display.width / cols;
        const cellHeight = display.height / rows;
        
        // First composite the canvas normally
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, display.width, display.height);
        ctx.drawImage(color, 0, 0);
        ctx.drawImage(sketch, 0, 0);
        
        // Draw small blue dot markers at target cell centers
        // Keep them small and simple so AI doesn't copy them
        const dotRadius = Math.min(cellWidth, cellHeight) * 0.06; // Small dot
        const haloRadius = dotRadius * 2.5;
        
        for (const cellNum of targetCells) {
          if (cellNum < 1 || cellNum > cols * rows) continue;
          
          // Convert cell number to row/col (1-indexed, left-to-right, top-to-bottom)
          const cellIndex = cellNum - 1;
          const col = cellIndex % cols;
          const row = Math.floor(cellIndex / cols);
          
          const centerX = col * cellWidth + cellWidth / 2;
          const centerY = row * cellHeight + cellHeight / 2;
          
          // Draw outer halo (light blue, semi-transparent)
          ctx.fillStyle = 'rgba(0, 150, 255, 0.3)';
          ctx.beginPath();
          ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw inner dot (solid blue)
          ctx.fillStyle = 'rgba(0, 100, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(centerX, centerY, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        
        const result = display.toDataURL('image/png');
        
        // Restore display to current state
        compositeDisplay();
        
        return result;
      },
      
      getGridConfig: () => gridConfig,
      
      clear: () => {
        // Just reset - don't save current state (we're clearing everything)
        initCanvas();
      },
      
      undo: () => {
        if (historyIndexRef.current <= 0) return;
        
        historyIndexRef.current--;
        const previousState = historyRef.current[historyIndexRef.current];
        
        if (previousState) {
          const sketch = sketchCanvasRef.current;
          const color = colorCanvasRef.current;
          
          if (sketch && color) {
            Promise.all([
              loadImageToCanvas(sketch, previousState.sketch),
              loadImageToCanvas(color, previousState.color),
            ]).then(() => {
              compositeDisplay();
              notifyHistoryChange();
            });
          }
        }
      },
      
      redo: () => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        
        historyIndexRef.current++;
        const nextState = historyRef.current[historyIndexRef.current];
        
        if (nextState) {
          const sketch = sketchCanvasRef.current;
          const color = colorCanvasRef.current;
          
          if (sketch && color) {
            Promise.all([
              loadImageToCanvas(sketch, nextState.sketch),
              loadImageToCanvas(color, nextState.color),
            ]).then(() => {
              compositeDisplay();
              notifyHistoryChange();
            });
          }
        }
      },
      
      canUndo: () => {
        return historyIndexRef.current > 0;
      },
      
      canRedo: () => {
        return historyIndexRef.current < historyRef.current.length - 1;
      },
      
      saveState: () => {
        saveStateBeforeStroke();
      },
      
      drawImage: async (imageBase64: string) => {
        // AI-generated images go to the SKETCH layer
        const sketch = sketchCanvasRef.current;
        if (!sketch) return;
        
        await loadImageToCanvas(sketch, imageBase64);
        saveStateBeforeStroke();
        compositeDisplay();
      },
    }), [initCanvas, saveStateBeforeStroke, compositeDisplay, loadImageToCanvas, notifyHistoryChange, drawGrid]);

    // Cursor based on tool
    const getCursor = () => {
      if (isRendering) return 'wait';
      return 'crosshair';
    };

    const canvasStyle = {
      width: size.width * scale,
      height: size.height * scale,
    };

    return (
      <div 
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
      >
        {/* Container for stacked canvases */}
        <div className="relative rounded-lg shadow-2xl border-2 border-slate-600 overflow-hidden">
          {/* Hidden layer canvases */}
          <canvas
            ref={sketchCanvasRef}
            width={size.width}
            height={size.height}
            className="hidden"
          />
          <canvas
            ref={colorCanvasRef}
            width={size.width}
            height={size.height}
            className="hidden"
          />
          
          {/* Visible display canvas (composite) */}
          <canvas
            ref={displayCanvasRef}
            width={size.width}
            height={size.height}
            style={{
              ...canvasStyle,
              cursor: getCursor(),
              touchAction: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>
      </div>
    );
  }
);
