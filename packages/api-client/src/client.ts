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
  type EventTimeline,
  type EventsSearch,
  isEventType,
  type Milestone,
  MEMBERS_MOST,
  MILESTONE_OWNERS,
  type ServerClock,
  serverClock,
} from '@soirely/domain';

import {
  asGuest,
  asGuestDetails,
  asGuestGroup,
  asGuestList,
  asGuestPageCompanion,
  asGuestPagePlace,
  asGuestProgrammeItem,
  asGuestSeating,
  asPageNeeds,
  asHeadcount,
  asMarkedTogether,
  asMovedTogether,
  asRemovedTogether,
  asCheckIn,
  type CheckIn,
  type CompanionChoice,
  type Guest,
  type GuestEdit,
  type GuestAnswer,
  type GuestInvitationHow,
  type GuestGroup,
  type GuestList,
  type GuestPage,
  type GuestMeals,
  type Headcount,
  type MealAnswer,
  type MealAnswerKind,
  type MealChanged,
  type MealCourse,
  type MealPick,
  type MarkedTogether,
  type MovedTogether,
  type RemovedTogether,
  GUEST_ANSWERS,
  GUEST_PAGE_PHASES,
  type NewGuest,
  type PageNeeds,
  type PlaceChoice,
  type PlaceNeeds,
  type RecordedReplyInput,
  type TaggedGuest,
} from './guests.ts';
import {
  type Vendor,
  type VendorTyped,
  type VendorsLooking,
  type VendorsPage,
  asVendor,
  asVendorsPage,
  vendorsQuery,
} from './vendors.ts';
import { type WhatIf, type WhatIfChange, asWhatIf } from './budget.ts';
import { ApiError, ApiUnreachableError, type Problem, toProblem } from './problem.ts';
import { type EmailDomainsPage, asEmailDomainsPage } from './emailDomains.ts';
import { type OrganisationExportPage, asOrganisationExportPage } from './organisationExport.ts';
import { downloadName } from './fileName.ts';
import type {
  AudienceBook,
  AudienceMatch,
  GuestCondition,
  SavedAudience,
  GuestMessageCheck,
  GuestMessageDetails,
  GuestMessageInput,
  GuestMessagePreview,
  GuestMessageRow,
  GuestMessageSent,
  PickableGuest,
} from './guestMessages.ts';
import {
  type FinalNumbers,
  type KitchenSheet,
  asFinalNumbers,
  asKitchenSheet,
} from './kitchenSheet.ts';
import {
  type AuditExportOutcome,
  type AuditFilters,
  type AuditFormat,
  type AuditLogPage,
  asAuditLogPage,
  auditQuery,
} from './auditLog.ts';
import {
  asSeating,
  asSeatingMoved,
  type SeatingMove,
  type SeatingMoved,
  type SeatingPlaceKind,
  type Seating,
  type SeatingArrangement,
  type SeatingItemRef,
  type SeatingRestoredItem,
  type SeatingRoom,
  type SeatingWithChosen,
  type SeatingRowChanges,
  type SeatingTableChanges,
  type SingleSeatChanges,
  type SectionColour,
  type TableShape,
  versionTag,
} from './seating.ts';
import {
  type StaffAnswer,
  type StaffDetails,
  type ShiftDetails,
  type StaffAccess,
  type StaffEntry,
  type StaffLinkWindow,
  type StaffPlan,
  STAFF_ACCESS,
  asStaffEntry,
  asStaffLinkWindow,
  asStaffPlan,
  asStaffRoster,
} from './staff.ts';
import { type PhoneHint, asPhoneHint } from './phoneHint.ts';
import { type MyNight, asMyNight } from './myNight.ts';
import {
  type MobileAdded,
  type TypedMobile,
  type WalkOnAdded,
  type WalkOnTyped,
  type WhosHere,
  asMobileAdded,
  asWalkOnAdded,
  asWhosHere,
} from './whosHere.ts';
import {
  type ClockAction,
  type ClockOutcome,
  type HoursTyped,
  type StaffHours,
  asClockOutcome,
  asStaffHours,
} from './shiftHours.ts';
import {
  type Dish,
  type DishDetails,
  type DishLibrary,
  type VariantDetails,
  asDish,
  asDishLibrary,
} from './dishes.ts';
import {
  type ChoiceDetails,
  type EventMenu,
  type MenuAnswer,
  type MenuAskedAgain,
  type MenuChange,
  type MenuCourseDetails,
  type MenuItem,
  type SentCourseDefault,
  asEventMenu,
  asMenuAskedAgain,
} from './menu.ts';
import { type EventPicks, type HostPick, asEventPicks } from './picks.ts';
import {
  type Schedule,
  type ScheduleItemDetails,
  type ScheduleWithItem,
  type ScheduleItemPress,
  type PressSent,
  asSchedule,
} from './schedule.ts';
import type { KeptServiceTap } from './serviceTapQueue.ts';
import {
  type KitchenStationsRead,
  type ServiceRead,
  asKitchenStationsRead,
  asServiceRead,
} from './serviceRead.ts';
import { type RoomScreen, type ScreenLink, asRoomScreen, asScreenLinks } from './screens.ts';
import { type BudgetLineTyped, type EventBudget, asEventBudget } from './budget.ts';
import { type StaffRateTyped, type StaffRates, asStaffRates } from './staffRates.ts';
import { type BudgetMargin, type LineCharge, asBudgetMargin } from './margin.ts';
import {
  type EventPayers,
  type Payer,
  type PayerTyped,
  type SplitTyped,
  asEventPayers,
  asPayer,
} from './payers.ts';
import {
  type EventQuote,
  type EventQuotes,
  type OfferedVendor,
  type MadeTyped,
  type PaidTyped,
  type PaymentTyped,
  type QuoteTermsTyped,
  type QuoteTyped,
  type QuoteWordingTyped,
  asEventQuote,
  asEventQuotes,
  asOfferedVendors,
} from './quotes.ts';

/** A table call's answer: the plan whole, and the table it added or changed. */
export interface SeatingWithTable {
  seating: Seating;
  tableId: string;
}

/** A row call's answer: the plan whole, and the row it added or changed. */
export interface SeatingWithRow {
  seating: Seating;
  rowId: string;
}

/** A single seat call's answer: the plan whole, and the seat it added or changed. */
export interface SeatingWithSeat {
  seating: Seating;
  seatId: string;
}

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
  /** On an account with no email, its primary number as the step names it, masked (sc-4235). */
  phone: PhoneHint | null;
  /** What the account holds, so the step opens on a passkey or a code (sc-86885). */
  factors: HeldFactors;
}

export interface HeldFactors {
  app: boolean;
  passkeys: boolean;
}

export type SignInOutcome = SignedIn | TwoFactorChallenge;

export interface PhoneSignInSent {
  handle: string;
  cooldownSeconds: number;
}

/** Signed out at a door code (sc-4235): the sign-in, and You're in when it took the grant; none while two-factor waits. */
export interface DoorCodeSignedIn {
  outcome: SignInOutcome;
  redeemed: RedeemedDoorCode | null;
}

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

export type NotificationCategory =
  'guest_replies' | 'messages' | 'event_day' | 'event_changes' | 'money' | 'account_security';

/** A browser's Web Push subscription, or the app's Expo push token. */
export type PushTarget =
  | { kind: 'web'; address: string; keys: { p256dh: string; auth: string } }
  | { kind: 'expo'; address: string };

