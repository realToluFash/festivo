import {
  ApiError,
  type LinkedProvider,
  type Provider,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { PROOF_MINUTES, proveWith, providerRows, type ProviderRow } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { ConfirmItsYou } from '../../../components/ConfirmItsYou.tsx';
import { AppleMark, GoogleMark } from '../../../components/ProviderSignIn.tsx';
import {
  PROVIDER_NAMES,
  type ProviderReturn,
  startProviderSignIn,
  takeProviderReturn,
} from '../../../providerSignIn.ts';
import { heldProof, holdProof } from '../../../recentProof.ts';

type Act = { action: 'link' | 'unlink'; provider: Provider };

type Notice =
  | { kind: 'linked'; provider: Provider; email: string | null }
  | {
      kind: 'unlinked' | 'taken' | 'last' | 'providerFailed' | 'providerRefused';
      provider: Provider;
    }
  | { kind: 'keptByRule'; provider: Provider; organisation: string }
  | { kind: 'failed' };

type Stage =
  | { kind: 'list'; notice: Notice | null }
  | { kind: 'proving'; act: Act; returned: ProviderSignInAttempt | null }
  | { kind: 'confirming'; act: Act }
  | { kind: 'working' };

/** Settings > Security, between Password and Two-factor: link or unlink Google and Apple (sc-510). */
export function WaysCard({
  email,
  hasPassword,
  providers,
  onChanged,
  onSetPassword,
  onSignedOutHere,
  onCodeSpent,
}: {
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  onChanged: () => Promise<void>;
  onSetPassword: () => void;
  onSignedOutHere: () => void;
  /** A two-factor or recovery code was accepted, so the two-factor card's count may be stale. */
  onCodeSpent: () => void;
}) {
  const { t } = useTranslation();
  const [returned] = useState<ProviderReturn | null>(takeProviderReturn);
  const [stage, setStage] = useState<Stage>(() =>
    returned == null || ('failed' in returned && returned.failed === 'cancelled')
      ? { kind: 'list', notice: null }
      : 'failed' in returned
        ? { kind: 'list', notice: { kind: 'providerFailed', provider: returned.provider } }
        : { kind: 'working' },
  );
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const started = useRef(false);
  const rows = providerRows(hasPassword, providers);

  function begin(act: Act): void {
    if (heldProof() == null) setStage({ kind: 'proving', act, returned: null });
    else void proceed(act);
  }

  async function proceed(act: Act): Promise<void> {
    if (act.action === 'unlink') {
      setStage({ kind: 'confirming', act });

      return;
    }

    setStage({ kind: 'working' });

    try {
      await startProviderSignIn(act.provider, { kind: 'link' });
    } catch {
      setStage({ kind: 'list', notice: { kind: 'providerFailed', provider: act.provider } });
    }
  }

  /** Back from a provider trip Security started, once two-factor's state is known. */
  async function finish(back: ProviderReturn, codeNeeded: boolean): Promise<void> {
    if (
      'failed' in back ||
      back.purpose.kind === 'signOutOthers' ||
      back.purpose.kind === 'makePrimary'
    )
      return;

    if (back.purpose.kind === 'link') {
      await link(back.provider, back.signIn);

      return;
    }

    const then = back.purpose.then;

    if (codeNeeded) {
      setStage({ kind: 'proving', act: then, returned: back.signIn });

      return;
    }

    try {
      holdProof(await api.prove({ provider: back.provider, signIn: back.signIn }));
      await proceed(then);
    } catch (error) {
      const refused = error instanceof ApiError && error.is('invalid_credentials');
      setStage({
        kind: 'list',
        notice: { kind: refused ? 'providerRefused' : 'providerFailed', provider: back.provider },
      });
    }
  }

  async function link(provider: Provider, signIn: ProviderSignInAttempt): Promise<void> {
    const proof = heldProof();
    if (proof == null) {
      setStage({ kind: 'proving', act: { action: 'link', provider }, returned: null });

      return;
    }

    setStage({ kind: 'working' });

    try {
      const linked = await api.linkProvider(provider, proof, signIn);
      await onChanged();
      setStage({ kind: 'list', notice: { kind: 'linked', provider, email: linked.email } });
    } catch (error) {
      setStage({ kind: 'list', notice: refused(error, provider) });
    }
  }

  async function unlink(provider: Provider): Promise<void> {
    const proof = heldProof();
    if (proof == null) {
      setStage({ kind: 'proving', act: { action: 'unlink', provider }, returned: null });

      return;
    }

    setStage({ kind: 'working' });

    try {
      const { thisDevice } = await api.unlinkProvider(provider, proof);

      if (thisDevice) {
        onSignedOutHere();

        return;
      }

      await onChanged();
      setStage({ kind: 'list', notice: { kind: 'unlinked', provider } });
    } catch (error) {
      setStage({ kind: 'list', notice: refused(error, provider) });
    }
  }

  useEffect(() => {
    // Strict mode runs this twice, and a provider's code is spent on first use.
    if (started.current) return;
    started.current = true;

    void api
      .twoFactorStatus()
      .catch(() => ({ on: false, recoveryCodesLeft: 0 }))
      .then(async (status) => {
        setTwoFactorOn(status.on);
        if (returned != null) await finish(returned, status.on);
      });
    // Once, on arrival: what came back from the provider is taken then and never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="card" aria-labelledby="ways-title">
      {stage.kind === 'proving' ? (
        <Proving
          act={stage.act}
          email={email}
          hasPassword={hasPassword}
          providers={providers}
          twoFactorOn={twoFactorOn}
          returned={stage.returned}
          onProved={() => void proceed(stage.act)}
          onCodeSpent={onCodeSpent}
          onCancel={() => setStage({ kind: 'list', notice: null })}
        />
      ) : stage.kind === 'confirming' ? (
        <Confirming
          act={stage.act}
          hasPassword={hasPassword}
          providers={providers}
          onUnlink={() => void unlink(stage.act.provider)}
          onKeep={() => setStage({ kind: 'list', notice: null })}
        />
      ) : (
        <>
          <h2 id="ways-title">{t('waysCard.title')}</h2>
          <p>{t('waysCard.intro', { email })}</p>

          {stage.kind === 'list' && stage.notice != null && <Said notice={stage.notice} />}

          <ul className="ways-list" aria-label={t('waysCard.title')}>
            <li className="way">
              <span className="way-mark" aria-hidden="true">
                <LockMark />
              </span>
              <div className="way-detail">
                <span className="way-name">{t('waysCard.password')}</span>
                <State
                  on={hasPassword}
                  word={hasPassword ? t('waysCard.setUp') : t('waysCard.notSetUp')}
                />
              </div>
              {!hasPassword && (
                <button className="button" type="button" onClick={onSetPassword}>
                  {t('waysCard.setPassword')}
                </button>
              )}
            </li>

            {rows.map((row) => (
              <Row
                key={row.provider}
                row={row}
                busy={stage.kind === 'working'}
                onLink={() => begin({ action: 'link', provider: row.provider })}
                onUnlink={() => begin({ action: 'unlink', provider: row.provider })}
                onSetPassword={onSetPassword}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Row({
  row,
  busy,
  onLink,
  onUnlink,
  onSetPassword,
}: {
  row: ProviderRow;
  busy: boolean;
  onLink: () => void;
  onUnlink: () => void;
  onSetPassword: () => void;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAMES[row.provider];

  return (
    <li className="way">
      <span className="way-mark" aria-hidden="true">
        {row.provider === 'google' ? <GoogleMark /> : <AppleMark onLight />}
      </span>
      <div className="way-detail">
        <span className="way-name">{name}</span>
        <State
          on={row.linked}
          word={row.linked ? t('waysCard.linked') : t('waysCard.notLinked')}
          address={row.email}
        />
      </div>

      {row.canLink && (
        <button className="button" type="button" disabled={busy} onClick={onLink}>
          {t('waysCard.link', { provider: name })}
        </button>
      )}

      {row.canUnlink && (
        <button
          className="button"
          type="button"
          disabled={busy}
          aria-label={t('waysCard.unlinkLabel', { provider: name })}
          onClick={onUnlink}
        >
          {t('waysCard.unlink')}
        </button>
      )}

      {row.last && (
        <div className="notice notice-quiet way-last">
          <p>{t('waysCard.last', { provider: name })}</p>
          <button className="button" type="button" onClick={onSetPassword}>
            {t('waysCard.setPassword')}
          </button>
        </div>
      )}
    </li>
  );
}

/** A word beside the mark, never the mark alone. */
function State({ on, word, address }: { on: boolean; word: string; address?: string | null }) {
  return (
    <p className="way-state">
      <span className={on ? 'mark mark-done' : 'mark mark-off'} aria-hidden="true">
        {on ? '✓' : ''}
      </span>
      <span className={on ? 'way-state-on' : undefined}>{word}</span>
      {address != null && <span className="way-address">· {address}</span>}
    </p>
  );
}

function Said({ notice }: { notice: Notice }) {
  const { t } = useTranslation();

  if (notice.kind === 'linked' || notice.kind === 'unlinked') {
    const provider = PROVIDER_NAMES[notice.provider];

    return (
      <div className="status-done" role="status">
        <span className="mark mark-done" aria-hidden="true">
          ✓
        </span>
        <div>
          <p>
            {notice.kind === 'linked'
              ? t('waysCard.linkedDone', { provider })
              : t('waysCard.unlinkedDone', { provider })}
          </p>
          <p className="muted">
            {notice.kind === 'linked'
              ? notice.email == null
                ? t('waysCard.linkedNextPlain', { provider })
                : t('waysCard.linkedNext', { provider, address: notice.email })
              : t('waysCard.unlinkedNext')}
          </p>
        </div>
      </div>
    );
  }

  if (notice.kind === 'keptByRule') {
    const provider = PROVIDER_NAMES[notice.provider];
    const other = PROVIDER_NAMES[notice.provider === 'google' ? 'apple' : 'google'];

    return (
      <div className="notice notice-broken" role="alert">
        <span className="mark mark-broken" aria-hidden="true">
          ✕
        </span>
        <div className="notice-body">
          <p className="notice-title">
            {t('waysCard.keptByRule', { organisation: notice.organisation })}
          </p>
          <p>{t('waysCard.keptByRuleNext', { provider, other })}</p>
        </div>
      </div>
    );
  }

  const title =
    notice.kind === 'taken'
      ? t('waysCard.taken', { provider: PROVIDER_NAMES[notice.provider] })
      : notice.kind === 'last'
        ? t('waysCard.lastRefused')
        : notice.kind === 'providerFailed'
          ? t('waysCard.providerFailed', { provider: PROVIDER_NAMES[notice.provider] })
          : notice.kind === 'providerRefused'
            ? t('waysCard.providerRefused', { provider: PROVIDER_NAMES[notice.provider] })
            : t('waysCard.failedTitle');

  return (
    <div className="notice notice-broken" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p className="notice-title">{title}</p>
        {notice.kind === 'taken' && (
          <p>{t('waysCard.takenNext', { provider: PROVIDER_NAMES[notice.provider] })}</p>
        )}
        {notice.kind === 'failed' && <p>{t('waysCard.failedBody')}</p>}
      </div>
    </div>
  );
}

function Proving({
  act,
  email,
  hasPassword,
  providers,
  twoFactorOn,
  returned,
  onProved,
  onCodeSpent,
  onCancel,
}: {
  act: Act;
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  twoFactorOn: boolean;
  returned: ProviderSignInAttempt | null;
  onProved: (proof: string) => void;
  onCodeSpent: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAMES[act.provider];

  return (
    <ConfirmItsYou
      idPrefix="ways"
      intro={
        act.action === 'link'
          ? t('waysCard.proveLink', { provider: name, count: PROOF_MINUTES })
          : t('waysCard.proveUnlink', { provider: name, count: PROOF_MINUTES })
      }
      via={proveWith(hasPassword, providers, act.provider)}
      twoFactorOn={twoFactorOn}
      returned={returned}
      purpose={{ kind: 'prove', then: act }}
      note={
        act.action === 'link' && (
          <div className="notice notice-quiet">
            <span className="mark mark-info" aria-hidden="true">
              i
            </span>
            <p>{t('waysCard.linkNote', { provider: name, email })}</p>
          </div>
        )
      }
      onProved={onProved}
      onCodeSpent={onCodeSpent}
      onCancel={onCancel}
    />
  );
}

/** Says which way in remains, and that the devices it signed in are signed out. */
function Confirming({
  act,
  hasPassword,
  providers,
  onUnlink,
  onKeep,
}: {
  act: Act;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  onUnlink: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAMES[act.provider];
  const address = providers.find((entry) => entry.provider === act.provider)?.email ?? null;
  const other = providers.find((entry) => entry.provider !== act.provider)?.provider;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  return (
    <>
      <h2 id="ways-title" tabIndex={-1} ref={heading}>
        {t('waysCard.confirmTitle', { provider: name })}
      </h2>
      <p>
        {address == null
          ? t('waysCard.confirmBodyPlain', { provider: name })
          : t('waysCard.confirmBody', { provider: name, address })}{' '}
        {hasPassword || other == null
          ? t('waysCard.stillPassword')
          : t('waysCard.stillProvider', { provider: PROVIDER_NAMES[other] })}
      </p>

      <div className="notice notice-attention">
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <div className="notice-body">
          <p className="notice-title">{t('waysCard.confirmWarning', { provider: name })}</p>
          <p>{t('waysCard.confirmEmailed', { provider: name })}</p>
        </div>
      </div>

      <div className="actions">
        <button className="button button-dark" type="button" onClick={onUnlink}>
          {t('waysCard.confirmUnlink', { provider: name })}
        </button>
        <button className="button" type="button" onClick={onKeep}>
          {t('waysCard.keep')}
        </button>
      </div>
    </>
  );
}

function refused(error: unknown, provider: Provider): Notice {
  if (error instanceof ApiError && error.is('provider_taken')) return { kind: 'taken', provider };
  if (error instanceof ApiError && error.is('last_sign_in_method'))
    return { kind: 'last', provider };
  if (error instanceof ApiError && error.is('provider_kept_by_rule'))
    return { kind: 'keptByRule', provider, organisation: error.problem.organisation ?? '' };

  return { kind: 'failed' };
}

function LockMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <rect
        x="5"
        y="10.5"
        width="14"
        height="10"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
