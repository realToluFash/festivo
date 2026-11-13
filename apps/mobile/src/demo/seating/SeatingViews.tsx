import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';

import { Pill } from '../../components/SettingsParts.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { TextAction, TurningMark } from '../../components/SummaryRows.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { Action } from './SeatingActs.ts';
import { extent, free } from './SeatingGeometry.ts';
import {
  DOCS,
  type Doc,
  type ListTab,
  type Seating,
  accName,
  chairWord,
  hexOf,
  listed,
  seatedWords,
  ofWords,
  partyOf,
  partySize,
  sectionName,
  sectionOf,
  shapeWord,
} from './SeatingModel.ts';
import {
  Notice,
  SeatIcon,
  Segments,
  ShapeTile,
  SheetTitle,
  StateMark,
  Swatch,
} from './SeatingParts.tsx';
import { RoomDrawing } from './SeatingRoom.tsx';
import type { Item } from './SeatingSample.ts';
import { W, say } from './SeatingWords.ts';

type Go = (action: Action) => void;

function sectionOrder(m: Seating, it: Item): number {
  const i = m.sections.findIndex((s) => s.key === it.sec);
  return i < 0 ? m.sections.length : i;
}

/** The Tables view (sc-4013): a card per table by section then name, each its chairs in order, not to scale; a tap chooses or seats. */
export function TablesView({ m, go, top }: { m: Seating; go: Go; top: number }) {
  const its = m.items
    .filter((it) => m.tableFilter == null || it.sec === m.tableFilter)
    .sort(
      (a, b) =>
        sectionOrder(m, a) - sectionOrder(m, b) ||
        a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  return (
    <ScrollView contentContainerStyle={[styles.views, { paddingTop: top }]}>
      <View style={styles.chips}>
        <SectionChip
          label={W.allSections}
          on={m.tableFilter == null}
          onPress={() => go({ type: 'tableFilter', key: null })}
        />
        {m.sections.map((s) => (
          <SectionChip
            key={s.key}
            label={s.name}
            hex={hexOf(s.colour)}
            on={m.tableFilter === s.key}
            onPress={() => go({ type: 'tableFilter', key: s.key })}
          />
        ))}
      </View>
      <View style={styles.cards}>
        {its.map((it) => (
          <TableCard
            key={it.id}
            m={m}
            it={it}
            lit={m.lit.includes(it.id) || m.chosen === it.id}
            onPress={() => go({ type: 'tapItem', id: it.id })}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function SectionChip({
  label,
  hex,
  on,
  onPress,
}: {
  label: string;
  hex?: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      testID={`seating.tables.${label}`}
    >
      {hex != null && <Swatch hex={hex} side={12} />}
      <Text size={13} weight="semibold" accessible={false} style={on ? styles.onDark : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

function TableCard({
  m,
  it,
  lit,
  onPress,
}: {
  m: Seating;
  it: Item;
  lit: boolean;
  onPress: () => void;
}) {
  const e = extent(it);
  const w = 188;
  const h = 132;
  const s = Math.min((w - 16) / (2 * e.x), 120 / (2 * e.y), 0.45);
  const sec = sectionOf(m, it.sec);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, lit && styles.cardLit, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: lit }}
      accessibilityLabel={accName(m, it)}
      testID={`seating.card.${it.id}`}
    >
      <View style={styles.cardHead}>
        <Text size={16} weight="bold" accessible={false} style={styles.grow}>
          {it.name}
        </Text>
        <Text size={14} weight="semibold" accessible={false} style={styles.figures}>
          {ofWords(it)}
        </Text>
      </View>
      <View style={styles.cardSection}>
        <Swatch hex={sec == null ? null : hexOf(sec.colour)} side={12} />
        <Text size={13} weight="semibold" accessible={false}>
          {sectionName(m, it)}
        </Text>
      </View>
      <View style={{ width: w, height: h }}>
        <RoomDrawing
          m={{ ...m, wallAt: null }}
          v={{ s, ox: w / 2 - it.x * s, oy: h / 2 - it.y * s }}
          width={w}
          height={h}
          items={[{ ...it, name: '' }]}
          looks={{}}
          grid={false}
          floor={false}
        />
      </View>
    </Pressable>
  );
}

const LIST_TABS: readonly ListTab[] = ['With space', 'Full', 'All'];

/** sc-4016's List: With space, Full and All with counts; every fact the room shows as text, a row opening to its chairs. */
export function ListView({ m, go, top }: { m: Seating; go: Go; top: number }) {
  const party = partyOf(m, m.picked);
  return (
    <ScrollView contentContainerStyle={[styles.views, styles.list, { paddingTop: top }]}>
      <View style={styles.listTabs}>
        <Segments
          items={LIST_TABS.map((tab) => ({
            key: tab,
            label: say.tab(tab, listed(m.items, tab).length),
          }))}
          on={m.listTab}
          onPick={(tab) => go({ type: 'listTab', tab })}
          testID="seating.listTab"
        />
      </View>
      <View style={styles.header}>
        {[W.name, W.section, W.seats, W.seated].map((word, i) => (
          <Text
            key={word}
            size={12.5}
            weight="semibold"
            style={[styles.secondary, { flex: COLUMN[i] }]}
          >
            {word}
          </Text>
        ))}
      </View>
      {listed(m.items, m.listTab).map((it) => {
        const open = m.listOpen === it.id;
        return (
          <View key={it.id}>
            <View style={[styles.listRow, open && styles.rowOpen]}>
              <Pressable
                onPress={() => go({ type: 'listOpen', id: it.id })}
                style={styles.listMain}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={[accName(m, it), seatedWords(it)].filter(Boolean).join('. ')}
                testID={`seating.list.${it.id}`}
              >
                <View style={[styles.nameCell, { flex: COLUMN[0] }]}>
                  <ShapeTile
                    kind={it.kind}
                    hex={
                      sectionOf(m, it.sec) == null
                        ? null
                        : hexOf(sectionOf(m, it.sec)?.colour ?? 'Blue')
                    }
                    side={32}
                  />
                  <View style={styles.grow}>
                    <Text size={15} weight="semibold" accessible={false}>
                      {it.name}
                    </Text>
                    <Text size={12.5} weight="medium" accessible={false} style={styles.secondary}>
                      {shapeWord(it)}
                    </Text>
                  </View>
                </View>
                <Text size={14} weight="medium" accessible={false} style={{ flex: COLUMN[1] }}>
                  {sectionName(m, it)}
                </Text>
                <Text
                  size={14.5}
                  weight="semibold"
                  accessible={false}
                  style={[styles.figures, { flex: COLUMN[2] }]}
                >
                  {ofWords(it)}
                </Text>
                <Text
                  size={14}
                  weight="medium"
                  accessible={false}
                  style={[styles.secondary, { flex: COLUMN[3] }]}
                >
                  {seatedWords(it)}
                </Text>
              </Pressable>
              {party != null && free(it) >= partySize(party) && (
                <Pill
                  label={W.seatHere}
                  full={false}
                  height={tokens.sizeHit}
                  onPress={() => go({ type: 'seatAt', id: it.id })}
                  testID={`seating.list.seatHere.${it.id}`}
                />
              )}
            </View>
            {open &&
              it.chairs.map((chair, i) => (
                <View key={i} style={styles.chairRow}>
                  <StateMark state={chair.state} side={20} />
                  <Text size={14} weight="semibold" style={[styles.secondary, styles.seatNo]}>
                    {say.seatNumber(i + 1)}
                  </Text>
                  <Text size={14.5} weight="semibold" style={styles.grow}>
                    {chairWord(it, i)}
                  </Text>
                  {party != null && chair.state === 'empty' && (
                    <Pill
                      label={W.seatHere}
                      full={false}
                      height={tokens.sizeHit}
                      onPress={() => go({ type: 'seatAt', id: it.id, chair: i })}
                      testID={`seating.chair.seatHere.${i}`}
                    />
                  )}
                </View>
              ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const COLUMN = [1.4, 1, 0.7, 2] as const;

/** Print (sc-4024, sc-5032): Paper size, then each document; it is made on the server and opens in the share sheet. */
export function PrintSheet({ m, go }: { m: Seating; go: Go }) {
  const opener = useRef<ViewInstance>(null);
  const close = () => go({ type: 'sheet', sheet: null });
  const lines: Record<Doc, string> = {
    'Table lists': W.tableListsLine,
    'Table cards': W.tableCardsLine,
    'Floor plan': W.floorPlanLine,
  };
  return (
    <Sheet
      open={m.sheet?.kind === 'print'}
      onClose={close}
      scrimLabel={W.close}
      opener={opener}
      testID="seating.print"
    >
      <View style={styles.print}>
        <SheetTitle title={W.print} onClose={close} />
        {m.offline && <Notice words={W.printOffline} tone="note" />}
        {m.readOnly && (
          <Text size={14} weight="medium" style={styles.secondary}>
            {W.readOnly}
          </Text>
        )}
        <Text size={13.5} weight="semibold">
          {W.paperSize}
        </Text>
        <View style={styles.paper} accessibilityRole="radiogroup">
          {(['A4', 'Letter'] as const).map((paper) => (
            <Pressable
              key={paper}
              onPress={() => go({ type: 'paper', paper })}
              style={styles.radio}
              accessibilityRole="radio"
              accessibilityState={{ checked: m.paper === paper }}
              accessibilityLabel={paper}
              testID={`seating.paper.${paper}`}
            >
              <RadioMark on={m.paper === paper} />
              <Text size={15} weight={m.paper === paper ? 'semibold' : 'medium'} accessible={false}>
                {paper}
              </Text>
            </Pressable>
          ))}
        </View>
        {DOCS.map((doc) => (
          <View key={doc} style={styles.doc}>
            <View style={styles.docRow}>
              <View style={styles.grow}>
                <Text size={16} weight="semibold">
                  {doc}
                </Text>
                <Text size={14} weight="medium" style={styles.secondary}>
                  {lines[doc]}
                </Text>
              </View>
              {m.preparing === doc ? (
                <View style={styles.preparing}>
                  <TurningMark side={15} />
                  <Text size={13.5} weight="semibold" style={styles.secondary}>
                    {say.preparing(doc)}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => go({ type: 'printDoc', doc })}
                  disabled={m.offline}
                  style={({ pressed }) => [styles.open, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: m.offline }}
                  accessibilityLabel={`${W.open} ${doc}`}
                  testID={`seating.print.${doc}`}
                >
                  <Text
                    size={14}
                    weight="semibold"
                    accessible={false}
                    style={m.offline ? styles.off : undefined}
                  >
                    {W.open}
                  </Text>
                </Pressable>
              )}
            </View>
            {m.printFailed === doc && (
              <View>
                <Notice words={say.printFailed(doc)} tone="red" />
                <TextAction
                  label={W.tryAgain}
                  onPress={() => go({ type: 'printDoc', doc })}
                  testID="seating.print.tryAgain"
                />
              </View>
            )}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

export function FailedView({ onTry }: { onTry: () => void }) {
  return (
    <View style={styles.failed}>
      <SeatIcon name="cloudoff" size={32} ink={tokens.colorInkSecondary} weight={1.9} />
      <Text size={20} weight="bold" accessibilityRole="header" style={styles.centre}>
        {W.failed}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.centre]}>
        {W.failedLine}
      </Text>
      <Pill
        label={W.tryAgain}
        kind="secondary"
        full={false}
        height={tokens.sizeHit}
        onPress={onTry}
        testID="seating.failed.tryAgain"
      />
    </View>
  );
}

export function OfflinePill({ at }: { at: string }) {
  return (
    <View style={styles.offline}>
      <SeatIcon name="cloudoff" size={16} ink={tokens.colorInkSecondary} />
      <Text size={13.5} weight="semibold">
        {say.offline(at)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  onDark: { color: tokens.colorInkOnDark },
  off: { color: tokens.colorInkTertiary },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  centre: { textAlign: 'center' },
  views: { paddingHorizontal: tokens.spaceXl, paddingBottom: tokens.space6xl, gap: tokens.spaceLg },
  list: { backgroundColor: tokens.colorCard },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  chip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  chipOn: { backgroundColor: tokens.colorInk, borderColor: tokens.colorInk },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceLg },
  card: {
    width: 212,
    padding: tokens.spaceLg,
    gap: tokens.spaceXs,
    borderRadius: tokens.spaceXxl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  cardLit: { backgroundColor: tokens.colorAccentTint },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  cardSection: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  listTabs: { maxWidth: 420 },
  header: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  listRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  rowOpen: {
    backgroundColor: tokens.colorAccentTint,
    borderRadius: tokens.spaceLg,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  listMain: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  chairRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: 42,
    paddingRight: 10,
    marginHorizontal: -10,
    backgroundColor: tokens.colorAccentTint,
  },
  seatNo: { width: 64, fontVariant: ['tabular-nums'] },
  print: {
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  paper: { flexDirection: 'row', gap: tokens.space3xl },
  radio: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  doc: {
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
    paddingVertical: tokens.spaceSm,
    gap: tokens.spaceXxs,
  },
  docRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  open: {
    minHeight: tokens.sizeHit,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: tokens.colorInset,
    justifyContent: 'center',
  },
  failed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.space5xl,
  },
  offline: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 18,
    backgroundColor: tokens.colorNeutralFill,
  },
});
