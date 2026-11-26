import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { ALL_DATES_PAGES } from './allDates.ts';
import { resetSample } from './events.ts';
import { KW, resetKitchen } from './kitchen.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/dates';

function open(path: string) {
  cleanup();
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

async function arrive(state: string) {
  open(`${AT}?state=${state}`);

  return screen.findByRole('heading', { level: 1, name: KW.allDates }, WAIT);
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
  resetKitchen();
});

describe('All dates loading and failed (sc-98187)', () => {
  it(
    'shows the product’s loading words under the strip, with no dates and no key',
    SLOW,
    async () => {
      await arrive('allDatesLoading');

      expect(await screen.findByText('Loading the dates…', {}, WAIT)).toBeDefined();
      const page = document.querySelector('.dates')!;
      expect(page.querySelector('ol')).toBeNull();
      expect(within(page as HTMLElement).queryByText(KW.keyYou)).toBeNull();
      expect(within(page as HTMLElement).getByText('Adaeze & Tunde’s wedding')).toBeDefined();
    },
  );

  it('fails quietly on arrival, and Try again lands on the title and loads', SLOW, async () => {
    const title = await arrive('allDatesFailed');
    const failed = screen.getByText('The dates did not load.').closest('div')!;

    expect(failed.getAttribute('role')).toBeNull();
    fireEvent.click(within(failed).getByRole('button', { name: 'Try again' }));
    expect(document.activeElement).toBe(title);
    expect(await screen.findByText('Adaeze & Tunde’s wedding starts', {}, WAIT)).toBeDefined();
    expect(screen.getByText(KW.keyYou)).toBeDefined();
  });

  it('says a failed retry aloud, and the next one loads', SLOW, async () => {
    await arrive('allDatesFailedAgain');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const alert = await screen.findByRole('alert', {}, WAIT);
    expect(alert.textContent).toContain('The dates did not load.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Adaeze & Tunde’s wedding starts', {}, WAIT)).toBeDefined();
  });

  it('lists every state on the demo’s home', () => {
    const home = readFileSync(join(__dirname, 'Demo.tsx'), 'utf8');
    const links = ALL_DATES_PAGES.flatMap((page) => page.states).map((state) => state.to);

    expect(home).toContain('<BoardPages pages={ALL_DATES_PAGES} />');
    expect(links.filter((to) => to.includes('allDates'))).toHaveLength(3);
  });
});
