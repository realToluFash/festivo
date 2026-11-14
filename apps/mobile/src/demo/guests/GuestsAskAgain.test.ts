import { describe, expect, it } from 'vitest';

import { clockOf, guestOf, guestsAt, guestsOpening, replyLine } from './GuestsModel.ts';
import { replyByOf } from './GuestsSample.ts';

const REPLY_BY = replyByOf('evt-wed-4');
const line = (state: 'askAgain' | 'askAgainWont', key: string, locale = 'en-US') => {
  const guest = guestsAt(state).find((one) => one.key === key);
  if (guest == null) throw new Error(`no ${key}`);
  return replyLine(guest, locale, REPLY_BY);
};

describe('when a guest who isn’t sure yet will be asked again (sc-1363)', () => {
  it('reads the ask in place of the date to decide by', () => {
    expect(line('askAgain', 'lucia')).toBe('Not sure yet · will be asked again Nov 1');
    expect(line('askAgain', 'folasade')).toBe('Not sure yet · asked again Oct 23');
    expect(line('askAgainWont', 'lucia')).toBe('Not sure yet · won’t be asked again');
    expect(line('askAgain', 'lucia', 'en-GB')).toBe('Not sure yet · will be asked again 1 Nov');
  });

  it('reads as before for a guest with nothing chosen', () => {
    expect(line('askAgainWont', 'folasade')).toBe('Not sure yet · asked to decide by Nov 4');
  });

  it('opens on Lucía Ortega, on 30 Oct, with Reply by still to come', () => {
    expect(guestOf('askAgain')).toBe('lucia');
    expect(clockOf('askAgain').toISOString()).toBe('2026-10-30T09:41:00.000Z');
    expect(guestsOpening('askAgain', 'evt-wed-4', 'en-US').card.line).toContain(
      'Replies close on Wed, Nov 4.',
    );
  });
});
