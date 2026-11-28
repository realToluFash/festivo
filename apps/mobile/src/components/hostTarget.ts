import { type HostFocus } from '@soirely/domain';

export interface HostTargets<T> {
  names: ReadonlyMap<number, T>;
  ups: ReadonlyMap<number, T>;
  downs: ReadonlyMap<number, T>;
  add: T | null;
}

/** The control a move, a removal or Add a host hands focus to, once the rows have redrawn. */
export function hostTarget<T>(focus: HostFocus, targets: HostTargets<T>): T | null {
  if (focus === 'add') return targets.add;

  const controls =
    focus.control === 'name' ? targets.names : focus.control === 'up' ? targets.ups : targets.downs;

  return controls.get(focus.key) ?? null;
}
