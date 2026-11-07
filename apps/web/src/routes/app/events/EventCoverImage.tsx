import type { EventCover } from '@soirely/api-client';
import type { EventType } from '@soirely/domain';
import { useLayoutEffect, useRef, useState } from 'react';

/** A photo to show: a saved cover, or one just chosen, shown from the file before it is saved. */
export type CoverPhoto = Pick<EventCover, 'position' | 'description' | 'sizes'>;

/** Its photo, or its type's default (sc-3590), in a 16:9 box reserved before it loads. A photo that fails to load shows the default, decorative as it always is (sc-13861). */
export function EventCoverImage({
  photo,
  type,
  sizes,
  className = '',
  onFail,
}: {
  photo: CoverPhoto | null;
  type: EventType | '';
  sizes: string;
  className?: string;
  onFail?: () => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const position = photo?.position;
  const first = photo?.sizes[0];
  const [failed, setFailed] = useState<string | null>(null);

  // Through the CSSOM: the CSP has no 'unsafe-inline', which governs a style attribute too.
  useLayoutEffect(() => {
    if (image.current != null && position != null)
      image.current.style.objectPosition = `50% ${position}%`;
  }, [position]);

  if (photo == null || (first != null && failed === first.url)) {
    return (
      <span
        className={`cover cover-default cover-default-${(type === '' ? 'other' : type).replace('_', '-')} ${className}`}
        data-testid="cover-default"
      />
    );
  }

  return (
    <span className={`cover ${className}`}>
      <img
        ref={image}
        src={first?.url}
        srcSet={
          photo.sizes.length > 1
            ? photo.sizes.map(({ width, url }) => `${url} ${width}w`).join(', ')
            : undefined
        }
        sizes={photo.sizes.length > 1 ? sizes : undefined}
        alt={photo.description ?? ''}
        draggable={false}
        onError={() => {
          setFailed(first?.url ?? null);
          onFail?.();
        }}
      />
    </span>
  );
}
