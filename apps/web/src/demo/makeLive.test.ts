import { describe, expect, it } from 'vitest';

import { EVENT_STATES, EVENTS_PAGES, sampleEvent } from './events.ts';
import {
  type MakeLiveState,
  type Offer,
  ASK,
  MAKE_LIVE_STATES,
  costOf,
  hostTyped,
  isMakeLive,
  lw,
  maySend,
  offerOf,
  phaseOf,
  seededEvent,
} from './makeLive.ts';

const OWN: Partial<Record<MakeLiveState, string>> = {
  makeLiveEndPassed: 'evt-shower-2',
  makeLiveNoOffer: 'evt-cena-4',
  madeLive: 'evt-cena-4',
};

function seeded(state: MakeLiveState) {
  const event = sampleEvent(EVENT_STATES[state] ?? '');

  if (event == null) throw new Error(`no event for ${state}`);

  return seededEvent(event, state);
}

function offered(state: MakeLiveState): Offer {
  const offer = offerOf(seeded(state), state);

  if (offer == null) throw new Error(`no offer in ${state}`);

  return offer;
}

describe('Make live and the offer to send invitations (sc-3971)', () => {
  it('links every state once, each on the event the brief names', () => {
    const links = EVENTS_PAGES.flatMap((page) => page.states.map((one) => one.to));

    expect(MAKE_LIVE_STATES.map((one) => one.key)).toEqual([
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
    for (const { key } of MAKE_LIVE_STATES) {
      const id = OWN[key] ?? 'evt-draft-4';

      expect(EVENT_STATES[key], key).toBe(id);
      expect(
        links.filter((one) => one === `/demo/events/${id}?state=${key}`),
        key,
      ).toHaveLength(1);
    }
    expect(MAKE_LIVE_STATES).toHaveLength(24);
    expect(isMakeLive('makeLiveOfferRefused')).toBe(true);
    expect(isMakeLive('draft')).toBe(false);
  });

  it('names the host unless the state asks for one, and is Live from the offer on', () => {
    expect(seeded('makeLive')).toMatchObject({ hosts: ['Bisi Akindele'], status: 'draft' });
    expect(seeded('makeLiveHost').hosts).toEqual([]);
    expect(seeded('makeLiveHostBlank').hosts).toEqual([]);
    expect(seeded('makeLiveChanged').status).toBe('live');
    expect(seeded('makeLiveOffer').status).toBe('live');
    expect(seeded('makeLiveOfferNotYet').status).toBe('live');
    expect(seeded('makeLiveOfferEmail').status).toBe('live');
    expect(seeded('makeLiveOfferRefused').status).toBe('live');
    expect(seeded('madeLive')).toMatchObject({ hosts: ['Fundación Lucía'], status: 'live' });
    expect(seeded('makeLiveNoOffer')).toMatchObject({
      hosts: ['Fundación Lucía'],
      status: 'draft',
    });
    expect(seeded('makeLiveEndPassed').status).toBe('draft');
    expect(maySend('makeLiveCannotSend')).toBe(false);
    expect(maySend('makeLive')).toBe(true);
    expect(maySend(null)).toBe(true);
  });

  it('takes Host 1 as typed, a line break as a space, and nothing as empty', () => {
    expect(hostTyped('  Bisi\nAkindele ')).toBe('Bisi Akindele');
    expect(hostTyped('Bisi\r\n\r\nAkindele')).toBe('Bisi Akindele');
    expect(hostTyped(' \n ')).toBeNull();
  });

  it('offers to the 11 Not yet invited, the one nobody reaches among them, toasts the 10 reached, and prices the three texts by their numbers: 2 × (62 + 9 + 2)', () => {
    const offer = offered('makeLiveOffer');

    expect(offer).toEqual({
      count: 11,
      reached: 10,
      texts: [124, 18, 4],
      emails: 10,
      balance: 250,
      whatsApp: 0,
      whatsAppCredits: 0,
    });
    expect(lw.many('offerTitle', offer.count)).toBe('Send invitations to 11 guests now?');
    expect(lw.many('queued', offer.reached)).toBe('Invitations queued. Sending to 10 guests now.');
    expect(costOf(offer)).toEqual({
      credits: 'Texts use 146 credits. Credits after sending: 104.',
      either: null,
      waits: null,
    });
  });

  it('sends only the texts whose whole cost is covered, and says what waits in sc-3963’s lines', () => {
    expect(offered('makeLiveOfferPart').balance).toBe(100);
    expect(costOf(offered('makeLiveOfferPart'))).toEqual({
      credits: 'Texts use 22 credits.',
      either: 'Email goes either way.',
      waits: '1 SMS message will wait for credits.',
    });
    expect(costOf(offered('makeLiveOfferWaits'))).toEqual({
      credits: null,
      either: 'Email goes either way.',
      waits: '3 SMS messages will wait for credits.',
    });
    expect(
      costOf({
        count: 1,
        reached: 1,
        texts: [],
        emails: 1,
        balance: 0,
        whatsApp: 0,
        whatsAppCredits: 0,
      }),
    ).toEqual({
      credits: null,
      either: null,
      waits: null,
    });
  });

  it('offers the whole list by email with no cost line when nobody is texted', () => {
    const email = offered('makeLiveOfferEmail');

    expect(email).toEqual({
      count: 11,
      reached: 10,
      texts: [],
      emails: 10,
      balance: 250,
      whatsApp: 0,
      whatsAppCredits: 0,
    });
    expect(costOf(email)).toEqual({ credits: null, either: null, waits: null });
    expect(phaseOf('makeLiveOfferEmail')).toEqual({ at: 'offer', failed: false });
  });

  it('puts the refusal after Send them in the offer’s place, as nobody reachable does', () => {
    expect(offered('makeLiveOfferRefused')).toMatchObject({ count: 11, reached: 0, texts: [] });
    expect(phaseOf('makeLiveOfferRefused')).toEqual(phaseOf('makeLiveOfferNobody'));
  });

  it('offers one guest in the singular, nobody reachable as the refusal, and nothing on a list with nobody Not yet invited', () => {
    const one = offered('makeLiveOfferOne');
    const nobody = offered('makeLiveOfferNobody');

    expect(one).toMatchObject({ count: 1, reached: 1, texts: [] });
    expect(lw.many('offerTitle', 1)).toBe('Send the invitation to 1 guest now?');
    expect(lw.many('sendThem', 1)).toBe('Send it');
    expect(nobody).toMatchObject({ count: 11, reached: 0 });
    expect(lw.many('cannotTitle', 11)).toBe('The invitations cannot be sent yet.');
    expect(lw.many('nobody', 11)).toBe(
      'None of the 11 guests can be reached. Add an email address or a mobile number for them in Guests.',
    );
    expect(offerOf(seeded('makeLiveNoOffer'), 'makeLiveNoOffer')).toBeNull();
  });

  it('opens the alert where each state draws it', () => {
    expect(phaseOf('makeLive')).toEqual(ASK);
    expect(phaseOf('makeLiveHost')).toEqual(ASK);
    expect(phaseOf('makeLiveHostBlank')).toEqual({ ...ASK, blank: true });
    expect(phaseOf('makeLiveNotMade')).toEqual({ ...ASK, failed: true });
    expect(phaseOf('makeLiveCannotSend')).toEqual(ASK);
    expect(phaseOf('makeLiveEndPassed')).toEqual({ at: 'told', why: 'endPassed' });
    expect(phaseOf('makeLiveChanged')).toEqual({ at: 'told', why: 'changed' });
    expect(phaseOf('makeLiveOfferPart')).toEqual({ at: 'offer', failed: false });
    expect(phaseOf('makeLiveOfferNotSent')).toEqual({ at: 'offer', failed: true });
    expect(phaseOf('makeLiveOfferNobody')).toEqual({ at: 'cannot', why: 'nobody' });
    expect(phaseOf('makeLiveOfferForbidden')).toEqual({ at: 'cannot', why: 'forbidden' });
    expect(phaseOf('makeLiveOfferSent')).toBeNull();
    expect(phaseOf('makeLiveOfferNotYet')).toBeNull();
    expect(phaseOf('madeLive')).toBeNull();
  });
});

describe('Make live sends WhatsApp in place of the text (sc-45251)', () => {
  it('counts texts and WhatsApp messages together at marketing, each at its own country’s rate', () => {
    const offer = offered('makeLiveOfferWhatsApp');

    expect(offer).toMatchObject({ texts: [4], whatsApp: 2, whatsAppCredits: 22 });
    expect(costOf(offer).credits).toBe(
      'Texts and WhatsApp messages use 26 credits. Credits after sending: 224.',
    );
  });

  it('says WhatsApp messages alone when nobody is texted, at utility', () => {
    const offer = offered('makeLiveOfferWhatsAppOnly');

    expect(offer).toMatchObject({ texts: [], whatsApp: 3, whatsAppCredits: 8 });
    expect(costOf(offer).credits).toBe(
      'WhatsApp messages use 8 credits. Credits after sending: 242.',
    );
    expect(phaseOf('makeLiveOfferWhatsAppOnly')).toEqual({ at: 'offer', failed: false });
  });

  it('holds the WhatsApp invitations in sc-3963’s lines when credits are short, email going either way', () => {
    expect(costOf({ ...offered('makeLiveOfferWhatsApp'), balance: 0 })).toEqual({
      credits: null,
      either: 'Email goes either way.',
      waits: '2 WhatsApp messages will wait for credits. 1 SMS message will wait for credits.',
    });
  });
});
