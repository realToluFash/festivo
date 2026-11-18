import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { E1, E2, E3, E4 } from './outsideEvents.ts';
import { startSwitcher } from './switcher.ts';

const tested = config();

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  startSwitcher(null);
});

afterEach(() => __setConfig(tested));

async function open(path: string, heading: string = E2.name) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: heading });

  return router;
}

const inside = (state: string) => open(`/demo/events/${E2.id}?state=${state}`);
const items = () =>
  screen.getAllByRole('menuitem').map((one) => one.getAttribute('aria-label') ?? one.textContent);
const areas = (name: string) =>
  within(within(screen.getByRole('navigation', { name })).getByRole('list'))
    .getAllByRole('button')
    .map((one) => one.textContent);

describe('Your events in the person menu, with no organisation (sc-68438)', () => {
  it('shows nothing new with one event', async () => {
    await inside('outside-one');

    expect(items()).toEqual(['Your account', 'Sign out']);
    expect(screen.queryByText('Your events')).toBeNull();
  });

  it('lists under way first and You’re here in its place, every row reachable by the arrows', async () => {
    await inside('outside-several');
    const all = screen.getAllByRole('menuitem');

    expect(screen.getByRole('group', { name: 'Your events' })).toBeDefined();
    expect(items().map((one) => one.split('. ')[0])).toEqual([
      E1.name,
      E2.name,
      E3.name,
      E4.name,
      'Your account',
      'Sign out',
    ]);
    expect(items()[0]).toMatch(/\. Under way$/u);
    expect(items()[1]).toBe(`${E2.name}. Lumen Feiras · Sat, Nov 14 · 15:00. You’re here`);
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(all[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(all[5]);
    fireEvent.keyDown(all[5]!, { key: 'ArrowDown' });
    fireEvent.keyDown(all[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[1]);
  });

  it('only closes on You’re here', async () => {
    await inside('outside-two');
    fireEvent.click(screen.getByRole('menuitem', { name: /You’re here$/u }));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: E2.name })).toBeDefined();
  });

  it('opens another event at its level', async () => {
    await inside('outside-several');
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${E3.name}`, 'u') }));
    await screen.findByRole('heading', { level: 1, name: E3.name });

    expect(areas(E3.name)).toEqual(['Overview', 'Guests', 'Schedule', 'Seating', 'People']);
    expect(screen.getByRole('button', { name: 'João Pereira, Can view' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'João Pereira, Can view' }));
    expect(screen.getByRole('menuitem', { name: /^Soirée.*You’re here$/u })).toBeDefined();
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${E4.name}`, 'u') }));
    await screen.findByRole('heading', { level: 1, name: E4.name });

    expect(areas(E4.name)).toEqual([
      'Overview',
      'Guests',
      'Menu',
      'Seating',
      'Messages',
      'Schedule',
      'Staff',
      'People',
      'Reports',
    ]);
  });

  it('opens a revoked grant on the event not-found page, and drops it on the way back', async () => {
    await inside('outside-gone');
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${E4.name}`, 'u') }));
    await screen.findByRole('heading', { level: 1, name: 'This event is not available' });

    expect(screen.getByRole('navigation', { name: E2.name })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: `Back to ${E2.name}` }));
    await screen.findByRole('heading', { level: 1, name: E2.name });

    expect(items().map((one) => one.split('. ')[0])).toEqual([
      E1.name,
      E2.name,
      E3.name,
      'Your account',
      'Sign out',
    ]);
  });
});

describe('the way back from a gone event, with no organisation (sc-68438)', () => {
  const notFound = 'This event is not available';
  const goneFrom = async (state: string, event: { name: string }) => {
    const router = await inside(state);
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${event.name}`, 'u') }));
    await screen.findByRole('heading', { level: 1, name: notFound });

    return router;
  };

  it('names sc-71’s landing pick when the page was opened from its address', async () => {
    await open(`/demo/events/${E4.id}?state=outside-gone-page`, notFound);
    fireEvent.click(screen.getByRole('button', { name: `Back to ${E1.name}` }));
    await screen.findByRole('heading', { level: 1, name: E1.name });

    expect(items().map((one) => one.split('. ')[0])).toEqual([
      E1.name,
      E2.name,
      E3.name,
      'Your account',
      'Sign out',
    ]);
  });

  it('names the landing pick when the event it came from is gone too', async () => {
    await goneFrom('outside-gone-both', E4);

    expect(screen.queryByRole('button', { name: `Back to ${E2.name}` })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Back to ${E1.name}` }));
    await screen.findByRole('heading', { level: 1, name: E1.name });

    expect(items().map((one) => one.split('. ')[0])).toEqual([
      E1.name,
      E3.name,
      'Your account',
      'Sign out',
    ]);
  });

  it('reads Continue and opens the no-organisation home with no live grant left', async () => {
    const router = await goneFrom('outside-gone-last', E4);

    expect(screen.queryByRole('button', { name: /^Back to/u })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(router.state.location.search).toBe('?orgs=none'));

    expect(router.state.location.pathname).toBe('/demo/today');
  });

  it('keeps a member’s Events crumb and no Back to', async () => {
    const router = await goneFrom('inside-member-gone', E3);

    expect(screen.queryByRole('button', { name: /^Back to|^Continue$/u })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Events' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/demo/events'));
  });
});

describe('a member inside an event from outside (sc-68438)', () => {
  it('lists Your organisations, then Your events, then the account', async () => {
    await inside('inside-member');

    expect(screen.getByRole('group', { name: 'Your organisations' })).toBeDefined();
    expect(items()).toEqual([
      'Ire Events. Owner',
      'Casa Lumen Eventos. Admin',
      'Atelier Céleste Réceptions et Mariages. Member',
      expect.stringMatching(/Under way$/u),
      expect.stringMatching(/You’re here$/u),
      expect.stringMatching(/^Soirée/u),
      'Your account',
      'Sign out',
    ]);
    expect(screen.queryByRole('button', { name: /Switch organisation/u })).toBeNull();
  });

  it('lists only Your organisations with one event from outside', async () => {
    await inside('inside-member-one');

    expect(screen.queryByRole('group', { name: 'Your events' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Your organisations' })).toBeDefined();
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  it('opens an organisation’s Today with it current', async () => {
    await inside('inside-member');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Casa Lumen Eventos. Admin' }));

    expect(
      await screen.findByRole('button', {
        name: /^Organisation: Casa Lumen Eventos, your role Admin/u,
      }),
    ).toBeDefined();
  });
});

describe('Events from outside in the switcher (sc-68438)', () => {
  it('sits between the organisations and the invitations, with no You’re here', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/today?switcher=outside'] });
    render(<RouterProvider router={router} />);
    const menu = await screen.findByRole('dialog', { name: 'Where are you working?' });
    const words = menu.textContent ?? '';

    expect(words.indexOf('Atelier Céleste')).toBeLessThan(words.indexOf('Events from outside'));
    expect(words.indexOf('Events from outside')).toBeLessThan(words.indexOf('Celebraciones'));
    expect(words).not.toContain('You’re here');
    expect(
      within(menu)
        .getAllByRole('button', { name: /Lumen Feiras|Under way|Bastide/u })
        .map((one) => one.getAttribute('aria-label')?.split('. ')[0]),
    ).toEqual([E1.name, E2.name, E3.name]);

    fireEvent.click(within(menu).getByRole('button', { name: new RegExp(`^${E1.name}`, 'u') }));
    await screen.findByRole('heading', { level: 1, name: E1.name });

    expect(areas(E1.name)[0]).toBe('Check guests in');
    expect(screen.queryByRole('button', { name: /Switch organisation/u })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Folake/u }));
    expect(
      screen.getByRole('menuitem', { name: /^Congresso.*Under way\. You’re here$/u }),
    ).toBeDefined();
  });

  it('still shows the group with one organisation and one event', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/demo/today?switcher=outside-one-org'],
    });
    render(<RouterProvider router={router} />);
    const menu = await screen.findByRole('dialog', { name: 'Where are you working?' });

    expect(within(menu).getByRole('heading', { name: 'Events from outside' })).toBeDefined();
    expect(
      within(menu).getByRole('button', { name: new RegExp(`^${E2.name}`, 'u') }),
    ).toBeDefined();
    expect(within(menu).queryByText('Celebraciones Alameda')).toBeNull();
    expect(within(menu).getByText('Create an organisation')).toBeDefined();
  });
});
