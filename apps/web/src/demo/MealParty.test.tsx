import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { type PartyStateName, PW } from './mealParty.ts';
import { CW } from './menuCourses.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const CHIDI = 'Chidi Okonkwo-Williams';

async function party(state: PartyStateName, preview = false) {
  cleanup();
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/guest/meal?state=${state}${preview ? '&preview=1' : ''}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 2 }, WAIT);
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const radio = (name: string | RegExp) => fireEvent.click(screen.getByRole('radio', { name }));
const heading = () => screen.getByRole('heading', { level: 2 }).textContent ?? '';

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
});

describe('a meal for each person coming (sc-3907)', () => {
  it(
    'asks each person course by course, then lists every pick in Check and send',
    SLOW,
    async () => {
      await party('start');
      expect(screen.getByText('For you · Starter · 1 of 3')).toBeTruthy();
      expect(
        screen.getByRole('group', { name: 'For you, Starter, 1 of 3. Which starter?' }),
      ).toBeTruthy();
      expect(screen.getByText('Allergens not stated')).toBeTruthy();
      expect(screen.getByText('Contains none of the 14 allergens')).toBeTruthy();

      radio(/Pepper soup/);
      click(PW.next);
      radio(PW.letKitchen);
      click(PW.next);
      radio('No dessert for me');
      click(PW.next);
      expect(screen.getByText(`For ${CHIDI} · Starter · 1 of 3`)).toBeTruthy();
      radio(/Gizdodo/);
      click(PW.next);
      radio(/Grilled croaker/);
      click(PW.next);
      radio(/Coconut cake/);
      click(PW.next);

      expect(heading()).toBe(PW.check);
      const theirs = screen.getByRole('region', { name: `${CHIDI}’s meals` });
      expect(within(theirs).getByText('Grilled croaker')).toBeTruthy();
      const mine = screen.getByRole('region', { name: PW.yourMeals });
      expect(within(mine).getByText(PW.kitchenChooses)).toBeTruthy();
      expect(within(mine).getByText('[No dessert]')).toBeTruthy();

      click(PW.send);
      expect(screen.getByRole('status').textContent).toBe(PW.sent);
    },
  );

  it('refuses Next with nothing chosen, with focus on the first option', SLOW, async () => {
    await party('blankRefused');
    expect(screen.getByRole('alert').textContent).toContain(
      'Choose a starter for you, or let the kitchen choose.',
    );
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /Canapé selection/ }));
  });

  it(
    'greys a ruled-out dish with its reason in its name, and says the host can help',
    SLOW,
    async () => {
      await party('ruledOut');
      const canape = screen.getByRole('radio', { name: /Canapé selection/ }) as HTMLInputElement;

      expect(canape.disabled).toBe(true);
      expect(canape.closest('label')?.textContent).toContain(
        `${CHIDI} is allergic to: peanuts, sesame.`,
      );
      expect(
        screen.getByRole('radio', { name: /Gizdodo/ }).closest('label')?.textContent,
      ).toContain(`The kitchen hasn’t said what’s in this, so it can’t be picked for ${CHIDI}.`);
      expect(
        screen.getAllByText(`The host can arrange a dish for ${CHIDI} with you.`),
      ).toHaveLength(1);
    },
  );

  it('records needs the host where nothing is safe, with no kitchen’s choice', SLOW, async () => {
    await party('nothingSafe');
    expect(
      screen.getByText(`None of these can be picked for ${CHIDI}. The host will be in touch.`),
    ).toBeTruthy();
    expect(screen.queryByRole('radio', { name: PW.letKitchen })).toBeNull();
    click(PW.next);
    radio(/Coconut cake/);
    click(PW.next);

    const theirs = screen.getByRole('region', { name: `${CHIDI}’s meals` });
    expect(within(theirs).getByText(PW.hostInTouch)).toBeTruthy();
  });

  it('keeps No dessert for me where nothing is safe on an optional course', SLOW, async () => {
    await party('nothingSafeOptional');
    expect(screen.queryByRole('radio', { name: PW.letKitchen })).toBeNull();
    expect(
      (screen.getByRole('radio', { name: 'No dessert for me' }) as HTMLInputElement).disabled,
    ).toBe(false);
  });

  it('says an Other allergy isn’t checked, on the first course only', SLOW, async () => {
    await party('otherAllergy');
    const line = `${CHIDI}’s kiwi allergy isn’t checked against the menu. The host will confirm.`;

    expect(screen.getByText(line)).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Gizdodo/ }) as HTMLInputElement).disabled).toBe(
      false,
    );
    radio(/Pepper soup/);
    click(PW.next);
    expect(screen.queryByText(line)).toBeNull();
  });

  it('clears a kept pick an allergy given since rules out, and says why', SLOW, async () => {
    await party('backPickCleared');
    expect(
      screen.getByText(
        `[Your pick for ${CHIDI}, Pounded yam and egusi, was cleared because it contains milk.]`,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Pounded yam/ })).toHaveProperty('disabled', true);
    click(PW.next);
    expect(screen.getByRole('alert').textContent).toContain(`Choose a main for ${CHIDI}`);
  });

  it('clears the pick on the way forward from the kitchen note', SLOW, async () => {
    await party('checkAndSend');
    click(PW.back);
    for (let at = 0; at < 6; at += 1) click(PW.back);
    expect(heading()).toBe(PW.kitchenTitle);
    click(`${CHIDI}: milk`);
    click(PW.next);
    for (let at = 0; at < 4; at += 1) click(PW.next);
    expect(screen.getByText(/was cleared because it contains milk/u)).toBeTruthy();
  });

  it('refuses to send a pick with an allergen, and focuses its Change', SLOW, async () => {
    await party('checkAllergyAdded');
    const change = screen.getByRole('button', { name: `Change main for ${CHIDI}` });

    expect(screen.getByText(`${CHIDI} is allergic to: milk.`)).toBeTruthy();
    click(PW.send);
    expect(screen.getByRole('alert').textContent).toContain(PW.marked(1));
    expect(document.activeElement).toBe(change);

    fireEvent.click(change);
    expect(screen.getByRole('radio', { name: /Pounded yam/ })).toHaveProperty('checked', false);
    click(PW.back);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: `Change main for ${CHIDI}` }),
    );

    await party('checkAllergyAddedTwo');
    click(PW.send);
    expect(screen.getByRole('alert').textContent).toContain(PW.marked(2));
  });

  it('marks a closed pick without refusing, and it is no change to send', SLOW, async () => {
    await party('closedAllergyAdded');
    expect(screen.getByText(PW.hostInTouchLine)).toBeTruthy();
    expect(screen.queryByRole('button', { name: `Change main for ${CHIDI}` })).toBeNull();
    expect(screen.getAllByText('Picks closed on Friday, Oct 16.')).toHaveLength(2);
    click(PW.sendChanges);
    expect(screen.getByRole('status').textContent).toBe(PW.nothingToSend);

    await party('closedAllergyAddedGuest');
    expect(screen.getAllByText(PW.notSent)).toHaveLength(1);
    click(PW.sendChanges);
    expect(screen.getByRole('status').textContent).toBe(PW.changesSaved);

    await party('closedAllergyAddedOpenToo');
    click(PW.sendChanges);
    expect(screen.getByRole('alert').textContent).toContain(PW.marked(1));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: `Change dessert for ${CHIDI}` }),
    );
  });

  it('coming back: a change is not sent until Send my changes', SLOW, async () => {
    await party('comingBack');
    expect(screen.getByText('[Saved. You can change them until Monday, Oct 19.]')).toBeTruthy();
    click(PW.sendChanges);
    expect(screen.getByRole('status').textContent).toBe(PW.nothingToSend);

    click(`Change starter for ${CHIDI}`);
    radio(/Gizdodo/);
    click(PW.next);
    expect(screen.getByText(PW.notSent)).toBeTruthy();
    click(PW.sendChanges);
    expect(screen.getByRole('status').textContent).toBe(PW.changesSaved);
    expect(screen.queryByText(PW.notSent)).toBeNull();
  });

  it('coming back with an allergy added refuses instead of nothing to send', SLOW, async () => {
    await party('comingBackAllergyAdded');
    click(PW.sendChanges);
    expect(screen.getByRole('alert').textContent).toContain(PW.marked(1));
    expect(screen.queryByText(PW.nothingToSend)).toBeNull();
  });

  it('previews with a banner, and Close preview saves nothing', SLOW, async () => {
    await party('checkAndSend', true);
    expect(screen.getByText(PW.preview)).toBeTruthy();
    expect(screen.queryByRole('button', { name: PW.send })).toBeNull();
    const actions = screen.getAllByRole('button', { name: PW.closePreview });
    expect(actions).toHaveLength(2);
    fireEvent.click(actions[actions.length - 1] as HTMLElement);
    await screen.findByRole('heading', { level: 1, name: CW.title }, WAIT);
    expect(document.getElementById('mc-said')?.textContent).toContain(CW.nothingSaved);
  });

  it('gives the band Close preview on the first meal screen too', SLOW, async () => {
    await party('start', true);
    fireEvent.click(screen.getByRole('button', { name: PW.closePreview }));
    await screen.findByRole('heading', { level: 1, name: CW.title }, WAIT);
  });
});

