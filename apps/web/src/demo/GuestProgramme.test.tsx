import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const SLOW = { timeout: 15000 };
const tested = config();

async function guest(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guest?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('banner', {}, SLOW);
}

function section(name: string | RegExp): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function rows(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('listitem')
    .map((one) => one.textContent ?? '');
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  __setConfig(tested);
});

describe('The day on the guest’s page (sc-3899)', () => {
  it('lists each event day under its own heading, places named, planned times', SLOW, async () => {
    await guest('programmeBefore');
    const programme = section('Programme');
    const days = within(programme).getAllByRole('heading', { level: 3 });

    expect(days.map((one) => one.textContent)).toEqual([
      'Thursday, November 5',
      'Friday, November 6',
    ]);
    const lists = within(programme).getAllByRole('list');

    expect(rows(lists[0] as HTMLElement)).toEqual(['18:00Welcome drinks']);
    expect(rows(lists[1] as HTMLElement)).toEqual([
      '14:00Ceremony',
      '15:00Drinks reception · Garden',
      '17:00Grand entrance · Ballroom',
      '17:30Dinner · Ballroom',
      '20:00First dance · Ballroom',
    ]);
  });

  it('sits under the event’s details', SLOW, async () => {
    await guest('programmeBefore');

    expect(section('Programme').parentElement?.classList.contains('gp-details')).toBe(true);
  });

  it('reads The day for one event day, with no day headings', SLOW, async () => {
    await guest('programmeOneDay');
    const day = section('The day');

    expect(within(day).queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(rows(within(day).getByRole('list')).at(-1)).toBe('Sat 00:30Late food · Ballroom');
  });

  it('names no place when the items shown have one', SLOW, async () => {
    await guest('programmeOnePlace');

    expect(rows(within(section('The day')).getByRole('list'))).toEqual([
      '17:00Grand entrance',
      '17:30Dinner',
      '20:00First dance',
    ]);
  });

  it('is not there with nothing shown to guests, or once called off', SLOW, async () => {
    await guest('programmeNone');
    expect(screen.queryByRole('heading', { name: /^(The day|Programme)$/u })).toBeNull();
    cleanup();
    await guest('programmeCalledOff');
    expect(screen.queryByRole('heading', { name: /^(The day|Programme)$/u })).toBeNull();
  });

  it('names the event’s zone once, for a guest elsewhere', SLOW, async () => {
    await guest('programmeZone');

    expect(within(section('Programme')).getByText('Times in Europe/London.')).toBeDefined();
    const drinks = within(section('Programme')).getByText('18:00');

    expect(drinks.closest('time')?.getAttribute('datetime')).toBe('2026-11-05T18:00+00:00');
  });

  it(
    'goes after Where and Your table, before Your answer, for a Coming guest on the day',
    SLOW,
    async () => {
      await guest('programmeOnTheDayTable');
      const order = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);

      expect(order).toEqual([
        'Your code',
        'Where',
        'Your table',
        'Programme',
        'Your answer',
        'Add to calendar',
      ]);
    },
  );

  it('stays for Not coming and Not sure yet, in the usual order', SLOW, async () => {
    for (const state of ['programmeNotComing', 'programmeNotSure']) {
      await guest(state);
      expect(section('Programme').parentElement?.classList.contains('gp-details')).toBe(true);
      cleanup();
    }
  });

  it('shows expected times while Happening now, and never lateness', SLOW, async () => {
    await guest('programmeHappening');
    const programme = section('Programme');
    const friday = within(programme).getAllByRole('list')[1] as HTMLElement;

    expect(rows(friday)).toEqual([
      '14:05Ceremony',
      '15:05Drinks reception · Garden',
      '17:20Grand entrance · Ballroom',
      '17:35Dinner · Ballroom',
      '20:00First dance · Ballroom',
    ]);
    expect(programme.textContent).not.toMatch(/late|behind|about|expected|planned/iu);

    for (let step = 0; step < 4; step += 1)
      fireEvent.click(within(programme).getByRole('button', { name: 'Move the clock on 5 min' }));
    expect(rows(friday)[3]).toBe('17:45Dinner · Ballroom');
  });

  it('is kept after the end with planned times, as a keepsake', SLOW, async () => {
    await guest('programmeFinished');
    const lists = within(section('Programme')).getAllByRole('list');

    expect(rows(lists[1] as HTMLElement)[3]).toBe('17:30Dinner · Ballroom');
  });

  it('dates its days in the guest’s language', SLOW, async () => {
    await guest('programmeFrench');
    const programme = section('[Programme]');

    expect(
      within(programme)
        .getAllByRole('heading', { level: 3 })
        .map((one) => one.textContent),
    ).toEqual(['jeudi 5 novembre', 'vendredi 6 novembre']);
  });
});
