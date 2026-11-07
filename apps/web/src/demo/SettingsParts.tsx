import {
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { ActionPair } from '../components/ActionPair.tsx';
import { offButton } from '../offButton.ts';
import { Glyph } from './Glyph.tsx';
import { LayersContext, useDeskDialog } from './layers.ts';
import type { MarkKind } from './members.ts';
import type { Tell } from './TodayParts.tsx';

export function Bell({ tell }: { tell: Tell }) {
  return (
    <button
      type="button"
      className="desk-bell"
      aria-label="Notifications, 3 unread"
      onClick={() => tell('Notifications have their own design.')}
    >
      <Glyph name="bell" size={19} />
      <span className="today-unread" aria-hidden="true" />
    </button>
  );
}

/** The page's title, its one header action, and the bell. */
export function TitleRow({
  title,
  action,
  tell,
  bell = true,
  compact = false,
}: {
  title: string;
  action?: ReactNode;
  tell: Tell;
  bell?: boolean;
  compact?: boolean;
}) {
  return (
    <header className={compact ? 'desk-top is-compact' : 'desk-top'}>
      <h1 className="desk-title" tabIndex={-1}>
        {title}
      </h1>
      {action}
      {bell && <Bell tell={tell} />}
    </header>
  );
}

/** ‹ Members or ‹ Roles, where a person or a role opened in the list's place. */
export function BackRow({ to, onBack, tell }: { to: string; onBack: () => void; tell: Tell }) {
  return (
    <div className="desk-top">
      <button type="button" className="desk-back" onClick={onBack}>
        <Glyph name="back" size={17} weight={2.4} />
        {to}
      </button>
      <span className="today-grow" />
      <Bell tell={tell} />
    </div>
  );
}

const PIECES = [1, 2, 3, 4, 5, 6];

/** B's summary card: Confetti, what it says, and its one step at the foot. */
export function Card({
  size = 'page',
  children,
}: {
  size?: 'page' | 'person' | 'column';
  children: ReactNode;
}) {
  return (
    <section className={`desk-card is-${size}`}>
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="desk-card-inner">{children}</div>
    </section>
  );
}

export function Says({ children }: { children: ReactNode }) {
  return <p className="desk-says">{children}</p>;
}

export function OnCard({ children }: { children: ReactNode }) {
  return <p className="desk-on-card">{children}</p>;
}

export function CardStep({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="desk-step" onClick={onClick}>
      {label}
      <Glyph name="arrow" size={16} weight={2.4} />
    </button>
  );
}

export function Avatar({
  initials,
  tone,
  size = 'row',
}: {
  initials: string;
  tone: number;
  size?: 'row' | 'small' | 'face' | 'request';
}) {
  return (
    <span className={`desk-avatar tone${tone % 5} is-${size}`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Mark({ kind }: { kind: MarkKind }) {
  return (
    <span className={`desk-mark is-${kind}`} aria-hidden="true">
      {kind === 'yes' && <Glyph name="tick" size={9} weight={3.4} />}
      {kind === 'paused' && (
        <>
          <span />
          <span />
        </>
      )}
      {kind === 'ended' && <span />}
    </span>
  );
}

export function Tag({ kind, word }: { kind: MarkKind | 'now'; word: string }) {
  return (
    <span className={`desk-tag is-${kind}`}>
      {kind !== 'now' && <Mark kind={kind} />}
      {word}
    </span>
  );
}

export function Head({
  title,
  level = 2,
  children,
}: {
  title: ReactNode;
  level?: 2 | 3;
  children?: ReactNode;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div className="desk-head">
      <Heading>{title}</Heading>
      {children}
    </div>
  );
}

export function RowWords({
  title,
  tag,
  lines = [],
}: {
  title: ReactNode;
  tag?: ReactNode;
  lines?: readonly ReactNode[];
}) {
  return (
    <span className="desk-row-words">
      <span className="desk-row-title">
        <span className="desk-row-name">{title}</span>
        {tag}
      </span>
      {lines.map((line, index) => (
        <span key={index} className="desk-row-line">
          {line}
        </span>
      ))}
    </span>
  );
}

export function Chevron() {
  return <Glyph name="chevron" size={17} weight={2.3} className="desk-chevron" />;
}

export function TextAction({
  label,
  red = false,
  before,
  after,
  onClick,
}: {
  label: string;
  red?: boolean;
  before?: 'plus' | 'copy' | 'tick';
  after?: 'chevron';
  onClick: () => void;
}) {
  return (
    <button type="button" className={red ? 'desk-text is-red' : 'desk-text'} onClick={onClick}>
      {before != null && <Glyph name={before} size={17} weight={2.3} />}
      {label}
      {after === 'chevron' && <Glyph name="chevron" size={16} weight={2.4} />}
    </button>
  );
}

export function RedAction({
  label,
  line,
  onClick,
}: {
  label: string;
  line: string;
  onClick: () => void;
}) {
  return (
    <div className="desk-red">
      <TextAction label={label} red onClick={onClick} />
      <p className="desk-note">{line}</p>
    </div>
  );
}

export function Note({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <p className={strong ? 'desk-line is-ink' : 'desk-line'}>{children}</p>;
}

export function Field({
  label,
  value,
  onChange,
  error,
  help,
  secret = false,
  inputRef,
  autoComplete,
  inputMode,
  placeholder,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  help?: string;
  secret?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoComplete?: string;
  inputMode?: 'email' | 'numeric' | 'text';
  placeholder?: string;
  action?: ReactNode;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      {action == null ? (
        <label htmlFor={id} className="desk-label">
          {label}
        </label>
      ) : (
        <div className="desk-label-row">
          <label htmlFor={id} className="desk-label">
            {label}
          </label>
          {action}
        </div>
      )}
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type={secret && !shown ? 'password' : inputMode === 'email' ? 'email' : 'text'}
          value={value}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        />
        {secret && (
          <button
            type="button"
            className="desk-show"
            aria-pressed={shown}
            onClick={() => setShown((now) => !now)}
          >
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
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

export interface Choice {
  name: string;
  line?: string | null;
  now?: boolean;
}

/** One choice of several, as radio rows: the picked one in Violet, the one held now tagged Now. */
export function Choices({
  legend,
  hideLegend = false,
  choices,
  picked,
  onPick,
  foot,
}: {
  legend: string;
  hideLegend?: boolean;
  choices: readonly Choice[];
  picked: string;
  onPick: (name: string) => void;
  foot?: string;
}) {
  const name = useId();

  return (
    <fieldset className="desk-choices">
      <legend className={hideLegend ? 'desk-unseen' : 'desk-legend'}>{legend}</legend>
      <ul className="desk-rows">
        {choices.map((choice) => (
          <li key={choice.name}>
            <label className={choice.name === picked ? 'desk-row is-picked' : 'desk-row'}>
              <RowWords
                title={choice.name}
                tag={choice.now === true && <Tag kind="now" word="Now" />}
                lines={choice.line == null ? [] : [choice.line]}
              />
              <input
                type="radio"
                className="desk-radio"
                name={name}
                checked={choice.name === picked}
                onChange={() => onPick(choice.name)}
              />
            </label>
          </li>
        ))}
      </ul>
      {foot != null && <p className="desk-foot">{foot}</p>}
    </fieldset>
  );
}

/** A centred 540 dialog over the dimmed desk: Cancel, the title, and the verb, then its body, which scrolls. */
export function Dialog(props: DialogProps) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<DialogBox {...props} />, host);
}

interface DialogProps {
  title: string;
  verb: string;
  /** False for a dialog that applies each pick at once: Done closes it, and nothing sits at its left. */
  cancel?: boolean;
  on?: boolean;
  red?: boolean;
  locked?: boolean;
  first?: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  onConfirm: () => void;
  children: ReactNode;
}

function DialogBox({
  title,
  verb,
  cancel = true,
  on = true,
  red = false,
  locked = false,
  first,
  onDismiss,
  onConfirm,
  children,
}: DialogProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const none = useRef<HTMLElement>(null);
  const covered = useDeskDialog(box, first ?? none, onDismiss, locked);
  const verbClass = ['desk-nav-verb', red && 'is-red', !on && 'is-off'].filter(Boolean).join(' ');

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="desk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        inert={covered}
      >
        <ActionPair
          className="desk-nav"
          dismiss={
            cancel ? (
              <button type="button" className="desk-nav-cancel" onClick={onDismiss}>
                Cancel
              </button>
            ) : (
              <span className="desk-nav-cancel is-none" aria-hidden="true">
                {verb}
              </span>
            )
          }
          between={
            <h2 id={`${id}-title`} className="desk-nav-title">
              {title}
            </h2>
          }
          confirm={
            <button
              type="button"
              className={verbClass}
              {...offButton(!on || locked, { dim: false })}
              onClick={onConfirm}
            >
              {verb}
            </button>
          }
        />
        <div className="desk-dialog-body">{children}</div>
      </div>
    </>
  );
}

interface AskProps {
  title: string;
  line: string;
  keep: string;
  go: string;
  red?: boolean;
  /** The verb's words while its answer is on its way: it turns and is off, and the way back and Escape wait. */
  busy?: string | undefined;
  /** Why the answer did not go, under the body; the verb tries again. */
  failed?: string | undefined;
  /** Where the focus starts, when not on the way back. */
  first?: RefObject<HTMLElement | null> | undefined;
  /** More of the body under the line, which stays its description. */
  children?: ReactNode;
  onKeep: () => void;
  onGo: () => void;
}

/** B's one confirm, 400 wide: the way back first, the verb last and red when it removes. */
export function Ask(props: AskProps) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<AskBox {...props} />, host);
}

function AskBox(props: AskProps) {
  const { title, line, keep, go, red = true, busy, failed, first, children, onKeep, onGo } = props;
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const goButton = useRef<HTMLButtonElement>(null);
  const [onVerb] = useState(busy != null || failed != null);
  const waits = busy != null;
  const said = <p id={`${id}-line`}>{line}</p>;
  const alert = failed != null && <AskAlert>{failed}</AskAlert>;

  useDeskDialog(box, first ?? (onVerb ? goButton : keepButton), onKeep, waits);

  return (
    <>
      <div className="dialog-scrim is-over" aria-hidden="true" />
      <div
        ref={box}
        className="desk-ask"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-line`}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        {children == null ? (
          <>
            {said}
            {alert}
          </>
        ) : (
          <div className="desk-ask-body">
            {said}
            {children}
            {alert}
          </div>
        )}
        <ActionPair
          className="desk-ask-pair"
          dismiss={
            <button
              ref={keepButton}
              type="button"
              className={waits ? 'desk-text is-waits' : 'desk-text'}
              {...offButton(waits, { dim: false })}
              onClick={onKeep}
            >
              {keep}
            </button>
          }
          confirm={
            <button
              ref={goButton}
              type="button"
              className={waits ? 'desk-text is-busy' : red ? 'desk-text is-red' : 'desk-text'}
              aria-busy={waits || undefined}
              {...offButton(waits, { dim: false })}
              onClick={onGo}
            >
              {waits && <span className="desk-turning" aria-hidden="true" />}
              {busy ?? go}
            </button>
          }
        />
      </div>
    </>
  );
}

function AskAlert({ children }: { children: ReactNode }) {
  return (
    <p className="desk-ask-alert" role="alert">
      <Glyph name="alert" size={18} weight={2.2} />
      {children}
    </p>
  );
}

export interface MenuItem {
  key: string;
  word: string;
  count: number;
}

/** A menu that drops from its button, its right edge on the button's: a tick on the one in use. */
export function Menu({
  items,
  picked,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  items: readonly MenuItem[];
  picked: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const opened = useRef(false);

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
        const next = at < 0 ? (step > 0 ? 0 : all.length - 1) : at + step;
        all[(next + all.length) % all.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };

    if (opened.current)
      (items().find((item) => item.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
    opened.current = false;
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, onClose]);

  const word = items.find((item) => item.key === picked);

  return (
    <div className="desk-menu-at">
      <button
        ref={button}
        type="button"
        className="desk-filter"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        id={id}
        onClick={() => {
          if (open) onClose();
          else {
            opened.current = true;
            onOpen();
          }
        }}
      >
        {word?.word} · {word?.count}
        <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
      </button>
      {open && (
        <ul ref={menu} id={`${id}-menu`} className="desk-menu" role="menu" aria-labelledby={id}>
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={item.key === picked}
                tabIndex={-1}
                className="desk-menu-item"
                onClick={() => {
                  onPick(item.key);
                  onClose();
                  button.current?.focus();
                }}
              >
                <span className="desk-menu-tick">
                  {item.key === picked && <Glyph name="tick" size={16} weight={2.6} />}
                </span>
                <span className="today-grow">{item.word}</span>
                <span className="desk-menu-count">{item.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
