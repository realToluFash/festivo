import { formattingLocale, searching } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { BackButton } from '../../components/AppFrame.tsx';
import { PrimaryButton } from '../../components/Buttons.tsx';
import { SearchField, SearchRow } from '../../components/EventsSearch.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { ListTop } from '../../components/ListTop.tsx';
import { Refreshing } from '../../components/Refreshing.tsx';
import { Notice } from '../../components/Notice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { kindOf, useShell } from '../../components/settingsShell.ts';
import {
  HeadCount,
  LoadingBlock,
  Row,
  RowList,
  SectionHead,
  SunkTabs,
  TextAction,
} from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { backToEvents } from '../events/EventFrame.tsx';
import { OfflineBand } from '../events/EventsList.tsx';
import { Bell, OrgPill } from '../settings/Frame.tsx';
import { nextFor, openOrder, relativeWords } from './ConsultationsModel.ts';
import { EnquiriesFrame } from './EnquiriesFrame.tsx';
import {
  ENQUIRY_TABS,
  type Enquiry,
  type EnquiryState,
  type EnquiryTab,
  NOW,
  type Results,
  asQuery,
  assignedWords,
  byTab,
  changedWords,
  resultsOf,
  startOf,
  visibleTo,
  whatLine,
} from './EnquiriesModel.ts';
import { W } from './EnquiriesWords.ts';
import { EnquiryForm } from './EnquiryForm.tsx';
import { type NewStart } from './EnquiryFormModel.ts';
import { keepMade } from './made.ts';

const SEARCH_PAUSE_MS = 300;
/** The searching state holds its pause long enough to be seen, then searches as typing would. */
const PAUSE_SHOWN_MS = 2500;
const REFRESH_MS = 1200;

export function enquiryHref(id: string, query: string): Href {
  return `/demo/enquiries/${id}${query === '' ? '' : `?${query}`}` as Href;
}

