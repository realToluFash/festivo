import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { EventNotFound } from '../../components/Events.tsx';
import { EventThumb } from '../../components/EventThumb.tsx';
import { Notice } from '../../components/Notice.tsx';
import { OrgMark } from '../../components/OrgMark.tsx';
import { OrgPill } from '../../components/OrgPill.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { meshFor } from '../../kit/today.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { DemoScreen } from '../DemoScreen.tsx';
import { InsideEvent, type MoreGroup, type Shown } from '../doorCode/Inside.tsx';
import { type DropFrame, frameFor, openerLabel } from '../OrgSwitcherModel.ts';
import { Marks } from './Marks.tsx';
import {
  afterRequest,
  backTo,
  choose,
  hereEvent,
  inOrder,
  JOAO,
  listsEvents,
  MEMBER,
  NOW,
  type Outside,
  type OutsideEvent,
  outsideOf,
  type OutsideState,
  outsideStateOf,
  rowLabel,
  rowLine,
  underWay,
  VENUES,
  wallDay,
  wallTime,
  WORDS,
} from './OutsideModel.ts';
import { OutsideSwitcher } from './OutsideSwitcher.tsx';

type Screen =
  | { kind: 'switcher' }
  | { kind: 'inside'; event: OutsideEvent; at: 'overview' | 'people'; more: boolean }
  | { kind: 'notFound'; from: OutsideEvent };

const LATER = {
  invitation: 'Invitations have their own design.',
  create: 'Create organisation has its own design.',
  place: 'Switching organisation has its own design.',
  today: 'The demo’s Today has Ire Events’ sample only.',
};

export function OutsideEventsRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = outsideStateOf(state);

  return <OutsideEvents key={shown} state={shown} />;
}

function shownOf(event: OutsideEvent): Shown {
  return {
    id: event.id,
    name: event.name,
    day: wallDay(event.startsAt),
    starts: wallTime(event.startsAt),
    ends: { date: wallDay(event.endsAt), time: wallTime(event.endsAt) },
    venue: VENUES[event.id] ?? '',
    job: event.jobLabel,
  };
}

function OutsideEvents({ state }: { state: OutsideState }) {
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const [outside, setOutside] = useState(() => outsideOf(state));
  const [screen, setScreen] = useState<Screen>(() => {
    const here = hereEvent(outsideOf(state));

    return here == null
      ? { kind: 'switcher' }
      : { kind: 'inside', event: here, at: 'overview', more: true };
  });

  const enter = (event: OutsideEvent, more = false) => {
    setOutside((now) => ({ ...now, here: event.id }));
    setScreen({ kind: 'inside', event, at: 'overview', more });
  };

  if (screen.kind === 'switcher')
    return <SwitcherPage outside={outside} locale={locale} onEvent={(event) => enter(event)} />;

  if (screen.kind === 'notFound')
    return (
      <NotFound
        member={outside.member}
        from={screen.from}
        onBack={() => {
          setOutside(afterRequest);
          if (outside.member) router.push('/demo/events');
          else enter(screen.from, true);
        }}
      />
    );

  const { event } = screen;
  const groups = groupsOf(outside, locale, (picked) => {
    const choice = choose(outside, picked);

    if (choice.kind === 'open') enter(choice.event);
    else if (choice.kind === 'notFound') setScreen({ kind: 'notFound', from: event });
  });

  return (
    <InsideEvent
      key={event.id}
      at={screen.at}
      role={event.role}
      who={outside.member ? MEMBER : JOAO}
      locale={locale}
      moreAtStart={screen.more}
      shown={shownOf(event)}
      groups={groups}
      onAt={(at) => setScreen({ ...screen, at, more: false })}
      onSignOut={() => router.replace('/demo')}
      onAccount={() =>
        router.push(outside.member ? '/demo/settings/account' : '/demo/settings/account?as=noOrg')
      }
    />
  );
}

