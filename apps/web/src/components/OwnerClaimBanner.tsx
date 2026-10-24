import { ApiError, type OwnerClaimBanner as Banner } from '@soirely/api-client';
import {
  OWNER_CLAIM_KEEPS_WORKING,
  type OwnerClaimLine,
  ownerClaimRefusalKey,
  ownerClaimView,
} from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';

const MARKS = { attention: '!', waiting: '…', done: '✓', info: 'i' } as const;

type Load = { kind: 'loading' } | { kind: 'loaded'; banner: Banner | null } | { kind: 'failed' };

/** The top of Members while the organisation has no active Owner (sc-6640); nothing for anybody it is not shown to. */
export function OwnerClaimBanner({
  organisationId,
  organisation,
}: {
  organisationId: string;
  organisation: string;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;

    api.ownerClaim(organisationId).then(
      (banner) => current && setLoad({ kind: 'loaded', banner }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

  if (load.kind === 'loading') {
    return (
      <div className="card owner-claim owner-claim-skeleton" aria-hidden="false">
        <span className="visually-hidden" role="status">
          {t('ownerClaim.loading')}
        </span>
      </div>
    );
  }

  if (load.kind === 'failed' || load.banner == null) return null;

  return (
    <OwnerClaimCard
      key={`${load.banner.state}-${load.banner.claim?.id ?? ''}`}
      organisationId={organisationId}
      organisation={organisation}
      banner={load.banner}
      onBanner={(banner) => setLoad({ kind: 'loaded', banner })}
      onReload={() => {
        setLoad({ kind: 'loading' });
        setAttempt((n) => n + 1);
      }}
    />
  );
}

function OwnerClaimCard({
  organisationId,
  organisation,
  banner,
  onBanner,
  onReload,
}: {
  organisationId: string;
  organisation: string;
  banner: Banner;
  onBanner: (banner: Banner | null) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const view = ownerClaimView(banner, organisation);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [stopEnded, setStopEnded] = useState(false);
  const words = (line: OwnerClaimLine) => t(line.key, line.values);

  async function start(domain: string): Promise<void> {
    setBusy(true);
    setRefusal(null);

    try {
      onBanner(await api.startOwnerClaim(organisationId, domain));
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.is('owner_claim_open') || error.is('owner_claim_closed'))
      ) {
        onReload();

        return;
      }

      const key = error instanceof ApiError ? ownerClaimRefusalKey(error.code) : null;
      setRefusal(key != null ? t(key, { domain }) : t('ownerClaim.failed'));
      setBusy(false);
    }
  }

  async function check(): Promise<void> {
    setBusy(true);
    setNotFound(false);

    try {
      const checked = await api.checkOwnerClaim(organisationId);

      if (checked.found) {
        onBanner(checked.ownerClaim);

        return;
      }

      setNotFound(true);
    } catch {
      onReload();
    }

    setBusy(false);
  }

  async function stop(): Promise<void> {
    setBusy(true);

    try {
      onBanner(await api.stopOwnerClaim(organisationId));
    } catch (error) {
      if (error instanceof ApiError && error.is('owner_claim_ended')) {
        setStopEnded(true);
        setConfirming(false);
        setBusy(false);

        return;
      }

      setRefusal(t('ownerClaim.failed'));
      setBusy(false);
    }
  }

  function become(): void {
    if (banner.domains.length > 1) {
      setPicking(true);

      return;
    }

    void start(banner.domains[0] ?? '');
  }

  return (
    <section className="card owner-claim" aria-labelledby="owner-claim-title">
      <div className="owner-claim-head">
        <span className={`mark mark-${view.tone}`} aria-hidden="true">
          {MARKS[view.tone]}
        </span>
        <h2 id="owner-claim-title">{words(view.title)}</h2>
      </div>
      {view.lines.map((line) => (
        <p key={line.key}>{words(line)}</p>
      ))}

      {view.record && banner.claim?.record != null && (
        <>
          <RecordPanel record={banner.claim.record} />
          {notFound && (
            <div className="notice notice-attention" role="status">
              <span className="mark mark-attention" aria-hidden="true">
                !
              </span>
              <p>{t('ownerClaim.notFound')}</p>
            </div>
          )}
          <p className="muted">
            {t('ownerClaim.checkEvery', { when: banner.claim.lapsesAt.written })}
          </p>
          <div className="actions">
            <button
              type="button"
              className="button button-primary"
              aria-busy={busy}
              onClick={() => !busy && void check()}
            >
              {busy ? t('ownerClaim.checking') : t('ownerClaim.check')}
            </button>
          </div>
        </>
      )}

      {view.become && !picking && (
        <div className="actions">
          <button
            type="button"
            className="button button-primary"
            aria-busy={busy}
            onClick={() => !busy && become()}
          >
            {t('ownerClaim.become')}
          </button>
        </div>
      )}

      {view.become && picking && (
        <DomainPicker
          domains={banner.domains}
          busy={busy}
          onStart={(domain) => void start(domain)}
          onCancel={() => {
            setPicking(false);
            setRefusal(null);
          }}
        />
      )}

      {view.stop && !confirming && !stopEnded && (
        <div className="actions">
          <button type="button" className="button" onClick={() => setConfirming(true)}>
            {t('ownerClaim.stop')}
          </button>
        </div>
      )}

      {confirming && banner.claim != null && (
        <div
          className="notice notice-quiet owner-claim-confirm"
          role="group"
          aria-labelledby="owner-claim-stop"
        >
          <div className="notice-body">
            <p id="owner-claim-stop" className="notice-title">
              {t('ownerClaim.stopConfirm', { claimant: banner.claim.claimant.name })}
            </p>
            <p>{t('ownerClaim.stopBody', { organisation })}</p>
            <div className="actions">
              <button
                type="button"
                className="button button-danger"
                aria-busy={busy}
                onClick={() => !busy && void stop()}
              >
                {t('ownerClaim.stopYes')}
              </button>
              <button type="button" className="button" onClick={() => setConfirming(false)}>
                {t('ownerClaim.stopNo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {stopEnded && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p>{t('ownerClaim.stopEnded')}</p>
            <button type="button" className="link-button" onClick={onReload}>
              {t('ownerClaim.reload')}
            </button>
          </div>
        </div>
      )}

      {refusal != null && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{refusal}</p>
        </div>
      )}

      <p className="muted owner-claim-keeps">{words(OWNER_CLAIM_KEEPS_WORKING)}</p>
    </section>
  );
}

function DomainPicker({
  domains,
  busy,
  onStart,
  onCancel,
}: {
  domains: string[];
  busy: boolean;
  onStart: (domain: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const [unpicked, setUnpicked] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent): void {
    event.preventDefault();

    if (picked == null) {
      setUnpicked(true);
      first.current?.focus();

      return;
    }

    onStart(picked);
  }

  return (
    <form className="owner-claim-picker" onSubmit={submit} noValidate>
      <fieldset aria-describedby={unpicked ? 'owner-claim-unpicked' : undefined}>
        <legend>{t('ownerClaim.pickTitle')}</legend>
        {domains.map((domain, index) => (
          <label key={domain} className="members-role">
            <input
              ref={index === 0 ? first : undefined}
              type="radio"
              name="owner-claim-domain"
              value={domain}
              checked={picked === domain}
              onChange={() => {
                setPicked(domain);
                setUnpicked(false);
              }}
            />
            {domain}
          </label>
        ))}
        {unpicked && (
          <p id="owner-claim-unpicked" className="field-error">
            {t('ownerClaim.chooseDomain')}
          </p>
        )}
      </fieldset>
      <div className="actions">
        <button type="submit" className="button button-primary" aria-busy={busy} disabled={busy}>
          {t('ownerClaim.start')}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          {t('ownerClaim.cancel')}
        </button>
      </div>
    </form>
  );
}

function RecordPanel({ record }: { record: { type: string; name: string; value: string } }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'type' | 'name' | 'value' | null>(null);
  const rows = [
    { field: 'type', label: t('ownerClaim.type'), text: record.type },
    { field: 'name', label: t('ownerClaim.name'), text: record.name },
    { field: 'value', label: t('ownerClaim.value'), text: record.value },
  ] as const;

  async function copy(field: (typeof rows)[number]['field'], text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
    } catch {
      setCopied(null);
    }
  }

  return (
    <dl className="owner-claim-record">
      {rows.map((row) => (
        <div key={row.field} className="owner-claim-record-row">
          <dt>{row.label}</dt>
          <dd>
            <code>{row.text}</code>
            <button
              type="button"
              className="button owner-claim-copy"
              onClick={() => void copy(row.field, row.text)}
            >
              {copied === row.field ? `✓ ${t('ownerClaim.copied')}` : t('ownerClaim.copy')}
            </button>
          </dd>
        </div>
      ))}
      <span className="visually-hidden" role="status">
        {copied == null ? '' : t(`ownerClaim.${copied}Copied`)}
      </span>
    </dl>
  );
}

/** On the paused screen, for a suspended Owner: who is becoming the owner, and Stop this claim (sc-6640). */
export function PausedOwnerClaim({
  organisationId,
  organisation,
  claim,
}: {
  organisationId: string;
  organisation: string;
  claim: NonNullable<Banner['claim']>;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'stopped' | 'ended' | 'failed' | null>(null);
  const claimant = claim.claimant.name;

  async function stop(): Promise<void> {
    setBusy(true);

    try {
      await api.stopOwnerClaim(organisationId);
      setOutcome('stopped');
    } catch (error) {
      setOutcome(error instanceof ApiError && error.is('owner_claim_ended') ? 'ended' : 'failed');
    }

    setConfirming(false);
    setBusy(false);
  }

  if (outcome === 'stopped' || outcome === 'ended') {
    return (
      <div
        className={`notice ${outcome === 'stopped' ? 'notice-done' : 'notice-quiet'}`}
        role="status"
      >
        <span
          className={`mark ${outcome === 'stopped' ? 'mark-done' : 'mark-info'}`}
          aria-hidden="true"
        >
          {outcome === 'stopped' ? '✓' : 'i'}
        </span>
        <p>
          {outcome === 'stopped'
            ? t('ownerClaim.pausedStopped', { claimant, organisation })
            : t('ownerClaim.stopEnded')}
        </p>
      </div>
    );
  }

  return (
    <section className="card owner-claim" aria-labelledby="paused-owner-claim-title">
      <div className="owner-claim-head">
        <span
          className={`mark ${claim.passesAt != null ? 'mark-done' : 'mark-waiting'}`}
          aria-hidden="true"
        >
          {claim.passesAt != null ? '✓' : '…'}
        </span>
        <h2 id="paused-owner-claim-title">
          {t('ownerClaim.pausedTitle', { claimant, organisation })}
        </h2>
      </div>
      <p>
        {claim.passesAt != null
          ? t('ownerClaim.passesOn', { when: claim.passesAt.written })
          : t('ownerClaim.pausedUnfound', { when: claim.lapsesAt.written })}
      </p>
      {confirming ? (
        <div className="notice notice-quiet" role="group" aria-labelledby="paused-owner-claim-stop">
          <div className="notice-body">
            <p id="paused-owner-claim-stop" className="notice-title">
              {t('ownerClaim.stopConfirm', { claimant })}
            </p>
            <p>{t('ownerClaim.stopBody', { organisation })}</p>
            <div className="actions">
              <button
                type="button"
                className="button button-danger"
                aria-busy={busy}
                onClick={() => !busy && void stop()}
              >
                {t('ownerClaim.stopYes')}
              </button>
              <button type="button" className="button" onClick={() => setConfirming(false)}>
                {t('ownerClaim.stopNo')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="button" onClick={() => setConfirming(true)}>
            {t('ownerClaim.stop')}
          </button>
        </div>
      )}
      {outcome === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('ownerClaim.failed')}</p>
        </div>
      )}
    </section>
  );
}
