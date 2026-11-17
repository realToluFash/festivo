import type { MenuDishChoice } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  type ChoiceForm,
  addChoiceOutcome,
  blankChoiceForm,
  blankOptionForm,
  choiceDetailsOf,
  choiceFormOf,
  choiceProblems,
  courseReady,
  draftReasons,
  firstChoiceProblem,
  formDraftReasons,
  guestsAnswerItsChoices,
  hasChoiceProblem,
  pickMax,
  removeChoiceOutcome,
  savesAsDraft,
} from './dishChoices.ts';

const option = (name: string, more: Partial<ReturnType<typeof blankOptionForm>> = {}) => ({
  ...blankOptionForm(),
  name,
  none: true,
  ...more,
});

const form = (more: Partial<ChoiceForm>): ChoiceForm => ({
  ...blankChoiceForm(),
  question: 'And a side?',
  options: [option('Plantain'), option('Moi moi')],
  ...more,
});

const side = (more: Partial<MenuDishChoice> = {}): MenuDishChoice => ({
  id: 'c_side',
  question: 'And a side?',
  pick: 1,
  required: true,
  draft: false,
  noneAnswers: 0,
  options: [
    { id: 'o_plantain', name: 'Plantain', allergens: [], picks: 0 },
    { id: 'o_moimoi', name: 'Moi moi', allergens: ['eggs'], picks: 0 },
  ],
  ...more,
});

const answered = (): MenuDishChoice => {
  const choice = side();

  return {
    ...choice,
    options: choice.options.map((one, at) => (at === 1 ? { ...one, picks: 3 } : one)),
  };
};

const dish = (choices: MenuDishChoice[], picked = false) => ({
  picked,
  variants: [],
  choices,
});

describe('draftReasons', () => {
  it('says what a draft lacks, the pick only once it asks for more than the options give', () => {
    expect(draftReasons({ question: ' ', options: [], pick: 1 })).toEqual([
      { kind: 'question' },
      { kind: 'options' },
    ]);
    expect(draftReasons({ question: 'Sides', options: [1, 2], pick: 2 })).toEqual([
      { kind: 'pick', pick: 2 },
    ]);
    expect(draftReasons({ question: 'Sides', options: [1, 2, 3], pick: 2 })).toEqual([]);
  });

  it('drops empty blocks from what the form would save', () => {
    const empty = form({ options: [option('Plantain'), { ...blankOptionForm() }] });

    expect(formDraftReasons(empty, null)).toEqual([{ kind: 'options' }]);
    expect(savesAsDraft(empty, null)).toBe(true);
    expect(choiceDetailsOf(empty, null).options).toEqual([
      { name: 'Plantain', allergens: [], containsNone: true },
    ]);
  });
});

describe('choiceProblems', () => {
  it('refuses a blank, long or repeated name and an option without its Contains', () => {
    const problems = choiceProblems(
      form({
        options: [
          option('', { allergens: ['eggs'], none: false }),
          option('x'.repeat(61)),
          option('Plantain'),
          option('plantain'),
          option('Beans', { none: false }),
        ],
      }),
      null,
    );

    expect(problems.options.map((one) => one.name)).toEqual(['blank', 'long', null, 'taken', null]);
    expect(problems.options[4]?.contains).toBe('blank');
  });

  it('keeps an answered choice finished, its pick, and Required while someone has None for me', () => {
    const was = { ...answered(), required: false, noneAnswers: 2 };
    const problems = choiceProblems(
      { ...choiceFormOf(was), question: '', pick: 2, required: true },
      was,
    );

    expect(problems.pick).toBe(true);
    expect(problems.required).toBe(true);
    expect(problems.staysFinished).toEqual([{ kind: 'question' }, { kind: 'pick', pick: 2 }]);
    expect(savesAsDraft({ ...choiceFormOf(was), question: '' }, was)).toBe(false);
  });

  it('refuses clearing a picked option, and points at it first', () => {
    const was = answered();
    const cleared = choiceFormOf(was);
    const options = cleared.options.map((one, at) =>
      at === 1 ? { ...one, name: '', allergens: [], none: false } : one,
    );
    const next = { ...cleared, options };
    const problems = choiceProblems(next, was);

    expect(problems.options[1]?.picked).toBe(true);
    expect(hasChoiceProblem(problems)).toBe(true);
    expect(firstChoiceProblem(problems, next, was)?.id).toBe(`ch-${options[1]?.key ?? ''}-name`);
  });

  it('lets an unanswered choice change anything', () => {
    const was = side();

    expect(
      hasChoiceProblem(choiceProblems({ ...choiceFormOf(was), pick: 1, required: false }, was)),
    ).toBe(false);
  });
});

describe('the stepper and the buttons', () => {
  it('stops + at the named options minus one', () => {
    expect(pickMax(form({}))).toBe(1);
    expect(pickMax(form({ options: [option('A'), option('B'), option('C'), option('')] }))).toBe(2);
  });

  it('refuses a fourth choice before a picked dish, and Remove… on an answered choice', () => {
    expect(addChoiceOutcome(dish([side(), side(), side()], true))).toBe('limit');
    expect(addChoiceOutcome(dish([answered()]))).toBe('picked');
    expect(addChoiceOutcome(dish([side()]))).toBe('open');
    expect(removeChoiceOutcome(answered())).toBe('answered');
    expect(removeChoiceOutcome(side({ noneAnswers: 1 }))).toBe('answered');
    expect(removeChoiceOutcome(side())).toBe('ask');
  });
});

describe('the course', () => {
  it('is ready only with a dish guests are offered', () => {
    expect(courseReady({ dishes: [{ offered: false }] })).toBe(false);
    expect(courseReady({ dishes: [{ offered: false }, { offered: true }] })).toBe(true);
  });

  it('asks only the choices of its one dish under Everyone gets the same', () => {
    expect(guestsAnswerItsChoices([{ choices: [side()] }])).toBe(true);
    expect(guestsAnswerItsChoices([{ choices: [] }])).toBe(false);
    expect(guestsAnswerItsChoices([{ choices: [side()] }, { choices: [] }])).toBe(false);
  });
});
