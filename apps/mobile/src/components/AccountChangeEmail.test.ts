import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const page = readFileSync(join('src', 'components', 'AccountPage.tsx'), 'utf8');
const demo = readFileSync(join('src', 'demo', 'settings', 'Account.tsx'), 'utf8');

function body(source: string, name: string): string {
  const at = source.indexOf(`function ${name}(row: Contact): void {`);
  if (at < 0) throw new Error(`No ${name} in the source.`);

  return source.slice(at, source.indexOf('\n  }\n', at));
}

describe('Change email on an address we could not deliver to (sc-44949)', () => {
  const change = body(page, 'changeFrom');

  it('takes where it goes from the rule the demo and the web share', () => {
    expect(change).toContain('const goes = changeEmail(emails);');
    expect(demo).toMatch(/import \{[^}]*\bchangeEmail\b[^}]*\} from '@soirely\/domain';/u);
  });

  it('opens Add an email address while the account has room, returning to the line after', () => {
    expect(change).toMatch(
      /if \(goes\.to === 'add'\) \{\s+show\('addEmail', 'change'\);\s+return;\s+\}/u,
    );
  });

  it('at two addresses opens the one that is not primary and moves screen-reader focus to it', () => {
    expect(change).toContain("from.current = 'change';");
    expect(change).toContain('setOpened(goes.id);');
    expect(change).toMatch(/moveScreenReaderFocus\(blocks\.current\[goes\.id\] \?\? null\)/u);
  });

  it('draws the lines with the one component the demo draws them with', () => {
    expect(page).toContain("import { UndeliverableLines } from './AccountUndeliverable.tsx';");
    expect(demo).toContain(
      "import { UndeliverableLines } from '../../components/AccountUndeliverable.tsx';",
    );
    expect(page).toContain('rows={undeliverableAddresses(emails)}');
  });
});
