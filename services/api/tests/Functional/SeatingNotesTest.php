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
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mercure\Update;

/** Seating notes (sc-1364): two guests the host wants together or apart, recorded and removed by those who manage the seating, told to no one else. */
final class SeatingNotesTest extends ApiTestCase
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
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function eachKindIsAddedAndShowsOnBothGuestsAsOneNote(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $kemi = $this->guest('Kemi Ade');

        $this->add($ada, $bola, 'together');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->add($kemi, $ada, 'apart');
        self::assertSame(201, $this->statusCode());

        $notes = $this->notes();
        self::assertSame(['together', 'apart'], Vec\map($notes, static fn (array $note): mixed => $note['kind']));
        self::assertEqualsCanonicalizing([$ada, $bola], [$notes[0]['guestId'], $notes[0]['otherGuestId']]);
        self::assertEqualsCanonicalizing([$ada, $kemi], [$notes[1]['guestId'], $notes[1]['otherGuestId']]);
    }

    #[Test]
    public function aNoteIsRemovedFromBothGuestsAtOnce(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $this->add($ada, $bola, 'together');
        $id = Type\string()->coerce($this->notes()[0]['id']);

        $this->as($this->owner, 'DELETE', $this->plan() . '/notes/' . $id);

        self::assertSame(200, $this->statusCode());
        self::assertSame([], $this->notes());
        $this->as($this->owner, 'DELETE', $this->plan() . '/notes/' . $id);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function theSameNoteAgainIs409AndTheOtherKindNeedsToSayItReplaces(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $this->add($ada, $bola, 'together');

        $this->add($bola, $ada, 'together');
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/seating_note_same', $this->last()['type'] ?? null);

        $this->add($ada, $bola, 'apart');
        self::assertSame(409, $this->statusCode());
        self::assertSame(['together'], Vec\map($this->notes(), static fn (array $note): mixed => $note['kind']));

        $this->add($ada, $bola, 'apart', replace: true);
        self::assertSame(201, $this->statusCode());
        self::assertSame(['apart'], Vec\map($this->notes(), static fn (array $note): mixed => $note['kind']));
    }

    #[Test]
    public function aGuestWithThemselvesAnUnnamedPlaceOrAnotherEventsGuestIs422AndNothingIsSaved(): void
    {
        $ada = $this->guest('Ada Obi', [null]);
        $place = $this->companionId();
        $other = $this->account('other@else.where');
        $elsewhere = self::service(OrganisationFounder::class)->found($other, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $theirEvent = $this->newEvent($other, $elsewhere);
        $theirs = Type\shape(['guest' => Type\shape(['id' => Type\string()], true)], true)->coerce($this->as($other, 'POST', '/api/events/' . $theirEvent . '/guests', ['fullName' => 'Zed Zee', 'companions' => []]))['guest']['id'];

        foreach ([[$ada, $ada], [$ada, $place], [$ada, $theirs], [$ada, '00000000-0000-7000-8000-000000000000'], [$ada, 'nope']] as [$one, $two]) {
            $this->add($one, $two, 'together');
            self::assertSame(422, $this->statusCode(), $two);
        }

        self::assertSame([], $this->notes());
    }

    #[Test]
    public function withoutSeatingManageAddingRemovingAndReadingAreRefusedAndAnotherOrganisationGets404(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $this->add($ada, $bola, 'apart');
        $id = Type\string()->coerce($this->notes()[0]['id']);
        $viewer = $this->member('viewer@ire.events', SeededRole::Member, EventRole::CanView);
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        foreach ([[$viewer, 403], [$stranger, 404]] as [$who, $status]) {
            $this->as($who, 'GET', $this->plan() . '/notes');
            self::assertSame($status, $this->statusCode());
            $this->as($who, 'POST', $this->plan() . '/notes', ['guestId' => $bola, 'otherGuestId' => $ada, 'kind' => 'together', 'replace' => true]);
            self::assertSame($status, $this->statusCode());
            $this->as($who, 'DELETE', $this->plan() . '/notes/' . $id);
            self::assertSame($status, $this->statusCode());
        }

        self::assertCount(1, $this->notes());
    }

    #[Test]
    public function theSeatingReadsAndTheLivePlanCarryNoNote(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $this->add($ada, $bola, 'apart');
        $viewer = $this->member('viewer@ire.events', SeededRole::Member, EventRole::CanView);

        $read = $this->as($viewer, 'GET', $this->plan());
        self::assertSame(200, $this->statusCode());
        self::assertArrayNotHasKey('notes', Type\dict(Type\string(), Type\mixed())->coerce($read['seating'] ?? $read));
        self::assertStringNotContainsString('together', Json\encode($read));
        self::assertStringNotContainsString('apart', Json\encode($read));
        $table = $this->addTable();
        $this->seat($ada, $table);

        foreach (self::service(RecordingHub::class)->published as $update) {
            if (['events/' . $this->eventId . '/seating'] === $update->getTopics()) {
                self::assertStringNotContainsString('apart', $update->getData());
                self::assertStringNotContainsString('notes', $update->getData());
            }
        }
    }

    #[Test]
    public function addingAndRemovingAreToldOnlyToEditorsAndNameNeitherGuestNorKindInTheAudit(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');

        $this->add($ada, $bola, 'apart');
        $told = Vec\filter(self::service(RecordingHub::class)->published, fn (Update $update): bool => ['events/' . $this->eventId . '/seating/notes'] === $update->getTopics());
        self::assertCount(1, $told);
        self::assertTrue($told[0]->isPrivate());
        self::assertSame(['notes' => 'changed'], Json\decode($told[0]->getData()));

        $id = Type\string()->coerce($this->notes()[0]['id']);
        $this->as($this->owner, 'DELETE', $this->plan() . '/notes/' . $id);

        $rows = self::em()->getConnection()->fetchAllAssociative("SELECT action, changes::text AS changes FROM audit_entries WHERE action LIKE 'seating.note_%' ORDER BY occurred_at");
        self::assertSame(['seating.note_added', 'seating.note_removed'], Vec\map($rows, static fn (array $row): mixed => $row['action']));
        foreach ($rows as $row) {
            self::assertStringNotContainsString('Ada', Type\string()->coerce($row['changes']));
            self::assertStringNotContainsString('apart', Type\string()->coerce($row['changes']));
        }
    }

    #[Test]
    public function aNoteGoesWithEitherGuestWhenTheyAreErasedAndAGuestRemovedFromTheListHidesIt(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $kemi = $this->guest('Kemi Ade');
        $this->add($ada, $bola, 'together');
        $this->add($ada, $kemi, 'apart');

        self::em()->getConnection()->executeStatement('UPDATE guests SET removed_at = now() WHERE id = ?', [$bola]);
        self::assertCount(1, $this->notes(), 'a guest off the list holds no note');

        self::em()->getConnection()->executeStatement('DELETE FROM guests WHERE id = ?', [$kemi]);
        self::assertSame(1, self::em()->getConnection()->fetchOne('SELECT count(*) FROM seating_notes'), 'the erased guest took theirs with them');
    }

    #[Test]
    public function aDuplicatedEventCopiesNoNote(): void
    {
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $this->add($ada, $bola, 'together');

        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/duplicate', ['startsAt' => '2031-06-12T16:00']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(1, self::em()->getConnection()->fetchOne('SELECT count(*) FROM seating_notes'));
    }

    private function add(string $guest, string $other, string $kind, bool $replace = false): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/notes', ['guestId' => $guest, 'otherGuestId' => $other, 'kind' => $kind, 'replace' => $replace]);
    }

    /** @return list<array<string, mixed>> */
    private function notes(): array
    {
        $body = $this->as($this->owner, 'GET', $this->plan() . '/notes');

        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($body['notes']);
    }

    private function companionId(): string
    {
        return Type\string()->coerce(self::em()->getConnection()->fetchOne('SELECT id FROM guests WHERE event_id = ? AND host_id IS NOT NULL', [$this->eventId]));
    }

    private function guest(string $name, array $companions = [], ?string $reply = null): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['guest' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['guest']['id'];

        if (null !== $reply) {
            $this->reply($id, $reply);
        }

        return $id;
    }

    private function reply(string $guest, string $answer): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/record-reply', ['answer' => $answer, 'how' => 'phone', 'replace' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function seat(string $guest, string $table, ?int $seat = null, bool $justGuest = false): array
    {
        $body = $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $guest, 'kind' => 'table', 'placeId' => $table, 'seat' => $seat, 'justGuest' => $justGuest]);

        return 200 === $this->statusCode()
            ? Type\shape(['moves' => Type\vec(Type\dict(Type\string(), Type\mixed())), 'apart' => Type\bool()], true)->coerce($body)
            : ['moves' => [], 'apart' => false];
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function member(string $address, SeededRole $seeded, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

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

    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }

    private function newEvent(User $by, Organisation $organisation): string
    {
        $body = $this->as($by, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2030-06-12T16:00',
            'endsAt' => '2030-06-13T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode());
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($by, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function addTable(): string
    {
        $body = $this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round']);
        return Type\string()->coerce($body['tableId'] ?? null);
    }
}
