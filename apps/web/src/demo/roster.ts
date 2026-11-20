import { emailProblem, phoneE164, phoneFields, phoneLengthProblem } from '@soirely/domain';

import { countryName } from './rules.ts';
import type { DemoLink } from './settings.ts';
import { type Trail, SAMPLE_LINK } from './staffLink.ts';
import { STATIONS_EVENT, SW, placesOf, sectionsOf, stationsStart } from './stations.ts';

/** The Roster on the event's Staff page (sc-3906, Staffing.dc.html on page e34): who works the event, without making them members. */
export const ORGANISATION = 'Ire Events';
export const NAME_MAX = 200;
export const BAR_MS = 10_000;

export type LinkState = 'opened' | 'sent' | 'copied' | 'none' | 'noMobile' | 'erased';

export interface Entry {
  id: string;
  name: string;
  job: string | null;
  station: string | null;
  /** The section the seating plan removed from under them, until they are given a station (sc-3910). */
  gone?: string;
  shift: string | null;
  more: readonly string[];
  mobile: string | null;
  email: string | null;
  link: 'opened' | 'sent' | 'copied' | 'none';
  trail?: Trail | null;
}

export interface Draft {
  name: string;
  country: string;
  number: string;
  email: string;
  job: string;
  shift: string;
}

export type Panel =
  | { kind: 'details'; id: string }
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'remove'; id: string }
  | null;

export const RW = {
  title: 'Staff',
  sub: 'Who works the event, where they work, and what each station serves.',
  tabs: ['Roster', 'Jobs and shifts', 'Stations', 'Hours worked'],
  roster: 'Roster',
  add: 'Add a person',
  empty: 'Nobody on the staff yet',
  emptySub: 'Add the people working this event. They are not made members of the organisation.',
  person: 'Name',
  job: 'Job',
  station: 'Station',
  shift: 'Shift',
  link: 'Link',
  mobile: 'Mobile number',
  email: 'Email',
  optional: 'Optional',
  country: 'Country',
  noJob: 'No job yet',
  noStation: 'No station yet',
  noShift: 'Not on a shift yet',
  notBuilt: 'AC, not yet built',
  nameHelp: 'As they would like to be called. At most 200 characters.',
  mobileHelp: 'Their link is sent to this number.',
  addCta: 'Add',
  addAnyway: 'Add anyway',
  saveChanges: 'Save changes',
  saveAnyway: 'Save anyway',
  cancel: 'Cancel',
  edit: 'Edit',
  remove: 'Remove from the event',
  keep: 'Keep them',
  stopsWorking: 'Their link stops working at once.',
  saved: 'Saved.',
  dismiss: 'Dismiss',
  close: 'Close',
  blank: 'Enter their name.',
  emailShape: 'That does not look like an email address. Check it has an @ and a domain.',
  phoneLength: (problem: 'short' | 'long', country: string) =>
    `That number looks too ${problem} for ${country}. Check it and try again.`,
  uses: (name: string) => `${name} already uses this number`,
  added: (name: string) => `${name} added to the roster.`,
  member: (name: string) =>
    `${name} is a member of ${ORGANISATION}. Their shift will appear in their app.`,
  removed: (name: string, shifts: number) =>
    `[${name} removed from the event. ${shifts > 1 ? 'Their shifts are' : 'Their shift is'} unassigned.]`,
  more: (n: number) => `+${n} more`,
  jobLocked: (name: string) => `Unassign ${name} from their shifts first.`,
  jobLockedHelp: 'Their job can change once they are on no shift.',
  notAdded: (name: string) => `[${name} was not added.]`,
  removeAsk: (name: string) => `Remove ${name} from the event?`,
  editTitle: (name: string) => `Edit ${name}`,
  nextSend: 'Next: send a link to everyone who has not been sent one yet.',
  nextHours: 'Next: check the hours on Hours worked before the budget closes.',
  nextCopied: 'Next: once you have sent them the copied link, mark it as sent.',
  nextErasing: 'Next: nothing. Their mobile number and email are removed 30 days after the event.',
  lock: 'You can see the roster. Changing it needs permission to manage staff.',
  stationChange: 'Change station',
  noStationNow: 'No station',
  sectionGone: (section: string) => `${section} was removed from the seating plan.`,
};

