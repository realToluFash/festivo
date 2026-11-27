import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Field, focusChecked, TextField } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { Sheet, SheetActions, SheetScrollView } from '../../components/Sheet.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { SelectRow } from '../SelectRow.tsx';
import { COUNTRIES, type Country } from '../countries.ts';
import {
  EVENT,
  JOBS,
  LEAD,
  STATIONS,
  W,
  type WhState,
  type WhStateName,
  byId,
  choose,
  clockIn,
  closeSheet,
  coverCandidates,
  didntClockIn,
  doorAnswer,
  doorLabel,
  doorProblems,
  dueBy,
  firstProblem,
  here,
  jobEnd,
  jobLine,
  mobileAnswer,
  moveChosen,
  notHere,
  numberProblem,
  onStation,
  openCover,
  openDoor,
  openMobile,
  seed,
  setDoor,
  setMobile,
  showsDoor,
  stationsTonight,
  time,
  toastWords,
  whStateOf,
} from './WhosHereModel.ts';
import { Chip, CloseX, MarkLine, PersonRow, StationTile } from './WhosHereParts.tsx';

const ADD_MS = 900;
const MOBILE_MS = 700;
const RETRY_MS = 1200;

const countryOf = (code: string): Country =>
  COUNTRIES.find((c) => c.code === code) ?? (COUNTRIES[0] as Country);

export function WhosHereRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = whStateOf(params.state);

  return <WhosHere key={state} start={state} />;
}

type Refs = RefObject<Map<string, ViewInstance>>;

function WhosHere({ start }: { start: WhStateName }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<WhState>(() => seed(start));
  const refs = useRef(new Map<string, ViewInstance>());
  const opener = useRef<ViewInstance | null>(null);
  const phone = kind === 'phone';
  const wide = kind === 'tabletLandscape';
  const toast = toastWords(s);

  useEffect(() => {
    if (toast !== '') return readOut(toast);
    return undefined;
  }, [toast]);

  useEffect(() => {
    if (s.system !== 'loading' || start === 'loading') return undefined;
    const timer = setTimeout(() => setS((x) => ({ ...x, system: 'live' })), RETRY_MS);
    return () => clearTimeout(timer);
  }, [s.system, start]);

  function apply(next: WhState): void {
    opener.current = refs.current.get(next.opener) ?? null;
    setS(next);
  }

  function finish(after: WhState): void {
    const next = closeSheet(after);
    apply(next);
    setTimeout(() => moveScreenReaderFocus(refs.current.get(next.opener) ?? null), SETTLED_MS);
  }

  const close = (): void => finish(s);

  const lead = s.role === 'station';
  const lists = s.system === 'live' || s.system === 'stale';
  const showStations = lists && !lead && !phone;
  const door = showsDoor(s) ? (
    <PrimaryButton
      label={W.door}
      onPress={() => apply(openDoor(s))}
      ref={(v) => keep(refs, 'door', v)}
      testID="wh.door"
    />
  ) : null;

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          phone && styles.bodyPhone,
          { paddingBottom: insets.bottom + tokens.space6xl * 2 },
        ]}
        testID={`wh.${start}`}
      >
        <QuietButton label="Back" onPress={goBack} testID="wh.back" />
        <View style={[styles.head, wide && styles.headWide]}>
          <View style={styles.grow}>
            <Text size={14} weight="semibold" style={styles.secondary}>
              {EVENT}
            </Text>
            <Text size={phone ? 28 : 30} weight="bold" accessibilityRole="header">
              {W.title}
            </Text>
            {lead && (
              <View style={styles.pill} testID="wh.leadStation">
                <Text size={14} weight="semibold">
                  {LEAD.station}
                </Text>
              </View>
            )}
            <LiveLine s={s} />
          </View>
          {lists && door != null && <View style={!wide && styles.doorFull}>{door}</View>}
        </View>
        <Body s={s} phone={phone} refs={refs} apply={apply} door={door} wide={wide}>
          {showStations && (
            <View style={styles.stations} testID="wh.stations">
              <Text size={17} weight="bold" accessibilityRole="header">
                {W.stations}
              </Text>
              {stationsTonight(s).map((x) => (
                <StationTile key={x.station} station={x.station} people={x.people} />
              ))}
            </View>
          )}
        </Body>
        <DemoOnly title="Demo only: the board’s switches">
          <SecondaryButton
            label="Start again"
            onPress={() => setS(seed(start))}
            testID="wh.demo.reset"
          />
          <SecondaryButton
            label="The next person due clocks in"
            onPress={() => apply(clockIn(s))}
            testID="wh.demo.clockIn"
          />
          <SecondaryButton
            label={s.epic36 ? 'Epic 36 exists · texting the link' : 'Epic 36 does not exist yet'}
            onPress={() => setS({ ...s, epic36: !s.epic36 })}
            testID="wh.demo.epic36"
          />
          <SecondaryButton
            label={s.failNext ? 'The next save fails once · on' : 'Make the next save fail once'}
            onPress={() => setS({ ...s, failNext: !s.failNext })}
            testID="wh.demo.fail"
          />
          <SecondaryButton
            label={s.ended ? 'The event has ended' : 'End the event now'}
            onPress={() => setS({ ...s, ended: true })}
            testID="wh.demo.end"
          />
          <SecondaryButton
            label={s.system === 'stale' ? 'Come back online' : 'Lose the connection'}
            onPress={() => setS({ ...s, system: s.system === 'stale' ? 'live' : 'stale' })}
            testID="wh.demo.online"
          />
        </DemoOnly>
      </ScrollView>
      <Sheet
        open={s.sheet != null}
        onClose={close}
        scrimLabel="Close"
        held={(s.sheet?.kind === 'door' || s.sheet?.kind === 'mobile') && s.sheet.form.busy}
        opener={opener}
        docked
        testID="wh.sheet"
      >
        <SheetBody s={s} phone={phone} apply={apply} close={close} finish={finish} />
      </Sheet>
      {toast !== '' && (
        <PageToast
          words={toast}
          onClose={() => setS({ ...s, toast: null })}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </View>
  );
}

