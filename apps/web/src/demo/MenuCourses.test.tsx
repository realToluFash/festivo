import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { CW, type CoursesStateName, coursesAt } from './menuCourses.ts';
import { LW } from './menuLibrary.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function menu(state: CoursesStateName, more = '', title: string = CW.title) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [coursesAt(state, more)] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, WAIT);
}

const panel = (): HTMLElement => screen.getByRole('complementary');
const card = (name: string): HTMLElement => screen.getByRole('listitem', { name });
const said = (): string => document.getElementById('mc-said')?.textContent ?? '';

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('the event Menu (sc-3902)', () => {
  it('lists the courses in order with the header’s counts and Ready or Empty', SLOW, async () => {
    await menu('menu');

    expect(screen.getByText('4 courses · 6 dishes')).toBeTruthy();
    expect(screen.getByText('3 of 4 courses ready')).toBeTruthy();
    expect(within(card('Main')).getByText('Course 2 of 4 · served 20:00')).toBeTruthy();
    expect(within(card('Late-night bites')).getByText('Course 4 of 4')).toBeTruthy();
    expect(within(card('Late-night bites')).getByText(CW.emptyTag)).toBeTruthy();
    expect(within(card('Main')).getByText('Contains none of the 14 allergens')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Move Starter up' }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('moves a course with Move down, says so, and keeps focus on the button', SLOW, async () => {
    await menu('menu');

    const down = screen.getByRole('button', { name: 'Move Starter down' });
    down.focus();
    fireEvent.click(down);
    expect(said()).toBe('Starter moved to course 2 of 4.');
    expect(within(card('Starter')).getByText('Course 2 of 4 · served 18:30')).toBeTruthy();
    expect(document.activeElement?.id).toBe('mc-down-k1');
  });

  it('keeps Everyone gets the same for a one-dish course only', SLOW, async () => {
    await menu('menu');

    const same = within(card('Main')).getByRole('radio', { name: CW.same });
    expect(same.getAttribute('aria-disabled')).toBe('true');
    expect(within(card('Main')).getByText(CW.sameNeedsOne)).toBeTruthy();
    fireEvent.click(same);
    expect(within(card('Main')).getByRole('radio', { name: CW.choose })).toHaveProperty(
      'checked',
      true,
    );
    fireEvent.click(within(card('Main')).getByRole('switch', { name: CW.skip }));
    expect(within(card('Main')).getByText('Guests also see “No main for me”.')).toBeTruthy();
  });

  it('refuses a blank course name and a time that is not 24-hour', SLOW, async () => {
    await menu('addCourseLong');

    expect(within(panel()).getByText(CW.courseLong)).toBeTruthy();
    expect(within(panel()).getByText(CW.timeWrong)).toBeTruthy();
    await menu('addCourseBlank');
    expect(within(panel()).getByText(CW.courseBlank)).toBeTruthy();
    expect(document.activeElement?.id).toBe('mc-name');
  });

  it('adds a course last, from a suggestion', SLOW, async () => {
    await menu('addCourse');

    fireEvent.click(within(panel()).getByRole('button', { name: 'Dessert' }));
    fireEvent.click(within(panel()).getByRole('button', { name: CW.addCourse }));
    expect(said()).toBe('Dessert added as course 5 of 5.');
    expect(screen.getByText('5 courses · 6 dishes')).toBeTruthy();
  });

  it('opens nothing at 10 courses, and says why beside the button', SLOW, async () => {
    await menu('atLimit');

    expect(screen.getByText(CW.atLimit)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move Soup up' }));
    expect(screen.queryByText(CW.atLimit)).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: CW.addCourse })[1] as HTMLElement);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(document.getElementById('mc-limit-end')?.textContent).toContain(CW.atLimit);
  });

  it('adds nothing when the server refuses the 10th', SLOW, async () => {
    await menu('atLimitForm');

    expect(document.getElementById('mc-form-full')?.textContent).toContain(CW.atLimit);
    expect(screen.getByText('9 courses · 8 dishes')).toBeTruthy();
  });

  it('adds a library dish as a copy, and marks it On this course', SLOW, async () => {
    await menu('addDish');

    fireEvent.click(within(panel()).getByRole('button', { name: 'Add Moi moi' }));
    expect(within(panel()).getByText('Moi moi added to Main.')).toBeTruthy();
    expect(within(panel()).getAllByText(CW.onCourse)).toHaveLength(3);
    expect(screen.getByText('4 courses · 7 dishes')).toBeTruthy();
  });

  it('puts a set course back to Guests choose with a second dish', SLOW, async () => {
    await menu('addDishSame');

    fireEvent.click(within(panel()).getByRole('button', { name: 'Add Moi moi' }));
    expect(
      within(panel()).getByText(
        'Moi moi added to Starter. Starter has 2 dishes now, so guests choose.',
      ),
    ).toBeTruthy();
  });

  it('says the library is loading, and quotes no search, before it has loaded', SLOW, async () => {
    await menu('addDishLoading');

    expect(document.getElementById('mc-found')?.textContent).toBe(CW.libraryLoading);
    expect(within(panel()).queryByText(CW.noMatch(''))).toBeNull();
    expect(within(panel()).queryByRole('button', { name: CW.startNew('') })).toBeNull();
  });

  it('says a library that did not load did not, and loads it again', SLOW, async () => {
    await menu('addDishLibraryFailed');

    expect(document.getElementById('mc-found')?.textContent).toBe(CW.libraryFailed);
    expect(within(panel()).queryByText(CW.libraryEmpty)).toBeNull();
    expect(within(panel()).queryByRole('button', { name: CW.startNewBlank })).toBeNull();
    fireEvent.click(within(panel()).getByRole('button', { name: CW.tryAgain }));
    expect(document.getElementById('mc-found')?.textContent).toBe(CW.libraryLoading);
    expect(document.activeElement?.id).toBe('mc-find');
    expect(within(panel()).queryByRole('button', { name: CW.tryAgain })).toBeNull();
    await waitFor(() => {
      expect(document.getElementById('mc-found')?.textContent).toMatch(/ in the menu library$/);
    }, WAIT);
  });

  it('comes back to did-not-load when Try again fails again', SLOW, async () => {
    await menu('addDishLibraryFailsAgain');

    fireEvent.click(within(panel()).getByRole('button', { name: CW.tryAgain }));
    expect(document.getElementById('mc-found')?.textContent).toBe(CW.libraryLoading);
    await within(panel()).findByRole('button', { name: CW.tryAgain }, WAIT);
    expect(document.getElementById('mc-found')?.textContent).toBe(CW.libraryFailed);
    expect(within(panel()).queryByRole('button', { name: CW.startNewBlank })).toBeNull();
    fireEvent.click(within(panel()).getByRole('button', { name: CW.tryAgain }));
    await waitFor(() => {
      expect(document.getElementById('mc-found')?.textContent).toMatch(/ in the menu library$/);
    }, WAIT);
  });

  it('says an empty library has no dishes, and starts a new dish', SLOW, async () => {
    await menu('addDishEmptyLibrary');

    expect(within(panel()).getByText(CW.libraryEmpty)).toBeTruthy();
    expect(within(panel()).queryByText(CW.noMatch(''))).toBeNull();
    fireEvent.click(within(panel()).getByRole('button', { name: CW.startNewBlank }));
    expect(within(panel()).getByLabelText(LW.name)).toHaveProperty('value', '');
  });

  it('finds nothing and starts a new dish with the name', SLOW, async () => {
    await menu('addDishNoMatch');

    expect(within(panel()).getByText(CW.noMatch('plantain'))).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: CW.startNew('plantain') }));
    expect(within(panel()).getByLabelText(LW.name)).toHaveProperty('value', 'plantain');
  });

  it('saves a new dish, and Only for this event hides Last price', SLOW, async () => {
    await menu('addDishNew');

    expect(within(panel()).getByText(LW.price)).toBeTruthy();
    fireEvent.change(within(panel()).getByLabelText(LW.name), { target: { value: 'Suya bites' } });
    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Peanuts' }));
    fireEvent.click(within(panel()).getByRole('checkbox', { name: CW.onlyEvent }));
    expect(within(panel()).queryByText(LW.price)).toBeNull();
    expect(within(panel()).getByText(CW.notLibrary)).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: CW.addDish }));
    expect(said()).toBe('Suya bites added to Main.');
  });

  it('refuses a blank new dish', SLOW, async () => {
    await menu('addDishNewBlank');

    expect(within(panel()).getByText(LW.nameBlank)).toBeTruthy();
    expect(within(panel()).getByText(LW.containsBlank)).toBeTruthy();
  });

  it(
    'saves an allergen on a picked dish with the line, and none when one comes off',
    SLOW,
    async () => {
      await menu('editDishAllergen');

      expect(within(panel()).getByText(CW.copyOnly)).toBeTruthy();
      fireEvent.click(within(panel()).getByRole('button', { name: CW.saveChanges }));
      expect(said()).toContain(
        '4 guests who picked Jollof rice have Sesame recorded, and nobody has told them.',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Edit Jollof rice' }));
      fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Sesame' }));
      fireEvent.click(within(panel()).getByRole('button', { name: CW.saveChanges }));
      expect(said()).toBe('Jollof rice saved.');
    },
  );

  it('asks before removing a dish, and refuses a picked one', SLOW, async () => {
    await menu('removeDish');

    expect(
      screen.getByText('Remove Chin chin from Dessert? The menu library keeps its own.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: CW.removeDish }));
    expect(said()).toBe('Chin chin removed from Dessert.');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Jollof rice…' }));
    expect(within(card('Main')).getByText(CW.dishPicked)).toBeTruthy();
    expect(within(card('Main')).getByText('Jollof rice')).toBeTruthy();
  });

  it('asks before deleting a course, and refuses one with picks', SLOW, async () => {
    await menu('deleteCourse');

    expect(screen.getByText('Delete Dessert? Its 2 dishes come off with it.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: CW.keepIt }));
    expect(document.activeElement?.id).toBe('mc-delete-k3');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Main…' }));
    expect(within(card('Main')).getByText(CW.coursePicked)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Late-night bites…' }));
    expect(screen.getByText('Delete Late-night bites? It has no dishes.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: CW.deleteCourse }));
    expect(said()).toBe('Late-night bites deleted.');
    expect(screen.queryByText(/courses ready/u)).toBeNull();
  });

  it('reads only without menu.manage', SLOW, async () => {
    await menu('menuReadOnly');

    expect(screen.getByText(CW.lock)).toBeTruthy();
    expect(screen.queryByRole('button', { name: CW.addCourse })).toBeNull();
    expect(screen.queryByRole('button', { name: CW.addDish })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Move|Edit|Delete|Remove) /u })).toBeNull();
    expect(within(card('Starter')).getByText(CW.same)).toBeTruthy();
    expect(within(card('Dessert')).getByText(CW.skip)).toBeTruthy();
  });

  it.each([
    ['readOnlyCanView', 'Can view'],
    ['readOnlyCheckIn', 'Can check guests in'],
  ] as const)('names a Member’s role on the event in %s', SLOW, async (state, role) => {
    await menu(state);

    expect(
      screen.getByText(
        `Your role on this event, ${role}, can see this menu but not change it. Someone whose role can change Menu can.`,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(CW.lock)).toBeNull();
    expect(screen.queryByRole('button', { name: CW.addCourse })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Move|Edit|Delete|Remove) /u })).toBeNull();
  });

  it('says No menu yet, with Add course only for a manager', SLOW, async () => {
    await menu('empty');
    expect(screen.getByText(CW.emptyTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: CW.addCourse })).toBeTruthy();

    await menu('emptyReadOnly');
    expect(screen.queryByRole('button', { name: CW.addCourse })).toBeNull();
  });

  it('fails a move and a save in words, and refuses a save without the role', SLOW, async () => {
    await menu('moveFailed');
    fireEvent.click(screen.getByRole('button', { name: 'Move Main up' }));
    expect(said()).toBe(CW.failedMove('Main', 2, 4));

    await menu('saveForbidden');
    fireEvent.click(within(panel()).getByRole('button', { name: CW.saveChanges }));
    expect(within(panel()).getByText(CW.forbidden)).toBeTruthy();
  });

  it('refuses without menu.read, and for another organisation’s event', SLOW, async () => {
    await menu('noAccess', '', 'This page does not exist');
    const crumb = screen.getByRole('navigation', { name: CW.crumb });
    expect(
      within(crumb)
        .getAllByRole('link')
        .map((one) => one.textContent),
    ).toEqual([CW.events]);
    await menu('gone', '', CW.gone);
    await menu('cannotReach', '', CW.cannotReach);
    fireEvent.click(screen.getByRole('button', { name: CW.tryAgain }));
    expect(await screen.findByRole('heading', { level: 1, name: CW.title })).toBeTruthy();
  });

  it('names the allergens in the language picked', SLOW, async () => {
    await menu('menu', '&format=fr');

    expect(within(card('Starter')).getByText('Contains: Poissons · Céleri')).toBeTruthy();
  });
});

