import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetTab, loseConnection, tabNow } from './tabKept.ts';

const tested = config();
const SLOW = { timeout: 15000 };
const BOX = /^Offline · as of \d\d:\d\d$/;

function open(at: string) {
  const router = createMemoryRouter(routes, { initialEntries: [at] });
  render(<RouterProvider router={router} />);

  return router;
}

describe('offline, another area keeps the event, and the night its count (sc-65646)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    cleanup();
    forgetTab();
    __setConfig(tested);
  });

  it(
    'keeps the event on Guests under the box, then the night with its count and no box',
    SLOW,
    async () => {
      const router = open('/demo/events/evt-wed-4/night?tab=fresh');

      fireEvent.click(await screen.findByRole('button', { name: 'Lose the connection' }, SLOW));
      fireEvent.click(screen.getByRole('button', { name: /^Done: / }));
      expect(screen.getByText('1 press waiting to send.')).toBeDefined();
      expect(screen.queryByText(BOX)).toBeNull();

      await router.navigate('/demo/guests');
      expect(await screen.findByText('Offline · as of 20:02', {}, SLOW)).toBeDefined();
      expect(screen.getByRole('heading', { level: 1, name: 'Guests' })).toBeDefined();
      expect(screen.getByText('We could not load the guests.')).toBeDefined();
      expect(screen.queryByText('The event did not load. Try again in a moment.')).toBeNull();

      await router.navigate('/demo/events/evt-wed-4/schedule');
      await screen.findByRole('heading', { level: 1, name: 'Schedule' }, SLOW);
      expect(screen.getByText('Offline · as of 20:02')).toBeDefined();
      expect(screen.getByText('The schedule did not load.')).toBeDefined();
      fireEvent.click(screen.getByRole('link', { name: 'Run of show' }));

      expect(await screen.findByText('1 press waiting to send.', {}, SLOW)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Try now' })).toBeDefined();
      expect(screen.queryByText(BOX)).toBeNull();
      expect(screen.queryByText('The run of show did not load.')).toBeNull();

      fireEvent.click(screen.getAllByRole('button', { name: /^Start now: / })[0] as HTMLElement);
      expect(screen.getByText('2 presses waiting to send.')).toBeDefined();
    },
  );

  it('shows Guests as last loaded when it loaded in this tab before the drop', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4/night?tab=fresh');
    await screen.findByRole('button', { name: 'Lose the connection' }, SLOW);

    await router.navigate('/demo/guests');
    await screen.findByRole('heading', { level: 1, name: 'Guests' }, SLOW);
    expect(screen.queryByText(BOX)).toBeNull();

    await router.navigate('/demo/events/evt-wed-4/night');
    fireEvent.click(await screen.findByRole('button', { name: 'Lose the connection' }, SLOW));
    await router.navigate('/demo/guests');

    await screen.findByText(BOX, {}, SLOW);
    expect(screen.queryByText('We could not load the guests.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText(BOX)).toBeNull();
  });

  it('sends the queued presses once Try again answers elsewhere', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4/night?state=offline');
    expect(await screen.findByText('2 presses waiting to send.', {}, SLOW)).toBeDefined();

    await router.navigate('/demo/events/evt-wed-4');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }, SLOW));
    expect(screen.queryByText(BOX)).toBeNull();

    await router.navigate('/demo/events/evt-wed-4/night');
    await screen.findByRole('heading', { level: 1, name: 'Run of show' }, SLOW);
    expect(screen.queryByText(/waiting to send/)).toBeNull();
    expect(screen.getByText('Live · updated just now')).toBeDefined();
  });

  it('says the event did not load for one this tab never loaded', SLOW, async () => {
    open('/demo/events/evt-wed-4?tab=offline');

    expect(
      await screen.findByText('The event did not load. Try again in a moment.', {}, SLOW),
    ).toBeDefined();
    expect(screen.queryByText(BOX)).toBeNull();
  });

  it('opens online with no box', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4?tab=fresh');
    await screen.findByRole('heading', { level: 1 }, SLOW);

    await router.navigate('/demo/guests');
    await screen.findByRole('heading', { level: 1, name: 'Guests' }, SLOW);
    expect(screen.queryByText(BOX)).toBeNull();
  });

  it('notes the area that is open, not Overview, when an area loads', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4?area=reports&tab=fresh');
    await screen.findByRole('heading', { level: 1, name: 'Reports' }, SLOW);

    expect(tabNow().areas.has('evt-wed-4|reports')).toBe(true);
    expect(tabNow().areas.has('evt-wed-4|overview')).toBe(false);

    await router.navigate('/demo/events/evt-wed-4');
    await screen.findByRole('heading', { level: 1 }, SLOW);
    expect(tabNow().areas.has('evt-wed-4|overview')).toBe(true);
  });

  it.each([
    ['Seating', '/demo/events/evt-wed-4/seating'],
    ['Menu', '/demo/events/evt-wed-4/menu'],
    ['the kitchen', '/demo/events/evt-wed-4/kitchen'],
    ['Staff, the roster', '/demo/events/evt-wed-4/staff/roster'],
    ['Staff, the stations', '/demo/events/evt-wed-4/staff/stations'],
    ['Budget', '/demo/events/evt-wed-4?area=budget'],
    ['Messages', '/demo/events/evt-wed-4/messages'],
  ])('draws the box above %s once the event is kept offline', SLOW, async (_area, at) => {
    const router = open('/demo/events/evt-wed-4?tab=fresh');
    await screen.findByRole('heading', { level: 1 }, SLOW);
    act(() => loseConnection());

    await router.navigate(at);
    expect(await screen.findByText(BOX, {}, SLOW)).toBeDefined();
    expect(screen.queryByText('The event did not load. Try again in a moment.')).toBeNull();
  });
});
