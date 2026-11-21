import { Glyph } from '../components/Glyph.tsx';
import { type Visit, dayOf } from './guest.ts';
import { type AskKey, ASK_WORDS, askDay, askShown, offer } from './guestAsk.ts';
import { askClock, askFocus } from './guestAskStates.ts';
import { Filled, Notice } from './GuestParts.tsx';
import './guestAsk.css';

/** sc-1363: under an answered Not sure yet, when to ask again, or what was saved; nothing when there is nothing to show. */
export function GuestAsk({
  visit,
  onPick,
  onSave,
}: {
  visit: Visit;
  onPick: (key: AskKey) => void;
  onSave: () => void;
}) {
  const { ask, lang } = visit;
  const clock = askClock(visit);

  if (ask == null || !askShown(ask, clock)) return null;
  const words = ASK_WORDS[lang];

  switch (ask.kind) {
    case 'question': {
      const empty = ask.error === 'empty';

      return (
        <div className="gp-again">
          {ask.moved && (
            <Notice kind="attention" alert>
              {words.moved}
            </Notice>
          )}
          <fieldset
            className="gp-again-group"
            aria-invalid={empty || undefined}
            aria-describedby={empty ? 'gp-again-empty' : undefined}
          >
            <legend className="gp-h2 gp-again-legend">{words.q}</legend>
            <div className="gp-again-error" role="alert" id="gp-again-empty">
              {empty && (
                <>
                  <span className="gp-again-error-mark" aria-hidden="true">
                    <Glyph name="clear" size={12} weight={3} />
                  </span>
                  <span>{words.empty}</span>
                </>
              )}
            </div>
            {offer(clock).map((key) => {
              const day = key === 'never' ? null : askDay(key, clock);
              const on = ask.pick === key;

              return (
                <label
                  key={key}
                  className={`gp-again-row${on ? ' is-on' : ''}${empty ? ' is-invalid' : ''}`}
                >
                  <input
                    className="desk-radio"
                    type="radio"
                    name="gp-again"
                    checked={on}
                    data-focus={askFocus(key)}
                    onChange={() => onPick(key)}
                  />
                  <span className="gp-again-words">
                    <span className="gp-again-name">{words[key]}</span>
                    {day != null && <span className="gp-sub">{dayOf(day, lang)}</span>}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {ask.error === 'net' && <Notice kind="broken">{words.net}</Notice>}
          <Filled focus="askSave" busy={ask.saving} onClick={onSave}>
            {words.save}
          </Filled>
        </div>
      );
    }
    case 'saved':
    case 'wont':
      return (
        <div className="gp-again">
          <p
            className="gp-again-saved"
            role={ask.live ? 'status' : undefined}
            tabIndex={ask.live ? -1 : undefined}
            data-focus="askSaved"
          >
            <span className="gp-again-saved-mark" aria-hidden="true">
              <Glyph name="tick" size={14} weight={3} />
            </span>
            <span>
              {ask.kind === 'wont'
                ? words.wont
                : words.saved.replace('{{date}}', dayOf(ask.day, lang))}
            </span>
          </p>
        </div>
      );
    case 'closeNow':
      return (
        <div className="gp-again">
          <div className="gp-notice is-attention" tabIndex={-1} data-focus="askClose">
            <span className="gp-notice-mark" aria-hidden="true" />
            <p>{clock.replyBy == null ? words.close : words.closeReplyBy}</p>
          </div>
        </div>
      );
    case 'none':
      return null;
  }
}
