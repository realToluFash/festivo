import { describe, expect, it } from 'vitest';

import { CATEGORY_MARK, markOf } from '../../components/notificationMarks.ts';
import { BELL_STATES, bellStartOf, isBellState } from './BellStates.ts';

describe('the bell’s states (sc-83081)', () => {
  it('gives each of the six categories its own mark, and an unknown one none', () => {
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
    expect(markOf('venue_news')).toBeNull();
  });

  it('starts each state in the one thing it shows', () => {
    expect(bellStartOf('bell')).toMatchObject({ feed: 'loaded', more: 'none', asking: false });
    expect(bellStartOf('bellLoading').feed).toBe('loading');
    expect(bellStartOf('bellFailed').feed).toBe('failed');
    expect(bellStartOf('bellEmpty').empty).toBe(true);
    expect(bellStartOf('bellMoreFailed').more).toBe('failed');
    expect(bellStartOf('bellMute').menu).toBe('missed');
    expect(bellStartOf('bellRefreshing').offline).toBe('refreshing');
  });

  it('marks Muted only the items delivered after the mute, as main does at delivery', () => {
    expect(bellStartOf('bellMuted')).toMatchObject({ muted: true, marked: ['replies', 'day'] });
    expect(bellStartOf('bellMute')).toMatchObject({ muted: false, marked: [] });
  });

  it('knows its own keys and no others', () => {
    expect(BELL_STATES.every(isBellState)).toBe(true);
    expect(isBellState('bell')).toBe(true);
    expect(isBellState('conversation')).toBe(false);
  });
});
