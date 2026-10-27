import { type OrganisationEvent } from '@soirely/api-client';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type MakeLiveRefusal, CHANGED_WORDS, draftRowOf, refusalOf } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton } from './Buttons.tsx';
import { LifecycleSheet, useLifecycleAction } from './LifecycleSheet.tsx';
import { readOut } from './ReadOut.tsx';
import { GlyphMark } from './StatusMark.tsx';
import { Text } from './Text.tsx';

/** `EventView-*` (tweak: Draft) and `Lifecycle-*` (sc-3584): the Draft's row, and Make live's confirmation. */
export function DraftRow({
  kind,
  event,
  manages,
  now,
  onChange,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  manages: boolean;
  now: Date;
  onChange: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const makeLive = useRef<View>(null);
  const { asking, ask, go, close } = useLifecycleAction<object, MakeLiveRefusal>({
    event,
    onChange,
    onDone: () => readOut(t('eventLive.madeLive')),
    refusalOf,
    reloads: (refusal) => refusal.kind === 'changed' || refusal.kind === 'concluded',
  });
  const row = draftRowOf(event, now, manages);

  // A refusal reloads the event, which may then be no Draft: its sheet stays to say so.
  if (row == null && asking == null) return null;

  const [title, lines] =
    asking == null || asking.kind === 'confirm'
      ? [
          t('eventLive.confirmTitle', { name: event.name }),
          [
            t('eventLive.confirmGuests'),
            t('eventLive.confirmFinal'),
            ...(asking?.failed === true ? [t('eventLive.failed')] : []),
          ],
        ]
      : asking.kind === 'changed'
        ? [t(CHANGED_WORDS[event.phase][0]), [t(CHANGED_WORDS[event.phase][1])]]
        : asking.kind === 'concluded'
          ? [t('eventLive.notMadeLive'), [t('eventLive.endPassed')]]
          : asking.kind === 'needsHost'
            ? [t('eventLive.needsHostTitle'), [t('eventLive.needsHostBody')]]
            : [
                t('eventLive.planLimit', { plan: asking.plan, count: asking.limit }),
                [t('eventLive.planLimitStays')],
              ];

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
          onPress={() => ask({})}
          testID="events.makeLive"
        />
      )}
      <LifecycleSheet
        phone={kind === 'phone'}
        open={asking != null}
        opener={makeLive}
        testID="events.makeLive"
        title={title}
        lines={lines}
        confirm={
          asking?.kind === 'confirm'
            ? {
                label: t('eventLive.makeLive'),
                keep: t('eventLive.notYet'),
                pending: asking.pending,
                onGo: () => go({}, () => api.makeLive(event.id)),
              }
            : null
        }
        onClose={close}
      />
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
});
