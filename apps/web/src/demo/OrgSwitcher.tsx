import type { PausedOrganisation } from '@soirely/api-client';
import { initials } from '@soirely/domain';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router';

import { leaveMenu } from '../leaving.ts';
import { CreateWalk } from './CreateOrg.tsx';
import { type Walk, freshWalk, isCreateState, walkOf } from './createOrg.ts';
import { AccessPaused as ProductAccessPaused } from '../components/AccessPaused.tsx';
import { focusWhenFree } from '../layers.ts';
import { Notice } from '../components/Notice.tsx';
import {
  InvitationActions,
  InvitationAnswer,
  JoinedAnswer,
  type MenuTile,
  OfferAnswer,
  OrgMenu,
  type PanelTools,
} from '../components/OrgMenu.tsx';
import { OrgPill } from '../components/OrgPill.tsx';
import { Switched as ProductSwitched } from '../components/Switched.tsx';
import { ManagedBanner } from './managed.tsx';
import { SAMPLE } from './rules.ts';
import {
  BLUEBIRD,
  OFFER,
  PAUSED,
  type Place,
  type Where,
  NEW_PLACE,
  ask,
  askToOpen,
  colourArrived,
  create,
  currentPlace,
  dayOf,
  decline,
  isSwitcherState,
  join,
  notNow,
  openerLabel,
  openingOf,
  switchTo,
  useWhere,
  waiting,
} from './switcher.ts';
import type { Tell } from '../components/SettingsParts.tsx';
import './today.css';
import './switcher.css';

interface Opening {
  panel: string | null;
  query: string;
  kept: readonly string[];
}

/** From no organisation the walk is the page's own, and its landing focuses the notice. */
function alone(params: URLSearchParams): boolean {
  return params.get('orgs') === 'none';
}

function switchedLine(name: string): string {
  return `Now working in ${name}.`;
}

function invitationsLine(count: number): string {
  return count === 1 ? '1 invitation' : `${count} invitations`;
}

/** The sidebar's organisation button, and the menu of places it drops (OrgSwitcher-B-Places-Web, page 29). Pages with no notice of their own say a switch in the toast. */
export function OrgSwitcher({ tell, toast = false }: { tell: Tell; toast?: boolean }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const [first, setFirst] = useState<Opening | null>(() => {
    const raw = params.get('switcher');
    if (!isSwitcherState(raw) || raw === 'closed') return null;

    const answered = raw === 'declined' || raw === 'expired' || raw === 'withdrawn';

    return { ...openingOf(raw), kept: answered ? [BLUEBIRD] : [] };
  });
  const where = useWhere();
  const [open, setOpen] = useState(first != null);
  const [walk, setWalk] = useState<Walk | null>(() => {
    const raw = params.get('create');

    return isCreateState(raw) && !alone(params) ? walkOf(raw, t) : null;
  });
  const [landed] = useState(() => params.get('create') === 'created' && !alone(params));
  const [seen, setSeen] = useState(where.opens);
  const [into, setInto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const back = useRef(false);
  const current = currentPlace(where);
  const count = waiting(where).length;

  if (where.opens !== seen) {
    setSeen(where.opens);
    setOpen(true);
    setInto(true);
  }

  const close = useCallback((focusBack: boolean) => {
    back.current = focusBack;
    setOpen(false);
    setFirst(null);
    setInto(false);
  }, []);

  useLayoutEffect(() => {
    const shown = menu.current;
    const parent = container.current;
    if (!open || shown == null || parent == null) return;

    return () => leaveMenu(shown, parent);
  }, [open]);

  useLayoutEffect(() => {
    if (open || !back.current) return;

    back.current = false;
    button.current?.focus();
  });

  useEffect(() => {
    if (landed) focusWhenFree(() => button.current);
  }, [landed]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: MouseEvent): void => {
      if (container.current?.contains(event.target as Node)) return;

      close(false);
      window.setTimeout(() => {
        if (document.activeElement == null || document.activeElement === document.body)
          button.current?.focus();
      }, 0);
    };
    const escape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') close(true);
    };

    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);

    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, close]);

  function pick(place: Place): void {
    const stays = where.paused ? place.id === PAUSED.id : place.id === where.current;

    close(true);
    if (stays) return;

    switchTo(place, pathname);
    if (toast) tell(switchedLine(place.name));
  }

  function created(): void {
    setWalk(null);
    create(NEW_PLACE, pathname, false);
    if (toast) tell(switchedLine(NEW_PLACE.name));
    focusWhenFree(() => button.current);
  }

  return (
    <div
      ref={container}
      className="sw"
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (open && to != null && !event.currentTarget.contains(to)) close(false);
      }}
    >
      <OrgPill
        ref={button}
        id={current.id}
        name={current.name}
        label={openerLabel(current, count)}
        waiting={count > 0 ? invitationsLine(count) : null}
        open={open}
        overTile={
          where.arrived === current.id && (
            <span className="sw-was" onAnimationEnd={colourArrived}>
              {initials(current.name)}
            </span>
          )
        }
        onClick={() => (open ? close(true) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' || open) return;

          event.preventDefault();
          setOpen(true);
          setInto(true);
        }}
      />
      {open && (
        <Menu
          menu={menu}
          where={where}
          anchor={button}
          start={first}
          into={into}
          onPick={pick}
          onCreate={() => {
            close(false);
            setWalk(freshWalk());
          }}
        />
      )}
      {walk != null && (
        <CreateWalk
          start={walk}
          onClose={() => {
            setWalk(null);
            focusWhenFree(() => button.current);
          }}
          onCreated={created}
        />
      )}
    </div>
  );
}

