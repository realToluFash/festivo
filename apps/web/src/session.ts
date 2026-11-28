import {
  type Account,
  ApiError,
  ApiUnreachableError,
  type Awaiting,
  type JoinRequest,
  type LinkedProvider,
  type Membership,
  type OutsideEvent,
  type PausedOrganisation,
  type Problem,
  gateOf,
  heldByDevice,
  primaryEmailAddress,
} from '@soirely/api-client';
import {
  chooseOrganisation,
  choosePaused,
  forgetEventsTab,
  holdsAnywhere,
  rememberedEntry,
  rememberedFor,
  roleHolds,
} from '@soirely/domain';
import i18next from 'i18next';
import { useSyncExternalStore } from 'react';

import { followAccount } from './accountLanguage.ts';
import { GATED, SIGNED_OUT, api } from './api.ts';
import { followAccountScheme, schemeIn } from './colourScheme.ts';
import { currentLocale } from './i18n/index.ts';
import { forgetKept } from './tabKept.ts';

export interface Session {
  /** The account's id, which names its own realtime topics. */
  userId: string;
  name: string;
  email: string;
  verified: boolean;
  /** Through the details screen; the product stays behind the gate until it is. */
  complete: boolean;
  /** The gate it is behind, or null once it is through both. */
  awaiting: Awaiting | null;
  /** The providers that vouch for this account, such as Google, each with its address. */
  providers: readonly LinkedProvider[];
  /** False for an account that has only ever signed in with Google or Apple. */
  hasPassword: boolean;
  needsOrganisation: boolean;
  /** The one this device is working in; null for an account in no organisation. */
  organisation: Membership | null;
  /** The organisation's country from `/me`, which the gate lets through where `/api/orgs` is not. */
  organisationCountry: string | null;
  organisations: readonly Membership[];
  /** Shown in place of the product: the organisation this device was in, whose access is now paused (sc-564). */
  pausedIn?: PausedOrganisation | null;
  /** The account's IANA zone; null while times reach the person in UTC (sc-868). */
  timezone: string | null;
  /** The request to join at its domain that an account in no organisation is waiting on (sc-561). */
  waitingFor: JoinRequest | null;
  /** The events it holds from outside an organisation, the one it lands on first (sc-71). */
  outsideEvents?: readonly OutsideEvent[];
  /** A door code's account (sc-72): no address to prove, so no gate, and nothing but its events and itself to read. */
  heldByDevice?: boolean;
  /** When this browser's session ends with the account's grants (sc-4235); null for one that does not. */
  signedOutAt?: string | null;
}

export type SessionState =
  | { status: 'unknown' }
  | { status: 'checking' }
  | { status: 'signedIn'; session: Session }
  | { status: 'unreachable'; retrying: boolean }
  | {
      status: 'signedOut';
      ended: boolean;
      /** This tab never held a session, so the page it opened is where sign-in lands (sc-612). */
      arrived?: true;
      timedOut?: TimedOut;
      providerOnly?: ProviderOnly;
      ssoRequired?: SsoRequired;
    };

/** An organisation's inactivity rule ended the session (sc-69): sign-in names it and keeps the address. */
export interface TimedOut {
  organisation: string;
  days: number;
  email: string;
}

/** An organisation's Google-or-Apple-only rule turned a password away (sc-69): sign-in names it, keeps the address and shows the linked buttons. */
export interface ProviderOnly {
  organisation: string;
  providers: string[];
  email: string;
}

/** Per device and for the account that left it, as the switcher promises: "Soirely remembers your choice on this device" (sc-86373). */
const ACTIVE_ORGANISATION = 'soirely.organisation';

let state: SessionState = { status: 'unknown' };
let generation = 0;
const listeners = new Set<() => void>();

export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useSession(): Session {
  const current = useSessionState();

  if (current.status !== 'signedIn') {
    throw new Error(
      'useSession() was called outside the signed-in tree. Render it under AppLayout, which guards it.',
    );
  }

  return current.session;
}

