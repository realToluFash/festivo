import { cleanCode } from '@soirely/domain';
import i18next from 'i18next';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { Lead } from '../components/AccountParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Chevron, Dialog, Field, Note, RowWords } from '../components/SettingsParts.tsx';
import { offButton } from '../offButton.ts';
import { DemoOnly } from './SingleSignOnParts.tsx';
import { Notice, useBusy } from './parts.tsx';
import { type CodeStep, type FactorRow, PASSKEY_WORDS as P, passkeyName } from './passkeys.ts';
import { LOCK_MS, SAMPLE, TRIES, timeOfDay } from './rules.ts';
import './passkeys.css';

/** Synced or This device only, from the BS flag: a shape with its word, never colour alone. */
export function PasskeyMark({ synced }: { synced: boolean }) {
  return (
    <span className="passkey-mark">
      {synced ? (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.5 19H8a5 5 0 1 1 1.1-9.9A6 6 0 0 1 20.6 11 4 4 0 0 1 17.5 19Z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
      )}
      {synced ? P.synced : P.deviceOnly}
    </span>
  );
}

export function FactorOpenable({
  row,
  day,
  on,
  onToggle,
  children,
}: {
  row: FactorRow;
  day: (when: Date) => string;
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const title = row.kind === 'app' ? 'Authenticator app' : passkeyName(row.passkey);
  const lines: ReactNode[] =
    row.kind === 'app'
      ? [P.appOn(day(row.on))]
      : [
          <span key="line" className="passkey-line">
            <PasskeyMark synced={row.passkey.synced} />
            <span aria-hidden="true">·</span>
            {P.added(day(row.passkey.added))}
          </span>,
        ];

  return (
    <li>
      <button
        type="button"
        className={on ? 'desk-row account-row is-open' : 'desk-row account-row'}
        aria-expanded={on}
        aria-controls={on ? id : undefined}
        onClick={onToggle}
      >
        {row.kind === 'app' ? <Lead name="shield" /> : <PasskeyLead />}
        <RowWords
          title={
            row.kind === 'passkey' && row.passkey.provider != null ? (
              <>
                {title}
                <span className="desk-unseen"> {P.passkey}</span>
              </>
            ) : (
              title
            )
          }
          lines={lines}
        />
        <Glyph name={on ? 'chevup' : 'chevdown'} size={18} weight={2.4} className="desk-chevron" />
      </button>
      {on && (
        <div id={id} className="account-open" role="group" aria-label={title}>
          {children}
        </div>
      )}
    </li>
  );
}

export function PasskeyLead() {
  return (
    <span className="account-lead passkey-lead" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24">
        <circle cx="9" cy="7.5" r="3.5" />
        <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3" />
        <circle cx="17" cy="13.5" r="2.5" />
        <path d="M17 16v5.5M17 19h2" />
      </svg>
    </span>
  );
}

export function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="desk-row account-row" onClick={onClick}>
        <span className="account-lead" aria-hidden="true">
          <Glyph name="plus" size={22} />
        </span>
        <RowWords title={label} />
        <Chevron />
      </button>
    </li>
  );
}

export type SheetKind = 'get' | 'create';

/** The browser's own sheet, which Soirely never draws: the demo stands in for it here, and sends nothing. */
export function SheetStandIn({
  kind,
  onUse,
  onCancel,
  onRefused,
  onExists,
  onLapse,
}: {
  kind: SheetKind;
  onUse: () => void;
  onCancel: () => void;
  onRefused?: () => void;
  onExists?: () => void;
  onLapse?: () => void;
}) {
  return (
    <DemoOnly>
      <p>
        Demo: the browser’s passkey sheet is open over this page. The browser draws it, not Soirely.
      </p>
      <div className="passkey-sheet-acts">
        <button type="button" className="button demo-dense" onClick={onUse}>
          {kind === 'get' ? 'Demo: use the passkey' : 'Demo: save the passkey'}
        </button>
        <button type="button" className="button demo-dense" onClick={onCancel}>
          Demo: cancel the sheet
        </button>
        {onRefused != null && (
          <button type="button" className="button demo-dense" onClick={onRefused}>
            {kind === 'get' ? 'Demo: a passkey that does not work' : 'Demo: the sheet times out'}
          </button>
        )}
        {onExists != null && (
          <button type="button" className="button demo-dense" onClick={onExists}>
            Demo: one is already saved here
          </button>
        )}
        {onLapse != null && (
          <button type="button" className="button demo-dense" onClick={onLapse}>
            Demo: 5 minutes pass
          </button>
        )}
      </div>
    </DemoOnly>
  );
}

export function Waiting() {
  return (
    <p className="passkey-waiting" role="status">
      <span className="pending-spinner desk-turning" aria-hidden="true" />
      {P.waiting}
    </p>
  );
}

export function Refused() {
  return (
    <p className="passkey-refused" role="alert">
      <Glyph name="alert" size={18} weight={2.2} />
      {P.refused}
    </p>
  );
}

