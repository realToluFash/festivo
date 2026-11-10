import type { PassState } from './PassModel.ts';

/** The demo home's pass group: each State tweak on PassPrint.dc.html (page 35), at tablet landscape. */
const STATES: Record<PassState, readonly [string, string]> = {
  ticket: ['Print on a ticket', 'Print beside Plates up, the only green action'],
  printed: ['Printed and Print failed', 'Printed {time}; on the iPad, Print failed {time}'],
  printTickets: ['Print tickets · not printed yet', 'The side panel, a failed ticket counted'],
  noneLeft: ['Print tickets · none left', 'None left to print, All chosen'],
  noTickets: ['Print tickets disabled', 'No tickets in Main: · none in Main'],
  printingOff: ['Printing · Off, no printer', 'Paper roll 80 mm, the switch Off'],
  picker: ['Printing · iOS’s picker', 'Turning it on with no printer (iPad)'],
  pickerClosed: ['Printing · picker closed', 'Still Off, and it says why (iPad)'],
  printingOn: ['Printing · On, printer named', 'Kitchen TSP143IV and Change printer (iPad)'],
  headerOn: ['Pass header · Print when fired · On', 'The chip in the header (iPad)'],
  versionB: ['Printing · version B', 'Paper roll and the iPad line (Android)'],
  offline: ['No connection · Print tickets', 'Print tickets from the tickets on screen'],
  reconnecting: ['No connection · Print on a ticket', 'Print on each ticket, as of 20:09'],
};

const ANDROID: ReadonlySet<PassState> = new Set(['versionB']);

export const PASS_BOARDS = (Object.keys(STATES) as PassState[]).map((state) => ({
  title: `Pass · ${STATES[state][0]}`,
  what: STATES[state][1],
  href: `/demo/pass?state=${state}${ANDROID.has(state) ? '&platform=android' : ''}`,
}));
