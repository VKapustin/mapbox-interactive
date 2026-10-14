import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Map from 'ol/Map';
import View from 'ol/View';
import MapZoomControls from '@/components/MapZoomControls/MapZoomControls';
import { useMap } from '@/hooks/map';
import { ZOOM_ANIMATION_MS } from '@/constant/constant';
import { createMapContextValue } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn() }));

const createMap = (zoom: number) =>
  new Map({ view: new View({ center: [0, 0], zoom, minZoom: 2, maxZoom: 19 }) });

describe('MapZoomControls', () => {
  let map: Map;

  beforeEach(() => {
    map = createMap(9);
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map }));
  });

  it('renders zoom in and zoom out buttons', () => {
    renderWithTheme(<MapZoomControls />);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });

  it('zooms in by one level', async () => {
    const animate = vi.spyOn(map.getView(), 'animate');
    const user = userEvent.setup();

    renderWithTheme(<MapZoomControls />);
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));

    expect(animate).toHaveBeenCalledWith({ zoom: 10, duration: ZOOM_ANIMATION_MS });
  });

  it('zooms out by one level', async () => {
    const animate = vi.spyOn(map.getView(), 'animate');
    const user = userEvent.setup();

    renderWithTheme(<MapZoomControls />);
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));

    expect(animate).toHaveBeenCalledWith({ zoom: 8, duration: ZOOM_ANIMATION_MS });
  });

  it('snaps a fractional zoom to the next whole level', async () => {
    map.getView().setZoom(9.4);
    const animate = vi.spyOn(map.getView(), 'animate');
    const user = userEvent.setup();

    renderWithTheme(<MapZoomControls />);
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));

    expect(animate).toHaveBeenCalledWith(expect.objectContaining({ zoom: 10 }));
  });

  it('disables zoom in at the maximum zoom', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map: createMap(19) }));

    renderWithTheme(<MapZoomControls />);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });

  it('disables zoom out at the minimum zoom', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map: createMap(2) }));

    renderWithTheme(<MapZoomControls />);

    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  });

  it('updates when the zoom changes elsewhere, e.g. by scrolling', () => {
    renderWithTheme(<MapZoomControls />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();

    act(() => map.getView().setZoom(19));

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  });

  it('is disabled until the map is available', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map: null }));

    renderWithTheme(<MapZoomControls />);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  });
});
