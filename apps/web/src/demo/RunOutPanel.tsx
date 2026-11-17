import { useEffect, useRef } from 'react';

import { ActionPair } from '../components/ActionPair.tsx';
import { useDialogKeys } from '../dialogFocus.ts';

import { Glyph } from './HowItsGoing.tsx';
import {
  type Access,
  type Bulk,
  type Flag,
  type Guest,
  ITEM,
  MARKED,
  type RunOut,
  askBulk,
  bulkKey,
  bulkLabel,
  bulkRows,
  canChooseAgain,
  cancel,
  changed,
  chooseFor,
  confirmBulk,
  confirmTitle,
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

  return (
    <>
      <div className="ro-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="ro-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ro-title"
        tabIndex={-1}
      >
        <div className="ro-head">
          <div className="ro-head-words">
            <h2 id="ro-title" ref={heading} className="ro-title" tabIndex={-1}>
              <Glyph paths={BAN_GLYPH} size={22} />
              {ITEM} has run out
            </h2>
            <p className="hig-meta">{MARKED}</p>
          </div>
          <button className="ro-close" type="button" aria-label="Close" onClick={close}>
            <Glyph paths={CLOSE_GLYPH} size={20} />
          </button>
        </div>
        <div className="ro-body">
          <div className="ro-strip" role="status">
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

          <section className="ro-part" aria-labelledby="ro-bulk">
            <h3 id="ro-bulk" className="ro-part-title">
              Everyone at once
            </h3>
            <ul className="ro-bulk-list">
              {bulkRows(ro).map((b) => (
                <li key={b.key}>
                  {b.stands ? (
                    <div className="ro-stands">
                      <Glyph paths={ARROW_GLYPH} size={18} />
                      <span className="ro-stands-words">
                        <strong>{b.label}</strong>
                        <span>Applies to guests still to come</span>
                      </span>
                    </div>
                  ) : (
                    <button
                      className="ro-bulk"
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

          <section className="ro-part" aria-labelledby="ro-waiting">
            <h3 id="ro-waiting" className="ro-part-title">
              Waiting for a choice · {rows.length}
            </h3>
            {rows.length === 0 ? (
              <p className="hig-meta">Nobody is waiting for a choice now.</p>
            ) : (
              <ul className="ro-guests">
                {rows.map((x) => (
                  <li key={x.id} className="ro-guest">
                    <GuestWords x={x} />
                    <button
                      className="button ro-choose-for"
                      type="button"
                      data-choose-for={x.id}
                      onClick={() => act(openChoose(ro, x.id, access))}
                    >
                      Choose for {x.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section className="ro-part" aria-labelledby="ro-changed">
              <h3 id="ro-changed" className="ro-part-title">
                Already changed
              </h3>
              <ul className="ro-guests">
                {done.map((x) => (
                  <li key={x.id} className="ro-guest ro-changed">
                    <span className="ro-guest-words">
                      <strong>{x.name}</strong>
                      <span className="hig-meta">{whereLine(x)}</span>
                      <span className="ro-now">
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

          <div className="ro-foot">
            <button className="button" type="button" onClick={() => act(markAvailable(ro, access))}>
              Mark available again
            </button>
          </div>
        </div>
      </div>

      {ro.confirm != null && (
        <ConfirmDialog
          ro={ro}
          onCancel={() => then(cancel(ro), `[data-bulk="${bulkKey(ro.confirm as Bulk)}"]`)}
          onGo={() => then(confirmBulk(ro, access), '#ro-title')}
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
    <span className="ro-guest-words">
      <strong>{x.name}</strong>
      <span className="hig-meta">{whereLine(x)}</span>
      {x.flags.length > 0 && (
        <span className="ro-flags">
          {x.flags.map((f) => (
            <FlagTag key={f.words} f={f} />
          ))}
        </span>
      )}
    </span>
  );
}

function FlagTag({ f }: { f: Flag }) {
  return (
    <span className="ro-flag" data-kind={f.kind === 'diet' ? 'diet' : 'allergy'}>
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

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog ro-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ro-confirm-title"
        tabIndex={-1}
      >
        <h2 id="ro-confirm-title" className="hig-dialog-title">
          {confirmTitle(ro, ro.confirm)}
        </h2>
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
        className="dialog ro-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ro-choose-title"
        tabIndex={-1}
      >
        <div className="ro-choose-head">
          <h2 id="ro-choose-title" className="hig-dialog-title">
            Choose for {x.name}
          </h2>
          <span className="hig-meta">{whereLine(x)}</span>
          {x.flags.length > 0 && (
            <span className="ro-flags">
              {x.flags.map((f) => (
                <FlagTag key={f.words} f={f} />
              ))}
            </span>
          )}
        </div>
        <ul className="ro-options" aria-labelledby="ro-choose-title">
          {options(ro, x).map((o) => (
            <li key={o.label}>
              {o.no == null ? (
                <button className="ro-bulk" type="button" onClick={() => onPick(o.to)}>
                  {o.label}
                </button>
              ) : (
                <div className="ro-not-for">
                  <Glyph paths={BAN_GLYPH} size={18} />
                  <span className="ro-not-for-words">
                    <span className="ro-not-for-item">{o.item}</span>
                    <strong>{o.no.line}</strong>
                    {o.no.note !== '' && <span className="hig-meta">{o.no.note}</span>}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <button className="hig-text-button ro-cancel" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  );
}
