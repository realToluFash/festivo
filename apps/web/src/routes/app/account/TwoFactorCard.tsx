import { ApiError, type TwoFactorEnrolment, type TwoFactorStatus } from '@soirely/api-client';
import { cleanCode, codeProblem, formatTimeOfDay, keyInGroups, lockLiftsAt } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { Pending } from '../../../components/Pending.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { refreshAccount, useSessionState } from '../../../session.ts';

type Stage =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'at-rest'; status: TwoFactorStatus }
  | { kind: 'setting-up'; enrolment: TwoFactorEnrolment }
  | { kind: 'saving-codes'; codes: string[] }
  | { kind: 'turning-off' }
  | { kind: 'new-codes' };

/** Settings > Security, the two-factor card. `onBusy` hides the other cards while setup runs. */
export function TwoFactorCard({
  email,
  onBusy,
  recount,
}: {
  email: string;
  onBusy: (busy: boolean) => void;
  /** Changes when another card spent a code, so the unused count is asked for again. */
  recount: number;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refusedBy, setRefusedBy] = useState<string | null>(null);
  const sessionState = useSessionState();
  // sc-609: the server refuses it too; this says so before a code is asked for.
  const keptBy =
    sessionState.status === 'signedIn'
      ? (sessionState.session.organisations.find((one) => one.signInRules.everyoneNeedsTwoFactor)
          ?.name ?? null)
      : null;

  useEffect(() => {
    let live = true;

    api
      .twoFactorStatus()
      .then((status) => {
        if (live) setStage({ kind: 'at-rest', status });
      })
      .catch(() => {
        if (live) setStage({ kind: 'failed' });
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (recount === 0) return;
    let live = true;

    api
      .twoFactorStatus()
      .then((status) => {
        if (live) setStage((now) => (now.kind === 'at-rest' ? { kind: 'at-rest', status } : now));
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [recount]);

  const busy = stage.kind === 'setting-up' || stage.kind === 'saving-codes';
  useEffect(() => onBusy(busy), [busy, onBusy]);

  function reload(): void {
    setStage({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  async function turnOn(): Promise<void> {
    try {
      setStage({ kind: 'setting-up', enrolment: await api.enrolTwoFactor() });
    } catch {
      setStage({ kind: 'failed' });
    }
  }

  return (
    <section className="card" aria-labelledby="two-factor-title">
      {stage.kind === 'loading' && <Pending />}

      {stage.kind === 'failed' && (
        <>
          <h2 id="two-factor-title">{t('twoFactorCard.title')}</h2>
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <div className="notice-body">
              <p className="notice-title">{t('twoFactorCard.failedTitle')}</p>
              <p>{t('twoFactorCard.failedBody')}</p>
            </div>
            <button className="button" type="button" onClick={reload}>
              {t('error.retry')}
            </button>
          </div>
        </>
      )}

      {stage.kind === 'at-rest' && (
        <AtRest
          status={stage.status}
          onTurnOn={() => void turnOn()}
          refusedBy={refusedBy}
          onTurnOff={() =>
            keptBy == null ? setStage({ kind: 'turning-off' }) : setRefusedBy(keptBy)
          }
          onNewCodes={() => setStage({ kind: 'new-codes' })}
        />
      )}

      {stage.kind === 'setting-up' && (
        <SettingUp
          enrolment={stage.enrolment}
          onActivated={(codes) => {
            setStage({ kind: 'saving-codes', codes });
            if (sessionState.status === 'signedIn') void refreshAccount();
          }}
          onCancel={reload}
        />
      )}

      {stage.kind === 'saving-codes' && <SavingCodes codes={stage.codes} onFinish={reload} />}

      {stage.kind === 'turning-off' && (
        <TurningOff
          email={email}
          onOff={reload}
          onKeep={reload}
          onKept={(organisation) => {
            setRefusedBy(organisation);
            reload();
          }}
        />
      )}

      {stage.kind === 'new-codes' && (
        <ConfirmNewCodes
          onMade={(codes) => setStage({ kind: 'saving-codes', codes })}
          onKeep={reload}
        />
      )}
    </section>
  );
}

function AtRest({
  status,
  refusedBy,
  onTurnOn,
  onTurnOff,
  onNewCodes,
}: {
  status: TwoFactorStatus;
  refusedBy: string | null;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onNewCodes: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="card-heading">
        <h2 id="two-factor-title">{t('twoFactorCard.title')}</h2>
        {/* A mark and the word, never the colour alone. */}
        <span className={status.on ? 'status-done' : 'card-count'}>
          <span className={status.on ? 'mark mark-done' : 'mark mark-off'} aria-hidden="true">
            {status.on ? '✓' : ''}
          </span>
          {status.on ? t('twoFactorCard.on') : t('twoFactorCard.off')}
        </span>
      </div>

      {status.on ? (
        <>
          <p>{t('twoFactorCard.onIntro')}</p>
          <div className="two-factor-codes-row">
            <div>
              <p className="notice-title">{t('twoFactorCard.recoveryCodes')}</p>
              <p className="card-count">
                {t('twoFactorCard.unused', { left: status.recoveryCodesLeft, total: 10 })}
              </p>
            </div>
            <button className="button" type="button" onClick={onNewCodes}>
              {t('twoFactorCard.makeNewCodes')}
            </button>
          </div>
          <div className="actions">
            <button className="button" type="button" onClick={onTurnOff}>
              {t('twoFactorCard.turnOff')}
            </button>
          </div>
          {refusedBy != null && (
            <div className="notice notice-attention" role="alert">
              <span className="mark mark-attention" aria-hidden="true">
                !
              </span>
              <p>{t('twoFactorCard.keptByRule', { organisation: refusedBy })}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <p>{t('twoFactorCard.offIntro')}</p>
          <div className="actions">
            <button className="button button-primary" type="button" onClick={onTurnOn}>
              {t('twoFactorCard.turnOn')}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function SettingUp({
  enrolment,
  onActivated,
  onCancel,
}: {
  enrolment: TwoFactorEnrolment;
  onActivated: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (checking) return;

    const found = codeProblem(typed);
    if (found != null) {
      setError(found === 'blank' ? t('twoFactor.codeBlank') : t('twoFactor.codeLength'));
      document.getElementById('setup-code')?.focus();
      return;
    }

    setChecking(true);

    try {
      onActivated(await api.activateTwoFactor(cleanCode(typed)));
    } catch (refusal) {
      setChecking(false);
      setError(
        refusal instanceof ApiError && refusal.is('too_many_attempts')
          ? pausedMessage(refusal, t)
          : refusal instanceof ApiError && refusal.is('two_factor_code_invalid')
            ? t('twoFactorCard.setupWrong')
            : t('twoFactorCard.failedBody'),
      );
    }
  }

  return (
    <>
      <h2 id="two-factor-title">{t('twoFactorCard.setupTitle')}</h2>

      <ol className="two-factor-steps">
        <li>
          <p className="notice-title">{t('twoFactorCard.scan')}</p>
          <img
            className="two-factor-qr"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrolment.qrSvg)}`}
            alt={t('twoFactorCard.qrAlt')}
            width={160}
            height={160}
          />
          <p>{t('twoFactorCard.cantScan')}</p>
          <p className="two-factor-key">{keyInGroups(enrolment.secret)}</p>
        </li>

        <li>
          <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
            <div className="field">
              <label htmlFor="setup-code">{t('twoFactorCard.enterCode')}</label>
              <input
                className={error == null ? 'input' : 'input input-wrong'}
                id="setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                value={typed}
                disabled={checking}
                aria-invalid={error != null}
                aria-describedby={error == null ? 'setup-note' : 'setup-code-error setup-note'}
                onChange={(event) => {
                  setTyped(event.target.value);
                  setError(null);
                }}
              />
              {error != null && <FieldError id="setup-code-error" message={error} />}
              <p className="field-help" id="setup-note">
                {t('twoFactorCard.staysOff')}
              </p>
            </div>

            <div className="actions">
              <button className="button button-primary" type="submit" aria-busy={checking}>
                {t('twoFactorCard.checkCode')}
              </button>
              <button className="button" type="button" onClick={onCancel}>
                {t('twoFactorCard.cancel')}
              </button>
            </div>
          </form>
        </li>
      </ol>
    </>
  );
}

function SavingCodes({ codes, onFinish }: { codes: string[]; onFinish: () => void }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyAll(): Promise<void> {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <h2 id="two-factor-title">{t('twoFactorCard.saveTitle')}</h2>
      <p>{t('twoFactorCard.saveIntro')}</p>

      <ul className="recovery-codes" aria-label={t('twoFactorCard.recoveryCodes')}>
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <div className="actions">
        <button className="button" type="button" onClick={() => void copyAll()}>
          {copied ? `✓ ${t('twoFactorCard.copied')}` : t('twoFactorCard.copyAll')}
        </button>
      </div>
      {copied && (
        <p className="status-done" role="status">
          {t('twoFactorCard.copiedAll', { count: codes.length })}
        </p>
      )}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        {t('twoFactorCard.savedThem')}
      </label>

      <p className="field-help" id="finish-note">
        {saved ? t('twoFactorCard.finishReady') : t('twoFactorCard.finishLocked')}
      </p>
      <div className="actions">
        <button
          className="button button-primary"
          type="button"
          disabled={!saved}
          aria-describedby="finish-note"
          onClick={onFinish}
        >
          {t('twoFactorCard.finish')}
        </button>
      </div>
    </>
  );
}

function TurningOff({
  email,
  onOff,
  onKeep,
  onKept,
}: {
  email: string;
  onOff: () => void;
  onKeep: () => void;
  onKept: (organisation: string) => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (checking) return;

    if (typed.trim() === '') {
      setError(t('twoFactorCard.offBlank'));
      document.getElementById('off-code')?.focus();
      return;
    }

    setChecking(true);

    try {
      await api.disableTwoFactor(typed.trim());
      onOff();
    } catch (refusal) {
      if (refusal instanceof ApiError && refusal.is('two_factor_kept_by_rule')) {
        onKept(refusal.problem.organisation ?? '');
        return;
      }

      setChecking(false);
      setError(
        refusal instanceof ApiError && refusal.is('too_many_attempts')
          ? pausedMessage(refusal, t)
          : refusal instanceof ApiError && refusal.is('recovery_code_used')
            ? t('twoFactor.recoveryUsed')
            : refusal instanceof ApiError && refusal.is('two_factor_code_invalid')
              ? t('twoFactorCard.offWrong')
              : t('twoFactorCard.failedBody'),
      );
    }
  }

  return (
    <>
      <h2 id="two-factor-title">{t('twoFactorCard.offTitle')}</h2>
      <p>{t('twoFactorCard.offBody')}</p>

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="off-code">{t('twoFactor.code')}</label>
          <input
            className={error == null ? 'input' : 'input input-wrong'}
            id="off-code"
            type="text"
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            disabled={checking}
            aria-invalid={error != null}
            aria-describedby={error == null ? 'off-note' : 'off-code-error off-note'}
            onChange={(event) => {
              setTyped(event.target.value);
              setError(null);
            }}
          />
          {error != null && <FieldError id="off-code-error" message={error} />}
          <p className="field-help" id="off-note">
            {t('twoFactorCard.offEmail', { email })}
          </p>
        </div>

        <div className="actions">
          <button className="button button-dark" type="submit" aria-busy={checking}>
            {t('twoFactorCard.turnItOff')}
          </button>
          <button className="button" type="button" onClick={onKeep}>
            {t('twoFactorCard.keepItOn')}
          </button>
        </div>
      </form>
    </>
  );
}

function ConfirmNewCodes({
  onMade,
  onKeep,
}: {
  onMade: (codes: string[]) => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Changing a factor takes the current one, or a stolen session could mint codes past it.
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (checking) return;

    if (typed.trim() === '') {
      setError(t('twoFactorCard.offBlank'));
      document.getElementById('new-codes-code')?.focus();
      return;
    }

    setChecking(true);

    try {
      onMade(await api.newRecoveryCodes(typed.trim()));
    } catch (refusal) {
      setChecking(false);
      setError(
        refusal instanceof ApiError && refusal.is('too_many_attempts')
          ? pausedMessage(refusal, t)
          : refusal instanceof ApiError && refusal.is('recovery_code_used')
            ? t('twoFactor.recoveryUsed')
            : refusal instanceof ApiError && refusal.is('two_factor_code_invalid')
              ? t('twoFactorCard.offWrong')
              : t('twoFactorCard.failedBody'),
      );
    }
  }

  return (
    <>
      <h2 id="two-factor-title">{t('twoFactorCard.newTitle')}</h2>
      <div className="notice notice-attention">
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <div className="notice-body">
          <p className="notice-title">{t('twoFactorCard.newWarningTitle')}</p>
          <p>{t('twoFactorCard.newWarningBody')}</p>
        </div>
      </div>

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="new-codes-code">{t('twoFactor.code')}</label>
          <input
            className={error == null ? 'input' : 'input input-wrong'}
            id="new-codes-code"
            type="text"
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            disabled={checking}
            aria-invalid={error != null}
            aria-describedby={error == null ? 'new-codes-note' : 'new-codes-error new-codes-note'}
            onChange={(event) => {
              setTyped(event.target.value);
              setError(null);
            }}
          />
          {error != null && <FieldError id="new-codes-error" message={error} />}
          <p className="field-help" id="new-codes-note">
            {t('twoFactorCard.offBody')}
          </p>
        </div>

        <div className="actions">
          <button className="button button-primary" type="submit" aria-busy={checking}>
            {t('twoFactorCard.makeNewCodes')}
          </button>
          <button className="button" type="button" onClick={onKeep}>
            {t('twoFactorCard.keepCodes')}
          </button>
        </div>
      </form>
    </>
  );
}

/** The lockout, in the reader's own clock and words: the time comes from Retry-After. */
function pausedMessage(refusal: ApiError, t: TFunction): string {
  const liftsAt = lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')));

  return liftsAt == null
    ? t('twoFactorCard.failedBody')
    : t('twoFactor.pausedBody', { time: formatTimeOfDay(liftsAt, dateLocale()) });
}
