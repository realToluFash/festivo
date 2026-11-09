import { useTranslation } from 'react-i18next';

import { type Mesh } from '../mesh.ts';
import { Glyph } from './Glyph.tsx';
import { type Shown, SHOWN_WORD, tagKind } from './eventShown.ts';
import { Tag } from './SettingsParts.tsx';
import './EventParts.css';

export function PhaseTag({ shown }: { shown: Shown }) {
  const { t } = useTranslation();

  return <Tag kind={tagKind(shown)} word={t(SHOWN_WORD[shown])} />;
}

/** The event's cover at a size, or its colour from meshFor while it has no photo; `photo` is the cover's address, or true for a cover the demo only stands in for. */
export function Thumb({
  event,
  size,
}: {
  event: { mesh: Mesh; photo: boolean | string };
  size: 28 | 40 | 48;
}) {
  if (typeof event.photo === 'string')
    return (
      <span className={`ev-thumb is-${size} is-photo`} aria-hidden="true">
        <img src={event.photo} alt="" />
      </span>
    );

  return event.photo ? (
    <span className={`ev-thumb is-${size} is-photo`} aria-hidden="true">
      <Glyph name="photo" size={Math.round(size / 2)} weight={1.8} />
    </span>
  ) : (
    <span className={`ev-thumb is-${size} today-cover is-${event.mesh}`} aria-hidden="true" />
  );
}
