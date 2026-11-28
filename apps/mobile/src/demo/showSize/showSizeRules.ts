export type ShowRows = 'main' | 'needs';
export type ShowChosen = 'all' | 'events' | 'needs';

export const SHOW_ROWS: readonly { key: ShowRows; label: string }[] = [
  { key: 'main', label: 'Main’s two' },
  { key: 'needs', label: 'With Only what needs you' },
];

export const SHOW_CHOSEN: readonly { key: ShowChosen; label: string }[] = [
  { key: 'all', label: 'Events and milestones' },
  { key: 'events', label: 'Events only' },
  { key: 'needs', label: 'Only what needs you' },
];

/** The choice kept when the rows change: Only what needs you falls back to the first row once its row is gone. */
export function chosenIn(rows: ShowRows, chosen: ShowChosen): ShowChosen {
  return rows === 'main' && chosen === 'needs' ? 'all' : chosen;
}
