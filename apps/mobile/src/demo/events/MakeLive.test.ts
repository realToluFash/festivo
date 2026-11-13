import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DRAFT_COUNTS, DRAFT_GUESTS } from '../guests/GuestsSample.ts';
import { NOTICE_CREDITS } from '../messages/MessagesSample.ts';
import { EVENT_STATES } from './EventsModel.ts';
import { type SampleEvent, sampleEvent } from './EventsSample.ts';
import { LIVE, W } from './EventsWords.ts';
import {
  INVITATION_HREF,
  type LiveAction,
  MAKE_LIVE_STATES,
  type MakeLive,
  OFFER_MOBILES,
  PART_CREDITS,
  countryOf,
  creditsOf,
  inviteTextOf,
  isGsm7,
  liveAlertOf,
  liveToastOf,
  makeLiveStart,
  priceOf,
  reachOf,
  reachedOf,
  reduceMakeLive,
  seededEvent,
  smsParts,
} from './MakeLive.ts';

const LATER = 'You can send the invitations later from Guests in Soirely on the web.';

function eventIn(state: (typeof MAKE_LIVE_STATES)[number], id = 'evt-draft-4'): SampleEvent {
  const event = sampleEvent(id);
  if (event == null) throw new Error(`The sample has ${id}.`);

  return seededEvent(event, state);
}

function alertIn(state: (typeof MAKE_LIVE_STATES)[number], id = 'evt-draft-4') {
  const event = eventIn(state, id);

  return liveAlertOf(makeLiveStart(state).turn, reachOf(state, event), event.name);
}

function run(
  state: (typeof MAKE_LIVE_STATES)[number],
  actions: readonly LiveAction[],
  id = 'evt-draft-4',
): MakeLive {
  const reach = reachOf(state, eventIn(state, id));

  return actions.reduce((s, action) => reduceMakeLive(s, action, reach), makeLiveStart(state));
}

const MAKE: readonly LiveAction[] = [{ type: 'confirm', hostError: null }, { type: 'made' }];

describe('Make live’s states (sc-3971)', () => {
  it('are the board’s twenty-two and sc-45251’s two, in its order, all on the event’s page', () => {
    expect(MAKE_LIVE_STATES).toEqual([
      'makeLive',
      'makeLiveMaking',
      'makeLiveNotMade',
      'makeLiveHost',
      'makeLiveHostBlank',
      'makeLiveChanged',
      'makeLiveCannotSend',
      'makeLiveOffer',
      'makeLiveOfferEmail',
      'makeLiveOfferOne',
      'makeLiveOfferWaits',
      'makeLiveOfferPart',
      'makeLiveOfferWhatsApp',
      'makeLiveOfferWhatsAppOnly',
      'makeLiveOfferSending',
      'makeLiveOfferSent',
      'makeLiveOfferNotYet',
      'makeLiveOfferNotSent',
      'makeLiveOfferNobody',
      'makeLiveOfferRefused',
      'makeLiveOfferForbidden',
      'makeLiveEndPassed',
      'makeLiveNoOffer',
      'madeLive',
    ]);
    expect(MAKE_LIVE_STATES).toHaveLength(24);
    for (const state of MAKE_LIVE_STATES) expect(EVENT_STATES).toContain(state);
  });

  it('are listed once each in the demo index, in the same order', () => {
    const index = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'app', 'demo', 'index.tsx'),
      'utf8',
    );
    const listed = [...index.matchAll(/\?state=(makeLive\w*|madeLive)'/gu)].map((one) => one[1]);
    expect(listed).toEqual([...MAKE_LIVE_STATES]);
  });

  it('seed the host where a state names one, and none in Host 1’s', () => {
    expect(eventIn('makeLive').hosts).toEqual(['Bisi Akindele']);
    expect(eventIn('makeLive').status).toBe('draft');
    expect(eventIn('makeLiveHost').hosts).toEqual([]);
    expect(eventIn('makeLiveOffer').status).toBe('live');
    expect(eventIn('makeLiveOfferEmail').status).toBe('live');
    expect(eventIn('makeLiveOfferRefused').status).toBe('live');
    expect(eventIn('makeLiveNoOffer', 'evt-cena-4').hosts).toEqual(['Fundación Lucía']);
    expect(eventIn('madeLive', 'evt-cena-4').status).toBe('live');
    expect(eventIn('makeLiveEndPassed', 'evt-shower-2').hosts).toEqual(['Kemi Adebayo']);
  });

  it('counts WhatsApp in place of the text: with texts at marketing, alone at utility (sc-45251)', () => {
    expect(creditsOf(reachOf('makeLiveOfferWhatsApp', eventIn('makeLiveOfferWhatsApp')))).toEqual({
      line: 'Texts and WhatsApp messages use 26 credits. Credits after sending: 224.',
      waiting: 0,
    });
    expect(
      creditsOf(reachOf('makeLiveOfferWhatsAppOnly', eventIn('makeLiveOfferWhatsAppOnly'))),
    ).toEqual({
      line: 'WhatsApp messages use 8 credits. Credits after sending: 242.',
      waiting: 0,
    });
  });
});

