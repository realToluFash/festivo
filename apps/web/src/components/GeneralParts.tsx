import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ActionPair } from './ActionPair.tsx';
import { Glyph } from './Glyph.tsx';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { Head, OnCard, RowWords } from './SettingsParts.tsx';
import './GeneralParts.css';

/** General's card at rest: the organisation's tile, its name, and the line under it. */
export function OrganisationWho({
  tile,
  name,
  line,
}: {
  tile: string;
  name: string;
  line: string | null;
}) {
  return (
    <div className="desk-who">
      <span className="desk-disc general-tile" aria-hidden="true">
        {tile}
      </span>
      <div className="desk-who-words">
        <p className="desk-name">{name}</p>
        <OnCard>{line}</OnCard>
      </div>
    </div>
  );
}

/** Why the card only reads, beside a lock. */
export function CardLock({ line }: { line: string }) {
  return (
    <div className="general-lock">
      <Glyph name="lock" size={16} weight={2.2} />
      <OnCard>{line}</OnCard>
    </div>
  );
}

/** The organisation's details, each its value over its name, and the note on what they set. */
export function DetailsBlock({
  title,
  rows,
  note,
}: {
  title: string;
  rows: readonly { label: string; value: string }[];
  note: string;
}) {
  return (
    <section className="desk-block">
      <Head title={title} />
      <ul className="desk-rows">
        {rows.map((row) => (
          <li key={row.label} className="desk-row is-plain">
            <RowWords title={row.value} lines={[row.label]} />
          </li>
        ))}
      </ul>
      <p className="desk-foot">{note}</p>
    </section>
  );
}

/** B's switch with its On or Off word beside it, so the state is never colour alone. */
export function Switch({
  on,
  label,
  words,
  told,
  busy = false,
  onChange,
}: {
  on: boolean;
  label: string;
  words: { on: string; off: string };
  told?: string;
  busy?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="general-switch"
      aria-checked={on}
      aria-label={label}
      aria-describedby={told}
      aria-busy={busy}
      onClick={() => {
        if (!busy) onChange(!on);
      }}
    >
      <span className="general-track" aria-hidden="true">
        <span className="general-knob" />
      </span>
      <span className="general-word" aria-hidden="true">
        {on ? words.on : words.off}
      </span>
    </button>
  );
}

/** Bones the height of a row, a globe's square at the left of each. */
export function Bones({ count, label }: { count: number; label: string }) {
  return (
    <div className="desk-loading" role="status" aria-label={label}>
      <span className="desk-unseen">{label}</span>
      <ul className="desk-rows general-domains" aria-hidden="true">
        {Array.from({ length: count }, (_, bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk general-globe-bone" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar + 1}`} />
              <span className={`desk-sunk is-line b${bar + 1}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface PickerChoice {
  code: string;
  name: string;
}

export interface PickerProps {
  back: string;
  title: string;
  search: string;
  choices: readonly PickerChoice[];
  value: string;
  locale: string;
  onBack: () => void;
  onChoose: (code: string) => void;
}

/** A field's list over its dialog, in the same 540: the way back, the field's name, search, then the choices. */
export function Picker(props: PickerProps) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<PickerList {...props} />, host);
}

function PickerList({
  back,
  title,
  search,
  choices,
  value,
  locale,
  onBack,
  onChoose,
}: PickerProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const current = useRef<HTMLButtonElement>(null);
  const [needle, setNeedle] = useState('');
  const covered = useDeskDialog(box, searchBox, onBack);
  const wanted = needle.trim().toLocaleLowerCase(locale);
  const shown =
    wanted === ''
      ? choices
      : choices.filter((choice) => choice.name.toLocaleLowerCase(locale).includes(wanted));

  useEffect(() => {
    current.current?.scrollIntoView?.({ block: 'center' });
  }, []);

  return (
    <div
      ref={box}
      className="desk-dialog general-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      inert={covered}
    >
      <ActionPair
        className="desk-nav"
        dismiss={
          <button type="button" className="desk-nav-cancel general-back" onClick={onBack}>
            <Glyph name="back" size={20} weight={2.4} />
            {back}
          </button>
        }
        between={
          <h2 id={`${id}-title`} className="desk-nav-title">
            {title}
          </h2>
        }
        confirm={<span className="general-room" aria-hidden="true" />}
      />
      <div className="general-search">
        <div className="desk-box">
          <Glyph name="search" size={18} weight={2.2} />
          <input
            ref={searchBox}
            type="search"
            value={needle}
            aria-label={search}
            placeholder={search}
            spellCheck={false}
            onChange={(event) => setNeedle(event.target.value)}
          />
        </div>
      </div>
      <div className="desk-dialog-body general-choices">
        <ul className="desk-rows">
          {shown.map((choice) => {
            const on = choice.code === value;

            return (
              <li key={choice.code}>
                <button
                  ref={on ? current : undefined}
                  type="button"
                  className={on ? 'desk-row is-picked' : 'desk-row'}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => onChoose(choice.code)}
                >
                  <RowWords title={choice.name} />
                  {on && <Glyph name="tick" size={18} weight={2.6} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
