import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const redeem = readFileSync(join('src', 'components', 'Redeem.tsx'), 'utf8');
const phone = readFileSync(join('src', 'components', 'RedeemPhone.tsx'), 'utf8');

describe('a door code refused as the password is (sc-94849)', () => {
  it('leaves the sixth digit for the refusal', () => {
    expect(phone).toMatch(/else if \(providerOnly != null\) onLeave\(providerOnly\);/u);
  });

  it('offers only the linked providers, and failing, says so over the door code', () => {
    expect(redeem).toContain(
      '<ProviderButtons only={step.providers} onSignedIn={onSignedIn} onFailed={failedOver} />',
    );
  });

  it('signed in, returns to the door code’s page as the account', () => {
    expect(redeem).toMatch(
      /onSignedIn=\{async \(who\) => \{\s+await reloadSignedIn\(\)\.catch\(\(\) => undefined\);\s+setAccount\(who\);\s+go\(\{ kind: 'event', code: step\.code, opened: step\.opened \}\);/u,
    );
  });
});
