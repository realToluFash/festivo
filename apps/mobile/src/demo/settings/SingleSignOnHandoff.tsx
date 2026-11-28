import { type RefObject, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DemoOnly, Says } from '../../steps/Lines.tsx';
import { SSO_PROVIDER, type SsoWay } from './SingleSignOnSignIn.ts';
import { BrowserStandIn } from './SingleSignOnParts.tsx';
import { SSO_SIGN_IN_WORDS as S } from './SingleSignOnWords.ts';

const P = SSO_PROVIDER;

/** In the password's place for an address the organisation signs in: its provider, and the way past it where there is one. */
export function SsoHandoff({
  way,
  email,
  failed,
  onAnotherWay,
}: {
  way: Exclude<SsoWay, 'password' | 'breakGlass'>;
  email: string;
  failed: string | null;
  onAnotherWay: (() => void) | null;
}) {
  const [via, setVia] = useState<string | null>(null);

  return (
    <View style={styles.block}>
      {way === 'handoff' ? (
        <>
          <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
            {S.through(P)}
          </Text>
          <Says words={S.throughLine(P)} quiet />
        </>
      ) : (
        <>
          <Says words={via == null ? S.required(P) : S.viaRefused(via, P)} />
          <Says words={S.requiredLine} quiet />
        </>
      )}
      {failed != null && <Says words={failed} />}
      {onAnotherWay != null && (
        <View style={styles.start}>
          <QuietButton label={S.anotherWay} onPress={onAnotherWay} testID="demo.sso.anotherWay" />
        </View>
      )}
      {way === 'required' && (
        <DemoOnly title={S.viaDemo(email.trim())}>
          <SecondaryButton
            label="Google"
            onPress={() => setVia('Google')}
            testID="demo.sso.google"
          />
          <SecondaryButton label="Apple" onPress={() => setVia('Apple')} testID="demo.sso.apple" />
        </DemoOnly>
      )}
    </View>
  );
}

/** Continue to the provider: the product opens the system browser; the demo's stand-in answers for it. */
export function useHandoff(opener: RefObject<ViewInstance | null>, onSignedIn: () => void) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const sheet = (
    <BrowserStandIn
      open={open}
      title={S.browserTitle(P)}
      name={P}
      opener={opener}
      stop={S.stop}
      onCame={(came) => {
        setOpen(false);
        if (came === 'worked') onSignedIn();
        else setFailed(S.didNotWork(P));
      }}
      onStop={() => setOpen(false)}
    />
  );

  return {
    failed,
    sheet,
    label: S.continueTo(P),
    start: () => {
      setFailed(null);
      setOpen(true);
    },
  };
}

export function BreakGlass({ owner, onBack }: { owner: boolean; onBack: () => void }) {
  return (
    <View style={styles.block}>
      {owner && <Says words={S.breakGlass(P)} quiet />}
      <View style={styles.start}>
        <QuietButton label={S.backTo(P)} onPress={onBack} testID="demo.sso.backTo" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: tokens.spaceXl, gap: tokens.spaceXs },
  start: { alignItems: 'flex-start' },
});
