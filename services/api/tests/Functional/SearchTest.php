<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Locale\NameNormaliser;
use App\Tests\ApiTestCase;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** The sidebar's Search (sc-39534): events, guests and members, each only where the caller's role may open them. */
final class SearchTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events', 'Folake Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function anOwnerFindsEventsByNameOrVenueWhateverTheirCaseAndAccents(): void
    {
        $this->create('Gala Fundación Lucía', '2026-11-14T16:00');
        $atTheVenue = $this->create('Owambe', '2026-11-21T16:00');
        $this->create('Ireti at 40', '2026-11-28T16:00');
        self::em()->getConnection()->executeStatement("UPDATE events SET venue_name = 'Casa LUCIA' WHERE id = :id", ['id' => $atTheVenue]);

        $found = $this->found($this->owner, 'lucia');

        self::assertSame(['total' => 2, 'names' => ['Gala Fundación Lucía', 'Owambe']], self::names($found['events']));
    }

    #[Test]
    public function namesThatBeginWithTheTermComeFirstThenTheRestEachAlphabetical(): void
    {
        foreach (['The Quinta lunch', 'Quintas de fado', 'A quinta wedding', 'Quinta do Crasto'] as $at => $name) {
            $this->create($name, '2026-11-1' . $at . 'T16:00');
        }

        self::assertSame(['Quinta do Crasto', 'Quintas de fado', 'A quinta wedding', 'The Quinta lunch'], self::names($this->found($this->owner, 'quinta')['events'])['names']);
    }

    #[Test]
    public function eachKindListsFiveAndCountsEveryMatch(): void
    {
        foreach (Vec\range(1, 7) as $at) {
            $this->create('Quinta ' . $at, '2026-11-1' . $at . 'T16:00');
        }

        $events = self::names($this->found($this->owner, 'quinta')['events']);

        self::assertSame(7, $events['total']);
        self::assertSame(['Quinta 1', 'Quinta 2', 'Quinta 3', 'Quinta 4', 'Quinta 5'], $events['names']);
    }

    #[Test]
    public function aGuestIsFoundOnEveryEventTheyAreOnWithTheEventAndNoContactDetails(): void
    {
        $wedding = $this->create('Adaeze & Tunde’s wedding', '2026-11-05T16:00');
        $gala = $this->create('Gala', '2026-11-14T16:00');
        $this->guest($wedding, 'Inês Duarte');
        $this->guest($gala, 'Inês Duarte');
        $this->guest($gala, 'Agnes Inesi');
        $this->guest($gala, 'Kwame Mensah');

        $guests = $this->found($this->owner, 'ines')['guests'];
        $matches = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($guests['matches'] ?? null);

        self::assertSame(3, $guests['total'] ?? null);
        self::assertSame(['Inês Duarte', 'Inês Duarte', 'Agnes Inesi'], Vec\map($matches, static fn (array $one): mixed => $one['name']));
        self::assertSame(['Adaeze & Tunde’s wedding', 'Gala'], Vec\map(Vec\slice($matches, 0, 2), static fn (array $one): mixed => Type\shape(['name' => Type\string()], true)->coerce($one['event'])['name']));
        self::assertSame(['id', 'name', 'event'], Vec\keys($matches[0]));
        self::assertSame(['id', 'name', 'startsAt', 'timeZone'], Vec\keys(Type\dict(Type\string(), Type\mixed())->coerce($matches[0]['event'])));
    }

    #[Test]
    public function aGuestTakenOffTheListIsNotFound(): void
    {
        $gala = $this->create('Gala', '2026-11-14T16:00');
        $guest = $this->guest($gala, 'Inês Duarte');
        self::em()->getConnection()->executeStatement('UPDATE guests SET removed_at = NOW() WHERE id = :id', ['id' => $guest]);

        self::assertSame(['total' => 0, 'matches' => []], $this->found($this->owner, 'ines')['guests']);
    }

    #[Test]
    public function aMemberFindsOnlyTheEventsAndGuestsTheyHaveARoleOnAndNoMembers(): void
    {
        $theirs = $this->create('Gala Lucía', '2026-11-14T16:00');
        $other = $this->create('Cena Lucía', '2026-11-21T16:00');
        $this->guest($theirs, 'Lucía Ortega');
        $this->guest($other, 'Lucía Ramos');
        $member = $this->member('kemi@ire.events', 'Kemi Adebayo', SeededRole::Member);
        self::onEvent($member, $theirs, EventRole::CanView);

        $found = $this->found($member, 'lucia');

        self::assertSame(['total' => 1, 'names' => ['Gala Lucía']], self::names($found['events']));
        self::assertSame(['total' => 1, 'names' => ['Lucía Ortega']], self::names($found['guests']));
        self::assertNull($found['members']);
        self::assertSame(['events' => true, 'guests' => true, 'members' => false], $this->reach($member));
    }

    #[Test]
    public function aMemberOnNoEventMayFindNothing(): void
    {
        $this->create('Gala Lucía', '2026-11-14T16:00');
        $member = $this->member('kemi@ire.events', 'Kemi Adebayo', SeededRole::Member);

        self::assertSame(['events' => false, 'guests' => false, 'members' => false], $this->reach($member));
        self::assertSame(['events' => null, 'guests' => null, 'members' => null], $this->found($member, 'lucia'));
    }

    #[Test]
    public function membersAreFoundByNameOrEmailWithTheirRoleAndStanding(): void
    {
        $this->member('ines.santos@ire.events', 'Inês Santos', SeededRole::Admin);
        $this->member('ines.s@example.com', 'Inês Santos', SeededRole::Member, MembershipStatus::Suspended);
        $this->member('julien@ire.events', 'Julien Moreau', SeededRole::Admin);
        $this->member('agnes@ire.events', 'Agnes Inesi', SeededRole::Member, MembershipStatus::LeftOrRemoved);
        $this->invite('ines.moura@example.com');

        $members = $this->found($this->owner, 'ines')['members'];
        $matches = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($members['matches'] ?? null);

        self::assertSame(3, $members['total'] ?? null);
        self::assertSame(
            [['Inês Santos', 'active', 'administrator'], ['Inês Santos', 'suspended', 'member'], ['ines.moura@example.com', 'invited', 'member']],
            Vec\map($matches, static fn (array $one): array => [$one['name'] ?? $one['email'], $one['status'], Type\shape(['seededAs' => Type\string()], true)->coerce($one['role'])['seededAs']]),
        );
        self::assertSame(['Julien Moreau'], self::names($this->found($this->owner, 'julien@ire')['members'])['names']);
    }

    #[Test]
    public function theAppAsksWithoutInvitationsAndCountsNone(): void
    {
        $this->member('ines.santos@ire.events', 'Inês Santos', SeededRole::Admin);
        $this->invite('ines.moura@example.com');
        $this->invite('moura.family@example.com');

        self::assertSame(['total' => 1, 'names' => ['Inês Santos']], self::names($this->found($this->owner, 'ines', invitations: false)['members']));
        self::assertSame(['total' => 0, 'matches' => []], $this->found($this->owner, 'moura', invitations: false)['members']);
        self::assertSame(2, self::names($this->found($this->owner, 'moura')['members'])['total']);
    }

    #[Test]
    public function somebodyAwaitingApprovalWhoWasNeverAMemberIsFoundOnlyByThoseWhoDecide(): void
    {
        $this->member('ines.rocha@example.com', 'Inês Rocha', SeededRole::Member, MembershipStatus::PendingApproval, joined: false);
        $admin = $this->member('julien@ire.events', 'Julien Moreau', SeededRole::Admin);

        self::assertSame(['Inês Rocha'], self::names($this->found($this->owner, 'rocha')['members'])['names']);
        self::assertSame(['Inês Rocha'], self::names($this->found($admin, 'rocha')['members'])['names']);

        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MembersManage);

        self::assertSame(['total' => 0, 'matches' => []], $this->found($admin, 'rocha')['members']);
        self::assertSame(['Julien Moreau'], self::names($this->found($admin, 'julien')['members'])['names']);
    }

    #[Test]
    public function somebodyWhoMayOpenAnEventButNotItsGuestsFindsTheEventAndNoGuests(): void
    {
        $gala = $this->create('Gala Lucía', '2026-11-14T16:00');
        $this->guest($gala, 'Lucía Ortega');
        $member = $this->member('kemi@ire.events', 'Kemi Adebayo', SeededRole::Member);
        self::onEvent($member, $gala, EventRole::CanView);
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::GuestsRead);

        $found = $this->found($member, 'lucia');

        self::assertSame(['total' => 1, 'names' => ['Gala Lucía']], self::names($found['events']));
        self::assertNull($found['guests']);
        self::assertSame(['events' => true, 'guests' => false, 'members' => false], $this->reach($member));
    }

    #[Test]
    public function anotherOrganisationsEventsGuestsAndMembersAreNeverFound(): void
    {
        $elsewhere = $this->account('other@example.com', 'Lucía Other');
        $theirs = self::service(OrganisationFounder::class)->found($elsewhere, 'Other Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->as($elsewhere, 'POST', '/api/orgs/' . $theirs->getId()->toRfc4122() . '/events', [...self::valid(), 'name' => 'Lucía elsewhere']);
        self::assertSame(201, $this->statusCode());

        self::assertSame(['events' => ['total' => 0, 'matches' => []], 'guests' => ['total' => 0, 'matches' => []], 'members' => ['total' => 0, 'matches' => []]], $this->found($this->owner, 'lucia'));
    }

    #[Test]
    public function anOutsiderIsRefused(): void
    {
        $outsider = $this->account('outsider@example.com', 'Out Sider');

        $this->as($outsider, 'GET', $this->path('search?q=lucia'));
        self::assertSame(404, $this->statusCode());
        $this->as($outsider, 'GET', $this->path('search/reach'));
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aTermUnderTwoCharactersFindsNothingAndItsWildcardsAreLetters(): void
    {
        $this->create('Owambe', '2026-11-14T16:00');
        $this->create('100% Owambe', '2026-11-21T16:00');

        self::assertSame(['total' => 0, 'matches' => []], $this->found($this->owner, ' o ')['events']);
        self::assertSame(['100% Owambe'], self::names($this->found($this->owner, '0%')['events'])['names']);
    }

    /** @return array{events: mixed, guests: mixed, members: mixed} */
    private function found(User $user, string $term, bool $invitations = true): array
    {
        $body = $this->as($user, 'GET', $this->path('search?q=' . \rawurlencode($term) . ($invitations ? '' : '&invitations=false')));
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\shape(['events' => Type\mixed(), 'guests' => Type\mixed(), 'members' => Type\mixed()])->coerce($body);
    }

    /** @return array<string, mixed> */
    private function reach(User $user): array
    {
        $body = $this->as($user, 'GET', $this->path('search/reach'));
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return $body;
    }

    /** @return array{total: int, names: list<string>} */
    private static function names(mixed $kind): array
    {
        $kind = Type\shape(['total' => Type\int(), 'matches' => Type\vec(Type\shape(['name' => Type\nullable(Type\string()), 'email' => Type\optional(Type\nullable(Type\string()))], true))])->coerce($kind);

        return ['total' => $kind['total'], 'names' => Vec\map($kind['matches'], static fn (array $one): string => $one['name'] ?? $one['email'] ?? '')];
    }

    /** @return array<string, string> */
    private static function valid(): array
    {
        return ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2026-11-14T16:00', 'endsAt' => '2026-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN'];
    }

    private function create(string $name, string $startsAt): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'name' => $name, 'startsAt' => $startsAt, 'endsAt' => $startsAt]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['event' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['event']['id'];
    }

    private function guest(string $eventId, string $name): string
    {
        $event = self::em()->find(Event::class, $eventId) ?? self::fail('no event');
        $guest = Guest::listed($event, $name, NameNormaliser::key($name), Str\lowercase(Str\replace($name, ' ', '.')) . '@example.com', '+2348012345678', null, SecureRandom\string(32), SecureRandom\string(32));
        self::em()->persist($guest);
        self::em()->flush();

        return $guest->getId()->toRfc4122();
    }

    private function invite(string $address): void
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $owner = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        self::em()->persist(new Invitation($organisation, $address, $this->role(SeededRole::Member), $owner, SecureRandom\string(32), new DateTimeImmutable('+7 days')));
        self::em()->flush();
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded, MembershipStatus $status = MembershipStatus::Active, bool $joined = true): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $membership = new Membership($organisation, $user, $this->role($seeded), $joined ? MembershipStatus::Active : $status, new DateTimeImmutable());
        self::em()->persist($membership);
        self::em()->flush();

        if ($joined && MembershipStatus::Active !== $status) {
            self::em()->getConnection()->executeStatement('UPDATE memberships SET status = :status WHERE id = :id', ['status' => $status->value, 'id' => $membership->getId()->toRfc4122()]);
            self::em()->refresh($membership);
        }

        return $user;
    }

    private function role(SeededRole $seeded): Role
    {
        return Type\instance_of(Role::class)->coerce(self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]));
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/' . $rest;
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
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
