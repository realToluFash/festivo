import {
  ApiError,
  type MeasurementSystem,
  type SeatingTable as Table,
  type OrganisationEvent,
  SEATING_LIMITS,
  SECTION_COLOURS,
  type Seating,
  type SeatingPlan,
  type SeatingSection,
  type SeatingRow,
  type SeatingTable,
  type SeatingWithChosen,
  type SeatingMove,
  type SeatingMoved,
  type SeatingPlaceKind,
  type SectionColour,
  type SectionContents,
  type SingleSeat,
  asColleagueChoice,
  isSeatingNumbers,
  asPlanBeat,
  asPlanSubscriber,
  asPlanSubscribers,
  asSeating,
  type ColleagueChoice,
  type PlanSubscriber,
  realtimeTopic,
  subscribersTopic,
  subscribersUrl,
} from '@soirely/api-client';
import {
  ROOM_MAXIMUM_CM,
  ROOM_MINIMUM_CM,
  leastUsedColour,
  readRoomSide,
  holdingName,
  type FloorBox,
  floorBox,
  insideRoom,
  isRoundShape,
  keyStep,
  listFormat,
  rowExtent,
  shiftWithin,
  snapToGrid,
  visibleLength,
} from '@soirely/domain';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { keptKeys, keptLoad, useAnsweredAgain, useKeptAsShown } from '../../../tabKept.ts';
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
import { steadyTicks } from '../../../steadyTicks.ts';
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
  Swatch,
  type TableNote,
} from './SeatingParts.tsx';
import {
  RowDrawing,
  RowPanel,
  SingleSeatDrawing,
  SingleSeatPanel,
  useAddRowAndSeat,
} from './SeatingRows.tsx';
import {
  AddTable,
  ChairPanel,
  type ChairTip,
  ChairTipDrawing,
  FreeTag,
  TableDrawing,
  TablePanel,
} from './SeatingTables.tsx';
import {
  KeysStrip,
  PlacingBars,
  SaveLine,
  SnapToGrid,
  TableHandles,
  Tip,
} from './SeatingArrange.tsx';
import {
  type FloorItem,
  type Handle,
  type Placement,
  type Placing,
  type SaveState,
  floorItems,
  footprintOf,
  itemName,
  overlappingIds,
  placementOf,
  pressedHandle,
  withPlacements,
} from './seatingItems.ts';
import { fitOf, intoView, useCamera } from './seatingCamera.ts';
import { type TrayFilter, pickedParty, seatedAt } from './seatingGuests.ts';
import { type SeatingView, TablesView, ViewSwitch } from './SeatingCards.tsx';
import { MoveAllPop, PlaceGuests, SeatChoicePop, SeatTray } from './SeatingSeat.tsx';
import { Presence } from './SeatingPresence.tsx';
import {
  BEAT_MS,
  type ColleagueRing,
  NOBODY_ELSE,
  type OwnChoice,
  LEAVING_HOLD_MS,
  type PresenceState,
  RingsContext,
  SILENT_MS,
  beat,
  changed,
  chose,
  colleaguesOf,
  departed,
  listed,
  quieted,
  ringsOf,
  woke,
} from './seatingPresence.ts';
import {
  type Fold,
  type GridDraft,
  type SelectionSteps,
  type StepBar,
  ChooseBar,
  DeleteItemsAsk,
  focusField,
  RulesStrip,
  SelectionPanel,
  StepLine,
} from './SeatingSelection.tsx';
import { ShareTables } from './SeatingShare.tsx';
import {
  COLUMNS_MAX,
  boxOf,
  gridOf,
  inReadingOrder,
  onlyTables,
  outlinesOf,
  readGap,
  readWhole,
  rectOf,
  restoredWith,
  seatingIn,
  touchedBy,
} from './seatingSelection.ts';
import {
  CHAIRS_FROM_SCALE,
  SMALL_MAP_FROM_SCALE,
  f,
  percentOf,
  sectionOf,
  turned,
} from './seatingDraw.ts';
import { freeTags, freeTagWords } from './seatingFreeTags.ts';
import { roomCaption, useCaptionFont } from './seatingCaption.ts';
import { lengthField, lengthWords, tableSizeWords } from './seatingUnits.ts';
import '../../../components/SettingsParts.css';
import './seating.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; seating: Seating };

const RETRY_MS = 5_000;
const WATCH_MS = 1_000;
const RENEW_BEFORE_MS = 60_000;
const PAN_FROM_PX = 4;
const STEP_TRIES = 3;
const STEP_RETRY_MS = 1_000;
const SIZE_STEP_CM = 10;
const FLOAT_MARGINS = 3 * 12;
const ITEM_ATTRIBUTES = ['data-table', 'data-row', 'data-seat'];
const ITEM = ITEM_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(', ');

type Drag =
  | {
      kind: 'move';
      lead: string;
      from: [number, number];
      origins: FloorItem[];
      moved: boolean;
      pointer: number;
      last: Placement[];
    }
  | { kind: 'resize'; table: Table; handle: Handle; pointer: number; last: Placement | null };
const WHEEL_ZOOM = 300;

interface LiveHandlers {
  onSeating: (seating: Seating) => void;
  onGap: () => void;
  onSubscribers: (list: PlanSubscriber[]) => void;
  onSubscriber: (tab: PlanSubscriber) => void;
  onChoice: (choice: ColleagueChoice) => void;
  onBeat: (userId: string) => void;
  onLost: () => void;
}

/** The room as the API holds it, published to every page open on it (sc-3998), with who else has it open and what its editors have chosen (sc-4719). */
function useLiveSeating(eventId: string, handlers: LiveHandlers) {
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const hub = config().mercureUrl;
    if (hub === '') return;

    const topic = realtimeTopic('EventSeating', eventId);
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let listing: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let heardAt = Date.now();
    let open = false;

    const connect = async (): Promise<void> => {
      let subscription;
      try {
        subscription = await api.seatingSubscription(eventId);
      } catch {
        latest.current.onLost();
        if (!stopped) timer = setTimeout(() => void connect(), RETRY_MS);
        return;
      }
      if (stopped) return;

      const url = new URL(hub);
      url.searchParams.append('topic', topic);
      url.searchParams.append('topic', realtimeTopic('EventSeatingChoices', eventId));
      url.searchParams.append('topic', subscribersTopic(topic));
      url.searchParams.append('authorization', subscription.token);
      const token = subscription.token;

      source?.close();
      clearTimeout(listing);
      source = new EventSource(url);
      heardAt = Date.now();
      open = false;
      const opened = source;
      const list = (): void => {
        clearTimeout(listing);
        fetch(subscribersUrl(hub, topic), { headers: { Authorization: `Bearer ${token}` } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
          .then(
            (body: unknown) =>
              !stopped && latest.current.onSubscribers(asPlanSubscribers(body, topic)),
            () => {
              if (stopped || source !== opened) return;
              latest.current.onLost();
              listing = setTimeout(list, RETRY_MS);
            },
          );
      };
      source.onopen = () => {
        heardAt = Date.now();
        open = true;
        sayHere();
        latest.current.onGap();
        list();
      };
      source.onmessage = (message: MessageEvent<string>) => {
        heardAt = Date.now();
        let data: unknown = null;
        try {
          data = JSON.parse(message.data);
        } catch {
          data = null;
        }
        const tab = asPlanSubscriber(data, topic);
        if (tab != null) return latest.current.onSubscriber(tab);
        const here = asPlanBeat(data);
        if (here != null) return latest.current.onBeat(here);
        const choice = asColleagueChoice(data);
        if (choice != null) return latest.current.onChoice(choice);
        if (isSeatingNumbers(data)) return;
        const seating = asSeating(data);
        if (seating == null) latest.current.onGap();
        else latest.current.onSeating(seating);
      };
      source.onerror = () => {
        if (stopped || source !== opened) return;
        dropped();
      };

      const lapses = Date.parse(subscription.expiresAt) - Date.now() - RENEW_BEFORE_MS;
      clearTimeout(timer);
      timer = setTimeout(() => void connect(), Math.max(lapses, RETRY_MS));
    };

    /** Closed rather than left to the browser's retry, which would present a token that may have lapsed with the reader's access. */
    const dropped = (): void => {
      latest.current.onLost();
      open = false;
      source?.close();
      source = null;
      clearTimeout(listing);
      clearTimeout(timer);
      timer = setTimeout(() => void connect(), RETRY_MS);
    };
    const sayHere = (): void => {
      if (open) api.sayHereOnPlan(eventId).catch(() => undefined);
    };
    let watchedAt = Date.now();
    const stopBeating = steadyTicks(BEAT_MS, sayHere);
    /** A page held back past a beat, by sleep or a hidden tab without a worker, says it is here and waits to be heard again rather than reconnecting. */
    const stopWatching = steadyTicks(WATCH_MS, () => {
      const now = Date.now();
      const heldBack = now - watchedAt > BEAT_MS;
      watchedAt = now;
      if (source == null) return;
      if (heldBack) {
        heardAt = now;
        sayHere();
      } else if (now - heardAt > SILENT_MS) dropped();
    });

    void connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(listing);
      stopBeating();
      stopWatching();
      source?.close();
    };
  }, [eventId]);
}

