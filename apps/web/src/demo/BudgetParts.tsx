import {
  type ComponentProps,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import {
  Chevron,
  Dialog,
  Head,
  RowWords,
  TextAction,
  type Tell,
} from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type Area, type SampleEvent } from './events.ts';
import { NOW } from './budget.ts';
import { BUDGET_WORDS as W } from './budgetWords.ts';
import './budget.css';

export type CeilingState = 'within' | 'close' | 'overIfAll' | 'over';

/** The desk an event's Budget sits in: its sidebar with the area lit, the crumb and the bell, then the page. */
export function BudgetShell({
  event,
  area = 'budget',
  trail = [],
  told = null,
  without = [],
  children,
}: {
  event: SampleEvent;
  area?: Area;
  without?: readonly Area[];
  trail?: readonly { label: string; to?: string }[];
  told?: string | null;
  children: (tell: Tell) => ReactNode;
}) {
  return (
    <EventsShell
      told={told}
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area={area}
          now={NOW}
          tell={tell}
          inert={covered}
          without={without}
        />
      )}
    >
      {(tell) => (
        <div className="desk-page ev-page bud">
          <div className="ev-wide">
            <div className="ev-crumb-row">
              <nav className="ev-crumb" aria-label={W.crumb}>
                <ol>
                  <li className="ev-crumb-part">
                    <Link to="/demo/events">{W.events}</Link>
                  </li>
                  {[{ label: event.name, to: `/demo/events/${event.id}` }, ...trail].map(
                    (part, index, all) => (
                      <li
                        key={part.label}
                        className="ev-crumb-part"
                        aria-current={index === all.length - 1 ? 'page' : undefined}
                      >
                        <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                        {part.to != null && index < all.length - 1 ? (
                          <Link to={part.to}>
                            <span className="ev-crumb-name">{part.label}</span>
                          </Link>
                        ) : (
                          <span className="ev-crumb-name">{part.label}</span>
                        )}
                      </li>
                    ),
                  )}
                </ol>
              </nav>
              <DemoBell tell={tell} />
            </div>
            {children(tell)}
          </div>
        </div>
      )}
    </EventsShell>
  );
}

export function PageTitle({
  title,
  titleRef,
  children,
}: {
  title: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}) {
  return (
    <div className="bud-title-row">
      <h1 ref={titleRef} className="bud-title" tabIndex={-1}>
        {title}
      </h1>
      {children != null && <div className="bud-title-actions">{children}</div>}
    </div>
  );
}

const PIECES = [1, 2, 3, 4, 5, 6];

/** A's card: the event's Confetti cover under Events A's scrim, its words white on it. */
export function BudgetCard({
  event,
  label,
  children,
}: {
  event: SampleEvent;
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`ev-card today-cover bud-card is-${event.photo ? 'photo' : event.mesh}`}
      aria-label={label}
    >
      <span className="ev-scrim" aria-hidden="true" />
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="ev-card-inner bud-card-inner">{children}</div>
    </section>
  );
}

export function GlassTags({
  tags,
  washed = false,
}: {
  tags: readonly { mark?: ReactNode; word: string }[];
  washed?: boolean;
}) {
  return tags.length === 0 ? null : (
    <ul className={washed ? 'desk-glass-tags is-washed' : 'desk-glass-tags'}>
      {tags.map((tag) => (
        <li key={tag.word} className="desk-glass">
          {tag.mark}
          {tag.word}
        </li>
      ))}
    </ul>
  );
}

export function Figure({ children, flash = false }: { children: ReactNode; flash?: boolean }) {
  return <p className={flash ? 'bud-figure is-washed' : 'bud-figure'}>{children}</p>;
}

