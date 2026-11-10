'use client';

import React, {FC} from 'react';
import {Alert, Snackbar, Tooltip} from '@mui/material';
import DrawIcon from '@mui/icons-material/Draw';
import EraserIcon from '@/components/icons/EraserIcon';
import {DrawingToolButton, DrawingToolContainer} from '@/components/DrawingTool/styles/drawingTool.styles';
import {useDraw} from '@/hooks/draw';
import {useMap} from '@/hooks/map';
import {useString} from '@/hooks/string';
import {useEscape} from '@/hooks/escape';
import {DRAWING_TOOL_BOTTOM, MAP_BUTTON_SIZE, MAP_CONTROL_GAP} from '@/constant/constant';

// The warning's distance from the right edge: past the drawing tool, plus a gap.
const SNACKBAR_RIGHT = MAP_CONTROL_GAP + MAP_BUTTON_SIZE + MAP_CONTROL_GAP;

// Draws an area of interest on the map, and clears it. Says so when a drawn
// polygon can't be used.
const DrawingTool: FC = () => {
  const { aoi } = useMap();
  const { isDrawing, startDrawing, stopDrawing, clearDrawing, areaRejected, dismissAreaRejected } = useDraw();
  const text = useString('drawingTool');
  const drawLabel = isDrawing ? text.stopDrawing : text.draw;
  const nothingToClear = !aoi && !isDrawing;

  // Escape dismisses the warning through the shared Escape stack (only if it's
  // the most recently opened thing), not through the Snackbar's own listener.
  useEscape(areaRejected, dismissAreaRejected);

  return (
    <>
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
        {/* Says why it's soft-disabled when there's nothing to clear. */}
        <Tooltip title={nothingToClear ? text.nothingToClear : text.clear} placement='left' describeChild>
          <DrawingToolButton
            aria-label={text.clear}
            softDisabled={nothingToClear}
            onClick={clearDrawing}
          >
            <EraserIcon fontSize='small' />
          </DrawingToolButton>
        </Tooltip>
      </DrawingToolContainer>
      {/* Beside the button stack, not in it: its divider rule and stacking context
          shouldn't apply to the warning. */}
      <Snackbar
        open={areaRejected}
        autoHideDuration={6000}
        // Next to the drawing tool it's about, to its left and level with its
        // bottom: clear of the search box and panel along the top, the zoom
        // buttons below and the credits in the corners. (Set for every screen
        // size, as MUI's own offsets change at the 'sm' breakpoint.)
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{
          bottom: { xs: DRAWING_TOOL_BOTTOM, sm: DRAWING_TOOL_BOTTOM },
          right: { xs: SNACKBAR_RIGHT, sm: SNACKBAR_RIGHT },
          left: { xs: MAP_CONTROL_GAP, sm: 'auto' },
        }}
        // Only its timer closes it here: clicking the map (to draw again) shouldn't
        // dismiss it, and Escape is handled by useEscape above.
        onClose={(_, reason) => reason === 'timeout' && dismissAreaRejected()}
      >
        <Alert severity='warning' onClose={dismissAreaRejected}>
          {text.areaRejected}
        </Alert>
      </Snackbar>
    </>
  );
}

export default DrawingTool;
