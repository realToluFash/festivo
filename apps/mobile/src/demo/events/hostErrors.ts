import { HOST_NAME_MAXIMUM, hostProblems } from '@soirely/domain';

import { W, say, t } from './EventsWords.ts';

/** Each row's refusal as Hosted by shows it: a repeat and an overlong name at once, a blank one once Save or Create was tried. */
export function hostErrorWords(names: readonly string[], tried: boolean): (string | null)[] {
  return hostProblems(names).map((problem) =>
    problem?.problem === 'hostDuplicate'
      ? say.hostDuplicate(problem.name)
      : problem?.problem === 'hostTooLong'
        ? t('eventHosts.tooLong', { most: HOST_NAME_MAXIMUM, length: problem.length })
        : problem?.problem === 'hostBlank' && tried
          ? W.hostBlank
          : null,
  );
}
