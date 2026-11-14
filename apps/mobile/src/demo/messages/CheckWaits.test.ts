import { describe, expect, it } from 'vitest';

import {
  type Ask,
  WAITS_STARTS,
  askAnswered,
  pressAsk,
  sendWithout,
  waitsCheckOf,
} from './CheckWaits.ts';
import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import {
  COUNTDOWN_SECONDS,
  type Messages,
  blankDraft,
  channelsWords,
  checkOf,
  reduce,
  startOf,
} from './MessagesModel.ts';
import { say } from './MessagesWords.ts';

const CHECKS = [
  'checkWaitsWa',
  'checkWaitsSms',
  'checkWaitsBoth',
  'checkWaitsNoEmail',
  'checkWaitsOnly',
] as const;
const ASKS = ['askOwner', 'askSent', 'askSentOne', 'askFailed'] as const;

function viewOf(m: Messages) {
  return waitsCheckOf(m.draft ?? blankDraft(), m.balance);
}

function shown(state: string) {
  const view = viewOf(startOf(state as never, false));
  if (view == null) throw new Error(`${state} shows no wait block`);

  return view;
}

describe('the check at 0 credits (sc-3963)', () => {
  it('opens each state on Coming · 96 as a new message at its check, at a balance of 0', () => {
    for (const state of [...CHECKS, ...ASKS]) {
      const m = startOf(state, false);
      expect(m).toMatchObject({ balance: 0, open: { kind: 'draft' } });
      expect(m.draft).toMatchObject({ to: 'coming', step: 'check' });
    }
  });

  it('counts each way the ticks fall as drawn, adding up to 96 every time', () => {
    const counts = (state: string) =>
      shown(state).check.told.map((one) => `${one.key} ${one.count}`);

    expect(counts('checkWaitsWa')).toEqual(['email 92', 'wa 3']);
    expect(counts('checkWaitsSms')).toEqual(['email 92', 'sms 31']);
    expect(counts('checkWaitsBoth')).toEqual(['email 92', 'sms 28', 'wa 3']);
    expect(counts('checkWaitsNoEmail')).toEqual(['sms 28', 'wa 3']);
    expect(counts('checkWaitsOnly')).toEqual(['wa 3']);

    expect(CHECKS.map((state) => shown(state).check.cantTell)).toEqual([4, 2, 2, 65, 93]);
    expect(shown('checkWaitsWa').check.smsOff).toBe(2);
    expect(shown('checkWaitsWa').check.names).toEqual([
      'Amaka Eze · No email address · SMS is off',
      'Priyanka Nair · No email address · SMS is off',
    ]);
    expect(shown('checkWaitsOnly').check.names).toEqual([
      'Tomás Ferreira · Address is bouncing · No phone number',
      'Joaquín Ruiz · No email address · No phone number',
    ]);
    expect(shown('checkWaitsOnly').check.seeAll).toBe(true);

    for (const state of CHECKS) {
      const view = shown(state);
      const email = view.check.told.find((one) => one.key === 'email');
      const told =
        email == null
          ? view.check.told.reduce((sum, one) => sum + one.count, 0)
          : view.check.count - view.check.cantTell;
      expect(told + view.check.cantTell, state).toBe(96);
      expect(view.check.count).toBe(96);
    }
  });

  it('says Email goes either way only with Email ticked, then a wait line per paid channel, WhatsApp first', () => {
    expect(CHECKS.map((state) => shown(state).either)).toEqual([true, true, true, false, false]);
    const lines = (state: string) =>
      shown(state).waiting.map((one) => say.waits(one.key, one.count));

    expect(lines('checkWaitsWa')).toEqual(['3 WhatsApp messages will wait for credits.']);
    expect(lines('checkWaitsSms')).toEqual(['31 SMS messages will wait for credits.']);
    expect(lines('checkWaitsBoth')).toEqual([
      '3 WhatsApp messages will wait for credits.',
      '28 SMS messages will wait for credits.',
    ]);
    expect(lines('checkWaitsNoEmail')).toHaveLength(2);
    expect(say.waits('wa', 1)).toBe('1 WhatsApp message will wait for credits.');
    expect(say.waits('sms', 1)).toBe('1 SMS message will wait for credits.');
  });

  it('offers the one way past that leaves something to send', () => {
    expect(CHECKS.map((state) => shown(state).way?.label ?? null)).toEqual([
      'Send without WhatsApp',
      'Send without SMS',
      'Send by email only',
      null,
      null,
    ]);
    expect(shown('checkWaitsBoth').way?.drops).toEqual(['sms', 'wa']);
  });

  it('names only the ticked channels in how they are told', () => {
    expect(shown('checkWaitsWa').told).toBe(
      'Your message goes on their page. Soirely tells them it is there by email and WhatsApp.',
    );
    expect(shown('checkWaitsBoth').told).toBe(
      'Your message goes on their page. Soirely tells them it is there by email, text and WhatsApp.',
    );
  });

  it('keeps the credits line whenever nothing waits', () => {
    expect(viewOf(startOf('check', false))).toBeNull();
    const m = startOf('checkWaitsSms', false);
    expect(waitsCheckOf(m.draft ?? blankDraft(), 1500)).toBeNull();
    expect(
      waitsCheckOf(
        { ...(m.draft ?? blankDraft()), channels: { email: true, sms: false, wa: false } },
        0,
      ),
    ).toBeNull();
  });
});

