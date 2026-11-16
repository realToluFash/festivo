import {
  DISH_ALLERGENS,
  DISH_DESCRIPTION_MAXIMUM,
  DISH_DIETS,
  DISH_NAME_MAXIMUM,
  type Dish,
  type DishAllergen,
} from '@soirely/api-client';
import {
  type DishForm,
  type DishProblems,
  type MoneyLanguage,
  amountExample,
  dishLength,
} from '@soirely/domain';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { currencyCodeChoices } from '../../../zoneAndCurrencyChoices.ts';
import { describedBy } from '../events/eventFieldOrder.ts';

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

export function Wrong({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
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
  onPatch: (next: Partial<DishForm>) => void;
}) {
  const { t, i18n } = useTranslation();
  const nameLength = dishLength(form.name);
  const descLength = dishLength(form.description);
  const clashing = new Set(problems?.clashes.map((one) => one.diet) ?? []);
  const optional = <span className="gs-optional">{t('menuLibrary.optional')}</span>;
  const held = editing?.lastPrice?.currency ?? '';

  return (
    <>
      <div className="desk-field">
        <label htmlFor="lib-name" className="desk-label gs-label">
          {t('menuLibrary.name')}
        </label>
        <div className={problems?.name == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id="lib-name"
            type="text"
            value={form.name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={problems?.name != null}
            aria-describedby={describedBy(
              'lib-name-count',
              problems?.name == null ? null : 'lib-name-error',
            )}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id="lib-name-count"
          className={nameLength > DISH_NAME_MAXIMUM ? 'lib-counter is-over' : 'lib-counter'}
        >
          {t('menuLibrary.counter', { count: nameLength, most: DISH_NAME_MAXIMUM })}
        </p>
        {problems?.name != null && (
          <Wrong id="lib-name-error">
            {problems.name === 'blank'
              ? t('menuLibrary.nameBlank')
              : t('menuLibrary.nameLong', { most: DISH_NAME_MAXIMUM })}
          </Wrong>
        )}
      </div>
      <div className="desk-field">
        <label htmlFor="lib-desc" className="desk-label gs-label">
          {t('menuLibrary.desc')}
          {optional}
        </label>
        <div
          className={
            problems?.description == null ? 'desk-box lib-area' : 'desk-box lib-area is-wrong'
          }
        >
          <textarea
            id="lib-desc"
            rows={3}
            value={form.description}
            aria-invalid={problems?.description != null}
            aria-describedby={describedBy(
              'lib-desc-count',
              problems?.description == null ? null : 'lib-desc-error',
            )}
            onChange={(event) => onPatch({ description: event.target.value })}
          />
        </div>
        <p
          id="lib-desc-count"
          className={descLength > DISH_DESCRIPTION_MAXIMUM ? 'lib-counter is-over' : 'lib-counter'}
        >
          {t('menuLibrary.counter', { count: descLength, most: DISH_DESCRIPTION_MAXIMUM })}
        </p>
        {problems?.description != null && (
          <Wrong id="lib-desc-error">
            {t('menuLibrary.descLong', { most: DISH_DESCRIPTION_MAXIMUM })}
          </Wrong>
        )}
      </div>
      <fieldset
        className="lib-set"
        aria-describedby={describedBy(
          'lib-contains-help',
          problems?.contains == null ? null : 'lib-contains-error',
        )}
        aria-invalid={problems?.contains != null || undefined}
      >
        <legend className="desk-label gs-label">{t('menuLibrary.containsLegend')}</legend>
        <p id="lib-contains-help" className="desk-help">
          {t('menuLibrary.containsHelp')}
        </p>
        {notStated && form.allergens.length === 0 && !form.none && (
          <p className="lib-contains is-unknown lib-not-stated">
            <span className="lib-mark" aria-hidden="true">
              ?
            </span>
            {t('menuLibrary.notStatedLine')}
          </p>
        )}
        <div className="lib-ticks">
          {DISH_ALLERGENS.map((code: DishAllergen) => (
            <label key={code} className="gs-tick lib-tick">
              <input
                id={`lib-has-${code}`}
                type="checkbox"
                className="gs-box"
                checked={form.allergens.includes(code)}
                onChange={() =>
                  onPatch({
                    none: false,
                    allergens: form.allergens.includes(code)
                      ? form.allergens.filter((one) => one !== code)
                      : DISH_ALLERGENS.filter(
                          (one) => one === code || form.allergens.includes(one),
                        ),
                  })
                }
              />
              {t(`guestNeeds.allergen.${code}`)}
            </label>
          ))}
        </div>
        <label className="gs-tick lib-tick lib-none-tick">
          <input
            id="lib-none"
            type="checkbox"
            className="gs-box"
            checked={form.none}
            onChange={() => onPatch({ none: !form.none, allergens: [] })}
          />
          {t('menuLibrary.none')}
        </label>
        {problems?.contains != null && (
          <Wrong id="lib-contains-error">{t('menuLibrary.containsBlank')}</Wrong>
        )}
      </fieldset>
      <fieldset
        className="lib-set"
        aria-describedby={clashing.size > 0 ? 'lib-diets-error' : undefined}
      >
        <legend className="desk-label gs-label">
          {t('menuLibrary.dietsLegend')}
          {optional}
        </legend>
        <div className="lib-ticks">
          {DISH_DIETS.map((diet) => (
            <label key={diet} className="gs-tick lib-tick">
              <input
                id={`lib-diet-${diet}`}
                type="checkbox"
                className="gs-box"
                checked={form.diets.includes(diet)}
                aria-invalid={clashing.has(diet) || undefined}
                onChange={() =>
                  onPatch({
                    diets: form.diets.includes(diet)
                      ? form.diets.filter((one) => one !== diet)
                      : DISH_DIETS.filter((one) => one === diet || form.diets.includes(one)),
                  })
                }
              />
              {t(`guestNeeds.dietName.${diet}`)}
            </label>
          ))}
        </div>
        {problems != null && problems.clashes.length > 0 && (
          <div id="lib-diets-error" className="lib-clashes">
            {problems.clashes.map((one) => (
              <Wrong key={one.diet} id={`lib-clash-${one.diet}`}>
                {t(`menuLibrary.clash.${one.clash}`)}
              </Wrong>
            ))}
          </div>
        )}
      </fieldset>
      {beforePrice}
      {prices && (
        <fieldset className="lib-set" aria-describedby="lib-price-help">
          <legend className="desk-label gs-label">
            {t('menuLibrary.price')}
            {optional}
          </legend>
          <div className="lib-price">
            <div className="desk-field lib-currency">
              <label htmlFor="lib-currency" className="desk-unseen">
                {t('menuLibrary.currency')}
              </label>
              <div className={problems?.currency == null ? 'desk-box' : 'desk-box is-wrong'}>
                <select
                  id="lib-currency"
                  value={form.currency}
                  aria-invalid={problems?.currency != null}
                  aria-describedby={problems?.currency == null ? undefined : 'lib-currency-error'}
                  onChange={(event) => onPatch({ currency: event.target.value })}
                >
                  {currencyCodeChoices(held, form.currency, i18n.language, t).map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="desk-field lib-amount">
              <label htmlFor="lib-amount" className="desk-unseen">
                {t('menuLibrary.amount')}
              </label>
              <div className={problems?.amount == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id="lib-amount"
                  type="text"
                  inputMode="decimal"
                  lang={language}
                  value={form.amount}
                  autoComplete="off"
                  aria-invalid={problems?.amount != null}
                  aria-describedby={problems?.amount == null ? undefined : 'lib-amount-error'}
                  onChange={(event) => onPatch({ amount: event.target.value })}
                />
              </div>
            </div>
          </div>
          {problems?.currency != null && (
            <Wrong id="lib-currency-error">{t('orgGeneral.currencyBlank')}</Wrong>
          )}
          {problems?.amount != null && (
            <Wrong id="lib-amount-error">
              {t('menuLibrary.priceWrong', { example: amountExample(language, form.currency) })}
            </Wrong>
          )}
          <p id="lib-price-help" className="desk-help">
            {t('menuLibrary.priceHint')}
          </p>
        </fieldset>
      )}
      {editing != null && <p className="lib-own-copy">{t('menuLibrary.ownCopy')}</p>}
    </>
  );
}
