import { router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { AppFrame } from '../src/components/AppFrame.tsx';
import { bodyEdges } from '../src/components/bodyEdges.ts';
import { NotificationsFeed } from '../src/components/NotificationsFeed.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { type TextHandle } from '../src/components/Text.tsx';
import { useLayout } from '../src/layout/useLayout.ts';

/** The bell's own screen, back to where it was opened from (sc-3980). */
export default function Notifications() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const title = useRef<TextHandle>(null);

  return (
    <AppFrame
      current="home"
      aboutTheAccount
      title={t('notifications.heading')}
      titleRef={title}
      back={{
        label: t('notifications.back'),
        onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
        systemBack: true,
      }}
    >
      <Screen edges={bodyEdges(kind)} scroll={false}>
        <NotificationsFeed heading={title} />
      </Screen>
    </AppFrame>
  );
}
