import { keyInGroups } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';

import { offButton } from '../offButton.ts';
import { DISCARD, VERIFY_WORDS as V } from './account.ts';
import { ExpiredCode } from '../components/AccountParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import {
  ASK_WORDS,
  AUTHENTICATOR_KEY,
  CONFIRM_WORDS as C,
  type DialogStart,
  FORGOT_WORDS as F,
  PASSWORD_WORDS as P,
  type ProveAsks,
  type Purpose,
  RECOVERY_WORDS as R,
  RESEND_FROM,
  SEND_MS,
  SETUP_WORDS as U,
  changeProblems,
  chooseRefusal,
  emailedCodeRefusal,
  forgotRefusal,
  proveProblems,
  qrPath,
  ruleMet,
  setupRefusal,
} from './security.ts';
import { copyText } from './settings.ts';
import { Ask, Dialog, Field, Note } from '../components/SettingsParts.tsx';
import { useLater } from '../useLater.ts';

const QR = qrPath();

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

function Rule({ password }: { password: string }) {
  const met = ruleMet(password);

  return (
    <div className="security-rule">
      <div className="security-rule-row">
        <span className={met ? 'desk-mark is-yes' : 'desk-mark is-notyet'} aria-hidden="true">
          {met && <Glyph name="tick" size={10} weight={3.4} />}
        </span>
        <span className="security-rule-name">{P.rule}</span>
        <span className="security-rule-word">{met ? P.met : P.notYet}</span>
      </div>
      <p className="desk-note">{P.ruleNote}</p>
    </div>
  );
}

