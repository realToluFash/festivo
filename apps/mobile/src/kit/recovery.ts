import { ApiError } from '@soirely/api-client';
import { codeProblem } from '@soirely/domain';

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
