import { describe, expect, it } from 'vitest';

import declaration from '../../../guest-language.json' with { type: 'json' };
import { guestLanguage, guestMessageLanguage } from './guestLanguage.ts';

describe('the rule, against /guest-language.json', () => {
  it.each(declaration.cases)('$name', (row) => {
    const inputs = { chosen: row.chosen, host: row.host, organisation: row.organisation };

    expect(guestLanguage({ ...inputs, browser: row.browser })).toBe(row.page);
    expect(guestMessageLanguage(inputs)).toBe(row.message);
  });

  it('holds the cases the story names', () => {
    const names = declaration.cases.map((row) => row.browser.join(','));

    expect(names).toContain('pt-BR');
    expect(names).toContain('de');
  });
});