export const LINK_WORDS: Record<LinkState, string> = {
  opened: 'Link opened',
  sent: 'Link sent',
  copied: 'Copied',
  none: 'No link yet',
  noMobile: 'Add a mobile number to send a link',
  erased: 'Contact details removed after the event',
};

/** sc-3908's jobs, each with the station it brings (sc-3910) and its shifts. */
export const JOBS: readonly { job: string; station: string | null; shifts: readonly string[] }[] = [
  { job: 'Floor lead', station: 'Floor', shifts: ['16:00 to 01:00'] },
  { job: 'Waiter', station: null, shifts: ['17:00 to 00:00', '19:00 to 23:00'] },
  { job: 'Runner', station: 'Pass', shifts: ['17:00 to 00:00'] },
  { job: 'Cook', station: 'Kitchen', shifts: ['15:00 to 23:00'] },
  { job: 'Bar', station: 'Bar', shifts: ['16:00 to 01:00'] },
  { job: 'Door', station: 'Door', shifts: ['16:30 to 21:00'] },
];

const STATIONS_SAMPLE = stationsStart(null).state;

/** sc-3910: the roster's Station picker is Stations' grouped list, Places then Seating sections. */
export const STATION_GROUPS: readonly { label: string; stations: readonly string[] }[] = [
  { label: SW.places, stations: placesOf(STATIONS_SAMPLE).map((one) => one.name) },
  { label: SW.sections, stations: sectionsOf(STATIONS_SAMPLE).map((one) => one.name) },
];
/** Members of the organisation the roster can link to by mobile number or email. */
export const MEMBERS: readonly { name: string; mobile: string; email: string }[] = [
  { name: 'Amara Obi', mobile: '+2348035550142', email: 'amara.obi@ireevents.com' },
];

export function linkOf(entry: Entry, erased: boolean): LinkState {
  if (erased) return 'erased';
  if (entry.mobile == null) return 'noMobile';

  return entry.link;
}

const DAY = 24 * 60;
const DAY_TURNS = 6 * 60;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Minutes from 06:00, so a start after midnight sorts last; a start that names its day ("Fri 6 Nov, 16:00") sorts by it. The product sorts on sc-3908's full start. */
function startOf(entry: Entry): number | null {
  const clock = entry.shift?.split(' to ')[0];
  if (clock == null) return null;
  const dated = /^\S+ (\d{1,2}) (\S+), (\d{2}):(\d{2})$/.exec(clock);
  if (dated != null)
    return (
      Date.UTC(2026, MONTHS.indexOf(dated[2] as string), Number(dated[1])) / 60_000 +
      Number(dated[3]) * 60 +
      Number(dated[4])
    );
  const [hours, minutes] = clock.split(':').map(Number);

  return ((hours as number) * 60 + (minutes as number) - DAY_TURNS + DAY) % DAY;
}

/** By shift start, then name; people with no shift after everyone with one. */
export function sorted(entries: readonly Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const left = startOf(a);
    const right = startOf(b);
    if (left !== right) {
      if (left == null) return 1;
      if (right == null) return -1;

      return left < right ? -1 : 1;
    }

    return a.name.localeCompare(b.name, 'en');
  });
}

export function jobOf(name: string): (typeof JOBS)[number] | undefined {
  return JOBS.find((one) => one.job === name);
}

export function shiftLine(entry: Entry): string {
  return entry.job == null || entry.shift == null ? RW.noShift : `${entry.job} · ${entry.shift}`;
}

/** Every shift by start, each by job and times: the details and Remove's question. */
export function shiftLines(entry: Entry, rw: typeof RW = RW): string[] {
  if (entry.job == null || entry.shift == null) return [rw.noShift];

  return [entry.shift, ...entry.more].map((one) => `${entry.job} · ${one}`);
}

/** A person has one job on the event: it changes only while they are on no shift (Decided, 18 Nov 2026). */
export function jobLocked(editing: Entry | null, draft: Draft, rw: typeof RW = RW): string | null {
  if (editing == null || editing.shift == null) return null;
  if ((draft.job === '' ? null : draft.job) === editing.job) return null;

  return rw.jobLocked(editing.name);
}

export function nextLine(
  entries: readonly Entry[],
  finished: boolean,
  rw: typeof RW = RW,
): string | null {
  if (finished) return rw.nextHours;
  const unsent = entries.some(
    (one) => one.mobile != null && (one.link === 'none' || one.link === 'copied'),
  );

  return unsent ? rw.nextSend : null;
}

