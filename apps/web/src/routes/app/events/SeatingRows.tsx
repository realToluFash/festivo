import {
  SEATING_LIMITS,
  type SeatingPlan,
  type SeatingRow,
  type SeatingRowChanges,
  type SingleSeat,
} from '@soirely/api-client';
import {
  CHAIR_RADIUS_CM,
  holdingName,
  readRowSpacing,
  ROW_SPACING_MAXIMUM_CM,
  ROW_SPACING_MINIMUM_CM,
  rowExtent,
  rowSeatsOf,
  rowTabAt,
  visibleLength,
} from '@soirely/domain';
import { type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { TextAction } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { Added, BackHead, Field, Line, type PlanApi, Said, Select } from './SeatingParts.tsx';
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
import { ChairMark, OutWords, StateMark } from './SeatingTables.tsx';
import {
  centimetreUnit,
  tableLengthWords,
  tableSideWords,
  tableSizeField,
} from './seatingUnits.ts';

type T = ReturnType<typeof useTranslation>['t'];

const STRIP_SHOWS = 5;

function stateWord(t: T, unusable: boolean): string {
  return unusable ? t('seating.unusable') : t('seating.empty');
}

function rowLine(t: T, plan: SeatingPlan, row: SeatingRow): string {
  return t('seating.tableLine', {
    shape: t('seating.rowOf', { count: row.seats }),
    section: sectionOf(plan, row)?.name ?? t('seating.noSection'),
    taken: 0,
    seats: usableSeats(row),
  });
}

function sectionOptions(t: T, plan: SeatingPlan) {
  return [
    { value: '', word: t('seating.noSection') },
    ...plan.sections.map((one) => ({ value: one.id, word: one.name })),
  ];
}

function itemClass(plan: SeatingPlan, item: { sectionId: string | null }): string {
  const section = sectionOf(plan, item);

  return section == null ? 'st-item is-none' : `st-item is-${section.colour}`;
}

function onKeys(onChoose: () => void) {
  return (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onChoose();
  };
}

/** Add row and Add seat, for the floating bar or the folded Add menu: each lands in the nearest free space. */
export function useAddRowAndSeat(ctx: PlanApi): {
  addRow: () => Promise<void>;
  addSeat: () => Promise<void>;
} {
  const { t } = useTranslation();

  async function addRow(): Promise<void> {
    const added = await ctx.place(() => api.addSeatingRow(ctx.event.id));

    if (added != null)
      ctx.open({
        kind: 'row',
        id: added.id,
        said: t('seating.rowAdded', { label: added.name, count: added.seats }),
      });
  }

  async function addSeat(): Promise<void> {
    const added = await ctx.place(() => api.addSingleSeat(ctx.event.id));

    if (added != null)
      ctx.open({ kind: 'seat', id: added.id, said: t('seating.added', { name: added.name }) });
  }

  return { addRow, addSeat };
}

/** A row at s px per cm, as the demo draws it: its label in a tab past seat 1, then its seats, numbered once near. */
export function RowDrawing({
  plan,
  row,
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
  row: SeatingRow;
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
  const cx = ox + row.xCm * s;
  const cy = oy + row.yCm * s;
  const [ex, ey] = rowExtent(row);
  const near = s >= POINTER_CHAIRS_FROM_SCALE;
  const r = CHAIR_RADIUS_CM * s;
  const section = sectionOf(plan, row);
  const name = t('seating.rowName', { label: row.label });
  const box = (pad: number, className: string) => (
    <g transform={`translate(${f(cx)} ${f(cy)}) rotate(${row.rotation})`}>
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
  const [sx, sy] = turned(rowTabAt(row), row.rotation);
  const tx = cx + sx * s;
  const ty = cy + sy * s;
  const th = Math.max(20, 2 * r);
  const seats: ReactNode[] = [];

  if (s >= CHAIRS_FROM_SCALE)
    rowSeatsOf(row).forEach((chair) => {
      const [px, py] = turned([chair.x, chair.y], row.rotation);
      const x = cx + px * s;
      const y = cy + py * s;
      const unusable = row.unusableSeats.includes(chair.seat);

      seats.push(
        <g key={chair.seat}>
          {chosenSeat === chair.seat && (
            <circle className="st-lit" cx={f(x)} cy={f(y)} r={f(Math.max(r + 8, 26))} />
          )}
          <ChairMark
            x={x}
            y={y}
            r={r}
            unusable={unusable}
            square={false}
            label={near ? String(chair.seat) : undefined}
          />
          {(chosen || near) && (
            <circle
              className={near ? 'st-chair-hit' : 'st-chair-hit is-keys'}
              role="button"
              tabIndex={chosen ? 0 : -1}
              aria-label={t('seating.rowSeatName', {
                label: row.label,
                seat: chair.seat,
                state: stateWord(t, unusable),
              })}
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

  const said = t('seating.tableName', {
    name,
    shape: t('seating.kindRow', { count: row.seats }),
    taken: 0,
    count: usableSeats(row),
  });

  return (
    <g
      className={itemClass(plan, row)}
      role="button"
      tabIndex={0}
      aria-label={
        section == null ? said : t('seating.inSection', { name: said, section: section.name })
      }
      aria-pressed={chosen}
      data-row={row.id}
      onClick={onChoose}
      onKeyDown={onKeys(onChoose)}
    >
      {chosen && box(10, 'st-lit')}
      {box(0, 'st-hit')}
      <g className="st-item-body">
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
          {row.label}
        </text>
        {seats}
      </g>
      {s < CHAIRS_FROM_SCALE && (
        <OutWords
          x={cx}
          y={cy + Math.max(ey, 40) * s + 12}
          name={name}
          taken={0}
          seats={usableSeats(row)}
        />
      )}
      {outside && box(6, 'st-overlap')}
    </g>
  );
}

/** A seat that belongs to no table: a dashed chair, its name beside it once near enough to read. */
export function SingleSeatDrawing({
  plan,
  seat,
  s,
  ox,
  oy,
  chosen,
  outside,
  onChoose,
}: {
  plan: SeatingPlan;
  seat: SingleSeat;
  s: number;
  ox: number;
  oy: number;
  chosen: boolean;
  outside: boolean;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const cx = ox + seat.xCm * s;
  const cy = oy + seat.yCm * s;
  const r = Math.max(5, CHAIR_RADIUS_CM * s);
  const section = sectionOf(plan, seat);
  const said = t('seating.singleSeatName', {
    name: seat.name,
    state: stateWord(t, seat.unusable),
  });

  return (
    <g
      className={itemClass(plan, seat)}
      role="button"
      tabIndex={0}
      aria-label={
        section == null ? said : t('seating.inSection', { name: said, section: section.name })
      }
      aria-pressed={chosen}
      data-seat={seat.id}
      onClick={onChoose}
      onKeyDown={onKeys(onChoose)}
    >
      {chosen && <circle className="st-lit" cx={f(cx)} cy={f(cy)} r={f(r + 10)} />}
      <circle className="st-hit" cx={f(cx)} cy={f(cy)} r={f(Math.max(r, 22))} />
      <g className="st-item-body">
        <circle className="st-body is-single" cx={f(cx)} cy={f(cy)} r={f(r)} />
        {seat.unusable && (
          <ChairMark x={cx} y={cy} r={r} unusable square={false} label={undefined} />
        )}
      </g>
      {s >= CHAIRS_FROM_SCALE ? (
        <text className="st-name is-quiet" x={f(cx + r + 6)} y={f(cy)} dominantBaseline="central">
          {seat.name}
        </text>
      ) : (
        <OutWords x={cx} y={cy + 40 * s * 0.55 + 12} name={seat.name} taken={0} seats={null} />
      )}
      {outside && <circle className="st-overlap" cx={f(cx)} cy={f(cy)} r={f(r + 6)} />}
    </g>
  );
}

export function RowPanel({
  ctx,
  plan,
  row,
  said,
  seat,
}: {
  ctx: PlanApi;
  plan: SeatingPlan;
  row: SeatingRow;
  said: string | undefined;
  seat: number | null;
}) {
  const { t } = useTranslation();
  const leave = () => ctx.open(null);
  const locale = currentLocale();
  const name = t('seating.rowName', { label: row.label });

  const change = (changes: SeatingRowChanges, field?: string) =>
    ctx.send(
      () => api.changeSeatingRow(ctx.event.id, row.id, changes, ctx.newest(row).version),
      field,
    );

  function label(text: string): Promise<string | null> | string {
    const typed = text.trim().toUpperCase();

    if (typed === '') return t('seating.rowBlank');
    if (visibleLength(typed) > SEATING_LIMITS.rowLabelMaximum)
      return t('seating.tableLong', { max: SEATING_LIMITS.rowLabelMaximum });
    const labelled = plan.rows.map((one) => ({ id: one.id, name: one.label }));

    if (holdingName(labelled, typed, row.id) != null)
      return t('seating.rowTaken', { label: typed });
    return change({ label: typed }, 'label');
  }

  function seats(text: string): Promise<string | null> | string {
    const n = readCount(text);

    if (n == null || n < SEATING_LIMITS.rowSeatsMinimum || n > SEATING_LIMITS.rowSeatsMaximum)
      return t('seating.seatsRange', {
        min: SEATING_LIMITS.rowSeatsMinimum,
        max: SEATING_LIMITS.rowSeatsMaximum,
      });
    return change({ seats: n }, 'seats');
  }

  function spacing(text: string): Promise<string | null> | string {
    const read = readRowSpacing(text, ctx.system, locale);

    if (read.kind === 'cm') return change({ spacingCm: read.cm }, 'spacingCm');
    if (read.kind === 'unreadable' && ctx.system === 'us') return t('seating.usHint');
    return t('seating.spacingRange', {
      min: tableLengthWords(t, locale, ROW_SPACING_MINIMUM_CM, ctx.system, { grouping: false }),
      max: tableLengthWords(t, locale, ROW_SPACING_MAXIMUM_CM, ctx.system, { grouping: false }),
    });
  }

  const pick = (next: number) =>
    ctx.open({ kind: 'row', id: row.id, ...(next === seat ? {} : { seat: next }) });

  if (ctx.readOnly)
    return (
      <div className="st-stack">
        <BackHead title={name} line={rowLine(t, plan, row)} />
        <SeatStrip t={t} row={row} chosen={seat} onPick={pick} />
        {seat != null && <ChosenSeat ctx={ctx} row={row} seat={seat} />}
        <dl className="st-facts">
          {[
            [t('seating.section'), sectionOf(plan, row)?.name ?? t('seating.noSection')],
            [t('seating.seats'), String(row.seats)],
            [t('seating.spacing'), tableSideWords(t, locale, row.spacingCm, ctx.system)],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <Line>{t('seating.readOnly')}</Line>
      </div>
    );

  return (
    <div className="st-stack is-tight">
      <BackHead title={name} line={rowLine(t, plan, row)} />
      {said != null && <Added>{said}</Added>}
      {ctx.notice != null && <Said>{ctx.notice}</Said>}
      <Line>{t('seating.faces')}</Line>
      <SeatStrip t={t} row={row} chosen={seat} onPick={pick} />
      {seat != null && <ChosenSeat ctx={ctx} row={row} seat={seat} />}
      <div className="st-fields">
        <Field
          onLeave={leave}
          fieldKey="label"
          label={t('seating.label')}
          value={row.label}
          onCommit={label}
        />
        <Select
          fieldKey="section"
          label={t('seating.section')}
          value={row.sectionId ?? ''}
          options={sectionOptions(t, plan)}
          onPick={(value) => void change({ sectionId: value === '' ? null : value })}
        />
        <div className="st-two">
          <Field
            onLeave={leave}
            fieldKey="seats"
            label={t('seating.seats')}
            value={String(row.seats)}
            onCommit={seats}
          />
          <Field
            onLeave={leave}
            fieldKey="spacing"
            label={t('seating.spacing')}
            unit={ctx.system === 'us' ? undefined : centimetreUnit(locale)}
            inputMode="decimal"
            value={tableSizeField(t, locale, row.spacingCm, ctx.system)}
            onCommit={spacing}
          />
        </div>
        {ctx.system === 'us' && <Line>{t('seating.usHint')}</Line>}
        <Select
          fieldKey="rotation"
          label={t('seating.rotation')}
          value={String(row.rotation)}
          options={rotations()}
          onPick={(value) => void change({ rotation: Number(value) })}
        />
      </div>
      <div className="st-acts">
        <TextAction
          label={t('seating.duplicate')}
          onClick={() => {
            void ctx
              .place(() => api.duplicateSeatingRow(ctx.event.id, row.id, ctx.newest(row).version))
              .then((copy) => {
                if (copy == null) return;
                ctx.open({
                  kind: 'row',
                  id: copy.id,
                  said: t('seating.duplicated', {
                    name: t('seating.rowName', { label: copy.name }),
                    of: name,
                  }),
                });
              });
          }}
        />
        <TextAction
          label={t('seating.deleteRow')}
          red
          onClick={() => ctx.ask({ kind: 'deleteRow', id: row.id })}
        />
      </div>
    </div>
  );
}

/** Five seats at a time from seat 1, moving on so the chosen one stays in view; the rest counted to the right. */
function SeatStrip({
  t,
  row,
  chosen,
  onPick,
}: {
  t: T;
  row: SeatingRow;
  chosen: number | null;
  onPick: (seat: number) => void;
}) {
  const first = chosen != null && chosen > STRIP_SHOWS ? chosen - STRIP_SHOWS + 1 : 1;
  const last = Math.min(row.seats, first + STRIP_SHOWS - 1);
  const shown = Array.from({ length: last - first + 1 }, (_, index) => first + index);

  return (
    <div className="st-strip">
      {shown.map((seat) => {
        const unusable = row.unusableSeats.includes(seat);

        return (
          <button
            key={seat}
            type="button"
            className={seat === chosen ? 'st-strip-seat is-on' : 'st-strip-seat'}
            aria-pressed={seat === chosen}
            aria-label={t('seating.rowSeatName', {
              label: row.label,
              seat,
              state: stateWord(t, unusable),
            })}
            onClick={() => onPick(seat)}
          >
            <StateMark unusable={unusable} square={false} />
            <span>{seat}</span>
          </button>
        );
      })}
      {row.seats > last && (
        <span className="st-strip-more">
          {t('seating.toTheRight', { count: row.seats - last })}
        </span>
      )}
    </div>
  );
}

function ChosenSeat({ ctx, row, seat }: { ctx: PlanApi; row: SeatingRow; seat: number }) {
  const { t } = useTranslation();
  const unusable = row.unusableSeats.includes(seat);

  return (
    <div className="st-block">
      <p className="st-strong">
        {t('seating.rowSeatState', { label: row.label, seat, state: stateWord(t, unusable) })}
      </p>
      {!ctx.readOnly && (
        <div className="st-acts">
          <TextAction
            label={t(unusable ? 'seating.markUsable' : 'seating.markUnusable')}
            onClick={() =>
              void ctx.send(() => {
                const now = ctx.newest(row);

                return api.changeSeatingRow(
                  ctx.event.id,
                  row.id,
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
    </div>
  );
}

export function SingleSeatPanel({
  ctx,
  plan,
  seat,
  said,
}: {
  ctx: PlanApi;
  plan: SeatingPlan;
  seat: SingleSeat;
  said: string | undefined;
}) {
  const { t } = useTranslation();
  const leave = () => ctx.open(null);
  const line = t('seating.singleLine', {
    section: sectionOf(plan, seat)?.name ?? t('seating.noSection'),
  });

  const change = (changes: Parameters<typeof api.changeSingleSeat>[2], field?: string) =>
    ctx.send(
      () => api.changeSingleSeat(ctx.event.id, seat.id, changes, ctx.newest(seat).version),
      field,
    );

  function name(text: string): Promise<string | null> | string {
    const typed = text.trim();

    if (typed === '') return t('seating.seatBlank');
    if (visibleLength(typed) > SEATING_LIMITS.seatNameMaximum)
      return t('seating.tableLong', { max: SEATING_LIMITS.seatNameMaximum });
    const holder = holdingName(plan.singleSeats, typed, seat.id);

    if (holder != null) return t('seating.seatTaken', { name: holder.name });
    return change({ name: typed }, 'name');
  }

  const state = (
    <p className="st-state-line">
      <StateMark unusable={seat.unusable} square={false} />
      {stateWord(t, seat.unusable)}
    </p>
  );

  if (ctx.readOnly)
    return (
      <div className="st-stack">
        <BackHead title={seat.name} line={line} />
        {state}
        <Line>{t('seating.readOnly')}</Line>
      </div>
    );

  return (
    <div className="st-stack is-tight">
      <BackHead title={seat.name} line={line} />
      {said != null && <Added>{said}</Added>}
      {ctx.notice != null && <Said>{ctx.notice}</Said>}
      <div className="st-fields">
        <Field
          onLeave={leave}
          fieldKey="name"
          label={t('seating.name')}
          value={seat.name}
          onCommit={name}
        />
        <Select
          fieldKey="section"
          label={t('seating.section')}
          value={seat.sectionId ?? ''}
          options={sectionOptions(t, plan)}
          onPick={(value) => void change({ sectionId: value === '' ? null : value })}
        />
      </div>
      <div className="st-block">
        {state}
        <div className="st-acts">
          <TextAction
            label={t(seat.unusable ? 'seating.markUsable' : 'seating.markUnusable')}
            onClick={() => void change({ unusable: !seat.unusable })}
          />
        </div>
      </div>
      <div className="st-acts">
        <TextAction
          label={t('seating.deleteSeat')}
          red
          onClick={() => ctx.ask({ kind: 'deleteSeat', id: seat.id })}
        />
      </div>
    </div>
  );
}
