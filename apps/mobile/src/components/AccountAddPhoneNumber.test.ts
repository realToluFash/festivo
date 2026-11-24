import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const add = readFileSync(join('src', 'components', 'AccountAdd.tsx'), 'utf8');
const addEntry = add.slice(add.indexOf('<PhoneEntry'));
const phoneEntry = addEntry.slice(0, addEntry.indexOf('/>'));

describe('A new number survives a live text-size change (sc-78438)', () => {
  it('hands the number typed so far to PhoneEntry', () => {
    expect(phoneEntry).toContain('number={typed}');
  });
});
