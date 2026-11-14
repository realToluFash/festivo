import {
  GUEST_INVITATION_HOWS,
  type GuestDetails,
  type GuestInvitationHow,
  canMarkNotInvited,
} from '@soirely/api-client';
import { REPLY_KEY, invitationLine, shownReply } from '@soirely/domain';
import { type Ref, type RefObject, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { AlertLine } from './AlertLine.tsx';
import { RadioMark } from './RadioMark.tsx';
import { MarkSlot } from './ReplyMark.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Pill } from './SettingsParts.tsx';
import { Sheet } from './Sheet.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

/** What the guest's Invitation offers: marking needs guests.manage and a phase that invites (sc-46879). */
export interface InvitationOffer {
  manages: boolean;
  invites: boolean;
}

/** A guest's Invitation (sc-46879): their one line, or Not yet invited with Mark as invited under it; Mark as not invited under a mark made by hand. */
export function InvitationBlock({
  guest,
  timeZone,
  offer,
  markRef,
  unmarkRef,
  onMark,
  onUnmark,
}: {
  guest: GuestDetails;
  timeZone: string;
  offer: InvitationOffer;
  markRef: Ref<ViewInstance>;
  unmarkRef: Ref<ViewInstance>;
  onMark: () => void;
  onUnmark: () => void;
}) {
  const { t } = useTranslation();
  const line = invitationLine(t, guest, timeZone, dateLocale());
  const notYet = shownReply(guest) === 'notYetInvited';
  const rows =
    line != null
      ? [
          {
            key: 'invited',
            inset: 40,
            row: (
              <View>
                <Row title={line} lead={<LineIcon name="mail" />} testID="guest.invited" />
                {offer.manages && canMarkNotInvited(guest) && (
                  <View style={styles.under}>
                    <TextAction
                      ref={unmarkRef}
                      label={t('guestList.markNotInvited')}
                      onPress={onUnmark}
                      testID="guest.unmark"
                    />
                  </View>
                )}
              </View>
            ),
          },
        ]
      : notYet
        ? [
            {
              key: 'notYet',
              inset: 40,
              row: (
                <Row
                  title={t(REPLY_KEY.notYetInvited)}
                  line={t('guestList.copyFirst')}
                  lead={<MarkSlot kind="notyet" />}
                  testID="guest.notYet"
                />
              ),
            },
            ...(offer.manages && offer.invites
              ? [
                  {
                    key: 'mark',
                    inset: 40,
                    row: (
                      <Row
                        ref={markRef}
                        title={t('guestList.markAsInvited')}
                        line={t('guestList.markLine')}
                        lead={<LineIcon name="tick" />}
                        accent
                        weight="medium"
                        onPress={onMark}
                        testID="guest.mark"
                      />
                    ),
                  },
                ]
              : []),
          ]
        : [];

  return (
    <View testID="guest.invitation">
      <View style={styles.head}>
        <Text size={18} weight="bold" accessibilityRole="header" style={styles.headTitle}>
          {t('guestList.invitation')}
        </Text>
      </View>
      {rows.length > 0 && <RowList items={rows} />}
      {!offer.manages && (
        <Text
          size={15}
          weight="medium"
          style={[styles.secondary, styles.lines]}
          testID="guest.readOnly"
        >
          {t('guestList.readOnlyInvited')}
        </Text>
      )}
    </View>
  );
}

export type MarkRefusal = 'notSaved' | 'offline' | null;

/** How did you invite them?, nothing chosen: Mark as invited with none sends nothing and says so, with focus on the first choice. */
export function MarkInvited({
  open,
  sending,
  refusal,
  opener,
  onClose,
  onMark,
}: {
  open: boolean;
  sending: boolean;
  refusal: MarkRefusal;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onMark: (how: GuestInvitationHow) => void;
}) {
  const { t } = useTranslation();
  const [how, setHow] = useState<GuestInvitationHow | null>(null);
  const [checked, setChecked] = useState(false);
  const first = useRef<ViewInstance>(null);
  const wrong = checked && how == null;
  const mark = () => {
    setChecked(true);
    if (how == null) {
      moveScreenReaderFocus(first.current);
      return;
    }
    onMark(how);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      held={sending}
      opener={opener}
      scrimLabel={t('guestList.cancel')}
      testID="guest.markSheet"
    >
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
            {t('guestList.markAsInvited')}
          </Text>
          <TextAction
            label={t('guestList.cancel')}
            onPress={onClose}
            off={sending}
            testID="guest.markSheet.cancel"
          />
        </View>
        {refusal === 'notSaved' && <AlertLine text={t('guestList.markNotSaved')} />}
        {refusal === 'offline' && <AlertLine text={t('guestList.offlineRefused')} />}
        <View accessibilityRole="radiogroup" style={styles.tight}>
          <Text size={15} weight="bold" accessibilityRole="header">
            {t('guestList.howInvited')}
          </Text>
          {GUEST_INVITATION_HOWS.map((one, at) => (
            <Pressable
              key={one}
              ref={at === 0 ? first : undefined}
              onPress={() => setHow(one)}
              style={({ pressed }) => [
                styles.way,
                how === one && styles.lit,
                wrong && styles.wrong,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: how === one }}
              accessibilityLabel={t(`guestList.how.${one}`)}
              testID={`guest.markSheet.${one}`}
            >
              <Text
                size={16}
                weight="semibold"
                accessible={false}
                style={[styles.grow, how === one && styles.accent]}
              >
                {t(`guestList.how.${one}`)}
              </Text>
              <RadioMark on={how === one} />
            </Pressable>
          ))}
          {wrong && <AlertLine text={t('guestList.howInvitedBlank')} />}
        </View>
        <Pill
          label={t('guestList.markAsInvited')}
          busy={sending}
          onPress={mark}
          testID="guest.markSheet.do"
        />
      </View>
    </Sheet>
  );
}

/** The reply a 409 `guest_replied` names, in the words of Not changed. {name} replied {reply} on {date}. */
export function replyKeyOf(reply: unknown): string | null {
  return reply === 'coming' || reply === 'maybe' || reply === 'notComing' ? REPLY_KEY[reply] : null;
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  lines: { lineHeight: 15 * 1.45 },
  pressed: { opacity: tokens.opacityPressed },
  head: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  headTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  under: { paddingLeft: 40, paddingBottom: tokens.spaceSm, alignItems: 'flex-start' },
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 20, paddingBottom: 34 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  tight: { gap: 6 },
  way: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  wrong: { borderWidth: 1.5, borderColor: tokens.colorBroken },
});
