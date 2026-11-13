<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Deletion\Restorer;
use App\Domain\Guest\Link\InvitationLinks;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\DeletedKind;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
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
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Uid\Uuid;

final class GuestLinksTest extends ApiTestCase
{
    use ClockSensitiveTrait;
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
        self::mockTime(new DateTimeImmutable('2026-10-17T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function aGuestHasALinkFromTheMomentTheyAreAddedAndACompanionHasNone(): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);

        $rows = self::em()->getConnection()->fetchAllAssociative('SELECT host_id, link_token FROM guests ORDER BY position');
        self::assertCount(2, $rows);
        self::assertMatchesRegularExpression('#^[A-Za-z0-9_-]{43}$#', Type\string()->coerce($rows[0]['link_token']));
        self::assertNull($rows[1]['link_token']);
        self::assertSame('https://app.soirely.test/i/' . Type\string()->coerce($rows[0]['link_token']), $this->link($guest));
        self::assertArrayNotHasKey('link', $this->as($this->owner, 'GET', $this->guests())['guests'][0] ?? []);
    }

    #[Test]
    public function copyingAgainGivesTheSameLinkAndNoTwoGuestsShareOne(): void
    {
        $first = $this->add('Bisi Adewale');
        $second = $this->add('Tunde Bakare');
        $elsewhere = $this->live('Owambe');
        $third = $this->add('Kemi Ojo', [], $elsewhere);

        self::assertSame($this->link($first), $this->link($first));
        $tokens = [$this->token($first), $this->token($second), $this->token($third, $elsewhere)];
        self::assertSame($tokens, Vec\unique($tokens));
    }

    #[Test]
    public function aDraftRefusesTheLinkButNotItsReplace(): void
    {
        $draft = $this->draft('Draft party');
        $guest = $this->add('Bisi Adewale', [], $draft);

        $this->as($this->owner, 'GET', $this->guests($draft) . '/' . $guest . '/link');
        self::assertSame(409, $this->statusCode());
        self::assertSame([ErrorCode::EventStateInvalid->type(), 'draft'], [$this->last()['type'] ?? null, $this->last()['phase'] ?? null]);

        $this->as($this->owner, 'POST', $this->guests($draft) . '/' . $guest . '/link/replace');
        self::assertSame(204, $this->statusCode());
    }

    #[Test]
    public function aPausedEventRefusesTheLinkToo(): void
    {
        $guest = $this->add('Bisi Adewale');
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/pause');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($this->owner, 'GET', $this->guests() . '/' . $guest . '/link');
        self::assertSame([409, 'paused'], [$this->statusCode(), $this->last()['phase'] ?? null]);
    }

    #[Test]
    public function theGuestsLinkOpensTheirNameTheEventAndItsHostsAndRecordsNothing(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);
        $audited = $this->auditRows();
        $before = self::em()->getConnection()->fetchAssociative('SELECT * FROM guests');

        $page = $this->open($token);
        $this->open($token);

        self::assertSame(200, $this->statusCode());
        self::assertSame([
            'guest' => ['fullName' => self::ADAEZE],
            'event' => ['id' => $this->eventId, 'name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'cover' => null, 'hosts' => ['Funmi Adeyemi']],
        ], $page);
        self::assertSame('no-store, private', $this->client->getResponse()->headers->get('Cache-Control'));
        self::assertSame($audited, $this->auditRows());
        self::assertSame($before, self::em()->getConnection()->fetchAssociative('SELECT * FROM guests'));
    }

    #[Test]
    public function replacingEndsTheOldLinkAtOnceAndKeepsTheGuestAsTheyWere(): void
    {
        $guest = $this->add(self::ADAEZE, [], null, 'adaeze@example.com');
        $old = $this->token($guest);

        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/link/replace');

        self::assertSame(204, $this->statusCode());
        $new = $this->token($guest);
        self::assertNotSame($old, $new);
        $this->open($old);
        self::assertSame(404, $this->statusCode());
        self::assertSame(self::ADAEZE, Type\shape(['fullName' => Type\string()], true)->coerce($this->open($new)['guest'] ?? null)['fullName']);
        $row = Type\shape(['email' => Type\string(), 'reply' => Type\string()], true)->coerce($this->as($this->owner, 'GET', $this->guests())['guests'][0] ?? null);
        self::assertSame(['adaeze@example.com', 'noReply'], [$row['email'], $row['reply']]);

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => InvitationLinks::REPLACED]) ?? self::fail('no audit entry');
        self::assertSame([$guest, $this->owner->getId()->toRfc4122(), []], [$entry->getSubjectId()->toRfc4122(), $entry->getActorId()?->toRfc4122(), $entry->getChanges()]);
        self::assertStringNotContainsString($old, Json\encode(self::em()->getConnection()->fetchAllAssociative('SELECT * FROM audit_entries')));
        self::assertStringNotContainsString($new, Json\encode(self::em()->getConnection()->fetchAllAssociative('SELECT * FROM audit_entries')));
    }

    #[Test]
    public function anUnknownAReplacedAndAMalformedTokenAnswerTheSame404(): void
    {
        $guest = $this->add('Bisi Adewale');
        $replaced = $this->token($guest);
        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/link/replace');

        $answers = [];
        foreach ([$replaced, Str\repeat('a', 43), 'not a token', ''] as $token) {
            $this->open($token);
            $answers[] = [$this->statusCode(), $this->problem()];
        }

        self::assertSame(404, $answers[0][0]);
        self::assertSame([$answers[0], $answers[0], $answers[0], $answers[0]], $answers);
    }

    #[Test]
    public function aDeletedEventsLinkAnswersAsAnUnknownOneUntilSupportRestoresIt(): void
    {
        $guest = $this->add('Bisi Adewale');
        $token = $this->token($guest);
        $this->open(Str\repeat('a', 43));
        $unknown = $this->problem();

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId, ['name' => "Amara & Tobi's wedding"]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();

        foreach (['page', 'wrong-person'] as $path) {
            $this->anonymous('/api/guest-links/' . $path, $token);
            self::assertSame([404, $unknown], [$this->statusCode(), $this->problem()], $path);
        }

        self::service(Restorer::class)->restore(DeletedKind::Event, Uuid::fromString($this->eventId), 'Adaeze from support');
        self::em()->clear();
        $this->open($token);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function tellingUsFlagsTheGuestOnceAndAReplaceClearsIt(): void
    {
        $guest = $this->add('Bisi Adewale');
        $token = $this->token($guest);

        $this->anonymous('/api/guest-links/wrong-person', $token);
        self::assertSame(204, $this->statusCode());
        $this->anonymous('/api/guest-links/wrong-person', $token);
        self::assertSame(204, $this->statusCode());

        self::assertTrue($this->flagged($guest));
        self::assertCount(1, self::em()->getRepository(AuditEntry::class)->findBy(['action' => InvitationLinks::FLAGGED]));
        self::assertSame('noReply', Type\shape(['reply' => Type\string()], true)->coerce($this->as($this->owner, 'GET', $this->guests())['guests'][0] ?? null)['reply']);

        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/link/replace');
        self::assertFalse($this->flagged($guest));
    }

    /** The configured pool is tagged `kernel.reset`, so its budget is full again on every request: a spent one is swapped in, and the numbers are the test below. */
    #[Test]
    public function aSpentBudgetRefusesTheTellWith429AndRetryAfter(): void
    {
        $guest = $this->add('Bisi Adewale');
        $token = $this->token($guest);
        self::getContainer()->set('limiter.guest_link_wrong_person', new RefusingRateLimiterFactory(new DateTimeImmutable('2099-10-26 14:34:10 UTC')));

        $this->anonymous('/api/guest-links/wrong-person', $token);

        self::assertSame([429, ErrorCode::TooManyAttempts->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertGreaterThan(0, (int) $this->client->getResponse()->headers->get('Retry-After'));
        self::assertFalse($this->flagged($guest));
    }

    #[Test]
    public function tellingUsIsLimitedToFiveAnHourOnOneLink(): void
    {
        $limiter = self::serviceById('limiter.guest_link_wrong_person', RateLimiterFactory::class)->create('one-guest');

        $accepted = 0;
        while ($limiter->consume()->isAccepted() && $accepted < 50) {
            ++$accepted;
        }

        self::assertSame(5, $accepted);
    }

    /** @return iterable<string, array{EventRole}> */
    public static function rolesThatCannotAdd(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('rolesThatCannotAdd')]
    public function onlyThoseWhoAddGuestsCopyOrReplace(EventRole $role): void
    {
        $guest = $this->add('Bisi Adewale');
        $token = $this->token($guest);
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        $this->as($viewer, 'GET', $this->guests() . '/' . $guest . '/link');
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'POST', $this->guests() . '/' . $guest . '/link/replace');
        self::assertSame(403, $this->statusCode());
        self::assertSame($token, $this->token($guest));
    }

    #[Test]
    public function anotherOrganisationsEventAMissingOneAndAnotherEventsGuestAreTheSameNotFound(): void
    {
        $guest = $this->add('Bisi Adewale');
        $elsewhere = $this->live('Owambe');
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $answers = [];
        foreach ([[$stranger, $this->eventId, $guest], [$stranger, '0193f5a8-0000-7000-8000-000000000000', $guest], [$this->owner, $elsewhere, $guest], [$this->owner, $this->eventId, 'nobody']] as [$who, $event, $id]) {
            foreach (['GET' => '/link', 'POST' => '/link/replace'] as $method => $rest) {
                $this->as($who, $method, $this->guests($event) . '/' . $id . $rest);
                $answers[] = [$this->statusCode(), $this->last()['detail'] ?? null];
            }
        }

        self::assertSame(404, $answers[0][0]);
        self::assertSame(Vec\fill(8, $answers[0]), $answers);
    }

    /** @param list<string> $companions */
    private function add(string $name, array $companions = [], ?string $eventId = null, ?string $email = null): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests($eventId), [
            'fullName' => $name,
            'email' => $email,
            'companions' => Vec\map($companions, static fn (string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function link(string $guest, ?string $eventId = null): string
    {
        $body = $this->as($this->owner, 'GET', $this->guests($eventId) . '/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce($body['url'] ?? null);
    }

    private function token(string $guest, ?string $eventId = null): string
    {
        return Str\after(Type\string()->coerce($this->link($guest, $eventId)), '/i/') ?? self::fail('no token');
    }

    private function flagged(string $guest): bool
    {
        return Type\bool()->coerce(self::em()->getConnection()->fetchOne('SELECT link_flagged FROM guests WHERE id = :id', ['id' => $guest]));
    }

    private function auditRows(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM audit_entries'));
    }

    /** @return array<string, mixed> */
    private function open(#[SensitiveParameter] string $token): array
    {
        return $this->anonymous('/api/guest-links/page', $token);
    }

    /** @return array<string, mixed> */
    private function anonymous(string $path, #[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token]));

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
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    /** @return array<string, mixed> the body without its correlation id, which differs on every request */
    private function problem(): array
    {
        $body = $this->last();
        unset($body['correlationId']);

        return $body;
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
