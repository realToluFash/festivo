import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import {
  type AskPhase,
  BUSY_MS,
  CODE_ROLES,
  type DoorAsk,
  type DoorCode,
  type DoorStart,
  DOOR_EVENT,
  DOOR_ORG,
  EARLIER_START,
  type Ends,
  HOLD_MS,
  JOIN_MS,
  LABEL_MOST,
  type MakeForm,
  type MakeStart,
  W,
  countLine,
  dayLabel,
  endDays,
  endTimes,
  endsWords,
  eventEndWords,
  formFrom,
  heldLine,
  jobHelp,
  joinCodeSaid,
  joiner,
  madeCode,
  makeLines,
  newLine,
  nextCode,
  printLine,
  printWhen,
  qrPath,
  qrSaid,
  renewed,
  roleLine,
  shownCode,
  stopLine,
} from './doorCode.ts';
import { focusWhenFree, LayersContext, useDeskDialog } from '../layers.ts';
import { type OnEvent, ROLE_LINES } from './people.ts';
import {
  Ask,
  Card,
  Dialog,
  Field,
  Mark,
  RowWords,
  TextAction,
} from '../components/SettingsParts.tsx';
import './doorCode.css';

const STEP = (index: number) => `.dc-card[data-index="${index}"] .desk-step`;

/** The door codes on People: a card each, its actions under it, and what they open (sc-71, sc-72). */
export function DoorArea({
  start,
  onJoin,
  tell,
}: {
  start: DoorStart;
  onJoin: (person: OnEvent) => void;
  tell: (words: string) => void;
}) {
  const [codes, setCodes] = useState(start.codes);
  const [make, setMake] = useState<MakeStart | null>(start.make);
  const [held, setHeld] = useState<number | null>(start.held);
  const [ask, setAsk] = useState<DoorAsk | null>(start.ask);
  const [printing, setPrinting] = useState(0);
  const stopButton = useRef<HTMLButtonElement>(null);
  const joined = useRef(false);

  useEffect(() => {
    if (!start.keyboard) return;
    stopButton.current?.focus({ focusVisible: true } as FocusOptions);
  }, [start.keyboard]);

  // Someone scans it while it is held up: the count goes up within 10 seconds (sc-3906's speed).
  const join = useEffectEvent(() => {
    const [first] = start.codes;
    const [person] = first == null ? [] : joiner(first);
    if (person == null || joined.current) return;
    joined.current = true;
    setCodes((was) =>
      was.map((one, index) => (index === 0 ? { ...one, used: one.used + 1 } : one)),
    );
    onJoin(person);
  });

  useEffect(() => {
    if (!start.joins) return;
    const timer = setTimeout(join, JOIN_MS);

    return () => clearTimeout(timer);
  }, [start.joins]);

  const taken = codes.map((one) => one.code);

  function made(form: MakeForm, into: number | null): void {
    const fresh = madeCode(form, nextCode(taken));
    const at = into ?? codes.length;
    setCodes((was) =>
      into == null ? [...was, fresh] : was.map((one, index) => (index === into ? fresh : one)),
    );
    setMake(null);
    tell(W.made);
    focusWhenFree(() => document.querySelector<HTMLElement>(STEP(at)));
  }

  function settled(done: DoorAsk): void {
    setAsk(null);
    if (done.kind === 'new') {
      setCodes((was) =>
        was.map((one, index) => (index === done.index ? renewed(one, nextCode(taken)) : one)),
      );
      if (!done.held) tell(W.made);
      return;
    }
    setCodes((was) =>
      was.map((one, index) => (index === done.index ? { ...one, state: 'stopped' } : one)),
    );
    setHeld(null);
    focusWhenFree(() => document.querySelector<HTMLElement>(STEP(done.index)));
  }

  function step(code: DoorCode, index: number): void {
    if (code.state === 'working') setHeld(index);
    else if (code.state === 'full')
      setAsk({ kind: 'new', index, phase: 'ask', held: false, failsOnce: false });
    else setMake({ ...MAKE_FRESH, form: formFrom(code), into: index });
  }

  function print(index: number): void {
    flushSync(() => setPrinting(index));
    window.print();
  }

  const heldCode = held == null ? null : codes[held];
  const asked = ask == null ? null : codes[ask.index];

  return (
    <>
      {codes.length === 0 ? (
        <div className="dc-card is-none" data-index="0">
          <Card size="page">
            <div className="dc-none">
              <p className="desk-says">{W.noneSays}</p>
              <p className="desk-on-card">{W.noneLine}</p>
            </div>
            <button type="button" className="desk-step" onClick={() => setMake(MAKE_FRESH)}>
              {W.makeFirst}
              <Glyph name="arrow" size={16} weight={2.4} />
            </button>
          </Card>
        </div>
      ) : (
        <div className="dc-codes">
          {codes.map((code, index) => (
            <div key={code.code} className="dc-code">
              <CodeCard code={code} index={index} onStep={() => step(code, index)} />
              <CodeActions
                code={code}
                stopRef={index === 0 ? stopButton : undefined}
                onPrint={() => print(index)}
                onNew={() =>
                  setAsk({ kind: 'new', index, phase: 'ask', held: false, failsOnce: false })
                }
                onStop={() =>
                  setAsk({ kind: 'stop', index, phase: 'ask', held: false, failsOnce: false })
                }
              />
            </div>
          ))}
          <TextAction label={W.another} before="plus" onClick={() => setMake(MAKE_FRESH)} />
        </div>
      )}
      {make != null && (
        <MakeDialog
          start={make}
          onClose={() => setMake(null)}
          onMade={(form) => made(form, make.into)}
        />
      )}
      {heldCode != null && held != null && (
        <HoldUp
          code={heldCode}
          onClose={() => setHeld(null)}
          onPrint={() => print(held)}
          onNew={() =>
            setAsk({ kind: 'new', index: held, phase: 'ask', held: true, failsOnce: false })
          }
          onStop={() =>
            setAsk({ kind: 'stop', index: held, phase: 'ask', held: true, failsOnce: false })
          }
        />
      )}
      {ask != null && asked != null && (
        <CodeAsk
          key={`${ask.kind}-${ask.index}`}
          ask={ask}
          code={asked}
          onKeep={() => setAsk(null)}
          onDone={settled}
        />
      )}
      {codes[printing] != null &&
        createPortal(
          <div className="dc-print-only">
            <PrintSheet code={codes[printing]} />
          </div>,
          document.body,
        )}
    </>
  );
}

