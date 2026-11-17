import type { SeatingPlan } from '@soirely/api-client';
import {
  CHAIR_RADIUS_CM,
  chairsOf,
  isRoundShape,
  rowExtent,
  rowSeatsOf,
  tableExtent,
} from '@soirely/domain';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Glyph } from '../../../components/Glyph.tsx';
import { f, sectionOf, turned, usableSeats } from './seatingDraw.ts';
import { chairStateOf, takenAt } from './seatingGuests.ts';
import { type FloorItem, floorItems, itemName } from './seatingItems.ts';
import { Swatch } from './SeatingParts.tsx';
import { ChairMark } from './SeatingTables.tsx';

export type SeatingView = 'plan' | 'tables';

const BACK = new Set(['ArrowLeft', 'ArrowUp']);
const ON = new Set(['ArrowRight', 'ArrowDown']);

const CARD_W = 188;

/** The arrow keys move between the cards in their order, round from the last to the first. */
function stepCard(event: KeyboardEvent<HTMLButtonElement>) {
  const back = BACK.has(event.key);

  if (!back && !ON.has(event.key)) return;
  const all = event.currentTarget.closest('.st-cards')?.querySelectorAll<HTMLElement>('.st-card');
  const cards = [...(all ?? [])];
  const at = cards.indexOf(event.currentTarget);

  if (at < 0) return;
  event.preventDefault();
  cards[(at + (back ? -1 : 1) + cards.length) % cards.length]?.focus();
}
const CARD_H = 132;

/** Floor plan or Tables; the List view comes with sc-4016. */
export function ViewSwitch({
  view,
  onView,
}: {
  view: SeatingView;
  onView: (view: SeatingView) => void;
}) {
  const { t } = useTranslation();
  const views = [
    ['plan', t('seating.floorPlan'), 'map'],
    ['tables', t('seating.tablesView'), 'cards'],
  ] as const;

  return (
    <div className="st-float st-views st-seg" role="group" aria-label={t('seating.view')}>
      {views.map(([one, word, glyph]) => (
        <button
          key={one}
          type="button"
          aria-pressed={view === one}
          className={view === one ? 'st-seg-one is-on' : 'st-seg-one'}
          onClick={() => onView(one)}
        >
          <Glyph name={glyph} size={16} weight={2.1} />
          {word}
        </button>
      ))}
    </div>
  );
}

/** By section in the plan's order, no section last, then by name with numbers in order (Table 2 before Table 10). */
export function inCardOrder(plan: SeatingPlan): FloorItem[] {
  const order = (item: FloorItem) => {
    const index = plan.sections.findIndex((one) => one.id === item.one.sectionId);

    return index < 0 ? plan.sections.length : index;
  };
  const name = (item: FloorItem) => (item.kind === 'row' ? item.one.label : item.one.name);

  return floorItems(plan).sort(
    (a, b) =>
      order(a) - order(b) ||
      name(a).localeCompare(name(b), undefined, { numeric: true, sensitivity: 'base' }),
  );
}

function seatsOf(item: FloorItem): number {
  return item.kind === 'seat' ? (item.one.unusable ? 0 : 1) : usableSeats(item.one);
}