describe('the offer’s figures, from the sample', () => {
  const reach = reachOf('makeLiveOffer', eventIn('makeLiveOffer'));

  it('counts every guest Not yet invited, a companion left out, and reaches all but the one with neither address', () => {
    const companions = DRAFT_GUESTS.reduce((sum, one) => sum + one.companions.length, 0);
    const neither = DRAFT_GUESTS.filter((one) => one.email == null && one.phone == null);
    expect(reach.guests).toBe(DRAFT_COUNTS.notyet - companions);
    expect(reach.guests).toBe(11);
    expect(neither.map((one) => one.name)).toEqual(['Tomás Okonkwo-Silva']);
    expect(reach.unreachable).toBe(1);
    expect(reachedOf(reach)).toBe(10);
    expect(DRAFT_GUESTS.filter((one) => one.email != null)).toHaveLength(10);
    expect(OFFER_MOBILES.map((one) => one.name)).toEqual([
      'Tola Bakare',
      'Grace Mensah',
      'Ryan Cole',
    ]);
  });

  it('sends three texts of two parts each, the first to each number ending on STOP', () => {
    const texts = OFFER_MOBILES.map(({ name }) => inviteTextOf(eventIn('makeLiveOffer'), name));
    expect(texts[0]?.text).toBe(
      "Bisi Akindele: Tola Bakare, you're invited to Bisi & Kola's engagement on Saturday, Jan 9. Please reply at ",
    );
    expect(texts.map(({ parts }) => parts)).toEqual([2, 2, 2]);
    expect(reach.texts).toEqual([124, 18, 4]);
  });

  it('sends a greeting in curly quotes as GSM-7, its quotes plain', () => {
    const invite = inviteTextOf(eventIn('makeLiveOffer'), '“Auntie Bisi”');
    expect(invite.text).toContain('"Auntie Bisi", you\'re invited');
    expect(isGsm7(invite.text)).toBe(true);
    expect(invite.parts).toBe(2);
  });

  it('prices each text by its number’s country, from the rate table', () => {
    expect(countryOf('+234 803 618 2204')).toBe('NG');
    expect(countryOf('+44 7700 900874')).toBe('GB');
    expect(countryOf('+1 202 555 0148')).toBe('US');
    expect(countryOf('+33 6 12 34 56 78')).toBe('FR');
    expect(countryOf('+34 612 345 678')).toBe('ES');
    expect(countryOf('+351 912 345 678')).toBe('PT');
    expect(countryOf('+55 11 91234 5678')).toBe('BR');
    expect(countryOf('+52 55 1234 5678')).toBe('MX');
    const one = (phone: string) => priceOf([{ phone, parts: 1 }]);
    expect(one('+1 202 555 0148')).toBe(2);
    expect(one('+44 7700 900874')).toBe(9);
    expect(one('+33 6 12 34 56 78')).toBe(13);
    expect(one('+34 612 345 678')).toBe(14);
    expect(one('+351 912 345 678')).toBe(8);
    expect(one('+55 11 91234 5678')).toBe(10);
    expect(one('+52 55 1234 5678')).toBe(29);
    expect(one('+234 803 618 2204')).toBe(62);
    expect(priceOf(OFFER_MOBILES.map(({ phone }) => ({ phone, parts: 2 })))).toBe(146);
  });

  it('agrees with Messages’ notice costs for the UK and Spain', () => {
    expect(PART_CREDITS.GB).toBe(NOTICE_CREDITS.kwame?.sms);
    expect(PART_CREDITS.ES).toBe(NOTICE_CREDITS.lucia?.sms);
  });

  it('counts parts as GSM-7 or UCS-2', () => {
    expect(smsParts('x'.repeat(160))).toBe(1);
    expect(smsParts('x'.repeat(161))).toBe(2);
    expect(smsParts('x'.repeat(307))).toBe(3);
    expect(smsParts('’'.repeat(70))).toBe(1);
    expect(smsParts('’'.repeat(71))).toBe(2);
  });

  it('reads each state’s credits line', () => {
    const credits = (state: (typeof MAKE_LIVE_STATES)[number]) =>
      creditsOf(reachOf(state, eventIn(state)));
    expect(credits('makeLiveOffer')).toEqual({
      line: 'Texts use 146 credits. Credits after sending: 104.',
      waiting: 0,
    });
    expect(credits('makeLiveOfferPart')).toEqual({ line: 'Texts use 22 credits.', waiting: 1 });
    expect(credits('makeLiveOfferWaits')).toEqual({ line: null, waiting: 3 });
    expect(credits('makeLiveOfferOne')).toEqual({ line: null, waiting: 0 });
    expect(credits('makeLiveOfferEmail')).toEqual({ line: null, waiting: 0 });
    expect(credits('makeLiveOfferNobody')).toEqual({ line: null, waiting: 0 });
  });

  it('says one credit in the singular', () => {
    expect(
      creditsOf({ guests: 1, unreachable: 0, texts: [1], balance: 10, maySend: true, whatsApp: [] })
        .line,
    ).toBe('Texts use 1 credit. Credits after sending: 9.');
  });
});

