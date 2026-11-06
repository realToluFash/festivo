import {
  EVENT_TYPES,
  type EventType,
  HOSTS_MAXIMUM,
  endMovedLine,
  eventProblems,
  hostProblems,
  keepsLastHost,
  startMoved,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventMesh } from '../Cover.tsx';
import { Glyph } from '../Glyph.tsx';
import { LineIcon } from '../settings/AccountCard.tsx';
import { Pill } from '../settings/parts.tsx';
import {
  type AskProps,
  ChoiceRow,
  FocusedScreen,
  Row,
  RowList,
  TextAction,
} from '../settings/Summary.tsx';
import { MESH_EVENT, PhotoFill } from './EventCard.tsx';
import { type EditPart, type EventDemoState, folded, instantOf, wallOf } from './EventsModel.ts';
import { MomentBox, type Picking, PickerLayer, pick } from './EventsPick.tsx';
import {
  CURRENCIES,
  PHOTO_DESCRIPTION,
  SIX_HOSTS,
  SUGGESTIONS,
  type SampleEvent,
  type Suggestion,
  TYPE_WORDS,
  ZONES,
  meshFor,
} from './EventsSample.ts';
import { W, say, t } from './EventsWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

export interface EditProps {
  open: boolean;
  event: SampleEvent;
  start: EventDemoState | null;
  locale: string;
  opener: Opener;
  onClose: () => void;
  onSaved: (event: SampleEvent) => void;
}

const TITLES: Record<EditPart, string> = {
  dates: W.dates,
  venue: W.venue,
  hosts: W.hostedBy,
  type: W.type,
  currency: W.currency,
  name: W.eventName,
  cover: W.coverPhoto,
};

/** Each part on its own screen: Cancel, the part and Save, which stays off until something changes. */
export function EditScreen({ part, ...edit }: EditProps & { part: EditPart }) {
  switch (part) {
    case 'dates':
      return <DatesEdit {...edit} />;
    case 'venue':
      return <VenueEdit {...edit} />;
    case 'hosts':
      return <HostsEdit {...edit} />;
    case 'type':
      return <TypeEdit {...edit} />;
    case 'currency':
      return <CurrencyEdit {...edit} />;
    case 'name':
      return <NameEdit {...edit} />;
    case 'cover':
      return <CoverEdit {...edit} />;
  }
}

function EditShell({
  part,
  verb = W.save,
  changed,
  onSave,
  edit,
  latest,
  over,
  toast,
  children,
}: {
  part: EditPart;
  verb?: string;
  changed: boolean;
  onSave: () => void;
  edit: EditProps;
  latest?: AskProps | null;
  over?: { layer: ReactNode; onClose: () => void } | null;
  toast?: { words: string; onClose: () => void } | null;
  children: ReactNode;
}) {
  const [discarding, setDiscarding] = useState(edit.start === 'discard');
  const testID = `event.edit.${part}`;
  const discard: AskProps | null = discarding
    ? {
        title: W.discardTitle,
        line: W.discardLine,
        keep: { label: W.keepEditing, testID: `${testID}.keep` },
        confirm: { label: W.discard, testID: `${testID}.discard`, removes: true },
        onKeep: () => setDiscarding(false),
        onConfirm: edit.onClose,
      }
    : null;

  return (
    <FocusedScreen
      open={edit.open}
      title={TITLES[part]}
      verb={{ label: verb, on: changed, onPress: onSave, testID: `${testID}.save` }}
      onCancel={() => (changed ? setDiscarding(true) : edit.onClose())}
      cancelTestID={`${testID}.cancel`}
      opener={edit.opener}
      ask={latest ?? discard}
      over={over ?? null}
      toast={toast ?? null}
      testID={testID}
    >
      {children}
    </FocusedScreen>
  );
}

export function AlertLine({ text }: { text: string }) {
  return (
    <View style={styles.alert} accessibilityRole="alert">
      <View style={styles.alertMark}>
        <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.2} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.broken]}>
        {text}
      </Text>
    </View>
  );
}

