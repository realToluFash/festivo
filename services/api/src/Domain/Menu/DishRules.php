<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Menu\Model\DishDetails;
use App\Domain\Menu\Model\LastPrice;
use App\Domain\Organisation\Regions;
use App\Entity\Dish;
use App\Enum\ErrorCode;
use App\Enum\NeedKind;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use NumberFormatter;
use Psl\Iter;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a library dish may be (sc-3901), every problem at once; the web form checks the same before sending. */
final readonly class DishRules
{
    private const array SEA = ['fish', 'crustaceans', 'molluscs'];

    private const array ANIMAL = ['milk', 'eggs'];

    private const int MOST_WHOLE_DIGITS = 15;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * @param list<string>                             $allergens
     * @param list<string>                             $diets
     * @param ?array{amount: string, currency: string} $lastPrice
     */
    public function details(string $name, ?string $description, array $allergens, bool $containsNone, array $diets, ?array $lastPrice, ?string $heldCurrency): DishDetails
    {
        $violations = [];
        $name = NameNormaliser::name($name);
        $description = Str\trim($description ?? '');

        if ('' === $name) {
            $violations[] = $this->violation('name', 'validation.dish_name_required');
        } elseif (VisibleText::tooLong($name, Dish::NAME_MAXIMUM)) {
            $violations[] = $this->violation('name', 'validation.dish_name_too_long', max: (string) Dish::NAME_MAXIMUM);
        }

        if (VisibleText::tooLong($description, Dish::DESCRIPTION_MAXIMUM)) {
            $violations[] = $this->violation('description', 'validation.dish_description_too_long', max: (string) Dish::DESCRIPTION_MAXIMUM);
        }

        $known = self::allergenCodes();
        $allergens = Vec\filter($known, static fn (string $code): bool => Iter\contains($allergens, $code));
        $dietCodes = self::dietCodes();
        $diets = Vec\filter($dietCodes, static fn (string $code): bool => Iter\contains($diets, $code));

        if (([] === $allergens) === !$containsNone) {
            $violations[] = $this->violation('allergens', 'validation.dish_contains_required');
        }

        foreach (self::clashes($allergens, $diets) as $diet => $key) {
            $violations[] = $this->violation('diets.' . $diet, $key);
        }

        $price = null;

        if (null !== $lastPrice && '' !== Str\trim($lastPrice['amount'])) {
            $currency = Str\uppercase(Str\trim($lastPrice['currency']));

            if (!Regions::isCurrency($currency) && $currency !== $heldCurrency) {
                $violations[] = $this->violation('lastPrice.currency', 'validation.currency_invalid');
            } else {
                $minor = self::minorOf(Str\trim($lastPrice['amount']), $currency);

                if (null === $minor) {
                    $violations[] = $this->violation('lastPrice.amount', 'validation.dish_price_invalid', example: $this->example($currency));
                } else {
                    $price = new LastPrice($minor, $currency);
                }
            }
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new DishDetails($name, '' === $description ? null : $description, $allergens, $diets, $price);
    }

    /** @return list<string> the 14 of EU 1169/2011 Annex II, in its order: sc-3777's codes without Other */
    public static function allergenCodes(): array
    {
        return Vec\filter(NeedKind::Allergen->codes(), static fn (string $code): bool => NeedKind::OTHER !== $code);
    }

    /** @return list<string> sc-3777's diets without Other */
    public static function dietCodes(): array
    {
        return Vec\filter(NeedKind::Diet->codes(), static fn (string $code): bool => NeedKind::OTHER !== $code);
    }

    /**
     * @param list<string> $allergens
     * @param list<string> $diets
     *
     * @return array<string, string> the clashing diet's code to its message's key
     */
    public static function clashes(array $allergens, array $diets): array
    {
        $sea = Iter\any(self::SEA, static fn (string $code): bool => Iter\contains($allergens, $code));
        $animal = Iter\any(self::ANIMAL, static fn (string $code): bool => Iter\contains($allergens, $code));
        $found = [];

        if ($sea && Iter\contains($diets, 'vegetarian')) {
            $found['vegetarian'] = 'validation.dish_vegetarian_sea';
        }

        if (($sea || $animal) && Iter\contains($diets, 'vegan')) {
            $found['vegan'] = match (true) {
                $sea && $animal => 'validation.dish_vegan_both',
                $sea => 'validation.dish_vegan_sea',
                default => 'validation.dish_vegan_animal',
            };
        }

        return $found;
    }

    /** A plain decimal, "4500" or "12.50", with no more decimals than the currency's ISO 4217 minor unit: more is refused, never rounded. */
    public static function minorOf(string $amount, string $currency): ?int
    {
        if (!Regex\matches($amount, '/^\d{1,' . self::MOST_WHOLE_DIGITS . '}(\.\d+)?$/')) {
            return null;
        }

        $digits = self::minorDigits($currency);
        $parts = Str\split($amount, '.');
        $fraction = $parts[1] ?? '';

        if (Str\length($fraction) > $digits) {
            return null;
        }

        return (int) $parts[0] * (int) Math\round(10 ** $digits) + (int) Str\pad_right($fraction, $digits, '0');
    }

    /** @return non-negative-int */
    public static function minorDigits(string $currency): int
    {
        return Type\uint()->coerce(new NumberFormatter('en@currency=' . $currency, NumberFormatter::CURRENCY)->getAttribute(NumberFormatter::FRACTION_DIGITS));
    }

    public static function written(int $minor, string $currency): string
    {
        $digits = self::minorDigits($currency);

        if (0 === $digits) {
            return (string) $minor;
        }

        $scale = (int) Math\round(10 ** $digits);

        return Str\format('%d.%s', Math\div($minor, $scale), Str\pad_left((string) ($minor % $scale), $digits, '0'));
    }

    private function example(string $currency): string
    {
        $digits = self::minorDigits($currency);
        $formatter = new NumberFormatter($this->translator->getLocale(), NumberFormatter::DECIMAL);
        $formatter->setAttribute(NumberFormatter::MIN_FRACTION_DIGITS, $digits);
        $formatter->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, $digits);

        return (string) $formatter->format(0 === $digits ? 12 : 12.5);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key, string $max = '', string $example = ''): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, ['{max}' => $max, '{example}' => $example]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
