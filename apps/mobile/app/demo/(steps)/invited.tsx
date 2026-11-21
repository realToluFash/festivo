import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, QuietButton } from '../../../src/components/Buttons.tsx';
import { OrgTile } from '../../../src/components/OrgTile.tsx';
import { Text } from '../../../src/components/Text.tsx';
import { DemoScreen, NavBar, closeFlow } from '../../../src/demo/DemoScreen.tsx';
import { Heading } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** An invitation waiting puts joining first; starting your own is one tap under it. */
export default function Invited() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <DemoScreen
      nav={
        <NavBar
          left={{ label: 'Sign out', onPress: () => closeFlow('/demo/welcome') }}
          step={[3, 4]}
        />
      }
      foot={
        <>
          <PrimaryButton
            label={`Join ${SAMPLE.organisation}`}
            onPress={() => router.push({ pathname: '/demo/mobile', params: { via: 'email' } })}
            testID="demo.join"
          />
          <QuietButton
            label="Start my own instead"
            onPress={() => router.push('/demo/organisation')}
            testID="demo.own"
          />
        </>
      }
    >
      <Heading title="You’re invited" intro="Join your team, or start your own organisation." />
      <View style={styles.panel} accessible>
        <OrgTile name={SAMPLE.organisation} size="card" />
        <View style={styles.words}>
          <Text size={tokens.typeRowTitle.size} weight="semibold">
            {SAMPLE.organisation}
          </Text>
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {`An invitation for ${email ?? SAMPLE.email}`}
          </Text>
        </View>
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: tokens.space3xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  words: { flex: 1, gap: 2 },
  secondary: { color: tokens.colorInkSecondary },
});
