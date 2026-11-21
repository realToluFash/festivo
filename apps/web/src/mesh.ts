export type Mesh = 'wed' | 'ireti' | 'party' | 'draft';

const MESHES: readonly Mesh[] = ['wed', 'ireti', 'party', 'draft'];

/** main's meshFor (apps/mobile kit/today.ts): an event's colour until it has a photo, the same one every time. */
export function meshFor(id: string): Mesh {
  const sum = [...id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);

  return MESHES[sum % MESHES.length] ?? 'party';
}