describe('the alerts', () => {
  it('asks the question, with the line about the draft', () => {
    expect(alertIn('makeLive')).toMatchObject({
      title: 'Make Bisi & Kola’s engagement live?',
      line: 'Guests can be invited, and they can see it. It can’t go back to being a draft.',
      host: null,
      keep: { label: 'Not yet', off: false },
      confirm: { label: 'Make live', busy: undefined },
    });
    expect(alertIn('makeLiveMaking')).toMatchObject({
      keep: { off: true },
      confirm: { busy: 'Making live…' },
    });
    expect(alertIn('makeLiveNotMade')?.failed).toBe('Not made live. Try again in a moment.');
    expect(alertIn('makeLiveNoOffer', 'evt-cena-4')?.title).toBe(
      'Make Cena benéfica Fundación Lucía live?',
    );
  });

  it('asks Host 1 when there is no host, and says so when it is left empty', () => {
    expect(alertIn('makeLiveHost')?.host).toEqual({ error: null });
    expect(alertIn('makeLiveHostBlank')?.host).toEqual({
      error: 'Enter who is hosting to make this event live.',
    });
    const s = run('makeLiveHostBlank', [{ type: 'typed' }]);
    expect(s.turn).toMatchObject({ at: 'question', host: { error: null } });
    const blank = run('makeLiveHost', [{ type: 'confirm', hostError: 'Enter who' }]);
    expect(blank.turn).toMatchObject({
      at: 'question',
      making: false,
      host: { error: 'Enter who' },
    });
    expect(blank.live).toBe(false);
  });

  it('offers to send, with the app’s line about the web and the credits', () => {
    expect(alertIn('makeLiveOffer')).toMatchObject({
      title: 'Send invitations to 11 guests now?',
      line: 'Bisi & Kola’s engagement is live.',
      later: LATER,
      credits: { line: 'Texts use 146 credits. Credits after sending: 104.' },
      failedLast: null,
      confirm: { label: 'Send them' },
    });
    expect(alertIn('makeLiveOfferEmail')).toMatchObject({
      title: 'Send invitations to 11 guests now?',
      line: 'Bisi & Kola’s engagement is live.',
      later: LATER,
      credits: { line: null, waiting: 0 },
      failedLast: null,
      confirm: { label: 'Send them' },
    });
    expect(alertIn('makeLiveOfferOne')).toMatchObject({
      title: 'Send the invitation to 1 guest now?',
      later: 'You can send the invitation later from Guests in Soirely on the web.',
      credits: { line: null, waiting: 0 },
      confirm: { label: 'Send it' },
    });
    expect(alertIn('makeLiveOfferSending')).toMatchObject({
      keep: { off: true },
      confirm: { busy: 'Sending…' },
    });
    expect(alertIn('makeLiveOfferNotSent')).toMatchObject({
      failed: null,
      failedLast: 'Not sent. Try again in a moment.',
    });
  });

  it('refuses in the offer’s place with Close alone', () => {
    expect(alertIn('makeLiveOfferNobody')).toMatchObject({
      title: 'The invitations cannot be sent yet.',
      line: 'Bisi & Kola’s engagement is live.',
      reason:
        'None of the 11 guests can be reached. Add an email address or a mobile number for them in Guests.',
      later: LATER,
      keep: { label: 'Close' },
      confirm: null,
    });
    expect(alertIn('makeLiveOfferRefused')).toEqual(alertIn('makeLiveOfferNobody'));
    expect(makeLiveStart('makeLiveOfferRefused')).toEqual({
      turn: { at: 'stopped', why: 'nobody' },
      live: true,
      toast: null,
    });
    expect(alertIn('makeLiveOfferForbidden')).toMatchObject({
      title: 'The invitations cannot be sent yet.',
      reason: 'Your role no longer includes sending messages, so nothing was sent.',
      later: null,
      confirm: null,
    });
  });

  it('tells the end has passed, and that somebody else made it live', () => {
    expect(alertIn('makeLiveEndPassed', 'evt-shower-2')).toMatchObject({
      title: 'Not made live.',
      line: W.endPassed,
      alert: true,
      keep: { label: 'Close' },
      confirm: { label: 'Change dates' },
    });
    expect(alertIn('makeLiveChanged')).toMatchObject({
      title: 'Somebody else changed this event while you had it open.',
      line: 'It’s live now. The page shows what it is now.',
      alert: true,
      confirm: null,
    });
  });
});

