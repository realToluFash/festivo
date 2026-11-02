import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../src/components/AppFrame.tsx';
import { bodyEdges } from '../src/components/bodyEdges.ts';
import { type FeedOffline, NotificationsFeed } from '../src/components/NotificationsFeed.tsx';
import { Refreshing } from '../src/components/Refreshing.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { type TextHandle } from '../src/components/Text.tsx';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

/** The bell's own screen, back to where it was opened from (sc-3980), on a tablet from the top of the body (sc-23814), with the feed's band and Refreshing… (sc-27096). */
export default function Notifications() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const title = useRef<TextHandle>(null);
  const phone = kind === 'phone';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const [offline, setOffline] = useState<FeedOffline>({ stale: null, refreshing: false });
  const refreshing = offline.refreshing ? <Refreshing testID="notifications.refreshing" /> : null;

  return (
    <AppFrame
      current="home"
      aboutTheAccount
      title={t('notifications.heading')}
      titleRef={title}
      offline={offline.stale}
      besideBack={phone ? refreshing : undefined}
      besideTitle={phone ? undefined : refreshing}
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
        <NotificationsFeed heading={title} onOffline={setOffline} />
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: 0 },
  back: { paddingTop: tokens.spaceXl, paddingHorizontal: tokens.spaceXl },
});
