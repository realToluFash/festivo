import {
  CURRENCY_CODES,
  EVENT_TYPES,
  type EventType,
  callingCode,
  countryChoices,
} from '@soirely/domain';
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { Crumb, EditText, Quiet } from '../components/EventPageParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { TextAction, TitleRow } from '../components/SettingsParts.tsx';
import { offField } from '../offField.ts';
import { codeChoice } from '../phoneProblem.ts';
import { DemoBell } from './DemoBell.tsx';
import {
  BEST_WAYS,
  ENQUIRY_WORDS,
  type Enquiry,
  FOUND_VIA,
  PEOPLE,
  type Person,
  canSee,
} from './enquiries.ts';
import {
  type DuplicateSaid,
  type EnquiryTyped,
  type Field,
  type FormStart,
  type Problems,
  duplicateOf,
  duplicateSaid,
  firstFailing,
  formStart,
  formStateOf,
  lengthOf,
  problemsOf,
  savedEnquiry,
  typedOf,
} from './enquiryForm.ts';
import { LIST, pageStart, pageStateOf } from './enquiryPage.ts';
import {
  BEST_WAY_WORDS,
  FORM_WORDS as F,
  FOUND_VIA_WORDS,
  MIND_MOST,
  PAGE_WORDS as P,
} from './enquiryWords.ts';
import { useStore } from './enquiryStore.ts';
import { TYPE_WORDS } from './events.ts';

const SAVING_MS = 1200;
const COUNT_FROM = 4500;

/** New enquiry at /demo/enquiries/new: New event's crumb row and title over the form. */
export function NewEnquiry() {
  const [params] = useSearchParams();
  const store = useStore();
  const navigate = useNavigate();
  const state = formStateOf(params.get('state'));
  const start = formStart(state);

  return (
    <FormPage title={F.newTitle} back={LIST}>
      <EnquiryForm
        key={state}
        start={start}
        was={null}
        enquiries={store.enquiries}
        onSaved={(enquiry) => {
          store.put(enquiry);
          store.tell(F.saved);
          void navigate(
            `/demo/enquiries/${enquiry.id}${start.viewer.role === 'member' ? '?state=openMember' : ''}`,
          );
        }}
        onCancel={() => void navigate(LIST)}
      />
    </FormPage>
  );
}

/** Edit on an enquiry's page: the same form, filled, without What they have in mind, which is a note by then. */
export function EditEnquiry() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const store = useStore();
  const navigate = useNavigate();
  const page = pageStart(pageStateOf(params.get('state')));
  const viewer = page.viewer ?? store.start.viewer.person;
  const stored = store.enquiries.find((one) => one.id === id) ?? null;
  const was = stored != null && page.date != null ? { ...stored, date: page.date } : stored;
  const back = `/demo/enquiries/${id ?? ''}${params.size > 0 ? `?${params.toString()}` : ''}`;

  if (was == null || !canSee(was, viewer))
    return (
      <FormPage title={P.notFoundTitle} back={LIST}>
        <p className="desk-line">{P.notFoundLine}</p>
        <Link className="desk-text" to={LIST}>
          {P.backTo}
        </Link>
      </FormPage>
    );

  return (
    <FormPage title={F.editTitle} back={back} name={was.client}>
      <EnquiryForm
        start={{
          viewer,
          typed: typedOf(was),
          pressed: false,
          duplicate: null,
          offline: false,
          saving: false,
        }}
        was={was}
        enquiries={store.enquiries}
        onSaved={(enquiry) => {
          store.put(enquiry);
          store.tell(F.saved);
          void navigate(back);
        }}
        onCancel={() => void navigate(back)}
      />
    </FormPage>
  );
}

function FormPage({
  title,
  back,
  name = null,
  children,
}: {
  title: string;
  back: string;
  name?: string | null;
  children: ReactNode;
}) {
  const store = useStore();

  return (
    <div className="desk-page ev-page">
      <div className="ev-wide">
        <Crumb to={back} back={name ?? ENQUIRY_WORDS.enquiries} name={null}>
          <DemoBell tell={store.tell} />
        </Crumb>
        <TitleRow title={title} compact />
        {children}
      </div>
    </div>
  );
}

type Dupes = Record<'phone' | 'email', DuplicateSaid | null>;

const NO_DUPES: Dupes = { phone: null, email: null };

