import {
  type DishProblems,
  type VariantProblems,
  blankDishForm,
  blankVariantForm,
} from '@soirely/domain';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DishFields } from './DishParts.tsx';
import { VariantFields } from './VariantParts.tsx';

const DISH_BLANK: DishProblems = {
  name: 'blank',
  description: null,
  contains: 'blank',
  clashes: [],
  currency: null,
  amount: null,
};

const VARIANT_BLANK: VariantProblems = {
  name: 'blank',
  for: null,
  contains: 'blank',
  clashes: [],
  currency: null,
  amount: null,
};

function description(element: HTMLElement): string[] {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? `missing #${id}`);
}

describe('the fields a dish and its variants share', () => {
  it("draws the dish's name to 120, its own help and its own words when blank", () => {
    render(
      <DishFields
        form={blankDishForm('NGN')}
        problems={DISH_BLANK}
        notStated={false}
        editing={null}
        prices={false}
        language="en"
        onPatch={() => {}}
      />,
    );

    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name.id).toBe('lib-name');
    expect(description(name)).toEqual(['0 of 120', 'Enter the dish’s name.']);

    const contains = screen.getByRole('group', { name: 'Contains' });
    expect(description(contains)).toEqual([
      'Tick each allergen in the dish, as the 14 of food law name them.',
      'Tick what it contains, or Contains none of these.',
    ]);
  });

  it("draws a variant's name to 60, its own help and its own words when blank", () => {
    render(
      <VariantFields
        mode="add"
        dish={{ name: 'Jollof rice', allergens: [], diets: [] }}
        forms={[blankVariantForm('NGN')]}
        problems={[VARIANT_BLANK]}
        where="library"
        prices={false}
        language="en"
        onPatch={() => {}}
      />,
    );

    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name.id).toBe('vb0-name');
    expect(description(name)).toEqual(['0 of 60', 'Enter the variant’s name.']);

    const contains = screen.getByRole('group', { name: 'Contains' });
    expect(description(contains)).toEqual([
      'Tick every allergen in this variant, or Contains none of these.',
      'Tick what it contains, or Contains none of these.',
    ]);
  });
});
