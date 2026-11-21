import { ApiError, type CheckIn, type OrganisationEvent, realtimeTopic } from '@soirely/api-client';
import { REPLY_KEY } from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';
import { currentLocale } from '../i18n/index.ts';
import {
  type DoorRow,
  clockOf,
  countLine,
  doorRows,
  sameName,
  walkInProblem,
} from '../kit/checkIn.ts';
import { sidebarCardOf } from '../kit/eventTop.ts';
import { markOf } from '../kit/guestRows.ts';
import { useServerNow } from '../kit/serverNow.ts';
import type { LayoutKind } from '../layout/classify.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { usePhaseOf } from './Events.tsx';
import { SearchField } from './EventsSearch.tsx';
import { Field, TextField, focusChecked } from './Field.tsx';
import { SheetBody, SheetLayer } from './FormLayers.tsx';
import { GuestsCard } from './GuestsCard.tsx';
import { useReadOut } from './ReadOut.tsx';
import { DoorGlyph, MarkSlot } from './ReplyMark.tsx';
import { Pill } from './SettingsParts.tsx';
import { PageToast, Row, RowList, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

/** The door's list is read again this often while the live channel is quiet, as the night's is. */
const READ_AGAIN_MS = 10_000;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; checkIn: CheckIn };

/** A walk-in being added: the name, whether it was checked, the one on the list with the same name, and a refusal. */
interface WalkIn {
  name: string;
  checked: boolean;
  same: { id: string; name: string } | null;
  busy: boolean;
  failed: boolean;
}

/** Only the door's signal reaches the device: it says the list changed, and the list is read again through the API, which refuses an ended grant (sc-1454). */
function useDoor(eventId: string) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const live = useRef(true);

  const read = useCallback(() => {
    void api.checkIn(eventId).then(
      (checkIn) => live.current && setLoad({ kind: 'loaded', checkIn }),
      (error: unknown) => {
        if (!live.current) return;
        const ended = error instanceof ApiError && (error.status === 403 || error.status === 404);
        setLoad((was) => (was.kind === 'loaded' && !ended ? was : { kind: 'failed' }));
      },
    );
  }, [eventId]);

  useEffect(() => {
    live.current = true;
    read();
    const stop = followReadingAgain(
      realtimeTopic('EventCheckIn', eventId),
      () => api.checkInSubscription(eventId),
      read,
      READ_AGAIN_MS,
    );

    return () => {
      live.current = false;
      stop();
    };
  }, [eventId, read]);

  return {
    load,
    read,
    shown: (checkIn: CheckIn) => live.current && setLoad({ kind: 'loaded', checkIn }),
  };
}

