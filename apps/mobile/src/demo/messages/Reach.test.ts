import { describe, expect, it } from 'vitest';

import { type Action, type Messages, startOf } from './MessagesModel.ts';
import type { PersonKey } from './MessagesSample.ts';
import { say } from './MessagesWords.ts';
import {
  EMPTY_LINE,
  emailBounced,
  isEmail,
  isPhone,
  reachViewOf,
  reduceReach,
  resendOf,
} from './Reach.ts';
import { REASON_GROUPS } from './ReasonsSample.ts';

const run = (m: Messages, ...actions: Action[]) => actions.reduce(reduceReach, m);
const ELEVEN = [
  'tomas',
  'yuki',
  'seun',
  'amaka',
  'priyanka',
  'sophie',
  'lars',
  'fatima',
  'diego',
  'joaquin',
  'mei',
] as const satisfies readonly PersonKey[];
const told = (...keys: readonly PersonKey[]): Action[] =>
  keys.map((key) => ({ type: 'markTold', key }));
const personOf = (m: Messages, key: string) => {
  const view = reachViewOf(m, m.open?.kind === 'reached' ? m.open.of : 'parking');
  return view.groups.flatMap((group) => group.people).find((person) => person.key === key);
};
const groupsOf = (m: Messages) =>
  reachViewOf(m, m.open?.kind === 'reached' ? m.open.of : 'parking').groups.map((group) => [
    group.word,
    group.count,
  ]);

describe('the address checks', () => {
  it('take an email with an @ and a domain', () => {
    expect(isEmail(' joaquin.ruiz@gmail.com ')).toBe(true);
    expect(isEmail('joaquin.ruiz@gmail')).toBe(false);
  });

  it('take a phone number with + and its country code, and seven digits or more', () => {
    expect(isPhone('+46 70 123 45 67')).toBe(true);
    expect(isPhone('070 123 45 67')).toBe(false);
    expect(isPhone('+44 12')).toBe(false);
  });
});

describe('Fix email address', () => {
  it('says which bounced only when the email line reads Bounced', () => {
    const lineOf = (key: string) => {
      const person = REASON_GROUPS.flatMap((group) => group.people).find((one) => one.key === key);
      return person == null ? null : say.wasAddress(person.bounced ?? '', emailBounced(person));
    };

    expect(lineOf('tomas')).toBe('Was tomas.ferreira@gmial.com, which bounced.');
    expect(lineOf('chidi')).toBe('Was chidi.okeke@gmail.com.');
    expect(lineOf('rafael')).toBe('Was rafael.costa@uol.com.br.');
    expect(lineOf('yuki')).toBe('Was yuki.tanaka@icloud.com.');
  });
});

describe('after a fix or an add', () => {
  it('keeps each channel line and adds the action’s own line, for all three', () => {
    const fixed = personOf(startOf('fixed', false), 'tomas');
    expect(fixed?.lines[0]?.word).toBe('Email · Bounced');
    expect(fixed?.updated).toBe(
      'Their email address has changed since. Nothing has been sent to it yet.',
    );
    expect(fixed?.offer).toBe(true);
    expect(resendOf(startOf('fixed', false), 'parking')).toMatchObject({
      n: 11,
      count: 4,
      still: 7,
    });

    expect(personOf(startOf('added', false), 'joaquin')?.updated).toBe(
      'An email address has been added since. Nothing has been sent to it yet.',
    );
    const lars = personOf(startOf('addedPhone', false), 'lars');
    expect(lars?.updated).toBe(
      'A phone number has been added since. Nothing has been sent to it yet.',
    );
    expect(lars?.lines.map((line) => line.reason)).toContain('No phone number');
  });

  it('after Not now hides the offer, keeps the line, brings back the other actions and counts them in the resend', () => {
    const m = startOf('notNow', false);
    const tomas = personOf(m, 'tomas');
    expect(tomas?.offer).toBe(false);
    expect(tomas?.updated).toContain('changed since');
    expect(tomas?.fixes).toEqual(['Add a phone number', 'Mark as told in person']);
    expect(groupsOf(m)).toContainEqual(['Bounced', 3]);
    expect(resendOf(m, 'parking')).toMatchObject({ n: 11, count: 4, still: 7 });
  });

  it('after Send again reads Sent on the new channel and moves them to In progress', () => {
    const sent = run(startOf('addedPhone', false), { type: 'sendAgain', key: 'lars' });
    expect(groupsOf(sent)).toEqual([['Opted out', 3]]);
    const m = run(sent, { type: 'filter', filter: 'notReached' });
    const lars = personOf(m, 'lars');
    expect(lars?.lines[1]).toEqual({
      mark: 'sent',
      word: 'SMS · Sent · 09:44',
      reason: '+46 70 123 45 67',
    });
    expect(lars?.updated).toBeUndefined();
    expect(lars?.fixes).toEqual(['Mark as told in person']);
    expect(groupsOf(m)[0]).toEqual(['In progress', 1]);
    expect(reachViewOf(m, 'parking')).toMatchObject({
      resend: 10,
      status: 'Sent to Lars Johansson.',
    });
  });

  it('opens each added state on the row’s own group, and keeps it after Send again', () => {
    expect(startOf('added', false).filter).toBe('none');
    expect(startOf('addedPhone', false).filter).toBe('optedOut');
    const m = run(startOf('added', false), { type: 'sendAgain', key: 'joaquin' });
    expect(reachViewOf(m, 'parking')).toMatchObject({
      filterOn: 'none',
      head: 'No email or phone · 1',
      status: 'Sent to Joaquín Ruiz.',
    });
  });

  it('keeps a person sent again on one message unsent on another', () => {
    const m = run(
      startOf('fixed', false),
      { type: 'sendAgain', key: 'tomas' },
      { type: 'open', open: { kind: 'reached', of: 'draft' } },
    );
    expect(personOf(m, 'tomas')?.offer).toBe(true);
  });
});

