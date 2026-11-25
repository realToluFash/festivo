import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { companionLine, guestTableStateOf, placeOf, shownSeat } from './guestTable.ts';

const SLOW = { timeout: 15000 };
const tested = config();

async function guest(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guest?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('banner', {}, SLOW);
}

function card(name = 'Your table'): HTMLElement {
  return screen.getByRole('region', { name });
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  __setConfig(tested);
});

describe('the rules', () => {
  it('writes a table, a seat in a row, and a companion with no name', () => {
    expect(placeOf({ kind: 'table', table: 'Table 4', section: 'Main hall' })).toBe(
      'Table 4 · Main hall',
    );
    expect(placeOf({ kind: 'row', row: 'C', seat: 4, section: 'Balcony' })).toBe(
      'Row C, seat 4 · Balcony',
    );
    expect(placeOf({ kind: 'table', table: 'Table 4', section: null })).toBe('Table 4');
    expect(
      companionLine({
        name: null,
        seat: { kind: 'table', table: 'Table 6', section: 'Main hall' },
      }),
    ).toBe('Your guest: Table 6');
  });

  it('shows a seat only to a Coming guest who has one, and only once shared', () => {
    const seat = { kind: 'table', table: 'Table 4', section: null } as const;
    const coming = { answer: 'coming', on: '2026-10-27' } as const;

    expect(shownSeat({ seating: { seat, elsewhere: [] }, recorded: coming })).not.toBeNull();
    expect(shownSeat({ seating: null, recorded: coming })).toBeNull();
    expect(shownSeat({ seating: { seat: null, elsewhere: [] }, recorded: coming })).toBeNull();
    expect(
      shownSeat({
        seating: { seat, elsewhere: [] },
        recorded: { answer: 'notSure', on: '2026-10-27' },
      }),
    ).toBeNull();
  });

  it('reads its states from ?state=table…', () => {
    expect(guestTableStateOf('table')).toBe('table');
    expect(guestTableStateOf('tableRowSeat')).toBe('rowSeat');
    expect(guestTableStateOf('tableNope')).toBeNull();
    expect(guestTableStateOf('coming')).toBeNull();
  });
});

describe('Your table on the guest’s page (sc-4022)', () => {
  it('says where a seated Coming guest sits, under their answer', SLOW, async () => {
    await guest('table');

    expect(card().textContent).toBe('Your table: Table 4 · Main hall');
    expect(
      within(card())
        .getByText(/Table 4/u)
        .closest('[aria-live]')
        ?.getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('names a seat in a row', SLOW, async () => {
    await guest('tableRowSeat');

    expect(card('Your seat').textContent).toBe('Your seat: Row C, seat 4 · Balcony');
  });

  it('adds a line for each companion seated elsewhere', SLOW, async () => {
    await guest('tableCompanionsElsewhere');
    const lines = within(card())
      .getAllByRole('listitem')
      .map((one) => one.textContent);

    expect(lines).toEqual(['Kemi Okonkwo: Table 6', 'Your guest: Table 6']);
  });

  it('follows the host’s move while the page is open', SLOW, async () => {
    await guest('tableMoved');
    fireEvent.click(within(card()).getByRole('button', { name: 'Move to Table 6' }));

    expect(within(card()).getByText(/^Your table:/u).textContent).toBe(
      'Your table: Table 6 · Main hall',
    );
  });

  it(
    'shows nothing about seating before sharing, unseated, proposed, Not sure yet or Not coming',
    SLOW,
    async () => {
      for (const state of [
        'tableNotShared',
        'tableUnseated',
        'tableProposed',
        'tableMaybe',
        'tableNotComing',
      ]) {
        await guest(state);
        expect(screen.queryByRole('region', { name: /^Your (table|seat)$/u })).toBeNull();
        expect(document.body.textContent).not.toMatch(/Table 4|Your table/u);
        cleanup();
      }
    },
  );

  it('sits between Where and The day on the event’s day', SLOW, async () => {
    await guest('tableOnTheDay');
    const order = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);

    expect(order.slice(0, 3)).toEqual(['Your code', 'Where', 'Your table']);
    expect(card().textContent).toContain('Table 4 · Main hall');
  });
});
