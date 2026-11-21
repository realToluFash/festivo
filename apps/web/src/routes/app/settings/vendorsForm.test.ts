import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { BLANK, draftProblems } from './vendorsForm.ts';

const t = ((key: string) => key) as unknown as TFunction;

describe('the website’s limit', () => {
  it('holds the https:// the API adds to a website typed without one', () => {
    const typed = { ...BLANK, name: 'Bloom', category: 'flowers' as const };

    expect(draftProblems({ ...typed, website: 'a'.repeat(2040) }, t).website).toBeUndefined();
    expect(draftProblems({ ...typed, website: 'a'.repeat(2041) }, t).website).toBe(
      'vendors.websiteTooLong',
    );
    expect(
      draftProblems({ ...typed, website: `https://${'a'.repeat(2040)}` }, t).website,
    ).toBeUndefined();
  });
});
