import { type RefObject, useEffect, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { MW, filled } from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { INVITE_WORLD } from './messagesInvite.ts';
import {
  type Audience,
  type Condition,
  type ToPick,
  ADDABLE,
  MESSAGES_WORLD,
  NO_GROUP,
  TW,
  addLine,
  addWord,
  changedFrom,
  channelsOf,
  conditionWord,
  countIn,
  countOf,
  countWords,
  deletedIn,
  nameCount,
  nameRefusal,
  pickOf,
  quickWord,
  saveRefusal,
  savedInOrder,
  savedOf,
  withName,
  withSaved,
  without,
} from './messagesTo.ts';
import './messagesTo.css';

const COUNTING_MS = 600;
const BY_NAME = new Intl.Collator('en', { sensitivity: 'base' });

/** More actions: three dots, drawn here rather than added to the product's icons. */
export function MoreMark() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" className="mgt-mark">
      <circle cx={4.5} cy={10} r={1.8} />
      <circle cx={10} cy={10} r={1.8} />
      <circle cx={15.5} cy={10} r={1.8} />
    </svg>
  );
}

function BinMark() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="mgt-bin"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 5.5h13M8 5.5V3.8h4v1.7M5.2 5.5l.8 11h8l.8-11M8.4 8.6v5M11.6 8.6v5" />
    </svg>
  );
}

