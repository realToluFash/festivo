import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { CHW } from './dishChoices.ts';
import { resetSample } from './events.ts';
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

const panel = (): HTMLElement => screen.getByRole('complementary');
const said = (): string => document.getElementById('mc-said')?.textContent ?? '';
const byId = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const type = (id: string, value: string) => fireEvent.change(byId(id), { target: { value } });

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('choices on the event Menu (sc-3904)', () => {
  it(
    'reads each choice under its dish, with Kitchen prep once guests have picked',
    SLOW,
    async () => {
      await menu('choices');

      expect(screen.getByText(CHW.plusOptions)).toBeTruthy();
      expect(screen.getByText('Guests pick exactly 1 of 3 options · Required')).toBeTruthy();
      expect(screen.getByText(CHW.prep('41 plantain, 33 garden salad, 12 moi moi'))).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add a choice to Coconut rice' })).toBeTruthy();
    },
  );

  it('adds a choice, and saves an unfinished one as a draft', SLOW, async () => {
    await menu('addChoice');

    expect(within(panel()).getByText(CHW.willBe(1))).toBeTruthy();
    type('ch-question', 'And a side?');
    const [first] = panel().querySelectorAll<HTMLInputElement>('input[id$="-name"]');
    type(first?.id ?? '', 'Plantain');
    fireEvent.click(screen.getAllByRole('button', { name: CHW.setAllergens })[0] as HTMLElement);
    fireEvent.click(panel().querySelector('input[id$="-none"]') as HTMLElement);
    expect(within(panel()).getByText(CHW.draftBox(0))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: CHW.saveDraft }));

    expect(said()).toContain('saved as a draft');
    expect(screen.getByText(CHW.notOffered)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish “And a side?”' })).toBeTruthy();
  });

  it('refuses the same name twice before sending', SLOW, async () => {
    await menu('addChoiceDuplicate');

    expect(within(panel()).getByText(CHW.nameTwice)).toBeTruthy();
    expect(screen.queryByText(CHW.draftBox(0))).toBeNull();
  });

  it('refuses a 9th option', SLOW, async () => {
    await menu('optionsLimit');

    fireEvent.click(byId('ch-add-option'));
    expect(within(panel()).getByText(CHW.optionsLimit)).toBeTruthy();
    expect(panel().querySelectorAll('input[id$="-name"]')).toHaveLength(8);
  });

  it('refuses Add a choice on a picked dish and a 4th choice', SLOW, async () => {
    await menu('choices');

    fireEvent.click(screen.getByRole('button', { name: 'Add a choice to Jollof rice' }));
    expect(byId('mc-chrow-k2-jollof').textContent).toContain(CHW.dishPicked);
    expect(screen.queryByRole('complementary')).toBeNull();

    await menu('choicesAtLimit');
    expect(byId('mc-chrow-k2-jollof').textContent).toContain(CHW.choicesLimit);
  });

  it(
    'asks before removing a choice nobody answered, and refuses an answered one',
    SLOW,
    async () => {
      await menu('choices');

      fireEvent.click(screen.getByRole('button', { name: 'Remove “And a side?”…' }));
      expect(byId('mc-chline-c-side').textContent).toContain(CHW.answered);
      expect(
        screen
          .getByRole('button', { name: 'Remove “And a side?”…' })
          .getAttribute('aria-describedby'),
      ).toBe('mc-chline-c-side');

      fireEvent.click(screen.getByRole('button', { name: 'Remove “And a sauce?”…' }));
      fireEvent.click(screen.getByRole('button', { name: CHW.removeChoice }));
      expect(said()).toContain(CHW.removed('And a sauce?', 'Jollof rice'));
    },
  );

  it(
    'refuses each change that would leave an answer outside an answered choice',
    SLOW,
    async () => {
      await menu('editPickedOption');
      expect(within(panel()).getByText(CHW.optionPicked)).toBeTruthy();
      const line = within(panel()).getByText(CHW.optionPicked).closest('[id]');
      expect(
        panel().querySelector(`[aria-describedby="${line?.id ?? ''}"][id$="-bin"]`),
      ).toBeTruthy();

      await menu('editCountAnswered');
      expect(byId('ch-pick-error').textContent).toContain(CHW.answered);
      expect(document.activeElement?.id).toBe('ch-fewer');
      fireEvent.click(byId('ch-fewer'));
      expect(document.getElementById('ch-pick-error')).toBeNull();

      await menu('editAnsweredDraft');
      expect(within(panel()).getByText(CHW.answeredDraft)).toBeTruthy();
      expect(screen.getByRole('button', { name: CHW.saveChoice })).toBeTruthy();
    },
  );

  it('says who picked an option an allergen was added to', SLOW, async () => {
    await menu('editChoiceAllergensTwo');

    expect(said()).toContain(CHW.saved('And a side?'));
    expect(said()).toContain('2 guests who picked Garden salad have celery recorded');
    expect(said()).toContain('3 guests who picked Moi moi have crustaceans recorded');
  });

  it('keeps a set course, and shows a course of drafts as not ready', SLOW, async () => {
    await menu('setCourseChoices');
    expect(screen.getAllByText(CHW.answerChoices('Short rib')).length).toBeGreaterThan(0);

    await menu('courseOfDrafts');
    expect(screen.getByText(CHW.noFinishedDish)).toBeTruthy();
    expect(screen.getByText('2 of 4 courses ready')).toBeTruthy();
    expect(screen.getByText('2 of 4 ready')).toBeTruthy();

    await menu('courseOneFinished');
    expect(screen.queryByText(CHW.noFinishedDish)).toBeNull();
  });

  it('reads variants first, then choices that apply to every variant', SLOW, async () => {
    await menu('variantsAndChoices');

    expect(screen.getByText(CHW.variantsHead)).toBeTruthy();
    expect(screen.getByText(CHW.choicesHead)).toBeTruthy();
    expect(screen.getByText(CHW.everyVariant)).toBeTruthy();
    expect(screen.getByText(CHW.acrossVariants(2))).toBeTruthy();
  });
});
