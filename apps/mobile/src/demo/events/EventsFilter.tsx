import { EVENT_TYPES } from '@soirely/domain';
import { type ReactNode, type Ref, type RefObject, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { RadioMark } from '../../components/RadioMark.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { type Anchor, AnchoredMenu } from '../settings/Summary.tsx';
import {
  type Filters,
  NO_FILTERS,
  type When,
  filtered,
  hostsWords,
  typesWords,
  whenWords,
} from './EventsModel.ts';
import { MomentBox, type Picking, PickerLayer, pick } from './EventsPick.tsx';
import { TYPE_WORDS } from './EventsSample.ts';
import { W, say } from './EventsWords.ts';

type Level = 'top' | 'type' | 'when' | 'hosts';

const BETWEEN = { from: '2026-11-14', to: '2026-12-12' };

const WHENS: readonly { kind: When['kind']; word: string }[] = [
  { kind: 'any', word: W.anyTime },
  { kind: 'week', word: W.thisWeek },
  { kind: 'month', word: W.thisMonth },
  { kind: 'next3', word: W.next3Months },
  { kind: 'between', word: W.between },
];

/** Filter beside the search: its mark, what is chosen, and a chevron, in Violet. */
export function FilterButton({
  word,
  off,
  open,
  onPress,
  ref,
}: {
  word: string;
  off: boolean;
  open: boolean;
  onPress: () => void;
  ref: Ref<ViewInstance>;
}) {
  const ink = off ? tokens.colorInkTertiary : tokens.colorAccentText;

  return (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, expanded: open }}
      accessibilityLabel={say.filterLabel(word)}
      testID="events.filter"
    >
      <Glyph name="filter" size={18} ink={ink} weight={2.2} />
      <Text
        size={15}
        weight="semibold"
        numberOfLines={1}
        accessible={false}
        style={[styles.shrink, { color: ink }]}
      >
        {word}
      </Text>
      <Glyph name="down" size={16} ink={ink} weight={2.4} />
    </Pressable>
  );
}

