import { type RefObject, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import {
  type Access,
  type Course,
  type FigureRow,
  type MenuWorld,
  MW,
  allergenWords,
  courseClose,
  courseFigures,
} from './menuPicksModel.ts';

export function DownloadMark({ ink }: { ink: string }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M12 4v11" />
      <Path d="m7 10 5 5 5-5" />
      <Path d="M5 20h14" />
    </Svg>
  );
}

export function KitchenSheetPill({
  downloading,
  onPress,
}: {
  downloading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={downloading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={downloading ? MW.downloading : MW.kitchenSheet}
      accessibilityState={{ busy: downloading, disabled: downloading }}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      testID="menu.kitchenSheet"
    >
      <DownloadMark ink={downloading ? tokens.colorInkSecondary : tokens.colorAccentText} />
      <Text
        size={15}
        weight="semibold"
        style={downloading ? styles.secondary : styles.accent}
        numberOfLines={1}
      >
        {downloading ? MW.downloading : MW.kitchenSheet}
      </Text>
    </Pressable>
  );
}

export function SheetFailed({ onRetry }: { onRetry: () => void }) {
  useReadOut(MW.downloadFailed);

  return (
    <View style={styles.failed} accessibilityRole="alert" testID="menu.sheetFailed">
      <View style={styles.failedHead}>
        <Glyph name="alert" size={18} ink={tokens.colorBrokenText} weight={2.2} />
        <Text size={15} weight="medium" style={styles.flex}>
          {MW.downloadFailed}
        </Text>
      </View>
      <SecondaryButton label={MW.tryAgain} onPress={onRetry} testID="menu.sheetRetry" />
    </View>
  );
}

export function Card({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      {children}
    </View>
  );
}

export function CardTitle({ words }: { words: string }) {
  return (
    <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
      {words}
    </Text>
  );
}

function CountRow({ row, room }: { row: FigureRow; room: number }) {
  const inset = row.kind !== 'dish';
  const lead = row.kind === 'variant' ? `${MW.variant} ` : row.kind === 'side' ? `${MW.side} ` : '';
  const contains = row.contains.length === 0 ? null : MW.contains(allergenWords(row.contains));
  const said = [`${lead}${row.name}`, contains, `${row.count} of ${room}`]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.row, inset && styles.inset]} accessible accessibilityLabel={said}>
      <View style={styles.flex}>
        <Text size={inset ? 15 : 17} weight={inset ? 'regular' : 'semibold'}>
          {`${lead}${row.name}`}
        </Text>
        {contains != null && (
          <Text size={15} style={styles.secondary}>
            {contains}
          </Text>
        )}
      </View>
      <Text size={inset ? 15 : 17} weight="semibold" style={styles.count}>
        {row.count}
      </Text>
    </View>
  );
}

