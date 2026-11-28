import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import type { OrganisationEvent } from '@soirely/api-client';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../../../src/components/AppFrame.tsx';
import { NightView } from '../../../src/components/NightView.tsx';
import { useSidebarCard } from '../../../src/components/sidebarCard.ts';
import { type TextHandle } from '../../../src/components/Text.tsx';
import { goToArea, goToEndNow, goUpToEvent } from '../../../src/kit/upToEvent.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** /events/<id>/night (sc-3895): Run of show, the night run press by press while the event is happening. */
export default function EventNight() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { id = '', track } = useLocalSearchParams<{ id?: string; track?: string }>();
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
      <NightView
        eventId={id}
        kind={kind}
        top={
          phone ? null : <BackButton label={t('runView.back')} onPress={back} testID="night.back" />
        }
        contentStyle={phone ? styles.phone : styles.tablet}
        onEvent={setEvent}
        onEndNow={() => goToEndNow(navigation, router, id)}
        track={track}
      />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  phone: { gap: tokens.spaceLg, padding: tokens.spaceLg },
  tablet: { gap: tokens.spaceLg, padding: tokens.space3xl },
});
