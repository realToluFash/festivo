import { render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../index.tsx';

const TOKEN = 'goJP8j72G8dKsdGysCtB7qA4o2SdVzDrjFodz60tDDc';

const NO_NEEDS = {
  allergies: [],
  otherAllergy: null,
  diet: [],
  otherDiet: null,
  access: [],
  otherAccess: null,
  changed: null,
};

const PAGE = {
  guest: {
    fullName: 'Adaeze Okonkwo',
    reply: null,
    needs: NO_NEEDS,
    places: 0,
    unnamed: [],
    companions: [],
  },
  language: { chosen: null, host: null, organisation: 'en' },
  event: {
    id: '0193f5a8-0000-7000-8000-000000000001',
    name: "Amara & Tobi's wedding",
    type: 'wedding',
    cover: null,
    hosts: ['Amara', 'Tobi'],
    startsAt: '2030-11-14T16:00:00+01:00',
    timeZone: 'Africa/Lagos',
    venue: { name: 'The Civic Centre', address: 'Ozumba Mbadiwe Ave, Lagos' },
  },
  phase: 'live',
  started: false,
  answersOpen: true,
};

const CEREMONY = {
  title: 'Ceremony',
  startsAt: '2030-11-14T17:20:00+01:00',
  day: '2030-11-14',
  place: null,
};
const DINNER = {
  title: 'Dinner',
  startsAt: '2030-11-14T19:00:00+01:00',
  day: '2030-11-14',
  place: 'Ballroom',
};
const AFTER_MIDNIGHT = {
  title: 'Last dance',
  startsAt: '2030-11-15T00:30:00+01:00',
  day: '2030-11-14',
  place: 'Ballroom',
};
const BRUNCH = {
  title: 'Brunch',
  startsAt: '2030-11-15T11:00:00+01:00',
  day: '2030-11-15',
  place: 'Ballroom',
};

function openWith(
  programme: object[] | undefined,
  zone = 'Africa/Lagos',
  language: { chosen: string | null; host: string | null; organisation: string } = PAGE.language,
) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...resolved.call(this), timeZone: zone };
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ ...PAGE, language, ...(programme == null ? {} : { programme }) }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
  );

  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: [`/i/${TOKEN}`] })} />,
  );
}

afterEach(async () => {
  await i18next.changeLanguage('en');
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('The day on the guest’s page (sc-3899)', () => {
  it('lists each item’s time and title under one heading, a time element carrying its moment', async () => {
    openWith([CEREMONY, DINNER]);

    const section = await screen.findByRole('region', { name: 'The day' });
    const rows = within(section).getAllByRole('listitem');

    expect(rows.map((row) => row.textContent)).toEqual(['17:20Ceremony', '19:00Dinner · Ballroom']);
    expect(
      within(rows[0] as HTMLElement)
        .getByText('17:20')
        .getAttribute('datetime'),
    ).toBe(CEREMONY.startsAt);
    expect(within(section).queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('names no place when every item shown is in the same one', async () => {
    openWith([DINNER, { ...DINNER, title: 'Speeches', startsAt: '2030-11-14T20:00:00+01:00' }]);

    const section = await screen.findByRole('region', { name: 'The day' });

    expect(
      within(section)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['19:00Dinner', '20:00Speeches']);
  });

  it('has no section with nothing shown to guests, or from an API that sends none', async () => {
    openWith([]);
    await screen.findByText("Amara & Tobi's wedding");

    expect(screen.queryByRole('region', { name: 'The day' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Programme' })).toBeNull();
  });

  it('reads Programme over more than one event day, each day’s date over its own list, and a start past midnight carries its weekday', async () => {
    openWith([CEREMONY, AFTER_MIDNIGHT, BRUNCH]);

    const section = await screen.findByRole('region', { name: 'Programme' });

    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Thursday, November 14', 'Friday, November 15']);
    expect(within(section).getAllByRole('list')).toHaveLength(2);
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['17:20Ceremony', 'Fri 00:30Last dance · Ballroom', '11:00Brunch · Ballroom']);
  });

  it('puts every day’s list in one grid', async () => {
    openWith([CEREMONY, AFTER_MIDNIGHT, BRUNCH]);

    const section = await screen.findByRole('region', { name: 'Programme' });
    const [first, second] = within(section).getAllByRole('list');
    const column = first?.closest('.gp-prog-days');

    expect(column).not.toBeNull();
    expect(second?.closest('.gp-prog-days')).toBe(column);
  });

  it('names the event’s zone when the device is in another, and keeps the event’s times', async () => {
    openWith([CEREMONY], 'America/Sao_Paulo');

    const section = await screen.findByRole('region', { name: 'The day' });

    expect(within(section).getByText('Times in Africa/Lagos.')).toBeDefined();
    expect(within(section).getByText('17:20')).toBeDefined();
  });

  it('writes the 24-hour clock with the digits of the guest’s language', async () => {
    await i18next.changeLanguage('fr');
    openWith([CEREMONY], 'Africa/Lagos', { ...PAGE.language, chosen: 'fr' });

    const section = await screen.findByRole('region', { name: i18next.t('guest.theDay') });

    expect(within(section).getByText('17:20')).toBeDefined();
  });
});
