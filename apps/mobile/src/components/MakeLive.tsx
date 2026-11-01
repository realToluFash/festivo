import { type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import {
  changedWords,
  makeLiveHostError,
  makeLiveWithHost,
  needsHost,
  rereadOf,
} from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { changedSinceOpening, draftRowOf, refusalOf } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton } from './Buttons.tsx';
import { Field, TextField } from './Field.tsx';
import { LifecycleSheet } from './LifecycleSheet.tsx';
import { Notice } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { GlyphMark } from './StatusMark.tsx';
import { Text, type TextHandle } from './Text.tsx';

/** `askHost` while the draft had no host when it opened; `notice` is what a reread found (sc-22143). */
interface Confirming {
  kind: 'confirm';
  askHost: boolean;
  typed: string;
  error: string | null;
  notice: 'stillNoHost' | 'nowHosted' | null;
  pending: boolean;
  failed: boolean;
}

interface Told {
  kind: 'told';
  title: string;
  lines: string[];
}

/** `EventView-*` (tweak: Draft) and `Lifecycle-*` (sc-3584): the Draft's row, and Make live's confirmation; with no host it asks for one in Host 1 (sc-22143). */
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
  const makeLive = useRef<ViewInstance>(null);
  const host = useRef<TextInputInstance>(null);
  const hostsNow = useRef<TextHandle>(null);
  const read = useRef<Promise<TaggedEvent> | null>(null);
  const [asking, setAsking] = useState<Confirming | Told | null>(null);
  const row = draftRowOf(event, now, manages);
  const notice = asking?.kind === 'confirm' ? asking.notice : null;

  useEffect(() => {
    if (notice === 'nowHosted') moveScreenReaderFocus(hostsNow.current);
  }, [notice]);

  // A refusal reloads the event, which may then be no Draft: its sheet stays to say so.
  if (row == null && asking == null) return null;

  const pending = asking?.kind === 'confirm' && asking.pending;

  function close(): void {
    if (!pending) setAsking(null);
  }

  /** The version the save sends: read as the sheet opens, since the page may have come from the list. */
  function opened(): Promise<TaggedEvent> {
    read.current ??= api.taggedEvent(event.id);

    return read.current;
  }

  function changed(latest: TaggedEvent): void {
    read.current = Promise.resolve(latest);
    onChange(latest.event);
  }

  function found(latest: TaggedEvent, current: Confirming): void {
    changed(latest);
    const what = rereadOf(latest.event);
    const settled = { ...current, error: null, pending: false };

    if (what === 'noHost') setAsking({ ...settled, askHost: true, notice: 'stillNoHost' });
    else if (what === 'hosted')
      setAsking({ ...settled, askHost: false, typed: '', notice: 'nowHosted' });
    else {
      const [title, line] = changedWords(latest.event);
      setAsking({ kind: 'told', title: t(title), lines: [t(line)] });
    }
  }

  async function go(current: Confirming): Promise<void> {
    const error = current.askHost && needsHost(event) ? makeLiveHostError(current.typed, t) : null;

    if (error != null) {
      setAsking({ ...current, error, failed: false });
      host.current?.focus();
      return;
    }

    setAsking({ ...current, error: null, pending: true, failed: false });
    const settled = { ...current, error: null, pending: false };
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
      readOut(t('eventLive.madeLive'));
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

    if (refusal.kind === 'planLimit') {
      setAsking({
        kind: 'told',
        title: t('eventLive.planLimit', { plan: refusal.plan, count: refusal.limit }),
        lines: [t('eventLive.planLimitStays')],
      });
    } else if (refusal.kind === 'concluded') {
      await api.taggedEvent(event.id).then(changed, () => undefined);
      setAsking({
        kind: 'told',
        title: t('eventLive.notMadeLive'),
        lines: [t('eventLive.endPassed')],
      });
    } else {
      setAsking({
        ...settled,
        ...(step.saved != null && { askHost: false, typed: '' }),
        failed: true,
      });
    }
  }

  const confirming = asking?.kind === 'confirm' ? asking : null;
  const [title, lines] =
    asking?.kind === 'told'
      ? [asking.title, asking.lines]
      : [
          t('eventLive.confirmTitle', { name: event.name }),
          [t('eventLive.confirmGuests'), t('eventLive.confirmFinal')],
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
          onPress={() => {
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
          }}
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
          confirming != null
            ? {
                label: t('eventLive.makeLive'),
                sending: t('eventLive.making'),
                keep: t('eventLive.notYet'),
                pending: confirming.pending,
                onGo: () => void go(confirming),
              }
            : null
        }
        retold={asking?.kind === 'told' ? asking : undefined}
        onClose={close}
      >
        {confirming?.notice === 'nowHosted' && (
          <View style={styles.hostsNow} testID="events.makeLiveHostsNow">
            <Text ref={hostsNow} size={tokens.typeBodyPhone.size} weight="bold">
              {t('eventLive.notSavedChanged')}
            </Text>
            <Text size={tokens.typeBodyPhone.size}>{t('eventLive.hostsNow')}</Text>
            <View role="list">
              {event.hosts.map((name) => (
                <View key={name} role="listitem" style={styles.hostLine}>
                  <Text size={tokens.typeBodyPhone.size} aria-hidden>
                    •
                  </Text>
                  <Text size={tokens.typeBodyPhone.size} style={styles.hostName}>
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {confirming?.askHost === true && (
          <>
            {confirming.notice === 'stillNoHost' && (
              <Notice
                tone="broken"
                mark={tokens.marks.broken.glyph}
                body={t('eventEdit.changedElsewhere')}
                announce
              />
            )}
            <Field
              label={t('eventHosts.label', { position: 1 })}
              error={confirming.error}
              help={t('eventLive.hostExplainer')}
            >
              <TextField
                ref={host}
                value={confirming.typed}
                onChangeText={(typed) =>
                  setAsking({ ...confirming, typed: typed.replace(/[\r\n]+/g, ' '), error: null })
                }
                autoFocus
                multiline
                scrollEnabled={false}
                returnKeyType="go"
                enterKeyHint="go"
                submitBehavior="submit"
                onSubmitEditing={() => {
                  if (!confirming.pending) void go(confirming);
                }}
                wrong={confirming.error != null}
                submitting={confirming.pending}
                style={styles.name}
                accessibilityLabel={t('eventHosts.label', { position: 1 })}
                accessibilityHint={[confirming.error, t('eventLive.hostExplainer')]
                  .filter((line) => line != null)
                  .join(' ')}
                testID="events.makeLiveHost"
              />
            </Field>
          </>
        )}
        {confirming?.failed === true && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('eventLive.failed')}
            announce
          />
        )}
      </LifecycleSheet>
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
  hostsNow: { gap: tokens.spaceSm },
  hostLine: { flexDirection: 'row', gap: tokens.spaceSm },
  hostName: { flexShrink: 1 },
  name: {
    minHeight: tokens.sizeHitPhonePrimary,
    paddingTop: tokens.spaceMd,
    paddingBottom: tokens.spaceMd,
  },
});
