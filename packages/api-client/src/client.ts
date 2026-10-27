/**
 * One fetch layer, used by both clients.
 *
 * Base URL, auth header, token refresh, the correlation id and the error shape
 * are decided once here. Written per client, each would grow its own error path
 * and most of those would never be exercised.
 */
import {
  type EventPhase,
  type EventState,
  type EventType,
  EVENT_PHASES,
  EVENT_STATES,
  isEventType,
  type ServerClock,
  serverClock,
} from '@soirely/domain';

import { ApiError, ApiUnreachableError, type Problem, toProblem } from './problem.ts';

/** See docs/architecture/sessions.md. */
export type RefreshTokenDelivery = 'body' | 'cookie';

export interface IssuedTokens {
  accessToken: string;
  /** Absent in cookie mode. */
  refreshToken?: string;
  refreshExpiresAt: string;
  sessionId: string;
}

export interface SignedIn {
  tokens: IssuedTokens;
  account: Account;
  /** A provider was linked to this existing account just now, which the person is told once. */
  linked: boolean;
}

/** A first factor that passed on an account with two-factor on: no tokens until a code does. */
export interface TwoFactorChallenge {
  kind: 'twoFactor';
  challenge: string;
  expiresAt: string;
  /** The address the code is for, shown as "the 6-digit code for <address>". */
  email: string;
}

export type SignInOutcome = SignedIn | TwoFactorChallenge;

/** What a try on the current code would meet, read without spending one. */
export type CodeState = 'live' | 'expired' | 'exhausted';

/** What "Check your email" opens on: the resend countdown, and whether the code is still worth typing. */
export interface CodeOpening {
  cooldownSeconds: number;
  codeState: CodeState;
}

/** How a phone's code went (sc-750); null for a code from before there was a choice, which was texted. */
export type PhoneCodeRoute =
  'whatsapp' | 'sms_fallback' | 'sms_chosen' | 'sms_preferred' | 'sms_only';

export interface PhoneCodeOpening extends CodeOpening {
  route: PhoneCodeRoute | null;
}

export type RecoveryStatus =
  'proving' | 'waiting' | 'approved' | 'turned_down' | 'expired' | 'cancelled';

/** A request to get back in without the second factor (sc-509); `asked` and `expires` are written for the reader. */
export interface RecoveryState {
  status: RecoveryStatus;
  email: string;
  phone: string | null;
  organisations: string[];
  /** No organisation has anybody left to answer: the screens show the nobody line, not names. */
  nobody: boolean;
  supportAddress: string;
  askedAt: string | null;
  asked: string | null;
  expiresAt: string | null;
  expires: string | null;
  codes: { state: CodeState; cooldownSeconds: number; route: PhoneCodeRoute | null } | null;
}

/** What the start screen names before anything is sent, and an open request to carry on with. */
export interface RecoveryOpening {
  email: string | null;
  phone: string | null;
  organisations: string[];
  nobody: boolean;
  supportAddress: string;
  open: { recovery: string; state: RecoveryState } | null;
}

/** One request on an owner's card: never a code, only what was proved and when. */
export type NotificationCategory =
  'guest_replies' | 'messages' | 'event_day' | 'event_changes' | 'money' | 'account_security';

/** One bell item (sc-3980): `lines` are drawn one per row, as sent; `muted` and `eventAvailable` are the server's. */
export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  lines: string[];
  eventId: string | null;
  eventName: string | null;
  eventAvailable: boolean;
  muted: boolean;
  place: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unreadCount: number;
  next: string | null;
}

export interface NotificationSetting {
  category: NotificationCategory;
  push: { on: boolean; switchable: boolean };
  email: { on: boolean; switchable: boolean };
}

export interface RealtimeSubscription {
  token: string;
  expiresAt: string;
}

export interface RecoveryRequest {
  id: string;
  name: string;
  email: string;
  provedPhone: boolean;
  own: boolean;
  organisations: string[];
  asked: string | null;
  expires: string | null;
}

/** A password sign-up waiting on its emailed code; `registration` is its one-day handle. */
export interface PendingRegistration {
  registration: string;
  email: string;
}

export interface TwoFactorStatus {
  on: boolean;
  recoveryCodesLeft: number;
}

export interface TwoFactorEnrolment {
  secret: string;
  otpauthUri: string;
  qrSvg: string;
}

export type SecondFactor = { code: string } | { recoveryCode: string };

export type Provider = 'google' | 'apple';

/** A provider on the account, and the address it vouched for: null for one linked before that was kept. */
export interface LinkedProvider {
  provider: Provider;
  email: string | null;
}

/** A provider sign-in run while signed in: an app's ID token, the web's code, or Android's Apple handle. */
export type ProviderSignInAttempt =
  | { idToken: string; nonce: string }
  | { code: string; codeVerifier: string; redirectUri: string; nonce: string }
  | { handle: string; codeVerifier: string; nonce: string };

/** What changing how somebody signs in asks for: this client's proof, good until `expiresAt`. */
export interface RecentProof {
  proof: string;
  expiresAt: string;
}

/** One IANA zone as Settings > Account lists it. */
export interface TimeZoneOption {
  id: string;
  city: string;
  ianaCity: string;
  aliases: string[];
  formerName: string | null;
  country: string;
  /** Its offset now, such as `+01:00`. */
  offset: string;
}

export interface Health {
  status: string;
  checks: Record<string, { status: string; error?: string }>;
}

export interface LinkedAddress {
  id: string;
  address: string;
  verified: boolean;
  primary: boolean;
}

export interface LinkedPhone {
  id: string;
  /** E.164. */
  number: string;
  /** The country it was entered for; null for a number saved before that was recorded. */
  countryCode: string | null;
  verified: boolean;
  primary: boolean;
  /** Texted to replace the primary, which it does only once it is verified. */
  pending: boolean;
}

export interface Account {
  id: string;
  name: string;
  businessName: string | null;
  countryCode: string | null;
  /** The country of the organisation it belongs to, readable behind the onboarding gate. */
  organisationCountry: string | null;
  locale: string | null;
  /** An IANA zone; null until a device has said one, while times reach the person in UTC. */
  timezone: string | null;
  verified: boolean;
  complete: boolean;
  /** The details screen asks for an organisation: a self-registered account in none. */
  needsOrganisation: boolean;
  /** False for an account that has only ever signed in with Google or Apple. */
  hasPassword: boolean;
  /** The providers that vouch for this account, such as Google, each with its address. */
  providers: LinkedProvider[];
  /** Two-factor was turned off by an approved recovery: asked to set it up again (sc-509). */
  twoFactorSetupPrompt: boolean;
  emailAddresses: LinkedAddress[];
  phoneNumbers: LinkedPhone[];
  /** An account in no organisation that asked to join one at its domain (sc-561), until somebody answers. */
  waitingFor: JoinRequest | null;
}

export interface JoinOffer {
  id: string;
  name: string;
}

export interface JoinRequest {
  organisation: JoinOffer;
  askedAt: string;
}

export interface JoinOffers {
  domain: string | null;
  offers: JoinOffer[];
  /** A request still waiting, while which nothing else is offered. */
  request: JoinRequest | null;
}

/** Settings > General's Requests to join (sc-562): the link in full while it is on. */
export interface RequestLink {
  on: boolean;
  url: string | null;
}

/** Why somebody signed in cannot ask through a request link: they belong, they wait, or they were turned down lately. */
export type RequestStanding = 'member' | 'waiting' | 'cooling_off';

/** What a request link opens onto (sc-562). Only the organisation's name: a dead link is refused `request_link_dead`. */
export interface RequestLinkPreview {
  organisation: { name: string };
  standing: RequestStanding | null;
  /** While cooling off, when they may ask again. */
  askAgainFrom: string | null;
}

/** Settings > General's Company domain joining (sc-561): `stopped` for one another organisation proved. */
export interface CompanyDomains {
  domains: { domain: string; stopped: boolean }[];
  most: number;
  ownAddress: string | null;
}

export interface Organisation {
  id: string;
  name: string;
  countryCode: string;
  currency: string;
  timezone: string;
  contactAddress: string;
  /** What an invitation to somebody with no account is written in (sc-2914). */
  locale: string;
}

/** A seeded role is named by `seededAs`, which each client words itself; a custom one by `name`. */
export interface MemberRole {
  id: string;
  seededAs: string | null;
  name: string | null;
}

/** A role on Settings > Roles (sc-66): Owner is `fixed`, and only a custom role is `removable`. */
export interface OrganisationRole extends MemberRole {
  fixed: boolean;
  removable: boolean;
  permissions: string[];
  holders: number;
  /** Whom `holders` counts, alphabetical by name, ties by email (sc-6447). */
  holderNames: RoleHolder[];
}

/** A name as its person wrote it, never translated; a suspended holder still holds the role. */
export interface RoleHolder {
  name: string;
  suspended: boolean;
}

/** Every role, and every registered permission grouped by area, in the order the grid shows them. */
export interface RolesCatalogue {
  roles: OrganisationRole[];
  areas: { area: string; permissions: string[] }[];
}

/** Stored, as /event-states.json declares them; what the clock makes of it is its phase (sc-3584). */
export type EventStatus = EventState;

/** `startsAt` and `endsAt` carry the offset in force at that moment in `timeZone` (sc-1486). */
export interface OrganisationEvent {
  id: string;
  organisationId: string;
  name: string;
  type: EventType;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  /** The calendar dates in `timeZone` the event touches, at least 1; an end at 00:00 does not touch the new date (sc-98). */
  dayCount: number;
  currency: string;
  cover: EventCover | null;
  /** Null until a venue is added: the page says "Venue to be confirmed" (sc-3589). */
  venue: EventVenue | null;
  /** Null while it is a Draft. */
  madeLiveAt: string | null;
  /** The server's, as the page shows it on load; a client works one out only to flip it at a boundary (sc-3585). */
  phase: EventPhase;
  /** The end, or when it was ended or called off; null until it is Finished. */
  concludedAt: string | null;
  createdAt: string;
}

/** The organiser's photo, re-encoded as WebP at each width. `position` is how far down the photo the 16:9 frame sits, 0 to 100. */
export interface EventCover {
  position: number;
  description: string | null;
  sizes: { width: number; url: string }[];
}

/** Where the browser PUTs the photo, with `contentType` as its Content-Type; `key` then names it to setEventCover. */
export interface CoverUpload {
  url: string;
  key: string;
  contentType: string;
}

export interface CoverChange {
  uploadKey?: string;
  position: number;
  description: string | null;
}

export interface EventVenue {
  name: string | null;
  address: VenueAddress | null;
}

