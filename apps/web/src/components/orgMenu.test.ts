import { describe, expect, it } from 'vitest';

import { columnsOf, fold, holds, stepTo } from './orgMenu.ts';

describe('the switcher’s grid and search (sc-30412)', () => {
  it('narrows by name, ignoring case and accents', () => {
    expect(fold('Maison Ondine Événements')).toBe('maison ondine evenements');
    expect(holds('Maison Ondine Événements', 'EVEN')).toBe(true);
    expect(holds('Atlântico Comunicações e Eventos', 'comunicacoes')).toBe(true);
    expect(holds('Ire Events', '  ire ')).toBe(true);
    expect(holds('Ire Events', 'Belém')).toBe(false);
  });

  it('lays out 4 places to a row at 500, and fewer as the window narrows', () => {
    expect(columnsOf(500 - 2 - 24)).toBe(4);
    expect(columnsOf(360 - 24 - 2 - 24)).toBe(2);
    expect(columnsOf(112)).toBe(1);
    expect(columnsOf(0)).toBe(4);
  });

  it('moves through the grid with the arrows, Home and End', () => {
    expect(stepTo('ArrowRight', 0, 6, 4)).toBe(1);
    expect(stepTo('ArrowRight', 5, 6, 4)).toBe(5);
    expect(stepTo('ArrowLeft', 0, 6, 4)).toBe(0);
    expect(stepTo('ArrowDown', 1, 6, 4)).toBe(5);
    expect(stepTo('ArrowDown', 3, 6, 4)).toBe(5);
    expect(stepTo('ArrowDown', 5, 6, 4)).toBe(5);
    expect(stepTo('ArrowUp', 5, 6, 4)).toBe(1);
    expect(stepTo('ArrowUp', 2, 6, 4)).toBe(2);
    expect(stepTo('Home', 4, 6, 4)).toBe(0);
    expect(stepTo('End', 0, 6, 4)).toBe(5);
    expect(stepTo('a', 0, 6, 4)).toBeNull();
  });
});
