import { useEffect, useRef } from 'react';

import { ActionPair } from '../components/ActionPair.tsx';
import { useDialogKeys } from '../dialogFocus.ts';

import { Glyph } from './HowItsGoing.tsx';
import {
  ASKING,
  type Access,
  type Bulk,
  type Flag,
  type Guest,
  ITEM,
  MARKED,
  type RunOut,
  answer,
  answerOf,
  askBulk,
  askOne,
  askedNow,
  bulkKey,
  bulkLabel,
  bulkRows,
  canChooseAgain,
  cancel,
  changed,
  chooseFor,
  confirmBulk,
  confirmNote,
  confirmTitle,
  countLine,
  isAsked,
  markAvailable,
  nowLine,
  openChoose,
  options,
  waiting,
  whereLine,
} from './runOut.ts';
import './runOut.css';
import {
  ARROW_GLYPH,
  BAN_GLYPH,
  BUBBLE_GLYPH,
  CHECK_GLYPH,
  CLOSE_GLYPH,
  FLAG_GLYPH,
  OFFLINE_GLYPH,
} from './serviceGlyphs.ts';

/** The choice panel (RunOutChoice.dc.html, d1): docked at 520 beside How it's going, a dialog that gives focus back to what opened it. */
export function RunOutPanel({
  ro,
  access,
  strip,
  act,
  close,
}: {
  ro: RunOut;
  access: Access;
  strip: string;
  act: (next: RunOut) => void;
  close: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const idle = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusTo = useRef('');
  const inner = ro.confirm != null || ro.choosing != null;

  useDialogKeys(inner ? idle : box, close, inner);
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    if (focusTo.current === '' || inner) return;
    const to = document.querySelector<HTMLElement>(focusTo.current) ?? heading.current;
    to?.focus();
    focusTo.current = '';
  });

  function then(next: RunOut, focus: string): void {
    focusTo.current = focus;
    act(next);
  }

  const rows = waiting(ro);
  const done = changed(ro);
  const choosing = ro.guests.find((x) => x.id === ro.choosing);
  const askedRows = askedNow(ro);

  return (
    <>
      <div className="rout-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="rout-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rout-title"
        tabIndex={-1}
      >
        <div className="rout-head">
          <div className="rout-head-words">
            <h2 id="rout-title" ref={heading} className="rout-title" tabIndex={-1}>
              <Glyph paths={BAN_GLYPH} size={22} />
              {ITEM} has run out
            </h2>
            <p className="hig-meta">{MARKED}</p>
          </div>
          <button className="rout-close" type="button" aria-label="Close" onClick={close}>
            <Glyph paths={CLOSE_GLYPH} size={20} />
          </button>
        </div>
        <div className="rout-body">
          <div className="rout-strip" role="status">
            {access.online ? (
              <span className="hig-status-dot" aria-hidden="true" />
            ) : (
              <Glyph paths={OFFLINE_GLYPH} size={16} />
            )}
            <span>{strip}</span>
          </div>
          {ro.refused !== '' && (
            <div className="hig-refused" role="alert">
              <Glyph paths={access.online ? BAN_GLYPH : OFFLINE_GLYPH} size={18} />
              <span>{ro.refused}</span>
            </div>
          )}

          <AskCount ro={ro} />

          <section className="rout-part" aria-labelledby="rout-bulk">
            <h3 id="rout-bulk" className="rout-part-title">
              Everyone at once
            </h3>
            <ul className="rout-bulk-list">
              {bulkRows(ro).map((b) => (
                <li key={b.key}>
                  {b.stands ? (
                    <div className="rout-stands">
                      <Glyph paths={ARROW_GLYPH} size={18} />
                      <span className="rout-stands-words">
                        <strong>{b.label}</strong>
                        <span>Applies to guests still to come</span>
                      </span>
                      {b.bulk.kind === 'ask' && <NotBuilt />}
                    </div>
                  ) : (
                    <button
                      className="rout-bulk"
                      type="button"
                      data-bulk={b.key}
                      onClick={() => act(askBulk(ro, b.bulk, access))}
                    >
                      {b.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rout-part" aria-labelledby="rout-waiting">
            <h3 id="rout-waiting" className="rout-part-title">
              Waiting for a choice · {rows.length}
            </h3>
            {rows.length === 0 ? (
              <p className="hig-meta">Nobody is waiting for a choice now.</p>
            ) : (
              <ul className="rout-guests">
                {rows.map((x) => (
                  <li key={x.id} className="rout-guest">
                    <GuestWords x={x} />
                    <span className="rout-guest-acts">
                      <button
                        className="button rout-choose-for"
                        type="button"
                        data-choose-for={x.id}
                        onClick={() => act(openChoose(ro, x.id, access))}
                      >
                        Choose for {x.name}
                      </button>
                      {isAsked(ro, x) ? (
                        <span className="rout-asking">
                          <Glyph paths={BUBBLE_GLYPH} size={16} />
                          {ASKING}
                        </span>
                      ) : (
                        <button
                          className="button"
                          type="button"
                          data-ask={x.id}
                          onClick={() =>
                            then(askOne(ro, x.id, access), `[data-choose-for="${x.id}"]`)
                          }
                        >
                          Ask {x.name}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section className="rout-part" aria-labelledby="rout-changed">
              <h3 id="rout-changed" className="rout-part-title">
                Already changed
              </h3>
              <ul className="rout-guests">
                {done.map((x) => (
                  <li key={x.id} className="rout-guest rout-changed">
                    <span className="rout-guest-words">
                      <strong>{x.name}</strong>
                      <span className="hig-meta">{whereLine(x)}</span>
                      <span className="rout-now">
                        <Glyph paths={CHECK_GLYPH} size={16} />
                        {nowLine(ro, x)}
                      </span>
                    </span>
                    {canChooseAgain(ro, x) && (
                      <button
                        className="hig-text-button"
                        type="button"
                        data-choose-for={x.id}
                        onClick={() => act(openChoose(ro, x.id, access))}
                      >
                        Choose for {x.name}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="rout-foot">
            <button className="button" type="button" onClick={() => act(markAvailable(ro, access))}>
              Mark available again
            </button>
          </div>

          {askedRows.length > 0 && (
            <section className="rout-board" aria-labelledby="rout-board-title">
              <h3 id="rout-board-title" className="rout-board-title">
                Board only · a waiter records a guest’s answer at the table
              </h3>
              <ul className="rout-board-list">
                {askedRows.map((x) => {
                  const o = answerOf(ro, x);
                  if (o == null) return null;
                  const what = o.to == null ? `without ${ITEM}` : o.to;
                  return (
                    <li key={x.id}>
                      <button
                        className="button demo-dense"
                        type="button"
                        data-answer={x.id}
                        onClick={() => then(answer(ro, x.id, o.to, access), '[data-answer]')}
                      >
                        Board only: {x.name} answers {what} at table {x.table}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {ro.confirm != null && (
        <ConfirmDialog
          ro={ro}
          onCancel={() => then(cancel(ro), `[data-bulk="${bulkKey(ro.confirm as Bulk)}"]`)}
          onGo={() => then(confirmBulk(ro, access), '#rout-title')}
        />
      )}
      {choosing != null && (
        <ChooseDialog
          ro={ro}
          x={choosing}
          onCancel={() => then(cancel(ro), `[data-choose-for="${choosing.id}"]`)}
          onPick={(to) =>
            then(chooseFor(ro, choosing.id, to, access), `[data-choose-for="${choosing.id}"]`)
          }
        />
      )}
    </>
  );
}

function GuestWords({ x }: { x: Guest }) {
  return (
    <span className="rout-guest-words">
      <strong>{x.name}</strong>
      <span className="hig-meta">{whereLine(x)}</span>
      {x.flags.length > 0 && (
        <span className="rout-flags">
          {x.flags.map((f) => (
            <FlagTag key={f.words} f={f} />
          ))}
        </span>
      )}
    </span>
  );
}

export function AskCount({ ro }: { ro: RunOut }) {
  const count = countLine(ro);
  if (count === '') return null;
  return (
    <span className="rout-count">
      <Glyph paths={BUBBLE_GLYPH} size={16} />
      <span>{count}</span>
      <NotBuilt />
    </span>
  );
}

function NotBuilt() {
  return <span className="rout-pill">AC, not yet built</span>;
}

function FlagTag({ f }: { f: Flag }) {
  return (
    <span className="rout-flag" data-kind={f.kind === 'diet' ? 'diet' : 'allergy'}>
      <Glyph paths={FLAG_GLYPH} size={14} />
      {f.words}
    </span>
  );
}

function ConfirmDialog({
  ro,
  onCancel,
  onGo,
}: {
  ro: RunOut;
  onCancel: () => void;
  onGo: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useDialogKeys(box, onCancel, false);
  useEffect(() => box.current?.focus(), []);

  if (ro.confirm == null) return null;
  const note = confirmNote(ro, ro.confirm);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog rout-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rout-confirm-title"
        aria-describedby={note !== '' ? 'rout-confirm-note' : undefined}
        tabIndex={-1}
      >
        <h2 id="rout-confirm-title" className="hig-dialog-title">
          {confirmTitle(ro, ro.confirm)}
        </h2>
        {note !== '' && (
          <p id="rout-confirm-note" className="hig-meta">
            {note}
          </p>
        )}
        <ActionPair
          className="dialog-actions"
          dismiss={
            <button className="hig-text-button" type="button" onClick={onCancel}>
              Cancel
            </button>
          }
          confirm={
            <button className="button button-primary" type="button" onClick={onGo}>
              {bulkLabel(ro.confirm)}
            </button>
          }
        />
      </div>
    </>
  );
}

function ChooseDialog({
  ro,
  x,
  onCancel,
  onPick,
}: {
  ro: RunOut;
  x: Guest;
  onCancel: () => void;
  onPick: (to: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useDialogKeys(box, onCancel, false);
  useEffect(() => box.current?.focus(), []);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog rout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rout-choose-title"
        tabIndex={-1}
      >
        <div className="rout-choose-head">
          <h2 id="rout-choose-title" className="hig-dialog-title">
            Choose for {x.name}
          </h2>
          <span className="hig-meta">{whereLine(x)}</span>
          {x.flags.length > 0 && (
            <span className="rout-flags">
              {x.flags.map((f) => (
                <FlagTag key={f.words} f={f} />
              ))}
            </span>
          )}
        </div>
        <ul className="rout-options" aria-labelledby="rout-choose-title">
          {options(ro, x).map((o) => (
            <li key={o.label}>
              {o.no == null ? (
                <button className="rout-bulk" type="button" onClick={() => onPick(o.to)}>
                  {o.label}
                </button>
              ) : (
                <div className="rout-not-for">
                  <Glyph paths={BAN_GLYPH} size={18} />
                  <span className="rout-not-for-words">
                    <span className="rout-not-for-item">{o.item}</span>
                    <strong>{o.no.line}</strong>
                    {o.no.note !== '' && <span className="hig-meta">{o.no.note}</span>}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <button className="hig-text-button rout-cancel" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  );
}
