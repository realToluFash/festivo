<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\Invitation\GuestInvitations;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Guest;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
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

final class GuestInvitationsTest extends ApiTestCase
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
        self::mockTime(new DateTimeImmutable('2026-10-17T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function aGuestAddedIsNotYetInvitedWithTheirCompanions(): void
    {
        $guest = $this->add('Emeka Nwosu', ['Ada Nwosu']);

        self::assertNull($this->invitation($guest));
        self::assertSame(['notYetInvited'], $this->companionStates($guest));
    }

    /** @return iterable<string, array{string}> */
    public static function byHand(): iterable
    {
        yield 'WhatsApp' => ['whatsapp'];
        yield 'Text message' => ['textMessage'];
        yield 'Email' => ['email'];
        yield 'In person' => ['inPerson'];
        yield 'Other' => ['other'];
    }

    #[Test]
    #[DataProvider('byHand')]
    public function aMarkByHandRecordsWhoHowAndTodayInTheEventsZone(string $how): void
    {
        $guest = $this->add('Emeka Nwosu', ['Ada Nwosu']);

        $body = $this->as($this->owner, 'PUT', $this->invitationOf($guest), ['how' => $how]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $expected = ['at' => '2026-10-17T14:20:00+01:00', 'how' => $how, 'by' => 'Person'];
        self::assertSame($expected, Type\shape(['guest' => Type\shape(['invitation' => Type\mixed()], true)], true)->coerce($body)['guest']['invitation']);
        self::assertSame($expected, $this->invitation($guest));
        self::assertSame(['held'], $this->companionStates($guest));
        self::assertSame(1, $this->audited(GuestInvitations::MARKED));
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function noWay(): iterable
    {
        yield 'nothing chosen' => [[]];
        yield 'null' => [['how' => null]];
        yield 'blank' => [['how' => '']];
        yield 'by replying, which only a reply records' => [['how' => 'reply']];
        yield "by Soirely's message, which only Messaging records" => [['how' => 'soirelyMessage']];
        yield 'not a way at all' => [['how' => 'carrierPigeon']];
    }

    /** @param array<string, mixed> $body */
    #[Test]
    #[DataProvider('noWay')]
    public function withoutOneOfTheFiveWaysNothingIsSaved(array $body): void
    {
        $guest = $this->add('Emeka Nwosu');

        $this->as($this->owner, 'PUT', $this->invitationOf($guest), $body);

        self::assertSame(422, $this->statusCode());
        self::assertSame([['propertyPath' => 'how', 'message' => 'Choose how you invited them.']], Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? null),
            static fn (array $violation): array => ['propertyPath' => $violation['propertyPath'], 'message' => $violation['message']],
        ));
        self::assertNull($this->invitation($guest));
        self::assertSame(0, $this->audited(GuestInvitations::MARKED));
    }

    #[Test]
    public function aReplyInvitesAGuestNobodyMarkedWhenTheyReplied(): void
    {
        $guest = $this->add('Emeka Nwosu');

        $this->reply($guest, 'maybe');

        self::assertSame(['at' => '2026-10-17T14:20:00+01:00', 'how' => 'reply', 'by' => null], $this->invitation($guest));
    }

    #[Test]
    public function aReplyKeepsAMarkByHandAndCannotThenBeUndone(): void
    {
        $guest = $this->add('Emeka Nwosu');
        $this->mark($guest, 'email');
        self::mockTime(new DateTimeImmutable('2026-10-18T09:00:00+00:00'));

        $this->reply($guest, 'coming');
        $this->as($this->owner, 'DELETE', $this->invitationOf($guest));

        self::assertSame(409, $this->statusCode());
        self::assertSame([ErrorCode::GuestReplied->type(), 'coming', '2026-10-18T10:00:00+01:00'], [$this->last()['type'] ?? null, $this->last()['reply'] ?? null, $this->last()['repliedAt'] ?? null]);
        self::assertSame(['at' => '2026-10-17T14:20:00+01:00', 'how' => 'email', 'by' => 'Person'], $this->invitation($guest));
    }

    #[Test]
    public function markingAGuestAlreadyInvitedLeavesThemAsRecorded(): void
    {
        $guest = $this->add('Emeka Nwosu');
        $this->mark($guest, 'whatsapp');
        $colleague = $this->member('funmi@ire.events', SeededRole::Member, EventRole::CanEdit);
        self::mockTime(new DateTimeImmutable('2026-10-19T09:00:00+00:00'));

        $this->as($colleague, 'PUT', $this->invitationOf($guest), ['how' => 'inPerson']);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['at' => '2026-10-17T14:20:00+01:00', 'how' => 'whatsapp', 'by' => 'Person'], $this->invitation($guest));
        self::assertSame(1, $this->audited(GuestInvitations::MARKED));
    }

    #[Test]
    public function markAsNotInvitedUndoesAMarkByHand(): void
    {
        $guest = $this->add('Emeka Nwosu', ['Ada Nwosu']);
        $this->mark($guest, 'textMessage');

        $body = $this->as($this->owner, 'DELETE', $this->invitationOf($guest));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertNull($this->invitation($guest));
        self::assertSame(['notYetInvited'], $this->companionStates($guest));
        self::assertSame(1, $this->audited(GuestInvitations::UNMARKED));
    }

    #[Test]
    public function aReplyCannotBeUndoneByMarkAsNotInvited(): void
    {
        $guest = $this->add('Emeka Nwosu');
        $this->reply($guest, 'notComing');

        $this->as($this->owner, 'DELETE', $this->invitationOf($guest));

        self::assertSame([409, ErrorCode::GuestReplied->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertSame('reply', $this->invitation($guest)['how'] ?? null);
    }

    #[Test]
    public function soirelysMessageInvitesThemAndIsNotUndoneByHand(): void
    {
        $guest = $this->add('Emeka Nwosu');

        self::service(GuestInvitations::class)->byMessage(self::em()->find(Guest::class, $guest) ?? self::fail('no guest'));
        $this->as($this->owner, 'DELETE', $this->invitationOf($guest));

        self::assertSame([409, ErrorCode::GuestNotMarkedByHand->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertSame(['at' => '2026-10-17T14:20:00+01:00', 'how' => 'soirelyMessage', 'by' => null], $this->invitation($guest));
    }

    #[Test]
    public function aDraftRefusesTheMarkAndTheGuestStaysNotYetInvited(): void
    {
        $draft = $this->draft('Draft party');
        $guest = $this->add('Emeka Nwosu', [], $draft);

        $this->as($this->owner, 'PUT', $this->invitationOf($guest, $draft), ['how' => 'whatsapp']);

        self::assertSame(409, $this->statusCode());
        self::assertSame([ErrorCode::EventStateInvalid->type(), 'draft'], [$this->last()['type'] ?? null, $this->last()['phase'] ?? null]);
        self::assertNull($this->invitation($guest, $draft));
    }

    #[Test]
    public function aPausedEventRefusesTheMarkButNotItsUndo(): void
    {
        $marked = $this->add('Emeka Nwosu');
        $this->mark($marked, 'other');
        $guest = $this->add('Bisi Adewale');
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/pause');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($this->owner, 'PUT', $this->invitationOf($guest), ['how' => 'whatsapp']);
        self::assertSame([409, 'paused'], [$this->statusCode(), $this->last()['phase'] ?? null]);
        self::assertNull($this->invitation($guest));

        $this->as($this->owner, 'DELETE', $this->invitationOf($marked));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertNull($this->invitation($marked));
    }

    /** @return iterable<string, array{EventRole}> */
    public static function rolesThatCannotManage(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('rolesThatCannotManage')]
    public function withoutGuestsManageTheMarksAreSeenButNotChanged(EventRole $role): void
    {
        $marked = $this->add('Emeka Nwosu');
        $this->mark($marked, 'inPerson');
        $guest = $this->add('Bisi Adewale');
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        self::assertSame('inPerson', $this->invitation($marked, null, $viewer)['how'] ?? null);

        $this->as($viewer, 'PUT', $this->invitationOf($guest), ['how' => 'whatsapp']);
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'DELETE', $this->invitationOf($marked));
        self::assertSame(403, $this->statusCode());
        self::assertNull($this->invitation($guest));
        self::assertSame('inPerson', $this->invitation($marked)['how'] ?? null);
    }

    #[Test]
    public function aCompanionIsNeverMarkedThemselves(): void
    {
        $this->add('Emeka Nwosu', ['Ada Nwosu']);
        $companion = Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM guests WHERE host_id IS NOT NULL'));

        $this->as($this->owner, 'PUT', $this->invitationOf($companion), ['how' => 'whatsapp']);

        self::assertSame(404, $this->statusCode());
    }

    /** @param list<string> $companions */
    private function add(string $name, array $companions = [], ?string $eventId = null): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests($eventId), [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function mark(string $guest, string $how): void
    {
        $this->as($this->owner, 'PUT', $this->invitationOf($guest), ['how' => $how]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function reply(string $guest, string $answer): void
    {
        $link = $this->as($this->owner, 'GET', $this->guests() . '/' . $guest . '/link');
        $token = Str\after(Type\string()->coerce($link['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->anonymous('/api/guest-links/reply', ['token' => $token, 'answer' => $answer]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return array<string, mixed> */
    private function row(string $guest, ?string $eventId = null, ?User $as = null): array
    {
        $guests = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($as ?? $this->owner, 'GET', $this->guests($eventId))['guests'] ?? null);

        return Vec\filter($guests, static fn (array $row): bool => $guest === ($row['id'] ?? null))[0] ?? self::fail('not listed');
    }

    /** @return list<string> */
    private function companionStates(string $guest): array
    {
        $companions = Type\vec(Type\shape(['state' => Type\string()], true))->coerce($this->row($guest)['companions'] ?? null);

        return Vec\map($companions, static fn (array $companion): string => $companion['state']);
    }

    /** @return array<string, mixed>|null */
    private function invitation(string $guest, ?string $eventId = null, ?User $as = null): ?array
    {
        $invitation = Type\nullable(Type\dict(Type\string(), Type\mixed()))->coerce($this->row($guest, $eventId, $as)['invitation'] ?? null);
        $details = Type\shape(['guest' => Type\shape(['invitation' => Type\mixed()], true)], true)->coerce($this->as($as ?? $this->owner, 'GET', $this->guests($eventId) . '/' . $guest))['guest']['invitation'];
        self::assertSame($invitation, $details);

        return $invitation;
    }

    private function audited(string $action): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM audit_entries WHERE action = :action', ['action' => $action]));
    }

    private function invitationOf(string $guest, ?string $eventId = null): string
    {
        return $this->guests($eventId) . '/' . $guest . '/invitation';
    }

    /**
     * @param array<string, string> $body
     *
     * @return array<string, mixed>
     */
    private function anonymous(string $path, #[SensitiveParameter] array $body): array
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));

        return $this->last();
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

    private function guests(?string $eventId = null): string
    {
        return '/api/events/' . ($eventId ?? $this->eventId) . '/guests';
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
        ], content: match ($body) {
            null => null,
            [] => '{}',
            default => Json\encode($body),
        });

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
