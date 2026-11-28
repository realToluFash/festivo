import type { StaffEntry } from '@soirely/api-client';
import { setStringAsync } from 'expo-clipboard';
import type { TFunction } from 'i18next';

export type Held = { label: string; url: string };

export type CopyOutcome = {
  staff: StaffEntry;
  held: Held | null;
  said: string;
  toast: string | null;
};

/** Copy link after the deliver answer recorded Copied: a clipboard that refuses leaves the link in a read-only field to copy by hand (sc-77903). */
export async function copyDelivered(
  t: TFunction,
  answer: { url: string; staff: StaffEntry },
): Promise<CopyOutcome> {
  const copied = await setStringAsync(answer.url).then(
    () => true,
    () => false,
  );
  if (copied) {
    const said = t('staffLink.copiedSaid');

    return { staff: answer.staff, held: null, said, toast: said };
  }

  return {
    staff: answer.staff,
    held: { label: t('staffLink.linkFor', { name: answer.staff.fullName }), url: answer.url },
    said: t('staffLink.refused'),
    toast: null,
  };
}
