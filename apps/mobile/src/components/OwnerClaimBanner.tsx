import { ApiError, type OwnerClaim, type OwnerClaimBanner as Banner } from '@soirely/api-client';
import {
  OWNER_CLAIM_KEEPS_WORKING,
  type OwnerClaimLine,
  type OwnerClaimView,
  ownerClaimRefusalKey,
  ownerClaimView,
} from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useShownLanguage } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Notice, type NoticeTone } from './Notice.tsx';
import { useBroughtIntoView } from './Screen.tsx';
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
  const [withdrew, setWithdrew] = useState<{ told: boolean } | null>(null);
  const language = useShownLanguage();
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    const askedAgain = loadedFor.current === organisationId;

    api.ownerClaim(organisationId).then(
      (banner) => {
        if (!current) return;
        loadedFor.current = organisationId;
        setLoad({ kind: 'loaded', banner });
      },
      () =>
        current &&
        setLoad((before) => (askedAgain && before.kind === 'loaded' ? before : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt, language]);

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
    <>
      {withdrew != null && <Withdrew told={withdrew.told} />}
      <OwnerClaimCard
        key={`${load.banner.state}-${load.banner.claim?.id ?? ''}`}
        kind={kind}
        organisationId={organisationId}
        organisation={organisation}
        banner={load.banner}
        onBanner={(banner) => {
          setWithdrew(null);
          setLoad({ kind: 'loaded', banner });
        }}
        onWithdrawn={(banner, told) => {
          setWithdrew({ told });
          setLoad({ kind: 'loaded', banner });
        }}
        onReload={() => {
          setWithdrew(null);
          setLoad({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
      />
    </>
  );
}

/** Only the claimant sees it, and only until they leave Members (sc-8204). Focus reads it, so nothing announces it (sc-9382). */
function Withdrew({ told }: { told: boolean }) {
  const { t } = useTranslation();
  const shown = useBroughtIntoView();

  return (
    <View ref={shown} accessible testID="ownerClaim.withdrew">
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={t(told ? 'ownerClaim.youWithdrewTold' : 'ownerClaim.youWithdrew')}
      />
    </View>
  );
}

function WithdrawRefused({ words, onReload }: { words: string; onReload: () => void }) {
  const { t } = useTranslation();
  const shown = useBroughtIntoView();

  return (
    <View ref={shown} accessible testID="ownerClaim.withdrawRefused">
      <Notice
        tone="broken"
        mark="✕"
        body={words}
        action={{ label: t('ownerClaim.reload'), onPress: onReload, testID: 'ownerClaim.reload' }}
      />
    </View>
  );
}

function OwnerClaimCard({
  kind,
  organisationId,
  organisation,
  banner,
  onBanner,
  onWithdrawn,
  onReload,
}: {
  kind: LayoutKind;
  organisationId: string;
  organisation: string;
  banner: Banner;
  onBanner: (banner: Banner | null) => void;
  onWithdrawn: (banner: Banner | null, told: boolean) => void;
  onReload: () => void;
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
  const words = (line: OwnerClaimLine) => t(line.key, line.values);
  const { tone, mark } = TONES[view.tone];

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
        onReload();

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
      } else if (error instanceof ApiError && error.is('forbidden')) {
        setWithdrawRefused(t('ownerClaim.withdrawNotClaimant'));
      } else {
        setRefusal(t('ownerClaim.failed'));
      }
    }
  }

  return (
    <View style={[cardFrame(kind), styles.card]} testID="ownerClaim.banner">
      <Notice tone={tone} mark={mark} title={words(view.title)} heading />
      {view.lines.map((line) => (
        <Text key={line.key} size={tokens.typeBodyPhone.size}>
          {words(line)}
        </Text>
      ))}

      {view.record && withdrawRefused == null && banner.claim?.record != null && (
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

      {view.withdraw && withdrawRefused == null && (
        <SecondaryButton
          label={t('ownerClaim.withdraw')}
          onPress={() => setWithdrawing('asking')}
          testID="ownerClaim.withdraw"
        />
      )}

      <WithdrawConfirm
        open={withdrawing != null}
        phone={kind === 'phone'}
        organisation={organisation}
        pending={withdrawing === 'pending'}
        onWithdraw={() => void withdraw()}
        onKeep={() => setWithdrawing(null)}
      />

      {withdrawRefused != null && <WithdrawRefused words={withdrawRefused} onReload={onReload} />}

      {view.become && (
        <PrimaryButton
          label={t('ownerClaim.become')}
          onPress={() => void start()}
          busy={busy}
          testID="ownerClaim.become"
        />
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

/** A dialog on a tablet, a sheet on a phone; nothing closes it while the request is in flight (sc-8204). */
function WithdrawConfirm({
  open,
  phone,
  organisation,
  pending,
  onWithdraw,
  onKeep,
}: {
  open: boolean;
  phone: boolean;
  organisation: string;
  pending: boolean;
  onWithdraw: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const unlessPending = (act: () => void) => () => !pending && act();

  return (
    <Modal
      visible={open}
      transparent
      animationType={phone ? 'slide' : 'fade'}
      onRequestClose={unlessPending(onKeep)}
    >
      <View
        style={[
          styles.scrim,
          phone ? styles.scrimPhone : styles.scrimTablet,
          { backgroundColor: phone ? tokens.scrimSheet : tokens.scrimDialog },
        ]}
      >
        <View
          style={[
            styles.sheet,
            phone ? styles.sheetPhone : styles.sheetTablet,
            phone && { paddingBottom: tokens.space3xl + insets.bottom },
          ]}
          accessibilityViewIsModal
          testID="ownerClaim.withdrawConfirm"
        >
          {phone && <View style={styles.grabber} />}
          <Pressable
            style={styles.close}
            onPress={unlessPending(onKeep)}
            accessibilityRole="button"
            accessibilityLabel={t('ownerClaim.close')}
            accessibilityState={{ disabled: pending }}
            testID="ownerClaim.withdrawClose"
          >
            <Text size={tokens.typeButton.size} muted>
              ✕
            </Text>
          </Pressable>
          <Text
            size={tokens.typeTitleSection.size}
            weight="bold"
            accessibilityRole="header"
            style={styles.clearOfClose}
          >
            {t('ownerClaim.withdrawTitle')}
          </Text>
          <Text size={tokens.typeBodyPhone.size}>
            {t('ownerClaim.withdrawBody', { organisation })}
          </Text>
          <View style={phone ? styles.stacked : styles.actions}>
            <PrimaryButton
              label={pending ? t('ownerClaim.withdrawing') : t('ownerClaim.withdrawYes')}
              onPress={onWithdraw}
              busy={pending}
              testID="ownerClaim.withdrawYes"
            />
            <SecondaryButton
              label={t('ownerClaim.withdrawNo')}
              onPress={unlessPending(onKeep)}
              off={pending}
              testID="ownerClaim.withdrawNo"
            />
          </View>
        </View>
      </View>
    </Modal>
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
  scrim: { flex: 1 },
  scrimPhone: { justifyContent: 'flex-end' },
  scrimTablet: { justifyContent: 'center', padding: tokens.spaceXxl },
  sheet: {
    gap: tokens.spaceLg,
    padding: tokens.space3xl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  sheetPhone: {
    borderBottomWidth: 0,
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
  },
  sheetTablet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    borderRadius: tokens.radiusCardLarge,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.colorBorder,
  },
  close: {
    position: 'absolute',
    zIndex: 1,
    top: tokens.spaceLg,
    right: tokens.spaceLg,
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearOfClose: { marginRight: tokens.sizeHit },
  stacked: { gap: tokens.spaceSm },
  wraps: { flexShrink: 1 },
});
