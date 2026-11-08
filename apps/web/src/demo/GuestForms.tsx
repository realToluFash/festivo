import { type ReactNode, useEffect, useId, useState } from 'react';

import { offButton } from '../offButton.ts';
import { Glyph } from '../components/Glyph.tsx';
import { Ask } from '../components/SettingsParts.tsx';
import {
  ANSWERS,
  type AddStart,
  type Answer,
  type EditStart,
  type Guest,
  type Lines,
  MOST_COMPANIONS,
  type RecordStart,
  type Seated,
  THEIRS,
  type Values,
  dayOf,
  linesOf,
  phoneShown,
  sameName,
  seatedOf,
  valuesOf,
} from './guests.ts';
import {
  Amber,
  GuestField,
  LanguageField,
  OkLine,
  Pair,
  PhoneField,
  Pill,
  Refused,
  ReplyMark,
} from './GuestsParts.tsx';
import { GW, HOW_TOLD, type HowTold, REPLY_WORDS } from './guestsWords.ts';
import { useLater } from '../useLater.ts';

const SAVE_MS = 900;
const SHOWN_COMPANIONS = 3;

/** Where a refusal sends the focus: the first field that failed, in the form's order. */
function firstFailing(lines: Lines): string | null {
  if (lines.name != null) return 'name';
  if (lines.email != null) return 'email';
  if (lines.number != null) return 'number';

  return null;
}

/** The guest's column becomes the form, Cancel and Save at its head (Events A's rule at a desk). */
function ColumnHead({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="gs-col-head">
      <h2 className="gs-col-title" tabIndex={-1} data-focus="form-heading">
        {title}
      </h2>
      <div className="gs-col-actions">{children}</div>
    </div>
  );
}

function Verb({
  label,
  busy = false,
  held = false,
  onClick,
}: {
  label: string;
  busy?: boolean;
  held?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={held ? 'desk-text is-held' : 'desk-text'}
      aria-busy={busy || undefined}
      {...offButton(held || busy, { dim: false })}
      onClick={onClick}
    >
      {busy ? GW.saving : label}
    </button>
  );
}

/** One companion out of the form; a seated one is asked about first (sc-3773). */
function removeCompanion(values: Values, at: number): Partial<Values> {
  return { companions: values.companions.filter((_, index) => index !== at) };
}

/** sc-1468's places, each named or not, removed at once while nothing is seated (sc-3773). */
function CompanionFields({
  host,
  values,
  said,
  onChange,
  onSaid,
  onAsk,
  seated,
  focus,
}: {
  host: string;
  values: Values;
  said: string | null;
  onChange: (next: Partial<Values>) => void;
  onSaid: (said: string) => void;
  onAsk?: (at: number, name: string, seat: Seated) => void;
  seated?: (id: string | null) => Seated | null;
  focus: (...keys: string[]) => void;
}) {
  const id = useId();
  const count = values.companions.length;
  const placeholder = (at: number) =>
    host === '' ? '' : at === 0 ? GW.guestOf(host) : GW.guestOfNth(host, at + 1);
  const seen = (at: number) => at < SHOWN_COMPANIONS || values.companions[at]?.id == null;
  const unseen = values.companions.filter((_, at) => !seen(at)).length;

  return (
    <fieldset className="gs-fieldset gs-companions">
      <legend className="gs-legend">{GW.companions}</legend>
      <p className="gs-count" id={`${id}-count`}>
        {count === 0 ? GW.noneYet(MOST_COMPANIONS) : GW.ofMost(count, MOST_COMPANIONS)}
      </p>
      {values.companions.map((companion, at) => {
        if (!seen(at)) return null;
        const shown =
          companion.name.trim() !== ''
            ? companion.name.trim()
            : placeholder(at) === ''
              ? GW.companionName(at + 1, count)
              : placeholder(at);

        return (
          <div key={at} className="gs-companion">
            <div className="desk-box">
              <input
                type="text"
                value={companion.name}
                placeholder={placeholder(at)}
                spellCheck={false}
                data-focus={`companion-${at}`}
                aria-label={GW.companionName(at + 1, count)}
                onChange={(event) =>
                  onChange({
                    companions: values.companions.map((each, index) =>
                      index === at ? { ...each, name: event.target.value } : each,
                    ),
                  })
                }
              />
            </div>
            <button
              type="button"
              className="desk-text gs-remove"
              aria-label={GW.removeNamed(shown)}
              onClick={() => {
                const seat = seated?.(companion.id) ?? null;

                if (seat != null && onAsk != null) {
                  onAsk(at, shown, seat);
                  return;
                }
                onChange(removeCompanion(values, at));
                onSaid(GW.removed(shown));
                focus(`companion-${at}`, `companion-${at - 1}`, 'add-companion');
              }}
            >
              {GW.remove}
            </button>
          </div>
        );
      })}
      {unseen > 0 && <p className="gs-count">{GW.moreCompanions(unseen)}</p>}
      {said != null && <OkLine>{said}</OkLine>}
      {count < MOST_COMPANIONS ? (
        <button
          type="button"
          className="desk-text"
          data-focus="add-companion"
          onClick={() => {
            onChange({ companions: [...values.companions, { id: null, name: '' }] });
            focus(`companion-${count}`);
          }}
        >
          <Glyph name="plus" size={17} weight={2.3} />
          {GW.addCompanion}
        </button>
      ) : (
        <p className="gs-most">{GW.mostCompanions(MOST_COMPANIONS)}</p>
      )}
    </fieldset>
  );
}

