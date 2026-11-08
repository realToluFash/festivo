import { describe, expect, it } from 'vitest';

import { feetAndInchesOf, readFeetAndInches, readRoomSide } from './roomSize.ts';

describe('a room side in metres', () => {
  it.each(['12.5', '12,5', ' 12.5 '])('reads %s as 12.5 m in every language', (typed) => {
    expect(readRoomSide(typed, 'metric', 'fr')).toEqual({ kind: 'cm', cm: 1250 });
  });

  it('is refused blank, unreadable, or outside 2 m to 500 m', () => {
    expect(readRoomSide('  ', 'metric', 'en')).toEqual({ kind: 'blank' });
    expect(readRoomSide('twelve', 'metric', 'en')).toEqual({ kind: 'unreadable' });
    expect(readRoomSide('1,99', 'metric', 'en')).toEqual({ kind: 'outOfRange' });
    expect(readRoomSide('500.01', 'metric', 'en')).toEqual({ kind: 'outOfRange' });
    expect(readRoomSide('2', 'metric', 'en')).toEqual({ kind: 'cm', cm: 200 });
    expect(readRoomSide('500', 'metric', 'en')).toEqual({ kind: 'cm', cm: 50_000 });
  });
});

describe('a room side in feet and inches', () => {
  it.each([
    ['12′ 4″', 148],
    ["12' 4\"", 148],
    ['12 ft 4 in', 148],
    ['12ft4in', 148],
    ['12.5 ft', 150],
    ['12,5 ft', 150],
    ['148 in', 148],
    ['12', 144],
    ['12 ft 14 in', 158],
  ])('reads %s as %d inches, in English', (typed, inches) => {
    expect(readFeetAndInches(typed, 'en')).toBe(inches);
  });

  it("takes the reader's own short unit words, and the English ones too", () => {
    expect(readFeetAndInches('12 pi 6 po', 'fr')).toBe(150);
    expect(readFeetAndInches('12 ft 6 pol.', 'pt')).toBe(150);
    expect(readFeetAndInches('12 ft 6 in', 'pt')).toBe(150);
    expect(readFeetAndInches('12 ft 6 in', 'es')).toBe(150);
  });

  it('refuses any other text', () => {
    expect(readFeetAndInches('12 4', 'en')).toBeNull();
    expect(readFeetAndInches('about twelve', 'en')).toBeNull();
    expect(readFeetAndInches('4 in 12 ft', 'en')).toBeNull();
    expect(readRoomSide('12 m', 'us', 'en')).toEqual({ kind: 'unreadable' });
  });

  it('keeps the limits of 2 m and 500 m', () => {
    expect(readRoomSide('6 ft 6 in', 'us', 'en')).toEqual({ kind: 'outOfRange' });
    expect(readRoomSide('6 ft 7 in', 'us', 'en')).toEqual({ kind: 'cm', cm: 201 });
    expect(readRoomSide('1640 ft 5 in', 'us', 'en')).toEqual({ kind: 'cm', cm: 50_000 });
    expect(readRoomSide('1641 ft', 'us', 'en')).toEqual({ kind: 'outOfRange' });
  });

  it('writes a size as whole feet and the inches left over', () => {
    expect(feetAndInchesOf(381)).toEqual({ feet: 12, inches: 6 });
    expect(feetAndInchesOf(200)).toEqual({ feet: 6, inches: 7 });
    expect(feetAndInchesOf(50_000)).toEqual({ feet: 1640, inches: 5 });
  });
});
