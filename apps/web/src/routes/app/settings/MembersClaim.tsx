import { ApiError, type OwnerClaimBanner } from '@soirely/api-client';
import { ownerClaimRefusalKey, ownerClaimView } from '@soirely/domain';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  Ask,
  Dialog,
  Head,
  Note,
  RedAction,
  RowWords,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { useShownLanguage } from '../../../i18n/index.ts';
import { focusWhenFree } from '../../../layers.ts';
import type { ClaimOnCard } from './membersCard.ts';

const cardWords = () => document.querySelector<HTMLElement>('.members-desk .desk-said-lines');

type Ending = { kind: 'withdraw' | 'stop' } | null;

/** The owner claim on Members while no owner is active (sc-6640), for an Administrator; null for anybody else. */
export function useOwnerClaim(organisationId: string, organisation: string, shown: boolean) {
  const { t } = useTranslation();
  const language = useShownLanguage();
  const [banner, setBanner] = useState<OwnerClaimBanner | null>(null);
  const [withdrew, setWithdrew] = useState<{ told: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<{ checking: boolean } | null>(null);
  const [ending, setEnding] = useState<Ending>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!shown) return;
    let current = true;

    api.ownerClaim(organisationId).then(
      (loaded) => {
        if (current) setBanner(loaded);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [organisationId, shown, attempt, language]);

  const reload = useCallback(() => {
    setWithdrew(null);
    setAttempt((n) => n + 1);
  }, []);

  const arrive = (next: OwnerClaimBanner | null) => {
    setWithdrew(null);
    setBanner(next);
    focusWhenFree(cardWords);
  };

  async function become(): Promise<void> {
    if (busy || banner == null) return;
    setBusy(true);
    setRefusal(null);

    try {
      setBanner(await api.startOwnerClaim(organisationId));
      setWithdrew(null);
      setDialog({ checking: false });
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.is('owner_claim_open') || error.is('owner_claim_closed'))
      ) {
        reload();
        focusWhenFree(cardWords);
      } else {
        const key = error instanceof ApiError ? ownerClaimRefusalKey(error.code) : null;

        setRefusal(
          key == null
            ? t('ownerClaim.failed')
            : banner.domain == null
              ? (error as ApiError).problem.title
              : t(key, { domain: banner.domain }),
        );
      }
    }

    setBusy(false);
  }

  const card: ClaimOnCard | null = shown && banner != null ? { banner, withdrew } : null;
  const view = banner == null ? null : ownerClaimView(banner, organisation);

  return {
    card,
    become: () => void become(),
    check: () => setDialog({ checking: true }),
    under: card != null && (
      <ClaimUnder
        organisationId={organisationId}
        organisation={organisation}
        banner={card.banner}
        withdraw={view?.withdraw === true && !view.record}
        stop={view?.stop === true}
        ending={ending}
        refusal={refusal}
        onEnding={setEnding}
        onRefusal={setRefusal}
        onArrive={arrive}
        onWithdrawn={(next, told) => {
          setEnding(null);
          setBanner(next);
          setWithdrew({ told });
          focusWhenFree(cardWords);
        }}
        onReload={reload}
      />
    ),
    dialog: card != null && dialog != null && card.banner.claim?.record != null && (
      <ClaimDialog
        organisationId={organisationId}
        organisation={organisation}
        banner={card.banner}
        checking={dialog.checking}
        onClose={() => setDialog(null)}
        onFound={(next) => {
          setDialog(null);
          arrive(next);
        }}
        onWithdrawn={(next, told) => {
          setDialog(null);
          setBanner(next);
          setWithdrew({ told });
          focusWhenFree(cardWords);
        }}
        onEnded={(words) => {
          setDialog(null);
          setRefusal(words);
          reload();
          focusWhenFree(cardWords);
        }}
        onReload={() => {
          setDialog(null);
          reload();
        }}
      />
    ),
  };
}