/** A typed address carries `formatted` alone; a picked one its parts and coordinates too, where the lookup knew them. */
export interface VenueAddress {
  formatted: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Both blank removes the venue. `addressId` is the suggestion the address was picked from; without it the address is saved as typed. */
export interface VenueInput {
  name: string | null;
  address: string | null;
  addressId?: string | null;
}

/** `startsAt` and `endsAt` are local to `timeZone`, with no offset: "2026-11-14T16:00". */
export interface NewEvent {
  name: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  currency: string;
  venue?: VenueInput | null;
}

/** One of the address lookup's suggestions (sc-53): the place's name, and the rest of its line. */
export interface AddressSuggestion {
  id: string;
  text: string;
  secondaryText: string | null;
}

export interface PickedAddress extends VenueAddress {
  timeZone: string | null;
}

/** What an edit sends: any of the fields, those left out keep their value (sc-3587). */
export type EventChanges = Partial<NewEvent>;

/** An event with its `ETag`, which an edit sends back as `If-Match`. */
export interface TaggedEvent {
  event: OrganisationEvent;
  tag: string;
}

export interface Membership extends Organisation {
  role: MemberRole;
  /** What this role holds here, every registered one for Owner (sc-66): what a client may show. */
  permissions: string[];
  /** Held by the role but kept back until this account turns on two-factor (sc-69). */
  withheldUntilTwoFactor: string[];
  /** Under a Google-or-Apple-only rule with no provider linked: may read, not change (sc-69). */
  readOnlyUntilLinked: boolean;
  /** While this organisation requires two-factor of everyone and this account has none (sc-609). */
  twoFactorDue: TwoFactorDue | null;
  signInRules: OrganisationSignInRules;
}

/** `written` is the instant in the account's own zone, as sc-868 writes it: "Saturday, Oct 24 at 14:20 WAT". */
export interface TwoFactorDeadline {
  at: string;
  written: string;
}

/** `manual` is somebody who manages members suspending them (sc-3575): it is never removed by itself, and its organisation is never listed as paused. */
export type SuspensionReason =
  'address_gone' | 'domain_closed' | 'domain_managed_elsewhere' | 'manual';

/** Why and since when a member is suspended: by the company domain (sc-564) or by hand (sc-3575); each instant in the reader's zone, and no removal for the only owner. */
export interface Suspension {
  reason: SuspensionReason;
  domain: string | null;
  since: TwoFactorDeadline;
  removesAt: TwoFactorDeadline | null;
  /** The organisation's only Owner: never removed, and restored by anyone holding members.manage. */
  onlyOwner: boolean;
}

/** An organisation the account's access to is paused in: no grant at all, only why. */
export interface PausedOrganisation extends Organisation {
  suspension: Suspension;
  /** An open claim to own it, for a suspended Owner to stop (sc-6640). */
  ownerClaim: OwnerClaim | null;
}

export type OwnerClaimState = 'no_owner' | 'open' | 'found' | 'closed';

/** An Administrator becoming the owner while no Owner is active (sc-6640); each instant as the reader writes it. */
export interface OwnerClaim {
  id: string;
  claimant: { id: string; name: string; email: string | null };
  mine: boolean;
  domain: string;
  record: { type: 'TXT'; name: string; value: string } | null;
  startedAt: TwoFactorDeadline;
  lapsesAt: TwoFactorDeadline;
  foundAt: TwoFactorDeadline | null;
  passesAt: TwoFactorDeadline | null;
}

/** The banner at the top of Members, only for an active Administrator while no Owner is active. */
export interface OwnerClaimBanner {
  state: OwnerClaimState;
  domain: string | null;
  claim: OwnerClaim | null;
  /** Once a claim is stopped, self-serve is closed for good. */
  stopped: { by: string; claimant: string; mine: boolean; at: TwoFactorDeadline } | null;
  lapsed: { outcome: 'unfound' | 'record_removed'; at: TwoFactorDeadline } | null;
}

export interface TwoFactorDue extends TwoFactorDeadline {
  /** Past the deadline: nothing in the organisation opens until two-factor is on. */
  overdue: boolean;
}

/** An organisation's sign-in rules (sc-69); a null timeout is no limit. */
export interface OrganisationSignInRules {
  providerOnly: boolean;
  inactivityTimeoutDays: number | null;
  administratorsNeedTwoFactor: boolean;
  everyoneNeedsTwoFactor: boolean;
  changedAt: string | null;
}

export type SignInRulesChanges = Partial<Omit<OrganisationSignInRules, 'changedAt'>>;

export interface SignInRuleChange {
  /** The saved change it came from; one save that changes two rules gives two rows with the same entry. */
  entry: string;
  at: string;
  by: { name: string; role: MemberRole | null };
  rule: (typeof RULES)[number];
  now: boolean | number | null;
  was: boolean | number | null;
}

export interface SignInRulesPage extends OrganisationSignInRules {
  inactivityChoices: number[];
  changes: SignInRuleChange[];
  /** Members with no Google or Apple linked, never the caller; only for a caller who may change the rules. */
  passwordOnly: RulesMember[] | null;
  /** Members with no two-factor, never the caller; only for a caller who may change the rules (sc-609). */
  withoutTwoFactor: RulesMember[] | null;
  /** Seven days from the switch-on, or from now while it is off. */
  twoFactorDeadline: TwoFactorDeadline | null;
  /** The shortest limit across the caller's organisations, which may be another organisation's. */
  inactivityLimit: InactivityLimit | null;
  /** Whether the caller has two-factor, without which requiring it of administrators is refused. */
  ownTwoFactor: boolean;
  /** Whether the caller has Google or Apple linked, without which requiring it is refused. */
  ownProvider: boolean;
}

export interface RulesMember {
  userId: string;
  name: string;
  role: MemberRole;
}

export interface InactivityLimit {
  organisationId: string;
  organisation: string;
  days: number;
}

export type OrganisationChanges = Partial<Omit<Organisation, 'id'>>;

export type InvitationRefusal =
  | 'invitation_expired'
  | 'invitation_revoked'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'organisation_deleted';

/** What the link opens on: `forYou` is null signed out, and says whether this account may answer it. */
export interface InvitationPreview {
  id: string;
  /** The id is null once the organisation is deleted; its name is kept to say what is gone. */
  organisation: { id: string | null; name: string };
  email: string;
  role: MemberRole | null;
  invitedBy: { name: string } | null;
  expiresAt: string;
  refusal: InvitationRefusal | null;
  forYou: boolean | null;
  signedInAs: string | null;
}

export type MemberStatus = 'pending_approval' | 'active' | 'suspended' | 'left_or_removed';

export type MemberChannel =
  'invitation' | 'self_created' | 'join_code' | 'domain' | 'request' | 'directory' | 'settings';

export interface MemberPerson {
  id: string;
  name: string;
}

export interface MembershipStep {
  from: MemberStatus | null;
  to: MemberStatus;
  channel: MemberChannel;
  by: MemberPerson | null;
  at: string;
}

/** A row on Settings > Members; `former` tells left from removed, which share one state. */
export interface OrganisationMember {
  id: string;
  user: { id: string; name: string; email: string | null };
  role: MemberRole;
  status: MemberStatus;
  former: 'left' | 'removed' | null;
  channel: MemberChannel | null;
  /** What somebody waiting wrote when they asked through the request link (sc-562). */
  message: string | null;
  since: string | null;
  /** While waiting for approval (sc-392): the instant it is removed if nobody answers, and that instant as the caller reads it. */
  removesAt: { at: string; written: string } | null;
  invitedBy: MemberPerson | null;
  invitedAt: string | null;
  self: boolean;
  history: MembershipStep[];
  suspension: Suspension | null;
}

export type SentInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface SentInvitation {
  id: string;
  email: string;
  role: MemberRole | null;
  invitedBy: MemberPerson | null;
  status: SentInvitationStatus;
  sentAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

export interface MembersList {
  members: OrganisationMember[];
  invitations: SentInvitation[];
}

/** What deleting an organisation destroys, and until when support can restore it, as the reader writes it. */
export interface OrganisationDeletion {
  events: number;
  guests: number;
  members: number;
  restoreClosesAt: string;
  restoreCloses: string;
}

/** What an event's delete asks for: its name typed unless it is a Draft, and until when support can restore it (sc-3592). */
export interface EventDeletion {
  needsName: boolean;
  restoreClosesAt: string;
  restoreCloses: string;
}

/** The two codes the onboarding gate refuses with; each names the screen that passes it. */
export type Gate = 'account_unverified' | 'profile_incomplete';

export interface ProfileDetails {
  name: string;
  /** Sent only when the account `needsOrganisation`. */
  organisationName?: string;
  countryCode?: string;
  timezone?: string;
  /** Optional; an empty number means no phone, and removes the one there was. */
  phoneCountryCode?: string;
  phoneNumber?: string;
  askToJoin?: string;
}

/** `userAgent` and `ipAddress` are what the client claimed; nothing verifies either. */
export interface DeviceSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  startedAt: string;
  renewedAt: string;
  expiresAt: string;
}

export interface TokenStore {
  access(): string | null | Promise<string | null>;
  refresh(): string | null | Promise<string | null>;
  save(tokens: IssuedTokens): void | Promise<void>;
  clear(): void | Promise<void>;
}

export interface ClientOptions {
  /** Read lazily, so a client built at import time still honours runtime config. */
  baseUrl: () => string;
  tokens?: TokenStore;
  refreshTokenIn?: RefreshTokenDelivery;
  /** The reader's language, for the API's own locale negotiation. */
  locale?: () => string | null;
  /** The device's IANA zone, which sets an account's own until it has one (sc-868). */
  timeZone?: () => string | null;
  /** The app's own `Soirely/<version> (…)`, by which its sessions are named (sc-1242). A browser sends its own and cannot replace it. */
  userAgent?: string;
  /** The app's install identifier, by which a sign-in from a new device is told apart (sc-511). The web has a cookie instead. */
  device?: () => string | null;
  /** Called when refresh fails and the session is over, with the API's reason when it gave one, such as `session_timed_out`. */
  onSignedOut?: (why?: Problem) => void;
  /** Called when the API refuses a request because the account is behind an onboarding gate. */
  onGate?: (gate: Gate) => void;
  fetch?: typeof fetch;
  /** Fed every response's `Date` header; the shared one unless a test gives its own (sc-3585). */
  clock?: ServerClock;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the Authorization header — for sign-in and guest routes. */
  anonymous?: boolean;
}

export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly options: ClientOptions) {}

  async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    return (await this.exchange<T>(path, init)).body;
  }

  private async exchange<T>(
    path: string,
    init: RequestOptions,
  ): Promise<{ body: T; response: Response }> {
    let response = await this.send(path, init);

    // One retry, and only after a refresh that actually succeeded. Retrying a
    // 401 without that is an infinite loop against an expired session.
    if (
      response.status === 401 &&
      !init.anonymous &&
      this.options.tokens != null &&
      !(await isAnswer(response))
    ) {
      if (await this.refreshOnce()) {
        response = await this.send(path, init);
      }
    }

    if (!response.ok) {
      const error = new ApiError(await toProblem(response), response);

      if (error.is('account_unverified') || error.is('profile_incomplete')) {
        this.options.onGate?.(error.code as Gate);
      }

      throw error;
    }

    if (response.status === 204) return { body: undefined as T, response };

    return { body: (await response.json()) as T, response };
  }

  get<T>(path: string, init?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PATCH', body });
  }

  delete<T>(path: string, init?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  async signIn(email: string, password: string): Promise<SignInOutcome> {
    return this.signedIn('/api/auth/login', { email, password }, 'SignInController');
  }

  async verifyTwoFactor(challenge: string, factor: SecondFactor): Promise<SignedIn> {
    return this.signedInOnly(
      '/api/auth/two-factor/verify',
      { challenge, ...factor },
      'TwoFactorSignInController',
    );
  }

  async twoFactorStatus(): Promise<TwoFactorStatus> {
    return this.get<TwoFactorStatus>('/api/auth/two-factor');
  }

  /** A new secret, off until `activateTwoFactor` is sent a code it made. */
  async enrolTwoFactor(): Promise<TwoFactorEnrolment> {
    return this.post<TwoFactorEnrolment>('/api/auth/two-factor/enrol');
  }

  /** @returns the recovery codes, which the API shows this once */
  async activateTwoFactor(code: string): Promise<string[]> {
    return (await this.post<{ recoveryCodes: string[] }>('/api/auth/two-factor/activate', { code }))
      .recoveryCodes;
  }

  /** Takes an app code or an unused recovery code; every earlier recovery code stops working. */
  async newRecoveryCodes(code: string): Promise<string[]> {
    return (
      await this.post<{ recoveryCodes: string[] }>('/api/auth/two-factor/recovery-codes', { code })
    ).recoveryCodes;
  }

  async disableTwoFactor(code: string): Promise<void> {
    await this.post('/api/auth/two-factor/disable', { code });
  }

  /** The ID token a provider issued, and the nonce whose hash went to the provider with the request. */
  /** `name` is for Apple, which gives one only on the first authorisation and never puts it in the token. */
  async signInWithProvider(
    provider: Provider,
    idToken: string,
    nonce: string,
    name?: string,
  ): Promise<SignInOutcome> {
    return this.signedIn(
      `/api/auth/oauth/${provider}`,
      { idToken, nonce, ...(name == null || name === '' ? {} : { name }) },
      'ProviderSignInController',
    );
  }

  /** Android starts Apple here, so the API can tell Apple's form_post for the app from the web's. */
  async startAppleAttempt(state: string, codeChallenge: string): Promise<void> {
    await this.post('/api/auth/oauth/apple/attempts', { state, codeChallenge });
  }

  /** The App Link's one-time handle, with the verifier that started the attempt. */
  /** No redirect URI: the API redeems Apple's code at its own return route. */
  async exchangeAppleHandle(attempt: {
    handle: string;
    codeVerifier: string;
    nonce: string;
  }): Promise<SignInOutcome> {
    return this.signedIn('/api/auth/oauth/apple/handle', attempt, 'AppleAppController');
  }

  /** The web's way in: its code and PKCE verifier, which only the API can redeem, with the secret it holds. */
  async signInWithProviderCode(
    provider: Provider,
    attempt: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
      nonce: string;
      name?: string;
    },
  ): Promise<SignInOutcome> {
    const { name, ...rest } = attempt;

    return this.signedIn(
      `/api/auth/oauth/${provider}`,
      { ...rest, ...(name == null || name === '' ? {} : { name }) },
      'ProviderSignInController',
    );
  }

  /** The password, a linked provider, or a refused code's `pendingProof`, then `code`: proof for five minutes. */
  async prove(
    first:
      | { password: string }
      | { provider: Provider; signIn: ProviderSignInAttempt }
      | { pendingProof: string },
    code?: string,
  ): Promise<RecentProof> {
    const body = await this.post<{ proof?: unknown; expiresAt?: unknown }>('/api/auth/proof', {
      ...('password' in first
        ? { password: first.password }
        : 'pendingProof' in first
          ? { pendingProof: first.pendingProof }
          : { provider: first.provider, providerSignIn: first.signIn }),
      ...(code == null ? {} : { code }),
    });

    return {
      proof: typeof body.proof === 'string' ? body.proof : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** Refused as `provider_taken` when that provider account is another Soirely account's. */
  async linkProvider(
    provider: Provider,
    proof: string,
    signIn: ProviderSignInAttempt,
  ): Promise<LinkedProvider> {
    const body = await this.post<{ email?: unknown }>(`/api/auth/providers/${provider}`, {
      proof,
      providerSignIn: signIn,
    });

    return { provider, email: typeof body.email === 'string' ? body.email : null };
  }

  /** Refused as `last_sign_in_method` for the last way in; `thisDevice` says this session was one signed out. */
  async unlinkProvider(
    provider: Provider,
    proof: string,
  ): Promise<{ signedOut: number; thisDevice: boolean }> {
    const body = await this.post<{ signedOut?: unknown; thisDevice?: unknown }>(
      `/api/auth/providers/${provider}/unlink`,
      { proof },
    );

    return {
      signedOut: typeof body.signedOut === 'number' ? body.signedOut : 0,
      thisDevice: body.thisDevice === true,
    };
  }

  /** The same answer whether or not the address has an account; what happens next is only in the inbox. */
  async forgotPassword(email: string): Promise<void> {
    await this.post('/api/auth/password/forgot', { email });
  }

  /** Whose reset link this is; refused as `reset_link_invalid`, `reset_link_used` or `reset_link_expired`. */
  async checkResetLink(token: string): Promise<{ email: string; twoFactor: boolean }> {
    const body = await this.post<{ email?: unknown; twoFactor?: unknown }>(
      '/api/auth/password/reset/check',
      { token },
    );

    return {
      email: typeof body?.email === 'string' ? body.email : '',
      twoFactor: body?.twoFactor === true,
    };
  }

  /** With two-factor on, the code comes before the new password; nothing changes until it passes. */
  async passResetCode(token: string, factor: SecondFactor): Promise<void> {
    await this.post('/api/auth/password/reset/code', { token, ...factor });
  }

  /** A new password from a reset link, which signs this device in and every other one out. */
  async resetPassword(token: string, password: string): Promise<SignedIn> {
    return this.signedInOnly(
      '/api/auth/password/reset',
      { token, password },
      'PasswordRecoveryController',
    );
  }

  /** Signed in, knowing the current one: every other session ends, and `sessionId`'s stays. */
  async changePassword(change: {
    currentPassword: string;
    newPassword: string;
    sessionId: string | null;
  }): Promise<{ signedOut: number }> {
    const body = await this.patch<{ signedOut?: unknown }>('/api/auth/password', change);

    return { signedOut: typeof body.signedOut === 'number' ? body.signedOut : 0 };
  }

  /** A Google or Apple account adding a password: a code to the primary address first. Answers the cooldown. */
  async startSettingPassword(): Promise<number> {
    return cooldownFrom(await this.post<unknown>('/api/auth/password/set/start'));
  }

  /** Answers the one-time step-up token that only this client can then set the password with. */
  async passPasswordCode(code: string): Promise<string> {
    const body = await this.post<{ stepUp?: unknown }>('/api/auth/password/set/code', { code });

    return typeof body.stepUp === 'string' ? body.stepUp : '';
  }

  /** Only with the token a passed code gave this client; no session ends, since nothing was replaced. */
  async setPassword(newPassword: string, stepUp: string): Promise<void> {
    await this.post<undefined>('/api/auth/password/set', { newPassword, stepUp });
  }

  /** Signed in as sign-in is: the same tokens, the same account. */
  /** The same answer for every address, so it says nothing of who has an account; no session yet. */
  async register(email: string, name: string, password: string): Promise<PendingRegistration> {
    const body = await this.post<{ registration?: unknown; email?: unknown }>(
      '/api/auth/register',
      {
        email,
        name,
        password,
      },
    );

    if (typeof body?.registration !== 'string') {
      throw new Error(
        'The API answered /api/auth/register without a registration. Check RegisterController in services/api.',
      );
    }

    return {
      registration: body.registration,
      email: typeof body.email === 'string' ? body.email : email,
    };
  }

  /** The code proves the address: only now is the account made, and signed in. */
  /** From the sign-in code step only: the challenge proves the first factor passed. Sends nothing. */
  async recoveryOpening(challenge: string): Promise<RecoveryOpening> {
    const answer = await this.post<Record<string, unknown>>(
      '/api/auth/two-factor/recovery/opening',
      { challenge },
      { anonymous: true },
    );
    const state = asRecoveryState(answer.state);

    return {
      email: typeof answer.email === 'string' ? answer.email : null,
      phone: typeof answer.phone === 'string' ? answer.phone : null,
      organisations: strings(answer.organisations),
      nobody: answer.nobody === true,
      supportAddress: typeof answer.supportAddress === 'string' ? answer.supportAddress : '',
      open:
        typeof answer.recovery === 'string' && state != null
          ? { recovery: answer.recovery, state }
          : null,
    };
  }

  async startRecovery(challenge: string): Promise<{ recovery: string; state: RecoveryState }> {
    const answer = await this.post<Record<string, unknown>>(
      '/api/auth/two-factor/recovery',
      { challenge },
      { anonymous: true },
    );

    if (typeof answer.recovery !== 'string') {
      throw new Error(
        'The API started a recovery without its handle. Check TwoFactorRecoveryController.',
      );
    }

    return { recovery: answer.recovery, state: recoveryStateOf(answer) };
  }

  async recoveryState(recovery: string): Promise<RecoveryState> {
    return this.recoveryStep('state', { recovery });
  }

  async resendRecoveryCodes(recovery: string): Promise<RecoveryState> {
    return this.recoveryStep('resend', { recovery });
  }

  async textRecoveryCodeInstead(recovery: string): Promise<RecoveryState> {
    return this.recoveryStep('text-instead', { recovery });
  }

  /** Both codes together; a wrong one comes back as a violation on `emailCode` or `phoneCode`. */
  async proveRecovery(
    recovery: string,
    emailCode: string,
    phoneCode: string | null,
  ): Promise<RecoveryState> {
    return this.recoveryStep('prove', {
      recovery,
      emailCode,
      ...(phoneCode == null ? {} : { phoneCode }),
    });
  }

  /** Cancels the request and ends every session, as the emails' "This wasn't me" does. */
  async cancelRecovery(recovery: string): Promise<RecoveryState> {
    return this.recoveryStep('cancel', { recovery });
  }

  async recoveryNotMe(request: string, token: string): Promise<void> {
    await this.post<unknown>(
      '/api/auth/two-factor/recovery/not-me',
      { request, token },
      { anonymous: true },
    );
  }

  async recoveryRequests(): Promise<RecoveryRequest[]> {
    const body = await this.get<{ requests?: unknown }>('/api/auth/recovery-requests');

    return Array.isArray(body.requests)
      ? body.requests.map(asRecoveryRequest).filter((request) => request != null)
      : [];
  }

  async approveRecovery(id: string): Promise<void> {
    await this.post<unknown>(`/api/auth/recovery-requests/${encodeURIComponent(id)}/approve`);
  }

  async turnDownRecovery(id: string): Promise<void> {
    await this.post<unknown>(`/api/auth/recovery-requests/${encodeURIComponent(id)}/turn-down`);
  }

  async notifications(after?: string): Promise<NotificationFeed> {
    const body = await this.get<Record<string, unknown>>(
      after == null
        ? '/api/notifications'
        : `/api/notifications?after=${encodeURIComponent(after)}`,
    );

    return {
      items: notificationItems(body.items),
      unreadCount: typeof body.unreadCount === 'number' ? body.unreadCount : 0,
      next: optionalString(body.next),
    };
  }

  async readNotification(
    id: string,
  ): Promise<{ item: NotificationItem | null; unreadCount: number }> {
    const body = await this.post<Record<string, unknown>>(
      `/api/notifications/${encodeURIComponent(id)}/read`,
    );

    return {
      item: asNotificationItem(body.item),
      unreadCount: typeof body.unreadCount === 'number' ? body.unreadCount : 0,
    };
  }

  async readAllNotifications(): Promise<number> {
    const body = await this.post<{ unreadCount?: unknown }>('/api/notifications/read-all');

    return typeof body.unreadCount === 'number' ? body.unreadCount : 0;
  }

  async notificationSettings(): Promise<NotificationSetting[]> {
    return notificationSettingsOf(
      await this.get<{ categories?: unknown }>('/api/auth/notification-settings'),
    );
  }

  async setNotificationSetting(
    category: NotificationCategory,
    channel: 'push' | 'email',
    on: boolean,
  ): Promise<NotificationSetting[]> {
    return notificationSettingsOf(
      await this.put<{ categories?: unknown }>('/api/auth/notification-settings', {
        category,
        channel,
        on,
      }),
    );
  }

  async eventMuted(eventId: string): Promise<boolean> {
    const body = await this.get<{ muted?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/mute`,
    );

    return body.muted === true;
  }

  async muteEvent(eventId: string, muted: boolean): Promise<boolean> {
    const body = await this.put<{ muted?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/mute`,
      { muted },
    );

    return body.muted === true;
  }

  async realtimeSubscription(): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      '/api/realtime/subscriptions',
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  async dismissTwoFactorPrompt(): Promise<void> {
    await this.delete<unknown>('/api/auth/two-factor/setup-prompt');
  }

  private async recoveryStep(step: string, body: Record<string, unknown>): Promise<RecoveryState> {
    return recoveryStateOf(
      await this.post<unknown>(`/api/auth/two-factor/recovery/${step}`, body, { anonymous: true }),
    );
  }

  async confirmRegistration(registration: string, code: string): Promise<SignedIn> {
    return this.signedInOnly(
      '/api/auth/register/verify',
      { registration, code },
      'RegisterController',
    );
  }

  async registrationOpening(registration: string): Promise<CodeOpening> {
    return openingFrom(
      await this.get<unknown>('/api/auth/register/resend', { query: { registration } }),
    );
  }

  async resendRegistrationCode(registration: string): Promise<number> {
    return cooldownFrom(await this.post<unknown>('/api/auth/register/resend', { registration }));
  }

  /** The language switcher, signed in: the account's language, which every device and email then follow. */
  /** Refused with a `timezone` violation for a zone IANA doesn't list; nothing is saved then. */
  async setTimezone(timezone: string): Promise<void> {
    await this.put<unknown>('/api/auth/timezone', { timezone });
  }

  /** Every IANA zone, named in the reader's language, with its offset now. */
  async timezones(): Promise<TimeZoneOption[]> {
    const body = await this.get<{ timezones?: unknown }>('/api/auth/timezones');

    return Array.isArray(body.timezones)
      ? body.timezones
          .filter(
            (zone): zone is TimeZoneOption =>
              typeof zone?.id === 'string' &&
              typeof zone.city === 'string' &&
              typeof zone.country === 'string' &&
              typeof zone.offset === 'string',
          )
          .map((zone) => ({
            ...zone,
            ianaCity: typeof zone.ianaCity === 'string' ? zone.ianaCity : zone.city,
            aliases: Array.isArray(zone.aliases)
              ? zone.aliases.filter((name: unknown): name is string => typeof name === 'string')
              : [],
            formerName: typeof zone.formerName === 'string' ? zone.formerName : null,
          }))
      : [];
  }

  async setLocale(locale: string): Promise<void> {
    await this.put<unknown>('/api/auth/locale', { locale });
  }

  async me(): Promise<Account> {
    const account = asAccount(await this.get<unknown>('/api/auth/me'));

    if (account == null) {
      throw new Error(
        'The API answered /api/auth/me in a shape this client does not know. Check AccountController in services/api.',
      );
    }

    return account;
  }

  /** A new number is texted a code at once; the answer says whether one was, and how long until another. */
  async setPhone(
    countryCode: string,
    number: string,
  ): Promise<{ phone: LinkedPhone | null; verificationNeeded: boolean; cooldownSeconds: number }> {
    const raw = await this.put<Record<string, unknown>>('/api/auth/phone', { countryCode, number });

    return {
      phone: raw.phone == null ? null : asLinkedPhone(raw.phone),
      verificationNeeded: raw.verificationNeeded === true,
      cooldownSeconds: typeof raw.cooldownSeconds === 'number' ? raw.cooldownSeconds : 0,
    };
  }

  /** `phone` names an alternative number (sc-113); without it, the number awaiting its code. */
  async verifyPhone(code: string, phone?: string): Promise<LinkedPhone> {
    const verified = asLinkedPhone(
      await this.post<unknown>('/api/auth/verify/phone', {
        code,
        ...(phone == null ? {} : { phone }),
      }),
    );

    if (verified == null) {
      throw new Error(
        'The API answered /api/auth/verify/phone in a shape this client does not know. Check PhoneController in services/api.',
      );
    }

    return verified;
  }

  async phoneOpening(phone?: string): Promise<PhoneCodeOpening> {
    const answer = await this.get<{ route?: unknown }>(
      `/api/auth/verify/phone/resend${phone == null ? '' : `?phone=${encodeURIComponent(phone)}`}`,
    );
    const route = answer?.route;

    return {
      ...openingFrom(answer),
      route: asRoute(route),
    };
  }

  /** "Text it to me instead": the same code once by SMS, and later codes for this number by text. */
  async textPhoneCodeInstead(phone?: string): Promise<void> {
    await this.post<unknown>('/api/auth/verify/phone/text-instead', phone == null ? {} : { phone });
  }

  async resendPhoneCode(phone?: string): Promise<number> {
    return (
      await this.post<{ cooldownSeconds: number }>(
        '/api/auth/verify/phone/resend',
        phone == null ? {} : { phone },
      )
    ).cooldownSeconds;
  }

  /** `address` names an alternative (sc-113); without it, the primary. */
  async verifyEmail(code: string, address?: string): Promise<LinkedAddress> {
    const verified = asLinkedAddress(
      await this.post<unknown>('/api/auth/verify/email', {
        code,
        ...(address == null ? {} : { address }),
      }),
    );

    if (verified == null) {
      throw new Error(
        'The API answered /api/auth/verify/email in a shape this client does not know. Check VerificationController in services/api.',
      );
    }

    return verified;
  }

  async resendVerification(address?: string): Promise<number> {
    return cooldownFrom(
      await this.post<unknown>('/api/auth/verify/resend', address == null ? {} : { address }),
    );
  }

  /** Reads the cooldown and the code's state without spending either, so the screen opens on the truth. */
  async verificationOpening(address?: string): Promise<CodeOpening> {
    return openingFrom(
      await this.get<unknown>(
        `/api/auth/verify/resend${address == null ? '' : `?address=${encodeURIComponent(address)}`}`,
      ),
    );
  }

  /** Linked unverified and not primary, a code sent (sc-113). Refused `already_linked` wherever it is held. */
  async addEmailAddress(address: string): Promise<LinkedAddress> {
    return linkedOrThrow(
      asLinkedAddress(await this.post<unknown>('/api/auth/emails', { address })),
    );
  }

  /** With the proof from `prove()`: it changes how the account signs in. Refused `address_not_verified` for an unproved one. */
  async makeEmailPrimary(id: string, proof: string): Promise<LinkedAddress> {
    return linkedOrThrow(
      asLinkedAddress(
        await this.patch<unknown>(`/api/auth/emails/${encodeURIComponent(id)}/primary`, { proof }),
      ),
    );
  }

  /** Refused `primary_address` for the primary, `last_verified_address` for the one proof of the account. */
  async removeEmailAddress(id: string): Promise<void> {
    await this.delete(`/api/auth/emails/${encodeURIComponent(id)}`);
  }

  async addPhoneNumber(countryCode: string, number: string): Promise<LinkedPhone> {
    return linkedOrThrow(
      asLinkedPhone(await this.post<unknown>('/api/auth/phones', { countryCode, number })),
    );
  }

  async makePhonePrimary(id: string): Promise<LinkedPhone> {
    return linkedOrThrow(
      asLinkedPhone(
        await this.patch<unknown>(`/api/auth/phones/${encodeURIComponent(id)}/primary`),
      ),
    );
  }

  async removePhoneNumber(id: string): Promise<void> {
    await this.delete(`/api/auth/phones/${encodeURIComponent(id)}`);
  }

  async sessions(): Promise<DeviceSession[]> {
    const sessions = asSessions(await this.get<unknown>('/api/auth/sessions'));

    if (sessions == null) {
      throw new Error(
        'The API answered /api/auth/sessions in a shape this client does not know. Check AccountController in services/api.',
      );
    }

    return sessions;
  }

  /** The details screen. Answers whether a phone still has to be verified before the product opens. */
  async completeProfile(
    details: ProfileDetails,
  ): Promise<{ account: Account; verificationNeeded: boolean }> {
    const raw = await this.patch<Record<string, unknown>>('/api/auth/complete-profile', details);
    const account = asAccount(raw?.account);

    if (account == null) {
      throw new Error(
        'The API answered /api/auth/complete-profile without the account. Check ProfileController in services/api.',
      );
    }

    return { account, verificationNeeded: raw.verificationNeeded === true };
  }

  async organisations(): Promise<Membership[]> {
    return (await this.organisationsWithPaused()).organisations;
  }

  /** The same list, with the organisations the account's access to is paused in (sc-564). */
  async organisationsWithPaused(): Promise<{
    organisations: Membership[];
    paused: PausedOrganisation[];
  }> {
    const raw = await this.get<unknown>('/api/orgs');
    const body = typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {};
    const memberships = Array.isArray(body.organisations)
      ? body.organisations.map(asMembership)
      : null;
    const paused = Array.isArray(body.paused) ? body.paused.map(asPausedOrganisation) : [];

    if (
      memberships == null ||
      memberships.some((membership) => membership == null) ||
      paused.some((one) => one == null)
    ) {
      throw new Error(
        'The API answered /api/orgs in a shape this client does not know. Check OrganisationController in services/api.',
      );
    }

    return {
      organisations: memberships as Membership[],
      paused: paused as PausedOrganisation[],
    };
  }

  async signInRules(organisationId: string): Promise<SignInRulesPage> {
    return this.readSignInRules(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/sign-in-rules`),
    );
  }

  /** Refused `validation_failed` for an unlisted length, `two_factor_off` for two-factor asked without it (sc-69, sc-609). */
  async updateSignInRules(
    organisationId: string,
    changes: SignInRulesChanges,
  ): Promise<SignInRulesPage> {
    return this.readSignInRules(
      await this.patch<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/sign-in-rules`,
        changes,
      ),
    );
  }

  private readSignInRules(raw: unknown): SignInRulesPage {
    const page = asSignInRulesPage(raw);

    if (page == null) {
      throw new Error(
        'The API answered /api/orgs/{id}/sign-in-rules in a shape this client does not know. Check SignInRulesController in services/api.',
      );
    }

    return page;
  }

  /** sc-390: the caller its Owner, as `organisations()` lists it. Refused `too_many_attempts` past five an hour. */
  async createOrganisation(organisation: {
    name: string;
    countryCode: string;
    timezone: string;
  }): Promise<Membership> {
    const body = await this.post<{ organisation?: unknown }>('/api/orgs', organisation);
    const membership = asMembership(body?.organisation);

    if (membership == null) {
      throw new Error(
        'The API answered POST /api/orgs without the organisation. Check OrganisationController in services/api.',
      );
    }

    return membership;
  }

  async updateOrganisation(id: string, changes: OrganisationChanges): Promise<Organisation> {
    const organisation = asOrganisation(
      await this.patch<unknown>(`/api/orgs/${encodeURIComponent(id)}`, changes),
    );

    if (organisation == null) {
      throw new Error(
        'The API answered PATCH /api/orgs/{id} in a shape this client does not know. Check OrganisationController in services/api.',
      );
    }

    return organisation;
  }

  async roles(organisationId: string): Promise<RolesCatalogue> {
    const raw = await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/roles`);
    const catalogue = asRolesCatalogue(raw);

    if (catalogue == null) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/roles in a shape this client does not know. Check RolesController in services/api.',
      );
    }

    return catalogue;
  }

  /** Refused `validation_failed` on `name`, or `role_name_taken` for a name the organisation already has. */
  async createRole(
    organisationId: string,
    role: { name: string; permissions: string[] },
  ): Promise<OrganisationRole> {
    return this.role(
      await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/roles`, role),
    );
  }

  async updateRole(
    organisationId: string,
    roleId: string,
    changes: { name?: string; permissions?: string[] },
  ): Promise<OrganisationRole> {
    return this.role(
      await this.patch<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/roles/${encodeURIComponent(roleId)}`,
        changes,
      ),
    );
  }

  /** Its holders move to `replacement`, which the API requires while anybody holds it. */
  async deleteRole(
    organisationId: string,
    roleId: string,
    replacement: string | null,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/roles/${encodeURIComponent(roleId)}`,
      { method: 'DELETE', body: { replacement } },
    );
  }

  /** Soonest first, as the API orders them. */
  async events(organisationId: string): Promise<OrganisationEvent[]> {
    const body = await this.get<{ events?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/events`,
    );
    const events = Array.isArray(body?.events) ? body.events.map(asOrganisationEvent) : null;

    if (events == null || events.some((event) => event == null)) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/events in a shape this client does not know. Check the events controller in services/api.',
      );
    }

    return events as OrganisationEvent[];
  }

  /** Refused `validation_failed` with violations on name, type, startsAt, endsAt, timeZone or currency. */
  async createEvent(organisationId: string, event: NewEvent): Promise<OrganisationEvent> {
    return this.organisationEvent(
      await this.post<{ event?: unknown }>(
        `/api/orgs/${encodeURIComponent(organisationId)}/events`,
        event,
      ),
    );
  }

  /** Empty under three characters, with nothing asked. Refused 503 when the lookup is down. */
  async addressSuggestions(query: string): Promise<AddressSuggestion[]> {
    if (query.trim().length < 3) return [];

    const body = await this.get<{ data?: unknown }>(
      `/api/addresses/suggest?${new URLSearchParams({ q: query.trim() }).toString()}`,
    );
    const suggestions = Array.isArray(body?.data) ? body.data.map(asAddressSuggestion) : null;

    if (suggestions == null || suggestions.some((suggestion) => suggestion == null)) {
      throw new Error(
        'The API answered GET /api/addresses/suggest in a shape this client does not know. Check the address controller in services/api.',
      );
    }

    return suggestions as AddressSuggestion[];
  }

  /** Refused 404 for an id the lookup no longer knows, 503 when it is down. */
  async address(id: string): Promise<PickedAddress> {
    const body = await this.get<{ data?: unknown }>(`/api/addresses/${encodeURIComponent(id)}`);
    const address = asPickedAddress(body?.data);

    if (address == null) {
      throw new Error(
        'The API answered GET /api/addresses/{id} in a shape this client does not know. Check the address controller in services/api.',
      );
    }

    return address;
  }

  /** Refused `not_found` alike for an event that does not exist and one in another organisation. */
  async event(eventId: string): Promise<OrganisationEvent> {
    return this.organisationEvent(
      await this.get<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}`),
    );
  }

  /** The event as an edit form opens it, with the tag the save sends back. */
  async taggedEvent(eventId: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}`, {
        method: 'GET',
      }),
    );
  }

  /** Refused 412 when somebody saved since `tag`, 409 `event_currency_in_use`, and as createEvent. */
  async updateEvent(eventId: string, changes: EventChanges, tag: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        body: changes,
        headers: { 'If-Match': tag },
      }),
    );
  }

  /** Refused `validation_failed` on `file` for a type or a size the cover does not take (sc-3590). */
  async signEventCoverUpload(
    organisationId: string,
    file: { contentType: string; size: number; filename: string },
  ): Promise<CoverUpload> {
    const body = await this.post<{ upload?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/event-cover-uploads`,
      file,
    );
    const { url, key, content_type: contentType } = (body?.upload ?? {}) as Record<string, unknown>;

    if (typeof url !== 'string' || typeof key !== 'string' || typeof contentType !== 'string') {
      throw new Error(
        'The API answered a cover upload in a shape this client does not know. Check the event cover controller in services/api.',
      );
    }

    return { url, key, contentType };
  }

  async uploadTo(upload: CoverUpload, file: Blob): Promise<void> {
    const doFetch = this.options.fetch ?? fetch;
    const response = await doFetch(upload.url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': upload.contentType },
    });

    if (!response.ok) throw new Error(`The store refused the upload with ${response.status}.`);
  }

  /** For a browser that cannot show the original (sc-13861); refused on `file` as setEventCover refuses it. */
  async previewEventCoverUpload(organisationId: string, uploadKey: string): Promise<string> {
    const body = await this.post<{ preview?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/event-cover-uploads/preview`,
      { uploadKey },
    );

    if (typeof body?.preview !== 'string' || !body.preview.startsWith('data:image/')) {
      throw new Error(
        'The API answered a cover preview in a shape this client does not know. Check the event cover controller in services/api.',
      );
    }

    return body.preview;
  }

  /** A photo uploaded and then not used, deleted so its original, metadata and all, is not kept. */
  async discardEventCoverUpload(organisationId: string, uploadKey: string): Promise<void> {
    await this.request(`/api/orgs/${encodeURIComponent(organisationId)}/event-cover-uploads`, {
      method: 'DELETE',
      body: { uploadKey },
    });
  }

  /** Refused `validation_failed` on `file` (the photo itself), `uploadKey`, `position` or `description`. */
  async setEventCover(eventId: string, change: CoverChange): Promise<OrganisationEvent> {
    return this.organisationEvent(
      await this.put<{ event?: unknown }>(
        `/api/events/${encodeURIComponent(eventId)}/cover`,
        change,
      ),
    );
  }

  async removeEventCover(eventId: string): Promise<OrganisationEvent> {
    return this.organisationEvent(
      await this.delete<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}/cover`),
    );
  }

  /** Refused 409 `event_state_invalid` once it is not a Draft, 409 `event_concluded` once its end has passed, and 403 `plan_limit` with `plan` and `limit`. */
  async makeLive(eventId: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(
        `/api/events/${encodeURIComponent(eventId)}/make-live`,
        { method: 'POST' },
      ),
    );
  }

  /** Calls it off before its start, ends it after: refused 409 `event_state_invalid` unless Live or Paused, and 409 `event_concluded` once its end has passed. */
  async endEvent(eventId: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}/end`, {
        method: 'POST',
      }),
    );
  }

  async eventDeletion(eventId: string): Promise<EventDeletion> {
    const body = await this.get<Record<string, unknown>>(
      `/api/events/${encodeURIComponent(eventId)}/deletion`,
    );

    if (
      typeof body.needsName !== 'boolean' ||
      typeof body.restoreClosesAt !== 'string' ||
      typeof body.restoreCloses !== 'string'
    ) {
      throw new Error(
        'The API answered an event deletion in a shape this client does not know. Check EventDeletionController in services/api.',
      );
    }

    return {
      needsName: body.needsName,
      restoreClosesAt: body.restoreClosesAt,
      restoreCloses: body.restoreCloses,
    };
  }

  /** `name` is needed unless it is a Draft: refused with a violation on `name`, code `event_name_mismatch`, unless it matches. */
  async deleteEvent(eventId: string, name?: string): Promise<void> {
    await this.request<unknown>(`/api/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      body: { name: name ?? null },
    });
  }

  private tagged({
    body,
    response,
  }: {
    body: { event?: unknown } | null | undefined;
    response: Response;
  }): TaggedEvent {
    const tag = response.headers.get('ETag');

    if (tag == null || tag === '') {
      throw new Error(
        'The API answered an event with no ETag. Check that the events controller tags it and that CORS exposes ETag.',
      );
    }

    return { event: this.organisationEvent(body), tag };
  }

  private organisationEvent(body: { event?: unknown } | null | undefined): OrganisationEvent {
    const event = asOrganisationEvent(body?.event);

    if (event == null) {
      throw new Error(
        'The API answered an event in a shape this client does not know. Check the events controller in services/api.',
      );
    }

    return event;
  }

  async members(organisationId: string): Promise<MembersList> {
    const raw = await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/members`);
    const list = asMembersList(raw);

    if (list == null) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/members in a shape this client does not know. Check MembersController in services/api.',
      );
    }

    return list;
  }

  /** Refused `already_a_member`, `grant_not_held`, or a violation on `email` or `roleId`. Sending again replaces the link. */
  async inviteMember(
    organisationId: string,
    email: string,
    roleId: string,
  ): Promise<SentInvitation> {
    const body = await this.post<{ invitation?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/invite`,
      { email, roleId },
    );

    return this.sentInvitation(body?.invitation);
  }

  async revokeInvitation(organisationId: string, invitationId: string): Promise<SentInvitation> {
    const body = await this.request<{ invitation?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/invitations/${encodeURIComponent(invitationId)}`,
      { method: 'DELETE' },
    );

    return this.sentInvitation(body?.invitation);
  }

  /** Refused `conflict` for the caller's own, `grant_not_held`, or `last_owner`. Takes effect on their next request. */
  async changeMemberRole(
    organisationId: string,
    membershipId: string,
    roleId: string,
  ): Promise<void> {
    await this.patch<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}`,
      { roleId },
    );
  }

  async removeMember(organisationId: string, membershipId: string): Promise<void> {
    await this.request<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}`,
      { method: 'DELETE' },
    );
  }

  /** Refused 403 for yourself or an Owner, and 409 unless they are active. */
  async suspendMember(organisationId: string, membershipId: string): Promise<void> {
    await this.post<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}/suspend`,
      {},
    );
  }

  /** Null for anybody the banner is not shown to (sc-6640). */
  async ownerClaim(organisationId: string): Promise<OwnerClaimBanner | null> {
    return this.ownerClaimBanner(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/owner-claim`),
    );
  }

  /** For the domain of the caller's own address. Refused `owner_claim_address`, `owner_claim_managed`, `owner_claim_open` or `owner_claim_closed`. */
  async startOwnerClaim(organisationId: string): Promise<OwnerClaimBanner | null> {
    return this.ownerClaimBanner(
      await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/owner-claim`, {}),
    );
  }

  async checkOwnerClaim(
    organisationId: string,
  ): Promise<{ ownerClaim: OwnerClaimBanner | null; found: boolean }> {
    const raw = await this.post<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/owner-claim/check`,
      {},
    );

    return {
      ownerClaim: this.ownerClaimBanner(raw),
      found: (raw as Record<string, unknown> | null)?.found === true,
    };
  }

  /** By an Administrator other than the claimant, or a suspended Owner. Refused `owner_claim_own` for the claimant, `owner_claim_ended` once it has ended. */
  async stopOwnerClaim(organisationId: string): Promise<OwnerClaimBanner | null> {
    return this.ownerClaimBanner(
      await this.post<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/owner-claim/stop`,
        {},
      ),
    );
  }

  /** By the claimant only (sc-8204), leaving the way open. `told` when the record had been found, so everybody told then is emailed. Refused `owner_claim_ended` once it has ended. */
  async withdrawOwnerClaim(
    organisationId: string,
  ): Promise<{ ownerClaim: OwnerClaimBanner | null; told: boolean }> {
    const raw = await this.post<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/owner-claim/withdraw`,
      {},
    );
    const withdrawn = (raw as Record<string, unknown> | null)?.withdrawn as
      Record<string, unknown> | undefined;

    return { ownerClaim: this.ownerClaimBanner(raw), told: withdrawn?.told === true };
  }

  private ownerClaimBanner(raw: unknown): OwnerClaimBanner | null {
    const body = (raw ?? {}) as Record<string, unknown>;
    const banner = body.ownerClaim === null ? null : asOwnerClaimBanner(body.ownerClaim);

    if (banner === undefined) {
      throw new Error(
        'The API answered an owner claim in a shape this client does not know. Check OwnerClaimDescriber in services/api.',
      );
    }

    return banner;
  }

  /** Refused 409 unless they are suspended, `restore_needs_address` while an address that went is not back, verified and primary (sc-564),
   * and `team_seats_in_use`, with the `limit`, when every seat is taken. */
  async restoreMember(organisationId: string, membershipId: string): Promise<void> {
    await this.request<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}/restore`,
      { method: 'POST' },
    );
  }

  /** Somebody awaiting approval becomes a member in that role. Refused `join_request_answered`, or `grant_not_held`. */
  async approveMember(organisationId: string, membershipId: string, roleId: string): Promise<void> {
    await this.post<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}/approve`,
      { roleId },
    );
  }

  /** Refused `join_request_answered` once somebody else answered it, or it was removed unanswered. */
  async turnDownMember(organisationId: string, membershipId: string): Promise<void> {
    await this.post<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}/turn-down`,
      {},
    );
  }

  /** Refused `last_owner` while the caller is the only owner. */
  async leaveOrganisation(organisationId: string): Promise<void> {
    await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/leave`, {});
  }

  /** With the proof from `prove()`. The caller becomes an Administrator. */
  async transferOwnership(
    organisationId: string,
    membershipId: string,
    proof: string,
  ): Promise<void> {
    await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/ownership`, {
      membershipId,
      proof,
    });
  }

  async organisationDeletion(organisationId: string): Promise<OrganisationDeletion> {
    return this.deletion(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/deletion`),
    );
  }

  /** Refused with a violation on `name` unless it is typed exactly. */
  async deleteOrganisation(organisationId: string, name: string): Promise<OrganisationDeletion> {
    const body = await this.request<Record<string, unknown>>(
      `/api/orgs/${encodeURIComponent(organisationId)}`,
      { method: 'DELETE', body: { name } },
    );

    return this.deletion({ events: 0, guests: 0, members: 0, ...body });
  }

  private deletion(raw: unknown): OrganisationDeletion {
    const body = raw as Record<string, unknown> | null;

    if (
      typeof body?.events !== 'number' ||
      typeof body.guests !== 'number' ||
      typeof body.members !== 'number' ||
      typeof body.restoreClosesAt !== 'string' ||
      typeof body.restoreCloses !== 'string'
    ) {
      throw new Error(
        'The API answered an organisation deletion in a shape this client does not know. Check DeletionController in services/api.',
      );
    }

    return {
      events: body.events,
      guests: body.guests,
      members: body.members,
      restoreClosesAt: body.restoreClosesAt,
      restoreCloses: body.restoreCloses,
    };
  }

  /** Refused `invitation_not_found` for a link that names nothing, including one that was sent again. */
  async invitationLink(token: string): Promise<InvitationPreview> {
    return this.invitationPreview(await this.post<unknown>('/api/invitations/link', { token }));
  }

  async myInvitations(): Promise<InvitationPreview[]> {
    const body = await this.get<{ invitations?: unknown }>('/api/invitations');

    if (!Array.isArray(body?.invitations)) {
      throw new Error(
        'The API answered GET /api/invitations without a list. Check InvitationsController in services/api.',
      );
    }

    return body.invitations.map((one: unknown) => this.invitationPreview(one));
  }

  /** The token is a credential, so it travels in the body. Refused `request_link_dead` for one unknown, off or replaced alike. */
  async requestLinkPreview(token: string): Promise<RequestLinkPreview> {
    const raw = await this.post<Record<string, unknown>>('/api/request-links/link', { token });
    const organisation = raw?.organisation as Record<string, unknown> | null | undefined;

    if (typeof organisation?.name !== 'string') {
      throw new Error(
        'The API answered POST /api/request-links/link in a shape this client does not know. Check RequestLinksController in services/api.',
      );
    }

    return {
      organisation: { name: organisation.name },
      standing: oneOf(raw.standing, REQUEST_STANDINGS),
      askAgainFrom: stringOrNull(raw.askAgainFrom),
    };
  }

  /** Refused `already_a_member`, `join_request_waiting`, `join_request_cooling_off`, or `too_many_attempts` with Retry-After. */
  async askThroughRequestLink(token: string, message: string): Promise<JoinRequest> {
    const raw = await this.post<Record<string, unknown>>('/api/request-links/ask', {
      token,
      message: message.trim() === '' ? null : message,
    });
    const request = asJoinRequest(raw?.request);

    if (request == null) {
      throw new Error(
        'The API answered an ask through a request link without the request. Check RequestLinksController in services/api.',
      );
    }

    return request;
  }

  async requestLink(organisationId: string): Promise<RequestLink> {
    return asRequestLink(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/request-link`),
    );
  }

  async turnOnRequestLink(organisationId: string): Promise<RequestLink> {
    return asRequestLink(
      await this.put<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/request-link`, {}),
    );
  }

  async turnOffRequestLink(organisationId: string): Promise<RequestLink> {
    return asRequestLink(
      await this.delete<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/request-link`),
    );
  }

  /** The old link stops working at once. */
  async replaceRequestLink(organisationId: string): Promise<RequestLink> {
    return asRequestLink(
      await this.post<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/request-link/replace`,
        {},
      ),
    );
  }

  async joinOffers(): Promise<JoinOffers> {
    const raw = await this.get<Record<string, unknown>>('/api/join-offers');
    const offers = Array.isArray(raw?.offers) ? raw.offers.map(asJoinOffer) : null;

    if (offers == null || offers.some((offer) => offer == null)) {
      throw new Error(
        'The API answered GET /api/join-offers in a shape this client does not know. Check JoinOffersController in services/api.',
      );
    }

    return {
      domain: typeof raw.domain === 'string' ? raw.domain : null,
      offers: offers as JoinOffer[],
      request: asJoinRequest(raw.request),
    };
  }

  /** Refused `join_offer_unavailable` once it is no longer offered, or while another request waits. */
  async askToJoin(organisationId: string): Promise<JoinRequest> {
    const raw = await this.post<Record<string, unknown>>(
      `/api/join-offers/${encodeURIComponent(organisationId)}/ask`,
      {},
    );
    const request = asJoinRequest(raw?.request);

    if (request == null) {
      throw new Error(
        'The API answered an ask to join without the request. Check JoinOffersController in services/api.',
      );
    }

    return request;
  }

  async dismissJoinOffer(organisationId: string): Promise<void> {
    await this.post<unknown>(`/api/join-offers/${encodeURIComponent(organisationId)}/dismiss`, {});
  }

  async withdrawJoinRequest(): Promise<void> {
    await this.delete<unknown>('/api/join-offers/request');
  }

  async companyDomains(organisationId: string): Promise<CompanyDomains> {
    return this.readCompanyDomains(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/domains`),
    );
  }

  async addCompanyDomain(organisationId: string, domain: string): Promise<CompanyDomains> {
    return this.readCompanyDomains(
      await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/domains`, {
        domain,
      }),
    );
  }

  async removeCompanyDomain(organisationId: string, domain: string): Promise<CompanyDomains> {
    return this.readCompanyDomains(
      await this.delete<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/domains/${encodeURIComponent(domain)}`,
      ),
    );
  }

  private readCompanyDomains(raw: unknown): CompanyDomains {
    const body = raw as Record<string, unknown> | null;
    const domains = Array.isArray(body?.domains) ? body.domains : null;

    if (
      body == null ||
      domains == null ||
      typeof body.most !== 'number' ||
      domains.some((one) => typeof (one as Record<string, unknown>)?.domain !== 'string')
    ) {
      throw new Error(
        'The API answered /api/orgs/{id}/domains in a shape this client does not know. Check CompanyDomainsController in services/api.',
      );
    }

    return {
      domains: domains.map((one) => {
        const row = one as Record<string, unknown>;

        return { domain: row.domain as string, stopped: row.stopped === true };
      }),
      most: body.most,
      ownAddress: typeof body.ownAddress === 'string' ? body.ownAddress : null,
    };
  }

  /** The membership it made, as `organisations()` lists it. Refused `invitation_not_yours` for another address. */
  async acceptInvitation(invitationId: string): Promise<Membership> {
    const body = await this.post<{ organisation?: unknown }>(
      `/api/invitations/${encodeURIComponent(invitationId)}/accept`,
      {},
    );
    const membership = asMembership(body?.organisation);

    if (membership == null) {
      throw new Error(
        'The API answered an accepted invitation without the organisation. Check InvitationsController in services/api.',
      );
    }

    return membership;
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await this.post<unknown>(`/api/invitations/${encodeURIComponent(invitationId)}/decline`, {});
  }

  async registerFromInvitation(
    token: string,
    email: string,
    name: string,
    password: string,
  ): Promise<SignedIn> {
    return this.signedInOnly(
      '/api/auth/register',
      { invitationToken: token, email, name, password },
      'RegisterController',
    );
  }

  private invitationPreview(raw: unknown): InvitationPreview {
    const preview = asInvitationPreview(raw);

    if (preview == null) {
      throw new Error(
        'The API answered an invitation in a shape this client does not know. Check InvitationsController in services/api.',
      );
    }

    return preview;
  }

  private sentInvitation(raw: unknown): SentInvitation {
    const invitation = asSentInvitation(raw);

    if (invitation == null) {
      throw new Error(
        'The API answered an invitation in a shape this client does not know. Check MembersController in services/api.',
      );
    }

    return invitation;
  }

  private role(raw: unknown): OrganisationRole {
    const role = asOrganisationRole(raw);

    if (role == null) {
      throw new Error(
        'The API answered a role in a shape this client does not know. Check RolesController in services/api.',
      );
    }

    return role;
  }

  /** Every session but `sessionId`'s, with a proof; `thisDevice` says this one ended too and the client is signed out. */
  async signOutEverywhereElse(
    proof: string,
    sessionId: string | null,
  ): Promise<{ signedOut: number; thisDevice: boolean }> {
    const body = await this.post<{ signedOut?: unknown; thisDevice?: unknown }>(
      '/api/auth/sessions/others',
      { proof, sessionId },
    );

    return {
      signedOut: typeof body.signedOut === 'number' ? body.signedOut : 0,
      thisDevice: body.thisDevice === true,
    };
  }

  async endSession(id: string): Promise<void> {
    await this.delete(`/api/auth/sessions/${encodeURIComponent(id)}`);
  }

  async signOut(): Promise<void> {
    const body: Record<string, string> = { refreshTokenIn: this.delivery() };

    if (this.delivery() === 'body') {
      const token = await this.options.tokens?.refresh();
      if (token != null && token !== '') body.refreshToken = token;
    }

    const response = await this.sendTokenRequest('/api/auth/logout', body).catch(() => null);

    // Only the API can clear an httpOnly cookie, so a sign-out it never answered has not happened.
    if (this.delivery() === 'cookie' && (response == null || response.status >= 500)) {
      throw new ApiUnreachableError();
    }

    await this.options.tokens?.clear();
  }

  /** A 503 is an answer here — it names the dependency that is down — so it is not thrown. */
  async health(): Promise<Health> {
    const response = await this.send('/api/health', { method: 'GET', anonymous: true });
    const health = asHealth(await response.json().catch(() => null));

    if (health == null) {
      throw new Error(
        'The API answered /api/health in a shape this client does not know. Check HealthController in services/api.',
      );
    }

    return health;
  }

  private async send(path: string, init: RequestOptions): Promise<Response> {
    const doFetch = this.options.fetch ?? fetch;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...init.headers,
    };

    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    Object.assign(headers, this.deviceHeaders());

    if (!init.anonymous && this.options.tokens != null) {
      const token = await this.options.tokens.access();
      if (token != null && token !== '') headers.Authorization = `Bearer ${token}`;
    }

    const request: RequestInit = { method: init.method ?? 'GET', headers };

    // Assigned only when present. Under exactOptionalPropertyTypes an explicit
    // `undefined` is not the same as an absent key, and RequestInit does not
    // accept it.
    if (init.body !== undefined) request.body = JSON.stringify(init.body);
    if (init.signal !== undefined) request.signal = init.signal;

    try {
      const response = await doFetch(this.url(path, init.query), request);

      (this.options.clock ?? serverClock).observe(response.headers.get('Date'));

      return response;
    } catch (error) {
      if (init.signal?.aborted === true) throw error;

      throw new ApiUnreachableError(error);
    }
  }

  /**
   * Refresh at most once at a time.
   *
   * Four requests failing together must not start four refreshes: the API
   * rotates refresh tokens and treats a replayed one as theft, so the second
   * refresh would revoke the whole chain and sign the user out mid-task.
   */
  private refreshOnce(): Promise<boolean> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });

    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const store = this.options.tokens;
    if (store == null) return false;

    const body: Record<string, string> = { refreshTokenIn: this.delivery() };

    if (this.delivery() === 'body') {
      const token = await store.refresh();
      if (token == null || token === '') return false;
      body.refreshToken = token;
    }

    const response = await this.sendTokenRequest('/api/auth/refresh', body).catch(
      (error: unknown) => {
        throw new ApiUnreachableError(error);
      },
    );

    if (response.status >= 500) throw new ApiUnreachableError();

    if (!response.ok) {
      await this.forgetSession(await toProblem(response));
      return false;
    }

    const issued = asIssuedTokens(await response.json().catch(() => null), this.delivery());

    if (issued == null) {
      await this.forgetSession();
      return false;
    }

    await store.save(issued);
    return true;
  }

  private delivery(): RefreshTokenDelivery {
    return this.options.refreshTokenIn ?? 'body';
  }

  /** The device's language, zone and install identifier, on every request: a token request creates or signs in the account. */
  private deviceHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const locale = this.options.locale?.();
    if (locale != null && locale !== '') headers['Accept-Language'] = locale;
    const timeZone = this.options.timeZone?.();
    if (timeZone != null && timeZone !== '') headers['X-Timezone'] = timeZone;
    const userAgent = this.options.userAgent;
    if (userAgent != null && userAgent !== '') headers['User-Agent'] = userAgent;
    const device = this.options.device?.();
    if (device != null && device !== '') headers['X-Device-Id'] = device;

    return headers;
  }

  /** `credentials: 'include'` only here: the cookie is scoped to /api/auth. */
  private sendTokenRequest(path: string, body: Record<string, string>): Promise<Response> {
    const doFetch = this.options.fetch ?? fetch;

    return doFetch(this.url(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.deviceHeaders(),
      },
      body: JSON.stringify({ ...body, refreshTokenIn: this.delivery() }),
      credentials: this.delivery() === 'cookie' ? 'include' : 'omit',
    });
  }

  private async issued(
    response: Response,
  ): Promise<{ tokens: IssuedTokens; body: Record<string, unknown> }> {
    if (!response.ok) throw new ApiError(await toProblem(response), response);

    const body: unknown = await response.json();
    const tokens = asIssuedTokens(body, this.delivery());

    if (tokens == null) {
      throw new Error(
        'The API answered without an access token. Check IssuedTokensResponse in services/api.',
      );
    }

    return { tokens, body: body as Record<string, unknown> };
  }

  /** Tokens and the account, or, with two-factor on, the challenge the code answers. */
  private async signedIn(
    path: string,
    credentials: Record<string, string>,
    controller: string,
  ): Promise<SignInOutcome> {
    const response = await this.sendTokenRequest(path, credentials);

    if (response.status === 202) {
      const challenge = asChallenge(await response.json().catch(() => null));

      if (challenge == null) {
        throw new Error(
          `The API answered ${path} with a challenge this client cannot read. Check SignInResponse in services/api.`,
        );
      }

      return challenge;
    }

    return this.adopt(response, path, controller);
  }

  /** A way in that never asks for a second factor: registering, or the code that just passed. */
  private async signedInOnly(
    path: string,
    credentials: Record<string, string>,
    controller: string,
  ): Promise<SignedIn> {
    return this.adopt(await this.sendTokenRequest(path, credentials), path, controller);
  }

  private async adopt(response: Response, path: string, controller: string): Promise<SignedIn> {
    const { tokens, body } = await this.issued(response);
    const account = asAccount(body.account);

    if (account == null) {
      throw new Error(
        `The API answered ${path} without the account. Check ${controller} in services/api.`,
      );
    }

    await this.options.tokens?.save(tokens);

    return { tokens, account, linked: body.linked === true };
  }

  private async forgetSession(why?: Problem): Promise<void> {
    await this.options.tokens?.clear();
    this.options.onSignedOut?.(why);
  }

  private url(path: string, query?: RequestOptions['query']): string {
    const base = this.options.baseUrl().replace(/\/+$/, '');
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    return url.toString();
  }
}

