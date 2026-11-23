import type { EventMenu, PicksCourse, PicksRow } from '@soirely/api-client';
import { menuCourseOf, showsDefaulted } from '@soirely/domain';
import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { dateLocale, useShownLanguage } from '../i18n/index.ts';
import { allergensInSentence, closeDay, defaultLine } from '../kit/menuPicksWords.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { AskLayer } from './AskLayer.tsx';
import { SecondaryButton } from './Buttons.tsx';
import { Glyph } from './Glyph.tsx';
import { RadioMark } from './RadioMark.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

export function useAllergens(): (codes: readonly string[]) => string {
  const { t } = useTranslation();
  const language = useShownLanguage();

  return (codes) => allergensInSentence(t, language, codes);
}

function DownloadMark({ ink }: { ink: string }) {
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
  const { t } = useTranslation();
  const label = downloading ? t('menuPicks.downloading') : t('menuPicks.kitchenSheet');

  return (
    <Pressable
      onPress={downloading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
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
        {label}
      </Text>
    </Pressable>
  );
}

export function SheetFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const words = t('menuPicks.downloadFailed');
  useReadOut(words);

  return (
    <View style={styles.failed} accessibilityRole="alert" testID="menu.sheetFailed">
      <View style={styles.failedHead}>
        <Glyph name="alert" size={18} ink={tokens.colorBrokenText} weight={2.2} />
        <Text size={15} weight="medium" style={styles.flex}>
          {words}
        </Text>
      </View>
      <SecondaryButton label={t('menuPicks.tryAgain')} onPress={onRetry} testID="menu.sheetRetry" />
    </View>
  );
}

export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
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

function CountRow({
  row,
  dish,
  room,
  split,
  chooseWho,
}: {
  row: PicksRow;
  dish: string;
  room: number;
  split: boolean;
  chooseWho: ((from: ViewInstance | null) => void) | null;
}) {
  const { t } = useTranslation();
  const allergens = useAllergens();
  const ref = useRef<ViewInstance>(null);
  const inset = row.kind !== 'dish';
  const name =
    row.kind === 'variant'
      ? t('menuPicks.variantOf', { name: row.name })
      : row.kind === 'option'
        ? t('menuPicks.sideOf', { name: row.name })
        : row.name;
  const children = row.for === 'children';
  const contains =
    row.allergens == null
      ? t('menuPicks.allergensNotStated')
      : row.allergens.length === 0
        ? null
        : t('menuPicks.contains', { allergens: allergens(row.allergens) });
  const figure = split
    ? t('menuPicks.rowSaid', { name, chosen: row.chosen, defaulted: row.defaulted })
    : t('menuPicks.rowChosen', { name, chosen: row.chosen, room });
  const said = [figure, children ? t('menuPicks.childrenOnly') : null, contains]
    .filter(Boolean)
    .join(', ');
  const size = inset ? 15 : 17;

  return (
    <View style={[styles.rowWrap, inset && styles.inset]}>
      <View style={styles.rowLine} accessible accessibilityLabel={said}>
        <View style={styles.flex}>
          <Text size={size} weight={inset ? 'regular' : 'semibold'}>
            {name}
          </Text>
          {children && (
            <Text size={15} style={styles.secondary}>
              {t('menuPicks.childrenOnly')}
            </Text>
          )}
          {contains != null && (
            <Text size={15} style={styles.secondary}>
              {contains}
            </Text>
          )}
        </View>
        <Text size={size} weight="semibold" style={split ? styles.countSplit : styles.count}>
          {split
            ? t('menuPicks.number', { n: row.chosen })
            : t('menuPicks.ofRoom', { n: row.chosen, room })}
        </Text>
        {split && (
          <Text size={size} weight="semibold" style={styles.countSplit}>
            {t('menuPicks.number', { n: row.defaulted })}
          </Text>
        )}
      </View>
      {chooseWho != null && (
        <View style={styles.choose}>
          <SecondaryButton
            ref={ref}
            label={t('menuPicks.chooseWho')}
            accessibilityLabel={t('menuPicks.chooseWhoLabel', { variant: row.name, dish })}
            onPress={() => chooseWho(ref.current)}
            testID={`menu.who.${row.id}`}
          />
        </View>
      )}
    </View>
  );
}

/** The column heads over a course with a default: Defaulted beside Chosen, never inside it. */
function SplitHead({ left, right }: { left: string; right: readonly string[] }) {
  return (
    <View
      style={styles.splitHead}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text size={13} weight="semibold" accessible={false} style={[styles.secondary, styles.flex]}>
        {left}
      </Text>
      {right.map((one) => (
        <Text
          key={one}
          size={13}
          weight="semibold"
          accessible={false}
          style={[styles.secondary, styles.countSplit]}
        >
          {one}
        </Text>
      ))}
    </View>
  );
}

function StateRow({ words, count, mark }: { words: string; count: number; mark?: boolean }) {
  const { t } = useTranslation();
  const figure = t('menuPicks.number', { n: count });

  return (
    <View style={styles.row} accessible accessibilityLabel={`${words}, ${figure}`}>
      <View style={[styles.flex, styles.markLine]}>
        {mark === true && <Glyph name="alert" size={16} ink={tokens.colorAttentionText} />}
        <Text size={15} style={styles.secondary}>
          {words}
        </Text>
      </View>
      <Text size={15} weight="semibold" style={styles.count}>
        {figure}
      </Text>
    </View>
  );
}

