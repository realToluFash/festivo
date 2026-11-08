import { Fragment } from 'react';

import {
  type Item,
  type Party,
  type Plan,
  SW,
  chairWord,
  chairsOf,
  extent,
  filled,
  inSectionOrder,
  isRound,
  itemName,
  listed,
  ofWords,
  peopleIn,
  say,
  sectionName,
  sectionOf,
  shapeWord,
  turn,
  usable,
} from './seating.ts';
import { useSeating } from './seatingContext.ts';
import type { ListTab } from './seatingSeed.ts';
import { ShapeTile, Swatch } from './SeatingPanel.tsx';
import { ChairMark, StateMark } from './SeatingRoom.tsx';

function partyOf(tray: readonly Party[], id: string | null): Party | null {
  return tray.find((one) => one.id === id) ?? null;
}

/** A table's own drawing on its card: not to scale against the room, its chairs in order and in their states. */
function CardDrawing({ item, colour }: { item: Item; colour: string }) {
  const w = 188;
  const h = 132;
  const [ex, ey] = extent(item);
  const turned = item.rot % 180 !== 0 ? [ey, ex] : [ex, ey];
  const s = Math.min((w - 16) / (2 * turned[0]!), (h - 12) / (2 * turned[1]!), 0.45);
  const cx = w / 2;
  const cy = h / 2;
  const r = 22 * s;

  return (
    <svg
      className={`st-card-art st-item is-${colour}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
    >
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

        return (
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
    </svg>
  );
}

/** The Tables view (sc-4013): a card per table, by section then name, with All sections and a chip per section. */
export function TablesView() {
  const { ui, set, seatAt, choose } = useSeating();
  const plan = ui.plan;
  const items = inSectionOrder(plan).filter(
    (item) => ui.tablesSection == null || item.sec === ui.tablesSection,
  );
  const picked = partyOf(ui.tray, ui.picked);

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

          return (
            <li key={item.id}>
              <button
                type="button"
                className={lit ? 'st-card is-lit' : 'st-card'}
                aria-label={itemName(plan, item)}
                aria-pressed={ui.chosen.includes(item.id)}
                onPointerEnter={() => picked != null && set((now) => ({ ...now, hover: item.id }))}
                onClick={() => (picked != null ? seatAt(item.id) : choose([item.id]))}
              >
                <span className="st-card-top">
                  <span className="st-card-name">{item.name}</span>
                  <span className="st-card-of">{ofWords(item)}</span>
                </span>
                <span className="st-sec-chip">
                  <Swatch colour={section?.colour ?? null} size={12} />
                  {section?.name ?? SW.noSection}
                </span>
                <CardDrawing item={item} colour={section?.colour.toLowerCase() ?? 'none'} />
              </button>
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
            const room = picked != null && usable(item) - filled(item) >= peopleIn(picked);

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