/** One bell item (sc-3980): `lines` are drawn one per row, as sent; `muted` and `eventAvailable` are the server's. `category` is kept as sent, so an item of a category this build does not know still shows (sc-84143). */
export interface NotificationItem {
  id: string;
  category: string;
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

/** A read made in one of the member's sessions, published to the others: one item, or every item when `id` is null. `removed` is an unread item taken away (sc-13214), `updated` one the member's own change rewrote (sc-21643). */
export interface NotificationRead {
  id: string | null;
  unreadCount: number;
  removed?: boolean;
  updated?: NotificationItem;
}

/** An item published to the member's bells, new or raised (sc-13214), with the count a reload would show (sc-21785). */
export interface NotificationArrival {
  item: NotificationItem;
  unreadCount: number;
}

/** Mute this event's saved state. Items already delivered keep the Muted mark they were delivered with. */
/** What a guest did since a look (sc-4331): a reply outranks the rest on the guest's one row. */
export type GuestChangeKind = 'replied' | 'changed' | 'needs' | 'flagged';
const GUEST_CHANGE_KINDS: readonly GuestChangeKind[] = ['replied', 'changed', 'needs', 'flagged'];

export interface GuestChange {
  guestId: string;
  kind: GuestChangeKind;
  at: string;
}

/** `since` is the time the rows count from, or `all` for a member who had never looked. */
export interface GuestChanges {
  since: string;
  rows: GuestChange[];
}

const asking = (path: string, askAgain: boolean): string =>
  askAgain ? `${path}?askAgain=1` : path;

function guestChangesOf(body: Record<string, unknown>): GuestChanges {
  const rows = Array.isArray(body.rows) ? body.rows : [];

  return {
    since: typeof body.since === 'string' ? body.since : 'all',
    rows: rows.flatMap((row: unknown): GuestChange[] => {
      if (typeof row !== 'object' || row == null) return [];
      const { guestId, kind, at } = row as Record<string, unknown>;
      const known = GUEST_CHANGE_KINDS.find((each) => each === kind);

      return typeof guestId === 'string' && typeof at === 'string' && known != null
        ? [{ guestId, kind: known, at }]
        : [];
    }),
  };
}

export interface EventMute {
  muted: boolean;
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

/** One request on an owner's card: never a code, only what was proved and when. */
export interface RecoveryRequest {
  id: string;
  /** Whose request it is: a removal from the organisation ends it there. */
  userId: string;
  name: string;
  email: string;
  provedPhone: boolean;
  own: boolean;
  organisations: string[];
  /** The organisations whose Members show it to this reader. */
  organisationIds: string[];
  askedAt: string | null;
  asked: string | null;
  expiresAt: string | null;
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
  /** False where this deployment has no relying party, or the browser could not make one anyway. */
  passkeysOffered: boolean;
  mostPasskeys: number;
  factors: TwoFactorFactor[];
}

export type TwoFactorFactor =
  | { kind: 'app'; addedAt: string }
  | { kind: 'passkey'; id: string; provider: string | null; synced: boolean; addedAt: string };

export type PasskeyAnswer = Record<string, unknown>;

export type PasskeyOptions = Record<string, unknown>;

export type PasskeyStep = 'proof' | 'add' | 'add_app' | 'remove' | 'new_codes' | 'turn_off';

/** An app code, a recovery code, or a passkey: what a signed-in change asks for once two-factor is on. */
export type CurrentFactor = { code: string } | { passkey: PasskeyAnswer };

export interface TwoFactorEnrolment {
  secret: string;
  otpauthUri: string;
  qrSvg: string;
}

export type SecondFactor = { code: string } | { recoveryCode: string } | { passkey: PasskeyAnswer };

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

/** The oldest app build each store may still serve, as the API's settings write it; null is no minimum. */
export interface MinimumAppVersions {
  ios: string | null;
  android: string | null;
}

export interface LinkedAddress {
  id: string;
  address: string;
  verified: boolean;
  primary: boolean;
  /** A hard bounce or a complaint stopped every non-security email to it (sc-4332); only its owner reads this. */
  undeliverable?: boolean;
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
  /** The colours the person picked for Soirely; null for the default (sc-30441). */
  colourScheme: string | null;
  emailAddresses: LinkedAddress[];
  phoneNumbers: LinkedPhone[];
  /** An account in no organisation that asked to join one at its domain (sc-561), until somebody answers. */
  waitingFor: JoinRequest | null;
  /** The events this account is on from outside their organisations (sc-71), soonest first. */
  outsideEvents: OutsideEvent[];
  /** When this session ends, for a browser's that ends with the account's grants (sc-4235); null for any other. */
  signedOutAt: string | null;
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
  /** The account is managed (sc-563): shown in place of Start my own organisation. */
  managed: ManagedAccount | null;
}

/** An account whose main address is at a domain its home organisation keeps to itself (sc-563); every other way in is refused `domain_managed`. */
export interface ManagedAccount {
  domain: string;
  organisation: { id: string; name: string };
  /** "Your {domain} address is managed by {organisation}, so you can only be a member there." */
  message: string;
}

/** Settings > General's Requests to join (sc-562): the link in full while it is on. */
export interface RequestLink {
  on: boolean;
  url: string | null;
}

/** The Calendar's private feed link (sc-3626): the same feed over https, and as webcal for a calendar app to subscribe to. */
export interface CalendarFeedLink {
  url: string;
  webcal: string;
}

/** Why somebody signed in cannot ask through a request link: they belong, they wait, or they were turned down lately. */
export type RequestStanding = 'member' | 'waiting' | 'cooling_off';

/** What a request link opens onto (sc-562). Only the organisation's name: a dead link is refused `request_link_dead`. */
export interface RequestLinkPreview {
  organisation: { name: string };
  standing: RequestStanding | null;
  /** While cooling off, when they may ask again. */
  askAgainFrom: string | null;
  /** Signed in with an account another organisation manages (sc-563): asking is refused. */
  managed: ManagedAccount | null;
}

/** Settings > General's Company domain joining (sc-561): `stopped` for one another organisation proved, `proved` for one this one proved under Email domains (sc-560). */
export interface CompanyDomains {
  domains: { domain: string; stopped: boolean; proved: boolean }[];
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
  /** The subscription's plan (sc-581, sc-3927): on `free`, an Enterprise setting is shown locked and a change to it is refused `plan_required`. */
  plan: Plan;
  /** Any member reads it; who pays is `GET /api/orgs/{id}/billing-account`, with billing.read (sc-3927). */
  subscription: OrganisationSubscription;
}

export type Plan = 'free' | 'enterprise';

export type SubscriptionStatus = 'active' | 'past_due' | 'read_only' | 'cancelled';

/** `periodEnd` is null for a subscription with no end, as Free has. */
export interface OrganisationSubscription {
  status: SubscriptionStatus;
  periodEnd: string | null;
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
}

/** Every role, and every registered permission grouped by area, in the order the grid shows them. */
export interface RolesCatalogue {
  roles: OrganisationRole[];
  areas: { area: string; permissions: string[] }[];
}

/** A role on one event (sc-29912), in the order People lists them: all a member may hold. */
export const EVENT_ROLES = ['lead', 'can_edit', 'can_view', 'can_check_in'] as const;

/** The levels that open the service and nothing else, for someone working a shift and never a member (sc-4002). */
export const SERVICE_LEVELS = ['can_work_floor', 'can_work_pass', 'can_run_floor'] as const;

export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

/** Everything a person may hold on an event, the roles before the service levels. */
export const EVENT_LEVELS = [...EVENT_ROLES, ...SERVICE_LEVELS] as const;

export type EventRole = (typeof EVENT_LEVELS)[number];

export function isServiceLevel(level: EventRole): level is ServiceLevel {
  return (SERVICE_LEVELS as readonly EventRole[]).includes(level);
}

/** Somebody with a role on an event: a member, or someone from outside the organisation (sc-71). */
export interface EventPerson {
  id: string;
  membershipId: string | null;
  /** Null until someone added by an address has an account: "Not joined yet" to anyone not given `address`. */
  user: { id: string; name: string } | null;
  role: EventRole;
  jobLabel: string | null;
  outside: boolean;
  /** Only to an Owner, an Admin or the event's Lead, and only until an account claims it (pm #67966). */
  address: string | null;
  addressKind: 'email' | 'mobile' | null;
  /** When the event concludes, for someone from outside; null for a member. */
  endsAt: string | null;
  doorCode: string | null;
  joinedAt: string | null;
}

/** Never edit, never running the floor: a code reaches whoever hears it (sc-72, sc-4002). */
export const DOOR_CODE_ROLES = [
  'can_view',
  'can_check_in',
  'can_work_floor',
  'can_work_pass',
] as const;
export type DoorCodeRole = (typeof DOOR_CODE_ROLES)[number];
export const DOOR_CODE_STATUSES = ['working', 'full', 'stopped', 'expired'] as const;
export type DoorCodeStatus = (typeof DOOR_CODE_STATUSES)[number];

/** A door code's card on People (sc-72), as DoorCodesController answers it. */
export interface DoorCodeCard {
  id: string;
  code: string;
  link: string;
  qrSvg: string;
  role: DoorCodeRole;
  jobLabel: string | null;
  useCap: number;
  used: number;
  status: DoorCodeStatus;
  expiresAt: string;
  stoppedAt: string | null;
  createdAt: string;
}

export interface NewDoorCode {
  role: DoorCodeRole;
  jobLabel: string | null;
  useCap: number;
  expiresAt: string;
  /** Make a new code: this code stops in the same write and leaves the list. */
  replaces?: string;
}

/** What a door code opens, shown before a name is asked for; `standing` is null signed out. */
export interface OpenedDoorCode {
  role: DoorCodeRole;
  jobLabel: string | null;
  event: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    organisation: string;
    /** The organisation's country, where a number typed at the door code starts. */
    country: string;
  };
  standing: 'member' | 'in' | null;
}

export interface RedeemedDoorCode {
  eventId: string;
  name: string;
  role: DoorCodeRole;
  jobLabel: string | null;
  endsAt: string | null;
  again: boolean;
  /** For a code that names a shift (sc-234): on it, the redeem ends on My night; not joined, You're in says why. */
  shift: { landsOn: 'night' } | { landsOn: 'in'; notJoined: 'full' | 'ended'; job: string } | null;
}

/** An event someone in no organisation of its own reaches from outside (sc-71). */
export interface OutsideEvent {
  id: string;
  name: string;
  organisationName: string;
  role: EventRole;
  jobLabel: string | null;
  startsAt: string;
  endsAt: string | null;
  /** The event's IANA zone, which its times are read in. */
  timeZone: string;
}

/** A person on the roster holding a link not yet ended (sc-3912), with their job's level; `signedIn` stays false until sc-4235 signs them in. */
export interface StaffLinkHolder {
  id: string;
  name: string;
  job: string | null;
  access: StaffAccess | null;
  endsAt: string;
  signedIn: boolean;
}

export interface EventPeople {
  people: EventPerson[];
  owners: string[];
  admins: string[];
  staffLinks: StaffLinkHolder[];
}

export interface AddableMember {
  membershipId: string;
  name: string;
  /** Their seeded role in the organisation, as `MemberRole.seededAs` names it. */
  role: string | null;
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
  /** The host's words on finding the way in, shown under the address and never translated; null when there are none (sc-24385). */
  arrivalNote: string | null;
  /** The names guests read, in order; none until somebody adds one, and Make live waits for one (sc-6713). */
  hosts: string[];
  /** The hosts' thank-you, in their own words; null until one is saved on the Finished event (sc-6476). */
  thankYou: string | null;
  /** Null while it is a Draft. */
  madeLiveAt: string | null;
  /** Null unless its phase is Paused (sc-3586). */
  pausedAt: string | null;
  /** The server's, as the page shows it on load; a client works one out only to flip it at a boundary (sc-3585). */
  phase: EventPhase;
  /** The end, or when it was ended or called off; null until it is Finished. */
  concludedAt: string | null;
  /** Why Delete event would be refused 409 `event_call_off_first` now, worked out by the server (sc-14445); absent reads as null. */
  deleteRefusedBecause?: DeleteRefusal | null;
  /** The day guests answer by, in `timeZone` (sc-3780); null leaves replies open until the start, and absent reads as null. */
  replyBy?: string | null;
  /** 23:59:59 on `replyBy` in `timeZone`, with its offset; null with no Reply by. */
  repliesCloseAt?: string | null;
  /** The day replies closed in `timeZone`, the day of the save that closed them when one did; null while they are open. */
  repliesClosedOn?: string | null;
  createdAt: string;
  /** What the caller may do on this event: a Member's follow their role on it, not the organisation's (sc-29915). */
  permissions: string[];
  /** A Member's role on this event, where their `permissions` come from; null for every other organisation role, and absent reads as null (sc-59617). */
  roleOnEvent?: EventRole | null;
}

/** The tiles' measure on Events (sc-23284), which each event's guest line adds up to: `notReplied` is the guests who owe an answer and the companions held behind them. */
export interface EventGuestFigures {
  invited: number;
  coming: number;
  notReplied: number;
  /** sc-99's attended and expected, the door's count (sc-1454), for Today's arrived line (sc-29978). */
  attended: number;
  expected: number;
}

/** As a list shows it: with its timeline's milestones, so the list's Next up is the timeline's (sc-3624), and its guest figures from the list, null without guests.read on it (sc-3786). */
export interface ListedEvent extends OrganisationEvent {
  milestones: Milestone[];
  guests?: EventGuestFigures | null;
}

export interface EventsQuery {
  finished?: boolean;
  page?: number;
  itemsPerPage?: number;
  /** Searched by name or venue, and filtered by type, the days and the hosts (sc-30302). */
  search?: EventsSearch;
}

export interface EventsPage {
  events: ListedEvent[];
  total: number;
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

/** `startsAt` and `endsAt` are local to `timeZone`, with no offset: "2026-11-14T16:00". `hosts` is checked as an edit's (sc-22143). */
export interface NewEvent {
  name: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  currency: string;
  venue?: VenueInput | null;
  /** Saved trimmed; null or blank removes it. Apart from `venue`, so a note can stand without one (sc-24385). */
  arrivalNote?: string | null;
  hosts?: string[];
  /** A day before the start's, in `timeZone`; null removes it, refused 422 on `replyBy` otherwise (sc-3780). */
  replyBy?: string | null;
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

/** What an edit sends: any of the fields, those left out keep their value (sc-3587); `hosts` is the whole list (sc-6713). */
export type EventChanges = Partial<NewEvent>;

/** An event with its `ETag`, which an edit sends back as `If-Match`. */
export interface TaggedEvent {
  event: OrganisationEvent;
  tag: string;
}

/** The event's version in its tag (`EntityTag::of`), with the coding Caddy suffixes a strong tag with (`"2-zstd"`) left off. */
export function eventVersion(tag: string): number {
  const version = /^"(\d+)(?:-(?:zstd|br|gzip))?"$/.exec(tag)?.[1];

  if (version == null) {
    throw new Error(
      `The API tagged an event ${tag}, which is not a version. Check EntityTag in services/api.`,
    );
  }

  return Number(version);
}

export interface Membership extends Organisation {
  role: MemberRole;
  /** What this role holds here, every registered one for Owner (sc-66): what a client may show. */
  permissions: string[];
  /** Held by the role but kept back until this account turns on two-factor (sc-69). */
  withheldUntilTwoFactor: string[];
  /** Under a Google-or-Apple-only rule with no provider linked: may read, not change (sc-69). */
  readOnlyUntilLinked: boolean;
  /** The changes the role holds that the read-only rule keeps back, empty unless `readOnlyUntilLinked` (sc-16265). */
  withheldUntilLinked: string[];
  /** What a Member's roles on events allow beyond this role, each held on at least one event (sc-3901). */
  onAnEvent: string[];
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

/** How many days before a payment falls due its reminder goes; `inForce` is false once the plan no longer has payment schedules (sc-95). */
export interface PaymentRemindersSetting {
  days: number;
  inForce: boolean;
}

export interface SignInRulesPage extends OrganisationSignInRules {
  inactivityChoices: number[];
  changes: SignInRuleChange[];
  /** Members with no Google or Apple linked, never the caller; only for a caller who may change the rules. */
  passwordOnly: RulesShort | null;
  /** Members with no two-factor, never the caller; only for a caller who may change the rules (sc-609). */
  withoutTwoFactor: RulesShort | null;
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

/** Who a rule leaves short: every one of them named up to three, and only counted past that (sc-18317). */
export interface RulesShort {
  count: number;
  named: RulesMember[];
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
  /** A phone-only account (sc-4235): the masked number in place of the address, and whether it must add the invited one first. */
  signedInAsPhone: PhoneHint | null;
  needsEmail: boolean;
  /** sc-73668: the account is managed by another organisation, so this one cannot be accepted; worked out on every load. */
  managed: ManagedAccount | null;
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

/** What the sidebar's Search may find for the caller (sc-39534): events.read, guests.read on at least one event, members.read. */
export interface SearchReach {
  events: boolean;
  guests: boolean;
  members: boolean;
}

/** A guest Search found: their name and their event, and never their contact details. */
export interface SearchGuest {
  id: string;
  name: string;
  event: { id: string; name: string; startsAt: string; timeZone: string };
}

/** Somebody Settings › Members lists to the caller; an Invited person is an invitation and has no name yet. */
export interface SearchMember {
  id: string;
  kind: 'member' | 'invitation';
  name: string | null;
  email: string | null;
  role: MemberRole | null;
  status: 'active' | 'suspended' | 'pending_approval' | 'invited';
}

/** Up to five matches and the count of all of them. */
export interface SearchKind<Match> {
  total: number;
  matches: Match[];
}

/** A kind is null where the caller may not find it. */
export interface SearchFound {
  events: SearchKind<OrganisationEvent> | null;
  guests: SearchKind<SearchGuest> | null;
  members: SearchKind<SearchMember> | null;
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
  /** For the owners and admins of the organisation that manages this person (sc-563): how many other organisations they belong to, never which. */
  alsoMemberOf: number | null;
}

export type SentInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface SentInvitation {
  id: string;
  email: string;
  role: MemberRole | null;
  invitedBy: MemberPerson | null;
  status: SentInvitationStatus;
  sentAt: string | null;
  /** Its latest send could not be delivered, never why (sc-46109). */
  undelivered: boolean;
  expiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

/** The options under Show that list memberships. Invited lists invitations, which every page carries whole. */
export type MembersShow = 'all' | 'active' | 'waiting' | 'suspended' | 'former';

export const MEMBERS_SHOWN: readonly MembersShow[] = [
  'all',
  'active',
  'waiting',
  'suspended',
  'former',
];

/** Settings › Members (sc-49170): People under one option a page at a time, and everything else whole. */
export interface MembersList {
  members: OrganisationMember[];
  /** What the next page is read after; null once every person under the option is here. */
  next: string | null;
  counts: Record<MembersShow, number>;
  owners: number;
  faces: OrganisationMember[];
  /** Everybody waiting for approval, only to those who decide on them. */
  waiting: OrganisationMember[];
  /** Every invitation sent, on a first page only: a later page carries none, and `withNextPage` keeps the ones held. */
  invitations: SentInvitation[];
}

export interface MembersPage {
  show?: MembersShow;
  after?: string | null;
  limit?: number;
}

/** What deleting an organisation destroys, and until when support can restore it, as the reader writes it. */
export interface OrganisationDeletion {
  events: number;
  guests: number;
  members: number;
  restoreClosesAt: string;
  restoreCloses: string;
}

/** `guestsInvited`: a Live or Paused event with a guest Invited is deleted only once it is Finished (sc-14445). Any reason refuses the same way. */
export type DeleteRefusal = string;

/** What an event's delete asks for: its name typed unless it is a Draft with nobody on its list, and until when support can restore it (sc-3592). */
export interface EventDeletion {
  needsName: boolean;
  /** The Guests header's N, guests and companions together (sc-1468). */
  people: number;
  deleteRefusedBecause: DeleteRefusal | null;
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
  /** The session the request came from, by its sign-in rather than its id, which every refresh renews. */
  thisDevice: boolean;
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
  /** The reader's language, with the device's region while the device speaks it, which the dates the API writes for a screen follow (sc-65714). */
  locale?: () => string | null;
  /** The device's IANA zone, which sets an account's own until it has one (sc-868). */
  timeZone?: () => string | null;
  /** The app's own `Soirely/<version> (…)`, by which its sessions are named (sc-1242). A browser sends its own and cannot replace it. */
  userAgent?: string;
  /** The app's install identifier, by which a sign-in from a new device is told apart (sc-511). The web has a cookie instead. */
  device?: () => string | null;
  /** Called when refresh fails and the session is over, with the API's reason when it gave one, such as `session_timed_out`. */
  onSignedOut?: (why?: Problem) => void;
  /** Called once a sign-in has stored a session, by any way in; never by a refresh, a challenge or a refusal. */
  onSignedIn?: () => void | Promise<void>;
  /** Called when the API refuses a request because the account is behind an onboarding gate. */
  onGate?: (gate: Gate) => void;
  fetch?: typeof fetch;
  /** Fed every response's `Date` header; the shared one unless a test gives its own (sc-3585). */
  clock?: ServerClock;
}

/** Who is in an exported file and how it is written (sc-3784); `scope` is the dialog's choice, for the audit entry. */
export interface GuestExportRequest {
  format: 'xlsx' | 'csv';
  scope: 'view' | 'all';
  people: readonly string[];
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Sent even as the page goes, as an erasure on leaving it is. */
  keepalive?: boolean;
  /** Skip the Authorization header — for sign-in and guest routes. */
  anonymous?: boolean;
}

const DISH_SHAPE =
  'The API answered the menu library in a shape this client does not know. Check DishSerialiser in services/api.';

export class ApiClient {
  /** Bumped whenever the session changes hands, so an answer meant for an earlier one is let go (sc-16226). */
  private session = 0;
  private refreshing: { session: number; done: Promise<boolean> } | null = null;
  /** The session ends when sign-out starts, so no refresh begins until its tokens are cleared. */
  private signingOut = 0;

  constructor(private readonly options: ClientOptions) {}

  async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    return (await this.exchange<T>(path, init)).body;
  }

  private async exchange<T>(
    path: string,
    init: RequestOptions,
  ): Promise<{ body: T; response: Response }> {
    const response = await this.answered(path, init);

    if (response.status === 204) return { body: undefined as T, response };

    return { body: (await response.json()) as T, response };
  }

  /** A successful answer, after the one refresh a 401 earns; anything else is thrown as the ApiError it is. */
  private async answered(path: string, init: RequestOptions): Promise<Response> {
    const session = this.session;
    let response = await this.send(path, init);

    // One retry, and only after a refresh that actually succeeded. Retrying a
    // 401 without that is an infinite loop against an expired session.
    if (
      response.status === 401 &&
      !init.anonymous &&
      this.options.tokens != null &&
      this.session === session &&
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

    return response;
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

  async signInPasskeyOptions(challenge: string): Promise<PasskeyOptions> {
    return this.post<PasskeyOptions>(
      '/api/auth/two-factor/passkey-options',
      { challenge },
      {
        anonymous: true,
      },
    );
  }

  async twoFactorStatus(): Promise<TwoFactorStatus> {
    const body = await this.get<Partial<TwoFactorStatus>>('/api/auth/two-factor');

    return {
      on: body.on === true,
      recoveryCodesLeft: typeof body.recoveryCodesLeft === 'number' ? body.recoveryCodesLeft : 0,
      passkeysOffered: body.passkeysOffered === true,
      mostPasskeys: typeof body.mostPasskeys === 'number' ? body.mostPasskeys : 10,
      factors: Array.isArray(body.factors) ? body.factors : [],
    };
  }

  /** A new secret, off until `activateTwoFactor` is sent a code it made; beside passkeys it takes one. */
  async enrolTwoFactor(current?: CurrentFactor): Promise<TwoFactorEnrolment> {
    return this.post<TwoFactorEnrolment>('/api/auth/two-factor/enrol', current);
  }

  /** To make a passkey: none asked while two-factor is off, the current factor once it is on. */
  async passkeyCreationOptions(current?: CurrentFactor): Promise<PasskeyOptions> {
    return this.post<PasskeyOptions>('/api/auth/two-factor/passkeys/options', {
      make: true,
      ...current,
    });
  }

  async passkeyOptions(step: PasskeyStep): Promise<PasskeyOptions> {
    return this.post<PasskeyOptions>('/api/auth/two-factor/passkeys/options', { step });
  }

  /** @returns the recovery codes when this passkey turned two-factor on, none when it joined */
  async addPasskey(passkey: PasskeyAnswer): Promise<string[]> {
    return (
      await this.post<{ recoveryCodes: string[] }>('/api/auth/two-factor/passkeys', { passkey })
    ).recoveryCodes;
  }

  /** `factor` is `app` or a passkey's id; the last one is refused as `two_factor_last_factor`. */
  async removeTwoFactorFactor(factor: string, current: CurrentFactor): Promise<void> {
    await this.post('/api/auth/two-factor/remove', { factor, ...current });
  }

  /** @returns the recovery codes, which the API shows this once */
  async activateTwoFactor(code: string): Promise<string[]> {
    return (await this.post<{ recoveryCodes: string[] }>('/api/auth/two-factor/activate', { code }))
      .recoveryCodes;
  }

  /** Takes an app code or an unused recovery code; every earlier recovery code stops working. */
  async newRecoveryCodes(current: string | CurrentFactor): Promise<string[]> {
    return (
      await this.post<{ recoveryCodes: string[] }>(
        '/api/auth/two-factor/recovery-codes',
        typeof current === 'string' ? { code: current } : current,
      )
    ).recoveryCodes;
  }

  async disableTwoFactor(current: string | CurrentFactor): Promise<void> {
    await this.post(
      '/api/auth/two-factor/disable',
      typeof current === 'string' ? { code: current } : current,
    );
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
    code?: string | { passkey: PasskeyAnswer },
  ): Promise<RecentProof> {
    const body = await this.post<{ proof?: unknown; expiresAt?: unknown }>('/api/auth/proof', {
      ...('password' in first
        ? { password: first.password }
        : 'pendingProof' in first
          ? { pendingProof: first.pendingProof }
          : { provider: first.provider, providerSignIn: first.signIn }),
      ...(code == null ? {} : typeof code === 'string' ? { code } : code),
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
  async checkResetLink(token: string): Promise<{
    email: string;
    twoFactor: boolean;
    factors: HeldFactors;
  }> {
    const body = await this.post<{
      email?: unknown;
      twoFactor?: unknown;
      factors?: unknown;
    }>('/api/auth/password/reset/check', { token });

    return {
      email: typeof body?.email === 'string' ? body.email : '',
      twoFactor: body?.twoFactor === true,
      factors: asHeldFactors(body?.factors),
    };
  }

  async resetPasskeyOptions(token: string): Promise<PasskeyOptions> {
    return this.post<PasskeyOptions>('/api/auth/password/reset/passkey-options', { token });
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

  async muteEvent(eventId: string, muted: boolean): Promise<EventMute> {
    const body = await this.put<{ muted?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/mute`,
      { muted },
    );

    return { muted: body.muted === true };
  }

  /** Changed since you looked (sc-4331): from `since` in the address (`all` for every change), or from the caller's last look when none is given. Marks nothing read. */
  async guestChanges(eventId: string, since?: string): Promise<GuestChanges> {
    const query = since == null ? '' : `?since=${encodeURIComponent(since)}`;

    return guestChangesOf(
      await this.get<Record<string, unknown>>(
        `/api/events/${encodeURIComponent(eventId)}/guests/changes${query}`,
      ),
    );
  }

  /** Choosing Changed since you looked from the menu: a look, which marks the event's Guest replies item read. */
  async lookAtGuestChanges(eventId: string): Promise<GuestChanges> {
    return guestChangesOf(
      await this.post<Record<string, unknown>>(
        `/api/events/${encodeURIComponent(eventId)}/guests/changes/look`,
        {},
      ),
    );
  }

  /** Where Guest replies email stands for the member the summary's link names (sc-4331); a link that does not work is a 404. */
  async guestReplyEmails(token: string): Promise<boolean> {
    const body = await this.post<{ emailOn?: unknown }>(
      '/api/unsubscribe/guest-replies',
      { token },
      { anonymous: true },
    );

    return body.emailOn === true;
  }

  async setGuestReplyEmails(token: string, emailOn: boolean): Promise<boolean> {
    const body = await this.put<{ emailOn?: unknown }>(
      '/api/unsubscribe/guest-replies',
      { token, emailOn },
      { anonymous: true },
    );

    return body.emailOn === true;
  }

  /** The VAPID public key this browser subscribes with (sc-3980). */
  async webPushKey(): Promise<string> {
    const body = await this.get<{ webPushKey?: unknown }>('/api/auth/push-targets');

    return typeof body.webPushKey === 'string' ? body.webPushKey : '';
  }

  /** This device's push, under the current session, so that signing out here ends it. */
  async registerPushTarget(target: PushTarget): Promise<void> {
    await this.put<unknown>('/api/auth/push-targets', target);
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
  /** The signed-in person's own name, saved with its ends trimmed; refused with a `name` violation when blank or too long. */
  async setName(name: string): Promise<void> {
    await this.put<unknown>('/api/auth/name', { name });
  }

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

  /** Settings › Vendors › Payment reminders (sc-95): an Owner's or an Admin's; anybody else is refused 403. */
  async paymentReminders(organisationId: string): Promise<PaymentRemindersSetting> {
    return this.readPaymentReminders(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/payment-reminders`),
    );
  }

  /** Refused `validation_failed` at `days` for anything but a whole number from 1 to 30. */
  async updatePaymentReminders(
    organisationId: string,
    days: number,
  ): Promise<PaymentRemindersSetting> {
    return this.readPaymentReminders(
      await this.put<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/payment-reminders`, {
        days,
      }),
    );
  }

  private readPaymentReminders(raw: unknown): PaymentRemindersSetting {
    if (
      raw == null ||
      typeof raw !== 'object' ||
      !('days' in raw) ||
      typeof raw.days !== 'number' ||
      !('inForce' in raw) ||
      typeof raw.inForce !== 'boolean'
    ) {
      throw new Error(
        'The API answered /api/orgs/{id}/payment-reminders in a shape this client does not know. Check PaymentRemindersController in services/api.',
      );
    }

    return { days: raw.days, inForce: raw.inForce };
  }

  /** Data and control › Export all data (sc-612): an Owner's or an Admin's read; a Member is refused. */
  async organisationExport(organisationId: string): Promise<OrganisationExportPage> {
    return this.readOrganisationExport(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/export`),
    );
  }

  /** Refused `owner_required` for anyone but an Owner, and `too_many_attempts` with `retryAt` within 24 hours of the last. */
  async askOrganisationExport(organisationId: string): Promise<OrganisationExportPage> {
    return this.readOrganisationExport(
      await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/export`),
    );
  }

  /** The archive, once, for the Owner who asked: 404 for anyone else, `export_used` or `export_expired` after. `name` is the server's name for it. */
  async downloadOrganisationExport(
    organisationId: string,
    exportId: string,
  ): Promise<{ name: string | null; bytes: Uint8Array<ArrayBuffer> }> {
    const response = await this.answered(
      `/api/orgs/${encodeURIComponent(organisationId)}/export/${encodeURIComponent(exportId)}/download`,
      { method: 'POST' },
    );

    return {
      name: downloadName(response.headers.get('Content-Disposition')),
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }

  /** Data and control › Audit log (sc-611): an Owner's or an Admin's, refused `plan_required` off Enterprise and `permission_required` to a Member. */
  async auditLog(
    organisationId: string,
    filters: AuditFilters = {},
    before: string | null = null,
  ): Promise<AuditLogPage> {
    const raw = await this.get<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/audit-log`,
      { query: { ...auditQuery(filters), ...(before == null ? {} : { before }) } },
    );
    const page = asAuditLogPage(raw);

    if (page == null) {
      throw new Error(
        'The API answered /api/orgs/{id}/audit-log in a shape this client does not know. Check AuditLogController in services/api.',
      );
    }

    return page;
  }

  /** Opening the log is itself audited, once per opening; filtering and loading more are not. */
  async auditLogViewed(organisationId: string): Promise<void> {
    await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/audit-log/views`);
  }

  /** The filtered entries: up to 10,000 as the file itself, more prepared and emailed; over 1,000,000 refused `audit_export_too_many`. */
  async exportAuditLog(
    organisationId: string,
    format: AuditFormat,
    filters: AuditFilters = {},
  ): Promise<AuditExportOutcome> {
    const response = await this.answered(
      `/api/orgs/${encodeURIComponent(organisationId)}/audit-log/exports`,
      { method: 'POST', body: { format, ...auditQuery(filters) } },
    );

    if (response.status === 202) {
      const raw = (await response.json()) as Record<string, unknown> | null;

      return {
        kind: 'preparing',
        count: typeof raw?.count === 'number' ? raw.count : 0,
        email: typeof raw?.email === 'string' ? raw.email : '',
      };
    }

    return {
      kind: 'file',
      type: response.headers.get('Content-Type') ?? 'application/octet-stream',
      name: downloadName(response.headers.get('Content-Disposition')),
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }

  /** A prepared export, for the person who asked, signed in, within 24 hours of its being ready: 404 for anyone else, `export_expired` after. */
  async downloadAuditExport(
    organisationId: string,
    exportId: string,
  ): Promise<{ type: string; name: string | null; bytes: Uint8Array<ArrayBuffer> }> {
    const response = await this.answered(
      `/api/orgs/${encodeURIComponent(organisationId)}/audit-log/exports/${encodeURIComponent(exportId)}/download`,
      { method: 'POST' },
    );

    return {
      type: response.headers.get('Content-Type') ?? 'application/octet-stream',
      name: downloadName(response.headers.get('Content-Disposition')),
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }

  /** Data and control › Email domains (sc-560): an Owner's or an Admin's; a Member is refused, and a change off Enterprise `plan_required`. */
  async emailDomains(organisationId: string): Promise<EmailDomainsPage> {
    return this.readEmailDomains(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/email-domains`),
    );
  }

  /** 422 on `domain`: `domain_blank`, `domain_invalid`, `domain_public`, `domain_listed` or `domain_taken`. */
  async addEmailDomain(organisationId: string, domain: string): Promise<EmailDomainsPage> {
    return this.readEmailDomains(
      await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/email-domains`, {
        domain,
      }),
    );
  }

  /** `found` false while the record cannot be found; 409 `email_domain_taken` once another organisation has proved it. */
  async verifyEmailDomain(
    organisationId: string,
    domain: string,
  ): Promise<{ found: boolean; page: EmailDomainsPage }> {
    const raw = await this.post<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/email-domains/${encodeURIComponent(domain)}/verify`,
    );

    return {
      found: (raw as Record<string, unknown> | null)?.found === true,
      page: this.readEmailDomains(raw),
    };
  }

  async removeEmailDomain(organisationId: string, domain: string): Promise<EmailDomainsPage> {
    return this.readEmailDomains(
      await this.delete<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/email-domains/${encodeURIComponent(domain)}`,
      ),
    );
  }

  /** Only our organisation (sc-563): the Owner's alone, `owner_required` to anyone else; it starts 14 days on and everyone at the domain is emailed now. */
  async switchOnlyOursOn(organisationId: string, domain: string): Promise<EmailDomainsPage> {
    return this.readEmailDomains(
      await this.post<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/email-domains/${encodeURIComponent(domain)}/only-ours`,
      ),
    );
  }

  /** Cancels it while it is scheduled, and switches it off once it has started. */
  async switchOnlyOursOff(organisationId: string, domain: string): Promise<EmailDomainsPage> {
    return this.readEmailDomains(
      await this.delete<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/email-domains/${encodeURIComponent(domain)}/only-ours`,
      ),
    );
  }

  private readEmailDomains(raw: unknown): EmailDomainsPage {
    const page = asEmailDomainsPage(raw);

    if (page == null) {
      throw new Error(
        'The API answered /api/orgs/{id}/email-domains in a shape this client does not know. Check EmailDomainsController in services/api.',
      );
    }

    return page;
  }

  private readOrganisationExport(raw: unknown): OrganisationExportPage {
    const page = asOrganisationExportPage(raw);

    if (page == null) {
      throw new Error(
        'The API answered /api/orgs/{id}/export in a shape this client does not know. Check ExportController in services/api.',
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

  /** The currency a new organisation starts with in each country, by its code; none for a country with no money of its own (sc-30412). */
  async countryCurrencies(): Promise<ReadonlyMap<string, string | null>> {
    const body = await this.get<{ countries?: unknown }>('/api/countries');
    const listed = Array.isArray(body?.countries) ? body.countries : null;
    const currencies = new Map<string, string | null>();

    for (const country of listed ?? []) {
      const { code, currency } = (country ?? {}) as { code?: unknown; currency?: unknown };
      if (typeof code !== 'string' || (currency !== null && typeof currency !== 'string')) {
        currencies.clear();
        break;
      }
      currencies.set(code, currency);
    }

    if (currencies.size === 0) {
      throw new Error(
        'The API answered /api/countries in a shape this client does not know. Check CountriesController in services/api.',
      );
    }

    return currencies;
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

  /** One page of the unfinished events, soonest first, or of the Finished, most recently finished first; `total` counts every page (sc-3594). */
  async events(
    organisationId: string,
    { finished = false, page = 1, itemsPerPage, search }: EventsQuery = {},
  ): Promise<EventsPage> {
    const query = new URLSearchParams({ finished: String(finished), page: String(page) });

    if (itemsPerPage != null) query.set('itemsPerPage', String(itemsPerPage));
    if (search?.q != null) query.set('q', search.q);
    if (search?.types != null && search.types.length > 0) query.set('type', search.types.join(','));
    if (search?.from != null) query.set('from', search.from);
    if (search?.to != null) query.set('to', search.to);
    for (const host of search?.hosts ?? []) query.append('host[]', host);

    const body = await this.get<{ events?: unknown; total?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/events?${query.toString()}`,
    );
    const events = Array.isArray(body?.events) ? body.events.map(asListedEvent) : null;

    if (events == null || events.some((event) => event == null) || !isCount(body?.total)) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/events in a shape this client does not know. Check the events controller in services/api.',
      );
    }

    return { events: events as ListedEvent[], total: body.total };
  }

