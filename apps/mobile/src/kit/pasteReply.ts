import type { Guest } from '@soirely/api-client';
import {
  REPLY_KEY,
  type Translate,
  invitationLine,
  matches,
  peopleOf,
  shownReply,
} from '@soirely/domain';

import type { LayoutKind } from '../layout/classify.ts';
import { atAccessibilitySizes } from '../layout/textSize.ts';

/** A copied message counts only when it has more than spaces and line breaks in it. */
export function hasText(text: string | null | undefined): text is string {
  return text != null && text.trim() !== '';
}

/** Paste shares Find a guest's row only on an upright iPad below AX1; from AX1 on its word outgrows the row, so it takes the row under it, as on a phone. */
export function pasteBeside(kind: LayoutKind, fontScale: number): boolean {
  return kind === 'tabletPortrait' && !atAccessibilitySizes(fontScale);
}

export const QUOTE_LINES = 6;

/** The quote's first six laid-out lines, ending in "…" however the sixth line ends, a line break included; null when it fits whole. */
export function clipQuote(lines: readonly string[]): string | null {
  if (lines.length <= QUOTE_LINES) return null;

  return `${lines.slice(0, QUOTE_LINES).join('').trimEnd()}…`;
}

/** sc-54450: on a list with guests in it, Paste a reply shows with guests.manage while replies are open, once somebody has been invited. */
export function pasteShown(
  manages: boolean,
  closedOn: string | null | undefined,
  invited: number,
): boolean {
  return manages && closedOn == null && invited > 0;
}

export interface WhoseRow {
  guest: Guest;
  line: string;
}

/** Invited, with no reply yet: the guests Whose reply is this? lists before anything is typed. */
export function waiting(guest: Guest): boolean {
  return guest.invitation != null && shownReply(guest) === 'noReply';
}

/** Whose reply is this?: with nothing typed, the guests still waiting; typed, any invited guest it matches. Newest invitation first, the same moment by name in the app's language. */
export function whoseRows(
  guests: readonly Guest[],
  typed: string,
  t: Translate,
  timeZone: string,
  locale: string,
  language: string,
): WhoseRow[] {
  const looking = typed.trim() !== '';
  const byName = new Intl.Collator(language, { sensitivity: 'base' });

  return peopleOf(guests)
    .filter(
      (one) =>
        one.companion == null &&
        one.guest.invitation != null &&
        (looking ? matches(one, typed) : waiting(one.guest)),
    )
    .map((one) => one.guest)
    .sort((a, b) => {
      const at = Date.parse(b.invitation?.at ?? '') - Date.parse(a.invitation?.at ?? '');

      return at !== 0 ? at : byName.compare(a.fullName, b.fullName);
    })
    .map((guest) => ({
      guest,
      line: t('guestList.paste.rowLine', {
        reply: t(REPLY_KEY[shownReply(guest)]),
        invitation:
          invitationLine(
            t,
            { invitation: guest.invitation && { ...guest.invitation, by: null } },
            timeZone,
            locale,
          ) ?? '',
      }),
    }));
}
