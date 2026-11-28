import type { DataPage } from './DataModel.ts';

const LOCKED_AS: Record<DataPage, string> = {
  hub: 'locked',
  emailDomains: 'ed_locked',
  auditLog: 'locked',
};

export const LOCK_STATES = [
  'owner_app',
  'admin',
  'admin_sending',
  'admin_sent_one',
  'admin_sent_several',
  'admin_not_sent',
  'admin_asked_one',
  'admin_asked_several',
] as const;

export type LockState = (typeof LOCK_STATES)[number];

export function isLockState(state: string | undefined): state is LockState {
  return (LOCK_STATES as readonly (string | undefined)[]).includes(state);
}

/** sc-72241's states open each page as its own free-plan state; any other passes as it came. */
export function pageStateOf(page: DataPage, state: string | undefined): string | undefined {
  return isLockState(state) ? LOCKED_AS[page] : state;
}

export type LockStep = 'line' | 'ask' | null;

/** The plan is changed on the web only, so an owner reads the line; an admin asks an owner; a member has nothing. */
export function lockStepOf(person: { owns: boolean; manages: boolean }): LockStep {
  if (person.owns) return 'line';
  return person.manages ? 'ask' : null;
}

export type Owners = 'one' | 'several';

export type AskNow =
  | { now: 'ready' }
  | { now: 'sending' }
  | { now: 'notSent' }
  | { now: 'sent'; owners: Owners }
  | { now: 'asked'; owners: Owners };

export function askStart(state: string | undefined): AskNow {
  switch (state) {
    case 'admin_sending':
      return { now: 'sending' };
    case 'admin_not_sent':
      return { now: 'notSent' };
    case 'admin_sent_one':
      return { now: 'sent', owners: 'one' };
    case 'admin_sent_several':
      return { now: 'sent', owners: 'several' };
    case 'admin_asked_one':
      return { now: 'asked', owners: 'one' };
    case 'admin_asked_several':
      return { now: 'asked', owners: 'several' };
    default:
      return { now: 'ready' };
  }
}

/** The response's count, never shown: it picks the one-owner or the several-owners words. */
export function ownersOf(count: number): Owners {
  return count === 1 ? 'one' : 'several';
}

/** A second press while sending sends nothing. */
export function mayAsk(ask: AskNow): boolean {
  return ask.now === 'ready' || ask.now === 'notSent';
}

export function showsButton(ask: AskNow): boolean {
  return ask.now !== 'sent' && ask.now !== 'asked';
}

export const ASK_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AskAnswer = { sent: number } | { asked: number } | 'failed';

/** The server's rule as the demo plays it: one ask per organisation in 24 hours, whichever card, admin or client. */
export function answerAsk(lastAt: number | null, at: number, owners: number): AskAnswer {
  return lastAt != null && at - lastAt < ASK_WINDOW_MS ? { asked: owners } : { sent: owners };
}

export function answered(answer: AskAnswer): AskNow {
  if (answer === 'failed') return { now: 'notSent' };
  if ('sent' in answer) return { now: 'sent', owners: ownersOf(answer.sent) };
  return { now: 'asked', owners: ownersOf(answer.asked) };
}

/** The demo's memory of the organisation's last ask, shared by every page until the app reloads. */
export const ASKS: { lastAt: number | null } = { lastAt: null };

export function forgetAsks(): void {
  ASKS.lastAt = null;
}