export function NoBrowser() {
  return (
    <p className="passkey-nobrowser">
      <Glyph name="info" size={18} weight={2.2} />
      {P.noBrowser}
    </p>
  );
}

interface Waits {
  sheet: boolean;
  refused: boolean;
  liftsAt: number | null;
}

export interface WaitsStart {
  sheet?: boolean;
  refused?: boolean;
  paused?: boolean;
  wrongs?: number;
}

function useWaits(start: WaitsStart) {
  const [waits, setWaits] = useState<Waits>(() => ({
    sheet: start.sheet ?? true,
    refused: start.refused ?? false,
    liftsAt: start.paused === true ? Date.now() + LOCK_MS : null,
  }));
  const [wrongs, setWrongs] = useState(start.wrongs ?? 0);

  useEffect(() => {
    if (waits.liftsAt == null) return;
    const lift = window.setTimeout(
      () => setWaits((now) => ({ ...now, liftsAt: null })),
      Math.max(0, waits.liftsAt - Date.now()),
    );
    return () => window.clearTimeout(lift);
  }, [waits.liftsAt]);

  return {
    waits,
    open: () => setWaits({ sheet: true, refused: false, liftsAt: null }),
    cancel: () => setWaits((now) => ({ ...now, sheet: false })),
    refuse: () => {
      if (wrongs + 1 >= TRIES) {
        setWrongs(0);
        setWaits({ sheet: false, refused: false, liftsAt: Date.now() + LOCK_MS });
        return;
      }
      setWrongs(wrongs + 1);
      setWaits({ sheet: false, refused: true, liftsAt: null });
    },
  };
}

export function PasskeyDialog({
  lead,
  start,
  onClose,
  onPassed,
  onCode,
}: {
  lead: string;
  start?: WaitsStart;
  onClose: () => void;
  onPassed: () => void;
  onCode: () => void;
}) {
  const { waits, open, cancel, refuse } = useWaits(start ?? {});
  const [busy, after] = useBusy();
  const code = useRef<HTMLButtonElement>(null);
  const until = waits.liftsAt == null ? null : timeOfDay(waits.liftsAt);

  return (
    <Dialog
      title={P.proveTitle}
      verb={until == null ? P.usePasskey : P.tryAt(until)}
      on={!waits.sheet && until == null && !busy}
      locked={busy}
      first={code}
      onDismiss={onClose}
      onConfirm={() => {
        if (!waits.sheet && until == null && !busy) open();
      }}
    >
      <Note>{lead}</Note>
      <Note strong>{P.waitTitle}</Note>
      <p className="desk-note">{P.waitLine}</p>
      {until != null && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <p>
            {P.pausedTitle}. {P.paused(until)}
          </p>
        </div>
      )}
      {waits.sheet && <Waiting />}
      {waits.refused && <Refused />}
      <div className="account-acts">
        <button ref={code} type="button" className="desk-text" onClick={onCode}>
          {P.useCode}
        </button>
      </div>
      {waits.sheet && (
        <SheetStandIn
          kind="get"
          onUse={() => after(onPassed)}
          onCancel={cancel}
          onRefused={refuse}
        />
      )}
    </Dialog>
  );
}

export function CodeStepDialog({
  step,
  webauthn,
  lead,
  help,
  onClose,
  onPassed,
  onPasskey,
}: {
  step: CodeStep;
  webauthn: boolean;
  lead?: string | undefined;
  help?: string | undefined;
  onClose: () => void;
  onPassed: () => void;
  onPasskey: (() => void) | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, after] = useBusy();
  const recovery = step === 'recovery';

  function go(): void {
    if (busy) return;
    if (typed.trim() === '') {
      setError(recovery ? P.recoveryBlank : P.codeBlank);
      return input.current?.focus();
    }
    after(() => {
      const factor = cleanCode(typed).toLowerCase();
      if (factor === SAMPLE.recovery || (!recovery && factor === SAMPLE.authenticator))
        return onPassed();
      setError(P.codeWrong);
      input.current?.focus();
    });
  }

  return (
    <Dialog
      title={P.proveTitle}
      verb={P.continue}
      on={!busy}
      locked={busy}
      first={input}
      onDismiss={onClose}
      onConfirm={go}
    >
      {!webauthn && <NoBrowser />}
      {lead != null && <Note>{lead}</Note>}
      <Note strong>{recovery ? P.recoveryLead : P.codeLead}</Note>
      <div className="desk-fields security-fields">
        <Field
          label={recovery ? P.recoveryLabel : P.codeLabel}
          value={typed}
          help={help ?? (recovery ? P.recoveryHelp : P.codeHelp)}
          autoComplete="one-time-code"
          inputRef={input}
          error={error}
          onChange={(value) => {
            setTyped(value);
            setError(null);
          }}
        />
      </div>
      {onPasskey != null && (
        <div className="account-acts">
          <button type="button" className="desk-text" onClick={onPasskey}>
            {P.usePasskeyInstead}
          </button>
        </div>
      )}
    </Dialog>
  );
}

