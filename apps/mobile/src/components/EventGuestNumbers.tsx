import { type Headcount, type OrganisationEvent, realtimeTopic } from '@soirely/api-client';
import { type Choice, type Counts, REPLY_KEY, countsOf, roleHolds } from '@soirely/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';
import { markOf } from '../kit/guestRows.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { AlertLine } from './AlertLine.tsx';
import { useReadOut } from './ReadOut.tsx';
import { MarkSlot, ReplyMark } from './ReplyMark.tsx';
import { Row, RowList, Section, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

/** The headcount is read again this often while no live line to the hub is open: a reply shows within 10 seconds. */
const READ_AGAIN_MS = 10_000;

const COUNTED = ['invited', 'coming', 'notComing', 'maybe', 'noReply', 'held'] as const;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; headcount: Headcount };

/** Overview's Guests (sc-3786): the six exclusive counts as rows, each opening the guests it counts, then who is not yet invited. Nothing without guests.read. */
export function EventGuestNumbers({
  event,
  onOpen,
}: {
  event: OrganisationEvent;
  onOpen: (choice: Choice) => void;
}) {
  const reads = roleHolds(event, 'guests.read');

  return reads ? <Numbers eventId={event.id} onOpen={onOpen} /> : null;
}

function Numbers({ eventId, onOpen }: { eventId: string; onOpen: (choice: Choice) => void }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const reading = useRef(0);

  const read = useCallback(() => {
    const mine = ++reading.current;

    api.headcount(eventId).then(
      (headcount) => mine === reading.current && setLoad({ kind: 'loaded', headcount }),
      () =>
        mine === reading.current &&
        setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );
  }, [eventId]);

  useEffect(() => {
    read();
  }, [read]);

  useEffect(
    () =>
      followReadingAgain(
        realtimeTopic('EventHeadcount', eventId),
        () => api.guestsSubscription(eventId),
        read,
        READ_AGAIN_MS,
      ),
    [eventId, read],
  );

  const open = (
    <TextAction
      label={t('guestNumbers.openList')}
      onPress={() => onOpen('all')}
      testID="overview.guests.open"
    />
  );

  if (load.kind === 'failed')
    return (
      <View testID="overview.guests">
        <Section title={t('guestNumbers.title')}>
          <AlertLine text={t('guestNumbers.failed')} />
          <TextAction
            label={t('guestNumbers.retry')}
            onPress={() => {
              setLoad({ kind: 'loading' });
              read();
            }}
            testID="overview.guests.retry"
          />
        </Section>
      </View>
    );

  const counts = load.kind === 'loaded' ? countsOf(load.headcount.counts) : null;

  if (counts != null && counts.invited === 0)
    return (
      <View testID="overview.guests">
        <Section title={t('guestNumbers.title')}>
          <Text size={16} weight="semibold" style={styles.lines}>
            {t('guestNumbers.noneInvited')}
          </Text>
          {open}
        </Section>
      </View>
    );

  return (
    <View testID="overview.guests">
      <Section title={t('guestNumbers.title')} right={open}>
        {counts == null ? (
          <Loading />
        ) : (
          <Text size={14.5} weight="medium" style={[styles.secondary, styles.lines]}>
            {t('guestNumbers.lead', {
              says: t('guestList.comingOf', {
                comingWords: t('guestList.countComing', { count: counts.coming }),
                invitedWords: t('guestList.countInvited', { count: counts.invited }),
              }),
            })}
          </Text>
        )}
        <CountRows counts={counts} onOpen={onOpen} />
        {counts != null && counts.notYetInvited > 0 && (
          <TextAction
            label={t('guestNumbers.notYetInvited', { count: counts.notYetInvited })}
            figures
            wraps
            after="chevron"
            renderMark={() => <ReplyMark kind="notyet" side={16} />}
            onPress={() => onOpen('notYetInvited')}
            accessibilityLabel={t('guestNumbers.notYetInvitedOpens', {
              count: counts.notYetInvited,
            })}
            testID="overview.guests.notYetInvited"
          />
        )}
      </Section>
    </View>
  );
}

function CountRows({
  counts,
  onOpen,
}: {
  counts: Counts | null;
  onOpen: (choice: Choice) => void;
}) {
  const { t } = useTranslation();
  const word = (key: (typeof COUNTED)[number]) =>
    t(key === 'invited' ? 'guestList.invited' : REPLY_KEY[key]);

  return (
    <RowList
      items={COUNTED.map((key) => ({
        key,
        inset: 40,
        row: (
          <Row
            title={word(key)}
            line={key === 'held' ? t('guestNumbers.heldLine') : undefined}
            lead={key === 'invited' ? <LineIcon name="users" /> : <MarkSlot kind={markOf(key)} />}
            value={counts == null ? undefined : t('guestList.figure', { count: counts[key] })}
            trail={counts == null ? <View style={styles.bar} /> : undefined}
            opens
            pad={4}
            onPress={() => onOpen(key)}
            accessibilityLabel={
              counts == null
                ? word(key)
                : key === 'invited'
                  ? t('guestNumbers.invitedOpens', { count: counts.invited })
                  : t('guestNumbers.opens', {
                      figure: t('guestList.figure', { count: counts[key] }),
                      word: word(key),
                    })
            }
            testID={`overview.guests.${key}`}
          />
        ),
      }))}
    />
  );
}

function Loading() {
  const { t } = useTranslation();
  useReadOut(t('guestNumbers.loading'));

  return null;
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 14.5 * 1.45 },
  bar: { width: 34, height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
});
