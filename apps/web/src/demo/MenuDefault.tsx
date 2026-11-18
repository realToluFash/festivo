import { useEffect, useRef } from 'react';

import { ActionPair } from '../components/ActionPair.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { useDialogKeys } from '../dialogFocus.ts';
import {
  type DefaultDates,
  type DefaultErrors,
  type DefaultForm,
  type Move,
  CHOOSE_BY_ID,
  CLEARED,
  DFW,
  dishRadio,
  everyoneVariants,
  hasChildrenOnly,
  isLocked,
  offeredDishes,
  optionInput,
  requiredChoices,
  variantRadio,
  withDish,
} from './courseDefault.ts';
import type { Choice } from './dishChoices.ts';
import { type EvCourse, CW } from './menuCourses.ts';
import { Wrong } from './MenuCoursesParts.tsx';
import type { Lang } from './menuLibrary.ts';
import { dayWords } from './picksClose.ts';
import './menuDefault.css';

const described = (...ids: (string | false | null)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/** sc-1362's group in Edit course: the default as a whole pick, and the choose-by date it is given on. */
export function DefaultFields({
  course,
  form,
  errors,
  dates,
  lang,
  onPatch,
}: {
  course: EvCourse;
  form: DefaultForm;
  errors: DefaultErrors | null;
  dates: DefaultDates;
  lang: Lang;
  onPatch: (next: DefaultForm) => void;
}) {
  const locked = isLocked(dates);
  const dish = course.dishes.find((one) => one.id === form.dishId) ?? null;
  const variants = dish == null ? [] : everyoneVariants(dish);

  return (
    <section className="mc-def" aria-labelledby="mc-def-h">
      <h3 id="mc-def-h" className="mc-def-h">
        {DFW.heading}
        <span className="gs-optional">{CW.optional}</span>
      </h3>
      <p className="desk-help">{DFW.help}</p>
      <fieldset
        className="mc-def-set"
        aria-invalid={errors?.dish != null || undefined}
        aria-describedby={described(errors?.dish != null && 'mc-def-dish-error')}
      >
        <legend className="desk-label gs-label">{DFW.default}</legend>
        <div className={errors?.dish == null ? 'mc-def-radios' : 'mc-def-radios is-wrong'}>
          {!locked && (
            <PickInput
              id={dishRadio(null)}
              name="mc-def-dish"
              label={DFW.noDefault}
              on={form.dishId == null}
              onPick={() => onPatch(withDish(form, null))}
            />
          )}
          {offeredDishes(course).map((one) => (
            <PickInput
              key={one.id}
              id={dishRadio(one.id)}
              name="mc-def-dish"
              label={one.name}
              on={form.dishId === one.id}
              onPick={() => onPatch(withDish(form, one.id))}
            />
          ))}
        </div>
        {errors?.dish != null && <Wrong id="mc-def-dish-error" words={errors.dish} />}
        {dish != null && variants.length > 0 && (
          <fieldset
            className="mc-def-set is-nested"
            aria-invalid={errors?.variant != null || undefined}
            aria-describedby={described(
              hasChildrenOnly(dish) && 'mc-def-children',
              errors?.variant != null && 'mc-def-variant-error',
            )}
          >
            <legend className="desk-label gs-label">{DFW.variant}</legend>
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
                {DFW.childrenOnly}
              </p>
            )}
            {errors?.variant != null && <Wrong id="mc-def-variant-error" words={errors.variant} />}
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
          <p className="desk-label gs-label">{DFW.chooseBy}</p>
          <p className="mc-def-locked">
            <Glyph name="lock" size={15} weight={2.4} />
            {dayWords(dates.stored, lang)}
          </p>
          <p className="desk-help">{DFW.locked(dayWords(dates.stored, lang))}</p>
        </div>
      ) : (
        <div className="desk-field">
          <label htmlFor={CHOOSE_BY_ID} className="desk-label gs-label">
            {DFW.chooseBy}
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
            {DFW.chooseByHint(course.name, dayWords(dates.event, lang))}
          </p>
          {errors?.chooseBy != null && <Wrong id="mc-choose-by-error" words={errors.chooseBy} />}
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
          {DFW.clear}
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
  choice: Choice;
  picked: readonly string[];
  error: string | null;
  onPick: (ids: readonly string[]) => void;
}) {
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
        {DFW.chooseN(choice.pick)}
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
      {error != null && <Wrong id={errorId} words={error} />}
    </fieldset>
  );
}

/** "Move {n} guests to {dish}?": Cancel first and focused, so Escape or Enter changes nothing. */
export function MoveDialog({
  move,
  lang,
  onCancel,
  onMove,
}: {
  move: Move;
  lang: Lang;
  onCancel: () => void;
  onMove: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

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
          <h2 id="mc-move-title">{DFW.moveTitle(move.move, move.to)}</h2>
          <p id="mc-move-body" className="dialog-body">
            {DFW.moveBody(move.move, move.from, dayWords(move.on, lang), move.to, move.back)}
          </p>
        </div>
        <ActionPair
          className="dialog-actions"
          dismiss={
            <button ref={cancel} type="button" className="link-button" onClick={onCancel}>
              {DFW.cancel}
            </button>
          }
          confirm={
            <button type="button" className="button button-primary" onClick={onMove}>
              {DFW.moveGo(move.move)}
            </button>
          }
        />
      </div>
    </>
  );
}
