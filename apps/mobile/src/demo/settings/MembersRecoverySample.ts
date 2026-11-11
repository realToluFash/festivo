import type { RecoveryRequest } from '@soirely/api-client';

import type { MembersSay } from './MembersSample.ts';
import { YOU } from './sample.ts';

export type { RecoveryAsk } from '../../kit/membersRecovery.ts';

/** The card's recoveryRequests words, from the web's en.json, with the card's line new. The list and its confirm say the app's catalogue, through the product's own rows. */
export const RECOVERY_WORDS = {
  approved: (name: string) => `${name}’s two-factor is off.`,
  approvedNext: 'They’re emailed now, and every session they had has ended.',
  turnedDown: (name: string) => `${name}’s request is turned down.`,
  turnedDownNext: 'Two-factor stays on for them, and they’re emailed.',
  toGetBackIn: (count: number) => `${count} to get back in`,
  toJoin: (count: number) => `${count} to join`,
} as const;

/** A teammate who lost their authenticator and recovery codes, on the sample's clock. */
export interface RecoverySample {
  id: string;
  provedPhone: boolean;
  /** The sample's wall clock in Lagos, as the other deadlines are. */
  asked: string;
}

export const KOFI = 'kofi@ire.events';
export const PRIYA = 'priya@ire.events';
export const JULIEN = 'julien@ire.events';

export const RECOVERY_REQUESTS: readonly RecoverySample[] = [
  { id: PRIYA, provedPhone: false, asked: '2026-11-04T08:40' },
  { id: KOFI, provedPhone: true, asked: '2026-11-03T18:05' },
  { id: JULIEN, provedPhone: true, asked: '2026-11-04T07:52' },
];

export function recoveryOf(id: string): RecoverySample {
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

export interface Asker {
  id: string;
  name: string;
  email: string;
}

/** The sample's request as the API sends it to this reader, dated the reader's way, so the demo draws it with the product's own rows. */
export function recoveryRequestOf(person: Asker, own: boolean, say: MembersSay): RecoveryRequest {
  const sample = recoveryOf(person.id);

  return {
    id: person.id,
    userId: person.id,
    name: person.name,
    email: person.email,
    provedPhone: sample.provedPhone,
    own,
    organisations: [YOU.organisation],
    organisationIds: [],
    asked: say.deadline(sample.asked),
    expires: say.deadline(endsAt(sample.asked)),
  };
}

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