/** The primary address, which is the only one sign-in matches. */
export function primaryEmailAddress(account: Account): string | null {
  return account.emailAddresses.find((address) => address.primary)?.address ?? null;
}

/** The number a code is waiting on: a replacement texted, else the primary. */
export function phoneAwaitingCode(account: Pick<Account, 'phoneNumbers'>): LinkedPhone | null {
  return (
    account.phoneNumbers.find((phone) => phone.pending) ??
    account.phoneNumbers.find((phone) => phone.primary) ??
    null
  );
}

export type Awaiting = 'email' | 'phone' | 'details' | 'approval';

/** The gate an account is behind, in the API's order: the email, a phone it has, the details, then approval. */
export function awaiting(
  account: Pick<Account, 'verified' | 'complete' | 'emailAddresses'> &
    Partial<Pick<Account, 'waitingFor'>>,
): Awaiting | null {
  if (!account.verified) {
    const email = account.emailAddresses.find((address) => address.primary);

    return email?.verified === true ? 'phone' : 'email';
  }

  if (!account.complete) return 'details';

  return account.waitingFor == null ? null : 'approval';
}

const REQUEST_STANDINGS = ['member', 'waiting', 'cooling_off'] as const;

function asRequestLink(raw: unknown): RequestLink {
  const body = raw as Record<string, unknown> | null;

  if (typeof body?.on !== 'boolean') {
    throw new Error(
      'The API answered /api/orgs/{id}/request-link in a shape this client does not know. Check RequestLinkController in services/api.',
    );
  }

  return { on: body.on, url: stringOrNull(body.url) };
}

