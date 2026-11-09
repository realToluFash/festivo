import { type ReactNode, useId } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Head, RowWords } from '../components/SettingsParts.tsx';
import type { SampleEvent } from './events.ts';
import { KW, kw, sheetLine } from './kitchen.ts';
import {
  type Figures,
  allergic,
  codeTitle,
  courseRows as sheetRows,
  dietCounts,
} from './kitchenChanges.ts';
import { type CourseSheet, type PartsSheet, PW, courseSheet, pw, wayWord } from './kitchenParts.ts';
import './kitchenParts.css';

/** sc-34244 on a course block: sc-3911's rows with each dish's parts under its name, then Served with this course, Plated at the pass and By table. */
export function PartsBlock({ sheet, coming }: { sheet: PartsSheet; coming: number }) {
  const id = useId();
  const made = courseSheet(sheet.course, sheet.room);
  const way = wayWord(sheet.course);

  return (
    <section className="desk-block kp" aria-labelledby={`${id}-course`}>
      <Head
        title={
          <span id={`${id}-course`}>
            {sheet.course.name}
            <span className="kitchen-count"> · {coming}</span>
          </span>
        }
      >
        {way != null && <span className="kp-way">{way}</span>}
      </Head>
      <ul className="desk-rows">
        {made.rows.map((row) => (
          <li key={row.id} className="desk-row">
            <RowWords
              title={row.name}
              lines={row.parts.map((line) => (
                <span key={line} className="kp-part">
                  {line}
                </span>
              ))}
            />
            <span className="kitchen-figure">{row.count}</span>
          </li>
        ))}
      </ul>
      <PartsAfter made={made} id={id} />
    </section>
  );
}

function PartsAfter({ made, id }: { made: CourseSheet; id: string }) {
  return (
    <>
      {made.servedWith.length > 0 && (
        <div className="kp-group">
          <h3 id={`${id}-with`} className="kp-head">
            {PW.servedWith}
          </h3>
          <ul className="kp-lines" aria-labelledby={`${id}-with`}>
            {made.servedWith.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {made.plated != null && <p className="kp-plated">{made.plated}</p>}
      {made.byTable.length > 0 && (
        <div className="kp-group">
          <h3 id={`${id}-tables`} className="kp-head">
            {PW.byTable}
          </h3>
          <table className="kp-table" aria-labelledby={`${id}-tables`}>
            <thead>
              <tr>
                <th scope="col">{PW.tableHead}</th>
                <th scope="col">{PW.plattersHead}</th>
              </tr>
            </thead>
            <tbody>
              {made.byTable.map((table) => (
                <tr key={table.id}>
                  <th scope="row">{table.name}</th>
                  <td>
                    {table.lines.map((line) => (
                      <span key={line} className="kp-line">
                        {line}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const PAGES = 3;

/** The printout and the PDF on A4 (sc-3911's black ink, 1 px rules, real headings and tables, the health footer), the parts in the page's lines and order. */
export function KitchenPaper({
  event,
  figures,
  sheet,
  now,
  back,
}: {
  event: SampleEvent;
  figures: Figures;
  sheet: PartsSheet;
  now: Date;
  back: string;
}) {
  const people = allergic(figures);
  const line = `${kw(KW.coming, { count: figures.coming })} · ${sheetLine(event, now, people.length)}`;
  const [starter, main, dessert] = figures.courses;

  return (
    <main id="content" className="kp-paper-page">
      <Link className="kp-back" to={back}>
        <Glyph name="back" size={17} weight={2.4} />
        {KW.title}
      </Link>
      <Sheet n={1}>
        <header className="kp-paper-head">
          <h1>{KW.title}</h1>
          <p>{event.name}</p>
          <p>{line}</p>
        </header>
        <h2>
          {KW.allergies} · {people.length}
        </h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{PW.name}</th>
              <th scope="col">{PW.allergicTo}</th>
              {figures.courses.map((course) => (
                <th key={course.id} scope="col">
                  {course.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((one) => (
              <tr key={one.guest}>
                <th scope="row">{one.name}</th>
                <td>{one.allergies.map(codeTitle).join(', ')}</td>
                {one.dishes.split(' · ').map((dish, index) => (
                  <td key={index}>{dish}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <h2>{KW.diets}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{PW.diet}</th>
              <th scope="col">{PW.peopleHead}</th>
            </tr>
          </thead>
          <tbody>
            {dietCounts(figures).map(([diet, count]) => (
              <tr key={diet}>
                <th scope="row">{codeTitle(diet)}</th>
                <td className="kp-n">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {starter != null && <PlainCourse figures={figures} id={starter.id} name={starter.name} />}
      </Sheet>
      <Sheet n={2}>{main != null && <PaperParts sheet={sheet} coming={figures.coming} />}</Sheet>
      <Sheet n={3}>
        {dessert != null && <PlainCourse figures={figures} id={dessert.id} name={dessert.name} />}
      </Sheet>
    </main>
  );
}

function Sheet({ n, children }: { n: number; children: ReactNode }) {
  return (
    <article className="kp-sheet" aria-label={pw(PW.page, { n, m: PAGES })}>
      <div className="kp-sheet-body">{children}</div>
      <footer className="kp-foot">
        <span>{PW.health}</span>
        <span>{pw(PW.page, { n, m: PAGES })}</span>
      </footer>
    </article>
  );
}

function PlainCourse({ figures, id, name }: { figures: Figures; id: string; name: string }) {
  return (
    <>
      <h2>
        {name} · {figures.coming}
      </h2>
      <table>
        <thead>
          <tr>
            <th scope="col">{PW.dishHead}</th>
            <th scope="col">{PW.peopleHead}</th>
          </tr>
        </thead>
        <tbody>
          {sheetRows(figures, id).map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td className="kp-n">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PaperParts({ sheet, coming }: { sheet: PartsSheet; coming: number }) {
  const made = courseSheet(sheet.course, sheet.room);
  const way = wayWord(sheet.course);

  return (
    <>
      <h2>
        {sheet.course.name} · {coming}
        {way != null && <span className="kp-paper-way"> · {way}</span>}
      </h2>
      <table>
        <thead>
          <tr>
            <th scope="col">{PW.dishHead}</th>
            <th scope="col">{PW.peopleHead}</th>
            {way != null && <th scope="col">{PW.partsHead}</th>}
          </tr>
        </thead>
        <tbody>
          {made.rows.map((row) => (
            <tr key={row.id} className={row.kind === 'dish' ? undefined : 'is-under'}>
              <th scope="row">{row.name}</th>
              <td className="kp-n">{row.count}</td>
              {way != null && (
                <td>
                  {row.parts.map((line) => (
                    <span key={line} className="kp-line">
                      {line}
                    </span>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {made.servedWith.length > 0 && (
        <>
          <h3>{PW.servedWith}</h3>
          <ul className="kp-paper-lines">
            {made.servedWith.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
      {made.plated != null && <p className="kp-paper-plated">{made.plated}</p>}
      {made.byTable.length > 0 && (
        <>
          <h3>{PW.byTable}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">{PW.tableHead}</th>
                <th scope="col">{PW.plattersHead}</th>
              </tr>
            </thead>
            <tbody>
              {made.byTable.map((table) => (
                <tr key={table.id}>
                  <th scope="row">{table.name}</th>
                  <td>
                    {table.lines.map((line) => (
                      <span key={line} className="kp-line">
                        {line}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
