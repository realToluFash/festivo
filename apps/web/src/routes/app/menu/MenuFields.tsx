import {
  DISH_ALLERGENS,
  DISH_DESCRIPTION_MAXIMUM,
  DISH_DIETS,
  DISH_NAME_MAXIMUM,
  type DishAllergen,
  type DishDiet,
} from '@soirely/api-client';
import { type DishProblems, type MoneyLanguage, amountExample, dishLength } from '@soirely/domain';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { currencyCodeChoices } from '../../../zoneAndCurrencyChoices.ts';
import { describedBy } from '../events/eventFieldOrder.ts';

/** The fields a dish and each of its variants share, their ids taken from a prefix: lib- for the dish, variantPrefix(at) for a variant. */

export function Wrong({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

function Optional() {
  const { t } = useTranslation();

  return <span className="gs-optional">{t('menuLibrary.optional')}</span>;
}

export function NameField({
  prefix,
  label,
  value,
  most,
  wrong,
  onChange,
}: {
  prefix: string;
  label: string;
  value: string;
  most: number;
  wrong: string | null;
  onChange: (name: string) => void;
}) {
  const { t } = useTranslation();
  const length = dishLength(value);

  return (
    <div className="desk-field">
      <label htmlFor={`${prefix}name`} className="desk-label gs-label">
        {label}
      </label>
      <div className={wrong == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={`${prefix}name`}
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={wrong != null}
          aria-describedby={describedBy(
            `${prefix}name-count`,
            wrong == null ? null : `${prefix}name-error`,
          )}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p
        id={`${prefix}name-count`}
        className={length > most ? 'lib-counter is-over' : 'lib-counter'}
      >
        {t('menuLibrary.counter', { count: length, most })}
      </p>
      {wrong != null && <Wrong id={`${prefix}name-error`}>{wrong}</Wrong>}
    </div>
  );
}

export function DishNameField({
  value,
  problem,
  onChange,
}: {
  value: string;
  problem: DishProblems['name'];
  onChange: (name: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <NameField
      prefix="lib-"
      label={t('menuLibrary.name')}
      value={value}
      most={DISH_NAME_MAXIMUM}
      wrong={
        problem === 'blank'
          ? t('menuLibrary.nameBlank')
          : problem === 'long'
            ? t('menuLibrary.nameLong', { most: DISH_NAME_MAXIMUM })
            : null
      }
      onChange={onChange}
    />
  );
}

export function DescriptionField({
  value,
  problem,
  onChange,
}: {
  value: string;
  problem: DishProblems['description'];
  onChange: (description: string) => void;
}) {
  const { t } = useTranslation();
  const length = dishLength(value);

  return (
    <div className="desk-field">
      <label htmlFor="lib-desc" className="desk-label gs-label">
        {t('menuLibrary.desc')}
        <Optional />
      </label>
      <div className={problem == null ? 'desk-box lib-area' : 'desk-box lib-area is-wrong'}>
        <textarea
          id="lib-desc"
          rows={3}
          value={value}
          aria-invalid={problem != null}
          aria-describedby={describedBy(
            'lib-desc-count',
            problem == null ? null : 'lib-desc-error',
          )}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p
        id="lib-desc-count"
        className={length > DISH_DESCRIPTION_MAXIMUM ? 'lib-counter is-over' : 'lib-counter'}
      >
        {t('menuLibrary.counter', { count: length, most: DISH_DESCRIPTION_MAXIMUM })}
      </p>
      {problem != null && (
        <Wrong id="lib-desc-error">
          {t('menuLibrary.descLong', { most: DISH_DESCRIPTION_MAXIMUM })}
        </Wrong>
      )}
    </div>
  );
}

export function ContainsField({
  prefix,
  help,
  allergens,
  none,
  notStated,
  wrong,
  onChange,
}: {
  prefix: string;
  help: string;
  allergens: readonly DishAllergen[];
  none: boolean;
  notStated: boolean;
  wrong: boolean;
  onChange: (next: { none: boolean; allergens: readonly DishAllergen[] }) => void;
}) {
  const { t } = useTranslation();

  return (
    <fieldset
      className="lib-set"
      aria-describedby={describedBy(
        `${prefix}contains-help`,
        wrong ? `${prefix}contains-error` : null,
      )}
      aria-invalid={wrong || undefined}
    >
      <legend className="desk-label gs-label">{t('menuLibrary.containsLegend')}</legend>
      <p id={`${prefix}contains-help`} className="desk-help">
        {help}
      </p>
      {notStated && allergens.length === 0 && !none && (
        <p className="lib-contains is-unknown lib-not-stated">
          <span className="lib-mark" aria-hidden="true">
            ?
          </span>
          {t('menuLibrary.notStatedLine')}
        </p>
      )}
      <div className="lib-ticks">
        {DISH_ALLERGENS.map((code) => (
          <label key={code} className="gs-tick lib-tick">
            <input
              id={`${prefix}has-${code}`}
              type="checkbox"
              className="gs-box"
              checked={allergens.includes(code)}
              onChange={() =>
                onChange({
                  none: false,
                  allergens: allergens.includes(code)
                    ? allergens.filter((one) => one !== code)
                    : DISH_ALLERGENS.filter((one) => one === code || allergens.includes(one)),
                })
              }
            />
            {t(`guestNeeds.allergen.${code}`)}
          </label>
        ))}
      </div>
      <label className="gs-tick lib-tick lib-none-tick">
        <input
          id={`${prefix}none`}
          type="checkbox"
          className="gs-box"
          checked={none}
          onChange={() => onChange({ none: !none, allergens: [] })}
        />
        {t('menuLibrary.none')}
      </label>
      {wrong && <Wrong id={`${prefix}contains-error`}>{t('menuLibrary.containsBlank')}</Wrong>}
    </fieldset>
  );
}

export function DietsField({
  prefix,
  diets,
  clashes,
  onChange,
}: {
  prefix: string;
  diets: readonly DishDiet[];
  clashes: DishProblems['clashes'];
  onChange: (diets: readonly DishDiet[]) => void;
}) {
  const { t } = useTranslation();
  const clashing = new Set(clashes.map((one) => one.diet));

  return (
    <fieldset
      className="lib-set"
      aria-describedby={clashing.size > 0 ? `${prefix}diets-error` : undefined}
    >
      <legend className="desk-label gs-label">
        {t('menuLibrary.dietsLegend')}
        <Optional />
      </legend>
      <div className="lib-ticks">
        {DISH_DIETS.map((diet) => (
          <label key={diet} className="gs-tick lib-tick">
            <input
              id={`${prefix}diet-${diet}`}
              type="checkbox"
              className="gs-box"
              checked={diets.includes(diet)}
              aria-invalid={clashing.has(diet) || undefined}
              onChange={() =>
                onChange(
                  diets.includes(diet)
                    ? diets.filter((one) => one !== diet)
                    : DISH_DIETS.filter((one) => one === diet || diets.includes(one)),
                )
              }
            />
            {t(`guestNeeds.dietName.${diet}`)}
          </label>
        ))}
      </div>
      {clashes.length > 0 && (
        <div id={`${prefix}diets-error`} className="lib-clashes">
          {clashes.map((one) => (
            <Wrong key={one.diet} id={`${prefix}clash-${one.diet}`}>
              {t(`menuLibrary.clash.${one.clash}`)}
            </Wrong>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function LastPriceField({
  prefix,
  currency,
  amount,
  held,
  problems,
  language,
  onChange,
}: {
  prefix: string;
  currency: string;
  amount: string;
  held: string;
  problems: Pick<DishProblems, 'currency' | 'amount'> | null;
  language: MoneyLanguage;
  onChange: (next: { currency?: string; amount?: string }) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <fieldset className="lib-set" aria-describedby={`${prefix}price-help`}>
      <legend className="desk-label gs-label">
        {t('menuLibrary.price')}
        <Optional />
      </legend>
      <div className="lib-price">
        <div className="desk-field lib-currency">
          <label htmlFor={`${prefix}currency`} className="desk-unseen">
            {t('menuLibrary.currency')}
          </label>
          <div className={problems?.currency == null ? 'desk-box' : 'desk-box is-wrong'}>
            <select
              id={`${prefix}currency`}
              value={currency}
              aria-invalid={problems?.currency != null}
              aria-describedby={problems?.currency == null ? undefined : `${prefix}currency-error`}
              onChange={(event) => onChange({ currency: event.target.value })}
            >
              {currencyCodeChoices(held, currency, i18n.language, t).map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="desk-field lib-amount">
          <label htmlFor={`${prefix}amount`} className="desk-unseen">
            {t('menuLibrary.amount')}
          </label>
          <div className={problems?.amount == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              id={`${prefix}amount`}
              type="text"
              inputMode="decimal"
              lang={language}
              value={amount}
              autoComplete="off"
              aria-invalid={problems?.amount != null}
              aria-describedby={problems?.amount == null ? undefined : `${prefix}amount-error`}
              onChange={(event) => onChange({ amount: event.target.value })}
            />
          </div>
        </div>
      </div>
      {problems?.currency != null && (
        <Wrong id={`${prefix}currency-error`}>{t('orgGeneral.currencyBlank')}</Wrong>
      )}
      {problems?.amount != null && (
        <Wrong id={`${prefix}amount-error`}>
          {t('menuLibrary.priceWrong', { example: amountExample(language, currency) })}
        </Wrong>
      )}
      <p id={`${prefix}price-help`} className="desk-help">
        {t('menuLibrary.priceHint')}
      </p>
    </fieldset>
  );
}
