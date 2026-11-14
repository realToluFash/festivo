import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShell } from '../../components/settingsShell.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { type ReminderKind, days, money, paymentOf, reminderSheet } from './BudgetModel.ts';
import { EVENT_NAME, REMINDER_DAYS, VENDORS } from './BudgetSample.ts';
import { OverdueTag } from './BudgetParts.tsx';
import { W, say } from './BudgetWords.ts';

/** sc-95's reminder as it arrives: one message for everything due, overdue first and marked as the last about it; it opens Due now. */
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
  const { layout } = useShell();
  if (kind == null) return null;

  const sheet = reminderSheet(kind);
  const overdue = sheet.lastAbout;
  const coming = sheet.ids.filter((id) => !overdue.includes(id));
  const title =
    kind === 'overdue'
      ? say.reminderOverdue(overdue.length, EVENT_NAME)
      : say.reminderMixed(overdue.length, coming.length, REMINDER_DAYS);
  const rows = sheet.ids.map((id) => {
    const payment = paymentOf(id);
    const date = days.short(payment.due, locale);
    const late = overdue.includes(id);
    return {
      id,
      late,
      words: say.reminderRow(
        VENDORS[payment.vendor].name,
        money(payment.amount, locale),
        late ? say.wasDue(date) : say.dueWhen(date),
      ),
    };
  });
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

  return (
    <View
      style={[styles.wrap, { top: insets.top + tokens.spaceSm }, layout !== 'phone' && styles.pad]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={W.dueNow}
        testID={`budget.reminder.${kind}`}
      >
        <View style={styles.head}>
          <Text size={13} weight="semibold" accessible={false} style={styles.grow}>
            {W.app}
          </Text>
          <Text size={13} weight="medium" accessible={false} style={styles.secondary}>
            {W.justNow}
          </Text>
        </View>
        <Text size={16} weight="bold" accessible={false} style={styles.title}>
          {title}
        </Text>
        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <Text size={14} weight="medium" accessible={false} style={styles.line}>
              {row.words}
            </Text>
            {row.late && <OverdueTag word={W.overdueLast} />}
          </View>
        ))}
        {closing != null && (
          <Text
            size={14}
            weight="medium"
            accessible={false}
            style={[styles.line, styles.secondary]}
          >
            {closing}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: tokens.spaceMd, right: tokens.spaceMd },
  pad: { left: undefined, right: tokens.spaceXxl, width: 420 },
  banner: {
    gap: tokens.spaceXs,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.dialog.ios,
    elevation: tokens.elevationNative.dialog.android.elevation,
  },
  pressed: { opacity: tokens.opacityPressed },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  title: { lineHeight: 16 * 1.3 },
  row: { gap: tokens.spaceXxs },
  line: { lineHeight: 14 * 1.4 },
});
