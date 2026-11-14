import type { EventCover } from './client.ts';

/** An event's guest list as the API answers it (sc-1468). A companion is a guest of their own, listed under their host. */

export type GuestReply = 'noReply' | 'coming' | 'maybe' | 'notComing';

/** What a guest can send from their own page (sc-1439); `maybe` is the guest's "Not sure yet". */
export type GuestAnswer = Exclude<GuestReply, 'noReply'>;
export const GUEST_ANSWERS: readonly GuestAnswer[] = ['coming', 'notComing', 'maybe'];

/** Derived from the host's reply and never stored: Held until the host is Coming. */
export type CompanionState = 'held' | 'coming';

/** sc-3777's codes, each list in its order: the 14 allergens of EU 1169/2011 Annex II, then Other. Every client words them. */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
  'other',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const DIETS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'no_pork',
  'no_beef',
  'no_alcohol',
  'other',
] as const;
export type Diet = (typeof DIETS)[number];

export const ACCESS_NEEDS = [
  'step_free',
  'near_exit',
  'hearing_loop',
  'sign_language',
  'wheelchair_space',
  'other',
] as const;
export type AccessNeed = (typeof ACCESS_NEEDS)[number];

export type NeedKind = 'allergen' | 'diet' | 'access';

/** A guest's or a companion's needs: codes with Other among them, each ticked Other's words, and the hosts' private note. */
export interface GuestNeeds {
  allergies: Allergen[];
  diet: Diet[];
  access: AccessNeed[];
  otherAllergy: string | null;
  otherDiet: string | null;
  otherAccess: string | null;
  note: string | null;
}

/** The API's limits on an Other's words and on the note, counted after trimming. */
export const NEED_OTHER_MAXIMUM = 100;
export const NEED_NOTE_MAXIMUM = 500;

export interface Companion {
  id: string;
  /** Null when the host left it blank: shown as "Guest of <host>". */
  fullName: string | null;
  state: CompanionState;
  /** Sent only with guests.manage; null for anyone else. */
  needs?: GuestNeeds | null;
}

export interface Guest {
  id: string;
  fullName: string;
  /** Null for none, and for anyone without guests.manage, whom the API never sends it (sc-3773). */
  email: string | null;
  /** E.164; null as `email` is. */
  mobile: string | null;
  /** The host's Language for them (sc-3790), null for Not set; null as `email` is. */
  language: string | null;
  /** What the guest picked on their own page, which wins over `language`; null as `email` is. */
  chosenLanguage: string | null;
  /** What messages to them are written in, by the rule (guestMessageLanguage); null as `email` is. */
  messageLanguage: string | null;
  reply: GuestReply;
  /** When the current reply was given, in the event's zone; null with no reply. */
  repliedAt: string | null;
  /** Sent only with guests.manage (sc-3777); null for anyone else, and on the list the live topic publishes. */
  needs?: GuestNeeds | null;
  companions: Companion[];
}

/** `people` counts guests and companions together. */
export interface GuestCounts {
  people: number;
  guests: number;
  companions: number;
}

export interface GuestList {
  guests: Guest[];
  counts: GuestCounts;
}

export interface NewGuest {
  fullName: string;
  email?: string | null;
  /** As the account's Mobile number field sends it: the country picked and the number typed. Answered as E.164. */
  mobile?: { countryCode: string; number: string } | null;
  companions?: { fullName?: string | null; needs?: NeedsInput }[];
  /** The host's Language for them, null for Not set. Left out of an edit, it stays as it was. */
  language?: string | null;
  /** Left out of an edit, they stay as they were; so does a kept companion's. */
  needs?: NeedsInput;
  /** Sent once the host pressed Add anyway on "<name> is already on the list". */
  allowDuplicate?: boolean;
}

/** One guest as their details show them (sc-3773). */
export interface GuestDetails extends Guest {
  added: { at: string; by: string | null };
  /** What Not set falls back to; null as `email` is. */
  organisationLanguage: string | null;
}

/** The whole guest as Edit saves it: each companion kept by `id`, one with no id added, one left out removed. */
export interface GuestEdit extends Omit<NewGuest, 'companions'> {
  companions: { id?: string | null; fullName?: string | null; needs?: NeedsInput }[];
}