describe('each branch', () => {
  it('turns the question into the offer once it is live', () => {
    const s = run('makeLive', MAKE);
    expect(s.live).toBe(true);
    expect(s.turn).toEqual({ at: 'offer', sending: false, failed: false });
  });

  it('tries again from Not made live and goes through', () => {
    expect(run('makeLiveNotMade', MAKE)).toMatchObject({ live: true, turn: { at: 'offer' } });
  });

  it('makes it live with ✓ Live when there is nobody to offer, or the reader may not send', () => {
    for (const s of [run('makeLiveNoOffer', MAKE, 'evt-cena-4'), run('makeLiveCannotSend', MAKE)]) {
      expect(s).toEqual({ turn: { at: 'closed' }, live: true, toast: 'madeLive' });
      expect(liveToastOf(s, reachOf(null, eventIn('makeLive')))).toBe('✓ Live');
    }
  });

  it('stops with the refusal when nobody can be reached', () => {
    const event = eventIn('makeLive');
    const reach = { ...reachOf('makeLive', event), unreachable: 11, texts: [] };
    const s = MAKE.reduce(
      (now, action) => reduceMakeLive(now, action, reach),
      makeLiveStart('makeLive'),
    );
    expect(s).toMatchObject({ live: true, turn: { at: 'stopped', why: 'nobody' } });
  });

  it('is Live in every branch after Make live, and nothing puts it back', () => {
    for (const state of ['makeLive', 'makeLiveCannotSend', 'makeLiveHost'] as const) {
      const s = run(state, [...MAKE, { type: 'keep' }, { type: 'send' }, { type: 'sent' }]);
      expect(s.live).toBe(true);
    }
    expect(run('makeLiveOfferForbidden', [{ type: 'keep' }]).live).toBe(true);
    expect(run('makeLiveChanged', [{ type: 'keep' }]).live).toBe(true);
  });

  it('takes no second press while Making live… or Sending…', () => {
    const making = run('makeLiveMaking', [{ type: 'confirm', hostError: null }, { type: 'keep' }]);
    expect(making).toEqual(makeLiveStart('makeLiveMaking'));
    const sending = run('makeLiveOfferSending', [{ type: 'send' }, { type: 'keep' }]);
    expect(sending).toEqual(makeLiveStart('makeLiveOfferSending'));
  });

  it('queues the invitations and toasts the guests reached, with Messages to the Invitation', () => {
    const s = run('makeLiveOffer', [{ type: 'send' }, { type: 'sent' }]);
    expect(s).toEqual({ turn: { at: 'closed' }, live: true, toast: 'queued' });
    expect(liveToastOf(s, reachOf('makeLiveOffer', eventIn('makeLiveOffer')))).toBe(
      'Invitations queued. Sending to 10 guests now.',
    );
    const email = run('makeLiveOfferEmail', [{ type: 'send' }, { type: 'sent' }]);
    expect(liveToastOf(email, reachOf('makeLiveOfferEmail', eventIn('makeLiveOfferEmail')))).toBe(
      'Invitations queued. Sending to 10 guests now.',
    );
    expect(
      liveToastOf(
        makeLiveStart('makeLiveOfferSent'),
        reachOf('makeLiveOfferOne', eventIn('makeLiveOfferOne')),
      ),
    ).toBe('Invitation queued. Sending to 1 guest now.');
    expect(INVITATION_HREF).toBe('/demo/events/evt-wed-4?area=messages&state=invited');
    expect(LIVE.messages).toBe('Messages');
  });

  it('closes with no toast after Not yet or Close', () => {
    expect(run('makeLiveOffer', [{ type: 'keep' }]).toast).toBeNull();
    expect(run('makeLiveOfferNobody', [{ type: 'keep' }]).toast).toBeNull();
    expect(run('makeLiveOfferRefused', [{ type: 'keep' }])).toEqual({
      turn: { at: 'closed' },
      live: true,
      toast: null,
    });
    expect(run('makeLive', [{ type: 'keep' }])).toEqual({
      turn: { at: 'closed' },
      live: false,
      toast: null,
    });
  });

  it('opens Host 1 on a Draft with no host, and the plain question on one with a host', () => {
    expect(
      reduceMakeLive(
        makeLiveStart(null),
        { type: 'open', asksHost: true },
        reachOf(null, eventIn('makeLive')),
      ).turn,
    ).toMatchObject({ at: 'question', host: { error: null } });
    expect(
      reduceMakeLive(
        makeLiveStart(null),
        { type: 'open', asksHost: false },
        reachOf(null, eventIn('makeLive')),
      ).turn,
    ).toMatchObject({ at: 'question', host: null });
  });
});
