import { type ReactNode, useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { Icon } from './SeatingGlyph.tsx';
import {
  type Item,
  type Plan,
  AS_OF,
  CHAIR_R,
  EVENT_DATE,
  EVENT_NAME,
  SEATING_AT,
  SW,
  VENUE,
  CITY,
  chairsOf,
  filled,
  isTable,
  say,
  sectionName,
  turn,
  usable,
} from './seating.ts';
import { useSeating } from './seatingContext.ts';
import type { Doc, Paper } from './seatingSeed.ts';
import { TextAction } from '../components/SettingsParts.tsx';

const DOCS: readonly {
  doc: Doc | 'who';
  name: string;
  line: string;
  files: readonly { key: Doc; word: string; ext: string }[];
}[] = [
  {
    doc: 'lists',
    name: SW.tableLists,
    line: SW.tableListsLine,
    files: [{ key: 'lists', word: SW.pdf, ext: 'pdf' }],
  },
  {
    doc: 'cards',
    name: SW.tableCards,
    line: SW.tableCardsLine,
    files: [{ key: 'cards', word: SW.pdf, ext: 'pdf' }],
  },
  {
    doc: 'floor',
    name: SW.floorPlan,
    line: SW.floorPlanLine,
    files: [
      { key: 'floor', word: SW.pdf, ext: 'pdf' },
      { key: 'floorPng', word: SW.png, ext: 'png' },
    ],
  },
  { doc: 'who', name: SW.whoSitsWhere, line: SW.whoSitsWhereLine, files: [] },
];

const PAPER_OF: Record<Doc, string> = {
  lists: `${SEATING_AT}?state=paperLists`,
  cards: `${SEATING_AT}?state=paperCard`,
  floor: `${SEATING_AT}?state=paperFloor`,
  floorPng: `${SEATING_AT}?state=paperFloorImage`,
};

/** Print at a desk (sc-4024, sc-5032): a 400 panel under its button, Paper size, then each document with its own buttons. */
export function PrintPanel({ onClose }: { onClose: () => void }) {
  const { ui, set } = useSeating();
  const box = useRef<HTMLDivElement>(null);
  const { docs, paper } = ui.print;

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('h2')?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !box.current?.contains(document.activeElement)) return;
      event.stopPropagation();
      onClose();
    };

    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, [onClose]);

  function make(key: Doc): void {
    set((now) => ({
      ...now,
      print: { ...now.print, docs: { ...now.print.docs, [key]: 'preparing' } },
    }));
  }

  return (
    <div ref={box} className="st-float st-print" role="dialog" aria-labelledby="st-print-title">
      <div className="st-print-head">
        <h2 id="st-print-title" tabIndex={-1}>
          {SW.print}
        </h2>
        <button
          type="button"
          className="st-icon-button"
          aria-label={SW.closePrint}
          onClick={onClose}
        >
          <Icon name="clear" size={19} weight={2.2} />
        </button>
      </div>
      {ui.readOnly && <p className="st-line">{SW.readOnly}</p>}
      <fieldset className="st-paper-size">
        <legend className="st-label">{SW.paperSize}</legend>
        {(['A4', 'Letter'] as const).map((size) => (
          <label key={size} className="st-radio">
            <input
              type="radio"
              name="st-paper"
              checked={paper === size}
              onChange={() => set((now) => ({ ...now, print: { ...now.print, paper: size } }))}
            />
            {size === 'A4' ? SW.a4 : SW.letter}
          </label>
        ))}
      </fieldset>
      <ul className="st-docs">
        {DOCS.map((one) => {
          const preparing = one.files.find((file) => docs[file.key] === 'preparing');
          const done = one.files.find((file) => docs[file.key] === 'done');
          const failed = one.files.find((file) => docs[file.key] === 'failed');
          const name = `${EVENT_NAME} – ${one.name}.${done?.ext ?? 'pdf'}`;

          return (
            <li key={one.doc} className="st-doc">
              <div className="st-doc-row">
                <span className="st-row-words">
                  <span className="st-row-name">{one.name}</span>
                  <span className="st-row-line">{one.line}</span>
                </span>
                {one.files.length === 0 ? (
                  <span className="st-ac">{SW.notBuilt}</span>
                ) : preparing != null ? (
                  <span className="st-preparing" role="status">
                    <span className="st-turning" aria-hidden="true" />
                    {say(SW.preparing, { document: one.name })}
                  </span>
                ) : (
                  <span className="st-doc-files">
                    {one.files.map((file) => (
                      <button
                        key={file.key}
                        type="button"
                        className="st-pill"
                        aria-label={`${one.name}, ${file.word}`}
                        onClick={() => make(file.key)}
                      >
                        <Icon name="download" size={16} weight={2.2} />
                        {file.word}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              {done != null && (
                <p className="st-downloaded" role="status">
                  {say(SW.downloaded, { file: '' })}
                  <Link
                    className="st-file"
                    to={
                      done.key === 'floor' && paper === 'Letter'
                        ? `${SEATING_AT}?state=paperFloorLetter`
                        : PAPER_OF[done.key]
                    }
                    target="_blank"
                  >
                    {name}
                  </Link>
                </p>
              )}
              {failed != null && (
                <div className="st-doc-failed">
                  <p className="st-alert is-red" role="alert">
                    <Icon name="alert" size={15} weight={2.2} />
                    <span>{say(SW.printFailed, { document: one.name })}</span>
                  </p>
                  <TextAction label={SW.tryAgain} onClick={() => make(failed.key)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const A4: readonly [number, number] = [595, 842];
const LETTER: readonly [number, number] = [612, 792];

function PaperHead({ doc }: { doc: string }) {
  return (
    <header className="sp-head">
      <div>
        <h1>{doc}</h1>
        <p>
          {say(SW.paperHead, { event: EVENT_NAME, date: EVENT_DATE, venue: `${VENUE}, ${CITY}` })}
        </p>
      </div>
      <p className="sp-as-of">{say(SW.asOf, { when: AS_OF })}</p>
    </header>
  );
}

function PaperFoot({ doc, page, ext = 'pdf' }: { doc: string; page: string; ext?: string }) {
  return (
    <footer className="sp-foot">
      <span className="sp-file">
        {say(SW.paperFile, { event: EVENT_NAME, document: doc, ext })}
      </span>
      <span>{page}</span>
    </footer>
  );
}

function Sheet({
  size,
  children,
  label,
}: {
  size: readonly [number, number];
  children: ReactNode;
  label: string;
}) {
  return (
    <article className={`sp-sheet is-${size[0]}x${size[1]}`} aria-label={label}>
      {children}
    </article>
  );
}

function dash(item: Item): string | undefined {
  if (item.sec === 'garden') return '5 3';
  return item.sec === 'bar' ? '1.5 2.5' : undefined;
}

/** sc-5032's floor plan on one page on its side: names with taken of seats, sections by line and name, the seats' states in words, a 5 m bar. */
function FloorSheet({
  plan,
  size,
  ext,
}: {
  plan: Plan;
  size: readonly [number, number];
  ext: string;
}) {
  const [w, h] = size;
  const room = plan.room!;
  const oy = 92;
  const s = Math.min((w - 72) / room.w, (h - oy - 108) / room.l);
  const ox = (w - room.w * s) / 2;
  const marks: ReactNode[] = [];

  for (const item of plan.items) {
    const cx = ox + item.x * s;
    const cy = oy + item.y * s;

    if (item.kind === 'round' || item.kind === 'cocktail')
      marks.push(
        <circle
          key={`${item.id}b`}
          className="sp-line"
          cx={cx}
          cy={cy}
          r={((item.d ?? 180) / 2) * s}
          strokeDasharray={dash(item)}
        />,
      );
    else if (item.kind === 'rect' || item.kind === 'head')
      marks.push(
        <g key={`${item.id}b`} transform={`translate(${cx} ${cy}) rotate(${item.rot})`}>
          <rect
            className="sp-line"
            x={(-(item.w ?? 180) / 2) * s}
            y={(-(item.l ?? 76) / 2) * s}
            width={(item.w ?? 180) * s}
            height={(item.l ?? 76) * s}
            strokeDasharray={dash(item)}
          />
        </g>,
      );
    chairsOf(item).forEach((point, index) => {
      const chair = item.chairs[index];
      const [px, py] = turn(point, item.rot);
      const x = cx + px * s;
      const y = cy + py * s;
      const r = CHAIR_R * s;

      marks.push(
        <g key={`${item.id}c${index}`}>
          <circle className={chair?.state === 'taken' ? 'sp-ink' : 'sp-seat'} cx={x} cy={y} r={r} />
          {chair?.state === 'held' && (
            <path className="sp-ink" d={`M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}Z`} />
          )}
          {chair?.state === 'unusable' && (
            <path
              className="sp-cross"
              d={`M${x - r * 0.6} ${y - r * 0.6}L${x + r * 0.6} ${y + r * 0.6}M${x + r * 0.6} ${y - r * 0.6}L${x - r * 0.6} ${y + r * 0.6}`}
            />
          )}
        </g>,
      );
    });
    const label =
      item.kind === 'single' ? item.name : `${item.name} ${filled(item)}/${usable(item)}`;
    const below =
      item.kind === 'row'
        ? 16
        : item.kind === 'single'
          ? 0
          : ((item.kind === 'round' || item.kind === 'cocktail'
              ? (item.d ?? 180)
              : (item.l ?? 76)) /
              2 +
              50) *
              s +
            9;

    marks.push(
      <text
        key={`${item.id}t`}
        className="sp-label"
        x={item.kind === 'single' ? cx + 8 : cx}
        y={cy + below}
        textAnchor={item.kind === 'single' ? 'start' : 'middle'}
        dominantBaseline="central"
      >
        {label}
      </text>,
    );
  }

  return (
    <Sheet size={size} label={`${SW.floorPlan}, ${size[0] === 842 ? SW.a4 : SW.letter}`}>
      <PaperHead doc={SW.floorPlan} />
      <svg
        className="sp-art"
        width={w}
        height={h - 60}
        viewBox={`0 0 ${w} ${h - 60}`}
        role="img"
        aria-label={`${SW.floorPlan}, ${room.name}`}
      >
        <rect className="sp-walls" x={ox} y={oy} width={room.w * s} height={room.l * s} />
        {marks}
        <rect className="sp-ink" x={ox} y={oy + room.l * s + 14} width={500 * s} height="5" />
        <text
          className="sp-label"
          x={ox + 500 * s + 6}
          y={oy + room.l * s + 16.5}
          dominantBaseline="central"
        >
          {SW.scale}
        </text>
      </svg>
      <div className="sp-legend">
        <span>
          <PaperMark kind="taken" />
          {SW.taken}
        </span>
        <span>
          <PaperMark kind="held" />
          {SW.held}
        </span>
        <span>
          <PaperMark kind="empty" />
          {SW.empty}
        </span>
        <span>
          <PaperMark kind="unusable" />
          {SW.unusable}
        </span>
        <span className="sp-legend-line">
          {plan.sections.map((section) => (
            <span key={section.id}>
              <svg width="22" height="8" aria-hidden="true">
                <line
                  className="sp-line"
                  x1="0"
                  y1="4"
                  x2="22"
                  y2="4"
                  strokeDasharray={dash({ sec: section.id } as Item)}
                />
              </svg>
              {section.name}
            </span>
          ))}
          <span>{SW.proposedPrint}</span>
        </span>
      </div>
      <PaperFoot doc={SW.floorPlan} page={say(SW.page, { n: 1, m: 1 })} ext={ext} />
    </Sheet>
  );
}

function PaperMark({ kind }: { kind: 'taken' | 'held' | 'empty' | 'unusable' }) {
  return (
    <svg width="12" height="12" aria-hidden="true">
      <circle className={kind === 'taken' ? 'sp-ink' : 'sp-seat'} cx="6" cy="6" r="5" />
      {kind === 'held' && <path className="sp-ink" d="M6 1A5 5 0 0 0 6 11Z" />}
      {kind === 'unusable' && <path className="sp-cross" d="M3 3l6 6M9 3l-6 6" />}
    </svg>
  );
}

function ListBlock({ plan, item }: { plan: Plan; item: Item }) {
  return (
    <section className="sp-block">
      <h2>
        <span className="sp-block-name">{item.name}</span>
        <span className="sp-meta">
          {sectionName(plan, item)} · {filled(item)}/{usable(item)}
        </span>
      </h2>
      <ol>
        {item.chairs.map((chair, index) => (
          <li key={index}>
            <span className="sp-number">{index + 1}</span>
            {chair.state === 'taken' ? (
              <span>{chair.who}</span>
            ) : (
              <i>
                {chair.state === 'held'
                  ? SW.held
                  : chair.state === 'unusable'
                    ? SW.unusable
                    : SW.empty}
              </i>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** sc-4024's table lists: a block per table and row in name order, every chair by number; single seats as one block. */
function ListsSheet({
  plan,
  keys,
  page,
  nobody = false,
}: {
  plan: Plan;
  keys: readonly string[];
  page: string;
  nobody?: boolean;
}) {
  const singles = plan.items.filter((item) => item.kind === 'single');

  return (
    <Sheet size={A4} label={`${SW.tableLists}, ${page}`}>
      <PaperHead doc={SW.tableLists} />
      <div className="sp-columns">
        {nobody ? (
          <p className="sp-nobody">{SW.nobodySeated}</p>
        ) : (
          keys.map((key) => {
            const item = plan.items.find((one) => one.id === key);

            if (item == null) return null;
            if (item.kind !== 'single') return <ListBlock key={key} plan={plan} item={item} />;
            return (
              <section key={key} className="sp-block">
                <h2>
                  <span className="sp-block-name">{SW.singleSeats}</span>
                  <span className="sp-meta">
                    {singles.reduce((sum, one) => sum + filled(one), 0)}/
                    {singles.reduce((sum, one) => sum + usable(one), 0)}
                  </span>
                </h2>
                <ol>
                  {singles.map((one) => (
                    <li key={one.id}>
                      <span className="sp-seat-name">{one.name}</span>
                      {one.chairs[0]?.state === 'taken' ? (
                        <span>{one.chairs[0].who}</span>
                      ) : (
                        <i>{SW.empty}</i>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })
        )}
      </div>
      <p className="sp-note">{SW.numbering}</p>
      <PaperFoot doc={SW.tableLists} page={page} />
    </Sheet>
  );
}

/** sc-4024's table card: one A4 folded once, the name at 99 pt on both halves, the top one upside down. */
function CardSheet({ name, page }: { name: string; page: string }) {
  return (
    <Sheet size={A4} label={`${SW.tableCards}, ${name}`}>
      <h1 className="sp-unseen">{SW.tableCards}</h1>
      <div className="sp-half is-top">
        <p className="sp-card-name">{name}</p>
      </div>
      <div className="sp-half">
        <p className="sp-card-name">{name}</p>
      </div>
      <div className="sp-fold" aria-hidden="true">
        <span className="sp-fold-word">{SW.fold}</span>
      </div>
      <footer className="sp-foot is-card">
        <span className="sp-file">
          {say(SW.paperFile, { event: EVENT_NAME, document: SW.tableCards, ext: 'pdf' })} ·{' '}
          {say(SW.asOf, { when: AS_OF })}
        </span>
        <span>{page}</span>
      </footer>
    </Sheet>
  );
}

/** A document as it comes off the printer, opened from the demo's home or from Print's file name. */
export function PaperPage({ paper, plan }: { paper: Paper; plan: Plan }) {
  const tables = plan.items.filter(isTable).length;
  let sheet: ReactNode;

  switch (paper) {
    case 'floor':
      sheet = <FloorSheet plan={plan} size={[A4[1], A4[0]]} ext="pdf" />;
      break;
    case 'floorLetter':
      sheet = <FloorSheet plan={plan} size={[LETTER[1], LETTER[0]]} ext="pdf" />;
      break;
    case 'floorImage':
      sheet = <FloorSheet plan={plan} size={[A4[1], A4[0]]} ext="png" />;
      break;
    case 'lists':
      sheet = (
        <ListsSheet
          plan={plan}
          keys={['bar1', 'bar2', 'rowA', 't1', 't2']}
          page={say(SW.page, { n: 1, m: 3 })}
        />
      );
      break;
    case 'listsEnd':
      sheet = (
        <ListsSheet
          plan={plan}
          keys={['t9', 't10', 'top', 'door']}
          page={say(SW.page, { n: 3, m: 3 })}
        />
      );
      break;
    case 'nobody':
      sheet = <ListsSheet plan={plan} keys={[]} page={say(SW.page, { n: 1, m: 1 })} nobody />;
      break;
    case 'card':
      sheet = <CardSheet name="Table 2" page={say(SW.page, { n: 3, m: tables })} />;
      break;
    case 'cardTop':
      sheet = <CardSheet name="Top table" page={say(SW.page, { n: tables, m: tables })} />;
      break;
  }

  return (
    <main id="content" className="sp-page">
      <Link className="sp-back" to={SEATING_AT}>
        <Icon name="back" size={17} weight={2.4} />
        {SW.area}
      </Link>
      {sheet}
    </main>
  );
}
