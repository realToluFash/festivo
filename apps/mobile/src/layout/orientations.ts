import type { ModalProps } from 'react-native';

/** Every way up, as an iPad's modal turns already: an iOS modal that names none is held upright on an iPhone. */
export const TURNS_WITH_THE_APP: ModalProps['supportedOrientations'] = [
  'portrait',
  'portrait-upside-down',
  'landscape',
];
