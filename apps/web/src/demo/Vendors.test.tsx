import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 8000 };

function main(): HTMLElement {
  return screen.getByRole('main');
}

function side(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Soirely' });
}

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('navigation', { name: 'Soirely' }, SLOW);

  return router;
}

function rows(): string[] {
  return within(main())
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

describe('Vendors at a desk in B Confetti (sc-82)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  it('opens from the sidebar on the first 25 of 30, in name order', SLOW, async () => {
    const router = await open('/demo/today');

    fireEvent.click(within(side()).getByRole('link', { name: 'Vendors' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Vendors' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/vendors');
    expect(rows()).toHaveLength(25);
    expect(rows()[0]).toContain('Àbẹ̀ní Flowers');
    expect(rows()[2]).toContain('+234 803 555 0142');
    expect(within(main()).getByText('1 to 25 of 30, A to Z')).toBeDefined();

    fireEvent.click(within(main()).getByRole('button', { name: /Next/ }));

    expect(rows()).toHaveLength(5);
    expect(within(main()).getByText('26 to 30 of 30, A to Z')).toBeDefined();
  });

  it('tells an empty directory from a search that matched nothing', SLOW, async () => {
    await open('/demo/vendors?state=empty');

    expect(within(main()).getByText('No vendors yet')).toBeDefined();
    expect(within(main()).getAllByRole('button', { name: 'Add a vendor' })).toHaveLength(2);

    cleanup();
    await open('/demo/vendors?state=noMatch');

    expect(within(main()).getByText('No vendors have “eclat” in their name.')).toBeDefined();
    expect(within(main()).queryByText('No vendors yet')).toBeNull();

    const none = within(main()).getByRole('heading', { name: 'No match' }).parentElement;
    if (none == null) throw new Error('no match is not drawn');
    fireEvent.click(within(none).getByRole('button', { name: 'Clear the search' }));

    expect(rows()).toHaveLength(25);
  });

  it('archives in one press and restores from Archived', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('/demo/vendors');
    fireEvent.click(within(main()).getByRole('button', { name: /^Golden Spoon,/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit vendor' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive this vendor' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(main()).queryByRole('button', { name: /^Golden Spoon,/ })).toBeNull();

    fireEvent.click(within(main()).getByRole('tab', { name: /Archived/ }));
    const spoon = within(main())
      .getAllByRole('listitem')
      .find((item) => item.textContent?.startsWith('Golden Spoon'));
    if (spoon == null) throw new Error('Golden Spoon is not archived');

    expect(spoon.textContent).toMatch(/Archived /);

    fireEvent.click(within(spoon).getByRole('button', { name: 'Restore' }));
    fireEvent.click(within(main()).getByRole('tab', { name: /In use/ }));

    expect(within(main()).getByRole('button', { name: /^Golden Spoon,/ })).toBeDefined();
    vi.useRealTimers();
  });

  it(
    'refuses to archive a vendor an event still owes, naming each event (sc-87)',
    SLOW,
    async () => {
      await open('/demo/vendors?state=edit');
      const dialog = screen.getByRole('dialog', { name: 'Edit vendor' });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Archive this vendor' }));

      expect(within(dialog).getByRole('alert').textContent).toMatch(/^Bloom & Co was not archived/);
      expect(
        within(dialog)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual([
        '/demo/events/evt-gala-4?area=budget&vendor=v4',
        '/demo/events/evt-ireti-2?area=budget&vendor=v4',
      ]);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(within(main()).getByRole('button', { name: /^Bloom & Co,/ }).textContent).toMatch(
        /Used on 2 events/,
      );
    },
  );

  it('marks the blank required fields before sending, and adds a vendor', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('/demo/vendors?state=add');
    const dialog = screen.getByRole('dialog', { name: 'Add a vendor' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(within(dialog).getByText('Enter the vendor’s name.')).toBeDefined();
    expect(within(dialog).getByText('Choose the category.')).toBeDefined();

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Aso Rock Hall' } });
    fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: 'venue' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(main()).getByRole('button', { name: 'Aso Rock Hall, Venue' })).toBeDefined();
    vi.useRealTimers();
  });

  it('keeps the directory read only after a downgrade', SLOW, async () => {
    await open('/demo/vendors?state=read_only');

    expect(within(main()).getByText('Read only now')).toBeDefined();
    expect(within(main()).queryByRole('button', { name: 'Add a vendor' })).toBeNull();

    fireEvent.click(within(main()).getByRole('button', { name: /^Bloom & Co,/ }));
    const dialog = screen.getByRole('dialog', { name: 'Bloom & Co' });

    expect(within(dialog).queryByRole('button', { name: 'Archive this vendor' })).toBeNull();
    expect(within(dialog).getByText('ngozi@bloomandco.ng')).toBeDefined();
  });

  it('gives a member no Vendors item, and the refusal on its address', SLOW, async () => {
    await open('/demo/vendors?as=ana');

    expect(within(side()).queryByRole('link', { name: 'Vendors' })).toBeNull();
    expect(within(main()).getByRole('alert')).toBeDefined();
    expect(within(main()).queryByRole('heading', { name: 'Vendors' })).toBeNull();
  });
});
