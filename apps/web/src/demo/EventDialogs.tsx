import {
  clockMinutes,
  copiedEnd,
  durationWords,
  formatEventDayAndClock,
  typedNameMatches,
} from '@soirely/domain';
import { type RefObject, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { ActionPair } from '../components/ActionPair.tsx';
import { type SampleEvent, EVENT_WORDS as W, copyStart, instantOf, keepCopy } from './events.ts';
import { DateTime } from '../components/EventPageParts.tsx';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { Dialog, Head } from '../components/SettingsParts.tsx';
import { figure } from './guestsWords.ts';
import {
  type DuplicatePhase,
  type DuplicateStart,
  type Refusal,
  DUPLICATE_WORDS as D,
  copiedOf,
  notCopiedOf,
  refusalOf,
} from './duplicate.ts';
import { NotBuilt, PhaseTag } from './EventParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import './duplicate.css';

const LOCALE = 'en-US';
const CREATING = 600;
const OPENING_AFTER = 700;

/** Delete, once the event has been live or has anybody on its list: the 400 dialog with the name to type; Delete is red once it matches. */
export function DeleteByName(props: {
  event: SampleEvent;
  people: number;
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
  people,
  typed: first = '',
  mismatch = false,
  onKeep,
  onDelete,
}: {
  event: SampleEvent;
  people: number;
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
        aria-describedby={`${id}-removes ${id}-what ${id}-link ${id}-window`}
      >
        <h2 id={`${id}-title`}>{W.deleteTitle(event.name)}</h2>
        <p id={`${id}-removes`}>{W.removes}</p>
        <ul id={`${id}-what`} className="ev-removes">
          <li>{W.removesEvent}</li>
          {people > 0 && <li>{W.removesGuests(figure(people), people)}</li>}
        </ul>
        <p id={`${id}-link`}>{W.guestsLink}</p>
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

/** Duplicate: what is copied and what is not, and when the copy starts; its end follows at the original's length. With guests.manage on an original with guests, it can also copy the guest list (sc-3656). */
export function DuplicateDialog({
  event,
  start: first,
  onDismiss,
  onCreated,
}: {
  event: SampleEvent;
  start: DuplicateStart;
  onDismiss: () => void;
  onCreated: (words: string) => void;
}) {
  const navigate = useNavigate();
  const [start, setStart] = useState(() => copyStart(event));
  const [ticked, setTicked] = useState(first.ticked);
  const [phase, setPhase] = useState<DuplicatePhase>(first.phase);
  const [failedOnce, setFailedOnce] = useState(false);
  const [back, setBack] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const brings = first.brings;
  const copying = brings != null && ticked;
  const busy = phase === 'creating' || phase === 'created';
  const startsAt = instantOf(start.date, start.time, event.timeZone);
  const end = copiedEnd(start.date, start.time, event.timeZone, event);
  const words = durationWords(clockMinutes(event, event.timeZone) ?? 0, LOCALE);
  const duration = [words.hours, words.minutes].filter(Boolean).join(' ');

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function later(ms: number, then: () => void): void {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(then, ms);
  }

  function create(): void {
    if (startsAt == null || busy) return;

    setPhase('creating');
    later(CREATING, () => {
      if (first.fails && !failedOnce) {
        setFailedOnce(true);
        setPhase('failed');
      } else if (copying && first.refuse != null) setPhase('refused');
      else {
        setPhase('created');
        later(OPENING_AFTER, () => {
          const copy = keepCopy(event, startsAt);
          onCreated(W.created);
          void navigate(`/demo/events/${copy.id}`, {
            state: { told: copying ? D.success(brings.guests) : W.created },
          });
        });
      }
    });
  }

  if (phase === 'refused' && first.refuse != null && brings != null)
    return (
      <CopyRefused
        refusal={refusalOf(first.refuse, brings.people)}
        billing={first.billing}
        onBack={() => {
          setBack(true);
          setPhase('form');
        }}
      />
    );

  return (
    <Dialog
      title={W.duplicate}
      verb={phase === 'creating' ? D.creating : W.createDraft}
      on={startsAt != null}
      locked={busy}
      {...(back && { first: box })}
      onDismiss={() => {
        if (!busy) onDismiss();
      }}
      onConfirm={create}
    >
      <h3 className="ev-dialog-title">{W.duplicateTitle(event.name)}</h3>
      <p className="desk-line">{W.duplicateLine}</p>
      <div>
        <Head title={W.copied} level={3} />
        <ul className="ev-bullets">
          {copiedOf(W.copiedItems, copying, brings?.guests ?? 0).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <Head title={W.notCopied} level={3} />
        <ul className="ev-bullets">
          {notCopiedOf(W.notCopiedItems, copying).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <fieldset className="ev-plain" disabled={busy}>
        <DateTime legend={W.starts} wall={start} onChange={setStart} />
      </fieldset>
      {end != null && (
        <p className="desk-note" role="status">
          {W.copyEnds(
            formatEventDayAndClock(end, event.timeZone, LOCALE),
            duration,
            event.timeZone,
          )}
        </p>
      )}
      {brings != null && (
        <CopyGuests
          ref={box}
          guests={brings.guests}
          ticked={ticked}
          busy={busy}
          onTick={setTicked}
        />
      )}
      {phase === 'failed' && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {D.notCreated}
        </p>
      )}
      <div className="ev-created" role="status">
        {phase === 'created' && (
          <>
            <PhaseTag shown="draft" />
            <p className="desk-line">{W.created}</p>
            {copying && <p className="desk-line">{D.success(brings.guests)}</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}

function CopyGuests({
  ref,
  guests,
  ticked,
  busy,
  onTick,
}: {
  ref: RefObject<HTMLInputElement | null>;
  guests: number;
  ticked: boolean;
  busy: boolean;
  onTick: (ticked: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="ev-copy-guests">
      <label className="ev-copy-tick">
        <input
          ref={ref}
          type="checkbox"
          className="ev-copy-box"
          checked={ticked}
          disabled={busy}
          aria-describedby={`${id}-hint`}
          onChange={(change) => onTick(change.target.checked)}
        />
        <span>{D.label(guests)}</span>
      </label>
      <p id={`${id}-hint`} className="ev-copy-hint">
        {D.hint}
      </p>
    </div>
  );
}

/** sc-3930's refusal of a copy, in the Duplicate dialog's place: no draft is made, and Back to the form keeps the start and the tick. */
function CopyRefused(props: { refusal: Refusal; billing: boolean; onBack: () => void }) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<CopyRefusedBox {...props} />, host);
}

function CopyRefusedBox({
  refusal,
  billing,
  onBack,
}: {
  refusal: Refusal;
  billing: boolean;
  onBack: () => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState<string | null>(null);

  useDeskDialog(box, title, onBack);

  return (
    <>
      <div className="dialog-scrim is-over" aria-hidden="true" />
      <div
        ref={box}
        className="desk-ask ev-refused"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-what ${id}-figure ${id}-safe`}
      >
        <NotBuilt words={D.notBuilt} />
        <div className="ev-refused-head">
          <span className="ev-refused-mark" aria-hidden="true">
            <Glyph name="clear" size={16} weight={2.6} />
          </span>
          <h2 ref={title} id={`${id}-title`} tabIndex={-1}>
            {refusal.title}
          </h2>
        </div>
        <p id={`${id}-what`}>{refusal.what}</p>
        <p id={`${id}-figure`} className="ev-refused-figure">
          {refusal.figure}
        </p>
        <p id={`${id}-safe`} className="ev-refused-safe">
          <Glyph name="shield" size={20} weight={2} />
          {D.safe}
        </p>
        <p className="ev-refused-untick">{D.untick}</p>
        {refusal.plan && (
          <button
            type="button"
            className="desk-text"
            onClick={() => setSaid(D.elsewhere(billing ? D.changePlan : D.askOwner))}
          >
            {billing ? D.changePlan : D.askOwner}
          </button>
        )}
        <p className="desk-note" role="status">
          {said}
        </p>
        <div className="ev-refused-back">
          <button type="button" className="desk-text" onClick={onBack}>
            {D.backToForm}
          </button>
        </div>
      </div>
    </>
  );
}
