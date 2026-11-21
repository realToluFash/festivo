import type { Channel, Draft, MessagesState, Segment } from './messages.ts';

export type PersonId = 'amaka' | 'bisi' | 'camille' | 'kemi' | 'kwame' | 'lucia';
export type Language = 'en' | 'fr' | 'es';

/** sc-3790's three steps: chosen on their page, set by the host, or the organisation's. */
export type LanguageFrom = 'chose' | 'set' | 'organisation';

export interface Person {
  id: PersonId;
  name: string;
  greetAs: string | null;
  language: Language;
  from: LanguageFrom;
  has: readonly Channel[];
  /** Ire Events has never texted their number, so the text ends on the STOP line (sc-3946). */
  firstText?: boolean;
}

/** The people in To (Coming) that Preview as offers, A to Z (STATES.md, sc-3960). */
export const PEOPLE: readonly Person[] = [
  {
    id: 'amaka',
    name: 'Amaka Eze',
    greetAs: null,
    language: 'en',
    from: 'organisation',
    has: ['sms'],
    firstText: true,
  },
  {
    id: 'bisi',
    name: 'Bisi Adewale',
    greetAs: 'Auntie Bisi',
    language: 'en',
    from: 'organisation',
    has: ['email'],
  },
  {
    id: 'camille',
    name: 'Camille Dubois',
    greetAs: null,
    language: 'fr',
    from: 'chose',
    has: ['email'],
  },
  {
    id: 'kemi',
    name: 'Kemi Bankole',
    greetAs: 'Kemi "KB" <Bankole> & Co',
    language: 'en',
    from: 'set',
    has: ['email'],
  },
  {
    id: 'kwame',
    name: 'Kwame Mensah',
    greetAs: null,
    language: 'en',
    from: 'set',
    has: ['email', 'sms'],
  },
  {
    id: 'lucia',
    name: 'Lucía Ortega',
    greetAs: null,
    language: 'es',
    from: 'set',
    has: ['email', 'sms'],
  },
];

export const FIRST_PERSON: PersonId = 'kwame';

const PARKING_LINE = 'Parking is on Marylebone Road, and the dress code is formal.';

/** `typedBraces`: an inserted Greeting, then a typed {Greeting} that stays text. */
export const TYPED_BRACES: readonly Segment[] = [
  { kind: 'token', token: 'greeting' },
  {
    kind: 'text',
    text: `, a few things before Thursday. ${PARKING_LINE} {Greeting}, if anything changes for you, answer here.`,
  },
];

export const NOTHING_TO_FILL: readonly Segment[] = [
  {
    kind: 'text',
    text: `A few things before Thursday. ${PARKING_LINE} If anything changes for you, answer here.`,
  },
];

export const WITH_DATE: readonly Segment[] = [
  { kind: 'token', token: 'greeting' },
  { kind: 'text', text: ', a few things before ' },
  { kind: 'token', token: 'date' },
  { kind: 'text', text: `. ${PARKING_LINE} If anything changes for you, answer here.` },
];

/** What each of sc-3960's states writes into the draft the seed opens. */
export function previewDraftOf(state: MessagesState): Partial<Draft> {
  switch (state) {
    case 'insert':
      return { opens: 'insert' };
    case 'previewAs':
      return { step: 'preview', opens: 'previewAs' };
    case 'previewGreetAs':
      return { step: 'preview', previewAs: 'bisi' };
    case 'previewChose':
      return { step: 'preview', body: WITH_DATE, previewAs: 'camille' };
    case 'previewLoading':
      return { step: 'preview', body: WITH_DATE, previewAs: 'camille', opens: 'filling' };
    case 'previewMarkup':
      return { step: 'preview', previewAs: 'kemi' };
    case 'typedBraces':
      return { body: TYPED_BRACES };
    case 'previewBraces':
      return { step: 'preview', body: TYPED_BRACES };
    case 'noTokens':
      return { step: 'preview', body: NOTHING_TO_FILL };
    default:
      return {};
  }
}
