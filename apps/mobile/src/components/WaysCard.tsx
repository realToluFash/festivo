import {
  ApiError,
  type LinkedProvider,
  type Provider,
  ProviderCancelled,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { proveWith, providerRows, remainingWay, type ProviderRow } from '@soirely/domain';
import { type Ref, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { proveIntro, unlinkProofLapsed } from '../kit/waysProof.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { heldProof } from '../recentProof.ts';
import { tokens } from '../theme/tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { DestructiveButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { ConfirmItsYou } from './ConfirmItsYou.tsx';
import { Notice } from './Notice.tsx';
import { type StepClosed, stepClosed, useFocusBackToOpener } from './Screen.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { useMarkSide } from './markSide.ts';

type Act = { action: 'link' | 'unlink'; provider: Provider };

type Said =
  | { kind: 'linked'; provider: Provider; email: string | null }
  | { kind: 'unlinked' | 'taken' | 'last' | 'providerFailed'; provider: Provider }
  | { kind: 'keptByRule'; provider: Provider; organisation: string }
  | { kind: 'failed' };

type Stage =
  | { kind: 'list'; said: Said | null; closed?: StepClosed }
  | { kind: 'proving'; act: Act }
  | { kind: 'confirming'; act: Act; proof: string }
  | { kind: 'working' };

/** Settings > Security, between Password and Two-factor: link or unlink Google and Apple (sc-510). */
export function WaysCard({
  email,
  hasPassword,
  providers,
  kind,
  onChanged,
  onRefused,
  onSetPassword,
  setPasswordClosed,
  onSignedOutHere,
  onCodeSpent,
}: {
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  kind: LayoutKind;
  onChanged: () => Promise<void>;
  /** The server refused an unlink, so the rows on screen may be stale; a failed read leaves them. */
  onRefused: () => Promise<void>;
  /** `from` names the Set a password tapped, for focus to go back to it. */
  onSetPassword: (from: string) => void;
  /** Setting a password from here was cancelled, back to the Set a password that opened it. */
  setPasswordClosed?: StepClosed | undefined;
  onSignedOutHere: () => void;
  /** A two-factor or recovery code was accepted, so the two-factor card's count may be stale. */
  onCodeSpent: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'list', said: null });
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const [closedFor, setClosedFor] = useState(setPasswordClosed);
  const title = useRef<TextHandle>(null);
  const opener = useFocusBackToOpener(stage.kind === 'list' ? stage.closed : undefined, title);
  const frame = cardFrame(kind);

  if (closedFor !== setPasswordClosed) {
    setClosedFor(setPasswordClosed);
    if (setPasswordClosed != null)
      setStage({ kind: 'list', said: null, closed: setPasswordClosed });
  }
  const rows = providerRows(hasPassword, providers);

  useEffect(() => {
    let live = true;

    api
      .twoFactorStatus()
      .then((status) => {
        if (live) setTwoFactorOn(status.on);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  function begin(act: Act): void {
    const proof = heldProof();
    if (proof == null) setStage({ kind: 'proving', act });
    else void proceed(act, proof);
  }

  async function proceed(act: Act, proof: string): Promise<void> {
    if (act.action === 'unlink') {
      setStage({ kind: 'confirming', act, proof });

      return;
    }

    setStage({ kind: 'working' });

    let signIn: ProviderSignInAttempt;
    try {
      signIn = await confirmWithProvider(act.provider);
    } catch (error) {
      setStage({
        kind: 'list',
        said:
          error instanceof ProviderCancelled
            ? null
            : { kind: 'providerFailed', provider: act.provider },
        ...(error instanceof ProviderCancelled && { closed: stepClosed(openerOf(act)) }),
      });

      return;
    }

    try {
      const linked = await api.linkProvider(act.provider, proof, signIn);
      await onChanged();
      setStage({
        kind: 'list',
        said: { kind: 'linked', provider: act.provider, email: linked.email },
      });
    } catch (error) {
      setStage({ kind: 'list', said: refused(error, act.provider) });
    }
  }

  async function unlink(provider: Provider, proof: string): Promise<void> {
    setStage({ kind: 'working' });

    try {
      const { thisDevice } = await api.unlinkProvider(provider, proof);

      if (thisDevice) {
        onSignedOutHere();

        return;
      }

      await onChanged();
      setStage({ kind: 'list', said: { kind: 'unlinked', provider } });
    } catch (error) {
      if (unlinkProofLapsed(error)) {
        setStage({ kind: 'proving', act: { action: 'unlink', provider } });

        return;
      }

      if (error instanceof ApiError) await onRefused().catch(() => {});
      setStage({ kind: 'list', said: refused(error, provider) });
    }
  }

  if (stage.kind === 'proving') {
    return (
      <View style={frame}>
        <Proving
          act={stage.act}
          email={email}
          hasPassword={hasPassword}
          providers={providers}
          twoFactorOn={twoFactorOn}
          onProved={(proof) => void proceed(stage.act, proof)}
          onCodeSpent={onCodeSpent}
          onCancel={() =>
            setStage({ kind: 'list', said: null, closed: stepClosed(openerOf(stage.act)) })
          }
        />
      </View>
    );
  }

  if (stage.kind === 'confirming') {
    return (
      <View style={frame}>
        <Confirming
          act={stage.act}
          hasPassword={hasPassword}
          providers={providers}
          onUnlink={() => void unlink(stage.act.provider, stage.proof)}
          onKeep={() =>
            setStage({ kind: 'list', said: null, closed: stepClosed(openerOf(stage.act)) })
          }
        />
      </View>
    );
  }

  return (
    <View style={frame}>
      <Text
        ref={title}
        size={tokens.typeTitleSection.size}
        weight="bold"
        accessibilityRole="header"
      >
        {t('waysCard.title')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('waysCard.intro', { email })}
      </Text>

      {stage.kind === 'list' && stage.said != null && <SaidNotice said={stage.said} />}

      <View>
        <View style={styles.row}>
          <View style={styles.detail}>
            <Text size={tokens.typeRowTitle.size} weight="semibold">
              {t('waysCard.password')}
            </Text>
            <State
              on={hasPassword}
              word={hasPassword ? t('waysCard.setUp') : t('waysCard.notSetUp')}
            />
          </View>
          {!hasPassword && (
            <SecondaryButton
              ref={opener('setPassword')}
              label={t('waysCard.setPassword')}
              onPress={() => onSetPassword('setPassword')}
              testID="ways.password.set"
            />
          )}
        </View>

        {rows.map((row) => (
          <Row
            key={row.provider}
            row={row}
            busy={stage.kind === 'working'}
            onLink={() => begin({ action: 'link', provider: row.provider })}
            onUnlink={() => begin({ action: 'unlink', provider: row.provider })}
            onSetPassword={() => onSetPassword(`setPassword.${row.provider}`)}
            opener={opener}
          />
        ))}
      </View>
    </View>
  );
}

function Row({
  row,
  busy,
  onLink,
  onUnlink,
  onSetPassword,
  opener,
}: {
  row: ProviderRow;
  busy: boolean;
  onLink: () => void;
  onUnlink: () => void;
  onSetPassword: () => void;
  opener: (key: string) => Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAMES[row.provider];

  return (
    <View style={styles.row}>
      <View style={styles.detail}>
        <Text size={tokens.typeRowTitle.size} weight="semibold">
          {name}
        </Text>
        <State
          on={row.linked}
          word={row.linked ? t('waysCard.linked') : t('waysCard.notLinked')}
          address={row.email}
        />
      </View>

      {row.canLink && (
        <SecondaryButton
          ref={opener(`link.${row.provider}`)}
          label={t('waysCard.link', { provider: name })}
          onPress={onLink}
          off={busy}
          testID={`ways.${row.provider}.link`}
        />
      )}

      {row.canUnlink && (
        <DestructiveButton
          ref={opener(`unlink.${row.provider}`)}
          stacked={false}
          label={t('waysCard.unlink')}
          accessibilityLabel={t('waysCard.unlinkLabel', { provider: name })}
          onPress={onUnlink}
          off={busy}
          testID={`ways.${row.provider}.unlink`}
        />
      )}

      {row.last && (
        <View style={styles.last}>
          <Text size={tokens.typeBodyPhone.size}>{t('waysCard.last', { provider: name })}</Text>
          <SecondaryButton
            ref={opener(`setPassword.${row.provider}`)}
            label={t('waysCard.setPassword')}
            onPress={onSetPassword}
            testID={`ways.${row.provider}.setPassword`}
          />
        </View>
      )}
    </View>
  );
}

/** A word beside the mark, never the mark alone. */
function State({ on, word, address }: { on: boolean; word: string; address?: string | null }) {
  const markSide = useMarkSide(tokens.sizeMark);
  return (
    <View style={styles.state}>
      <View
        style={[on ? styles.markOn : styles.markOff, markSide]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {on && (
          <Text size={tokens.typePill.size} weight="bold" style={styles.markInk} accessible={false}>
            {tokens.marks.done.glyph}
          </Text>
        )}
      </View>
      <Text
        size={tokens.typeSmall.size}
        weight="semibold"
        style={on ? styles.on : styles.secondary}
      >
        {word}
      </Text>
      {address != null && (
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          · {address}
        </Text>
      )}
    </View>
  );
}

function SaidNotice({ said }: { said: Said }) {
  const { t } = useTranslation();

  if (said.kind === 'linked' || said.kind === 'unlinked') {
    const provider = PROVIDER_NAMES[said.provider];

    return (
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        title={
          said.kind === 'linked'
            ? t('waysCard.linkedDone', { provider })
            : t('waysCard.unlinkedDone', { provider })
        }
        body={
          said.kind === 'linked'
            ? said.email == null
              ? t('waysCard.linkedNextPlain', { provider })
              : t('waysCard.linkedNext', { provider, address: said.email })
            : t('waysCard.unlinkedNext')
        }
        answer={said}
        takesFocus
      />
    );
  }

  if (said.kind === 'keptByRule') {
    return (
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        title={t('waysCard.keptByRule', { organisation: said.organisation })}
        body={t('waysCard.keptByRuleNext', {
          provider: PROVIDER_NAMES[said.provider],
          other: PROVIDER_NAMES[said.provider === 'google' ? 'apple' : 'google'],
        })}
        answer={said}
        takesFocus
      />
    );
  }

  if (said.kind === 'taken') {
    const provider = PROVIDER_NAMES[said.provider];

    return (
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        title={t('waysCard.taken', { provider })}
        body={t('waysCard.takenNext', { provider })}
        answer={said}
        takesFocus
      />
    );
  }

  return (
    <Notice
      tone="broken"
      mark={tokens.marks.broken.glyph}
      body={
        said.kind === 'last'
          ? t('waysCard.lastRefused')
          : said.kind === 'providerFailed'
            ? t('waysCard.providerFailed', { provider: PROVIDER_NAMES[said.provider] })
            : t('waysCard.failedBody')
      }
      answer={said}
      takesFocus
    />
  );
}

/** The password or a linked provider, and the code when two-factor is on; blank fields are caught here. */
function Proving({
  act,
  email,
  hasPassword,
  providers,
  twoFactorOn,
  onProved,
  onCodeSpent,
  onCancel,
}: {
  act: Act;
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  twoFactorOn: boolean;
  onProved: (proof: string) => void;
  onCodeSpent: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAMES[act.provider];

  return (
    <ConfirmItsYou
      idPrefix="ways"
      intro={proveIntro(t, act.action, name)}
      via={proveWith(hasPassword, providers, act.provider)}
      twoFactorOn={twoFactorOn}
      answer={act}
      note={
        act.action === 'link' && (
          <Notice tone="quiet" mark="i" body={t('waysCard.linkNote', { provider: name, email })} />
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
  const way = remainingWay(hasPassword, providers, act.provider);
  const still =
    way == null
      ? null
      : way === 'password'
        ? t('waysCard.stillPassword')
        : t('waysCard.stillProvider', { provider: PROVIDER_NAMES[way] });

  return (
    <>
      <AnswerHeading size={tokens.typeTitleSection.size} weight="bold" answer={act}>
        {t('waysCard.confirmTitle', { provider: name })}
      </AnswerHeading>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {[
          address == null
            ? t('waysCard.confirmBodyPlain', { provider: name })
            : t('waysCard.confirmBody', { provider: name, address }),
          still,
        ]
          .filter((line) => line != null)
          .join(' ')}
      </Text>
      <Notice
        tone="attention"
        mark="!"
        title={t('waysCard.confirmWarning', { provider: name })}
        body={t('waysCard.confirmEmailed', { provider: name })}
      />
      <DestructiveButton
        label={t('waysCard.confirmUnlink', { provider: name })}
        onPress={onUnlink}
        testID="ways.unlink"
      />
      <QuietButton label={t('waysCard.keep')} onPress={onKeep} testID="ways.keep" />
    </>
  );
}

function openerOf(act: Act): string {
  return `${act.action}.${act.provider}`;
}

function refused(error: unknown, provider: Provider): Said {
  if (error instanceof ApiError && error.is('provider_taken')) return { kind: 'taken', provider };
  if (error instanceof ApiError && error.is('last_sign_in_method'))
    return { kind: 'last', provider };
  if (error instanceof ApiError && error.is('provider_kept_by_rule'))
    return { kind: 'keptByRule', provider, organisation: error.problem.organisation ?? '' };

  return { kind: 'failed' };
}

const styles = StyleSheet.create({
  group: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  on: { color: tokens.colorAccentText },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  detail: { flex: 1, minWidth: 160, gap: tokens.spaceXxs },
  state: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceXs },
  markOn: {
    borderRadius: tokens.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.marks.done.fill,
  },
  markOff: {
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
    borderColor: tokens.marks.notStarted.ring,
  },
  markInk: { color: tokens.marks.done.ink },
  last: {
    flexBasis: '100%',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorInset,
  },
});