/** sc-4330, under each part guests see: what saving tells them is not built yet. */
function TellGuests() {
  return (
    <View style={styles.tell}>
      <Text size={13.5} weight="semibold" style={styles.secondary}>
        {W.tellGuests}
      </Text>
      <AcPill words={W.tellGuestsPill} />
    </View>
  );
}

export function AcPill({ words }: { words: string }) {
  return (
    <View style={styles.acPill}>
      <Text size={12.5} weight="semibold" style={styles.secondary}>
        {words}
      </Text>
    </View>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.labelled}>
      <Text size={14} weight="semibold">
        {label}
      </Text>
      {children}
    </View>
  );
}

const CHANGED = {
  start: { date: '2026-11-04', time: '18:00' },
  end: { date: '2026-11-06', time: '15:00' },
};

function DatesEdit(edit: EditProps) {
  const { event, start, locale } = edit;
  const saved = {
    start: wallOf(event.startsAt, event.timeZone),
    end: wallOf(event.endsAt, event.timeZone),
  };
  const sample =
    start === 'datesChanged' ||
    start === 'discard' ||
    start === 'changedElsewhere' ||
    start === 'showLatest'
      ? CHANGED
      : start === 'datesError'
        ? { start: saved.start, end: { date: '2026-11-05', time: '15:00' } }
        : saved;
  const [from, setFrom] = useState(sample.start);
  const [to, setTo] = useState(sample.end);
  const [zone, setZone] = useState(event.timeZone);
  const [endChosen, setEndChosen] = useState(start === 'datesError');
  const [moved, setMoved] = useState<string | null>(() =>
    sample === CHANGED
      ? endMovedLine(draftOf(event, saved), draftOf(event, CHANGED), locale, t)
      : null,
  );
  const [zonesOpen, setZonesOpen] = useState(false);
  const [elsewhere, setElsewhere] = useState(
    start === 'changedElsewhere' || start === 'showLatest',
  );
  const [showing, setShowing] = useState(start === 'showLatest');
  const [picking, setPicking] = useState<Picking | null>(null);
  const draft = draftOf(event, { start: from, end: to });
  const wrong = eventProblems(draft, zone).some((problem) => problem.problem === 'endBeforeStart');
  const changed =
    zone !== event.timeZone ||
    [from.date, from.time, to.date, to.time].join() !==
      [saved.start.date, saved.start.time, saved.end.date, saved.end.time].join();

  useReadOut(moved);

  const pickStart = (mode: 'date' | 'time') =>
    pick(
      {
        title: say.timesIn(zone),
        mode,
        field: from,
        take: (next) => {
          const after = startMoved(
            draft,
            { startDate: next.date, startTime: next.time },
            endChosen,
            zone,
          );
          setFrom(next);
          setTo({ date: after.endDate, time: after.endTime });
          setMoved(endMovedLine(draft, after, locale, t));
        },
      },
      setPicking,
    );
  const pickEnd = (mode: 'date' | 'time') =>
    pick(
      {
        title: say.timesIn(zone),
        mode,
        field: to,
        take: (next) => {
          setTo(next);
          setEndChosen(true);
          setMoved(null);
        },
      },
      setPicking,
    );
  const save = () => {
    if (wrong) return;
    edit.onSaved({
      ...event,
      timeZone: zone,
      startsAt: instantOf(from.date, from.time, zone),
      endsAt: instantOf(to.date, to.time, zone),
    });
  };

  return (
    <EditShell
      part="dates"
      changed={changed}
      onSave={save}
      edit={edit}
      latest={
        showing
          ? {
              title: W.showLatestTitle,
              line: W.showLatestBody,
              keep: { label: W.keepEditing, testID: 'event.edit.dates.latest.keep' },
              confirm: {
                label: W.showLatest,
                testID: 'event.edit.dates.latest.show',
                removes: true,
              },
              onKeep: () => setShowing(false),
              onConfirm: () => {
                setFrom(saved.start);
                setTo(saved.end);
                setZone(event.timeZone);
                setMoved(null);
                setElsewhere(false);
                setShowing(false);
              },
            }
          : null
      }
      over={
        picking == null
          ? null
          : {
              layer: (
                <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
              ),
              onClose: () => setPicking(null),
            }
      }
    >
      {elsewhere && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={W.changedElsewhere}
          action={{
            label: W.showLatest,
            onPress: () => setShowing(true),
            testID: 'event.edit.dates.latest',
          }}
          announce
        />
      )}
      <Labelled label={W.starts}>
        <View style={styles.pair}>
          <MomentBox
            label={`${W.starts}, ${W.date}`}
            mode="date"
            value={from.date}
            locale={locale}
            onPress={() => pickStart('date')}
            testID="event.edit.dates.startDate"
          />
          <MomentBox
            label={`${W.starts}, ${W.time}`}
            mode="time"
            value={from.time}
            locale={locale}
            width={104}
            onPress={() => pickStart('time')}
            testID="event.edit.dates.startTime"
          />
        </View>
      </Labelled>
      <Labelled label={W.ends}>
        <View style={styles.pair}>
          <MomentBox
            label={`${W.ends}, ${W.date}`}
            mode="date"
            value={to.date}
            locale={locale}
            wrong={wrong}
            onPress={() => pickEnd('date')}
            testID="event.edit.dates.endDate"
          />
          <MomentBox
            label={`${W.ends}, ${W.time}`}
            mode="time"
            value={to.time}
            locale={locale}
            width={104}
            wrong={wrong}
            onPress={() => pickEnd('time')}
            testID="event.edit.dates.endTime"
          />
        </View>
      </Labelled>
      {wrong ? (
        <AlertLine text={W.endBeforeStart} />
      ) : moved != null ? (
        <Text size={13.5} weight="semibold">
          {moved}
        </Text>
      ) : (
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {W.endsHint}
        </Text>
      )}
      <Labelled label={W.timeZone}>
        <Pressable
          onPress={() => setZonesOpen((now) => !now)}
          style={({ pressed }) => [styles.select, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: zonesOpen }}
          accessibilityLabel={`${W.timeZone}, ${zone}`}
          testID="event.edit.dates.zone"
        >
          <Text size={16} weight="medium" accessible={false} style={styles.grow}>
            {zone}
          </Text>
          <Glyph name="down" size={18} ink={tokens.colorInkSecondary} weight={2.3} />
        </Pressable>
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {say.timesIn(zone)}
        </Text>
      </Labelled>
      {zonesOpen && (
        <View accessibilityRole="radiogroup">
          {ZONES.map((one) => (
            <ChoiceRow
              key={one}
              title={one}
              on={one === zone}
              onPress={() => {
                setZone(one);
                setZonesOpen(false);
              }}
              testID={`event.edit.dates.zone.${one}`}
            />
          ))}
        </View>
      )}
      <TellGuests />
    </EditShell>
  );
}