/** Enquiries (sc-31226) with its search (sc-42749): Search enquiries over Open, Won and Lost; while something is searched, one set of results grouped by tab. */
export function EnquiriesList({
  state,
  newStart = null,
}: {
  state: EnquiryState;
  newStart?: NewStart | null;
}) {
  const { t } = useTranslation();
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const start = useMemo(() => startOf(state), [state]);
  const [tab, setTab] = useState<EnquiryTab>(start.tab);
  const [typed, setTyped] = useState(start.typed);
  const [searched, setSearched] = useState(start.pausing ? '' : start.typed);
  const [mine, setMine] = useState(start.viewer.mine);
  const [offline, setOffline] = useState(start.offline);
  const [listFailed, setListFailed] = useState(start.listFailed);
  const [searchFailed, setSearchFailed] = useState(start.searchFailed);
  const [refreshing, setRefreshing] = useState(start.refreshing);
  const [making, setMaking] = useState(newStart == null ? 0 : 1);
  const [newOpen, setNewOpen] = useState(newStart != null);
  const newOpener = useRef<ViewInstance>(null);
  const field = useRef<TextInputInstance>(null);
  const firstPause = useRef(start.pausing);
  const viewer = useMemo(() => ({ person: start.viewer.person, mine }), [start, mine]);
  const manages = viewer.person.role !== 'member';
  const wide = shell.layout !== 'phone';
  const tabs = useMemo(() => {
    const sorted = byTab(visibleTo(start.enquiries, viewer));

    return { ...sorted, open: openOrder(sorted.open, nextFor) };
  }, [start, viewer]);
  const results = useMemo(
    () => (searching(searched) ? resultsOf(start.enquiries, viewer, searched) : null),
    [searched, start, viewer],
  );

  useEffect(() => {
    if (start.pausing) field.current?.focus();
  }, [start]);

  useEffect(() => {
    if (!refreshing || start.refreshing) return undefined;
    const later = setTimeout(() => setRefreshing(false), REFRESH_MS);

    return () => clearTimeout(later);
  }, [refreshing, start]);

  useEffect(() => {
    if (typed === searched || typed.trim() === '') return undefined;
    const wait = setTimeout(
      () => {
        firstPause.current = false;
        setSearched(typed);
      },
      firstPause.current ? PAUSE_SHOWN_MS : SEARCH_PAUSE_MS,
    );

    return () => clearTimeout(wait);
  }, [typed, searched]);

  const onTyped = (value: string) => {
    setTyped(value);
    if (value.trim() !== '') return;
    setSearched('');
    setSearchFailed(false);
  };
  const as = asQuery(viewer.person);
  const openNew = () => {
    setMaking((times) => times + 1);
    setNewOpen(true);
  };
  const newScreen = making > 0 && (
    <EnquiryForm
      key={making}
      open={newOpen}
      viewer={viewer.person}
      start={making === 1 ? newStart : null}
      editing={null}
      locale={locale}
      opener={newOpener}
      onClose={() => setNewOpen(false)}
      onSaved={(made) => {
        keepMade(made);
        setNewOpen(false);
        router.push(enquiryHref(made.id, ['saved=1', as].filter(Boolean).join('&')));
      }}
      onOpenSame={(id) => {
        setNewOpen(false);
        router.push(enquiryHref(id, as));
      }}
    />
  );
  const clearSearch = () => {
    setTyped('');
    setSearched('');
    setSearchFailed(false);
  };
  const row = (enquiry: Enquiry) => {
    const what = whatLine(enquiry, (type) => t(`eventTypes.${type}`), W.noDate, NOW, locale);
    const who = assignedWords(enquiry, W.notAssigned);
    const when = changedWords(enquiry.changedAt, NOW, locale);
    const next = enquiry.tab === 'open' ? nextFor(enquiry) : null;
    const consultation = next == null ? null : relativeWords(next, locale);

    return {
      key: enquiry.id,
      inset: 0,
      row: (
        <Row
          title={enquiry.client}
          line={what}
          below={
            <View style={styles.below}>
              <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
                {wide ? who : `${who} · ${when}`}
              </Text>
              {consultation != null && (
                <View style={styles.next}>
                  <Glyph name="users" size={15} ink={tokens.colorAccentText} weight={2.4} />
                  <Text size={14} weight="semibold" accessible={false} style={styles.accent}>
                    {consultation}
                  </Text>
                </View>
              )}
            </View>
          }
          value={wide ? when : undefined}
          opens
          accessibilityLabel={[enquiry.client, what, who, when, consultation]
            .filter((part) => part != null)
            .join(', ')}
          accessibilityRole="link"
          onPress={() => router.push(enquiryHref(enquiry.id, as))}
          testID={`enquiries.row.${enquiry.id}`}
        />
      ),
    };
  };

  const top = (
    <>
      <BackButton
        label={t('todayScreen.tab.events')}
        onPress={backToEvents}
        testID="enquiries.back"
      />
      <ListTop
        kind={kindOf(shell.layout)}
        title={W.enquiries}
        pill={<OrgPill />}
        bell={<Bell tell={shell.tell} />}
        primary={{
          label: W.newEnquiry,
          onPress: openNew,
          testID: 'enquiries.new',
        }}
        under={refreshing && <Refreshing testID="enquiries.refreshing" />}
      />
    </>
  );

  if (start.loading)
    return (
      <EnquiriesFrame band={null} overlay={newScreen}>
        {top}
        <SearchRow
          offline={false}
          field={
            <SearchField
              typed=""
              off
              label={W.search}
              width={shell.layout === 'portrait' ? 420 : shell.layout === 'landscape' ? 440 : null}
              onTyped={() => undefined}
              onSearch={() => undefined}
              onClear={() => undefined}
              testID="enquiries.search"
            />
          }
          filter={manages && <AssignedToMe on={mine} off onPress={() => undefined} />}
        />
        <SunkTabs />
        <LoadingBlock words={W.loading} height={0} />
      </EnquiriesFrame>
    );

  if (listFailed)
    return (
      <EnquiriesFrame band={null} overlay={newScreen}>
        {top}
        <Failed
          words={W.listFailed}
          onRetry={() => setListFailed(false)}
          testID="enquiries.failed"
        />
      </EnquiriesFrame>
    );

  const tabRows = tabs[tab];

  return (
    <EnquiriesFrame
      band={offline && <OfflineBand onRetry={() => setOffline(false)} />}
      overlay={newScreen}
      refresh={{ refreshing, onRefresh: () => setRefreshing(true) }}
    >
      {top}
      <SearchRow
        offline={offline}
        field={
          <SearchField
            typed={typed}
            off={offline}
            label={W.search}
            width={shell.layout === 'portrait' ? 420 : shell.layout === 'landscape' ? 440 : null}
            onTyped={onTyped}
            onSearch={() => {
              firstPause.current = false;
              setSearched(typed);
            }}
            onClear={clearSearch}
            testID="enquiries.search"
            ref={field}
          />
        }
        filter={
          manages && <AssignedToMe on={mine} off={offline} onPress={() => setMine((was) => !was)} />
        }
      />
      {results != null && !offline ? (
        searchFailed ? (
          <Failed
            words={W.searchFailed}
            onRetry={() => setSearchFailed(false)}
            testID="enquiries.search.failed"
          />
        ) : (
          <EnquiryResults
            results={results}
            typed={searched}
            row={row}
            onClear={() => {
              clearSearch();
              field.current?.focus();
            }}
          />
        )
      ) : (
        <>
          <EnquiryTabs
            tab={tab}
            counts={{ open: tabs.open.length, won: tabs.won.length, lost: tabs.lost.length }}
            onTab={setTab}
          />
          {tabRows.length === 0 ? (
            <EmptyTab tab={tab} onNew={openNew} />
          ) : (
            <RowList items={tabRows.map(row)} />
          )}
        </>
      )}
    </EnquiriesFrame>
  );
}