function keep(refs: Refs, key: string, v: ViewInstance | null): void {
  if (v == null) refs.current.delete(key);
  else refs.current.set(key, v);
}

function LiveLine({ s }: { s: WhState }) {
  if (s.system === 'stale')
    return (
      <View style={styles.live}>
        <View style={styles.ringOff} />
        <Text size={14} weight="medium" style={styles.secondary}>
          {W.stale(time(s.clock - 3))}
        </Text>
      </View>
    );
  if (s.system !== 'live') return null;

  return (
    <View style={styles.live}>
      <View style={styles.dot} />
      <Text size={14} weight="medium" style={styles.secondary}>
        {W.live(time(s.clock))}
      </Text>
    </View>
  );
}

function Body({
  s,
  phone,
  wide,
  refs,
  apply,
  door,
  children,
}: {
  s: WhState;
  phone: boolean;
  wide: boolean;
  refs: Refs;
  apply: (next: WhState) => void;
  door: ReactNode;
  children: ReactNode;
}) {
  if (s.system === 'loading')
    return <Skeleton shape="rows" rowHeight={64} rows={6} words={W.loading} />;
  if (s.system === 'unreachable')
    return (
      <View style={styles.block} testID="wh.unreachable">
        <Notice tone="broken" mark="!" title={W.unreachableTitle} body={W.unreachable} announce />
        <SecondaryButton
          label={W.tryAgain}
          onPress={() => apply({ ...s, system: 'loading' })}
          testID="wh.unreachable.retry"
        />
      </View>
    );
  if (s.system === 'notFound')
    return (
      <View style={styles.block} testID="wh.notFound">
        <Text size={20} weight="bold" accessibilityRole="header">
          {W.notFound}
        </Text>
        <SecondaryButton label={W.backToEvents} onPress={goBack} link testID="wh.notFound.back" />
      </View>
    );
  if (s.system === 'empty')
    return (
      <View style={styles.block} testID="wh.empty">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {W.empty}
        </Text>
        {door}
      </View>
    );

  const due = notHere(s);
  const inNow = here(s);
  const missed = didntClockIn(s);
  const lists = (
    <View style={styles.lists}>
      <Section title={W.notHere(due.length)} testID="wh.notHere">
        {due.length === 0 ? (
          <Text size={15} style={styles.secondary}>
            {W.notHereEmpty(dueBy(s))}
          </Text>
        ) : (
          due.map((r, i) => (
            <PersonRow
              key={r.p.id}
              name={r.p.name}
              lines={[`${r.p.job} · ${r.p.station}`, W.shift(r.p)]}
              first={i === 0}
              phone={phone}
              amber={r.nobody}
              mark={
                r.coveredBy != null ? (
                  <MarkLine kind="yes" ink={tokens.colorAccent} words={W.coveredBy(r.coveredBy)} />
                ) : r.nobody ? (
                  <MarkLine
                    kind="notyet"
                    ink={tokens.colorAttention}
                    words={W.nobodyHereOn(r.p.station)}
                    dashed
                  />
                ) : (
                  <MarkLine kind="notyet" ink={tokens.colorAttention} words="Not here yet" />
                )
              }
              actions={
                <>
                  {r.canCover && (
                    <SecondaryButton
                      label={W.cover(r.p.station)}
                      onPress={() => apply(openCover(s, r.p.id))}
                      stacked={phone}
                      ref={(v) => keep(refs, `cover|${r.p.id}`, v)}
                      testID={`wh.cover.${r.p.id}`}
                    />
                  )}
                  {r.p.phone !== '' ? (
                    <SecondaryButton
                      label={W.call}
                      accessibilityLabel={`Call ${r.p.name}`}
                      onPress={() => {}}
                      stacked={phone}
                      link
                      ref={(v) => keep(refs, `call|${r.p.id}`, v)}
                      testID={`wh.call.${r.p.id}`}
                    />
                  ) : (
                    <View style={styles.noNumber}>
                      <Text size={14} weight="medium" style={styles.secondary}>
                        {W.noNumber}
                      </Text>
                      {r.canAddMobile && (
                        <SecondaryButton
                          label={W.addMobile}
                          onPress={() => apply(openMobile(s, r.p.id, true))}
                          stacked={phone}
                          ref={(v) => keep(refs, `mobile|${r.p.id}`, v)}
                          testID={`wh.addMobile.${r.p.id}`}
                        />
                      )}
                    </View>
                  )}
                </>
              }
              testID={`wh.notHere.${r.p.id}`}
            />
          ))
        )}
      </Section>
      {missed.length > 0 && (
        <Section title={W.didnt(missed.length)} testID="wh.didnt">
          {missed.map((p, i) => (
            <PersonRow
              key={p.id}
              name={p.name}
              lines={[`${p.job} · ${p.station}`, W.shift(p)]}
              first={i === 0}
              phone={phone}
              mark={
                <MarkLine kind="ended" ink={tokens.colorInkSecondary} words="Didn’t clock in" />
              }
              testID={`wh.didnt.${p.id}`}
            />
          ))}
          <SecondaryButton
            label={W.hoursWorked}
            onPress={() => router.push('/demo/staff-hours')}
            link
            testID="wh.hoursWorked"
          />
        </Section>
      )}
      <Section title={W.here(inNow.length)} testID="wh.here">
        {inNow.length === 0 ? (
          <Text size={15} style={styles.secondary}>
            {W.hereEmpty}
          </Text>
        ) : (
          inNow.map((p, i) => (
            <PersonRow
              key={p.id}
              name={p.name}
              lines={[
                `${p.job} · ${p.station}`,
                W.shift(p),
                ...(p.movedFrom == null
                  ? []
                  : [W.movedFrom(p.movedFrom.station, time(p.movedFrom.at))]),
              ]}
              first={i === 0}
              phone={phone}
              mark={
                <MarkLine
                  kind="yes"
                  ink={tokens.colorAccent}
                  words={W.clockedInAt(time(p.inAt ?? s.clock))}
                />
              }
              testID={`wh.here.${p.id}`}
            />
          ))
        )}
      </Section>
    </View>
  );

  return (
    <View style={wide ? styles.side : styles.column}>
      <View style={wide ? styles.sideMain : undefined}>{lists}</View>
      {children != null && children !== false && (
        <View style={wide ? styles.sidePanel : undefined}>{children}</View>
      )}
    </View>
  );
}

