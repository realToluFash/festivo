<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue;

use App\Domain\Billing\Catalogue\Exception\CatalogueRefused;
use App\Domain\Billing\Catalogue\Model\Allowance;
use App\Domain\Billing\Catalogue\Model\LimitTerms;
use App\Domain\Billing\Catalogue\Model\PlanCatalogue;
use App\Domain\Billing\Catalogue\Model\PlanTerms;
use App\Domain\Billing\Catalogue\Model\Price;
use App\Domain\Billing\Catalogue\Model\UnitCosts;
use App\Domain\Organisation\Regions;
use App\Enum\CatalogueLimit;
use App\Enum\CataloguePart;
use App\Enum\LimitKind;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use App\Enum\PlanSales;
use App\Enum\WhatsAppCategory;
use DateTimeImmutable;
use Psl\Dict;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Type\Exception\CoercionException;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** The one reader of a catalogue document: every plan, limit, currency and country is checked whole before anything uses it, so a version that is published always reads (sc-3928). */
final readonly class CatalogueParser
{
    public static function plans(Uuid $versionId, string $name, mixed $terms): PlanCatalogue
    {
        return new PlanCatalogue($versionId, $name, self::planTerms($terms));
    }

    public static function unitCosts(Uuid $versionId, string $name, DateTimeImmutable $effectiveFrom, mixed $terms): UnitCosts
    {
        $terms = self::unitCostTerms($terms);

        return new UnitCosts(
            $versionId,
            $name,
            $effectiveFrom,
            $terms['credit_price'],
            $terms['provider_micro_dollars_per_credit'],
            $terms['email'],
            $terms['ai']['model'],
            $terms['ai']['proposal'],
            $terms['ai']['question'],
            $terms['sms_per_segment'],
            $terms['whatsapp'],
        );
    }

    /** @throws CatalogueRefused naming what is wrong */
    public static function check(CataloguePart $part, mixed $terms): void
    {
        self::wholeNumbers($terms);

        match ($part) {
            CataloguePart::Plans => self::planTerms($terms),
            CataloguePart::UnitCosts => self::unitCostTerms($terms),
        };
    }

    /** @return array<string, PlanTerms> */
    private static function planTerms(mixed $terms): array
    {
        try {
            $plans = Type\dict(Type\string(), Type\shape([
                'sales' => Type\backed_enum(PlanSales::class),
                'limits' => Type\dict(Type\string(), Type\shape([
                    'kind' => Type\backed_enum(LimitKind::class),
                    'amount' => Type\union(Type\uint(), Type\literal_scalar(Allowance::UNLIMITED)),
                ])),
                'prices' => Type\dict(Type\string(), Type\shape([
                    'month' => Type\uint(),
                    'year' => Type\uint(),
                ])),
                'features' => Type\vec(Type\backed_enum(PlanFeature::class)),
            ]))->coerce($terms);
        } catch (CoercionException $e) {
            throw self::unreadable($e);
        }

        $missing = Vec\filter(Plan::cases(), static fn (Plan $plan): bool => !Iter\contains_key($plans, $plan->value));

        if ([] !== $missing) {
            throw new CatalogueRefused(Str\format('The catalogue has no %s plan.', Str\join(Vec\map($missing, static fn (Plan $plan): string => $plan->value), ', ')));
        }

        $read = [];

        foreach ($plans as $key => $plan) {
            self::known(null !== Plan::tryFrom($key), $key, 'plan');

            foreach (Vec\keys($plan['limits']) as $limit) {
                self::known(null !== CatalogueLimit::tryFrom($limit), $limit, 'limit');
            }

            $absent = Vec\filter(CatalogueLimit::cases(), static fn (CatalogueLimit $limit): bool => !Iter\contains_key($plan['limits'], $limit->value));

            if ([] !== $absent) {
                throw new CatalogueRefused(Str\format('The %s plan has no %s.', $key, Str\join(Vec\map($absent, static fn (CatalogueLimit $limit): string => $limit->value), ', ')));
            }

            foreach ($plan['limits'] as $limit => $line) {
                $expected = CatalogueLimit::from($limit)->kind();

                if ($expected !== $line['kind']) {
                    throw new CatalogueRefused(Str\format('The %s plan gives %s the kind %s, but %s is %s.', $key, $limit, $line['kind']->value, $limit, $expected->value));
                }
            }

            self::billedIn($key, Vec\map(Vec\keys($plan['prices']), static fn (int|string $code): string => (string) $code));

            $read[$key] = new PlanTerms(
                Plan::from($key),
                $plan['sales'],
                Dict\map($plan['limits'], static fn (array $limit): LimitTerms => new LimitTerms(
                    $limit['kind'],
                    Allowance::UNLIMITED === $limit['amount'] ? Allowance::unlimited() : Allowance::of($limit['amount']),
                )),
                Dict\map($plan['prices'], static fn (array $price): Price => new Price($price['month'], $price['year'])),
                Vec\values(Dict\unique_by($plan['features'], static fn (PlanFeature $feature): string => $feature->value)),
            );
        }

        return $read;
    }

    /** @return array{credit_price: array<string, int<0, max>>, provider_micro_dollars_per_credit: int<1, max>, email: int<0, max>, ai: array{model: non-empty-string, proposal: int<0, max>, question: int<0, max>}, sms_per_segment: array<string, int<0, max>>, whatsapp: array<string, array<string, int<0, max>>>} */
    private static function unitCostTerms(mixed $terms): array
    {
        try {
            $terms = Type\shape([
                'credit_price' => Type\dict(Type\string(), Type\uint()),
                'provider_micro_dollars_per_credit' => Type\positive_int(),
                'email' => Type\uint(),
                'ai' => Type\shape([
                    'model' => Type\non_empty_string(),
                    'proposal' => Type\uint(),
                    'question' => Type\uint(),
                ]),
                'sms_per_segment' => Type\dict(Type\string(), Type\uint()),
                'whatsapp' => Type\dict(Type\string(), Type\dict(Type\string(), Type\uint())),
            ])->coerce($terms);
        } catch (CoercionException $e) {
            throw self::unreadable($e);
        }

        self::currencies(Vec\keys($terms['credit_price']));
        self::countries(Vec\keys($terms['sms_per_segment']));

        foreach ($terms['whatsapp'] as $category => $byCountry) {
            self::known(null !== WhatsAppCategory::tryFrom($category), $category, 'WhatsApp category');
            self::countries(Vec\keys($byCountry));
        }

        return $terms;
    }

    /** Psl's integer types coerce 249.0 to 249, and the document is stored as sent, so a float that reads whole would be kept as a float. */
    private static function wholeNumbers(mixed $terms): void
    {
        if (\is_float($terms)) {
            throw new CatalogueRefused(Str\format('%s is written with a decimal point: every amount in the catalogue is an integer.', \var_export($terms, true)));
        }

        if (\is_array($terms)) {
            foreach ($terms as $value) {
                self::wholeNumbers($value);
            }
        }
    }

    private static function unreadable(CoercionException $e): CatalogueRefused
    {
        return new CatalogueRefused('The catalogue document does not read: ' . $e->getMessage(), previous: $e);
    }

    private static function known(bool $isKnown, string $value, string $what): void
    {
        if (!$isKnown) {
            throw new CatalogueRefused(Str\format('"%s" is not a %s the catalogue knows.', $value, $what));
        }
    }

    /** @param list<string> $codes */
    private static function billedIn(string $plan, array $codes): void
    {
        foreach (Price::CURRENCIES as $currency) {
            if (!Iter\contains($codes, $currency)) {
                throw new CatalogueRefused(Str\format('The %s plan has no %s price: every plan is priced in exactly %s.', $plan, $currency, Str\join(Price::CURRENCIES, ', ')));
            }
        }

        foreach ($codes as $code) {
            if (!Iter\contains(Price::CURRENCIES, $code)) {
                throw new CatalogueRefused(Str\format('The %s plan has a %s price, which Soirely does not bill in: every plan is priced in exactly %s.', $plan, $code, Str\join(Price::CURRENCIES, ', ')));
            }
        }
    }

    /** @param list<array-key> $codes */
    private static function currencies(array $codes): void
    {
        foreach ($codes as $code) {
            if (!Regex\matches((string) $code, '/^[A-Z]{3}$/')) {
                throw new CatalogueRefused(Str\format('"%s" is not an ISO 4217 currency code.', (string) $code));
            }
        }
    }

    /** @param list<array-key> $codes */
    private static function countries(array $codes): void
    {
        foreach ($codes as $code) {
            if (!Regions::isCountry((string) $code)) {
                throw new CatalogueRefused(Str\format('"%s" is not an assigned ISO 3166-1 alpha-2 country code.', (string) $code));
            }
        }
    }
}
