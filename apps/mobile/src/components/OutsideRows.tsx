import type { Membership, OutsideEvent } from '@soirely/api-client';
import {
  isUnderWay,
  outsideEventLine,
  outsideEventsInOrder,
  outsideRowLabel,
  roleName,
} from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { dateLocale } from '../i18n/index.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { meshFor } from '../kit/today.ts';
import { tokens } from '../theme/tokens.ts';
import { EventThumb } from './EventThumb.tsx';
import { Glyph } from './Glyph.tsx';
import { OrgMark } from './OrgMark.tsx';
import { Row, RowList, SectionHead } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

function Marks({ underWay, here }: { underWay: boolean; here: boolean }) {
  const { t } = useTranslation();
  if (!underWay && !here) return null;

  return (
    <View style={styles.marks}>
      {underWay && (
        <View style={styles.pill} {...hidden} testID="outside.underWay">
          <View style={styles.dot} />
          <Text size={12.5} weight="semibold" style={styles.ink} accessible={false}>
            {t('outsideEvent.underWay')}
          </Text>
        </View>
      )}
      {here && (
        <View style={styles.here} {...hidden} testID="outside.here">
          <Glyph name="tick" size={14} ink={tokens.colorAccentText} weight={2.8} />
          <Text size={12.5} weight="semibold" style={styles.ink} accessible={false}>
            {t('outsideEvent.here')}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Events held from outside under a heading (sc-68438): each its thumb, name, "{organisation} · {date} · {start}" and marks, under way first. */
export function OutsideEventsGroup({
  title,
  events,
  here,
  idPrefix,
  onEvent,
}: {
  title: string;
  events: readonly OutsideEvent[];
  here: string | null;
  idPrefix: string;
  onEvent: (event: OutsideEvent) => void;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const locale = dateLocale();

  return (
    <View testID={idPrefix}>
      <SectionHead title={title} />
      <RowList
        items={outsideEventsInOrder(events, now).map((event) => {
          const marks = { underWay: isUnderWay(event, now), here: event.id === here };

          return {
            key: event.id,
            inset: 40 + tokens.spaceLg,
            row: (
              <Row
                title={event.name}
                line={outsideEventLine(event, locale)}
                below={<Marks {...marks} />}
                lead={
                  <EventThumb
                    event={{ id: event.id, mesh: meshFor(event.id), photo: null }}
                    side={40}
                    radius={12}
                  />
                }
                onPress={() => onEvent(event)}
                accessibilityLabel={outsideRowLabel(event, locale, {
                  underWay: marks.underWay ? t('outsideEvent.underWay') : null,
                  here: marks.here ? t('outsideEvent.here') : null,
                })}
                testID={`${idPrefix}.${event.id}`}
              />
            ),
          };
        })}
      />
    </View>
  );
}

/** A member's organisations, inside another's event: each its tile, name and the member's role, opening its Today. */
export function YourOrganisationsGroup({
  organisations,
  idPrefix,
  onOrganisation,
}: {
  organisations: readonly Membership[];
  idPrefix: string;
  onOrganisation: (organisation: Membership) => void;
}) {
  const { t } = useTranslation();

  return (
    <View testID={idPrefix}>
      <SectionHead title={t('outsideEvent.yourOrganisations')} />
      <RowList
        items={organisations.map((organisation) => {
          const role = roleName(t, organisation.role);

          return {
            key: organisation.id,
            inset: 40 + tokens.spaceLg,
            row: (
              <Row
                title={organisation.name}
                line={role}
                lead={<OrgMark id={organisation.id} name={organisation.name} side={40} />}
                onPress={() => onOrganisation(organisation)}
                accessibilityLabel={`${organisation.name}. ${role}`}
                testID={`${idPrefix}.${organisation.id}`}
              />
            ),
          };
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  marks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
    marginTop: tokens.spaceXs,
  },
  pill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 9,
    borderRadius: 12,
    backgroundColor: tokens.colorAccentTint,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  here: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ink: { color: tokens.colorAccentText },
});
