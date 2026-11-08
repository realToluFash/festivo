import { describe, expect, it } from 'vitest';

import { sampleEvent } from './events.ts';
import {
  type Audience,
  COMING,
  MESSAGE_STATES,
  MESSAGES_PAGES,
  MW,
  NEW_MESSAGE,
  NOT_REPLIED,
  PARKING_UNREACHED,
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
  reachFrom,
  reachLine,
  refusalOf,
  rowsInOrder,
  sectionsOf,
  seedOf,
  toldOf,
  waitingLine,
} from './messages.ts';

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe('Messaging B · Conversations, the rules (sc-31371)', () => {
  it('has the spec’s 42 states, the notice’s 3 and sc-3942’s 2, in order, each linked once from the demo home', () => {
    const keys = MESSAGE_STATES.map((one) => one.key);

    expect(keys).toHaveLength(47);
    expect(keys.slice(0, 3)).toEqual(['first', 'loading', 'inUse']);
    expect(keys.slice(6, 10)).toEqual([
      'channelReply',
      'noticeCost',
      'noticeWaits',
      'noticeNotSent',
    ]);
    expect(keys.slice(26, 29)).toEqual(['bell', 'invitedReached', 'sentReached']);
    expect(keys.slice(-3)).toEqual(['tellPlace', 'closedDraft', 'closedEnded']);
    expect(new Set(keys).size).toBe(47);
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
    const sections = sectionsOf(seedOf('inUse'));

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
    expect(sectionsOf(seedOf('first')).needs).toEqual([]);
  });

  it('counts sc-3976’s waiting and not matched for the sidebar, and a match makes a guest wait', () => {
    expect(waitingLine(seedOf('inUse'))).toEqual({
      line: '3 waiting · 1 not matched',
      name: 'Messages, 3 waiting, 1 not matched',
    });
    expect(waitingLine(seedOf('answered'))?.line).toBe('2 waiting · 1 not matched');
    expect(waitingLine(seedOf('matched'))?.line).toBe('4 waiting');
    expect(sectionsOf(seedOf('matched')).needs[3]).toMatchObject({
      title: 'Camille Dubois',
      tag: null,
    });
    expect(waitingLine(seedOf('first'))).toBeNull();
  });

  it('says who gets it, with Guests who… counted and refused when it matches nobody', () => {
    const none: Audience = { kind: 'who', conditions: [] };
    const both: Audience = { kind: 'who', conditions: ['coming', 'notReplied'] };

    expect(chipWords({ kind: 'all' })).toBe('All guests · 142');
    expect(chipWords(COMING)).toBe('Guests who… Is coming · 96');
    expect(chipWords(NOT_REPLIED)).toBe('Guests who… Hasn’t replied · 25');
    expect(countOf(none)).toBeNull();
    expect(countOf(both)).toBe(0);
    expect(refusalOf(none)).toBe(MW.noCondition);
    expect(refusalOf(both)).toBe(MW.nobodyLine);
    expect(refusalOf(COMING)).toBeNull();
  });

  it('checks before it goes: who is told and how, who cannot be, and the credits (Web-1, Web-4)', () => {
    const coming = checkOf(COMING, TICKS);
    const all = checkOf({ kind: 'all' }, TICKS);
    const notReplied = checkOf(NOT_REPLIED, TICKS);
    const smsOff = checkOf(COMING, { email: true, sms: false, whatsApp: false });

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
    expect(checkOf(COMING, { ...TICKS, whatsApp: true }).credits).toBe(
      'Texts and WhatsApp messages use 34 credits. Credits after sending: 1,466.',
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
    expect(rowsInOrder(sectionsOf(going))[0]?.line).toBe('Sending in 10…');

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
    expect(rowsInOrder(sectionsOf(seedOf('followUp')))[0]).toMatchObject({
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

    expect(ids(sectionsOf(later).scheduled)).toEqual(['sched', 'sched2']);
    expect(sectionsOf(later).scheduled[1]?.line).toBe(
      'To Guests who… Is coming · Thu, Nov 5, 09:00',
    );

    const now = changed(seedOf('sendNow'), { kind: 'sendNow', id: 'sched' });

    expect(sectionsOf(now).scheduled).toEqual([]);
    expect(rowsInOrder(sectionsOf(now))[0]).toMatchObject({ id: 'sched', line: 'Sending in 10…' });
    expect(sectionsOf(seedOf('scheduledCancelled')).done[0]).toMatchObject({
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

    expect(ids(sectionsOf(done).done)).toEqual(['kwame', 'marta', 'invite']);
    expect(ids(sectionsOf(changed(done, { kind: 'waiting', id: 'kwame' })).needs)).toContain(
      'kwame',
    );

    const arrived = changed(seedOf('replyArrived'), { kind: 'arrive', id: 'lucia' });

    expect(ids(sectionsOf(seedOf('replyArrived')).needs)).not.toContain('lucia');
    expect(sectionsOf(arrived).needs[0]).toMatchObject({ id: 'lucia', when: 'now', arrived: true });
  });

  it('counts a guest marked as told in person as reached', () => {
    const told = changed(seedOf('reached'), { kind: 'toldInPerson', id: 'amaka' });

    expect(told.unreached).toHaveLength(10);
    expect(reachFrom(142, 87, told.unreached).reached).toBe(132);
    expect(sectionsOf(told).needs.at(-1)?.tag?.word).toBe('Not reached · 10');
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
