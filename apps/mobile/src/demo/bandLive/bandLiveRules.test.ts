import { describe, expect, it } from 'vitest';

import { CAPSULE_TOP } from '../../layout/bandLive.ts';
import { CAPSULE_HEIGHT } from '../../layout/capsuleFit.ts';
import {
  EVENT_NAME_MAXIMUM,
  capsuleRoomHeight,
  liveEventName,
  liveEventOf,
} from './bandLiveRules.ts';

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

describe('the capsule’s row (sc-92571)', () => {
  it('keeps main’s row while the capsule is main’s height or less', () => {
    expect(capsuleRoomHeight(CAPSULE_HEIGHT)).toBe(CAPSULE_TOP + CAPSULE_HEIGHT);
    expect(capsuleRoomHeight(0)).toBe(CAPSULE_TOP + CAPSULE_HEIGHT);
  });

  it('grows to the foot of a taller capsule, so the line below starts under it', () => {
    expect(capsuleRoomHeight(CAPSULE_HEIGHT + 30)).toBe(CAPSULE_TOP + CAPSULE_HEIGHT + 30);
  });
});
