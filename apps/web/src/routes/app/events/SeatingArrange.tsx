import { type MeasurementSystem, type SeatingPlan, type SeatingTable } from '@soirely/api-client';
import {
  insideRoom,
  isRoundShape,
  listFormat,
  overlapping,
  readFloorPosition,
} from '@soirely/domain';
import { type PointerEvent as ReactPointerEvent, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { Mark } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { Field, type PlanApi, Said } from './SeatingParts.tsx';
import { f, turned } from './seatingDraw.ts';
import {
  type FloorItem,
  type Handle,
  type Placing,
  type SaveState,
  LONG_HANDLES,
  ROUND_HANDLES,
  floorItems,
  footprintOf,
  itemName,
  placementOf,
} from './seatingItems.ts';
import { lengthWords } from './seatingUnits.ts';

export function Overlaps({ plan, id }: { plan: SeatingPlan; id: string }) {
  const { t } = useTranslation();
  const items = floorItems(plan);
  const item = items.find((one) => one.one.id === id);

  if (item == null) return null;
  const at = footprintOf(item);
  const names = items
    .filter((other) => other.one.id !== id && overlapping(at, footprintOf(other)))
    .map((other) => itemName(t, other));

  if (names.length === 0) return null;
  const name = listFormat(currentLocale(), { type: 'conjunction' }).format(names);

  return <Said>{t('seating.overlaps', { name })}</Said>;
}

/** Across and Down, in the organisation's units: applied as entered, refused beside the field when it would leave the item outside the room. */
export function PositionFields({ ctx, item }: { ctx: PlanApi; item: FloorItem }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const plan = ctx.plan;
  const name = itemName(t, item);

  function place(axis: 'xCm' | 'yCm', text: string): string | null {
    const read = readFloorPosition(text, ctx.system, locale);

    if (read.kind === 'blank' || read.kind === 'unreadable')
      return t(ctx.system === 'us' ? 'seating.lengthLike' : 'seating.lengthLikeMetric');
    if (read.kind === 'outOfRange') return t('seating.outside', { name });
    const cm = read.cm;

    if (plan == null) return null;
    const at: [number, number] = axis === 'xCm' ? [cm, item.one.yCm] : [item.one.xCm, cm];

    if (!insideRoom(footprintOf(item), plan, at)) return t('seating.outside', { name });
    ctx.arrange([{ ...placementOf(item), xCm: at[0], yCm: at[1] }]);
    return null;
  }

  const shown = (cm: number) => lengthWords(t, locale, cm, ctx.system, { grouping: false });

  return (
    <div className="st-two">
      <Field
        fieldKey="across"
        label={t('seating.across')}
        value={shown(item.one.xCm)}
        inputMode={ctx.system === 'us' ? 'text' : 'decimal'}
        onCommit={(text) => place('xCm', text)}
      />
      <Field
        fieldKey="down"
        label={t('seating.down')}
        value={shown(item.one.yCm)}
        inputMode={ctx.system === 'us' ? 'text' : 'decimal'}
        onCommit={(text) => place('yCm', text)}
      />
    </div>
  );
}

export function SnapToGrid({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="st-switch-row">
      <span id={id}>{t('seating.snap')}</span>
      <button
        type="button"
        role="switch"
        className="st-switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={() => onChange(!on)}
      >
        <span className="st-switch-track" aria-hidden="true">
          <span className="st-switch-knob" />
        </span>
      </button>
    </div>
  );
}

/** The save line, said to a screen reader as it changes (WCAG 2.2 4.1.3). */
export function SaveLine({ state, onTryAgain }: { state: SaveState; onTryAgain: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      className={`st-float st-top-right st-save is-${state === 'notSaved' ? 'not-saved' : state}`}
      role="status"
      aria-live="polite"
    >
      {state === 'saved' && <Mark kind="yes" />}
      {state === 'saving' && <span className="st-turning" aria-hidden="true" />}
      {state === 'retrying' && <Glyph name="alert" size={16} weight={2.2} />}
      {state === 'notSaved' && (
        <span className="st-no" aria-hidden="true">
          <Glyph name="clear" size={10} weight={3.4} />
        </span>
      )}
      {t(
        {
          saved: 'seating.saved',
          saving: 'seating.saving',
          retrying: 'seating.retrying',
          notSaved: 'seating.notSaved',
        }[state],
      )}
      {state === 'notSaved' && (
        <button type="button" className="desk-text" onClick={onTryAgain}>
          {t('seating.tryAgain')}
        </button>
      )}
    </div>
  );
}

/** While something chosen has the keyboard, a strip shows its keys (WCAG 2.2 2.5.7). */
export function KeysStrip({ system }: { system: MeasurementSystem }) {
  const { t } = useTranslation();
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.platform);
  const keys: [string, string][] = [
    ['← ↑ → ↓', t(system === 'us' ? 'seating.keyMoveUs' : 'seating.keyMove')],
    [t('seating.keyName.shift'), t(system === 'us' ? 'seating.keyShiftUs' : 'seating.keyShift')],
    ['R', t('seating.keyTurn')],
    [mac ? '⌘ D' : `${t('seating.keyName.ctrl')} D`, t('seating.keyDuplicate')],
    [t('seating.keyName.delete'), t('seating.keyDelete')],
    [t('seating.keyName.esc'), t('seating.keyEsc')],
  ];

  return (
    <div className="st-float st-keys" role="note" aria-label={t('seating.keys')}>
      {keys.map(([key, word]) => (
        <span key={key} className="st-key">
          <kbd>{key}</kbd>
          {word}
        </span>
      ))}
    </div>
  );
}

