import { type CoverRefusal, coverDimensionsRefusal, coverFileRefusal } from '@soirely/domain';
import { useEffect, useRef } from 'react';

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

/** How a cover sent for upload ends, or `null` once a later pick, Remove or closing the block has made it stale. */
export type CoverSent<Landed> = { landed: Landed } | { refused: unknown } | null;

/** The pick check and the upload on its way, for the cover part and New event alike: only the last pick may go or land, Remove and closing the block make one on its way stale, and a stale copy is discarded when it lands (sc-60915). */
export function useCoverSending<Landed>(): {
  check: (file: File) => Promise<Awaited<ReturnType<typeof checkCoverPick>> | null>;
  send: (sending: Promise<Landed>, discard: (landed: Landed) => void) => Promise<CoverSent<Landed>>;
  stop: () => void;
  onItsWay: () => Promise<CoverSent<Landed>> | null;
} {
  const picks = useRef(0);
  const sends = useRef(0);
  const open = useRef(true);
  const onItsWay = useRef<Promise<CoverSent<Landed>> | null>(null);

  useEffect(() => {
    open.current = true;

    return () => {
      open.current = false;
      sends.current += 1;
      onItsWay.current = null;
    };
  }, []);

  async function check(file: File) {
    const mine = ++picks.current;
    const checked = await checkCoverPick(file);

    return open.current && mine === picks.current ? checked : null;
  }

  function send(
    sending: Promise<Landed>,
    discard: (landed: Landed) => void,
  ): Promise<CoverSent<Landed>> {
    const mine = ++sends.current;
    const last = (): boolean => {
      if (!open.current || mine !== sends.current) return false;
      onItsWay.current = null;
      return true;
    };
    const sent = sending.then(
      (landed): CoverSent<Landed> => {
        if (last()) return { landed };
        discard(landed);
        return null;
      },
      (error: unknown): CoverSent<Landed> => (last() ? { refused: error } : null),
    );
    onItsWay.current = sent;

    return sent;
  }

  function stop(): void {
    sends.current += 1;
    onItsWay.current = null;
  }

  return { check, send, stop, onItsWay: () => onItsWay.current };
}