const MAKE_FRESH: MakeStart = {
  form: { role: 'Can view', label: '', cap: '', ends: { kind: 'event' } },
  checked: false,
  phase: 'open',
  failsOnce: false,
  menu: false,
  into: null,
  focus: 'first',
};

const TAGS = {
  full: { kind: 'ended', word: W.full },
  stopped: { kind: 'paused', word: W.stopped },
  ranOut: { kind: 'ended', word: W.ranOut },
} as const;

function CodeCard({ code, index, onStep }: { code: DoorCode; index: number; onStep: () => void }) {
  const tag = code.state === 'working' ? null : TAGS[code.state];

  return (
    <div className="dc-card" data-index={index}>
      <Card size="page">
        <p className="desk-on-card">{roleLine(code)}</p>
        <div className="dc-card-code">
          <p className="dc-code-big">
            <span aria-hidden="true">{shownCode(code.code)}</span>
            <span className="desk-unseen">{joinCodeSaid(code.code)}</span>
          </p>
          {tag != null && (
            <span className="desk-glass">
              <Mark kind={tag.kind} />
              {tag.word}
            </span>
          )}
        </div>
        <p className="desk-on-card">{countLine(code)}</p>
        <button type="button" className="desk-step" onClick={onStep}>
          {code.state === 'working' ? W.hold : W.makeNew}
          <Glyph name="arrow" size={16} weight={2.4} />
        </button>
      </Card>
    </div>
  );
}

/** Under the card: Print first at a desk, then Make a new code, then Stop this code in red; a full code keeps Print and Stop. */
function CodeActions({
  code,
  stopRef,
  onPrint,
  onNew,
  onStop,
}: {
  code: DoorCode;
  stopRef: RefObject<HTMLButtonElement | null> | undefined;
  onPrint: () => void;
  onNew: () => void;
  onStop: () => void;
}) {
  if (code.state === 'stopped' || code.state === 'ranOut') return null;

  return (
    <div className="dc-acts">
      <TextAction label={W.print} onClick={onPrint} />
      {code.state === 'working' && <TextAction label={W.makeNew} onClick={onNew} />}
      <button ref={stopRef} type="button" className="desk-text is-red" onClick={onStop}>
        {W.stop}
      </button>
    </div>
  );
}

