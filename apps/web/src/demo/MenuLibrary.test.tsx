import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { LW } from './menuLibrary.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function library(query = '', title: string = LW.title) {
  cleanup();
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/menu-library${query === '' ? '' : `?${query}`}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, WAIT);
}

const panel = (): HTMLElement => screen.getByRole('complementary');
const rows = (): string[] =>
  screen.getAllByRole('heading', { level: 3 }).map((one) => one.textContent ?? '');

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('the Menu library (sc-3901)', () => {
  it('lists the dishes A to Z, with Contains as a shape and words', SLOW, async () => {
    await library();

    expect(rows()[0]).toBe('Asun');
    expect(screen.getByText('8 dishes')).toBeTruthy();
    expect(screen.getByText('Contains: Peanuts · Sesame')).toBeTruthy();
    expect(screen.getAllByText(LW.containsNone).length).toBeGreaterThan(0);
    expect(screen.getByText(LW.notStated)).toBeTruthy();
    expect(screen.queryByText('Puff puff')).toBeNull();
    expect(screen.getByRole('group', { name: 'Actions for Beef suya skewers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive Beef suya skewers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Chin chin…' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Menu library' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('finds by name and says what found nothing', SLOW, async () => {
    await library();

    fireEvent.change(screen.getByRole('searchbox', { name: LW.find }), {
      target: { value: 'plantain' },
    });
    expect(screen.getByText(LW.noMatch('plantain'))).toBeTruthy();
    expect(screen.getByText('0 of 8 dishes')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: LW.clearAll })[0] as HTMLElement);
    expect(screen.getByText('8 dishes')).toBeTruthy();
  });

  it('filters by diet and lists the archived dishes with Restore', SLOW, async () => {
    await library();

    fireEvent.click(screen.getByRole('button', { name: 'Vegan', pressed: false }));
    expect(screen.getByText('3 of 8 dishes')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Archived/u }));
    expect(rows()).toEqual(['Puff puff']);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Puff puff' }));
    expect(screen.getByText(LW.restored('Puff puff'))).toBeTruthy();
  });

  it('refuses a blank dish beside its fields, focus on the name', SLOW, async () => {
    await library();

    fireEvent.click(screen.getByRole('button', { name: LW.addDish }));
    fireEvent.click(within(panel()).getByRole('button', { name: LW.save }));
    expect(within(panel()).getByText(LW.nameBlank)).toBeTruthy();
    expect(within(panel()).getByText(LW.containsBlank)).toBeTruthy();
    expect(document.activeElement?.id).toBe('lib-name');

    fireEvent.change(within(panel()).getByLabelText(LW.name), { target: { value: 'Ofada stew' } });
    expect(within(panel()).queryByText(LW.nameBlank)).toBeNull();
  });

  it('keeps Contains none of these and an allergen apart', SLOW, async () => {
    await library('state=add');

    const none = within(panel()).getByRole('checkbox', { name: LW.none });
    const milk = within(panel()).getByRole('checkbox', { name: 'Milk' });
    fireEvent.click(milk);
    fireEvent.click(none);
    expect(milk).toHaveProperty('checked', false);
    fireEvent.click(milk);
    expect(none).toHaveProperty('checked', false);
  });

  it('gives one line per clashing diet', SLOW, async () => {
    await library('state=conflictTwo');

    expect(within(panel()).getByText(LW.vegetarianFish)).toBeTruthy();
    expect(within(panel()).getByText(LW.veganBoth)).toBeTruthy();
    expect(document.activeElement?.id).toBe('lib-diet-vegetarian');
  });

  it('asks about a duplicate with the stored name, and Add anyway adds it', SLOW, async () => {
    await library('state=duplicate');

    expect(within(panel()).getByText(LW.duplicate('Jollof rice'))).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: LW.addAnyway }));
    expect(screen.getByText(LW.added('jollof Rice'))).toBeTruthy();
    expect(screen.getByText('9 dishes')).toBeTruthy();
  });

  it('says an archived match is under Archived', SLOW, async () => {
    await library('state=duplicateArchived');

    expect(
      within(panel()).getByText(`${LW.duplicate('Puff puff')} ${LW.underArchived}`),
    ).toBeTruthy();
  });

  it('asks on Edit only when the name changed onto another dish', SLOW, async () => {
    await library('state=editSameName');

    expect(within(panel()).getByText(LW.duplicate('Moi moi'))).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: LW.saveAnyway })).toBeTruthy();

    await library('state=edit');
    fireEvent.click(within(panel()).getByRole('button', { name: LW.save }));
    expect(screen.getByText(LW.saved('Jollof rice'))).toBeTruthy();
  });

  it('refuses a price in the wrong format, with the currency’s example', SLOW, async () => {
    await library('state=priceDecimals');

    expect(within(panel()).getByText(LW.priceWrong('12'))).toBeTruthy();
  });

  it(
    'starts on Choose a currency with no organisation currency, and refuses an amount without one',
    SLOW,
    async () => {
      await library('state=noCurrencyRefused');

      expect(within(panel()).getByRole('combobox', { name: LW.currency })).toHaveProperty(
        'value',
        '',
      );
      expect(within(panel()).getByText(LW.currencyBlank)).toBeTruthy();
      expect(document.activeElement?.id).toBe('lib-currency');
    },
  );

  it('hides Last price without budget.read', SLOW, async () => {
    await library('state=edit&budget=no');

    expect(within(panel()).queryByText(LW.price)).toBeNull();
    expect(within(panel()).getByText(LW.ownCopy)).toBeTruthy();
  });

  it('asks once in the row before deleting', SLOW, async () => {
    await library();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Chin chin…' }));
    expect(screen.getByText(LW.deleteAsk('Chin chin'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: LW.deleteDish }));
    expect(screen.getByText(LW.deleted('Chin chin'))).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3, name: 'Chin chin' })).toBeNull();
  });

  it('archives at once, under Archived', SLOW, async () => {
    await library();

    fireEvent.click(screen.getByRole('button', { name: 'Archive Beef suya skewers' }));
    expect(screen.getByText(LW.archivedLine('Beef suya skewers'))).toBeTruthy();
    expect(screen.getByText('7 dishes')).toBeTruthy();
  });

  it('shows read only without a button that changes anything', SLOW, async () => {
    await library('state=readOnly');

    expect(screen.getByText(LW.lock)).toBeTruthy();
    expect(screen.queryByRole('button', { name: LW.addDish })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Edit|Archive|Delete|Restore) /u })).toBeNull();
    expect(screen.getAllByText(LW.usedBy)).toHaveLength(4);
  });

  it('shows the 403 page without menu.read, and no link to it', SLOW, async () => {
    await library('state=noAccess', LW.forbiddenTitle);

    expect(screen.queryByRole('link', { name: 'Menu library' })).toBeNull();
  });

  it('fails a save once, then saves', SLOW, async () => {
    await library('state=failedSave');

    fireEvent.click(within(panel()).getByRole('button', { name: LW.save }));
    expect(within(panel()).getByText(LW.failedSave)).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: LW.save }));
    expect(screen.getByText(LW.saved('Coconut rice'))).toBeTruthy();
  });
});
