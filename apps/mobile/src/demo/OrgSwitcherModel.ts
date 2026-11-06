import { type InvitationOutcome, isWaiting, waitingInvitations } from '@soirely/domain';

import { meshFor, type MeshKey } from './events/EventsSample.ts';
import type { EventKey } from './today.ts';

export interface Place {
  id: string;
  name: string;
  role: string;
}

export interface Invite {
  id: string;
  name: string;
  inviter: string;
  role: string;
  until: string;
}

export type OfferStatus = 'open' | 'asked' | 'unavailable' | 'dismissed';

export interface Offer {
  id: string;
  name: string;
  domain: string;
  status: OfferStatus;
}

export interface Session {
  places: readonly Place[];
  current: string;
  invitations: readonly Invite[];
  outcomes: Readonly<Record<string, InvitationOutcome>>;
  offer: Offer | null;
  /** The invitation or offer opened in place under its row. */
  expanded: string | null;
  query: string;
  large: boolean;
}

export const VIEWER = { name: 'Folake Adeyemi', email: 'folake@ire.events' } as const;

export const SW = {
  asks: 'Where are you working?',
  heading: 'Your organisations',
  current: 'Current',
  remembered: 'Soirely remembers your choice on this device.',
  close: 'Close',
  canAsk: 'You can ask to join',
  search: 'Search organisations',
  clearSearch: 'Clear search',
  accept: 'Accept and join',
  decline: 'Decline',
  acceptLabel: (organisation: string) => `Accept and join ${organisation}`,
  declineLabel: (organisation: string) => `Decline the invitation to ${organisation}`,
  failed: 'Your answer did not reach us. Check your connection and try again.',
  ask: 'Ask to join',
  notNow: 'Not now',
  waiting: 'Waiting for approval',
  unavailable:
    'You cannot ask to join that organisation. Start your own, or ask somebody there to invite you.',
  create: 'Create an organisation',
  createOwn: 'Create an organisation has its own design.',
  switched: (name: string) => `Now working in ${name}.`,
  yourRole: (role: string) => `Your role · ${role}`,
  count: (count: number) => (count === 1 ? '1 invitation' : `${count} invitations`),
  fromNobody: (role: string) => `Invitation · ${role}`,
  from: (inviter: string, role: string) => `Invitation from ${inviter} · ${role}`,
  until: (date: string) => `Works until ${date}`,
  declineNote: (inviter: string) => `Declining tells ${inviter} you said no. Nothing else changes.`,
  joined: (organisation: string, role: string) => `You joined ${organisation} as ${role}.`,
  open: (organisation: string) => `Open ${organisation}`,
  declined: (inviter: string) => `You declined. ${inviter} will see that you said no.`,
  usesSoirely: (organisation: string) => `${organisation} uses Soirely`,
  switcherBody: (domain: string) =>
    `Your address is at ${domain}, so you can ask to join. Somebody there approves you before you see anything.`,
  switcherAsked: (email: string) => `we’ll email ${email} when they answer.`,
  noMatch: (text: string) => `No organisation matches “${text}”.`,
  matches: (count: number) =>
    count === 1 ? '1 organisation matches' : `${count} organisations match`,
} as const;

export function openerLabel(place: Place, waiting: number): string {
  const label = `Organisation: ${place.name}, your role ${place.role}. Switch organisation`;

  if (waiting === 0) return label;

  return `${label}. ${waiting} ${waiting === 1 ? 'invitation' : 'invitations'} waiting`;
}

const IRE_EVENTS: Place = { id: 'org-ire-events', name: 'Ire Events', role: 'Owner' };

const POPULATED: readonly Place[] = [
  IRE_EVENTS,
  { id: 'org-casa-lumen', name: 'Casa Lumen Eventos', role: 'Admin' },
  {
    id: 'org-atelier-celeste-receptions',
    name: 'Atelier Céleste Réceptions et Mariages',
    role: 'Member',
  },
];

const MANY: readonly Place[] = [
  ...POPULATED,
  { id: 'org-harbourlight', name: 'Harbour Light Weddings', role: 'Member' },
  { id: 'org-fiestas-prado', name: 'Fiestas del Prado', role: 'Admin' },
  { id: 'org-maison-ondine-evenements', name: 'Maison Ondine Événements', role: 'Member' },
  { id: 'org-quinta-da-serra-celebracoes', name: 'Quinta da Serra Celebrações', role: 'Member' },
  { id: 'org-northfield-gatherings', name: 'Northfield Gatherings', role: 'Admin' },
  { id: 'org-mar-azul', name: 'Eventos Mar Azul', role: 'Member' },
  { id: 'org-le-petit-salon', name: 'Le Petit Salon', role: 'Member' },
  { id: 'org-bodas-valverde', name: 'Bodas Valverde', role: 'Owner' },
  { id: 'org-lisboa', name: 'Lisboa Encontros', role: 'Member' },
  { id: 'org-kestrel-conferences', name: 'Kestrel Conferences', role: 'Admin' },
  { id: 'org-soirees-du-lac', name: 'Soirées du Lac', role: 'Member' },
  { id: 'org-rio-doce', name: 'Rio Doce Produções', role: 'Member' },
  { id: 'org-banquetes-olivar', name: 'Banquetes Olivar', role: 'Member' },
  { id: 'org-thornbury-hall', name: 'Thornbury Hall Events', role: 'Admin' },
  { id: 'org-atlantico', name: 'Atlântico Comunicações e Eventos', role: 'Member' },
];

