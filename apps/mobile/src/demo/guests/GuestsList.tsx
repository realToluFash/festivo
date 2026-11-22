import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SearchField } from '../../components/EventsSearch.tsx';
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
  type ListFilter,
  GROUPS,
  type GroupKey,
  type Person,
  filterCount,
  filterWord,
  filtersFor,
  inViewOf,
} from './GuestsModel.ts';
import { GroupHead, type Layout, ShownLine } from './GuestsParts.tsx';
import { REPLY_WORD, W, say } from './GuestsWords.ts';
import { MarkSlot } from '../../components/ReplyMark.tsx';
import { SETTLE_EVERY_MS, SETTLE_TRIES, hasSettled } from './MenuSettles.ts';
import { NW } from './GuestNeeds.ts';
import { AllergyMark } from './GuestNeedsParts.tsx';

const MENU_AFTER_MS = 700;

/** The filter beside Find a guest: "All · 156", and the house menu under it with each choice counted. */
function FilterChoice({
  filter,
  counts,
  changed,
  start,
  off,
  onChoose,
}: {
  filter: ListFilter;
  counts: Counts;
  changed: number;
  start: boolean;
  off: boolean;
  onChoose: (key: ListFilter) => void;
}) {
  const trigger = useRef<ViewInstance>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  const word = filterWord(filter);
  const count = filter === 'changed' ? changed : filterCount(filter, counts);
  const apart = changed > 0 || filter === 'changed';
  const keys: ListFilter[] = [...(apart ? ['changed' as const] : []), ...filtersFor(counts)];

  useEffect(() => {
    if (!start) return;
    let gone = false;
    let tries = 0;
    let before: Anchor | null = null;
    let wait: ReturnType<typeof setTimeout>;
    const measure = () =>
      anchorUnder(trigger, (now) => {
        if (gone) return;
        if (hasSettled(before, now) || (++tries >= SETTLE_TRIES && now.width > 0)) {
          setAt(now);
          return;
        }
        if (tries >= SETTLE_TRIES) return;
        before = now;
        wait = setTimeout(measure, SETTLE_EVERY_MS);
      });
    wait = setTimeout(measure, MENU_AFTER_MS);
    return () => {
      gone = true;
      clearTimeout(wait);
    };
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
        width={apart ? 300 : 230}
        testID="guests.filter.menu"
      >
        {keys.map((key) => {
          const on = key === filter;
          const n = key === 'changed' ? changed : filterCount(key, counts);
          return (
            <Pressable
              key={key}
              onPress={() => {
                setAt(null);
                onChoose(key);
              }}
              style={({ pressed }) => [
                styles.menuRow,
                (key === 'changed' || key === 'invited') && styles.menuApart,
                pressed && styles.menuPressed,
              ]}
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
  const allergy = p.allergy === true;
  const row = (
    <Row
      ref={refFor(p.key)}
      title={p.name}
      line={p.line}
      below={allergy ? <AllergyMark testID={`guests.row.${p.key}.allergy`} /> : undefined}
      lead={<MarkSlot kind={p.kind} />}
      opens
      selected={selected}
      gutter={wide ? 10 : 0}
      pad={p.companion ? 8 : 11}
      onPress={() => onOpen(p.guest, p.key)}
      accessibilityLabel={[p.name, p.line, allergy ? NW.allergy : null]
        .filter((part) => part != null)
        .join('. ')}
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
  filter: ListFilter;
  /** sc-4331: the guests Changed since you looked would list; its menu row shows while above 0 or in use. */
  changed: number;
  onFilter: (key: ListFilter) => void;
  /** sc-4331: choosing Changed since you looked failed; the list stays as it was. */
  changeFailed: boolean;
  onRetryChanged: () => void;
  typed: string;
  onTyped: (typed: string) => void;
  searched: string;
  onSearch: () => void;
  menu: boolean;
  rows: Person[];
  groups: Partial<Record<GroupKey, Person[]>>;
  walkIns: Person[];
  expanded: readonly GroupKey[];
  onShowAll: (group: GroupKey) => void;
  lit: string | null;
  onOpen: (guest: string, from: string) => void;
  refFor: (key: string) => Ref<ViewInstance>;
  fieldRef: RefObject<TextInputInstance | null>;
  /** sc-54450: Paste a reply, in the row on an upright iPad, and under it on a phone and in the list pane. */
  pasteInRow?: ReactNode;
  paste?: ReactNode;
}

/** Find a guest and the filter as one row, the filter under the field when it does not fit beside it (Events' rule), then the groups by reply, or the rows a filter or search leaves. */
export function GuestsRows({
  layout,
  counts,
  total,
  filter,
  changed,
  onFilter,
  changeFailed,
  onRetryChanged,
  typed,
  onTyped,
  searched,
  onSearch,
  menu,
  rows,
  groups,
  walkIns,
  expanded,
  onShowAll,
  lit,
  onOpen,
  refFor,
  fieldRef,
  pasteInRow = null,
  paste = null,
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
          changed={changed}
          start={menu}
          off={false}
          onChoose={onFilter}
        />
        {pasteInRow}
      </View>
      {paste}
      {changeFailed && <ChangedFailed onRetry={onRetryChanged} />}
      {looking ? (
        <View>
          <ShownLine
            shown={inViewOf({
              filter,
              searched,
              rows: rows.length,
              filtered: filter === 'changed' ? rows.length : filterCount(filter, counts),
              total,
            })}
            total={total}
            onClear={clear}
          />
          {filter === 'changed' && changed === 0 ? (
            <NothingChanged onShowAll={clear} />
          ) : rows.length === 0 ? (
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
                {count > shown.length && !expanded.includes(group) && (
                  <TextAction
                    label={say.showAll(count)}
                    figures
                    onPress={() => onShowAll(group)}
                    testID={`guests.showAll.${group}`}
                  />
                )}
              </View>
            );
          })}
          {walkIns.length > 0 && (
            <View testID="guests.group.walkin">
              <GroupHead word={W.walkIn} count={counts.walkin} />
              <View style={wide && styles.reach}>
                <RowList
                  items={walkIns.map((p) => personRow(p, onOpen, refFor, lit, wide))}
                  gutter={wide ? 10 : 0}
                />
              </View>
            </View>
          )}
        </>
      )}
    </>
  );
}

/** sc-4331: choosing Changed since you looked failed: nothing is marked read, and Try again chooses it again. */
function ChangedFailed({ onRetry }: { onRetry: () => void }) {
  useReadOut(W.changedFailed);

  return (
    <View style={styles.changedFailed} accessibilityRole="alert" testID="guests.changedFailed">
      <View style={styles.changedFailedLine}>
        <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.2} />
        <Text size={14} weight="medium" style={styles.grow}>
          {W.changedFailed}
        </Text>
      </View>
      <TextAction
        label={W.tryAgain}
        glyph="refresh"
        onPress={onRetry}
        testID="guests.changedFailed.retry"
      />
    </View>
  );
}

/** sc-4331: nothing changed since the last look, and Show all guests, which does what Clear does. */
function NothingChanged({ onShowAll }: { onShowAll: () => void }) {
  useReadOut(W.nothingChanged);

  return (
    <View style={styles.noMatch} testID="guests.nothingChanged">
      <Text size={18} weight="bold" accessibilityRole="header" style={styles.noMatchTitle}>
        {W.nothingChanged}
      </Text>
      <TextAction label={W.showAllGuests} onPress={onShowAll} testID="guests.nothingChanged.all" />
    </View>
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

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  lines: { lineHeight: 15 * 1.45 },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: tokens.spaceXxs,
  },
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
  menuApart: {
    marginBottom: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  menuTick: { width: 18, alignItems: 'center' },
  noMatch: { gap: 6, paddingTop: tokens.spaceXs },
  changedFailed: { gap: tokens.spaceXs, paddingTop: tokens.spaceXs },
  changedFailedLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
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
