import { type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import {
  changedWords,
  makeLiveHostError,
  makeLiveWithHost,
  needsHost,
  rereadOf,
} from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type EditAt } from '../kit/eventNav.ts';
import {
  type LiveAsking,
  type LiveQuestion,
  changedSinceOpening,
  draftRowOf,
  liveAlertOf,
  refusalOf,
  toldOf,
} from '../kit/makeLive.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton } from './Buttons.tsx';
import { MakeLiveAlert } from './MakeLiveAlert.tsx';
import { readOut } from './ReadOut.tsx';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';
import { GlyphMark } from './StatusMark.tsx';
import { Text } from './Text.tsx';

/** `EventView-*` (tweak: Draft) and `Lifecycle-*` (sc-3584): the Draft's row, and Make live's confirmation. */
export function DraftRow({
  event,
  manages,
  now,
  onChange,
  onEdit,
}: {
  event: OrganisationEvent;
  manages: boolean;
  now: Date;
  onChange: (event: OrganisationEvent) => void;
  onEdit?: ((at?: EditAt) => void) | undefined;
}) {
  const { t } = useTranslation();
  const opener = useRef<ViewInstance>(null);
  const makeLive = useMakeLive({ event, onChange, onEdit, opener });
  const row = draftRowOf(event, now, manages);

  // A refusal reloads the event, which may then be no Draft: its alert stays to say so.
  if (row == null && !makeLive.open) return null;

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
          ref={opener}
          label={t('eventLive.makeLive')}
          onPress={makeLive.start}
          testID="events.makeLive"
        />
      )}
      {makeLive.sheet}
    </View>
  );
}

/** Make live's alert, from the Draft's row or the event's card; with no host it asks for one in Host 1 (sc-22143). */
export function useMakeLive({
  event,
  onChange,
  onEdit,
  onLive,
  opener,
}: {
  event: OrganisationEvent;
  onChange: (event: OrganisationEvent) => void;
  onEdit?: ((at?: EditAt) => void) | undefined;
  /** Says ✓ Live where the page shows its toasts; without it, it is only read out. */
  onLive?: ((words: string) => void) | undefined;
  opener: RefObject<ScreenReaderTarget | null>;
}) {
  const { t } = useTranslation();
  const host = useRef<TextInputInstance>(null);
  const read = useRef<Promise<TaggedEvent> | null>(null);
  const [asking, setAsking] = useState<LiveAsking | null>(null);
  const pending = asking?.kind === 'confirm' && asking.pending;

  function close(): void {
    if (!pending) setAsking(null);
  }

  /** The version the save sends: read as the alert opens, since the page may have come from the list. */
  function opened(): Promise<TaggedEvent> {
    read.current ??= api.taggedEvent(event.id);

    return read.current;
  }

  function changed(latest: TaggedEvent): void {
    read.current = Promise.resolve(latest);
    onChange(latest.event);
  }

  function found(latest: TaggedEvent, current: LiveQuestion): void {
    changed(latest);
    const what = rereadOf(latest.event);
    const settled = { ...current, error: null, pending: false };

    if (what === 'noHost') setAsking({ ...settled, askHost: true, notice: 'stillNoHost' });
    else if (what === 'hosted')
      setAsking({ ...settled, askHost: false, typed: '', notice: 'nowHosted' });
    else {
      const [title, line] = changedWords(latest.event);
      setAsking({ kind: 'told', title: t(title), line: t(line), changeDates: false });
    }
  }

  async function go(current: LiveQuestion): Promise<void> {
    const error = current.askHost && needsHost(event) ? makeLiveHostError(current.typed, t) : null;

    if (error != null) {
      setAsking({ ...current, error, failed: false, notice: null });
      host.current?.focus();
      return;
    }

    // Make live again drops what the last answer said.
    setAsking({ ...current, error: null, pending: true, failed: false, notice: null });
    const settled = { ...current, error: null, pending: false, notice: null };
    let base: TaggedEvent;

    try {
      base = current.askHost ? await opened() : { event, tag: '' };
    } catch {
      read.current = null;
      setAsking({ ...settled, failed: true });
      return;
    }

    if (current.askHost && current.notice == null && changedSinceOpening(event, base.event)) {
      found(base, current);
      return;
    }

    const step = await makeLiveWithHost(api, base, current.typed);

    if (step.kind === 'live') {
      setAsking(null);
      changed(step.tagged);
      if (onLive == null) readOut(t('eventLive.madeLive'));
      else onLive(t('eventLive.madeLive'));
      return;
    }

    if (step.kind === 'hostRefused') {
      setAsking({ ...settled, error: step.message });
      host.current?.focus();
      return;
    }

    if (step.kind === 'stale') {
      try {
        found(await api.taggedEvent(event.id), current);
      } catch {
        setAsking({ ...settled, failed: true });
      }
      return;
    }

    if (step.saved != null) changed(step.saved);

    const refusal = refusalOf(step.error);
    const told = toldOf(refusal, t);

    if (refusal.kind === 'concluded')
      await api.taggedEvent(event.id).then(changed, () => undefined);

    setAsking(
      told ?? {
        ...settled,
        ...(step.saved != null && { askHost: false, typed: '' }),
        failed: true,
      },
    );
  }

  const start = () => {
    const askHost = needsHost(event);
    read.current = null;
    if (askHost) void opened().catch(() => undefined);
    setAsking({
      kind: 'confirm',
      askHost,
      typed: '',
      error: null,
      notice: null,
      pending: false,
      failed: false,
    });
  };

  const confirm = () => {
    if (asking?.kind === 'confirm') {
      if (!asking.pending) void go(asking);
    } else if (asking?.kind === 'told' && asking.changeDates && onEdit != null) {
      setAsking(null);
      onEdit('starts');
    }
  };

  const sheet = (
    <MakeLiveAlert
      alert={liveAlertOf(asking, event, t, onEdit != null)}
      typed={asking?.kind === 'confirm' ? asking.typed : ''}
      hostRef={host}
      opener={opener}
      onTyped={(typed) => {
        if (asking?.kind === 'confirm') setAsking({ ...asking, typed, error: null });
      }}
      onKeep={close}
      onConfirm={confirm}
      testID="events.makeLive"
    />
  );

  return { open: asking != null, start, sheet };
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
