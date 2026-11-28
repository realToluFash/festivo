import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { CHW } from './dishChoices.ts';
import { VW } from './dishVariants.ts';
import { MCW } from './menuChange.ts';
import { CW, type CoursesStateName, coursesAt } from './menuCourses.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function menu(state: CoursesStateName) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [coursesAt(state)] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: CW.title }, WAIT);
}

const dialog = (): HTMLElement => screen.getByRole('alertdialog');
const card = (name: string): HTMLElement => screen.getByRole('listitem', { name });
const said = (): string => document.getElementById('mc-said')?.textContent ?? '';
const panel = (): HTMLElement => screen.getByRole('complementary');
const byId = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('the MenuChange dialog (sc-3913)', () => {
  it(
    'asks first, then removes the dish, counts them and moves focus to the course',
    SLOW,
    async () => {
      await menu('changeRemoveDish');

      expect(
        within(dialog()).getByRole('heading', { name: 'Remove Jollof rice from Main?' }),
      ).toBeTruthy();
      expect(within(dialog()).getByText(MCW.nobodyMessaged)).toBeTruthy();
      expect(document.activeElement?.textContent).toBe(MCW.cancel);
      fireEvent.click(within(dialog()).getByRole('button', { name: MCW.go }));

      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(said()).toBe('Jollof rice removed from Main. 45 guests will be asked to pick again.');
      expect(within(card('Main')).queryByText('Jollof rice')).toBeNull();
      expect(document.activeElement?.id).toBe('mc-c-k2');
    },
  );

  it('changes nothing on Cancel or Escape, and gives focus back to Remove…', SLOW, async () => {
    await menu('changeMenu');

    const remove = screen.getByRole('button', { name: 'Remove Jollof rice…' });
    remove.focus();
    fireEvent.click(remove);
    fireEvent.click(within(dialog()).getByRole('button', { name: MCW.cancel }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(remove);

    fireEvent.click(remove);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(card('Main')).getByText('Jollof rice')).toBeTruthy();
    expect(said()).toBe('');
  });

  it(
    'asks before an allergen reaches the people who have it, and saves at once when nobody does',
    SLOW,
    async () => {
      await menu('changeAllergen');

      expect(
        within(dialog()).getByText(/^4 guests who picked this dish have Sesame recorded/),
      ).toBeTruthy();
      fireEvent.click(within(dialog()).getByRole('button', { name: MCW.go }));
      expect(said()).toBe('Jollof rice saved. 4 guests will be asked to pick again.');

      await menu('changeNobody');
      fireEvent.click(screen.getByRole('button', { name: CW.saveChanges }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(said()).toBe('Jollof rice saved.');
    },
  );

  it('asks everyone coming at a course’s first dish', SLOW, async () => {
    await menu('changeFirstDish');

    expect(
      within(dialog()).getByText(
        'All 48 guests coming will be asked to pick for Late-night bites.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: MCW.go }));
    expect(said()).toBe(
      'Beef suya skewers added to Late-night bites. 48 guests will be asked to pick.',
    );
  });

  it('removes a picked variant once asked', SLOW, async () => {
    await menu('changeRemoveVariant');

    fireEvent.click(within(dialog()).getByRole('button', { name: MCW.go }));
    expect(said()).toBe(
      'Children’s portion removed from Jollof rice. 9 guests will be asked to pick again.',
    );
  });

  it('shows the 409 for a past date inside the dialog, with only Close', SLOW, async () => {
    await menu('changePastDate');

    fireEvent.click(within(dialog()).getByRole('button', { name: MCW.go }));
    expect(within(dialog()).getByRole('alert').textContent).toContain(
      'Adaeze & Tunde’s wedding was on Saturday, Nov 14. Its menu can’t change after the date. Nothing was changed.',
    );
    expect(within(dialog()).queryByRole('button', { name: MCW.go })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: MCW.close }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(card('Main')).getByText('Jollof rice')).toBeTruthy();
  });

  it.each([
    [
      'changeFirstVariant',
      'Make Jollof rice come 2 ways?',
      '45 guests picked this dish. They’ll be asked to pick again for Main.',
      'Jollof rice now comes 2 ways. 45 guests will be asked to pick again.',
    ],
    [
      'changeVariantAllergen',
      'Add Sesame to Chicken in Jollof rice?',
      '4 guests who picked this variant have Sesame recorded. They’ll be asked to pick again for Main, and will appear in Needs the host.',
      'Chicken saved. 4 guests will be asked to pick again.',
    ],
    [
      'changeAddChoice',
      'Add “And a side?” to Jollof rice?',
      '45 guests picked this dish. They’ll be asked to pick again for Main.',
      '“And a side?” added to Jollof rice. 45 guests will be asked to pick again.',
    ],
    [
      'changeSameChoice',
      'Add “And a side?” to Catfish pepper soup?',
      'All 48 guests coming will be asked to pick for Starter.',
      '“And a side?” added to Catfish pepper soup. 48 guests will be asked to pick.',
    ],
    [
      'changeSameVariant',
      'Add Light bowl to Catfish pepper soup?',
      'All 48 guests coming will be asked to pick for Starter.',
      'Light bowl added to Catfish pepper soup. 48 guests will be asked to pick.',
    ],
    [
      'changeRemoveChoice',
      'Remove “And a side?” from Jollof rice?',
      '45 guests answered this choice. They’ll be asked to pick again for Main.',
      '“And a side?” removed from Jollof rice. 45 guests will be asked to pick again.',
    ],
    [
      'changePickCount',
      'Let guests pick 2 options in “And a side?”?',
      '45 guests answered this choice. They’ll be asked to pick again for Main.',
      '“And a side?” saved. 45 guests will be asked to pick again.',
    ],
    [
      'changeRequired',
      'Make “And a side?” required?',
      '4 guests answered None for me. They’ll be asked to pick again for Main.',
      '“And a side?” saved. 4 guests will be asked to pick again.',
    ],
    [
      'changeDropOption',
      'Remove Moi moi from “And a side?”?',
      '8 guests picked this option. They’ll be asked to pick again for Main.',
      '“And a side?” saved. 8 guests will be asked to pick again.',
    ],
    [
      'changeOptionAllergen',
      'Add Crustaceans to Moi moi?',
      '3 guests who picked this option have Crustaceans recorded. They’ll be asked to pick again for Main, and will appear in Needs the host.',
      '“And a side?” saved. 3 guests will be asked to pick again.',
    ],
  ] as const)(
    '%s: names the change and counts who it asks',
    SLOW,
    async (state, title, count, done) => {
      await menu(state);

      expect(within(dialog()).getByRole('heading', { name: title })).toBeTruthy();
      expect(within(dialog()).getByText(count)).toBeTruthy();
      fireEvent.click(within(dialog()).getByRole('button', { name: MCW.go }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(said()).toBe(done);
    },
  );

  it('opens Add variant and Add a choice on a picked dish, and asks on save', SLOW, async () => {
    await menu('changeMenu');

    fireEvent.click(screen.getByRole('button', { name: 'Add a choice to Jollof rice' }));
    expect(screen.queryByText(CHW.dishPicked)).toBeNull();
    expect(screen.getByRole('heading', { name: CHW.addTitle })).toBeTruthy();
  });

  it(
    'asks the 45 who answered on Remove… of an answered choice, not refusing it',
    SLOW,
    async () => {
      await menu('changeRemoveChoice');
      fireEvent.click(within(dialog()).getByRole('button', { name: MCW.cancel }));

      fireEvent.click(screen.getByRole('button', { name: 'Remove “And a side?”…' }));
      expect(within(dialog()).getByText(/^45 guests answered this choice/)).toBeTruthy();
      expect(screen.queryByText(CHW.answered)).toBeNull();
    },
  );

  it.each([
    ['changePickCount', CHW.saveChoice, 'Let guests pick 2 options in “And a side?”?'],
    ['changeRequired', CHW.saveChoice, 'Make “And a side?” required?'],
    ['changeDropOption', CHW.saveChoice, 'Remove Moi moi from “And a side?”?'],
    ['changeOptionAllergen', CHW.saveChoice, 'Add Crustaceans to Moi moi?'],
    ['changeAddChoice', CHW.addChoiceSave, 'Add “And a side?” to Jollof rice?'],
    ['changeFirstVariant', VW.addVariants, 'Make Jollof rice come 2 ways?'],
    ['changeVariantAllergen', VW.saveVariant, 'Add Sesame to Chicken in Jollof rice?'],
    ['changeSameVariant', VW.addVariant, 'Add Light bowl to Catfish pepper soup?'],
  ] as const)('%s: its panel’s save asks the same', SLOW, async (state, save, title) => {
    await menu(state);
    fireEvent.click(within(dialog()).getByRole('button', { name: MCW.cancel }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: save }));
    expect(within(dialog()).getByRole('heading', { name: title })).toBeTruthy();
  });
  it.each([
    [
      'a rename',
      () => fireEvent.change(byId('ch-question'), { target: { value: 'And a side dish?' } }),
      'And a side dish?',
    ],
    [
      'Required turned off',
      () => fireEvent.click(screen.getByLabelText(CHW.required)),
      'And a side?',
    ],
    [
      'an option added',
      () => {
        fireEvent.click(byId('ch-add-option'));
        const names = panel().querySelectorAll<HTMLInputElement>('input[id$="-name"]');
        const added = names[names.length - 1] as HTMLInputElement;
        fireEvent.change(added, { target: { value: 'Fried yam' } });
        fireEvent.click(screen.getByRole('button', { name: CHW.setAllergens }));
        const nones = panel().querySelectorAll<HTMLInputElement>('input[id$="-none"]');
        fireEvent.click(nones[nones.length - 1] as HTMLElement);
      },
      'And a side?',
    ],
  ] as const)('%s on an answered choice asks nobody', SLOW, async (_, edit, question) => {
    await menu('changePickCount');
    fireEvent.click(within(dialog()).getByRole('button', { name: MCW.cancel }));
    fireEvent.click(byId('ch-fewer'));

    edit();
    fireEvent.click(screen.getByRole('button', { name: CHW.saveChoice }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(said()).toContain(CHW.saved(question));
  });
});
