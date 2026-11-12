import { Glyph } from '../components/Glyph.tsx';
import { type Visit, dayOf } from './guest.ts';
import { type AskKey, askDate, askWords, asking, offer } from './guestAsk.ts';
import { Filled } from './GuestParts.tsx';
import './guestAsk.css';

/** sc-1363's question under the Not sure yet answer; nothing at all when there is nothing to show. */
export function AskAgain({
  visit,
  onPick,
  onSave,
}: {
  visit: Visit;
  onPick: (key: AskKey) => void;
  onSave: () => void;
}) {
  const ask = asking(visit);
  if (ask == null) return null;
  const Q = askWords(visit.lang);
  const keys = offer(ask.today, visit.replyBy);
  const empty = ask.error === 'empty';

  if (ask.view === 'saved' || ask.view === 'wont') {
    return (
      <p
        className="gp-again-saved"
        role={ask.live ? 'status' : undefined}
        tabIndex={-1}
        data-focus="againSaved"
      >
        <Glyph name="tick" size={16} weight={3} />
        <span>
          {ask.view === 'wont'
            ? Q.wont
            : Q.saved.replace('{date}', dayOf(ask.on ?? ask.today, visit.lang))}
        </span>
      </p>
    );
  }

  if (ask.view === 'closeNow') {
    return (
      <p className="gp-again-note" tabIndex={-1} data-focus="againClose">
        <span className="gp-again-i" aria-hidden="true">
          i
        </span>
        <span>{visit.replyBy == null ? Q.close : Q.closeReplyBy}</span>
      </p>
    );
  }

  if (ask.view !== 'question' || keys.length === 0) return null;

  return (
    <div className="gp-again">
      {ask.moved && (
        <p className="gp-again-note" role="alert">
          <span className="gp-again-i" aria-hidden="true">
            i
          </span>
          <span>{Q.moved}</span>
        </p>
      )}
      <fieldset
        className={empty ? 'gp-again-set is-wrong' : 'gp-again-set'}
        aria-invalid={empty || undefined}
        aria-describedby={empty ? 'gp-again-error' : undefined}
      >
        <legend className="gp-h2">{Q.q}</legend>
        <div role="alert">
          {empty && (
            <p id="gp-again-error" className="gp-again-error">
              <span className="gp-again-x" aria-hidden="true">
                <Glyph name="clear" size={12} weight={3} />
              </span>
              <span>{Q.empty}</span>
            </p>
          )}
        </div>
        {keys.map((key) => {
          const day = askDate(key, ask.today, visit.replyBy);

          return (
            <label key={key} className={ask.pick === key ? 'gp-again-row is-on' : 'gp-again-row'}>
              <input
                type="radio"
                name="gp-again"
                value={key}
                checked={ask.pick === key}
                data-focus={`again-${key}`}
                onChange={() => onPick(key)}
              />
              <span className="gp-again-words">
                <span className="gp-again-name">{Q[key]}</span>
                {day != null && <span className="gp-again-date">{dayOf(day, visit.lang)}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      {ask.error === 'net' && (
        <p className="gp-again-error is-boxed" role="alert">
          <span className="gp-again-x" aria-hidden="true">
            <Glyph name="clear" size={12} weight={3} />
          </span>
          <span>{Q.net}</span>
        </p>
      )}
      <Filled busy={ask.saving} focus="againSave" onClick={onSave}>
        {Q.save}
      </Filled>
    </div>
  );
}
