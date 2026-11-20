import { describe, expect, it } from 'vitest';

import { NO_SEAT, seatLineOf, seatWords, seatingOf } from './DoorSeats.ts';

describe('the seat line at the door (sc-60684)', () => {
  it('words each kind of seat as sc-4022 does, dropping a missing section', () => {
    expect(seatWords({ kind: 'table', table: 'Table 4', section: 'Main hall' })).toBe(
      'Table 4 · Main hall',
    );
    expect(seatWords({ kind: 'row', row: 'C', n: 4, section: 'Balcony' })).toBe(
      'Row C, seat 4 · Balcony',
    );
    expect(seatWords({ kind: 'single', seat: 'Seat 12', section: 'By the bar' })).toBe(
      'Seat 12 · By the bar',
    );
    expect(seatWords({ kind: 'table', table: 'Table 4', section: null })).toBe('Table 4');
  });

  it('gives each person their own line, No seat yet for the unseated', () => {
    expect(seatLineOf('ines', 'seated')).toBe('Table 4 · Garden side');
    expect(seatLineOf('ines.0', 'seated')).toBe('Table 4 · Garden side');
    expect(seatLineOf('folasade', 'seated')).toBe('Row C, seat 14 · Upper balcony east');
    expect(seatLineOf('folasade.0', 'seated')).toBe(NO_SEAT);
    expect(seatLineOf('camille', 'seated')).toBe(NO_SEAT);
    expect(seatLineOf('walkin-Dr Kofi Asante', 'seated')).toBe(NO_SEAT);
  });

  it('shows no line at all on an event with nobody seated', () => {
    expect(seatingOf('none')).toBe('none');
    expect(seatingOf(undefined)).toBe('seated');
    expect(seatLineOf('ines', 'none')).toBeNull();
    expect(seatLineOf('camille', 'none')).toBeNull();
  });
});
