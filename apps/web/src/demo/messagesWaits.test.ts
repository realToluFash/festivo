import { describe, expect, it } from 'vitest';

import { checkOf, seedOf } from './messages.ts';
import { COMING } from './messagesTo.ts';
import {
  WAITS_STATES,
  askedWords,
  billingOf,
  ownersOf,
  waitsCheckOf,
  waitsFiguresOf,
  waitsOf,
  waitsTicksOf,
} from './messagesWaits.ts';

const CHECKS = [
  'checkWaitsWa',
  'checkWaitsSms',
  'checkWaitsBoth',
  'checkWaitsNoEmail',
  'checkWaitsOnly',
] as const;

function checkIn(state: string) {
  const inbox = seedOf(state as never);
  const draft = inbox.draft!;
  const check = waitsCheckOf(checkOf(draft.to, draft.ticks, []), draft.to, draft.ticks);

  return { inbox, check, waits: waitsOf(check, draft.ticks) };
}

describe('the check with too few credits (sc-3963)', () => {
  it.each([
    ['checkWaitsWa', 92, 0, 4],
    ['checkWaitsSms', 92, 2, 2],
    ['checkWaitsBoth', 92, 2, 2],
    ['checkWaitsNoEmail', 0, 31, 65],
    ['checkWaitsOnly', 0, 3, 93],
  ] as const)(
    'opens %s on Coming · 96 at a balance of 0, adding up to 96',
    (state, byEmail, byPhoneOnly, cant) => {
      const ticks = waitsTicksOf(state)!;
      const { counts, cantTell } = waitsFiguresOf(ticks);
      const { inbox, check } = checkIn(state);

      expect(counts.email).toBe(byEmail);
      expect(ticks.email ? byPhoneOnly : counts.sms + counts.whatsApp).toBe(byPhoneOnly);
      expect(cantTell).toBe(cant);
      expect(byEmail + byPhoneOnly + cantTell).toBe(96);
      expect(inbox.balance).toBe(0);
      expect(inbox.draft?.step).toBe('check');
      expect(check.credits).toBeNull();
    },
  );

  it('counts each phone once when SMS and WhatsApp are both ticked (sc-3954)', () => {
    expect(checkIn('checkWaitsBoth').check.pills).toEqual([
      { channel: 'email', count: 92 },
      { channel: 'sms', count: 28 },
      { channel: 'whatsApp', count: 3 },
    ]);
    expect(checkIn('checkWaitsSms').check.pills[1]).toEqual({ channel: 'sms', count: 31 });
    expect(checkIn('checkWaitsNoEmail').check.cantTell).toBe(65);
    expect(checkIn('checkWaitsOnly').check.cantTell).toBe(93);
  });

  it('keeps SMS is off and its four in checkWaitsWa', () => {
    const { check } = checkIn('checkWaitsWa');

    expect(check.smsOff).toBe('SMS is off, so 2 more can’t be told.');
    expect(check.cantTell).toBe(4);
    expect(check.cant.map((one) => one.name)).toEqual(['Amaka Eze', 'Priyanka Nair']);
  });

  it.each([
    ['checkWaitsWa', true, ['3 WhatsApp messages will wait for credits.'], 'Send without WhatsApp'],
    ['checkWaitsSms', true, ['31 SMS messages will wait for credits.'], 'Send without SMS'],
    [
      'checkWaitsBoth',
      true,
      ['3 WhatsApp messages will wait for credits.', '28 SMS messages will wait for credits.'],
      'Send by email only',
    ],
    [
      'checkWaitsNoEmail',
      false,
      ['3 WhatsApp messages will wait for credits.', '28 SMS messages will wait for credits.'],
      null,
    ],
    ['checkWaitsOnly', false, ['3 WhatsApp messages will wait for credits.'], null],
  ])(
    'says what waits in %s and offers the way past that leaves something',
    (state, either, lines, way) => {
      const { waits } = checkIn(state);

      expect(waits?.either).toBe(either);
      expect(waits?.lines).toEqual(lines);
      expect(waits?.way?.word ?? null).toBe(way);
    },
  );

  it('drops only the waiting channels on the way past', () => {
    expect(checkIn('checkWaitsSms').waits?.way?.ticks).toEqual({
      email: true,
      sms: false,
      whatsApp: false,
    });
    expect(checkIn('checkWaitsBoth').waits?.way?.ticks).toEqual({
      email: true,
      sms: false,
      whatsApp: false,
    });
    expect(checkIn('checkWaitsWa').waits?.way?.ticks).toEqual({
      email: true,
      sms: false,
      whatsApp: false,
    });
  });

  it('waits for nothing once no paid channel is ticked, and leaves the usual check alone', () => {
    const ticks = { email: true, sms: false, whatsApp: false };
    const check = checkOf(COMING, ticks, []);

    expect(waitsCheckOf(check, COMING, ticks)).toBe(check);
    expect(waitsOf(check, ticks)).toBeNull();
    expect(seedOf('check').balance).toBe(1500);
  });

  it('gives Add credits to billing.manage and Ask an owner to anyone else', () => {
    expect(CHECKS.map(billingOf)).toEqual(['add', 'add', 'add', 'add', 'add']);
    expect(['askOwner', 'askSent', 'askSentOne', 'askFailed'].map(billingOf)).toEqual([
      'ready',
      'sent',
      'sent',
      'failed',
    ]);
    expect(askedWords(ownersOf('askSent'))).toBe(
      'The owners have been sent the link to Plan and billing.',
    );
    expect(askedWords(ownersOf('askSentOne'))).toBe(
      'The owner has been sent the link to Plan and billing.',
    );
  });

  it('starts sendWithout on the ten seconds, told by email only', () => {
    const inbox = seedOf('sendWithout');

    expect(inbox.outs).toHaveLength(1);
    expect(inbox.outs[0]?.stage).toBe('countdown');
    expect(inbox.outs[0]?.ticks).toEqual({ email: true, sms: false, whatsApp: false });
    expect(WAITS_STATES.map((one) => one.key)).toHaveLength(10);
  });
});
