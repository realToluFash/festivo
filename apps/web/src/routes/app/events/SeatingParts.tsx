import {
  type ApiError,
  type MeasurementSystem,
  type OrganisationEvent,
  type Seating,
  type SeatingPlan,
  type SeatingWithTable,
} from '@soirely/api-client';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';

export type Panel =
  | { kind: 'start' }
  | { kind: 'room' }
  | { kind: 'sectionAdd' }
  | { kind: 'sectionEdit'; id: string }
  | { kind: 'table'; id: string; said?: string }
  | { kind: 'chair'; id: string; seat: number };

export type Asking =
  | { kind: 'deletePlan' }
  | { kind: 'deleteSection'; id: string }
  | { kind: 'deleteTable'; id: string };

/** A room size refused because these tables would sit outside it (sc-4000): they are outlined, the new wall dashed. */
export interface Outside {
  ids: string[];
  side: 'width' | 'length';
  cm: number;
}

export interface PlanApi {
  event: OrganisationEvent;
  system: MeasurementSystem;
  plan: SeatingPlan | null;
  readOnly: boolean;
  /** Sends one change; a 412 reloads the plan and says who changed it first. Returns the field's refusal, if any. */
  send: (
    change: () => Promise<Seating | SeatingWithTable>,
    field?: string,
    refusal?: (error: ApiError) => string | null,
  ) => Promise<string | null>;
  /** Adds or copies a table: the one saved, or null with the notice saying why. */
  place: (change: () => Promise<SeatingWithTable>) => Promise<{ id: string; name: string } | null>;
  /** True once deleted; otherwise the notice says why, on the panel the ask was opened from. */
  remove: (change: () => Promise<Seating>) => Promise<boolean>;
  adopt: (seating: Seating) => void;
  /** Counts the 412s: a form keyed on it reloads what a colleague saved. */
  reloads: number;
  notice: string | null;
  open: (panel: Panel | null) => void;
  ask: (asking: Asking) => void;
  showOutside: (outside: Outside | null) => void;
}

export function Line({
  children,
  tone = 'quiet',
}: {
  children: ReactNode;
  tone?: 'quiet' | 'big';
}) {
  return <p className={tone === 'quiet' ? 'st-line' : `st-line is-${tone}`}>{children}</p>;
}

export function Said({ children }: { children: ReactNode }) {
  return (
    <p className="st-alert is-amber" role="status">
      <Glyph name="alert" size={15} weight={2.2} />
      <span>{children}</span>
    </p>
  );
}

export function Refused({ children }: { children: ReactNode }) {
  return (
    <p className="st-alert is-red" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      <span>{children}</span>
    </p>
  );
}

export function BackHead({
  title,
  line,
  onClose,
}: {
  title: string;
  line?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="st-back-head">
      <div className="st-back-row">
        <h2 data-focus="title" tabIndex={-1}>
          {title}
        </h2>
        <button
          type="button"
          className="st-icon-button"
          aria-label={t('seating.close')}
          onClick={onClose}
        >
          <Glyph name="clear" size={19} weight={2.2} />
        </button>
      </div>
      {line != null && <p className="st-line">{line}</p>}
    </div>
  );
}

/** A labelled field that applies on Enter or on leaving it (pm, 7 Nov 2026): a refusal is said beside it and nothing is saved. */
export function Field({
  fieldKey,
  label,
  value,
  unit,
  optional = false,
  hint,
  maxLength,
  inputMode = 'text',
  onCommit,
}: {
  fieldKey: string;
  label: string;
  value: string;
  unit?: string | undefined;
  optional?: boolean;
  hint?: string | undefined;
  maxLength?: number;
  inputMode?: 'text' | 'decimal';
  onCommit: (text: string) => Promise<string | null> | string | null;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);
  const was = useRef(value);

  useEffect(() => {
    if (was.current === value) return;
    was.current = value;
    if (!editing.current) {
      setDraft(value);
      setError(null);
    }
  }, [value]);

  async function commit(): Promise<void> {
    editing.current = false;
    if (draft === value) {
      setError(null);
      return;
    }
    setError(await onCommit(draft));
  }

  function keys(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      editing.current = false;
      setDraft(value);
      setError(null);
    }
  }

  const told = [error != null && `${id}-error`, hint != null && `${id}-hint`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="st-field">
      <label htmlFor={id} className="st-label">
        {label}
        {optional && <span className="st-optional">{t('seating.optional')}</span>}
      </label>
      <div className={error == null ? 'st-box' : 'st-box is-wrong'}>
        <input
          id={id}
          data-focus={fieldKey}
          type="text"
          inputMode={inputMode}
          value={draft}
          maxLength={maxLength}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => {
            editing.current = true;
            setDraft(event.target.value);
          }}
          onBlur={() => void commit()}
          onKeyDown={keys}
        />
        {unit != null && (
          <span className="st-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {error != null && (
        <p id={`${id}-error`} className="st-field-error">
          <Glyph name="alert" size={15} weight={2.2} />
          <span>{error}</span>
        </p>
      )}
      {hint != null && (
        <p id={`${id}-hint`} className="st-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Select({
  fieldKey,
  label,
  value,
  options,
  onPick,
}: {
  fieldKey: string;
  label: string;
  value: string;
  options: readonly { value: string; word: string }[];
  onPick: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="st-field">
      <label htmlFor={id} className="st-label">
        {label}
      </label>
      <div className="st-box is-select">
        <select
          id={id}
          data-focus={fieldKey}
          value={value}
          onChange={(event) => onPick(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.word}
            </option>
          ))}
        </select>
        <Glyph name="chevdown" size={16} weight={2.3} />
      </div>
    </div>
  );
}

export function Added({ children }: { children: ReactNode }) {
  return (
    <p className="st-added" role="status">
      <Glyph name="tick" size={16} weight={2.4} />
      <span>{children}</span>
    </p>
  );
}
