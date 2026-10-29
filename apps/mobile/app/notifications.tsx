import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame } from '../src/components/AppFrame.tsx';
import { bodyEdges } from '../src/components/bodyEdges.ts';
import { NotificationsFeed } from '../src/components/NotificationsFeed.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

/** The bell's own screen, back to where it was opened from (sc-3980). */
export default function Notifications() {
  const { t } = useTranslation();
  const { kind } = useLayout();

  return (
    <AppFrame
      current="home"
      aboutTheAccount
      title={t('notifications.heading')}
      back={{
        label: t('notifications.back'),
        onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
        systemBack: true,
      }}
    >
      <Screen edges={bodyEdges(kind)} contentStyle={styles.content}>
        <NotificationsFeed />
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
});
