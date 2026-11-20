import type { AuditEntry, AuditFormat, AuditLogPage } from '@soirely/api-client';
import { Redirect, router } from 'expo-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../../../src/api.ts';
import {
  AuditDays,
  DatesButton,
  DatesScreen,
  EntrySheet,
  type Exporting,
  ExportScreen,
  FORMAT_KEYS,
  MenuButton,
} from '../../../src/components/AuditLogParts.tsx';
import { DataFrame } from '../../../src/components/DataAndControl.tsx';
import { Notice } from '../../../src/components/Notice.tsx';
import type { ScreenReaderTarget } from '../../../src/components/screenReaderFocus.ts';
import { moveScreenReaderFocus } from '../../../src/components/screenReaderFocus.ts';
import {
  CardSays,
  FailedBlock,
  Line,
  LoadingBlock,
  OnCard,
  PageToast,
  SummaryCard,
  TextAction,
} from '../../../src/components/Summary.tsx';
import type { TextHandle } from '../../../src/components/Text.tsx';
import { dateLocale, useShownLanguage } from '../../../src/i18n/index.ts';
import { DATA_HREF, dataAndControlListed, DESTINATION_HREF } from '../../../src/kit/appNav.ts';
import {
  AUDIT_FILE_TYPES,
  type AuditMenu,
  type AuditPicks,
  auditCard,
  auditFileName,
  auditFiltersOf,
  buttonWords,
  type DayRange,
  exportAnswered,
  exportRefused,
  exportsHere,
  lastYear,
  loadRefused,
  NO_PICKS,
  picked,
  rememberEntry,
  withMore,
} from '../../../src/kit/auditLog.ts';
import { eventHref } from '../../../src/kit/eventNav.ts';
import { writeToShare } from '../../../src/kit/sharedFile.ts';
import { settingsListBeside, useLayout } from '../../../src/layout/useLayout.ts';
import { useOffline } from '../../../src/offline.ts';
import { rereadOrganisations, useSignedIn } from '../../../src/signedIn.ts';
import { tokens } from '../../../src/theme/tokens.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: AuditLogPage; picks: AuditPicks }
  | { kind: 'locked' }
  | { kind: 'failed' };