export function CardPairs({
  pairs,
  flash = false,
}: {
  pairs: readonly { label: string; figure: string; sub: string }[];
  flash?: boolean;
}) {
  return (
    <dl className={flash ? 'bud-pairs is-washed' : 'bud-pairs'}>
      {pairs.map((pair) => (
        <div key={pair.label} className="bud-pair">
          <dt>{pair.label}</dt>
          <dd className="bud-pair-figure">{pair.figure}</dd>
          <dd className="bud-pair-sub">{pair.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CardStrong({ children }: { children: ReactNode }) {
  return <p className="bud-card-strong">{children}</p>;
}

export function CardLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="bud-card-link" onClick={onClick}>
      {label}
    </button>
  );
}

const RING_CLASS: Record<CeilingState, string> = {
  within: 'is-within',
  close: 'is-close',
  overIfAll: 'is-over-if-all',
  over: 'is-over',
};

export function RingMark({ state, glass = false }: { state: CeilingState; glass?: boolean }) {
  return (
    <span
      className={['bud-ring', RING_CLASS[state], glass && 'is-glass'].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}

export function DashedMark({ glass = false }: { glass?: boolean }) {
  return <span className={glass ? 'bud-dashed is-glass' : 'bud-dashed'} aria-hidden="true" />;
}

export function OpenMark() {
  return <span className="bud-open" aria-hidden="true" />;
}

const STATE_WORDS: Record<CeilingState, string> = {
  within: W.within,
  close: W.close,
  overIfAll: W.overIfAll,
  over: W.over,
};

export function stateWord(state: CeilingState): string {
  return STATE_WORDS[state];
}

export function StateTag({ state }: { state: CeilingState }) {
  return (
    <span className={state === 'within' ? 'bud-tag' : 'bud-tag is-amber'}>
      <RingMark state={state} />
      {STATE_WORDS[state]}
    </span>
  );
}

export function OverdueTag() {
  return (
    <span className="bud-tag is-amber">
      <Glyph name="alert" size={13} weight={2.4} />
      {W.overdue}
    </span>
  );
}

export function MarkWord({ mark, word }: { mark: ReactNode; word: string }) {
  return (
    <span className="bud-mark-word">
      {mark}
      {word}
    </span>
  );
}

export function Amount({ value, line }: { value: string; line?: ReactNode }) {
  return (
    <span className="bud-amount">
      <span className="bud-amount-value">{value}</span>
      {line != null && <span className="bud-amount-line">{line}</span>}
    </span>
  );
}

/** A's one row: a lead, the words, a tag, the end; a button with a chevron when it opens. */
export function BudgetRow({
  title,
  lines = [],
  tag,
  lead,
  end,
  lit = false,
  onOpen,
  to,
  label,
  open,
  washed = false,
}: {
  title: ReactNode;
  lines?: readonly ReactNode[];
  tag?: ReactNode;
  lead?: ReactNode;
  end?: ReactNode;
  lit?: boolean;
  onOpen?: () => void;
  to?: string;
  label?: string;
  open?: boolean;
  washed?: boolean;
}) {
  const inner = (
    <>
      {lead != null && <span className="bud-lead">{lead}</span>}
      <RowWords title={title} tag={tag} lines={lines} />
      {end}
      {(onOpen != null || to != null) && <Chevron />}
    </>
  );
  const className = ['desk-row', 'bud-row', lit && 'is-on', washed && 'is-washed']
    .filter(Boolean)
    .join(' ');

  if (to != null)
    return (
      <Link className={className} to={to} aria-label={label}>
        {inner}
      </Link>
    );
  if (onOpen != null)
    return (
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-expanded={open}
        onClick={onOpen}
      >
        {inner}
      </button>
    );

  return <div className={className}>{inner}</div>;
}

export function Rows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="desk-rows bud-rows" aria-label={label}>
      {children}
    </ul>
  );
}

export function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();

  return (
    <section className="desk-block bud-block" aria-labelledby={id}>
      <Head title={<span id={id}>{title}</span>}>{action}</Head>
      {children}
    </section>
  );
}

export function CategoryHead({ name, tag }: { name: string; tag?: ReactNode }) {
  return (
    <div className="bud-category">
      <h3>{name}</h3>
      {tag}
    </div>
  );
}

export function Columns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="ev-columns">
      <div className="ev-left">{left}</div>
      <div className="ev-right">{right}</div>
    </div>
  );
}

export function Pane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="bud-pane" aria-label={label}>
      {children}
    </section>
  );
}

/** A part opened in place: lit in Tint, 10 past the row, its fields under a 2 px Violet rule. */
export function Opened({ children }: { children: ReactNode }) {
  return (
    <div className="bud-opened">
      <div className="bud-opened-in">{children}</div>
    </div>
  );
}