export function detailsNext(
  entry: Entry,
  finished: boolean,
  erased: boolean,
  rw: typeof RW = RW,
): string | null {
  if (erased) return null;
  if (finished) return rw.nextErasing;

  return linkOf(entry, false) === 'copied' ? rw.nextCopied : null;
}

export type Problems = { name?: string; number?: string; email?: string };

/** A blank name, a number the wrong length for its country, an email with no @ and domain; in the form's order. */
export function problemsOf(draft: Draft, contact: boolean, rw: typeof RW = RW): Problems {
  const problems: Problems = {};
  if (draft.name.trim() === '') problems.name = rw.blank;
  if (!contact) return problems;

  const length = phoneLengthProblem(draft.number, draft.country);
  if (length === 'tooShort' || length === 'tooLong')
    problems.number = rw.phoneLength(
      length === 'tooShort' ? 'short' : 'long',
      countryName(draft.country),
    );
  if (draft.email.trim() !== '' && emailProblem(draft.email) === 'shape')
    problems.email = rw.emailShape;

  return problems;
}

export function firstWrong(problems: Problems): 'name' | 'number' | 'email' | null {
  return (['name', 'number', 'email'] as const).find((one) => problems[one] != null) ?? null;
}

export function mobileOf(draft: Draft): string | null {
  return draft.number.trim() === '' ? null : phoneE164(draft.number, draft.country);
}

/** The first other entry in roster order on the same stored number; Edit asks only when the number changed. */
export function sharesNumber(
  entries: readonly Entry[],
  draft: Draft,
  editing: Entry | null,
): Entry | null {
  const mobile = mobileOf(draft);
  if (mobile == null) return null;
  if (editing != null && editing.mobile === mobile) return null;

  return sorted(entries).find((one) => one.id !== editing?.id && one.mobile === mobile) ?? null;
}

export function memberOf(draft: Draft): string | null {
  const mobile = mobileOf(draft);
  const email = draft.email.trim().toLocaleLowerCase('en');

  return (
    MEMBERS.find((one) => one.mobile === mobile || (email !== '' && one.email === email))?.name ??
    null
  );
}

let made = 0;

export function entryFrom(draft: Draft, before: Entry | null): Entry {
  const job = draft.job === '' ? null : draft.job;
  const mobile = mobileOf(draft);
  made += 1;

  return {
    id: before?.id ?? `new${made}`,
    name: draft.name.trim(),
    job,
    station:
      before != null && before.job === job ? before.station : (jobOf(draft.job)?.station ?? null),
    shift: job == null || draft.shift === '' ? null : draft.shift,
    more: before != null && before.job === job && before.shift === draft.shift ? before.more : [],
    mobile,
    email: draft.email.trim() === '' ? null : draft.email.trim(),
    link: before != null && before.mobile === mobile ? before.link : 'none',
  };
}

export function draftOf(entry: Entry | null): Draft {
  const fields = entry?.mobile == null ? null : phoneFields(entry.mobile);

  return {
    name: entry?.name ?? '',
    country: fields?.country ?? 'NG',
    number: fields?.number ?? '',
    email: entry?.email ?? '',
    job: entry?.job ?? '',
    shift: entry?.shift ?? '',
  };
}

const entry = (
  id: string,
  name: string,
  job: string | null,
  station: string | null,
  shift: string | null,
  mobile: string | null,
  link: Entry['link'],
  email: string | null = null,
): Entry => ({ id, name, job, station, shift, more: [], mobile, email, link });

const TRAILS: Record<string, Trail> = {
  bisi: { by: '', at: '18:20' },
  tayo: { by: 'Amara Nwosu', at: '17:58' },
  ifeoma: { by: '', at: '17:41' },
  sade: { by: 'Amara Nwosu', at: '18:02' },
  amina: { by: 'Amara Nwosu', at: '18:44' },
  grace: { by: '', at: '19:05' },
  kunle: { by: 'Amara Nwosu', at: '18:44' },
  ronke: { by: '', at: '18:31' },
};

export function sample(): Entry[] {
  return listed().map((one) => ({ ...one, trail: TRAILS[one.id] ?? null }));
}

