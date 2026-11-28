import { DISH_ALLERGENS, type Dish } from '@soirely/api-client';
import { type DishForm, type DishProblems, type MoneyLanguage } from '@soirely/domain';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import {
  ContainsField,
  DescriptionField,
  DietsField,
  DishNameField,
  LastPriceField,
} from './MenuFields.tsx';

/** What a dish contains, as a shape with words: the red "!", the grey "0" or the dashed amber "?" (sc-3901). */
export function ContainsMark({ dish }: { dish: Pick<Dish, 'allergens'> }) {
  const { t } = useTranslation();
  const contains = dish.allergens;
  const kind = contains == null ? 'unknown' : contains.length === 0 ? 'none' : 'some';

  return (
    <p className={`lib-contains is-${kind}`}>
      <span className="lib-mark" aria-hidden="true">
        {kind === 'unknown' ? '?' : kind === 'none' ? '0' : '!'}
      </span>
      {contains == null
        ? t('menuLibrary.notStated')
        : contains.length === 0
          ? t('menuLibrary.containsNone')
          : t('menuLibrary.contains', {
              names: DISH_ALLERGENS.filter((code) => contains.includes(code))
                .map((code) => t(`guestNeeds.allergen.${code}`))
                .join(' · '),
            })}
    </p>
  );
}

export type ActionIcon = 'edit' | 'archive' | 'restore' | 'bin' | 'remove';

const ACTION_PATHS: Record<Exclude<ActionIcon, 'edit'>, readonly string[]> = {
  archive: ['M3 4h18v4H3z', 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8', 'M10 12h4'],
  restore: [
    'M3 4h18v4H3z',
    'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8',
    'M12 17v-6',
    'm9 13 3-3 3 3',
  ],
  bin: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
  remove: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M8 12h8'],
};

/** Archive, Restore, Delete… and Remove… have no glyph in the web's set; these are drawn in its 24 px stroke, each a different shape. */
export function ActionGlyph({ icon }: { icon: ActionIcon }) {
  if (icon === 'edit') return <Glyph name="pen" size={20} weight={2} />;

  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ACTION_PATHS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function DishFields({
  form,
  problems,
  notStated,
  editing,
  prices,
  language,
  beforePrice,
  containsHelp,
  onPatch,
}: {
  form: DishForm;
  problems: DishProblems | null;
  notStated: boolean;
  editing: Dish | null;
  prices: boolean;
  language: MoneyLanguage;
  /** Sits between Suitable for and Last price: the event's Only for this event (sc-3902). */
  beforePrice?: ReactNode;
  containsHelp?: string;
  onPatch: (next: Partial<DishForm>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <DishNameField
        value={form.name}
        problem={problems?.name ?? null}
        onChange={(name) => onPatch({ name })}
      />
      <DescriptionField
        value={form.description}
        problem={problems?.description ?? null}
        onChange={(description) => onPatch({ description })}
      />
      <ContainsField
        prefix="lib-"
        help={containsHelp ?? t('menuLibrary.containsHelp')}
        allergens={form.allergens}
        none={form.none}
        notStated={notStated}
        wrong={problems?.contains != null}
        onChange={onPatch}
      />
      <DietsField
        prefix="lib-"
        diets={form.diets}
        clashes={problems?.clashes ?? []}
        onChange={(diets) => onPatch({ diets })}
      />
      {beforePrice}
      {prices && (
        <LastPriceField
          prefix="lib-"
          currency={form.currency}
          amount={form.amount}
          held={editing?.lastPrice?.currency ?? ''}
          problems={problems}
          language={language}
          onChange={onPatch}
        />
      )}
      {editing != null && <p className="lib-own-copy">{t('menuLibrary.ownCopy')}</p>}
    </>
  );
}
