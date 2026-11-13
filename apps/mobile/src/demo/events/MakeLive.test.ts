import { describe, expect, it } from 'vitest';

import { EVENT_STATES } from './EventsModel.ts';
import { liveCounted } from './EventsWords.ts';
import {
  type LiveAction,
  MAKE_LIVE_STATES,
  type MakeLive,
  creditsOf,
  liveAlertOf,
  liveToastOf,
  makeLiveStart,
  reachOf,
  reachedOf,
  reduceMakeLive,
} from './MakeLive.ts';

const NAME = 'Bisi & Kola’s engagement';
const ENGAGEMENT = 'evt-draft-4';
const LATER = 'You can send the invitations later from Guests in Soirely on the web.';

function alertIn(state: string, event = ENGAGEMENT) {
  return liveAlertOf(makeLiveStart(state).turn, reachOf(state, event), NAME);
}

function run(state: string, actions: readonly LiveAction[], event = ENGAGEMENT): MakeLive {
  const reach = reachOf(state, event);

  return actions.reduce((s, action) => reduceMakeLive(s, action, reach), makeLiveStart(state));
}

describe('the engagement’s list, as the offer counts it (sc-3971)', () => {
  it('offers the 11 guests Not yet invited, never the companion, and tells 10 in the toast', () => {
    const reach = reachOf('makeLiveOffer', ENGAGEMENT);

    expect(reach.guests).toBe(11);
    expect(reach.guests + reach.companions).toBe(12);
    expect(reach.emailOnly + reach.withPhone + reach.unreachable).toBe(11);
    expect(reachedOf(reach)).toBe(10);
  });

  it('gives any other Draft nobody on its list', () => {
    expect(reachOf('makeLiveNoOffer', 'evt-cena-4').guests).toBe(0);
  });

  it('is in the event demo’s states, each one', () => {
    for (const state of MAKE_LIVE_STATES) expect(EVENT_STATES).toContain(state);
  });
});

describe('the credits line, B’s words built once', () => {
  it('says what the 3 texts use and what is left at 250', () => {
    expect(creditsOf(reachOf('makeLiveOffer', ENGAGEMENT))).toEqual({
      line: 'Texts use 3 credits. Credits after sending: 247.',
      waiting: 0,
    });
  });

  it('hands the texts the balance cannot cover to sc-3963’s wait block, after what does go', () => {
    expect(creditsOf(reachOf('makeLiveOfferPart', ENGAGEMENT))).toEqual({
      line: 'Texts use 1 credit.',
      waiting: 2,
    });
    expect(creditsOf(reachOf('makeLiveOfferWaits', ENGAGEMENT))).toEqual({
      line: null,
      waiting: 3,
    });
  });

  it('has no line when nothing goes by text', () => {
    expect(creditsOf(reachOf('makeLiveOfferEmail', ENGAGEMENT))).toEqual({
      line: null,
      waiting: 0,
    });
    expect(liveCounted('textsUse', 2)).toBe('Texts use 2 credits.');
  });

  it('counts WhatsApp in place of the text: with texts at marketing, alone at utility (sc-45251)', () => {
    expect(creditsOf(reachOf('makeLiveOfferWhatsApp', ENGAGEMENT))).toEqual({
      line: 'Texts and WhatsApp messages use 23 credits. Credits after sending: 227.',
      waiting: 0,
    });
    expect(creditsOf(reachOf('makeLiveOfferWhatsAppOnly', ENGAGEMENT))).toEqual({
      line: 'WhatsApp messages use 12 credits. Credits after sending: 238.',
      waiting: 0,
    });
  });
});

