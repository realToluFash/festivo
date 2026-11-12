import { describe, expect, it } from 'vitest';

import { replyLine } from './GuestsModel.ts';
import { GUESTS, PAUSED_GUESTS, type SampleGuest } from './GuestsSample.ts';

const named = (key: string): SampleGuest =>
  [...GUESTS, ...PAUSED_GUESTS].find((one) => one.key === key) as SampleGuest;

describe('a Not sure yet guest’s ask, on the host’s line (sc-1363)', () => {
  it('is the line’s one tail, in place of the Reply by tail', () => {
    expect(replyLine(named('folasade'), 'en-US', '2026-11-04')).toBe(
      'Not sure yet · asked again Oct 26',
    );
    expect(
      replyLine({ ...named('zoe'), ask: { kind: 'never', day: null } }, 'en-US', '2026-11-04'),
    ).toBe('Not sure yet · won’t be asked again');
  });

  it('reads as without the story when nothing was chosen, or the ask was not sent', () => {
    expect(replyLine(named('yemi'), 'en-US', '2026-11-04')).toBe(
      'Not sure yet · asked to decide by Nov 4',
    );
    expect(replyLine(named('lucia'), 'en-US', '2026-11-04')).toBe(
      'Not sure yet · asked to decide by Nov 4',
    );
  });

  it('says when an ask is still to be sent', () => {
    const waiting = { ...named('zoe'), ask: { kind: 'toSend', day: '2026-11-01' } } as const;

    expect(replyLine(waiting, 'en-US', '2026-11-04')).toBe(
      'Not sure yet · will be asked again Nov 1',
    );
  });
});
