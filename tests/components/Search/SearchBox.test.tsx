import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import SearchBox from '@/components/Search/SearchBox';
import { useMap } from '@/hooks/map';
import { createMapContextValue } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn() }));

const features = [
  {
    id: 'f-1',
    geometry: { coordinates: [-122.4058, 37.8024] },
    properties: { mapbox_id: 'coit', name: 'Coit Tower', place_formatted: 'San Francisco, California' },
  },
  {
    id: 'f-2',
    geometry: { coordinates: [-122.4783, 37.8199] },
    properties: { mapbox_id: 'ggb', name: 'Golden Gate Bridge', place_formatted: 'San Francisco, California' },
  },
];

const searchResponse = () =>
  new Response(JSON.stringify({ features }), { headers: { 'content-type': 'application/json' } });

const searchUrls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([url]) => new URL(url, 'http://localhost'));

describe('SearchBox', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => searchResponse());
    vi.mocked(useMap).mockReturnValue(createMapContextValue());
  });

  const setup = (props: Partial<Parameters<typeof SearchBox>[0]> = {}) => {
    const onSelect = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();

    renderWithTheme(<SearchBox onSelect={onSelect} onClear={onClear} {...props} />);

    return { user, onSelect, onClear, input: screen.getByRole('combobox', { name: 'Search places' }) };
  };

  it('shows suggestions for a query', async () => {
    const { user, input } = setup();

    await user.type(input, 'Coit');

    expect(await screen.findByRole('option', { name: /Coit Tower/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Golden Gate Bridge/ })).toHaveTextContent('San Francisco, California');
  });

  it('waits for typing to pause and sends one request', async () => {
    const { user, input } = setup();

    await user.type(input, 'Coit');
    await screen.findByRole('option', { name: /Coit Tower/ });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(searchUrls(fetchMock)[0].searchParams.get('q')).toBe('Coit');
  });

  it('does not search for a single character', async () => {
    const { user, input } = setup();

    await user.type(input, 'C');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('biases results toward the map center', async () => {
    const map = new Map({ view: new View({ center: fromLonLat([-122.2, 37.6]), zoom: 9 }) });
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map }));
    const { user, input } = setup();

    await user.type(input, 'Coit');
    await screen.findByRole('option', { name: /Coit Tower/ });

    const [lon, lat] = searchUrls(fetchMock)[0].searchParams.get('proximity')!.split(',').map(Number);
    expect(lon).toBeCloseTo(-122.2, 6);
    expect(lat).toBeCloseTo(37.6, 6);
  });

  it('selects a suggestion with the keyboard', async () => {
    const { user, input, onSelect } = setup();

    await user.type(input, 'Coit');
    await screen.findByRole('option', { name: /Coit Tower/ });
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: 'coit',
      name: 'Coit Tower',
      center: [-122.4058, 37.8024],
    }));
    expect(input).toHaveValue('Coit Tower');
  });

  it('selects a suggestion with the mouse', async () => {
    const { user, input, onSelect } = setup();

    await user.type(input, 'Golden');
    await user.click(await screen.findByRole('option', { name: /Golden Gate Bridge/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ggb' }));
  });

  it('does not search again for the selected name', async () => {
    const { user, input } = setup();

    await user.type(input, 'Coit');
    await screen.findByRole('option', { name: /Coit Tower/ });
    await user.keyboard('{Enter}');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when the clear button is pressed', async () => {
    const { user, input, onClear } = setup();

    await user.type(input, 'Coit');
    await screen.findByRole('option', { name: /Coit Tower/ });
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });

  it('calls onClear when the text is deleted', async () => {
    const { user, input, onClear } = setup();

    await user.type(input, 'Co');
    expect(onClear).not.toHaveBeenCalled();

    await user.clear(input);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows a message when search fails', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 500 }));
    const { user, input } = setup();

    await user.type(input, 'Coit');

    expect(await screen.findByText('Search is unavailable right now.')).toBeInTheDocument();
  });

  it('shows a message when nothing matches', async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ features: [] }), { headers: { 'content-type': 'application/json' } }));
    const { user, input } = setup();

    await user.type(input, 'zzzz');

    await waitFor(() => expect(screen.getByText('No places found')).toBeInTheDocument());
  });
});
