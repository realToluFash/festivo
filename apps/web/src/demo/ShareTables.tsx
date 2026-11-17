import { useId, useRef } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { Ask, Mark, TextAction } from '../components/SettingsParts.tsx';
import { sampleEvent } from './events.ts';
import { EVENT_ID } from './seating.ts';
import { useSeating } from './seatingContext.ts';
import {
  SHARE_TODAY,
  SHARE_WORDS as W,
  type Share,
  isPassed,
  seatedComing,
  shareByRefusal,
  shareDay,
  unseatedComing,
} from './shareTables.ts';
import '../components/eventPage.css';
import './shareTables.css';

const WEDDING = sampleEvent(EVENT_ID);
const TIME_ZONE = WEDDING?.timeZone ?? 'Europe/London';
const STARTS_AT = WEDDING?.startsAt ?? '2026-11-05T18:00:00Z';
const EVENT_DAY = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'short',
  timeZone: TIME_ZONE,
}).format(new Date(STARTS_AT));

/** sc-4022: Share tables with guests, at the top of the panel under the room line. */
export function ShareTables() {
  const { ui, set } = useSeating();
  const { share, readOnly } = ui;
  const n = seatedComing(ui.plan);
  const u = unseatedComing(ui.tray);
  const change = (next: (was: Share) => Share) =>
    set((now) => ({ ...now, share: next(now.share) }));

  return (
    <section
      className={share.asking == null ? 'st-block st-share' : 'st-block st-share is-asking'}
      aria-labelledby="st-share-h"
    >
      <div className="st-head">
        <h2 id="st-share-h">{W.title}</h2>
      </div>
      {share.shared == null ? (
        <NotShared share={share} unseated={u} readOnly={readOnly} change={change} />
      ) : (
        <Shared share={share} readOnly={readOnly} change={change} />
      )}
      {readOnly && <p className="st-line">{W.readOnly}</p>}
      {share.asking === 'share' && (
        <Ask
          title={W.askShare}
          line={W.askShareLine(n)}
          keep={W.notYet}
          go={W.shareGo}
          red={false}
          failed={share.failed ? W.shareFailed : undefined}
          onKeep={() => change((was) => ({ ...was, asking: null, failed: false }))}
          onGo={() =>
            change((was) => ({
              ...was,
              asking: null,
              failed: false,
              stopped: false,
              shared: SHARE_TODAY,
            }))
          }
        >
          {u > 0 && <p>{W.askShareUnseated(u)}</p>}
        </Ask>
      )}
      {share.asking === 'stop' && (
        <Ask
          title={W.askStop}
          line={W.askStopLine}
          keep={W.keepSharing}
          go={W.stopGo}
          red={false}
          onKeep={() => change((was) => ({ ...was, asking: null }))}
          onGo={() =>
            change((was) => ({ ...was, asking: null, shared: null, stopped: true, editing: false }))
          }
        />
      )}
    </section>
  );
}

function NotShared({
  share,
  unseated,
  readOnly,
  change,
}: {
  share: Share;
  unseated: number;
  readOnly: boolean;
  change: (next: (was: Share) => Share) => void;
}) {
  return (
    <>
      {share.stopped && (
        <p className="st-share-said" role="status">
          {W.stopped}
        </p>
      )}
      {readOnly && <p className="st-line is-ink">{W.notSharedText}</p>}
      <p className="st-line">{W.line}</p>
      {unseated > 0 && (
        <p className="st-share-unseated">
          <Glyph name="warn" size={15} weight={2.2} />
          <span>{W.unseated(unseated)}</span>
        </p>
      )}
      <ShareBy share={share} readOnly={readOnly} change={change} />
      {!readOnly && (
        <button
          type="button"
          className="button button-primary st-share-go"
          onClick={() => change((was) => ({ ...was, asking: 'share', failed: false }))}
        >
          {W.share}
        </button>
      )}
    </>
  );
}

function Shared({
  share,
  readOnly,
  change,
}: {
  share: Share;
  readOnly: boolean;
  change: (next: (was: Share) => Share) => void;
}) {
  const day = shareDay(share.shared ?? SHARE_TODAY);

  return (
    <>
      <p className="st-share-on">
        <Mark kind="yes" />
        <span>{W.shared}</span>
      </p>
      <p className="st-line">{W.since(day)}</p>
      {share.by != null && <p className="st-line">{W.scheduleShared(day)}</p>}
      {!readOnly && (
        <button
          type="button"
          className="button st-share-stop"
          onClick={() => change((was) => ({ ...was, asking: 'stop' }))}
        >
          {W.stop}
        </button>
      )}
    </>
  );
}

function ShareBy({
  share,
  readOnly,
  change,
}: {
  share: Share;
  readOnly: boolean;
  change: (next: (was: Share) => Share) => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const passed = isPassed(share, SHARE_TODAY);
  const open = !readOnly && (share.by == null || share.editing);
  const refused = share.refused;
  const refusal =
    refused === 'afterEvent'
      ? W.refused.afterEvent(shareDay(EVENT_DAY))
      : refused == null
        ? null
        : W.refused[refused];

  function save(): void {
    const next = shareByRefusal(
      share.typed,
      { startsAt: STARTS_AT, timeZone: TIME_ZONE },
      SHARE_TODAY,
    );

    change((was) =>
      next == null
        ? { ...was, by: was.typed, editing: false, refused: null, stopped: false }
        : { ...was, refused: next },
    );
    if (next != null) field.current?.focus();
  }

  if (open)
    return (
      <div className="desk-field st-share-by">
        <label htmlFor={id} className="desk-label">
          {W.shareBy}
          <span className="ev-optional">{W.optional}</span>
        </label>
        <div className="st-share-by-row">
          <input
            ref={field}
            id={id}
            type="date"
            className={refusal == null ? 'ev-input' : 'ev-input is-wrong'}
            value={share.typed}
            min={SHARE_TODAY}
            aria-invalid={refusal != null}
            aria-describedby={refusal == null ? undefined : `${id}-error`}
            onChange={(typed) =>
              change((was) => ({ ...was, typed: typed.target.value, refused: null }))
            }
          />
          <button type="button" className="button" onClick={save}>
            {W.saveDate}
          </button>
        </div>
        {refusal != null && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {refusal}
          </p>
        )}
      </div>
    );

  if (share.by == null) return null;
  const day = shareDay(share.by);

  return (
    <div className="st-share-by">
      <p className="desk-label">{W.shareBy}</p>
      <div className="st-share-saved">
        <span className="st-share-day">{day}</span>
        {passed && (
          <span className="st-share-passed">
            <Glyph name="clock" size={14} weight={2.3} />
            {W.passed}
          </span>
        )}
        {!readOnly && (
          <span className="st-share-acts">
            <TextAction
              label={W.change}
              onClick={() =>
                change((was) => ({ ...was, editing: true, typed: was.by ?? '', refused: null }))
              }
            />
            <TextAction
              label={W.remove}
              onClick={() =>
                change((was) => ({ ...was, by: null, typed: '', editing: false, refused: null }))
              }
            />
          </span>
        )}
      </div>
      <p className="st-line">{passed ? W.scheduleByPassed(day) : W.scheduleBy(day)}</p>
    </div>
  );
}
