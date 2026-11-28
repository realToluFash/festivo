export type MenuEdge = 'end' | 'start';

// sc-102661
export function menuEdge(
  button: { left: number; right: number },
  width: number,
  pane: { left: number },
): MenuEdge {
  return button.right - width >= pane.left ? 'end' : 'start';
}
