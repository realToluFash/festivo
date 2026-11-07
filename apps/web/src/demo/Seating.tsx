import {
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { clockOf, sampleEvent, type SampleEvent } from './events.ts';
import { Icon, type IconName } from './SeatingGlyph.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import {
  type Item,
  type Kind,
  type Party,
  type Person,
  type Plan,
  type Point,
  AT_100,
  EVENT_ID,
  PRIYA,
  SW,
  ZOOMS,
  bounds,
  copyOf,
  detailOf,
  filled,
  firstFree,
  fitOf,
  free,
  isTable,
  itemName,
  lengthOf,
  many,
  nearestFree,
  newItem,
  overlap,
  peopleIn,
  percentOf,
  planCounts,
  readingOrder,
  say,
  seatAt as seatChairs,
  seatingStateOf,
  sectionLine,
  snapTo,
  turn,
  turns,
  usable,
} from './seating.ts';
import { SeatingContext, type SeatingApi, useSeating } from './seatingContext.ts';
import {
  type Pop,
  type Ui,
  freshUi,
  pickWords,
  seated,
  seatedWords,
  seedOf,
} from './seatingSeed.ts';
import { SeatingPanel, ShapeTile } from './SeatingPanel.tsx';
import { PaperPage, PrintPanel } from './SeatingPrint.tsx';
import { type Handle, type Look, MiniMap, RoomDrawing } from './SeatingRoom.tsx';
import { ListView, TablesView } from './SeatingViews.tsx';
import { DemoBell } from './DemoBell.tsx';
import { Ask, CardStep, Mark, OnCard, Says } from '../components/SettingsParts.tsx';
import { useSwitcherStart } from './switcher.ts';
import type { Tell } from '../components/SettingsParts.tsx';
import './seating.css';

const SAVE_MS = 700;
const LOAD_MS = 1800;
const PRINT_MS = 1500;
const ARRIVES_MS = 1500;
const DEFAULT_SIZE = { w: 718, h: 719 };

/** Seating at a desk in A · The room (page e31, Seating-A-Desk-1 to -4): the room is the page, the panel at its right. */
export function SeatingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <SeatingAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function SeatingAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState<Ui>(() => {
    const seeded = seedOf(seatingStateOf(raw));

    return event?.id === EVENT_ID
      ? seeded
      : { ...freshUi(), plan: { room: null, items: [], sections: [] }, tray: [], people: [] };
  });

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (first.paper != null) return <PaperPage paper={first.paper} plan={first.plan} />;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area="seating"
          now={clockOf(null)}
          tell={tell}
          inert={covered}
          waiting={event.id === EVENT_ID ? waitingLine(keptInbox()) : null}
        />
      )}
    >
      {(tell) => <Seating first={first} event={event} tell={tell} />}
    </EventsShell>
  );
}

function useSize(): [(node: HTMLDivElement | null) => void, { w: number; h: number }] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);

  useLayoutEffect(() => {
    if (node == null) return;
    const measure = () => {
      const box = node.getBoundingClientRect();

      if (box.width > 0 && box.height > 0)
        setSize({ w: Math.round(box.width), h: Math.round(box.height) });
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);

    watch.observe(node);
    return () => watch.disconnect();
  }, [node]);

  return [setNode, size];
}

type Press =
  | {
      kind: 'drag';
      ids: string[];
      lead: string;
      from: Point;
      origins: Record<string, Point>;
      moved: boolean;
      shift: boolean;
      pointer: number;
    }
  | { kind: 'resize'; id: string; handle: Handle; item: Item; moved: boolean; pointer: number }
  | { kind: 'pan'; from: Point; cx: number; cy: number; moved: boolean; pointer: number }
  | { kind: 'click'; id: string; shift: boolean; pointer: number }
  | { kind: 'seat'; id: string; pointer: number };

function keyStep(units: 'metric' | 'us', big: boolean): number {
  if (units === 'us') return big ? 30.48 : 7.62;
  return big ? 100 : 10;
}

function shapeWords(kind: Kind): string {
  return {
    round: 'round table',
    rect: 'rectangular table',
    head: 'head table',
    cocktail: 'cocktail table',
    row: 'row',
    single: 'single seat',
  }[kind];
}

