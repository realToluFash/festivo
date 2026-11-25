import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 15000 };

describe('the night at a desk (sc-3895)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    cleanup();
    __setConfig(tested);
  });

  it('draws only the title and the skeleton while the run of show loads', SLOW, async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/demo/events/evt-wed-4/night?state=loading'],
    });
    render(<RouterProvider router={router} />);

    await screen.findByRole('progressbar', { name: 'Loading the run of show' }, SLOW);
    expect(screen.getByRole('heading', { level: 1, name: 'Run of show' })).toBeDefined();
    expect(document.querySelector('.nt-head-line')).toBeNull();
    expect(document.querySelector('.nt-head-end')).toBeNull();
    expect(document.querySelector('.nt-strip')).toBeNull();
  });
});
