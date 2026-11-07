import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SearchField } from '../events/EventsList.tsx';
import {
  type Anchor,
  AnchoredMenu,
  FailedBlock,
  Row,
  RowList,
  TextAction,
  anchorUnder,
} from '../../components/Summary.tsx';
import {
  type Counts,
  FILTERS,
  type FilterKey,
  GROUPS,
  type GroupKey,
  type Person,
  filterCount,
  filterWord,
  showAllWords,
} from './GuestsModel.ts';
import { GroupHead, type Layout, ShownLine } from './GuestsParts.tsx';
import { KOFI_WALKIN } from './GuestsSample.ts';
import { REPLY_WORD, W, say } from './GuestsWords.ts';
import { MarkSlot } from './ReplyMark.tsx';

const MENU_AFTER_MS = 700;

/** The filter beside Find a guest: "All · 156", and the house menu under it with each choice counted. */
function FilterChoice({
  filter,
  counts,
  start,
  off,
  onChoose,
}: {
  filter: FilterKey;
  counts: Counts;
  start: boolean;
  off: boolean;
  onChoose: (key: FilterKey) => void;
}) {
  const trigger = useRef<ViewInstance>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  const word = filterWord(filter);
  const count = filterCount(filter, counts);

  useEffect(() => {
    if (!start) return;
    const wait = setTimeout(() => anchorUnder(trigger, setAt), MENU_AFTER_MS);
    return () => clearTimeout(wait);
  }, [start]);

  return (
    <>
      <TextAction
        ref={trigger}
        label={say.menuItem(word, count)}
        after="down"
        figures
        off={off}
        onPress={() => anchorUnder(trigger, setAt)}
        accessibilityLabel={say.filterLabel(word, count)}
        testID="guests.filter"
      />
      <AnchoredMenu
        at={at}
        onClose={() => setAt(null)}
        opener={trigger}
        width={230}
        testID="guests.filter.menu"
      >
        {FILTERS.map((key) => {
          const on = key === filter;
          const n = filterCount(key, counts);
          return (
            <Pressable
              key={key}
              onPress={() => {
                setAt(null);
                onChoose(key);
              }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${filterWord(key)}, ${n}`}
              testID={`guests.filter.${key}`}
            >
              <View style={styles.menuTick}>
                {on && <Glyph name="tick" size={16} ink={tokens.colorAccentText} weight={2.6} />}
              </View>
              <Text
                size={16}
                weight={on ? 'semibold' : 'medium'}
                accessible={false}
                style={[styles.grow, on && styles.accent]}
              >
                {filterWord(key)}
              </Text>
              <Text
                size={15}
                weight="medium"
                accessible={false}
                style={[styles.secondary, styles.figures]}
              >
                {String(n)}
              </Text>
            </Pressable>
          );
        })}
      </AnchoredMenu>
    </>
  );
}

function personRow(
  p: Person,
  onOpen: (guest: string, from: string) => void,
  refFor: (key: string) => Ref<ViewInstance>,
  lit: string | null,
  wide: boolean,
) {
  const selected = lit === p.key;
  const row = (
    <Row
      ref={refFor(p.key)}
      title={p.name}
      line={p.line}
      lead={<MarkSlot kind={p.kind} />}
      opens
      selected={selected}
      gutter={wide ? 10 : 0}
      pad={p.companion ? 8 : 11}
      onPress={() => onOpen(p.guest, p.key)}
      accessibilityLabel={[p.name, p.line].join('. ')}
      testID={`guests.row.${p.key}`}
    />
  );
  return {
    key: p.key,
    inset: p.companion ? 80 : 40,
    selected,
    row: p.companion ? <View style={styles.indent}>{row}</View> : row,
  };
}

export interface ListProps {
  layout: Layout;
  counts: Counts;
  total: number;
  filter: FilterKey;
  onFilter: (key: FilterKey) => void;
  typed: string;
  onTyped: (typed: string) => void;
  searched: string;
  onSearch: () => void;
  menu: boolean;
  offline: boolean;
  rows: Person[];
  groups: Partial<Record<GroupKey, Person[]>>;
  walkIn: boolean;
  lit: string | null;
  onOpen: (guest: string, from: string) => void;
  refFor: (key: string) => Ref<ViewInstance>;
  fieldRef: RefObject<TextInputInstance | null>;
}

/** Find a guest and the filter as one row, then the groups by reply, or the rows a filter or search leaves. */
export function GuestsRows({
  layout,
  counts,
  total,
  filter,
  onFilter,
  typed,
  onTyped,
  searched,
  onSearch,
  menu,
  offline,
  rows,
  groups,
  walkIn,
  lit,
  onOpen,
  refFor,
  fieldRef,
}: ListProps) {
  const looking = filter !== 'all' || searched.trim() !== '';
  const wide = layout === 'landscape';
  const clear = () => {
    onTyped('');
    onFilter('all');
  };

  return (
    <>
      <View style={styles.searchRow}>
        <SearchField
          typed={typed}
          off={false}
          width={null}
          onTyped={onTyped}
          onSearch={onSearch}
          onClear={() => onTyped('')}
          label={W.findGuest}
          testID="guests.search"
          ref={fieldRef}
        />
        <FilterChoice
          filter={filter}
          counts={{ ...counts, list: total }}
          start={menu}
          off={false}
          onChoose={onFilter}
        />
      </View>
      {offline && null}
      {looking ? (
        <View>
          <ShownLine
            shown={
              rows.length === 0
                ? 0
                : searched.trim() === ''
                  ? filterCount(filter, counts)
                  : rows.length
            }
            total={total}
            onClear={clear}
          />
          {rows.length === 0 ? (
            <NoMatch onClear={clear} />
          ) : (
            <View style={wide && styles.reach}>
              <RowList
                items={rows.map((p) => personRow(p, onOpen, refFor, lit, wide))}
                gutter={wide ? 10 : 0}
              />
            </View>
          )}
        </View>
      ) : (
        <>
          {GROUPS.map((group) => {
            const shown = groups[group];
            const count = counts[group];
            if (shown == null || count === 0) return null;
            return (
              <View key={group} testID={`guests.group.${group}`}>
                <GroupHead word={REPLY_WORD[group]} count={count} />
                <View style={wide && styles.reach}>
                  <RowList
                    items={shown.map((p) => personRow(p, onOpen, refFor, lit, wide))}
                    gutter={wide ? 10 : 0}
                  />
                </View>
                {count >
                  shown.filter((p) => !p.companion).length +
                    shown.filter((p) => p.companion).length && (
                  <TextAction
                    label={showAllWords(group, count)}
                    figures
                    onPress={() => onFilter(group)}
                    testID={`guests.showAll.${group}`}
                  />
                )}
              </View>
            );
          })}
          {walkIn && (
            <View testID="guests.group.walkin">
              <GroupHead word={W.walkIn} count={1} />
              <Row
                title={KOFI_WALKIN}
                line={say.walkInArrived('18:20')}
                lead={<MarkSlot kind="walkin" />}
              />
            </View>
          )}
        </>
      )}
    </>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  useReadOut(W.noMatch);

  return (
    <View style={styles.noMatch} testID="guests.noMatch">
      <Text size={18} weight="bold" accessibilityRole="header" style={styles.noMatchTitle}>
        {W.noMatch}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {W.noMatchLine}
      </Text>
      <TextAction label={W.clear} onPress={onClear} testID="guests.noMatch.clear" />
    </View>
  );
}

/** Loading keeps the title: the card, the field and five rows in Sunk, and "Loading…" for screen readers. */
export function GuestsLoading({ cardHeight }: { cardHeight: number }) {
  useReadOut(W.loading);

  return (
    <View style={styles.loading} accessible accessibilityLabel={W.loading} testID="guests.loading">
      <View style={[styles.sunkCard, { height: cardHeight }]} />
      <View style={styles.sunkField} />
      <View>
        {['58%', '46%', '64%', '50%', '54%'].map((first, index) => (
          <View key={first}>
            {index > 0 && <View style={styles.sunkRule} />}
            <View style={styles.sunkRow}>
              <View style={styles.sunkDisc} />
              <View style={styles.bars}>
                <View style={[styles.barThick, { width: first as `${number}%` }]} />
                <View
                  style={[
                    styles.barThin,
                    {
                      width: (['38%', '52%', '34%', '44%', '40%'][index] ?? '40%') as `${number}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function GuestsFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityRole="alert">
      <FailedBlock
        title={W.loadFailed}
        line={W.loadFailedLine}
        onRetry={onRetry}
        testID="guests.failed.retry"
      />
    </View>
  );
}

export type { ScreenReaderTarget };

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  lines: { lineHeight: 15 * 1.45 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  indent: { paddingLeft: 40 },
  reach: { marginHorizontal: -10 },
  menuRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
  },
  menuPressed: { backgroundColor: tokens.colorInset },
  menuTick: { width: 18, alignItems: 'center' },
  noMatch: { gap: 6, paddingTop: tokens.spaceXs },
  noMatchTitle: { lineHeight: 18 * 1.3 },
  loading: { gap: 18 },
  sunkCard: { borderRadius: 26, backgroundColor: tokens.colorNeutralFill },
  sunkField: { height: 48, borderRadius: 14, backgroundColor: tokens.colorNeutralFill },
  sunkRule: { height: 1, marginLeft: 40, backgroundColor: tokens.colorBorder },
  sunkRow: { height: 64, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  sunkDisc: {
    width: 22,
    height: 22,
    marginHorizontal: 3,
    borderRadius: 11,
    backgroundColor: tokens.colorNeutralFill,
  },
  bars: { flex: 1, gap: tokens.spaceSm },
  barThick: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  barThin: { height: 12, borderRadius: 6, backgroundColor: tokens.colorNeutralFill },
});
