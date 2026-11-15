import type { SearchReach } from '@soirely/api-client';
import {
  SEARCH_LEAST,
  type SearchGroup,
  type SearchRow,
  type SearchStanding,
  searchFieldKeys,
  searchGroups,
  searchTotal,
  serverClock,
} from '@soirely/domain';
import { type Href, router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { eventsSearchHref, searchRowHref } from '../kit/searchLinks.ts';
import { meshFor } from '../kit/today.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { EventThumb } from './EventThumb.tsx';
import { SearchField } from './EventsSearch.tsx';
import { Initials } from './Initials.tsx';
import { useKeyboardTop } from './keyboardWatch.ts';
import { useReadOut } from './ReadOut.tsx';
import { RowShapes, TextAction } from './Summary.tsx';
import { Tag } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

/** How long typing rests before the term is searched for. */
export const TYPING_PAUSE_MS = 250;

const PANEL_WIDTH = 600;
const PANEL_TOP = 64;
const ROW = 64;
const NO_REACH: SearchReach = { events: false, guests: false, members: false };

type Answer =
  | { kind: 'idle' }
  | { kind: 'short' }
  | { kind: 'loading' }
  | { kind: 'found'; term: string; groups: SearchGroup[] }
  | { kind: 'offline' };

function close(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Search (sc-39534) as its demo draws it: on a phone a screen of its own, the field on top and Cancel beside it; on a tablet a palette over the page. */
export function SearchScreen({ organisationId }: { organisationId: string }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const field = useRef<TextInputInstance>(null);
  const [reach, setReach] = useState<SearchReach | null>(null);
  const [typed, setTyped] = useState('');
  const [asked, setAsked] = useState({ term: '', round: 0 });
  const [answer, setAnswer] = useState<Answer>({ kind: 'idle' });
  const keys = searchFieldKeys(reach ?? NO_REACH);
  const groups = answer.kind === 'found' ? answer.groups : [];

  useEffect(() => {
    const wait = setTimeout(() => field.current?.focus(), 0);

    return () => clearTimeout(wait);
  }, []);

  useEffect(() => {
    let current = true;

    api.searchReach(organisationId).then(
      (found) => current && setReach(found),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [organisationId]);

  useEffect(() => {
    const term = typed.trim();
    const stop = new AbortController();
    const wait = setTimeout(
      () => {
        if (term === '') return setAnswer({ kind: 'idle' });
        if (term.length < SEARCH_LEAST) return setAnswer({ kind: 'short' });

        setAnswer({ kind: 'loading' });
        api.search(organisationId, term, stop.signal).then(
          (found) =>
            setAnswer({
              kind: 'found',
              term,
              groups: searchGroups(
                found,
                (key, values) => t(key, values ?? {}),
                serverClock.now(),
                dateLocale(),
              ),
            }),
          () => {
            if (!stop.signal.aborted) setAnswer({ kind: 'offline' });
          },
        );
      },
      asked.round > 0 && asked.term === typed ? 0 : TYPING_PAUSE_MS,
    );

    return () => {
      clearTimeout(wait);
      stop.abort();
    };
  }, [organisationId, typed, asked, t]);

  useReadOut(
    answer.kind === 'loading'
      ? t('search.searching')
      : answer.kind === 'found'
        ? groups.length === 0
          ? t('search.nothing', { term: answer.term })
          : t('search.matches', { count: searchTotal(groups) })
        : null,
    { afterTyping: typed },
  );

  function open(href: string): void {
    if (!phone) close();
    router.push(href as Href);
  }

  function clear(): void {
    setTyped('');
    setAnswer({ kind: 'idle' });
    field.current?.focus();
  }

  const searchField = (
    <SearchField
      ref={field}
      typed={typed}
      off={false}
      width={null}
      label={t(keys.placeholder)}
      onTyped={setTyped}
      onSearch={() => setAsked((was) => ({ term: typed, round: was.round + 1 }))}
      onClear={clear}
      testID="search.field"
    />
  );
  const results = (
    <Results
      answer={answer}
      hint={keys.hint == null ? null : t(keys.hint)}
      onShowAll={() => answer.kind === 'found' && open(eventsSearchHref(answer.term))}
      onRow={(row) => open(searchRowHref(row))}
      onClear={clear}
    />
  );

  return phone ? (
    <PhoneSearch field={searchField}>{results}</PhoneSearch>
  ) : (
    <Palette field={searchField}>{results}</Palette>
  );
}

function PhoneSearch({ field, children }: { field: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.phone, { paddingTop: insets.top + tokens.spaceSm }]}>
      <View style={styles.top}>
        {field}
        <Pressable
          onPress={close}
          hitSlop={tokens.spaceXxs}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('search.cancel')}
          testID="search.cancel"
        >
          <Text size={16} weight="semibold" style={styles.accent}>
            {t('search.cancel')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + tokens.spaceXl }]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function Palette({ field, children }: { field: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const keys = useKeyboardTop();
  const panelWidth = Math.min(PANEL_WIDTH, width - 2 * tokens.spaceXl);
  const floor = (keys ?? height) - tokens.spaceXl;

  return (
    <View style={styles.fill}>
      <Pressable
        onPress={close}
        style={[StyleSheet.absoluteFill, styles.scrim]}
        accessibilityRole="button"
        accessibilityLabel={t('search.close')}
        testID="search.scrim"
      />
      <View
        style={[
          styles.panel,
          { width: panelWidth, left: (width - panelWidth) / 2, maxHeight: floor - PANEL_TOP },
        ]}
        accessibilityViewIsModal
        onAccessibilityEscape={close}
      >
        <View style={styles.panelTop}>{field}</View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

function Results({
  answer,
  hint,
  onShowAll,
  onRow,
  onClear,
}: {
  answer: Answer;
  hint: string | null;
  onShowAll: () => void;
  onRow: (row: SearchRow) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  if (answer.kind === 'idle') return hint == null ? null : <Said words={hint} />;
  if (answer.kind === 'short') return <Said words={t('search.short')} />;
  if (answer.kind === 'loading') return <RowShapes count={3} words={t('search.searching')} />;
  if (answer.kind === 'offline')
    return (
      <View style={styles.said}>
        <Text size={16} weight="semibold">
          {t('eventsSearch.searchOff')}
        </Text>
      </View>
    );
  if (answer.groups.length === 0)
    return (
      <View style={styles.said}>
        <Text size={16} weight="semibold">
          {t('search.nothing', { term: answer.term })}
        </Text>
        <TextAction label={t('search.clear')} onPress={onClear} testID="search.clear" />
      </View>
    );

  return answer.groups.map((group) => {
    const heading = t(`search.heading.${group.key}`);

    return (
      <View key={group.key} style={styles.group}>
        <Text
          size={13}
          weight="semibold"
          accessibilityRole="header"
          accessibilityLabel={t('search.headingCount', { heading, count: group.total })}
          style={styles.secondary}
        >
          {`${heading} ${group.total}`}
        </Text>
        {group.rows.map((row) => (
          <Found key={row.id} row={row} onPress={() => onRow(row)} />
        ))}
        {group.more && (
          <TextAction
            label={t('search.showAll')}
            onPress={onShowAll}
            testID={`search.more.${group.key}`}
          />
        )}
      </View>
    );
  });
}

function Said({ words }: { words: string }) {
  return (
    <View style={styles.said}>
      <Text size={15} style={styles.secondary}>
        {words}
      </Text>
    </View>
  );
}

const STANDING_MARKS: Record<SearchStanding, 'waiting' | 'paused'> = {
  invited: 'waiting',
  pending_approval: 'waiting',
  suspended: 'paused',
};

function Found({ row, onPress }: { row: SearchRow; onPress: () => void }) {
  const { t } = useTranslation();
  const standing = row.kind === 'member' && row.standing != null ? row.standing : null;
  const said = standing == null ? null : t(`search.standing.${standing}`);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={[row.name, row.line, said].filter(Boolean).join(', ')}
      testID={`search.row.${row.id}`}
    >
      {row.kind === 'event' ? (
        <EventThumb
          event={{ id: row.id, mesh: meshFor(row.id), photo: null }}
          side={40}
          radius={10}
        />
      ) : (
        <View
          style={styles.face}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Initials name={row.name} size={14} weight="semibold" />
        </View>
      )}
      <View style={styles.words}>
        <Text size={16} weight="semibold" numberOfLines={1}>
          {row.name}
        </Text>
        <Text size={14} numberOfLines={1} style={styles.secondary}>
          {row.line}
        </Text>
      </View>
      {standing != null && said != null && <Tag kind={STANDING_MARKS[standing]} word={said} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  phone: { flex: 1, backgroundColor: tokens.colorCard },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  cancel: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXs,
  },
  pressed: { opacity: 0.6 },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  body: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceSm },
  scrim: { backgroundColor: tokens.scrimDialog },
  panel: {
    position: 'absolute',
    top: PANEL_TOP,
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
    borderRadius: tokens.radiusCardLarge,
    shadowColor: tokens.colorInk,
    shadowOpacity: 0.2,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  panelTop: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  said: { gap: tokens.spaceXs, paddingVertical: tokens.spaceLg, alignItems: 'flex-start' },
  group: { paddingTop: tokens.spaceMd },
  row: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
  rowPressed: { backgroundColor: tokens.colorNeutralFill },
  face: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
});
