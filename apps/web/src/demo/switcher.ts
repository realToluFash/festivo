import { formattingLocale } from '@soirely/domain';
import { useState, useSyncExternalStore } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { type CreateState, NEW_ORG, isCreateState } from './createOrg.ts';
import type { DemoLink } from './settings.ts';

export type Role = 'Owner' | 'Admin' | 'Member';
export type Answer =
  'joined' | 'declined' | 'failed' | 'managed' | 'expired' | 'withdrawn' | 'busy';
export type OfferStanding = 'unasked' | 'asked' | 'unavailable';

export interface Place {
  id: string;
  name: string;
  role: Role;
}

export interface Invitation extends Place {
  inviter: string;
  until: string;
}

export interface Where {
  places: readonly Place[];
  current: string;
  paused: boolean;
  invitations: readonly Invitation[];
  answers: Readonly<Record<string, Answer>>;
  offer: OfferStanding | null;
  switched: { name: string; at: string; takesFocus?: boolean } | null;
  opens: number;
  fresh: readonly string[];
  arrived: string | null;
}

export const SWITCHER_STATES = [
  'closed',
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
  'busy',
  'expired',
  'withdrawn',
  'managed',
  'paused',
] as const;

export type SwitcherState = (typeof SWITCHER_STATES)[number];

export const OFFER = { id: 'org-ire-weddings', name: 'Ire Weddings', domain: 'ire.events' };
export const PAUSED = {
  id: 'org-casa-lumen',
  name: 'Casa Lumen Eventos',
  domain: 'casalumen.es',
  since: '2026-11-02',
};

const IRE: Place = { id: 'org-ire-events', name: 'Ire Events', role: 'Owner' };
export const NEW_PLACE: Place = { ...NEW_ORG, role: 'Owner' };

