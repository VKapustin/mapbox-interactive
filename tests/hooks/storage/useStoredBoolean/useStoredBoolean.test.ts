import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { useStoredBoolean } from '@/hooks/storage';

const KEY = 'test:flag';

describe('useStoredBoolean', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('starts with the default when nothing is stored', () => {
    const { result } = renderHook(() => useStoredBoolean(KEY, true));

    expect(result.current[0]).toBe(true);
  });

  it('starts with the stored value', () => {
    window.localStorage.setItem(KEY, 'false');

    const { result } = renderHook(() => useStoredBoolean(KEY, true));

    expect(result.current[0]).toBe(false);
  });

  it('ignores a stored value that isn\'t a boolean', () => {
    window.localStorage.setItem(KEY, 'maybe');

    const { result } = renderHook(() => useStoredBoolean(KEY, true));

    expect(result.current[0]).toBe(true);
  });

  it('stores changes and updates every user of the key', () => {
    const first = renderHook(() => useStoredBoolean(KEY, true));
    const second = renderHook(() => useStoredBoolean(KEY, true));

    act(() => first.result.current[1](false));

    expect(window.localStorage.getItem(KEY)).toBe('false');
    expect(first.result.current[0]).toBe(false);
    expect(second.result.current[0]).toBe(false);
  });

  it('follows changes made in another tab', () => {
    const { result } = renderHook(() => useStoredBoolean(KEY, true));

    act(() => {
      window.localStorage.setItem(KEY, 'false');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(result.current[0]).toBe(false);
  });

  it('still works for the page when the browser won\'t store anything', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { result } = renderHook(() => useStoredBoolean('test:blocked', true));

    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));

    expect(result.current[0]).toBe(false);
  });

  it('renders the default on the server, whatever is stored', () => {
    window.localStorage.setItem(KEY, 'false');
    const Probe = () => String(useStoredBoolean(KEY, true)[0]);

    expect(renderToString(createElement(Probe))).toBe('true');
  });
});
