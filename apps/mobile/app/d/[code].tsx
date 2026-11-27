import { useLocalSearchParams } from 'expo-router';

import { Redeem } from '../../src/components/Redeem.tsx';

/** A door code's QR link, https://…/d/<code> as on the web, opened in the app with the code filled in (sc-72). */
export default function DoorCodeLink() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();

  return <Redeem key={code} code={code} />;
}
