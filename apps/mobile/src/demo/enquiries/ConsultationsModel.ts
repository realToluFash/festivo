import {
  formatEventClock,
  formatWallClock,
  formatWallDay,
  namesZone,
  savedWallClock,
  skippedTime,
  wallDay,
} from '@soirely/domain';

import { t } from '../events/EventsWords.ts';
import { ENQUIRIES, type Enquiry, NOW, PEOPLE, type Person } from './EnquiriesModel.ts';

export const READER_ZONE = 'Europe/London';

export const LENGTHS = [15, 30, 45, 60, 90, 120] as const;
export type Length = (typeof LENGTHS)[number];
export const DEFAULT_LENGTH: Length = 60;

export const HOWS = ['inPerson', 'video', 'phone'] as const;
export type How = (typeof HOWS)[number];

export const WHERE_MOST = 200;

export interface Consultation {
  id: string;
  startsAt: string;
  timeZone: string;
  minutes: Length;
  how: How;
  where: string | null;
  link: string | null;
  ledBy: string | null;
  cancelled: boolean;
}

/** Held from its start (pm, 18 Nov); Next is the earliest one not started and not cancelled. */
export type Standing = 'next' | 'booked' | 'held' | 'cancelled';

export function earliestFirst(list: readonly Consultation[]): Consultation[] {
  return [...list].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function started(consultation: Consultation, now: string = NOW): boolean {
  return Date.parse(consultation.startsAt) <= Date.parse(now);
}

export function nextOf(list: readonly Consultation[], now: string = NOW): Consultation | null {
  return earliestFirst(list).find((one) => !one.cancelled && !started(one, now)) ?? null;
}

export function standingOf(
  consultation: Consultation,
  list: readonly Consultation[],
  now: string = NOW,
): Standing {
  if (consultation.cancelled) return 'cancelled';
  if (started(consultation, now)) return 'held';

  return nextOf(list, now)?.id === consultation.id ? 'next' : 'booked';
}

export function changeable(consultation: Consultation, now: string = NOW): boolean {
  return !consultation.cancelled && !started(consultation, now);
}

export function cancelledByLost(list: readonly Consultation[], now: string = NOW): number {
  return list.filter((one) => changeable(one, now)).length;
}

export function endOf(consultation: Consultation): string {
  return new Date(Date.parse(consultation.startsAt) + consultation.minutes * 60_000).toISOString();
}

export function dayWords(consultation: Consultation, locale: string): string {
  return formatWallDay(wallDay(consultation.startsAt, consultation.timeZone), locale);
}

export function timesWords(
  consultation: Consultation,
  locale: string,
  readerZone: string = READER_ZONE,
): string {
  const range = `${formatEventClock(consultation.startsAt, consultation.timeZone, locale)}–${formatEventClock(endOf(consultation), consultation.timeZone, locale)}`;

  return namesZone(consultation.timeZone, readerZone) ? `${range} ${consultation.timeZone}` : range;
}

export function relativeWords(
  consultation: Consultation,
  locale: string,
  now: string = NOW,
  readerZone: string = READER_ZONE,
): string {
  const day = wallDay(consultation.startsAt, readerZone);
  const today = wallDay(now, readerZone);
  const days = Math.round(
    (Date.parse(`${day}T00:00Z`) - Date.parse(`${today}T00:00Z`)) / 86_400_000,
  );
  const time = formatEventClock(consultation.startsAt, readerZone, locale);
  const noon = new Date(`${day}T12:00Z`);

  if (days <= 0) return CW.openToday(time);
  if (days === 1) return CW.openTomorrow(time);
  if (days < 7)
    return CW.openWeekday(
      new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(noon),
      time,
    );

  return CW.openDate(
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(noon),
    time,
  );
}

export function leaderOf(consultation: Consultation): Person | null {
  return Object.values(PEOPLE).find((one) => one.id === consultation.ledBy) ?? null;
}

const DAY = 86_400_000;

/** Turns a wall clock in a zone into the instant it names: a skipped time moves past the jump, a repeated one is the first. */
export function instantOf(date: string, time: string, timeZone: string): string | null {
  const saved = savedWallClock(date, time, timeZone);

  if (saved == null) return null;

  const wall = Date.parse(`${saved}Z`);
  const offsets = [wall - DAY, wall + DAY].map((at) => offsetAt(at, timeZone));
  const fits = offsets
    .map((offset) => wall - offset)
    .filter((instant) => wall === instant + offsetAt(instant, timeZone));

  return fits.length === 0 ? null : new Date(Math.min(...fits)).toISOString();
}

function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '00';
  const wall = Date.parse(
    `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}Z`,
  );

  return wall - Math.floor(instant / 60_000) * 60_000;
}

