import { describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { StringProvider, useString } from '@/hooks/string/useString';
import { strings } from '@/server/strings/strings';

const wrapper = ({ children }: { children: ReactNode }) => (
  <StringProvider strings={strings}>{children}</StringProvider>
);

describe('useString', () => {
  it('returns one group\'s strings', () => {
    const { result } = renderHook(() => useString('search'), { wrapper });

    expect(result.current).toBe(strings.search);
    expect(result.current.placeholder).toBe('Search places');
  });

  it('returns all groups, still nested, without a group', () => {
    const { result } = renderHook(() => useString(), { wrapper });

    expect(result.current).toBe(strings);
    // Same key in two groups, both kept.
    expect(result.current.general.close).toBe('Close');
    expect(result.current.featureDrawer.close).toBe('Close details');
  });

  it('rejects unknown groups and keys at compile time', () => {
    // Never runs; `tsc` fails if the @ts-expect-error lines stop being errors.
    const useTypoCheck = () => {
      // @ts-expect-error: no 'serch' group
      useString('serch');
      // @ts-expect-error: no 'placholder' key
      return useString('search').placholder;
    };

    expect(useTypoCheck).toBeTypeOf('function');
  });

  it('throws outside a StringProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useString('search')))
      .toThrow('useString must be used within a StringProvider');
  });
});
