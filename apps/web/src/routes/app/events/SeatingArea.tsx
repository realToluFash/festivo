import {
  ApiError,
  type MeasurementSystem,
  type OrganisationEvent,
  SEATING_LIMITS,
  SECTION_COLOURS,
  type Seating,
  type SeatingPlan,
  type SectionColour,
  asSeating,
  realtimeTopic,
} from '@soirely/api-client';
import {
  ROOM_MAXIMUM_CM,
  ROOM_MINIMUM_CM,
  leastUsedColour,
  readRoomSide,
  sectionHoldingName,
  listFormat,
} from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { useDeskTop } from '../../../deskTop.ts';
import { config } from '../../../config.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  Ask,
  Card,
  CardStep,
  OnCard,
  Says,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { LayersContext, focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { canOn, useSession } from '../../../session.ts';
import { lengthField, lengthWords } from './seatingUnits.ts';
import '../../../components/SettingsParts.css';
import './seating.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; seating: Seating };

type Panel =
  | { kind: 'start' }
  | { kind: 'room' }
  | { kind: 'sectionAdd' }
  | { kind: 'sectionEdit'; id: string };

type Asking = { kind: 'deletePlan' } | { kind: 'deleteSection'; id: string };

const RETRY_MS = 5_000;
const RENEW_BEFORE_MS = 60_000;
const FIT_PAD = { top: 84, right: 16, bottom: 84, left: 16 } as const;

/** The room as the API holds it, published to every page open on it (sc-3998). */
function useLiveSeating(eventId: string, onSeating: (seating: Seating) => void, onGap: () => void) {
  const latest = useRef({ onSeating, onGap });

  useEffect(() => {
    latest.current = { onSeating, onGap };
  });

  useEffect(() => {
    const hub = config().mercureUrl;
    if (hub === '') return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = async (): Promise<void> => {
      let subscription;
      try {
        subscription = await api.seatingSubscription(eventId);
      } catch {
        if (!stopped) timer = setTimeout(() => void connect(), RETRY_MS);
        return;
      }
      if (stopped) return;

      const url = new URL(hub);
      url.searchParams.append('topic', realtimeTopic('EventSeating', eventId));
      url.searchParams.append('authorization', subscription.token);

      source?.close();
      source = new EventSource(url);
      source.onopen = () => latest.current.onGap();
      source.onmessage = (message: MessageEvent<string>) => {
        let seating: Seating | null = null;
        try {
          seating = asSeating(JSON.parse(message.data));
        } catch {
          seating = null;
        }
        if (seating == null) latest.current.onGap();
        else latest.current.onSeating(seating);
      };
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED || stopped) return;
        clearTimeout(timer);
        timer = setTimeout(() => void connect(), RETRY_MS);
      };

      const lapses = Date.parse(subscription.expiresAt) - Date.now() - RENEW_BEFORE_MS;
      clearTimeout(timer);
      timer = setTimeout(() => void connect(), Math.max(lapses, RETRY_MS));
    };

    void connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [eventId]);
}