/** Check-in (sc-1454): its card with the count, Search by name, everyone A to Z with Arrived, and a walk-in for anyone not on the list. */
export function CheckInView({
  eventId,
  kind,
  top,
  onEvent,
}: {
  eventId: string;
  kind: LayoutKind;
  /** Above the card on a tablet: Back to Guests. */
  top: ReactNode;
  onEvent: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const door = useDoor(eventId);
  const [event, setEvent] = useState<OrganisationEvent | null>(null);
  const now = useServerNow();
  const phase = usePhaseOf(event, now);
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [said, setSaid] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<WalkIn | null>(null);
  const search = useRef<TextInputInstance>(null);

  useEffect(() => {
    let current = true;
    void api.event(eventId).then(
      (one) => {
        if (!current) return;
        setEvent(one);
        onEvent(one);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [eventId, onEvent]);

  const failedOn = (id: string, on: boolean) =>
    setFailed((was) => {
      const next = new Set(was);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const arrive = (row: { id: string; name: string }) => {
    failedOn(row.id, false);
    api.arrive(eventId, row.id).then(
      (checkIn) => {
        door.shown(checkIn);
        setSaid(t('checkIn.arrivedName', { name: row.name }));
      },
      () => {
        failedOn(row.id, true);
        setSaid(t('checkIn.notRecorded'));
      },
    );
  };

  const undo = (row: DoorRow) => {
    api.undoArrival(eventId, row.id).then(
      (checkIn) => {
        door.shown(checkIn);
        setSaid(t('checkIn.undone'));
      },
      () => setSaid(t('checkIn.notRecorded')),
    );
  };

  const add = (form: WalkIn, allowDuplicate: boolean) => {
    const name = form.name.trim();
    setWalkIn({ ...form, busy: true, failed: false });
    api.addWalkIn(eventId, name, allowDuplicate).then(
      ({ checkIn }) => {
        door.shown(checkIn);
        setWalkIn(null);
        setTyped(name);
        setSaid(t('checkIn.arrivedName', { name }));
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('guest_already_listed')) {
          const listed = (error.problem as { guest?: { id?: unknown; fullName?: unknown } }).guest;
          if (typeof listed?.id === 'string') {
            const same = {
              id: listed.id,
              name: typeof listed.fullName === 'string' ? listed.fullName : name,
            };
            setWalkIn({ ...form, busy: false, same });
            return;
          }
        }
        setWalkIn({ ...form, busy: false, failed: true });
      },
    );
  };

  if (door.load.kind === 'failed')
    return (
      <View style={styles.page}>
        {top}
        <View style={styles.pad}>
          <AlertLine text={t('checkIn.failed')} />
          <Pill
            label={t('checkIn.tryAgain')}
            kind="secondary"
            full={false}
            onPress={door.read}
            testID="checkIn.retry"
          />
        </View>
      </View>
    );

  if (door.load.kind === 'loading') return <View style={styles.page}>{top}</View>;

  const { checkIn } = door.load;
  const open = checkIn.state === 'open';
  const opensAt = clockOf(checkIn.opensAt);
  const looking = typed.trim() !== '';
  const rows = doorRows(t, checkIn, typed, currentLocale());
  const empty = checkIn.guests.length === 0;
  const shown = event == null ? null : sidebarCardOf(event, phase);
  const card = (
    <GuestsCard
      kind={kind}
      event={shown}
      says={
        checkIn.state === 'before_open'
          ? t('checkIn.opensAt', { time: opensAt })
          : countLine(t, checkIn.count)
      }
      line={
        checkIn.state === 'before_open'
          ? t('checkIn.searchWorksNow', { time: opensAt })
          : checkIn.state === 'ended'
            ? t('checkIn.ended')
            : t('checkIn.openedAt', { time: opensAt })
      }
      step={null}
    />
  );
  const startWalkIn = (name: string) =>
    setWalkIn({ name, checked: false, same: null, busy: false, failed: false });

  const header = (
    <View style={styles.header}>
      {top}
      {card}
      <SearchField
        typed={typed}
        off={false}
        width={null}
        onTyped={setTyped}
        onSearch={() => undefined}
        onClear={() => setTyped('')}
        label={t('checkIn.searchByName')}
        testID="checkIn.search"
        ref={search}
      />
    </View>
  );

  const list = empty ? (
    <View style={styles.tight} testID="checkIn.empty">
      <Text size={18} weight="bold" accessibilityRole="header">
        {t('checkIn.nobodyYet')}
      </Text>
      {open && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {t('checkIn.nobodyYetLine')}
        </Text>
      )}
      {open && (
        <Pill
          label={t('checkIn.addWalkIn')}
          full={false}
          onPress={() => startWalkIn(typed)}
          testID="checkIn.walkIn"
        />
      )}
    </View>
  ) : looking && rows.length === 0 ? (
    <View style={styles.tight}>
      <NoOne typed={typed.trim()} />
      {open && (
        <Pill
          label={t('checkIn.addWalkIn')}
          full={false}
          onPress={() => startWalkIn(typed.trim())}
          testID="checkIn.walkIn"
        />
      )}
    </View>
  ) : (
    <RowList
      items={rows.map((row) => ({
        key: row.id,
        inset: row.companion ? 80 : 40,
        row: (
          <DoorLine
            row={row}
            open={open}
            big={kind === 'phone'}
            failed={failed.has(row.id)}
            onArrive={() => arrive(row)}
            onUndo={() => undo(row)}
          />
        ),
      }))}
    />
  );

  const form =
    walkIn == null ? null : (
      <WalkInForm
        form={walkIn}
        onChange={setWalkIn}
        onAdd={(allowDuplicate) => {
          const problem = walkInProblem(walkIn.name);
          if (problem != null) {
            setWalkIn({ ...walkIn, checked: true });
            return;
          }
          const listed = allowDuplicate ? null : sameName(checkIn, walkIn.name);
          if (listed != null) {
            setWalkIn({ ...walkIn, checked: true, same: { id: listed.id, name: listed.name } });
            return;
          }
          add({ ...walkIn, checked: true }, allowDuplicate);
        }}
        onArrive={(same) => {
          setWalkIn(null);
          arrive(same);
        }}
      />
    );
  const told =
    said == null ? null : (
      <PageToast
        words={said}
        onClose={() => setSaid(null)}
        bottom={Math.max(insets.bottom, tokens.spaceLg)}
      />
    );
  const closeWalkIn = () => setWalkIn(null);
  const scroll = (
    <ScrollView
      style={styles.grow}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
      keyboardShouldPersistTaps="handled"
    >
      {list}
    </ScrollView>
  );

  if (kind === 'tabletLandscape')
    return (
      <View style={styles.panes}>
        <View style={[styles.doorPane, walkIn != null && styles.doorPaneNarrow]}>
          {header}
          {scroll}
        </View>
        {walkIn != null && (
          <ScrollView
            style={styles.grow}
            contentContainerStyle={styles.side}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sideHead}>
              <Text size={22} weight="bold" accessibilityRole="header" style={styles.grow}>
                {t('checkIn.addWalkIn')}
              </Text>
              <TextAction
                label={t('checkIn.close')}
                onPress={closeWalkIn}
                testID="checkIn.walkIn.close"
              />
            </View>
            {form}
          </ScrollView>
        )}
        {told}
      </View>
    );

  return (
    <View style={styles.page}>
      {header}
      {scroll}
      {walkIn != null && (
        <SheetLayer onClose={closeWalkIn} label={t('checkIn.close')}>
          <SheetBody
            title={t('checkIn.addWalkIn')}
            close={t('checkIn.close')}
            onClose={closeWalkIn}
            closeTestID="checkIn.walkIn.close"
          >
            {form}
          </SheetBody>
        </SheetLayer>
      )}
      {told}
    </View>
  );
}

function DoorLine({
  row,
  open,
  big,
  failed,
  onArrive,
  onUndo,
}: {
  row: DoorRow;
  open: boolean;
  big: boolean;
  failed: boolean;
  onArrive: () => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  const word = t(REPLY_KEY[row.reply]);
  const arrival = row.arrival;
  const line =
    arrival == null
      ? word
      : `${word} · ${
          arrival.by == null
            ? t('checkIn.arrivedAt', { time: clockOf(arrival.at) })
            : t('checkIn.arrivedAtBy', { time: clockOf(arrival.at), name: arrival.by })
        }`;
  const trail = !open ? null : arrival != null ? (
    <TextAction
      label={t('checkIn.undo')}
      plain
      onPress={onUndo}
      accessibilityLabel={t('checkIn.undoFor', { name: row.name })}
      testID={`checkIn.undo.${row.id}`}
    />
  ) : (
    <ArrivedButton name={row.name} big={big} onPress={onArrive} id={row.id} />
  );

  return (
    <View style={row.companion && styles.indent}>
      <Row
        title={row.name}
        line={line}
        lead={
          <MarkSlot
            kind={
              arrival != null ? (row.reply === 'walkIn' ? 'walkin' : 'arrived') : markOf(row.reply)
            }
          />
        }
        trail={trail}
        pad={10}
        accessibilityLabel={`${row.name}. ${line}`}
        testID={`checkIn.row.${row.id}`}
      />
      {failed && (
        <View style={styles.failedAt}>
          <AlertLine text={t('checkIn.notRecorded')} small />
        </View>
      )}
    </View>
  );
}

function ArrivedButton({
  name,
  id,
  big,
  onPress,
}: {
  name: string;
  id: string;
  big: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const height = big ? 52 : tokens.sizeHit;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrived,
        { minHeight: height, borderRadius: height / 2 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('checkIn.arrivedFor', { name })}
      testID={`checkIn.arrive.${id}`}
    >
      <DoorGlyph side={18} ink={tokens.colorAccentText} />
      <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
        {t('checkIn.arrived')}
      </Text>
    </Pressable>
  );
}

function NoOne({ typed }: { typed: string }) {
  const { t } = useTranslation();
  const words = t('checkIn.noOne', { typed });
  useReadOut(words);

  return (
    <Text size={16} weight="semibold">
      {words}
    </Text>
  );
}

/** Add walk-in: one field, the typed name in it; a name already on the list offers to mark them arrived or add someone new, and nothing is created until one is pressed. */
function WalkInForm({
  form,
  onChange,
  onAdd,
  onArrive,
}: {
  form: WalkIn;
  onChange: (form: WalkIn) => void;
  onAdd: (allowDuplicate: boolean) => void;
  onArrive: (same: { id: string; name: string }) => void;
}) {
  const { t } = useTranslation();
  const field = useRef<TextInputInstance>(null);
  const problem = form.checked ? walkInProblem(form.name) : null;

  useEffect(() => {
    if (problem != null) focusChecked(field);
  }, [problem, form.checked]);

  return (
    <View style={styles.form}>
      <Field
        label={t('checkIn.fullName')}
        error={
          problem === 'blank'
            ? t('checkIn.nameBlank')
            : problem === 'long'
              ? t('checkIn.nameLong')
              : null
        }
      >
        <TextField
          ref={field}
          value={form.name}
          wrong={problem != null}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          spellCheck={false}
          onChangeText={(name) => onChange({ ...form, name, same: null, failed: false })}
          onSubmitEditing={() => onAdd(false)}
          accessibilityLabel={t('checkIn.fullName')}
          testID="checkIn.walkIn.name"
        />
      </Field>
      {form.failed && <AlertLine text={t('checkIn.notRecorded')} />}
      {form.same != null ? (
        <Same same={form.same} onArrive={onArrive} onAdd={() => onAdd(true)} />
      ) : (
        <Pill
          label={t('checkIn.addAndArrive')}
          busy={form.busy}
          onPress={() => onAdd(false)}
          testID="checkIn.walkIn.add"
        />
      )}
    </View>
  );
}

function Same({
  same,
  onArrive,
  onAdd,
}: {
  same: { id: string; name: string };
  onArrive: (same: { id: string; name: string }) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const title = t('checkIn.alreadyListed', { name: same.name });
  useReadOut(title);

  return (
    <View style={styles.amber} accessibilityRole="alert" testID="checkIn.walkIn.same">
      <Text size={15.5} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      <Pill
        label={t('checkIn.markThemArrived')}
        onPress={() => onArrive(same)}
        testID="checkIn.walkIn.arrive"
      />
      <Pill
        label={t('checkIn.addSomeoneNew')}
        kind="secondary"
        onPress={onAdd}
        testID="checkIn.walkIn.new"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  pad: { gap: tokens.spaceLg, padding: tokens.spaceLg },
  header: { gap: 14, paddingTop: 16, paddingHorizontal: tokens.spaceLg },
  list: { gap: 14, paddingTop: 8, paddingHorizontal: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  tight: { gap: 10, alignItems: 'flex-start' },
  indent: { paddingLeft: 40 },
  failedAt: { paddingLeft: 40, paddingBottom: tokens.spaceSm },
  arrived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    backgroundColor: tokens.colorAccentTint,
  },
  panes: { flex: 1, flexDirection: 'row', backgroundColor: tokens.colorCard },
  doorPane: { flex: 1, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  doorPaneNarrow: { flex: 0, width: 520 },
  side: { gap: 14, paddingTop: 22, paddingHorizontal: 32 },
  sideHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  form: { gap: 14 },
  amber: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
});
