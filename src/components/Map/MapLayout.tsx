'use client';

import { FC, useState } from 'react';
import MapCanvas from '@/components/Map/MapCanvas';
import LandmarksControl from '@/components/LandmarksControl/LandmarksControl';
import MapFeatureDrawer from '@/components/MapFeatureDrawer/MapFeatureDrawer';
import MapFeaturePopup from '@/components/MapFeaturePopup/MapFeaturePopup';
import MapStyleControl from '@/components/MapStyleControl/MapStyleControl';
import MapZoomControls from '@/components/MapZoomControls/MapZoomControls';
import SearchBox from '@/components/Search/SearchBox';
import { MapArea, MapboxLogo, MapControlsPanel, MapLayoutWrapper, MapTopControls } from '@/components/Map/styles/mapLayout.styles';
import { type SelectedFeature, useSearchMarker } from '@/hooks/map';
import { useString } from '@/hooks/string';
import DrawingTool from '@/components/DrawingTool/DrawingTool';
import DeveloperCredit from '@/components/DeveloperCredit/DeveloperCredit';

const MapLayout: FC = () => {
  const { showResult, clearResult } = useSearchMarker();
  const text = useString('map');
  // The feature shown in the details drawer; the drawer is open while it's set.
  const [detailsFeature, setDetailsFeature] = useState<SelectedFeature | null>(null);

  return (
    <MapLayoutWrapper>
      <MapFeatureDrawer feature={detailsFeature} onClose={() => setDetailsFeature(null)} />
      <MapArea>
        <MapCanvas />
        <MapTopControls>
          <SearchBox onSelect={showResult} onClear={clearResult} />
          <MapControlsPanel>
            <MapStyleControl />
            <LandmarksControl />
          </MapControlsPanel>
        </MapTopControls>
        <DrawingTool />
        <MapZoomControls />
        <MapFeaturePopup onShowMore={setDetailsFeature} />
        <MapboxLogo
          href='https://www.mapbox.com/'
          target='_blank'
          rel='noopener'
          aria-label={text.mapboxLogo}
        />
        <DeveloperCredit />
      </MapArea>
    </MapLayoutWrapper>
  );
}

export default MapLayout;