export function can(session: Session, permission: string): boolean {
  return session.organisation != null && roleHolds(session.organisation, permission);
}

/** Held by the organisation role or by a role on any one event: who reaches a page the API opens either way (sc-3901). */
export function canAnywhere(session: Session, permission: string): boolean {
  return session.organisation != null && holdsAnywhere(session.organisation, permission);
}

/** On one event, a Member holds what their role on it gives, not the organisation's: the event read says which (sc-29915). */
export function canOn(event: { permissions: readonly string[] }, permission: string): boolean {
  return event.permissions.includes(permission);
}

/** The event the account holds from outside an organisation at this id, a member's of another organisation's event as much as a no-organisation account's (sc-71, sc-68438); null for any other. */
export function outsideOn(
  session: Session,
  eventId: string | null | undefined,
): OutsideEvent | null {
  if (session.pausedIn != null) return null;

  return session.outsideEvents?.find((one) => one.id === eventId) ?? null;
}

let restoring: Promise<void> = Promise.resolve();

/** Settles once the cookie's account is known, so a page that called it second still waits for the first ask. */
export function restoreSession(): Promise<void> {
  if (state.status !== 'unknown') return restoring;

  set({ status: 'checking' });
  restoring = askForAccount();

  return restoring;
}

/** Stays on the unreachable screen while asking, so the button can say it is trying. */
export async function retrySession(): Promise<void> {
  if (state.status !== 'unreachable' || state.retrying) return;

  set({ status: 'unreachable', retrying: true });
  await askForAccount();
}

async function askForAccount(): Promise<void> {
  const asked = generation;

  try {
    await adoptAccount(await api.me(), asked);
  } catch (error) {
    if (generation !== asked) return;

    set(
      error instanceof ApiUnreachableError
        ? { status: 'unreachable', retrying: false }
        : { status: 'signedOut', ended: false, arrived: true },
    );
  }
}

/** The account, with its organisations; one behind the onboarding gate is not asked for them. */
export async function adoptAccount(account: Account, asked = generation): Promise<void> {
  const askedIn = currentLocale();
  const { organisations, paused } =
    account.verified && account.complete
      ? await api.organisationsWithPaused()
      : { organisations: [], paused: [] };
  await followAccount(account);
  if (generation !== asked) return;

  // A sign-in's answer carries the colours as /me does, so a new browser opens in them without a reload.
  followAccountScheme(schemeIn(account));
  const session = sessionFrom(account, organisations, paused);
  set({ status: 'signedIn', session });
  rememberWorkingIn(session);
  // The account's language, followed after this read and before the session was set (sc-9267).
  if (currentLocale() !== askedIn) void rereadOrganisations();
}

/** After a gate has been passed, or the API says one has closed: the account read afresh. */
export async function refreshAccount(): Promise<void> {
  await askForAccount();
}

/** The events held from outside, read again: one whose grant ended or was revoked is gone from the list (sc-68438). */
export async function rereadOutsideEvents(): Promise<string | null> {
  const asked = generation;
  const { outsideEvents, signedOutAt = null } = await api.me();
  if (generation !== asked || state.status !== 'signedIn') return signedOutAt;

  set({ status: 'signedIn', session: { ...state.session, outsideEvents, signedOutAt } });
  return signedOutAt;
}

/** The password and linked providers, read again; a failed read rejects and leaves the page where it is. */
export async function rereadCredentials(): Promise<void> {
  const asked = generation;
  const { hasPassword, providers } = await api.me();
  if (generation !== asked || state.status !== 'signedIn') return;

  set({ status: 'signedIn', session: { ...state.session, hasPassword, providers } });
}

/** The account as a page just read it: the session's name, address and time zone follow, so its cards draw what was fetched. */
export function followAccountRead(account: Account): void {
  if (state.status !== 'signedIn') return;

  const { session } = state;
  followAccountScheme(schemeIn(account));
  set({
    status: 'signedIn',
    session: {
      ...session,
      name: account.name,
      email: primaryEmailAddress(account) ?? session.email,
      timezone: account.timezone,
    },
  });
}

