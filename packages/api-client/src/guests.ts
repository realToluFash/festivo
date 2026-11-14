import type { EventCover } from './client.ts';

/** An event's guest list as the API answers it (sc-1468). A companion is a guest of their own, listed under their host. */

export type GuestReply = 'noReply' | 'coming' | 'maybe' | 'notComing';

/** What a guest can send from their own page (sc-1439); `maybe` is the guest's "Not sure yet". */
export type GuestAnswer = Exclude<GuestReply, 'noReply'>;
export const GUEST_ANSWERS: readonly GuestAnswer[] = ['coming', 'notComing', 'maybe'];

/** Derived from the host's reply and invitation and never stored: Not yet invited with their host, Held until the host is Coming, then Coming unless the guest marked them Not coming (sc-3779). */
export type CompanionState = 'notYetInvited' | 'held' | 'coming' | 'notComing';
const COMPANION_STATES: readonly CompanionState[] = [
  'notYetInvited',
  'held',
  'coming',
  'notComing',
];

/** The five ways Mark as invited offers, in its order (sc-3788). */
export const GUEST_INVITATION_HOWS = [
  'whatsapp',
  'textMessage',
  'email',
  'inPerson',
  'other',
] as const;
export type GuestInvitationHow = (typeof GUEST_INVITATION_HOWS)[number];

/** `soirelyMessage` once Messaging's invitation has gone, `reply` for a guest nobody marked who replied. */
export type GuestInvitationMethod = GuestInvitationHow | 'soirelyMessage' | 'reply';

export interface GuestInvitation {
  /** In the event's zone. */
  at: string;
  how: GuestInvitationMethod;
  /** Who marked them by hand; null for the other methods and once their account is gone. */
  by: string | null;
}

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

/** One place the host saved (sc-3779): a companion, named or not. */
export interface Companion {
  id: string;
  /** Null when the host left it blank: shown as "Guest of <host>". */
  fullName: string | null;
  state: CompanionState;
  /** The guest gave this name on their own page; the host changing it clears it. */
  namedByGuest: boolean;
  /** Sent only with guests.manage; null for anyone else. */
  needs?: GuestNeeds | null;
}

/** A named companion as the guest's own page shows them, with what the guest last chose for them. */
export interface GuestPageCompanion {
  id: string;
  fullName: string;
  coming: boolean;
  namedByGuest: boolean;
}

/** Who fills the places, sent with Coming: a named companion by `id`, or a name for the next unnamed place with none. */
export interface CompanionChoice {
  id: string | null;
  fullName: string;
  coming: boolean;
}

/** One part of an event's list (sc-3775): a guest is in one at most, their companions with them. */
export interface GuestGroup {
  id: string;
  name: string;
}

/** The API's limits on groups, which the clients check before sending. */
export const GUEST_GROUP_NAME_MAXIMUM = 60;
export const GUEST_GROUPS_MOST = 50;

export interface Guest {
  id: string;
  fullName: string;
  /** Null for none; a companion is in their host's. */
  group: GuestGroup | null;
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
  /** Null while Not yet invited (sc-3788). */
  invitation: GuestInvitation | null;
  /** Sent only with guests.manage (sc-3777); null for anyone else, and on the list the live topic publishes. */
  needs?: GuestNeeds | null;
  companions: Companion[];
}

/** Mark as not invited is offered only on a mark made by hand on a guest who has not replied. */
export function canMarkNotInvited(guest: Guest): boolean {
  return (
    guest.invitation != null &&
    (GUEST_INVITATION_HOWS as readonly string[]).includes(guest.invitation.how) &&
    guest.reply === 'noReply'
  );
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
  /** A to Z, each with its guests and their companions; with `ungrouped` they add up to `counts`. */
  groups: (GuestGroup & { counts: GuestCounts })[];
  ungrouped: GuestCounts;
}

/** The Group field: a group by `id`, a `name` found or made on save, or null for none. Left out of an edit, it stays as it was. */
export type GroupChoice = { id: string } | { name: string } | null;

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
  group?: GroupChoice;
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
    /** How many companions the host saved places for, named or not (sc-3779). */
    places: number;
    /** The named ones; the rest of `places` are unnamed. */
    companions: GuestPageCompanion[];
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

