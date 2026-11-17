import type { SeatingPlan } from '@soirely/api-client';
import {
  CHAIR_RADIUS_CM,
  chairsOf,
  isRoundShape,
  rowExtent,
  rowSeatsOf,
  tableExtent,
} from '@soirely/domain';
import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glyph } from '../../../components/Glyph.tsx';
import { f, sectionOf, turned, usableSeats } from './seatingDraw.ts';
import { type ChairState, chairStateOf, takenAt } from './seatingGuests.ts';
import { type FloorItem, floorItems, itemName } from './seatingItems.ts';
import { Swatch } from './SeatingParts.tsx';
import { ChairMark, chairStateWord } from './SeatingTables.tsx';

export type SeatingView = 'plan' | 'tables';

const BACK = new Set(['ArrowLeft', 'ArrowUp']);
const ON = new Set(['ArrowRight', 'ArrowDown']);

const CARD_W = 188;

/** The arrow keys move between the cards in their order, round from the last to the first. */
function stepCard(event: KeyboardEvent<HTMLButtonElement>) {
  const back = BACK.has(event.key);

  if (!back && !ON.has(event.key)) return;
  const all = event.currentTarget
    .closest('.st-cards')
    ?.querySelectorAll<HTMLElement>('.st-card-hit');
  const cards = [...(all ?? [])];
  const at = cards.indexOf(event.currentTarget);

  if (at < 0) return;
  event.preventDefault();
  cards[(at + (back ? -1 : 1) + cards.length) % cards.length]?.focus();
}
const CARD_H = 132;

/** A card's chair is a target of its own at 24 px, the web's floor (WCAG 2.2 SC 2.5.8). */
const CHAIR_HIT = 24;

/** What a card's chairs do: which are targets, which is lit, and what a press on one does. */
interface CardChairs {
  target: (state: ChairState) => boolean;
  keys: boolean;
  lit: number | null;
  on: number | null;
  onHover: (seat: number | null) => void;
  onChair: (seat: number) => void;
}

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
function cardScale(item: FloorItem): number {
  const [ex, ey] =
    item.kind === 'table'
      ? tableExtent(item.one)
      : item.kind === 'row'
        ? rowExtent(item.one)
        : [CHAIR_RADIUS_CM, CHAIR_RADIUS_CM];
  const [wx, wy] = rotationOf(item) % 180 !== 0 ? [ey, ex] : [ex, ey];

  return Math.min((CARD_W - 16) / (2 * wx), (CARD_H - 12) / (2 * wy), 0.45);
}

function rotationOf(item: FloorItem): number {
  return item.kind === 'seat' ? 0 : item.one.rotation;
}

function cardChairsOf(item: FloorItem): { seat: number; x: number; y: number }[] {
  return item.kind === 'table'
    ? chairsOf(item.one)
    : item.kind === 'row'
      ? rowSeatsOf(item.one)
      : [{ seat: 1, x: 0, y: 0 }];
}

/** Whether a card draws its chairs far enough apart for each to be a target; a long row does not, and is one target. */
function chairsFit(item: FloorItem): boolean {
  const s = cardScale(item);
  const at = cardChairsOf(item).map((chair) => turned([chair.x, chair.y], rotationOf(item)));

  return at.every(([x, y], i) =>
    at.slice(i + 1).every(([x2, y2]) => Math.hypot(x - x2, y - y2) * s >= CHAIR_HIT),
  );
}

