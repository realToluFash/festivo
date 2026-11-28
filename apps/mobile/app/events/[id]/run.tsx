import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import type { OrganisationEvent } from '@soirely/api-client';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../../src/components/bodyEdges.ts';
import { RunView } from '../../../src/components/RunView.tsx';
import { Screen } from '../../../src/components/Screen.tsx';
import { useSidebarCard } from '../../../src/components/sidebarCard.ts';
import { type TextHandle } from '../../../src/components/Text.tsx';
import { goToArea, goUpToEvent } from '../../../src/kit/upToEvent.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** /events/<id>/run (sc-1404): the night's schedule as it runs, every time still to come moved with it. */
export default function EventRun() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const phone = kind === 'phone';
  const back = () => goToArea(navigation, router, id, 'schedule');
  const title = useRef<TextHandle>(null);
  const [event, setEvent] = useState<OrganisationEvent | null>(null);
  const card = useSidebarCard(event?.id === id ? event : null);

  return (
    <AppFrame
      current="events"
      title={t('runView.title')}
      titleRef={title}
      back={phone ? { label: t('runView.back'), onPress: back } : undefined}
      backInBody
      inEvent={{
        area: 'schedule',
        onArea: (area) =>
          area === 'overview'
            ? goUpToEvent(navigation, router, id)
            : goToArea(navigation, router, id, area),
        card,
      }}
    >
      <Screen edges={bodyEdges(kind)} contentStyle={styles.content}>
        {!phone && <BackButton label={t('runView.back')} onPress={back} testID="run.back" />}
        <RunView eventId={id} kind={kind} onEvent={setEvent} />
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.spaceLg, padding: tokens.spaceXl },
});