const PLACING_WORDS = {
  round: 'seating.placingRound',
  rectangular: 'seating.placingRectangular',
  head: 'seating.placingHead',
  cocktail: 'seating.placingCocktail',
  row: 'seating.placingRow',
  seat: 'seating.placingSeat',
} as const;

/** Add, then a click on the floor: Place another keeps the same kind ready, Esc stops, and Place at the centre is the path with no pointer. */
export function PlacingBars({
  placing,
  another,
  onAnother,
  onCentre,
  onStop,
}: {
  placing: Placing;
  another: boolean;
  onAnother: (another: boolean) => void;
  onCentre: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="st-float st-bar is-tint is-placing" role="status" aria-live="polite">
        <Glyph name="info" size={17} weight={2.2} />
        <div className="st-bar-body">
          <p>{t(PLACING_WORDS[placing.kind === 'table' ? placing.shape : placing.kind])}</p>
          <span className="st-bar-acts">
            <button type="button" className="desk-text" onClick={onCentre}>
              {t('seating.placeCentre')}
            </button>
            <button type="button" className="desk-text" onClick={onStop}>
              {t('seating.stopPlacing')}
            </button>
          </span>
        </div>
      </div>
      <div className="st-float st-another">
        <label>
          <input
            type="checkbox"
            checked={another}
            onChange={(event) => onAnother(event.target.checked)}
          />
          {t('seating.placeAnother')}
        </label>
      </div>
    </>
  );
}

/** A chosen table's handles: drawn 24 at a desk, each a 44 target; four on a round or cocktail table, eight on a long one. */
export function TableHandles({
  table,
  s,
  ox,
  oy,
  onDown,
}: {
  table: SeatingTable;
  s: number;
  ox: number;
  oy: number;
  onDown: (event: ReactPointerEvent<SVGRectElement>, handle: Handle) => void;
}) {
  const round = isRoundShape(table.shape);
  const cx = ox + table.xCm * s;
  const cy = oy + table.yCm * s;
  const hw = (table.widthCm / 2) * s;
  const hl = ((round ? table.widthCm : table.lengthCm) / 2) * s;

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
        const [x, y] = turned([sx * hw, sy * hl], table.rotation);

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
              data-handle={name}
              x={f(cx + x - 22)}
              y={f(cy + y - 22)}
              width="44"
              height="44"
              aria-hidden="true"
              onPointerDown={(event) => {
                event.stopPropagation();
                onDown(event, name);
              }}
            />
          </g>
        );
      })}
    </g>
  );
}

export function Tip({ x, y, words }: { x: number; y: number; words: string }) {
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
