import type { Arrival, CheckIn, CheckInGuest, GuestSeat } from '@soirely/api-client';

import { type Translate } from './eventWords.ts';
import { type ReplyWord } from './guestForm.ts';
import { companionShown } from './guestRows.ts';
import { nameKey } from './nameKey.ts';
import { visibleLength } from './visibleText.ts';

export interface DoorRow {
  id: string;
  name: string;
  hostId: string;
  companion: boolean;
  reply: ReplyWord;
  arrival: Arrival | null;
  /** The line under the name: their seat, or "No seat yet"; null on an event nobody is seated on yet, where no row has one (sc-60684). */
  seat: string | null;
}

/** "Table 4 · Main hall", "Row C, seat 14 · Balcony", "Seat 12": the host's own names, never translated, in sc-4022's words, so the door and the guest's page word one seat one way; a place in no section, or a companion's line on the guest's page, drops it. */
export function seatWords(t: Translate, seat: GuestSeat, withSection = true): string {
  const place =
    seat.kind === 'row' ? t('guest.table.row', { row: seat.name, seat: seat.seat }) : seat.name;

  return !withSection || seat.section == null
    ? place
    : t('guest.table.placed', { place, section: seat.section });
}

/** The line under a name at the door: null on a list nobody is seated on yet, otherwise the seat or "No seat yet". */
export function doorSeatLine(
  t: Translate,
  checkIn: Pick<CheckIn, 'seated'>,
  seat: GuestSeat | null,
): string | null {
  if (!checkIn.seated) return null;

  return seat == null ? t('checkIn.noSeat') : seatWords(t, seat);
}

const words = (name: string) =>
  nameKey(name)
    .split(/[\s-]+/u)
    .filter((one) => one !== '');

/** How a name answers what was typed at the door (sc-85893). `start`: every word typed starts some word of the name, in any order (sc-1454's rule). `inside`: otherwise, every word typed starts a word or, from 3 letters, sits inside one. Case and accents are ignored; a hyphen or a space separates words. */
export type DoorMatch = 'start' | 'inside';

const INSIDE_FROM = 3;

export function doorMatch(name: string, typed: string): DoorMatch | null {
  const wanted = words(typed);
  if (wanted.length === 0) return 'start';
  const has = words(name);
  if (wanted.every((one) => has.some((word) => word.startsWith(one)))) return 'start';

  return wanted.every((one) =>
    has.some(
      (word) => word.startsWith(one) || ([...one].length >= INSIDE_FROM && word.includes(one)),
    ),
  )
    ? 'inside'
    : null;
}

function rowsOf(t: Translate, checkIn: CheckIn, guest: CheckInGuest): DoorRow[] {
  const names = guest.companions.map((one) => one.fullName);

  return [
    {
      id: guest.id,
      name: guest.fullName,
      hostId: guest.id,
      companion: false,
      reply: guest.walkIn ? 'walkIn' : guest.reply,
      arrival: guest.arrival,
      seat: doorSeatLine(t, checkIn, guest.seat),
    },
    ...guest.companions.map((one, at) => ({
      id: one.id,
      name: companionShown(t, guest.fullName, names, at),
      hostId: guest.id,
      companion: true,
      reply: one.state,
      arrival: one.arrival,
      seat: doorSeatLine(t, checkIn, one.seat),
    })),
  ];
}

interface DoorBlock {
  rows: DoorRow[];
  match: DoorMatch;
  /** The first of its people found by their own name, named as the host typed it. */
  found: DoorRow;
}

function blockOf(
  t: Translate,
  checkIn: CheckIn,
  guest: CheckInGuest,
  typed: string,
): DoorBlock | null {
  const [host, ...companions] = rowsOf(t, checkIn, guest);
  if (host == null) return null;
  const own = doorMatch(guest.fullName, typed);
  const hits = companions.flatMap((row, at) => {
    const name = guest.companions[at]?.fullName;
    if (name == null) return [];
    const match = doorMatch(name, typed);

    return match == null ? [] : [{ row, name, match }];
  });
  const matches = [own, ...hits.map((hit) => hit.match)];
  const match = matches.includes('start') ? 'start' : matches.includes('inside') ? 'inside' : null;
  const first = hits[0];
  if (match == null) return null;
  if (own != null) return { rows: [host, ...companions], match, found: host };
  if (first == null) return null;

  return {
    rows: [host, ...hits.map((hit) => hit.row)],
    match,
    found: { ...first.row, name: first.name },
  };
}

function doorBlocks(t: Translate, checkIn: CheckIn, typed: string, locale: string): DoorBlock[] {
  const order = new Intl.Collator(locale, { sensitivity: 'base' });
  const blocks = [...checkIn.guests]
    .sort((a, b) => order.compare(a.fullName, b.fullName))
    .flatMap((guest) => blockOf(t, checkIn, guest, typed) ?? []);

  return [
    ...blocks.filter((block) => block.match === 'start'),
    ...blocks.filter((block) => block.match === 'inside'),
  ];
}

/** Everyone A–Z by full name in the reader's locale, each companion under their host. A search lists the guests whose words start with what was typed, then those whose words only hold it, each group A–Z (sc-85893); a host found shows with all their companions, a companion found shows under their host, and the two stay in the first group either belongs to. */
export function doorRows(t: Translate, checkIn: CheckIn, typed: string, locale: string): DoorRow[] {
  return doorBlocks(t, checkIn, typed, locale).flatMap((block) => block.rows);
}

/** "141 of 152 arrived", attended of expected; with nobody expected, "37 arrived" (sc-1454, The count). */
export function countLine(t: Translate, count: CheckIn['count']): string {
  return count.expected === 0
    ? t('checkIn.countAlone', { count: count.attended })
    : t('checkIn.count', { count: count.attended, expected: count.expected });
}

/** A walk-in's name: required, at most 200 characters as a person sees them (the API's count), trimmed; only spaces is blank. */
export function walkInProblem(name: string): 'blank' | 'long' | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'blank';

  return visibleLength(trimmed) > 200 ? 'long' : null;
}

/** Who **Add walk-in**'s "already on the list" panel names: the guest with the same name, otherwise the first person **Search by name** would find by that name (sc-85893). */
export function listedAs(
  t: Translate,
  checkIn: CheckIn,
  name: string,
  locale: string,
): DoorRow | null {
  if (words(name).length === 0) return null;

  return sameName(t, checkIn, name) ?? doorBlocks(t, checkIn, name, locale)[0]?.found ?? null;
}

export function sameName(t: Translate, checkIn: CheckIn, name: string): DoorRow | null {
  const wanted = nameKey(name);
  for (const guest of checkIn.guests) {
    if (nameKey(guest.fullName) === wanted)
      return {
        id: guest.id,
        name: guest.fullName,
        hostId: guest.id,
        companion: false,
        reply: guest.walkIn ? 'walkIn' : guest.reply,
        arrival: guest.arrival,
        seat: doorSeatLine(t, checkIn, guest.seat),
      };
    for (const one of guest.companions)
      if (one.fullName != null && nameKey(one.fullName) === wanted)
        return {
          id: one.id,
          name: one.fullName,
          hostId: guest.id,
          companion: true,
          reply: one.state,
          arrival: one.arrival,
          seat: doorSeatLine(t, checkIn, one.seat),
        };
  }

  return null;
}
