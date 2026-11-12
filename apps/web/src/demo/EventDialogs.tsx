import {
  clockMinutes,
  copiedEnd,
  durationWords,
  formatEventDayAndClock,
  typedNameMatches,
} from '@soirely/domain';
import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { ActionPair } from '../components/ActionPair.tsx';
import { type SampleEvent, EVENT_WORDS as W, copyStart, instantOf, keepCopy } from './events.ts';
import { DateTime } from '../components/EventPageParts.tsx';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { Dialog, Head } from '../components/SettingsParts.tsx';
import { figure } from './guestsWords.ts';
import { Glyph } from '../components/Glyph.tsx';
import { NotBuilt } from './EventParts.tsx';
import {
  type CopyRefused,
  CEILING,
  DW,
  OVER_CEILING,
  copyRefusal,
  guestsToCopy,
} from './duplicateGuests.ts';
import './doorCode.css';

const LOCALE = 'en-US';

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

/** How Duplicate opens: the drawn states of sc-3656, each on the sample's own guests unless the 403 is forced. */
export type DuplicateStart =
  | 'form'
  | 'ticked'
  | 'noManage'
  | 'creating'
  | 'notCreated'
  | 'overPlan'
  | 'overPlanAsk'
  | 'overCeiling';

type Phase =
  | { at: 'form' }
  | { at: 'creating' }
  | { at: 'notCreated' }
  | { at: 'refused'; problem: CopyRefused };

const CREATING_MS = 600;

function phaseOf(start: DuplicateStart, eventId: string): Phase {
  switch (start) {
    case 'creating':
      return { at: 'creating' };
    case 'notCreated':
      return { at: 'notCreated' };
    case 'overPlan':
    case 'overPlanAsk':
      return { at: 'refused', problem: copyRefusal(eventId) ?? OVER_CEILING };
    case 'overCeiling':
      return { at: 'refused', problem: OVER_CEILING };
    default:
      return { at: 'form' };
  }
}

