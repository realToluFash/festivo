import { describe, expect, it } from 'vitest';

import { EVENT_NAME_MAXIMUM, liveEventName, liveEventOf } from './bandLiveRules.ts';

describe('the board’s choices', () => {
  it('names the longest event 120 capital W with no space', () => {
    expect(liveEventName('wide')).toBe('W'.repeat(120));
    expect(liveEventName('wide')).toHaveLength(EVENT_NAME_MAXIMUM);
  });

  it('falls back to Dîner en direct', () => {
    expect(liveEventOf('none')).toBe('none');
    expect(liveEventOf('word')).toBe('word');
    expect(liveEventOf(undefined)).toBe('diner');
    expect(liveEventOf('other')).toBe('diner');
  });
});
