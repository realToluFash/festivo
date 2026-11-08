<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** An event's seating plan: its room, its sections, and who may change them (sc-3998). */
final class SeatingPlanTest extends ApiTestCase
{
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
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent($this->owner, $this->organisation);
    }

    #[Test]
    public function anEventWithNoPlanSaysSoInItsOrganisationsUnits(): void
    {
        $seating = $this->seating($this->as($this->owner, 'GET', $this->plan()));

        self::assertSame(200, $this->statusCode());
        self::assertNull($seating['plan']);
        self::assertSame('metric', $seating['measurementSystem']);
        self::assertFalse($this->client->getResponse()->headers->has('ETag'));
    }

    #[Test]
    public function aUsCustomaryOrganisationMeasuresInFeet(): void
    {
        $host = $this->account('host@party.us');
        $organisation = self::service(OrganisationFounder::class)->found($host, 'Party Co', 'US', 'America/New_York');
        self::em()->flush();
        $eventId = $this->newEvent($host, $organisation);

        self::assertSame('us', $this->seating($this->as($host, 'GET', '/api/events/' . $eventId . '/seating-plan'))['measurementSystem']);

        $this->as($host, 'POST', '/api/events/' . $eventId . '/seating-plan', ['widthCm' => 150, 'lengthCm' => 900]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('The room must be between 6 ft 7 in and 1640 ft 5 in.', $this->violation('widthCm'));
    }

    #[Test]
    public function startingThePlanKeepsTheRoomInCentimetres(): void
    {
        $seating = $this->seating($this->as($this->owner, 'POST', $this->plan(), ['roomName' => '  Main hall ', 'widthCm' => 2400, 'lengthCm' => 1800]));

        self::assertSame(201, $this->statusCode());
        $plan = $this->planOf($seating);
        self::assertSame('Main hall', $plan['roomName']);
        self::assertSame(2400, $plan['widthCm']);
        self::assertSame(1800, $plan['lengthCm']);
        self::assertSame([], $plan['sections']);
        self::assertSame(['sections' => 0, 'tables' => 0, 'rows' => 0, 'singleSeats' => 0, 'seatedGuests' => 0], $plan['counts']);
        self::assertSame('"1"', $this->client->getResponse()->headers->get('ETag'));
    }

    #[Test]
    public function theRoomNameIsOptional(): void
    {
        $plan = $this->planOf($this->seating($this->as($this->owner, 'POST', $this->plan(), ['roomName' => '   ', 'widthCm' => 200, 'lengthCm' => 50_000])));

        self::assertNull($plan['roomName']);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function refusedRooms(): iterable
    {
        yield 'no width' => [['lengthCm' => 1000], 'widthCm', "Enter the room's width."];
        yield 'no length' => [['widthCm' => 1000, 'lengthCm' => null], 'lengthCm', "Enter the room's length."];
        yield 'too narrow' => [['widthCm' => 199, 'lengthCm' => 1000], 'widthCm', 'The room must be between 2 m and 500 m.'];
        yield 'too long' => [['widthCm' => 1000, 'lengthCm' => 50_001], 'lengthCm', 'The room must be between 2 m and 500 m.'];
        yield 'a long room name' => [['roomName' => Str\repeat('a', 61), 'widthCm' => 1000, 'lengthCm' => 1000], 'roomName', 'Shorten the room name to 60 characters or fewer.'];
    }

    /** @param array<string, mixed> $body */
    #[Test]
    #[DataProvider('refusedRooms')]
    public function aRoomOutsideTheLimitsIsRefusedBesideItsFieldAndNothingIsSaved(array $body, string $field, string $message): void
    {
        $this->as($this->owner, 'POST', $this->plan(), $body);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($field));
        self::assertNull($this->seating($this->as($this->owner, 'GET', $this->plan()))['plan']);
    }

    #[Test]
    public function anEventHasOnePlan(): void
    {
        $this->started();
        $this->as($this->owner, 'POST', $this->plan(), ['widthCm' => 1000, 'lengthCm' => 1000]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/seating_plan_exists', $this->last()['type'] ?? null);
    }

    #[Test]
    public function roomSettingsChangesTheRoomAgainstTheVersionItRead(): void
    {
        $this->started();
        $plan = $this->planOf($this->seating($this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 3000, 'roomName' => null], '"1"')));

        self::assertSame(200, $this->statusCode());
        self::assertSame(3000, $plan['widthCm']);
        self::assertSame(1800, $plan['lengthCm']);
        self::assertNull($plan['roomName']);
        self::assertSame('"2"', $this->client->getResponse()->headers->get('ETag'));
    }

    #[Test]
    public function aChangeWithoutTheVersionIsRefused(): void
    {
        $this->started();
        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 3000]);

        self::assertSame(428, $this->statusCode());
    }

    #[Test]
    public function aColleaguesChangeSinceIsRefusedNamingThemAndNothingIsSaved(): void
    {
        $this->started();
        $colleague = $this->member('tunde@ire.events', 'Tunde Bakare', SeededRole::Member, EventRole::CanEdit);
        $this->as($colleague, 'PATCH', $this->plan(), ['widthCm' => 3000], '"1"');
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 2000], '"1"');

        self::assertSame(412, $this->statusCode());
        self::assertSame('Tunde Bakare', $this->last()['changedBy'] ?? null);
        self::assertSame(3000, $this->planOf($this->seating($this->as($this->owner, 'GET', $this->plan())))['widthCm']);
    }

    #[Test]
    public function sectionsTakeTheLeastUsedColourAndMayShareOne(): void
    {
        $this->started();
        $this->as($this->owner, 'POST', $this->sections(), ['name' => 'Main hall']);
        $this->as($this->owner, 'POST', $this->sections(), ['name' => 'Terrace', 'colour' => 'blue']);
        self::assertSame(201, $this->statusCode());
        $seating = $this->seating($this->as($this->owner, 'POST', $this->sections(), ['name' => 'Balcony']));

        self::assertSame(
            [['Main hall', 'blue'], ['Terrace', 'blue'], ['Balcony', 'purple']],
            Vec\map($this->planOf($seating)['sections'], static fn (array $section): array => [$section['name'], $section['colour']]),
        );
        self::assertSame(3, $this->planOf($seating)['counts']['sections']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function refusedNames(): iterable
    {
        yield 'the same name' => ['Terrace', 'This plan already has a section called Terrace.'];
        yield 'another case' => ['TERRACE', 'This plan already has a section called Terrace.'];
        yield 'accents' => ['Terrâce', 'This plan already has a section called Terrace.'];
        yield 'blank' => ['   ', 'Enter a name for the section.'];
        yield 'too long' => [Str\repeat('a', 41), 'Use 40 characters or fewer.'];
    }

    #[Test]
    #[DataProvider('refusedNames')]
    public function aSectionNameMustBeGivenShortAndNewToThisPlan(string $name, string $message): void
    {
        $this->started();
        $this->as($this->owner, 'POST', $this->sections(), ['name' => 'Terrace']);

        $this->as($this->owner, 'POST', $this->sections(), ['name' => $name]);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation('name'));
    }

    #[Test]
    public function anotherEventsPlanMayUseTheSameName(): void
    {
        $this->started();
        $this->as($this->owner, 'POST', $this->sections(), ['name' => 'Terrace']);
        $other = $this->newEvent($this->owner, $this->organisation);
        $this->as($this->owner, 'POST', '/api/events/' . $other . '/seating-plan', ['widthCm' => 1000, 'lengthCm' => 1000]);

        $this->as($this->owner, 'POST', '/api/events/' . $other . '/seating-plan/sections', ['name' => 'Terrace']);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aThirtyFirstSectionIsRefused(): void
    {
        $this->started();

        foreach (Vec\range(1, 30) as $n) {
            $this->as($this->owner, 'POST', $this->sections(), ['name' => 'Section ' . $n]);
            self::assertSame(201, $this->statusCode());
        }

        $this->as($this->owner, 'POST', $this->sections(), ['name' => 'Section 31']);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/seating_section_limit', $this->last()['type'] ?? null);
    }

    #[Test]
    public function editRenamesAndRecoloursASectionAgainstItsVersion(): void
    {
        $this->started();
        $section = $this->addSection('Terrace');

        $seating = $this->seating($this->as($this->owner, 'PATCH', $this->sections() . '/' . $section['id'], ['name' => 'Garden', 'colour' => 'teal'], '"' . $section['version'] . '"'));

        self::assertSame(200, $this->statusCode());
        self::assertSame(['Garden', 'teal'], [$this->planOf($seating)['sections'][0]['name'], $this->planOf($seating)['sections'][0]['colour']]);
    }

    #[Test]
    public function aSectionKeepsItsOwnNameWhenOnlyItsCaseChanges(): void
    {
        $this->started();
        $section = $this->addSection('Terrace');

        $this->as($this->owner, 'PATCH', $this->sections() . '/' . $section['id'], ['name' => 'TERRACE'], '"' . $section['version'] . '"');

        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aColleaguesEditSinceIsRefusedNamingThem(): void
    {
        $this->started();
        $section = $this->addSection('Terrace');
        $colleague = $this->member('tunde@ire.events', 'Tunde Bakare', SeededRole::Member, EventRole::CanEdit);
        $this->as($colleague, 'PATCH', $this->sections() . '/' . $section['id'], ['colour' => 'wine'], '"' . $section['version'] . '"');

        $this->as($this->owner, 'PATCH', $this->sections() . '/' . $section['id'], ['name' => 'Garden'], '"' . $section['version'] . '"');

        self::assertSame(412, $this->statusCode());
        self::assertSame('Tunde Bakare', $this->last()['changedBy'] ?? null);
    }

    #[Test]
    public function addingASectionDoesNotRefuseAColleaguesRoomSettings(): void
    {
        $this->started();
        $this->addSection('Terrace');

        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 3000], '"1"');

        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function deletingASectionLeavesThePlan(): void
    {
        $this->started();
        $section = $this->addSection('Terrace');
        $this->addSection('Balcony');

        $seating = $this->seating($this->as($this->owner, 'DELETE', $this->sections() . '/' . $section['id']));

        self::assertSame(200, $this->statusCode());
        self::assertSame(['Balcony'], Vec\map($this->planOf($seating)['sections'], static fn (array $kept): string => $kept['name']));
        self::assertSame(1800, $this->planOf($seating)['lengthCm']);
    }

    #[Test]
    public function anotherEventsSectionIsNotFound(): void
    {
        $this->started();
        $section = $this->addSection('Terrace');
        $other = $this->newEvent($this->owner, $this->organisation);
        $this->as($this->owner, 'POST', '/api/events/' . $other . '/seating-plan', ['widthCm' => 1000, 'lengthCm' => 1000]);

        $this->as($this->owner, 'DELETE', '/api/events/' . $other . '/seating-plan/sections/' . $section['id']);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function deletingThePlanTakesItsSectionsAndLeavesTheEvent(): void
    {
        $this->started();
        $this->addSection('Terrace');

        $seating = $this->seating($this->as($this->owner, 'DELETE', $this->plan()));

        self::assertSame(200, $this->statusCode());
        self::assertNull($seating['plan']);
        self::assertSame(0, (int) self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM seating_sections'));
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aDuplicatedEventCopiesThePlanAndItsSections(): void
    {
        $this->started();
        $this->addSection('Terrace');

        $copy = Type\shape(['id' => Type\string()], true)->coerce($this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/duplicate', ['startsAt' => '2026-12-14T16:00'])['event'] ?? null)['id'];
        self::assertSame(201, $this->statusCode());

        $plan = $this->planOf($this->seating($this->as($this->owner, 'GET', '/api/events/' . $copy . '/seating-plan')));
        self::assertSame([2400, 1800, 'Main hall'], [$plan['widthCm'], $plan['lengthCm'], $plan['roomName']]);
        self::assertSame(['Terrace'], Vec\map($plan['sections'], static fn (array $section): string => $section['name']));
    }

    #[Test]
    public function everyChangeIsPublishedWholeOnTheEventsSeatingTopic(): void
    {
        $this->started();
        $this->addSection('Terrace');

        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');

        self::assertSame(['events/' . $this->eventId . '/seating'], $update->getTopics());
        self::assertTrue($update->isPrivate());
        $published = Type\shape(['plan' => Type\shape(['sections' => Type\vec(Type\shape(['name' => Type\string()], true))], true)], true)->coerce(Json\decode($update->getData()));
        self::assertSame('Terrace', $published['plan']['sections'][0]['name']);
    }

    #[Test]
    public function aViewerIsGivenThisEventsSeatingTopicAlone(): void
    {
        $viewer = $this->member('ada@ire.events', 'Ada Obi', SeededRole::Member, EventRole::CanView);

        $body = $this->as($viewer, 'POST', $this->plan() . '/subscriptions');

        self::assertSame(200, $this->statusCode());
        $token = new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($body['token'] ?? null));
        self::assertInstanceOf(UnencryptedToken::class, $token);
        self::assertSame(['subscribe' => ['events/' . $this->eventId . '/seating']], $token->claims()->get('mercure'));
    }

    /** @return iterable<string, array{EventRole}> */
    public static function readOnlyRoles(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('readOnlyRoles')]
    public function aReadOnlyRoleSeesThePlanButCannotChangeIt(EventRole $role): void
    {
        $this->started();
        $section = $this->addSection('Terrace');
        $viewer = $this->member('ada@ire.events', 'Ada Obi', SeededRole::Member, $role);

        $this->as($viewer, 'GET', $this->plan());
        self::assertSame(200, $this->statusCode());

        foreach ([
            ['PATCH', $this->plan(), ['widthCm' => 3000], '"1"'],
            ['DELETE', $this->plan(), null, null],
            ['POST', $this->sections(), ['name' => 'Balcony'], null],
            ['PATCH', $this->sections() . '/' . $section['id'], ['name' => 'Garden'], '"' . $section['version'] . '"'],
            ['DELETE', $this->sections() . '/' . $section['id'], null, null],
        ] as [$method, $path, $body, $ifMatch]) {
            $this->as($viewer, $method, $path, $body, $ifMatch);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(['Terrace'], Vec\map($this->planOf($this->seating($this->as($this->owner, 'GET', $this->plan())))['sections'], static fn (array $kept): string => $kept['name']));
    }

    #[Test]
    public function canEditChangesThePlan(): void
    {
        $editor = $this->member('tunde@ire.events', 'Tunde Bakare', SeededRole::Member, EventRole::CanEdit);

        $this->as($editor, 'POST', $this->plan(), ['widthCm' => 1000, 'lengthCm' => 1000]);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aMemberWithNoRoleOnTheEventIsRefused(): void
    {
        $member = $this->member('kemi@ire.events', 'Kemi Ade', SeededRole::Member, null);

        $this->as($member, 'GET', $this->plan());

        self::assertContains($this->statusCode(), [403, 404]);
        self::assertNotSame(200, $this->statusCode());
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $this->started();
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'GET', $this->plan());

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aPlanAbsentLeavesTheEventAsItWas(): void
    {
        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 3000], '"1"');
        self::assertSame(404, $this->statusCode());

        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        self::assertSame(200, $this->statusCode());
    }

    private function started(): void
    {
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    /** @return array{id: string, version: int} */
    private function addSection(string $name): array
    {
        $sections = $this->planOf($this->seating($this->as($this->owner, 'POST', $this->sections(), ['name' => $name])))['sections'];
        self::assertSame(201, $this->statusCode());
        $added = Iter\last($sections) ?? self::fail('no section');

        return ['id' => Type\string()->coerce($added['id']), 'version' => Type\int()->coerce($added['version'])];
    }

    private function newEvent(User $by, Organisation $organisation): string
    {
        $body = $this->as($by, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function sections(): string
    {
        return $this->plan() . '/sections';
    }

    /** @return array<string, mixed> */
    private function seating(mixed $body): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Type\dict(Type\string(), Type\mixed())->coerce($body)['seating'] ?? null);
    }

    /** @return array{roomName: ?string, widthCm: int, lengthCm: int, sections: list<array<string, mixed>>, counts: array<string, int>, ...} */
    private function planOf(mixed $seating): array
    {
        return Type\shape([
            'roomName' => Type\nullable(Type\string()),
            'widthCm' => Type\int(),
            'lengthCm' => Type\int(),
            'sections' => Type\vec(Type\dict(Type\string(), Type\mixed())),
            'counts' => Type\dict(Type\string(), Type\int()),
        ], true)->coerce(Type\dict(Type\string(), Type\mixed())->coerce($seating)['plan'] ?? null);
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        foreach ($violations as $violation) {
            if ($violation['propertyPath'] === $path) {
                return $violation['message'];
            }
        }

        return null;
    }

    private function account(string $address, string $name = 'Person'): User
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