  /** Every page of them, so a list can group them by the clock without one falling off a page (sc-3594). */
  async unfinishedEvents(organisationId: string): Promise<ListedEvent[]> {
    return this.everyPage(organisationId, { finished: false });
  }

  /** Every event that matches, the unfinished and the Finished, for Events' results (sc-30302). */
  async searchedEvents(
    organisationId: string,
    search: EventsSearch,
  ): Promise<{ unfinished: ListedEvent[]; past: ListedEvent[] }> {
    const query = { itemsPerPage: MOST_EVENTS_PER_PAGE, search };
    const [unfinished, past] = await Promise.all([
      this.everyPage(organisationId, { ...query, finished: false }),
      this.everyPage(organisationId, { ...query, finished: true }),
    ]);

    return { unfinished, past };
  }

  /** Which kinds the sidebar's Search may find for the caller, for its field's words (sc-39534). */
  async searchReach(organisationId: string): Promise<SearchReach> {
    const body = await this.get<Record<string, unknown> | null>(
      `/api/orgs/${encodeURIComponent(organisationId)}/search/reach`,
    );

    if (
      typeof body?.events !== 'boolean' ||
      typeof body.guests !== 'boolean' ||
      typeof body.members !== 'boolean'
    ) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/search/reach in a shape this client does not know. Check the search controller in services/api.',
      );
    }

    return { events: body.events, guests: body.guests, members: body.members };
  }

  /** The sidebar's Search (sc-39534): each kind's first five matches and the count of all, only what the caller may open. Without invitations, no invited person is matched or counted. */
  async search(
    organisationId: string,
    term: string,
    { invitations = true, signal }: { invitations?: boolean; signal?: AbortSignal } = {},
  ): Promise<SearchFound> {
    const query = new URLSearchParams({ q: term });
    if (!invitations) query.set('invitations', 'false');

    const body = await this.get<Record<string, unknown> | null>(
      `/api/orgs/${encodeURIComponent(organisationId)}/search?${query.toString()}`,
      signal == null ? undefined : { signal },
    );
    const events = asSearchKind(body?.events, asOrganisationEvent);
    const guests = asSearchKind(body?.guests, asSearchGuest);
    const members = asSearchKind(body?.members, asSearchMember);

    if (events === undefined || guests === undefined || members === undefined) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/search in a shape this client does not know. Check the search controller in services/api.',
      );
    }

    return { events, guests, members };
  }

  /** The names Events' Filter offers under Hosted by, alphabetical (sc-30302). */
  async eventHosts(organisationId: string): Promise<string[]> {
    const body = await this.get<{ hosts?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/events/hosts`,
    );
    const hosts = body?.hosts;

    if (!Array.isArray(hosts) || hosts.some((host) => typeof host !== 'string')) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/events/hosts in a shape this client does not know. Check the events controller in services/api.',
      );
    }

    return hosts as string[];
  }

  /** Every event the organisation has, unfinished and Finished, as the Calendar places them all (sc-3625). */
  async allEvents(organisationId: string): Promise<ListedEvent[]> {
    const query = { itemsPerPage: MOST_EVENTS_PER_PAGE };

    return [
      ...(await this.everyPage(organisationId, { ...query, finished: false })),
      ...(await this.everyPage(organisationId, { ...query, finished: true })),
    ];
  }

  private async everyPage(
    organisationId: string,
    query: Omit<EventsQuery, 'page'>,
  ): Promise<ListedEvent[]> {
    const events: ListedEvent[] = [];

    for (let page = 1; ; page++) {
      const read = await this.events(organisationId, { ...query, page });

      events.push(...read.events);

      if (read.events.length === 0 || events.length >= read.total) return events;
    }
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

  /** A Draft set up as the event, from `startsAt` local to its zone (sc-3593). Refused `validation_failed` on startsAt. */
  async duplicateEvent(eventId: string, startsAt: string): Promise<OrganisationEvent> {
    return this.organisationEvent(
      await this.post<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}/duplicate`, {
        startsAt,
      }),
    );
  }

  /** As `duplicateEvent`, bringing the guest list too, with no replies and nobody invited (sc-3656). Refused 403 `permission_required` without guests.manage. */
  async duplicateEventWithGuests(
    eventId: string,
    startsAt: string,
  ): Promise<{ event: OrganisationEvent; guestsCopied: number }> {
    const body = await this.post<{ event?: unknown; guestsCopied?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/duplicate`,
      { startsAt, copyGuests: true },
    );

    if (typeof body.guestsCopied !== 'number') {
      throw new Error(
        'The API answered a copied guest list without its count. Check the events controller in services/api.',
      );
    }

    return { event: this.organisationEvent(body), guestsCopied: body.guestsCopied };
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

  /** Everyone with a role on the event (sc-29912), read by everyone on it and by Owners and Admins, with its Owners' and Admins' names, each under their role. */
  async eventPeople(eventId: string): Promise<EventPeople> {
    const raw = await this.get<{
      people?: unknown;
      owners?: unknown;
      admins?: unknown;
      staffLinks?: unknown;
    }>(`/api/events/${encodeURIComponent(eventId)}/people`);
    const people = Array.isArray(raw.people) ? raw.people.map(asEventPerson) : null;
    const staffLinks = Array.isArray(raw.staffLinks) ? raw.staffLinks.map(asStaffLinkHolder) : [];
    const { owners, admins } = raw;
    const names = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every((name) => typeof name === 'string');

    if (
      people == null ||
      !people.every((person) => person != null) ||
      !names(owners) ||
      !names(admins) ||
      !staffLinks.every((holder) => holder != null)
    ) {
      throw new Error(
        'The API answered GET /api/events/{id}/people in a shape this client does not know. Check EventPeopleController in services/api.',
      );
    }

    return { people, owners, admins, staffLinks: staffLinks as StaffLinkHolder[] };
  }

  /** The event's door codes, newest first, for whoever may change its People (sc-72). */
  async doorCodes(eventId: string): Promise<DoorCodeCard[]> {
    const raw = await this.get<{ doorCodes?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/door-codes`,
    );
    const cards = Array.isArray(raw.doorCodes) ? raw.doorCodes.map(asDoorCodeCard) : null;

    if (cards == null || !cards.every((card) => card != null)) {
      throw new Error(DOOR_CODE_SHAPE);
    }

    return cards as DoorCodeCard[];
  }

  async makeDoorCode(eventId: string, code: NewDoorCode): Promise<DoorCodeCard> {
    return this.doorCodeCard(
      await this.post<{ doorCode?: unknown }>(
        `/api/events/${encodeURIComponent(eventId)}/door-codes`,
        code,
      ),
    );
  }

  async stopDoorCode(eventId: string, codeId: string): Promise<DoorCodeCard> {
    return this.doorCodeCard(
      await this.post<{ doorCode?: unknown }>(
        `/api/events/${encodeURIComponent(eventId)}/door-codes/${encodeURIComponent(codeId)}/stop`,
      ),
    );
  }

  /** Refused `door_code_invalid` alike for an unknown, full, expired or stopped code, and `too_many_attempts` after refused tries. */
  async openDoorCode(code: string): Promise<OpenedDoorCode> {
    const opened = asOpenedDoorCode(
      await this.get<unknown>(`/api/door-codes/${encodeURIComponent(code)}`),
    );

    if (opened == null) {
      throw new Error(
        'The API answered GET /api/door-codes/{code} in a shape this client does not know. Check RedeemController in services/api.',
      );
    }

    return opened;
  }

  /** Signed in only: signed out, a door code is redeemed by a code to a mobile (sc-4235), `sendDoorCodeSignIn` then `doorCodeSignIn`. */
  async redeemDoorCode(code: string): Promise<RedeemedDoorCode> {
    return this.redeemed(
      await this.post<unknown>(`/api/door-codes/${encodeURIComponent(code)}/redeem`, {}),
    );
  }

  /** Sends the code to the number typed; answers the same whether or not the number has an account. */
  async sendDoorCodeSignIn(
    code: string,
    name: string,
    countryCode: string,
    number: string,
  ): Promise<PhoneSignInSent> {
    return this.phoneSignInSent(
      await this.post<unknown>(
        `/api/door-codes/${encodeURIComponent(code)}/sign-in/send`,
        { name, countryCode, number },
        { anonymous: true },
      ),
    );
  }

  /** The right code signs in, saved as a sign-in's is, and takes the grant unless two-factor is asked first. */
  async doorCodeSignIn(code: string, handle: string, phoneCode: string): Promise<DoorCodeSignedIn> {
    const path = `/api/door-codes/${encodeURIComponent(code)}/sign-in`;
    const { outcome, body } = await this.signedInWithBody(
      path,
      { handle, code: phoneCode },
      'RedeemController',
    );

    return { outcome, redeemed: 'challenge' in outcome ? null : this.redeemed(body) };
  }

  private redeemed(raw: unknown): RedeemedDoorCode {
    const redeemed = asRedeemedDoorCode(raw);

    if (redeemed == null) {
      throw new Error(
        'The API answered a door code redemption in a shape this client does not know. Check RedeemController in services/api.',
      );
    }

    return redeemed;
  }

  private phoneSignInSent(raw: unknown): PhoneSignInSent {
    const sent = raw as Partial<PhoneSignInSent> | null;

    if (typeof sent?.handle !== 'string' || typeof sent.cooldownSeconds !== 'number') {
      throw new Error(
        'The API answered a sign-in code send in a shape this client does not know. Check PhoneSignIns in services/api.',
      );
    }

    return { handle: sent.handle, cooldownSeconds: sent.cooldownSeconds };
  }

  private doorCodeCard(raw: { doorCode?: unknown }): DoorCodeCard {
    const card = asDoorCodeCard(raw.doorCode);
    if (card == null) throw new Error(DOOR_CODE_SHAPE);

    return card;
  }

  /** The organisation's active members not yet on the event, by name alone, for whoever may change its People (sc-29915). */
  async addableEventMembers(eventId: string): Promise<AddableMember[]> {
    const raw = await this.get<{ members?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/people/addable`,
    );
    const members = Array.isArray(raw.members) ? raw.members.map(asAddableMember) : null;

    if (members == null || !members.every((member) => member != null)) {
      throw new Error(
        'The API answered GET /api/events/{id}/people/addable in a shape this client does not know. Check EventPeopleController in services/api.',
      );
    }

    return members;
  }

  async addEventPerson(
    eventId: string,
    membershipId: string,
    role: EventRole,
  ): Promise<EventPerson> {
    return eventPersonOf(
      await this.post<{ person?: unknown }>(`/api/events/${encodeURIComponent(eventId)}/people`, {
        membershipId,
        role,
      }),
    );
  }

  /** Applies on the person's next request; nobody is signed out. */
  async changeEventPerson(
    eventId: string,
    personId: string,
    role: EventRole,
  ): Promise<EventPerson> {
    return eventPersonOf(
      await this.patch<{ person?: unknown }>(
        `/api/events/${encodeURIComponent(eventId)}/people/${encodeURIComponent(personId)}`,
        { role },
      ),
    );
  }

  /** By email address or mobile number, at any role but Lead (sc-71); a member is refused `already_a_member`. */
  async addEventPersonFromOutside(
    eventId: string,
    address: string,
    role: EventRole,
    jobLabel: string | null,
  ): Promise<EventPerson> {
    return eventPersonOf(
      await this.post<{ person?: unknown }>(`/api/events/${encodeURIComponent(eventId)}/people`, {
        address,
        role,
        jobLabel,
      }),
    );
  }

  async removeEventPerson(eventId: string, personId: string): Promise<void> {
    await this.request<unknown>(
      `/api/events/${encodeURIComponent(eventId)}/people/${encodeURIComponent(personId)}`,
      { method: 'DELETE' },
    );
  }

  /** Earliest first, only the areas the reader's role reads (sc-3624); refused `not_found` as event is. */
  async eventTimeline(eventId: string): Promise<EventTimeline> {
    const timeline = asEventTimeline(
      await this.get<unknown>(`/api/events/${encodeURIComponent(eventId)}/timeline`),
    );

    if (timeline == null) {
      throw new Error(
        'The API answered an event timeline in a shape this client does not know. Check EventTimelineController in services/api.',
      );
    }

    return timeline;
  }

  /** The event as an edit form opens it, with the tag the save sends back. */
  /** `plan` is null with none yet; refused 403 without seating.read (sc-3998). */
  async seating(eventId: string): Promise<Seating> {
    return this.seatingOf(await this.get<{ seating?: unknown }>(this.seatingPath(eventId)));
  }

  /** Refused `validation_failed` on `widthCm`, `lengthCm` or `roomName`, and 409 `seating_plan_exists`. */
  async startSeatingPlan(eventId: string, room: SeatingRoom): Promise<Seating> {
    return this.seatingOf(await this.post<{ seating?: unknown }>(this.seatingPath(eventId), room));
  }

  /** Refused 412 with `changedBy` when a colleague changed the room since `version`. */
  async changeSeatingRoom(eventId: string, room: SeatingRoom, version: number): Promise<Seating> {
    return this.seatingOf(
      await this.patch<{ seating?: unknown }>(this.seatingPath(eventId), room, {
        headers: { 'If-Match': versionTag(version) },
      }),
    );
  }

  /** Share tables with guests or stop, and the day to share by, either or both (sc-4022). Refused `validation_failed` on `shareBy`, and 403 without seating.manage. */
  async changeTableSharing(
    eventId: string,
    changes: { shared?: boolean; shareBy?: string | null },
  ): Promise<Seating> {
    return this.seatingOf(
      await this.patch<{ seating?: unknown }>(`${this.seatingPath(eventId)}/sharing`, changes),
    );
  }

  async deleteSeatingPlan(eventId: string): Promise<Seating> {
    return this.seatingOf(await this.delete<{ seating?: unknown }>(this.seatingPath(eventId)));
  }

  /** With no colour, the least used. Refused `validation_failed` on `name`, and 409 `seating_section_limit`. */
  async addSeatingSection(
    eventId: string,
    section: { name: string; colour?: SectionColour },
  ): Promise<Seating> {
    return this.seatingOf(
      await this.post<{ seating?: unknown }>(`${this.seatingPath(eventId)}/sections`, section),
    );
  }

  /** Refused 412 with `changedBy` when a colleague changed it since `version`. */
  async changeSeatingSection(
    eventId: string,
    sectionId: string,
    changes: { name?: string; colour?: SectionColour },
    version: number,
  ): Promise<Seating> {
    return this.seatingOf(
      await this.patch<{ seating?: unknown }>(
        `${this.seatingPath(eventId)}/sections/${encodeURIComponent(sectionId)}`,
        changes,
        { headers: { 'If-Match': versionTag(version) } },
      ),
    );
  }

  async deleteSeatingSection(eventId: string, sectionId: string): Promise<Seating> {
    return this.seatingOf(
      await this.delete<{ seating?: unknown }>(
        `${this.seatingPath(eventId)}/sections/${encodeURIComponent(sectionId)}`,
      ),
    );
  }

  /** Moves, turns and resizes, saved all or nothing; 412 with `stale` naming each item a colleague changed since its `version`, and `validation_failed` beside `items[n]` for one left outside the room. */
  async arrangeSeating(eventId: string, items: SeatingArrangement[]): Promise<Seating> {
    return this.seatingOf(
      await this.patch<{ seating?: unknown }>(`${this.seatingPath(eventId)}/furniture`, { items }),
    );
  }

  /** Renames tables in one step, all or nothing (sc-4717's Renumber); `validation_failed` beside `items[n].name` for a name a table outside the step keeps, 412 with `stale` as for a move. */
  async renameSeatingTables(
    eventId: string,
    items: { id: string; version: number; name: string }[],
  ): Promise<Seating> {
    return this.seatingOf(
      await this.patch<{ seating?: unknown }>(`${this.seatingPath(eventId)}/furniture/names`, {
        items,
      }),
    );
  }

  /** Sets each item's section in one step, all or nothing (sc-4717). */
  async sectionSeatingItems(
    eventId: string,
    items: (SeatingItemRef & { sectionId: string | null })[],
  ): Promise<Seating> {
    return this.seatingOf(
      await this.patch<{ seating?: unknown }>(`${this.seatingPath(eventId)}/furniture/sections`, {
        items,
      }),
    );
  }

  /** Copies 50 cm down and to the right, with nobody seated, all or nothing; `chosen` is the copies in reading order (sc-4717). */
  async duplicateSeatingItems(
    eventId: string,
    items: SeatingItemRef[],
  ): Promise<SeatingWithChosen> {
    return this.seatingWithChosen(
      await this.post<{ seating?: unknown; chosen?: unknown }>(
        `${this.seatingPath(eventId)}/furniture/duplicate`,
        { items },
      ),
    );
  }

  /** Deletes in one step, all or nothing, freeing whoever sits in them: `moves` are theirs, to Without a seat (sc-4717, sc-57680). `emptyOnly` is refused 409 while anybody sits in one. */
  async deleteSeatingItems(
    eventId: string,
    items: SeatingItemRef[],
    emptyOnly = false,
  ): Promise<SeatingMoved> {
    return this.movedOf(
      await this.post(`${this.seatingPath(eventId)}/furniture/delete`, {
        items,
        ...(emptyOnly ? { emptyOnly } : {}),
      }),
    );
  }

  /** Puts deleted items back, all or nothing: Undo after a Delete (sc-4717). `chosen` is their new ids in the order sent. */
  async restoreSeatingItems(
    eventId: string,
    items: SeatingRestoredItem[],
  ): Promise<SeatingWithChosen> {
    return this.seatingWithChosen(
      await this.post<{ seating?: unknown; chosen?: unknown }>(
        `${this.seatingPath(eventId)}/furniture/restore`,
        { items },
      ),
    );
  }

  /** Of the shape's default size and seats, named "Table {n}"; `tableId` is the one added. Refused 422 on a shape outside the four. */
  async addSeatingTable(eventId: string, shape: TableShape): Promise<SeatingWithTable> {
    return this.seatingWithTable(
      await this.post<{ seating?: unknown; tableId?: unknown }>(this.tablesPath(eventId), {
        shape,
      }),
    );
  }

  /** Refused `validation_failed` beside each field, and 412 with `changedBy` when a colleague changed it since `version`. */
  async changeSeatingTable(
    eventId: string,
    tableId: string,
    changes: SeatingTableChanges,
    version: number,
  ): Promise<SeatingWithTable> {
    return this.seatingWithTable(
      await this.patch<{ seating?: unknown; tableId?: unknown }>(
        `${this.tablesPath(eventId)}/${encodeURIComponent(tableId)}`,
        changes,
        { headers: { 'If-Match': versionTag(version) } },
      ),
    );
  }

  /** The copy, with nobody seated, as `tableId`. */
  async duplicateSeatingTable(
    eventId: string,
    tableId: string,
    version: number,
  ): Promise<SeatingWithTable> {
    return this.seatingWithTable(
      await this.post<{ seating?: unknown; tableId?: unknown }>(
        `${this.tablesPath(eventId)}/${encodeURIComponent(tableId)}/duplicate`,
        undefined,
        { headers: { 'If-Match': versionTag(version) } },
      ),
    );
  }

  async deleteSeatingTable(eventId: string, tableId: string, version: number): Promise<Seating> {
    return this.seatingOf(
      await this.delete<{ seating?: unknown }>(
        `${this.tablesPath(eventId)}/${encodeURIComponent(tableId)}`,
        { headers: { 'If-Match': versionTag(version) } },
      ),
    );
  }

  /** Ten seats labelled with the next free letter; `rowId` is the one added. */
  async addSeatingRow(eventId: string): Promise<SeatingWithRow> {
    const body = await this.post<{ seating?: unknown; rowId?: unknown }>(this.rowsPath(eventId));

    return {
      seating: this.seatingOf(body),
      rowId: typeof body?.rowId === 'string' ? body.rowId : '',
    };
  }

  /** Refused `validation_failed` beside each field, and 412 with `changedBy` when a colleague changed it since `version`. */
  async changeSeatingRow(
    eventId: string,
    rowId: string,
    changes: SeatingRowChanges,
    version: number,
  ): Promise<SeatingWithRow> {
    const body = await this.patch<{ seating?: unknown; rowId?: unknown }>(
      `${this.rowsPath(eventId)}/${encodeURIComponent(rowId)}`,
      changes,
      { headers: { 'If-Match': versionTag(version) } },
    );

    return {
      seating: this.seatingOf(body),
      rowId: typeof body?.rowId === 'string' ? body.rowId : '',
    };
  }

  /** The copy, with the next free label and nobody seated, as `rowId`. */
  async duplicateSeatingRow(
    eventId: string,
    rowId: string,
    version: number,
  ): Promise<SeatingWithRow> {
    const body = await this.post<{ seating?: unknown; rowId?: unknown }>(
      `${this.rowsPath(eventId)}/${encodeURIComponent(rowId)}/duplicate`,
      undefined,
      { headers: { 'If-Match': versionTag(version) } },
    );

    return {
      seating: this.seatingOf(body),
      rowId: typeof body?.rowId === 'string' ? body.rowId : '',
    };
  }

  async deleteSeatingRow(eventId: string, rowId: string, version: number): Promise<Seating> {
    return this.seatingOf(
      await this.delete<{ seating?: unknown }>(
        `${this.rowsPath(eventId)}/${encodeURIComponent(rowId)}`,
        { headers: { 'If-Match': versionTag(version) } },
      ),
    );
  }

  /** Named "Seat {n}" in the caller's language; `seatId` is the one added. */
  async addSingleSeat(eventId: string): Promise<SeatingWithSeat> {
    const body = await this.post<{ seating?: unknown; seatId?: unknown }>(
      this.singleSeatsPath(eventId),
    );

    return {
      seating: this.seatingOf(body),
      seatId: typeof body?.seatId === 'string' ? body.seatId : '',
    };
  }

  /** Refused `validation_failed` on `name`, and 412 with `changedBy` when a colleague changed it since `version`. */
  async changeSingleSeat(
    eventId: string,
    seatId: string,
    changes: SingleSeatChanges,
    version: number,
  ): Promise<SeatingWithSeat> {
    const body = await this.patch<{ seating?: unknown; seatId?: unknown }>(
      `${this.singleSeatsPath(eventId)}/${encodeURIComponent(seatId)}`,
      changes,
      { headers: { 'If-Match': versionTag(version) } },
    );

    return {
      seating: this.seatingOf(body),
      seatId: typeof body?.seatId === 'string' ? body.seatId : '',
    };
  }

  async deleteSingleSeat(eventId: string, seatId: string, version: number): Promise<Seating> {
    return this.seatingOf(
      await this.delete<{ seating?: unknown }>(
        `${this.singleSeatsPath(eventId)}/${encodeURIComponent(seatId)}`,
        { headers: { 'If-Match': versionTag(version) } },
      ),
    );
  }

  /** Tells everyone with the plan open what you have chosen, or `null` for nothing; refused 403 to a viewer, whose choice is not shared (sc-4719). */
  async chooseOnPlan(
    eventId: string,
    chosen: { kind: 'table' | 'row' | 'seat'; id: string; chair?: number | null } | null,
  ): Promise<void> {
    await this.put<undefined>(`${this.seatingPath(eventId)}/chosen`, { chosen });
  }

  /** Tells everyone with the plan open that you still have it open, editor or viewer (sc-4719). */
  async sayHereOnPlan(eventId: string): Promise<void> {
    await this.post<undefined>(`${this.seatingPath(eventId)}/here`);
  }

  /** A hub token for this event's seating, its editors' choices and who else has it open (sc-4719). */
  async seatingSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.seatingPath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** The event's roster in roster order; refused 403 without staff.read (sc-3906). */
  async staff(eventId: string): Promise<StaffEntry[]> {
    return this.staffRosterOf(await this.get<unknown>(this.staffPath(eventId)));
  }

  /** Refused `validation_failed` on each field, and 409 `staff_number_shared` naming `sharedWith` until `allowShared`. */
  async addStaff(eventId: string, details: StaffDetails): Promise<StaffAnswer> {
    return this.staffAnswerOf(await this.post<unknown>(this.staffPath(eventId), details));
  }

  /** As `addStaff`, asking only when the number changed; `mobile` and `email` are ignored once erased. */
  async editStaff(eventId: string, staffId: string, details: StaffDetails): Promise<StaffAnswer> {
    return this.staffAnswerOf(
      await this.put<unknown>(`${this.staffPath(eventId)}/${encodeURIComponent(staffId)}`, details),
    );
  }

  /** Refused 409 `event_concluded` once the event has finished. */
  async removeStaff(eventId: string, staffId: string): Promise<void> {
    await this.delete<unknown>(`${this.staffPath(eventId)}/${encodeURIComponent(staffId)}`);
  }

  /** Issues a new link for the person (sc-3912), answered once and never kept; refused 409 `conflict` without a mobile number. */
  async deliverStaffLink(
    eventId: string,
    staffId: string,
  ): Promise<{ url: string; staff: StaffEntry }> {
    const body = await this.post<{ url?: unknown; staff?: unknown }>(
      `${this.staffPath(eventId)}/${encodeURIComponent(staffId)}/link`,
    );
    const { staff } = this.staffAnswerOf(body);

    return { url: typeof body.url === 'string' ? body.url : '', staff };
  }

  /** Only a Copied row moves; Link sent and Link opened stay. */
  async markStaffLinkSent(eventId: string, staffId: string): Promise<StaffEntry> {
    return this.staffAnswerOf(
      await this.post<unknown>(
        `${this.staffPath(eventId)}/${encodeURIComponent(staffId)}/link/sent`,
      ),
    ).staff;
  }

  /** Ends every link the person was given; the row reads No link yet. */
  async replaceStaffLink(eventId: string, staffId: string): Promise<StaffEntry> {
    return this.staffAnswerOf(
      await this.post<unknown>(
        `${this.staffPath(eventId)}/${encodeURIComponent(staffId)}/link/replace`,
      ),
    ).staff;
  }

  /** A new link for the person from the briefing (sc-3917): as deliverStaffLink, and recorded as the briefing's copy, which leaves the briefing where it was. */
  async copyBriefingLink(
    eventId: string,
    staffId: string,
  ): Promise<{ url: string; staff: StaffEntry }> {
    const body = await this.post<{ url?: unknown; staff?: unknown }>(
      `${this.staffPath(eventId)}/${encodeURIComponent(staffId)}/briefing/link`,
    );
    const { staff } = this.staffAnswerOf(body);

    return { url: typeof body.url === 'string' ? body.url : '', staff };
  }

  /** After a briefing copy: Sent, not read, and Link sent; refused 409 `conflict` before one. */
  async markBriefingSent(eventId: string, staffId: string): Promise<StaffEntry> {
    return this.staffAnswerOf(
      await this.post<unknown>(
        `${this.staffPath(eventId)}/${encodeURIComponent(staffId)}/briefing/sent`,
      ),
    ).staff;
  }

  /** Blank clears them; refused `validation_failed` on `rules` past STAFF_RULES_MAXIMUM code points. */
  async saveHouseRules(eventId: string, rules: string): Promise<string | null> {
    const body = await this.put<{ rules?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/briefing/rules`,
      { rules },
    );

    return typeof body.rules === 'string' ? body.rules : null;
  }

