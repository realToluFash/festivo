import { router, usePathname } from 'expo-router';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { arrive } from '../components/OrgMark.tsx';
import { OrgDropDown } from '../components/OrgDropDown.tsx';
import { SETTLED_MS } from '../components/Screen.tsx';
import { type Switched, SwitchedProvider } from '../components/SwitchedNotice.tsx';
import type { Tell } from '../components/TodayParts.tsx';
import type { OrgOpening } from '../components/todayShell.ts';
import { useLayout } from '../layout/useLayout.ts';
import {
  type CreateState,
  SAMPLE_FOUNDED,
  type Walk,
  foundedPlace,
  freshWalk,
  walkFor,
} from './createOrg/CreateWalk.ts';
import { CreateWalkWindow, type WalkOpening, deviceNow } from './createOrg/CreateWalkWindow.tsx';
import { ManagedBanner } from './Managed.tsx';
import {
  type DropFrame,
  type Place,
  SW,
  type Session,
  type SwitcherState,
  VIEWER,
  answer,
  ask,
  currentPlace,
  expand,
  founded,
  frameFor,
  notNow,
  openerLabel,
  pick,
  placeOf,
  sessionFor,
  settled,
  waitingOf,
  withoutPlaces,
} from './OrgSwitcherModel.ts';

const store = {
  session: sessionFor('populated'),
  listeners: new Set<() => void>(),
};

