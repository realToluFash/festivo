import { shapeRecovery } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import {
  codeDigits,
  emailLooksRight,
  messageCount,
  minutesSeconds,
  passwordLongEnough,
  recoveryComplete,
} from './rules.ts';

describe('the demo checks what was typed as the app will', () => {
  it('takes an address with a name, an @ and a domain', () => {
    expect(emailLooksRight('folake@ire.events')).toBe(true);
    expect(emailLooksRight(' folake@ire.events ')).toBe(true);
    expect(emailLooksRight('folake@ire')).toBe(false);
    expect(emailLooksRight('folake ire.events')).toBe(false);
    expect(emailLooksRight('')).toBe(false);
  });

  it('asks for 15 characters, counting each emoji once', () => {
    expect(passwordLongEnough('correct horse battery')).toBe(true);
    expect(passwordLongEnough('fourteen chars')).toBe(false);
    expect(passwordLongEnough('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉')).toBe(true);
  });

  it('keeps six digits of a code, whatever came with them', () => {
    expect(codeDigits('482 913')).toBe('482913');
    expect(codeDigits('Your code is 482913.')).toBe('482913');
    expect(codeDigits('4829131')).toBe('482913');
    expect(codeDigits('48a')).toBe('48');
  });
});

describe('a recovery code takes the shape it was saved in', () => {
  it('in lower case, the dash put in after four', () => {
    expect(shapeRecovery('VTXP')).toBe('vtxp');
    expect(shapeRecovery('vtxpr')).toBe('vtxp-r');
    expect(shapeRecovery('VTXPRH7Y')).toBe('vtxp-rh7y');
    expect(shapeRecovery('vtxp-rh7y')).toBe('vtxp-rh7y');
    expect(shapeRecovery('vtxp rh7y extra')).toBe('vtxp-rh7y');
  });

  it('keeps a pasted code whole, whatever came with it', () => {
    expect(shapeRecovery('vtxp--rh7y')).toBe('vtxp-rh7y');
    expect(shapeRecovery(' vtxp-rh7y')).toBe('vtxp-rh7y');
    expect(shapeRecovery('  VTXP - RH7Y \n')).toBe('vtxp-rh7y');
  });

  it('lets a dash be deleted with the character before it', () => {
    expect(shapeRecovery('vtxp-')).toBe('vtxp');
  });

  it('is whole at eight characters', () => {
    expect(recoveryComplete('vtxp-rh7y')).toBe(true);
    expect(recoveryComplete('vtxp-rh7')).toBe(false);
  });
});

describe('the demo counts as the screens show it', () => {
  it('waits in minutes and seconds', () => {
    expect(minutesSeconds(54)).toBe('0:54');
    expect(minutesSeconds(60)).toBe('1:00');
    expect(minutesSeconds(9.2)).toBe('0:10');
    expect(minutesSeconds(-3)).toBe('0:00');
  });

  it('counts a message against 500', () => {
    expect(messageCount('Hi Ade, it’s Folake from the Lagos team.')).toBe('40 of 500 characters.');
  });
});
