import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromLonLat } from 'ol/proj';
import MapFeatureDrawer from '@/components/MapFeatureDrawer/MapFeatureDrawer';
import { useWikipediaSummary } from '@/hooks/wikipedia';
import { type SelectedFeature } from '@/hooks/map';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/wikipedia', () => ({ useWikipediaSummary: vi.fn() }));

const coitTower: SelectedFeature = {
  layerId: 'landmarks',
  name: 'Coit Tower',
  description: 'Art Deco tower on Telegraph Hill.',
  wikipediaTitle: 'Coit_Tower',
  image: {
    url: '/landmarks/coit-tower.jpg',
    author: 'Ryan Schwark',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coit_Tower_1.jpg',
  },
  coordinate: fromLonLat([-122.4058, 37.8024]),
  lonLat: [-122.4058, 37.8024],
};

const readySummary = {
  status: 'ready' as const,
  summary: { title: 'Coit Tower', extract: 'Coit Tower is a tower.', url: 'https://en.wikipedia.org/wiki/Coit_Tower' },
};

describe('MapFeatureDrawer', () => {
  beforeEach(() => {
    vi.mocked(useWikipediaSummary).mockReturnValue(readySummary);
  });

  const getDrawer = () => screen.getByRole('complementary', { name: 'Coit Tower' });

  it('is closed and empty without a feature', () => {
    renderWithTheme(<MapFeatureDrawer feature={null} onClose={vi.fn()} />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('shows the feature name, photo, description and coordinates', () => {
    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={vi.fn()} />);

    const drawer = getDrawer();
    expect(drawer.querySelector('img')).toHaveAttribute('src', coitTower.image!.url);
    expect(drawer).toHaveTextContent('Art Deco tower on Telegraph Hill.');
    expect(drawer).toHaveTextContent('37.80240° N, 122.40580° W');
    expect(within(drawer).getByRole('link', { name: 'Ryan Schwark' }))
      .toHaveAttribute('href', coitTower.image!.sourceUrl);
  });

  it('shows the Wikipedia summary with a link to the article and its license', () => {
    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={vi.fn()} />);

    const drawer = getDrawer();
    expect(useWikipediaSummary).toHaveBeenCalledWith('Coit_Tower');
    expect(drawer).toHaveTextContent('Coit Tower is a tower.');
    expect(within(drawer).getByRole('link', { name: 'Read more on Wikipedia' }))
      .toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Coit_Tower');
    expect(within(drawer).getByRole('link', { name: 'CC BY-SA 4.0' }))
      .toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
  });

  it('shows a placeholder while the summary loads', () => {
    vi.mocked(useWikipediaSummary).mockReturnValue({ status: 'loading', summary: null });

    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={vi.fn()} />);

    expect(within(getDrawer()).getByLabelText('Loading Wikipedia summary')).toHaveAttribute('aria-busy', 'true');
  });

  it('says when the summary is unavailable', () => {
    vi.mocked(useWikipediaSummary).mockReturnValue({ status: 'error', summary: null });

    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={vi.fn()} />);

    expect(getDrawer()).toHaveTextContent('More information isn\'t available right now.');
  });

  it('leaves out a photo that fails to load, with its credit', () => {
    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={vi.fn()} />);
    const drawer = getDrawer();

    fireEvent.error(drawer.querySelector('img')!);

    expect(drawer.querySelector('img')).toBeNull();
    expect(drawer).not.toHaveTextContent('Photo:');
  });

  it('skips the Wikipedia section and photo when the feature has neither', () => {
    renderWithTheme(
      <MapFeatureDrawer feature={{ ...coitTower, wikipediaTitle: undefined, image: undefined }} onClose={vi.fn()} />,
    );

    const drawer = getDrawer();
    expect(useWikipediaSummary).not.toHaveBeenCalled();
    expect(drawer.querySelector('img')).toBeNull();
    expect(drawer).not.toHaveTextContent('Wikipedia');
  });

  it('sits beside the map on wide screens and closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={onClose} />);

    expect(document.querySelector('.MuiDrawer-docked')).toBeInTheDocument();
    expect(document.querySelector('.MuiBackdrop-root')).toBeNull();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves an Escape a focused control already used (e.g. the search box)', () => {
    const onClose = vi.fn();
    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={onClose} />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('covers the map with a backdrop on small screens, closing on backdrop click or Escape', async () => {
    // jsdom has no matchMedia; report every media query (here: below 'md') as matching.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={onClose} />);

    expect(document.querySelector('.MuiDrawer-docked')).toBeNull();
    const backdrop = document.querySelector('.MuiBackdrop-root')!;
    expect(backdrop).toBeInTheDocument();

    // The modal drawer holds focus while open, so it gets the Escape.
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes with the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithTheme(<MapFeatureDrawer feature={coitTower} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close details' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
