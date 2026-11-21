import { flushSync } from 'react-dom';
import {
  type OrganisationDetails,
  type OrganisationField,
  organisationChanges,
} from '@soirely/domain';
import { useRef, useState } from 'react';

import { Picker } from '../components/GeneralParts.tsx';
import {
  type Candidate,
  DETAILS_WORDS as W,
  DOMAIN_WORDS as D,
  DOMAINS_MOST,
  type Domain,
  type GeneralStart,
  MALFORMED_CONTACT,
  MISTYPED,
  OWNERSHIP_WORDS as O,
  PICKERS,
  type Picked,
  RETRY_MS,
  SEND_MS,
  TRY_AGAIN,
  type TransferProblems,
  SHOWN_IN,
  changeCount,
  choicesOf,
  choiceName,
  deleteBody,
  detailProblems,
  discardTitle,
  domainProblem,
  domainRefusal,
  nameMatches,
  savedWords,
  transferProblems,
  transferRefusal,
} from './general.ts';
import { Glyph } from '../components/Glyph.tsx';
import { SAMPLE } from './rules.ts';
import {
  Ask,
  Chevron,
  Choices,
  Dialog,
  Field,
  Head,
  Mark,
  Note,
  RowWords,
  TextAction,
} from '../components/SettingsParts.tsx';
import { useLater } from '../useLater.ts';

function focusSoon(find: () => HTMLElement | null | undefined, tries = 5): void {
  window.requestAnimationFrame(() => {
    const to = find();
    if (to == null) return;
    if (to.closest('[inert]') == null) to.focus();
    else if (tries > 0) focusSoon(find, tries - 1);
  });
}

function without<K extends string>(
  problems: Partial<Record<K, string>>,
  field: K,
): Partial<Record<K, string>> {
  const { [field]: _gone, ...rest } = problems;
  return rest as Partial<Record<K, string>>;
}

const DEFAULTS: readonly Picked[] = ['currency', 'timezone'];

