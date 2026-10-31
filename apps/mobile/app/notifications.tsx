import { router } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../src/components/AppFrame.tsx';
import { bodyEdges } from '../src/components/bodyEdges.ts';
import { NotificationsFeed } from '../src/components/NotificationsFeed.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { type TextHandle } from '../src/components/Text.tsx';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

/** The bell's own screen, back to where it was opened from (sc-3980), on a tablet from the top of the body (sc-23814). */
export default function Notifications() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const title = useRef<TextHandle>(null);
  const phone = kind === 'phone';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <AppFrame
      current="home"
      aboutTheAccount
      title={t('notifications.heading')}
      titleRef={title}
      back={{ label: t('notifications.back'), onPress: back, systemBack: true }}
      backInBody
    >
      <Screen
        edges={bodyEdges(kind)}
        scroll={false}
        {...(phone ? {} : { contentStyle: styles.body })}
      >
        {!phone && (
          <View style={styles.back}>
            <BackButton
              label={t('notifications.back')}
              onPress={back}
              testID="notifications.back"
            />
          </View>
        )}
        <NotificationsFeed heading={title} />
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: 0 },
  back: { paddingTop: tokens.spaceXl, paddingHorizontal: tokens.spaceXl },
});
