<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Budget\LineRules;
use App\Domain\Budget\QuantityResolver;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\DriverException;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use stdClass;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** @phpstan-type Line array{id: string, label: string, category: string, basis: string, rate: ?string, amount: ?string, currency: string, note: ?string, quantity: array{count: int, source: string, reason: ?string}, ...} */
final class BudgetLinesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const array CATERING = ['label' => 'Catering', 'category' => 'catering', 'basis' => 'per_head', 'rate' => '48', 'currency' => 'GBP'];

    private const array STAFF = ['label' => 'Staff', 'category' => 'staffing', 'basis' => 'per_staff_hour'];

    private const array VENUE = ['label' => 'Venue hire', 'category' => 'venue', 'basis' => 'fixed', 'currency' => 'GBP'];

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
        $this->eventId = $this->newEvent('GBP');
    }

    #[Test]
    public function anEventWithNoLineHasAnEmptyBudgetInItsCurrency(): void
    {
        self::assertSame(['currency' => 'GBP', 'lines' => []], $this->as($this->owner, 'GET', $this->lines()));
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aLineOnAHeadCountsTheAcceptedAndSaysWhereItCameFrom(): void
    {
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Ada and Obi"]', 'id' => $this->eventId]);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->answer($this->guest('Adaeze', ['Obi']), 'coming');
        $this->answer($this->guest('Bisi'), 'maybe');

        $line = $this->add([...self::CATERING, 'label' => '  Catering ', 'note' => 'Three courses']);

        self::assertSame(['Catering', 'catering', 'per_head', '48.00', null, 'GBP', 'Three courses'], [$line['label'], $line['category'], $line['basis'], $line['rate'], $line['amount'], $line['currency'], $line['note']]);
        self::assertSame(['count' => 2, 'source' => 'accepted', 'reason' => null], $line['quantity']);
        self::assertSame([$line['id']], Vec\map($this->budget(), static fn (array $one): string => $one['id']));
    }

    #[Test]
    public function aLineOnAHeadIsZeroWithOneReasonForAnEmptyListAndAnotherForNoAcceptedYet(): void
    {
        $line = $this->add(self::CATERING);
        self::assertSame(['count' => 0, 'source' => 'accepted', 'reason' => QuantityResolver::NO_GUESTS], $line['quantity']);

        $this->guest('Bisi');

        self::assertSame(['count' => 0, 'source' => 'accepted', 'reason' => QuantityResolver::NONE_ACCEPTED], $this->budget()[0]['quantity']);
    }

    #[Test]
    public function aLineOnAHeadLeavesOutAGuestWhoWasRemoved(): void
    {
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Ada and Obi"]', 'id' => $this->eventId]);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $guest = $this->guest('Adaeze');
        $this->answer($guest, 'coming');
        $this->add(self::CATERING);

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/guests/' . $guest);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(['count' => 0, 'source' => 'accepted', 'reason' => QuantityResolver::NO_GUESTS], $this->budget()[0]['quantity']);
    }

    #[Test]
    public function aFixedLineCarriesAnAmountAndCountsOnce(): void
    {
        $line = $this->add([...self::VENUE, 'amount' => '2400.5', 'currency' => 'gbp']);

        self::assertSame([null, '2400.50'], [$line['rate'], $line['amount']]);
        self::assertSame(['count' => 1, 'source' => 'fixed', 'reason' => null], $line['quantity']);
    }

    #[Test]
    public function aStaffTimeLineCarriesNoPriceAndIsZeroWithAReasonUntilStaffingHasHours(): void
    {
        $line = $this->add(self::STAFF);

        self::assertSame([null, null], [$line['rate'], $line['amount']]);
        self::assertSame(['count' => 0, 'source' => 'staff_hours', 'reason' => QuantityResolver::NO_STAFF_HOURS], $line['quantity']);
    }

    #[Test]
    public function aLineOnATableCountsTheSeatingPlansTablesAndIsSavedBeforeThereIsOne(): void
    {
        $line = $this->add(['label' => 'Centrepieces', 'category' => 'flowers', 'basis' => 'per_table', 'rate' => '0', 'currency' => 'GBP']);
        self::assertSame(['count' => 0, 'source' => 'seating_tables', 'reason' => QuantityResolver::NO_SEATING_PLAN], $line['quantity']);
        self::assertSame('0.00', $line['rate']);

        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/seating-plan', ['widthCm' => 2000, 'lengthCm' => 1500]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(QuantityResolver::NO_TABLES, $this->budget()[0]['quantity']['reason']);

        foreach (['round', 'rectangular'] as $shape) {
            $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/seating-plan/tables', ['shape' => $shape]);
            self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        }

        self::assertSame(['count' => 2, 'source' => 'seating_tables', 'reason' => null], $this->budget()[0]['quantity']);
    }

    #[Test]
    public function aLineOnADayCountsTheDatesTheEventSpans(): void
    {
        $line = $this->add(['label' => 'Generator hire', 'category' => 'hire', 'basis' => 'per_day', 'rate' => '180', 'currency' => 'GBP']);

        self::assertSame(['count' => 2, 'source' => 'event_days', 'reason' => null], $line['quantity']);
    }

    #[Test]
    public function changingALineReplacesItWhole(): void
    {
        $line = $this->add([...self::CATERING, 'note' => 'Three courses']);

        $changed = $this->line($this->as($this->owner, 'PUT', $this->lines($line['id']), [...self::VENUE, 'label' => 'Florist', 'category' => 'flowers', 'amount' => '650']));

        self::assertSame(200, $this->statusCode());
        self::assertSame(['Florist', 'flowers', 'fixed', null, '650.00', null], [$changed['label'], $changed['category'], $changed['basis'], $changed['rate'], $changed['amount'], $changed['note']]);
        self::assertSame($changed, $this->line($this->as($this->owner, 'GET', $this->lines($line['id']))));
    }

    #[Test]
    public function removingALineTakesItOffTheBudget(): void
    {
        $line = $this->add(self::CATERING);

        $this->as($this->owner, 'DELETE', $this->lines($line['id']));

        self::assertSame(204, $this->statusCode());
        self::assertSame([], $this->budget());
    }

    /** @return iterable<string, array{array<string, mixed>, string, string, array<string, string>}> */
    public static function refused(): iterable
    {
        $catering = self::CATERING;
        $venue = self::VENUE;

        yield 'no label' => [[...$catering, 'label' => '  '], 'label', 'validation.budget_label_required', []];
        yield 'a label over 100' => [[...$catering, 'label' => Str\repeat('a', 101)], 'label', 'validation.budget_label_too_long', ['{max}' => '100']];
        yield 'no category' => [[...$catering, 'category' => null], 'category', 'validation.budget_category_required', []];
        yield 'a category outside the nine' => [[...$catering, 'category' => 'cake'], 'category', 'validation.budget_category_unknown', []];
        yield 'no basis' => [['label' => 'Catering', 'category' => 'catering'], 'basis', 'validation.budget_basis_required', []];
        yield 'a basis outside the five' => [[...$catering, 'basis' => 'per_guest'], 'basis', 'validation.budget_basis_unknown', []];
        yield 'no rate' => [[...$catering, 'rate' => ''], 'rate', 'validation.budget_rate_required', []];
        yield 'no amount on a fixed line' => [$venue, 'amount', 'validation.budget_amount_required', []];
        yield 'a negative rate' => [[...$catering, 'rate' => '-1'], 'rate', 'validation.budget_rate_negative', []];
        yield 'a negative amount' => [[...$venue, 'amount' => '-0.50'], 'amount', 'validation.budget_amount_negative', []];
        yield 'a rate on a fixed line' => [[...$venue, 'amount' => '10', 'rate' => '10'], 'rate', 'validation.budget_rate_on_fixed', []];
        yield 'an amount on a line that is not fixed' => [[...$catering, 'amount' => '10'], 'amount', 'validation.budget_amount_not_fixed', []];
        yield 'a rate on a staff-time line' => [[...self::STAFF, 'rate' => '14', 'currency' => 'GBP'], 'rate', 'validation.budget_staff_line_unpriced', []];
        yield 'an amount on a staff-time line' => [[...self::STAFF, 'amount' => '0', 'currency' => 'GBP'], 'amount', 'validation.budget_staff_line_unpriced', []];
        yield 'three decimals in pounds' => [[...$catering, 'rate' => '48.505'], 'rate', 'validation.budget_rate_too_many_decimals', ['{example}' => '12.50']];
        yield 'three decimals on a fixed amount' => [[...$venue, 'amount' => '1.001'], 'amount', 'validation.budget_amount_too_many_decimals', ['{example}' => '12.50']];
        yield 'a rate that is not a number' => [[...$catering, 'rate' => '£48'], 'rate', 'validation.budget_rate_invalid', ['{example}' => '12.50']];
        yield 'a rate in another currency' => [[...$catering, 'currency' => 'EUR'], 'currency', 'validation.budget_currency_mismatch', ['{currency}' => 'GBP']];
        yield 'a rate with no currency' => [[...$catering, 'currency' => null], 'currency', 'validation.budget_currency_required', ['{currency}' => 'GBP']];
        yield 'a note over 500' => [[...$catering, 'note' => Str\repeat('n', 501)], 'note', 'validation.budget_note_too_long', ['{max}' => '500']];
    }

    /**
     * @param array<string, mixed>  $body
     * @param array<string, string> $parameters
     */
    #[Test]
    #[DataProvider('refused')]
    public function anUnmatchedOrWrongValueIsRefusedOnItsFieldAndNothingIsStored(array $body, string $field, string $key, array $parameters): void
    {
        $this->as($this->owner, 'POST', $this->lines(), $body);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(self::service(TranslatorInterface::class)->trans($key, $parameters, null, 'en'), $this->violation($field)['message'] ?? null);
        self::assertSame([], $this->budget());
    }

    #[Test]
    public function aNegativeRateAndAnUnknownBasisAreDistinctErrorTypes(): void
    {
        $this->as($this->owner, 'POST', $this->lines(), [...self::CATERING, 'rate' => '-5']);
        self::assertSame(LineRules::PRICE_NEGATIVE, $this->violation('rate')['code'] ?? null);

        $this->as($this->owner, 'POST', $this->lines(), [...self::CATERING, 'basis' => 'per_guest']);
        self::assertSame(LineRules::BASIS_UNKNOWN, $this->violation('basis')['code'] ?? null);
    }

    #[Test]
    public function aPriceTakesNoMoreDecimalsThanItsCurrencysMinorUnit(): void
    {
        $this->eventId = $this->newEvent('JPY');
        $this->as($this->owner, 'POST', $this->lines(), [...self::CATERING, 'rate' => '12.5', 'currency' => 'JPY']);
        self::assertSame(self::service(TranslatorInterface::class)->trans('validation.budget_rate_too_many_decimals', ['{example}' => '12'], null, 'en'), $this->violation('rate')['message'] ?? null);
        self::assertSame('4800', $this->add([...self::CATERING, 'rate' => '4800', 'currency' => 'JPY'])['rate']);

        $this->eventId = $this->newEvent('KWD');
        $this->as($this->owner, 'POST', $this->lines(), [...self::CATERING, 'rate' => '12.5001', 'currency' => 'KWD']);
        self::assertSame(422, $this->statusCode());
        self::assertSame('12.500', $this->add([...self::CATERING, 'rate' => '12.5', 'currency' => 'KWD'])['rate']);
    }

    #[Test]
    public function aLabelOf100AndANoteOf500AreKept(): void
    {
        $line = $this->add([...self::CATERING, 'label' => Str\repeat('a', 100), 'note' => Str\repeat('n', 500)]);

        self::assertSame([100, 500], [Str\length($line['label']), Str\length($line['note'] ?? '')]);
    }

    #[Test]
    public function aSecondStaffTimeLineIsRefusedOnTheBasisUntilTheFirstIsRemoved(): void
    {
        $staff = $this->add(self::STAFF);
        $catering = $this->add(self::CATERING);
        $taken = self::service(TranslatorInterface::class)->trans('validation.budget_staff_line_taken', [], null, 'en');

        $this->as($this->owner, 'POST', $this->lines(), [...self::STAFF, 'label' => 'More staff']);
        self::assertSame(422, $this->statusCode());
        self::assertSame($taken, $this->violation('basis')['message'] ?? null);

        $this->as($this->owner, 'PUT', $this->lines($catering['id']), [...self::STAFF, 'label' => 'Catering']);
        self::assertSame(422, $this->statusCode());
        self::assertSame($taken, $this->violation('basis')['message'] ?? null);
        self::assertSame(['per_staff_hour', 'per_head'], Vec\map($this->budget(), static fn (array $one): string => $one['basis']));

        $this->as($this->owner, 'PUT', $this->lines($staff['id']), [...self::STAFF, 'label' => 'Staff, renamed']);
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'DELETE', $this->lines($staff['id']));
        $this->add([...self::STAFF, 'label' => 'More staff']);
    }

    #[Test]
    public function theSchemaRefusesAPriceOnTheWrongBasisAndAValueOutsideTheSet(): void
    {
        $connection = self::em()->getConnection();
        $row = ['event_id' => $this->eventId, 'label' => 'x', 'created_at' => '2027-03-01 10:00:00', 'updated_at' => '2027-03-01 10:00:00'];

        foreach ([
            'a price on staff time' => ['category' => 'other', 'basis' => 'per_staff_hour', 'price_minor' => 100],
            'no amount on a fixed line' => ['category' => 'other', 'basis' => 'fixed', 'price_minor' => null],
            'a negative rate' => ['category' => 'other', 'basis' => 'per_head', 'price_minor' => -1],
            'a basis outside the five' => ['category' => 'other', 'basis' => 'per_guest', 'price_minor' => 1],
            'a category outside the nine' => ['category' => 'cake', 'basis' => 'per_head', 'price_minor' => 1],
        ] as $case => $wrong) {
            $connection->executeStatement('SAVEPOINT wrong_line');

            try {
                $connection->insert('budget_lines', ['id' => Uuid::v7()->toRfc4122(), ...$row, ...$wrong]);
                self::fail($case . ' was stored');
            } catch (DriverException) {
                $connection->executeStatement('ROLLBACK TO SAVEPOINT wrong_line');
            }
        }

        self::assertSame(0, Type\int()->coerce($connection->fetchOne('SELECT count(*) FROM budget_lines')));
    }

    #[Test]
    public function anyLineHoldsTheEventsCurrencyUntilTheLastIsRemoved(): void
    {
        $line = $this->add([...self::CATERING, 'rate' => '0']);

        self::assertSame(409, $this->changeCurrency('EUR'));
        self::assertSame(ErrorCode::EventCurrencyInUse->type(), $this->last()['type'] ?? null);
        self::assertSame('GBP', $this->as($this->owner, 'GET', $this->lines())['currency'] ?? null);

        $this->as($this->owner, 'DELETE', $this->lines($line['id']));
        self::assertSame(200, $this->changeCurrency('EUR'));
    }

    #[Test]
    public function aStaffTimeLineHoldsTheCurrencyToo(): void
    {
        $this->add(self::STAFF);

        self::assertSame(409, $this->changeCurrency('EUR'));
    }

    #[Test]
    public function anEventWithNoLineChangesItsCurrencyAsBefore(): void
    {
        self::assertSame(200, $this->changeCurrency('EUR'));
    }

    #[Test]
    public function eachChangeIsPublishedAsAllTheLinesOnTheEventsBudgetTopic(): void
    {
        $line = $this->add(self::CATERING);
        $topic = 'events/' . $this->eventId . '/budget';

        self::assertSame([$line['id'] => '48.00'], $this->published($topic));

        $this->as($this->owner, 'PUT', $this->lines($line['id']), [...self::CATERING, 'rate' => '50']);
        self::assertSame([$line['id'] => '50.00'], $this->published($topic));

        $this->as($this->owner, 'DELETE', $this->lines($line['id']));
        self::assertSame([], $this->published($topic));
    }

    #[Test]
    public function aBudgetReaderIsGivenATokenForTheBudgetTopicAlone(): void
    {
        $body = $this->as($this->owner, 'POST', $this->subscriptions());

        self::assertSame(200, $this->statusCode());
        $payload = Str\split(Type\string()->coerce($body['token'] ?? null), '.')[1] ?? self::fail('not a token');
        $claims = Type\shape(['mercure' => Type\shape(['subscribe' => Type\vec(Type\string())], true)], true)->coerce(Json\decode((string) \base64_decode(Str\replace_every($payload, ['-' => '+', '_' => '/']), true)));
        self::assertSame(['events/' . $this->eventId . '/budget'], $claims['mercure']['subscribe']);
    }

    /** @return iterable<string, array{SeededRole, ?EventRole}> */
    public static function holders(): iterable
    {
        yield 'an admin of the organisation' => [SeededRole::Admin, null];
        yield 'the event lead' => [SeededRole::Member, EventRole::Lead];
    }

    #[Test]
    #[DataProvider('holders')]
    public function adminsAndTheEventLeadReadAndManageTheBudget(SeededRole $role, ?EventRole $on): void
    {
        $holder = $this->member('holder@bloom.events', 'Priya Shah', $role, $on);

        $this->as($holder, 'POST', $this->lines(), self::CATERING);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->as($holder, 'GET', $this->lines());
        self::assertSame(200, $this->statusCode());
        $this->as($holder, 'POST', $this->subscriptions());
        self::assertSame(200, $this->statusCode());
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
        $line = $this->add(self::CATERING);
        $member = $this->member('member@bloom.events', 'Sam Reid', SeededRole::Member, $on);

        foreach ([
            ['GET', $this->lines(), null],
            ['GET', $this->lines($line['id']), null],
            ['POST', $this->lines(), self::CATERING],
            ['PUT', $this->lines($line['id']), self::CATERING],
            ['DELETE', $this->lines($line['id']), null],
            ['POST', $this->subscriptions(), null],
        ] as [$method, $path, $body]) {
            $this->as($member, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }

        self::assertCount(1, $this->budget());
    }

    #[Test]
    public function aMemberWithNoRoleOnTheEventAnotherOrganisationAndAMissingEventAreAllNotFound(): void
    {
        $this->as($this->member('kemi@bloom.events', 'Kemi Ade', SeededRole::Member, null), 'GET', $this->lines());
        self::assertSame(404, $this->statusCode());

        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'GB', 'Europe/London');
        self::em()->flush();
        $this->as($stranger, 'POST', $this->lines(), self::CATERING);
        self::assertSame(404, $this->statusCode());
        $this->as($stranger, 'POST', $this->subscriptions());
        self::assertSame(404, $this->statusCode());

        $this->as($this->owner, 'GET', '/api/events/' . Uuid::v7()->toRfc4122() . '/budget/lines');
        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aLineOnAnotherEventIsNotFoundThroughThisOne(): void
    {
        $line = $this->add(self::CATERING);
        $this->eventId = $this->newEvent('GBP');

        foreach (['GET', 'PUT', 'DELETE'] as $method) {
            $this->as($this->owner, $method, $this->lines($line['id']), 'PUT' === $method ? self::CATERING : null);
            self::assertSame(404, $this->statusCode(), $method);
        }
    }

    /** @return array<string, ?string> */
    private function published(string $topic): array
    {
        $update = self::service(RecordingHub::class)->lastOn($topic) ?? self::fail('nothing published');
        self::assertSame([$topic], $update->getTopics());
        self::assertTrue($update->isPrivate());

        $lines = Type\shape(['lines' => Type\vec(Type\shape(['id' => Type\string(), 'rate' => Type\nullable(Type\string())], true))], true)->coerce(Json\decode($update->getData()))['lines'];

        return Dict\pull($lines, static fn (array $one): ?string => $one['rate'], static fn (array $one): string => $one['id']);
    }

    private function changeCurrency(string $currency): int
    {
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->as($this->owner, 'PATCH', '/api/events/' . $this->eventId, ['currency' => $currency], $tag);

        return $this->statusCode();
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return Line
     */
    private function add(array $body): array
    {
        $answer = $this->as($this->owner, 'POST', $this->lines(), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return $this->line($answer);
    }

    /** @return Line */
    private function line(mixed $answer): array
    {
        return self::row(Type\dict(Type\string(), Type\mixed())->coerce($answer)['line'] ?? null);
    }

    /** @return list<Line> */
    private function budget(): array
    {
        return Vec\map(Type\vec(Type\mixed())->coerce($this->as($this->owner, 'GET', $this->lines())['lines'] ?? null), self::row(...));
    }

    /** @return Line */
    private static function row(mixed $raw): array
    {
        return Type\shape([
            'id' => Type\string(),
            'label' => Type\string(),
            'category' => Type\string(),
            'basis' => Type\string(),
            'rate' => Type\nullable(Type\string()),
            'amount' => Type\nullable(Type\string()),
            'currency' => Type\string(),
            'note' => Type\nullable(Type\string()),
            'quantity' => Type\shape(['count' => Type\int(), 'source' => Type\string(), 'reason' => Type\nullable(Type\string())]),
        ], true)->coerce($raw);
    }

    /** @param list<?string> $companions */
    private function guest(string $name, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function answer(string $guest, string $answer): void
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $this->reply(Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token'), $answer);
    }

    private function reply(#[SensitiveParameter] string $token, string $answer): void
    {
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token, 'answer' => $answer]));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function newEvent(string $currency): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Summer wedding',
            'type' => 'wedding',
            'startsAt' => '2027-06-12T14:00',
            'endsAt' => '2027-06-13T01:00',
            'timeZone' => 'Europe/London',
            'currency' => $currency,
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function lines(?string $id = null): string
    {
        return '/api/events/' . $this->eventId . '/budget/lines' . (null === $id ? '' : '/' . $id);
    }

    private function subscriptions(): string
    {
        return '/api/events/' . $this->eventId . '/budget/subscriptions';
    }

    /** @return ?array{propertyPath: string, message: string, code: string, ...} */
    private function violation(string $path): ?array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string(), 'code' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        foreach ($violations as $violation) {
            if ($violation['propertyPath'] === $path) {
                return $violation;
            }
        }

        return null;
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
     * @param array<string, mixed>|stdClass|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, array|stdClass|null $body = null, ?string $ifMatch = null): array
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
