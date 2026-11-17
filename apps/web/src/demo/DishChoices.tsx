import { type ComponentProps, type ReactNode, useEffect } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { HintButton } from '../components/HintButton.tsx';
import {
  type Choice,
  type ChoiceAsk,
  type ChoiceErrors,
  type ChoiceForm,
  type OptionForm,
  type WithChoices,
  CHW,
  OPTION_NAME_MAX,
  QUESTION_MAX,
  blockId,
  choicesOf,
  draftReasons,
  isDraft,
  kitchenPrep,
  namedCount,
  optionContains,
  optionContainsLine,
  pickLine,
  pickMax,
  questionOf,
  stepperHint,
} from './dishChoices.ts';
import { variantsOf } from './dishVariants.ts';
import { LayersGlyph, RowLine } from './DishVariants.tsx';
import { Pill } from './GuestsParts.tsx';
import {
  type DishAllergen,
  type Lang,
  DISH_ALLERGENS,
  LW,
  allergenName,
  lengthOf,
} from './menuLibrary.ts';
import { ActionGlyph } from './MenuLibrary.tsx';
import './dishChoices.css';

/** Add a choice has no glyph in the web's set: a checked list, in its 24 px stroke. */
export function ChecklistGlyph() {
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
      <path d="m3 6 2 2 3-3" />
      <path d="m3 13 2 2 3-3" />
      <path d="M11 6.5h10" />
      <path d="M11 13.5h10" />
      <path d="M11 20h10" />
      <path d="M4 20h2" />
    </svg>
  );
}

export function AddChoiceButton({
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
      label={CHW.addChoiceAria(dish)}
      hint={CHW.addChoice}
      className="lib-act"
      onClick={onClick}
    >
      <ChecklistGlyph />
    </HintButton>
  );
}

/** A HintButton whose button is described by a line beside it, so focus left on it hears why nothing happened. */
function DescribedHintButton({
  describedBy,
  ...props
}: ComponentProps<typeof HintButton> & { describedBy: string | null }) {
  useEffect(() => {
    const button = document.getElementById(props.id);
    if (button == null || describedBy == null) return undefined;
    button.setAttribute('aria-describedby', describedBy);

    return () => button.removeAttribute('aria-describedby');
  }, [props.id, describedBy]);

  return <HintButton {...props} />;
}

/** Beside the dish's name while a draft choice hides it: the dashed ring and the words. */
export function NotOffered({ variants }: { variants: number }) {
  return (
    <span className="ch-not-offered">
      <span className="mc-state is-empty">
        <span className="mc-ring is-empty" aria-hidden="true" />
        {CHW.notOffered}
      </span>
      {variants >= 2 && <span className="mn-quiet">{CHW.hiddenIn(variants)}</span>}
    </span>
  );
}

function DraftTag() {
  return (
    <span className="ch-draft-tag">
      <Glyph name="pen" size={13} weight={2.4} />
      {CHW.draftTag}
    </span>
  );
}

function ContainsLine({
  contains,
  lang,
  withVariants,
}: {
  contains: Choice['options'][number]['contains'];
  lang: Lang;
  withVariants: boolean;
}) {
  const kind = contains == null ? 'unknown' : contains === 'none' ? 'none' : 'some';

  return (
    <p className={`lib-contains is-${kind}`}>
      <span className="lib-mark" aria-hidden="true">
        {kind === 'unknown' ? '?' : kind === 'none' ? '0' : '!'}
      </span>
      {optionContainsLine(contains, lang, withVariants)}
    </p>
  );
}

