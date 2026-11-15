import { formatEventWeekday } from './datetime.ts';
import type { EventState } from './eventStates.ts';
import { eventDayWords, notThisYear } from './eventsHome.ts';
import { roleName } from './organisations.ts';

/** The sidebar's Search (sc-39534): what both clients show of an answer, worded through the `search` keys each app carries. */

type Word = (key: string, values?: Record<string, unknown>) => string;

export interface SearchReachOf {
  events: boolean;
  guests: boolean;
  members: boolean;
}

export const SEARCH_SHOWN = 5;

/** One whole sentence for each combination of kinds, never assembled; a person who can find nothing gets "Search" and no hint. */
export function searchFieldKeys(reach: SearchReachOf): {
  placeholder: string;
  hint: string | null;
} {
  const kinds = `${reach.events ? 'e' : ''}${reach.guests ? 'g' : ''}${reach.members ? 'm' : ''}`;

  return kinds === ''
    ? { placeholder: 'search.row', hint: null }
    : { placeholder: `search.field.${kinds}`, hint: `search.hint.${kinds}` };
}

interface FoundEvent {
  id: string;
  name: string;
  status: EventState;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  concludedAt: string | null;
  venue: { name: string | null; address: { city?: string | null } | null } | null;
}

interface FoundGuest {
  id: string;
  name: string;
  event: { id: string; name: string; startsAt: string; timeZone: string };
}

interface FoundMember {
  id: string;
  kind: 'member' | 'invitation';
  name: string | null;
  email: string | null;
  role: { seededAs: string | null; name: string | null } | null;
  status: 'active' | 'suspended' | 'pending_approval' | 'invited';
}

interface Kind<Match> {
  total: number;
  matches: readonly Match[];
}

export interface SearchAnswer {
  events: Kind<FoundEvent> | null;
  guests: Kind<FoundGuest> | null;
  members: Kind<FoundMember> | null;
}

export type SearchStanding = 'invited' | 'pending_approval' | 'suspended';

/** A match as a row: `event` is the event a guest is on, `standing` a member's when they are not Active. */
export type SearchRow =
  | { kind: 'event'; id: string; name: string; line: string }
  | { kind: 'guest'; id: string; name: string; line: string; event: string }
  | {
      kind: 'member';
      id: string;
      name: string;
      line: string;
      standing: SearchStanding | null;
      invitation: boolean;
    };

export type SearchGroupKey = 'events' | 'guests' | 'members';

/** `total` is the server's count of every match; past the five shown, only Events offers Show all. */
export interface SearchGroup {
  key: SearchGroupKey;
  total: number;
  rows: SearchRow[];
  more: boolean;
}

/** Events, Guests and Members in that order, each only when it has a match. */
export function searchGroups(
  answer: SearchAnswer,
  word: Word,
  now: Date,
  locale: string,
): SearchGroup[] {
  const groups: SearchGroup[] = [];

  if (answer.events != null) {
    groups.push({
      key: 'events',
      total: answer.events.total,
      rows: answer.events.matches.map((event) => ({
        kind: 'event',
        id: event.id,
        name: event.name,
        line: eventLine(event, word, now, locale),
      })),
      more: answer.events.total > SEARCH_SHOWN,
    });
  }

  if (answer.guests != null) {
    groups.push({
      key: 'guests',
      total: answer.guests.total,
      rows: answer.guests.matches.map((guest) => ({
        kind: 'guest',
        id: guest.id,
        name: guest.name,
        line: word('search.line.guest', {
          event: guest.event.name,
          day: formatEventWeekday(
            guest.event.startsAt,
            guest.event.timeZone,
            locale,
            notThisYear(guest.event.timeZone, now, guest.event.startsAt),
          ),
        }),
        event: guest.event.id,
      })),
      more: false,
    });
  }

  if (answer.members != null) {
    groups.push({
      key: 'members',
      total: answer.members.total,
      rows: answer.members.matches.map((member) => memberRow(member, word)),
      more: false,
    });
  }

  return groups.filter((group) => group.rows.length > 0);
}

/** The count a screen reader hears as matches arrive: every match, not only the rows shown. */
export function searchTotal(groups: readonly SearchGroup[]): number {
  return groups.reduce((total, group) => total + group.total, 0);
}

function eventLine(event: FoundEvent, word: Word, now: Date, locale: string): string {
  const days = eventDayWords(event, now, locale);
  const dates =
    days.kind === 'oneDay'
      ? days.day
      : days.kind === 'days'
        ? word('search.line.days', { first: days.first, last: days.last })
        : word('search.line.calledOffOn', { date: days.date });
  const venue = event.venue?.name ?? null;
  const city = event.venue?.address?.city ?? null;
  const place =
    venue != null && city != null && city !== ''
      ? word('search.line.venueCity', { venue, city })
      : (venue ?? word('search.line.venueToBeConfirmed'));

  return word('search.line.event', { dates, place });
}

/** An Invited person has no name yet, so the email takes its place and is shown once. */
function memberRow(member: FoundMember, word: Word): SearchRow {
  const role = member.role == null ? '' : roleName(word, member.role);
  const standing = member.status === 'active' ? null : member.status;

  return member.name == null || member.name === ''
    ? {
        kind: 'member',
        id: member.id,
        name: member.email ?? '',
        line: role,
        standing,
        invitation: member.kind === 'invitation',
      }
    : {
        kind: 'member',
        id: member.id,
        name: member.name,
        line:
          member.email == null ? role : word('search.line.member', { email: member.email, role }),
        standing,
        invitation: member.kind === 'invitation',
      };
}

/** ↑ ↓ stop at either end; Home and End jump there. */
export function searchMoved(at: number, key: string, count: number): number | null {
  if (count === 0) return null;
  if (key === 'ArrowDown') return Math.min(at + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(at - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;

  return null;
}
