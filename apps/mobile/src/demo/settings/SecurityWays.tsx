import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Notice } from '../../components/Notice.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { ConfirmItsYou } from './AccountConfirm.tsx';
import {
  ItemRow,
  Lead,
  Note,
  RowPill,
  StateMark,
  Step,
  StepPill,
  SubHead,
  WhiteRows,
} from './AccountParts.tsx';
import { Card, CardHead, Pair } from './parts.tsx';
import { YOU, type SettingsLayout } from './sample.ts';
import {
  keptByRule,
  linkedProviders,
  onlyWayIn,
  PROOF_MINUTES,
  type Provider,
  PROVIDER_ADDRESS,
  PROVIDERS,
  type Ways,
} from './SecuritySample.ts';
import { ChangePassword, SetPassword } from './SecurityPassword.tsx';

export type WaysStage =
  | { kind: 'rest' }
  | { kind: 'changing' }
  | { kind: 'setting' }
  | { kind: 'proving'; provider: Provider; then: 'link' | 'unlink' }
  | { kind: 'unlinking'; provider: Provider };

type Said = { tone: 'done' | 'broken'; title: string | null; body: string } | null;

export function WaysCard({
  layout,
  ways,
  onWays,
  rule,
  twoFactorOn,
  startStage,
  onForgot,
  onSignedOutOthers,
}: {
  layout: SettingsLayout;
  ways: Ways;
  onWays: (ways: Ways) => void;
  rule: boolean;
  twoFactorOn: boolean;
  startStage: WaysStage;
  onForgot: () => void;
  /** Saving a new password signs out every other device; this says how many went. */
  onSignedOutOthers: () => number;
}) {
  const [stage, setStage] = useState<WaysStage>(startStage);
  const [proved, setProved] = useState(startStage.kind === 'unlinking');
  const [said, setSaid] = useState<Said>(
    rule
      ? {
          tone: 'broken',
          title: `A rule set by ${YOU.organisation}: everyone in it signs in with Google or Apple, so your last one cannot be removed.`,
          body: 'Link Apple first if you want to unlink Google.',
        }
      : null,
  );
  const wide = layout === 'portrait';
  const first = linkedProviders(ways)[0] ?? 'Google';

  function rest(next: Said): void {
    setSaid(next);
    setStage({ kind: 'rest' });
  }

  function link(provider: Provider): void {
    onWays({ ...ways, [provider]: true });
    rest({
      tone: 'done',
      title: `${provider} is linked.`,
      body: `Next time, sign in with ${provider}, or as before. We emailed your verified addresses to say so.`,
    });
  }

  function ask(provider: Provider, then: 'link' | 'unlink'): void {
    setSaid(null);
    if (then === 'unlink' && keptByRule(ways, provider, rule)) {
      const other = PROVIDERS.find((each) => each !== provider) ?? 'Apple';
      setSaid({
        tone: 'broken',
        title: `A rule set by ${YOU.organisation}: everyone in it signs in with Google or Apple, so your last one cannot be removed.`,
        body: `Link ${other} first if you want to unlink ${provider}.`,
      });
      return;
    }
    if (!proved) setStage({ kind: 'proving', provider, then });
    else if (then === 'link') link(provider);
    else setStage({ kind: 'unlinking', provider });
  }

  if (stage.kind === 'changing')
    return (
      <ChangePassword
        layout={layout}
        onForgot={onForgot}
        onCancel={() => rest(null)}
        onSaved={() => {
          const gone = onSignedOutOthers();
          rest({
            tone: 'done',
            title: null,
            body:
              gone === 0
                ? 'Password changed. No other device was signed in.'
                : gone === 1
                  ? 'Password changed. Your other device is signed out.'
                  : `Password changed. Your ${gone} other devices are signed out.`,
          });
        }}
      />
    );

  if (stage.kind === 'setting')
    return (
      <SetPassword
        layout={layout}
        onCancel={() => rest(null)}
        onSaved={() => {
          onWays({ ...ways, password: true });
          rest({
            tone: 'done',
            title: null,
            body: `Password added. You can sign in with it or with ${first}.`,
          });
        }}
      />
    );

  if (stage.kind === 'proving') {
    const { provider, then } = stage;
    const intro = `To ${then} ${provider}, confirm it's you. You won't be asked again for ${PROOF_MINUTES} minutes.`;
    const onProved = (): void => {
      setProved(true);
      if (then === 'link') link(provider);
      else setStage({ kind: 'unlinking', provider });
    };

    return (
      <Card>
        {ways.password ? (
          <ConfirmItsYou
            layout={layout}
            intro={intro}
            note={
              then === 'link'
                ? `Next, ${provider} opens so you can choose the account to link. Its address doesn't have to match ${SAMPLE.email}.`
                : undefined
            }
            twoFactorOn={twoFactorOn}
            onProved={onProved}
            onCancel={() => rest(null)}
            testID={`demo.security.${provider}.prove`}
          />
        ) : (
          <>
            <SubHead text="Confirm it's you" />
            <Lead text={intro} />
            <Lead text={`You sign in with ${first}, so confirm with ${first} instead.`} />
            <Pair
              layout={layout}
              dismiss={
                <StepPill
                  layout={layout}
                  label="Cancel"
                  kind="secondary"
                  onPress={() => rest(null)}
                />
              }
              confirm={
                <StepPill layout={layout} label={`Continue with ${first}`} onPress={onProved} />
              }
            />
          </>
        )}
      </Card>
    );
  }

  if (stage.kind === 'unlinking') {
    const { provider } = stage;
    const address = PROVIDER_ADDRESS[provider];
    const still = ways.password
      ? 'You can still sign in with your password.'
      : `You can still sign in with ${linkedProviders(ways).find((each) => each !== provider) ?? ''}.`;

    return (
      <Card>
        <CardHead
          title={`Unlink ${provider}?`}
          line={`${
            address == null
              ? `You'll no longer be able to sign in with ${provider}.`
              : `You'll no longer be able to sign in with ${provider} as ${address}.`
          } ${still}`}
        />
        <Notice
          tone="attention"
          mark="!"
          title={`Devices signed in with ${provider} are signed out`}
          body={`We email every verified address on your account to say ${provider} was unlinked.`}
        />
        <Pair
          layout={layout}
          dismiss={
            <StepPill
              layout={layout}
              label="Keep it linked"
              kind="quiet"
              onPress={() => rest(null)}
            />
          }
          confirm={
            <StepPill
              layout={layout}
              label={`Unlink ${provider}`}
              kind="danger"
              onPress={() => {
                onWays({ ...ways, [provider]: false });
                rest({
                  tone: 'done',
                  title: `${provider} is unlinked. Devices signed in with it are signed out.`,
                  body: 'You can link it again here at any time. We emailed your verified addresses to say so.',
                });
              }}
            />
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHead
        title="Ways to sign in"
        line={`Any one of these signs you in to ${SAMPLE.email}. Linking or unlinking asks you to confirm it's you, and we email your verified addresses each time.`}
      />
      {said != null && (
        <Notice
          tone={said.tone}
          mark={said.tone === 'done' ? tokens.marks.done.glyph : tokens.marks.broken.glyph}
          body={said.body}
          {...(said.title == null ? {} : { title: said.title })}
          announce
        />
      )}
      <WhiteRows>
        {[
          <ItemRow
            key="password"
            wide={wide}
            who={
              <>
                <Text size={15.5} weight="semibold">
                  Password
                </Text>
                <StateMark on={ways.password} word={ways.password ? 'Set up' : 'Not set up'} />
                <Note
                  text={
                    ways.password
                      ? 'Used with your email to sign in. Changing it signs out your other devices; this one stays signed in.'
                      : `You sign in with ${first}. Add a password so you can also sign in with your email if you ever lose that ${first} account.`
                  }
                />
              </>
            }
            actions={
              <RowPill
                label={ways.password ? 'Change password' : 'Set a password'}
                onPress={() => {
                  setSaid(null);
                  setStage({ kind: ways.password ? 'changing' : 'setting' });
                }}
              />
            }
          />,
          ...PROVIDERS.map((provider) => {
            const linked = ways[provider];
            const only = onlyWayIn(ways, provider);
            const address = PROVIDER_ADDRESS[provider];

            return (
              <ItemRow
                key={provider}
                wide={wide}
                who={
                  <>
                    <Text size={15.5} weight="semibold">
                      {provider}
                    </Text>
                    <StateMark
                      on={linked}
                      word={linked ? 'Linked' : 'Not linked'}
                      after={linked && address != null ? address : undefined}
                    />
                  </>
                }
                actions={
                  only ? null : linked ? (
                    <RowPill
                      label="Unlink…"
                      kind="dangerQuiet"
                      onPress={() => ask(provider, 'unlink')}
                      accessibilityLabel={`Unlink ${provider}`}
                    />
                  ) : (
                    <RowPill label={`Link ${provider}`} onPress={() => ask(provider, 'link')} />
                  )
                }
              >
                {only && (
                  <Step gap={tokens.spaceLg}>
                    <Text size={14.5} weight="medium">
                      {`${provider} is your only way to sign in, so it can't be removed. Set a password or link another account before removing this one.`}
                    </Text>
                    <View style={styles.start}>
                      <RowPill
                        label="Set a password"
                        onPress={() => {
                          setSaid(null);
                          setStage({ kind: 'setting' });
                        }}
                      />
                    </View>
                  </Step>
                )}
              </ItemRow>
            );
          }),
        ]}
      </WhiteRows>
    </Card>
  );
}

const styles = StyleSheet.create({
  start: { alignItems: 'flex-start' },
});
