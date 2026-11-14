/** The pass's print controls (sc-4018, PassPrint.dc.html on page 35): who prints what, on this device's own record. */

import { NOW } from './PassSample.ts';

export type PrintPlatform = 'ipad' | 'android';
export type Roll = '80' | '58';
export type Connection = 'connected' | 'none';
export type Panel = 'tickets' | 'printing';
export type Which = 'unprinted' | 'all';

export interface PassTicket {
  table: string;
  covers: number;
  wait: number;
  firedAt: string;
  allergies: readonly string[];
  lines: readonly { count: number; dish: string; tone: Tone; flag?: string; preference?: true }[];
  preference?: string;
}

export type Tone = 'chicken' | 'fish' | 'suya' | 'tofu' | 'none';

/** This device's own record: when each ticket was sent to print, and which automatic prints failed. */
export interface PrintRecord {
  printed: Readonly<Record<string, string>>;
  failed: Readonly<Record<string, string>>;
  tried: readonly string[];
}

export interface PassSetup {
  record: PrintRecord;
  panel: Panel | null;
  which: Which;
  roll: Roll;
  whenFired: boolean;
  onSince: string | null;
  printer: string | null;
  picker: boolean;
  pickerClosed: boolean;
  noTickets: boolean;
  connection: Connection;
}

export const PASS_STATES = [
  'ticket',
  'printed',
  'printTickets',
  'noneLeft',
  'noTickets',
  'printingOff',
  'picker',
  'pickerClosed',
  'printingOn',
  'headerOn',
  'versionB',
  'offline',
  'reconnecting',
] as const;
export type PassState = (typeof PASS_STATES)[number];

export function passStateOf(raw: string | undefined): PassState {
  return PASS_STATES.find((state) => state === raw) ?? 'ticket';
}

export function platformOf(raw: string | undefined, os: string): PrintPlatform {
  if (raw === 'ipad' || raw === 'android') return raw;
  return os === 'ios' ? 'ipad' : 'android';
}

export const EMPTY_RECORD: PrintRecord = { printed: {}, failed: {}, tried: [] };
const TWO: PrintRecord = { printed: { T9: '20:09', T12: '20:10' }, failed: {}, tried: [] };
const TWO_AND_FAILED: PrintRecord = {
  printed: { T9: '20:09', T12: '20:10', T15: '20:10' },
  failed: { T16: '20:11' },
  tried: ['T15', 'T16'],
};

export function startOf(
  state: PassState,
  platform: PrintPlatform,
  tables: readonly string[],
  printer: string,
): PassSetup {
  const ipad = platform === 'ipad';
  const base: PassSetup = {
    record: EMPTY_RECORD,
    panel: null,
    which: 'unprinted',
    roll: '80',
    whenFired: false,
    onSince: null,
    printer: null,
    picker: false,
    pickerClosed: false,
    noTickets: false,
    connection: 'connected',
  };
  const onSince = (since: string) => (ipad ? { whenFired: true, onSince: since, printer } : {});
  const onBeforeT15 = onSince('20:09');
  const onNow = onSince(NOW);

  switch (state) {
    case 'ticket':
      return base;
    case 'printed':
      return { ...base, ...onBeforeT15, record: ipad ? TWO_AND_FAILED : TWO };
    case 'printTickets':
      return { ...base, ...onBeforeT15, record: ipad ? TWO_AND_FAILED : TWO, panel: 'tickets' };
    case 'noneLeft':
      return {
        ...base,
        record: { ...EMPTY_RECORD, printed: Object.fromEntries(tables.map((t) => [t, '20:08'])) },
        panel: 'tickets',
      };
    case 'noTickets':
      return { ...base, noTickets: true };
    case 'printingOff':
      return { ...base, panel: 'printing' };
    case 'picker':
      return { ...base, panel: 'printing', picker: ipad };
    case 'pickerClosed':
      return { ...base, panel: 'printing', pickerClosed: ipad };
    case 'printingOn':
    case 'versionB':
      return { ...base, ...onNow, panel: 'printing' };
    case 'headerOn':
      return { ...base, ...onNow, record: TWO };
    case 'offline':
      return {
        ...base,
        connection: 'none',
        record: { ...EMPTY_RECORD, printed: { T9: '20:09' } },
        panel: 'tickets',
      };
    case 'reconnecting':
      return {
        ...base,
        connection: 'none',
        record: { ...EMPTY_RECORD, printed: { T9: '20:09' } },
      };
  }
}

