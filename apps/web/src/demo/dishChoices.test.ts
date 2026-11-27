import { describe, expect, it } from 'vitest';

import {
  CHW,
  type ChoiceForm,
  addChoiceOutcome,
  blankChoice,
  blankOption,
  checkChoice,
  choiceForm,
  courseHint,
  dishHidden,
  draftChoice,
  draftReasons,
  firstChoiceProblem,
  hasProblem,
  kitchenPrep,
  optionAllergenLines,
  optionalSide,
  pickMax,
  removeChoiceOutcome,
  sauceChoice,
  savedChoice,
  savesAsDraft,
  sideChoice,
  stepperHint,
  thirdChoice,
  withSavedChoice,
} from './dishChoices.ts';
import { jollofVariants, twoWays } from './dishVariants.ts';
import { LW } from './menuLibrary.ts';

const dish = (more = {}) => ({
  name: 'Jollof rice',
  contains: ['celery'] as const,
  diets: [],
  pickers: [],
  ...more,
});

function filled(names: readonly string[], more: Partial<ChoiceForm> = {}): ChoiceForm {
  return {
    ...blankChoice(),
    question: 'And a side?',
    options: names.map((name) => ({ ...blankOption(), name, none: true })),
    ...more,
  };
}

describe('a choice’s limits (sc-3904)', () => {
  it('takes a question of at most 80 and option names of at most 60', () => {
    expect(checkChoice(filled(['A', 'B'], { question: 'x'.repeat(80) }), null).question).toBeNull();
    expect(checkChoice(filled(['A', 'B'], { question: 'x'.repeat(81) }), null).question).toBe(
      CHW.questionLong,
    );
    const long = checkChoice(filled(['A', 'x'.repeat(61)]), null);
    expect(long.options[1]?.name).toBe(CHW.nameLong);
  });

  it('refuses two options with the same name, ignoring case and spaces', () => {
    const errors = checkChoice(filled(['Plantain', ' plantain ']), null);
    expect(errors.options[0]?.name).toBeNull();
    expect(errors.options[1]?.name).toBe(CHW.nameTwice);
  });

  it('asks every named option for its allergens', () => {
    const form = filled(['Plantain', 'Garden salad']);
    const unanswered = { ...form, options: form.options.map((one) => ({ ...one, none: false })) };
    const errors = checkChoice(unanswered, null);
    expect(errors.options[0]?.contains).toBe(LW.containsBlank);
    expect(firstChoiceProblem(errors, unanswered, null)?.open).toBe(unanswered.options[0]?.key);
  });

  it('keeps Guests pick exactly between 1 and the named options minus one', () => {
    expect(pickMax(filled(['A', 'B', 'C']))).toBe(2);
    expect(stepperHint(filled(['A', 'B', 'C']))).toBe(CHW.pickRange(3, 2));
    expect(stepperHint(filled(['A']))).toBe(CHW.pickShort(1));
  });

  it('refuses a 4th choice before the picks, and a choice on a picked dish', () => {
    expect(addChoiceOutcome(dish({ choices: [sauceChoice()] }))).toBe('open');
    expect(addChoiceOutcome(dish({ choices: [sideChoice()] }))).toBe('picked');
    expect(addChoiceOutcome(dish({ pickers: [[]] }))).toBe('picked');
    expect(
      addChoiceOutcome(dish({ choices: [sideChoice(false), sauceChoice(), thirdChoice()] })),
    ).toBe('limit');
    expect(addChoiceOutcome(dish({ variants: jollofVariants() }))).toBe('picked');
  });
});

describe('a draft choice', () => {
  it('saves unfinished, with its reasons, and hides the dish', () => {
    const form = filled(['Plantain'], { question: '' });
    expect(savesAsDraft(form, null)).toBe(true);
    expect(hasProblem(checkChoice(form, null))).toBe(false);
    const saved = savedChoice(form, null);
    expect(draftReasons(saved)).toEqual([CHW.noQuestion, CHW.fewOptions]);
    expect(dishHidden({ choices: [saved] })).toBe(true);
    expect(dishHidden({ choices: [sideChoice()] })).toBe(false);
  });

  it('drops empty option blocks on save', () => {
    const form = { ...filled(['Plantain', 'Moi moi']), options: [] as ChoiceForm['options'] };
    const withEmpty = { ...form, options: [...filled(['A', 'B']).options, blankOption()] };
    expect(savedChoice(withEmpty, null).options).toHaveLength(2);
  });

  it('asks for more options when the pick count outgrows them', () => {
    expect(draftReasons({ question: 'Q', options: sideChoice().options, pick: 3 })).toEqual([
      CHW.pickTooMany(3),
    ]);
  });
});

