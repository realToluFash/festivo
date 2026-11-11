import { PILL_BESIDE_TABS } from '../../kit/frameBand.ts';
import { tokens } from '../../theme/tokens.ts';

export type PillFitLanguage = 'en' | 'fr' | 'es' | 'pt';

export const LANGUAGES: readonly { key: PillFitLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
  { key: 'es', label: 'Spanish' },
  { key: 'pt', label: 'Portuguese' },
];

export const ORGANISATIONS = [
  { key: 'qa', label: 'QA Organisation' },
  { key: 'long', label: 'Internationalisation' },
] as const;

export type PillFitOrganisation = (typeof ORGANISATIONS)[number]['key'];

export function languageOf(name: string | undefined): PillFitLanguage {
  return LANGUAGES.find((language) => language.key === name)?.key ?? 'en';
}

export function organisationOf(name: string | undefined): PillFitOrganisation {
  return ORGANISATIONS.find((organisation) => organisation.key === name)?.key ?? 'qa';
}

export type Sending = 'accept' | 'decline' | null;

export function sendingOf(name: string | undefined): Sending {
  return name === 'accept' || name === 'decline' ? name : null;
}

export function waitingOf(count: string | undefined): 0 | 1 | 2 {
  return count === '0' ? 0 : count === '2' ? 2 : 1;
}

/** What the pill draws around its words: its start, the 28 tile, a gap each side of the words, the caret and its end (`OrgPill`). */
export const PILL_CHROME =
  tokens.spaceSm + 28 + tokens.spaceSm + tokens.spaceSm + 14 + tokens.spacePillEnd;

/** The invitation line's ring and the gap after it, before its words. */
export const WAITING_RING = 11 + tokens.spaceXs;

/** A name breaks between words, so its first word is the narrowest it can be drawn without cutting one. */
export function firstWord(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? '';
}

/** Beside the tabs the pill draws its words only where the name's first word and the invitation line each fit whole on one line; otherwise it is its tile, as under sc-30410's 120. */
export function pillShowsWords(
  room: number,
  widths: { firstWord: number; waitingLine: number | null },
): boolean {
  if (room < PILL_BESIDE_TABS.fewest) return false;

  const words = room - PILL_CHROME;
  const waiting = widths.waitingLine == null ? 0 : WAITING_RING + widths.waitingLine;

  return words >= Math.max(widths.firstWord, waiting);
}

/** The switcher's answer pill: its spinner and the gap after it while sending, and its sides (`Pill`, not full). */
export const ANSWER = {
  spinner: 16 + tokens.spaceSm,
  sides: 2 * 22 + 2 * 1.5,
  gap: tokens.spaceMd,
} as const;

/** A button is as wide as the wider of its words at rest and its spinner and sending words, so pressing it moves nothing. */
export function answerWidth(rest: number, sending: number): number {
  return ANSWER.sides + Math.max(rest, ANSWER.spinner + sending);
}

/** The two answers share a row only where both fit at their sending width; otherwise each takes the full row, Accept and join first, before anything is pressed. */
export function answersStack(row: number, accept: number, decline: number): boolean {
  return accept + ANSWER.gap + decline > row;
}
