import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sampleEvent } from './events.ts';
import {
  type Audience,
  COMING,
  EMPTY_LINE,
  MESSAGE_STATES,
  MESSAGES_PAGES,
  MW,
  NEW_MESSAGE,
  NOT_REPLIED,
  PARKING_UNREACHED,
  heldPeople,
  holdAfter,
  rowOf,
  whatsAppLine,
  whatsAppOf,
  ROSEWOOD,
  TICKS,
  changed,
  checkOf,
  chipWords,
  countOf,
  draftOf,
  fill,
  freshId,
  many,
  messagesStateOf,
  noticeOf,
  outTitle,
  phoneProblem,
  reachFrom,
  reachLine,
  refusalOf,
  resendOf,
  rowsInOrder,
  showItems,
  showAfter,
  shownOf,
  whoOf,
  sectionsOf,
  seedOf,
  toldOf,
  waitingLine,
} from './messages.ts';
import { BOOK, GROUPS } from './messagesTo.ts';

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe('Messaging B · Conversations, the rules (sc-31371)', () => {
  it('has the spec’s 42 states, the notice’s 3, Who it reached’s 8, sc-3942’s 2, sc-3960’s 10, sc-3963’s 4 and sc-3950’s 5, in order, each linked once from the demo home', () => {
    const keys = MESSAGE_STATES.map((one) => one.key);

    expect(keys).toHaveLength(99);
    expect(keys.slice(-5)).toEqual([
      'whatsAppLine',
      'checkWhatsApp',
      'held',
      'whatsAppRead',
      'whatsAppTooLate',
    ]);
    expect(keys.slice(0, 3)).toEqual(['first', 'loading', 'inUse']);
    expect(keys.slice(6, 10)).toEqual([
      'channelReply',
      'noticeCost',
      'noticeWaits',
      'noticeNotSent',
    ]);
    expect(keys.slice(26, 29)).toEqual(['bell', 'invitedReached', 'sentReached']);
    expect(keys.slice(52, 55)).toEqual(['tellPlace', 'closedDraft', 'closedEnded']);
    expect(keys.slice(keys.indexOf('insert'), keys.indexOf('insert') + 14)).toEqual([
      'insert',
      'previewAs',
      'previewGreetAs',
      'previewChose',
      'previewLoading',
      'previewMarkup',
      'typedBraces',
      'previewBraces',
      'noTokens',
      'previewNobody',
      'editConflict',
      'editSent',
      'editCancelled',
      'editTooLate',
    ]);
    expect(new Set(keys).size).toBe(99);
    expect(MESSAGES_PAGES.flatMap((page) => page.states.map((one) => one.to))).toEqual(
      keys.map((key) => `/demo/events/evt-wed-4/messages?state=${key}`),
    );
    expect(messagesStateOf('countdown')).toBe('countdown');
    expect(messagesStateOf('nope')).toBeNull();
    for (const key of keys) expect(seedOf(key), key).toBeDefined();
  });

  it('keeps the board’s English in the demo, every plural with its one and its other', () => {
    for (const [key, words] of Object.entries(MW)) {
      expect(words.trim(), key).not.toBe('');
      if (key.endsWith('_one')) expect(MW, key).toHaveProperty(key.replace(/_one$/u, '_other'));
      if (key.endsWith('_other')) expect(MW, key).toHaveProperty(key.replace(/_other$/u, '_one'));
    }
  });

  it('sorts the list into Needs you, Scheduled and Done', () => {
    const sections = sectionsOf(seedOf('inUse'), GROUPS);

    expect(ids(sections.needs)).toEqual(['ines', 'lucia', 'kwame', 'unknown', 'parking']);
    expect(ids(sections.scheduled)).toEqual(['sched']);
    expect(ids(sections.done)).toEqual(['marta', 'invite']);
    expect(sections.needs[3]).toMatchObject({
      title: 'm.dubois@orange.fr',
      tag: { word: 'Not matched' },
    });
    expect(sections.needs[4]?.line).toBe('To all guests · 11 people didn’t get it');
    expect(sections.done[0]?.line).toBe(
      'On their page · Thank you, see you Thursday! · Done by Folake Adeyemi',
    );
    expect(sectionsOf(seedOf('first'), GROUPS).needs).toEqual([]);
  });

  it('counts sc-3976’s waiting and not matched for the sidebar, and a match makes a guest wait', () => {
    expect(waitingLine(seedOf('inUse'))).toEqual({
      line: '3 waiting · 1 not matched',
      name: 'Messages, 3 waiting, 1 not matched',
    });
    expect(waitingLine(seedOf('answered'))?.line).toBe('2 waiting · 1 not matched');
    expect(waitingLine(seedOf('matched'))?.line).toBe('4 waiting');
    expect(sectionsOf(seedOf('matched'), GROUPS).needs[3]).toMatchObject({
      title: 'Camille Dubois',
      tag: null,
    });
    expect(waitingLine(seedOf('first'))).toBeNull();
  });

  it('says who gets it, with Guests who… counted and refused when it matches nobody', () => {
    const none: Audience = { kind: 'who', conditions: [] };
    const both: Audience = { kind: 'who', conditions: ['coming', 'notReplied'] };

    expect(chipWords({ kind: 'all' }, BOOK)).toBe('All guests · 142');
    expect(chipWords(COMING, BOOK)).toBe('Coming · 96');
    expect(chipWords(NOT_REPLIED, BOOK)).toBe('Hasn’t replied · 25');
    expect(countOf(none, GROUPS)).toBeNull();
    expect(countOf(both, GROUPS)).toBe(0);
    expect(refusalOf(none, GROUPS)).toBe(MW.noCondition);
    expect(refusalOf(both, GROUPS)).toBe(MW.nobodyLine);
    expect(refusalOf(COMING, GROUPS)).toBeNull();
  });

  it('checks before it goes: who is told and how, who cannot be, and the credits (Web-1, Web-4)', () => {
    const coming = checkOf(COMING, TICKS, GROUPS);
    const all = checkOf({ kind: 'all' }, TICKS, GROUPS);
    const notReplied = checkOf(NOT_REPLIED, TICKS, GROUPS);
    const smsOff = checkOf(COMING, { email: true, sms: false, whatsApp: false }, GROUPS);

    expect(many('cannotUndo', coming.count)).toBe('Sending to 96 people cannot be undone.');
    expect(coming.pills.map((pill) => pill.count)).toEqual([92, 31]);
    expect(coming.told).toBe('Soirely tells them it is there by email and text.');
    expect(coming.cant.map((one) => one.name)).toEqual(['Tomás Ferreira', 'Joaquín Ruiz']);
    expect(coming.credits).toBe('Texts use 31 credits. Credits after sending: 1,469.');
    expect([all.count, all.cantTell, ...all.pills.map((pill) => pill.count)]).toEqual([
      142, 9, 124, 39,
    ]);
    expect(all.cant.map((one) => one.name)).toEqual(['Tomás Ferreira', 'Sophie Laurent']);
    expect(all.credits).toBe('Texts use 39 credits. Credits after sending: 1,461.');
    expect([notReplied.count, notReplied.cantTell]).toEqual([25, 1]);
    expect(notReplied.cant.map((one) => one.name)).toEqual(['Mei Lin Chen']);
    expect(notReplied.credits).toBe('Texts use 9 credits. Credits after sending: 1,491.');
    expect(smsOff.pills).toEqual([{ channel: 'email', count: 92 }]);
    expect(smsOff.smsOff).toBe('SMS is off, so 2 more can’t be told.');
    expect(smsOff.cantTell).toBe(4);
    expect(smsOff.cant.map((one) => one.why.join(' · '))).toEqual([
      'No email address · SMS is off',
      'No email address · SMS is off',
    ]);
    expect(smsOff.credits).toBe('Email uses no credits.');
    expect(checkOf(COMING, { ...TICKS, whatsApp: true }, GROUPS).credits).toBe(
      'Texts and WhatsApp messages use 42 credits. Credits after sending: 1,458.',
    );
  });

  it('counts who it reached per person, grouped as sc-3966 counts them', () => {
    const reach = reachFrom(142, 87, PARKING_UNREACHED);

    expect(PARKING_UNREACHED.map((one) => one.name)).toEqual([
      'Tomás Ferreira',
      'Yuki Tanaka',
      'Oluwaseun Adebayo',
      'Amaka Eze',
      'Priyanka Nair',
      'Sophie Laurent',
      'Lars Johansson',
      'Fatima Zahra El Idrissi',
      'Diego Herrera',
      'Joaquín Ruiz',
      'Mei Lin Chen',
    ]);
    expect(reach.reached).toBe(131);
    expect(reachLine(reach)).toBe(
      'Seen by 87 on their page · 3 bounced · 2 not confirmed · 4 opted out · 2 no email or phone',
    );
  });

  it('fills the Greeting for the guest the preview shows', () => {
    expect(fill(NEW_MESSAGE.body, 'Kwame Mensah')).toBe(
      'Kwame Mensah, a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.',
    );
  });

  it('counts ten seconds down to Sending…, and Cancel puts the words back', () => {
    const writing = changed(seedOf('inUse'), { kind: 'compose', draft: draftOf(COMING) });
    const going = changed(writing, { kind: 'go' });

    expect(going.outs[0]).toMatchObject({ stage: 'countdown', left: 10 });
    expect(going.pane).toEqual({ kind: 'convo', id: 'new' });
    expect(rowsInOrder(sectionsOf(going, GROUPS))[0]?.line).toBe('Sending in 10…');

    let ticked = going;

    for (let second = 0; second < 9; second += 1) ticked = changed(ticked, { kind: 'tick' });
    expect(ticked.outs[0]?.left).toBe(1);

    const back = changed(ticked, { kind: 'cancel' });

    expect(back.outs).toEqual([]);
    expect(back.cancelled).toBe(true);
    expect(back.draft?.subject).toBe(NEW_MESSAGE.subject);
    expect(back.draft?.body).toEqual(NEW_MESSAGE.body);
    expect(changed(ticked, { kind: 'tick' }).outs[0]?.stage).toBe('sending');
  });

  it('names a message with no Subject by its first line, shortened, and keeps a follow-up after the sent one', () => {
    expect(outTitle({ subject: '', body: NEW_MESSAGE.body })).toBe(
      'Greeting, a few things before Thursday…',
    );
    expect(
      outTitle({ subject: ' ', body: [{ kind: 'text', text: 'Bring a coat.\nIt is cold.' }] }),
    ).toBe('Bring a coat.');
    expect(rowsInOrder(sectionsOf(seedOf('followUp'), GROUPS))[0]).toMatchObject({
      title: 'Parking and the dress code',
      line: 'Follow-up · Reached 20 of 96 so far',
      when: '10:05',
    });

    const sent = changed(seedOf('sent'), {
      kind: 'compose',
      draft: {
        ...draftOf(COMING, 'write', false, 'new'),
        body: [{ kind: 'text', text: 'One more thing.' }],
      },
    });
    const both = changed(sent, { kind: 'go' });

    expect(both.outs.map((out) => [out.thread, out.stage])).toEqual([
      ['new', 'sent'],
      ['new', 'countdown'],
    ]);
    expect(freshId(both)).toBe('new2');
  });

  it('schedules, edits, sends now and cancels a message for later', () => {
    const later = changed(seedOf('check'), { kind: 'schedule', day: '2026-11-05', time: '09:00' });

    expect(ids(sectionsOf(later, GROUPS).scheduled)).toEqual(['sched', 'sched2']);
    expect(sectionsOf(later, GROUPS).scheduled[1]?.line).toBe(
      'To Guests who… Is coming · Thu, Nov 5, 09:00',
    );

    const now = changed(seedOf('sendNow'), { kind: 'sendNow', id: 'sched' });

    expect(sectionsOf(now, GROUPS).scheduled).toEqual([]);
    expect(rowsInOrder(sectionsOf(now, GROUPS))[0]).toMatchObject({
      id: 'sched',
      line: 'Sending in 10…',
    });
    expect(sectionsOf(seedOf('scheduledCancelled'), GROUPS).done[0]).toMatchObject({
      id: 'sched',
      line: 'Cancelled by Folake Adeyemi at 09:46',
      tag: { kind: 'ended', word: 'Cancelled' },
    });
  });

  it('tells guests what a save changed: the start’s day or time, and the venue', () => {
    const wedding = sampleEvent('evt-wed-4');

    if (wedding == null) throw new Error('no sample wedding');

    expect(toldOf(wedding, { ...wedding, startsAt: '2026-11-05T17:30:00Z' })).toEqual([
      { item: 'New start time', line: 'The start time is now 17:30 (was 18:00).' },
    ]);
    expect(toldOf(wedding, { ...wedding, startsAt: '2026-11-06T18:00:00Z' })[0]?.line).toBe(
      'The date is now Fri, Nov 6 (was Thu, Nov 5).',
    );
    expect(toldOf(wedding, { ...wedding, venue: ROSEWOOD })).toEqual([
      {
        item: 'New venue',
        line: 'The venue is now Rosewood London (was The Landmark).',
        venue: true,
      },
    ]);
    expect(toldOf(wedding, wedding)).toEqual([]);
  });

  it('moves a conversation to Done and back, and a reply that arrives to the top', () => {
    const done = changed(seedOf('inUse'), { kind: 'done', id: 'kwame', at: '09:41' });

    expect(ids(sectionsOf(done, GROUPS).done)).toEqual(['kwame', 'marta', 'invite']);
    expect(
      ids(sectionsOf(changed(done, { kind: 'waiting', id: 'kwame' }), GROUPS).needs),
    ).toContain('kwame');

    const arrived = changed(seedOf('replyArrived'), { kind: 'arrive', id: 'lucia' });

    expect(ids(sectionsOf(seedOf('replyArrived'), GROUPS).needs)).not.toContain('lucia');
    expect(sectionsOf(arrived, GROUPS).needs[0]).toMatchObject({
      id: 'lucia',
      when: 'now',
      arrived: true,
    });
  });

  it('counts a guest marked as told in person as reached', () => {
    const told = changed(seedOf('reached'), { kind: 'toldInPerson', id: 'amaka' });

    expect(told.unreached).toHaveLength(10);
    expect(reachFrom(142, 87, told.unreached).reached).toBe(132);
    expect(sectionsOf(told, GROUPS).needs.at(-1)?.tag?.word).toBe('Not reached · 10');
  });
});

