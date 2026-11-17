import {
  type MeasurementSystem,
  SEATING_LIMITS,
  type SeatingGuest,
  type SeatingPlan,
  type SeatingTable,
  TABLE_DEFAULTS,
  TABLE_SHAPES,
  type TableShape,
} from '@soirely/api-client';
import {
  CHAIR_RADIUS_CM,
  chairsOf,
  isRoundShape,
  readTableSide,
  holdingName,
  sidesOf,
  squeezed,
  tableExtent,
  TABLE_MAXIMUM_CM,
  TABLE_MINIMUM_CM,
  visibleLength,
} from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { TextAction } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import {
  CHAIRS_FROM_SCALE,
  f,
  POINTER_CHAIRS_FROM_SCALE,
  readCount,
  rotations,
  sectionOf,
  turned,
  usableSeats,
} from './seatingDraw.ts';
import {
  Added,
  BackHead,
  Field,
  Line,
  type PlanApi,
  Said,
  Select,
  ShapeTile,
} from './SeatingParts.tsx';
import { Overlaps, PositionFields } from './SeatingArrange.tsx';
import { ColleagueNote, ColleagueOutline } from './SeatingPresence.tsx';
import { chosenBy, useRings } from './seatingPresence.ts';
import { placementOf } from './seatingItems.ts';
import { type ChairState, chairStateOf, initialsOf, takenAt } from './seatingGuests.ts';
import {
  centimetreUnit,
  tableLengthWords,
  tableSideWords,
  tableSizeField,
  tableSizeWords,
} from './seatingUnits.ts';

type T = ReturnType<typeof useTranslation>['t'];

const SHAPE_WORDS = {
  round: {
    whole: 'seating.shapeRound',
    short: 'seating.shapeRoundShort',
    kind: 'seating.kindRound',
    menu: 'seating.menuRound',
  },
  rectangular: {
    whole: 'seating.shapeRectangular',
    short: 'seating.shapeRectangularShort',
    kind: 'seating.kindRectangular',
    menu: 'seating.menuRectangular',
  },
  head: {
    whole: 'seating.shapeHead',
    short: 'seating.shapeHeadShort',
    kind: 'seating.kindHead',
    menu: 'seating.menuHead',
  },
  cocktail: {
    whole: 'seating.shapeCocktail',
    short: 'seating.shapeCocktailShort',
    kind: 'seating.kindCocktail',
    menu: 'seating.menuCocktail',
  },
} as const satisfies Record<
  TableShape,
  { whole: string; short: string; kind: string; menu: string }
>;

const SIZE_RESET = {
  round: 'seating.sizeResetRound',
  rectangular: 'seating.sizeResetRectangular',
  head: 'seating.sizeResetHead',
  cocktail: 'seating.sizeResetCocktail',
} as const satisfies Record<TableShape, string>;

function seatsWords(t: T, shape: TableShape, count: number): string {
  return shape === 'cocktail'
    ? t('seating.countPlaces', { count })
    : t('seating.countSeats', { count });
}

export function tableLine(t: T, plan: SeatingPlan, table: SeatingTable): string {
  return t('seating.tableLine', {
    shape: t(SHAPE_WORDS[table.shape].whole),
    section: sectionOf(plan, table)?.name ?? t('seating.noSection'),
    taken: takenAt(plan, table.id),
    seats: usableSeats(table),
  });
}

export function chairStateWord(t: T, state: ChairState, guest: SeatingGuest | null): string {
  if (state === 'taken') return guest?.fullName ?? t('seating.taken');
  return t(
    { held: 'seating.held', empty: 'seating.empty', unusable: 'seating.unusable' }[state] as
      'seating.held' | 'seating.empty' | 'seating.unusable',
  );
}

const FLOAT_MARGINS = 3 * 12;

