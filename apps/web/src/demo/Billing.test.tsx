import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const AT = '/demo/settings/plan-and-billing';

async function billing(query: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Plan and billing' }, FIRST_LOAD);
}

function card(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

describe('Plan and billing › the hosted checkout at a desk (sc-3933)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens the packs from Add credits, a disclosure, priced in the account’s currency', async () => {
    await billing('?currency=EUR');
    const add = screen.getByRole('button', { name: 'Add credits' });
    expect(add.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(add);

    expect(add.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /1,000 credits\s*€11/u })).toBeDefined();
  });

  it('buys a pack only through Paddle’s checkout, then waits for the webhook', async () => {
    await billing('?state=packs');
    fireEvent.click(screen.getByRole('button', { name: /1,000 credits/u }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Paddle’s hosted checkout, not ours',
    });
    expect(within(dialog).getByText('The currency: USD')).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Pay' }));

    const credits = card('Credits');
    expect(within(credits).getByText('Buying 1,000 credits…')).toBeDefined();
    expect(within(credits).getByText('5,920 credits').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('button', { name: 'Add credits' })).toBeDefined();

    fireEvent.click(within(credits).getByRole('button', { name: 'Webhook: 1,000 credits paid' }));

    expect(within(credits).getByText('6,920 credits')).toBeDefined();
    expect(within(credits).queryByText('Buying 1,000 credits…')).toBeNull();
    expect(screen.getByText('Credits bought +1,000. 6,920 credits.')).toBeDefined();
  });

  it('says Credits not added only when the checkout closes without paying, the packs left open', async () => {
    await billing('?state=checkout_open');
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() =>
      expect(
        within(card('Credits')).getByText('Credits not added. Nothing was charged.'),
      ).toBeDefined(),
    );
    expect(screen.getByRole('button', { name: 'Add credits' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('keeps one line for each of two purchases, each ended by its own webhook', async () => {
    await billing('?state=buying_two');
    const credits = card('Credits');
    expect(within(credits).getByText('Buying 1,000 credits…')).toBeDefined();
    expect(within(credits).getByText('Buying 5,000 credits…')).toBeDefined();

    fireEvent.click(within(credits).getByRole('button', { name: 'Webhook: 5,000 credits paid' }));

    expect(within(credits).getByText('Buying 1,000 credits…')).toBeDefined();
    expect(within(credits).queryByText('Buying 5,000 credits…')).toBeNull();
  });

  it('says it is being confirmed after 2 minutes, and never that it failed', async () => {
    await billing('?state=slow');
    const credits = card('Credits');

    expect(within(credits).getByText('Your payment is being confirmed.')).toBeDefined();
    expect(within(credits).getByText('We’ll email you once it is confirmed.')).toBeDefined();
    const inset = within(credits)
      .getByText('Your payment is being confirmed.')
      .closest('.bl-inset');
    expect(inset?.textContent).not.toMatch(/fail/iu);
  });

  it('shows the payment method as Paddle returns it, Update named in full', async () => {
    await billing('?state=card_brandless');
    expect(
      within(card('Payment method')).getByText(/Card ending 4242 · Expires 08\/2028/u),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Update the payment method' })).toBeDefined();
  });

  it('shows no method line for a method Paddle names no way to show, and never No payment method', async () => {
    await billing('?state=card_other');
    const method = card('Payment method');
    expect(within(method).queryByText(/ending|PayPal/u)).toBeNull();
    expect(within(method).queryByText(/No payment method/u)).toBeNull();
    expect(
      within(method).getByText('Card details go to our payment provider, never to us.'),
    ).toBeDefined();
  });

  it('takes away every change control once the role changed under the page', async () => {
    await billing('?state=refused');
    expect(screen.getByRole('alert').textContent).toContain('Nothing was changed.');
    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update the payment method' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change plan' })).toBeNull();
  });

  it('gives an Administrator no Add credits and no Update', async () => {
    await billing('?as=julien');
    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update the payment method' })).toBeNull();
    expect(within(card('Credits')).getByText('5,920 credits')).toBeDefined();
  });

  it('confirms a plan change with no plan buttons while it waits', async () => {
    await billing('?state=confirming_plan');
    const plan = card('Your plan');
    expect(within(plan).getByText('Confirming your payment…')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change plan' })).toBeNull();

    fireEvent.click(within(plan).getByRole('button', { name: 'Webhook: the plan is paid' }));

    expect(within(plan).getByText('Enterprise')).toBeDefined();
    expect(within(plan).getByText(/249 a month, renews .*2026/u)).toBeDefined();
  });
});
