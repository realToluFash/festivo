import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { focusChecked } from '../../../src/components/Field.tsx';
import { OrgTile } from '../../../src/components/OrgTile.tsx';
import { Text } from '../../../src/components/Text.tsx';
import { useFormChecks } from '../../../src/kit/formChecks.ts';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import {
  JOIN_COPY,
  joinLanguage,
  joinStart,
  messageTooLong,
  startingMessage,
} from '../../../src/demo/joinMessage.ts';
import { MessageBox } from '../../../src/demo/MessageBox.tsx';
import { Plain } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** A join link signed in: one screen, an optional message that scrolls inside its box, who sees what, and Ask to join. Typing past 500 is not stopped; Ask to join refuses it above the keys. */
export default function JoinMessage() {
  const params = useLocalSearchParams<{ message?: string; lang?: string }>();
  const copy = JOIN_COPY[joinLanguage(params.lang)];
  const start = joinStart(params.message);
  const [message, setMessage] = useState(() => startingMessage(start));
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const checks = useFormChecks(
    ['message'] as const,
    (_, value) => (messageTooLong(value) ? copy.tooLong : null),
    () => focusChecked(input),
  );

  function ask(): void {
    if (busy || !checks.passes({ message })) return;
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
          label={busy ? copy.asking : copy.ask}
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
          {copy.title}
        </Text>
      </View>
      <View style={styles.field}>
        <MessageBox
          ref={input}
          label={copy.label}
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            checks.edited('message', text);
          }}
          onBlur={() => checks.left('message', message)}
          line={checks.errors.message ?? null}
          count={copy.count(message)}
          autoFocus={start !== 'empty'}
          testID="demo.message"
        />
      </View>
      <Plain top={tokens.spaceXl} ink>
        {copy.whatTheySee}
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