export interface Draft {
  date: string;
  time: string;
  timeZone: string;
  minutes: Length;
  how: How;
  where: string;
  link: string;
  ledBy: string | null;
}

export type Field = 'date' | 'time' | 'where' | 'link' | 'ledBy';

export const FIELD_ORDER: readonly Field[] = ['date', 'time', 'where', 'link', 'ledBy'];

/** What the form refuses before it sends. The past check runs only once the date, time or zone has been set or changed. */
export function problemsOf(
  draft: Draft,
  startTouched: boolean,
  now: string = NOW,
  choosesLeader: boolean = true,
): Partial<Record<Field, string>> {
  const problems: Partial<Record<Field, string>> = {};

  if (draft.date === '') problems.date = CW.dateMissing;
  if (draft.time === '') problems.time = CW.timeMissing;
  if (startTouched && problems.date == null && problems.time == null) {
    const at = instantOf(draft.date, draft.time, draft.timeZone);

    if (at != null && Date.parse(at) <= Date.parse(now)) problems.time = CW.passed;
  }
  if (draft.how === 'inPerson' && [...draft.where.trim()].length > WHERE_MOST)
    problems.where = CW.whereTooLong;
  if (draft.how === 'video' && draft.link.trim() !== '' && !isHttps(draft.link))
    problems.link = CW.linkNotHttps;
  if (choosesLeader && draft.ledBy == null) problems.ledBy = CW.ledByMissing;

  return problems;
}

export function isHttps(typed: string): boolean {
  try {
    const url = new URL(typed.trim());

    return url.protocol === 'https:' && url.hostname.includes('.');
  } catch {
    return false;
  }
}

export function skipWords(draft: Draft, locale: string): string | null {
  const skipped = skippedTime(draft.date, draft.time, draft.timeZone);

  return skipped == null
    ? null
    : CW.clocksSkip(
        formatWallClock(draft.time, locale),
        formatWallDay(draft.date, locale),
        draft.timeZone,
        formatWallClock(skipped.savedAs, locale),
      );
}

export function draftOf(
  consultation: Consultation | null,
  enquiry: Enquiry,
  viewer: Person,
): Draft {
  if (consultation != null)
    return {
      date: wallDay(consultation.startsAt, consultation.timeZone),
      time: formatEventClock(consultation.startsAt, consultation.timeZone, 'en-GB'),
      timeZone: consultation.timeZone,
      minutes: consultation.minutes,
      how: consultation.how,
      where: consultation.where ?? '',
      link: consultation.link ?? '',
      ledBy: consultation.ledBy,
    };

  return {
    date: '',
    time: '',
    timeZone: READER_ZONE,
    minutes: DEFAULT_LENGTH,
    how: 'inPerson',
    where: '',
    link: '',
    ledBy: viewer.role === 'member' ? viewer.id : enquiry.assignedTo,
  };
}

export function consultationOf(draft: Draft, id: string): Consultation | null {
  const startsAt = instantOf(draft.date, draft.time, draft.timeZone);

  return startsAt == null
    ? null
    : {
        id,
        startsAt,
        timeZone: draft.timeZone,
        minutes: draft.minutes,
        how: draft.how,
        where: draft.how === 'inPerson' && draft.where.trim() !== '' ? draft.where.trim() : null,
        link: draft.how === 'video' && draft.link.trim() !== '' ? draft.link.trim() : null,
        ledBy: draft.ledBy,
        cancelled: false,
      };
}

/** What a Member reads in Led by: they lead what they book, and a change keeps whoever leads it. */
export function fixedLeaderWords(draft: Draft, viewer: Person): string {
  if (draft.ledBy === viewer.id) return CW.ledByYou(viewer.name);

  return Object.values(PEOPLE).find((one) => one.id === draft.ledBy)?.name ?? CW.nobodyLeading;
}

