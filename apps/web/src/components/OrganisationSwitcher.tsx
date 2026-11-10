import type { InvitationPreview, Membership } from '@soirely/api-client';
import {
  formatDay,
  invitationWording,
  isWaiting,
  refusalBody,
  roleName,
  waitingInvitations,
} from '@soirely/domain';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import type { WaitingInvitations } from '../invitations.ts';
import type { DomainOffer } from '../joinOffers.ts';
import { leaveMenu } from '../leaving.ts';
import { focusStep } from '../stepFocus.ts';
import { Notice } from './Notice.tsx';
import {
  InvitationActions,
  InvitationAnswer,
  JoinedAnswer,
  type MenuPlace,
  type MenuTile,
  OfferAnswer,
  OrgMenu,
  type PanelTools,
} from './OrgMenu.tsx';
import { OrgPill } from './OrgPill.tsx';

export function OrganisationSwitcher({
  current,
  organisations,
  waiting,
  offer = null,
  email = '',
  paused = false,
  opened = 0,
  onSwitch,
  onCreate,
}: {
  current: Membership;
  organisations: readonly Membership[];
  waiting: WaitingInvitations;
  offer?: DomainOffer | null;
  email?: string;
  /** While the account's access is paused, the organisation the session falls back on is not the one on screen. */
  paused?: boolean;
  /** Each change opens the menu from outside it: the paused screen's Switch organisation (sc-564). */
  opened?: number;
  onSwitch: (organisation: Membership) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [into, setInto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const role = roleName(t, current.role);
  const count = waitingInvitations(waiting.invitations, waiting.outcomes);

  const [seen, setSeen] = useState(opened);
  // The organisation the button names once the menu has closed, when focus goes back to it; forgotten once focus goes elsewhere, as when a form with unsaved changes asks first.
  const returnTo = useRef<string | null>(null);

  if (opened !== seen) {
    setSeen(opened);
    setOpen(true);
    setInto(true);
  }

  useLayoutEffect(() => {
    if (open || returnTo.current !== current.id) return;

    returnTo.current = null;
    focusStep(button.current);
  });

  useEffect(() => {
    const elsewhere = (event: FocusEvent): void => {
      if (!container.current?.contains(event.target as Node)) returnTo.current = null;
    };

    document.addEventListener('focusin', elsewhere);

    return () => document.removeEventListener('focusin', elsewhere);
  }, []);

  useLayoutEffect(() => {
    const shown = menu.current;
    const parent = container.current;
    if (!open || shown == null || parent == null) return;

    return () => leaveMenu(shown, parent);
  }, [open]);

  function closeTo(organisationId: string | null): void {
    returnTo.current = organisationId;
    setOpen(false);
    setInto(false);
  }

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | KeyboardEvent): void => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !container.current?.contains(event.target as Node)
      ) {
        closeTo(event instanceof KeyboardEvent ? current.id : null);
      }
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open, current.id]);

  function pick(id: string): void {
    const organisation = organisations.find((one) => one.id === id);
    const stays = !paused && id === current.id;

    closeTo(id);
    if (organisation != null && !stays) onSwitch(organisation);
  }

  const places = organisations.map((organisation): MenuPlace => ({
    id: organisation.id,
    name: organisation.name,
    role: roleName(t, organisation.role),
  }));
  const others: MenuTile[] = [
    ...(offer?.organisation != null
      ? [
          {
            kind: 'offer',
            id: `offer-${offer.organisation.id}`,
            name: offer.organisation.name,
          } satisfies MenuTile,
        ]
      : []),
    ...waiting.invitations
      .filter((invitation) => waiting.outcomes[invitation.id]?.kind !== 'accepted')
      .map((invitation): MenuTile => ({
        kind: 'invitation',
        id: invitation.id,
        name: invitation.organisation.name,
        role: invitation.role == null ? null : roleName(t, invitation.role),
      })),
  ];

  function answer(tile: MenuTile, tools: PanelTools): ReactNode {
    if (tile.kind === 'place')
      return (
        <JoinedAnswer
          name={tile.place.name}
          role={tile.place.role}
          onOpen={() => pick(tile.place.id)}
        />
      );

    if (tile.kind === 'offer')
      return offer == null ? null : <OfferPanel offer={offer} email={email} tools={tools} />;

    const invitation = waiting.invitations.find((one) => one.id === tile.id);

    return (
      invitation != null && (
        <InvitationPanel invitation={invitation} waiting={waiting} tools={tools} />
      )
    );
  }

  return (
    <div
      className="org-switcher"
      ref={container}
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (open && to != null && !event.currentTarget.contains(to)) closeTo(null);
      }}
    >
      <OrgPill
        ref={button}
        id={current.id}
        name={current.name}
        label={
          count > 0
            ? t('switcher.labelSwitchWaiting', { name: current.name, role, count })
            : t('switcher.labelSwitch', { name: current.name, role })
        }
        waiting={count > 0 ? t('invitations.count', { count }) : null}
        open={open}
        onClick={() => {
          returnTo.current = null;
          setInto(false);
          setOpen((shown) => !shown);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' || open) return;

          event.preventDefault();
          setOpen(true);
          setInto(true);
        }}
      />

      {open && (
        <OrgMenu
          menu={menu}
          anchor={button}
          places={places}
          current={paused ? null : current.id}
          others={others}
          into={into}
          answer={answer}
          onPick={(place) => pick(place.id)}
          onCreate={() => {
            closeTo(null);
            // The dialog hands focus back to whatever opened it, and this tile goes with the menu.
            button.current?.focus();
            onCreate();
          }}
        />
      )}
    </div>
  );
}