/** Edit (sc-3773), in place in the guest's column: refused before sending, a duplicate asked about, a colleague's change (412) held at the top. */
export function EditForm({
  guest,
  list,
  start,
  focus,
  onDirty,
  onCancel,
  onSave,
}: {
  guest: Guest;
  list: readonly Guest[];
  start: EditStart;
  focus: (...keys: string[]) => void;
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (values: Values) => void;
}) {
  const later = useLater();
  const [base] = useState(() => valuesOf(guest));
  const [values, setValues] = useState<Values>(() => ({ ...base, ...start.values }));
  const [tried, setTried] = useState(start.tried ?? false);
  const [duplicate, setDuplicate] = useState<'asked' | 'kept' | null>(
    start.duplicate === true ? 'asked' : null,
  );
  const [conflict, setConflict] = useState(start.conflict ?? false);
  const [failed, setFailed] = useState(start.notSaved ?? false);
  const [said, setSaid] = useState<string | null>(
    start.removed == null ? null : GW.removed(start.removed),
  );
  const [removing, setRemoving] = useState<{ at: number; name: string; seat: Seated } | null>(
    () => {
      const at = values.companions.findIndex((one) => one.id === start.removing);
      const seat = seatedOf(guest, start.removing ?? null);
      const name = values.companions[at]?.name ?? '';

      return at < 0 || seat == null ? null : { at, name, seat };
    },
  );
  const [busy, setBusy] = useState(false);
  const lines = tried ? linesOf(values) : {};
  const dirty = JSON.stringify(values) !== JSON.stringify(base) || start.removed != null;

  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  function change(next: Partial<Values>): void {
    setValues((was) => ({ ...was, ...next }));
    if (next.name != null && duplicate === 'asked') setDuplicate(null);
  }

  function save(): void {
    if (busy || conflict) return;
    const found = linesOf(values);
    const first = firstFailing(found);

    if (first != null) {
      setTried(true);
      focus(first);
      return;
    }
    if (duplicate !== 'kept' && sameName(list, values.name, guest.id) != null) {
      setDuplicate('asked');
      focus('duplicate');
      return;
    }
    setFailed(false);
    setBusy(true);
    later(SAVE_MS, () => onSave(values));
  }

  return (
    <div className="gs-form">
      <ColumnHead title={GW.editGuest}>
        <Verb label={GW.cancel} onClick={onCancel} />
        <Verb label={GW.save} busy={busy} held={conflict} onClick={save} />
      </ColumnHead>
      {failed && <Refused>{GW.notSaved}</Refused>}
      {conflict && (
        <Amber title={GW.conflict} focusKey="conflict">
          <dl className="gs-differ">
            {[
              [GW.emailAddress, THEIRS.email, values.email],
              [GW.mobileNumber, `+44 ${THEIRS.number}`, phoneShown(values)],
            ].map(([label, theirs, yours]) => (
              <div key={label} className="gs-differ-field">
                <dt>{label}</dt>
                <dd>
                  <span className="gs-who">{GW.theirs}</span>
                  {theirs}
                </dd>
                <dd>
                  <span className="gs-who">{GW.yours}</span>
                  {yours}
                </dd>
              </div>
            ))}
          </dl>
          <p className="gs-amber-line">{GW.conflictLine}</p>
          <Pair>
            <Pill
              label={GW.useTheirs}
              onClick={() => {
                change({ email: THEIRS.email, number: THEIRS.number });
                setConflict(false);
                focus('email');
              }}
            />
            <Pill
              label={GW.keepMine}
              onClick={() => {
                setConflict(false);
                focus('name');
              }}
            />
          </Pair>
        </Amber>
      )}
      {duplicate === 'asked' && (
        <Amber title={GW.duplicate(values.name.trim())} focusKey="duplicate">
          <p className="gs-amber-line">{GW.duplicateLine}</p>
          <Pair>
            <Pill
              label={GW.saveAnyway}
              onClick={() => {
                setDuplicate('kept');
                setBusy(true);
                later(SAVE_MS, () => onSave(values));
              }}
            />
            <Pill
              label={GW.changeName}
              onClick={() => {
                setDuplicate(null);
                focus('name');
              }}
            />
          </Pair>
        </Amber>
      )}
      <div className="desk-fields gs-fields">
        <GuestField
          label={GW.fullName}
          value={values.name}
          error={lines.name}
          focusKey="name"
          autoComplete="off"
          onChange={(name) => change({ name })}
        />
        <GuestField
          label={GW.emailAddress}
          value={values.email}
          optional
          type="email"
          error={lines.email}
          focusKey="email"
          autoComplete="off"
          onChange={(email) => change({ email })}
        />
        <PhoneField values={values} error={lines.number} help={GW.keepsLink} onChange={change} />
        <LanguageField
          value={values.language}
          chose={guest.chose}
          onChange={(language) => change({ language })}
        />
        <CompanionFields
          host={values.name.trim() === '' ? guest.name : values.name.trim()}
          values={values}
          said={said}
          onChange={change}
          onSaid={setSaid}
          onAsk={(at, name, seat) => setRemoving({ at, name, seat })}
          seated={(id) => seatedOf(guest, id)}
          focus={focus}
        />
      </div>
      {removing != null && (
        <Ask
          title={GW.removeTitle(removing.name)}
          line={GW.seatedLine(removing.name, removing.seat.table, removing.seat.meal)}
          keep={GW.cancel}
          go={GW.remove}
          onKeep={() => setRemoving(null)}
          onGo={() => {
            const { at, name } = removing;

            setRemoving(null);
            change(removeCompanion(values, at));
            setSaid(GW.removed(name));
            focus(`companion-${at}`, `companion-${at - 1}`, 'add-companion');
          }}
        />
      )}
    </div>
  );
}

