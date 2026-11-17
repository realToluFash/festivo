import { act, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function today(query: string): Promise<HTMLElement> {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/demo/today?${query}`] })}
    />,
  );

  return screen.findByRole('heading', { level: 1 }, WAIT);
}

describe("Now's line once its reads stop landing (sc-62416)", () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says how old the run of show is, as a status, under the figure', SLOW, async () => {
    await today('moment=day&reads=asOf');

    expect(screen.getByRole('status').textContent).toBe('Offline · as of 16:38');
    expect(screen.getByText('10 min behind')).toBeDefined();
  });

  it('gives its day once the last read landed on an earlier day', SLOW, async () => {
    await today('moment=day&reads=asOfDay');

    expect(screen.getByRole('status').textContent).toMatch(
      /^Offline · as of Thursday, Nov 5 at 23:52$|^Offline · as of Thursday 5 Nov at 23:52$/u,
    );
  });

  it('is not there without a failed read, and Now is as sc-61017 left it', SLOW, async () => {
    await today('moment=day');

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open run of show' })).toBeDefined();
  });

  it(
    'shows within 60 seconds of reads failing, goes when one lands, and a refusal builds Now',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await today('moment=day&reads=live');
      const line = screen.getByRole('status');

      expect(line.textContent).toBe('');
      fireEvent.click(screen.getByRole('button', { name: 'Reads do not reach Soirely' }));
      await act(() => vi.advanceTimersByTimeAsync(55_000));
      expect(line.textContent).toBe('');
      await act(() => vi.advanceTimersByTimeAsync(6_000));
      expect(line.textContent).toBe('Offline · as of 16:40');

      fireEvent.click(screen.getByRole('button', { name: 'Reads land' }));
      expect(screen.getByRole('status').textContent).toBe('');

      fireEvent.click(screen.getByRole('button', { name: 'Reads are refused (403)' }));
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Open run of show' })).toBeNull();
    },
  );
});
