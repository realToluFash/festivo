import {
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LayersContext } from '../layers.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { Ask, Chevron, Head, RowWords, TextAction } from './SettingsParts.tsx';
import './eventPage.css';

/** The page's way back: Events, then the event's name as where you are once it has loaded. */
export function Crumb({
  to,
  back,
  name,
  children,
}: {
  to: string;
  back: string;
  name: string | null;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="ev-crumb-row">
      <nav className="ev-crumb" aria-label={t('eventPage.crumb')}>
        <ol>
          <li className="ev-crumb-part">
            <Link to={to}>{back}</Link>
          </li>
          {name != null && (
            <li className="ev-crumb-part" aria-current="page">
              <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
              <span className="ev-crumb-name">{name}</span>
            </li>
          )}
        </ol>
      </nav>
      {children}
    </div>
  );
}

export function Lead({ name }: { name: GlyphName }) {
  return (
    <span className="ev-lead" aria-hidden="true">
      <Glyph name={name} size={22} weight={2} />
    </span>
  );
}

/** A part of the event as a row: its value over its label; at a desk it opens in place under it. */
export function PartRow({
  lead,
  title,
  line,
  open,
  locked = false,
  after,
  onOpen,
  children,
}: {
  lead: ReactNode;
  title: string;
  line: string;
  open: boolean;
  locked?: boolean;
  after?: ReactNode;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const was = useRef(open);
  const closed = useRef(false);
  const { stack } = useContext(LayersContext);

  useEffect(() => {
    if (was.current && !open) closed.current = true;
    was.current = open;
    if (!closed.current || stack.length > 0) return;

    closed.current = false;
    if (document.activeElement == null || document.activeElement === document.body)
      button.current?.focus();
  }, [open, stack.length]);

  return (
    <li className="ev-part">
      {locked ? (
        <div className="desk-row ev-detail is-locked">
          {lead}
          <RowWords title={title} lines={[line]} />
        </div>
      ) : (
        <button
          ref={button}
          type="button"
          className={open ? 'desk-row ev-detail is-lit' : 'desk-row ev-detail'}
          aria-expanded={open}
          onClick={onOpen}
        >
          {lead}
          <RowWords title={title} lines={[line]} />
          <Chevron />
        </button>
      )}
      {!open && after}
      {open && children}
    </li>
  );
}

/** An edit open in place at a desk: under a 2 px Violet rule, the part's fields, then Cancel and Save, Save in Ink 3 until something changes. */
export function Opened({
  label,
  changed,
  verb,
  asking: first = null,
  refused = false,
  busy = false,
  onLatest,
  onCancel,
  onSave,
  children,
}: {
  label: string;
  changed: boolean;
  verb?: string;
  asking?: 'discard' | 'latest' | null;
  refused?: boolean;
  busy?: boolean;
  onLatest?: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(first);
  const cancel = () => {
    if (busy) return;
    if (changed) setAsking('discard');
    else onCancel();
  };
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = box.current;

    if (node == null || asking != null) return;

    const keys = (event: KeyboardEvent) => {
      const open = event.target instanceof HTMLElement && event.target.ariaExpanded === 'true';

      if (event.key !== 'Escape' || event.defaultPrevented || open || busy) return;
      event.preventDefault();
      event.stopPropagation();
      if (changed) setAsking('discard');
      else onCancel();
    };

    node.addEventListener('keydown', keys);

    return () => node.removeEventListener('keydown', keys);
  }, [asking, busy, changed, onCancel]);

  return (
    <div className="ev-opened" role="group" aria-label={label} ref={box}>
      {refused && (
        <Broken
          action={
            <TextAction label={t('eventEdit.showLatest')} onClick={() => setAsking('latest')} />
          }
        >
          {t('eventEdit.changedElsewhere')}
        </Broken>
      )}
      {children}
      <div className="ev-opened-actions">
        <TextAction label={t('eventEdit.cancel')} onClick={cancel} />
        <button
          type="button"
          className={changed ? 'desk-text' : 'desk-text is-off'}
          aria-disabled={!changed}
          aria-busy={busy}
          onClick={() => {
            if (changed && !busy) onSave();
          }}
        >
          {verb ?? t('eventPage.save')}
        </button>
      </div>
      {asking === 'discard' && (
        <Ask
          title={t('eventPage.discardTitle')}
          line={t('eventPage.discardLine')}
          keep={t('eventEdit.keepEditing')}
          go={t('eventPage.discard')}
          onKeep={() => setAsking(null)}
          onGo={() => {
            setAsking(null);
            onCancel();
          }}
        />
      )}
      {asking === 'latest' && (
        <Ask
          title={t('eventEdit.showLatestTitle')}
          line={t('eventEdit.showLatestBody')}
          keep={t('eventEdit.keepEditing')}
          go={t('eventEdit.showLatest')}
          onKeep={() => setAsking(null)}
          onGo={() => {
            setAsking(null);
            onLatest?.();
          }}
        />
      )}
    </div>
  );
}

