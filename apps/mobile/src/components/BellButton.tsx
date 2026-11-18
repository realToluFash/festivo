import { router } from 'expo-router';
import { type ReactNode, type Ref, createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useUnread } from '../notificationsUnread.ts';
import { RoundButton } from './SettingsParts.tsx';
import { tokens } from '../theme/tokens.ts';

/** The bell as the demos draw it: round and grey, a dot while anything is unread, and the exact count in its name. */
export function Bell({
  unread,
  onPress,
  testID,
  ref,
}: {
  unread: number;
  onPress: () => void;
  testID?: string | undefined;
  ref?: Ref<ViewInstance> | undefined;
}) {
  const { t } = useTranslation();

  return (
    <RoundButton
      ref={ref}
      glyph="bell"
      label={
        unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')
      }
      dot={unread > 0}
      onPress={onPress}
      testID={testID}
    />
  );
}

/** The bell in the frame (sc-3980), opening Notifications. */
export function BellButton() {
  const unread = useUnread();

  return <Bell unread={unread} onPress={() => router.push('/notifications')} testID="frame.bell" />;
}

/** On an iPad on its side, where the frame draws no title and so no bell, the pane's own title row ends with the bell (sc-68052). */
export const BellInPane = createContext(false);

/** The bell that ends an area's own title row in the pane, on an iPad on its side; elsewhere the frame's top has it. */
export function PaneBell() {
  return useContext(BellInPane) ? <BellButton /> : null;
}

/** What heads the pane, ended by its bell at the top right: it wraps to the bell's left at the largest sizes, in a row as tall as the bell's target. */
export function BellRow({ children = null }: { children?: ReactNode }) {
  if (!useContext(BellInPane)) return children;

  return (
    <View style={styles.row}>
      <View style={styles.beside}>{children}</View>
      <BellButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  beside: { flex: 1, minWidth: 0, minHeight: tokens.sizeHit, justifyContent: 'center' },
});
