import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { SearchField } from '../components/SearchField.tsx';
import {
  type ChooseView,
  type Flag,
  type Pickable,
  CHIPS_SHOWN,
  CHW,
  chw,
  choseAudience,
  chosenIds,
  flagWord,
  matching,
  pickable,
  pickedOf,
} from './messagesChoose.ts';
import type { Audience } from './messagesTo.ts';
import { MW } from './messagesWords.ts';
import './messagesChoose.css';

const SKELETON_ROWS = 7;

function FlagLine({ flag, id }: { flag: Flag; id: string }) {
  return (
    <span id={id} className={flag === 'noAddress' ? 'mgc-flag' : 'mgc-flag is-stopped'}>
      <span
        className={flag === 'noAddress' ? 'mg-mark is-none' : 'mg-mark is-notsent'}
        aria-hidden="true"
      />
      {flagWord(flag)}
    </span>
  );
}

/** Choose guests, inside To: search by name (and address, with guests.manage), tick guests one by one, Done. Every tick is kept at once, so Escape keeps it too. */
export function ChoosePanel({
  to,
  first,
  addresses,
  titleId,
  onPick,
  onBack,
  onClose,
  onDoneNone,
}: {
  to: Audience;
  first: ChooseView | null;
  addresses: boolean;
  titleId: string;
  onPick: (to: Audience) => void;
  onBack: () => void;
  onClose: () => void;
  onDoneNone: () => void;
}) {
  const [typed, setTyped] = useState(first?.typed ?? '');
  const [loading] = useState(first?.loading ?? false);
  const [at, setAt] = useState<string | null>(() =>
    first?.first?.startsWith('guest:') === true ? first.first.slice('guest:'.length) : null,
  );
  const list = useRef<HTMLUListElement>(null);
  const ids = useId();
  const chosen = chosenIds(to);
  const shown = matching(typed, addresses);
  const total = pickable().length;
  const active = shown.some((guest) => guest.id === at) ? at : (shown[0]?.id ?? null);

  useEffect(() => {
    const key = first?.first;

    if (key == null) return;

    const target = list.current
      ?.closest('.mgc')
      ?.querySelector<HTMLElement>(
        key === 'find' ? 'input[type=search]' : `[data-guest="${key.slice('guest:'.length)}"]`,
      );

    target?.setAttribute('data-focus', 'choose-first');
    target?.focus();
  }, [first]);

  function tick(guest: Pickable): void {
    setAt(guest.id);
    onPick(
      choseAudience(
        chosen.includes(guest.id) ? chosen.filter((id) => id !== guest.id) : [...chosen, guest.id],
      ),
    );
  }

  function move(keyEvent: KeyboardEvent<HTMLInputElement>): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(keyEvent.key)) return;

    const boxes = [...(list.current?.querySelectorAll<HTMLInputElement>('[data-guest]') ?? [])];
    const now = boxes.indexOf(document.activeElement as HTMLInputElement);
    const next =
      keyEvent.key === 'Home'
        ? 0
        : keyEvent.key === 'End'
          ? boxes.length - 1
          : Math.min(boxes.length - 1, Math.max(0, now + (keyEvent.key === 'ArrowDown' ? 1 : -1)));
    const target = boxes[next];

    keyEvent.preventDefault();
    if (target == null) return;
    setAt(target.dataset.guest ?? null);
    target.focus();
  }

  function done(): void {
    if (chosen.length === 0) onDoneNone();
    else onClose();
  }

  const status = loading
    ? CHW.loading
    : typed.trim() === ''
      ? chw.many('guests', total)
      : chw.filled(CHW.shown, { shown: shown.length, total });

  return (
    <div className="mgc">
      <div className="mg-pop-head">
        <button type="button" className="mg-close mgc-back" aria-label={CHW.back} onClick={onBack}>
          <Glyph name="back" size={18} weight={2.4} />
        </button>
        <h3 id={titleId} className="mg-to-title mgc-title">
          {MW.chooseGuests}
        </h3>
        <button type="button" className="mg-close" aria-label={MW.closeTo} onClick={onClose}>
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <SearchField
        label={CHW.find}
        clearLabel={CHW.clearSearch}
        value={typed}
        off={loading}
        describedBy={`${ids}-status`}
        onChange={setTyped}
        onClear={() => setTyped('')}
        onEnter={() => list.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()}
      />
      <p id={`${ids}-status`} className="mgc-status" role="status">
        {status}
      </p>
      <div className="mgc-scroll">
        {loading ? (
          <ul className="mgc-skeleton" aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li key={index} className="mgc-skeleton-row">
                <span className="mgc-skeleton-box" />
                <span className="mgc-skeleton-lines">
                  <span className="mgc-skeleton-bar" />
                  {addresses && <span className="mgc-skeleton-bar is-short" />}
                </span>
              </li>
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <div className="mgc-none">
            <p className="mgc-none-head">{CHW.noMatch}</p>
            <button
              type="button"
              className="desk-text"
              onClick={() => {
                setTyped('');
                list.current?.closest('.mgc')?.querySelector<HTMLElement>('input')?.focus();
              }}
            >
              {CHW.clear}
            </button>
          </div>
        ) : null}
        <ul
          ref={list}
          className="mgc-list"
          aria-labelledby={titleId}
          hidden={loading || shown.length === 0}
        >
          {shown.map((guest) => {
            const said = [
              addresses && guest.email != null ? `${ids}-${guest.id}-at` : null,
              guest.flag == null ? null : `${ids}-${guest.id}-flag`,
            ].filter(Boolean);

            return (
              <li key={guest.id}>
                <label className={chosen.includes(guest.id) ? 'mgc-row is-on' : 'mgc-row'}>
                  <input
                    type="checkbox"
                    className="gs-box mgc-box"
                    checked={chosen.includes(guest.id)}
                    tabIndex={guest.id === active ? 0 : -1}
                    aria-labelledby={`${ids}-${guest.id}-name`}
                    aria-describedby={said.length > 0 ? said.join(' ') : undefined}
                    data-guest={guest.id}
                    onFocus={() => setAt(guest.id)}
                    onKeyDown={move}
                    onChange={() => tick(guest)}
                  />
                  <span className="mgc-words">
                    <span id={`${ids}-${guest.id}-name`} className="mgc-name">
                      {guest.name}
                    </span>
                    {addresses && guest.email != null && (
                      <span id={`${ids}-${guest.id}-at`} className="mgc-address">
                        {guest.email}
                      </span>
                    )}
                    {guest.flag != null && (
                      <FlagLine flag={guest.flag} id={`${ids}-${guest.id}-flag`} />
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mgc-foot">
        <p className="mgc-chosen" aria-live="polite">
          {chw.filled(CHW.chosen, { count: chosen.length })}
        </p>
        <button type="button" className="button button-primary mgc-done" onClick={done}>
          {CHW.done}
        </button>
      </div>
    </div>
  );
}

/** The guests chosen one by one, back in To: each removable, the first six shown and "{n} more" opening the picker. */
export function ChosenChips({
  to,
  onPick,
  onMore,
}: {
  to: Audience;
  onPick: (to: Audience) => void;
  onMore: () => void;
}) {
  const people = pickedOf(chosenIds(to));
  const left = people.length - CHIPS_SHOWN;

  if (people.length === 0) return null;

  return (
    <ul className="mgc-chips" aria-label={CHW.chosenTo}>
      {people.slice(0, CHIPS_SHOWN).map((guest) => (
        <li key={guest.id} className="mg-cond mgc-chip">
          {guest.name}
          <button
            type="button"
            aria-label={chw.filled(CHW.remove, { name: guest.name })}
            onClick={() => onPick(choseAudience(chosenIds(to).filter((id) => id !== guest.id)))}
          >
            <Glyph name="clear" size={13} weight={2.6} />
          </button>
        </li>
      ))}
      {left > 0 && (
        <li>
          <button type="button" className="desk-text mgc-more" onClick={onMore}>
            {chw.filled(CHW.more, { count: left })}
          </button>
        </li>
      )}
    </ul>
  );
}
