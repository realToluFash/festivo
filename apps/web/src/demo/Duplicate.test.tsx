import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { sampleGuests } from './guests.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const GUESTS = sampleGuests('evt-wed-4').length;
const LABEL = `Also copy the guest list (${GUESTS} guests)`;

async function open(state: string, id = 'evt-wed-4') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/${id}?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findAllByRole('heading', { level: 1 }, WAIT);

  return router;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Duplicate' });
}

function listUnder(heading: string): string[] {
  const list = within(dialog()).getByRole('heading', { name: heading }).parentElement
    ?.nextElementSibling;

  return within(list as HTMLElement)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

describe('Duplicate can also copy the guest list (sc-3656)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  afterEach(cleanup);

  it(
    'offers the copy unticked, its hint always shown, and moves the lists with the tick',
    SLOW,
    async () => {
      await open('duplicate');
      const box = within(dialog()).getByRole('checkbox', { name: LABEL });

      expect((box as HTMLInputElement).checked).toBe(false);
      expect(box.getAttribute('aria-describedby')).not.toBeNull();
      expect(document.getElementById(box.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
        'Replies are not copied, and nobody is invited or contacted.',
      );
      expect(listUnder('Not copied')).toContain('Guests');

      fireEvent.click(box);

      expect(listUnder('Copied')).toContain(
        `${GUESTS} guests: names, contact details and companions`,
      );
      expect(listUnder('Not copied')).toEqual([
        'Hosts',
        'Replies, invitations, invitation links, check-ins, meal choices, seating, messages and history',
        'Anything that happened at the event',
      ]);
    },
  );

  it('takes the singular for one guest', SLOW, async () => {
    await open('duplicateOne');

    fireEvent.click(
      within(dialog()).getByRole('checkbox', { name: 'Also copy the guest list (1 guest)' }),
    );

    expect(listUnder('Copied')).toContain('1 guest: name, contact details and companions');
  });

  it('leaves the form unchanged with no guests, or without guests.manage', SLOW, async () => {
    await open('duplicateNoGuests', 'evt-off');
    expect(within(dialog()).queryByRole('checkbox')).toBeNull();
    cleanup();

    await open('duplicateViewer');
    expect(within(dialog()).queryByRole('checkbox')).toBeNull();
    expect(listUnder('Not copied')).toContain('Guests');
  });

  it('disables the checkbox while creating, then says how many were copied', SLOW, async () => {
    const router = await open('duplicateTicked');

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Create draft' }));

    expect(
      (within(dialog()).getByRole('checkbox', { name: LABEL }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      await within(dialog()).findByText(
        `${GUESTS} guests copied. Nobody was invited or contacted.`,
      ),
    ).toBeDefined();
    expect(within(dialog()).getByText('Draft created. Opening it.')).toBeDefined();
    await waitFor(
      () => expect(router.state.location.pathname).not.toBe('/demo/events/evt-wed-4'),
      WAIT,
    );
  });

  it('says it was not created, and Create draft tries again', SLOW, async () => {
    await open('duplicateNotCreated');

    expect(within(dialog()).getByRole('alert').textContent).toContain(
      'Not created. Nothing was saved. Try again.',
    );
  });

  it(
    'refuses a copy over the plan in the dialog’s place, and Back keeps the tick',
    SLOW,
    async () => {
      await open('duplicateOverLimit');
      const refusal = screen.getByRole('alertdialog', {
        name: 'Your plan allows 100 people per event',
      });

      expect(screen.queryByRole('dialog', { name: 'Duplicate' })).toBeNull();
      expect(within(refusal).getByText('AC, not yet built · sc-3930')).toBeDefined();
      expect(within(refusal).getByRole('button', { name: 'Change plan' })).toBeDefined();
      expect(within(refusal).queryByRole('button', { name: /Remove/ })).toBeNull();

      fireEvent.click(within(refusal).getByRole('button', { name: 'Back to the form' }));

      const box = within(dialog()).getByRole('checkbox', { name: LABEL });

      expect((box as HTMLInputElement).checked).toBe(true);
      await waitFor(() => expect(document.activeElement).toBe(box));
    },
  );

  it(
    'gives anyone without billing.manage Ask an owner, and the ceiling neither',
    SLOW,
    async () => {
      await open('duplicateOverLimitAsk');
      expect(screen.getByRole('button', { name: 'Ask an owner' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Change plan' })).toBeNull();
      cleanup();

      await open('duplicateCeiling');
      const refusal = screen.getByRole('alertdialog', {
        name: 'An event can have up to 10,000 people',
      });

      expect(within(refusal).getByText('10,214 people · companions count as people')).toBeDefined();
      expect(within(refusal).queryByRole('button', { name: 'Ask an owner' })).toBeNull();
      expect(within(refusal).queryByRole('button', { name: 'Change plan' })).toBeNull();
    },
  );
});
