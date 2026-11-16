import type { OrganisationEvent } from '@soirely/api-client';
import { THANK_YOU_MOST, hostsLine, thankYouLength, thankYouOver } from '@soirely/domain';
import { type Ref, type RefObject, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { refusalSaid } from '../kit/refusal.ts';
import { thankYouCardOf, thankYouSaid } from '../kit/thankYou.ts';
import { weight } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { FieldError, TextField } from './Field.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { useShellLayout } from './settingsShell.ts';
import { type AskProps, FocusedScreen, Section, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;

/** The field in End now and on its own screen: the count sits in the field's hint and is not read out as you type. */
export function ThankYouField({
  draft,
  tried,
  help,
  optional,
  autoFocus,
  onType,
  onFocus,
  onBlur,
  testID,
}: {
  draft: string;
  tried: boolean;
  help: string;
  optional: boolean;
  autoFocus: boolean;
  onType: (typed: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const title = t('thankYou.title');
  const optionalWord = t('eventForm.optional');
  const count = t('thankYou.count', { count: thankYouLength(draft), max: THANK_YOU_MOST });
  const over = thankYouOver(draft);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.labelled}>
        <View
          style={styles.fieldHead}
          accessible
          accessibilityLabel={optional ? `${title}, ${optionalWord}` : title}
        >
          <Text size={14} weight="semibold" style={styles.label}>
            {title}
          </Text>
          {optional && (
            <Text size={14} weight="medium" style={[styles.secondary, styles.label]}>
              {` · ${optionalWord}`}
            </Text>
          )}
        </View>
        <TextField
          value={draft}
          onChangeText={onType}
          autoFocus={autoFocus}
          multiline
          scrollEnabled
          wrong={tried}
          placeholder={t('thankYou.placeholder')}
          accessibilityLabel={optional ? `${title} · ${optionalWord}` : title}
          accessibilityHint={`${help} ${count}`}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={[styles.noteBox, (focused || tried) && styles.noteBoxLit]}
          testID={testID}
        />
        {tried ? (
          <FieldError message={t('thankYou.tooLong', { max: THANK_YOU_MOST })} />
        ) : (
          <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
            {help}
          </Text>
        )}
      </View>
      <Text
        size={13.5}
        weight={over ? 'bold' : 'medium'}
        accessible={false}
        style={[styles.count, over ? styles.over : styles.secondary]}
        testID={`${testID}.count`}
      >
        {count}
      </Text>
    </View>
  );
}

/** sc-6476: first on a Finished event's Overview. Add, then the line with Edit; read-only without the permission to end it. */
export function ThankYouCard({
  event,
  manages,
  opener,
  onOpen,
}: {
  event: Pick<OrganisationEvent, 'hosts' | 'thankYou'>;
  manages: boolean;
  opener: Ref<ViewInstance>;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const shows = thankYouCardOf(event.thankYou, manages);

  if (shows == null) return null;

  return (
    <Section title={t('thankYou.title')}>
      <View style={styles.body} testID="event.thankYou">
        {event.thankYou == null ? (
          <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
            {t('thankYou.hint')}
          </Text>
        ) : (
          <View style={styles.line}>
            <Text size={16} weight="medium" style={styles.quote} testID="event.thankYou.line">
              {event.thankYou}
            </Text>
            <Text size={14} weight="semibold" style={[styles.secondary, styles.signed]}>
              {t('thankYou.signed', { hosts: hostsLine(event.hosts, dateLocale()) })}
            </Text>
          </View>
        )}
        {shows !== 'readOnly' && (
          <View style={styles.action}>
            <TextAction
              ref={opener}
              label={t(shows === 'add' ? 'thankYou.add' : 'thankYou.edit')}
              {...(shows === 'add' ? { glyph: 'plus' as const } : {})}
              onPress={onOpen}
              testID={shows === 'add' ? 'event.thankYou.add' : 'event.thankYou.edit'}
            />
          </View>
        )}
      </View>
    </Section>
  );
}

/** Add a thank-you and Edit thank-you: the app's own screen for one part, as Details' rows open theirs. */
export function ThankYouScreen({
  event,
  open,
  opener,
  onClose,
  onChange,
  onSaid,
}: {
  event: OrganisationEvent;
  open: boolean;
  opener: Opener;
  onClose: () => void;
  onChange: (event: OrganisationEvent) => void;
  onSaid: (words: string) => void;
}) {
  const { t } = useTranslation();
  const phone = useShellLayout() === 'phone';
  const line = event.thankYou ?? '';
  const [draft, setDraft] = useState(line);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  if (open !== opened) {
    setOpened(open);
    if (open) {
      setDraft(line);
      setTried(false);
      setFailed(null);
      setDiscarding(false);
    }
  }

  const changed = draft !== line;
  const close = () => {
    setDiscarding(false);
    onClose();
  };
  const discard: AskProps | null = discarding
    ? {
        title: t('thankYou.discardTitle'),
        line: t('thankYou.discardLine'),
        keep: { label: t('eventEdit.keepEditing'), testID: 'event.thankYou.keep' },
        confirm: { label: t('thankYou.discard'), testID: 'event.thankYou.discard', removes: true },
        onKeep: () => setDiscarding(false),
        onConfirm: close,
      }
    : null;

  const save = () => {
    if (busy) return;
    if (thankYouOver(draft)) {
      setTried(true);
      setFailed(null);
      return;
    }
    const said = thankYouSaid(event.thankYou, draft);
    setBusy(true);
    setFailed(null);
    api.setThankYou(event.id, draft).then(
      ({ event: saved }) => {
        setBusy(false);
        onChange(saved);
        onClose();
        if (said != null) onSaid(t(said));
      },
      (error: unknown) => {
        setBusy(false);
        setFailed(refusalSaid(error, t('thankYou.notSaved')));
      },
    );
  };

  return (
    <FocusedScreen
      gap={phone ? tokens.spaceXl : tokens.spaceLg}
      open={open}
      title={t(line === '' ? 'thankYou.add' : 'thankYou.edit')}
      verb={{
        label: busy ? t('eventEdit.saving') : t('thankYou.save'),
        on: changed,
        busy,
        onPress: save,
        testID: 'event.thankYou.save',
      }}
      waits={busy}
      onCancel={() => (changed ? setDiscarding(true) : close())}
      cancelTestID="event.thankYou.cancel"
      opener={opener}
      ask={discard}
      testID="event.thankYou.screen"
    >
      <ThankYouField
        draft={draft}
        tried={tried}
        help={t(line === '' ? 'thankYou.hint' : 'thankYou.remove')}
        optional={false}
        autoFocus
        onType={(text) => {
          setDraft(text);
          setTried(tried && thankYouOver(text));
        }}
        testID="event.thankYou.field"
      />
      {failed != null && <AlertLine text={failed} />}
    </FocusedScreen>
  );
}

const NOTE_LINE = 24;

const styles = StyleSheet.create({
  body: { gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 15 * 1.45 },
  line: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  quote: { lineHeight: 16 * 1.5, writingDirection: 'auto' },
  signed: { lineHeight: 14 * 1.4 },
  action: { alignItems: 'flex-start' },
  field: { gap: tokens.spaceXxs },
  labelled: { gap: 7 },
  fieldHead: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { lineHeight: 14 * 1.3 },
  hint: { lineHeight: 13.5 * 1.4 },
  noteBox: {
    minHeight: NOTE_LINE * 4 + tokens.spaceSm * 2,
    maxHeight: NOTE_LINE * 10 + tokens.spaceSm * 2,
    paddingLeft: 14.5,
    paddingRight: 10.5,
    borderWidth: 1.5,
    borderRadius: tokens.radiusInset,
    lineHeight: NOTE_LINE,
    textAlignVertical: 'top',
    writingDirection: 'auto',
    ...weight('medium'),
  },
  noteBoxLit: { paddingLeft: tokens.spacePillEnd, paddingRight: tokens.spaceMd, borderWidth: 2 },
  count: { alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
  over: { color: tokens.colorBrokenText },
});