export { COMPANIONS_MAXIMUM, GUEST_NAME_MAXIMUM } from '@soirely/domain';

const REPLIES: readonly GuestReply[] = ['noReply', 'coming', 'maybe', 'notComing'];

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

const INVITATION_METHODS: readonly GuestInvitationMethod[] = [
  ...GUEST_INVITATION_HOWS,
  'soirelyMessage',
  'reply',
];

/** Undefined for a shape this client does not know, so the guest is refused rather than shown as Not yet invited. */
function asInvitation(value: unknown): GuestInvitation | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const at = text(row.at);
  const how = INVITATION_METHODS.find((known) => known === row.how);
  if (at == null || how == null) return undefined;

  return { at, how, by: text(row.by) };
}

export function asGuestGroup(value: unknown): GuestGroup | null {
  if (typeof value !== 'object' || value == null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const name = text(row.name);

  return id == null || name == null ? null : { id, name };
}

function asCounts(value: unknown): GuestCounts | null {
  if (typeof value !== 'object' || value == null) return null;
  const counts = value as Record<string, unknown>;
  if (
    typeof counts.people !== 'number' ||
    typeof counts.guests !== 'number' ||
    typeof counts.companions !== 'number'
  ) {
    return null;
  }

  return { people: counts.people, guests: counts.guests, companions: counts.companions };
}

function asCompanion(value: unknown): Companion | null {
  if (typeof value !== 'object' || value == null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const state = COMPANION_STATES.find((known) => known === row.state);
  if (id == null || state == null) return null;

  return {
    id,
    fullName: text(row.fullName),
    state,
    namedByGuest: row.namedByGuest === true,
    needs: asNeeds(row.needs),
  };
}

export function asGuestPageCompanion(value: unknown): GuestPageCompanion | null {
  if (typeof value !== 'object' || value == null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const fullName = text(row.fullName);
  if (id == null || fullName == null || typeof row.coming !== 'boolean') return null;

  return { id, fullName, coming: row.coming, namedByGuest: row.namedByGuest === true };
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
  const invitation = asInvitation(row.invitation);
  if (invitation === undefined) return null;
  const group = row.group == null ? null : asGuestGroup(row.group);
  if (row.group != null && group == null) return null;

  return {
    id,
    fullName,
    group,
    email: text(row.email),
    mobile: text(row.mobile),
    language: text(row.language),
    chosenLanguage: text(row.chosenLanguage),
    messageLanguage: text(row.messageLanguage),
    reply,
    repliedAt: reply === 'noReply' ? null : text(row.repliedAt),
    invitation,
    needs: asNeeds(row.needs),
    companions: companions as Companion[],
  };
}

export function asGuestList(value: unknown): GuestList | null {
  if (typeof value !== 'object' || value == null) return null;
  const body = value as Record<string, unknown>;
  const counts = asCounts(body.counts);
  if (!Array.isArray(body.guests) || counts == null) return null;
  const listed: unknown[] = body.groups === undefined ? [] : (body.groups as unknown[]);
  const ungrouped = body.ungrouped === undefined ? counts : asCounts(body.ungrouped);
  if (!Array.isArray(listed) || ungrouped == null) return null;
  const guests = body.guests.map(asGuest);
  if (guests.some((guest) => guest == null)) return null;
  const groups = listed.map((row: unknown) => {
    const group = asGuestGroup(row);
    const theirs = asCounts((row as { counts?: unknown } | null)?.counts);

    return group == null || theirs == null ? null : { ...group, counts: theirs };
  });
  if (groups.some((group) => group == null)) return null;

  return {
    guests: guests as Guest[],
    counts,
    groups: groups as GuestList['groups'],
    ungrouped,
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
  byGroup: { group: GuestGroup | null; counts: HeadcountCounts }[];
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
    const named = (row as { group?: unknown } | null)?.group;
    const group = named === null ? null : asGuestGroup(named);
    const rowCounts = asHeadcountCounts((row as { counts?: unknown } | null)?.counts);

    return rowCounts == null || (named !== null && group == null)
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