/** Who else has the plan open, and telling them what you have chosen: when it changes, when you (re)connect, and when someone arrives. */
function usePresence(event: OrganisationEvent) {
  const { t } = useTranslation();
  const me = useSession().userId;
  const editor = canOn(event, 'seating.manage');
  const [presence, setPresence] = useState<PresenceState>(NOBODY_ELSE);
  const mine = useRef<OwnChoice | null>(null);
  const told = useRef<string>('null');
  const holds = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = holds.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const say = (key: 'joinedPlan' | 'leftPlan', name: string) => t(`seating.${key}`, { name });
    let tickedAt = Date.now();
    return steadyTicks(WATCH_MS, () => {
      const now = Date.now();
      const heldBack = now - tickedAt > BEAT_MS;
      tickedAt = now;
      setPresence((was) => (heldBack ? woke(was, now) : quieted(was, now, me, say)));
    });
  }, [me, t]);

  const tell = useCallback(
    (chosen: OwnChoice | null, again = false) => {
      mine.current = chosen;
      const key = JSON.stringify(chosen);
      if (!editor || (!again && key === told.current)) return;
      told.current = key;
      api.chooseOnPlan(event.id, chosen).catch(() => {
        told.current = 'unsent';
      });
    },
    [editor, event.id],
  );
  const say = (key: 'joinedPlan' | 'leftPlan', name: string) => t(`seating.${key}`, { name });

  const handlers: Omit<LiveHandlers, 'onSeating' | 'onGap'> = {
    onSubscribers: (list) => {
      setPresence((was) => listed(was, list, Date.now()));
      if (mine.current != null) tell(mine.current, true);
    },
    onSubscriber: (tab) => {
      setPresence((was) => changed(was, tab, me, say, Date.now()));
      if (!tab.active)
        holds.current.push(
          setTimeout(
            () => setPresence((was) => departed(was, tab.subscriber, me, say)),
            LEAVING_HOLD_MS,
          ),
        );
      if (tab.active && tab.userId !== me && mine.current != null) tell(mine.current, true);
    },
    onChoice: (choice) => {
      if (choice.userId !== me) setPresence((was) => chose(was, choice));
    },
    onBeat: (userId) => {
      if (userId !== me) setPresence((was) => beat(was, userId, Date.now(), say));
    },
    onLost: () =>
      setPresence((was) => (was.connection === 'lost' ? was : { ...was, connection: 'lost' })),
  };

  return {
    handlers,
    tell,
    people: colleaguesOf(presence, me),
    rings: ringsOf(presence, me),
    lost: presence.connection === 'lost',
    spoken: presence.spoken,
  };
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

