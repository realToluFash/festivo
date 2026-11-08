import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Field, RowWords, TextAction } from '../components/SettingsParts.tsx';
import {
  Amount,
  BudgetDialog,
  BudgetRow,
  BudgetShell,
  DashedMark,
  MarkWord,
  PageTitle,
  RingMark,
  Rows,
} from './BudgetParts.tsx';
import { money, whole } from './budget.ts';
import {
  type Answer,
  BACKDROP,
  COMPANIONS,
  type DecideKind,
  GUEST,
  decideKindOf,
  headline,
  linesFor,
  whatIf,
} from './decide.ts';
import { DECIDE_WORDS as W } from './decideWords.ts';
import { type SampleEvent } from './events.ts';
import './decide.css';

const UPDATE_MS = 900;

/** sc-86 in Guests' Add guest (sc-1468): the Guests page's head behind it, the answer beside the change. */
export function DecidePage({ event, state }: { event: SampleEvent; state: string }) {
  const [params] = useSearchParams();
  const kind = decideKindOf(state, params.get('as'), params.get('fetch'));

  return (
    <BudgetShell event={event} area="guests" trail={[{ label: W.guests }]}>
      {() => <GuestsHead event={event} kind={kind} />}
    </BudgetShell>
  );
}

function GuestsHead({ event, kind }: { event: SampleEvent; kind: DecideKind }) {
  const [open, setOpen] = useState(true);
  const [round, setRound] = useState(0);

  return (
    <>
      <PageTitle title={W.guests}>
        <TextAction
          label={W.addGuest}
          before="plus"
          onClick={() => {
            setRound((now) => now + 1);
            setOpen(true);
          }}
        />
      </PageTitle>
      <Rows>
        {BACKDROP.map((guest) => (
          <li key={guest.name}>
            <BudgetRow
              title={guest.name}
              lines={[guest.line]}
              to={`/demo/events/${event.id}?area=guests`}
            />
          </li>
        ))}
      </Rows>
      {open && <AddGuest key={round} kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

interface Companion {
  key: number;
  name: string;
  typed: boolean;
}

function AddGuest({ kind, onClose }: { kind: DecideKind; onClose: () => void }) {
  const first = useRef<HTMLInputElement>(null);
  const added = useRef<HTMLInputElement>(null);
  const adder = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const companionsId = useId();
  const [name, setName] = useState(GUEST);
  const [companions, setCompanions] = useState<readonly Companion[]>(() =>
    COMPANIONS.map((one, key) => ({ key, name: one, typed: false })),
  );
  const [updating, setUpdating] = useState(kind === 'updating');
  const toAdded = useRef(false);
  const answer = whatIf(1 + companions.length, linesFor(kind));

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!toAdded.current) return;
    toAdded.current = false;
    added.current?.focus();
  }, [companions]);

  function changed(next: readonly Companion[]): void {
    setCompanions(next);
    if (kind === 'none') return;
    setUpdating(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUpdating(false), UPDATE_MS);
  }

  function remove(key: number): void {
    changed(companions.filter((one) => one.key !== key));
    adder.current?.querySelector('button')?.focus();
  }

  return (
    <BudgetDialog
      width={762}
      title={W.addGuest}
      verb={W.addGuest}
      first={first}
      onDismiss={onClose}
      onConfirm={onClose}
    >
      <div className="dec-cols">
        <div className="dec-form">
          <Field label={W.name} value={name} onChange={setName} inputRef={first} />
          <div className="dec-companions" role="group" aria-labelledby={companionsId}>
            <p id={companionsId} className="desk-label">
              {W.companions}
            </p>
            <ul className="desk-rows bud-rows">
              {companions.map((one, index) => {
                const label = W.companionName(index + 1, companions.length);
                const removal = (
                  <button type="button" className="desk-text" onClick={() => remove(one.key)}>
                    {W.remove}
                    <span className="desk-unseen"> {one.name === '' ? label : one.name}</span>
                  </button>
                );

                return (
                  <li key={one.key}>
                    {one.typed ? (
                      <Field
                        label={label}
                        value={one.name}
                        {...(index === companions.length - 1 ? { inputRef: added } : {})}
                        action={removal}
                        onChange={(typed) =>
                          setCompanions((now) =>
                            now.map((other) =>
                              other.key === one.key ? { ...other, name: typed } : other,
                            ),
                          )
                        }
                      />
                    ) : (
                      <div className="desk-row bud-row">
                        <RowWords title={one.name} lines={[W.noReply]} />
                        {removal}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div ref={adder}>
              <TextAction
                label={W.addCompanion}
                before="plus"
                onClick={() => {
                  const key = Math.max(-1, ...companions.map((one) => one.key)) + 1;
                  changed([...companions, { key, name: '', typed: true }]);
                  toAdded.current = true;
                }}
              />
            </div>
          </div>
        </div>
        <div className="dec-side">
          {kind !== 'none' && <AnswerPanel answer={answer} updating={updating} />}
        </div>
      </div>
    </BudgetDialog>
  );
}

/** A status message (WCAG 2.2 SC 4.1.3): the new answer is announced once it arrives; updating is not. */
function AnswerPanel({ answer, updating }: { answer: Answer; updating: boolean }) {
  const id = useId();
  const still = answer.moved.length === 0 && answer.unknown.length === 0;

  return (
    <section className="dec-answer" role="status" aria-busy={updating} aria-labelledby={id}>
      <h3 id={id} className="dec-head">
        {W.head}
      </h3>
      {updating ? (
        <div className="dec-bones" aria-hidden="true">
          <span className="dec-bone is-big" />
          <span className="dec-bone" />
          <span className="dec-bone is-short" />
        </div>
      ) : still ? (
        <>
          <p className="dec-big">{W.noChange}</p>
          <p className="dec-line">{W.nothingPerGuest}</p>
        </>
      ) : (
        <>
          <p className="dec-big">
            <UpMark />
            {W.rise(headline(answer.delta))}
          </p>
          {answer.unknown.length > 0 ? (
            <p className="dec-line is-strong">{W.fullNotKnown(answer.unknown.length)}</p>
          ) : (
            <p className="dec-line">{W.upperOnly(whole(answer.ifAll), whole(answer.settled))}</p>
          )}
          <Rows>
            {answer.moved.map((one) => (
              <li key={one.name}>
                <BudgetRow
                  title={one.name}
                  lines={[
                    W.moved(money(one.from), money(one.to), answer.headsFrom, answer.headsTo),
                  ]}
                  end={<Amount value={W.plus(money(one.delta))} />}
                />
              </li>
            ))}
            {answer.unknown.map((one) => (
              <li key={one}>
                <BudgetRow
                  title={one}
                  lines={[W.notPricedYet]}
                  end={<MarkWord mark={<DashedMark />} word={W.notKnown} />}
                />
              </li>
            ))}
          </Rows>
          {answer.overCeiling && answer.ceiling != null && (
            <div className="dec-ceiling">
              <RingMark state="overIfAll" />
              <p>
                <span className="dec-ceiling-head">{W.overCeiling}</span>
                <span className="dec-ceiling-line">
                  {W.ifEveryone(whole(answer.ifAll), whole(answer.ceiling))}
                </span>
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** An up arrow, drawn here as the board draws it: the product's icon set has none. */
function UpMark() {
  return (
    <svg
      className="dec-up"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}
