'use client';

import { useSyncExternalStore } from 'react';

// Same-tab updates; the browser's `storage` event only fires in other tabs.
const CHANGE_EVENT = 'stored-boolean-change';

// Used when the browser won't store anything (e.g. some private windows,
// or blocked site data), so the value still holds for this page.
const memory = new Map<string, boolean>();

const read = (key: string): boolean | undefined => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === 'true' || stored === 'false' ? stored === 'true' : undefined;
  } catch {
    // Storage blocked.
    return memory.get(key);
  }
};

const write = (key: string, value: boolean): void => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked or full: keep it for this page.
    memory.set(key, value);
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
};

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
};

// A boolean remembered in this browser (localStorage) under `key`, e.g. a
// panel's collapsed state. Starts as `defaultValue` on the server and while
// hydrating, then switches to the stored value, so server and client render
// the same markup. Changes in other tabs come through too.
export const useStoredBoolean = (key: string, defaultValue: boolean): [boolean, (value: boolean) => void] => {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? defaultValue,
    () => defaultValue,
  );

  return [value, (next: boolean) => write(key, next)];
};
