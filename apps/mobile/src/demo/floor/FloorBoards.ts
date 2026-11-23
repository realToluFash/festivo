import { FLOOR_STATES, type FloorState } from './FloorModel.ts';

const WHAT: Record<FloorState, readonly [string, string]> = {
  yours: ['Yours · one section', 'Every word in its order, an earlier course, and 2 flagged'],
  asWell: ['Yours · two sections', 'Section B and Section D, then Other tables'],
  noSection: ['On no section', 'No tables yet. Ifeoma Nduka will put you on a section.'],
  manage: ['service.manage, no section', 'Other tables only, every table'],
  moved: ['After a section move', 'You’re on Section D now.'],
  offline: ['No connection', '2 taps waiting, each marked Waiting to send'],
  notSent: ['Not sent', 'Ada Obi is served now, by Tomi Ade.'],
  table: ['A table', 'Flagged guests, trays, seats, a held guest and owed plates'],
  nothingReady: ['A held guest, nothing Ready', 'Only Wait for all'],
  sendBack: ['Send back', 'Four reasons, nothing sent until one is chosen'],
  undo: ['After Send back', 'Undo for 2 minutes, naming the step'],
  notYours: ['A table not yours', 'Seats, not names, and no action'],
  nobody: ['Nobody on it', 'Open to the waiter, names and actions shown'],
};

export const FLOOR_BOARDS = FLOOR_STATES.map((state) => ({
  title: `Floor · ${WHAT[state][0]}`,
  what: WHAT[state][1],
  href: `/demo/floor?state=${state}`,
}));
