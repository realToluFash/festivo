import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const AT = '/demo/settings/data-and-control/email-domains';

async function domains(query = '') {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Email domains' }, FIRST_LOAD);

  return router;
}

function row(name: string): HTMLElement {
  return screen.getByText(name, { selector: '.desk-row-name' }).closest('li') as HTMLElement;
}

function onlyRow(): HTMLElement {
  return row('Only our organisation');
}

describe('Data and control › Email domains (sc-560, sc-563)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('lists a proved domain and a waiting one, Only our organisation under the proved', async () => {
    await domains();

    expect(screen.getByRole('button', { name: 'Data and control' })).toBeDefined();
    expect(screen.getByText('ireevents.com is waiting for its record')).toBeDefined();
    expect(within(row('ire.events')).getByText('Proved')).toBeDefined();
    expect(within(row('ire.events')).getByText('Proved Tuesday, Oct 6 at 11:02 WAT')).toBeDefined();
    expect(within(row('ireevents.com')).getByText('Waiting for the record')).toBeDefined();
    expect(
      within(row('ire.events')).getByRole('button', { name: 'Remove ire.events' }).textContent,
    ).toBe('Remove…');
    expect(
      within(row('ireevents.com')).getByRole('button', { name: 'Remove ireevents.com' })
        .textContent,
    ).toBe('Remove');
    expect(
      within(onlyRow()).getByRole('switch', { name: 'Only our organisation for ire.events' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Proving a domain does not let anyone join. Company domain joining is its own list, in General.',
      ),
    ).toBeDefined();
  });

  it('gives an admin no switch, and says only an owner changes it', async () => {
    await domains('?as=julien');

    expect(within(onlyRow()).queryByRole('switch')).toBeNull();
    expect(
      within(onlyRow()).getByText(
        'People at ire.events can still be members of other organisations. Only an owner can change this.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Prove a domain' })).toBeDefined();
  });

  it('proves a domain: Add, the record, Copy, Verify, proved', async () => {
    await domains('?state=ed_empty');

    expect(screen.getByText('No domains yet.')).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Prove a domain' })[0] as HTMLElement);
    const dialog = screen.getByRole('dialog', { name: 'Prove a domain' });
    const field = within(dialog).getByLabelText('Domain');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByText('Enter a domain, like ire.events.')).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);

    fireEvent.change(field, { target: { value: 'Acme.org' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    const record = screen.getByRole('dialog', { name: 'Prove acme.org' });

    expect(within(record).getByText('_soirely-verify.acme.org')).toBeDefined();
    expect(within(record).getByText('k7q2m9x4c8rt5bn3wd6jp1hz0ys5gfa')).toBeDefined();
    expect(
      within(record).getByText('We check every hour until Monday, Oct 26 at 10:12 WAT.'),
    ).toBeDefined();
    expect(within(record).getByRole('button', { name: 'Copy Value' })).toBeDefined();
    expect(within(row('acme.org')).getByText('Waiting for the record')).toBeDefined();

    fireEvent.click(within(record).getByRole('button', { name: 'Verify' }));
    expect(
      within(record).getByRole('button', { name: 'Verifying…' }).getAttribute('aria-disabled'),
    ).toBe('true');
    await waitFor(() => expect(screen.getByText('acme.org is proved')).toBeDefined(), {
      timeout: 3000,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(row('acme.org')).getByText('Proved')).toBeDefined();
  });

  it.each([
    ['ed_invalid', 'Enter a domain with a dot and no spaces, like ire.events.'],
    ['ed_public', 'You cannot use a public email domain.'],
    [
      'ed_taken',
      'Another organisation has already proved this domain. Contact Soirely support if it is yours.',
    ],
    ['ed_blank', 'Enter a domain, like ire.events.'],
  ])('opens %s with its line under the field', async (state, line) => {
    await domains(`?state=${state}`);
    const dialog = screen.getByRole('dialog', { name: 'Prove a domain' });

    expect(within(dialog).getByText(line)).toBeDefined();
    expect(
      within(dialog).getByText('For example, ire.events. A subdomain needs adding on its own.'),
    ).toBeDefined();
  });

  it('says it could not find the record yet, above the hourly line', async () => {
    await domains('?state=ed_not_found');
    const record = screen.getByRole('dialog', { name: 'Prove ireevents.com' });

    expect(
      within(record).getByText(
        'We could not find the record yet. DNS changes can take up to 48 hours.',
      ),
    ).toBeDefined();
    expect(
      within(record).getByText(
        'Add this record where the DNS for ireevents.com is managed, then press Verify.',
      ),
    ).toBeDefined();
  });

  it('keeps ire.events accounts to Ire Events: the switch, the Ask, scheduled, then Cancel', async () => {
    await domains('?state=oo_off');
    const toggle = within(onlyRow()).getByRole('switch');

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    const ask = screen.getByRole('alertdialog', {
      name: 'Limit ire.events accounts to Ire Events?',
    });

    expect(
      within(ask).getByText(
        'From Monday, Nov 2 at 10:12 WAT, 14 days from now, an account whose main email address is at ire.events can only be a member of Ire Events.',
      ),
    ).toBeDefined();
    expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(ask).getByRole('button', { name: 'Schedule it' }));

    expect(
      screen.getByText('Only our organisation starts on Monday, Nov 2 at 10:12 WAT'),
    ).toBeDefined();
    expect(within(onlyRow()).getByText('Starts Monday, Nov 2 at 10:12 WAT')).toBeDefined();
    fireEvent.click(
      within(onlyRow()).getByRole('button', {
        name: 'Cancel Only our organisation for ire.events',
      }),
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Only our organisation was cancelled')).toBeDefined();
    expect(within(onlyRow()).getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('turns Only our organisation off at once, asking nothing', async () => {
    await domains('?state=oo_on');

    expect(within(onlyRow()).getByText('On since Saturday, Oct 3')).toBeDefined();
    fireEvent.click(within(onlyRow()).getByRole('switch'));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Only our organisation is off')).toBeDefined();
  });

  it('gives an admin the scheduled start read only', async () => {
    await domains('?state=oo_not_owner');

    expect(screen.getByText('Only an owner can cancel it.')).toBeDefined();
    expect(
      within(onlyRow()).getByText(
        'Starts Monday, Nov 2 at 09:12 GMT. Only an owner can change this.',
      ),
    ).toBeDefined();
    expect(within(onlyRow()).queryByRole('button')).toBeNull();
  });

  it('asks before removing a proved domain, and removes a waiting one at once', async () => {
    await domains();
    fireEvent.click(screen.getByRole('button', { name: 'Remove ireevents.com' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('ireevents.com removed.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove ire.events' }));
    const ask = screen.getByRole('alertdialog', { name: 'Remove ire.events?' });

    expect(
      within(ask).getByText(
        'It stops being proved, and Only our organisation stops for it. Company domain joining keeps its own list.',
      ),
    ).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('ire.events was removed')).toBeDefined();
    expect(screen.getByText('No domains yet.')).toBeDefined();
  });

  it.each([
    ['ed_failed', 'ireevents.com was not proved', 'Not proved'],
    ['ed_lapsing', 'The record for ire.events is missing', 'Record missing'],
    ['ed_removed', 'ire.events was removed', 'Waiting for the record'],
    ['ed_proved', 'ireevents.com is proved', 'Proved'],
    ['oo_scheduled', 'Only our organisation starts on Monday, Nov 2 at 10:12 WAT', 'Proved'],
    ['oo_cancelled', 'Only our organisation was cancelled', 'Proved'],
    ['oo_turned_off', 'Only our organisation is off', 'Proved'],
  ])('opens %s with its card and tags', async (state, says, tag) => {
    await domains(`?state=${state}`);

    expect(screen.getByText(says)).toBeDefined();
    expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
  });

  it('opens the missing record’s own dialog from the card', async () => {
    await domains('?state=ed_lapsing');
    fireEvent.click(screen.getByRole('button', { name: 'See the record' }));

    expect(screen.getByRole('dialog', { name: 'Prove ire.events' })).toBeDefined();
    expect(screen.getByText('Put it back by Saturday, Oct 31 at 14:20 WAT.')).toBeDefined();
  });

  it('opens the Ask over the page from its own link', async () => {
    await domains('?state=ed_remove');

    expect(screen.getByRole('alertdialog', { name: 'Remove ire.events?' })).toBeDefined();
  });

  it('locks the page on the free plan, with no block', async () => {
    await domains('?state=ed_locked');

    expect(screen.getByText('Available on Enterprise')).toBeDefined();
    expect(screen.queryByRole('heading', { level: 2, name: 'Domains' })).toBeNull();
  });

  it('keeps ire.events as it was after Enterprise, with no actions', async () => {
    await domains('?state=ed_downgraded');

    expect(screen.getByText('Switched off on Sunday, Oct 18')).toBeDefined();
    expect(within(row('ire.events')).getByText('Kept')).toBeDefined();
    expect(
      within(onlyRow()).getByText('Kept as it was. It comes back on with Enterprise.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Prove a domain' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/u })).toBeNull();
  });

  it('loads, and fails with a way to try again', async () => {
    const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=failed`] });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByText('We could not load Email domains.', {}, FIRST_LOAD),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Loading Email domains…')).toBeDefined();
  });

  it('ticks a copied value in place and says which one was copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    try {
      await domains('?state=ed_record');
      const record = screen.getByRole('dialog', { name: 'Prove ireevents.com' });
      fireEvent.click(within(record).getByRole('button', { name: 'Copy Value' }));

      expect(await within(record).findByRole('button', { name: 'Value, copied' })).toBeDefined();
      expect(writeText).toHaveBeenCalledWith('k7q2m9x4c8rt5bn3wd6jp1hz0ys5gfa');
      expect(screen.getByText('Value copied.')).toBeDefined();
      expect(within(record).getByRole('button', { name: 'Copy Name' })).toBeDefined();
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