function asJoinOffer(raw: unknown): JoinOffer | null {
  const candidate = raw as Record<string, unknown> | null;

  if (typeof candidate?.id !== 'string' || typeof candidate.name !== 'string') return null;

  return { id: candidate.id, name: candidate.name };
}

function asJoinRequest(raw: unknown): JoinRequest | null {
  const candidate = raw as Record<string, unknown> | null;
  const organisation = asJoinOffer(candidate?.organisation);

  if (organisation == null || typeof candidate?.askedAt !== 'string') return null;

  return { organisation, askedAt: candidate.askedAt };
}

function asLinkedAddress(raw: unknown): LinkedAddress | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || typeof candidate.address !== 'string') return null;

  return {
    id: candidate.id,
    address: candidate.address,
    verified: candidate.verified === true,
    primary: candidate.primary === true,
  };
}

function asAccount(raw: unknown): Account | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id === '') return null;
  if (typeof candidate.name !== 'string') return null;
  if (!Array.isArray(candidate.emailAddresses) || !Array.isArray(candidate.phoneNumbers)) {
    return null;
  }

  const emailAddresses: LinkedAddress[] = [];

  for (const value of candidate.emailAddresses) {
    const address = value as Record<string, unknown>;

    if (typeof address?.address !== 'string' || typeof address.id !== 'string') return null;

    emailAddresses.push({
      id: address.id,
      address: address.address,
      verified: address.verified === true,
      primary: address.primary === true,
    });
  }

  const phoneNumbers: LinkedPhone[] = [];

  for (const value of candidate.phoneNumbers) {
    const phone = asLinkedPhone(value);

    if (phone == null) return null;

    phoneNumbers.push(phone);
  }

  return {
    id: candidate.id,
    name: candidate.name,
    businessName: typeof candidate.businessName === 'string' ? candidate.businessName : null,
    countryCode: typeof candidate.countryCode === 'string' ? candidate.countryCode : null,
    organisationCountry:
      typeof candidate.organisationCountry === 'string' ? candidate.organisationCountry : null,
    locale: typeof candidate.locale === 'string' ? candidate.locale : null,
    timezone: typeof candidate.timezone === 'string' ? candidate.timezone : null,
    verified: candidate.verified === true,
    complete: candidate.complete === true,
    needsOrganisation: candidate.needsOrganisation === true,
    hasPassword: candidate.hasPassword === true,
    twoFactorSetupPrompt: candidate.twoFactorSetupPrompt === true,
    providers: Array.isArray(candidate.providers)
      ? candidate.providers.flatMap(asLinkedProvider)
      : [],
    emailAddresses,
    phoneNumbers,
    waitingFor: asJoinRequest(candidate.waitingFor),
  };
}

