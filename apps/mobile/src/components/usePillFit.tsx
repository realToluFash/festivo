import { type ReactNode, useState } from 'react';

import { nameStart, pillShowsWords } from '../layout/pillFit.ts';
import { MeasuredWords } from './Title.tsx';

/** Beside an upright tablet's tabs, whether the pill is its tile alone, from its words measured on the device; `measure` draws them hidden and goes beside the pill (sc-38149). */
export function usePillFit(
  name: string,
  waiting: string | null,
  room: number | undefined,
  large: boolean,
): { tileAlone: boolean; measure: ReactNode } {
  const start = nameStart(name);
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const widths = {
    nameStart: measured[`name|${start}`] ?? 0,
    waitingLine: waiting == null ? null : (measured[`waiting|${waiting}`] ?? 0),
  };
  const onWidth = (kind: string) => (word: string, width: number) => {
    const key = `${kind}|${word}`;
    setMeasured((now) => (now[key] === width ? now : { ...now, [key]: width }));
  };

  return {
    tileAlone: room != null && !pillShowsWords(room, widths, large),
    measure: room != null && (
      <>
        <MeasuredWords words={[start]} size={15} weight="semibold" onWidth={onWidth('name')} />
        {waiting != null && (
          <MeasuredWords
            words={[waiting]}
            size={12.5}
            weight="semibold"
            onWidth={onWidth('waiting')}
          />
        )}
      </>
    ),
  };
}
