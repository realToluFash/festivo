import { Platform, StyleSheet, View } from 'react-native';

import { PrimaryButton, QuietButton } from '../components/Buttons.tsx';
import { ProviderButton } from '../components/ProviderSignIn.tsx';
import { tokens } from '../theme/tokens.ts';
import { BoldAppleButton } from './boldText/BoldAppleButton.tsx';
import { useBoldText } from './boldText/boldTextStore.ts';

/** Email leads; Apple then Google on iPhone and Google then Apple on Android, each as large as email; Create an account under them. */
export function Choices({
  onEmail,
  onApple,
  onGoogle,
  onCreate,
  onJoinCode,
}: {
  onEmail: () => void;
  onApple: () => void;
  onGoogle: () => void;
  onCreate: () => void;
  /** The door code's way in, under Create an account (sc-31774). */
  onJoinCode?: () => void;
}) {
  const bold = useBoldText();
  const apple =
    bold && Platform.OS === 'ios' ? (
      <BoldAppleButton
        key="apple"
        label="Continue with Apple"
        onPress={onApple}
        testID="demo.apple"
      />
    ) : (
      <ProviderButton
        key="apple"
        provider="apple"
        label="Continue with Apple"
        onPress={onApple}
        testID="demo.apple"
      />
    );
  const google = (
    <ProviderButton
      key="google"
      provider="google"
      label="Continue with Google"
      onPress={onGoogle}
      testID="demo.google"
    />
  );

  return (
    <View style={styles.choices}>
      <View style={styles.buttons}>
        <PrimaryButton label="Sign in with email" onPress={onEmail} testID="demo.email" />
        {Platform.OS === 'android' ? [google, apple] : [apple, google]}
      </View>
      <QuietButton label="Create an account" onPress={onCreate} testID="demo.create" />
      {onJoinCode != null && (
        <QuietButton label="Enter a door code" onPress={onJoinCode} testID="demo.joinCode" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { gap: tokens.spaceSm },
  buttons: { gap: tokens.spaceLg },
});