function Menu({
  menu,
  where,
  anchor,
  start,
  into,
  onPick,
  onCreate,
}: {
  menu: RefObject<HTMLDivElement | null>;
  where: Where;
  anchor: RefObject<HTMLButtonElement | null>;
  start: Opening | null;
  into: boolean;
  onPick: (place: Place) => void;
  onCreate: () => void;
}) {
  const [kept, setKept] = useState<readonly string[]>(start?.kept ?? []);
  const [askedHere, setAskedHere] = useState(false);
  const others: MenuTile[] = [
    ...(where.offer != null
      ? [{ kind: 'offer', id: OFFER.id, name: OFFER.name } satisfies MenuTile]
      : []),
    ...where.invitations
      .filter((invitation) => {
        const answer = where.answers[invitation.id];
        if (answer === 'joined') return false;

        return (
          answer == null ||
          answer === 'failed' ||
          answer === 'busy' ||
          answer === 'managed' ||
          kept.includes(invitation.id)
        );
      })
      .map((invitation): MenuTile => ({
        kind: 'invitation',
        id: invitation.id,
        name: invitation.name,
        role: invitation.role,
      })),
  ];

  function answer(tile: MenuTile, tools: PanelTools): ReactNode {
    if (tile.kind === 'offer')
      return (
        <OfferAnswer
          name={OFFER.name}
          domain={OFFER.domain}
          email={SAMPLE.email}
          standing={where.offer ?? 'unasked'}
          askedHere={askedHere}
          onAsk={() => {
            setAskedHere(true);
            tools.land('panel');
            ask();
          }}
          onNotNow={() => {
            tools.land('more');
            tools.show(null);
            notNow();
          }}
        />
      );

    if (tile.kind === 'place') {
      const place = where.places.find((one) => one.id === tile.id);

      return (
        place != null && (
          <JoinedAnswer name={place.name} role={place.role} onOpen={() => onPick(place)} />
        )
      );
    }

    const invitation = where.invitations.find((one) => one.id === tile.id);
    if (invitation == null) return null;

    const said = where.answers[invitation.id];

    return (
      <InvitationAnswer
        name={invitation.name}
        line={`Invitation from ${invitation.inviter} · ${invitation.role}`}
        until={`Works until ${dayOf(invitation.until)}`}
      >
        {said === 'managed' ? (
          <ManagedBanner level={3} />
        ) : said === 'expired' ? (
          <Notice kind="attention" lands>
            <strong>Expired</strong> This invitation has expired. Ask {invitation.inviter} to send a
            new one.
          </Notice>
        ) : said === 'withdrawn' ? (
          <Notice kind="quiet" lands>
            <strong>Withdrawn</strong> This invitation was withdrawn by {invitation.name}. If you
            think this is a mistake, ask the person who invited you.
          </Notice>
        ) : said === 'declined' ? (
          <Notice kind="quiet" lands>
            You declined. {invitation.inviter} will see that you said no.
          </Notice>
        ) : (
          <InvitationActions
            name={invitation.name}
            note={`Declining tells ${invitation.inviter} you said no. Nothing else changes.`}
            failed={said === 'failed'}
            busy={said === 'busy' ? 'accept' : null}
            onAccept={() => {
              tools.land('panel');
              join(invitation);
            }}
            onDecline={() => {
              tools.land('panel');
              setKept((now) => [...now, invitation.id]);
              decline(invitation);
            }}
          />
        )}
      </InvitationAnswer>
    );
  }

  return (
    <OrgMenu
      menu={menu}
      anchor={anchor}
      places={where.places}
      current={where.paused ? null : where.current}
      others={others}
      start={start}
      into={into}
      answer={answer}
      onPick={(picked) => {
        const place = where.places.find((one) => one.id === picked.id);
        if (place != null) onPick(place);
      }}
      onCreate={onCreate}
    />
  );
}

/** The product's "Now working in" notice, on the page the switch happened on, gone once the person moves on. */
export function Switched() {
  const where = useWhere();
  const { pathname } = useLocation();

  if (where.switched == null || where.switched.at !== pathname) return null;

  return (
    <ProductSwitched
      key={where.switched.name}
      name={where.switched.name}
      takesFocus={where.switched.takesFocus === true}
    />
  );
}

const PAUSED_SAMPLE: PausedOrganisation = {
  id: PAUSED.id,
  name: PAUSED.name,
  countryCode: 'ES',
  currency: 'EUR',
  timezone: 'Europe/Madrid',
  contactAddress: '',
  locale: 'es',
  suspension: {
    reason: 'address_gone',
    domain: PAUSED.domain,
    since: { at: PAUSED.since, written: dayOf(PAUSED.since) },
    removesAt: null,
    onlyOwner: false,
  },
  ownerClaim: null,
};

/** The product's AccessPaused, standing in for the page while access to the organisation is paused. */
export function AccessPaused() {
  const where = useWhere();

  return (
    <ProductAccessPaused
      paused={PAUSED_SAMPLE}
      others={where.places.filter((place) => place.id !== PAUSED.id)}
      account="/demo/settings/account"
      onSwitch={askToOpen}
      onChoose={askToOpen}
    />
  );
}
