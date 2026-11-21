import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function open(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByText('Your shift', undefined, WAIT);
}

describe('the staff member’s page in the web demo (sc-3915)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(cleanup);

  it('heads with the station and follows the night’s order', SLOW, async () => {
    await open('/demo/my-night');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Tonight you’re on Section B',
    );
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your shift',
      'Your lead',
      'Before you start',
      'Tonight’s timing',
      'Your tables',
    ]);
    expect(screen.getByRole('link', { name: 'Call Dayo Okafor' }).getAttribute('href')).toBe(
      'tel:+2348031234567',
    );
    expect(screen.getByText('4 guests')).toBeDefined();
    expect(screen.getAllByText('Vegetarian')).toHaveLength(1);
  });

  it('announces a move and changes the heading and tables with it', SLOW, async () => {
    await open('/demo/my-night?state=night');

    fireEvent.click(screen.getByRole('button', { name: 'Move Grace to Section C' }));

    expect(
      screen.getByText('Updated: you’re now on Section C').closest('[aria-live]'),
    ).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Tonight you’re on Section C',
    );
    expect(screen.getByText('Table 11')).toBeDefined();
    expect(screen.queryByText('Table 7')).toBeNull();
  });

  it(
    'holds the tables before doors and shows the clock card early, saying when clocking in opens',
    SLOW,
    async () => {
      await open('/demo/my-night?state=early');

      expect(screen.getByText('Opens at 19:00 when doors open')).toBeDefined();
      const opens = screen.getByRole('button', { name: 'Clock in opens at 16:00' });
      expect((opens as HTMLButtonElement).disabled).toBe(true);
    },
  );

  it('clocks out from sc-234’s card above Your shift', SLOW, async () => {
    await open('/demo/my-night?state=night');

    const card = screen.getByRole('region', { name: 'Clock out' });
    expect(card.nextElementSibling?.textContent).toContain('Your shift');
    expect(screen.getByText('Clocked in at 16:58')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clock out' }));
    expect(await screen.findByText(/8 h 44 min recorded/u, undefined, WAIT)).toBeDefined();
  });

  it('says clock out after the first shift’s end on a two-shift night', SLOW, async () => {
    await open('/demo/my-night?state=two_shifts');

    expect(screen.getByText('Clock out when you finish, even if it’s after 23:00.')).toBeDefined();
  });

  it('stands the floor lead in, and says No lead named yet only with neither', SLOW, async () => {
    await open('/demo/my-night?state=no_station');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tonight you’re on Waiter');
    expect(screen.getByRole('link', { name: 'Call Kemi Adeyinka, floor lead' })).toBeDefined();
    expect(screen.queryByText('Your tables')).toBeNull();
    cleanup();

    await open('/demo/my-night?state=no_lead_none');
    expect(screen.getByText('No lead named yet')).toBeDefined();
    expect(screen.queryByRole('link', { name: /^Call/u })).toBeNull();
  });

  it('declares a stale night and tries again', SLOW, async () => {
    await open('/demo/my-night?state=stale');

    expect(screen.getByText('This is your night as it was at 19:32.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText('Couldn’t reach Soirely')).toBeNull();
  });

  it('keeps Sign out in the app and drops the browser’s line', SLOW, async () => {
    await open('/demo/my-night?state=app');

    expect(screen.queryByText(/This link is yours alone/u)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Sign out' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Signed in as Grace Okon').length).toBeGreaterThan(0);
  });
});