/** The Filter menu, 272 wide: Type, When and Hosted by, each drilling in to its choices. */
export function EventsFilterMenu({
  at,
  onClose,
  opener,
  filters,
  onFilters,
  hosts,
  locale,
}: {
  at: Anchor | null;
  onClose: () => void;
  opener: RefObject<ScreenReaderTarget | null>;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  hosts: readonly string[];
  locale: string;
}) {
  const [level, setLevel] = useState<Level>('top');
  const [picking, setPicking] = useState<Picking | null>(null);
  const close = () => {
    setLevel('top');
    onClose();
  };
  const between = filters.when.kind === 'between' ? filters.when : null;
  const pickDay = (end: 'from' | 'to') => {
    if (between == null) return;
    pick(
      {
        title: end === 'from' ? W.from : W.to,
        mode: 'date',
        field: { date: between[end], time: '12:00' },
        take: ({ date }) => onFilters({ ...filters, when: { ...between, [end]: date } }),
      },
      setPicking,
    );
  };

  return (
    <AnchoredMenu
      at={at}
      onClose={close}
      opener={opener}
      width={272}
      over={
        picking != null && (
          <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
        )
      }
      testID="events.filter.menu"
    >
      {level === 'top' && (
        <>
          <TopRow
            title={W.type}
            value={typesWords(filters.types)}
            onPress={() => setLevel('type')}
            testID="events.filter.type"
          />
          <TopRow
            title={W.when}
            value={whenWords(filters.when, locale)}
            onPress={() => setLevel('when')}
            testID="events.filter.when"
          />
          <TopRow
            title={W.hostedBy}
            value={hostsWords(filters.hosts)}
            onPress={() => setLevel('hosts')}
            testID="events.filter.hosts"
          />
          {filtered(filters) && (
            <>
              <View style={styles.rule} />
              <Pressable
                onPress={() => onFilters(NO_FILTERS)}
                style={({ pressed }) => [styles.top, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={W.clearFilters}
                testID="events.filter.clear"
              >
                <Text size={16} weight="medium" accessible={false} style={styles.on}>
                  {W.clearFilters}
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}
      {level === 'type' && (
        <Drilled title={W.type} onBack={() => setLevel('top')}>
          {EVENT_TYPES.map((type) => (
            <Check
              key={type}
              word={TYPE_WORDS[type]}
              on={filters.types.includes(type)}
              onPress={() =>
                onFilters({ ...filters, types: toggled(filters.types, type, EVENT_TYPES) })
              }
              testID={`events.filter.type.${type}`}
            />
          ))}
        </Drilled>
      )}
      {level === 'when' && (
        <Drilled title={W.when} onBack={() => setLevel('top')}>
          {WHENS.map(({ kind, word }) => (
            <Radio
              key={kind}
              word={word}
              on={filters.when.kind === kind}
              onPress={() =>
                onFilters({
                  ...filters,
                  when: kind === 'between' ? { kind, ...(between ?? BETWEEN) } : { kind },
                })
              }
              testID={`events.filter.when.${kind}`}
            />
          ))}
          {between != null && (
            <View style={styles.between}>
              {(['from', 'to'] as const).map((end) => (
                <View key={end} style={styles.day}>
                  <Text size={13} weight="semibold">
                    {end === 'from' ? W.from : W.to}
                  </Text>
                  <MomentBox
                    label={end === 'from' ? W.from : W.to}
                    mode="date"
                    value={between[end]}
                    locale={locale}
                    year={false}
                    height={tokens.sizeHit}
                    onPress={() => pickDay(end)}
                    testID={`events.filter.${end}`}
                  />
                </View>
              ))}
            </View>
          )}
        </Drilled>
      )}
      {level === 'hosts' && (
        <Drilled title={W.hostedBy} onBack={() => setLevel('top')}>
          {hosts.map((host) => (
            <Check
              key={host}
              word={host}
              on={filters.hosts.includes(host)}
              onPress={() => onFilters({ ...filters, hosts: toggled(filters.hosts, host, hosts) })}
              testID={`events.filter.host.${host}`}
            />
          ))}
        </Drilled>
      )}
    </AnchoredMenu>
  );
}

/** A choice in or out, kept in the order the menu lists them. */
function toggled<T>(chosen: readonly T[], one: T, order: readonly T[]): T[] {
  return chosen.includes(one)
    ? chosen.filter((each) => each !== one)
    : order.filter((each) => each === one || chosen.includes(each));
}

function TopRow({
  title,
  value,
  onPress,
  testID,
}: {
  title: string;
  value: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.top, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}`}
      testID={testID}
    >
      <Text size={16} weight="medium" accessible={false} style={styles.grow}>
        {title}
      </Text>
      <Text
        size={15}
        weight="medium"
        numberOfLines={1}
        accessible={false}
        style={[styles.secondary, styles.value]}
      >
        {value}
      </Text>
      <Glyph name="chevron" size={16} ink={tokens.colorInkTertiary} weight={2.3} />
    </Pressable>
  );
}

function Drilled({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${W.filter}, ${title}. Back`}
        testID="events.filter.back"
      >
        <Glyph name="back" size={18} ink={tokens.colorAccentText} weight={2.4} />
        <Text size={16} weight="bold" accessible={false} accessibilityRole="header">
          {title}
        </Text>
      </Pressable>
      <View style={styles.rule} />
      {children}
    </>
  );
}

function Check({
  word,
  on,
  onPress,
  testID,
}: {
  word: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.rowPressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      testID={testID}
    >
      <View style={[styles.box, on ? styles.boxOn : styles.boxOff]}>
        {on && <Glyph name="tick" size={14} ink={tokens.colorInkOnDark} weight={3} />}
      </View>
      <Text
        size={16}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={[styles.grow, on && styles.on]}
      >
        {word}
      </Text>
    </Pressable>
  );
}

function Radio({
  word,
  on,
  onPress,
  testID,
}: {
  word: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.rowPressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      testID={testID}
    >
      <RadioMark on={on} />
      <Text
        size={16}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={[styles.grow, on && styles.on]}
      >
        {word}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  rowPressed: { backgroundColor: tokens.colorInset },
  button: {
    minHeight: tokens.sizeHitPhonePrimary,
    minWidth: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceXs,
  },
  top: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
  },
  on: { color: tokens.colorAccentText },
  value: { maxWidth: 120 },
  rule: { height: 1, marginVertical: tokens.spaceXs, backgroundColor: tokens.colorBorder },
  back: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
  },
  choice: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
  },
  box: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: tokens.colorAccent },
  boxOff: { borderWidth: 2, borderColor: tokens.colorFieldBorder },
  between: {
    flexDirection: 'row',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spacePillEnd,
    paddingTop: tokens.spaceXxs,
    paddingBottom: tokens.spaceMd,
  },
  day: { flex: 1, gap: 5 },
});