/** Under the card: Withdraw my claim once the record is found, Stop this claim for another Administrator's, and any refusal. */
function ClaimUnder({
  organisationId,
  organisation,
  banner,
  withdraw,
  stop,
  ending,
  refusal,
  onEnding,
  onRefusal,
  onArrive,
  onWithdrawn,
  onReload,
}: {
  organisationId: string;
  organisation: string;
  banner: OwnerClaimBanner;
  withdraw: boolean;
  stop: boolean;
  ending: Ending;
  refusal: string | null;
  onEnding: (ending: Ending) => void;
  onRefusal: (refusal: string | null) => void;
  onArrive: (banner: OwnerClaimBanner | null) => void;
  onWithdrawn: (banner: OwnerClaimBanner | null, told: boolean) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const claimant = banner.claim?.claimant.name ?? '';

  async function end(kind: 'withdraw' | 'stop'): Promise<void> {
    setBusy(true);
    setFailed(null);

    try {
      if (kind === 'stop') onArrive(await api.stopOwnerClaim(organisationId));
      else {
        const withdrawn = await api.withdrawOwnerClaim(organisationId);
        onWithdrawn(withdrawn.ownerClaim, withdrawn.told);
      }
      onEnding(null);
    } catch (error) {
      const refused = refusedEnding(error, kind, t);

      if (refused == null) setFailed(t('ownerClaim.failed'));
      else {
        onEnding(null);
        onRefusal(refused);
        onReload();
        focusWhenFree(cardWords);
      }
    }

    setBusy(false);
  }

  return (
    <>
      {refusal != null && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {refusal}
        </p>
      )}
      {withdraw && (
        <TextAction
          label={t('ownerClaim.withdraw')}
          onClick={() => onEnding({ kind: 'withdraw' })}
        />
      )}
      {stop && (
        <RedAction
          label={t('ownerClaim.stop')}
          line={t('ownerClaim.stopBody', { organisation })}
          onClick={() => onEnding({ kind: 'stop' })}
        />
      )}
      {ending != null && (
        <EndAsk
          kind={ending.kind}
          organisation={organisation}
          claimant={claimant}
          busy={busy}
          failed={failed}
          onKeep={() => {
            setFailed(null);
            onEnding(null);
          }}
          onGo={() => void end(ending.kind)}
        />
      )}
    </>
  );
}

function refusedEnding(
  error: unknown,
  kind: 'withdraw' | 'stop',
  t: ReturnType<typeof useTranslation>['t'],
): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.is('owner_claim_ended'))
    return t(kind === 'stop' ? 'ownerClaim.stopEnded' : 'ownerClaim.withdrawEnded');
  if (kind === 'withdraw' && error.is('forbidden')) return t('ownerClaim.withdrawNotClaimant');

  return null;
}

function EndAsk({
  kind,
  organisation,
  claimant,
  busy,
  failed,
  onKeep,
  onGo,
}: {
  kind: 'withdraw' | 'stop';
  organisation: string;
  claimant: string;
  busy: boolean;
  failed: string | null;
  onKeep: () => void;
  onGo: () => void;
}) {
  const { t } = useTranslation();

  return kind === 'withdraw' ? (
    <Ask
      title={t('ownerClaim.withdrawTitle')}
      line={t('ownerClaim.withdrawBody', { organisation })}
      keep={t('ownerClaim.withdrawNo')}
      go={t('ownerClaim.withdrawYes')}
      busy={busy ? t('ownerClaim.withdrawing') : undefined}
      failed={failed ?? undefined}
      onKeep={onKeep}
      onGo={onGo}
    />
  ) : (
    <Ask
      title={t('ownerClaim.stopConfirm', { claimant })}
      line={t('ownerClaim.stopBody', { organisation })}
      keep={t('ownerClaim.stopNo')}
      go={t('ownerClaim.stopYes')}
      busy={busy ? t('ownerClaim.stopYes') : undefined}
      failed={failed ?? undefined}
      onKeep={onKeep}
      onGo={onGo}
    />
  );
}

type Check = 'resting' | 'checking' | 'missing';

