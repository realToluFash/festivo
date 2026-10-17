import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  recoveryCodeProblems,
  replacedElsewhere,
  startRefusal,
  wrongRecoveryCodes,
} from './recovery.ts';

function refusal(
  code: string,
  status: number,
  violations: { propertyPath: string }[] = [],
): ApiError {
  const problem = {
    type: `https://soirely.com/errors/${code}`,
    title: 'No.',
    status,
    violations: violations.map((violation) => ({ ...violation, message: 'No.', code })),
  };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

describe('the two codes of a request to get back in', () => {
  it('names each code that is blank or short, in the words of where it went', () => {
    expect(
      recoveryCodeProblems(['emailCode', 'phoneCode'], { emailCode: '', phoneCode: '7165' }, false),
    ).toEqual({ emailCode: 'lostTwoFactor.emailBlank', phoneCode: 'lostTwoFactor.codeShort' });
    expect(
      recoveryCodeProblems(
        ['emailCode', 'phoneCode'],
        { emailCode: '481 920', phoneCode: '' },
        true,
      ),
    ).toEqual({
      phoneCode: 'lostTwoFactor.phoneBlankWhatsApp',
    });
    expect(
      recoveryCodeProblems(['emailCode'], { emailCode: '481920', phoneCode: '' }, false),
    ).toEqual({});
  });

  it('marks only the codes the server says are wrong', () => {
    const wrong = refusal('verification_code_invalid', 422, [{ propertyPath: 'phoneCode' }]);

    expect(wrongRecoveryCodes(wrong, ['emailCode', 'phoneCode'])).toEqual(['phoneCode']);
    expect(wrongRecoveryCodes(wrong, ['emailCode'])).toEqual([]);
    expect(wrongRecoveryCodes(refusal('verification_code_expired', 422), ['emailCode'])).toBeNull();
  });

  it('tells the reasons "Send the codes" is refused apart', () => {
    expect(startRefusal(refusal('too_many_attempts', 429))).toBe('limited');
    expect(startRefusal(refusal('recovery_nobody_to_approve', 409))).toBe('nobody');
    expect(startRefusal(refusal('two_factor_challenge_invalid', 401))).toBe('signIn');
    expect(startRefusal(new TypeError('offline'))).toBe('failed');
  });
});

describe('a request replaced on another device', () => {
  it('is told apart from every other refusal', () => {
    expect(replacedElsewhere(refusal('recovery_request_replaced', 409))).toBe(true);
    expect(replacedElsewhere(refusal('recovery_request_proved', 409))).toBe(false);
    expect(replacedElsewhere(new TypeError('offline'))).toBe(false);
  });
});
