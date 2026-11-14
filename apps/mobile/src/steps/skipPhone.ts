import { router } from 'expo-router';

import { api } from '../api.ts';
import { skipDropsPhone } from '../landing.ts';

/** Skip on either mobile step: saving the details with no number removes the phone, so the gate rests on the email again. */
export async function skipPhone(): Promise<void> {
  const account = await api.me();
  if (skipDropsPhone(account)) await api.completeProfile({ name: account.name });
  router.replace('/');
}