export function ChoiceDialog({
  making: startMaking = false,
  onClose,
  onApp,
  onMade,
}: {
  making?: boolean;
  onClose: () => void;
  onApp: () => void;
  onMade: () => void;
}) {
  const [making, setMaking] = useState(startMaking);
  const [busy, after] = useBusy();
  const first = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      title={P.choiceTitle}
      verb={null}
      locked={busy}
      first={first}
      onDismiss={onClose}
      onConfirm={() => undefined}
    >
      <Note strong>{P.choiceAsk}</Note>
      <ul className="desk-rows account-rows passkey-choices">
        <li>
          <button
            ref={first}
            type="button"
            className="desk-row account-row"
            aria-busy={making || undefined}
            {...offButton(making, { dim: false })}
            onClick={() => setMaking(true)}
          >
            <PasskeyLead />
            <RowWords title={P.usePasskey} lines={[making ? P.waiting : P.usePasskeyLine]} />
            {making ? (
              <span className="pending-spinner desk-turning" aria-hidden="true" />
            ) : (
              <Chevron />
            )}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="desk-row account-row"
            {...offButton(making)}
            onClick={onApp}
          >
            <Lead name="shield" />
            <RowWords title={P.useApp} lines={[P.useAppLine]} />
            <Chevron />
          </button>
        </li>
      </ul>
      <div role="status" className="desk-unseen">
        {making ? P.waiting : ''}
      </div>
      <p className="desk-foot">{P.ownDevice}</p>
      {making && (
        <SheetStandIn
          kind="create"
          onUse={() => after(onMade)}
          onCancel={() => setMaking(false)}
          onRefused={() => setMaking(false)}
        />
      )}
    </Dialog>
  );
}

export function MakeDialog({
  exists,
  onClose,
  onMade,
  onExists,
}: {
  exists: boolean;
  onClose: () => void;
  onMade: () => void;
  onExists: () => void;
}) {
  const [busy, after] = useBusy();

  return (
    <Dialog
      title={P.makeTitle}
      verb={null}
      locked={busy}
      onDismiss={onClose}
      onConfirm={() => undefined}
    >
      <Note>{P.makeLine}</Note>
      <Waiting />
      <p className="desk-foot">{P.ownDevice}</p>
      {exists ? (
        <DemoOnly>
          <p>
            Demo: the browser’s sheet says this password manager already holds a passkey for
            soirely.com. Soirely adds nothing and says nothing more: closing it leaves the list as
            it was.
          </p>
          <div className="passkey-sheet-acts">
            <button type="button" className="button demo-dense" onClick={onClose}>
              Demo: close the sheet
            </button>
          </div>
        </DemoOnly>
      ) : (
        <SheetStandIn
          kind="create"
          onUse={() => after(onMade)}
          onCancel={onClose}
          onRefused={onClose}
          onExists={onExists}
        />
      )}
    </Dialog>
  );
}

/** sc-86885: adding the app beside passkeys is today's setup step; only its title, verb and help line read true for two-factor already on. */
export function AddAppWords({ children }: { children: ReactNode }) {
  const [words] = useState(() => {
    const local = i18next.cloneInstance({ forkResourceStore: true });
    for (const language of local.languages) {
      local.addResource(language, 'translation', 'security.setupTitle', P.addApp);
      local.addResource(language, 'translation', 'security.setupVerb', P.addAppVerb);
      local.addResource(language, 'translation', 'twoFactorCard.staysOff', P.addAppLine);
    }
    return local;
  });

  return <I18nextProvider i18n={words}>{children}</I18nextProvider>;
}

export function PasskeyStep({
  lead,
  start,
  onPassed,
  onCode,
  onLapse,
}: {
  lead: string;
  start: WaitsStart;
  onPassed: () => void;
  onCode: () => void;
  onLapse: (() => void) | null;
}) {
  const { waits, open, cancel, refuse } = useWaits(start);
  const [busy, after] = useBusy();
  const until = waits.liftsAt == null ? null : timeOfDay(waits.liftsAt);

  return (
    <>
      <div className="demo-heading">
        <h1>{P.waitTitle}</h1>
        <p className="demo-muted">{lead}</p>
        {until != null && <Notice title={P.pausedTitle} body={P.paused(until)} alert />}
      </div>
      {waits.sheet || busy ? (
        <Waiting />
      ) : (
        <button
          className="button button-primary demo-wide"
          type="button"
          {...offButton(until != null)}
          onClick={open}
        >
          {until == null ? P.usePasskey : P.tryAt(until)}
        </button>
      )}
      <div className="demo-asides">
        <button className="link-button demo-link" type="button" onClick={onCode}>
          {P.useCode}
        </button>
      </div>
      {waits.refused && <Refused />}
      {waits.sheet && !busy && (
        <SheetStandIn
          kind="get"
          onUse={() => after(onPassed)}
          onCancel={cancel}
          onRefused={refuse}
          {...(onLapse == null ? {} : { onLapse })}
        />
      )}
    </>
  );
}
