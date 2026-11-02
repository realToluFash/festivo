import { type EventCover as Cover } from '@soirely/api-client';
import {
  COVER_DESCRIPTION_MAXIMUM,
  COVER_MIDDLE,
  type CoverRefusal,
  type EventType,
  coverTypeOf,
  draggedPosition,
  positionPart,
} from '@soirely/domain';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import {
  type PickedPhoto,
  coverRefusalOf,
  photoOverflow,
  pickedFile,
  pickedRefusal,
} from '../kit/coverUpload.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { EventCover } from './EventCover.tsx';
import { Field, FieldError, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';

/** What Use this photo saves: a new photo when `upload` is set, and always the position and description. */
export type CoverUse = {
  upload: { key: string; preview: Cover } | null;
  position: number;
  description: string | null;
};

const POSITION_STEP = 10;

/** The photo chosen and not used goes, so its original is not kept with its GPS. */
export function discardCoverUpload(organisationId: string, key: string): void {
  void api.discardEventCoverUpload(organisationId, key).catch(() => undefined);
}

/** The form's Cover (sc-3590), as the web's CoverSection: the cover at 16:9, Upload a photo, and the Cover photo dialog. */
export function CoverField({
  type,
  cover,
  organisationId,
  busy,
  onUse,
  onRemove,
}: {
  type: EventType | '';
  cover: Cover | null;
  organisationId: string;
  busy: boolean;
  onUse: (use: CoverUse) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [refusal, setRefusal] = useState<CoverRefusal | null>(null);
  const [opened, setOpened] = useState<{ photo: PickedPhoto | null } | null>(null);
  const [removed, setRemoved] = useState(false);
  const coverButton = useRef<ViewInstance>(null);
  const uploadButton = useRef<ViewInstance>(null);
  const shownType = type === '' ? 'other' : type;

  async function choose(): Promise<void> {
    const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const photo = picked.canceled ? null : picked.assets[0];
    if (photo == null) return;

    const refused = pickedRefusal(photo);

    setRefusal(refused);
    setRemoved(false);
    if (refused == null) setOpened({ photo });
  }

  return (
    <>
      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold" accessibilityRole="header">
          {t('eventCover.heading')}
        </Text>
        {cover == null ? (
          <EventCover cover={null} type={shownType} testID="eventForm.cover" />
        ) : (
          <Pressable
            ref={coverButton}
            onPress={() => {
              setRemoved(false);
              setOpened({ photo: null });
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('eventCover.change')}
            testID="eventForm.cover.change"
          >
            <EventCover cover={cover} type={shownType} testID="eventForm.cover" />
            <View style={styles.pill}>
              <Text size={tokens.typePill.size} weight="semibold">
                {t('eventCover.change')}
              </Text>
            </View>
          </Pressable>
        )}
        {removed ? (
          <ReadOut words={t('eventCover.removed')}>
            <Notice tone="done" mark={tokens.marks.done.glyph} body={t('eventCover.removed')} />
          </ReadOut>
        ) : (
          cover == null && (
            <Text size={tokens.typeSmall.size} muted>
              {t('eventCover.defaultLine')}
            </Text>
          )
        )}
        <SecondaryButton
          ref={uploadButton}
          label={t('eventCover.upload')}
          onPress={() => void choose()}
          off={busy}
          testID="eventForm.cover.upload"
        />
        {refusal != null && <FieldError message={t(`eventCover.refused_${refusal}`)} />}
        <Text size={tokens.typeSmall.size} muted>
          {t('eventCover.accepted')}
        </Text>
      </View>

      <Sheet
        open={opened != null}
        onClose={() => setOpened(null)}
        opener={opened?.photo == null && cover != null ? coverButton : uploadButton}
        testID="eventForm.coverDialog"
      >
        {opened != null && (
          <CoverDialog
            photo={opened.photo}
            saved={cover}
            type={shownType}
            organisationId={organisationId}
            onUse={onUse}
            onRemove={async () => {
              await onRemove();
              setRemoved(true);
            }}
            onClose={() => setOpened(null)}
          />
        )}
      </Sheet>
    </>
  );
}

type Upload =
  | { kind: 'saved' }
  | { kind: 'uploading' }
  | { kind: 'ready'; key: string }
  | { kind: 'failed'; message: string };

/** Close and system back are Cancel, and only Use this photo saves. */
function CoverDialog({
  photo,
  saved,
  type,
  organisationId,
  onUse,
  onRemove,
  onClose,
}: {
  photo: PickedPhoto | null;
  saved: Cover | null;
  type: EventType;
  organisationId: string;
  onUse: (use: CoverUse) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [upload, setUpload] = useState<Upload>(
    photo == null ? { kind: 'saved' } : { kind: 'uploading' },
  );
  const [position, setPosition] = useState(
    photo == null ? (saved?.position ?? COVER_MIDDLE) : COVER_MIDDLE,
  );
  const [description, setDescription] = useState(photo == null ? (saved?.description ?? '') : '');
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState(
    photo == null ? { width: 0, height: 0 } : { width: photo.width, height: photo.height },
  );
  const kept = useRef(false);
  const describe = useRef<TextInputInstance>(null);

  const preview: Cover | null =
    photo == null
      ? null
      : { sizes: [{ width: photo.width, url: photo.uri }], position, description: null };
  const shown: Cover | null = preview ?? (saved == null ? null : { ...saved, position });
  const savedUrl = saved?.sizes.at(-1)?.url ?? null;

  useEffect(() => {
    if (photo != null || savedUrl == null) return;
    Image.getSize(savedUrl).then(setNatural, () => undefined);
  }, [photo, savedUrl]);

  useEffect(() => {
    if (photo == null) return;
    let current = true;
    let uploaded: string | null = null;
    const file = pickedFile(photo);

    api
      .signEventCoverUpload(organisationId, {
        contentType: coverTypeOf(file) ?? file.type,
        size: file.size,
        filename: file.name,
      })
      .then(async (signed) => {
        const body = await (await fetch(photo.uri)).blob();
        await api.uploadTo(signed, body);
        uploaded = signed.key;
        if (current) setUpload({ kind: 'ready', key: signed.key });
        else discardCoverUpload(organisationId, signed.key);
      })
      .catch((error: unknown) => {
        if (current) setUpload({ kind: 'failed', message: coverRefusalOf(error, t) });
      });

    return () => {
      current = false;
      if (uploaded != null && !kept.current) discardCoverUpload(organisationId, uploaded);
    };
  }, [photo, organisationId, t]);

  const overflow = photoOverflow(frame, natural);
  const dragFrom = useRef<{ y: number; start: number } | null>(null);

  const ready = upload.kind === 'saved' || upload.kind === 'ready';
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
        upload: upload.kind === 'ready' && preview != null ? { key: upload.key, preview } : null,
        position,
        description: trimmed === '' ? null : trimmed,
      });
      kept.current = true;
      onClose();
    } catch (error) {
      setPending(false);
      setFailure(coverRefusalOf(error, t));
    }
  }

  async function remove(): Promise<void> {
    if (pending) return;
    setPending(true);
    setFailure(null);

    try {
      await onRemove();
      onClose();
    } catch (error) {
      setPending(false);
      setFailure(coverRefusalOf(error, t));
    }
  }

  const showing = t(`eventCover.showing_${positionPart(position)}`);

  return (
    <ScrollView
      contentContainerStyle={styles.dialog}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!pending}
    >
      <View style={styles.dialogHead}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
          {t('eventCover.dialogTitle')}
        </Text>
        <QuietButton
          label={t('eventCover.close')}
          onPress={onClose}
          testID="eventForm.coverDialog.close"
        />
      </View>

      <View
        onStartShouldSetResponder={() => shown != null}
        onMoveShouldSetResponder={() => shown != null}
        onResponderTerminationRequest={() => false}
        onResponderGrant={({ nativeEvent }) => {
          dragFrom.current = { y: nativeEvent.pageY, start: position };
        }}
        onResponderMove={({ nativeEvent }) => {
          const from = dragFrom.current;
          if (from != null)
            setPosition(draggedPosition(from.start, nativeEvent.pageY - from.y, overflow));
        }}
        onResponderRelease={() => {
          dragFrom.current = null;
        }}
        onLayout={({ nativeEvent }) => setFrame(nativeEvent.layout)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('eventCover.position')}
        accessibilityValue={{ text: showing }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) =>
          setPosition((now) =>
            Math.min(
              100,
              Math.max(0, now + (nativeEvent.actionName === 'increment' ? 1 : -1) * POSITION_STEP),
            ),
          )
        }
        testID="eventForm.coverDialog.frame"
      >
        <EventCover cover={shown} type={type} />
        {upload.kind === 'uploading' && (
          <ReadOut words={t('eventCover.uploading')} style={styles.frameState}>
            <Text size={tokens.typeBody.size} weight="semibold">
              {t('eventCover.uploading')}
            </Text>
          </ReadOut>
        )}
      </View>
      <View style={styles.marks} importantForAccessibility="no-hide-descendants">
        <Text size={tokens.typeSmall.size} muted>
          {t('eventCover.top')}
        </Text>
        <Text size={tokens.typeSmall.size} muted>
          {t('eventCover.bottom')}
        </Text>
      </View>

      {upload.kind === 'failed' && (
        <Notice tone="broken" mark={tokens.marks.broken.glyph} body={upload.message} announce />
      )}

      <Field
        label={t('eventCover.describe')}
        pill={t('eventCover.optional')}
        error={descriptionError}
        help={[
          t('eventCover.describeHint'),
          t('eventCover.describeCount', { count, most: COVER_DESCRIPTION_MAXIMUM }),
        ]}
      >
        <TextField
          ref={describe}
          value={description}
          onChangeText={(next) => {
            setDescription(next);
            setDescriptionError(undefined);
          }}
          wrong={descriptionError != null}
          multiline
          accessibilityLabel={t('eventCover.describe')}
          testID="eventForm.coverDialog.describe"
        />
      </Field>

      {failure != null && (
        <Notice tone="broken" mark={tokens.marks.broken.glyph} body={failure} announce />
      )}

      <PrimaryButton
        label={pending ? t('eventCover.saving') : t('eventCover.use')}
        onPress={() => void use()}
        busy={pending}
        off={!ready}
        testID="eventForm.coverDialog.use"
      />
      <SecondaryButton
        label={t('eventCover.cancel')}
        onPress={onClose}
        off={pending}
        stacked
        testID="eventForm.coverDialog.cancel"
      />
      {saved != null && (
        <SecondaryButton
          label={t('eventCover.remove')}
          onPress={() => void remove()}
          off={pending}
          stacked
          testID="eventForm.coverDialog.remove"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: { gap: tokens.spaceSm },
  pill: {
    position: 'absolute',
    right: tokens.spaceSm,
    bottom: tokens.spaceSm,
    minHeight: tokens.sizePill,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorCard,
  },
  dialog: { gap: tokens.spaceLg, padding: tokens.spaceXl },
  dialogHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  frameState: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
    opacity: 0.85,
  },
  marks: { flexDirection: 'row', justifyContent: 'space-between' },
});