/** The details on a dialog of their own; a picker's list opens over it, in the same 540, and comes back on a pick. */
export function DetailsDialog({
  saved,
  opening,
  onClose,
  onSaved,
}: {
  saved: OrganisationDetails;
  opening: GeneralStart | null;
  onClose: () => void;
  onSaved: (details: OrganisationDetails, words: string) => void;
}) {
  const later = useLater();
  const contactWrong = opening?.contactWrong ?? false;
  const [values, setValues] = useState<OrganisationDetails>(() => ({
    ...saved,
    contactAddress: contactWrong ? MALFORMED_CONTACT : saved.contactAddress,
  }));
  const [errors, setErrors] = useState<Partial<Record<OrganisationField, string>>>(() =>
    contactWrong ? { contactAddress: W.contactInvalid } : {},
  );
  const [picking, setPicking] = useState<Picked | null>(opening?.picking ?? null);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const none = useRef<HTMLElement>(null);
  const rows = useRef<Partial<Record<Picked, HTMLButtonElement | null>>>({});
  const changes = changeCount(saved, values);

  function typed(field: 'name' | 'contactAddress', value: string): void {
    setValues((now) => ({ ...now, [field]: value }));
    setErrors((now) => without(now, field));
  }

  function save(): void {
    if (saving) return;
    const found = detailProblems(values);
    setErrors(found);
    if (found.name != null) return nameRef.current?.focus();
    if (found.contactAddress != null) return contactRef.current?.focus();

    setSaving(true);
    later(SEND_MS, () =>
      onSaved(
        { ...saved, ...organisationChanges(saved, values) },
        savedWords(values.locale, saved.locale),
      ),
    );
  }

  function back(field: Picked, code?: string): void {
    setPicking(null);
    if (code != null) setValues((now) => ({ ...now, [field]: code }));
    focusSoon(() => rows.current[field]);
  }

  const pickerRow = (field: Picked) => {
    const chosen = choiceName(field, values[field]);

    return (
      <button
        ref={(row) => {
          rows.current[field] = row;
        }}
        type="button"
        className="desk-row is-plain"
        aria-label={`${W[field]}, ${chosen}`}
        onClick={() => setPicking(field)}
      >
        <RowWords title={chosen} lines={[W[field]]} />
        <Chevron />
      </button>
    );
  };

  return (
    <>
      <Dialog
        title={W.editTitle}
        verb={saving ? W.saving : W.save}
        on={changes > 0 && !saving}
        first={contactWrong ? contactRef : none}
        onDismiss={() => (changes > 0 ? setAsking(true) : onClose())}
        onConfirm={save}
      >
        <div className="desk-fields">
          <Field
            label={W.name}
            value={values.name}
            autoComplete="organization"
            inputRef={nameRef}
            error={errors.name ?? null}
            onChange={(value) => typed('name', value)}
          />
          {pickerRow('countryCode')}
          <Field
            label={W.contactAddress}
            value={values.contactAddress}
            inputMode="email"
            autoComplete="email"
            inputRef={contactRef}
            error={errors.contactAddress ?? null}
            onChange={(value) => typed('contactAddress', value)}
          />
        </div>
        <div className="desk-group-in">
          <Head title={W.defaults} level={3} />
          <ul className="desk-rows">
            {DEFAULTS.map((field) => (
              <li key={field}>{pickerRow(field)}</li>
            ))}
          </ul>
          <p className="desk-note">{W.defaultsNote}</p>
        </div>
        <div className="desk-group-in">
          <Head title={W.invitations} level={3} />
          {pickerRow('locale')}
          <p className="desk-note">{W.languageHint}</p>
        </div>
      </Dialog>
      {picking != null && (
        <Picker
          back={W.editTitle}
          title={W[picking]}
          search={PICKERS[picking].search}
          choices={choicesOf(picking)}
          locale={SHOWN_IN}
          value={values[picking]}
          onBack={() => back(picking)}
          onChoose={(code) => back(picking, code)}
        />
      )}
      {asking && (
        <Ask
          title={discardTitle(changes)}
          line={W.discardLine}
          keep="Keep editing"
          go="Discard"
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

export function AddDomainDialog({
  listed,
  onClose,
  onAdded,
}: {
  listed: readonly Domain[];
  onClose: () => void;
  onAdded: (typed: string) => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  function add(): void {
    if (busy) return;
    const problem = domainProblem(typed);
    setError(problem);
    if (problem != null) return input.current?.focus();

    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      const refusal = domainRefusal(typed, listed);
      if (refusal == null) return onAdded(typed);
      setError(refusal);
      input.current?.focus();
    });
  }

  return (
    <>
      <Dialog
        title={D.addTitle}
        verb={D.addVerb}
        on={typed.trim() !== '' && !busy}
        first={input}
        onDismiss={() => (typed.trim() === '' ? onClose() : setAsking(true))}
        onConfirm={add}
      >
        <div className="desk-fields">
          <Field
            label={D.field}
            value={typed}
            help={D.help(SAMPLE.email, DOMAINS_MOST)}
            error={error}
            inputRef={input}
            autoComplete="off"
            onChange={(value) => {
              setTyped(value);
              if (error != null && domainProblem(value) == null) setError(null);
            }}
          />
        </div>
      </Dialog>
      {asking && (
        <Ask
          title="Discard your change?"
          line="No domain is added."
          keep="Keep editing"
          go="Discard"
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

/** Who becomes the owner, then the password and, as the owner has two-factor, a code; who is emailed last. */
export function TransferDialog({
  picked,
  candidates,
  onClose,
  onDone,
}: {
  picked: boolean;
  candidates: readonly Candidate[];
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const later = useLater();
  const [opening] = useState(() => ({
    owner: picked ? (candidates[0]?.name ?? null) : null,
    password: picked ? SAMPLE.password : '',
    code: picked ? SAMPLE.authenticator : '',
  }));
  const [owner, setOwner] = useState(opening.owner);
  const [password, setPassword] = useState(opening.password);
  const [code, setCode] = useState(opening.code);
  const [codeAsked, setCodeAsked] = useState(picked);
  const [problems, setProblems] = useState<TransferProblems>({});
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const changes = [
    owner !== opening.owner,
    password !== opening.password,
    code !== opening.code,
  ].filter(Boolean).length;

  function land(found: TransferProblems): void {
    setProblems(found);
    if (found.owner != null) group.current?.querySelector('input')?.focus();
    else if (found.password != null) passwordRef.current?.focus();
    else if (found.code != null) codeRef.current?.focus();
  }

  function transfer(): void {
    if (busy) return;
    const found = transferProblems(owner, password, codeAsked ? code : null);
    land(found);
    if (owner == null || Object.keys(found).length > 0) return;

    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      const refused = transferRefusal(password, codeAsked ? code : null);
      if (refused === 'codeAsked') {
        flushSync(() => setCodeAsked(true));
        return codeRef.current?.focus();
      }
      if (Object.keys(refused).length === 0) return onDone(owner);
      land(refused);
    });
  }

  return (
    <>
      <Dialog
        title={O.transfer}
        verb={O.transferVerb}
        on={!busy}
        onDismiss={() => (changes > 0 ? setAsking(true) : onClose())}
        onConfirm={transfer}
      >
        <Note>{O.transferBody}</Note>
        <div ref={group} className="desk-group-in">
          <Head title={O.newOwner} level={3} />
          {problems.owner != null && (
            <p className="desk-error" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {problems.owner}
            </p>
          )}
          <Choices
            legend={O.newOwner}
            hideLegend
            choices={candidates.map((one) => ({ name: one.name, line: one.role }))}
            picked={owner ?? ''}
            onPick={(name) => {
              setOwner(name);
              setProblems((now) => without(now, 'owner'));
            }}
          />
        </div>
        <div className="desk-fields">
          <Field
            label={O.password}
            value={password}
            secret
            autoComplete="current-password"
            help={O.passwordWhy}
            error={problems.password ?? null}
            inputRef={passwordRef}
            onChange={(value) => {
              setPassword(value);
              setProblems((now) => without(now, 'password'));
            }}
          />
          {codeAsked && (
            <Field
              label={O.code}
              value={code}
              autoComplete="one-time-code"
              help={O.codeHelp}
              error={problems.code ?? null}
              inputRef={codeRef}
              onChange={(value) => {
                setCode(value);
                setProblems((now) => without(now, 'code'));
              }}
            />
          )}
        </div>
        <Note>{O.bothEmailed(owner ?? O.theNewOwner)}</Note>
      </Dialog>
      {asking && (
        <Ask
          title={discardTitle(changes)}
          line="You stay the owner."
          keep="Keep editing"
          go="Discard"
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

export function DeleteDialog({
  locale,
  mistyped,
  counted,
  onClose,
  onDeleted,
}: {
  locale: string;
  mistyped: boolean;
  counted: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const later = useLater();
  const [now] = useState(() => new Date());
  const [typed, setTyped] = useState(mistyped ? MISTYPED : '');
  const [mismatch, setMismatch] = useState<string | null>(mistyped ? O.deleteMismatch : null);
  const [counts, setCounts] = useState<'counted' | 'counting' | 'uncounted'>(
    counted ? 'counted' : 'uncounted',
  );
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const matches = nameMatches(typed);

  return (
    <Dialog
      title={O.deleteTitle}
      verb={O.deleteVerb}
      red
      on={!busy}
      first={input}
      onDismiss={onClose}
      onConfirm={() => {
        if (busy) return;
        if (!matches) {
          setMismatch(O.deleteMismatch);
          return input.current?.focus();
        }
        setBusy(true);
        onDeleted();
      }}
    >
      <div className="desk-group-in">
        <Head title={O.deleteWarningTitle} level={3} />
        {counts === 'counted' && <p className="desk-line is-ink">{deleteBody(now, locale)}</p>}
        {counts === 'counting' && (
          <p className="desk-line" role="status">
            {O.deleteCounting}
          </p>
        )}
        {counts === 'uncounted' && (
          <div className="desk-red" role="alert">
            <p className="desk-line is-ink">{O.deleteUncounted}</p>
            <TextAction
              label={TRY_AGAIN}
              onClick={() => {
                setCounts('counting');
                later(RETRY_MS, () => setCounts('counted'));
              }}
            />
          </div>
        )}
      </div>
      <div className="general-typed">
        <Field
          label={O.deleteType}
          value={typed}
          {...(matches ? {} : { help: O.deleteExactly })}
          error={mismatch}
          inputRef={input}
          autoComplete="off"
          onChange={(value) => {
            setTyped(value);
            if (nameMatches(value)) setMismatch(null);
          }}
        />
        <div role="status">
          {matches && (
            <p className="desk-help general-matches">
              <Mark kind="yes" />
              {O.deleteMatches}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
