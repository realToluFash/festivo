import { useLocalSearchParams } from 'expo-router';

import { Redeem } from '../../src/components/Redeem.tsx';

/** Enter a door code, from the welcome (sc-72), or after Sign out for an account only a phone code signs in (sc-4235). */
export default function EnterDoorCode() {
  const { signedOut } = useLocalSearchParams<{ signedOut?: string }>();

  return <Redeem code="" signedOut={signedOut === '1'} />;
}
