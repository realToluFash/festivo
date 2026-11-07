import { describe, expect, it } from 'vitest';

import {
  codeOpens,
  deadCode,
  phoneCodeLine,
  EVENT_LINE,
  eventLines,
  joinCodeLine,
  R,
  REDEEM_PAGES,
  REDEEM_STATES,
  redeemStart,
  redeemStateOf,
  sendNewIn,
  shownNumber,
} from './redeem.ts';

describe('the browser’s redeem pages (sc-72, sc-4235)', () => {
  it('checks the join code before anything is sent: any case, spaces and hyphens ignored', () => {
    expect(joinCodeLine('')).toBe('Enter the join code.');
    expect(joinCodeLine(' - ')).toBe('Enter the join code.');
    expect(joinCodeLine('Q7KM 4X')).toBe('A join code is 8 letters and numbers.');
    expect(joinCodeLine('q7km-4xp2')).toBeNull();
    expect(codeOpens('q7km-4xp2')).toBe(true);
    expect(codeOpens('Q7KM 4XP3')).toBe(false);
  });

  it('asks for a name and a number long enough for the country, in the app’s words', () => {
    expect(eventLines('', '')).toEqual({
      name: 'Enter your full name.',
      number: 'Enter your mobile number.',
    });
    expect(eventLines('João Pereira', '912 345')).toEqual({
      number: 'That number looks too short for Portugal. Check it and try again.',
    });
    expect(eventLines('João Pereira', '912 345 412')).toEqual({});
    expect(shownNumber('912 345 412')).toBe('+351 912 345 412');
  });

  it('shows the event first, with its day, organisation, role and job', () => {
    expect(EVENT_LINE).toBe('Sat, Nov 14 · Lumen Feiras · Can check guests in · Bar and drinks');
    expect(R.inTitle).toBe('You’re in for Joana & Rui’s wedding · Bar and drinks');
    expect(R.signedOutAt).toBe('You’ll be signed out at 23:30.');
    expect(sendNewIn(54)).toBe('Send a new code in 0:54');
    expect(phoneCodeLine('')).toBe('blank');
    expect(phoneCodeLine('7139')).toBe('short');
    expect(phoneCodeLine('713908')).toBeNull();
    expect(deadCode('expired')).toBe(true);
    expect(deadCode('wrong')).toBe(false);
  });

  it('starts every state the spec names, and links each from the demo’s home', () => {
    const linked = REDEEM_PAGES.flatMap((page) => page.states.map((one) => one.to));
    for (const state of REDEEM_STATES) {
      expect(redeemStateOf(state)).toBe(state);
      expect(linked).toContain(`/demo/redeem?state=${state}`);
    }
    expect(redeemStateOf('nonsense')).toBe('enter');
  });

  it('draws each state as the board does', () => {
    expect(redeemStart('refused').step).toMatchObject({ kind: 'enter', line: 'refused' });
    expect(redeemStart('browser-event')).toMatchObject({ name: 'Hugo Faria' });
    expect(redeemStart('used-up').step).toMatchObject({ kind: 'event', usedUp: true });
    expect(redeemStart('code-expired').step).toMatchObject({ via: 'text', problem: 'expired' });
    expect(redeemStart('code-exhausted').step).toMatchObject({
      via: 'whatsapp',
      problem: 'exhausted',
    });
    expect(redeemStart('join-as')).toMatchObject({ name: 'Kemi Okafor' });
    expect(redeemStart('event-blank')).toMatchObject({ name: '', number: '' });
    expect(redeemStart('event-short')).toMatchObject({ name: 'João Pereira', number: '912 345' });
    expect(redeemStart('signed-out').step).toMatchObject({
      kind: 'enter',
      signedOut: true,
      typed: '',
    });
  });
});
