// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { strings } from '@/server/strings/strings';

describe('strings', () => {
  it('has only non-empty, trimmed strings', () => {
    for (const [group, values] of Object.entries(strings)) {
      for (const [key, value] of Object.entries(values)) {
        expect(value, `${group}.${key}`).toMatch(/^\S(.*\S)?$/);
      }
    }
  });
});