function Seating({ first, event, tell }: { first: Ui; event: SampleEvent; tell: Tell }) {
  const [ui, setUi] = useState<Ui>(first);
  const [setCanvas, size] = useSize();
  const canvas = useRef<HTMLDivElement | null>(null);
  const press = useRef<Press | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(first.focus?.startsWith('item:') === true);
  const [placingAt, setPlacingAt] = useState<Point | null>(
    first.ghost != null && first.placing != null ? [first.ghost.x, first.ghost.y] : null,
  );
  const ui$ = useRef(ui);

  ui$.current = ui;
  const room = ui.plan.room;
  const fit = room == null ? { s: 0.3, ox: 0, oy: 0 } : fitOf(size.w, size.h, room);
  const s = ui.camera?.s ?? fit.s;
  const ox = ui.camera == null ? fit.ox : size.w / 2 - ui.camera.cx * s;
  const oy = ui.camera == null ? fit.oy : size.h / 2 - ui.camera.cy * s;
  const detail = detailOf(s);
  const set = useCallback((change: (now: Ui) => Ui) => setUi(change), []);
  const placeCanvas = useCallback(
    (node: HTMLDivElement | null) => {
      canvas.current = node;
      setCanvas(node);
    },
    [setCanvas],
  );

  useEffect(() => {
    if (ui.save !== 'saving') return;
    const done = window.setTimeout(
      () => set((now) => (now.save === 'saving' ? { ...now, save: 'saved' } : now)),
      SAVE_MS,
    );

    return () => window.clearTimeout(done);
  }, [ui.save, ui.plan, set]);

  useEffect(() => {
    if (ui.load !== 'loading') return;
    const done = window.setTimeout(
      () => set((now) => ({ ...now, load: 'ready', people: [PRIYA] })),
      LOAD_MS,
    );

    return () => window.clearTimeout(done);
  }, [ui.load, set]);

  useEffect(() => {
    const making = (Object.keys(ui.print.docs) as (keyof Ui['print']['docs'])[]).filter(
      (key) => ui.print.docs[key] === 'preparing',
    );

    if (making.length === 0) return;
    const done = window.setTimeout(
      () =>
        set((now) => ({
          ...now,
          print: {
            ...now.print,
            docs: { ...now.print.docs, ...Object.fromEntries(making.map((key) => [key, 'done'])) },
          },
        })),
      PRINT_MS,
    );

    return () => window.clearTimeout(done);
  }, [ui.print.docs, set]);

  useEffect(() => {
    const colleague = ui.colleague;

    if (colleague == null) return;
    const arrive = window.setTimeout(
      () =>
        set((now) => ({
          ...now,
          colleague: null,
          rings: { ...now.rings, [colleague.id]: PRIYA },
          plan: {
            ...now.plan,
            items: now.plan.items.map((item) =>
              item.id === colleague.id ? { ...item, x: colleague.at[0], y: colleague.at[1] } : item,
            ),
          },
        })),
      ARRIVES_MS,
    );

    return () => window.clearTimeout(arrive);
  }, [ui.colleague, set]);

  useEffect(() => {
    const target = first.focus;

    if (target == null) return;
    window.setTimeout(() => {
      const selector = target.startsWith('item:')
        ? `[data-item="${target.slice(5)}"]`
        : `[data-focus="${target}"]`;

      document.querySelector<HTMLElement | SVGElement>(selector)?.focus();
    }, 0);
  }, [first.focus]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Tab') setKeyboard(true);
    };
    const pointer = () => setKeyboard(false);

    window.addEventListener('keydown', down);
    window.addEventListener('pointerdown', pointer);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('pointerdown', pointer);
    };
  }, []);

  const say$ = useCallback(
    (words: string) => {
      set((now) => ({ ...now, spoken: '' }));
      window.setTimeout(() => set((now) => ({ ...now, spoken: words })), 60);
    },
    [set],
  );

  const commit = useCallback<SeatingApi['commit']>(
    (id, change, after = {}) =>
      set((now) => {
        if (now.readOnly) return now;
        const contest = now.contest;

        // presenceBoth: Priya Shah's save lands first, so your next change to Table 7 is refused (sc-4719).
        if (id != null && contest?.id === id) {
          const item = now.plan.items.find((one) => one.id === id);

          return {
            ...now,
            contest: null,
            ghost: null,
            tip: null,
            bar: {
              kind: 'amber',
              words: say(SW.moved, { name: contest.by, table: item?.name ?? '' }),
            },
            plan: {
              ...now.plan,
              items: now.plan.items.map((one) =>
                one.id === id ? { ...one, x: contest.at[0], y: contest.at[1] } : one,
              ),
            },
          };
        }
        return {
          ...now,
          plan: change(now.plan),
          save: now.save === 'retrying' ? 'retrying' : 'saving',
          bar: now.bar?.kind === 'undo' || now.bar?.kind === 'amber' ? null : now.bar,
          undo: null,
          ghost: null,
          tip: null,
          ...after,
        };
      }),
    [set],
  );

  const edit = useCallback<SeatingApi['edit']>(
    (id, change, after) =>
      commit(
        id,
        (plan) => ({
          ...plan,
          items: plan.items.map((item) => (item.id === id ? { ...item, ...change } : item)),
        }),
        { notice: null, ...after },
      ),
    [commit],
  );

  const choose = useCallback(
    (ids: string[]) =>
      set((now) => ({
        ...now,
        chosen: ids,
        chair: null,
        panel: null,
        seed: null,
        notice: null,
        note: null,
        menu: false,
        pop: null,
        sectionsRefused: false,
        bar: now.bar?.kind === 'amber' ? null : now.bar,
      })),
    [set],
  );

  const pick = useCallback(
    (id: string | null) =>
      set((now) => {
        const party = now.tray.find((one) => one.id === id);

        return {
          ...now,
          picked: party?.id ?? null,
          chosen: [],
          chair: null,
          pop: null,
          hover: null,
          bar: party == null ? null : { kind: 'tint', words: pickWords(party), does: 'pick' },
        };
      }),
    [set],
  );

  const seatAt = useCallback(
    (tableId: string, chair?: number) =>
      set((now) => {
        const party = now.tray.find((one) => one.id === now.picked);
        const item = now.plan.items.find((one) => one.id === tableId);

        if (party == null || item == null) return now;
        const n = peopleIn(party);
        const at = chair == null ? null : item.chairs[chair];

        if (at != null && at.state === 'taken' && n === 1 && chair != null)
          return { ...now, pop: { kind: 'swap', table: tableId, chair, party: party.id } };
        if (free(item) === 0)
          return {
            ...now,
            hover: null,
            bar: { kind: 'amber', words: say(SW.full, { table: item.name }) },
          };
        if (free(item) < n)
          return {
            ...now,
            hover: tableId,
            pop: { kind: 'short', table: tableId, party: party.id },
          };
        let next: { plan: Plan; tray: Party[]; apart: boolean };

        if (chair != null && at?.state === 'empty') {
          const chairs = firstFree(item, n, chair);

          next = {
            plan: {
              ...now.plan,
              items: now.plan.items.map((one) =>
                one.id === tableId ? seatChairs(one, party, chairs) : one,
              ),
            },
            tray: now.tray.filter((one) => one.id !== party.id),
            apart: chairs.some(
              (index, k) => k > 0 && index !== (chairs[k - 1]! + 1) % item.chairs.length,
            ),
          };
        } else next = seated(now.plan, now.tray, party.id, tableId);
        return {
          ...now,
          plan: next.plan,
          tray: next.tray,
          picked: null,
          pop: null,
          hover: tableId,
          save: now.save === 'retrying' ? 'retrying' : 'saving',
          undo: { plan: now.plan, tray: now.tray },
          bar: { kind: 'undo', words: seatedWords(party, item.name, next.apart), does: 'undo' },
        };
      }),
    [set],
  );

  const seatJust = useCallback(
    (partyId: string, tableId: string) =>
      set((now) => {
        const party = now.tray.find((one) => one.id === partyId);
        const item = now.plan.items.find((one) => one.id === tableId);

        if (party == null || item == null) return now;
        const lead: Party = { ...party, companions: [] };
        const rest: Party = { ...party, behind: true };

        return {
          ...now,
          plan: {
            ...now.plan,
            items: now.plan.items.map((one) =>
              one.id === tableId ? seatChairs(one, lead, firstFree(one, 1)) : one,
            ),
          },
          tray: now.tray.map((one) => (one.id === partyId ? rest : one)),
          picked: null,
          pop: null,
          save: 'saving',
          undo: { plan: now.plan, tray: now.tray },
          bar: {
            kind: 'undo',
            words: say(SW.seatedOne, { name: party.name, table: item.name }),
            does: 'undo',
          },
        };
      }),
    [set],
  );

  const swap = useCallback(
    (tableId: string, chair: number, partyId: string) =>
      set((now) => {
        const party = now.tray.find((one) => one.id === partyId);
        const item = now.plan.items.find((one) => one.id === tableId);
        const was = item?.chairs[chair];

        if (party == null || item == null || was?.who == null) return now;
        const moved: Party = {
          id: `back-${was.who}`,
          name: was.who,
          companions: [],
          group: null,
          reply: 'coming',
        };

        return {
          ...now,
          plan: {
            ...now.plan,
            items: now.plan.items.map((one) =>
              one.id === tableId ? seatChairs(one, party, [chair]) : one,
            ),
          },
          tray: [...now.tray.filter((one) => one.id !== partyId), moved],
          picked: null,
          pop: null,
          hover: tableId,
          save: 'saving',
          undo: { plan: now.plan, tray: now.tray },
          bar: {
            kind: 'undo',
            words: say(SW.seatedOne, { name: party.name, table: item.name }),
            does: 'undo',
          },
        };
      }),
    [set],
  );

  const unseatAll = useCallback(
    (tableId: string) =>
      set((now) => {
        const item = now.plan.items.find((one) => one.id === tableId);

        if (item == null) return now;
        const back: Party[] = item.chairs
          .filter((chair) => chair.state === 'taken' && chair.who != null)
          .map((chair) => ({
            id: `back-${chair.who}`,
            name: chair.who!,
            companions: [],
            group: null,
            reply: 'coming',
          }));

        return {
          ...now,
          plan: {
            ...now.plan,
            items: now.plan.items.map((one) =>
              one.id === tableId
                ? {
                    ...one,
                    chairs: one.chairs.map((chair) =>
                      chair.state === 'taken' ? { state: 'empty' } : chair,
                    ),
                  }
                : one,
            ),
          },
          tray: [...now.tray, ...back],
          save: 'saving',
          hover: tableId,
          undo: { plan: now.plan, tray: now.tray },
          bar: { kind: 'undo', words: say(SW.tableEmpty, { table: item.name }), does: 'undo' },
        };
      }),
    [set],
  );

  const moveAll = useCallback(
    (from: string, to: string) =>
      set((now) => {
        const source = now.plan.items.find((one) => one.id === from);
        const target = now.plan.items.find((one) => one.id === to);

        if (source == null || target == null) return now;
        const who = source.chairs.filter((chair) => chair.state === 'taken');
        const places = firstFree(target, who.length);

        return {
          ...now,
          plan: {
            ...now.plan,
            items: now.plan.items.map((one) =>
              one.id === from
                ? {
                    ...one,
                    chairs: one.chairs.map((chair) =>
                      chair.state === 'taken' ? { state: 'empty' } : chair,
                    ),
                  }
                : one.id === to
                  ? {
                      ...one,
                      chairs: one.chairs.map((chair, index) =>
                        places.includes(index) ? (who[places.indexOf(index)] ?? chair) : chair,
                      ),
                    }
                  : one,
            ),
          },
          pop: null,
          hover: to,
          chosen: [to],
          save: 'saving',
          undo: { plan: now.plan, tray: now.tray },
          bar: {
            kind: 'undo',
            words: many('movedAll', who.length, { table: target.name }),
            does: 'undo',
          },
        };
      }),
    [set],
  );

  const duplicate = useCallback(
    (id: string) =>
      set((now) => {
        const item = now.plan.items.find((one) => one.id === id);

        if (item == null || now.plan.room == null || now.readOnly) return now;
        const copy = copyOf(item, now.plan.items, now.plan.room);
        const words = say(SW.duplicated, { name: copy.name, of: item.name });

        window.setTimeout(
          () => document.querySelector<SVGElement>(`[data-item="${copy.id}"]`)?.focus(),
          0,
        );
        return {
          ...now,
          plan: { ...now.plan, items: [...now.plan.items, copy] },
          chosen: [copy.id],
          chair: null,
          notice: { tone: 'green', words },
          spoken: words,
          save: 'saving',
        };
      }),
    [set],
  );

  const markChair = useCallback(
    (id: string, index: number) =>
      set((now) => {
        const item = now.plan.items.find((one) => one.id === id);
        const chair = item?.chairs[index];

        if (item == null || chair == null) return now;
        if (chair.state === 'taken' || chair.state === 'held')
          return {
            ...now,
            notice: { tone: 'amber', words: say(SW.chairTaken, { name: chair.who ?? SW.held }) },
          };
        return {
          ...now,
          notice: null,
          save: 'saving',
          plan: {
            ...now.plan,
            items: now.plan.items.map((one) =>
              one.id === id
                ? {
                    ...one,
                    chairs: one.chairs.map((each, k) =>
                      k === index
                        ? { state: chair.state === 'unusable' ? 'empty' : 'unusable' }
                        : each,
                    ),
                  }
                : one,
            ),
          },
        };
      }),
    [set],
  );

  const focusField = useCallback((key: string) => {
    window.setTimeout(
      () => document.querySelector<HTMLElement>(`[data-focus="${key}"]`)?.focus(),
      0,
    );
  }, []);

  const api = useMemo<SeatingApi>(
    () => ({
      ui,
      set,
      commit,
      edit,
      choose,
      open: (mode) =>
        set((now) => ({
          ...now,
          panel: mode,
          chosen: [],
          chair: null,
          seed: null,
          sectionsRefused: false,
          shrink: null,
          menu: false,
        })),
      ask: (asking) => set((now) => ({ ...now, asking })),
      pick,
      seatAt,
      seatJust,
      swap,
      unseatAll,
      moveAll,
      duplicate,
      markChair,
      focusField,
      tell,
    }),
    [
      ui,
      set,
      commit,
      edit,
      choose,
      pick,
      seatAt,
      seatJust,
      swap,
      unseatAll,
      moveAll,
      duplicate,
      markChair,
      focusField,
      tell,
    ],
  );

  function toCm(clientX: number, clientY: number): Point {
    const box = canvas.current?.getBoundingClientRect();

    return [(clientX - (box?.left ?? 0) - ox) / s, (clientY - (box?.top ?? 0) - oy) / s];
  }

  function place(at: Point): void {
    set((now) => {
      if (now.placing == null || now.plan.room == null) return now;
      const draft = newItem(now.placing.kind, now.plan.items, at);
      const [x, y] = nearestFree(draft, now.plan.items, now.plan.room, [
        snapTo(at[0], now.units, now.snap),
        snapTo(at[1], now.units, now.snap),
      ]);
      const item = { ...draft, x, y };

      return {
        ...now,
        plan: { ...now.plan, items: [...now.plan.items, item] },
        chosen: [item.id],
        notice: { tone: 'green', words: say(SW.added, { name: item.name }) },
        save: 'saving',
        placing: now.placing.another ? now.placing : null,
        bar: now.placing.another ? now.bar : null,
        ghost: null,
      };
    });
    if (!ui.placing?.another) setPlacingAt(null);
  }

  function placeAtCentre(): void {
    set((now) => {
      if (now.placing == null || now.plan.room == null) return now;
      const centre: Point = [now.plan.room.w / 2, now.plan.room.l / 2];
      const draft = newItem(now.placing.kind, now.plan.items, centre);
      const [x, y] = nearestFree(draft, now.plan.items, now.plan.room, centre);
      const item = { ...draft, x, y };

      return {
        ...now,
        plan: { ...now.plan, items: [...now.plan.items, item] },
        chosen: [item.id],
        notice: { tone: 'green', words: say(SW.added, { name: item.name }) },
        save: 'saving',
        placing: now.placing.another ? now.placing : null,
        bar: now.placing.another ? now.bar : null,
      };
    });
  }

  function addNow(kind: 'row' | 'single'): void {
    set((now) => {
      if (now.plan.room == null) return now;
      const draft = newItem(kind, now.plan.items, [now.plan.room.w / 2, now.plan.room.l / 2]);
      const [x, y] = nearestFree(draft, now.plan.items, now.plan.room, [
        now.plan.room.w / 2,
        now.plan.room.l / 2,
      ]);
      const item = { ...draft, x, y };
      const words =
        kind === 'row'
          ? say(SW.rowAdded, { label: item.label ?? '', n: item.chairs.length })
          : say(SW.added, { name: item.name });

      return {
        ...now,
        plan: { ...now.plan, items: [...now.plan.items, item] },
        chosen: [item.id],
        chair: null,
        panel: null,
        tab: 'arrange',
        notice: { tone: 'green', words },
        save: 'saving',
        menu: false,
        bar: null,
      };
    });
  }

  function startPlacing(kind: Kind): void {
    set((now) => ({
      ...now,
      menu: false,
      placing: { kind, another: true },
      chosen: [],
      panel: null,
      tab: 'arrange',
      bar: { kind: 'tint', words: say(SW.placing, { shape: shapeWords(kind) }), does: 'placing' },
    }));
  }

  function stopPlacing(): void {
    setPlacingAt(null);
    set((now) => ({
      ...now,
      placing: null,
      ghost: null,
      bar: now.bar?.does === 'placing' ? null : now.bar,
    }));
  }

  function onItemDown(event: ReactPointerEvent<SVGGElement>, id: string): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (ui.placing != null) {
      place(toCm(event.clientX, event.clientY));
      return;
    }
    if (ui.picked != null) {
      press.current = { kind: 'seat', id, pointer: event.pointerId };
      return;
    }
    if (ui.readOnly) {
      press.current = { kind: 'click', id, shift: event.shiftKey, pointer: event.pointerId };
      return;
    }
    const ids = ui.chosen.includes(id) && !event.shiftKey ? ui.chosen : [id];
    const origins = Object.fromEntries(
      ui.plan.items
        .filter((item) => ids.includes(item.id))
        .map((item) => [item.id, [item.x, item.y] as Point]),
    );

    press.current = {
      kind: 'drag',
      ids,
      lead: id,
      from: [event.clientX, event.clientY],
      origins,
      moved: false,
      shift: event.shiftKey,
      pointer: event.pointerId,
    };
  }

  function onHandleDown(
    event: ReactPointerEvent<SVGRectElement>,
    id: string,
    handle: Handle,
  ): void {
    const item = ui.plan.items.find((one) => one.id === id);

    if (item == null || event.button !== 0) return;
    press.current = { kind: 'resize', id, handle, item, moved: false, pointer: event.pointerId };
  }

  function onFloor(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.button !== 0) return;
    if (ui.placing != null) {
      place(toCm(event.clientX, event.clientY));
      return;
    }
    press.current = {
      kind: 'pan',
      from: [event.clientX, event.clientY],
      cx: (size.w / 2 - ox) / s,
      cy: (size.h / 2 - oy) / s,
      moved: false,
      pointer: event.pointerId,
    };
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const now = press.current;

      if (ui$.current.placing != null && canvas.current != null) {
        const at = toCmLive(event.clientX, event.clientY);

        if (at != null)
          setPlacingAt([
            snapTo(at[0], ui$.current.units, ui$.current.snap),
            snapTo(at[1], ui$.current.units, ui$.current.snap),
          ]);
      }
      if (now == null || now.pointer !== event.pointerId) return;
      if (now.kind === 'drag') {
        const dx = event.clientX - now.from[0];
        const dy = event.clientY - now.from[1];

        if (!now.moved && Math.hypot(dx, dy) < 4) return;
        now.moved = true;
        dragTo(now, dx, dy);
      } else if (now.kind === 'resize') {
        now.moved = true;
        resizeTo(now, event.clientX, event.clientY);
      } else if (now.kind === 'pan') {
        const dx = event.clientX - now.from[0];
        const dy = event.clientY - now.from[1];

        if (!now.moved && Math.hypot(dx, dy) < 4) return;
        now.moved = true;
        set((ui_) => ({
          ...ui_,
          camera: {
            s: sRef.current,
            cx: now.cx - dx / sRef.current,
            cy: now.cy - dy / sRef.current,
          },
        }));
      }
    };
    const up = (event: PointerEvent) => {
      const now = press.current;

      if (now == null || now.pointer !== event.pointerId) return;
      press.current = null;
      if (now.kind === 'drag') {
        if (now.moved) settle(now.ids, now.lead);
        else if (now.shift)
          set((ui_) => ({
            ...ui_,
            chosen: ui_.chosen.includes(now.lead)
              ? ui_.chosen.filter((one) => one !== now.lead)
              : [...ui_.chosen, now.lead],
            chair: null,
            notice: null,
            panel: null,
          }));
        else choose([now.lead]);
      } else if (now.kind === 'resize') {
        if (now.moved) settle([now.id], now.id);
      } else if (now.kind === 'pan') {
        if (!now.moved) {
          set((ui_) => ({
            ...ui_,
            chosen: [],
            chair: null,
            menu: false,
            pop: null,
            notice: null,
            note: null,
          }));
        }
      } else if (now.kind === 'click') choose([now.id]);
      else seatAt(now.id);
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

  const sRef = useRef(s);
  const oRef = useRef<Point>([ox, oy]);

  sRef.current = s;
  oRef.current = [ox, oy];

  function toCmLive(clientX: number, clientY: number): Point | null {
    const box = canvas.current?.getBoundingClientRect();

    if (box == null) return null;
    return [
      (clientX - box.left - oRef.current[0]) / sRef.current,
      (clientY - box.top - oRef.current[1]) / sRef.current,
    ];
  }

  function dragTo(now: Extract<Press, { kind: 'drag' }>, dx: number, dy: number): void {
    set((ui_) => {
      const current = ui_.plan.room;

      if (current == null) return ui_;
      const lead = ui_.plan.items.find((item) => item.id === now.lead);
      const origin = now.origins[now.lead];

      if (lead == null || origin == null) return ui_;
      let mx = snapTo(origin[0] + dx / sRef.current, ui_.units, ui_.snap) - origin[0];
      let my = snapTo(origin[1] + dy / sRef.current, ui_.units, ui_.snap) - origin[1];

      for (const id of now.ids) {
        const item = ui_.plan.items.find((one) => one.id === id);
        const at = now.origins[id];

        if (item == null || at == null) continue;
        const box = bounds(item, at);

        mx = Math.min(Math.max(mx, -box.x0), current.w - box.x1);
        my = Math.min(Math.max(my, -box.y0), current.l - box.y1);
      }
      const items = ui_.plan.items.map((item) => {
        const at = now.origins[item.id];

        return at == null
          ? item
          : { ...item, x: Math.round(at[0] + mx), y: Math.round(at[1] + my) };
      });
      const moved = items.find((item) => item.id === now.lead)!;

      return {
        ...ui_,
        chosen: now.ids,
        chair: null,
        panel: null,
        notice: null,
        plan: { ...ui_.plan, items },
        ghost: now.ids.length === 1 ? { ...lead, x: origin[0], y: origin[1], id: 'ghost' } : null,
        tip: {
          at: [moved.x, moved.y],
          words: say(SW.tip, {
            across: lengthOf(moved.x, ui_.units),
            down: lengthOf(moved.y, ui_.units),
          }),
        },
      };
    });
  }

  function resizeTo(
    now: Extract<Press, { kind: 'resize' }>,
    clientX: number,
    clientY: number,
  ): void {
    const at = toCmLive(clientX, clientY);

    if (at == null) return;
    const item = now.item;
    const [lx, ly] = turn([at[0] - item.x, at[1] - item.y], -item.rot);
    const round = item.kind === 'round' || item.kind === 'cocktail';
    const snap = (value: number) => Math.max(40, Math.min(1000, Math.round(value / 10) * 10));
    const change: Partial<Item> = round
      ? { d: Math.min(400, snap(2 * Math.max(Math.abs(lx), Math.abs(ly)))) }
      : {
          ...(now.handle.includes('e') || now.handle.includes('w')
            ? { w: snap(2 * Math.abs(lx)) }
            : {}),
          ...(now.handle.includes('n') || now.handle.includes('s')
            ? { l: snap(2 * Math.abs(ly)) }
            : {}),
        };
    const width = round ? change.d : (change.w ?? item.w);

    set((ui_) => ({
      ...ui_,
      plan: {
        ...ui_.plan,
        items: ui_.plan.items.map((one) => (one.id === item.id ? { ...one, ...change } : one)),
      },
      tip: {
        at: [item.x + (round ? (change.d ?? 0) / 2 : (width ?? 0) / 2), item.y],
        words: say(SW.tipWidth, { n: width ?? 0 }),
      },
    }));
  }

  function settle(ids: string[], lead: string): void {
    const item = ui$.current.plan.items.find((one) => one.id === lead);

    commit(ids.length === 1 ? lead : null, (plan) => plan, { ghost: null, tip: null });
    if (item != null)
      say$(
        say(SW.movedTo, {
          name: item.name,
          across: lengthOf(item.x, ui$.current.units),
          down: lengthOf(item.y, ui$.current.units),
        }),
      );
  }

  function onItemKey(event: ReactKeyboardEvent<SVGGElement>, id: string): void {
    const now = ui$.current;
    const item = now.plan.items.find((one) => one.id === id);

    if (item == null) return;
    const chosen = now.chosen.includes(id);
    const arrows: Record<string, Point> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (now.picked != null) seatAt(id);
      else if (event.shiftKey && event.key === ' ')
        set((ui_) => ({
          ...ui_,
          chosen: ui_.chosen.includes(id)
            ? ui_.chosen.filter((one) => one !== id)
            : [...ui_.chosen, id],
          panel: null,
          chair: null,
        }));
      else choose([id]);
      return;
    }
    if (event.key in arrows) {
      event.preventDefault();
      if (now.picked != null) {
        const order = readingOrder(now.plan.items.filter(isTable));
        const at = order.findIndex((one) => one.id === id);
        const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        const next = order[(at + step + order.length) % order.length];

        if (next != null) document.querySelector<SVGElement>(`[data-item="${next.id}"]`)?.focus();
        return;
      }
      if (!chosen || now.readOnly || now.plan.room == null) return;
      const [ax, ay] = arrows[event.key]!;
      const step = keyStep(now.units, event.shiftKey);
      const room_ = now.plan.room;
      const ids = now.chosen;
      let mx = ax * step;
      let my = ay * step;

      for (const one of now.plan.items.filter((each) => ids.includes(each.id))) {
        const box = bounds(one);

        mx = Math.min(Math.max(mx, -box.x0), room_.w - box.x1);
        my = Math.min(Math.max(my, -box.y0), room_.l - box.y1);
      }
      commit(ids.length === 1 ? id : null, (plan) => ({
        ...plan,
        items: plan.items.map((one) =>
          ids.includes(one.id)
            ? { ...one, x: Math.round(one.x + mx), y: Math.round(one.y + my) }
            : one,
        ),
      }));
      say$(
        `${say(SW.movedTo, { name: item.name, across: lengthOf(Math.round(item.x + mx), now.units), down: lengthOf(Math.round(item.y + my), now.units) })} ${SW.saved}.`,
      );
      return;
    }
    if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey) {
      if (!chosen || now.readOnly || !turns(item)) return;
      event.preventDefault();
      const rot = (item.rot + 15) % 360;

      commit(id, (plan) => ({
        ...plan,
        items: plan.items.map((one) => (one.id === id ? { ...one, rot } : one)),
      }));
      say$(say(SW.turnedTo, { name: item.name, deg: rot }));
      return;
    }
    if ((event.key === 'd' || event.key === 'D') && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (chosen && !now.readOnly && item.kind !== 'single') duplicate(id);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!chosen || now.readOnly) return;
      event.preventDefault();
      set((ui_) => ({ ...ui_, asking: { kind: 'deleteItems', ids: ui_.chosen } }));
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (now.picked != null) pick(null);
      else set((ui_) => ({ ...ui_, chosen: [], chair: null, notice: null, note: null }));
    }
  }

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const now = ui$.current;

      if (now.placing != null) stopPlacing();
      else if (now.menu) set((ui_) => ({ ...ui_, menu: false }));
      else if (now.pop != null) set((ui_) => ({ ...ui_, pop: null }));
      else if (now.picked != null && now.asking == null) pick(null);
    };

    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  });

  function zoomTo(next: number, anchor: Point = [size.w / 2, size.h / 2]): void {
    const clamped = Math.min(4 * AT_100, Math.max(0.25 * AT_100, next));
    const at: Point = [(anchor[0] - ox) / s, (anchor[1] - oy) / s];

    set((now) => ({
      ...now,
      camera: {
        s: clamped,
        cx: at[0] - (anchor[0] - size.w / 2) / clamped,
        cy: at[1] - (anchor[1] - size.h / 2) / clamped,
      },
    }));
  }

  function stepZoom(direction: 1 | -1): void {
    const pct = percentOf(s);
    const next =
      direction > 0
        ? ZOOMS.find((one) => one > pct + 0.5)
        : [...ZOOMS].reverse().find((one) => one < pct - 0.5);

    if (next != null) zoomTo((next / 100) * AT_100);
  }

  useEffect(() => {
    const node = canvas.current;

    if (node == null) return;
    const wheel = (event: WheelEvent) => {
      if (ui$.current.view !== 'plan' || ui$.current.plan.room == null) return;
      event.preventDefault();
      const box = node.getBoundingClientRect();

      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY / 300);

        zoomTo(sRef.current * factor, [event.clientX - box.left, event.clientY - box.top]);
      } else {
        const cx = (size.w / 2 - oRef.current[0]) / sRef.current + event.deltaX / sRef.current;
        const cy = (size.h / 2 - oRef.current[1]) / sRef.current + event.deltaY / sRef.current;

        set((now) => ({ ...now, camera: { s: sRef.current, cx, cy } }));
      }
    };

    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  });

  const items = ui.plan.items;
  const overlaps = useMemo(() => {
    const out = new Set<string>(ui.shrink?.outside ?? []);

    items.forEach((a, i) =>
      items.slice(i + 1).forEach((b) => {
        if (overlap(a, b)) {
          out.add(a.id);
          out.add(b.id);
        }
      }),
    );
    return out;
  }, [items, ui.shrink]);
  const lit = new Set<string>();

  if (ui.hover != null && (ui.picked != null || ui.bar?.does === 'undo' || ui.pop != null))
    lit.add(ui.hover);
  if (ui.panel?.kind === 'sectionEdit') {
    const id = ui.panel.id;

    items.filter((item) => item.sec === id).forEach((item) => lit.add(item.id));
  }
  const look: Look = {
    chosen: new Set(ui.chosen.filter((id) => id !== ui.chair?.id)),
    lit,
    faint: new Set(ui.ghost != null && ui.placing == null ? [ui.ghost.id] : []),
    overlap: overlaps,
    focus: keyboard ? focusId : null,
    rings: ui.rings,
    handles:
      ui.chosen.length === 1 && !ui.readOnly && ui.chair == null && ui.tab === 'arrange'
        ? (ui.chosen[0] ?? null)
        : null,
    chair: ui.chair,
    chairsFor:
      detail === 'out'
        ? null
        : (ui.chosen[0] ?? ui.chair?.id ?? ui.pop?.table ?? (detail === 'near' ? '' : null)),
  };
  const drawn = ui.ghost != null && ui.placing == null ? [...items, ui.ghost] : items;
  const placingGhost =
    ui.placing != null && placingAt != null
      ? { ...newItem(ui.placing.kind, items, placingAt), id: 'placing' }
      : null;
  const keysShown =
    keyboard && focusId != null && ui.chosen.length > 0 && !ui.readOnly && ui.view === 'plan';
  const showSave = room != null || ui.panel?.kind !== 'start';

  const crumb = (
    <header className="st-top">
      <nav className="st-crumb" aria-label={SW.crumb}>
        <ol>
          <li>
            <Link to="/demo/events">{SW.events}</Link>
          </li>
          <li>
            <Icon name="chevron" size={14} weight={2.3} />
            <Link to={`/demo/events/${event.id}`}>{event.name}</Link>
          </li>
          <li aria-current="page">
            <Icon name="chevron" size={14} weight={2.3} />
            <h1 tabIndex={-1}>{SW.area}</h1>
          </li>
        </ol>
      </nav>
      <Presence />
      <DemoBell tell={tell} />
    </header>
  );

  let main: ReactNode;

  if (ui.load === 'loading')
    main = (
      <div className="st-main">
        <div className="st-canvas" ref={placeCanvas}>
          <Skeleton w={size.w} h={size.h} />
          <ViewSwitch />
        </div>
        <div className="st-panel is-skeleton" aria-hidden="true">
          {[44, 24, 18, 44, 24, 52, 52, 52, 52].map((h, index) => (
            <span key={index} className={`st-sunk is-${h} n${index}`} />
          ))}
        </div>
      </div>
    );
  else if (ui.load === 'failed')
    main = (
      <div className="st-main">
        <div className="st-canvas is-failed" ref={placeCanvas}>
          <div className="st-failed">
            <Icon name="cloudOff" size={32} weight={1.9} />
            <h2>{SW.failed}</h2>
            <p>{SW.failedLine}</p>
            <button
              type="button"
              className="button"
              onClick={() => set((now) => ({ ...now, load: 'loading' }))}
            >
              {SW.tryAgain}
            </button>
          </div>
        </div>
      </div>
    );
  else if (room == null && ui.panel?.kind !== 'start')
    main = (
      <div className="st-main is-none">
        <div className="st-no-plan">
          <section className="desk-card st-plan-card">
            <span className={`st-card-mesh today-cover is-${event.mesh}`} aria-hidden="true" />
            <span className="st-card-scrim" aria-hidden="true" />
            {[1, 2, 3, 4, 5, 6].map((piece) => (
              <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
            ))}
            <div className="desk-card-inner">
              <Says>{SW.noPlan}</Says>
              <OnCard>{SW.noPlanLine}</OnCard>
              {!ui.readOnly && (
                <CardStep
                  label={SW.startPlan}
                  onClick={() =>
                    set((now) => ({
                      ...now,
                      panel: { kind: 'start' },
                      start: { name: 'Main hall', width: '', length: '', errors: {} },
                    }))
                  }
                />
              )}
            </div>
          </section>
        </div>
      </div>
    );
  else
    main = (
      <div className="st-main">
        <div className={`st-canvas is-${ui.view}`} ref={placeCanvas}>
          <ViewSwitch />
          {showSave && (
            <div className="st-float st-top-right">
              <SaveLine />
              {room != null && (
                <button
                  type="button"
                  className={ui.print.open ? 'st-print-button is-on' : 'st-print-button'}
                  aria-expanded={ui.print.open}
                  aria-haspopup="dialog"
                  onClick={() =>
                    set((now) => ({ ...now, print: { ...now.print, open: !now.print.open } }))
                  }
                >
                  <Icon name="print" size={17} weight={2.1} />
                  {SW.print}
                </button>
              )}
            </div>
          )}
          {ui.print.open && room != null && (
            <PrintPanel
              onClose={() => set((now) => ({ ...now, print: { ...now.print, open: false } }))}
            />
          )}
          {ui.view === 'plan' && room != null && ui.bar != null && (
            <MessageBar onPlace={placeAtCentre} onStop={stopPlacing} />
          )}
          {ui.view === 'plan' ? (
            room == null ? (
              <StartPreview w={size.w} h={size.h} />
            ) : (
              <RoomDrawing
                width={size.w}
                height={size.h}
                s={s}
                ox={ox}
                oy={oy}
                plan={ui.plan}
                units={ui.units}
                items={drawn}
                detail={detail}
                look={look}
                readOnly={ui.readOnly}
                shrinkTo={ui.shrink?.width ?? null}
                tip={ui.tip}
                ghostAt={placingGhost}
                onFloor={onFloor}
                hands={{
                  onItemDown,
                  onItemKey,
                  onItemFocus: setFocusId,
                  onItemEnter: (id) => {
                    if (ui$.current.picked != null) set((now) => ({ ...now, hover: id }));
                  },
                  onChair: (id, index) => {
                    if (ui$.current.picked != null) seatAt(id, index);
                    else
                      set((now) => ({
                        ...now,
                        chosen: [],
                        chair: { id, i: index },
                        notice: null,
                        panel: null,
                        tab: 'arrange',
                      }));
                  },
                  onHandleDown,
                }}
              />
            )
          ) : (
            <div className="st-view-wrap">
              {ui.bar != null && (
                <MessageBar inline onPlace={() => undefined} onStop={stopPlacing} />
              )}
              {ui.view === 'tables' ? <TablesView /> : <ListView />}
            </div>
          )}
          {ui.view === 'plan' && room != null && (
            <>
              {keysShown && <KeysStrip />}
              {ui.placing != null && (
                <div className="st-float st-another">
                  <label>
                    <input
                      type="checkbox"
                      checked={ui.placing.another}
                      onChange={() =>
                        set((now) =>
                          now.placing == null
                            ? now
                            : {
                                ...now,
                                placing: { ...now.placing, another: !now.placing.another },
                              },
                        )
                      }
                    />
                    {SW.placeAnother}
                  </label>
                </div>
              )}
              {!ui.readOnly && (
                <AddBar
                  menu={ui.menu}
                  placing={ui.placing?.kind ?? null}
                  onMenu={() => set((now) => ({ ...now, menu: !now.menu }))}
                  onShape={startPlacing}
                  onRow={() => addNow('row')}
                  onSeat={() => addNow('single')}
                />
              )}
              <div
                className="st-float st-zoom"
                role="group"
                aria-label={say(SW.zoomIs, { pct: `${percentOf(s)}%` })}
              >
                <button
                  type="button"
                  className="st-round-button"
                  aria-label={SW.zoomOut}
                  onClick={() => stepZoom(-1)}
                >
                  <Icon name="minus" size={19} weight={2.2} />
                </button>
                <span className="st-pct" role="status">
                  {percentOf(s)}%
                </span>
                <button
                  type="button"
                  className="st-round-button"
                  aria-label={SW.zoomIn}
                  onClick={() => stepZoom(1)}
                >
                  <Icon name="plus" size={19} weight={2.2} />
                </button>
                <button
                  type="button"
                  className="st-tool"
                  onClick={() => set((now) => ({ ...now, camera: null }))}
                >
                  <Icon name="fit" size={18} weight={2.2} />
                  {SW.fit}
                </button>
              </div>
              {s >= AT_100 * 2 - 1e-9 && (
                <MiniMap
                  plan={ui.plan}
                  view={{ x: -ox / s, y: -oy / s, w: size.w / s, h: size.h / s }}
                />
              )}
              {ui.pop != null && <PopOver pop={ui.pop} s={s} ox={ox} oy={oy} />}
            </>
          )}
        </div>
        <SeatingPanel />
      </div>
    );

  return (
    <SeatingContext value={api}>
      <div className="st">
        {crumb}
        {main}
        <p className="desk-unseen" role="status" aria-live="polite">
          {ui.spoken}
        </p>
        <Asking />
      </div>
    </SeatingContext>
  );
}