describe('when picks close, on the Menu (sc-3905)', () => {
  it('puts the close in the header and on each course that asks guests', SLOW, async () => {
    await menu('picksOneDate');
    expect(screen.getByText('picks close Monday, Oct 19')).toBeTruthy();
    expect(within(card('Starter')).getByText('Picks close Monday, Oct 19')).toBeTruthy();
    expect(within(card('Main')).getByText(/Set by the event’s reply-by date/)).toBeTruthy();
    expect(within(card('Late-night bites')).queryByText(/Picks close/)).toBeNull();
  });

  it('greys a closed course, with Who hasn’t picked for a manager only', SLOW, async () => {
    await menu('picksOneClosed');
    expect(screen.getByText('picks close Saturday, Nov 14')).toBeTruthy();
    expect(within(card('Starter')).getByText('Picks closed on Friday, Oct 16')).toBeTruthy();
    fireEvent.click(
      within(card('Starter')).getByRole('button', { name: 'Who hasn’t picked Starter' }),
    );
    expect(said()).toContain('sc-3909');

    await menu('picksAllClosedReadOnly');
    expect(screen.getByText('picks closed on Monday, Oct 19')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Who hasn’t picked/ })).toBeNull();
  });

  it('moves every date together when the reply-by date changes', SLOW, async () => {
    await menu('picksDateChanged');
    expect(screen.getByText('picks close Monday, Oct 19')).toBeTruthy();
    expect(
      await screen.findByText(
        '[Picks now close Friday, Oct 23. The event’s reply-by date moved from Monday, Oct 19.]',
        {},
        WAIT,
      ),
    ).toBeTruthy();
    expect(screen.getByText('picks close Friday, Oct 23')).toBeTruthy();
  });
});

