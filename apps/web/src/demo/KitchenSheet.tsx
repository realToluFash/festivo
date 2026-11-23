import { type ReactNode, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, rangeOf, sampleEvent } from './events.ts';
import { OkLine } from './GuestsParts.tsx';
import { KeptArea, KeptHere } from './KeptOffline.tsx';
import { KITCHEN_EVENT, clockOfKitchen } from './kitchen.ts';
import {
  type Cell,
  type Paper,
  type Sheet,
  type SheetAccess,
  type SheetCourse,
  type SheetStart,
  KSW,
  asOfLine,
  ksw,
  pdfName,
  sheetAt,
  sheetOf,
  sheetStart,
  summaryLine,
  worldOf,
} from './kitchenSheet.ts';
import { keptInbox, waitingLine } from './messages.ts';
import { useSwitcherStart } from './switcher.ts';
import { clockWords } from './tabKept.ts';
import './guests.css';
import './kitchenSheet.css';

const MAKE_MS = 900;
const LOAD_MS = 900;
const UNSHEETED: ReadonlySet<SheetStart['state']> = new Set(['refused', 'loading', 'cannotReach']);

/** sc-3911's kitchen sheet, behind Kitchen sheet on the event's Menu: the page at a desk and from 320 px, and the printout on A4 or Letter. */
export function KitchenSheetPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  useSwitcherStart();

  return <SheetAt key={`${id ?? ''}|${params.toString()}`} id={id} first={sheetStart(params)} />;
}

function SheetAt({ id, first }: { id: string | undefined; first: SheetStart }) {
  const [event] = useState(() => sampleEvent(id));
  const now = clockOfKitchen();

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== KITCHEN_EVENT) return <Navigate to={`/demo/events/${event.id}`} replace />;
  if (first.paper != null && !UNSHEETED.has(first.state))
    return <SheetPaper event={event} first={first} paper={first.paper} now={now} />;

  return (
    <KeptArea eventId={event.id} area="menu" at={clockWords(now, event.timeZone)}>
      <EventsShell
        renderSide={(tell, covered) => (
          <EventSidebar
            event={event}
            area="menu"
            now={now}
            tell={tell}
            inert={covered}
            waiting={waitingLine(keptInbox())}
          />
        )}
      >
        {(tell) => (
          <div className="desk-page ev-page gs ks">
            <div className="ev-wide gs-page">
              <KeptHere />
              <Crumbs event={event} tell={tell} />
              <SheetScreen event={event} first={first} now={now} />
            </div>
          </div>
        )}
      </EventsShell>
    </KeptArea>
  );
}

function Crumbs({ event, tell }: { event: SampleEvent; tell: Tell }) {
  return (
    <div className="ev-crumb-row">
      <nav className="ev-crumb" aria-label={KSW.crumb}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/demo/events">{KSW.events}</Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
              {event.name}
            </Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`/demo/events/${event.id}/menu?state=menuPicks`}>
              {KSW.menu}
            </Link>
          </li>
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{KSW.title}</span>
          </li>
        </ol>
      </nav>
      <DemoBell tell={tell} />
    </div>
  );
}

type Pdf = 'rest' | 'making' | 'made' | 'failed';
type Load = 'loading' | 'unreached' | 'retrying' | 'loaded';

const LOAD_OF: Partial<Record<SheetStart['state'], Load>> = {
  loading: 'loading',
  cannotReach: 'unreached',
};

const PDF_OF: Partial<Record<SheetStart['state'], Pdf>> = { making: 'making', failed: 'failed' };