function listed(): Entry[] {
  return [
    entry('bisi', 'Bisi Okon', 'Cook', 'Kitchen', '15:00 to 23:00', '+2348031110002', 'opened'),
    entry('tayo', 'Tayo Bamidele', 'Cook', 'Grill', '15:00 to 23:00', '+2348031110003', 'sent'),
    entry('ada', 'Ada Nnaji', 'Cook', 'Pastry', '15:00 to 23:00', null, 'none'),
    entry(
      'ifeoma',
      'Ifeoma Nduka',
      'Floor lead',
      'Floor',
      '16:00 to 01:00',
      '+2348031110001',
      'opened',
    ),
    entry('sade', 'Sade Lawal', 'Bar', 'Bar', '16:00 to 01:00', '+2348031110006', 'sent'),
    {
      ...entry('tolu', 'Tolu Bello', 'Door', 'Door', '16:30 to 21:00', '+2348031110007', 'none'),
      more: ['23:00 to 02:00'],
    },
    entry(
      'amina',
      'Amina Yusuf',
      'Waiter',
      'Section B',
      '17:00 to 00:00',
      '+2348031110010',
      'copied',
    ),
    entry(
      'grace',
      'Grace Udo',
      'Waiter',
      'Section A',
      '17:00 to 00:00',
      '+2348031110008',
      'opened',
    ),
    entry(
      'kunle',
      'Kunle Ajayi',
      'Waiter',
      'Section A',
      '17:00 to 00:00',
      '+2348031110009',
      'sent',
      'kunle.ajayi@gmail.com',
    ),
    entry('ronke', 'Ronke Alade', 'Runner', 'Pass', '17:00 to 00:00', '+2348031110005', 'opened'),
    entry('emeka', 'Emeka Obi', 'Waiter', null, '19:00 to 23:00', '+2348031110011', 'none'),
    entry('chinedu', 'Chinedu Eze', null, null, null, '+2348031110012', 'none'),
  ];
}

const dated = (id: string, shift: string, ...more: string[]) => ({ id, shift, more });

/** The wedding, Thu 5 Nov 18:00 to Sat 7 Nov 15:00 (sc-3908's weddingPlan): every start and end names its day. */
const WEDDING: readonly { id: string; shift: string; more: string[] }[] = [
  dated('bisi', 'Thu 5 Nov, 16:00 to 22:00', 'Fri 6 Nov, 14:00 to 23:00'),
  dated('tayo', 'Thu 5 Nov, 16:00 to 22:00', 'Fri 6 Nov, 14:00 to 23:00'),
  dated('ada', 'Fri 6 Nov, 14:00 to 23:00', 'Sat 7 Nov, 08:00 to 13:00'),
  dated(
    'ifeoma',
    'Thu 5 Nov, 18:00 to 23:00',
    'Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00',
    'Sat 7 Nov, 10:00 to 15:00',
  ),
  dated('sade', 'Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00'),
  dated(
    'tolu',
    'Thu 5 Nov, 17:30 to 21:00',
    'Fri 6 Nov, 16:30 to 21:00',
    'Fri 6 Nov, 23:00 to Sat 7 Nov, 02:00',
  ),
  dated('amina', 'Thu 5 Nov, 18:00 to 23:00', 'Fri 6 Nov, 17:00 to Sat 7 Nov, 00:00'),
  dated('grace', 'Thu 5 Nov, 18:00 to 23:00', 'Fri 6 Nov, 17:00 to Sat 7 Nov, 00:00'),
  dated('kunle', 'Fri 6 Nov, 17:00 to Sat 7 Nov, 00:00', 'Sat 7 Nov, 10:00 to 15:00'),
  dated('ronke', 'Fri 6 Nov, 17:00 to Sat 7 Nov, 00:00'),
  dated('emeka', 'Sat 7 Nov, 10:00 to 15:00'),
];

export function weddingSample(): Entry[] {
  return sample().map((one) => {
    const at = WEDDING.find((row) => row.id === one.id);

    return at == null ? one : { ...one, shift: at.shift, more: at.more };
  });
}