/** The floating add bar: Add table's menu, Add row and Add seat; when the bar and the zoom do not fit the floor side by side, the two fold into one Add menu, and when even the folded bar does not fit, the zoom steps up a line (sc-55937). */
export function AddTable({
  ctx,
  floor,
  placing,
  onRow,
  onSeat,
}: {
  ctx: PlanApi;
  floor: number;
  placing: boolean;
  onRow: () => Promise<void>;
  onSeat: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [menu, setMenu] = useState(false);
  const [folded, setFolded] = useState(false);
  const [crowded, setCrowded] = useState(false);
  const [fromMenu, setFromMenu] = useState<'table' | 'other' | null>(null);
  const [wasPlacing, setWasPlacing] = useState(placing);
  const first = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const unfolded = useRef(0);

  useLayoutEffect(() => {
    const box = bar.current;

    if (box == null) return;
    if (!folded) unfolded.current = box.getBoundingClientRect().width;
    const zoom =
      box.parentElement?.querySelector<HTMLElement>('.st-zoom')?.getBoundingClientRect().width ?? 0;

    setFolded(unfolded.current + zoom + FLOAT_MARGINS > floor);
    setCrowded(folded && box.getBoundingClientRect().width + zoom + FLOAT_MARGINS > floor);
  }, [floor, folded, locale]);

  useEffect(() => {
    if (menu) first.current?.focus();
  }, [menu]);

  function adds(change: () => Promise<void>, chosen: 'table' | 'other' | null): Promise<void> {
    setMenu(false);
    setFromMenu(chosen);
    return change();
  }

  function add(shape: TableShape): Promise<void> {
    ctx.startPlacing({ kind: 'table', shape });
    return Promise.resolve();
  }

  if (placing !== wasPlacing) {
    setWasPlacing(placing);
    if (!placing) setFromMenu(null);
  }

  const on = menu || (placing && (folded ? fromMenu != null : fromMenu === 'table'));

  return (
    <>
      {menu && (
        <div
          className="st-float st-menu"
          role="menu"
          tabIndex={-1}
          aria-label={folded ? t('seating.add') : t('seating.addTable')}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            setMenu(false);
          }}
        >
          {TABLE_SHAPES.map((shape, index) => {
            const defaults = TABLE_DEFAULTS[shape];

            return (
              <button
                key={shape}
                ref={index === 0 ? first : undefined}
                type="button"
                role="menuitem"
                className="st-menu-row"
                onClick={() => void adds(() => add(shape), 'table')}
              >
                <ShapeTile glyph={shape === 'rectangular' ? 'rect' : shape} />
                {t(SHAPE_WORDS[shape].menu, {
                  size: tableSizeWords(t, locale, { shape, ...defaults }, ctx.system),
                  seats: seatsWords(t, shape, defaults.seats),
                })}
              </button>
            );
          })}
          {folded && (
            <>
              <button
                type="button"
                role="menuitem"
                className="st-menu-row"
                onClick={() => void adds(onRow, 'other')}
              >
                <ShapeTile glyph="row" />
                {t('seating.menuRow')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="st-menu-row"
                onClick={() => void adds(onSeat, 'other')}
              >
                <ShapeTile glyph="seat1" />
                {t('seating.singleSeat')}
              </button>
            </>
          )}
        </div>
      )}
      <div
        className={crowded ? 'st-float st-add is-crowded' : 'st-float st-add'}
        role="group"
        aria-label={t('seating.addBar')}
        ref={bar}
      >
        <button
          type="button"
          className={on ? 'st-tool is-on' : 'st-tool'}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((open) => !open)}
        >
          <Glyph name="plus" size={18} weight={2.2} />
          {folded ? t('seating.add') : t('seating.addTable')}
          <Glyph name="chevdown" size={15} weight={2.4} />
        </button>
        {!folded && (
          <>
            <button type="button" className="st-tool" onClick={() => void adds(onRow, null)}>
              <Glyph name="row" size={18} weight={2.2} />
              {t('seating.addRow')}
            </button>
            <button type="button" className="st-tool" onClick={() => void adds(onSeat, null)}>
              <Glyph name="seat1" size={18} weight={2.2} />
              {t('seating.addSeat')}
            </button>
          </>
        )}
      </div>
    </>
  );
}

