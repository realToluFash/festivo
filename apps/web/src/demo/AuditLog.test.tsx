import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const AT = '/demo/settings/data-and-control/audit-log';

async function log(query = '') {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Audit log' }, FIRST_LOAD);

  return router;
}

const entries = () =>
  [...document.querySelectorAll<HTMLElement>('[data-entry]')].map((one) => one.dataset.entry);

describe('Data and control › Audit log (sc-611)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('lists who did what by day, newest first, under its card and four filters', async () => {
    await log();

    expect(screen.getByText('Who did what in Ire Events')).toBeDefined();
    expect(
      screen.getByText('Kept for 365 days. Nobody can change or delete an entry.'),
    ).toBeDefined();
    expect(
      within(document.querySelector<HTMLElement>('.desk-page') ?? document.body)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Today · Monday, Oct 19', 'Saturday, Oct 17', 'Friday, Oct 16', 'Tuesday, Oct 6']);
    expect(
      screen.getByRole('button', { name: /^10:05 ?Downloaded Ire Events’ data/u }),
    ).toBeDefined();
    expect(screen.getByText('Priya Shah · Event access')).toBeDefined();
    expect(
      ['Person: Anyone', 'Type: All types', 'Event: All events', 'Dates: Last 365 days'].map(
        (name) => screen.getByRole('button', { name }).textContent,
      ),
    ).toEqual(['Anyone', 'All types', 'All events', 'Last 365 days']);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('filters by type from its menu, by keyboard, and clears', async () => {
    await log();
    const button = screen.getByRole('button', { name: 'Type: All types' });

    fireEvent.click(button);
    const menu = screen.getByRole('menu', { name: 'Type' });

    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual([
      'All types',
      'Events',
      'Event access',
      'Members and invitations',
      'Sign-in and security',
      'Organisation',
      'Audit log',
    ]);
    expect(document.activeElement?.textContent).toBe('All types');
    fireEvent.keyDown(document, { key: 'End' });
    expect(document.activeElement?.textContent).toBe('Audit log');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Sign-in and security' }));

    expect(screen.getByRole('button', { name: 'Type: Sign-in and security' })).toBeDefined();
    expect(entries()).toEqual(['signIn', 'domainAdded', 'proved']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(entries()).toHaveLength(11);
  });

  it('lists the people with Marta as having left', async () => {
    await log('?state=filter_person');

    expect(
      within(screen.getByRole('menu', { name: 'Person' }))
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual([
      'Anyone',
      'Folake Adeyemi',
      'Julien Moreau',
      'Priya Shah',
      'Ana Souza',
      'Tom Becker',
      'Marta Silva · left',
    ]);
  });

  it('says when nothing matches, with Clear filters', async () => {
    await log('?state=empty_filter');

    expect(screen.getByText('No entry matches these filters.')).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[1] as HTMLElement);
    expect(entries()).toHaveLength(11);
  });

  it('applies the dates as they change, and catches them the wrong way round', async () => {
    await log('?state=dates');
    const dialog = screen.getByRole('dialog', { name: 'Dates' });

    expect(entries()).toHaveLength(11);
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2026-10-17' } });
    expect(entries()).toHaveLength(8);
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-10-18' } });

    expect(
      within(dialog).getByText('The start date must be on or before the end date.'),
    ).toBeDefined();
    expect(
      within(dialog).getByRole('button', { name: 'Apply' }).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(entries()).toHaveLength(11);
    expect(screen.getByRole('button', { name: 'Dates: Last 365 days' })).toBeDefined();
  });

  it('opens an entry with what it records', async () => {
    await log();
    fireEvent.click(screen.getByRole('button', { name: /^09:12 ?Made Ireti at 40 live/u }));
    const dialog = screen.getByRole('dialog', { name: 'Entry' });

    expect(within(dialog).getByText('Saturday, Oct 17, 2026 at 09:12:44 WAT')).toBeDefined();
    expect(within(dialog).getByText('Folake Adeyemi · folake@ire.events')).toBeDefined();
    expect(within(dialog).getByRole('link', { name: 'Ireti at 40' })).toBeDefined();
    expect(within(dialog).getByText('Events · event.made_live')).toBeDefined();
    expect(within(dialog).getByText('c41e9a7b-2f6d-4b1e-9a53-7d0e6c2b8f14')).toBeDefined();
    expect(within(dialog).getByText('Nobody can change or delete an entry.')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['detail_gone', 'Bisi & Kola’s engagement · no longer exists', 'Device'],
    ['detail_signin', 'Safari on macOS', 'Never'],
    ['detail_old', '203.0.113.17', 'Device'],
    ['detail_system', 'System', 'Network address'],
  ])('opens %s from its own link', async (state, shown, absent) => {
    await log(`?state=${state}`);
    const dialog = screen.getByRole('dialog', { name: 'Entry' });

    expect(within(dialog).getByText(shown)).toBeDefined();
    expect(within(dialog).queryByText(absent)).toBeNull();
    expect(within(dialog).queryByRole('link')).toBeNull();
  });

  it('exports these entries as CSV or JSON Lines, downloading up to 10,000', async () => {
    await log();
    fireEvent.click(screen.getByRole('button', { name: 'Export these entries' }));
    const dialog = screen.getByRole('dialog', { name: 'Export these entries' });

    expect((within(dialog).getByRole('radio', { name: 'CSV' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      within(dialog).getByText(
        'Up to 10,000 entries download at once. More are prepared, and we email you a link.',
      ),
    ).toBeDefined();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'JSON Lines' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Export' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Downloading the audit log as JSON Lines.')).toBeDefined();
  });

  it.each([
    ['export_small', 'Downloading the audit log as CSV.'],
    [
      'export_preparing',
      'We’ll email folake@ire.events a link when it’s ready. It works once, for 24 hours.',
    ],
    [
      'export_too_many',
      'More than 1,000,000 entries match. Narrow the filters, then export again.',
    ],
    ['locked', 'See who did what in Ire Events, for 365 days, and export it.'],
  ])('opens %s with its words', async (state, words) => {
    await log(`?state=${state}`);

    expect(screen.getByText(words)).toBeDefined();
  });

  it('starts nothing past a million', async () => {
    await log('?state=export_too_many');
    const verb = screen.getByRole('button', { name: 'Export' });

    expect(verb.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(verb);
    expect(screen.getByRole('dialog', { name: 'Export these entries' })).toBeDefined();
  });

  it('locks the log on the free plan, with nothing else', async () => {
    await log('?state=locked');

    expect(screen.queryByRole('button', { name: /^Type:/u })).toBeNull();
    expect(screen.getByRole('button', { name: 'Contact Soirely about Enterprise' })).toBeDefined();
  });

  it('tries again from a failed load', async () => {
    await log('?state=failed');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(entries()).toHaveLength(11), { timeout: 3000 });
  });
});
