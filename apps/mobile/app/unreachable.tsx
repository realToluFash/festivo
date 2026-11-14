import { ApiUnreachableError } from '@soirely/api-client';
import { connection } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { PrimaryButton } from '../src/components/Buttons.tsx';
import { LanguageChoice } from '../src/components/LanguageChoice.tsx';
import { OnBrand, WelcomeBrand, WelcomeFrame } from '../src/components/Welcome.tsx';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';
import { holdsSession } from '../src/tokens.ts';
import { carryOn } from '../src/unreachable.ts';

/** No connection, said on the brand; a held session is kept, and the app tries again once the connection is back (sc-29076). */
export default function Unreachable() {
  const { t } = useTranslation();
  const { link, to } = useLocalSearchParams<{ link?: string; to?: string }>();
  const { kind } = useLayout();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const trying = useRef(false);

  useEffect(() => {
    let live = true;

    void holdsSession().then((held) => {
      if (live) setSignedIn(held);
    });

    return () => {
      live = false;
    };
  }, []);

  // Only whether Soirely answers: the screen it carries on to asks everything else, as on a first answer.
  const retry = useCallback(async (): Promise<void> => {
    if (trying.current) return;
    trying.current = true;
    setRetrying(true);

    try {
      await api.health();
    } catch (error) {
      if (error instanceof ApiUnreachableError) {
        trying.current = false;
        setRetrying(false);
        return;
      }
    }

    router.replace(carryOn(link, to));
  }, [link, to]);

  useEffect(
    () =>
      connection.subscribe((change) => {
        if (change === 'deviceBack') void retry();
      }),
    [retry],
  );

  return (
    <WelcomeFrame
      top={signedIn === false ? <LanguageChoice /> : undefined}
      brand={
        <>
          <WelcomeBrand />
          {signedIn != null && (
            <OnBrand
              title={t('session.unreachableTitle')}
              body={t(signedIn ? 'session.unreachableBody' : 'session.unreachableBodySignedOut')}
              size={
                kind === 'phone' ? tokens.typeCoverTitle.size : tokens.typeCoverTitleTablet.size
              }
            />
          )}
        </>
      }
      choices={
        <PrimaryButton
          label={retrying ? t('session.retrying') : t('status.retry')}
          onPress={() => void retry()}
          busy={retrying}
          testID="unreachable.retry"
        />
      }
    />
  );
}