const INVITATIONS: readonly Invite[] = [
  {
    id: 'org-celebraciones-alameda',
    name: 'Celebraciones Alameda',
    inviter: 'Kemi Adeyemi',
    role: 'Member',
    until: '2026-11-20',
  },
  {
    id: 'org-bluebird-gatherings',
    name: 'Bluebird Gatherings',
    inviter: 'Beatriz Lima',
    role: 'Admin',
    until: '2026-11-30',
  },
];

const OFFER: Offer = {
  id: 'org-ire-weddings',
  name: 'Ire Weddings',
  domain: 'ire.events',
  status: 'open',
};

export const SWITCHER_STATES = [
  'populated',
  'one',
  'many',
  'search',
  'no-match',
  'offer',
  'offer-asked',
  'offer-unavailable',
  'invitation',
  'joined',
  'declined',
  'failed',
  'large',
] as const;

export type SwitcherState = (typeof SWITCHER_STATES)[number];

export function switcherStateOf(param: string | undefined): SwitcherState | null {
  return SWITCHER_STATES.find((state) => state === param) ?? null;
}

const CELEBRACIONES = 'org-celebraciones-alameda';
const BLUEBIRD = 'org-bluebird-gatherings';

export function sessionFor(state: SwitcherState): Session {
  const populated: Session = {
    places: POPULATED,
    current: IRE_EVENTS.id,
    invitations: INVITATIONS,
    outcomes: {},
    offer: null,
    expanded: null,
    query: '',
    large: false,
  };
  const many: Session = { ...populated, places: MANY, invitations: [] };
  const offered = (status: OfferStatus): Session => ({
    ...populated,
    offer: { ...OFFER, status },
    expanded: OFFER.id,
  });

  switch (state) {
    case 'one':
      return { ...populated, places: [IRE_EVENTS], invitations: [] };
    case 'many':
      return many;
    case 'search':
      return { ...many, query: 'even' };
    case 'no-match':
      return { ...many, query: 'Belém' };
    case 'offer':
      return offered('open');
    case 'offer-asked':
      return offered('asked');
    case 'offer-unavailable':
      return offered('unavailable');
    case 'invitation':
      return { ...populated, expanded: CELEBRACIONES };
    case 'joined':
      return {
        ...populated,
        outcomes: { [CELEBRACIONES]: { kind: 'accepted', organisationId: CELEBRACIONES } },
        expanded: CELEBRACIONES,
      };
    case 'declined':
      return { ...populated, outcomes: { [BLUEBIRD]: { kind: 'declined' } }, expanded: BLUEBIRD };
    case 'failed':
      return { ...populated, outcomes: { [BLUEBIRD]: { kind: 'failed' } }, expanded: BLUEBIRD };
    case 'large':
      return { ...populated, large: true };
    case 'populated':
      return populated;
  }
}

export function waitingOf(session: Session): number {
  return waitingInvitations(session.invitations, session.outcomes);
}

export function currentPlace(session: Session): Place {
  return session.places.find((place) => place.id === session.current) ?? IRE_EVENTS;
}

export function searchable(session: Session): boolean {
  return session.places.length > 15;
}

