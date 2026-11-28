import { NOTHING_TO_PASTE, PASTE_CODE } from './pasteCode.ts';
import { SAMPLE } from './rules.ts';
import type { PasteCodeState } from './usePasteCode.ts';

/** The demo's stand-ins for what was copied, so every path opens with nothing copied. */
const COPIED = [
  { label: 'Copied: Copy code in WhatsApp', text: SAMPLE.code },
  {
    label: 'Copied: the whole WhatsApp message',
    text: `*${SAMPLE.code}* is your verification code. For your security, do not share this code.`,
  },
  { label: 'Copied: a phone number', text: '+234 801 234 5678' },
  { label: 'Copied: two different codes', text: `${SAMPLE.code}, then 771204` },
  { label: 'Copied: nothing', text: '' },
] as const;

/** Paste code beside the code field (sc-99215), its line beside it, wrapping under it when there is no room. */
export function PasteCode({ id, paste }: { id: string; paste: PasteCodeState }) {
  return (
    <div className="demo-paste">
      <div className="demo-paste-row">
        <button
          type="button"
          className="button demo-paste-button"
          aria-describedby={paste.nothing ? `${id}-nothing` : undefined}
          onClick={() => void paste.press()}
        >
          {PASTE_CODE}
        </button>
        <p className="demo-paste-nothing" id={`${id}-nothing`} role="status">
          {paste.nothing ? NOTHING_TO_PASTE : ''}
        </p>
      </div>
      <div className="demo-paste-copied">
        <p>Demo only: what the press finds copied</p>
        {COPIED.map((each) => (
          <button
            key={each.label}
            type="button"
            className="link-button demo-link"
            onClick={() => paste.found(each.text)}
          >
            {each.label}
          </button>
        ))}
      </div>
    </div>
  );
}
