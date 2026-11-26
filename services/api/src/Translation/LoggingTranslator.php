<?php

declare(strict_types=1);

namespace App\Translation;

use Locale;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\Translation\LocaleAwareInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

final class LoggingTranslator implements TranslatorInterface, LocaleAwareInterface
{
    /** @var array<string, true> */
    private array $reported = [];

    public function __construct(
        private readonly TranslatorInterface $innerTranslator,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function trans(string $id, array $parameters = [], ?string $domain = null, ?string $locale = null): string
    {
        $translated = $this->innerTranslator->trans($id, $parameters, $domain, $locale);

        if ($translated === $id && '' !== $id) {
            $this->report($id, $domain, $locale ?? $this->getLocale());
        }

        return $translated;
    }

    public function getLocale(): string
    {
        return $this->innerTranslator instanceof LocaleAwareInterface
            ? $this->innerTranslator->getLocale()
            : Locale::getDefault();
    }

    public function setLocale(string $locale): void
    {
        if ($this->innerTranslator instanceof LocaleAwareInterface) {
            $this->innerTranslator->setLocale($locale);
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
