import { ApiError, type RecoveryRequest } from '@soirely/api-client';
import { initials, listFormat } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Ask, Avatar, Head, Tag, TextAction } from '../../../components/SettingsParts.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { dayAtTime } from '../../../securityPage.ts';
import type { RecoveryAnswer } from './membersCard.ts';

/** In the page's language and the browser's region (sc-8421), else as the API wrote it for the account. */
function written(t: TFunction, at: string | null, fallback: string | null): string {
  return at == null ? (fallback ?? '') : dayAtTime(at, dateLocale(), t);
}

function recoveryLines(t: TFunction, request: RecoveryRequest): string[] {
  const proved = request.provedPhone
    ? t(request.own ? 'recoveryRequests.provedBothOwn' : 'recoveryRequests.provedBoth')
    : t(request.own ? 'recoveryRequests.provedEmailOwn' : 'recoveryRequests.provedEmail');

  return [
    request.email,
    `${t('recoveryRequests.title')} · ${proved}`,
    t('recoveryRequests.when', {
      asked: written(t, request.askedAt, request.asked),
      expires: written(t, request.expiresAt, request.expires),
    }),
  ];
}

/** Requests to get back in, above Waiting: the paragraph once at the top and read with each request, each request a row holding its own answers. */
export function RecoveryBlock({
  recoveries,
  tones,
  lit,
  column,
  onAnswer,
  onMoveOn,
}: {
  recoveries: readonly RecoveryRequest[];
  /** Each asker's face tone, as their row under People has it. */
  tones: ReadonlyMap<string, number>;
  lit: string | null;
  column: boolean;
  onAnswer: (id: string, answer: RecoveryAnswer) => void;
  onMoveOn: () => void;
}) {
  const { t } = useTranslation();
  const intro = useId();

  return (
    <section className="desk-block">
      <Head title={t('recoveryRequests.cardTitle')} />
      <p id={intro} className="desk-line desk-request-intro">
        {t('recoveryRequests.intro')}
      </p>
      <ul className="desk-rows has-lead">
        {recoveries.map((one) => (
          <li key={one.id}>
            <article
              id={`request-${one.id}`}
              className={one.id === lit ? 'desk-row desk-request is-on' : 'desk-row desk-request'}
              tabIndex={-1}
              aria-labelledby={`request-${one.id}-name`}
              aria-describedby={intro}
              onBlur={(event) => {
                const to = event.relatedTarget;
                const away =
                  to instanceof Element &&
                  !event.currentTarget.contains(to) &&
                  to.closest('.desk-layers') == null;

                if (one.id === lit && away) onMoveOn();
              }}
            >
              <Avatar
                initials={initials(one.name)}
                tone={tones.get(one.userId) ?? 0}
                size={column ? 'small' : 'row'}
              />
              <div className="desk-row-words">
                <span className="desk-row-title">
                  <span id={`request-${one.id}-name`} className="desk-row-name">
                    {one.own ? t('recoveryRequests.you', { name: one.name }) : one.name}
                  </span>
                  <Tag kind="waiting" word={t('recoveryRequests.mark')} />
                </span>
                {recoveryLines(t, one).map((line) => (
                  <span key={line} className="desk-row-line">
                    {line}
                  </span>
                ))}
                {one.own ? (
                  <p className="desk-request-own">
                    {t('recoveryRequests.own', {
                      organisations: listFormat(currentLocale(), { type: 'conjunction' }).format(
                        one.organisations,
                      ),
                    })}
                  </p>
                ) : (
                  <div className="desk-request-answers">
                    <TextAction
                      label={t('recoveryRequests.approve')}
                      onClick={() => onAnswer(one.id, 'approve')}
                    />
                    <TextAction
                      label={t('recoveryRequests.turnDown')}
                      onClick={() => onAnswer(one.id, 'turnDown')}
                    />
                  </div>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
      <p className="desk-foot">{t('recoveryRequests.cardNote')}</p>
    </section>
  );
}

type Phase = 'asking' | 'sending' | 'failed' | 'closed';

/** Closed, or no longer this viewer's to answer (a 404, RFC 9110 §15.5.5): trying again cannot work. */
function answeredElsewhere(refusal: unknown): boolean {
  return (
    refusal instanceof ApiError && (refusal.is('recovery_request_closed') || refusal.status === 404)
  );
}

/** One 400 confirm per answer; Sending your answer… while it goes, the failed line if it fails, and Close alone once the request has gone. */
export function RecoveryAsk({
  request,
  answer,
  onKeep,
  onAnswered,
  onGone,
}: {
  request: RecoveryRequest;
  answer: RecoveryAnswer;
  onKeep: () => void;
  onAnswered: () => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('asking');
  const approve = answer === 'approve';
  const title = t(approve ? 'recoveryRequests.approveTitle' : 'recoveryRequests.turnDownTitle', {
    name: request.name,
  });

  async function send(): Promise<void> {
    if (phase === 'sending') return;
    setPhase('sending');

    try {
      await (approve ? api.approveRecovery(request.id) : api.turnDownRecovery(request.id));
      onAnswered();
    } catch (refusal) {
      setPhase(answeredElsewhere(refusal) ? 'closed' : 'failed');
    }
  }

  return phase === 'closed' ? (
    <Ask
      key="closed"
      title={title}
      line={t('recoveryRequests.closed')}
      keep={t('recoveryRequests.close')}
      onKeep={onGone}
    />
  ) : (
    <Ask
      key="asking"
      title={title}
      line={t(approve ? 'recoveryRequests.approveBody' : 'recoveryRequests.turnDownBody')}
      keep={t(approve ? 'recoveryRequests.cancel' : 'recoveryRequests.keep')}
      go={t(approve ? 'recoveryRequests.approveConfirm' : 'recoveryRequests.turnDownConfirm')}
      red={approve}
      busy={phase === 'sending' ? t('recoveryRequests.sending') : undefined}
      failed={phase === 'failed' ? t('recoveryRequests.failed') : undefined}
      onKeep={onKeep}
      onGo={() => void send()}
    />
  );
}
