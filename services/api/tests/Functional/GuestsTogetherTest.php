<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\Controller\GuestsTogetherController;
use App\Domain\Guest\Group\GuestGroupMoves;
use App\Domain\Guest\Invitation\GuestInvitations;
use App\Domain\Guest\Removal\GuestRemovals;
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
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Uid\Uuid;

/** sc-3776 and sc-46880: one action on many selected guests, with what it did to each in its answer. */
final class GuestsTogetherTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string EVENT = "Amara & Tobi's wedding";

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-17T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live(self::EVENT);
    }

    #[Test]
    public function addToGroupMovesEverySelectedGuestAndSaysWhoWasAlreadyThereAndWhoWasGone(): void
    {
        $bride = $this->group("Bride's side");
        $sophie = $this->add('Sophie Laurent', ['Marc Laurent']);
        $tomas = $this->add('Tomás Ruiz');
        $emeka = $this->add('Emeka Obi');
        $this->as($this->owner, 'POST', $this->guests() . '/group-moves', ['guestIds' => [$emeka], 'group' => ['id' => $bride]]);
        $joaquin = $this->add('Joaquín Peña');
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $joaquin);
        $untouched = $this->add('Bisi Adewale');

        $moved = $this->as($this->owner, 'POST', $this->guests() . '/group-moves', ['guestIds' => [$sophie, $tomas, $emeka, $joaquin], 'group' => ['id' => $bride]]);

        self::assertSame(200, $this->statusCode(), Json\encode($moved));
        self::assertSame(['group' => ['id' => $bride, 'name' => "Bride's side"], 'moved' => 2, 'already' => 1, 'gone' => 1], $moved);
        self::assertSame([$bride, $bride, $bride, null], Vec\map([$sophie, $tomas, $emeka, $untouched], $this->groupOf(...)));
    }

    #[Test]
    public function addToGroupWritesOneAuditEntryNamingTheActionAndTheCount(): void
    {
        $bride = $this->group("Bride's side");
        $ids = [$this->add('Sophie Laurent'), $this->add('Tomás Ruiz'), $this->add('Emeka Obi')];

        $this->as($this->owner, 'POST', $this->guests() . '/group-moves', ['guestIds' => $ids, 'group' => ['id' => $bride]]);

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestGroupMoves::MOVED]);
        self::assertCount(1, $entries);
        self::assertSame(['GuestGroup', $bride, ['guests' => [null, 3]]], [$entries[0]->getSubjectType(), $entries[0]->getSubjectId()->toRfc4122(), $entries[0]->getChanges()]);
    }

    #[Test]
    public function aNewGroupNamedInTheSheetIsMadeAndTakesThemAll(): void
    {
        $ids = [$this->add('Sophie Laurent'), $this->add('Tomás Ruiz')];

        $moved = $this->as($this->owner, 'POST', $this->guests() . '/group-moves', ['guestIds' => $ids, 'group' => ['name' => '  Cousins ']]);

        self::assertSame(200, $this->statusCode(), Json\encode($moved));
        $group = Type\shape(['id' => Type\string(), 'name' => Type\string()])->coerce($moved['group'] ?? null);
        self::assertSame('Cousins', $group['name']);
        self::assertSame([$group['id'], $group['id']], Vec\map($ids, $this->groupOf(...)));
    }

    #[Test]
    public function aBlankNewGroupIsRefusedAndMovesNobody(): void
    {
        $guest = $this->add('Sophie Laurent');

        $this->as($this->owner, 'POST', $this->guests() . '/group-moves', ['guestIds' => [$guest], 'group' => ['name' => '   ']]);

        self::assertSame(422, $this->statusCode());
        self::assertNull($this->groupOf($guest));
    }

    #[Test]
    public function removeTakesEverySelectedGuestAndTheirCompanionsAndSaysWhoWasGone(): void
    {
        $sophie = $this->add('Sophie Laurent', ['Marc Laurent', null]);
        $tomas = $this->add('Tomás Ruiz');
        $joaquin = $this->add('Joaquín Peña');
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $joaquin);
        $this->add('Bisi Adewale');

        $removed = $this->as($this->owner, 'POST', $this->guests() . '/removals', ['guestIds' => [$sophie, $tomas, $joaquin]]);

        self::assertSame(200, $this->statusCode(), Json\encode($removed));
        self::assertSame([2, 2, 1], [$removed['guests'] ?? null, $removed['companions'] ?? null, $removed['gone'] ?? null]);
        self::assertTrue(Uuid::isValid(Type\string()->coerce($removed['removal'] ?? null)));
        self::assertSame(['Bisi Adewale'], $this->names());
        self::assertSame(1, $this->counts()['onList']);
    }

    #[Test]
    public function oneUndoPutsTheWholeRemovalBackAsItWas(): void
    {
        $ids = [$this->add('Sophie Laurent', ['Marc Laurent']), $this->add('Tomás Ruiz')];
        $this->add('Bisi Adewale');
        $before = $this->as($this->owner, 'GET', $this->guests());
        $counts = $this->counts();
        $removal = $this->removal($ids);

        $undone = $this->as($this->owner, 'DELETE', $this->guests() . '/removals/' . $removal);

        self::assertSame([200, ['guests' => 2]], [$this->statusCode(), $undone]);
        self::assertSame($before, $this->as($this->owner, 'GET', $this->guests()));
        self::assertSame($counts, $this->counts());
        $this->as($this->owner, 'DELETE', $this->guests() . '/removals/' . $removal);
        self::assertSame(404, $this->statusCode(), 'an undone removal has nothing left to undo');
    }

    #[Test]
    public function theErasureWritesOneAuditEntryWithTheCountsAndNoNames(): void
    {
        $removal = $this->removal([$this->add('Sophie Laurent', ['Marc Laurent']), $this->add('Tomás Ruiz'), $this->add('Emeka Obi')]);

        $this->as($this->owner, 'POST', $this->guests() . '/removals/' . $removal . '/erasure');

        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();
        self::assertSame(0, $this->people());
        self::assertSame([], self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestRemovals::REMOVED]));
        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestRemovals::REMOVED_TOGETHER]);
        self::assertCount(1, $entries);
        self::assertSame(['Event', $this->eventId, ['guests' => [null, 3], 'companions' => [null, 1]]], [$entries[0]->getSubjectType(), $entries[0]->getSubjectId()->toRfc4122(), $entries[0]->getChanges()]);
        $this->as($this->owner, 'DELETE', $this->guests() . '/removals/' . $removal);
        self::assertSame(404, $this->statusCode(), 'nothing is left to undo once erased');
    }

    #[Test]
    public function aLapsedRemovalIsErasedWholeByThePruneWithOneEntry(): void
    {
        $this->removal([$this->add('Sophie Laurent', ['Marc Laurent']), $this->add('Tomás Ruiz')]);
        self::mockTime(new DateTimeImmutable('2026-10-17T13:36:00+00:00'));

        self::assertSame(2, self::service(GuestRemovals::class)->eraseLapsed());

        self::em()->clear();
        self::assertSame(0, $this->people());
        self::assertCount(1, self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestRemovals::REMOVED_TOGETHER]));
        self::assertSame([], self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestRemovals::REMOVED]));
    }

    #[Test]
    public function markAsInvitedMarksEveryoneNotYetInvitedAndKeepsWhoWasInvitedAndSaysWhoWasGone(): void
    {
        $sophie = $this->add('Sophie Laurent', ['Marc Laurent']);
        $tomas = $this->add('Tomás Ruiz');
        $emeka = $this->add('Emeka Obi');
        $this->as($this->owner, 'PUT', $this->guests() . '/' . $emeka . '/invitation', ['how' => 'email']);
        $joaquin = $this->add('Joaquín Peña');
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $joaquin);
        $untouched = $this->add('Bisi Adewale');

        $marked = $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => [$sophie, $tomas, $emeka, $joaquin], 'how' => 'whatsapp']);

        self::assertSame(200, $this->statusCode(), Json\encode($marked));
        self::assertSame(['marked' => 2, 'already' => 1, 'gone' => 1], $marked);
        $invited = ['at' => '2026-10-17T14:20:00+01:00', 'how' => 'whatsapp', 'by' => 'Person'];
        self::assertSame([$invited, $invited, ['at' => '2026-10-17T14:20:00+01:00', 'how' => 'email', 'by' => 'Person'], null], Vec\map([$sophie, $tomas, $emeka, $untouched], $this->invitationOf(...)));
        self::assertSame([5, 1, 4], [$this->counts()['onList'], $this->counts()['notYetInvited'], $this->counts()['invited']]);
    }

    #[Test]
    public function markAsInvitedWritesOneAuditEntryNamingHowAndTheCount(): void
    {
        $ids = [$this->add('Sophie Laurent', ['Marc Laurent']), $this->add('Tomás Ruiz'), $this->add('Emeka Obi')];

        $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => $ids, 'how' => 'inPerson']);

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestInvitations::MARKED_TOGETHER]);
        self::assertCount(1, $entries);
        self::assertSame(['Event', $this->eventId, ['how' => [null, 'inPerson'], 'guests' => [null, 3]]], [$entries[0]->getSubjectType(), $entries[0]->getSubjectId()->toRfc4122(), $entries[0]->getChanges()]);
    }

    #[Test]
    public function aCompanionIsNeverMarkedOrCountedThemselves(): void
    {
        $guest = $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Sophie Laurent', 'companions' => [['fullName' => 'Marc Laurent']]]);
        $companion = Type\shape(['guest' => Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string()], true))], true)], true)->coerce($guest)['guest']['companions'][0]['id'];

        $marked = $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => [$companion], 'how' => 'whatsapp']);

        self::assertSame(['marked' => 0, 'already' => 0, 'gone' => 1], $marked);
        self::assertSame(2, $this->counts()['notYetInvited']);
    }

    #[Test]
    public function whenEveryoneSelectedIsAlreadyInvitedNothingIsMarkedOrAudited(): void
    {
        $ids = [$this->add('Sophie Laurent'), $this->add('Tomás Ruiz')];
        $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => $ids, 'how' => 'email']);

        $marked = $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => $ids, 'how' => 'whatsapp']);

        self::assertSame(['marked' => 0, 'already' => 2, 'gone' => 0], $marked);
        self::assertSame(['email', 'email'], Vec\map($ids, fn (string $id): mixed => $this->invitationOf($id)['how'] ?? null));
        self::assertCount(1, self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestInvitations::MARKED_TOGETHER]));
    }

    /** @return iterable<string, array{?string}> */
    public static function howsNotByHand(): iterable
    {
        yield 'none' => [null];
        yield 'blank' => [''];
        yield "Soirely's message" => ['soirelyMessage'];
        yield 'a reply' => ['reply'];
        yield 'unknown' => ['pigeon'];
    }

    #[Test]
    #[DataProvider('howsNotByHand')]
    public function aHowThatIsNotOneOfTheFiveIsRefusedAndMarksNobody(?string $how): void
    {
        $guest = $this->add('Sophie Laurent');

        $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => [$guest], 'how' => $how]);

        self::assertSame([422, ErrorCode::ValidationFailed->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertNull($this->invitationOf($guest));
    }

    /** @return iterable<string, array{string, string}> */
    public static function phasesThatCannotInvite(): iterable
    {
        yield 'Paused' => ['/pause', 'paused'];
        yield 'Finished' => ['/end', 'finished'];
    }

    #[Test]
    #[DataProvider('phasesThatCannotInvite')]
    public function aPhaseThatDoesNotAllowInviteRefusesAndMarksNobody(string $action, string $phase): void
    {
        $guest = $this->add('Sophie Laurent');
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . $action);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => [$guest], 'how' => 'whatsapp']);

        self::assertSame([409, ErrorCode::EventStateInvalid->type(), $phase], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['phase'] ?? null]);
        self::assertNull($this->invitationOf($guest));
    }

    #[Test]
    public function aDraftRefusesAndMarksNobody(): void
    {
        $this->eventId = $this->draft('Draft party');
        $guest = $this->add('Sophie Laurent');

        $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => [$guest], 'how' => 'whatsapp']);

        self::assertSame([409, 'draft'], [$this->statusCode(), $this->last()['phase'] ?? null]);
        self::assertNull($this->invitationOf($guest));
    }

    #[Test]
    public function aCompanionIsNotOneToActOnByThemselves(): void
    {
        $guest = $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Sophie Laurent', 'companions' => [['fullName' => 'Marc Laurent']]]);
        $companion = Type\shape(['guest' => Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string()], true))], true)], true)->coerce($guest)['guest']['companions'][0]['id'];

        $removed = $this->as($this->owner, 'POST', $this->guests() . '/removals', ['guestIds' => [$companion]]);

        self::assertSame(['removal' => null, 'guests' => 0, 'companions' => 0, 'gone' => 1], $removed);
        self::assertSame(2, $this->counts()['onList']);
    }

    #[Test]
    public function moreThanTwoThousandAtOnceIsRefusedAndChangesNothing(): void
    {
        $guest = $this->add('Sophie Laurent');
        $ids = [$guest, ...Vec\map(Vec\range(1, 2000), static fn (int $at): string => Uuid::v4()->toRfc4122())];

        $this->as($this->owner, 'POST', $this->guests() . '/removals', ['guestIds' => $ids]);
        self::assertSame(422, $this->statusCode());
        $this->as($this->owner, 'POST', $this->guests() . '/group-moves', ['guestIds' => $ids, 'group' => ['name' => 'Cousins']]);
        self::assertSame(422, $this->statusCode());
        $this->as($this->owner, 'POST', $this->guests() . '/invitations', ['guestIds' => $ids, 'how' => 'whatsapp']);
        self::assertSame(422, $this->statusCode());

        self::assertSame(['Sophie Laurent'], $this->names());
        self::assertNull($this->groupOf($guest));
        self::assertNull($this->invitationOf($guest));
    }

    #[Test]
    public function theTooManyRefusalGivesItsLimitAsTheMostSlot(): void
    {
        $ids = Vec\map(Vec\range(0, GuestsTogetherController::MOST_AT_ONCE), static fn (int $at): string => Uuid::v4()->toRfc4122());
        $request = Request::create('/', 'POST', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['guestIds' => $ids]));

        try {
            self::service(GuestsTogetherController::class)->remove($request, $this->eventId);
            self::fail('2,001 guests were acted on at once');
        } catch (ApiException $e) {
            self::assertSame(
                [['propertyPath' => 'guestIds', 'message' => 'validation.guests_too_many', 'code' => ErrorCode::ValidationFailed->value, 'parameters' => ['{most}' => 2000]]],
                $e->violations,
            );
        }
    }

    /** @return iterable<string, array{EventRole}> */
    public static function rolesThatCannotManage(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('rolesThatCannotManage')]
    public function withoutGuestsManageEveryActionIsRefused(EventRole $role): void
    {
        $guest = $this->add('Sophie Laurent');
        $bride = $this->group("Bride's side");
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        $this->as($viewer, 'POST', $this->guests() . '/invitations', ['guestIds' => [$guest], 'how' => 'whatsapp']);
        self::assertSame(403, $this->statusCode());
        self::assertNull($this->invitationOf($guest));
        $this->as($viewer, 'POST', $this->guests() . '/group-moves', ['guestIds' => [$guest], 'group' => ['id' => $bride]]);
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'POST', $this->guests() . '/removals', ['guestIds' => [$guest]]);
        self::assertSame(403, $this->statusCode());
        $removal = $this->removal([$guest]);
        $this->as($viewer, 'DELETE', $this->guests() . '/removals/' . $removal);
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'POST', $this->guests() . '/removals/' . $removal . '/erasure');
        self::assertSame(403, $this->statusCode());
        self::assertSame(1, $this->people());
    }

    /** @param list<string> $ids */
    private function removal(array $ids): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests() . '/removals', ['guestIds' => $ids]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce($body['removal'] ?? null);
    }

    private function group(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guest-groups', ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['group'] ?? null)['id'];
    }

    private function groupOf(string $guest): ?string
    {
        $body = $this->as($this->owner, 'GET', $this->guests() . '/' . $guest);

        return Type\shape(['guest' => Type\shape(['group' => Type\nullable(Type\shape(['id' => Type\string()], true))], true)], true)->coerce($body)['guest']['group']['id'] ?? null;
    }

    /** @return array<string, mixed>|null */
    private function invitationOf(string $guest): ?array
    {
        $body = $this->as($this->owner, 'GET', $this->guests() . '/' . $guest);

        return Type\shape(['guest' => Type\shape(['invitation' => Type\nullable(Type\dict(Type\string(), Type\mixed()))], true)], true)->coerce($body)['guest']['invitation'];
    }

    /** @param list<?string> $companions */
    private function add(string $name, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    /** @return list<string> */
    private function names(): array
    {
        $list = Type\shape(['guests' => Type\vec(Type\shape(['fullName' => Type\string()], true))], true)->coerce($this->as($this->owner, 'GET', $this->guests()));

        return Vec\map($list['guests'], static fn (array $row): string => $row['fullName']);
    }

    /** @return array<string, mixed> */
    private function counts(): array
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/headcount');

        return Type\shape(['headcount' => Type\shape(['counts' => Type\dict(Type\string(), Type\mixed())], true)], true)->coerce($body)['headcount']['counts'];
    }

    private function people(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM guests'));
    }

    private function draft(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function live(string $name): string
    {
        $id = $this->draft($name);
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
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
