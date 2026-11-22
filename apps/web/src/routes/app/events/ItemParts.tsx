import {
  ITEM_NAME_MAXIMUM,
  ITEMS_PER_DISH_MAXIMUM,
  type MenuCourse,
  type MenuDish,
  type MenuItem,
  OWN_ITEMS_PER_COURSE_MAXIMUM,
} from '@soirely/api-client';
import {
  type FixedRow,
  type ItemOffer,
  type ItemProblem,
  type ItemProblems,
  type ItemRow,
  canAddItem,
  itemNameOf,
  itemOffers,
  movedItems,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { HintButton } from '../../../components/HintButton.tsx';
import { Wrong } from '../menu/MenuFields.tsx';
import { DraftTag } from './ChoiceParts.tsx';
import { newItemKey, useOrList } from './menuItems.ts';

/** What a row says: its name, sc-3904's words for a choice with no question, or a blank's own words. */
function shownItem(
  t: TFunction,
  item: MenuItem,
  dish: Pick<MenuDish, 'variants' | 'choices'>,
  orList: (names: string[]) => string,
): string {
  const named = itemNameOf(item, dish, orList);
  if (named != null) return named.trim() === '' ? t('dishItems.unnamed') : named.trim();
  const at = item.kind === 'choice' ? dish.choices.findIndex((one) => one.id === item.choiceId) : 0;

  return t('dishChoices.noQuestionYet', { n: at + 1 });
}

function problemWords(t: TFunction, problem: ItemProblem): string {
  if (problem === 'blank') return t('dishItems.blank');
  if (problem === 'long') return t('dishItems.long', { most: ITEM_NAME_MAXIMUM });

  return t('dishItems.taken');
}

export function ItemsLine({ dish }: { dish: MenuDish }) {
  const { t } = useTranslation();
  const orList = useOrList();
  if (dish.items.length === 0) return null;

  return (
    <div className="mn-items-line">
      <p className="mn-items-head">{t('dishItems.items')}</p>
      <ol className="mn-item-chips" aria-label={`${t('dishItems.items')} · ${dish.name}`}>
        {dish.items.map((item, at) => {
          const draft = item.kind === 'choice' && itemNameOf(item, dish, orList) == null;

          return (
            <li
              key={`${item.kind}-${at}`}
              className={['mn-item-chip', item.kind !== 'fixed' && 'is-choice', draft && 'is-draft']
                .filter(Boolean)
                .join(' ')}
            >
              {item.kind === 'choice' && <Glyph name="question" size={14} weight={2.2} />}
              {item.kind === 'variants' && <Glyph name="updown" size={14} weight={2.2} />}
              {shownItem(t, item, dish, orList)}
              {draft && <DraftTag />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OwnItemsFacts({ course }: { course: MenuCourse }) {
  const { t } = useTranslation();
  if (course.ownItems.length === 0) return null;

  return (
    <dl className="mn-course-facts">
      <div>
        <dt>{t('dishItems.own')}</dt>
        <dd>{course.ownItems.join(' · ')}</dd>
      </div>
    </dl>
  );
}

function useFocusAfter(): (id: string) => void {
  const after = useRef<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (after.current == null) return;
    document.getElementById(after.current)?.focus();
    after.current = null;
  }, [tick]);

  return (id) => {
    after.current = id;
    setTick((n) => n + 1);
  };
}

function RowMoves({
  at,
  of,
  name,
  idKey,
  onMove,
  onRemove,
}: {
  at: number;
  of: number;
  name: string;
  idKey: string;
  onMove: (at: number, by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mn-item-acts">
      <HintButton
        id={`mc-iup-${idKey}`}
        label={t('dishItems.moveUp', { name })}
        hint={t('dishItems.upHint')}
        disabled={at === 0}
        onClick={() => onMove(at, -1)}
      >
        <Glyph name="chevup" size={18} weight={2.3} />
      </HintButton>
      <HintButton
        id={`mc-idown-${idKey}`}
        label={t('dishItems.moveDown', { name })}
        hint={t('dishItems.downHint')}
        disabled={at === of - 1}
        onClick={() => onMove(at, 1)}
      >
        <Glyph name="chevdown" size={18} weight={2.3} />
      </HintButton>
      <HintButton
        id={`mc-ix-${idKey}`}
        label={t('dishItems.remove', { name })}
        hint={t('dishItems.removeHint')}
        onClick={onRemove}
      >
        <Glyph name="clear" size={18} weight={2.3} />
      </HintButton>
    </div>
  );
}

function FixedInput({
  id,
  label,
  row,
  problem,
  onName,
}: {
  id: string;
  label: string;
  row: FixedRow;
  problem: ItemProblem | undefined;
  onName: (name: string) => void;
}) {
  return (
    <>
      <label htmlFor={id} className="desk-unseen">
        {label}
      </label>
      <div className={problem == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          value={row.name}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={problem != null}
          aria-describedby={problem == null ? undefined : `${id}-error`}
          onChange={(event) => onName(event.target.value)}
        />
      </div>
    </>
  );
}

/** Items on Edit dish: fixed names in place, a choice or the variant as an inset, each moved or removed by its buttons. Nothing is saved before Save changes. */
export function DishItemsField({
  dish,
  rows,
  problems,
  onRows,
}: {
  dish: MenuDish;
  rows: ItemRow[];
  problems: ItemProblems | null;
  onRows: (rows: ItemRow[]) => void;
}) {
  const { t } = useTranslation();
  const orList = useOrList();
  const focus = useFocusAfter();
  const [moveSaid, setMoveSaid] = useState('');
  const [addRefused, setAddRefused] = useState(false);
  const offers = itemOffers(dish, rows);
  const told = ['mc-items-help', problems?.list == null ? null : 'mc-items-error']
    .filter(Boolean)
    .join(' ');

  function change(next: ItemRow[]) {
    setAddRefused(false);
    onRows(next);
  }

  function add(row: ItemRow | null) {
    if (!canAddItem(rows, ITEMS_PER_DISH_MAXIMUM)) {
      setAddRefused(true);
      return;
    }
    const key = newItemKey();
    const added: ItemRow = row == null ? { kind: 'fixed', name: '', key } : { ...row, key };
    change([...rows, added]);
    focus(
      added.kind === 'fixed'
        ? `mc-item-${key}`
        : rows.length === 0
          ? `mc-ix-${key}`
          : `mc-iup-${key}`,
    );
  }

  function addOffer(offer: ItemOffer) {
    add(
      offer.kind === 'variants'
        ? { kind: 'variants', key: '' }
        : { kind: 'choice', choiceId: offer.choiceId, key: '' },
    );
  }

  function move(at: number, by: -1 | 1) {
    const next = movedItems(rows, at, by);
    const row = rows[at];
    if (next == null || row == null) return;
    change(next);
    setMoveSaid(
      t('dishItems.moved', {
        name: shownItem(t, row, dish, orList),
        n: at + by + 1,
        count: next.length,
      }),
    );
  }

  function remove(key: string) {
    const after = rows[rows.findIndex((one) => one.key === key) + 1];
    change(rows.filter((one) => one.key !== key));
    focus(after == null ? 'mc-add-item' : `mc-ix-${after.key}`);
  }

  return (
    <fieldset className="mn-items" aria-describedby={told}>
      <legend className="desk-label gs-label">
        {t('dishItems.items')}
        <span className="gs-optional">{t('menuLibrary.optional')}</span>
      </legend>
      <p id="mc-items-help" className="desk-help">
        {dish.variants.length > 0
          ? `${t('dishItems.help')} ${t('dishItems.helpVariants')}`
          : t('dishItems.help')}
      </p>
      <p className="mn-moved" role="status">
        {moveSaid}
      </p>
      {rows.length > 0 && (
        <ol className="mn-item-rows">
          {rows.map((row, at) => {
            const problem = problems?.byKey[row.key];
            const id = `mc-item-${row.key}`;
            const draft = row.kind === 'choice' && itemNameOf(row, dish, orList) == null;

            return (
              <li key={row.key} className="mn-item-row">
                <span className="mn-item-n" aria-hidden="true">
                  {at + 1}
                </span>
                <div className="mn-item-main">
                  {row.kind === 'fixed' ? (
                    <FixedInput
                      id={id}
                      label={t('dishItems.itemN', { n: at + 1 })}
                      row={row}
                      problem={problem}
                      onName={(name) =>
                        change(rows.map((one) => (one.key === row.key ? { ...row, name } : one)))
                      }
                    />
                  ) : (
                    <p className={draft ? 'mn-choice-item is-draft' : 'mn-choice-item'}>
                      <Glyph
                        name={row.kind === 'variants' ? 'updown' : 'question'}
                        size={16}
                        weight={2.2}
                      />
                      <span className="mn-choice-item-name">{shownItem(t, row, dish, orList)}</span>
                      {draft ? (
                        <DraftTag />
                      ) : (
                        <span className="mn-tag">
                          {row.kind === 'variants'
                            ? t('dishItems.variantsTag')
                            : t('dishItems.choiceTag')}
                        </span>
                      )}
                    </p>
                  )}
                  {problem != null && <Wrong id={`${id}-error`}>{problemWords(t, problem)}</Wrong>}
                </div>
                <RowMoves
                  at={at}
                  of={rows.length}
                  name={shownItem(t, row, dish, orList)}
                  idKey={row.key}
                  onMove={move}
                  onRemove={() => remove(row.key)}
                />
              </li>
            );
          })}
        </ol>
      )}
      {problems?.list != null && <Wrong id="mc-items-error">{t('dishItems.onlyOne')}</Wrong>}
      <div className="mn-add-row">
        <button
          id="mc-add-item"
          type="button"
          className="desk-text"
          aria-describedby={addRefused ? 'mc-add-item-error' : undefined}
          onClick={() => add(null)}
        >
          <Glyph name="plus" size={17} weight={2.3} />
          {t('dishItems.add')}
        </button>
        {addRefused && (
          <Wrong id="mc-add-item-error">
            {t('dishItems.tooMany', { most: ITEMS_PER_DISH_MAXIMUM })}
          </Wrong>
        )}
      </div>
      {offers.length > 0 && (
        <div className="mn-offer" role="group" aria-labelledby="mc-offer-head">
          <p id="mc-offer-head" className="mn-offer-head">
            {t('dishItems.addFrom')}
          </p>
          <div className="mn-offer-list">
            {offers.map((offer) => (
              <button
                key={offer.kind === 'variants' ? 'variants' : offer.choiceId}
                type="button"
                className="mn-offer-button"
                onClick={() => addOffer(offer)}
              >
                <Glyph name="plus" size={15} weight={2.4} />
                {shownItem(
                  t,
                  offer.kind === 'variants'
                    ? { kind: 'variants' }
                    : { kind: 'choice', choiceId: offer.choiceId },
                  dish,
                  orList,
                )}
                <span className="mn-tag">
                  {offer.kind === 'variants'
                    ? t('dishItems.variantsTag')
                    : t('dishItems.choiceTag')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}

/** Served with this course on Edit course, under a dish's rules, up to 3. */
export function OwnItemsField({
  rows,
  problems,
  onRows,
}: {
  rows: FixedRow[];
  problems: ItemProblems | null;
  onRows: (rows: FixedRow[]) => void;
}) {
  const { t } = useTranslation();
  const focus = useFocusAfter();
  const [moveSaid, setMoveSaid] = useState('');
  const [addRefused, setAddRefused] = useState(false);

  function change(next: FixedRow[]) {
    setAddRefused(false);
    onRows(next);
  }

  function add() {
    if (!canAddItem(rows, OWN_ITEMS_PER_COURSE_MAXIMUM)) {
      setAddRefused(true);
      return;
    }
    const key = newItemKey();
    change([...rows, { kind: 'fixed', name: '', key }]);
    focus(`mc-own-${key}`);
  }

  function move(at: number, by: -1 | 1) {
    const next = movedItems(rows, at, by);
    const row = rows[at];
    if (next == null || row == null) return;
    change(next);
    setMoveSaid(
      t('dishItems.moved', {
        name: row.name.trim() === '' ? t('dishItems.unnamed') : row.name.trim(),
        n: at + by + 1,
        count: next.length,
      }),
    );
  }

  function remove(key: string) {
    const after = rows[rows.findIndex((one) => one.key === key) + 1];
    change(rows.filter((one) => one.key !== key));
    focus(after == null ? 'mc-add-own' : `mc-ix-${after.key}`);
  }

  return (
    <fieldset className="mn-items" aria-describedby="mc-own-help">
      <legend className="desk-label gs-label">
        {t('dishItems.own')}
        <span className="gs-optional">{t('menuLibrary.optional')}</span>
      </legend>
      <p id="mc-own-help" className="desk-help">
        {t('dishItems.ownHelp')}
      </p>
      <p className="mn-moved" role="status">
        {moveSaid}
      </p>
      {rows.length > 0 && (
        <ol className="mn-item-rows">
          {rows.map((row, at) => {
            const problem = problems?.byKey[row.key];
            const id = `mc-own-${row.key}`;

            return (
              <li key={row.key} className="mn-item-row">
                <span className="mn-item-n" aria-hidden="true">
                  {at + 1}
                </span>
                <div className="mn-item-main">
                  <FixedInput
                    id={id}
                    label={t('dishItems.ownN', { n: at + 1 })}
                    row={row}
                    problem={problem}
                    onName={(name) =>
                      change(rows.map((one) => (one.key === row.key ? { ...row, name } : one)))
                    }
                  />
                  {problem != null && <Wrong id={`${id}-error`}>{problemWords(t, problem)}</Wrong>}
                </div>
                <RowMoves
                  at={at}
                  of={rows.length}
                  name={row.name.trim() === '' ? t('dishItems.unnamed') : row.name.trim()}
                  idKey={row.key}
                  onMove={move}
                  onRemove={() => remove(row.key)}
                />
              </li>
            );
          })}
        </ol>
      )}
      <div className="mn-add-row">
        <button
          id="mc-add-own"
          type="button"
          className="desk-text"
          aria-describedby={addRefused ? 'mc-add-own-error' : undefined}
          onClick={add}
        >
          <Glyph name="plus" size={17} weight={2.3} />
          {t('dishItems.addOwn')}
        </button>
        {addRefused && (
          <Wrong id="mc-add-own-error">
            {t('dishItems.ownTooMany', { most: OWN_ITEMS_PER_COURSE_MAXIMUM })}
          </Wrong>
        )}
      </div>
    </fieldset>
  );
}
