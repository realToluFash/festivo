import { Glyph } from './Glyph.tsx';
import { TextAction } from './SettingsParts.tsx';
import './PersonalisationParts.css';

/** Personalisation's first read: the card sunk, with three bars under it. */
export function PersonalisationLoading({ words }: { words: string }) {
  return (
    <div className="desk-loading" role="status" aria-label={words}>
      <span className="desk-unseen">{words}</span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <span className="pers-bones" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span key={bar} className={`desk-sunk pers-bone b${bar}`} />
        ))}
      </span>
    </div>
  );
}

/** Personalisation that did not load: why as a heading, the line, and Try again. */
export function PersonalisationFailed({
  title,
  line,
  retry,
  onRetry,
}: {
  title: string;
  line: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div className="desk-failed" role="alert">
      <h2>{title}</h2>
      <p className="desk-line">{line}</p>
      <TextAction label={retry} onClick={onRetry} />
    </div>
  );
}

/** A pick Colours could not save: the line with its alert mark, and Try again. */
export function NotSaved({
  words,
  retry,
  onRetry,
}: {
  words: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div className="pers-failed">
      <p className="desk-error" role="alert">
        <Glyph name="alert" size={15} weight={2.2} />
        {words}
      </p>
      <TextAction label={retry} onClick={onRetry} />
    </div>
  );
}

/** The green mark with its tick, before the card's "saved" line. */
export function SavedMark() {
  return (
    <span className="desk-mark is-yes pers-mark" aria-hidden="true">
      <Glyph name="tick" size={11} weight={3.4} />
    </span>
  );
}
