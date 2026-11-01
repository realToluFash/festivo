import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { PrimaryButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { Text } from '../src/components/Text.tsx';
import { SECTION_HREF } from '../src/kit/appNav.ts';
import { tokens } from '../src/theme/tokens.ts';

/** After an approved recovery (sc-509): set two-factor up again, or carry on and find it in Security. */
export default function TwoFactorAgain() {
  const { t } = useTranslation();
  const [skipping, setSkipping] = useState(false);

  return (
    <AuthFrame
      saying={
        <AuthHeading
          apart
          title={t('lostTwoFactor.setupTitle')}
          intro={t('lostTwoFactor.setupIntro')}
        />
      }
    >
      <PrimaryButton
        label={t('lostTwoFactor.setup')}
        onPress={() => router.replace(SECTION_HREF.security)}
        testID="twoFactorAgain.setup"
      />
      <SecondaryButton
        stacked
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
      <Text size={tokens.typeSmall.size} style={{ color: tokens.colorInkSecondary }}>
        {t('lostTwoFactor.notNowNote')}
      </Text>
    </AuthFrame>
  );
}