function draftOf(
  event: SampleEvent,
  at: { start: { date: string; time: string }; end: { date: string; time: string } },
) {
  return {
    name: event.name,
    type: event.type,
    startDate: at.start.date,
    startTime: at.start.time,
    endDate: at.end.date,
    endTime: at.end.time,
  };
}

function VenueEdit(edit: EditProps) {
  const { event, start } = edit;
  const eko = SUGGESTIONS[0];
  const sample =
    start === 'venueSuggestions'
      ? { name: '', address: 'Eko Hot' }
      : start === 'venueZone' && eko != null
        ? { name: eko.name, address: eko.address }
        : start === 'venueDown'
          ? { name: '', address: '12 Rua' }
          : { name: event.venue?.name ?? '', address: event.venue?.address ?? '' };
  const [name, setName] = useState(sample.name);
  const [address, setAddress] = useState(sample.address);
  const [chosen, setChosen] = useState<Suggestion | null>(
    start === 'venueZone' ? (eko ?? null) : null,
  );
  const [zone, setZone] = useState(event.timeZone);
  const [offer, setOffer] = useState(start === 'venueZone');
  const down = start === 'venueDown';
  const looking = chosen == null && !down && folded(address).length >= 3;
  const found = looking
    ? SUGGESTIONS.filter((one) => folded(one.name).includes(folded(address)))
    : [];
  const changed =
    name !== (event.venue?.name ?? '') ||
    address !== (event.venue?.address ?? '') ||
    zone !== event.timeZone;
  const words = found.length > 0 ? say.suggestionsBelow(found.length) : null;

  useReadOut(words);

  return (
    <EditShell
      part="venue"
      changed={changed}
      onSave={() =>
        edit.onSaved({
          ...event,
          timeZone: zone,
          venue:
            name.trim() === '' && address.trim() === ''
              ? null
              : {
                  name: name.trim(),
                  address: address.trim(),
                  place: name.trim() || address.trim(),
                },
        })
      }
      edit={edit}
    >
      <Field label={`${W.venueName} · ${W.optional}`}>
        <TextField
          value={name}
          onChangeText={setName}
          autoCorrect={false}
          accessibilityLabel={`${W.venueName} · ${W.optional}`}
          testID="event.edit.venue.name"
        />
      </Field>
      <Field
        label={`${W.address} · ${W.optional}`}
        help={down || words != null ? undefined : W.venueAddressHint}
      >
        <TextField
          value={address}
          autoFocus={start === 'venueSuggestions' || down}
          onChangeText={(typed) => {
            setAddress(typed);
            setChosen(null);
            setOffer(false);
          }}
          autoCorrect={false}
          accessibilityLabel={`${W.address} · ${W.optional}`}
          testID="event.edit.venue.address"
        />
      </Field>
      {down && <AlertLine text={W.venueLookupDown} />}
      {words != null && (
        <>
          <Text size={13.5} weight="medium" style={styles.secondary}>
            {words}
          </Text>
          <RowList
            items={found.map((one) => ({
              key: one.name,
              inset: 40,
              row: (
                <Row
                  title={one.name}
                  line={one.address}
                  lead={<LineIcon name="pin" />}
                  onPress={() => {
                    setName(one.name);
                    setAddress(one.address);
                    setChosen(one);
                    setOffer(one.timeZone !== zone);
                  }}
                  testID={`event.edit.venue.suggestion.${one.name}`}
                />
              ),
            }))}
          />
        </>
      )}
      {offer && chosen != null && (
        <Notice
          tone="quiet"
          mark="i"
          body={say.zoneOffer(chosen.timeZone)}
          announce
          actions={
            <View style={styles.offer}>
              <TextAction
                label={say.zoneUse(chosen.timeZone)}
                onPress={() => {
                  setZone(chosen.timeZone);
                  setOffer(false);
                }}
                testID="event.edit.venue.useZone"
              />
              <TextAction
                label={say.zoneKeep(zone)}
                onPress={() => setOffer(false)}
                testID="event.edit.venue.keepZone"
              />
            </View>
          }
        />
      )}
      {!looking && !offer && <TellGuests />}
    </EditShell>
  );
}

