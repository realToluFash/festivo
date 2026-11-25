import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { StatusLine } from './DataControlParts.tsx';
import { Glyph } from './Glyph.tsx';
import { Choices, Dialog, Note } from './SettingsParts.tsx';

export interface MenuChoice {
  key: string;
  word: string;
}

/** A menu button per WAI-ARIA APG: arrows, Home and End move, Escape gives the focus back, a tick on the one in use. */
export function FilterMenu({
  name,
  choices,
  picked,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  name: string;
  choices: readonly MenuChoice[];
  picked: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const into = useRef(false);
  const word = choices.find((one) => one.key === picked)?.word ?? choices[0]?.word ?? '';

  useEffect(() => {
    if (!open) return;

    const items = () => [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? []),
    ];
    const close = (back: boolean) => {
      onClose();
      if (back) button.current?.focus();
    };
    const keys = (event: KeyboardEvent) => {
      const all = items();
      const at = all.indexOf(document.activeElement as HTMLElement);

      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab') close(false);
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        all[(at + step + all.length) % all.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };

    if (into.current)
      (items().find((item) => item.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
    into.current = false;
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, onClose]);

  return (
    <div className="desk-menu-at">
      <button
        ref={button}
        id={id}
        type="button"
        className="desk-filter"
        aria-label={`${name}: ${word}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => {
          if (open) onClose();
          else {
            into.current = true;
            onOpen();
          }
        }}
        onKeyDown={(event) => {
          if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          into.current = true;
          onOpen();
        }}
      >
        {word}
        <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
      </button>
      {open && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          className="desk-menu dc-menu"
          role="menu"
          aria-label={name}
        >
          {choices.map((choice) => (
            <li key={choice.key} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={choice.key === picked}
                tabIndex={-1}
                className="desk-menu-item"
                onClick={() => {
                  onPick(choice.key);
                  onClose();
                  button.current?.focus();
                }}
              >
                <span className="desk-menu-tick">
                  {choice.key === picked && <Glyph name="tick" size={16} weight={2.6} />}
                </span>
                <span className="today-grow">{choice.word}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface DatesWords {
  title: string;
  apply: string;
  from: string;
  to: string;
}

/** The range applies to the list as it changes; one the wrong way round is caught at once, under To. */
export function DatesDialog({
  dates,
  words,
  fault,
  range,
  onChange,
  onCancel,
  onApply,
}: {
  dates: { from: string; to: string };
  words: DatesWords;
  fault: string | null;
  range: string;
  onChange: (dates: { from: string; to: string }) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const from = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      title={words.title}
      verb={words.apply}
      on={fault == null}
      first={from}
      onDismiss={onCancel}
      onConfirm={() => {
        if (fault == null) onApply();
      }}
    >
      <div className="desk-fields">
        <DateField
          label={words.from}
          value={dates.from}
          inputRef={from}
          error={null}
          onChange={(value) => onChange({ ...dates, from: value })}
        />
        <DateField
          label={words.to}
          value={dates.to}
          error={fault}
          onChange={(value) => onChange({ ...dates, to: value })}
        />
      </div>
      <p className="desk-unseen" aria-live="polite">
        {fault == null ? range : ''}
      </p>
    </Dialog>
  );
}

function DateField({
  label,
  value,
  error,
  inputRef,
  onChange,
}: {
  label: string;
  value: string;
  error: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

export interface Fact {
  label: string;
  value: string | readonly string[];
  code?: boolean;
  link?: string;
}

export function EntryDialog({
  title,
  done,
  facts,
  fixed,
  onDone,
}: {
  title: string;
  done: string;
  facts: readonly Fact[];
  fixed: string;
  onDone: () => void;
}) {
  return (
    <Dialog title={title} verb={done} cancel={false} onDismiss={onDone} onConfirm={onDone}>
      <dl className="desk-rows dc-facts">
        {facts.map((fact) => (
          <div key={fact.label} className="desk-row is-plain">
            <dt className="desk-row-line">{fact.label}</dt>
            {(typeof fact.value === 'string' ? [fact.value] : fact.value).map((value) => (
              <dd
                key={value}
                className={fact.code === true ? 'desk-row-name dc-code' : 'desk-row-name'}
              >
                {fact.link == null ? (
                  value
                ) : (
                  <Link className="dc-link" to={fact.link}>
                    {value}
                  </Link>
                )}
              </dd>
            ))}
          </div>
        ))}
      </dl>
      <Note>{fixed}</Note>
    </Dialog>
  );
}

export interface ExportWords {
  title: string;
  export: string;
  format: string;
  line: string;
}

export function ExportDialog<F extends string>({
  words,
  formats,
  refused,
  busy = false,
  onCancel,
  onExport,
}: {
  words: ExportWords;
  formats: readonly { id: F; name: string }[];
  /** Said inside the dialog; one that `stops` leaves Export starting nothing. */
  refused: { words: string; stops: boolean } | null;
  busy?: boolean;
  onCancel: () => void;
  onExport: (format: F) => void;
}) {
  const [format, setFormat] = useState<F | undefined>(formats[0]?.id);
  const on = refused?.stops !== true && !busy;

  return (
    <Dialog
      title={words.title}
      verb={words.export}
      on={on}
      onDismiss={onCancel}
      onConfirm={() => {
        if (on && format != null) onExport(format);
      }}
    >
      <Choices
        legend={words.format}
        hideLegend
        choices={formats}
        picked={format ?? ''}
        onPick={(id) => setFormat(formats.find((one) => one.id === id)?.id)}
      />
      <Note>{words.line}</Note>
      {refused != null && (
        <StatusLine kind="refused" alert>
          {refused.words}
        </StatusLine>
      )}
    </Dialog>
  );
}