function said(
  enquiries: readonly Enquiry[],
  by: 'phone' | 'email',
  typed: EnquiryTyped,
  viewer: Person,
  except: string | null,
): DuplicateSaid | null {
  const match = duplicateOf(enquiries, by, typed, except);

  return match == null ? null : duplicateSaid(match, by, viewer);
}

/** Save stays enabled; pressed with a wrong value it sends nothing, says what is wrong on each field and moves focus to the first. */
export function EnquiryForm({
  start,
  was,
  enquiries,
  onSaved,
  onCancel,
}: {
  start: FormStart;
  was: Enquiry | null;
  enquiries: readonly Enquiry[];
  onSaved: (enquiry: Enquiry) => void;
  onCancel: () => void;
}) {
  const { viewer } = start;
  const savedDate = was?.date ?? null;
  const except = was?.id ?? null;
  const [typed, setTyped] = useState(start.typed);
  const [tried, setTried] = useState(start.pressed);
  const [shown, setShown] = useState<Problems>(() =>
    start.pressed ? problemsOf(start.typed, savedDate) : {},
  );
  const [dupes, setDupes] = useState<Dupes>(() =>
    start.duplicate == null
      ? NO_DUPES
      : { ...NO_DUPES, phone: said(enquiries, 'phone', start.typed, viewer, except) },
  );
  const [offline, setOffline] = useState(start.offline);
  const [saving, setSaving] = useState(start.saving);
  const [target, setTarget] = useState<{ field: Field } | null>(() => {
    const first = start.pressed ? firstFailing(problemsOf(start.typed, savedDate)) : null;

    return first == null ? null : { field: first };
  });
  const id = useId();
  const refs: Record<Field, RefObject<HTMLElement | null>> = {
    client: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    contact: useRef<HTMLInputElement>(null),
    mind: useRef<HTMLTextAreaElement>(null),
    date: useRef<HTMLInputElement>(null),
    guests: useRef<HTMLInputElement>(null),
    where: useRef<HTMLInputElement>(null),
    amount: useRef<HTMLInputElement>(null),
    currency: useRef<HTMLSelectElement>(null),
  };
  const refsNow = useRef(refs);
  const timer = useRef<number | null>(null);
  const editing = was != null;

  useEffect(() => {
    if (target == null) return;
    const field = target.field === 'contact' ? 'phone' : target.field;
    refsNow.current[field].current?.focus();
  }, [target]);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function change(next: Partial<EnquiryTyped>): void {
    if (saving) return;
    const after = { ...typed, ...next };
    setTyped(after);
    setShown((now) => {
      const all = problemsOf(after, savedDate);
      const kept: Problems = {};
      for (const field of Object.keys(now) as Field[]) {
        const problem = all[field];
        if (problem != null) kept[field] = problem;
      }

      return kept;
    });
    setDupes((now) => ({
      phone: now.phone == null ? null : said(enquiries, 'phone', after, viewer, except),
      email: now.email == null ? null : said(enquiries, 'email', after, viewer, except),
    }));
  }

  function leave(fields: readonly Field[], by?: 'phone' | 'email'): void {
    if (by != null)
      setDupes((now) => ({ ...now, [by]: said(enquiries, by, typed, viewer, except) }));
    if (!tried) return;
    const all = problemsOf(typed, savedDate);
    setShown((now) => {
      const next = { ...now };
      for (const field of fields) {
        const problem = all[field];
        if (problem == null) delete next[field];
        else next[field] = problem;
      }

      return next;
    });
  }

  function save(submit?: FormEvent): void {
    submit?.preventDefault();
    if (saving) return;
    setTried(true);
    const all = problemsOf(typed, savedDate);
    setShown(all);
    const first = firstFailing(all);
    if (first != null) {
      setTarget({ field: first });
      return;
    }
    setOffline(false);
    setSaving(true);
    timer.current = window.setTimeout(
      () => onSaved(savedEnquiry(typed, viewer, was, was?.id ?? `enq-new-${Date.now()}`)),
      SAVING_MS,
    );
  }

  const off = offField(saving);
  const contactWrong = shown.contact != null;
  const emailId = `${id}-email`;
  const told = (...ids: (string | false | null | undefined)[]) =>
    ids.filter(Boolean).join(' ') || undefined;

  return (
    <form className="ev-new-form enq-form" noValidate aria-busy={saving} onSubmit={save}>
      {offline && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p>{F.noConnection}</p>
            <button type="button" className="button" onClick={() => save()}>
              {F.tryAgain}
            </button>
          </div>
        </div>
      )}
      <div className="ev-new-fields">
        <EditText
          id={`${id}-client`}
          label={F.name}
          value={typed.client}
          error={shown.client ?? null}
          inputRef={refs.client as RefObject<HTMLInputElement | null>}
          input={{ ...off, autoComplete: 'off', onBlur: () => leave(['client']) }}
          onChange={(client) => change({ client })}
        />
        <PhoneField
          id={`${id}-phone`}
          typed={typed}
          error={shown.phone ?? null}
          wrong={contactWrong}
          describedBy={told(contactWrong && `${emailId}-error`, `${emailId}-help`)}
          busy={saving}
          inputRef={refs.phone as RefObject<HTMLInputElement | null>}
          onChange={change}
          onLeave={() => leave(['phone', 'contact'], 'phone')}
        />
        {dupes.phone != null && <Duplicate said={dupes.phone} />}
        <EditText
          id={emailId}
          label={F.email}
          value={typed.email}
          help={F.contactHint}
          error={shown.email ?? shown.contact ?? null}
          inputRef={refs.email as RefObject<HTMLInputElement | null>}
          input={{
            ...off,
            type: 'email',
            autoComplete: 'off',
            onBlur: () => leave(['email', 'contact'], 'email'),
          }}
          onChange={(email) => change({ email })}
        />
        {dupes.email != null && <Duplicate said={dupes.email} />}
        {!editing && (
          <MindField
            id={`${id}-mind`}
            value={typed.mind}
            error={shown.mind ?? null}
            busy={saving}
            areaRef={refs.mind as RefObject<HTMLTextAreaElement | null>}
            onChange={(mind) => change({ mind })}
            onLeave={() => leave(['mind'])}
          />
        )}
      </div>

      <section className="desk-block ev-new-block enq-about" aria-labelledby={`${id}-about`}>
        <div className="enq-divider">
          <h2 id={`${id}-about`}>{F.aboutHeading}</h2>
          <p className="desk-help">{F.aboutLine}</p>
        </div>
        <div className="ev-new-fields">
          <Chips
            legend={F.bestWay}
            choices={BEST_WAYS.map((one) => [one, BEST_WAY_WORDS[one]])}
            picked={typed.bestWay}
            busy={saving}
            onPick={(bestWay) => change({ bestWay })}
          />
          <PlainSelect
            id={`${id}-type`}
            label={F.type}
            optional
            value={typed.type}
            choices={[
              ['', F.notGiven],
              ...EVENT_TYPES.map((one) => [one, TYPE_WORDS[one]] as const),
            ]}
            busy={saving}
            onChange={(type) => change({ type: type as EventType | '' })}
          />
          <OneField
            id={`${id}-date`}
            label={F.date}
            error={shown.date ?? null}
            inputRef={refs.date as RefObject<HTMLInputElement | null>}
            input={{
              type: 'date',
              value: typed.date,
              ...off,
              onChange: (event) => change({ date: event.target.value }),
              onBlur: () => leave(['date']),
            }}
          />
          <OneField
            id={`${id}-guests`}
            label={F.guests}
            error={shown.guests ?? null}
            inputRef={refs.guests as RefObject<HTMLInputElement | null>}
            input={{
              type: 'text',
              inputMode: 'numeric',
              value: typed.guests,
              ...off,
              onChange: (event) => change({ guests: event.target.value }),
              onBlur: () => leave(['guests']),
            }}
          />
          <EditText
            id={`${id}-where`}
            label={F.where}
            optional
            value={typed.where}
            help={F.whereHint}
            error={shown.where ?? null}
            inputRef={refs.where as RefObject<HTMLInputElement | null>}
            input={{ ...off, onBlur: () => leave(['where']) }}
            onChange={(where) => change({ where })}
          />
          <BudgetField
            id={`${id}-budget`}
            typed={typed}
            error={shown.amount ?? shown.currency ?? null}
            amountWrong={shown.amount != null}
            currencyWrong={shown.currency != null}
            busy={saving}
            amountRef={refs.amount as RefObject<HTMLInputElement | null>}
            currencyRef={refs.currency as RefObject<HTMLSelectElement | null>}
            onChange={change}
            onLeave={() => leave(['amount', 'currency'])}
          />
          <Chips
            legend={F.foundVia}
            choices={FOUND_VIA.map((one) => [one, FOUND_VIA_WORDS[one]])}
            picked={typed.foundVia}
            busy={saving}
            onPick={(foundVia) => change({ foundVia })}
          />
          {viewer.role !== 'member' && (
            <PlainSelect
              id={`${id}-assigned`}
              label={F.assignedTo}
              value={typed.assignedTo ?? ''}
              placeholder={typed.assignedTo == null ? F.notGiven : undefined}
              choices={Object.values(PEOPLE).map((one) => [
                one.id,
                one.id === viewer.id ? F.you(one.name) : one.name,
              ])}
              busy={saving}
              onChange={(assignedTo) => change({ assignedTo })}
            />
          )}
        </div>
      </section>

      <div className="enq-foot">
        <button type="submit" className="button button-primary" aria-disabled={saving || undefined}>
          {saving ? F.saving : editing ? F.saveChanges : F.save}
        </button>
        {!saving && <TextAction label={F.cancel} onClick={onCancel} />}
      </div>
    </form>
  );
}