/** Become the owner: the record to publish with Copy on each part, checking it, and withdrawing the claim. */
function ClaimDialog({
  organisationId,
  organisation,
  banner,
  checking,
  onClose,
  onFound,
  onWithdrawn,
  onEnded,
  onReload,
}: {
  organisationId: string;
  organisation: string;
  banner: OwnerClaimBanner;
  checking: boolean;
  onClose: () => void;
  onFound: (banner: OwnerClaimBanner | null) => void;
  onWithdrawn: (banner: OwnerClaimBanner | null, told: boolean) => void;
  onEnded: (words: string) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const [check, setCheck] = useState<Check>(checking ? 'checking' : 'resting');
  const [asking, setAsking] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const claim = banner.claim;
  const busy = check === 'checking';
  const found = useEffectEvent(onFound);
  const lost = useEffectEvent(onReload);

  useEffect(() => {
    if (check !== 'checking') return;
    let current = true;

    api.checkOwnerClaim(organisationId).then(
      (checked) => {
        if (!current) return;
        if (checked.found) found(checked.ownerClaim);
        else setCheck('missing');
      },
      () => {
        if (current) lost();
      },
    );

    return () => {
      current = false;
    };
  }, [check, organisationId]);

  async function withdraw(): Promise<void> {
    setWithdrawing(true);
    setFailed(null);

    try {
      const withdrawn = await api.withdrawOwnerClaim(organisationId);
      onWithdrawn(withdrawn.ownerClaim, withdrawn.told);
    } catch (error) {
      const refused = refusedEnding(error, 'withdraw', t);

      setWithdrawing(false);
      if (refused == null) setFailed(t('ownerClaim.failed'));
      else onEnded(refused);
    }
  }

  if (claim?.record == null) return null;

  return (
    <>
      <Dialog
        title={t('ownerClaim.become')}
        verb={t('ownerClaim.check')}
        on={!busy}
        onDismiss={onClose}
        onConfirm={() => setCheck('checking')}
      >
        <Note strong>{t('ownerClaim.howTo')}</Note>
        <section className="desk-group-in">
          <Head title={t('ownerClaim.prove', { domain: claim.domain })} level={3} />
          <Note>{t('ownerClaim.addRecord', { domain: claim.domain })}</Note>
          <RecordRows record={claim.record} />
          <p className="desk-foot">
            {t('ownerClaim.checkEvery', { when: claim.lapsesAt.written })}
          </p>
        </section>
        <div role="status" className="desk-said">
          {busy && <Note strong>{t('ownerClaim.checking')}</Note>}
          {check === 'missing' && <Note strong>{t('ownerClaim.notFound')}</Note>}
        </div>
        <TextAction label={t('ownerClaim.withdraw')} onClick={() => setAsking(true)} />
        <Note>{t('ownerClaim.keepsWorking')}</Note>
      </Dialog>
      {asking && (
        <Ask
          title={t('ownerClaim.withdrawTitle')}
          line={t('ownerClaim.withdrawBody', { organisation })}
          keep={t('ownerClaim.withdrawNo')}
          go={t('ownerClaim.withdrawYes')}
          busy={withdrawing ? t('ownerClaim.withdrawing') : undefined}
          failed={failed ?? undefined}
          onKeep={() => {
            setFailed(null);
            setAsking(false);
          }}
          onGo={() => void withdraw()}
        />
      )}
    </>
  );
}

/** The record as rows, its value as each row's title, Copy turning into a ticked Copied in place. */
function RecordRows({ record }: { record: { type: string; name: string; value: string } }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'type' | 'name' | 'value' | null>(null);
  const parts = [
    { field: 'type', label: t('ownerClaim.type'), value: record.type },
    { field: 'name', label: t('ownerClaim.name'), value: record.name },
    { field: 'value', label: t('ownerClaim.value'), value: record.value },
  ] as const;

  return (
    <>
      <ul className="desk-rows">
        {parts.map((part) => {
          const done = copied === part.field;

          return (
            <li key={part.field} className="desk-row">
              <RowWords title={part.value} lines={[part.label]} />
              <button
                type="button"
                className="desk-text"
                aria-label={t(done ? 'ownerClaim.partCopied' : 'ownerClaim.copyPart', {
                  part: part.label,
                })}
                onClick={() =>
                  void navigator.clipboard.writeText(part.value).then(
                    () => setCopied(part.field),
                    () => setCopied(null),
                  )
                }
              >
                <Glyph name={done ? 'tick' : 'copy'} size={17} weight={2.3} />
                {done ? t('ownerClaim.copied') : t('ownerClaim.copy')}
              </button>
            </li>
          );
        })}
      </ul>
      <span className="desk-unseen" role="status">
        {copied == null ? '' : t(`ownerClaim.${copied}Copied`)}
      </span>
    </>
  );
}
