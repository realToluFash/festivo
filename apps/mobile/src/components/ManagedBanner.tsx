import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice } from './Notice.tsx';
import { TextAction } from './SummaryRows.tsx';

/** sc-563: where a membership path ends for an address its home organisation manages, the "i" on Surf grey and the way out. */
export function ManagedBanner({
  organisation,
  message,
  onChange,
  way = true,
  takesFocus = false,
  testID,
}: {
  organisation: string;
  /** The API's sentence, in the reader's language. */
  message: string;
  onChange?: () => void;
  /** False behind the onboarding gate, where Account settings cannot be reached yet. */
  way?: boolean;
  /** It answers the button it replaced, so screen reader focus moves to its words as it appears (sc-563). */
  takesFocus?: boolean;
  testID: string;
}) {
  const { t } = useTranslation();
  const [appeared] = useState(() => ({}));

  return (
    <Notice
      tone="quiet"
      mark="i"
      title={t('managed.title', { organisation })}
      body={message}
      detail={t('managed.single')}
      announce
      takesFocus={takesFocus}
      answer={takesFocus ? appeared : undefined}
      actions={
        way ? (
          <TextAction
            label={t('managed.change')}
            onPress={onChange ?? (() => router.push('/settings/account'))}
            testID={`${testID}.change`}
          />
        ) : undefined
      }
    />
  );
}
