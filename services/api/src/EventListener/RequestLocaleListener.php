<?php

declare(strict_types=1);

namespace App\EventListener;

use App\Locale\SupportedLocales;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Decides which language this request is answered in.
 *
 * First match wins:
 *
 *   1. An explicit `locale` query parameter — a client that knows better
 *   2. The authenticated account's stored preference
 *   3. Accept-Language, matched against the supported set
 *   4. English
 *
 * The explicit parameter comes first because the alternative is a user whose
 * account says French being unable to see an English error to paste into a
 * support ticket. The account preference comes before the header because a
 * person's stored choice outranks whatever browser they happen to be on.
 *
 * Priority 34, and the number matters twice.
 *
 * Above RouterListener (32), because an unmatched route throws its 404 from
 * there. A locale listener below it never runs for exactly the requests most
 * likely to be read by a confused person — every error on a wrong URL comes
 * back in English while the negotiation looks correct everywhere else.
 *
 * Above LocaleListener (16) and LocaleAwareListener (15), because the first
 * reads the `_locale` attribute and the second pushes the request's locale into
 * the translator. Running after them sets a locale nothing reads.
 *
 * Step 2 needs an authenticated account and so needs the firewall to have run,
 * which it has not at this priority. When Accounts lands, the preference is
 * applied by re-resolving after authentication rather than by moving this
 * listener later — moving it later breaks the ordering above.
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 34)]
final class RequestLocaleListener
{
    public const ATTRIBUTE = '_resolved_locale';

    public function __invoke(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();

        $explicit = $request->query->get('locale');
        if (\is_string($explicit) && SupportedLocales::supports($explicit)) {
            $this->apply($request, SupportedLocales::narrow($explicit));

            return;
        }

        // Step 2 lands here once there is an authenticated account to ask.
        // Accounts & sign-in owns the preference; this is where it is read.

        $header = $request->headers->get('Accept-Language');
        if (null !== $header) {
            foreach ($this->preferences($header) as $candidate) {
                if (SupportedLocales::supports($candidate)) {
                    $this->apply($request, SupportedLocales::narrow($candidate));

                    return;
                }
            }
        }

        $this->apply($request, SupportedLocales::DEFAULT);
    }

    private function apply(\Symfony\Component\HttpFoundation\Request $request, string $locale): void
    {
        // Both: the attribute is what Symfony's LocaleListener reads, and
        // setLocale is what applies if anything resolves earlier than it.
        $request->attributes->set('_locale', $locale);
        $request->setLocale($locale);
        $request->attributes->set(self::ATTRIBUTE, $locale);
    }

    /**
     * Accept-Language in preference order.
     *
     * Parsed here rather than through getPreferredLanguage(), which narrows to
     * a provided list and loses the ordering we want to walk ourselves — and
     * which would pick English over Portuguese for `pt-BR,en;q=0.5` in some
     * versions.
     *
     * @return list<string>
     */
    private function preferences(string $header): array
    {
        $parsed = [];

        foreach (explode(',', $header) as $part) {
            $bits = explode(';q=', trim($part));
            $tag = trim($bits[0]);

            if ('' === $tag || '*' === $tag) {
                continue;
            }

            $quality = isset($bits[1]) ? (float) $bits[1] : 1.0;
            $parsed[] = ['tag' => $tag, 'q' => $quality];
        }

        usort($parsed, static fn (array $a, array $b): int => $b['q'] <=> $a['q']);

        return array_map(static fn (array $p): string => $p['tag'], $parsed);
    }
}
