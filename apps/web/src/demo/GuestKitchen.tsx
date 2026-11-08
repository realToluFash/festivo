import { type ReactNode, useMemo } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { offButton } from '../offButton.ts';
import { EVENT, type Visit, type Words, dayOf } from './guest.ts';
import { Filled, Notice, TextAction } from './GuestParts.tsx';
import {
  type Field,
  type GuestKitchen,
  type Person,
  allergyNames,
  errorsOf,
  fieldId,
  guestKitchenLines,
  mealRows,
  mealsId,
  ruledOut,
  whoOf,
} from './guestKitchen.ts';
import {
  ALLERGENS,
  DIETS,
  type GuestKitchenWords,
  guestKitchenWordsFor,
} from './guestKitchenWords.ts';
import type { GuestKitchenActions } from './useGuestKitchen.ts';
import './guestKitchen.css';

function Ring({ kind }: { kind: 'allergy' | 'broken' | 'removed' | 'diet' }) {
  return (
    <span className={`gk-ring is-${kind}`} aria-hidden="true">
      {kind === 'allergy' && '!'}
      {kind === 'removed' && '−'}
      {kind === 'broken' && <Glyph name="clear" size={12} weight={3} />}
      {kind === 'diet' && <Glyph name="tick" size={13} weight={3} />}
    </span>
  );
}

function Chip({
  name,
  on,
  allergy,
  word,
  focus,
  onClick,
}: {
  name: string;
  on: boolean;
  allergy: boolean;
  word: string;
  focus: string;
  onClick: () => void;
}) {
  const kind = allergy ? 'allergy' : 'diet';

  return (
    <button
      className={on ? `gk-chip is-${kind}` : 'gk-chip'}
      type="button"
      aria-pressed={on}
      data-focus={focus}
      onClick={onClick}
    >
      {on && <Ring kind={kind} />}
      <span>{name}</span>
      {on && allergy && (
        <span className="gk-chip-word" aria-hidden="true">
          {`· ${word}`}
        </span>
      )}
    </button>
  );
}

