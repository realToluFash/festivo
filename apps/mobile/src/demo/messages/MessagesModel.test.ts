import { describe, expect, it } from 'vitest';

import {
  type Action,
  COUNTDOWN_SECONDS,
  MESSAGES_STATES,
  type Messages,
  type RowId,
  badgeOf,
  blankDraft,
  channelsWords,
  checkOf,
  dayWords,
  draftLine,
  draftTitle,
  justNow,
  laterRefused,
  messageName,
  messagesStateOf,
  noticeCost,
  noticeCostOf,
  reduce,
  resultOf,
  rowDay,
  sampleDraft,
  sectionsOf,
  spokenAt,
  startOf,
  tellNowBy,
  tellingBy,
  toChip,
} from './MessagesModel.ts';
import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import { sampleEvent } from '../events/EventsSample.ts';
import {
  NOT_REACHED,
  PARKING_GROUPS,
  TO_FIGURES,
  TO_ORDER,
  TO_WORD,
  filledFor,
  piecesOf,
} from './MessagesSample.ts';
import { tellChange } from './TellChange.ts';
import { keepWhole, outsideToken, tokenText } from './TokenText.ts';

const run = (m: Messages, ...actions: Action[]) => actions.reduce(reduce, m);
const nameOf = (id: RowId) => (id.kind === 'draft' ? id.id : id.key);