function asLinkedProvider(raw: unknown): LinkedProvider[] {
  const candidate = raw as Record<string, unknown> | null;
  const provider = candidate?.provider;

  if (provider !== 'google' && provider !== 'apple') return [];

  return [{ provider, email: typeof candidate?.email === 'string' ? candidate.email : null }];
}

function stringList(raw: unknown): string[] | null {
  return Array.isArray(raw) && raw.every((one) => typeof one === 'string') ? raw : null;
}

function asOrganisationRole(raw: unknown): OrganisationRole | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const role = raw as Record<string, unknown>;
  const permissions = stringList(role.permissions);
  const holderNames = Array.isArray(role.holderNames) ? role.holderNames.map(asRoleHolder) : null;

  if (
    typeof role.id !== 'string' ||
    typeof role.fixed !== 'boolean' ||
    typeof role.removable !== 'boolean' ||
    typeof role.holders !== 'number' ||
    permissions == null ||
    holderNames == null ||
    !holderNames.every((holder) => holder != null)
  )
    return null;

  return {
    id: role.id,
    seededAs: typeof role.seededAs === 'string' ? role.seededAs : null,
    name: typeof role.name === 'string' ? role.name : null,
    fixed: role.fixed,
    removable: role.removable,
    permissions,
    holders: role.holders,
    holderNames,
  };
}

