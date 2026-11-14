export const TELL_GROUP = 'Tell guests: every kind, and after Send (sc-4330)';

export const TELL_STATES = [
  { key: 'tellDates', name: 'Tell guests, the dates' },
  { key: 'tellDateTime', name: 'Tell guests, a date and a start time' },
  { key: 'tellVenueAdded', name: 'Tell guests, a venue added' },
  { key: 'tellVenueGone', name: 'Tell guests, a venue removed' },
  { key: 'tellAddress', name: 'Tell guests, only the address changed' },
  { key: 'tellAddressAdded', name: 'Tell guests, an address added' },
  { key: 'tellPause', name: 'Tell guests, Pause' },
  { key: 'tellCallOff', name: 'Tell guests, Call off' },
  { key: 'tellResume', name: 'Tell guests, Resume' },
  { key: 'tellEndNow', name: 'Tell guests, End now before the last day' },
  { key: 'tellTables', name: 'Tell guests, Share tables' },
  { key: 'tellMenu', name: 'Tell guests, a menu change' },
  { key: 'tellLink', name: 'Tell guests, Replace link' },
  { key: 'tellSeeWho', name: 'Tell guests, See who' },
  { key: 'tellHeld', name: 'Tell guests, too few credits' },
  { key: 'tellQuiet', name: 'Tell guests, quiet hours' },
  { key: 'tellMerged', name: 'Tell guests, two changes' },
  { key: 'tellMixed', name: 'Tell guests, changes for different guests' },
  { key: 'untoldEvent', name: 'Not told yet, on the event’s page' },
  { key: 'untoldMerged', name: 'Not told yet, two changes' },
  { key: 'untoldPaused', name: 'Not told yet, a pause' },
  { key: 'untoldDismissed', name: 'Not told yet, dismissed' },
  { key: 'changeSending', name: 'A change, sending' },
  { key: 'changeRow', name: 'A change, its row' },
  { key: 'changeSent', name: 'A change, opened' },
  { key: 'changeMerged', name: 'A change, several sent' },
  { key: 'changeDone', name: 'A change, everyone reached' },
  { key: 'tellMenuOne', name: 'Tell guests, one guest' },
  { key: 'sendOffline', name: 'Tell guests, Send with no connection' },
  { key: 'sendUnconfirmed', name: 'Tell guests, Send not confirmed' },
  { key: 'sendRefusedRole', name: 'Tell guests, refused: the role' },
  { key: 'sendRefusedEvent', name: 'Tell guests, refused: a draft' },
  { key: 'sendRefusedFinished', name: 'Tell guests, refused: finished 30 days ago' },
  { key: 'sendRefusedDeleted', name: 'Tell guests, refused: deleted' },
  { key: 'sendRefused', name: 'Tell guests, refused: anything else' },
  { key: 'allTold', name: 'Every change already told' },
  { key: 'figuresLoading', name: 'Tell guests, the figures loading' },
  { key: 'figuresPressedEarly', name: 'Tell guests, Send pressed while the figures loaded' },
  { key: 'figuresFailed', name: 'Tell guests, the figures did not load' },
] as const;

export type TellState = (typeof TELL_STATES)[number]['key'];

export function isTellState(state: string | null): state is TellState {
  return TELL_STATES.some((one) => one.key === state);
}

/** The states that open on Messages; every other Tell state opens on the page the sheet is over. */
export const TELL_ON_MESSAGES: readonly TellState[] = [
  'untoldMerged',
  'untoldDismissed',
  'changeRow',
  'changeSent',
  'changeMerged',
  'changeDone',
];
