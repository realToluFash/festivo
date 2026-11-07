import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 8000 };
const REFUSED = 'That is not a phone number for United Kingdom. Check it and try again.';

function main(): HTMLElement {
  return screen.getByRole('main');
}

function list(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Settings' });
}

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('navigation', { name: 'Settings' }, SLOW);

  return router;
}

function rows(): HTMLElement[] {
  return within(within(main()).getByRole('list', { name: 'Vendors' })).getAllByRole('listitem');
}

function filter(name: RegExp): HTMLElement {
  return within(main()).getByRole('button', { name });
}

describe('Settings › Vendors in A · Summary first (sc-82)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.useRealTimers());

  it('is a section of Settings after Sign-in rules, and never a sidebar place', SLOW, async () => {
    const router = await open('/demo/settings/members');
    const sections = within(list())
      .getAllByRole('link')
      .map((one) => one.querySelector('.today-grow')?.textContent);

    expect(sections.slice(-4)).toEqual(['General', 'Members', 'Sign-in rules', 'Vendors']);
    expect(
      within(screen.getByRole('navigation', { name: 'Soirely' })).queryByRole('link', {
        name: 'Vendors',
      }),
    ).toBeNull();

    fireEvent.click(within(list()).getByRole('link', { name: 'Vendors' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Vendors' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/settings/vendors');
    expect(within(list()).getByRole('link', { name: 'Vendors' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('keeps the old address, and its query, on the new one', SLOW, async () => {
    const router = await open('/demo/vendors?state=archived');

    expect(router.state.location.pathname).toBe('/demo/settings/vendors');
    expect(router.state.location.search).toBe('?state=archived');
  });

  it('leads with the card, then 1 to 25 of 28 in name order', SLOW, async () => {
    await open('/demo/settings/vendors?state=populated');

    expect(within(main()).getByText('28 in use')).toBeDefined();
    expect(within(main()).getByText('2 archived')).toBeDefined();
    expect(within(main()).getByText('28 vendors')).toBeDefined();
    expect(
      within(main()).getByText('The people Ire Events buys from, chosen on each event’s quotes.'),
    ).toBeDefined();
    expect(rows()).toHaveLength(25);
    expect(rows()[0]?.textContent).toBe(
      'Àbẹ̀ní FlowersÀbẹ̀ní Oyelaran · Flowers · hello@abeni.flowers · Used on 1 event',
    );
    expect(rows()[3]?.textContent).toBe(
      'Delta FramesTolu Ade · Photography · +44 20 7946 0321 · Used on 1 event',
    );
    const used = (name: string) =>
      rows()
        .find((one) => one.textContent?.startsWith(name))
        ?.textContent?.split(' · ')
        .at(-1);
    expect(['Bloom & Co', 'Lens & Light', 'Savour Kitchen', 'Golden Spoon'].map(used)).toEqual([
      'Used on 2 events',
      'Used on 3 events',
      'Used on 4 events',
      'events@goldenspoon.co.uk',
    ]);
    expect(within(main()).getByText('1 to 25 of 28, A to Z')).toBeDefined();
    expect(filter(/^In use · 28/).getAttribute('aria-haspopup')).toBe('menu');
    expect(filter(/^All categories · 28/)).toBeDefined();
    expect(within(main()).queryByRole('tab')).toBeNull();

    fireEvent.click(within(main()).getByRole('button', { name: 'Next' }));

    expect(rows()).toHaveLength(3);
    expect(within(main()).getByText('26 to 28 of 28, A to Z')).toBeDefined();
  });

  it('counts a search, and clears it', SLOW, async () => {
    await open('/demo/settings/vendors?state=searched');
    const search = within(main()).getByRole('searchbox', { name: 'Search vendors' });

    expect(document.activeElement).toBe(search);
    expect(within(main()).getByRole('status').textContent).toBe('1 vendor');
    expect(rows()).toHaveLength(1);

    fireEvent.click(within(main()).getByRole('button', { name: 'Clear the search' }));

    expect(rows()).toHaveLength(25);
    expect(document.activeElement).toBe(search);
  });

  it('says what matched nothing, never the empty directory, and widens again', SLOW, async () => {
    await open('/demo/settings/vendors?state=no_match');

    expect(within(main()).getByText('No vendor matches “eclat” in Catering.')).toBeDefined();
    expect(within(main()).queryByText('No vendors yet')).toBeNull();
    expect(within(main()).getByText('28 vendors')).toBeDefined();

    fireEvent.click(within(main()).getByRole('button', { name: 'Show every category' }));

    expect(within(main()).getByText('No vendor matches “eclat”.')).toBeDefined();

    fireEvent.click(within(main()).getAllByRole('button', { name: 'Clear the search' })[1]!);

    expect(rows()).toHaveLength(25);
  });

  it('opens the category menu with every count and a tick on the one in use', SLOW, async () => {
    await open('/demo/settings/vendors?state=category_menu');
    const items = within(main()).getAllByRole('menuitemradio');

    expect(items.map((one) => one.textContent)).toEqual([
      'All categories28',
      'Catering6',
      'Venue4',
      'Flowers5',
      'Photography4',
      'Music3',
      'Transport3',
      'Staffing1',
      'Hire1',
      'Other1',
    ]);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(items[3]!);

    expect(rows()).toHaveLength(5);
    expect(within(main()).getByRole('status').textContent).toBe('5 vendors');
  });

  it('says what an empty directory is for, with Add a vendor', SLOW, async () => {
    await open('/demo/settings/vendors?state=empty');

    expect(within(main()).getByText('No vendors yet')).toBeDefined();
    expect(
      within(main()).getByText(
        'Add the caterers, florists and venues Ire Events buys from, once, and choose them on any event’s quote.',
      ),
    ).toBeDefined();
    expect(within(main()).getAllByRole('button', { name: /Add a vendor/ })).toHaveLength(1);
    expect(within(main()).queryByRole('searchbox')).toBeNull();
  });

  it('lists Archived from the filter menu, and restores in one press', SLOW, async () => {
    await open('/demo/settings/vendors?state=archived');

    expect(filter(/^Archived · 2/)).toBeDefined();
    expect(rows().map((one) => one.textContent)).toEqual([
      'Éclat CateringClaire Martin · Catering · Archived Mon, Oct 12Restore',
      'Marquee MastersChuka Obi · Hire · Archived Mon, Oct 12Restore',
    ]);

    fireEvent.click(within(rows()[0]!).getByRole('button', { name: 'Restore' }));

    expect(await screen.findByText('Éclat Catering is back in the directory.')).toBeDefined();
    expect(rows()).toHaveLength(1);
    expect(within(main()).getByText('29 vendors')).toBeDefined();
  });

  it('switches In use to Archived from its menu', SLOW, async () => {
    await open('/demo/settings/vendors');

    fireEvent.click(filter(/^In use · 28/));
    fireEvent.click(within(main()).getByRole('menuitemradio', { name: /Archived/ }));

    expect(rows()).toHaveLength(2);
    expect(filter(/^Archived · 2/)).toBeDefined();
  });

  it(
    'opens Add a vendor at 700 from the card, refusing blank fields before sending',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open('/demo/settings/vendors');

      fireEvent.click(within(main()).getByRole('button', { name: /Add a vendor/ }));
      const dialog = screen.getByRole('dialog', { name: 'Add a vendor' });

      expect(dialog.querySelector('.vd-wide')).not.toBeNull();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

      expect(within(dialog).getByRole('alert').textContent).toBe(
        '2 fields need fixing, so nothing was sent.',
      );
      expect(within(dialog).getByText("Enter the vendor's name.")).toBeDefined();
      expect(within(dialog).getByText('Choose the category.')).toBeDefined();
      await waitFor(() =>
        expect(document.activeElement).toBe(within(dialog).getByLabelText('Name')),
      );

      fireEvent.change(within(dialog).getByLabelText('Name'), {
        target: { value: 'Atelier Rosa' },
      });

      expect(within(dialog).getByRole('alert').textContent).toBe(
        'One field needs fixing, so nothing was sent.',
      );

      fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: 'flowers' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(within(main()).getByRole('button', { name: /^Atelier Rosa/ })).toBeDefined();
      expect(within(main()).getByText('29 vendors')).toBeDefined();
    },
  );

  it('opens add_blank with the focus on Name and the count said', SLOW, async () => {
    await open('/demo/settings/vendors?state=add_blank');
    const dialog = screen.getByRole('dialog', { name: 'Add a vendor' });

    expect(within(dialog).getByRole('alert').textContent).toBe(
      '2 fields need fixing, so nothing was sent.',
    );
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText('Name')));
  });

  it(
    'refuses the three fields of add_invalid, and the number each time it is sent',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open('/demo/settings/vendors?state=add_invalid');
      const dialog = screen.getByRole('dialog', { name: 'Add a vendor' });
      const email = within(dialog).getByLabelText('Email address', { exact: false });

      expect(within(dialog).getByRole('alert').textContent).toBe(
        '3 fields need fixing, so nothing was sent.',
      );
      expect(
        within(dialog).getByText(
          'That does not look like an email address. Check it has an @ and a domain.',
        ),
      ).toBeDefined();
      expect(
        within(dialog).getByText(
          'Enter a web address that starts with https:// or http://, or leave that part off.',
        ),
      ).toBeDefined();
      expect(within(dialog).getByText(REFUSED)).toBeDefined();
      await waitFor(() => expect(document.activeElement).toBe(email));

      fireEvent.change(email, { target: { value: 'sam@harbourboats.co.uk' } });
      fireEvent.change(within(dialog).getByLabelText('Website', { exact: false }), {
        target: { value: 'harbourboats.co.uk' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect(screen.getByRole('dialog', { name: 'Add a vendor' })).toBeDefined();
      expect(within(dialog).getByText(REFUSED)).toBeDefined();
      expect(within(dialog).getByRole('alert').textContent).toBe(
        'One field needs fixing, so nothing was sent.',
      );

      fireEvent.change(within(dialog).getByLabelText('Phone number', { exact: false }), {
        target: { value: '7700 900123' },
      });

      expect(within(dialog).queryByText(REFUSED)).toBeNull();
      expect(within(dialog).queryByRole('alert')).toBeNull();
    },
  );

  it('takes Choose a country away once the number is cleared', SLOW, async () => {
    await open('/demo/settings/vendors?state=add');
    const dialog = screen.getByRole('dialog', { name: 'Add a vendor' });
    const phone = within(dialog).getByLabelText('Phone number', { exact: false });

    fireEvent.change(phone, { target: { value: '7700 900877' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(within(dialog).getByText('Choose a country.')).toBeDefined();

    fireEvent.change(phone, { target: { value: '' } });

    expect(within(dialog).queryByText('Choose a country.')).toBeNull();
  });

  it('archives from Edit vendor in one press, said in a toast', SLOW, async () => {
    await open('/demo/settings/vendors?state=populated');
    fireEvent.click(within(main()).getByRole('button', { name: /^Golden Spoon/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit vendor' });

    expect(within(dialog).getByLabelText('Name')).toHaveProperty('value', 'Golden Spoon');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive this vendor' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      await screen.findByText('Golden Spoon is archived. It is under Archived.'),
    ).toBeDefined();
    expect(within(main()).queryByRole('button', { name: /^Golden Spoon/ })).toBeNull();
    expect(filter(/^In use · 27/)).toBeDefined();
  });

  it(
    'refuses to archive a vendor an event still owes, one link per event (sc-87)',
    SLOW,
    async () => {
      const words =
        'Bloom & Co was not archived, because the events below still have payments to it that are not paid or cancelled. Once each one is paid or cancelled, you can archive the vendor.';
      await open('/demo/settings/vendors?state=edit');
      let dialog = screen.getByRole('dialog', { name: 'Edit vendor' });
      expect(within(dialog).queryByRole('alert')).toBeNull();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Archive this vendor' }));

      expect(screen.getByRole('dialog', { name: 'Edit vendor' })).toBe(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe(words);
      expect(within(main()).getByRole('button', { name: /^Bloom & Co/ })).toBeDefined();
      cleanup();

      await open('/demo/settings/vendors?state=archive_refused');
      dialog = screen.getByRole('dialog', { name: 'Edit vendor' });
      expect(within(dialog).getByRole('alert').textContent).toBe(words);
      const links = within(dialog).getAllByRole('link');
      expect(links.map((one) => [one.textContent, one.getAttribute('href')])).toEqual([
        [
          'Payments to Bloom & Co on Adaeze & Tunde’s wedding',
          '/demo/events/evt-wed-4?area=budget&vendor=v3',
        ],
        ['Payments to Bloom & Co on Ireti at 40', '/demo/events/evt-ireti-2?area=budget&vendor=v3'],
      ]);
      expect(within(dialog).getByRole('button', { name: 'Archive this vendor' })).toBeDefined();
    },
  );

  it('opens archived_toast with Bloom & Co gone to Archived', SLOW, async () => {
    await open('/demo/settings/vendors?state=archived_toast');

    expect(await screen.findByText('Bloom & Co is archived. It is under Archived.')).toBeDefined();
    expect(within(main()).getByText('3 archived')).toBeDefined();
    expect(within(main()).getByText('27 vendors')).toBeDefined();
  });

  it(
    'lights Savour Kitchen, focused on its page, as a Budget’s vendor name opens it',
    SLOW,
    async () => {
      await open('/demo/settings/vendors?state=from_event&vendor=v4');
      const savour = within(main()).getByRole('button', { name: /^Savour Kitchen/ });

      expect(savour.classList.contains('is-on')).toBe(true);
      await waitFor(() => expect(document.activeElement).toBe(savour));

      cleanup();
      await open('/demo/settings/vendors?vendor=v27');
      const wild = within(main()).getByRole('button', { name: /^Wild Meadow Flowers/ });

      expect(wild.classList.contains('is-on')).toBe(true);
      expect(within(main()).getByText('26 to 28 of 28, A to Z')).toBeDefined();
    },
  );

  it('refuses a member inside Settings, with no Vendors in their list', SLOW, async () => {
    for (const path of ['/demo/settings/vendors?state=member', '/demo/settings/vendors?as=ana']) {
      await open(path);

      expect(within(main()).getByRole('alert').textContent).toContain(
        'You do not have access to this',
      );
      expect(within(list()).queryByRole('link', { name: 'Vendors' })).toBeNull();
      expect(within(list()).queryByRole('link', { name: 'Members' })).toBeNull();
      expect(
        within(main()).getByRole('link', { name: 'Back to Settings' }).getAttribute('href'),
      ).toBe('/demo/settings/account?as=ana');
      expect(within(main()).queryByRole('heading', { name: 'Vendors' })).toBeNull();
      cleanup();
    }
  });

  it('keeps loading and failed, and tries again', SLOW, async () => {
    await open('/demo/settings/vendors?state=loading');

    expect(within(main()).getByRole('status', { name: 'Loading vendors…' })).toBeDefined();

    cleanup();
    await open('/demo/settings/vendors?state=failed');

    expect(within(main()).getByText('We could not load the vendors.')).toBeDefined();

    fireEvent.click(within(main()).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('28 vendors', {}, SLOW)).toBeDefined();
  });
});
