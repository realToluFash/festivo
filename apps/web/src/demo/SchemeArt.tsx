import { SchemeTile } from '../components/SchemeArt.tsx';
import { useChosenScheme } from './chosenScheme.ts';
import { OWN_SCHEME } from './personalisation.ts';

export { Dots, Ground, Pieces, SchemeTile } from '../components/SchemeArt.tsx';

/** Personalisation's tile in the demo's Settings list: the demo's own pick, held in memory. */
export function PersonalTile() {
  return <SchemeTile scheme={useChosenScheme() ?? OWN_SCHEME} />;
}
