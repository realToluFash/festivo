import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../src/components/AppFrame.tsx';
import { bodyEdges } from '../src/components/bodyEdges.ts';
import { NotificationsFeed } from '../src/components/NotificationsFeed.tsx';
import { Refreshing } from '../src/components/Refreshing.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { type TextHandle } from '../src/components/Text.tsx';
import { useLayout } from '../src/layout/useLayout.ts';
import { NOT_OFFLINE, type ScreenOffline } from '../src/offline.ts';
import { tokens } from '../src/theme/tokens.ts';

/** The bell's own screen, back to where it was opened from (sc-3980): on an upright phone the B frame's (sc-83081); on a phone on its side, and on a tablet reached from a push rather than the bell, main's frame (sc-62023, sc-23814), with the feed's band and Refreshing… (sc-27096). */
export default function Notifications() {
  const { kind, width, height } = useLayout();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (kind === 'phone' && height >= width)
    return <NotificationsFeed where={{ kind: 'screen', onBack: back }} />;

  return <FramedNotifications back={back} />;
}

function FramedNotifications({ back }: { back: () => void }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const title = useRef<TextHandle>(null);
  const phone = kind === 'phone';
  const [offline, setOffline] = useState<ScreenOffline>(NOT_OFFLINE);
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
        <NotificationsFeed where={{ kind: 'framed', heading: title, onOffline: setOffline }} />
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: 0, gap: 0 },
  back: { paddingTop: tokens.spaceXl, paddingHorizontal: tokens.spaceXl },
});
