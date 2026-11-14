import { Glyph } from '../components/Glyph.tsx';
import { type Refusal, SW, pausedWaits, refusalLine } from './messagesScheduled.ts';
import './messagesScheduled.css';

/** A scheduled message's refused save (sc-3963): an alert above the composer, the red edge and the mark with the words, never colour alone. */
export function RefusedSave({ refusal, onReload }: { refusal: Refusal; onReload: () => void }) {
  return (
    <li className="mg-said is-host">
      <div className="mg-refused" role="alert" tabIndex={-1} data-focus="refused-save">
        <Glyph name="alert" size={18} weight={2.2} />
        <div className="mg-refused-words">
          <p className="mg-refused-head">{refusalLine(refusal)}</p>
          <p>{SW.textStillHere}</p>
          <button type="button" className="desk-text" onClick={onReload}>
            <Glyph name="refresh" size={17} weight={2.2} />
            {SW.reload}
          </button>
        </div>
      </div>
    </li>
  );
}

/** sc-3963: where "Goes …" was while the event is paused, the same line before the message's time and after it, two bars with the words. */
export function PausedLine() {
  return (
    <p className="mg-paused">
      <span className="mg-paused-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      {pausedWaits()}
    </p>
  );
}
