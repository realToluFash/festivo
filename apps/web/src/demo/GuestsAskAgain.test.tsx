import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Guests, when a guest who isn’t sure yet will be asked again (sc-1363)', () => {
  it('reads the ask in place of the date', SLOW, async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/guests?state=askAgain'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Guests' }, { timeout: 8000 });

    const text = screen.getByRole('main').textContent ?? '';

    expect(text).toContain('Not sure yet · asked again Oct 23 · 1 companion');
    expect(text).toContain('Not sure yet · will be asked again Nov 1');
    expect(text).toContain('Not sure yet · won’t be asked again');
    expect(text).toContain('Not sure yet · asked to decide by Nov 4');
    expect(text).not.toContain('Maybe');
  });
});
