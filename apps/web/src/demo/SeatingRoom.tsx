import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

import {
  type Chair,
  type Detail,
  type Item,
  type Person,
  type Plan,
  type Point,
  CHAIR_R,
  SW,
  chairWord,
  chairsOf,
  extent,
  filled,
  initials,
  isRound,
  itemName,
  lengthOf,
  ofWords,
  readingOrder,
  say,
  sectionOf,
  turn,
  usable,
} from './seating.ts';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface Look {
  chosen: ReadonlySet<string>;
  lit: ReadonlySet<string>;
  faint: ReadonlySet<string>;
  overlap: ReadonlySet<string>;
  focus: string | null;
  rings: Readonly<Record<string, Person>>;
  handles: string | null;
  chair: { id: string; i: number } | null;
  /** Each chair takes a pointer from 150% (sc-5030); the chosen table's chairs take Tab too. */
  chairsFor: string | null;
}

export interface RoomHands {
  onItemDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
  onItemKey?: (event: KeyboardEvent<SVGGElement>, id: string) => void;
  onItemFocus?: (id: string | null) => void;
  onItemEnter?: (id: string | null) => void;
  onChair?: (id: string, index: number) => void;
  onHandleDown?: (event: PointerEvent<SVGRectElement>, id: string, handle: Handle) => void;
}

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

function fits(name: string, width: number): boolean {
  return name.length * 6.7 <= width - 3;
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

/** A seat state as a 16 to 26 mark beside its word: the legend, the seat strip, a table's guests. */
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
  const ring = look.rings[item.id];
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
      const target = near && look.chairsFor != null;

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
              className="st-chair-hit"
              role="button"
              tabIndex={look.chairsFor === item.id ? 0 : -1}
              aria-label={say(SW.chairName, {
                table: item.name,
                n: index + 1,
                word: chairWord(chair),
              })}
              aria-pressed={picked}
              cx={f(x)}
              cy={f(y)}
              r="22"
              onPointerDown={(event) => event.stopPropagation()}
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

  if (detail === 'out') {
    const by =
      item.kind === 'rect' || item.kind === 'head'
        ? cy + ((item.l ?? 76) / 2) * s + 12
        : cy + Math.max(ey, 40) * s * (item.kind === 'row' ? 1 : 0.55) + 12;

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
    if (item.kind !== 'single') {
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

  if (ring != null) {
    const pad = lit ? 10 : 2;

    if (round) {
      const rr = ex * s + pad + 3.5;

      marks.push(
        <g key="ring" className={`st-ring p${ring.tone}`}>
          <circle className="st-ring-gap" cx={f(cx)} cy={f(cy)} r={f(rr)} />
          <circle className="st-ring-line" cx={f(cx)} cy={f(cy)} r={f(rr + 1.5)} />
          <Pill x={cx - rr * 0.72} y={cy - rr * 0.72} words={ring.initials} />
        </g>,
      );
    } else {
      const gw = ex * s + pad + 2;
      const gh = ey * s + pad + 2;
      const [px, py] = turn([-gw, -gh], item.rot);

      marks.push(
        <g key="ring" className={`st-ring p${ring.tone}`}>
          <g transform={rot}>
            <rect
              className="st-ring-line"
              x={f(-gw - 1.5)}
              y={f(-gh - 1.5)}
              width={f(2 * gw + 3)}
              height={f(2 * gh + 3)}
              rx="10"
            />
          </g>
          <Pill x={cx + px} y={cy + py} words={ring.initials} />
        </g>,
      );
    }
  }
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
      aria-label={
        faint
          ? undefined
          : itemName(
              plan,
              item,
              ring != null && !ring.viewer ? say(SW.chosenBy, { name: ring.name }) : '',
            )
      }
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

function Pill({ x, y, words }: { x: number; y: number; words: string }) {
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
  onFloor,
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
  onFloor?: (event: PointerEvent<SVGSVGElement>) => void;
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
      {tip != null && (
        <Tip x={ox + tip.at[0] * s + 26} y={oy + tip.at[1] * s + 30} words={tip.words} />
      )}
    </svg>
  );
}

function Tip({ x, y, words }: { x: number; y: number; words: string }) {
  const w = words.length * 7 + 20;

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
