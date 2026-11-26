import { SAMPLE_LINK } from '../briefing/briefingModel.ts';
import { SAMPLE } from '../samples.ts';

/** ShiftMessages-Phone: how a person on the staff receives S2 and S3, by push, SMS or WhatsApp (sc-4333's English copy). */
export type MessageKind =
  | 'start_time'
  | 'end_time'
  | 'job'
  | 'venue'
  | 'date'
  | 'several'
  | 'shift_added'
  | 'shift_removed'
  | 'shift_retimed'
  | 'no_shift_left'
  | 'removed'
  | 'called_off'
  | 'event_ended'
  | 'reminder';

export type Channel = 'push' | 'sms' | 'whatsApp';

export const MESSAGE_KINDS: readonly MessageKind[] = [
  'start_time',
  'end_time',
  'job',
  'venue',
  'date',
  'several',
  'shift_added',
  'shift_removed',
  'shift_retimed',
  'no_shift_left',
  'removed',
  'called_off',
  'event_ended',
  'reminder',
];

export const CHANNELS: readonly Channel[] = ['push', 'sms', 'whatsApp'];

export const KIND_NAMES: Record<MessageKind, string> = {
  start_time: 'Start time changed',
  end_time: 'End time changed',
  job: 'Job changed',
  venue: 'Venue changed',
  date: 'Date changed',
  several: 'Three changes in one message',
  shift_added: 'A shift added',
  shift_removed: 'A shift taken off',
  no_shift_left: 'The last shift taken off',
  shift_retimed: 'One of several shifts retimed',
  removed: 'Removed from the event',
  called_off: 'The event is called off',
  event_ended: 'The event has ended (End now)',
  reminder: 'The reminder the day before',
};

export const CHANNEL_NAMES: Record<Channel, string> = {
  push: 'Push',
  sms: 'SMS',
  whatsApp: 'WhatsApp',
};

const ORGANISATION = SAMPLE.organisation;
const EVENT = 'Adaeze & Tunde’s wedding';
const DATE = 'Saturday, Oct 17';
const NEW_DATE = 'Sunday, Oct 18';
/** End now on Friday, of the event Friday to Sunday: the date is the day their shift was to start. */
const ENDED_SHIFT_DATE = 'Sunday, Oct 18';
const START = '17:00';
const JOB = 'Waiter';
const VENUE = 'The Landmark';

type ChangeKey = 'start' | 'end' | 'job' | 'date' | 'venue';

const CHANGE: Record<
  ChangeKey,
  { now: string; was: string; line: (n: string, w: string) => string }
> = {
  start: {
    now: '15:00',
    was: START,
    line: (n, w) => `Your start time is now ${n} (was ${w}).`,
  },
  end: { now: '22:00', was: '23:00', line: (n, w) => `Your end time is now ${n} (was ${w}).` },
  job: { now: 'Runner', was: JOB, line: (n, w) => `Your job is now ${n} (was ${w}).` },
  date: { now: NEW_DATE, was: DATE, line: (n, w) => `The date is now ${n} (was ${w}).` },
  venue: {
    now: 'The Landmark',
    was: 'Eko Hotel',
    line: (n, w) => `The venue is now ${n} (was ${w}).`,
  },
};

const CHANGES: Partial<Record<MessageKind, readonly ChangeKey[]>> = {
  start_time: ['start'],
  end_time: ['end'],
  job: ['job'],
  venue: ['venue'],
  date: ['date'],
  several: ['start', 'job', 'venue'],
};

/** Bracketed until [en] writes them (#96276). */
const SHIFT = {
  added: (day: string, start: string, end: string) =>
    `[You are now also on ${day}, ${start} to ${end}.]`,
  removed: (day: string, start: string, end: string) =>
    `[You are no longer on ${day}, ${start} to ${end}.]`,
  retimed: (day: string, start: string, end: string, wasStart: string, wasEnd: string) =>
    `[Your shift on ${day} is now ${start} to ${end} (was ${wasStart} to ${wasEnd}).]`,
  none: '[You have no shift at this event for now. Your shift page still works.]',
};

const SHIFT_LINES: Partial<Record<MessageKind, readonly string[]>> = {
  shift_added: [SHIFT.added(NEW_DATE, '12:00', '18:00')],
  shift_removed: [SHIFT.removed(NEW_DATE, '12:00', '18:00')],
  shift_retimed: [SHIFT.retimed(NEW_DATE, '12:00', '17:00', '12:00', '18:00')],
  no_shift_left: [SHIFT.removed(DATE, START, '23:00'), SHIFT.none],
};

