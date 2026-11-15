import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { NO_ORG, NO_ORG_PAGE, NO_ORG_STATES } from './noOrg.ts';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => __setConfig(tested));

async function inside(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-joana-rui-2?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Joana & Rui’s wedding' });

  return router;
}

const sidebar = () => within(screen.getByRole('navigation', { name: 'Joana & Rui’s wedding' }));
const areas = () =>
  within(sidebar().getByRole('list'))
    .getAllByRole('button')
    .map((one) => one.textContent);

describe('inside the event with no organisation, at a desk (sc-71, sc-31775)', () => {
  it.each(NO_ORG_STATES)('%s shows none of an organisation’s ways out', async (state) => {
    await inside(state);
    const page = within(document.body);

    expect(page.queryByRole('button', { name: /Switch organisation/u })).toBeNull();
    for (const name of ['Events', 'Settings', 'Today', 'Calendar']) {
      expect(page.queryByRole('link', { name }), name).toBeNull();
      expect(page.queryByRole('button', { name }), name).toBeNull();
    }
    expect(page.queryByRole('button', { name: /Search/u })).toBeNull();
    expect(page.queryByRole('navigation', { name: /Breadcrumb|Where you are/u })).toBeNull();
  });

  it('opens only what Can view reads, with no Check guests in', async () => {
    await inside('no-org');

    expect(areas()).toEqual(['Overview', 'Guests', 'Schedule', 'Seating', 'People']);
    expect(screen.getByText('Can view · Cloakroom · until Sat, Nov 14, 23:30')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Check guests in/u })).toBeNull();
    expect(screen.getByText('Names and replies only, no contact details')).toBeDefined();
    expect(screen.getByText('21 people on this event')).toBeDefined();
    expect(NO_ORG.onEvent(1)).toBe('1 person on this event');
    expect(sidebar().getByRole('button', { name: 'Lara Monteiro, Can view' })).toBeDefined();
  });

  it('puts Check guests in first at Can check guests in, and on the card', async () => {
    await inside('no-org-check-in');

    expect(areas()).toEqual([
      'Check guests in',
      'Overview',
      'Guests',
      'Schedule',
      'Seating',
      'People',
    ]);
    expect(
      within(screen.getByRole('main')).getByRole('button', { name: 'Check guests in' }),
    ).toBeDefined();
    expect(
      screen.getByText('Can check guests in · Bar and drinks · until Sat, Nov 14, 23:30'),
    ).toBeDefined();
  });

  it('reaches Your account and Sign out from the person button', async () => {
    const router = await inside('no-org-menu');
    const person = sidebar().getByRole('button', { name: 'Lara Monteiro, Can view' });
    const menu = within(screen.getByRole('menu'));

    expect(person.getAttribute('aria-expanded')).toBe('true');
    expect(menu.getAllByRole('menuitem').map((one) => one.textContent)).toEqual([
      'Your account',
      'Sign out',
    ]);
    await waitFor(() =>
      expect(document.activeElement).toBe(menu.getByRole('menuitem', { name: 'Your account' })),
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'End' });
    expect(document.activeElement).toBe(menu.getByRole('menuitem', { name: 'Sign out' }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Home' });
    expect(document.activeElement).toBe(menu.getByRole('menuitem', { name: 'Your account' }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(person);

    fireEvent.click(person);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(router.state.location.search).toBe('?state=signed-out');
    expect((await screen.findByRole('status')).textContent).toBe('Signed out.');
  });

  it('links each state from the demo’s home', () => {
    expect(NO_ORG_PAGE.states.map((one) => one.to)).toEqual(
      NO_ORG_STATES.map((state) => `/demo/events/evt-joana-rui-2?state=${state}`),
    );
  });
});