export function CourseCard({
  menu,
  course,
  room,
  timeZone,
  manage,
  onChooseWho,
}: {
  menu: EventMenu;
  course: PicksCourse;
  room: number;
  timeZone: string;
  manage: boolean;
  onChooseWho: (row: PicksRow, from: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();
  const close = menuCourseOf(menu, course.id)?.picksClose ?? null;
  const split = showsDefaulted(course);
  const dishName = (id: string | null) => course.rows.find((row) => row.id === id)?.name ?? '';
  const fallback = defaultLine(t, menu, course, dateLocale());

  return (
    <Card testID={`menu.course.${course.id}`}>
      <CardTitle words={course.name} />
      <Text size={15} style={styles.secondary}>
        {t('menuPicks.answered', { n: course.answered, room: course.room })}
      </Text>
      {close != null && (
        <View style={styles.markLine} testID={`menu.course.${course.id}.close`}>
          <Glyph
            name={close.closed ? 'lock' : 'clock'}
            size={16}
            ink={close.closed ? tokens.colorInk : tokens.colorInkSecondary}
          />
          <Text size={15} style={close.closed ? styles.ink : styles.secondary}>
            {t(close.closed ? 'menuPicks.courseClosed' : 'menuPicks.courseOpen', {
              date: closeDay(close.at, timeZone, dateLocale()),
            })}
          </Text>
        </View>
      )}
      {course.asksNothing && (
        <Text size={15} style={styles.secondary} testID={`menu.course.${course.id}.asksNothing`}>
          {t('menuPicks.asksNothing', { dish: course.rows[0]?.name ?? '' })}
        </Text>
      )}
      {fallback != null && (
        <Text size={15} style={styles.ink} testID={`menu.course.${course.id}.default`}>
          {fallback}
        </Text>
      )}
      <View style={styles.rows}>
        {split && (
          <SplitHead
            left={t('menuPicks.dish')}
            right={[t('menuPicks.chosen'), t('menuPicks.defaulted')]}
          />
        )}
        {course.rows.map((row) => (
          <CountRow
            key={row.id}
            row={row}
            dish={dishName(row.dish)}
            room={course.room}
            split={split}
            chooseWho={manage && row.for === 'children' ? (from) => onChooseWho(row, from) : null}
          />
        ))}
        {split && <SplitHead left={t('menuPicks.everyoneElse')} right={[t('menuPicks.people')]} />}
        {course.kitchen > 0 && <StateRow words={t('menuPicks.kitchen')} count={course.kitchen} />}
        {course.skipped > 0 && <StateRow words={t('menuPicks.skipped')} count={course.skipped} />}
        {course.needsHost > 0 && (
          <StateRow words={t('menuPicks.needsHost')} count={course.needsHost} mark />
        )}
        <StateRow words={t('menuPicks.notChosen')} count={course.notChosen} />
      </View>
    </Card>
  );
}

export function ChooseButton({
  name,
  manage,
  onPress,
  testID,
}: {
  name: string;
  manage: boolean;
  onPress: (from: ViewInstance | null) => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<ViewInstance>(null);
  if (!manage) return null;

  return (
    <View style={styles.choose}>
      <SecondaryButton
        ref={ref}
        label={t('menuPicks.chooseFor')}
        accessibilityLabel={t('menuPicks.chooseForLabel', { name })}
        onPress={() => onPress(ref.current)}
        testID={testID}
      />
    </View>
  );
}

export function AllergyPill() {
  const { t } = useTranslation();

  return (
    <View style={styles.allergy}>
      <Glyph name="alert" size={14} ink={tokens.colorAttentionText} />
      <Text size={13} weight="semibold" style={styles.attention}>
        {t('menuPicks.allergyMark')}
      </Text>
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
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={[
        title,
        allergy == null ? null : t('menuPicks.allergyMark'),
        ...lines,
        allergy,
      ]
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
          {allergy != null && <AllergyPill />}
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

/** The override question in the kit's AskLayer: the way back first, the verb last. */
export function OverrideAlert({
  title,
  body,
  keep,
  go,
  onKeep,
  onGo,
}: {
  title: string;
  body: string;
  keep: string;
  go: string;
  onKeep: () => void;
  onGo: () => void;
}) {
  return (
    <Modal visible={useModalOpen(true)} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.askRoom} accessibilityViewIsModal onAccessibilityEscape={onKeep}>
        <AskLayer
          title={title}
          line={body}
          keep={{ label: keep, testID: 'menu.override.another' }}
          confirm={{ label: go, testID: 'menu.override.anyway' }}
          onKeep={onKeep}
          onConfirm={onGo}
          testID="menu.override"
        />
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  attention: { color: tokens.colorAttentionText },
  pressed: { opacity: tokens.opacityPressed },
  pill: {
    flexShrink: 0,
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
  askRoom: { flex: 1 },
  rowWrap: {
    paddingVertical: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  rowLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  splitHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spaceSm,
    paddingBottom: tokens.spaceXs,
  },
  countSplit: { minWidth: 72, flexShrink: 1, textAlign: 'right' },
  tick: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    alignItems: 'flex-start',
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceSm,
  },
  allergyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    flexWrap: 'wrap',
  },
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
});
