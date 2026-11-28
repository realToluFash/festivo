import { useEffect, useLayoutEffect, useState } from 'react';
import { ApiError, type GuestPage } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { api } from '../../api.ts';
import lockupUrl from '../../brand/lockup.svg';
import { holdScheme } from '../../colourScheme.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { config } from '../../config.ts';
import { NotFound } from '../public/NotFound.tsx';
import { Card, PageLoading, PageUnreachable } from './Invitation.tsx';
import '../../components/desk.css';
import '../../components/eventsDesk.css';
import '../../components/EventsList.css';
import './guestPage.css';
import './meals.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'unreachable' }
  | { kind: 'loaded'; page: GuestPage };

/** Preview as guest (sc-3907): the guest's meal step for the signed-in member alone, opened from the Menu, which either Close preview returns to. */
export function MealPreview() {
  const { t } = useTranslation();
  const { eventId = '' } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useLayoutEffect(() => holdScheme(config().scheme), []);

  useEffect(() => {
    let current = true;

    api.menuPreview(eventId).then(
      (page) => current && setLoad({ kind: 'loaded', page }),
      (error: unknown) => {
        if (!current) return;
        setRetrying(false);
        setLoad(
          error instanceof ApiError && (error.status === 403 || error.status === 404)
            ? { kind: 'gone' }
            : { kind: 'unreachable' },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [eventId, attempt]);

  if (load.kind === 'gone') return <NotFound />;

  const close = () =>
    void navigate(`/app/events/${encodeURIComponent(eventId)}/menu`, {
      state: { told: 'preview' },
    });

  return (
    <div className="guest-page desk">
      <meta name="robots" content="noindex, nofollow" />
      <header className="gp-header">
        <img className="gp-lockup" src={lockupUrl} alt={t('app.name')} />
      </header>
      <div className="gp-preview" role="note">
        <Glyph name="eye" size={17} weight={2.2} />
        <span>{t('guestMeal.preview')}</span>
        <button type="button" className="gp-text is-ink gp-preview-close" onClick={close}>
          <span>{t('guestMeal.closePreview')}</span>
        </button>
      </div>
      <main id="content" className="gp-main">
        {load.kind === 'loading' && <PageLoading />}
        {load.kind === 'unreachable' && (
          <PageUnreachable
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              setAttempt((n) => n + 1);
            }}
          />
        )}
        {load.kind === 'loaded' && <Card token="" first={load.page} preview={{ onClose: close }} />}
      </main>
    </div>
  );
}