/** Who may book, change and cancel: whoever may edit the enquiry. A Member who only leads one reads the page. */
export function mayEdit(enquiry: Enquiry, viewer: Person): boolean {
  return viewer.role !== 'member' || enquiry.assignedTo === viewer.id;
}

export const CW = {
  consultations: 'Consultations',
  book: 'Book a consultation',
  bookTitle: 'Book a consultation',
  changeTitle: 'Change consultation',
  bookIt: 'Book consultation',
  booking: 'Booking…',
  saveChanges: 'Save changes',
  saving: 'Saving…',
  cancel: 'Cancel',
  change: 'Change',
  cancelConsultation: 'Cancel consultation…',
  cancelIt: 'Cancel consultation',
  keepIt: 'Keep it booked',
  cancelTitle: 'Cancel this consultation?',
  cancelLine: (day: string, time: string) =>
    `${day}, ${time}. It stays on the enquiry, marked Cancelled. If someone else leads it, they are told.`,
  none: 'No consultations booked.',
  noneLine: 'Book one once you and the client agree a time.',
  next: 'Next',
  held: 'Held',
  cancelled: 'Cancelled',
  ledBy: (name: string) => `Led by ${name}`,
  nobodyLeading: 'Nobody leading',
  nobodyLine: 'Whoever led it has left the organisation. Use Change to choose who leads it.',
  how: { inPerson: 'In person', video: 'Video call', phone: 'Phone call' } satisfies Record<
    How,
    string
  >,
  readOnly: (assignee: string) =>
    `You lead a consultation on this enquiry, so you can read it. It is assigned to ${assignee}: only they, owners and admins can change it.`,
  readOnlyNobody:
    'You lead a consultation on this enquiry, so you can read it. Only owners and admins can change it.',
  date: 'Date',
  startTime: 'Start time',
  length: 'Length',
  lengths: {
    15: '15 minutes',
    30: '30 minutes',
    45: '45 minutes',
    60: '1 hour',
    90: '1 hour 30 minutes',
    120: '2 hours',
  } satisfies Record<Length, string>,
  timeZone: 'Time zone',
  howLabel: 'How',
  where: 'Where',
  whereHint: 'A place or an address.',
  link: 'Link',
  linkHint: 'The link to the video call, starting https://',
  phoneNothing: 'Nothing more to add: whoever leads it calls the client.',
  optional: 'Optional',
  ledByLabel: 'Led by',
  ledByYou: (name: string) => `You, ${name}`,
  ledByMemberLine: 'You lead the consultations you book.',
  ledByKeptLine: 'Only owners and admins can change who leads it.',
  chooseLeader: 'Choose who leads it',
  dateMissing: 'Choose the date it starts.',
  timeMissing: 'Choose the time it starts.',
  passed: 'That time has passed.',
  whereTooLong: `Shorten the location to ${WHERE_MOST} characters or fewer.`,
  linkNotHttps: 'Enter a link that starts with https://',
  ledByMissing: 'Choose who leads it.',
  count: (typed: number) => `${typed} / ${WHERE_MOST}`,
  clocksSkip: (time: string, day: string, zone: string, savedAs: string) =>
    t('eventForm.clocksSkip', { time, day, zone, savedAs }),
  notBooked: 'Not booked. Nothing was saved. Try again.',
  notSaved: 'Not saved. Your changes are still here. Try again.',
  notCancelled: 'Not cancelled. It is still booked. Try again.',
  tryAgain: 'Try again',
  booked: 'Consultation booked.',
  changed: 'Consultation changed.',
  cancelledSaid: 'Consultation cancelled.',
  openToday: (time: string) => `Consultation today at ${time}`,
  openTomorrow: (time: string) => `Consultation tomorrow at ${time}`,
  openWeekday: (day: string, time: string) => `Consultation on ${day} at ${time}`,
  openDate: (date: string, time: string) => `Consultation on ${date} at ${time}`,
  closeLostCancels: (count: number) =>
    count === 1
      ? 'It will cancel 1 consultation that has not started.'
      : `It will cancel ${count} consultations that have not started.`,
  calendarWord: 'Consultation',
  calendarLine: (client: string) => `Consultation · ${client}`,
  feedLine: 'Consultations you can see: their time, place or link, and a link back to the enquiry',
  feedNever: 'Client names',
  enquiriesCategory: 'Enquiries',
  enquiriesNote: 'Consultations given to you, and a reminder before each one starts.',
  given: (person: string, client: string, when: string) =>
    `${person} gave you a consultation to lead: ${client}, ${when}`,
  moved: (person: string, client: string, when: string) =>
    `${person} moved the consultation with ${client} to ${when}`,
  cancelledBy: (person: string, client: string, when: string) =>
    `${person} cancelled the consultation with ${client} on ${when}`,
  reminder: (client: string, time: string) => `Consultation with ${client} at ${time}`,
  demoPage:
    'The rest of the enquiry’s page is sc-31226’s (branch ux/sc-31226-enquiry). Consultations sits on it after Assigned to.',
} as const;

