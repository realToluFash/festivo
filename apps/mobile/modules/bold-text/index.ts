import { requireOptionalNativeModule } from 'expo';

interface BoldText {
  isOn(): boolean;
  addListener(event: 'onChange', listener: (event: { on: boolean }) => void): { remove(): void };
}

/** Android only, and absent from a build made before it was added. */
export const boldTextModule = requireOptionalNativeModule<BoldText>('BoldText');