/** Where the bar floating over the room covers it, in the room's own pixels, so a chair's label can keep clear of it (sc-5030). */
function useCover(): [(node: HTMLDivElement | null) => void, FloorBox | null] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [cover, setCover] = useState<FloorBox | null>(null);

  useLayoutEffect(() => {
    if (node == null) return;
    const measure = () => {
      const room = node.parentElement?.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const next =
        room == null || box.height === 0
          ? null
          : {
              x0: box.left - room.left,
              y0: box.top - room.top,
              x1: box.right - room.left,
              y1: box.bottom - room.top,
            };

      setCover((now) =>
        now != null &&
        next != null &&
        now.x0 === next.x0 &&
        now.y0 === next.y0 &&
        now.x1 === next.x1 &&
        now.y1 === next.y1
          ? now
          : next,
      );
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);

    watch.observe(node);
    if (node.parentElement != null) watch.observe(node.parentElement);
    return () => watch.disconnect();
  }, [node]);

  return [setNode, cover];
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
  const answeredAgain = useAnsweredAgain();

  usePageTitle(pageTitle(t, [t('seating.area'), event.name]));

  useEffect(() => {
    let current = true;

    keptLoad(keptKeys.seating(event.id), api.seating(event.id)).then(
      (seating) => current && setLoad({ kind: 'loaded', seating }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);

  useKeptAsShown(keptKeys.seating(event.id), load.kind === 'loaded' ? load.seating : null);

  const presence = usePresence(event);

  useLiveSeating(event.id, {
    onSeating: (seating) => setLoad({ kind: 'loaded', seating }),
    onGap: () => setAttempt((n) => n + 1),
    ...presence.handlers,
  });

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
      <Presence people={presence.people} lost={presence.lost} spoken={presence.spoken} />
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
        rings={presence.rings}
        onChosen={presence.tell}
      />
    </div>
  );
}

function Plan({
  event,
  seating,
  onSeating,
  reload,
  rings,
  onChosen,
}: {
  event: OrganisationEvent;
  seating: Seating;
  onSeating: (seating: Seating) => void;
  reload: () => void;
  rings: Record<string, ColleagueRing[]>;
  onChosen: (chosen: OwnChoice | null) => void;
}) {
  const { t } = useTranslation();
  useCaptionFont();
  const { layers, covered, setHost } = useDeskLayers();
  const [panel, setPanel] = useState<Panel | null>(null);
  const opener = useRef<string | null>(null);
  const newest = useRef(seating.plan);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pressedStep = useRef(0);
  const runningStep = useRef(0);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState<TableNote | null>(null);
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
  const [placeFloat, cover] = useCover();
  const press = useRef<{
    from: [number, number];
    moved: boolean;
    fingers: boolean;
    pointer: number;
  } | null>(null);
  const panned = useRef(false);
  const [several, setSeveral] = useState<string[]>([]);
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [save, setSave] = useState<SaveState>('saved');
  const [snap, setSnap] = useState(true);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [another, setAnother] = useState(true);
  const [tip, setTip] = useState<{ id: string; words: string } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [heard, setHeard] = useState('');
  const unsaved = useRef<Placement[] | null>(null);
  const ownSteps = useRef(new Map<string, number>());
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const shown = plan == null ? null : withPlacements(plan, placements);
  const overlaps = shown == null ? new Set<string>() : overlappingIds(shown);
  const where = useRef({ s: 1, ox: 0, oy: 0, snap: true });
  const [adding, setAdding] = useState(false);
  const [kindMenu, setKindMenu] = useState(false);
  const [fold, setFold] = useState<Fold | null>(null);
  const [grid, setGrid] = useState<GridDraft>({ columns: '3', gap: '1' });
  const [bar, setBar] = useState<StepBar | null>(null);
  const [tab, setTab] = useState<'arrange' | 'seat'>('arrange');
  const [pickedGuest, setPickedGuest] = useState<string | null>(null);
  const [pointedAt, setPointedAt] = useState<string | null>(null);
  const [choice, setChoice] = useState<SeatChoice | null>(null);
  const choiceFrom = useRef<Element | null>(null);
  const [focusBack, setFocusBack] = useState<{ from: SVGElement; at: string } | null>(null);
  const [chairTip, setChairTip] = useState<{ pick: string; tip: ChairTip } | null>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [seatingView, setSeatingView] = useState<SeatingView>('plan');
  const [rowDown, setRowDown] = useState(false);

  useLayoutEffect(() => {
    const views = canvasNode.current?.querySelector<HTMLElement>('.st-views');
    const right = canvasNode.current?.querySelector<HTMLElement>('.st-top-right');

    setRowDown(
      views != null &&
        right != null &&
        views.getBoundingClientRect().width + right.getBoundingClientRect().width + FLOAT_MARGINS >
          size.w,
    );
  }, [size.w, save, seatingView, readOnly, plan, t]);

  const [cardSection, setCardSection] = useState<string | null>(null);
  const [tray, setTray] = useState<TrayFilter>({ unsure: false, search: '', groups: [] });
  const party = plan == null || readOnly ? null : pickedParty(plan, pickedGuest);
  const dropChoice = () => {
    choiceFrom.current = null;
    setChoice(null);
  };
  const closeChoice = () => {
    const back = choiceFrom.current;
    const at = choice == null ? null : `.st-room [${choice.attribute}="${choice.id}"]`;

    dropChoice();
    focusWhenFree(() =>
      back instanceof SVGElement && back.closest('.st-room') != null
        ? back
        : at == null
          ? null
          : document.querySelector<SVGElement>(at),
    );
  };
  const movingFrom = party?.lead.seat ?? null;
  /** A chair that takes the keyboard but not the pointer is drawn only while a guest is picked, so focus on it waits for the render that drops the pick before choosing between it and its place. */
  const focusAfterPick = (from: Element | null, at: string | null) => {
    if (!(from instanceof SVGElement) || from.closest('.st-room') == null || at == null) return;
    setFocusBack({ from, at });
  };
  useEffect(() => {
    if (focusBack == null) return;
    focusWhenFree(() =>
      focusBack.from.isConnected
        ? focusBack.from
        : document.querySelector<SVGElement>(focusBack.at),
    );
  }, [focusBack]);
  const dropPick = () => {
    const from = document.activeElement;
    const place = from?.closest(ITEM);
    const attribute = ITEM_ATTRIBUTES.find((one) => place?.hasAttribute(one));

    if (place !== from && attribute != null)
      focusAfterPick(from, `.st-room [${attribute}="${place?.getAttribute(attribute)}"]`);
    setChoice(null);
    setPickedGuest(null);
    setBar((was) => (was?.tone === 'undo' ? was : null));
  };
  const [boxDrawn, setBoxDrawn] = useState<FloorBox | null>(null);
  const boxing = useRef<{
    from: [number, number];
    at: [number, number];
    base: string[];
    before: { panel: Panel | null; several: string[] };
    moved: boolean;
    pointer: number;
  } | null>(null);
  const spaceHeld = useRef(false);
  const spacePanned = useRef(false);
  const spaceOn = useRef<{ id: string; shift: boolean } | null>(null);
  const touches = useRef(new Set<number>());

  useEffect(() => {
    where.current = { s: camera.s, ox: camera.ox, oy: camera.oy, snap };
  });

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
  const chosenAttribute = shownPanel == null ? null : itemAttribute(shownPanel.kind);

  const single =
    chosenItem != null && shownPanel?.kind !== 'chair' && several.length < 2 ? [chosenItem] : [];
  const chosenIds = several.length > 1 ? several : single;
  const itemOf = (id: string, from: SeatingPlan | null = shown): FloorItem | null =>
    from == null ? null : (floorItems(from).find((item) => item.one.id === id) ?? null);
  const chosenItems = several.length > 1 ? several.flatMap((id) => itemOf(id) ?? []) : [];
  const ownLead = shownPanel?.kind === 'chair' ? null : (chosenIds[0] ?? null);
  const ownKind = ownLead == null ? null : (itemOf(ownLead)?.kind ?? null);
  const ownChoice: OwnChoice | null =
    shownPanel?.kind === 'chair'
      ? { kind: 'table', id: shownPanel.id, chair: shownPanel.seat }
      : ownLead == null || ownKind == null
        ? null
        : { kind: ownKind, id: ownLead, chair: null };
  const ownKey = JSON.stringify(ownChoice);
  const tellChosen = useEffectEvent(() => onChosen(ownChoice));

  useEffect(() => tellChosen(), [ownKey]);

  const dropRefusal = () => setBar((was) => (was?.tone === 'amber' ? null : was));
  const open = (next: Panel | null, onItem = false) => {
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
      const id = onItem && 'id' in next ? next.id : null;
      const attribute = id == null ? null : itemAttribute(next.kind);
      const item = attribute == null ? null : `.st-room [${attribute}="${id}"]`;

      focusWhenFree(() =>
        document.querySelector<HTMLElement | SVGElement>(item ?? '.st-panel [data-focus="title"]'),
      );
    }
    setPanel(next);
    setSeveral([]);
    setNotice(null);
    dropRefusal();
    setNote(null);
    setSectionsRefused(false);
    setOutside(null);
  };

  /** Chooses these without moving the focus, as a box, Select all and the kind menu do. */
  const pick = (ids: string[]) => {
    const only = ids.length === 1 ? itemOf(ids[0]!, newest.current) : null;

    setPanel(only == null ? null : { kind: only.kind, id: only.one.id });
    setSeveral(ids.length > 1 ? ids : []);
    setNotice(null);
    dropRefusal();
    setOutside(null);
    setKindMenu(false);
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

  const keepClear = useCallback(
    (target: Element) => {
      const node = canvasNode.current;

      if (node == null) return;
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
    },
    [panBy, view],
  );

  const keyed = useRef<string | null>(null);
  const keysShown =
    keyboard && focusId != null && chosenIds.includes(focusId) && !readOnly && !adding;
  const focusedItem = useCallback((): Element | null => {
    const active = document.activeElement;

    return active != null &&
      canvasNode.current?.contains(active) === true &&
      active.matches('[data-table], [data-row], [data-seat]')
      ? active
      : null;
  }, []);

  useLayoutEffect(() => {
    const id = keyed.current;

    keyed.current = null;
    if (id == null) return;
    const target = focusedItem();

    if (target == null) return;
    if (['data-table', 'data-row', 'data-seat'].some((one) => target.getAttribute(one) === id))
      keepClear(target);
  });

  useLayoutEffect(() => {
    const target = keysShown ? focusedItem() : null;

    if (target != null) keepClear(target);
  }, [keysShown, focusedItem, keepClear]);

  const keyFocus = keyboard && focusId != null;

  useEffect(() => {
    const node = canvasNode.current;

    if (!keyFocus || node == null || typeof ResizeObserver === 'undefined') return;
    const tall = new WeakMap<Element, number>();
    let frame = 0;
    const clearSettled = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = focusedItem();

        if (target != null) keepClear(target);
      });
    };
    const grows = new ResizeObserver((entries) => {
      const grew = entries.some((entry) => {
        const was = tall.get(entry.target);
        const now = entry.target.getBoundingClientRect().height;

        tall.set(entry.target, now);
        return was != null && now > was;
      });

      if (grew) clearSettled();
    });
    const watch = () =>
      node.querySelectorAll(`:scope > ${BY_KEYS_BAR}`).forEach((bar) => grows.observe(bar));
    const shows = new MutationObserver((changes) => {
      watch();
      const shown = changes.some((change) =>
        [...change.addedNodes].some((one) => one instanceof Element && one.matches(BY_KEYS_BAR)),
      );

      if (shown) clearSettled();
    });

    watch();
    shows.observe(node, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      grows.disconnect();
      shows.disconnect();
    };
  }, [keyFocus, focusedItem, keepClear]);

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
      keepClear(target);
    };

    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', point, true);
    node.addEventListener('focusin', follow);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', point, true);
      node.removeEventListener('focusin', follow);
    };
  }, [hasRoom, keepClear]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const now = press.current;

      if (now == null || now.pointer !== event.pointerId) return;
      const dx = event.clientX - now.from[0];
      const dy = event.clientY - now.from[1];

      if (!now.moved && Math.hypot(dx, dy) < PAN_FROM_PX) return;
      if (!now.moved && spaceHeld.current) {
        spacePanned.current = true;
        const focused = document.activeElement;

        if (focused instanceof HTMLElement && focused.closest('.st-canvas svg') == null)
          focused.blur();
      }
      now.moved = true;
      now.from = [event.clientX, event.clientY];
      panBy(-dx, -dy);
    };
    const up = (event: PointerEvent) => {
      if (press.current?.pointer !== event.pointerId) return;
      panned.current = event.type === 'pointerup' && (press.current.moved || press.current.fingers);
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

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (covered) return;
    if (event.key === ' ' && plan != null && !typing(event.target) && !event.defaultPrevented) {
      spaceHeld.current = true;
      if (!control(event.target)) event.preventDefault();
    }
    if (
      (event.key === 'a' || event.key === 'A') &&
      (event.metaKey || event.ctrlKey) &&
      !typing(event.target) &&
      plan != null &&
      !readOnly &&
      placing == null &&
      asking == null
    ) {
      event.preventDefault();
      pick(floorItems(plan).map((item) => item.one.id));
      return;
    }
    if (event.key !== 'Escape') return;
    if (choice != null) {
      event.preventDefault();
      closeChoice();
    } else if (moveFrom != null) {
      event.preventDefault();
      setMoveFrom(null);
    } else if (pickedGuest != null) {
      event.preventDefault();
      dropPick();
    } else if (placing != null) {
      event.preventDefault();
      setPlacing(null);
    } else if (kindMenu) {
      event.preventDefault();
      setKindMenu(false);
    } else if (event.defaultPrevented || asking != null) return;
    else if (adding) {
      event.preventDefault();
      setAdding(false);
    } else if (several.length > 1) {
      event.preventDefault();
      setSeveral([]);
    } else if (chosenAttribute != null) {
      event.preventDefault();
      open(null);
    }
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
        setNote(null);
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
      if (error instanceof ApiError && error.is('seating_guests_seated')) {
        const line = error.problem.detail ?? t('seating.notSaved');

        if (field != null) return { refused: line };
        setNotice(line);
        return { refused: null };
      }
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

  const lengths = (cm: number, display: 'short' | 'long' = 'short') =>
    lengthWords(t, locale, cm, system, { display });

  const settle = (items: Placement[]) =>
    setPlacements((was) => {
      const next = { ...was };

      for (const item of items) if (next[item.id] === item) delete next[item.id];
      return next;
    });

  const baseOf = (item: Placement): number => {
    let version = item.version;

    for (let to = ownSteps.current.get(`${item.id}@${version}`); to != null;) {
      version = to;
      to = ownSteps.current.get(`${item.id}@${version}`);
    }
    return version;
  };

  const sendStep = async (
    items: Placement[],
    tool: boolean,
    onSaved?: () => void,
  ): Promise<void> => {
    const versioned = items.map((item) => ({ ...item, version: baseOf(item) }));

    for (let tries = 1; ; tries += 1) {
      try {
        const now = await api.arrangeSeating(event.id, versioned);

        for (const item of versioned) {
          const saved = itemOf(item.id, now.plan);

          if (saved != null && saved.one.version !== item.version)
            ownSteps.current.set(`${item.id}@${item.version}`, saved.one.version);
        }
        newest.current = now.plan;
        onSeating(now);
        settle(items);
        setNote((was) => (was != null && items.some((item) => item.id === was.id) ? null : was));
        setSave('saved');
        onSaved?.();
        return;
      } catch (error) {
        if (error instanceof ApiError && error.status === 412 && tool) {
          settle(items);
          setSave('saved');
          staleStep(error);
          return;
        }
        if (error instanceof ApiError && error.status === 412) {
          const stale = error.problem.stale?.[0];
          const item = stale == null ? null : itemOf(stale, newest.current);
          const name = error.problem.changedBy;

          settle(items);
          setSave('saved');
          refuseStep(
            name == null || item == null
              ? t('seating.notSaved')
              : t('seating.stepRefused', { name, item: itemName(t, item) }),
          );
          setReloads((n) => n + 1);
          setNote(null);
          reload();
          return;
        }
        if (error instanceof ApiError && error.status < 500) {
          const said = Object.values(error.fieldErrors())[0] ?? t('seating.notSaved');

          settle(items);
          setSave('saved');
          if (tool) refuseStep(said);
          else setNotice(said);
          return;
        }
        if (tries >= STEP_TRIES) {
          unsaved.current = items;
          setSave('notSaved');
          return;
        }
        setSave('retrying');
        await new Promise((done) => setTimeout(done, STEP_RETRY_MS * tries));
      }
    }
  };

  const arrange = (items: Placement[], tool = false, onSaved?: () => void) => {
    if (items.length === 0) return;
    setPlacements((was) => ({ ...was, ...Object.fromEntries(items.map((one) => [one.id, one])) }));
    unsaved.current = null;
    setSave('saving');
    if (tool) setBar(null);
    else dropRefusal();
    const mine = tool ? (pressedStep.current += 1) : 0;

    queue.current = queue.current.then(() => {
      runningStep.current = mine;
      return sendStep(items, tool, onSaved);
    });
  };

  const tryAgain = () => {
    const items = unsaved.current;

    if (items != null) arrange(items);
  };

  const toggle = (id: string) => {
    const next = chosenIds.includes(id)
      ? chosenIds.filter((one) => one !== id)
      : [...chosenIds, id];
    const only = next.length === 1 ? itemOf(next[0]!) : null;

    if (only != null) open({ kind: only.kind, id: only.one.id }, true);
    else if (next.length === 0) open(null);
    else {
      setPanel(null);
      setSeveral(next);
      setNotice(null);
    }
  };

  const onSpaceUp = useEffectEvent((event: KeyboardEvent) => {
    const on = spaceOn.current;

    spaceOn.current = null;
    if (on == null || spacePanned.current) return;
    const focused = document.activeElement;

    if (!ITEM_ATTRIBUTES.some((attribute) => focused?.getAttribute(attribute) === on.id)) return;
    const item = itemOf(on.id);

    if (item == null) return;
    if ((on.shift || event.shiftKey || adding) && !readOnly) toggle(on.id);
    else open({ kind: item.kind, id: on.id }, true);
  });

  useEffect(() => {
    const keys = (event: KeyboardEvent) => onKey(event);
    const lift = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      if (spacePanned.current || (spaceHeld.current && !control(event.target)))
        event.preventDefault();
      onSpaceUp(event);
      spaceHeld.current = false;
      spacePanned.current = false;
    };

    window.addEventListener('keydown', keys);
    window.addEventListener('keyup', lift);
    return () => {
      window.removeEventListener('keydown', keys);
      window.removeEventListener('keyup', lift);
    };
  }, []);

  const versionNow = (id: string): number => itemOf(id, newest.current)?.one.version ?? 0;
  const refNow = (kind: FloorItem['kind'], id: string) => ({ kind, id, version: versionNow(id) });

  const stepDone = (words: string, undo: () => void) => {
    if (runningStep.current === pressedStep.current) setBar({ tone: 'undo', words, undo });
    setHeard(words);
  };
  const refuseStep = (words: string) => {
    setBar({ tone: 'amber', words });
    setHeard('');
  };
  const undone = () => setHeard(t('seating.undone'));
  const undo = () => {
    const back = bar?.undo;

    setBar(null);
    back?.();
  };

  const pickGuest = (id: string | null) => {
    setPickedGuest(id);
    setMoveFrom(null);
    setBar(null);
  };
  /** In Seat, a guest on a chair is picked from it, to move them; true when there was one. */
  const pickFrom = (item: FloorItem, seat: number): boolean => {
    const there =
      tab === 'seat' && !readOnly && plan != null ? seatedAt(plan, item.one.id, seat) : null;

    if (there == null) return false;
    pickGuest(there.id);
    return true;
  };
  /** On Tables, a taken chair picks who sits there with nothing picked; their own chair again drops them. */
  const pickSeated = (item: FloorItem, seat: number) => {
    const there = readOnly || plan == null ? null : seatedAt(plan, item.one.id, seat);

    if (there == null) return;
    setTab('seat');
    if (pickedGuest === there.id) dropPick();
    else pickGuest(there.id);
  };
  const unseatAll = (item: FloorItem) => {
    const place = itemName(t, item);

    setBar(null);
    api.unseatGuests(event.id, { kind: item.kind, placeId: item.one.id }).then(
      (moved) => {
        onSeating(moved.seating);
        stepDone(t('seating.tableEmpty', { table: place }), () => undoMoves(moved.moves));
      },
      () => refuseStep(t('seating.notSaved')),
    );
  };
  const rename = (item: FloorItem) => {
    setTab('arrange');
    open({ kind: item.kind, id: item.one.id }, true);
    focusField(item.kind === 'row' ? 'label' : 'name');
  };
  const moveAll = (from: FloorItem, to: FloorItem) => {
    const place = itemName(t, to);

    setMoveFrom(null);
    setBar(null);
    api
      .moveEveryone(
        event.id,
        { kind: from.kind, id: from.one.id },
        { kind: to.kind, id: to.one.id },
      )
      .then(
        (moved) => {
          onSeating(moved.seating);
          stepDone(t('seating.movedAll', { count: moved.moves.length, table: place }), () =>
            undoMoves(moved.moves),
          );
        },
        (error: unknown) =>
          refuseStep(
            error instanceof ApiError && error.is('seating_table_full')
              ? t('seating.tableFull', { table: place })
              : t('seating.notSaved'),
          ),
      );
  };
  const undoMoves = (moves: SeatingMove[]) => {
    api.undoSeating(event.id, moves).then(
      (moved) => {
        onSeating(moved.seating);
        undone();
      },
      (error: unknown) =>
        refuseStep(
          error instanceof ApiError && error.is('seating_undo_stale')
            ? t('seating.undoRefused')
            : t('seating.notSaved'),
        ),
    );
  };
  const seatedWords = (name: string, others: number, apart: boolean, place: string) =>
    others === 0
      ? t('seating.seatedOne', { name, table: place })
      : t(apart ? 'seating.seatedApart' : 'seating.seatedParty', {
          name,
          count: others,
          table: place,
        });
  const focusAfterSeat = (item: FloorItem, from: Element | null) =>
    focusAfterPick(from, `.st-room [${itemAttribute(item.kind) ?? 'data-table'}="${item.one.id}"]`);
  const seatAt = (item: FloorItem, seat: number | null = null, justGuest = false): void => {
    if (party == null || plan == null) return;
    const from = (choice == null ? null : choiceFrom.current) ?? document.activeElement;

    choiceFrom.current = null;
    const lead = party.lead;
    const name = lead.fullName ?? '';
    const place = itemName(t, item);
    const kind: SeatingPlaceKind = item.kind;
    const there = seat == null ? null : seatedAt(plan, item.one.id, seat);
    const ask = (kind: SeatChoice['kind'], words: string, go: SeatChoice['go']) => {
      if (seatingView === 'tables') {
        const cancel = { label: t('seating.cancel'), run: () => setBar(null) };
        const yes = {
          ...go,
          run: () => {
            setBar(null);
            go.run();
          },
        };

        setBar({
          tone: kind === 'short' ? 'amber' : 'pick',
          words,
          acts: kind === 'short' ? [cancel, yes] : [yes, cancel],
        });
        return;
      }
      choiceFrom.current = document.activeElement;
      setChoice({
        kind,
        id: item.one.id,
        attribute: itemAttribute(item.kind) ?? 'data-table',
        name: place,
        words,
        go: {
          ...go,
          run: () => {
            dropChoice();
            go.run();
          },
        },
      });
    };

    if (there?.id === lead.id) {
      dropPick();
      return;
    }
    if (there != null) {
      const theirs = there.fullName ?? '';

      ask('swap', t('seating.swapLine', { table: place, n: seat, name: theirs }), {
        label: t('seating.swapWith', { name: theirs }),
        run: () =>
          api.swapGuests(event.id, lead.id, there.id).then(
            (moved) => {
              onSeating(moved.seating);
              setPickedGuest(null);
              stepDone(seatedWords(name, 0, false, place), () => undoMoves(moved.moves));
              focusAfterSeat(item, from);
            },
            () => refuseStep(t('seating.race', { name })),
          ),
      });
      return;
    }
    setBar(null);
    dropChoice();
    api.seatGuest(event.id, lead.id, { kind, id: item.one.id }, { seat, justGuest }).then(
      (moved) => {
        onSeating(moved.seating);
        setPickedGuest(null);
        const words = seatedWords(name, moved.moves.length - 1, moved.apart, place);

        setBar({ tone: 'undo', words, undo: () => undoMoves(moved.moves), lit: item.one.id });
        setHeard(words);
        focusAfterSeat(item, from);
      },
      (error: unknown) => {
        if (!(error instanceof ApiError)) refuseStep(t('seating.notSaved'));
        else if (error.is('seating_table_full'))
          refuseStep(t('seating.tableFull', { table: place }));
        else if (error.is('seating_table_short'))
          ask(
            'short',
            t('seating.tableShort', {
              table: place,
              count: error.problem.free ?? 0,
              name,
              party: error.problem.party ?? party.companions.length + 1,
            }),
            { label: t('seating.seatJust', { name }), run: () => seatAt(item, seat, true) },
          );
        else if (error.is('seating_seat_taken')) refuseStep(t('seating.race', { name }));
        else refuseStep(t('seating.notSaved'));
      },
    );
  };

  const staleStep = (error: ApiError) => {
    const stale = error.problem.stale?.[0];
    const item = stale == null ? null : itemOf(stale, newest.current);
    const name = error.problem.changedBy;

    refuseStep(
      name == null || item == null
        ? t('seating.notSaved')
        : t('seating.stepChanged', { name, table: itemName(t, item) }),
    );
    setReloads((n) => n + 1);
    reload();
  };

  /** One step through the queue, all or nothing; a 412 keeps the choice and says who changed what.
   *  Queuing it takes the last step's Undo down, which would otherwise act on a plan this step changes,
   *  and an earlier step saved while this one waits puts no Undo up. */
  const runStep = <A extends Seating | SeatingWithChosen | SeatingMoved>(
    change: () => Promise<A> | null,
    done: (answer: A) => void,
    refused?: () => void,
  ) => {
    setSave('saving');
    setBar(null);
    const mine = (pressedStep.current += 1);

    queue.current = queue.current.then(async () => {
      runningStep.current = mine;
      try {
        const sending = change();

        if (sending == null) {
          setSave('saved');
          return;
        }
        const answer = await sending;
        const now = seatingIn(answer);

        newest.current = now.plan;
        onSeating(now);
        setSave('saved');
        done(answer);
      } catch (error) {
        setSave('saved');
        if (error instanceof ApiError && error.status === 412) staleStep(error);
        else {
          refuseStep(
            error instanceof ApiError && error.is('seating_undo_stale')
              ? t('seating.undoRefused')
              : error instanceof ApiError
                ? (Object.values(error.fieldErrors())[0] ?? t('seating.notSaved'))
                : t('seating.notSaved'),
          );
          refused?.();
        }
      }
    });
  };

  const moveStep = (moved: Placement[], words: string) => {
    const back = moved.flatMap((to) => {
      const item = itemOf(to.id);

      return item == null ? [] : [placementOf(item)];
    });

    arrange(moved, true, () => stepDone(words, () => arrange(back, true, undone)));
  };

  const renameStep = (names: { id: string; name: string }[], words: string) => {
    const before = names.flatMap((one) => {
      const table = plan?.tables.find((other) => other.id === one.id);

      return table == null ? [] : [{ id: table.id, name: table.name }];
    });
    const rename = (list: { id: string; name: string }[], done: () => void) =>
      runStep(
        () =>
          api.renameSeatingTables(
            event.id,
            list.map((one) => ({ id: one.id, name: one.name, version: versionNow(one.id) })),
          ),
        done,
      );

    rename(names, () => stepDone(words, () => rename(before, undone)));
  };

  const sectionStep = (sectionId: string | null, words: string) => {
    const before = chosenItems.map((item) => ({
      kind: item.kind,
      id: item.one.id,
      sectionId: item.one.sectionId,
    }));
    const section = (list: typeof before, done: () => void) =>
      runStep(
        () =>
          api.sectionSeatingItems(
            event.id,
            list.map((one) => ({ ...refNow(one.kind, one.id), sectionId: one.sectionId })),
          ),
        done,
      );

    section(
      before.map((one) => ({ ...one, sectionId })),
      () => stepDone(words, () => section(before, undone)),
    );
  };

  const focusRefusal = () =>
    focusWhenFree(() => document.querySelector<HTMLElement>('.st-bar [data-said="bar"]'));

  const duplicateStep = () => {
    const items = chosenItems;

    runStep(
      () =>
        api.duplicateSeatingItems(
          event.id,
          items.map((item) => refNow(item.kind, item.one.id)),
        ),
      (answer) => {
        pick(answer.chosen);
        stepDone(t('seating.duplicatedMany', { count: answer.chosen.length }), () =>
          runStep(
            () => {
              const copies = answer.chosen.flatMap((id) => {
                const copy = itemOf(id, newest.current);

                return copy == null ? [] : [refNow(copy.kind, id)];
              });

              return copies.length === 0 ? null : api.deleteSeatingItems(event.id, copies, true);
            },
            () => {
              pick(items.map((item) => item.one.id));
              undone();
            },
            focusRefusal,
          ),
        );
      },
    );
  };

  const deleteStep = (items: FloorItem[]) => {
    runStep(
      () =>
        api.deleteSeatingItems(
          event.id,
          items.map((item) => refNow(item.kind, item.one.id)),
        ),
      (answer) => {
        const freed = answer.moves;
        const tables = onlyTables(items);

        pick([]);
        stepDone(
          [
            t(tables ? 'seating.deletedEmptyTables' : 'seating.deletedEmptyItems', {
              count: items.length,
            }),
            ...(freed.length === 0 ? [] : [t('seating.movedToTrayDone', { count: freed.length })]),
          ].join(' '),
          () =>
            runStep(
              () =>
                api.restoreSeatingItems(
                  event.id,
                  items.map((item) => restoredWith(item, freed)),
                ),
              (back) => {
                pick(back.chosen);
                undone();
                focusWhenFree(
                  () =>
                    [...document.querySelectorAll<SVGElement>(`.st-room :is(${ITEM})`)].find(
                      (item) =>
                        ITEM_ATTRIBUTES.some((name) =>
                          back.chosen.includes(item.getAttribute(name) ?? ''),
                        ),
                    ) ?? null,
                );
              },
              focusRefusal,
            ),
        );
        focusWhenFree(() => document.querySelector<HTMLButtonElement>('.st-bar [data-act="undo"]'));
      },
    );
  };

  const steps: SelectionSteps = {
    move: moveStep,
    refuse: refuseStep,
    rename: renameStep,
    section: sectionStep,
    duplicate: duplicateStep,
    askDelete: () =>
      setAsking({ kind: 'deleteItems', ids: chosenItems.map((item) => item.one.id) }),
  };

  const startPlacing = (next: Placing) => {
    setPanel(null);
    setSeveral([]);
    setNotice(null);
    setPlacing(next);
  };

  const placeAt = async ([x, y]: [number, number]): Promise<void> => {
    const kind = placing;

    if (kind == null || plan == null) return;
    if (!another) setPlacing(null);
    const added = await place(() =>
      kind.kind === 'table'
        ? api.addSeatingTable(event.id, kind.shape)
        : kind.kind === 'row'
          ? api.addSeatingRow(event.id)
          : api.addSingleSeat(event.id),
    );
    const item = added == null ? null : itemOf(added.id, newest.current);

    if (item == null) return;
    const at: [number, number] = [
      snapToGrid(x, system, where.current.snap),
      snapToGrid(y, system, where.current.snap),
    ];
    const box = floorBox(footprintOf(item), at);
    const xCm = Math.round(at[0] + Math.max(0, -box.x0) - Math.max(0, box.x1 - plan.widthCm));
    const yCm = Math.round(at[1] + Math.max(0, -box.y0) - Math.max(0, box.y1 - plan.lengthCm));

    arrange([{ ...placementOf(item), xCm, yCm }]);
    if (!another) open({ kind: item.kind, id: item.one.id });
  };

  const duplicate = (item: FloorItem) => {
    if (item.kind === 'seat') return;
    const copying =
      item.kind === 'table'
        ? () => api.duplicateSeatingTable(event.id, item.one.id, newestOf(item.one).version)
        : () => api.duplicateSeatingRow(event.id, item.one.id, newestOf(item.one).version);

    void place(copying).then((copy) => {
      if (copy == null) return;
      open(
        {
          kind: item.kind,
          id: copy.id,
          said: t('seating.duplicated', {
            name: item.kind === 'row' ? t('seating.rowName', { label: copy.name }) : copy.name,
            of: itemName(t, item),
          }),
        },
        true,
      );
    });
  };

  const onItemKey = (event: ReactKeyboardEvent<SVGGElement>, item: FloorItem) => {
    if (readOnly || plan == null) return;
    const target = event.target as Element;

    if (!target.matches(ITEM)) return;
    const id = item.one.id;
    const chosen = chosenIds.includes(id);
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const arrow = arrows[event.key];

    if (arrow != null && party != null) {
      event.preventDefault();
      const order = inReadingOrder(floorItems(plan));
      const back = arrow[0] + arrow[1] < 0;
      const at = order.findIndex((one) => one.one.id === id);
      const next =
        at < 0
          ? order.at(back ? -1 : 0)
          : order[(at + (back ? -1 : 1) + order.length) % order.length];

      if (next != null)
        document
          .querySelector<SVGElement>(`.st-room [${itemAttribute(next.kind)}="${next.one.id}"]`)
          ?.focus();
      return;
    }
    if (arrow != null) {
      if (!chosen) return;
      event.preventDefault();
      const step = keyStep(system, event.shiftKey);
      const moving = chosenIds.flatMap((one) => itemOf(one) ?? []);
      const [mx, my] = shiftWithin(moving.map(footprintOf), plan, [
        arrow[0] * step,
        arrow[1] * step,
      ]);

      if (mx === 0 && my === 0) {
        keepClear(target);
        return;
      }
      keyed.current = id;
      arrange(
        moving.map((one) => ({
          ...placementOf(one),
          xCm: Math.round(one.one.xCm + mx),
          yCm: Math.round(one.one.yCm + my),
        })),
      );
      setHeard(
        t('seating.movedTo', {
          name: itemName(t, item),
          across: lengths(Math.round(item.one.xCm + mx)),
          down: lengths(Math.round(item.one.yCm + my)),
        }),
      );
      return;
    }
    if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey) {
      if (!chosen || chosenIds.length !== 1 || item.kind === 'seat') return;
      if (item.kind === 'table' && isRoundShape(item.one.shape)) return;
      event.preventDefault();
      const rotation = (item.one.rotation + SEATING_LIMITS.rotationStep) % 360;

      if (!insideRoom({ ...footprintOf(item), rotation }, plan)) {
        setNotice(t('seating.outside', { name: itemName(t, item) }));
        keepClear(target);
        return;
      }
      keyed.current = id;
      arrange([{ ...placementOf(item), rotation }]);
      setHeard(t('seating.turnedTo', { name: itemName(t, item), degrees: rotation }));
      return;
    }
    if ((event.key === 'd' || event.key === 'D') && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (chosen && chosenIds.length === 1) duplicate(item);
      else if (chosen && chosenIds.length > 1) duplicateStep();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && chosen && chosenIds.length > 1) {
      event.preventDefault();
      setAsking({ kind: 'deleteItems', ids: chosenIds });
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && chosen && chosenIds.length === 1) {
      event.preventDefault();
      setAsking({
        kind:
          item.kind === 'table' ? 'deleteTable' : item.kind === 'row' ? 'deleteRow' : 'deleteSeat',
        id,
      });
    }
  };

  const panWith = (event: ReactPointerEvent<Element>) => {
    const box = boxing.current;
    const fingers = touches.current.size > 1;

    if (box != null && fingers) {
      boxing.current = null;
      setBoxDrawn(null);
      setPanel(box.before.panel);
      setSeveral(box.before.several);
    }
    press.current = {
      from: [event.clientX, event.clientY],
      moved: false,
      fingers,
      pointer: event.pointerId,
    };
  };

  const joinsBox = (event: ReactPointerEvent<Element>) => {
    if (event.pointerType !== 'touch' || boxing.current == null || touches.current.size === 0)
      return false;
    touches.current.add(event.pointerId);
    dragged.current = true;
    panWith(event);
    return true;
  };

  const onItemDown = (event: ReactPointerEvent<Element>, item: FloorItem) => {
    if (joinsBox(event)) return;
    if (readOnly || placing != null || pickedGuest != null || event.button !== 0) return;
    dragged.current = false;
    const id = item.one.id;
    const ids = chosenIds.includes(id) && !event.shiftKey && !adding ? chosenIds : [id];

    drag.current = {
      kind: 'move',
      lead: id,
      from: [event.clientX, event.clientY],
      origins: ids.flatMap((one) => itemOf(one) ?? []),
      moved: false,
      pointer: event.pointerId,
      last: [],
    };
  };

  const onHandleDown = (
    event: ReactPointerEvent<SVGRectElement>,
    table: Table,
    pressed: Handle,
  ) => {
    if (joinsBox(event) || event.button !== 0) return;
    const at = toCm(event.clientX, event.clientY);
    const handle =
      at == null
        ? pressed
        : pressedHandle(
            table,
            pressed,
            turned([at[0] - table.xCm, at[1] - table.yCm], -table.rotation),
          );

    if (handle == null) onItemDown(event, { kind: 'table', one: table });
    else drag.current = { kind: 'resize', table, handle, pointer: event.pointerId, last: null };
  };

  const toCm = (clientX: number, clientY: number): [number, number] | null => {
    const box = canvasNode.current?.getBoundingClientRect();
    const { s, ox, oy } = where.current;

    return box == null ? null : [(clientX - box.left - ox) / s, (clientY - box.top - oy) / s];
  };

  useEffect(() => {
    const move = (pointer: PointerEvent) => {
      const now = drag.current;

      if (now == null || now.pointer !== pointer.pointerId || plan == null) return;
      if (now.kind === 'move') {
        const dx = pointer.clientX - now.from[0];
        const dy = pointer.clientY - now.from[1];
        const lead = now.origins.find((one) => one.one.id === now.lead);

        if (lead == null || (!now.moved && Math.hypot(dx, dy) < PAN_FROM_PX)) return;
        now.moved = true;
        const { s, snap: snapping } = where.current;
        const [mx, my] = shiftWithin(now.origins.map(footprintOf), plan, [
          snapToGrid(lead.one.xCm + dx / s, system, snapping) - lead.one.xCm,
          snapToGrid(lead.one.yCm + dy / s, system, snapping) - lead.one.yCm,
        ]);

        now.last = now.origins.map((one) => ({
          ...placementOf(one),
          xCm: Math.round(one.one.xCm + mx),
          yCm: Math.round(one.one.yCm + my),
        }));
        setPlacements((was) => ({
          ...was,
          ...Object.fromEntries(now.last.map((one) => [one.id, one])),
        }));
        setTip({
          id: now.lead,
          words: t('seating.tip', {
            across: lengths(Math.round(lead.one.xCm + mx)),
            down: lengths(Math.round(lead.one.yCm + my)),
          }),
        });
        return;
      }
      const at = toCm(pointer.clientX, pointer.clientY);

      if (at == null) return;
      const table = now.table;
      const [lx, ly] = turned([at[0] - table.xCm, at[1] - table.yCm], -table.rotation);
      const sized = (cm: number) =>
        Math.min(
          SEATING_LIMITS.tableSizeMaximumCm,
          Math.max(SEATING_LIMITS.tableSizeMinimumCm, Math.round(cm / SIZE_STEP_CM) * SIZE_STEP_CM),
        );
      const round = isRoundShape(table.shape);
      const across = now.handle.includes('e') || now.handle.includes('w');
      const along = now.handle.includes('n') || now.handle.includes('s');
      const widthCm = round
        ? sized(2 * Math.max(Math.abs(lx), Math.abs(ly)))
        : across
          ? sized(2 * Math.abs(lx))
          : table.widthCm;
      const lengthCm = round ? widthCm : along ? sized(2 * Math.abs(ly)) : table.lengthCm;
      const resized = { ...table, widthCm, lengthCm };

      if (!insideRoom(footprintOf({ kind: 'table', one: resized }), plan)) return;
      const placement: Placement = {
        ...placementOf({ kind: 'table', one: table }),
        widthCm,
        lengthCm,
      };

      now.last = placement;
      setPlacements((was) => ({ ...was, [table.id]: placement }));
      setTip({ id: table.id, words: tableSizeWords(t, locale, resized, system) });
    };
    const up = (pointer: PointerEvent) => {
      const now = drag.current;

      if (now == null || now.pointer !== pointer.pointerId) return;
      drag.current = null;
      setTip(null);
      if (now.kind === 'resize') {
        if (now.last != null) arrange([now.last]);
        return;
      }
      if (!now.moved) return;
      dragged.current = true;
      arrange(now.last);
      const lead = now.origins.find((one) => one.one.id === now.lead);

      if (lead != null && now.origins.length === 1 && !chosenIds.includes(now.lead))
        open({ kind: lead.kind, id: lead.one.id }, true);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  useEffect(() => {
    const move = (pointer: PointerEvent) => {
      const now = boxing.current;

      if (now == null || now.pointer !== pointer.pointerId || shown == null) return;
      if (
        !now.moved &&
        Math.hypot(pointer.clientX - now.at[0], pointer.clientY - now.at[1]) < PAN_FROM_PX
      )
        return;
      now.moved = true;
      const to = toCm(pointer.clientX, pointer.clientY);

      if (to == null) return;
      const box = rectOf(now.from, to);
      const hits = touchedBy(floorItems(shown), box);

      setBoxDrawn(box);
      pick([...now.base, ...hits.filter((id) => !now.base.includes(id))]);
    };
    const up = (pointer: PointerEvent) => {
      touches.current.delete(pointer.pointerId);
      const now = boxing.current;

      if (now == null || now.pointer !== pointer.pointerId) return;
      boxing.current = null;
      if (!now.moved) return;
      panned.current = true;
      setBoxDrawn(null);
      setHeard(t('seating.chosenCount', { count: chosenIds.length }));
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  useEffect(() => {
    const keys = () => setKeyboard(true);
    const pointer = () => setKeyboard(false);

    window.addEventListener('keydown', keys);
    window.addEventListener('pointerdown', pointer);
    return () => {
      window.removeEventListener('keydown', keys);
      window.removeEventListener('pointerdown', pointer);
    };
  }, []);

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
    note,
    keepNote: setNote,
    open,
    ask: setAsking,
    showOutside: setOutside,
    arrange,
    startPlacing,
  };
  const { addRow, addSeat } = useAddRowAndSeat(ctx);

  let canvas: ReactNode = null;
  let cards: ReactNode = null;

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
    const caption = roomCaption(
      plan.roomName,
      {
        line: (name) =>
          name == null
            ? t('seating.roomLineUnnamed', words)
            : t('seating.roomLine', { name, ...words }),
        cut: (name) => t('seating.roomNameCut', { name }),
      },
      ox,
      size.w,
    );
    const empty = plan.counts.tables + plan.counts.rows + plan.counts.singleSeats === 0;
    const drawn = shown ?? plan;
    const handled =
      !readOnly && tab === 'arrange' && shownPanel?.kind === 'table' && several.length < 2
        ? (drawn.tables.find((one) => one.id === shownPanel.id) ?? null)
        : null;
    const tipped = tip == null ? null : itemOf(tip.id, drawn);
    const columns = readWhole(grid.columns, COLUMNS_MAX);
    const gap = readGap(grid.gap, system, locale);
    const gridOutlines =
      fold === 'grid' && chosenItems.length > 1 && columns != null && gap != null && !readOnly
        ? outlinesOf(drawn, chosenItems, gridOf(chosenItems, columns, gap).moved)
        : [];

    const showChairTip = (shownTip: ChairTip | null) =>
      setChairTip(
        party == null || shownTip == null ? null : { pick: party.lead.id, tip: shownTip },
      );
    const pickBar: StepBar | null =
      party == null
        ? null
        : {
            tone: 'pick',
            words:
              party.companions.length === 0
                ? t('seating.pickOne', { name: party.lead.fullName ?? '' })
                : t('seating.pickParty', {
                    name: party.lead.fullName ?? '',
                    count: party.companions.length,
                  }),
            acts: [{ label: t('seating.cancel'), run: dropPick }],
          };
    const shownBar = bar ?? pickBar;

    cards = (
      <>
        <div className="st-view-wrap">
          {shownBar != null && <StepLine bar={shownBar} onUndo={undo} />}
          <TablesView
            plan={plan}
            section={cardSection}
            onSection={setCardSection}
            lit={(item) => chosenIds.includes(item.one.id) || shownBar?.lit === item.one.id}
            picking={party != null}
            moving={movingFrom}
            readOnly={readOnly}
            onCard={(item) =>
              party != null
                ? seatAt(item, item.kind === 'seat' ? 1 : null)
                : open({ kind: item.kind, id: item.one.id }, true)
            }
            onChair={(item, seat) => (party != null ? seatAt(item, seat) : pickSeated(item, seat))}
          />
        </div>
        {!readOnly && <SaveLine state={save} onTryAgain={tryAgain} />}
        {moveFrom != null && itemOf(moveFrom) != null && (
          <MoveAllPop
            plan={plan}
            from={itemOf(moveFrom)!}
            onMove={(to) => moveAll(itemOf(moveFrom)!, to)}
          />
        )}
      </>
    );

    canvas = (
      <>
        {empty && !readOnly && placing == null && bar == null ? (
          <div className="st-float st-bar is-tint is-floor" role="status" aria-live="polite">
            <Glyph name="info" size={17} weight={2.2} />
            <p>{t('seating.firstItem')}</p>
          </div>
        ) : (
          <div className="st-float st-under-views" ref={placeFloat}>
            {!readOnly && !empty && placing == null && party == null && (
              <ChooseBar
                plan={plan}
                adding={adding}
                kindMenu={kindMenu}
                onChoose={pick}
                onAdding={(on) => {
                  setAdding(on);
                  setKindMenu(false);
                }}
                onKindMenu={setKindMenu}
              />
            )}
            {shownBar != null && <StepLine bar={shownBar} onUndo={undo} />}
          </div>
        )}
        {moveFrom != null && itemOf(moveFrom) != null && (
          <MoveAllPop
            plan={plan}
            from={itemOf(moveFrom)!}
            onMove={(to) => moveAll(itemOf(moveFrom)!, to)}
          />
        )}
        {party != null && choice != null && itemOf(choice.id) != null && (
          <SeatChoicePop
            kind={choice.kind}
            name={choice.name}
            words={choice.words}
            go={choice.go}
            left={Math.max(16, ox + itemOf(choice.id)!.one.xCm * s - 165)}
            top={oy + boxOf(itemOf(choice.id)!).y1 * s + 12}
            onCancel={closeChoice}
          />
        )}
        <svg
          className="st-room"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          role="group"
          onMouseDown={(event) => {
            if (spaceHeld.current) event.preventDefault();
          }}
          onPointerDown={(event) => {
            panned.current = false;
            if (event.button !== 0 || !isFloor(event.target)) return;
            if (placing != null) {
              const at = toCm(event.clientX, event.clientY);

              if (at != null) void placeAt(at);
              return;
            }
            if (event.pointerType === 'touch') touches.current.add(event.pointerId);
            const at = toCm(event.clientX, event.clientY);

            if (!readOnly && !spaceHeld.current && touches.current.size < 2 && at != null) {
              boxing.current = {
                from: at,
                at: [event.clientX, event.clientY],
                base: event.shiftKey || adding ? chosenIds : [],
                before: { panel, several },
                moved: false,
                pointer: event.pointerId,
              };
              return;
            }
            panWith(event);
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
              else if (adding) setKindMenu(false);
              else if (several.length > 1) setSeveral([]);
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
          {inReadingOrder(floorItems(drawn)).map((item) => {
            const id = item.one.id;
            const lit = chosenIds.includes(id) || chosenItem === id;
            const outlined = (outside?.ids.includes(id) ?? false) || overlaps.has(id);
            const drawing =
              item.kind === 'table' ? (
                <TableDrawing
                  plan={drawn}
                  table={item.one}
                  s={s}
                  ox={ox}
                  oy={oy}
                  chosen={lit}
                  chosenSeat={
                    shownPanel?.kind === 'chair' && shownPanel.id === id ? shownPanel.seat : null
                  }
                  outside={outlined}
                  picking={party != null}
                  tinted={party != null && pointedAt === id}
                  onChairTip={showChairTip}
                  onChoose={() =>
                    party != null ? seatAt(item) : open({ kind: 'table', id }, true)
                  }
                  onChair={(seat) =>
                    party != null
                      ? seatAt(item, seat)
                      : pickFrom(item, seat) || open({ kind: 'chair', id, seat })
                  }
                />
              ) : item.kind === 'row' ? (
                <RowDrawing
                  plan={drawn}
                  row={item.one}
                  s={s}
                  ox={ox}
                  oy={oy}
                  chosen={lit}
                  chosenSeat={
                    shownPanel?.kind === 'row' && shownPanel.id === id
                      ? (shownPanel.seat ?? null)
                      : null
                  }
                  outside={outlined}
                  picking={party != null}
                  tinted={party != null && pointedAt === id}
                  onChairTip={showChairTip}
                  onChoose={() => (party != null ? seatAt(item) : open({ kind: 'row', id }, true))}
                  onChair={(seat) =>
                    party != null
                      ? seatAt(item, seat)
                      : pickFrom(item, seat) || open({ kind: 'row', id, seat })
                  }
                />
              ) : (
                <SingleSeatDrawing
                  plan={drawn}
                  seat={item.one}
                  s={s}
                  ox={ox}
                  oy={oy}
                  chosen={lit}
                  outside={outlined}
                  onChoose={() =>
                    party != null
                      ? seatAt(item, 1)
                      : pickFrom(item, 1) || open({ kind: 'seat', id }, true)
                  }
                />
              );

            return (
              <g
                key={id}
                className={readOnly ? undefined : 'st-movable'}
                onPointerDown={(event) => onItemDown(event, item)}
                onPointerEnter={() => setPointedAt(id)}
                onPointerLeave={() => setPointedAt((now) => (now === id ? null : now))}
                onClickCapture={(event) => {
                  if (dragged.current) {
                    dragged.current = false;
                    event.stopPropagation();
                  } else if ((event.shiftKey || adding) && !readOnly) {
                    event.stopPropagation();
                    toggle(id);
                  }
                }}
                onKeyDownCapture={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  if (!(event.target as Element).matches(ITEM)) return;
                  if (event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    spaceHeld.current = true;
                    if (!event.repeat) spaceOn.current = { id, shift: event.shiftKey };
                    return;
                  }
                  if ((event.shiftKey || adding) && !readOnly) {
                    event.preventDefault();
                    event.stopPropagation();
                    toggle(id);
                  }
                }}
                onKeyDown={(event) => onItemKey(event, item)}
                onFocus={(event) => {
                  if ((event.target as Element).matches(ITEM)) setFocusId(id);
                }}
                onBlur={() => setFocusId(null)}
              >
                {drawing}
              </g>
            );
          })}
          {gridOutlines.map((one) => (
            <rect
              key={`${one.x0}-${one.y0}`}
              className={one.amber ? 'st-outline is-amber' : 'st-outline'}
              x={ox + one.x0 * s}
              y={oy + one.y0 * s}
              width={(one.x1 - one.x0) * s}
              height={(one.y1 - one.y0) * s}
              aria-hidden="true"
            />
          ))}
          {boxDrawn != null && (
            <rect
              className="st-box-drawn"
              x={ox + boxDrawn.x0 * s}
              y={oy + boxDrawn.y0 * s}
              width={(boxDrawn.x1 - boxDrawn.x0) * s}
              height={(boxDrawn.y1 - boxDrawn.y0) * s}
              aria-hidden="true"
            />
          )}
          {handled != null && (
            <TableHandles
              table={handled}
              s={s}
              ox={ox}
              oy={oy}
              onDown={(event, handle) => onHandleDown(event, handled, handle)}
            />
          )}
          {party != null &&
            freeTags(drawn, floorItems(drawn), s, ox, oy, (n) => freeTagWords(t, n)).map((tag) => (
              <FreeTag key={`free-${tag.id}`} x={tag.x} y={tag.y} n={tag.n} />
            ))}
          {party != null && chairTip?.pick === party.lead.id && s >= CHAIRS_FROM_SCALE && (
            <ChairTipDrawing tip={chairTip.tip} width={size.w} cover={cover} />
          )}
          {tipped != null && tip != null && (
            <Tip
              x={ox + tipped.one.xCm * s + 26}
              y={oy + tipped.one.yCm * s + 30}
              words={tip.words}
            />
          )}
          <text
            className="st-room-line"
            x={caption.x}
            y={oy - 14}
            dominantBaseline="central"
            aria-hidden="true"
          >
            {caption.text}
          </text>
        </svg>
        {!readOnly && <SaveLine state={save} onTryAgain={tryAgain} />}
        {placing != null && (
          <PlacingBars
            placing={placing}
            another={another}
            onAnother={setAnother}
            onCentre={() => void placeAt([(size.w / 2 - ox) / s, (size.h / 2 - oy) / s])}
            onStop={() => setPlacing(null)}
          />
        )}
        {keysShown && <KeysStrip system={system} />}
        {adding && !readOnly && <RulesStrip />}
        <p className="visually-hidden" aria-live="polite">
          {heard}
        </p>
        {!readOnly && (
          <AddTable
            ctx={ctx}
            floor={size.w}
            placing={placing != null}
            onRow={addRow}
            onSeat={addSeat}
          />
        )}
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
  else if (several.length > 1)
    body = (
      <>
        {notice != null && <Said>{notice}</Said>}
        <SelectionPanel
          plan={shown ?? plan}
          system={system}
          items={chosenItems}
          adding={adding}
          fold={fold}
          onFold={setFold}
          grid={grid}
          onGrid={setGrid}
          steps={steps}
        />
      </>
    );
  else if (shownPanel?.kind === 'table' || shownPanel?.kind === 'chair') {
    const table = (shown ?? plan).tables.find((one) => one.id === shownPanel.id);

    body =
      table == null ? null : shownPanel.kind === 'table' ? (
        <TablePanel
          key={`${table.id}-${reloads}`}
          ctx={ctx}
          plan={shown ?? plan}
          table={table}
          said={shownPanel.said}
        />
      ) : (
        <ChairPanel ctx={ctx} plan={plan} table={table} seat={shownPanel.seat} />
      );
  } else if (shownPanel?.kind === 'row') {
    const row = (shown ?? plan).rows.find((one) => one.id === shownPanel.id);

    body =
      row == null ? null : (
        <RowPanel
          key={`${row.id}-${reloads}`}
          ctx={ctx}
          plan={shown ?? plan}
          row={row}
          said={shownPanel.said}
          seat={shownPanel.seat ?? null}
        />
      );
  } else if (shownPanel?.kind === 'seat') {
    const seat = (shown ?? plan).singleSeats.find((one) => one.id === shownPanel.id);

    body =
      seat == null ? null : (
        <SingleSeatPanel
          key={`${seat.id}-${reloads}`}
          ctx={ctx}
          plan={shown ?? plan}
          seat={seat}
          said={shownPanel.said}
        />
      );
  } else
    body = (
      <>
        <RoomHead ctx={ctx} plan={plan} />
        <ShareTables ctx={ctx} plan={plan} />
        {notice != null && <Said>{notice}</Said>}
        {readOnly ? (
          <Line>{t('seating.readOnly')}</Line>
        ) : (
          <SnapToGrid on={snap} onChange={setSnap} />
        )}
        <SectionsBlock
          ctx={ctx}
          plan={plan}
          refused={sectionsRefused}
          onRefused={() => setSectionsRefused(true)}
        />
      </>
    );

  function seatBody(plan: SeatingPlan) {
    const trayOf = (chips: boolean) => (
      <SeatTray
        plan={plan}
        filter={tray}
        onFilter={setTray}
        picked={pickedGuest}
        onPick={pickGuest}
        readOnly={readOnly}
        chips={chips}
      />
    );
    const shownPlace =
      party == null &&
      (shownPanel?.kind === 'table' || shownPanel?.kind === 'chair' || shownPanel?.kind === 'row')
        ? shownPanel.id
        : null;
    const item = itemOf(movingFrom?.id ?? shownPlace ?? '');

    if (item == null || item.kind === 'seat') return trayOf(true);
    return (
      <PlaceGuests
        plan={plan}
        item={item}
        readOnly={readOnly}
        movingSeat={movingFrom?.seat ?? null}
        onPickSeated={pickSeated}
        tray={trayOf(false)}
        onUnseatAll={unseatAll}
        onMoveAll={(from) => setMoveFrom(from.one.id)}
        onRename={rename}
      />
    );
  }

  return (
    <LayersContext value={layers}>
      <RingsContext value={rings}>
        <div className="st-main" inert={covered}>
          <div
            className={`${
              seatingView === 'tables' && plan != null ? 'st-canvas is-tables' : 'st-canvas is-plan'
            }${rowDown ? ' is-row-down' : ''}`}
            ref={(node) => {
              canvasNode.current = node;
              placeCanvas(node);
            }}
          >
            {seatingView === 'tables' && plan != null ? cards : canvas}
            {plan != null && (
              <ViewSwitch
                view={seatingView}
                onView={(view) => {
                  dropChoice();
                  setSeatingView(view);
                }}
              />
            )}
          </div>
          <aside className="st-panel" aria-label={t('seating.panel')}>
            {plan != null && shownPanel?.kind !== 'start' && (
              <div className="st-tabs" role="tablist" aria-label={t('seating.panel')}>
                {(['arrange', 'seat'] as const).map((one) => (
                  <button
                    key={one}
                    type="button"
                    role="tab"
                    id={`st-tab-${one}`}
                    aria-selected={tab === one}
                    aria-controls="st-panel-body"
                    className={tab === one ? 'st-tab is-on' : 'st-tab'}
                    onClick={() => {
                      setTab(one);
                      if (one === 'arrange') dropPick();
                    }}
                  >
                    {t(one === 'arrange' ? 'seating.arrangeTab' : 'seating.seatTab')}
                  </button>
                ))}
              </div>
            )}
            <div
              className="st-panel-body"
              id="st-panel-body"
              role={plan != null && shownPanel?.kind !== 'start' ? 'tabpanel' : undefined}
              aria-labelledby={
                plan != null && shownPanel?.kind !== 'start' ? `st-tab-${tab}` : undefined
              }
            >
              {tab === 'seat' && plan != null && shownPanel?.kind !== 'start'
                ? seatBody(plan)
                : body}
            </div>
          </aside>
        </div>
        <div ref={setHost} className="desk-layers" />
        {asking?.kind === 'deleteItems' && plan != null && (
          <DeleteItemsAsk
            items={asking.ids.flatMap((id) => itemOf(id) ?? [])}
            onKeep={() => setAsking(null)}
            onGo={(items) => {
              setAsking(null);
              deleteStep(items);
            }}
          />
        )}
        {asking != null && asking.kind !== 'deleteItems' && plan != null && (
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
      </RingsContext>
    </LayersContext>
  );
}

/** A short party or a taken chair waiting on the host's answer under its table (sc-5030). */
interface SeatChoice {
  kind: 'short' | 'swap';
  id: string;
  attribute: string;
  name: string;
  words: string;
  go: { label: string; run: () => void };
}

function itemAttribute(kind: Panel['kind']): string | null {
  return kind === 'table' || kind === 'chair'
    ? 'data-table'
    : kind === 'row'
      ? 'data-row'
      : kind === 'seat'
        ? 'data-seat'
        : null;
}

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('input, textarea, select') != null;
}

function control(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a[href], [role="menuitem"], [role="option"], summary') != null
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

/** The bars whose showing or growing pans the plan for a focused item: the small map comes only with a zoom, and a zoom never pans (sc-61042). */
const BY_KEYS_BAR = '.st-float:not(.st-minimap)';

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

/** What a delete does to the guests seated in what it deletes (sc-4013). */
function seatedHereWords(
  t: ReturnType<typeof useTranslation>['t'],
  seated: readonly { guestId: string }[],
): string {
  return seated.length === 0
    ? t('seating.nobodyHere')
    : t('seating.seatedHereGoBack', { count: seated.length });
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

  if (asking.kind === 'deleteItems') return null;
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
        line={seatedHereWords(t, table.seated)}
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
        line={seatedHereWords(t, (row ?? seat)?.seated ?? [])}
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
