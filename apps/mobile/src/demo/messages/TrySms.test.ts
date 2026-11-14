import { describe, expect, it } from 'vitest';

import { type Action, type Messages, startOf } from './MessagesModel.ts';
import type { Mobile, ReachLine } from './MessagesSample.ts';
import { reachViewOf, reduceReach, resendOf } from './Reach.ts';
import { parkingReachOf } from './ReasonsSample.ts';
import {
  balanceAfterText,
  isQuiet,
  offersTrySms,
  textedLines,
  textedOf,
  trySmsOf,
} from './TrySms.ts';

const run = (m: Messages, ...actions: Action[]) => actions.reduce(reduceReach, m);
const viewOf = (m: Messages) => reachViewOf(m, m.open?.kind === 'reached' ? m.open.of : 'parking');
const people = (m: Messages) => viewOf(m).groups.flatMap((group) => group.people);
const personOf = (m: Messages, key: string) => people(m).find((person) => person.key === key);
const groupsOf = (m: Messages) => viewOf(m).groups.map((group) => [group.word, group.count]);

const MOBILE: Mobile = { perPart: 62, theirTime: '10:41' };
const PAGE: ReachLine = { mark: 'none', word: 'Their page', reason: 'Not seen yet' };
const email = (word: string, reason: string): ReachLine[] => [
  { mark: 'bounced', word: `Email · ${word}`, reason },
  PAGE,
];

describe('who is offered Try SMS instead', () => {
  it('is anyone not reached with a mobile that has not stopped texts, whatever their email line reads', () => {
    for (const [group, lines] of [
      ['bounced', email('Bounced', 'The inbox is full (4.2.2)')],
      ['failed', email('Failed', 'We could not send this email')],
      ['skipped', email('Not sent', 'Address is bouncing')],
      ['optedOut', email('Not sent', 'Unsubscribed')],
    ] as const)
      expect(offersTrySms({ group, told: false, mobile: MOBILE, lines })).toBe(true);
  });

  it('is never someone without a mobile, who stopped texts, or who is told', () => {
    const lines = email('Bounced', 'This address doesn’t exist (5.1.1)');
    expect(offersTrySms({ group: 'bounced', told: false, lines })).toBe(false);
    expect(
      offersTrySms({ group: 'skipped', told: false, mobile: { ...MOBILE, stopped: true }, lines }),
    ).toBe(false);
    expect(offersTrySms({ group: 'bounced', told: true, mobile: MOBILE, lines })).toBe(false);
  });

  it('is never someone in progress, held, too late or reached, nor beside a text for this message', () => {
    const lines = email('Bounced', 'The inbox is full (4.2.2)');
    for (const group of ['inProgress', 'held', 'reached'] as const)
      expect(offersTrySms({ group, told: false, mobile: MOBILE, lines })).toBe(false);
    for (const line of [
      { mark: 'bounced', word: 'SMS · Failed' },
      { mark: 'none', word: 'SMS', reason: 'No phone number' },
      { mark: 'sending', word: 'Email', reason: 'Sending…' },
      { mark: 'notsent', word: 'Email · Not sent: too late' },
    ] as const)
      expect(
        offersTrySms({ group: 'bounced', told: false, mobile: MOBILE, lines: [line, PAGE] }),
      ).toBe(false);
  });

  it('goes by the person in the every-reason sample: five offered, four not', () => {
    const m = startOf('reasons', false);
    const offered = people(m)
      .filter((person) => person.trySms === true)
      .map((person) => person.key);
    expect(offered).toEqual(['olumide', 'chidi', 'rafael', 'sophie', 'yuki']);
    for (const key of ['tomas', 'diego', 'joaquin', 'mei', 'kemi', 'ines'])
      expect(personOf(m, key)?.trySms).not.toBe(true);
  });

  it('is never offered in the usual sample, told by Email and SMS', () => {
    expect(people(startOf('reached', false)).some((person) => person.trySms === true)).toBe(false);
  });
});

describe('every reason', () => {
  it('counts Parking told by Email only, in the AC’s group order', () => {
    const view = viewOf(startOf('reasons', false));
    expect(view.title).toBe('Reached 133 of 142');
    expect(view.line).toBe(
      'Seen by 87 on their page · 2 bounced · 2 failed · 1 opted out · 2 skipped · 2 no email or phone',
    );
    expect(view.parts.map((part) => [part.count, part.word])).toEqual([
      [133, 'Reached'],
      [2, 'Bounced'],
      [2, 'Failed'],
      [1, 'Opted out'],
      [2, 'Skipped'],
      [2, 'No email or phone'],
    ]);
    expect(view.head).toBe('Everyone · 142');
    expect(view.resend).toBe(9);
    expect(groupsOf(startOf('reasons', false)).at(-1)).toEqual(['Reached', 133]);
  });

  it('draws each reason’s line, and only the email’s', () => {
    const m = startOf('reasons', false);
    expect(personOf(m, 'chidi')?.lines[0]).toEqual({
      mark: 'bounced',
      word: 'Email · Failed',
      reason: 'We could not send this email',
    });
    expect(personOf(m, 'rafael')?.lines[0]?.reason).toBe('Soirely cannot email this address');
    expect(personOf(m, 'yuki')?.lines[0]?.reason).toBe('Address is bouncing');
    expect(personOf(m, 'diego')?.lines[0]?.reason).toBe('Reported an earlier email as spam');
    expect(personOf(m, 'kemi')?.lines[0]).toMatchObject({
      word: 'Email · Reported as spam',
      reason: 'Mon, Nov 2, 18:42',
    });
    expect(personOf(m, 'tomas')?.fixes).toEqual(['Fix email address', 'Mark as told in person']);
    expect(
      people(m).some((person) => person.lines.some((line) => line.word.startsWith('SMS'))),
    ).toBe(false);
  });

  it('shows 9 not reached on Parking’s row and conversation', () => {
    expect(parkingReachOf('reasons')).toMatchObject({ reached: 133, notReached: 9 });
    expect(parkingReachOf(undefined)).toMatchObject({ reached: 131, notReached: 11 });
  });
});

