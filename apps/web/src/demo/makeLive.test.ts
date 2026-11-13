import { describe, expect, it } from 'vitest';

import { EVENT_STATES, EVENTS_PAGES } from './events.ts';
import {
  type MakeLiveState,
  type Offer,
  MAKE_LIVE_STATES,
  costOf,
  isMakeLive,
  liveIn,
  lw,
  offerOf,
  phaseOf,
  reachedIds,
} from './makeLive.ts';

function offered(state: MakeLiveState): Offer {
  const offer = offerOf('evt-draft-4', state);

  if (offer == null) throw new Error(`no offer in ${state}`);

  return offer;
}

describe('Make live and the offer to send invitations (sc-3971)', () => {
  it('links every state once, on Bisi & Kola’s engagement, and the no-offer one on a list with nobody Not yet invited', () => {
    const links = EVENTS_PAGES.flatMap((page) => page.states.map((one) => one.to));

    for (const { key } of MAKE_LIVE_STATES) {
      const id = key === 'makeLiveNoOffer' ? 'evt-cena-4' : 'evt-draft-4';

      expect(EVENT_STATES[key], key).toBe(id);
      expect(
        links.filter((one) => one === `/demo/events/${id}?state=${key}`),
        key,
      ).toHaveLength(1);
    }
    expect(MAKE_LIVE_STATES).toHaveLength(17);
    expect(isMakeLive('makeLiveOfferWaits')).toBe(true);
    expect(isMakeLive('makeLiveOfferNone')).toBe(false);
  });

  it('counts 11 Not yet invited, 10 of them reachable, 3 texts: 247 credits after', () => {
    const offer = offered('makeLiveOffer');

    expect(offer).toEqual({ count: 11, reached: 10, texts: 3, emails: 10, balance: 250 });
    expect(reachedIds('evt-draft-4', 'makeLiveOffer')).toHaveLength(10);
    expect(reachedIds('evt-draft-4', 'makeLiveOffer')).not.toContain('tomas-os');
    expect(lw.many('offerTitle', 11)).toBe('Send invitations to 11 guests now?');
    expect(lw.many('queued', 10)).toBe('Invitations queued. Sending to 10 guests now.');
    expect(costOf(offer)).toEqual({
      credits: 'Texts use 3 credits. Credits after sending: 247.',
      either: null,
      waits: null,
    });
  });

  it('says what waits for credits with sc-3963’s own lines when the balance is short', () => {
    expect(costOf(offered('makeLiveOfferPart'))).toEqual({
      credits: 'Texts use 1 credit.',
      either: 'Email goes either way.',
      waits: '2 SMS messages will wait for credits.',
    });
    expect(costOf(offered('makeLiveOfferWaits'))).toEqual({
      credits: null,
      either: 'Email goes either way.',
      waits: '3 SMS messages will wait for credits.',
    });
    expect(costOf(offered('makeLiveOfferEmail'))).toEqual({
      credits: null,
      either: null,
      waits: null,
    });
  });

  it('offers one guest in the singular, nobody reachable as the refusal, and nothing on a list with nobody Not yet invited', () => {
    const one = offerOf('evt-draft-4', 'makeLiveOfferOne');
    const nobody = offerOf('evt-draft-4', 'makeLiveOfferNobody');

    expect(one).toMatchObject({ count: 1, reached: 1, texts: 0 });
    expect(lw.many('offerTitle', 1)).toBe('Send the invitation to 1 guest now?');
    expect(lw.many('sendThem', 1)).toBe('Send it');
    expect(nobody).toMatchObject({ count: 11, reached: 0 });
    expect(lw.many('cannotTitle', 11)).toBe('The invitations cannot be sent yet.');
    expect(lw.many('nobody', 11)).toBe(
      'None of the 11 guests can be reached. Add an email address or a mobile number for them in Guests.',
    );
    expect(offerOf('evt-cena-4', 'makeLiveNoOffer')).toBeNull();
  });

  it('opens the alert where each state draws it, with the event Live from the offer on', () => {
    expect(phaseOf('makeLive')).toEqual({ at: 'ask', failed: false });
    expect(phaseOf('makeLiveNotMade')).toEqual({ at: 'ask', failed: true });
    expect(phaseOf('makeLiveOfferNotSent')).toEqual({ at: 'offer', failed: true });
    expect(phaseOf('makeLiveOfferRefused')).toEqual({ at: 'cannot', why: 'nobody' });
    expect(phaseOf('makeLiveOfferForbidden')).toEqual({ at: 'cannot', why: 'forbidden' });
    expect(phaseOf('makeLiveOfferSent')).toBeNull();
    expect(phaseOf('madeLive')).toBeNull();
    expect(liveIn('makeLive')).toBe(false);
    expect(liveIn('makeLiveMaking')).toBe(false);
    expect(liveIn('makeLiveOffer')).toBe(true);
    expect(liveIn('makeLiveOfferNotYet')).toBe(true);
    expect(liveIn('madeLive')).toBe(true);
    expect(liveIn('makeLiveNoOffer')).toBe(false);
  });
});
