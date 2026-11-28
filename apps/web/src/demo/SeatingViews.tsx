import { Fragment } from 'react';

import {
  CARD_SIZE,
  CHAIR_HIT,
  type Choice,
  type Item,
  type Party,
  type Plan,
  SW,
  cardScale,
  chairWord,
  chairsFit,
  chairsOf,
  chosenWords,
  filled,
  inSectionOrder,
  isRound,
  itemName,
  listed,
  marksOf,
  ofWords,
  peopleIn,
  say,
  seatChosenWords,
  sectionName,
  sectionOf,
  shapeWord,
  turn,
  usable,
} from './seating.ts';
import { useSeating } from './seatingContext.ts';
import type { ListTab } from './seatingSeed.ts';
import { ShapeTile, Swatch } from './SeatingPanel.tsx';
import { ChairMark, Pill, StateMark } from './SeatingRoom.tsx';
import { CardNotes, NotesButton } from './SeatingNotes.tsx';
import { brokenByTable } from './seatingNotes.ts';

const RING_STEP = 5;
const PILL_STEP = 24;

/** Each colleague's initials in their colour, in the order they chose it (sc-60717). */
function Whos({ choices }: { choices: readonly Choice[] }) {
  if (choices.length === 0) return null;
  return (
    <span className="st-whos" aria-hidden="true">
      {choices.map(({ who }, k) => (
        <span key={k} className={`st-who p${who.tone}`}>
          {who.initials}
        </span>
      ))}
    </span>
  );
}

function partyOf(tray: readonly Party[], id: string | null): Party | null {
  return tray.find((one) => one.id === id) ?? null;
}

