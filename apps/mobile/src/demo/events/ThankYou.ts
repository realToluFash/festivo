/** sc-6476: the hosts' thank-you, at most 280 characters, counted as the API counts it; the web demo's thankYou.ts. */
export const THANK_YOU_MOST = 280;
export const THANK_YOU_MS = 900;

export const THANK_YOU_LINE =
  'Thank you for dancing with us and for every kind word. We felt so loved, and we will remember this day for a long time.';

export const THANK_YOU_280 =
  'Thank you for coming, for dancing until the very last song and for every kind word you shared with us. Many of you travelled a long way to be there, and it meant the world to us both. Please send us your photos, we would love to see the day through your eyes. So much love to you!';

export const THANK_YOU_OVER = `${THANK_YOU_280} Thank you again.`;

export const THANK_YOU_MORE = `${THANK_YOU_LINE} Please send us your photos.`;

export const TY_WORDS = {
  title: 'A thank-you for your guests',
  hint: 'Every guest sees it on their page, signed with the hosts’ names.',
  add: 'Add a thank-you',
  edit: 'Edit thank-you',
  placeholder: 'Thank your guests in your own words.',
  remove: 'Save it empty to remove it.',
  saving: 'Saving…',
  ending: 'Ending…',
  notSaved: 'Not saved. Check your connection and try again. Your text is still here.',
  notEnded: 'Not ended. Check your connection and try again. Your thank-you is still here.',
  notEndedPlain: 'Not ended. Try again in a moment.',
  saved: 'Thank-you saved.',
  removed: 'Thank-you removed.',
  done: 'Your thank-you is on every guest’s page.',
} as const;

/** Trimmed, every run of spaces and line breaks one space: what is saved and shown. */
export function cleanThankYou(typed: string): string {
  return typed.replace(/\s+/gu, ' ').trim();
}

/** Code points after cleaning: no `maxlength`, so a pasted line is kept and refused with its count. */
export function thankYouLength(typed: string): number {
  return Array.from(cleanThankYou(typed).normalize('NFC')).length;
}

export function thankYouOver(typed: string): boolean {
  return thankYouLength(typed) > THANK_YOU_MOST;
}

export function thankYouCount(typed: string, locale: string): string {
  const number = new Intl.NumberFormat(locale);

  return `${number.format(thankYouLength(typed))}/${number.format(THANK_YOU_MOST)}`;
}

export function thankYouTooLong(locale: string): string {
  return `A thank-you can be at most ${new Intl.NumberFormat(locale).format(THANK_YOU_MOST)} characters.`;
}

export const CARD_STATES = [
  'thankYouLine',
  'thankYouAdding',
  'thankYouEditing',
  'thankYouSaving',
  'thankYouNotSaved',
  'thankYouOver',
  'thankYouLong',
  'thankYouReadOnly',
  'thankYouReadOnlyNone',
] as const;

export const END_STATES = [
  'endNowThankYou',
  'endNowLong',
  'endNowOver',
  'endNowEnding',
  'endNowNotEnded',
] as const;

export type CardState = (typeof CARD_STATES)[number];
export type EndState = (typeof END_STATES)[number];
export type ThankYouState = CardState | EndState;

export function isCardState(state: string | null): state is CardState {
  return CARD_STATES.some((one) => one === state);
}

export function isEndState(state: string | null): state is EndState {
  return END_STATES.some((one) => one === state);
}

export interface Card {
  line: string;
  draft: string;
  open: boolean;
  busy: boolean;
  failed: boolean;
  /** Save pressed over the limit: nothing sent, the field says why. */
  tried: boolean;
  canEnd: boolean;
}

const CLOSED: Card = {
  line: '',
  draft: '',
  open: false,
  busy: false,
  failed: false,
  tried: false,
  canEnd: true,
};

export function cardOf(state: string | null, line = ''): Card {
  const shown = { ...CLOSED, line, draft: line };

  switch (state) {
    case 'thankYouLine':
      return { ...shown, line: THANK_YOU_LINE, draft: THANK_YOU_LINE };
    case 'thankYouAdding':
      return { ...shown, open: true };
    case 'thankYouEditing':
      return { ...shown, line: THANK_YOU_LINE, draft: THANK_YOU_LINE, open: true };
    case 'thankYouSaving':
      return { ...shown, line: THANK_YOU_LINE, draft: THANK_YOU_MORE, open: true, busy: true };
    case 'thankYouNotSaved':
      return { ...shown, line: THANK_YOU_LINE, draft: THANK_YOU_MORE, open: true, failed: true };
    case 'thankYouOver':
      return { ...shown, draft: THANK_YOU_OVER, open: true, tried: true };
    case 'thankYouLong':
      return { ...shown, line: THANK_YOU_280, draft: THANK_YOU_280 };
    case 'thankYouReadOnly':
      return { ...shown, line: THANK_YOU_LINE, draft: THANK_YOU_LINE, canEnd: false };
    case 'thankYouReadOnlyNone':
      return { ...shown, canEnd: false };
    default:
      return shown;
  }
}

/** Nothing to show a member who cannot end the event when there is no line. */
export function cardShown(card: Card): boolean {
  return card.canEnd || card.line !== '';
}

export function opened(card: Card): Card {
  if (card.busy || !card.canEnd) return card;

  return { ...card, open: true, draft: card.line, tried: false, failed: false };
}

export function closed(card: Card): Card {
  if (card.busy) return card;

  return { ...card, open: false, draft: card.line, tried: false, failed: false };
}

export function typed(card: Card, draft: string): Card {
  return { ...card, draft, tried: card.tried && thankYouOver(draft) };
}

export function pressedSave(card: Card): Card {
  if (card.busy || !card.canEnd) return card;
  if (thankYouOver(card.draft)) return { ...card, tried: true, failed: false };

  return { ...card, busy: true, failed: false };
}

export type Settled = 'saved' | 'removed' | null;

/** The answer: the cleaned line saved, and saved empty there is no line. */
export function settled(card: Card): { card: Card; said: Settled } {
  const line = cleanThankYou(card.draft);
  const said: Settled = line !== '' ? 'saved' : card.line !== '' ? 'removed' : null;

  return {
    card: { ...card, line, draft: line, open: false, busy: false, failed: false, tried: false },
    said,
  };
}

export interface EndField {
  draft: string;
  busy: boolean;
  failed: boolean;
  tried: boolean;
}

export function endFieldOf(state: string | null): EndField {
  const empty = { draft: '', busy: false, failed: false, tried: false };

  switch (state) {
    case 'endNowThankYou':
      return { ...empty, draft: THANK_YOU_LINE };
    case 'endNowLong':
      return { ...empty, draft: THANK_YOU_280 };
    case 'endNowOver':
      return { ...empty, draft: THANK_YOU_OVER, tried: true };
    case 'endNowEnding':
      return { ...empty, draft: THANK_YOU_LINE, busy: true };
    case 'endNowNotEnded':
      return { ...empty, draft: THANK_YOU_LINE, failed: true };
    default:
      return empty;
  }
}
