import { ApiError, type OwnerClaimBanner as Banner } from '@soirely/api-client';
import {
  OWNER_CLAIM_KEEPS_WORKING,
  type OwnerClaimLine,
  ownerClaimRefusalKey,
  ownerClaimView,
} from '@soirely/domain';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useDialogKeys } from '../dialogFocus.ts';
import { useShownLanguage } from '../i18n/index.ts';
import { useFocusOnceShown, useStepFocus } from '../stepFocus.ts';
import { offButton } from '../offButton.ts';

const MARKS = { attention: '!', waiting: '…', done: '✓', info: 'i' } as const;

type Load = { kind: 'loading' } | { kind: 'loaded'; banner: Banner | null } | { kind: 'failed' };

/** The top of Members while the organisation has no active Owner (sc-6640); nothing for anybody it is not shown to. */
export function OwnerClaimBanner({
  organisationId,
  organisation,
  pageHeading,
}: {
  organisationId: string;
  organisation: string;
  /** Where Load Members again leaves focus when no banner comes back. */
  pageHeading: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [withdrew, setWithdrew] = useState<{ told: boolean } | null>(null);
  const language = useShownLanguage();
  const loadedFor = useRef<string | null>(null);
  const [cardTitle, arriveAtCard] = useStepFocus();
  const overtaken = useRef(false);
  const loadingAgain = useRef(false);
  const land = useFocusOnceShown();

  useEffect(() => {
    let current = true;
    const askedAgain = loadedFor.current === organisationId;

    api.ownerClaim(organisationId).then(
      (banner) => {
        if (!current) return;
        loadedFor.current = organisationId;
        setLoad({ kind: 'loaded', banner });
        if (overtaken.current) arriveAtCard();
        if (loadingAgain.current) land(() => cardTitle.current ?? pageHeading.current);
        overtaken.current = false;
        loadingAgain.current = false;
      },
      () => {
        if (!current) return;
        if (loadingAgain.current) land(() => pageHeading.current);
        overtaken.current = false;
        loadingAgain.current = false;
        setLoad((before) => (askedAgain && before.kind === 'loaded' ? before : { kind: 'failed' }));
      },
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt, language, arriveAtCard, land, cardTitle, pageHeading]);

  function reload(): void {
    setWithdrew(null);
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

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
    <>
      {withdrew != null && <Withdrew told={withdrew.told} />}
      <OwnerClaimCard
        key={`${load.banner.state}-${load.banner.claim?.id ?? ''}`}
        organisationId={organisationId}
        organisation={organisation}
        banner={load.banner}
        titleRef={cardTitle}
        onBanner={(banner) => {
          setWithdrew(null);
          setLoad({ kind: 'loaded', banner });
          arriveAtCard();
        }}
        onWithdrawn={(banner, told) => {
          setWithdrew({ told });
          setLoad({ kind: 'loaded', banner });
        }}
        onReload={reload}
        onLoadAgain={() => {
          loadingAgain.current = true;
          reload();
        }}
        onOvertaken={() => {
          overtaken.current = true;
          reload();
        }}
      />
    </>
  );
}

/** Only the claimant sees it, and only until they leave Members (sc-8204). */
function Withdrew({ told }: { told: boolean }) {
  const { t } = useTranslation();
  const line = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => line.current?.focus(), []);

  return (
    <div ref={line} className="notice notice-done" tabIndex={-1}>
      <span className="mark mark-done" aria-hidden="true">
        ✓
      </span>
      <p>{t(told ? 'ownerClaim.youWithdrewTold' : 'ownerClaim.youWithdrew')}</p>
    </div>
  );
}

function OwnerClaimCard({
  organisationId,
  organisation,
  banner,
  titleRef,
  onBanner,
  onWithdrawn,
  onReload,
  onLoadAgain,
  onOvertaken,
}: {
  organisationId: string;
  organisation: string;
  banner: Banner;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onBanner: (banner: Banner | null) => void;
  onWithdrawn: (banner: Banner | null, told: boolean) => void;
  onReload: () => void;
  onLoadAgain: () => void;
  /** Another Administrator's claim started first: the banner that loads takes focus. */
  onOvertaken: () => void;
}) {
  const { t } = useTranslation();
  const view = ownerClaimView(banner, organisation);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [stopEnded, setStopEnded] = useState(false);
  const [withdrawing, setWithdrawing] = useState<'asking' | 'pending' | null>(null);
  const [withdrawRefused, setWithdrawRefused] = useState<string | null>(null);
  const withdrawButton = useRef<HTMLButtonElement>(null);
  const [stopTitle, arriveAtStop] = useStepFocus<HTMLParagraphElement>();
  const stopButton = useRef<HTMLButtonElement>(null);
  const [refusedLine, arriveAtRefused] = useStepFocus<HTMLParagraphElement>();
  const land = useFocusOnceShown();
  const words = (line: OwnerClaimLine) => t(line.key, line.values);

  async function start(): Promise<void> {
    setBusy(true);
    setRefusal(null);

    try {
      onBanner(await api.startOwnerClaim(organisationId));
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.is('owner_claim_open') || error.is('owner_claim_closed'))
      ) {
        onOvertaken();

        return;
      }

      const key = error instanceof ApiError ? ownerClaimRefusalKey(error.code) : null;

      if (key == null) {
        setRefusal(t('ownerClaim.failed'));
      } else if (banner.domain == null) {
        setRefusal((error as ApiError).problem.title);
      } else {
        setRefusal(t(key, { domain: banner.domain }));
      }
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
        arriveAtRefused();

        return;
      }

      setRefusal(t('ownerClaim.failed'));
      setBusy(false);
    }
  }

  async function withdraw(): Promise<void> {
    setWithdrawing('pending');

    try {
      const withdrawn = await api.withdrawOwnerClaim(organisationId);
      onWithdrawn(withdrawn.ownerClaim, withdrawn.told);
    } catch (error) {
      setWithdrawing(null);

      if (error instanceof ApiError && error.is('owner_claim_ended')) {
        setWithdrawRefused(t('ownerClaim.withdrawEnded'));
        arriveAtRefused();
      } else if (error instanceof ApiError && error.is('forbidden')) {
        setWithdrawRefused(t('ownerClaim.withdrawNotClaimant'));
        arriveAtRefused();
      } else {
        setRefusal(t('ownerClaim.failed'));
        withdrawButton.current?.focus();
      }
    }
  }

  function keepClaim(): void {
    setWithdrawing(null);
    withdrawButton.current?.focus();
  }

  return (
    <section className="card owner-claim" aria-labelledby="owner-claim-title">
      <div className="owner-claim-head">
        <span className={`mark mark-${view.tone}`} aria-hidden="true">
          {MARKS[view.tone]}
        </span>
        <h2 id="owner-claim-title" ref={titleRef} tabIndex={-1}>
          {words(view.title)}
        </h2>
      </div>
      {view.lines.map((line) => (
        <p key={line.key}>{words(line)}</p>
      ))}

      {view.record && withdrawRefused == null && banner.claim?.record != null && (
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

      {view.withdraw && withdrawRefused == null && (
        <div className="actions">
          <button
            ref={withdrawButton}
            type="button"
            className="button"
            onClick={() => setWithdrawing('asking')}
          >
            {t('ownerClaim.withdraw')}
          </button>
        </div>
      )}

      {withdrawing != null && (
        <WithdrawConfirm
          organisation={organisation}
          pending={withdrawing === 'pending'}
          onWithdraw={() => void withdraw()}
          onKeep={keepClaim}
        />
      )}

      {withdrawRefused != null && (
        <div className="notice notice-broken">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p ref={refusedLine} tabIndex={-1}>
              {withdrawRefused}
            </p>
            <p className="notice-action">
              <button type="button" className="link-button" onClick={onLoadAgain}>
                {t('ownerClaim.reload')}
              </button>
            </p>
          </div>
        </div>
      )}

      {view.become && (
        <div className="actions">
          <button
            type="button"
            className="button button-primary"
            aria-busy={busy}
            onClick={() => !busy && void start()}
          >
            {t('ownerClaim.become')}
          </button>
        </div>
      )}

      {view.stop && !confirming && !stopEnded && (
        <div className="actions">
          <button
            ref={stopButton}
            type="button"
            className="button"
            onClick={() => {
              setConfirming(true);
              arriveAtStop();
            }}
          >
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
            <p id="owner-claim-stop" className="notice-title" ref={stopTitle} tabIndex={-1}>
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
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setConfirming(false);
                  land(() => stopButton.current);
                }}
              >
                {t('ownerClaim.stopNo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {stopEnded && (
        <div className="notice notice-broken">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p ref={refusedLine} tabIndex={-1}>
              {t('ownerClaim.stopEnded')}
            </p>
            <p className="notice-action">
              <button type="button" className="link-button" onClick={onLoadAgain}>
                {t('ownerClaim.reload')}
              </button>
            </p>
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

/** Centred on a desk, a sheet at phone width; nothing closes it while the request is in flight (sc-8204). */
function WithdrawConfirm({
  organisation,
  pending,
  onWithdraw,
  onKeep,
}: {
  organisation: string;
  pending: boolean;
  onWithdraw: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => keep.current?.focus(), []);

  useDialogKeys(dialog, onKeep, pending);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog owner-claim-withdraw"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-claim-withdraw-title"
        aria-describedby="owner-claim-withdraw-body"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label={t('ownerClaim.close')}
          {...offButton(pending, { dim: false })}
          onClick={onKeep}
        >
          ✕
        </button>
        <div className="dialog-heading">
          <h2 id="owner-claim-withdraw-title">{t('ownerClaim.withdrawTitle')}</h2>
          <p id="owner-claim-withdraw-body">{t('ownerClaim.withdrawBody', { organisation })}</p>
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-primary"
            {...offButton(pending, { dim: false })}
            aria-busy={pending}
            onClick={onWithdraw}
          >
            {pending ? t('ownerClaim.withdrawing') : t('ownerClaim.withdrawYes')}
          </button>
          <button
            ref={keep}
            type="button"
            className="button"
            {...offButton(pending, { dim: false })}
            onClick={onKeep}
          >
            {t('ownerClaim.withdrawNo')}
          </button>
        </div>
        <span className="visually-hidden" role="status">
          {pending ? t('ownerClaim.withdrawing') : ''}
        </span>
      </div>
    </>
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
  const [stopTitle, arriveAtStop] = useStepFocus<HTMLParagraphElement>();
  const stopButton = useRef<HTMLButtonElement>(null);
  const answered = useRef<HTMLDivElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const land = useFocusOnceShown();
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
    land(() => answered.current ?? failedLine.current);
  }

  if (outcome === 'stopped' || outcome === 'ended') {
    return (
      <div
        ref={answered}
        className={`notice ${outcome === 'stopped' ? 'notice-done' : 'notice-quiet'}`}
        tabIndex={-1}
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
            <p id="paused-owner-claim-stop" className="notice-title" ref={stopTitle} tabIndex={-1}>
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
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setConfirming(false);
                  land(() => stopButton.current);
                }}
              >
                {t('ownerClaim.stopNo')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button
            ref={stopButton}
            type="button"
            className="button"
            onClick={() => {
              setConfirming(true);
              arriveAtStop();
            }}
          >
            {t('ownerClaim.stop')}
          </button>
        </div>
      )}
      {outcome === 'failed' && (
        <div className="notice notice-broken">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p ref={failedLine} tabIndex={-1}>
            {t('ownerClaim.failed')}
          </p>
        </div>
      )}
    </section>
  );
}
