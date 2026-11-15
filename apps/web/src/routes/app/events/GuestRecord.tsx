import {
  ApiError,
  GUEST_ANSWERS,
  GUEST_REPLY_HOWS,
  type GuestAnswer,
  type GuestReplyHow,
  type TaggedGuest,
  repliedThemselves,
} from '@soirely/api-client';
import { REPLY_KEY, companionShown, replyDate } from '@soirely/domain';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { Amber, ReplyMark } from './GuestColumn.tsx';

/** Record a reply (sc-3787), in place of the details: the guest's own three answers, how they told you, and who comes with them; nothing chosen when it opens. */
export function RecordForm({
  eventId,
  tagged,
  timeZone,
  focus,
  onDirty,
  onCancel,
  onGone,
  onSaved,
}: {
  eventId: string;
  tagged: TaggedGuest;
  timeZone: string;
  focus: (...keys: string[]) => void;
  onDirty: (dirty: boolean) => void;
  onCancel: (dirty: boolean) => void;
  onGone: () => void;
  onSaved: (tagged: TaggedGuest) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [guest, setGuest] = useState(tagged.guest);
  const [answer, setAnswer] = useState<GuestAnswer | null>(null);
  const [how, setHow] = useState<GuestReplyHow | null>(null);
  const [tried, setTried] = useState(false);
  const [replace, setReplace] = useState<'asked' | 'confirmed' | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(guest.companions.map((companion) => companion.id)),
  );
  const dirty = answer != null || how != null;
  const noAnswer = tried && answer == null;
  const noHow = tried && how == null;
  const names = guest.companions.map((companion) => companion.fullName);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  async function send(chosen: GuestAnswer, told: GuestReplyHow, confirmed: boolean): Promise<void> {
    setFailed(false);
    setBusy(true);
    try {
      onSaved(
        await api.recordGuestReply(eventId, guest.id, {
          answer: chosen,
          how: told,
          companions:
            chosen === 'coming'
              ? guest.companions.map((companion) => ({
                  id: companion.id,
                  coming: ticked.has(companion.id),
                }))
              : [],
          replace: confirmed,
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) onGone();
      else if (error instanceof ApiError && error.is('reply_is_theirs')) {
        try {
          setGuest((await api.guest(eventId, guest.id)).guest);
          setReplace('asked');
          focus('replace-heading');
        } catch {
          setFailed(true);
        }
      } else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function save(): void {
    if (busy) return;
    if (answer == null || how == null) {
      setTried(true);
      focus(answer == null ? `answer-${GUEST_ANSWERS[0]}` : `how-${GUEST_REPLY_HOWS[0]}`);
      return;
    }
    if (repliedThemselves(guest) && replace !== 'confirmed') {
      setReplace('asked');
      focus('replace-heading');
      return;
    }
    void send(answer, how, replace === 'confirmed');
  }

  return (
    <div className="gs-form">
      <div className="gs-col-head">
        <h2 className="gs-col-title" tabIndex={-1} data-focus="form-heading">
          {t('guestList.recordReply')}
        </h2>
        <div className="gs-col-actions">
          <button type="button" className="desk-text" onClick={() => onCancel(dirty)}>
            {t('guestList.cancel')}
          </button>
          <button
            type="button"
            className="desk-text"
            aria-busy={busy || undefined}
            {...offButton(busy, { dim: false })}
            onClick={save}
          >
            {busy ? t('guestList.saving') : t('guestList.save')}
          </button>
        </div>
      </div>
      {failed && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.notSaved')}
        </p>
      )}
      {replace === 'asked' && repliedThemselves(guest) && guest.repliedAt != null && (
        <Amber
          title={t('guestList.replaceAsk', {
            name: guest.fullName,
            reply: t(REPLY_KEY[guest.reply]),
            date: replyDate(guest.repliedAt, timeZone, dateLocale()),
          })}
          focusKey="replace-heading"
        >
          <p className="gs-amber-line">{t('guestList.replaceAskLine')}</p>
          <div className="gs-pair">
            <button
              type="button"
              className="gs-pill"
              aria-busy={busy || undefined}
              onClick={() => {
                setReplace('confirmed');
                if (answer != null && how != null) void send(answer, how, true);
              }}
            >
              {t('guestList.replaceTheirs')}
            </button>
            <button type="button" className="gs-pill is-secondary" onClick={() => onCancel(false)}>
              {t('guestList.keepTheirs')}
            </button>
          </div>
        </Amber>
      )}
      <p className="desk-line">{t('guestList.recordFor', { name: guest.fullName })}</p>
      <fieldset
        className="gs-fieldset"
        aria-describedby={noAnswer ? `${id}-answer-error` : undefined}
      >
        <legend className="gs-legend">{t('guestList.theirReply')}</legend>
        <div className="gs-answers">
          {GUEST_ANSWERS.map((one) => (
            <label
              key={one}
              className={['gs-answer', answer === one && 'is-lit', noAnswer && 'is-wrong']
                .filter(Boolean)
                .join(' ')}
            >
              <span className="gs-answer-lead">
                <ReplyMark reply={one} />
              </span>
              <span className="gs-answer-word">{t(REPLY_KEY[one])}</span>
              <input
                type="radio"
                className="desk-radio gs-radio"
                name={`${id}-answer`}
                checked={answer === one}
                data-focus={`answer-${one}`}
                onChange={() => setAnswer(one)}
              />
            </label>
          ))}
        </div>
        {noAnswer && (
          <p id={`${id}-answer-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {t('guestList.chooseReply')}
          </p>
        )}
      </fieldset>
      <fieldset className="gs-fieldset" aria-describedby={noHow ? `${id}-how-error` : undefined}>
        <legend className="gs-legend">{t('guestList.howTold')}</legend>
        <div className="gs-chips">
          {GUEST_REPLY_HOWS.map((one) => (
            <label
              key={one}
              className={['gs-chip', how === one && 'is-on', noHow && 'is-wrong']
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                className="gs-chip-input"
                name={`${id}-how`}
                checked={how === one}
                data-focus={`how-${one}`}
                onChange={() => setHow(one)}
              />
              {how === one && <Glyph name="tick" size={15} weight={2.8} />}
              {t(`guestList.toldHow.${one}`)}
            </label>
          ))}
        </div>
        {noHow && (
          <p id={`${id}-how-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {t('guestList.chooseHow')}
          </p>
        )}
      </fieldset>
      {answer === 'coming' && guest.companions.length > 0 && (
        <fieldset className="gs-fieldset">
          <legend className="gs-legend">{t('guestList.whoComing')}</legend>
          <p className="desk-note">
            {t('guestList.recordPlaces', { count: guest.companions.length, coming: ticked.size })}
          </p>
          {guest.companions.map((companion, at) => (
            <label key={companion.id} className="gs-tick">
              <input
                type="checkbox"
                className="gs-box"
                checked={ticked.has(companion.id)}
                onChange={() =>
                  setTicked((was) => {
                    const next = new Set(was);

                    if (next.has(companion.id)) next.delete(companion.id);
                    else next.add(companion.id);

                    return next;
                  })
                }
              />
              {companionShown(t, guest.fullName, names, at)}
            </label>
          ))}
        </fieldset>
      )}
      <p className="desk-note">{t('guestList.recordFoot', { name: guest.fullName })}</p>
    </div>
  );
}
