<?php

declare(strict_types=1);

namespace App\Translation;

use Locale;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\Translation\LocaleAwareInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Wraps the translator so a missing key is discoverable rather than silent.
 *
 * A key with no message falls back to English and renders fine, which is the
 * right behaviour for the reader and the wrong behaviour for us — nothing
 * fails, nothing is logged, and the gap gets found by a customer.
 *
 * Reported once per key, domain and locale per process. A missing key on a hot
 * path would otherwise produce a line per request and bury itself.
 */
final class LoggingTranslator implements TranslatorInterface, LocaleAwareInterface
{
    /** @var array<string, true> */
    private array $reported = [];

    public function __construct(
        private readonly TranslatorInterface $inner,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function trans(string $id, array $parameters = [], ?string $domain = null, ?string $locale = null): string
    {
        $translated = $this->inner->trans($id, $parameters, $domain, $locale);

        // The translator returns the id itself when it finds nothing, including
        // after the English fallback — which is the case worth hearing about.
        if ($translated === $id && '' !== $id) {
            $this->report($id, $domain, $locale ?? $this->getLocale());
        }

        return $translated;
    }

    public function getLocale(): string
    {
        return $this->inner instanceof LocaleAwareInterface
            ? $this->inner->getLocale()
            : Locale::getDefault();
    }

    public function setLocale(string $locale): void
    {
        if ($this->inner instanceof LocaleAwareInterface) {
            $this->inner->setLocale($locale);
        }
    }

    private function report(string $id, ?string $domain, string $locale): void
    {
        $signature = ($domain ?? 'messages') . ':' . $locale . ':' . $id;

        if (isset($this->reported[$signature])) {
            return;
        }

        $this->reported[$signature] = true;

        $this->logger->warning('Missing translation', [
            'key' => $id,
            'domain' => $domain ?? 'messages',
            'locale' => $locale,
        ]);
    }
}