function SheetScreen({ event, first, now }: { event: SampleEvent; first: SheetStart; now: Date }) {
  const [sheet] = useState(() => sheetOf(worldOf(first.state)));
  const [pdf, setPdf] = useState<Pdf>(PDF_OF[first.state] ?? 'rest');
  const [pressed, setPressed] = useState(false);
  const [load, setLoad] = useState<Load>(LOAD_OF[first.state] ?? 'loaded');

  useEffect(() => {
    if (load !== 'retrying') return undefined;
    const timer = window.setTimeout(() => setLoad('loaded'), LOAD_MS);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (pdf !== 'making' || !pressed) return undefined;
    const timer = window.setTimeout(() => {
      setPressed(false);
      setPdf('made');
    }, MAKE_MS);

    return () => window.clearTimeout(timer);
  }, [pdf, pressed]);

  if (first.state === 'refused')
    return (
      <section className="desk-block ks-refused" aria-labelledby="ks-refused">
        <span className="ks-lock" aria-hidden="true">
          <Glyph name="lock" size={28} weight={2.2} />
        </span>
        <h1 id="ks-refused" className="gs-title" tabIndex={-1}>
          {KSW.refused}
        </h1>
        <Link className="gs-pill is-primary ks-go" to={`/demo/events/${event.id}`}>
          {KSW.back}
        </Link>
      </section>
    );

  const make = () => {
    setPressed(true);
    setPdf('making');
  };
  return (
    <>
      <header className="gs-top ks-top">
        <div className="ks-head">
          <h1 className="gs-title" tabIndex={-1}>
            {KSW.title}
          </h1>
          <p className="ks-event">{event.name}</p>
          <p className="ks-event">{rangeOf(event, now)}</p>
          <p className="ks-as-of">{asOfLine(now, event.timeZone)}</p>
        </div>
        {load === 'loaded' && (
          <div className="ks-acts">
            <button
              type="button"
              className="gs-pill is-primary ks-act"
              aria-disabled={pdf === 'making'}
              onClick={() => {
                if (pdf !== 'making') make();
              }}
            >
              {pdf === 'making' ? (
                <span className="ks-spin" aria-hidden="true" />
              ) : (
                <DownloadMark />
              )}
              {pdf === 'making' ? KSW.making : KSW.download}
            </button>
            <Link
              className="gs-pill is-secondary ks-act"
              to={sheetAt(first.state, first.access, 'a4')}
            >
              <PrintMark />
              {KSW.print}
            </Link>
          </div>
        )}
      </header>
      <div className="ks-said" role="status">
        {pdf === 'made' && <OkLine>{ksw(KSW.made, { file: pdfName(event, now) })}</OkLine>}
      </div>
      {pdf === 'failed' && (
        <div className="ks-failed" role="alert">
          <p>
            <Glyph name="alert" size={17} weight={2.4} />
            {KSW.failed}
          </p>
          <button type="button" className="gs-pill is-secondary ks-act" onClick={make}>
            {KSW.retry}
          </button>
        </div>
      )}
      {load === 'unreached' && (
        <div className="ks-failed" role="alert">
          <p>
            <Glyph name="alert" size={17} weight={2.4} />
            {KSW.cannotReach}
          </p>
          <button
            type="button"
            className="gs-pill is-secondary ks-act"
            onClick={() => setLoad('retrying')}
          >
            {KSW.retry}
          </button>
        </div>
      )}
      {(load === 'loading' || load === 'retrying') && (
        <div className="ks-loading" aria-busy="true">
          <p role="status">{KSW.loading}</p>
          {[0, 1, 2].map((one) => (
            <div key={one} className="ks-bone" aria-hidden="true" />
          ))}
        </div>
      )}
      {load === 'loaded' && <SheetBody sheet={sheet} access={first.access} />}
    </>
  );
}

function SheetBody({ sheet, access }: { sheet: Sheet; access: SheetAccess }) {
  return (
    <div className="ks-body">
      <p className="ks-summary">{summaryLine(sheet)}</p>
      <section className="desk-block ks-card ks-allergies" aria-labelledby="ks-allergies">
        <h2 id="ks-allergies" className="ks-card-head">
          <span className="ks-allergy-mark" aria-hidden="true">
            <Glyph name="alert" size={18} weight={2.4} />
          </span>
          {KSW.allergies}
        </h2>
        <Allergies sheet={sheet} access={access} screen />
      </section>
      <section className="desk-block ks-card" aria-labelledby="ks-diets">
        <h2 id="ks-diets" className="ks-card-head">
          {KSW.diets}
        </h2>
        <Diets sheet={sheet} />
      </section>
      {sheet.courses.map((one) => (
        <section
          key={one.course.id}
          className="desk-block ks-card"
          aria-labelledby={`ks-${one.course.id}`}
        >
          <h2 id={`ks-${one.course.id}`} className="ks-card-head">
            {one.course.name}
          </h2>
          <Course course={one} />
        </section>
      ))}
    </div>
  );
}