function groupsOf(
  outside: Outside,
  locale: string,
  onEvent: (event: OutsideEvent) => void,
): MoreGroup[] {
  const places: MoreGroup = {
    key: 'organisations',
    title: WORDS.yourOrganisations,
    rows: outside.places.map((place) => ({
      key: place.id,
      title: place.name,
      line: place.role,
      lead: <OrgMark id={place.id} name={place.name} side={40} />,
      label: `${place.name}. ${place.role}`,
      onPress: () => {
        if (place.id !== outside.current) return LATER.today;

        router.push('/demo/today');

        return null;
      },
    })),
  };
  const events: MoreGroup = {
    key: 'events',
    title: WORDS.yourEvents,
    rows: inOrder(outside.events, NOW).map((event) => {
      const marks = { underWay: underWay(event, NOW), here: event.id === outside.here };

      return {
        key: event.id,
        title: event.name,
        line: rowLine(event, locale),
        lead: (
          <EventThumb
            event={{ id: event.id, mesh: meshFor(event.id), photo: null }}
            side={40}
            radius={12}
          />
        ),
        below: <Marks {...marks} />,
        label: rowLabel(event, locale, marks),
        onPress: () => {
          onEvent(event);

          return null;
        },
      };
    }),
  };

  return [...(outside.member ? [places] : []), ...(listsEvents(outside) ? [events] : [])];
}

/** The product's not-found notice; with no organisation there are no Events to go back to, so back is to the event it came from. */
function NotFound({
  member,
  from,
  onBack,
}: {
  member: boolean;
  from: OutsideEvent;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DemoScreen>
      {member ? (
        <EventNotFound onBack={onBack} />
      ) : (
        <View style={styles.stack} testID="outside.notFound">
          <Notice
            tone="quiet"
            mark={tokens.marks.info.glyph}
            title={t('eventsScreen.notFound')}
            heading
          />
          <SecondaryButton
            label={backTo(from.name)}
            onPress={onBack}
            testID="outside.notFound.back"
          />
        </View>
      )}
    </DemoScreen>
  );
}

function SwitcherPage({
  outside,
  locale,
  onEvent,
}: {
  outside: Outside;
  locale: string;
  onEvent: (event: OutsideEvent) => void;
}) {
  const { t } = useTranslation();
  const phone = useLayout().kind === 'phone';
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const pill = useRef<ViewInstance>(null);
  const opened = useRef(false);
  const [frame, setFrame] = useState<DropFrame | null>(null);
  const [told, setTold] = useState<string | null>(null);
  const current = outside.places.find((place) => place.id === outside.current);
  const count = outside.invitations.length;

  if (current == null) return null;

  const open = () =>
    pill.current?.measureInWindow((x, y, width, height) =>
      setFrame(
        frameFor({
          opener: { x, y, width, height },
          window,
          insets: { bottom: insets.bottom },
          phone,
        }),
      ),
    );
  const close = () => setFrame(null);
  const tell = (words: string) => {
    close();
    setTold(words);
  };

  return (
    <View
      style={[
        styles.page,
        {
          paddingTop: insets.top + tokens.spaceLg,
          paddingHorizontal: phone ? tokens.spaceXxl : tokens.space5xl,
        },
      ]}
    >
      <View
        style={styles.opener}
        onLayout={() => {
          if (opened.current) return;
          opened.current = true;
          open();
        }}
      >
        <OrgPill
          ref={pill}
          id={current.id}
          name={current.name}
          waiting={count > 0 ? t('invitations.count', { count }) : null}
          label={openerLabel(current, count)}
          expanded={frame != null}
          onPress={() => (frame == null ? open() : close())}
          testID="outside.switcher.opener"
        />
      </View>
      {frame != null && (
        <OutsideSwitcher
          frame={frame}
          places={outside.places}
          current={outside.current}
          invitations={outside.invitations}
          events={outside.events}
          locale={locale}
          onClose={close}
          onPlace={() => tell(LATER.place)}
          onInvitation={() => tell(LATER.invitation)}
          onCreate={() => tell(LATER.create)}
          onEvent={(event) => {
            close();
            onEvent(event);
          }}
        />
      )}
      {told != null && (
        <PageToast
          words={told}
          onClose={() => setTold(null)}
          bottom={Math.max(insets.bottom, tokens.spaceLg)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  opener: { alignSelf: 'flex-start' },
  stack: { gap: tokens.spaceMd },
});
