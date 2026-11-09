import { type InvitationOutcome, isWaiting } from '@soirely/domain';

import { meshFor, type MeshKey } from '../kit/today.ts';
import type { Invite, Offer, OfferStatus, Place, Session } from '../kit/orgSwitcher.ts';

export {
  CELL_GAP,
  type DropFrame,
  type Invite,
  type Offer,
  type Place,
  SEARCH_ABOVE,
  type Session,
  type Tile,
  cellWidth,
  columnsFor,
  fold,
  frameFor,
  matches,
  noneMatch,
  rowsOf,
  scrollToShow,
  searchable,
  startsAWord,
  tileKey,
  tilesOf,
  untilIn,
  waitingOf,
} from '../kit/orgSwitcher.ts';

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
    invitedBy: { name: 'Kemi Adeyemi' },
    role: 'Member',
    until: '2026-11-20',
    email: VIEWER.email,
    signedInAs: VIEWER.email,
  },
  {
    id: 'org-bluebird-gatherings',
    name: 'Bluebird Gatherings',
    invitedBy: { name: 'Beatriz Lima' },
    role: 'Admin',
    until: '2026-11-30',
    email: VIEWER.email,
    signedInAs: VIEWER.email,
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
  'managed',
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
    case 'managed':
      return { ...populated, expanded: CELEBRACIONES, managed: CELEBRACIONES };
    case 'populated':
      return populated;
  }
}

export function currentPlace(session: Session): Place {
  return session.places.find((place) => place.id === session.current) ?? IRE_EVENTS;
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

/** A new organisation joins the end, as main orders them by when you joined, and becomes the current one; a second walk makes the demo's one again. */
export function founded(session: Session, place: Place): Session {
  const now = settled(session);
  const others = now.places.filter((known) => known.id !== place.id);

  return { ...now, places: [...others, place], current: place.id };
}

/** Folake in no organisation; founded() gives her one. */
export function withoutPlaces(session: Session): Session {
  return { ...session, places: [], current: '', invitations: [], outcomes: {}, offer: null };
}

export function placeOf(session: Session): Place | null {
  return session.places.find((place) => place.id === session.current) ?? null;
}

export function orgMesh(id: string): MeshKey {
  return meshFor(id);
}
