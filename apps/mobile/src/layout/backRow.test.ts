import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { backRow } from './backRow.ts';

const event = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');

describe('Back keeps its row while Refreshing… comes and goes (sc-71821)', () => {
  it('gives way on Guests’ list on a phone, refreshing or not', () => {
    expect(backRow({ phone: true, guestsList: true, cardNamed: false })).toBe('givingWay');
  });

  it('keeps Refreshing… beside Back elsewhere on a phone and on a named card', () => {
    expect(backRow({ phone: true, guestsList: false, cardNamed: false })).toBe('beside');
    expect(backRow({ phone: false, guestsList: false, cardNamed: true })).toBe('beside');
  });

  it('leaves Back alone on a tablet page with a title', () => {
    expect(backRow({ phone: false, guestsList: true, cardNamed: false })).toBe('alone');
  });
});

describe('EventScreen builds Back’s row from backRow alone (sc-71821)', () => {
  it('asks backRow without Refreshing…, so the row is the same whether it shows', () => {
    expect(event).toMatch(
      /const besideBackRow = backRow\(\{ phone, guestsList: guests && guestBack == null, cardNamed \}\);/u,
    );
  });

  it('turns besideBack only on besideBackRow, never on whether Refreshing… shows', () => {
    expect(event).toMatch(
      /besideBack=\{\s+besideBackRow === 'givingWay'\s+\? \{ status: refreshing, onPlaced: setRefreshingBesideBack \}\s+: besideBackRow === 'beside'\s+\? refreshing\s+: undefined\s+\}/u,
    );
  });
});
