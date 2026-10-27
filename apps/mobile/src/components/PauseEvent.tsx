import { type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, eventAllows } from '@soirely/domain';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { NOW_STATE, type PauseRefusal, pauseRefusalOf } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { LifecycleSheet, useLifecycleAction } from './LifecycleSheet.tsx';
import { Notice } from './Notice.tsx';

const PAUSE_BARS = '‖';

/** `Lifecycle-*` (tweak: Pause; sc-3586): a secondary button beside Call off or End now, asking first. */
export function PauseButton({
  kind,
  event,
  phase,
  manages,
  onChange,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  phase: EventPhase;
  manages: boolean;
  onChange: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const opener = useRef<View>(null);
  const { asking, ask, go, close } = useLifecycleAction<object, PauseRefusal>({
    event,
    onChange,
    refusalOf: pauseRefusalOf,
  });
  const offered = manages && eventAllows(phase, 'pause');

  // A refusal reloads the event, which may then offer no Pause: its sheet stays to say so.
  if (!offered && asking == null) return null;

  return (
    <>
      {offered && (
        <SecondaryButton
          ref={opener}
          label={t('eventPause.pause')}
          onPress={() => ask({})}
          testID="events.pause"
        />
      )}
      <LifecycleSheet
        phone={kind === 'phone'}
        open={asking != null}
        opener={opener}
        testID="events.pause"
        title={
          asking?.kind === 'changed'
            ? t('eventPause.notPaused')
            : t('eventPause.title', { name: event.name })
        }
        lines={
          asking?.kind === 'changed'
            ? [t('eventLive.changedElsewhere'), t(NOW_STATE[event.status])]
            : [
                t('eventPause.body'),
                t('eventPause.nothingLost'),
                ...(asking?.failed === true ? [t('eventPause.failed')] : []),
              ]
        }
        confirm={
          asking?.kind === 'confirm'
            ? {
                label: t('eventPause.pause'),
                keep: t('eventPause.keepItLive'),
                pending: asking.pending,
                onGo: () => go({}, () => api.pauseEvent(event.id)),
              }
            : null
        }
        onClose={close}
      />
    </>
  );
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
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [changedTo, setChangedTo] = useState<EventStatus | null>(null);
  const changed = changedTo === event.status;

  if (phase !== 'paused' && !changed) return null;

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

  return (
    <View style={styles.paused} testID="events.pausedRow">
      <Notice
        tone="attention"
        mark={PAUSE_BARS}
        body={changed ? t('eventLive.changedElsewhere') : t('eventPause.notice')}
        detail={
          changed
            ? t(NOW_STATE[event.status])
            : state === 'failed'
              ? t('eventPause.resumeFailed')
              : null
        }
        answer={changed ? changedTo : undefined}
      />
      {manages && eventAllows(phase, 'resume') && (
        <PrimaryButton
          label={t('eventPause.resume')}
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
