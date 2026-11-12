import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../../src/components/bodyEdges.ts';
import { Refreshing } from '../../../src/components/Refreshing.tsx';
import { Screen } from '../../../src/components/Screen.tsx';
import { useEventRead, useSidebarCard } from '../../../src/components/sidebarCard.ts';
import { type TextHandle } from '../../../src/components/Text.tsx';
import { AllDates } from '../../../src/components/Timeline.tsx';
import { goToArea, goUpToEvent } from '../../../src/kit/upToEvent.ts';
import { useServerNow } from '../../../src/kit/serverNow.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';
import { NOT_OFFLINE, type ScreenOffline } from '../../../src/offline.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** Every milestone on the event, opened from Coming up's All dates (sc-3624); inside the event, so Overview is current; with its band and Refreshing… (sc-27086). */
export default function EventDates() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const now = useServerNow();
  const phone = kind === 'phone';
  const back = () => goUpToEvent(navigation, router, id);
  const title = useRef<TextHandle>(null);
  const [offline, setOffline] = useState<ScreenOffline>(NOT_OFFLINE);
  const card = useSidebarCard(useEventRead(id));
  const refreshing = offline.refreshing ? (
    <Refreshing testID="timeline.allDates.refreshing" />
  ) : null;

  return (
    <AppFrame
      current="events"
      title={t('timeline.allDates')}
      titleRef={title}
      offline={offline.stale}
      besideBack={phone ? refreshing : undefined}
      besideTitle={phone ? undefined : refreshing}
      back={phone ? { label: t('timeline.backToEvent'), onPress: back } : undefined}
      backInBody
      inEvent={{
        area: 'overview',
        onArea: (area) => (area === 'overview' ? back() : goToArea(navigation, router, id, area)),
        card,
      }}
    >
      <Screen edges={bodyEdges(kind)} contentStyle={styles.content}>
        {!phone && (
          <BackButton
            label={t('timeline.backToEvent')}
            onPress={back}
            testID="timeline.allDates.back"
          />
        )}
        <AllDates kind={kind} eventId={id} now={now} heading={title} onOffline={setOffline} />
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.spaceLg, padding: tokens.spaceXl },
});
