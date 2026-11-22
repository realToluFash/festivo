import { describe, expect, it } from 'vitest';

import { CATEGORY_MARK, markOf } from '../../components/notificationMarks.ts';
import { BELL_STATES, HELD_BY_MUTE, bellStartOf, isBellState, mutedOf } from './BellStates.ts';

describe('the bell’s states (sc-83081)', () => {
  it('gives each of the six categories its own mark, and an unknown one the plain bell (sc-84143)', () => {
    expect(new Set(Object.values(CATEGORY_MARK)).size).toBe(6);
    expect(CATEGORY_MARK).toEqual({
      guest_replies: 'users',
      messages: 'chat',
      event_day: 'today',
      event_changes: 'calendar',
      money: 'wallet',
      account_security: 'shield',
    });
    expect(markOf('event_day')).toBe('today');
    expect(markOf('money')).toBe('wallet');
    expect(markOf('account_security')).toBe('shield');
    expect(markOf('venue_news')).toBe('bell');
  });

  it('starts each state in the one thing it shows', () => {
    expect(bellStartOf('bell')).toMatchObject({ feed: 'loaded', more: 'none', asking: false });
    expect(bellStartOf('bellLoading').feed).toBe('loading');
    expect(bellStartOf('bellFailed').feed).toBe('failed');
    expect(bellStartOf('bellEmpty').empty).toBe(true);
    expect(bellStartOf('bellMoreFailed').more).toBe('failed');
    expect(bellStartOf('bellMute').menu).toBe('missed');
    expect(bellStartOf('bellRefreshing').offline).toBe('refreshing');
    expect(bellStartOf('bellUnknown')).toMatchObject({ unknown: true, muted: true });
    expect(mutedOf(bellStartOf('bellUnknown'), { key: 'unknown', category: 'venue_news' })).toBe(
      true,
    );
  });

  it('marks Muted only the items delivered after the mute, as main does at delivery', () => {
    const muted = bellStartOf('bellMuted');
    expect(muted).toMatchObject({ muted: true, marked: ['replies'] });
    expect(mutedOf(muted, { key: 'replies', category: 'guest_replies' })).toBe(true);
    expect(mutedOf(muted, { key: 'missed', category: 'messages' })).toBe(false);
    expect(bellStartOf('bellMute')).toMatchObject({ muted: false, marked: [] });
  });

  it('marks nothing for the switch alone, and never Event day or Account & security', () => {
    const switchedOn = { ...bellStartOf('bellMute'), muted: true };
    expect(mutedOf(switchedOn, { key: 'replies', category: 'guest_replies' })).toBe(false);

    const all = { ...bellStartOf('bellMuted'), marked: ['day', 'security'] };
    expect(mutedOf(all, { key: 'day', category: 'event_day' })).toBe(false);
    expect(mutedOf(all, { key: 'security', category: 'account_security' })).toBe(false);
    expect([...HELD_BY_MUTE].sort()).toEqual([
      'event_changes',
      'guest_replies',
      'messages',
      'money',
    ]);
  });

  it('knows its own keys and no others', () => {
    expect(BELL_STATES.every(isBellState)).toBe(true);
    expect(isBellState('bell')).toBe(true);
    expect(isBellState('conversation')).toBe(false);
  });
});
