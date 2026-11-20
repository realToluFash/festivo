import { useOutletContext } from 'react-router';

import type { Store } from './Enquiries.tsx';

export function useStore(): Store {
  return useOutletContext<Store>();
}
