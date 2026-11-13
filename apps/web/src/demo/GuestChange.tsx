import { writtenTime } from './clock.ts';
import { EVENT, type Visit, type Words, eventTime, sentWhen, tagOf } from './guest.ts';
import { CHANGE_WAS, type ChangeLine, type ChangeSent } from './guestChange.ts';

function lineOf(line: ChangeLine, visit: Visit, words: Words): string {
  if (line === 'calledOff') return words.changeLine(line, { event: EVENT.name });
  if (line === 'venue') {
    return words.changeLine(line, { new: EVENT.venue?.name ?? '', old: CHANGE_WAS.venue });
  }

  return words.changeLine(line, {
    new: eventTime(visit.lang),
    old: writtenTime(CHANGE_WAS.startTime, tagOf(visit.lang)),
  });
}

/** sc-4330: Soirely's prepared lines as this guest was sent them, then the hosts' note as written, then when. */
export function ChangeEntry({
  change,
  visit,
  words,
}: {
  change: ChangeSent;
  visit: Visit;
  words: Words;
}) {
  return (
    <article id="change" className="gp-message gp-change" aria-labelledby="gp-change-from">
      <div className="gp-change-lines">
        {change.lines.map((line) => (
          <p key={line} className="gp-change-line">
            {lineOf(line, visit, words)}
          </p>
        ))}
      </div>
      <p id="gp-change-from" className="gp-meta gp-change-from">
        {words.noteFrom}
      </p>
      <p className="gp-bubble" dir="auto">
        {change.note}
      </p>
      <p className="gp-meta gp-change-at">{sentWhen(change.at, visit.lang, visit.readerZone)}</p>
    </article>
  );
}
