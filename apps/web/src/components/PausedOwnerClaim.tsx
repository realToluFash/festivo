import { ApiError, type OwnerClaimBanner as Banner } from '@soirely/api-client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useFocusOnceShown, useStepFocus } from '../stepFocus.ts';

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
                className="link-button"
                onClick={() => {
                  setConfirming(false);
                  land(() => stopButton.current);
                }}
              >
                {t('ownerClaim.stopNo')}
              </button>
              <button
                type="button"
                className="button button-danger"
                aria-busy={busy}
                onClick={() => !busy && void stop()}
              >
                {t('ownerClaim.stopYes')}
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
