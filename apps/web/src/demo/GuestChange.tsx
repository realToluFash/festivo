import { Glyph } from '../components/Glyph.tsx';
import { EVENT, type HostNote, type Visit, type Words, eventTime, timeIn } from './guest.ts';
import { CHANGE_WAS, type ChangeLine } from './guestChange.ts';

function lineOf(line: ChangeLine, visit: Visit, words: Words): string {
  if (line === 'calledOff') return words.changeLine(line, { event: EVENT.name });
  if (line === 'venue') {
    return words.changeLine(line, { new: EVENT.venue?.name ?? '', old: CHANGE_WAS.venue });
  }

  return words.changeLine(line, {
    new: eventTime(visit.lang),
    old: timeIn(CHANGE_WAS.start, visit.lang, EVENT.timeZone),
  });
}

/** sc-4330: Soirely's prepared lines above a change's note, as this guest was sent them, in the page's language. */
export function ChangeLines({
  note,
  visit,
  words,
}: {
  note: HostNote;
  visit: Visit;
  words: Words;
}) {
  if (note.lines.length === 0) return null;

  return (
    <div className="gp-change">
      <Glyph name="clock" size={16} weight={2.2} />
      <div className="gp-change-lines">
        {note.lines.map((line) => (
          <p key={line}>{lineOf(line, visit, words)}</p>
        ))}
      </div>
    </div>
  );
}