function CardDrawing({
  plan,
  item,
  chairs: does,
}: {
  plan: SeatingPlan;
  item: FloorItem;
  chairs: CardChairs | null;
}) {
  const { t } = useTranslation();
  const one = item.one;
  const rotation = rotationOf(item);
  const s = cardScale(item);
  const cx = CARD_W / 2;
  const cy = CARD_H / 2;
  const r = CHAIR_RADIUS_CM * s;
  const section = sectionOf(plan, one);
  const unusable = (seat: number) =>
    item.kind === 'seat' ? item.one.unusable : item.one.unusableSeats.includes(seat);
  const chairs = cardChairsOf(item);

  return (
    <svg
      className={`st-card-art st-item is-${section?.colour ?? 'none'}`}
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden={does == null ? true : undefined}
      focusable="false"
    >
      <g aria-hidden="true">
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
          const lit = does?.lit === chair.seat || does?.on === chair.seat;

          return (
            <g key={chair.seat}>
              {lit && (
                <circle
                  className="st-lit"
                  cx={f(cx + px * s)}
                  cy={f(cy + py * s)}
                  r={f(Math.max(r + 5, CHAIR_HIT / 2 + 2))}
                />
              )}
              <ChairMark
                x={cx + px * s}
                y={cy + py * s}
                r={r}
                state={state}
                square={item.kind === 'table' && item.one.shape === 'cocktail'}
                label={undefined}
              />
            </g>
          );
        })}
      </g>
      {does != null &&
        chairs.map((chair) => {
          const { state, guest } = chairStateOf(plan, one.id, chair.seat, unusable(chair.seat));

          if (!does.target(state)) return null;
          const [px, py] = turned([chair.x, chair.y], rotation);

          return (
            <circle
              key={`hit${chair.seat}`}
              className="st-chair-hit is-card"
              role="button"
              tabIndex={does.keys ? 0 : -1}
              aria-label={t('seating.chairName', {
                table: itemName(t, item),
                seat: chair.seat,
                state: chairStateWord(t, state, guest),
              })}
              aria-pressed={does.on === chair.seat}
              cx={f(cx + px * s)}
              cy={f(cy + py * s)}
              r={CHAIR_HIT / 2}
              onPointerEnter={() => does.onHover(chair.seat)}
              onPointerLeave={() => does.onHover(null)}
              onFocus={() => does.onHover(chair.seat)}
              onBlur={() => does.onHover(null)}
              onClick={() => does.onChair(chair.seat)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                does.onChair(chair.seat);
              }}
            />
          );
        })}
    </svg>
  );
}

/** The Tables view (sc-4013): a card per table, row and single seat, by section then name, with All sections and a chip per section.
 *  With a guest picked, the card under the pointer lights, and so does its chair; a taken chair is a target with nothing picked too, to pick who sits there. */
export function TablesView({
  plan,
  section,
  onSection,
  lit,
  picking,
  moving,
  readOnly,
  onCard,
  onChair,
}: {
  plan: SeatingPlan;
  section: string | null;
  onSection: (id: string | null) => void;
  lit: (item: FloorItem) => boolean;
  picking: boolean;
  moving: { id: string; seat: number } | null;
  readOnly: boolean;
  onCard: (item: FloorItem) => void;
  onChair: (item: FloorItem, seat: number) => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<{ id: string; seat: number | null } | null>(null);
  const items = inCardOrder(plan).filter(
    (item) => section == null || item.one.sectionId === section,
  );
  const under = picking ? hover : null;
  const chairsOn = (item: FloorItem, on: boolean): CardChairs | null =>
    readOnly || !chairsFit(item)
      ? null
      : {
          target: (state) => state === 'taken' || (picking && state === 'empty'),
          keys: on || moving?.id === item.one.id,
          lit: under?.id === item.one.id ? under.seat : null,
          on: moving?.id === item.one.id ? moving.seat : null,
          onHover: (seat) => setHover(seat == null ? null : { id: item.one.id, seat }),
          onChair: (seat) => onChair(item, seat),
        };

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
          const pressed = lit(item);
          const on = pressed || under?.id === item.one.id;
          const taken = takenAt(plan, item.one.id);
          const name = `${itemName(t, item)}, ${t('seating.takenOf', { taken, seats: seatsOf(item) })}`;

          return (
            <li key={item.one.id} className="st-card-slot">
              <div className={on ? 'st-card is-lit' : 'st-card'}>
                <button
                  type="button"
                  className="st-card-hit"
                  aria-label={
                    at == null ? name : t('seating.inSection', { name, section: at.name })
                  }
                  aria-pressed={pressed}
                  onPointerEnter={() => setHover({ id: item.one.id, seat: null })}
                  onPointerLeave={() =>
                    setHover((was) => (was?.id === item.one.id && was.seat == null ? null : was))
                  }
                  onFocus={() => setHover({ id: item.one.id, seat: null })}
                  onClick={() => onCard(item)}
                  onKeyDown={stepCard}
                >
                  <span className="st-card-top">
                    <span className="st-card-name">{itemName(t, item)}</span>
                    <span className="st-card-of">
                      {t('seating.takenOf', { taken, seats: seatsOf(item) })}
                    </span>
                  </span>
                </button>
                <span className="st-sec-chip">
                  <Swatch colour={at?.colour ?? null} size={12} />
                  {at?.name ?? t('seating.noSection')}
                </span>
                <CardDrawing plan={plan} item={item} chairs={chairsOn(item, on)} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
