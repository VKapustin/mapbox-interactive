import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type Map from 'ol/Map';
import MapCanvas from '@/components/Map/MapCanvas';
import { useMap } from '@/hooks/map';
import { createMapContextValue } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn() }));

const createMapStub = () => ({ setTarget: vi.fn() }) as unknown as Map & { setTarget: ReturnType<typeof vi.fn> };

describe('MapCanvas', () => {
  beforeEach(() => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue());
  });

  it('shows a loading indicator while the style loads', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ status: 'loading' }));

    renderWithTheme(<MapCanvas />);

    expect(screen.getByRole('progressbar', { name: 'Loading map' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error when the style fails to load', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ status: 'error', map: createMapStub() }));

    renderWithTheme(<MapCanvas />);

    expect(screen.getByRole('alert')).toHaveTextContent('The map style couldn\'t be loaded');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows neither once the map is ready', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ status: 'ready', map: createMapStub() }));

    renderWithTheme(<MapCanvas />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('attaches the map to its element and detaches it on unmount', () => {
    const map = createMapStub();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map }));

    const { unmount } = renderWithTheme(<MapCanvas />);

    expect(map.setTarget).toHaveBeenCalledTimes(1);
    expect(map.setTarget.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);

    unmount();

    expect(map.setTarget).toHaveBeenLastCalledWith(undefined);
  });

  it('keeps the map element mounted while loading', () => {
    const map = createMapStub();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map, status: 'loading' }));

    renderWithTheme(<MapCanvas />);

    expect(map.setTarget.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
  });
});
