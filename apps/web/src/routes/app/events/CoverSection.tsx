import {
  COVER_DESCRIPTION_MAXIMUM,
  COVER_MIDDLE,
  type CoverRefusal,
  type EventType,
  coverTypeOf,
  draggedPosition,
  positionPart,
} from '@soirely/domain';
import {
  type ChangeEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';
import { FieldError } from './EventFields.tsx';
import { type CoverPhoto, EventCoverImage } from './EventCoverImage.tsx';
import { checkCoverPick, discardCoverUpload, refusalOf } from './coverPhoto.ts';

/** What Use this photo saves: a new photo when `upload` is set, and always the position and description. */
export type CoverUse = {
  upload: { key: string; preview: CoverPhoto } | null;
  position: number;
  description: string | null;
};

/** `shows` is whether this browser can show the file itself; a HEIC outside Safari cannot, so the server's copy stands in. */
type Opened = { file: File | null; shows: boolean; from: 'cover' | 'upload' };

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
const FULL_SCREEN = '(width <= 40rem)';

/** Below 640 px the dialog fills the screen and Remove photo moves from the footer into the body. */
function useFullScreen(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(FULL_SCREEN);
      query.addEventListener('change', changed);

      return () => query.removeEventListener('change', changed);
    },
    () => window.matchMedia(FULL_SCREEN).matches,
  );
}

/** The form's Cover section (sc-3590): the cover at 16:9, Upload a photo, and the Cover photo dialog. */
export function CoverSection({
  type,
  photo,
  organisationId,
  onUse,
  onRemove,
}: {
  type: EventType | '';
  photo: CoverPhoto | null;
  organisationId: string;
  onUse: (use: CoverUse) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [refusal, setRefusal] = useState<CoverRefusal | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [removed, setRemoved] = useState(false);
  const coverButton = useRef<HTMLButtonElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const focusNext = useRef<'cover' | 'upload' | null>(null);

  useEffect(() => {
    if (opened != null || focusNext.current == null) return;

    (focusNext.current === 'cover' ? coverButton : uploadButton).current?.focus();
    focusNext.current = null;
  });

  async function choose(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file == null) return;

    const checked = await checkCoverPick(file);

    setRefusal(checked.refusal);
    setRemoved(false);
    if (checked.refusal == null) setOpened({ file, shows: checked.shows, from: 'upload' });
  }

  const close = useCallback(
    (focus: 'opener' | 'cover' | 'upload', wasRemoved = false) => {
      focusNext.current = focus === 'opener' ? (opened?.from ?? 'upload') : focus;
      setRemoved(wasRemoved);
      setOpened(null);
    },
    [opened],
  );

  return (
    <section className="card" aria-labelledby="event-cover">
      <h2 id="event-cover">{t('eventCover.heading')}</h2>
      <div className="cover-field">
        {photo == null ? (
          <EventCoverImage photo={null} type={type} sizes="" className="cover-field-image" />
        ) : (
          <button
            ref={coverButton}
            type="button"
            className="cover-field-image cover-control"
            aria-labelledby="cover-change"
            onClick={() => {
              setRemoved(false);
              setOpened({ file: null, shows: true, from: 'cover' });
            }}
          >
            <EventCoverImage photo={photo} type={type} sizes="(width < 43.75rem) 100vw, 27.5rem" />
            <span className="cover-pill" id="cover-change">
              <PencilIcon />
              {t('eventCover.change')}
            </span>
          </button>
        )}
        <div className="cover-field-side">
          {removed ? (
            <RemovedLine words={t('eventCover.removed')} />
          ) : (
            photo == null && <p className="field-help">{t('eventCover.defaultLine')}</p>
          )}
          <input
            ref={fileInput}
            id="cover-file"
            className="visually-hidden"
            type="file"
            accept={ACCEPT}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void choose(event)}
          />
          <button
            ref={uploadButton}
            id="cover-upload"
            type="button"
            className="button cover-upload"
            aria-describedby={refusal == null ? 'cover-accepted' : 'cover-refusal cover-accepted'}
            onClick={() => fileInput.current?.click()}
          >
            {t('eventCover.upload')}
          </button>
          <FieldError
            id="cover-refusal"
            message={refusal == null ? undefined : t(`eventCover.refused_${refusal}`)}
          />
          <p className="field-help" id="cover-accepted">
            {t('eventCover.accepted')}
          </p>
        </div>
      </div>

      {opened != null && (
        <CoverDialog
          file={opened.file}
          shows={opened.shows}
          saved={photo}
          type={type}
          organisationId={organisationId}
          onUse={onUse}
          onRemove={onRemove}
          onClose={close}
        />
      )}
    </section>
  );
}