  /** The person's shift page as they would see it (sc-3917), recording nothing; staff.read. */
  async previewStaffNight(eventId: string, staffId: string): Promise<MyNight> {
    return this.myNightOf(
      await this.get<unknown>(`${this.staffPath(eventId)}/${encodeURIComponent(staffId)}/preview`),
    );
  }

  /** The roster with the event's jobs and shifts (sc-3908); refused 403 without staff.read. */
  async staffPlan(eventId: string): Promise<StaffPlan> {
    return this.staffPlanOf(await this.get<unknown>(this.staffPath(eventId)));
  }

  /** Refused `validation_failed` on `name`. */
  async addStaffJob(
    eventId: string,
    job: { name: string; access: StaffAccess },
  ): Promise<StaffPlan> {
    return this.staffPlanOf(await this.post<unknown>(`${this.staffPath(eventId)}/jobs`, job));
  }

  async editStaffJob(
    eventId: string,
    jobId: string,
    job: { name: string; access: StaffAccess },
  ): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(`${this.staffPath(eventId)}/jobs/${encodeURIComponent(jobId)}`, job),
    );
  }

  /** Refused 409 `staff_job_worked` once anyone has clocked in on one of its shifts, else `staff_job_staffed` while anyone is on them. */
  async removeStaffJob(eventId: string, jobId: string): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.delete<unknown>(`${this.staffPath(eventId)}/jobs/${encodeURIComponent(jobId)}`),
    );
  }

  /** Refused `validation_failed` on each field at once. */
  async addStaffShift(
    eventId: string,
    shift: ShiftDetails & { job: string | null },
  ): Promise<StaffPlan> {
    return this.staffPlanOf(await this.post<unknown>(`${this.staffPath(eventId)}/shifts`, shift));
  }

  /** Refused `validation_failed` naming `onShift` when People needed is below the people on it, and 409 `staff_shift_overlap`. */
  async editStaffShift(eventId: string, shiftId: string, shift: ShiftDetails): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(
        `${this.staffPath(eventId)}/shifts/${encodeURIComponent(shiftId)}`,
        shift,
      ),
    );
  }

  /** Refused 409 `staff_shift_full`, `staff_works_as`, then `staff_shift_overlap`. */
  async assignStaff(eventId: string, shiftId: string, staffId: string): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(
        `${this.staffPath(eventId)}/shifts/${encodeURIComponent(shiftId)}/people/${encodeURIComponent(staffId)}`,
      ),
    );
  }

  /** Refused 409 `staff_shift_worked` once they have clocked in on it. */
  async unassignStaff(eventId: string, shiftId: string, staffId: string): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.delete<unknown>(
        `${this.staffPath(eventId)}/shifts/${encodeURIComponent(shiftId)}/people/${encodeURIComponent(staffId)}`,
      ),
    );
  }

  /** Refused `validation_failed` on `name`: blank, too long, or another station's (sc-3910). */
  async addStationPlace(eventId: string, name: string): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.post<unknown>(`${this.stationsPath(eventId)}/places`, { name }),
    );
  }

  /** As `addStationPlace`; refused on the Pass. */
  async renameStationPlace(eventId: string, placeId: string, name: string): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(
        `${this.stationsPath(eventId)}/places/${encodeURIComponent(placeId)}`,
        { name },
      ),
    );
  }

  /** Its people lose their station and its items go to the Pass; refused on the Pass. */
  async removeStationPlace(eventId: string, placeId: string): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.delete<unknown>(
        `${this.stationsPath(eventId)}/places/${encodeURIComponent(placeId)}`,
      ),
    );
  }

  /** A place or section id, or `null` to take them off their station. */
  async putOnStation(eventId: string, staffId: string, station: string | null): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(
        `${this.stationsPath(eventId)}/people/${encodeURIComponent(staffId)}`,
        { station },
      ),
    );
  }

  /** Refused `validation_failed` unless the lead is on the station. */
  async setStationLead(
    eventId: string,
    stationId: string,
    lead: string | null,
  ): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(
        `${this.stationsPath(eventId)}/${encodeURIComponent(stationId)}/lead`,
        {
          lead,
        },
      ),
    );
  }

  async setFloorLead(eventId: string, lead: string | null): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(`${this.stationsPath(eventId)}/floor-lead`, { lead }),
    );
  }

  /** Refused `validation_failed` when `place` is not a place or `item` is not on the course. */
  async setDishedAt(
    eventId: string,
    courseId: string,
    item: string,
    place: string,
  ): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(
        `${this.stationsPath(eventId)}/courses/${encodeURIComponent(courseId)}/dished-at`,
        { item, place },
      ),
    );
  }

  /** Refused `validation_failed` unless `order` is exactly the current walk, reordered. */
  async setWalkingOrder(eventId: string, order: string[]): Promise<StaffPlan> {
    return this.staffPlanOf(
      await this.put<unknown>(`${this.stationsPath(eventId)}/walking-order`, { order }),
    );
  }

  async staffSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.staffPath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  private staffRosterOf(body: unknown): StaffEntry[] {
    return (
      asStaffRoster(body) ??
      (() => {
        throw new Error(
          'The API answered the roster in a shape this client does not know. Check StaffSerialiser in services/api.',
        );
      })()
    );
  }

  private staffPlanOf(body: unknown): StaffPlan {
    return (
      asStaffPlan(body) ??
      (() => {
        throw new Error(
          'The API answered the staff plan in a shape this client does not know. Check StaffSerialiser in services/api.',
        );
      })()
    );
  }

  private staffAnswerOf(body: unknown): StaffAnswer {
    const record =
      typeof body === 'object' && body != null ? (body as Record<string, unknown>) : {};
    const staff = asStaffEntry(record.staff);

    if (staff == null) {
      throw new Error(
        'The API answered a roster entry in a shape this client does not know. Check StaffSerialiser in services/api.',
      );
    }

    return { staff, member: typeof record.member === 'string' ? record.member : null };
  }

  /** The organisation's menu library, archived dishes included; refused 403 without menu.read (sc-3901). */
  async dishes(organisationId: string): Promise<DishLibrary> {
    const library = asDishLibrary(await this.get<unknown>(this.dishesPath(organisationId)));

    if (library == null) throw new Error(DISH_SHAPE);

    return library;
  }

  /** Refused `validation_failed` beside each field, and 409 `dish_name_shared` naming `sharedWith` and whether it is `archived`, until `allowShared`. */
  async addDish(organisationId: string, details: DishDetails): Promise<Dish> {
    return this.dishOf(await this.post<unknown>(this.dishesPath(organisationId), details));
  }

  /** As `addDish`, asking only when the name changed; without `lastPrice` the price stays as it was. */
  async editDish(organisationId: string, dishId: string, details: DishDetails): Promise<Dish> {
    return this.dishOf(await this.put<unknown>(this.dishPath(organisationId, dishId), details));
  }

  async archiveDish(organisationId: string, dishId: string): Promise<Dish> {
    return this.dishOf(
      await this.post<unknown>(`${this.dishPath(organisationId, dishId)}/archive`),
    );
  }

  async restoreDish(organisationId: string, dishId: string): Promise<Dish> {
    return this.dishOf(
      await this.post<unknown>(`${this.dishPath(organisationId, dishId)}/restore`),
    );
  }

  /** Refused 409 `dish_in_use` once an event has used it. */
  async deleteDish(organisationId: string, dishId: string): Promise<void> {
    await this.delete<unknown>(this.dishPath(organisationId, dishId));
  }

  /** Two at once on a dish without variants, then one at a time; refused `validation_failed` under `variants.{n}.`, and 409 `variant_limit` past six (sc-3903). */
  async addDishVariants(
    organisationId: string,
    dishId: string,
    variants: VariantDetails[],
  ): Promise<Dish> {
    return this.dishOf(
      await this.post<unknown>(`${this.dishPath(organisationId, dishId)}/variants`, { variants }),
    );
  }

  /** Without `lastPrice` the price stays as it was. */
  async editDishVariant(
    organisationId: string,
    dishId: string,
    variantId: string,
    details: VariantDetails,
  ): Promise<Dish> {
    return this.dishOf(
      await this.put<unknown>(this.dishVariantPath(organisationId, dishId, variantId), details),
    );
  }

  /** From two, the one left folds into the dish; refused 409 `variant_last_everyone` for the only one for Everyone. */
  async removeDishVariant(
    organisationId: string,
    dishId: string,
    variantId: string,
  ): Promise<Dish> {
    return this.dishOf(
      await this.delete<unknown>(this.dishVariantPath(organisationId, dishId, variantId)),
    );
  }

  private dishVariantPath(organisationId: string, dishId: string, variantId: string): string {
    return `${this.dishPath(organisationId, dishId)}/variants/${encodeURIComponent(variantId)}`;
  }

  private dishOf(body: unknown): Dish {
    const dish = asDish(
      typeof body === 'object' && body != null ? (body as { dish?: unknown }).dish : null,
    );

    if (dish == null) throw new Error(DISH_SHAPE);

    return dish;
  }

  private dishesPath(organisationId: string): string {
    return `/api/orgs/${encodeURIComponent(organisationId)}/dishes`;
  }

  private dishPath(organisationId: string, dishId: string): string {
    return `${this.dishesPath(organisationId)}/${encodeURIComponent(dishId)}`;
  }

  /** The event's menu, its courses in order; refused 403 without menu.read (sc-3902). */
  async menu(eventId: string): Promise<EventMenu> {
    return this.menuOf(await this.get<unknown>(this.menuPath(eventId))).menu;
  }

  /** Goes last. Refused `validation_failed` beside each field, and 409 `menu_course_limit` at 10 courses. */
  async addMenuCourse(eventId: string, details: MenuCourseDetails): Promise<MenuChange> {
    return this.menuOf(await this.post<unknown>(`${this.menuPath(eventId)}/courses`, details));
  }

  /** The whole course; `same` is refused 409 `menu_same_one_dish` unless it has exactly one dish. `default` left out keeps the default and its date (sc-1362); a new one after the date is refused 409 `menu_default_move` with `move` and `back` while it moves anyone, until sent with `confirmMove`. */
  async changeMenuCourse(
    eventId: string,
    courseId: string,
    details: MenuCourseDetails & {
      answer: MenuAnswer;
      skippable: boolean;
      ownItems?: string[];
      default?: SentCourseDefault;
      confirmMove?: boolean;
    },
  ): Promise<MenuChange> {
    return this.menuOf(await this.put<unknown>(this.menuCoursePath(eventId, courseId), details));
  }

  async moveMenuCourse(eventId: string, courseId: string, to: number): Promise<MenuChange> {
    return this.menuOf(
      await this.post<unknown>(`${this.menuCoursePath(eventId, courseId)}/move`, { to }),
    );
  }

  /** Refused 409 `menu_course_picked` once a guest has picked from it. */
  async deleteMenuCourse(eventId: string, courseId: string): Promise<MenuChange> {
    return this.menuOf(await this.delete<unknown>(this.menuCoursePath(eventId, courseId)));
  }

  /** A library dish copied as it is now, refused 409 `menu_dish_on_course` when the course holds a copy of it, or a new dish: saved to the library too, and refused as `addDish` is, unless `onlyForEvent`. */
  async addMenuDish(
    eventId: string,
    courseId: string,
    dish: { libraryDishId: string } | (DishDetails & { onlyForEvent: boolean }),
    askAgain = false,
  ): Promise<MenuChange> {
    return this.menuOf(
      await this.post<unknown>(
        asking(`${this.menuCoursePath(eventId, courseId)}/dishes`, askAgain),
        dish,
      ),
    );
  }

  /** The event's copy only. Without `askAgain`, a change that asks guests to pick again (sc-3913) is refused 409 `menu_change_asks`, as every change below is. */
  async changeMenuDish(
    eventId: string,
    dishId: string,
    details: Omit<DishDetails, 'lastPrice' | 'allowShared'> & { items?: MenuItem[] },
    askAgain = false,
  ): Promise<MenuChange> {
    return this.menuOf(
      await this.put<unknown>(asking(this.menuDishPath(eventId, dishId), askAgain), details),
    );
  }

  async removeMenuDish(eventId: string, dishId: string, askAgain = false): Promise<MenuChange> {
    return this.menuOf(
      await this.delete<unknown>(asking(this.menuDishPath(eventId, dishId), askAgain)),
    );
  }

  /** Two at once on a dish without variants, then one at a time; refused as `addDishVariants` (sc-3903). */
  async addMenuVariants(
    eventId: string,
    dishId: string,
    variants: VariantDetails[],
    askAgain = false,
  ): Promise<MenuChange> {
    return this.menuOf(
      await this.post<unknown>(asking(`${this.menuDishPath(eventId, dishId)}/variants`, askAgain), {
        variants,
      }),
    );
  }

  /** Without `cost` the cost stays as it was. */
  async changeMenuVariant(
    eventId: string,
    variantId: string,
    details: VariantDetails,
    askAgain = false,
  ): Promise<MenuChange> {
    return this.menuOf(
      await this.put<unknown>(asking(this.menuVariantPath(eventId, variantId), askAgain), details),
    );
  }

  /** From two, the one left folds into the dish; refused 409 `variant_last_everyone`. */
  async removeMenuVariant(
    eventId: string,
    variantId: string,
    askAgain = false,
  ): Promise<MenuChange> {
    return this.menuOf(
      await this.delete<unknown>(asking(this.menuVariantPath(eventId, variantId), askAgain)),
    );
  }

  private menuVariantPath(eventId: string, variantId: string): string {
    return `${this.menuPath(eventId)}/variants/${encodeURIComponent(variantId)}`;
  }

  /** A question inside the dish (sc-3904), saved as a draft while unfinished; refused 409 `choice_limit` at 3. */
  async addMenuChoice(
    eventId: string,
    dishId: string,
    details: ChoiceDetails,
    askAgain = false,
  ): Promise<MenuChange> {
    return this.menuOf(
      await this.post<unknown>(
        asking(`${this.menuDishPath(eventId, dishId)}/choices`, askAgain),
        details,
      ),
    );
  }

  /** An answered choice is refused under `draft`. */
  async changeMenuChoice(
    eventId: string,
    choiceId: string,
    details: ChoiceDetails,
    askAgain = false,
  ): Promise<MenuChange> {
    return this.menuOf(
      await this.put<unknown>(asking(this.menuChoicePath(eventId, choiceId), askAgain), details),
    );
  }

  async removeMenuChoice(eventId: string, choiceId: string, askAgain = false): Promise<MenuChange> {
    return this.menuOf(
      await this.delete<unknown>(asking(this.menuChoicePath(eventId, choiceId), askAgain)),
    );
  }

  /** The people a menu change asked again who have not answered yet, for Messaging to tell (sc-3913); refused 403 without guests.read. */
  async menuAskedAgain(eventId: string): Promise<MenuAskedAgain[]> {
    const body = await this.get<{ people?: unknown }>(`${this.menuPath(eventId)}/asked-again`);

    return asMenuAskedAgain(body?.people);
  }

  private menuChoicePath(eventId: string, choiceId: string): string {
    return `${this.menuPath(eventId)}/choices/${encodeURIComponent(choiceId)}`;
  }

  /** See picks (sc-3909): refused 403 without menu.read; without guests.read the names, `waiting` and `people` are null. */
  async menuPicks(eventId: string): Promise<EventPicks> {
    return this.picksOf(await this.get<unknown>(`${this.menuPath(eventId)}/picks`));
  }

  /** An event's messages to its guests, newest first (sc-3942): refused 403 without messages.read. */
  async guestMessages(eventId: string): Promise<GuestMessageRow[]> {
    const body = await this.get<{ messages?: GuestMessageRow[] }>(this.messagesPath(eventId));

    return body.messages ?? [];
  }

  /** One message and each delivery's state; the addresses only with guests.manage. */
  async guestMessage(eventId: string, messageId: string): Promise<GuestMessageDetails> {
    const body = await this.get<{ message: GuestMessageDetails }>(
      `${this.messagesPath(eventId)}/${encodeURIComponent(messageId)}`,
    );

    return body.message;
  }

  /** Choose guests (sc-3942): every guest a message can go to, A to Z, each flagged with why email can't tell them. */
  async guestMessageGuests(eventId: string): Promise<PickableGuest[]> {
    const body = await this.get<{ guests?: PickableGuest[] }>(
      `${this.messagesPath(eventId)}/guests`,
    );

    return body.guests ?? [];
  }

  /** As one guest will see it (sc-3960); 404 for a companion or a guest of another event. */
  guestMessagePreview(eventId: string, guestId: string): Promise<GuestMessagePreview> {
    return this.get<GuestMessagePreview>(
      `${this.messagesPath(eventId)}/preview/${encodeURIComponent(guestId)}`,
    );
  }

  /** The check before Send, worked out by the same rule as Send, a follow-up's from whom its first message went: refused 422 on `guestIds` for nobody chosen, 409 on an event that can't send. */
  guestMessageCheck(
    eventId: string,
    input: Pick<GuestMessageInput, 'audience' | 'guestIds' | 'follows'>,
  ): Promise<GuestMessageCheck> {
    return this.post<GuestMessageCheck>(`${this.messagesPath(eventId)}/check`, input);
  }

  /** Who gets it's count and See who (sc-3957): refused 422 naming an unknown condition, or with none; 403 without messages.manage. */
  audienceMatch(eventId: string, conditions: GuestCondition[]): Promise<AudienceMatch> {
    return this.post<AudienceMatch>(`${this.messagesPath(eventId)}/audience`, { conditions });
  }

  audienceBook(eventId: string): Promise<AudienceBook> {
    return this.get<AudienceBook>(`${this.messagesPath(eventId)}/audiences`);
  }

  /** 422 on a blank or too long name, 409 on a used one or a 21st. */
  async saveAudience(
    eventId: string,
    name: string,
    conditions: GuestCondition[],
  ): Promise<SavedAudience> {
    const body = await this.post<{ audience: SavedAudience }>(
      `${this.messagesPath(eventId)}/audiences`,
      {
        name,
        conditions,
      },
    );

    return body.audience;
  }

  async renameAudience(eventId: string, audienceId: string, name: string): Promise<SavedAudience> {
    const body = await this.patch<{ audience: SavedAudience }>(
      `${this.messagesPath(eventId)}/audiences/${encodeURIComponent(audienceId)}`,
      { name },
    );

    return body.audience;
  }

  async deleteAudience(eventId: string, audienceId: string): Promise<void> {
    await this.delete<unknown>(
      `${this.messagesPath(eventId)}/audiences/${encodeURIComponent(audienceId)}`,
    );
  }

  /** 202 even when no email can announce it: the message is on their pages all the same. */
  sendGuestMessage(eventId: string, input: GuestMessageInput): Promise<GuestMessageSent> {
    return this.post<GuestMessageSent>(this.messagesPath(eventId), input);
  }

  async guestMessagesSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.messagesPath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  private messagesPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/messages`;
  }

  /** The kitchen sheet as of now (sc-3911): refused 403 without menu.read; without guests.manage `allergic` is null. */
  async kitchenSheet(eventId: string): Promise<KitchenSheet> {
    const body = await this.get<{ sheet?: unknown; finalNumbers?: unknown }>(
      `${this.menuPath(eventId)}/kitchen-sheet`,
    );
    const sheet = asKitchenSheet(body?.sheet, body?.finalNumbers);

    if (sheet == null)
      throw new Error(
        'The API answered the kitchen sheet in a shape this client does not know. Check KitchenSheet in services/api.',
      );

    return sheet;
  }

  /** The sheet as a tagged PDF, made when asked, in the request's language; 503 when it cannot be made. */
  async kitchenSheetPdf(
    eventId: string,
  ): Promise<{ name: string | null; bytes: Uint8Array<ArrayBuffer> }> {
    return this.pdfAt(`${this.menuPath(eventId)}/kitchen-sheet/pdf`);
  }

  /** Final numbers due (sc-30812), a day or null: refused 403 without menu.manage, 422 on `due`. */
  async setFinalNumbersDue(eventId: string, due: string | null): Promise<FinalNumbers> {
    const body = await this.put<{ finalNumbers?: unknown }>(
      `${this.menuPath(eventId)}/final-numbers`,
      { due },
    );

    return asFinalNumbers(body?.finalNumbers);
  }

  /** Give final numbers…: the PDF as `kitchenSheetPdf` makes it, recorded as given; 503 records nothing. Refused 403 without menu.manage. */
  async giveFinalNumbers(
    eventId: string,
  ): Promise<{ name: string | null; bytes: Uint8Array<ArrayBuffer> }> {
    return this.pdfAt(`${this.menuPath(eventId)}/kitchen-sheet/copies`);
  }

  /** Download this copy: as given, in the request's language. */
  async kitchenCopyPdf(
    eventId: string,
    copyId: string,
  ): Promise<{ name: string | null; bytes: Uint8Array<ArrayBuffer> }> {
    return this.pdfAt(
      `${this.menuPath(eventId)}/kitchen-sheet/copies/${encodeURIComponent(copyId)}/pdf`,
    );
  }

  private async pdfAt(
    path: string,
  ): Promise<{ name: string | null; bytes: Uint8Array<ArrayBuffer> }> {
    const response = await this.answered(path, { method: 'POST' });

    return {
      name: downloadName(response.headers.get('Content-Disposition')),
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }

  /** Refused 403 without guests.manage, and 409 `meal_pick_ruled_out` with `people` until sent with `anyway`. */
  async chooseForGuest(
    eventId: string,
    guestId: string,
    courseId: string,
    pick: HostPick,
  ): Promise<EventPicks> {
    return this.picksOf(
      await this.put<unknown>(
        `${this.menuPath(eventId)}/picks/people/${encodeURIComponent(guestId)}/courses/${encodeURIComponent(courseId)}`,
        pick,
      ),
    );
  }

  /** Gives a Children only variant to exactly `people` on its course; refused as `chooseForGuest`. */
  async giveVariant(
    eventId: string,
    variantId: string,
    people: readonly string[],
    anyway = false,
  ): Promise<EventPicks> {
    return this.picksOf(
      await this.put<unknown>(
        `${this.menuPath(eventId)}/picks/variants/${encodeURIComponent(variantId)}`,
        { people, anyway },
      ),
    );
  }

  private picksOf(body: unknown): EventPicks {
    const picks = asEventPicks((body as Record<string, unknown> | null)?.picks);

    if (picks == null)
      throw new Error(
        'The API answered the picks in a shape this client does not know. Check PicksFigures in services/api.',
      );

    return picks;
  }

  /** A hub token for this event's menu topic alone. */
  async menuSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.menuPath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  private menuOf(body: unknown): MenuChange {
    const record =
      typeof body === 'object' && body != null ? (body as Record<string, unknown>) : {};
    const menu = asEventMenu(record.menu);

    if (menu == null)
      throw new Error(
        'The API answered the menu in a shape this client does not know. Check MenuSerialiser in services/api.',
      );

    return {
      menu,
      courseId: typeof record.courseId === 'string' ? record.courseId : null,
      dishId: typeof record.dishId === 'string' ? record.dishId : null,
      choiceId: typeof record.choiceId === 'string' ? record.choiceId : null,
    };
  }

  private menuPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/menu`;
  }

  private menuCoursePath(eventId: string, courseId: string): string {
    return `${this.menuPath(eventId)}/courses/${encodeURIComponent(courseId)}`;
  }

  private menuDishPath(eventId: string, dishId: string): string {
    return `${this.menuPath(eventId)}/dishes/${encodeURIComponent(dishId)}`;
  }

  /** The event's running order, sorted by start; refused 403 without run_of_show.read (sc-3893). */
  async schedule(eventId: string): Promise<Schedule> {
    return this.scheduleOf(await this.get<unknown>(this.schedulePath(eventId)));
  }

  /** Refused `validation_failed` beside each field, and 409 `schedule_item_limit` once the event holds its most. */
  async addScheduleItem(eventId: string, details: ScheduleItemDetails): Promise<ScheduleWithItem> {
    return this.scheduleWithItem(
      await this.post<unknown>(`${this.schedulePath(eventId)}/items`, details),
    );
  }

  /** The whole item. Refused as `addScheduleItem`, and 412 with `current` and `changedBy` when a colleague changed it since `version`. */
  async changeScheduleItem(
    eventId: string,
    itemId: string,
    details: ScheduleItemDetails,
    version: number,
  ): Promise<ScheduleWithItem> {
    return this.scheduleWithItem(
      await this.put<unknown>(
        `${this.schedulePath(eventId)}/items/${encodeURIComponent(itemId)}`,
        details,
        { headers: { 'If-Match': versionTag(version) } },
      ),
    );
  }

  async deleteScheduleItem(eventId: string, itemId: string): Promise<Schedule> {
    return this.scheduleOf(
      await this.delete<unknown>(
        `${this.schedulePath(eventId)}/items/${encodeURIComponent(itemId)}`,
      ),
    );
  }

  /** The same key again answers as the first time (sc-3895); 409 with `superseded_by` when it changes nothing, 422 for the key with another press. */
  async pressScheduleItem(
    eventId: string,
    itemId: string,
    kind: ScheduleItemPress,
    sent: PressSent,
  ): Promise<Schedule> {
    return this.scheduleOf(
      await this.post<unknown>(
        `${this.schedulePath(eventId)}/items/${encodeURIComponent(itemId)}/presses`,
        { kind, pressedAt: sent.pressedAt, ...(sent.fromCard === true ? { fromCard: true } : {}) },
        { headers: { 'Idempotency-Key': sent.key } },
      ),
    );
  }

  /** sc-4005's read of one course's service: 403 without service.work. */
  async serviceRead(eventId: string, courseId: string): Promise<ServiceRead> {
    const body = await this.get<{ service?: unknown }>(
      `${this.servicePath(eventId)}/course/${encodeURIComponent(courseId)}`,
    );
    const read = asServiceRead(body?.service);

    if (read == null)
      throw new Error(
        'The API answered a service read in a shape this client does not know. Check ServiceRead in services/api.',
      );

    return read;
  }

  /** The event's kitchen stations, the reader's own and the courses fired (sc-4015): 403 without service.work, or to whoever works only the floor. */
  async kitchenStations(eventId: string): Promise<KitchenStationsRead> {
    const body = await this.get<unknown>(`${this.servicePath(eventId)}/stations`);
    const read = asKitchenStationsRead(body);

    if (read == null)
      throw new Error(
        'The API answered the kitchen stations in a shape this client does not know. Check KitchenStationList in services/api.',
      );

    return read;
  }

  /** A hub token for this event's service topic alone (sc-4005). */
  async serviceSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.servicePath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  private servicePath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/service`;
  }

  /** A kept service tap (sc-4028); the same key again answers as the first time, 409 `service_changed` names each plate or item that moved since. */
  async sendServiceTap(tap: KeptServiceTap): Promise<void> {
    await this.request<unknown>(
      `/api/events/${encodeURIComponent(tap.eventId)}/service${tap.path}`,
      {
        method: tap.method,
        body: { ...tap.body, expected: tap.expected },
        headers: { 'Idempotency-Key': tap.key },
      },
    );
  }

  /** A hub token for this event's schedule topic alone. */
  async scheduleSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.schedulePath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** A link for each place, Main first; refused 403 without run_of_show.manage (sc-3897). */
  async screenLinks(eventId: string): Promise<ScreenLink[]> {
    return this.screenLinksOf(
      await this.get<unknown>(`/api/events/${encodeURIComponent(eventId)}/screen-links`),
    );
  }

  /** The place's old link answers that it was replaced from now on; `place` is null for Main. */
  async replaceScreenLink(eventId: string, place: string | null): Promise<ScreenLink[]> {
    return this.screenLinksOf(
      await this.post<unknown>(`/api/events/${encodeURIComponent(eventId)}/screen-links/replace`, {
        place,
      }),
    );
  }

  /** The token is a credential, so it travels in the body. Refused `not_found` for a token never issued or a deleted event's. */
  async roomScreen(token: string, { signal }: { signal?: AbortSignal } = {}): Promise<RoomScreen> {
    const screen = asRoomScreen(
      await this.post<unknown>(
        '/api/screen-links/screen',
        { token },
        signal == null ? { anonymous: true } : { anonymous: true, signal },
      ),
    );

    if (screen == null) {
      throw new Error(
        'The API answered the room screen in a shape this client does not know. Check RoomScreen in services/api.',
      );
    }

    return screen;
  }

  /** The person's own night at their link (sc-3915), signed in as the roster entry's account; 404 for anybody else. */
  async staffLinkNight(token: string): Promise<MyNight> {
    return this.myNightOf(await this.post<unknown>('/api/staff-links/night', { token }));
  }

  /** The same night in the app, for an account on the event's roster; 404 for anybody else. */
  async myNight(eventId: string): Promise<MyNight> {
    return this.myNightOf(await this.get<unknown>(`/api/events/${eventId}/my-night`));
  }

  /** Clock in or out at the person's link (sc-234), at the server's time when it arrives; also past access while still clocked in. Refused 409 `conflict` outside the window, or out with no clock-in. */
  async staffLinkClock(token: string, action: ClockAction): Promise<ClockOutcome> {
    return this.clockOutcomeOf(
      await this.post<unknown>('/api/staff-links/clock', { token, action }),
    );
  }

  /** The same in the app. */
  async myNightClock(eventId: string, action: ClockAction): Promise<ClockOutcome> {
    return this.clockOutcomeOf(
      await this.post<unknown>(`/api/events/${eventId}/my-night/clock`, { action }),
    );
  }

  private clockOutcomeOf(raw: unknown): ClockOutcome {
    const outcome = asClockOutcome(raw);

    if (outcome == null) {
      throw new Error(
        'The API answered a clock-in in a shape this client does not know. Check StaffClockController in services/api.',
      );
    }

    return outcome;
  }

  /** An event's hours worked (sc-234), to anybody who can see its staff. */
  async staffHours(eventId: string): Promise<StaffHours> {
    return this.staffHoursOf(await this.get<unknown>(`/api/events/${eventId}/staff/hours`));
  }

  /** Corrects one person's times on one shift, keeping what was recorded; `staff.manage` only, never on one's own shift. Refused 422 `validation_failed` on `clockedInAt` or `clockedOutAt`. */
  async correctStaffHours(
    eventId: string,
    shiftId: string,
    staffId: string,
    typed: HoursTyped,
  ): Promise<StaffHours> {
    return this.staffHoursOf(
      await this.put<unknown>(`/api/events/${eventId}/staff/hours/${shiftId}/${staffId}`, typed),
    );
  }

  /** Who's here tonight (sc-3918): to staff.read, the floor lead, and a station lead for their own station; 403 for anybody else. */
  async whosHere(eventId: string): Promise<WhosHere> {
    return this.whosHereOf(await this.get<unknown>(this.whosHerePath(eventId)));
  }

  /** Someone at the door: their roster entry, a shift from now and their station, and the link to copy with a number. Refused 422 `validation_failed` per field and 409 `event_concluded` once the event has ended. */
  async addWalkOn(eventId: string, typed: WalkOnTyped): Promise<WalkOnAdded> {
    const added = asWalkOnAdded(
      await this.post<unknown>(`${this.whosHerePath(eventId)}/walk-ons`, typed),
    );

    if (added == null) {
      throw new Error(
        'The API answered a walk-on in a shape this client does not know. Check WhosHereController in services/api.',
      );
    }

    return added;
  }

  /** A number for someone with none, and their link to copy; to staff.manage, and the lead who added that walk-on. */
  async addWhosHereMobile(
    eventId: string,
    staffId: string,
    mobile: TypedMobile,
  ): Promise<MobileAdded> {
    const added = asMobileAdded(
      await this.put<unknown>(
        `${this.whosHerePath(eventId)}/people/${encodeURIComponent(staffId)}/mobile`,
        { mobile },
      ),
    );

    if (added == null) {
      throw new Error(
        'The API answered a mobile number in a shape this client does not know. Check WhosHereController in services/api.',
      );
    }

    return added;
  }

  /** Moves someone who is here onto an absent person's station; the floor lead's and staff.manage's only. */
  async coverStation(eventId: string, absent: string, mover: string): Promise<WhosHere> {
    return this.whosHereOf(
      await this.post<unknown>(`${this.whosHerePath(eventId)}/cover`, { absent, mover }),
    );
  }

  /** A hub token for this event's Who's here signal; its messages carry nothing but read again. */
  async whosHereSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.whosHerePath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  private whosHerePath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/whos-here`;
  }

  private whosHereOf(raw: unknown): WhosHere {
    const read = asWhosHere(raw);

    if (read == null) {
      throw new Error(
        "The API answered Who's here in a shape this client does not know. Check WhosHereController in services/api.",
      );
    }

    return read;
  }

  private staffHoursOf(raw: unknown): StaffHours {
    const hours = asStaffHours(raw);

    if (hours == null) {
      throw new Error(
        'The API answered hours worked in a shape this client does not know. Check StaffHoursSerialiser in services/api.',
      );
    }

    return hours;
  }

  private myNightOf(raw: unknown): MyNight {
    const night = asMyNight(raw);

    if (night == null) {
      throw new Error(
        'The API answered a night in a shape this client does not know. Check MyNight in services/api.',
      );
    }

    return night;
  }

  /** A person's own link (sc-3912), by its token in the body. `seen` is the visible page, which records Link opened inside the window; a preview fetch sends it false and records nothing. Refused `not_found` alike for an unknown, replaced or removed token. */
  async staffLinkWindow(token: string, seen: boolean): Promise<StaffLinkWindow> {
    const window = asStaffLinkWindow(
      await this.post<unknown>(seen ? '/api/staff-links/opened' : '/api/staff-links/look', {
        token,
      }),
    );

    if (window == null) {
      throw new Error(
        'The API answered a staff link in a shape this client does not know. Check StaffLinkController in services/api.',
      );
    }

    return window;
  }

  async sendStaffLinkSignIn(token: string): Promise<PhoneSignInSent> {
    return this.phoneSignInSent(
      await this.post<unknown>('/api/staff-links/sign-in/send', { token }, { anonymous: true }),
    );
  }

  /** The right code makes or signs into the number's account and opens the shift; with two-factor on, its challenge first. */
  async staffLinkSignIn(token: string, handle: string, code: string): Promise<SignInOutcome> {
    return this.signedIn(
      '/api/staff-links/sign-in',
      { token, handle, code },
      'StaffLinkController',
    );
  }

  /** The code step's countdown, whether the code is still worth typing, and its route; polled while it is on WhatsApp. */
  async phoneSignInOpening(handle: string): Promise<PhoneCodeOpening> {
    const answer = await this.post<{ route?: unknown }>(
      '/api/auth/phone-sign-in/state',
      { handle },
      { anonymous: true },
    );

    return { ...openingFrom(answer), route: asRoute(answer?.route) };
  }

  async resendPhoneSignIn(handle: string): Promise<number> {
    return (
      await this.post<{ cooldownSeconds: number }>(
        '/api/auth/phone-sign-in/resend',
        { handle },
        { anonymous: true },
      )
    ).cooldownSeconds;
  }

  async textPhoneSignInInstead(handle: string): Promise<void> {
    await this.post<unknown>(
      '/api/auth/phone-sign-in/text-instead',
      { handle },
      { anonymous: true },
    );
  }

  /** A hub token for the event's bare signal to ask again; refused `not_found` once the link is replaced. */
  async roomScreenSubscription(token: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      '/api/screen-links/subscriptions',
      { token },
      { anonymous: true },
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** A hub token for the event's bare signal to ask again (sc-4022). Refused `not_found` as the page is. */
  async guestPageSubscription(token: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      '/api/guest-links/subscriptions',
      { token },
      { anonymous: true },
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  private screenLinksOf(body: unknown): ScreenLink[] {
    return (
      asScreenLinks(body) ??
      (() => {
        throw new Error(
          'The API answered the screen links in a shape this client does not know. Check ScreenLinkController in services/api.',
        );
      })()
    );
  }

  private scheduleOf(body: unknown): Schedule {
    const record =
      typeof body === 'object' && body != null ? (body as Record<string, unknown>) : {};

    return (
      asSchedule(record.schedule) ??
      (() => {
        throw new Error(
          'The API answered the schedule in a shape this client does not know. Check ScheduleSerialiser in services/api.',
        );
      })()
    );
  }

  private scheduleWithItem(body: unknown): ScheduleWithItem {
    const record =
      typeof body === 'object' && body != null ? (body as Record<string, unknown>) : {};
    const itemId = record.itemId;

    if (typeof itemId !== 'string') {
      throw new Error(
        'The API answered a schedule item without its id. Check the schedule controller in services/api.',
      );
    }

    return { schedule: this.scheduleOf(body), itemId };
  }

  private schedulePath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/schedule`;
  }

  private staffPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/staff`;
  }

  private stationsPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/stations`;
  }

  /** sc-3784: the people named, in their order, as a spreadsheet the API builds from the list as it is now. */
  async exportGuests(
    eventId: string,
    request: GuestExportRequest,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const response = await this.answered(`${this.guestsPath(eventId)}/export`, {
      method: 'POST',
      body: request,
    });

    return new Uint8Array(await response.arrayBuffer());
  }

  async guests(eventId: string): Promise<GuestList> {
    const list = asGuestList(await this.get<unknown>(this.guestsPath(eventId)));

    if (list == null) {
      throw new Error(
        'The API answered the guest list in a shape this client does not know. Check GuestSerialiser in services/api.',
      );
    }

    return list;
  }

  /** Refused `validation_failed` on each field, and 409 `guest_already_listed` until `allowDuplicate`. */
  async addGuest(eventId: string, guest: NewGuest): Promise<Guest> {
    const body = await this.post<{ guest?: unknown }>(this.guestsPath(eventId), guest);
    const added = asGuest(body?.guest);

    if (added == null) {
      throw new Error(
        'The API answered an added guest in a shape this client does not know. Check GuestSerialiser in services/api.',
      );
    }

    return added;
  }

  /** A guest on the list, not a companion; 404 for anyone else (sc-3773). */
  async guest(eventId: string, guestId: string): Promise<TaggedGuest> {
    return this.taggedGuest(
      await this.exchange<{ guest?: unknown }>(this.guestPath(eventId, guestId), { method: 'GET' }),
    );
  }

  /** Refused 412 when somebody saved since `tag`, 404 once the guest is gone, and as addGuest. */
  async updateGuest(
    eventId: string,
    guestId: string,
    guest: GuestEdit,
    tag: string,
  ): Promise<TaggedGuest> {
    return this.taggedGuest(
      await this.exchange<{ guest?: unknown }>(this.guestPath(eventId, guestId), {
        method: 'PUT',
        body: guest,
        headers: { 'If-Match': tag },
      }),
    );
  }

  /** Refused 409 `event_state_invalid` unless the event's phase allows `invite`; a guest already invited stays as recorded (sc-3788). */
  async markInvited(
    eventId: string,
    guestId: string,
    how: GuestInvitationHow,
  ): Promise<TaggedGuest> {
    return this.taggedGuest(
      await this.exchange<{ guest?: unknown }>(`${this.guestPath(eventId, guestId)}/invitation`, {
        method: 'PUT',
        body: { how },
      }),
    );
  }

  /** Lets one guest answer again after Reply by, until the start (sc-3780); needs guests.manage, and is refused 409 `replies_open` while replies are open. */
  async reopenGuestReplies(eventId: string, guestId: string): Promise<TaggedGuest> {
    return this.taggedGuest(
      await this.exchange<{ guest?: unknown }>(
        `${this.guestPath(eventId, guestId)}/reopen-replies`,
        {
          method: 'POST',
        },
      ),
    );
  }

  /** Record a reply (sc-3787); needs guests.manage. Refused 422 without `answer` or `how`, 409 `replies_closed` as the guest page is, and 409 `reply_is_theirs` over the guest's own reply unless `replace`. */
  async recordGuestReply(
    eventId: string,
    guestId: string,
    input: RecordedReplyInput,
  ): Promise<TaggedGuest> {
    return this.taggedGuest(
      await this.exchange<{ guest?: unknown }>(`${this.guestPath(eventId, guestId)}/record-reply`, {
        method: 'POST',
        body: input,
      }),
    );
  }

  /** In any phase; refused 409 `guest_replied` once they have replied, and `guest_not_marked_by_hand` for Soirely's message. */
  async markNotInvited(eventId: string, guestId: string): Promise<TaggedGuest> {
    return this.taggedGuest(
      await this.exchange<{ guest?: unknown }>(`${this.guestPath(eventId, guestId)}/invitation`, {
        method: 'DELETE',
      }),
    );
  }

  /** Off the list and the counts at once, with their companions; their link works until eraseGuest (sc-3774). Refused 404 when somebody removed them already. */
  async removeGuest(eventId: string, guestId: string): Promise<void> {
    await this.delete<undefined>(this.guestPath(eventId, guestId));
  }

  /** Back on the list as they were; refused 404 once erased. */
  async undoGuestRemoval(eventId: string, guestId: string): Promise<TaggedGuest> {
    return this.taggedGuest(
      await this.exchange<{ guest?: unknown }>(`${this.guestPath(eventId, guestId)}/removal`, {
        method: 'DELETE',
      }),
    );
  }

  /** Once the undo has run out, or as the page goes: they, their companions and their link are gone. */
  async eraseGuest(eventId: string, guestId: string): Promise<void> {
    await this.post<undefined>(`${this.guestPath(eventId, guestId)}/erasure`, undefined, {
      keepalive: true,
    });
  }

  /** Every selected guest not yet invited, marked with one how (sc-46880); refused 409 `event_state_invalid` unless the phase allows `invite`, and `validation_failed` on `guestIds` over 2,000. */
  async markGuestsInvited(
    eventId: string,
    guestIds: readonly string[],
    how: GuestInvitationHow,
  ): Promise<MarkedTogether> {
    const body = await this.post<unknown>(`${this.guestsPath(eventId)}/invitations`, {
      guestIds,
      how,
    });

    return asMarkedTogether(body) ?? together();
  }

  /** Many guests into one group, chosen by `id` or made from `name` (sc-3776); refused `validation_failed` on `guestIds` over 2,000, or on the name as makeGuestGroup. */
  async moveGuestsToGroup(
    eventId: string,
    guestIds: readonly string[],
    group: { id: string } | { name: string },
  ): Promise<MovedTogether> {
    const body = await this.post<unknown>(`${this.guestsPath(eventId)}/group-moves`, {
      guestIds,
      group,
    });

    return asMovedTogether(body) ?? together();
  }

  /** Many guests and their companions off the list as one action with one Undo (sc-3776); one not on the list is counted in `gone`. */
  async removeGuests(eventId: string, guestIds: readonly string[]): Promise<RemovedTogether> {
    const body = await this.post<unknown>(`${this.guestsPath(eventId)}/removals`, { guestIds });

    return asRemovedTogether(body) ?? together();
  }

  /** Every guest the removal took, back as they were; refused 404 once erased. */
  async undoGuestsRemoval(eventId: string, removal: string): Promise<void> {
    await this.delete<unknown>(
      `${this.guestsPath(eventId)}/removals/${encodeURIComponent(removal)}`,
    );
  }

  /** Once the undo has run out, or as the page goes. */
  async eraseGuestsRemoval(eventId: string, removal: string): Promise<void> {
    await this.post<undefined>(
      `${this.guestsPath(eventId)}/removals/${encodeURIComponent(removal)}/erasure`,
      undefined,
      { keepalive: true },
    );
  }

  /** Refused `validation_failed` on `name`: blank, over 60 characters, a name already used, or 50 groups (sc-3775). */
  async makeGuestGroup(eventId: string, name: string): Promise<GuestGroup> {
    return this.guestGroup(
      await this.post<{ group?: unknown }>(this.guestGroupsPath(eventId), { name }),
    );
  }

  /** Refused as makeGuestGroup, though the group's own name in another case is allowed. */
  async renameGuestGroup(eventId: string, groupId: string, name: string): Promise<GuestGroup> {
    return this.guestGroup(
      await this.put<{ group?: unknown }>(
        `${this.guestGroupsPath(eventId)}/${encodeURIComponent(groupId)}`,
        { name },
      ),
    );
  }

  /** Its guests stay on the list, with no group. */
  async deleteGuestGroup(eventId: string, groupId: string): Promise<void> {
    await this.delete<undefined>(`${this.guestGroupsPath(eventId)}/${encodeURIComponent(groupId)}`);
  }

  private guestGroupsPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/guest-groups`;
  }

  private guestGroup(body: { group?: unknown } | undefined): GuestGroup {
    const group = asGuestGroup(body?.group);

    if (group == null) {
      throw new Error(
        'The API answered a guest group in a shape this client does not know. Check GuestGroupsController in services/api.',
      );
    }

    return group;
  }

  /** The range, per head, the count not priced, what each basis counts today and every line with its cost (sc-84, sc-85); 403 without budget.read. */
  async budget(eventId: string): Promise<EventBudget> {
    return asEventBudget(await this.get<unknown>(this.budgetPath(eventId)));
  }

  /** Refused `validation_failed` beside each field at once, `basis` for a second staff-time line. */
  async addBudgetLine(eventId: string, typed: BudgetLineTyped): Promise<void> {
    await this.post<unknown>(`${this.budgetPath(eventId)}/lines`, typed);
  }

  /** The whole line, checked as Add checks it. */
  async changeBudgetLine(eventId: string, lineId: string, typed: BudgetLineTyped): Promise<void> {
    await this.put<unknown>(this.budgetLinePath(eventId, lineId), typed);
  }

  /** Kept a day for `putBackBudgetLine`, and out of every figure meanwhile. */
  async removeBudgetLine(eventId: string, lineId: string): Promise<void> {
    await this.delete<unknown>(this.budgetLinePath(eventId, lineId));
  }

  /** Undo: the same line in its place. 404 once erased, a day after its removal; 410 `budget_line_currency_changed` once the event's currency changed; `basis` refused when another staff-time line holds it. */
  async putBackBudgetLine(eventId: string, lineId: string): Promise<void> {
    await this.delete<unknown>(`${this.budgetLinePath(eventId, lineId)}/removal`);
  }

  /** A hub token for this event's budget lines, its quotes and schedules, and its headcount, which moves the range. */
  async budgetSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.budgetPath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** Budget / Staff rates (sc-101): each job's rate and scheduled hours, people on their own rate, and the headline; 403 without budget.read. */
  async staffRates(eventId: string): Promise<StaffRates> {
    return asStaffRates(await this.get<unknown>(`${this.budgetPath(eventId)}/staff-rates`));
  }

  /** A job's rate or flat fee, set or changed; 403 without budget.manage. Answers with the whole of Staff rates. */
  async setJobRate(eventId: string, jobId: string, typed: StaffRateTyped): Promise<StaffRates> {
    return asStaffRates(await this.put<unknown>(this.jobRatePath(eventId, jobId), typed));
  }

  async removeJobRate(eventId: string, jobId: string): Promise<StaffRates> {
    return asStaffRates(await this.delete<unknown>(this.jobRatePath(eventId, jobId)));
  }

  /** A person's own rate, instead of their job's; 403 without budget.manage. */
  async setOwnRate(eventId: string, memberId: string, typed: StaffRateTyped): Promise<StaffRates> {
    return asStaffRates(await this.put<unknown>(this.ownRatePath(eventId, memberId), typed));
  }

  /** Back on their job's rate. */
  async removeOwnRate(eventId: string, memberId: string): Promise<StaffRates> {
    return asStaffRates(await this.delete<unknown>(this.ownRatePath(eventId, memberId)));
  }

  /** Who is paying (sc-91): each payer's share, Paid and Still to come, and every cost with its split; 403 without budget.read. */
  async payers(eventId: string): Promise<EventPayers> {
    return asEventPayers(await this.get<unknown>(`${this.budgetPath(eventId)}/payers`));
  }

  /** 422 on `name` or `note`; 409 `payer_limit` with 20 payers on the event. */
  async addPayer(eventId: string, typed: PayerTyped): Promise<Payer> {
    const body = await this.post<{ payer?: unknown }>(`${this.budgetPath(eventId)}/payers`, typed);

    return asPayer(body.payer);
  }

  async changePayer(eventId: string, payerId: string, typed: PayerTyped): Promise<Payer> {
    const body = await this.put<{ payer?: unknown }>(this.payerPath(eventId, payerId), typed);

    return asPayer(body.payer);
  }

  /** 409 `payer_covers_costs`, with `lineIds` and `count`, while the payer covers any cost. */
  async removePayer(eventId: string, payerId: string): Promise<void> {
    await this.delete<unknown>(this.payerPath(eventId, payerId));
  }

  /** Undo: the payer back in their place. 404 once erased, 409 `payer_limit`, 422 `name` when another payer took the name meanwhile. */
  async putBackPayer(eventId: string, payerId: string): Promise<void> {
    await this.delete<unknown>(`${this.payerPath(eventId, payerId)}/removal`);
  }

  /** Replaces each cost's split, or leaves them with no payer with `split` null; answers with Who is paying as it now stands. */
  async choosePayers(
    eventId: string,
    lineIds: readonly string[],
    split: SplitTyped | null,
    currency: string,
  ): Promise<EventPayers> {
    return asEventPayers(
      await this.put<unknown>(`${this.budgetPath(eventId)}/payers/splits`, {
        lineIds,
        split,
        currency,
      }),
    );
  }

  /** Client prices, markups and margin (sc-92); 403 `plan_required` without a plan with margin, `permission_required` without budget.margin. */
  async budgetMargin(eventId: string): Promise<BudgetMargin> {
    return asBudgetMargin(await this.get<unknown>(`${this.budgetPath(eventId)}/margin`));
  }

  /** The whole event's markup, or a category's; null takes it away. Answers with the whole margin. */
  async setBudgetMarkup(
    eventId: string,
    category: string | null,
    markup: string | null,
  ): Promise<BudgetMargin> {
    const path =
      category == null
        ? `${this.budgetPath(eventId)}/markup`
        : `${this.budgetPath(eventId)}/markups/${encodeURIComponent(category)}`;

    return asBudgetMargin(await this.put<unknown>(path, { markup }));
  }

  async chargeBudgetLine(
    eventId: string,
    lineId: string,
    charge: LineCharge,
  ): Promise<BudgetMargin> {
    return asBudgetMargin(
      await this.put<unknown>(`${this.budgetLinePath(eventId, lineId)}/charge`, charge),
    );
  }

  /** A hub token for this event's margin and the headcount that moves it. */
  async budgetMarginSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.budgetPath(eventId)}/margin/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** Every vendor quoted on the event with its quote, earlier quotes, lines and schedule, and everything due (sc-87); 403 without budget.read. */
  async quotes(eventId: string): Promise<EventQuotes> {
    return asEventQuotes(await this.get<unknown>(`${this.budgetPath(eventId)}/quotes`));
  }

  /** The quote form's Vendor field: the organisation's vendors not archived, A to Z, each marked when already quoted on the event; 403 without budget.manage. */
  async quoteVendors(eventId: string): Promise<OfferedVendor[]> {
    return asOfferedVendors(await this.get<unknown>(`${this.budgetPath(eventId)}/quote-vendors`));
  }

  /** Refused 409 `vendor_already_quoted` for a vendor quoted on the event, and 403 `plan_required` without vendors on the plan. */
  async addQuote(eventId: string, typed: QuoteTyped): Promise<EventQuote> {
    return this.readQuote(await this.post<unknown>(`${this.budgetPath(eventId)}/quotes`, typed));
  }

  /** A new amount or date quoted, keeping the current quote as an earlier one; 409 `quote_unchanged` when both are as they were. */
  async reviseQuote(eventId: string, quoteId: string, typed: QuoteTermsTyped): Promise<EventQuote> {
    return this.readQuote(
      await this.post<unknown>(`${this.quotePath(eventId, quoteId)}/revisions`, typed),
    );
  }

  /** What it covers, its quote number and its budget lines, in place. */
  async correctQuote(
    eventId: string,
    quoteId: string,
    typed: QuoteWordingTyped,
  ): Promise<EventQuote> {
    return this.readQuote(await this.put<unknown>(this.quotePath(eventId, quoteId), typed));
  }

  async addPayment(eventId: string, quoteId: string, typed: PaymentTyped): Promise<EventQuote> {
    return this.readQuote(
      await this.post<unknown>(`${this.quotePath(eventId, quoteId)}/payments`, typed),
    );
  }

  /** A vendor's first payments, every one or none (sc-1332); 409 `payments_already_scheduled` once the vendor has any payment. */
  async addSchedule(
    eventId: string,
    quoteId: string,
    payments: readonly PaymentTyped[],
  ): Promise<EventQuote> {
    return this.readQuote(
      await this.post<unknown>(`${this.quotePath(eventId, quoteId)}/schedule`, { payments }),
    );
  }

  async amendPayment(eventId: string, paymentId: string, typed: PaymentTyped): Promise<EventQuote> {
    return this.readQuote(
      await this.put<unknown>(
        `${this.budgetPath(eventId)}/payments/${encodeURIComponent(paymentId)}`,
        typed,
      ),
    );
  }

  async removePayment(eventId: string, paymentId: string): Promise<void> {
    await this.delete<unknown>(
      `${this.budgetPath(eventId)}/payments/${encodeURIComponent(paymentId)}`,
    );
  }

  /** Mark paid (sc-88): a command, refused 409 when already paid or cancelled. */
  async markPaid(eventId: string, paymentId: string, typed: PaidTyped): Promise<EventQuote> {
    return this.readQuote(
      await this.post<unknown>(`${this.paymentPath(eventId, paymentId)}/paid`, typed),
    );
  }

  /** Undo: unmarks a scheduled payment, and deletes one added as already made. */
  async undoPaid(eventId: string, paymentId: string): Promise<EventQuote> {
    return this.readQuote(
      await this.delete<unknown>(`${this.paymentPath(eventId, paymentId)}/paid`),
    );
  }

  async cancelPayment(eventId: string, paymentId: string, reason: string): Promise<EventQuote> {
    return this.readQuote(
      await this.post<unknown>(`${this.paymentPath(eventId, paymentId)}/cancellation`, { reason }),
    );
  }

  async restorePayment(eventId: string, paymentId: string): Promise<EventQuote> {
    return this.readQuote(
      await this.delete<unknown>(`${this.paymentPath(eventId, paymentId)}/cancellation`),
    );
  }

  async addMadePayment(
    eventId: string,
    quoteId: string,
    typed: MadeTyped,
  ): Promise<{ quote: EventQuote; paymentId: string }> {
    const raw = await this.post<unknown>(
      `${this.quotePath(eventId, quoteId)}/paid-payments`,
      typed,
    );
    const paymentId = (raw as Record<string, unknown> | null)?.paymentId;

    return {
      quote: this.readQuote(raw),
      paymentId: typeof paymentId === 'string' ? paymentId : '',
    };
  }

  private paymentPath(eventId: string, paymentId: string): string {
    return `${this.budgetPath(eventId)}/payments/${encodeURIComponent(paymentId)}`;
  }

  private quotePath(eventId: string, quoteId: string): string {
    return `${this.budgetPath(eventId)}/quotes/${encodeURIComponent(quoteId)}`;
  }

  private readQuote(raw: unknown): EventQuote {
    return asEventQuote((raw as Record<string, unknown> | null)?.quote);
  }

  private budgetPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/budget`;
  }

  private payerPath(eventId: string, payerId: string): string {
    return `${this.budgetPath(eventId)}/payers/${encodeURIComponent(payerId)}`;
  }

  private budgetLinePath(eventId: string, lineId: string): string {
    return `${this.budgetPath(eventId)}/lines/${encodeURIComponent(lineId)}`;
  }

  private jobRatePath(eventId: string, jobId: string): string {
    return `${this.budgetPath(eventId)}/staff-rates/jobs/${encodeURIComponent(jobId)}`;
  }

  private ownRatePath(eventId: string, memberId: string): string {
    return `${this.budgetPath(eventId)}/staff-rates/people/${encodeURIComponent(memberId)}`;
  }

  /** Needs guests.read on the event (sc-99). */
  async headcount(eventId: string): Promise<Headcount> {
    const body = await this.get<{ headcount?: unknown }>(
      `/api/events/${encodeURIComponent(eventId)}/headcount`,
    );
    const headcount = asHeadcount(body?.headcount);

    if (headcount == null) {
      throw new Error(
        'The API answered the headcount in a shape this client does not know. Check HeadcountCalculator in services/api.',
      );
    }

    return headcount;
  }

  /** A hub token for this event's guest list and its headcount; each change publishes the whole list, with no email address or mobile number, then the headcount. */
  async guestsSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.guestsPath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** The door's list (sc-1454): names, replies and arrivals with sc-99's attended of expected; needs guests.check_in, refused 403 for Can view. */
  async checkIn(eventId: string): Promise<CheckIn> {
    return this.checkInOf(await this.get<unknown>(this.checkInPath(eventId)));
  }

  /** Arrived, for a guest or a companion by id: one already arrived keeps their first arrival and nobody else is arrived. `arrivedAt` is when a device that was offline recorded it (sc-1301), and the earlier arrival stands. Refused 409 `check_in_closed` outside the window. */
  async arrive(eventId: string, guestId: string, arrivedAt?: string): Promise<CheckIn> {
    return this.checkInOf(
      await this.post<unknown>(
        `${this.checkInPath(eventId)}/arrivals`,
        arrivedAt == null ? { guestId } : { guestId, arrivedAt },
      ),
    );
  }

  /** Undo arrival; asks nothing first. */
  async undoArrival(eventId: string, guestId: string): Promise<CheckIn> {
    return this.checkInOf(
      await this.delete<unknown>(
        `${this.checkInPath(eventId)}/arrivals/${encodeURIComponent(guestId)}`,
      ),
    );
  }

  /** A walk-in, by full name only, added arrived; refused 409 `guest_already_listed` with `guest` naming who is on the list unless `allowDuplicate`, and 422 on the name as addGuest. */
  async addWalkIn(
    eventId: string,
    fullName: string,
    allowDuplicate = false,
  ): Promise<{ walkIn: string; checkIn: CheckIn }> {
    const body = await this.post<{ walkIn?: { id?: unknown } }>(
      `${this.checkInPath(eventId)}/walk-ins`,
      {
        fullName,
        allowDuplicate,
      },
    );
    const id = body.walkIn?.id;

    return { walkIn: typeof id === 'string' ? id : '', checkIn: this.checkInOf(body) };
  }

  /** A hub token for the door's signal alone: it says the list changed and carries no name, reply or count, so the screen reads checkIn again. */
  async checkInSubscription(eventId: string): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `${this.checkInPath(eventId)}/subscriptions`,
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  private checkInPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/check-in`;
  }

  private checkInOf(body: unknown): CheckIn {
    const read = asCheckIn(body);
    if (read == null) {
      throw new Error(
        'The API answered check-in in a shape this client does not know. Check CheckInSerialiser in services/api.',
      );
    }

    return read;
  }

  /** A hub token for the headcounts of the events a list shows, those the caller reads guests on (sc-3786). */
  async headcountsSubscription(
    organisationId: string,
    eventIds: readonly string[],
  ): Promise<RealtimeSubscription> {
    const body = await this.post<{ token?: unknown; expiresAt?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/events/headcounts/subscriptions`,
      { events: eventIds },
    );

    return {
      token: typeof body.token === 'string' ? body.token : '',
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
    };
  }

  /** A guest's whole link, for those who can add guests. Refused 409 `event_state_invalid` unless the event's phase allows `invite` (sc-1526). */
  async guestLink(eventId: string, guestId: string): Promise<string> {
    const body = await this.get<{ url?: unknown }>(
      `${this.guestsPath(eventId)}/${encodeURIComponent(guestId)}/link`,
    );

    if (typeof body?.url !== 'string') {
      throw new Error(
        'The API answered a guest link in a shape this client does not know. Check GuestLinkController in services/api.',
      );
    }

    return body.url;
  }

  /** The ids of the guests whose link may have reached the wrong person, for those who can add guests (sc-1526). */
  async flaggedGuests(eventId: string): Promise<readonly string[]> {
    const body = await this.get<{ guests?: unknown }>(`${this.guestsPath(eventId)}/flagged`);
    const ids = body?.guests;

    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) {
      throw new Error(
        'The API answered the flagged guests in a shape this client does not know. Check GuestLinkController in services/api.',
      );
    }

    return ids;
  }

  /** Ends the guest's old link at once, in any phase. */
  async replaceGuestLink(eventId: string, guestId: string): Promise<void> {
    await this.post<undefined>(
      `${this.guestsPath(eventId)}/${encodeURIComponent(guestId)}/link/replace`,
    );
  }

  /** Preview as guest (sc-3907): the guest page's meal step for the signed-in member alone, with no allergies or companions; menu.read, and it reads no guest. */
  async menuPreview(eventId: string): Promise<GuestPage> {
    const route = `${this.menuPath(eventId)}/preview`;

    return this.guestPageOf(await this.get<unknown>(route), `GET ${route}`);
  }

  /** The token is a credential, so it travels in the body. Refused `not_found` alike for an unknown or replaced token, a deleted event's and a Draft's. Records nothing. */
  async guestPage(token: string): Promise<GuestPage> {
    return this.guestPageOf(
      await this.post<unknown>('/api/guest-links/page', { token }, { anonymous: true }),
      'POST /api/guest-links/page',
    );
  }

  /** Records the guest's answer, and with Coming each place by its id, named (sc-3779) or left unnamed, Coming or Not coming (sc-48740), with the needs of the guest and each person (sc-3778), and answers the page as it now stands (sc-1439). Refused 422 for an answer the page does not offer, a place that is not the guest's or one sent as unnamed that the reply names, a need the API does not know, 409 `event_paused` or `event_concluded` by the event's phase, 409 `replies_closed` from the start, and `not_found` as the page is. */
  async sendGuestAnswer(
    token: string,
    answer: GuestAnswer,
    companions: readonly CompanionChoice[] = [],
    needs: PageNeeds | null = null,
    unnamed: readonly PlaceChoice[] = [],
  ): Promise<GuestPage> {
    return this.guestPageOf(
      await this.post<unknown>(
        '/api/guest-links/reply',
        {
          token,
          answer,
          ...(companions.length === 0 ? {} : { companions }),
          ...(needs == null ? {} : { needs }),
          ...(unnamed.length === 0 ? {} : { unnamed }),
        },
        { anonymous: true },
      ),
      'POST /api/guest-links/reply',
    );
  }

  /** After Reply by, a Coming guest's kitchen needs alone, until the start (sc-3780): the answer and who is coming stay. Refused 409 `replies_closed` from the start, and as sendGuestAnswer otherwise. */
  async sendGuestNeeds(
    token: string,
    needs: PageNeeds | null,
    companions: readonly PlaceNeeds[] = [],
    unnamed: readonly PlaceNeeds[] = [],
  ): Promise<GuestPage> {
    return this.guestPageOf(
      await this.post<unknown>(
        '/api/guest-links/needs',
        {
          token,
          ...(needs == null ? {} : { needs }),
          ...(companions.length === 0 ? {} : { companions }),
          ...(unnamed.length === 0 ? {} : { unnamed }),
        },
        { anonymous: true },
      ),
      'POST /api/guest-links/needs',
    );
  }

  /** Each person's meal answers (sc-3907), sent after the kitchen note so its allergens count, and answers the page as it now stands. Refused 422 for a pick the person is not offered, a wrong count or a plate holding their allergen, nothing saved, and 409 `meal_picks_closed` with the closed `courses` once the open ones are saved. */
  async sendMealPicks(token: string, picks: readonly MealPick[]): Promise<GuestPage> {
    return this.guestPageOf(
      await this.post<unknown>('/api/guest-links/meals', { token, picks }, { anonymous: true }),
      'POST /api/guest-links/meals',
    );
  }

  private guestPageOf(raw: unknown, route: string): GuestPage {
    const page = asGuestPage(raw);
    const feed = (raw as Record<string, unknown> | null)?.calendarFeed;

    if (page == null || (feed != null && (typeof feed !== 'string' || !feed.startsWith('/')))) {
      throw new Error(
        `The API answered ${route} in a shape this client does not know. Check GuestPageController in services/api.`,
      );
    }

    if (feed == null) return page;

    const webcal = this.webcalOf(feed);

    return {
      ...page,
      calendar: {
        webcal,
        google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
      },
    };
  }

  /** The guest's own language menu (sc-3790): kept on the guest, never on an account. Refused 422 for a language Soirely does not offer, and `not_found` as the page is. */
  async chooseGuestLanguage(token: string, language: string): Promise<void> {
    await this.post<undefined>(
      '/api/guest-links/language',
      { token, language },
      { anonymous: true },
    );
  }

  /** "Not {name}? Tell us". Refused `too_many_attempts` after five an hour on one link. */
  async tellWrongPerson(token: string): Promise<void> {
    await this.post<undefined>('/api/guest-links/wrong-person', { token }, { anonymous: true });
  }

  private guestsPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/guests`;
  }

  private guestPath(eventId: string, guestId: string): string {
    return `${this.guestsPath(eventId)}/${encodeURIComponent(guestId)}`;
  }

  private taggedGuest({
    body,
    response,
  }: {
    body: { guest?: unknown } | null | undefined;
    response: Response;
  }): TaggedGuest {
    const tag = response.headers.get('ETag');
    const guest = asGuestDetails(body?.guest);

    if (tag == null || tag === '' || guest == null) {
      throw new Error(
        'The API answered a guest in a shape this client does not know, or with no ETag. Check GuestsController in services/api.',
      );
    }

    return { guest, tag };
  }

  private seatingPath(eventId: string): string {
    return `/api/events/${encodeURIComponent(eventId)}/seating-plan`;
  }

  private tablesPath(eventId: string): string {
    return `${this.seatingPath(eventId)}/tables`;
  }

  private rowsPath(eventId: string): string {
    return `${this.seatingPath(eventId)}/rows`;
  }

  private singleSeatsPath(eventId: string): string {
    return `${this.seatingPath(eventId)}/seats`;
  }

  private seatingWithTable(
    body: { seating?: unknown; tableId?: unknown } | null | undefined,
  ): SeatingWithTable {
    const seating = this.seatingOf(body);
    const tableId = typeof body?.tableId === 'string' ? body.tableId : '';

    return { seating, tableId };
  }

  private seatingWithChosen(
    body: { seating?: unknown; chosen?: unknown } | null | undefined,
  ): SeatingWithChosen {
    const chosen = Array.isArray(body?.chosen)
      ? body.chosen.filter((id): id is string => typeof id === 'string')
      : [];

    return { seating: this.seatingOf(body), chosen };
  }

  /** Seats a guest at a table, a row or a single seat, in `seat` when given, with their party unless `justGuest` (sc-4013). Refused 409 `seating_table_full`, `seating_table_short` (with `free` and `party`), `seating_seat_taken` or `seating_guest_not_waiting`. */
  async seatGuest(
    eventId: string,
    guestId: string,
    place: { kind: SeatingPlaceKind; id: string },
    options: { seat?: number | null; justGuest?: boolean } = {},
  ): Promise<SeatingMoved> {
    return this.movedOf(
      await this.post(`${this.seatingPath(eventId)}/guests/seat`, {
        guestId,
        kind: place.kind,
        placeId: place.id,
        seat: options.seat ?? null,
        justGuest: options.justGuest ?? false,
      }),
    );
  }

  /** `guestId` takes `withGuestId`'s chair; they take `guestId`'s, or go to Without a seat. */
  async swapGuests(eventId: string, guestId: string, withGuestId: string): Promise<SeatingMoved> {
    return this.movedOf(
      await this.post(`${this.seatingPath(eventId)}/guests/swap`, { guestId, withGuestId }),
    );
  }

  /** Back to Without a seat: the guests named, or everyone at a place (Unseat everyone). */
  async unseatGuests(
    eventId: string,
    who: { guestIds: string[] } | { kind: SeatingPlaceKind; placeId: string },
  ): Promise<SeatingMoved> {
    return this.movedOf(await this.post(`${this.seatingPath(eventId)}/guests/unseat`, who));
  }

  /** Move everyone to…: refused 409 unless `to` has room for all. */
  async moveEveryone(
    eventId: string,
    from: { kind: SeatingPlaceKind; id: string },
    to: { kind: SeatingPlaceKind; id: string },
  ): Promise<SeatingMoved> {
    return this.movedOf(
      await this.post(`${this.seatingPath(eventId)}/guests/move-everyone`, { from, to }),
    );
  }

  /** Puts back an action's moves, all or nothing; refused 409 `seating_undo_stale` when the seats changed since. */
  async undoSeating(eventId: string, moves: SeatingMove[]): Promise<SeatingMoved> {
    return this.movedOf(await this.post(`${this.seatingPath(eventId)}/guests/undo`, { moves }));
  }

  private movedOf(body: unknown): SeatingMoved {
    const moved = asSeatingMoved(body);

    if (moved == null) {
      throw new Error(
        'The API answered a seating action in a shape this client does not know. Check SeatingGuestsController in services/api.',
      );
    }

    return moved;
  }

  private seatingOf(body: { seating?: unknown } | null | undefined): Seating {
    const seating = asSeating(body?.seating);

    if (seating == null) {
      throw new Error(
        'The API answered the seating plan in a shape this client does not know. Check SeatingSerialiser in services/api.',
      );
    }

    return seating;
  }

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

  async uploadTo(upload: CoverUpload, file: Blob | Uint8Array<ArrayBuffer>): Promise<void> {
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

  /** Calls it off before its start, ends it after: refused 409 `event_state_invalid` unless Live or Paused, or on a call-off with a `thankYou`, and 409 `event_concluded` once its end has passed. */
  async endEvent(eventId: string, thankYou?: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}/end`, {
        method: 'POST',
        ...(thankYou == null || thankYou.trim() === '' ? {} : { body: { thankYou } }),
      }),
    );
  }

  /** Saved empty, the line is removed (sc-6476). Refused 409 `event_state_invalid` unless Finished and not called off, and 422 `validation_failed` on `thankYou` over 280 characters. */
  async setThankYou(eventId: string, thankYou: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(
        `/api/events/${encodeURIComponent(eventId)}/thank-you`,
        { method: 'PUT', body: { thankYou } },
      ),
    );
  }

  /** Refused 409 `event_state_invalid` unless it is Live and not Finished (sc-3586). */
  async pauseEvent(eventId: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(`/api/events/${encodeURIComponent(eventId)}/pause`, {
        method: 'POST',
      }),
    );
  }

  /** Refused 409 `event_state_invalid` unless it is Paused and not Finished; never by the plan's limit. */
  async resumeEvent(eventId: string): Promise<TaggedEvent> {
    return this.tagged(
      await this.exchange<{ event?: unknown }>(
        `/api/events/${encodeURIComponent(eventId)}/resume`,
        {
          method: 'POST',
        },
      ),
    );
  }

  async eventDeletion(eventId: string): Promise<EventDeletion> {
    const body = await this.get<Record<string, unknown>>(
      `/api/events/${encodeURIComponent(eventId)}/deletion`,
    );

    if (
      typeof body.needsName !== 'boolean' ||
      typeof body.people !== 'number' ||
      typeof body.restoreClosesAt !== 'string' ||
      typeof body.restoreCloses !== 'string' ||
      refusalOf(body.deleteRefusedBecause) === undefined
    ) {
      throw new Error(
        'The API answered an event deletion in a shape this client does not know. Check EventDeletionController in services/api.',
      );
    }

    return {
      needsName: body.needsName,
      people: body.people,
      deleteRefusedBecause: refusalOf(body.deleteRefusedBecause) ?? null,
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

  /** A page under `show` (All unless named), 50 people unless `limit` says, after `after`; the counts, Waiting and the invitations whole. */
  async members(organisationId: string, page: MembersPage = {}): Promise<MembersList> {
    const asked = Object.entries({ show: page.show, after: page.after, limit: page.limit })
      .filter((pair): pair is [string, string | number] => pair[1] != null)
      .map(([key, value]): [string, string] => [key, String(value)]);
    const query = asked.length > 0 ? `?${new URLSearchParams(asked).toString()}` : '';
    const raw = await this.get<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members${query}`,
    );
    const list = asMembersList(raw);

    if (list == null) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/members in a shape this client does not know. Check MembersController in services/api.',
      );
    }

    return list;
  }

  /** One person's row as it now is; refused `not_found` for somebody the caller is not shown. */
  async member(organisationId: string, membershipId: string): Promise<OrganisationMember> {
    const body = await this.get<{ member?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}`,
    );
    const member = asOrganisationMember(body?.member);

    if (member == null) {
      throw new Error(
        'The API answered GET /api/orgs/{id}/members/{membershipId} in a shape this client does not know. Check MembersController in services/api.',
      );
    }

    return member;
  }

  /** Every person under `show`, page after page, for a screen that has to choose among them all. */
  async everyMember(organisationId: string, show: MembersShow): Promise<OrganisationMember[]> {
    const read: OrganisationMember[] = [];
    let after: string | null = null;

    do {
      const page: MembersList = await this.members(organisationId, {
        show,
        after,
        limit: MEMBERS_MOST,
      });
      read.push(...page.members);
      after = page.next;
    } while (after != null);

    return read;
  }

  /** Refused `already_a_member`, `grant_not_held`, `proof_required` into Owner, or a violation on `email` or `roleId`. Sending again replaces the link. */
  async inviteMember(
    organisationId: string,
    email: string,
    roleId: string,
    proof?: string,
  ): Promise<SentInvitation> {
    const body = await this.post<{ invitation?: unknown }>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/invite`,
      proof == null ? { email, roleId } : { email, roleId, proof },
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

  /** Refused `conflict` for the caller's own, `grant_not_held`, `last_owner`, or `proof_required` into Owner. Takes effect on their next request. */
  async changeMemberRole(
    organisationId: string,
    membershipId: string,
    roleId: string,
    proof?: string,
  ): Promise<void> {
    await this.patch<unknown>(
      `/api/orgs/${encodeURIComponent(organisationId)}/members/${encodeURIComponent(membershipId)}`,
      proof == null ? { roleId } : { roleId, proof },
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
      managed: asManagedAccount(raw.managed),
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

  async calendarFeed(organisationId: string): Promise<CalendarFeedLink> {
    return this.asCalendarFeedLink(
      await this.get<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/calendar-feed`),
    );
  }

  /** The old link stops working at once. */
  async resetCalendarFeed(organisationId: string): Promise<CalendarFeedLink> {
    return this.asCalendarFeedLink(
      await this.post<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/calendar-feed/reset`,
        {},
      ),
    );
  }

  private asCalendarFeedLink(raw: unknown): CalendarFeedLink {
    const path = (raw as Record<string, unknown> | null)?.path;

    if (typeof path !== 'string' || !path.startsWith('/')) {
      throw new Error(
        'The API answered /api/orgs/{id}/calendar-feed in a shape this client does not know. Check CalendarFeedController in services/api.',
      );
    }

    return { url: this.url(path), webcal: this.webcalOf(path) };
  }

  private webcalOf(path: string): string {
    return this.url(path).replace(/^https?:/, 'webcal:');
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
      managed: asManagedAccount(raw.managed),
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

  /** What the changes would cost (sc-86); writes nothing. Refused 403 `permission_required` without budget.read. */
  async whatIf(
    eventId: string,
    changes: readonly { change: WhatIfChange; by: number }[],
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<WhatIf> {
    const answer = asWhatIf(
      await this.post<unknown>(
        `/api/events/${encodeURIComponent(eventId)}/budget/what-if`,
        { changes },
        signal == null ? undefined : { signal },
      ),
    );

    if (answer == null) {
      throw new Error(
        'The API answered /api/events/{id}/budget/what-if in a shape this client does not know. Check BudgetSerialiser in services/api.',
      );
    }

    return answer;
  }

  async vendors(
    organisationId: string,
    looking: VendorsLooking,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<VendorsPage> {
    const page = asVendorsPage(
      await this.get<unknown>(
        `/api/orgs/${encodeURIComponent(organisationId)}/vendors${vendorsQuery(looking)}`,
        signal == null ? undefined : { signal },
      ),
    );

    if (page == null) {
      throw new Error(
        'The API answered /api/orgs/{id}/vendors in a shape this client does not know. Check VendorDirectory in services/api.',
      );
    }

    return page;
  }

  async addVendor(organisationId: string, typed: VendorTyped): Promise<Vendor> {
    return this.readVendor(
      await this.post<unknown>(`/api/orgs/${encodeURIComponent(organisationId)}/vendors`, typed),
    );
  }

  async editVendor(organisationId: string, vendorId: string, typed: VendorTyped): Promise<Vendor> {
    return this.readVendor(
      await this.put<unknown>(this.vendorPath(organisationId, vendorId), typed),
    );
  }

  async archiveVendor(organisationId: string, vendorId: string): Promise<Vendor> {
    return this.readVendor(
      await this.post<unknown>(`${this.vendorPath(organisationId, vendorId)}/archive`),
    );
  }

  async restoreVendor(organisationId: string, vendorId: string): Promise<Vendor> {
    return this.readVendor(
      await this.post<unknown>(`${this.vendorPath(organisationId, vendorId)}/restore`),
    );
  }

  private vendorPath(organisationId: string, vendorId: string): string {
    return `/api/orgs/${encodeURIComponent(organisationId)}/vendors/${encodeURIComponent(vendorId)}`;
  }

  private readVendor(raw: unknown): Vendor {
    const vendor = asVendor((raw as Record<string, unknown> | null)?.vendor);

    if (vendor == null) {
      throw new Error(
        'The API answered a vendor in a shape this client does not know. Check VendorsController in services/api.',
      );
    }

    return vendor;
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

        return {
          domain: row.domain as string,
          stopped: row.stopped === true,
          proved: row.proved === true,
        };
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

  /** Never waits on a refresh in flight: the API ends the whole session from whichever of its tokens arrives. */
  async signOut(): Promise<void> {
    this.session += 1;
    this.signingOut += 1;

    try {
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
    } finally {
      this.session += 1;
      this.signingOut -= 1;
    }
  }

  /** Ends a session this client no longer holds, as a reinstall's first launch does (sc-34831); unanswered, it lapses. */
  async signOutKept(refreshToken: string): Promise<void> {
    await this.sendTokenRequest('/api/auth/logout', { refreshToken }).catch(() => null);
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

  /** Signed out too. Throws on a failed answer or a shape it does not know, so the caller can carry on without it. */
  async minimumAppVersions(): Promise<MinimumAppVersions> {
    const response = await this.send('/api/app-versions/minimum', {
      method: 'GET',
      anonymous: true,
    });
    if (!response.ok) throw new ApiError(await toProblem(response), response);

    const minimums = asMinimumAppVersions(await response.json().catch(() => null));

    if (minimums == null) {
      throw new Error(
        'The API answered /api/app-versions/minimum in a shape this client does not know. Check MinimumAppVersionsController in services/api.',
      );
    }

    return minimums;
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
    if (init.keepalive === true) request.keepalive = true;

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
    if (this.signingOut > 0) return Promise.resolve(false);
    if (this.refreshing?.session === this.session) return this.refreshing.done;

    const refreshing = { session: this.session, done: this.doRefresh(this.session) };
    this.refreshing = refreshing;
    void refreshing.done
      .catch(() => false)
      .finally(() => {
        if (this.refreshing === refreshing) this.refreshing = null;
      });

    return refreshing.done;
  }

  /** An answer for a session that has since been signed out of, or out of and into another, neither saves nor signs out. */
  private async doRefresh(session: number): Promise<boolean> {
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
    if (this.session !== session) return false;

    if (!response.ok) {
      await this.forgetSession(await toProblem(response));
      return false;
    }

    const issued = asIssuedTokens(await response.json().catch(() => null), this.delivery());
    if (this.session !== session) return false;

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
  private sendTokenRequest(path: string, body: Record<string, unknown>): Promise<Response> {
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
    credentials: Record<string, unknown>,
    controller: string,
  ): Promise<SignInOutcome> {
    this.session += 1;
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

  private async signedInWithBody(
    path: string,
    credentials: Record<string, unknown>,
    controller: string,
  ): Promise<{ outcome: SignInOutcome; body: Record<string, unknown> }> {
    this.session += 1;
    const response = await this.sendTokenRequest(path, credentials);

    if (response.status === 202) {
      const challenge = asChallenge(await response.json().catch(() => null));

      if (challenge == null) {
        throw new Error(
          `The API answered ${path} with a challenge this client cannot read. Check SignInResponse in services/api.`,
        );
      }

      return { outcome: challenge, body: {} };
    }

    const { tokens, body } = await this.issued(response);
    const account = asAccount(body.account);

    if (account == null) {
      throw new Error(
        `The API answered ${path} without the account. Check ${controller} in services/api.`,
      );
    }

    this.session += 1;
    await this.options.tokens?.save(tokens);
    await this.options.onSignedIn?.();

    return { outcome: { tokens, account, linked: body.linked === true }, body };
  }

  /** A way in that never asks for a second factor: registering, or the code that just passed. */
  private async signedInOnly(
    path: string,
    credentials: Record<string, unknown>,
    controller: string,
  ): Promise<SignedIn> {
    this.session += 1;
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

    this.session += 1;
    await this.options.tokens?.save(tokens);
    await this.options.onSignedIn?.();

    return { tokens, account, linked: body.linked === true };
  }

  private async forgetSession(why?: Problem): Promise<void> {
    this.session += 1;
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

/** No address at all, as only a door code's account is until sc-4235 asks it for a number (the API's OnboardingGate::heldByDevice). */
export function heldByDevice(
  account: Pick<Account, 'verified' | 'emailAddresses' | 'phoneNumbers'>,
): boolean {
  return (
    !account.verified && account.emailAddresses.length === 0 && account.phoneNumbers.length === 0
  );
}

/** The gate an account is behind; a door code's account has none to pass and lands inside its event. */
export function gateOf(
  account: Pick<Account, 'verified' | 'complete' | 'emailAddresses' | 'phoneNumbers'> &
    Partial<Pick<Account, 'waitingFor'>>,
): Awaiting | null {
  return heldByDevice(account) ? null : awaiting(account);
}

/** The events list's largest page (EventsController::MOST_PER_PAGE). */
const MOST_EVENTS_PER_PAGE = 200;

const REQUEST_STANDINGS = ['member', 'waiting', 'cooling_off'] as const;

function eventPersonOf(body: { person?: unknown }): EventPerson {
  const person = asEventPerson(body.person);

  if (person == null) {
    throw new Error(
      'The API answered a change to People in a shape this client does not know. Check EventPeopleController in services/api.',
    );
  }

  return person;
}

function asAddableMember(raw: unknown): AddableMember | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { membershipId, name, role } = raw as Record<string, unknown>;

  return typeof membershipId === 'string' && typeof name === 'string'
    ? { membershipId, name, role: typeof role === 'string' ? role : null }
    : null;
}

function asEventPerson(raw: unknown): EventPerson | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const {
    id,
    membershipId,
    user,
    role,
    jobLabel,
    outside,
    address,
    addressKind,
    endsAt,
    doorCode,
    joinedAt,
  } = raw as Record<string, unknown>;
  const named = typeof user === 'object' && user != null ? (user as Record<string, unknown>) : null;

  if (
    typeof id !== 'string' ||
    (membershipId != null && typeof membershipId !== 'string') ||
    (named != null && (typeof named.id !== 'string' || typeof named.name !== 'string')) ||
    !(EVENT_LEVELS as readonly unknown[]).includes(role)
  )
    return null;

  return {
    id,
    membershipId: typeof membershipId === 'string' ? membershipId : null,
    user: named == null ? null : { id: named.id as string, name: named.name as string },
    role: role as EventRole,
    jobLabel: typeof jobLabel === 'string' ? jobLabel : null,
    outside: outside === true,
    address: typeof address === 'string' ? address : null,
    addressKind: addressKind === 'email' || addressKind === 'mobile' ? addressKind : null,
    endsAt: typeof endsAt === 'string' ? endsAt : null,
    doorCode: typeof doorCode === 'string' ? doorCode : null,
    joinedAt: typeof joinedAt === 'string' ? joinedAt : null,
  };
}

const DOOR_CODE_SHAPE =
  'The API answered a door code in a shape this client does not know. Check DoorCodesController in services/api.';

const isString = (value: unknown): value is string => typeof value === 'string';

function asDoorCodeCard(raw: unknown): DoorCodeCard | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const {
    id,
    code,
    link,
    qrSvg,
    role,
    jobLabel,
    useCap,
    used,
    status,
    expiresAt,
    stoppedAt,
    createdAt,
  } = raw as Record<string, unknown>;

  if (
    !isString(id) ||
    !isString(code) ||
    !isString(link) ||
    !isString(qrSvg) ||
    !(DOOR_CODE_ROLES as readonly unknown[]).includes(role) ||
    typeof useCap !== 'number' ||
    typeof used !== 'number' ||
    !(DOOR_CODE_STATUSES as readonly unknown[]).includes(status) ||
    !isString(expiresAt) ||
    !isString(createdAt)
  )
    return null;

  return {
    id,
    code,
    link,
    qrSvg,
    role: role as DoorCodeRole,
    jobLabel: isString(jobLabel) ? jobLabel : null,
    useCap,
    used,
    status: status as DoorCodeStatus,
    expiresAt,
    stoppedAt: isString(stoppedAt) ? stoppedAt : null,
    createdAt,
  };
}

function asOpenedDoorCode(raw: unknown): OpenedDoorCode | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { role, jobLabel, event, standing } = raw as Record<string, unknown>;
  const opened =
    typeof event === 'object' && event != null ? (event as Record<string, unknown>) : null;

  if (
    !(DOOR_CODE_ROLES as readonly unknown[]).includes(role) ||
    opened == null ||
    !isString(opened.id) ||
    !isString(opened.name) ||
    !isString(opened.startsAt) ||
    !isString(opened.endsAt) ||
    !isString(opened.timeZone) ||
    !isString(opened.organisation)
  )
    return null;

  return {
    role: role as DoorCodeRole,
    jobLabel: isString(jobLabel) ? jobLabel : null,
    event: {
      id: opened.id,
      name: opened.name,
      startsAt: opened.startsAt,
      endsAt: opened.endsAt,
      timeZone: opened.timeZone,
      organisation: opened.organisation,
      country: isString(opened.country) ? opened.country : '',
    },
    standing: standing === 'member' || standing === 'in' ? standing : null,
  };
}

function asRedeemedDoorCode(raw: unknown): RedeemedDoorCode | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { eventId, name, role, jobLabel, endsAt, again, shift } = raw as Record<string, unknown>;

  if (
    !isString(eventId) ||
    !isString(name) ||
    !(DOOR_CODE_ROLES as readonly unknown[]).includes(role)
  )
    return null;

  return {
    eventId,
    name,
    role: role as DoorCodeRole,
    jobLabel: isString(jobLabel) ? jobLabel : null,
    endsAt: isString(endsAt) ? endsAt : null,
    again: again === true,
    shift: asRedeemedShift(shift),
  };
}

function asRedeemedShift(raw: unknown): RedeemedDoorCode['shift'] {
  if (typeof raw !== 'object' || raw == null) return null;

  const { landsOn, notJoined, job } = raw as Record<string, unknown>;

  if (landsOn === 'night') return { landsOn };

  return landsOn === 'in' && (notJoined === 'full' || notJoined === 'ended') && isString(job)
    ? { landsOn, notJoined, job }
    : null;
}

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
      undeliverable: address.undeliverable === true,
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
    colourScheme: typeof candidate.colourScheme === 'string' ? candidate.colourScheme : null,
    providers: Array.isArray(candidate.providers)
      ? candidate.providers.flatMap(asLinkedProvider)
      : [],
    emailAddresses,
    phoneNumbers,
    waitingFor: asJoinRequest(candidate.waitingFor),
    outsideEvents: Array.isArray(candidate.outsideEvents)
      ? candidate.outsideEvents.flatMap(asOutsideEvent)
      : [],
    signedOutAt: typeof candidate.signedOutAt === 'string' ? candidate.signedOutAt : null,
  };
}

function asOutsideEvent(raw: unknown): OutsideEvent[] {
  if (typeof raw !== 'object' || raw == null) return [];

  const { id, name, organisationName, role, jobLabel, startsAt, endsAt, timeZone } = raw as Record<
    string,
    unknown
  >;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof organisationName !== 'string' ||
    typeof startsAt !== 'string' ||
    typeof timeZone !== 'string' ||
    !(EVENT_LEVELS as readonly unknown[]).includes(role)
  )
    return [];

  return [
    {
      id,
      name,
      organisationName,
      role: role as EventRole,
      jobLabel: typeof jobLabel === 'string' ? jobLabel : null,
      startsAt,
      endsAt: typeof endsAt === 'string' ? endsAt : null,
      timeZone,
    },
  ];
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

  if (typeof role.id !== 'string' || typeof role.holders !== 'number' || permissions == null)
    return null;

  return {
    id: role.id,
    seededAs: typeof role.seededAs === 'string' ? role.seededAs : null,
    name: typeof role.name === 'string' ? role.name : null,
    // Every role is fixed since sc-29912, which stopped sending these two.
    fixed: typeof role.fixed === 'boolean' ? role.fixed : true,
    removable: role.removable === true,
    permissions,
    holders: role.holders,
  };
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

function asEventTimeline(raw: unknown): EventTimeline | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { timeZone, milestones } = raw as Record<string, unknown>;

  if (typeof timeZone !== 'string' || !Array.isArray(milestones)) return null;

  const read = milestones.map(asMilestone);

  return read.every((one) => one != null) ? { timeZone, milestones: read } : null;
}

function asMilestone(raw: unknown): Milestone | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { at, title, note, owner, area, action, done } = raw as Record<string, unknown>;
  const known = oneOf(owner, MILESTONE_OWNERS);
  const link =
    action === null
      ? null
      : typeof action === 'object' &&
          action != null &&
          'label' in action &&
          'link' in action &&
          typeof action.label === 'string' &&
          typeof action.link === 'string'
        ? { label: action.label, link: action.link }
        : undefined;

  if (
    typeof at !== 'string' ||
    typeof title !== 'string' ||
    !isStringOrNull(note) ||
    typeof area !== 'string' ||
    known == null ||
    link === undefined ||
    typeof done !== 'boolean'
  ) {
    return null;
  }

  return { at, title, note, owner: known, area, action: link, done };
}

function asListedEvent(raw: unknown): ListedEvent | null {
  const event = asOrganisationEvent(raw);
  const { milestones, guests } = (raw ?? {}) as { milestones?: unknown; guests?: unknown };
  const read = Array.isArray(milestones) ? milestones.map(asMilestone) : null;
  const figures = guests == null ? null : asEventGuestFigures(guests);

  return event == null || read == null || read.some((one) => one == null) || figures === undefined
    ? null
    : { ...event, milestones: read as Milestone[], guests: figures };
}

/** An event's guest figures, from the events list or from its headcount as published (sc-3786); undefined for a shape this client does not know. */
export function asEventGuestFigures(raw: unknown): EventGuestFigures | undefined {
  const { invited, coming, notReplied, attended, expected } = (raw ?? {}) as Record<
    string,
    unknown
  >;

  return isCount(invited) &&
    isCount(coming) &&
    isCount(notReplied) &&
    isCount(attended) &&
    isCount(expected)
    ? { invited, coming, notReplied, attended, expected }
    : undefined;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
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
  const arrivalNote = candidate.arrivalNote;
  const hosts = candidate.hosts;
  const thankYou = candidate.thankYou ?? null;
  const madeLiveAt = candidate.madeLiveAt;
  const pausedAt = candidate.pausedAt;
  const phase = oneOf(candidate.phase, EVENT_PHASES);
  const concludedAt = candidate.concludedAt;
  const deleteRefusedBecause = refusalOf(candidate.deleteRefusedBecause);
  const permissions = stringList(candidate.permissions);
  const replyBy = candidate.replyBy ?? null;
  const repliesCloseAt = candidate.repliesCloseAt ?? null;
  const repliesClosedOn = candidate.repliesClosedOn ?? null;
  const roleOnEvent =
    candidate.roleOnEvent == null
      ? null
      : (oneOf(candidate.roleOnEvent, EVENT_LEVELS) ?? undefined);

  if (
    status == null ||
    permissions == null ||
    roleOnEvent === undefined ||
    phase == null ||
    !isStringOrNull(concludedAt) ||
    deleteRefusedBecause === undefined ||
    !isStringOrNull(thankYou) ||
    !isStringOrNull(madeLiveAt) ||
    !isStringOrNull(pausedAt) ||
    type == null ||
    cover === undefined ||
    venue === undefined ||
    !isStringOrNull(arrivalNote) ||
    !isStringOrNull(replyBy) ||
    !isStringOrNull(repliesCloseAt) ||
    !isStringOrNull(repliesClosedOn) ||
    !Array.isArray(hosts) ||
    hosts.some((host) => typeof host !== 'string') ||
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
    arrivalNote,
    hosts: hosts as string[],
    thankYou,
    madeLiveAt,
    pausedAt,
    phase,
    concludedAt,
    deleteRefusedBecause,
    ...(candidate.replyBy === undefined ? {} : { replyBy }),
    ...(candidate.repliesCloseAt === undefined ? {} : { repliesCloseAt }),
    ...(candidate.repliesClosedOn === undefined ? {} : { repliesClosedOn }),
    createdAt: candidate.createdAt as string,
    permissions,
    ...(candidate.roleOnEvent === undefined ? {} : { roleOnEvent }),
  };
}

/** Null, or absent, when nothing is refused; undefined when it is not a reason at all. */
function refusalOf(raw: unknown): DeleteRefusal | null | undefined {
  if (raw == null) return null;

  return typeof raw === 'string' ? raw : undefined;
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

function asGuestPage(raw: unknown): GuestPage | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const {
    guest,
    event,
    phase,
    started,
    onTheDay,
    answersOpen,
    answersClosedOn,
    language,
    programme,
    seating,
    checkInCode,
    meals,
  } = raw as Record<string, unknown>;
  const shown = GUEST_PAGE_PHASES.find((known) => known === phase);
  const door = checkInCode as Record<string, unknown> | null | undefined;
  if (typeof guest !== 'object' || guest == null || typeof event !== 'object' || event == null)
    return null;
  const who = guest as Record<string, unknown>;
  const what = event as Record<string, unknown>;
  const reply = who.reply as Record<string, unknown> | null | undefined;
  const answer = GUEST_ANSWERS.find((known) => known === reply?.answer);
  const venue = what.venue as Record<string, unknown> | null | undefined;
  const languages = (language ?? {}) as Record<string, unknown>;
  const companions = Array.isArray(who.companions) ? who.companions.map(asGuestPageCompanion) : [];
  const needs = asPageNeeds(who.needs);
  const unnamed = Array.isArray(who.unnamed) ? who.unnamed.map(asGuestPagePlace) : [];
  const items = Array.isArray(programme) ? programme.map(asGuestProgrammeItem) : [];

  if (
    (programme != null && !Array.isArray(programme)) ||
    items.some((one) => one == null) ||
    typeof languages.organisation !== 'string' ||
    typeof who.fullName !== 'string' ||
    typeof who.places !== 'number' ||
    needs == null ||
    !Array.isArray(who.unnamed) ||
    unnamed.some((one) => one == null) ||
    !Array.isArray(who.companions) ||
    companions.some((one) => one == null) ||
    (reply != null && (answer == null || typeof reply.at !== 'string')) ||
    typeof what.id !== 'string' ||
    typeof what.name !== 'string' ||
    typeof what.type !== 'string' ||
    typeof what.startsAt !== 'string' ||
    typeof what.timeZone !== 'string' ||
    shown == null ||
    typeof started !== 'boolean' ||
    typeof answersOpen !== 'boolean' ||
    (door != null && (typeof door.code !== 'string' || typeof door.qrSvg !== 'string'))
  )
    return null;

  return {
    guest: {
      fullName: who.fullName,
      reply:
        reply == null || answer == null
          ? null
          : {
              answer,
              at: reply.at as string,
              recordedBy: typeof reply.recordedBy === 'string' ? reply.recordedBy : null,
            },
      needs,
      places: who.places,
      unnamed: unnamed.filter((one) => one != null),
      companions: companions.filter((one) => one != null),
    },
    language: {
      chosen: typeof languages.chosen === 'string' ? languages.chosen : null,
      host: typeof languages.host === 'string' ? languages.host : null,
      organisation: languages.organisation,
    },
    event: {
      id: what.id,
      name: what.name,
      type: what.type,
      cover: asEventCover(what.cover) ?? null,
      hosts: Array.isArray(what.hosts)
        ? what.hosts.filter((host): host is string => typeof host === 'string')
        : [],
      thankYou: typeof what.thankYou === 'string' ? what.thankYou : null,
      startsAt: what.startsAt,
      timeZone: what.timeZone,
      venue:
        venue == null
          ? null
          : {
              name: typeof venue.name === 'string' ? venue.name : null,
              address: typeof venue.address === 'string' ? venue.address : null,
            },
      arrivalNote: typeof what.arrivalNote === 'string' ? what.arrivalNote : null,
      replyBy: typeof what.replyBy === 'string' ? what.replyBy : null,
    },
    answersClosedOn: typeof answersClosedOn === 'string' ? answersClosedOn : null,
    phase: shown,
    started,
    onTheDay: onTheDay === true,
    answersOpen,
    calendar: null,
    programme: items.filter((one) => one != null),
    seating: asGuestSeating(seating),
    checkInCode: door == null ? null : { code: door.code as string, qrSvg: door.qrSvg as string },
    meals: asGuestMeals(meals),
  };
}

/** The server checks every pick, so a course or an answer this client cannot read is left out rather than failing the page. */
function asMealChanged(raw: unknown): MealChanged | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const { picked, why, ways, allergens } = raw as Record<string, unknown>;

  return {
    picked: typeof picked === 'string' ? picked : '',
    why: why === 'ways' || why === 'choices' || why === 'allergen' ? why : 'removed',
    ways: typeof ways === 'number' ? ways : null,
    allergens: Array.isArray(allergens)
      ? allergens.filter((one): one is string => typeof one === 'string')
      : [],
  };
}

