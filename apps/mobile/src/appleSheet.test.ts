import { describe, expect, it } from 'vitest';

import { appleSheetClosed } from './appleSheet.ts';

describe('appleSheetClosed', () => {
  it('is the person closing the sheet', () => {
    expect(appleSheetClosed({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
  });

  it('is the person closing the Sign in to your Apple Account prompt, which Apple reports as unknown', () => {
    expect(appleSheetClosed({ code: 'ERR_REQUEST_UNKNOWN' })).toBe(true);
  });

  it('is not a failed or refused attempt', () => {
    expect(appleSheetClosed({ code: 'ERR_REQUEST_FAILED' })).toBe(false);
    expect(appleSheetClosed({ code: 'ERR_INVALID_RESPONSE' })).toBe(false);
    expect(appleSheetClosed(new Error('no window'))).toBe(false);
    expect(appleSheetClosed(null)).toBe(false);
  });
});