describe('The notice’s cost before Send (sc-3976, pm on bm’s #31518)', () => {
  it('shows no cost for an email notice', () => {
    expect(noticeOf('ines', 'email', 1500, [])).toEqual({
      credits: 0,
      cost: null,
      waits: null,
      others: [],
    });
  });

  it('says what a WhatsApp or SMS notice costs and the credits after it', () => {
    expect(noticeOf('lucia', 'whatsApp', 1500, ['email']).cost).toBe(
      'This WhatsApp message uses 4 credits. Credits after sending: 1,496.',
    );
    expect(noticeOf('kwame', 'sms', 1500, ['email']).cost).toBe(
      'This text uses 9 credits. Credits after sending: 1,491.',
    );
    expect(noticeOf('lucia', 'whatsApp', 4, ['email'])).toMatchObject({ waits: null });
  });

  it('says it will wait when the credits won’t cover it, and offers the channels that can tell them now', () => {
    expect(noticeOf('lucia', 'whatsApp', 2, ['email'])).toEqual({
      credits: 4,
      cost: null,
      waits: '1 WhatsApp message will wait for credits.',
      others: ['email'],
    });
    expect(noticeOf('kwame', 'sms', 0, ['email']).waits).toBe(
      '1 SMS message will wait for credits.',
    );
    expect(noticeOf('lucia', 'whatsApp', 2, []).others).toEqual([]);
    expect(noticeOf('lucia', 'whatsApp', 2, ['email', 'sms']).others).toEqual(['email']);
  });

  it('takes the credits on Send, and holds the notice when they won’t cover it', () => {
    const paid = changed(seedOf('noticeCost'), { kind: 'answer', id: 'lucia', text: 'Yes.' });

    expect(paid.balance).toBe(1496);
    expect(paid.answers.lucia?.at(-1)).toMatchObject({ text: 'Yes.', stage: 'sending' });
    expect(paid.answers.lucia?.at(-1)?.notice).toBeUndefined();

    const held = changed(seedOf('noticeWaits'), { kind: 'answer', id: 'lucia', text: 'Yes.' });

    expect(held.balance).toBe(2);
    expect(held.answers.lucia?.at(-1)).toMatchObject({ notice: 'held' });

    const byEmail = changed(seedOf('noticeWaits'), {
      kind: 'answer',
      id: 'lucia',
      text: 'Yes.',
      by: 'email',
    });

    expect(byEmail.balance).toBe(2);
    expect(byEmail.answers.lucia?.at(-1)).toMatchObject({ by: 'email' });
    expect(byEmail.answers.lucia?.at(-1)?.notice).toBeUndefined();
  });

  it('keeps the guest waiting on today’s question when an earlier notice could not go', () => {
    const inbox = seedOf('noticeNotSent');

    expect(inbox.heldTooLong).toBe(true);
    expect(inbox.done).not.toContain('lucia');
    expect(inbox.answers.lucia).toBeUndefined();
    expect(inbox.balance).toBe(2);
  });
});