function CodeAsk({
  ask,
  code,
  onKeep,
  onDone,
}: {
  ask: DoorAsk;
  code: DoorCode;
  onKeep: () => void;
  onDone: (ask: DoorAsk) => void;
}) {
  const [phase, setPhase] = useState<AskPhase>(ask.phase);
  const fails = useRef(ask.failsOnce);
  const stop = ask.kind === 'stop';
  const arrive = useEffectEvent(() => {
    if (fails.current) {
      fails.current = false;
      setPhase('failed');
      return;
    }
    onDone(ask);
  });

  useEffect(() => {
    if (phase !== 'busy' && phase !== 'held') return;
    const timer = setTimeout(arrive, phase === 'held' ? HOLD_MS : BUSY_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  const waits = phase === 'busy' || phase === 'held';

  return (
    <Ask
      title={stop ? W.stopTitle : W.newTitle}
      line={stop ? stopLine(code) : newLine(code)}
      keep={stop ? W.stopKeep : W.newKeep}
      go={stop ? W.stop : W.makeNew}
      red={stop}
      busy={waits ? (stop ? W.stopping : W.making) : undefined}
      failed={phase === 'failed' && stop ? W.failStop : undefined}
      onKeep={onKeep}
      onGo={() => setPhase('busy')}
    />
  );
}

/** Hold it up at a desk: the whole window white, the QR at 420 and the code at 56; Esc closes it. */
function HoldUp({
  code,
  onClose,
  onPrint,
  onNew,
  onStop,
}: {
  code: DoorCode;
  onClose: () => void;
  onPrint: () => void;
  onNew: () => void;
  onStop: () => void;
}) {
  const { host } = useContext(LayersContext);

  return host == null
    ? null
    : createPortal(
        <HoldBox code={code} onClose={onClose} onPrint={onPrint} onNew={onNew} onStop={onStop} />,
        host,
      );
}

function HoldBox({
  code,
  onClose,
  onPrint,
  onNew,
  onStop,
}: {
  code: DoorCode;
  onClose: () => void;
  onPrint: () => void;
  onNew: () => void;
  onStop: () => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const covered = useDeskDialog(box, closer, onClose);

  // The screen stays awake while it is up; a browser cannot raise the brightness.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    if ('wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((held) => {
          if (gone) void held.release();
          else lock = held;
        })
        .catch(() => undefined);
    }

    return () => {
      gone = true;
      void lock?.release();
    };
  }, []);

  return (
    <div
      ref={box}
      className="dc-hold"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      inert={covered}
    >
      <div className="dc-hold-close">
        <button
          ref={closer}
          type="button"
          className="dc-hold-x"
          aria-label={W.close}
          onClick={onClose}
        >
          <Glyph name="clear" size={22} weight={2.2} />
        </button>
        <kbd className="dc-hold-esc" aria-hidden="true">
          {W.esc}
        </kbd>
      </div>
      <h2 id={`${id}-title`} className="desk-unseen">
        {W.doorCode}
      </h2>
      <div className="dc-hold-body">
        <Qr code={code.code} size={420} />
        <p className="dc-hold-code">
          <span aria-hidden="true">{shownCode(code.code)}</span>
          <span className="desk-unseen">{joinCodeSaid(code.code)}</span>
        </p>
        <p className="dc-hold-role">{heldLine(code)}</p>
        <p className="dc-hold-count" role="status">
          {countLine(code)}
        </p>
      </div>
      <div className="dc-acts is-held">
        <TextAction label={W.print} onClick={onPrint} />
        <TextAction label={W.makeNew} onClick={onNew} />
        <TextAction label={W.stop} red onClick={onStop} />
      </div>
    </div>
  );
}

export function Qr({ code, size, label = true }: { code: string; size: number; label?: boolean }) {
  const { path, size: box } = qrPath(code);

  return (
    <svg
      className="dc-qr"
      role={label ? 'img' : undefined}
      aria-label={label ? qrSaid(code) : undefined}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      shapeRendering="crispEdges"
    >
      <rect className="dc-qr-ground" width={box} height={box} />
      <path className="dc-qr-ink" d={path} />
    </svg>
  );
}