function asGuestMeals(raw: unknown): GuestMeals {
  const { you, courses, answers, excluded } = (raw ?? {}) as Record<string, unknown>;
  const strings = (list: unknown): string[] =>
    Array.isArray(list) ? list.filter((one): one is string => typeof one === 'string') : [];
  const known = Array.isArray(courses)
    ? courses.filter(
        (course): course is MealCourse =>
          typeof course === 'object' &&
          course != null &&
          typeof (course as MealCourse).id === 'string' &&
          Array.isArray((course as MealCourse).dishes) &&
          typeof (course as MealCourse).picksClose?.at === 'string',
      )
    : [];
  const byPerson: Record<string, MealAnswer[]> = {};

  for (const [person, list] of Object.entries((answers ?? {}) as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    byPerson[person] = list
      .filter((one): one is Record<string, unknown> => typeof one === 'object' && one != null)
      .filter((one) => typeof one.course === 'string' && typeof one.answer === 'string')
      .map((one) => ({
        course: one.course as string,
        answer: one.answer as MealAnswerKind,
        dish: typeof one.dish === 'string' ? one.dish : null,
        variant: typeof one.variant === 'string' ? one.variant : null,
        options: strings(one.options),
        changed: asMealChanged(one.changed),
      }));
  }

  const never: Record<string, { course: string; reason: string }[]> = {};

  for (const [person, list] of Object.entries((excluded ?? {}) as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    never[person] = list
      .filter((one): one is Record<string, unknown> => typeof one === 'object' && one != null)
      .filter((one) => typeof one.course === 'string' && typeof one.reason === 'string')
      .map((one) => ({ course: one.course as string, reason: one.reason as string }));
  }

  return {
    you: typeof you === 'string' ? you : '',
    courses: known.map((course) => ({ ...course, default: course.default ?? null })),
    answers: byPerson,
    excluded: never,
  };
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
    plan: candidate.plan === 'enterprise' ? 'enterprise' : 'free',
    subscription: subscriptionFrom(candidate.subscription),
  };
}

const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'active',
  'past_due',
  'read_only',
  'cancelled',
];

