import { ApiError, type FinalNumbers, type OrganisationEvent } from '@soirely/api-client';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Opened } from '../../../components/EventPageParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, Head, RowWords } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { dayIn } from './courseDefault.ts';
import { copyLine, dueError, saveSheet, shortDay } from './kitchenSheet.ts';

export function DownloadMark() {
  return (
    <svg className="ks-mark is-act" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

type Giving = 'rest' | 'making' | 'failed';

/** Final numbers beside the kitchen sheet (sc-30812): the due day edited in place, Give final numbers…, then the copies given, newest first. */
export function FinalNumbersBlock({
  event,
  final,
  manage,
  onChange,
  tell,
}: {
  event: OrganisationEvent;
  final: FinalNumbers;
  manage: boolean;
  onChange: (final: FinalNumbers) => void;
  tell: (words: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [giving, setGiving] = useState<Giving | null>(null);
  const [given, setGiven] = useState(false);
  const locale = dateLocale();

  const give = () => {
    setGiving('making');
    api.giveFinalNumbers(event.id).then(
      ({ name, bytes }) => {
        saveSheet(bytes, name ?? `${t('kitchenSheet.title')}.pdf`);
        setGiving(null);
        setGiven(true);
        api.kitchenSheet(event.id).then(
          (sheet) => onChange(sheet.finalNumbers),
          () => undefined,
        );
      },
      () => setGiving('failed'),
    );
  };

  const download = (copyId: string) => {
    api.kitchenCopyPdf(event.id, copyId).then(
      ({ name, bytes }) => saveSheet(bytes, name ?? `${t('kitchenSheet.title')}.pdf`),
      () => tell(t('kitchenSheet.copyFailed')),
    );
  };

  return (
    <section className="desk-block ks-final" aria-labelledby="ks-final">
      <Head title={<span id="ks-final">{t('kitchenSheet.finalNumbers')}</span>} />
      <div className="ks-final-said" role="status">
        {given && (
          <p className="gs-ok">
            <Glyph name="tick" size={17} weight={2.6} />
            {t('kitchenSheet.givenKitchen')}
          </p>
        )}
      </div>
      <ul className="desk-rows ev-details">
        <DueRow
          event={event}
          final={final}
          manage={manage}
          open={open}
          locale={locale}
          onOpen={() => setOpen((was) => !was)}
          onClose={() => setOpen(false)}
          onSaved={(next) => {
            onChange(next);
            setOpen(false);
            tell(t('kitchenSheet.saved'));
          }}
        />
        {final.copies.map((copy) => (
          <li key={copy.id} className="ev-part">
            <div className="desk-row ev-detail is-locked">
              <span className="ev-lead" aria-hidden="true">
                <Glyph name="page" size={22} weight={2} />
              </span>
              <RowWords title={copyLine(t, copy.recordedAt, copy.by, event.timeZone, locale)} />
            </div>
            <button type="button" className="desk-text ev-maps" onClick={() => download(copy.id)}>
              <DownloadMark />
              {t('kitchenSheet.copyDownload')}
            </button>
          </li>
        ))}
      </ul>
      {manage && (
        <button
          type="button"
          className="gs-pill is-primary ks-act ks-give"
          onClick={() => setGiving('rest')}
        >
          {t('kitchenSheet.give')}
        </button>
      )}
      {giving != null && (
        <Ask
          title={t('kitchenSheet.giveTitle')}
          line={t('kitchenSheet.giveBody')}
          keep={t('eventEdit.cancel')}
          go={giving === 'failed' ? t('kitchenSheet.retry') : t('kitchenSheet.download')}
          red={false}
          busy={giving === 'making' ? t('kitchenSheet.making') : undefined}
          failed={giving === 'failed' ? t('kitchenSheet.giveFailed') : undefined}
          onKeep={() => setGiving(null)}
          onGo={give}
        />
      )}
    </section>
  );
}

function DueRow({
  event,
  final,
  manage,
  open,
  locale,
  onOpen,
  onClose,
  onSaved,
}: {
  event: OrganisationEvent;
  final: FinalNumbers;
  manage: boolean;
  open: boolean;
  locale: string;
  onOpen: () => void;
  onClose: () => void;
  onSaved: (final: FinalNumbers) => void;
}) {
  const { t } = useTranslation();
  const words = (
    <span className={final.due == null ? 'ks-none' : undefined}>
      <RowWords
        title={final.due == null ? t('kitchenSheet.none') : shortDay(final.due, locale)}
        lines={[t('kitchenSheet.due')]}
      />
    </span>
  );
  const lead = (
    <span className="ev-lead" aria-hidden="true">
      <Glyph name="calendar" size={22} weight={2} />
    </span>
  );
  const until = final.picksOpenUntil;

  return (
    <li className="ev-part">
      {manage ? (
        <button
          type="button"
          className={open ? 'desk-row ev-detail is-lit' : 'desk-row ev-detail'}
          aria-expanded={open}
          onClick={onOpen}
        >
          {lead}
          {words}
          <Glyph name="chevron" size={17} weight={2.3} className="desk-chevron" />
        </button>
      ) : (
        <div className="desk-row ev-detail is-locked">
          {lead}
          {words}
        </div>
      )}
      {open ? (
        <DueEditor event={event} due={final.due} onClose={onClose} onSaved={onSaved} />
      ) : (
        until != null && (
          <p className="ks-picks">
            <Glyph name="info" size={15} weight={2.2} />
            {t('kitchenSheet.picksOpen', {
              date: shortDay(dayIn(new Date(until), event.timeZone), locale),
            })}
          </p>
        )
      )}
    </li>
  );
}

function DueEditor({
  event,
  due,
  onClose,
  onSaved,
}: {
  event: OrganisationEvent;
  due: string | null;
  onClose: () => void;
  onSaved: (final: FinalNumbers) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(due ?? '');
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const error = dueError(typed, due, event.startsAt, event.timeZone, new Date());
  const shown =
    refused ??
    (tried && error != null
      ? t(error === 'start' ? 'kitchenSheet.dueStart' : 'kitchenSheet.duePast')
      : null);
  const help = t('kitchenSheet.dueHelp', {
    start: shortDay(dayIn(new Date(event.startsAt), event.timeZone), dateLocale()),
    zone: event.timeZone,
  });
  const told = [`${id}-help`, shown == null ? null : `${id}-error`].filter(Boolean).join(' ');

  useEffect(() => {
    input.current?.focus();
  }, []);

  const save = () => {
    setTried(true);
    if (error != null) {
      input.current?.focus();
      return;
    }
    setBusy(true);
    api.setFinalNumbersDue(event.id, typed === '' ? null : typed).then(
      (next) => {
        setBusy(false);
        onSaved(next);
      },
      (failure: unknown) => {
        setBusy(false);
        setRefused(
          failure instanceof ApiError
            ? (failure.problem.violations?.find((one) => one.propertyPath === 'due')?.message ??
                failure.problem.title)
            : t('kitchenSheet.cannotReach'),
        );
        input.current?.focus();
      },
    );
  };

  return (
    <Opened
      label={t('kitchenSheet.due')}
      changed={typed !== (due ?? '')}
      busy={busy}
      onCancel={onClose}
      onSave={save}
    >
      <div className="desk-field">
        <div className="ks-label">
          <label htmlFor={id} className="desk-label">
            {t('kitchenSheet.due')}
          </label>
          <span className="gs-optional">{t('kitchenSheet.optional')}</span>
        </div>
        <div className={shown == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            ref={input}
            id={id}
            type="date"
            value={typed}
            aria-invalid={shown != null}
            aria-describedby={told}
            onChange={(change) => {
              setTyped(change.target.value);
              setRefused(null);
            }}
          />
          {typed !== '' && (
            <button
              type="button"
              className="ks-clear"
              aria-label={t('kitchenSheet.clearDue')}
              onClick={() => {
                setTyped('');
                setRefused(null);
                input.current?.focus();
              }}
            >
              <Glyph name="clear" size={12} weight={3} />
            </button>
          )}
        </div>
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
        {shown != null && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {shown}
          </p>
        )}
      </div>
    </Opened>
  );
}
