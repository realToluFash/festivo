import { describe, expect, it } from 'vitest';

import {
  PASS_PAGES,
  PASS_STATES,
  TICKETS,
  allFor,
  choicesOf,
  notPrintedYet,
  passStateOf,
  printN,
  sentToPrint,
  startOf,
  stillToMake,
} from './pass.ts';

describe('the pass’s print controls at a desk (sc-4018)', () => {
  it('opens each state the board names, and Print on a ticket for anything else', () => {
    for (const state of PASS_STATES) expect(passStateOf(state)).toBe(state);
    expect(passStateOf('nope')).toBe('ticket');
    expect(passStateOf(null)).toBe('ticket');
  });

  it('lists every state on the demo’s home', () => {
    expect(PASS_PAGES[0]?.states.map((state) => state.to)).toEqual(
      PASS_STATES.map((state) => `/demo/pass?state=${state}`),
    );
  });

  it('chooses Not printed yet by default, counting what this browser has not sent', () => {
    const choices = choicesOf(TICKETS, startOf('print-tickets').printed, 'unprinted');
    expect(choices.which).toBe('unprinted');
    expect(notPrintedYet(choices.unprinted.length)).toBe('Not printed yet · 4 tickets');
    expect(printN(choices.chosen.length)).toBe('Print 4 tickets');
    expect(allFor(TICKETS.length)).toBe('All tickets for Main · 6 tickets, printed ones again');
  });

  it('chooses All once nothing is left unprinted', () => {
    const choices = choicesOf(TICKETS, startOf('none-left').printed, 'unprinted');
    expect(choices.noneLeft).toBe(true);
    expect(choices.which).toBe('all');
    expect(choices.chosen).toHaveLength(TICKETS.length);
  });

  it('opens with no tickets for the disabled Print tickets', () => {
    expect(startOf('no-tickets').noTickets).toBe(true);
  });

  it('records Printed {time} for each ticket sent, on the 24-hour clock', () => {
    const printed = sentToPrint({ T9: '20:09' }, ['T12', 'T13'], '20:12');
    expect(printed).toEqual({ T9: '20:09', T12: '20:12', T13: '20:12' });
  });

  it('keeps printing working while the strip is not live', () => {
    expect(startOf('offline')).toMatchObject({ connection: 'offline', panel: 'tickets' });
    expect(startOf('reconnecting').connection).toBe('stale');
  });

  it('adds up what is still to make from the tickets on screen', () => {
    expect(stillToMake(TICKETS).find((row) => row.dish === 'Jollof · chicken')?.count).toBe(38);
  });
});