function asRoleHolder(raw: unknown): RoleHolder | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { name, suspended } = raw as Record<string, unknown>;

  return typeof name === 'string' && typeof suspended === 'boolean' ? { name, suspended } : null;
}

function asRolesCatalogue(raw: unknown): RolesCatalogue | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { roles, areas } = raw as Record<string, unknown>;

  if (!Array.isArray(roles) || !Array.isArray(areas)) return null;

  const parsedRoles = roles.map(asOrganisationRole);
  const parsedAreas = areas.map((entry: unknown) => {
    const { area, permissions } = (entry ?? {}) as Record<string, unknown>;
    const held = stringList(permissions);

    return typeof area === 'string' && held != null ? { area, permissions: held } : null;
  });

  if (parsedRoles.some((role) => role == null) || parsedAreas.some((area) => area == null))
    return null;

  return {
    roles: parsedRoles as OrganisationRole[],
    areas: parsedAreas as RolesCatalogue['areas'],
  };
}

function asOrganisationEvent(raw: unknown): OrganisationEvent | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;
  const status = oneOf(candidate.status, EVENT_STATES);
  const type = isEventType(candidate.type) ? candidate.type : null;
  const fields = [
    'id',
    'organisationId',
    'name',
    'startsAt',
    'endsAt',
    'timeZone',
    'currency',
    'createdAt',
  ] as const;

  const dayCount = candidate.dayCount;
  const cover = candidate.cover === null ? null : asEventCover(candidate.cover);
  const venue = candidate.venue === null ? null : asEventVenue(candidate.venue);
  const madeLiveAt = candidate.madeLiveAt;
  const phase = oneOf(candidate.phase, EVENT_PHASES);
  const concludedAt = candidate.concludedAt;

  if (
    status == null ||
    phase == null ||
    !isStringOrNull(concludedAt) ||
    !isStringOrNull(madeLiveAt) ||
    type == null ||
    cover === undefined ||
    venue === undefined ||
    fields.some((field) => typeof candidate[field] !== 'string') ||
    typeof dayCount !== 'number' ||
    !Number.isInteger(dayCount) ||
    dayCount < 1
  )
    return null;

  return {
    id: candidate.id as string,
    organisationId: candidate.organisationId as string,
    name: candidate.name as string,
    type,
    status,
    startsAt: candidate.startsAt as string,
    endsAt: candidate.endsAt as string,
    timeZone: candidate.timeZone as string,
    dayCount,
    currency: candidate.currency as string,
    cover,
    venue,
    madeLiveAt,
    phase,
    concludedAt,
    createdAt: candidate.createdAt as string,
  };
}

