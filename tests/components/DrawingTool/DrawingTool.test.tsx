import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DrawingTool from '@/components/DrawingTool/DrawingTool';
import { useDraw } from '@/hooks/draw';
import { useMap } from '@/hooks/map';
import { useEscape } from '@/hooks/escape';
import { createMapContextValue } from '@tests/support/mapFixtures';
import { renderWithTheme } from '@tests/support/renderWithTheme';

vi.mock('@/hooks/draw', () => ({ useDraw: vi.fn() }));
vi.mock('@/hooks/map', () => ({ useMap: vi.fn() }));

const drawState = (overrides: Partial<ReturnType<typeof useDraw>> = {}): ReturnType<typeof useDraw> => ({
  isDrawing: false,
  startDrawing: vi.fn(),
  stopDrawing: vi.fn(),
  clearDrawing: vi.fn(),
  areaRejected: false,
  dismissAreaRejected: vi.fn(),
  ...overrides,
});

describe('DrawingTool', () => {
  beforeEach(() => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue());
    vi.mocked(useDraw).mockReturnValue(drawState());
  });

  it('starts drawing from the draw button', async () => {
    const state = drawState();
    vi.mocked(useDraw).mockReturnValue(state);
    const user = userEvent.setup();
    renderWithTheme(<DrawingTool />);

    await user.click(screen.getByRole('button', { name: 'Draw an area of interest' }));

    expect(state.startDrawing).toHaveBeenCalledTimes(1);
  });

  it('soft-disables the eraser with nothing to clear, still showing its tooltip', async () => {
    const state = drawState();
    vi.mocked(useDraw).mockReturnValue(state);
    const user = userEvent.setup();
    renderWithTheme(<DrawingTool />);
    const eraser = screen.getByRole('button', { name: 'Clear the area of interest' });

    await user.click(eraser);

    expect(eraser).toHaveAttribute('aria-disabled', 'true');
    expect(state.clearDrawing).not.toHaveBeenCalled();
    // Says why, for screen readers too.
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Nothing to clear: no area drawn yet');
    expect(eraser).toHaveAccessibleDescription('Nothing to clear: no area drawn yet');
  });

  it('clears the area from the eraser', async () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ aoi: '{"type":"Polygon"}' }));
    const state = drawState();
    vi.mocked(useDraw).mockReturnValue(state);
    const user = userEvent.setup();
    renderWithTheme(<DrawingTool />);

    const eraser = screen.getByRole('button', { name: 'Clear the area of interest' });
    await user.click(eraser);

    expect(state.clearDrawing).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Clear the area of interest');
  });

  it('says so when a drawn polygon couldn\'t be used, until dismissed', async () => {
    const state = drawState({ areaRejected: true });
    vi.mocked(useDraw).mockReturnValue(state);
    const user = userEvent.setup();
    renderWithTheme(<DrawingTool />);

    expect(screen.getByRole('alert')).toHaveTextContent('That area has too many corners to use. Draw it again with fewer clicks.');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(state.dismissAreaRejected).toHaveBeenCalled();
  });

  it('shows the message outside the button stack, so its divider and stacking don\'t apply', () => {
    vi.mocked(useDraw).mockReturnValue(drawState({ areaRejected: true }));
    renderWithTheme(<DrawingTool />);

    const stack = screen.getByRole('button', { name: 'Draw an area of interest' }).parentElement!;
    expect(stack).not.toContainElement(screen.getByRole('alert'));
  });

  it('dismisses the message with Escape when it\'s the most recently opened thing', async () => {
    const state = drawState({ areaRejected: true });
    vi.mocked(useDraw).mockReturnValue(state);
    const user = userEvent.setup();
    renderWithTheme(<DrawingTool />);

    await user.keyboard('{Escape}');

    expect(state.dismissAreaRejected).toHaveBeenCalledTimes(1);
  });

  it('leaves the message alone when Escape closes something opened after it', async () => {
    const state = drawState({ areaRejected: true });
    vi.mocked(useDraw).mockReturnValue(state);
    const closePopup = vi.fn();
    const user = userEvent.setup();
    renderWithTheme(<DrawingTool />);
    // A popup opens after the message, e.g. a landmark clicked.
    renderHook(() => useEscape(true, closePopup));

    await user.keyboard('{Escape}');

    expect(closePopup).toHaveBeenCalledTimes(1);
    expect(state.dismissAreaRejected).not.toHaveBeenCalled();
  });

  it('shows no message normally', () => {
    renderWithTheme(<DrawingTool />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
