import { offButton } from '../offButton.ts';
import { type Answer, type View, type Visit, type Words, dayOf } from './guest.ts';
import { alreadyDown, carriesOn, warnsCompanions } from './guestLink.ts';
import { Filled, Mark, Notice } from './GuestParts.tsx';
import './guestLink.css';

/** sc-1291: the guest's page as an answer link opens it, the tapped answer chosen and nothing recorded until Confirm. */
export function LinkAnswer({
  visit,
  view,
  words,
  onAnswer,
  onChoose,
}: {
  visit: Visit;
  view: Extract<View, { kind: 'link' }>;
  words: Words;
  onAnswer: (answer: Answer) => void;
  onChoose: () => void;
}) {
  const { picked, busy } = view;
  const { recorded, lang } = visit;
  const same = alreadyDown(visit, picked);
  const earlier = recorded != null && recorded.by == null && !same ? recorded : null;

  return (
    <section className="gp-link" aria-labelledby="gp-link-h">
      {earlier != null && (
        <div className="gp-link-was">
          <Mark answer={earlier.answer} size={20} />
          <p>{words.answered(earlier.answer, dayOf(earlier.on, lang))}</p>
        </div>
      )}
      {same && recorded != null ? (
        <>
          <div className="gp-greet">
            <Mark answer={picked} />
            <h2 id="gp-link-h" className="gp-h2" tabIndex={-1} data-focus="linkHead">
              {words.already(picked)}
            </h2>
          </div>
          <p className="gp-sub gp-indent">{words.since(dayOf(recorded.on, lang))}</p>
        </>
      ) : (
        <>
          <h2 id="gp-link-h" className="gp-h2" tabIndex={-1} data-focus="linkHead">
            {words.confirmAnswer}
          </h2>
          <div className="gp-answer is-lit gp-link-picked">
            <span className="gp-lead">
              <Mark answer={picked} />
            </span>
            <span className="gp-answer-words">{words.choice(picked)}</span>
            <span className="gp-now">{words.fromMessage}</span>
          </div>
          {warnsCompanions(visit, picked) && (
            <Notice kind="attention">{words.companionsNotComing}</Notice>
          )}
          <Filled busy={busy} focus="linkGo" onClick={() => onAnswer(picked)}>
            {carriesOn(visit, picked) ? words.carryOn : words.confirm}
          </Filled>
        </>
      )}
      <button
        className="gp-outlined"
        type="button"
        data-focus="linkChoose"
        {...offButton(busy)}
        onClick={onChoose}
      >
        {words.chooseDifferent}
      </button>
    </section>
  );
}
