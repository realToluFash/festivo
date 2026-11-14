import { LOCALES, ownLanguageName } from '@soirely/domain';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Field } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

/** The guest's own choice, under the host's Language: the info mark and the words, never colour alone (sc-3790). */
export function ChoseNote({ chose }: { chose: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.note} testID="guest.language.chose">
      <Glyph name="info" size={16} ink={tokens.colorAccentText} weight={2.2} />
      <Text size={14} weight="medium" style={styles.noteWords}>
        {t('guestList.languageChose', { language: ownLanguageName(chose) ?? chose })}
      </Text>
    </View>
  );
}

/** sc-3790's Language after Mobile number, optional; its box opens the sheet of Not set and the four in their own names. */
export function LanguageField({
  value,
  chose,
  onOpen,
}: {
  value: string | null;
  chose: string | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const shown = ownLanguageName(value) ?? t('guestList.languageNotSet');

  return (
    <Field
      label={t('language.label')}
      pill={t('eventForm.optional')}
      help={t('guestList.languageHint')}
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.box, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('language.label')}
        accessibilityValue={{ text: shown }}
        testID="guest.form.language"
      >
        <Text size={16} weight="medium" accessible={false} style={styles.grow}>
          {shown}
        </Text>
        <Glyph name="down" size={15} ink={tokens.colorInkSecondary} weight={2.4} />
      </Pressable>
      {chose != null && <ChoseNote chose={chose} />}
    </Field>
  );
}

/** Language's sheet over the focused screen: Not set, then each language in its own name and read in it; a tap picks it and closes the sheet. */
export function languageOver(
  title: string,
  close: string,
  notSet: string,
  value: string | null,
  onPick: (code: string | null) => void,
  onClose: () => void,
): { layer: ReactNode; onClose: () => void } {
  const choices = [
    { code: null, name: notSet },
    ...LOCALES.map((one) => ({ code: one.code, name: one.nativeName })),
  ];

  return {
    layer: (
      <OverSheet title={title} close={close} onClose={onClose}>
        {choices.map((one) => {
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
              testID={`guest.language.${one.code ?? 'notSet'}`}
            >
              <Text size={16} weight="semibold" accessible={false} style={styles.grow}>
                {one.name}
              </Text>
              {on && <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />}
            </Pressable>
          );
        })}
      </OverSheet>
    ),
    onClose,
  };
}

/** A sheet over a focused screen, in that screen's window, since iOS shows one window at a time: from the bottom on a phone, centred on a tablet. */
function OverSheet({
  title,
  close,
  onClose,
  children,
}: {
  title: string;
  close: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const phone = useLayout().kind === 'phone';

  return (
    <View style={[StyleSheet.absoluteFill, !phone && styles.centred]}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={close}
      />
      <View
        style={phone ? styles.layerPhone : styles.layerWide}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        <ScrollView bounces={false}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
                {title}
              </Text>
              <TextAction label={close} onPress={onClose} testID="guest.language.close" />
            </View>
            {children}
          </View>
        </ScrollView>
      </View>
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
  centred: { alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: tokens.scrimSheet },
  layerPhone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colorCard,
  },
  layerWide: {
    width: 540,
    maxWidth: '92%',
    maxHeight: '88%',
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 20, paddingBottom: 34 },
  sheetHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
});