export interface RosterStart {
  name: string;
  note: string;
  entries: Entry[];
  panel: Panel;
  manage: boolean;
  finished: boolean;
  erased: boolean;
  draft: Draft;
  pressed: boolean;
  warning: string | null;
  bar: string[] | null;
  failed: string | null;
  /** What the demo's Copy link gets back: a link on the clipboard, no link issued, or a link the browser would not copy. */
  copy: 'works' | 'notIssued' | 'refused';
  held: { id: string; url: string } | null;
  missed: string | null;
  replacing: string | null;
  /** The words of a Shift cell with no shift: the product's French, to measure the longest at 400% zoom (sc-71607). */
  noShift: string;
  /** The language of the Roster's words; French to measure the longest from 961 to 1279 px (sc-73291). */
  lang: 'en' | 'fr';
}

function start(o: Partial<RosterStart> & Pick<RosterStart, 'name' | 'note'>): RosterStart {
  return {
    entries: sample(),
    panel: null,
    manage: true,
    finished: false,
    erased: false,
    draft: draftOf(null),
    pressed: false,
    warning: null,
    bar: null,
    failed: null,
    copy: 'works',
    held: null,
    missed: null,
    replacing: null,
    noShift: RW.noShift,
    lang: 'en',
    ...o,
  };
}

const FRENCH = { lang: 'fr', noShift: 'Aucun service pour l’instant' } as const;

/** A name and an email of 40 characters with no space, the longest single word a cell may hold (sc-75033). */
const LONG: Entry = entry(
  'long',
  'Oluwatimilehinoluwadamilareoluwaseunfunmi',
  'Runner',
  'Pass',
  '17:00 to 00:00',
  '+2348031110015',
  'none',
  'oluwatimilehin.oluwadamilare@example.com',
);

const erasedSample = () => sample().map((one) => ({ ...one, mobile: null, email: null }));

const typed = (o: Partial<Draft>): Draft => ({ ...draftOf(null), ...o });
const byId = (id: string) => sample().find((one) => one.id === id) as Entry;

function sectionRemovedEntries(): Entry[] {
  return [
    ...sample().map((one) => (one.id === 'emeka' ? { ...one, gone: 'Section D' } : one)),
    {
      ...entry('chidi', 'Chidi Okafor', 'Waiter', null, '17:00 to 00:00', '+2348031110014', 'sent'),
      gone: 'Section D',
    },
  ];
}