function Duplicate({ said: words }: { said: DuplicateSaid }) {
  return (
    <Quiet
      action={
        words.to != null && (
          <Link className="desk-text" to={words.to}>
            {F.openIt}
          </Link>
        )
      }
    >
      {words.line}
    </Quiet>
  );
}

function FieldWords({ id, error }: { id: string; error: string | null }) {
  return (
    error != null && (
      <p id={`${id}-error`} className="desk-error">
        <Glyph name="alert" size={15} weight={2.2} />
        {error}
      </p>
    )
  );
}

function Optional() {
  return <span className="ev-optional"> · Optional</span>;
}

function PhoneField({
  id,
  typed,
  error,
  wrong,
  describedBy,
  busy,
  inputRef,
  onChange,
  onLeave,
}: {
  id: string;
  typed: EnquiryTyped;
  error: string | null;
  wrong: boolean;
  describedBy: string | undefined;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (next: Partial<EnquiryTyped>) => void;
  onLeave: () => void;
}) {
  const countries = useMemo(
    () => countryChoices('en').filter(({ code }) => callingCode(code) != null),
    [],
  );
  const bad = error != null || wrong;

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {F.phone}
      </label>
      <div className="enq-phone">
        <label htmlFor={`${id}-code`} className="desk-unseen">
          {F.code}
        </label>
        <div className="desk-box ev-select enq-code">
          <select
            id={`${id}-code`}
            value={typed.country}
            aria-disabled={busy || undefined}
            onChange={(event) => !busy && onChange({ country: event.target.value })}
            onBlur={onLeave}
          >
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {codeChoice(code, name)}
              </option>
            ))}
          </select>
          <Glyph name="chevdown" size={18} weight={2.3} />
        </div>
        <div className={bad ? 'desk-box is-wrong' : 'desk-box'}>
          <input
            ref={inputRef}
            id={id}
            type="tel"
            autoComplete="off"
            value={typed.phone}
            {...offField(busy)}
            aria-invalid={bad}
            aria-describedby={[error == null ? null : `${id}-error`, describedBy]
              .filter(Boolean)
              .join(' ')}
            onChange={(event) => onChange({ phone: event.target.value })}
            onBlur={onLeave}
          />
        </div>
      </div>
      <FieldWords id={id} error={error} />
    </div>
  );
}

