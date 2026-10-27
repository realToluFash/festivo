import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, eventAllows } from '@soirely/domain';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { NOW_STATE } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';

type Asking = { kind: 'confirm'; pending: boolean; failed: boolean } | { kind: 'changed' };

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
  const [asking, setAsking] = useState<Asking | null>(null);
  const opener = useRef<View>(null);
  const offered = manages && eventAllows(phase, 'pause');

  // A refusal reloads the event, which may then offer no Pause: its sheet stays to say so.
  if (!offered && asking == null) return null;

  const go = () => {
    setAsking({ kind: 'confirm', pending: true, failed: false });
    api.pauseEvent(event.id).then(
      ({ event: paused }) => {
        setAsking(null);
        onChange(paused);
      },
      (error: unknown) => {
        if (!(error instanceof ApiError && error.is('event_state_invalid'))) {
          setAsking({ kind: 'confirm', pending: false, failed: true });
          return;
        }

        api.event(event.id).then(
          (latest) => {
            onChange(latest);
            setAsking({ kind: 'changed' });
          },
          () => setAsking({ kind: 'confirm', pending: false, failed: true }),
        );
      },
    );
  };

  const pending = asking?.kind === 'confirm' && asking.pending;
  const close = () => !pending && setAsking(null);
  const phone = kind === 'phone';

  return (
    <>
      {offered && (
        <SecondaryButton
          ref={opener}
          label={t('eventPause.pause')}
          onPress={() => setAsking({ kind: 'confirm', pending: false, failed: false })}
          testID="events.pause"
        />
      )}
      <Sheet open={asking != null} onClose={close} opener={opener} testID="events.pauseSheet">
        {asking != null && (
          <View style={styles.sheet}>
            <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
              {asking.kind === 'confirm'
                ? t('eventPause.title', { name: event.name })
                : t('eventPause.notPaused')}
            </Text>
            {(asking.kind === 'confirm'
              ? [
                  t('eventPause.body'),
                  t('eventPause.nothingLost'),
                  ...(asking.failed ? [t('eventPause.failed')] : []),
                ]
              : [t('eventLive.changedElsewhere'), t(NOW_STATE[event.status])]
            ).map((line) => (
              <Text key={line} size={tokens.typeBodyPhone.size} muted>
                {line}
              </Text>
            ))}
            <View style={phone ? styles.stacked : styles.actions}>
              {asking.kind === 'confirm' ? (
                <>
                  <PrimaryButton
                    label={t('eventPause.pause')}
                    onPress={go}
                    busy={asking.pending}
                    testID="events.pauseYes"
                  />
                  <SecondaryButton
                    label={t('eventPause.keepItLive')}
                    onPress={close}
                    off={asking.pending}
                    stacked={phone}
                    testID="events.pauseNo"
                  />
                </>
              ) : (
                <PrimaryButton
                  label={t('eventEnd.close')}
                  onPress={close}
                  testID="events.pauseClose"
                />
              )}
            </View>
          </View>
        )}
      </Sheet>
    </>
  );
}

/** `Event View` (tweak: Paused): the amber line, and Resume, which asks nothing; past the end the phase is Finished and neither shows. */
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

  if (phase !== 'paused') return null;

  const resume = () => {
    setState('pending');
    api.resumeEvent(event.id).then(
      ({ event: resumed }) => {
        setState('idle');
        onChange(resumed);
      },
      (error: unknown) => {
        if (!(error instanceof ApiError && error.is('event_state_invalid'))) {
          setState('failed');
          return;
        }

        api.event(event.id).then(
          (latest) => {
            setState('idle');
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
        body={t('eventPause.notice')}
        detail={state === 'failed' ? t('eventPause.resumeFailed') : null}
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
  sheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  stacked: { gap: tokens.spaceSm },
});
