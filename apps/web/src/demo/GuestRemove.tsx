import { type FocusEvent, useEffect, useId, useRef, useState } from 'react';

import { Ask, RowWords } from '../components/SettingsParts.tsx';
import type { Guest } from './guests.ts';
import { MarkLead } from './GuestsParts.tsx';
import { RMW, type Removed, type Removing, UNDO_SECONDS, nextCount } from './guestRemove.ts';
import { goesWith, removedLine } from './guestRemoveRows.ts';
import './guestRemove.css';

/** sc-3774: "Remove {full name}?" naming what goes with them; Keep on the list first. A refusal takes the question's place with its one way back. */
export function RemoveAsk({
  guest,
  removing,
  onKeep,
  onRemove,
  onBack,
}: {
  guest: Guest;
  removing: Removing;
  onKeep: () => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const id = useId();

  if (removing.refused != null)
    return (
      <Ask
        title={RMW.title(guest.name)}
        line={
          removing.refused === 'arrived'
            ? RMW.justArrived(guest.name)
            : RMW.alreadyRemoved(guest.name)
        }
        keep={removing.refused === 'arrived' ? RMW.backToDetails : RMW.backToGuests}
        onKeep={onBack}
      />
    );

  return (
    <Ask
      title={RMW.title(guest.name)}
      line={RMW.goes}
      keep={RMW.keep}
      go={RMW.go}
      red={false}
      describedBy={`${id}-goes ${id}-sent`}
      onKeep={onKeep}
      onGo={onRemove}
    >
      <ul id={`${id}-goes`} className="desk-rows gs-rows gr-goes">
        {goesWith(guest).map((row) => (
          <li key={row.key} className="desk-row">
            <MarkLead reply={row.reply} />
            <RowWords title={row.title} lines={row.lines} />
          </li>
        ))}
      </ul>
      <p id={`${id}-sent`}>{RMW.nothingSent}</p>
    </Ask>
  );
}

/** "{full name} removed" with Undo. The 10 seconds count only while focus and the pointer are both off it, and start again from 10 when they leave. */
export function UndoMessage({
  removed,
  onUndo,
  onGone,
}: {
  removed: Removed;
  onUndo: () => void;
  onGone: () => void;
}) {
  const [left, setLeft] = useState(UNDO_SECONDS);
  const focused = useRef(false);
  const pointed = useRef(false);
  const gone = useRef(onGone);

  useEffect(() => {
    gone.current = onGone;
  }, [onGone]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setLeft((was) => nextCount(was, focused.current || pointed.current)),
      1000,
    );

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left === 0) gone.current();
  }, [left]);

  function blurred(event: FocusEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    focused.current = false;
  }

  return (
    <div
      className="toast gr-undo"
      role="status"
      onPointerEnter={() => {
        pointed.current = true;
      }}
      onPointerLeave={() => {
        pointed.current = false;
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={blurred}
    >
      <p className="toast-words">
        {removedLine(removed.guest)}
        <span className="visually-hidden"> {RMW.undoOpen}</span>
      </p>
      <span className="gr-count" aria-hidden="true">
        {RMW.secondsLeft(left)}
      </span>
      <button type="button" className="toast-undo" data-focus="undo" onClick={onUndo}>
        {RMW.undo}
      </button>
    </div>
  );
}
