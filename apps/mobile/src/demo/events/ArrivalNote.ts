export const NOTE_MOST = 500;

export const ARRIVAL_NOTE =
  'Use the side entrance on Marylebone Road. The front doors open at 17:30.\nThere is no parking at The Landmark: the nearest car park is on Old Marylebone Road.';

export const WIDE_NOTE = (
  'https://www.google.com/maps/dir/?api=1&destination=The+Landmark+side+entrance&travelmode=transit&waypoints=' +
  'Marylebone+Station%2C+London%7C'.repeat(20)
).slice(0, NOTE_MOST);

export const LONG_NOTE =
  `${ARRIVAL_NOTE}\n${'Bring this page or the printed invitation, and ask at the side entrance for the hosts’ table plan. '.repeat(4)}`
    .slice(0, NOTE_MOST)
    .replace(/\s$/u, '.')
    .concat('!');

export const NOTE_WORDS = {
  label: 'Arrival note',
  hint: 'How to find the entrance, where to park, when the doors open. Every guest sees this on their page.',
  tooLong: `Shorten the arrival note to ${String(NOTE_MOST)} characters or fewer.`,
  oneField: '1 field needs fixing, so nothing was sent.',
  forbidden: 'Nothing was changed. Your role does not include the permission this needs.',
  addVenue: 'Add the venue',
} as const;

/** What the form, the web and the API count: code points after NFC, of the text that will be saved. */
export function noteLength(typed: string): number {
  return Array.from(typed.trim().normalize('NFC')).length;
}

export function noteTooLong(typed: string): boolean {
  return noteLength(typed) > NOTE_MOST;
}

/** Trimmed on save; a note of only spaces or blank lines is no note. */
export function savedNote(typed: string): string | null {
  const kept = typed.trim();

  return kept === '' ? null : kept;
}
