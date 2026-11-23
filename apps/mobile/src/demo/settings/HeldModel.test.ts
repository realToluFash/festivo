import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pausedSwitch } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { aloneOf, heldOf, othersOf } from './HeldModel.ts';

const held = readFileSync(join(import.meta.dirname, 'Held.tsx'), 'utf8');

describe('sc-85006: the held pages for a member of one organisation', () => {
  it('reads the held page and ?switcher=one from the address', () => {
    expect(heldOf('paused')).toBe('paused');
    expect(heldOf('overdue')).toBe('overdue');
    expect(heldOf('other')).toBeNull();
    expect(aloneOf('one')).toBe(true);
    expect(aloneOf(undefined)).toBe(false);
    expect(aloneOf('populated')).toBe(false);
  });

  it('draws no Switch organisation on the paused page when there is no other organisation', () => {
    expect(pausedSwitch(othersOf(true))).toBeNull();
    expect(pausedSwitch(othersOf(false))).toBe('switcher');
  });

  it('feeds the paused card its others and the overdue card whether any are listed', () => {
    expect(held).toContain('others={othersOf(alone)}');
    expect(held).toContain('othersListed={!alone}');
  });
});
