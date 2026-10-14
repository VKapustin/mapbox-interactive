'use client';

import {createContext, FC, type ReactNode, useContext} from 'react';
// Type only: the strings themselves arrive through StringProvider.
import {type StringGroup, type Strings} from '@/server/strings/strings';

const StringContext = createContext<Strings | null>(null);

export const StringProvider: FC<{ strings: Strings; children: ReactNode }> = ({ strings, children }) => {
  return (
    <StringContext.Provider value={ strings }>
      { children }
    </StringContext.Provider>
  )
}

// useString('search').placeholder: one group's strings, typed, so groups and keys
// autocomplete and a typo fails type-checking. Without a group: all groups, still
// nested, so equal keys in different groups (e.g. `close`) never collide.
export function useString(): Strings;
export function useString<G extends StringGroup>(group: G): Strings[G];
export function useString(group?: StringGroup) {
  const context = useContext(StringContext);

  if (!context) {
    throw new Error('useString must be used within a StringProvider');
  }

  return group ? context[group] : context;
}
