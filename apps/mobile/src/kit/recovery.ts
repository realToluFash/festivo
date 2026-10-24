import { ApiError, type RecoveryOpening, type RecoveryState } from '@soirely/api-client';
import { codeProblem, recoveryFirstStep } from '@soirely/domain';

export type RecoveryField = 'emailCode' | 'phoneCode';

/** Both codes checked before asking (sc-509): the message key for each one that is blank or not 6 digits. */
export function recoveryCodeProblems(
  fields: readonly RecoveryField[],
  typed: Record<RecoveryField, string>,
  fromWhatsApp: boolean,
): Partial<Record<RecoveryField, string>> {
  const found: Partial<Record<RecoveryField, string>> = {};

  for (const field of fields) {
    const problem = codeProblem(typed[field]);

    if (problem === 'short') found[field] = 'lostTwoFactor.codeShort';
    else if (problem === 'blank') {
      found[field] =
        field === 'emailCode'
          ? 'lostTwoFactor.emailBlank'
          : fromWhatsApp
            ? 'lostTwoFactor.phoneBlankWhatsApp'
            : 'lostTwoFactor.phoneBlank';
    }
  }

  return found;
}

/** The codes the server says are wrong, by its violations; null for any other refusal. */
export function wrongRecoveryCodes(
  refusal: unknown,
  fields: readonly RecoveryField[],
): RecoveryField[] | null {
  if (!(refusal instanceof ApiError) || !refusal.is('verification_code_invalid')) return null;

  return (refusal.problem.violations ?? [])
    .map((violation) => violation.propertyPath)
    .filter((path): path is RecoveryField => (fields as readonly string[]).includes(path));
}

export type StartRefusal = 'limited' | 'nobody' | 'signIn' | 'failed';

/** Why "Send the codes" was refused: the daily limit, nobody to answer, or a sign-in that has lapsed. */
export function startRefusal(refusal: unknown): StartRefusal {
  if (!(refusal instanceof ApiError)) return 'failed';
  if (refusal.is('too_many_attempts')) return 'limited';
  if (refusal.is('recovery_nobody_to_approve')) return 'nobody';

  return refusal.is('two_factor_challenge_invalid') ? 'signIn' : 'failed';
}

/** A newer request took over on another device: every step says so, and this one starts again (pm #1267). */
export function replacedElsewhere(refusal: unknown): boolean {
  return refusal instanceof ApiError && refusal.is('recovery_request_replaced');
}

export type RecoveryShown =
  | { kind: 'loading' }
  | { kind: 'start'; opening: RecoveryOpening; limitedUntil: string | null; sending: boolean }
  | { kind: 'nobody'; supportAddress: string }
  | { kind: 'request'; recovery: string; state: RecoveryState }
  | { kind: 'replaced' }
  | { kind: 'signIn' }
  | { kind: 'failed' };

export interface RecoveryLoading {
  challenge: string | null;
  held: () => Promise<string | null>;
  hold: (recovery: string) => Promise<void>;
  drop: () => Promise<void>;
  state: (recovery: string) => Promise<RecoveryState>;
  opening: (challenge: string) => Promise<RecoveryOpening>;
}

/** What the screen opens on. A held handle is read only when recoveryFirstStep says so (QA #1262). */
export async function loadRecovery(on: RecoveryLoading): Promise<RecoveryShown> {
  const held = await on.held();

  if (recoveryFirstStep(on.challenge, held) === 'held' && held != null) {
    try {
      return { kind: 'request', recovery: held, state: await on.state(held) };
    } catch (refusal) {
      if (replacedElsewhere(refusal)) return { kind: 'replaced' };
      if (!(refusal instanceof ApiError && refusal.is('recovery_request_invalid')))
        return { kind: 'failed' };

      await on.drop();
    }
  }

  if (on.challenge == null) return { kind: 'signIn' };
  if (held != null) await on.drop();

  try {
    const opening = await on.opening(on.challenge);

    if (opening.open != null) {
      await on.hold(opening.open.recovery);
      return { kind: 'request', ...opening.open };
    }

    return opening.nobody
      ? { kind: 'nobody', supportAddress: opening.supportAddress }
      : { kind: 'start', opening, limitedUntil: null, sending: false };
  } catch (refusal) {
    return startRefusal(refusal) === 'signIn' ? { kind: 'signIn' } : { kind: 'failed' };
  }
}
