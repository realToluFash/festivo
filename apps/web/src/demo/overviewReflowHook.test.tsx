import { render, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
  __setConfig(tested);
});

async function pageAt(path: string): Promise<Element> {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

  return waitFor(
    () => {
      const page = document.querySelector('.ev-page');

      if (page == null) throw new Error(`${path} drew no event page`);

      return page;
    },
    { timeout: 8000 },
  );
}

describe('the 320 px reflow applies to the Overview and nowhere else (sc-74933)', () => {
  it('marks an event’s Overview', SLOW, async () => {
    const page = await pageAt('/demo/events/evt-wed-4');

    expect(page.classList.contains('ev-overview')).toBe(true);
  });

  it.each(['/demo/events/evt-wed-4?area=reports', '/demo/events/evt-wed-4/dates'])(
    'leaves %s unmarked',
    SLOW,
    async (path) => {
      const page = await pageAt(path);

      expect(page.classList.contains('ev-overview')).toBe(false);
    },
  );
});
