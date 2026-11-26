import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { FloorScreen } from '../../../src/components/FloorScreen.tsx';

export default function EventFloor() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/events/[id]', params: { id } });
  }, [id]);

  return <FloorScreen eventId={id} onBack={back} />;
}
