import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { MW, PERSON, type MealStateName, mealAt } from './mealStep.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function meal(state: MealStateName) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [mealAt(state)] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('button', { name: MW.next }, WAIT);
}

const next = () => fireEvent.click(screen.getByRole('button', { name: MW.next }));
const heading = () => document.getElementById('ms-h')?.textContent ?? '';

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
});

describe('the meal step on the guest’s page (sc-3904)', () => {
  it('asks the way, then the side, then the sauce, and records them', SLOW, async () => {
    await meal('variant');
    expect(heading()).toBe('Jollof rice · Chicken or Fish?');
    fireEvent.click(screen.getByRole('radio', { name: /Fish/ }));
    next();

    expect(heading()).toBe('Jollof rice · And a side?');
    expect(screen.getByText(MW.pickExactly(1))).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Plantain/ }));
    next();

    expect(heading()).toBe('Jollof rice · And a sauce?');
    fireEvent.click(screen.getByRole('radio', { name: MW.noneForMe }));
    next();

    expect(screen.getByRole('status').textContent).toBe(
      'Main is recorded as chosen: Jollof rice, Fish, Plantain, None for me.',
    );
  });

  it('refuses Next with nothing chosen, and focuses the first option', SLOW, async () => {
    await meal('sideBlank');
    expect(screen.getByRole('alert').textContent).toContain(MW.chooseOne);
    expect(document.activeElement?.getAttribute('type')).toBe('radio');

    await meal('sauceBlank');
    expect(screen.getByRole('alert').textContent).toContain(MW.pickOrNone);

    await meal('setWrongCount');
    expect(screen.getByRole('alert').textContent).toContain('Pick exactly 2. You’ve picked 1.');
  });

  it('greys out a ruled-out option with the reason, and says the host can help', SLOW, async () => {
    await meal('setRuledOut');
    const salad = screen.getByRole('radio', { name: /Garden salad/ }) as HTMLInputElement;
    expect(salad.disabled).toBe(true);
    expect(screen.getAllByText(MW.allergicTo(PERSON, 'mustard'))).toHaveLength(1);
    expect(screen.getByText(MW.hostLine(PERSON))).toBeTruthy();
  });

  it('records needs the host when nothing is safe, with no kitchen choice', SLOW, async () => {
    await meal('setNothingSafe');
    expect(screen.getByText(MW.nothingSafe(PERSON))).toBeTruthy();
    expect(screen.queryByRole('radio', { name: MW.letKitchen })).toBeNull();
    next();
    expect(screen.getByRole('status').textContent).toBe('Main is recorded as needs the host.');
  });

  it('lets the kitchen choose on a set course', SLOW, async () => {
    await meal('setChoices');
    expect(screen.getByText('Short rib')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: MW.letKitchen }));
    next();
    expect(screen.getByRole('status').textContent).toBe('Main is recorded as chef’s choice.');
  });

  it(
    'shows the answered dish card’s allergens, and a course of drafts is no screen',
    SLOW,
    async () => {
      await meal('cardShito');
      expect(screen.getByText('Contains: crustaceans, fish')).toBeTruthy();
      expect(screen.getByText('Shito · crustaceans, fish')).toBeTruthy();

      await meal('courseOfDrafts');
      expect(screen.getByText(`${PERSON} · Main · 2 of 2`)).toBeTruthy();
    },
  );
});
