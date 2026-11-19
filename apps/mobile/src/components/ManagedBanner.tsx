import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Notice } from './Notice.tsx';
import { TextAction } from './SummaryRows.tsx';

/** sc-563: where a membership path ends for an address its home organisation manages, the "i" on Surf grey and the way out. */
export function ManagedBanner({
  organisation,
  message,
  onChange,
  way = true,
  testID,
}: {
  organisation: string;
  /** The API's sentence, in the reader's language. */
  message: string;
  onChange?: () => void;
  /** False behind the onboarding gate, where Account settings cannot be reached yet. */
  way?: boolean;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <Notice
      tone="quiet"
      mark="i"
      title={t('managed.title', { organisation })}
      body={message}
      detail={t('managed.single')}
      announce
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
