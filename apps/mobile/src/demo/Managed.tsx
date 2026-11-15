import { router } from 'expo-router';

import { Notice } from '../components/Notice.tsx';
import { TextAction } from '../components/Summary.tsx';
import { MANAGED_WORDS as M } from './settings/DataWords.ts';

/** sc-563: where a membership path ends for an address its home organisation manages, the "i" on Surf grey and the way out. */
export function ManagedBanner({ onChange, testID }: { onChange?: () => void; testID: string }) {
  return (
    <Notice
      tone="quiet"
      mark="i"
      title={M.title}
      body={M.body}
      detail={M.single}
      announce
      actions={
        <TextAction
          label={M.change}
          onPress={onChange ?? (() => router.push('/demo/settings/account'))}
          testID={`${testID}.change`}
        />
      }
    />
  );
}