function MakeDialog({
  start,
  onClose,
  onMade,
}: {
  start: MakeStart;
  onClose: () => void;
  onMade: (form: MakeForm) => void;
}) {
  const name = useId();
  const [form, setForm] = useState(start.form);
  const [checked, setChecked] = useState(start.checked);
  const [phase, setPhase] = useState(start.phase);
  const [menu, setMenu] = useState(start.menu);
  const fails = useRef(start.failsOnce);
  const roleRef = useRef<HTMLInputElement>(null);
  const capRef = useRef<HTMLInputElement>(null);
  const endsRef = useRef<HTMLButtonElement>(null);
  const timeRef = useRef<HTMLSelectElement>(null);
  const lines = checked ? makeLines(form) : {};
  const busy = phase === 'busy' || phase === 'held';
  const first = { first: roleRef, cap: capRef, time: timeRef }[start.focus];

  const arrive = useEffectEvent(() => {
    if (fails.current) {
      fails.current = false;
      setPhase('failed');
      return;
    }
    onMade(form);
  });

  useEffect(() => {
    if (phase !== 'busy' && phase !== 'held') return;
    const timer = setTimeout(arrive, phase === 'held' ? HOLD_MS : BUSY_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  function change(now: Partial<MakeForm>): void {
    setForm((was) => ({ ...was, ...now }));
  }

  function makeIt(): void {
    if (busy) return;
    const found = makeLines(form);
    setChecked(true);
    if (found.cap != null) {
      capRef.current?.focus();
      return;
    }
    if (found.ends != null) {
      (form.ends.kind === 'earlier' ? timeRef : endsRef).current?.focus();
      return;
    }
    setPhase('busy');
  }

  return (
    <Dialog
      title={W.doorCode}
      verb={busy ? W.making : W.make}
      locked={busy}
      first={first}
      onDismiss={() => !busy && onClose()}
      onConfirm={makeIt}
    >
      <p className={busy ? 'desk-unseen dc-making' : 'desk-unseen'} role="status">
        {busy ? W.making : ''}
      </p>
      {phase === 'failed' && (
        <p className="desk-error dc-failed" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {W.failMake}
        </p>
      )}
      <fieldset className="desk-choices">
        <legend className="desk-legend">{W.theirRole}</legend>
        <ul className="desk-rows">
          {CODE_ROLES.map((role) => (
            <li key={role}>
              <label className={role === form.role ? 'desk-row is-picked' : 'desk-row'}>
                <RowWords title={role} lines={[ROLE_LINES[role]]} />
                <input
                  ref={role === form.role ? roleRef : undefined}
                  type="radio"
                  className="desk-radio"
                  name={name}
                  checked={role === form.role}
                  onChange={() => change({ role })}
                />
              </label>
            </li>
          ))}
          <li>
            <label className="desk-row is-off">
              <RowWords title={W.canEdit} lines={[W.noEdit]} />
              <input type="radio" className="desk-radio" name={name} checked={false} disabled />
            </label>
          </li>
        </ul>
      </fieldset>
      <Field
        label={W.jobLabel}
        value={form.label}
        help={jobHelp(form.label)}
        autoComplete="off"
        onChange={(value) => change({ label: Array.from(value).slice(0, LABEL_MOST).join('') })}
      />
      <Field
        label={W.howMany}
        value={form.cap}
        inputRef={capRef}
        inputMode="numeric"
        autoComplete="off"
        error={lines.cap ?? null}
        {...(lines.cap == null ? { help: W.howManyHelp } : {})}
        onChange={(value) => change({ cap: value })}
      />
      <EndsChoice
        ends={form.ends}
        open={menu}
        error={lines.ends ?? null}
        buttonRef={endsRef}
        timeRef={timeRef}
        onOpen={() => setMenu(true)}
        onClose={() => setMenu(false)}
        onPick={(ends) => change({ ends })}
      />
    </Dialog>
  );
}

const ENDS_CHOICES = [
  { key: 'event', word: W.whenEventEnds, line: eventEndWords() },
  { key: 'earlier', word: W.earlier, line: W.earlierLine },
] as const;

/** Ends: a row that drops a menu at a desk (the phone's sheet); Earlier adds a Day and a Time, never after the event. */
function EndsChoice({
  ends,
  open,
  error,
  buttonRef,
  timeRef,
  onOpen,
  onClose,
  onPick,
}: {
  ends: Ends;
  open: boolean;
  error: string | null;
  buttonRef: RefObject<HTMLButtonElement | null>;
  timeRef: RefObject<HTMLSelectElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onPick: (ends: Ends) => void;
}) {
  const id = useId();
  const menu = useRef<HTMLUListElement>(null);
  const close = useCallback(
    (back: boolean) => {
      onClose();
      if (back) buttonRef.current?.focus();
    },
    [onClose, buttonRef],
  );

  useEffect(() => {
    if (!open) return;
    const items = () => [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? []),
    ];
    (items().find((item) => item.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open, close, buttonRef]);

  function keys(event: ReactKeyboardEvent): void {
    const all = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = at + (event.key === 'ArrowDown' ? 1 : -1);
      all[(next + all.length) % all.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
    }
  }

  function pick(key: 'event' | 'earlier'): void {
    close(key === 'event');
    if (key === 'event') onPick({ kind: 'event' });
    else {
      onPick(ends.kind === 'earlier' ? ends : EARLIER_START);
      focusWhenFree(() => timeRef.current);
    }
  }

  const days = endDays();
  const earlier = ends.kind === 'earlier' ? ends : null;

  return (
    <div className="dc-ends">
      <div className="dc-ends-at">
        <button
          ref={buttonRef}
          type="button"
          className="desk-row dc-ends-row"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-menu` : undefined}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onClick={() => (open ? close(false) : onOpen())}
        >
          <RowWords title={W.ends} lines={[endsWords(ends)]} />
          <Glyph
            name={open ? 'chevup' : 'chevdown'}
            size={18}
            weight={2.3}
            className="dc-ends-chev"
          />
        </button>
        {open && (
          <ul
            ref={menu}
            id={`${id}-menu`}
            className="desk-menu dc-ends-menu"
            role="menu"
            aria-label={W.ends}
            onKeyDown={keys}
          >
            {ENDS_CHOICES.map((choice) => (
              <li key={choice.key} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={choice.key === ends.kind}
                  tabIndex={-1}
                  className="desk-menu-item dc-ends-item"
                  onClick={() => pick(choice.key)}
                >
                  <span className="desk-menu-tick">
                    {choice.key === ends.kind && <Glyph name="tick" size={16} weight={2.6} />}
                  </span>
                  <span className="dc-ends-words">
                    <span className="dc-ends-word">{choice.word}</span>
                    <span className="dc-ends-line">{choice.line}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {earlier != null && (
        <div className="dc-ends-pair">
          <Choose
            label={W.day}
            value={earlier.day}
            options={days.map((day) => ({ value: day, word: dayLabel(day) }))}
            onChange={(day) => {
              const times = endTimes(day);
              onPick({
                kind: 'earlier',
                day,
                time: times.includes(earlier.time) ? earlier.time : (times.at(-1) ?? earlier.time),
              });
            }}
          />
          <Choose
            label={W.time}
            value={earlier.time}
            selectRef={timeRef}
            wrong={error != null}
            options={endTimes(earlier.day).map((time) => ({ value: time, word: time }))}
            onChange={(time) => onPick({ ...earlier, time })}
          />
        </div>
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

function Choose({
  label,
  value,
  options,
  selectRef,
  wrong = false,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; word: string }[];
  selectRef?: RefObject<HTMLSelectElement | null>;
  wrong?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="desk-field dc-choose">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={wrong ? 'desk-box is-wrong' : 'desk-box'}>
        <select
          ref={selectRef}
          id={id}
          className="dc-select"
          value={value}
          aria-invalid={wrong}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.word}
            </option>
          ))}
        </select>
        <Glyph name="chevdown" size={16} weight={2.4} className="dc-select-chev" />
      </div>
    </div>
  );
}

/** Black on white, on a Letter page (A4 alike): the QR at 460 and the code at 72, nothing in colour. */
export function PrintSheet({ code }: { code: DoorCode }) {
  return (
    <article className="dc-sheet" aria-label={`${W.doorCode}, ${DOOR_EVENT}`}>
      <p className="dc-sheet-org">{DOOR_ORG}</p>
      <h1 className="dc-sheet-event">{DOOR_EVENT}</h1>
      <p className="dc-sheet-when">{printWhen()}</p>
      <div className="dc-sheet-qr">
        <Qr code={code.code} size={460} />
      </div>
      <p className="dc-sheet-code">
        <span aria-hidden="true">{shownCode(code.code)}</span>
        <span className="desk-unseen">{joinCodeSaid(code.code)}</span>
      </p>
      <p className="dc-sheet-role">{heldLine(code)}</p>
      <p className="dc-sheet-line">{printLine(code)}</p>
    </article>
  );
}

/** `?print=1`: the page as the printer gets it, with the demo's way back. */
export function PrintPreview({ code }: { code: DoorCode }) {
  return (
    <main id="content" className="desk dc-preview">
      <div className="dc-preview-bar">
        <Link className="desk-text" to="/demo/people?state=code">
          <Glyph name="back" size={17} weight={2.4} />
          {W.backToPeople}
        </Link>
        <TextAction label={W.print} onClick={() => window.print()} />
      </div>
      <PrintSheet code={code} />
    </main>
  );
}