describe('a default and a choose-by date (sc-1362)', () => {
  const group = (): HTMLElement =>
    within(panel()).getByRole('region', { name: /Default and choose-by date/ });
  const save = (): void => {
    fireEvent.click(within(panel()).getByRole('button', { name: CW.saveChanges }));
  };
  const chooseBy = (): HTMLInputElement => within(panel()).getByLabelText('Choose by');

  it('sets the pair in Edit course, and the card says when it is given', SLOW, async () => {
    await menu('defaultUnset');
    expect(within(group()).getByRole('radio', { name: 'No default' })).toHaveProperty(
      'checked',
      true,
    );
    fireEvent.click(within(group()).getByRole('radio', { name: 'Canapé selection' }));
    save();
    expect(document.activeElement?.id).toBe('mc-choose-by');
    expect(
      within(panel()).getByText('Enter a choose-by date, or set the default to No default.'),
    ).toBeTruthy();
    expect(chooseBy().getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(chooseBy(), { target: { value: '2026-10-16' } });
    save();
    expect(said()).toBe('Starter saved.');
    expect(
      within(card('Starter')).getByText(
        '[Default: Canapé selection. Given on Friday, Oct 16 to anyone coming who hasn’t answered.]',
      ),
    ).toBeTruthy();
  });

  it('refuses a date alone, naming Default, once the pair is cleared', SLOW, async () => {
    await menu('defaultSet');
    fireEvent.click(within(group()).getByRole('button', { name: 'Clear the default and date' }));
    expect(chooseBy().value).toBe('');
    fireEvent.change(chooseBy(), { target: { value: '2026-10-16' } });
    save();
    expect(document.activeElement?.id).toBe('mc-def-none');
    expect(
      within(panel()).getByText('Choose a default dish, or clear the choose-by date.'),
    ).toBeTruthy();
  });

  it('opens pressed states with focus on the first refusal', SLOW, async () => {
    await menu('defaultAfterEvent');
    expect(
      within(panel()).getByText('Choose a date before the event, Saturday, Nov 14.'),
    ).toBeTruthy();
    expect(document.activeElement?.id).toBe('mc-choose-by');

    await menu('defaultPast');
    expect(
      within(panel()).getByText('That date has passed. Choose today, Wednesday, Oct 14, or later.'),
    ).toBeTruthy();

    await menu('defaultChoiceUnanswered');
    expect(within(panel()).getByText('Answer “And a side?” for the default.')).toBeTruthy();
    expect(document.activeElement?.id).toBe('mc-def-o-c-side-c-side-plantain');
    fireEvent.click(within(group()).getByRole('radio', { name: 'Plantain' }));
    expect(within(panel()).queryByText('Answer “And a side?” for the default.')).toBeNull();
  });

  it('asks a whole pick: Everyone variants, and checkboxes for two', SLOW, async () => {
    await menu('defaultWholePick');
    expect(within(group()).getByRole('radio', { name: 'Chicken' })).toHaveProperty('checked', true);
    expect(within(group()).queryByRole('radio', { name: 'Children’s portion' })).toBeNull();
    expect(
      within(group()).getByText('[Children only variants can’t be the default.]'),
    ).toBeTruthy();
    fireEvent.click(within(group()).getByRole('radio', { name: 'Jollof rice' }));
    fireEvent.click(within(group()).getByRole('checkbox', { name: 'Plantain' }));
    save();
    expect(within(panel()).getByText('Choose 2 for “Two sides?”.')).toBeTruthy();
    fireEvent.click(within(group()).getByRole('checkbox', { name: 'Moi moi' }));
    save();
    expect(said()).toBe('Main saved.');
    expect(
      within(card('Main')).getByText(/Default: Jollof rice, Plantain, Moi moi\./),
    ).toBeTruthy();
  });

  it('locks the date after it passes and asks before moving guests', SLOW, async () => {
    await menu('defaultAfterDate');
    expect(within(group()).queryByRole('radio', { name: 'No default' })).toBeNull();
    expect(
      within(group()).getByText('[Friday, Oct 16 has passed, so the date is locked.]'),
    ).toBeTruthy();
    expect(within(panel()).queryByLabelText('Choose by')).toBeNull();
    expect(
      within(group()).queryByRole('button', { name: 'Clear the default and date' }),
    ).toBeNull();
    expect(within(card('Starter')).getByText(/to 23 guests who hadn’t answered/)).toBeTruthy();

    await menu('defaultMove');
    const dialog = screen.getByRole('alertdialog', {
      name: 'Move 21 guests to Beef suya skewers?',
    });
    expect(document.activeElement?.textContent).toBe('Cancel');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(group()).getByRole('radio', { name: 'Beef suya skewers' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(card('Starter')).getByText(/Default: Canapé selection\./)).toBeTruthy();
    save();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Move 21 guests' }),
    );
    expect(said()).toBe('[21 guests moved to Beef suya skewers. 2 are back to not chosen.]');
    expect(
      within(card('Starter')).getByText(
        '[Default: Beef suya skewers. Given on Friday, Oct 16 to 21 guests who hadn’t answered.]',
      ),
    ).toBeTruthy();

    await menu('defaultMoveNone');
    expect(screen.queryByRole('alertdialog', { name: /Move 0 guests/ })).toBeNull();
    const none = screen.getByRole('alertdialog', {
      name: '[Change the default to Beef suya skewers?]',
    });
    fireEvent.click(within(none).getByRole('button', { name: '[Change the default]' }));
    expect(said()).toBe('[The default is now Beef suya skewers. 4 are back to not chosen.]');
    expect(
      within(card('Starter')).getByText(
        '[Default: Beef suya skewers. Nobody who hadn’t answered by Friday, Oct 16 has it.]',
      ),
    ).toBeTruthy();
  });

  it('refuses Remove… on the default’s dish, variant and option', SLOW, async () => {
    await menu('defaultRemoveDish');
    expect(
      within(card('Starter')).getByText(
        '[Canapé selection is Starter’s default. Choose another default first, in Edit course.]',
      ),
    ).toBeTruthy();

    await menu('defaultRemoveVariant');
    expect(
      within(card('Main')).getByText(
        '[Chicken is Main’s default variant. Choose another default first, in Edit course.]',
      ),
    ).toBeTruthy();

    await menu('defaultRemoveOption');
    expect(
      within(panel()).getByText(
        '[Plantain is part of Main’s default. Choose another default first, in Edit course.]',
      ),
    ).toBeTruthy();
  });

  it('shows no group on a course that asks nothing', SLOW, async () => {
    await menu('defaultAsksNothing');
    expect(
      within(panel()).queryByRole('region', { name: /Default and choose-by date/ }),
    ).toBeNull();
  });
});
