import { describe, expect, it } from 'vitest';

import {
  EMPTY_RECORD,
  PASS_STATES,
  type PassSetup,
  canPrintTickets,
  choicesOf,
  passStateOf,
  pickerDismissed,
  platformOf,
  pressSwitch,
  printWhenFired,
  printerChosen,
  sentByHand,
  startOf,
} from './PassModel.ts';
import { FIRED_LATER, PRINTERS, TICKETS } from './PassSample.ts';

const TABLES = TICKETS.map((ticket) => ticket.table);
const off = (over: Partial<PassSetup> = {}): PassSetup => ({
  ...startOf('ticket', 'ipad', TABLES, PRINTERS[0]),
  ...over,
});

describe('the pass’s print controls (sc-4018)', () => {
  it('opens each state the board names, and the ticket for anything else', () => {
    for (const state of PASS_STATES) expect(passStateOf(state)).toBe(state);
    expect(passStateOf('nope')).toBe('ticket');
    expect(passStateOf(undefined)).toBe('ticket');
  });

  it('takes the platform from the address, else from the device', () => {
    expect(platformOf('android', 'ios')).toBe('android');
    expect(platformOf(undefined, 'ios')).toBe('ipad');
    expect(platformOf(undefined, 'android')).toBe('android');
  });

  it('starts Print when fired off, with no printer, on the 80 mm roll', () => {
    const setup = off();
    expect(setup.whenFired).toBe(false);
    expect(setup.printer).toBeNull();
    expect(setup.roll).toBe('80');
  });

  it('counts a failed print under Not printed yet', () => {
    const record = { printed: { T9: '20:09' }, failed: { T13: '20:11' }, tried: ['T13'] };
    const choices = choicesOf(TICKETS, record, 'unprinted');
    expect(choices.unprinted.map((t) => t.table)).toEqual(['T12', 'T13', 'T14', 'T15', 'T16']);
    expect(choices.failedCount).toBe(1);
    expect(choices.chosen).toHaveLength(5);
  });

  it('chooses All once nothing is left unprinted', () => {
    const record = sentByHand(EMPTY_RECORD, TABLES, '20:12');
    const choices = choicesOf(TICKETS, record, 'unprinted');
    expect(choices.noneLeft).toBe(true);
    expect(choices.which).toBe('all');
    expect(choices.chosen).toHaveLength(TICKETS.length);
  });

  it('keeps Print tickets shut with no tickets in the course', () => {
    expect(canPrintTickets([])).toBe(false);
    expect(canPrintTickets(TICKETS)).toBe(true);
  });

  it('records a print by hand at the time it was sent, clearing a failure', () => {
    const record = sentByHand(
      { printed: {}, failed: { T13: '20:11' }, tried: ['T13'] },
      ['T13'],
      '20:12',
    );
    expect(record.printed.T13).toBe('20:12');
    expect(record.failed.T13).toBeUndefined();
  });

  it('opens the picker when turned on with no printer, and stays Off if it closes unchosen', () => {
    const setup = off();
    expect(pressSwitch(setup, '20:12')).toEqual({ open: 'picker' });
    expect(pickerDismissed(setup)).toEqual({ picker: false, pickerClosed: true });
  });

  it('turns on once a printer is chosen from the switch, and Change printer leaves the switch alone', () => {
    expect(printerChosen(off(), PRINTERS[0], '20:12')).toMatchObject({
      printer: PRINTERS[0],
      whenFired: true,
      onSince: '20:12',
    });
    const changing = printerChosen(off({ printer: PRINTERS[0] }), PRINTERS[1], '20:12');
    expect(changing.printer).toBe(PRINTERS[1]);
    expect(changing.whenFired).toBeUndefined();
    expect(pickerDismissed(off({ printer: PRINTERS[0] }))).toEqual({
      picker: false,
      pickerClosed: false,
    });
  });

  it('turns on straight away with a printer already chosen, and off again', () => {
    expect(pressSwitch(off({ printer: PRINTERS[0] }), '20:12')).toEqual({
      set: { whenFired: true, onSince: '20:12' },
    });
    expect(pressSwitch(off({ printer: PRINTERS[0], whenFired: true }), '20:12')).toEqual({
      set: { whenFired: false, onSince: null },
    });
  });

  it('never prints a ticket fired before it was turned on', () => {
    const record = printWhenFired(TICKETS, EMPTY_RECORD, '20:12', true, '20:12');
    expect(record).toBe(EMPTY_RECORD);
  });

  it('prints a newly fired ticket once, never again after a refetch or a restart', () => {
    const tickets = [...TICKETS, FIRED_LATER];
    const once = printWhenFired(tickets, EMPTY_RECORD, '20:12', true, '20:13');
    expect(once.printed).toEqual({ T17: '20:13' });

    const refetched = printWhenFired(tickets, once, '20:12', true, '20:14');
    expect(refetched).toBe(once);

    const restarted: typeof once = JSON.parse(JSON.stringify(once));
    expect(printWhenFired(tickets, restarted, '20:12', true, '20:15').printed).toEqual({
      T17: '20:13',
    });
  });

  it('never retries a failed print by itself, and leaves it for a person to print', () => {
    const tickets = [...TICKETS, FIRED_LATER];
    const failed = printWhenFired(tickets, EMPTY_RECORD, '20:12', false, '20:13');
    expect(failed.failed).toEqual({ T17: '20:13' });
    expect(printWhenFired(tickets, failed, '20:12', true, '20:14')).toBe(failed);
    expect(choicesOf(tickets, failed, 'unprinted').failedCount).toBe(1);
  });

  it('draws Printing A only on the iPad', () => {
    expect(startOf('printingOn', 'ipad', TABLES, PRINTERS[0]).whenFired).toBe(true);
    expect(startOf('printingOn', 'android', TABLES, PRINTERS[0]).whenFired).toBe(false);
    expect(startOf('picker', 'android', TABLES, PRINTERS[0]).picker).toBe(false);
  });
});