const AT = (iso: string) => `${iso}:00Z`;

export const SAMPLE = {
  next: {
    id: 'con-next',
    startsAt: AT('2026-11-19T14:30'),
    timeZone: READER_ZONE,
    minutes: 60,
    how: 'video',
    where: null,
    link: 'https://meet.example.com/lucia-fernandez',
    ledBy: 'kemi',
    cancelled: false,
  },
  later: {
    id: 'con-later',
    startsAt: AT('2026-11-24T11:00'),
    timeZone: READER_ZONE,
    minutes: 90,
    how: 'inPerson',
    where: 'Ire Events, 12 Marylebone Lane, London W1U 2NE',
    link: null,
    ledBy: 'kemi',
    cancelled: false,
  },
  underWay: {
    id: 'con-under-way',
    startsAt: AT('2026-11-18T09:30'),
    timeZone: READER_ZONE,
    minutes: 60,
    how: 'phone',
    where: null,
    link: null,
    ledBy: 'kemi',
    cancelled: false,
  },
  called: {
    id: 'con-called',
    startsAt: AT('2026-11-19T11:00'),
    timeZone: READER_ZONE,
    minutes: 30,
    how: 'video',
    where: null,
    link: 'https://meet.example.com/lucia-11',
    ledBy: 'kemi',
    cancelled: true,
  },
  madrid: {
    id: 'con-madrid',
    startsAt: AT('2026-11-26T08:00'),
    timeZone: 'Europe/Madrid',
    minutes: 45,
    how: 'inPerson',
    where: 'Hotel Urban, Carrera de San Jerónimo 34, Madrid',
    link: null,
    ledBy: 'kemi',
    cancelled: false,
  },
} as const satisfies Record<string, Consultation>;

export const LIST_SAMPLE: Readonly<Record<string, readonly Consultation[]>> = {
  'enq-lucia': [SAMPLE.next, SAMPLE.later],
  'enq-femi': [
    { ...SAMPLE.later, id: 'con-femi', startsAt: AT('2026-11-23T17:00'), ledBy: 'tunde' },
  ],
  'enq-bisi': [{ ...SAMPLE.underWay, id: 'con-bisi', startsAt: AT('2026-11-12T15:00') }],
  'enq-ada': [{ ...SAMPLE.called, id: 'con-ada', startsAt: AT('2026-11-20T10:00') }],
};

export function nextFor(enquiry: Enquiry, now: string = NOW): Consultation | null {
  return nextOf(LIST_SAMPLE[enquiry.id] ?? [], now);
}

export function openOrder(
  open: readonly Enquiry[],
  next: (enquiry: Enquiry) => Consultation | null,
): Enquiry[] {
  const at = (enquiry: Enquiry) => {
    const one = next(enquiry);

    return one == null ? null : Date.parse(one.startsAt);
  };

  return [...open].sort((a, b) => {
    const [first, second] = [at(a), at(b)];

    if (first != null && second != null) return first - second;
    if (first != null) return -1;
    if (second != null) return 1;

    return b.changedAt.localeCompare(a.changedAt);
  });
}

export const CONSULTATION_STATES = [
  'none',
  'upcoming',
  'mixed',
  'nobodyLeading',
  'leaderReadOnly',
  'otherZone',
  'longNames',
  'ownerBooking',
  'ownerNotAssigned',
  'memberBooking',
  'howInPerson',
  'howVideo',
  'howPhone',
  'change',
  'pastRefused',
  'linkRefused',
  'whereTooLong',
  'clocksSkip',
  'saving',
  'failed',
  'cancelConfirm',
  'closeLostCount',
  'closeLostOne',
  'calendarEventsAndMilestones',
  'calendarAgenda',
  'calendarEventsOnly',
  'freeOrg',
  'notifications',
  'feed',
] as const;

