<?php

declare(strict_types=1);

namespace App\Locale\Listener;

use App\Locale\SupportedLocales;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

#[AsEventListener(event: KernelEvents::REQUEST, priority: 34)]
final class RequestLocaleListener
{
    public const ATTRIBUTE = '_resolved_locale';

    /** Set only when the request named a supported language itself, so a default is never mistaken for a choice. */
    public const ASKED = '_asked_locale';

    /** The tag a screen's dates are written in (sc-65714): the device's full tag while its language is the settled one, else that language alone. */
    public const FORMATTING = '_formatting_locale';

    public function __invoke(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $header = $request->headers->get('Accept-Language');
        $tags = null === $header ? [] : $this->preferences($header);

        $explicit = $request->query->get('locale');
        if (\is_string($explicit) && SupportedLocales::supports($explicit)) {
            $this->apply($request, SupportedLocales::narrow($explicit), $tags);
            $request->attributes->set(self::ASKED, SupportedLocales::narrow($explicit));

            return;
        }

        foreach ($tags as $candidate) {
            if (SupportedLocales::supports($candidate)) {
                $this->apply($request, SupportedLocales::narrow($candidate), $tags);
                $request->attributes->set(self::ASKED, SupportedLocales::narrow($candidate));

                return;
            }
        }

        $this->apply($request, SupportedLocales::DEFAULT, $tags);
    }

    /** @param list<string> $tags */
    private function apply(\Symfony\Component\HttpFoundation\Request $request, string $locale, array $tags): void
    {
        $request->attributes->set('_locale', $locale);
        $request->setLocale($locale);
        $request->attributes->set(self::ATTRIBUTE, $locale);
        $request->attributes->set(self::FORMATTING, SupportedLocales::formatting($locale, $tags));
    }

    /** @return list<string> */
    private function preferences(string $header): array
    {
        $parsed = [];

        foreach (\explode(',', $header) as $part) {
            $bits = \explode(';q=', \trim($part));
            $tag = \trim($bits[0]);

            if ('' === $tag || '*' === $tag) {
                continue;
            }

            // A quality that is not a number is treated as absent rather than
            // cast. Casting made it 0.0, which ranked a language the client
            // asked for below one it offered as a fallback.
            $parsed[] = [
                'tag' => $tag,
                'q' => isset($bits[1]) && \is_numeric($bits[1]) ? (float) $bits[1] : 1.0,
            ];
        }

        \usort($parsed, static fn (array $a, array $b): int => $b['q'] <=> $a['q']);

        return \array_map(static fn (array $p): string => $p['tag'], $parsed);
    }
}