describe('told in person', () => {
  it('is offered on every not-reached row, Bounced and In progress included', () => {
    const rows = (m: Messages, of: 'parking' | 'draft') =>
      reachViewOf(run(m, { type: 'filter', filter: 'notReached' }), of).groups.flatMap(
        (group) => group.people,
      );
    const all = [
      ...rows(startOf('reached', false), 'parking'),
      ...rows(startOf('sentReached', false), 'draft'),
    ];
    expect(all.map((person) => person.name)).toContain('Yuki Tanaka');
    expect(all.filter((person) => !person.fixes.includes('Mark as told in person'))).toEqual([]);

    const bounced = run(startOf('filtered', false), ...told('yuki'));
    expect(reachViewOf(bounced, 'parking')).toMatchObject({
      title: 'Reached 132 of 142',
      head: 'Bounced · 2',
    });
    const kwame = run(startOf('sentReached', false), ...told('kwame'));
    expect(reachViewOf(kwame, 'draft')).toMatchObject({ title: 'Reached 39 of 96 so far' });
  });

  it('counts them reached, lists them under Marked as told with who and when, and Undo puts them back', () => {
    const m = startOf('told', false);
    const view = reachViewOf(m, 'parking');
    expect(view.title).toBe('Reached 132 of 142');
    expect(view.head).toBe('Marked as told · 1');
    expect(view.groups[0]?.people[0]?.lines.at(-1)).toEqual({
      mark: 'delivered',
      word: 'Told in person',
      reason: 'Marked by Folake Adeyemi at 09:44',
    });
    expect(view.groups[0]?.people[0]?.fixes).toEqual(['Undo']);
    expect(view.resend).toBe(10);
    expect(resendOf(m, 'parking')).toMatchObject({ count: 2, unconfirmed: 1 });

    const undone = run(
      m,
      { type: 'undoTold', key: 'amaka' },
      { type: 'filter', filter: 'notReached' },
    );
    expect(reachViewOf(undone, 'parking').title).toBe('Reached 131 of 142');
    expect(groupsOf(undone)).toContainEqual(['Not confirmed', 2]);
  });
});

describe('the filter', () => {
  it('offers Everyone, Not reached, each group that has someone, Reached and Marked as told', () => {
    const view = reachViewOf(startOf('filterMenu', false), 'parking');
    expect(view.options.map((option) => [option.word, option.count])).toEqual([
      ['Everyone', 142],
      ['Not reached', 11],
      ['Bounced', 3],
      ['Not confirmed', 2],
      ['Opted out', 4],
      ['No email or phone', 2],
      ['Reached', 131],
      ['Marked as told', 0],
    ]);
  });

  it('shows only the group chosen', () => {
    const m = startOf('filtered', false);
    expect(reachViewOf(m, 'parking').head).toBe('Bounced · 3');
    expect(groupsOf(m)).toEqual([['Bounced', 3]]);
  });

  it('stays where the host put it while the group shown has someone, then gives way to Not reached', () => {
    const one = run(
      startOf('reached', false),
      { type: 'filter', filter: 'notConfirmed' },
      ...told('amaka'),
    );
    expect(reachViewOf(one, 'parking')).toMatchObject({ head: 'Not confirmed · 1', empty: null });

    const none = run(one, ...told('priyanka'));
    expect(reachViewOf(none, 'parking')).toMatchObject({
      filterOn: 'notReached',
      head: 'Not reached · 9',
      empty: null,
    });
    expect(run(none, { type: 'undoTold', key: 'priyanka' }).filter).toBe('notReached');
  });

  it('gives way to Everyone once nobody is left not reached', () => {
    const m = run(startOf('filtered', false), ...told(...ELEVEN.slice(3)));
    expect(m.filter).toBe('bounced');
    expect(run(m, ...told('tomas', 'yuki', 'seun')).filter).toBe('everyone');
  });

  it('says in each filter’s own words that nobody is in it, the heading keeping its 0', () => {
    const m = startOf('filtered', false);
    expect(reachViewOf(run(m, { type: 'filter', filter: 'told' }), 'parking')).toMatchObject({
      head: 'Marked as told · 0',
      empty: 'Nobody is marked as told yet.',
    });
    expect(
      reachViewOf(run(m, ...told(...ELEVEN), { type: 'filter', filter: 'notReached' }), 'parking'),
    ).toMatchObject({ head: 'Not reached · 0', empty: 'Nobody is left to reach.', groups: [] });
    expect(EMPTY_LINE).toEqual({
      notReached: 'Nobody is left to reach.',
      reached: 'Nobody has been reached yet.',
      told: 'Nobody is marked as told yet.',
    });
  });

  it('lists the reached two drawn and counts the rest', () => {
    const view = reachViewOf(
      run(startOf('reached', false), { type: 'filter', filter: 'reached' }),
      'parking',
    );
    expect(view.groups[0]).toMatchObject({ word: 'Reached', count: 131, more: 'and 129 more' });
  });

  it('starts again on its default for another message', () => {
    const m = run(startOf('filtered', false), {
      type: 'open',
      open: { kind: 'reached', of: 'draft' },
    });
    expect(reachViewOf(m, 'draft').filterOn).toBe('everyone');
  });
});