export type ConsultationState = (typeof CONSULTATION_STATES)[number];

export function consultationStateOf(value: string | null | undefined): ConsultationState {
  return CONSULTATION_STATES.find((state) => state === value) ?? 'upcoming';
}

export type Panel =
  | { kind: 'none' }
  | { kind: 'book'; change: Consultation | null; draft: Draft; touched: boolean; pressed: boolean }
  | { kind: 'cancel'; consultation: Consultation }
  | { kind: 'closeLost' };

export type Save = 'idle' | 'saving' | 'failed';

export interface ConsultationStart {
  enquiry: Enquiry;
  viewer: Person;
  list: Consultation[];
  panel: Panel;
  save: Save;
  view: 'page' | 'calendar' | 'notifications' | 'feed';
  calendar: { view: 'month' | 'agenda'; show: 'all' | 'events'; free: boolean };
}

const LUCIA = ENQUIRIES.find((one) => one.id === 'enq-lucia')!;
const CHINEDU = ENQUIRIES.find((one) => one.id === 'enq-chinedu')!;
const LONG = ENQUIRIES.find((one) => one.id === 'enq-long')!;

function booking(
  start: ConsultationStart,
  patch: Partial<Draft>,
  touched = false,
  pressed = false,
): ConsultationStart {
  return {
    ...start,
    panel: {
      kind: 'book',
      change: null,
      draft: { ...draftOf(null, start.enquiry, start.viewer), ...patch },
      touched,
      pressed,
    },
  };
}

export function consultationStart(state: ConsultationState): ConsultationStart {
  const start: ConsultationStart = {
    enquiry: LUCIA,
    viewer: PEOPLE.folake,
    list: [SAMPLE.next, SAMPLE.later],
    panel: { kind: 'none' },
    save: 'idle',
    view: 'page',
    calendar: { view: 'month', show: 'all', free: false },
  };
  const filled = { date: '2026-11-25', time: '15:00' };

  switch (state) {
    case 'none':
      return { ...start, list: [] };
    case 'mixed':
      return { ...start, list: [SAMPLE.underWay, SAMPLE.called, SAMPLE.next] };
    case 'nobodyLeading':
      return { ...start, list: [{ ...SAMPLE.next, ledBy: null }, SAMPLE.later] };
    case 'leaderReadOnly':
      return {
        ...start,
        viewer: PEOPLE.tunde,
        list: [{ ...SAMPLE.next, ledBy: 'tunde' }, SAMPLE.later],
      };
    case 'otherZone':
      return { ...start, list: [SAMPLE.next, SAMPLE.madrid] };
    case 'longNames':
      return {
        ...start,
        enquiry: LONG,
        list: [
          { ...SAMPLE.next, where: null },
          {
            ...SAMPLE.later,
            where: 'Château de Chantilly, 7 Rue Connétable, 60500 Chantilly, France',
          },
        ],
      };
    case 'ownerBooking':
      return booking(start, {});
    case 'ownerNotAssigned':
      return booking({ ...start, enquiry: CHINEDU, list: [] }, {});
    case 'memberBooking':
      return booking(
        { ...start, viewer: PEOPLE.tunde, enquiry: { ...LUCIA, assignedTo: 'tunde' } },
        {},
      );
    case 'howInPerson':
      return booking(start, { ...filled, where: 'Ire Events, 12 Marylebone Lane, London' });
    case 'howVideo':
      return booking(start, { ...filled, how: 'video', link: 'https://meet.example.com/lucia' });
    case 'howPhone':
      return booking(start, { ...filled, how: 'phone' });
    case 'change':
      return {
        ...start,
        panel: {
          kind: 'book',
          change: SAMPLE.next,
          draft: draftOf(SAMPLE.next, LUCIA, PEOPLE.folake),
          touched: false,
          pressed: false,
        },
      };
    case 'pastRefused':
      return booking(start, { date: '2026-11-18', time: '09:00' }, true, true);
    case 'linkRefused':
      return booking(
        start,
        { ...filled, how: 'video', link: 'meet.example.com/lucia' },
        true,
        true,
      );
    case 'whereTooLong':
      return booking(
        start,
        {
          ...filled,
          where:
            'Ire Events, the meeting room on the second floor at the back of the building, 12 Marylebone Lane, London W1U 2NE. Ring the bell marked Ire and someone will come down to let you in; parking is on Wigmore Street.',
        },
        true,
        true,
      );
    case 'clocksSkip':
      return booking(start, { date: '2027-03-28', time: '01:30' }, true);
    case 'saving':
      return { ...booking(start, { ...filled, how: 'phone' }, true), save: 'saving' };
    case 'failed':
      return { ...booking(start, { ...filled, how: 'phone' }, true), save: 'failed' };
    case 'cancelConfirm':
      return { ...start, panel: { kind: 'cancel', consultation: SAMPLE.next } };
    case 'closeLostCount':
      return {
        ...start,
        list: [SAMPLE.underWay, SAMPLE.next, SAMPLE.later],
        panel: { kind: 'closeLost' },
      };
    case 'closeLostOne':
      return { ...start, list: [SAMPLE.underWay, SAMPLE.next], panel: { kind: 'closeLost' } };
    case 'calendarEventsAndMilestones':
      return { ...start, view: 'calendar' };
    case 'calendarAgenda':
      return { ...start, view: 'calendar', calendar: { ...start.calendar, view: 'agenda' } };
    case 'calendarEventsOnly':
      return { ...start, view: 'calendar', calendar: { ...start.calendar, show: 'events' } };
    case 'freeOrg':
      return { ...start, view: 'calendar', calendar: { ...start.calendar, free: true } };
    case 'notifications':
      return { ...start, view: 'notifications' };
    case 'feed':
      return { ...start, view: 'feed' };
    default:
      return start;
  }
}