function MindField({
  id,
  value,
  error,
  busy,
  areaRef,
  onChange,
  onLeave,
}: {
  id: string;
  value: string;
  error: string | null;
  busy: boolean;
  areaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onLeave: () => void;
}) {
  const length = lengthOf(value);
  const counting = length >= COUNT_FROM;

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {F.mind}
        <Optional />
      </label>
      <div className={error == null ? 'desk-box ev-note-box' : 'desk-box ev-note-box is-wrong'}>
        <textarea
          ref={areaRef}
          id={id}
          rows={4}
          value={value}
          {...offField(busy)}
          aria-invalid={error != null}
          aria-describedby={[
            error == null ? null : `${id}-error`,
            counting ? `${id}-count` : null,
            `${id}-help`,
          ]
            .filter(Boolean)
            .join(' ')}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onLeave}
        />
      </div>
      <FieldWords id={id} error={error} />
      <div className="enq-help-row">
        <p id={`${id}-help`} className="desk-help">
          {F.mindHint}
        </p>
        {counting && (
          <p id={`${id}-count`} className={length > MIND_MOST ? 'desk-help is-over' : 'desk-help'}>
            {F.counter(length, MIND_MOST)}
          </p>
        )}
      </div>
    </div>
  );
}

function OneField({
  id,
  label,
  error,
  inputRef,
  input,
}: {
  id: string;
  label: string;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  input: InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
        <Optional />
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          {...input}
        />
      </div>
      <FieldWords id={id} error={error} />
    </div>
  );
}

