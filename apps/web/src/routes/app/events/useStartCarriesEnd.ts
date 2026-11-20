import { type EventDraft, draftLength, endMovedLine, startMoved } from '@soirely/domain';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../../../i18n/index.ts';

type Start = Partial<Pick<EventDraft, 'startDate' | 'startTime'>>;
type End = Partial<Pick<EventDraft, 'endDate' | 'endTime'>>;

/** The start and end fields of New event and Edit details: a moved start carries the end, holding its length through a start cleared and typed again, until the host touches the end. */
export function useStartCarriesEnd({
  draft,
  endChosen,
  timeZone,
  edit,
  say,
}: {
  draft: EventDraft;
  endChosen: boolean;
  timeZone: string;
  edit: (field: 'startsAt' | 'endsAt', change: Partial<EventDraft>) => void;
  say: (line: string) => void;
}): { moveStart: (start: Start) => void; moveEnd: (end: End) => void } {
  const { t } = useTranslation();
  const heldLength = useRef<number | null>(null);

  function moveStart(start: Start): void {
    const length = draftLength(draft, timeZone) ?? heldLength.current;
    const moved = startMoved(draft, start, endChosen, timeZone, length);
    const line = endMovedLine(draft, moved, dateLocale(), t);

    heldLength.current = length;
    edit('startsAt', moved);
    if (line != null) say(line);
  }

  function moveEnd(end: End): void {
    heldLength.current = null;
    edit('endsAt', end);
  }

  return { moveStart, moveEnd };
}
