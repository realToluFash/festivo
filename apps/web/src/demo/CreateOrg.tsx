import { CreateWalk as ProductWalk } from '../components/CreateWalk.tsx';
import type { Walk } from '../components/createWalk.ts';
import { SAMPLE_CURRENCIES, offered, sampleSend } from './createOrg.ts';
import { ManagedBanner } from './managed.tsx';
import { SAMPLE } from './rules.ts';

/** The product's walk on the demo's sample: its countries, its send, and sc-563's banner. */
export function CreateWalk({
  start,
  onClose,
  onCreated,
}: {
  start: Walk;
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <ProductWalk
      start={start}
      email={SAMPLE.email}
      currencies={SAMPLE_CURRENCIES}
      offered={offered}
      managedBanner={<ManagedBanner />}
      create={sampleSend}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}