/** Duplicate: what is copied and what is not, and when the copy starts; its end follows at the original's length. With guests, and guests.manage, the guest list can come too (sc-3656). */
export function DuplicateDialog({
  event,
  begin = 'form',
  onDismiss,
  onCreated,
}: {
  event: SampleEvent;
  begin?: DuplicateStart;
  onDismiss: () => void;
  onCreated: (words: string) => void;
}) {
  const navigate = useNavigate();
  const id = useId();
  const box = useRef<HTMLInputElement>(null);
  const [start, setStart] = useState(() => copyStart(event));
  const guests = begin === 'noManage' ? 0 : guestsToCopy(event.id);
  const [ticked, setTicked] = useState(
    guests > 0 && begin !== 'form' && begin !== 'noManage' && begin !== 'creating',
  );
  const [phase, setPhase] = useState<Phase>(() => phaseOf(begin, event.id));
  const [asked, setAsked] = useState(false);
  const [cameBack, setCameBack] = useState(false);
  const timer = useRef<number | null>(null);
  const startsAt = instantOf(start.date, start.time, event.timeZone);
  const end = copiedEnd(start.date, start.time, event.timeZone, event);
  const words = durationWords(clockMinutes(event, event.timeZone) ?? 0, LOCALE);
  const duration = [words.hours, words.minutes].filter(Boolean).join(' ');
  const copying = ticked && guests > 0;
  const busy = phase.at === 'creating';

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function create(): void {
    if (startsAt == null || busy) return;
    setPhase({ at: 'creating' });
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const problem = copying ? copyRefusal(event.id) : null;

      if (problem != null) {
        setPhase({ at: 'refused', problem });
        return;
      }
      const copy = keepCopy(event, startsAt, copying);
      const told = copying ? `${W.created} ${DW.copied(guests)}` : W.created;
      onCreated(told);
      void navigate(`/demo/events/${copy.id}`, { state: { told } });
    }, CREATING_MS);
  }

  if (phase.at === 'refused') {
    return (
      <Refusal
        key="refused"
        problem={phase.problem}
        billing={begin !== 'overPlanAsk'}
        asked={asked}
        onAsk={() => setAsked(true)}
        onBack={() => {
          setCameBack(true);
          setPhase({ at: 'form' });
        }}
      />
    );
  }

  const copiedItems = copying ? [...W.copiedItems, DW.copiedGuests(guests)] : W.copiedItems;
  const notCopiedItems = copying
    ? [
        ...W.notCopiedItems.filter((item) => item !== 'Guests' && item !== 'Replies'),
        DW.notCopiedGuests,
      ]
    : W.notCopiedItems;

  return (
    <Dialog
      key="form"
      title={W.duplicate}
      verb={W.createDraft}
      on={startsAt != null && !busy}
      locked={busy}
      {...(cameBack ? { first: box } : {})}
      onDismiss={() => !busy && onDismiss()}
      onConfirm={create}
    >
      <h3 className="ev-dialog-title">{W.duplicateTitle(event.name)}</h3>
      <p className="desk-line">{W.duplicateLine}</p>
      <div>
        <Head title={W.copied} level={3} />
        <ul className="ev-bullets">
          {copiedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <Head title={W.notCopied} level={3} />
        <ul className="ev-bullets">
          {notCopiedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <fieldset className="ev-copy-when" disabled={busy}>
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
      {guests > 0 && (
        <label className="ev-copy-guests">
          <span className="ev-copy-box">
            <input
              ref={box}
              type="checkbox"
              className="ev-copy-input"
              checked={ticked}
              disabled={busy}
              aria-labelledby={`${id}-copy`}
              aria-describedby={`${id}-copy-hint`}
              onChange={() => setTicked((was) => !was)}
            />
            {ticked && <Glyph name="tick" size={16} weight={3} className="ev-copy-tick" />}
          </span>
          <span className="ev-copy-words">
            <span id={`${id}-copy`} className="ev-copy-label">
              {DW.box(guests)}
            </span>
            <span id={`${id}-copy-hint`} className="ev-copy-hint">
              {DW.hint}
            </span>
          </span>
        </label>
      )}
      <p className={busy ? 'desk-unseen dc-making' : 'desk-unseen'} role="status">
        {busy ? DW.creating : ''}
      </p>
      {phase.at === 'notCreated' && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {DW.notCreated}
        </p>
      )}
    </Dialog>
  );
}

/** A copy over the plan's people per event, or over the ceiling, refused in the Duplicate dialog's place (sc-3930, Decided 1 Nov). */
function Refusal({
  problem,
  billing,
  asked,
  onAsk,
  onBack,
}: {
  problem: CopyRefused;
  billing: boolean;
  asked: boolean;
  onAsk: () => void;
  onBack: () => void;
}) {
  const plan = problem.type === 'plan_limit_reached' ? problem : null;
  const title = plan != null ? DW.planTitle(plan.limit) : DW.ceilingTitle(CEILING);

  return (
    <Dialog title={title} verb={null} dismiss={DW.backToForm} onDismiss={onBack} onConfirm={onBack}>
      <NotBuilt words={W.notBuilt('sc-3930')} />
      <p className="desk-line">
        {plan != null
          ? DW.overPlan(plan.count, plan.limit)
          : DW.overCeiling(problem.count, CEILING)}
      </p>
      <p className="ev-copy-figure">
        {plan != null ? DW.figurePlan(plan.count, plan.plan) : DW.figureCeiling(problem.count)}
      </p>
      <p className="ev-copy-kept">
        <Glyph name="shield" size={16} weight={2.2} />
        {DW.kept}
      </p>
      <p className="ev-copy-untick">{DW.untick}</p>
      {plan != null && billing && (
        <button type="button" className="button">
          {DW.changePlan}
        </button>
      )}
      {plan != null && !billing && !asked && (
        <button type="button" className="button" onClick={onAsk}>
          {DW.askOwner}
        </button>
      )}
      <p className="desk-note" role="status">
        {plan != null && !billing && asked ? DW.asked : ''}
      </p>
    </Dialog>
  );
}
