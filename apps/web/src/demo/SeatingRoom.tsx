import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';

import {
  type Chair,
  type Detail,
  type Item,
  type Plan,
  type Point,
  type Presence,
  type Rings,
  CHAIR_R,
  chairsTakePointer,
  SW,
  chairSaid,
  free,
  chairsOf,
  chosenWords,
  extent,
  filled,
  initials,
  isRound,
  itemName,
  lengthOf,
  marksOf,
  ofWords,
  readingOrder,
  say,
  sectionOf,
  turn,
  usable,
} from './seating.ts';
import type { Outline, Rect } from './selection.ts';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface Look {
  chosen: ReadonlySet<string>;
  lit: ReadonlySet<string>;
  faint: ReadonlySet<string>;
  overlap: ReadonlySet<string>;
  focus: string | null;
  rings: Rings;
  presence: Presence;
  handles: string | null;
  chair: { id: string; i: number } | null;
  chairsFor: string | null;
  /** A guest is picked: every table says "{n} free" or "Full" (sc-5030). */
  picking?: boolean;
  /** The chair whose label shows above it, on hover or focus (sc-5030). */
  label?: { id: string; i: number } | null;
}

export interface RoomHands {
  onItemDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
  onItemKey?: (event: KeyboardEvent<SVGGElement>, id: string) => void;
  onItemFocus?: (id: string | null) => void;
  onItemEnter?: (id: string | null) => void;
  onChair?: (id: string, index: number) => void;
  onChairLabel?: (spot: { id: string; i: number } | null) => void;
  onHandleDown?: (event: PointerEvent<SVGRectElement>, id: string, handle: Handle) => void;
}

/** Each further colleague's ring sits outside the last: its 2 px white gap, then its 3 px line, fixed at every zoom. */
const RING_STEP = 5;
const PILL_STEP = 24;

const SEC_CLASS: Record<string, string> = {
  Blue: 'is-blue',
  Purple: 'is-purple',
  Plum: 'is-plum',
  Wine: 'is-wine',
  Rose: 'is-rose',
  Brown: 'is-brown',
  Olive: 'is-olive',
  Teal: 'is-teal',
};

let measure: CanvasRenderingContext2D | null | undefined;

/** The name goes inside the table when it fits, else under it (seating_dir_kit's rule); measured in a browser, estimated in tests. */
function fits(name: string, width: number): boolean {
  if (measure === undefined)
    measure = navigator.userAgent.includes('jsdom')
      ? null
      : document.createElement('canvas').getContext('2d');
  if (measure == null) return name.length * 6.2 <= width - 3;
  measure.font = '600 12px "Instrument Sans", sans-serif';
  return measure.measureText(name).width <= width - 3;
}

