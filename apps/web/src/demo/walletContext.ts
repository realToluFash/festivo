import { createContext } from 'react';

import type { Lang } from './guest.ts';
import type { Device } from './wallet.ts';

/** The guest page's device and language, for the code card's wallet button (sc-9956). */
export const WalletDevice = createContext<{ device: Device; lang: Lang } | null>(null);