export function PlainSelect({
  id,
  label,
  optional = false,
  value,
  placeholder,
  choices,
  busy = false,
  unseenLabel = false,
  onChange,
}: {
  id: string;
  label: string;
  unseenLabel?: boolean;
  optional?: boolean;
  value: string;
  placeholder?: string | undefined;
  choices: readonly (readonly [string, string])[];
  busy?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="desk-field">
      <label htmlFor={id} className={unseenLabel ? 'desk-unseen' : 'desk-label'}>
        {label}
        {optional && <Optional />}
      </label>
      <div className="desk-box ev-select">
        <select
          id={id}
          value={value}
          aria-disabled={busy || undefined}
          className={value === '' ? 'is-empty' : undefined}
          onChange={(event) => !busy && onChange(event.target.value)}
        >
          {placeholder != null && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {choices.map(([one, words]) => (
            <option key={one} value={one}>
              {words}
            </option>
          ))}
        </select>
        <Glyph name="chevdown" size={18} weight={2.3} />
      </div>
    </div>
  );
}

function Chips<T extends string>({
  legend,
  choices,
  picked,
  busy,
  onPick,
}: {
  legend: string;
  choices: readonly (readonly [T, string])[];
  picked: T | null;
  busy: boolean;
  onPick: (one: T | null) => void;
}) {
  return (
    <fieldset className="enq-chips-set">
      <legend className="desk-label">
        {legend}
        <Optional />
      </legend>
      <div className="enq-chips">
        {choices.map(([one, words]) => (
          <button
            key={one}
            type="button"
            className="enq-chip"
            aria-pressed={one === picked}
            aria-disabled={busy || undefined}
            onClick={() => !busy && onPick(one === picked ? null : one)}
          >
            {one === picked && <Glyph name="tick" size={14} weight={2.6} />}
            {words}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function BudgetField({
  id,
  typed,
  error,
  amountWrong,
  currencyWrong,
  busy,
  amountRef,
  currencyRef,
  onChange,
  onLeave,
}: {
  id: string;
  typed: EnquiryTyped;
  error: string | null;
  amountWrong: boolean;
  currencyWrong: boolean;
  busy: boolean;
  amountRef: RefObject<HTMLInputElement | null>;
  currencyRef: RefObject<HTMLSelectElement | null>;
  onChange: (next: Partial<EnquiryTyped>) => void;
  onLeave: () => void;
}) {
  const currencies = useMemo(
    () =>
      CURRENCY_CODES.map((code) => [code, code] as const).sort(([a], [b]) => a.localeCompare(b)),
    [],
  );
  const told = error == null ? undefined : `${id}-error`;

  return (
    <fieldset className="enq-budget">
      <legend className="desk-label">
        {F.budget}
        <Optional />
      </legend>
      <div className="enq-pair">
        <label htmlFor={`${id}-amount`} className="desk-unseen">
          {F.amount}
        </label>
        <div className={amountWrong ? 'desk-box is-wrong' : 'desk-box'}>
          <input
            ref={amountRef}
            id={`${id}-amount`}
            type="text"
            inputMode="decimal"
            className="enq-amount"
            value={typed.amount}
            {...offField(busy)}
            aria-invalid={amountWrong}
            aria-describedby={amountWrong ? told : undefined}
            onChange={(event) => onChange({ amount: event.target.value })}
            onBlur={onLeave}
          />
        </div>
        <label htmlFor={`${id}-currency`} className="desk-unseen">
          {F.currency}
        </label>
        <div
          className={
            currencyWrong
              ? 'desk-box ev-select enq-currency is-wrong'
              : 'desk-box ev-select enq-currency'
          }
        >
          <select
            ref={currencyRef}
            id={`${id}-currency`}
            value={typed.currency}
            aria-disabled={busy || undefined}
            aria-invalid={currencyWrong}
            aria-describedby={currencyWrong ? told : undefined}
            onChange={(event) => !busy && onChange({ currency: event.target.value })}
            onBlur={onLeave}
          >
            {currencies.map(([code, words]) => (
              <option key={code} value={code}>
                {words}
              </option>
            ))}
          </select>
          <Glyph name="chevdown" size={18} weight={2.3} />
        </div>
      </div>
      <FieldWords id={id} error={error} />
    </fieldset>
  );
}
