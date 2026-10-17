import {
  ApiError,
  type LinkedProvider,
  type Provider,
  ProviderCancelled,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { proofStands, proveWith, providerRows, type ProviderRow } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import {
  type ProvingField,
  codeBeforeTrip,
  keptProof,
  provingRefusal,
  tripRefused,
} from '../kit/waysProof.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { CodeField, Field } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PasswordField } from './PasswordField.tsx';
import { useAboveKeyboard } from './Screen.tsx';
import { Text } from './Text.tsx';

type Act = { action: 'link' | 'unlink'; provider: Provider };

type Said =
  | { kind: 'linked'; provider: Provider; email: string | null }
  | { kind: 'unlinked' | 'taken' | 'last' | 'providerFailed'; provider: Provider }
  | { kind: 'failed' };

type Stage =
  | { kind: 'list'; said: Said | null }
  | { kind: 'proving'; act: Act }
  | { kind: 'confirming'; act: Act }
  | { kind: 'working' };

/** In memory only: five minutes, and gone with the app. */
let held: { proof: string; expiresAt: string } | null = null;

function heldProof(): string | null {
  return held != null && proofStands(held.expiresAt) ? held.proof : null;
}

/** Settings > Security, between Password and Two-factor: link or unlink Google and Apple (sc-510). */
export function WaysCard({
  email,
  hasPassword,
  providers,
  kind,
  onChanged,
  onSetPassword,
  onSignedOutHere,
}: {
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  kind: LayoutKind;
  onChanged: () => Promise<void>;
  onSetPassword: () => void;
  onSignedOutHere: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'list', said: null });
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const frame = [styles.card, kind === 'tabletLandscape' ? styles.cardWide : styles.cardNarrow];
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
    if (heldProof() == null) setStage({ kind: 'proving', act });
    else void proceed(act);
  }

  async function proceed(act: Act): Promise<void> {
    if (act.action === 'unlink') {
      setStage({ kind: 'confirming', act });

      return;
    }

    const proof = heldProof();
    if (proof == null) {
      setStage({ kind: 'proving', act });

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

  async function unlink(provider: Provider): Promise<void> {
    const proof = heldProof();
    if (proof == null) {
      setStage({ kind: 'proving', act: { action: 'unlink', provider } });

      return;
    }

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
          onProved={() => void proceed(stage.act)}
          onCancel={() => setStage({ kind: 'list', said: null })}
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
          onUnlink={() => void unlink(stage.act.provider)}
          onKeep={() => setStage({ kind: 'list', said: null })}
        />
      </View>
    );
  }

  return (
    <View style={frame}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('waysCard.title')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('waysCard.intro', { email })}
      </Text>

      {stage.kind === 'list' && stage.said != null && <SaidNotice said={stage.said} />}

      <View accessibilityLabel={t('waysCard.title')}>
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
              label={t('waysCard.setPassword')}
              onPress={onSetPassword}
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
            onSetPassword={onSetPassword}
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
}: {
  row: ProviderRow;
  busy: boolean;
  onLink: () => void;
  onUnlink: () => void;
  onSetPassword: () => void;
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
          label={t('waysCard.link', { provider: name })}
          onPress={onLink}
          off={busy}
          testID={`ways.${row.provider}.link`}
        />
      )}

      {row.canUnlink && (
        <SecondaryButton
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
  return (
    <View style={styles.state}>
      <View style={on ? styles.markOn : styles.markOff}>
        {on && (
          <Text size={tokens.typePill.size} weight="bold" style={styles.markInk}>
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
  onCancel,
}: {
  act: Act;
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  twoFactorOn: boolean;
  onProved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAMES[act.provider];
  const via = proveWith(hasPassword, providers, act.provider);
  const password = useRef('');
  const code = useRef('');
  const passwordInput = useRef<TextInput>(null);
  const codeInput = useRef<TextInput>(null);
  // With a provider, the code is asked for when it returns, never before the trip (a code lapses in 30 seconds).
  const [codeAsked, setCodeAsked] = useState(codeBeforeTrip(via, twoFactorOn));
  const returned = useRef<ProviderSignInAttempt | null>(null);
  const kept = useRef<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [refusal, setRefusal] = useState<{
    field: ProvingField | 'failed';
    message: string;
  } | null>(null);
  const aboveKeyboard = useAboveKeyboard();
  const checks = useFormChecks(
    (via === 'password' ? ['password', 'code'] : ['code']) as readonly ProvingField[],
    (field, value) =>
      field === 'password'
        ? value === ''
          ? t('waysCard.passwordBlank')
          : null
        : codeAsked && value.trim() === ''
          ? t('waysCard.codeBlank')
          : null,
    (field) => (field === 'password' ? passwordInput : codeInput).current?.focus(),
  );

  async function submit(): Promise<void> {
    if (checking || !checks.passes({ password: password.current, code: code.current })) return;

    setChecking(true);
    setRefusal(null);

    try {
      if (via !== 'password' && via != null && kept.current == null)
        returned.current ??= await confirmWithProvider(via, true);

      const first =
        kept.current != null
          ? { pendingProof: kept.current }
          : via === 'password' || via == null || returned.current == null
            ? { password: password.current }
            : { provider: via, signIn: returned.current };
      held = await api.prove(first, codeAsked ? code.current.trim() : undefined);
      onProved();
    } catch (error) {
      setChecking(false);

      if (error instanceof ProviderCancelled) return;
      if (error instanceof ApiError && error.is('two_factor_required')) {
        setCodeAsked(true);

        return;
      }

      // Only a refused trip is made again: after a wrong code the next Continue sends the API's kept proof.
      kept.current = via === 'password' ? null : keptProof(error, kept.current);
      if (via !== 'password' && tripRefused(error)) returned.current = null;
      setRefusal(
        provingRefusal(
          error,
          t,
          via === 'password' || via == null ? null : PROVIDER_NAMES[via],
          currentLocale(),
        ),
      );
    }
  }

  const passwordError =
    checks.errors.password ?? (refusal?.field === 'password' ? refusal.message : null);
  const codeError = checks.errors.code ?? (refusal?.field === 'code' ? refusal.message : null);

  return (
    <>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('waysCard.proveTitle')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {act.action === 'link'
          ? t('waysCard.proveLink', { provider: name })
          : t('waysCard.proveUnlink', { provider: name })}
      </Text>

      {refusal?.field === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('waysCard.failedTitle')}
          body={refusal.message}
        />
      )}

      {via === 'password' && (
        <Field label={t('waysCard.yourPassword')} error={passwordError}>
          <PasswordField
            ref={passwordInput}
            wrong={passwordError != null}
            submitting={checking}
            editable={!checking}
            autoComplete="current-password"
            textContentType="password"
            onChangeText={(text) => {
              password.current = text;
              if (refusal?.field === 'password') setRefusal(null);
              checks.edited('password', text);
            }}
            onBlur={() => checks.left('password', password.current)}
            returnKeyType={codeAsked ? 'next' : 'done'}
            onSubmitEditing={() => (codeAsked ? codeInput.current?.focus() : void submit())}
            accessibilityLabel={t('waysCard.yourPassword')}
            testID="ways.password"
          />
        </Field>
      )}

      <View ref={aboveKeyboard} style={styles.group}>
        {codeAsked && (
          <Field label={t('waysCard.code')} error={codeError} help={t('waysCard.codeHelp')}>
            <CodeField
              ref={codeInput}
              wrong={codeError != null}
              editable={!checking}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              onChangeText={(text) => {
                code.current = text;
                if (refusal?.field === 'code') setRefusal(null);
                checks.edited('code', text);
              }}
              onBlur={() => checks.left('code', code.current)}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              accessibilityLabel={t('waysCard.code')}
              testID="ways.code"
            />
          </Field>
        )}

        {act.action === 'link' && (
          <Notice tone="quiet" mark="i" body={t('waysCard.linkNote', { provider: name, email })} />
        )}

        {via !== 'password' && via != null && (
          <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[via] })}
          </Text>
        )}

        <PrimaryButton
          label={
            checking
              ? t('waysCard.checking')
              : via === 'password' || via == null || codeAsked
                ? t('waysCard.continue')
                : t('waysCard.continueWith', { provider: PROVIDER_NAMES[via] })
          }
          onPress={() => void submit()}
          busy={checking}
          testID="ways.continue"
        />
      </View>
      <QuietButton label={t('waysCard.cancel')} onPress={onCancel} testID="ways.cancel" />
    </>
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
  const other = providers.find((entry) => entry.provider !== act.provider)?.provider;

  return (
    <>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('waysCard.confirmTitle', { provider: name })}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {`${
          address == null
            ? t('waysCard.confirmBodyPlain', { provider: name })
            : t('waysCard.confirmBody', { provider: name, address })
        } ${
          hasPassword || other == null
            ? t('waysCard.stillPassword')
            : t('waysCard.stillProvider', { provider: PROVIDER_NAMES[other] })
        }`}
      </Text>
      <Notice
        tone="attention"
        mark="!"
        title={t('waysCard.confirmWarning', { provider: name })}
        body={t('waysCard.confirmEmailed', { provider: name })}
      />
      <PrimaryButton
        label={t('waysCard.confirmUnlink', { provider: name })}
        onPress={onUnlink}
        testID="ways.unlink"
      />
      <SecondaryButton label={t('waysCard.keep')} onPress={onKeep} testID="ways.keep" />
    </>
  );
}

function refused(error: unknown, provider: Provider): Said {
  if (error instanceof ApiError && error.is('provider_taken')) return { kind: 'taken', provider };
  if (error instanceof ApiError && error.is('last_sign_in_method'))
    return { kind: 'last', provider };

  return { kind: 'failed' };
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  cardNarrow: { padding: tokens.spaceXxl },
  cardWide: { padding: tokens.space3xl, maxWidth: 640 },
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
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    borderRadius: tokens.sizeMark / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.marks.done.fill,
  },
  markOff: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    borderRadius: tokens.sizeMark / 2,
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
