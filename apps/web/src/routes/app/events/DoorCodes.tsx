import {
  ApiError,
  DOOR_CODE_ROLES,
  type DoorCodeCard,
  type NewDoorCode,
  type OrganisationEvent,
} from '@soirely/api-client';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  Ask,
  Card,
  Dialog,
  Field,
  Mark,
  RowWords,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree, LayersContext, useDeskDialog } from '../../../layers.ts';
import { useServerNow } from '../../../serverNow.ts';
import {
  BLANK_FORM,
  type CodeClock,
  type Ends,
  LABEL_MOST,
  type MakeForm,
  atWords,
  clockLabel,
  countLine,
  dayLabel,
  earlierStart,
  endDays,
  endTimes,
  endsWords,
  eventEndWords,
  formFrom,
  heldLine,
  makeLines,
  newCode,
  renewal,
  roleLine,
  saidCode,
  shownCode,
} from './doorCodes.ts';
import { clockWords, dayWords } from './staffTimes.ts';
import './doorCodes.css';

/** Shown up, the count is read again this often, so a join shows within 10 seconds (spec §2.3). */
const COUNT_EVERY_MS = 5000;
const STEP = (index: number) => `.dc-card[data-index="${index}"] .desk-step`;

type Make = { form: MakeForm; into: number | null };
type CodeAskOpen = { kind: 'new' | 'stop'; index: number };

