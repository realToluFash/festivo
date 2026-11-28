export interface TappedSwitch {
  id: string;
}

export interface TappedSwitches {
  /** The frame of a screen in view, told of each tapped switch as it lands; returns what stops it. */
  listen(frame: (answer: TappedSwitch) => void): () => void;
  /** A switch into `id` the person tapped for has landed. */
  landed(id: string): void;
}

/** Tells the screen in view of a tapped switch of organisation as it lands, so its heading takes screen reader focus, and keeps nothing for a screen opened later (sc-11032). */
export function tappedSwitches(): TappedSwitches {
  const frames = new Set<(answer: TappedSwitch) => void>();

  return {
    listen(frame) {
      frames.add(frame);

      return () => {
        frames.delete(frame);
      };
    },
    landed(id) {
      const answer = { id };
      for (const frame of frames) frame(answer);
    },
  };
}
