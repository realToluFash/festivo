import type { GuestMeals, MealCourse } from '@soirely/api-client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CopiedCard, MealCards, MealScreen } from './Meals.tsx';
import { type Eater, type Plates, defaultLine, defaultName, keyOf } from './meals.ts';

const STARTER: MealCourse = {
  id: 'starter',
  name: 'Starter',
  answer: 'choose',
  skippable: false,
  picksClose: { at: '2030-10-16T23:59:59+01:00', source: 'chooseBy', closed: false },
  default: { dish: 'canape', variant: 'tray', options: [], chooseBy: '2030-10-16' },
  dishes: [
    {
      id: 'canape',
      name: 'Canapé selection',
      description: null,
      allergens: [],
      diets: [],
      variants: [
        { id: 'tray', name: 'Tray', allergens: [], diets: [] },
        { id: 'plate', name: 'Plate', allergens: [], diets: [] },
      ],
      choices: [],
    },
    {
      id: 'soup',
      name: 'Pepper soup',
      description: null,
      allergens: [],
      diets: [],
      variants: [],
      choices: [],
    },
  ],
};

const CLOSED: MealCourse = { ...STARTER, picksClose: { ...STARTER.picksClose, closed: true } };

const YOU: Eater = { key: 'you', id: 'g_bisi', name: null, you: true };
const CHIDI: Eater = { key: 'g_chidi', id: 'g_chidi', name: 'Chidi Okonkwo', you: false };

const meals = (excluded: GuestMeals['excluded'] = {}): GuestMeals => ({
  you: 'g_bisi',
  courses: [STARTER],
  answers: {},
  excluded,
});

function cards(course: MealCourse, plates: Plates, excluded: GuestMeals['excluded'] = {}) {
  render(
    <MealCards
      eaters={[YOU, CHIDI]}
      courses={[course]}
      plates={plates}
      allergies={() => []}
      timeZone="Africa/Lagos"
      busy={false}
      head="back"
      hosts="Amara and Tomi"
      pending={() => false}
      refused={new Set()}
      unsaved={new Set()}
      lineOf={(eater, one, shut) =>
        defaultLine(meals(excluded), one, eater, plates[keyOf(eater.key, one.id)], shut)
      }
      onChange={() => {}}
    />,
  );
}

describe('a course’s default on the guest page (sc-1362)', () => {
  it('names the default dish with its variant', () => {
    expect(defaultName(STARTER)).toBe('Canapé selection, Tray');
  });

  it('tells each person with no answer what will be waiting, the companion by name', () => {
    cards(STARTER, {});

    expect(
      screen.getByText(
        'Choose your starter by Wednesday, October 16. If you have not chosen by then, Canapé selection, Tray will be waiting for you.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Choose a starter for Chidi Okonkwo by Wednesday, October 16. If none is chosen by then, Canapé selection, Tray will be waiting for Chidi Okonkwo.',
      ),
    ).toBeTruthy();
  });

  it('says only when picks close to someone the default is never given, and to someone who has answered', () => {
    cards(
      STARTER,
      { [keyOf('you', 'starter')]: { kind: 'chosen', dish: 'soup', variant: null, options: {} } },
      { g_chidi: [{ course: 'starter', reason: 'allergy' }] },
    );

    expect(screen.queryByText(/will be waiting/)).toBeNull();
    expect(screen.getByText('Pepper soup')).toBeTruthy();
  });

  it('goes from the course’s screen once the person picks any answer', () => {
    const screenOf = (line: ReturnType<typeof defaultLine>) =>
      render(
        <MealScreen
          eater={YOU}
          course={STARTER}
          n={1}
          total={1}
          step={{ kind: 'dish' }}
          first
          plate={null}
          allergies={[]}
          other={null}
          cleared={null}
          refusal={null}
          timeZone="Africa/Lagos"
          line={line}
          onPlate={() => {}}
          onBack={() => {}}
          onNext={() => {}}
        />,
      );
    const picked = { kind: 'skipped' as const, dish: null, variant: null, options: {} };

    expect(defaultLine(meals(), STARTER, YOU, null, false)).toBe('chooseBy');
    expect(defaultLine(meals(), STARTER, YOU, picked, false)).toBeNull();
    screenOf('chooseBy');
    expect(screen.getByText(/will be waiting for you/)).toBeTruthy();
  });

  it('shows the default given after the date, with no Change', () => {
    const given = { kind: 'defaulted' as const, dish: 'canape', variant: 'tray', options: {} };
    cards(CLOSED, { [keyOf('you', 'starter')]: given, [keyOf('g_chidi', 'starter')]: given });

    expect(screen.getAllByText('Canapé selection')).toHaveLength(2);
    expect(screen.getByText('You had not chosen by then, so this is your starter.')).toBeTruthy();
    expect(
      screen.getByText('Chidi Okonkwo had not chosen by then, so this is Chidi Okonkwo’s starter.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Change/ })).toBeNull();
  });

  it('tells someone never given the default that the host will be in touch, after the date', () => {
    cards(CLOSED, {}, { g_bisi: [{ course: 'starter', reason: 'vegan' }] });

    expect(
      screen.getByText('You hadn’t chosen a starter by then. The host will be in touch about it.'),
    ).toBeTruthy();
    expect(screen.queryByText(/so this is your starter/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Change/ })).toBeNull();
  });

  it('says the same on the card copied with Same as, defaulted or left to the host', () => {
    const MAIN: MealCourse = { ...STARTER, id: 'main', name: 'Main', default: null };
    const given = { kind: 'defaulted' as const, dish: 'canape', variant: 'tray', options: {} };
    const copied = (plates: Plates, excluded: GuestMeals['excluded'] = {}) =>
      render(
        <CopiedCard
          eater={CHIDI}
          from={YOU}
          courses={[CLOSED, MAIN]}
          plates={plates}
          allergies={[]}
          timeZone="Africa/Lagos"
          lineOf={(eater, one, shut) =>
            defaultLine(meals(excluded), one, eater, plates[keyOf(eater.key, one.id)], shut)
          }
          onChange={() => {}}
          onBack={() => {}}
          onContinue={() => {}}
        />,
      );

    const { unmount } = copied({ [keyOf('g_chidi', 'starter')]: given });
    expect(
      screen.getByText('Chidi Okonkwo had not chosen by then, so this is Chidi Okonkwo’s starter.'),
    ).toBeTruthy();
    unmount();

    copied({}, { g_chidi: [{ course: 'starter', reason: 'vegan' }] });
    expect(screen.getByText(/The host will be in touch about it/)).toBeTruthy();
    expect(screen.queryByText('Not chosen')).toBeNull();
  });
});
