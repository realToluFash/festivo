import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OrgTile } from '../../src/components/OrgTile.tsx';
import { Text } from '../../src/components/Text.tsx';
import { Choices } from '../../src/demo/Choices.tsx';
import { DemoScreen, NavBar } from '../../src/demo/DemoScreen.tsx';
import { ManagedBanner } from '../../src/demo/Managed.tsx';
import { SAMPLE } from '../../src/demo/samples.ts';
import { WelcomeFrame } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

/** Another organisation's request link, for ?state=managed: Folake's address is Ire Events', so Ask to join is refused (sc-563). */
const ELSEWHERE = 'Lumen Feiras';

/** An organisation's join link opened signed out: welcome's choices under its tile. */
export default function JoinSignedOut() {
  const { state } = useLocalSearchParams<{ state?: string }>();

  if (state === 'managed') return <JoinManaged />;

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

/** The link signed in, as Ask to join draws it, with the refusal where the message and Ask to join were. */
function JoinManaged() {
  return (
    <DemoScreen nav={<NavBar left="close" />}>
      <View style={styles.top}>
        <OrgTile name={ELSEWHERE} size="card" />
        <Text
          size={tokens.typeTitlePhone.size}
          weight="bold"
          accessibilityRole="header"
          style={styles.title}
        >
          {`Ask to join ${ELSEWHERE}`}
        </Text>
      </View>
      <View style={styles.refusal}>
        <ManagedBanner testID="join.managed" />
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1 },
  brand: { alignItems: 'center', gap: tokens.spaceLg, maxWidth: 340 },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
  top: {
    marginTop: tokens.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  title: { flex: 1, letterSpacing: -0.5 },
  refusal: { marginTop: tokens.space3xl },
});
