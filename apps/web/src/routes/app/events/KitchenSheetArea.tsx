import {
  ApiError,
  type KitchenCourse,
  type KitchenSheet,
  type OrganisationEvent,
} from '@soirely/api-client';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { CardStep, TextAction } from '../../../components/SettingsParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { meshFor } from '../../../mesh.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { daysWords } from '../../../eventsList.ts';
import { canOn } from '../../../session.ts';
import { FinalNumbersBlock, type Giving } from './FinalNumbersBlock.tsx';
import { KitchenChanges } from './KitchenChanges.tsx';
import { DownloadMark, PrintMark, StateMark } from './kitchenMarks.tsx';
import { AllergyRows, CellWords, CourseRows, DietRows } from './KitchenSheetRows.tsx';
import {
  allergenName,
  allergensOf,
  asOfLine,
  bandLine,
  dietName,
  saveSheet,
  stateRows,
  summaryLine,
} from './kitchenSheet.ts';
import '../../../components/desk.css';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/EventsList.css';
import '../../../components/eventPage.css';
import './guests.css';
import './kitchenSheet.css';
import './kitchenScreen.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'refused' }
  | { kind: 'loaded'; sheet: KitchenSheet };

type Pdf =
  { kind: 'rest' } | { kind: 'making' } | { kind: 'made'; file: string } | { kind: 'failed' };

type Paper = 'a4' | 'letter';

const PIECES = [1, 2, 3, 4, 5, 6];

const sheetPath = (event: OrganisationEvent) =>
  `/app/events/${encodeURIComponent(event.id)}/menu/kitchen`;

