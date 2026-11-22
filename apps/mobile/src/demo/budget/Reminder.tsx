import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShell } from '../../components/settingsShell.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { type ReminderKind, paymentOf, reminderRows, reminderSheet } from './BudgetModel.ts';
import { EVENT_NAME, REMINDER_DAYS, VENDORS } from './BudgetSample.ts';
import { W, say } from './BudgetWords.ts';

/** sc-95's reminder as iOS draws its push: a one-line title and a two-line plain body that a long press opens in full, overdue rows first and marked as the last about it; a tap opens Due now. */
export function ReminderBanner({
  kind,
  locale,
  onOpen,
}: {
  kind: ReminderKind | null;
  locale: string;
  onOpen: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const { layout } = useShell();
  if (kind == null) return null;

  const sheet = reminderSheet(kind);
  const overdue = sheet.lastAbout;
  const coming = sheet.ids.filter((id) => !overdue.includes(id));
  const title =
    kind === 'overdue'
      ? say.reminderOverdue(overdue.length, EVENT_NAME)
      : kind === 'due'
        ? say.reminderDue(coming.length, REMINDER_DAYS, EVENT_NAME)
        : say.reminderMixed(overdue.length, coming.length, REMINDER_DAYS);
  const rows = reminderRows(kind, locale);
  const last = overdue[0];
  const closing =
    kind === 'mixed' && last != null
      ? say.lastAbout(paymentOf(last).what, VENDORS[paymentOf(last).vendor].name)
      : null;
  const label = [
    W.app,
    title,
    ...rows.map((row) => (row.late ? `${row.words}. ${W.overdueLast}` : row.words)),
    closing,
  ]
    .filter(Boolean)
    .join('. ');

  const body = [
    ...rows.map((row) => (row.late ? `${row.words} · ${W.overdueLast}` : row.words)),
    closing,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <View
      style={[styles.wrap, { top: insets.top + tokens.spaceSm }, layout !== 'phone' && styles.pad]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onOpen}
        onLongPress={() => setOpen((was) => !was)}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={W.dueNow}
        testID={`budget.reminder.${kind}`}
      >
        <View style={styles.mark}>
          <Text size={18} weight="bold" accessible={false} style={styles.onDark}>
            S
          </Text>
        </View>
        <View style={styles.words}>
          <View style={styles.head}>
            <Text
              size={15}
              weight="semibold"
              accessible={false}
              numberOfLines={1}
              style={styles.grow}
            >
              {title}
            </Text>
            <Text size={13} accessible={false} style={styles.secondary}>
              {W.justNow}
            </Text>
          </View>
          <Text size={15} accessible={false} numberOfLines={open ? undefined : 2}>
            {body}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: tokens.spaceMd, right: tokens.spaceMd },
  pad: { left: undefined, right: tokens.spaceXxl, width: 420 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.dialog.ios,
    elevation: tokens.elevationNative.dialog.android.elevation,
  },
  pressed: { opacity: tokens.opacityPressed },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tokens.colorAccentHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onDark: { color: tokens.colorInkOnDark },
  words: { flex: 1, minWidth: 0, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.spaceSm },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
});