/** Owners and Admins only: a check beside the field, as a choice in Events' Filter menu is drawn. */
function AssignedToMe({ on, off, onPress }: { on: boolean; off: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.mine, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: off }}
      accessibilityLabel={W.assignedToMe}
      testID="enquiries.mine"
    >
      <View style={[styles.box, on ? styles.boxOn : styles.boxOff, off && styles.boxDisabled]}>
        {on && <Glyph name="tick" size={14} ink={tokens.colorInkOnDark} weight={3} />}
      </View>
      <Text size={15} weight="semibold" style={off ? styles.disabled : undefined}>
        {W.assignedToMe}
      </Text>
    </Pressable>
  );
}

/** Open, Won and Lost as one segment, the lit tab white with a tick, each with its count, as Events' tabs are. */
function EnquiryTabs({
  tab,
  counts,
  onTab,
}: {
  tab: EnquiryTab;
  counts: Record<EnquiryTab, number>;
  onTab: (tab: EnquiryTab) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {ENQUIRY_TABS.map((each) => {
        const on = each === tab;
        const ink = on ? tokens.colorAccentText : tokens.colorInkSecondary;

        return (
          <Pressable
            key={each}
            onPress={() => onTab(each)}
            style={[styles.cell, on && styles.cellOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${W.tabs[each]}, ${counts[each]}`}
            testID={`enquiries.tab.${each}`}
          >
            {on && <Glyph name="tick" size={14} ink={tokens.colorAccent} weight={2.6} />}
            <Text
              size={14.5}
              weight={on ? 'semibold' : 'medium'}
              numberOfLines={1}
              accessible={false}
              style={[{ color: ink }, styles.shrink]}
            >
              {W.tabs[each]}
            </Text>
            <Text
              size={14.5}
              weight={on ? 'semibold' : 'medium'}
              accessible={false}
              style={[{ color: ink }, styles.count]}
            >
              {String(counts[each])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyTab({ tab, onNew }: { tab: EnquiryTab; onNew: () => void }) {
  return (
    <View style={styles.empty} testID={`enquiries.empty.${tab}`}>
      <Text size={18} weight="bold" accessibilityRole="header" style={styles.emptyTitle}>
        {W.empty[tab].title}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.emptyLine]}>
        {W.empty[tab].line}
      </Text>
      {tab === 'open' && (
        <View style={styles.emptyAction}>
          <PrimaryButton label={W.newEnquiry} onPress={onNew} testID="enquiries.empty.new" />
        </View>
      )}
    </View>
  );
}

/** The total, read out as it changes; then each group with its name and count, or what found nothing. Never the empty tab's line, never New enquiry. */
function EnquiryResults({
  results,
  typed,
  row,
  onClear,
}: {
  results: Results;
  typed: string;
  row: (enquiry: Enquiry) => { key: string; inset: number; row: ReactNode };
  onClear: () => void;
}) {
  const words = W.count(results.count);

  useReadOut(words);

  return (
    <View style={styles.results}>
      <View style={styles.countRow}>
        <Text size={16} weight="semibold" style={styles.figures} testID="enquiries.count">
          {words}
        </Text>
      </View>
      {results.count === 0 ? (
        <View style={styles.noMatch} testID="enquiries.noMatch">
          <Text size={18} weight="bold" accessibilityRole="header" style={styles.emptyTitle}>
            {W.noMatch}
          </Text>
          <Text size={15} weight="medium" style={[styles.secondary, styles.emptyLine]}>
            {W.searched(typed.trim())}
          </Text>
          <View style={styles.noMatchActions}>
            <ClearSearch onPress={onClear} />
          </View>
        </View>
      ) : (
        <View style={styles.groups}>
          {results.groups.map((group) => (
            <View key={group.tab} testID={`enquiries.group.${group.tab}`}>
              <SectionHead
                title={W.tabs[group.tab]}
                right={<HeadCount text={String(group.enquiries.length)} />}
              />
              <RowList items={group.enquiries.map(row)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ClearSearch({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <TextAction
      label={t('eventsSearch.clearSearch')}
      onPress={onPress}
      testID="enquiries.noMatch.clearSearch"
    />
  );
}

/** As Events' list says it: the broken Notice, then Try again. */
export function Failed({
  words,
  onRetry,
  testID,
}: {
  words: string;
  onRetry: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.failed} accessibilityRole="alert">
      <Notice tone="broken" mark={tokens.marks.broken.glyph} body={words} announce />
      <PrimaryButton label={t('eventsScreen.retry')} onPress={onRetry} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { flexShrink: 1, color: tokens.colorAccentText },
  below: { gap: 2 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disabled: { color: tokens.colorInkTertiary },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  mine: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXs,
  },
  box: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: tokens.colorAccent },
  boxOff: { borderWidth: 2, borderColor: tokens.colorFieldBorder },
  boxDisabled: { borderColor: tokens.colorBorder },
  segment: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 22,
    backgroundColor: tokens.colorInsetBorder,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    height: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 19,
  },
  cellOn: {
    backgroundColor: tokens.colorCard,
    shadowColor: tokens.colorInk,
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  count: { opacity: 0.8, fontVariant: ['tabular-nums'] },
  empty: { gap: tokens.spaceXs, paddingTop: tokens.spaceXxs },
  emptyTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  emptyLine: { lineHeight: 15 * 1.45 },
  emptyAction: { marginTop: tokens.spaceMd, alignItems: 'flex-start' },
  results: { gap: 18 },
  countRow: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  groups: { gap: tokens.spaceMd },
  noMatch: { gap: tokens.spaceXs, paddingTop: tokens.spaceXxs },
  noMatchActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
  failed: { gap: tokens.spaceLg },
});
