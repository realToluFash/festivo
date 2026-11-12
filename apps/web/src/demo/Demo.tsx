import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { NotFound } from '../routes/public/NotFound.tsx';
import { offButton } from '../offButton.ts';
import { offField } from '../offField.ts';
import { BoardPage, OrLine, Providers } from './BoardPage.tsx';
import { Calendar } from './Calendar.tsx';
import { CALENDAR_PAGES } from './calendar.ts';
import { CREATE_PAGES } from './createOrg.ts';
import { DOOR_PAGES } from './doorCode.ts';
import { NO_ORG_PAGE } from './noOrg.ts';
import { EventPage } from './EventPage.tsx';
import { Events } from './Events.tsx';
import { NewEventTop } from './NewEventTop.tsx';
import { EVENTS_PAGES } from './events.ts';
import { ACCOUNT_PAGES } from './account.ts';
import { DATA_CONTROL_PAGES } from './dataControlPages.ts';
import { GENERAL_PAGES } from './general.ts';
import { MESSAGES_PAGES } from './messages.ts';
import { SeatingPage } from './Seating.tsx';
import { SEATING_PAGES } from './seating.ts';
import { GetBackInBoard } from './GetBackIn.tsx';
import { GuestPage } from './Guest.tsx';
import { GUEST_PAGES } from './guest.ts';
import { GUEST_KITCHEN_PAGES } from './guestKitchen.ts';
import { GUEST_DAY_PAGES } from './guestDay.ts';
import { GUEST_NOTE_PAGES } from './guestNote.ts';
import { Guests } from './Guests.tsx';
import { GUESTS_PAGES } from './guests.ts';
import { KitchenPage } from './Kitchen.tsx';
import { MenuPage } from './MenuServed.tsx';
import { MENU_PAGES } from './menuServed.ts';
import { CHANGES_PAGES, KITCHEN_PAGES, PARTS_PAGES } from './kitchen.ts';
import { LegalPage } from './Legal.tsx';
import { LEGAL_PAGES } from './legal.ts';
import { NewAccountBoard } from './NewAccount.tsx';
import { NOTIFICATIONS_PAGES } from './notifications.ts';
import { PassPage } from './Pass.tsx';
import { PASS_PAGES } from './pass.ts';
import { QueuePage } from './Queue.tsx';
import { HowItsGoingPage } from './HowItsGoing.tsx';
import { SERVICE_STATES, SERVICE_STATE_WHAT } from './howItsGoing.ts';
import { ServiceRoomPage } from './ServiceRoom.tsx';
import { ROOM_STATES, ROOM_STATE_WHAT } from './serviceRoom.ts';
import { QUEUE_STATES, type QueueStateName } from './queue.ts';
import { StationsPage } from './Stations.tsx';
import { STATIONS_PAGES } from './stations.ts';
import { TeamPage } from './Team.tsx';
import { TEAM_STATES, type TeamStateName } from './team.ts';
import { leave } from './chosenScheme.ts';
import { PERSONALISATION_PAGES } from './personalisation.ts';
import { SECURITY_PAGES } from './security.ts';
import { Notice } from './parts.tsx';
import { People } from './People.tsx';
import { PEOPLE_PAGES } from './people.ts';
import { Redeem } from './Redeem.tsx';
import { REDEEM_PAGES } from './redeem.ts';
import { Settings } from './Settings.tsx';
import { SETTINGS_PAGES } from './settings.ts';
import { SIGN_IN_RULES_PAGES } from './signInRules.ts';
import { SWITCHER_PAGES } from './switcher.ts';
import { QUOTES_PAGES, forgetBudget } from './quotes.ts';
import { BUDGET_PAGES } from './budgetPages.ts';
import { DECIDE_PAGES } from './decide.ts';
import { PAYERS_PAGES } from './payers.ts';
import { PAYMENTS_PAGES } from './payments.ts';
import { PLAN_PAGES } from './plan.ts';
import { SHARE_PAGES } from './share.ts';
import { ShareRecipient } from './ShareRecipient.tsx';
import { TEMPLATES_PAGES } from './templates.ts';
import { Today } from './Today.tsx';
import { TwoFactorBoard } from './TwoFactor.tsx';
import { Unsubscribe } from './Unsubscribe.tsx';
import { UNSUBSCRIBE_PAGES } from './unsubscribe.ts';
import { VendorsMoved } from './Vendors.tsx';
import { VENDORS_PAGES } from './vendors.ts';
import { WaysInBoard } from './WaysIn.tsx';
import {
  type FieldLines,
  GET_BACK_IN_PAGES,
  LOCK_MS,
  NEW_ACCOUNT_PAGES,
  SAMPLE,
  TWO_FACTOR_PAGES,
  WAYS_IN_PAGES,
  backIn,
  fieldLines,
  refuse,
  samplePair,
  timeOfDay,
  twoFactorAt,
} from './rules.ts';
import './demo.css';

