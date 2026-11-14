import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { startSwitcher } from './switcher.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 15000 };
const TITLE = 'Managed by Ire Events';
const BODY = 'Your ire.events address is managed by Ire Events, so you can only be a member there.';

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

function banner(): HTMLElement {
  return screen.getByRole('heading', { name: TITLE }).closest('section') as HTMLElement;
}

function saysManaged(): void {
  const refusal = banner();

  expect(within(refusal).getByText(BODY)).toBeDefined();
  expect(within(refusal).getByText('Access to a single event still works.')).toBeDefined();
  expect(
    within(refusal)
      .getByRole('link', { name: 'Change your main email address' })
      .getAttribute('href'),
  ).toBe('/demo/settings/account');
}

describe('an account its home organisation manages, outside Settings (sc-563)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    startSwitcher(null);
  });

  it(
    'refuses Create an organisation with the banner in its first step’s place, and Close',
    SLOW,
    async () => {
      open('/demo/events?create=managed');
      const walk = await screen.findByRole('dialog', { name: 'Create an organisation' }, WAIT);

      saysManaged();
      expect(within(walk).queryByLabelText('Organisation name')).toBeNull();
      fireEvent.click(within(walk).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

  it('refuses an invitation’s Join with the banner in place of its buttons', SLOW, async () => {
    open('/demo/events?switcher=managed');
    await screen.findByRole('button', { name: /^Organisation: Ire Events/u }, WAIT);
    const panel = screen.getByRole('group', { name: 'Celebraciones Alameda' });

    expect(within(panel).getByText('Invitation from Kemi Adeyemi · Member')).toBeDefined();
    saysManaged();
    expect(within(panel).queryByRole('button', { name: /^Accept and join/u })).toBeNull();
  });

  it('refuses a request link’s Ask to join with the banner', SLOW, async () => {
    open('/demo/ways-in?page=ask&state=managed');
    await screen.findByRole('heading', { level: 1, name: 'Ask to join Lumen Feiras' }, WAIT);

    saysManaged();
    expect(banner().getAttribute('role')).toBe('alert');
    expect(screen.queryByRole('button', { name: 'Ask to join' })).toBeNull();
  });

  it('puts the banner in A few details where Start my own organisation was', SLOW, async () => {
    open('/demo/ways-in?page=details&state=managed');
    await screen.findByRole('heading', { level: 1, name: 'A few details' }, WAIT);

    saysManaged();
    expect(screen.getByRole('button', { name: 'Ask to join Ire Events' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start my own organisation' })).toBeNull();
  });

  it(
    'says under Priya’s card that she is also a member of 2 other organisations, no names',
    SLOW,
    async () => {
      open('/demo/settings/members?state=alsoMember');
      await screen.findByRole('heading', { name: 'Priya Shah' }, WAIT);

      expect(screen.getByText('Also a member of 2 other organisations')).toBeDefined();
    },
  );

  it('says nothing of other organisations on Priya’s page otherwise', SLOW, async () => {
    open('/demo/settings/members?state=priya');
    await screen.findByRole('heading', { name: 'Priya Shah' }, WAIT);

    expect(screen.queryByText(/^Also a member of/u)).toBeNull();
  });

  it(
    'tags ire.events Proved in Company domain joining when it is on both lists',
    SLOW,
    async () => {
      open('/demo/settings/general?state=domainBoth');
      await screen.findByRole('heading', { level: 1, name: 'General' }, WAIT);
      const joining = screen
        .getByRole('heading', { level: 2, name: 'Company domain joining' })
        .closest('section') as HTMLElement;

      expect(within(joining).getByText('Proved')).toBeDefined();
      expect(within(joining).getByText('People at it can ask to join')).toBeDefined();
    },
  );
});