const POPULATED: readonly Place[] = [
  IRE,
  { id: PAUSED.id, name: PAUSED.name, role: 'Admin' },
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

export const CELEBRACIONES = 'org-celebraciones-alameda';
export const BLUEBIRD = 'org-bluebird-gatherings';

const CELEBRACIONES_INVITATION: Invitation = {
  id: CELEBRACIONES,
  name: 'Celebraciones Alameda',
  role: 'Member',
  inviter: 'Kemi Adeyemi',
  until: '2026-11-20',
};

const INVITATIONS: readonly Invitation[] = [
  CELEBRACIONES_INVITATION,
  {
    id: BLUEBIRD,
    name: 'Bluebird Gatherings',
    role: 'Admin',
    inviter: 'Beatriz Lima',
    until: '2026-11-30',
  },
];

export function isSwitcherState(name: string | null): name is SwitcherState {
  return SWITCHER_STATES.some((state) => state === name);
}

export function whereOf(state: SwitcherState | null): Where {
  const answers: Record<string, Answer> =
    state === 'joined'
      ? { [CELEBRACIONES]: 'joined' }
      : state === 'declined'
        ? { [BLUEBIRD]: 'declined' }
        : state === 'failed' || state === 'expired' || state === 'withdrawn' || state === 'busy'
          ? { [BLUEBIRD]: state }
          : state === 'managed'
            ? { [CELEBRACIONES]: 'managed' }
            : {};
  const many = state === 'many' || state === 'search' || state === 'no-match';
  const alone = state === 'one' || many || state === 'paused';

  return {
    places: many
      ? MANY
      : state === 'one'
        ? [IRE]
        : state === 'joined'
          ? [...POPULATED, joinedPlace(CELEBRACIONES_INVITATION)]
          : POPULATED,
    current: IRE.id,
    paused: state === 'paused',
    invitations: alone ? [] : INVITATIONS,
    answers,
    offer:
      state === 'offer'
        ? 'unasked'
        : state === 'offer-asked'
          ? 'asked'
          : state === 'offer-unavailable'
            ? 'unavailable'
            : null,
    switched: null,
    opens: 0,
    fresh: [],
    arrived: null,
  };
}

/** Folake owns Ire Events alone, or nothing with `?orgs=none`; `created` has made Lumen Feiras. */
export function creatingOf(state: CreateState | null, none: boolean, at: string): Where {
  const start = { ...whereOf('one'), places: none ? [] : [IRE] };

  return state === 'created' ? madeIn(start, NEW_PLACE, at, none) : start;
}

function madeIn(now: Where, place: Place, at: string, takesFocus: boolean): Where {
  const known = now.places.some((one) => one.id === place.id);

  return {
    ...now,
    places: known ? now.places : [...now.places, place],
    current: place.id,
    paused: false,
    switched: { name: place.name, at, takesFocus },
    fresh: known ? now.fresh : [...now.fresh, place.id],
    arrived: place.id,
  };
}

/** What a `?switcher=` state opens with: the panel under its tile, and the search as typed. */
export function openingOf(state: SwitcherState): { panel: string | null; query: string } {
  const panel =
    state === 'offer' || state === 'offer-asked' || state === 'offer-unavailable'
      ? OFFER.id
      : state === 'invitation' || state === 'joined' || state === 'managed'
        ? CELEBRACIONES
        : state === 'declined' ||
            state === 'failed' ||
            state === 'expired' ||
            state === 'withdrawn' ||
            state === 'busy'
          ? BLUEBIRD
          : null;

  return { panel, query: state === 'search' ? 'even' : state === 'no-match' ? 'Belém' : '' };
}

function joinedPlace(invitation: Invitation): Place {
  return { id: invitation.id, name: invitation.name, role: invitation.role };
}

export function waiting(where: Where): readonly Invitation[] {
  return where.invitations.filter((one) => {
    const answer = where.answers[one.id];

    return answer == null || answer === 'failed' || answer === 'busy' || answer === 'managed';
  });
}

export function currentPlace(where: Where): Place {
  return where.places.find((place) => place.id === where.current) ?? IRE;
}

export function dayOf(date: string): string {
  return new Intl.DateTimeFormat(formattingLocale('en', navigator.language), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00Z`));
}

export function openerLabel(place: Place, count: number): string {
  const named = `Organisation: ${place.name}, your role ${place.role}. Switch organisation`;

  if (count === 0) return named;

  return `${named}. ${count} ${count === 1 ? 'invitation' : 'invitations'} waiting`;
}

let where = whereOf(null);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useWhere(): Where {
  return useSyncExternalStore(
    subscribe,
    () => where,
    () => where,
  );
}

export function usePaused(): boolean {
  return useWhere().paused;
}

export function isFresh(where: Where): boolean {
  return where.fresh.includes(where.current);
}

export function inNone(where: Where): boolean {
  return where.places.length === 0;
}

export function change(next: (now: Where) => Where): void {
  where = next(where);
  for (const listener of listeners) listener();
}

export function startSwitcher(state: SwitcherState | null): void {
  where = whereOf(state);
}

export function join(invitation: Invitation): void {
  change((now) => ({
    ...now,
    places: now.places.some((place) => place.id === invitation.id)
      ? now.places
      : [...now.places, joinedPlace(invitation)],
    answers: { ...now.answers, [invitation.id]: 'joined' },
  }));
}

export function decline(invitation: Invitation): void {
  change((now) => ({ ...now, answers: { ...now.answers, [invitation.id]: 'declined' } }));
}

/** The walk's Create: from no organisation the notice takes focus, as main's does. */
export function create(place: Place, at: string, takesFocus: boolean): void {
  change((now) => madeIn(now, place, at, takesFocus));
}

export function colourArrived(): void {
  change((now) => ({ ...now, arrived: null }));
}

export function switchTo(place: Place, at: string): void {
  change((now) => ({
    ...now,
    current: place.id,
    paused: false,
    switched: { name: place.name, at },
  }));
}

/** First in a page, before anything reads the store: `?switcher=`, `?create=` and `?orgs=` start it afresh, and a switch is said only on the page it happened on. */
export function useSwitcherStart(): void {
  const [params] = useSearchParams();
  const { pathname } = useLocation();

  useState(() => {
    const state = params.get('switcher');
    const walk = params.get('create');
    const none = params.get('orgs') === 'none';
    if (isSwitcherState(state)) where = whereOf(state);
    else if (isCreateState(walk) || none)
      where = creatingOf(isCreateState(walk) ? walk : null, none, pathname);
    else if (where.switched != null && where.switched.at !== pathname)
      where = { ...where, switched: null };
  });
}

export function ask(): void {
  change((now) => ({ ...now, offer: now.offer === 'unavailable' ? 'unavailable' : 'asked' }));
}

export function notNow(): void {
  change((now) => ({ ...now, offer: null }));
}

export function askToOpen(): void {
  change((now) => ({ ...now, opens: now.opens + 1 }));
}

function switcherLink(state: SwitcherState, name: string): DemoLink {
  return { to: `/demo/events?switcher=${state}`, name };
}

export const SWITCHER_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The menu',
    states: [
      switcherLink('closed', 'Closed, with 2 invitations'),
      switcherLink('populated', 'Open, Ire Events current'),
      switcherLink('one', 'One organisation'),
      switcherLink('many', 'Many, with the search'),
      switcherLink('search', 'The search typed, “even”'),
      switcherLink('no-match', 'No match, “Belém”'),
    ],
  },
  {
    name: 'The offer and the invitations',
    states: [
      switcherLink('offer', 'The offer, unasked'),
      switcherLink('offer-asked', 'The offer, asked'),
      switcherLink('offer-unavailable', 'The offer, unavailable'),
      switcherLink('invitation', 'An invitation, opened'),
      switcherLink('joined', 'An invitation, joined'),
      switcherLink('declined', 'An invitation, declined'),
      switcherLink('failed', 'An invitation, the answer failed'),
      switcherLink('busy', 'An invitation, joining'),
      switcherLink('expired', 'An invitation, refused: expired'),
      switcherLink('withdrawn', 'An invitation, refused: withdrawn'),
      switcherLink('managed', 'An invitation, managed by Ire Events: refused'),
    ],
  },
  { name: 'Access paused', states: [switcherLink('paused', 'Access paused, none current')] },
];