/** A place's own drawing on its card, not to scale against the room: its chairs in order and in their states. */
function CardDrawing({ plan, item }: { plan: SeatingPlan; item: FloorItem }) {
  const one = item.one;
  const [ex, ey] =
    item.kind === 'table'
      ? tableExtent(item.one)
      : item.kind === 'row'
        ? rowExtent(item.one)
        : [CHAIR_RADIUS_CM, CHAIR_RADIUS_CM];
  const rotation = item.kind === 'seat' ? 0 : item.one.rotation;
  const [wx, wy] = rotation % 180 !== 0 ? [ey, ex] : [ex, ey];
  const s = Math.min((CARD_W - 16) / (2 * wx), (CARD_H - 12) / (2 * wy), 0.45);
  const cx = CARD_W / 2;
  const cy = CARD_H / 2;
  const r = CHAIR_RADIUS_CM * s;
  const section = sectionOf(plan, one);
  const unusable = (seat: number) =>
    item.kind === 'seat' ? item.one.unusable : item.one.unusableSeats.includes(seat);
  const chairs =
    item.kind === 'table'
      ? chairsOf(item.one)
      : item.kind === 'row'
        ? rowSeatsOf(item.one)
        : [{ seat: 1, x: 0, y: 0 }];

  return (
    <svg
      className={`st-card-art st-item is-${section?.colour ?? 'none'}`}
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
      focusable="false"
    >
      {item.kind === 'table' &&
        (isRoundShape(item.one.shape) ? (
          <circle className="st-body" cx={f(cx)} cy={f(cy)} r={f((item.one.widthCm / 2) * s)} />
        ) : (
          <g transform={`translate(${f(cx)} ${f(cy)}) rotate(${rotation})`}>
            <rect
              className="st-body"
              x={f((-item.one.widthCm / 2) * s)}
              y={f((-item.one.lengthCm / 2) * s)}
              width={f(item.one.widthCm * s)}
              height={f(item.one.lengthCm * s)}
              rx="3"
            />
          </g>
        ))}
      {chairs.map((chair) => {
        const [px, py] = turned([chair.x, chair.y], rotation);
        const { state } = chairStateOf(plan, one.id, chair.seat, unusable(chair.seat));

        return (
          <ChairMark
            key={chair.seat}
            x={cx + px * s}
            y={cy + py * s}
            r={r}
            state={state}
            square={item.kind === 'table' && item.one.shape === 'cocktail'}
            label={undefined}
          />
        );
      })}
    </svg>
  );
}

/** The Tables view (sc-4013): a card per table, row and single seat, by section then name, with All sections and a chip per section. */
export function TablesView({
  plan,
  section,
  onSection,
  lit,
  onCard,
}: {
  plan: SeatingPlan;
  section: string | null;
  onSection: (id: string | null) => void;
  lit: (item: FloorItem) => boolean;
  onCard: (item: FloorItem) => void;
}) {
  const { t } = useTranslation();
  const items = inCardOrder(plan).filter(
    (item) => section == null || item.one.sectionId === section,
  );

  return (
    <div className="st-view is-tables">
      <div className="st-chips" role="group" aria-label={t('seating.sections')}>
        <button
          type="button"
          className={section == null ? 'st-chip is-ink' : 'st-chip'}
          aria-pressed={section == null}
          onClick={() => onSection(null)}
        >
          {t('seating.allSections')}
        </button>
        {plan.sections.map((one) => (
          <button
            key={one.id}
            type="button"
            className={section === one.id ? 'st-chip is-ink' : 'st-chip'}
            aria-pressed={section === one.id}
            onClick={() => onSection(one.id)}
          >
            <Swatch colour={one.colour} size={12} />
            {one.name}
          </button>
        ))}
      </div>
      <ul className="st-cards">
        {items.map((item) => {
          const at = sectionOf(plan, item.one);
          const on = lit(item);
          const taken = takenAt(plan, item.one.id);
          const name = `${itemName(t, item)}, ${t('seating.takenOf', { taken, seats: seatsOf(item) })}`;

          return (
            <li key={item.one.id} className="st-card-slot">
              <button
                type="button"
                className={on ? 'st-card is-lit' : 'st-card'}
                aria-label={at == null ? name : t('seating.inSection', { name, section: at.name })}
                aria-pressed={on}
                onClick={() => onCard(item)}
                onKeyDown={stepCard}
              >
                <span className="st-card-top">
                  <span className="st-card-name">{itemName(t, item)}</span>
                  <span className="st-card-of">
                    {t('seating.takenOf', { taken, seats: seatsOf(item) })}
                  </span>
                </span>
                <span className="st-sec-chip">
                  <Swatch colour={at?.colour ?? null} size={12} />
                  {at?.name ?? t('seating.noSection')}
                </span>
                <CardDrawing plan={plan} item={item} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
