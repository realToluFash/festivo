import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pausedSwitch } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { ALONE_SAYS, aloneNoteOf, aloneOf, heldOf, othersOf } from './HeldModel.ts';

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

  it('says each held page’s sentence in the box only when there is no other organisation', () => {
    expect(aloneNoteOf('paused', true)).toContain(
      '“Your access to single events is not affected.”',
    );
    expect(aloneNoteOf('overdue', true)).toContain('“Your single-event access is not affected.”');
    expect(aloneNoteOf('paused', false)).toBeNull();
    expect(aloneNoteOf('overdue', false)).toBeNull();
    expect(ALONE_SAYS.paused).not.toBe(ALONE_SAYS.overdue);
  });

  it('feeds the paused card its others and puts the box under either card', () => {
    expect(held).toContain('others={othersOf(alone)}');
    expect(held).toContain('const note = aloneNoteOf(held, alone);');
    expect(held).toMatch(/\{card\}\s*<AloneSays note=\{note\} \/>/u);
  });
});
