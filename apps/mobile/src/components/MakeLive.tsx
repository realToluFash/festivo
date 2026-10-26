import { type OrganisationEvent } from '@soirely/api-client';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type MakeLiveRefusal, STATUS_WORD, draftRowOf, refusalOf } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { readOut } from './ReadOut.tsx';
import { Sheet } from './Sheet.tsx';
import { GlyphMark } from './StatusMark.tsx';
import { Text } from './Text.tsx';

type Asking =
  | { kind: 'confirm'; pending: boolean; failed: boolean }
  | Exclude<MakeLiveRefusal, { kind: 'failed' }>;

/** `EventView-*` (tweak: Draft) and `Lifecycle-*` (sc-3584): the Draft's row, and Make live's confirmation. */
export function DraftRow({
  kind,
  event,
  manages,
  onChange,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  manages: boolean;
  onChange: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [now] = useState(Date.now);
  const makeLive = useRef<View>(null);
  const row = draftRowOf(event, now, manages);

  // A refusal reloads the event, which may then be no Draft: its sheet stays to say so.
  if (row == null && asking == null) return null;

  const reload = (then: Asking) =>
    api.event(event.id).then(
      (latest) => {
        onChange(latest);
        setAsking(then);
      },
      () => setAsking({ kind: 'confirm', pending: false, failed: true }),
    );

  const go = () => {
    setAsking({ kind: 'confirm', pending: true, failed: false });
    api.makeLive(event.id).then(
      ({ event: live }) => {
        setAsking(null);
        onChange(live);
        readOut(t('eventLive.madeLive'));
      },
      (error: unknown) => {
        const refusal = refusalOf(error);

        if (refusal.kind === 'changed' || refusal.kind === 'concluded') void reload(refusal);
        else if (refusal.kind === 'planLimit') setAsking(refusal);
        else setAsking({ kind: 'confirm', pending: false, failed: true });
      },
    );
  };

  const pending = asking?.kind === 'confirm' && asking.pending;
  const close = () => !pending && setAsking(null);

  return (
    <View style={row == null ? null : styles.row} testID="events.draftRow">
      {row != null && <GlyphMark mark={tokens.marks.notStarted} />}
      {row != null && (
        <Text size={tokens.typeBody.size} style={styles.line} testID="events.draftLine">
          {row.line === 'endPassed' ? t('eventLive.endPassed') : t('eventLive.guestsBlocked')}
        </Text>
      )}
      {row?.offersMakeLive === true && (
        <PrimaryButton
          ref={makeLive}
          label={t('eventLive.makeLive')}
          onPress={() => setAsking({ kind: 'confirm', pending: false, failed: false })}
          testID="events.makeLive"
        />
      )}
      <Sheet open={asking != null} onClose={close} opener={makeLive} testID="events.makeLiveSheet">
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

  const [title, lines] =
    asking.kind === 'confirm'
      ? [
          t('eventLive.confirmTitle', { name }),
          [
            t('eventLive.confirmGuests'),
            t('eventLive.confirmFinal'),
            ...(asking.failed ? [t('eventLive.failed')] : []),
          ],
        ]
      : asking.kind === 'changed'
        ? [
            t('eventLive.changedElsewhere'),
            [t('eventLive.nowState', { state: t(STATUS_WORD[status]) })],
          ]
        : asking.kind === 'concluded'
          ? [t('eventLive.notMadeLive'), [t('eventLive.endPassed')]]
          : [
              t('eventLive.planLimit', { plan: asking.plan, count: asking.limit }),
              [t('eventLive.planLimitStays')],
            ];

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
              label={t('eventLive.makeLive')}
              onPress={onGo}
              busy={asking.pending}
              testID="events.makeLiveYes"
            />
            <SecondaryButton
              label={t('eventLive.notYet')}
              onPress={onClose}
              off={asking.pending}
              stacked={phone}
              testID="events.makeLiveNo"
            />
          </>
        ) : (
          <PrimaryButton
            label={t('eventLive.close')}
            onPress={onClose}
            testID="events.makeLiveClose"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  line: { flexGrow: 1, flexShrink: 1, flexBasis: 180 },
  sheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  stacked: { gap: tokens.spaceSm },
});
