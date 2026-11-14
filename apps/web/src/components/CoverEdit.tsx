import { type EventCover } from '@soirely/api-client';
import { COVER_DESCRIPTION_MAXIMUM, COVER_MIDDLE, positionPart } from '@soirely/domain';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { checkCoverPick } from '../coverPick.ts';
import type { Mesh } from '../mesh.ts';
import { Photo } from './EventCard.tsx';
import { Broken, EditText, Opened } from './EventPageParts.tsx';
import { Glyph } from './Glyph.tsx';
import { RedAction } from './SettingsParts.tsx';

export type CoverUploaded = { key: string; url: string };

export type CoverEdited = {
  upload: CoverUploaded | null;
  removed: boolean;
  position: number;
  description: string | null;
};

/** Where the edit opens, for the design demo's states; the product always opens on what is saved. */
export type CoverStart = {
  uploading?: Promise<CoverUploaded>;
  chosen?: CoverUploaded;
  pickRefused?: string;
  saveRefused?: string;
};

function wordsOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
const PIECES = [1, 2, 3, 4, 5, 6];

/** A pick reaches the preview only once `upload` has it, so a refused one never does (sc-16524, sc-17978); `upload` and `save` reject with the words to show. */
export function CoverEdit<Saved>({
  mesh,
  saved,
  standIn = false,
  start = {},
  upload,
  discard,
  save,
  onSaved,
  onDirty,
  onClose,
}: {
  mesh: Mesh;
  saved: EventCover | null;
  standIn?: boolean;
  start?: CoverStart;
  /** `shows` is whether this browser can show the file itself; a HEIC outside Safari cannot. */
  upload: (file: File, shows: boolean) => Promise<CoverUploaded>;
  discard: (uploaded: CoverUploaded) => void;
  save: (change: CoverEdited) => Promise<Saved>;
  onSaved: (saved: Saved) => void;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const savedPosition = saved?.position ?? COVER_MIDDLE;
  const savedDescription = saved?.description ?? '';
  const [chosen, setChosen] = useState<CoverUploaded | null>(start.chosen ?? null);
  const [removed, setRemoved] = useState(false);
  const [uploading, setUploading] = useState(start.uploading != null);
  const [position, setPosition] = useState(start.chosen == null ? savedPosition : COVER_MIDDLE);
  const [description, setDescription] = useState(start.chosen == null ? savedDescription : '');
  const [tooLong, setTooLong] = useState(false);
  const [pickRefused, setPickRefused] = useState<string | null>(start.pickRefused ?? null);
  const [saveRefused, setSaveRefused] = useState<string | null>(start.saveRefused ?? null);
  const [savedFailed, setSavedFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLButtonElement>(null);
  const describe = useRef<HTMLInputElement>(null);
  const picks = useRef(0);
  const uploads = useRef(0);
  const held = useRef(chosen);
  const open = useRef(true);
  const focusPicker = useRef(true);

  const photo: EventCover | null =
    chosen != null
      ? { sizes: [{ width: 0, url: chosen.url }], position, description: null }
      : removed || saved == null || savedFailed
        ? null
        : { ...saved, position };
  const count = Array.from(description).length;
  const changed =
    chosen != null ||
    (removed && saved != null) ||
    (photo != null && (position !== savedPosition || description !== savedDescription));

  held.current = chosen;
  useEffect(() => onDirty(changed || uploading), [changed, uploading, onDirty]);
  useEffect(() => {
    if (!focusPicker.current) return;
    focusPicker.current = false;
    picker.current?.focus();
  });
  useEffect(() => {
    const first = start.uploading;
    if (first != null) follow(first, ++uploads.current);

    return () => {
      open.current = false;
      if (held.current != null) discard(held.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the design demo's first upload is followed once, on opening.
  }, []);

  function follow(uploadingNow: Promise<CoverUploaded>, mine: number): void {
    uploadingNow.then(
      (uploaded) => {
        if (!open.current || mine !== uploads.current) return discard(uploaded);
        if (held.current != null) discard(held.current);
        focusPicker.current = document.activeElement === picker.current;
        setChosen(uploaded);
        setRemoved(false);
        setPosition(COVER_MIDDLE);
        setDescription('');
        setTooLong(false);
        setSaveRefused(null);
        setUploading(false);
      },
      (error: unknown) => {
        if (!open.current || mine !== uploads.current) return;
        setUploading(false);
        setPickRefused(wordsOf(error));
      },
    );
  }

  async function pick(file: File | undefined): Promise<void> {
    if (fileInput.current != null) fileInput.current.value = '';
    if (file == null) return;

    const mine = ++picks.current;
    const checked = await checkCoverPick(file);
    if (!open.current || mine !== picks.current) return;

    if (checked.refusal != null) {
      setPickRefused(t(`eventCover.refused_${checked.refusal}`));
      return;
    }

    setPickRefused(null);
    setUploading(true);
    follow(upload(file, checked.shows), ++uploads.current);
  }

  function remove(): void {
    uploads.current += 1;
    if (chosen != null) discard(chosen);
    setChosen(null);
    setRemoved(true);
    setUploading(false);
    setPickRefused(null);
    setTooLong(false);
    focusPicker.current = true;
  }

  async function send(): Promise<void> {
    if (count > COVER_DESCRIPTION_MAXIMUM) {
      setTooLong(true);
      describe.current?.focus();
      return;
    }

    const trimmed = description.trim();

    setBusy(true);
    let result: Saved;
    try {
      result = await save({
        upload: chosen,
        removed: removed && chosen == null,
        position,
        description: trimmed === '' ? null : trimmed,
      });
    } catch (error) {
      if (!open.current) return;
      setBusy(false);
      setSaveRefused(wordsOf(error));
      return;
    }
    held.current = null;
    onSaved(result);
  }

  const part = positionPart(position);

  return (
    <Opened
      label={t('eventCover.heading')}
      changed={changed && !uploading}
      unsaved={changed || uploading}
      busy={busy}
      verb={photo != null && saved == null ? t('eventCover.use') : t('eventPage.save')}
      onCancel={onClose}
      onSave={() => void send()}
    >
      {saveRefused != null && <Broken>{saveRefused}</Broken>}
      <input
        ref={fileInput}
        type="file"
        className="desk-unseen"
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(change) => void pick(change.target.files?.[0])}
      />
      <div className="ev-cover-frame">
        <div
          className={photo == null ? `ev-preview today-cover is-${mesh}` : 'ev-preview is-photo'}
          aria-hidden="true"
        >
          {photo != null && !standIn && (
            <Photo
              photo={photo}
              sizes="(min-width: 1280px) 600px, 100vw"
              onFail={() => {
                if (chosen == null) return setSavedFailed(true);
                discard(chosen);
                setChosen(null);
                setPickRefused(t('eventCover.uploadFailed'));
              }}
            />
          )}
          {(photo == null || standIn) && <span className="ev-scrim" />}
          {photo == null
            ? PIECES.map((piece) => <span key={piece} className={`desk-piece p${piece}`} />)
            : standIn && <Glyph name="photo" size={56} weight={1.6} />}
        </div>
        {uploading && (
          <p className="ev-cover-uploading" role="status">
            {t('eventCover.uploading')}
          </p>
        )}
      </div>
      {photo != null ? (
        <>
          {pickRefused != null && <Broken>{pickRefused}</Broken>}
          <button
            ref={picker}
            type="button"
            className="desk-text"
            onClick={() => fileInput.current?.click()}
          >
            {t('eventCover.change')}
          </button>
          <div className="desk-field">
            <label htmlFor={`${id}-position`} className="desk-label">
              {t('eventCover.position')}
            </label>
            <input
              id={`${id}-position`}
              type="range"
              className="ev-slider"
              min={0}
              max={100}
              step={1}
              value={position}
              aria-valuetext={t(`eventCover.showing_${part}`)}
              onChange={(change) => setPosition(Number(change.target.value))}
            />
            <div className="ev-slider-ends" aria-hidden="true">
              <span>{t('eventCover.top')}</span>
              <span>{t('eventCover.bottom')}</span>
            </div>
            <p className="desk-help">{t(`eventCover.showing_${part}`)}</p>
          </div>
          <EditText
            label={t('eventCover.describe')}
            optional
            value={description}
            inputRef={describe}
            error={
              tooLong ? t('eventCover.describeTooLong', { most: COVER_DESCRIPTION_MAXIMUM }) : null
            }
            help={`${t('eventCover.describeHint')} ${t('eventCover.describeCount', { count, most: COVER_DESCRIPTION_MAXIMUM })}`}
            input={{ autoComplete: 'off' }}
            onChange={(value) => {
              setDescription(value);
              setTooLong(false);
            }}
          />
          <RedAction
            label={t('eventCover.remove')}
            line={t('eventCover.removeLine')}
            onClick={remove}
          />
        </>
      ) : (
        <>
          {pickRefused != null ? (
            <Broken>{pickRefused}</Broken>
          ) : (
            <p className="desk-line">{t('eventCover.coverLine')}</p>
          )}
          <button
            ref={picker}
            type="button"
            className="ev-upload"
            aria-describedby={`${id}-accepted`}
            onClick={() => fileInput.current?.click()}
          >
            <Glyph name="photo" size={19} weight={2.2} />
            {t('eventCover.upload')}
          </button>
          <p id={`${id}-accepted`} className="desk-help">
            {t('eventCover.accepted')}
          </p>
        </>
      )}
    </Opened>
  );
}
