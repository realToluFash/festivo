import { ApiError, type OwnerClaim, type OwnerClaimBanner as Banner } from '@soirely/api-client';
import {
  OWNER_CLAIM_KEEPS_WORKING,
  type OwnerClaimLine,
  type OwnerClaimView,
  ownerClaimRefusalKey,
  ownerClaimView,
} from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useShownLanguage } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { DestructiveButton, PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { AnswerHeading } from './AnswerHeading.tsx';
import { cardFrame } from './cardFrame.ts';
import { useComeForward, useOpenerInSight } from './comeForward.ts';
import { Notice, type NoticeTone } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';
import {
  type StepClosed,
  stepClosed,
  useBroughtIntoView,
  useFocusBackToOpener,
  useFocusOnAnswer,
} from './Screen.tsx';
import { Sheet } from './Sheet.tsx';
import { Text, type TextHandle } from './Text.tsx';

const TONES: Record<OwnerClaimView['tone'], { tone: NoticeTone; mark: string }> = {
  attention: { tone: 'attention', mark: '!' },
  waiting: { tone: 'quiet', mark: '…' },
  done: { tone: 'done', mark: tokens.marks.done.glyph },
  info: { tone: 'quiet', mark: tokens.marks.info.glyph },
};

type Load =
  | { kind: 'loading' }
  | { kind: 'loaded'; banner: Banner | null; tapped?: object }
  | { kind: 'failed' };

/** The top of Members while the organisation has no active Owner (sc-6640); nothing for anybody it is not shown to. */
export function OwnerClaimBanner({
  kind,
  organisationId,
  organisation,
  title,
}: {
  kind: LayoutKind;
  organisationId: string;
  organisation: string;
  /** The Members heading, where focus goes when Load Members again leaves no banner (sc-11173). */
  title?: RefObject<TextHandle | null> | undefined;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [withdrew, setWithdrew] = useState<{ told: boolean } | null>(null);
  const language = useShownLanguage();
  const loadedFor = useRef<string | null>(null);
  const reloadAnswers = useRef(false);
  useFocusOnAnswer<TextHandle>(
    load.kind === 'loaded' && load.banner == null ? load.tapped : undefined,
    title,
  );

  useEffect(() => {
    let current = true;
    const askedAgain = loadedFor.current === organisationId;

    api.ownerClaim(organisationId).then(
      (banner) => {
        if (!current) return;
        loadedFor.current = organisationId;
        const tapped = reloadAnswers.current ? {} : undefined;
        reloadAnswers.current = false;
        setLoad({ kind: 'loaded', banner, ...(tapped != null && { tapped }) });
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
        answer={load.tapped}
        onBanner={(banner) => {
          setWithdrew(null);
          setLoad({ kind: 'loaded', banner, tapped: {} });
        }}
        onWithdrawn={(banner, told) => {
          setWithdrew({ told });
          setLoad({ kind: 'loaded', banner });
        }}
        onReload={(answers = false) => {
          reloadAnswers.current = answers;
          setWithdrew(null);
          setLoad({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
      />
    </>
  );
}

/** Only the claimant sees it, and only until they leave Members (sc-8204). */
function Withdrew({ told }: { told: boolean }) {
  const { t } = useTranslation();
  const words = t(told ? 'ownerClaim.youWithdrewTold' : 'ownerClaim.youWithdrew');
  const { shown, read } = useBroughtIntoView();

  return (
    <View ref={shown} testID="ownerClaim.withdrew">
      <Notice tone="done" mark={tokens.marks.done.glyph} body={words} wordsRef={read} />
    </View>
  );
}

function WithdrawRefused({ words, onReload }: { words: string; onReload: () => void }) {
  const { t } = useTranslation();
  const { shown, read } = useBroughtIntoView();

  return (
    <View ref={shown} testID="ownerClaim.withdrawRefused">
      <Notice
        tone="broken"
        mark="✕"
        body={words}
        wordsRef={read}
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
  answer,
  onBanner,
  onWithdrawn,
  onReload,
}: {
  kind: LayoutKind;
  organisationId: string;
  organisation: string;
  banner: Banner;
  /** The tap this banner answers: its title takes screen reader focus as it shows. */
  answer: object | undefined;
  onBanner: (banner: Banner | null) => void;
  onWithdrawn: (banner: Banner | null, told: boolean) => void;
  /** `answers`: the banner it reloads to answers the tap, so its title takes focus. */
  onReload: (answers?: boolean) => void;
}) {
  const { t } = useTranslation();
  const view = ownerClaimView(banner, organisation);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [stopEnded, setStopEnded] = useState<object | null>(null);
  const [kept, setKept] = useState<StepClosed | undefined>(undefined);
  const opener = useFocusBackToOpener(kept);
  const [withdrawing, setWithdrawing] = useState<'asking' | 'pending' | null>(null);
  const withdrawButton = useRef<ViewInstance>(null);
  const withdrawOpener = useOpenerInSight(withdrawButton);
  const [withdrawRefused, setWithdrawRefused] = useState<string | null>(null);
  const comeForward = useComeForward();
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
        onReload(true);

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
    } finally {
      comeForward();
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
    } finally {
      comeForward();
    }

    setBusy(false);
  }

  async function stop(): Promise<void> {
    setBusy(true);

    try {
      onBanner(await api.stopOwnerClaim(organisationId));
    } catch (error) {
      if (error instanceof ApiError && error.is('owner_claim_ended')) {
        setStopEnded({});
        setConfirming(false);
        setBusy(false);

        return;
      }

      setRefusal(t('ownerClaim.failed'));
      setBusy(false);
    } finally {
      comeForward();
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
    } finally {
      comeForward();
    }
  }

  return (
    <View style={[cardFrame(kind), styles.card]} testID="ownerClaim.banner">
      <Notice
        tone={tone}
        mark={mark}
        title={words(view.title)}
        heading
        answer={answer}
        takesFocus
      />
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
          ref={withdrawButton}
          testID="ownerClaim.withdraw"
        />
      )}

      <WithdrawConfirm
        open={withdrawing != null}
        phone={kind === 'phone'}
        opener={withdrawOpener}
        organisation={organisation}
        pending={withdrawing === 'pending'}
        onWithdraw={() => void withdraw()}
        onKeep={() => setWithdrawing(null)}
      />

      {withdrawRefused != null && (
        <WithdrawRefused words={withdrawRefused} onReload={() => onReload(true)} />
      )}

      {view.become && (
        <PrimaryButton
          label={t('ownerClaim.become')}
          onPress={() => void start()}
          busy={busy}
          testID="ownerClaim.become"
        />
      )}

      {view.stop && !confirming && stopEnded == null && (
        <SecondaryButton
          ref={opener('stop')}
          label={t('ownerClaim.stop')}
          onPress={() => {
            setKept(undefined);
            setConfirming(true);
          }}
          testID="ownerClaim.stop"
        />
      )}

      {confirming && banner.claim != null && (
        <StopConfirm
          claimant={banner.claim.claimant.name}
          organisation={organisation}
          busy={busy}
          onStop={() => void stop()}
          onKeep={() => {
            setKept(stepClosed('stop'));
            setConfirming(false);
          }}
        />
      )}

      {stopEnded != null && (
        <Notice
          tone="broken"
          mark="✕"
          body={t('ownerClaim.stopEnded')}
          action={{
            label: t('ownerClaim.reload'),
            onPress: () => onReload(true),
            testID: 'ownerClaim.reload',
          }}
          answer={stopEnded}
          takesFocus
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

/** A dialog on a tablet, a sheet on a phone; nothing closes it while the request is in flight (sc-8204). */
function WithdrawConfirm({
  open,
  phone,
  opener,
  organisation,
  pending,
  onWithdraw,
  onKeep,
}: {
  open: boolean;
  phone: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  organisation: string;
  pending: boolean;
  onWithdraw: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const unlessPending = (act: () => void) => () => !pending && act();
  const withdraw = (
    <DestructiveButton
      label={pending ? t('ownerClaim.withdrawing') : t('ownerClaim.withdrawYes')}
      onPress={onWithdraw}
      busy={pending}
      testID="ownerClaim.withdrawYes"
    />
  );
  const keep = (
    <QuietButton
      label={t('ownerClaim.withdrawNo')}
      onPress={unlessPending(onKeep)}
      off={pending}
      testID="ownerClaim.withdrawNo"
    />
  );

  return (
    <Sheet
      open={open}
      onClose={unlessPending(onKeep)}
      opener={opener}
      testID="ownerClaim.withdrawConfirm"
    >
      <View style={styles.withdraw}>
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
          {phone ? (
            <>
              {withdraw}
              {keep}
            </>
          ) : (
            <>
              {keep}
              {withdraw}
            </>
          )}
        </View>
      </View>
    </Sheet>
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
      readOut(t(`ownerClaim.${field}Copied`));
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
          <Text size={tokens.typeBodyPhone.size} family="mono" selectable style={styles.wraps}>
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
  withdraw: { gap: tokens.spaceLg, padding: tokens.space3xl },
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
