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

      expect(screen.getByText('Shown when doors open, at 19:00')).toBeDefined();
      const opens = screen.getByRole('button', { name: 'Clock in opens at 16:00' });
      expect((opens as HTMLButtonElement).disabled).toBe(true);
    },
  );

  it('clocks out from sc-234’s card above Your shift', SLOW, async () => {
    await open('/demo/my-night?state=night');

    const card = screen.getByRole('region', { name: 'Clock out' });
    expect(card.nextElementSibling?.textContent).toBe('Open Floor');
    expect(card.nextElementSibling?.nextElementSibling?.textContent).toContain('Your shift');
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
    expect(screen.queryByText('Cannot reach Soirely')).toBeNull();
  });

  it('keeps Sign out in the app and drops the browser’s line', SLOW, async () => {
    await open('/demo/my-night?state=app');

    expect(screen.queryByText(/This link is yours alone/u)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Sign out' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Signed in as Grace Okon').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Overview' })).toBeDefined();
  });
});

describe('Open Floor on Your night in a browser (sc-98893)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(cleanup);

  const buttons = () =>
    screen
      .getAllByRole('link')
      .filter((link) => ['Check-in', 'Open Floor'].includes(link.textContent ?? ''))
      .map((link) => [link.textContent, link.className.split(' ')[0]]);

  it('is the page’s one primary button on a section, before doors too', SLOW, async () => {
    for (const state of ['night', 'before_doors']) {
      await open(`/demo/my-night?state=${state}`);
      expect(buttons()).toEqual([['Open Floor', 'ci-primary']]);
      cleanup();
    }
  });

  it('is the secondary directly under Check-in when the job checks in', SLOW, async () => {
    await open('/demo/my-night?state=section_checkin');

    expect(buttons()).toEqual([
      ['Check-in', 'ci-primary'],
      ['Open Floor', 'ci-secondary'],
    ]);
  });

  it(
    'is not there for a kitchen station, no station or a level that does not open the floor',
    SLOW,
    async () => {
      for (const state of ['kitchen', 'no_station', 'section_pass', 'section_view']) {
        await open(`/demo/my-night?state=${state}`);
        expect(buttons()).toEqual([]);
        cleanup();
      }
      await open('/demo/my-night?state=section_door');
      expect(buttons()).toEqual([['Check-in', 'ci-primary']]);
    },
  );

  it(
    'opens Floor in the same tab, whose way back returns to Your night signed in',
    SLOW,
    async () => {
      await open('/demo/my-night?state=night');

      fireEvent.click(screen.getByRole('link', { name: 'Open Floor' }));
      expect(await screen.findByRole('heading', { name: 'Floor' }, WAIT)).toBeDefined();
      expect(screen.getByText(/Still signed in as Grace Okon, with no new sign-in/u)).toBeDefined();
      fireEvent.click(screen.getByRole('link', { name: 'Your night' }));
      expect(await screen.findByText('Your shift', undefined, WAIT)).toBeDefined();
    },
  );

  it('stays after a section move', SLOW, async () => {
    await open('/demo/my-night?state=night');

    fireEvent.click(screen.getByRole('button', { name: 'Move Grace to Section C' }));
    expect(buttons()).toEqual([['Open Floor', 'ci-primary']]);
  });
});
