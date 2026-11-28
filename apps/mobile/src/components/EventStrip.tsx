import type { OrganisationEvent } from '@soirely/api-client';
import type { EventPhase } from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { dateLocale } from '../i18n/index.ts';
import { listEventOf, rowLine, shownEvent } from '../kit/eventsList.ts';
import { tokens } from '../theme/tokens.ts';
import { EventThumb } from './EventThumb.tsx';
import { Text } from './Text.tsx';

/** An area's top under its title, as the demo's AreaPage draws it (sc-30303): the event's picture, its name and its dates, with no card and no publish row. */
export function EventStrip({
  event,
  phase,
  now,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  now: Date;
}) {
  const { t } = useTranslation();
  const shown = shownEvent(listEventOf({ ...event, milestones: null }), phase);

  return (
    <View style={styles.strip} testID="events.strip">
      <EventThumb event={shown} side={40} radius={12} />
      <View style={styles.words}>
        <Text size={16} weight="semibold" style={styles.name}>
          {event.name}
        </Text>
        <Text size={14} weight="medium" style={[styles.secondary, styles.line]}>
          {rowLine(shown, now, dateLocale(), t, false)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceXxs,
  },
  words: { flex: 1, minWidth: 0, gap: 3 },
  name: { lineHeight: 16 * 1.3 },
  line: { lineHeight: 14 * 1.4 },
  secondary: { color: tokens.colorInkSecondary },
});