/** Each choice of a dish as an inset under it: its question, how many guests pick, each option's Contains, and once guests have picked, Kitchen prep. */
export function ChoiceInsets({
  dish,
  manage,
  lang,
  asking,
  lit,
  onEdit,
  onRemove,
  onKeep,
  onConfirmRemove,
}: {
  dish: WithChoices;
  manage: boolean;
  lang: Lang;
  asking: ChoiceAsk | null;
  lit: string | null;
  onEdit: (choice: Choice) => void;
  onRemove: (choice: Choice) => void;
  onKeep: (choice: Choice) => void;
  onConfirmRemove: (choice: Choice) => void;
}) {
  const ways = variantsOf(dish).length;
  const withVariants = ways > 0;

  return (
    <div className="ch-box">
      {withVariants && <p className="ch-head">{CHW.choicesHead}</p>}
      <ul className="ch-insets">
        {choicesOf(dish).map((choice, at) => {
          const here = asking?.choiceId === choice.id ? asking : null;
          const draft = isDraft(choice);
          const named = questionOf(choice, at);
          const prep = kitchenPrep(choice);

          return (
            <li key={choice.id} className="vr-item">
              <div className={lit === choice.id ? 'vr-inset ch-inset is-lit' : 'vr-inset ch-inset'}>
                <div className="vr-words">
                  <h4 className="vr-name">
                    {named}
                    {draft && <DraftTag />}
                    {withVariants && (
                      <span className="vr-children">
                        <LayersGlyph />
                        {CHW.everyVariant}
                      </span>
                    )}
                  </h4>
                  <p className="mn-quiet">{pickLine(choice)}</p>
                  <ul className="ch-options">
                    {choice.options.map((one) => (
                      <li key={one.id} className="ch-option">
                        <span className="ch-option-name">{one.name}</span>
                        <ContainsLine
                          contains={one.contains}
                          lang={lang}
                          withVariants={withVariants}
                        />
                      </li>
                    ))}
                  </ul>
                  {draft && (
                    <div className="ch-draft">
                      <p>{CHW.draftLine}</p>
                      <ul>
                        {draftReasons(choice).map((one) => (
                          <li key={one}>{one}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {prep != null && (
                    <div className="ch-prep">
                      <p className="ch-prep-line">{prep}</p>
                      <p className="mn-quiet">
                        {withVariants ? CHW.acrossVariants(ways) : CHW.fromPicks}
                      </p>
                    </div>
                  )}
                </div>
                {manage && (
                  <div className="lib-acts vr-acts" role="group" aria-label={CHW.actionsFor(named)}>
                    <HintButton
                      id={`mc-chedit-${choice.id}`}
                      label={draft ? CHW.finishAria(named) : CHW.editAria(named)}
                      hint={draft ? CHW.finish : CHW.edit}
                      className="lib-act"
                      onClick={() => onEdit(choice)}
                    >
                      <ActionGlyph icon="edit" />
                    </HintButton>
                    <DescribedHintButton
                      id={`mc-chremove-${choice.id}`}
                      label={CHW.removeAria(named)}
                      hint={CHW.remove}
                      className="lib-act"
                      describedBy={here?.kind === 'answered' ? `mc-chline-${choice.id}` : null}
                      onClick={() => onRemove(choice)}
                    >
                      <ActionGlyph icon="remove" />
                    </DescribedHintButton>
                  </div>
                )}
              </div>
              {here?.kind === 'answered' && (
                <RowLine id={`mc-chline-${choice.id}`} words={[CHW.answered]} />
              )}
              {here?.kind === 'ask' && (
                <div className="mn-ask">
                  <p id={`mc-chask-${choice.id}`} tabIndex={-1}>
                    {CHW.removeAsk(choice.question, dish.name)}
                  </p>
                  <div className="mn-ask-acts">
                    <button type="button" className="desk-text" onClick={() => onKeep(choice)}>
                      {CHW.keepIt}
                    </button>
                    <Pill label={CHW.removeChoice} onClick={() => onConfirmRemove(choice)} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
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

function Warn({ id, words }: { id: string; words: string }) {
  return (
    <p id={id} className="ch-warn" role="status">
      <span className="mc-ring is-warn" aria-hidden="true">
        !
      </span>
      {words}
    </p>
  );
}

const described = (...ids: (string | null | false | undefined)[]): string | undefined => {
  const joined = ids.filter(Boolean).join(' ');

  return joined === '' ? undefined : joined;
};

function OptionBlock({
  at,
  form,
  errors,
  open,
  binRefused,
  lang,
  onPatch,
  onOpen,
  onBin,
}: {
  at: number;
  form: OptionForm;
  errors: ChoiceErrors['options'][number] | null;
  open: boolean;
  binRefused: boolean;
  lang: Lang;
  onPatch: (next: Partial<OptionForm>) => void;
  onOpen: () => void;
  onBin: () => void;
}) {
  const p = blockId(form.key);
  const length = lengthOf(form.name);
  const title = form.name.trim() === '' ? CHW.option(at + 1) : form.name.trim();
  const contains = optionContains(form);
  const pickedLine = binRefused ? CHW.optionPicked : (errors?.picked ?? null);

  return (
    <section className="vr-block ch-block" aria-labelledby={`${p}-title`}>
      <div className="ch-block-top">
        <h4 id={`${p}-title`} className="vr-block-title">
          {title}
        </h4>
        <DescribedHintButton
          id={`${p}-bin`}
          label={CHW.removeOption(title)}
          hint={CHW.removeOption(title)}
          className="lib-act"
          describedBy={pickedLine == null ? null : `${p}-picked`}
          onClick={onBin}
        >
          <ActionGlyph icon="bin" />
        </DescribedHintButton>
      </div>
      <div className="desk-field">
        <label htmlFor={`${p}-name`} className="desk-label gs-label">
          {CHW.name}
        </label>
        <div className={errors?.name == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={`${p}-name`}
            type="text"
            value={form.name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors?.name != null || errors?.picked != null}
            aria-describedby={described(
              `${p}-count`,
              errors?.name != null && `${p}-name-error`,
              pickedLine != null && `${p}-picked`,
            )}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id={`${p}-count`}
          className={length > OPTION_NAME_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {LW.counter(length, OPTION_NAME_MAX)}
        </p>
        {errors?.name != null && <Wrong id={`${p}-name-error`}>{errors.name}</Wrong>}
      </div>
      <div className="ch-contains-row">
        <ContainsLine contains={contains} lang={lang} withVariants={false} />
        <button
          id={`${p}-allergens`}
          type="button"
          className="desk-text"
          aria-expanded={open}
          aria-controls={`${p}-list`}
          aria-describedby={`${p}-title`}
          onClick={onOpen}
        >
          {contains == null ? CHW.setAllergens : CHW.changeAllergens}
        </button>
      </div>
      {open && (
        <fieldset
          id={`${p}-list`}
          className="lib-set"
          aria-invalid={errors?.contains != null || undefined}
          aria-describedby={errors?.contains != null ? `${p}-contains-error` : undefined}
        >
          <legend className="desk-unseen">{`${LW.containsLegend} · ${title}`}</legend>
          <div className="lib-ticks">
            {DISH_ALLERGENS.map((code: DishAllergen) => (
              <label key={code} className="gs-tick lib-tick">
                <input
                  id={`${p}-has-${code}`}
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
              id={`${p}-none`}
              type="checkbox"
              className="gs-box"
              checked={form.none}
              onChange={() => onPatch({ none: !form.none, allergens: [] })}
            />
            {LW.none}
          </label>
        </fieldset>
      )}
      {errors?.contains != null && <Wrong id={`${p}-contains-error`}>{errors.contains}</Wrong>}
      {pickedLine != null && <Warn id={`${p}-picked`} words={pickedLine} />}
    </section>
  );
}

/** The choice's form: the question, 2 to 8 options each with its Contains, how many guests pick, Required, and the draft box. */
export function ChoiceFields({
  form,
  errors,
  draft,
  ways,
  openKey,
  binRefused,
  optionsFull,
  lang,
  intro,
  onPatch,
  onOption,
  onOpen,
  onBin,
  onAddOption,
}: {
  form: ChoiceForm;
  errors: ChoiceErrors | null;
  draft: string[] | null;
  ways: number;
  openKey: string | null;
  binRefused: string | null;
  optionsFull: boolean;
  lang: Lang;
  intro: ReactNode;
  onPatch: (next: Partial<ChoiceForm>) => void;
  onOption: (key: string, next: Partial<OptionForm>) => void;
  onOpen: (key: string) => void;
  onBin: (key: string) => void;
  onAddOption: () => void;
}) {
  const length = lengthOf(form.question);
  const max = pickMax(form);
  const named = namedCount(form);
  const staysFinished = errors?.staysFinished ?? null;

  return (
    <>
      {intro}
      <div className="desk-field">
        <label htmlFor="ch-question" className="desk-label gs-label">
          {CHW.question}
        </label>
        <div
          className={
            errors?.question == null && staysFinished == null ? 'desk-box' : 'desk-box is-wrong'
          }
        >
          <input
            id="ch-question"
            type="text"
            value={form.question}
            autoComplete="off"
            aria-invalid={errors?.question != null || staysFinished != null}
            aria-describedby={described(
              'ch-question-count',
              errors?.question != null && 'ch-question-error',
              staysFinished != null && 'ch-stays',
            )}
            onChange={(event) => onPatch({ question: event.target.value })}
          />
        </div>
        <p
          id="ch-question-count"
          className={length > QUESTION_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {LW.counter(length, QUESTION_MAX)}
        </p>
        {errors?.question != null && <Wrong id="ch-question-error">{errors.question}</Wrong>}
      </div>
      <div className="ch-options-head">
        <h3 className="desk-label gs-label">{CHW.options}</h3>
        <p className="lib-counter">{LW.counter(form.options.length, 8)}</p>
      </div>
      {form.options.map((one, at) => (
        <OptionBlock
          key={one.key}
          at={at}
          form={one}
          errors={errors?.options[at] ?? null}
          open={openKey === one.key}
          binRefused={binRefused === one.key}
          lang={lang}
          onPatch={(next) => onOption(one.key, next)}
          onOpen={() => onOpen(one.key)}
          onBin={() => onBin(one.key)}
        />
      ))}
      <div className="ch-add-option">
        <button
          id="ch-add-option"
          type="button"
          className="mn-add-dish"
          aria-describedby={described(
            optionsFull && 'ch-options-full',
            staysFinished != null && 'ch-stays',
          )}
          onClick={onAddOption}
        >
          <Glyph name="plus" size={16} weight={2.4} />
          {CHW.addOption}
        </button>
        {optionsFull && <Warn id="ch-options-full" words={CHW.optionsLimit} />}
      </div>
      <fieldset
        className="lib-set ch-pick"
        aria-describedby={described('ch-pick-hint', errors?.pick != null && 'ch-pick-error')}
      >
        <legend className="desk-label gs-label">{CHW.pickExactly}</legend>
        <div className="ch-stepper">
          <button
            id="ch-fewer"
            type="button"
            className="ev-round ch-step"
            aria-label={CHW.oneFewer}
            aria-describedby={errors?.pick != null ? 'ch-pick-error' : undefined}
            disabled={form.pick <= 1}
            onClick={() => onPatch({ pick: form.pick - 1 })}
          >
            <Glyph name="minus" size={18} weight={2.4} />
          </button>
          <output className="ch-count" aria-live="polite">
            {form.pick}
          </output>
          <button
            id="ch-more"
            type="button"
            className="ev-round ch-step"
            aria-label={CHW.oneMore}
            aria-describedby={errors?.pick != null ? 'ch-pick-error' : undefined}
            disabled={form.pick >= max || named < 2}
            onClick={() => onPatch({ pick: form.pick + 1 })}
          >
            <Glyph name="plus" size={18} weight={2.4} />
          </button>
        </div>
        <p id="ch-pick-hint" className="desk-help">
          {stepperHint(form)}
        </p>
        {errors?.pick != null && <Warn id="ch-pick-error" words={errors.pick} />}
      </fieldset>
      <div className="desk-field">
        <label className="gs-tick lib-tick ch-required">
          <input
            id="ch-required"
            type="checkbox"
            className="gs-box"
            checked={form.required}
            aria-invalid={errors?.required != null || undefined}
            aria-describedby={described(
              !form.required && 'ch-required-help',
              errors?.required != null && 'ch-required-error',
            )}
            onChange={() => onPatch({ required: !form.required })}
          />
          {CHW.required}
        </label>
        {!form.required && (
          <p id="ch-required-help" className="desk-help">
            {CHW.optionalHelp}
          </p>
        )}
        {errors?.required != null && <Warn id="ch-required-error" words={errors.required} />}
      </div>
      <div role="status" className="ch-status">
        {staysFinished != null ? (
          <div id="ch-stays" className="ch-stays">
            <p className="ch-stays-head">
              <Glyph name="alert" size={16} weight={2.2} />
              {CHW.answeredDraft}
            </p>
            <ul>
              {staysFinished.map((one) => (
                <li key={one}>{one}</li>
              ))}
            </ul>
          </div>
        ) : (
          draft != null && (
            <div className="ch-draft">
              <p>{CHW.draftBox(ways)}</p>
              <ul>
                {draft.map((one) => (
                  <li key={one}>{one}</li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
    </>
  );
}

/** The panel's first lines: that options aren't priced, which choice this is, and on a dish with variants, that they apply to every one. */
export function ChoiceIntro({ ways, k }: { ways: number; k: number | null }) {
  return (
    <div className="ch-intro">
      <p className="desk-help">{CHW.notPriced}</p>
      {k != null && <p className="desk-help">{CHW.willBe(k)}</p>}
      {ways > 0 && (
        <>
          <p className="desk-help">{CHW.applyTo(ways)}</p>
          <p className="desk-help">{CHW.variantFirst}</p>
        </>
      )}
    </div>
  );
}
