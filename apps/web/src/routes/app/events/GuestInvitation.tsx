import {
  GUEST_INVITATION_HOWS,
  type GuestDetails,
  type GuestInvitationHow,
  canMarkNotInvited,
} from '@soirely/api-client';
import { replyDate, shownReply } from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Glyph, type GlyphName } from '../../../components/Glyph.tsx';
import { Head, RowWords, TextAction } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';

export type Copy =
  { kind: 'none' } | { kind: 'copied' } | { kind: 'byHand'; url: string } | { kind: 'failed' };

/** The guest's one Invitation line (sc-3788): by hand, by Soirely's message, or when they replied; null while Not yet invited. */
export function invitationLine(t: TFunction, guest: GuestDetails, timeZone: string): string | null {
  const invitation = guest.invitation;
  if (invitation == null) return null;
  const date = replyDate(invitation.at, timeZone, dateLocale());

  switch (invitation.how) {
    case 'soirelyMessage':
      return t('guestList.invitedByMessage', { date });
    case 'reply':
      return t('guestList.invitedWhenReplied', { date });
    default: {
      const how = t(`guestList.howMid.${invitation.how}`);

      return invitation.by == null
        ? t('guestList.invitedHow', { how, date })
        : t('guestList.invitedBy', { name: invitation.by, how, date });
    }
  }
}

/** A guest's Invitation at a desk: the line, Copy invitation link, Replace link… and Mark as invited, which opens an inset. */
export function Invitation({
  guest,
  timeZone,
  heading,
  manages,
  invites,
  copy,
  copyByHand,
  marking,
  markFailed,
  replaceButton,
  onCopy,
  onReplace,
  onMarking,
  onMark,
  onUnmark,
}: {
  guest: GuestDetails;
  timeZone: string;
  heading: string;
  manages: boolean;
  invites: boolean;
  copy: Copy;
  copyByHand: ReactNode;
  marking: boolean;
  markFailed: boolean;
  replaceButton: RefObject<HTMLButtonElement | null>;
  onCopy: () => void;
  onReplace: () => void;
  onMarking: (marking: boolean) => void;
  onMark: (how: GuestInvitationHow) => void;
  onUnmark: () => void;
}) {
  const { t } = useTranslation();
  const notYet = shownReply(guest) === 'notYetInvited';
  const line = invitationLine(t, guest, timeZone);

  return (
    <section className="desk-block" aria-labelledby={`${heading}-invitation`}>
      <Head
        level={3}
        title={<span id={`${heading}-invitation`}>{t('guestList.invitation')}</span>}
      />
      {(manages || line != null) && (
        <ul className="desk-rows gs-rows">
          {line != null && (
            <li className="desk-row">
              <IconLead name="send" />
              <div className="gs-row-words">
                <RowWords title={line} lines={[]} />
                {manages && canMarkNotInvited(guest) && (
                  <button
                    type="button"
                    className="desk-text"
                    data-focus="unmark"
                    onClick={onUnmark}
                  >
                    {t('guestList.markNotInvited')}
                  </button>
                )}
              </div>
            </li>
          )}
          {manages && invites && (
            <li>
              <button type="button" className="desk-row gs-do" data-focus="copy" onClick={onCopy}>
                <IconLead name="link" />
                <RowWords title={t('guestList.copyLink')} lines={[t('guestList.copyLinkLine')]} />
              </button>
              <div className="gs-copied">
                <p role="status">
                  {copy.kind === 'copied' && (
                    <span>
                      <Glyph name="tick" size={16} weight={2.6} />
                      {t('guestList.linkCopied')}
                    </span>
                  )}
                </p>
                {copy.kind === 'copied' && notYet && (
                  <button
                    type="button"
                    className="desk-text is-green"
                    onClick={() => onMarking(true)}
                  >
                    {t('guestList.markAsInvited')}
                  </button>
                )}
              </div>
              {copyByHand}
              {copy.kind === 'failed' && (
                <p className="gs-refused" role="alert">
                  {t('guestList.loadFailedLine')}
                </p>
              )}
            </li>
          )}
          {manages && (
            <li>
              <button
                ref={replaceButton}
                type="button"
                className="desk-row gs-do"
                data-focus="replace"
                onClick={onReplace}
              >
                <IconLead name="refresh" />
                <RowWords
                  title={t('guestList.replaceLink')}
                  lines={[t('guestList.replaceLinkLine')]}
                />
              </button>
            </li>
          )}
          {manages && notYet && invites && (
            <li>
              <button
                type="button"
                className="desk-row gs-do"
                data-focus="mark"
                onClick={() => onMarking(true)}
              >
                <IconLead name="tick" />
                <RowWords title={t('guestList.markAsInvited')} lines={[t('guestList.markLine')]} />
              </button>
            </li>
          )}
        </ul>
      )}
      {manages && invites && notYet && marking && (
        <MarkInset failed={markFailed} onCancel={() => onMarking(false)} onMark={onMark} />
      )}
      {!manages && <p className="gs-inset gs-read-only">{t('guestList.readOnlyInvited')}</p>}
    </section>
  );
}

/** How did you invite them?, nothing chosen: Mark as invited with none sends nothing and says so. */
function MarkInset({
  failed,
  onCancel,
  onMark,
}: {
  failed: boolean;
  onCancel: () => void;
  onMark: (how: GuestInvitationHow) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const [picked, setPicked] = useState<GuestInvitationHow | null>(null);
  const [tried, setTried] = useState(false);
  const wrong = tried && picked == null;
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  return (
    <div className="gs-inset">
      {failed && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.markNotSaved')}
        </p>
      )}
      <fieldset className="gs-fieldset" aria-describedby={wrong ? `${name}-error` : undefined}>
        <legend className="gs-inset-title">{t('guestList.howInvited')}</legend>
        <div className="gs-ways">
          {GUEST_INVITATION_HOWS.map((how, index) => (
            <label key={how} className={wrong ? 'gs-way is-wrong' : 'gs-way'}>
              <input
                ref={index === 0 ? first : undefined}
                type="radio"
                className="desk-radio"
                name={name}
                checked={picked === how}
                onChange={() => setPicked(how)}
              />
              {t(`guestList.how.${how}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {wrong && (
        <p id={`${name}-error`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.howInvitedBlank')}
        </p>
      )}
      <div className="gs-inset-foot">
        <button
          type="button"
          className="gs-pill is-primary"
          onClick={() => {
            if (picked == null) {
              setTried(true);
              first.current?.focus();
              return;
            }
            onMark(picked);
          }}
        >
          {t('guestList.markAsInvited')}
        </button>
        <TextAction label={t('guestList.cancel')} onClick={onCancel} />
      </div>
    </div>
  );
}

export function IconLead({ name }: { name: GlyphName }) {
  return (
    <span className="gs-lead is-icon" aria-hidden="true">
      <Glyph name={name} size={20} weight={2} />
    </span>
  );
}