describe('the alert at each state', () => {
  it('asks in main’s words, Make live in the accent and Not yet first', () => {
    expect(alertIn('makeLive')).toEqual({
      turn: 'question',
      title: 'Make Bisi & Kola’s engagement live?',
      line: 'Guests can be invited, and they can see it. It can’t go back to being a draft.',
      failed: null,
      credits: { line: null, waiting: 0 },
      later: null,
      keep: { label: 'Not yet', off: false },
      confirm: { label: 'Make live', busy: undefined },
    });
  });

  it('turns the verb while it makes it live, and says when it was not', () => {
    expect(alertIn('makeLiveMaking')?.confirm?.busy).toBe('Making live…');
    expect(alertIn('makeLiveMaking')?.keep.off).toBe(true);
    expect(alertIn('makeLiveNotMade')?.failed).toBe('Not made live. Try again in a moment.');
  });

  it('turns into the offer: the count, the event is live, the credits and the app’s later line', () => {
    expect(alertIn('makeLiveOffer')).toMatchObject({
      turn: 'offer',
      title: 'Send invitations to 11 guests now?',
      line: 'Bisi & Kola’s engagement is live.',
      failed: null,
      credits: { line: 'Texts use 3 credits. Credits after sending: 247.' },
      later: LATER,
      keep: { label: 'Not yet', off: false },
      confirm: { label: 'Send them', busy: undefined },
    });
  });

  it('leaves the later line to the web', () => {
    const state = makeLiveStart('makeLiveOffer');

    expect(liveAlertOf(state.turn, reachOf('makeLiveOffer', ENGAGEMENT), NAME, false)?.later).toBe(
      null,
    );
  });

  it('says it for one guest', () => {
    expect(alertIn('makeLiveOfferOne')).toMatchObject({
      title: 'Send the invitation to 1 guest now?',
      confirm: { label: 'Send it' },
      later: 'You can send the invitation later from Guests in Soirely on the web.',
      credits: { line: null, waiting: 0 },
    });
  });

  it('turns the verb while it sends, and keeps the offer when it was not sent', () => {
    expect(alertIn('makeLiveOfferSending')).toMatchObject({
      keep: { off: true },
      confirm: { busy: 'Sending…' },
    });
    expect(alertIn('makeLiveOfferNotSent')).toMatchObject({
      turn: 'offer',
      failed: 'Not sent. Try again in a moment.',
      confirm: { label: 'Send them', busy: undefined },
    });
  });

  it('makes no offer when nobody can be reached, nor after the server refuses', () => {
    const nobody = {
      turn: 'stopped',
      title: 'The invitations cannot be sent yet.',
      line: 'Bisi & Kola’s engagement is live.',
      failed:
        'None of the 11 guests can be reached. Add an email address or a mobile number for them in Guests.',
      later: LATER,
      keep: { label: 'Close', off: false },
      confirm: null,
    };

    expect(alertIn('makeLiveOfferNobody')).toMatchObject(nobody);
    expect(alertIn('makeLiveOfferRefused')).toMatchObject(nobody);
  });

  it('says a role that lost messages.manage sent nothing, with Close alone and no later line', () => {
    expect(alertIn('makeLiveOfferForbidden')).toMatchObject({
      title: 'The invitations cannot be sent yet.',
      line: 'Bisi & Kola’s engagement is live.',
      failed: 'Your role no longer includes sending messages, so nothing was sent.',
      later: null,
      confirm: null,
    });
  });

  it('is closed once it is taken, after Not yet, and when no offer was made', () => {
    expect(alertIn('makeLiveOfferSent')).toBeNull();
    expect(alertIn('makeLiveOfferNotYet')).toBeNull();
    expect(alertIn('madeLive')).toBeNull();
    expect(makeLiveStart('makeLiveOfferNotYet').toast).toBeNull();
    expect(makeLiveStart('madeLive').toast).toBe('madeLive');
  });

  it('has the one-guest forms of the refusal and the toast', () => {
    expect(liveCounted('cannotTitle', 1)).toBe('The invitation cannot be sent yet.');
    expect(liveCounted('nobody', 1)).toBe(
      'This guest cannot be reached. Add an email address or a mobile number for them in Guests.',
    );
    expect(liveCounted('queued', 1)).toBe('Invitation queued. Sending to 1 guest now.');
    expect(liveCounted('queued', 1200)).toBe('Invitations queued. Sending to 1,200 guests now.');
  });
});

describe('pressing through from the question, sending nothing', () => {
  it('goes Live and turns into the offer, then queues the invitations with a toast', () => {
    const offered = run('makeLive', ['confirm', 'made']);
    expect(offered).toEqual({
      turn: { at: 'offer', sending: false, failed: false },
      live: true,
      toast: null,
    });

    const sent = run('makeLive', ['confirm', 'made', 'send', 'sent']);
    expect(sent.turn).toEqual({ at: 'closed' });
    expect(liveToastOf(sent, reachOf('makeLive', ENGAGEMENT))).toBe(
      'Invitations queued. Sending to 10 guests now.',
    );
  });

  it('closes Live with no toast after Not yet on the offer', () => {
    const kept = run('makeLive', ['confirm', 'made', 'keep']);

    expect(kept).toEqual({ turn: { at: 'closed' }, live: true, toast: null });
  });

  it('ignores Not yet and a second press while an answer is out', () => {
    expect(run('makeLive', ['confirm', 'keep', 'confirm']).turn).toEqual({
      at: 'question',
      making: true,
      failed: false,
    });
    expect(run('makeLiveOffer', ['send', 'keep', 'send']).turn).toEqual({
      at: 'offer',
      sending: true,
      failed: false,
    });
  });

  it('tries again from a failure', () => {
    expect(run('makeLiveNotMade', ['confirm']).turn).toMatchObject({ making: true, failed: false });
    expect(run('makeLiveOfferNotSent', ['send', 'sent']).toast).toBe('queued');
  });

  it('ends on ✓ Live with nobody on the list, and on why when nobody can be reached', () => {
    const none = run('makeLiveNoOffer', ['confirm', 'made'], 'evt-cena-4');
    expect(none.turn).toEqual({ at: 'closed' });
    expect(liveToastOf(none, reachOf('makeLiveNoOffer', 'evt-cena-4'))).toBe('✓ Live');

    const nobody = reachOf('makeLiveOfferNobody', ENGAGEMENT);
    const stopped = reduceMakeLive(
      reduceMakeLive(makeLiveStart('makeLive'), 'confirm', nobody),
      'made',
      nobody,
    );
    expect(stopped.turn).toEqual({ at: 'stopped', why: 'nobody' });
    expect(reduceMakeLive(stopped, 'keep', nobody)).toEqual({
      turn: { at: 'closed' },
      live: true,
      toast: null,
    });
  });

  it('opens again from the card after Not yet on the question, still a Draft', () => {
    const again = run('makeLive', ['keep', 'open']);

    expect(again).toEqual({
      turn: { at: 'question', making: false, failed: false },
      live: false,
      toast: null,
    });
  });
});
