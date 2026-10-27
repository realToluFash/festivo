import { describe, expect, it } from 'vitest';

import {
  breakableEmail,
  breaksAWord,
  fitWords,
  nameLines,
  railWidth,
  settleWords,
  sideListWidth,
  titleSize,
} from './textSize.ts';

const AX1 = 1.786;
const AX2 = 2.143;

describe('titleSize', () => {
  it.each([
    [28, 1, 28],
    [28, 1.353, 28 * 1.353],
    [28, AX1, 38],
    [28, AX2, 43],
    [26, AX2, 43],
    [20, AX1, 31],
    [20, AX2, 37],
    [28, 2, 43],
  ])('draws a %s title at scale %s at %s', (size, scale, drawn) => {
    expect(titleSize(size, scale)).toBeCloseTo(drawn);
  });

  it('never draws a title smaller than at the default size', () => {
    for (const size of [20, 26, 28]) {
      expect(titleSize(size, AX2)).toBeGreaterThan(size);
    }
  });
});

describe('breaksAWord', () => {
  it('passes lines broken at spaces', () => {
    expect(breaksAWord(['Revenir sans votre ', 'application ', 'd’authentification'])).toBe(false);
  });

  it('finds a word broken across two lines', () => {
    expect(breaksAWord(['Configura', 'ción'])).toBe(true);
  });

  it('passes one line', () => {
    expect(breaksAWord(['Paramètres'])).toBe(false);
  });
});

it('lets a name in the frame take two lines only at the accessibility sizes', () => {
  expect(nameLines(1.353)).toBe(1);
  expect(nameLines(AX1)).toBe(2);
});

describe('widths', () => {
  it('widens the rail only at the accessibility sizes', () => {
    expect(railWidth(1.353)).toBe(220);
    expect(railWidth(AX1)).toBe(300);
  });

  it('gives a side list 40 percent of the content, never under its own width', () => {
    expect(sideListWidth(320, 834, 1)).toBe(320);
    expect(sideListWidth(320, 834, AX1)).toBe(334);
    expect(sideListWidth(236, 980, AX2)).toBe(392);
    expect(sideListWidth(320, 700, AX2)).toBe(320);
  });
});

describe('breakableEmail', () => {
  it('lets the line break after the @ and nowhere new', () => {
    expect(breakableEmail('camille.moreau@traiteur-lumiere.fr')).toBe(
      'camille.moreau@​traiteur-lumiere.fr',
    );
  });
});

describe('a text stepping down rather than break a word', () => {
  const broken = ['Paramètres de l’organi', 'sation'];
  const whole = ['Paramètres de ', 'l’organisation'];

  it('starts at the step’s size', () => {
    expect(fitWords(null, titleSize(28, AX2), 'Paramètres').drawn).toBe(43);
  });

  it('drops a point while a word is broken, and settles once none is', () => {
    const first = fitWords(null, titleSize(28, AX2), 'Paramètres');
    const second = settleWords(first, 28, broken);
    expect(second.drawn).toBe(42);
    expect(settleWords(second, 28, whole)).toBe(second);
  });

  it('stops at the default size', () => {
    const atFloor = { key: fitWords(null, titleSize(28, AX2), 'Paramètres').key, drawn: 28 };
    expect(settleWords(atFloor, 28, broken)).toBe(atFloor);
    expect(settleWords({ ...atFloor, drawn: 28.5 }, 28, broken).drawn).toBe(28);
  });

  it('starts again when the step changes', () => {
    const stepped = { ...fitWords(null, titleSize(28, AX2), 'Paramètres'), drawn: 41 };
    const atDefault = fitWords(stepped, titleSize(28, 1), 'Paramètres');
    expect(atDefault.drawn).toBe(28);
    expect(fitWords(atDefault, titleSize(28, AX2), 'Paramètres').drawn).toBe(43);
  });

  it('starts again when the text changes', () => {
    const stepped = { ...fitWords(null, titleSize(28, AX2), 'Paramètres'), drawn: 41 };
    expect(fitWords(stepped, titleSize(28, AX2), 'Membres').drawn).toBe(43);
  });

  it('starts a bar label at the full scale and steps it down the same way', () => {
    const label = fitWords(null, 12 * AX2, 'Configuración');
    expect(label.drawn).toBeCloseTo(12 * AX2);
    expect(settleWords(label, 12, ['Configura', 'ción']).drawn).toBeCloseTo(12 * AX2 - 1);
    expect(settleWords({ ...label, drawn: 12 }, 12, ['Configura', 'ción']).drawn).toBe(12);
  });

  it('keeps its size while neither changes', () => {
    const stepped = { ...fitWords(null, titleSize(28, AX2), 'Paramètres'), drawn: 41 };
    expect(fitWords(stepped, titleSize(28, AX2), 'Paramètres')).toBe(stepped);
  });
});
