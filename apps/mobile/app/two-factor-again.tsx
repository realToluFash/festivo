import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { PrimaryButton, QuietButton } from '../src/components/Buttons.tsx';
import { SECTION_HREF } from '../src/kit/appNav.ts';
import { Heading, Plain } from '../src/steps/Lines.tsx';
import { StepScreen } from '../src/steps/StepScreen.tsx';
import { tokens } from '../src/theme/tokens.ts';

/** After an approved recovery (sc-509): set two-factor up again, or Not now and find it in Security. */
export default function TwoFactorAgain() {
  const { t } = useTranslation();
  const [skipping, setSkipping] = useState(false);

  return (
    <StepScreen
      foot={
        <>
          <PrimaryButton
            label={t('lostTwoFactor.setup')}
            onPress={() => router.replace(SECTION_HREF.security)}
            testID="twoFactorAgain.setup"
          />
          <QuietButton
            label={t('lostTwoFactor.notNow')}
            off={skipping}
            onPress={() => {
              setSkipping(true);
              void api
                .dismissTwoFactorPrompt()
                .catch(() => {})
                .then(() => router.replace('/'));
            }}
            testID="twoFactorAgain.notNow"
          />
        </>
      }
    >
      <Heading title={t('lostTwoFactor.setupTitle')} intro={t('lostTwoFactor.setupIntro')} />
      <Plain top={tokens.spaceXl}>{t('lostTwoFactor.notNowNote')}</Plain>
    </StepScreen>
  );
}
