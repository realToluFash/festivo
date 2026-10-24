import { ApiError, type OwnerClaim, type OwnerClaimBanner as Banner } from '@soirely/api-client';
import {
  OWNER_CLAIM_KEEPS_WORKING,
  type OwnerClaimLine,
  type OwnerClaimView,
  ownerClaimRefusalKey,
  ownerClaimView,
} from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Notice, type NoticeTone } from './Notice.tsx';
import { Text } from './Text.tsx';

const TONES: Record<OwnerClaimView['tone'], { tone: NoticeTone; mark: string }> = {
  attention: { tone: 'attention', mark: '!' },
  waiting: { tone: 'quiet', mark: '…' },
  done: { tone: 'done', mark: tokens.marks.done.glyph },
  info: { tone: 'quiet', mark: tokens.marks.info.glyph },
};

type Load = { kind: 'loading' } | { kind: 'loaded'; banner: Banner | null } | { kind: 'failed' };

/** The top of Members while the organisation has no active Owner (sc-6640); nothing for anybody it is not shown to. */
export function OwnerClaimBanner({
  kind,
  organisationId,
  organisation,
}: {
  kind: LayoutKind;
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
      <View
        style={[cardFrame(kind), styles.skeleton]}
        accessible
        accessibilityLabel={t('ownerClaim.loading')}
        accessibilityRole="progressbar"
      />
    );
  }

  if (load.kind === 'failed' || load.banner == null) return null;

  return (
    <OwnerClaimCard
      key={`${load.banner.state}-${load.banner.claim?.id ?? ''}`}
      kind={kind}
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
  kind,
  organisationId,
  organisation,
  banner,
  onBanner,
  onReload,
}: {
  kind: LayoutKind;
  organisationId: string;
  organisation: string;
  banner: Banner;
  onBanner: (banner: Banner | null) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const view = ownerClaimView(banner, organisation);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [unpicked, setUnpicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [stopEnded, setStopEnded] = useState(false);
  const words = (line: OwnerClaimLine) => t(line.key, line.values);
  const { tone, mark } = TONES[view.tone];

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

  function startPicked(): void {
    if (picked == null) {
      setUnpicked(true);
      AccessibilityInfo.announceForAccessibility(t('ownerClaim.chooseDomain'));

      return;
    }

    void start(picked);
  }

  return (
    <View style={[cardFrame(kind), styles.card]} testID="ownerClaim.banner">
      <Notice tone={tone} mark={mark} title={words(view.title)} heading />
      {view.lines.map((line) => (
        <Text key={line.key} size={tokens.typeBodyPhone.size}>
          {words(line)}
        </Text>
      ))}

      {view.record && banner.claim?.record != null && (
        <>
          <RecordPanel record={banner.claim.record} />
          {notFound && (
            <Notice tone="attention" mark="!" body={t('ownerClaim.notFound')} announce />
          )}
          <Text size={tokens.typeBody.size} muted>
            {t('ownerClaim.checkEvery', { when: banner.claim.lapsesAt.written })}
          </Text>
          <PrimaryButton
            label={busy ? t('ownerClaim.checking') : t('ownerClaim.check')}
            onPress={() => void check()}
            busy={busy}
            testID="ownerClaim.check"
          />
        </>
      )}

      {view.become && !picking && (
        <PrimaryButton
          label={t('ownerClaim.become')}
          onPress={become}
          busy={busy}
          testID="ownerClaim.become"
        />
      )}

      {view.become && picking && (
        <View style={styles.picker} accessibilityRole="radiogroup">
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {t('ownerClaim.pickTitle')}
          </Text>
          {banner.domains.map((domain) => (
            <Pressable
              key={domain}
              style={styles.choice}
              onPress={() => {
                setPicked(domain);
                setUnpicked(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: picked === domain }}
              testID={`ownerClaim.domain.${domain}`}
            >
              <View style={[styles.radio, picked === domain && styles.radioOn]} />
              <Text size={tokens.typeBodyPhone.size} style={styles.wraps}>
                {domain}
              </Text>
            </Pressable>
          ))}
          {unpicked && (
            <Text size={tokens.typeBody.size} style={styles.error}>
              {t('ownerClaim.chooseDomain')}
            </Text>
          )}
          <View style={styles.actions}>
            <PrimaryButton
              label={t('ownerClaim.start')}
              onPress={startPicked}
              busy={busy}
              testID="ownerClaim.start"
            />
            <SecondaryButton
              label={t('ownerClaim.cancel')}
              onPress={() => {
                setPicking(false);
                setRefusal(null);
              }}
              testID="ownerClaim.cancel"
            />
          </View>
        </View>
      )}

      {view.stop && !confirming && !stopEnded && (
        <SecondaryButton
          label={t('ownerClaim.stop')}
          onPress={() => setConfirming(true)}
          testID="ownerClaim.stop"
        />
      )}

      {confirming && banner.claim != null && (
        <StopConfirm
          claimant={banner.claim.claimant.name}
          organisation={organisation}
          busy={busy}
          onStop={() => void stop()}
          onKeep={() => setConfirming(false)}
        />
      )}

      {stopEnded && (
        <Notice
          tone="broken"
          mark="✕"
          body={t('ownerClaim.stopEnded')}
          action={{ label: t('ownerClaim.reload'), onPress: onReload, testID: 'ownerClaim.reload' }}
          announce
        />
      )}

      {refusal != null && <Notice tone="broken" mark="✕" body={refusal} announce />}

      <Text size={tokens.typeBody.size} muted>
        {words(OWNER_CLAIM_KEEPS_WORKING)}
      </Text>
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
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('ownerClaim.stopConfirm', { claimant })}
      </Text>
      <Text size={tokens.typeBodyPhone.size}>{t('ownerClaim.stopBody', { organisation })}</Text>
      <View style={styles.actions}>
        <PrimaryButton
          label={t('ownerClaim.stopYes')}
          onPress={onStop}
          busy={busy}
          testID="ownerClaim.stopYes"
        />
        <SecondaryButton
          label={t('ownerClaim.stopNo')}
          onPress={onKeep}
          testID="ownerClaim.stopNo"
        />
      </View>
    </View>
  );
}

function RecordPanel({ record }: { record: NonNullable<OwnerClaim['record']> }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'type' | 'name' | 'value' | null>(null);
  const rows = [
    { field: 'type', label: t('ownerClaim.type'), text: record.type },
    { field: 'name', label: t('ownerClaim.name'), text: record.name },
    { field: 'value', label: t('ownerClaim.value'), text: record.value },
  ] as const;

  async function copy(field: (typeof rows)[number]['field'], text: string): Promise<void> {
    try {
      await setStringAsync(text);
      setCopied(field);
      AccessibilityInfo.announceForAccessibility(t(`ownerClaim.${field}Copied`));
    } catch {
      setCopied(null);
    }
  }

  return (
    <View style={styles.record}>
      {rows.map((row) => (
        <View key={row.field} style={styles.recordRow}>
          <Text size={tokens.typeBody.size} muted>
            {row.label}
          </Text>
          <Text size={tokens.typeBodyPhone.size} mono selectable style={styles.wraps}>
            {row.text}
          </Text>
          <QuietButton
            label={copied === row.field ? `✓ ${t('ownerClaim.copied')}` : t('ownerClaim.copy')}
            onPress={() => void copy(row.field, row.text)}
            testID={`ownerClaim.copy.${row.field}`}
          />
        </View>
      ))}
    </View>
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
  claim: OwnerClaim;
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

  if (outcome === 'stopped') {
    return (
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={t('ownerClaim.pausedStopped', { claimant, organisation })}
        announce
      />
    );
  }

  if (outcome === 'ended') {
    return (
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        body={t('ownerClaim.stopEnded')}
        announce
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
          onKeep={() => setConfirming(false)}
        />
      ) : (
        <SecondaryButton
          label={t('ownerClaim.stop')}
          onPress={() => setConfirming(true)}
          testID="ownerClaim.paused.stop"
        />
      )}
      {outcome === 'failed' && (
        <Notice tone="broken" mark="✕" body={t('ownerClaim.failed')} announce />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spaceLg },
  skeleton: { minHeight: 96, backgroundColor: tokens.colorInset },
  picker: { gap: tokens.spaceSm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: 44,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  radioOn: { borderWidth: 6, borderColor: tokens.colorAccent },
  error: { color: tokens.colorBrokenText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  confirm: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.radiusInset,
  },
  record: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.radiusInset,
  },
  recordRow: { gap: tokens.spaceXxs },
  wraps: { flexShrink: 1 },
});
