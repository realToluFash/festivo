<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

final class BudgetMarginTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const array MARQUEE = ['label' => 'Marquee', 'category' => 'hire', 'basis' => 'fixed', 'amount' => '1000', 'currency' => 'GBP'];

    private const array VENUE = ['label' => 'Venue hire', 'category' => 'venue', 'basis' => 'fixed', 'amount' => '10000', 'currency' => 'GBP'];

    private const array FEE = ['label' => 'Planning fee', 'category' => 'other', 'basis' => 'fixed', 'amount' => '0', 'currency' => 'GBP'];

    private const array AGENCY_KEYS = ['client', 'margin', 'markup', 'markups', 'share', 'price'];

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
        $this->plan(Plan::Enterprise);
    }

    #[Test]
    public function aMarkupIsAShareOfCostAndTheMarginAShareOfTheClientPrice(): void
    {
        $this->add(self::MARQUEE);
        $margin = $this->put($this->markup(), ['markup' => '25']);

        self::assertSame(200, $this->statusCode(), Json\encode($margin));
        self::assertSame(['client' => ['1250.00', '1250.00'], 'cost' => ['1000.00', '1000.00'], 'margin' => ['250.00', '250.00'], 'share' => ['20.0', '20.0']], self::figures($margin['total'] ?? null));
        self::assertSame(['event' => '25', 'categories' => []], $margin['markups'] ?? null);
        self::assertSame(['event', '25'], self::charged($margin, 0, ['source', 'markup']));
    }

    #[Test]
    public function atCostIsAChosenZeroAndAPriceBelowCostIsANegativeMargin(): void
    {
        $marquee = $this->add(self::MARQUEE);
        $this->put($this->markup(), ['markup' => '20']);

        $margin = $this->put($this->markup('hire'), ['markup' => '0']);
        self::assertSame(['margin' => ['0.00', '0.00'], 'share' => ['0.0', '0.0']], Dict\select_keys(self::figures($margin['total'] ?? null), ['margin', 'share']));
        self::assertSame(['category', '0'], self::charged($margin, 0, ['source', 'markup']));

        $margin = $this->put($this->charge($marquee['id']), ['price' => '900', 'currency' => 'GBP']);
        self::assertSame(200, $this->statusCode(), Json\encode($margin));
        self::assertSame(['margin' => ['-100.00', '-100.00'], 'share' => ['-11.1', '-11.1']], Dict\select_keys(self::figures($margin['total'] ?? null), ['margin', 'share']));
        self::assertSame(['price', null, '900.00'], self::charged($margin, 0, ['source', 'markup', 'price']));
    }

    #[Test]
    public function aFeeLineIsAllMarginAndTheEventsShareIsOfItsTotals(): void
    {
        $fee = $this->add(self::FEE);
        $margin = $this->put($this->charge($fee['id']), ['price' => '3000', 'currency' => 'GBP']);
        self::assertSame(['margin' => ['3000.00', '3000.00'], 'share' => ['100.0', '100.0']], Dict\select_keys(self::figures($margin['categories']['other'] ?? null), ['margin', 'share']));

        $this->add(self::VENUE);
        $margin = $this->margin();

        self::assertSame(['client' => ['13000.00', '13000.00'], 'cost' => ['10000.00', '10000.00'], 'margin' => ['3000.00', '3000.00'], 'share' => ['23.1', '23.1']], self::figures($margin['total'] ?? null));
        self::assertSame(['none', '0'], self::charged($margin, 1, ['source', 'markup']));
    }

    #[Test]
    public function aClientPriceOfZeroHasNoShare(): void
    {
        $fee = $this->add(self::FEE);
        $margin = $this->put($this->charge($fee['id']), ['price' => '0', 'currency' => 'GBP']);

        self::assertSame(['margin' => ['0.00', '0.00'], 'share' => [null, null]], Dict\select_keys(self::figures($margin['total'] ?? null), ['margin', 'share']));
    }

    #[Test]
    public function theLinesOwnMarkupBeatsItsCategorysWhichBeatsTheEventsAndClearingGoesBackAStep(): void
    {
        $marquee = $this->add(self::MARQUEE);
        $this->put($this->markup(), ['markup' => '20']);
        $this->put($this->markup('hire'), ['markup' => '15']);
        $margin = $this->put($this->charge($marquee['id']), ['markup' => '12.5']);

        self::assertSame(['line', '12.5'], self::charged($margin, 0, ['source', 'markup']));
        self::assertSame(['1125.00', '1125.00'], self::figures($margin['total'] ?? null)['client']);

        self::assertSame(['category', '15'], self::charged($this->put($this->charge($marquee['id']), ['markup' => null]), 0, ['source', 'markup']));
        self::assertSame(['event', '20'], self::charged($this->put($this->markup('hire'), ['markup' => null]), 0, ['source', 'markup']));
        self::assertSame(['event' => '20', 'categories' => []], $this->margin()['markups'] ?? null);
    }

    #[Test]
    public function eachEndOfTheRangeUsesItsOwnTotals(): void
    {
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Ada and Obi"]', 'id' => $this->eventId]);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/make-live');
        $guest = $this->guest('Ada Obi', ['Tunde Obi']);
        $this->answer($guest, 'coming');
        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/guests/' . $this->guest('Grace Hall') . '/invitation', ['how' => 'inPerson']);
        $this->add(['label' => 'Dinner', 'category' => 'catering', 'basis' => 'per_head', 'rate' => '100', 'currency' => 'GBP']);
        $this->add(self::FEE);
        $this->put($this->markup(), ['markup' => '10']);
        $fee = $this->margin()['lines'][1]['id'] ?? self::fail('no fee');
        $margin = $this->put($this->charge(Type\string()->coerce($fee)), ['price' => '500', 'currency' => 'GBP']);

        self::assertSame([
            'client' => ['720.00', '830.00'],
            'cost' => ['200.00', '300.00'],
            'margin' => ['520.00', '530.00'],
            'share' => ['72.2', '63.9'],
        ], self::figures($margin['total'] ?? null));
    }

    /** @return iterable<string, array{array<string, ?string>, string, string}> */
    public static function refused(): iterable
    {
        yield 'a negative markup' => [['markup' => '-5'], 'markup', 'budget_markup_negative'];
        yield 'a markup over 999.9' => [['markup' => '1000'], 'markup', ErrorCode::ValidationFailed->value];
        yield 'two decimals' => [['markup' => '20.25'], 'markup', ErrorCode::ValidationFailed->value];
        yield 'not a number' => [['markup' => 'twenty'], 'markup', ErrorCode::ValidationFailed->value];
        yield 'a negative price' => [['price' => '-1', 'currency' => 'GBP'], 'price', ErrorCode::ValidationFailed->value];
        yield 'a price past the minor unit' => [['price' => '950.505', 'currency' => 'GBP'], 'price', ErrorCode::ValidationFailed->value];
        yield 'a price in another currency' => [['price' => '950', 'currency' => 'EUR'], 'currency', ErrorCode::ValidationFailed->value];
        yield 'a markup and a price' => [['markup' => '5', 'price' => '950', 'currency' => 'GBP'], 'markup', ErrorCode::ValidationFailed->value];
    }

    /** @param array<string, ?string> $body */
    #[Test]
    #[DataProvider('refused')]
    public function aWrongMarkupOrPriceIsRefusedOnItsFieldAndNothingChanges(array $body, string $field, string $code): void
    {
        $marquee = $this->add(self::MARQUEE);
        $this->put($this->charge($marquee['id']), $body);

        self::assertSame(422, $this->statusCode());
        self::assertSame(ErrorCode::ValidationFailed->type(), $this->last()['type'] ?? null);
        self::assertSame($code, $this->violation($field)['code'] ?? null, Json\encode($this->last()));
        self::assertSame(['none', null], self::charged($this->margin(), 0, ['source', 'price']));
    }

    #[Test]
    public function aMarkupRefusalFormatsItsNumbersForTheLanguage(): void
    {
        $this->as($this->owner, 'PUT', $this->markup(), ['markup' => '1000'], 'fr');
        self::assertStringContainsString('999,9', $this->violation('markup')['message'] ?? '');

        $this->as($this->owner, 'PUT', $this->markup(), ['markup' => '1000']);
        self::assertSame('Enter a markup of 999.9% or less.', $this->violation('markup')['message'] ?? null);
    }

    #[Test]
    public function aFreeOrganisationIsRefusedEveryMarginRouteAndKeepsWhatItSetUntilItIsEnterpriseAgain(): void
    {
        $marquee = $this->add(self::MARQUEE);
        $this->put($this->charge($marquee['id']), ['price' => '1500', 'currency' => 'GBP']);
        $this->plan(Plan::Free);

        foreach ($this->routes($marquee['id']) as [$method, $path, $body]) {
            $this->as($this->owner, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PlanRequired->type(), $this->last()['type'] ?? null);
        }

        $this->plan(Plan::Enterprise);
        self::assertSame(['price', '1500.00'], self::charged($this->margin(), 0, ['source', 'price']));
    }

    /** @return iterable<string, array{SeededRole, ?EventRole}> */
    public static function holders(): iterable
    {
        yield 'an admin of the organisation' => [SeededRole::Admin, null];
        yield 'the event lead' => [SeededRole::Member, EventRole::Lead];
    }

    #[Test]
    #[DataProvider('holders')]
    public function adminsAndTheEventLeadReadAndSetTheMargin(SeededRole $role, ?EventRole $on): void
    {
        $holder = $this->member($role, $on);
        $marquee = $this->add(self::MARQUEE);

        foreach ($this->routes($marquee['id']) as [$method, $path, $body]) {
            $this->as($holder, $method, $path, $body);
            self::assertSame(200, $this->statusCode(), $method . ' ' . $path . ' ' . Json\encode($this->last()));
        }
    }

    /** @return iterable<string, array{EventRole}> */
    public static function withoutTheMargin(): iterable
    {
        yield 'can edit' => [EventRole::CanEdit];
        yield 'can view' => [EventRole::CanView];
        yield 'can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('withoutTheMargin')]
    public function aCoordinatorSeesNeitherTheBudgetNorTheMargin(EventRole $on): void
    {
        $member = $this->member(SeededRole::Member, $on);
        $marquee = $this->add(self::MARQUEE);

        foreach ($this->routes($marquee['id']) as [$method, $path, $body]) {
            $this->as($member, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function aMarginReaderIsGivenATokenForTheMarginAndTheHeadcount(): void
    {
        $body = $this->as($this->owner, 'POST', $this->event() . '/margin/subscriptions');

        self::assertSame(200, $this->statusCode());
        $payload = Str\split(Type\string()->coerce($body['token'] ?? null), '.')[1] ?? self::fail('not a token');
        $claims = Type\shape(['mercure' => Type\shape(['subscribe' => Type\vec(Type\string())], true)], true)->coerce(Json\decode((string) \base64_decode(Str\replace_every($payload, ['-' => '+', '_' => '/']), true)));
        self::assertSame(['events/' . $this->eventId . '/budget/margin', 'events/' . $this->eventId . '/headcount'], $claims['mercure']['subscribe']);
    }

    #[Test]
    public function aChangeReachesTheMarginTopicAndNoBudgetReadOrUpdateCarriesAClientFigure(): void
    {
        $marquee = $this->add(self::MARQUEE);
        $this->put($this->markup(), ['markup' => '20']);
        $this->put($this->charge($marquee['id']), ['price' => '1500', 'currency' => 'GBP']);

        $update = self::service(RecordingHub::class)->lastOn('events/' . $this->eventId . '/budget/margin') ?? self::fail('nothing published');
        self::assertTrue($update->isPrivate());
        self::assertSame(['price', '1500.00'], self::charged(Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($update->getData())), 0, ['source', 'price']));

        $budget = self::service(RecordingHub::class)->lastOn('events/' . $this->eventId . '/budget') ?? self::fail('nothing published');
        self::assertNoAgencyKey(Json\decode($budget->getData()));

        foreach (['GET' => [$this->event(), $this->event() . '/lines', $this->event() . '/lines/' . $marquee['id']], 'POST' => [$this->event() . '/what-if']] as $method => $paths) {
            foreach ($paths as $path) {
                self::assertNoAgencyKey($this->as($this->owner, $method, $path, 'POST' === $method ? ['changes' => [['change' => 'guests', 'by' => 10]]] : null));
                self::assertSame(200, $this->statusCode(), $path . ' ' . Json\encode($this->last()));
            }
        }
    }

    #[Test]
    public function withoutTheMarginPlanNothingIsPublishedOnTheMarginTopic(): void
    {
        $this->plan(Plan::Free);
        $this->add(self::MARQUEE);

        self::assertNull(self::service(RecordingHub::class)->lastOn('events/' . $this->eventId . '/budget/margin'));
        self::assertNotNull(self::service(RecordingHub::class)->lastOn('events/' . $this->eventId . '/budget'));
    }

    private static function assertNoAgencyKey(mixed $data, string $at = ''): void
    {
        if (!\is_array($data)) {
            return;
        }

        foreach ($data as $key => $value) {
            self::assertNotContains($key, self::AGENCY_KEYS, 'at ' . $at . '.' . $key);
            self::assertNoAgencyKey($value, $at . '.' . $key);
        }
    }

    /** @return list<array{string, string, ?array<string, mixed>}> */
    private function routes(string $lineId): array
    {
        return [
            ['GET', $this->event() . '/margin', null],
            ['PUT', $this->markup(), ['markup' => '20']],
            ['PUT', $this->markup('venue'), ['markup' => '0']],
            ['PUT', $this->charge($lineId), ['markup' => '10']],
            ['POST', $this->event() . '/margin/subscriptions', null],
        ];
    }

    /** @return array{client: list<string>, cost: list<string>, margin: list<string>, share: list<?string>} */
    private static function figures(mixed $raw): array
    {
        $pair = Type\shape(['confirmed' => Type\string(), 'potential' => Type\string()]);
        $figures = Type\shape(['client' => $pair, 'cost' => $pair, 'margin' => $pair, 'share' => Type\shape(['confirmed' => Type\nullable(Type\string()), 'potential' => Type\nullable(Type\string())])], true)->coerce($raw);

        return [
            'client' => [$figures['client']['confirmed'], $figures['client']['potential']],
            'cost' => [$figures['cost']['confirmed'], $figures['cost']['potential']],
            'margin' => [$figures['margin']['confirmed'], $figures['margin']['potential']],
            'share' => [$figures['share']['confirmed'], $figures['share']['potential']],
        ];
    }

    /** @return list<mixed> */
    private static function charged(array $margin, int $index, array $keys): array
    {
        $line = Type\dict(Type\string(), Type\mixed())->coerce(Type\vec(Type\mixed())->coerce($margin['lines'] ?? null)[$index] ?? null);
        $picked = [];

        foreach ($keys as $key) {
            $picked[] = $line[$key] ?? null;
        }

        return $picked;
    }

    private function plan(Plan $plan): void
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::service(PlanChanger::class)->change($organisation, $plan, 'Ada at Soirely', 'A test moves the plan.');
        self::em()->flush();
    }

    /** @return array<string, mixed> */
    private function margin(): array
    {
        $margin = $this->as($this->owner, 'GET', $this->event() . '/margin');
        self::assertSame(200, $this->statusCode(), Json\encode($margin));

        return $margin;
    }

    /** @return array<string, mixed> */
    private function put(string $path, array $body): array
    {
        return $this->as($this->owner, 'PUT', $path, $body);
    }

    /** @return array{id: string} */
    private function add(array $body): array
    {
        $answer = $this->as($this->owner, 'POST', $this->event() . '/lines', $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return ['id' => Type\shape(['id' => Type\string()], true)->coerce($answer['line'] ?? null)['id']];
    }

    private function event(): string
    {
        return '/api/events/' . $this->eventId . '/budget';
    }

    private function markup(?string $category = null): string
    {
        return $this->event() . (null === $category ? '/markup' : '/markups/' . $category);
    }

    private function charge(string $lineId): string
    {
        return $this->event() . '/lines/' . $lineId . '/charge';
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
        $token = Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token, 'answer' => $answer]));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
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

    private function member(SeededRole $seeded, ?EventRole $on): User
    {
        $user = $this->account('member@bloom.events', 'Priya Shah');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
    }

    /** @return array<string, mixed> */
    private function as(User $user, string $method, string $path, ?array $body = null, string $language = 'en'): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => $language,
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