const STATES = {
  populated: () =>
    start({
      name: 'Populated',
      note: 'By shift start, then name; each Link word with its own mark.',
    }),
  empty: () => start({ name: 'Nobody on the staff yet', note: 'A new event.', entries: [] }),
  addBlank: () =>
    start({
      name: 'Add, the name left blank',
      note: 'Add pressed with nothing typed.',
      panel: { kind: 'add' },
      pressed: true,
    }),
  mobileTooShort: () =>
    start({
      name: 'Add, the number too short',
      note: 'Checked against sc-62’s length for Nigeria.',
      panel: { kind: 'add' },
      draft: typed({ name: 'Kemi Ade', number: '0803 111' }),
      pressed: true,
    }),
  mobileTooLong: () =>
    start({
      name: 'Add, the number too long',
      note: 'Checked against sc-62’s length for Nigeria.',
      panel: { kind: 'add' },
      draft: typed({ name: 'Kemi Ade', number: '0803 111 0013 44556' }),
      pressed: true,
    }),
  emailShape: () =>
    start({
      name: 'Add, the email’s shape',
      note: 'An email with no domain.',
      panel: { kind: 'add' },
      draft: typed({ name: 'Kemi Ade', number: '0803 111 0013', email: 'kemi.ade@' }),
      pressed: true,
    }),
  duplicateNumber: () =>
    start({
      name: 'Add, a number already on the roster',
      note: 'Add pressed with Kunle Ajayi’s number: Add anyway or Cancel.',
      panel: { kind: 'add' },
      draft: typed({ name: 'Funmi Bakare', number: '0803 111 0009', job: 'Waiter' }),
      pressed: true,
      warning: 'Kunle Ajayi',
    }),
  added: () =>
    start({
      name: 'Added',
      note: 'The status bar at the foot, said through the live region.',
      entries: [
        ...sample(),
        {
          id: 'kemi',
          name: 'Kemi Ade',
          job: 'Waiter',
          station: null,
          shift: '17:00 to 00:00',
          more: [],
          mobile: '+2348031110013',
          email: null,
          link: 'none',
        },
      ],
      bar: [RW.added('Kemi Ade')],
    }),
  memberLinked: () =>
    start({
      name: 'Added, and linked to a member',
      note: 'The member message names their account; the row keeps the typed name.',
      entries: [
        ...sample(),
        {
          id: 'mara',
          name: 'Mara Obi',
          job: 'Door',
          station: 'Door',
          shift: '16:30 to 21:00',
          more: [],
          mobile: '+2348035550142',
          email: null,
          link: 'none',
        },
      ],
      bar: [RW.added('Mara Obi'), RW.member('Amara Obi')],
    }),
  details: () =>
    start({
      name: 'Details, Amina Yusuf',
      note: 'Copied: the next step says to mark it as sent; Replace link under the Link.',
      panel: { kind: 'details', id: 'amina' },
    }),
  edit: () =>
    start({
      name: 'Edit, Kunle Ajayi',
      note: 'Name, mobile, email and job; no Station or Shift field.',
      panel: { kind: 'edit', id: 'kunle' },
      draft: draftOf(byId('kunle')),
    }),
  editDuplicateNumber: () =>
    start({
      name: 'Edit, changed to a number on the roster',
      note: 'Tolu Bello’s number changed to Grace Udo’s: Save anyway or Cancel.',
      panel: { kind: 'edit', id: 'tolu' },
      draft: { ...draftOf(byId('tolu')), number: '0803 111 0008' },
      pressed: true,
      warning: 'Grace Udo',
    }),
  removeAsk: () =>
    start({
      name: 'Remove, the question',
      note: 'Their shift by job and times, and Keep them.',
      panel: { kind: 'remove', id: 'kunle' },
    }),
  removeTwoShifts: () =>
    start({
      name: 'Remove, someone on two shifts',
      note: 'Tolu Bello: each shift named by job and times; each place is left open.',
      panel: { kind: 'remove', id: 'tolu' },
    }),
  detailsShifts: () =>
    start({
      name: 'Details, every shift',
      note: 'Tolu Bello is on two Door shifts: the row reads +1 more, the details list both by start.',
      panel: { kind: 'details', id: 'tolu' },
    }),
  editJobOnShift: () =>
    start({
      name: 'Edit, the job changed while on a shift',
      note: 'Kunle Ajayi from Waiter to Bar: refused until he is on no shift.',
      panel: { kind: 'edit', id: 'kunle' },
      draft: { ...draftOf(byId('kunle')), job: 'Bar' },
      pressed: true,
    }),
  finishedEvent: () =>
    start({
      name: 'Finished event',
      note: 'Edit stays; Remove from the event is not offered.',
      finished: true,
      panel: { kind: 'details', id: 'kunle' },
    }),
  finishedErased: () =>
    start({
      name: 'Finished, after the 30-day erasure',
      note: 'Every row reads Contact details removed; Edit has no Mobile or Email.',
      finished: true,
      erased: true,
      entries: sample().map((one) => ({ ...one, mobile: null, email: null })),
      panel: { kind: 'edit', id: 'kunle' },
      draft: { ...draftOf(byId('kunle')), number: '', email: '' },
    }),
  nobodyOnShift: () =>
    start({
      name: 'Nobody on a shift yet',
      note: 'Before shifts are handed out: every Shift cell reads Not on a shift yet, on one line at 400% zoom.',
      entries: sample().map((one) => ({ ...one, shift: null, more: [] })),
    }),
  nobodyOnShiftFrench: () =>
    start({
      name: 'Nobody on a shift yet, the French words',
      note: 'Each Shift cell holds the product’s French, Aucun service pour l’instant, still on one line at 400% zoom.',
      entries: sample().map((one) => ({ ...one, shift: null, more: [] })),
      noShift: 'Aucun service pour l’instant',
    }),
  sectionRemoved: () =>
    start({
      name: 'A section removed from the seating plan',
      note: 'Section D’s people have no station now; their rows and details say why.',
      entries: sectionRemovedEntries(),
      panel: { kind: 'details', id: 'emeka' },
    }),
  sectionRemovedReadOnly: () =>
    start({
      name: 'A section removed, without staff.manage',
      note: 'Emeka Obi’s details say No station and why, with no picker.',
      manage: false,
      entries: sectionRemovedEntries(),
      panel: { kind: 'details', id: 'emeka' },
    }),
  readOnly: () =>
    start({
      name: 'Without staff.manage',
      note: 'No Add, Edit, Remove or station change.',
      manage: false,
      panel: { kind: 'details', id: 'grace' },
    }),
  actionFailed: () =>
    start({
      name: 'Add failed (system › actionFailed)',
      note: 'The API did not take it; the form stays as typed.',
      panel: { kind: 'add' },
      draft: typed({ name: 'Kemi Ade', number: '0803 111 0013' }),
      failed: RW.notAdded('Kemi Ade'),
    }),
  longEvent: () =>
    start({
      name: 'An event over 24 hours, the wedding Thu 5 Nov to Sat 7 Nov',
      note: 'Each Shift names its day; Tolu Bello’s details list all three by start.',
      entries: weddingSample(),
      panel: { kind: 'details', id: 'tolu' },
    }),
  linkCopied: () =>
    start({
      name: 'Copy link, copied',
      note: 'Emeka Obi: Copied by Amara Nwosu, Mark as sent, and Link copied. said once the clipboard has it.',
      entries: sample().map((one) =>
        one.id === 'emeka'
          ? { ...one, link: 'copied', trail: { by: 'Amara Nwosu', at: '19:12' } }
          : one,
      ),
      bar: ['Link copied.'],
    }),
  linkNotIssued: () =>
    start({
      name: 'Copy link, no link issued',
      note: 'No connection or a server error: nothing copied or recorded, Emeka’s row keeps No link yet. Copy link fails again in Play.',
      copy: 'notIssued',
      missed: 'emeka',
    }),
  linkRefused: () =>
    start({
      name: 'Copy link, the browser refuses the clipboard',
      note: 'A link issued and shown to copy by hand, labelled Link for Emeka Obi; it counts as a copy. Copy link is refused again in Play.',
      copy: 'refused',
      entries: sample().map((one) =>
        one.id === 'emeka'
          ? { ...one, link: 'copied', trail: { by: 'Amara Nwosu', at: '19:12' } }
          : one,
      ),
      held: { id: 'emeka', url: SAMPLE_LINK },
    }),
  replaceAsk: () =>
    start({
      name: 'Replace link, the question',
      note: 'Grace Udo’s details, the centred dialog over them: Replace link or Keep this link.',
      panel: { kind: 'details', id: 'grace' },
      replacing: 'grace',
    }),
  replaced: () =>
    start({
      name: 'Replace link, replaced',
      note: 'Every link Grace Udo was given has stopped working; her row is back to No link yet.',
      entries: sample().map((one) =>
        one.id === 'grace' ? { ...one, link: 'none', trail: null } : one,
      ),
      panel: { kind: 'details', id: 'grace' },
      bar: ['[Grace Udo’s link is replaced. Copy link gives them a new one to send.]'],
    }),
  longEventRemove: () =>
    start({
      name: 'An event over 24 hours, Remove from the event',
      note: 'Tolu Bello’s three shifts, each with its day.',
      entries: weddingSample(),
      panel: { kind: 'remove', id: 'tolu' },
    }),
  add: () =>
    start({
      name: 'Add a person, the form open',
      note: 'Open it at 1000 × 800: the form comes before the Roster, which keeps its width.',
      panel: { kind: 'add' },
    }),
  addEmpty: () =>
    start({
      name: 'Add a person, on an empty roster',
      note: 'Open it at 1000 × 800: the form before Nobody on the staff yet.',
      entries: [],
      panel: { kind: 'add' },
    }),
  detailsFrench: () =>
    start({
      name: 'Details, Amina Yusuf, in French',
      note: 'The product’s French, [bracketed] where l10n has not written it. Open it at 1000 × 800.',
      panel: { kind: 'details', id: 'amina' },
      ...FRENCH,
    }),
  addFrench: () =>
    start({
      name: 'Add a person, the form open, in French',
      note: 'Open it at 1000 × 800: the form comes before the Roster.',
      panel: { kind: 'add' },
      ...FRENCH,
    }),
  addEmptyFrench: () =>
    start({
      name: 'Add a person, on an empty roster, in French',
      note: 'Open it at 1000 × 800: the form before the empty Roster.',
      entries: [],
      panel: { kind: 'add' },
      ...FRENCH,
    }),
  populatedFrench: () =>
    start({
      name: 'Populated, in French',
      note: 'Nothing open. Pas encore de lien and the no-mobile words wrap only between words; open it at 641, 800, 960 and 1100 × 800.',
      ...FRENCH,
    }),
  detailsNoLink: () =>
    start({
      name: 'Details, Emeka Obi, No link yet',
      note: 'Open it at 1280 or 1440 × 800: the details docked beside the Roster, each Link word whole.',
      panel: { kind: 'details', id: 'emeka' },
    }),
  detailsNoLinkFrench: () =>
    start({
      name: 'Details, Emeka Obi, Pas encore de lien',
      note: 'Open it at 1280 × 800: Pas encore de lien may wrap as Pas encore / de lien, never inside a word.',
      panel: { kind: 'details', id: 'emeka' },
      ...FRENCH,
    }),
  erasedList: () =>
    start({
      name: 'After the 30-day erasure, nothing open',
      note: 'Every Link cell reads Contact details removed after the event, in whole words.',
      finished: true,
      erased: true,
      entries: erasedSample(),
    }),
  erasedListFrench: () =>
    start({
      name: 'After the 30-day erasure, nothing open, in French',
      note: 'Coordonnées effacées après l’événement, in whole words; the frame scrolls if the table is wider.',
      finished: true,
      erased: true,
      entries: erasedSample(),
      ...FRENCH,
    }),
  erasedDetailsFrench: () =>
    start({
      name: 'After the 30-day erasure, details open, in French',
      note: 'Open it at 1280 × 800: the Roster and the details keep whole words.',
      finished: true,
      erased: true,
      entries: erasedSample(),
      panel: { kind: 'details', id: 'kunle' },
      ...FRENCH,
    }),
  longWord: () =>
    start({
      name: 'A 40-character word, details docked',
      note: 'Open it at 1280 × 800: in the Roster the Name column widens and the frame scrolls; in the details the word breaks at the panel’s edge.',
      entries: [...sample(), LONG],
      panel: { kind: 'details', id: 'long' },
    }),
} satisfies Record<string, () => RosterStart>;

