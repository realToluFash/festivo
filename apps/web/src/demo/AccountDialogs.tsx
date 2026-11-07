import { type ZoneRow, callingCode, zoneLabel } from '@soirely/domain';
import { useEffect, useId, useRef, useState } from 'react';

import { offButton } from '../offButton.ts';
import {
  ADD_WORDS as A,
  CHANNEL_WORDS,
  type Contact,
  DISCARD,
  type DialogStart,
  KIND_WORDS,
  NAME_WORDS as N,
  PHONE_COUNTRY,
  PROVE_WORDS as P,
  RESEND_FROM,
  SEND_MS,
  VERIFY_WORDS as V,
  ZONE_WORDS as Z,
  codeRefusal,
  emailRefusal,
  phoneRefusal,
  phoneShown,
  proveProblems,
  zoneChosen,
  zoneMatches,
  zoneRefusal,
} from './account.ts';
import { Glyph } from '../components/Glyph.tsx';
import { COUNTRIES, SAMPLE, codeChoice } from './rules.ts';
import { Ask, Dialog, Field, Note, RowWords } from './SettingsParts.tsx';
import { useLater } from '../useLater.ts';

function Discard({ line, onKeep, onGo }: { line: string; onKeep: () => void; onGo: () => void }) {
  return (
    <Ask
      title={DISCARD.title}
      line={line}
      keep={DISCARD.keep}
      go={DISCARD.go}
      onKeep={onKeep}
      onGo={onGo}
    />
  );
}

export function NameDialog({
  start,
  saved,
  onClose,
  onSaved,
}: {
  start: DialogStart | null;
  saved: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? saved);
  const [error, setError] = useState<string | null>(
    start?.tried === true && typed.trim() === '' ? N.blank : null,
  );
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);
  const changed = typed.trim() !== saved;

  function save(): void {
    if (busy) return;
    if (typed.trim() === '') {
      setError(N.blank);
      return input.current?.focus();
    }
    setBusy(true);
    later(SEND_MS, () => onSaved(typed.trim()));
  }

  return (
    <>
      <Dialog
        title={N.title}
        verb={N.verb}
        on={changed && !busy}
        first={input}
        onDismiss={() => (changed ? setAsking(true) : onClose())}
        onConfirm={save}
      >
        <div className="desk-fields">
          <Field
            label={N.field}
            value={typed}
            autoComplete="name"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
      </Dialog>
      {asking && <Discard line={N.stays(saved)} onKeep={() => setAsking(false)} onGo={onClose} />}
    </>
  );
}