describe('Same as an earlier person (sc-17283)', () => {
  const TOM_STARTER = 'For Tom, Starter, 1 of 3. Which starter?';

  it(
    'shows one button per earlier person outside the dishes, with names that start with the label',
    SLOW,
    async () => {
      await party('sameAsTwo');
      const mine = screen.getByRole('button', { name: 'Same as mine, for Tom' });
      const chidi = screen.getByRole('button', { name: `Same as ${CHIDI}, for Tom` });

      expect(mine.textContent).toBe('Same as mine');
      expect(chidi.textContent).toBe(`Same as ${CHIDI}`);
      expect(
        within(screen.getByRole('group', { name: TOM_STARTER })).queryAllByRole('button'),
      ).toHaveLength(0);
    },
  );

  it(
    'copies what can be picked, asks the rest with its line, refuses it blank, then shows the card',
    SLOW,
    async () => {
      await party('sameAsTwo');
      click(`Same as ${CHIDI}, for Tom`);

      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
      expect(screen.getByText(`${CHIDI}’s main can’t be picked for Tom.`)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Same as/ })).toBeNull();
      click(PW.next);
      expect(screen.getByRole('alert').textContent).toContain(
        'Choose a main for Tom, or let the kitchen choose.',
      );
      radio(/Jollof rice/);
      click(PW.next);

      expect(heading()).toBe('For Tom');
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
      expect(
        screen.getByText(`Copied from ${CHIDI}. Change anything that should be different.`),
      ).toBeTruthy();
      expect(screen.getByText('Pepper soup')).toBeTruthy();
      expect(screen.getByText('Jollof rice')).toBeTruthy();
      expect(screen.getByText('[No dessert]')).toBeTruthy();
    },
  );

  it('uses the guest’s own wording and asks the first course without buttons', SLOW, async () => {
    await party('sameAsTwo');
    click('Same as mine, for Tom');

    expect(screen.getByRole('group', { name: TOM_STARTER })).toBeTruthy();
    expect(screen.getByText('Your starter can’t be picked for Tom.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Same as/ })).toBeNull();
  });

  it(
    'returns Change to the card, Back to the first course with the copy selected, and Continue on',
    SLOW,
    async () => {
      await party('copiedCard');
      click('Change main for Tom');
      click(PW.next);
      expect(heading()).toBe('For Tom');

      click(PW.back);
      expect((screen.getByRole('radio', { name: /Pepper soup/ }) as HTMLInputElement).checked).toBe(
        true,
      );
      expect(screen.getByRole('button', { name: 'Same as mine, for Tom' })).toBeTruthy();

      click(PW.next);
      expect(screen.queryByRole('button', { name: /^Same as/ })).toBeNull();
      click(PW.back);
      expect(screen.getByRole('button', { name: 'Same as mine, for Tom' })).toBeTruthy();
      click(PW.next);
      click(PW.next);
      click(PW.next);
      expect(heading()).toBe(PW.check);
    },
  );

  it(
    'goes straight to the card when everything copies, and Continue to the next person',
    SLOW,
    async () => {
      await party('copiedCardYours');
      expect(heading()).toBe(`For ${CHIDI}`);
      expect(screen.getByText(PW.copiedFrom({ key: 'me', name: '', you: true }))).toBeTruthy();
      click(PW.continue);
      expect(screen.getByRole('group', { name: TOM_STARTER })).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /^Same as/ })).toHaveLength(2);
    },
  );

  it(
    'never shows the buttons for the first person or on a course reached by Change',
    SLOW,
    async () => {
      await party('start');
      expect(screen.queryByRole('button', { name: /^Same as/ })).toBeNull();
      await party('checkAndSend');
      click(`Change starter for ${CHIDI}`);
      expect(screen.queryByRole('button', { name: /^Same as/ })).toBeNull();
    },
  );

  it('copies within Preview as guest and closes instead of sending', SLOW, async () => {
    await party('previewSameAs', true);
    click(`Same as mine, for ${CHIDI}`);
    expect(heading()).toBe(`For ${CHIDI}`);
    click(PW.continue);
    expect(heading()).toBe(PW.check);
    expect(screen.getAllByRole('button', { name: PW.closePreview })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: PW.send })).toBeNull();
  });
});

