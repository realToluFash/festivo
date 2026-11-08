import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetBudget } from './quotes.ts';

const tested = config();
const SLOW = { timeout: 15000 };
const at = (state: string, more = '') => `/demo/events/evt-wed-4?area=budget&state=${state}${more}`;

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

const main = () => screen.getByRole('main');

function section(name: string): HTMLElement {
  const found = within(main()).getByRole('heading', { name }).closest('section');
  if (found == null) throw new Error(`${name} is not drawn`);

  return found;
}

async function settle(ms = 1000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('the states Budget A still lacked (sc-85, sc-88, sc-90, sc-91, sc-92, sc-94, sc-95, sc-96, sc-1300)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    forgetBudget();
  });

  it('refuses Add a cost’s long name and note, and the server’s staff-time 422', SLOW, async () => {
    await open(at('add_cost_long_name'));
    let dialog = await screen.findByRole('dialog', { name: 'Add a cost' }, SLOW);
    expect(within(dialog).getByText('Shorten what it is to 100 characters or fewer.')).toBeTruthy();
    expect(within(dialog).getByLabelText('What it is').getAttribute('aria-invalid')).toBe('true');
    cleanup();

    await open(at('add_cost_long_note'));
    dialog = await screen.findByRole('dialog', { name: 'Add a cost' }, SLOW);
    expect(within(dialog).getByText('Shorten the note to 500 characters or fewer.')).toBeTruthy();
    cleanup();

    await open(at('add_cost_refused'));
    dialog = await screen.findByRole('dialog', { name: 'Add a cost' }, SLOW);
    const group = within(dialog).getByRole('group', { name: 'How it is counted' });
    expect(within(group).getByRole('alert').textContent).toBe(
      'The budget already has a staff-time cost. Choose another way it is counted.',
    );
    expect(within(group).getByRole('radio', { name: /Per staff hour/ })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(dialog).queryByText(/fields? needs? fixing/)).toBeNull();
  });

  it(
    'says a ceiling set, changed or cleared elsewhere, and the 422 on its field',
    SLOW,
    async () => {
      await open(at('ceiling_live_set'));
      expect(
        screen.getByText('Julien Moreau set a ceiling of £22,000 for the whole event.'),
      ).toBeTruthy();
      cleanup();

      await open(at('ceiling_live_changed'));
      expect(section('Ceiling').textContent).toContain('Close');
      cleanup();

      await open(at('ceiling_live_cleared'));
      expect(screen.getByText('Julien Moreau cleared the ceilings.')).toBeTruthy();
      expect(
        within(section('Ceiling')).getByRole('button', { name: 'Set a ceiling' }),
      ).toBeTruthy();
      cleanup();

      await open(at('ceiling_categories_only'));
      expect(section('Ceiling').textContent).toContain('Catering · £13,000.00');
      expect(section('Ceiling').textContent).not.toContain('Whole event');
      cleanup();

      await open(at('ceiling_refused'));
      const dialog = await screen.findByRole('dialog', {}, SLOW);
      expect(within(dialog).getByRole('alert').textContent).toBe(
        'Flowers was removed, so its ceiling wasn’t saved.',
      );
      expect(within(dialog).queryByLabelText('Flowers')).toBeNull();
      expect(within(dialog).getByLabelText('Catering')).toHaveProperty('value', '13,000.00');
      expect(within(section('Costs')).queryByText('Bridal flowers')).toBeNull();
      cleanup();

      await open(at('ceiling_decimals'));
      const fieldLevel = await screen.findByRole('dialog', {}, SLOW);
      expect(within(fieldLevel).getByLabelText('Transport').getAttribute('aria-invalid')).toBe(
        'true',
      );
      cleanup();

      await open(at('ceiling_no_costs'));
      expect(section('Ceiling').textContent).toContain('Nothing is costed here yet.');
    },
  );

  it('warns when a rate takes Catering over, never on the way down', SLOW, async () => {
    await open(at('rate_warning_category'));
    expect(screen.getByText('£76 takes Catering over its ceiling.')).toBeTruthy();
    cleanup();

    await open(at('rate_down_while_over'));
    expect(screen.getByLabelText('Rate for Dinner')).toHaveProperty('value', '66');
    expect(screen.queryByText(/over its ceiling\./)).toBeNull();
  });

  it('adds Catering’s line to the decision’s answer', SLOW, async () => {
    await open(at('decide_category'));
    expect(
      await screen.findByText('This would take Catering over its ceiling.', {}, SLOW),
    ).toBeTruthy();
    expect(
      screen.getByText('If everyone comes, it would be £12,240 against £12,000.'),
    ).toBeTruthy();
    expect(screen.queryByText('This would take the event over its ceiling.')).toBeNull();
  });

  it(
    'shows a fee at £0 with no margin figure, and refuses a markup that is not a number',
    SLOW,
    async () => {
      await open(at('margin_zero_price'));
      expect(section('Costs').textContent).toContain('Charged at £0.00 · its own priceNo figure');
      cleanup();

      await open(at('markup_nan'));
      const dialog = await screen.findByRole('dialog', { name: 'Markup' }, SLOW);
      expect(within(dialog).getByText('Enter the markup as a number, like 12.5.')).toBeTruthy();
      cleanup();

      await open(at('margin_live'));
      expect(
        screen.getByText(
          'Julien Moreau changed Photography’s markup to 25%, so the margin went up by £240.',
        ),
      ).toBeTruthy();
    },
  );

  it(
    'refuses Mark paid by the server and at the date, and words added and deleted payments',
    SLOW,
    async () => {
      await open(at('mark_currency', '&vendor=v3'));
      let dialog = screen.getByRole('dialog', { name: 'Mark paid' });
      expect(within(dialog).getByRole('alert').textContent).toBe(
        'Enter the amount in British Pound, the currency this event uses.',
      );
      cleanup();

      await open(at('mark_plan', '&vendor=v3'));
      dialog = screen.getByRole('dialog', { name: 'Mark paid' });
      expect(within(dialog).getByRole('alert').textContent).toBe(
        'Payments cannot be marked paid on this organisation’s plan, so nothing has changed.',
      );
      cleanup();

      await open(at('mark_future', '&vendor=v3'));
      dialog = screen.getByRole('dialog', { name: 'Mark paid' });
      expect(
        within(dialog).getByText(
          'The date paid cannot be in the future. Choose today or an earlier date.',
        ),
      ).toBeTruthy();
      cleanup();

      await open(at('added', '&vendor=v3'));
      const schedule = section('Schedule');
      expect(schedule.textContent).toContain(
        'Paid Monday, November 2. Added by you as already paid, so Undo deletes it.',
      );
      expect(schedule.textContent).toContain(
        'Paid Saturday, October 31. Added by Julien Moreau as already paid, so Undo deletes it.',
      );
      expect(within(schedule).getAllByRole('button', { name: 'Undo' })).toHaveLength(2);
      cleanup();

      await open(at('added_deleted', '&vendor=v3'));
      expect(
        within(section('Schedule')).getByText(
          'Deleted the payment of £120.00 to Bloom & Co on Monday, November 2: Buttonholes.',
        ),
      ).toBeTruthy();
      cleanup();

      await open(at('payments_read_only', '&vendor=v3&plan=downgraded'));
      expect(section('Schedule').textContent).toContain('Due Fri, Oct 30 · No longer chased.');
      expect(within(section('Schedule')).queryByRole('button', { name: 'Mark paid' })).toBeNull();
    },
  );

  it('turns reminders off after a downgrade, and says what stops them', SLOW, async () => {
    await open('/demo/settings/payment-reminders?state=reminders_plan_lost&plan=downgraded');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Payment reminders are off');
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(
      screen.getByText('Marking a payment paid or cancelling it stops its reminders.'),
    ).toBeTruthy();
  });

  it(
    'draws Who is paying loading, with neither, stale, live and its two choose refusals',
    SLOW,
    async () => {
      await open(at('payers_loading'));
      expect(screen.getByText('Loading who is paying…')).toBeTruthy();
      cleanup();

      await open(at('payers_neither'));
      const said = within(main())
        .getAllByText(/yet\./)
        .map((one) => one.textContent);
      expect(said[0]).toBe('No costs yet. Costs are added on the Budget page.');
      expect(said[1]).toContain('No payers yet.');
      cleanup();

      await open(at('payers_stale'));
      expect(within(main()).getByRole('alert').textContent).toBe(
        'Uncle Kayode was removed by someone else while this was open, so nothing was saved. The costs are shown as they are now.',
      );
      cleanup();

      await open(at('payers_live'));
      const live =
        'Julien Moreau changed who pays for Room hire, so Mr and Mrs Obi’s share went down by £3,150.00.';
      expect(screen.getByText(live)).toBeTruthy();
      fireEvent.click(
        within(screen.getByRole('region', { name: 'Has a payer' })).getByRole('button', {
          name: 'Choose who pays',
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Leave with no payer' }));
      expect(screen.queryByText(live)).toBeNull();
      expect(document.querySelector('.is-washed')).toBeNull();
      cleanup();

      await open(at('choose_no_payer'));
      expect(screen.getByText('Choose a payer.')).toBeTruthy();
      expect(screen.getByLabelText('Payer').getAttribute('aria-invalid')).toBe('true');
      cleanup();

      await open(at('choose_no_rest'));
      expect(screen.getByText('Choose who covers what is left.')).toBeTruthy();
    },
  );

  it(
    'refuses a payer’s note over 200 and a percentage with three decimal places',
    SLOW,
    async () => {
      await open(at('note_too_long'));
      const dialog = await screen.findByRole('dialog', { name: 'Add a payer' }, SLOW);
      expect(within(dialog).getByText('Use 200 characters or fewer.')).toBeTruthy();
      cleanup();

      await open(at('choose_percent'));
      fireEvent.change(screen.getByLabelText('Mr and Mrs Obi · %'), {
        target: { value: '33.333' },
      });
      fireEvent.change(screen.getByLabelText('Mr and Mrs Bakare · %'), {
        target: { value: '66.67' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(
        screen.getByText('Use a number from 0 to 100, with up to two decimal places.'),
      ).toBeTruthy();
    },
  );

  it(
    'sends with a passphrase, after every link was revoked, and through the browser’s sheet',
    SLOW,
    async () => {
      await open(at('link_passphrase'));
      expect(
        screen.getByText('Opened 3 times. Last on Monday, Nov 2 at 21:14. Asks for a passphrase.'),
      ).toBeTruthy();
      cleanup();

      await open(at('link_all_revoked'));
      const pane = screen.getByRole('region', { name: 'Mr and Mrs Bakare' });
      expect(within(pane).getByRole('button', { name: 'Send to Mr and Mrs Bakare' })).toBeTruthy();
      expect(pane.textContent).not.toContain('Sent, not opened yet.');
      cleanup();

      await open(at('web_share'));
      const sheet = screen.getByRole('dialog', { name: 'The browser’s share sheet' });
      expect(within(sheet).getByText(/kept up to date\.$/)).toBeTruthy();
      fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog', { name: 'The browser’s share sheet' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /^Aunt Funmi/ }));
      const funmi = screen.getByRole('region', { name: 'Aunt Funmi' });
      expect(funmi.textContent).toContain('Not sent yet.');
      fireEvent.click(within(funmi).getByRole('button', { name: 'Send to Aunt Funmi' }));
      expect(
        await screen.findByRole('dialog', { name: 'The browser’s share sheet' }, SLOW),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog', { name: 'The browser’s share sheet' })).toBeNull();
      expect(screen.getByRole('region', { name: 'Aunt Funmi' }).textContent).toContain(
        'Sent, not opened yet.',
      );
      expect(screen.getByRole('button', { name: 'Send again to Aunt Funmi' })).toBeTruthy();
    },
  );

  it(
    'refuses a payer’s share with no payer, and says the 429 with no time to wait for',
    SLOW,
    async () => {
      await open(at('no_payer'));
      expect(screen.getByText('Choose a payer.')).toBeTruthy();
      cleanup();

      await open('/demo/share/whole?state=too_many_soon');
      expect(
        screen.getByText(
          'Too many wrong passphrases have been tried on this link. Wait a moment, then try again.',
        ),
      ).toBeTruthy();
    },
  );

  it(
    'loads Calibration, fails and tries again, and lists sources for an event with no type',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(at('calibration_loading'));
      expect(screen.getByText('Loading what earlier events cost…')).toBeTruthy();
      cleanup();

      await open(at('calibration_failed'));
      expect(
        screen.getByText('Calibration did not load. Check your connection and try again.'),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await settle();
      expect(screen.getByText('In pounds')).toBeTruthy();
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Calibration' }),
      );
      cleanup();

      await open(at('start_no_type'));
      expect(
        screen.getByText(
          'This event has no type, so every earlier budget is listed, most recent first.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Weddings')).toBeNull();
      expect(screen.getByText('Templates')).toBeTruthy();
      cleanup();

      await open(at('start_margin'));
      expect(screen.getByText('Per head · Charged at £76.80 a head · 20% markup')).toBeTruthy();
      expect(screen.getByText('Per day · At cost, chosen')).toBeTruthy();
    },
  );

  it(
    'gives each of Add a cost’s board frames an address: the three rate refusals, Adding and Added',
    SLOW,
    async () => {
      for (const [state, words] of [
        ['add_cost_negative', 'Enter a rate of 0 or more, in numbers only.'],
        ['add_cost_nan', 'Enter a rate of 0 or more, in numbers only.'],
        [
          'add_cost_decimals',
          'That has too many decimal places for this event’s currency. Enter the rate like 12.50.',
        ],
      ] as const) {
        await open(at(state));
        const dialog = await screen.findByRole('dialog', { name: 'Add a cost' }, SLOW);
        expect(within(dialog).getByText(words)).toBeTruthy();
        expect(within(dialog).getByLabelText('Rate').getAttribute('aria-invalid')).toBe('true');
        cleanup();
      }

      await open(at('add_cost_adding'));
      const adding = await screen.findByRole('dialog', { name: 'Add a cost' }, SLOW);
      const verb = within(adding).getByRole('button', { name: 'Adding…' });
      fireEvent.click(verb);
      expect(screen.getByRole('dialog', { name: 'Add a cost' })).toBeTruthy();
      cleanup();

      await open(at('add_cost_added'));
      expect(screen.queryByRole('dialog', { name: 'Add a cost' })).toBeNull();
      const row = within(section('Costs')).getByRole('button', { name: /^Welcome drinks/ });
      expect(row.className).toContain('is-on');
      expect(within(section('Costs')).getByText('Saved.')).toBeTruthy();
      expect(document.querySelector('.bud-figure.is-washed')).not.toBeNull();
      await vi.waitFor(() => expect(document.activeElement).toBe(row), SLOW);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const before = document.querySelector('.bud-figure');
      fireEvent.click(within(main()).getByRole('button', { name: 'Add a cost' }));
      const again = await screen.findByRole('dialog', { name: 'Add a cost' }, SLOW);
      fireEvent.change(within(again).getByLabelText('What it is'), {
        target: { value: 'Canapés' },
      });
      fireEvent.click(within(again).getByRole('button', { name: 'Add' }));
      await settle();
      const after = document.querySelector('.bud-figure');
      expect(after).not.toBe(before);
      expect(after?.className).toContain('is-washed');
    },
  );

  it(
    'gives each of Who is paying’s board frames an address: names, Edit, renamed, the choose refusals',
    SLOW,
    async () => {
      await open(at('payer_blank'));
      let dialog = await screen.findByRole('dialog', { name: 'Add a payer' }, SLOW);
      expect(within(dialog).getByText('Enter a name.')).toBeTruthy();
      expect(within(dialog).getByText('One field needs fixing, so nothing was sent.')).toBeTruthy();
      cleanup();

      await open(at('payer_long_name'));
      dialog = await screen.findByRole('dialog', { name: 'Add a payer' }, SLOW);
      expect(within(dialog).getByText('Use 60 characters or fewer.')).toBeTruthy();
      cleanup();

      await open(at('payer_edit'));
      dialog = await screen.findByRole('dialog', { name: 'Edit payer' }, SLOW);
      expect(within(dialog).getByLabelText('Name')).toHaveProperty('value', 'Chidi and Ngozi Obi');
      cleanup();

      await open(at('payer_renamed'));
      expect(screen.getByRole('region', { name: 'Chidi and Ngozi Obi' })).toBeTruthy();
      expect(within(main()).queryByText('Mr and Mrs Obi')).toBeNull();
      cleanup();

      await open(at('choose_percent_range'));
      expect(screen.getAllByText('Use a number from 0 to 100.')).toHaveLength(2);
      const minus = screen.getByLabelText('Mr and Mrs Obi · %');
      expect(minus).toHaveProperty('value', '−5');
      fireEvent.change(minus, { target: { value: '−' } });
      expect(minus).toHaveProperty('value', '−');
      fireEvent.change(minus, { target: { value: '' } });
      expect(minus).toHaveProperty('value', '');
      cleanup();

      await open(at('choose_percent_decimals'));
      const obi = screen.getByLabelText('Mr and Mrs Obi · %');
      expect(obi.getAttribute('aria-invalid')).toBe('true');
      expect(
        screen.getByText('Use a number from 0 to 100, with up to two decimal places.'),
      ).toBeTruthy();
      expect(obi.closest('.desk-field')?.querySelector('.desk-help')).toBeNull();
      expect(screen.getByText('Total 66.67%')).toBeTruthy();
      cleanup();

      for (const state of ['choose_fixed_blank', 'choose_fixed_decimals']) {
        await open(at(state));
        expect(screen.getByText('Enter an amount in pounds, like 400 or 400.50.')).toBeTruthy();
        cleanup();
      }

      await open(at('choose_fixed_over'));
      expect(
        screen.getByText(
          'The fixed amounts come to £6,800.00, more than £6,528.00, the least this can cost. Lower them so they fit.',
        ),
      ).toBeTruthy();
    },
  );
});
