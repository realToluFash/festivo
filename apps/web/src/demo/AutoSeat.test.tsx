import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/seating';

async function seating(state: string) {
  cleanup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Seating' }, WAIT);
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Panel' });
}

function block(): HTMLElement {
  return screen.getByRole('region', { name: 'Auto-seat by group' });
}

function go(): HTMLElement {
  return within(block()).getByRole('button', { name: 'Auto-seat by group' });
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

let fetched: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
  fetched = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  const calls = [...fetched.mock.calls];

  fetched.mockRestore();
  expect(calls).toEqual([]);
});

describe('Auto-seat by group (sc-4019)', () => {
  it('says what it will do first, proposes, and seats nobody until accepted', SLOW, async () => {
    await seating('autoBefore');
    fireEvent.click(go());
    const ask = screen.getByRole('alertdialog');

    expect(ask.textContent).toContain(
      'Seat 12 guests who are coming without a seat. Nobody already seated moves.',
    );
    expect(ask.textContent).toContain(
      'You will see the proposal first. Nothing is seated until you accept it.',
    );
    expect(ask.textContent).not.toContain('credit');
    fireEvent.click(within(ask).getByRole('button', { name: 'Propose' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(block().textContent).toContain('Proposed by Folake Adeyemi · 20:14.');
    expect(within(panel()).getByText('Without a seat').parentElement?.textContent).toContain('12');
    expect(panel().textContent).toContain('Proposed · 11');
    expect(panel().textContent).toContain('Left over · 1');
    expect(panel().textContent).toContain(
      'Not placed: Needs a seat near an exit, and none is free',
    );
    await waitFor(() =>
      expect(said()).toContain('Proposal ready: 11 guests at 2 tables. 1 guest is left over.'),
    );
  });

  it('accepts one table with Undo, and Undo brings the proposal back', SLOW, async () => {
    await seating('autoProposed');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Accept Table 8' }));
    expect(said()).toContain('3 guests seated at 1 table.');
    expect(panel().textContent).toContain('Proposed · 8');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(panel().textContent).toContain('Proposed · 11');
  });

  it('discards a table and then the rest, with no Undo', SLOW, async () => {
    await seating('autoProposed');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Discard Table 10' }));
    expect(said()).toContain('Proposal for Table 10 discarded.');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    fireEvent.click(within(block()).getByRole('button', { name: 'Discard all' }));
    expect(panel().textContent).not.toContain('Proposed ·');
    expect(block().textContent).not.toContain('Proposed by');
  });

  it('accepts all in one go: the button counts the guests', SLOW, async () => {
    await seating('autoProposed');
    fireEvent.click(within(block()).getByRole('button', { name: 'Accept all (11 guests)' }));
    expect(said()).toContain('11 guests seated at 2 tables.');
    expect(panel().textContent).toContain('Left over · 1');
  });

  it('refuses a table changed since, and offers Run Auto-seat again', SLOW, async () => {
    await seating('autoChanged');
    expect(said()).toContain('Table 8 has changed since this was proposed. Run Auto-seat again.');
    expect(within(panel()).getByRole('button', { name: 'Run Auto-seat again' })).toBeDefined();
    expect(within(panel()).queryByRole('button', { name: 'Accept Table 8' })).toBeNull();

    await seating('autoAllChanged');
    expect(said()).toContain(
      '8 guests seated at 1 table. Table 8 has changed since this was proposed. Run Auto-seat again.',
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined();
  });

  it('gives every reason a guest is left over', SLOW, async () => {
    await seating('autoLeftOver');
    const text = panel().textContent ?? '';

    expect(text).toContain('Not placed: No table has 2 seats together for Sophie Laurent’s party');
    expect(text).toContain('Not placed: Every table with room has someone from their Apart note');
    expect(text).toContain('Not placed: Needs a seat near an exit, and none is free');
  });

  it('warns that running it again replaces the proposal', SLOW, async () => {
    await seating('autoReplace');
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'This replaces the proposal by Priya Shah · 19:52.',
    );
  });

  it('is disabled with nobody to seat, and not there without seating.manage', SLOW, async () => {
    await seating('autoNobody');
    expect(go().hasAttribute('disabled')).toBe(true);
    expect(go().getAttribute('aria-describedby')).toBe('st-tray-said');
    expect(document.getElementById('st-tray-said')?.textContent).toBe(
      'Everyone who is coming has a seat.',
    );

    await seating('autoReadOnly');
    expect(screen.queryByRole('region', { name: 'Auto-seat by group' })).toBeNull();
  });

  it('names a proposed chair in the List and keeps it free', SLOW, async () => {
    await seating('autoList');
    expect(screen.getAllByText('Proposed: Amaka Eze').length).toBeGreaterThan(0);
  });
});
