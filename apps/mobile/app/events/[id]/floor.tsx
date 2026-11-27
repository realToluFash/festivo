import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { FloorScreen } from '../../../src/components/FloorScreen.tsx';

/** /events/<id>/floor (sc-4021): Floor for whoever works it; ?from=overview or night names the way back (sc-98893). */
export default function EventFloor() {
  const { id = '', from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/events/[id]', params: { id } });
  }, [id]);

  return (
    <FloorScreen
      eventId={id}
      onBack={back}
      from={from === 'overview' || from === 'night' ? from : null}
    />
  );
}
