import { ApiError, type TwoFactorEnrolment } from '@soirely/api-client';
import { cleanCode } from '@soirely/domain';

import { type ProveWith } from '../proving.ts';
import { afterSending, sampleRefusal } from './account.ts';
import { SAMPLE } from './rules.ts';
import { AUTHENTICATOR_KEY, RECOVERY_CODES, RESEND_FROM, qrPath } from './security.ts';

function refusedNewPassword(code: string): ApiError {
  return new ApiError({
    type: 'https://soirely.com/errors/validation_failed',
    title: 'validation_failed',
    status: 422,
    violations: [{ propertyPath: 'newPassword', message: code, code }],
  });
}

function knownFactor(code: string): boolean {
  const factor = cleanCode(code).toLowerCase();

  return factor === SAMPLE.authenticator || factor === SAMPLE.recovery;
}

export function sampleChange(current: string, next: string, others: number) {
  return afterSending(() => {
    if (current !== SAMPLE.password) throw sampleRefusal('invalid_credentials');
    if (next === current) throw refusedNewPassword('password_unchanged');
    if (next === SAMPLE.breachedPassword) throw refusedNewPassword('password_breached');

    return { signedOut: others };
  });
}

export function sampleSend(): Promise<void> {
  return afterSending(() => undefined);
}

export function sampleBegin(): Promise<number> {
  return Promise.resolve(RESEND_FROM);
}

export function samplePass(code: string): Promise<string> {
  return afterSending(() => {
    if (cleanCode(code) !== SAMPLE.code) throw sampleRefusal('verification_code_invalid');

    return 'sample-step-up';
  });
}

export function sampleSavePassword(password: string): Promise<void> {
  return afterSending(() => {
    if (password === SAMPLE.breachedPassword) throw refusedNewPassword('password_breached');
  });
}

export function sampleFactor(code: string): Promise<void> {
  return afterSending(() => {
    if (!knownFactor(code)) throw sampleRefusal('two_factor_code_invalid');
  });
}

const QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><path d="${qrPath()}" fill-rule="evenodd"/></svg>`;

export function sampleEnrol(): Promise<TwoFactorEnrolment> {
  return Promise.resolve({
    secret: AUTHENTICATOR_KEY,
    otpauthUri: `otpauth://totp/Soirely?secret=${AUTHENTICATOR_KEY}`,
    qrSvg: QR_SVG,
  });
}

export function sampleActivate(code: string): Promise<string[]> {
  return afterSending(() => {
    if (cleanCode(code) !== SAMPLE.authenticator) throw sampleRefusal('two_factor_code_invalid');

    return [...RECOVERY_CODES];
  });
}

/** Confirm it's you: the sample's password, then, while two-factor is on, its authenticator or a recovery code. */
export function sampleSecurityProof(first: ProveWith, code?: string): Promise<string> {
  return afterSending(() => {
    if ('password' in first && first.password !== SAMPLE.password)
      throw sampleRefusal('invalid_credentials');
    if (code != null && !knownFactor(code)) throw sampleRefusal('two_factor_code_invalid');

    return 'sample-proof';
  });
}
