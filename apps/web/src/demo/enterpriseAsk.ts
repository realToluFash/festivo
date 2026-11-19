import { VIEWERS, type Viewer } from './settings.ts';

/** The four locked pages a step can be pressed on, by the name the owners' email gives each. */
export type LockPage = 'hub' | 'emailDomains' | 'auditLog' | 'deleteGuestData';

export const LOCK_PAGE_NAMES: Record<LockPage, string> = {
  hub: 'Data and control',
  emailDomains: 'Email domains',
  auditLog: 'Audit log',
  deleteGuestData: 'Delete guest data after an event',
};

const LOCKED_AS: Record<LockPage, string> = {
  hub: 'locked',
  emailDomains: 'ed_locked',
  auditLog: 'locked',
  deleteGuestData: 'rt_locked',
};

export const LOCK_STATES = [
  'owner_web',
  'admin',
  'admin_sending',
  'admin_sent_one',
  'admin_sent_several',
  'admin_not_sent',
  'admin_asked_one',
  'admin_asked_several',
] as const;

export type LockState = (typeof LOCK_STATES)[number];

export function isLockState(state: string): state is LockState {
  return (LOCK_STATES as readonly string[]).includes(state);
}

/** sc-72241's states open each page as its own free-plan state; any other passes as it came. */
export function pageStateOf(page: LockPage, state: string): string {
  return isLockState(state) ? LOCKED_AS[page] : state;
}

export type LockStep = 'contact' | 'ask' | null;

/** An owner contacts Soirely; an admin, who cannot change the plan, asks an owner; a member has no step. */
export function lockStepOf(viewer: Pick<Viewer, 'owns' | 'manages'>): LockStep {
  if (viewer.owns) return 'contact';
  return viewer.manages ? 'ask' : null;
}

export type Owners = 'one' | 'several';

export type AskNow =
  | { now: 'ready' }
  | { now: 'sending' }
  | { now: 'notSent' }
  | { now: 'sent'; owners: Owners }
  | { now: 'asked'; owners: Owners };

export function askStart(state: string): AskNow {
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

/** One count the response gives, never shown: it picks the one-owner or the several-owners words. */
export function ownersOf(count: number): Owners {
  return count === 1 ? 'one' : 'several';
}

/** A press goes only from Ask an owner as it stands or after Not sent; a second press while sending sends nothing. */
export function mayAsk(ask: AskNow): boolean {
  return ask.now === 'ready' || ask.now === 'notSent';
}

export function showsButton(ask: AskNow): boolean {
  return ask.now !== 'sent' && ask.now !== 'asked';
}

export const ASK_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AskAnswer = { sent: number } | { asked: number } | 'failed';

/** The server's rule, as the demo plays it: one ask per organisation in 24 hours, whichever card, admin or client. */
export function answerAsk(lastAt: number | null, at: number, owners: number): AskAnswer {
  return lastAt != null && at - lastAt < ASK_WINDOW_MS ? { asked: owners } : { sent: owners };
}

export function answered(answer: AskAnswer): AskNow {
  if (answer === 'failed') return { now: 'notSent' };
  if ('sent' in answer) return { now: 'sent', owners: ownersOf(answer.sent) };
  return { now: 'asked', owners: ownersOf(answer.asked) };
}

export const SAMPLE_OWNERS = Object.values(VIEWERS).filter((viewer) => viewer.owns).length;

/** The demo's memory of the organisation's last ask, shared by every page until the tab reloads. */
export const ASKS: { lastAt: number | null } = { lastAt: null };

export function forgetAsks(): void {
  ASKS.lastAt = null;
}

export const ASK_WORDS = {
  ask: 'Ask an owner',
  sent: {
    one: 'The owner has been sent the link to Compare plans.',
    several: 'The owners have been sent the link to Compare plans.',
  },
  asked: {
    one: 'The owner was asked about Enterprise in the last 24 hours.',
    several: 'The owners were asked about Enterprise in the last 24 hours.',
  },
  notSent: 'Not sent. Try again in a moment.',
  compare: 'Compare plans',
  close: 'Close',
  free: 'Free',
  yourPlan: 'Your plan',
  freeLine: 'Its limits and what it includes, as the plans list them.',
  enterprise: 'Enterprise',
  soldBy: 'Sold by contract.',
  changes: 'What changes for Ire Events',
  changesLine: 'Email domains, the audit log and deleting guest data after an event come on.',
  talkLine: 'Talk to us sends Soirely Ire Events, your name and email, and this summary.',
  talk: 'Talk to us',
  talkTold: 'Talk to us has its own design (sc-3935).',
} as const;
