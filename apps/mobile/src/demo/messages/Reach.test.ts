import { describe, expect, it } from 'vitest';

import { type Action, type Messages, reduce, startOf } from './MessagesModel.ts';
import { isEmail, isPhone, reachViewOf, resendOf } from './Reach.ts';

const run = (m: Messages, ...actions: Action[]) => actions.reduce(reduce, m);
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

describe('after a fix or an add', () => {
  it('keeps each channel line and adds the action’s own line, for all three', () => {
    const fixed = personOf(startOf('fixed', false), 'tomas');
    expect(fixed?.lines[0]?.word).toBe('Email · Bounced');
    expect(fixed?.updated).toBe(
      'Their email address has changed since. Nothing has been sent to it yet.',
    );
    expect(fixed?.offer).toBe(true);

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
    expect(tomas?.fixes).toEqual(['Add a phone number']);
    expect(groupsOf(m)).toContainEqual(['Bounced', 3]);
    expect(resendOf(m, 'parking')).toMatchObject({ n: 11, count: 4, still: 7 });
  });

  it('after Send again reads Sent on the new channel and moves them to In progress', () => {
    const m = run(startOf('addedPhone', false), { type: 'sendAgain', key: 'lars' });
    const lars = personOf(m, 'lars');
    expect(lars?.lines[1]).toEqual({
      mark: 'sent',
      word: 'SMS · Sent · 09:44',
      reason: '+46 70 123 45 67',
    });
    expect(lars?.updated).toBeUndefined();
    expect(groupsOf(m)[0]).toEqual(['In progress', 1]);
    expect(reachViewOf(m, 'parking')).toMatchObject({
      resend: 10,
      status: 'Sent to Lars Johansson.',
    });
  });

  it('opens each added state on the row’s own group, and Send again goes back to Not reached', () => {
    expect(startOf('added', false).filter).toBe('none');
    expect(startOf('addedPhone', false).filter).toBe('optedOut');
    expect(run(startOf('added', false), { type: 'sendAgain', key: 'joaquin' }).filter).toBeNull();
    expect(
      run({ ...startOf('added', false), filter: 'everyone' }, { type: 'sendAgain', key: 'joaquin' })
        .filter,
    ).toBe('everyone');
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

  it('shows only the group chosen, and says so when nobody is marked as told', () => {
    const m = startOf('filtered', false);
    expect(reachViewOf(m, 'parking').head).toBe('Bounced · 3');
    expect(groupsOf(m)).toEqual([['Bounced', 3]]);

    const told = reachViewOf(run(m, { type: 'filter', filter: 'told' }), 'parking');
    expect(told).toMatchObject({ head: 'Marked as told · 0', empty: true });
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
        'Sophie Laurent · Unsubscribed · Texted STOP',
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
