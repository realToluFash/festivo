import type { ReactNode } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { HintButton } from '../components/HintButton.tsx';
import {
  type Variant,
  type VariantAsk,
  type VariantErrors,
  type VariantForm,
  type VariantMode,
  type Where,
  type WithVariants,
  EVENT_CURRENCY,
  VARIANT_NAME_MAX,
  VW,
  blockPrefix,
  foldWords,
  picksLine,
  refusalLine,
  variantsOf,
} from './dishVariants.ts';
import {
  type DishAllergen,
  type FormErrors,
  type Lang,
  CURRENCIES,
  DESC_MAX,
  DIETS,
  DISH_ALLERGENS,
  LW,
  NAME_MAX,
  allergenName,
  dietName,
  lengthOf,
} from './menuLibrary.ts';
import { ActionGlyph, ContainsMark } from './MenuLibrary.tsx';
import { Pill } from './GuestsParts.tsx';
import './dishVariants.css';

/** Add variant has no glyph in the web's set: stacked layers, in its 24 px stroke. */
export function LayersGlyph() {
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
  return (
    <HintButton
      id={id}
      label={VW.addVariantAria(dish)}
      hint={VW.addVariant}
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

function Tags({ diets, label, lang }: { diets: Variant['diets']; label: string; lang: Lang }) {
  if (diets.length === 0) return null;

  return (
    <ul className="lib-tags" aria-label={label}>
      {diets.map((diet) => (
        <li key={diet} className="lib-tag">
          {dietName(diet, lang)}
        </li>
      ))}
    </ul>
  );
}

export function ChildrenTag() {
  return (
    <span className="vr-children">
      <Glyph name="user" size={14} weight={2.4} />
      {VW.childrenOnly}
    </span>
  );
}

/** A dish with variants: the line that says so, then one inset per variant with its own Contains, Suitable for, and on the event its picks. */
export function VariantInsets({
  dish,
  where,
  ids,
  manage,
  budget,
  lang,
  asking,
  lit,
  onEdit,
  onRemove,
  onKeep,
  onConfirmRemove,
  onConfirmFold,
}: {
  dish: WithVariants;
  where: Where;
  ids: string;
  manage: boolean;
  budget: boolean;
  lang: Lang;
  asking: VariantAsk | null;
  lit: string | null;
  onEdit: (variant: Variant) => void;
  onRemove: (variant: Variant) => void;
  onKeep: (variant: Variant) => void;
  onConfirmRemove: (variant: Variant) => void;
  onConfirmFold: (variant: Variant) => void;
}) {
  const variants = variantsOf(dish);

  return (
    <div className="vr-box">
      {where === 'event' && <p className="mn-quiet vr-each">{VW.eachOwn}</p>}
      <ul className="vr-insets" aria-label={VW.ways(dish.name, variants.length)}>
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
                  <ContainsMark dish={variant} lang={lang} />
                  <Tags
                    diets={variant.diets}
                    label={`${LW.suitableFor} · ${variant.name}`}
                    lang={lang}
                  />
                  {where === 'event' && <p className="vr-picks">{picksLine(dish, variant)}</p>}
                </div>
                {manage && (
                  <div
                    className="lib-acts vr-acts"
                    role="group"
                    aria-label={VW.actionsFor(variant.name)}
                  >
                    <HintButton
                      id={`${ids}-vedit-${variant.id}`}
                      label={VW.editAria(variant.name)}
                      hint={VW.edit}
                      className="lib-act"
                      onClick={() => onEdit(variant)}
                    >
                      <ActionGlyph icon="edit" />
                    </HintButton>
                    <HintButton
                      id={`${ids}-vremove-${variant.id}`}
                      label={VW.removeAria(variant.name)}
                      hint={VW.remove}
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
                  words={here.lines.map((one) => refusalLine(one, variant))}
                />
              )}
              {here?.kind === 'ask' && (
                <div className="mn-ask">
                  <p id={`${ids}-vask-${variant.id}`} tabIndex={-1}>
                    {VW.removeAsk(variant.name, dish.name)}
                  </p>
                  <div className="mn-ask-acts">
                    <button type="button" className="desk-text" onClick={() => onKeep(variant)}>
                      {VW.keepIt}
                    </button>
                    <Pill label={VW.removeVariant} onClick={() => onConfirmRemove(variant)} />
                  </div>
                </div>
              )}
              {here?.kind === 'fold' && staying != null && (
                <FoldAsk
                  id={`${ids}-vask-${variant.id}`}
                  dish={dish}
                  staying={staying}
                  where={where}
                  budget={budget}
                  lang={lang}
                  onKeep={() => onKeep(variant)}
                  onFold={() => onConfirmFold(variant)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FoldAsk({
  id,
  dish,
  staying,
  where,
  budget,
  lang,
  onKeep,
  onFold,
}: {
  id: string;
  dish: WithVariants;
  staying: Variant;
  where: Where;
  budget: boolean;
  lang: Lang;
  onKeep: () => void;
  onFold: () => void;
}) {
  const words = foldWords(dish, staying, where, budget, lang);

  return (
    <div className="mn-ask vr-fold" role="group" aria-labelledby={id}>
      <div className="vr-fold-words">
        <p id={id} className="vr-fold-title" tabIndex={-1}>
          {VW.foldTitle}
        </p>
        <p>{words.body}</p>
        <div className="vr-fold-inset">
          <ContainsMark dish={staying} lang={lang} />
          <Tags diets={staying.diets} label={`${LW.suitableFor} · ${staying.name}`} lang={lang} />
          {words.money != null && (
            <p className="vr-fold-money">
              <span className="vr-fold-label">{where === 'event' ? VW.cost : LW.price}</span>
              {words.money}
            </p>
          )}
        </div>
        {words.children != null && <p>{words.children}</p>}
      </div>
      <div className="mn-ask-acts">
        <button type="button" className="desk-text" onClick={onKeep}>
          {VW.keepBoth}
        </button>
        <Pill label={VW.makeSingle} primary onClick={onFold} />
      </div>
    </div>
  );
}

function Wrong({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

function Optional() {
  return <span className="gs-optional">{LW.optional}</span>;
}

const described = (...ids: (string | null | false | undefined)[]): string | undefined => {
  const joined = ids.filter(Boolean).join(' ');

  return joined === '' ? undefined : joined;
};

/** One variant's fields: Name, For, Contains, Suitable for, and the money field only with budget.read. */
function VariantBlock({
  at,
  title,
  form,
  errors,
  where,
  budget,
  lang,
  pricedIn,
  onPatch,
}: {
  at: number;
  title: string | null;
  form: VariantForm;
  errors: VariantErrors | null;
  where: Where;
  budget: boolean;
  lang: Lang;
  pricedIn: string | null;
  onPatch: (next: Partial<VariantForm>) => void;
}) {
  const p = blockPrefix(at);
  const length = lengthOf(form.name);
  const clashing = new Set(errors?.clashes.map((one) => one.diet) ?? []);
  const forWrong = errors?.for != null;

  const fields = (
    <>
      <div className="desk-field">
        <label htmlFor={`${p}name`} className="desk-label gs-label">
          {VW.name}
        </label>
        <div className={errors?.name == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={`${p}name`}
            type="text"
            value={form.name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors?.name != null}
            aria-describedby={described(`${p}name-count`, errors?.name != null && `${p}name-error`)}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id={`${p}name-count`}
          className={length > VARIANT_NAME_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {LW.counter(length, VARIANT_NAME_MAX)}
        </p>
        {errors?.name != null && <Wrong id={`${p}name-error`}>{errors.name}</Wrong>}
      </div>
      <fieldset
        className="lib-set vr-for"
        aria-invalid={forWrong || undefined}
        aria-describedby={described(forWrong && `${p}for-error`, `${p}for-help`)}
      >
        <legend className="desk-label gs-label">{VW.forLegend}</legend>
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
              {one === 'everyone' ? VW.everyone : VW.childrenOnly}
            </label>
          ))}
        </div>
        {forWrong && <Wrong id={`${p}for-error`}>{errors.for}</Wrong>}
        <p id={`${p}for-help`} className="desk-help">
          {VW.childrenHelp}
        </p>
      </fieldset>
      <fieldset
        className="lib-set"
        aria-describedby={described(
          `${p}contains-help`,
          errors?.contains != null && `${p}contains-error`,
        )}
        aria-invalid={errors?.contains != null || undefined}
      >
        <legend className="desk-label gs-label">{LW.containsLegend}</legend>
        <p id={`${p}contains-help`} className="desk-help">
          {LW.containsHelp}
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
              {allergenName(code, lang)}
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
          {LW.none}
        </label>
        {errors?.contains != null && <Wrong id={`${p}contains-error`}>{errors.contains}</Wrong>}
      </fieldset>
      <fieldset
        className="lib-set"
        aria-describedby={clashing.size > 0 ? `${p}diets-error` : undefined}
      >
        <legend className="desk-label gs-label">
          {LW.dietsLegend}
          <Optional />
        </legend>
        <div className="lib-ticks">
          {DIETS.map((diet) => (
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
                      : DIETS.filter((one) => one === diet || form.diets.includes(one)),
                  })
                }
              />
              {dietName(diet, lang)}
            </label>
          ))}
        </div>
        {errors != null && errors.clashes.length > 0 && (
          <div id={`${p}diets-error`} className="lib-clashes">
            {errors.clashes.map((one) => (
              <Wrong key={one.diet} id={`${p}clash-${one.diet}`}>
                {one.line}
              </Wrong>
            ))}
          </div>
        )}
      </fieldset>
      {budget &&
        (where === 'event' ? (
          <div className="desk-field">
            <label htmlFor={`${p}amount`} className="desk-label gs-label">
              {VW.cost}
              <Optional />
            </label>
            <div className="vr-cost">
              <span className="vr-currency">{EVENT_CURRENCY}</span>
              <div className={errors?.amount == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id={`${p}amount`}
                  type="text"
                  inputMode="decimal"
                  lang={lang}
                  value={form.amount}
                  autoComplete="off"
                  aria-invalid={errors?.amount != null}
                  aria-describedby={described(
                    errors?.amount != null && `${p}amount-error`,
                    pricedIn != null && form.amount.trim() === '' && `${p}priced-in`,
                    `${p}cost-help`,
                  )}
                  onChange={(event) => onPatch({ amount: event.target.value })}
                />
              </div>
            </div>
            {errors?.amount != null && <Wrong id={`${p}amount-error`}>{errors.amount}</Wrong>}
            {pricedIn != null && form.amount.trim() === '' && (
              <p id={`${p}priced-in`} className="vr-priced-in">
                <span className="mc-ring is-warn" aria-hidden="true">
                  !
                </span>
                {VW.pricedIn(pricedIn)}
              </p>
            )}
            <p id={`${p}cost-help`} className="desk-help">
              {VW.costHelp}
            </p>
          </div>
        ) : (
          <fieldset className="lib-set" aria-describedby={`${p}price-help`}>
            <legend className="desk-label gs-label">
              {LW.price}
              <Optional />
            </legend>
            <div className="lib-price">
              <div className="desk-field lib-currency">
                <label htmlFor={`${p}currency`} className="desk-unseen">
                  {LW.currency}
                </label>
                <div className={errors?.currency == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <select
                    id={`${p}currency`}
                    value={form.currency}
                    aria-invalid={errors?.currency != null}
                    aria-describedby={errors?.currency == null ? undefined : `${p}currency-error`}
                    onChange={(event) => onPatch({ currency: event.target.value })}
                  >
                    {form.currency === '' && <option value="">{LW.chooseCurrency}</option>}
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="desk-field lib-amount">
                <label htmlFor={`${p}amount`} className="desk-unseen">
                  {LW.amount}
                </label>
                <div className={errors?.amount == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <input
                    id={`${p}amount`}
                    type="text"
                    inputMode="decimal"
                    lang={lang}
                    value={form.amount}
                    autoComplete="off"
                    aria-invalid={errors?.amount != null}
                    aria-describedby={errors?.amount == null ? undefined : `${p}amount-error`}
                    onChange={(event) => onPatch({ amount: event.target.value })}
                  />
                </div>
              </div>
            </div>
            {errors?.currency != null && <Wrong id={`${p}currency-error`}>{errors.currency}</Wrong>}
            {errors?.amount != null && <Wrong id={`${p}amount-error`}>{errors.amount}</Wrong>}
            <p id={`${p}price-help`} className="desk-help">
              {LW.priceHint}
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

/** The variant form's body: the grey box of what the dish said until now, for adding the first two; then one block, or two. */
export function VariantFields({
  mode,
  dish,
  forms,
  errors,
  where,
  budget,
  lang,
  pricedIn,
  after = null,
  onPatch,
}: {
  mode: VariantMode;
  dish: WithVariants;
  forms: readonly VariantForm[];
  errors: readonly VariantErrors[] | null;
  where: Where;
  budget: boolean;
  lang: Lang;
  pricedIn: string | null;
  after?: ReactNode;
  onPatch: (at: number, next: Partial<VariantForm>) => void;
}) {
  return (
    <>
      {mode === 'addFirst' && (
        <div className="vr-was">
          <p className="vr-was-title">{VW.untilNow(dish.name)}</p>
          <ContainsMark dish={dish} lang={lang} />
          <Tags diets={dish.diets} label={`${LW.suitableFor} · ${dish.name}`} lang={lang} />
          <p className="desk-help">{VW.startsBlank}</p>
        </div>
      )}
      {forms.map((form, at) => (
        <VariantBlock
          key={blockPrefix(at)}
          at={at}
          title={mode === 'addFirst' ? (VW.blocks[at] ?? null) : null}
          form={form}
          errors={errors?.[at] ?? null}
          where={where}
          budget={budget}
          lang={lang}
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
  errors,
  onPatch,
}: {
  form: { name: string; desc: string };
  errors: Pick<FormErrors, 'name' | 'desc'> | null;
  onPatch: (next: { name?: string; desc?: string }) => void;
}) {
  const nameLength = lengthOf(form.name);
  const descLength = lengthOf(form.desc);

  return (
    <>
      <div className="desk-field">
        <label htmlFor="lib-name" className="desk-label gs-label">
          {LW.name}
        </label>
        <div className={errors?.name == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id="lib-name"
            type="text"
            value={form.name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors?.name != null}
            aria-describedby={described('lib-name-count', errors?.name != null && 'lib-name-error')}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id="lib-name-count"
          className={nameLength > NAME_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {LW.counter(nameLength, NAME_MAX)}
        </p>
        {errors?.name != null && <Wrong id="lib-name-error">{errors.name}</Wrong>}
      </div>
      <div className="desk-field">
        <label htmlFor="lib-desc" className="desk-label gs-label">
          {LW.desc}
          <Optional />
        </label>
        <div className={errors?.desc == null ? 'desk-box lib-area' : 'desk-box lib-area is-wrong'}>
          <textarea
            id="lib-desc"
            rows={3}
            value={form.desc}
            aria-invalid={errors?.desc != null}
            aria-describedby={described('lib-desc-count', errors?.desc != null && 'lib-desc-error')}
            onChange={(event) => onPatch({ desc: event.target.value })}
          />
        </div>
        <p
          id="lib-desc-count"
          className={descLength > DESC_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {LW.counter(descLength, DESC_MAX)}
        </p>
        {errors?.desc != null && <Wrong id="lib-desc-error">{errors.desc}</Wrong>}
      </div>
      <p className="desk-help vr-each">{VW.eachOwn}</p>
    </>
  );
}