function ViewSwitch() {
  const { ui, set } = useSeating();
  const views: readonly ['plan' | 'tables' | 'list', string, IconName][] = [
    ['plan', SW.floorPlan, 'map'],
    ['tables', SW.tables, 'cards'],
    ['list', SW.list, 'list'],
  ];

  if (ui.plan.room == null) return null;
  return (
    <div className="st-float st-views st-seg" role="group" aria-label={SW.view}>
      {views.map(([view, word, glyph]) => (
        <button
          key={view}
          type="button"
          aria-pressed={ui.view === view}
          className={ui.view === view ? 'st-seg-one is-on' : 'st-seg-one'}
          onClick={() => set((now) => ({ ...now, view, menu: false }))}
        >
          <Icon name={glyph} size={16} weight={2.1} />
          {word}
        </button>
      ))}
    </div>
  );
}

function SaveLine() {
  const { ui, set } = useSeating();

  return (
    <div
      className={`st-save is-${ui.save === 'notSaved' ? 'not-saved' : ui.save}`}
      role="status"
      aria-live="polite"
    >
      {ui.save === 'saved' && <Mark kind="yes" />}
      {ui.save === 'saving' && <span className="st-turning" aria-hidden="true" />}
      {ui.save === 'retrying' && <Icon name="alert" size={16} weight={2.2} />}
      {ui.save === 'notSaved' && (
        <span className="st-no" aria-hidden="true">
          <Icon name="clear" size={10} weight={3.4} />
        </span>
      )}
      {
        { saved: SW.saved, saving: SW.saving, retrying: SW.retrying, notSaved: SW.notSaved }[
          ui.save
        ]
      }
      {ui.save === 'notSaved' && (
        <button
          type="button"
          className="desk-text"
          onClick={() => set((now) => ({ ...now, save: 'saving' }))}
        >
          {SW.tryAgain}
        </button>
      )}
    </div>
  );
}