let rereads = 0;

const movedOn = new Set<(organisation: Membership) => void>();

/** Told when a reread finds the organisation shown gone and opens another in its place. */
export function onMovedOn(listener: (organisation: Membership) => void): () => void {
  movedOn.add(listener);

  return () => {
    movedOn.delete(listener);
  };
}

/** Read again on a language pick (sc-9267), a move or a return to the tab (sc-16229); a failed read leaves them as they were. */
export async function rereadOrganisations(): Promise<void> {
  if (
    state.status !== 'signedIn' ||
    state.session.awaiting != null ||
    state.session.heldByDevice === true
  )
    return;

  const asked = generation;
  const known = state.session.organisations;
  rereads += 1;
  const reread = rereads;
  const read = await api.organisationsWithPaused().catch(() => null);
  if (
    read == null ||
    generation !== asked ||
    reread !== rereads ||
    state.status !== 'signedIn' ||
    state.session.organisations !== known
  )
    return;

  const current = state.session;
  const kept = read.organisations.find((membership) => membership.id === current.organisation?.id);

  if (kept == null && current.organisation != null && current.pausedIn == null) {
    const organisation = chooseOrganisation(read.organisations, recalled(current.userId));
    const pausedIn = choosePaused(read.paused, current.organisation.id, read.organisations.length);
    const session = { ...current, organisations: read.organisations, organisation, pausedIn };

    forgetEventsTab();
    forgetKept();
    set({ status: 'signedIn', session });
    rememberWorkingIn(session);
    if (organisation != null && pausedIn == null)
      for (const listener of movedOn) listener(organisation);

    return;
  }

  const organisation = kept ?? current.organisation;
  const pausedIn =
    current.pausedIn == null
      ? null
      : (read.paused.find((paused) => paused.id === current.pausedIn?.id) ?? current.pausedIn);

  set({
    status: 'signedIn',
    session: { ...current, organisations: read.organisations, organisation, pausedIn },
  });
}

/** Where a signed-in account belongs: the gate it is behind, or the product. */
export function landingFor(gate: Awaiting | null): string {
  if (gate === 'email') return '/verify-email';
  if (gate === 'phone') return '/verify-phone?from=onboarding';

  return gate === 'details' || gate === 'approval' ? '/complete-profile' : '/app';
}

/** Before the organisations are read, so the next read opens in this one: an invitation accepted while onboarding. */
export function rememberOrganisation(account: string, id: string): void {
  remember(account, id);
}

/** Remembered on this device, so the next visit opens where this one left off. */
export function switchOrganisation(id: string): void {
  if (state.status !== 'signedIn') return;

  const organisation = state.session.organisations.find((membership) => membership.id === id);

  if (organisation == null) return;

  remember(state.session.userId, id);
  forgetEventsTab();
  forgetKept();
  set({ status: 'signedIn', session: { ...state.session, organisation, pausedIn: null } });
}

/** An invitation accepted in the product: the organisation joins the list, and nobody is moved into it. */
export function joinOrganisation(joined: Membership): void {
  if (state.status !== 'signedIn') return;

  const current = state.session;
  const organisations = [
    ...current.organisations.filter((membership) => membership.id !== joined.id),
    joined,
  ];

  set({ status: 'signedIn', session: { ...current, organisations } });
}

/** After an edit, so the switcher and every page read the new name at once. */
export function replaceOrganisation(next: Membership): void {
  if (state.status !== 'signedIn') return;

  const current = state.session;
  const organisations = current.organisations.map((membership) =>
    membership.id === next.id ? next : membership,
  );
  const organisation =
    organisations.find((membership) => membership.id === current.organisation?.id) ?? null;

  set({ status: 'signedIn', session: { ...current, organisations, organisation } });
}

