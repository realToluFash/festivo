<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\ScheduledPayment;
use App\Entity\User;
use App\Entity\Vendor;
use App\Entity\VendorEngagement;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Enum\VendorCategory;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use stdClass;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mercure\Update;
use Symfony\Component\Uid\Uuid;

final class PayersTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@bloom.events', 'Harriet Cole');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Bloom Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function anEventWithNoPayersAndNoCostsReadsEmpty(): void
    {
        $read = $this->as($this->owner, 'GET', $this->payers());

        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertSame([], $read['payers']);
        self::assertSame([], $read['lines']);
        self::assertSame(['confirmed' => '0.00', 'potential' => '0.00'], $read['hasPayer']);
        self::assertNull($read['next']);
    }

    #[Test]
    public function aPayerIsANameAndANoteTrimmed(): void
    {
        $added = $this->as($this->owner, 'POST', $this->payers(), ['name' => '  Aunt Funmi ', 'note' => '  Covering the cars ']);

        self::assertSame(201, $this->statusCode(), Json\encode($added));
        $payer = Type\shape(['id' => Type\string(), 'name' => Type\string(), 'note' => Type\nullable(Type\string())])->coerce($added['payer'] ?? null);
        self::assertSame(['Aunt Funmi', 'Covering the cars'], [$payer['name'], $payer['note']]);

        $this->as($this->owner, 'PUT', $this->payers($payer['id']), ['name' => 'Aunt Funmi', 'note' => '   ']);
        self::assertSame(200, $this->statusCode());
        self::assertNull($this->payerRows()[0]['note']);
    }

    /** @return iterable<string, array{array<string, string>, string, string}> */
    public static function refusedPayers(): iterable
    {
        yield 'a blank name' => [['name' => '   '], 'name', 'Enter a name.'];
        yield 'a name over 60' => [['name' => Str\repeat('a', 61)], 'name', 'Use 60 characters or fewer.'];
        yield 'the same name in another case' => [['name' => ' mum '], 'name', 'Another payer on this event is already called Mum.'];
        yield 'a note over 200' => [['name' => 'Dad', 'note' => Str\repeat('n', 201)], 'note', 'Use 200 characters or fewer.'];
    }

    /** @param array<string, string> $body */
    #[Test]
    #[DataProvider('refusedPayers')]
    public function aPayerTheFormRefusesTheApiRefuses(array $body, string $path, string $message): void
    {
        $this->addPayer('Mum');

        $this->as($this->owner, 'POST', $this->payers(), $body);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($path)['message'] ?? null);
        self::assertCount(1, $this->payerRows());
    }

    #[Test]
    public function anEventHoldsAtMostTwentyPayers(): void
    {
        foreach (Vec\range(1, 20) as $n) {
            $this->addPayer('Payer ' . $n);
        }

        $this->as($this->owner, 'POST', $this->payers(), ['name' => 'One more']);

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::PayerLimit->type(), $this->last()['type'] ?? null);
        self::assertCount(20, $this->payerRows());
    }

    #[Test]
    public function aPercentageSplitRoundsDownAndGivesTheLeftoverByLargestRemainder(): void
    {
        $line = $this->addCost('Dinner', '1234.56');
        $payers = [$this->addPayer('Mum'), $this->addPayer('Dad'), $this->addPayer('Aunt Funmi')];

        $read = $this->choose([$line], ['mode' => 'percent', 'shares' => [
            ['payerId' => $payers[0], 'percent' => '33.33'],
            ['payerId' => $payers[1], 'percent' => '33.33'],
            ['payerId' => $payers[2], 'percent' => '33.34'],
        ]]);

        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertSame(['411.48', '411.48', '411.60'], Vec\map($this->payerRows(), static fn (array $row): string => $row['share']['confirmed']));
        self::assertSame(['confirmed' => '1234.56', 'potential' => '1234.56'], $read['hasPayer']);
    }

    #[Test]
    public function aPennyAtFiftyFiftyGoesToThePayerAddedFirst(): void
    {
        $line = $this->addCost('Favours', '0.01');
        $first = $this->addPayer('Mum');
        $second = $this->addPayer('Dad');

        $this->choose([$line], ['mode' => 'percent', 'shares' => [['payerId' => $second, 'percent' => '50'], ['payerId' => $first, 'percent' => '50']]]);

        self::assertSame(['0.01', '0.00'], Vec\map($this->payerRows(), static fn (array $row): string => $row['share']['confirmed']));
    }

    /** @return iterable<string, array{list<string>, string, string}> */
    public static function refusedPercentages(): iterable
    {
        yield 'not 100' => [['50', '40'], 'split.shares', 'The percentages come to 90.00. Make them add up to exactly 100.'];
        yield 'above 100' => [['105', ''], 'split.shares.0', 'Use a number from 0 to 100.'];
        yield 'below 0' => [['-5', '105'], 'split.shares.0', 'Use a number from 0 to 100.'];
        yield 'three decimals' => [['33.333', '66.667'], 'split.shares.0', 'Use a number from 0 to 100, with up to two decimal places.'];
        yield 'nobody above 0' => [['0', ''], 'split.shares', 'The percentages come to 0.00. Make them add up to exactly 100.'];
    }

    /** @param list<string> $percents */
    #[Test]
    #[DataProvider('refusedPercentages')]
    public function aPercentageSplitTheFormRefusesTheApiRefuses(array $percents, string $path, string $message): void
    {
        $line = $this->addCost('Dinner', '6800');
        $payers = [$this->addPayer('Mum'), $this->addPayer('Dad')];

        $this->choose([$line], ['mode' => 'percent', 'shares' => Vec\map_with_key($percents, static fn (int $at, string $percent): array => ['payerId' => $payers[$at], 'percent' => $percent])]);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation(Str\replace($path, 'split.shares.0', 'split.shares.' . $payers[0]))['message'] ?? null, Json\encode($this->last()));
        self::assertNull($this->lineRows()[0]['split']);
    }

    #[Test]
    public function aFixedSplitTakesNoMoreThanTheCostAndOnePayerCoversTheRest(): void
    {
        $line = $this->addCost('Cars', '900');
        $funmi = $this->addPayer('Aunt Funmi');
        $mum = $this->addPayer('Mum');

        $this->choose([$line], ['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '900.01']], 'restId' => $mum], 'GBP');
        self::assertSame(422, $this->statusCode());
        self::assertSame('The fixed amounts come to £900.01, more than £900.00, the least this can cost. Lower them so they fit.', $this->violation('split.amounts')['message'] ?? null);

        $this->choose([$line], ['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '400']], 'restId' => null], 'GBP');
        self::assertSame('Choose who covers what is left.', $this->violation('split.restId')['message'] ?? null);

        $this->choose([$line], ['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '400.505']], 'restId' => $mum], 'GBP');
        self::assertSame(422, $this->statusCode());
        self::assertNotNull($this->violation('split.amounts.' . $funmi));

        $this->choose([$line], ['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '400']], 'restId' => $mum], 'GBP');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['400.00', '500.00'], Vec\map($this->payerRows(), static fn (array $row): string => $row['share']['confirmed']));
        self::assertSame(['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '400.00']], 'restId' => $mum], $this->lineRows()[0]['split']);
    }

    #[Test]
    public function aFixedSplitIsNeverReSpreadWhenTheCostFallsBelowIt(): void
    {
        $line = $this->addCost('Cars', '900');
        $funmi = $this->addPayer('Aunt Funmi');
        $mum = $this->addPayer('Mum');
        $this->choose([$line], ['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '400']], 'restId' => $mum], 'GBP');

        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/budget/lines/' . $line, ['label' => 'Cars', 'category' => 'transport', 'basis' => 'fixed', 'amount' => '350', 'currency' => 'GBP']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertTrue($this->lineRows()[0]['flagged']);
        self::assertSame(['400.00', '0.00'], Vec\map($this->payerRows(), static fn (array $row): string => $row['share']['confirmed']));
        self::assertSame(['confirmed' => '350.00', 'potential' => '350.00'], $this->as($this->owner, 'GET', $this->payers())['hasPayer']);
    }

    #[Test]
    public function fixedAmountsAreSetOneCostAtATime(): void
    {
        $funmi = $this->addPayer('Aunt Funmi');
        $mum = $this->addPayer('Mum');

        $this->choose([$this->addCost('Cars', '900'), $this->addCost('Band', '900')], ['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '400']], 'restId' => $mum], 'GBP');

        self::assertSame(422, $this->statusCode());
        self::assertNotNull($this->violation('split.mode'));
    }

    #[Test]
    public function choosingForSeveralCostsReplacesEachSplitAndLeavingThemPutsThemBackToNoPayer(): void
    {
        $cars = $this->addCost('Cars', '900');
        $band = $this->addCost('Band', '1500');
        $mum = $this->addPayer('Mum');

        $read = $this->choose([$cars, $band], ['mode' => 'one', 'payerId' => $mum]);
        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertSame(['confirmed' => '2400.00', 'potential' => '2400.00'], $this->payerRows()[0]['share']);
        self::assertSame(0, Type\shape(['costs' => Type\int()], true)->coerce($read['noPayer'])['costs']);

        $read = $this->choose([$band], null);
        self::assertSame(1, Type\shape(['costs' => Type\int()], true)->coerce($read['noPayer'])['costs']);
        self::assertSame(['id' => $band, 'label' => 'Band'], $read['next']);
        self::assertSame(['confirmed' => '900.00', 'potential' => '900.00'], $this->payerRows()[0]['share']);
    }

    #[Test]
    public function aPayerWhoCoversACostIsNotRemovedAndOneWhoCoversNothingIsWithUndo(): void
    {
        $cars = $this->addCost('Cars', '900');
        $mum = $this->addPayer('Mum');
        $kayode = $this->addPayer('Uncle Kayode');
        $this->choose([$cars], ['mode' => 'one', 'payerId' => $mum]);

        $this->as($this->owner, 'DELETE', $this->payers($mum));
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::PayerCoversCosts->type(), $this->last()['type'] ?? null);
        self::assertSame([$cars], $this->last()['lineIds'] ?? null);
        self::assertSame('Mum covers 1 cost. Choose who pays for it first.', $this->last()['detail'] ?? null);

        $this->as($this->owner, 'DELETE', $this->payers($kayode));
        self::assertSame(204, $this->statusCode());
        self::assertSame(['Mum'], Vec\map($this->payerRows(), static fn (array $row): string => $row['name']));

        $this->as($this->owner, 'DELETE', $this->payers($kayode) . '/removal');
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Mum', 'Uncle Kayode'], Vec\map($this->payerRows(), static fn (array $row): string => $row['name']));
    }

    #[Test]
    public function aSaveNamingAPayerRemovedMeanwhileIsRefusedWithTheirName(): void
    {
        $cars = $this->addCost('Cars', '900');
        $kayode = $this->addPayer('Uncle Kayode');
        $this->as($this->owner, 'DELETE', $this->payers($kayode));

        $this->choose([$cars], ['mode' => 'one', 'payerId' => $kayode]);

        self::assertSame(422, $this->statusCode());
        $violation = $this->violation('split.payerId') ?? self::fail('no violation');
        self::assertSame('payer_removed', $violation['code']);
        self::assertStringStartsWith('Uncle Kayode was removed by someone else', $violation['message']);
    }

    #[Test]
    public function aSaveNamingACostRemovedMeanwhileIsRefusedWithItsName(): void
    {
        $cars = $this->addCost('Cars', '900');
        $mum = $this->addPayer('Mum');
        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/budget/lines/' . $cars);

        $this->choose([$cars], ['mode' => 'one', 'payerId' => $mum]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('budget_line_removed', ($this->violation('lineIds') ?? self::fail('no violation'))['code']);
    }

    #[Test]
    public function aPaymentMarkedPaidIsCreditedInProportionToEachPayersPartUnderTheSplitAsItStandsNow(): void
    {
        $photo = $this->addCost('Photographer', '2000');
        $mum = $this->addPayer('Mum');
        $dad = $this->addPayer('Dad');
        $this->choose([$photo], ['mode' => 'percent', 'shares' => [['payerId' => $mum, 'percent' => '50'], ['payerId' => $dad, 'percent' => '50']]]);
        $this->paid($photo, 100000);

        self::assertSame(['500.00', '500.00'], Vec\map($this->payerRows(), static fn (array $row): ?string => $row['paid']));
        self::assertSame(['confirmed' => '500.00', 'potential' => '500.00'], $this->payerRows()[0]['stillToCome']);

        $this->choose([$photo], ['mode' => 'percent', 'shares' => [['payerId' => $mum, 'percent' => '75'], ['payerId' => $dad, 'percent' => '25']]]);
        self::assertSame(['750.00', '250.00'], Vec\map($this->payerRows(), static fn (array $row): ?string => $row['paid']));
        self::assertSame(['confirmed' => '250.00', 'potential' => '250.00'], $this->payerRows()[1]['stillToCome']);
    }

    #[Test]
    public function aPaymentOnACostWithNoPayerCountsUnderNoPayerYet(): void
    {
        $photo = $this->addCost('Photographer', '2000');
        $this->addPayer('Mum');
        $this->paid($photo, 100000);

        $read = $this->as($this->owner, 'GET', $this->payers());

        self::assertSame('1000.00', Type\shape(['paid' => Type\string()], true)->coerce($read['noPayer'])['paid']);
        self::assertSame('0.00', $this->payerRows()[0]['paid']);
    }

    #[Test]
    public function aPaymentWhoseVendorCoversNoCostCountsInFullUnderNoPayerYet(): void
    {
        $photo = $this->addCost('Photographer', '2000');
        $mum = $this->addPayer('Mum');
        $this->choose([$photo], ['mode' => 'one', 'payerId' => $mum]);
        $this->paid(null, 30000);

        $read = $this->as($this->owner, 'GET', $this->payers());

        self::assertSame('300.00', Type\shape(['paid' => Type\string()], true)->coerce($read['noPayer'])['paid']);
        self::assertSame('0.00', $this->payerRows()[0]['paid']);
    }

    #[Test]
    public function stillToComeIsNeverBelowNothing(): void
    {
        $photo = $this->addCost('Photographer', '1000');
        $mum = $this->addPayer('Mum');
        $this->choose([$photo], ['mode' => 'one', 'payerId' => $mum]);
        $this->paid($photo, 120000);

        self::assertSame('1200.00', $this->payerRows()[0]['paid']);
        self::assertSame(['confirmed' => '0.00', 'potential' => '0.00'], $this->payerRows()[0]['stillToCome']);
    }

    #[Test]
    public function stillToComeWithOnlyItsLowerEndPaidOffStaysARange(): void
    {
        $this->maybe('Bisi');
        $photo = $this->addCost('Photographer', '1000');
        $catering = $this->addCatering('48');
        $mum = $this->addPayer('Mum');
        $this->choose([$photo, $catering], ['mode' => 'one', 'payerId' => $mum]);
        $this->paid($photo, 102000);

        self::assertSame(['confirmed' => '1000.00', 'potential' => '1048.00'], $this->payerRows()[0]['share']);
        self::assertSame(['confirmed' => '0.00', 'potential' => '28.00'], $this->payerRows()[0]['stillToCome']);
    }

    #[Test]
    public function aCostNotPricedAddsNothingToAShareIsCountedAndComesLast(): void
    {
        $flowers = $this->addCost('Flowers', '0');
        $band = $this->addCost('Band', '1500');
        $mum = $this->addPayer('Mum');
        $this->choose([$flowers, $band], ['mode' => 'one', 'payerId' => $mum]);

        $mine = Type\shape([
            'share' => Type\shape(['confirmed' => Type\string(), 'potential' => Type\string()]),
            'notPriced' => Type\int(),
            'covers' => Type\vec(Type\shape(['label' => Type\string(), 'notPriced' => Type\bool()], true)),
        ], true)->coerce(Type\vec(Type\mixed())->coerce($this->as($this->owner, 'GET', $this->payers())['payers'] ?? null)[0] ?? null);

        self::assertSame(['confirmed' => '1500.00', 'potential' => '1500.00'], $mine['share']);
        self::assertSame(1, $mine['notPriced']);
        self::assertSame([['Band', false], ['Flowers', true]], Vec\map($mine['covers'], static fn (array $cover): array => [$cover['label'], $cover['notPriced']]));
    }

    #[Test]
    public function theAgencysFeeAtNothingWithAClientPriceOfItsOwnIsPriced(): void
    {
        $fee = $this->addCost('Planning fee', '0');
        $mum = $this->addPayer('Mum');
        $this->choose([$fee], ['mode' => 'one', 'payerId' => $mum]);
        (self::em()->find(BudgetLine::class, Uuid::fromString($fee)) ?? self::fail('no line'))->chargeAt(120000);
        self::em()->flush();

        $mine = Type\shape([
            'notPriced' => Type\int(),
            'covers' => Type\vec(Type\shape(['label' => Type\string(), 'notPriced' => Type\bool()], true)),
        ], true)->coerce(Type\vec(Type\mixed())->coerce($this->as($this->owner, 'GET', $this->payers())['payers'] ?? null)[0] ?? null);

        self::assertSame([0, [['Planning fee', false]]], [$mine['notPriced'], Vec\map($mine['covers'], static fn (array $cover): array => [$cover['label'], $cover['notPriced']])]);
    }

    #[Test]
    public function aRiseOnAFixedSplitGoesToWhoeverCoversTheRestWithNoFlag(): void
    {
        $line = $this->addCost('Cars', '900');
        $funmi = $this->addPayer('Aunt Funmi');
        $mum = $this->addPayer('Mum');
        $this->choose([$line], ['mode' => 'fixed', 'amounts' => [['payerId' => $funmi, 'amount' => '400']], 'restId' => $mum], 'GBP');

        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/budget/lines/' . $line, ['label' => 'Cars', 'category' => 'transport', 'basis' => 'fixed', 'amount' => '1000', 'currency' => 'GBP']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertFalse($this->lineRows()[0]['flagged']);
        self::assertSame(['400.00', '600.00'], Vec\map($this->payerRows(), static fn (array $row): string => $row['share']['confirmed']));
    }

    #[Test]
    public function undoingACostRemovedOnTheBudgetBringsItBackWithItsSplit(): void
    {
        $photo = $this->addCost('Photographer', '2000');
        $mum = $this->addPayer('Mum');
        $this->choose([$photo], ['mode' => 'one', 'payerId' => $mum]);

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/budget/lines/' . $photo);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([], $this->lineRows());

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/budget/lines/' . $photo . '/removal');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(['mode' => 'one', 'payerId' => $mum], $this->lineRows()[0]['split']);
        self::assertSame(['confirmed' => '2000.00', 'potential' => '2000.00'], $this->payerRows()[0]['share']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function foreignToTheSplit(): iterable
    {
        yield 'one payer from another event in the organisation' => ['one', 'sibling'];
        yield 'one payer from another organisation' => ['one', 'stranger'];
        yield 'a percentage for a payer from another event in the organisation' => ['percent', 'sibling'];
        yield 'a percentage for a payer from another organisation' => ['percent', 'stranger'];
        yield 'a cost from another event' => ['cost', 'sibling'];
        yield 'a mode outside the three' => ['thirds', 'sibling'];
    }

    #[Test]
    #[DataProvider('foreignToTheSplit')]
    public function aSplitNamingSomethingOutsideTheEventIsRefusedAndNeverSaved(string $case, string $from): void
    {
        $dinner = $this->addCost('Dinner', '1000');
        $mum = $this->addPayer('Mum');
        [$theirPayer, $theirCost] = $this->elsewhere('stranger' === $from);

        [$lineIds, $split, $path] = match ($case) {
            'one' => [[$dinner], ['mode' => 'one', 'payerId' => $theirPayer], 'split.payerId'],
            'percent' => [[$dinner], ['mode' => 'percent', 'shares' => [['payerId' => $mum, 'percent' => '50'], ['payerId' => $theirPayer, 'percent' => '50']]], 'split.shares.' . $theirPayer],
            'cost' => [[$dinner, $theirCost], ['mode' => 'one', 'payerId' => $mum], 'lineIds'],
            default => [[$dinner], ['mode' => $case, 'payerId' => $mum], 'split.mode'],
        };
        $this->choose($lineIds, $split);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertNotNull($this->violation($path), Json\encode($this->last()));
        self::assertSame([null], Vec\map($this->lineRows(), static fn (array $row): mixed => $row['split']));
    }

    #[Test]
    public function everyWriteIsPublishedOnTheBudgetsTopic(): void
    {
        $hub = self::service(RecordingHub::class);
        $topic = 'events/' . $this->eventId . '/budget';
        $line = $this->addCost('Cars', '900');
        $mum = '';
        $on = static fn (): int => Iter\count(Vec\filter($hub->published, static fn (Update $update): bool => Iter\contains($update->getTopics(), $topic)));

        foreach ([
            'add a payer' => function () use (&$mum): void {
                $mum = $this->addPayer('Mum');
            },
            'change a payer' => function () use (&$mum): void {
                $this->as($this->owner, 'PUT', $this->payers($mum), ['name' => 'Mother']);
            },
            'choose who pays' => function () use (&$mum, $line): void {
                $this->choose([$line], ['mode' => 'one', 'payerId' => $mum]);
            },
            'leave it with no payer' => function () use ($line): void {
                $this->choose([$line], null);
            },
            'remove a payer' => function () use (&$mum): void {
                $this->as($this->owner, 'DELETE', $this->payers($mum));
            },
            'put a payer back' => function () use (&$mum): void {
                $this->as($this->owner, 'DELETE', $this->payers($mum) . '/removal');
            },
        ] as $write => $act) {
            $before = $on();
            $act();
            self::assertLessThan(300, $this->statusCode(), $write . ' ' . Json\encode($this->last()));
            self::assertSame($before + 1, $on(), $write);
        }
    }

    /** @return iterable<string, array{EventRole}> */
    public static function withoutTheBudget(): iterable
    {
        yield 'can edit' => [EventRole::CanEdit];
        yield 'can view' => [EventRole::CanView];
        yield 'can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('withoutTheBudget')]
    public function someoneOnTheEventWithoutTheBudgetIsRefusedEveryRoute(EventRole $on): void
    {
        $mum = $this->addPayer('Mum');
        $member = $this->member('member@bloom.events', 'Sam Reid', $on);

        foreach ([
            ['GET', $this->payers(), null],
            ['POST', $this->payers(), ['name' => 'Dad']],
            ['PUT', $this->payers($mum), ['name' => 'Mother']],
            ['DELETE', $this->payers($mum), null],
            ['DELETE', $this->payers($mum) . '/removal', null],
            ['PUT', $this->payers('splits'), ['lineIds' => [], 'split' => null]],
        ] as [$method, $path, $body]) {
            $this->as($member, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function anotherOrganisationAndAnUnknownPayerAreNotFound(): void
    {
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'GB', 'Europe/London');
        self::em()->flush();

        $this->as($stranger, 'GET', $this->payers());
        self::assertSame(404, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->payers(Uuid::v7()->toRfc4122()), ['name' => 'Mum']);
        self::assertSame(404, $this->statusCode());
    }

    /** @return array{string, string} */
    private function elsewhere(bool $anotherOrganisation): array
    {
        [$owner, $organisation, $event] = [$this->owner, $this->organisation, $this->eventId];

        if ($anotherOrganisation) {
            $this->owner = $this->account('stranger@else.where', 'Stranger');
            $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Elsewhere', 'GB', 'Europe/London');
            self::em()->flush();
        }

        $this->eventId = $this->newEvent();
        $found = [$this->addPayer('Mum'), $this->addCost('Dinner', '1000')];
        [$this->owner, $this->organisation, $this->eventId] = [$owner, $organisation, $event];

        return $found;
    }

    private function paid(?string $lineId, int $amountMinor): void
    {
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $owner = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        $vendor = new Vendor($organisation, 'Lens & Light', VendorCategory::Photography);
        $engagement = new VendorEngagement($event, $vendor);

        if (null !== $lineId) {
            (self::em()->find(BudgetLine::class, Uuid::fromString($lineId)) ?? self::fail('no line'))->agreeIn($engagement);
        }

        $payment = new ScheduledPayment($engagement, 'Deposit', $amountMinor, new DateTimeImmutable('2027-03-01'));
        $payment->markPaid($amountMinor, new DateTimeImmutable('2027-03-01'), null, new DateTimeImmutable(), $owner);
        self::em()->persist($vendor);
        self::em()->persist($engagement);
        self::em()->persist($payment);
        self::em()->flush();
    }

    /**
     * @param list<string>              $lineIds
     * @param array<string, mixed>|null $split
     *
     * @return array<string, mixed>
     */
    private function choose(array $lineIds, ?array $split, ?string $currency = null): array
    {
        return $this->as($this->owner, 'PUT', $this->payers('splits'), ['lineIds' => $lineIds, 'split' => $split, ...null === $currency ? [] : ['currency' => $currency]]);
    }

    private function addPayer(string $name): string
    {
        $body = $this->as($this->owner, 'POST', $this->payers(), ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['payer'] ?? null)['id'];
    }

    private function addCost(string $label, string $amount): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/budget/lines', ['label' => $label, 'category' => 'other', 'basis' => 'fixed', 'amount' => $amount, 'currency' => 'GBP']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['line'] ?? null)['id'];
    }

    private function addCatering(string $rate): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/budget/lines', ['label' => 'Catering', 'category' => 'catering', 'basis' => 'per_head', 'rate' => $rate, 'currency' => 'GBP']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['line'] ?? null)['id'];
    }

    private function maybe(string $name): void
    {
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Ada and Obi"]', 'id' => $this->eventId]);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/make-live');
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', ['fullName' => $name, 'companions' => []]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $guest = Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
        $link = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link');
        $token = Str\after(Type\string()->coerce($link['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token, 'answer' => 'maybe']));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return list<array{name: string, note: ?string, share: array{confirmed: string, potential: string}, paid: ?string, stillToCome: ?array{confirmed: string, potential: string}, ...}> */
    private function payerRows(): array
    {
        $range = Type\shape(['confirmed' => Type\string(), 'potential' => Type\string()]);

        return Type\vec(Type\shape([
            'name' => Type\string(),
            'note' => Type\nullable(Type\string()),
            'share' => $range,
            'paid' => Type\nullable(Type\string()),
            'stillToCome' => Type\nullable($range),
        ], true))->coerce($this->as($this->owner, 'GET', $this->payers())['payers'] ?? null);
    }

    /** @return list<array{split: mixed, flagged: bool, ...}> */
    private function lineRows(): array
    {
        return Type\vec(Type\shape(['split' => Type\mixed(), 'flagged' => Type\bool()], true))->coerce($this->as($this->owner, 'GET', $this->payers())['lines'] ?? null);
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Summer wedding',
            'type' => 'wedding',
            'startsAt' => '2027-06-12T14:00',
            'endsAt' => '2027-06-13T01:00',
            'timeZone' => 'Europe/London',
            'currency' => 'GBP',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function payers(?string $id = null): string
    {
        return '/api/events/' . $this->eventId . '/budget/payers' . (null === $id ? '' : '/' . $id);
    }

    /** @return ?array{propertyPath: string, message: string, code: string, ...} */
    private function violation(string $path): ?array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string(), 'code' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return Vec\filter($violations, static fn (array $one): bool => $one['propertyPath'] === $path)[0] ?? null;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /**
     * @param array<string, mixed>|stdClass|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, array|stdClass|null $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