export function OpenedActions({
  busy = false,
  save = W.save,
  onCancel,
  onSave,
}: {
  busy?: boolean;
  save?: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bud-opened-actions">
      <TextAction label={W.cancel} onClick={onCancel} />
      <button
        type="button"
        className={busy ? 'desk-text is-off' : 'desk-text'}
        aria-disabled={busy}
        onClick={() => {
          if (!busy) onSave();
        }}
      >
        {busy ? W.saving : save}
      </button>
    </div>
  );
}

/** What left and what it changed, with Undo; no timer (WCAG 2.2 2.2.1). */
export function UndoBar({ words, onUndo }: { words: string; onUndo: () => void }) {
  return (
    <div className="bud-undo" role="status">
      <span className="bud-undo-words">{words}</span>
      <button type="button" className="bud-undo-do" onClick={onUndo}>
        <Glyph name="undo" size={16} weight={2.4} />
        {W.undo}
      </button>
    </div>
  );
}

export function NotLiveStrip({ words, onTry }: { words: string; onTry?: () => void }) {
  return (
    <div className="bud-strip" role="status">
      <span className="bud-strip-ring" aria-hidden="true" />
      <span className="bud-strip-words">{words}</span>
      {onTry != null && <TextAction label={W.tryNow} onClick={onTry} />}
    </div>
  );
}

export function LiveLine({ words }: { words: string }) {
  return (
    <p className="bud-live" role="status">
      <span className="bud-live-dot" aria-hidden="true" />
      {words}
    </p>
  );
}

export function AlertInset({ children }: { children: ReactNode }) {
  return (
    <div className="bud-alert" role="alert">
      <Glyph name="alert" size={16} weight={2.3} />
      <p>{children}</p>
    </div>
  );
}

export function InfoLine({ children }: { children: ReactNode }) {
  return (
    <p className="bud-info">
      <Glyph name="info" size={16} weight={2.2} />
      <span>{children}</span>
    </p>
  );
}

export function ReadOnlyLine({ onPlans }: { onPlans?: () => void }) {
  return (
    <div className="bud-plan-line" role="status">
      <p>{W.readOnlyLine}</p>
      {onPlans != null && <TextAction label={W.seePlans} onClick={onPlans} />}
    </div>
  );
}

/** Asked once, in the row: Keep has the focus first. */
export function AskInRow({
  question,
  keep = W.keep,
  go = W.remove,
  onKeep,
  onGo,
}: {
  question: string;
  keep?: string;
  go?: string;
  onKeep: () => void;
  onGo: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => first.current?.focus(), []);

  return (
    <div className="bud-ask" role="group" aria-label={question}>
      <p>{question}</p>
      <button ref={first} type="button" className="desk-text" onClick={onKeep}>
        {keep}
      </button>
      <button type="button" className="desk-text is-red" onClick={onGo}>
        {go}
      </button>
    </div>
  );
}

export type DialogWidth = 540 | 700 | 762 | 800;

/** The product's dialog at the widths the boards give (540 forms; 700, 762 and 800 wider sheets). */
export function BudgetDialog({
  width = 540,
  children,
  ...props
}: ComponentProps<typeof Dialog> & { width?: DialogWidth }) {
  return (
    <Dialog {...props}>
      {width !== 540 && <span className={`bud-width is-${width}`} hidden />}
      {children}
    </Dialog>
  );
}

/** A field with the event's currency before it; the amount is typed in the minor unit. */
export function MoneyField({
  label,
  value,
  onChange,
  symbol = '£',
  unit,
  help,
  error,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  symbol?: string;
  unit?: string;
  help?: ReactNode;
  error?: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const told = [unit == null ? null : `${id}-unit`, help == null ? null : `${id}-help`]
    .concat(error == null ? [] : [`${id}-error`])
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field bud-money">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <span className="bud-symbol" aria-hidden="true">
          {symbol}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit != null && (
          <span id={`${id}-unit`} className="bud-unit">
            {unit}
          </span>
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

export function BudgetLoading({
  words = W.loading,
  card = true,
}: {
  words?: string;
  card?: boolean;
}) {
  return (
    <div className="bud-loading" aria-busy="true">
      {card && <div className="bud-bone is-card" aria-hidden="true" />}
      <p className="desk-line" role="status">
        {words}
      </p>
      {[0, 1, 2, 3].map((one) => (
        <div key={one} className="bud-bone-row" aria-hidden="true">
          <span className={`bud-bone is-line is-${one % 3}`} />
          <span className="bud-bone is-value" />
        </div>
      ))}
    </div>
  );
}
