import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };

async function open(path: string, heading: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/${path}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: heading }, FIRST_LOAD);
}

describe('Plan and billing on a contract (sc-613)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('shows the contract, the invoices and no banner when paid', async () => {
    await open('settings/plan-and-billing/contract?state=paid', 'Plan and billing');

    expect(screen.getByText('Net 30')).toBeDefined();
    expect(screen.getByText('PO-2026-0412')).toBeDefined();
    expect(screen.getAllByText('Paid')).toHaveLength(2);
    expect(screen.queryByText(/overdue/u)).toBeNull();
  });

  it('shows the banner overdue, and takes it away when Paddle reports it paid', async () => {
    await open('settings/plan-and-billing/contract?state=overdue', 'Plan and billing');

    expect(screen.getByText(/is 2 days overdue/u)).toBeDefined();
    expect(screen.getByText('Past due · 2 days')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Webhook: Paddle reports it paid' }));
    expect(screen.queryByText(/is 2 days overdue/u)).toBeNull();
  });

  it('turns to sc-3937’s words on day 31', async () => {
    await open('settings/plan-and-billing/contract?state=overdue', 'Plan and billing');
    fireEvent.click(screen.getByRole('button', { name: 'Day 31 begins: read-only' }));

    expect(
      screen.getByText('Read-only until the payment is made. Live events are running normally.'),
    ).toBeDefined();
  });

  it('says the term is ending only in the ending state', async () => {
    await open('settings/plan-and-billing/contract?state=ending', 'Plan and billing');

    expect(screen.getByText('Ends in 30 days')).toBeDefined();
  });

  it('says nothing of the term’s end when read-only', async () => {
    await open('settings/plan-and-billing/contract?state=read_only', 'Plan and billing');

    expect(screen.queryByText(/^Ends /u)).toBeNull();
  });

  it('shows no banner to a Member', async () => {
    await open('settings/plan-and-billing/contract?state=overdue&as=ana', 'Events');

    expect(screen.queryByText(/overdue/u)).toBeNull();
  });
});

describe('the staff contract form (sc-613)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('preselects Net 30 and sends nothing while a check fails', async () => {
    await open('support/contract?state=blank', 'Put Ire Events on Enterprise');

    expect((screen.getByRole('radio', { name: /Net 30/u }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save the contract' }));
    expect(screen.getByText('Enter the date the term starts.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Term starts'));
    expect(screen.queryByRole('button', { name: 'Paddle refuses it' })).toBeNull();
  });

  it('shows Paddle’s refusal with nothing saved', async () => {
    await open('support/contract?state=filled', 'Put Ire Events on Enterprise');
    fireEvent.click(screen.getByRole('button', { name: 'Save the contract' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paddle refuses it' }));

    expect(screen.getByRole('alert').textContent).toContain('Nothing was saved.');
  });

  it('shows both refusals and the counter in the invalid state', async () => {
    await open('support/contract?state=invalid', 'Put Ire Events on Enterprise');

    expect(
      screen.getByText('Enter a discount above 0 and below 100, or leave it empty.'),
    ).toBeDefined();
    const counter = screen.getByText('104 of 100 characters · 4 too many');
    const po = screen.getByLabelText('Purchase order number');

    expect(po.getAttribute('aria-describedby')?.split(' ')).toContain(counter.id);
  });
});

describe('the contract emails (sc-613)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('carries the amount, the PO number and the due date', async () => {
    await open('contract-email?state=overdue', 'Your invoice for US$2,490.00 is 7 days overdue');

    expect(screen.getByText('PO-2026-0412')).toBeDefined();
    expect(screen.getByText('30 Oct 2026')).toBeDefined();
    expect(screen.getByText(/Live events keep running/u)).toBeDefined();
  });
});
