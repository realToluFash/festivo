import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };

async function refused(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/limit-reached?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, FIRST_LOAD);
}

describe('the refusal at a limit, on the web (sc-3930)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.useRealTimers());

  it('gives billing.manage Change plan and no Ask an owner', async () => {
    await refused('liveManage');
    const dialog = screen.getByRole('dialog', { name: 'Your plan allows 2 live events at once' });

    expect(within(dialog).getByRole('button', { name: 'Change plan' })).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: 'Ask an owner' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Compare plans' })).toBeNull();
    expect(
      within(dialog).getByText(/Another event can go live when Summer gala ends/u),
    ).toBeDefined();
  });

  it('asks an owner: sending, then the sent line in the status region', async () => {
    await refused('liveOther');
    vi.useFakeTimers();
    const dialog = screen.getByRole('dialog', { name: 'Your plan allows 2 live events at once' });
    const ask = within(dialog).getByRole('button', { name: 'Ask an owner' });

    fireEvent.click(ask);
    expect(ask.getAttribute('aria-busy')).toBe('true');
    act(() => vi.runAllTimers());

    expect(within(dialog).queryByRole('button', { name: 'Ask an owner' })).toBeNull();
    expect(within(dialog).getByRole('status').textContent).toBe(
      'The owners have been sent the link to Compare plans.',
    );
  });

  it('keeps the button after Not sent, and the next press clears the line', async () => {
    await refused('liveNotSent');
    const dialog = screen.getByRole('dialog', { name: 'Your plan allows 2 live events at once' });

    expect(within(dialog).getByRole('alert').textContent).toBe('Not sent. Try again in a moment.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask an owner' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('');
  });

  it('offers only Ask an owner and Not now on an invitation accepted, whatever the role', async () => {
    await refused('accept');
    const dialog = screen.getByRole('dialog', { name: 'Every team seat at Ìrè Events is in use' });

    expect(within(dialog).getByRole('button', { name: 'Ask an owner' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Not now' })).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: 'Change plan' })).toBeNull();
  });

  it('offers only Remove a guest under the ceiling', async () => {
    await refused('ceilingImport');
    const dialog = screen.getByRole('dialog', { name: 'An event can have up to 10,000 people' });

    expect(within(dialog).getByRole('link', { name: 'Go to the guest list' })).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: 'Change plan' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Ask an owner' })).toBeNull();
  });

  it('closes on its way back, leaving the page as it was', async () => {
    await refused('inviteManage');
    const dialog = screen.getByRole('dialog', { name: 'Your plan allows 3 team seats' });

    expect(within(dialog).getByRole('link', { name: /Withdraw an invitation/u })).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to the invitation' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show the refusal again' })).toBeDefined();
  });
});