/** Record a reply (sc-3787), in place: the guest's own three answers, how they told you, who comes with them; nothing chosen when it opens. */
export function RecordForm({
  guest,
  start,
  focus,
  onDirty,
  onCancel,
  onSave,
}: {
  guest: Guest;
  start: RecordStart;
  focus: (...keys: string[]) => void;
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (answer: Answer, how: HowTold, ticked: ReadonlySet<string>) => void;
}) {
  const id = useId();
  const later = useLater();
  const [answer, setAnswer] = useState<Answer | null>(start.answer ?? null);
  const [how, setHow] = useState<HowTold | null>(start.how ?? null);
  const [tried, setTried] = useState(start.tried ?? false);
  const [replace, setReplace] = useState<'asked' | 'kept' | null>(
    start.replace === true ? 'asked' : null,
  );
  const [failed, setFailed] = useState(start.notSaved ?? false);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(guest.companions.map((companion) => companion.id)),
  );
  const [busy, setBusy] = useState(false);
  const ownReply =
    guest.recorded == null &&
    guest.replied != null &&
    (guest.reply === 'coming' || guest.reply === 'notSure' || guest.reply === 'notComing');
  const noAnswer = tried && answer == null;
  const noHow = tried && how == null;

  useEffect(() => onDirty(answer != null || how != null), [answer, how, onDirty]);

  function commit(chosen: Answer, told: HowTold): void {
    setFailed(false);
    setBusy(true);
    later(SAVE_MS, () => onSave(chosen, told, ticked));
  }

  function save(): void {
    if (busy) return;
    if (answer == null || how == null) {
      setTried(true);
      focus(answer == null ? 'answer-coming' : 'how-0');
      return;
    }
    if (ownReply && replace !== 'kept') {
      setReplace('asked');
      focus('replace-heading');
      return;
    }
    commit(answer, how);
  }

  return (
    <div className="gs-form">
      <ColumnHead title={GW.recordReply}>
        <Verb label={GW.cancel} onClick={onCancel} />
        <Verb label={GW.save} busy={busy} onClick={save} />
      </ColumnHead>
      {failed && <Refused>{GW.notSaved}</Refused>}
      {replace === 'asked' && ownReply && (
        <Amber
          title={GW.replaceAsk(guest.name, REPLY_WORDS[guest.reply], dayOf(guest.replied ?? ''))}
          focusKey="replace-heading"
        >
          <p className="gs-amber-line">{GW.replaceAskLine}</p>
          <Pair>
            <Pill
              primary
              label={GW.replaceTheirs}
              onClick={() => {
                setReplace('kept');
                if (answer != null && how != null) commit(answer, how);
                else focus('answer-coming');
              }}
            />
            <Pill label={GW.keepTheirs} onClick={onCancel} />
          </Pair>
        </Amber>
      )}
      <p className="desk-line">{GW.forName(guest.name)}</p>
      <fieldset
        className="gs-fieldset"
        aria-describedby={noAnswer ? `${id}-answer-error` : undefined}
      >
        <legend className="gs-legend">{GW.theirReply}</legend>
        <div className="gs-answers">
          {ANSWERS.map((one) => (
            <label
              key={one}
              className={['gs-answer', answer === one && 'is-lit', noAnswer && 'is-wrong']
                .filter(Boolean)
                .join(' ')}
            >
              <span className="gs-answer-lead">
                <ReplyMark reply={one} size={28} />
              </span>
              <span className="gs-answer-word">{REPLY_WORDS[one]}</span>
              <input
                type="radio"
                className="desk-radio gs-radio"
                name={`${id}-answer`}
                checked={answer === one}
                data-focus={`answer-${one}`}
                onChange={() => setAnswer(one)}
              />
            </label>
          ))}
        </div>
        {noAnswer && (
          <p id={`${id}-answer-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {GW.chooseReply}
          </p>
        )}
      </fieldset>
      <fieldset className="gs-fieldset" aria-describedby={noHow ? `${id}-how-error` : undefined}>
        <legend className="gs-legend">{GW.howTold}</legend>
        <div className="gs-chips">
          {HOW_TOLD.map((one, at) => (
            <label
              key={one}
              className={['gs-chip', how === one && 'is-on', noHow && 'is-wrong']
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                className="gs-chip-input"
                name={`${id}-how`}
                checked={how === one}
                data-focus={`how-${at}`}
                onChange={() => setHow(one)}
              />
              {how === one && <Glyph name="tick" size={15} weight={2.8} />}
              {one}
            </label>
          ))}
        </div>
        {noHow && (
          <p id={`${id}-how-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {GW.chooseHow}
          </p>
        )}
      </fieldset>
      {answer === 'coming' && guest.companions.length > 0 && (
        <fieldset className="gs-fieldset">
          <legend className="gs-legend">{GW.whoComing}</legend>
          <p className="desk-note">{GW.places(guest.companions.length, ticked.size)}</p>
          {guest.companions.map((companion, at) => (
            <label key={companion.id} className="gs-tick">
              <input
                type="checkbox"
                className="gs-box"
                checked={ticked.has(companion.id)}
                onChange={() =>
                  setTicked((was) => {
                    const next = new Set(was);

                    if (next.has(companion.id)) next.delete(companion.id);
                    else next.add(companion.id);

                    return next;
                  })
                }
              />
              {companion.name ??
                (at === 0 ? GW.guestOf(guest.name) : GW.guestOfNth(guest.name, at + 1))}
            </label>
          ))}
        </fieldset>
      )}
      <p className="desk-note">{GW.recordFoot(guest.name)}</p>
    </div>
  );
}