describe('Try SMS instead, pressed', () => {
  it('counts the guest’s own text with the link as built, and its credits', () => {
    expect(trySmsOf(MOBILE, 1500)).toEqual({
      credits: 62,
      count: 'SMS · 1 part · GSM-7 · 154 characters',
      uses: 'This text uses 62 credits. Credits after sending: 1,438.',
      waits: null,
      quiet: null,
    });
  });

  it('opens in Olumide Bello’s row on Bounced, nothing sent', () => {
    const m = startOf('trySms', false);
    expect(viewOf(m)).toMatchObject({ filterOn: 'bounced', head: 'Bounced · 2', status: null });
    expect(personOf(m, 'olumide')?.trying?.uses).toBe(
      'This text uses 62 credits. Credits after sending: 1,438.',
    );
    expect(personOf(m, 'tomas')?.trying).toBeUndefined();
  });

  it('adds the wait at night for them', () => {
    expect(isQuiet('06:41')).toBe(true);
    expect(isQuiet('20:00')).toBe(true);
    expect(isQuiet('09:00')).toBe(false);
    expect(isQuiet('19:59')).toBe(false);
    const rafael = personOf(startOf('trySmsQuiet', false), 'rafael')?.trying;
    expect(rafael).toMatchObject({
      uses: 'This text uses 10 credits. Credits after sending: 1,490.',
      quiet: 'This text waits until 09:00, their time.',
      waits: null,
    });
  });

  it('with too few credits says the text will wait in place of the balance after', () => {
    const yuki = personOf(startOf('trySmsShort', false), 'yuki')?.trying;
    expect(yuki).toMatchObject({
      uses: 'This text uses 9 credits.',
      waits: '1 SMS message will wait for credits.',
      quiet: null,
    });
  });

  it('Cancel sends nothing and closes', () => {
    const m = run(startOf('trySms', false), { type: 'cancelTrySms' });
    expect(m.trying).toBeNull();
    expect(m.texted).toBeUndefined();
    expect(m.balance).toBe(1500);
    expect(personOf(m, 'olumide')?.trySms).toBe(true);
  });
});

describe('after Send by SMS', () => {
  it('is sent now, held, or waiting for their morning', () => {
    expect(textedOf(MOBILE, 1500)).toBe('sent');
    expect(textedOf({ ...MOBILE, theirTime: '06:41' }, 1500)).toBe('waiting');
    expect(textedOf(MOBILE, 0)).toBe('held');
    expect(balanceAfterText(MOBILE, 1500)).toBe(1438);
    expect(balanceAfterText(MOBILE, 0)).toBe(0);
    expect(textedLines(email('Bounced', 'x'), 'held').map((line) => line.word)).toEqual([
      'Email · Bounced',
      'SMS · Held',
      'Their page',
    ]);
  });

  it('moves Olumide Bello to In progress, keeps the Filter and counts again', () => {
    const m = startOf('trySmsSent', false);
    expect(m.balance).toBe(1438);
    expect(viewOf(m)).toMatchObject({
      status: 'Sent to Olumide Bello.',
      filterOn: 'bounced',
      head: 'Bounced · 1',
      resend: 8,
      title: 'Reached 133 of 142',
      line: 'Seen by 87 on their page · 1 in progress · 1 bounced · 2 failed · 1 opted out · 2 skipped · 2 no email or phone',
    });
    expect(groupsOf(m)).toEqual([['Bounced', 1]]);
    expect(resendOf(m, 'parking').n).toBe(8);
    const all = run(m, { type: 'filter', filter: 'everyone' });
    expect(groupsOf(all)[0]).toEqual(['In progress', 1]);
    const olumide = personOf(all, 'olumide');
    expect(olumide?.lines.map((line) => [line.word, line.reason])).toEqual([
      ['Email · Bounced', 'The inbox is full (4.2.2)'],
      ['SMS · Sent', '09:41'],
      ['Their page', 'Not seen yet'],
    ]);
    expect(olumide?.trySms).toBe(false);
    expect(olumide?.fixes).toEqual(['Mark as told in person']);
  });

  it('from the night, waits in progress, never Sending…', () => {
    const m = run(startOf('trySmsQuiet', false), { type: 'sendBySms', key: 'rafael' });
    expect(viewOf(m)).toMatchObject({ filterOn: 'failed', head: 'Failed · 1', resend: 8 });
    const rafael = personOf(run(m, { type: 'filter', filter: 'inProgress' }), 'rafael');
    expect(rafael?.lines[1]).toEqual({
      mark: 'sending',
      word: 'SMS',
      reason: 'Waiting until 09:00, their time',
    });
  });

  it('from too few credits, is Held, after In progress and left out of the resend', () => {
    const m = run(startOf('trySmsShort', false), { type: 'sendBySms', key: 'yuki' });
    expect(m.balance).toBe(0);
    expect(viewOf(m)).toMatchObject({
      status: 'Sent to Yuki Tanaka.',
      filterOn: 'skipped',
      head: 'Skipped · 1',
      resend: 8,
    });
    expect(viewOf(m).line).toBe(
      'Seen by 87 on their page · 1 held · 2 bounced · 2 failed · 1 opted out · 1 skipped · 2 no email or phone',
    );
    const sent = run(
      { ...m, balance: 1500 },
      { type: 'trySms', key: 'olumide' },
      { type: 'sendBySms', key: 'olumide' },
    );
    expect(groupsOf(run(sent, { type: 'filter', filter: 'notReached' })).slice(0, 2)).toEqual([
      ['In progress', 1],
      ['Held', 1],
    ]);
    expect(personOf(run(m, { type: 'filter', filter: 'held' }), 'yuki')?.lines[1]?.word).toBe(
      'SMS · Held',
    );
  });

  it('moves the Filter on only when its group is left with nobody', () => {
    const m = run(
      startOf('trySms', false),
      { type: 'markTold', key: 'tomas' },
      { type: 'sendBySms', key: 'olumide' },
    );
    expect(viewOf(m).filterOn).toBe('notReached');
  });
});