export type NeedsInput = Partial<GuestNeeds>;

/** A guest with the `ETag` an edit sends back as `If-Match`. */
export interface TaggedGuest {
  guest: GuestDetails;
  tag: string;
}

/** A guest's subscription, as Apple and Outlook open it (webcal) and as Google Calendar adds it by URL. */
export interface GuestCalendarLink {
  webcal: string;
  google: string;
}

/** What a guest's own link opens (sc-1526): their name as the host typed it, their answer (sc-1439), and the event behind it. */
export interface GuestPage {
  guest: {
    fullName: string;
    /** `at` is in the event's zone. */
    reply: { answer: GuestAnswer; at: string } | null;
    companions: number;
  };
  /** What the page's language is chosen from (guestLanguage, sc-3790), with the browser's own languages. */
  language: { chosen: string | null; host: string | null; organisation: string };
  event: {
    /** For its colour (meshFor) until it has a photo, as its event page has it. */
    id: string;
    name: string;
    type: string;
    /** Null for the default cover of the event's type. */
    cover: EventCover | null;
    /** The names guests read, in order (sc-6713). */
    hosts: string[];
    /** With the event's own offset. */
    startsAt: string;
    timeZone: string;
    /** The address as the host entered it. */
    venue: { name: string | null; address: string | null } | null;
  };
  /** As the guest reads it (sc-3591): Paused, Called off and Finished each close answers with a notice. */
  phase: GuestPagePhase;
  /** From the start, in the event's zone. */
  started: boolean;
  /** False from the start, in the event's zone, and whenever the event is not Live. */
  answersOpen: boolean;
  /** The guest's own calendar feed for Add to calendar (sc-3627): only for Coming while the event is Live. */
  calendar: GuestCalendarLink | null;
}

export const GUEST_PAGE_PHASES = ['live', 'paused', 'calledOff', 'finished'] as const;
export type GuestPagePhase = (typeof GUEST_PAGE_PHASES)[number];

/** The API's Guest limits, which the form checks before sending. */
export const GUEST_NAME_MAXIMUM = 200;
export const COMPANIONS_MAXIMUM = 10;

