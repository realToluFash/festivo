import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { MW } from './menuServed.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/menu';

async function menu(state?: string) {
  cleanup();
  const router = createMemoryRouter(routes, {
    initialEntries: [state == null ? AT : `${AT}?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: MW.title }, WAIT);
}

function panel(): HTMLElement {
  return screen.getByRole('complementary');
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Items on every course’s dishes (sc-34230)', () => {
  it('opens Edit dish with its items, and no How it’s served anywhere', SLOW, async () => {
    await menu();

    expect(within(panel()).getByRole('group', { name: /^Items/u })).toBeTruthy();
    expect(within(panel()).getByLabelText('Item 1')).toHaveProperty('value', 'Rice');
    expect(screen.queryByText(/How it’s served|Plated|In parts|Family style|Buffet/u)).toBeNull();
    expect(screen.getByText('Ice cream')).toBeTruthy();
  });

  it('shows nothing new on a dish with no items', SLOW, async () => {
    await menu('noItems');

    expect(within(panel()).queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByText(/one plate/u)).toBeNull();
  });

  it('shows Served with this course on Edit course', SLOW, async () => {
    await menu('course');

    expect(within(panel()).getByRole('group', { name: /Served with this course/u })).toBeTruthy();
    expect(within(panel()).getByLabelText('Course item 1')).toHaveProperty('value', 'Bread roll');
  });

  it('moves an item and announces it, the ends greyed', SLOW, async () => {
    await menu();

    fireEvent.click(within(panel()).getByRole('button', { name: 'Move Chicken up' }));
    expect(within(panel()).getByRole('status').textContent).toBe('Chicken moved to item 1 of 3');
    expect(
      within(panel())
        .getByRole('button', { name: 'Move Chicken up' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      within(panel())
        .getByRole('button', { name: 'Move And a side? down' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('offers only the choices not yet items, by question', SLOW, async () => {
    await menu('choiceDraft');

    const offer = within(panel()).getByRole('group', { name: MW.addFrom });
    expect(
      within(offer)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual([`And a sauce?${MW.choiceTag}`]);
    expect(within(panel()).getByText('Choice 3, no question yet')).toBeTruthy();
  });

  it('offers the variant by its names, and adds it as one item', SLOW, async () => {
    await menu('variants');

    const offer = within(panel()).getByRole('group', { name: MW.addFrom });
    fireEvent.click(within(offer).getByRole('button', { name: /Croaker or Tilapia/u }));
    expect(document.activeElement).toBe(
      within(panel()).getByRole('button', { name: 'Move Croaker or Tilapia up' }),
    );
    expect(within(panel()).queryByRole('group', { name: MW.addFrom })).toBeNull();
    expect(within(panel()).getByText(`${MW.itemsHelp} ${MW.itemsVariants}`)).toBeTruthy();
  });

  it('refuses a 7th item beside Add an item', SLOW, async () => {
    await menu('tooMany');

    expect(within(panel()).getByText(MW.tooMany)).toBeTruthy();
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(6);
  });

  it('refuses a single item on Save, saving nothing', SLOW, async () => {
    await menu('onlyOne');

    expect(within(panel()).getByText(MW.onlyOne)).toBeTruthy();
    expect(screen.getByRole('complementary')).toBeTruthy();
  });

  it('refuses a blank item beside it and clears once named', SLOW, async () => {
    await menu('blankName');

    const field = within(panel()).getByLabelText('Item 3');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Coleslaw' } });
    expect(within(panel()).queryByText(MW.blank)).toBeNull();
  });

  it('saves items and shows them on the dish row', SLOW, async () => {
    await menu('noItems');

    fireEvent.click(within(panel()).getByRole('button', { name: MW.addItem }));
    fireEvent.change(within(panel()).getByLabelText('Item 1'), { target: { value: 'Yam' } });
    fireEvent.click(within(panel()).getByRole('button', { name: MW.addItem }));
    fireEvent.change(within(panel()).getByLabelText('Item 2'), { target: { value: 'Egusi' } });
    fireEvent.click(within(panel()).getByRole('button', { name: MW.save }));

    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText('Pounded yam and egusi saved.')).toBeTruthy();
    expect(screen.getByText('Egusi')).toBeTruthy();
  });

  it('refuses a save without menu.manage, keeping the panel', SLOW, async () => {
    await menu('forbidden');

    fireEvent.click(within(panel()).getByRole('button', { name: MW.save }));
    expect(within(panel()).getByRole('alert').textContent).toContain(MW.forbidden);
  });

  it('clears the refusal on a remove, and keeps focus on the next Remove', SLOW, async () => {
    await menu('tooMany');

    const removes = within(panel()).getAllByRole('button', { name: /^Remove / });
    fireEvent.click(removes[0] as HTMLElement);
    expect(within(panel()).queryByText(MW.tooMany)).toBeNull();
    expect(document.activeElement).toBe(
      within(panel()).getAllByRole('button', { name: /^Remove / })[0],
    );
  });

  it('lands on Add an item after removing the last item', SLOW, async () => {
    await menu();

    const removes = within(panel()).getAllByRole('button', { name: /^Remove / });
    fireEvent.click(removes.at(-1) as HTMLElement);
    expect(document.activeElement).toBe(within(panel()).getByRole('button', { name: MW.addItem }));
  });

  it('clears a course’s refusal on a remove, and keeps focus in the list', SLOW, async () => {
    await menu('ownTooMany');

    expect(within(panel()).getByText(MW.ownTooMany)).toBeTruthy();
    const removes = within(panel()).getAllByRole('button', { name: /^Remove / });
    fireEvent.click(removes.at(-1) as HTMLElement);
    expect(within(panel()).queryByText(MW.ownTooMany)).toBeNull();
    expect(document.activeElement).toBe(within(panel()).getByRole('button', { name: MW.addOwn }));
  });
});

describe('removing a choice or the variants, and read only', () => {
  it('adds that the choice is an item, and takes the item with it', SLOW, async () => {
    await menu('removeChoice');

    expect(
      screen.getByText(
        'Remove “And a side?” from Jollof rice? “And a side?” is also one of Jollof rice’s items.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: MW.removeChoice }));
    expect(screen.queryByText('And a side?')).toBeNull();
  });

  it(
    'takes the item out of an open Edit dish too, and names a choice with no question',
    SLOW,
    async () => {
      await menu('choiceDraft');

      fireEvent.click(screen.getByRole('button', { name: 'Remove “And a side?”…' }));
      fireEvent.click(screen.getByRole('button', { name: MW.removeChoice }));
      expect(within(panel()).queryByText('And a side?')).toBeNull();
      expect(within(panel()).getAllByRole('listitem')).toHaveLength(2);

      fireEvent.click(screen.getByRole('button', { name: 'Remove “Choice 2, no question yet”…' }));
      fireEvent.click(screen.getByRole('button', { name: MW.removeChoice }));
      expect(screen.getByText('The choice removed from Jollof rice.')).toBeTruthy();
      expect(within(panel()).queryAllByRole('listitem')).toHaveLength(0);
    },
  );

  it('asks to make a dish single with the variants’ line, and takes the item', SLOW, async () => {
    await menu('variantItem');

    fireEvent.click(screen.getByRole('button', { name: 'Remove the variant Tilapia…' }));
    expect(
      screen.getByText(
        'Make this a single dish? The variants are also one of Grilled fish’s items.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: MW.makeSingle }));
    expect(screen.getByText('Grilled fish is now a single dish.')).toBeTruthy();
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Croaker or Tilapia')).toBeNull();
  });

  it('keeps the variants, and focus on the Remove pressed', SLOW, async () => {
    await menu('fold');

    fireEvent.click(screen.getByRole('button', { name: MW.keepVariants }));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Remove the variant Tilapia…' }),
    );
  });

  it('shows everything as text without menu.manage', SLOW, async () => {
    await menu('readOnly');

    expect(screen.getByText(MW.lock)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit|Remove/u })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Croaker or Tilapia')).toBeTruthy();
  });
});