/** One table at s px per cm, as the demo's ItemDrawing draws it: the lit Tint, the body, its chairs, its name, then the outline of a refused room size. */
export function TableDrawing({
  plan,
  table,
  s,
  ox,
  oy,
  chosen,
  chosenSeat,
  outside,
  onChoose,
  onChair,
}: {
  plan: SeatingPlan;
  table: SeatingTable;
  s: number;
  ox: number;
  oy: number;
  chosen: boolean;
  chosenSeat: number | null;
  outside: boolean;
  onChoose: () => void;
  onChair: (seat: number) => void;
}) {
  const { t } = useTranslation();
  const cx = ox + table.xCm * s;
  const cy = oy + table.yCm * s;
  const [ex, ey] = tableExtent(table);
  const round = isRoundShape(table.shape);
  const rot = `translate(${f(cx)} ${f(cy)}) rotate(${table.rotation})`;
  const near = s >= POINTER_CHAIRS_FROM_SCALE;
  const r = CHAIR_RADIUS_CM * s;
  const section = sectionOf(plan, table);
  const rings = useRings(table.id);
  const box = (pad: number, className: string, key: string) =>
    round ? (
      <circle key={key} className={className} cx={f(cx)} cy={f(cy)} r={f(ex * s + pad)} />
    ) : (
      <g key={key} transform={rot}>
        <rect
          className={className}
          x={f(-ex * s - pad)}
          y={f(-ey * s - pad)}
          width={f(2 * ex * s + 2 * pad)}
          height={f(2 * ey * s + 2 * pad)}
          rx={pad === 10 ? 12 : 8}
        />
      </g>
    );

  const out = s < CHAIRS_FROM_SCALE;
  const onTable = rings.filter((ring) => ring.chair == null || out);
  const seatRings: ReactNode[] = [];
  const body = round ? (
    <circle
      className={out ? 'st-body is-out' : 'st-body'}
      cx={f(cx)}
      cy={f(cy)}
      r={f((table.widthCm / 2) * s)}
    />
  ) : (
    <g transform={rot}>
      <rect
        className="st-body"
        x={f((-table.widthCm / 2) * s)}
        y={f((-table.lengthCm / 2) * s)}
        width={f(table.widthCm * s)}
        height={f(table.lengthCm * s)}
        rx={f(Math.min(4, (table.lengthCm * s) / 4))}
      />
    </g>
  );

  const chairs: ReactNode[] = [];

  if (!out)
    chairsOf(table).forEach((chair) => {
      const [px, py] = turned([chair.x, chair.y], table.rotation);
      const x = cx + px * s;
      const y = cy + py * s;
      const { state, guest } = chairStateOf(
        plan,
        table.id,
        chair.seat,
        table.unusableSeats.includes(chair.seat),
      );
      const seated = rings.filter((ring) => ring.chair === chair.seat);

      seated.forEach((ring, step) =>
        seatRings.push(
          <ColleagueOutline
            key={`${chair.seat}:${ring.userId}`}
            ring={ring}
            step={step}
            round
            cx={x}
            cy={y}
            ex={r}
            ey={r}
            rotation={0}
            pad={2}
          />,
        ),
      );

      chairs.push(
        <g key={chair.seat}>
          {chosenSeat === chair.seat && (
            <circle className="st-lit" cx={f(x)} cy={f(y)} r={f(Math.max(r + 8, 26))} />
          )}
          <ChairMark
            x={x}
            y={y}
            r={r}
            state={state}
            square={table.shape === 'cocktail'}
            label={near ? chairLabel(state, guest, chair.seat) : undefined}
          />
          {(chosen || near) && (
            <circle
              className={near ? 'st-chair-hit' : 'st-chair-hit is-keys'}
              role="button"
              tabIndex={chosen ? 0 : -1}
              aria-label={chosenBy(
                t,
                t('seating.chairName', {
                  table: table.name,
                  seat: chair.seat,
                  state: chairStateWord(t, state, guest),
                }),
                seated.map((ring) => ({ ...ring, chair: null })),
              )}
              aria-pressed={chosenSeat === chair.seat}
              cx={f(x)}
              cy={f(y)}
              r="22"
              onClick={(event) => {
                event.stopPropagation();
                onChair(chair.seat);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onChair(chair.seat);
              }}
            />
          )}
        </g>,
      );
    });

  const lit = chosen && chosenSeat == null;
  const bodyW = table.widthCm * s;
  const bodyH = table.lengthCm * s;
  const inside = table.name.length * 6.2 <= bodyW - 3 && bodyH >= 15;
  const name = t('seating.tableName', {
    name: table.name,
    shape: t(SHAPE_WORDS[table.shape].kind),
    taken: takenAt(plan, table.id),
    count: usableSeats(table),
  });

  return (
    <g
      className={section == null ? 'st-item is-none' : `st-item is-${section.colour}`}
      role="button"
      tabIndex={0}
      aria-label={chosenBy(
        t,
        section == null ? name : t('seating.inSection', { name, section: section.name }),
        rings,
      )}
      aria-pressed={lit}
      data-table={table.id}
      onClick={onChoose}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.target !== event.currentTarget || event.key !== 'Enter') return;
        event.preventDefault();
        onChoose();
      }}
    >
      {lit && box(10, 'st-lit', 'lit')}
      {box(0, 'st-hit', 'hit')}
      <g className="st-item-body">
        {body}
        {chairs}
      </g>
      {out ? (
        <OutWords
          x={cx}
          y={round ? cy + Math.max(ey, 40) * s * 0.55 + 12 : cy + (table.lengthCm / 2) * s + 12}
          name={table.name}
          taken={takenAt(plan, table.id)}
          seats={usableSeats(table)}
        />
      ) : (
        <text
          className="st-name"
          x={f(cx)}
          y={f(inside ? cy : cy + ey * s + 10)}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {table.name}
        </text>
      )}
      {onTable.map((ring, step) => (
        <ColleagueOutline
          key={ring.userId}
          ring={ring}
          step={step}
          round={round}
          cx={cx}
          cy={cy}
          ex={ex * s}
          ey={ey * s}
          rotation={table.rotation}
          pad={lit ? 10 : 2}
        />
      ))}
      {seatRings}
      {outside && box(6, 'st-overlap', 'outside')}
    </g>
  );
}

