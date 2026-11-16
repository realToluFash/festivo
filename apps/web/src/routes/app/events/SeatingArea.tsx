import {
  ApiError,
  type MeasurementSystem,
  type OrganisationEvent,
  SEATING_LIMITS,
  SECTION_COLOURS,
  type Seating,
  type SeatingPlan,
  type SeatingSection,
  type SeatingRow,
  type SeatingTable,
  type SectionColour,
  type SectionContents,
  type SingleSeat,
  asSeating,
  realtimeTopic,
} from '@soirely/api-client';
import {
  ROOM_MAXIMUM_CM,
  ROOM_MINIMUM_CM,
  leastUsedColour,
  readRoomSide,
  holdingName,
  isRoundShape,
  listFormat,
  rowExtent,
  visibleLength,
} from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
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
import {
  type Asking,
  BackHead,
  Field,
  Line,
  type Outside,
  type Panel,
  type Placed,
  type PlanApi,
  Refused,
  Said,
} from './SeatingParts.tsx';
import {
  RowDrawing,
  RowPanel,
  SingleSeatDrawing,
  SingleSeatPanel,
  useAddRowAndSeat,
} from './SeatingRows.tsx';
import { AddTable, ChairPanel, TableDrawing, TablePanel } from './SeatingTables.tsx';
import { fitOf, intoView, useCamera } from './seatingCamera.ts';
import { SMALL_MAP_FROM_SCALE, f, percentOf, readingOrder, sectionOf } from './seatingDraw.ts';
import { lengthField, lengthWords } from './seatingUnits.ts';
import '../../../components/SettingsParts.css';
import './seating.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; seating: Seating };

const RETRY_MS = 5_000;
const RENEW_BEFORE_MS = 60_000;
const PAN_FROM_PX = 4;
const WHEEL_ZOOM = 300;

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

const LOADING_ROOM = { w: 2400, l: 1800 } as const;
const LOADING_TABLES = [
  [420, 620],
  [810, 620],
  [1200, 620],
  [1590, 620],
  [1980, 620],
  [420, 1020],
  [810, 1020],
  [1200, 1020],
  [1980, 1020],
] as const;