/** A table's own drawing on its card: not to scale against the room, its chairs in order and in their states. */
function CardDrawing({
  item,
  colour,
  choices,
  chairs,
}: {
  item: Item;
  colour: string;
  choices: readonly Choice[];
  chairs: CardChairs | null;
}) {
  const w = CARD_SIZE.w;
  const h = CARD_SIZE.h;
  const s = cardScale(item);
  const cx = w / 2;
  const cy = h / 2;
  const r = 22 * s;

  return (
    <svg
      className={`st-card-art st-item is-${colour}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden={chairs == null ? true : undefined}
      focusable="false"
    >
      <g aria-hidden="true">
        {isRound(item) && item.kind !== 'single' ? (
          <circle className="st-body" cx={cx} cy={cy} r={((item.d ?? 180) / 2) * s} />
        ) : item.kind === 'rect' || item.kind === 'head' ? (
          <g transform={`translate(${cx} ${cy}) rotate(${item.rot})`}>
            <rect
              className="st-body"
              x={(-(item.w ?? 180) / 2) * s}
              y={(-(item.l ?? 76) / 2) * s}
              width={(item.w ?? 180) * s}
              height={(item.l ?? 76) * s}
              rx="3"
            />
          </g>
        ) : null}
        {chairsOf(item).map((point, index) => {
          const [px, py] = turn(point, item.rot);
          const lit = chairs?.lit === index || chairs?.on === index;

          return lit ? (
            <g key={index}>
              <circle
                className="st-lit"
                cx={cx + px * s}
                cy={cy + py * s}
                r={Math.max(r + 5, CHAIR_HIT / 2 + 2)}
              />
              <ChairMark
                x={cx + px * s}
                y={cy + py * s}
                r={r}
                chair={item.chairs[index] ?? { state: 'empty' }}
                square={item.kind === 'cocktail'}
              />
            </g>
          ) : (
            <ChairMark
              key={index}
              x={cx + px * s}
              y={cy + py * s}
              r={r}
              chair={item.chairs[index] ?? { state: 'empty' }}
              square={item.kind === 'cocktail'}
            />
          );
        })}
        {chairsOf(item).flatMap((point, index) => {
          const [px, py] = turn(point, item.rot);
          const x = cx + px * s;
          const y = cy + py * s;

          return choices
            .filter((one) => one.seat === index)
            .map(({ who }, k) => {
              const rr = r + 5.5 + RING_STEP * k;

              return (
                <g key={`seat${index}.${k}`} className={`st-ring p${who.tone}`}>
                  <circle className="st-ring-gap" cx={x} cy={y} r={rr} />
                  <circle className="st-ring-line" cx={x} cy={y} r={rr + 1.5} />
                  <Pill x={x - rr * 0.72} y={y - rr * 0.72 - PILL_STEP * k} words={who.initials} />
                </g>
              );
            });
        })}
      </g>
      {chairs != null &&
        chairsOf(item).map((point, index) => {
          const chair = item.chairs[index] ?? { state: 'empty' as const };

          if (!chairs.target(chair, index)) return null;
          const [px, py] = turn(point, item.rot);

          return (
            <circle
              key={`hit${index}`}
              className="st-chair-hit is-card"
              role="button"
              tabIndex={chairs.keys ? 0 : -1}
              aria-label={say(SW.chairName, {
                table: item.name,
                n: index + 1,
                word: chairWord(chair),
              })}
              aria-pressed={chairs.on === index}
              cx={cx + px * s}
              cy={cy + py * s}
              r={CHAIR_HIT / 2}
              onPointerEnter={() => chairs.onHover(index)}
              onPointerLeave={() => chairs.onHover(null)}
              onFocus={() => chairs.onHover(index)}
              onBlur={() => chairs.onHover(null)}
              onClick={() => chairs.onChair(index)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                chairs.onChair(index);
              }}
            />
          );
        })}
    </svg>
  );
}

interface CardChairs {
  target: (chair: Item['chairs'][number], index: number) => boolean;
  /** In the tab order: the lit card's chairs only, as the plan's `chairsFor`. */
  keys: boolean;
  lit: number | null;
  on: number | null;
  onHover: (index: number | null) => void;
  onChair: (index: number) => void;
}

/** The Tables view (sc-4013): a card per table, by section then name, with All sections and a chip per section. */
export function TablesView() {
  const { ui, set, seatAt, choose, pickSeated } = useSeating();
  const plan = ui.plan;
  const items = inSectionOrder(plan).filter(
    (item) => ui.tablesSection == null || item.sec === ui.tablesSection,
  );
  const picking = ui.picked != null;
  const broken = brokenByTable(plan, ui.readOnly ? [] : ui.notes.list);
  const chairsOn = (item: Item): CardChairs | null =>
    ui.readOnly || !chairsFit(item)
      ? null
      : {
          target: (chair) => chair.state === 'taken' || (picking && chair.state === 'empty'),
          keys: ui.hover === item.id || ui.moving?.table === item.id || ui.chosen.includes(item.id),
          lit: ui.hover === item.id ? ui.hoverChair : null,
          on: ui.moving?.table === item.id ? ui.moving.chair : null,
          onHover: (index) =>
            set((now) =>
              now.picked == null
                ? now
                : { ...now, hover: index == null ? now.hover : item.id, hoverChair: index },
            ),
          onChair: (index) => (picking ? seatAt(item.id, index) : pickSeated(item.id, index)),
        };

  return (
    <div className="st-view is-tables">
      <div className="st-chips" role="group" aria-label={SW.sections}>
        <button
          type="button"
          className={ui.tablesSection == null ? 'st-chip is-ink' : 'st-chip'}
          aria-pressed={ui.tablesSection == null}
          onClick={() => set((now) => ({ ...now, tablesSection: null }))}
        >
          {SW.allSections}
        </button>
        {plan.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={ui.tablesSection === section.id ? 'st-chip is-ink' : 'st-chip'}
            aria-pressed={ui.tablesSection === section.id}
            onClick={() => set((now) => ({ ...now, tablesSection: section.id }))}
          >
            <Swatch colour={section.colour} size={12} />
            {section.name}
          </button>
        ))}
      </div>
      <ul className="st-cards">
        {items.map((item) => {
          const lit = ui.hover === item.id || ui.chosen.includes(item.id);
          const section = sectionOf(plan, item);
          const marks = marksOf(ui.rings, ui.presence, item.id);

          return (
            <li key={item.id} className="st-card-slot" data-card={item.id}>
              <div
                className={[
                  'st-card',
                  lit && 'is-lit',
                  marks.length > 0 && 'is-marked',
                  broken.has(item.id) && 'snote-card-broken',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="st-card-hit"
                  aria-label={itemName(plan, item, chosenWords(marks))}
                  aria-pressed={ui.chosen.includes(item.id)}
                  onPointerEnter={() =>
                    picking && set((now) => ({ ...now, hover: item.id, hoverChair: null }))
                  }
                  onFocus={() =>
                    picking && set((now) => ({ ...now, hover: item.id, hoverChair: null }))
                  }
                  onClick={() => (picking ? seatAt(item.id) : choose([item.id]))}
                >
                  <span className="st-card-top">
                    <span className="st-card-name">{item.name}</span>
                    <span className="st-card-of">{ofWords(item)}</span>
                  </span>
                </button>
                <span className="st-sec-chip">
                  <Swatch colour={section?.colour ?? null} size={12} />
                  {section?.name ?? SW.noSection}
                </span>
                <CardDrawing
                  item={item}
                  colour={section?.colour.toLowerCase() ?? 'none'}
                  choices={marks}
                  chairs={chairsOn(item)}
                />
                <CardNotes broken={broken.get(item.id) ?? []} />
              </div>
              {marks.map(({ who }, k) => (
                <span
                  key={k}
                  className={`st-card-ring is-k${Math.min(k, 3)} p${who.tone}`}
                  aria-hidden="true"
                >
                  <span className="st-who">{who.initials}</span>
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function tabOf(ui: { listTab: ListTab | null; plan: Plan }): ListTab {
  if (ui.listTab != null) return ui.listTab;
  return ui.plan.items.some((item) => filled(item) < usable(item)) ? 'space' : 'all';
}

function seatedLine(item: Item): string {
  const names = item.chairs
    .filter((chair) => chair.state === 'taken')
    .map((chair) => chair.who ?? SW.taken);

  if (filled(item) === 0) return SW.nobodyYet;
  if (names.length <= 2) return listed(names);
  return say(SW.andMore, { names: names.slice(0, 2).join(', '), n: filled(item) - 2 });
}

/** The List (sc-4016): With space, Full and All with counts, opening on With space; a table with headers that carries every fact the room shows. */
export function ListView() {
  const { ui, set, seatAt } = useSeating();
  const plan = ui.plan;
  const tab = tabOf(ui);
  const space = plan.items.filter((item) => filled(item) < usable(item));
  const full = plan.items.filter((item) => filled(item) >= usable(item));
  const rows = inSectionOrder(plan).filter((item) =>
    tab === 'space' ? space.includes(item) : tab === 'full' ? full.includes(item) : true,
  );
  const picked = partyOf(ui.tray, ui.picked);
  const tabs: [ListTab, string, number][] = [
    ['space', SW.withSpace, space.length],
    ['full', SW.fullTab, full.length],
    ['all', SW.all, plan.items.length],
  ];

  return (
    <div className="st-view is-list">
      <div className="st-seg is-list" role="group" aria-label={SW.show}>
        {tabs.map(([key, word, n]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className={tab === key ? 'st-seg-one is-on' : 'st-seg-one'}
            onClick={() => set((now) => ({ ...now, listTab: key }))}
          >
            {say(SW.tabCount, { word, n })}
          </button>
        ))}
      </div>
      <table className="st-table">
        <caption className="desk-unseen">{SW.listTable}</caption>
        <thead>
          <tr>
            <th scope="col">{SW.name}</th>
            <th scope="col">{SW.section}</th>
            <th scope="col">{SW.seats}</th>
            <th scope="col">{SW.seated}</th>
            <td />
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const open = ui.listOpen === item.id;
            const room =
              ui.moving != null
                ? item.id !== ui.moving.table && usable(item) > filled(item)
                : picked != null && usable(item) - filled(item) >= peopleIn(picked);
            const marks = marksOf(ui.rings, ui.presence, item.id);

            return (
              <Fragment key={item.id}>
                <tr className={open ? 'is-open' : undefined}>
                  <th scope="row">
                    <button
                      type="button"
                      className="st-list-name"
                      aria-expanded={open}
                      onClick={() => set((now) => ({ ...now, listOpen: open ? null : item.id }))}
                    >
                      <ShapeTile kind={item.kind} size={32} />
                      <span className="st-row-words">
                        <span className="st-row-name">{item.name}</span>
                        <span className="st-row-line">{shapeWord(item)}</span>
                      </span>
                      <Whos choices={marks} />
                      {marks.length > 0 && (
                        <span className="desk-unseen">{chosenWords(marks)}</span>
                      )}
                    </button>
                  </th>
                  <td>{sectionName(plan, item)}</td>
                  <td className="st-num">{ofWords(item)}</td>
                  <td className="st-quiet">{seatedLine(item)}</td>
                  <td>
                    {room && (
                      <button
                        type="button"
                        className="st-seat-here"
                        onClick={() => seatAt(item.id)}
                      >
                        {SW.seatHere}
                      </button>
                    )}
                  </td>
                </tr>
                {open &&
                  item.chairs.map((chair, index) => (
                    <tr key={index} className="st-chair-row">
                      <td colSpan={4}>
                        <span className="st-chair-cell">
                          <StateMark chair={chair} size={20} />
                          <span className="st-chair-number">{say(SW.seatN, { n: index + 1 })}</span>
                          <span className="st-row-name">{chairWord(chair)}</span>
                          {chair.state === 'taken' && chair.who != null && picked == null && (
                            <NotesButton name={chair.who} />
                          )}
                          <Whos choices={marks.filter((one) => one.seat === index)} />
                          <span className="desk-unseen">{seatChosenWords(marks, index)}</span>
                        </span>
                      </td>
                      <td>
                        {chair.state === 'empty' && picked != null && (
                          <button
                            type="button"
                            className="st-seat-here"
                            onClick={() => seatAt(item.id, index)}
                          >
                            {SW.seatHere}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
