import type { MembersSay } from './MembersSample.ts';
import { YOU } from './sample.ts';

/** The product's recoveryRequests words, from the web's en.json, with Close, Sending your answer… and the card's line new; the app has none yet. */
export const RECOVERY_WORDS = {
  title: 'Requests to get back in',
  note: 'Only owners and admins see this. A request leaves it once somebody answers or it ends.',
  mark: 'Waiting for an answer',
  asked: 'Asked to turn off two-factor',
  intro:
    'They lost their authenticator and their recovery codes, and stay signed out until somebody answers. One answer from an owner or admin is enough. Approve only if you’re sure it’s them, for example by calling them on a number you already have.',
  you: (name: string) => `${name} (you)`,
  provedBoth: 'Proved with codes to their email and phone',
  provedEmail: 'Proved with a code to their email (no verified phone)',
  provedBothOwn: 'Proved with codes to your email and phone',
  provedEmailOwn: 'Proved with a code to your email (no verified phone)',
  when: (asked: string, expires: string) => `Asked ${asked} · ends ${expires} if nobody answers`,
  own: (organisation: string) =>
    `This is your own request. Somebody else in ${organisation} has to answer it.`,
  approve: 'Approve',
  turnDown: 'Turn down',
  approveTitle: (name: string) => `Approve, and turn off ${name}’s two-factor?`,
  approveBody:
    'Every session they have ends. They sign in again with their password, Google or Apple, and are asked to set up two-factor again.',
  approveConfirm: 'Turn off two-factor',
  cancel: 'Cancel',
  turnDownTitle: (name: string) => `Turn down ${name}’s request?`,
  turnDownBody: 'Two-factor stays on, and they’re emailed that the request was turned down.',
  turnDownConfirm: 'Turn down the request',
  keep: 'Keep the request',
  approved: (name: string) => `${name}’s two-factor is off.`,
  approvedNext: 'They’re emailed now, and every session they had has ended.',
  turnedDown: (name: string) => `${name}’s request is turned down.`,
  turnedDownNext: 'Two-factor stays on for them, and they’re emailed.',
  closed: 'This request has already been answered, or it has ended.',
  close: 'Close',
  failed: 'That did not work. Try again in a moment.',
  sending: 'Sending your answer…',
  toGetBackIn: (count: number) => `${count} to get back in`,
  toJoin: (count: number) => `${count} to join`,
} as const;

/** A teammate who lost their authenticator and recovery codes, as the product's RecoveryRequest has them. */
export interface RecoveryRequest {
  id: string;
  provedPhone: boolean;
  /** The sample's wall clock in Lagos, as the other deadlines are. */
  asked: string;
}

export const KOFI = 'kofi@ire.events';
export const PRIYA = 'priya@ire.events';
export const JULIEN = 'julien@ire.events';

export const RECOVERY_REQUESTS: readonly RecoveryRequest[] = [
  { id: PRIYA, provedPhone: false, asked: '2026-11-04T08:40' },
  { id: KOFI, provedPhone: true, asked: '2026-11-03T18:05' },
  { id: JULIEN, provedPhone: true, asked: '2026-11-04T07:52' },
];

export function recoveryOf(id: string): RecoveryRequest {
  const request = RECOVERY_REQUESTS.find((one) => one.id === id);
  if (request == null) throw new Error(`${id} has no request to get back in.`);

  return request;
}

export function oldestFirst(ids: readonly string[]): string[] {
  return [...ids].sort((one, other) =>
    recoveryOf(one).asked.localeCompare(recoveryOf(other).asked),
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A request ends 7 × 24 hours after it was asked. */
export function endsAt(asked: string): string {
  return new Date(Date.parse(`${asked}Z`) + WEEK_MS).toISOString().slice(0, 16);
}

export function provedLine(request: RecoveryRequest, own: boolean): string {
  if (request.provedPhone) return own ? RECOVERY_WORDS.provedBothOwn : RECOVERY_WORDS.provedBoth;

  return own ? RECOVERY_WORDS.provedEmailOwn : RECOVERY_WORDS.provedEmail;
}

export function whenLine(request: RecoveryRequest, say: MembersSay): string {
  return RECOVERY_WORDS.when(say.deadline(request.asked), say.deadline(endsAt(request.asked)));
}

export interface Asker {
  name: string;
  email: string;
}

export function askerName(person: Asker, own: boolean): string {
  return own ? RECOVERY_WORDS.you(person.name) : person.name;
}

export function recoveryFacts(
  request: RecoveryRequest,
  person: Asker,
  own: boolean,
  say: MembersSay,
): string[] {
  return [
    person.email,
    `${RECOVERY_WORDS.asked} · ${provedLine(request, own)}`,
    whenLine(request, say),
  ];
}

/** One group for a screen reader, in the AC's order, the list's paragraph with it; Approve and Turn down follow. */
export function recoveryHeard(
  request: RecoveryRequest,
  person: Asker,
  own: boolean,
  say: MembersSay,
): string {
  return [
    `${RECOVERY_WORDS.mark}.`,
    `${RECOVERY_WORDS.asked}.`,
    RECOVERY_WORDS.intro,
    `${askerName(person, own)}, ${person.email}.`,
    `${provedLine(request, own)}.`,
    `${whenLine(request, say)}.`,
  ].join(' ');
}

export const OWN_LINE = RECOVERY_WORDS.own(YOU.organisation);

export function answerable(ids: readonly string[], viewer: string): string[] {
  return ids.filter((id) => id !== viewer);
}

/** Removing somebody ends their own request to get back in: it leaves the list at once (pm, Decided 7 Nov). */
export function endedByRemoval(waiting: readonly string[], removed: string): string[] {
  return waiting.filter((id) => id !== removed);
}

/** The card's line says how many of each kind wait, and goes when only one kind does. */
export function waitingKinds(back: number, join: number): string | null {
  return back > 0 && join > 0
    ? `${RECOVERY_WORDS.toGetBackIn(back)} · ${RECOVERY_WORDS.toJoin(join)}`
    : null;
}

export type RecoveryAnswer = { id: string; kind: 'approved' | 'turnedDown' };

/** Which confirm is open, and where it is: asking, its answer on its way, failed, or its request gone meanwhile. */
export type RecoveryAsk = {
  id: string;
  answer: 'approve' | 'turnDown';
  phase: 'asking' | 'sending' | 'failed' | 'closed';
};

/** How long the demo's answers take, as Personalisation's saves do: a moment, or the first held a while so a link can show it on its way. Every answer lands; recoveryFailed only opens failed. */
export type Answering = 'answers' | 'holds';

export const ANSWER_MS = 500;
export const HELD_MS = 8000;

export function answerTakes(answering: Answering, send: number): number {
  return answering === 'holds' && send === 1 ? HELD_MS : ANSWER_MS;
}

export function answeredWords(
  answer: RecoveryAnswer,
  name: string,
): { says: string; line: string } {
  return answer.kind === 'approved'
    ? { says: RECOVERY_WORDS.approved(name), line: RECOVERY_WORDS.approvedNext }
    : { says: RECOVERY_WORDS.turnedDown(name), line: RECOVERY_WORDS.turnedDownNext };
}
