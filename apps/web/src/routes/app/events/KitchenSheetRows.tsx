import type { KitchenCell, KitchenCourse, KitchenSheet } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { Head, RowWords } from '../../../components/SettingsParts.tsx';
import { type CellState, StateMark } from './kitchenMarks.tsx';
import { allergenName, allergensOf, dietName, stateRows } from './kitchenSheet.ts';

const CELL_WORDS: Record<CellState, string> = {
  kitchen: 'kitchenSheet.kitchen',
  skipped: 'kitchenSheet.skipped',
  host: 'kitchenSheet.needsHost',
  changed: 'kitchenSheet.cellChanged',
  notYet: 'kitchenSheet.cellNotYet',
  never: 'kitchenSheet.cellNever',
};

export function CellWords({
  cell,
  look = 'kitchen-state',
}: {
  cell: KitchenCell;
  look?: 'kitchen-state' | 'ks-state';
}) {
  const { t } = useTranslation();
  if (cell.kind === 'dish') return <>{cell.text}</>;

  return (
    <span className={look}>
      <StateMark kind={cell.kind} />
      {t(CELL_WORDS[cell.kind])}
    </span>
  );
}

function Lead({ glyph }: { glyph: 'alert' | 'menu' }) {
  return (
    <span className="ev-lead" aria-hidden="true">
      <Glyph name={glyph} size={22} weight={2} />
    </span>
  );
}

function CountRow({
  glyph,
  name,
  count,
}: {
  glyph: 'alert' | 'menu';
  name: string;
  count: number;
}) {
  return (
    <li className="desk-row">
      <Lead glyph={glyph} />
      <RowWords title={name} />
      <span className="kitchen-figure">{count}</span>
    </li>
  );
}

/** Every person at once, each with their cells in course order; without names, a count per allergen. */
export function AllergyRows({ sheet }: { sheet: KitchenSheet }) {
  const { t } = useTranslation();
  const none = sheet.allergicCount === 0;

  return (
    <section className="desk-block" aria-labelledby="ks-allergies">
      <Head
        title={
          <span id="ks-allergies">
            {t('kitchenSheet.allergies')}
            <span className="kitchen-count"> · {sheet.allergicCount}</span>
          </span>
        }
      />
      {none && <p className="desk-line">{t('kitchenSheet.noAllergies')}</p>}
      {sheet.allergic != null && sheet.allergic.length > 0 && (
        <ul className="desk-rows">
          {sheet.allergic.map((person) => (
            <li key={person.id} className="desk-row">
              <Lead glyph={person.allergens.length > 0 ? 'alert' : 'menu'} />
              <RowWords
                title={person.name}
                lines={[
                  allergensOf(t, person),
                  <span key="cells">
                    {person.cells.map((cell, at) => (
                      <span key={sheet.courses[at]?.id ?? at}>
                        {at > 0 && ' · '}
                        <CellWords cell={cell} />
                      </span>
                    ))}
                  </span>,
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      {sheet.allergic != null && !none && (
        <p className="desk-line">
          {sheet.allergyCounts
            .map(({ code, count }) =>
              t('kitchenSheet.perAllergen', { allergen: allergenName(t, code), count }),
            )
            .join(' · ')}
        </p>
      )}
      {sheet.allergic == null && !none && (
        <>
          <ul className="desk-rows">
            {sheet.allergyCounts.map(({ code, count }) => (
              <CountRow key={code} glyph="alert" name={allergenName(t, code)} count={count} />
            ))}
          </ul>
          <p className="desk-line">{t('kitchenSheet.namesNeed')}</p>
        </>
      )}
    </section>
  );
}

export function DietRows({ sheet }: { sheet: KitchenSheet }) {
  const { t } = useTranslation();

  return (
    <section className="desk-block" aria-labelledby="ks-diets">
      <Head title={<span id="ks-diets">{t('kitchenSheet.diets')}</span>} />
      {sheet.dietCounts.length === 0 ? (
        <p className="desk-line">{t('kitchenSheet.noDiets')}</p>
      ) : (
        <ul className="desk-rows">
          {sheet.dietCounts.map(({ code, count }) => (
            <CountRow key={code} glyph="menu" name={dietName(t, code)} count={count} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** A course's dishes, variants and sides indented under theirs, then its states, closing on the room. */
export function CourseRows({ course }: { course: KitchenCourse }) {
  const { t } = useTranslation();
  const id = `ks-${course.id}`;

  return (
    <section className="desk-block" aria-labelledby={id}>
      <Head title={<span id={id}>{course.name}</span>} />
      <ul className="desk-rows">
        {course.rows.map((row) => (
          <li key={row.id} className={row.kind === 'dish' ? 'desk-row' : 'desk-row kitchen-under'}>
            <RowWords
              title={
                row.kind === 'dish'
                  ? row.name
                  : t(row.kind === 'variant' ? 'kitchenSheet.variant' : 'kitchenSheet.side', {
                      name: row.name,
                    })
              }
            />
            <span className="kitchen-figure">{row.count}</span>
          </li>
        ))}
        {stateRows(t, course).map((row) => (
          <li key={row.key} className="desk-row">
            <RowWords
              title={
                row.mark == null ? (
                  row.name
                ) : (
                  <span className="kitchen-state">
                    <StateMark kind={row.mark} />
                    {row.name}
                  </span>
                )
              }
            />
            <span className="kitchen-figure">{row.count}</span>
          </li>
        ))}
        <li className="desk-row kitchen-room">
          <RowWords title={t('kitchenSheet.room')} />
          <span className="kitchen-figure">{course.room}</span>
        </li>
      </ul>
      {course.given != null && (
        <p className="desk-line">
          {t('kitchenSheet.given', { count: course.given.count, dish: course.given.plate })}
        </p>
      )}
      {course.sides && <p className="desk-line">{t('kitchenSheet.sides')}</p>}
      <StationRows course={course} />
    </section>
  );
}

/** sc-34244's By station: each station by its name with its lines, the Pass first and Chef's choice its last line. */
function StationRows({ course }: { course: KitchenCourse }) {
  const { t } = useTranslation();
  if (course.stations == null) return null;
  const id = `ks-${course.id}-stations`;

  return (
    <div className="kitchen-stations">
      <h3 id={id} className="kitchen-sub">
        {t('kitchenSheet.byStation')}
      </h3>
      {course.stations.map((station) => (
        <div key={station.id}>
          <h4 id={`${id}-${station.id}`} className="kitchen-station-head">
            {station.name}
          </h4>
          <ul className="desk-rows" aria-labelledby={`${id}-${station.id}`}>
            {station.lines.map((line) => (
              <li key={line.chefs ? '' : line.name} className="desk-row">
                <RowWords title={line.chefs ? t('kitchenSheet.chefsChoice') : line.name} />
                <span className="kitchen-figure">{line.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