describe('the states', () => {
  it('are the spec’s 42, the notice’s three and Who it reached’s eight, by the names both demos use', () => {
    expect(MESSAGES_STATES).toHaveLength(53);
    expect(MESSAGES_STATES.slice(6, 10)).toEqual([
      'channelReply',
      'noticeCost',
      'noticeWaits',
      'noticeNotSent',
    ]);
    expect(MESSAGES_STATES.slice(0, 3)).toEqual(['first', 'loading', 'inUse']);
    expect(MESSAGES_STATES.slice(27)).toEqual([
      'invitedReached',
      'sentReached',
      'notMatched',
      'matchPicker',
      'matched',
      'later',
      'scheduledEdit',
      'sendNow',
      'cancelAsk',
      'scheduledCancelled',
      'fixed',
      'sentAgain',
      'checkAll',
      'checkNotReplied',
      'checkChannels',
      'noSubject',
      'followUp',
      'tellPlace',
      'added',
      'addedPhone',
      'notNow',
      'told',
      'filterMenu',
      'filtered',
      'resendInvited',
      'resendSent',
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
    expect(startOf('scheduled', false)).toMatchObject({
      open: { kind: 'draft' },
      thread: { id: 'sched' },
    });
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

    expect(sections.needs.map(nameOf)).toEqual(['ines', 'lucia', 'kwame', 'unknown', 'parking']);
    expect(sections.scheduled).toHaveLength(1);
    expect(sections.done.map(nameOf)).toEqual(['marta', 'invite']);
    expect(sections.scheduled.map(nameOf)).toEqual(['sched']);
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
    expect(done.answers.ines).toEqual({
      text: 'Yes',
      time: '09:41',
      seen: null,
      by: 'email',
      notice: 'told',
    });
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
      smsOff: 0,
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
    expect(reduce(fixing, { type: 'fixed', key: 'tomas', address: 'a@b.co' })).toMatchObject({
      fixing: false,
      told: 'Saved',
      fixed: { tomas: 'a@b.co' },
    });
    expect(reduce(fixing, { type: 'back' }).open).toEqual({ kind: 'many', key: 'parking' });
  });

  it('holds the banner after Not now, until Tell them or Dismiss', () => {
    const later = reduce(startOf('tell', false), { type: 'notNow' });
    expect(later).toMatchObject({ telling: false, untold: true });
    expect(reduce(later, { type: 'dismissUntold' }).untold).toBe(false);
    expect(run(later, { type: 'telling', open: true }, { type: 'tellSent' }).untold).toBe(false);
  });

  it('draws a token as a chip, and fills it in on the guest’s page', () => {
    expect(piecesOf(`${tokenText('Greeting')}, hello`)).toEqual([
      { token: true, text: 'Greeting' },
      { token: false, text: ', hello' },
    ]);
    expect(filledFor(`${tokenText('Greeting')}, hello`, 'Kwame Mensah')).toBe(
      'Kwame Mensah, hello',
    );
  });

  it('keeps braces the host types as text, in the field and on the page', () => {
    expect(piecesOf('{Greeting}, hello')).toEqual([{ token: false, text: '{Greeting}, hello' }]);
    expect(filledFor('{Greeting}, hello', 'Kwame Mensah')).toBe('{Greeting}, hello');
  });
});

describe('a token in the app’s field is one unit (pm, 7 Nov)', () => {
  const greeting = tokenText('Greeting');
  const was = `Hi ${greeting}, see you`;
  const after = 3 + greeting.length;

  it('takes the whole token with one Backspace after it', () => {
    const next = was.slice(0, after - 1) + was.slice(after);
    expect(keepWhole(was, next)).toEqual({ text: 'Hi , see you', caret: 3 });
  });

  it('takes the whole token with one Delete before it', () => {
    const next = was.slice(0, 3) + was.slice(4);
    expect(keepWhole(was, next)).toEqual({ text: 'Hi , see you', caret: 3 });
  });

  it('puts a key typed inside the token after it', () => {
    const next = `${was.slice(0, 6)}x${was.slice(6)}`;
    expect(keepWhole(was, next)).toEqual({ text: `Hi ${greeting}x, see you`, caret: after + 1 });
  });

  it('leaves an edit outside the token as typed', () => {
    expect(keepWhole(was, `${was}!`)).toEqual({ text: `${was}!`, caret: was.length + 1 });
    expect(keepWhole(was, was.replace('Hi', 'Hello')).text).toBe(was.replace('Hi', 'Hello'));
  });

  it('takes a selection that reaches into a token, and the token with it', () => {
    const next = `Hi${was.slice(5)}`;
    expect(keepWhole(was, next).text).toBe('Hi, see you');
  });

  it('takes the token before the caret with Backspace between two, and the one after with Delete', () => {
    const event = tokenText('Event');
    const pair = `${greeting}${event}`;
    const next = pair.slice(0, greeting.length - 1) + pair.slice(greeting.length);

    expect(keepWhole(pair, next, true)).toEqual({ text: event, caret: 0 });
    expect(keepWhole(pair, next)).toEqual({ text: greeting, caret: greeting.length });
  });

  it('never leaves the caret inside a token', () => {
    expect(outsideToken(was, 5)).toBe(3);
    expect(outsideToken(was, after - 2)).toBe(after);
    expect(outsideToken(was, after)).toBe(after);
    expect(outsideToken(was, 1)).toBe(1);
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

    expect(fresh.kept.map((kept) => kept.id)).toEqual(['new-1', 'sched']);
    expect(fresh.thread?.id).toBe('new-2');
    expect(fresh.draft?.step).toBe('write');

    const back = reduce(fresh, { type: 'openThread', id: 'new-1' });
    expect(back.thread?.id).toBe('new-1');
    expect(back.draft?.step).toBe('sent');
    expect(back.kept.map((kept) => kept.id)).toEqual(['new-2', 'sched']);
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
  it('names all eleven not reached, grouped as sc-3966 counts them', () => {
    expect(NOT_REACHED).toHaveLength(11);
    expect(PARKING_GROUPS.map((group) => [group.word, group.people.map((p) => p.name)])).toEqual([
      ['Bounced', ['Tomás Ferreira', 'Yuki Tanaka', 'Oluwaseun Adebayo']],
      ['Not confirmed', ['Amaka Eze', 'Priyanka Nair']],
      [
        'Opted out',
        ['Sophie Laurent', 'Lars Johansson', 'Fatima Zahra El Idrissi', 'Diego Herrera'],
      ],
      ['No email or phone', ['Joaquín Ruiz', 'Mei Lin Chen']],
    ]);
  });

  it('after a fix waits for Send again, then counts the person in progress', () => {
    const fixed = startOf('fixed', false);
    expect(fixed.fixed.tomas).toBe('tomas.ferreira@gmail.com');

    const again = reduce(fixed, { type: 'sendAgain', key: 'tomas' });
    expect(again).toMatchObject({ again: { 'parking.tomas': '09:44' }, said: 'parking.tomas' });
    expect(startOf('sentAgain', false)).toMatchObject({
      again: { 'parking.tomas': '09:44' },
      said: 'parking.tomas',
    });
  });

  it('opens for an invitation and for a message just sent, and goes back to each', () => {
    const invite = startOf('invitedReached', false);
    expect(invite.open).toEqual({ kind: 'reached', of: 'invite' });
    expect(reduce(invite, { type: 'back' }).open).toEqual({ kind: 'many', key: 'invite' });

    const sending = startOf('sentReached', false);
    expect(sending.draft?.step).toBe('sending');
    expect(reduce(sending, { type: 'back' }).open).toEqual({ kind: 'draft' });
  });
});

describe('a sender Soirely could not match', () => {
  it('is not matched, with the picker, until a guest is chosen', () => {
    expect(startOf('notMatched', false).open).toEqual({ kind: 'guest', key: 'unknown' });
    expect(startOf('matchPicker', false).matching).toBe(true);

    const matched = reduce(startOf('matchPicker', false), {
      type: 'match',
      name: 'Camille Dubois',
    });
    expect(matched).toMatchObject({ matched: 'Camille Dubois', matching: false });
    expect(badgeOf(matched)).toEqual({ waiting: 4, notMatched: 0, total: 4 });
    expect(startOf('matched', false).matched).toBe('Camille Dubois');
  });
});

describe('a scheduled message', () => {
  it('is in Scheduled, and its Edit saves and keeps its time', () => {
    const shown = startOf('scheduled', false);
    expect(shown.draft).toMatchObject({
      step: 'scheduled',
      at: { date: '2026-11-05', time: '09:00' },
    });

    const editing = reduce(shown, { type: 'editScheduled' });
    expect(editing.draft).toMatchObject({
      step: 'write',
      was: { subject: 'On the day: where to find us' },
    });
    expect(startOf('scheduledEdit', false).draft?.was).not.toBeNull();

    const saved = run(editing, { type: 'body', text: 'New words' }, { type: 'saveScheduled' });
    expect(saved.draft).toMatchObject({ step: 'scheduled', was: null, body: 'New words' });
    expect(sectionsOf(saved).scheduled.map(nameOf)).toEqual(['sched']);
  });

  it('sends now through the check and the ten seconds, or keeps its time', () => {
    const now = reduce(startOf('scheduled', false), { type: 'sendNow' });
    expect(now.draft?.step).toBe('check');
    expect(startOf('sendNow', false).draft?.step).toBe('check');
    expect(reduce(now, { type: 'keepScheduled' }).draft?.step).toBe('scheduled');

    const going = reduce(now, { type: 'confirm' });
    expect(going.draft).toMatchObject({ step: 'countdown', at: null });
    expect(sectionsOf(going).top.map(nameOf)).toEqual(['sched']);
  });

  it('asks before Cancel…, and once cancelled sits in Done', () => {
    const asking = startOf('cancelAsk', false);
    expect(asking.draft?.asking).toBe(true);
    expect(reduce(asking, { type: 'askCancel', open: false }).draft?.asking).toBe(false);

    const cancelled = reduce(asking, { type: 'cancelScheduled' });
    expect(cancelled.draft).toMatchObject({ step: 'cancelled', cancelledAt: '09:46' });
    expect(sectionsOf(cancelled).done.map(nameOf)[0]).toBe('sched');
    expect(draftLine(cancelled.draft ?? blankDraft())).toBe('Cancelled by Folake Adeyemi at 09:46');
    expect(startOf('scheduledCancelled', false).draft?.step).toBe('cancelled');
  });

  it('is made by Later… with a time 5 minutes ahead and before the end', () => {
    const later = startOf('later', false);
    expect(later.when).toBe(true);
    expect(laterRefused({ date: '2026-11-03', time: '09:43' })).toBe(true);
    expect(laterRefused({ date: '2026-11-07', time: '15:00' })).toBe(true);
    expect(laterRefused({ date: '2026-11-05', time: '09:00' })).toBe(false);

    const scheduled = reduce(later, {
      type: 'schedule',
      at: { date: '2026-11-05', time: '09:00' },
    });
    expect(scheduled).toMatchObject({ when: false, draft: { step: 'scheduled' } });
    expect(sectionsOf(scheduled).scheduled.map(nameOf)).toContain('new-1');
  });
});

describe('the check, three more ways', () => {
  it('counts All guests and Hasn’t replied as the boards do', () => {
    const all = checkOf(startOf('checkAll', false).draft ?? blankDraft());
    expect(all).toMatchObject({
      count: 142,
      cantTell: 9,
      credits: 39,
      after: '1,461',
      seeAll: true,
    });
    expect(all.told).toEqual([
      { key: 'email', count: 124 },
      { key: 'sms', count: 39 },
    ]);

    const notReplied = checkOf(startOf('checkNotReplied', false).draft ?? blankDraft());
    expect(notReplied).toMatchObject({ count: 25, cantTell: 1, credits: 9, after: '1,491' });
    expect(notReplied.names).toEqual(['Mei Lin Chen · No email address · No phone number']);
  });

  it('follows SMS unticked in the card at once', () => {
    const off = checkOf(startOf('checkChannels', false).draft ?? blankDraft());
    expect(off).toMatchObject({ cantTell: 4, smsOff: 2, credits: 0, seeAll: true });
    expect(off.told).toEqual([{ key: 'email', count: 92 }]);
  });
});

describe('pm’s three calls, as states', () => {
  it('names a message with no Subject by its first line', () => {
    const m = startOf('noSubject', false);
    expect(draftTitle(m.draft ?? blankDraft(), m.thread)).toBe(
      'Greeting, a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.',
    );
  });

  it('keeps the first message above its follow-up', () => {
    const m = startOf('followUp', false);
    expect(m.thread?.earlier).toHaveLength(1);
    expect(m.draft).toMatchObject({ step: 'sending', soFar: 20, time: '10:05' });
    expect(draftLine(m.draft ?? blankDraft(), m.thread)).toBe(
      'Follow-up · Reached 20 of 96 so far',
    );
  });

  it('offers Tell guests for a new place, with the address line', () => {
    expect(startOf('tellPlace', false)).toMatchObject({
      telling: true,
      change: {
        lines: ['The venue is now Rosewood London (was The Landmark).'],
        what: ['New venue'],
        address: true,
      },
    });
  });
});

describe('Tell guests after a change', () => {
  const wedding = sampleEvent('evt-wed-4');
  if (wedding == null) throw new Error('The sample has the wedding.');

  it('offers the start time when it moves', () => {
    expect(tellChange(wedding, { ...wedding, startsAt: '2026-11-05T17:30:00Z' }, 'en-US')).toEqual({
      lines: ['The start time is now 17:30 (was 18:00).'],
      what: ['New start time'],
      address: false,
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

describe('the sample’s days and channels', () => {
  it('follow the reader’s locale', () => {
    expect(dayWords('2026-11-02', 'en-US')).toBe('Mon, Nov 2');
    expect(dayWords('2026-11-02', 'en-GB')).toBe('Mon 2 Nov');
    expect(channelsWords(['email', 'sms'], 'en-US')).toBe('Email and SMS');
    expect(channelsWords(['email', 'sms', 'wa'], 'en-US')).toBe('Email, SMS, and WhatsApp');
  });

  it('give a row the time today, the weekday this week, else the month and day', () => {
    expect(rowDay('2026-11-03', '08:12', 'en-US')).toBe('08:12');
    expect(rowDay('2026-11-02', '', 'en-US')).toBe('Mon');
    expect(rowDay('2026-10-31', '', 'en-US')).toBe('Sat');
    expect(rowDay('2026-10-12', '', 'en-US')).toBe('Oct 12');
  });

  it('say a reply that has just arrived in the locale’s own word', () => {
    expect(justNow('en-US')).toBe('now');
    expect(justNow('pt-PT')).toBe('agora');
  });
});

describe('the notice’s cost, before Send (pm on bm’s #31518)', () => {
  it('says what an SMS or WhatsApp notice costs and the credits after it, and nothing for email', () => {
    expect(noticeCost('wa', 4, 1500)).toEqual({
      channel: 'wa',
      credits: 4,
      after: 1496,
      waits: false,
    });
    expect(noticeCost('sms', 9, 1500)).toMatchObject({ after: 1491, waits: false });
    expect(noticeCost('email', 0, 1500)).toBeNull();
    expect(noticeCost('wa', 4, 2)).toMatchObject({ waits: true });
    expect(noticeCost('wa', 4, 4)).toMatchObject({ waits: false, after: 0 });
  });

  it('shows Lucía’s WhatsApp notice at Spain’s 4 utility credits, and Kwame’s text at the UK’s 9', () => {
    expect(noticeCostOf(startOf('noticeCost', false), 'lucia')).toMatchObject({
      channel: 'wa',
      credits: 4,
      after: 1496,
    });
    expect(noticeCostOf(startOf('channelReply', false), 'kwame')).toMatchObject({
      channel: 'sms',
      credits: 9,
    });
    expect(noticeCostOf(startOf('conversation', false), 'ines')).toBeNull();
  });

  it('waits with too few credits, offering email but not a text the credits can’t cover either', () => {
    const m = startOf('noticeWaits', false);
    expect(m.open).toEqual({ kind: 'guest', key: 'lucia' });
    expect(noticeCostOf(m, 'lucia')?.waits).toBe(true);
    expect(tellNowBy(m, 'lucia')).toEqual(['email']);
    expect(tellNowBy(startOf('noticeCost', false), 'lucia')).toEqual(['email', 'sms']);
  });

  it('switches the notice to email when asked, with no cost, and the answer goes on the page at once', () => {
    let m = reduce(startOf('noticeWaits', false), {
      type: 'tellBy',
      key: 'lucia',
      channel: 'email',
    });
    expect(tellingBy(m, 'lucia')).toBe('email');
    expect(noticeCostOf(m, 'lucia')).toBeNull();
    m = reduce(m, { type: 'answer', key: 'lucia', text: 'Yes.' });
    expect(m.answers.lucia).toMatchObject({ by: 'email', notice: 'told' });
    expect(m.balance).toBe(2);
  });

  it('holds a WhatsApp notice the credits can’t cover, and takes them when they can', () => {
    const held = reduce(startOf('noticeWaits', false), {
      type: 'answer',
      key: 'lucia',
      text: 'Yes.',
    });
    expect(held.answers.lucia).toMatchObject({ by: 'wa', notice: 'held', seen: null });
    expect(held.balance).toBe(2);
    const told = reduce(startOf('noticeCost', false), {
      type: 'answer',
      key: 'lucia',
      text: 'Yes.',
    });
    expect(told.answers.lucia).toMatchObject({ by: 'wa', notice: 'told' });
    expect(told.balance).toBe(1496);
  });

  it('opens the notice held 48 hours on Lucía, with her new question waiting', () => {
    const m = startOf('noticeNotSent', false);
    expect(m).toMatchObject({
      heldTooLong: true,
      balance: 2,
      open: { kind: 'guest', key: 'lucia' },
    });
    expect(m.done).not.toContain('lucia');
  });
});