describe('Who it reached, its fixes, the filter and a resend (sc-3966)', () => {
  const reached = seedOf('reached');
  const joaquin = (inbox: typeof reached) =>
    whoOf(inbox, 'parking', 'parking', GROUPS).groups.flatMap((group) =>
      group.people.filter((one) => one.id === 'joaquin'),
    )[0];

  it('takes a phone number only with + and at least seven digits', () => {
    expect(phoneProblem('+46 70 123 45 67')).toBeNull();
    expect(phoneProblem('070 123 45 67')).toBe(
      'That does not look like a phone number. Start with + and the country code.',
    );
    expect(phoneProblem('+46 70')).toBe(MW.phoneShape);
  });

  it('keeps a saved address’s lines, says it has not been sent, and offers to send it', () => {
    const added = changed(reached, {
      kind: 'fixed',
      id: 'joaquin',
      thread: 'parking',
      fix: 'addEmail',
      address: 'joaquin.ruiz@gmail.com',
    });

    expect(joaquin(added)).toMatchObject({
      kind: 'none',
      fixes: [],
      offer: true,
      updated: ['An email address has been added since. Nothing has been sent to it yet.'],
    });
    expect(joaquin(added)?.lines[0]?.word).toBe('No email address');
    expect(
      whoOf(seedOf('addedPhone'), 'parking', 'parking', GROUPS)
        .groups.flatMap((group) => group.people)
        .find((one) => one.id === 'lars')?.updated,
    ).toEqual(['A phone number has been added since. Nothing has been sent to it yet.']);
  });

  it('after Not now keeps the line, gives back the other fixes, and counts them in a resend', () => {
    const later = changed(seedOf('added'), { kind: 'notNow', id: 'joaquin', thread: 'parking' });

    expect(joaquin(later)).toMatchObject({ offer: false, fixes: ['addPhone', 'toldInPerson'] });
    expect(joaquin(later)?.updated).toHaveLength(1);
    expect(resendOf(reached, 'parking', TICKS, GROUPS)).toEqual({
      waiting: 11,
      count: 3,
      unconfirmed: 2,
      still: 8,
      cant: [
        'Joaquín Ruiz · No email address · No phone number',
        'Sophie Laurent · Unsubscribed · Texted STOP',
      ],
      credits: 2,
    });
    expect(resendOf(later, 'parking', TICKS, GROUPS)).toMatchObject({ count: 4, still: 7 });
  });

  it('sends a saved address again: its channel’s line Sent, and the person In progress', () => {
    const sent = changed(seedOf('added'), { kind: 'sendAgain', id: 'joaquin', thread: 'parking' });

    expect(joaquin(sent)).toMatchObject({ kind: 'inProgress', fixes: ['toldInPerson'] });
    expect(joaquin(sent)?.lines[0]).toEqual({
      mark: 'sent',
      word: 'Email · Sent · 09:44',
      why: 'joaquin.ruiz@gmail.com',
    });
    expect(joaquin(sent)?.updated).toBeUndefined();
    expect(resendOf(sent, 'parking', TICKS, GROUPS).waiting).toBe(10);
  });

  it('marks a guest as told in person, reached and in Marked as told, and Undo puts them back', () => {
    const told = seedOf('told');
    const who = whoOf(told, 'parking', 'parking', GROUPS);

    expect(who.reach.reached).toBe(132);
    expect(shownOf(who, 'told').groups[0]?.people.map((one) => one.lines.at(-1))).toEqual([
      {
        mark: 'delivered',
        word: 'Told in person',
        why: 'Marked by Folake Adeyemi at 09:44',
      },
    ]);
    expect(resendOf(told, 'parking', TICKS, GROUPS)).toMatchObject({ count: 2, unconfirmed: 1 });

    const undone = changed(told, { kind: 'undoTold', id: 'amaka', thread: 'parking' });

    expect(undone.unreached.map((one) => one.id)).toEqual(reached.unreached.map((one) => one.id));
    expect(whoOf(undone, 'parking', 'parking', GROUPS).reach.reached).toBe(131);
  });

  it('filters by group, each choice counted', () => {
    const who = whoOf(reached, 'parking', 'parking', GROUPS);

    expect(showItems(who).map((item) => `${item.word} · ${item.count}`)).toEqual([
      'Everyone · 142',
      'Not reached · 11',
      'Bounced · 3',
      'Not confirmed · 2',
      'Opted out · 4',
      'No email or phone · 2',
      'Reached · 131',
      'Marked as told · 0',
    ]);
    expect(shownOf(who, 'bounced')).toMatchObject({ heading: 'Bounced · 3' });
    expect(shownOf(who, 'bounced').groups.map((group) => group.key)).toEqual(['bounced']);
    expect(shownOf(who, 'reached').groups[0]).toMatchObject({ count: 131, more: 129 });
    expect(shownOf(who, 'notReached').heading).toBe('Not reached · 11');
    expect(
      showItems(whoOf(seedOf('sentReached'), 'new', 'new', GROUPS)).map(
        (item) => `${item.word} · ${item.count}`,
      ),
    ).toEqual([
      'Everyone · 96',
      'Not reached · 58',
      'In progress · 56',
      'Can’t be told · 2',
      'Reached · 38',
      'Marked as told · 0',
    ]);
  });

  it('checks a resend of an invitation or a message just sent with nobody to tell yet', () => {
    expect(resendOf(seedOf('resendInvited'), 'invite', TICKS, GROUPS)).toEqual({
      waiting: 2,
      count: 0,
      unconfirmed: 0,
      still: 2,
      cant: [
        'Joaquín Ruiz · No email address · No phone number',
        'Mei Lin Chen · No email address · No phone number',
      ],
      credits: 0,
    });
    expect(resendOf(seedOf('resendSent'), 'new', TICKS, GROUPS)).toMatchObject({
      waiting: 2,
      count: 0,
      cant: [
        'Tomás Ferreira · Address is bouncing · No phone number',
        'Joaquín Ruiz · No email address · No phone number',
      ],
    });
    expect(
      resendOf(
        changed(seedOf('resendSent'), { kind: 'toldInPerson', id: 'joaquin', thread: 'new' }),
        'new',
        TICKS,
        GROUPS,
      ).waiting,
    ).toBe(1);
  });

  it('counts a person in a resend once a new address is saved, Send again or Not now or neither', () => {
    for (const state of ['fixed', 'notNow', 'added', 'addedPhone'] as const)
      expect(resendOf(seedOf(state), 'parking', TICKS, GROUPS)).toMatchObject({
        waiting: 11,
        count: 4,
        still: 7,
      });
  });

  it('keeps a saved address the guest’s on every message, sent again on one message only', () => {
    const saved = changed(seedOf('invitedReached'), {
      kind: 'fixed',
      id: 'joaquin',
      thread: 'parking',
      fix: 'addEmail',
      address: 'joaquin.ruiz@gmail.com',
    });
    const onInvite = (inbox: typeof saved) =>
      whoOf(inbox, 'invite', 'invite', GROUPS).groups.flatMap((group) =>
        group.people.filter((one) => one.id === 'joaquin'),
      )[0];

    expect(onInvite(saved)).toMatchObject({ offer: true, updated: [MW.emailAddedSince] });
    expect(resendOf(saved, 'invite', TICKS, GROUPS)).toMatchObject({ count: 1, still: 1 });

    const sent = changed(saved, { kind: 'sendAgain', id: 'joaquin', thread: 'parking' });

    expect(joaquin(sent)?.kind).toBe('inProgress');
    expect(onInvite(sent)).toMatchObject({ kind: 'none', offer: true });
  });

  it('offers Mark as told in person on every not-reached row, Bounced and In progress included', () => {
    const rows = [
      ...shownOf(whoOf(reached, 'parking', 'parking', GROUPS), 'notReached').groups,
      ...shownOf(whoOf(seedOf('sentReached'), 'new', 'new', GROUPS), 'notReached').groups,
    ].flatMap((group) => group.people);

    expect(rows.map((one) => one.name)).toContain('Yuki Tanaka');
    expect(rows.filter((one) => !one.fixes.includes('toldInPerson'))).toEqual([]);

    const kwame = changed(seedOf('sentReached'), {
      kind: 'toldInPerson',
      id: 'kwame',
      thread: 'new',
    });
    const who = whoOf(kwame, 'new', 'new', GROUPS);

    expect(who.reach.reached).toBe(39);
    expect(shownOf(who, 'inProgress').heading).toBe('In progress · 55');
    expect(shownOf(who, 'told').groups[0]?.people.map((one) => one.name)).toEqual(['Kwame Mensah']);
  });

  it('keeps the Filter until the group shown is left with nobody, then Not reached, then Everyone', () => {
    const tell = (inbox: typeof reached, ...ids: string[]) =>
      ids.reduce((now, id) => changed(now, { kind: 'toldInPerson', id, thread: 'parking' }), inbox);
    const after = (inbox: typeof reached, show: Parameters<typeof showAfter>[1]) =>
      showAfter(whoOf(inbox, 'parking', 'parking', GROUPS), show);

    expect(after(tell(reached, 'amaka'), 'notConfirmed')).toBe('notConfirmed');
    expect(after(tell(reached, 'amaka', 'priyanka'), 'notConfirmed')).toBe('notReached');
    expect(after(tell(reached, 'amaka', 'priyanka'), 'told')).toBe('told');

    const all = tell(reached, ...PARKING_UNREACHED.map((one) => one.id));

    expect(after(all, 'bounced')).toBe('everyone');
    expect(shownOf(whoOf(all, 'parking', 'parking', GROUPS), 'notReached')).toEqual({
      heading: 'Not reached · 0',
      groups: [],
      empty: 'Nobody is left to reach.',
    });
  });

  it('says in each always-offered choice’s own words that nobody is in it', () => {
    const who = whoOf(reached, 'parking', 'parking', GROUPS);

    expect(shownOf(who, 'told')).toMatchObject({
      heading: 'Marked as told · 0',
      empty: 'Nobody is marked as told yet.',
    });
    expect(shownOf(who, 'bounced').empty).toBeNull();
    expect(EMPTY_LINE).toEqual({
      notReached: 'Nobody is left to reach.',
      reached: 'Nobody has been reached yet.',
      told: 'Nobody is marked as told yet.',
    });
  });

  it('gives an invitation the Filter, with its Reached drawn', () => {
    const who = whoOf(seedOf('invitedReached'), 'invite', 'invite', GROUPS);

    expect(showItems(who).map((item) => `${item.word} · ${item.count}`)).toEqual([
      'Everyone · 142',
      'Not reached · 2',
      'No email or phone · 2',
      'Reached · 140',
      'Marked as told · 0',
    ]);
    expect(shownOf(who, 'reached').groups[0]).toMatchObject({ count: 140, more: 138 });
  });
});

