import MapLayout from "@/components/Map/MapLayout";
import { PageWrapper } from "@/app/styles/page.styles";
import { MapProvider } from "@/hooks/map";
import {StringProvider} from '@/hooks/string';
import {strings} from '@/server/strings/strings';
import { getMapConfig } from "@/server/map/mapConfig";

export default async function Home() {
  // Loaded on the server so the map starts with its config, without a round trip.
  const config = await getMapConfig();

  return (
    <PageWrapper>
      {/* Outermost, so anything inside, including the map provider, can use strings. */}
      <StringProvider strings={strings}>
        <MapProvider config={config}>
          <MapLayout />
        </MapProvider>
      </StringProvider>
    </PageWrapper>
  );
}
