import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const AT = '/demo/settings/data-and-control/export';

async function exporting(query = '') {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Export all data' }, FIRST_LOAD);
}

describe('Data and control › Export all data (sc-612)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('says what the archive holds, under the card', async () => {
    await exporting();

    expect(screen.getByText('Take everything Ire Events holds')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'What the archive holds' })).toBeDefined();
    expect(screen.getByText('Events with their People')).toBeDefined();
    expect(screen.getByText(/^One \.zip: a JSON file of everything/u)).toBeDefined();
  });

  it('exports, prepares, is ready, and is used up by its one download', async () => {
    await exporting();
    fireEvent.click(screen.getByRole('button', { name: 'Export all data' }));

    expect(screen.getByText('Preparing your export')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    await waitFor(() => expect(screen.getByText('Your export is ready')).toBeDefined(), {
      timeout: 4000,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(screen.getByText('Your export was downloaded')).toBeDefined();
    expect(
      screen.getByText('Downloaded Monday, Oct 19 at 10:05 WAT. Its link is used up.'),
    ).toBeDefined();
  });

  it.each([
    ['ex_ready_other', 'Ire Events’ export is ready'],
    ['ex_expired', 'Your export’s link has ended'],
    ['ex_failed', 'Your export didn’t finish'],
    ['not_owner', 'Only an owner exports Ire Events’ data'],
    ['ex_used_link', 'This download has been used. It downloads nothing now.'],
    [
      'ex_limited',
      'The next export can start on Tuesday, Oct 20 at 09:30 WAT. Nothing was started.',
    ],
  ])('opens %s with its words', async (state, words) => {
    await exporting(`?state=${state}`);

    expect(screen.getByText(words)).toBeDefined();
  });

  it('gives an admin no step, ever', async () => {
    await exporting('?state=ex_ready_other');

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export all data' })).toBeNull();
  });

  it('says a refused second export above the card, as an alert', async () => {
    await exporting('?state=ex_limited');

    expect(screen.getByRole('alert').textContent).toContain('Nothing was started.');
    expect(screen.getByText('Your export was downloaded')).toBeDefined();
  });

  it('tries again from a failed export', async () => {
    await exporting('?state=ex_failed');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Preparing your export')).toBeDefined();
  });

  it('loads, and fails with a way to try again', async () => {
    await exporting('?state=failed');

    expect(screen.getByText('We could not load Export all data.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Loading Export all data…')).toBeDefined();
  });
});