function subscribe(listener: () => void) {
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

function setSession(next: Session) {
  store.session = next;
  store.listeners.forEach((listener) => listener());
}

function useSession(): Session {
  return useSyncExternalStore(subscribe, () => store.session);
}

export type OpenerRef = RefObject<ViewInstance | null>;

interface Switcher {
  register: (opener: OpenerRef, primary: boolean) => () => void;
  show: (opener: OpenerRef) => void;
  openedBy: OpenerRef | null;
  startWalk: (opener: OpenerRef) => void;
  registerStart: (opener: OpenerRef) => () => void;
}

const SwitcherContext = createContext<Switcher | null>(null);

function useSwitcher(): Switcher {
  const switcher = useContext(SwitcherContext);
  if (switcher == null) throw new Error('An organisation switcher is drawn inside a demo route.');

  return switcher;
}

const OPEN_AFTER_MS = SETTLED_MS;
const TODAY = '/demo/today';

/** Created from another page: Today says it once it is there. */
const landing: { words: string | null } = { words: null };

/** One drop-down per route, opened from whichever opener was tapped; with ?switcher= it opens on load in that state. */
export function OrgSwitcherProvider({
  state,
  create = null,
  none = false,
  statusBar = 'dark',
  tell,
  children,
}: {
  state: SwitcherState | null;
  /** ?create=: the walk opens on load in that state; `created` lands in the new organisation. */
  create?: CreateState | null;
  /** ?orgs=none: Folake in no organisation. */
  none?: boolean;
  statusBar?: 'light' | 'dark';
  tell: Tell;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const phone = useLayout().kind === 'phone';
  const { width, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const session = useSession();
  const [frame, setFrame] = useState<DropFrame | null>(null);
  const [openedBy, setOpenedBy] = useState<OpenerRef | null>(null);
  const [visit, setVisit] = useState(0);
  const [switched, setSwitched] = useState<Switched | null>(() => {
    if (landing.words != null) return { words: landing.words, focus: true };
    if (create === 'created') return { words: SW.switched(SAMPLE_FOUNDED.name), focus: true };

    return null;
  });
  const [walking, setWalking] = useState<WalkOpening | null>(null);
  const [walkOpen, setWalkOpen] = useState(false);
  const starter = useRef<OpenerRef | null>(null);
  const openers = useRef(new Map<OpenerRef, boolean>());
  const slots = useRef(0);
  const back = useRef<ViewInstance | null>(null);
  const opening = useRef<OpenerRef | null>(null);
  const autoOpened = useRef(false);

  useLayoutEffect(() => {
    if (state == null && create == null && !none) return;
    const base = sessionFor(state ?? 'one');
    const start = none ? withoutPlaces(base) : base;
    if (create === 'created') arrive(SAMPLE_FOUNDED.id);
    setSession(create === 'created' ? founded(start, SAMPLE_FOUNDED) : start);
  }, [state, create, none]);

  useEffect(() => {
    landing.words = null;
  }, []);

  const show = useCallback(
    (opener: OpenerRef, auto = false) => {
      const view = opener.current;
      if (view == null) return;

      view.measureInWindow((x, y, w, h) => {
        if (opening.current !== opener) {
          if (!auto) setSession(settled(store.session));
          setVisit((count) => count + 1);
        }
        opening.current = opener;
        back.current = view;
        setFrame(
          frameFor({
            opener: { x, y, width: w, height: h },
            window: { width, height },
            insets: { bottom },
            phone,
          }),
        );
        setOpenedBy(opener);
      });
    },
    [width, height, bottom, phone],
  );

  useEffect(() => {
    if (state == null || autoOpened.current || (create != null && create !== 'created')) return;
    const wait = setTimeout(() => {
      autoOpened.current = true;
      const first = [...openers.current].find(([ref, primary]) => primary && ref.current != null);
      if (first != null) show(first[0], true);
    }, OPEN_AFTER_MS);

    return () => clearTimeout(wait);
  }, [state, show, create]);

  useEffect(() => {
    if (openedBy == null) return;
    const wait = setTimeout(() => show(openedBy), SETTLED_MS);

    return () => clearTimeout(wait);
    // The opener moves when the window turns, so the drop-down follows it there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  const close = useCallback(() => {
    opening.current = null;
    setOpenedBy(null);
  }, []);
  const register = useCallback((opener: OpenerRef, primary: boolean) => {
    openers.current.set(opener, primary);

    return () => {
      openers.current.delete(opener);
    };
  }, []);
  const slot = useCallback(() => {
    slots.current += 1;

    return () => {
      slots.current -= 1;
    };
  }, []);
  const onPick = useCallback(
    (id: string) => {
      const next = pick(store.session, id);
      setSession(next);
      close();

      const words = SW.switched(currentPlace(next).name);
      if (slots.current > 0) setSwitched({ words });
      else tell(words);
    },
    [tell, close],
  );
  const openWalk = useCallback((opener: OpenerRef | null, walk: Walk, from: CreateState | null) => {
    setWalking((last) => ({ visit: (last?.visit ?? 0) + 1, walk, state: from, opener }));
    setWalkOpen(true);
  }, []);
  const onCreate = useCallback(() => {
    const opener = opening.current;
    close();
    openWalk(opener, freshWalk(deviceNow()), null);
  }, [close, openWalk]);
  const startWalk = useCallback(
    (opener: OpenerRef) => openWalk(opener, freshWalk(deviceNow()), null),
    [openWalk],
  );
  const registerStart = useCallback((opener: OpenerRef) => {
    starter.current = opener;

    return () => {
      if (starter.current === opener) starter.current = null;
    };
  }, []);
  const onCancelWalk = useCallback(() => setWalkOpen(false), []);
  const onCreated = useCallback(
    (walk: Walk) => {
      const place = foundedPlace(walk);
      const fromNoOrganisation = placeOf(store.session) == null;
      setSession(founded(store.session, place));
      arrive(place.id);
      setWalkOpen(false);

      const words = SW.switched(place.name);
      if (pathname !== TODAY) {
        landing.words = words;
        setTimeout(() => router.replace(TODAY), SETTLED_MS);
      } else if (slots.current > 0 || fromNoOrganisation) setSwitched({ words, focus: true });
      else tell(words);
    },
    [pathname, tell],
  );

  useEffect(() => {
    if (create == null || create === 'created') return;
    const wait = setTimeout(() => {
      const first = [...openers.current].find(([ref, primary]) => primary && ref.current != null);
      const walk = walkFor(create, t, phone);
      if (walk != null) openWalk(none ? starter.current : (first?.[0] ?? null), walk, create);
    }, OPEN_AFTER_MS);

    return () => clearTimeout(wait);
    // Once, as the route opens: a turn of the window keeps the walk as it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, none]);

  const switcher = useMemo<Switcher>(
    () => ({ register, show, openedBy, startWalk, registerStart }),
    [register, show, openedBy, startWalk, registerStart],
  );

  return (
    <SwitcherContext.Provider value={switcher}>
      <SwitchedProvider slot={slot} switched={switched}>
        {children}
      </SwitchedProvider>
      {frame != null && (
        <OrgDropDown
          key={visit}
          session={session}
          frame={frame}
          open={openedBy != null}
          back={back}
          email={VIEWER.email}
          managed={
            <ManagedBanner
              onChange={() => {
                close();
                setTimeout(() => router.push('/demo/settings/account'), SETTLED_MS);
              }}
              testID={`switcher.invitation.${session.managed ?? ''}.managed`}
            />
          }
          onClose={close}
          onPick={onPick}
          onCreate={onCreate}
          onExpand={(id) => setSession(expand(store.session, id))}
          onAnswer={(invite, yes) => setSession(answer(store.session, invite.id, yes))}
          onAsk={() => setSession(ask(store.session))}
          onNotNow={() => setSession(notNow(store.session))}
        />
      )}
      {walking != null && (
        <CreateWalkWindow
          key={`walk${walking.visit}`}
          opening={walking}
          open={walkOpen}
          email={VIEWER.email}
          statusBar={statusBar}
          onCancel={onCancelWalk}
          onCreated={onCreated}
        />
      )}
    </SwitcherContext.Provider>
  );
}

/** What an opener draws and does; the one drawn first and in view is what ?switcher= opens from. */
export function useOrgOpener(ref: OpenerRef, primary = true): OrgOpening {
  const { register, show, openedBy } = useSwitcher();
  const session = useSession();
  const place = currentPlace(session);
  const waiting = waitingOf(session);

  useEffect(() => register(ref, primary), [register, ref, primary]);

  return {
    id: place.id,
    name: place.name,
    waiting: waiting > 0 ? SW.count(waiting) : null,
    expanded: openedBy === ref,
    label: openerLabel(place, waiting),
    onPress: () => show(ref),
  };
}

/** The no-organisation screen's Start organisation: it opens the walk, and ?create= opens it from there. */
export function useStartWalk(opener: OpenerRef): () => void {
  const { startWalk, registerStart } = useSwitcher();

  useEffect(() => registerStart(opener), [registerStart, opener]);

  return () => startWalk(opener);
}

/** The organisation being worked in, or null for someone in none. */
export function useCurrentPlace(): Place | null {
  return placeOf(useSession());
}
