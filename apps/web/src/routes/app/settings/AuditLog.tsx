import {
  AUDIT_AT_MOST,
  AUDIT_AT_ONCE,
  AUDIT_FORMATS,
  AUDIT_TYPES,
  ApiError,
  type AuditFormat,
  type AuditLogPage,
  type AuditType,
  type Membership,
} from '@soirely/api-client';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import {
  DatesDialog,
  EntryDialog,
  ExportDialog,
  FilterMenu,
  type MenuChoice,
} from '../../../components/AuditLogParts.tsx';
import { PageLoading, StatusLine } from '../../../components/DataControlParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  BackRow,
  Card,
  CardStep,
  Chevron,
  DeskPage,
  Head,
  OnCard,
  RowWords,
  Says,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import {
  type Filters,
  NO_FILTERS,
  asQuery,
  auditFileName,
  byDay,
  datesBackwards,
  factsOf,
  filtered,
  formatOf,
  rangeWords,
  saveAuditFile,
  typeWord,
  whoWord,
} from './auditLog.ts';
import { DATA_AND_CONTROL } from './ExportAllData.tsx';
import { type More, useAuditLog } from './useAuditLog.ts';
import '../../../components/SettingsParts.css';

export const AUDIT_LOG = `${DATA_AND_CONTROL}/audit-log`;

type Menu = 'person' | 'type' | 'event';

/** Data and control › Audit log at a desk (sc-611), as the design demo's /demo/settings/data-and-control/audit-log draws it. */
export function AuditLog() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'organisation.manage')) return <Forbidden />;

  return <AuditDesk key={organisation.id} organisation={organisation} />;
}

function AuditDesk({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const desk = useDeskTop();
  const { layers, covered, setHost } = useDeskLayers();
  const [search, setSearch] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const { load, more, showMore, reload, preparing } = useAuditLog(organisation.id, filters);
  const [told, setTold] = useState<string | null>(null);
  const [linkEnded, setLinkEnded] = useState<string | null>(null);
  const viewed = useRef(false);
  const linked = useRef(search.get('download'));

  useEffect(() => {
    if (load.kind !== 'loaded' || viewed.current) return;
    viewed.current = true;
    api.auditLogViewed(organisation.id).catch(() => undefined);
  }, [load.kind, organisation.id]);

  const followLink = useEffectEvent((exportId: string) => {
    setSearch({}, { replace: true });
    api.downloadAuditExport(organisation.id, exportId).then(
      (file) => {
        const format = formatOf(file.type);
        saveAuditFile(file.bytes, file.type, auditFileName(format, new Date(), null));
        setTold(t('auditLog.downloading', { format: t(`auditLog.formats.${format}`) }));
      },
      (error: unknown) =>
        setLinkEnded(
          error instanceof ApiError && (error.status === 404 || error.status === 410)
            ? t('auditLog.linkEnded')
            : t('dataControl.failedLine'),
        ),
    );
  });

  useEffect(() => {
    const exportId = linked.current;
    if (exportId == null) return;
    linked.current = null;
    followLink(exportId);
  }, []);

  if (load.kind === 'forbidden') return <Forbidden />;

  return (
    <DeskPage layers={layers}>
      <div className="desk-column" inert={covered}>
        <BackRow
          to={t('dataControl.title')}
          onBack={() => void navigate(DATA_AND_CONTROL)}
          bell={desk.bell}
        />
        <TitleRow title={t('auditLog.title')} underBack />
        {linkEnded != null && <StatusLine kind="ended">{linkEnded}</StatusLine>}
        {load.kind === 'loading' && <PageLoading words={t('auditLog.loading')} />}
        {load.kind === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{t('auditLog.failed')}</h2>
            <p className="desk-line">{t('dataControl.failedLine')}</p>
            <TextAction label={t('dataControl.tryAgain')} onClick={reload} />
          </div>
        )}
        {load.kind === 'locked' && (
          <Card>
            <Says>{t('auditLog.locked')}</Says>
            <OnCard>{t('auditLog.lockedLine', { organisation: organisation.name })}</OnCard>
          </Card>
        )}
        {load.kind === 'loaded' && (
          <Loaded
            page={load.page}
            organisation={organisation}
            filters={filters}
            onFilters={setFilters}
            more={more}
            onMore={showMore}
            onPreparing={preparing}
            tell={setTold}
          />
        )}
      </div>
      <div ref={setHost} className="desk-layers" />
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </DeskPage>
  );
}

