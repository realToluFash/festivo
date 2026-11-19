<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Billing\Catalogue\Exception\CatalogueRefused;
use App\Domain\Billing\Entitlements;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\CatalogueVersion;
use App\Entity\Organisation;
use App\Entity\Subscription;
use App\Entity\SubscriptionChange;
use App\Enum\CatalogueLimit;
use App\Enum\CataloguePart;
use App\Enum\Plan;
use App\Enum\PlanSales;
use App\Enum\SubscriptionChangeKind;
use App\Enum\WhatsAppCategory;
use App\Repository\CatalogueVersionRepository;
use App\Repository\SubscriptionRepository;
use App\Tests\FunctionalTestCase;
use DateTimeImmutable;
use Doctrine\DBAL\Exception as DbalException;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** sc-3928: one versioned catalogue holds every limit, feature and price, and the code reads it. */
final class PlanCatalogueTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private Catalogue $catalogue;
    private CatalogueKeeper $keeper;
    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->catalogue = self::service(Catalogue::class);
        $this->keeper = self::service(CatalogueKeeper::class);
        $this->organisation = $this->found('folake@ire.events', 'Ire Events');
    }

    #[Test]
    public function freeHoldsTheOwnersNumbers(): void
    {
        $free = $this->catalogue->inForce()->plan(Plan::Free);

        self::assertSame(
            [
                'live_events' => ['hard', 2],
                'guests_per_event' => ['hard', 100],
                'team_seats' => ['hard', 3],
                'email' => ['included', 2500],
                'sms' => ['metered', 0],
                'whatsapp' => ['metered', 0],
                'ai_requests' => ['metered', 5],
                'storage_bytes' => ['metered', 2_000_000_000],
                'credits' => ['credits', 50],
            ],
            self::limits(Plan::Free),
        );
        self::assertSame([PlanSales::SelfServe, 0, 0], [$free->sales, $free->price('USD')?->monthly, $free->price('USD')?->yearly]);
    }

    #[Test]
    public function enterpriseHoldsTheOwnersNumbersAndItsListPricesInMinorUnits(): void
    {
        $enterprise = $this->catalogue->inForce()->plan(Plan::Enterprise);

        self::assertSame(
            [
                'live_events' => ['hard', 'unlimited'],
                'guests_per_event' => ['hard', 'unlimited'],
                'team_seats' => ['hard', 'unlimited'],
                'email' => ['included', 100000],
                'sms' => ['metered', 0],
                'whatsapp' => ['metered', 0],
                'ai_requests' => ['metered', 100],
                'storage_bytes' => ['metered', 100_000_000_000],
                'credits' => ['credits', 3000],
            ],
            self::limits(Plan::Enterprise),
        );
        self::assertSame(PlanSales::Contract, $enterprise->sales);
        self::assertSame(
            ['USD' => [24900, 249000], 'EUR' => [22900, 229000], 'GBP' => [19900, 199000]],
            [
                'USD' => [$enterprise->price('USD')?->monthly, $enterprise->price('USD')?->yearly],
                'EUR' => [$enterprise->price('EUR')?->monthly, $enterprise->price('EUR')?->yearly],
                'GBP' => [$enterprise->price('GBP')?->monthly, $enterprise->price('GBP')?->yearly],
            ],
        );
    }

    #[Test]
    public function unlimitedIsAValueOfItsOwnAndCoversAnyCount(): void
    {
        $allowance = $this->catalogue->inForce()->plan(Plan::Enterprise)->limit(CatalogueLimit::GuestsPerEvent)->allowance;
        $free = $this->catalogue->inForce()->plan(Plan::Free)->limit(CatalogueLimit::GuestsPerEvent)->allowance;

        self::assertSame([true, null, true], [$allowance->isUnlimited(), $allowance->amount, $allowance->covers(\PHP_INT_MAX)]);
        self::assertSame([true, false], [$free->covers(100), $free->covers(101)]);
    }

    #[Test]
    public function unitCostsHoldTheOwnersCreditsPerUnitAndLeaveTheRestToTheFormula(): void
    {
        $costs = $this->catalogue->unitCosts();

        self::assertSame(
            [0, 13, 0, 'claude-opus-5-5', 2, 62, 1, 12, null, null],
            [
                $costs->email,
                $costs->aiProposal,
                $costs->aiQuestion,
                $costs->aiModel,
                $costs->smsPerSegment('US'),
                $costs->smsPerSegment('NG'),
                $costs->whatsApp(WhatsAppCategory::Utility, 'US'),
                $costs->whatsApp(WhatsAppCategory::Marketing, 'GB'),
                $costs->whatsApp(WhatsAppCategory::Marketing, 'US'),
                $costs->smsPerSegment('KE'),
            ],
        );
    }

    /** @return iterable<string, array{int, int}> */
    public static function providerCosts(): iterable
    {
        yield 'nothing' => [0, 0];
        yield 'exactly one credit' => [6300, 1];
        yield 'a millionth over rounds up' => [6301, 2];
        yield 'a UK utility message at $0.0280' => [28000, 5];
    }

    #[Test]
    #[DataProvider('providerCosts')]
    public function theFormulaIsTheProvidersCostOverItsDivisorRoundedUp(int $microDollars, int $credits): void
    {
        self::assertSame($credits, $this->catalogue->unitCosts()->creditsForProviderCost($microDollars));
    }

    #[Test]
    public function aSubscriptionKeepsTheTermsItWasSoldOnAfterANewVersionIsPublished(): void
    {
        $this->publishPlans('2026-12-01', ['free' => ['guests_per_event' => 150]]);
        $later = $this->found('ade@ire.events', 'Ade Events');

        self::assertSame(150, $this->catalogue->inForce()->plan(Plan::Free)->limit(CatalogueLimit::GuestsPerEvent)->allowance->amount);
        self::assertSame(100, self::service(Entitlements::class)->of($this->organisation->getId())->terms->limit(CatalogueLimit::GuestsPerEvent)->allowance->amount);
        self::assertSame('2026-10-19', $this->catalogue->soldTo($this->subscriptionOf($this->organisation))->name);
        self::assertSame('2026-12-01', $this->catalogue->soldTo($this->subscriptionOf($later))->name);
    }

    #[Test]
    public function publishingRecordsWhoWhenAndWhyInTheAuditTrail(): void
    {
        $version = $this->publishPlans('2026-12-01', ['free' => ['guests_per_event' => 150]]);
        $entry = $this->auditOf(CatalogueKeeper::PUBLISHED);

        self::assertSame(
            ['Ada at Soirely', 'Free guest cap to 150', $version->getId()->toRfc4122(), ['plans', '2026-12-01', 'Free guest cap to 150']],
            [$entry->getActorLabel(), $version->getNote(), $entry->getSubjectId()->toRfc4122(), [$entry->getChanges()['part'][1] ?? null, $entry->getChanges()['name'][1] ?? null, $entry->getChanges()['note'][1] ?? null]],
        );
    }

    #[Test]
    public function movingSubscribersPutsEveryOneOnTheNewTermsAuditedAndSaysHowMany(): void
    {
        $other = $this->found('ade@ire.events', 'Ade Events');
        $was = $this->subscriptionOf($other)->getCatalogueVersion();
        $version = $this->publishPlans('2026-12-01', ['free' => ['guests_per_event' => 150]]);

        $moved = $this->keeper->moveSubscribers($version, $was, 'Raising the Free cap for everyone', 'Ada at Soirely');

        self::assertSame(2, $moved);
        self::assertSame(150, self::service(Entitlements::class)->of($this->organisation->getId())->terms->limit(CatalogueLimit::GuestsPerEvent)->allowance->amount);
        self::assertSame(2, $this->auditOf(CatalogueKeeper::MOVED)->getChanges()['moved'][1] ?? null);

        $change = self::service(EntityManagerInterface::class)->getRepository(SubscriptionChange::class)->findOneBy(['subscription' => $this->subscriptionOf($other), 'kind' => SubscriptionChangeKind::CatalogueVersion]);
        self::assertSame(['2026-10-19', '2026-12-01', 'Ada at Soirely'], [$change?->getFromValue(), $change?->getToValue(), $change?->getActorLabel()]);
        self::assertSame(0, $this->keeper->moveSubscribers($version, null, 'Again', 'Ada at Soirely'), 'nobody is left to move');
    }

    #[Test]
    public function aVersionInUseIsNeverWithdrawnAndAnUnusedOneIs(): void
    {
        $inUse = $this->subscriptionOf($this->organisation)->getCatalogueVersion();
        $unused = $this->publishPlans('2026-12-01', ['free' => ['guests_per_event' => 150]]);

        $this->keeper->withdraw($unused, 'Published by mistake', 'Ada at Soirely');

        self::assertNull(self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::Plans, '2026-12-01'));
        $this->expectException(CatalogueRefused::class);
        $this->keeper->withdraw($inUse, 'Tidying', 'Ada at Soirely');
    }

    #[Test]
    public function unitCostsInForceAreNeverWithdrawn(): void
    {
        $inForce = self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::UnitCosts, '2026-10-19') ?? self::fail('missing');

        $this->expectException(CatalogueRefused::class);
        $this->keeper->withdraw($inForce, 'Tidying', 'Ada at Soirely');
    }

    #[Test]
    public function aVersionIsNeverEditedInPlace(): void
    {
        $this->expectException(DbalException::class);
        self::service(EntityManagerInterface::class)->getConnection()->executeStatement("UPDATE catalogue_versions SET note = 'edited' WHERE part = 'plans'");
    }

    #[Test]
    public function aRiseInAUnitCostAppliesAfterTheNoticeAndAReservationKeepsTheOldCost(): void
    {
        $was = $this->catalogue->unitCosts();
        $version = $this->publishUnitCosts('2026-12-01', ['sms_per_segment', 'GB'], 10);
        $now = self::service(ClockInterface::class)->now();

        self::assertEquals($version->getPublishedAt()->modify('+14 days'), $version->getEffectiveFrom());
        self::assertSame(9, $this->catalogue->unitCosts()->smsPerSegment('GB'));
        self::assertSame(10, $this->catalogue->unitCosts($now->modify('+15 days'))->smsPerSegment('GB'));
        self::assertSame('2026-12-01', $this->catalogue->upcomingUnitCosts()?->name);
        self::assertSame(9, $this->catalogue->unitCostsVersion($was->versionId)->smsPerSegment('GB'));
    }

    #[Test]
    public function aSecondUnitCostVersionIsRefusedWhileOneIsPending(): void
    {
        $pending = $this->publishUnitCosts('2026-12-01', ['sms_per_segment', 'GB'], 10);

        $this->expectExceptionMessage('Unit costs 2026-12-01 are pending and apply from ' . $pending->getEffectiveFrom()->format('j M Y'));
        $this->publishUnitCosts('2026-12-08', ['sms_per_segment', 'GB'], 8);
    }

    #[Test]
    public function onceThePendingVersionIsWithdrawnTheNextIsComparedWithTheCostsInForce(): void
    {
        $pending = $this->publishUnitCosts('2026-12-01', ['sms_per_segment', 'GB'], 10);
        $this->keeper->withdraw($pending, 'Folding into one version', 'Ada at Soirely');

        $fall = $this->publishUnitCosts('2026-12-08', ['sms_per_segment', 'GB'], 8);

        self::assertEquals($fall->getPublishedAt(), $fall->getEffectiveFrom());
        self::assertSame(8, $this->catalogue->unitCosts()->smsPerSegment('GB'));
    }

    /** @return iterable<string, array{non-empty-list<string>, ?int, bool}> */
    public static function unitCostChanges(): iterable
    {
        yield 'pricing a country the formula priced' => [['sms_per_segment', 'AQ'], 1, true];
        yield 'pricing a category the formula priced in a country' => [['whatsapp', 'marketing', 'DE'], 1, true];
        yield 'leaving a priced country to the formula' => [['sms_per_segment', 'NG'], null, true];
        yield 'lowering the divisor' => [['provider_micro_dollars_per_credit'], 6000, true];
        yield 'raising the divisor' => [['provider_micro_dollars_per_credit'], 6500, false];
        yield 'lowering a priced cell' => [['sms_per_segment', 'DE'], 17, false];
        yield 'raising email' => [['email'], 1, true];
        yield 'raising an AI proposal' => [['ai', 'proposal'], 14, true];
        yield 'raising an AI question' => [['ai', 'question'], 1, true];
        yield 'lowering an AI proposal' => [['ai', 'proposal'], 12, false];
    }

    /** @param non-empty-list<string> $path */
    #[Test]
    #[DataProvider('unitCostChanges')]
    public function aUnitCostVersionWaitsForTheNoticeOnlyWhenItMayChargeMore(array $path, ?int $value, bool $waits): void
    {
        $terms = self::with($this->termsOf(CataloguePart::UnitCosts), $path, $value);
        $version = $this->keeper->publish(CataloguePart::UnitCosts, '2026-12-01', $terms, 'Twilio repriced', 'Ada at Soirely');

        self::assertEquals($waits ? $version->getPublishedAt()->modify('+14 days') : $version->getPublishedAt(), $version->getEffectiveFrom());
    }

    #[Test]
    public function aPendingVersionThatPricesACountryTheFormulaPricedRefusesTheNext(): void
    {
        $pending = $this->publishUnitCosts('2026-12-01', ['sms_per_segment', 'AQ'], 1);

        $this->expectExceptionMessage('Unit costs 2026-12-01 are pending and apply from ' . $pending->getEffectiveFrom()->format('j M Y'));
        $this->publishUnitCosts('2026-12-08', ['sms_per_segment', 'GB'], 8);
    }

    #[Test]
    public function aMomentBeforeTheFirstVersionIsAnsweredByIt(): void
    {
        self::assertSame('2026-10-19', $this->catalogue->unitCosts(new DateTimeImmutable('2020-01-01'))->name);
    }

    #[Test]
    public function aFallInUnitCostsAppliesAtOnce(): void
    {
        $this->publishUnitCosts('2026-12-01', ['sms_per_segment', 'GB'], 8);

        self::assertSame(8, $this->catalogue->unitCosts()->smsPerSegment('GB'));
    }

    /** @return iterable<string, array{array<array-key, mixed>}> */
    public static function brokenPlans(): iterable
    {
        yield 'a plan missing' => [['free' => []]];
        yield 'a number as a float' => [['free' => ['sales' => 'self_serve', 'limits' => ['live_events' => ['kind' => 'hard', 'amount' => 2.5]], 'prices' => [], 'features' => []]]];
        yield 'not a document' => [['free', 'enterprise']];
    }

    #[Test]
    public function aWholeNumberWrittenAsAFloatIsNeverPublished(): void
    {
        $terms = self::with($this->termsOf(CataloguePart::Plans), ['enterprise', 'prices', 'USD', 'month'], 249.0);

        $this->expectExceptionMessage('249.0 is written with a decimal point');
        $this->keeper->publish(CataloguePart::Plans, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    #[Test]
    public function aUnitCostWrittenAsAFloatIsNeverPublished(): void
    {
        $terms = self::with($this->termsOf(CataloguePart::UnitCosts), ['sms_per_segment', 'GB'], 10.0);

        $this->expectExceptionMessage('10.0 is written with a decimal point');
        $this->keeper->publish(CataloguePart::UnitCosts, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    #[Test]
    #[DataProvider('brokenPlans')]
    public function aDocumentThatDoesNotReadIsNeverPublished(array $terms): void
    {
        $this->expectException(CatalogueRefused::class);
        $this->keeper->publish(CataloguePart::Plans, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    #[Test]
    public function aPlanLackingALimitIsNeverPublished(): void
    {
        $terms = self::with($this->termsOf(CataloguePart::Plans), ['free', 'limits', 'team_seats'], null);

        $this->expectExceptionMessage('team_seats');
        $this->keeper->publish(CataloguePart::Plans, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    #[Test]
    public function aPlanWithoutAPriceInEveryCurrencySoirelyBillsInIsNeverPublished(): void
    {
        $terms = self::with($this->termsOf(CataloguePart::Plans), ['free', 'prices', 'GBP'], null);

        $this->expectExceptionMessage('The free plan has no GBP price: every plan is priced in exactly USD, EUR, GBP.');
        $this->keeper->publish(CataloguePart::Plans, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    #[Test]
    public function aPriceInACurrencySoirelyDoesNotBillInIsNeverPublished(): void
    {
        $terms = self::with($this->termsOf(CataloguePart::Plans), ['enterprise', 'prices', 'NGN'], ['month' => 1, 'year' => 1]);

        $this->expectExceptionMessage('The enterprise plan has a NGN price, which Soirely does not bill in');
        $this->keeper->publish(CataloguePart::Plans, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    #[Test]
    public function aLimitGivenAnotherKindIsNeverPublished(): void
    {
        $terms = self::with($this->termsOf(CataloguePart::Plans), ['free', 'limits', 'team_seats', 'kind'], 'metered');

        $this->expectExceptionMessage('The free plan gives team_seats the kind metered, but team_seats is hard.');
        $this->keeper->publish(CataloguePart::Plans, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    /** @return iterable<string, array{string}> */
    public static function providerUnassignedCountries(): iterable
    {
        yield 'reserved, unknown to ICU' => ['UK'];
        yield 'reserved, known to ICU' => ['IC'];
        yield 'user-assigned, known to ICU' => ['XK'];
    }

    #[Test]
    #[DataProvider('providerUnassignedCountries')]
    public function aCountryCodeThatIsNotAssignedIsNeverPublished(string $code): void
    {
        $terms = self::with($this->termsOf(CataloguePart::UnitCosts), ['sms_per_segment', $code], 9);

        $this->expectExceptionMessage(Str\format('"%s" is not an assigned ISO 3166-1 alpha-2 country code.', $code));
        $this->keeper->publish(CataloguePart::UnitCosts, '2026-12-01', $terms, 'Broken', 'Ada at Soirely');
    }

    #[Test]
    public function aRefusedVersionStoresNothingAndAuditsNothing(): void
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $count = static fn (): array => [
            $entityManager->getRepository(CatalogueVersion::class)->count([]),
            $entityManager->getRepository(AuditEntry::class)->count(['action' => CatalogueKeeper::PUBLISHED]),
        ];
        $before = $count();

        try {
            $this->keeper->publish(CataloguePart::Plans, '2026-12-01', self::with($this->termsOf(CataloguePart::Plans), ['free', 'limits', 'team_seats', 'kind'], 'metered'), 'Broken', 'Ada at Soirely');
            self::fail('The version was published.');
        } catch (CatalogueRefused) {
        }

        self::assertSame($before, $count());
    }

    #[Test]
    public function aStaffActionNamesWhoAndWhy(): void
    {
        $this->expectException(CatalogueRefused::class);
        $this->keeper->publish(CataloguePart::Plans, '2026-12-01', $this->termsOf(CataloguePart::Plans), '  ', 'Ada at Soirely');
    }

    #[Test]
    public function aReadIsServedFromMemoryUntilAPublicationClearsIt(): void
    {
        $connection = self::service(EntityManagerInterface::class)->getConnection();
        self::assertSame(100, $this->catalogue->inForce()->plan(Plan::Free)->limit(CatalogueLimit::GuestsPerEvent)->allowance->amount);

        $connection->executeStatement(<<<'SQL'
            INSERT INTO catalogue_versions (id, part, name, terms, note, published_by, published_at, effective_from)
            SELECT gen_random_uuid(), part, 'behind its back', terms, note, published_by, '2026-11-01', '2026-11-01'
            FROM   catalogue_versions
            WHERE  part = 'plans'
            SQL);

        self::assertSame('2026-10-19', $this->catalogue->inForce()->name, 'read again without the database');

        $this->catalogue->forget();
        self::assertSame('behind its back', $this->catalogue->inForce()->name);
    }

    /** @return array<string, array{string, int|string}> */
    private static function limits(Plan $plan): array
    {
        $terms = self::service(Catalogue::class)->inForce()->plan($plan);
        $limits = [];

        foreach (CatalogueLimit::cases() as $limit) {
            $line = $terms->limit($limit);
            $limits[$limit->value] = [$line->kind->value, $line->allowance->written()];
        }

        return $limits;
    }

    /** @param array<string, array<string, int|string>> $amounts plan => limit => amount */
    private function publishPlans(string $name, array $amounts): CatalogueVersion
    {
        $terms = $this->termsOf(CataloguePart::Plans);

        foreach ($amounts as $plan => $limits) {
            foreach ($limits as $limit => $amount) {
                $terms = self::with($terms, [$plan, 'limits', $limit, 'amount'], $amount);
            }
        }

        return $this->keeper->publish(CataloguePart::Plans, $name, $terms, 'Free guest cap to 150', 'Ada at Soirely');
    }

    /** @param non-empty-list<string> $path */
    private function publishUnitCosts(string $name, array $path, int $credits): CatalogueVersion
    {
        return $this->keeper->publish(CataloguePart::UnitCosts, $name, self::with($this->termsOf(CataloguePart::UnitCosts), $path, $credits), 'Twilio repriced', 'Ada at Soirely');
    }

    /**
     * The document with the value at `$path` replaced, or removed when it is null.
     *
     * @param array<array-key, mixed> $terms
     * @param non-empty-list<string>  $path
     *
     * @return array<array-key, mixed>
     */
    private static function with(array $terms, array $path, mixed $value): array
    {
        $key = $path[0];
        $rest = Vec\drop($path, 1);

        if ([] !== $rest) {
            $terms[$key] = self::with(Type\dict(Type\array_key(), Type\mixed())->coerce($terms[$key] ?? []), $rest, $value);
        } elseif (null === $value) {
            unset($terms[$key]);
        } else {
            $terms[$key] = $value;
        }

        return $terms;
    }

    /** @return array<array-key, mixed> */
    private function termsOf(CataloguePart $part): array
    {
        $version = self::service(CatalogueVersionRepository::class)->findOneByName($part, '2026-10-19') ?? self::fail('The first version is missing.');

        return $version->getTerms();
    }

    private function auditOf(string $action): AuditEntry
    {
        return self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => $action], ['occurredAt' => 'DESC', 'id' => 'DESC']) ?? self::fail('No ' . $action . ' audit entry.');
    }

    private function subscriptionOf(Organisation $organisation): Subscription
    {
        return self::service(SubscriptionRepository::class)->findCurrentOf($organisation->getId());
    }

    private function found(string $email, string $name): Organisation
    {
        $owner = self::service(UserRegistrar::class)->register($email, 'Folake Adeyemi', self::PASSWORD)->user;
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return $organisation;
    }
}
