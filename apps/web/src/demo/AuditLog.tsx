import { formattingLocale } from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  DatesDialog,
  EntryDialog,
  ExportDialog,
  FilterMenu,
  type MenuChoice,
} from '../components/AuditLogParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import {
  Card,
  CardStep,
  Chevron,
  Head,
  OnCard,
  RowWords,
  Says,
  type Tell,
  TextAction,
} from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import {
  AUDIT_WORDS as W,
  type AuditMenu,
  ENTRIES,
  EVENTS,
  type EntryType,
  FORMATS,
  type Filters,
  NO_FILTERS,
  PEOPLE,
  TYPES,
  auditStart,
  byDay,
  datesFault,
  downloading,
  exportOutcome,
  factsOf,
  filtered,
  matching,
  rangeWords,
  timeOf,
} from './auditLog.ts';
import { SHARED_WORDS as S, zoneFor } from './dataControl.ts';
import { PageFailed, PageLoading, SubPage } from './DataControlParts.tsx';
import { useLoad } from './useDataControl.ts';
import type { Viewer } from './settings.ts';

const DATES_WORDS = { title: W.dates, apply: W.apply, from: W.from, to: W.to };
const EXPORT_WORDS = {
  title: W.exportStep,
  export: W.export,
  format: W.format,
  line: W.exportLine,
};
const EXPORT_FORMATS = FORMATS.map((name) => ({ id: name, name }));