function Allergies({
  sheet,
  access,
  screen = false,
}: {
  sheet: Sheet;
  access: SheetAccess;
  screen?: boolean;
}) {
  const none = sheet.withAllergies === 0 ? <p className="ks-line">{KSW.noAllergies}</p> : null;

  if (sheet.allergic.length === 0 || (access === 'counts' && none != null)) return none;

  if (access === 'counts')
    return (
      <>
        <table className="ks-table">
          <thead>
            <tr>
              <th scope="col">{KSW.allergen}</th>
              <th scope="col" className="ks-n">
                {KSW.people}
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.allergyCounts.map(([name, count]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td className="ks-n">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ks-line">{KSW.namesNeed}</p>
      </>
    );

  return (
    <>
      {none}
      <table className={screen ? 'ks-table ks-people' : 'ks-table'}>
        <thead>
          <tr>
            <th scope="col">{KSW.name}</th>
            <th scope="col">{KSW.allergicTo}</th>
            {sheet.courses.map((one) => (
              <th key={one.course.id} scope="col">
                {one.course.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.allergic.map((person) => (
            <tr key={person.id}>
              <th scope="row">{person.name}</th>
              <td data-head={KSW.allergicTo}>{person.allergens}</td>
              {person.cells.map((cell, index) => (
                <td
                  key={sheet.courses[index]?.course.id}
                  data-head={sheet.courses[index]?.course.name}
                >
                  <CellWords cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {none == null && (
        <p className="ks-line">
          {sheet.allergyCounts
            .map(([allergen, count]) => ksw(KSW.perAllergen, { allergen, count }))
            .join(' · ')}
        </p>
      )}
    </>
  );
}

const CELL_WORDS: Record<Exclude<Cell['kind'], 'dish'>, string> = {
  kitchen: KSW.kitchen,
  skipped: KSW.skipped,
  host: KSW.needsHost,
  changed: KSW.changed,
  notYet: KSW.cellNotYet,
  never: KSW.cellNever,
};

function CellWords({ cell }: { cell: Cell }) {
  if (cell.kind === 'dish') return <>{cell.text}</>;

  return (
    <span className="ks-state">
      <StateMark kind={cell.kind} />
      {CELL_WORDS[cell.kind]}
    </span>
  );
}

function Diets({ sheet }: { sheet: Sheet }) {
  if (sheet.dietCounts.length === 0) return <p className="ks-line">{KSW.noDiets}</p>;

  return (
    <table className="ks-table">
      <thead>
        <tr>
          <th scope="col">{KSW.diet}</th>
          <th scope="col" className="ks-n">
            {KSW.people}
          </th>
        </tr>
      </thead>
      <tbody>
        {sheet.dietCounts.map(([name, count]) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            <td className="ks-n">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const STATE_KIND: Partial<Record<string, Exclude<Cell['kind'], 'dish'>>> = {
  host: 'host',
  skipped: 'skipped',
  none: 'notYet',
};

function Course({ course }: { course: SheetCourse }) {
  return (
    <>
      <table className="ks-table">
        <thead>
          <tr>
            <th scope="col">{KSW.dish}</th>
            <th scope="col" className="ks-n">
              {KSW.people}
            </th>
          </tr>
        </thead>
        <tbody>
          {course.rows.map((row) => {
            const kind = STATE_KIND[row.kind];
            return (
              <tr
                key={row.id}
                className={row.kind === 'variant' || row.kind === 'side' ? 'is-under' : undefined}
              >
                <th scope="row">
                  {kind == null ? (
                    row.name
                  ) : (
                    <span className="ks-state">
                      <StateMark kind={kind} />
                      {row.name}
                    </span>
                  )}
                </th>
                <td className="ks-n">{row.count}</td>
              </tr>
            );
          })}
          <tr className="is-room">
            <th scope="row">{KSW.room}</th>
            <td className="ks-n">{course.room}</td>
          </tr>
        </tbody>
      </table>
      {course.given != null && <p className="ks-line">{course.given}</p>}
      {course.sides && <p className="ks-line">{KSW.sides}</p>}
    </>
  );
}

/** The printout and the PDF: black ink on white, 1 px rules, real headings and tables, the health footer on every page; A4 is 794 px wide, Letter 816. */
function SheetPaper({
  event,
  first,
  paper,
  now,
}: {
  event: SampleEvent;
  first: SheetStart;
  paper: Paper;
  now: Date;
}) {
  const [sheet] = useState(() => sheetOf(worldOf(first.state)));
  const { state } = first;
  const other: Paper = paper === 'a4' ? 'letter' : 'a4';

  return (
    <main id="content" className="ks-paper-page">
      <div className="ks-paper-bar">
        <Link className="ks-back" to={sheetAt(state, first.access)}>
          <Glyph name="back" size={17} weight={2.4} />
          {KSW.toSheet}
        </Link>
        <p className="ks-paper-is">
          {KSW.paperIs}: {paper === 'a4' ? KSW.a4 : KSW.letter}
          {' · '}
          <Link className="ks-back" to={sheetAt(state, first.access, other)}>
            {other === 'a4' ? KSW.a4 : KSW.letter}
          </Link>
        </p>
        <button
          type="button"
          className="gs-pill is-secondary ks-act"
          onClick={() => window.print()}
        >
          <PrintMark />
          {KSW.printNow}
        </button>
      </div>
      <Page n={1} m={2} paper={paper}>
        <header className="ks-paper-head">
          <h1>{KSW.title}</h1>
          <p>{event.name}</p>
          <p>{rangeOf(event, now)}</p>
          <p>{asOfLine(now, event.timeZone)}</p>
          <p>{summaryLine(sheet)}</p>
        </header>
        <h2>{KSW.allergies}</h2>
        <Allergies sheet={sheet} access={first.access} />
        <h2>{KSW.diets}</h2>
        <Diets sheet={sheet} />
      </Page>
      <Page n={2} m={2} paper={paper}>
        {sheet.courses.map((one) => (
          <section key={one.course.id} aria-labelledby={`ksp-${one.course.id}`}>
            <h2 id={`ksp-${one.course.id}`}>{one.course.name}</h2>
            <Course course={one} />
          </section>
        ))}
      </Page>
    </main>
  );
}

function Page({
  n,
  m,
  paper,
  children,
}: {
  n: number;
  m: number;
  paper: Paper;
  children: ReactNode;
}) {
  const label = ksw(KSW.page, { n, m });

  return (
    <article className={paper === 'letter' ? 'ks-sheet is-letter' : 'ks-sheet'} aria-label={label}>
      <div className="ks-sheet-body">{children}</div>
      <footer className="ks-foot">
        <span>{KSW.health}</span>
        <span>{label}</span>
      </footer>
    </article>
  );
}

/** Each state a shape with its word: Needs the host a triangle, Skipped a circle with a minus, not chosen a dashed circle. Drawn in the demo, not added to the product's icon set. */
function StateMark({ kind }: { kind: Exclude<Cell['kind'], 'dish'> }) {
  if (kind === 'host')
    return (
      <svg className="ks-mark" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2 14.5 13.5h-13Z" />
      </svg>
    );
  if (kind === 'skipped')
    return (
      <svg className="ks-mark" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" />
        <path d="M5 8h6" />
      </svg>
    );
  if (kind === 'notYet' || kind === 'never')
    return (
      <svg className="ks-mark" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" className="is-dashed" />
      </svg>
    );

  return null;
}

function DownloadMark() {
  return (
    <svg className="ks-mark is-act" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

function PrintMark() {
  return (
    <svg className="ks-mark is-act" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}