describe('Scheduled for later’s time field', () => {
  const css = readFileSync(join(import.meta.dirname, 'messages.css'), 'utf8');
  const start = css.indexOf('\n.mg-when-field.is-time {');
  const rule = css.slice(start, css.indexOf('}', start));

  it('takes the width its locale’s format needs, so 06:00 PM shows whole', () => {
    expect(rule).toMatch(/\sflex: 0 0 auto;/u);
    expect(rule).toMatch(/\smin-width: 120px;/u);
    expect(rule).not.toMatch(/\swidth:/u);
  });
});

describe('Messaging B · WhatsApp only to guests who agreed (sc-3950)', () => {
  const ALL: Audience = { kind: 'all' };
  const ALL_TICKED = { email: true, sms: true, whatsApp: true };

  it('says who WhatsApp reaches, then who it can’t, each counted once, a 0 part left out', () => {
    expect(whatsAppLine(ALL)).toBe(
      'WhatsApp reaches 4 of 142 · 102 have no mobile number · 2 stopped WhatsApp · 34 haven’t agreed to WhatsApp',
    );
    expect(whatsAppLine(COMING)).toBe(
      'WhatsApp reaches 3 of 96 · 65 have no mobile number · 1 stopped WhatsApp · 27 haven’t agreed to WhatsApp',
    );
    expect(whatsAppLine(NOT_REPLIED)).toBe(
      'WhatsApp reaches 1 of 25 · 16 have no mobile number · 8 haven’t agreed to WhatsApp',
    );
    expect(many('noMobile', 1)).toBe('1 has no mobile number');
    expect(many('notAgreedWhatsApp', 1)).toBe('1 hasn’t agreed to WhatsApp');
    expect(many('stoppedCount', 2)).toBe('2 stopped WhatsApp');
  });

  it('sums WhatsApp’s credits by each number’s country, not one a message', () => {
    expect([ALL, COMING, NOT_REPLIED].map((to) => whatsAppOf(to).credits)).toEqual([13, 11, 2]);

    const check = checkOf(ALL, ALL_TICKED, GROUPS);

    expect(check.pills.map((pill) => pill.count)).toEqual([124, 39, 4]);
    expect(check.cantTell).toBe(9);
    expect(check.credits).toBe(
      'Texts and WhatsApp messages use 52 credits. Credits after sending: 1,448.',
    );
    expect(check.whatsApp).toBe(whatsAppLine(ALL));
    expect(checkOf(ALL, TICKS, GROUPS).whatsApp).toBeNull();
    expect(checkOf(NOT_REPLIED, { ...TICKS, sms: false, whatsApp: true }, GROUPS).credits).toBe(
      'Texts and WhatsApp messages use 2 credits. Credits after sending: 1,498.',
    );
  });

  it('moves only a held notice: sent once credits are back, or too late', () => {
    expect(holdAfter('held', 'topUp')).toBe('released');
    expect(holdAfter('held', 'tooLate')).toBe('tooLate');
    expect(holdAfter('released', 'tooLate')).toBe('released');
    expect(holdAfter('tooLate', 'topUp')).toBe('tooLate');
    expect(changed(seedOf('held'), { kind: 'hold', event: 'topUp' }).hold).toBe('released');
    expect(changed(seedOf(null), { kind: 'hold', event: 'topUp' }).hold).toBeUndefined();
  });

  it('reads each held row as the hold leaves it: held, its receipts, or too late', () => {
    const whatsApp = (hold: Parameters<typeof heldPeople>[0]) =>
      heldPeople(hold).map((one) => {
        const line = one.lines[1];

        return [line?.word, line?.why].filter((part) => part != null).join(' · ');
      });

    expect(heldPeople('held').map((one) => one.name)).toEqual([
      'Lucía Ortega',
      'Kwame Mensah',
      'Duboise Akande',
      'Rafael Costa',
    ]);
    expect(heldPeople('held').every((one) => one.lines[0]?.word === 'Email · Delivered')).toBe(
      true,
    );
    expect(whatsApp('held')).toEqual(Array(4).fill('WhatsApp · Held: waiting for credits'));
    expect(whatsApp('released')).toEqual([
      'WhatsApp · Read · 10:14',
      'WhatsApp · Read · 10:14',
      'WhatsApp · Delivered · 10:02',
      'WhatsApp · Failed',
    ]);
    expect(whatsApp('tooLate')).toEqual(Array(4).fill('WhatsApp · Not sent: too late'));
  });

  it('seeds the new message with WhatsApp ticked, and the held message in Parking’s place', () => {
    expect(seedOf('whatsAppLine').draft).toMatchObject({ step: 'write', ticks: ALL_TICKED });
    expect(seedOf('checkWhatsApp').draft).toMatchObject({ step: 'check', ticks: ALL_TICKED });

    const held = seedOf('held');

    expect(held).toMatchObject({ hold: 'held', balance: 0, pane: { kind: 'convo', id: 'held' } });
    expect(held.present).toContain('held');
    expect(held.present).not.toContain('parking');
    expect(rowOf(held, 'held', GROUPS)).toMatchObject({
      title: 'Parking at The Landmark',
      tag: { word: 'Held' },
    });
    expect(rowOf(seedOf('whatsAppTooLate'), 'held', GROUPS).tag?.word).toBe('Not reached · 18');
    expect(seedOf('whatsAppRead')).toMatchObject({
      hold: 'released',
      pane: { kind: 'reached', of: 'held' },
    });
    expect(seedOf('whatsAppTooLate').hold).toBe('tooLate');
  });

  it('groups the held four as WhatsApp · 4, never a filter, and gives WhatsApp’s reasons', () => {
    const who = whoOf(seedOf('held'), 'held', 'held', GROUPS);

    expect(who.groups.map((group) => `${group.name} · ${group.count}`)).toEqual([
      'WhatsApp · 4',
      'Can’t be told · 18',
      'Marked as told · 0',
      'Reached · 124',
    ]);
    expect(who.line).toBe('Seen by 87 on their page · 18 can’t be told');
    expect(showItems(who).map((item) => `${item.word} ${item.count}`)).toEqual([
      'Everyone 142',
      'Not reached 18',
      'Can’t be told 18',
      'Reached 124',
      'Marked as told 0',
    ]);
    expect(
      who.groups[1]?.people.map((one) =>
        one.lines
          .slice(0, -1)
          .map((line) => [line.word, line.why].filter((part) => part != null).join(' · ')),
      ),
    ).toEqual([
      ['Email · Not sent · Unsubscribed', 'WhatsApp · Not sent · Stopped WhatsApp'],
      ['Email · No email address', 'WhatsApp · Not sent · Hasn’t agreed to WhatsApp'],
    ]);
    expect(who.waiting).toEqual([]);
  });
});