/** Data and control › Audit log (sc-611): who did what, by day, with four filters and the entry one level in. */
export function AuditLog({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const zone = zoneFor(viewer);
  const [start] = useState(() => auditStart(state));
  const [load, retry] = useLoad(start.load);
  const [filters, setFilters] = useState<Filters>(start.filters);
  const [menu, setMenu] = useState<AuditMenu | null>(start.menu);
  const [dates, setDates] = useState(start.dates);
  const [kept, setKept] = useState<Filters | null>(start.dates == null ? null : NO_FILTERS);
  const [detail, setDetail] = useState(start.detail);
  const [exporting, setExporting] = useState(start.exporting);
  const [preparing, setPreparing] = useState(start.preparing);
  const datesButton = useRef<HTMLButtonElement>(null);
  const said = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (start.told != null) tell(start.told);
  }, [start.told, tell]);

  if (load !== 'loaded')
    return (
      <SubPage page="auditLog" title={W.title} viewer={viewer} tell={tell}>
        {load === 'failed' ? (
          <PageFailed words={W.failed} onRetry={retry} />
        ) : (
          <PageLoading words={W.loading} />
        )}
      </SubPage>
    );

  if (start.locked)
    return (
      <SubPage page="auditLog" title={W.title} viewer={viewer} tell={tell}>
        <Card>
          <Says>{W.locked}</Says>
          <OnCard>{W.lockedLine}</OnCard>
          <CardStep label={S.contact} onClick={() => tell(S.contactTold)} />
        </Card>
      </SubPage>
    );

  const shown = matching(ENTRIES, filters, zone);
  const entry = ENTRIES.find((one) => one.id === detail) ?? null;
  const clear = () => setFilters(NO_FILTERS);
  const pick = (next: Partial<Filters>) => setFilters((now) => ({ ...now, ...next }));
  const people: MenuChoice[] = [
    { key: '', word: W.anyone },
    ...PEOPLE.map((one) => ({
      key: one.name,
      word: one.left ? `${one.name} · ${W.left}` : one.name,
    })),
  ];
  const types: MenuChoice[] = [
    { key: '', word: W.allTypes },
    ...TYPES.map((one) => ({ key: one, word: one })),
  ];
  const events: MenuChoice[] = [
    { key: '', word: W.allEvents },
    ...EVENTS.map((one) => ({ key: one.name, word: one.name })),
  ];

  return (
    <SubPage page="auditLog" title={W.title} viewer={viewer} tell={tell}>
      <Card>
        <div ref={said} className="desk-said-lines" tabIndex={-1} aria-live="polite">
          <Says>{preparing ? W.preparing : W.says}</Says>
          <OnCard>{preparing ? W.preparingLine : W.line}</OnCard>
        </div>
        {!preparing && <CardStep label={W.exportStep} onClick={() => setExporting('asking')} />}
      </Card>
      <div className="dc-filters">
        <FilterMenu
          name={W.person}
          choices={people}
          picked={filters.person ?? ''}
          open={menu === 'person'}
          onOpen={() => setMenu('person')}
          onClose={() => setMenu(null)}
          onPick={(key) => pick({ person: key === '' ? null : key })}
        />
        <FilterMenu
          name={W.type}
          choices={types}
          picked={filters.type ?? ''}
          open={menu === 'type'}
          onOpen={() => setMenu('type')}
          onClose={() => setMenu(null)}
          onPick={(key) => pick({ type: key === '' ? null : (key as EntryType) })}
        />
        <FilterMenu
          name={W.event}
          choices={events}
          picked={filters.event ?? ''}
          open={menu === 'event'}
          onOpen={() => setMenu('event')}
          onClose={() => setMenu(null)}
          onPick={(key) => pick({ event: key === '' ? null : key })}
        />
        <button
          ref={datesButton}
          type="button"
          className="desk-filter"
          aria-haspopup="dialog"
          aria-label={`${W.dates}: ${rangeWords(filters, locale)}`}
          onClick={() => {
            setKept(filters);
            setDates({ from: filters.from, to: filters.to });
          }}
        >
          {rangeWords(filters, locale)}
          <Glyph name="chevdown" size={16} weight={2.4} />
        </button>
        {filtered(filters) && <TextAction label={W.clear} onClick={clear} />}
      </div>
      {shown.length === 0 ? (
        <div className="desk-empty" role="status">
          <p className="desk-empty-title">{W.noMatch}</p>
          <TextAction label={W.clear} onClick={clear} />
        </div>
      ) : (
        byDay(shown, locale, zone).map((day) => (
          <section key={day.day} className="desk-block">
            <Head title={day.heading} />
            <ul className="desk-rows dc-entries">
              {day.entries.map((one) => (
                <li key={one.id}>
                  <button
                    type="button"
                    className="desk-row"
                    data-entry={one.id}
                    onClick={() => setDetail(one.id)}
                  >
                    <span className="dc-time">{timeOf(one, locale, zone)}</span>
                    <RowWords title={one.what} lines={[`${one.who} · ${one.type}`]} />
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {dates != null && (
        <DatesDialog
          dates={dates}
          words={DATES_WORDS}
          fault={datesFault(dates.from, dates.to)}
          range={rangeWords(dates, locale)}
          onChange={(next) => {
            setDates(next);
            if (datesFault(next.from, next.to) == null) setFilters((now) => ({ ...now, ...next }));
          }}
          onCancel={() => {
            if (kept != null) setFilters(kept);
            setDates(null);
            focusWhenFree(() => datesButton.current);
          }}
          onApply={() => {
            setFilters((now) => ({ ...now, ...dates }));
            setDates(null);
            focusWhenFree(() => datesButton.current);
          }}
        />
      )}
      {entry != null && (
        <EntryDialog
          title={W.entry}
          done={W.done}
          facts={factsOf(entry, locale, zone)}
          fixed={W.fixed}
          onDone={() => setDetail(null)}
        />
      )}
      {exporting != null && (
        <ExportDialog
          words={EXPORT_WORDS}
          formats={EXPORT_FORMATS}
          refused={exporting === 'tooMany' ? { words: W.tooMany, stops: true } : null}
          onCancel={() => setExporting(null)}
          onExport={(format) => {
            const outcome = exportOutcome(shown.length);

            if (outcome === 'tooMany') {
              setExporting('tooMany');
              return;
            }
            setExporting(null);
            if (outcome === 'download') tell(downloading(format));
            else {
              setPreparing(true);
              focusWhenFree(() => said.current);
            }
          }}
        />
      )}
    </SubPage>
  );
}
