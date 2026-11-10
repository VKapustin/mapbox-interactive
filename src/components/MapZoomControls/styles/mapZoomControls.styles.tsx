import { IconButton } from '@mui/material'
import {styled} from '@mui/material/styles';
import { ZOOM_CONTROLS_BOTTOM } from '@/constant/constant';
import { MapButtonStack, mapStackButtonStyle } from '@/components/MapButtonStack/styles/mapButtonStack.styles';

// Bottom right, just above the attribution text that OpenLayers draws in the corner.
export const MapZoomControlsWrapper = styled(MapButtonStack)({
  bottom: `${ZOOM_CONTROLS_BOTTOM}px`,
});

export const MapZoomButton = styled(IconButton)(mapStackButtonStyle);