describe('the menu changed after you picked (sc-3913)', () => {
  const CHIDI_MAIN = `For ${CHIDI}, Main, 1 of 1. ${PW.pickNew('Main')}`;
  const SEA_BASS = `[${CHIDI} picked Sea bass, which is no longer on the menu.]`;

  it(
    'asks only the changed course, keeps the pick by name, and sends the new one',
    SLOW,
    async () => {
      await party('menuChanged');
      expect(screen.getByRole('group', { name: CHIDI_MAIN })).toBeTruthy();
      expect(screen.getByText(`For ${CHIDI} · Main · 1 of 1`)).toBeTruthy();
      expect(screen.getByText(SEA_BASS)).toBeTruthy();
      expect(screen.queryByRole('radio', { name: /Sea bass/ })).toBeNull();
      expect(screen.getByRole('radio', { name: PW.letKitchen })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Same as/ })).toBeNull();

      click(PW.next);
      expect(screen.getByRole('alert').textContent).toContain(
        `Choose a main for ${CHIDI}, or let the kitchen choose.`,
      );
      radio(/Grilled croaker/);
      click(PW.next);

      expect(heading()).toBe(PW.yourPicks);
      const theirs = screen.getByRole('region', { name: `${CHIDI}’s meals` });
      expect(within(theirs).getByText('Grilled croaker')).toBeTruthy();
      expect(within(theirs).getAllByText(PW.notSent)).toHaveLength(1);
      click(PW.sendChanges);
      expect(screen.getByRole('status').textContent).toBe(PW.changesSaved);
    },
  );

  it('walks only the changed courses of only the people they changed', SLOW, async () => {
    await party('menuChangedTwo');
    expect(screen.getByText('For you · Starter · 1 of 2')).toBeTruthy();
    expect(
      screen.getByText('You picked Suya skewers, which is no longer on the menu.'),
    ).toBeTruthy();
    radio(/Pepper soup/);
    click(PW.next);
    expect(screen.getByText(`For ${CHIDI} · Starter · 2 of 2`)).toBeTruthy();
    click(PW.back);
    expect(screen.getByText('For you · Starter · 1 of 2')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Pepper soup/ })).toHaveProperty('checked', true);
    click(PW.next);
    radio(PW.letKitchen);
    click(PW.next);
    expect(heading()).toBe(PW.yourPicks);
  });

  it('words a dish that now comes in ways, and one whose choices changed', SLOW, async () => {
    await party('menuChangedWays');
    expect(
      screen.getByText(`[${CHIDI} picked Pounded yam and egusi, which now comes 2 ways.]`),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Pounded yam and egusi/ })).toHaveProperty(
      'checked',
      false,
    );
    await party('menuChangedChoices');
    expect(screen.getByText('You picked Jollof rice, and its choices have changed.')).toBeTruthy();
    expect(heading()).toContain(PW.pickNew('Main'));
  });

  it('refuses Send my changes while a pick is still Menu changed', SLOW, async () => {
    await party('menuChangedCheck');
    const theirs = screen.getByRole('region', { name: `${CHIDI}’s meals` });
    expect(within(theirs).getByText(PW.menuChanged)).toBeTruthy();
    expect(within(theirs).getByText(SEA_BASS)).toBeTruthy();
    click(PW.sendChanges);
    expect(screen.getByRole('alert').textContent).toContain(PW.changedOpen(1));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: `Change main for ${CHIDI}` }),
    );
  });

  it('leaves a closed course to the host, without refusing the send', SLOW, async () => {
    await party('menuChangedClosed');
    expect(heading()).toBe(PW.yourPicks);
    const theirs = screen.getByRole('region', { name: `${CHIDI}’s meals` });
    expect(within(theirs).getByText(PW.menuChanged)).toBeTruthy();
    expect(within(theirs).getByText(PW.hostInTouchLine)).toBeTruthy();
    expect(within(theirs).queryByRole('button', { name: `Change main for ${CHIDI}` })).toBeNull();
    click(PW.sendChanges);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(PW.nothingToSend);
  });
});
