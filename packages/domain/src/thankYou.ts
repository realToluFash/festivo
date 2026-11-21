import { type EventPhase, type EventState, calledOff } from './eventStates.ts';

/** The API's limit on the hosts' thank-you (sc-6476), in code points once cleaned. */
export const THANK_YOU_MOST = 280;

/** Trimmed, every run of spaces and line breaks one space: what the API saves and shows. */
export function cleanThankYou(typed: string): string {
  return typed.replace(/\s+/gu, ' ').trim();
}

/** No `maxlength`: a pasted line is kept and refused with its count, as the API counts it. */
export function thankYouLength(typed: string): number {
  return Array.from(cleanThankYou(typed).normalize('NFC')).length;
}

export function thankYouOver(typed: string): boolean {
  return thankYouLength(typed) > THANK_YOU_MOST;
}

/** Finished and not called off: the only time a thank-you is offered, as the guest's page has it. */
export function takesThankYou(
  event: { status: EventState; startsAt: string; concludedAt: string | null },
  phase: EventPhase,
): boolean {
  return phase === 'finished' && !calledOff(event);
}

/** What the Overview's card shows: nothing to a member who cannot end the event when there is no line. */
export function thankYouCardOf(
  line: string | null,
  manages: boolean,
): 'add' | 'edit' | 'readOnly' | null {
  if (line != null) return manages ? 'edit' : 'readOnly';

  return manages ? 'add' : null;
}

/** The toast a save says: a line saved, or one removed; saving nothing over nothing says nothing. */
export function thankYouSaid(
  before: string | null,
  typed: string,
): 'thankYou.saved' | 'thankYou.removed' | null {
  if (cleanThankYou(typed) !== '') return 'thankYou.saved';

  return before != null ? 'thankYou.removed' : null;
}
