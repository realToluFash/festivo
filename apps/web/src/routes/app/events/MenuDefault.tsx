import type { MenuCourse, MenuDishChoice } from '@soirely/api-client';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionPair } from '../../../components/ActionPair.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { Wrong } from '../menu/MenuFields.tsx';
import {
  type DefaultDates,
  type DefaultErrors,
  type DefaultForm,
  type Move,
  CHOOSE_BY_ID,
  CLEARED,
  dishRadio,
  everyoneVariants,
  hasChildrenOnly,
  offeredDishes,
  optionInput,
  requiredChoices,
  moveWords,
  variantRadio,
  withDish,
} from './courseDefault.ts';
import './menuDefault.css';

const described = (...ids: (string | false | null)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/** sc-1362's group in Edit course, as its demo draws it: the default as a whole pick, and the choose-by date it is given on. */
export function DefaultFields({
  course,
  form,
  errors,
  dates,
  zone,
  day,
  onPatch,
}: {
  course: MenuCourse;
  form: DefaultForm;
  errors: DefaultErrors | null;
  dates: DefaultDates;
  zone: string;
  day: (date: string) => string;
  onPatch: (next: DefaultForm) => void;
}) {
  const { t } = useTranslation();
  const locked = dates.locked;
  const dish = course.dishes.find((one) => one.id === form.dishId) ?? null;
  const variants = dish == null ? [] : everyoneVariants(dish);

  return (
    <section className="mc-def" aria-labelledby="mc-def-h">
      <h3 id="mc-def-h" className="mc-def-h">
        {t('courseDefault.heading')}
        <span className="gs-optional">{t('menuLibrary.optional')}</span>
      </h3>
      <p className="desk-help">{t('courseDefault.help')}</p>
      <fieldset
        className="mc-def-set"
        aria-invalid={errors?.dish != null || undefined}
        aria-describedby={described(errors?.dish != null && 'mc-def-dish-error')}
      >
        <legend className="desk-label gs-label">{t('courseDefault.default')}</legend>
        <div className={errors?.dish == null ? 'mc-def-radios' : 'mc-def-radios is-wrong'}>
          {!locked && (
            <PickInput
              id={dishRadio(null)}
              name="mc-def-dish"
              label={t('courseDefault.noDefault')}
              on={form.dishId == null}
              onPick={() => onPatch(withDish(course, form, null))}
            />
          )}
          {offeredDishes(course).map((one) => (
            <PickInput
              key={one.id}
              id={dishRadio(one.id)}
              name="mc-def-dish"
              label={one.name}
              on={form.dishId === one.id}
              onPick={() => onPatch(withDish(course, form, one.id))}
            />
          ))}
        </div>
        {errors?.dish != null && <Wrong id="mc-def-dish-error">{errors.dish}</Wrong>}
        {dish != null && variants.length > 0 && (
          <fieldset
            className="mc-def-set is-nested"
            aria-invalid={errors?.variant != null || undefined}
            aria-describedby={described(
              hasChildrenOnly(dish) && 'mc-def-children',
              errors?.variant != null && 'mc-def-variant-error',
            )}
          >
            <legend className="desk-label gs-label">{t('courseDefault.variant')}</legend>
            <div className={errors?.variant == null ? 'mc-def-radios' : 'mc-def-radios is-wrong'}>
              {variants.map((one) => (
                <PickInput
                  key={one.id}
                  id={variantRadio(one.id)}
                  name="mc-def-variant"
                  label={one.name}
                  on={form.variantId === one.id}
                  onPick={() => onPatch({ ...form, variantId: one.id })}
                />
              ))}
            </div>
            {hasChildrenOnly(dish) && (
              <p id="mc-def-children" className="desk-help">
                {t('courseDefault.childrenOnly')}
              </p>
            )}
            {errors?.variant != null && <Wrong id="mc-def-variant-error">{errors.variant}</Wrong>}
          </fieldset>
        )}
        {dish != null &&
          requiredChoices(dish).map((choice) => (
            <ChoiceSet
              key={choice.id}
              choice={choice}
              picked={form.options[choice.id] ?? []}
              error={errors?.choices[choice.id] ?? null}
              onPick={(ids) => onPatch({ ...form, options: { ...form.options, [choice.id]: ids } })}
            />
          ))}
      </fieldset>
      {locked && dates.stored != null ? (
        <div className="desk-field">
          <p className="desk-label gs-label">{t('courseDefault.chooseBy')}</p>
          <p className="mc-def-locked">
            <Glyph name="lock" size={15} weight={2.4} />
            {day(dates.stored)}
          </p>
          <p className="desk-help">{t('courseDefault.locked', { date: day(dates.stored) })}</p>
        </div>
      ) : (
        <div className="desk-field">
          <label htmlFor={CHOOSE_BY_ID} className="desk-label gs-label">
            {t('courseDefault.chooseBy')}
          </label>
          <div
            className={
              errors?.chooseBy == null ? 'desk-box mc-def-date' : 'desk-box mc-def-date is-wrong'
            }
          >
            <input
              id={CHOOSE_BY_ID}
              type="date"
              value={form.chooseBy}
              aria-invalid={errors?.chooseBy != null}
              aria-describedby={described(
                'mc-choose-by-help',
                errors?.chooseBy != null && 'mc-choose-by-error',
              )}
              onChange={(event) => onPatch({ ...form, chooseBy: event.target.value })}
            />
          </div>
          <p id="mc-choose-by-help" className="desk-help">
            {t('courseDefault.chooseByHint', { course: course.name, zone, date: day(dates.event) })}
          </p>
          {errors?.chooseBy != null && <Wrong id="mc-choose-by-error">{errors.chooseBy}</Wrong>}
        </div>
      )}
      {!locked && (form.dishId != null || form.chooseBy !== '') && (
        <button
          type="button"
          className="desk-text mc-def-clear"
          onClick={() => {
            onPatch(CLEARED);
            document.getElementById(dishRadio(null))?.focus();
          }}
        >
          {t('courseDefault.clear')}
        </button>
      )}
    </section>
  );
}

function PickInput({
  id,
  name,
  label,
  on,
  many = false,
  onPick,
}: {
  id: string;
  name: string;
  label: string;
  on: boolean;
  many?: boolean;
  onPick: () => void;
}) {
  return (
    <label className="mc-radio" htmlFor={id}>
      <input
        id={id}
        type={many ? 'checkbox' : 'radio'}
        className={many ? 'gs-box' : 'desk-radio'}
        name={name}
        checked={on}
        onChange={onPick}
      />
      {label}
    </label>
  );
}

function ChoiceSet({
  choice,
  picked,
  error,
  onPick,
}: {
  choice: MenuDishChoice;
  picked: readonly string[];
  error: string | null;
  onPick: (ids: readonly string[]) => void;
}) {
  const { t } = useTranslation();
  const many = choice.pick > 1;
  const errorId = `mc-def-c-${choice.id}-error`;

  return (
    <fieldset
      className="mc-def-set is-nested"
      aria-invalid={error != null || undefined}
      aria-describedby={described(`mc-def-c-${choice.id}-hint`, error != null && errorId)}
    >
      <legend className="desk-label gs-label">{choice.question}</legend>
      <p id={`mc-def-c-${choice.id}-hint`} className="desk-help">
        {t('courseDefault.chooseN', { count: choice.pick })}
      </p>
      <div className={error == null ? 'mc-def-radios' : 'mc-def-radios is-wrong'}>
        {choice.options.map((one) => (
          <PickInput
            key={one.id}
            id={optionInput(choice.id, one.id)}
            name={`mc-def-c-${choice.id}`}
            label={one.name}
            on={picked.includes(one.id)}
            many={many}
            onPick={() =>
              onPick(
                !many
                  ? [one.id]
                  : picked.includes(one.id)
                    ? picked.filter((id) => id !== one.id)
                    : [...picked, one.id],
              )
            }
          />
        ))}
      </div>
      {error != null && <Wrong id={errorId}>{error}</Wrong>}
    </fieldset>
  );
}

/** "Move {n} guests to {dish}?", or "Change the default to {dish}?" when nobody moves; Cancel first and focused, so Escape or Enter changes nothing. */
export function MoveDialog({
  move,
  busy,
  onCancel,
  onMove,
}: {
  move: Move;
  busy: boolean;
  onCancel: () => void;
  onMove: () => void;
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const words = moveWords(t, move);

  useDialogKeys(box, onCancel, false);
  useEffect(() => cancel.current?.focus(), []);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog mc-move"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mc-move-title"
        aria-describedby="mc-move-body"
      >
        <div className="dialog-heading">
          <h2 id="mc-move-title">{words.title}</h2>
          <p id="mc-move-body" className="dialog-body">
            {words.body}
          </p>
        </div>
        <ActionPair
          className="dialog-actions"
          dismiss={
            <button ref={cancel} type="button" className="link-button" onClick={onCancel}>
              {t('courseDefault.cancel')}
            </button>
          }
          confirm={
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={onMove}
            >
              {words.go}
            </button>
          }
        />
      </div>
    </>
  );
}