function asEventCover(raw: unknown): EventCover | undefined {
  if (typeof raw !== 'object' || raw == null) return undefined;

  const { position, description, sizes } = raw as Record<string, unknown>;
  const parsed = Array.isArray(sizes)
    ? sizes.map((size: unknown) => {
        const { width, url } = (size ?? {}) as Record<string, unknown>;

        return typeof width === 'number' && typeof url === 'string' ? { width, url } : null;
      })
    : null;

  if (
    typeof position !== 'number' ||
    (description !== null && typeof description !== 'string') ||
    parsed == null ||
    parsed.length === 0 ||
    parsed.some((size) => size == null)
  )
    return undefined;

  return { position, description, sizes: parsed as EventCover['sizes'] };
}

/** Undefined when the shape is not one this client knows. */
function asEventVenue(raw: unknown): EventVenue | undefined {
  if (typeof raw !== 'object' || raw == null) return undefined;

  const candidate = raw as Record<string, unknown>;
  const address = candidate.address === null ? null : asVenueAddress(candidate.address, 'camel');

  if (!isStringOrNull(candidate.name) || address === undefined) return undefined;

  return { name: candidate.name as string | null, address };
}

/** The event resource names the parts in camelCase; the address lookup, older, in snake_case. */
function asVenueAddress(raw: unknown, naming: 'camel' | 'snake'): VenueAddress | undefined {
  if (typeof raw !== 'object' || raw == null) return undefined;

  const candidate = raw as Record<string, unknown>;
  const postalCode = candidate[naming === 'camel' ? 'postalCode' : 'postal_code'];
  const countryCode = candidate[naming === 'camel' ? 'countryCode' : 'country_code'];
  const texts = [
    candidate.line1,
    candidate.line2,
    candidate.city,
    candidate.region,
    postalCode,
    countryCode,
  ];
  const coordinates = [candidate.latitude, candidate.longitude];

  if (
    typeof candidate.formatted !== 'string' ||
    !texts.every(isStringOrNull) ||
    !coordinates.every((value) => value === null || typeof value === 'number')
  )
    return undefined;

  return {
    formatted: candidate.formatted,
    line1: candidate.line1 as string | null,
    line2: candidate.line2 as string | null,
    city: candidate.city as string | null,
    region: candidate.region as string | null,
    postalCode: postalCode as string | null,
    countryCode: countryCode as string | null,
    latitude: candidate.latitude as number | null,
    longitude: candidate.longitude as number | null,
  };
}

function asPickedAddress(raw: unknown): PickedAddress | null {
  const address = asVenueAddress(raw, 'snake');
  const timeZone = (raw as Record<string, unknown> | null)?.time_zone;

  if (address == null || !isStringOrNull(timeZone)) return null;

  return { ...address, timeZone: timeZone as string | null };
}

function asAddressSuggestion(raw: unknown): AddressSuggestion | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.text !== 'string' ||
    !isStringOrNull(candidate.secondary_text)
  )
    return null;

  return {
    id: candidate.id,
    text: candidate.text,
    secondaryText: candidate.secondary_text as string | null,
  };
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function asOrganisation(raw: unknown): Organisation | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;
  const fields = [
    'id',
    'name',
    'countryCode',
    'currency',
    'timezone',
    'contactAddress',
    'locale',
  ] as const;

  if (fields.some((field) => typeof candidate[field] !== 'string')) return null;

  return {
    id: candidate.id as string,
    name: candidate.name as string,
    countryCode: candidate.countryCode as string,
    currency: candidate.currency as string,
    timezone: candidate.timezone as string,
    contactAddress: candidate.contactAddress as string,
    locale: candidate.locale as string,
  };
}

const REFUSALS: readonly InvitationRefusal[] = [
  'invitation_expired',
  'invitation_revoked',
  'invitation_accepted',
  'invitation_declined',
  'organisation_deleted',
];
const MEMBER_STATUSES: readonly MemberStatus[] = [
  'pending_approval',
  'active',
  'suspended',
  'left_or_removed',
];
const CHANNELS: readonly MemberChannel[] = [
  'invitation',
  'self_created',
  'join_code',
  'domain',
  'request',
  'directory',
  'settings',
];
const SENT_STATUSES: readonly SentInvitationStatus[] = [
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
];

function oneOf<T extends string>(raw: unknown, values: readonly T[]): T | null {
  return values.find((value) => value === raw) ?? null;
}

function stringOrNull(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

function asMemberRole(raw: unknown): MemberRole | null {
  const role = raw as Record<string, unknown> | null;

  if (typeof role?.id !== 'string') return null;

  return { id: role.id, seededAs: stringOrNull(role.seededAs), name: stringOrNull(role.name) };
}

function asPerson(raw: unknown): MemberPerson | null {
  const person = raw as Record<string, unknown> | null;

  return typeof person?.id === 'string' && typeof person.name === 'string'
    ? { id: person.id, name: person.name }
    : null;
}

function asInvitationPreview(raw: unknown): InvitationPreview | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const preview = raw as Record<string, unknown>;
  const organisation = preview.organisation as Record<string, unknown> | null;
  const invitedBy = preview.invitedBy as Record<string, unknown> | null;

  if (
    typeof preview.id !== 'string' ||
    typeof preview.email !== 'string' ||
    typeof preview.expiresAt !== 'string' ||
    typeof organisation?.name !== 'string'
  )
    return null;

  return {
    id: preview.id,
    organisation: { id: stringOrNull(organisation.id), name: organisation.name },
    email: preview.email,
    role: asMemberRole(preview.role),
    invitedBy: typeof invitedBy?.name === 'string' ? { name: invitedBy.name } : null,
    expiresAt: preview.expiresAt,
    refusal: oneOf(preview.refusal, REFUSALS),
    forYou: typeof preview.forYou === 'boolean' ? preview.forYou : null,
    signedInAs: stringOrNull(preview.signedInAs),
  };
}

function asMembershipStep(raw: unknown): MembershipStep | null {
  const step = raw as Record<string, unknown> | null;
  const to = oneOf(step?.to, MEMBER_STATUSES);
  const channel = oneOf(step?.channel, CHANNELS);

  if (step == null || to == null || channel == null || typeof step.at !== 'string') return null;

  return {
    from: oneOf(step.from, MEMBER_STATUSES),
    to,
    channel,
    by: asPerson(step.by),
    at: step.at,
  };
}

function asOrganisationMember(raw: unknown): OrganisationMember | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const member = raw as Record<string, unknown>;
  const user = member.user as Record<string, unknown> | null;
  const role = asMemberRole(member.role);
  const status = oneOf(member.status, MEMBER_STATUSES);
  const history = Array.isArray(member.history) ? member.history.map(asMembershipStep) : null;

  if (
    typeof member.id !== 'string' ||
    typeof user?.id !== 'string' ||
    typeof user.name !== 'string' ||
    role == null ||
    status == null ||
    history == null ||
    history.some((step) => step == null)
  )
    return null;

  return {
    id: member.id,
    user: { id: user.id, name: user.name, email: stringOrNull(user.email) },
    role,
    status,
    former: member.former === 'left' || member.former === 'removed' ? member.former : null,
    channel: oneOf(member.channel, CHANNELS),
    message: stringOrNull(member.message),
    since: stringOrNull(member.since),
    removesAt: asDeadline(member.removesAt),
    invitedBy: asPerson(member.invitedBy),
    invitedAt: stringOrNull(member.invitedAt),
    self: member.self === true,
    history: history as MembershipStep[],
    suspension: asSuspension(member.suspension),
  };
}

function asDeadline(raw: unknown): { at: string; written: string } | null {
  const deadline = raw as Record<string, unknown> | null;

  return typeof deadline?.at === 'string' && typeof deadline.written === 'string'
    ? { at: deadline.at, written: deadline.written }
    : null;
}

function asSentInvitation(raw: unknown): SentInvitation | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const invitation = raw as Record<string, unknown>;
  const status = oneOf(invitation.status, SENT_STATUSES);

  if (typeof invitation.id !== 'string' || typeof invitation.email !== 'string' || status == null)
    return null;

  return {
    id: invitation.id,
    email: invitation.email,
    role: asMemberRole(invitation.role),
    invitedBy: asPerson(invitation.invitedBy),
    status,
    sentAt: stringOrNull(invitation.sentAt),
    expiresAt: stringOrNull(invitation.expiresAt),
    acceptedAt: stringOrNull(invitation.acceptedAt),
    declinedAt: stringOrNull(invitation.declinedAt),
    revokedAt: stringOrNull(invitation.revokedAt),
  };
}

function asMembersList(raw: unknown): MembersList | null {
  const list = raw as Record<string, unknown> | null;

  if (!Array.isArray(list?.members) || !Array.isArray(list.invitations)) return null;

  const members = list.members.map(asOrganisationMember);
  const invitations = list.invitations.map(asSentInvitation);

  if (members.some((one) => one == null) || invitations.some((one) => one == null)) return null;

  return {
    members: members as OrganisationMember[],
    invitations: invitations as SentInvitation[],
  };
}

function asMembership(raw: unknown): Membership | null {
  const organisation = asOrganisation(raw);
  const role = (raw as Record<string, unknown> | null)?.role as Record<string, unknown> | undefined;

  if (organisation == null || typeof role?.id !== 'string') return null;

  const candidate = raw as Record<string, unknown>;
  const permissions = candidate.permissions;

  return {
    ...organisation,
    role: {
      id: role.id,
      seededAs: typeof role.seededAs === 'string' ? role.seededAs : null,
      name: typeof role.name === 'string' ? role.name : null,
    },
    permissions: Array.isArray(permissions)
      ? permissions.filter((one): one is string => typeof one === 'string')
      : [],
    withheldUntilTwoFactor: stringList(candidate.withheldUntilTwoFactor) ?? [],
    readOnlyUntilLinked: candidate.readOnlyUntilLinked === true,
    twoFactorDue: asTwoFactorDue(candidate.twoFactorDue),
    signInRules: asOrganisationSignInRules(candidate.signInRules) ?? {
      providerOnly: false,
      inactivityTimeoutDays: null,
      administratorsNeedTwoFactor: false,
      everyoneNeedsTwoFactor: false,
      changedAt: null,
    },
  };
}

function asOrganisationSignInRules(raw: unknown): OrganisationSignInRules | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const rules = raw as Record<string, unknown>;

  if (
    typeof rules.providerOnly !== 'boolean' ||
    typeof rules.administratorsNeedTwoFactor !== 'boolean' ||
    (rules.inactivityTimeoutDays !== null && typeof rules.inactivityTimeoutDays !== 'number')
  )
    return null;

  return {
    providerOnly: rules.providerOnly,
    inactivityTimeoutDays: rules.inactivityTimeoutDays as number | null,
    administratorsNeedTwoFactor: rules.administratorsNeedTwoFactor,
    everyoneNeedsTwoFactor: rules.everyoneNeedsTwoFactor === true,
    changedAt: typeof rules.changedAt === 'string' ? rules.changedAt : null,
  };
}

const RULES = [
  'providerOnly',
  'inactivityTimeoutDays',
  'administratorsNeedTwoFactor',
  'everyoneNeedsTwoFactor',
] as const;

function asTwoFactorDeadline(raw: unknown): TwoFactorDeadline | null {
  const deadline = (raw ?? {}) as Record<string, unknown>;

  return typeof deadline.at === 'string' && typeof deadline.written === 'string'
    ? { at: deadline.at, written: deadline.written }
    : null;
}

const SUSPENSION_REASONS: readonly SuspensionReason[] = [
  'address_gone',
  'domain_closed',
  'domain_managed_elsewhere',
  'manual',
];

function asSuspension(raw: unknown): Suspension | null {
  const suspension = (raw ?? {}) as Record<string, unknown>;
  const reason = oneOf(suspension.reason, SUSPENSION_REASONS);
  const since = asTwoFactorDeadline(suspension.since);
  const removesAt = asTwoFactorDeadline(suspension.removesAt);

  return reason == null || since == null
    ? null
    : {
        reason,
        domain: stringOrNull(suspension.domain),
        since,
        removesAt,
        onlyOwner: suspension.onlyOwner === true,
      };
}

function asPausedOrganisation(raw: unknown): PausedOrganisation | null {
  const organisation = asOrganisation(raw);
  const suspension = asSuspension((raw as Record<string, unknown> | null)?.suspension);
  const claim = (raw as Record<string, unknown> | null)?.ownerClaim;
  const ownerClaim = claim == null ? null : asOwnerClaim(claim);

  return organisation == null || suspension == null || ownerClaim === undefined
    ? null
    : { ...organisation, suspension, ownerClaim };
}

const OWNER_CLAIM_STATES: readonly OwnerClaimState[] = ['no_owner', 'open', 'found', 'closed'];

