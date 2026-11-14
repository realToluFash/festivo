import { Glyph } from './Glyph.tsx';
import './SignInRulesParts.css';

export type Mark = 'met' | 'needs' | 'notApplicable';

/** Met is the green tick, needs you the amber half disc, and doesn't apply a grey disc with a bar. */
export function RuleMark({ mark }: { mark: Mark }) {
  return (
    <span
      className={`signin-mark is-${mark === 'notApplicable' ? 'not-applicable' : mark}`}
      aria-hidden="true"
    >
      {mark === 'met' && <Glyph name="tick" size={13} weight={3.2} />}
      {mark === 'notApplicable' && <span />}
    </span>
  );
}

/** The page's bones while the rules load: the card, then three rows. */
export function RulesBones({ words }: { words: string }) {
  return (
    <div className="desk-loading" role="status" aria-label={words}>
      <span className="desk-unseen">{words}</span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows signin-rows" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk signin-mark" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
