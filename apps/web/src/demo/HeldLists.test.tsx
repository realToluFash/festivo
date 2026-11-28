import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { startSwitcher } from './switcher.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const YOURS = ['Account', 'Security', 'Notifications', 'Personalisation'];

function open(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

async function settled(path: string) {
  open(path);
  await screen.findByRole('button', { name: /^Organisation: Ire Events/ }, WAIT);
  fireEvent.keyDown(document.body, { key: 'Escape' });
}

function sidebar(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Soirely' });
}

function placesOf(): string[] {
  const places = sidebar().querySelector('.today-places');
  if (places == null) throw new Error('No places in the sidebar');

  return Array.from(places.querySelectorAll('li')).map((place) => place.textContent ?? '');
}

function sectionsOf(): string[] {
  return within(screen.getByRole('navigation', { name: 'Settings' }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label') ?? link.textContent ?? '');
}

function listed(names: readonly string[]) {
  return names.map((name) => expect.stringContaining(name));
}

describe('the demo hides what a held member cannot open, as the product does (sc-93443)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    startSwitcher(null);
  });

  afterEach(cleanup);

  it(
    'lists Vendors and Menu library for an admin held until two-factor, and no Members or Data and control',
    SLOW,
    async () => {
      open('/demo/settings?as=julien&state=heldTwoFactor&notice=gate');
      await screen.findByRole('navigation', { name: 'Settings' }, WAIT);

      expect(sectionsOf()).toEqual(listed([...YOURS, 'General', 'Sign-in rules', 'Vendors']));
      expect(placesOf()).toContain('Menu library');
    },
  );

  it('keeps Members, Vendors and Data and control for the same admin unheld', SLOW, async () => {
    open('/demo/settings?as=julien');
    await screen.findByRole('navigation', { name: 'Settings' }, WAIT);

    expect(sectionsOf()).toEqual(
      listed([...YOURS, 'General', 'Members', 'Sign-in rules', 'Vendors', 'Data and control']),
    );
  });

  it.each(['overdue', 'overdue-alone'])(
    'lists only what needs no permission with ?switcher=%s, on Settings and on Events',
    SLOW,
    async (state) => {
      await settled(`/demo/settings?switcher=${state}`);

      expect(sectionsOf()).toEqual(listed([...YOURS, 'General', 'Sign-in rules']));
      expect(placesOf()).toEqual(['Today', 'Events', 'Calendar']);

      cleanup();
      await settled(`/demo/events?switcher=${state}`);

      expect(placesOf()).toEqual(['Today', 'Events', 'Calendar']);
    },
  );

  it('keeps the hold on the way from Events to Settings', SLOW, async () => {
    await settled('/demo/events?switcher=overdue');
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Settings' }));
    await screen.findByRole('navigation', { name: 'Settings' }, WAIT);

    expect(sectionsOf()).toEqual(listed([...YOURS, 'General', 'Sign-in rules']));
  });

  it('stands the overdue card in at Members, with no entry lit', SLOW, async () => {
    await settled('/demo/settings/members?switcher=overdue');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Turn on two-factor to carry on' }),
    ).toBeDefined();
    expect(
      within(screen.getByRole('navigation', { name: 'Settings' }))
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0);
  });
});