/** sc-3911's kitchen sheet, behind Kitchen sheet on the event's Menu: allergies first, then diets, then what to cook, as of the moment it loaded. */
export function KitchenSheetArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query] = useSearchParams();
  const asked = query.get('paper');
  const paper: Paper | null = asked === 'a4' || asked === 'letter' ? asked : null;
  const { layers, covered, setHost } = useDeskLayers();

  usePageTitle(pageTitle(t, [t('kitchenSheet.title'), event.name]));

  useEffect(() => {
    let current = true;

    api.kitchenSheet(event.id).then(
      (sheet) => {
        if (current) setLoad({ kind: 'loaded', sheet });
      },
      (error: unknown) => {
        if (!current) return;
        setLoad({ kind: error instanceof ApiError && error.status === 403 ? 'refused' : 'failed' });
      },
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  if (load.kind === 'refused') return <KitchenSheetRefused event={event} />;
  if (paper != null && load.kind === 'loaded')
    return <SheetPaper event={event} sheet={load.sheet} paper={paper} />;

  return (
    <LayersContext value={layers}>
      <div className="desk ev desk-page ev-page gs ks kitchen">
        <div className="ev-wide gs-page" inert={covered}>
          <Crumbs event={event} />
          {load.kind === 'loaded' ? (
            <SheetScreen event={event} sheet={load.sheet} />
          ) : (
            <>
              <Top />
              {load.kind === 'loading' ? (
                <Bones />
              ) : (
                <Failed
                  words={t('kitchenSheet.cannotReach')}
                  onRetry={() => {
                    setLoad({ kind: 'loading' });
                    setAttempt((n) => n + 1);
                  }}
                />
              )}
            </>
          )}
        </div>
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

/** Without Menu read: the padlock, and the way back to the event. */
export function KitchenSheetRefused({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();

  return (
    <div className="desk ev desk-page ev-page gs ks kitchen">
      <div className="ev-wide gs-page">
        <Crumbs event={event} />
        <section className="desk-failed kitchen-refused" aria-labelledby="ks-refused">
          <Glyph name="lock" size={28} weight={2.2} />
          <h1 id="ks-refused" className="gs-title" tabIndex={-1}>
            {t('kitchenSheet.refused')}
          </h1>
          <Link
            className="gs-pill is-secondary ks-go"
            to={`/app/events/${encodeURIComponent(event.id)}`}
          >
            {t('kitchenSheet.back')}
          </Link>
        </section>
      </div>
    </div>
  );
}

function Crumbs({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const at = `/app/events/${encodeURIComponent(event.id)}`;

  return (
    <div className="ev-crumb-row">
      <nav className="ev-crumb" aria-label={t('eventMenu.crumb')}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/app/events">{t('eventMenu.events')}</Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={at}>
              {event.name}
            </Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`${at}/menu`}>
              {t('eventMenu.title')}
            </Link>
          </li>
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{t('kitchenSheet.title')}</span>
          </li>
        </ol>
      </nav>
      {desk.bell}
    </div>
  );
}

function Top({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <header className="gs-top kitchen-top">
      <h1 className="gs-title kitchen-title" tabIndex={-1}>
        {t('kitchenSheet.title')}
      </h1>
      {children}
    </header>
  );
}

function Failed({ words, onRetry }: { words: string; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="desk-failed kitchen-failed" role="alert">
      <p className="kitchen-failed-line">
        <Glyph name="alert" size={17} weight={2.4} />
        {words}
      </p>
      <TextAction label={t('kitchenSheet.retry')} onClick={onRetry} />
    </div>
  );
}

function Bones() {
  const { t } = useTranslation();

  return (
    <div className="desk-loading gs-bones" role="status" aria-busy="true">
      <span className="desk-unseen">{t('kitchenSheet.loading')}</span>
      <span className="desk-sunk gs-bone-card" aria-hidden="true" />
      <ul className="desk-rows gs-rows" aria-hidden="true">
        {[1, 2, 3, 4, 1].map((bone, index) => (
          <li key={index} className="desk-row is-bones">
            <span className="desk-sunk gs-bone-mark" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bone}`} />
              <span className={`desk-sunk is-line b${bone}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The band in the event's colours: how many are coming, and Give final numbers… as its one step. */
function Band({
  event,
  sheet,
  onGive,
}: {
  event: OrganisationEvent;
  sheet: KitchenSheet;
  /** Null without menu.manage. */
  onGive: (() => void) | null;
}) {
  const { t, i18n } = useTranslation();

  return (
    <section
      className={`ev-card today-cover is-${meshFor(event.id)} gs-card is-page`}
      aria-labelledby="ks-says"
    >
      <span className="ev-scrim" aria-hidden="true" />
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="ev-card-inner gs-card-inner">
        <p id="ks-says" className="gs-says">
          {t('kitchenSheet.coming', { count: sheet.coming })}
        </p>
        <p className="desk-on-card">{bandLine(t, sheet, event.timeZone, i18n.language)}</p>
        {onGive != null && (
          <div className="ev-card-foot">
            <CardStep label={t('kitchenSheet.give')} onClick={onGive} />
          </div>
        )}
      </div>
    </section>
  );
}

function SheetScreen({ event, sheet }: { event: OrganisationEvent; sheet: KitchenSheet }) {
  const { t } = useTranslation();
  const [pdf, setPdf] = useState<Pdf>({ kind: 'rest' });
  const [final, setFinal] = useState(sheet.finalNumbers);
  const [told, setTold] = useState<string | null>(null);
  const [giving, setGiving] = useState<Giving | null>(null);
  const [given, setGiven] = useState(false);
  const manage = canOn(event, 'menu.manage');
  const [openedAt] = useState(() => Date.now());
  const started = openedAt >= Date.parse(event.startsAt);

  const make = () => {
    setPdf({ kind: 'making' });
    api.kitchenSheetPdf(event.id).then(
      ({ name, bytes }) => {
        const file = name ?? `${t('kitchenSheet.title')}.pdf`;
        saveSheet(bytes, file);
        setPdf({ kind: 'made', file });
      },
      () => setPdf({ kind: 'failed' }),
    );
  };

  return (
    <>
      <Top>
        <div className="kitchen-acts">
          <button
            type="button"
            className="desk-text"
            aria-disabled={pdf.kind === 'making'}
            onClick={() => {
              if (pdf.kind !== 'making') make();
            }}
          >
            {pdf.kind === 'making' ? (
              <span className="kitchen-spin" aria-hidden="true" />
            ) : (
              <DownloadMark />
            )}
            {pdf.kind === 'making' ? t('kitchenSheet.making') : t('kitchenSheet.download')}
          </button>
          <Link className="desk-text" to={`${sheetPath(event)}?paper=${sheet.paper}`}>
            <PrintMark />
            {t('kitchenSheet.print')}
          </Link>
        </div>
      </Top>
      <div className="kitchen-said" role="status">
        {given && (
          <p className="gs-ok">
            <Glyph name="tick" size={17} weight={2.6} />
            {t('kitchenSheet.givenKitchen')}
          </p>
        )}
        {pdf.kind === 'made' && (
          <p className="gs-ok">
            <Glyph name="tick" size={17} weight={2.6} />
            {t('kitchenSheet.made', { file: pdf.file })}
          </p>
        )}
      </div>
      {pdf.kind === 'failed' && <Failed words={t('kitchenSheet.failed')} onRetry={make} />}
      <Band event={event} sheet={sheet} onGive={manage ? () => setGiving('rest') : null} />
      <div className="ev-columns">
        <div className="ev-left">
          {final.changes != null && (
            <KitchenChanges
              changes={final.changes}
              timeZone={event.timeZone}
              onGive={manage && !started ? () => setGiving('rest') : null}
            />
          )}
          <AllergyRows sheet={sheet} />
          <DietRows sheet={sheet} />
          {sheet.courses.map((course) => (
            <CourseRows key={course.id} course={course} />
          ))}
        </div>
        <div className="ev-right">
          <FinalNumbersBlock
            event={event}
            final={final}
            manage={manage}
            giving={giving}
            onGiving={setGiving}
            onGiven={() => setGiven(true)}
            onChange={setFinal}
            tell={setTold}
          />
        </div>
      </div>
      <div className="ks-paper-page is-print" hidden>
        <PaperSheets event={event} sheet={sheet} paper={sheet.paper} />
      </div>
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </>
  );
}

function Allergies({ sheet }: { sheet: KitchenSheet }) {
  const { t } = useTranslation();

  const none =
    sheet.allergicCount === 0 ? <p className="ks-line">{t('kitchenSheet.noAllergies')}</p> : null;

  if (none != null && (sheet.allergic ?? []).length === 0) return none;

  if (sheet.allergic == null)
    return (
      <>
        <table className="ks-table">
          <thead>
            <tr>
              <th scope="col">{t('kitchenSheet.allergen')}</th>
              <th scope="col" className="ks-n">
                {t('kitchenSheet.people')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.allergyCounts.map(({ code, count }) => (
              <tr key={code}>
                <th scope="row">{allergenName(t, code)}</th>
                <td className="ks-n">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ks-line">{t('kitchenSheet.namesNeed')}</p>
      </>
    );

  return (
    <>
      {none}
      <table className="ks-table">
        <thead>
          <tr>
            <th scope="col">{t('kitchenSheet.name')}</th>
            <th scope="col">{t('kitchenSheet.allergicTo')}</th>
            {sheet.courses.map((course) => (
              <th key={course.id} scope="col">
                {course.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.allergic.map((person) => (
            <tr key={person.id}>
              <th scope="row">{person.name}</th>
              <td>{allergensOf(t, person)}</td>
              {person.cells.map((cell, index) => (
                <td key={sheet.courses[index]?.id ?? index}>
                  <CellWords cell={cell} look="ks-state" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {none == null && (
        <p className="ks-line">
          {sheet.allergyCounts
            .map(({ code, count }) =>
              t('kitchenSheet.perAllergen', { allergen: allergenName(t, code), count }),
            )
            .join(' · ')}
        </p>
      )}
    </>
  );
}

function Diets({ sheet }: { sheet: KitchenSheet }) {
  const { t } = useTranslation();
  if (sheet.dietCounts.length === 0) return <p className="ks-line">{t('kitchenSheet.noDiets')}</p>;

  return (
    <table className="ks-table">
      <thead>
        <tr>
          <th scope="col">{t('kitchenSheet.diet')}</th>
          <th scope="col" className="ks-n">
            {t('kitchenSheet.people')}
          </th>
        </tr>
      </thead>
      <tbody>
        {sheet.dietCounts.map(({ code, count }) => (
          <tr key={code}>
            <th scope="row">{dietName(t, code)}</th>
            <td className="ks-n">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Course({ course }: { course: KitchenCourse }) {
  const { t } = useTranslation();

  return (
    <>
      <table className="ks-table">
        <thead>
          <tr>
            <th scope="col">{t('kitchenSheet.dish')}</th>
            <th scope="col" className="ks-n">
              {t('kitchenSheet.people')}
            </th>
          </tr>
        </thead>
        <tbody>
          {course.rows.map((row) => (
            <tr key={row.id} className={row.kind === 'dish' ? undefined : 'is-under'}>
              <th scope="row">
                {row.kind === 'dish'
                  ? row.name
                  : t(row.kind === 'variant' ? 'kitchenSheet.variant' : 'kitchenSheet.side', {
                      name: row.name,
                    })}
              </th>
              <td className="ks-n">{row.count}</td>
            </tr>
          ))}
          {stateRows(t, course).map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.mark == null ? (
                  row.name
                ) : (
                  <span className="ks-state">
                    <StateMark kind={row.mark} />
                    {row.name}
                  </span>
                )}
              </th>
              <td className="ks-n">{row.count}</td>
            </tr>
          ))}
          <tr className="is-room">
            <th scope="row">{t('kitchenSheet.room')}</th>
            <td className="ks-n">{course.room}</td>
          </tr>
        </tbody>
      </table>
      {course.given != null && (
        <p className="ks-line">
          {t('kitchenSheet.given', { count: course.given.count, dish: course.given.plate })}
        </p>
      )}
      {course.sides && <p className="ks-line">{t('kitchenSheet.sides')}</p>}
    </>
  );
}

/** The printout: black ink on white, 1 px rules, the health footer on every page; A4 is 794 px wide, Letter 816. The browser prints it on the printer's own paper. */
function SheetPaper({
  event,
  sheet,
  paper,
}: {
  event: OrganisationEvent;
  sheet: KitchenSheet;
  paper: Paper;
}) {
  const { t } = useTranslation();
  const other: Paper = paper === 'a4' ? 'letter' : 'a4';

  return (
    <div className="ks-paper-page">
      <div className="ks-paper-bar">
        <Link className="ks-back" to={sheetPath(event)}>
          <Glyph name="back" size={17} weight={2.4} />
          {t('kitchenSheet.toSheet')}
        </Link>
        <p className="ks-paper-is">
          {t('kitchenSheet.paperIs')}: {t(`kitchenSheet.${paper}`)}
          {' · '}
          <Link className="ks-back" to={`${sheetPath(event)}?paper=${other}`}>
            {t(`kitchenSheet.${other}`)}
          </Link>
        </p>
        <button
          type="button"
          className="gs-pill is-secondary ks-act"
          onClick={() => window.print()}
        >
          <PrintMark />
          {t('kitchenSheet.printNow')}
        </button>
      </div>
      <PaperSheets event={event} sheet={sheet} paper={paper} />
    </div>
  );
}

function PaperSheets({
  event,
  sheet,
  paper,
}: {
  event: OrganisationEvent;
  sheet: KitchenSheet;
  paper: Paper;
}) {
  const { t, i18n } = useTranslation();
  const pages = coursePages(sheet.courses, paper);
  const m = pages.length + 1;

  return (
    <>
      <Page n={1} m={m} paper={paper}>
        <header className="ks-paper-head">
          <h1>{t('kitchenSheet.title')}</h1>
          <p>{event.name}</p>
          <p>{daysWords(event, new Date(), i18n.language, t)}</p>
          <p>{asOfLine(t, sheet.asOf, event.timeZone, i18n.language)}</p>
          <p>{summaryLine(t, sheet)}</p>
        </header>
        <h2>{t('kitchenSheet.allergies')}</h2>
        <Allergies sheet={sheet} />
        <h2>{t('kitchenSheet.diets')}</h2>
        <Diets sheet={sheet} />
      </Page>
      {pages.map((courses, at) => (
        <Page key={courses[0]?.id ?? at} n={at + 2} m={m} paper={paper}>
          {courses.map((course) => (
            <section key={course.id} aria-labelledby={`ksp-${course.id}`}>
              <h2 id={`ksp-${course.id}`}>{course.name}</h2>
              <Course course={course} />
              <ByStation course={course} at="ksp" />
            </section>
          ))}
        </Page>
      ))}
    </>
  );
}

/** sc-34244's By station: a heading, then each station by its name with its lines, the Pass first and Chef's choice its last line. A list per station, so it reads the same on the page and in print. */
function ByStation({ course, at }: { course: KitchenCourse; at: string }) {
  const { t } = useTranslation();
  if (course.stations == null) return null;
  const id = `${at}-${course.id}-stations`;

  return (
    <div className="ks-stations">
      <h3 id={id} className="ks-sub-head">
        {t('kitchenSheet.byStation')}
      </h3>
      <div className="ks-station-grid">
        {course.stations.map((station) => (
          <div key={station.id} className="ks-station">
            <h4 id={`${id}-${station.id}`} className="ks-station-head">
              {station.name}
            </h4>
            <ul className="ks-station-lines" aria-labelledby={`${id}-${station.id}`}>
              {station.lines.map((line) => (
                <li
                  key={line.chefs ? '' : line.name}
                  className={line.chefs ? 'is-chefs' : undefined}
                >
                  <span className="ks-station-item">
                    {line.chefs ? t('kitchenSheet.chefsChoice') : line.name}
                  </span>
                  <span className="ks-sep"> · </span>
                  <span className="ks-n">{line.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const SHEET_PX: Record<Paper, number> = { a4: 1123, letter: 1056 };
const PADDING_AND_FOOT_PX = 133;
const STATIONS_PER_ROW = 3;

/** How tall a course stands on paper, near enough to choose its page: a course is never split across two. */
function paperHeight(course: KitchenCourse): number {
  const table =
    50 + 28 * (course.rows.length + 2) + (course.given == null ? 0 : 24) + (course.sides ? 24 : 0);
  if (course.stations == null) return table;

  const rows: number[] = [];
  course.stations.forEach((station, at) => {
    const row = Math.floor(at / STATIONS_PER_ROW);
    rows[row] = Math.max(rows[row] ?? 0, 26 + 24 * station.lines.length);
  });

  return table + 40 + rows.reduce((sum, row) => sum + row, 0) + 10 * (rows.length - 1);
}

/** The pages after the first. sc-3911's menu keeps every course on one page; with By station, courses fill a page in order and the next starts a new one. */
function coursePages(courses: readonly KitchenCourse[], paper: Paper): KitchenCourse[][] {
  if (courses.every((one) => one.stations == null)) return [[...courses]];
  const room = SHEET_PX[paper] - PADDING_AND_FOOT_PX;

  return courses.reduce<KitchenCourse[][]>((pages, course) => {
    const last = pages.at(-1);
    const used = (last ?? []).reduce((sum, one) => sum + paperHeight(one), 0);
    if (last != null && used + paperHeight(course) <= room) last.push(course);
    else pages.push([course]);

    return pages;
  }, []);
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
  const { t } = useTranslation();
  const label = t('kitchenSheet.page', { n, m });

  return (
    <article className={paper === 'letter' ? 'ks-sheet is-letter' : 'ks-sheet'} aria-label={label}>
      <div className="ks-sheet-body">{children}</div>
      <footer className="ks-foot">
        <span>{t('kitchenSheet.health')}</span>
        <span className="ks-foot-page">{label}</span>
      </footer>
    </article>
  );
}