function subscriptionFrom(raw: unknown): OrganisationSubscription {
  const candidate = typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {};
  const status = SUBSCRIPTION_STATUSES.find((one) => one === candidate.status) ?? 'active';

  return {
    status,
    periodEnd: typeof candidate.periodEnd === 'string' ? candidate.periodEnd : null,
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

/** A kind Search answered: null where the caller may not find it, undefined for a shape this client does not know. */
function asSearchKind<Match>(
  raw: unknown,
  match: (raw: unknown) => Match | null,
): SearchKind<Match> | null | undefined {
  if (raw === null) return null;

  const { total, matches } = (raw ?? {}) as { total?: unknown; matches?: unknown };
  const read = Array.isArray(matches) ? matches.map(match) : null;

  return isCount(total) && read != null && read.every((one) => one != null)
    ? { total, matches: read as Match[] }
    : undefined;
}

function asSearchGuest(raw: unknown): SearchGuest | null {
  const guest = raw as { id?: unknown; name?: unknown; event?: Record<string, unknown> } | null;
  const event = guest?.event;

  return typeof guest?.id === 'string' &&
    typeof guest.name === 'string' &&
    typeof event?.id === 'string' &&
    typeof event.name === 'string' &&
    typeof event.startsAt === 'string' &&
    typeof event.timeZone === 'string'
    ? {
        id: guest.id,
        name: guest.name,
        event: {
          id: event.id,
          name: event.name,
          startsAt: event.startsAt,
          timeZone: event.timeZone,
        },
      }
    : null;
}

const SEARCH_MEMBER_STATUSES = ['active', 'suspended', 'pending_approval', 'invited'] as const;

function asSearchMember(raw: unknown): SearchMember | null {
  const member = raw as Record<string, unknown> | null;
  const status = SEARCH_MEMBER_STATUSES.find((one) => one === member?.status);
  const role = member?.role == null ? null : asMemberRole(member.role);

  if (
    typeof member?.id !== 'string' ||
    (member.kind !== 'member' && member.kind !== 'invitation') ||
    status == null ||
    (member.role != null && role == null)
  ) {
    return null;
  }

  return {
    id: member.id,
    kind: member.kind,
    name: stringOrNull(member.name),
    email: stringOrNull(member.email),
    role,
    status,
  };
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
    signedInAsPhone: asPhoneHint(preview.signedInAsPhone),
    needsEmail: preview.needsEmail === true,
    managed: asManagedAccount(preview.managed),
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
    alsoMemberOf: typeof member.alsoMemberOf === 'number' ? member.alsoMemberOf : null,
  };
}

function asManagedAccount(raw: unknown): ManagedAccount | null {
  const managed = raw as Record<string, unknown> | null | undefined;
  const organisation = managed?.organisation as Record<string, unknown> | null | undefined;

  return typeof managed?.domain === 'string' &&
    typeof managed.message === 'string' &&
    typeof organisation?.id === 'string' &&
    typeof organisation.name === 'string'
    ? {
        domain: managed.domain,
        organisation: { id: organisation.id, name: organisation.name },
        message: managed.message,
      }
    : null;
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
    undelivered: invitation.undelivered === true,
    expiresAt: stringOrNull(invitation.expiresAt),
    acceptedAt: stringOrNull(invitation.acceptedAt),
    declinedAt: stringOrNull(invitation.declinedAt),
    revokedAt: stringOrNull(invitation.revokedAt),
  };
}

