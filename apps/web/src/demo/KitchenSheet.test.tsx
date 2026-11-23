import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { type SampleEvent, rangeOf, resetSample, sampleEvent } from './events.ts';
import { clockOfKitchen } from './kitchen.ts';
import { KSW, asOfLine, sheetAt } from './kitchenSheet.ts';
import { coursesAt } from './menuCourses.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

function open(path: string) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function sheet(path: string) {
  const router = open(path);
  await screen.findByRole('heading', { level: 1, name: KSW.title }, WAIT);

  return router;
}

const allergies = () => screen.getByRole('region', { name: KSW.allergies });

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the kitchen sheet (sc-3911)', () => {
  it('dates the snapshot as the board does, in the event’s zone', () => {
    expect(asOfLine(new Date('2027-06-08T18:42:00Z'), 'Europe/London')).toBe(
      'As of Tuesday, Jun 8 · 19:42',
    );
  });

  it('opens from Kitchen sheet on the Menu with its picks', SLOW, async () => {
    const router = open(coursesAt('menuPicks'));
    fireEvent.click(await screen.findByRole('link', { name: KSW.title }, WAIT));
    await screen.findByRole('heading', { level: 1, name: KSW.title }, WAIT);

    expect(router.state.location.pathname).toBe('/demo/events/evt-wed-4/kitchen/sheet');
  });

  it(
    'puts Allergies first, by name with each course’s dish, then Diets and the courses',
    SLOW,
    async () => {
      await sheet(sheetAt('open'));
      const headings = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);

      expect(headings.slice(0, 2)).toEqual([KSW.allergies, KSW.diets]);
      const kwame = within(allergies()).getByRole('row', { name: /Kwame Asante/u });
      expect(within(kwame).getByText('Peanuts, Celery')).toBeTruthy();
      expect(within(allergies()).getByRole('columnheader', { name: KSW.allergicTo })).toBeTruthy();
      expect(screen.getAllByRole('rowheader', { name: KSW.room }).length).toBeGreaterThan(0);
      expect(screen.getByText(/As of /u)).toBeTruthy();
      const date = rangeOf(sampleEvent('evt-wed-4') as SampleEvent, clockOfKitchen());
      expect(screen.getByText(date)).toBeTruthy();
      const leila = within(allergies()).getByRole('row', { name: /Leila Haddad/u });
      expect(within(leila).getByText('Sesame, Kiwi (other)')).toBeTruthy();
    },
  );

  it('shows counts per allergen and no names without Guests manage', SLOW, async () => {
    await sheet(sheetAt('open', 'counts'));

    expect(within(allergies()).queryByText('Kwame Asante')).toBeNull();
    expect(within(allergies()).getByRole('columnheader', { name: KSW.allergen })).toBeTruthy();
    expect(within(allergies()).getByText(KSW.namesNeed)).toBeTruthy();
  });

  it('names the never given the default after the close', SLOW, async () => {
    await sheet(sheetAt('closed'));

    expect(within(allergies()).getAllByText(KSW.cellNever).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/when picks closed\. They are in its count\./u).length,
    ).toBeGreaterThan(0);
  });

  it('lists someone a diet alone kept from the default, after the close', SLOW, async () => {
    await sheet(sheetAt('closed'));
    const bea = within(allergies()).getByRole('row', { name: /Bea Mensah/u });

    expect(within(bea).getByText('No allergy · Vegetarian')).toBeTruthy();
    expect(within(bea).getAllByText(KSW.cellNever).length).toBeGreaterThan(0);
  });

  it('lists them under the no allergies line when nobody has one', SLOW, async () => {
    await sheet(sheetAt('closedNoAllergies'));

    expect(within(allergies()).getByText(KSW.noAllergies)).toBeTruthy();
    const nadia = within(allergies()).getByRole('row', { name: /Nadia Petrova/u });
    expect(within(nadia).getByText('No allergy · Other diet')).toBeTruthy();
  });

  it('says so when no allergies are recorded', SLOW, async () => {
    await sheet(sheetAt('noAllergies'));

    expect(within(allergies()).getByText(KSW.noAllergies)).toBeTruthy();
  });

  it('prints the state it came from, and goes back to it', SLOW, async () => {
    await sheet(sheetAt('noAllergies'));
    fireEvent.click(screen.getByRole('link', { name: KSW.print }));
    await screen.findAllByRole('article', {}, WAIT);

    expect(screen.getByText(KSW.noAllergies)).toBeTruthy();
    expect(screen.getByRole('link', { name: KSW.toSheet }).getAttribute('href')).toBe(
      sheetAt('noAllergies'),
    );
  });

  it('makes the PDF when pressed, then names the file', SLOW, async () => {
    await sheet(sheetAt('open'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: KSW.download }));

    expect(screen.getByRole('button', { name: KSW.making }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText(/Adaeze & Tunde’s wedding kitchen sheet \d{4}-\d{2}-\d{2}\.pdf/u),
    ).toBeTruthy();
  });

  it('keeps the sheet when the PDF fails, and Try again makes it', SLOW, async () => {
    await sheet(sheetAt('failed'));

    expect(screen.getByRole('alert').textContent).toContain(KSW.failed);
    expect(allergies()).toBeTruthy();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: KSW.retry }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the skeleton while loading', SLOW, async () => {
    await sheet(sheetAt('loading'));

    expect(screen.getByText(KSW.loading)).toBeTruthy();
    expect(screen.queryByRole('button', { name: KSW.download })).toBeNull();
  });

  it('refuses without Menu read, back to the event', SLOW, async () => {
    open(sheetAt('refused'));
    await screen.findByRole('heading', { level: 1, name: KSW.refused }, WAIT);

    expect(screen.getByRole('link', { name: KSW.back }).getAttribute('href')).toBe(
      '/demo/events/evt-wed-4',
    );
  });

  it.each([
    ['a4', 'open', 'manage'],
    ['letter', 'closed', 'counts'],
  ] as const)(
    'prints on %s, %s, %s, the health footer on each page',
    SLOW,
    async (paper, state, access) => {
      await sheet(sheetAt(state, access, paper));
      const pages = screen.getAllByRole('article');

      expect(pages).toHaveLength(2);
      for (const page of pages) expect(within(page).getByText(KSW.health)).toBeTruthy();
      const date = rangeOf(sampleEvent('evt-wed-4') as SampleEvent, clockOfKitchen());
      expect(within(pages[0] as HTMLElement).getByText(date)).toBeTruthy();
      expect(pages[0]?.className).toContain(paper === 'letter' ? 'is-letter' : 'ks-sheet');
      expect(screen.queryByText(/£|€|\$/u)).toBeNull();
      if (access === 'counts') expect(screen.getByText(KSW.namesNeed)).toBeTruthy();
    },
  );
});
