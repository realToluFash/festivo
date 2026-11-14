import { type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, changedWords, eventAllows } from '@soirely/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { pauseRefusalOf } from '../kit/makeLive.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { useSendingWords } from './ReadOut.tsx';

const PAUSE_BARS = '‖';

/** Resume, which asks nothing: on a refusal it reads the event again and says what it now is. */
export function useResume(event: OrganisationEvent, onChange: (event: OrganisationEvent) => void) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [changedTo, setChangedTo] = useState<EventStatus | null>(null);
  useSendingWords(state === 'pending' ? t('eventPause.resuming') : undefined);

  const resume = () => {
    setState('pending');
    setChangedTo(null);
    api.resumeEvent(event.id).then(
      ({ event: resumed }) => {
        setState('idle');
        onChange(resumed);
      },
      (error: unknown) => {
        if (pauseRefusalOf(error).kind === 'failed') {
          setState('failed');
          return;
        }

        api.event(event.id).then(
          (latest) => {
            setState('idle');
            setChangedTo(latest.status);
            onChange(latest);
          },
          () => setState('failed'),
        );
      },
    );
  };

  return { resume, state, changedTo, changed: changedTo === event.status };
}

/** `Event View` (tweak: Paused): the amber line, and Resume, which asks nothing; past the end the phase is Finished and neither shows. A refusal reloads the event, which may then be past Paused: the row stays to say so. */
export function PausedRow({
  event,
  phase,
  manages,
  onChange,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  manages: boolean;
  onChange: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const { resume, state, changedTo, changed } = useResume(event, onChange);

  if (phase !== 'paused' && !changed) return null;

  return (
    <View style={styles.paused} testID="events.pausedRow">
      <Notice
        tone="attention"
        mark={PAUSE_BARS}
        body={changed ? t(changedWords(event)[0]) : t('eventPause.notice')}
        detail={
          changed
            ? t(changedWords(event)[1])
            : state === 'failed'
              ? t('eventPause.resumeFailed')
              : null
        }
        answer={changed ? changedTo : undefined}
      />
      {manages && eventAllows(phase, 'resume') && (
        <PrimaryButton
          label={state === 'pending' ? t('eventPause.resuming') : t('eventPause.resume')}
          onPress={resume}
          busy={state === 'pending'}
          testID="events.resume"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paused: { gap: tokens.spaceMd },
});
