import { hostErrorsShownOf } from '@soirely/domain';

import { t } from './EventsWords.ts';

/** Each row's refusal as Hosted by shows it, by the domain's rule, in the demo's words. */
export function hostErrorWords(names: readonly string[], tried: boolean): (string | null)[] {
  const shown = hostErrorsShownOf(
    names.map((name, key) => ({ key, name })),
    t,
    tried,
  );

  return names.map((_, key) => shown[key] ?? null);
}
