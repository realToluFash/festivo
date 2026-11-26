import { router, useLocalSearchParams } from 'expo-router';

import { KitchenStationView } from '../../../src/components/station/KitchenStationView.tsx';
import { useLayout } from '../../../src/layout/useLayout.ts';

/** /events/<id>/station (sc-4015): a kitchen station's trays and items, for whoever works the pass. */
export default function EventKitchenStation() {
  const { kind } = useLayout();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/events/${id}`));

  return <KitchenStationView eventId={id} kind={kind} onBack={back} />;
}
