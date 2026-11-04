import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OrgTile } from '../../src/components/OrgTile.tsx';
import { Text } from '../../src/components/Text.tsx';
import { Choices } from '../../src/demo/Choices.tsx';
import { NavBar } from '../../src/demo/DemoScreen.tsx';
import { SAMPLE } from '../../src/demo/samples.ts';
import { WelcomeFrame } from '../../src/components/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

/** An organisation's join link opened signed out: welcome's choices under its tile. */
export default function JoinSignedOut() {
  return (
    <WelcomeFrame
      top={
        <View style={styles.bar}>
          <NavBar left="close" />
        </View>
      }
      brand={
        <View style={styles.brand}>
          <OrgTile name={SAMPLE.organisation} size="card" />
          <Text
            size={tokens.typeTitlePhone.size}
            weight="bold"
            accessibilityRole="header"
            style={styles.centre}
          >
            {`Ask to join ${SAMPLE.organisation}`}
          </Text>
          <Text size={16} style={[styles.centre, styles.secondary]}>
            Sign in or create an account to ask. You come back here after.
          </Text>
        </View>
      }
      choices={
        <Choices
          onEmail={() => router.push('/demo/sign-in?after=join')}
          onApple={() => router.push('/demo/join-message')}
          onGoogle={() => router.push('/demo/join-message')}
          onCreate={() => router.push('/demo/create?after=join')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1 },
  brand: { alignItems: 'center', gap: tokens.spaceLg, maxWidth: 340 },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
});