/** An invitation's panel, answered through the API; a join moves the panel to the place it made. */
function InvitationPanel({
  invitation,
  waiting,
  tools,
}: {
  invitation: InvitationPreview;
  waiting: WaitingInvitations;
  tools: PanelTools;
}) {
  const { t } = useTranslation();
  const outcome = waiting.outcomes[invitation.id];
  const keys = invitationWording(invitation);
  const organisation = invitation.organisation.name;
  const inviter = invitation.invitedBy?.name ?? '';
  const role = invitation.role == null ? '' : roleName(t, invitation.role);

  async function reply(choice: 'accept' | 'decline'): Promise<void> {
    const answered = await waiting.answer(invitation, choice);

    if (answered.kind === 'accepted') tools.show(answered.organisationId);
    if (answered.kind !== 'failed') tools.land('panel');
  }

  return (
    <InvitationAnswer
      name={organisation}
      line={t(keys.line, { inviter, role })}
      until={t(keys.until, {
        date: formatDay(invitation.expiresAt, dateLocale()),
        email: invitation.email,
      })}
    >
      {isWaiting(outcome) ? (
        <InvitationActions
          name={organisation}
          note={t(keys.declineNote, { inviter })}
          failed={outcome?.kind === 'failed'}
          busy={outcome?.kind === 'busy' ? outcome.answer : null}
          onAccept={() => void reply('accept')}
          onDecline={() => void reply('decline')}
        />
      ) : outcome?.kind === 'declined' ? (
        <Notice kind="quiet" lands>
          {t(keys.declined, { inviter })}
        </Notice>
      ) : outcome?.kind === 'refused' ? (
        <Notice kind={outcome.refusal === 'invitation_expired' ? 'attention' : 'quiet'} lands>
          <strong>{t(`invitations.refused.${outcome.refusal}.word`)}</strong>{' '}
          {t(refusalBody(outcome.refusal, invitation.invitedBy != null), {
            inviter,
            organisation,
            email: invitation.email,
            signedInAs: invitation.signedInAs ?? '',
          })}
        </Notice>
      ) : null}
    </InvitationAnswer>
  );
}

/** An organisation at the domain of the primary address: Ask to join, or Not now for good. */
function OfferPanel({
  offer,
  email,
  tools,
}: {
  offer: DomainOffer;
  email: string;
  tools: PanelTools;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [askedHere, setAskedHere] = useState(false);

  async function ask(): Promise<void> {
    setBusy(true);
    setFailed(false);
    setAskedHere(true);

    try {
      await offer.ask();
    } catch {
      setAskedHere(false);
      setFailed(true);
    } finally {
      setBusy(false);
      tools.land('panel');
    }
  }

  return (
    <OfferAnswer
      name={offer.organisation?.name ?? ''}
      domain={offer.domain ?? ''}
      email={email}
      standing={offer.asked ? 'asked' : failed ? 'unavailable' : 'unasked'}
      askedHere={askedHere}
      busy={busy}
      onAsk={() => void ask()}
      onNotNow={() => {
        void offer.dismiss();
        tools.show(null);
        tools.land('more');
      }}
    />
  );
}
