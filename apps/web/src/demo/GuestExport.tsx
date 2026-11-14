import { type RefObject, useEffect, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { Dialog, Note, RowWords } from '../components/SettingsParts.tsx';
import { offButton } from '../offButton.ts';
import {
  type ExportStart,
  type Format,
  type Making,
  type Scope,
  XW,
  columnsFor,
  fileName,
  scopeFor,
} from './guestExport.ts';

const MAKING_MS = 900;

interface Option<Key extends string> {
  key: Key;
  name: string;
  line?: string;
  off?: boolean;
}

/** sc-3784: Export at a desk, one dialog: who's in it, the format, the file and its columns, then the safety note directly above Download. */
export function ExportDialog({
  start,
  event,
  day,
  inView,
  everyone,
  narrowing,
  needs,
  onClose,
  onReady,
}: {
  start: ExportStart;
  event: string;
  day: string;
  inView: number;
  everyone: number;
  narrowing: string;
  needs: boolean;
  onClose: () => void;
  onReady: (file: string) => void;
}) {
  const [asked, setAsked] = useState<Scope>(start.scope ?? 'view');
  const [format, setFormat] = useState<Format>(start.format ?? 'xlsx');
  const [making, setMaking] = useState<Making>(start.making ?? 'ready');
  const first = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const scope = scopeFor(asked, inView);
  const file = fileName(event, day, format);
  const busy = making === 'preparing';

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function download(): void {
    if (busy) return;
    setMaking('preparing');
    timer.current = window.setTimeout(() => onReady(file), MAKING_MS);
  }

  return (
    <Dialog
      title={XW.title}
      verb={null}
      locked={busy}
      first={first}
      onDismiss={onClose}
      onConfirm={download}
    >
      {making === 'failed' && (
        <p className="gs-x-failed" role="alert">
          <Glyph name="alert" size={18} weight={2.2} />
          {XW.failed}
        </p>
      )}
      <Radios
        legend={XW.who}
        options={[
          {
            key: 'view',
            name: XW.thisView(inView),
            line: inView === 0 ? XW.nothingInView : narrowing,
            off: inView === 0,
          },
          { key: 'all', name: XW.allGuests(everyone) },
        ]}
        picked={scope}
        first={first}
        className="gs-x-who"
        onPick={setAsked}
      />
      <Radios
        legend={XW.format}
        options={[
          { key: 'xlsx', name: XW.excel },
          { key: 'csv', name: XW.csv },
        ]}
        picked={format}
        onPick={setFormat}
      />
      <section className="gs-x-file" aria-label={XW.file}>
        <p className="gs-x-name">
          <Glyph name="page" size={18} weight={2.2} />
          <span>{file}</span>
        </p>
        <p className="desk-line is-small">{XW.columns}</p>
        <ul className="gs-x-columns">
          {columnsFor(needs).map((column) => (
            <li key={column}>{column}</li>
          ))}
        </ul>
      </section>
      {!needs && <Note>{XW.noNeeds}</Note>}
      <div className="gs-x-foot">
        <p className="desk-line is-small">{XW.safety}</p>
        <button
          type="button"
          className="gs-pill is-primary is-tall gs-x-go"
          aria-busy={busy || undefined}
          {...offButton(busy, { dim: false })}
          onClick={download}
        >
          {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
          {busy ? XW.preparing : XW.download}
        </button>
      </div>
    </Dialog>
  );
}

function Radios<Key extends string>({
  legend,
  options,
  picked,
  first,
  className,
  onPick,
}: {
  legend: string;
  options: readonly Option<Key>[];
  picked: Key;
  first?: RefObject<HTMLInputElement | null>;
  className?: string;
  onPick: (key: Key) => void;
}) {
  const name = useId();

  return (
    <fieldset className={className == null ? 'desk-choices' : `desk-choices ${className}`}>
      <legend className="desk-legend">{legend}</legend>
      <ul className="desk-rows">
        {options.map((option) => {
          const on = option.key === picked;
          const classes = ['desk-row', on && 'is-picked', option.off === true && 'gs-x-off'];

          return (
            <li key={option.key}>
              <label className={classes.filter(Boolean).join(' ')}>
                <RowWords title={option.name} lines={option.line == null ? [] : [option.line]} />
                <input
                  ref={on ? first : undefined}
                  type="radio"
                  className="desk-radio"
                  name={name}
                  checked={on}
                  disabled={option.off}
                  onChange={() => onPick(option.key)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
