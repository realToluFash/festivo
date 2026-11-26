import { AppleMark, GoogleMark } from '../components/ProviderSignIn.tsx';
import { offButton } from '../offButton.ts';
import { type Provider, continueWith } from './providerOnly.ts';

/** One button for each provider the account has linked and no other, as `ProviderSignIn only={providers}` draws them: Google, then Apple. */
export function ProviderOnlyButtons({
  providers,
  busy,
  onChoose,
}: {
  providers: readonly Provider[];
  busy: boolean;
  onChoose: (provider: Provider) => void;
}) {
  return (
    <div className="rd-providers">
      {providers.includes('google') && (
        <button
          type="button"
          className="button button-google rd-provider"
          aria-busy={busy || undefined}
          {...offButton(busy, { dim: false })}
          onClick={() => onChoose('google')}
        >
          <GoogleMark />
          <span>{continueWith('google')}</span>
        </button>
      )}
      {providers.includes('apple') && (
        <button
          type="button"
          className="button button-apple rd-provider"
          aria-busy={busy || undefined}
          {...offButton(busy, { dim: false })}
          onClick={() => onChoose('apple')}
        >
          <AppleMark />
          <span>{continueWith('apple')}</span>
        </button>
      )}
    </div>
  );
}
