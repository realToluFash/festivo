import { type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, changedWords, endLabel } from '@soirely/domain';
import { useRef } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type EndRefusal, endRefusalOf } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { LifecycleSheet, useLifecycleAction } from './LifecycleSheet.tsx';

type Label = 'callOff' | 'endNow';

/** `Lifecycle-*` (tweak: Call off, End now; sc-3585): one action, named Call off before the start and End now from it. */
export function EndRow({
  kind,
  event,
  phase,
  manages,
  now,
  onChange,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  phase: EventPhase;
  manages: boolean;
  now: Date;
  onChange: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const opener = useRef<ViewInstance>(null);
  const { asking, ask, go, close } = useLifecycleAction<{ label: Label }, EndRefusal>({
    event,
    onChange,
    refusalOf: endRefusalOf,
  });
  const label = manages ? endLabel(event, phase, now) : null;

  // A refusal reloads the event, which may then offer no End now: its sheet stays to say so.
  if (label == null && asking == null) return null;

  const callOff = asking?.kind === 'confirm' && asking.label === 'callOff';

  return (
    <View style={styles.row} testID="events.endRow">
      {label != null && (
        <SecondaryButton
          ref={opener}
          label={t(`eventEnd.${label}`)}
          onPress={() => ask({ label })}
          testID="events.end"
        />
      )}
      <LifecycleSheet
        phone={kind === 'phone'}
        open={asking != null}
        opener={opener}
        testID="events.end"
        title={
          asking == null || asking.kind === 'confirm'
            ? t(callOff ? 'eventEnd.callOffTitle' : 'eventEnd.endTitle', { name: event.name })
            : t('eventEnd.notEnded')
        }
        lines={
          asking == null || asking.kind === 'confirm'
            ? [
                t(callOff ? 'eventEnd.callOffBody' : 'eventEnd.endBody'),
                t('eventEnd.final'),
                ...(asking?.failed === true ? [t('eventEnd.failed')] : []),
              ]
            : asking.kind === 'changed'
              ? changedWords(event).map((line) => t(line))
              : [t('eventEnd.alreadyOver')]
        }
        confirm={
          asking?.kind === 'confirm'
            ? {
                label: t(callOff ? 'eventEnd.callOff' : 'eventEnd.endNow'),
                keep: t('eventEnd.keepItOn'),
                pending: asking.pending,
                onGo: () => go({ label: asking.label }, () => api.endEvent(event.id)),
              }
            : null
        }
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
});
