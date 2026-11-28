import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import {
  COUNTRY_CHROME,
  COUNTRY_FIELD,
  countryBoxBeside,
  countryOverNumber,
} from './phoneCountryFit.ts';

describe('the country over the number once its name does not fit beside it (sc-7579, #104845)', () => {
  it('gives the country its basis and a third of the room left beside the number', () => {
    expect(countryBoxBeside(328)).toBe(140);
    expect(countryBoxBeside(358)).toBe(150);
    expect(countryBoxBeside(300)).toBe(300);
  });

  it('keeps the country beside the number while its name fits on one line', () => {
    expect(countryOverNumber(false, 140 - COUNTRY_CHROME, 328)).toBe(false);
    expect(countryOverNumber(false, 80, 328)).toBe(false);
  });

  it('puts it over the number as soon as its name would break, as "+44 Royaume-Uni" did', () => {
    expect(countryOverNumber(false, 140 - COUNTRY_CHROME + 0.5, 328)).toBe(true);
    expect(countryOverNumber(false, 121, 328)).toBe(true);
  });

  it('stays beside until both are measured, and is always over at the accessibility sizes', () => {
    expect(countryOverNumber(false, null, 328)).toBe(false);
    expect(countryOverNumber(false, 200, null)).toBe(false);
    expect(countryOverNumber(true, 10, 600)).toBe(true);
  });
});

describe("the rule's chrome is ListPicker's field, so a change there turns this red (PR #4367)", () => {
  const text = readFileSync(join('src', 'components', 'ListPicker.tsx'), 'utf8');
  const field = /\n {2}field: \{([^}]*)\}/u.exec(text)?.[1] ?? '';
  const chevron = /function Chevron\(\) \{[\s\S]*?<Svg width=\{(\d+)\}/u.exec(text)?.[1];
  const spaced = (name: string) => {
    const value = new RegExp(`\\b${name}: (?:tokens\\.(\\w+)|(\\d+))`, 'u').exec(field);
    if (value?.[1] != null) return tokens[value[1] as keyof typeof tokens];

    return value?.[2] == null ? undefined : Number(value[2]);
  };

  it("matches the field's border, padding and gap", () => {
    expect(spaced('borderWidth')).toBe(COUNTRY_FIELD.borderWidth);
    expect(spaced('paddingHorizontal')).toBe(COUNTRY_FIELD.paddingHorizontal);
    expect(spaced('gap')).toBe(COUNTRY_FIELD.gap);
  });

  it("matches the chevron's width", () => {
    expect(Number(chevron)).toBe(COUNTRY_FIELD.chevron);
  });

  it('adds them up around the name', () => {
    expect(COUNTRY_CHROME).toBe(2 + tokens.spaceLg * 2 + tokens.spaceSm + 14);
  });
});
