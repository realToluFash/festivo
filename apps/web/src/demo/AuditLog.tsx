import { formattingLocale } from '@soirely/domain';
import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import {
  Card,
  CardStep,
  Chevron,
  Choices,
  Dialog,
  Head,
  Note,
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
  type Entry,
  type EntryType,
  FORMATS,
  type Filters,
  type Format,
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
import { SHARED_WORDS as S } from './dataControl.ts';
import { PageFailed, PageLoading, StatusLine, SubPage } from './DataControlParts.tsx';
import { useLoad } from './useDataControl.ts';
import type { Viewer } from './settings.ts';

interface MenuChoice {
  key: string;
  word: string;
}

/** Data and control › Audit log (sc-611): who did what, by day, with four filters and the entry one level in. */
export function AuditLog({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
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

  const shown = matching(ENTRIES, filters);
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
        byDay(shown, locale).map((day) => (
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
                    <span className="dc-time">{timeOf(one, locale)}</span>
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
          locale={locale}
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
        <EntryDialog entry={entry} locale={locale} onDone={() => setDetail(null)} />
      )}
      {exporting != null && (
        <ExportDialog
          tooMany={exporting === 'tooMany'}
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

/** A menu button per WAI-ARIA APG: arrows, Home and End move, Escape gives the focus back, a tick on the one in use. */
function FilterMenu({
  name,
  choices,
  picked,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  name: string;
  choices: readonly MenuChoice[];
  picked: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const into = useRef(false);
  const word = choices.find((one) => one.key === picked)?.word ?? choices[0]?.word ?? '';

  useEffect(() => {
    if (!open) return;

    const items = () => [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? []),
    ];
    const close = (back: boolean) => {
      onClose();
      if (back) button.current?.focus();
    };
    const keys = (event: KeyboardEvent) => {
      const all = items();
      const at = all.indexOf(document.activeElement as HTMLElement);

      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab') close(false);
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        all[(at + step + all.length) % all.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };

    if (into.current)
      (items().find((item) => item.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
    into.current = false;
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, onClose]);

  return (
    <div className="desk-menu-at">
      <button
        ref={button}
        id={id}
        type="button"
        className="desk-filter"
        aria-label={`${name}: ${word}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => {
          if (open) onClose();
          else {
            into.current = true;
            onOpen();
          }
        }}
        onKeyDown={(event) => {
          if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          into.current = true;
          onOpen();
        }}
      >
        {word}
        <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
      </button>
      {open && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          className="desk-menu dc-menu"
          role="menu"
          aria-label={name}
        >
          {choices.map((choice) => (
            <li key={choice.key} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={choice.key === picked}
                tabIndex={-1}
                className="desk-menu-item"
                onClick={() => {
                  onPick(choice.key);
                  onClose();
                  button.current?.focus();
                }}
              >
                <span className="desk-menu-tick">
                  {choice.key === picked && <Glyph name="tick" size={16} weight={2.6} />}
                </span>
                <span className="today-grow">{choice.word}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The range applies to the list as it changes; one the wrong way round is caught at once, under To. */
function DatesDialog({
  dates,
  locale,
  onChange,
  onCancel,
  onApply,
}: {
  dates: { from: string; to: string };
  locale: string;
  onChange: (dates: { from: string; to: string }) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const from = useRef<HTMLInputElement>(null);
  const fault = datesFault(dates.from, dates.to);

  return (
    <Dialog
      title={W.dates}
      verb={W.apply}
      on={fault == null}
      first={from}
      onDismiss={onCancel}
      onConfirm={() => {
        if (fault == null) onApply();
      }}
    >
      <div className="desk-fields">
        <DateField
          label={W.from}
          value={dates.from}
          inputRef={from}
          error={null}
          onChange={(value) => onChange({ ...dates, from: value })}
        />
        <DateField
          label={W.to}
          value={dates.to}
          error={fault}
          onChange={(value) => onChange({ ...dates, to: value })}
        />
      </div>
      <p className="desk-unseen" aria-live="polite">
        {fault == null ? rangeWords(dates, locale) : ''}
      </p>
    </Dialog>
  );
}

function DateField({
  label,
  value,
  error,
  inputRef,
  onChange,
}: {
  label: string;
  value: string;
  error: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

function EntryDialog({
  entry,
  locale,
  onDone,
}: {
  entry: Entry;
  locale: string;
  onDone: () => void;
}) {
  return (
    <Dialog title={W.entry} verb={W.done} cancel={false} onDismiss={onDone} onConfirm={onDone}>
      <dl className="desk-rows dc-facts">
        {factsOf(entry, locale).map((fact) => (
          <div key={fact.label} className="desk-row is-plain">
            <dt className="desk-row-line">{fact.label}</dt>
            <dd className={fact.code === true ? 'desk-row-name dc-code' : 'desk-row-name'}>
              {fact.link == null ? (
                fact.value
              ) : (
                <Link className="dc-link" to={fact.link}>
                  {fact.value}
                </Link>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <Note>{W.fixed}</Note>
    </Dialog>
  );
}

function ExportDialog({
  tooMany,
  onCancel,
  onExport,
}: {
  tooMany: boolean;
  onCancel: () => void;
  onExport: (format: Format) => void;
}) {
  const [format, setFormat] = useState<Format>('CSV');

  return (
    <Dialog
      title={W.exportStep}
      verb={W.export}
      on={!tooMany}
      onDismiss={onCancel}
      onConfirm={() => {
        if (!tooMany) onExport(format);
      }}
    >
      <Choices
        legend={W.format}
        hideLegend
        choices={FORMATS.map((name) => ({ name }))}
        picked={format}
        onPick={(name) => setFormat(name as Format)}
      />
      <Note>{W.exportLine}</Note>
      {tooMany && (
        <StatusLine kind="refused" alert>
          {W.tooMany}
        </StatusLine>
      )}
    </Dialog>
  );
}
