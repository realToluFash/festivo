import {
  ApiError,
  type KitchenCell,
  type KitchenCourse,
  type KitchenSheet,
  type OrganisationEvent,
} from '@soirely/api-client';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { daysWords } from '../../../eventsList.ts';
import {
  allergenName,
  allergensOf,
  asOfLine,
  dietName,
  saveSheet,
  summaryLine,
} from './kitchenSheet.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import './kitchenSheet.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'refused' }
  | { kind: 'loaded'; sheet: KitchenSheet };

type Pdf =
  { kind: 'rest' } | { kind: 'making' } | { kind: 'made'; file: string } | { kind: 'failed' };

type Paper = 'a4' | 'letter';

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
    <div className="desk ev desk-page ev-page gs ks">
      <div className="ev-wide gs-page">
        <Crumbs event={event} />
        {load.kind === 'loaded' ? (
          <SheetScreen event={event} sheet={load.sheet} />
        ) : (
          <>
            <Top event={event} />
            {load.kind === 'loading' ? (
              <div className="ks-loading" aria-busy="true">
                <p role="status">{t('kitchenSheet.loading')}</p>
                {[0, 1, 2].map((one) => (
                  <div key={one} className="ks-bone" aria-hidden="true" />
                ))}
              </div>
            ) : (
              <div className="ks-failed" role="alert">
                <p>
                  <Glyph name="alert" size={17} weight={2.4} />
                  {t('kitchenSheet.cannotReach')}
                </p>
                <button
                  type="button"
                  className="gs-pill is-secondary ks-act"
                  onClick={() => {
                    setLoad({ kind: 'loading' });
                    setAttempt((n) => n + 1);
                  }}
                >
                  {t('kitchenSheet.retry')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Without Menu read: the padlock, and the way back to the event. */
export function KitchenSheetRefused({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();

  return (
    <div className="desk ev desk-page ev-page gs ks">
      <div className="ev-wide gs-page">
        <Crumbs event={event} />
        <section className="desk-block ks-refused" aria-labelledby="ks-refused">
          <span className="ks-lock" aria-hidden="true">
            <Glyph name="lock" size={28} weight={2.2} />
          </span>
          <h1 id="ks-refused" className="gs-title" tabIndex={-1}>
            {t('kitchenSheet.refused')}
          </h1>
          <Link
            className="gs-pill is-primary ks-go"
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

function Top({
  event,
  sheet = null,
  children,
}: {
  event: OrganisationEvent;
  sheet?: KitchenSheet | null;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();

  return (
    <header className="gs-top ks-top">
      <div className="ks-head">
        <h1 className="gs-title" tabIndex={-1}>
          {t('kitchenSheet.title')}
        </h1>
        <p className="ks-event">{event.name}</p>
        <p className="ks-event">{daysWords(event, new Date(), i18n.language, t)}</p>
        {sheet != null && (
          <p className="ks-as-of">{asOfLine(t, sheet.asOf, event.timeZone, i18n.language)}</p>
        )}
      </div>
      {children}
    </header>
  );
}

function SheetScreen({ event, sheet }: { event: OrganisationEvent; sheet: KitchenSheet }) {
  const { t } = useTranslation();
  const [pdf, setPdf] = useState<Pdf>({ kind: 'rest' });

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
      <Top event={event} sheet={sheet}>
        <div className="ks-acts">
          <button
            type="button"
            className="gs-pill is-primary ks-act"
            aria-disabled={pdf.kind === 'making'}
            onClick={() => {
              if (pdf.kind !== 'making') make();
            }}
          >
            {pdf.kind === 'making' ? (
              <span className="ks-spin" aria-hidden="true" />
            ) : (
              <DownloadMark />
            )}
            {pdf.kind === 'making' ? t('kitchenSheet.making') : t('kitchenSheet.download')}
          </button>
          <Link
            className="gs-pill is-secondary ks-act"
            to={`${sheetPath(event)}?paper=${sheet.paper}`}
          >
            <PrintMark />
            {t('kitchenSheet.print')}
          </Link>
        </div>
      </Top>
      <div className="ks-said" role="status">
        {pdf.kind === 'made' && (
          <p className="gs-ok">
            <Glyph name="tick" size={17} weight={2.6} />
            {t('kitchenSheet.made', { file: pdf.file })}
          </p>
        )}
      </div>
      {pdf.kind === 'failed' && (
        <div className="ks-failed" role="alert">
          <p>
            <Glyph name="alert" size={17} weight={2.4} />
            {t('kitchenSheet.failed')}
          </p>
          <button type="button" className="gs-pill is-secondary ks-act" onClick={make}>
            {t('kitchenSheet.retry')}
          </button>
        </div>
      )}
      <div className="ks-body">
        <p className="ks-summary">{summaryLine(t, sheet)}</p>
        <section className="desk-block ks-card ks-allergies" aria-labelledby="ks-allergies">
          <h2 id="ks-allergies" className="ks-card-head">
            <span className="ks-allergy-mark" aria-hidden="true">
              <Glyph name="alert" size={18} weight={2.4} />
            </span>
            {t('kitchenSheet.allergies')}
          </h2>
          <Allergies sheet={sheet} screen />
        </section>
        <section className="desk-block ks-card" aria-labelledby="ks-diets">
          <h2 id="ks-diets" className="ks-card-head">
            {t('kitchenSheet.diets')}
          </h2>
          <Diets sheet={sheet} />
        </section>
        {sheet.courses.map((course) => (
          <section
            key={course.id}
            className="desk-block ks-card"
            aria-labelledby={`ks-${course.id}`}
          >
            <h2 id={`ks-${course.id}`} className="ks-card-head">
              {course.name}
            </h2>
            <Course course={course} />
            <ByStation course={course} at="ks" />
          </section>
        ))}
      </div>
      <div className="ks-paper-page is-print" hidden>
        <PaperSheets event={event} sheet={sheet} paper={sheet.paper} />
      </div>
    </>
  );
}

function Allergies({ sheet, screen = false }: { sheet: KitchenSheet; screen?: boolean }) {
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
      <table className={screen ? 'ks-table ks-people' : 'ks-table'}>
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
              <td data-head={t('kitchenSheet.allergicTo')}>{allergensOf(t, person)}</td>
              {person.cells.map((cell, index) => (
                <td key={sheet.courses[index]?.id ?? index} data-head={sheet.courses[index]?.name}>
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
            .map(({ code, count }) =>
              t('kitchenSheet.perAllergen', { allergen: allergenName(t, code), count }),
            )
            .join(' · ')}
        </p>
      )}
    </>
  );
}

type State = Exclude<KitchenCell['kind'], 'dish'>;

const CELL_WORDS: Record<State, string> = {
  kitchen: 'kitchenSheet.kitchen',
  skipped: 'kitchenSheet.skipped',
  host: 'kitchenSheet.needsHost',
  notYet: 'kitchenSheet.cellNotYet',
  never: 'kitchenSheet.cellNever',
};

function CellWords({ cell }: { cell: KitchenCell }) {
  const { t } = useTranslation();
  if (cell.kind === 'dish') return <>{cell.text}</>;

  return (
    <span className="ks-state">
      <StateMark kind={cell.kind} />
      {t(CELL_WORDS[cell.kind])}
    </span>
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

interface StateRow {
  key: string;
  name: string;
  count: number;
  mark: State | null;
}

function Course({ course }: { course: KitchenCourse }) {
  const { t } = useTranslation();
  const states: StateRow[] = [
    { key: 'kitchen', name: t('kitchenSheet.kitchen'), count: course.kitchen, mark: null },
    { key: 'skipped', name: t('kitchenSheet.skipped'), count: course.skipped, mark: 'skipped' },
    ...(course.needsHost > 0
      ? [
          {
            key: 'host',
            name: t('kitchenSheet.needsHost'),
            count: course.needsHost,
            mark: 'host' as const,
          },
        ]
      : []),
    ...(course.notChosen > 0
      ? [
          {
            key: 'none',
            name: t(course.never ? 'kitchenSheet.never' : 'kitchenSheet.notYet', {
              count: course.notChosen,
            }),
            count: course.notChosen,
            mark: course.never ? ('never' as const) : ('notYet' as const),
          },
        ]
      : []),
  ];

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
          {states.map((row) => (
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
  const pages = coursePages(sheet.courses);
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

const PAGE_PX = 990;

/** How tall a course stands on paper, near enough to choose its page: a course is never split across two. */
function paperHeight(course: KitchenCourse): number {
  const table =
    50 + 28 * (course.rows.length + 2) + (course.given == null ? 0 : 24) + (course.sides ? 24 : 0);
  const lines = Math.max(0, ...(course.stations ?? []).map((one) => one.lines.length));

  return table + (course.stations == null ? 0 : 66 + 24 * lines);
}

/** The pages after the first. sc-3911's menu keeps every course on one page; with By station, courses fill a page in order and the next starts a new one. */
function coursePages(courses: readonly KitchenCourse[]): KitchenCourse[][] {
  if (courses.every((one) => one.stations == null)) return [[...courses]];

  return courses.reduce<KitchenCourse[][]>((pages, course) => {
    const last = pages.at(-1);
    const used = (last ?? []).reduce((sum, one) => sum + paperHeight(one), 0);
    if (last != null && used + paperHeight(course) <= PAGE_PX) last.push(course);
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

/** Each state a shape with its word: Needs the host a triangle, Skipped a circle with a minus, not chosen a dashed circle. */
function StateMark({ kind }: { kind: State }) {
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
