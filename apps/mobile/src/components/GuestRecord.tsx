import {
  ApiError,
  ApiUnreachableError,
  GUEST_ANSWERS,
  GUEST_REPLY_HOWS,
  type GuestAnswer,
  type GuestReplyHow,
  type TaggedGuest,
  repliedThemselves,
} from '@soirely/api-client';
import { REPLY_KEY, companionShown, replyDate } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { markOf } from '../kit/guestRows.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { Glyph } from './Glyph.tsx';
import { RadioMark } from './RadioMark.tsx';
import { ReplyMark } from './ReplyMark.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Pill } from './SettingsParts.tsx';
import { FocusedScreen } from './SummaryOverlays.tsx';
import { Text } from './Text.tsx';

type Refusal = 'offline' | 'notSaved' | null;

/** Record a reply (sc-3787): nothing chosen when it opens, both answers needed before Save, the guest's own reply replaced only once asked. */
export function GuestRecord({
  open,
  tagged,
  eventId,
  timeZone,
  opener,
  onClose,
  onGone,
  onSaved,
}: {
  open: boolean;
  tagged: TaggedGuest;
  eventId: string;
  timeZone: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onGone: () => void;
  onSaved: (tagged: TaggedGuest) => void;
}) {
  const { t } = useTranslation();
  const [guest, setGuest] = useState(tagged.guest);
  const [answer, setAnswer] = useState<GuestAnswer | null>(null);
  const [how, setHow] = useState<GuestReplyHow | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(tagged.guest.companions.map((one) => one.id)),
  );
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState(false);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [sending, setSending] = useState(false);
  const firstAnswer = useRef<ViewInstance>(null);
  const firstHow = useRef<ViewInstance>(null);
  const replace = useRef<ViewInstance>(null);
  const names = guest.companions.map((one) => one.fullName);
  const noAnswer = tried && answer == null;
  const noHow = tried && how == null;

  const focus = (ref: RefObject<ViewInstance | null>) =>
    setTimeout(() => moveScreenReaderFocus(ref.current), 300);

  async function send(chosen: GuestAnswer, told: GuestReplyHow, confirmed: boolean) {
    setRefusal(null);
    setSending(true);
    try {
      onSaved(
        await api.recordGuestReply(eventId, guest.id, {
          answer: chosen,
          how: told,
          companions:
            chosen === 'coming'
              ? guest.companions.map((one) => ({ id: one.id, coming: ticked.has(one.id) }))
              : [],
          replace: confirmed,
        }),
      );
    } catch (error) {
      if (error instanceof ApiUnreachableError) setRefusal('offline');
      else if (error instanceof ApiError && error.status === 404) onGone();
      else if (error instanceof ApiError && error.is('reply_is_theirs')) {
        try {
          setGuest((await api.guest(eventId, guest.id)).guest);
          setAsking(true);
          focus(replace);
        } catch {
          setRefusal('notSaved');
        }
      } else setRefusal('notSaved');
    } finally {
      setSending(false);
    }
  }

  function save() {
    setTried(true);
    if (answer == null || how == null) {
      focus(answer == null ? firstAnswer : firstHow);
      return;
    }
    if (repliedThemselves(guest)) {
      setAsking(true);
      focus(replace);
      return;
    }
    void send(answer, how, false);
  }

  return (
    <FocusedScreen
      open={open}
      title={t('guestList.recordReply')}
      verb={{
        label: t('guestList.save'),
        on: !asking && !sending,
        onPress: save,
        testID: 'guest.record.save',
      }}
      waits={sending}
      onCancel={onClose}
      cancelTestID="guest.record.cancel"
      opener={opener}
      gap={18}
      testID="guest.record"
    >
      {asking && guest.repliedAt != null && (
        <View
          ref={replace}
          style={styles.amber}
          accessibilityRole="alert"
          testID="guest.record.replace"
        >
          <View style={styles.amberHead}>
            <View style={styles.amberMark}>
              <Glyph name="alert" size={17} ink={tokens.colorAttentionText} weight={2.2} />
            </View>
            <Text
              size={15.5}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, styles.amberTitle]}
            >
              {t('guestList.replaceAsk', {
                name: guest.fullName,
                reply: t(REPLY_KEY[guest.reply]),
                date: replyDate(guest.repliedAt, timeZone, dateLocale()),
              })}
            </Text>
          </View>
          <Text size={14} weight="medium" style={[styles.secondary, styles.amberLines]}>
            {t('guestList.replaceAskLine')}
          </Text>
          <View style={styles.choices}>
            <Pill
              label={t('guestList.replaceTheirs')}
              height={tokens.sizeHit}
              full={false}
              busy={sending}
              onPress={() => {
                setAsking(false);
                if (answer != null && how != null) void send(answer, how, true);
              }}
              testID="guest.record.replaceYes"
            />
            <Pill
              label={t('guestList.keepTheirs')}
              kind="secondary"
              height={tokens.sizeHit}
              full={false}
              onPress={onClose}
              testID="guest.record.keep"
            />
          </View>
        </View>
      )}
      {refusal === 'offline' && (
        <View style={styles.tight} testID="guest.record.offline">
          <AlertLine text={t('guestList.offlineRefused')} />
          <Text size={15} weight="medium" style={styles.secondary}>
            {t('guestList.offlineRefusedLine')}
          </Text>
        </View>
      )}
      {refusal === 'notSaved' && <AlertLine text={t('guestList.notSaved')} />}
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('guestList.recordFor', { name: guest.fullName })}
      </Text>
      <View style={styles.tight} accessibilityRole="radiogroup">
        <Legend text={t('guestList.theirReply')} />
        {GUEST_ANSWERS.map((one, at) => (
          <Pressable
            key={one}
            ref={at === 0 ? firstAnswer : undefined}
            onPress={() => setAnswer(one)}
            style={({ pressed }) => [
              styles.answer,
              answer === one && styles.lit,
              noAnswer && styles.wrong,
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: answer === one }}
            accessibilityLabel={t(REPLY_KEY[one])}
            accessibilityHint={noAnswer && at === 0 ? t('guestList.chooseReply') : undefined}
            aria-invalid={noAnswer}
            testID={`guest.record.${one}`}
          >
            <View style={styles.answerMark}>
              <ReplyMark kind={markOf(one)} side={28} />
            </View>
            <Text
              size={17}
              weight="semibold"
              accessible={false}
              style={[styles.grow, answer === one && styles.accent]}
            >
              {t(REPLY_KEY[one])}
            </Text>
            <RadioMark on={answer === one} />
          </Pressable>
        ))}
        {noAnswer && <AlertLine text={t('guestList.chooseReply')} />}
      </View>
      <View style={styles.tight} accessibilityRole="radiogroup">
        <Legend text={t('guestList.howTold')} />
        <View style={styles.chips}>
          {GUEST_REPLY_HOWS.map((one, at) => (
            <Pressable
              key={one}
              ref={at === 0 ? firstHow : undefined}
              onPress={() => setHow(one)}
              style={({ pressed }) => [
                styles.chip,
                how === one && styles.chipOn,
                noHow && styles.wrong,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: how === one }}
              accessibilityLabel={t(`guestList.toldHow.${one}`)}
              accessibilityHint={noHow && at === 0 ? t('guestList.chooseHow') : undefined}
              aria-invalid={noHow}
              testID={`guest.record.how.${one}`}
            >
              {how === one && (
                <Glyph name="tick" size={15} ink={tokens.colorAccentText} weight={2.8} />
              )}
              <Text
                size={15}
                weight="semibold"
                accessible={false}
                style={how === one ? styles.accent : undefined}
              >
                {t(`guestList.toldHow.${one}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        {noHow && <AlertLine text={t('guestList.chooseHow')} />}
      </View>
      {answer === 'coming' && guest.companions.length > 0 && (
        <View style={styles.tight}>
          <Legend text={t('guestList.whoComing')} />
          <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
            {t('guestList.recordPlaces', {
              count: guest.companions.length,
              coming: ticked.size,
            })}
          </Text>
          {guest.companions.map((one, at) => {
            const label = companionShown(t, guest.fullName, names, at);
            const on = ticked.has(one.id);

            return (
              <Pressable
                key={one.id}
                onPress={() =>
                  setTicked((was) => {
                    const next = new Set(was);
                    if (on) next.delete(one.id);
                    else next.add(one.id);
                    return next;
                  })
                }
                style={({ pressed }) => [styles.check, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={label}
                testID={`guest.record.companion.${at}`}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on && <Glyph name="tick" size={15} ink={tokens.colorInkOnDark} weight={3} />}
                </View>
                <Text size={16} weight="semibold" accessible={false} style={styles.grow}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {!asking && (
        <Text size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
          {t('guestList.recordFoot', { name: guest.fullName })}
        </Text>
      )}
    </FocusedScreen>
  );
}

function Legend({ text }: { text: string }) {
  return (
    <Text size={15} weight="bold" accessibilityRole="header">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  small: { lineHeight: 13.5 * 1.45 },
  tight: { gap: 6 },
  amber: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  amberHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  amberMark: { paddingTop: 2 },
  amberTitle: { lineHeight: 15.5 * 1.35 },
  amberLines: { lineHeight: 14 * 1.45 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  answer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
  answerMark: { width: 40, alignItems: 'center' },
  lit: { backgroundColor: tokens.colorAccentTint },
  wrong: { borderWidth: 1.5, borderColor: tokens.colorBroken },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
  },
  chipOn: { borderColor: tokens.colorAccentTint, backgroundColor: tokens.colorAccentTint },
  check: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
});
