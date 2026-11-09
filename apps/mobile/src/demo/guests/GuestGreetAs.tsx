import type { RefObject } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { Row } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import { BoxField } from '../events/EventsPick.tsx';
import { LineIcon } from '../../components/AccountCard.tsx';
import { GREET_AS_MAX, greetAsCount } from './GuestsModel.ts';
import type { SampleGuest } from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';

/** sc-3960: Greet as under Full name, optional, its counter in code points after trimming; no maxlength, the check refuses past 60. */
export function GreetAsField({
  value,
  onChange,
  error,
  autoFocus = false,
  fieldRef,
  testID,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  autoFocus?: boolean;
  fieldRef: RefObject<TextInputInstance | null>;
  testID: string;
}) {
  return (
    <View style={styles.tight}>
      <EventField label={W.greetAs} optional error={error} help={W.greetAsHint}>
        <BoxField
          ref={fieldRef}
          value={value}
          wrong={error != null}
          autoFocus={autoFocus}
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={onChange}
          accessibilityLabel={W.greetAs}
          testID={testID}
        />
      </EventField>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.count]}>
        {say.ofMax(greetAsCount(value), GREET_AS_MAX)}
      </Text>
    </View>
  );
}

/** The details' Greet as row, for every role that reads the guest; with none, their full name, in Ink 2 as Not set is. */
export function GreetAsRow({ g }: { g: SampleGuest }) {
  const title = g.greetAs == null ? W.greetedByName : say.greetsAs(g.greetAs);

  return (
    <Row
      title={title}
      line={W.greetAs}
      lead={<LineIcon name="chat" />}
      weight={g.greetAs == null ? 'medium' : 'semibold'}
      off={g.greetAs == null}
      accessibilityLabel={`${W.greetAs}, ${title}`}
      testID="guest.greetAs"
    />
  );
}

const styles = StyleSheet.create({
  tight: { gap: 6 },
  secondary: { color: tokens.colorInkSecondary },
  count: { lineHeight: 13.5 * 1.4, fontVariant: ['tabular-nums'] },
});
