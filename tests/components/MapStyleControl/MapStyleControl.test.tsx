import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MapStyleControl from '@/components/MapStyleControl/MapStyleControl';
import { useMap } from '@/hooks/map';
import { createMapContextValue, testMapConfig } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn() }));

describe('MapStyleControl', () => {
  beforeEach(() => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue());
  });

  it('shows the current style', () => {
    renderWithTheme(<MapStyleControl />);

    expect(screen.getByRole('combobox', { name: 'Map style' })).toHaveTextContent('Streets');
  });

  it('lists every configured style and switches to the chosen one', async () => {
    const setStyle = vi.fn();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ setStyle }));
    const user = userEvent.setup();

    renderWithTheme(<MapStyleControl />);
    await user.click(screen.getByRole('combobox', { name: 'Map style' }));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option').map((option) => option.textContent))
      .toEqual(testMapConfig.styles.map((style) => style.label));

    await user.click(within(listbox).getByRole('option', { name: 'Dark' }));

    expect(setStyle).toHaveBeenCalledWith('dark');
  });

  it('shows a thumbnail before each style name in the menu', async () => {
    const user = userEvent.setup();

    renderWithTheme(<MapStyleControl />);
    await user.click(screen.getByRole('combobox', { name: 'Map style' }));

    for (const style of testMapConfig.styles) {
      const option = screen.getByRole('option', { name: style.label });
      const image = option.querySelector('img');
      expect(image).toHaveAttribute('src', style.imageUrl);
      // Decorative, so it doesn't change the option's accessible name.
      expect(image).toHaveAttribute('alt', '');
      expect(option.firstElementChild).toBe(image);
    }
  });

  it('shows only the style name in the input', () => {
    renderWithTheme(<MapStyleControl />);

    const input = screen.getByRole('combobox', { name: 'Map style' });
    expect(input).toHaveTextContent('Streets');
    expect(input.querySelector('img')).toBeNull();
  });

  it('disables the style picker while a style is loading', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ status: 'loading' }));

    renderWithTheme(<MapStyleControl />);

    expect(screen.getByRole('combobox', { name: 'Map style' })).toHaveAttribute('aria-disabled', 'true');
  });
});