export function fold(words: string): string {
  return words.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function matches(name: string, query: string): boolean {
  return fold(name).includes(fold(query.trim()));
}

export type Tile =
  | { kind: 'place'; place: Place; current: boolean }
  | { kind: 'joined'; invite: Invite }
  | { kind: 'invitation'; invite: Invite; outcome: InvitationOutcome | undefined }
  | { kind: 'offer'; offer: Offer }
  | { kind: 'create' };

export function tileKey(tile: Tile): string {
  switch (tile.kind) {
    case 'place':
      return tile.place.id;
    case 'joined':
    case 'invitation':
      return tile.invite.id;
    case 'offer':
      return tile.offer.id;
    case 'create':
      return 'create';
  }
}

/** Your places in main's order, then the offer and the invitations, and Create an organisation always last, under a search too. */
export function tilesOf(session: Session, query: string): Tile[] {
  const shown = (name: string) => !searchable(session) || matches(name, query);
  const places: Tile[] = session.places
    .filter((place) => shown(place.name))
    .map((place) => ({ kind: 'place', place, current: place.id === session.current }));
  const offer: Tile[] =
    session.offer == null || session.offer.status === 'dismissed' || !shown(session.offer.name)
      ? []
      : [{ kind: 'offer', offer: session.offer }];
  const invitations: Tile[] = session.invitations
    .filter((invite) => shown(invite.name))
    .map((invite) => {
      const outcome = session.outcomes[invite.id];

      return outcome?.kind === 'accepted'
        ? { kind: 'joined', invite }
        : { kind: 'invitation', invite, outcome };
    });

  return [...places, ...offer, ...invitations, { kind: 'create' }];
}

export function noneMatch(session: Session, query: string): boolean {
  return searchable(session) && query.trim() !== '' && tilesOf(session, query).length === 1;
}

export function expand(session: Session, id: string): Session {
  return { ...session, expanded: session.expanded === id ? null : id };
}

export function answer(session: Session, id: string, yes: boolean): Session {
  const outcome: InvitationOutcome = yes
    ? { kind: 'accepted', organisationId: id }
    : { kind: 'declined' };

  return { ...session, outcomes: { ...session.outcomes, [id]: outcome }, expanded: id };
}

/** An offer refused stays refused: Ask to join again gets the same answer. */
export function ask(session: Session): Session {
  if (session.offer == null || session.offer.status !== 'open') return session;

  return { ...session, offer: { ...session.offer, status: 'asked' } };
}

export function notNow(session: Session): Session {
  if (session.offer == null) return session;

  return { ...session, offer: { ...session.offer, status: 'dismissed' }, expanded: null };
}

/** As it opens again: an answered invitation has left its tile, one joined is now a place, and the search is clear. */
export function settled(session: Session): Session {
  const joined = session.invitations.filter(
    (invite) => session.outcomes[invite.id]?.kind === 'accepted',
  );

  return {
    ...session,
    places: [...session.places, ...joined.map(({ id, name, role }) => ({ id, name, role }))],
    invitations: session.invitations.filter((invite) => isWaiting(session.outcomes[invite.id])),
    outcomes: Object.fromEntries(
      Object.entries(session.outcomes).filter(([, outcome]) => isWaiting(outcome)),
    ),
    offer: session.offer?.status === 'dismissed' ? null : session.offer,
    expanded: null,
    query: '',
  };
}

export function pick(session: Session, id: string): Session {
  return { ...settled(session), current: id };
}

export function orgMesh(id: string): MeshKey {
  return meshFor(id);
}

/** Each mesh drawn as the B cover it is named for, as an event's card draws it. */
export const ORG_COVER: Record<MeshKey, EventKey> = {
  rose: 'wed',
  teal: 'ireti',
  accent: 'party',
  amber: 'draft',
};

export function untilIn(locale: string, day: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00Z`));
}

export const LEAST_CELL = 112;
export const CELL_GAP = 4;
const EDGES = 2;
const PADDING = 12;

export function gridWidth(width: number): number {
  return width - EDGES - 2 * PADDING;
}

export function columnsFor(width: number): number {
  return Math.max(1, Math.floor((gridWidth(width) + CELL_GAP) / (LEAST_CELL + CELL_GAP)));
}

export function cellWidth(width: number): number {
  const across = columnsFor(width);

  return (gridWidth(width) - CELL_GAP * (across - 1)) / across;
}

export function rowsOf<T>(items: readonly T[], across: number): T[][] {
  const rows: T[][] = [];

  for (let at = 0; at < items.length; at += across) rows.push(items.slice(at, at + across));

  return rows;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropFrame {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  /** The opener's centre, across the drop-down's top edge: where it grows from. */
  originX: number;
}

export const DROP_WIDTH = 500;
const BELOW_OPENER = 8;
const ABOVE_FOOT = 12;
const SIDE = 12;
const TAB_BAR = 64;
const LEAST_HEIGHT = 160;

export function frameFor({
  opener,
  window,
  insets,
  phone,
}: {
  opener: Box;
  window: { width: number; height: number };
  insets: { bottom: number };
  phone: boolean;
}): DropFrame {
  const top = opener.y + opener.height + BELOW_OPENER;
  const left = phone ? SIDE : Math.max(SIDE, opener.x);
  const width = phone ? window.width - 2 * SIDE : Math.min(DROP_WIDTH, window.width - left - SIDE);
  const foot = phone ? Math.max(insets.bottom - 4, 12) + TAB_BAR : Math.max(insets.bottom, 20);

  return {
    left,
    top,
    width,
    maxHeight: Math.max(LEAST_HEIGHT, window.height - foot - ABOVE_FOOT - top),
    originX: opener.x + opener.width / 2 - left,
  };
}

/** The least scroll that shows all of a part with some to spare; none when it already shows. */
export function scrollToShow({
  top,
  bottom,
  offset,
  viewport,
  spare = 12,
}: {
  top: number;
  bottom: number;
  offset: number;
  viewport: number;
  spare?: number;
}): number | null {
  if (bottom + spare > offset + viewport)
    return Math.max(0, Math.min(top, bottom + spare - viewport));
  if (top < offset) return Math.max(0, top - spare);

  return null;
}
