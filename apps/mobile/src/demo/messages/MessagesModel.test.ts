import { describe, expect, it } from 'vitest';

import {
  type Action,
  COUNTDOWN_SECONDS,
  MESSAGES_STATES,
  type Messages,
  badgeOf,
  blankDraft,
  checkOf,
  draftLine,
  draftTitle,
  messageName,
  messagesStateOf,
  reduce,
  resultOf,
  sampleDraft,
  sectionsOf,
  spokenAt,
  startOf,
  toChip,
} from './MessagesModel.ts';
import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import { sampleEvent } from '../events/EventsSample.ts';
import {
  NOT_REACHED,
  TO_FIGURES,
  TO_ORDER,
  TO_WORD,
  filledFor,
  piecesOf,
} from './MessagesSample.ts';
import { tellChange } from './TellChange.ts';

const run = (m: Messages, ...actions: Action[]) => actions.reduce(reduce, m);

describe('the states', () => {
  it('are the spec’s 24, by the names both demos use', () => {
    expect(MESSAGES_STATES).toEqual([
      'first',
      'loading',
      'inUse',
      'conversation',
      'replyArrived',
      'answered',
      'channelReply',
      'to',
      'write',
      'preview',
      'check',
      'countdown',
      'cancelled',
      'sending',
      'sent',
      'failed',
      'reached',
      'fix',
      'resend',
      'tell',
      'untold',
      'invited',
      'scheduled',
      'bell',
    ]);
  });

  it('read from ?state=, and nothing else', () => {
    for (const state of MESSAGES_STATES) expect(messagesStateOf(state)).toBe(state);
    expect(messagesStateOf('live')).toBeNull();
    expect(messagesStateOf(undefined)).toBeNull();
  });

  it('each open where the boards draw them', () => {
    expect(startOf('first', false).phase).toBe('first');
    expect(startOf('loading', true).phase).toBe('loading');
    expect(startOf('inUse', true).open).toBeNull();
    expect(startOf('conversation', false).open).toEqual({ kind: 'guest', key: 'ines' });
    expect(startOf('channelReply', false).typed.kwame).toBe(
      'Formal: suits and long dresses are welcome.',
    );
    expect(startOf('to', false).picking).toBe(true);
    expect(startOf('check', false).draft?.step).toBe('check');
    expect(startOf('countdown', false).draft?.seconds).toBe(COUNTDOWN_SECONDS);
    expect(startOf('fix', true)).toMatchObject({ open: { kind: 'reached' }, fixing: true });
    expect(startOf('resend', false)).toMatchObject({
      open: { kind: 'many', key: 'parking' },
      resending: true,
    });
    expect(startOf('tell', false).telling).toBe(true);
    expect(startOf('untold', false).untold).toBe(true);
    expect(startOf('invited', false).open).toEqual({ kind: 'many', key: 'invite' });
    expect(startOf('scheduled', false).open).toEqual({ kind: 'many', key: 'sched' });
    expect(startOf('bell', false).bell).toBe(true);
  });

  it('keep Inês open beside the list on the iPad, and the list alone on the phone', () => {
    for (const state of ['replyArrived', 'untold', 'bell'] as const) {
      expect(startOf(state, true).open).toEqual({ kind: 'guest', key: 'ines' });
      expect(startOf(state, false).open).toBeNull();
    }
  });

  it('say Cancelled as a toast on the phone and a line in the stream on the iPad', () => {
    expect(startOf('cancelled', false).told).toBe(
      'Cancelled. Nothing was sent; your message is back in the box.',
    );
    expect(startOf('cancelled', true).draft?.cancelled).toBe(true);
  });
});