/** Filled a moment after the region is in the page, so a screen reader hears it rather than missing a region born full. */
function RemovedLine({ words }: { words: string }) {
  const [said, setSaid] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setSaid(words), 0);

    return () => window.clearTimeout(id);
  }, [words]);

  return (
    <p className="cover-removed" role="status">
      {said !== '' && <CheckIcon />}
      {said}
    </p>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M11 2.5 13.5 5 5.5 13H3v-2.5z" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="7.5" />
      <path d="m5.75 9.25 2.25 2.25 4.25-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A pick on its way through the checks the server makes; `local` is null when this browser cannot show the file itself. */
type Trying = { file: File; local: string | null };

function newTrying(file: File, shows: boolean): Trying {
  return { file, local: shows ? URL.createObjectURL(file) : null };
}

/** A pick the server has read: `url` is the browser's own object URL when `local`, otherwise the server's copy. */
type Chosen = { key: string; url: string; local: boolean };

function pickPhoto(url: string, position: number): CoverPhoto {
  return { sizes: [{ width: 0, url }], position, description: null };
}

/** Modal, as the APG dialog: focus starts on the slider, Tab wraps, Escape and Close are Cancel, and only Use this photo saves. A refused pick never reaches the frame (sc-16524). */
function CoverDialog({
  file,
  shows,
  saved,
  type,
  organisationId,
  onUse,
  onRemove,
  onClose,
}: {
  file: File | null;
  shows: boolean;
  saved: CoverPhoto | null;
  type: EventType | '';
  organisationId: string;
  onUse: (use: CoverUse) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: (focus: 'opener' | 'cover' | 'upload', removed?: boolean) => void;
}) {
  const { t } = useTranslation();
  const savedFrame = {
    position: saved?.position ?? COVER_MIDDLE,
    description: saved?.description ?? '',
  };
  const [trying, setTrying] = useState<Trying | null>(() =>
    file == null ? null : newTrying(file, shows),
  );
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [position, setPosition] = useState(file == null ? savedFrame.position : COVER_MIDDLE);
  const [description, setDescription] = useState(file == null ? savedFrame.description : '');
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const describe = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const before = useRef(savedFrame);
  const focusNext = useRef<'slider' | 'picker' | null>('slider');
  const kept = useRef(false);
  const fullScreen = useFullScreen();
  const drag = useRef<{ y: number; start: number } | null>(null);

  useEffect(() => {
    if (focusNext.current == null) return;

    (focusNext.current === 'slider' ? slider : picker).current?.focus();
    focusNext.current = null;
  });

  const refuse = useCallback((message: string) => {
    setTrying(null);
    setPosition(before.current.position);
    setDescription(before.current.description);
    setDescriptionError(undefined);
    setRefusal(message);
    focusNext.current = 'picker';
  }, []);

  useEffect(() => {
    if (trying == null) return;
    const url = trying.local;
    let current = true;
    let uploaded: string | null = null;
    let promoted = false;

    api
      .signEventCoverUpload(organisationId, {
        contentType: coverTypeOf(trying.file) ?? trying.file.type,
        size: trying.file.size,
        filename: trying.file.name,
      })
      .then(async (signed) => {
        await api.uploadTo(signed, trying.file);
        uploaded = signed.key;
        if (!current) return discardCoverUpload(organisationId, signed.key);

        // The server reads every new photo whole, so a damaged JPEG the browser sized is refused here, not saved grey.
        const copy = await api.previewEventCoverUpload(organisationId, signed.key);
        if (!current) return;
        promoted = true;
        setChosen({ key: signed.key, url: url ?? copy, local: url != null });
        setTrying(null);
      })
      .catch((error: unknown) => {
        if (current) refuse(refusalOf(error, t));
      });

    return () => {
      current = false;
      if (promoted) return;
      if (url != null) URL.revokeObjectURL(url);
      if (uploaded != null) discardCoverUpload(organisationId, uploaded);
    };
  }, [trying, organisationId, refuse, t]);

  useEffect(
    () => () => {
      if (chosen == null || kept.current) return;
      if (chosen.local) URL.revokeObjectURL(chosen.url);
      discardCoverUpload(organisationId, chosen.key);
    },
    [chosen, organisationId],
  );

  const cancel = useCallback(() => onClose('opener'), [onClose]);

  useDialogKeys(dialog, cancel, pending);

  /** A new photo the frame could not show is never saved unseen (sc-13861). */
  function unseen(): void {
    if (trying != null) return refuse(t('eventCover.uploadFailed'));
    if (chosen == null) return;

    before.current = savedFrame;
    setChosen(null);
    refuse(t('eventCover.uploadFailed'));
  }

  async function pick(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const next = event.target.files?.[0];
    event.target.value = '';
    if (next == null) return;

    const checked = await checkCoverPick(next);
    if (checked.refusal != null) {
      setRefusal(t(`eventCover.refused_${checked.refusal}`));
      focusNext.current = 'picker';
      return;
    }

    if (trying == null) before.current = chosen == null ? savedFrame : { position, description };
    setTrying(newTrying(next, checked.shows));
    setRefusal(null);
    setPosition(COVER_MIDDLE);
    setDescription('');
    setDescriptionError(undefined);
    focusNext.current = 'slider';
  }

  const shown: CoverPhoto | null | 'choose' =
    trying != null
      ? trying.local == null
        ? null
        : pickPhoto(trying.local, position)
      : chosen != null
        ? pickPhoto(chosen.url, position)
        : saved != null
          ? { ...saved, position }
          : 'choose';
  const ready = trying == null && shown !== 'choose';
  const count = [...description].length;

  async function use(): Promise<void> {
    if (!ready || pending) return;
    if (count > COVER_DESCRIPTION_MAXIMUM) {
      setDescriptionError(t('eventCover.describeTooLong', { most: COVER_DESCRIPTION_MAXIMUM }));
      describe.current?.focus();
      return;
    }

    const trimmed = description.trim();
    setPending(true);
    setFailure(null);

    try {
      await onUse({
        upload:
          chosen == null ? null : { key: chosen.key, preview: pickPhoto(chosen.url, position) },
        position,
        description: trimmed === '' ? null : trimmed,
      });
      kept.current = true;
      onClose('cover');
    } catch (error) {
      setPending(false);
      setFailure(refusalOf(error, t));
    }
  }

  async function remove(): Promise<void> {
    if (pending) return;
    setPending(true);
    setFailure(null);

    try {
      await onRemove();
      onClose('upload', true);
    } catch (error) {
      setPending(false);
      setFailure(refusalOf(error, t));
    }
  }

  const pickerButton = (
    <button
      ref={picker}
      type="button"
      className="button cover-dialog-picker"
      aria-describedby={
        [refusal != null && 'cover-dialog-refusal', shown === 'choose' && 'cover-dialog-accepted']
          .filter(Boolean)
          .join(' ') || undefined
      }
      {...offButton(pending, { dim: false })}
      onClick={() => fileInput.current?.click()}
    >
      {shown === 'choose' ? t('eventCover.choose') : t('eventCover.chooseAnother')}
    </button>
  );

  const removeButton = (
    <button
      type="button"
      className="button cover-remove"
      {...offButton(pending)}
      onClick={() => void remove()}
    >
      {t('eventCover.remove')}
    </button>
  );

  function startDrag(event: PointerEvent<HTMLDivElement>): void {
    if (shown == null || shown === 'choose') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, start: position };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>): void {
    const image = event.currentTarget.querySelector('img');
    if (drag.current == null || image == null || image.naturalWidth === 0) return;

    const frame = event.currentTarget.getBoundingClientRect();
    const overflow = (frame.width * image.naturalHeight) / image.naturalWidth - frame.height;

    setPosition(draggedPosition(drag.current.start, event.clientY - drag.current.y, overflow));
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog cover-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-dialog-title"
        tabIndex={-1}
      >
        <div className="cover-dialog-header">
          <h2 id="cover-dialog-title">{t('eventCover.dialogTitle')}</h2>
          <button
            type="button"
            className="cover-dialog-close"
            aria-label={t('eventCover.close')}
            {...offButton(pending, { dim: false })}
            onClick={cancel}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="cover-dialog-body">
          {shown === 'choose' ? (
            <div className="cover-choose">
              {pickerButton}
              <p className="field-help" id="cover-dialog-accepted">
                {t('eventCover.accepted')}
              </p>
            </div>
          ) : (
            <div
              className="cover-frame"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <EventCoverImage
                photo={shown}
                type={type}
                sizes="(width <= 40rem) 100vw, 45rem"
                onFail={unseen}
              />
              {trying != null && (
                <p className="cover-frame-state" role="status">
                  {t('eventCover.uploading')}
                </p>
              )}
            </div>
          )}
          <div className="cover-dialog-pick">
            <input
              ref={fileInput}
              id="cover-dialog-file"
              className="visually-hidden"
              type="file"
              accept={ACCEPT}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void pick(event)}
            />
            {shown !== 'choose' && pickerButton}
            <FieldError id="cover-dialog-refusal" message={refusal ?? undefined} />
          </div>

          {shown !== 'choose' && (
            <>
              <div className="field">
                <label htmlFor="cover-position">{t('eventCover.position')}</label>
                <input
                  ref={slider}
                  id="cover-position"
                  className="cover-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={position}
                  aria-valuetext={t(`eventCover.showing_${positionPart(position)}`)}
                  aria-disabled={shown == null}
                  onChange={(event) => {
                    if (shown != null) setPosition(Number(event.target.value));
                  }}
                />
                <div className="cover-slider-marks" aria-hidden="true">
                  <span>{t('eventCover.top')}</span>
                  <span>{t('eventCover.bottom')}</span>
                </div>
              </div>

              <div className="field">
                <label htmlFor="cover-description">
                  {t('eventCover.describe')}
                  <span className="cover-optional">{t('eventCover.optional')}</span>
                </label>
                <textarea
                  ref={describe}
                  id="cover-description"
                  className={descriptionError == null ? 'input' : 'input input-wrong'}
                  rows={2}
                  value={description}
                  aria-invalid={descriptionError != null}
                  aria-describedby={
                    descriptionError == null
                      ? 'cover-description-hint cover-description-count'
                      : 'cover-description-error cover-description-hint cover-description-count'
                  }
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setDescriptionError(undefined);
                  }}
                />
                <FieldError id="cover-description-error" message={descriptionError} />
                <p className="field-help" id="cover-description-hint">
                  {t('eventCover.describeHint')}
                </p>
                <p className="field-help" id="cover-description-count">
                  {t('eventCover.describeCount', { count, most: COVER_DESCRIPTION_MAXIMUM })}
                </p>
              </div>
            </>
          )}

          {saved != null && fullScreen && <div className="cover-remove-below">{removeButton}</div>}

          {failure != null && (
            <div className="notice notice-broken" role="alert">
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <p className="notice-title">{failure}</p>
            </div>
          )}
        </div>

        <div className="dialog-actions cover-dialog-actions">
          {saved != null && !fullScreen && removeButton}
          <div className="cover-dialog-confirm">
            <button
              type="button"
              className="button"
              {...offButton(pending, { dim: false })}
              onClick={cancel}
            >
              {t('eventCover.cancel')}
            </button>
            <button
              type="button"
              className="button button-primary"
              {...offButton(!ready || pending)}
              aria-busy={pending}
              onClick={() => void use()}
            >
              {pending ? t('eventCover.saving') : t('eventCover.use')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