function f(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A chair in its state (sc-4013): Taken filled, Held half filled, Empty an outline, Unusable crossed. */
export function ChairMark({
  x,
  y,
  r,
  chair,
  square = false,
  label,
  near = false,
}: {
  x: number;
  y: number;
  r: number;
  chair: Chair | { state: 'proposed' };
  square?: boolean;
  label?: string | undefined;
  near?: boolean;
}) {
  const shape = (className: string) =>
    square ? (
      <rect
        className={className}
        x={f(x - r)}
        y={f(y - r)}
        width={f(2 * r)}
        height={f(2 * r)}
        rx={f(r * 0.35)}
      />
    ) : (
      <circle className={className} cx={f(x)} cy={f(y)} r={f(r)} />
    );
  const edge = near ? ' is-near' : '';

  switch (chair.state) {
    case 'taken':
      return (
        <>
          {shape(`st-chair is-taken${edge}`)}
          {near && label != null && (
            <text
              className="st-chair-text is-on-dark"
              x={f(x)}
              y={f(y)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          )}
        </>
      );
    case 'held':
      return (
        <>
          {shape(`st-chair is-held${edge}`)}
          <path
            className="st-chair-half"
            d={`M${f(x)} ${f(y - r)} A${f(r)} ${f(r)} 0 0 0 ${f(x)} ${f(y + r)} Z`}
          />
        </>
      );
    case 'proposed':
      return shape(`st-chair is-proposed${edge}`);
    case 'unusable': {
      const k = r * 0.45;

      return (
        <>
          {shape(`st-chair is-unusable${edge}`)}
          <path
            className={`st-chair-cross${edge}`}
            d={`M${f(x - k)} ${f(y - k)}L${f(x + k)} ${f(y + k)}M${f(x + k)} ${f(y - k)}L${f(x - k)} ${f(y + k)}`}
          />
        </>
      );
    }
    default:
      return (
        <>
          {shape(`st-chair is-empty${edge}`)}
          {near && label != null && (
            <text
              className="st-chair-text"
              x={f(x)}
              y={f(y)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          )}
        </>
      );
  }
}

export function StateMark({
  chair,
  size = 20,
}: {
  chair: Chair | { state: 'proposed' };
  size?: number;
}) {
  return (
    <svg
      className="st-state-mark"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      <ChairMark x={size / 2} y={size / 2} r={size / 2 - 1.5} chair={chair} near />
    </svg>
  );
}

function sectionClass(plan: Plan, item: Item): string {
  const section = sectionOf(plan, item);

  return section == null ? 'is-none' : (SEC_CLASS[section.colour] ?? 'is-none');
}

/** One item at s px per cm (seating_dir_kit.item_svg): the lit Tint, the body, its chairs, its words, then the marks over it. */
function ItemDrawing({
  plan,
  item,
  s,
  ox,
  oy,
  detail,
  look,
  hands,
  readOnly,
  tabbable,
}: {
  plan: Plan;
  item: Item;
  s: number;
  ox: number;
  oy: number;
  detail: Detail;
  look: Look;
  hands: RoomHands;
  readOnly: boolean;
  tabbable: boolean;
}) {
  const cx = ox + item.x * s;
  const cy = oy + item.y * s;
  const [ex, ey] = extent(item);
  const round = isRound(item);
  const chosen = look.chosen.has(item.id);
  const lit = chosen || look.lit.has(item.id);
  const faint = look.faint.has(item.id);
  const choices = marksOf(look.rings, look.presence, item.id);
  const onItem = choices.filter((one) => one.seat == null || detail === 'out');
  const onSeat = detail === 'out' ? [] : choices.filter((one) => one.seat != null);
  const rot = `translate(${f(cx)} ${f(cy)}) rotate(${item.rot})`;
  const shapes: ReactNode[] = [];
  const marks: ReactNode[] = [];
  const near = detail === 'near';

  if (lit)
    shapes.push(
      round ? (
        <circle key="lit" className="st-lit" cx={f(cx)} cy={f(cy)} r={f(ex * s + 10)} />
      ) : (
        <g key="lit" transform={rot}>
          <rect
            className="st-lit"
            x={f(-ex * s - 10)}
            y={f(-ey * s - 10)}
            width={f(2 * ex * s + 20)}
            height={f(2 * ey * s + 20)}
            rx="12"
          />
        </g>
      ),
    );

  const body: ReactNode[] = [];

  if (item.kind === 'round' || item.kind === 'cocktail')
    body.push(
      <circle
        key="body"
        className={detail === 'out' ? 'st-body is-out' : 'st-body'}
        cx={f(cx)}
        cy={f(cy)}
        r={f(((item.d ?? 180) / 2) * s)}
      />,
    );
  else if (item.kind === 'rect' || item.kind === 'head') {
    const bw = (item.w ?? 180) * s;
    const bl = (item.l ?? 76) * s;

    body.push(
      <g key="body" transform={rot}>
        <rect
          className="st-body"
          x={f(-bw / 2)}
          y={f(-bl / 2)}
          width={f(bw)}
          height={f(bl)}
          rx={f(Math.min(4, bl / 4))}
        />
      </g>,
    );
  } else if (item.kind === 'single' && detail === 'out')
    body.push(
      <circle
        key="body"
        className="st-body is-single"
        cx={f(cx)}
        cy={f(cy)}
        r={f(Math.max(5, CHAIR_R * s))}
      />,
    );
  else if (item.kind === 'row') {
    const [sx, sy] = turn(
      [(-(item.chairs.length - 1) / 2) * (item.spacing ?? 50) - 52, 0],
      item.rot,
    );
    const tx = cx + sx * s;
    const ty = cy + sy * s;
    const th = Math.max(20, 2 * CHAIR_R * s);

    body.push(
      <g key="tab">
        <rect
          className="st-row-tab"
          x={f(tx - 12)}
          y={f(ty - th / 2)}
          width="24"
          height={f(th)}
          rx="6"
        />
        <text
          className="st-tab-text"
          x={f(tx)}
          y={f(ty)}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {item.label}
        </text>
      </g>,
    );
  }

  if (detail !== 'out') {
    const r = CHAIR_R * s;
    const pointer = chairsTakePointer(item, s);

    chairsOf(item).forEach((point, index) => {
      const chair = item.chairs[index] ?? { state: 'empty' };
      const [px, py] = turn(point, item.rot);
      const x = cx + px * s;
      const y = cy + py * s;
      const label = near
        ? chair.state === 'taken' && chair.who != null && !chair.who.startsWith('Guest of')
          ? initials(chair.who)
          : String(index + 1)
        : undefined;
      const picked = look.chair?.id === item.id && look.chair.i === index;
      const seated = onSeat.filter((one) => one.seat === index);
      // From 50% the keyboard reaches the chosen table's chairs; a pointer only once each is a 44 target (sc-5030).
      const target = (pointer && look.chairsFor != null) || look.chairsFor === item.id;

      if (item.kind === 'single') {
        body.push(
          <g key={`c${index}`}>
            <circle className="st-body is-single" cx={f(cx)} cy={f(cy)} r={f(r)} />
            {chair.state === 'taken' && (
              <circle
                className="st-chair is-taken"
                cx={f(cx)}
                cy={f(cy)}
                r={f(Math.max(2.5, r - 3))}
              />
            )}
          </g>,
        );
        return;
      }
      seated.forEach(({ who }, k) => {
        const rr = r + 5.5 + RING_STEP * k;

        marks.push(
          <g key={`seat${index}.${k}`} className={`st-ring p${who.tone}`}>
            <circle className="st-ring-gap" cx={f(x)} cy={f(y)} r={f(rr)} />
            <circle className="st-ring-line" cx={f(x)} cy={f(y)} r={f(rr + 1.5)} />
            <Pill x={x - rr * 0.72} y={y - rr * 0.72 - PILL_STEP * k} words={who.initials} />
          </g>,
        );
      });
      body.push(
        <g key={`c${index}`}>
          {picked && <circle className="st-lit" cx={f(x)} cy={f(y)} r={f(Math.max(r + 8, 26))} />}
          <ChairMark
            x={x}
            y={y}
            r={r}
            chair={chair}
            square={item.kind === 'cocktail'}
            label={label}
            near={near}
          />
          {target && (
            <circle
              className={pointer ? 'st-chair-hit' : 'st-chair-hit is-keys'}
              role="button"
              tabIndex={look.chairsFor === item.id ? 0 : -1}
              aria-label={
                say(SW.chairName, { table: item.name, n: index + 1, word: chairSaid(chair) }) +
                chosenWords(seated.map(({ who }) => ({ who })))
              }
              aria-pressed={picked}
              cx={f(x)}
              cy={f(y)}
              r="22"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerEnter={() => hands.onChairLabel?.({ id: item.id, i: index })}
              onPointerLeave={() => hands.onChairLabel?.(null)}
              onFocus={() => hands.onChairLabel?.({ id: item.id, i: index })}
              onBlur={() => hands.onChairLabel?.(null)}
              onClick={(event) => {
                event.stopPropagation();
                hands.onChair?.(item.id, index);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                hands.onChair?.(item.id, index);
              }}
            />
          )}
        </g>,
      );
    });
  }

  const words: ReactNode[] = [];
  const room = look.picking === true && item.kind !== 'single' ? free(item) : null;

  if (detail === 'out') {
    const by = nameAt(item, s, oy);

    words.push(
      <text
        key="name"
        className="st-name"
        x={f(cx)}
        y={f(by)}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {item.name}
      </text>,
    );
    if (room == null && item.kind !== 'single') {
      const share = filled(item) / Math.max(1, usable(item));

      words.push(
        <g key="bar">
          <rect
            className="st-fill-track"
            x={f(cx - 22)}
            y={f(by + 10)}
            width="44"
            height="5"
            rx="2.5"
          />
          <rect
            className="st-fill"
            x={f(cx - 22)}
            y={f(by + 10)}
            width={f(44 * share)}
            height="5"
            rx="2.5"
          />
          <text
            className="st-of"
            x={f(cx)}
            y={f(by + 25)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {ofWords(item)}
          </text>
        </g>,
      );
    }
  } else if (item.kind === 'single') {
    words.push(
      <text
        key="name"
        className="st-name is-quiet"
        x={f(cx + CHAIR_R * s + 6)}
        y={f(cy)}
        dominantBaseline="central"
      >
        {item.name}
      </text>,
    );
  } else if (item.kind !== 'row') {
    const bodyW = (round ? (item.d ?? 180) : (item.w ?? 180)) * s;
    const bodyH = (round ? (item.d ?? 180) : (item.l ?? 76)) * s;
    const inside = fits(item.name, bodyW) && bodyH >= 15;

    words.push(
      <text
        key="name"
        className="st-name"
        x={f(cx)}
        y={f(inside ? cy : cy + ey * s + 10)}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {item.name}
      </text>,
    );
  }

  if (room != null) {
    const ring = room === 0 ? 'st-room-for is-full' : 'st-room-for';

    marks.push(
      round ? (
        <circle key="room" className={ring} cx={f(cx)} cy={f(cy)} r={f(ex * s + 6)} />
      ) : (
        <g key="room" transform={rot}>
          <rect
            className={ring}
            x={f(-ex * s - 6)}
            y={f(-ey * s - 6)}
            width={f(2 * ex * s + 12)}
            height={f(2 * ey * s + 12)}
            rx="8"
          />
        </g>
      ),
    );
  }
  onItem.forEach(({ who }, k) => {
    const pad = (lit ? 10 : 2) + RING_STEP * k;
    const lift = PILL_STEP * k;

    if (round) {
      const rr = ex * s + pad + 3.5;

      marks.push(
        <g key={`ring${k}`} className={`st-ring p${who.tone}`}>
          <circle className="st-ring-gap" cx={f(cx)} cy={f(cy)} r={f(rr)} />
          <circle className="st-ring-line" cx={f(cx)} cy={f(cy)} r={f(rr + 1.5)} />
          <Pill x={cx - rr * 0.72} y={cy - rr * 0.72 - lift} words={who.initials} />
        </g>,
      );
    } else {
      const gw = ex * s + pad + 2;
      const gh = ey * s + pad + 2;
      const [px, py] = turn([-gw, -gh], item.rot);

      marks.push(
        <g key={`ring${k}`} className={`st-ring p${who.tone}`}>
          <g transform={rot}>
            <rect
              className="st-ring-gap"
              x={f(-gw)}
              y={f(-gh)}
              width={f(2 * gw)}
              height={f(2 * gh)}
              rx="10"
            />
            <rect
              className="st-ring-line"
              x={f(-gw - 1.5)}
              y={f(-gh - 1.5)}
              width={f(2 * gw + 3)}
              height={f(2 * gh + 3)}
              rx="10"
            />
          </g>
          <Pill x={cx + px} y={cy + py - lift} words={who.initials} />
        </g>,
      );
    }
  });
  if (look.overlap.has(item.id))
    marks.push(
      round ? (
        <circle key="over" className="st-overlap" cx={f(cx)} cy={f(cy)} r={f(ex * s + 6)} />
      ) : (
        <g key="over" transform={rot}>
          <rect
            className="st-overlap"
            x={f(-ex * s - 6)}
            y={f(-ey * s - 6)}
            width={f(2 * ex * s + 12)}
            height={f(2 * ey * s + 12)}
            rx="8"
          />
        </g>
      ),
    );
  if (look.focus === item.id)
    marks.push(
      round ? (
        <g key="focus">
          <circle className="st-focus" cx={f(cx)} cy={f(cy)} r={f(ex * s + 14)} />
          <circle className="st-focus-halo" cx={f(cx)} cy={f(cy)} r={f(ex * s + 17.5)} />
        </g>
      ) : (
        <g key="focus" transform={rot}>
          <rect
            className="st-focus"
            x={f(-ex * s - 14)}
            y={f(-ey * s - 14)}
            width={f(2 * ex * s + 28)}
            height={f(2 * ey * s + 28)}
            rx="14"
          />
          <rect
            className="st-focus-halo"
            x={f(-ex * s - 17.5)}
            y={f(-ey * s - 17.5)}
            width={f(2 * ex * s + 35)}
            height={f(2 * ey * s + 35)}
            rx="17"
          />
        </g>
      ),
    );

  const hit = round ? (
    <circle className="st-hit" cx={f(cx)} cy={f(cy)} r={f(Math.max(22, ex * s))} />
  ) : (
    <g transform={rot}>
      <rect
        className="st-hit"
        x={f(-Math.max(22, ex * s))}
        y={f(-Math.max(22, ey * s))}
        width={f(2 * Math.max(22, ex * s))}
        height={f(2 * Math.max(22, ey * s))}
      />
    </g>
  );

  return (
    <g
      className={['st-item', sectionClass(plan, item), faint && 'is-faint']
        .filter(Boolean)
        .join(' ')}
      role={faint ? undefined : 'button'}
      tabIndex={faint ? undefined : tabbable ? 0 : -1}
      aria-label={faint ? undefined : itemName(plan, item, chosenWords(choices))}
      aria-pressed={faint ? undefined : chosen}
      aria-hidden={faint ? true : undefined}
      data-item={item.id}
      onPointerDown={
        faint || hands.onItemDown == null
          ? undefined
          : (event) => hands.onItemDown?.(event, item.id)
      }
      onPointerEnter={faint ? undefined : () => hands.onItemEnter?.(item.id)}
      onPointerLeave={faint ? undefined : () => hands.onItemEnter?.(null)}
      onKeyDown={faint ? undefined : (event) => hands.onItemKey?.(event, item.id)}
      onFocus={faint ? undefined : () => hands.onItemFocus?.(item.id)}
      onBlur={faint ? undefined : () => hands.onItemFocus?.(null)}
    >
      {shapes}
      {hit}
      <g className="st-item-body">{body}</g>
      {words}
      {marks}
      {!readOnly && look.handles === item.id && (
        <Handles item={item} cx={cx} cy={cy} s={s} hands={hands} />
      )}
    </g>
  );
}

/** One guess at 12 px words, so the tip, the label and the free tag grow together in every locale. */
function wordsWide(words: string): number {
  return words.length * 7;
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** An item's outline on screen, chairs included, as its rotation leaves it. */
function footprint(item: Item, s: number, ox: number, oy: number): Box {
  const [ex, ey] = extent(item);
  const rad = (item.rot * Math.PI) / 180;
  const hx = (Math.abs(ex * Math.cos(rad)) + Math.abs(ey * Math.sin(rad))) * s + 6;
  const hy = (Math.abs(ex * Math.sin(rad)) + Math.abs(ey * Math.cos(rad))) * s + 6;
  const cx = ox + item.x * s;
  const cy = oy + item.y * s;

  return { x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy };
}

function crosses(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function nameAt(item: Item, s: number, oy: number): number {
  const cy = oy + item.y * s;

  return item.kind === 'rect' || item.kind === 'head'
    ? cy + ((item.l ?? 76) / 2) * s + 12
    : cy + Math.max(extent(item)[1], 40) * s * (item.kind === 'row' ? 1 : 0.55) + 12;
}

/** Below 50%, under the table's name; a tag that would cross one already placed goes a line lower (sc-5030). */
function outTags(
  items: readonly Item[],
  s: number,
  ox: number,
  oy: number,
): { id: string; x: number; y: number; n: number }[] {
  const placed: Box[] = [];

  return items
    .filter((item) => item.kind !== 'single')
    .map((item) => {
      const n = free(item);
      const x = ox + item.x * s;
      const half = (wordsWide(n === 0 ? SW.fullTab : say(SW.freeTag, { n })) + 16) / 2;
      const at = (y: number) => ({ x0: x - half, y0: y - 11, x1: x + half, y1: y + 11 });
      let y = nameAt(item, s, oy) + 20;

      while (placed.some((one) => crosses(at(y), one))) y += 24;
      placed.push(at(y));
      return { id: item.id, x, y, n };
    });
}

/** Under its item, or over it when only the space under it is taken (sc-5030). */
function freeTags(
  items: readonly Item[],
  s: number,
  ox: number,
  oy: number,
): { id: string; x: number; y: number; n: number }[] {
  const boxes = items.map((item) => ({ id: item.id, box: footprint(item, s, ox, oy) }));

  return items
    .filter((item) => item.kind !== 'single')
    .map((item) => {
      const n = free(item);
      const own = footprint(item, s, ox, oy);
      const x = (own.x0 + own.x1) / 2;
      const half = (wordsWide(n === 0 ? SW.fullTab : say(SW.freeTag, { n })) + 16) / 2;
      const clash = (y: number) =>
        boxes.some(
          (other) =>
            other.id !== item.id &&
            crosses({ x0: x - half, y0: y - 11, x1: x + half, y1: y + 11 }, other.box),
        );
      const below = own.y1 + 26;
      const above = own.y0 - 26;

      return { id: item.id, x, y: clash(below) && !clash(above) ? above : below, n };
    });
}

/** While a guest is picked: "{n} free" on a green dashed outline, or "Full" on a grey one (sc-5030). */
function FreeTag({ x, y, n }: { x: number; y: number; n: number }) {
  const words = n === 0 ? SW.fullTab : say(SW.freeTag, { n });
  const w = wordsWide(words) + 16;

  return (
    <g className={n === 0 ? 'st-free is-full' : 'st-free'} aria-hidden="true">
      <rect x={f(x - w / 2)} y={f(y - 11)} width={f(w)} height="22" rx="11" />
      <text x={f(x)} y={f(y)} textAnchor="middle" dominantBaseline="central">
        {words}
      </text>
    </g>
  );
}

export function Pill({ x, y, words }: { x: number; y: number; words: string }) {
  return (
    <g className="st-pill" aria-hidden="true">
      <rect x={f(x - 4)} y={f(y - 11)} width="30" height="22" rx="11" />
      <text x={f(x + 11)} y={f(y)} textAnchor="middle" dominantBaseline="central">
        {words}
      </text>
    </g>
  );
}

const ROUND_HANDLES: readonly [Handle, number, number][] = [
  ['nw', -1, -1],
  ['ne', 1, -1],
  ['se', 1, 1],
  ['sw', -1, 1],
];
const LONG_HANDLES: readonly [Handle, number, number][] = [
  ['nw', -1, -1],
  ['n', 0, -1],
  ['ne', 1, -1],
  ['e', 1, 0],
  ['se', 1, 1],
  ['s', 0, 1],
  ['sw', -1, 1],
  ['w', -1, 0],
];

/** sc-5028's handles: drawn 24 at a desk, each a 44 target; four on a round or cocktail table, eight on a long one, none on a row. */
function Handles({
  item,
  cx,
  cy,
  s,
  hands,
}: {
  item: Item;
  cx: number;
  cy: number;
  s: number;
  hands: RoomHands;
}) {
  if (item.kind === 'row' || item.kind === 'single') return null;
  const round = item.kind === 'round' || item.kind === 'cocktail';
  const hw = ((round ? (item.d ?? 180) : (item.w ?? 180)) / 2) * s;
  const hl = ((round ? (item.d ?? 180) : (item.l ?? 76)) / 2) * s;

  return (
    <g className="st-handles">
      {round && (
        <rect
          className="st-handle-box"
          x={f(cx - hw)}
          y={f(cy - hl)}
          width={f(2 * hw)}
          height={f(2 * hl)}
        />
      )}
      {(round ? ROUND_HANDLES : LONG_HANDLES).map(([name, sx, sy]) => {
        const [x, y] = turn([sx * hw, sy * hl], item.rot);

        return (
          <g key={name}>
            <rect
              className="st-handle"
              x={f(cx + x - 12)}
              y={f(cy + y - 12)}
              width="24"
              height="24"
              rx="5"
            />
            <rect
              className={`st-handle-hit is-${name}`}
              x={f(cx + x - 22)}
              y={f(cy + y - 22)}
              width="44"
              height="44"
              aria-hidden="true"
              onPointerDown={(event) => {
                event.stopPropagation();
                hands.onHandleDown?.(event, item.id, name);
              }}
            />
          </g>
        );
      })}
    </g>
  );
}

/** The room, to scale (sc-4007): a white floor with a 1 m grid, its walls, its name above, then every item in reading order as a named button. */
export function RoomDrawing({
  width,
  height,
  s,
  ox,
  oy,
  plan,
  units,
  items,
  detail,
  look,
  hands,
  readOnly,
  shrinkTo = null,
  tip = null,
  ghostAt = null,
  box = null,
  outlines = [],
  cover = null,
  onFloor,
  onFloorMouse,
}: {
  width: number;
  height: number;
  s: number;
  ox: number;
  oy: number;
  plan: Plan;
  units: 'metric' | 'us';
  items: readonly Item[];
  detail: Detail;
  look: Look;
  hands: RoomHands;
  readOnly: boolean;
  shrinkTo?: number | null;
  tip?: { at: Point; words: string } | null;
  ghostAt?: Item | null;
  box?: Rect | null;
  outlines?: readonly Outline[];
  cover?: Box | null;
  onFloor?: (event: PointerEvent<SVGSVGElement>) => void;
  onFloorMouse?: (event: MouseEvent<SVGSVGElement>) => void;
}) {
  const room = plan.room;

  if (room == null) return null;
  const rw = room.w * s;
  const rl = room.l * s;
  const step = 100 * s;
  const lines: ReactNode[] = [];

  if (step >= 6) {
    for (let i = 1; i < room.w / 100; i += 1)
      lines.push(
        <line
          key={`x${i}`}
          className={i % 5 === 0 ? 'st-grid is-five' : 'st-grid'}
          x1={f(ox + i * step)}
          y1={f(oy)}
          x2={f(ox + i * step)}
          y2={f(oy + rl)}
        />,
      );
    for (let j = 1; j < room.l / 100; j += 1)
      lines.push(
        <line
          key={`y${j}`}
          className={j % 5 === 0 ? 'st-grid is-five' : 'st-grid'}
          x1={f(ox)}
          y1={f(oy + j * step)}
          x2={f(ox + rw)}
          y2={f(oy + j * step)}
        />,
      );
  }
  const ordered = readingOrder(items.filter((item) => !look.faint.has(item.id)));
  const faint = items.filter((item) => look.faint.has(item.id));

  return (
    <svg
      className="st-room"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={say(SW.roomGroup, {
        name: room.name,
        width: lengthOf(room.w, units),
        length: lengthOf(room.l, units),
      })}
      onPointerDown={onFloor}
      onMouseDown={onFloorMouse}
    >
      <rect className="st-floor" x={f(ox)} y={f(oy)} width={f(rw)} height={f(rl)} />
      {lines}
      <rect className="st-walls" x={f(ox)} y={f(oy)} width={f(rw)} height={f(rl)} />
      <text
        className="st-room-line"
        x={f(ox)}
        y={f(oy - 14)}
        dominantBaseline="central"
        aria-hidden="true"
      >
        {say(SW.roomLine, {
          name: room.name,
          width: lengthOf(room.w, units),
          length: lengthOf(room.l, units),
        })}
      </text>
      {shrinkTo != null && (
        <line
          className="st-new-wall"
          x1={f(ox + shrinkTo * s)}
          y1={f(oy)}
          x2={f(ox + shrinkTo * s)}
          y2={f(oy + rl)}
        />
      )}
      {faint.map((item) => (
        <ItemDrawing
          key={`faint-${item.id}`}
          plan={plan}
          item={item}
          s={s}
          ox={ox}
          oy={oy}
          detail={detail}
          look={look}
          hands={hands}
          readOnly
          tabbable={false}
        />
      ))}
      {ordered.map((item) => (
        <ItemDrawing
          key={item.id}
          plan={plan}
          item={item}
          s={s}
          ox={ox}
          oy={oy}
          detail={detail}
          look={look}
          hands={hands}
          readOnly={readOnly}
          tabbable
        />
      ))}
      {ghostAt != null && (
        <g className="st-placing" aria-hidden="true">
          <ItemDrawing
            plan={plan}
            item={ghostAt}
            s={s}
            ox={ox}
            oy={oy}
            detail={detail}
            look={{ ...look, faint: new Set(), focus: null }}
            hands={{}}
            readOnly
            tabbable={false}
          />
        </g>
      )}
      {outlines.map((one, index) => (
        <rect
          key={`outline-${index}`}
          className={one.amber ? 'st-outline is-amber' : 'st-outline'}
          x={f(ox + one.x0 * s)}
          y={f(oy + one.y0 * s)}
          width={f((one.x1 - one.x0) * s)}
          height={f((one.y1 - one.y0) * s)}
          rx="6"
          aria-hidden="true"
        />
      ))}
      {box != null && (
        <rect
          className="st-box-drawn"
          x={f(ox + box.x0 * s)}
          y={f(oy + box.y0 * s)}
          width={f((box.x1 - box.x0) * s)}
          height={f((box.y1 - box.y0) * s)}
          aria-hidden="true"
        />
      )}
      {tip != null && (
        <Tip x={ox + tip.at[0] * s + 26} y={oy + tip.at[1] * s + 30} words={tip.words} />
      )}
      {look.picking === true &&
        (detail === 'out' ? outTags : freeTags)(ordered, s, ox, oy).map((tag) => (
          <FreeTag key={`free-${tag.id}`} x={tag.x} y={tag.y} n={tag.n} />
        ))}
      {detail !== 'out' && (
        <ChairLabel
          items={items}
          spot={look.label ?? null}
          s={s}
          ox={ox}
          oy={oy}
          width={width}
          cover={cover}
        />
      )}
    </svg>
  );
}

/** The chair's name above it on hover or focus, or under it where the bar over the room or the room's top would hide it, and slid inside the room's left and right edges (sc-5030). */
const LABEL_INSET = 8;

function ChairLabel({
  items,
  spot,
  s,
  ox,
  oy,
  width,
  cover,
}: {
  items: readonly Item[];
  spot: { id: string; i: number } | null;
  s: number;
  ox: number;
  oy: number;
  width: number;
  cover: Box | null;
}) {
  const item = spot == null ? undefined : items.find((one) => one.id === spot.id);
  const point = item == null || spot == null ? undefined : chairsOf(item)[spot.i];

  if (item == null || spot == null || point == null) return null;
  const [px, py] = turn(point, item.rot);
  const x = ox + (item.x + px) * s;
  const y = oy + (item.y + py) * s;
  const words = say(SW.seatLabel, {
    n: spot.i + 1,
    word: chairSaid(item.chairs[spot.i] ?? { state: 'empty' }),
  });
  const w = wordsWide(words) + 20;
  const left = Math.max(LABEL_INSET, Math.min(x - w / 2, width - LABEL_INSET - w));
  const over = y - CHAIR_R * s - 40;
  const hidden =
    over < 0 ||
    (cover != null && crosses({ x0: left, y0: over, x1: left + w, y1: over + 28 }, cover));
  const top = hidden ? y + CHAIR_R * s + 12 : over;

  return (
    <g className="st-tip" aria-hidden="true">
      <rect x={f(left)} y={f(top)} width={f(w)} height="28" rx="10" />
      <text x={f(left + w / 2)} y={f(top + 14)} textAnchor="middle" dominantBaseline="central">
        {words}
      </text>
    </g>
  );
}

function Tip({ x, y, words }: { x: number; y: number; words: string }) {
  const w = wordsWide(words) + 20;

  return (
    <g className="st-tip" aria-hidden="true">
      <rect x={f(x)} y={f(y)} width={f(w)} height="28" rx="10" />
      <text x={f(x + 10)} y={f(y + 14)} dominantBaseline="central">
        {words}
      </text>
    </g>
  );
}

/** From 200%, a 160 × 120 map of the whole room with the view's rectangle in Violet. */
export function MiniMap({
  plan,
  view,
}: {
  plan: Plan;
  view: { x: number; y: number; w: number; h: number };
}) {
  const room = plan.room;

  if (room == null) return null;
  const s = 160 / room.w;
  const h = Math.round(room.l * s);
  const empty: Look = {
    chosen: new Set(),
    lit: new Set(),
    faint: new Set(),
    overlap: new Set(),
    focus: null,
    rings: {},
    presence: 'chips',
    handles: null,
    chair: null,
    chairsFor: null,
  };

  return (
    <div className="st-float st-minimap" aria-hidden="true">
      <svg width="160" height={h} viewBox={`0 0 160 ${h}`} focusable="false">
        <rect className="st-floor" width="160" height={h} />
        {plan.items.map((item) => (
          <MiniItem key={item.id} plan={plan} item={item} s={s} look={empty} />
        ))}
        <rect className="st-walls is-thin" x="0.75" y="0.75" width="158.5" height={h - 1.5} />
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

function MiniItem({ plan, item, s, look }: { plan: Plan; item: Item; s: number; look: Look }) {
  const cx = item.x * s;
  const cy = item.y * s;

  if (isRound(item))
    return (
      <circle
        className={`st-body is-out ${sectionClass(plan, item)}`}
        cx={f(cx)}
        cy={f(cy)}
        r={f(Math.max(1.5, ((item.d ?? 44) / 2) * s))}
        data-look={look.focus}
      />
    );
  const [ex, ey] = item.kind === 'row' ? extent(item) : [(item.w ?? 180) / 2, (item.l ?? 76) / 2];

  return (
    <g transform={`translate(${f(cx)} ${f(cy)}) rotate(${item.rot})`}>
      <rect
        className={`st-body is-out ${sectionClass(plan, item)}`}
        x={f(-ex * s)}
        y={f(-ey * s)}
        width={f(2 * ex * s)}
        height={f(Math.max(1.5, 2 * ey * s))}
      />
    </g>
  );
}
