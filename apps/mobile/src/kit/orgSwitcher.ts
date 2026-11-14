import type { Membership } from '@soirely/api-client';
import { type InvitationOutcome, isWaiting, waitingInvitations } from '@soirely/domain';

import type { WaitingInvitations } from '../invitations.ts';
import type { DomainOffer } from '../joinOffers.ts';

export interface Place {
  id: string;
  name: string;
  role: string;
  /** Made in the walk just now, so it has no events yet. */
  fresh?: boolean;
}

export interface Invite {
  id: string;
  name: string;
  invitedBy: { name: string } | null;
  role: string;
  until: string;
  email: string;
  signedInAs: string | null;
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
  /** Drawn as the largest text sizes draw it, whatever the device's size. */
  large: boolean;
  /** sc-563: the invitation whose Join is refused, the address being managed by its home organisation. */
  managed?: string | undefined;
}

export function waitingOf(session: Session): number {
  return waitingInvitations(session.invitations, session.outcomes);
}

/** The switcher searches above this many organisations, and Members' person menu above this many people (sc-614). */
export const SEARCH_ABOVE = 15;

export function searchable(session: Session): boolean {
  return session.places.length > SEARCH_ABOVE;
}

export function fold(words: string): string {
  return words.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function matches(name: string, query: string): boolean {
  return fold(name).includes(fold(query.trim()));
}

/** People's rule (handover-a-spec.md §2.2): a name matches at the start of any of its words, so "jo" finds Joana and João. */
export function startsAWord(name: string, query: string): boolean {
  const typed = fold(query.trim());

  return (
    typed === '' ||
    fold(name)
      .split(/\s+/u)
      .some((word) => word.startsWith(typed))
  );
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

export function untilIn(locale: string, day: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day.slice(0, 10)}T00:00Z`));
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

/** What the switcher shows of the account: an invitation answered before it opened has left it, and one joined while it is open is still its invitation. */
export function switcherSession({
  organisations,
  current,
  waiting,
  answeredHere,
  offer,
  offerRefused,
  expanded,
  role,
}: {
  organisations: readonly Membership[];
  current: Membership | null;
  waiting: WaitingInvitations;
  answeredHere: ReadonlySet<string>;
  offer: DomainOffer;
  offerRefused: boolean;
  expanded: string | null;
  role: (role: Membership['role']) => string;
}): Session {
  const invitations = waiting.invitations.filter(
    (invitation) => isWaiting(waiting.outcomes[invitation.id]) || answeredHere.has(invitation.id),
  );
  const joinedHere = new Set(
    invitations.flatMap((invitation) => {
      const outcome = waiting.outcomes[invitation.id];

      return outcome?.kind === 'accepted' ? [outcome.organisationId] : [];
    }),
  );
  const asked = offer.asked ? 'asked' : offerRefused ? 'unavailable' : 'open';

  return {
    places: organisations
      .filter((membership) => !joinedHere.has(membership.id))
      .map((membership) => ({
        id: membership.id,
        name: membership.name,
        role: role(membership.role),
      })),
    current: current?.id ?? '',
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      name: invitation.organisation.name,
      invitedBy: invitation.invitedBy,
      role: invitation.role == null ? '' : role(invitation.role),
      until: invitation.expiresAt,
      email: invitation.email,
      signedInAs: invitation.signedInAs,
    })),
    outcomes: waiting.outcomes,
    offer:
      offer.organisation == null
        ? null
        : {
            id: offer.organisation.id,
            name: offer.organisation.name,
            domain: offer.domain ?? '',
            status: asked,
          },
    expanded,
    query: '',
    large: false,
  };
}
