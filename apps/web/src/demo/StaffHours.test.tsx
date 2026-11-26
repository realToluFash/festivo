import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 8000 };

async function open(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/staff/hours?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);
}

const table = () => screen.getByRole('table');

describe('Hours worked at a desk (sc-234)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows scheduled, clocked and hours, with both marks and the summary', SLOW, async () => {
    await open('list');

    expect(table().textContent).toContain('Not clocked out · Counted to 01:00, the scheduled end');
    expect(table().textContent).toContain('No attendance recorded · 0 h counted');
    expect(screen.getByText('81 h 10 min of 81 h 30 min scheduled')).toBeTruthy();
    expect(screen.queryByText(/£/)).toBeNull();
  });

  it('corrects a missing clock-out and keeps the original beside it', SLOW, async () => {
    await open('list');

    fireEvent.click(screen.getByRole('button', { name: 'Correct times, Ifeoma Nduka' }));
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('Not recorded, counted to 01:00')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save times' }));

    await waitFor(() =>
      expect(table().textContent).toContain('corrected from no clock-out by Amara Nwosu'),
    );
  });

  it('refuses a shift over 24 hours, at the clock-out', SLOW, async () => {
    await open('correct_long');

    expect(
      screen.getByText('A shift cannot be longer than 24 hours. Check the dates.'),
    ).toBeTruthy();
  });

  it('leaves Correct times out without the permission, not disabled', SLOW, async () => {
    await open('read_only');

    expect(screen.queryByRole('button', { name: /^Correct times/ })).toBeNull();
  });

  it('keeps a removed person under their name, and lets them be corrected', SLOW, async () => {
    await open('removed');

    const femi = within(table()).getByRole('rowheader', { name: /Femi Adeyemi/ });
    expect(femi.textContent).toContain('Removed from the roster');
    expect(
      within(table()).getByRole('rowheader', { name: /Chinedu Eze/ }).textContent,
    ).not.toContain('Removed');
    fireEvent.click(screen.getByRole('button', { name: 'Correct times, Femi Adeyemi' }));
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('Not recorded, counted to 00:00')).toBeTruthy();
  });

  it('shows who is in during service', SLOW, async () => {
    await open('list_live');

    expect(table().textContent).toContain('Clocked in');
    expect(table().textContent).toContain('Not clocked in yet');
  });
});
