<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestAdder;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
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

final class GuestsTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

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
    public function anEventStartsWithNobody(): void
    {
        $list = $this->as($this->owner, 'GET', $this->guests());

        self::assertSame(200, $this->statusCode());
        self::assertSame(['guests' => [], 'counts' => ['people' => 0, 'guests' => 0, 'companions' => 0]], $list);
    }

    #[Test]
    public function aGuestIsKeptAsTypedWithNoReplyAndTheirCompanionsUnderThem(): void
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), [
            'fullName' => '  ' . self::ADAEZE . ' ',
            'email' => ' adaeze@example.com ',
            'mobile' => ['countryCode' => 'NG', 'number' => '0803 123 4567'],
            'companions' => [['fullName' => 'Obi Okonkwo'], ['fullName' => '  '], []],
        ]);

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $guest = Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
        self::assertSame([self::ADAEZE, 'adaeze@example.com', '+2348031234567', 'noReply'], [$guest['fullName'], $guest['email'], $guest['mobile'], $guest['reply']]);
        self::assertSame(
            [['Obi Okonkwo', 'held'], [null, 'held'], [null, 'held']],
            Vec\map(Type\vec(Type\shape(['fullName' => Type\nullable(Type\string()), 'state' => Type\string()], true))->coerce($guest['companions']), static fn (array $companion): array => [$companion['fullName'], $companion['state']]),
        );

        $list = $this->as($this->owner, 'GET', $this->guests());
        self::assertSame(['people' => 4, 'guests' => 1, 'companions' => 3], $list['counts'] ?? null);
        self::assertSame([$guest], $list['guests'] ?? null);
    }

    #[Test]
    public function onlyTheNameIsNeeded(): void
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Bisi', 'email' => '', 'mobile' => ['countryCode' => 'NG', 'number' => ' ']]);

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $guest = Type\shape(['email' => Type\nullable(Type\string()), 'mobile' => Type\nullable(Type\string()), 'companions' => Type\vec(Type\mixed())], true)->coerce($body['guest'] ?? null);
        self::assertSame([null, null, []], [$guest['email'], $guest['mobile'], $guest['companions']]);
    }

    /** @return iterable<string, array{array<string, mixed>, array<string, string>}> */
    public static function refusals(): iterable
    {
        yield 'a blank name' => [['fullName' => '   '], ['fullName' => 'Enter their full name.']];
        yield 'a name too long' => [['fullName' => Str\repeat('a', 201)], ['fullName' => 'Shorten the name to 200 characters or fewer.']];
        yield 'not an email address' => [['fullName' => 'Bisi', 'email' => 'bisi.example.com'], ['email' => 'That does not look like an email address. Check it has an @ and a domain.']];
        yield 'a number too short' => [['fullName' => 'Bisi', 'mobile' => ['countryCode' => 'NG', 'number' => '0803']], ['mobile' => 'That number looks too short for Nigeria. Check it and try again.']];
        yield 'a companion named too long' => [['fullName' => 'Bisi', 'companions' => [['fullName' => 'Obi'], ['fullName' => Str\repeat('b', 201)]]], ['companions[1].fullName' => 'Shorten the name to 200 characters or fewer.']];
        yield 'eleven companions' => [['fullName' => 'Bisi', 'companions' => Vec\fill(11, [])], ['companions' => '10 companions is the most one guest can bring.']];
        yield 'everything at once' => [['fullName' => '', 'email' => 'nope', 'mobile' => ['countryCode' => 'NG', 'number' => '0803']], [
            'fullName' => 'Enter their full name.',
            'email' => 'That does not look like an email address. Check it has an @ and a domain.',
            'mobile' => 'That number looks too short for Nigeria. Check it and try again.',
        ]];
    }

    /**
     * @param array<string, mixed>  $guest
     * @param array<string, string> $expected
     */
    #[Test]
    #[DataProvider('refusals')]
    public function aGuestThatIsNotOneAddsNothing(array $guest, array $expected): void
    {
        $this->as($this->owner, 'POST', $this->guests(), $guest);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($expected, $this->violations());
        self::assertSame(0, $this->people());
    }

    #[Test]
    public function aNameAlreadyOnTheListIsAskedAboutAndAddedOnlyWhenTheHostSaysSo(): void
    {
        $this->add(['fullName' => 'Adaeze Okonkwo']);

        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'ADAÉZÉ  okonkwo', 'companions' => [[]]]);
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/guest_already_listed', $this->last()['type'] ?? null);
        self::assertSame('ADAÉZÉ  okonkwo is already on the list', $this->last()['detail'] ?? null);
        self::assertSame(1, $this->people());

        $this->add(['fullName' => 'ADAÉZÉ  okonkwo', 'companions' => [[]], 'allowDuplicate' => true]);
        self::assertSame(['people' => 3, 'guests' => 2, 'companions' => 1], $this->as($this->owner, 'GET', $this->guests())['counts'] ?? null);
    }

    #[Test]
    public function aCompanionsNameIsNotAGuestsAlreadyOnTheList(): void
    {
        $this->add(['fullName' => 'Bisi', 'companions' => [['fullName' => 'Tunde Bakare']]]);

        $this->add(['fullName' => 'Tunde Bakare']);

        self::assertSame(3, $this->people());
    }

    #[Test]
    public function everyAddIsAuditedWithWhoAndWhenAndNoNameOrContact(): void
    {
        $guest = $this->add(['fullName' => 'Bisi Adewale', 'email' => 'bisi@example.com', 'mobile' => ['countryCode' => 'NG', 'number' => '08031234567'], 'companions' => [['fullName' => 'Tunde Adewale']]]);

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestAdder::ADDED]);
        self::assertCount(2, $entries);
        self::assertContains($guest['id'], Vec\map($entries, static fn (AuditEntry $entry): string => $entry->getSubjectId()->toRfc4122()));
        foreach ($entries as $entry) {
            self::assertSame($this->owner->getId()->toRfc4122(), $entry->getActorId()?->toRfc4122());
            self::assertSame([], $entry->getChanges());
        }
    }

    #[Test]
    public function eachAddIsPublishedAsTheWholeList(): void
    {
        $this->add(['fullName' => 'Bisi']);

        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/guests'], $update->getTopics());
        self::assertTrue($update->isPrivate());
        self::assertSame($this->as($this->owner, 'GET', $this->guests()), Json\decode($update->getData()));
    }

    #[Test]
    public function aSubscriptionNamesThisEventsListAlone(): void
    {
        $body = $this->as($this->owner, 'POST', $this->guests() . '/subscriptions');

        self::assertSame(200, $this->statusCode());
        $token = new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($body['token'] ?? null));
        self::assertInstanceOf(UnencryptedToken::class, $token);
        self::assertSame(['subscribe' => ['events/' . $this->eventId . '/guests']], $token->claims()->get('mercure'));
    }

    /** @return iterable<string, array{EventRole}> */
    public static function rolesThatCannotAdd(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('rolesThatCannotAdd')]
    public function onlyGuestsManageAdds(EventRole $role): void
    {
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        $this->as($viewer, 'POST', $this->guests(), ['fullName' => 'Bisi']);

        self::assertSame(403, $this->statusCode());
        self::assertSame(0, $this->people());
    }

    #[Test]
    public function anotherOrganisationsEventAndOneThatDoesNotExistAreTheSameNotFound(): void
    {
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $answers = [];
        foreach ([$this->guests(), '/api/events/0193f5a8-0000-7000-8000-000000000000/guests'] as $path) {
            foreach (['GET' => null, 'POST' => ['fullName' => 'Bisi']] as $method => $body) {
                $this->as($stranger, $method, $path, $body);
                $answers[] = [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];
            }
        }

        self::assertSame(404, $answers[0][0]);
        self::assertSame([$answers[0], $answers[0], $answers[0], $answers[0]], $answers);
        self::assertSame(0, $this->people());
    }

    /**
     * @param array<string, mixed> $guest
     *
     * @return array<string, mixed>
     */
    private function add(array $guest): array
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), $guest);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
    }

    private function people(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM guests'));
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

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    /** @return array<string, string> */
    private function violations(): array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);
        $byPath = [];

        foreach ($violations as $violation) {
            $byPath[$violation['propertyPath']] = $violation['message'];
        }

        return $byPath;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, ?EventRole $on): User
    {
        $user = $this->account($address);
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
    private function as(User $user, string $method, string $path, ?array $body = null): array
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
