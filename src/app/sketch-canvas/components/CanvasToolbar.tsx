'use client';

import React from 'react';
import { DrawingTool, SKETCH_COLOR } from '../types';
import { useLanguage } from '../lib/LanguageContext';

// Preset colors for color mode
const COLOR_PRESETS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#000000', // black
  '#ffffff', // white
];

interface CanvasToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRenderWithAI: () => void;
  isRendering: boolean;
  canUndo: boolean;
  canRedo: boolean;
  drawColor: string;
  onColorChange: (color: string) => void;
  isSketchMode: boolean;
  onModeChange: (isSketch: boolean) => void;
}

export function CanvasToolbar({
  activeTool,
  onToolChange,
  onClear,
  onUndo,
  onRedo,
  onRenderWithAI,
  isRendering,
  canUndo,
  canRedo,
  drawColor,
  onColorChange,
  isSketchMode,
  onModeChange,
}: CanvasToolbarProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2 gap-4">
      {/* Drawing tools */}
      <div className="flex items-center gap-2">
        {/* Mode toggle: Sketch vs Color */}
        <div className="flex bg-slate-700 rounded-lg p-0.5 mr-2">
          <button
            onClick={() => onModeChange(true)}
            disabled={isRendering}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              isSketchMode
                ? 'bg-rose-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
            title={t('pencilSketch')}
          >
            {t('sketchMode')}
          </button>
          <button
            onClick={() => onModeChange(false)}
            disabled={isRendering}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              !isSketchMode
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
            title={t('pencilColor')}
          >
            {t('colorMode')}
          </button>
        </div>

        {/* Pencil */}
        <button
          onClick={() => onToolChange('pencil')}
          disabled={isRendering}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            activeTool === 'pencil'
              ? isSketchMode ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isSketchMode ? t('pencilSketch') : t('pencilColor')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>

        {/* Color picker - only show in color mode */}
        {!isSketchMode && (
          <div className="flex items-center gap-1 px-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                disabled={isRendering}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${
                  drawColor === color ? 'border-white scale-110' : 'border-slate-600'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            {/* Custom color input */}
            <input
              type="color"
              value={drawColor}
              onChange={(e) => onColorChange(e.target.value)}
              disabled={isRendering}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              title={t('custom')}
            />
          </div>
        )}

        {/* Sketch color indicator */}
        {isSketchMode && (
          <div className="flex items-center gap-1 px-2">
            <div 
              className="w-6 h-6 rounded-full border-2 border-white"
              style={{ backgroundColor: SKETCH_COLOR }}
              title={t('redGuides')}
            />
            <span className="text-xs text-slate-400">{t('redGuides')}</span>
          </div>
        )}

        {/* Eraser */}
        <button
          onClick={() => onToolChange('eraser')}
          disabled={isRendering}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            activeTool === 'eraser'
              ? 'bg-rose-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={t('eraser')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        <div className="w-px h-6 bg-slate-600 mx-2" />

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={isRendering || !canUndo}
          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('undo')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={isRendering || !canRedo}
          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('redo')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          disabled={isRendering}
          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('clearCanvas')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Render button */}
      <button
        onClick={onRenderWithAI}
        disabled={isRendering}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-lg font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        {t('renderWithAI')}
      </button>
    </div>
  );
}