function at(state: ConsultationState, title: string, what: string) {
  return { title, what, href: `/demo/consultations?state=${state}` };
}

export const CONSULTATION_BOARDS: readonly { title: string; what: string; href: string }[] = [
  at('none', 'Consultations · none', 'None yet, with Book a consultation'),
  at('upcoming', 'Consultations · two booked', 'The first Next, Change and Cancel on each'),
  at('mixed', 'Consultations · mixed', 'Held (under way), Cancelled, then Next'),
  at('nobodyLeading', 'Consultations · Nobody leading', 'An Owner sees who led it has left'),
  at('leaderReadOnly', 'Consultations · read only', 'A Member who leads one, not assigned'),
  at('otherZone', 'Consultations · another zone', 'One in Madrid, its zone named'),
  at('longNames', 'Consultations · long names', 'A long client’s name and place'),
  at('ownerBooking', 'Book · an Owner', 'Led by defaults to Assigned to'),
  at('ownerNotAssigned', 'Book · not assigned', 'Led by empty and required'),
  at('memberBooking', 'Book · a Member', 'Led by is themselves'),
  at('howInPerson', 'Book · In person', 'Where, up to 200 characters'),
  at('howVideo', 'Book · Video call', 'Link, https only'),
  at('howPhone', 'Book · Phone call', 'Nothing more to add'),
  at('change', 'Change consultation', 'The form with its values, Save changes'),
  at('pastRefused', 'Book · a past time', 'That time has passed.'),
  at('linkRefused', 'Book · not https', 'The link refused, every value kept'),
  at('whereTooLong', 'Book · Where too long', 'Where over 200 characters'),
  at('clocksSkip', 'Book · the clocks skip', 'New event’s line: saved as 02:30'),
  at('saving', 'Book · booking', 'Booking… while it sends'),
  at('failed', 'Book · not booked', 'Not booked, with Try again'),
  at('cancelConfirm', 'Cancel consultation', 'Cancel this consultation?'),
  at(
    'closeLostCount',
    'Close as lost · 2',
    'It will cancel 2 consultations that have not started.',
  ),
  at('closeLostOne', 'Close as lost · 1', 'It will cancel 1 consultation that has not started.'),
  at('calendarEventsAndMilestones', 'Calendar · a consultation', 'Beside an event and a milestone'),
  at('calendarAgenda', 'Calendar · Agenda', 'The consultation’s row in Agenda'),
  at('calendarEventsOnly', 'Calendar · Events only', 'No consultations'),
  at('freeOrg', 'Calendar · a Free organisation', 'No consultations'),
  at('notifications', 'Notification settings · Enquiries', 'Push and email, on'),
  at('feed', 'Subscribe · What’s in it', 'Consultations, without the client’s name'),
];