function Presence() {
  const { ui, set } = useSeating();
  const people = ui.people;

  if (ui.presence === 'reconnecting')
    return (
      <p className="st-presence-line" role="status">
        <Icon name="refresh" size={15} weight={2.2} />
        {SW.reconnecting}
      </p>
    );
  if (people.length === 0) return null;
  const first = people[0]!;
  const words =
    people.length === 1
      ? say(SW.onPlan, { name: first.name })
      : many('andOthers', people.length - 1, { name: first.name });
  const shown = people.length >= 6 ? people.slice(0, 4) : people;

  return (
    <div className="st-presence">
      <ul className="st-faces" aria-label={words}>
        {shown.map((person) => (
          <li key={person.name}>
            <button
              type="button"
              className="st-face-button"
              aria-label={person.viewer ? `${person.name}, ${SW.canView}` : person.name}
              onClick={() => set((now) => ({ ...now, onPlanOpen: !now.onPlanOpen }))}
            >
              <Face person={person} />
            </button>
          </li>
        ))}
        {shown.length < people.length && (
          <li>
            <button
              type="button"
              className="st-more"
              aria-haspopup="dialog"
              aria-expanded={ui.onPlanOpen}
              aria-label={say(SW.moreOnPlan, { n: people.length - 4 })}
              onClick={() => set((now) => ({ ...now, onPlanOpen: !now.onPlanOpen }))}
            >
              +{people.length - 4}
            </button>
          </li>
        )}
      </ul>
      <span className="st-presence-line" aria-hidden="true">
        {words}
      </span>
      {ui.onPlanOpen && (
        <div className="st-on-plan" role="dialog" aria-labelledby="st-on-plan">
          <h2 id="st-on-plan">{SW.onThisPlan}</h2>
          <ul>
            {people.map((person) => (
              <li key={person.name}>
                <Face person={person} size={28} />
                <span className="st-row-name">{person.name}</span>
                {person.viewer && <span className="st-row-line">{SW.canView}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Face({ person, size = 32 }: { person: Person; size?: 28 | 32 }) {
  return (
    <span className={`st-face p${person.tone} is-${size}`} aria-hidden="true">
      {person.initials}
    </span>
  );
}

function MessageBar({
  inline = false,
  onPlace,
  onStop,
}: {
  inline?: boolean;
  onPlace: () => void;
  onStop: () => void;
}) {
  const { ui, set, pick } = useSeating();
  const bar = ui.bar;

  if (bar == null) return null;
  const glyph: IconName = bar.kind === 'undo' ? 'tick' : bar.kind === 'amber' ? 'alert' : 'info';

  return (
    <div
      className={`${inline ? 'st-bar is-inline' : 'st-float st-bar'} is-${bar.kind}`}
      role="status"
      aria-live="polite"
    >
      <Icon name={glyph} size={17} weight={2.2} />
      <p>{bar.words}</p>
      {bar.does === 'placing' && (
        <span className="st-bar-acts">
          <button type="button" className="desk-text" onClick={onPlace}>
            {SW.placeCentre}
          </button>
          <button type="button" className="desk-text" onClick={onStop}>
            {SW.stopPlacing}
          </button>
        </span>
      )}
      {bar.does === 'pick' && (
        <span className="st-bar-acts">
          <button type="button" className="desk-text" onClick={() => pick(null)}>
            {SW.cancel}
          </button>
        </span>
      )}
      {bar.does === 'undo' && (
        <span className="st-bar-acts">
          <button
            type="button"
            className="desk-text"
            onClick={() =>
              set((now) =>
                now.undo == null
                  ? { ...now, bar: null }
                  : {
                      ...now,
                      plan: now.undo.plan,
                      tray: now.undo.tray,
                      undo: null,
                      bar: null,
                      hover: null,
                      save: 'saving',
                    },
              )
            }
          >
            {SW.undo}
          </button>
        </span>
      )}
    </div>
  );
}

function KeysStrip() {
  const keys: readonly [string, string][] = [
    ['← ↑ → ↓', SW.keyMove],
    ['Shift', SW.keyShift],
    ['R', SW.keyTurn],
    ['⌘ D', SW.keyDuplicate],
    ['Delete', SW.keyDelete],
    ['Esc', SW.keyEsc],
  ];

  return (
    <div className="st-float st-keys" role="note" aria-label={SW.keys}>
      {keys.map(([key, word]) => (
        <span key={key} className="st-key">
          <kbd>{key}</kbd>
          {word}
        </span>
      ))}
    </div>
  );
}

function AddBar({
  menu,
  placing,
  onMenu,
  onShape,
  onRow,
  onSeat,
}: {
  menu: boolean;
  placing: Kind | null;
  onMenu: () => void;
  onShape: (kind: Kind) => void;
  onRow: () => void;
  onSeat: () => void;
}) {
  const shapes: readonly [Kind, string][] = [
    ['round', SW.menuRound],
    ['rect', SW.menuRect],
    ['head', SW.menuHead],
    ['cocktail', SW.menuCocktail],
  ];
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menu) first.current?.focus();
  }, [menu]);

  return (
    <>
      {menu && (
        <div className="st-float st-menu" role="menu" aria-label={SW.addTable}>
          {shapes.map(([kind, words], index) => (
            <button
              key={kind}
              ref={index === 0 ? first : undefined}
              type="button"
              role="menuitem"
              className="st-menu-row"
              onClick={() => onShape(kind)}
            >
              <ShapeTile kind={kind} />
              {words}
            </button>
          ))}
        </div>
      )}
      <div className="st-float st-add" role="group" aria-label={SW.addBar}>
        <button
          type="button"
          className={
            menu || (placing != null && placing !== 'row' && placing !== 'single')
              ? 'st-tool is-on'
              : 'st-tool'
          }
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={onMenu}
        >
          <Icon name="plus" size={18} weight={2.2} />
          {SW.addTable}
          <Icon name="chevdown" size={15} weight={2.4} />
        </button>
        <button type="button" className="st-tool" onClick={onRow}>
          <Icon name="row" size={18} weight={2.2} />
          {SW.addRow}
        </button>
        <button type="button" className="st-tool" onClick={onSeat}>
          <Icon name="seat1" size={18} weight={2.2} />
          {SW.addSeat}
        </button>
      </div>
    </>
  );
}

/** A dark-free place for an answer by the table: Seat just {name}, Swap with {name}, Move everyone to…. */
function PopOver({ pop, s, ox, oy }: { pop: Pop; s: number; ox: number; oy: number }) {
  const { ui, set, seatJust, swap, moveAll } = useSeating();
  const box = useRef<HTMLDivElement>(null);
  const item = ui.plan.items.find((one) => one.id === pop.table);

  useLayoutEffect(() => {
    if (box.current == null || item == null) return;
    const x = ox + item.x * s;
    const y = oy + item.y * s;
    const left =
      pop.kind === 'moveAll' ? box.current.parentElement!.clientWidth - 316 : Math.max(16, x - 150);
    const top = pop.kind === 'moveAll' ? 140 : y + 60;

    box.current.style.setProperty('left', `${Math.round(left)}px`);
    box.current.style.setProperty('top', `${Math.round(top)}px`);
    box.current.querySelector<HTMLElement>('button')?.focus();
  }, [item, s, ox, oy, pop.kind]);

  if (item == null) return null;
  const close = () => set((now) => ({ ...now, pop: null }));
  let body: ReactNode;

  if (pop.kind === 'short') {
    const party = ui.tray.find((one) => one.id === pop.party);

    body = (
      <>
        <p className="st-strong">
          {say(SW.short, {
            table: item.name,
            n: free(item),
            name: party?.name ?? '',
            m: party == null ? 0 : peopleIn(party),
          })}
        </p>
        <div className="st-pair">
          <button type="button" className="button" onClick={close}>
            {SW.cancel}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => seatJust(pop.party, pop.table)}
          >
            {say(SW.seatJust, { name: party?.name ?? '' })}
          </button>
        </div>
      </>
    );
  } else if (pop.kind === 'swap') {
    const who = item.chairs[pop.chair]?.who ?? '';

    body = (
      <>
        <p className="st-strong">
          {say(SW.swapLine, { table: item.name, n: pop.chair + 1, name: who })}
        </p>
        <div className="st-pair">
          <button type="button" className="button" onClick={close}>
            {SW.cancel}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => swap(pop.table, pop.chair, pop.party)}
          >
            {say(SW.swapWith, { name: who })}
          </button>
        </div>
      </>
    );
  } else {
    const n = filled(item);
    const room = ui.plan.items.filter(
      (one) => one.id !== item.id && isTable(one) && usable(one) - filled(one) >= n,
    );

    body = (
      <>
        <h2>{SW.moveAll}</h2>
        <p className="st-line">{say(SW.roomForAll, { n })}</p>
        <ul className="st-rows is-dense">
          {room.map((one) => (
            <li key={one.id}>
              <button type="button" className="st-party" onClick={() => moveAll(item.id, one.id)}>
                <ShapeTile kind={one.kind} />
                <span className="st-row-words">
                  <span className="st-row-name">{one.name}</span>
                  <span className="st-row-line">
                    {say(SW.freeLine, {
                      section:
                        sectionLine(ui.plan, one.sec).split(' · ')[0] === undefined
                          ? ''
                          : (ui.plan.sections.find((sec) => sec.id === one.sec)?.name ??
                            SW.noSection),
                      n: free(one),
                    })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div
      ref={box}
      className={`st-float st-pop is-${pop.kind === 'moveAll' ? 'move-all' : pop.kind}`}
      role="dialog"
      aria-label={itemName(ui.plan, item)}
    >
      {body}
    </div>
  );
}

function Asking() {
  const { ui, set, commit } = useSeating();
  const asking = ui.asking;

  if (asking == null) return null;
  const keep = () => set((now) => ({ ...now, asking: null }));

  if (asking.kind === 'deletePlan')
    return (
      <Ask
        title={SW.deletePlanAsk}
        line={say(SW.deletePlanBody, {
          counts: planCounts(ui.plan).replace(/^./u, (c) => c.toUpperCase()),
        })}
        keep={SW.keepPlan}
        go={SW.deletePlan}
        onKeep={keep}
        onGo={() =>
          commit(null, () => ({ room: null, items: [], sections: [] }), {
            asking: null,
            panel: null,
            chosen: [],
            bar: null,
            people: [],
          })
        }
      />
    );
  if (asking.kind === 'deleteSection') {
    const section = ui.plan.sections.find((one) => one.id === asking.id);
    const n = ui.plan.items.filter((item) => item.sec === asking.id).length;

    if (section == null) return null;
    return (
      <Ask
        title={say(SW.deleteNamed, { name: section.name })}
        line={say(SW.sectionDeleteBody, { n })}
        keep={SW.keepIt}
        go={SW.deleteSection}
        onKeep={keep}
        onGo={() =>
          commit(
            null,
            (plan) => ({
              ...plan,
              sections: plan.sections.filter((one) => one.id !== section.id),
              items: plan.items.map((item) =>
                item.sec === section.id ? { ...item, sec: null } : item,
              ),
            }),
            {
              asking: null,
              panel: null,
            },
          )
        }
      />
    );
  }
  const doomed = ui.plan.items.filter((item) => asking.ids.includes(item.id));
  const n = doomed.reduce(
    (sum, item) => sum + item.chairs.filter((chair) => chair.state === 'taken').length,
    0,
  );
  const name = doomed.map((item) => item.name);
  const title = say(SW.deleteNamed, {
    name: name.length === 1 ? (name[0] ?? '') : name.join(', '),
  });

  return (
    <Ask
      title={title}
      line={n > 0 ? say(SW.seatedHere, { n }) : SW.nobodyHere}
      keep={SW.keepIt}
      go={name.length === 1 ? say(SW.deleteName, { name: name[0] ?? '' }) : SW.deleteThese}
      onKeep={keep}
      onGo={() => {
        const back: Party[] = doomed.flatMap((item) =>
          item.chairs
            .filter((chair) => chair.state === 'taken' && chair.who != null)
            .map((chair) => ({
              id: `back-${chair.who}`,
              name: chair.who!,
              companions: [],
              group: null,
              reply: 'coming' as const,
            })),
        );

        commit(
          null,
          (plan) => ({
            ...plan,
            items: plan.items.filter((item) => !asking.ids.includes(item.id)),
          }),
          { asking: null, chosen: [], chair: null, notice: null, tray: [...ui.tray, ...back] },
        );
      }}
    />
  );
}

function Skeleton({ w, h }: { w: number; h: number }) {
  const { s, ox, oy } = fitOf(w, h, { name: '', w: 2400, l: 1800 });
  const rounds = [
    [420, 620],
    [810, 620],
    [1200, 620],
    [1590, 620],
    [1980, 620],
    [420, 1020],
    [810, 1020],
    [1200, 1020],
    [1980, 1020],
  ];

  return (
    <svg
      className="st-room"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={SW.loading}
    >
      <rect className="st-skeleton-room" x={ox} y={oy} width={2400 * s} height={1800 * s} rx="4" />
      {rounds.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          className="st-skeleton-block"
          x={ox + x! * s - 25}
          y={oy + y! * s - 25}
          width="50"
          height="50"
          rx="25"
        />
      ))}
    </svg>
  );
}

/** Start the plan: the room appears to scale once it has a width and a length (sc-3998). */
function StartPreview({ w, h }: { w: number; h: number }) {
  const { ui } = useSeating();
  const width = Number(ui.start.width.replace(',', '.'));
  const length = Number(ui.start.length.replace(',', '.'));

  if (!(width >= 2 && width <= 500 && length >= 2 && length <= 500))
    return (
      <div className="st-start-hint">
        <p>{SW.startHint}</p>
      </div>
    );
  const room = { name: ui.start.name, w: width * 100, l: length * 100 };
  const { s, ox, oy } = fitOf(w, h, room);

  return (
    <svg
      className="st-room"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={say(SW.roomGroup, {
        name: room.name,
        width: lengthOf(room.w, 'metric'),
        length: lengthOf(room.l, 'metric'),
      })}
    >
      <rect className="st-floor" x={ox} y={oy} width={room.w * s} height={room.l * s} />
      <rect className="st-walls" x={ox} y={oy} width={room.w * s} height={room.l * s} />
    </svg>
  );
}
