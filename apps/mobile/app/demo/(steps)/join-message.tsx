import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { OrgTile } from '../../../src/components/OrgTile.tsx';
import { Text } from '../../../src/components/Text.tsx';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Plain } from '../../../src/steps/Lines.tsx';
import { MESSAGE_MOST, messageCount } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** A join link signed in: one screen, an optional message, who sees what, and Ask to join. */
export default function JoinMessage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function ask(): void {
    if (busy) return;
    setBusy(true);
    setTimeout(
      () => finish(`Asked to join ${SAMPLE.organisation}. We’ll email you when they answer.`),
      700,
    );
  }

  return (
    <DemoScreen
      nav={<NavBar left="close" />}
      foot={
        <PrimaryButton
          label={busy ? 'Asking…' : 'Ask to join'}
          busy={busy}
          onPress={ask}
          testID="demo.ask"
        />
      }
    >
      <View style={styles.top}>
        <OrgTile name={SAMPLE.organisation} size="card" />
        <Text
          size={tokens.typeTitlePhone.size}
          weight="bold"
          accessibilityRole="header"
          style={styles.title}
        >
          {`Ask to join ${SAMPLE.organisation}`}
        </Text>
      </View>
      <View style={styles.field}>
        <InsideField
          label="Message · optional"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={MESSAGE_MOST}
          autoCapitalize="sentences"
          placeholder={SAMPLE.joinMessage}
          testID="demo.message"
        />
      </View>
      <Plain>{messageCount(message)}</Plain>
      <Plain top={tokens.spaceXl} ink>
        {`${SAMPLE.organisation} sees your name, your email address and your message.`}
      </Plain>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: tokens.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  title: { flex: 1, letterSpacing: -0.5 },
  field: { marginTop: tokens.space3xl },
});