export interface Wall {
  date: string;
  time: string;
}

/** A date and a time in the event's zone, one label for the two. */
export function DateTime({
  legend,
  wall,
  wrong = false,
  told,
  onChange,
}: {
  legend: string;
  wall: Wall;
  wrong?: boolean;
  told?: string | undefined;
  onChange: (wall: Wall) => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <fieldset className="ev-when">
      <legend className="desk-label">{legend}</legend>
      <div className="ev-when-pair">
        <label htmlFor={`${id}-date`} className="desk-unseen">
          {`${legend}, ${t('eventForm.date')}`}
        </label>
        <input
          id={`${id}-date`}
          type="date"
          className={wrong ? 'ev-input is-wrong' : 'ev-input'}
          value={wall.date}
          aria-invalid={wrong}
          aria-describedby={told}
          onChange={(event) => onChange({ ...wall, date: event.target.value })}
        />
        <label htmlFor={`${id}-time`} className="desk-unseen">
          {`${legend}, ${t('eventForm.time')}`}
        </label>
        <input
          id={`${id}-time`}
          type="time"
          className={wrong ? 'ev-input is-time is-wrong' : 'ev-input is-time'}
          value={wall.time}
          aria-invalid={wrong}
          aria-describedby={told}
          onChange={(event) => onChange({ ...wall, time: event.target.value })}
        />
      </div>
    </fieldset>
  );
}

/** One line of text in an edit: its label, Optional where it is, its help, and what is wrong with it. */
export function EditText({
  label,
  optional = false,
  value,
  help,
  error,
  inputRef,
  maxLength,
  onChange,
  input,
}: {
  label: string;
  optional?: boolean;
  value: string;
  help?: string | null;
  error?: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
  maxLength?: number;
  onChange: (value: string) => void;
  input?: Partial<InputHTMLAttributes<HTMLInputElement>>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
        {optional && <span className="ev-optional">{` · ${t('eventForm.optional')}`}</span>}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
          {...input}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

export function Radios<T extends string>({
  legend,
  choices,
  picked,
  onPick,
}: {
  legend: string;
  choices: readonly (readonly [T, string])[];
  picked: T;
  onPick: (one: T) => void;
}) {
  const name = useId();

  return (
    <fieldset className="desk-choices">
      <legend className="desk-unseen">{legend}</legend>
      <ul className="desk-rows">
        {choices.map(([one, words]) => (
          <li key={one}>
            <label
              className={one === picked ? 'desk-row ev-choice is-picked' : 'desk-row ev-choice'}
            >
              <RowWords title={words} />
              <input
                type="radio"
                className="desk-radio"
                name={name}
                checked={one === picked}
                onChange={() => onPick(one)}
              />
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Manage: each step that changes the whole event, its button over what it does. */
export function ManageList({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();

  return (
    <section className="desk-block" aria-labelledby={id}>
      <Head title={<span id={id}>{title}</span>} />
      <ul className="ev-manage">{children}</ul>
    </section>
  );
}

/** `button` takes the class and the line's id, so the step is read with what it does. */
export function ManageItem({
  line,
  red = false,
  children,
}: {
  line: string;
  red?: boolean;
  children: (look: { className: string; describedBy: string }) => ReactNode;
}) {
  const id = useId();

  return (
    <li className="ev-manage-item">
      {children({ className: red ? 'ev-manage-do is-red' : 'ev-manage-do', describedBy: id })}
      <p id={id} className="desk-note">
        {line}
      </p>
    </li>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="desk-error" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

/** The broken notice, with what to do about it under its words. */
export function Broken({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="notice notice-broken ev-notice" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

export function Quiet({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="notice notice-quiet ev-notice" role="status">
      <span className="mark mark-info" aria-hidden="true">
        i
      </span>
      <div className="notice-body">
        <p className="notice-title">{children}</p>
        {action}
      </div>
    </div>
  );
}
