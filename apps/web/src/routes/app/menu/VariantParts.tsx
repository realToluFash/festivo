import {
  DISH_ALLERGENS,
  DISH_DESCRIPTION_MAXIMUM,
  DISH_DIETS,
  DISH_NAME_MAXIMUM,
  type DishAllergen,
  type DishDiet,
  type DishPrice,
  VARIANT_NAME_MAXIMUM,
} from '@soirely/api-client';
import {
  type MoneyLanguage,
  type VariantForm,
  type VariantLike,
  type VariantMode,
  type VariantProblems,
  type VariantRefusal,
  type VariantWhere,
  amountExample,
  dishLength,
  variantPrefix,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { HintButton } from '../../../components/HintButton.tsx';
import { currencyCodeChoices } from '../../../zoneAndCurrencyChoices.ts';
import { describedBy } from '../events/eventFieldOrder.ts';
import { ActionGlyph, ContainsMark, Wrong } from './DishParts.tsx';
import { moneyLine, refusalWords } from './variants.ts';
import './variants.css';

/** sc-3903's variants of a dish, on the event's Menu and in the Menu library, as the demo's DishVariants draws them. */

export interface ShownVariant extends VariantLike {
  picked?: boolean;
  price: DishPrice | null;
}

export type VariantAsk =
  | { variantId: string; kind: 'ask' | 'fold'; failed: string | null }
  | { variantId: string; kind: 'refused'; lines: readonly VariantRefusal[] };

/** Add variant has no glyph in the web's set: stacked layers, in its 24 px stroke. */
function LayersGlyph() {
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
      <path d="M12 3 21 8 12 13 3 8z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 16.5 9 5 9-5" />
    </svg>
  );
}

export function AddVariantButton({
  id,
  dish,
  onClick,
}: {
  id: string;
  dish: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <HintButton
      id={id}
      label={t('dishVariants.addVariantAria', { dish })}
      hint={t('dishVariants.addVariant')}
      className="lib-act"
      onClick={onClick}
    >
      <LayersGlyph />
    </HintButton>
  );
}

/** A refusal under a row or an inset, in a polite status region: the amber ring and ink words. */
export function RowLine({ id, words }: { id: string; words: readonly string[] }) {
  return (
    <div id={id} className="vr-lines" role="status" tabIndex={-1}>
      {words.map((one) => (
        <p key={one} className="mc-refused vr-line">
          <span className="mc-ring is-warn" aria-hidden="true">
            !
          </span>
          {one}
        </p>
      ))}
    </div>
  );
}

function Tags({ diets, name }: { diets: readonly DishDiet[]; name: string }) {
  const { t } = useTranslation();
  if (diets.length === 0) return null;

  return (
    <ul className="lib-tags" aria-label={t('menuLibrary.tagsFor', { name })}>
      {diets.map((diet) => (
        <li key={diet} className="lib-tag">
          {t(`guestNeeds.dietName.${diet}`)}
        </li>
      ))}
    </ul>
  );
}

function ChildrenTag() {
  const { t } = useTranslation();

  return (
    <span className="vr-children">
      <Glyph name="user" size={14} weight={2.4} />
      {t('dishVariants.childrenOnly')}
    </span>
  );
}