interface Host {
  key: number;
  name: string;
}

function HostsEdit(edit: EditProps) {
  const { event, start } = edit;
  const [hosts, setHosts] = useState<Host[]>(() =>
    (start === 'hostsDuplicate'
      ? ['Adaeze Obi', 'Tunde Bakare', 'Adaeze Obi']
      : start === 'hostsSix'
        ? [...SIX_HOSTS]
        : [...event.hosts]
    ).map((name, key) => ({ key, name })),
  );
  const [next, setNext] = useState(HOSTS_MAXIMUM);
  const [tried, setTried] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const names = hosts.map((host) => host.name);
  const problems = hostProblems(names);
  const kept = keepsLastHost(event, hosts.length);
  const changed = names.join('\n') !== event.hosts.join('\n');

  useReadOut(said);

  const move = (from: number, to: number) => {
    const moved = [...hosts];
    const [one] = moved.splice(from, 1);
    if (one == null) return;
    moved.splice(to, 0, one);
    setHosts(moved);
    setSaid(say.hostMoved(one.name.trim() || say.hostLabel(from + 1), to + 1, moved.length));
  };
  const save = () => {
    if (problems.some((problem) => problem != null)) {
      setTried(true);
      return;
    }
    edit.onSaved({ ...event, hosts: names.map((name) => name.trim()) });
  };

  return (
    <EditShell part="hosts" changed={changed} onSave={save} edit={edit}>
      <Text size={15} weight="medium" style={styles.secondary}>
        {W.hostsExplainer}
      </Text>
      {hosts.map((host, index) => {
        const problem = problems[index];
        const error =
          problem?.problem === 'hostDuplicate'
            ? say.hostDuplicate(problem.name)
            : problem?.problem === 'hostBlank' && tried
              ? W.hostBlank
              : null;
        const named = host.name.trim() || say.hostLabel(index + 1);

        return (
          <View key={host.key} style={styles.host}>
            <View style={styles.hostHead}>
              <Text size={14} weight="semibold" style={styles.grow}>
                {say.hostLabel(index + 1)}
              </Text>
              {!kept && (
                <TextAction
                  label={W.remove}
                  onPress={() => setHosts(hosts.filter((one) => one.key !== host.key))}
                  accessibilityLabel={say.removeNamed(named)}
                  testID={`event.edit.hosts.remove.${index}`}
                />
              )}
            </View>
            <View style={styles.hostRow}>
              <View style={styles.grow}>
                <TextField
                  value={host.name}
                  wrong={error != null}
                  autoFocus={start === 'hostsDuplicate' && index === 2}
                  onChangeText={(typed) =>
                    setHosts(
                      hosts.map((one) => (one.key === host.key ? { ...one, name: typed } : one)),
                    )
                  }
                  autoCapitalize="words"
                  autoCorrect={false}
                  accessibilityLabel={say.hostLabel(index + 1)}
                  testID={`event.edit.hosts.field.${index}`}
                />
              </View>
              {!kept && (
                <>
                  <MoveButton
                    glyph="up"
                    label={say.moveUp(named)}
                    off={index === 0}
                    onPress={() => move(index, index - 1)}
                  />
                  <MoveButton
                    glyph="down"
                    label={say.moveDown(named)}
                    off={index === hosts.length - 1}
                    onPress={() => move(index, index + 1)}
                  />
                </>
              )}
            </View>
            {error != null && <AlertLine text={error} />}
          </View>
        );
      })}
      {kept && (
        <Text size={14} weight="medium" style={styles.secondary}>
          {W.lastHost}
        </Text>
      )}
      {hosts.length >= HOSTS_MAXIMUM ? (
        <Text size={14} weight="medium" style={styles.secondary}>
          {W.hostsMost}
        </Text>
      ) : (
        <TextAction
          label={W.addHost}
          glyph="plus"
          onPress={() => {
            setHosts([...hosts, { key: next, name: '' }]);
            setNext(next + 1);
          }}
          testID="event.edit.hosts.add"
        />
      )}
      <TellGuests />
    </EditShell>
  );
}

