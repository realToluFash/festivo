import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const AT = '/demo/settings/plan-and-billing';

async function billing(query: string, title = 'Plan and billing') {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, FIRST_LOAD);
}

function card(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function box(plan: string): HTMLElement {
  return screen.getByRole('region', { name: `${plan}: What changes for Ire Events` });
}

describe('Plan and billing › Compare plans (sc-3935)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens Compare plans from Change plan, and not the checkout', async () => {
    await billing('');
    fireEvent.click(screen.getByRole('button', { name: 'Change plan' }));

    const dialog = await screen.findByRole('dialog', { name: 'Compare plans' });
    expect(within(dialog).getByText('From $249 a month')).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: 'Upgrade' })).toBeNull();
    expect(
      within(box('Enterprise')).getByText(
        'Talk to us sends Soirely Ire Events, your name and email, and this summary.',
      ),
    ).toBeDefined();
    expect(
      within(box('Free')).getByText('Nothing. This is the plan Ire Events is on.'),
    ).toBeDefined();
  });

  it('marks what a plan lacks as Not included, and its unlimited amounts as a word', async () => {
    await billing('?state=compare');
    const dialog = await screen.findByRole('dialog', { name: 'Compare plans' });
    const audit = within(dialog).getByRole('row', { name: /Audit log/u });
    expect(within(audit).getByText('Not included')).toBeDefined();
    expect(within(audit).getByText('Included')).toBeDefined();
    const events = within(dialog).getByRole('row', { name: /Live events/u });
    expect(within(events).getByText('Unlimited')).toBeDefined();
  });

  it('thanks the owner once Talk to us is sent', async () => {
    await billing('?state=compare');
    fireEvent.click(within(box('Enterprise')).getByRole('button', { name: 'Talk to us' }));

    await waitFor(() =>
      expect(
        within(box('Enterprise')).getByText('Thanks. We’ll reply within one working day.'),
      ).toBeDefined(),
    );
    expect(within(box('Enterprise')).queryByRole('button', { name: 'Talk to us' })).toBeNull();
  });

  it('sends nothing more within 24 hours, and gives the first request’s time', async () => {
    await billing('?state=talk_repeat');
    fireEvent.click(within(box('Enterprise')).getByRole('button', { name: 'Talk to us' }));

    await waitFor(() =>
      expect(within(box('Enterprise')).getByText(/^Already sent .+ at \d{2}:\d{2}/u)).toBeDefined(),
    );
  });

  it('still reads Enterprise as Talk to us with the price line off', async () => {
    await billing('?state=price_off');
    const dialog = await screen.findByRole('dialog', { name: 'Compare plans' });
    expect(within(dialog).queryByText(/From .* a month/u)).toBeNull();
    expect(within(box('Enterprise')).getByRole('button', { name: 'Talk to us' })).toBeDefined();
  });

  it('keeps its title in French', async () => {
    await billing('?state=compare&lang=fr', 'Forfait et facturation');
    expect(await screen.findByRole('dialog', { name: 'Comparer les forfaits' })).toBeDefined();
  });

  it('gives a Member no Change plan', async () => {
    await billing('?as=ana');
    expect(screen.queryByRole('button', { name: 'Change plan' })).toBeNull();
  });

  it('upgrades a self-serve plan through the amount due today, then the hosted checkout', async () => {
    await billing('?state=self_serve');
    fireEvent.click(within(box('Enterprise')).getByRole('button', { name: 'Upgrade' }));

    const ask = await screen.findByRole('alertdialog', { name: 'Upgrade to Enterprise?' });
    await waitFor(() => expect(within(ask).getByText('$249')).toBeDefined());
    fireEvent.click(within(ask).getByRole('button', { name: 'Continue to payment' }));

    const hosted = await screen.findByRole('dialog', {
      name: 'Paddle’s hosted checkout, not ours',
    });
    fireEvent.click(within(hosted).getByRole('button', { name: 'Pay' }));
    expect(within(card('Your plan')).getByText('Confirming your payment…')).toBeDefined();
  });

  it('asks a downgrade once, with what changes and the day it takes effect', async () => {
    await billing('?state=compare_enterprise');
    fireEvent.click(within(box('Free')).getByRole('button', { name: 'Downgrade…' }));

    const ask = await screen.findByRole('alertdialog', { name: 'Downgrade to Free?' });
    expect(
      within(ask).getByText(
        'Ire Events stays on Enterprise until Wednesday, Dec 2, then moves to Free. Nothing is deleted.',
      ),
    ).toBeDefined();
    expect(within(ask).getByText(/^3 of your events have more than 100 people/u)).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Downgrade' }));

    const plan = card('Your plan');
    expect(within(plan).getByText('Moving to Free on Wednesday, Dec 2.')).toBeDefined();
    fireEvent.click(within(plan).getByRole('button', { name: 'Keep Enterprise' }));
    expect(within(plan).queryByText('Moving to Free on Wednesday, Dec 2.')).toBeNull();
  });

  it('cancels a plan as a downgrade to Free at the period’s end', async () => {
    await billing('?state=on_enterprise');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel plan…' }));

    const ask = await screen.findByRole('alertdialog', { name: 'Cancel Enterprise?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel plan' }));
    fireEvent.click(screen.getByRole('button', { name: /2026 comes$/u }));

    const plan = card('Your plan');
    expect(within(plan).getByText('Free')).toBeDefined();
    expect(within(plan).getByText(/^Nothing was deleted\./u)).toBeDefined();
  });

  it('switches to yearly from today', async () => {
    await billing('?state=yearly_ask');
    const ask = await screen.findByRole('alertdialog', { name: 'Switch to yearly?' });
    expect(within(ask).getByText(/\$2,456\.80 due today/u)).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Switch to yearly' }));

    expect(within(card('Your plan')).getByText(/^\$2,490 a year, renews .*2027$/u)).toBeDefined();
  });
});
