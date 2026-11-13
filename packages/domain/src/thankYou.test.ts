import { describe, expect, test } from 'vitest';

import {
  THANK_YOU_MOST,
  cleanThankYou,
  takesThankYou,
  thankYouLength,
  thankYouOver,
} from './thankYou.ts';

describe('the hosts’ thank-you (sc-6476)', () => {
  test('is trimmed, and every run of spaces and line breaks is one space', () => {
    expect(cleanThankYou('  Thank you\n\nfor   dancing\r\nwith us.  ')).toBe(
      'Thank you for dancing with us.',
    );
    expect(cleanThankYou(' \n\t ')).toBe('');
  });

  test('counts code points once cleaned, as the API does', () => {
    expect(thankYouLength('  a\n\nb ')).toBe(3);
    expect(thankYouLength('😀'.repeat(3))).toBe(3);
    expect(thankYouLength('é')).toBe(1);
  });

  test('is over the limit only past 280', () => {
    expect(thankYouOver('a'.repeat(THANK_YOU_MOST))).toBe(false);
    expect(thankYouOver(`${'a'.repeat(THANK_YOU_MOST)}  `)).toBe(false);
    expect(thankYouOver('a'.repeat(THANK_YOU_MOST + 1))).toBe(true);
  });

  test('is offered once Finished, never on a called-off event', () => {
    const ended = { status: 'ended' as const, startsAt: '2026-11-14T16:00:00+01:00' };

    expect(takesThankYou({ ...ended, concludedAt: '2026-11-14T20:00:00+01:00' }, 'finished')).toBe(
      true,
    );
    expect(takesThankYou({ ...ended, concludedAt: '2026-11-14T10:00:00+01:00' }, 'finished')).toBe(
      false,
    );
    expect(
      takesThankYou(
        { status: 'live', startsAt: ended.startsAt, concludedAt: null },
        'happening_now',
      ),
    ).toBe(false);
  });
});
