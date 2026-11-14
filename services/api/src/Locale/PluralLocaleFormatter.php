<?php

declare(strict_types=1);

namespace App\Locale;

use Symfony\Component\DependencyInjection\Attribute\AsDecorator;
use Symfony\Component\DependencyInjection\Attribute\AutowireDecorated;
use Symfony\Component\Translation\Formatter\IntlFormatterInterface;
use Symfony\Component\Translation\Formatter\MessageFormatterInterface;

/** An ICU message counts by the rule its copy is written in, so Portuguese reads 0 as plural. */
#[AsDecorator('translator.formatter.default')]
final readonly class PluralLocaleFormatter implements MessageFormatterInterface, IntlFormatterInterface
{
    public function __construct(
        #[AutowireDecorated]
        private MessageFormatterInterface&IntlFormatterInterface $inner,
    ) {
    }

    public function format(string $message, string $locale, array $parameters = []): string
    {
        return $this->inner->format($message, $locale, $parameters);
    }

    public function formatIntl(string $message, string $locale, array $parameters = []): string
    {
        return $this->inner->formatIntl($message, SupportedLocales::plurals($locale), $parameters);
    }
}
