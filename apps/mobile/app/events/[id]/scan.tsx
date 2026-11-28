import { router, useLocalSearchParams } from 'expo-router';

import { ScannerView } from '../../../src/components/ScannerView.tsx';
import { CHECK_IN_FROM, checkInHrefOf } from '../../../src/kit/myNight.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';

/** /events/<id>/scan (sc-1301): Scan a code, opened from Check-in's card; the camera fills the screen, with no frame around it. */
export default function EventScan() {
  const { kind } = useLayout();
  const { id = '', [CHECK_IN_FROM]: from } = useLocalSearchParams<{
    id?: string;
    [CHECK_IN_FROM]?: string;
  }>();

  return (
    <ScannerView
      eventId={id}
      kind={kind}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace(checkInHrefOf(id, from));
      }}
      onSearch={() =>
        router.dismissTo(checkInHrefOf(id, from, { focus: 'search', tap: String(Date.now()) }))
      }
    />
  );
}
