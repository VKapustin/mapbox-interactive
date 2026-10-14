'use client';

import { FC } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { StyleThumbnail } from '@/components/MapStyleControl/styles/mapStyleControl.styles';
import { STYLE_THUMBNAIL_SIZE } from '@/constant/constant';
import { useMap } from '@/hooks/map';
import { useString } from '@/hooks/string';

// Picks the basemap style from the map config, with a thumbnail of each style.
const MapStyleControl: FC = () => {
  const { config, status, styleId, setStyle } = useMap();
  const text = useString('mapStyleControl');

  return (
    <TextField
      select
      size='small'
      label={text.label}
      value={styleId}
      disabled={status === 'loading'}
      onChange={(event) => setStyle(event.target.value)}
      slotProps={{
        select: {
          // Text only in the input; the thumbnails are for the menu.
          renderValue: (value) => config.styles.find((style) => style.id === value)?.label,
        },
      }}
    >
      {config.styles.map((style) => (
        <MenuItem key={style.id} value={style.id}>
          {/* Decorative: the style name right after it says the same. */}
          <StyleThumbnail
            src={style.imageUrl}
            alt=''
            width={STYLE_THUMBNAIL_SIZE}
            height={STYLE_THUMBNAIL_SIZE}
          />
          {style.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

export default MapStyleControl;