describe('the list', () => {
  it('sorts into Needs you · 5, Scheduled · 1 and Done, with the badge at 4', () => {
    const m = startOf('inUse', false);
    const sections = sectionsOf(m);

    expect(sections.needs.map((row) => row.key)).toEqual([
      'ines',
      'lucia',
      'kwame',
      'unknown',
      'parking',
    ]);
    expect(sections.scheduled).toHaveLength(1);
    expect(sections.done.map((row) => row.key)).toEqual(['marta', 'invite']);
    expect(badgeOf(m)).toEqual({ waiting: 3, notMatched: 1, total: 4 });
  });

  it('puts an arriving reply first and the badge at 5', () => {
    const m = startOf('replyArrived', false);

    expect(sectionsOf(m).needs[0]).toEqual({ kind: 'guest', key: 'lucia' });
    expect(badgeOf(m)?.total).toBe(5);
  });

  it('moves a guest to Done and back with Mark as done and Mark as waiting', () => {
    const answered = startOf('answered', false);
    expect(sectionsOf(answered).done[0]).toEqual({ kind: 'guest', key: 'ines' });
    expect(badgeOf(answered)?.waiting).toBe(2);

    const waiting = reduce(answered, { type: 'markWaiting', key: 'ines' });
    expect(sectionsOf(waiting).needs[0]).toEqual({ kind: 'guest', key: 'ines' });

    const done = run(
      startOf('conversation', false),
      { type: 'answer', key: 'ines', text: 'Yes' },
      { type: 'markDone', key: 'ines' },
    );
    expect(done.doneAt.ines).toBe('09:41');
    expect(done.answers.ines).toEqual({ text: 'Yes', time: '09:41', seen: null });
  });

  it('hides the badge while loading and the first time', () => {
    expect(badgeOf(startOf('loading', false))).toBeNull();
    expect(badgeOf(startOf('first', false))).toBeNull();
  });
});

describe('the To groups', () => {
  it('are the app’s three, with pm’s Hasn’t replied, and their counts', () => {
    expect(TO_ORDER.map((to) => TO_WORD[to])).toEqual(['All guests', 'Coming', 'Hasn’t replied']);
    expect(TO_ORDER.map(toChip)).toEqual([
      'All guests · 142',
      'Coming · 96',
      'Hasn’t replied · 25',
    ]);
  });

  it('open, choose, and close, and the check follows the choice', () => {
    const picked = run(
      startOf('write', false),
      { type: 'picking', open: true },
      { type: 'chooseTo', to: 'all' },
    );

    expect(picked.picking).toBe(false);
    expect(picked.draft?.to).toBe('all');
    expect(checkOf(picked.draft ?? blankDraft()).count).toBe(TO_FIGURES.all.count);
  });

  it('start a new message at All guests, with email and SMS ticked', () => {
    const m = reduce(startOf('inUse', false), { type: 'newMessage' });

    expect(m.draft).toMatchObject({ to: 'all', channels: { email: true, sms: true, wa: false } });
    expect(draftLine(m.draft ?? blankDraft())).toBe('To All guests · not sent yet');
  });
});

describe('the check', () => {
  it('says what the boards draw for Coming', () => {
    expect(checkOf(sampleDraft())).toEqual({
      count: 96,
      told: [
        { key: 'email', count: 92 },
        { key: 'sms', count: 31 },
      ],
      cantTell: 2,
      names: [
        'Tomás Ferreira · Address is bouncing · No phone number',
        'Joaquín Ruiz · No email address · No phone number',
      ],
      seeAll: false,
      credits: 31,
      after: '1,469',
      whatsApp: false,
    });
  });

  it('counts the channels ticked, and their credits', () => {
    const draft = run(startOf('write', false), { type: 'channel', key: 'sms' }).draft;
    const check = checkOf(draft ?? blankDraft());

    expect(check.told.map((told) => told.key)).toEqual(['email']);
    expect(check.credits).toBe(0);
  });

  it('opens only with words in the message, and Change it goes back', () => {
    const blank = reduce(startOf('inUse', false), { type: 'newMessage' });
    expect(reduce(blank, { type: 'send' }).draft?.step).toBe('write');

    const checking = run(blank, { type: 'body', text: 'Hello' }, { type: 'send' });
    expect(checking.draft?.step).toBe('check');
    expect(reduce(checking, { type: 'changeIt' }).draft?.step).toBe('write');
  });

  it('opens from the preview, which Edit leaves', () => {
    const previewing = reduce(startOf('write', false), { type: 'preview' });
    expect(previewing.draft?.step).toBe('preview');
    expect(reduce(previewing, { type: 'edit' }).draft?.step).toBe('write');
    expect(reduce(previewing, { type: 'send' }).draft?.step).toBe('check');
  });
});

