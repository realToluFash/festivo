/** The built stylesheet may write `120ms` as `.12s`, so the unit is read, not assumed. */
export function duration(
  name: 'motionFast' | 'motionBase' | 'motionSlow' | 'toastLifetime',
): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const amount = parseFloat(value);
  if (Number.isNaN(amount)) return 0;
  return value.endsWith('ms') ? amount : value.endsWith('s') ? amount * 1000 : amount;
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
  const length = sheet ? duration('motionBase') : duration('motionFast');
  const copies = [scrim, dialog].flatMap((node) => {
    if (node == null) return [];
    const copy = node.cloneNode(true) as HTMLElement;
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    copy.removeAttribute('id');
    for (const named of copy.querySelectorAll('[id]')) named.removeAttribute('id');
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
    const run = copy.animate(frames, { duration: length, easing: easing(), fill: 'forwards' });
    run.onfinish = () => copy.remove();
    run.oncancel = () => copy.remove();
  }
}

export function rowArrives(row: HTMLElement | null): void {
  if (row == null || typeof row.animate !== 'function') return;

  row.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: duration('motionBase'),
    easing: easing(),
  });
}

/** The row is taken out of the list only once it has faded and its gap has closed; `then` commits before it returns, so a row still on the page is drawn again. */
export function rowLeaves(row: HTMLElement | null, then: () => void): void {
  if (row == null || typeof row.animate !== 'function') {
    then();
    return;
  }

  const ease = easing();

  row.style.pointerEvents = 'none';
  row
    .animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration('motionFast'),
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
        { duration: duration('motionBase'), easing: ease, fill: 'forwards' },
      ).finished;
    })
    .catch(() => undefined)
    .finally(() => {
      then();
      if (row.isConnected) stays(row);
    });
}

function stays(row: HTMLElement): void {
  for (const run of row.getAnimations()) run.cancel();
  row.style.pointerEvents = '';
  row.style.overflow = '';
}
