import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandmarksControl from '@/components/LandmarksControl/LandmarksControl';
import { useMap } from '@/hooks/map';
import { DATA_LAYER_STYLE_DEFAULTS } from '@/constant/constant';
import { createMapContextValue, testMapConfig } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';
import { type MapDataLayerConfig } from 'MapTypes';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn() }));

describe('LandmarksControl', () => {
  beforeEach(() => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue());
  });

  it('shows a checkbox per layer reflecting its visibility', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ layerVisibility: { landmarks: false } }));

    renderWithTheme(<LandmarksControl />);

    expect(screen.getByRole('checkbox', { name: 'Landmarks' })).not.toBeChecked();
  });

  it('toggles a layer', async () => {
    const setLayerVisible = vi.fn();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ setLayerVisible }));
    const user = userEvent.setup();

    renderWithTheme(<LandmarksControl />);
    await user.click(screen.getByRole('checkbox', { name: 'Landmarks' }));

    expect(setLayerVisible).toHaveBeenCalledWith('landmarks', false);
  });

  it('zooms to a layer from its button', async () => {
    const zoomToLayer = vi.fn();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ zoomToLayer }));
    const user = userEvent.setup();

    renderWithTheme(<LandmarksControl />);
    await user.click(screen.getByRole('button', { name: 'Zoom to Landmarks' }));

    expect(zoomToLayer).toHaveBeenCalledWith('landmarks');
  });

  it('shows and zooms to all layers from the button next to the Landmarks title', async () => {
    const zoomToLayers = vi.fn();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ zoomToLayers }));
    const user = userEvent.setup();

    renderWithTheme(<LandmarksControl />);
    await user.click(screen.getByRole('button', { name: 'Show and zoom to all landmarks' }));

    expect(zoomToLayers).toHaveBeenCalledTimes(1);
  });

  it.each(['Zoom to Landmarks', 'Show and zoom to all landmarks'])('shows a "%s" tooltip on hover', async (name) => {
    const user = userEvent.setup();

    renderWithTheme(<LandmarksControl />);
    await user.hover(screen.getByRole('button', { name }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(name);
  });

  it('disables zooming to a layer while a style is loading', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ status: 'loading' }));

    renderWithTheme(<LandmarksControl />);

    expect(screen.getByRole('button', { name: 'Zoom to Landmarks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show and zoom to all landmarks' })).toBeDisabled();
  });

  describe('layer checkboxes as colored circles', () => {
    // The MUI checkbox root around the (transparent) input.
    const getControl = (name: string) => screen.getByRole('checkbox', { name }).closest('.MuiCheckbox-root')!;
    const withLayers = (...layers: MapDataLayerConfig[]) =>
      vi.mocked(useMap).mockReturnValue(createMapContextValue({ config: { ...testMapConfig, layers } }));

    it('draws a shown layer as a filled circle in its color', () => {
      withLayers({ ...testMapConfig.layers[0], style: { fill: '#dc2626' } });

      renderWithTheme(<LandmarksControl />);

      expect(getControl('Landmarks')).toHaveStyle({ color: '#dc2626' });
      expect(getControl('Landmarks').querySelector('[data-testid="RadioButtonCheckedIcon"]')).not.toBeNull();
    });

    it('draws a hidden layer as an empty ring, still in its color', () => {
      vi.mocked(useMap).mockReturnValue(createMapContextValue({
        config: { ...testMapConfig, layers: [{ ...testMapConfig.layers[0], style: { fill: '#dc2626' } }] },
        layerVisibility: { landmarks: false },
      }));

      renderWithTheme(<LandmarksControl />);

      expect(getControl('Landmarks')).toHaveStyle({ color: '#dc2626' });
      expect(getControl('Landmarks').querySelector('[data-testid="RadioButtonUncheckedIcon"]')).not.toBeNull();
    });

    it('uses the default point color when the layer has no style', () => {
      renderWithTheme(<LandmarksControl />);

      expect(getControl('Landmarks')).toHaveStyle({ color: DATA_LAYER_STYLE_DEFAULTS.fill });
    });

    it('stays a checkbox per layer, so several layers can be shown at once', () => {
      vi.mocked(useMap).mockReturnValue(createMapContextValue({
        config: {
          ...testMapConfig,
          layers: [
            { ...testMapConfig.layers[0], style: { fill: '#dc2626' } },
            { ...testMapConfig.layers[0], id: 'more', label: 'More', style: { fill: '#16a34a' } },
          ],
        },
        layerVisibility: { landmarks: true, more: true },
      }));

      renderWithTheme(<LandmarksControl />);

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Landmarks' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'More' })).toBeChecked();
      expect(getControl('More')).toHaveStyle({ color: '#16a34a' });
    });

    it('leaves the zoom buttons in their normal color', () => {
      withLayers({ ...testMapConfig.layers[0], style: { fill: '#dc2626' } });

      renderWithTheme(<LandmarksControl />);

      expect(screen.getByRole('button', { name: 'Zoom to Landmarks' })).not.toHaveStyle({ color: '#dc2626' });
    });
  });

  it('renders nothing when there are no layers', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({
      config: { ...testMapConfig, layers: [] },
    }));

    const { container } = renderWithTheme(<LandmarksControl />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Landmarks title', () => {
    renderWithTheme(<LandmarksControl />);

    expect(screen.getByText('Landmarks', { selector: 'p' })).toBeInTheDocument();
  });

  describe('with an area of interest', () => {
    it('says so when no landmarks are inside the area', () => {
      vi.mocked(useMap).mockReturnValue(createMapContextValue({
        aoi: '{}',
        aoiSummary: { landmarks: { count: 0, total: 5, extent: null } },
      }));

      renderWithTheme(<LandmarksControl />);

      expect(screen.getByRole('status')).toHaveTextContent('No landmarks in the selected area.');
      expect(screen.getByRole('button', { name: 'Zoom to Landmarks' })).toBeDisabled();
      // The layers can still be shown and hidden.
      expect(screen.getByRole('checkbox', { name: 'Landmarks' })).toBeEnabled();
    });

    it('says nothing when some are inside', () => {
      vi.mocked(useMap).mockReturnValue(createMapContextValue({
        aoi: '{}',
        aoiSummary: { landmarks: { count: 2, total: 5, extent: [0, 0, 1, 1] } },
      }));

      renderWithTheme(<LandmarksControl />);

      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(screen.getByRole('button', { name: 'Zoom to Landmarks' })).toBeEnabled();
    });

    it('says nothing while the area\'s summary is loading', () => {
      vi.mocked(useMap).mockReturnValue(createMapContextValue({ aoi: '{}', aoiSummary: null }));

      renderWithTheme(<LandmarksControl />);

      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
  });

  describe('collapsing the list', () => {
    afterEach(() => {
      window.localStorage.clear();
    });

    const getToggle = () => screen.getByRole('button', { name: 'Landmark list' });
    // MUI draws its own checkbox over a transparent <input>, so check the row's label.
    const getLayerRow = () => screen.getByRole('checkbox', { name: 'Landmarks' }).closest('label')!;

    it('starts expanded, with the button pointing at the list', () => {
      renderWithTheme(<LandmarksControl />);

      expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
      expect(document.getElementById(getToggle().getAttribute('aria-controls')!)).toContainElement(
        screen.getByRole('checkbox', { name: 'Landmarks' }),
      );
      expect(getLayerRow()).toBeVisible();
    });

    it('collapses and expands the list', async () => {
      const user = userEvent.setup();
      renderWithTheme(<LandmarksControl />);

      await user.click(getToggle());

      expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
      // Collapsed, MUI hides the list once the animation ends.
      await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Landmarks' })).not.toBeInTheDocument());

      await user.click(getToggle());

      expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
      expect(getLayerRow()).toBeVisible();
    });

    it.each([
      [true, 'Collapse the list'],
      [false, 'Expand the list'],
    ])('says what the button does in its tooltip (expanded: %s)', async (expanded, tooltip) => {
      const user = userEvent.setup();
      renderWithTheme(<LandmarksControl />);

      if (!expanded) {
        await user.click(getToggle());
      }
      await user.hover(getToggle());

      expect(await screen.findByRole('tooltip')).toHaveTextContent(tooltip);
    });

    it('keeps the title, the zoom-to-all button and the no-landmarks message while collapsed', async () => {
      vi.mocked(useMap).mockReturnValue(createMapContextValue({
        aoi: '{}',
        aoiSummary: { landmarks: { count: 0, total: 5, extent: null } },
      }));
      const user = userEvent.setup();
      renderWithTheme(<LandmarksControl />);

      await user.click(getToggle());

      expect(screen.getByText('Landmarks', { selector: 'p' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Show and zoom to all landmarks' })).toBeVisible();
      expect(screen.getByRole('status')).toHaveTextContent('No landmarks in the selected area.');
    });
  });

  describe('remembering the list\'s state', () => {
    const KEY = 'mapbox-interactive:landmarks-list-expanded';
    const getToggle = () => screen.getByRole('button', { name: 'Landmark list' });

    afterEach(() => {
      window.localStorage.clear();
    });

    it('remembers that the list was collapsed', async () => {
      const user = userEvent.setup();
      const { unmount } = renderWithTheme(<LandmarksControl />);
      await user.click(getToggle());
      unmount();

      renderWithTheme(<LandmarksControl />);

      expect(window.localStorage.getItem(KEY)).toBe('false');
      expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('checkbox', { name: 'Landmarks' })).not.toBeInTheDocument();
    });

    it('remembers that it was opened again', async () => {
      window.localStorage.setItem(KEY, 'false');
      const user = userEvent.setup();
      renderWithTheme(<LandmarksControl />);

      await user.click(getToggle());

      expect(window.localStorage.getItem(KEY)).toBe('true');
    });
  });
});
