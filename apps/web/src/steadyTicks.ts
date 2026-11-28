/** Calls `tick` every `ms` from a dedicated worker, whose timers keep time in a tab hidden for minutes where the page's own are held to one a minute; from the page's own where no worker can be made or the page's policy refuses it. */
export function steadyTicks(ms: number, tick: () => void): () => void {
  let every: ReturnType<typeof setInterval> | null = null;
  const fallBack = (): void => {
    every ??= setInterval(tick, ms);
  };
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./ticks.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = () => tick();
    worker.onerror = () => {
      worker?.terminate();
      fallBack();
    };
    worker.postMessage(ms);
  } catch {
    fallBack();
  }

  return () => {
    worker?.terminate();
    if (every != null) clearInterval(every);
  };
}