describe('an answered choice, until sc-3913', () => {
  it('refuses Remove…, and asks when nobody has answered', () => {
    expect(removeChoiceOutcome(sideChoice())).toBe('answered');
    expect(removeChoiceOutcome(sauceChoice())).toBe('ask');
  });

  it('refuses a new count, focusing the stepper’s way back', () => {
    const was = sideChoice();
    const form = { ...choiceForm(was), pick: 2 };
    const errors = checkChoice(form, was);
    expect(errors.pick).toBe(CHW.answered);
    expect(firstChoiceProblem(errors, form, was)?.id).toBe('ch-fewer');
  });

  it('refuses Required turned on over None for me, and allows it off', () => {
    const was = optionalSide();
    expect(checkChoice({ ...choiceForm(was), required: true }, was).required).toBe(CHW.answered);
    const side = sideChoice();
    expect(hasProblem(checkChoice({ ...choiceForm(side), required: false }, side))).toBe(false);
  });

  it('keeps a picked option that was cleared, and refuses it', () => {
    const was = sideChoice();
    const form = choiceForm(was);
    const cleared = {
      ...form,
      options: form.options.map((one, at) =>
        at === 0 ? { ...one, name: '', none: false, allergens: [] } : one,
      ),
    };
    expect(checkChoice(cleared, was).options[0]?.picked).toBe(CHW.optionPicked);
  });

  it('can’t become a draft: no draft box, and Save refused with the reasons', () => {
    const was = sideChoice();
    const form = { ...choiceForm(was), question: '' };
    expect(savesAsDraft(form, was)).toBe(false);
    const errors = checkChoice(form, was);
    expect(errors.staysFinished).toEqual([CHW.noQuestion]);
    expect(firstChoiceProblem(errors, form, was)?.id).toBe('ch-question');
  });

  it('allows a new option and a new name', () => {
    const was = sideChoice();
    const form = choiceForm(was);
    const more = {
      ...form,
      question: 'And a side dish?',
      options: [
        ...form.options,
        { ...blankOption(), name: 'Coleslaw', allergens: ['eggs'] as const },
      ],
    };
    expect(hasProblem(checkChoice(more, was))).toBe(false);
  });
});

describe('allergens added to a picked option', () => {
  it('says how many who picked it have them recorded, one line per option', () => {
    const was = sideChoice();
    const form = choiceForm(was);
    const next = savedChoice(
      {
        ...form,
        options: form.options.map((one, at) =>
          at === 1
            ? { ...one, allergens: ['celery', 'mustard'] }
            : at === 2
              ? { ...one, allergens: ['crustaceans', 'eggs', 'milk'] }
              : one,
        ),
      },
      was,
    );
    expect(optionAllergenLines(was, next)).toEqual([
      '[2 guests who picked Garden salad have celery recorded, and nobody has told them.]',
      '[3 guests who picked Moi moi have crustaceans recorded, and nobody has told them.]',
    ]);
  });

  it('adds no line when an allergen is removed, or nobody counted has it', () => {
    const was = sideChoice();
    const form = choiceForm(was);
    const removed = savedChoice(
      { ...form, options: form.options.map((one) => ({ ...one, allergens: [], none: true })) },
      was,
    );
    expect(optionAllergenLines(was, removed)).toEqual([]);
    const sesame = savedChoice(
      {
        ...form,
        options: form.options.map((one, at) =>
          at === 2 ? { ...one, allergens: ['eggs', 'peanuts'] } : one,
        ),
      },
      was,
    );
    expect(optionAllergenLines(was, sesame)).toEqual([]);
  });
});

describe('Kitchen prep and the set course', () => {
  it('sums guests’ answers per option once somebody has picked', () => {
    expect(kitchenPrep(sideChoice())).toBe(CHW.prep('21 plantain, 16 garden salad, 8 moi moi'));
    expect(kitchenPrep(sauceChoice())).toBeNull();
  });

  it('hints that guests answer the choices, or pick the way', () => {
    expect(courseHint([dish({ choices: [sideChoice(false)] })])).toBe(
      CHW.answerChoices('Jollof rice'),
    );
    expect(courseHint([dish({ variants: twoWays(), choices: [sideChoice(false)] })])).toBe(
      'Everyone gets Jollof rice. Guests pick the way.',
    );
    expect(courseHint([dish()])).toBeNull();
  });

  it('confirms a save, a draft, and an addition', () => {
    const added = withSavedChoice(dish(), 'add', null, filled(['A', 'B']), 'en');
    expect(added.said).toBe(CHW.added('And a side?', 'Jollof rice'));
    const draft = withSavedChoice(dish(), 'add', null, filled(['A'], { question: '' }), 'en');
    expect(draft.said).toBe(CHW.draftSaved('Choice 1', 'Jollof rice'));
    expect(dishHidden({ choices: [draftChoice()] })).toBe(true);
  });
});