const BAR_WIDTH = 44;

/** Under 50% an item is its outline, its name and how full it is: a bar and "{taken} of {seats}". */
export function OutWords({
  x,
  y,
  name,
  taken,
  seats,
}: {
  x: number;
  y: number;
  name: string;
  taken: number;
  seats: number | null;
}) {
  const { t } = useTranslation();

  return (
    <g aria-hidden="true">
      <text className="st-name" x={f(x)} y={f(y)} textAnchor="middle" dominantBaseline="central">
        {name}
      </text>
      {seats != null && (
        <>
          <rect
            className="st-fill-track"
            x={f(x - BAR_WIDTH / 2)}
            y={f(y + 10)}
            width={BAR_WIDTH}
            height="5"
            rx="2.5"
          />
          <rect
            className="st-fill"
            x={f(x - BAR_WIDTH / 2)}
            y={f(y + 10)}
            width={f((BAR_WIDTH * taken) / Math.max(1, seats))}
            height="5"
            rx="2.5"
          />
          <text
            className="st-of"
            x={f(x)}
            y={f(y + 25)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {t('seating.takenOf', { taken, seats })}
          </text>
        </>
      )}
    </g>
  );
}

/** A chair in its state, a shape each: Taken filled ink, Held half filled, Empty an outline, Unusable grey with a cross; a cocktail table's standing places are rounded squares. */
export function ChairMark({
  x,
  y,
  r,
  state,
  square,
  label,
}: {
  x: number;
  y: number;
  r: number;
  state: ChairState;
  square: boolean;
  label: string | undefined;
}) {
  const near = label != null ? ' is-near' : '';
  const className = `st-chair is-${state}${near}`;
  const k = r * 0.45;

  return (
    <>
      {square ? (
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
      )}
      {state === 'held' && (
        <path
          className="st-chair-half"
          d={`M${f(x)} ${f(y - r)} A${f(r)} ${f(r)} 0 0 0 ${f(x)} ${f(y + r)} Z`}
        />
      )}
      {state === 'unusable' ? (
        <path
          className={`st-chair-cross${near}`}
          d={`M${f(x - k)} ${f(y - k)}L${f(x + k)} ${f(y + k)}M${f(x + k)} ${f(y - k)}L${f(x - k)} ${f(y + k)}`}
        />
      ) : (
        label != null &&
        label !== '' &&
        state !== 'held' && (
          <text
            className={state === 'taken' ? 'st-chair-text is-on-dark' : 'st-chair-text'}
            x={f(x)}
            y={f(y)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {label}
          </text>
        )
      )}
    </>
  );
}

/** Up close a taken chair shows its guest's initials, any other its number. */
export function chairLabel(state: ChairState, guest: SeatingGuest | null, seat: number): string {
  return state === 'taken' && guest?.fullName != null ? initialsOf(guest.fullName) : String(seat);
}

export function StateMark({
  state,
  square = false,
  size = 22,
}: {
  state: ChairState;
  square?: boolean;
  size?: number;
}) {
  return (
    <svg
      className="st-state-mark"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <ChairMark
        x={size / 2}
        y={size / 2}
        r={size / 2 - 1.5}
        state={state}
        square={square}
        label=""
      />
    </svg>
  );
}

/** What the seats show: each state's shape beside its word (sc-4013). */
export function SeatLegend() {
  const { t } = useTranslation();
  const states: ChairState[] = ['taken', 'held', 'empty', 'unusable'];

  return (
    <ul className="st-legend" aria-label={t('seating.legend')}>
      {states.map((state) => (
        <li key={state}>
          <StateMark state={state} size={16} />
          {t(
            {
              taken: 'seating.taken',
              held: 'seating.held',
              empty: 'seating.empty',
              unusable: 'seating.unusable',
            }[state] as 'seating.taken',
          )}
        </li>
      ))}
    </ul>
  );
}

function endsLine(t: T, table: SeatingTable): string {
  const { top, right, bottom, left } = sidesOf(table);

  if (table.shape === 'head')
    return right + left > 0
      ? t('seating.headEndsLine', { count: bottom, left, right })
      : t('seating.headLine', { count: bottom });
  return t('seating.endsLine', { left, right, top, bottom });
}

/** Blank, unreadable or out of range, in the organisation's units, before anything is sent. */
function readSize(
  t: T,
  locale: string,
  text: string,
  system: MeasurementSystem,
): { cm: number } | { refused: string } {
  const read = readTableSide(text, system, locale);

  if (read.kind === 'cm') return { cm: read.cm };
  if (read.kind === 'unreadable' && system === 'us') return { refused: t('seating.usHint') };
  return {
    refused: t('seating.tableSizeRange', {
      min: tableLengthWords(t, locale, TABLE_MINIMUM_CM, system, {
        grouping: false,
        rounding: 'up',
      }),
      max: tableLengthWords(t, locale, TABLE_MAXIMUM_CM, system, {
        grouping: false,
        rounding: 'down',
      }),
    }),
  };
}

export function TablePanel({
  ctx,
  plan,
  table,
  said,
}: {
  ctx: PlanApi;
  plan: SeatingPlan;
  table: SeatingTable;
  said: string | undefined;
}) {
  const { t } = useTranslation();
  const leave = () => ctx.open(null);
  const locale = currentLocale();
  const note = ctx.note?.id === table.id ? ctx.note.line : null;
  const round = isRoundShape(table.shape);
  const cocktail = table.shape === 'cocktail';
  const unit = ctx.system === 'us' ? undefined : centimetreUnit(locale);

  const change = async (
    changes: Parameters<typeof api.changeSeatingTable>[2],
    field?: string,
    line: string | null = null,
  ) => {
    let saved = false;
    const refused = await ctx.send(async () => {
      const answer = await api.changeSeatingTable(
        ctx.event.id,
        table.id,
        changes,
        ctx.newest(table).version,
      );

      saved = true;
      return answer;
    }, field);

    if (saved) ctx.keepNote(line == null ? null : { id: table.id, line });
    return refused;
  };

  function size(key: 'widthCm' | 'lengthCm', text: string): Promise<string | null> | string {
    const read = readSize(t, locale, text, ctx.system);

    if ('refused' in read) return read.refused;
    return change(round ? { widthCm: read.cm, lengthCm: read.cm } : { [key]: read.cm }, key);
  }

  function seats(text: string): Promise<string | null> | string {
    const n = readCount(text);

    if (n == null || n < SEATING_LIMITS.tableSeatsMinimum || n > SEATING_LIMITS.tableSeatsMaximum)
      return t(cocktail ? 'seating.placesRange' : 'seating.seatsRange', {
        min: SEATING_LIMITS.tableSeatsMinimum,
        max: SEATING_LIMITS.tableSeatsMaximum,
      });
    return change({ seats: n }, 'seats');
  }

  function name(text: string): Promise<string | null> | string {
    const typed = text.trim();

    if (typed === '') return t('seating.tableBlank');
    if (visibleLength(typed) > SEATING_LIMITS.tableNameMaximum)
      return t('seating.tableLong', { max: SEATING_LIMITS.tableNameMaximum });
    const holder = holdingName(plan.tables, typed, table.id);

    if (holder != null) return t('seating.tableTaken', { name: holder.name });
    return change({ name: typed }, 'name');
  }

  if (ctx.readOnly) return <TableFacts ctx={ctx} plan={plan} table={table} />;

  return (
    <div className="st-stack is-tight">
      <BackHead title={table.name} line={tableLine(t, plan, table)} />
      {said != null && <Added>{said}</Added>}
      {ctx.notice != null && <Said>{ctx.notice}</Said>}
      {note != null && <Line>{note}</Line>}
      {squeezed(table) && (
        <Said>
          {t('seating.squeeze', {
            seats: seatsWords(t, table.shape, table.seats),
            size: tableSizeWords(t, locale, table, ctx.system),
          })}
        </Said>
      )}
      <div className="st-fields">
        <Field
          onLeave={leave}
          fieldKey="name"
          label={t('seating.name')}
          value={table.name}
          onCommit={name}
        />
        <Select
          fieldKey="section"
          label={t('seating.section')}
          value={table.sectionId ?? ''}
          options={[
            { value: '', word: t('seating.noSection') },
            ...plan.sections.map((one) => ({ value: one.id, word: one.name })),
          ]}
          onPick={(value) => void change({ sectionId: value === '' ? null : value })}
        />
        <Select
          fieldKey="shape"
          label={t('seating.shape')}
          value={table.shape}
          options={TABLE_SHAPES.map((shape) => ({
            value: shape,
            word: t(SHAPE_WORDS[shape].short),
          }))}
          onPick={(value) => {
            const shape = TABLE_SHAPES.find((one) => one === value);

            if (shape == null) return;
            void change(
              { shape },
              undefined,
              t(SIZE_RESET[shape], {
                size: tableSizeWords(t, locale, { shape, ...TABLE_DEFAULTS[shape] }, ctx.system),
                count: table.seats,
              }),
            );
          }}
        />
        {round ? (
          <div className="st-two">
            <Field
              onLeave={leave}
              fieldKey="seats"
              label={t(cocktail ? 'seating.places' : 'seating.seats')}
              value={String(table.seats)}
              onCommit={seats}
            />
            <Field
              onLeave={leave}
              fieldKey="diameter"
              label={t('seating.diameter')}
              unit={unit}
              inputMode="decimal"
              value={tableSizeField(t, locale, table.widthCm, ctx.system)}
              onCommit={(text) => size('widthCm', text)}
            />
          </div>
        ) : (
          <>
            <div className="st-two">
              <Field
                onLeave={leave}
                fieldKey="width"
                label={t('seating.width')}
                unit={unit}
                inputMode="decimal"
                value={tableSizeField(t, locale, table.widthCm, ctx.system)}
                onCommit={(text) => size('widthCm', text)}
              />
              <Field
                onLeave={leave}
                fieldKey="length"
                label={t('seating.length')}
                unit={unit}
                inputMode="decimal"
                value={tableSizeField(t, locale, table.lengthCm, ctx.system)}
                onCommit={(text) => size('lengthCm', text)}
              />
            </div>
            <div className="st-two">
              <Field
                onLeave={leave}
                fieldKey="seats"
                label={t('seating.seats')}
                value={String(table.seats)}
                onCommit={seats}
              />
              <Field
                onLeave={leave}
                fieldKey="ends"
                label={t('seating.ends')}
                value={String(table.endSeats)}
                onCommit={(text) => {
                  const n = readCount(text);

                  if (n == null || n > table.seats)
                    return t('seating.endsRange', { max: table.seats });
                  return change({ endSeats: n }, 'endSeats');
                }}
              />
            </div>
            <Line>{endsLine(t, table)}</Line>
          </>
        )}
        <PositionFields ctx={ctx} item={{ kind: 'table', one: table }} />
        {ctx.system === 'us' && <Line>{t('seating.usHint')}</Line>}
        {!round && (
          <Select
            fieldKey="rotation"
            label={t('seating.rotation')}
            value={String(table.rotation)}
            options={rotations()}
            onPick={(value) =>
              ctx.arrange([
                { ...placementOf({ kind: 'table', one: table }), rotation: Number(value) },
              ])
            }
          />
        )}
      </div>
      <Overlaps plan={plan} id={table.id} />
      <ColleagueNote id={table.id} />
      <div className="st-acts">
        <TextAction
          label={t('seating.duplicate')}
          onClick={() => {
            void ctx
              .place(() =>
                api.duplicateSeatingTable(ctx.event.id, table.id, ctx.newest(table).version),
              )
              .then((copy) => {
                if (copy == null) return;
                ctx.open({
                  kind: 'table',
                  id: copy.id,
                  said: t('seating.duplicated', { name: copy.name, of: table.name }),
                });
              });
          }}
        />
        <TextAction
          label={t('seating.deleteTable')}
          red
          onClick={() => ctx.ask({ kind: 'deleteTable', id: table.id })}
        />
      </div>
    </div>
  );
}

function TableFacts({
  ctx,
  plan,
  table,
}: {
  ctx: PlanApi;
  plan: SeatingPlan;
  table: SeatingTable;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const facts: [string, string][] = [
    [t('seating.section'), sectionOf(plan, table)?.name ?? t('seating.noSection')],
    [t('seating.shape'), t(SHAPE_WORDS[table.shape].whole)],
    [t(table.shape === 'cocktail' ? 'seating.places' : 'seating.seats'), String(table.seats)],
    [
      t(isRoundShape(table.shape) ? 'seating.diameter' : 'seating.width'),
      tableSideWords(t, locale, table.widthCm, ctx.system),
    ],
  ];

  return (
    <div className="st-stack">
      <BackHead title={table.name} line={tableLine(t, plan, table)} />
      <dl className="st-facts">
        {facts.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Line>{t('seating.readOnly')}</Line>
    </div>
  );
}

export function ChairPanel({
  ctx,
  plan,
  table,
  seat,
}: {
  ctx: PlanApi;
  plan: SeatingPlan;
  table: SeatingTable;
  seat: number;
}) {
  const { t } = useTranslation();
  const unusable = table.unusableSeats.includes(seat);
  const { state, guest } = chairStateOf(plan, table.id, seat, unusable);

  return (
    <div className="st-stack">
      <BackHead
        title={t('seating.chairTitle', { table: table.name, seat })}
        line={`${t(SHAPE_WORDS[table.shape].whole)} · ${sectionOf(plan, table)?.name ?? t('seating.noSection')}`}
      />
      <p className="st-state-line is-big">
        <StateMark state={state} square={table.shape === 'cocktail'} />
        {chairStateWord(t, state, guest)}
      </p>
      {!ctx.readOnly && (
        <div className="st-acts">
          <TextAction
            label={t(unusable ? 'seating.markUsable' : 'seating.markUnusable')}
            onClick={() =>
              void ctx.send(() => {
                const now = ctx.newest(table);

                return api.changeSeatingTable(
                  ctx.event.id,
                  table.id,
                  {
                    unusableSeats: unusable
                      ? now.unusableSeats.filter((one) => one !== seat)
                      : [...new Set([...now.unusableSeats, seat])].sort((a, b) => a - b),
                  },
                  now.version,
                );
              })
            }
          />
        </div>
      )}
      {ctx.notice != null && <Said>{ctx.notice}</Said>}
      <SeatLegend />
    </div>
  );
}
