import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { FocusedScreen } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { AlertLine } from '../events/EventEdits.tsx';
import { Chip, Legend } from './GuestEdit.tsx';
import { type AgreeState, agreedToWhatsApp } from './GuestsModel.ts';
import { type SampleGuest, TODAY } from './GuestsSample.ts';
import { HOW_AGREED, W, say } from './GuestsWords.ts';
import { type HowAgreed, howAgreedProblem } from './WhatsAppConsent.ts';

/** sc-3950: Cancel · Agreed to WhatsApp · Save, the whole screen on an iPhone and the 540 sheet on an iPad; How? starts empty. */
export function AgreeWhatsApp({
  open,
  guest: g,
  start,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  guest: SampleGuest;
  start: AgreeState | null;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSaved: (next: SampleGuest) => void;
}) {
  const kept = start === 'whatsAppAgreePicked' || start === 'whatsAppNotSaved';
  const [how, setHow] = useState<HowAgreed | null>(kept ? 'In person' : null);
  const [checked, setChecked] = useState(start === 'whatsAppAgreeBlank');
  const [failed, setFailed] = useState(start === 'whatsAppNotSaved');
  const first = useRef<ViewInstance>(null);
  const problem = checked ? howAgreedProblem(how) : null;
  const refused = open && start === 'whatsAppAgreeBlank';

  useEffect(() => {
    if (!refused) return;
    const wait = setTimeout(() => moveScreenReaderFocus(first.current), SETTLED_MS);
    return () => clearTimeout(wait);
  }, [refused]);
  const save = () => {
    setChecked(true);
    if (how == null) {
      moveScreenReaderFocus(first.current);
      return;
    }
    setFailed(false);
    onSaved(agreedToWhatsApp(g, how, TODAY));
  };

  return (
    <FocusedScreen
      open={open}
      title={W.agreedToWhatsApp}
      verb={{ label: W.save, on: true, onPress: save, testID: 'guest.whatsApp.save' }}
      onCancel={onClose}
      cancelTestID="guest.whatsApp.cancel"
      opener={opener}
      gap={18}
      testID="guest.whatsApp"
    >
      {failed && <AlertLine text={W.notSaved} />}
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {say.forAgreed(g.name, g.phone ?? '')}
      </Text>
      <View style={styles.tight} accessibilityRole="radiogroup">
        <Legend text={W.howAgreed} />
        <View style={styles.chips}>
          {HOW_AGREED.map((one, at) => (
            <Chip
              key={one}
              ref={at === 0 ? first : undefined}
              word={one}
              on={how === one}
              wrong={problem != null}
              hint={problem ?? undefined}
              onPress={() => setHow(one)}
              testID={`guest.whatsApp.how.${one}`}
            />
          ))}
        </View>
        {problem != null && <AlertLine text={problem} />}
      </View>
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 15 * 1.45 },
  tight: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
