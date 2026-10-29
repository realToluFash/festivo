import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../../src/components/bodyEdges.ts';
import { Screen } from '../../../src/components/Screen.tsx';
import { AllDates } from '../../../src/components/Timeline.tsx';
import { upToEvent } from '../../../src/kit/eventDates.ts';
import { useServerNow } from '../../../src/kit/serverNow.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** Every milestone on the event, opened from Coming up's All dates (sc-3624). */
export default function EventDates() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const now = useServerNow();
  const phone = kind === 'phone';
  const back = () => {
    const { routes, index } = navigation.getState() ?? { routes: [], index: 0 };

    if (upToEvent(routes, index, id) === 'back') router.back();
    else router.replace(`/events/${encodeURIComponent(id)}`);
  };

  return (
    <AppFrame
      current="events"
      title={t('timeline.allDates')}
      back={phone ? { label: t('timeline.backToEvent'), onPress: back } : undefined}
    >
      <Screen edges={bodyEdges(kind)} contentStyle={styles.content}>
        {!phone && (
          <BackButton
            label={t('timeline.backToEvent')}
            onPress={back}
            testID="timeline.allDates.back"
          />
        )}
        <AllDates kind={kind} eventId={id} now={now} />
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.spaceLg, padding: tokens.spaceXl },
});
