import type { PrintPlatform } from './PassModel.ts';

/** The board's English (sc-4018's AC, and the lines marked New words · [en] on PassPrint.dc.html); [en] owns them all. */
export const PW = {
  title: 'Pass · Main',
  happening: 'Happening now',
  event: 'Adébáyọ̀ at 60 · Eko Hotel · started 19:00',
  whenOnChip: 'Print when fired · On',
  tabs: ['To make', 'Plates up', 'All'],
  printing: 'Printing',
  printTickets: 'Print tickets',
  noneInCourse: '· none in Main',
  ticketsHeading: 'Tickets · longest wait first',
  emptyTitle: 'No tickets for Main yet',
  emptyBody:
    'They show here as Main is fired for each table. Print tickets opens once there is one.',
  allergy: 'Allergy',
  preference: 'Preference',
  platesUp: 'Plates up',
  print: 'Print',
  printed: (at: string) => `Printed ${at}`,
  printFailed: (at: string) => `Print failed ${at}`,
  stillToMake: 'Main · still to make',
  allergyPlates: (n: number) =>
    `${n} ${n === 1 ? 'allergy plate' : 'allergy plates'} still at the pass`,
  close: 'Close',
  which: 'Which tickets',
  notPrintedYet: (n: number) => `Not printed yet · ${n} ${n === 1 ? 'ticket' : 'tickets'}`,
  includesFailed: (n: number) => `Includes ${n} that failed to print.`,
  noneLeft: 'None left to print',
  allFor: (n: number) => `All tickets for Main · ${n} tickets, printed ones again`,
  staleNote:
    'These print as this screen shows them, as of 20:09. Each ticket carries AS OF 20:09 at the top.',
  cancel: 'Cancel',
  printN: (n: number) => `Print ${n} ${n === 1 ? 'ticket' : 'tickets'}`,
  dialogueLine: (device: string, roll: string) =>
    `Opens this ${device}’s print dialogue, laid out for the ${roll} roll.`,
  deviceLine: (device: string) => `This ${device} only. Saved as you change it.`,
  paperRoll: 'Paper roll',
  rolls: { '80': '80 mm', '58': '58 mm' },
  whenFired: 'Print when fired',
  whenFiredHint: 'Prints each ticket once, as its course is fired, with no dialogue.',
  on: 'On',
  off: 'Off',
  printer: 'Printer',
  changePrinter: 'Change printer',
  asksForPrinter: 'Turning it on asks which AirPrint printer to use.',
  pickerClosed: 'No printer chosen, so Print when fired stays Off.',
  chosen: 'Chosen',
  needsIpad: 'Print when fired needs the Soirely app on an iPad.',
  pickerCaption: 'iOS’s printer picker · a plain stand-in, not Soirely’s',
  dialogueCaption: {
    ipad: 'iOS’s print dialogue · a plain stand-in, not Soirely’s',
    android: 'Android’s print dialogue · a plain stand-in, not Soirely’s',
  } satisfies Record<PrintPlatform, string>,
  laidOut: (roll: string, stale: boolean) =>
    `Laid out as PrintedTicket draws it, for the ${roll} roll${stale ? ', with AS OF 20:09 at the top.' : '.'}`,
  oneTicket: (table: string) => `Table ${table.slice(1)} · 1 ticket`,
  forMain: (n: number) => `${n} ${n === 1 ? 'ticket' : 'tickets'} for Main`,
  printTicketAria: (table: string) => `Print table ${table.slice(1)}’s ticket`,
  live: ['Live', 'Updated just now. Plates move here as soon as the room moves them.'],
  stale: [
    'Reconnecting · as of 20:09',
    'Last update 20:09. What you see may have moved. Your taps are kept and sent when the signal is back.',
  ],
  offline: [
    'Offline · as of 20:09',
    'Marking plates and reading tickets still work. Requests from other devices won’t arrive until the signal is back.',
  ],
  asOf: 'as of 20:09',
  demoTitle: 'Demo only: printing as on',
  demoFire: 'Fire table 17',
  demoRefetch: 'Refetch the pass',
  demoUnreachable: 'Printer unreachable',
  demoNote:
    'Nothing is printed or stored: Print when fired, the record and the printer live only in this screen.',
  turn: 'The pass is drawn for a tablet on its side. Turn the tablet to see it as the board does.',
} as const;

export const DEVICE: Record<PrintPlatform, string> = { ipad: 'iPad', android: 'tablet' };