/** `undefined` for a shape this client does not know, so it is never read as no claim. */
function asOwnerClaim(raw: unknown): OwnerClaim | undefined {
  const claim = (raw ?? {}) as Record<string, unknown>;
  const claimant = (claim.claimant ?? {}) as Record<string, unknown>;
  const record = claim.record as Record<string, unknown> | null | undefined;
  const startedAt = asTwoFactorDeadline(claim.startedAt);
  const lapsesAt = asTwoFactorDeadline(claim.lapsesAt);

  if (
    typeof claim.id !== 'string' ||
    typeof claimant.id !== 'string' ||
    typeof claimant.name !== 'string' ||
    typeof claim.domain !== 'string' ||
    startedAt == null ||
    lapsesAt == null
  ) {
    return undefined;
  }

  return {
    id: claim.id,
    claimant: { id: claimant.id, name: claimant.name, email: stringOrNull(claimant.email) },
    mine: claim.mine === true,
    domain: claim.domain,
    record:
      typeof record?.name === 'string' && typeof record.value === 'string'
        ? { type: 'TXT', name: record.name, value: record.value }
        : null,
    startedAt,
    lapsesAt,
    foundAt: asTwoFactorDeadline(claim.foundAt),
    passesAt: asTwoFactorDeadline(claim.passesAt),
  };
}

function asOwnerClaimBanner(raw: unknown): OwnerClaimBanner | undefined {
  const banner = (raw ?? {}) as Record<string, unknown>;
  const state = oneOf(banner.state, OWNER_CLAIM_STATES);
  const claim = banner.claim == null ? null : asOwnerClaim(banner.claim);
  const stopped = banner.stopped as Record<string, unknown> | null | undefined;
  const stoppedAt = asTwoFactorDeadline(stopped?.at);
  const lapsed = banner.lapsed as Record<string, unknown> | null | undefined;
  const lapsedOutcome = oneOf(lapsed?.outcome, ['unfound', 'record_removed'] as const);
  const lapsedAt = asTwoFactorDeadline(lapsed?.at);

  if (state == null || claim === undefined) return undefined;

  return {
    state,
    domain: typeof banner.domain === 'string' ? banner.domain : null,
    claim,
    stopped:
      stopped != null && stoppedAt != null
        ? {
            by: typeof stopped.by === 'string' ? stopped.by : '',
            claimant: typeof stopped.claimant === 'string' ? stopped.claimant : '',
            mine: stopped.mine === true,
            at: stoppedAt,
          }
        : null,
    lapsed:
      lapsedOutcome != null && lapsedAt != null ? { outcome: lapsedOutcome, at: lapsedAt } : null,
  };
}

function asTwoFactorDue(raw: unknown): TwoFactorDue | null {
  const deadline = asTwoFactorDeadline(raw);

  return deadline == null
    ? null
    : { ...deadline, overdue: (raw as Record<string, unknown>).overdue === true };
}

function asRulesMembers(raw: unknown): (RulesMember | null)[] | null {
  return Array.isArray(raw)
    ? raw.map((entry: unknown) => {
        const member = (entry ?? {}) as Record<string, unknown>;
        const role = asMemberRole(member.role);

        return typeof member.userId === 'string' && typeof member.name === 'string' && role != null
          ? { userId: member.userId, name: member.name, role }
          : null;
      })
    : null;
}

function asRuleValue(raw: unknown): boolean | number | null | undefined {
  return raw === null || typeof raw === 'boolean' || typeof raw === 'number' ? raw : undefined;
}

function asSignInRuleChange(raw: unknown): SignInRuleChange | null {
  const change = (raw ?? {}) as Record<string, unknown>;
  const by = (change.by ?? {}) as Record<string, unknown>;
  const now = asRuleValue(change.now);
  const was = asRuleValue(change.was);
  const rule = RULES.find((one) => one === change.rule);

  if (typeof change.entry !== 'string' || typeof change.at !== 'string') return null;
  if (typeof by.name !== 'string' || rule == null) return null;
  if (now === undefined || was === undefined) return null;

  return {
    entry: change.entry,
    at: change.at,
    by: { name: by.name, role: asMemberRole(by.role) },
    rule,
    now,
    was,
  };
}

function asSignInRulesPage(raw: unknown): SignInRulesPage | null {
  const rules = asOrganisationSignInRules(raw);

  if (rules == null) return null;

  const page = raw as Record<string, unknown>;
  const choices = Array.isArray(page.inactivityChoices)
    ? page.inactivityChoices.filter((one): one is number => typeof one === 'number')
    : null;
  const changes = Array.isArray(page.changes) ? page.changes.map(asSignInRuleChange) : null;
  const passwordOnly = asRulesMembers(page.passwordOnly);
  const withoutTwoFactor = asRulesMembers(page.withoutTwoFactor);

  if (choices == null || changes == null || changes.some((change) => change == null)) return null;
  if (passwordOnly?.some((member) => member == null)) return null;
  if (withoutTwoFactor?.some((member) => member == null)) return null;

  return {
    ...rules,
    inactivityChoices: choices,
    changes: changes as SignInRuleChange[],
    passwordOnly: passwordOnly as SignInRulesPage['passwordOnly'],
    withoutTwoFactor: withoutTwoFactor as SignInRulesPage['withoutTwoFactor'],
    twoFactorDeadline: asTwoFactorDeadline(page.twoFactorDeadline),
    inactivityLimit: asInactivityLimit(page.inactivityLimit),
    ownTwoFactor: page.ownTwoFactor === true,
    ownProvider: page.ownProvider === true,
  };
}

function asInactivityLimit(raw: unknown): InactivityLimit | null {
  const limit = (raw ?? {}) as Record<string, unknown>;

  return typeof limit.organisationId === 'string' &&
    typeof limit.organisation === 'string' &&
    typeof limit.days === 'number'
    ? { organisationId: limit.organisationId, organisation: limit.organisation, days: limit.days }
    : null;
}

function asLinkedPhone(raw: unknown): LinkedPhone | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const phone = raw as Record<string, unknown>;

  if (typeof phone.id !== 'string' || typeof phone.number !== 'string') return null;

  return {
    id: phone.id,
    number: phone.number,
    countryCode: typeof phone.countryCode === 'string' ? phone.countryCode : null,
    verified: phone.verified === true,
    primary: phone.primary === true,
    pending: phone.pending === true,
  };
}

function asSessions(raw: unknown): DeviceSession[] | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const listed = (raw as Record<string, unknown>).sessions;

  if (!Array.isArray(listed)) return null;

  const sessions: DeviceSession[] = [];

  for (const value of listed) {
    const session = value as Record<string, unknown>;

    if (typeof session?.id !== 'string' || session.id === '') return null;
    if (typeof session.startedAt !== 'string' || typeof session.expiresAt !== 'string') return null;

    sessions.push({
      id: session.id,
      userAgent: typeof session.userAgent === 'string' ? session.userAgent : null,
      ipAddress: typeof session.ipAddress === 'string' ? session.ipAddress : null,
      startedAt: session.startedAt,
      renewedAt: typeof session.renewedAt === 'string' ? session.renewedAt : session.startedAt,
      expiresAt: session.expiresAt,
    });
  }

  return sessions;
}

function asHealth(raw: unknown): Health | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.status !== 'string' || candidate.status === '') return null;
  if (typeof candidate.checks !== 'object' || candidate.checks == null) return null;

  const checks: Health['checks'] = {};

  for (const [name, value] of Object.entries(candidate.checks)) {
    if (typeof value !== 'object' || value == null) return null;

    const check = value as Record<string, unknown>;

    if (typeof check.status !== 'string') return null;

    checks[name] = {
      status: check.status,
      ...(typeof check.error === 'string' ? { error: check.error } : {}),
    };
  }

  return { status: candidate.status, checks };
}

function asChallenge(raw: unknown): TwoFactorChallenge | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const body = raw as Record<string, unknown>;
  const { twoFactorChallenge, challengeExpiresAt, email } = body;

  if (typeof twoFactorChallenge !== 'string' || typeof challengeExpiresAt !== 'string') return null;

  return {
    kind: 'twoFactor',
    challenge: twoFactorChallenge,
    expiresAt: challengeExpiresAt,
    email: typeof email === 'string' ? email : '',
  };
}

function asIssuedTokens(raw: unknown, delivery: RefreshTokenDelivery): IssuedTokens | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Partial<Record<keyof IssuedTokens, unknown>>;

  if (typeof candidate.accessToken !== 'string' || candidate.accessToken === '') return null;

  if (delivery === 'body' && typeof candidate.refreshToken !== 'string') return null;

  return {
    accessToken: candidate.accessToken,
    ...(typeof candidate.refreshToken === 'string' ? { refreshToken: candidate.refreshToken } : {}),
    refreshExpiresAt:
      typeof candidate.refreshExpiresAt === 'string' ? candidate.refreshExpiresAt : '',
    sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : '',
  };
}

function recoveryStateOf(answer: unknown): RecoveryState {
  const state =
    typeof answer === 'object' && answer != null
      ? asRecoveryState((answer as Record<string, unknown>).state)
      : null;

  if (state == null) {
    throw new Error(
      'The API answered a recovery step in a shape this client does not know. Check RecoveryView in services/api.',
    );
  }

  return state;
}

function asRecoveryState(raw: unknown): RecoveryState | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;
  const status = candidate.status;
  const known = ['proving', 'waiting', 'approved', 'turned_down', 'expired', 'cancelled'];

  if (
    typeof status !== 'string' ||
    !known.includes(status) ||
    typeof candidate.email !== 'string'
  ) {
    return null;
  }

  const codes =
    typeof candidate.codes === 'object' && candidate.codes != null
      ? (candidate.codes as Record<string, unknown>)
      : null;

  return {
    status: status as RecoveryStatus,
    email: candidate.email,
    phone: optionalString(candidate.phone),
    organisations: strings(candidate.organisations),
    nobody: candidate.nobody === true,
    supportAddress: optionalString(candidate.supportAddress) ?? '',
    askedAt: optionalString(candidate.askedAt),
    asked: optionalString(candidate.asked),
    expiresAt: optionalString(candidate.expiresAt),
    expires: optionalString(candidate.expires),
    codes:
      codes == null
        ? null
        : {
            state: openingFrom({ codeState: codes.state }).codeState,
            cooldownSeconds: cooldownFrom(codes),
            route: asRoute(codes.route),
          },
  };
}

function asRecoveryRequest(raw: unknown): RecoveryRequest | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.email !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    provedPhone: candidate.provedPhone === true,
    own: candidate.own === true,
    organisations: strings(candidate.organisations),
    asked: optionalString(candidate.asked),
    expires: optionalString(candidate.expires),
  };
}

function asRoute(route: unknown): PhoneCodeRoute | null {
  return route === 'whatsapp' ||
    route === 'sms_fallback' ||
    route === 'sms_chosen' ||
    route === 'sms_preferred' ||
    route === 'sms_only'
    ? route
    : null;
}

const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'guest_replies',
  'messages',
  'event_day',
  'event_changes',
  'money',
  'account_security',
];

function notificationCategory(raw: unknown): NotificationCategory | null {
  return NOTIFICATION_CATEGORIES.find((category) => category === raw) ?? null;
}

export function asNotificationItem(raw: unknown): NotificationItem | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;
  const category = notificationCategory(candidate.category);

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    category == null
  ) {
    return null;
  }

  return {
    id: candidate.id,
    category,
    title: candidate.title,
    lines: strings(candidate.lines),
    eventId: optionalString(candidate.eventId),
    eventName: optionalString(candidate.eventName),
    eventAvailable: candidate.eventAvailable === true,
    muted: candidate.muted === true,
    place: optionalString(candidate.place),
    read: candidate.read === true,
    createdAt: candidate.createdAt,
  };
}

function notificationItems(raw: unknown): NotificationItem[] {
  return Array.isArray(raw) ? raw.map(asNotificationItem).filter((item) => item != null) : [];
}

function notificationSettingsOf(body: { categories?: unknown }): NotificationSetting[] {
  if (!Array.isArray(body.categories)) return [];

  return body.categories.flatMap((raw: unknown): NotificationSetting[] => {
    if (typeof raw !== 'object' || raw == null) return [];

    const candidate = raw as Record<string, unknown>;
    const category = notificationCategory(candidate.category);

    return category == null
      ? []
      : [{ category, push: settingCell(candidate.push), email: settingCell(candidate.email) }];
  });
}

function settingCell(raw: unknown): { on: boolean; switchable: boolean } {
  const cell = typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {};

  return { on: cell.on === true, switchable: cell.switchable === true };
}

function strings(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === 'string')
    : [];
}

function optionalString(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

function openingFrom(answer: unknown): CodeOpening {
  const state =
    typeof answer === 'object' && answer != null
      ? (answer as Record<string, unknown>).codeState
      : null;

  return {
    cooldownSeconds: cooldownFrom(answer),
    codeState: state === 'expired' || state === 'exhausted' ? state : 'live',
  };
}

/** A wrong password on a signed-in request is the answer, not an expired session: refreshing would retry it. */
async function isAnswer(response: Response): Promise<boolean> {
  return new ApiError(await toProblem(response.clone()), response).is('invalid_credentials');
}

function cooldownFrom(answer: unknown): number {
  if (typeof answer !== 'object' || answer == null) return 0;

  const seconds = (answer as Record<string, unknown>).cooldownSeconds;

  return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
}

function linkedOrThrow<T>(linked: T | null): T {
  if (linked == null) {
    throw new Error(
      'The API answered an address or number in a shape this client does not know. Check ContactsController in services/api.',
    );
  }

  return linked;
}
