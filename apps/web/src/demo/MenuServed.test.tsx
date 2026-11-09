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

describe('How it’s served on the Menu (sc-34230)', () => {
  it('opens Plated, with its line, and no parts on the dish rows', SLOW, async () => {
    await menu();

    expect(within(panel()).getByRole('radio', { name: 'Plated' })).toHaveProperty('checked', true);
    expect(within(panel()).getByText(MW.served.plated)).toBeTruthy();
    expect(screen.queryByText(MW.onePlate)).toBeNull();
  });

  it('says when a guest counts as served for each way', SLOW, async () => {
    await menu();

    for (const way of ['in_parts', 'family_style', 'buffet'] as const) {
      fireEvent.click(within(panel()).getByRole('radio', { name: MW.ways[way] }));
      expect(within(panel()).getByText(MW.served[way])).toBeTruthy();
    }
  });

  it(
    'shows Served with this course on In parts, and Plated at on Family style and Buffet',
    SLOW,
    async () => {
      await menu('inParts');

      expect(within(panel()).getByRole('group', { name: /Served with this course/u })).toBeTruthy();
      expect(within(panel()).queryByRole('group', { name: /Plated at/u })).toBeNull();

      fireEvent.click(within(panel()).getByRole('radio', { name: 'Buffet' }));
      expect(within(panel()).queryByRole('group', { name: /Served with this course/u })).toBeNull();
      expect(within(panel()).getByRole('group', { name: /Plated at/u })).toBeTruthy();
      expect(within(panel()).getByText(MW.kept)).toBeTruthy();
    },
  );

  it('keeps the parts through Plated and back', SLOW, async () => {
    await menu('hidden');

    expect(within(panel()).getByText(MW.kept)).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('radio', { name: 'In parts' }));
    expect(within(panel()).getByLabelText('Course part 1')).toHaveProperty('value', 'Drink');
  });

  it('says No tables yet and offers nothing to choose', SLOW, async () => {
    await menu('noTables');

    expect(within(panel()).getByText(MW.noTables)).toBeTruthy();
    expect(within(panel()).queryAllByRole('checkbox')).toHaveLength(0);
  });
});

describe('a dish’s Parts', () => {
  it('moves a part and announces it, the ends greyed', SLOW, async () => {
    await menu('dishParts');

    fireEvent.click(within(panel()).getByRole('button', { name: 'Move Chicken up' }));
    expect(within(panel()).getByRole('status').textContent).toBe('Chicken moved to part 1 of 3.');
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

  it('offers only the choices not yet parts, by question', SLOW, async () => {
    await menu('choiceDraft');

    const offer = within(panel()).getByRole('group', { name: MW.addChoice });
    expect(
      within(offer)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['And a sauce?']);
    expect(within(panel()).getByText('Choice 3 · no question yet')).toBeTruthy();
  });

  it('refuses a 7th part beside Add a part', SLOW, async () => {
    await menu('tooMany');

    expect(within(panel()).getByText(MW.tooMany)).toBeTruthy();
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(6);
  });

  it('refuses a single part on Save, saving nothing', SLOW, async () => {
    await menu('onlyOne');

    expect(within(panel()).getByText(MW.onlyOne)).toBeTruthy();
    expect(screen.getByRole('complementary')).toBeTruthy();
  });

  it('refuses a blank part beside it and clears once named', SLOW, async () => {
    await menu('blankName');

    const field = within(panel()).getByLabelText('Part 3');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Coleslaw' } });
    expect(within(panel()).queryByText(MW.blank)).toBeNull();
  });

  it('saves parts and shows them on the dish row', SLOW, async () => {
    await menu('onePlate');

    fireEvent.click(within(panel()).getByRole('button', { name: MW.addPart }));
    fireEvent.change(within(panel()).getByLabelText('Part 1'), { target: { value: 'Yam' } });
    fireEvent.click(within(panel()).getByRole('button', { name: MW.addPart }));
    fireEvent.change(within(panel()).getByLabelText('Part 2'), { target: { value: 'Egusi' } });
    fireEvent.click(within(panel()).getByRole('button', { name: MW.save }));

    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText('Pounded yam and egusi saved.')).toBeTruthy();
  });

  it('refuses a save without menu.manage, keeping the panel', SLOW, async () => {
    await menu('forbidden');

    fireEvent.click(within(panel()).getByRole('button', { name: MW.save }));
    expect(within(panel()).getByRole('alert').textContent).toContain(MW.forbidden);
  });
});

describe('removing a choice that is a part, and read only', () => {
  it('adds that the choice is a part, and takes the part with it', SLOW, async () => {
    await menu('removeChoice');

    expect(
      screen.getByText(
        'Remove “And a side?” from Jollof rice? “And a side?” is also one of Jollof rice’s parts.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: MW.removeChoice }));
    expect(screen.queryByText('And a side?')).toBeNull();
  });

  it('shows everything as text without menu.manage', SLOW, async () => {
    await menu('readOnly');

    expect(screen.getByText(MW.lock)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit/u })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
