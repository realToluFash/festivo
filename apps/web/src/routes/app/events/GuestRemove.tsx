import type { GuestDetails } from '@soirely/api-client';
import { REPLY_KEY, companionShown, shownReply } from '@soirely/domain';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Ask, RowWords } from '../../../components/SettingsParts.tsx';
import { ReplyMark } from './GuestColumn.tsx';
import './guestRemove.css';

export type Removing = { kind: 'asking'; busy: boolean; failed: boolean } | { kind: 'gone' };

/** "Remove {full name}?" naming what goes with them, Keep on the list first (sc-3774); 404 takes its place with Back to guests. */
export function RemoveAsk({
  guest,
  removing,
  onKeep,
  onRemove,
  onGone,
}: {
  guest: GuestDetails;
  removing: Removing;
  onKeep: () => void;
  onRemove: () => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const names = guest.companions.map((one) => one.fullName);
  const title = t('guestList.removeTitle', { name: guest.fullName });

  if (removing.kind === 'gone')
    return (
      <Ask
        key="gone"
        title={title}
        line={t('guestList.alreadyRemoved', { name: guest.fullName })}
        keep={t('guestList.backToGuests')}
        onKeep={onGone}
      >
        <span className="gr-ask" hidden />
      </Ask>
    );

  const reply = shownReply(guest);

  return (
    <Ask
      key="asking"
      title={title}
      line={t('guestList.removeGoes')}
      keep={t('guestList.keepOnList')}
      go={t('guestList.removeGo')}
      red={false}
      busy={removing.busy ? t('guestList.removeGo') : undefined}
      failed={removing.failed ? t('guestList.loadFailedLine') : undefined}
      describedBy={`${id}-goes ${id}-sent`}
      onKeep={onKeep}
      onGo={onRemove}
    >
      <ul id={`${id}-goes`} className="desk-rows gs-rows gr-goes gr-ask">
        <li className="desk-row">
          <span className="gs-lead">
            <ReplyMark reply={reply} />
          </span>
          <RowWords title={t(REPLY_KEY[reply])} lines={[t('guestList.theirReply')]} />
        </li>
        {guest.companions.map((companion, at) => (
          <li key={companion.id} className="desk-row">
            <span className="gs-lead">
              <ReplyMark reply={companion.state} />
            </span>
            <RowWords
              title={companionShown(t, guest.fullName, names, at)}
              lines={[t('guestList.companionLine', { reply: t(REPLY_KEY[companion.state]) })]}
            />
          </li>
        ))}
      </ul>
      <p id={`${id}-sent`}>{t('guestList.removeNothingSent')}</p>
    </Ask>
  );
}