/** Data and control › Audit log as its demo draws it (sc-611): who did what, by day, filtered by four menus; Export on an iPad only. */
export default function AuditLog() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const language = useShownLanguage();
  const { organisation } = useSignedIn();
  const listed = organisation != null && dataAndControlListed(organisation);
  const organisationId = listed ? organisation.id : undefined;
  const title = useRef<TextHandle>(null);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [picks, setPicks] = useState<AuditPicks>(NO_PICKS);
  const [menu, setMenu] = useState<AuditMenu | null>(null);
  const [dates, setDates] = useState<DayRange | null>(null);
  const [datesVisit, setDatesVisit] = useState(0);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState<Exporting>(null);
  const [exportVisit, setExportVisit] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [more, setMore] = useState<'resting' | 'loading' | 'failed'>('resting');
  const [toast, setToast] = useState<string | null>(null);
  const viewed = useRef(false);
  const asked = useRef(0);
  const cardStep = useRef<ViewInstance>(null);
  const from = useRef<ViewInstance | null>(null);
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return from.current ?? cardStep.current;
      },
    }),
    [],
  );
  const { watch, stale, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setAttempt((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(title.current),
  });

  useEffect(() => {
    if (organisationId == null) return;
    const ask = ++asked.current;

    watch(api.auditLog(organisationId, auditFiltersOf(picks))).then(
      (page) => {
        if (ask !== asked.current) return;
        setLoad({ kind: 'loaded', page, picks });
        setPreparing(page.preparing);
        setMore('resting');
        if (!viewed.current) {
          viewed.current = true;
          api.auditLogViewed(organisationId).catch(() => undefined);
        }
      },
      (error: unknown) => {
        if (ask !== asked.current) return;
        const refused = loadRefused(error);
        setLoad((before) =>
          refused === 'locked'
            ? { kind: 'locked' }
            : before.kind === 'loaded' && before.picks === picks
              ? before
              : { kind: 'failed' },
        );
      },
    );
  }, [organisationId, picks, attempt, language, watch]);

  if (organisation != null && !listed) return <Redirect href={DESTINATION_HREF.settings} />;

  const toHub = () => {
    if (settingsListBeside(kind)) router.replace(DATA_HREF.hub);
    else router.dismissTo(DATA_HREF.hub);
  };
  const back = { label: t('dataAndControl.title'), onPress: toHub };
  const retry = () => {
    void rereadOrganisations();
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };
  const choose = (next: AuditPicks) => {
    setMore('resting');
    setPicks(next);
  };
  const openEvent = (id: string) => router.push(eventHref(id));
  const openEntry = (entry: AuditEntry, view: ViewInstance | null) => {
    if (kind === 'phone') {
      rememberEntry(entry);
      router.push({ pathname: DATA_HREF.auditEntry, params: { id: entry.id } });
      return;
    }
    from.current = view;
    setOpen(entry);
  };

  async function showMore(page: AuditLogPage): Promise<void> {
    if (organisationId == null || page.next == null || more === 'loading') return;
    const ask = asked.current;
    setMore('loading');
    try {
      const next = await api.auditLog(organisationId, auditFiltersOf(picks), page.next);
      if (ask !== asked.current) return;
      setLoad({ kind: 'loaded', page: withMore(page, next), picks });
      setMore('resting');
    } catch {
      if (ask === asked.current) setMore('failed');
    }
  }

  async function exportAs(format: AuditFormat, zone: string | null): Promise<void> {
    if (organisationId == null || exportBusy) return;
    setExportBusy(true);
    try {
      const answer = exportAnswered(
        await api.exportAuditLog(organisationId, format, auditFiltersOf(picks)),
      );
      if (answer.kind === 'preparing') {
        setExporting(null);
        setPreparing(answer.email);
        return;
      }
      if (answer.kind !== 'file') return;
      const hand = await writeToShare(
        answer.bytes,
        auditFileName(format, new Date(), zone),
        AUDIT_FILE_TYPES[format],
      );
      setExporting(null);
      setToast(t('auditLog.downloading', { format: t(FORMAT_KEYS[format]) }));
      hand().catch(() => undefined);
    } catch (error) {
      const refused = exportRefused(error);
      setExporting({ format, refused: refused.kind === 'tooMany' ? 'tooMany' : 'failed' });
    } finally {
      setExportBusy(false);
    }
  }

  const body = (() => {
    if (load.kind === 'loading' || organisation == null)
      return <LoadingBlock words={t('auditLog.loading')} />;
    if (load.kind === 'failed')
      return (
        <FailedBlock
          title={t('auditLog.failed')}
          line={t('dataAndControl.tryLine')}
          onRetry={retry}
          testID="audit.retry"
        />
      );
    const locked = load.kind === 'locked';
    const page = load.kind === 'loaded' ? load.page : null;
    const card = auditCard(t, {
      organisation: page?.organisation ?? organisation.name,
      locked,
      preparing,
      kind,
    });
    const step = card.step;
    const clear = () => choose(NO_PICKS);

    return (
      <>
        <SummaryCard
          size={kind === 'tabletPortrait' ? 'wide' : 'page'}
          height={step == null ? 170 : 210}
          step={
            step == null || page == null
              ? null
              : {
                  label: step,
                  onPress: () => {
                    from.current = cardStep.current;
                    setExportVisit((n) => n + 1);
                    setExporting({ format: 'csv', refused: null });
                  },
                  testID: 'audit.step',
                  ref: cardStep,
                }
          }
          testID="audit.card"
        >
          <CardSays text={card.says} size={kind === 'tabletLandscape' ? 26 : 24} heading />
          <OnCard text={card.line} />
        </SummaryCard>
        {page != null && (
          <>
            <Filters
              picks={picks}
              page={page}
              menu={menu}
              onMenu={setMenu}
              onChoose={choose}
              onDates={(view) => {
                from.current = view;
                setDatesVisit((n) => n + 1);
                setDates(picks.range ?? lastYear(new Date(), page.zone));
              }}
              onClear={clear}
            />
            {page.entries.length === 0 ? (
              <View style={styles.none}>
                <Line size={15} quiet={false} text={t('auditLog.none')} />
                <TextAction label={t('auditLog.clear')} onPress={clear} testID="audit.none.clear" />
              </View>
            ) : (
              <AuditDays
                entries={page.entries}
                now={new Date()}
                zone={page.zone}
                locale={dateLocale()}
                onOpen={openEntry}
              />
            )}
            {page.next != null && load.kind === 'loaded' && load.picks === picks && (
              <TextAction
                label={more === 'loading' ? t('auditLog.showingMore') : t('auditLog.showMore')}
                onPress={() => void showMore(page)}
                testID="audit.more"
              />
            )}
            {more === 'failed' && (
              <Notice
                tone="broken"
                mark={tokens.marks.broken.glyph}
                body={t('auditLog.moreFailed')}
                announce
              />
            )}
          </>
        )}
      </>
    );
  })();

  const page = load.kind === 'loaded' ? load.page : null;

  return (
    <DataFrame
      title={t('auditLog.title')}
      back={{ ...back, pill: true }}
      paneBack={back}
      stale={stale}
      refreshing={refreshing}
      titleRef={title}
      over={
        <>
          {kind !== 'phone' && (
            <EntrySheet
              entry={open}
              opener={opener}
              onEvent={(id) => {
                setOpen(null);
                openEvent(id);
              }}
              onClose={() => setOpen(null)}
            />
          )}
          <DatesScreen
            key={`dates.${datesVisit}`}
            range={dates}
            opener={opener}
            locale={dateLocale()}
            onCancel={() => setDates(null)}
            onApply={(range) => {
              setDates(null);
              choose({ ...picks, range });
            }}
          />
          {exportsHere(kind) && (
            <ExportScreen
              key={`export.${exportVisit}`}
              exporting={exporting}
              busy={exportBusy}
              opener={opener}
              onCancel={() => setExporting(null)}
              onExport={(format) => void exportAs(format, page?.zone ?? null)}
            />
          )}
          {toast != null && (
            <PageToast
              words={toast}
              onClose={() => setToast(null)}
              bottom={insets.bottom + tokens.spaceLg}
            />
          )}
        </>
      }
    >
      {body}
    </DataFrame>
  );
}

function Filters({
  picks,
  page,
  menu,
  onMenu,
  onChoose,
  onDates,
  onClear,
}: {
  picks: AuditPicks;
  page: AuditLogPage;
  menu: AuditMenu | null;
  onMenu: (menu: AuditMenu | null) => void;
  onChoose: (picks: AuditPicks) => void;
  onDates: (view: ViewInstance | null) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const words = buttonWords(t, picks, page, dateLocale());

  return (
    <View style={styles.filters}>
      {(['person', 'type', 'event'] as const).map((which) => (
        <MenuButton
          key={which}
          which={which}
          word={words[which]}
          picks={picks}
          page={page}
          open={menu === which}
          onOpen={() => onMenu(which)}
          onClose={() => onMenu(null)}
          onChoose={(value) => {
            onMenu(null);
            if (value !== picks[which]) onChoose({ ...picks, [which]: value });
          }}
        />
      ))}
      <DatesButton word={words.dates} onPress={onDates} />
      {picked(picks) && (
        <TextAction label={t('auditLog.clear')} onPress={onClear} testID="audit.clear" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.space3xl,
  },
  none: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXs },
});
