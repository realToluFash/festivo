export function motion(name: 'motionFast' | 'motionBase' | 'motionSlow'): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`)) || 0;
}

export function easing(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--motionEase').trim();
}

export function lessMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** React has already removed the dialog, so an unreachable copy plays its exit in its place. */
export function leaveDialog(dialog: HTMLElement, scrim: Element | null, parent: Element): void {
  if (typeof dialog.animate !== 'function') return;

  const host = parent.isConnected ? parent : document.body;
  const sheet = window.matchMedia('(width <= 40rem)').matches && !lessMotion();
  const duration = sheet ? motion('motionBase') : motion('motionFast');
  const copies = [scrim, dialog].flatMap((node) => {
    if (node == null) return [];
    const copy = node.cloneNode(true) as HTMLElement;
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    copy.style.animation = 'none';
    copy.style.pointerEvents = 'none';
    host.append(copy);
    return [copy];
  });

  for (const copy of copies) {
    const frames =
      sheet && copy.classList.contains('dialog')
        ? [{ translate: '0 0' }, { translate: '0 100%' }]
        : [{ opacity: 1 }, { opacity: 0 }];
    const run = copy.animate(frames, { duration, easing: easing(), fill: 'forwards' });
    run.onfinish = () => copy.remove();
    run.oncancel = () => copy.remove();
  }
}

export function rowArrives(row: HTMLElement | null): void {
  if (row == null || typeof row.animate !== 'function') return;

  row.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: motion('motionBase'),
    easing: easing(),
  });
}

/** The row is taken out of the list only once it has faded and its gap has closed. */
export function rowLeaves(row: HTMLElement | null, then: () => void): void {
  if (row == null || typeof row.animate !== 'function') {
    then();
    return;
  }

  const ease = easing();

  row.style.pointerEvents = 'none';
  row
    .animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: motion('motionFast'),
      easing: ease,
      fill: 'forwards',
    })
    .finished.then(() => {
      if (lessMotion()) return;
      const height = row.getBoundingClientRect().height;
      row.style.overflow = 'hidden';
      return row.animate(
        [
          { height: `${height}px` },
          { height: '0px', paddingBlock: '0px', marginBlock: '0px', borderBlockWidth: '0px' },
        ],
        { duration: motion('motionBase'), easing: ease, fill: 'forwards' },
      ).finished;
    })
    .catch(() => undefined)
    .finally(then);
}
