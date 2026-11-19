import type { JoinOffer, ManagedAccount } from '@soirely/api-client';
import { useEffect, useState } from 'react';

import { api } from './api.ts';

export interface DomainOffer {
  /** The first organisation offered at the domain, or the one a request waits on. */
  organisation: JoinOffer | null;
  domain: string | null;
  asked: boolean;
  /** The account is managed by its home organisation (sc-563): no other way in is open. */
  managed: ManagedAccount | null;
  ask: () => Promise<void>;
  dismiss: () => Promise<void>;
}

/** Another organisation at the domain of the primary address (sc-561), read once per visit. */
export function useDomainOffer(): DomainOffer {
  const [organisation, setOrganisation] = useState<JoinOffer | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const [managed, setManaged] = useState<ManagedAccount | null>(null);

  useEffect(() => {
    let live = true;

    api.joinOffers().then(
      (found) => {
        if (!live) return;

        setDomain(found.domain);
        setOrganisation(found.request?.organisation ?? found.offers[0] ?? null);
        setAsked(found.request != null);
        setManaged(found.managed);
      },
      () => {},
    );

    return () => {
      live = false;
    };
  }, []);

  async function ask(): Promise<void> {
    if (organisation == null) return;

    await api.askToJoin(organisation.id);
    setAsked(true);
  }

  async function dismiss(): Promise<void> {
    if (organisation == null) return;

    const dismissed = organisation;
    setOrganisation(null);
    await api.dismissJoinOffer(dismissed.id).catch(() => undefined);
  }

  return { organisation, domain, asked, managed, ask, dismiss };
}