function MoveButton({
  glyph,
  label,
  off,
  onPress,
}: {
  glyph: 'up' | 'down';
  label: string;
  off: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.move, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={label}
    >
      <Glyph
        name={glyph}
        size={18}
        ink={off ? tokens.colorInkTertiary : tokens.colorInk}
        weight={2.4}
      />
    </Pressable>
  );
}

function TypeEdit(edit: EditProps) {
  const [type, setType] = useState<EventType>(edit.event.type);
  const [typed, setTyped] = useState('');
  const shown = EVENT_TYPES.filter((one) => folded(TYPE_WORDS[one]).includes(folded(typed.trim())));

  return (
    <EditShell
      part="type"
      changed={type !== edit.event.type}
      onSave={() => edit.onSaved({ ...edit.event, type })}
      edit={edit}
    >
      <View accessibilityRole="search">
        <TextField
          value={typed}
          onChangeText={setTyped}
          placeholder={W.searchTypes}
          autoCorrect={false}
          accessibilityLabel={W.searchTypes}
          testID="event.edit.type.search"
        />
      </View>
      <View accessibilityRole="radiogroup">
        {shown.map((one) => (
          <ChoiceRow
            key={one}
            title={TYPE_WORDS[one]}
            on={one === type}
            onPress={() => setType(one)}
            testID={`event.edit.type.${one}`}
          />
        ))}
      </View>
    </EditShell>
  );
}

