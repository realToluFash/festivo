import { type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, endLabel } from '@soirely/domain';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type EndRefusal, NOW_STATE, endRefusalOf } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';

type Asking =
  | { kind: 'confirm'; label: 'callOff' | 'endNow'; pending: boolean; failed: boolean }
  | Exclude<EndRefusal, { kind: 'failed' }>;

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
  const [asking, setAsking] = useState<Asking | null>(null);
  const opener = useRef<View>(null);
  const label = manages ? endLabel(event, phase, now) : null;

  // A refusal reloads the event, which may then offer no End now: its sheet stays to say so.
  if (label == null && asking == null) return null;

  const confirming = (failed: boolean, pending = false): Asking => ({
    kind: 'confirm',
    label: asking?.kind === 'confirm' ? asking.label : (label ?? 'endNow'),
    pending,
    failed,
  });

  const go = () => {
    setAsking(confirming(false, true));
    api.endEvent(event.id).then(
      ({ event: ended }) => {
        setAsking(null);
        onChange(ended);
      },
      (error: unknown) => {
        const refusal = endRefusalOf(error);

        if (refusal.kind === 'failed') {
          setAsking(confirming(true));
          return;
        }

        api.event(event.id).then(
          (latest) => {
            onChange(latest);
            setAsking(refusal);
          },
          () => setAsking(confirming(true)),
        );
      },
    );
  };

  const pending = asking?.kind === 'confirm' && asking.pending;
  const close = () => !pending && setAsking(null);

  return (
    <View style={styles.row} testID="events.endRow">
      {label != null && (
        <SecondaryButton
          ref={opener}
          label={t(`eventEnd.${label}`)}
          onPress={() => setAsking({ kind: 'confirm', label, pending: false, failed: false })}
          testID="events.end"
        />
      )}
      <Sheet open={asking != null} onClose={close} opener={opener} testID="events.endSheet">
        {asking != null && (
          <Asked
            phone={kind === 'phone'}
            name={event.name}
            status={event.status}
            asking={asking}
            onGo={go}
            onClose={close}
          />
        )}
      </Sheet>
    </View>
  );
}

function Asked({
  phone,
  name,
  status,
  asking,
  onGo,
  onClose,
}: {
  phone: boolean;
  name: string;
  status: OrganisationEvent['status'];
  asking: Asking;
  onGo: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const callOff = asking.kind === 'confirm' && asking.label === 'callOff';

  const [title, lines] =
    asking.kind === 'confirm'
      ? [
          callOff ? t('eventEnd.callOffTitle', { name }) : t('eventEnd.endTitle', { name }),
          [
            callOff ? t('eventEnd.callOffBody') : t('eventEnd.endBody'),
            t('eventEnd.final'),
            ...(asking.failed ? [t('eventEnd.failed')] : []),
          ],
        ]
      : asking.kind === 'changed'
        ? [t('eventEnd.notEnded'), [t('eventLive.changedElsewhere'), t(NOW_STATE[status])]]
        : [t('eventEnd.notEnded'), [t('eventEnd.alreadyOver')]];

  return (
    <View style={styles.sheet}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      {lines.map((line) => (
        <Text key={line} size={tokens.typeBodyPhone.size} muted>
          {line}
        </Text>
      ))}
      <View style={phone ? styles.stacked : styles.actions}>
        {asking.kind === 'confirm' ? (
          <>
            <PrimaryButton
              label={callOff ? t('eventEnd.callOff') : t('eventEnd.endNow')}
              onPress={onGo}
              busy={asking.pending}
              testID="events.endYes"
            />
            <SecondaryButton
              label={t('eventEnd.keepItOn')}
              onPress={onClose}
              off={asking.pending}
              stacked={phone}
              testID="events.endNo"
            />
          </>
        ) : (
          <PrimaryButton label={t('eventEnd.close')} onPress={onClose} testID="events.endClose" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  sheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  stacked: { gap: tokens.spaceSm },
});
