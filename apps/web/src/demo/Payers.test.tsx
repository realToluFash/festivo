import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 8000 };

async function open(state: string, extra = '') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4?area=budget&state=${state}${extra}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

const main = () => screen.getByRole('main');
const pane = (name: string) => screen.getByRole('region', { name });
const row = (name: string) => within(main()).getByRole('button', { name: new RegExp(`^${name}`) });
const rowNames = () =>
  within(main())
    .getAllByRole('button', { expanded: false })
    .concat(within(main()).getAllByRole('button', { expanded: true }))
    .map((one) => one.textContent ?? '');

function type(label: string, value: string, where: HTMLElement = document.body) {
  fireEvent.change(within(where).getByLabelText(label), { target: { value } });
}

describe('Who is paying at a desk (sc-91, sc-1300)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.useRealTimers();
  });

  it('leads with the card, a row per payer, and Mr and Mrs Obi in the pane', SLOW, async () => {
    await open('payers');

    expect(screen.getByRole('heading', { level: 1, name: 'Who is paying' })).toBeDefined();
    const card = screen.getByRole('region', { name: 'Has a payer' });
    expect(card.textContent).toContain('4 payers');
    expect(card.textContent).toContain('£18,830 to £22,160');
    expect(card.textContent).toContain(
      'Has a payer, out of £19,730 to £23,060. £900 across 4 costs has no payer yet.',
    );
    expect(card.textContent).toContain('Next: DJ has no payer yet.');
    expect(row('Mr and Mrs Obi').getAttribute('aria-expanded')).toBe('true');
    expect(row('Adaeze and Tunde').textContent).toContain('The couple · Not sent yet.£3,250.00');

    const obi = pane('Mr and Mrs Obi');
    expect(obi.textContent).toContain('Their share');
    expect(obi.textContent).toContain('£10,620.00 to £12,285.00');
    expect(obi.textContent).toContain('Paid£3,150.00');
    expect(obi.textContent).toContain('Still to come£7,470.00 to £9,135.00');
    expect(obi.textContent).toContain('Room hireall of it£6,300.00');
    expect(obi.textContent).toContain('Opened 3 times. Last on Monday, Nov 2 at 21:14.');
    expect(
      within(obi).getByRole('button', { name: 'Send again to Mr and Mrs Obi' }).textContent,
    ).toBe('Send again');

    fireEvent.click(row('Adaeze and Tunde'));

    const couple = pane('Adaeze and Tunde');
    expect(couple.textContent).toContain('Replies do not change this.');
    expect(within(couple).getByRole('button', { name: 'Send to Adaeze and Tunde' })).toBeDefined();
  });

  it('opens the payer the address names', SLOW, async () => {
    await open('payers', '&payer=funmi');

    expect(pane('Aunt Funmi').textContent).toContain('Cars');
    expect(pane('Aunt Funmi').textContent).toContain('Still to come£640.00');
    expect(row('Aunt Funmi').getAttribute('aria-expanded')).toBe('true');
  });

  it('adds a payer, refusing the same name at the field', SLOW, async () => {
    await open('payers');

    fireEvent.click(within(main()).getByRole('button', { name: 'Add a payer' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a payer' });
    type('Name', '  aunt FUNMI ', dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    const name = within(dialog).getByLabelText('Name');
    expect(
      within(dialog).getByText('Another payer on this event is already called Aunt Funmi.'),
    ).toBeDefined();
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(name);

    type('Name', 'Uncle Kayode', dialog);
    type('Note · Optional', 'Covering the band', dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: 'Has a payer' }).textContent).toContain('5 payers');
    const kayode = pane('Uncle Kayode');
    expect(kayode.textContent).toContain('Covering the band');
    expect(kayode.textContent).toContain('Nothing still to come');

    fireEvent.click(within(kayode).getByRole('button', { name: 'Remove' }));

    expect(within(main()).getByText('Uncle Kayode removed.')).toBeDefined();
    expect(rowNames().some((one) => one.startsWith('Uncle Kayode'))).toBe(false);

    fireEvent.click(within(main()).getByRole('button', { name: 'Undo' }));

    expect(within(main()).queryByText('Uncle Kayode removed.')).toBeNull();
    expect(row('Uncle Kayode')).toBeDefined();
  });

  it('opens a payer to edit with their name and note', SLOW, async () => {
    await open('payers', '&payer=funmi');

    fireEvent.click(within(pane('Aunt Funmi')).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit payer' });
    type('Name', 'Mr and Mrs Obi', dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      within(dialog).getByText('Another payer on this event is already called Mr and Mrs Obi.'),
    ).toBeDefined();

    type('Name', 'Auntie Funmi', dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(pane('Auntie Funmi')).toBeDefined();
    expect(row('Auntie Funmi')).toBeDefined();
  });

  it('says the cap at 20 payers and opens nothing', SLOW, async () => {
    await open('payer_cap');

    expect(screen.getByRole('alert').textContent).toBe('An event can have up to 20 payers.');
    fireEvent.click(within(main()).getByRole('button', { name: 'Add a payer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('An event can have up to 20 payers.');
  });

  it('refuses to remove a payer who covers costs, and opens those costs ticked', SLOW, async () => {
    await open('remove_refused');

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(
      'Mr and Mrs Obi covers 3 costs. Choose who pays for them first.',
    );
    fireEvent.click(
      within(alert.parentElement ?? main()).getByRole('button', { name: 'Choose who pays' }),
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Choose who pays' })).toBeDefined();
    const ticked = screen
      .getAllByRole('checkbox')
      .filter((one) => (one as HTMLInputElement).checked)
      .map((one) => one.closest('label')?.textContent ?? '');
    expect(ticked.map((one) => one.split('£')[0])).toEqual([
      'Dinner',
      'Drinks package',
      'Room hire',
    ]);
    expect(main().textContent).toContain(
      '3 of these costs already have a payer. Saving replaces their split.',
    );
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('chooses one payer for the DJ, and the card moves on', SLOW, async () => {
    await open('choose_one');

    expect(screen.getByRole('group', { name: 'Who pays' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect((screen.getByLabelText('Payer') as HTMLSelectElement).value).toBe('couple');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Who is paying' })).toBeDefined();
    const card = screen.getByRole('region', { name: 'Has a payer' });
    expect(card.textContent).toContain('£19,730 to £23,060');
    expect(card.textContent).toContain('Next: Centrepieces has no payer yet.');
    expect(row('Adaeze and Tunde').textContent).toContain('£4,150.00');
  });

  it('selects every cost with no payer, and leaves them with none', SLOW, async () => {
    await open('choose_one');

    fireEvent.click(screen.getByRole('button', { name: 'Select every cost with no payer' }));
    const ticked = screen
      .getAllByRole('checkbox')
      .filter((one) => (one as HTMLInputElement).checked)
      .map((one) => one.closest('label')?.querySelector('.desk-row-name')?.textContent);
    expect(ticked).toEqual(['Centrepieces', 'Aisle arch', 'DJ', 'Guest shuttle']);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it(
    'refuses percentages that do not come to 100.00, and takes them when they do',
    SLOW,
    async () => {
      await open('choose_percent_bad');

      expect(main().textContent).toContain('Total 90.00%');
      expect(main().textContent).toContain(
        'The percentages come to 90.00. Make them add up to exactly 100.',
      );
      expect(main().textContent).toContain('£2,611.20 to £3,617.60');
      expect(document.activeElement).toBe(screen.getByLabelText('Adaeze and Tunde · %'));

      type('Mr and Mrs Bakare · %', '50x');
      expect((screen.getByLabelText('Mr and Mrs Bakare · %') as HTMLInputElement).value).toBe('40');
      type('Mr and Mrs Bakare · %', '50');
      expect(main().textContent).toContain('Total 100.00%');
      expect(main().textContent).not.toContain('The percentages come to');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('heading', { level: 1, name: 'Who is paying' })).toBeDefined();
    },
  );

  it('refuses fixed amounts over the cost, and gives the rest to who covers it', SLOW, async () => {
    await open('choose_fixed');

    expect(main().textContent).toContain('£240.00 now');
    type('Aunt Funmi · amount', '700');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText(
        'The fixed amounts come to £700.00, more than £640.00, the least this can cost. Lower them so they fit.',
      ),
    ).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Aunt Funmi · amount'));

    type('Aunt Funmi · amount', '400.00');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    fireEvent.click(row('Aunt Funmi'));
    expect(pane('Aunt Funmi').textContent).toContain('£400.00, a fixed amount');
    fireEvent.click(row('Mr and Mrs Obi'));
    expect(pane('Mr and Mrs Obi').textContent).toContain('what is left after Aunt Funmi’s £400.00');
  });

  it('flags the split on Cars and changes the amounts from it', SLOW, async () => {
    await open('split_flag');

    expect(main().textContent).toContain(
      'The split on Cars no longer adds up. Nothing was changed.',
    );
    expect(main().textContent).toContain(
      'Cars now costs £350.00, less than the £400.00 fixed for Aunt Funmi. Aunt Funmi keeps £400.00 and Mr and Mrs Obi have £0.00 until the amounts change.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Change the amounts' }));

    expect(
      screen.getByRole('radio', { name: 'Fixed amounts, and one payer covers the rest' }),
    ).toHaveProperty('checked', true);
    expect(
      screen.getByText(
        'The fixed amounts come to £400.00, more than £350.00, the least this can cost. Lower them so they fit.',
      ),
    ).toBeDefined();
    type('Aunt Funmi · amount', '300.00');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(main().textContent).not.toContain('no longer adds up');
  });

  it('sends a link the first time, busy once, then copied', SLOW, async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open('send_failed');

    const couple = pane('Adaeze and Tunde');
    expect(within(couple).getByRole('alert').textContent).toBe(
      'The link was not created, so nothing has been sent. Try again.',
    );
    const send = within(couple).getByRole('button', { name: 'Send to Adaeze and Tunde' });
    fireEvent.click(send);

    expect(send.textContent).toBe('Sending…');
    expect(send.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(send);

    expect(
      await within(couple).findByText('Link copied. Paste it into a chat.', {}, SLOW),
    ).toBeDefined();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]).toEqual([`${window.location.origin}/demo/share/payer`]);
    expect(couple.textContent).toContain('Sent, not opened yet.');
    expect(
      within(couple).getByRole('button', { name: 'Send again to Adaeze and Tunde' }),
    ).toBeDefined();
    expect(row('Adaeze and Tunde').textContent).toContain('Sent, not opened yet.');
  });

  it('selects the link when the browser refuses the copy', SLOW, async () => {
    await open('payers');

    fireEvent.click(
      within(pane('Mr and Mrs Obi')).getByRole('button', { name: 'Send again to Mr and Mrs Obi' }),
    );

    const field = await screen.findByRole('textbox', { name: 'The link' }, SLOW);
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('readonly')).not.toBeNull();
    expect(pane('Mr and Mrs Obi').textContent).toContain(
      'Could not copy here. The link is selected: press Ctrl+C or Command+C.',
    );
  });

  it('draws each sending state the board gives', SLOW, async () => {
    await open('send_busy');
    const busy = within(pane('Adaeze and Tunde')).getByRole('button', { name: 'Sending…' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    cleanup();

    await open('link_copied');
    expect(within(pane('Adaeze and Tunde')).getByRole('status').textContent).toBe(
      'Link copied. Paste it into a chat.',
    );
    cleanup();

    await open('copy_refused');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'The link' }));
    expect(
      within(pane('Adaeze and Tunde')).getByRole('button', {
        name: 'Send again to Adaeze and Tunde',
      }),
    ).toBeDefined();
  });

  it(
    'says what payers are for with none, and where costs are added with no costs',
    SLOW,
    async () => {
      await open('no_payers');
      expect(main().textContent).toContain(
        'No payers yet. Payers are who covers each cost: the couple, both sets of parents, an aunt covering the cars.',
      );
      expect(within(main()).queryByRole('button', { name: 'Choose who pays' })).toBeNull();
      expect(within(main()).getAllByRole('button', { name: 'Add a payer' })).toHaveLength(2);
      cleanup();

      await open('no_costs');
      expect(main().textContent).toContain('No costs yet. Costs are added on the Budget page.');
      expect(
        within(main()).getAllByRole('link', { name: 'Budget' }).at(-1)?.getAttribute('href'),
      ).toBe('/demo/events/evt-wed-4?area=budget');
    },
  );
});
