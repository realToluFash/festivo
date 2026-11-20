<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Budget\PaymentEditor;
use App\Domain\Budget\QuoteRules;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\CataloguePart;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Repository\CatalogueVersionRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class QuotesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $bloom;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@bloom.events', 'Harriet Cole');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Bloom Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->newEvent('Summer wedding', 'GBP');
        $this->bloom = $this->vendor('Bloom & Co', 'flowers', 'Ivy Bloom');
    }

    #[Test]
    public function anEventWithNoQuoteReadsEmptyInItsCurrency(): void
    {
        $read = $this->as($this->owner, 'GET', $this->quotes());

        self::assertSame(200, $this->statusCode());
        self::assertSame(['GBP', 'Europe/London', true, [], []], [$read['currency'] ?? null, $read['timeZone'] ?? null, $read['entitled'] ?? null, $read['quotes'] ?? null, $read['due'] ?? null]);
    }

    #[Test]
    public function aQuoteHoldsItsVendorWordsAmountDateAndNumberAndShowsTheDifference(): void
    {
        $quote = $this->add(['reference' => '  Q-2231 ', 'covers' => ' Bouquets and arches ']);

        self::assertSame(['Bloom & Co', 'flowers', 'Ivy Bloom', false], [$quote['vendor']['name'], $quote['vendor']['category'], $quote['vendor']['contactName'], $quote['vendor']['archived']]);
        self::assertSame(['Bouquets and arches', '1000.00', '2027-02-20', 'Q-2231'], [$quote['quote']['covers'], $quote['quote']['amount'], $quote['quote']['quotedOn'], $quote['quote']['reference']]);
        self::assertSame(['0.00', '-1000.00', [], []], [$quote['scheduled'], $quote['difference'], $quote['payments'], $quote['earlier']]);

        $this->payment($quote['id'], ['amount' => '400']);
        $read = $this->only();
        self::assertSame(['400.00', '-600.00'], [$read['scheduled'], $read['difference']]);

        $this->payment($quote['id'], ['amount' => '850', 'description' => 'Balance']);
        self::assertSame('250.00', $this->only()['difference']);
    }

    #[Test]
    public function aBlankOrMalformedQuoteIsRefusedOnEveryFieldAtOnce(): void
    {
        $this->as($this->owner, 'POST', $this->quotes(), ['vendorId' => '', 'covers' => '', 'amount' => '0', 'currency' => 'GBP', 'quotedOn' => '2027-02-30']);

        self::assertSame(422, $this->statusCode());
        self::assertSame(['vendorId', 'covers', 'amount', 'quotedOn'], Vec\map($this->violations(), static fn (array $v): string => $v['propertyPath']));
        self::assertSame('Enter the amount as a number above 0, like 12.50.', $this->violation('amount')['message'] ?? null);
    }

    #[Test]
    public function anAmountWithMoreDecimalsThanTheCurrencyOrInAnotherCurrencyIsRefused(): void
    {
        $this->as($this->owner, 'POST', $this->quotes(), $this->sent(['amount' => '10.555', 'currency' => 'EUR']));

        self::assertSame(422, $this->statusCode());
        self::assertNotNull($this->violation('amount'));
        self::assertSame(QuoteRules::CURRENCY_MISMATCH, $this->violation('currency')['code'] ?? null);
    }

    #[Test]
    public function whatItCoversAndTheQuoteNumberHaveLimits(): void
    {
        $this->as($this->owner, 'POST', $this->quotes(), $this->sent(['covers' => Str\repeat('a', 501), 'reference' => Str\repeat('b', 65)]));

        self::assertSame(422, $this->statusCode());
        self::assertSame('Shorten what the quote covers to 500 characters or fewer.', $this->violation('covers')['message'] ?? null);
        self::assertSame('Shorten the quote number to 64 characters or fewer.', $this->violation('reference')['message'] ?? null);
    }

    #[Test]
    public function theDateQuotedCannotBeAfterTodayInTheEventsTimeZone(): void
    {
        self::mockTime(new DateTimeImmutable('2027-03-01T23:30:00Z'));
        $this->as($this->owner, 'POST', $this->quotes(), $this->sent(['quotedOn' => '2027-03-02']));
        self::assertSame(422, $this->statusCode());
        self::assertSame(QuoteRules::DATE_IN_FUTURE, $this->violation('quotedOn')['code'] ?? null);

        $this->event('Europe/London', 'Pacific/Auckland');
        self::assertSame('2027-03-02', $this->add(['quotedOn' => '2027-03-02'])['quote']['quotedOn']);
    }

    #[Test]
    public function aVendorArchivedFromAnotherOrganisationOrUnknownIsRefusedWithoutItsName(): void
    {
        $stranger = $this->account('stranger@else.where', 'Stranger');
        $elsewhere = self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'GB', 'Europe/London');
        self::em()->flush();
        $theirs = $this->vendor('Secret Florist', 'flowers', null, $stranger, $elsewhere);
        $archived = $this->vendor('Old Caterer', 'catering');
        $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/vendors/' . $archived . '/archive');

        foreach ([$theirs, $archived, Uuid::v7()->toRfc4122(), 'not-an-id'] as $vendorId) {
            $this->as($this->owner, 'POST', $this->quotes(), $this->sent(['vendorId' => $vendorId]));
            self::assertSame(422, $this->statusCode(), $vendorId);
            self::assertSame(QuoteRules::VENDOR_GONE, $this->violation('vendorId')['code'] ?? null);
            self::assertStringNotContainsString('Secret', Json\encode($this->last()));
        }

        self::assertSame([], $this->read()['quotes']);
    }

    #[Test]
    public function aSecondQuoteFromTheSameVendorIsRefusedAndNothingIsSaved(): void
    {
        $this->add();
        $this->as($this->owner, 'POST', $this->quotes(), $this->sent(['amount' => '2000']));

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::VendorAlreadyQuoted->type(), $this->last()['type'] ?? null);
        self::assertSame('That vendor already has a quote on this event, so this quote was not saved. To give a new price, revise that quote.', $this->last()['detail'] ?? null);
        self::assertCount(1, $this->read()['quotes']);
    }

    #[Test]
    public function theVendorFieldOffersVendorsNotArchivedAToZWithThreeFieldsAndMarksTheOneQuoted(): void
    {
        $this->vendor('anchor Hire', 'hire', null);
        $archived = $this->vendor('Zed Caterers', 'catering');
        $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/vendors/' . $archived . '/archive');
        $this->add();

        $offered = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->quoteVendors())['vendors'] ?? null);

        self::assertSame(200, $this->statusCode());
        self::assertSame([['anchor Hire', false], ['Bloom & Co', true]], Vec\map($offered, static fn (array $one): array => [$one['name'], $one['quoted']]));
        self::assertSame(['id', 'name', 'category', 'contactName', 'archived', 'quoted'], Vec\keys($offered[1]));
    }

    #[Test]
    public function aRevisionKeepsTheCurrentQuoteAsAnEarlierOne(): void
    {
        $quote = $this->add(['reference' => 'Q-1']);
        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/revisions', ['amount' => '1200', 'currency' => 'GBP', 'quotedOn' => '2027-02-25']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $read = $this->only();
        self::assertSame(['1200.00', '2027-02-25', 'Q-1', 'Bouquets'], [$read['quote']['amount'], $read['quote']['quotedOn'], $read['quote']['reference'], $read['quote']['covers']]);
        self::assertSame([['1000.00', '2027-02-20']], Vec\map($read['earlier'], static fn (array $one): array => [$one['amount'], $one['quotedOn']]));
        self::assertNotNull($read['earlier'][0]['supersededAt']);
    }

    #[Test]
    public function aRevisionChangingNeitherTheAmountNorTheDateIsRefusedAndKeepsNoVersion(): void
    {
        $quote = $this->add();
        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/revisions', ['amount' => '1000.00', 'currency' => 'GBP', 'quotedOn' => '2027-02-20']);

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::QuoteUnchanged->type(), $this->last()['type'] ?? null);
        self::assertSame([], $this->only()['earlier']);
    }

    #[Test]
    public function aCorrectionChangesWordsNumberAndLinesInPlace(): void
    {
        $catering = $this->line('Catering');
        $flowers = $this->line('Flowers');
        $quote = $this->add(['lineIds' => [$flowers]]);
        self::assertSame(['Flowers'], Vec\map($quote['lines'], static fn (array $one): string => $one['label']));

        $this->as($this->owner, 'PUT', $this->quotes($quote['id']), ['covers' => 'Bouquets only', 'reference' => '', 'lineIds' => [$catering]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $read = $this->only();
        self::assertSame(['Bouquets only', null, '1000.00', []], [$read['quote']['covers'], $read['quote']['reference'], $read['quote']['amount'], $read['earlier']]);
        self::assertSame(['Catering'], Vec\map($read['lines'], static fn (array $one): string => $one['label']));
    }

    #[Test]
    public function aLineAgreedInAnotherVendorsQuoteCannotBeTickedUntilFreedThere(): void
    {
        $flowers = $this->line('Flowers');
        $first = $this->add(['lineIds' => [$flowers]]);
        $other = $this->vendor('Petal Room', 'flowers');

        $this->as($this->owner, 'POST', $this->quotes(), $this->sent(['vendorId' => $other, 'lineIds' => [$flowers]]));
        self::assertSame(422, $this->statusCode());
        self::assertSame(QuoteRules::LINE_AGREED, $this->violation('lineIds')['code'] ?? null);
        self::assertSame('Flowers is already agreed in the quote from Bloom & Co, so this quote was not saved. Untick it in that quote first.', $this->violation('lineIds')['message'] ?? null);

        $this->as($this->owner, 'PUT', $this->quotes($first['id']), ['covers' => 'Bouquets', 'lineIds' => []]);
        $this->add(['vendorId' => $other, 'lineIds' => [$flowers]]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aPaymentNeedsItsThreeFieldsAndCannotBeDueBeforeTheDateQuoted(): void
    {
        $quote = $this->add();
        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/payments', ['description' => '', 'amount' => '', 'currency' => 'GBP', 'dueOn' => '']);
        self::assertSame(['description', 'amount', 'dueOn'], Vec\map($this->violations(), static fn (array $v): string => $v['propertyPath']));

        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/payments', ['description' => Str\repeat('d', 101), 'amount' => '10', 'currency' => 'GBP', 'dueOn' => '2027-02-19']);
        self::assertSame('Shorten what the payment is for to 100 characters or fewer.', $this->violation('description')['message'] ?? null);
        self::assertSame(QuoteRules::BEFORE_QUOTE, $this->violation('dueOn')['code'] ?? null);
        self::assertStringStartsWith('The date due cannot be before the quote from Bloom & Co on ', $this->violation('dueOn')['message'] ?? '');
    }

    #[Test]
    public function aPaymentIsAmendedAndRemovedAndEverythingDueRunsSoonestFirstThenByVendor(): void
    {
        $bloom = $this->add();
        $anchor = $this->add(['vendorId' => $this->vendor('Anchor Hire', 'hire')]);
        $deposit = $this->payment($bloom['id'], ['description' => 'Deposit', 'dueOn' => '2027-02-25']);
        $this->payment($anchor['id'], ['description' => 'Tables', 'dueOn' => '2027-04-01']);
        $this->payment($bloom['id'], ['description' => 'Balance', 'dueOn' => '2027-04-01']);

        $due = $this->read()['due'];
        self::assertSame([['Deposit', 'Bloom & Co', true], ['Tables', 'Anchor Hire', false], ['Balance', 'Bloom & Co', false]], Vec\map($due, static fn (array $one): array => [$one['description'], $one['vendor'], $one['overdue']]));

        $this->as($this->owner, 'PUT', $this->payments($deposit), ['description' => 'Deposit', 'amount' => '250', 'currency' => 'GBP', 'dueOn' => '2027-03-01']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['250.00', '2027-03-01', false], [$this->read()['due'][0]['amount'], $this->read()['due'][0]['dueOn'], $this->read()['due'][0]['overdue']]);

        $this->as($this->owner, 'DELETE', $this->payments($deposit));
        self::assertSame(204, $this->statusCode());
        self::assertCount(2, $this->read()['due']);
    }

    #[Test]
    public function aQuoteHoldsTheEventsCurrencyEvenOnceRevised(): void
    {
        $this->add();

        self::assertSame(409, $this->changeCurrency('EUR'));
        self::assertSame(ErrorCode::EventCurrencyInUse->type(), $this->last()['type'] ?? null);
        self::assertSame('GBP', $this->read()['currency']);
    }

    #[Test]
    public function eachChangeIsPublishedToTheEventsQuotesTopicWithNoMoreOfTheVendorThanTheForm(): void
    {
        self::em()->getConnection()->executeStatement("UPDATE vendors SET email_address = 'ivy@bloom.test', note = 'Pays late' WHERE id = :id", ['id' => $this->bloom]);
        $topic = 'events/' . $this->eventId . '/budget/quotes';
        $quote = $this->add();

        $update = self::service(RecordingHub::class)->lastOn($topic) ?? self::fail('nothing published');
        self::assertTrue($update->isPrivate());
        self::assertStringContainsString('Bloom & Co', $update->getData());
        self::assertStringNotContainsString('ivy@bloom.test', $update->getData());
        self::assertStringNotContainsString('Pays late', $update->getData());

        $this->payment($quote['id']);
        self::assertStringContainsString('Deposit', self::service(RecordingHub::class)->lastOn($topic)?->getData() ?? '');

        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/budget/subscriptions');
        $payload = Str\split(Type\string()->coerce($body['token'] ?? null), '.')[1] ?? self::fail('not a token');
        self::assertStringContainsString($topic, (string) \base64_decode(Str\replace_every($payload, ['-' => '+', '_' => '/']), true));
    }

    #[Test]
    public function theEventsLeadChoosesAndReadsTheVendorWithoutItsContactDetails(): void
    {
        self::em()->getConnection()->executeStatement("UPDATE vendors SET email_address = 'ivy@bloom.test', phone_number = '+447700900123' WHERE id = :id", ['id' => $this->bloom]);
        $lead = $this->member('lead@bloom.events', 'Priya Shah', SeededRole::Member, EventRole::Lead);

        $offered = $this->as($lead, 'GET', $this->quoteVendors());
        self::assertSame(200, $this->statusCode());
        $quote = $this->as($lead, 'POST', $this->quotes(), $this->sent());
        self::assertSame(201, $this->statusCode(), Json\encode($quote));
        $read = $this->as($lead, 'GET', $this->quotes());

        foreach ([$offered, $quote, $read] as $answer) {
            self::assertStringNotContainsString('ivy@bloom.test', Json\encode($answer));
            self::assertStringNotContainsString('7700900123', Json\encode($answer));
        }

        $this->as($lead, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/vendors');
        self::assertSame(403, $this->statusCode());
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
        $quote = $this->add();
        $payment = $this->payment($quote['id']);
        $member = $this->member('member@bloom.events', 'Sam Reid', SeededRole::Member, $on);

        foreach ($this->routes($quote['id'], $payment) as [$method, $path, $body]) {
            $this->as($member, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function aMemberNotOnTheEventAnotherOrganisationAndAMissingEventAreAllNotFound(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);
        $kemi = $this->member('kemi@bloom.events', 'Kemi Ade', SeededRole::Member, null);
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'GB', 'Europe/London');
        self::em()->flush();

        foreach ([$kemi, $stranger] as $who) {
            foreach ($this->routes($quote['id'], $payment) as [$method, $path, $body]) {
                $this->as($who, $method, $path, $body);
                self::assertSame(404, $this->statusCode(), $method . ' ' . $path);
            }
        }

        $this->as($this->owner, 'GET', '/api/events/' . Uuid::v7()->toRfc4122() . '/budget/quotes');
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aQuoteOrPaymentOnAnotherEventIsNotFoundThroughThisOne(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);
        $this->eventId = $this->newEvent('Autumn gala', 'GBP');

        $this->as($this->owner, 'PUT', $this->quotes($quote['id']), ['covers' => 'x']);
        self::assertSame(404, $this->statusCode());
        $this->as($this->owner, 'DELETE', $this->payments($payment));
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function withoutVendorsOnThePlanQuotesStayReadableAndNothingChanges(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);
        $this->dropVendorsFromThePlan();

        $read = $this->read();
        self::assertSame([false, 1], [$read['entitled'], Iter\count($read['quotes'])]);

        foreach (Vec\filter($this->routes($quote['id'], $payment), static fn (array $route): bool => 'GET' !== $route[0] && !Str\ends_with($route[1], '/subscriptions')) as [$method, $path, $body]) {
            $this->as($this->owner, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PlanRequired->type(), $this->last()['type'] ?? null);
        }

        self::assertSame('Deposit', $this->read()['due'][0]['description']);
    }

    #[Test]
    public function theDirectoryCountsTheEventsThatEngageEachVendor(): void
    {
        $this->add();
        $this->eventId = $this->newEvent('Autumn gala', 'GBP');
        $this->add();
        $this->vendor('Anchor Hire', 'hire');

        $rows = Type\vec(Type\shape(['name' => Type\string(), 'events' => Type\int()], true))->coerce($this->as($this->owner, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/vendors')['vendors'] ?? null);

        self::assertSame(['Anchor Hire' => 0, 'Bloom & Co' => 2], \array_column($rows, 'events', 'name'));
    }

    #[Test]
    public function aVendorStillOwedIsNotArchivedAndTheRefusalNamesEachEvent(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);
        $archive = '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/vendors/' . $this->bloom . '/archive';

        $this->as($this->owner, 'POST', $archive);
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::VendorOwed->type(), $this->last()['type'] ?? null);
        self::assertSame('Bloom & Co was not archived, because one or more events still have payments to it that are not paid or cancelled.', $this->last()['detail'] ?? null);
        self::assertSame([['id' => $this->eventId, 'name' => 'Summer wedding']], $this->last()['events'] ?? null);

        $this->as($this->owner, 'DELETE', $this->payments($payment));
        $this->as($this->owner, 'POST', $archive);
        self::assertSame(200, $this->statusCode());

        $read = $this->only();
        self::assertSame(['Bloom & Co', true], [$read['vendor']['name'], $read['vendor']['archived']]);
    }

    #[Test]
    public function markingPaidRecordsTheAmountTheDayTheReferenceAndWhoAndLeavesNothingDue(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid(['amount' => '450.5', 'paidOn' => '2027-02-28', 'reference' => '  FP-2231  ']));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $row = $this->row($payment);
        $paid = Type\shape(['amount' => Type\string(), 'paidOn' => Type\string(), 'reference' => Type\nullable(Type\string()), 'at' => Type\string(), 'by' => Type\mixed(), 'difference' => Type\string()])->coerce($row['paid'] ?? null);
        self::assertSame(['450.50', '2027-02-28', 'FP-2231', '50.50'], [$paid['amount'], $paid['paidOn'], $paid['reference'], $paid['difference']]);
        self::assertSame(['id' => $this->owner->getId()->toRfc4122(), 'name' => 'Harriet Cole'], $paid['by']);
        self::assertSame(['400.00', '450.50', '0.00'], [$this->only()['scheduled'], $this->only()['paid'], $this->only()['outstanding']]);
        self::assertSame([], $this->read()['due']);
        self::assertSame(['paid' => '450.50', 'owed' => '0.00', 'overdue' => '0.00', 'overdueCount' => 0], $this->as($this->owner, 'GET', $this->quotes())['totals'] ?? null);
    }

    #[Test]
    public function aBlankZeroOverPreciseFutureOrOverlongMarkIsRefusedOnEveryField(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid(['amount' => '0', 'paidOn' => '2027-03-02', 'reference' => Str\repeat('r', 101)]));
        self::assertSame(422, $this->statusCode());
        self::assertSame(['amount', 'paidOn', 'reference'], Vec\map($this->violations(), static fn (array $v): string => $v['propertyPath']));
        self::assertSame(QuoteRules::PAID_IN_FUTURE, $this->violation('paidOn')['code'] ?? null);
        self::assertSame('Shorten the reference to 100 characters or fewer.', $this->violation('reference')['message'] ?? null);

        foreach (['', '-5', 'abc', '10.555'] as $amount) {
            $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid(['amount' => $amount]));
            self::assertSame(422, $this->statusCode(), $amount);
        }

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid(['currency' => 'EUR']));
        self::assertSame(QuoteRules::CURRENCY_MISMATCH, $this->violation('currency')['code'] ?? null);

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid(['reference' => '    ']));
        self::assertSame(200, $this->statusCode());
        self::assertNull(Type\dict(Type\string(), Type\mixed())->coerce($this->row($payment)['paid'])['reference']);
    }

    #[Test]
    public function aPaymentAlreadyPaidIsRefusedNamingWhoPaidItAndStaysAsTheyMarkedIt(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);
        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid());
        $sam = $this->member('sam@bloom.events', 'Sam Reid', SeededRole::Admin, null);

        $this->as($sam, 'POST', $this->payments($payment) . '/paid', $this->paid(['amount' => '999']));
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::PaymentAlreadyPaid->type(), $this->last()['type'] ?? null);
        self::assertSame('Harriet Cole has already marked this paid, so nothing has changed.', $this->last()['detail'] ?? null);

        foreach ([['PUT', ['description' => 'x', 'amount' => '5', 'currency' => 'GBP', 'dueOn' => '2027-03-01']], ['DELETE', null]] as [$method, $body]) {
            $this->as($this->owner, $method, $this->payments($payment), $body);
            self::assertSame(409, $this->statusCode(), $method);
        }

        self::assertSame('400.00', Type\dict(Type\string(), Type\mixed())->coerce($this->row($payment)['paid'])['amount']);
    }

    #[Test]
    public function undoUnmarksAScheduledPaymentAndItIsOwedAgain(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id'], ['dueOn' => '2027-02-25']);
        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid());

        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/paid');
        self::assertSame(200, $this->statusCode());
        self::assertNull($this->row($payment)['paid']);
        self::assertSame([true, '0.00', '400.00'], [$this->read()['due'][0]['overdue'], $this->only()['paid'], $this->only()['outstanding']]);

        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/paid');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function onlyAnUnpaidPaymentIsCancelledKeptWithItsReasonAndRestoredOverdue(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id'], ['dueOn' => '2027-02-25']);

        $this->as($this->owner, 'POST', $this->payments($payment) . '/cancellation', ['reason' => Str\repeat('w', 201)]);
        self::assertSame('Shorten the reason to 200 characters or fewer.', $this->violation('reason')['message'] ?? null);

        $this->as($this->owner, 'POST', $this->payments($payment) . '/cancellation', ['reason' => '  Venue includes it  ']);
        self::assertSame(200, $this->statusCode());
        $this->as($this->member('sam@bloom.events', 'Sam Reid', SeededRole::Admin, null), 'POST', $this->payments($payment) . '/cancellation', ['reason' => 'Already sorted']);
        self::assertSame(200, $this->statusCode(), 'a second cancel is already done');
        $cancelled = Type\dict(Type\string(), Type\mixed())->coerce($this->row($payment)['cancelled']);
        self::assertSame(['Venue includes it', ['id' => $this->owner->getId()->toRfc4122(), 'name' => 'Harriet Cole']], [$cancelled['reason'], $cancelled['by']]);
        self::assertSame(['0.00', '400.00', '0.00', []], [$this->only()['scheduled'], $this->only()['cancelled'], $this->only()['outstanding'], $this->read()['due']]);

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid());
        self::assertSame(ErrorCode::PaymentCancelled->type(), $this->last()['type'] ?? null);
        self::assertSame('This payment has been cancelled, so it cannot be marked paid.', $this->last()['detail'] ?? null);

        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/cancellation');
        self::assertSame(200, $this->statusCode());
        self::assertSame([null, '2027-02-25', true], [$this->row($payment)['cancelled'], $this->read()['due'][0]['dueOn'], $this->read()['due'][0]['overdue']]);

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid());
        $this->as($this->owner, 'POST', $this->payments($payment) . '/cancellation', ['reason' => '']);
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::PaymentAlreadyPaid->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aPaymentAlreadyMadeIsAddedPaidAndUndoDeletesIt(): void
    {
        $quote = $this->add();
        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/paid-payments', $this->made(['reference' => 'CHQ 104']));
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $payment = Type\string()->coerce($this->last()['paymentId'] ?? null);

        $row = $this->row($payment);
        self::assertSame(['Extra stems for the arch', true, '2027-02-25'], [$row['description'], $row['addedAsPaid'], $row['dueOn']]);
        self::assertSame(['180.00', '180.00', '0.00', []], [$this->only()['scheduled'], $this->only()['paid'], $this->only()['outstanding'], $this->read()['due']]);

        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/paid');
        self::assertSame(200, $this->statusCode());
        self::assertSame([[], '0.00', '0.00'], [$this->only()['payments'], $this->only()['paid'], $this->only()['scheduled']]);
    }

    #[Test]
    public function aPaymentAlreadyMadeCountsInScheduledSoAFullyScheduledQuoteReadsOverByIt(): void
    {
        $quote = $this->add();
        $this->payment($quote['id'], ['description' => 'Full balance', 'amount' => '1000']);
        $cancelled = $this->payment($quote['id'], ['description' => 'Delivery', 'amount' => '60']);
        $this->as($this->owner, 'POST', $this->payments($cancelled) . '/cancellation', ['reason' => '']);

        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/paid-payments', $this->made());
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(['1180.00', '180.00', '180.00', '1000.00'], [$this->only()['scheduled'], $this->only()['difference'], $this->only()['paid'], $this->only()['outstanding']]);
        self::assertSame(['paid' => '180.00', 'owed' => '1000.00', 'overdue' => '0.00', 'overdueCount' => 0], $this->as($this->owner, 'GET', $this->quotes())['totals'] ?? null);
    }

    #[Test]
    public function everyPaymentActionIsAuditedWithItsActorAndWhatItChanged(): void
    {
        $quote = $this->add();
        $payment = $this->payment($quote['id']);
        $owner = ['id' => $this->owner->getId()->toRfc4122(), 'name' => 'Harriet Cole'];

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', $this->paid(['amount' => '450.5', 'paidOn' => '2027-02-28', 'reference' => 'FP-2231']));
        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/paid');
        $this->as($this->owner, 'POST', $this->payments($payment) . '/cancellation', ['reason' => 'Venue includes it']);
        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/cancellation');
        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/paid-payments', $this->made(['reference' => 'CHQ 104']));
        $added = Type\string()->coerce($this->last()['paymentId'] ?? null);
        $this->as($this->owner, 'DELETE', $this->payments($added) . '/paid');

        $paid = ['paidAmount' => [null, '450.50'], 'paidOn' => [null, '2027-02-28'], 'reference' => [null, 'FP-2231'], 'paidBy' => [null, 'Harriet Cole']];
        $made = ['vendor' => 'Bloom & Co', 'description' => 'Extra stems for the arch', 'amount' => '180.00', 'dueOn' => '2027-02-25', 'paidAmount' => '180.00', 'paidOn' => '2027-02-25', 'reference' => 'CHQ 104', 'paidBy' => 'Harriet Cole'];
        $expected = [
            [PaymentEditor::MARKED_PAID, $payment, $paid],
            [PaymentEditor::UNMARKED, $payment, Dict\map($paid, static fn (array $change): array => [$change[1], $change[0]])],
            [PaymentEditor::CANCELLED, $payment, ['cancelReason' => [null, 'Venue includes it'], 'cancelledBy' => [null, 'Harriet Cole']]],
            [PaymentEditor::RESTORED, $payment, ['cancelReason' => ['Venue includes it', null], 'cancelledBy' => ['Harriet Cole', null]]],
            [PaymentEditor::ADDED_AS_PAID, $added, Dict\map($made, static fn (string $value): array => [null, $value])],
            [PaymentEditor::DELETED, $added, Dict\map($made, static fn (string $value): array => [$value, null])],
        ];

        foreach ($expected as [$action, $subject, $changes]) {
            $entry = Type\instance_of(AuditEntry::class)->coerce(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => Uuid::fromString($subject)]));
            self::assertSame([$owner['id'], $owner['name']], [$entry->getActorId()?->toRfc4122(), $entry->getActorLabel()], $action);
            self::assertSame($changes, $entry->getChanges(), $action);
        }
    }

    #[Test]
    public function aPaymentAlreadyMadeNeedsItsFieldsAndCannotPrecedeTheFirstQuote(): void
    {
        $quote = $this->add();
        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/revisions', ['amount' => '1200', 'currency' => 'GBP', 'quotedOn' => '2027-02-27']);

        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/paid-payments', $this->made(['description' => '   ', 'amount' => '']));
        self::assertSame(['description', 'amount'], Vec\map($this->violations(), static fn (array $v): string => $v['propertyPath']));
        self::assertSame('Enter what it was for.', $this->violation('description')['message'] ?? null);

        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/paid-payments', $this->made(['description' => Str\repeat('d', 101)]));
        self::assertSame('Shorten the description to 100 characters or fewer.', $this->violation('description')['message'] ?? null);

        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/paid-payments', $this->made(['paidOn' => '2027-02-19']));
        self::assertSame(QuoteRules::BEFORE_QUOTE, $this->violation('paidOn')['code'] ?? null);
        self::assertSame('The date paid cannot be before the quote from Bloom & Co on Sat 20 Feb. Choose that date or a later one.', $this->violation('paidOn')['message'] ?? null);

        $this->as($this->owner, 'POST', $this->quotes($quote['id']) . '/paid-payments', $this->made(['paidOn' => '2027-02-20']));
        self::assertSame(201, $this->statusCode(), 'the first quote, not the revision, is the floor');
    }

    #[Test]
    public function aVendorWhosePaymentsArePaidOrCancelledCanBeArchived(): void
    {
        $quote = $this->add();
        $paid = $this->payment($quote['id']);
        $cancelled = $this->payment($quote['id'], ['description' => 'Balance']);
        $this->as($this->owner, 'POST', $this->payments($paid) . '/paid', $this->paid());
        $this->as($this->owner, 'POST', $this->payments($cancelled) . '/cancellation', ['reason' => '']);

        $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/vendors/' . $this->bloom . '/archive');
        self::assertSame(200, $this->statusCode());
    }

    /** @return list<array{string, string, ?array<string, mixed>}> */
    private function routes(string $quoteId, string $paymentId): array
    {
        return [
            ['GET', $this->quotes(), null],
            ['GET', $this->quoteVendors(), null],
            ['POST', $this->quotes(), $this->sent(['vendorId' => $this->vendor('Petal ' . Uuid::v7()->toBase58(), 'flowers')])],
            ['POST', $this->quotes($quoteId) . '/revisions', ['amount' => '5', 'currency' => 'GBP', 'quotedOn' => '2027-02-21']],
            ['PUT', $this->quotes($quoteId), ['covers' => 'x']],
            ['POST', $this->quotes($quoteId) . '/payments', ['description' => 'x', 'amount' => '5', 'currency' => 'GBP', 'dueOn' => '2027-03-01']],
            ['PUT', $this->payments($paymentId), ['description' => 'x', 'amount' => '5', 'currency' => 'GBP', 'dueOn' => '2027-03-01']],
            ['DELETE', $this->payments($paymentId), null],
            ['POST', $this->payments($paymentId) . '/paid', $this->paid()],
            ['DELETE', $this->payments($paymentId) . '/paid', null],
            ['POST', $this->payments($paymentId) . '/cancellation', ['reason' => 'x']],
            ['DELETE', $this->payments($paymentId) . '/cancellation', null],
            ['POST', $this->quotes($quoteId) . '/paid-payments', $this->made()],
        ];
    }

    private function dropVendorsFromThePlan(): void
    {
        $first = self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::Plans, '2026-10-19') ?? self::fail('no catalogue');
        $terms = Type\dict(Type\string(), Type\dict(Type\string(), Type\mixed()))->coerce($first->getTerms());
        $terms['free']['features'] = Vec\values(Vec\filter(Type\vec(Type\string())->coerce($terms['free']['features']), static fn (string $feature): bool => 'vendors' !== $feature));
        $keeper = self::service(CatalogueKeeper::class);
        $version = $keeper->publish(CataloguePart::Plans, '2027-03-01', $terms, 'Vendors off Free, for a test', 'Ada at Soirely');
        $keeper->moveSubscribers($version, null, 'A downgrade, for a test', 'Ada at Soirely');
        self::em()->clear();
    }

    /**
     * @param array<string, mixed> $over
     *
     * @return array<string, mixed>
     */
    private function sent(array $over = []): array
    {
        return [
            'vendorId' => $this->bloom,
            'covers' => 'Bouquets',
            'amount' => '1000',
            'currency' => 'GBP',
            'quotedOn' => '2027-02-20',
            ...$over,
        ];
    }

    /** @param array<string, mixed> $over */
    private function add(array $over = []): array
    {
        $answer = $this->as($this->owner, 'POST', $this->quotes(), $this->sent($over));
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return self::engaged($answer['quote'] ?? null);
    }

    /** @param array<string, mixed> $over */
    private function payment(string $quoteId, array $over = []): string
    {
        $answer = $this->as($this->owner, 'POST', $this->quotes($quoteId) . '/payments', ['description' => 'Deposit', 'amount' => '400', 'currency' => 'GBP', 'dueOn' => '2027-03-10', ...$over]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $payments = self::engaged($answer['quote'] ?? null)['payments'];

        return Type\string()->coerce(Vec\filter($payments, static fn (array $one): bool => ($over['description'] ?? 'Deposit') === $one['description'] && ($over['dueOn'] ?? '2027-03-10') === $one['dueOn'])[0]['id'] ?? null);
    }

    /**
     * @param array<string, mixed> $over
     *
     * @return array<string, mixed>
     */
    private function paid(array $over = []): array
    {
        return ['amount' => '400', 'currency' => 'GBP', 'paidOn' => '2027-03-01', ...$over];
    }

    /**
     * @param array<string, mixed> $over
     *
     * @return array<string, mixed>
     */
    private function made(array $over = []): array
    {
        return ['description' => 'Extra stems for the arch', 'amount' => '180', 'currency' => 'GBP', 'paidOn' => '2027-02-25', ...$over];
    }

    /** @return array<string, mixed> */
    private function row(string $paymentId): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Vec\filter($this->only()['payments'], static fn (array $one): bool => $paymentId === $one['id'])[0] ?? []);
    }

    /** @return array<string, mixed> */
    private function only(): array
    {
        return self::engaged($this->read()['quotes'][0] ?? null);
    }

    /** @return array{currency: string, entitled: bool, quotes: list<mixed>, due: list<array<string, mixed>>, ...} */
    private function read(): array
    {
        $read = $this->as($this->owner, 'GET', $this->quotes());
        self::assertSame(200, $this->statusCode(), Json\encode($read));

        return Type\shape([
            'currency' => Type\string(),
            'entitled' => Type\bool(),
            'quotes' => Type\vec(Type\mixed()),
            'due' => Type\vec(Type\dict(Type\string(), Type\mixed())),
        ], true)->coerce($read);
    }

    /** @return array{id: string, vendor: array<string, mixed>, quote: array<string, mixed>, earlier: list<array<string, mixed>>, lines: list<array<string, mixed>>, payments: list<array<string, mixed>>, scheduled: string, difference: string, paid: string, outstanding: string, cancelled: string} */
    private static function engaged(mixed $raw): array
    {
        $row = Type\dict(Type\string(), Type\mixed());
        $rows = Type\vec($row);

        return Type\shape([
            'id' => Type\string(),
            'vendor' => $row,
            'quote' => $row,
            'earlier' => $rows,
            'lines' => $rows,
            'payments' => $rows,
            'scheduled' => Type\string(),
            'difference' => Type\string(),
            'paid' => Type\string(),
            'outstanding' => Type\string(),
            'cancelled' => Type\string(),
        ])->coerce($raw);
    }

    private function vendor(string $name, string $category, ?string $contact = null, ?User $by = null, ?Organisation $in = null): string
    {
        $answer = $this->as($by ?? $this->owner, 'POST', '/api/orgs/' . ($in ?? $this->organisation)->getId()->toRfc4122() . '/vendors', ['name' => $name, 'category' => $category, 'contactName' => $contact]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\shape(['id' => Type\string()], true)->coerce($answer['vendor'] ?? null)['id'];
    }

    private function line(string $label): string
    {
        $answer = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/budget/lines', ['label' => $label, 'category' => 'other', 'basis' => 'fixed', 'amount' => '100', 'currency' => 'GBP']);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\shape(['id' => Type\string()], true)->coerce($answer['line'] ?? null)['id'];
    }

    private function event(string $from, string $to): void
    {
        self::em()->getConnection()->executeStatement('UPDATE events SET time_zone = :to WHERE id = :id AND time_zone = :from', ['to' => $to, 'from' => $from, 'id' => $this->eventId]);
        self::em()->clear();
    }

    private function newEvent(string $name, string $currency): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => $name,
            'type' => 'wedding',
            'startsAt' => '2027-06-12T14:00',
            'endsAt' => '2027-06-13T01:00',
            'timeZone' => 'Europe/London',
            'currency' => $currency,
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function changeCurrency(string $currency): int
    {
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->as($this->owner, 'PATCH', '/api/events/' . $this->eventId, ['currency' => $currency], $tag);

        return $this->statusCode();
    }

    private function quotes(?string $id = null): string
    {
        return '/api/events/' . $this->eventId . '/budget/quotes' . (null === $id ? '' : '/' . $id);
    }

    private function quoteVendors(): string
    {
        return '/api/events/' . $this->eventId . '/budget/quote-vendors';
    }

    private function payments(string $id): string
    {
        return '/api/events/' . $this->eventId . '/budget/payments/' . $id;
    }

    /** @return list<array{propertyPath: string, message: string, code: string, ...}> */
    private function violations(): array
    {
        return Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string(), 'code' => Type\string()], true))->coerce($this->last()['violations'] ?? []);
    }

    /** @return ?array{propertyPath: string, message: string, code: string, ...} */
    private function violation(string $path): ?array
    {
        return Vec\filter($this->violations(), static fn (array $v): bool => $v['propertyPath'] === $path)[0] ?? null;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded, ?EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            ...null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch],
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