function Section({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text size={17} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SheetBody({
  s,
  phone,
  apply,
  close,
  finish,
}: {
  s: WhState;
  phone: boolean;
  apply: (next: WhState) => void;
  close: () => void;
  finish: (after: WhState) => void;
}) {
  const sheet = s.sheet;
  if (sheet == null) return null;
  const title =
    sheet.kind === 'door' || sheet.kind === 'noLink'
      ? W.door
      : sheet.kind === 'cover'
        ? W.cover(byId(s, sheet.target)?.station ?? '')
        : sheet.kind === 'mobile'
          ? W.addMobile
          : W.hasLink(byId(s, sheet.id)?.name ?? '');

  return (
    <SheetScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet}>
      {s.role === 'station' && (
        <View style={styles.pill}>
          <Text size={14} weight="semibold">
            {LEAD.station}
          </Text>
        </View>
      )}
      <View style={styles.sheetHead}>
        <Text size={22} weight="bold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        <CloseX onPress={close} testID="wh.sheet.close" />
      </View>
      {sheet.kind === 'door' && <DoorForm s={s} phone={phone} apply={apply} close={close} />}
      {sheet.kind === 'cover' && (
        <CoverForm s={s} phone={phone} apply={apply} close={close} finish={finish} />
      )}
      {sheet.kind === 'mobile' && <MobileForm s={s} apply={apply} />}
      {sheet.kind === 'noLink' && <NoLink s={s} id={sheet.id} apply={apply} close={close} />}
      {sheet.kind === 'hasLink' && (
        <View style={styles.form}>
          <Text size={16}>
            {sheet.via === 'copy'
              ? W.copied(byId(s, sheet.id)?.phone ?? '')
              : W.texted(byId(s, sheet.id)?.phone ?? '')}
          </Text>
          {sheet.via === 'copy' && (
            <>
              <SecondaryButton
                label={W.copyAgain}
                onPress={() => {
                  apply({ ...s, sheet: { ...sheet, again: true } });
                  readOut(W.copiedAgain);
                }}
                testID="wh.copyAgain"
              />
              {sheet.again && (
                <MarkLine kind="yes" ink={tokens.colorAccent} words={W.copiedAgain} />
              )}
            </>
          )}
          <SheetActions>
            <PrimaryButton label={W.done} onPress={close} testID="wh.done" />
          </SheetActions>
        </View>
      )}
    </SheetScrollView>
  );
}

function NoLink({
  s,
  id,
  apply,
  close,
}: {
  s: WhState;
  id: number;
  apply: (next: WhState) => void;
  close: () => void;
}) {
  const name = byId(s, id)?.name ?? '';

  return (
    <View style={styles.form}>
      <MarkLine kind="yes" ink={tokens.colorAccent} words={W.added(name)} />
      <View style={styles.amberNote} testID="wh.noLink">
        <MarkLine kind="notyet" ink={tokens.colorAttention} words={W.noLink(name)} />
        <SecondaryButton
          label={W.addMobile}
          onPress={() => apply(openMobile(s, id, false))}
          testID="wh.noLink.addMobile"
        />
      </View>
      <SheetActions>
        <PrimaryButton label={W.done} onPress={close} testID="wh.done" />
      </SheetActions>
    </View>
  );
}

function DoorForm({
  s,
  phone,
  apply,
  close,
}: {
  s: WhState;
  phone: boolean;
  apply: (next: WhState) => void;
  close: () => void;
}) {
  const nameField = useRef<TextInputInstance>(null);
  const numberField = useRef<TextInputInstance>(null);
  const firstJob = useRef<ViewInstance>(null);
  const firstStation = useRef<ViewInstance>(null);
  const closeRef = useRef<ViewInstance>(null);
  const refused = s.sheet?.kind === 'door' && s.sheet.form.refused;

  useEffect(() => {
    if (!refused) return undefined;
    const t = setTimeout(() => moveScreenReaderFocus(closeRef.current), SETTLED_MS);
    return () => clearTimeout(t);
  }, [refused]);

  if (s.sheet?.kind !== 'door') return null;
  const f = s.sheet.form;
  const country = countryOf(f.country);
  const problems = doorProblems(s, f, country.name);
  const shown = f.tried ? problems : { name: null, number: null, job: null, station: null };
  const end = f.job != null && !f.refused ? jobEnd(s, f.job) : null;

  function add(): void {
    if (f.busy) return;
    const first = firstProblem(problems);
    if (first != null) {
      apply(setDoor(s, { tried: true }));
      if (first === 'name') focusChecked(nameField);
      else if (first === 'number') focusChecked(numberField);
      else moveScreenReaderFocus((first === 'job' ? firstJob : firstStation).current);
      return;
    }
    const pressed = setDoor(s, { tried: true, busy: true, failed: false });
    apply(pressed);
    setTimeout(() => apply(doorAnswer(pressed, country.dial)), ADD_MS);
  }

  return (
    <View style={styles.form}>
      <Field label={W.name} error={shown.name}>
        <TextField
          ref={nameField}
          value={f.name}
          onChangeText={(name) => apply(setDoor(s, { name, failed: false }))}
          wrong={shown.name != null}
          autoCapitalize="words"
          autoComplete="off"
          maxLength={200}
          accessibilityLabel={W.name}
          testID="wh.door.name"
        />
      </Field>
      <SelectRow
        label={W.country}
        country={country}
        onChange={(c) => apply(setDoor(s, { country: c.code }))}
        testID="wh.door.country"
      />
      <Field label={W.mobile} pill={W.optional} error={shown.number}>
        <TextField
          ref={numberField}
          value={f.number}
          onChangeText={(number) => apply(setDoor(s, { number }))}
          wrong={shown.number != null}
          accessibilityLabel={W.mobile}
          keyboardType="phone-pad"
          autoComplete="off"
          testID="wh.door.number"
        />
      </Field>
      <View style={styles.group}>
        <Text size={15} weight="semibold">
          {W.job}
        </Text>
        <View style={styles.chips}>
          {JOBS.map((job, i) => (
            <Chip
              key={job}
              label={job}
              on={f.job === job}
              hint={f.refused ? undefined : jobLine(job, jobEnd(s, job))}
              onPress={() => apply(setDoor(s, { job: f.job === job ? null : job }))}
              ref={i === 0 ? firstJob : undefined}
              testID={`wh.door.job.${job}`}
            />
          ))}
        </View>
        {shown.job != null && <Wrong words={shown.job} />}
        {end != null && f.job != null && (
          <Text size={14} style={styles.secondary} testID="wh.door.jobLine">
            {jobLine(f.job, end)}
          </Text>
        )}
      </View>
      {s.role === 'station' ? (
        <View style={styles.group}>
          <Text size={15} weight="semibold">
            {W.where}
          </Text>
          <Text size={15}>{LEAD.station}</Text>
        </View>
      ) : (
        <View style={styles.group}>
          <Text size={15} weight="semibold">
            {W.where}
          </Text>
          <View style={styles.chips}>
            {STATIONS.map((st, i) => (
              <Chip
                key={st}
                label={st}
                on={f.station === st}
                onPress={() => apply(setDoor(s, { station: f.station === st ? null : st }))}
                ref={i === 0 ? firstStation : undefined}
                testID={`wh.door.station.${i}`}
              />
            ))}
          </View>
          {shown.station != null && <Wrong words={shown.station} />}
        </View>
      )}
      {f.failed && !f.refused && (
        <Notice tone="broken" mark="!" body={W.failed(f.name.trim())} announce />
      )}
      {f.refused ? (
        <View style={styles.form}>
          <Notice tone="attention" mark="!" body={W.refused} announce interrupts />
          <SheetActions>
            <PrimaryButton label={W.close} onPress={close} ref={closeRef} testID="wh.door.close" />
          </SheetActions>
        </View>
      ) : (
        <SheetActions>
          <PrimaryButton
            label={doorLabel(s, f)}
            busy={f.busy}
            onPress={add}
            paired={!phone}
            testID="wh.door.add"
          />
        </SheetActions>
      )}
    </View>
  );
}

function Wrong({ words }: { words: string }) {
  return (
    <Text size={14} weight="semibold" style={styles.broken} accessibilityRole="alert">
      {words}
    </Text>
  );
}

function MobileForm({ s, apply }: { s: WhState; apply: (next: WhState) => void }) {
  const numberField = useRef<TextInputInstance>(null);
  if (s.sheet?.kind !== 'mobile') return null;
  const sheet = s.sheet;
  const f = sheet.form;
  const country = countryOf(f.country);
  const name = byId(s, sheet.id)?.name ?? '';
  const problem = numberProblem(f.number, f.country, country.name, true);

  function send(): void {
    if (f.busy) return;
    if (problem != null) {
      apply(setMobile(s, { tried: true }));
      focusChecked(numberField);
      return;
    }
    const pressed = setMobile(s, { tried: true, busy: true, failed: false });
    apply(pressed);
    setTimeout(() => apply(mobileAnswer(pressed, country.dial)), MOBILE_MS);
  }

  return (
    <View style={styles.form}>
      <Text size={15} style={styles.secondary}>
        {W.forOnly(name)}
      </Text>
      <SelectRow
        label={W.country}
        country={country}
        onChange={(c) => apply(setMobile(s, { country: c.code }))}
        testID="wh.mobile.country"
      />
      <Field label={W.mobile} error={f.tried ? problem : null}>
        <TextField
          ref={numberField}
          value={f.number}
          onChangeText={(number) => apply(setMobile(s, { number, failed: false }))}
          wrong={f.tried && problem != null}
          accessibilityLabel={W.mobile}
          keyboardType="phone-pad"
          autoComplete="off"
          autoFocus
          testID="wh.mobile.number"
        />
      </Field>
      {f.failed && <Notice tone="broken" mark="!" body={W.mobileFailed} announce />}
      <SheetActions>
        <PrimaryButton
          label={s.epic36 ? 'Text the link' : 'Copy the link'}
          busy={f.busy}
          onPress={send}
          testID="wh.mobile.send"
        />
      </SheetActions>
    </View>
  );
}

function CoverForm({
  s,
  phone,
  apply,
  close,
  finish,
}: {
  s: WhState;
  phone: boolean;
  apply: (next: WhState) => void;
  close: () => void;
  finish: (after: WhState) => void;
}) {
  const firstRef = useRef<ViewInstance>(null);
  if (s.sheet?.kind !== 'cover') return null;
  const sheet = s.sheet;
  const t = byId(s, sheet.target);
  if (t == null) return null;
  const people = coverCandidates(s, t.station);
  const chosen = people.find((p) => p.id === sheet.chosen) ?? null;
  const none = people.length === 0;

  return (
    <View style={styles.form}>
      <Text size={15} style={styles.secondary}>
        {W.coverLine(t)}
      </Text>
      {none ? (
        <>
          <Text size={16}>
            {here(s).length === 0 && s.role !== 'station'
              ? W.nobodyClockedIn
              : W.allOnIt(t.station)}
          </Text>
          <SheetActions>
            <SecondaryButton
              label={W.close}
              onPress={close}
              stacked={phone}
              testID="wh.cover.close"
            />
          </SheetActions>
        </>
      ) : (
        <>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {people.map((p, i) => {
              const on = chosen?.id === p.id;
              const alone = onStation(s, p.station).length === 1;
              return (
                <ChoiceRow
                  key={p.id}
                  name={p.name}
                  line={W.onStation(p.station)}
                  warn={alone ? W.leaves(p.station) : null}
                  on={on}
                  onPress={() => apply(choose(s, p.id))}
                  ref={i === 0 ? firstRef : undefined}
                  testID={`wh.cover.who.${p.id}`}
                />
              );
            })}
          </View>
          {sheet.tried && chosen == null && <Wrong words={W.choose(t.station)} />}
          {sheet.failed && chosen != null && (
            <Notice tone="broken" mark="!" body={W.coverFailed(chosen.name)} announce />
          )}
          <SheetActions>
            <PrimaryButton
              label={W.moveTo(t.station, chosen?.name ?? null)}
              onPress={() => {
                const next = moveChosen(s);
                if (next.sheet?.kind === 'cover' && next.sheet.failed) {
                  apply(next);
                  return;
                }
                if (next.sheet != null) {
                  apply(next);
                  moveScreenReaderFocus(firstRef.current);
                  return;
                }
                finish(next);
              }}
              testID="wh.cover.move"
            />
          </SheetActions>
        </>
      )}
    </View>
  );
}

function ChoiceRow({
  name,
  line,
  warn,
  on,
  onPress,
  ref,
  testID,
}: {
  name: string;
  line: string;
  warn: string | null;
  on: boolean;
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  return (
    <PressRow
      ref={ref}
      on={on}
      onPress={onPress}
      label={`${name}, ${line}${warn == null ? '' : `. ${warn}`}`}
      testID={testID}
    >
      <View style={styles.grow}>
        <Text size={16} weight="semibold">
          {name}
        </Text>
        <Text size={14} style={styles.secondary}>
          {line}
        </Text>
        {warn != null && <MarkLine kind="notyet" ink={tokens.colorAttention} words={warn} dashed />}
      </View>
      <View style={[styles.radio, on && styles.radioOn]} />
    </PressRow>
  );
}

function PressRow({
  on,
  onPress,
  label,
  ref,
  testID,
  children,
}: {
  on: boolean;
  onPress: () => void;
  label: string;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[styles.choice, on && styles.choiceOn]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceXl, gap: tokens.spaceLg },
  bodyPhone: { padding: tokens.spaceLg },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText },
  head: { gap: tokens.spaceMd },
  headWide: { flexDirection: 'row', alignItems: 'flex-start' },
  doorFull: { alignSelf: 'stretch' },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spaceMd,
    paddingVertical: tokens.spaceXxs,
    marginTop: tokens.spaceXs,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    marginTop: tokens.spaceXs,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  ringOff: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  block: { gap: tokens.spaceMd },
  column: { gap: tokens.spaceLg },
  side: { flexDirection: 'row', gap: tokens.spaceLg, alignItems: 'flex-start' },
  sideMain: { flex: 1, minWidth: 0 },
  sidePanel: { width: 340 },
  lists: { gap: tokens.spaceLg },
  section: { gap: tokens.spaceSm },
  card: {
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    gap: tokens.spaceXs,
  },
  noNumber: { gap: tokens.spaceXs, alignItems: 'flex-end' },
  stations: { gap: tokens.spaceSm },
  sheetScroll: { flexShrink: 1 },
  sheet: { gap: tokens.spaceMd, padding: tokens.spaceXl },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  form: { gap: tokens.spaceMd },
  group: { gap: tokens.spaceXs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  amberNote: {
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAttentionTint,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
  },
  choices: { gap: tokens.spaceXs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceMd,
    minHeight: tokens.sizeHit + 8,
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
  },
  choiceOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
  },
  radioOn: { borderWidth: 7, borderColor: tokens.colorAccent },
});