type Exporting = { busy: boolean; refused: { words: string; stops: boolean } | null } | null;

function Loaded({
  page,
  organisation,
  filters,
  onFilters,
  more,
  onMore,
  onPreparing,
  tell,
}: {
  page: AuditLogPage;
  organisation: Membership;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  more: More;
  onMore: () => void;
  onPreparing: (email: string) => void;
  tell: (words: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [dates, setDates] = useState<{ from: string; to: string } | null>(null);
  const [kept, setKept] = useState<Filters>(filters);
  const [detail, setDetail] = useState<string | null>(null);
  const [exporting, setExporting] = useState<Exporting>(null);
  const datesButton = useRef<HTMLButtonElement>(null);
  const said = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const entry = page.entries.find((one) => one.id === detail) ?? null;
  const pick = (next: Partial<Filters>) => onFilters({ ...filters, ...next });
  const clear = () => onFilters(NO_FILTERS);
  const range = rangeWords(t, filters, locale);
  const people: MenuChoice[] = [
    { key: '', word: t('auditLog.anyone') },
    ...page.people.map((one) => ({
      key: one.id,
      word: one.left ? t('auditLog.personLeft', { name: one.name }) : one.name,
    })),
  ];
  const types: MenuChoice[] = [
    { key: '', word: t('auditLog.allTypes') },
    ...AUDIT_TYPES.map((one) => ({ key: one, word: typeWord(t, one) })),
  ];
  const events: MenuChoice[] = [
    { key: '', word: t('auditLog.allEvents') },
    ...page.events.map((one) => ({ key: one.id, word: one.name })),
  ];
  const formats = AUDIT_FORMATS.map((id) => ({ id, name: t(`auditLog.formats.${id}`) }));

  async function exportAs(format: AuditFormat): Promise<void> {
    setExporting({ busy: true, refused: null });

    try {
      const outcome = await api.exportAuditLog(organisation.id, format, asQuery(filters));
      setExporting(null);

      if (outcome.kind === 'file') {
        saveAuditFile(outcome.bytes, outcome.type, auditFileName(format, new Date(), page.zone));
        tell(t('auditLog.downloading', { format: t(`auditLog.formats.${format}`) }));
      } else {
        onPreparing(outcome.email);
        focusWhenFree(() => said.current);
      }
    } catch (error) {
      setExporting({
        busy: false,
        refused:
          error instanceof ApiError && error.is('audit_export_too_many')
            ? { words: t('auditLog.tooMany', { most: AUDIT_AT_MOST }), stops: true }
            : { words: t('dataControl.failedLine'), stops: false },
      });
    }
  }

  const days = byDay(t, page.entries, page.zone, locale, new Date());

  return (
    <>
      <Card>
        <div ref={said} className="desk-said-lines" tabIndex={-1} aria-live="polite">
          <Says>
            {page.preparing != null
              ? t('auditLog.preparing')
              : t('auditLog.says', { organisation: organisation.name })}
          </Says>
          <OnCard>
            {page.preparing != null
              ? t('auditLog.preparingLine', { email: page.preparing })
              : t('auditLog.line')}
          </OnCard>
        </div>
        {page.preparing == null && (
          <CardStep
            label={t('auditLog.exportStep')}
            onClick={() => setExporting({ busy: false, refused: null })}
          />
        )}
      </Card>
      <div className="dc-filters">
        <FilterMenu
          name={t('auditLog.person')}
          choices={people}
          picked={filters.person ?? ''}
          open={menu === 'person'}
          onOpen={() => setMenu('person')}
          onClose={closeMenu}
          onPick={(key) => pick({ person: key === '' ? null : key })}
        />
        <FilterMenu
          name={t('auditLog.type')}
          choices={types}
          picked={filters.type ?? ''}
          open={menu === 'type'}
          onOpen={() => setMenu('type')}
          onClose={closeMenu}
          onPick={(key) =>
            pick({ type: AUDIT_TYPES.find((one): one is AuditType => one === key) ?? null })
          }
        />
        <FilterMenu
          name={t('auditLog.event')}
          choices={events}
          picked={filters.event ?? ''}
          open={menu === 'event'}
          onOpen={() => setMenu('event')}
          onClose={closeMenu}
          onPick={(key) => pick({ event: key === '' ? null : key })}
        />
        <button
          ref={datesButton}
          type="button"
          className="desk-filter"
          aria-haspopup="dialog"
          aria-label={t('auditLog.datesLabel', { range })}
          onClick={() => {
            setKept(filters);
            setDates({ from: filters.from, to: filters.to });
          }}
        >
          {range}
          <Glyph name="chevdown" size={16} weight={2.4} />
        </button>
        {filtered(filters) && <TextAction label={t('auditLog.clear')} onClick={clear} />}
      </div>
      {days.length === 0 ? (
        <div className="desk-empty" role="status">
          <p className="desk-empty-title">{t('auditLog.noMatch')}</p>
          <TextAction label={t('auditLog.clear')} onClick={clear} />
        </div>
      ) : (
        days.map((day) => (
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
                    <span className="dc-time">{one.time}</span>
                    <RowWords
                      title={one.what}
                      lines={[
                        t('auditLog.rowLine', {
                          who: whoWord(t, one.who),
                          type: typeWord(t, one.type),
                        }),
                      ]}
                    />
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {page.next != null && (
        <div className="desk-block">
          <TextAction label={t('auditLog.showMore')} onClick={onMore} />
          {more === 'failed' && (
            <p className="desk-error" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {t('dataControl.failedLine')}
            </p>
          )}
          <p className="desk-unseen" role="status">
            {more === 'loading' ? t('auditLog.loading') : ''}
          </p>
        </div>
      )}
      {dates != null && (
        <DatesDialog
          dates={dates}
          words={{
            title: t('auditLog.dates'),
            apply: t('auditLog.apply'),
            from: t('auditLog.from'),
            to: t('auditLog.to'),
          }}
          fault={datesBackwards(dates.from, dates.to) ? t('auditLog.backwards') : null}
          range={rangeWords(t, dates, locale)}
          onChange={(next) => {
            setDates(next);
            if (!datesBackwards(next.from, next.to)) onFilters({ ...filters, ...next });
          }}
          onCancel={() => {
            onFilters(kept);
            setDates(null);
            focusWhenFree(() => datesButton.current);
          }}
          onApply={() => {
            onFilters({ ...filters, ...dates });
            setDates(null);
            focusWhenFree(() => datesButton.current);
          }}
        />
      )}
      {entry != null && (
        <EntryDialog
          title={t('auditLog.entry')}
          done={t('auditLog.done')}
          facts={factsOf(t, entry)}
          fixed={t('auditLog.fixed')}
          onDone={() => setDetail(null)}
        />
      )}
      {exporting != null && (
        <ExportDialog
          words={{
            title: t('auditLog.exportStep'),
            export: t('auditLog.export'),
            format: t('auditLog.format'),
            line: t('auditLog.exportLine', { atOnce: AUDIT_AT_ONCE }),
          }}
          formats={formats}
          refused={exporting.refused}
          busy={exporting.busy}
          onCancel={() => setExporting(null)}
          onExport={(format) => void exportAs(format)}
        />
      )}
    </>
  );
}
