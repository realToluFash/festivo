import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 8000 };

function open(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/shift-clock?state=${state}`],
  });
  render(<RouterProvider router={router} />);
}

describe('The clock card in a browser (sc-234)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
  });

  it('clocks in at the time Soirely receives it', SLOW, async () => {
    open('ready');

    fireEvent.click(await screen.findByRole('button', { name: 'Clock in' }, SLOW));

    expect(await screen.findByText('Clocked in at 16:58', {}, SLOW)).toBeTruthy();
  });

  it('holds Clock in until an hour before the shift', SLOW, async () => {
    open('before');

    const opens = await screen.findByRole('button', { name: 'Clock in opens at 16:00' }, SLOW);
    expect((opens as HTMLButtonElement).disabled).toBe(true);
  });

  it('ends on the link’s ended page, with no event name', SLOW, async () => {
    open('access_ended_clocked_out');

    expect(await screen.findByText('You are signed out of this browser.', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('Adébáyọ̀ at 60')).toBeNull();
  });
});
