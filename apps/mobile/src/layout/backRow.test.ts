import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { backRow } from './backRow.ts';

const event = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');
const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');

describe('Back keeps its row while Refreshing… comes and goes (sc-71821)', () => {
  it('gives way on Guests’ list on a phone, refreshing or not', () => {
    expect(backRow({ phone: true, guestsList: true, cardNamed: false })).toBe('givingWay');
  });

  it('gives way beside Overview’s ‹, refreshing or not (sc-83008)', () => {
    expect(backRow({ phone: true, guestsList: false, cardNamed: true, overview: true })).toBe(
      'givingWay',
    );
    expect(backRow({ phone: false, guestsList: false, cardNamed: true, overview: true })).toBe(
      'givingWay',
    );
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
      /const besideBackRow = backRow\(\{\s+phone,\s+guestsList: guests && guestBack == null,\s+cardNamed,\s+overview: overviewGivesWay\(kind, overviewBack\),\s+\}\);/u,
    );
  });

  it('turns besideBack only on besideBackRow, never on whether Refreshing… shows', () => {
    expect(event).toMatch(
      /besideBack=\{\s+besideBackRow === 'givingWay'\s+\? \{ status: refreshing, onPlaced: setRefreshingBesideBack \}\s+: besideBackRow === 'beside'\s+\? refreshing\s+: undefined\s+\}/u,
    );
  });
});

describe('GivingWay draws Refreshing… out of the row’s flow (sc-74113)', () => {
  it('places the status inside besideRow.end', () => {
    expect(frame).toMatch(/\{fits && <View style=\{besideRow\.end\}>\{beside\.status\}<\/View>\}/u);
  });

  it('keeps besideRow.end absolute, so a late-growing Back is never squeezed', () => {
    expect(frame).toMatch(/\n {2}end: \{ position: 'absolute', top: 0, right: 0, bottom: 0,/u);
  });
});
