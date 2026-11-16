import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { VW } from './dishVariants.ts';
import { resetSample } from './events.ts';
import { CW, type CoursesStateName, coursesAt } from './menuCourses.ts';
import { LW, type LibraryStateName, libraryAt } from './menuLibrary.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function open(at: string, title: string) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [at] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, WAIT);
}

const menu = (state: CoursesStateName, more = '') => open(coursesAt(state, more), CW.title);
const library = (state: LibraryStateName, more = '') => open(libraryAt(state, more), LW.title);

const panel = (): HTMLElement => screen.getByRole('complementary');
const said = (id: string): string => document.getElementById(id)?.textContent ?? '';
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('variants on the event Menu (sc-3903)', () => {
  it(
    'reads a dish with variants as its ways, each with its own allergens and picks',
    SLOW,
    async () => {
      await menu('variants');

      expect(screen.getByRole('heading', { name: 'Jollof rice · 3 ways' })).toBeTruthy();
      expect(screen.getByText('4 courses · 6 dishes')).toBeTruthy();
      const ways = screen.getByRole('list', { name: 'Jollof rice · 3 ways' });
      expect(within(ways).getAllByText(VW.childrenOnly)).toHaveLength(2);
      expect(within(ways).getByText('31 picked · 78%')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add variant to Coconut rice' })).toBeTruthy();
    },
  );

  it('adds the first two at once, checked before it sends', SLOW, async () => {
    await menu('addFirst');

    expect(within(panel()).getByText(VW.untilNow('Coconut rice'))).toBeTruthy();
    press(VW.addVariants);
    expect(document.activeElement?.id).toBe('vb0-name');
    expect(within(panel()).getAllByText(VW.nameBlank)).toHaveLength(2);

    fireEvent.change(document.getElementById('vb0-name') as HTMLElement, {
      target: { value: 'Chicken' },
    });
    fireEvent.click(document.getElementById('vb0-none') as HTMLElement);
    fireEvent.change(document.getElementById('vb1-name') as HTMLElement, {
      target: { value: 'Fish' },
    });
    fireEvent.click(document.getElementById('vb1-has-fish') as HTMLElement);
    press(VW.addVariants);
    expect(said('mc-said')).toContain('Coconut rice now comes 2 ways: Chicken and Fish.');
    expect(screen.getByRole('heading', { name: 'Coconut rice · 2 ways' })).toBeTruthy();
  });

  it('keeps a variant for Everyone, and clears the line once one is', SLOW, async () => {
    await menu('addFirstNoEveryone');

    expect(within(panel()).getAllByText(VW.needsEveryone)).toHaveLength(2);
    expect(document.activeElement?.id).toBe('vb0-for-children');
    fireEvent.click(document.getElementById('vb1-for-everyone') as HTMLElement);
    expect(within(panel()).queryByText(VW.needsEveryone)).toBeNull();
  });

  it('refuses Add variant on a picked dish, and at six', SLOW, async () => {
    await menu('menu');
    press('Add variant to Jollof rice');
    expect(screen.getByText(VW.dishPicked)).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();

    await menu('atLimitVariants');
    expect(screen.getByText(VW.limit)).toBeTruthy();
  });

  it(
    'asks before removing, refuses the last Everyone variant, and folds from two',
    SLOW,
    async () => {
      await menu('variants');
      press('Remove Children’s plain…');
      expect(screen.getByText(VW.removeAsk('Children’s plain', 'Jollof rice'))).toBeTruthy();
      press(VW.removeVariant);
      expect(said('mc-said')).toContain('Children’s plain removed from Jollof rice.');

      const jollof = screen.getByRole('list', { name: 'Jollof rice · 2 ways' });
      fireEvent.click(within(jollof).getByRole('button', { name: 'Remove Chicken…' }));
      expect(within(jollof).getByText(VW.variantPicked)).toBeTruthy();

      await library('libVariants');
      const lib = screen.getByRole('list', { name: 'Jollof rice · 3 ways' });
      fireEvent.click(within(lib).getByRole('button', { name: 'Remove Chicken…' }));
      expect(within(lib).getByText(VW.lastEveryone('Chicken'))).toBeTruthy();
      expect(document.activeElement?.id).not.toBe('lib-vask-lv-chicken');

      await menu('foldToOne');
      expect(screen.getByText('EUR 15.50, from Fish')).toBeTruthy();
      press(VW.makeSingle);
      expect(said('mc-said')).toContain(VW.folded('Coconut rice', 'Fish', 'event'));
      expect(screen.queryByRole('heading', { name: 'Coconut rice · 2 ways' })).toBeNull();
    },
  );

  it('says nothing of cost without budget.read', SLOW, async () => {
    await menu('foldToOne', '&budget=no');
    expect(screen.queryByText('EUR 15.50, from Fish')).toBeNull();
    expect(
      screen.getByText('Coconut rice becomes a single dish with Fish’s allergens, diets:'),
    ).toBeTruthy();
  });

  it('hints Guests pick the way on a set course with two Everyone variants', SLOW, async () => {
    await menu('setCourseWay');
    expect(screen.getByText(VW.guestsPickTheWay('Jollof rice'))).toBeTruthy();

    await menu('setCourseChildren');
    expect(screen.queryByText(VW.guestsPickTheWay('Jollof rice'))).toBeNull();
  });

  it('copies a library Cost only in the event’s currency', SLOW, async () => {
    await menu('libAdded');
    expect((document.getElementById('vb0-amount') as HTMLInputElement).value).toBe('6.00');

    await menu('libAddedOther');
    expect((document.getElementById('vb0-amount') as HTMLInputElement).value).toBe('');
    expect(screen.getByText(VW.pricedIn('GBP'))).toBeTruthy();
  });

  it('saves an allergen on a picked variant with the line under it', SLOW, async () => {
    await menu('editVariantAllergen');
    press(VW.saveVariant);
    expect(said('mc-said')).toContain('Chicken saved.');
    expect(said('mc-said')).toContain('4 guests who picked Jollof rice, Chicken, have Sesame');
  });

  it('says a failed fold changed nothing', SLOW, async () => {
    await menu('foldFailed');
    press(VW.makeSingle);
    expect(said('mc-said')).toContain(VW.failedChange('Coconut rice', 2));
    expect(screen.getByRole('heading', { name: 'Coconut rice · 2 ways' })).toBeTruthy();
  });
});

describe('variants in the Menu library (sc-3903)', () => {
  it('reads each variant in an inset, and archived ones without controls', SLOW, async () => {
    await library('libVariants');
    expect(screen.getByRole('heading', { name: 'Jollof rice · 3 ways' })).toBeTruthy();
    const jollof = screen.getByRole('list', { name: 'Jollof rice · 3 ways' });
    expect(within(jollof).getByRole('button', { name: 'Edit Chicken' })).toBeTruthy();

    await library('libVariantsArchived');
    expect(screen.getByRole('heading', { name: 'Catfish pepper soup · 2 ways' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Full bowl' })).toBeNull();
  });

  it('edits a variant with its Last price, and saves it', SLOW, async () => {
    await library('libEditVariant');
    expect((document.getElementById('vb0-currency') as HTMLSelectElement).value).toBe('EUR');
    press(VW.saveVariant);
    expect(said('lib-said')).toBe('Chicken saved.');
  });

  it('refuses the last Everyone variant changed to Children only', SLOW, async () => {
    await library('libEditVariantNoEveryone');
    expect(within(panel()).getByText(VW.needsEveryone)).toBeTruthy();
    expect(document.activeElement?.id).toBe('vb0-for-children');
  });

  it('folds with the last price', SLOW, async () => {
    await library('libFoldToOne');
    expect(screen.getByText('GBP 12.00, from Fish')).toBeTruthy();
    press(VW.makeSingle);
    expect(said('lib-said')).toBe(VW.folded('Coconut rice', 'Fish', 'library'));
  });

  it('asks only Name and Description on a dish with variants', SLOW, async () => {
    await library('libEditDishVariants');
    expect(within(panel()).queryByRole('group', { name: LW.containsLegend })).toBeNull();
    expect(within(panel()).getByText(VW.eachOwn)).toBeTruthy();
  });
});
