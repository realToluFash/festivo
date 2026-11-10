import { ApiError, type OwnerClaimBanner } from '@soirely/api-client';
import { ownerClaimRefusalKey, ownerClaimView } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ViewInstance } from 'react-native';

import { api } from '../api.ts';
import { useShownLanguage } from '../i18n/index.ts';
import { useReadOut } from './ReadOut.tsx';
import { RecordRows, useCopied } from './RecordRows.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { Ask, type AskProps, FocusedScreen, Line, Section, TextAction } from './Summary.tsx';

type Check = 'resting' | 'checking' | 'notFound';

/** A question about the claim that is open, or its refusal: the claim has ended, or it is not yours to withdraw. */
type Asking =
  | { kind: 'withdraw'; busy: boolean; failed: string | null }
  | { kind: 'stop'; busy: boolean; failed: string | null }
  | { kind: 'ended'; words: string };

export interface OwnerClaimState {
  banner: OwnerClaimBanner | null;
  screen: boolean;
  check: Check;
  busy: boolean;
  /** Why starting a claim was refused, under the card. */
  refusal: string | null;
  asking: Asking | null;
  /** Withdrawn, and whether everybody who was told is emailed: on the card until the viewer moves on. */
  withdrew: { told: boolean } | null;
  become: () => void;
  checkRecord: () => void;
  close: () => void;
  ask: (kind: 'withdraw' | 'stop') => void;
  keep: () => void;
  confirm: () => void;
  moveOn: () => void;
}

/** The owner claim on Members while the organisation has no active owner (sc-6640), for an Admin only. */
export function useOwnerClaim(organisationId: string | undefined, shown: boolean): OwnerClaimState {
  const { t } = useTranslation();
  const language = useShownLanguage();
  const [held, setHeld] = useState<{ for: string; banner: OwnerClaimBanner | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [screen, setScreen] = useState(false);
  const [check, setCheck] = useState<Check>('resting');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [withdrew, setWithdrew] = useState<{ told: boolean } | null>(null);
  const banner = held != null && held.for === organisationId ? held.banner : null;

  useEffect(() => {
    if (organisationId == null || !shown) return;
    let live = true;

    api.ownerClaim(organisationId).then(
      (found) => live && setHeld({ for: organisationId, banner: found }),
      () => {},
    );

    return () => {
      live = false;
    };
  }, [organisationId, shown, attempt, language]);

  function settle(next: OwnerClaimBanner | null): void {
    if (organisationId != null) setHeld({ for: organisationId, banner: next });
  }

  function reload(): void {
    setAsking(null);
    setScreen(false);
    setCheck('resting');
    setAttempt((count) => count + 1);
  }

  async function become(): Promise<void> {
    if (organisationId == null || banner == null) return;
    setBusy(true);
    setRefusal(null);
    setWithdrew(null);
    try {
      settle(await api.startOwnerClaim(organisationId));
      setScreen(true);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.is('owner_claim_open') || error.is('owner_claim_closed'))
      ) {
        reload();
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
    } finally {
      setBusy(false);
    }
  }

  async function checkRecord(): Promise<void> {
    if (organisationId == null) return;
    setScreen(true);
    if (check === 'checking') return;
    setCheck('checking');
    try {
      const checked = await api.checkOwnerClaim(organisationId);
      if (checked.found) {
        settle(checked.ownerClaim);
        setCheck('resting');
        setScreen(false);
        return;
      }
      setCheck('notFound');
    } catch {
      reload();
    }
  }

  async function confirm(): Promise<void> {
    if (organisationId == null || asking == null || asking.kind === 'ended' || asking.busy) return;
    const kind = asking.kind;
    setAsking({ kind, busy: true, failed: null });
    try {
      if (kind === 'withdraw') {
        const withdrawn = await api.withdrawOwnerClaim(organisationId);
        settle(withdrawn.ownerClaim);
        setWithdrew({ told: withdrawn.told });
      } else {
        settle(await api.stopOwnerClaim(organisationId));
      }
      setAsking(null);
      setScreen(false);
      setCheck('resting');
    } catch (error) {
      if (error instanceof ApiError && error.is('owner_claim_ended')) {
        setAsking({
          kind: 'ended',
          words: t(kind === 'withdraw' ? 'ownerClaim.withdrawEnded' : 'ownerClaim.stopEnded'),
        });
      } else if (kind === 'withdraw' && error instanceof ApiError && error.is('forbidden')) {
        setAsking({ kind: 'ended', words: t('ownerClaim.withdrawNotClaimant') });
      } else {
        setAsking({ kind, busy: false, failed: t('ownerClaim.failed') });
      }
    }
  }

  return {
    banner,
    screen,
    check,
    busy,
    refusal,
    asking,
    withdrew,
    become: () => void become(),
    checkRecord: () => void checkRecord(),
    close: () => setScreen(false),
    ask: (kind) => setAsking({ kind, busy: false, failed: null }),
    keep: () => {
      if (asking?.kind === 'ended') reload();
      else if (asking?.busy !== true) setAsking(null);
    },
    confirm: () => void confirm(),
    moveOn: () => {
      setWithdrew(null);
      setRefusal(null);
    },
  };
}

