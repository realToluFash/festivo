import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { THANK_YOU_MOST, cleanThankYou, thankYouLength, thankYouOver } from '@soirely/domain';
import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Alert, Opened } from '../../../components/EventPageParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Head } from '../../../components/SettingsParts.tsx';
import { Thanks } from '../../../components/Thanks.tsx';
import { currentLocale } from '../../../i18n/index.ts';

import './thankYou.css';

/** The field in the card and in End now: the count sits in its description and is not read out while typing. */
export function ThankYouField({
  id,
  label,
  optional,
  help,
  value,
  tried,
  box,
  onChange,
}: {
  id: string;
  label: 'shown' | 'unseen';
  optional: boolean;
  help: string;
  value: string;
  tried: boolean;
  box: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const over = thankYouOver(value);

  return (
    <div className="desk-field">
      <label htmlFor={id} className={label === 'shown' ? 'desk-label' : 'desk-unseen'}>
        {t('thankYou.title')}
        {optional && <span className="ev-optional">{` · ${t('thankYou.optional')}`}</span>}
      </label>
      <div className={tried ? 'desk-box ty-box is-wrong' : 'desk-box ty-box'}>
        <textarea
          ref={box}
          id={id}
          rows={4}
          dir="auto"
          value={value}
          placeholder={t('thankYou.placeholder')}
          aria-invalid={tried}
          aria-describedby={[tried ? `${id}-error` : null, `${id}-help`, `${id}-count`]
            .filter(Boolean)
            .join(' ')}
          onChange={(change) => onChange(change.target.value)}
        />
      </div>
      {tried && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('thankYou.tooLong', { max: THANK_YOU_MOST })}
        </p>
      )}
      <div className="ty-under">
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
        <p
          id={`${id}-count`}
          className={over ? 'desk-help ty-count is-over' : 'desk-help ty-count'}
        >
          {t('thankYou.count', { length: thankYouLength(value), max: THANK_YOU_MOST })}
        </p>
      </div>
    </div>
  );
}

/** First on a Finished event's Overview (sc-6476): Add, then the line with Edit; read-only to a member who cannot end the event. */
export function ThankYouCard({
  event,
  manages,
  onChange,
  onSaid,
}: {
  event: OrganisationEvent;
  manages: boolean;
  onChange: (event: OrganisationEvent, tag: string) => void;
  onSaid: (words: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const line = event.thankYou ?? '';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(line);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tried, setTried] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    if (!moved) return;
    if (open) box.current?.focus();
    else action.current?.focus();
  }, [open, moved]);

  if (!manages && line === '') return null;

  function opened(): void {
    setMoved(true);
    setDraft(line);
    setTried(false);
    setFailed(false);
    setOpen(true);
  }

  function closed(): void {
    if (busy) return;
    setMoved(true);
    setOpen(false);
  }

  function save(): void {
    if (busy) return;
    if (thankYouOver(draft)) {
      setTried(true);
      setFailed(false);
      box.current?.focus();
      return;
    }
    setBusy(true);
    setFailed(false);
    api.setThankYou(event.id, cleanThankYou(draft)).then(
      (saved) => {
        setBusy(false);
        setMoved(true);
        setOpen(false);
        onChange(saved.event, saved.tag);
        if (saved.event.thankYou != null) onSaid(t('thankYou.saved'));
        else if (line !== '') onSaid(t('thankYou.removed'));
      },
      (error: unknown) => {
        setBusy(false);
        if (error instanceof ApiError && error.status === 422) setTried(true);
        else setFailed(true);
      },
    );
  }

  return (
    <section className="desk-block ty" aria-labelledby={`${id}-title`}>
      <Head title={<span id={`${id}-title`}>{t('thankYou.title')}</span>} />
      {open ? (
        <Opened
          label={t('thankYou.title')}
          changed={draft !== line}
          verb={busy ? t('eventEdit.saving') : t('eventPage.save')}
          busy={busy}
          onCancel={closed}
          onSave={save}
        >
          <ThankYouField
            id={`${id}-field`}
            label="unseen"
            optional={false}
            help={line === '' ? t('thankYou.hint') : t('thankYou.removeHint')}
            value={draft}
            tried={tried}
            box={box}
            onChange={(value) => {
              setDraft(value);
              setTried((was) => was && thankYouOver(value));
            }}
          />
          {failed && <Alert>{t('thankYou.notSaved')}</Alert>}
        </Opened>
      ) : line === '' ? (
        <>
          <p className="desk-line">{t('thankYou.hint')}</p>
          <ActionButton button={action} label={t('thankYou.add')} plus onPress={opened} />
        </>
      ) : (
        <>
          <Thanks line={line} hosts={event.hosts} locale={currentLocale()} small />
          {manages && <ActionButton button={action} label={t('thankYou.edit')} onPress={opened} />}
        </>
      )}
    </section>
  );
}

function ActionButton({
  button,
  label,
  plus = false,
  onPress,
}: {
  button: RefObject<HTMLButtonElement | null>;
  label: string;
  plus?: boolean;
  onPress: () => void;
}) {
  return (
    <div className="ty-action">
      <button ref={button} type="button" className="desk-text" onClick={onPress}>
        {plus && <Glyph name="plus" size={17} weight={2.3} />}
        {label}
      </button>
    </div>
  );
}