describe('the sends off, an event finished more than 30 days ago', () => {
  it('keeps Try SMS instead, Send again and Resend on show but sends nothing', () => {
    const m = startOf('closedReached', false);
    expect(m.closed).toBe('ended');
    expect(viewOf(m)).toMatchObject({ filterOn: 'bounced', resend: 9 });
    expect(personOf(m, 'tomas')).toMatchObject({ offer: true, fixes: [] });
    expect(personOf(m, 'olumide')?.trySms).toBe(true);
    expect(run(m, { type: 'trySms', key: 'olumide' })).toBe(m);
    expect(run(m, { type: 'sendBySms', key: 'olumide' })).toBe(m);
  });

  it('still lets the fixes, Not now and Mark as told in person work', () => {
    const m = run(
      startOf('closedReached', false),
      { type: 'notNowFor', key: 'tomas' },
      { type: 'markTold', key: 'olumide' },
    );
    expect(personOf(m, 'tomas')?.fixes).toEqual(['Mark as told in person']);
    expect(groupsOf(m)).toEqual([['Bounced', 1]]);
    expect(viewOf(m).resend).toBe(8);
  });
});

describe('a text waiting for the morning', () => {
  it('puts Valentina Restrepo first in In progress, one of the 56', () => {
    const m = startOf('reachedQuiet', false);
    const view = viewOf(m);
    expect(view.line).toBe('56 in progress · 2 can’t be told · seen by 3 on their page');
    const progress = view.groups[0];
    expect(progress).toMatchObject({
      word: 'In progress',
      count: 56,
      more: 'and 53 more, filling in as their deliveries come back',
    });
    expect(progress?.people.map((person) => person.key)).toEqual(['valentina', 'kwame', 'marta']);
    expect(progress?.people[0]?.lines.map((line) => [line.mark, line.word, line.reason])).toEqual([
      ['sending', 'SMS', 'Waiting until 09:00, their time'],
      ['none', 'Email', 'No email address'],
      ['none', 'Their page', 'Not seen yet'],
    ]);
    expect(progress?.people[0]?.fixes).toEqual(['Mark as told in person']);
    expect(isQuiet('04:41')).toBe(true);
  });
});

describe('Who it reached, reading only', () => {
  it('shows every status and reason, and no action, no Resend and no Try SMS', () => {
    const m = run(startOf('readOnly', false), {
      type: 'open',
      open: { kind: 'reached', of: 'parking' },
    });
    const view = viewOf(m);
    expect(view).toMatchObject({
      title: 'Reached 131 of 142',
      head: 'Not reached · 11',
      resend: 0,
    });
    expect(view.filter).toBe(true);
    for (const person of people(m)) {
      expect(person.fixes).toEqual([]);
      expect(person.offer).toBe(false);
      expect(person.trySms).not.toBe(true);
      expect(person.lines.length).toBeGreaterThan(0);
    }
    const reasons = run(
      { ...startOf('readOnly', false), sample: 'reasons' },
      { type: 'open', open: { kind: 'reached', of: 'parking' } },
    );
    expect(people(reasons).some((person) => person.trySms === true)).toBe(false);
  });
});