function useCanvasSize(): [(node: HTMLDivElement | null) => void, { w: number; h: number }] {
  const [size, setSize] = useState({ w: 718, h: 719 });
  const observer = useRef<ResizeObserver | null>(null);
  const place = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (node == null || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(([entry]) => {
      if (entry == null) return;
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.current.observe(node);
  }, []);

  return [place, size];
}

function fitOf(width: number, height: number, room: { w: number; l: number }) {
  const w = width - FIT_PAD.left - FIT_PAD.right;
  const h = height - FIT_PAD.top - FIT_PAD.bottom;
  const s = Math.max(0.05, Math.min(w / room.w, h / room.l));

  return { s, ox: FIT_PAD.left + (w - room.w * s) / 2, oy: FIT_PAD.top + (h - room.l * s) / 2 };
}

export function SeatingArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  usePageTitle(pageTitle(t, [t('seating.area'), event.name]));

  useEffect(() => {
    let current = true;

    api.seating(event.id).then(
      (seating) => current && setLoad({ kind: 'loaded', seating }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  useLiveSeating(
    event.id,
    (seating) => setLoad({ kind: 'loaded', seating }),
    () => setAttempt((n) => n + 1),
  );

  const crumb = (
    <header className="st-top">
      <nav className="st-crumb" aria-label={t('seating.crumb')}>
        <ol>
          <li>
            <Link to="/app/events">{t('seating.events')}</Link>
          </li>
          <li>
            <Glyph name="chevron" size={14} weight={2.3} />
            <Link to={`/app/events/${encodeURIComponent(event.id)}`}>{event.name}</Link>
          </li>
          <li aria-current="page">
            <Glyph name="chevron" size={14} weight={2.3} />
            <h1 tabIndex={-1}>{t('seating.area')}</h1>
          </li>
        </ol>
      </nav>
      {desk.bell}
    </header>
  );

  if (load.kind === 'loading')
    return (
      <div className="desk st">
        {crumb}
        <div className="st-main">
          <div className="st-canvas" role="status" aria-label={t('seating.loading')} />
          <div className="st-panel is-skeleton" aria-hidden="true">
            {[44, 24, 18, 44, 24, 52, 52, 52, 52].map((h, index) => (
              <span key={index} className={`st-sunk is-${h} n${index}`} />
            ))}
          </div>
        </div>
      </div>
    );

  if (load.kind === 'failed')
    return (
      <div className="desk st">
        {crumb}
        <div className="st-main">
          <div className="st-canvas is-failed">
            <div className="st-failed" role="alert">
              <Glyph name="cloudOff" size={32} weight={1.9} />
              <h2>{t('seating.failed')}</h2>
              <p>{t('seating.failedLine')}</p>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              >
                {t('seating.tryAgain')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="desk st">
      {crumb}
      <Plan
        event={event}
        seating={load.seating}
        onSeating={(seating) => setLoad({ kind: 'loaded', seating })}
        reload={() => setAttempt((n) => n + 1)}
      />
    </div>
  );
}

interface PlanApi {
  event: OrganisationEvent;
  system: MeasurementSystem;
  plan: SeatingPlan | null;
  readOnly: boolean;
  /** Sends one change; a 412 reloads the plan and says who changed it first. Returns the field's refusal, if any. */
  send: (change: () => Promise<Seating>, field?: string) => Promise<string | null>;
  /** True once deleted; otherwise the notice says why, on the panel the ask was opened from. */
  remove: (change: () => Promise<Seating>) => Promise<boolean>;
  adopt: (seating: Seating) => void;
  /** Counts the 412s: a form keyed on it reloads what a colleague saved. */
  reloads: number;
  notice: string | null;
  open: (panel: Panel | null) => void;
  ask: (asking: Asking) => void;
}

function Plan({
  event,
  seating,
  onSeating,
  reload,
}: {
  event: OrganisationEvent;
  seating: Seating;
  onSeating: (seating: Seating) => void;
  reload: () => void;
}) {
  const { t } = useTranslation();
  const { layers, covered, setHost } = useDeskLayers();
  const [panel, setPanel] = useState<Panel | null>(null);
  const opener = useRef<string | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sectionsRefused, setSectionsRefused] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [placeCanvas, size] = useCanvasSize();
  const [start, setStart] = useState({ name: '', width: '', length: '' });
  const plan = seating.plan;
  const system = seating.measurementSystem;
  const readOnly = !canOn(event, 'seating.manage');
  const locale = currentLocale();

  const shownPanel =
    panel?.kind === 'sectionEdit' && !plan?.sections.some((one) => one.id === panel.id)
      ? null
      : plan == null && panel?.kind !== 'start'
        ? null
        : panel;

  const open = (next: Panel | null) => {
    if (next == null) {
      const back = opener.current;

      opener.current = null;
      focusWhenFree(
        () =>
          [...document.querySelectorAll<HTMLElement>('.st-panel button')].find(
            (button) => back != null && nameOf(button) === back,
          ) ?? document.querySelector('.st-top h1'),
      );
    } else {
      if (panel == null && document.activeElement instanceof HTMLElement)
        opener.current = nameOf(document.activeElement);
      focusWhenFree(() => document.querySelector('.st-panel [data-focus="title"]'));
    }
    setPanel(next);
    setNotice(null);
    setSectionsRefused(false);
  };

  const attempt = async (
    change: () => Promise<Seating>,
    field?: string,
  ): Promise<{ saved: boolean; refused: string | null }> => {
    try {
      onSeating(await change());
      setNotice(null);
      return { saved: true, refused: null };
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) {
        const name = error.problem.changedBy;

        setNotice(name == null ? t('seating.notSaved') : t('seating.changedFirst', { name }));
        setReloads((n) => n + 1);
        reload();
        return { saved: false, refused: null };
      }
      if (error instanceof ApiError && error.is('seating_section_limit')) {
        setPanel(null);
        setSectionsRefused(true);
        return { saved: false, refused: null };
      }
      if (error instanceof ApiError && field != null) {
        const refused = error.fieldErrors()[field];

        if (refused != null) return { saved: false, refused };
      }
      setNotice(t('seating.notSaved'));
      return { saved: false, refused: null };
    }
  };

  const send = async (change: () => Promise<Seating>, field?: string) =>
    (await attempt(change, field)).refused;

  const remove = async (change: () => Promise<Seating>) => (await attempt(change)).saved;

  const ctx: PlanApi = {
    event,
    system,
    plan,
    readOnly,
    send,
    remove,
    adopt: onSeating,
    reloads,
    notice,
    open,
    ask: setAsking,
  };

  const lengths = (cm: number, display: 'short' | 'long' = 'short') =>
    lengthWords(t, locale, cm, system, { display });

  let canvas: ReactNode = null;

  if (plan != null) {
    const { s, ox, oy } = fitOf(size.w, size.h, { w: plan.widthCm, l: plan.lengthCm });
    const rw = plan.widthCm * s;
    const rl = plan.lengthCm * s;
    const step = 100 * s;
    const lines: ReactNode[] = [];

    if (step >= 6) {
      for (let i = 1; i < plan.widthCm / 100; i += 1)
        lines.push(
          <line
            key={`x${i}`}
            className={i % 5 === 0 ? 'st-grid is-five' : 'st-grid'}
            x1={ox + i * step}
            y1={oy}
            x2={ox + i * step}
            y2={oy + rl}
          />,
        );
      for (let j = 1; j < plan.lengthCm / 100; j += 1)
        lines.push(
          <line
            key={`y${j}`}
            className={j % 5 === 0 ? 'st-grid is-five' : 'st-grid'}
            x1={ox}
            y1={oy + j * step}
            x2={ox + rw}
            y2={oy + j * step}
          />,
        );
    }
    const words = { width: lengths(plan.widthCm), roomLength: lengths(plan.lengthCm) };
    const empty = plan.counts.tables + plan.counts.rows + plan.counts.singleSeats === 0;

    canvas = (
      <>
        {empty && !readOnly && (
          <div className="st-float st-bar is-tint" role="status" aria-live="polite">
            <Glyph name="info" size={17} weight={2.2} />
            <p>{t('seating.firstItem')}</p>
          </div>
        )}
        <svg
          className="st-room"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          role="group"
          aria-label={
            plan.roomName == null
              ? t('seating.roomGroupUnnamed', {
                  width: lengths(plan.widthCm, 'long'),
                  roomLength: lengths(plan.lengthCm, 'long'),
                })
              : t('seating.roomGroup', {
                  name: plan.roomName,
                  width: lengths(plan.widthCm, 'long'),
                  roomLength: lengths(plan.lengthCm, 'long'),
                })
          }
        >
          <rect className="st-floor" x={ox} y={oy} width={rw} height={rl} />
          {lines}
          <rect className="st-walls" x={ox} y={oy} width={rw} height={rl} />
          <text
            className="st-room-line"
            x={ox}
            y={oy - 14}
            dominantBaseline="central"
            aria-hidden="true"
          >
            {plan.roomName == null
              ? t('seating.roomLineUnnamed', words)
              : t('seating.roomLine', { name: plan.roomName, ...words })}
          </text>
        </svg>
      </>
    );
  } else if (shownPanel?.kind === 'start') {
    const width = readRoomSide(start.width, system, locale);
    const length = readRoomSide(start.length, system, locale);

    if (width.kind === 'cm' && length.kind === 'cm') {
      const { s, ox, oy } = fitOf(size.w, size.h, { w: width.cm, l: length.cm });

      canvas = (
        <svg
          className="st-room"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          aria-hidden="true"
        >
          <rect className="st-floor" x={ox} y={oy} width={width.cm * s} height={length.cm * s} />
          <rect className="st-walls" x={ox} y={oy} width={width.cm * s} height={length.cm * s} />
        </svg>
      );
    } else
      canvas = (
        <div className="st-start-hint">
          <p>{t('seating.startHint')}</p>
        </div>
      );
  }

  if (plan == null && shownPanel?.kind !== 'start')
    return (
      <div className="st-main is-none">
        <div className="st-no-plan">
          <Card size="column">
            <Says>{t('seating.noPlan')}</Says>
            <OnCard>{t('seating.noPlanLine')}</OnCard>
            {!readOnly && (
              <CardStep
                label={t('seating.startPlan')}
                onClick={() => {
                  setStart({ name: '', width: '', length: '' });
                  open({ kind: 'start' });
                }}
              />
            )}
          </Card>
        </div>
      </div>
    );

  let body: ReactNode;

  if (shownPanel?.kind === 'start')
    body = (
      <StartForm
        ctx={ctx}
        draft={start}
        onDraft={setStart}
        onStarted={() => {
          open(null);
        }}
      />
    );
  else if (plan == null) body = null;
  else if (shownPanel?.kind === 'room') body = <RoomSettings key={reloads} ctx={ctx} plan={plan} />;
  else if (shownPanel?.kind === 'sectionAdd')
    body = (
      <>
        <RoomHead ctx={ctx} plan={plan} />
        <SectionForm ctx={ctx} plan={plan} id={null} />
      </>
    );
  else if (shownPanel?.kind === 'sectionEdit')
    body = (
      <SectionForm key={`${shownPanel.id}-${reloads}`} ctx={ctx} plan={plan} id={shownPanel.id} />
    );
  else
    body = (
      <>
        <RoomHead ctx={ctx} plan={plan} />
        {readOnly && <Line>{t('seating.readOnly')}</Line>}
        <SectionsBlock
          ctx={ctx}
          plan={plan}
          refused={sectionsRefused}
          onRefused={() => setSectionsRefused(true)}
        />
      </>
    );

  return (
    <LayersContext value={layers}>
      <div className="st-main" inert={covered}>
        <div className="st-canvas is-plan" ref={placeCanvas}>
          {canvas}
        </div>
        <aside className="st-panel" aria-label={t('seating.panel')}>
          <div className="st-panel-body">{body}</div>
        </aside>
      </div>
      <div ref={setHost} className="desk-layers" />
      {asking != null && plan != null && (
        <AskFor
          ctx={ctx}
          plan={plan}
          asking={asking}
          onDone={() => {
            setAsking(null);
            open(null);
          }}
          onKeep={() => setAsking(null)}
        />
      )}
    </LayersContext>
  );
}

/** A panel's buttons are drawn again as it closes, so the one that opened it is found again by its name. */
function nameOf(element: HTMLElement): string {
  return element.getAttribute('aria-label') ?? element.textContent ?? '';
}

function Line({ children, tone = 'quiet' }: { children: ReactNode; tone?: 'quiet' | 'big' }) {
  return <p className={tone === 'quiet' ? 'st-line' : `st-line is-${tone}`}>{children}</p>;
}

function Said({ children }: { children: ReactNode }) {
  return (
    <p className="st-alert is-amber" role="status">
      <Glyph name="alert" size={15} weight={2.2} />
      <span>{children}</span>
    </p>
  );
}

function Refused({ children }: { children: ReactNode }) {
  return (
    <p className="st-alert is-red" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      <span>{children}</span>
    </p>
  );
}

function BackHead({ title, line, onClose }: { title: string; line?: string; onClose: () => void }) {
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

function Swatch({ colour, size = 20 }: { colour: SectionColour | null; size?: 16 | 20 }) {
  return (
    <span
      className={
        colour == null ? `st-swatch is-none is-${size}` : `st-swatch is-${colour} is-${size}`
      }
      aria-hidden="true"
    />
  );
}

/** A labelled field that applies on Enter or on leaving it (pm, 7 Nov 2026): a refusal is said beside it and nothing is saved. */
function Field({
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

/** Blank, unreadable or out of range, said beside the field in the organisation's units. */
function useRoomSide(system: MeasurementSystem) {
  const { t } = useTranslation();
  const locale = currentLocale();

  return (text: string, side: 'width' | 'length'): { cm: number } | { refused: string } => {
    const read = readRoomSide(text, system, locale);

    if (read.kind === 'cm') return { cm: read.cm };
    if (read.kind === 'blank')
      return { refused: t(side === 'width' ? 'seating.enterWidth' : 'seating.enterLength') };
    return {
      refused: t('seating.roomRange', {
        min: lengthWords(t, locale, ROOM_MINIMUM_CM, system, { grouping: false }),
        max: lengthWords(t, locale, ROOM_MAXIMUM_CM, system, { grouping: false }),
      }),
    };
  };
}

function unitsLine(
  t: ReturnType<typeof useTranslation>['t'],
  event: OrganisationEvent,
  system: MeasurementSystem,
  organisation: string,
): string {
  const venue = event.venue?.name ?? null;
  const city = event.venue?.address?.city ?? null;
  const base = system === 'us' ? 'seating.unitsUs' : 'seating.unitsMetric';

  if (venue == null) return t(base, { organisation });
  if (city == null) return t(`${base}At`, { organisation, venue });
  return t(`${base}AtCity`, { organisation, venue, city });
}

function StartForm({
  ctx,
  draft,
  onDraft,
  onStarted,
}: {
  ctx: PlanApi;
  draft: { name: string; width: string; length: string };
  onDraft: (draft: { name: string; width: string; length: string }) => void;
  onStarted: () => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const side = useRoomSide(ctx.system);
  const [errors, setErrors] = useState<{
    name?: string | undefined;
    width?: string | undefined;
    length?: string | undefined;
  }>({});
  const [failed, setFailed] = useState(false);

  async function begin(): Promise<void> {
    const width = side(draft.width, 'width');
    const length = side(draft.length, 'length');
    const refused = {
      ...('refused' in width ? { width: width.refused } : {}),
      ...('refused' in length ? { length: length.refused } : {}),
    };

    setErrors(refused);
    if ('refused' in width || 'refused' in length) {
      document
        .querySelector<HTMLElement>(
          `[data-focus="${'refused' in width ? 'startWidth' : 'startLength'}"]`,
        )
        ?.focus();
      return;
    }
    const name = draft.name.trim();

    setFailed(false);
    try {
      ctx.adopt(
        await api.startSeatingPlan(ctx.event.id, {
          roomName: name === '' ? null : name,
          widthCm: width.cm,
          lengthCm: length.cm,
        }),
      );
      onStarted();
    } catch (error) {
      const fields = error instanceof ApiError ? error.fieldErrors() : {};

      if (Object.keys(fields).length > 0)
        setErrors({ name: fields.roomName, width: fields.widthCm, length: fields.lengthCm });
      else if (error instanceof ApiError && error.is('seating_plan_exists')) {
        ctx.adopt(await api.seating(ctx.event.id));
        onStarted();
      } else setFailed(true);
    }
  }

  const unit = ctx.system === 'us' ? undefined : 'm';

  return (
    <form
      className="st-stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void begin();
      }}
    >
      <div className="st-title">
        <h2 data-focus="title" tabIndex={-1}>
          {t('seating.startPlan')}
        </h2>
        <p>{unitsLine(t, ctx.event, ctx.system, session.organisation?.name ?? '')}</p>
      </div>
      <StartField
        label={t('seating.roomName')}
        optional
        value={draft.name}
        maxLength={SEATING_LIMITS.roomNameMaximum}
        error={errors.name}
        onChange={(text) => onDraft({ ...draft, name: text })}
        fieldKey="startName"
      />
      <div className="st-two">
        <StartField
          label={t('seating.width')}
          unit={unit}
          value={draft.width}
          error={errors.width}
          onChange={(text) => {
            onDraft({ ...draft, width: text });
            setErrors((now) => ({ ...now, width: undefined }));
          }}
          fieldKey="startWidth"
        />
        <StartField
          label={t('seating.length')}
          unit={unit}
          value={draft.length}
          error={errors.length}
          onChange={(text) => {
            onDraft({ ...draft, length: text });
            setErrors((now) => ({ ...now, length: undefined }));
          }}
          fieldKey="startLength"
        />
      </div>
      {ctx.system === 'us' && <Line>{t('seating.usHint')}</Line>}
      {failed && <Said>{t('seating.notSaved')}</Said>}
      <button type="submit" className="button button-primary st-wide">
        {t('seating.startPlan')}
      </button>
    </form>
  );
}

function StartField({
  label,
  value,
  unit,
  optional = false,
  maxLength,
  error,
  fieldKey,
  onChange,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
  optional?: boolean;
  maxLength?: number;
  error?: string | undefined;
  fieldKey: string;
  onChange: (text: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();

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
          inputMode={optional ? 'text' : 'decimal'}
          value={value}
          maxLength={maxLength}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
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
    </div>
  );
}

function RoomHead({ ctx, plan }: { ctx: PlanApi; plan: SeatingPlan }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const words = {
    width: lengthWords(t, locale, plan.widthCm, ctx.system),
    roomLength: lengthWords(t, locale, plan.lengthCm, ctx.system),
  };

  return (
    <div className="st-block">
      <div className="st-head">
        <h2>{t('seating.room')}</h2>
        {!ctx.readOnly && (
          <TextAction
            label={t('seating.roomSettings')}
            onClick={() => ctx.open({ kind: 'room' })}
          />
        )}
      </div>
      <Line tone="big">
        {plan.roomName == null
          ? t('seating.roomLineUnnamed', words)
          : t('seating.roomLine', { name: plan.roomName, ...words })}
      </Line>
    </div>
  );
}

function RoomSettings({ ctx, plan }: { ctx: PlanApi; plan: SeatingPlan }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const side = useRoomSide(ctx.system);
  const unit = ctx.system === 'us' ? undefined : 'm';

  function resize(key: 'widthCm' | 'lengthCm', text: string): Promise<string | null> | string {
    const read = side(text, key === 'widthCm' ? 'width' : 'length');

    if ('refused' in read) return read.refused;
    return ctx.send(
      () => api.changeSeatingRoom(ctx.event.id, { [key]: read.cm }, plan.version),
      key,
    );
  }

  return (
    <>
      <BackHead
        title={t('seating.roomSettings')}
        line={t('seating.appliesOnLeave')}
        onClose={() => ctx.open(null)}
      />
      {ctx.notice != null && <Said>{ctx.notice}</Said>}
      <Field
        fieldKey="roomName"
        label={t('seating.roomName')}
        optional
        maxLength={SEATING_LIMITS.roomNameMaximum}
        value={plan.roomName ?? ''}
        onCommit={(text) => {
          const name = text.trim();

          return ctx.send(
            () =>
              api.changeSeatingRoom(
                ctx.event.id,
                { roomName: name === '' ? null : name },
                plan.version,
              ),
            'roomName',
          );
        }}
      />
      <div className="st-two">
        <Field
          fieldKey="roomWidth"
          label={t('seating.width')}
          unit={unit}
          inputMode="decimal"
          value={lengthField(t, locale, plan.widthCm, ctx.system)}
          onCommit={(text) => resize('widthCm', text)}
        />
        <Field
          fieldKey="roomLength"
          label={t('seating.length')}
          unit={unit}
          inputMode="decimal"
          value={lengthField(t, locale, plan.lengthCm, ctx.system)}
          onCommit={(text) => resize('lengthCm', text)}
        />
      </div>
      {ctx.system === 'us' && <Line>{t('seating.usHint')}</Line>}
      <div className="st-red">
        <TextAction
          label={t('seating.deletePlan')}
          red
          onClick={() => ctx.ask({ kind: 'deletePlan' })}
        />
        <Line>{t('seating.deletePlanLine')}</Line>
      </div>
    </>
  );
}

function sectionLine(
  t: ReturnType<typeof useTranslation>['t'],
  colour: SectionColour | null,
  tables: number,
  seats: number,
): string {
  return [
    colour == null ? null : t(`seating.colours.${colour}`),
    t('seating.countTables', { count: tables }),
    seats > 0 ? t('seating.countSeats', { count: seats }) : null,
  ]
    .filter((part): part is string => part != null)
    .join(' · ');
}

function SectionsBlock({
  ctx,
  plan,
  refused,
  onRefused,
}: {
  ctx: PlanApi;
  plan: SeatingPlan;
  refused: boolean;
  onRefused: () => void;
}) {
  const { t } = useTranslation();
  const full = plan.sections.length >= SEATING_LIMITS.sectionsMaximum;
  const unsorted = plan.withoutSection.tables > 0 || plan.withoutSection.seats > 0;

  return (
    <section className="st-block" aria-labelledby="st-sections">
      {refused && <Refused>{t('seating.sectionLimit')}</Refused>}
      <div className="st-head">
        <h2 id="st-sections">
          {full
            ? t('seating.sectionsCount', { count: plan.sections.length })
            : t('seating.sections')}
        </h2>
        {!ctx.readOnly && (
          <TextAction
            label={t('seating.addASection')}
            before="plus"
            onClick={() => (full ? onRefused() : ctx.open({ kind: 'sectionAdd' }))}
          />
        )}
      </div>
      {plan.sections.length === 0 && !unsorted ? (
        <Line>{t('seating.noSections')}</Line>
      ) : (
        <ul className="st-rows">
          {plan.sections.map((section) => (
            <li key={section.id} className="st-row">
              <Swatch colour={section.colour} />
              <span className="st-row-words">
                <span className="st-row-name">{section.name}</span>
                <span className="st-row-line">
                  {sectionLine(t, section.colour, section.tables, section.seats)}
                </span>
              </span>
              {!ctx.readOnly && (
                <button
                  type="button"
                  className="desk-text"
                  aria-label={t('seating.editNamed', { name: section.name })}
                  onClick={() => ctx.open({ kind: 'sectionEdit', id: section.id })}
                >
                  {t('seating.edit')}
                </button>
              )}
            </li>
          ))}
          {unsorted && (
            <li className="st-row">
              <Swatch colour={null} />
              <span className="st-row-words">
                <span className="st-row-name">{t('seating.noSection')}</span>
                <span className="st-row-line">
                  {sectionLine(t, null, plan.withoutSection.tables, plan.withoutSection.seats)}
                </span>
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function SectionForm({ ctx, plan, id }: { ctx: PlanApi; plan: SeatingPlan; id: string | null }) {
  const { t } = useTranslation();
  const section = id == null ? null : (plan.sections.find((one) => one.id === id) ?? null);
  const [colour, setColour] = useState<SectionColour>(
    section?.colour ??
      leastUsedColour(
        SECTION_COLOURS,
        plan.sections.map((one) => one.colour),
      ),
  );
  const [addError, setAddError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const group = useId();
  const nameId = useId();

  function refusal(text: string): string | null {
    const name = text.trim();

    if (name === '') return t('seating.sectionBlank');
    if (name.length > SEATING_LIMITS.sectionNameMaximum) return t('seating.sectionLong');
    const holder = sectionHoldingName(plan.sections, name, id);

    return holder == null ? null : t('seating.sectionTaken', { name: holder.name });
  }

  async function add(): Promise<void> {
    const name = typed.trim();
    const refused = refusal(name);

    if (refused != null) {
      setAddError(refused);
      document.querySelector<HTMLElement>('[data-focus="sectionName"]')?.focus();
      return;
    }
    const said = await ctx.send(
      () => api.addSeatingSection(ctx.event.id, { name, colour }),
      'name',
    );

    if (said != null) setAddError(said);
    else ctx.open(null);
  }

  const colours = (
    <fieldset className="st-colours">
      <legend className="st-label">{t('seating.colour')}</legend>
      {SECTION_COLOURS.map((one) => (
        <label key={one} className="st-colour">
          <input
            type="radio"
            name={group}
            checked={(section?.colour ?? colour) === one}
            onChange={() => {
              setColour(one);
              if (section != null)
                void ctx.send(() =>
                  api.changeSeatingSection(
                    ctx.event.id,
                    section.id,
                    { colour: one },
                    section.version,
                  ),
                );
            }}
          />
          <Swatch colour={one} size={16} />
          {t(`seating.colours.${one}`)}
        </label>
      ))}
    </fieldset>
  );

  if (section == null)
    return (
      <>
        <BackHead title={t('seating.addASection')} onClose={() => ctx.open(null)} />
        {ctx.notice != null && <Said>{ctx.notice}</Said>}
        <div className="st-field">
          <label htmlFor={nameId} className="st-label">
            {t('seating.name')}
          </label>
          <div className={addError == null ? 'st-box' : 'st-box is-wrong'}>
            <input
              id={nameId}
              data-focus="sectionName"
              type="text"
              value={typed}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={addError != null}
              aria-describedby={addError == null ? undefined : `${nameId}-error`}
              onChange={(event) => {
                setTyped(event.target.value);
                setAddError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void add();
              }}
            />
          </div>
          {addError != null && (
            <p id={`${nameId}-error`} className="st-field-error">
              <Glyph name="alert" size={15} weight={2.2} />
              <span>{addError}</span>
            </p>
          )}
        </div>
        {colours}
        <div className="st-pair">
          <button type="button" className="button" onClick={() => ctx.open(null)}>
            {t('seating.cancel')}
          </button>
          <button type="button" className="button button-primary" onClick={() => void add()}>
            {t('seating.addSection')}
          </button>
        </div>
      </>
    );

  return (
    <>
      <BackHead title={section.name} onClose={() => ctx.open(null)} />
      <Line>{t('seating.appliesOnLeaveOrPick')}</Line>
      {ctx.notice != null && <Said>{ctx.notice}</Said>}
      <Field
        fieldKey="sectionName"
        label={t('seating.name')}
        value={section.name}
        onCommit={(text) => {
          const refused = refusal(text);

          if (refused != null) return refused;
          return ctx.send(
            () =>
              api.changeSeatingSection(
                ctx.event.id,
                section.id,
                { name: text.trim() },
                section.version,
              ),
            'name',
          );
        }}
      />
      {colours}
      <div className="st-red">
        <TextAction
          label={t('seating.deleteSectionDots')}
          red
          onClick={() => ctx.ask({ kind: 'deleteSection', id: section.id })}
        />
        <Line>{t('seating.sectionStays')}</Line>
      </div>
    </>
  );
}

/** Delete the plan's ask (pm, 8 Nov 2026): what it deletes, sections counted, then who loses a seat; a sentence with nothing to say is left out. */
export function deletePlanWords(
  t: ReturnType<typeof useTranslation>['t'],
  locale: string,
  counts: SeatingPlan['counts'],
): string {
  const parts = [
    counts.sections > 0 ? t('seating.countSections', { count: counts.sections }) : null,
    counts.tables > 0 ? t('seating.countTables', { count: counts.tables }) : null,
    counts.rows > 0 ? t('seating.countRows', { count: counts.rows }) : null,
    counts.singleSeats > 0 ? t('seating.countSingleSeats', { count: counts.singleSeats }) : null,
  ].filter((part): part is string => part != null);
  const guests =
    counts.seatedGuests === 0
      ? t('seating.deletePlanNobody')
      : t('seating.deletePlanSeated', { count: counts.seatedGuests });

  if (parts.length === 0) return guests;
  const listed = listFormat(locale, { style: 'long', type: 'conjunction' }).format(parts);

  return `${t('seating.deletePlanDeletes', { counts: listed })} ${guests}`;
}

function AskFor({
  ctx,
  plan,
  asking,
  onDone,
  onKeep,
}: {
  ctx: PlanApi;
  plan: SeatingPlan;
  asking: Asking;
  onDone: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  if (asking.kind === 'deletePlan')
    return (
      <Ask
        title={t('seating.deletePlanAsk')}
        line={deletePlanWords(t, currentLocale(), plan.counts)}
        keep={t('seating.keepPlan')}
        go={t('seating.deletePlan')}
        busy={busy ? t('seating.deletePlan') : undefined}
        onKeep={onKeep}
        onGo={() => {
          setBusy(true);
          void ctx
            .remove(() => api.deleteSeatingPlan(ctx.event.id))
            .then((deleted) => (deleted ? onDone() : onKeep()));
        }}
      />
    );

  const section = plan.sections.find((one) => one.id === asking.id);

  if (section == null) return null;

  return (
    <Ask
      title={t('seating.deleteNamed', { name: section.name })}
      line={
        section.tables === 0 ? undefined : t('seating.sectionDeleteBody', { count: section.tables })
      }
      keep={t('seating.keepIt')}
      go={t('seating.deleteSection')}
      busy={busy ? t('seating.deleteSection') : undefined}
      onKeep={onKeep}
      onGo={() => {
        setBusy(true);
        void ctx
          .remove(() => api.deleteSeatingSection(ctx.event.id, section.id))
          .then((deleted) => (deleted ? onDone() : onKeep()));
      }}
    />
  );
}