export function ZoneDialog({
  start,
  now,
  onClose,
  onSaved,
}: {
  start: DialogStart | null;
  now: ZoneRow;
  onClose: () => void;
  onSaved: (zone: ZoneRow) => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [picked, setPicked] = useState<ZoneRow | null>(start?.picked ?? null);
  const [error, setError] = useState<string | null>(() =>
    start?.tried === true && zoneChosen(typed, picked) == null ? zoneRefusal(typed) : null,
  );
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const showingPicked = picked != null && typed === zoneLabel(picked);
  const matches = showingPicked ? [] : zoneMatches(typed);
  const wanted = typed.trim();

  function save(): void {
    if (busy) return;
    const zone = zoneChosen(typed, picked);
    if (zone == null) {
      setError(zoneRefusal(typed));
      return input.current?.focus();
    }
    setBusy(true);
    later(SEND_MS, () => onSaved(zone));
  }

  return (
    <>
      <Dialog
        title={Z.title}
        verb={Z.verb}
        on={!busy}
        first={input}
        onDismiss={() => (wanted === '' ? onClose() : setAsking(true))}
        onConfirm={save}
      >
        <Note>{Z.intro}</Note>
        <div className="desk-fields">
          <Field
            label={Z.field}
            value={typed}
            placeholder={Z.placeholder}
            help={Z.help(zoneLabel(now))}
            autoComplete="off"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
        <div className="account-status" role="status">
          {wanted !== '' && !showingPicked && matches.length === 0 && (
            <p className="desk-line">{Z.none(wanted)}</p>
          )}
        </div>
        {matches.length > 0 && (
          <ul className="desk-rows account-zones" aria-label={Z.matches}>
            {matches.map((match) => (
              <li key={match.zone.id}>
                <button
                  type="button"
                  className="desk-row account-row"
                  onClick={() => {
                    setTyped(match.label);
                    setPicked(match.zone);
                    setError(null);
                    input.current?.focus();
                  }}
                >
                  <RowWords title={match.label} lines={[match.line]} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      {asking && (
        <Discard line={Z.stays(zoneLabel(now))} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

export function AddEmailDialog({
  start,
  rows,
  onClose,
  onAdded,
}: {
  start: DialogStart | null;
  rows: readonly Contact[];
  onClose: () => void;
  onAdded: (shown: string) => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const words = KIND_WORDS.email;
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(() =>
    start?.tried === true ? emailRefusal(typed, rows) : null,
  );
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);

  function add(): void {
    if (busy) return;
    const refusal = emailRefusal(typed, rows);
    if (refusal != null) {
      setError(refusal);
      return input.current?.focus();
    }
    setBusy(true);
    later(SEND_MS, () => onAdded(typed.trim()));
  }

  return (
    <>
      <Dialog
        title={words.add}
        verb={A.verb}
        on={!busy}
        first={input}
        onDismiss={() => (typed.trim() === '' ? onClose() : setAsking(true))}
        onConfirm={add}
      >
        <div className="desk-fields">
          <Field
            label={words.field}
            value={typed}
            help={words.help}
            inputMode="email"
            autoComplete="email"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
      </Dialog>
      {asking && (
        <Discard line={DISCARD.nothingAdded} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

export function AddPhoneDialog({
  start,
  rows,
  onClose,
  onAdded,
}: {
  start: DialogStart | null;
  rows: readonly Contact[];
  onClose: () => void;
  onAdded: (shown: string) => void;
}) {
  const later = useLater();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const words = KIND_WORDS.phone;
  const [country, setCountry] = useState<string>(PHONE_COUNTRY);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(() =>
    start?.tried === true ? phoneRefusal(typed, country, rows) : null,
  );
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);
  const changed = typed.trim() !== '' || country !== PHONE_COUNTRY;
  const told = [`${id}-help`, error == null ? null : `${id}-error`].filter(Boolean).join(' ');

  function add(): void {
    if (busy) return;
    const refusal = phoneRefusal(typed, country, rows);
    if (refusal != null) {
      setError(refusal);
      return input.current?.focus();
    }
    setBusy(true);
    later(SEND_MS, () => onAdded(phoneShown(country, typed)));
  }

  return (
    <>
      <Dialog
        title={words.add}
        verb={A.verb}
        on={!busy}
        first={input}
        onDismiss={() => (changed ? setAsking(true) : onClose())}
        onConfirm={add}
      >
        <div className="desk-fields">
          <div className="desk-field">
            <label htmlFor={`${id}-number`} className="desk-label">
              {words.field}
            </label>
            <div className="account-phone">
              <div className="desk-box account-country">
                <span aria-hidden="true">{`${country} ${callingCode(country) ?? ''}`}</span>
                <Glyph name="chevdown" size={16} weight={2.4} />
                <select
                  aria-label={A.country}
                  value={country}
                  onChange={(event) => {
                    setCountry(event.target.value);
                    setError(null);
                  }}
                >
                  {COUNTRIES.map((each) => (
                    <option key={each.code} value={each.code}>
                      {codeChoice(each.code)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  ref={input}
                  id={`${id}-number`}
                  type="tel"
                  value={typed}
                  autoComplete="tel-national"
                  aria-invalid={error != null}
                  aria-describedby={told}
                  onChange={(event) => {
                    setTyped(event.target.value);
                    setError(null);
                  }}
                />
              </div>
            </div>
            {error != null && (
              <p id={`${id}-error`} className="desk-error">
                <Glyph name="alert" size={15} weight={2.2} />
                {error}
              </p>
            )}
            <p id={`${id}-help`} className="desk-help">
              {words.help}
            </p>
          </div>
        </div>
      </Dialog>
      {asking && (
        <Discard line={DISCARD.nothingAdded} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

/** The one proof the page asks for, before the address you sign in with changes; nothing to discard, so Cancel closes it. */
export function ProveDialog({
  start,
  onClose,
  onProved,
}: {
  start: DialogStart | null;
  onClose: () => void;
  onProved: () => void;
}) {
  const later = useLater();
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const tried = start?.tried === true;
  const [password, setPassword] = useState(tried ? SAMPLE.password : '');
  const [code, setCode] = useState(start?.typed ?? '');
  const [problems, setProblems] = useState(() => (tried ? proveProblems(password, code) : {}));
  const [busy, setBusy] = useState(false);

  function go(): void {
    if (busy) return;
    const found = proveProblems(password, code);
    setProblems(found);
    if (found.password != null) return passwordRef.current?.focus();
    if (found.code != null) return codeRef.current?.focus();
    setBusy(true);
    later(SEND_MS, onProved);
  }

  return (
    <Dialog
      title={P.title}
      verb={P.verb}
      on={!busy}
      first={problems.code != null && problems.password == null ? codeRef : passwordRef}
      onDismiss={onClose}
      onConfirm={go}
    >
      <Note>{P.intro}</Note>
      <div className="desk-fields">
        <Field
          label={P.password}
          value={password}
          secret
          autoComplete="current-password"
          inputRef={passwordRef}
          error={problems.password ?? null}
          onChange={(value) => {
            setPassword(value);
            setProblems(({ code: kept }) => (kept == null ? {} : { code: kept }));
          }}
        />
        <Field
          label={P.code}
          value={code}
          help={P.codeHelp}
          autoComplete="one-time-code"
          inputRef={codeRef}
          error={problems.code ?? null}
          onChange={(value) => {
            setCode(value);
            setProblems(({ password: kept }) => (kept == null ? {} : { password: kept }));
          }}
        />
      </div>
    </Dialog>
  );
}

/** An expired code, in the field's place: what happened, and to use the newest code. */
export function ExpiredCode({ newest }: { newest: string }) {
  return (
    <div className="account-expired" role="alert">
      <p className="account-expired-title">{V.expired}</p>
      <p className="desk-line">{V.expiredLine(newest)}</p>
    </div>
  );
}

/** Check your email or messages: the code, then Send a new code once its count ends; an expired code takes the field's place. */
export function VerifyDialog({
  start,
  row,
  onClose,
  onVerified,
}: {
  start: DialogStart;
  row: Contact;
  onClose: () => void;
  onVerified: () => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const resend = useRef<HTMLButtonElement>(null);
  const [channel, setChannel] = useState(start.channel);
  const [typed, setTyped] = useState(start.typed);
  const [error, setError] = useState(() =>
    start.tried ? codeRefusal(start.typed, start.channel) : null,
  );
  const [expired, setExpired] = useState(start.expired);
  const [left, setLeft] = useState(start.expired ? 0 : RESEND_FROM);
  const [busy, setBusy] = useState(false);
  const words = CHANNEL_WORDS[channel];

  useEffect(() => {
    if (expired || left <= 0) return;
    const tick = window.setTimeout(() => setLeft(left - 1), 1000);

    return () => window.clearTimeout(tick);
  }, [expired, left]);

  function verify(): void {
    if (busy || expired) return;
    const refusal = codeRefusal(typed, channel);
    if (refusal != null) {
      setError(refusal);
      return input.current?.focus();
    }
    setBusy(true);
    later(SEND_MS, onVerified);
  }

  function sendAgain(): void {
    setTyped('');
    setError(null);
    setExpired(false);
    setLeft(RESEND_FROM);
    window.requestAnimationFrame(() => input.current?.focus());
  }

  return (
    <Dialog
      title={words.title}
      verb={V.verb}
      on={!expired && !busy}
      first={expired ? resend : input}
      onDismiss={onClose}
      onConfirm={verify}
    >
      <Note>{words.intro(row.shown)}</Note>
      {expired ? (
        <ExpiredCode newest={words.newest} />
      ) : (
        <div className="desk-fields">
          <Field
            label={words.field}
            value={typed}
            inputMode="numeric"
            autoComplete="one-time-code"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
      )}
      <div className="desk-red">
        <button
          ref={resend}
          type="button"
          className={left > 0 ? 'desk-text account-wait' : 'desk-text'}
          {...offButton(left > 0, { dim: false })}
          onClick={sendAgain}
        >
          {left > 0 ? V.resendIn(left) : V.resend}
        </button>
        <p className="desk-note">{V.resendNote}</p>
        {channel === 'whatsApp' && !expired && (
          <button
            type="button"
            className="desk-text"
            onClick={() => {
              setChannel('text');
              setError(null);
            }}
          >
            {V.textInstead}
          </button>
        )}
      </div>
    </Dialog>
  );
}