/** Become the owner, on its own screen: the record to publish, checking it, and withdrawing the claim. */
export function ClaimScreen({
  owner,
  organisation,
  opener,
}: {
  owner: OwnerClaimState;
  organisation: string;
  opener: RefObject<ScreenReaderTarget | null>;
}) {
  const { t } = useTranslation();
  const { copied, copy, clear } = useCopied();
  const claim = owner.banner?.claim ?? null;
  const record = claim?.record ?? null;
  const checking = owner.check === 'checking';
  const withdrawRef = useRef<ViewInstance>(null);

  return (
    <FocusedScreen
      open={owner.screen && claim != null}
      title={t('ownerClaim.become')}
      verb={{
        label: t('ownerClaim.check'),
        on: !checking,
        onPress: owner.checkRecord,
        testID: 'ownerClaim.check',
      }}
      onCancel={owner.close}
      cancelLabel={t('ownerClaim.close')}
      cancelTestID="ownerClaim.cancel"
      opener={opener}
      ask={owner.asking?.kind === 'stop' ? null : claimAsk(t, owner, organisation)}
      toast={copied == null ? null : { words: copied.copied, onClose: clear }}
    >
      <Line quiet={false} text={t('ownerClaim.howTo')} />
      {claim != null && (
        <Section
          title={t('ownerClaim.prove', { domain: claim.domain })}
          foot={t('ownerClaim.checkEvery', { when: claim.lapsesAt.written })}
        >
          <Line text={t('ownerClaim.addRecord', { domain: claim.domain })} />
          {record != null && (
            <RecordRows
              rows={[
                {
                  label: t('ownerClaim.type'),
                  value: record.type,
                  copied: t('ownerClaim.typeCopied'),
                },
                {
                  label: t('ownerClaim.name'),
                  value: record.name,
                  copied: t('ownerClaim.nameCopied'),
                },
                {
                  label: t('ownerClaim.value'),
                  value: record.value,
                  copied: t('ownerClaim.valueCopied'),
                },
              ]}
              copied={copied}
              onCopy={copy}
              testID="ownerClaim.copy"
            />
          )}
        </Section>
      )}
      {checking && <Said text={t('ownerClaim.checking')} />}
      {owner.check === 'notFound' && <Said text={t('ownerClaim.notFound')} />}
      <TextAction
        ref={withdrawRef}
        label={t('ownerClaim.withdraw')}
        onPress={() => owner.ask('withdraw')}
        testID="ownerClaim.withdraw"
      />
      <Line text={t('ownerClaim.keepsWorking')} />
    </FocusedScreen>
  );
}

/** What the claim offers off its screen: withdrawing a found claim of your own, or stopping somebody else's. */
export function ClaimActions({
  owner,
  organisation,
}: {
  owner: OwnerClaimState;
  organisation: string;
}) {
  const { t } = useTranslation();
  const opener = useRef<ViewInstance>(null);
  const banner = owner.banner;
  if (banner == null) return null;
  const view = ownerClaimView(banner, organisation);
  const withdraw = view.withdraw && !view.record;
  const action = view.stop ? (
    <TextAction
      ref={opener}
      label={t('ownerClaim.stop')}
      removes
      onPress={() => owner.ask('stop')}
      consequence={t('ownerClaim.stopBody', { organisation })}
      testID="ownerClaim.stop"
    />
  ) : withdraw ? (
    <TextAction
      ref={opener}
      label={t('ownerClaim.withdraw')}
      onPress={() => owner.ask('withdraw')}
      testID="ownerClaim.withdraw"
    />
  ) : null;
  const ask = owner.screen ? null : claimAsk(t, owner, organisation);

  return (
    <>
      {action}
      {ask != null && <Ask open opener={opener} {...ask} />}
    </>
  );
}

function claimAsk(
  t: ReturnType<typeof useTranslation>['t'],
  owner: OwnerClaimState,
  organisation: string,
): AskProps | null {
  const asking = owner.asking;
  if (asking == null) return null;
  if (asking.kind === 'ended')
    return {
      title: t('ownerClaim.endedTitle'),
      line: asking.words,
      alert: true,
      keep: { label: t('ownerClaim.reload'), testID: 'ownerClaim.reload' },
      confirm: null,
      onKeep: owner.keep,
    };
  const claimant = owner.banner?.claim?.claimant.name ?? '';

  return asking.kind === 'withdraw'
    ? {
        title: t('ownerClaim.withdrawTitle'),
        line: t('ownerClaim.withdrawBody', { organisation }),
        keep: {
          label: t('ownerClaim.withdrawNo'),
          testID: 'ownerClaim.withdrawNo',
          off: asking.busy,
        },
        confirm: {
          label: t('ownerClaim.withdrawYes'),
          testID: 'ownerClaim.withdrawYes',
          removes: true,
          busy: asking.busy ? t('ownerClaim.withdrawing') : undefined,
        },
        failed: asking.failed,
        onKeep: owner.keep,
        onConfirm: owner.confirm,
        testID: 'ownerClaim.withdrawConfirm',
      }
    : {
        title: t('ownerClaim.stopConfirm', { claimant }),
        line: t('ownerClaim.stopBody', { organisation }),
        keep: { label: t('ownerClaim.stopNo'), testID: 'ownerClaim.stopNo', off: asking.busy },
        confirm: {
          label: t('ownerClaim.stopYes'),
          testID: 'ownerClaim.stopYes',
          removes: true,
          busy: asking.busy ? t('ownerClaim.stopping') : undefined,
        },
        failed: asking.failed,
        onKeep: owner.keep,
        onConfirm: owner.confirm,
        testID: 'ownerClaim.stopConfirm',
      };
}

function Said({ text }: { text: string }) {
  useReadOut(text);

  return <Line quiet={false} text={text} />;
}