describe('the resend', () => {
  it('leaves out in progress and told, includes the not confirmed, and lists who still can’t be told', () => {
    expect(resendOf(startOf('resend', false), 'parking')).toEqual({
      n: 11,
      count: 3,
      unconfirmed: 2,
      still: 8,
      names: [
        'Joaquín Ruiz · No email address · No phone number',
        'Sophie Laurent · Unsubscribed · Stopped texts',
      ],
    });
  });

  it('from an invitation and from a message just sent has nobody to tell until an address is added', () => {
    expect(resendOf(startOf('resendInvited', false), 'invite')).toMatchObject({
      n: 2,
      count: 0,
      unconfirmed: 0,
    });
    expect(resendOf(startOf('resendSent', false), 'draft')).toMatchObject({
      n: 2,
      count: 0,
      names: [
        'Tomás Ferreira · Address is bouncing · No phone number',
        'Joaquín Ruiz · No email address · No phone number',
      ],
    });

    const added = run(
      startOf('invitedReached', false),
      { type: 'fixed', key: 'joaquin', address: 'joaquin.ruiz@gmail.com', how: 'addEmail' },
      { type: 'notNowFor', key: 'joaquin' },
    );
    expect(resendOf(added, 'invite')).toMatchObject({ n: 2, count: 1, still: 1 });
  });
});

describe('on an event that can’t send (?state=closedEnded)', () => {
  it('refuses Send again and Resend, and still saves an address, Not now, marks and undoes', () => {
    const ended = run(
      startOf('closedEnded', false),
      { type: 'open', open: { kind: 'reached', of: 'parking' } },
      { type: 'fixed', key: 'tomas', address: 'tomas.ferreira@gmail.com' },
    );
    expect(personOf(ended, 'tomas')).toMatchObject({ offer: true });
    expect(run(ended, { type: 'sendAgain', key: 'tomas' }).again).toEqual({});
    expect(run(ended, { type: 'resending', open: true }).resending).toBe(false);
    expect(personOf(run(ended, { type: 'notNowFor', key: 'tomas' }), 'tomas')?.offer).toBe(false);

    const marked = run(ended, ...told('yuki'));
    expect(reachViewOf(marked, 'parking').title).toBe('Reached 132 of 142');
    expect(reachViewOf(run(marked, { type: 'undoTold', key: 'yuki' }), 'parking').title).toBe(
      'Reached 131 of 142',
    );
  });
});

describe('texts that failed (?state=reachedSmsFailed)', () => {
  it('lists six more in Reached, email delivered and SMS failed with its reason, the counts unchanged', () => {
    const failed = reachViewOf(startOf('reachedSmsFailed', false), 'draft');
    const sent = reachViewOf(startOf('sentReached', false), 'draft');
    const reached = failed.groups.find((group) => group.key === 'reached');

    expect(failed.title).toBe(sent.title);
    expect(failed.parts).toEqual(sent.parts);
    expect(reached?.count).toBe(38);
    expect(reached?.more).toBe('and 31 more');
    expect(
      reached?.people
        .slice(1)
        .map((person) => [
          person.name,
          ...person.lines.map((line) => [line.mark, line.word, line.reason]),
        ]),
    ).toEqual(
      [
        ['Chidi Okonkwo', 'Number not in use (30005)'],
        ['Ana Pereira', 'Number cannot receive texts (30006)'],
        ['Hana Sato', 'Phone off or out of signal (30003)'],
        ['Mateo García', 'Blocked by their network (30007)'],
        ['Léa Martin', 'No reason given (30008)'],
        ['João Santos', 'No reason given'],
      ].map(([name, reason]) => [
        name,
        ['delivered', 'Email · Delivered', '09:41'],
        ['bounced', 'SMS · Failed', reason],
        name === 'Chidi Okonkwo'
          ? ['delivered', 'Their page', 'Seen 09:42']
          : ['none', 'Their page', 'Not seen yet'],
      ]),
    );
  });
});