/** Who gets it (sc-3957): the saved audiences, the quick picks and Guests who…, with its conditions, count and See who; on an invitation, Not yet invited too (sc-3971). */
export function ToPopover({
  to,
  chip,
  onPick,
  onClose,
  invite = false,
}: {
  to: Audience;
  chip: RefObject<HTMLButtonElement | null>;
  onPick: (to: Audience) => void;
  onClose: (back: boolean) => void;
  invite?: boolean;
}) {
  const { tell, say, to: event } = useInbox();
  const { book, setBook, viewed } = event;
  const [first] = useState(event.view);
  const [adding, setAdding] = useState(first.adding);
  const [seeing, setSeeing] = useState(first.seeing);
  const [counting, setCounting] = useState(first.counting);
  const [saveRefused, setSaveRefused] = useState(first.saveRefused);
  const [saving, setSaving] = useState(first.saving);
  const [menu, setMenu] = useState(first.menu);
  const [renaming, setRenaming] = useState(first.renaming);
  const [deleting, setDeleting] = useState(first.deleting);
  const [kept, setKept] = useState<readonly Condition[]>(to.kind === 'who' ? to.conditions : []);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const later = useRef<string | null>(null);
  const titleId = useId();
  const name = useId();
  const ids = useId();
  const groups = book.groups;
  const world = invite ? INVITE_WORLD : MESSAGES_WORLD;
  const quicks = invite
    ? (['notInvited', 'coming', 'notReplied'] as const)
    : (['coming', 'notReplied'] as const);
  const who = to.kind === 'who' ? to.conditions : null;
  const pick = pickOf(to, book);
  const from = savedOf(book, pick);
  const count = who == null ? null : countIn(who, groups, world);
  const live = groups
    .filter((group) => group.deleted !== true)
    .sort((a, b) => BY_NAME.compare(a.name, b.name));
  const options = [
    ...live.map((group) => ({ condition: `group:${group.id}` as const, word: group.name })),
    { condition: `group:${NO_GROUP}` as const, word: TW.noGroup },
  ].filter((option) => who?.includes(option.condition) !== true);
  const left = ADDABLE.filter((kind) =>
    kind === 'group' ? options.length > 0 : who?.includes(kind) !== true,
  );
  const shown = !counting && count != null && count > 0;

  useEffect(() => {
    const target =
      first.first == null
        ? null
        : box.current?.querySelector<HTMLElement>(`[data-to="${first.first}"]`);

    (target ?? box.current?.querySelector<HTMLElement>('input:checked'))?.focus();
    if (first.said != null) say(first.said);
    viewed();
  }, [first, say, viewed]);

  useEffect(() => {
    const key = later.current;

    if (key == null) return;
    later.current = null;
    box.current?.querySelector<HTMLElement>(key)?.focus();
  });

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const items = () => [
      ...(box.current?.querySelectorAll<HTMLElement>('.mgt-menu [role=menuitem]') ?? []),
    ];
    const keys = (keyEvent: globalThis.KeyboardEvent) => {
      if (menu != null && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(keyEvent.key)) {
        const all = items();
        const at = all.indexOf(document.activeElement as HTMLElement);
        const next =
          keyEvent.key === 'Home'
            ? 0
            : keyEvent.key === 'End'
              ? all.length - 1
              : (at + (keyEvent.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;

        keyEvent.preventDefault();
        all[next]?.focus();
        return;
      }
      if (menu != null && keyEvent.key === 'Tab') {
        setMenu(null);
        return;
      }
      if (keyEvent.key !== 'Escape') return;

      keyEvent.preventDefault();
      if (menu != null) {
        later.current = `[data-to="more:${menu}"]`;
        setMenu(null);
      } else if (adding === 'group') {
        later.current = '[data-to="add-group"]';
        setAdding('top');
      } else if (adding != null) {
        later.current = '[data-to="add"]';
        setAdding(null);
      } else if (renaming != null) {
        later.current = `[data-to="more:${renaming.id}"]`;
        setRenaming(null);
      } else if (deleting != null) {
        later.current = `[data-to="more:${deleting}"]`;
        setDeleting(null);
      } else if (saving != null) {
        later.current = '[data-to="save"]';
        setSaving(null);
      } else onClose(true);
    };
    const outside = (pointer: PointerEvent) => {
      const target = pointer.target as Node;

      if (!box.current?.contains(target) && !chip.current?.contains(target)) onClose(false);
      else if (menu != null && !(target instanceof Element && target.closest('.mgt-more-at')))
        setMenu(null);
    };

    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [menu, adding, renaming, deleting, saving, chip, onClose]);

  function recount(): void {
    if (timer.current != null) window.clearTimeout(timer.current);
    setCounting(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setCounting(false);
    }, COUNTING_MS);
  }

  function choose(next: Audience): void {
    const before = who?.join('|') ?? null;
    const after = next.kind === 'who' ? next.conditions.join('|') : null;

    onPick(next);
    setSaveRefused(false);
    if (next.kind === 'who') setKept(next.conditions);
    if (after != null && after !== before) recount();
  }

  function conditions(next: readonly Condition[]): void {
    choose({ kind: 'who', conditions: next, pick: pick === 'all' ? 'who' : pick });
  }

  function add(condition: Condition): void {
    conditions([...(who ?? []), condition]);
    setAdding(null);
    later.current = '[data-to="add"]';
  }

  function startSave(): void {
    if (who == null || who.length === 0) {
      setSaveRefused(true);
      return;
    }
    setSaving({ name: '', wrong: null });
    later.current = '[data-to="name"]';
  }

  function save(typed: string): void {
    const wrong = saveRefusal(typed, book);

    if (wrong != null || who == null) {
      setSaving({ name: typed, wrong });
      later.current = '[data-to="name"]';
      return;
    }

    const made = withSaved(book, typed, who);

    setBook(() => made.book);
    onPick({ kind: 'who', conditions: who, pick: `saved:${made.id}` });
    setSaving(null);
    say(filled(TW.savedSaid, { name: typed.trim() }));
    later.current = `[data-saved="${made.id}"]`;
  }

  function rename(id: string, typed: string): void {
    const now = book.saved.find((one) => one.id === id);

    later.current = `[data-to="more:${id}"]`;
    if (now == null || typed.trim() === now.name) {
      setRenaming(null);
      return;
    }

    const wrong = nameRefusal(typed, book.saved, id);

    if (wrong != null) {
      setRenaming({ id, name: typed, wrong });
      later.current = '[data-to="rename"]';
      return;
    }
    setBook((was) => withName(was, id, typed));
    setRenaming(null);
    say(filled(TW.renamedSaid, { name: typed.trim() }));
  }

  function remove(id: string): void {
    const gone = book.saved.find((one) => one.id === id);

    setBook((was) => without(was, id));
    if (to.kind === 'who' && pick === `saved:${id}`) onPick({ ...to, pick: 'who' });
    setDeleting(null);
    if (gone != null) say(filled(TW.deletedSaid, { name: gone.name }));
    later.current = 'input:checked';
  }

  const radio = (value: ToPick | 'all') => ({
    type: 'radio' as const,
    name,
    className: 'desk-radio',
    checked: pick === value,
    'data-focus': pick === value ? 'to-pick' : undefined,
  });

  return (
    <div ref={box} className="mg-pop mg-to-pop mgt-pop" role="dialog" aria-labelledby={titleId}>
      <div className="mg-pop-head">
        <h3 id={titleId} className="mg-to-title">
          {MW.to}
        </h3>
        <button
          type="button"
          className="mg-close"
          aria-label={MW.closeTo}
          onClick={() => onClose(true)}
        >
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <div className="mgt-scroll">
        <fieldset className="mg-radios">
          <legend className="desk-unseen">{MW.to}</legend>
          {savedInOrder(book.saved).map((one) => (
            <div key={one.id} className="mgt-saved">
              {renaming?.id === one.id ? (
                <NameForm
                  label={filled(TW.renameField, { name: one.name })}
                  typed={renaming.name}
                  wrong={renaming.wrong}
                  hint={null}
                  act={MW.save}
                  focusKey="rename"
                  onType={(typed) => setRenaming({ id: one.id, name: typed, wrong: null })}
                  onSubmit={() => rename(one.id, renaming.name)}
                  onCancel={() => {
                    later.current = `[data-to="more:${one.id}"]`;
                    setRenaming(null);
                  }}
                />
              ) : (
                <div className="mgt-saved-row">
                  <label className="mg-radio-row mgt-saved-pick">
                    <input
                      {...radio(`saved:${one.id}`)}
                      aria-labelledby={`${ids}-name-${one.id}`}
                      aria-describedby={`${ids}-line-${one.id}`}
                      data-saved={one.id}
                      onChange={() =>
                        choose({ kind: 'who', conditions: one.conditions, pick: `saved:${one.id}` })
                      }
                    />
                    <span className="mgt-saved-words">
                      <span id={`${ids}-name-${one.id}`} className="mgt-saved-name">
                        {one.name}
                      </span>
                      <span id={`${ids}-line-${one.id}`} className="mgt-saved-line">
                        {one.conditions
                          .map((condition) => conditionWord(condition, groups))
                          .join(' · ')}
                      </span>
                    </span>
                  </label>
                  <div className="mgt-more-at">
                    <button
                      type="button"
                      className="mgt-more"
                      aria-label={filled(TW.moreActions, { name: one.name })}
                      aria-haspopup="menu"
                      aria-expanded={menu === one.id}
                      aria-controls={menu === one.id ? `${ids}-menu` : undefined}
                      data-to={`more:${one.id}`}
                      onClick={() => {
                        if (menu === one.id) setMenu(null);
                        else {
                          later.current = '[data-to="menu-item"]';
                          setMenu(one.id);
                        }
                      }}
                    >
                      <MoreMark />
                    </button>
                    {menu === one.id && (
                      <ul
                        id={`${ids}-menu`}
                        className="mg-pop mgt-menu"
                        role="menu"
                        aria-label={filled(TW.moreActions, { name: one.name })}
                      >
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="mgt-menu-item"
                            data-to="menu-item"
                            onClick={() => {
                              setMenu(null);
                              setRenaming({ id: one.id, name: one.name, wrong: null });
                              later.current = '[data-to="rename"]';
                            }}
                          >
                            {TW.rename}
                          </button>
                        </li>
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="mgt-menu-item is-red"
                            onClick={() => {
                              setMenu(null);
                              setDeleting(one.id);
                              later.current = '[data-to="keep"]';
                            }}
                          >
                            <BinMark />
                            {TW.deleteEllipsis}
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {deleting === one.id && (
                <DeleteAsk
                  name={one.name}
                  onKeep={() => {
                    later.current = `[data-to="more:${one.id}"]`;
                    setDeleting(null);
                  }}
                  onDelete={() => remove(one.id)}
                />
              )}
            </div>
          ))}
          <label className="mg-radio-row">
            <input {...radio('all')} onChange={() => choose({ kind: 'all' })} />
            <span className="today-grow">{MW.allGuests}</span>
            <span className="mg-radio-count">{countOf({ kind: 'all' }, groups, world)}</span>
          </label>
          {quicks.map((quick) => (
            <label key={quick} className="mg-radio-row">
              <input
                {...radio(quick)}
                onChange={() => choose({ kind: 'who', conditions: [quick], pick: quick })}
              />
              <span className="today-grow">{quickWord(quick)}</span>
              <span className="mg-radio-count">{countIn([quick], groups, world)}</span>
            </label>
          ))}
          {to.kind === 'guest' && (
            <label className="mg-radio-row">
              <input {...radio(pick)} onChange={() => onPick(to)} />
              <span className="today-grow">{to.guest.name}</span>
              <span className="mg-radio-count">{countOf(to, groups)}</span>
            </label>
          )}
          <label className="mg-radio-row">
            <input
              type="radio"
              name={name}
              className="desk-radio"
              checked={false}
              onChange={() => tell(`${MW.chooseGuests} has its own design.`)}
            />
            <span className="today-grow">{MW.chooseGuests}</span>
          </label>
          <label className="mg-radio-row">
            <input
              {...radio('who')}
              onChange={() => choose({ kind: 'who', conditions: who ?? kept, pick: 'who' })}
            />
            <span className="today-grow">{MW.guestsWho}</span>
          </label>
        </fieldset>
        {who != null && (
          <div className="mg-who-block">
            {from != null && (
              <p className="mg-pop-line">{filled(TW.fromSaved, { name: from.name })}</p>
            )}
            <ul className="mg-conds">
              {who.map((condition) => (
                <li
                  key={condition}
                  className={
                    deletedIn([condition], groups).length > 0 ? 'mg-cond is-gone' : 'mg-cond'
                  }
                >
                  {conditionWord(condition, groups)}
                  <button
                    type="button"
                    aria-label={filled(MW.removeCondition, {
                      condition: conditionWord(condition, groups),
                    })}
                    onClick={() => {
                      conditions(who.filter((one) => one !== condition));
                      later.current = '[data-to="add"]';
                    }}
                  >
                    <Glyph name="clear" size={13} weight={2.6} />
                  </button>
                </li>
              ))}
              {left.length > 0 && (
                <li className="mg-add-at">
                  <button
                    type="button"
                    className="desk-text"
                    aria-expanded={adding != null}
                    aria-controls={adding == null ? undefined : `${ids}-add`}
                    data-to="add"
                    onClick={() => setAdding(adding == null ? 'top' : null)}
                  >
                    <Glyph name="plus" size={17} weight={2.3} />
                    {MW.addCondition}
                  </button>
                </li>
              )}
            </ul>
            {adding === 'top' && (
              <ul id={`${ids}-add`} className="mgt-add">
                {left.map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      className="mgt-add-item"
                      aria-label={addWord(kind)}
                      aria-describedby={`${ids}-add-${kind}`}
                      data-to={kind === 'group' ? 'add-group' : undefined}
                      onClick={() => {
                        if (kind !== 'group') add(kind);
                        else {
                          later.current = '[data-to="add-item"]';
                          setAdding('group');
                        }
                      }}
                    >
                      <span className="mgt-add-word">{addWord(kind)}</span>
                      <span id={`${ids}-add-${kind}`} className="mgt-add-line">
                        {addLine(kind)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {adding === 'group' && (
              <div id={`${ids}-add`} className="mgt-add">
                <p id={`${ids}-which`} className="mgt-add-head">
                  {TW.whichGroup}
                </p>
                <ul aria-labelledby={`${ids}-which`}>
                  {options.map((option, index) => (
                    <li key={option.condition}>
                      <button
                        type="button"
                        className="mgt-add-item"
                        data-to={index === 0 ? 'add-item' : undefined}
                        onClick={() => add(option.condition)}
                      >
                        <span className="mgt-add-word">{option.word}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {deletedIn(who, groups).map((group) => (
              <p key={group.id} className="mgt-gone">
                <Glyph name="info" size={15} weight={2.2} />
                {filled(TW.deletedNote, { group: group.name })}
              </p>
            ))}
            <p className="mg-pop-line">{MW.matchEvery}</p>
            {changedFrom(to, book) && <p className="mg-pop-line">{TW.thisMessageOnly}</p>}
            <div className="mg-pop-count">
              <p role="status">{counting ? TW.counting : countWords(count)}</p>
              {shown && (
                <button
                  type="button"
                  className="desk-text"
                  aria-expanded={seeing}
                  aria-controls={seeing ? `${ids}-see` : undefined}
                  data-to="see"
                  onClick={() => setSeeing((open) => !open)}
                >
                  {MW.seeWho}
                </button>
              )}
            </div>
            {shown && seeing && (
              <ul id={`${ids}-see`} className="mgt-see" aria-label={MW.seeWho}>
                {world.matches(who, groups).map((guest) => (
                  <li key={guest.name}>
                    <span className="mgt-see-name">{guest.name}</span>
                    {' · '}
                    {channelsOf(guest)}
                  </li>
                ))}
              </ul>
            )}
            {saving == null ? (
              <div className="mgt-save-at">
                <button
                  type="button"
                  className="desk-text"
                  aria-describedby={saveRefused ? `${ids}-refused` : undefined}
                  data-to="save"
                  onClick={startSave}
                >
                  {MW.saveAudience}
                </button>
                {saveRefused && (
                  <p id={`${ids}-refused`} className="desk-error" role="alert">
                    <Glyph name="alert" size={15} weight={2.2} />
                    {MW.noCondition}
                  </p>
                )}
              </div>
            ) : (
              <NameForm
                label={TW.nameAudience}
                typed={saving.name}
                wrong={saving.wrong}
                hint={TW.nameHint}
                act={TW.saveAudience}
                focusKey="name"
                onType={(typed) => setSaving({ name: typed, wrong: null })}
                onSubmit={() => save(saving.name)}
                onCancel={() => {
                  later.current = '[data-to="save"]';
                  setSaving(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A saved audience's name, as Save this audience asks for it and Rename edits it: counted, and refused beside the field. */
function NameForm({
  label,
  typed,
  wrong,
  hint,
  act,
  focusKey,
  onType,
  onSubmit,
  onCancel,
}: {
  label: string;
  typed: string;
  wrong: string | null;
  hint: string | null;
  act: string;
  focusKey: string;
  onType: (typed: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const told = [
    `${id}-count`,
    hint == null ? null : `${id}-hint`,
    wrong == null ? null : `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <form
      className="mgt-name"
      noValidate
      onSubmit={(submitted) => {
        submitted.preventDefault();
        onSubmit();
      }}
    >
      <div className="desk-field">
        <label htmlFor={id} className="desk-label">
          {label}
        </label>
        <div className={wrong == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={id}
            type="text"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={wrong != null}
            aria-describedby={told}
            data-to={focusKey}
            onChange={(changed) => onType(changed.target.value)}
          />
        </div>
        <p id={`${id}-count`} className="desk-help">
          {nameCount(typed)}
        </p>
        {hint != null && (
          <p id={`${id}-hint`} className="desk-help">
            {hint}
          </p>
        )}
        {wrong != null && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {wrong}
          </p>
        )}
      </div>
      <div className="mgt-name-acts">
        <button type="submit" className="button button-primary mgt-name-save">
          {act}
        </button>
        <button type="button" className="desk-text" onClick={onCancel}>
          {MW.cancel}
        </button>
      </div>
    </form>
  );
}

/** Delete… asks first, inline under the row, the focus on Keep it (WAI-ARIA APG, the least destructive choice). */
function DeleteAsk({
  name,
  onKeep,
  onDelete,
}: {
  name: string;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const questionId = useId();
  const lineId = useId();

  return (
    <div
      className="mg-ask mgt-ask"
      role="alertdialog"
      aria-labelledby={questionId}
      aria-describedby={lineId}
    >
      <p id={questionId} className="mg-ask-question mgt-ask-question">
        {filled(TW.deleteAsk, { name })}
      </p>
      <p id={lineId} className="mg-check-line">
        {TW.deleteLine}
      </p>
      <div className="mg-acts is-end">
        <button type="button" className="desk-text" data-to="keep" onClick={onKeep}>
          {MW.keepIt}
        </button>
        <button type="button" className="mg-danger" onClick={onDelete}>
          {TW.deleteAudience}
        </button>
      </div>
    </div>
  );
}
