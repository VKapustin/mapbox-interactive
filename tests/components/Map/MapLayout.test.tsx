import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromLonLat } from 'ol/proj';
import MapLayout from '@/components/Map/MapLayout';
import { useFeatureSelect, useMap, useSearchMarker } from '@/hooks/map';
import { useWikipediaSummary } from '@/hooks/wikipedia';
import { createMapContextValue } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn(), useSearchMarker: vi.fn(), useFeatureSelect: vi.fn() }));
vi.mock('@/hooks/wikipedia', () => ({ useWikipediaSummary: vi.fn() }));

describe('MapLayout', () => {
  beforeEach(() => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue());
    vi.mocked(useSearchMarker).mockReturnValue({ showResult: vi.fn(), clearResult: vi.fn() });
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: null, clearSelected: vi.fn() });
    vi.mocked(useWikipediaSummary).mockReturnValue({ status: 'loading', summary: null });
  });

  it('renders the search box, map style picker, landmark toggles, zoom buttons, Mapbox logo and developer credit', () => {
    renderWithTheme(<MapLayout />);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();

    expect(screen.getByRole('combobox', { name: 'Search places' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Map style' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Landmarks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mapbox' })).toHaveAttribute('href', 'https://www.mapbox.com/');
    expect(screen.getByRole('link', { name: 'Viacheslav Kapustin' })).toHaveAttribute('href', 'https://github.com/VKapustin/');
  });

  it('starts with the details drawer closed', () => {
    renderWithTheme(<MapLayout />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('opens the details drawer from the popup\'s "Show more info…" link, and closes it', async () => {
    vi.mocked(useFeatureSelect).mockReturnValue({
      selected: {
        layerId: 'landmarks',
        name: 'Coit Tower',
        coordinate: fromLonLat([-122.4058, 37.8024]),
        lonLat: [-122.4058, 37.8024],
      },
      clearSelected: vi.fn(),
    });
    const user = userEvent.setup();

    renderWithTheme(<MapLayout />);
    // Hidden: without a real map the popup's overlay never shows (see MapFeaturePopup tests).
    await user.click(screen.getByRole('button', { name: 'Show more info…', hidden: true }));

    expect(screen.getByRole('complementary', { name: 'Coit Tower' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close details' }));

    // MUI keeps the empty paper mounted while it slides out, so check the content is gone.
    expect(screen.queryByRole('complementary', { name: 'Coit Tower' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close details' })).not.toBeInTheDocument();
  });

  it('closes the popup first, then the drawer, on Escape', async () => {
    const clearSelected = vi.fn();
    const landmark = (name: string, lonLat: [number, number]) => ({
      layerId: 'landmarks',
      name,
      coordinate: fromLonLat(lonLat),
      lonLat,
    });
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: landmark('Coit Tower', [-122.4058, 37.8024]), clearSelected });
    const user = userEvent.setup();

    // Open the drawer from the popup; the popup closes as the drawer opens.
    const { rerender } = renderWithTheme(<MapLayout />);
    await user.click(screen.getByRole('button', { name: 'Show more info…', hidden: true }));
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: null, clearSelected });
    rerender(<MapLayout />);

    // Then click another landmark: its popup opens on top of the drawer.
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: landmark('Ferry Building', [-122.3934, 37.7955]), clearSelected });
    rerender(<MapLayout />);
    clearSelected.mockClear();

    // The most recently opened closes first: the popup, leaving the drawer.
    await user.keyboard('{Escape}');
    expect(clearSelected).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('complementary', { name: 'Coit Tower' })).toBeInTheDocument();

    // With the popup gone, the next Escape closes the drawer.
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: null, clearSelected });
    rerender(<MapLayout />);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Coit Tower' })).not.toBeInTheDocument();
  });
});
