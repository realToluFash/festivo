import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Field, RowWords, TextAction } from '../components/SettingsParts.tsx';
import {
  Amount,
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
  ceilingsFor,
  linesFor,
  whatIf,
} from './decide.ts';
import { DECIDE_WORDS as W } from './decideWords.ts';
import { GW } from './guestsWords.ts';
import { type SampleEvent } from './events.ts';
import { ColumnHead, Verb } from './GuestForms.tsx';
import { OkLine, Pill } from './GuestsParts.tsx';
import './guests.css';
import './decide.css';

const UPDATE_MS = 900;

/** sc-86 in Guests' Add guest (sc-1468): the column beside the list at 380, the answer under Companions and above Add guest. */
export function DecidePage({ event, state }: { event: SampleEvent; state: string }) {
  const [params] = useSearchParams();
  const kind = decideKindOf(state, params.get('as'), params.get('fetch'));

  return (
    <BudgetShell event={event} area="guests" trail={[{ label: GW.title }]}>
      {() => <GuestsHead event={event} kind={kind} />}
    </BudgetShell>
  );
}

function GuestsHead({ event, kind }: { event: SampleEvent; kind: DecideKind }) {
  const [open, setOpen] = useState(true);
  const [round, setRound] = useState(0);
  const head = useRef<HTMLDivElement>(null);

  function done(): void {
    setOpen(false);
    head.current?.querySelector<HTMLButtonElement>('.bud-title-actions button')?.focus();
  }

  return (
    <div className="gs" ref={head}>
      <PageTitle title={GW.title}>
        <TextAction
          label={GW.addGuest}
          before="plus"
          onClick={() => {
            setRound((now) => now + 1);
            setOpen(true);
          }}
        />
      </PageTitle>
      <div className="gs-cols">
        <section className="gs-list" aria-label={GW.title}>
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
        </section>
        <section className="gs-column" aria-label={GW.addGuest}>
          {open && <AddGuest key={round} kind={kind} onDone={done} />}
        </section>
      </div>
    </div>
  );
}

interface Companion {
  key: number;
  name: string;
  typed: boolean;
}

/** As sc-1468's AddForm: Add guest keeps the column open, says who was added and clears the form; only Done closes it. */
function AddGuest({ kind, onDone }: { kind: DecideKind; onDone: () => void }) {
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
  const [said, setSaid] = useState<string | null>(null);
  const toAdded = useRef(false);
  const answer = whatIf(1 + companions.length, linesFor(kind), ceilingsFor(kind));

  useEffect(() => {
    first.current?.focus();
    return () => window.clearTimeout(timer.current);
  }, []);

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

  function add(): void {
    const who = name.trim();
    if (who !== '') {
      setSaid(GW.justAdded(who));
      setName('');
      changed([]);
    }
    first.current?.focus();
  }

  function remove(key: number): void {
    changed(companions.filter((one) => one.key !== key));
    adder.current?.querySelector('button')?.focus();
  }

  return (
    <div className="gs-form dec-form">
      <ColumnHead title={GW.addGuest}>
        <Verb label={GW.done} onClick={onDone} />
      </ColumnHead>
      {said != null && <OkLine>{said}</OkLine>}
      <Field label={GW.fullName} value={name} onChange={setName} inputRef={first} />
      <div className="dec-companions" role="group" aria-labelledby={companionsId}>
        <p id={companionsId} className="desk-label">
          {GW.companions}
        </p>
        <ul className="desk-rows bud-rows">
          {companions.map((one, index) => {
            const label = GW.companionName(index + 1, companions.length);
            const removal = (
              <button type="button" className="desk-text" onClick={() => remove(one.key)}>
                {GW.remove}
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
                    <RowWords title={one.name} lines={[GW.noReply]} />
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
      {kind !== 'none' && <AnswerPanel answer={answer} updating={updating} />}
      <Pill primary tall label={GW.addGuest} onClick={add} />
    </div>
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
          {answer.moved.length === 0 ? (
            <p className="dec-big">
              <MarkWord mark={<DashedMark />} word={W.notKnownIfAll} />
            </p>
          ) : (
            <p className="dec-big">
              <UpMark />
              {W.rise(headline(answer.delta))}
            </p>
          )}
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
          {answer.categoriesOver.map((one) => (
            <div key={one.name} className="dec-ceiling">
              <RingMark state="overIfAll" />
              <p>
                <span className="dec-ceiling-head">{W.overCategory(one.name)}</span>
                <span className="dec-ceiling-line">
                  {W.ifEveryone(whole(one.ifAll), whole(one.ceiling))}
                </span>
              </p>
            </div>
          ))}
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
