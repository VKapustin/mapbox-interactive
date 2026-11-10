import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutEffect, useRef } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import MapFeaturePopup from '@/components/MapFeaturePopup/MapFeaturePopup';
import { type SelectedFeature, useFeatureSelect, useMap } from '@/hooks/map';
import { FEATURE_POPUP_OFFSET } from '@/constant/constant';
import { createMapContextValue } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn(), useFeatureSelect: vi.fn() }));

const coitTower: SelectedFeature = {
  layerId: 'landmarks',
  name: 'Coit Tower',
  description: 'Art Deco tower on Telegraph Hill.',
  coordinate: fromLonLat([-122.4058, 37.8024]),
  lonLat: [-122.4058, 37.8024],
};

// OpenLayers keeps an overlay hidden until the map draws a frame, which jsdom
// can't do, so queries for the popup's content include hidden elements.
const inOverlay = { hidden: true };

describe('MapFeaturePopup', () => {
  let map: Map;
  const clearSelected = vi.fn();

  beforeEach(() => {
    map = new Map({ view: new View({ center: [0, 0], zoom: 2 }) });
    clearSelected.mockReset();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map }));
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: null, clearSelected });
  });

  // Like MapCanvas in the app: the map element is rendered by React, so the
  // popup OpenLayers moves into it stays inside React's tree and gets its clicks.
  const MapWithPopup = ({ onShowMore }: { onShowMore?: (feature: SelectedFeature) => void }) => {
    const targetRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      map.setTarget(targetRef.current!);
      return () => map.setTarget(undefined);
    }, []);

    return (
      <>
        <div ref={targetRef} />
        <MapFeaturePopup onShowMore={onShowMore} />
      </>
    );
  };

  const getOverlay = () => map.getOverlays().item(0);

  it('adds an overlay to the map and removes it on unmount', () => {
    const { unmount } = renderWithTheme(<MapWithPopup />);

    expect(map.getOverlays().getLength()).toBe(1);

    unmount();

    expect(map.getOverlays().getLength()).toBe(0);
  });

  it('sits above the feature, leaving room for its arrow', () => {
    renderWithTheme(<MapWithPopup />);

    expect(getOverlay().getPositioning()).toBe('bottom-center');
    expect(getOverlay().getOffset()).toEqual([0, -FEATURE_POPUP_OFFSET]);
  });

  it('shows nothing until a feature is selected', () => {
    renderWithTheme(<MapWithPopup />);

    expect(screen.queryByRole('dialog', inOverlay)).not.toBeInTheDocument();
    expect(getOverlay().getPosition()).toBeUndefined();
  });

  it('shows the name and coordinates of the selected feature', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });

    renderWithTheme(<MapWithPopup />);

    const dialog = screen.getByRole('dialog', { name: 'Coit Tower', ...inOverlay });
    expect(dialog).toHaveTextContent('37.80240° N, 122.40580° W');
  });

  it('shows the description between the name and the coordinates', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });

    renderWithTheme(<MapWithPopup />);

    const dialog = screen.getByRole('dialog', { name: 'Coit Tower', ...inOverlay });
    const description = within(dialog).getByText('Art Deco tower on Telegraph Hill.');
    const name = within(dialog).getByText('Coit Tower');
    const coordinates = within(dialog).getByText('37.80240° N, 122.40580° W');
    expect(name.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(description.compareDocumentPosition(coordinates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves out the description when there is none', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({
      selected: { ...coitTower, description: undefined },
      clearSelected,
    });

    renderWithTheme(<MapWithPopup />);

    const dialog = screen.getByRole('dialog', { name: 'Coit Tower', ...inOverlay });
    expect(dialog.querySelectorAll('p')).toHaveLength(2);
  });

  it('shows the photo with a credit linking to its source and license', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({
      selected: {
        ...coitTower,
        image: {
          url: '/landmarks/coit-tower.jpg',
          author: 'Ryan Schwark',
          license: 'CC0',
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coit_Tower_1.jpg',
        },
      },
      clearSelected,
    });

    renderWithTheme(<MapWithPopup />);

    const dialog = screen.getByRole('dialog', { name: 'Coit Tower', ...inOverlay });
    const photo = dialog.querySelector('img');
    expect(photo).toHaveAttribute('src', '/landmarks/coit-tower.jpg');
    // Decorative: the name already says what it shows.
    expect(photo).toHaveAttribute('alt', '');
    expect(dialog).toHaveTextContent('Photo: Ryan Schwark, CC0');
    expect(within(dialog).getByRole('link', { name: 'Ryan Schwark', ...inOverlay }))
      .toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Coit_Tower_1.jpg');
    expect(within(dialog).getByRole('link', { name: 'CC0', ...inOverlay }))
      .toHaveAttribute('href', 'https://creativecommons.org/publicdomain/zero/1.0/');
  });

  it('leaves out a photo that fails to load, with its credit', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({
      selected: {
        ...coitTower,
        image: {
          url: '/landmarks/missing.jpg',
          author: 'Ryan Schwark',
          license: 'CC0',
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coit_Tower_1.jpg',
        },
      },
      clearSelected,
    });

    renderWithTheme(<MapWithPopup />);
    const dialog = screen.getByRole('dialog', { name: 'Coit Tower', ...inOverlay });
    fireEvent.error(dialog.querySelector('img')!);

    expect(dialog.querySelector('img')).toBeNull();
    expect(dialog).not.toHaveTextContent('Photo:');
  });

  it('shows no photo or credit when there is no photo', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });

    renderWithTheme(<MapWithPopup />);

    const dialog = screen.getByRole('dialog', { name: 'Coit Tower', ...inOverlay });
    expect(dialog.querySelector('img')).toBeNull();
    expect(dialog).not.toHaveTextContent('Photo:');
  });

  it('pins the popup to the selected feature', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });

    renderWithTheme(<MapWithPopup />);

    expect(getOverlay().getPosition()).toEqual(coitTower.coordinate);
  });

  it('hides the popup when the selection clears', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });
    const { rerender } = renderWithTheme(<MapWithPopup />);

    vi.mocked(useFeatureSelect).mockReturnValue({ selected: null, clearSelected });
    rerender(<MapWithPopup />);

    expect(getOverlay().getPosition()).toBeUndefined();
    expect(screen.queryByRole('dialog', inOverlay)).not.toBeInTheDocument();
  });

  it('opens more info and closes itself from the "Show more info…" link', async () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });
    const onShowMore = vi.fn();
    const user = userEvent.setup();

    renderWithTheme(<MapWithPopup onShowMore={onShowMore} />);
    await user.click(screen.getByRole('button', { name: 'Show more info…', ...inOverlay }));

    expect(onShowMore).toHaveBeenCalledWith(coitTower);
    expect(clearSelected).toHaveBeenCalledTimes(1);
  });

  it('has no "Show more info…" link without a handler', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });

    renderWithTheme(<MapWithPopup />);

    expect(screen.queryByRole('button', { name: 'Show more info…', ...inOverlay })).not.toBeInTheDocument();
  });

  it('closes with the close button', async () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });
    const user = userEvent.setup();

    renderWithTheme(<MapWithPopup />);
    await user.click(screen.getByRole('button', { name: 'Close', ...inOverlay }));

    expect(clearSelected).toHaveBeenCalledTimes(1);
  });

  it('closes with Escape', async () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });
    const user = userEvent.setup();

    renderWithTheme(<MapWithPopup />);
    await user.keyboard('{Escape}');

    expect(clearSelected).toHaveBeenCalledTimes(1);
  });

  it('leaves an Escape a focused control already used (e.g. the search box)', () => {
    vi.mocked(useFeatureSelect).mockReturnValue({ selected: coitTower, clearSelected });
    const handledEarlier = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', handledEarlier, true);

    renderWithTheme(<MapWithPopup />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    document.removeEventListener('keydown', handledEarlier, true);

    expect(clearSelected).not.toHaveBeenCalled();
  });

  it('ignores Escape when nothing is selected', async () => {
    const user = userEvent.setup();

    renderWithTheme(<MapWithPopup />);
    await user.keyboard('{Escape}');

    expect(clearSelected).not.toHaveBeenCalled();
  });
});
