import { ApiError, type EventCover, type GuestPage } from '@soirely/api-client';
import { hostsLine } from '@soirely/domain';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { api } from '../../api.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { meshFor } from '../../mesh.ts';
import { offButton } from '../../offButton.ts';
import { InvalidInvitation } from './InvalidInvitation.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'unreachable' }
  | { kind: 'loaded'; page: GuestPage };

type Tell =
  | { kind: 'card' }
  | { kind: 'asking'; busy: boolean; result: 'failed' | 'limited' | null }
  | { kind: 'told' };

const PIECES = [1, 2, 3, 4, 5, 6, 7];

/** The guest's own page in A · The cover card (sc-1526). Opening it records nothing; sc-1439 adds the date and the answers. */
export function Invitation() {
  const { t } = useTranslation();
  const token = useOutletContext<string>();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let current = true;

    api.guestPage(token).then(
      (page) => current && setLoad({ kind: 'loaded', page }),
      (error: unknown) => {
        if (!current) return;
        setRetrying(false);
        setLoad(
          error instanceof ApiError && error.status === 404
            ? { kind: 'gone' }
            : { kind: 'unreachable' },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [token, attempt]);

  if (load.kind === 'gone') return <InvalidInvitation />;

  if (load.kind === 'unreachable') {
    return (
      <div className="gp-alone-wrap">
        <div className="gp-alone">
          <span className="gp-alone-mark" aria-hidden="true">
            <Glyph name="alert" size={26} />
          </span>
          <h1 className="gp-alone-title">{t('session.unreachableTitle')}</h1>
          <p>{t('session.unreachableBodySignedOut')}</p>
          <button
            className="gp-filled is-narrow"
            type="button"
            aria-busy={retrying}
            {...offButton(retrying, { dim: false })}
            onClick={() => {
              setRetrying(true);
              setAttempt((n) => n + 1);
            }}
          >
            {retrying && <span className="gp-spinner" aria-hidden="true" />}
            {retrying ? t('session.retrying') : t('error.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (load.kind === 'loading') {
    return (
      <div className="gp-columns" aria-busy="true">
        <p className="visually-hidden" role="status">
          {t('pending.loading')}
        </p>
        <span className="gp-waiting" aria-hidden="true" />
      </div>
    );
  }

  return <Card token={token} page={load.page} />;
}

function Card({ token, page }: { token: string; page: GuestPage }) {
  const { t } = useTranslation();
  const [tell, setTell] = useState<Tell>({ kind: 'card' });
  const focusOn = useRef<'question' | 'told' | 'tell' | null>(null);
  const question = useRef<HTMLHeadingElement>(null);
  const told = useRef<HTMLParagraphElement>(null);
  const tellLink = useRef<HTMLButtonElement>(null);
  const { guest, event } = page;
  const hosts = hostsLine(event.hosts, currentLocale());
  const count = Math.max(event.hosts.length, 1);

  useEffect(() => {
    const want = focusOn.current;
    focusOn.current = null;
    if (want === 'question') question.current?.focus();
    if (want === 'told') told.current?.focus();
    if (want === 'tell') tellLink.current?.focus();
  }, [tell.kind]);

  function tellThem(): void {
    setTell({ kind: 'asking', busy: true, result: null });
    api.tellWrongPerson(token).then(
      () => {
        focusOn.current = 'told';
        setTell({ kind: 'told' });
      },
      (error: unknown) =>
        setTell({
          kind: 'asking',
          busy: false,
          result: error instanceof ApiError && error.is('too_many_attempts') ? 'limited' : 'failed',
        }),
    );
  }

  return (
    <div className="gp-columns">
      <Cover event={event} guest={guest.fullName} />
      <div className="gp-under">
        {tell.kind === 'card' && (
          <div className="gp-foot">
            <p>{t('guest.noAccountNeeded')}</p>
            <hr />
            <p>{t('guest.closing')}</p>
            <button
              ref={tellLink}
              className="gp-text"
              type="button"
              onClick={() => {
                focusOn.current = 'question';
                setTell({ kind: 'asking', busy: false, result: null });
              }}
            >
              <span>{t('guest.tell', { name: guest.fullName })}</span>
            </button>
          </div>
        )}
        {tell.kind === 'asking' && (
          <section className="gp-tell" aria-labelledby="gp-tell-h">
            <h2 ref={question} id="gp-tell-h" className="gp-h2" tabIndex={-1}>
              {t('guest.tellQuestion', { hosts })}
            </h2>
            <p className="gp-sub">{t('guest.tellLine', { name: guest.fullName, count })}</p>
            {tell.result === 'failed' && (
              <div className="gp-notice is-broken" role="alert">
                <span className="gp-notice-mark" aria-hidden="true">
                  <Glyph name="clear" size={14} weight={3} />
                </span>
                <p>{t('guest.tellFailed')}</p>
              </div>
            )}
            {tell.result === 'limited' && (
              <div className="gp-notice is-attention" role="alert">
                <span className="gp-notice-mark" aria-hidden="true" />
                <p>{t('guest.tellLimited')}</p>
              </div>
            )}
            <button
              className="gp-filled"
              type="button"
              aria-busy={tell.busy}
              {...offButton(tell.busy, { dim: false })}
              onClick={tellThem}
            >
              {tell.busy && <span className="gp-spinner" aria-hidden="true" />}
              {t('guest.tellThem')}
            </button>
            <button
              className="gp-outlined"
              type="button"
              onClick={() => {
                focusOn.current = 'tell';
                setTell({ kind: 'card' });
              }}
            >
              {t('guest.goBack')}
            </button>
          </section>
        )}
        {tell.kind === 'told' && (
          <div className="gp-told" role="status" aria-live="polite">
            <span className="gp-mark" aria-hidden="true">
              <Glyph name="tick" size={17} weight={3} />
            </span>
            <p ref={told} tabIndex={-1}>
              {t('guest.tellThanks', { hosts, count })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** The cover the event's page shows: the organiser's photo, or its colour from meshFor, under the scrim. */
function Cover({ event, guest }: { event: GuestPage['event']; guest: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const photo = event.cover != null && !failed ? event.cover : null;

  return (
    <section
      className={`gp-cover ev-card today-cover ${photo == null ? `is-${meshFor(event.id)}` : 'is-photo'}`}
      aria-labelledby="gp-h1"
    >
      {photo != null && <Photo cover={photo} onFail={() => setFailed(true)} />}
      <span className="ev-scrim" aria-hidden="true" />
      {photo == null &&
        PIECES.map((piece) => (
          <span key={piece} className={`gp-piece p${piece}`} aria-hidden="true" />
        ))}
      <div className="gp-cover-inner">
        <h1 id="gp-h1" className="gp-cover-h1">
          {t('guest.invitationTitle')}
        </h1>
        <p className="gp-cover-guest">{guest}</p>
        <p className="gp-cover-name">{event.name}</p>
      </div>
    </section>
  );
}

/** Its description is its text alternative; one without is decorative (WCAG 2.2 §1.1.1). */
function Photo({ cover, onFail }: { cover: EventCover; onFail: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const { position } = cover;

  // Through the CSSOM: the CSP has no 'unsafe-inline', which governs a style attribute too.
  useLayoutEffect(() => {
    if (image.current != null) image.current.style.objectPosition = `50% ${position}%`;
  }, [position]);

  return (
    <img
      ref={image}
      className="ev-photo"
      src={cover.sizes[0]?.url}
      srcSet={
        cover.sizes.length > 1
          ? cover.sizes.map(({ width, url }) => `${url} ${width}w`).join(', ')
          : undefined
      }
      sizes={cover.sizes.length > 1 ? '(min-width: 64rem) 560px, 100vw' : undefined}
      alt={cover.description ?? ''}
      draggable={false}
      onError={onFail}
    />
  );
}