const REPLIES: readonly GuestReply[] = ['noReply', 'coming', 'maybe', 'notComing'];

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asCompanion(value: unknown): Companion | null {
  if (typeof value !== 'object' || value == null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  if (id == null || (row.state !== 'held' && row.state !== 'coming')) return null;

  return { id, fullName: text(row.fullName), state: row.state, needs: asNeeds(row.needs) };
}

function codes<T extends string>(value: unknown, known: readonly T[]): T[] {
  return Array.isArray(value) ? known.filter((code) => value.includes(code)) : [];
}

export function asNeeds(value: unknown): GuestNeeds | null {
  if (typeof value !== 'object' || value == null) return null;
  const needs = value as Record<string, unknown>;

  return {
    allergies: codes(needs.allergies, ALLERGENS),
    diet: codes(needs.diet, DIETS),
    access: codes(needs.access, ACCESS_NEEDS),
    otherAllergy: text(needs.otherAllergy),
    otherDiet: text(needs.otherDiet),
    otherAccess: text(needs.otherAccess),
    note: text(needs.note),
  };
}

export function asGuest(value: unknown): Guest | null {
  if (typeof value !== 'object' || value == null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const fullName = text(row.fullName);
  const reply = REPLIES.find((known) => known === row.reply);
  if (id == null || fullName == null || reply == null || !Array.isArray(row.companions))
    return null;
  const companions = row.companions.map(asCompanion);
  if (companions.some((companion) => companion == null)) return null;

  return {
    id,
    fullName,
    email: text(row.email),
    mobile: text(row.mobile),
    language: text(row.language),
    chosenLanguage: text(row.chosenLanguage),
    messageLanguage: text(row.messageLanguage),
    reply,
    repliedAt: reply === 'noReply' ? null : text(row.repliedAt),
    needs: asNeeds(row.needs),
    companions: companions as Companion[],
  };
}

export function asGuestList(value: unknown): GuestList | null {
  if (typeof value !== 'object' || value == null) return null;
  const body = value as Record<string, unknown>;
  const counts = body.counts as Record<string, unknown> | null | undefined;
  if (!Array.isArray(body.guests) || typeof counts !== 'object' || counts == null) return null;
  if (
    typeof counts.people !== 'number' ||
    typeof counts.guests !== 'number' ||
    typeof counts.companions !== 'number'
  ) {
    return null;
  }
  const guests = body.guests.map(asGuest);
  if (guests.some((guest) => guest == null)) return null;

  return {
    guests: guests as Guest[],
    counts: { people: counts.people, guests: counts.guests, companions: counts.companions },
  };
}

const HEADCOUNT_COUNTS = [
  'onList',
  'notYetInvited',
  'invited',
  'accepted',
  'maybe',
  'awaitingReply',
  'held',
  'declined',
] as const;

/** People (sc-99). `accepted` is the settled figure; an optimistic one adds maybe, awaitingReply and held, never `heldBy.hostNotComing`. */
export type HeadcountCounts = Record<(typeof HEADCOUNT_COUNTS)[number], number> & {
  heldBy: { hostNoReply: number; hostMaybe: number; hostNotComing: number };
};

export interface NeedCount {
  kind: NeedKind;
  code: string;
  people: number;
}

/** The one answer to how many are coming: read it, never count the list. Published on the `EventHeadcount` topic. */
export interface Headcount {
  counts: HeadcountCounts;
  /** `group` is null for No group; the rows add up to `counts`. */
  byGroup: { group: string | null; counts: HeadcountCounts }[];
  /** Each code (sc-3777), allergens first: a person counts under each they have, so these rows do not add up. */
  byDietaryNeed: { addsUp: false; needs: NeedCount[] };
}

function asHeadcountCounts(value: unknown): HeadcountCounts | null {
  if (typeof value !== 'object' || value == null) return null;
  const counts = value as Record<string, unknown>;
  const heldBy = counts.heldBy as Record<string, unknown> | null | undefined;
  if (HEADCOUNT_COUNTS.some((key) => typeof counts[key] !== 'number')) return null;
  if (
    typeof heldBy !== 'object' ||
    heldBy == null ||
    typeof heldBy.hostNoReply !== 'number' ||
    typeof heldBy.hostMaybe !== 'number' ||
    typeof heldBy.hostNotComing !== 'number'
  ) {
    return null;
  }

  return counts as HeadcountCounts;
}

export function asHeadcount(value: unknown): Headcount | null {
  if (typeof value !== 'object' || value == null) return null;
  const body = value as Record<string, unknown>;
  const counts = asHeadcountCounts(body.counts);
  const needs = body.byDietaryNeed as Record<string, unknown> | null | undefined;
  if (
    counts == null ||
    !Array.isArray(body.byGroup) ||
    typeof needs !== 'object' ||
    needs == null
  ) {
    return null;
  }
  if (
    !Array.isArray(needs.needs) ||
    needs.needs.some((row: unknown) => {
      const need = row as { kind?: unknown; code?: unknown; people?: unknown } | null;
      return (
        (need?.kind !== 'allergen' && need?.kind !== 'diet' && need?.kind !== 'access') ||
        typeof need.code !== 'string' ||
        typeof need.people !== 'number'
      );
    })
  ) {
    return null;
  }
  const byGroup = body.byGroup.map((row: unknown) => {
    const group = (row as { group?: unknown } | null)?.group;
    const rowCounts = asHeadcountCounts((row as { counts?: unknown } | null)?.counts);

    return rowCounts == null || (group !== null && typeof group !== 'string')
      ? null
      : { group, counts: rowCounts };
  });
  if (byGroup.some((row) => row == null)) return null;

  return {
    counts,
    byGroup: byGroup as Headcount['byGroup'],
    byDietaryNeed: { addsUp: false, needs: needs.needs as Headcount['byDietaryNeed']['needs'] },
  };
}

export function asGuestDetails(value: unknown): GuestDetails | null {
  const guest = asGuest(value);
  const added = (value as { added?: unknown } | null)?.added as Record<string, unknown> | undefined;
  const at = typeof added === 'object' && added != null ? text(added.at) : null;

  if (guest == null || at == null) return null;

  return {
    ...guest,
    added: { at, by: text(added?.by) },
    organisationLanguage: text((value as { organisationLanguage?: unknown }).organisationLanguage),
  };
}
