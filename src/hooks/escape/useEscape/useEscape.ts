'use client';

import { useEffect, useRef } from 'react';

type Entry = { close: () => void };

// Everything Escape can close right now, oldest first. One press closes only
// the most recently opened one (the top), so e.g. cancelling a drawing leaves
// the details drawer open.
const stack: Entry[] = [];

const onKeyDown = (event: KeyboardEvent) => {
  // Left alone when a focused control used the key itself, e.g. the search box
  // closing its suggestions (MUI marks that press as handled).
  if (event.key !== 'Escape' || event.defaultPrevented) {
    return;
  }

  const top = stack.at(-1);

  if (top) {
    event.preventDefault();
    top.close();
  }
};

// Closes something with Escape while `active` (e.g. a popup while it's open).
// Whatever became active most recently closes first; one document listener
// serves all of them.
export const useEscape = (active: boolean, onEscape: () => void): void => {
  const entryRef = useRef<Entry | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    // Its callback is filled in by the effect below, which runs right after.
    const entry: Entry = { close: () => {} };
    entryRef.current = entry;
    stack.push(entry);

    if (stack.length === 1) {
      document.addEventListener('keydown', onKeyDown);
    }

    return () => {
      stack.splice(stack.indexOf(entry), 1);
      entryRef.current = null;

      if (stack.length === 0) {
        document.removeEventListener('keydown', onKeyDown);
      }
    };
  }, [active]);

  // Always call the latest callback, without re-registering (which would move
  // this to the top of the stack).
  useEffect(() => {
    if (entryRef.current) {
      entryRef.current.close = onEscape;
    }
  });
};
