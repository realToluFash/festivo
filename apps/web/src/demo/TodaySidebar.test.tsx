import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample, sampleEvents } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const SIDEBAR_CSS = readFileSync(join(import.meta.dirname, 'sidebar.css'), 'utf8');

async function side(path: string): Promise<HTMLElement> {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

  return screen.findByRole('navigation', { name: 'Soirely' }, WAIT);
}

describe('the sidebar’s Your events (sc-39290)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  it.each(['/demo/today', '/demo/events', '/demo/calendar', '/demo/settings'])(
    'has no heading over nothing on %s with no events',
    SLOW,
    async (path) => {
      const nav = await side(`${path}?sidebar=none`);

      expect(within(nav).queryByRole('heading', { name: 'Your events' })).toBeNull();
      expect(within(nav).getByRole('link', { name: 'Settings' })).toBeDefined();
    },
  );

  it(
    'lists every event, each a link to its page, when there are more than it holds',
    SLOW,
    async () => {
      const nav = await side('/demo/events?sidebar=many');
      const heading = within(nav).getByRole('heading', { name: 'Your events' });
      const rows = within(heading.parentElement as HTMLElement).getAllByRole('link');

      expect(rows).toHaveLength(sampleEvents().length);
      expect(rows[0]?.getAttribute('href')).toBe(`/demo/events/${sampleEvents()[0]?.id}`);
    },
  );

  it('scrolls the list under its heading, keeping at least four rows before the sidebar scrolls', () => {
    expect(SIDEBAR_CSS).toMatch(/\.today-side-events > \.today-places \{[^}]*overflow-y: auto;/u);
    expect(SIDEBAR_CSS).toMatch(/min-height: calc\(var\(--sizeHit\) \* 4 \+ var\(--space3xl\)\);/u);
  });
});
