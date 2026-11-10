import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEscape } from '@/hooks/escape';

const pressEscape = () => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
};

describe('useEscape', () => {
  it('closes what is active, and marks the press handled', () => {
    const close = vi.fn();
    renderHook(() => useEscape(true, close));

    const event = pressEscape();

    expect(close).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does nothing while inactive, and ignores other keys', () => {
    const close = vi.fn();
    renderHook(() => useEscape(false, close));

    const event = pressEscape();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(close).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('closes only the most recently activated, whatever order they were mounted in', () => {
    const closeDrawer = vi.fn();
    const closeDrawing = vi.fn();
    // The drawing hook is mounted first but becomes active last.
    const drawing = renderHook(({ active }) => useEscape(active, closeDrawing), { initialProps: { active: false } });
    renderHook(() => useEscape(true, closeDrawer));
    drawing.rerender({ active: true });

    pressEscape();
    expect(closeDrawing).toHaveBeenCalledTimes(1);
    expect(closeDrawer).not.toHaveBeenCalled();

    // The drawing is cancelled, so the next press closes the drawer.
    drawing.rerender({ active: false });
    pressEscape();
    expect(closeDrawer).toHaveBeenCalledTimes(1);
  });

  it('leaves a press a focused control already handled (e.g. the search box closing its list)', () => {
    const close = vi.fn();
    renderHook(() => useEscape(true, close));
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();

    act(() => {
      document.dispatchEvent(event);
    });

    expect(close).not.toHaveBeenCalled();
  });

  it('calls the latest callback without moving to the top', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const closeOther = vi.fn();
    const hook = renderHook(({ onEscape }) => useEscape(true, onEscape), { initialProps: { onEscape: first } });
    const other = renderHook(() => useEscape(true, closeOther));

    // A new callback doesn't re-register: the other one, opened later, still closes first.
    hook.rerender({ onEscape: latest });
    pressEscape();
    expect(closeOther).toHaveBeenCalledTimes(1);

    other.unmount();
    pressEscape();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('stops listening once nothing is active', () => {
    const close = vi.fn();
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useEscape(true, close));

    unmount();
    pressEscape();

    expect(close).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
