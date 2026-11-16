<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Menu\Model\LastPrice;
use App\Domain\Menu\Model\VariantDetails;
use App\Domain\Organisation\Regions;
use App\Entity\DishVariant;
use App\Entity\MenuDishVariant;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** @phpstan-type Sent array{name: string, for: 'everyone'|'children', allergens?: list<string>, containsNone?: bool, diets?: list<string>, cost?: ?string, lastPrice?: ?array{amount: string, currency: string}} */
final readonly class VariantRules
{
    public function __construct(
        private TranslatorInterface $translator,
        private DishRules $dishRules,
    ) {
    }

    /** @return Type\TypeInterface<Sent> */
    public static function sent(): Type\TypeInterface
    {
        return Type\shape([
            'name' => Type\string(),
            'for' => Type\union(Type\literal_scalar('everyone'), Type\literal_scalar('children')),
            'allergens' => Type\optional(Type\vec(Type\string())),
            'containsNone' => Type\optional(Type\bool()),
            'diets' => Type\optional(Type\vec(Type\string())),
            'cost' => Type\optional(Type\nullable(Type\string())),
            'lastPrice' => Type\optional(Type\nullable(Type\shape([
                'amount' => Type\string(),
                'currency' => Type\string(),
            ]))),
        ]);
    }

    /**
     * @param list<Sent>                        $sent
     * @param list<MenuDishVariant|DishVariant> $others        the dish's variants besides the ones sent
     * @param ?string                           $eventCurrency each `cost` is in it; null in the library, which reads `lastPrice`
     *
     * @return list<VariantDetails>
     */
    public function details(array $sent, array $others, ?string $eventCurrency, ?string $heldCurrency = null): array
    {
        $violations = [];
        $made = [];
        $taken = Vec\map($others, static fn (MenuDishVariant|DishVariant $other): string => NameNormaliser::key($other->getName()));
        $noEveryone = Iter\all($sent, static fn (array $one): bool => 'children' === $one['for'])
            && Iter\all($others, static fn (MenuDishVariant|DishVariant $other): bool => $other->isForChildren());

        foreach ($sent as $at => $one) {
            $path = Str\format('variants.%d.', $at);
            $name = NameNormaliser::name($one['name']);

            if ('' === $name) {
                $violations[] = $this->violation($path . 'name', 'validation.variant_name_required');
            } elseif (VisibleText::tooLong($name, DishVariant::NAME_MAXIMUM)) {
                $violations[] = $this->violation($path . 'name', 'validation.variant_name_too_long', ['{max}' => (string) DishVariant::NAME_MAXIMUM]);
            } elseif (Iter\contains($taken, NameNormaliser::key($name))) {
                $violations[] = $this->violation($path . 'name', 'validation.variant_name_taken');
            }

            $taken[] = NameNormaliser::key($name);

            if ($noEveryone) {
                $violations[] = $this->violation($path . 'for', 'validation.variant_needs_everyone');
            }

            $allergens = Vec\filter(DishRules::allergenCodes(), static fn (string $code): bool => Iter\contains($one['allergens'] ?? [], $code));
            $diets = Vec\filter(DishRules::dietCodes(), static fn (string $code): bool => Iter\contains($one['diets'] ?? [], $code));

            if (([] === $allergens) === !($one['containsNone'] ?? false)) {
                $violations[] = $this->violation($path . 'allergens', 'validation.dish_contains_required');
            }

            foreach (DishRules::clashes($allergens, $diets) as $diet => $key) {
                $violations[] = $this->violation($path . 'diets.' . $diet, $key);
            }

            $price = null;

            if (null !== $eventCurrency) {
                $cost = Str\trim($one['cost'] ?? '');

                if ('' !== $cost) {
                    $minor = DishRules::minorOf($cost, $eventCurrency);

                    if (null === $minor) {
                        $violations[] = $this->violation($path . 'cost', 'validation.variant_cost_invalid', ['{example}' => $this->dishRules->example($eventCurrency)]);
                    } else {
                        $price = new LastPrice($minor, $eventCurrency);
                    }
                }
            } elseif (null !== ($one['lastPrice'] ?? null) && '' !== Str\trim($one['lastPrice']['amount'])) {
                $currency = Str\uppercase(Str\trim($one['lastPrice']['currency']));

                if (!Regions::isCurrency($currency) && $currency !== $heldCurrency) {
                    $violations[] = $this->violation($path . 'lastPrice.currency', 'validation.currency_invalid');
                } else {
                    $minor = DishRules::minorOf(Str\trim($one['lastPrice']['amount']), $currency);

                    if (null === $minor) {
                        $violations[] = $this->violation($path . 'lastPrice.amount', 'validation.dish_price_invalid', ['{example}' => $this->dishRules->example($currency)]);
                    } else {
                        $price = new LastPrice($minor, $currency);
                    }
                }
            }

            $made[] = new VariantDetails($name, 'children' === $one['for'], $allergens, $diets, $price);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return $made;
    }

    /** The first variants come two at once, the rest one at a time, up to six. */
    public function refuseCount(int $existing, int $sent): void
    {
        if ($existing + Math\max([$sent, 1]) > DishVariant::PER_DISH_MAXIMUM) {
            throw new ApiException(ErrorCode::VariantLimit, 'menu.variant_limit', parameters: ['{max}' => DishVariant::PER_DISH_MAXIMUM]);
        }

        if ($sent !== (0 === $existing ? 2 : 1)) {
            throw ApiException::validation([$this->violation('variants', 0 === $existing ? 'validation.variants_first_two' : 'validation.variants_one_more')]);
        }
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