function LoadingRoom({ label }: { label: string }) {
  const [placeCanvas, size] = useCanvasSize();
  const { s, ox, oy } = fitOf(size.w, size.h, LOADING_ROOM);

  return (
    <div className="st-canvas" ref={placeCanvas} role="status" aria-label={label}>
      <svg
        className="st-room"
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        aria-hidden="true"
      >
        <rect
          className="st-skeleton-room"
          x={f(ox)}
          y={f(oy)}
          width={f(LOADING_ROOM.w * s)}
          height={f(LOADING_ROOM.l * s)}
          rx="4"
        />
        {LOADING_TABLES.map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            className="st-skeleton-block"
            x={f(ox + x * s - 25)}
            y={f(oy + y * s - 25)}
            width="50"
            height="50"
            rx="25"
          />
        ))}
      </svg>
    </div>
  );
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
          <li className="st-crumb-event">
            <Glyph name="chevron" size={14} weight={2.3} />
            <Link to={`/app/events/${encodeURIComponent(event.id)}`}>
              <span className="st-crumb-name">{event.name}</span>
            </Link>
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
          <LoadingRoom label={t('seating.loading')} />
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
  const newest = useRef(seating.plan);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [asking, setAsking] = useState<Asking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sectionsRefused, setSectionsRefused] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [outside, setOutside] = useState<Outside | null>(null);
  const [placeCanvas, size] = useCanvasSize();
  const [start, setStart] = useState({ name: '', width: '', length: '' });
  const plan = seating.plan;
  const system = seating.measurementSystem;
  const readOnly = !canOn(event, 'seating.manage');
  const locale = currentLocale();
  const camera = useCamera(
    event.id,
    plan == null ? null : { w: plan.widthCm, l: plan.lengthCm },
    size,
  );
  const canvasNode = useRef<HTMLDivElement | null>(null);
  const press = useRef<{ from: [number, number]; moved: boolean; pointer: number } | null>(null);
  const panned = useRef(false);

  const gone =
    (panel?.kind === 'sectionEdit' && !plan?.sections.some((one) => one.id === panel.id)) ||
    ((panel?.kind === 'table' || panel?.kind === 'chair') &&
      !plan?.tables.some((one) => one.id === panel.id)) ||
    (panel?.kind === 'row' && !plan?.rows.some((one) => one.id === panel.id)) ||
    (panel?.kind === 'seat' && !plan?.singleSeats.some((one) => one.id === panel.id));
  const shownPanel = gone || (plan == null && panel?.kind !== 'start') ? null : panel;
  const chosenItem =
    shownPanel?.kind === 'table' ||
    shownPanel?.kind === 'chair' ||
    shownPanel?.kind === 'row' ||
    shownPanel?.kind === 'seat'
      ? shownPanel.id
      : null;
  const chosenAttribute =
    shownPanel?.kind === 'table' || shownPanel?.kind === 'chair'
      ? 'data-table'
      : shownPanel?.kind === 'row'
        ? 'data-row'
        : shownPanel?.kind === 'seat'
          ? 'data-seat'
          : null;

  const open = (next: Panel | null) => {
    if (next == null) {
      const back = opener.current;
      const item = chosenAttribute == null ? null : `[${chosenAttribute}="${chosenItem}"]`;

      opener.current = null;
      focusWhenFree(
        () =>
          (item == null ? null : document.querySelector<SVGElement>(`.st-room ${item}`)) ??
          [
            ...document.querySelectorAll<HTMLElement | SVGElement>(
              '.st-panel button, .st-room [role="button"]',
            ),
          ].find((button) => back != null && nameOf(button) === back) ??
          document.querySelector('.st-top h1'),
      );
    } else {
      const active = document.activeElement;

      if (panel == null && (active instanceof HTMLElement || active instanceof SVGElement))
        opener.current = nameOf(active);
      focusWhenFree(() => document.querySelector('.st-panel [data-focus="title"]'));
    }
    setPanel(next);
    setNotice(null);
    setSectionsRefused(false);
    setOutside(null);
  };

  useEffect(() => {
    newest.current = plan;
  }, [plan]);

  const hasRoom = plan != null;
  const { zoomTo, panBy, view } = camera;

  useEffect(() => {
    const node = canvasNode.current;

    if (node == null || !hasRoom) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const box = node.getBoundingClientRect();

        zoomTo(view.current.s * Math.exp(-event.deltaY / WHEEL_ZOOM), [
          event.clientX - box.left,
          event.clientY - box.top,
        ]);
      } else panBy(event.deltaX, event.deltaY);
    };

    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [hasRoom, zoomTo, panBy, view]);

  useEffect(() => {
    const node = canvasNode.current;

    if (node == null || !hasRoom) return;
    let byKey = false;
    const key = (event: KeyboardEvent) => {
      byKey = event.key === 'Tab';
    };
    const point = () => {
      byKey = false;
    };
    const follow = (event: FocusEvent) => {
      const target = event.target;

      if (!byKey || !(target instanceof Element) || target.closest('.st-room') == null) return;
      const box = node.getBoundingClientRect();
      const at = target.getBoundingClientRect();
      const [dx, dy] = intoView(
        {
          x0: at.left - box.left,
          y0: at.top - box.top,
          x1: at.right - box.left,
          y1: at.bottom - box.top,
        },
        view.current.size.w,
        view.current.size.h,
        [...node.querySelectorAll(':scope > .st-float')].map((bar) => {
          const at = bar.getBoundingClientRect();

          return {
            x0: at.left - box.left,
            y0: at.top - box.top,
            x1: at.right - box.left,
            y1: at.bottom - box.top,
          };
        }),
      );

      if (dx !== 0 || dy !== 0) panBy(-dx, -dy);
    };

    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', point, true);
    node.addEventListener('focusin', follow);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', point, true);
      node.removeEventListener('focusin', follow);
    };
  }, [hasRoom, panBy, view]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const now = press.current;

      if (now == null || now.pointer !== event.pointerId) return;
      const dx = event.clientX - now.from[0];
      const dy = event.clientY - now.from[1];

      if (!now.moved && Math.hypot(dx, dy) < PAN_FROM_PX) return;
      now.moved = true;
      now.from = [event.clientX, event.clientY];
      panBy(-dx, -dy);
    };
    const up = (event: PointerEvent) => {
      if (press.current?.pointer !== event.pointerId) return;
      panned.current = event.type === 'pointerup' && press.current.moved;
      press.current = null;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [panBy]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || chosenAttribute == null || covered) return;
      event.preventDefault();
      open(null);
    };

    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  });

  const attempt = <A,>(
    change: () => Promise<A>,
    seatingOf: (answer: A) => Seating,
    field?: string,
    refusal?: (error: ApiError) => string | null,
  ): Promise<{ answer: A } | { refused: string | null }> => {
    const turn = queue.current.then(() => attemptNow(change, seatingOf, field, refusal));

    queue.current = turn;
    return turn;
  };

  const attemptNow = async <A,>(
    change: () => Promise<A>,
    seatingOf: (answer: A) => Seating,
    field?: string,
    refusal?: (error: ApiError) => string | null,
  ): Promise<{ answer: A } | { refused: string | null }> => {
    try {
      const answer = await change();
      const now = seatingOf(answer);

      newest.current = now.plan;
      onSeating(now);
      setNotice(null);
      return { answer };
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) {
        const name = error.problem.changedBy;

        setNotice(name == null ? t('seating.notSaved') : t(changedKey(panel), { name }));
        setReloads((n) => n + 1);
        reload();
        return { refused: null };
      }
      if (error instanceof ApiError && error.is('seating_section_limit')) {
        setPanel(null);
        setSectionsRefused(true);
        return { refused: null };
      }
      const said = error instanceof ApiError ? (refusal?.(error) ?? null) : null;

      if (said != null) return { refused: said };
      if (error instanceof ApiError && field != null) {
        const refused = error.fieldErrors()[field];

        if (refused != null) return { refused };
      }
      setNotice(t('seating.notSaved'));
      return { refused: null };
    }
  };

  const seatingOf = (answer: Seating | Placed): Seating =>
    'seating' in answer ? answer.seating : answer;

  const send: PlanApi['send'] = async (change, field, refusal) => {
    const result = await attempt(change, seatingOf, field, refusal);

    return 'answer' in result ? null : result.refused;
  };

  const place: PlanApi['place'] = async (change) => {
    const result = await attempt(change, (answer) => answer.seating);

    return 'answer' in result ? placedIn(result.answer) : null;
  };

  const remove = async (change: () => Promise<Seating>) =>
    'answer' in (await attempt(change, (answer) => answer));

  const newestOf: PlanApi['newest'] = <
    T extends SeatingPlan | SeatingSection | SeatingTable | SeatingRow | SingleSeat,
  >(
    item: T,
  ) =>
    [
      ...(newest.current == null ? [] : [newest.current]),
      ...(newest.current?.sections ?? []),
      ...(newest.current?.tables ?? []),
      ...(newest.current?.rows ?? []),
      ...(newest.current?.singleSeats ?? []),
    ].find((one): one is T => one.id === item.id) ?? item;

  const ctx: PlanApi = {
    event,
    system,
    plan,
    readOnly,
    send,
    newest: newestOf,
    place,
    remove,
    adopt: onSeating,
    reloads,
    notice,
    open,
    ask: setAsking,
    showOutside: setOutside,
  };
  const { addRow, addSeat } = useAddRowAndSeat(ctx);

  const lengths = (cm: number, display: 'short' | 'long' = 'short') =>
    lengthWords(t, locale, cm, system, { display });

  let canvas: ReactNode = null;

  if (plan != null) {
    const { s, ox, oy } = camera;
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
          onPointerDown={(event) => {
            panned.current = false;
            if (event.button !== 0 || !isFloor(event.target)) return;
            press.current = {
              from: [event.clientX, event.clientY],
              moved: false,
              pointer: event.pointerId,
            };
          }}
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
          <rect
            className="st-floor"
            x={ox}
            y={oy}
            width={rw}
            height={rl}
            onClick={() => {
              if (panned.current) panned.current = false;
              else if (chosenAttribute != null) open(null);
            }}
          />
          {lines}
          <rect className="st-walls" x={ox} y={oy} width={rw} height={rl} />
          {outside != null &&
            (outside.side === 'width' ? (
              <line
                className="st-new-wall"
                x1={ox + outside.cm * s}
                y1={oy}
                x2={ox + outside.cm * s}
                y2={oy + rl}
              />
            ) : (
              <line
                className="st-new-wall"
                x1={ox}
                y1={oy + outside.cm * s}
                x2={ox + rw}
                y2={oy + outside.cm * s}
              />
            ))}
          {readingOrder([
            ...plan.tables.map((one) => ({
              kind: 'table' as const,
              one,
              xCm: one.xCm,
              yCm: one.yCm,
            })),
            ...plan.rows.map((one) => ({ kind: 'row' as const, one, xCm: one.xCm, yCm: one.yCm })),
            ...plan.singleSeats.map((one) => ({
              kind: 'seat' as const,
              one,
              xCm: one.xCm,
              yCm: one.yCm,
            })),
          ]).map(({ kind, one }) =>
            kind === 'table' ? (
              <TableDrawing
                key={one.id}
                plan={plan}
                table={one}
                s={s}
                ox={ox}
                oy={oy}
                chosen={chosenItem === one.id}
                chosenSeat={
                  shownPanel?.kind === 'chair' && shownPanel.id === one.id ? shownPanel.seat : null
                }
                outside={outside?.ids.includes(one.id) ?? false}
                onChoose={() => open({ kind: 'table', id: one.id })}
                onChair={(seat) => open({ kind: 'chair', id: one.id, seat })}
              />
            ) : kind === 'row' ? (
              <RowDrawing
                key={one.id}
                plan={plan}
                row={one}
                s={s}
                ox={ox}
                oy={oy}
                chosen={chosenItem === one.id}
                chosenSeat={
                  shownPanel?.kind === 'row' && shownPanel.id === one.id
                    ? (shownPanel.seat ?? null)
                    : null
                }
                outside={outside?.ids.includes(one.id) ?? false}
                onChoose={() => open({ kind: 'row', id: one.id })}
                onChair={(seat) => open({ kind: 'row', id: one.id, seat })}
              />
            ) : (
              <SingleSeatDrawing
                key={one.id}
                plan={plan}
                seat={one}
                s={s}
                ox={ox}
                oy={oy}
                chosen={chosenItem === one.id}
                outside={outside?.ids.includes(one.id) ?? false}
                onChoose={() => open({ kind: 'seat', id: one.id })}
              />
            ),
          )}
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
        {!readOnly && <AddTable ctx={ctx} floor={size.w} onRow={addRow} onSeat={addSeat} />}
        <ZoomControls camera={camera} />
        {s >= SMALL_MAP_FROM_SCALE - 1e-9 && (
          <SmallMap plan={plan} view={{ x: -ox / s, y: -oy / s, w: size.w / s, h: size.h / s }} />
        )}
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
  else if (shownPanel?.kind === 'table' || shownPanel?.kind === 'chair') {
    const table = plan.tables.find((one) => one.id === shownPanel.id);

    body =
      table == null ? null : shownPanel.kind === 'table' ? (
        <TablePanel
          key={`${table.id}-${reloads}`}
          ctx={ctx}
          plan={plan}
          table={table}
          said={shownPanel.said}
        />
      ) : (
        <ChairPanel ctx={ctx} plan={plan} table={table} seat={shownPanel.seat} />
      );
  } else if (shownPanel?.kind === 'row') {
    const row = plan.rows.find((one) => one.id === shownPanel.id);

    body =
      row == null ? null : (
        <RowPanel
          key={`${row.id}-${reloads}`}
          ctx={ctx}
          plan={plan}
          row={row}
          said={shownPanel.said}
          seat={shownPanel.seat ?? null}
        />
      );
  } else if (shownPanel?.kind === 'seat') {
    const seat = plan.singleSeats.find((one) => one.id === shownPanel.id);

    body =
      seat == null ? null : (
        <SingleSeatPanel
          key={`${seat.id}-${reloads}`}
          ctx={ctx}
          plan={plan}
          seat={seat}
          said={shownPanel.said}
        />
      );
  } else
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
        <div
          className="st-canvas is-plan"
          ref={(node) => {
            canvasNode.current = node;
            placeCanvas(node);
          }}
        >
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

function isFloor(target: EventTarget): boolean {
  return (
    target instanceof SVGElement &&
    ['st-room', 'st-floor', 'st-grid', 'st-walls'].some((name) => target.classList.contains(name))
  );
}

/** +, − and Fit the room: the steps stop at 25% and 400%, and a button at its limit stays in the Tab order. */
function ZoomControls({ camera }: { camera: ReturnType<typeof useCamera> }) {
  const { t } = useTranslation();
  const pct = percentOf(camera.s);

  return (
    <div
      className="st-float st-zoom"
      role="group"
      aria-label={t('seating.zoomIs', { share: pct / 100 })}
    >
      <button
        type="button"
        className="st-round-button"
        aria-label={t('seating.zoomOut')}
        aria-disabled={camera.atSmallest}
        onClick={() => {
          if (!camera.atSmallest) camera.step(-1);
        }}
      >
        <Glyph name="minus" size={19} weight={2.2} />
      </button>
      <span className="st-pct" role="status">
        {t('seating.percent', { share: pct / 100 })}
      </span>
      <button
        type="button"
        className="st-round-button"
        aria-label={t('seating.zoomIn')}
        aria-disabled={camera.atLargest}
        onClick={() => {
          if (!camera.atLargest) camera.step(1);
        }}
      >
        <Glyph name="plus" size={19} weight={2.2} />
      </button>
      <button type="button" className="st-tool" onClick={camera.fitRoom}>
        <Glyph name="fit" size={18} weight={2.2} />
        {t('seating.fit')}
      </button>
    </div>
  );
}

const SMALL_MAP_WIDTH = 160;
const SMALL_MAP_SEAT_CM = 44;

/** From 200%, the whole room small at the bottom right, with the part on screen as a rectangle. */
function SmallMap({
  plan,
  view,
}: {
  plan: SeatingPlan;
  view: { x: number; y: number; w: number; h: number };
}) {
  const s = SMALL_MAP_WIDTH / plan.widthCm;
  const h = Math.round(plan.lengthCm * s);
  const shape = (
    item: { id: string; sectionId: string | null; xCm: number; yCm: number; rotation: number },
    w: number,
    l: number,
    round: boolean,
  ) => {
    const section = sectionOf(plan, item);
    const className = section == null ? 'st-body is-out' : `st-body is-out is-${section.colour}`;
    const x = item.xCm * s;
    const y = item.yCm * s;

    return round ? (
      <circle
        key={item.id}
        className={className}
        cx={f(x)}
        cy={f(y)}
        r={f(Math.max(1.5, (w / 2) * s))}
      />
    ) : (
      <g key={item.id} transform={`translate(${f(x)} ${f(y)}) rotate(${item.rotation})`}>
        <rect
          className={className}
          x={f((-w / 2) * s)}
          y={f((-l / 2) * s)}
          width={f(w * s)}
          height={f(Math.max(1.5, l * s))}
        />
      </g>
    );
  };

  return (
    <div className="st-float st-minimap" aria-hidden="true">
      <svg
        className="st-small-map"
        width={SMALL_MAP_WIDTH}
        height={h}
        viewBox={`0 0 ${SMALL_MAP_WIDTH} ${h}`}
        focusable="false"
      >
        <rect className="st-floor" width={SMALL_MAP_WIDTH} height={h} />
        {plan.tables.map((one) => shape(one, one.widthCm, one.lengthCm, isRoundShape(one.shape)))}
        {plan.rows.map((one) => {
          const [ex, ey] = rowExtent(one);

          return shape(one, 2 * ex, 2 * ey, false);
        })}
        {plan.singleSeats.map((one) =>
          shape({ ...one, rotation: 0 }, SMALL_MAP_SEAT_CM, SMALL_MAP_SEAT_CM, true),
        )}
        <rect
          className="st-walls is-thin"
          x="0.75"
          y="0.75"
          width={SMALL_MAP_WIDTH - 1.5}
          height={h - 1.5}
        />
        <rect
          className="st-view-box"
          x={f(view.x * s)}
          y={f(view.y * s)}
          width={f(view.w * s)}
          height={f(view.h * s)}
        />
      </svg>
    </div>
  );
}

/** Who changed it first, said of what the panel shows. */
function changedKey(panel: Panel | null): string {
  if (panel?.kind === 'table' || panel?.kind === 'chair') return 'seating.changedTable';
  if (panel?.kind === 'row') return 'seating.changedRow';
  if (panel?.kind === 'seat') return 'seating.changedSeat';
  return 'seating.changedFirst';
}

function placedIn(answer: Placed): { id: string; name: string; seats: number } | null {
  const plan = answer.seating.plan;

  if ('tableId' in answer) {
    const table = plan?.tables.find((one) => one.id === answer.tableId);

    return table == null ? null : { id: table.id, name: table.name, seats: table.seats };
  }
  if ('rowId' in answer) {
    const row = plan?.rows.find((one) => one.id === answer.rowId);

    return row == null ? null : { id: row.id, name: row.label, seats: row.seats };
  }
  const seat = plan?.singleSeats.find((one) => one.id === answer.seatId);

  return seat == null ? null : { id: seat.id, name: seat.name, seats: 1 };
}

/** A panel's buttons are drawn again as it closes, so the one that opened it is found again by its name. */
function nameOf(element: Element): string {
  return element.getAttribute('aria-label') ?? element.textContent ?? '';
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
        min: lengthWords(t, locale, ROOM_MINIMUM_CM, system, { grouping: false, rounding: 'up' }),
        max: lengthWords(t, locale, ROOM_MAXIMUM_CM, system, { grouping: false, rounding: 'down' }),
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
  error,
  fieldKey,
  onChange,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
  optional?: boolean;
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
    ctx.showOutside(null);
    return ctx.send(
      () => api.changeSeatingRoom(ctx.event.id, { [key]: read.cm }, ctx.newest(plan).version),
      key,
      (error) => {
        if (!error.is('seating_items_outside')) return null;
        const ids = error.problem.outside ?? [];
        const width = key === 'widthCm' ? read.cm : plan.widthCm;
        const length = key === 'lengthCm' ? read.cm : plan.lengthCm;

        ctx.showOutside({ ids, side: key === 'widthCm' ? 'width' : 'length', cm: read.cm });
        return t('seating.itemsOutside', {
          count: ids.length,
          width: lengthWords(t, locale, width, ctx.system),
          roomLength: lengthWords(t, locale, length, ctx.system),
        });
      },
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
        value={plan.roomName ?? ''}
        onCommit={(text) => {
          const name = text.trim();

          return ctx.send(
            () =>
              api.changeSeatingRoom(
                ctx.event.id,
                { roomName: name === '' ? null : name },
                ctx.newest(plan).version,
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
  { tables, rows, singleSeats, seats }: SectionContents,
): string {
  return [
    colour == null ? null : t(`seating.colours.${colour}`),
    tables > 0 || colour != null ? t('seating.countTables', { count: tables }) : null,
    rows > 0 ? t('seating.countRows', { count: rows }) : null,
    singleSeats > 0 ? t('seating.countSingleSeats', { count: singleSeats }) : null,
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
  const { tables, rows, singleSeats } = plan.withoutSection;
  const unsorted = tables + rows + singleSeats > 0;

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
                <span className="st-row-line">{sectionLine(t, section.colour, section)}</span>
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
                <span className="st-row-line">{sectionLine(t, null, plan.withoutSection)}</span>
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
    if (visibleLength(name) > SEATING_LIMITS.sectionNameMaximum) return t('seating.sectionLong');
    const holder = holdingName(plan.sections, name, id);

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
                    ctx.newest(section).version,
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
                ctx.newest(section).version,
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

/** The furniture named as one list, each kind counted, zeros left out, joined with no serial comma; both delete asks read from it (sc-54060). */
function furnitureList(
  t: ReturnType<typeof useTranslation>['t'],
  locale: string,
  {
    sections = 0,
    tables,
    rows,
    singleSeats,
  }: Pick<SectionContents, 'tables' | 'rows' | 'singleSeats'> & { sections?: number },
): string | undefined {
  const parts = [
    sections > 0 ? t('seating.countSections', { count: sections }) : null,
    tables > 0 ? t('seating.countTables', { count: tables }) : null,
    rows > 0 ? t('seating.countRows', { count: rows }) : null,
    singleSeats > 0 ? t('seating.countSingleSeats', { count: singleSeats }) : null,
  ].filter((part): part is string => part != null);

  if (parts.length === 0) return undefined;
  return listFormat(locale, { style: 'long', type: 'conjunction' }).format(parts);
}

/** Deleting a section names each kind of furniture it leaves with no section, the verb from their total; an empty section says nothing (sc-54060). */
export function sectionDeleteWords(
  t: ReturnType<typeof useTranslation>['t'],
  locale: string,
  contents: SectionContents,
): string | undefined {
  const counts = furnitureList(t, locale, contents);

  if (counts == null) return undefined;
  return t('seating.sectionDeleteBody', {
    count: contents.tables + contents.rows + contents.singleSeats,
    counts,
  });
}

/** Delete the plan's ask (pm, 8 Nov 2026): what it deletes, sections counted, then who loses a seat; a sentence with nothing to say is left out. */
export function deletePlanWords(
  t: ReturnType<typeof useTranslation>['t'],
  locale: string,
  counts: SeatingPlan['counts'],
): string {
  const listed = furnitureList(t, locale, counts);
  const guests =
    counts.seatedGuests === 0
      ? t('seating.deletePlanNobody')
      : t('seating.deletePlanSeated', { count: counts.seatedGuests });

  if (listed == null) return guests;
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

  if (asking.kind === 'deleteTable') {
    const table = plan.tables.find((one) => one.id === asking.id);

    if (table == null) return null;
    return (
      <Ask
        title={t('seating.deleteNamed', { name: table.name })}
        line={t('seating.nobodyHere')}
        keep={t('seating.keepIt')}
        go={t('seating.deleteNamedGo', { name: table.name })}
        busy={busy ? t('seating.deleteNamedGo', { name: table.name }) : undefined}
        onKeep={onKeep}
        onGo={() => {
          setBusy(true);
          void ctx
            .remove(() => api.deleteSeatingTable(ctx.event.id, table.id, ctx.newest(table).version))
            .then((deleted) => (deleted ? onDone() : onKeep()));
        }}
      />
    );
  }

  if (asking.kind === 'deleteRow' || asking.kind === 'deleteSeat') {
    const row = asking.kind === 'deleteRow' ? plan.rows.find((one) => one.id === asking.id) : null;
    const seat =
      asking.kind === 'deleteSeat' ? plan.singleSeats.find((one) => one.id === asking.id) : null;
    const name =
      row != null ? t('seating.rowName', { label: row.label }) : seat != null ? seat.name : null;

    if (name == null) return null;
    return (
      <Ask
        title={t('seating.deleteNamed', { name })}
        line={t('seating.nobodyHere')}
        keep={t('seating.keepIt')}
        go={t('seating.deleteNamedGo', { name })}
        busy={busy ? t('seating.deleteNamedGo', { name }) : undefined}
        onKeep={onKeep}
        onGo={() => {
          setBusy(true);
          void ctx
            .remove(() =>
              row != null
                ? api.deleteSeatingRow(ctx.event.id, row.id, ctx.newest(row).version)
                : api.deleteSingleSeat(
                    ctx.event.id,
                    seat?.id ?? '',
                    seat == null ? 0 : ctx.newest(seat).version,
                  ),
            )
            .then((deleted) => (deleted ? onDone() : onKeep()));
        }}
      />
    );
  }

  const section = plan.sections.find((one) => one.id === asking.id);

  if (section == null) return null;

  return (
    <Ask
      title={t('seating.deleteNamed', { name: section.name })}
      line={sectionDeleteWords(t, currentLocale(), section)}
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
