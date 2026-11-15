import { type CoverRefusal, coverDimensionsRefusal, coverFileRefusal } from '@soirely/domain';

export function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/** The checks a pick gets before it uploads, from Upload a photo or the dialog's own picker; `shows` is whether this browser can show the file. */
export async function checkCoverPick(
  file: File,
): Promise<{ refusal: CoverRefusal } | { refusal: null; shows: boolean }> {
  const refused = coverFileRefusal(file);
  if (refused != null) return { refusal: refused };

  const size = await imageSize(file);
  const tooSmall = coverDimensionsRefusal(size);

  return tooSmall == null ? { refusal: null, shows: size != null } : { refusal: tooSmall };
}