describe('the ten seconds', () => {
  const ticks = (m: Messages, count: number) =>
    run(m, ...Array.from({ length: count }, (): Action => ({ type: 'tick' })));

  it('count down from 10 on the message, then it sends', () => {
    const counting = reduce(startOf('check', false), { type: 'confirm' });
    expect(counting.draft).toMatchObject({ step: 'countdown', seconds: 10 });
    expect(draftLine(counting.draft ?? blankDraft())).toBe('Sending in 10…');

    const three = ticks(counting, 3);
    expect(three.draft?.seconds).toBe(7);
    expect(draftLine(three.draft ?? blankDraft())).toBe('Sending in 7…');

    const gone = ticks(counting, 10);
    expect(gone.draft).toMatchObject({ step: 'sending', seconds: 0 });
    expect(draftLine(gone.draft ?? blankDraft())).toBe('Reached 38 of 96 so far');
    expect(ticks(gone, 2).draft?.step).toBe('sending');

    const sent = ticks(gone, 3);
    expect(sent.draft?.step).toBe('sent');
    expect(draftLine(sent.draft ?? blankDraft())).toBe('Reached 94 of 96');
    expect(draftTitle(sent.draft ?? blankDraft())).toBe('Parking and the dress code');
  });

  it('hold a `?state=sending` link, which never left a countdown', () => {
    expect(ticks(startOf('sending', false), 5).draft?.step).toBe('sending');
  });

  it('are said at 10, 5 and 0 only', () => {
    const said = Array.from({ length: 11 }, (_, index) => spokenAt(10 - index, 96));

    expect(said.filter((words) => words != null)).toEqual([
      'Sending in 10…',
      'Sending in 5…',
      'Message queued. Sending to 96 people now.',
    ]);
  });

  it('cancel with the words back in the box', () => {
    const cancelled = run(
      startOf('countdown', false),
      { type: 'tick' },
      { type: 'cancelCountdown' },
    );

    expect(cancelled.draft).toMatchObject({ step: 'write', cancelled: true });
    expect(cancelled.draft?.body).toBe(sampleDraft().body);
    expect(ticks(cancelled, 3).draft?.step).toBe('write');
  });

  it('try again after a failed send', () => {
    const failed = startOf('failed', false);
    expect(draftLine(failed.draft ?? blankDraft())).toBe('Nothing was sent');
    const again = reduce(failed, { type: 'retry' });
    expect(again.draft?.step).toBe('sending');
    expect(ticks(again, 3).draft?.step).toBe('sent');
  });

  it('reach every guest who can be told', () => {
    for (const to of TO_ORDER) {
      const result = resultOf({ ...sampleDraft(), to });
      expect(result.reached).toBe(TO_FIGURES[to].count - TO_FIGURES[to].cantTell);
    }
  });
});

describe('the rest of the flow', () => {
  it('goes from Who it reached back to its message, and the fix saves', () => {
    const fixing = startOf('fix', false);
    expect(reduce(fixing, { type: 'fixed' })).toMatchObject({ fixing: false, told: 'Saved' });
    expect(reduce(fixing, { type: 'back' }).open).toEqual({ kind: 'many', key: 'parking' });
  });

  it('holds the banner after Not now, until Tell them or Dismiss', () => {
    const later = reduce(startOf('tell', false), { type: 'notNow' });
    expect(later).toMatchObject({ telling: false, untold: true });
    expect(reduce(later, { type: 'dismissUntold' }).untold).toBe(false);
    expect(run(later, { type: 'telling', open: true }, { type: 'tellSent' }).untold).toBe(false);
  });

  it('draws a token as a chip, and fills it in on the guest’s page', () => {
    expect(piecesOf('{Greeting}, hello')).toEqual([
      { token: true, text: 'Greeting' },
      { token: false, text: ', hello' },
    ]);
    expect(filledFor('{Greeting}, hello', 'Kwame Mensah')).toBe('Kwame Mensah, hello');
  });
});

describe('the demo home', () => {
  it('links every state into the wedding’s Messages', () => {
    expect(MESSAGES_BOARDS.map((board) => board.state)).toEqual([...MESSAGES_STATES]);
    expect(MESSAGES_BOARDS[0]?.href).toBe('/demo/events/evt-wed-4?area=messages&state=first');
    expect(new Set(MESSAGES_BOARDS.map((board) => board.title)).size).toBe(MESSAGES_STATES.length);
  });
});

describe('a message’s name', () => {
  it('is its Subject, or with none its first line', () => {
    const plain = { ...sampleDraft('sent'), subject: '', body: 'Bring a coat.\nIt will be cold.' };

    expect(messageName(sampleDraft('sent'))).toBe('Parking and the dress code');
    expect(messageName(plain)).toBe('Bring a coat.');
    expect(draftTitle(plain)).toBe('Bring a coat.');
    expect(draftTitle({ ...plain, step: 'write' })).toBe('New message');
  });
});

