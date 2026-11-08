import { tokenText } from './TokenText.ts';

/** sc-3960's sample, not spec: the people in To (Coming) that Preview as offers, as the boards draw them. */
export type PreviewKey = 'bisi' | 'camille' | 'kemi' | 'kwame' | 'lucia';
export type PreviewLanguage = 'en' | 'es' | 'fr';
/** Where their language comes from, in sc-3790's order: their page, the host, or the organisation. */
export type LanguageFrom = 'chose' | 'set' | 'organisation';

export interface PreviewPerson {
  key: PreviewKey;
  name: string;
  language: PreviewLanguage;
  greetAs: string | null;
  from: LanguageFrom;
}

export const PREVIEW_PEOPLE: Record<PreviewKey, PreviewPerson> = {
  bisi: {
    key: 'bisi',
    name: 'Bisi Adewale',
    language: 'en',
    greetAs: 'Auntie Bisi',
    from: 'organisation',
  },
  camille: { key: 'camille', name: 'Camille Dubois', language: 'fr', greetAs: null, from: 'chose' },
  kemi: {
    key: 'kemi',
    name: 'Kemi Bankole',
    language: 'en',
    greetAs: 'Kemi "KB" <Bankole> & Co',
    from: 'set',
  },
  kwame: { key: 'kwame', name: 'Kwame Mensah', language: 'en', greetAs: null, from: 'set' },
  lucia: { key: 'lucia', name: 'Lucía Ortega', language: 'es', greetAs: null, from: 'set' },
};

export const CLOSING_LINES =
  'Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.';

/** `previewChose` and the states around it: Greeting and Date as tokens. */
export const DATED_BODY = `${tokenText('Greeting')}, a few things before ${tokenText('Date')}. ${CLOSING_LINES}`;

/** `typedBraces`: an inserted Greeting, and later a `{Greeting}` the host typed, which stays text. */
export const BRACED_BODY = `${tokenText('Greeting')}, a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. {Greeting}, if anything changes for you, answer here.`;

export const PLAIN_BODY = `A few things before Thursday. ${CLOSING_LINES}`;

/** For a French reader, the page's and the notices' own words as length stand-ins, not [fr]'s words. */
export const FRENCH = {
  noticeSubject: '[Adaeze & Tunde’s wedding : un message de Adaeze Obi et Tunde Bakare]',
  noticeBody:
    '[Adaeze Obi et Tunde Bakare vous ont envoyé un message à propos de Adaeze & Tunde’s wedding. Il est sur votre page.]',
  readOnYourPage: '[Le lire sur votre page]',
} as const;
