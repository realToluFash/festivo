import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
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
});