export interface Message {
  /** Push: the one line, then the lines it expands to. */
  title: string;
  lines: readonly string[];
  /** SMS and WhatsApp: the whole text. */
  text: string;
  /** SMS ends with the shift page's link; WhatsApp has My shift in its place. Removal, call-off and End now carry neither. */
  link: string | null;
  button: string | null;
}

export const MY_SHIFT = 'My shift';
const SHIFT_PAGE = (link: string) => `Your shift page: ${link}`;

/** The order of the change lines is the copy's: start, end, job, date, venue. */
const ORDER: readonly ChangeKey[] = ['start', 'end', 'job', 'date', 'venue'];

function changeLines(kind: MessageKind): string[] {
  const keys = CHANGES[kind] ?? [];

  return ORDER.filter((key) => keys.includes(key)).map((key) =>
    CHANGE[key].line(CHANGE[key].now, CHANGE[key].was),
  );
}

export function messageOf(kind: MessageKind, channel: Channel): Message {
  const button = channel === 'whatsApp' ? MY_SHIFT : null;
  const withLink = (words: string) =>
    channel === 'sms' ? `${words} ${SHIFT_PAGE(SAMPLE_LINK)}` : words;
  const closing = (title: string, lines: readonly string[], text: string): Message => ({
    title,
    lines,
    text,
    link: null,
    button: null,
  });

  if (kind === 'removed')
    return closing(
      `You are no longer on the staff for ${EVENT} on ${DATE}`,
      [],
      `${ORGANISATION}: you are no longer on the staff for ${EVENT} on ${DATE}.`,
    );
  if (kind === 'called_off')
    return closing(
      `Your shift is called off · ${EVENT}`,
      [`The event on ${DATE} will not go ahead. You do not need to come.`],
      `${ORGANISATION}: ${EVENT} on ${DATE} will not go ahead, so your shift is called off. You do not need to come.`,
    );
  if (kind === 'event_ended')
    return closing(
      `The event has ended · ${EVENT}`,
      ['It ended before your shift, so you do not need to come.'],
      `${ORGANISATION}: ${EVENT} has ended, so your shift on ${ENDED_SHIFT_DATE} will not take place. You do not need to come.`,
    );
  if (kind === 'reminder')
    return {
      title: `Your shift starts ${DATE} at ${START} · ${EVENT}`,
      lines: [`${JOB} at ${VENUE}.`],
      text: withLink(
        `${ORGANISATION}: your shift at ${EVENT} starts on ${DATE} at ${START}, at ${VENUE}. Job: ${JOB}.`,
      ),
      link: channel === 'sms' ? SAMPLE_LINK : null,
      button,
    };

  const lines = SHIFT_LINES[kind] ?? changeLines(kind);
  const on = kind === 'date' ? NEW_DATE : DATE;

  return {
    title: `Your shift has changed · ${EVENT}`,
    lines,
    text: withLink(
      [`${ORGANISATION}: your shift at ${EVENT} on ${on} has changed.`, ...lines].join(' '),
    ),
    link: channel === 'sms' ? SAMPLE_LINK : null,
    button,
  };
}

/** A push inside 24 hours of the start is time-sensitive on iOS and goes on Android's Event day channel at high importance. */
export const CATEGORY = 'Event day';
export const TIME_SENSITIVE = 'Time Sensitive';

export function messageKindOf(raw: string | null | undefined): MessageKind {
  return MESSAGE_KINDS.find((one) => one === raw) ?? 'start_time';
}

export function channelOf(raw: string | null | undefined): Channel {
  return CHANNELS.find((one) => one === raw) ?? 'push';
}

export const SHIFT_MESSAGE_BOARDS = MESSAGE_KINDS.flatMap((kind) =>
  [
    { channel: 'push' as const, urgent: false },
    { channel: 'push' as const, urgent: true },
    { channel: 'sms' as const, urgent: false },
    { channel: 'whatsApp' as const, urgent: false },
  ].map(({ channel, urgent }) => {
    const message = messageOf(kind, channel);

    return {
      title: `${KIND_NAMES[kind]} · ${CHANNEL_NAMES[channel]}${urgent ? ', inside 24 hours' : ''}`,
      what: channel === 'push' ? message.title : message.text,
      href: `/demo/shift-messages?kind=${kind}&channel=${channel}${urgent ? '&urgent=1' : ''}`,
    };
  }),
);
