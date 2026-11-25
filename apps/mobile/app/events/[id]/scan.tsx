import { router, useLocalSearchParams } from 'expo-router';

import { ScannerView } from '../../../src/components/ScannerView.tsx';
import { useLayout } from '../../../src/layout/useLayout.ts';

/** /events/<id>/scan (sc-1301): Scan a code, opened from Check-in's card; the camera fills the screen, with no frame around it. */
export default function EventScan() {
  const { kind } = useLayout();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();

  return (
    <ScannerView
      eventId={id}
      kind={kind}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: '/events/[id]/check-in', params: { id } });
      }}
      onSearch={() =>
        router.dismissTo({
          pathname: '/events/[id]/check-in',
          params: { id, focus: 'search', tap: String(Date.now()) },
        })
      }
    />
  );
}
