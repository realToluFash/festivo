import { type AddressSuggestion, type PickedAddress } from '@soirely/api-client';
import { type VenueDraft } from '@soirely/domain';

export const ASK_AFTER_MS = 250;

/** What the address field shows beside itself: the suggestions, the outage line, and the venue's zone offered. */
export interface LookupSeen {
  suggestions: readonly AddressSuggestion[];
  down: boolean;
  offered: { zone: string; keep: string } | null;
}

export const NOTHING_SEEN: LookupSeen = { suggestions: [], down: false, offered: null };

export function suggestionLine(suggestion: AddressSuggestion): string {
  return suggestion.secondaryText == null
    ? suggestion.text
    : `${suggestion.text}, ${suggestion.secondaryText}`;
}

/** The web's VenueSection lookup (sc-3589): asked a moment after three characters, the latest answer only. */
export function addressLookup({
  suggest,
  resolve,
  onVenue,
  onSeen,
}: {
  suggest: (query: string) => Promise<AddressSuggestion[]>;
  resolve: (id: string) => Promise<PickedAddress>;
  onVenue: (change: Partial<VenueDraft>) => void;
  onSeen: (seen: LookupSeen) => void;
}) {
  let seen = NOTHING_SEEN;
  let asked = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function show(change: Partial<LookupSeen>): void {
    seen = { ...seen, ...change };
    onSeen(seen);
  }

  return {
    type(address: string): void {
      const ask = ++asked;
      const query = address.trim();

      clearTimeout(timer);
      onVenue({ address, addressId: null });

      if (query.length < 3) {
        show({ suggestions: [], offered: null });
        return;
      }

      show({ offered: null });
      timer = setTimeout(() => {
        suggest(query).then(
          (found) => {
            if (ask === asked) show({ suggestions: found, down: false });
          },
          () => {
            if (ask === asked) show({ suggestions: [], down: true });
          },
        );
      }, ASK_AFTER_MS);
    },

    async pick(suggestion: AddressSuggestion, zoneBefore: string): Promise<void> {
      const ask = ++asked;

      clearTimeout(timer);
      show({ suggestions: [] });
      onVenue({ address: suggestionLine(suggestion), addressId: suggestion.id });

      try {
        const address = await resolve(suggestion.id);

        if (ask !== asked) return;
        onVenue({ address: address.formatted, addressId: suggestion.id });
        if (address.timeZone != null && address.timeZone !== zoneBefore)
          show({ offered: { zone: address.timeZone, keep: zoneBefore } });
      } catch {
        // The suggestion's own line stays, and the API saves it as typed if it cannot resolve it either.
      }
    },

    /** Use or Keep answered the offer. */
    answered(): void {
      show({ offered: null });
    },

    stop(): void {
      asked++;
      clearTimeout(timer);
    },
  };
}
