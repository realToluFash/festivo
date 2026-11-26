import { notThisYear } from './eventsHome.ts';
import { hostsLine } from './hosts.ts';
import { visibleLength } from './visibleText.ts';

/** The API's MessageTokens marks (sc-3960): a token travels as its name between the two, so braces a host types stay text. */
export const TOKEN_OPEN = '';
export const TOKEN_CLOSE = '';

/** The token registry, in Insert's order; another epic adds its token here and to the API's MessageTokens. */
export const INSERTABLE_TOKENS = ['greeting', 'event', 'date', 'hosts'] as const;

export type MessageToken = (typeof INSERTABLE_TOKENS)[number];

export type MessageSegment =
  { kind: 'text'; text: string } | { kind: 'token'; token: MessageToken };

export const GREET_AS_MAXIMUM = 60;

const MARKS = /[]/gu;
const WIRE = /([a-z]+)/gu;

function isToken(name: string): name is MessageToken {
  return (INSERTABLE_TOKENS as readonly string[]).includes(name);
}

export function messageSegments(wire: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let from = 0;

  const text = (words: string) => {
    const kept = words.replaceAll(MARKS, '');
    const last = segments.at(-1);

    if (kept === '') return;
    if (last?.kind === 'text') last.text += kept;
    else segments.push({ kind: 'text', text: kept });
  };

  for (const match of wire.matchAll(WIRE)) {
    const name = match[1] ?? '';

    text(wire.slice(from, match.index));
    if (isToken(name)) segments.push({ kind: 'token', token: name });
    from = match.index + match[0].length;
  }

  text(wire.slice(from));

  return segments;
}

/** What Send carries: typed text with any stray mark taken out, so only Insert makes a token. */
export function messageWire(segments: readonly MessageSegment[]): string {
  return segments
    .map((segment) =>
      segment.kind === 'token'
        ? `${TOKEN_OPEN}${segment.token}${TOKEN_CLOSE}`
        : segment.text.replaceAll(MARKS, ''),
    )
    .join('');
}

export function tokensInOrder(segments: readonly MessageSegment[]): MessageToken[] {
  const seen: MessageToken[] = [];

  for (const segment of segments) {
    if (segment.kind === 'token' && !seen.includes(segment.token)) seen.push(segment.token);
  }

  return seen;
}

export function hasTokens(segments: readonly MessageSegment[]): boolean {
  return segments.some((segment) => segment.kind === 'token');
}

export function hasTypedBraces(segments: readonly MessageSegment[]): boolean {
  return segments.some((segment) => segment.kind === 'text' && /[{}]/u.test(segment.text));
}

export function greetAsLength(typed: string): number {
  return visibleLength(typed.trim());
}

/** {greeting}: their Greet as, or their full name when they have none. */
export function greetingOf(guest: { fullName: string | null; greetAs?: string | null }): string {
  const greetAs = guest.greetAs?.trim() ?? '';

  return greetAs === '' ? (guest.fullName ?? '') : greetAs;
}

const DATE_FIELDS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
};

/** {date}: the event's day, or CLDR's range of its days, in its own zone with no time; with the year when its first day is not in the year it is sent. */
export function tokenDate(
  event: { startsAt: string; endsAt: string; timeZone: string },
  locale: string,
  sentAt: Date,
): string {
  const { startsAt, endsAt, timeZone } = event;
  const format = new Intl.DateTimeFormat(locale, {
    ...DATE_FIELDS,
    ...(notThisYear(timeZone, sentAt, startsAt) ? { year: 'numeric' } : {}),
    timeZone,
  });
  const day = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone });
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (day.format(start) === day.format(end)) return format.format(start);

  // Hermes has no formatRange; the guest's page and the web do.
  return typeof format.formatRange === 'function'
    ? format.formatRange(start, end)
    : `${format.format(start)} – ${format.format(end)}`;
}

export interface TokenValues {
  greeting: string;
  event: string;
  date: string;
  hosts: string;
}

export function tokenValues(
  guest: { fullName: string | null; greetAs?: string | null },
  event: {
    name: string;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    hosts: readonly string[];
  },
  locale: string,
  sentAt: Date,
): TokenValues {
  return {
    greeting: greetingOf(guest),
    event: event.name,
    date: tokenDate(event, locale, sentAt),
    hosts: hostsLine(event.hosts, locale),
  };
}

/** The message filled in for one guest, as their page shows it: plain text, for the page to escape as it shows any text. */
export function fillMessage(segments: readonly MessageSegment[], values: TokenValues): string {
  return segments
    .map((segment) => (segment.kind === 'token' ? values[segment.token] : segment.text))
    .join('');
}