const BUSY_MS = 900;

type SignInNotice = { title: string; body: string };

/** The states the board draws, each opened from the demo's home. */
const TODAY_MOMENTS: { key: string; name: string }[] = [
  { key: 'plan', name: 'A planning day' },
  { key: 'plan&invites=none', name: 'A planning day, invitations not sent' },
  { key: 'plan&starts=later', name: 'A planning day, the event starts later today' },
  { key: 'plan&week=rows', name: 'A planning day, events sharing days in rows' },
  { key: 'planNow', name: 'A planning day, built now' },
  { key: 'day', name: 'The event day' },
  { key: 'dayNow', name: 'The event day, built now' },
  { key: 'quiet', name: 'A quiet week' },
  { key: 'first', name: 'A first run' },
  { key: 'firstAsk', name: 'A first run, without Create events' },
];

/** `fillsEmail`: the sign-in knew whose it was, so Email arrives filled. */
const SIGN_IN_STATES: { key: string; name: string; notice?: SignInNotice; fillsEmail?: true }[] = [
  { key: 'first-visit', name: 'Signed out, first visit' },
  {
    key: 'signed-out',
    name: 'You were signed out',
    notice: { title: 'You were signed out', body: 'Sign in again to carry on.' },
  },
  {
    key: 'code-timed-out',
    name: 'That sign-in timed out',
    notice: { title: 'That sign-in timed out', body: 'Sign in again to carry on.' },
    fillsEmail: true,
  },
  {
    key: 'rule',
    name: 'Signed out by Ire Events’ rule',
    notice: {
      title: 'Signed out by Ire Events’ rule',
      body: 'Ire Events signs people out after 30 days without use. Sign in again to carry on.',
    },
    fillsEmail: true,
  },
  {
    key: 'google-failed',
    name: 'Google sign-in did not work',
    notice: {
      title: 'Google sign-in did not work',
      body: 'Nothing was changed. Try Google again, or sign in with your email and password.',
    },
  },
  {
    key: 'failed',
    name: 'Signing in did not work',
    notice: {
      title: 'Signing in did not work',
      body: 'Something went wrong on the way. Try again in a moment.',
    },
  },
  { key: 'locked', name: 'Too many tries' },
  {
    key: 'provider-only',
    name: 'Ire Events signs in with Google or Apple only',
    notice: {
      title: 'Ire Events signs in with Google or Apple only',
      body: 'Password sign-in is off in Ire Events. Use Google or Apple instead.',
    },
    fillsEmail: true,
  },
];

