import {styled} from '@mui/material/styles';
import { STYLE_THUMBNAIL_SIZE } from '@/constant/constant';

export const StyleThumbnail = styled('img')(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    width: `${STYLE_THUMBNAIL_SIZE}px`,
    height: `${STYLE_THUMBNAIL_SIZE}px`,
    flexShrink: 0,
    marginRight: '12px',
    borderRadius: '4px',
    objectFit: 'cover',
    // Placeholder tint while the image loads.
    backgroundColor: palette.action.hover,
  };
});
