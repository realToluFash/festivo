const TICKING = 'onmessage = (event) => { setInterval(() => postMessage(0), event.data); };';

/** Calls `tick` every `ms` from a dedicated worker, whose timers keep time in a tab hidden for minutes where the page's own are held to one a minute; from the page's own where no worker can be made. */
export function steadyTicks(ms: number, tick: () => void): () => void {
  let url: string | null = null;
  let worker: Worker | null = null;
  try {
    url = URL.createObjectURL(new Blob([TICKING], { type: 'text/javascript' }));
    worker = new Worker(url);
  } catch {
    if (url != null) URL.revokeObjectURL(url);
    const every = setInterval(tick, ms);

    return () => clearInterval(every);
  }
  const ticking = worker;
  ticking.onmessage = () => tick();
  ticking.postMessage(ms);

  return () => {
    ticking.terminate();
    URL.revokeObjectURL(url);
  };
}