describe('Write a follow-up', () => {
  const ticks = (m: Messages, count: number) =>
    run(m, ...Array.from({ length: count }, (): Action => ({ type: 'tick' })));

  it('keeps the sent message and writes the next one after it, to the same people', () => {
    const next = reduce(startOf('sent', false), { type: 'followUp', base: null });

    expect(next.thread?.earlier).toHaveLength(1);
    expect(next.thread?.earlier[0]?.subject).toBe('Parking and the dress code');
    expect(next.draft).toMatchObject({ step: 'write', to: 'coming', body: '' });
    expect(draftTitle(next.draft ?? blankDraft(), next.thread)).toBe('Parking and the dress code');
  });

  it('waits while the message counts down or is sent', () => {
    const counting = startOf('countdown', false);
    expect(reduce(counting, { type: 'followUp', base: null })).toBe(counting);
  });

  it('follows up a sample message in its own conversation', () => {
    const parking = reduce(startOf('reached', false), { type: 'back' });
    const next = reduce(parking, { type: 'followUp', base: 'parking' });

    expect(next.thread).toMatchObject({ base: 'parking', earlier: [] });
    expect(next.draft).toMatchObject({ step: 'write', to: 'all' });
  });

  it('keeps a sent conversation when a new message starts, and opens it again', () => {
    const sent = startOf('sent', false);
    const fresh = reduce(sent, { type: 'newMessage' });

    expect(fresh.kept.map((kept) => kept.id)).toEqual(['new-1']);
    expect(fresh.thread?.id).toBe('new-2');
    expect(fresh.draft?.step).toBe('write');

    const back = reduce(fresh, { type: 'openThread', id: 'new-1' });
    expect(back.thread?.id).toBe('new-1');
    expect(back.draft?.step).toBe('sent');
    expect(back.kept.map((kept) => kept.id)).toEqual(['new-2']);
  });

  it('opens the message still on its way rather than a new one', () => {
    const counting = startOf('countdown', false);
    expect(reduce(counting, { type: 'newMessage' }).thread?.id).toBe('new-1');
  });

  it('lets a kept message finish sending', () => {
    const confirmed = reduce(startOf('check', false), { type: 'confirm' });
    const counted = ticks(confirmed, 10);
    const parked = reduce(counted, { type: 'open', open: { kind: 'many', key: 'parking' } });
    const followed = reduce(parked, { type: 'followUp', base: 'parking' });

    expect(followed.kept[0]?.draft.step).toBe('sending');
    expect(ticks(followed, 3).kept[0]?.draft.step).toBe('sent');
  });
});

describe('Who it reached', () => {
  it('names all eleven not reached, the boards’ three first', () => {
    expect(NOT_REACHED).toHaveLength(11);
    expect(NOT_REACHED.slice(0, 3).map((person) => person.name)).toEqual([
      'Tomás Ferreira',
      'Amaka Eze',
      'Joaquín Ruiz',
    ]);
    expect(NOT_REACHED.filter((person) => person.bounced != null)).toHaveLength(3);
  });
});

describe('Tell guests after a change', () => {
  const wedding = sampleEvent('evt-wed-4');
  if (wedding == null) throw new Error('The sample has the wedding.');

  it('offers the start time when it moves', () => {
    expect(tellChange(wedding, { ...wedding, startsAt: '2026-11-05T17:30:00Z' }, 'en-US')).toEqual({
      lines: ['The start time is now 17:30 (was 18:00).'],
      what: ['New start time'],
    });
  });

  it('offers the dates when they move, and the venue when it changes', () => {
    const moved = {
      ...wedding,
      startsAt: '2026-11-06T18:00:00Z',
      endsAt: '2026-11-08T15:00:00Z',
      venue: { name: 'Oslo Hall', address: '1 Oslo Street', place: 'Oslo Hall, London' },
    };
    const change = tellChange(wedding, moved, 'en-US');

    expect(change.what).toEqual(['New dates', 'New venue']);
    expect(change.lines[0]).toMatch(/^The dates are now .+ \(was .+\)\.$/u);
    expect(change.lines[1]).toBe('The venue is now Oslo Hall (was The Landmark).');
  });

  it('offers nothing for an end moved within its last day, a draft, or no change', () => {
    expect(
      tellChange(wedding, { ...wedding, endsAt: '2026-11-07T16:00:00Z' }, 'en-US').lines,
    ).toEqual([]);
    expect(
      tellChange(
        wedding,
        { ...wedding, status: 'draft', startsAt: '2026-11-05T17:30:00Z' },
        'en-US',
      ).lines,
    ).toEqual([]);
    expect(tellChange(wedding, wedding, 'en-US').lines).toEqual([]);
  });
});
