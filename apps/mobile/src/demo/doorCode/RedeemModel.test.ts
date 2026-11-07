import { describe, expect, it } from 'vitest';

import {
  BAR,
  eventLine,
  joinCodeProblem,
  nameProblem,
  numberProblem,
  plainCode,
  redeemed,
} from './DoorCodeModel.ts';
import { joinAs, memberTitle, tryAgainAt, W, wrongCode, youreIn } from './DoorCodeWords.ts';
import {
  afterPhoneCode,
  flowAt,
  freshFlow,
  phoneTitle,
  REDEEM_STATES,
  type RedeemStep,
  redeemStateOf,
  refusalOf,
  areasFor,
  moreAreas,
} from './RedeemModel.ts';

const LOCALE = 'en-US';

describe('joining, every state (spec §5)', () => {
  it('opens each state on its step', () => {
    const steps = Object.fromEntries(REDEEM_STATES.map((state) => [state, flowAt(state).step]));

    expect(steps).toEqual({
      welcome: 'welcome',
      camera: 'camera',
      enter: 'enter',
      'enter-blank': 'enter',
      'enter-short': 'enter',
      checking: 'enter',
      refused: 'enter',
      'too-many': 'tooMany',
      event: 'event',
      'event-blank': 'event',
      'event-short': 'event',
      sending: 'event',
      'join-as': 'joinAs',
      member: 'member',
      code: 'code',
      'code-texted': 'code',
      'code-wrong': 'code',
      'code-expired': 'code',
      'code-exhausted': 'code',
      'code-failed': 'code',
      'used-up': 'event',
      in: 'in',
      'event-in': 'inside',
      'event-in-view': 'inside',
      'people-in': 'peopleIn',
    } satisfies Record<string, RedeemStep>);
  });

  it('opens on the welcome for anything else', () => {
    expect(redeemStateOf(undefined)).toBe('welcome');
    expect(redeemStateOf('browser-in')).toBe('welcome');
  });

  it('holds checking and sending for a link to show them', () => {
    expect(flowAt('checking').held).toBe(true);
    expect(flowAt('sending').held).toBe(true);
    expect(flowAt('enter').held).toBe(false);
  });

  it('carries each refusal in the board’s words', () => {
    expect(flowAt('enter-blank').said).toBe('Enter the join code.');
    expect(flowAt('enter-short').said).toBe('A join code is 8 letters and numbers.');
    expect(flowAt('refused').said).toBe(
      'That code doesn’t work. Check it with whoever gave it to you.',
    );
    expect(flowAt('event-blank')).toMatchObject({
      nameSaid: 'Enter your full name.',
      numberSaid: 'Enter your mobile number.',
    });
    expect(flowAt('event-short').numberSaid).toBe(
      'That number looks too short for Portugal. Check it and try again.',
    );
    expect(flowAt('used-up')).toMatchObject({ usedUp: true, full: true, name: 'Hugo Faria' });
  });

  it('opens inside the event at the code’s role', () => {
    expect(flowAt('event-in').role).toBe('Can check guests in');
    expect(flowAt('event-in-view').role).toBe('Can view');
  });
});

describe('the join code', () => {
  it('ignores case, spaces and hyphens', () => {
    expect(plainCode(' q7km-4xp2 ')).toBe('Q7KM4XP2');
    expect(redeemed('q7km-4xp2')).toEqual(BAR);
    expect(redeemed('M4TB7KQ8')?.job).toBe('Cloakroom');
  });

  it('checks blank and length before anything is sent', () => {
    expect(joinCodeProblem('')).toBe(W.codeBlank);
    expect(joinCodeProblem(' - ')).toBe(W.codeBlank);
    expect(joinCodeProblem('Q7KM 4X')).toBe(W.codeShort);
    expect(joinCodeProblem('Q7KM 4XP2 9')).toBe(W.codeShort);
    expect(joinCodeProblem('Q7KM 4XP3')).toBeNull();
  });

  it('gives one answer for a wrong, expired or stopped code', () => {
    expect(redeemed('Q7KM 4XP3')).toBeNull();
    expect(redeemed('H3WD 9RN6')).toBeNull();
  });

  it('shows the event first: its day, the organisation, the role and the job', () => {
    expect(eventLine(BAR, LOCALE)).toBe(
      'Sat, Nov 14 · Lumen Feiras · Can check guests in · Bar and drinks',
    );
  });
});

describe('a name and a number, then the phone code (sc-4235)', () => {
  it('needs a name and a Portuguese number of the right length', () => {
    expect(nameProblem(' ')).toBe(W.nameBlank);
    expect(nameProblem('João Pereira')).toBeNull();
    expect(numberProblem('')).toBe(W.numberBlank);
    expect(numberProblem('912 345')).toBe(
      'That number looks too short for Portugal. Check it and try again.',
    );
    expect(numberProblem('912 345 412')).toBeNull();
  });

  it('says the app’s phone-step words', () => {
    expect(phoneTitle(false)).toBe('Check WhatsApp');
    expect(phoneTitle(true)).toBe('Check your messages');
    expect(wrongCode(false)).toBe(
      'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
    );
    expect(refusalOf('expired')?.title).toBe('That code has expired');
    expect(refusalOf('exhausted')?.body).toBe(
      'That code no longer works. Send a new one to carry on.',
    );
    expect(refusalOf('failed')?.title).toBe('That did not work');
    expect(refusalOf('wrong')).toBeNull();
  });

  it('lands in, as the name given; a code that filled meanwhile meets the one refusal', () => {
    expect(afterPhoneCode({ ...flowAt('code'), name: ' Ana Lima ' })).toMatchObject({
      step: 'in',
      who: 'Ana Lima',
    });
    expect(afterPhoneCode({ ...flowAt('used-up'), step: 'code' })).toMatchObject({
      step: 'event',
      usedUp: true,
    });
  });

  it('starts again signed out with nothing kept', () => {
    expect(freshFlow()).toMatchObject({ step: 'welcome', name: '', number: '', typed: '' });
  });
});

describe('the words around it', () => {
  it('follows sc-72, sc-4235 and pm', () => {
    expect(youreIn('Joana & Rui’s wedding', 'Bar and drinks')).toBe(
      'You’re in for Joana & Rui’s wedding · Bar and drinks',
    );
    expect(memberTitle('Lumen Feiras')).toBe('You’re already a member of Lumen Feiras');
    expect(joinAs('Kemi Okafor')).toBe('Join as Kemi Okafor');
    expect(tryAgainAt('13:32')).toBe('Try again at 13:32');
    expect(W.endsLine).toBe('Access ends when the event concludes.');
  });
});

describe('inside the event, by role (pm, 7 Nov, sc-72)', () => {
  it('reaches Overview, Guests, Schedule, Seating and People at Can view', () => {
    expect(areasFor('Can view')).toEqual(['overview', 'guests', 'schedule', 'seating', 'people']);
  });

  it('puts Check guests in first at Can check guests in', () => {
    expect(areasFor('Can check guests in')).toEqual([
      'checkIn',
      'overview',
      'guests',
      'schedule',
      'seating',
      'people',
    ]);
  });

  it('keeps on the phone’s More what its tabs do not hold, and on the iPad only the account', () => {
    expect(moreAreas('Can check guests in', true)).toEqual([
      'checkIn',
      'schedule',
      'seating',
      'people',
    ]);
    expect(moreAreas('Can view', true)).toEqual(['schedule', 'seating', 'people']);
    expect(moreAreas('Can view', false)).toEqual([]);
  });
});