export function forgetSession(ended = false, why?: Problem): void {
  const timedOut = timedOutBy(why);
  const providerOnly = providerOnlyBy(why);
  const ssoRequired = ssoRequiredBy(why);
  const arrived = ended && state.status !== 'signedIn';

  generation += 1;
  forgetKept();
  set({
    status: 'signedOut',
    ended,
    ...(arrived ? { arrived } : {}),
    ...(timedOut == null ? {} : { timedOut }),
    ...(providerOnly == null ? {} : { providerOnly }),
    ...(ssoRequired == null ? {} : { ssoRequired }),
  });
}

/** A test starts afresh: an answer still in flight from the test before it is dropped, not adopted. */
export function __setSessionState(next: SessionState): void {
  generation += 1;
  set(next);
}

function timedOutBy(why: Problem | undefined): TimedOut | undefined {
  if (why == null || !new ApiError(why).is('session_timed_out')) return undefined;
  if (why.organisation == null || why.days == null) return undefined;

  return { organisation: why.organisation, days: why.days, email: why.email ?? '' };
}

/** The `oauth_only` refusal, from a sign-in, a completed reset or a session the rule ended. */
export function providerOnlyBy(why: Problem | undefined): ProviderOnly | undefined {
  if (why == null || !new ApiError(why).is('oauth_only') || why.organisation == null)
    return undefined;

  return { organisation: why.organisation, providers: why.providers ?? [], email: why.email ?? '' };
}

export interface SsoRequired {
  organisation: string;
  provider: string;
  email: string;
}

/** Required single sign-on's refusal (sc-610), from any way in or a session it ended. */
export function ssoRequiredBy(why: Problem | undefined): SsoRequired | undefined {
  if (why?.organisation == null || why.provider == null) return undefined;
  if (!new ApiError(why).is('sso_sign_in_required')) return undefined;

  return { organisation: why.organisation, provider: why.provider, email: why.email ?? '' };
}

function sessionFrom(
  account: Account,
  organisations: readonly Membership[],
  paused: readonly PausedOrganisation[],
): Session {
  const remembered = recalled(account.id);

  return {
    userId: account.id,
    name: account.name,
    email: primaryEmailAddress(account) ?? '',
    verified: account.verified,
    complete: account.complete,
    awaiting: gateOf(account),
    heldByDevice: heldByDevice(account),
    providers: account.providers,
    hasPassword: account.hasPassword,
    needsOrganisation: account.needsOrganisation,
    organisations,
    organisationCountry: account.organisationCountry,
    timezone: account.timezone,
    waitingFor: account.waitingFor,
    outsideEvents: account.outsideEvents,
    signedOutAt: account.signedOutAt,
    organisation: chooseOrganisation(organisations, remembered),
    pausedIn: choosePaused(paused, remembered, organisations.length),
  };
}

function recalled(account: string): string | null {
  try {
    return rememberedFor(window.localStorage.getItem(ACTIVE_ORGANISATION), account);
  } catch {
    return null;
  }
}

/** Opened by default as much as by choice, so a pause there shows its page at the next open rather than another organisation (sc-86056); another account's is let go, so it does not come back after this one (sc-86373). */
function rememberWorkingIn(session: Session): void {
  if (session.organisation != null && session.pausedIn == null)
    remember(session.userId, session.organisation.id);
  else if (recalled(session.userId) == null) forgetRemembered();
}

function remember(account: string, id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_ORGANISATION, rememberedEntry(account, id));
  } catch {
    // Private windows refuse storage; the choice then lasts as long as the page.
  }
}

function forgetRemembered(): void {
  try {
    window.localStorage.removeItem(ACTIVE_ORGANISATION);
  } catch {
    // Nothing was kept where storage is refused.
  }
}

function set(next: SessionState): void {
  state = next;

  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener(SIGNED_OUT, (event) => {
    forgetSession(true, (event as CustomEvent<Problem | undefined>).detail);
  });

  i18next.on('languageChanged', () => void rereadOrganisations());

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void rereadOrganisations();
  });

  // The API said the account is behind a gate this session did not know about, so read it again.
  window.addEventListener(GATED, () => {
    if (state.status === 'signedIn' && state.session.heldByDevice !== true) void refreshAccount();
  });
}
