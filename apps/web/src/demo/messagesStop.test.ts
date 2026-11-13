import { describe, expect, it } from 'vitest';

import { CLOCK, MESSAGES_PAGES, MESSAGE_STATES, READER, changed, seedOf } from './messages.ts';
import {
  IDLE,
  OTHER_MEMBER,
  STOPPED_AT,
  STOP_GROUP,
  STOP_STATES,
  letAgainSaid,
  stopFlowAfter,
  stopFlowOf,
  stopItem,
  stopTitle,
  stoppedLine,
} from './messagesStop.ts';

const INES = 'Inês Duarte';

describe('stop writing from their page, the rules (sc-3978)', () => {
  it('lists its six states after the invitation’s, in their own group on the demo home', () => {
    const keys = MESSAGE_STATES.map((one) => one.key);
    const group = MESSAGES_PAGES.find((page) => page.name === STOP_GROUP);

    expect(keys.slice(129, 135)).toEqual(STOP_STATES.map((one) => one.key));
    expect(group?.states.map((one) => one.to)).toEqual(
      STOP_STATES.map((one) => `/demo/events/evt-wed-4/messages?state=${one.key}`),
    );
    expect(MESSAGES_PAGES[0]?.states.some((one) => one.to.includes('stopped'))).toBe(false);
  });

  it('says who stopped them, or You to that member, and the locale’s short weekday date', () => {
    expect(stoppedLine({ by: OTHER_MEMBER, at: STOPPED_AT }, READER)).toBe(
      'Tunde Bakare stopped them writing from their page on Mon, Nov 2.',
    );
    expect(stoppedLine({ by: READER, at: CLOCK }, READER)).toBe(
      'You stopped them writing from their page on Tue, Nov 3.',
    );
    expect(stoppedLine({ by: OTHER_MEMBER, at: STOPPED_AT }, READER, 'en-GB')).toContain(
      'on Mon 2 Nov.',
    );
    expect(
      stoppedLine({ by: OTHER_MEMBER, at: '2026-11-02T23:30:00Z' }, READER, 'en-US', 'Asia/Tokyo'),
    ).toContain('on Tue, Nov 3.');
  });

  it('names the guest in the item and the title; the item turns once they are stopped', () => {
    expect(stopItem(INES, false)).toBe('Stop Inês Duarte writing from their page…');
    expect(stopItem(INES, true)).toBe('Let them write again');
    expect(stopTitle(INES)).toBe('Stop Inês Duarte writing from their page?');
    expect(letAgainSaid(INES)).toBe('Inês Duarte can write from their page again.');
  });

  it('opens each state where it is drawn', () => {
    expect(stopFlowOf('stopAction')).toEqual({ ...IDLE, menu: true });
    expect(stopFlowOf('stopAsk')).toEqual({ ...IDLE, ask: 'idle' });
    expect(stopFlowOf('stopFailed')).toEqual({ ...IDLE, ask: 'failed' });
    expect(stopFlowOf('letAgainFailed')).toEqual({ ...IDLE, letting: 'failed' });
    expect(stopFlowOf('stopped')).toEqual(IDLE);
    expect(seedOf('stopped').stopped?.ines).toEqual({ by: OTHER_MEMBER, at: STOPPED_AT });
    expect(seedOf('stoppedNoManage').stopped?.ines).toBeDefined();
    expect(seedOf('stopAsk').stopped?.ines).toBeUndefined();
    expect(seedOf('stopAsk').pane).toEqual({ kind: 'convo', id: 'ines' });
  });

  it('asks once, ignores a press while saving, and keeps the confirm open when refused', () => {
    const asked = stopFlowAfter({ ...IDLE, menu: true }, 'pickStop');
    const saving = stopFlowAfter(asked, 'go');

    expect(asked).toEqual({ ...IDLE, ask: 'idle' });
    expect(saving.ask).toBe('busy');
    expect(stopFlowAfter(saving, 'keep')).toBe(saving);
    expect(stopFlowAfter(saving, 'go')).toBe(saving);
    expect(stopFlowAfter(saving, 'openMenu')).toBe(saving);
    expect(stopFlowAfter(saving, 'stopRefused').ask).toBe('failed');
    expect(stopFlowAfter(stopFlowAfter(saving, 'stopRefused'), 'go').ask).toBe('busy');
    expect(stopFlowAfter(saving, 'stopSaved')).toEqual(IDLE);
    expect(stopFlowAfter(asked, 'keep')).toEqual(IDLE);
  });

  it('lets them write again without asking, and keeps the inset when refused', () => {
    const letting = stopFlowAfter({ ...IDLE, menu: true }, 'letGo');

    expect(letting).toEqual({ ...IDLE, letting: 'busy' });
    expect(stopFlowAfter(letting, 'letGo')).toBe(letting);
    expect(stopFlowAfter(letting, 'letRefused').letting).toBe('failed');
    expect(stopFlowAfter(stopFlowAfter(letting, 'letRefused'), 'letGo').letting).toBe('busy');
    expect(stopFlowAfter(letting, 'letSaved')).toEqual(IDLE);
  });

  it('keeps the stop on the inbox until let go, for that guest only', () => {
    const stop = { by: READER, at: CLOCK };
    const stopped = changed(changed(seedOf(null), { kind: 'stop', id: 'ines', stop }), {
      kind: 'stop',
      id: 'lucia',
      stop,
    });
    const freed = changed(stopped, { kind: 'letWrite', id: 'ines' });

    expect(stopped.stopped).toEqual({ ines: stop, lucia: stop });
    expect(freed.stopped).toEqual({ lucia: stop });
  });
});