describe('the check with credits enough (pm #36950)', () => {
  it('counts each phone once with SMS and WhatsApp ticked, three credits fewer', () => {
    const draft = startOf('check', false).draft ?? blankDraft();
    const both = checkOf({ ...draft, channels: { email: true, sms: true, wa: true } });

    expect(both.told).toEqual([
      { key: 'email', count: 92 },
      { key: 'sms', count: 28 },
      { key: 'wa', count: 3 },
    ]);
    expect(both).toMatchObject({ credits: 39, after: '1,461', cantTell: 2 });
    expect(checkOf(draft)).toMatchObject({ credits: 31, after: '1,469' });
  });
});

describe('who reads it', () => {
  it('gives Folake Adeyemi, Owner, the app’s line, and Bisi Okafor, Admin, Ask an owner', () => {
    for (const state of CHECKS) expect(startOf(state, false).waits?.canBill).toBe(true);
    for (const state of ASKS) expect(startOf(state, false).waits?.canBill).toBe(false);
    expect(ASKS.map((state) => startOf(state, false).waits?.ask)).toEqual([
      'ready',
      'sent',
      'sent',
      'failed',
    ]);
    expect(startOf('askSentOne', false).waits?.owners).toBe(1);
    expect(say.ownersAsked(2)).toBe('The owners have been sent the link to Plan and billing.');
    expect(say.ownersAsked(1)).toBe('The owner has been sent the link to Plan and billing.');
  });

  it('sends one ask at a time, and is sent', () => {
    const first = pressAsk('ready');
    expect(first).toEqual({ ask: 'asking', sends: true });
    expect(pressAsk(first.ask)).toEqual({ ask: 'asking', sends: false });
    expect(askAnswered(first.ask, true)).toBe('sent');
    expect(pressAsk('sent').sends).toBe(false);
  });

  it('clears Not sent when pressed again, and then goes', () => {
    const failed: Ask = askAnswered('asking', false);
    expect(failed).toBe('failed');
    const again = pressAsk(failed);
    expect(again).toEqual({ ask: 'asking', sends: true });
    expect(askAnswered(again.ask, true)).toBe('sent');
    expect(askAnswered('ready', true)).toBe('ready');
  });
});

describe('Send without', () => {
  const run = (m: Messages, drops: Parameters<typeof sendWithout>[0]) =>
    sendWithout(drops).reduce(reduce, m);

  it('drops SMS and goes straight into the ten seconds, told by Email', () => {
    const m = startOf('checkWaitsSms', false);
    const view = viewOf(m);
    const after = run(m, view?.way?.drops ?? []);

    expect(after.draft).toMatchObject({
      step: 'countdown',
      seconds: COUNTDOWN_SECONDS,
      channels: { email: true, sms: false, wa: false },
    });
    expect(say.onPageTold(channelsWords(['email']))).toBe('on their page · told by Email');
  });

  it('by email only drops both paid channels, and moves nobody to another', () => {
    const m = startOf('checkWaitsBoth', false);
    const after = run(m, viewOf(m)?.way?.drops ?? []);

    expect(after.draft?.channels).toEqual({ email: true, sms: false, wa: false });
    expect(after.draft?.step).toBe('countdown');
  });

  it('opens sendWithout in the ten seconds, Email alone ticked', () => {
    expect(startOf('sendWithout', false).draft).toMatchObject({
      step: 'countdown',
      seconds: COUNTDOWN_SECONDS,
      channels: { email: true, sms: false, wa: false },
    });
    expect(WAITS_STARTS.sendWithout?.step).toBe('countdown');
  });
});

describe('the demo home', () => {
  it('links each sc-3963 state into the wedding', () => {
    const hrefs = MESSAGES_BOARDS.filter((board) =>
      [...CHECKS, ...ASKS, 'sendWithout'].includes(board.state as never),
    ).map((board) => board.href);

    expect(hrefs).toHaveLength(10);
    expect(hrefs[0]).toBe('/demo/events/evt-wed-4?area=messages&state=checkWaitsWa');
  });
});