function CurrencyEdit(edit: EditProps) {
  const refused = edit.start === 'currencyRefused';
  const [code, setCode] = useState(refused ? 'EUR' : edit.event.currency);
  const [refusal, setRefusal] = useState(refused);

  return (
    <EditShell
      part="currency"
      changed={code !== edit.event.currency}
      onSave={() => (refused ? setRefusal(true) : edit.onSaved({ ...edit.event, currency: code }))}
      edit={edit}
    >
      {refusal && (
        <Notice tone="broken" mark={tokens.marks.broken.glyph} body={W.currencyInUse} announce />
      )}
      <View accessibilityRole="radiogroup">
        {CURRENCIES.map((one) => (
          <ChoiceRow
            key={one.code}
            title={`${one.code} · ${one.name}`}
            on={one.code === code}
            onPress={() => setCode(one.code)}
            testID={`event.edit.currency.${one.code}`}
          />
        ))}
      </View>
    </EditShell>
  );
}

function NameEdit(edit: EditProps) {
  const [name, setName] = useState(edit.start === 'nameBlank' ? '' : edit.event.name);
  const blank = name.trim() === '';

  return (
    <EditShell
      part="name"
      changed={name.trim() !== edit.event.name}
      onSave={() => !blank && edit.onSaved({ ...edit.event, name: name.trim() })}
      edit={edit}
    >
      <Field
        label={W.eventName}
        error={blank ? W.nameBlank : null}
        help={blank ? undefined : say.nameCount([...name].length)}
      >
        <TextField
          value={name}
          wrong={blank}
          autoFocus
          maxLength={120}
          onChangeText={setName}
          accessibilityLabel={W.eventName}
          testID="event.edit.name.field"
        />
      </Field>
      <TellGuests />
    </EditShell>
  );
}

type Position = 'top' | 'middle' | 'bottom';

const SHOWING: Record<Position, string> = {
  top: W.showingTop,
  middle: W.showingMiddle,
  bottom: W.showingBottom,
};

