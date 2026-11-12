import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { DW, copyRefusal, guestsToCopy } from './duplicateGuests.ts';
import { resetSample } from './events.ts';
import { peopleOn } from './guests.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const WEDDING = 'Adaeze & Tunde’s wedding';
const ENGAGEMENT = 'Bisi & Kola’s engagement';
const BOX = /^Also copy the guest list/;

async function at(state: string, event = 'evt-wed-4', name = WEDDING) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/${event}?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name }, WAIT);

  return router;
}

function dialog(name = 'Duplicate'): HTMLElement {
  return screen.getByRole('dialog', { name });
}

function list(heading: string): string[] {
  const head = within(dialog()).getByRole('heading', { level: 3, name: heading });
  let around: HTMLElement | null = head;
  while (around != null && around.querySelector('ul') == null) around = around.parentElement;
  const items = around?.querySelector('ul')?.querySelectorAll('li') ?? [];

  return [...items].map((item) => item.textContent ?? '');
}

describe('Duplicate copies the guest list on request (sc-3656)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  afterEach(cleanup);

  it('counts each guest once, without companions, and a copy as people', () => {
    expect(guestsToCopy('evt-wed-4')).toBe(101);
    expect(copyRefusal('evt-wed-4')).toEqual({
      type: 'plan_limit_reached',
      count: peopleOn('evt-wed-4'),
      limit: 100,
      plan: 'Free',
    });
    expect(copyRefusal('evt-draft-4')).toBeNull();
    expect(DW.box(1)).toBe('Also copy the guest list (1 guest)');
    expect(DW.box(1180)).toBe('Also copy the guest list (1,180 guests)');
    expect(DW.copied(1)).toBe('1 guest copied. Nobody was invited or contacted.');
  });

  it(
    'offers the tick off, with its hint, and leaves the lists as sc-3593 has them',
    SLOW,
    async () => {
      await at('duplicate');
      const box = within(dialog()).getByRole('checkbox', {
        name: 'Also copy the guest list (101 guests)',
      });

      expect((box as HTMLInputElement).checked).toBe(false);
      expect(box.getAttribute('aria-describedby')).toBeTruthy();
      expect(within(dialog()).getByText(DW.hint)).toBeDefined();
      expect(list('Not copied')).toContain('Guests');
      expect(list('Not copied')).toContain('Replies');
    },
  );

  it('moves guests to Copied and replies to what is never copied once ticked', SLOW, async () => {
    await at('duplicate');
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: BOX }));

    expect(list('Copied')).toContain('101 guests: names, contact details and companions');
    expect(list('Not copied')).not.toContain('Guests');
    expect(list('Not copied')).not.toContain('Replies');
    expect(list('Not copied')).toContain(DW.notCopiedGuests);
    expect(list('Not copied')).toContain('Anything that happened at the event');
  });

  it(
    'shows no tick on an event with no guests, nor to someone without guests.manage',
    SLOW,
    async () => {
      await at('duplicateNoGuests', 'evt-cena-4', 'Cena benéfica Fundación Lucía');
      expect(within(dialog()).queryByRole('checkbox', { name: BOX })).toBeNull();
      cleanup();

      await at('duplicateNoManage');
      expect(within(dialog()).queryByRole('checkbox', { name: BOX })).toBeNull();
      expect(list('Not copied')).toContain('Guests');
    },
  );

  it('says how many guests were copied and that nobody was contacted', SLOW, async () => {
    const router = await at('duplicateTicked', 'evt-draft-4', ENGAGEMENT);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Create draft' }));

    expect(
      await screen.findByText(
        'Draft created. Opening it. 11 guests copied. Nobody was invited or contacted.',
        {},
        WAIT,
      ),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/events/evt-draft-4-copy-1');
  });

  it('holds the form still while creating, and says Not created when it fails', SLOW, async () => {
    await at('duplicateCreating', 'evt-draft-4', ENGAGEMENT);
    expect(
      (within(dialog()).getByRole('checkbox', { name: BOX }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(within(dialog()).getByText(DW.creating)).toBeDefined();
    cleanup();

    await at('duplicateNotCreated', 'evt-draft-4', ENGAGEMENT);
    expect(within(dialog()).getByRole('alert').textContent).toBe(DW.notCreated);
  });

  it(
    'refuses a ticked copy over the plan in the dialog’s place, and goes back with the tick kept',
    SLOW,
    async () => {
      await at('duplicate');
      fireEvent.click(within(dialog()).getByRole('checkbox', { name: BOX }));
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Create draft' }));

      const refused = await screen.findByRole(
        'dialog',
        { name: 'Your plan allows 100 people per event' },
        WAIT,
      );

      expect(screen.queryByRole('dialog', { name: 'Duplicate' })).toBeNull();
      expect(
        within(refused).getByText(
          'Not created. The guest list would bring 156 people, and your plan has room for 100 in a new event.',
        ),
      ).toBeDefined();
      expect(
        within(refused).getByText('156 people · companions count as people · Free plan'),
      ).toBeDefined();
      expect(within(refused).getByText(DW.untick)).toBeDefined();
      expect(within(refused).getByRole('button', { name: 'Change plan' })).toBeDefined();
      expect(within(refused).queryByRole('button', { name: /Remove a guest/ })).toBeNull();

      fireEvent.click(within(refused).getByRole('button', { name: 'Back to the form' }));

      expect(
        (within(dialog()).getByRole('checkbox', { name: BOX }) as HTMLInputElement).checked,
      ).toBe(true);
    },
  );

  it(
    'offers Ask an owner without billing.manage, and only the untick line over the ceiling',
    SLOW,
    async () => {
      await at('duplicateOverPlanAsk');
      const refused = dialog('Your plan allows 100 people per event');

      fireEvent.click(within(refused).getByRole('button', { name: 'Ask an owner' }));
      expect(within(refused).getByText(DW.asked)).toBeDefined();
      cleanup();

      await at('duplicateOverCeiling');
      const ceiling = dialog('An event can hold 10,000 people');

      expect(within(ceiling).getByText('10,214 people · companions count as people')).toBeDefined();
      expect(within(ceiling).queryByRole('button', { name: 'Change plan' })).toBeNull();
      expect(within(ceiling).queryByRole('button', { name: 'Ask an owner' })).toBeNull();
    },
  );
});
