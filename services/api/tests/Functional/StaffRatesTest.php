<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Budget\StaffRateEditor;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Staff rates (sc-101): hours of Staffing's shifts, a rate on a job or a person, and the budget's staff-time line as their total. */
final class StaffRatesTest extends ApiTestCase
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
    public function everyJobStartsWithNoRateAndItsHoursAreNotCounted(): void
    {
        $this->shift('Bar', '2027-06-12T18:00', '2027-06-12T23:30', 2);

        $page = $this->page();

        self::assertSame('GBP', $page['currency']);
        self::assertSame('0.00', $page['headline']['total']);
        self::assertSame(0, $page['headline']['countedMinutes']);
        self::assertSame(660, $page['headline']['scheduledMinutes']);
        self::assertSame([['job' => ['id' => $this->job('Bar'), 'name' => 'Bar'], 'minutes' => 660]], $page['headline']['unrated']);
        self::assertNull($this->jobRow('Bar')['rate']);
        self::assertNull($this->jobRow('Bar')['cost']);
    }

    #[Test]
    public function aShiftCountsItsLengthOnceForEveryPlaceItNeedsTakenOrNot(): void
    {
        $shift = $this->shift('Waiter', '2027-06-12T18:00', '2027-06-13T00:00', 3);
        $this->assign($shift, $this->person('Sade Lawal'));
        $this->setJob('Waiter', 'hourly', '14');

        $waiter = $this->jobRow('Waiter');

        self::assertSame(1080, $waiter['scheduledMinutes']);
        self::assertSame(2, $waiter['openPlaces']);
        self::assertSame('252.00', $waiter['cost']);
        self::assertSame('252.00', $this->page()['headline']['total']);
    }

    #[Test]
    public function aShiftCrossingMidnightCountsItsHoursOnTheEventsClock(): void
    {
        $this->shift('Security', '2027-06-12T22:00', '2027-06-13T02:30');
        $this->setJob('Security', 'hourly', '15');

        self::assertSame(270, $this->jobRow('Security')['scheduledMinutes']);
        self::assertSame('67.50', $this->jobRow('Security')['cost']);
    }

    #[Test]
    public function aFlatFeeIsOncePerPersonHoweverManyShiftsAndOnceForEachOpenPlace(): void
    {
        $tolu = $this->person('Tolu Bello');
        $this->assign($this->shift('Door', '2027-06-12T14:00', '2027-06-12T17:00'), $tolu);
        $this->assign($this->shift('Door', '2027-06-12T19:00', '2027-06-12T23:00', 3), $tolu);
        $this->setJob('Door', 'flat', '120');

        $door = $this->jobRow('Door');

        self::assertSame(3, $door['fees']);
        self::assertSame('360.00', $door['cost']);
        self::assertSame(['Tolu Bello'], $door['paidOnce']);
    }

    #[Test]
    public function aPersonOnTheirOwnRateIsPaidItInsteadOfTheirJobs(): void
    {
        $shift = $this->shift('Waiter', '2027-06-12T18:00', '2027-06-13T00:00', 2);
        $kunle = $this->person('Kunle Ajayi');
        $this->assign($shift, $kunle);
        $this->setJob('Waiter', 'hourly', '14');

        $this->as($this->owner, 'PUT', $this->rates('people/' . $kunle), ['kind' => 'hourly', 'amount' => '16', 'currency' => 'GBP']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $page = $this->page();
        self::assertSame('180.00', $this->jobRow('Waiter')['cost']);
        self::assertSame(360, $this->jobRow('Waiter')['rateMinutes']);
        self::assertSame(['Kunle Ajayi'], $this->jobRow('Waiter')['keepOwn']);
        self::assertSame([['member' => ['id' => $kunle, 'name' => 'Kunle Ajayi'], 'job' => ['id' => $this->job('Waiter'), 'name' => 'Waiter'], 'minutes' => 360, 'cost' => '96.00']], Vec\map($page['own'], static fn (array $own): array => ['member' => $own['member'], 'job' => $own['job'], 'minutes' => $own['minutes'], 'cost' => $own['cost']]));
        self::assertSame([], $page['candidates']);

        $this->as($this->owner, 'DELETE', $this->rates('people/' . $kunle));
        self::assertSame(200, $this->statusCode());
        self::assertSame('168.00', $this->jobRow('Waiter')['cost']);
        self::assertSame([['member' => ['id' => $kunle, 'name' => 'Kunle Ajayi'], 'job' => ['id' => $this->job('Waiter'), 'name' => 'Waiter'], 'minutes' => 360]], $this->page()['candidates']);
    }

    #[Test]
    public function zeroIsARateAndRemovingOnePutsTheJobBackToNotCounted(): void
    {
        $this->shift('Runner', '2027-06-12T18:00', '2027-06-12T20:00');
        $this->setJob('Runner', 'hourly', '0');

        self::assertSame('0.00', $this->jobRow('Runner')['cost']);
        self::assertSame([], $this->page()['headline']['unrated']);

        $this->as($this->owner, 'DELETE', $this->rates('jobs/' . $this->job('Runner')));
        self::assertSame(200, $this->statusCode());
        self::assertNull($this->jobRow('Runner')['rate']);
        self::assertSame(120, $this->page()['headline']['unrated'][0]['minutes'] ?? null);
    }

    /** @return iterable<string, array{array<string, string>, string, string}> */
    public static function badRates(): iterable
    {
        yield 'blank rate' => [['kind' => 'hourly', 'amount' => ' ', 'currency' => 'GBP'], 'amount', 'Enter the rate an hour.'];
        yield 'blank fee' => [['kind' => 'flat', 'amount' => '', 'currency' => 'GBP'], 'amount', 'Enter the fee for each person.'];
        yield 'below 0' => [['kind' => 'hourly', 'amount' => '-14', 'currency' => 'GBP'], 'amount', 'The rate cannot be below 0. Enter 0 or more.'];
        yield 'not a number' => [['kind' => 'hourly', 'amount' => 'fourteen', 'currency' => 'GBP'], 'amount', 'Enter the rate in numbers only.'];
        yield 'too many decimals' => [['kind' => 'hourly', 'amount' => '14.505', 'currency' => 'GBP'], 'amount', 'That has too many decimal places for this event’s currency. Enter the rate like 12.50.'];
        yield 'another currency' => [['kind' => 'hourly', 'amount' => '14', 'currency' => 'EUR'], 'currency', 'Enter the price in GBP, the currency this event uses.'];
        yield 'no kind' => [['amount' => '14', 'currency' => 'GBP'], 'kind', 'Choose how they are paid.'];
    }

    /** @param array<string, string> $sent */
    #[Test]
    #[DataProvider('badRates')]
    public function aWrongRateIsRefusedBesideItsFieldAndNothingIsSaved(array $sent, string $field, string $message): void
    {
        $this->as($this->owner, 'PUT', $this->rates('jobs/' . $this->job('Waiter')), $sent);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($field));
        self::assertNull($this->jobRow('Waiter')['rate']);
    }

    #[Test]
    public function aChangeIsAuditedWithWhoMadeItAndWhatItWas(): void
    {
        $this->setJob('Waiter', 'hourly', '14');
        $this->setJob('Waiter', 'hourly', '15');

        $entries = Vec\filter(self::em()->getRepository(AuditEntry::class)->findBy([], ['id' => 'ASC']), static fn (AuditEntry $entry): bool => StaffRateEditor::SET === $entry->getAction());

        self::assertCount(2, $entries);
        $last = Iter\last($entries) ?? self::fail('no entry');
        self::assertSame('Harriet Cole', $last->getActorLabel());
        self::assertSame(['amountMinor' => [1400, 1500]], $last->getChanges());
        self::assertSame(['by' => 'Harriet Cole', 'at' => '2027-03-01T10:00:00+00:00'], $this->jobRow('Waiter')['changed']);
    }

    #[Test]
    public function aMemberWhoCanReadTheBudgetButNotManageItSeesRatesAndCannotSetOne(): void
    {
        $kunle = $this->person('Kunle Ajayi', 'Waiter');
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::BudgetManage);

        $this->as($this->owner, 'GET', $this->rates());
        self::assertSame(200, $this->statusCode());

        foreach ([
            ['PUT', $this->rates('jobs/' . $this->job('Waiter')), ['kind' => 'hourly', 'amount' => '14', 'currency' => 'GBP']],
            ['DELETE', $this->rates('jobs/' . $this->job('Waiter')), null],
            ['PUT', $this->rates('people/' . $kunle), ['kind' => 'hourly', 'amount' => '16', 'currency' => 'GBP']],
            ['DELETE', $this->rates('people/' . $kunle), null],
        ] as [$method, $path, $body]) {
            $this->as($this->owner, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function aGrantHolderOnTheRosterCannotReadRatesOrSetTheirOwn(): void
    {
        $grantee = $this->member('ada@bloom.events', 'Ada Obi', EventRole::CanEdit);
        $this->as($this->owner, 'POST', $this->staffPath(''), ['fullName' => 'Ada Obi', 'email' => 'ada@bloom.events', 'job' => $this->job('Waiter')]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $ada = Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];

        $this->as($grantee, 'GET', $this->rates());
        self::assertSame(403, $this->statusCode());
        $this->as($grantee, 'PUT', $this->rates('people/' . $ada), ['kind' => 'hourly', 'amount' => '40', 'currency' => 'GBP']);
        self::assertSame(403, $this->statusCode());
        self::assertSame([], $this->page()['own']);
    }

    #[Test]
    public function aJobOnAnotherEventIsNotFoundThroughThisOne(): void
    {
        $waiter = $this->job('Waiter');
        $this->eventId = $this->newEvent();

        $this->as($this->owner, 'PUT', $this->rates('jobs/' . $waiter), ['kind' => 'hourly', 'amount' => '14', 'currency' => 'GBP']);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aRateHoldsTheEventsCurrencyUntilTheLastOneIsRemoved(): void
    {
        $this->setJob('Waiter', 'hourly', '0');

        self::assertSame(409, $this->changeCurrency('EUR'));
        self::assertSame(ErrorCode::EventCurrencyInUse->type(), $this->last()['type'] ?? null);

        $this->as($this->owner, 'DELETE', $this->rates('jobs/' . $this->job('Waiter')));
        self::assertSame(200, $this->changeCurrency('EUR'));
    }

    #[Test]
    public function thePersonsOwnRateHoldsTheCurrencyToo(): void
    {
        $kunle = $this->person('Kunle Ajayi', 'Waiter');
        $this->as($this->owner, 'PUT', $this->rates('people/' . $kunle), ['kind' => 'flat', 'amount' => '0', 'currency' => 'GBP']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(409, $this->changeCurrency('EUR'));
    }

    #[Test]
    public function theBudgetsStaffLineIsTheStaffRatesTotalAndHoldsNoRateOfItsOwn(): void
    {
        $this->shift('Waiter', '2027-06-12T18:00', '2027-06-13T00:00', 2);
        $this->shift('Bar', '2027-06-12T18:00', '2027-06-12T22:00');
        $this->setJob('Waiter', 'hourly', '14');
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/budget/lines', ['label' => 'Staff', 'category' => 'staffing', 'basis' => 'per_staff_hour']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $range = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/budget');
        $staff = Type\shape(['total' => Type\string(), 'countedMinutes' => Type\int(), 'scheduledMinutes' => Type\int(), 'unrated' => Type\mixed()])->coerce($range['staff'] ?? null);
        $line = Type\shape(['basis' => Type\string(), 'rate' => Type\nullable(Type\string()), 'cost' => Type\shape(['confirmed' => Type\string(), 'potential' => Type\string()])], true)->coerce(Type\vec(Type\mixed())->coerce($range['lines'] ?? null)[0] ?? null);

        self::assertSame('168.00', $staff['total']);
        self::assertSame(720, $staff['countedMinutes']);
        self::assertSame(960, $staff['scheduledMinutes']);
        self::assertSame(['confirmed' => '168.00', 'potential' => '168.00'], $line['cost']);
        self::assertNull($line['rate']);
        self::assertSame('168.00', $range['confirmed'] ?? null);
    }

    private function setJob(string $job, string $kind, string $amount): void
    {
        $this->as($this->owner, 'PUT', $this->rates('jobs/' . $this->job($job)), ['kind' => $kind, 'amount' => $amount, 'currency' => 'GBP']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return array{id: string, job: string, ...} */
    private function shift(string $job, string $from, string $to, int $needed = 1): array
    {
        $this->as($this->owner, 'POST', $this->staffPath('/shifts'), ['job' => $this->job($job), 'startsAt' => $from, 'endsAt' => $to, 'needed' => $needed]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $shifts = Type\vec(Type\shape(['id' => Type\string(), 'job' => Type\string()], true))->coerce($this->last()['shifts'] ?? null);

        return Iter\last($shifts) ?? self::fail('no shift');
    }

    /** @param array{id: string, ...} $shift */
    private function assign(array $shift, string $person): void
    {
        $this->as($this->owner, 'PUT', $this->staffPath('/shifts/' . $shift['id'] . '/people/' . $person));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function person(string $name, ?string $job = null): string
    {
        $this->as($this->owner, 'POST', $this->staffPath(''), ['fullName' => $name, 'job' => null === $job ? null : $this->job($job)]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
    }

    private function job(string $name): string
    {
        $body = $this->as($this->owner, 'GET', $this->staffPath(''));
        $jobs = Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()], true))->coerce($body['jobs'] ?? null);

        return (Iter\search($jobs, static fn (array $job): bool => $job['name'] === $name) ?? self::fail('no job ' . $name))['id'];
    }

    /** @return array{id: string, name: string, rate: ?array{kind: string, amount: string}, changed: ?array{by: ?string, at: string}, scheduledMinutes: int, openPlaces: int, cost: ?string, rateMinutes: int, fees: int, paidOnce: list<string>, keepOwn: list<string>, ...} */
    private function jobRow(string $name): array
    {
        return Iter\search($this->page()['jobs'], static fn (array $job): bool => $job['name'] === $name) ?? self::fail('no job ' . $name);
    }

    /** @return array{currency: string, headline: array{total: string, countedMinutes: int, scheduledMinutes: int, unrated: list<array{job: array{id: string, name: string}, minutes: int}>}, jobs: list<array{id: string, name: string, rate: ?array{kind: string, amount: string}, changed: ?array{by: ?string, at: string}, scheduledMinutes: int, openPlaces: int, cost: ?string, rateMinutes: int, fees: int, paidOnce: list<string>, keepOwn: list<string>, ...}>, own: list<array{member: array{id: string, name: string}, job: array{id: string, name: string}, minutes: int, cost: string, ...}>, candidates: list<array{member: array{id: string, name: string}, job: array{id: string, name: string}, minutes: int}>} */
    private function page(): array
    {
        $body = $this->as($this->owner, 'GET', $this->rates());
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $named = Type\shape(['id' => Type\string(), 'name' => Type\string()]);

        return [
            'currency' => Type\string()->coerce($body['currency'] ?? null),
            'headline' => Type\shape([
                'total' => Type\string(),
                'countedMinutes' => Type\int(),
                'scheduledMinutes' => Type\int(),
                'unrated' => Type\vec(Type\shape(['job' => $named, 'minutes' => Type\int()])),
            ])->coerce($body['headline'] ?? null),
            'jobs' => Type\vec(Type\shape([
                'id' => Type\string(),
                'name' => Type\string(),
                'rate' => Type\nullable(Type\shape(['kind' => Type\string(), 'amount' => Type\string()])),
                'changed' => Type\nullable(Type\shape(['by' => Type\nullable(Type\string()), 'at' => Type\string()])),
                'scheduledMinutes' => Type\int(),
                'openPlaces' => Type\int(),
                'cost' => Type\nullable(Type\string()),
                'rateMinutes' => Type\int(),
                'fees' => Type\int(),
                'paidOnce' => Type\vec(Type\string()),
                'keepOwn' => Type\vec(Type\string()),
            ], true))->coerce($body['jobs'] ?? null),
            'own' => Type\vec(Type\shape(['member' => $named, 'job' => $named, 'minutes' => Type\int(), 'cost' => Type\string()], true))->coerce($body['own'] ?? null),
            'candidates' => Type\vec(Type\shape(['member' => $named, 'job' => $named, 'minutes' => Type\int()]))->coerce($body['candidates'] ?? null),
        ];
    }

    private function changeCurrency(string $currency): int
    {
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->as($this->owner, 'PATCH', '/api/events/' . $this->eventId, ['currency' => $currency], $tag);

        return $this->statusCode();
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

    private function rates(string $rest = ''): string
    {
        return '/api/events/' . $this->eventId . '/budget/staff-rates' . ('' === $rest ? '' : '/' . $rest);
    }

    private function staffPath(string $rest): string
    {
        return '/api/events/' . $this->eventId . '/staff' . $rest;
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return Iter\search($violations, static fn (array $violation): bool => $violation['propertyPath'] === $path)['message'] ?? null;
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
            ...(null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch]),
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
