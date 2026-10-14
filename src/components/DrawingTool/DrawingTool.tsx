'use client';

import React, {FC} from 'react';
import {Tooltip} from '@mui/material';
import DrawIcon from '@mui/icons-material/Draw';
import EraserIcon from '@/components/icons/EraserIcon';
import {DrawingToolButton, DrawingToolContainer} from '@/components/DrawingTool/styles/drawingTool.styles';
import {useDraw} from '@/hooks/draw';
import {useString} from '@/hooks/string';

// Draws an area of interest on the map, and clears it.
const DrawingTool: FC = () => {
  const { aoi, isDrawing, startDrawing, stopDrawing, clearDrawing } = useDraw();
  const text = useString('drawingTool');
  const drawLabel = isDrawing ? text.stopDrawing : text.draw;

  return (
    <DrawingToolContainer>
      <Tooltip title={drawLabel} placement='left'>
        <DrawingToolButton
          aria-label={text.draw}
          aria-pressed={isDrawing}
          onClick={isDrawing ? stopDrawing : startDrawing}
        >
          <DrawIcon fontSize='small' />
        </DrawingToolButton>
      </Tooltip>
      <Tooltip title={text.clear} placement='left'>
        {/* The span keeps the tooltip working while the button is disabled. */}
        <span>
          <DrawingToolButton
            aria-label={text.clear}
            disabled={!aoi && !isDrawing}
            onClick={clearDrawing}
          >
            <EraserIcon fontSize='small' />
          </DrawingToolButton>
        </span>
      </Tooltip>
    </DrawingToolContainer>
  );
}

export default DrawingTool;