export type RosterStateName = keyof typeof STATES;

export const ROSTER_STATES = Object.keys(STATES) as RosterStateName[];

export function rosterStart(raw: string | null): RosterStart {
  const name: RosterStateName =
    raw != null && Object.hasOwn(STATES, raw) ? (raw as RosterStateName) : 'populated';

  return STATES[name]();
}

export function rosterAt(state?: RosterStateName): string {
  return `/demo/events/${STATIONS_EVENT}/staff/roster${state == null ? '' : `?state=${state}`}`;
}

function link(state: RosterStateName): DemoLink {
  return { to: rosterAt(state), name: STATES[state]().name };
}

export const ROSTER_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The roster, and a person’s details',
    states: (
      [
        'populated',
        'empty',
        'nobodyOnShift',
        'nobodyOnShiftFrench',
        'details',
        'detailsShifts',
        'sectionRemoved',
        'sectionRemovedReadOnly',
        'readOnly',
        'finishedEvent',
        'finishedErased',
      ] as const
    ).map(link),
  },
  {
    name: 'Adding a person',
    states: (
      [
        'addBlank',
        'mobileTooShort',
        'mobileTooLong',
        'emailShape',
        'duplicateNumber',
        'added',
        'memberLinked',
        'actionFailed',
      ] as const
    ).map(link),
  },
  {
    name: 'Editing and removing',
    states: (
      ['edit', 'editJobOnShift', 'editDuplicateNumber', 'removeAsk', 'removeTwoShifts'] as const
    ).map(link),
  },
  {
    name: 'An event over 24 hours',
    states: (['longEvent', 'longEventRemove'] as const).map(link),
  },
  {
    name: 'A person’s own link (sc-3912)',
    states: (['linkCopied', 'linkNotIssued', 'linkRefused', 'replaceAsk', 'replaced'] as const).map(
      link,
    ),
  },
  {
    name: 'A desk window from 961 to 1279 px, an open person before the Roster (sc-73291)',
    states: (
      ['details', 'detailsFrench', 'add', 'addFrench', 'addEmpty', 'addEmptyFrench'] as const
    ).map(link),
  },
  {
    name: 'Whole words in the Link column at every desk width (sc-75033)',
    states: (
      [
        'populatedFrench',
        'detailsNoLink',
        'detailsNoLinkFrench',
        'erasedList',
        'erasedListFrench',
        'erasedDetailsFrench',
        'longWord',
      ] as const
    ).map(link),
  },
];
