import { deviceCountry, phoneScreenCountry } from '@soirely/domain';
import { useEffect, useState } from 'react';

import { api } from '../../../api.ts';
import { useSession } from '../../../session.ts';

/** The code the Mobile number starts on, as the account's own Mobile number field picks it. */
export function useStartingCountry(asks: boolean): string {
  const session = useSession();
  const [numbers, setNumbers] = useState<
    readonly { primary: boolean; countryCode: string | null }[]
  >([]);

  useEffect(() => {
    if (!asks) return;
    let current = true;

    api.me().then(
      (me) => current && setNumbers(me.phoneNumbers),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [asks]);

  return phoneScreenCountry(
    { organisationCountry: session.organisationCountry ?? null, phoneNumbers: numbers },
    deviceCountry(navigator.languages),
  );
}
