import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { MyNightScreen } from '../../../src/components/MyNightScreen.tsx';

/** /events/<id>/my-night (sc-3915): a person's whole night, opened over the event's Overview by Your night. */
export default function EventMyNight() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/events/[id]', params: { id } });
  }, [id]);

  return <MyNightScreen eventId={id} onBack={back} />;
}
