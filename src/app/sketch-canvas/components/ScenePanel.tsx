'use client';

import React, { useEffect, useState } from 'react';
import { SceneState } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import type { SketchCanvasRef } from './SketchCanvas';

interface ScenePanelProps {
  sceneState: SceneState;
  canvasRef: React.RefObject<SketchCanvasRef | null>;
}

export function ScenePanel({ sceneState, canvasRef }: ScenePanelProps) {
  const { t } = useLanguage();
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  // Update thumbnail periodically
  useEffect(() => {
    const updateThumbnail = () => {
      if (canvasRef.current) {
        setThumbnail(canvasRef.current.getSketchBase64());
      }
    };

    updateThumbnail();
    const interval = setInterval(updateThumbnail, 2000);
    
    return () => clearInterval(interval);
  }, [canvasRef]);

  return (
    <div className="p-4 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-white mb-4">{t('sceneInfo')}</h2>

      {/* Canvas preview */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-slate-400 mb-2">{t('canvasPreview')}</h3>
        <div className="bg-slate-700 rounded-lg p-2">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={t('canvasPreview')}
              className="w-full h-auto rounded border border-slate-600"
            />
          ) : (
            <div className="aspect-video bg-slate-600 rounded flex items-center justify-center">
              <span className="text-slate-400 text-sm">{t('noContent')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scene description */}
      <div className="flex-1">
        <h3 className="text-sm font-medium text-slate-400 mb-2">{t('sceneDescription')}</h3>
        <div className="bg-slate-700 rounded-lg p-3 text-sm">
          {sceneState.description ? (
            <p className="text-slate-200">{sceneState.description}</p>
          ) : (
            <p className="text-slate-500 italic">
              {t('noSceneDescription')}
            </p>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-4 bg-slate-700/50 rounded-lg p-3">
        <h3 className="text-sm font-medium text-slate-400 mb-2">💡 {t('tips')}</h3>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• {t('tipDraw')}</li>
          <li>• {t('tipAddSun')}</li>
          <li>• {t('tipRemove')}</li>
          <li>• {t('tipRender')}</li>
        </ul>
      </div>
    </div>
  );
}
