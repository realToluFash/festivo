<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\LocaleNumbers;
use App\Locale\Money;
use NumberFormatter;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Each number in a refusal is formatted here for the reader's language, never written into a translation (sc-92).
 *
 * @phpstan-type SentMarkup array{markup?: ?string}
 * @phpstan-type SentCharge array{markup?: ?string, price?: ?string, currency?: ?string}
 */
final readonly class MarginRules
{
    public const int MOST_TENTHS = 9999;

    public const string MARKUP_NEGATIVE = 'budget_markup_negative';

    public function __construct(
        private TranslatorInterface $translator,
        private Money $money,
        private LocaleNumbers $localeNumbers,
    ) {
    }

    /** @return Type\TypeInterface<SentMarkup> */
    public static function sentMarkup(): Type\TypeInterface
    {
        return Type\shape(['markup' => Type\optional(Type\nullable(Type\string()))]);
    }

    /** @return Type\TypeInterface<SentCharge> */
    public static function sentCharge(): Type\TypeInterface
    {
        return Type\shape([
            'markup' => Type\optional(Type\nullable(Type\string())),
            'price' => Type\optional(Type\nullable(Type\string())),
            'currency' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /** @param SentMarkup $sent */
    public function markup(array $sent): ?int
    {
        $typed = Str\trim($sent['markup'] ?? '');

        if ('' === $typed) {
            return null;
        }

        $violation = $this->markupRefusal($typed);

        if (null !== $violation) {
            throw ApiException::validation([$violation]);
        }

        return self::tenthsOf($typed);
    }

    /**
     * @param SentCharge $sent
     *
     * @return array{markup: ?int, price: ?int}
     */
    public function charge(array $sent, string $eventCurrency): array
    {
        $markup = Str\trim($sent['markup'] ?? '');
        $price = Str\trim($sent['price'] ?? '');
        $currency = Str\uppercase(Str\trim($sent['currency'] ?? ''));
        $violations = [];

        if ('' !== $markup && '' !== $price) {
            $violations[] = $this->violation('markup', 'validation.budget_markup_with_price');
        } elseif ('' !== $markup) {
            $violations[] = $this->markupRefusal($markup);
        } elseif ('' !== $price) {
            if (null === Money::minorOf($price, $eventCurrency)) {
                $violations[] = $this->priceRefusal($price, $eventCurrency);
            }

            if ('' === $currency) {
                $violations[] = $this->violation('currency', 'validation.budget_currency_required', ['{currency}' => $eventCurrency]);
            } elseif ($currency !== $eventCurrency) {
                $violations[] = $this->violation('currency', 'validation.budget_currency_mismatch', ['{currency}' => $eventCurrency]);
            }
        }

        $violations = Vec\filter_nulls($violations);

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return [
            'markup' => '' === $markup ? null : self::tenthsOf($markup),
            'price' => '' === $price ? null : Money::minorOf($price, $eventCurrency),
        ];
    }

    public static function written(int $tenths): string
    {
        return 0 === $tenths % 10 ? (string) Math\div($tenths, 10) : Math\div($tenths, 10) . '.' . ($tenths % 10);
    }

    private static function tenthsOf(string $typed): int
    {
        $parts = Str\split($typed, '.');

        return (int) $parts[0] * 10 + (int) ($parts[1] ?? '0');
    }

    /** @return ?array{propertyPath: string, message: string, code: string} */
    private function markupRefusal(string $typed): ?array
    {
        if (Regex\matches($typed, '/^[-−]/')) {
            return $this->violation('markup', 'validation.budget_markup_negative', ['min' => $this->localeNumbers->decimal(0)], self::MARKUP_NEGATIVE);
        }

        if (!Regex\matches($typed, '/^\d{1,6}(\.\d+)?$/')) {
            return $this->violation('markup', 'validation.budget_markup_invalid', ['example' => $this->localeNumbers->decimal(12.5, 1)]);
        }

        if (Str\length(Str\split($typed, '.')[1] ?? '') > 1) {
            return $this->violation('markup', 'validation.budget_markup_too_many_decimals', ['places' => 1]);
        }

        if (self::tenthsOf($typed) > self::MOST_TENTHS) {
            return $this->violation('markup', 'validation.budget_markup_too_high', ['max' => $this->percent(self::MOST_TENTHS)]);
        }

        return null;
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function priceRefusal(string $price, string $currency): array
    {
        if (Regex\matches($price, '/^\d{1,15}\.\d+$/')) {
            return $this->violation('price', 'validation.budget_client_price_too_many_decimals', ['example' => $this->money->example($currency)]);
        }

        return $this->violation('price', 'validation.budget_client_price_invalid', ['min' => $this->localeNumbers->decimal(0)]);
    }

    private function percent(int $tenths): string
    {
        $formatter = new NumberFormatter($this->translator->getLocale(), NumberFormatter::PERCENT);
        $formatter->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, 1);

        return (string) $formatter->format($tenths / 1000);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key, array $parameters = [], string $code = ''): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => '' === $code ? ErrorCode::ValidationFailed->value : $code,
        ];
    }
}