/** Not printed yet: every ticket this device has not sent to print, a failed one included. */
export function unprintedOf(
  tickets: readonly PassTicket[],
  record: PrintRecord,
): readonly PassTicket[] {
  return tickets.filter((ticket) => record.printed[ticket.table] == null);
}

export interface PrintChoices {
  unprinted: readonly PassTicket[];
  failedCount: number;
  noneLeft: boolean;
  which: Which;
  chosen: readonly PassTicket[];
}

export function choicesOf(
  tickets: readonly PassTicket[],
  record: PrintRecord,
  which: Which,
): PrintChoices {
  const unprinted = unprintedOf(tickets, record);
  const noneLeft = unprinted.length === 0;
  const settled = noneLeft ? 'all' : which;

  return {
    unprinted,
    failedCount: unprinted.filter((ticket) => record.failed[ticket.table] != null).length,
    noneLeft,
    which: settled,
    chosen: settled === 'all' ? tickets : unprinted,
  };
}

export function canPrintTickets(tickets: readonly PassTicket[]): boolean {
  return tickets.length > 0;
}

/** Sent to print by hand, through the device's dialogue: Printed {time}, and a failure before it is gone. */
export function sentByHand(
  record: PrintRecord,
  tables: readonly string[],
  at: string,
): PrintRecord {
  const printed = { ...record.printed };
  const failed = { ...record.failed };
  for (const table of tables) {
    printed[table] = at;
    delete failed[table];
  }

  return { ...record, printed, failed };
}

export function dueToPrint(
  tickets: readonly PassTicket[],
  record: PrintRecord,
  onSince: string | null,
): readonly PassTicket[] {
  if (onSince == null) return [];

  return tickets.filter(
    (ticket) =>
      ticket.firedAt > onSince &&
      !record.tried.includes(ticket.table) &&
      record.printed[ticket.table] == null,
  );
}

/** Print when fired's pass over the tickets on screen, after a fire, a refetch or a restart alike. */
export function printWhenFired(
  tickets: readonly PassTicket[],
  record: PrintRecord,
  onSince: string | null,
  reachable: boolean,
  at: string,
): PrintRecord {
  const due = dueToPrint(tickets, record, onSince);
  if (due.length === 0) return record;

  const printed = { ...record.printed };
  const failed = { ...record.failed };
  for (const ticket of due) {
    if (reachable) printed[ticket.table] = at;
    else failed[ticket.table] = at;
  }

  return { printed, failed, tried: [...record.tried, ...due.map((ticket) => ticket.table)] };
}

export type SwitchPress = { open: 'picker' } | { set: Pick<PassSetup, 'whenFired' | 'onSince'> };

/** The switch: off turns off; on needs a printer, so with none it opens iOS's picker and stays Off. */
export function pressSwitch(setup: PassSetup, at: string): SwitchPress {
  if (setup.whenFired) return { set: { whenFired: false, onSince: null } };
  if (setup.printer == null) return { open: 'picker' };

  return { set: { whenFired: true, onSince: at } };
}

/** A printer chosen in the picker: turning on from the switch finishes; Change printer keeps the switch as it was. */
export function printerChosen(setup: PassSetup, name: string, at: string): Partial<PassSetup> {
  const turningOn = setup.printer == null;

  return {
    printer: name,
    picker: false,
    pickerClosed: false,
    ...(turningOn && !setup.whenFired && { whenFired: true, onSince: at }),
  };
}

export function pickerDismissed(setup: PassSetup): Partial<PassSetup> {
  return { picker: false, pickerClosed: setup.printer == null };
}