function asStaffLinkHolder(raw: unknown): StaffLinkHolder | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const { id, name, job, access, endsAt, signedIn } = raw as Record<string, unknown>;

  return typeof id === 'string' &&
    typeof name === 'string' &&
    (job === null || typeof job === 'string') &&
    (access === null || STAFF_ACCESS.includes(access as StaffAccess)) &&
    typeof endsAt === 'string' &&
    typeof signedIn === 'boolean'
    ? { id, name, job, access: access as StaffAccess | null, endsAt, signedIn }
    : null;
}

function asMembersList(raw: unknown): MembersList | null {
  const list = raw as Record<string, unknown> | null;
  const counts = list?.counts as Record<string, unknown> | null | undefined;

  if (
    !Array.isArray(list?.members) ||
    !Array.isArray(list.faces) ||
    !Array.isArray(list.waiting) ||
    (list.invitations != null && !Array.isArray(list.invitations)) ||
    typeof list.owners !== 'number' ||
    (list.next != null && typeof list.next !== 'string') ||
    MEMBERS_SHOWN.some((show) => typeof counts?.[show] !== 'number')
  )
    return null;

  const members = list.members.map(asOrganisationMember);
  const faces = list.faces.map(asOrganisationMember);
  const waiting = list.waiting.map(asOrganisationMember);
  const invitations = ((list.invitations as unknown[] | undefined) ?? []).map(asSentInvitation);

  if (
    [...members, ...faces, ...waiting].some((one) => one == null) ||
    invitations.some((one) => one == null)
  )
    return null;

  return {
    members: members as OrganisationMember[],
    next: (list.next as string | null | undefined) ?? null,
    counts: counts as Record<MembersShow, number>,
    owners: list.owners,
    faces: faces as OrganisationMember[],
    waiting: waiting as OrganisationMember[],
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
    withheldUntilLinked: stringList(candidate.withheldUntilLinked) ?? [],
    onAnEvent: stringList(candidate.onAnEvent) ?? [],
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

function asRulesMember(entry: unknown): RulesMember | null {
  const member = (entry ?? {}) as Record<string, unknown>;
  const role = asMemberRole(member.role);

  return typeof member.userId === 'string' && typeof member.name === 'string' && role != null
    ? { userId: member.userId, name: member.name, role }
    : null;
}

/** Undefined when it is there but malformed, null when it is not given. */
function asRulesShort(raw: unknown): RulesShort | null | undefined {
  if (raw == null) return null;

  const short = raw as Record<string, unknown>;

  if (typeof short.count !== 'number' || !Array.isArray(short.named)) return undefined;

  const named = short.named.map(asRulesMember);

  return named.every((member) => member != null)
    ? { count: short.count, named: named as RulesMember[] }
    : undefined;
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
  const passwordOnly = asRulesShort(page.passwordOnly);
  const withoutTwoFactor = asRulesShort(page.withoutTwoFactor);

  if (choices == null || changes == null || changes.some((change) => change == null)) return null;
  if (passwordOnly === undefined || withoutTwoFactor === undefined) return null;

  return {
    ...rules,
    inactivityChoices: choices,
    changes: changes as SignInRuleChange[],
    passwordOnly,
    withoutTwoFactor,
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
      thisDevice: session.thisDevice === true,
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

function asMinimumAppVersions(raw: unknown): MinimumAppVersions | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const { ios, android } = raw as Record<string, unknown>;

  if (ios !== null && typeof ios !== 'string') return null;
  if (android !== null && typeof android !== 'string') return null;

  return { ios, android };
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
    phone: asPhoneHint(body.phone),
    factors: asHeldFactors(body.factors),
  };
}

function asHeldFactors(raw: unknown): HeldFactors {
  const held = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  return { app: held.app !== false, passkeys: held.passkeys === true };
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
    typeof candidate.userId !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.email !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    userId: candidate.userId,
    name: candidate.name,
    email: candidate.email,
    provedPhone: candidate.provedPhone === true,
    own: candidate.own === true,
    organisations: strings(candidate.organisations),
    organisationIds: strings(candidate.organisationIds),
    askedAt: optionalString(candidate.askedAt),
    asked: optionalString(candidate.asked),
    expiresAt: optionalString(candidate.expiresAt),
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

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.category !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    category: candidate.category,
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

export function asNotificationRead(raw: unknown): NotificationRead | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.unreadCount !== 'number') return null;
  if (candidate.readAll === true) return { id: null, unreadCount: candidate.unreadCount };
  if (typeof candidate.readId === 'string') {
    return { id: candidate.readId, unreadCount: candidate.unreadCount };
  }
  if (typeof candidate.removedId === 'string') {
    return { id: candidate.removedId, unreadCount: candidate.unreadCount, removed: true };
  }
  const updated = asNotificationItem(candidate.updated);
  if (updated != null) return { id: updated.id, unreadCount: candidate.unreadCount, updated };

  return null;
}

export function asNotificationArrival(raw: unknown): NotificationArrival | null {
  const item = asNotificationItem(raw);
  const unreadCount = (raw as { unreadCount?: unknown } | null)?.unreadCount;
  if (item == null || typeof unreadCount !== 'number') return null;

  return { item, unreadCount };
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

function together(): never {
  throw new Error(
    'The API answered an action on many guests in a shape this client does not know. Check GuestsTogetherController in services/api.',
  );
}