function StateRow({ words, count, mark }: { words: string; count: number; mark?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${words}, ${count}`}>
      <View style={[styles.flex, styles.markLine]}>
        {mark === true && <Glyph name="alert" size={16} ink={tokens.colorAttentionText} />}
        <Text size={15} style={styles.secondary}>
          {words}
        </Text>
      </View>
      <Text size={15} weight="semibold" style={styles.count}>
        {count}
      </Text>
    </View>
  );
}

export function CourseCard({ world, course }: { world: MenuWorld; course: Course }) {
  const figures = courseFigures(world, course);
  const room = world.people.length;
  const close = courseClose(world, course);

  return (
    <Card testID={`menu.course.${course.id}`}>
      <CardTitle words={course.name} />
      <Text size={15} style={styles.secondary}>
        {MW.answered(figures.answered, room)}
      </Text>
      <View style={styles.markLine} testID={`menu.course.${course.id}.close`}>
        <Glyph
          name={close.closed ? 'lock' : 'clock'}
          size={16}
          ink={close.closed ? tokens.colorInk : tokens.colorInkSecondary}
        />
        <Text size={15} style={close.closed ? styles.ink : styles.secondary}>
          {close.words}
        </Text>
      </View>
      <View style={styles.rows}>
        {figures.rows.map((row) => (
          <CountRow key={row.id} row={row} room={room} />
        ))}
        {figures.kitchen > 0 && <StateRow words={MW.kitchen} count={figures.kitchen} />}
        {figures.skipped > 0 && <StateRow words={MW.skipped} count={figures.skipped} />}
        {figures.host > 0 && <StateRow words={MW.hostRow} count={figures.host} mark />}
        {figures.changed > 0 && <StateRow words={MW.changed} count={figures.changed} mark />}
        <StateRow words={MW.none} count={figures.none} />
      </View>
    </Card>
  );
}

export function ChooseButton({
  name,
  access,
  onPress,
  testID,
}: {
  name: string;
  access: Access;
  onPress: (from: ViewInstance | null) => void;
  testID: string;
}) {
  const ref = useRef<ViewInstance>(null);
  if (access !== 'manage') return null;

  return (
    <View style={styles.choose}>
      <SecondaryButton
        ref={ref}
        label={MW.chooseFor}
        accessibilityLabel={MW.chooseForLabel(name)}
        onPress={() => onPress(ref.current)}
        testID={testID}
      />
    </View>
  );
}

export function Choice({
  on,
  title,
  lines,
  allergy,
  onPress,
  testID,
}: {
  on: boolean;
  title: string;
  lines: readonly string[];
  allergy: string | null;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={[title, allergy == null ? null : MW.allergyMark, ...lines, allergy]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
      testID={testID}
    >
      <RadioMark on={on} />
      <View style={styles.flex}>
        <View style={styles.choiceHead}>
          <Text size={17} weight="semibold" style={styles.flex}>
            {title}
          </Text>
          {allergy != null && (
            <View style={styles.allergy}>
              <Glyph name="alert" size={14} ink={tokens.colorAttentionText} />
              <Text size={13} weight="semibold" style={styles.attention}>
                {MW.allergyMark}
              </Text>
            </View>
          )}
        </View>
        {lines.map((line) => (
          <Text key={line} size={15} style={styles.secondary}>
            {line}
          </Text>
        ))}
        {allergy != null && (
          <Text size={15} style={styles.attention}>
            {allergy}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function OverrideAlert({
  title,
  body,
  onAnother,
  onAnyway,
}: {
  title: string;
  body: string;
  onAnother: () => void;
  onAnyway: () => void;
}) {
  const another = useRef<ViewInstance>(null);

  useEffect(() => {
    const focus = setTimeout(() => moveScreenReaderFocus(another.current), 300);
    return () => clearTimeout(focus);
  }, []);

  return (
    <Modal visible={useModalOpen(true)} transparent animationType="fade" onRequestClose={onAnother}>
      <View style={styles.scrim}>
        <View
          style={styles.alert}
          accessibilityViewIsModal
          accessibilityRole="alert"
          onAccessibilityEscape={onAnother}
          testID="menu.override"
        >
          <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
            {title}
          </Text>
          <Text size={15} style={styles.secondary}>
            {body}
          </Text>
          <View style={styles.alertActions}>
            <PrimaryButton
              ref={another}
              label={MW.chooseAnother}
              onPress={onAnother}
              testID="menu.override.another"
            />
            <SecondaryButton
              label={MW.pickAnyway}
              onPress={onAnyway}
              testID="menu.override.anyway"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function useFocusOnMount(target: RefObject<ViewInstance | null>, wanted: boolean): void {
  useEffect(() => {
    if (!wanted) return;
    const focus = setTimeout(() => moveScreenReaderFocus(target.current), 300);
    return () => clearTimeout(focus);
  }, [target, wanted]);
}

export const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  attention: { color: tokens.colorAttentionText },
  pressed: { opacity: tokens.opacityPressed },
  pill: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorAccentTint,
  },
  failed: {
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBroken,
    backgroundColor: tokens.colorCard,
  },
  failedHead: { flexDirection: 'row', gap: tokens.spaceSm, alignItems: 'flex-start' },
  card: {
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  rows: { marginTop: tokens.spaceSm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  inset: { paddingLeft: tokens.spaceLg },
  count: { minWidth: 32, textAlign: 'right' },
  markLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  choose: { marginTop: tokens.spaceXs, alignItems: 'flex-start' },
  choice: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    alignItems: 'flex-start',
    minHeight: tokens.sizeHit,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
  },
  choiceOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorRowSelected },
  choiceHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  allergy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAttentionTint,
  },
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spaceXl,
    backgroundColor: tokens.scrimDialog,
  },
  alert: {
    width: '100%',
    maxWidth: 420,
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusSheet,
    backgroundColor: tokens.colorCard,
  },
  alertActions: { gap: tokens.spaceSm, marginTop: tokens.spaceSm },
});
