import { describe, expect, it } from 'vitest';

import {
  ARRIVAL_NOTE,
  LONG_NOTE,
  NOTE_MOST,
  WIDE_NOTE,
  noteLength,
  noteTooLong,
  savedNote,
} from './ArrivalNote.ts';
import { EVENTS } from './EventsSample.ts';

describe('the arrival note (sc-24385)', () => {
  it('counts what will be saved: code points after NFC, trimmed', () => {
    const accents = `${'é'.repeat(250)}${'ñ'.repeat(120)}${'ç'.repeat(129)}🚗`;

    expect(noteLength(accents)).toBe(NOTE_MOST);
    expect(noteTooLong(accents)).toBe(false);
    expect(noteTooLong(`${accents}x`)).toBe(true);
    expect(noteLength('é')).toBe(1);
    expect(noteTooLong(`${accents} \n`)).toBe(false);
  });

  it('saves trimmed, and a note of only spaces or blank lines as no note', () => {
    expect(savedNote('  Gate 2 \n')).toBe('Gate 2');
    expect(savedNote(' \n \n ')).toBeNull();
  });

  it('has samples at 500 with no spaces and at 501', () => {
    expect(noteLength(WIDE_NOTE)).toBe(NOTE_MOST);
    expect(WIDE_NOTE).not.toMatch(/\s/u);
    expect(noteLength(LONG_NOTE)).toBe(NOTE_MOST + 1);
  });

  it('sits beside the venue on the wedding, not inside it', () => {
    const wedding = EVENTS.find((one) => one.id === 'evt-wed-4');

    expect(wedding?.arrivalNote).toBe(ARRIVAL_NOTE);
    expect(wedding?.venue).not.toHaveProperty('arrivalNote');
  });
});
