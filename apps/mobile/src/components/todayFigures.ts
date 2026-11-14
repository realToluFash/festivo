import { type ListedEvent, realtimeTopic } from '@soirely/api-client';
import { withFiguresFrom } from '@soirely/domain';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';

/** As Events reads its figures again (sc-3786), so a reply shows within ten seconds with no line open. */
export const FIGURES_AGAIN_MS = 10_000;

type Events = readonly ListedEvent[];

/** A reply moves its event's line on Today in place (sc-29881): only the figures are read again, merged into the list. */
export function followTodayFigures(
  organisationId: string,
  ids: readonly string[],
  update: (merge: (events: Events) => Events) => void,
): () => void {
  let live = true;
  const readFigures = () =>
    api.unfinishedEvents(organisationId).then(
      (read) => {
        if (live) update((events) => withFiguresFrom(events, read));
      },
      () => undefined,
    );
  const stop = followReadingAgain(
    ids.map((id) => realtimeTopic('EventHeadcount', id)),
    () => api.headcountsSubscription(organisationId, ids),
    () => void readFigures(),
    FIGURES_AGAIN_MS,
  );

  return () => {
    live = false;
    stop();
  };
}
