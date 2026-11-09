import {
  clockMinutes,
  copiedEnd,
  durationWords,
  formatEventDayAndClock,
  typedNameMatches,
} from '@soirely/domain';
import { useContext, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { ActionPair } from '../components/ActionPair.tsx';
import { type SampleEvent, EVENT_WORDS as W, copyStart, instantOf, keepCopy } from './events.ts';
import { DateTime } from '../components/EventPageParts.tsx';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { Dialog, Head } from '../components/SettingsParts.tsx';

const LOCALE = 'en-US';

/** Delete, once the event has been live: the 400 dialog with the name to type; Delete is red once it matches. */
export function DeleteByName(props: {
  event: SampleEvent;
  typed?: string;
  mismatch?: boolean;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<DeleteBox {...props} />, host);
}

function DeleteBox({
  event,
  typed: first = '',
  mismatch = false,
  onKeep,
  onDelete,
}: {
  event: SampleEvent;
  typed?: string;
  mismatch?: boolean;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(first);
  const [told, setTold] = useState(mismatch);
  const matched = typedNameMatches(typed, event.name);
  const wrong = told && !matched;

  useDeskDialog(box, field, onKeep);

  function go(): void {
    if (matched) onDelete();
    else {
      setTold(true);
      field.current?.focus();
    }
  }

  return (
    <>
      <div className="dialog-scrim is-over" aria-hidden="true" />
      <div
        ref={box}
        className="desk-ask ev-delete"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-removes ${id}-window`}
      >
        <h2 id={`${id}-title`}>{W.deleteTitle(event.name)}</h2>
        <p id={`${id}-removes`}>{W.removes}</p>
        <p id={`${id}-window`}>{W.restoreWindow(W.restoreUntil)}</p>
        <div className="desk-field">
          <label htmlFor={`${id}-name`} className="desk-label">
            {W.typeName(event.name)}
          </label>
          <div className={wrong ? 'desk-box is-wrong' : 'desk-box'}>
            <input
              ref={field}
              id={`${id}-name`}
              type="text"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={wrong}
              aria-describedby={`${id}-help`}
              onChange={(change) => setTyped(change.target.value)}
              onBlur={() => setTold(typed !== '' && !typedNameMatches(typed, event.name))}
              onKeyDown={(key) => {
                if (key.key === 'Enter') go();
              }}
            />
          </div>
          {wrong ? (
            <p id={`${id}-help`} className="desk-error" role="alert">
              {W.mismatch(event.name)}
            </p>
          ) : (
            <p id={`${id}-help`} className="desk-help">
              {W.typeHint}
            </p>
          )}
        </div>
        <ActionPair
          className="desk-ask-pair"
          dismiss={
            <button type="button" className="desk-text" onClick={onKeep}>
              {W.keepIt}
            </button>
          }
          confirm={
            <button
              type="button"
              className={matched ? 'desk-text is-red' : 'desk-text is-off'}
              aria-disabled={!matched}
              onClick={go}
            >
              {W.delete}
            </button>
          }
        />
      </div>
    </>
  );
}

/** Duplicate: what is copied and what is not, and when the copy starts; its end follows at the original's length. */
export function DuplicateDialog({
  event,
  onDismiss,
  onCreated,
}: {
  event: SampleEvent;
  onDismiss: () => void;
  onCreated: (words: string) => void;
}) {
  const navigate = useNavigate();
  const [start, setStart] = useState(() => copyStart(event));
  const startsAt = instantOf(start.date, start.time, event.timeZone);
  const end = copiedEnd(start.date, start.time, event.timeZone, event);
  const words = durationWords(clockMinutes(event, event.timeZone) ?? 0, LOCALE);
  const duration = [words.hours, words.minutes].filter(Boolean).join(' ');

  return (
    <Dialog
      title={W.duplicate}
      verb={W.createDraft}
      on={startsAt != null}
      onDismiss={onDismiss}
      onConfirm={() => {
        if (startsAt == null) return;
        const copy = keepCopy(event, startsAt);
        onCreated(W.created);
        void navigate(`/demo/events/${copy.id}`, { state: { told: W.created } });
      }}
    >
      <h3 className="ev-dialog-title">{W.duplicateTitle(event.name)}</h3>
      <p className="desk-line">{W.duplicateLine}</p>
      <div>
        <Head title={W.copied} level={3} />
        <ul className="ev-bullets">
          {W.copiedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <Head title={W.notCopied} level={3} />
        <ul className="ev-bullets">
          {W.notCopiedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <DateTime legend={W.starts} wall={start} onChange={setStart} />
      {end != null && (
        <p className="desk-note" role="status">
          {W.copyEnds(
            formatEventDayAndClock(end, event.timeZone, LOCALE),
            duration,
            event.timeZone,
          )}
        </p>
      )}
    </Dialog>
  );
}
