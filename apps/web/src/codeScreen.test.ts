import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { codeRefusal, openingStatus } from './codeScreen.ts';

function refused(code: string): ApiError {
  return new ApiError({ type: `https://soirely.com/errors/${code}`, title: code, status: 422 });
}

describe('a code screen', () => {
  it('opens on the banner for a spent code, and on the field for a live one', () => {
    expect(openingStatus({ kind: 'entering' }, 'exhausted')).toEqual({ kind: 'exhausted' });
    expect(openingStatus({ kind: 'entering' }, 'expired')).toEqual({ kind: 'expired' });
    expect(openingStatus({ kind: 'entering' }, 'live')).toEqual({ kind: 'entering' });
  });

  it('leaves a screen already past entering as it is', () => {
    expect(openingStatus({ kind: 'verified' }, 'exhausted')).toEqual({ kind: 'verified' });
    expect(openingStatus({ kind: 'wrong' }, 'expired')).toEqual({ kind: 'wrong' });
  });

  it("names a refusal by the API's code, and anything else as a failure", () => {
    expect(codeRefusal(refused('verification_code_invalid'))).toEqual({ kind: 'wrong' });
    expect(codeRefusal(refused('verification_code_expired'))).toEqual({ kind: 'expired' });
    expect(codeRefusal(refused('verification_code_exhausted'))).toEqual({ kind: 'exhausted' });
    expect(codeRefusal(new TypeError('Failed to fetch'))).toEqual({ kind: 'failed' });
  });

  it("draws its code field with every text field's edge, and a wrong code's in the same width (sc-26413)", () => {
    const styles = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');
    const rule = (selector: string) =>
      new RegExp(`\\n${selector.replace('.', '\\.')} \\{([^}]*)\\}`, 'u').exec(styles)?.[1];

    expect(rule('.code-input')).toMatch(/\n {2}border: var\(--borderField\);/u);
    expect(rule('.input')).toMatch(/\n {2}border: var\(--borderField\);/u);
    expect(styles).toMatch(
      /\n\.code-input\.input-wrong \{\n {2}border-color: var\(--colorBroken\);\n\}/u,
    );
  });
});
