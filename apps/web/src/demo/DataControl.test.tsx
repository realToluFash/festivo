import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const HUB = '/demo/settings/data-and-control';

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function hub(path = HUB) {
  const router = open(path);
  await screen.findByRole('heading', { level: 1, name: 'Data and control' }, FIRST_LOAD);

  return router;
}

function group(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

describe('Settings › Data and control at a desk (sc-560)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it.each([
    ['an owner', ''],
    ['an admin', '?as=julien'],
  ])('lists Data and control last for %s, after Vendors, lit on its page', async (_who, as) => {
    open(`${HUB}${as}`);
    const list = await screen.findByRole('navigation', { name: 'Settings' }, FIRST_LOAD);
    const names = within(list)
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(names.slice(-2)).toEqual(['Vendors', 'Data and control']);
    expect(
      within(list).getByRole('link', { name: 'Data and control' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('lists none for a member, and shows the address an empty page', async () => {
    open(`${HUB}?as=ana`);
    const list = await screen.findByRole('navigation', { name: 'Settings' }, FIRST_LOAD);

    expect(within(list).queryByRole('link', { name: 'Data and control' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'Data and control' })).toBeNull();
    expect(within(list).getByRole('link', { name: 'General' })).toBeDefined();
  });

  it('gives an owner the export to download, then the next thing that asks', async () => {
    await hub();

    expect(screen.getByText('Your export is ready')).toBeDefined();
    expect(
      within(group('Data')).getByRole('link', { name: /^Export all data Ready Ready until/u }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(screen.getByText('ireevents.com is waiting for its record')).toBeDefined();
    expect(
      within(group('Data')).getByRole('link', { name: /^Export all data/u }).textContent,
    ).toContain('Downloaded');
  });

  it('gives an admin the record to see, and the export as the owner’s', async () => {
    const router = await hub(`${HUB}?as=julien`);

    expect(within(group('Data')).getByText('Ready · asked by Folake Adeyemi')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'See the record' }));

    expect(
      await screen.findByRole('dialog', { name: 'Prove ireevents.com' }, FIRST_LOAD),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe(`${HUB}/email-domains`);
    expect(router.state.location.search).toBe('?as=julien&state=ed_record');
  });

  it('lists Control and Data, each row saying where it stands and opening its page', async () => {
    const router = await hub();

    expect(
      within(group('Control'))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Email domainsire.events proved · ireevents.com waiting for the record',
      'Audit logWho did what, for 365 days',
    ]);
    expect(within(group('Data')).getByText('A guest’s request')).toBeDefined();
    fireEvent.click(within(group('Data')).getByRole('link', { name: /^Delete guest data/u }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Delete guest data after an event' }),
    ).toBeDefined();
    expect(router.state.location.search).toBe('?state=rt_held');
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('Delete guest data after an event'),
    );
  });

  it('says nothing needs you once everything is quiet', async () => {
    await hub(`${HUB}?state=quiet`);

    expect(screen.getByText('Nothing needs your attention')).toBeDefined();
    expect(screen.getByText('ire.events is proved. Deleting guest data is off.')).toBeDefined();
    expect(screen.getByText('ire.events proved')).toBeDefined();
    expect(screen.getByText('Off')).toBeDefined();
  });

  it('starts a new organisation on its domain', async () => {
    await hub(`${HUB}?state=new`);

    expect(screen.getByText('No domains yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Prove a domain' }));

    expect(await screen.findByRole('dialog', { name: 'Prove a domain' })).toBeDefined();
  });

  it.each([
    ['locked', 'These come with Enterprise'],
    ['downgraded', 'Ire Events left Enterprise on Sunday, Oct 18'],
  ])('locks the Enterprise jobs, %s, and still opens them', async (state, says) => {
    await hub(`${HUB}?state=${state}`);

    expect(screen.getByText(says)).toBeDefined();
    expect(screen.getAllByText('Enterprise')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Contact Soirely about Enterprise' }));
    expect(screen.getByText('Contacting Soirely has its own design.')).toBeDefined();
  });

  it('loads, and fails with Try again back to the hub', async () => {
    open(`${HUB}?state=loading`);

    expect(
      (await screen.findByText('Loading Data and control…', {}, FIRST_LOAD)).getAttribute('role'),
    ).toBe('status');
  });

  it('tries again from a failed load', async () => {
    await hub(`${HUB}?state=failed`);
    expect(screen.getByText('We could not load Data and control.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('Your export is ready')).toBeDefined(), {
      timeout: 3000,
    });
  });
});
