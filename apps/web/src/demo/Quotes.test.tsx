import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 15000 };
const BUDGET = '/demo/events/evt-gala-4?area=budget';

function main(): HTMLElement {
  return screen.getByRole('main');
}

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

function section(name: string): HTMLElement {
  const found = within(main()).getByRole('heading', { name }).closest('section');
  if (found == null) throw new Error(`${name} is not drawn`);

  return found;
}

describe('Quotes and payment schedules on the Budget page (sc-87)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it(
    'lists the vendors quoted and everything due, soonest first, Overdue in words',
    SLOW,
    async () => {
      await open(BUDGET);

      const quoted = within(section('Vendors quoted')).getAllByRole('link');
      expect(quoted.map((one) => one.textContent?.split('Catering')[0])).toHaveLength(4);
      expect(quoted[1]?.textContent).toContain('€600.00 of the quote is not scheduled yet.');

      const due = within(section('Everything due')).getAllByRole('link');
      expect(due).toHaveLength(6);
      expect(due.filter((one) => one.textContent?.includes('Overdue'))).toHaveLength(2);
      expect(due[0]?.textContent).toContain('Éclat Catering');
    },
  );

  it('says each empty state in one line', SLOW, async () => {
    await open(`${BUDGET}&state=no_quotes`);
    expect(
      within(section('Vendors quoted')).getByText('No quotes on this event yet.'),
    ).toBeDefined();
    expect(
      within(section('Vendors quoted')).getByRole('button', { name: 'Add a quote' }),
    ).toBeDefined();
    expect(within(section('Everything due')).getByText('Nothing is due.')).toBeDefined();
    cleanup();

    await open(`${BUDGET}&vendor=v8`);
    expect(within(section('Schedule')).getByText('No payments scheduled yet.')).toBeDefined();
    expect(
      within(section('Schedule')).getByRole('button', { name: 'Add a payment' }),
    ).toBeDefined();
  });

  it('offers vendors by name with one already quoted that cannot be chosen', SLOW, async () => {
    await open(`${BUDGET}&state=vendor_typed`);
    const dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    const field = within(dialog).getByRole('combobox', { name: 'Vendor' });
    fireEvent.focus(field);

    const options = within(dialog).getAllByRole('option');
    expect(options.map((one) => one.textContent)).toEqual([
      'Bloom & CoFlowers · Ngozi EzeAlready quoted on this event',
      'Blue Gate TransportTransport · Musa Danjuma',
    ]);
    expect(options[0]?.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(options[0]!);
    expect((field as HTMLInputElement).value).toBe('bl');
    fireEvent.click(options[1]!);
    expect((field as HTMLInputElement).value).toBe('Blue Gate Transport');
  });

  it('tells an owner where to add a vendor, and a Lead whom to ask', SLOW, async () => {
    await open(`${BUDGET}&state=vendor_none`);
    let dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    expect(within(dialog).getByText('No vendor matches “eclat”.')).toBeDefined();
    expect(
      within(dialog).getByRole('link', { name: 'Add the vendor on the Vendors page first.' }),
    ).toBeDefined();
    cleanup();

    await open(`${BUDGET}&state=no_vendors&as=ana`);
    dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    expect(within(dialog).getByText('There are no vendors to choose from.')).toBeDefined();
    expect(within(dialog).getByText('Ask an owner or admin to add the vendor.')).toBeDefined();
    expect(within(dialog).queryByRole('link')).toBeNull();
  });

  it('adds a quote once a vendor is chosen and every field checks', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${BUDGET}&state=add`);
    const dialog = screen.getByRole('dialog', { name: 'Add a quote' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByText('Choose the vendor.')).toBeDefined();

    const field = within(dialog).getByRole('combobox', { name: 'Vendor' });
    fireEvent.change(field, { target: { value: 'harb' } });
    fireEvent.click(within(dialog).getByRole('option', { name: /Harbour Shuttle/ }));
    fireEvent.change(within(dialog).getByLabelText('What it covers'), {
      target: { value: 'Two shuttles, every 30 minutes.' },
    });
    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '1,450' } });
    fireEvent.change(within(dialog).getByLabelText('Date quoted'), {
      target: { value: '2026-11-02' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(section('Vendors quoted')).getAllByRole('link')).toHaveLength(5);
  });

  it(
    'shows Quoted, Scheduled and the difference, and the name plain for a Lead',
    SLOW,
    async () => {
      await open(`${BUDGET}&vendor=v11&as=ana`);
      const schedule = section('Schedule');
      expect(within(schedule).getByText('The schedule is €250.00 over the quote.')).toBeDefined();
      expect(within(schedule).getByText('€2,750.00')).toBeDefined();
      expect(
        within(main()).getByRole('heading', { name: 'Fola Strings', level: 1 }).querySelector('a'),
      ).toBeNull();
      cleanup();

      await open(`${BUDGET}&vendor=v11`);
      expect(
        within(main()).getByRole('heading', { name: 'Fola Strings', level: 1 }).querySelector('a'),
      ).not.toBeNull();
    },
  );

  it('refuses a revise with nothing changed and offers Correct instead', SLOW, async () => {
    await open(`${BUDGET}&vendor=v9&state=revise_unchanged`);
    const dialog = screen.getByRole('dialog', { name: 'Revise the quote' });
    expect(within(dialog).getAllByText(/^Change the amount or the date quoted/)).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Correct the quote instead' }));
    expect(screen.getByRole('dialog', { name: 'Correct the quote' })).toBeDefined();
  });

  it('reads only after a downgrade, with See plans only for billing.manage', SLOW, async () => {
    await open(`${BUDGET}&state=read_only`);
    expect(within(main()).getByText('Read-only')).toBeDefined();
    expect(
      within(main()).getByText(
        'Quotes and payment schedules are read-only because this organisation’s plan no longer includes them. Nothing has been removed.',
      ),
    ).toBeDefined();
    expect(within(main()).getByRole('button', { name: 'See plans' })).toBeDefined();
    expect(within(main()).queryByRole('button', { name: 'Add a quote' })).toBeNull();

    for (const as of ['julien', 'ana']) {
      cleanup();
      await open(`${BUDGET}&state=read_only&as=${as}`);
      expect(within(main()).getByText('Read-only')).toBeDefined();
      expect(within(main()).queryByRole('button', { name: 'See plans' })).toBeNull();
    }
  });

  it('links the vendor’s name to that vendor in the directory', SLOW, async () => {
    await open(`${BUDGET}&vendor=v11&as=julien`);
    const name = within(main()).getByRole('link', { name: 'Fola Strings' });
    expect(name.getAttribute('href')).toBe('/demo/vendors?vendor=v11&as=julien');
  });

  it(
    'stays closed after Cancel, and keeps its marks after Add, once the vendor field blurs',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BUDGET}&state=add`);
      let dialog = screen.getByRole('dialog', { name: 'Add a quote' });
      let field = within(dialog).getByRole('combobox', { name: 'Vendor' });

      fireEvent.focus(field);
      fireEvent.blur(field);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(within(main()).getByRole('button', { name: 'Add a quote' }));
      dialog = screen.getByRole('dialog', { name: 'Add a quote' });
      field = within(dialog).getByRole('combobox', { name: 'Vendor' });
      fireEvent.focus(field);
      fireEvent.blur(field);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(within(dialog).getByText('Choose the vendor.')).toBeDefined();
      expect(field.getAttribute('aria-invalid')).toBe('true');
    },
  );

  it('gives each payment added its own row, after one is removed', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${BUDGET}&vendor=v8`);
    const add = async (description: string, amount: string) => {
      fireEvent.click(within(main()).getByRole('button', { name: 'Add a payment' }));
      const dialog = screen.getByRole('dialog', { name: 'Add a payment' });
      fireEvent.change(within(dialog).getByLabelText('What the payment is for'), {
        target: { value: description },
      });
      fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: amount } });
      fireEvent.change(within(dialog).getByLabelText('Date due'), {
        target: { value: '2026-11-10' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    };
    const rows = () => within(section('Schedule')).queryAllByRole('listitem');
    const removeFirst = () => {
      fireEvent.click(within(rows()[0]!).getByRole('button', { name: 'Remove' }));
      fireEvent.click(within(rows()[0]!).getByRole('button', { name: 'Remove' }));
    };

    await add('First', '100');
    await add('Second', '200');
    removeFirst();
    await add('Third', '300');
    expect(rows().map((one) => one.textContent?.split('Due')[0])).toEqual(['Second', 'Third']);

    removeFirst();
    expect(rows().map((one) => one.textContent?.split('Due')[0])).toEqual(['Third']);
  });
});