export default function Demo() {
  const { state } = useLocation() as { state: { from?: string } | null };
  const [from] = useState(() => state?.from ?? '/sign-in');

  useEffect(() => leave, []);

  return (
    <Routes>
      <Route index element={<DemoHome from={from} />} />
      <Route path="sign-in" element={<SignInBoard />} />
      <Route path="create-account" element={<NewAccountBoard />} />
      <Route path="get-back-in" element={<GetBackInBoard />} />
      <Route path="two-factor" element={<TwoFactorBoard />} />
      <Route path="ways-in" element={<WaysInBoard />} />
      <Route path="terms" element={<LegalPage doc="terms" />} />
      <Route path="privacy" element={<LegalPage doc="privacy" />} />
      {/* Kept so a link to /demo/signed-in opens Today rather than the not-found page. */}
      <Route path="signed-in" element={<Navigate to="/demo/today" replace />} />
      <Route path="today" element={<Today />} />
      <Route path="events" element={<Events />} />
      <Route path="events/new" element={<NewEventTop />} />
      <Route path="events/:id" element={<EventPage />} />
      <Route path="events/:id/dates" element={<EventPage dates />} />
      <Route path="events/:id/messages" element={<EventPage messages />} />
      <Route path="events/:id/seating" element={<SeatingPage />} />
      <Route path="events/:id/kitchen" element={<KitchenPage />} />
      <Route path="events/:id/menu" element={<MenuPage />} />
      <Route path="events/:id/staff" element={<StationsPage />} />
      <Route path="calendar" element={<Calendar />} />
      <Route path="settings" element={<Settings />} />
      <Route path="settings/members" element={<Settings />} />
      <Route path="settings/account" element={<Settings open="account" />} />
      <Route path="settings/security" element={<Settings open="security" />} />
      <Route path="settings/notifications" element={<Settings open="notifications" />} />
      <Route path="settings/personalisation" element={<Settings open="personalisation" />} />
      <Route path="settings/general" element={<Settings open="general" />} />
      <Route path="settings/sign-in-rules" element={<Settings open="signInRules" />} />
      <Route
        path="settings/data"
        element={<KeepQuery to="settings/data-and-control/delete-guest-data" />}
      />
      <Route path="settings/data-and-control" element={<Settings open="data" />} />
      <Route
        path="settings/data-and-control/email-domains"
        element={<Settings open="data" page="emailDomains" />}
      />
      <Route
        path="settings/data-and-control/audit-log"
        element={<Settings open="data" page="auditLog" />}
      />
      <Route
        path="settings/data-and-control/export"
        element={<Settings open="data" page="export" />}
      />
      <Route
        path="settings/data-and-control/delete-guest-data"
        element={<Settings open="data" page="deleteGuestData" />}
      />
      <Route
        path="settings/data-and-control/guest-request"
        element={<Settings open="data" page="guestRequest" />}
      />
      <Route path="settings/vendors" element={<Settings open="vendors" />} />
      <Route path="settings/payment-reminders" element={<Settings open="vendors" reminders />} />
      <Route path="people" element={<People />} />
      <Route path="redeem" element={<Redeem />} />
      <Route path="vendors" element={<VendorsMoved />} />
      <Route path="share/:scope" element={<ShareRecipient />} />
      <Route path="unsubscribe" element={<Unsubscribe />} />
      <Route path="guest" element={<GuestPage />} />
      <Route path="guests" element={<Guests />} />
      <Route path="pass" element={<PassPage />} />
      <Route path="queue" element={<QueuePage />} />
      <Route path="team" element={<TeamPage />} />
      <Route path="how-its-going" element={<HowItsGoingPage />} />
      <Route path="service-room" element={<ServiceRoomPage />} />
      <Route path="later" element={<Later />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function DemoHome({ from }: { from: string }) {
  const navigate = useNavigate();

  useEffect(() => forgetBudget(), []);

  return (
    <main id="content" className="demo-home">
      <header className="demo-home-header">
        <h1>Design demo</h1>
        <button className="button" type="button" onClick={() => void navigate(from)}>
          Close
        </button>
      </header>
      <p className="demo-home-line">
        The designs, working on sample data. Nothing is sent. Sign in with{' '}
        <strong>{SAMPLE.email}</strong> and <strong>{SAMPLE.password}</strong>. The code from the
        email or the phone is <strong>{SAMPLE.code}</strong>. The authenticator’s code is{' '}
        <strong>{SAMPLE.authenticator}</strong>, a recovery code <strong>{SAMPLE.recovery}</strong>,
        and <strong>{SAMPLE.usedRecovery}</strong> one used already.
      </p>

      <section className="demo-home-page" aria-labelledby="demo-page-29">
        <h2 id="demo-page-29">29 · Today · where signing in lands</h2>
        <h3>Today in B Confetti · desktop</h3>
        <ul className="demo-home-rows">
          {TODAY_MOMENTS.map((moment) => (
            <li key={moment.key}>
              <Link className="demo-home-row" to={`today?moment=${moment.key}`}>
                <span>{moment.name}</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
        <h3>Events in A · Summary first · desktop</h3>
        <BoardPages pages={EVENTS_PAGES} />
        <h3>The organisation switcher in B · Places · desktop</h3>
        <BoardPages pages={SWITCHER_PAGES} />
        <h3>The Calendar in B · A · Weeks as lanes · desktop</h3>
        <BoardPages pages={CALENDAR_PAGES} />
        <h3>Create an organisation in B · A short walk · desktop</h3>
        <BoardPages pages={CREATE_PAGES} />
        <h3>Guest’s page in A · The cover card · phone, tablet and desk</h3>
        <BoardPages pages={GUEST_PAGES} />
        <h3>The kitchen step on the guest’s page · sc-3778 · phone, tablet and desk</h3>
        <BoardPages pages={GUEST_KITCHEN_PAGES} />
        <h3>The host’s arrival note on the guest’s page · sc-24385 · phone, tablet and desk</h3>
        <BoardPages pages={GUEST_NOTE_PAGES} />
        <h3>The guest’s page on the event’s day · sc-24381 · phone, tablet and desk</h3>
        <BoardPages pages={GUEST_DAY_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-30">
        <h2 id="demo-page-30">30 · Guests · the planner’s side</h2>
        <h3>Guests in A · Summary first · desktop</h3>
        <BoardPages pages={GUESTS_PAGES} />
        <h3>Final numbers due and the kitchen’s copies, in Guests A · desktop</h3>
        <BoardPages pages={KITCHEN_PAGES} />
        <h3>Changes since the kitchen’s last copy, in Guests A · desktop</h3>
        <BoardPages pages={CHANGES_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-32">
        <h2 id="demo-page-32">32 · Menu</h2>
        <h3>How a course is served, and a dish’s parts · sc-34230 · desktop</h3>
        <BoardPages pages={MENU_PAGES} />
      </section>
      <section className="demo-home-page" aria-labelledby="demo-page-32-kitchen">
        <h2 id="demo-page-32-kitchen">32 · Menu · the kitchen sheet’s parts</h2>
        <h3>Each part of a course, and each table’s platters · sc-34244 · desktop and A4</h3>
        <BoardPages pages={PARTS_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-34">
        <h2 id="demo-page-34">34 · Staffing</h2>
        <h3>Stations and leads, what each station dishes, the walking order (sc-3910) · desktop</h3>
        <BoardPages pages={STATIONS_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-35">
        <h2 id="demo-page-35">35 · Service · the pass</h2>
        <h3>The pass’s print controls, in page 35’s language · desktop, Printing in version B</h3>
        <BoardPages pages={PASS_PAGES} />
        <h3>Service · the section’s queue (sc-36033) · desktop</h3>
        <BoardPages pages={QUEUE_PAGES} />
        <h3>Service · Team, the floor lead moves someone (sc-36034) · desktop</h3>
        <BoardPages pages={TEAM_PAGES} />
        <h3>Service · How it’s going (sc-34107) · desktop</h3>
        <BoardPages pages={HOW_ITS_GOING_PAGES} />
        <h3>Service · the whole room as a plan or a list (sc-4026) · desktop</h3>
        <BoardPages pages={ROOM_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-81">
        <h2 id="demo-page-81">81 · Budget and costs</h2>
        <h3>Vendors in A · Summary first · Settings › Vendors · desktop</h3>
        <BoardPages pages={VENDORS_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-81-quotes">
        <h2 id="demo-page-81-quotes">81 · Budget and costs · quotes and what is due</h2>
        <h3>Quotes in A · Summary first · desktop</h3>
        <BoardPages pages={QUOTES_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-81-budget">
        <h2 id="demo-page-81-budget">81 · Budget and costs · Budget in A · Summary first</h2>
        <h3>The Budget page, the ceiling, payments and margin · desktop</h3>
        <BoardPages pages={BUDGET_PAGES} />
        <h3>Payments on a vendor’s page, the reminder setting and the shapes · desktop</h3>
        <BoardPages pages={PAYMENTS_PAGES} />
        <h3>Who is paying · desktop</h3>
        <BoardPages pages={PAYERS_PAGES} />
        <h3>Against plan · desktop and A4</h3>
        <BoardPages pages={PLAN_PAGES} />
        <h3>Templates and calibration · desktop</h3>
        <BoardPages pages={TEMPLATES_PAGES} />
        <h3>What a decision costs, in Add guest · desktop</h3>
        <BoardPages pages={DECIDE_PAGES} />
        <h3>Share links, and the signed-out share · desktop, phone and tablet</h3>
        <BoardPages pages={SHARE_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-36">
        <h2 id="demo-page-36">36 · Messaging · Messages on an event</h2>
        <h3>Messaging in B · Conversations · desktop</h3>
        <BoardPages pages={MESSAGES_PAGES} />
        <h3>The unsubscribe page, signed out · phone, tablet and desk</h3>
        <BoardPages pages={UNSUBSCRIBE_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-31">
        <h2 id="demo-page-31">31 · Venue and seating · Seating on an event</h2>
        <h3>Seating in A · The room · desktop</h3>
        <BoardPages pages={SEATING_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-28">
        <h2 id="demo-page-28">28 · Organisations and access · Settings at a desk</h2>
        <h3>Settings in B · Summary first · desktop</h3>
        <BoardPages pages={SETTINGS_PAGES} />
        <h3>Your account in B · Summary first · desktop</h3>
        <BoardPages pages={ACCOUNT_PAGES} />
        <h3>Security in B · Summary first · desktop</h3>
        <BoardPages pages={SECURITY_PAGES} />
        <h3>Notification settings in B · Summary first · desktop</h3>
        <BoardPages pages={NOTIFICATIONS_PAGES} />
        <h3>Personalisation in A · Swatches · desktop</h3>
        <BoardPages pages={PERSONALISATION_PAGES} />
        <h3>General in B · Summary first · desktop</h3>
        <BoardPages pages={GENERAL_PAGES} />
        <h3>Sign-in rules in B · Where you stand · desktop</h3>
        <BoardPages pages={SIGN_IN_RULES_PAGES} />
        <h3>Data and control in B · One place · desktop</h3>
        <BoardPages pages={DATA_CONTROL_PAGES} />
        <h3>People on an event · desktop</h3>
        <BoardPages pages={PEOPLE_PAGES} />
        <h3>Working an event without joining in A · The door code · desktop</h3>
        <BoardPages pages={[...DOOR_PAGES, NO_ORG_PAGE]} />
        <h3>The door code’s redeem pages, signed out · phone, tablet and desk</h3>
        <BoardPages pages={REDEEM_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-27">
        <h2 id="demo-page-27">27 · Sign in · desktop polish</h2>
        <h3>Sign in · desktop · second pass</h3>
        <ul className="demo-home-rows">
          {SIGN_IN_STATES.map((state) => (
            <li key={state.key}>
              <Link className="demo-home-row" to={`sign-in?state=${state.key}`}>
                <span>{state.name}</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>

        <h3>Create an account · desktop</h3>
        <BoardPages pages={NEW_ACCOUNT_PAGES} />

        <h3>Getting back in · desktop</h3>
        <BoardPages pages={GET_BACK_IN_PAGES} />

        <h3>Two-factor · desktop</h3>
        <BoardPages pages={TWO_FACTOR_PAGES} />

        <h3>Terms and Privacy · desktop and a phone’s width · sample text</h3>
        <BoardPages pages={LEGAL_PAGES} />

        <h3>Other ways in · desktop</h3>
        <p className="demo-home-line">
          The organisation is <strong>{SAMPLE.organisation}</strong>, and the invitation is from{' '}
          <strong>
            {SAMPLE.inviter}, {SAMPLE.role}
          </strong>
          .
        </p>
        <BoardPages pages={WAYS_IN_PAGES} />
      </section>
    </main>
  );
}

/** An old address keeps working, its query and all: Data is Data and control's page now (sc-560). */
function KeepQuery({ to }: { to: string }) {
  const { search } = useLocation();

  return <Navigate to={`/demo/${to}${search}`} replace />;
}

const QUEUE_WHAT: Record<QueueStateName, string> = {
  populated: 'Section A: Table 10’s owed plate first, Table 5 up next',
  beforeStart: 'Before Start service: the queue can be set now',
  moved: 'After Bring forward on Table 4',
  oneTable: 'Section C has one table: no controls, no Build the queue',
  noTables: 'Section E has no tables',
  noManage: 'Viewed without service.manage: no Queue',
  buildEmpty: 'Building Section D’s queue, nothing placed',
  buildPartial: 'Building Section D’s queue, four of five placed',
  buildAll: 'Building Section D’s queue, all five placed',
  offline: 'Offline, after a press',
  conflict: 'Saved after Tobi Adeyemi changed Section D: refused with 412',
  rivalMove: 'Another lead changes the queue before the next press',
  waiterNotice: 'Table 5 brought forward: Kunle’s next table changed',
  waiterSame: 'Row C moved up: Kunle’s next table is still Table 5',
  asWell: 'Kunle is on Section B as well, Table 6 owed since 20:28',
  asWellTie: 'Kunle is on Section B as well, a tie for first',
};

const QUEUE_PAGES = [
  {
    name: 'The floor lead’s section queue, beside the sections',
    states: QUEUE_STATES.map((state) => ({
      to: `/demo/queue?state=${state}`,
      name: QUEUE_WHAT[state],
    })),
  },
];

const TEAM_WHAT: Record<TeamStateName, string> = {
  populated: 'Every section, the Pass and each kitchen station, with who is on it',
  sheetSection: 'Move someone to Section C: only people in Here who can work the floor',
  sheetChosen: 'Kunle chosen: As well, until the lead picks Instead',
  sheetInstead: 'Kunle chosen, Instead: leaves Section A with nobody',
  sheetKitchen: 'Move someone to the Fryer: only people who can work the pass',
  sheetTwo: 'Bisi is on two stations: Instead only',
  sheetBlank: 'Put pressed with nobody chosen',
  movedAsWell: 'Kunle put on Section C as well',
  movedInstead: 'Kunle put on Section C instead: nobody on Section A',
  movedKitchen: 'Tayo put on the Fryer as well as the Grill',
  offline: 'No connection: every Move dashed',
  offlineTried: 'No connection, a Move pressed: it says why',
  conflict: 'Tobi Adeyemi moved Grace Udo first: refused with 409',
  fromAlert: 'Opened from the alert for Section A, left with nobody',
  empty: 'No sections and no kitchen stations',
  noManage: 'Viewed without service.manage: no Team tab',
};

const TEAM_PAGES = [
  {
    name: 'The floor lead’s Team, with the Move panel docked',
    states: TEAM_STATES.map((state) => ({
      to: `/demo/team?state=${state}`,
      name: TEAM_WHAT[state],
    })),
  },
];

const ROOM_PAGES = [
  {
    name: 'The floor lead sees the whole room',
    states: ROOM_STATES.map((state) => ({
      to: `/demo/service-room?state=${state}`,
      name: ROOM_STATE_WHAT[state],
    })),
  },
];

const HOW_ITS_GOING_PAGES = [
  {
    name: 'The floor lead’s view of how service is going',
    states: SERVICE_STATES.map((state) => ({
      to: `/demo/how-its-going?state=${state}`,
      name: SERVICE_STATE_WHAT[state],
    })),
  },
];

function BoardPages({
  pages,
}: {
  pages: readonly { name: string; states: readonly { to: string; name: string }[] }[];
}) {
  return pages.map((page) => (
    <div key={page.name} className="demo-home-group">
      <h4>{page.name}</h4>
      <ul className="demo-home-rows">
        {page.states.map((state) => (
          <li key={state.to}>
            <Link className="demo-home-row" to={state.to}>
              <span>{state.name}</span>
              <span aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  ));
}

function SignInBoard() {
  const [params] = useSearchParams();
  const key = params.get('state') ?? 'first-visit';

  return <SignInForm key={key} state={key} />;
}

/** Where a page sends sign-in from: the email to keep, and whether two-factor was just turned off. */
type Arrival = { email?: string; recovered?: boolean };

function SignInForm({ state }: { state: string }) {
  const navigate = useNavigate();
  const arrival = (useLocation().state as Arrival | null) ?? {};
  const [twoFactor, setTwoFactor] = useState(false);
  const drawn = SIGN_IN_STATES.find((each) => each.key === state);
  const [notice, setNotice] = useState<SignInNotice | null>(drawn?.notice ?? null);
  const [providerOnly, setProviderOnly] = useState(state === 'provider-only');
  const [liftsAt, setLiftsAt] = useState<number | null>(() =>
    state === 'locked' ? Date.now() + LOCK_MS : null,
  );
  const [refusals, setRefusals] = useState(0);
  const [refused, setRefused] = useState(false);
  const [lines, setLines] = useState<FieldLines>({});
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const knownEmail = drawn?.fillsEmail ? SAMPLE.email : arrival.email;
  const locked = liftsAt != null;

  useEffect(() => () => window.clearTimeout(pending.current), []);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(
      () => {
        if (password.current != null) password.current.value = '';
        setNotice(null);
        setLiftsAt(null);
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  function after(then: () => void): void {
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      then();
    }, BUSY_MS);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy || locked) return;

    const typed = { email: email.current?.value ?? '', password: password.current?.value ?? '' };
    const found = fieldLines(typed.email, typed.password);

    setLines(found);
    setRefused(false);
    if (found.email != null || found.password != null) {
      (found.email != null ? email : password).current?.focus();
      return;
    }

    setRevealed(false);
    after(() => {
      if (samplePair(typed.email, typed.password)) {
        if (arrival.recovered === true) void navigate(twoFactorAt('setup'));
        else void navigate(twoFactor ? twoFactorAt('code') : '/demo/today');
        return;
      }

      const next = refuse(refusals, Date.now());
      setRefusals(next.refusals);
      if (next.liftsAt != null) {
        setLiftsAt(next.liftsAt);
        return;
      }

      setRefused(true);
      password.current?.focus();
      password.current?.select();
    });
  }

  function edited(field: keyof FieldLines): void {
    if (lines[field] == null) return;

    const now = fieldLines(email.current?.value ?? '', password.current?.value ?? '');
    setLines((was) => ({ ...was, [field]: now[field] }));
  }

  function provider(): void {
    if (busy) return;

    after(() => void navigate('/demo/today'));
  }

  const until = liftsAt == null ? null : timeOfDay(liftsAt);
  const shown: SignInNotice | null =
    until == null ? notice : { title: 'Too many tries', body: `Try again at ${until}.` };

  return (
    <BoardPage
      controls={
        <label className="demo-switch">
          <input
            type="checkbox"
            role="switch"
            checked={twoFactor}
            onChange={(event) => setTwoFactor(event.target.checked)}
          />
          Demo: this account uses two-factor
        </label>
      }
    >
      <div className="demo-heading">
        <h1>Sign in</h1>
        {shown != null && (
          <Notice
            title={shown.title}
            body={shown.body}
            alert={locked || state.endsWith('failed')}
          />
        )}
      </div>

      {providerOnly ? (
        <>
          <div className="demo-field">
            <label htmlFor="email">Email</label>
            <input className="demo-input" id="email" type="email" value={SAMPLE.email} readOnly />
          </div>
          <Providers busy={busy} onChoose={provider} />
          <p className="demo-muted">
            A rule set by Ire Events: password sign-in is off for everyone in it.
          </p>
          <button
            className="link-button demo-link"
            type="button"
            onClick={() => {
              setProviderOnly(false);
              setNotice(null);
            }}
          >
            Sign in with another account
          </button>
        </>
      ) : (
        <>
          <form className="demo-form" noValidate onSubmit={submit}>
            <div className="demo-fields">
              <div className={lines.email == null ? 'demo-field' : 'demo-field demo-field-wrong'}>
                <label htmlFor="email">Email</label>
                <input
                  ref={email}
                  className="demo-input"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCorrect="off"
                  spellCheck={false}
                  defaultValue={knownEmail}
                  {...offField(busy)}
                  aria-invalid={lines.email != null}
                  aria-describedby={lines.email == null ? undefined : 'email-line'}
                  onChange={() => edited('email')}
                />
                {lines.email != null && (
                  <p className="demo-line" id="email-line">
                    {lines.email}
                  </p>
                )}
              </div>

              <div
                className={lines.password == null ? 'demo-field' : 'demo-field demo-field-wrong'}
              >
                <div className="demo-label-row">
                  <label htmlFor="password">Password</label>
                  <Link
                    className="link-button demo-link"
                    to={backIn('reset')}
                    onClick={(event) => {
                      event.preventDefault();
                      void navigate(backIn('reset'), {
                        state: {
                          email: email.current?.value ?? '',
                          back: `/demo/sign-in?state=${state}`,
                        },
                      });
                    }}
                  >
                    Forgot your password?
                  </Link>
                </div>
                <div className="demo-reveal">
                  <input
                    ref={password}
                    className="demo-input"
                    id="password"
                    name="password"
                    type={revealed ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...offField(busy)}
                    aria-invalid={lines.password != null}
                    aria-describedby={
                      lines.password != null || refused ? 'password-line' : undefined
                    }
                    onChange={() => edited('password')}
                  />
                  <button
                    className="demo-reveal-button"
                    type="button"
                    aria-pressed={revealed}
                    onClick={() => setRevealed((was) => !was)}
                  >
                    {revealed ? 'Hide' : 'Show'}
                  </button>
                </div>
                {(lines.password != null || refused) && (
                  <p className="demo-line" id="password-line" role={refused ? 'alert' : undefined}>
                    {lines.password ?? 'That email and password do not match.'}
                  </p>
                )}
              </div>
            </div>

            <button
              className="button button-primary demo-wide"
              type="submit"
              aria-busy={busy}
              {...offButton(locked)}
            >
              {until != null ? `Try again at ${until}` : busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <OrLine />
          <Providers busy={busy} onChoose={provider} />
        </>
      )}
    </BoardPage>
  );
}

const LATER: Record<string, string> = {
  security: 'Your account › Security',
  calendar: 'Add to calendar',
  meals: 'Your meals · sc-3907',
};

/** The guest's page a stand-in goes back to: the meals to the kitchen step's refusal, the calendar to Coming. */
const GUEST_BACK: Record<string, string> = {
  calendar: '/demo/guest?state=coming',
  meals: '/demo/guest?state=meal_ruled_out',
};

function Later() {
  const [params] = useSearchParams();
  const asked = params.get('screen') ?? '';

  // The stand-ins' old addresses open the pages themselves (sc-28982).
  if (asked === 'terms' || asked === 'privacy') return <Navigate to={`/demo/${asked}`} replace />;

  const screen = LATER[asked] ?? 'Your account › Security';
  const guest = GUEST_BACK[asked];

  // Opened from any footer, signed in or not, so its header offers neither way (sc-29561).
  return (
    <BoardPage end={null}>
      <div className="demo-heading">
        <h1>{screen}</h1>
        <p className="demo-muted">A stand-in: this page comes to the demo at its own step.</p>
      </div>
      <Link className="button demo-wide" to={guest ?? '/demo/sign-in'}>
        {guest != null ? 'Back to the guest’s page' : 'Back to sign in'}
      </Link>
    </BoardPage>
  );
}
