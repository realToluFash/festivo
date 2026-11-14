<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Deletion\Restorer;
use App\Domain\Guest\Removal\GuestRemovals;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\DeletedKind;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class GuestRemovalTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

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
    public function aRemovedGuestAndTheirCompanionsLeaveTheListAndTheCountsAtOnce(): void
    {
        $this->add('Bisi Adewale');
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo', null]);
        $this->reply($this->token($guest), 'coming');
        self::assertSame(4, $this->counts()['onList']);

        $this->remove($guest);

        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['Bisi Adewale'], $this->names());
        self::assertSame(['people' => 1, 'guests' => 1, 'companions' => 0], $this->as($this->owner, 'GET', $this->guests())['counts'] ?? null);
        self::assertSame([1, 0], [$this->counts()['onList'], $this->counts()['accepted']]);
        $this->as($this->owner, 'GET', $this->guests() . '/' . $guest);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function theRemovalIsPublishedAsTheWholeListAndItsHeadcount(): void
    {
        $guest = $this->add(self::ADAEZE);
        $hub = self::service(RecordingHub::class);

        $this->remove($guest);

        $list = $hub->lastOn('events/' . $this->eventId . '/guests') ?? self::fail('no list published');
        self::assertSame([], Type\shape(['guests' => Type\vec(Type\mixed())], true)->coerce(Json\decode($list->getData()))['guests']);
        $headcount = $hub->lastOn('events/' . $this->eventId . '/headcount') ?? self::fail('no headcount published');
        self::assertStringContainsString('"onList":0', $headcount->getData());
    }

    #[Test]
    public function undoPutsThemBackInTheirPlaceAsTheyWereWithTheirLinkReplyAndCompanions(): void
    {
        $this->add('Bisi Adewale');
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);
        $this->add('Kemi Olatunji');
        $token = $this->token($guest);
        $this->reply($token, 'maybe');
        $before = $this->as($this->owner, 'GET', $this->guests());
        $counts = $this->counts();

        $this->remove($guest);
        $undone = $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest . '/removal');

        self::assertSame(200, $this->statusCode(), Json\encode($undone));
        self::assertSame(self::ADAEZE, Type\shape(['fullName' => Type\string()], true)->coerce($undone['guest'] ?? null)['fullName']);
        self::assertSame($before, $this->as($this->owner, 'GET', $this->guests()));
        self::assertSame($counts, $this->counts());
        self::assertSame($token, $this->token($guest));
        $this->open($token);
        self::assertSame(200, $this->statusCode());
        self::assertSame(0, $this->removals());
    }

    #[Test]
    public function untilTheUndoRunsOutTheirLinkWorksAsBefore(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);

        $this->remove($guest);

        $this->open($token);
        self::assertSame(200, $this->statusCode());
        $this->reply($token, 'coming');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function onceTheUndoRunsOutTheyAndTheirCompanionsAreErasedAndTheirLinkAnswersAsAnUnknownOne(): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo', null]);
        $token = $this->token($guest);
        $this->open(Str\repeat('a', 43));
        $unknown = [$this->statusCode(), $this->problem()];
        $this->reply(Str\repeat('a', 43), 'coming');
        $unknownReply = [$this->statusCode(), $this->problem()];

        $this->remove($guest);
        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/erasure');

        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();
        self::assertSame(0, $this->people());
        self::assertSame(0, Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM guest_needs')));
        $this->open($token);
        self::assertSame($unknown, [$this->statusCode(), $this->problem()]);
        $audit = $this->auditRows();
        $this->reply($token, 'coming');
        self::assertSame($unknownReply, [$this->statusCode(), $this->problem()]);
        self::assertSame($audit, $this->auditRows(), 'a reply with an ended link records nothing');
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest . '/removal');
        self::assertSame(404, $this->statusCode(), 'nothing is left to undo');
    }

    #[Test]
    public function aRemovalNobodyFinishedIsErasedByThePruneOnceItHasLapsed(): void
    {
        $lapsed = $this->add(self::ADAEZE, ['Obi Okonkwo']);
        $this->remove($lapsed);
        self::mockTime(new DateTimeImmutable('2026-10-17T13:36:00+00:00'));
        $fresh = $this->add('Bisi Adewale');
        $this->remove($fresh);

        self::assertSame(1, self::service(GuestRemovals::class)->eraseLapsed());

        self::em()->clear();
        self::assertSame([$fresh], Type\vec(Type\string())->coerce(self::em()->getConnection()->fetchFirstColumn('SELECT id FROM guests')));
        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestRemovals::REMOVED]);
        self::assertSame(['2026-10-17T13:20:00+00:00'], Vec\map($entries, static fn (AuditEntry $entry): string => $entry->getOccurredAt()->format(DateTimeInterface::ATOM)), 'the entry says when they were removed, not when the prune ran');
    }

    #[Test]
    public function theAuditSaysRemovedAGuestWithWhoAndWhenAndNothingOfThem(): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);

        $this->remove($guest);
        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/erasure');

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestRemovals::REMOVED]);
        self::assertCount(1, $entries);
        $entry = $entries[0];
        self::assertSame(['Event', $this->eventId, $this->owner->getId()->toRfc4122(), []], [$entry->getSubjectType(), $entry->getSubjectId()->toRfc4122(), $entry->getActorId()?->toRfc4122(), $entry->getChanges()]);
        $row = Json\encode(self::em()->getConnection()->fetchAssociative('SELECT * FROM audit_entries WHERE id = :id', ['id' => $entry->getId()->toRfc4122()]));
        foreach ([self::ADAEZE, 'Adaeze', 'Obi', $guest] as $personal) {
            self::assertStringNotContainsString($personal, $row);
        }
    }

    #[Test]
    public function aGuestRemovedBeforeTheirEventWasDeletedStaysRemovedThroughItsRestore(): void
    {
        $this->add('Bisi Adewale');
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);
        $this->remove($guest);
        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/erasure');

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId, ['name' => self::EVENT]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();
        self::service(Restorer::class)->restore(DeletedKind::Event, Uuid::fromString($this->eventId), 'Adaeze from support');
        self::em()->clear();

        self::assertSame(['Bisi Adewale'], $this->names());
        self::assertSame(1, $this->counts()['onList']);
    }

    #[Test]
    public function oneAlreadyRemovedByAnotherHostIsNotFoundAndChangesNothing(): void
    {
        $guest = $this->add(self::ADAEZE);
        $other = $this->member('ada@ire.events', SeededRole::Member, EventRole::CanEdit);
        $this->remove($guest);

        $this->as($other, 'DELETE', $this->guests() . '/' . $guest);
        self::assertSame(404, $this->statusCode());

        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest . '/removal');
        self::assertSame(200, $this->statusCode(), 'the first removal is still the one to undo');
        $this->remove($guest);
        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/erasure');
        $this->as($other, 'DELETE', $this->guests() . '/' . $guest);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function onlyARemovedGuestIsErasedOrUndone(): void
    {
        $guest = $this->add(self::ADAEZE);

        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/erasure');
        self::assertSame(404, $this->statusCode());
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest . '/removal');
        self::assertSame(404, $this->statusCode());
        self::assertSame(1, $this->people());
    }

    #[Test]
    public function aCompanionIsNotOneToRemoveByThemselves(): void
    {
        $guest = $this->as($this->owner, 'POST', $this->guests(), ['fullName' => self::ADAEZE, 'companions' => [['fullName' => 'Obi Okonkwo']]]);
        $companion = Type\shape(['guest' => Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string()], true))], true)], true)->coerce($guest)['guest']['companions'][0]['id'];

        $this->remove($companion);

        self::assertSame(404, $this->statusCode());
        self::assertSame(2, $this->counts()['onList']);
    }

    /** @return iterable<string, array{EventRole}> */
    public static function rolesThatCannotRemove(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('rolesThatCannotRemove')]
    public function withoutGuestsManageNothingIsRemovedUndoneOrErased(EventRole $role): void
    {
        $guest = $this->add(self::ADAEZE);
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        $this->as($viewer, 'DELETE', $this->guests() . '/' . $guest);
        self::assertSame(403, $this->statusCode());
        $this->remove($guest);
        $this->as($viewer, 'DELETE', $this->guests() . '/' . $guest . '/removal');
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'POST', $this->guests() . '/' . $guest . '/erasure');
        self::assertSame(403, $this->statusCode());
        self::assertSame(1, $this->people());
    }

    #[Test]
    public function anotherOrganisationsGuestIsNotFound(): void
    {
        $guest = $this->add(self::ADAEZE);
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'DELETE', $this->guests() . '/' . $guest);

        self::assertSame(404, $this->statusCode());
        self::assertSame([self::ADAEZE], $this->names());
    }

    #[Test]
    public function otherGuestsTheirRepliesAndLinksAreUntouched(): void
    {
        $bisi = $this->add('Bisi Adewale', ['Tunde Adewale']);
        $bisiToken = $this->token($bisi);
        $this->reply($bisiToken, 'coming');
        $guest = $this->add(self::ADAEZE);
        $before = $this->details($bisi);

        $this->remove($guest);
        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/erasure');

        self::assertSame($before, $this->details($bisi));
        self::assertSame($bisiToken, $this->token($bisi));
        $this->open($bisiToken);
        self::assertSame(200, $this->statusCode());
    }

    private function remove(string $guest): void
    {
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest);
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

    /** @return array<string, mixed> */
    private function details(string $guest): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->guests() . '/' . $guest)['guest'] ?? null);
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

    private function removals(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM guests WHERE removed_at IS NOT NULL'));
    }

    private function auditRows(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM audit_entries'));
    }

    private function token(string $guest): string
    {
        $body = $this->as($this->owner, 'GET', $this->guests() . '/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    private function open(#[SensitiveParameter] string $token): void
    {
        $this->client->request('POST', '/api/guest-links/page', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token]));
    }

    private function reply(#[SensitiveParameter] string $token, string $answer): void
    {
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token, 'answer' => $answer]));
    }

    private function live(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
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

    /** @return array<string, mixed> without the correlation id, which differs on every answer */
    private function problem(): array
    {
        $problem = $this->last();
        unset($problem['correlationId']);

        return $problem;
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
