import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetTab, loseConnection } from './tabKept.ts';

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
    forgetTab();
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

  it(
    'sets quotes not wholly in one category apart, each cost naming its category',
    SLOW,
    async () => {
      await open('plan_across');

      const across = within(block('Quotes not wholly in one category'));
      const savour = across.getByRole('link', { name: /^Savour Kitchen/u });
      expect(savour.textContent).toContain('Catering · Staffing · Hire');
      expect(savour.textContent).toContain('Not known · 1 cost not priced yet');
      const opens = across.getByRole('button', { name: 'Savour Kitchen’s costs' });
      expect(opens.getAttribute('aria-expanded')).toBe('false');
      expect(across.queryByRole('list', { name: 'Savour Kitchen’s costs' })).toBeNull();
      fireEvent.click(opens);
      expect(opens.getAttribute('aria-expanded')).toBe('true');
      expect(across.getByRole('list', { name: 'Savour Kitchen’s costs' }).textContent).toContain(
        'Hire · No price yet',
      );
      fireEvent.click(opens);
      expect(across.queryByRole('list', { name: 'Savour Kitchen’s costs' })).toBeNull();
      expect(across.queryByRole('link', { name: /^Glow Lighting/u })).toBeNull();
      expect(across.queryByRole('button', { name: 'Glow Lighting’s costs' })).toBeNull();
      expect(across.getByText('Covers no budget line')).toBeDefined();
      expect(across.getByText('Nothing planned')).toBeDefined();
      expect(within(block('By category · planned')).queryByText('Catering')).toBeNull();
    },
  );

  it('gives a quote over a plan of £0 the amount alone', SLOW, async () => {
    await open('plan_zero_heads');

    const catering = within(block('By category · planned')).getByRole('link', {
      name: /^Catering/u,
    });
    expect(catering.textContent).toContain('£9,000.00 over');
    expect(catering.textContent).not.toContain('%');
  });

  it('after the event with nobody who said yes, says No figure yet', SLOW, async () => {
    await open('plan_after_no_yes');

    const card = screen.getByRole('region', { name: 'Against plan' });
    expect(within(card).getByText('No figure yet')).toBeDefined();
    expect(within(card).getByText('Nobody has said yes')).toBeDefined();
    expect(within(card).queryByText(/who said yes$/u)).toBeNull();
  });

  it('with no costs, says so and opens the budget, with nothing to print', SLOW, async () => {
    const router = await open('plan_empty');

    expect(screen.getByText('No costs yet')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();
    expect(screen.queryByText('£0')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open the budget' }));
    expect(router.state.location.search).toBe('?area=budget&state=first_time');
  });

  it('loads, and after did not load, tries again', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('plan_failed');

    expect(
      screen.getByText('Against plan did not load. Check your connection and try again.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Loading Against plan…')).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('region', { name: 'Against plan' })).toBeDefined();
    vi.useRealTimers();
  });

  it('says when it is not live, and Try now takes the strip away', SLOW, async () => {
    await open('plan_not_live');

    expect(screen.getByText('Not live. Figures as of 09:32, 9 minutes ago.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try now' }));
    expect(screen.queryByText('Not live. Figures as of 09:32, 9 minutes ago.')).toBeNull();
  });

  it('offline, stands under the box as of the last load', SLOW, async () => {
    await open('plan');
    act(() => loseConnection());

    expect(screen.getByText(/^Offline · as of/u)).toBeDefined();
    expect(screen.getByRole('region', { name: 'Against plan' })).toBeDefined();
  });

  it.each(['plan', 'planning'])(
    'shows Can edit the not-found page by a direct link to %s',
    SLOW,
    async (state) => {
      await open(`${state}&as=kemi`);

      expect(
        screen.getByRole('heading', { level: 1, name: 'This event is not available' }),
      ).toBeDefined();
      expect(screen.queryByText(/permission|access/iu)).toBeNull();
    },
  );
});

describe('What it will cost, the planning tier (sc-89)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
  });

  it('reads the range, the count and every cost, with no comparison', SLOW, async () => {
    await open('planning');

    expect(screen.getByRole('heading', { level: 1, name: 'What it will cost' })).toBeDefined();
    const card = screen.getByRole('region', { name: 'What it will cost' });
    expect(within(card).getByText('£19,730 to £23,060')).toBeDefined();
    expect(within(card).getByText('2 costs not priced yet')).toBeDefined();
    const costs = within(block('Costs'));
    expect(costs.getByText('Aisle arch')).toBeDefined();
    expect(costs.getAllByText('Not priced')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/Committed|Still to pay|Paid to vendors/u);
    expect(block('Track what is agreed and what is paid')).toBeDefined();
  });

  it(
    'with nobody who said yes, says No figure yet in place of the settled per head',
    SLOW,
    async () => {
      await open('planning_zero_heads');

      const card = screen.getByRole('region', { name: 'What it will cost' });
      expect(within(card).getByText('No figure yet')).toBeDefined();
    },
  );

  it('prints one A4 sheet without the tracking card, and nothing to press', SLOW, async () => {
    await open('planning_print');

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Adaeze & Tunde’s wedding · what it will cost',
      }),
    ).toBeDefined();
    const sheet = screen.getByRole('main');
    expect(sheet.textContent).toContain('everybody who said yes, is still to answer or is held');
    expect(within(sheet).queryByText('Track what is agreed and what is paid')).toBeNull();
    expect(within(sheet).queryAllByRole('link')).toHaveLength(0);
    expect(within(sheet).queryAllByRole('button')).toHaveLength(0);
  });

  it('prints the sheet from Print in the header', SLOW, async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await open('planning');

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    expect(document.body.querySelector(':scope > .plan-print')?.textContent).toContain(
      'what it will cost',
    );
  });

  it('with no costs, never reads £0 to £0', SLOW, async () => {
    await open('planning_empty');

    expect(screen.getByText('No costs yet')).toBeDefined();
    expect(screen.queryByText(/£0 to £0/u)).toBeNull();
  });

  it('loads, and says when it did not', SLOW, async () => {
    await open('planning_loading');
    expect(screen.getByText('Loading what it will cost…')).toBeDefined();
    cleanup();
    await open('planning_failed');
    expect(
      screen.getByText('What it will cost did not load. Check your connection and try again.'),
    ).toBeDefined();
  });
});
