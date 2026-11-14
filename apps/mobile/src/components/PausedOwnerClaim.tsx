import { ApiError, type OwnerClaim } from '@soirely/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { tokens } from '../theme/tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { DestructiveButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { type StepClosed, stepClosed, useFocusBackToOpener } from './Screen.tsx';
import { Text } from './Text.tsx';

/** On the paused screen, for a suspended Owner: who is becoming the owner, and Stop this claim (sc-6640). */
export function PausedOwnerClaim({
  organisationId,
  organisation,
  claim,
}: {
  organisationId: string;
  organisation: string;
  claim: OwnerClaim;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ kind: 'stopped' | 'ended' | 'failed' } | null>(null);
  const [kept, setKept] = useState<StepClosed | undefined>(undefined);
  const opener = useFocusBackToOpener(confirming ? undefined : kept);
  const claimant = claim.claimant.name;

  async function stop(): Promise<void> {
    setBusy(true);

    try {
      await api.stopOwnerClaim(organisationId);
      setOutcome({ kind: 'stopped' });
    } catch (error) {
      setOutcome({
        kind: error instanceof ApiError && error.is('owner_claim_ended') ? 'ended' : 'failed',
      });
    }

    setConfirming(false);
    setBusy(false);
  }

  if (outcome?.kind === 'stopped') {
    return (
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={t('ownerClaim.pausedStopped', { claimant, organisation })}
        answer={outcome}
        takesFocus
      />
    );
  }

  if (outcome?.kind === 'ended') {
    return (
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        body={t('ownerClaim.stopEnded')}
        answer={outcome}
        takesFocus
      />
    );
  }

  return (
    <View style={styles.card} testID="ownerClaim.paused">
      <Notice
        tone={claim.passesAt != null ? 'done' : 'quiet'}
        mark={claim.passesAt != null ? tokens.marks.done.glyph : '…'}
        title={t('ownerClaim.pausedTitle', { claimant, organisation })}
        body={
          claim.passesAt != null
            ? t('ownerClaim.passesOn', { when: claim.passesAt.written })
            : t('ownerClaim.pausedUnfound', { when: claim.lapsesAt.written })
        }
      />
      {confirming ? (
        <StopConfirm
          claimant={claimant}
          organisation={organisation}
          busy={busy}
          onStop={() => void stop()}
          onKeep={() => {
            setKept(stepClosed('stop'));
            setConfirming(false);
          }}
        />
      ) : (
        <SecondaryButton
          ref={opener('stop')}
          label={t('ownerClaim.stop')}
          onPress={() => {
            setKept(undefined);
            setConfirming(true);
          }}
          testID="ownerClaim.paused.stop"
        />
      )}
      {outcome?.kind === 'failed' && (
        <Notice tone="broken" mark="✕" body={t('ownerClaim.failed')} answer={outcome} takesFocus />
      )}
    </View>
  );
}

function StopConfirm({
  claimant,
  organisation,
  busy,
  onStop,
  onKeep,
}: {
  claimant: string;
  organisation: string;
  busy: boolean;
  onStop: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.confirm}>
      <AnswerHeading size={tokens.typeTitleSection.size} weight="bold" answer="confirming">
        {t('ownerClaim.stopConfirm', { claimant })}
      </AnswerHeading>
      <Text size={tokens.typeBodyPhone.size}>{t('ownerClaim.stopBody', { organisation })}</Text>
      <View style={styles.actions}>
        <QuietButton label={t('ownerClaim.stopNo')} onPress={onKeep} testID="ownerClaim.stopNo" />
        <DestructiveButton
          label={t('ownerClaim.stopYes')}
          onPress={onStop}
          busy={busy}
          testID="ownerClaim.stopYes"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spaceLg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  confirm: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.radiusInset,
  },
});
