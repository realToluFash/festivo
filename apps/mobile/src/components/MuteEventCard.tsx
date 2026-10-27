import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type MuteState, readMute, saveMute } from '../kit/eventMute.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

/** `MuteEvent-*` (sc-3980): per person, on the event's page below its buttons, for everyone who can open it. */
export function MuteEventCard({ kind, eventId }: { kind: LayoutKind; eventId: string }) {
  const { t } = useTranslation();
  const [mute, setMute] = useState<MuteState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [tap, setTap] = useState<object | undefined>(undefined);

  useEffect(() => {
    let current = true;
    void readMute(api, eventId).then((read) => {
      if (current) setMute(read);
    });

    return () => {
      current = false;
    };
  }, [eventId, attempt]);

  const change = (next: boolean): void => {
    setMute({ status: 'loaded', muted: next, saving: true, unsaved: false });
    void saveMute(api, eventId, next).then((saved) => {
      setMute(saved);
      if (saved.status === 'loaded' && saved.unsaved) setTap({});
    });
  };

  const loaded = mute.status === 'loaded';
  const muted = loaded && mute.muted;
  const busy = mute.status === 'loading' || (loaded && mute.saving);

  return (
    <View style={cardFrame(kind)} testID="events.mute">
      <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
        {t('eventMute.heading')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} muted>
        {t('eventMute.note')}
      </Text>
      <View style={styles.row}>
        <Text size={tokens.typeBodyPhone.size} style={styles.label}>
          {t('eventMute.switch')}
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('eventMute.switch')}
          accessibilityState={{ checked: muted, disabled: !loaded || busy, busy }}
          disabled={!loaded || busy}
          onPress={() => change(!muted)}
          hitSlop={tokens.spaceSm}
          style={[styles.switch, muted && styles.switchOn]}
          testID="events.mute.switch"
        >
          <View style={[styles.dot, muted ? styles.dotOn : styles.dotOff]} />
          {loaded && (
            <Text
              size={tokens.typeButton.size}
              weight="semibold"
              style={muted ? styles.inkOn : styles.inkOff}
            >
              {muted ? t('eventMute.on') : t('eventMute.off')}
            </Text>
          )}
        </Pressable>
      </View>
      {mute.status === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('eventMute.notLoaded')}
          announce
          action={{
            label: t('eventMute.tryAgain'),
            onPress: () => {
              setMute({ status: 'loading' });
              setAttempt((tries) => tries + 1);
            },
            testID: 'events.mute.tryAgain',
          }}
        />
      )}
      {loaded && mute.unsaved && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('eventMute.notSaved')}
          answer={tap}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  label: { flex: 1 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  switchOn: { backgroundColor: tokens.colorAccentTint },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: tokens.colorAccent },
  dotOff: { borderWidth: 1.5, borderColor: tokens.colorMarkEmpty },
  inkOn: { color: tokens.colorAccentText },
  inkOff: { color: tokens.colorInkSecondary },
});
