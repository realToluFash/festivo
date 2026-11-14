import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import { type GuestLanguage, GUEST_LANGUAGES, languageName } from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';

/** The guest's own choice, under the host's Language: the info mark and the words, never colour alone (sc-3790). */
export function ChoseNote({ chose }: { chose: GuestLanguage }) {
  return (
    <View style={styles.note} testID="guest.language.chose">
      <Glyph name="info" size={16} ink={tokens.colorAccentText} weight={2.2} />
      <Text size={14} weight="medium" style={styles.noteWords}>
        {say.theyChose(languageName(chose) ?? '')}
      </Text>
    </View>
  );
}

/** sc-3790: Language after the contact fields, optional; its box opens the four in their own names, and Not set. */
export function LanguageField({
  value,
  chose,
  onOpen,
  testID,
}: {
  value: GuestLanguage | null;
  chose: GuestLanguage | null;
  onOpen: () => void;
  testID: string;
}) {
  const shown = languageName(value) ?? W.notSet;

  return (
    <EventField label={W.language} optional help={W.languageHint}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.box, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={W.language}
        accessibilityValue={{ text: shown }}
        testID={testID}
      >
        <Text size={16} weight="medium" accessible={false} style={styles.grow}>
          {shown}
        </Text>
        <Glyph name="down" size={15} ink={tokens.colorInkSecondary} weight={2.4} />
      </Pressable>
      {chose != null && <ChoseNote chose={chose} />}
    </EventField>
  );
}

const CHOICES: readonly { code: GuestLanguage | null; name: string }[] = [
  { code: null, name: W.notSet },
  ...GUEST_LANGUAGES,
];

/** The sheet's choices: Not set, then each language in its own name and read in it; a tap picks it. */
export function LanguageChoices({
  value,
  onPick,
}: {
  value: GuestLanguage | null;
  onPick: (code: GuestLanguage | null) => void;
}) {
  return (
    <View>
      {CHOICES.map((one) => {
        const on = one.code === value;

        return (
          <Pressable
            key={one.code ?? 'notSet'}
            onPress={() => onPick(one.code)}
            style={({ pressed }) => [styles.option, on && styles.lit, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={one.name}
            {...(one.code == null ? {} : { accessibilityLanguage: one.code })}
            testID={`guests.language.${one.code ?? 'notSet'}`}
          >
            <Text size={16} weight="semibold" accessible={false} style={styles.grow}>
              {one.name}
            </Text>
            {on && <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: tokens.opacityPressed },
  box: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 14.5,
    paddingRight: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  noteWords: { flex: 1, minWidth: 0, lineHeight: 14 * 1.4 },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
});
