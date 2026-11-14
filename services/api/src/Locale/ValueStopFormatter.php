<?php

declare(strict_types=1);

namespace App\Locale;

use Psl\Dict;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\DependencyInjection\Attribute\AsDecorator;
use Symfony\Component\DependencyInjection\Attribute\AutowireDecorated;
use Symfony\Component\Translation\Formatter\IntlFormatterInterface;
use Symfony\Component\Translation\Formatter\MessageFormatterInterface;

/** A value ending in ".", "!", "?" or "…" ends the sentence, so the message's full stop right after it is not shown (sc-2573). */
#[AsDecorator('translator.formatter.default')]
final readonly class ValueStopFormatter implements MessageFormatterInterface, IntlFormatterInterface
{
    private const array OWN_STOPS = ['.', '!', '?', '…'];

    public function __construct(
        #[AutowireDecorated]
        private MessageFormatterInterface&IntlFormatterInterface $inner,
    ) {
    }

    public function format(string $message, string $locale, array $parameters = []): string
    {
        foreach (self::endingSentences($parameters) as $placeholder) {
            $message = Str\replace($message, $placeholder . '.', $placeholder);
        }

        return $this->inner->format($message, $locale, $parameters);
    }

    public function formatIntl(string $message, string $locale, array $parameters = []): string
    {
        foreach (self::endingSentences($parameters) as $placeholder) {
            $name = \preg_quote(Str\trim($placeholder, '%{ }'), '/');
            $message = Regex\replace($message, '/(\{\s*' . $name . '\s*\})\./u', '$1');
        }

        return $this->inner->formatIntl($message, $locale, $parameters);
    }

    /**
     * @param array<array-key, mixed> $parameters
     *
     * @return list<string>
     */
    private static function endingSentences(array $parameters): array
    {
        $ending = Dict\filter(
            $parameters,
            static fn (mixed $value): bool => \is_string($value) && Iter\any(self::OWN_STOPS, static fn (string $stop): bool => Str\ends_with($value, $stop)),
        );

        return Vec\map(Vec\keys($ending), static fn (int|string $key): string => (string) $key);
    }
}
