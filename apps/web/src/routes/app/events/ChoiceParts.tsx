import {
  CHOICE_OPTION_NAME_MAXIMUM,
  CHOICE_OPTIONS_MAXIMUM,
  CHOICE_OPTIONS_MINIMUM,
  CHOICE_QUESTION_MAXIMUM,
  CHOICES_PER_DISH_MAXIMUM,
  DISH_ALLERGENS,
  type DishAllergen,
  type MenuDish,
  type MenuDishChoice,
} from '@soirely/api-client';
import {
  type ChoiceForm,
  type ChoiceOptionForm,
  type ChoiceProblems,
  type DraftReason,
  choiceBlockId,
  dishLength,
  draftReasons,
  isItem,
  listFormat,
  namedOptionCount,
  optionPicked,
  pickMax,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type ComponentProps, type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { HintButton } from '../../../components/HintButton.tsx';
import { ActionGlyph } from '../menu/DishParts.tsx';
import { Wrong } from '../menu/MenuFields.tsx';
import { RowLine } from '../menu/VariantParts.tsx';
import { choiceName, draftWords } from './choiceWords.ts';
import './choices.css';

export type ChoiceAsk = { choiceId: string; kind: 'ask' | 'answered' };

function ChecklistGlyph() {
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
  const { t } = useTranslation();

  return (
    <HintButton
      id={id}
      label={t('dishChoices.addChoiceAria', { dish })}
      hint={t('dishChoices.addChoice')}
      className="lib-act"
      onClick={onClick}
    >
      <ChecklistGlyph />
    </HintButton>
  );
}

/** HintButton takes no aria-describedby, so the line that says why nothing happened is attached here. */
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

export function NotOffered({ variants }: { variants: number }) {
  const { t } = useTranslation();

  return (
    <span className="ch-not-offered">
      <span className="mc-state is-empty">
        <span className="mc-ring is-empty" aria-hidden="true" />
        {t('dishChoices.notOffered')}
      </span>
      {variants >= 2 && (
        <span className="mn-quiet">
          {variants === 2
            ? t('dishChoices.hiddenInBoth')
            : t('dishChoices.hiddenInAll', { count: variants })}
        </span>
      )}
    </span>
  );
}

export function DraftTag() {
  const { t } = useTranslation();

  return (
    <span className="ch-draft-tag">
      <Glyph name="pen" size={13} weight={2.4} />
      {t('dishChoices.draftTag')}
    </span>
  );
}

function containsWords(
  t: TFunction,
  allergens: readonly DishAllergen[] | null,
  withVariants: boolean,
): string {
  if (allergens == null) return t('menuLibrary.notStated');
  if (allergens.length === 0) return t('menuLibrary.containsNone');
  const line = t('menuLibrary.contains', {
    names: DISH_ALLERGENS.filter((code) => allergens.includes(code))
      .map((code) => t(`guestNeeds.allergen.${code}`))
      .join(' · '),
  });

  return withVariants ? t('dishChoices.addedToVariant', { line }) : line;
}

function ContainsLine({
  allergens,
  withVariants,
}: {
  allergens: readonly DishAllergen[] | null;
  withVariants: boolean;
}) {
  const { t } = useTranslation();
  const kind = allergens == null ? 'unknown' : allergens.length === 0 ? 'none' : 'some';

  return (
    <p className={`lib-contains is-${kind}`}>
      <span className="lib-mark" aria-hidden="true">
        {kind === 'unknown' ? '?' : kind === 'none' ? '0' : '!'}
      </span>
      {containsWords(t, allergens, withVariants)}
    </p>
  );
}

function kitchenPrep(t: TFunction, language: string, choice: MenuDishChoice): string | null {
  if (!choice.options.some(optionPicked)) return null;

  return t('dishChoices.prep', {
    parts: listFormat(language, { type: 'unit' }).format(
      choice.options.map((one) =>
        t('dishChoices.prepPart', {
          count: one.picks,
          option: one.name.toLocaleLowerCase(language),
        }),
      ),
    ),
  });
}

export function ChoiceInsets({
  dish,
  manage,
  asking,
  lit,
  onEdit,
  onRemove,
  onKeep,
  onConfirm,
}: {
  dish: MenuDish;
  manage: boolean;
  asking: ChoiceAsk | null;
  lit: string | null;
  onEdit: (choice: MenuDishChoice) => void;
  onRemove: (choice: MenuDishChoice) => void;
  onKeep: (choice: MenuDishChoice) => void;
  onConfirm: (choice: MenuDishChoice) => void;
}) {
  const { t, i18n } = useTranslation();
  const ways = dish.variants.length;
  const withVariants = ways > 0;

  return (
    <div className="ch-box">
      {withVariants && <p className="ch-head">{t('dishChoices.choicesHead')}</p>}
      <ul className="ch-insets">
        {dish.choices.map((choice, at) => {
          const here = asking?.choiceId === choice.id ? asking : null;
          const named = choiceName(t, choice, at);
          const prep = kitchenPrep(t, i18n.language, choice);
          const line = { pick: choice.pick, count: choice.options.length };

          return (
            <li key={choice.id} className="vr-item">
              <div className={lit === choice.id ? 'vr-inset ch-inset is-lit' : 'vr-inset ch-inset'}>
                <div className="vr-words">
                  <h4 className="vr-name">
                    {named}
                    {choice.draft && <DraftTag />}
                    {withVariants && (
                      <span className="vr-children">{t('dishChoices.everyVariant')}</span>
                    )}
                  </h4>
                  <p className="mn-quiet">
                    {choice.required
                      ? t('dishChoices.pickLineRequired', line)
                      : t('dishChoices.pickLineOptional', line)}
                  </p>
                  <ul className="ch-options">
                    {choice.options.map((one) => (
                      <li key={one.id} className="ch-option">
                        <span className="ch-option-name">{one.name}</span>
                        <ContainsLine allergens={one.allergens} withVariants={withVariants} />
                      </li>
                    ))}
                  </ul>
                  {choice.draft && (
                    <div className="ch-draft">
                      <p>{t('dishChoices.draftLine')}</p>
                      <ul>
                        {draftReasons(choice).map((one) => (
                          <li key={one.kind}>{draftWords(t, one)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {prep != null && (
                    <div className="ch-prep">
                      <p className="ch-prep-line">{prep}</p>
                      <p className="mn-quiet">
                        {!withVariants
                          ? t('dishChoices.fromPicks')
                          : ways === 2
                            ? t('dishChoices.acrossBoth')
                            : t('dishChoices.acrossAll', { count: ways })}
                      </p>
                    </div>
                  )}
                </div>
                {manage && (
                  <div
                    className="lib-acts vr-acts"
                    role="group"
                    aria-label={t('dishChoices.actionsFor', { question: named })}
                  >
                    <HintButton
                      id={`mc-chedit-${choice.id}`}
                      label={
                        choice.draft
                          ? t('dishChoices.finishAria', { question: named })
                          : t('dishChoices.editAria', { question: named })
                      }
                      hint={choice.draft ? t('dishChoices.finishHint') : t('dishChoices.editHint')}
                      className="lib-act"
                      onClick={() => onEdit(choice)}
                    >
                      <ActionGlyph icon="edit" />
                    </HintButton>
                    <DescribedHintButton
                      id={`mc-chremove-${choice.id}`}
                      label={t('dishChoices.removeAria', { question: named })}
                      hint={t('dishChoices.removeHint')}
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
                <RowLine id={`mc-chline-${choice.id}`} words={[t('dishChoices.answered')]} />
              )}
              {here?.kind === 'ask' && (
                <div className="mn-ask">
                  <p id={`mc-chask-${choice.id}`} tabIndex={-1}>
                    {t('dishChoices.removeAsk', { question: choice.question, dish: dish.name })}
                    {isItem(dish, choice.id) &&
                      ` ${t('dishItems.choiceIsItem', { question: choice.question, dish: dish.name })}`}
                  </p>
                  <div className="mn-ask-acts">
                    <button type="button" className="desk-text" onClick={() => onKeep(choice)}>
                      {t('dishChoices.keepIt')}
                    </button>
                    <button
                      type="button"
                      className="gs-pill is-secondary"
                      onClick={() => onConfirm(choice)}
                    >
                      {t('dishChoices.removeChoice')}
                    </button>
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

function optionNameWords(t: TFunction, problem: 'blank' | 'long' | 'taken'): string {
  if (problem === 'blank') return t('dishChoices.nameBlank');
  if (problem === 'long') return t('dishChoices.nameLong', { most: CHOICE_OPTION_NAME_MAXIMUM });

  return t('dishChoices.nameTaken');
}

function OptionBlock({
  at,
  form,
  problems,
  open,
  binRefused,
  onPatch,
  onOpen,
  onBin,
}: {
  at: number;
  form: ChoiceOptionForm;
  problems: ChoiceProblems['options'][number] | null;
  open: boolean;
  binRefused: boolean;
  onPatch: (next: Partial<ChoiceOptionForm>) => void;
  onOpen: () => void;
  onBin: () => void;
}) {
  const { t } = useTranslation();
  const p = choiceBlockId(form.key);
  const length = dishLength(form.name);
  const title = form.name.trim() === '' ? t('dishChoices.option', { n: at + 1 }) : form.name.trim();
  const allergens = form.none ? [] : form.allergens.length > 0 ? form.allergens : null;
  const pickedLine = binRefused || problems?.picked === true ? t('dishChoices.optionPicked') : null;
  const nameWrong = problems?.name ?? null;

  return (
    <section className="vr-block ch-block" aria-labelledby={`${p}-title`}>
      <div className="ch-block-top">
        <h4 id={`${p}-title`} className="vr-block-title">
          {title}
        </h4>
        <DescribedHintButton
          id={`${p}-bin`}
          label={t('dishChoices.removeOption', { name: title })}
          hint={t('dishChoices.removeOption', { name: title })}
          className="lib-act"
          describedBy={pickedLine == null ? null : `${p}-picked`}
          onClick={onBin}
        >
          <ActionGlyph icon="bin" />
        </DescribedHintButton>
      </div>
      <div className="desk-field">
        <label htmlFor={`${p}-name`} className="desk-label gs-label">
          {t('dishChoices.name')}
        </label>
        <div className={nameWrong == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={`${p}-name`}
            type="text"
            value={form.name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={nameWrong != null || problems?.picked === true}
            aria-describedby={described(
              `${p}-count`,
              nameWrong != null && `${p}-name-error`,
              pickedLine != null && `${p}-picked`,
            )}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id={`${p}-count`}
          className={length > CHOICE_OPTION_NAME_MAXIMUM ? 'lib-counter is-over' : 'lib-counter'}
        >
          {t('menuLibrary.counter', { count: length, most: CHOICE_OPTION_NAME_MAXIMUM })}
        </p>
        {nameWrong != null && <Wrong id={`${p}-name-error`}>{optionNameWords(t, nameWrong)}</Wrong>}
      </div>
      <div className="ch-contains-row">
        <ContainsLine allergens={allergens} withVariants={false} />
        <button
          id={`${p}-allergens`}
          type="button"
          className="desk-text"
          aria-expanded={open}
          aria-controls={`${p}-list`}
          aria-describedby={`${p}-title`}
          onClick={onOpen}
        >
          {allergens == null ? t('dishChoices.setAllergens') : t('dishChoices.changeAllergens')}
        </button>
      </div>
      {open && (
        <fieldset
          id={`${p}-list`}
          className="lib-set"
          aria-invalid={problems?.contains != null || undefined}
          aria-describedby={problems?.contains != null ? `${p}-contains-error` : undefined}
        >
          <legend className="desk-unseen">{`${t('menuLibrary.containsLegend')} · ${title}`}</legend>
          <div className="lib-ticks">
            {DISH_ALLERGENS.map((code) => (
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
                {t(`guestNeeds.allergen.${code}`)}
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
            {t('menuLibrary.none')}
          </label>
        </fieldset>
      )}
      {problems?.contains != null && (
        <Wrong id={`${p}-contains-error`}>{t('menuLibrary.containsBlank')}</Wrong>
      )}
      {pickedLine != null && <Warn id={`${p}-picked`} words={pickedLine} />}
    </section>
  );
}

function draftBoxWords(t: TFunction, ways: number): string {
  if (ways === 0) return t('dishChoices.draftBox');

  return ways === 2 ? t('dishChoices.draftBoxBoth') : t('dishChoices.draftBoxAll');
}

function stepperHint(t: TFunction, form: ChoiceForm): string {
  const count = namedOptionCount(form);
  if (count < CHOICE_OPTIONS_MINIMUM)
    return t('dishChoices.pickShort', { count, least: CHOICE_OPTIONS_MINIMUM });
  const max = pickMax(form);

  return max <= 1
    ? t('dishChoices.pickRangeOne', { count })
    : t('dishChoices.pickRange', { count, max });
}

export function ChoiceIntro({ ways, n }: { ways: number; n: number | null }) {
  const { t } = useTranslation();

  return (
    <div className="ch-intro">
      <p className="desk-help">{t('dishChoices.notPriced')}</p>
      {n != null && (
        <p className="desk-help">
          {t('dishChoices.willBe', { n, most: CHOICES_PER_DISH_MAXIMUM })}
        </p>
      )}
      {ways > 0 && (
        <>
          <p className="desk-help">
            {ways === 2
              ? t('dishChoices.applyToBoth')
              : t('dishChoices.applyToAll', { count: ways })}
          </p>
          <p className="desk-help">{t('dishChoices.variantFirst')}</p>
        </>
      )}
    </div>
  );
}

export function ChoiceFields({
  form,
  problems,
  draft,
  ways,
  openKey,
  binRefused,
  optionsFull,
  intro,
  onPatch,
  onOption,
  onOpen,
  onBin,
  onAddOption,
}: {
  form: ChoiceForm;
  problems: ChoiceProblems | null;
  draft: DraftReason[] | null;
  ways: number;
  openKey: string | null;
  binRefused: string | null;
  optionsFull: boolean;
  intro: ReactNode;
  onPatch: (next: Partial<ChoiceForm>) => void;
  onOption: (key: string, next: Partial<ChoiceOptionForm>) => void;
  onOpen: (key: string) => void;
  onBin: (key: string) => void;
  onAddOption: () => void;
}) {
  const { t } = useTranslation();
  const length = dishLength(form.question);
  const max = pickMax(form);
  const named = namedOptionCount(form);
  const staysFinished = problems?.staysFinished ?? null;
  const questionLong = problems?.question != null;

  return (
    <>
      {intro}
      <div className="desk-field">
        <label htmlFor="ch-question" className="desk-label gs-label">
          {t('dishChoices.question')}
        </label>
        <div className={!questionLong && staysFinished == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id="ch-question"
            type="text"
            value={form.question}
            autoComplete="off"
            aria-invalid={questionLong || staysFinished != null}
            aria-describedby={described(
              'ch-question-count',
              questionLong && 'ch-question-error',
              staysFinished != null && 'ch-stays',
            )}
            onChange={(event) => onPatch({ question: event.target.value })}
          />
        </div>
        <p
          id="ch-question-count"
          className={length > CHOICE_QUESTION_MAXIMUM ? 'lib-counter is-over' : 'lib-counter'}
        >
          {t('menuLibrary.counter', { count: length, most: CHOICE_QUESTION_MAXIMUM })}
        </p>
        {questionLong && (
          <Wrong id="ch-question-error">
            {t('dishChoices.questionLong', { most: CHOICE_QUESTION_MAXIMUM })}
          </Wrong>
        )}
      </div>
      <div className="ch-options-head">
        <h3 className="desk-label gs-label">{t('dishChoices.options')}</h3>
        <p className="lib-counter">
          {t('menuLibrary.counter', { count: form.options.length, most: CHOICE_OPTIONS_MAXIMUM })}
        </p>
      </div>
      {form.options.map((one, at) => (
        <OptionBlock
          key={one.key}
          at={at}
          form={one}
          problems={problems?.options[at] ?? null}
          open={openKey === one.key}
          binRefused={binRefused === one.key}
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
          {t('dishChoices.addOption')}
        </button>
        {optionsFull && (
          <Warn
            id="ch-options-full"
            words={t('dishChoices.optionsLimit', { most: CHOICE_OPTIONS_MAXIMUM })}
          />
        )}
      </div>
      <fieldset
        className="lib-set ch-pick"
        aria-describedby={described('ch-pick-hint', problems?.pick === true && 'ch-pick-error')}
      >
        <legend className="desk-label gs-label">{t('dishChoices.pickExactly')}</legend>
        <div className="ch-stepper">
          <button
            id="ch-fewer"
            type="button"
            className="ev-round ch-step"
            aria-label={t('dishChoices.oneFewer')}
            aria-describedby={problems?.pick === true ? 'ch-pick-error' : undefined}
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
            aria-label={t('dishChoices.oneMore')}
            aria-describedby={problems?.pick === true ? 'ch-pick-error' : undefined}
            disabled={form.pick >= max || named < CHOICE_OPTIONS_MINIMUM}
            onClick={() => onPatch({ pick: form.pick + 1 })}
          >
            <Glyph name="plus" size={18} weight={2.4} />
          </button>
        </div>
        <p id="ch-pick-hint" className="desk-help">
          {stepperHint(t, form)}
        </p>
        {problems?.pick === true && <Warn id="ch-pick-error" words={t('dishChoices.answered')} />}
      </fieldset>
      <div className="desk-field">
        <label className="gs-tick lib-tick ch-required">
          <input
            id="ch-required"
            type="checkbox"
            className="gs-box"
            checked={form.required}
            aria-invalid={problems?.required === true || undefined}
            aria-describedby={described(
              !form.required && 'ch-required-help',
              problems?.required === true && 'ch-required-error',
            )}
            onChange={() => onPatch({ required: !form.required })}
          />
          {t('dishChoices.required')}
        </label>
        {!form.required && (
          <p id="ch-required-help" className="desk-help">
            {t('dishChoices.optionalHelp')}
          </p>
        )}
        {problems?.required === true && (
          <Warn id="ch-required-error" words={t('dishChoices.answered')} />
        )}
      </div>
      <div role="status" className="ch-status">
        {staysFinished != null ? (
          <div id="ch-stays" className="ch-stays">
            <p className="ch-stays-head">
              <Glyph name="alert" size={16} weight={2.2} />
              {t('dishChoices.answeredDraft')}
            </p>
            <ul>
              {staysFinished.map((one) => (
                <li key={one.kind}>{draftWords(t, one)}</li>
              ))}
            </ul>
          </div>
        ) : (
          draft != null && (
            <div className="ch-draft">
              <p>{draftBoxWords(t, ways)}</p>
              <ul>
                {draft.map((one) => (
                  <li key={one.kind}>{draftWords(t, one)}</li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
    </>
  );
}
