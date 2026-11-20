import { initials } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { StartYourOwn } from '../components/CreateOrganisation.tsx';
import { Toast } from '../components/Toast.tsx';
import { CreateWalk } from './CreateOrg.tsx';
import { NO_ORG_WORDS as W, type DemoWalk, freshWalk, isCreateState, walkOf } from './createOrg.ts';
import { Glyph } from '../components/Glyph.tsx';
import { Notice } from '../components/Notice.tsx';
import { InvitationActions, InvitationAnswer, JoinedAnswer } from '../components/OrgMenu.tsx';
import { LayersContext, focusWhenFree, useDeskLayers } from '../layers.ts';
import { ManagedBanner } from './managed.tsx';
import { SAMPLE } from './rules.ts';
import {
  INVITATIONS,
  type Invitation,
  NEW_PLACE,
  create,
  dayOf,
  join,
  switchTo,
} from './switcher.ts';
import '../components/SettingsParts.css';
import './createOrg.css';

const ANSWERING_MS = 700;

type Said = 'accept' | 'decline' | 'joined' | 'declined';

/** main's NoOrganisation, alone under the public header in B's desk look with no card (CreateOrg-B-Walk-Web, page 29); `?state=managed` has sc-563's banner where Start your own was, and `?state=invitations` lists the ones waiting under Invitations in place of the way on, as main does (sc-75471). */
export function NoOrganisation() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { layers, covered, setHost } = useDeskLayers();
  const managed = params.get('state') === 'managed';
  const invited = params.get('state') === 'invitations';
  const [walk, setWalk] = useState<DemoWalk | null>(() => {
    const raw = params.get('create');

    return isCreateState(raw) && !managed ? walkOf(raw, t) : null;
  });
  const [told, setTold] = useState<string | null>(null);
  const [opensOn] = useState(walk == null);
  const start = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (opensOn) start.current?.focus();
  }, [opensOn]);

  return (
    <LayersContext value={layers}>
      <div className="cw-alone desk">
        <header className="cw-header" inert={covered}>
          <Brand lockup />
          <button
            type="button"
            className="cw-language"
            onClick={() => setTold('Choosing a language has its own design.')}
          >
            <Glyph name="globe" size={16} />
            {W.language}
          </button>
        </header>
        <main id="content" className="cw-none" inert={covered}>
          <h1>{W.title}</h1>
          <p className="cw-none-body">{W.body}</p>
          {invited ? (
            <WaitingInvitations
              onOpen={(invitation) => {
                join(invitation);
                switchTo(invitation, '/demo/today');
                void navigate('/demo/today', { replace: true });
              }}
            />
          ) : (
            <p className="cw-none-body is-quiet">{W.wayOn(SAMPLE.email)}</p>
          )}
          {managed ? (
            <ManagedBanner />
          ) : (
            <StartYourOwn button={start} onStart={() => setWalk(freshWalk())} />
          )}
          <div className="cw-signed">
            <p>{W.signedInAs(SAMPLE.email)}</p>
            <div className="cw-signed-ways">
              <Link className="desk-text" to="/demo/settings/account">
                {W.account}
              </Link>
              <Link className="desk-text" to="/demo/sign-in?state=signed-out">
                {W.signOut}
              </Link>
            </div>
          </div>
        </main>
        <div ref={setHost} className="desk-layers" />
        {walk != null && (
          <CreateWalk
            start={walk}
            onClose={() => {
              setWalk(null);
              focusWhenFree(() => start.current);
            }}
            onCreated={() => {
              create(NEW_PLACE, '/demo/today', true);
              void navigate('/demo/today', { replace: true });
            }}
          />
        )}
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}

/** Each invitation waiting, a row with its dashed tile and the switcher's own answers: Accept and join holds while it is sent, then says so with Open; Decline says what it told. */
function WaitingInvitations({ onOpen }: { onOpen: (invitation: Invitation) => void }) {
  const { t } = useTranslation();
  const [said, setSaid] = useState<Readonly<Record<string, Said>>>({});
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  function answer(invitation: Invitation, choice: 'accept' | 'decline'): void {
    if (said[invitation.id] != null) return;

    setSaid((now) => ({ ...now, [invitation.id]: choice }));
    timers.current.push(
      window.setTimeout(
        () =>
          setSaid((now) => ({
            ...now,
            [invitation.id]: choice === 'accept' ? 'joined' : 'declined',
          })),
        ANSWERING_MS,
      ),
    );
  }

  return (
    <section className="cw-invitations" aria-labelledby="cw-invitations-heading">
      <h2 id="cw-invitations-heading">{t('invitations.heading')}</h2>
      {INVITATIONS.map((invitation) => {
        const now = said[invitation.id];

        return (
          <div
            key={invitation.id}
            className="cw-invitation"
            role="group"
            aria-label={invitation.name}
          >
            <span className="cw-invitation-tile" aria-hidden="true">
              <span className="sw-tile is-dashed">{initials(invitation.name)}</span>
            </span>
            <div className="cw-invitation-answer">
              <InvitationAnswer
                name={invitation.name}
                line={`Invitation from ${invitation.inviter} · ${invitation.role}`}
                until={`Works until ${dayOf(invitation.until)}`}
              >
                {now === 'joined' ? (
                  <JoinedAnswer
                    name={invitation.name}
                    role={invitation.role}
                    onOpen={() => onOpen(invitation)}
                  />
                ) : now === 'declined' ? (
                  <Notice kind="quiet" lands>
                    You declined. {invitation.inviter} will see that you said no.
                  </Notice>
                ) : (
                  <InvitationActions
                    name={invitation.name}
                    note={`Declining tells ${invitation.inviter} you said no. Nothing else changes.`}
                    failed={false}
                    busy={now === 'accept' || now === 'decline' ? now : null}
                    onAccept={() => answer(invitation, 'accept')}
                    onDecline={() => answer(invitation, 'decline')}
                  />
                )}
              </InvitationAnswer>
            </div>
          </div>
        );
      })}
    </section>
  );
}
