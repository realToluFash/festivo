import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 15000 };
const AT = '/demo/events/evt-wed-4?area=budget&state=';

async function open(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

function block(name: string): HTMLElement {
  const found = screen.getByRole('heading', { name }).closest('section');
  if (found == null) throw new Error(`${name} is not drawn`);

  return found;
}

describe('Against plan at a desk (sc-89)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the four figures apart on the card, under Budget in the crumb', SLOW, async () => {
    await open('plan');

    expect(screen.getByRole('heading', { level: 1, name: 'Against plan' })).toBeDefined();
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumb).getByRole('link', { name: 'Budget' })).toBeDefined();
    const card = screen.getByRole('region', { name: 'Against plan' });
    for (const figure of ['£19,730', '£18,900', '£4,310', '£13,090'])
      expect(within(card).getByText(figure)).toBeDefined();
    expect(within(card).getByText('5 payments scheduled')).toBeDefined();
  });

  it('leads each quoted category to its vendor’s page, and the rest nowhere', SLOW, async () => {
    await open('plan');

    const rows = within(block('By category · planned'));
    const catering = rows.getByRole('link', { name: /^Catering/u });
    expect(catering.getAttribute('href')).toBe('/demo/events/evt-wed-4?area=budget&vendor=v4');
    expect(catering.textContent).toContain('£8,640.00');
    expect(rows.getAllByRole('link')).toHaveLength(4);
    expect(rows.getAllByText('No quote')).toHaveLength(2);
  });

  it('says Not known where a quote covers a cost not priced', SLOW, async () => {
    await open('plan_unknown');

    const flowers = within(block('By category · planned')).getByRole('link', { name: /^Flowers/u });
    expect(flowers.textContent).toContain('Bloom & Co · Not known · 1 cost not priced yet');
    expect(flowers.textContent).not.toContain('over');
  });

  it('shows the cost per head of those who came after the event', SLOW, async () => {
    await open('plan_after');

    const card = screen.getByRole('region', { name: 'Against plan' });
    expect(within(card).getByText('Paid to vendors, per head')).toBeDefined();
    expect(within(card).getByText('for the 91 who came')).toBeDefined();
    expect(within(card).queryByText('Committed')).toBeNull();
  });

  it(
    'says attendance was not recorded, and gives no per head of those who came',
    SLOW,
    async () => {
      await open('plan_unrecorded');

      expect(
        screen.getByText(
          'Attendance was not recorded, so there is no cost per head of those who came.',
        ),
      ).toBeDefined();
      expect(screen.queryByText('Paid to vendors, per head')).toBeNull();
    },
  );

  it('prints the A4 sheet from Print, and takes it away after', SLOW, async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await open('plan');

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    const sheet = document.body.querySelector(':scope > .plan-print');
    expect(sheet?.textContent).toContain('Printed Tue, Nov 3, 2026 at 09:41 · client figures only');

    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(document.body.querySelector(':scope > .plan-print')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Print For a conversation/u }));
    expect(print).toHaveBeenCalledTimes(2);
  });

  it('draws the printed sheet with client figures only and nothing to press', SLOW, async () => {
    await open('print');

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Adaeze & Tunde’s wedding · the budget against plan',
      }),
    ).toBeDefined();
    const sheet = screen.getByRole('main');
    expect(within(sheet).getByText('£13,090.00')).toBeDefined();
    expect(within(sheet).queryAllByRole('link')).toHaveLength(0);
    expect(within(sheet).queryAllByRole('button')).toHaveLength(0);
    expect(sheet.textContent).not.toMatch(/margin|internal cost/iu);
  });
});
