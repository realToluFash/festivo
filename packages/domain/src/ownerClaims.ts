/** One line of the Members banner (sc-6640): a catalogue key and what fills its slots. */
export interface OwnerClaimLine {
  key: string;
  values: Record<string, string>;
}

/** What the banner shows, decided once for both clients from the API's banner. */
export interface OwnerClaimView {
  tone: 'attention' | 'waiting' | 'done' | 'info';
  title: OwnerClaimLine;
  lines: OwnerClaimLine[];
  /** The claimant's record panel with Check record. */
  record: boolean;
  become: boolean;
  stop: boolean;
  /** Withdraw my claim, only ever on the claimant's own card (sc-8204). */
  withdraw: boolean;
}

interface Instant {
  at: string;
  written: string;
}

/** The shape `@soirely/api-client` reads as `OwnerClaimBanner`; only what the view needs. */
export interface OwnerClaimBannerInput {
  state: 'no_owner' | 'open' | 'found' | 'closed';
  claim: {
    claimant: { name: string };
    mine: boolean;
    domain: string;
    lapsesAt: Instant;
    passesAt: Instant | null;
  } | null;
  stopped: { claimant: string; mine: boolean } | null;
  lapsed: { outcome: 'unfound' | 'record_removed'; at: Instant } | null;
}

function line(key: string, values: Record<string, string> = {}): OwnerClaimLine {
  return { key, values };
}

/** Every card ends with this, so the banner never reads as a lockout. */
export const OWNER_CLAIM_KEEPS_WORKING = line('ownerClaim.keepsWorking');

export function ownerClaimView(
  banner: OwnerClaimBannerInput,
  organisation: string,
): OwnerClaimView {
  const { claim } = banner;
  const none = { record: false, become: false, stop: false, withdraw: false };

  if (banner.state === 'closed' || claim == null) {
    if (banner.state === 'closed') {
      return {
        ...none,
        tone: 'info',
        title: line('ownerClaim.closed'),
        lines: banner.stopped?.mine
          ? [line('ownerClaim.youStopped', { claimant: banner.stopped.claimant })]
          : [],
      };
    }

    const lapsed = banner.lapsed;

    return {
      ...none,
      tone: 'attention',
      title: line('ownerClaim.noOwner', { organisation }),
      lines: [
        ...(lapsed == null
          ? []
          : [
              lapsed.outcome === 'record_removed'
                ? line('ownerClaim.recordRemoved')
                : line('ownerClaim.lapsed', { when: lapsed.at.written }),
            ]),
        line('ownerClaim.howTo'),
      ],
      become: true,
    };
  }

  const named = { claimant: claim.claimant.name, domain: claim.domain };

  if (claim.passesAt != null) {
    const passes = { ...named, when: claim.passesAt.written };

    return claim.mine
      ? {
          ...none,
          tone: 'done',
          title: line('ownerClaim.found'),
          lines: [line('ownerClaim.passesOn', passes), line('ownerClaim.keepPublished')],
          withdraw: true,
        }
      : {
          ...none,
          tone: 'done',
          title: line('ownerClaim.becoming', passes),
          lines: [],
          stop: true,
        };
  }

  return claim.mine
    ? {
        ...none,
        tone: 'waiting',
        title: line('ownerClaim.prove', named),
        lines: [line('ownerClaim.addRecord', named)],
        record: true,
        withdraw: true,
      }
    : {
        ...none,
        tone: 'waiting',
        title: line('ownerClaim.becomingUnfound', { ...named, when: claim.lapsesAt.written }),
        lines: [],
        stop: true,
      };
}

/** The refusals worded on the banner; anything else is the general failure. */
export function ownerClaimRefusalKey(code: string | null | undefined): string | null {
  if (code === 'owner_claim_address') return 'ownerClaim.refusedAddress';
  if (code === 'owner_claim_managed') return 'ownerClaim.refusedManaged';

  return null;
}
