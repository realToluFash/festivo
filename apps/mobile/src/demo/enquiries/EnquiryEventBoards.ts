import { CREATED_ID } from '../events/NewEvent.tsx';
import {
  EVENT_ENQUIRIES,
  FORM_ENQUIRY,
  type FormState,
  type OriginState,
  type PageState,
} from './EnquiryToEventModel.ts';

const BISI = EVENT_ENQUIRIES.bisi.id;

const PAGE: readonly [PageState, string, string][] = [
  [
    'open-admin',
    'Enquiry · Create event',
    'Folake, an Owner: Create event under the head, beside Close as lost… on an iPad on its side',
  ],
  [
    'open-member',
    'Enquiry · a Member',
    'Tunde, assigned: no Create event, the line saying who creates it',
  ],
  ['won', 'Enquiry · Won', 'The Won card and the event it became, nothing to press but its link'],
  [
    'won-has-event',
    'Enquiry · Reopen, once it has an event',
    'Not reopened: it stays Won; the demo’s control shows the stale Lost page',
  ],
  [
    'lost-has-event',
    'Enquiry · Close as lost, once it has an event',
    'Not closed: it stays Won; the demo’s control shows the stale Open page',
  ],
  [
    'not-open',
    'Enquiry · after Create on a stale New event',
    'Lost as it now is, Not created first, the title in focus',
  ],
  [
    'event-deleted',
    'Enquiry · its event deleted',
    'Open again, the notice first, Create event offered again',
  ],
];

const FORM: readonly [FormState, string, string][] = [
  ['filled', 'New event · filled', 'Bisi’s enquiry: every field, times empty, Lead Tunde Bakare'],
  ['sparse', 'New event · a sparse enquiry', 'Chinedu: his name and host only, no Lead'],
  ['long', 'New event · long words', 'The name, venue and host cut whole, 120 of 120 characters'],
  ['date-passed', 'New event · a passed date', 'Kunle’s Nov 14: filled as it is, no warning'],
  ['lead-member', 'New event · Lead', 'The Lead block in view: Change and Remove'],
  ['lead-removed', 'New event · Lead removed', 'No lead, and Choose a lead'],
  ['lead-none', 'New event · assigned to an Admin', 'Lucía: no Lead block, EUR from the budget'],
  ['lead-left', 'New event · a Member who has left', 'Femi’s, assigned to Sade: no Lead block'],
  ['currency-from-budget', 'New event · the budget’s currency', 'Ada: GBP, from the budget'],
  [
    'currency-not-offered',
    'New event · Kenji’s yen',
    'The app offers JPY, so it stays the budget’s; see the report',
  ],
  ['refused', 'New event · Create refused', 'Times still empty: Starts and Ends, 2 fields'],
  ['saving', 'New event · creating', '14:00 to 22:00 chosen: Creating…'],
  [
    'not-open',
    'New event · enquiry closed meanwhile',
    'Create event leaves for the enquiry, Lost, with Not created first',
  ],
  ['forbidden', 'New event · not allowed', 'Not created: only an owner or admin'],
];

const ORIGIN: readonly [OriginState, string, string][] = [
  [
    'from-enquiry',
    'Event · From an enquiry',
    'The draft Bisi Adebayo · Anniversary, its link last',
  ],
  ['from-enquiry-hidden', 'Event · enquiry not visible', 'Another Member: no line'],
  ['free-plan', 'Event · on Free', 'The organisation moved to Free: no line'],
];

/** sc-31232 on page 31221 · Enquiries: the enquiry's page, New event filled from it, and the draft it made. */
export const ENQUIRY_EVENT_BOARDS: readonly { title: string; what: string; href: string }[] = [
  ...PAGE.map(([state, title, what]) => ({
    title,
    what,
    href: `/demo/enquiries/${BISI}?state=${state}`,
  })),
  ...FORM.map(([state, title, what]) => ({
    title,
    what,
    href: `/demo/enquiries/${EVENT_ENQUIRIES[FORM_ENQUIRY[state]].id}?new=${state}`,
  })),
  ...ORIGIN.map(([state, title, what]) => ({
    title,
    what,
    href: `/demo/events/${CREATED_ID}?state=${state}`,
  })),
];
