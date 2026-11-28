import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShell } from '../../components/settingsShell.ts';
import { tokens } from '../../theme/tokens.ts';
import { IosBanner } from '../IosBanner.tsx';
import { type ReminderKind, paymentOf, reminderRows, reminderSheet } from './BudgetModel.ts';
import { EVENT_NAME, REMINDER_DAYS, VENDORS } from './BudgetSample.ts';
import { W, say } from './BudgetWords.ts';

/** sc-95's reminder as iOS draws its push, overdue rows first and marked as the last about it; a tap opens Due now. */
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
      <IosBanner
        title={title}
        age={W.justNow}
        body={body}
        raised
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={W.dueNow}
        testID={`budget.reminder.${kind}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: tokens.spaceMd, right: tokens.spaceMd },
  pad: { left: undefined, right: tokens.spaceXxl, width: 420 },
});
