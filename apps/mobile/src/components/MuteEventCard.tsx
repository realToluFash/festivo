import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { announceMute, useMutes } from '../eventMutes.ts';
import {
  type HeldMute,
  type MuteState,
  answeredMute,
  heardMute,
  readMute,
  saveMute,
  shownMute,
} from '../kit/eventMute.ts';
import { tokens } from '../theme/tokens.ts';
import { Notice } from './Notice.tsx';
import { OnOffSwitch } from './OnOffSwitch.tsx';
import { Text } from './Text.tsx';
import { rereadOrganisations } from '../signedIn.ts';

/** `MuteEvent-*` (sc-3980): the viewer's own mute for an event, read on opening, saved on each change, and heard from elsewhere. */
export function useEventMute(eventId: string) {
  const [held, setHeld] = useState<HeldMute>({ eventId, state: { status: 'loading' } });
  const mute = shownMute(held, eventId);
  const setMute = (state: MuteState): void => setHeld({ eventId, state });
  const [attempt, setAttempt] = useState(0);
  const [tap, setTap] = useState<object | undefined>(undefined);

  useMutes((changed, saved) => {
    const heard = heardMute(eventId, changed, saved);
    if (heard != null) setMute(heard);
  });

  useEffect(() => {
    let current = true;
    void readMute(api, eventId).then((read) => {
      if (current) setHeld({ eventId, state: read });
    });

    return () => {
      current = false;
    };
  }, [eventId, attempt]);

  const change = (next: boolean): void => {
    setMute({ status: 'loaded', muted: next, saving: true, unsaved: false });
    void saveMute(api, eventId, next).then(({ state, saved }) => {
      setHeld((current) => answeredMute(current, eventId, state));
      if (saved == null) setTap({});
      else announceMute(eventId, saved);
    });
  };

  const loaded = mute.status === 'loaded';
  const muted = loaded && mute.muted;
  const busy = mute.status === 'loading' || (loaded && mute.saving);
  const retry = (): void => {
    void rereadOrganisations();
    setMute({ status: 'loading' });
    setAttempt((tries) => tries + 1);
  };

  return { mute, loaded, muted, busy, change, retry, tap };
}

/** The one Mute this event switch, in a bell item's More. */
export function MuteEventSwitch({ eventId, testID }: { eventId: string; testID: string }) {
  const { t } = useTranslation();
  const { mute, loaded, muted, busy, change, retry, tap } = useEventMute(eventId);

  return (
    <>
      <View style={styles.row}>
        <Text size={tokens.typeBodyPhone.size} style={styles.label}>
          {t('eventMute.switch')}
        </Text>
        <OnOffSwitch
          on={loaded ? muted : null}
          words={{ on: t('eventMute.on'), off: t('eventMute.off') }}
          label={t('eventMute.switch')}
          disabled={!loaded}
          busy={busy}
          onChange={change}
          testID={`${testID}.switch`}
        />
      </View>
      {mute.status === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('eventMute.notLoaded')}
          announce
          action={{
            label: t('eventMute.tryAgain'),
            onPress: retry,
            testID: `${testID}.tryAgain`,
          }}
        />
      )}
      {mute.status === 'loaded' && mute.unsaved && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('eventMute.notSaved')}
          answer={tap}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  label: { flex: 1 },
});