/** The door codes on People, as the web demo's People draws them at a desk (sc-72): a card each, what is under it, and what they open. */
export function DoorCodes({
  event,
  organisationName,
  codes,
  onCodes,
  tell,
}: {
  event: OrganisationEvent;
  organisationName: string;
  codes: readonly DoorCodeCard[];
  onCodes: (change: (was: readonly DoorCodeCard[]) => DoorCodeCard[]) => void;
  tell: (words: string) => void;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const clock: CodeClock = {
    endsAt: event.endsAt,
    timeZone: event.timeZone,
    locale: dateLocale(),
    now,
  };
  const [make, setMake] = useState<Make | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [ask, setAsk] = useState<CodeAskOpen | null>(null);
  const [printing, setPrinting] = useState<number | null>(null);
  const replace = useCallback(
    (id: string, card: DoorCodeCard) =>
      onCodes((was) => was.map((one) => (one.id === id ? card : one))),
    [onCodes],
  );

  const shownId = held == null ? null : (codes[held]?.id ?? null);
  useEffect(() => {
    if (shownId == null) return;
    const timer = window.setInterval(() => {
      api.doorCodes(event.id).then(
        (fresh) => {
          const read = fresh.find((one) => one.id === shownId);
          if (read != null) replace(shownId, read);
        },
        () => undefined,
      );
    }, COUNT_EVERY_MS);

    return () => window.clearInterval(timer);
  }, [event.id, shownId, replace]);

  function made(card: DoorCodeCard, into: number | null): void {
    const at = into ?? codes.length;
    onCodes((was) =>
      into == null ? [...was, card] : was.map((one, index) => (index === into ? card : one)),
    );
    setMake(null);
    tell(t('doorCodes.made'));
    focusWhenFree(() => document.querySelector<HTMLElement>(STEP(at)));
  }

  function step(code: DoorCodeCard, index: number): void {
    if (code.status === 'working') setHeld(index);
    else if (code.status === 'full') setAsk({ kind: 'new', index });
    else setMake({ form: formFrom(code, clock), into: index });
  }

  function print(index: number): void {
    flushSync(() => setPrinting(index));
    window.print();
  }

  const heldCode = held == null ? null : codes[held];
  const asked = ask == null ? null : codes[ask.index];
  const printed = printing == null ? null : codes[printing];

  return (
    <>
      {codes.length === 0 ? (
        <div className="dc-card is-none" data-index="0">
          <Card size="page">
            <div className="dc-none-words">
              <p className="desk-says">{t('doorCodes.noneSays')}</p>
              <p className="desk-on-card">{t('doorCodes.noneLine')}</p>
            </div>
            <button
              type="button"
              className="desk-step"
              onClick={() => setMake({ form: BLANK_FORM, into: null })}
            >
              {t('doorCodes.makeFirst')}
              <Glyph name="arrow" size={16} weight={2.4} />
            </button>
          </Card>
        </div>
      ) : (
        <div className="dc-codes">
          {codes.map((code, index) => (
            <div key={code.id} className="dc-code-item">
              <CodeCard code={code} index={index} clock={clock} onStep={() => step(code, index)} />
              <CodeActions
                code={code}
                onPrint={() => print(index)}
                onNew={() => setAsk({ kind: 'new', index })}
                onStop={() => setAsk({ kind: 'stop', index })}
              />
            </div>
          ))}
          <TextAction
            label={t('doorCodes.another')}
            before="plus"
            onClick={() => setMake({ form: BLANK_FORM, into: null })}
          />
        </div>
      )}
      {make != null && (
        <MakeDialog
          eventId={event.id}
          form={make.form}
          replaces={make.into == null ? undefined : codes[make.into]?.id}
          clock={clock}
          onClose={() => setMake(null)}
          onMade={(card) => made(card, make.into)}
        />
      )}
      {heldCode != null && held != null && (
        <ShowCode
          code={heldCode}
          clock={clock}
          onClose={() => setHeld(null)}
          onPrint={() => print(held)}
          onNew={() => setAsk({ kind: 'new', index: held })}
          onStop={() => setAsk({ kind: 'stop', index: held })}
        />
      )}
      {ask != null && asked != null && (
        <CodeAsk
          key={`${ask.kind}-${ask.index}-${asked.id}`}
          eventId={event.id}
          ask={ask}
          code={asked}
          clock={clock}
          onKeep={() => setAsk(null)}
          onRenewed={(fresh) => {
            replace(asked.id, fresh);
            setAsk(null);
            if (held == null) tell(t('doorCodes.made'));
          }}
          onStopped={(stopped) => {
            replace(asked.id, stopped);
            setAsk(null);
            setHeld(null);
            focusWhenFree(() => document.querySelector<HTMLElement>(STEP(ask.index)));
          }}
        />
      )}
      {printed != null &&
        createPortal(
          <div className="dc-print-only">
            <PrintSheet
              code={printed}
              event={event}
              organisationName={organisationName}
              clock={clock}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function CodeCard({
  code,
  index,
  clock,
  onStep,
}: {
  code: DoorCodeCard;
  index: number;
  clock: CodeClock;
  onStep: () => void;
}) {
  const { t } = useTranslation();
  const tag =
    code.status === 'working'
      ? null
      : {
          kind: code.status === 'stopped' ? ('paused' as const) : ('ended' as const),
          word: t(`doorCodes.status.${code.status}`),
        };

  return (
    <div className="dc-card" data-index={index}>
      <Card size="page">
        <p className="desk-on-card">{roleLine(code, t)}</p>
        <div className="dc-card-code">
          <CodeWords code={code.code} className="dc-code-big" />
          {tag != null && (
            <span className="desk-glass">
              <Mark kind={tag.kind} />
              {tag.word}
            </span>
          )}
        </div>
        <p className="desk-on-card">{countLine(code, clock, t)}</p>
        <button type="button" className="desk-step" onClick={onStep}>
          {t(code.status === 'working' ? 'doorCodes.show' : 'doorCodes.makeNew')}
          <Glyph name="arrow" size={16} weight={2.4} />
        </button>
      </Card>
    </div>
  );
}

function CodeWords({ code, className }: { code: string; className: string }) {
  const { t } = useTranslation();

  return (
    <p className={className}>
      <span aria-hidden="true">{shownCode(code)}</span>
      <span className="desk-unseen">{t('doorCodes.said', { code: saidCode(code) })}</span>
    </p>
  );
}

function CodeActions({
  code,
  onPrint,
  onNew,
  onStop,
}: {
  code: DoorCodeCard;
  onPrint: () => void;
  onNew: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  if (code.status === 'stopped' || code.status === 'expired') return null;

  return (
    <div className="dc-acts">
      <TextAction label={t('doorCodes.print')} onClick={onPrint} />
      {code.status === 'working' && <TextAction label={t('doorCodes.makeNew')} onClick={onNew} />}
      <TextAction label={t('doorCodes.stop')} red onClick={onStop} />
    </div>
  );
}

/** Make a new code makes the new one and stops the old in one write, so a failure leaves the old one working. */
function CodeAsk({
  eventId,
  ask,
  code,
  clock,
  onKeep,
  onRenewed,
  onStopped,
}: {
  eventId: string;
  ask: CodeAskOpen;
  code: DoorCodeCard;
  clock: CodeClock;
  onKeep: () => void;
  onRenewed: (fresh: DoorCodeCard) => void;
  onStopped: (stopped: DoorCodeCard) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const going = useRef(false);
  const stop = ask.kind === 'stop';

  async function go(): Promise<void> {
    if (going.current) return;
    going.current = true;
    setBusy(true);
    setFailed(false);

    if (stop) {
      try {
        onStopped(await api.stopDoorCode(eventId, code.id));
      } catch {
        setFailed(true);
      }
    } else {
      try {
        onRenewed(await api.makeDoorCode(eventId, renewal(code, clock)));
      } catch {
        setFailed(true);
      }
    }

    going.current = false;
    setBusy(false);
  }

  return (
    <Ask
      title={t(stop ? 'doorCodes.stopTitle' : 'doorCodes.newTitle')}
      line={
        stop
          ? t('doorCodes.stopLine', { count: code.used })
          : t('doorCodes.newLine', { count: code.used, code: shownCode(code.code) })
      }
      keep={t(stop ? 'doorCodes.stopKeep' : 'doorCodes.newKeep')}
      go={failed ? t('doorCodes.tryAgain') : t(stop ? 'doorCodes.stopGo' : 'doorCodes.makeNew')}
      red={stop}
      busy={busy ? t(stop ? 'doorCodes.stopping' : 'doorCodes.making') : undefined}
      failed={failed ? t(stop ? 'doorCodes.failStop' : 'doorCodes.failMake') : undefined}
      onKeep={onKeep}
      onGo={() => void go()}
    />
  );
}

/** Show the code at a desk: the whole window white, the QR at 420 and the code at 56; Esc closes it. */
function ShowCode(props: {
  code: DoorCodeCard;
  clock: CodeClock;
  onClose: () => void;
  onPrint: () => void;
  onNew: () => void;
  onStop: () => void;
}) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<ShowBox {...props} />, host);
}

function ShowBox({
  code,
  clock,
  onClose,
  onPrint,
  onNew,
  onStop,
}: {
  code: DoorCodeCard;
  clock: CodeClock;
  onClose: () => void;
  onPrint: () => void;
  onNew: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
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
          aria-label={t('doorCodes.close')}
          onClick={onClose}
        >
          <Glyph name="clear" size={22} weight={2.2} />
        </button>
        <kbd className="dc-hold-esc" aria-hidden="true">
          {t('doorCodes.esc')}
        </kbd>
      </div>
      <h2 id={`${id}-title`} className="desk-unseen">
        {t('doorCodes.doorCode')}
      </h2>
      <div className="dc-hold-body">
        <Qr code={code} size={420} />
        <CodeWords code={code.code} className="dc-hold-code" />
        <p className="dc-hold-role">{heldLine(code, t)}</p>
        <p className="dc-hold-count" role="status">
          {countLine(code, clock, t)}
        </p>
      </div>
      <div className="dc-acts is-held">
        <TextAction label={t('doorCodes.print')} onClick={onPrint} />
        <TextAction label={t('doorCodes.makeNew')} onClick={onNew} />
        <TextAction label={t('doorCodes.stop')} red onClick={onStop} />
      </div>
    </div>
  );
}

/** The server draws the QR, so the address in it is the one the API redeems. */
function Qr({ code, size }: { code: DoorCodeCard; size: number }) {
  const { t } = useTranslation();

  return (
    <img
      className="dc-qr"
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(code.qrSvg)}`}
      width={size}
      height={size}
      alt={t('doorCodes.qrSaid', { code: saidCode(code.code) })}
    />
  );
}

function refusal(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) return fallback;
  const { violations, detail, title } = error.problem;

  return violations?.[0]?.message ?? detail ?? title;
}

function MakeDialog({
  eventId,
  form: start,
  replaces,
  clock,
  onClose,
  onMade,
}: {
  eventId: string;
  form: MakeForm;
  replaces: string | undefined;
  clock: CodeClock;
  onClose: () => void;
  onMade: (card: DoorCodeCard) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const [form, setForm] = useState(start);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const roleRef = useRef<HTMLInputElement>(null);
  const capRef = useRef<HTMLInputElement>(null);
  const endsRef = useRef<HTMLButtonElement>(null);
  const timeRef = useRef<HTMLSelectElement>(null);
  const lines = checked ? makeLines(form, clock, t) : {};

  function change(now: Partial<MakeForm>): void {
    setForm((was) => ({ ...was, ...now }));
  }

  async function makeIt(): Promise<void> {
    if (busy) return;
    const found = makeLines(form, clock, t);
    setChecked(true);
    if (found.cap != null) {
      capRef.current?.focus();
      return;
    }
    if (found.ends != null) {
      (form.ends.kind === 'earlier' ? timeRef : endsRef).current?.focus();
      return;
    }
    const sent: NewDoorCode = {
      ...newCode(form, clock),
      ...(replaces == null ? {} : { replaces }),
    };
    setBusy(true);
    setFailed(null);
    try {
      onMade(await api.makeDoorCode(eventId, sent));
    } catch (error) {
      setBusy(false);
      setFailed(refusal(error, t('doorCodes.failMake')));
    }
  }

  return (
    <Dialog
      title={t('doorCodes.doorCode')}
      verb={t(busy ? 'doorCodes.making' : 'doorCodes.make')}
      dismiss={t('eventPeople.cancel')}
      locked={busy}
      first={roleRef}
      onDismiss={() => !busy && onClose()}
      onConfirm={() => void makeIt()}
    >
      <p className={busy ? 'desk-unseen dc-making' : 'desk-unseen'} role="status">
        {busy ? t('doorCodes.making') : ''}
      </p>
      {failed != null && (
        <p className="desk-error dc-failed" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {failed}
        </p>
      )}
      {failed != null && (
        <TextAction label={t('doorCodes.tryAgain')} onClick={() => void makeIt()} />
      )}
      <fieldset className="desk-choices">
        <legend className="desk-legend">{t('doorCodes.theirRole')}</legend>
        <ul className="desk-rows">
          {DOOR_CODE_ROLES.map((role) => (
            <li key={role}>
              <label className={role === form.role ? 'desk-row is-picked' : 'desk-row'}>
                <RowWords
                  title={t(`eventPeople.role.${role}`)}
                  lines={[t(`eventPeople.roleMeans.${role}`)]}
                />
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
              <RowWords title={t('eventPeople.role.can_edit')} lines={[t('doorCodes.noEdit')]} />
              <input type="radio" className="desk-radio" name={name} checked={false} disabled />
            </label>
          </li>
        </ul>
      </fieldset>
      <Field
        label={t('eventPeople.jobLabel')}
        value={form.label}
        help={t('eventPeople.jobHelp', { length: Array.from(form.label).length, most: LABEL_MOST })}
        autoComplete="off"
        onChange={(value) => change({ label: Array.from(value).slice(0, LABEL_MOST).join('') })}
      />
      <Field
        label={t('doorCodes.howMany')}
        value={form.cap}
        inputRef={capRef}
        inputMode="numeric"
        autoComplete="off"
        error={lines.cap ?? null}
        {...(lines.cap == null ? { help: t('doorCodes.howManyHelp') } : {})}
        onChange={(value) => change({ cap: value })}
      />
      <EndsChoice
        ends={form.ends}
        clock={clock}
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

/** Ends: a row that drops a menu at a desk; Earlier adds a Day and a Time, never after the event. */
function EndsChoice({
  ends,
  clock,
  open,
  error,
  buttonRef,
  timeRef,
  onOpen,
  onClose,
  onPick,
}: {
  ends: Ends;
  clock: CodeClock;
  open: boolean;
  error: string | null;
  buttonRef: RefObject<HTMLButtonElement | null>;
  timeRef: RefObject<HTMLSelectElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onPick: (ends: Ends) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const menu = useRef<HTMLUListElement>(null);
  const said = useRef<HTMLParagraphElement>(null);
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

  useEffect(() => {
    if (error != null) said.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

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
      onPick(ends.kind === 'earlier' ? ends : earlierStart(clock));
      focusWhenFree(() => timeRef.current);
    }
  }

  const choices = [
    { key: 'event', word: t('doorCodes.whenEventEnds'), line: eventEndWords(clock, t) },
    { key: 'earlier', word: t('doorCodes.earlier'), line: t('doorCodes.earlierLine') },
  ] as const;
  const earlier = ends.kind === 'earlier' ? ends : null;
  const told = error == null ? undefined : `${id}-error`;

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
          aria-describedby={told}
          onClick={() => (open ? close(false) : onOpen())}
        >
          <RowWords title={t('doorCodes.ends')} lines={[endsWords(ends, clock, t)]} />
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
            aria-label={t('doorCodes.ends')}
            onKeyDown={keys}
          >
            {choices.map((choice) => (
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
            label={t('doorCodes.day')}
            value={earlier.day}
            options={endDays(clock).map((day) => ({ value: day, word: dayLabel(day, clock) }))}
            onChange={(day) => {
              const times = endTimes(day, clock);
              onPick({
                kind: 'earlier',
                day,
                time: times.includes(earlier.time) ? earlier.time : (times.at(-1) ?? earlier.time),
              });
            }}
          />
          <Choose
            label={t('doorCodes.time')}
            value={earlier.time}
            selectRef={timeRef}
            told={told}
            options={endTimes(earlier.day, clock).map((time) => ({
              value: time,
              word: clockLabel(time, clock),
            }))}
            onChange={(time) => onPick({ ...earlier, time })}
          />
        </div>
      )}
      {error != null && (
        <p ref={said} id={`${id}-error`} className="desk-error">
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
  told,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; word: string }[];
  selectRef?: RefObject<HTMLSelectElement | null>;
  told?: string | undefined;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const wrong = told != null;

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
          aria-describedby={told}
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
function PrintSheet({
  code,
  event,
  organisationName,
  clock,
}: {
  code: DoorCodeCard;
  event: OrganisationEvent;
  organisationName: string;
  clock: CodeClock;
}) {
  const { t } = useTranslation();

  return (
    <article className="dc-sheet" aria-label={`${t('doorCodes.doorCode')}, ${event.name}`}>
      <p className="dc-sheet-org">{organisationName}</p>
      <h1 className="dc-sheet-event">{event.name}</h1>
      <p className="dc-sheet-when">{printWhen(event, clock, t)}</p>
      <div className="dc-sheet-qr">
        <Qr code={code} size={460} />
      </div>
      <CodeWords code={code.code} className="dc-sheet-code" />
      <p className="dc-sheet-role">{heldLine(code, t)}</p>
      <p className="dc-sheet-line">
        {t('doorCodes.printLine', {
          address: code.link.replace(/^https?:\/\//u, '').replace(/\/[^/]*$/u, ''),
          until: atWords(code.expiresAt, clock, t),
        })}
      </p>
    </article>
  );
}

function printWhen(event: OrganisationEvent, clock: CodeClock, t: TFunction): string {
  const times = { long: false, timeZone: event.timeZone, locale: clock.locale };
  const venue = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const parts = {
    day: dayWords(event.startsAt, times),
    start: clockWords(event.startsAt, times),
    end: clockWords(event.endsAt, times),
  };

  return venue == null
    ? t('doorCodes.printWhenNoVenue', parts)
    : t('doorCodes.printWhen', { ...parts, venue });
}
