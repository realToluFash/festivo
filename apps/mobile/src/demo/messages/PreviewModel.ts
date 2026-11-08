import { writtenTime } from '../clock.ts';
import {
  LANGUAGE_NAMES,
  LANGUAGE_NAMES_FR,
  LANGUAGE_NAMES_IN_SENTENCE,
} from '../settings/OrganisationWords.ts';
import { DAYS, EVENT, HOSTS, type Token } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';
import { FRENCH, PREVIEW_PEOPLE, type PreviewKey, type PreviewPerson } from './PreviewSample.ts';
import { PW, sayPreview } from './PreviewWords.ts';
import { TOKEN_RUN } from './TokenText.ts';

/** Who the preview is for, whether Preview as is open, and whether it is still being filled in (`held`: as a board, it stays). */
export interface Previewing {
  who: PreviewKey;
  choosing: boolean;
  filling: boolean;
  held: boolean;
}

/** B's preview was Kwame Mensah's, and it still opens on him. */
export const FIRST_PREVIEW: Previewing = {
  who: 'kwame',
  choosing: false,
  filling: false,
  held: false,
};

/** How long a newly chosen guest's preview shows as shapes before it is filled in. */
export const FILLING_MS = 1200;

export const PREVIEW_AS: readonly PreviewPerson[] = Object.values(PREVIEW_PEOPLE).sort((a, b) =>
  a.name.localeCompare(b.name, 'en'),
);

const STARTS: Partial<Record<string, Partial<Previewing>>> = {
  previewAs: { choosing: true },
  previewGreetAs: { who: 'bisi' },
  previewChose: { who: 'camille' },
  previewLoading: { who: 'camille', filling: true, held: true },
  previewMarkup: { who: 'kemi' },
};

/** What a `?state=` of sc-3960 adds to Messages: Insert open, or the person previewed. */
export function previewStart(state: string | null): { preview?: Previewing; inserting?: boolean } {
  if (state === 'insert') return { inserting: true };
  const start = state == null ? undefined : STARTS[state];

  return start == null ? {} : { preview: { ...FIRST_PREVIEW, ...start } };
}

export function previewOf(m: { preview?: Previewing | undefined }): Previewing {
  return m.preview ?? FIRST_PREVIEW;
}

/** Someone new is filled in first; choosing the one shown only closes Preview as. */
export function chosen(now: Previewing, who: PreviewKey): Previewing {
  return { who, choosing: false, filling: who !== now.who, held: false };
}

export type Reader = 'en' | 'fr';

const NAMES: Record<Reader, Record<string, string>> = {
  en: { ...LANGUAGE_NAMES, ...LANGUAGE_NAMES_IN_SENTENCE },
  fr: LANGUAGE_NAMES_FR,
};

export function languageName(code: string, reader: Reader = 'en'): string {
  return NAMES[reader][`languageNames.${code}`] ?? code;
}

export function languageNameInSentence(code: string, reader: Reader = 'en'): string {
  return NAMES[reader][`languageNamesInSentence.${code}`] ?? code;
}

export function optionOf(person: PreviewPerson, reader: Reader = 'en'): string {
  return sayPreview.option(person.name, languageName(person.language, reader));
}

/** The event's day in the guest's language by CLDR (sc-3960's AC); outside English a stand-in, so bracketed. */
function eventDay(person: PreviewPerson, options: Intl.DateTimeFormatOptions): string {
  const english = person.language === 'en';
  const words = new Intl.DateTimeFormat(english ? 'en-US' : person.language, {
    ...options,
    timeZone: 'UTC',
  }).format(new Date(`${DAYS.sched}T12:00:00Z`));

  return english ? words : `[${words}]`;
}

export function dateFor(person: PreviewPerson): string {
  return eventDay(person, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function coverFor(person: PreviewPerson): string {
  const day = eventDay(person, { weekday: 'short', month: 'short', day: 'numeric' });

  return `${day} · ${writtenTime('18:00', person.language)} · The Landmark`;
}

const FILL: Record<Token, (person: PreviewPerson) => string> = {
  Greeting: (person) => person.greetAs ?? person.name,
  Event: () => EVENT,
  Date: dateFor,
  Hosts: () => HOSTS,
};

export function filledAs(text: string, person: PreviewPerson): string {
  return text.replace(TOKEN_RUN, (_, token: Token) => FILL[token](person));
}

export function greetingFor(person: PreviewPerson): string {
  return FILL.Greeting(person);
}

export function holdsToken(text: string, token: Token | null = null): boolean {
  return [...text.matchAll(TOKEN_RUN)].some((run) => token == null || run[1] === token);
}

/** Braces the host typed: a `{…}` left once the inserted tokens are taken out. */
export function typedBraces(text: string): boolean {
  return /\{[^{}]*\}/u.test(text.replace(TOKEN_RUN, ''));
}

export function languageLine(person: PreviewPerson, reader: Reader = 'en'): string {
  const language = languageNameInSentence(person.language, reader);
  if (person.from === 'chose') return sayPreview.chose(language);
  if (person.from === 'organisation') return sayPreview.organisation(language);

  return say.inLanguage(language);
}

/** The lines under the preview, in sc-3960's order. */
export function previewLines(text: string, person: PreviewPerson): string[] {
  const greeted =
    person.greetAs == null ? say.greetedAs(person.name) : sayPreview.greetedAs(person.greetAs);

  return [
    ...(holdsToken(text, 'Greeting') ? [greeted] : []),
    languageLine(person),
    W.onlyOurs,
    ...(typedBraces(text) ? [PW.braces] : []),
    ...(holdsToken(text) ? [] : [PW.noTokens]),
  ];
}

export function noticeFor(person: PreviewPerson): {
  subject: string;
  body: string;
  button: string;
} {
  if (person.language === 'fr')
    return {
      subject: FRENCH.noticeSubject,
      body: FRENCH.noticeBody,
      button: FRENCH.readOnYourPage,
    };

  return {
    subject: say.noticeSubject(EVENT, HOSTS),
    body: say.noticeBody(HOSTS, EVENT),
    button: W.readOnYourPage,
  };
}
