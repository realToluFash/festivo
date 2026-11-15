import {
  COVER_TYPES,
  type CoverRefusal,
  coverDimensionsRefusal,
  coverFileRefusal,
} from '@soirely/domain';
import { useRef, useState } from 'react';

import { EVENT_WORDS as W } from './events.ts';

const COVER_ACCEPT = [...COVER_TYPES, '.heic', '.heif'].join(',');
const PICK_REFUSED: Record<CoverRefusal, string> = {
  type: W.refusedType,
  size: W.refusedSize,
  dimensions: W.refusedDimensions,
};

function sizeOf(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const done = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };

    image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => done(null);
    image.src = url;
  });
}

/** Upload's file chooser and its check of type, size and dimensions, so every cover picks a photo the same way. */
export function useCoverPick(onChosen: () => void, refused: string | null = null) {
  const [refusal, setRefusal] = useState<string | null>(refused);
  const file = useRef<HTMLInputElement>(null);

  const chosen = async (files: FileList | null) => {
    const one = files?.[0];
    if (file.current != null) file.current.value = '';
    if (one == null) return;

    const refusing = coverFileRefusal(one) ?? coverDimensionsRefusal(await sizeOf(one));
    if (refusing != null) return setRefusal(PICK_REFUSED[refusing]);

    setRefusal(null);
    onChosen();
  };

  const input = (
    <input
      ref={file}
      type="file"
      className="desk-unseen"
      accept={COVER_ACCEPT}
      tabIndex={-1}
      aria-hidden="true"
      onChange={(change) => void chosen(change.target.files)}
    />
  );

  return { input, pick: () => file.current?.click(), refusal, setRefusal };
}