function TextField({
  id,
  label,
  optional,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  optional: string | null;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="gk-field">
      <label className="gk-label" htmlFor={id}>
        <span>{label}</span>
        {optional != null && <span className="gk-optional">{optional}</span>}
      </label>
      <input
        id={id}
        className={error == null ? 'gk-input' : 'gk-input is-wrong'}
        type="text"
        value={value}
        data-focus={id}
        aria-invalid={error != null}
        aria-describedby={error == null ? undefined : errorId}
        onChange={(event) => onChange(event.target.value)}
      />
      {error != null && (
        <p id={errorId} className="gk-error">
          <Ring kind="broken" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function HostRows({
  one,
  say,
  hosts,
  count,
  actions,
}: {
  one: Person;
  say: GuestKitchenWords;
  hosts: string;
  count: number;
  actions: GuestKitchenActions;
}) {
  const head = `gk-host-${one.key}`;

  return (
    <div className="gk-group" role="group" aria-labelledby={head}>
      <p id={head} className="gk-label">
        {say.many('alsoNoted', count, { hosts })}
      </p>
      <div className="gk-hosts">
        {one.host.map((code) => {
          const label = say.access(code);
          const gone = `gk-gone-${one.key}-${code}`;

          return one.removed.includes(code) ? (
            <div key={code} className="gk-host is-removed">
              <p className="gk-host-words">
                <Ring kind="removed" />
                <span id={gone}>{say.say('willRemove', { label })}</span>
              </p>
              <button
                className="gk-small"
                type="button"
                aria-label={say.say('keepAria', { label })}
                aria-describedby={gone}
                data-focus={`keep-${one.key}-${code}`}
                onClick={() => actions.host(one.key, code, false)}
              >
                {say.say('keepIt')}
              </button>
            </div>
          ) : (
            <div key={code} className="gk-host">
              <p className="gk-host-words">{label}</p>
              <button
                className="gk-small"
                type="button"
                aria-label={say.say('removeAria', { label })}
                data-focus={`remove-${one.key}-${code}`}
                onClick={() => actions.host(one.key, code, true)}
              >
                {say.say('remove')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const NO_ERRORS: Record<Field, null> = { other: null, words: null, access: null };

function Card({
  one,
  kitchen,
  visit,
  words,
  say,
  actions,
}: {
  one: Person;
  kitchen: GuestKitchen;
  visit: Visit;
  words: Words;
  say: GuestKitchenWords;
  actions: GuestKitchenActions;
}) {
  const errors = kitchen.tried ? errorsOf(one) : NO_ERRORS;
  const problem = (field: Field) => {
    const error = errors[field];

    return error == null ? null : say.say(error === 'empty' ? 'sayWhich' : 'tooLong');
  };
  const named = allergyNames(one, say);
  const allergiesId = `gk-al-${one.key}`;
  const dietId = `gk-di-${one.key}`;
  const date = one.on == null ? '' : dayOf(one.on, visit.lang);

  return (
    <fieldset className="gk-card">
      <legend className="gk-who">{whoOf(one, kitchen.people, say)}</legend>
      <div className="gk-card-body">
        {kitchen.record != null && one.by != null && (
          <p className="gk-text is-quiet">
            {one.by === 'hosts'
              ? say.say('byHosts', { hosts: words.hosts, date })
              : say.say('byYou', { date })}
          </p>
        )}
        <div className="gk-group" role="group" aria-labelledby={allergiesId}>
          <p id={allergiesId} className="gk-label">
            {say.say('allergies')}
          </p>
          <div className="gk-chips">
            {ALLERGENS.map((code) => (
              <Chip
                key={code}
                name={say.allergen(code)}
                on={one.allergies.includes(code)}
                allergy
                word={say.say('allergyWord')}
                focus={`chip-${one.key}-${code}`}
                onClick={() => actions.allergy(one.key, code)}
              />
            ))}
          </div>
          {one.allergies.includes('other') && (
            <TextField
              id={fieldId('other', one.key)}
              label={say.say('which')}
              optional={null}
              value={one.other}
              error={problem('other')}
              onChange={(value) => actions.write(one.key, 'other', value)}
            />
          )}
          <div className="gk-live" aria-live="polite">
            {named.length > 0 && (
              <p className="gk-line">
                <Ring kind="allergy" />
                <span>{say.say('line', { allergies: say.list(named) })}</span>
              </p>
            )}
          </div>
        </div>
        <div className="gk-group" role="group" aria-labelledby={dietId}>
          <p id={dietId} className="gk-label">
            {say.say('diet')}
          </p>
          <div className="gk-chips">
            {DIETS.map((code) => (
              <Chip
                key={code}
                name={say.diet(code)}
                on={one.diet.includes(code)}
                allergy={false}
                word=""
                focus={`chip-${one.key}-${code}`}
                onClick={() => actions.diet(one.key, code)}
              />
            ))}
          </div>
        </div>
        <TextField
          id={fieldId('words', one.key)}
          label={say.say('words')}
          optional={say.say('optional')}
          value={one.words}
          error={problem('words')}
          onChange={(value) => actions.write(one.key, 'words', value)}
        />
        {one.host.length > 0 && (
          <HostRows
            one={one}
            say={say}
            hosts={words.hosts}
            count={EVENT.hosts.length}
            actions={actions}
          />
        )}
        <TextField
          id={fieldId('access', one.key)}
          label={say.say('access')}
          optional={say.say('optional')}
          value={one.access}
          error={problem('access')}
          onChange={(value) => actions.write(one.key, 'access', value)}
        />
      </div>
    </fieldset>
  );
}

function useSay(visit: Visit): GuestKitchenWords {
  return useMemo(() => guestKitchenWordsFor(visit.lang), [visit.lang]);
}

/** Anything the kitchen must know?: one card per person coming, the who-sees line first. */
export function GuestKitchenStep({
  visit,
  words,
  actions,
}: {
  visit: Visit;
  words: Words;
  actions: GuestKitchenActions;
}) {
  const say = useSay(visit);
  const kitchen = visit.kitchen;
  if (kitchen == null) return null;
  const closed = kitchen.from === 'closed';
  const busy = visit.view.kind === 'kitchen' && visit.view.busy === true;

  return (
    <section className="gk" aria-labelledby="gk-h" aria-busy={busy}>
      <TextAction
        ink
        off={busy}
        icon={<Glyph name="back" size={18} weight={2.2} />}
        onClick={actions.back}
      >
        {words.back}
      </TextAction>
      <div className="gk-head">
        {closed && <p className="gk-label">{say.say('row')}</p>}
        <h2
          id="gk-h"
          className="gp-h2 gk-h2"
          tabIndex={-1}
          data-focus="kitchenHead"
          aria-describedby="gk-consent"
        >
          {say.say('title')}
        </h2>
        <p className="gk-text is-quiet">
          {say.say(closed ? 'stays' : kitchen.people.length > 1 ? 'intro' : 'introAlone')}
        </p>
      </div>
      <div className="gk-consent">
        <Glyph name="lock" size={20} />
        <p id="gk-consent">{say.say('consent', { hosts: words.hosts })}</p>
      </div>
      {kitchen.people.map((one) => (
        <Card
          key={one.key}
          one={one}
          kitchen={kitchen}
          visit={visit}
          words={words}
          say={say}
          actions={actions}
        />
      ))}
      <div className="gk-actions">
        <Filled busy={busy} focus="kitchenNext" onClick={closed ? actions.save : actions.next}>
          {say.say(closed ? 'save' : 'next')}
        </Filled>
        <button
          className="gp-outlined"
          type="button"
          {...offButton(busy, { dim: false })}
          onClick={actions.skip}
        >
          {say.say(kitchen.record == null ? 'nothing' : 'leave')}
        </button>
      </div>
    </section>
  );
}

export const GUEST_KITCHEN_SAVED_ID = 'gk-saved';

/** After the date to answer by, under the reply once the kitchen needs are sent (sc-3780's line). */
export function GuestKitchenSaved({ lang }: { lang: Visit['lang'] }) {
  const say = useMemo(() => guestKitchenWordsFor(lang), [lang]);

  return (
    <p className="gk-saved" role="status">
      <Glyph name="tick" size={16} weight={2.6} />
      <span id={GUEST_KITCHEN_SAVED_ID}>{say.say('saved')}</span>
    </p>
  );
}

function RowChange({
  label,
  off,
  focus,
  onClick,
  children,
}: {
  label: string;
  off: boolean;
  focus?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="gp-text gk-change"
      type="button"
      aria-label={label}
      data-focus={focus}
      {...offButton(off, { dim: false })}
      onClick={onClick}
    >
      <span>{children}</span>
    </button>
  );
}

/** Check and send with For the kitchen after Your answer, and sc-3907's meal rows once the meals exist. */
export function GuestKitchenCheck({
  visit,
  words,
  actions,
}: {
  visit: Visit;
  words: Words;
  actions: GuestKitchenActions;
}) {
  const say = useSay(visit);
  const { kitchen, view } = visit;
  if (kitchen == null || view.kind !== 'check') return null;
  const busy = view.busy;
  const meals = mealRows(kitchen, say);
  const alert =
    kitchen.alert === 'refused'
      ? say.say('notSaved')
      : kitchen.alert === 'net'
        ? words.notSent
        : kitchen.alert === 'ruled' && ruledOut(kitchen) != null
          ? say.say('allergyOne')
          : null;

  return (
    <section className="gk gk-check" aria-labelledby="gp-check-h" aria-busy={busy}>
      <TextAction
        ink
        off={busy}
        icon={<Glyph name="back" size={18} weight={2.2} />}
        onClick={actions.toStep}
      >
        {words.back}
      </TextAction>
      <h2 id="gp-check-h" className="gp-h2 gk-h2" tabIndex={-1} data-focus="checkHead">
        {words.check}
      </h2>
      <div className="gk-rows">
        <div className="gk-row">
          <div className="gk-row-words">
            <p className="gk-label">{words.yourAnswer}</p>
            <p className="gk-value">{words.answerWord('coming')}</p>
          </div>
          {kitchen.from !== 'closed' && (
            <RowChange label={say.say('changeAnswer')} off={busy} onClick={actions.back}>
              {words.changeShort}
            </RowChange>
          )}
        </div>
        <div className="gk-row">
          <div className="gk-row-words">
            <p className="gk-label">{say.say('row')}</p>
            {guestKitchenLines(kitchen, say).map(({ who, lines }) => (
              <div key={who ?? 'nobody'} className="gk-person">
                {who != null && <p className="gk-value">{who}</p>}
                {lines.map((line, at) => (
                  <p
                    key={`${at}-${line.text}`}
                    className={`gk-said${line.allergy ? ' is-allergy' : ''}${line.quiet ? ' is-quiet' : ''}`}
                  >
                    {line.allergy && <Ring kind="allergy" />}
                    <span>{line.text}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
          <RowChange
            label={say.say('changeKitchen')}
            off={busy}
            focus="kitchenRow"
            onClick={actions.toStep}
          >
            {words.changeShort}
          </RowChange>
        </div>
        {meals.map((meal) => {
          const first = meal.dishes.findIndex((dish) => dish.reason != null);

          return (
            <div key={meal.key} className="gk-row">
              <div className="gk-row-words">
                <p className="gk-label-line">
                  <span className="gk-label">{meal.row}</span>
                  <span className="ev-pill">{say.say('notBuilt')}</span>
                </p>
                {meal.dishes.map((dish, at) => (
                  <div key={dish.name} className="gk-dish">
                    <p className="gk-value">{dish.name}</p>
                    {dish.reason != null && (
                      <p className="gk-line">
                        <Ring kind="allergy" />
                        <span id={`gk-reason-${meal.key}-${at}`}>{dish.reason}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Link
                className="gp-text gk-change"
                to="/demo/later?screen=meals"
                aria-label={say.say('changeMeals', { row: meal.row })}
                aria-describedby={first < 0 ? undefined : `gk-reason-${meal.key}-${first}`}
                data-focus={mealsId(meal.key)}
              >
                <span>{words.changeShort}</span>
              </Link>
            </div>
          );
        })}
      </div>
      {alert != null && <Notice kind="broken">{alert}</Notice>}
      <Filled busy={busy} focus="send" onClick={actions.send}>
        {words.send}
      </Filled>
      <p className="gk-text is-quiet">{words.nothingSent}</p>
    </section>
  );
}