function CoverEdit(edit: EditProps) {
  const { event, start } = edit;
  const [photo, setPhoto] = useState(event.photo || start === 'coverPhoto');
  const [refused, setRefused] = useState(start === 'coverRefused');
  const [position, setPosition] = useState<Position>('middle');
  const [described, setDescribed] = useState(
    event.photo || start === 'coverPhoto' ? PHOTO_DESCRIPTION : '',
  );
  const [told, setTold] = useState<string | null>(null);
  const changed =
    photo !== event.photo || position !== 'middle' || (photo && described !== PHOTO_DESCRIPTION);

  return (
    <EditShell
      part="cover"
      verb={W.useThisPhoto}
      changed={changed}
      onSave={() => edit.onSaved({ ...event, photo })}
      edit={edit}
      toast={told == null ? null : { words: told, onClose: () => setTold(null) }}
    >
      <View
        style={styles.preview}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {photo ? (
          <>
            <PhotoFill id="cover-edit" />
            <Glyph name="photo" size={56} ink={tokens.colorInkOnDark} weight={1.6} />
          </>
        ) : (
          <EventMesh event={MESH_EVENT[meshFor(event.id)]} />
        )}
      </View>
      {photo ? (
        <>
          <TextAction
            label={W.changePhoto}
            glyph="camera"
            onPress={() => setTold(say.ownDesign(W.choosingPhoto))}
            testID="event.edit.cover.change"
          />
          <PositionSlider position={position} onPosition={setPosition} />
          <Field
            label={`${W.describe} · ${W.optional}`}
            help={[W.describeHint, say.describeCount([...described].length)]}
          >
            <TextField
              value={described}
              onChangeText={setDescribed}
              multiline
              maxLength={250}
              accessibilityLabel={`${W.describe} · ${W.optional}`}
              testID="event.edit.cover.describe"
            />
          </Field>
          <TextAction
            label={W.removePhoto}
            removes
            consequence={W.removePhotoLine}
            onPress={() => {
              setPhoto(false);
              setDescribed('');
            }}
            testID="event.edit.cover.remove"
          />
        </>
      ) : (
        <>
          {refused ? (
            <Notice tone="broken" mark={tokens.marks.broken.glyph} body={W.coverRefused} announce />
          ) : (
            <Text size={15} weight="medium" style={styles.secondary}>
              {W.coverDefaultLine}
            </Text>
          )}
          <Pill
            label={W.upload}
            glyph="camera"
            onPress={() => {
              setRefused(false);
              setPhoto(true);
              setDescribed('');
            }}
            testID="event.edit.cover.upload"
          />
          <Text size={13.5} weight="medium" style={styles.secondary}>
            {W.accepted}
          </Text>
        </>
      )}
    </EditShell>
  );
}

const POSITIONS: readonly Position[] = ['top', 'middle', 'bottom'];

/** Top to Bottom in three stops, as the board draws it; a screen reader moves it a stop at a time. */
function PositionSlider({
  position,
  onPosition,
}: {
  position: Position;
  onPosition: (position: Position) => void;
}) {
  const at = POSITIONS.indexOf(position);
  const step = (by: number) => {
    const next = POSITIONS[Math.min(2, Math.max(0, at + by))];
    if (next != null) onPosition(next);
  };

  return (
    <View style={styles.slider}>
      <Text size={14} weight="semibold">
        {W.position}
      </Text>
      <View style={styles.track}>
        <View
          style={styles.track}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={W.position}
          accessibilityValue={{ text: SHOWING[position] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(action) =>
            step(action.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
          testID="event.edit.cover.position"
        >
          <View style={styles.rail} />
          <View style={styles.stops}>
            {POSITIONS.map((one) => (
              <View key={one} style={styles.stop}>
                {one === position && <View style={styles.knob} />}
              </View>
            ))}
          </View>
        </View>
        <View
          style={styles.stops}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {POSITIONS.map((one) => (
            <Pressable key={one} onPress={() => onPosition(one)} style={styles.stop} />
          ))}
        </View>
      </View>
      <View style={styles.ends}>
        <Text size={13.5} weight="medium" style={[styles.grow, styles.secondary]}>
          {W.top}
        </Text>
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {W.bottom}
        </Text>
      </View>
      <Text size={13.5} weight="medium" style={styles.secondary}>
        {SHOWING[position]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBroken },
  pressed: { opacity: tokens.opacityPressed },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  alertMark: { paddingTop: tokens.spaceHair },
  tell: { gap: tokens.spaceXs, alignItems: 'flex-start' },
  acPill: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceMd,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    borderRadius: 13,
    backgroundColor: tokens.colorCard,
  },
  labelled: { gap: 7 },
  pair: { flexDirection: 'row', gap: tokens.spaceSm },
  select: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    borderRadius: 14,
  },
  offer: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXxl },
  host: { gap: tokens.spaceHair },
  hostHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  move: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: { gap: tokens.spaceXxs },
  track: { height: tokens.sizeHit, justifyContent: 'center' },
  rail: { height: 6, borderRadius: 3, backgroundColor: tokens.colorNeutralFill },
  stops: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -tokens.spaceSm,
  },
  stop: { width: tokens.sizeHit, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.raised.ios,
  },
  ends: { flexDirection: 'row' },
});