/** Add guest (sc-1468), in place: it stays open after each guest, the form cleared and focus back on Full name. */
export function AddForm({
  list,
  start,
  focus,
  onDone,
  onAdd,
}: {
  list: readonly Guest[];
  start: AddStart;
  focus: (...keys: string[]) => void;
  onDone: () => void;
  onAdd: (values: Values) => void;
}) {
  const [values, setValues] = useState<Values>(() => ({ ...valuesOf(null), ...start.values }));
  const [tried, setTried] = useState(start.tried ?? false);
  const [duplicate, setDuplicate] = useState(start.duplicate ?? false);
  const [failed, setFailed] = useState(start.notAdded ?? false);
  const [said, setSaid] = useState<string | null>(
    start.added == null ? null : GW.justAdded(start.added),
  );
  const [companionSaid, setCompanionSaid] = useState<string | null>(null);
  const lines = tried ? linesOf(values) : {};

  function change(next: Partial<Values>): void {
    setValues((was) => ({ ...was, ...next }));
    if (next.name != null) setDuplicate(false);
  }

  function add(kept = false): void {
    const first = firstFailing(linesOf(values));

    if (first != null) {
      setTried(true);
      focus(first);
      return;
    }
    if (!kept && sameName(list, values.name, null) != null) {
      setDuplicate(true);
      focus('duplicate');
      return;
    }
    onAdd(values);
    setSaid(GW.justAdded(values.name.trim()));
    setValues(valuesOf(null));
    setTried(false);
    setDuplicate(false);
    setFailed(false);
    setCompanionSaid(null);
    focus('name');
  }

  return (
    <div className="gs-form">
      <ColumnHead title={GW.addGuest}>
        <Verb label={GW.done} onClick={onDone} />
      </ColumnHead>
      {said != null && <OkLine>{said}</OkLine>}
      {failed && <Refused>{GW.notAdded}</Refused>}
      <div className="desk-fields gs-fields">
        <GuestField
          label={GW.fullName}
          value={values.name}
          error={lines.name}
          focusKey="name"
          autoComplete="off"
          onChange={(name) => change({ name })}
        />
        <GuestField
          label={GW.emailAddress}
          value={values.email}
          optional
          type="email"
          error={lines.email}
          focusKey="email"
          autoComplete="off"
          onChange={(email) => change({ email })}
        />
        <PhoneField values={values} error={lines.number} onChange={change} />
        <LanguageField
          value={values.language}
          chose={null}
          onChange={(language) => change({ language })}
        />
        {duplicate && (
          <Amber title={GW.duplicate(values.name.trim())} focusKey="duplicate">
            <Pair>
              <Pill primary label={GW.addAnyway} onClick={() => add(true)} />
              <Pill
                label={GW.cancel}
                onClick={() => {
                  setDuplicate(false);
                  focus('name');
                }}
              />
            </Pair>
          </Amber>
        )}
        <CompanionFields
          host={values.name.trim()}
          values={values}
          said={companionSaid}
          onChange={change}
          onSaid={setCompanionSaid}
          focus={focus}
        />
      </div>
      <Pill primary tall label={GW.addGuest} onClick={() => add()} />
    </div>
  );
}
