import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };

async function usage(query: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/usage-warning${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, FIRST_LOAD);
}

describe('the usage warning at a desk (sc-3931)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('draws each item as sent: drafts in three lines, storage in two, no More', async () => {
    await usage('?state=eighty');
    const bell = screen.getByRole('dialog', { name: 'Notifications' });

    expect(within(bell).getByText('80 of 100 assistant drafts')).toBeDefined();
    expect(
      within(bell).getByText('Your included assistant drafts reset on 1 December.'),
    ).toBeDefined();
    expect(within(bell).getByText('1.6 GB of 2 GB storage')).toBeDefined();
    expect(within(bell).queryByRole('button', { name: /^More for/u })).toBeNull();
  });

  it('switches to the organisation the warning names before it opens Usage this period', async () => {
    await usage('?state=other');
    const bell = screen.getByRole('dialog', { name: 'Notifications' });

    fireEvent.click(
      within(bell).getByRole('button', {
        name: /Ire Events has used 80% of its included storage/u,
      }),
    );

    expect(screen.getByText('Now working in Ire Events.')).toBeDefined();
    expect(screen.getByText(/Usage this period for Ire Events/u)).toBeDefined();
  });

  it('adds the arrival at the top and says it politely, leaving focus where it was', async () => {
    await usage('?state=live');
    const play = screen.getByRole('button', { name: 'Play the arrival' });
    play.focus();

    fireEvent.click(play);

    expect(
      screen.getByText('New notification: Ire Events has used all its included assistant drafts'),
    ).toBeDefined();
    expect(document.activeElement).toBe(play);
  });

  it('sends the email with its subject, its lines and one link', async () => {
    await usage('?state=email&warning=storage100');

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Ire Events has used all its included storage',
      }),
    ).toBeDefined();
    expect(screen.getByText('Uploads keep working, and nothing is charged.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open Plan and billing' })).toBeDefined();
  });
});
