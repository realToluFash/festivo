import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import type { OrganisationEvent } from '@soirely/api-client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppFrame, BackButton } from '../../../src/components/AppFrame.tsx';
import { CheckInView } from '../../../src/components/CheckInView.tsx';
import { useSidebarCard } from '../../../src/components/sidebarCard.ts';
import { type TextHandle } from '../../../src/components/Text.tsx';
import { goToArea, goUpToEvent } from '../../../src/kit/upToEvent.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';

/** /events/<id>/check-in (sc-1454): the door, opened from the event's Guests with Open check-in. */
export default function EventCheckIn() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const phone = kind === 'phone';
  const back = () => goToArea(navigation, router, id, 'guests');
  const title = useRef<TextHandle>(null);
  const [event, setEvent] = useState<OrganisationEvent | null>(null);
  const card = useSidebarCard(event?.id === id ? event : null);

  return (
    <AppFrame
      current="events"
      title={t('checkIn.title')}
      titleRef={title}
      back={phone ? { label: t('checkIn.back'), onPress: back } : undefined}
      backInBody
      inEvent={{
        area: 'guests',
        onArea: (area) =>
          area === 'overview'
            ? goUpToEvent(navigation, router, id)
            : goToArea(navigation, router, id, area),
        card,
      }}
    >
      <CheckInView
        eventId={id}
        kind={kind}
        top={
          phone ? null : (
            <BackButton label={t('checkIn.back')} onPress={back} testID="checkIn.back" />
          )
        }
        onEvent={setEvent}
      />
    </AppFrame>
  );
}