/** A dish with variants: one inset per variant with its own Contains and Suitable for, its Edit and Remove…, and the question Remove… asks under it. */
export function VariantInsets({
  dish,
  variants,
  where,
  ids,
  manage,
  prices,
  language,
  asking,
  lit,
  onEdit,
  onRemove,
  onKeep,
  onConfirm,
}: {
  dish: string;
  variants: readonly ShownVariant[];
  where: VariantWhere;
  ids: string;
  manage: boolean;
  prices: boolean;
  language: MoneyLanguage;
  asking: VariantAsk | null;
  lit: string | null;
  onEdit: (variant: ShownVariant) => void;
  onRemove: (variant: ShownVariant) => void;
  onKeep: (variant: ShownVariant) => void;
  onConfirm: (variant: ShownVariant) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="vr-box">
      {where === 'event' && <p className="mn-quiet vr-each">{t('dishVariants.eachOwn')}</p>}
      <ul className="vr-insets" aria-label={t('dishVariants.ways', { dish, n: variants.length })}>
        {variants.map((variant) => {
          const here = asking?.variantId === variant.id ? asking : null;
          const staying = variants.find((one) => one.id !== variant.id) ?? null;

          return (
            <li key={variant.id} className="vr-item">
              <div
                className={[
                  'vr-inset',
                  where === 'library' ? 'is-library' : 'is-event',
                  lit === variant.id && 'is-lit',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="vr-words">
                  <h4 className="vr-name">
                    {variant.name}
                    {variant.for === 'children' && <ChildrenTag />}
                  </h4>
                  <ContainsMark dish={{ allergens: [...variant.allergens] }} />
                  <Tags diets={variant.diets} name={variant.name} />
                </div>
                {manage && (
                  <div
                    className="lib-acts vr-acts"
                    role="group"
                    aria-label={t('dishVariants.actionsFor', { variant: variant.name })}
                  >
                    <HintButton
                      id={`${ids}-vedit-${variant.id}`}
                      label={t('dishVariants.editAria', { variant: variant.name })}
                      hint={t('dishVariants.editHint')}
                      className="lib-act"
                      onClick={() => onEdit(variant)}
                    >
                      <ActionGlyph icon="edit" />
                    </HintButton>
                    <HintButton
                      id={`${ids}-vremove-${variant.id}`}
                      label={t('dishVariants.removeAria', { variant: variant.name })}
                      hint={t('dishVariants.removeHint')}
                      className="lib-act"
                      onClick={() => onRemove(variant)}
                    >
                      <ActionGlyph icon="remove" />
                    </HintButton>
                  </div>
                )}
              </div>
              {here?.kind === 'refused' && (
                <RowLine
                  id={`${ids}-vline-${variant.id}`}
                  words={here.lines.map((one) => refusalWords(t, one, variant.name))}
                />
              )}
              {here?.kind === 'ask' && (
                <div className="mn-ask">
                  <p id={`${ids}-vask-${variant.id}`} tabIndex={-1}>
                    {t('dishVariants.removeAsk', { variant: variant.name, dish })}
                  </p>
                  <div className="mn-ask-acts">
                    <button type="button" className="desk-text" onClick={() => onKeep(variant)}>
                      {t('dishVariants.keepIt')}
                    </button>
                    <button
                      type="button"
                      className="gs-pill is-secondary"
                      onClick={() => onConfirm(variant)}
                    >
                      {t('dishVariants.removeVariant')}
                    </button>
                  </div>
                  <AskFailed id={`${ids}-vfailed-${variant.id}`} words={here.failed} />
                </div>
              )}
              {here?.kind === 'fold' && staying != null && (
                <FoldAsk
                  id={`${ids}-vask-${variant.id}`}
                  dish={dish}
                  staying={staying}
                  where={where}
                  prices={prices}
                  language={language}
                  failed={here.failed}
                  failedId={`${ids}-vfailed-${variant.id}`}
                  onKeep={() => onKeep(variant)}
                  onFold={() => onConfirm(variant)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AskFailed({ id, words }: { id: string; words: string | null }) {
  if (words == null) return null;

  return (
    <p id={id} className="mn-failed" role="alert" tabIndex={-1}>
      <Glyph name="alert" size={16} weight={2.2} />
      {words}
    </p>
  );
}

function FoldAsk({
  id,
  dish,
  staying,
  where,
  prices,
  language,
  failed,
  failedId,
  onKeep,
  onFold,
}: {
  id: string;
  dish: string;
  staying: ShownVariant;
  where: VariantWhere;
  prices: boolean;
  language: MoneyLanguage;
  failed: string | null;
  failedId: string;
  onKeep: () => void;
  onFold: () => void;
}) {
  const { t } = useTranslation();
  const named = { dish, variant: staying.name };
  const body = !prices
    ? t('dishVariants.foldBody', named)
    : t(where === 'event' ? 'dishVariants.foldBodyCost' : 'dishVariants.foldBodyPrice', named);
  const money = !prices
    ? null
    : staying.price != null
      ? t('dishVariants.foldMoney', {
          money: moneyLine(staying.price, language),
          variant: staying.name,
        })
      : t(where === 'event' ? 'dishVariants.foldNoCost' : 'dishVariants.foldNoPrice', {
          variant: staying.name,
        });

  return (
    <div className="mn-ask vr-fold" role="group" aria-labelledby={id}>
      <div className="vr-fold-words">
        <p id={id} className="vr-fold-title" tabIndex={-1}>
          {t('dishVariants.foldTitle')}
        </p>
        <p>{body}</p>
        <div className="vr-fold-inset">
          <ContainsMark dish={{ allergens: [...staying.allergens] }} />
          <Tags diets={staying.diets} name={staying.name} />
          {money != null && (
            <p className="vr-fold-money">
              <span className="vr-fold-label">
                {where === 'event' ? t('dishVariants.cost') : t('menuLibrary.price')}
              </span>
              {money}
            </p>
          )}
        </div>
        {staying.for === 'children' && <p>{t('dishVariants.foldChildren')}</p>}
      </div>
      <div className="mn-ask-acts">
        <button type="button" className="desk-text" onClick={onKeep}>
          {t('dishVariants.keepBoth')}
        </button>
        <button type="button" className="gs-pill" onClick={onFold}>
          {t('dishVariants.makeSingle')}
        </button>
      </div>
      <AskFailed id={failedId} words={failed} />
    </div>
  );
}

function nameProblem(t: TFunction, problem: VariantProblems['name']): string | null {
  if (problem === 'blank') return t('dishVariants.nameBlank');
  if (problem === 'long') return t('dishVariants.nameLong', { most: VARIANT_NAME_MAXIMUM });
  if (problem === 'taken') return t('dishVariants.nameTaken');

  return null;
}

/** One variant's fields: Name, For, Contains, Suitable for, and the money field only with budget.read. */
function VariantBlock({
  at,
  title,
  form,
  problems,
  where,
  prices,
  language,
  eventCurrency,
  heldCurrency,
  pricedIn,
  onPatch,
}: {
  at: number;
  title: string | null;
  form: VariantForm;
  problems: VariantProblems | null;
  where: VariantWhere;
  prices: boolean;
  language: MoneyLanguage;
  eventCurrency: string;
  heldCurrency: string;
  pricedIn: string | null;
  onPatch: (next: Partial<VariantForm>) => void;
}) {
  const { t, i18n } = useTranslation();
  const p = variantPrefix(at);
  const length = dishLength(form.name);
  const clashing = new Set(problems?.clashes.map((one) => one.diet) ?? []);
  const forWrong = problems?.for != null;
  const nameWords = nameProblem(t, problems?.name ?? null);
  const optional = <span className="gs-optional">{t('menuLibrary.optional')}</span>;
  const example = amountExample(language, where === 'event' ? eventCurrency : form.currency);
  const showPricedIn = pricedIn != null && form.amount.trim() === '';

  const fields = (
    <>
      <div className="desk-field">
        <label htmlFor={`${p}name`} className="desk-label gs-label">
          {t('dishVariants.name')}
        </label>
        <div className={nameWords == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={`${p}name`}
            type="text"
            value={form.name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={nameWords != null}
            aria-describedby={describedBy(
              `${p}name-count`,
              nameWords == null ? null : `${p}name-error`,
            )}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id={`${p}name-count`}
          className={length > VARIANT_NAME_MAXIMUM ? 'lib-counter is-over' : 'lib-counter'}
        >
          {t('menuLibrary.counter', { count: length, most: VARIANT_NAME_MAXIMUM })}
        </p>
        {nameWords != null && <Wrong id={`${p}name-error`}>{nameWords}</Wrong>}
      </div>
      <fieldset
        className="lib-set vr-for"
        aria-invalid={forWrong || undefined}
        aria-describedby={describedBy(forWrong ? `${p}for-error` : null, `${p}for-help`)}
      >
        <legend className="desk-label gs-label">{t('dishVariants.forLegend')}</legend>
        <div className="vr-radios">
          {(['everyone', 'children'] as const).map((one) => (
            <label key={one} className="mc-radio">
              <input
                id={`${p}for-${one}`}
                type="radio"
                className={forWrong ? 'desk-radio vr-radio is-wrong' : 'desk-radio vr-radio'}
                name={`${p}for`}
                checked={form.for === one}
                aria-describedby={forWrong ? `${p}for-error` : undefined}
                onChange={() => onPatch({ for: one })}
              />
              {one === 'everyone' ? t('dishVariants.everyone') : t('dishVariants.childrenOnly')}
            </label>
          ))}
        </div>
        {forWrong && <Wrong id={`${p}for-error`}>{t('dishVariants.needsEveryone')}</Wrong>}
        <p id={`${p}for-help`} className="desk-help">
          {t('dishVariants.childrenHelp')}
        </p>
      </fieldset>
      <fieldset
        className="lib-set"
        aria-describedby={describedBy(
          `${p}contains-help`,
          problems?.contains == null ? null : `${p}contains-error`,
        )}
        aria-invalid={problems?.contains != null || undefined}
      >
        <legend className="desk-label gs-label">{t('menuLibrary.containsLegend')}</legend>
        <p id={`${p}contains-help`} className="desk-help">
          {t('dishVariants.containsHelp')}
        </p>
        <div className="lib-ticks">
          {DISH_ALLERGENS.map((code: DishAllergen) => (
            <label key={code} className="gs-tick lib-tick">
              <input
                id={`${p}has-${code}`}
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
            id={`${p}none`}
            type="checkbox"
            className="gs-box"
            checked={form.none}
            onChange={() => onPatch({ none: !form.none, allergens: [] })}
          />
          {t('menuLibrary.none')}
        </label>
        {problems?.contains != null && (
          <Wrong id={`${p}contains-error`}>{t('menuLibrary.containsBlank')}</Wrong>
        )}
      </fieldset>
      <fieldset
        className="lib-set"
        aria-describedby={clashing.size > 0 ? `${p}diets-error` : undefined}
      >
        <legend className="desk-label gs-label">
          {t('menuLibrary.dietsLegend')}
          {optional}
        </legend>
        <div className="lib-ticks">
          {DISH_DIETS.map((diet) => (
            <label key={diet} className="gs-tick lib-tick">
              <input
                id={`${p}diet-${diet}`}
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
          <div id={`${p}diets-error`} className="lib-clashes">
            {problems.clashes.map((one) => (
              <Wrong key={one.diet} id={`${p}clash-${one.diet}`}>
                {t(`menuLibrary.clash.${one.clash}`)}
              </Wrong>
            ))}
          </div>
        )}
      </fieldset>
      {prices &&
        (where === 'event' ? (
          <div className="desk-field">
            <label htmlFor={`${p}amount`} className="desk-label gs-label">
              {t('dishVariants.cost')}
              {optional}
            </label>
            <div className="vr-cost">
              <span className="vr-currency">{eventCurrency}</span>
              <div className={problems?.amount == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id={`${p}amount`}
                  type="text"
                  inputMode="decimal"
                  lang={language}
                  value={form.amount}
                  autoComplete="off"
                  aria-invalid={problems?.amount != null}
                  aria-describedby={describedBy(
                    problems?.amount == null ? null : `${p}amount-error`,
                    showPricedIn ? `${p}priced-in` : null,
                    `${p}cost-help`,
                  )}
                  onChange={(event) => onPatch({ amount: event.target.value })}
                />
              </div>
            </div>
            {problems?.amount != null && (
              <Wrong id={`${p}amount-error`}>{t('dishVariants.costWrong', { example })}</Wrong>
            )}
            {showPricedIn && (
              <p id={`${p}priced-in`} className="vr-priced-in">
                <span className="mc-ring is-warn" aria-hidden="true">
                  !
                </span>
                {t('dishVariants.pricedIn', { code: pricedIn })}
              </p>
            )}
            <p id={`${p}cost-help`} className="desk-help">
              {t('dishVariants.costHelp')}
            </p>
          </div>
        ) : (
          <fieldset className="lib-set" aria-describedby={`${p}price-help`}>
            <legend className="desk-label gs-label">
              {t('menuLibrary.price')}
              {optional}
            </legend>
            <div className="lib-price">
              <div className="desk-field lib-currency">
                <label htmlFor={`${p}currency`} className="desk-unseen">
                  {t('menuLibrary.currency')}
                </label>
                <div className={problems?.currency == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <select
                    id={`${p}currency`}
                    value={form.currency}
                    aria-invalid={problems?.currency != null}
                    aria-describedby={problems?.currency == null ? undefined : `${p}currency-error`}
                    onChange={(event) => onPatch({ currency: event.target.value })}
                  >
                    {currencyCodeChoices(heldCurrency, form.currency, i18n.language, t).map(
                      (choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <div className="desk-field lib-amount">
                <label htmlFor={`${p}amount`} className="desk-unseen">
                  {t('menuLibrary.amount')}
                </label>
                <div className={problems?.amount == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <input
                    id={`${p}amount`}
                    type="text"
                    inputMode="decimal"
                    lang={language}
                    value={form.amount}
                    autoComplete="off"
                    aria-invalid={problems?.amount != null}
                    aria-describedby={problems?.amount == null ? undefined : `${p}amount-error`}
                    onChange={(event) => onPatch({ amount: event.target.value })}
                  />
                </div>
              </div>
            </div>
            {problems?.currency != null && (
              <Wrong id={`${p}currency-error`}>{t('orgGeneral.currencyBlank')}</Wrong>
            )}
            {problems?.amount != null && (
              <Wrong id={`${p}amount-error`}>{t('menuLibrary.priceWrong', { example })}</Wrong>
            )}
            <p id={`${p}price-help`} className="desk-help">
              {t('menuLibrary.priceHint')}
            </p>
          </fieldset>
        ))}
    </>
  );

  if (title == null) return fields;

  return (
    <section className="vr-block" aria-labelledby={`${p}title`}>
      <h3 id={`${p}title`} className="vr-block-title">
        {title}
      </h3>
      {fields}
    </section>
  );
}

/** The variant form's body: for the first two, the grey box of what the dish said until now; then one block, or two. */
export function VariantFields({
  mode,
  dish,
  forms,
  problems,
  where,
  prices,
  language,
  eventCurrency = '',
  heldCurrency = '',
  pricedIn = null,
  after = null,
  onPatch,
}: {
  mode: VariantMode;
  dish: { name: string; allergens: DishAllergen[] | null; diets: readonly DishDiet[] };
  forms: readonly VariantForm[];
  problems: readonly VariantProblems[] | null;
  where: VariantWhere;
  prices: boolean;
  language: MoneyLanguage;
  eventCurrency?: string;
  heldCurrency?: string;
  pricedIn?: string | null;
  after?: ReactNode;
  onPatch: (at: number, next: Partial<VariantForm>) => void;
}) {
  const { t } = useTranslation();
  const titles = [t('dishVariants.firstBlock'), t('dishVariants.secondBlock')];

  return (
    <>
      {mode === 'addFirst' && (
        <div className="vr-was">
          <p className="vr-was-title">{t('dishVariants.untilNow', { dish: dish.name })}</p>
          <ContainsMark dish={dish} />
          <Tags diets={dish.diets} name={dish.name} />
          <p className="desk-help">{t('dishVariants.startsBlank')}</p>
        </div>
      )}
      {forms.map((form, at) => (
        <VariantBlock
          key={variantPrefix(at)}
          at={at}
          title={mode === 'addFirst' ? (titles[at] ?? null) : null}
          form={form}
          problems={problems?.[at] ?? null}
          where={where}
          prices={prices}
          language={language}
          eventCurrency={eventCurrency}
          heldCurrency={heldCurrency}
          pricedIn={mode === 'edit' ? pricedIn : null}
          onPatch={(next) => onPatch(at, next)}
        />
      ))}
      {after}
    </>
  );
}

/** Edit on a dish with variants asks only Name and Description: the variants hold its allergens and diets. */
export function NameDescFields({
  form,
  problems,
  onPatch,
}: {
  form: { name: string; description: string };
  problems: { name: 'blank' | 'long' | null; description: 'long' | null } | null;
  onPatch: (next: { name?: string; description?: string }) => void;
}) {
  const { t } = useTranslation();
  const nameLength = dishLength(form.name);
  const descLength = dishLength(form.description);

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
          <span className="gs-optional">{t('menuLibrary.optional')}</span>
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
      <p className="desk-help vr-each">{t('dishVariants.eachOwn')}</p>
    </>
  );
}
