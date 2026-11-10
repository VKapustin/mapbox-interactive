'use client';

import { FC, useId, useState } from 'react';
import {
  FormControlLabel,
  FormGroup,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandIcon,
  LandmarksActions,
  LandmarksMessage,
  LandmarksRoot,
  LayerList,
  LayerListCollapse,
  LandmarksTitle,
  LandmarksTitleWrapper,
  LayerCheckbox,
  LayerRow,
} from '@/components/LandmarksControl/styles/landmarksControl.styles';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import SoftDisabledIconButton from '@/components/SoftDisabledIconButton/SoftDisabledIconButton';
import { useMap } from '@/hooks/map';
import { getDataLayerStyle } from '@/helpers/mapHelpers';
import { type MapDataLayerConfig } from 'MapTypes';
import { useString } from '@/hooks/string';
import { useStoredBoolean } from '@/hooks/storage';
import { STORAGE_KEYS } from '@/constant/constant';

// Shows, hides and zooms to the landmark layers from the map config (one per
// country). Each layer's checkbox is a circle in the color of its points on
// the map, so it doubles as the legend. The control fits in the room left in
// the top-right panel, with the list of layers scrolling inside; the list can
// also be collapsed to free up the map, e.g. on a phone, and this browser
// remembers whether it was open. While an area of interest is drawn, says so when no
// landmarks are inside it (also while the list is collapsed), and a country
// with none inside can't be zoomed to. Renders nothing when there are no layers.
const LandmarksControl: FC = () => {
  const {
    config,
    status,
    layerVisibility,
    setLayerVisible,
    zoomToLayer,
    zoomToLayers,
    aoiSummary,
    aoiSummaryFailed,
  } = useMap();
  const text = useString('landmarksControl');
  const isVisible = (layer: MapDataLayerConfig) => layerVisibility[layer.id] ?? layer.visible;
  const isEmptyInAoi = (layer: MapDataLayerConfig) => aoiSummary?.[layer.id]?.count === 0;
  const noneInAoi = !!aoiSummary && config.layers.every(isEmptyInAoi);
  const [expanded, setExpanded] = useStoredBoolean(STORAGE_KEYS.landmarksListExpanded, true);

  // The remembered state is applied just after the page loads; only animate
  // once the user toggles the list, so a collapsed list doesn't visibly close.
  const [animate, setAnimate] = useState(false);
  const listId = useId();

  if (config.layers.length === 0) {
    return null;
  }

  return (
    <LandmarksRoot>
      <LandmarksTitleWrapper>
        <LandmarksTitle>{text.title}</LandmarksTitle>
        <LandmarksActions>
          <Tooltip
            // Says why it's soft-disabled while a style loads.
            title={status === 'loading' ? text.zoomWhileLoading : text.zoomToAll}
            placement={'auto'}
            describeChild
          >
            <SoftDisabledIconButton
              size='small'
              aria-label={text.zoomToAll}
              softDisabled={status === 'loading'}
              onClick={zoomToLayers}
            >
              <ZoomInMapIcon fontSize='small' />
            </SoftDisabledIconButton>
          </Tooltip>
          <Tooltip
            title={expanded ? text.collapseList : text.expandList}
            placement={'auto'}
          >
            {/* A fixed name; aria-expanded says whether the list is open. */}
            <IconButton
              size='small'
              aria-label={text.list}
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => {
                setAnimate(true);
                setExpanded(!expanded);
              }}
            >
              <ExpandIcon fontSize='small' expanded={expanded} />
            </IconButton>
          </Tooltip>
        </LandmarksActions>
      </LandmarksTitleWrapper>
      {/* Always rendered, so screen readers announce the text when it appears. */}
      <LandmarksMessage role='status'>
        {noneInAoi ? text.noneInAoi : aoiSummaryFailed ? text.aoiFailed : null}
      </LandmarksMessage>
      {/* Collapsed, the list is hidden from screen readers and the keyboard too. */}
      <LayerListCollapse
        id={listId}
        in={expanded}
        timeout={animate ? undefined : 0}
      >
        {/* Scrolls when the list is taller than the room left under the title. */}
        <LayerList>
          <FormGroup>
            {config.layers.map((layer) => (
              <LayerRow key={layer.id}>
                <FormControlLabel
                  label={layer.label}
                  control={
                    <LayerCheckbox
                      size='small'
                      layerColor={getDataLayerStyle(layer.style).fill}
                      icon={<RadioButtonUncheckedIcon fontSize='small' />}
                      checkedIcon={<RadioButtonCheckedIcon fontSize='small' />}
                      checked={isVisible(layer)}
                      onChange={(event) => setLayerVisible(layer.id, event.target.checked)}
                    />
                  }
                />
                <Tooltip
                  // Says why it's disabled when the area holds none of this layer's landmarks.
                  title={
                    status === 'loading'
                      ? text.zoomWhileLoading
                      : isEmptyInAoi(layer) ? text.zoomToEmpty : `${text.zoomTo} ${layer.label}`
                  }
                  placement={'auto'}
                  describeChild
                >
                  {/* Soft-disabled rather than disabled, so the reason shows on hover and
                      keyboard focus, and screen readers hear it (describeChild). */}
                  <SoftDisabledIconButton
                    size='small'
                    aria-label={`${text.zoomTo} ${layer.label}`}
                    softDisabled={status === 'loading' || isEmptyInAoi(layer)}
                    onClick={() => zoomToLayer(layer.id)}
                  >
                    <ZoomInMapIcon fontSize='small' />
                  </SoftDisabledIconButton>
                </Tooltip>
              </LayerRow>
            ))}
          </FormGroup>
        </LayerList>
      </LayerListCollapse>
    </LandmarksRoot>
  );
}

export default LandmarksControl;
