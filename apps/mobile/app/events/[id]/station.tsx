import { router, useLocalSearchParams } from 'expo-router';

import { KitchenStationView } from '../../../src/components/station/KitchenStationView.tsx';
import { useLayout } from '../../../src/layout/useLayout.ts';

/** /events/<id>/station (sc-4015): a kitchen station's trays and items, for whoever works the pass; ?from=overview or night names the way back (sc-95382). */
export default function EventKitchenStation() {
  const { kind } = useLayout();
  const { id = '', from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/events/${id}`));

  return (
    <KitchenStationView
      eventId={id}
      kind={kind}
      onBack={back}
      from={from === 'overview' || from === 'night' ? from : null}
    />
  );
}
