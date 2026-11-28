const NEAR = 8;

function newestTop(list: HTMLElement): number {
  const last = list.lastElementChild;

  if (last == null) return 0;

  return last.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
}

/** A reader scrolled up is moved only by an item added, never by a change to one. */
export function newestInView(list: HTMLElement | null): (() => void) | undefined {
  if (list == null) return undefined;

  let count = list.children.length;
  let pinned = true;
  const go = (): void => {
    list.scrollTop = newestTop(list);
  };
  const onScroll = (): void => {
    const at = Math.min(newestTop(list), list.scrollHeight - list.clientHeight);

    pinned = Math.abs(list.scrollTop - at) <= NEAR;
  };
  const changes = new MutationObserver(() => {
    const grew = list.children.length > count;

    count = list.children.length;
    if (grew || pinned) go();
  });

  go();
  changes.observe(list, { childList: true, subtree: true, characterData: true });
  list.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    changes.disconnect();
    list.removeEventListener('scroll', onScroll);
  };
}
