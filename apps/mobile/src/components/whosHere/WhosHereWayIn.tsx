import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { SecondaryButton } from '../Buttons.tsx';

/** A lead's way into Who's here from My night (sc-3918): shown once the event answers that they may read it, since My night does not say who leads. */
export function WhosHereWayIn({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const [reads, setReads] = useState(false);

  useEffect(() => {
    let current = true;
    api.whosHere(eventId).then(
      () => current && setReads(true),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [eventId]);

  if (!reads) return null;

  return (
    <SecondaryButton
      label={t('whosHere.open')}
      onPress={() => router.push({ pathname: '/events/[id]/whos-here', params: { id: eventId } })}
      testID="myNight.whosHere"
    />
  );
}