export function ChangeDialog({
  start,
  email,
  onClose,
  onForgot,
  onChanged,
}: {
  start: DialogStart;
  email: string;
  onClose: () => void;
  onForgot: () => void;
  onChanged: () => void;
}) {
  const later = useLater();
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(start.typed);
  const [next, setNext] = useState(start.second);
  const [problems, setProblems] = useState(() =>
    start.tried ? changeProblems(start.typed, start.second) : {},
  );
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start.discarding);

  function save(): void {
    if (busy) return;
    const found = changeProblems(current, next);
    setProblems(found);
    if (found.current != null) return currentRef.current?.focus();
    if (found.next != null) return nextRef.current?.focus();
    setBusy(true);
    later(SEND_MS, onChanged);
  }

  return (
    <>
      <Dialog
        title={P.title}
        verb={P.verb}
        on={!busy}
        first={problems.current != null || current === '' ? currentRef : nextRef}
        onDismiss={() => (current === '' && next === '' ? onClose() : setAsking(true))}
        onConfirm={save}
      >
        <div className="desk-fields">
          <Field
            label={P.current}
            value={current}
            secret
            autoComplete="current-password"
            inputRef={currentRef}
            error={problems.current ?? null}
            action={
              <button type="button" className="desk-text" onClick={onForgot}>
                {P.forgot}
              </button>
            }
            onChange={(value) => {
              setCurrent(value);
              setProblems(({ next: kept }) => (kept == null ? {} : { next: kept }));
            }}
          />
          <Field
            label={P.next}
            value={next}
            secret
            autoComplete="new-password"
            inputRef={nextRef}
            error={problems.next ?? null}
            onChange={(value) => {
              setNext(value);
              setProblems(({ current: kept }) => (kept == null ? {} : { current: kept }));
            }}
          />
        </div>
        <Rule password={next} />
        <Note>{P.signsOut}</Note>
        <Note>{P.changedEmailed(email)}</Note>
      </Dialog>
      {asking && (
        <Discard line={ASK_WORDS.passwordStays} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

/** Reset your password, from Forgot it?: a proof of nothing, so Cancel closes it at once. */
export function ForgotDialog({
  start,
  onClose,
  onSent,
}: {
  start: DialogStart;
  onClose: () => void;
  onSent: () => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start.typed);
  const [error, setError] = useState(() => (start.tried ? forgotRefusal(start.typed) : null));
  const [busy, setBusy] = useState(false);

  function send(): void {
    if (busy) return;
    const refusal = forgotRefusal(typed);
    setError(refusal);
    if (refusal != null) return input.current?.focus();
    setBusy(true);
    later(SEND_MS, onSent);
  }

  return (
    <Dialog
      title={F.title}
      verb={F.verb}
      on={!busy}
      first={input}
      onDismiss={onClose}
      onConfirm={send}
    >
      <Note>{F.intro}</Note>
      <div className="desk-fields">
        <Field
          label={F.field}
          value={typed}
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
  );
}

export function SentDialog({ onDone, onAgain }: { onDone: () => void; onAgain: () => void }) {
  return (
    <Dialog
      title={F.sentTitle}
      verb={F.sentVerb}
      cancel={false}
      onDismiss={onDone}
      onConfirm={onDone}
    >
      <Note>{F.sentIntro}</Note>
      <div className="security-there">
        <p className="security-there-title">{F.nothingThere}</p>
        <p className="desk-note">{F.spam}</p>
      </div>
      <button type="button" className="desk-text" onClick={onAgain}>
        {F.again}
      </button>
      <p className="desk-note">{F.providerNote}</p>
      <p className="desk-note">{F.gotLink}</p>
    </Dialog>
  );
}

export function SetCodeDialog({
  start,
  email,
  onClose,
  onMatched,
}: {
  start: DialogStart;
  email: string;
  onClose: () => void;
  onMatched: () => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const resend = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState(start.typed);
  const [error, setError] = useState(() => (start.tried ? emailedCodeRefusal(start.typed) : null));
  const [expired, setExpired] = useState(start.expired);
  const [left, setLeft] = useState(start.expired ? 0 : RESEND_FROM);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (expired || left <= 0) return;
    const tick = window.setTimeout(() => setLeft(left - 1), 1000);

    return () => window.clearTimeout(tick);
  }, [expired, left]);

  function go(): void {
    if (busy || expired) return;
    const refusal = emailedCodeRefusal(typed);
    setError(refusal);
    if (refusal != null) return input.current?.focus();
    setBusy(true);
    later(SEND_MS, onMatched);
  }

  return (
    <Dialog
      title={P.codeTitle}
      verb={P.codeVerb}
      on={!expired && !busy}
      first={expired ? resend : input}
      onDismiss={onClose}
      onConfirm={go}
    >
      <Note>{P.codeIntro(email)}</Note>
      {expired ? (
        <ExpiredCode title={V.expired} line={V.expiredLine(P.codeNewest)} />
      ) : (
        <div className="desk-fields security-fields">
          <Field
            label={P.codeField}
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
          onClick={() => {
            setTyped('');
            setError(null);
            setExpired(false);
            setLeft(RESEND_FROM);
            window.requestAnimationFrame(() => input.current?.focus());
          }}
        >
          {left > 0 ? V.resendIn(left) : V.resend}
        </button>
        <p className="desk-note">{V.resendNote}</p>
      </div>
      <Note>{P.codeNote}</Note>
    </Dialog>
  );
}

export function ChooseDialog({
  start,
  email,
  onClose,
  onAdded,
}: {
  start: DialogStart;
  email: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start.typed);
  const [error, setError] = useState(() => (start.tried ? chooseRefusal(start.typed) : null));
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start.discarding);

  function save(): void {
    if (busy) return;
    const refusal = chooseRefusal(typed);
    setError(refusal);
    if (refusal != null) return input.current?.focus();
    setBusy(true);
    later(SEND_MS, onAdded);
  }

  return (
    <>
      <Dialog
        title={P.chooseTitle}
        verb={P.verb}
        on={!busy}
        first={input}
        onDismiss={() => (typed === '' ? onClose() : setAsking(true))}
        onConfirm={save}
      >
        <div className="desk-fields">
          <Field
            label={P.chooseField}
            value={typed}
            secret
            autoComplete="new-password"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
        <Rule password={typed} />
        <Note>{P.addedEmailed(email)}</Note>
      </Dialog>
      {asking && (
        <Discard line={DISCARD.nothingAdded} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

/** Confirm it's you: a proof, not an edit, so Cancel closes it at once whatever is typed. */
export function ProveDialog({
  start,
  asks,
  purpose,
  onClose,
  onProved,
}: {
  start: DialogStart;
  asks: ProveAsks;
  purpose: Purpose;
  onClose: () => void;
  onProved: () => void;
}) {
  const later = useLater();
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState(start.typed);
  const [code, setCode] = useState(start.second);
  const [problems, setProblems] = useState(() =>
    start.tried ? proveProblems(asks, purpose, start.typed, start.second) : {},
  );
  const [busy, setBusy] = useState(false);

  function go(): void {
    if (busy) return;
    const found = proveProblems(asks, purpose, password, code);
    setProblems(found);
    if (found.password != null) return passwordRef.current?.focus();
    if (found.code != null) return codeRef.current?.focus();
    setBusy(true);
    later(SEND_MS, onProved);
  }

  return (
    <Dialog
      title={C.title}
      verb={C.verb}
      on={!busy}
      first={asks.password && problems.code == null ? passwordRef : codeRef}
      onDismiss={onClose}
      onConfirm={go}
    >
      <Note>{asks.lead}</Note>
      {asks.note != null && <p className="desk-note">{asks.note}</p>}
      {asks.provider != null && <Note strong>{C.withProvider(asks.provider)}</Note>}
      {(asks.password || asks.code) && (
        <div className="desk-fields security-fields">
          {asks.password && (
            <Field
              label={C.password}
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
          )}
          {asks.code && (
            <Field
              label={C.code}
              value={code}
              help={asks.codeHelp}
              autoComplete="one-time-code"
              inputRef={codeRef}
              error={problems.code ?? null}
              onChange={(value) => {
                setCode(value);
                setProblems(({ password: kept }) => (kept == null ? {} : { password: kept }));
              }}
            />
          )}
        </div>
      )}
    </Dialog>
  );
}

export function SetupDialog({
  start,
  onClose,
  onOn,
}: {
  start: DialogStart;
  onClose: () => void;
  onOn: () => void;
}) {
  const later = useLater();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start.typed);
  const [error, setError] = useState(() => (start.tried ? setupRefusal(start.typed) : null));
  const [busy, setBusy] = useState(false);

  function turnOn(): void {
    if (busy) return;
    const refusal = setupRefusal(typed);
    setError(refusal);
    if (refusal != null) return input.current?.focus();
    setBusy(true);
    later(SEND_MS, onOn);
  }

  return (
    <Dialog
      title={U.title}
      verb={U.verb}
      on={!busy}
      first={input}
      onDismiss={onClose}
      onConfirm={turnOn}
    >
      <p className="security-scan">{U.scan}</p>
      <svg className="security-qr" viewBox="0 0 21 21" role="img" aria-label={U.qr}>
        <path d={QR} fill="currentColor" fillRule="evenodd" />
      </svg>
      <Note>{U.cantScan}</Note>
      <p className="security-key" aria-label={U.key}>
        {keyInGroups(AUTHENTICATOR_KEY)}
      </p>
      <div className="desk-fields security-fields">
        <Field
          label={U.field}
          value={typed}
          help={U.staysOff}
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
    </Dialog>
  );
}

/** The codes, once: no Cancel, since two-factor is already on, and Finish waits for the box so a slip cannot lose them. */
export function RecoveryDialog({
  start,
  codes,
  onFinish,
}: {
  start: DialogStart;
  codes: readonly string[];
  onFinish: () => void;
}) {
  const [copied, setCopied] = useState(start.copied);
  const [saved, setSaved] = useState(start.saved);
  const box = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      title={R.title}
      verb={R.verb}
      cancel={false}
      on={saved}
      locked={!saved}
      first={box}
      onDismiss={onFinish}
      onConfirm={onFinish}
    >
      <Note>{R.intro}</Note>
      <ul className="security-codes" aria-label={R.list}>
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="desk-red">
        <button
          type="button"
          className="desk-text"
          onClick={() =>
            void copyText(codes.join('\n')).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          <Glyph name={copied ? 'tick' : 'copy'} size={17} weight={2.3} />
          {copied ? R.copied : R.copyAll}
        </button>
        <div role="status">{copied && <p className="desk-note">{R.copiedAll}</p>}</div>
      </div>
      <label className="security-check">
        <input
          ref={box}
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        {R.saved}
      </label>
      <p className="desk-note" aria-live="polite">
        {saved ? R.ready : R.locked}
      </p>
    </Dialog>
  );
}
