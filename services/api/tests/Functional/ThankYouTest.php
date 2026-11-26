<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Deletion\Pruner;
use App\Deletion\Restorer;
use App\Domain\Event\ThankYouEditor;
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
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class ThankYouTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string BEFORE_START = '2030-11-14T10:00:00+00:00';

    private const string HAPPENING = '2030-11-14T18:00:00+00:00';

    private const string AFTER_END = '2030-11-15T03:00:00+00:00';

    private const string NAME = "Amara & Tobi's wedding";

    private const string LINE = 'Thank you for dancing with us.';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-11-14T09:00:00+00:00'));
        $this->owner = $this->account('folake@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function endingNowWithALineEndsItAndSavesTheLineCleaned(): void
    {
        $id = $this->live();
        self::mockTime(new DateTimeImmutable(self::HAPPENING));

        $body = $this->as($this->owner, 'POST', '/api/events/' . $id . '/end', ['thankYou' => "  Thank you\n\nfor   dancing\r\nwith us.  "]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['finished', self::LINE], $this->phaseAndLine($body));
        self::assertNotNull($this->entry(ThankYouEditor::SAVED, $id));
    }

    #[Test]
    public function endingNowWithNoBodyOrAnEmptyLineEndsItAsBefore(): void
    {
        foreach ([null, ['thankYou' => " \n "], ['thankYou' => null]] as $sent) {
            self::mockTime(new DateTimeImmutable('2026-11-14T09:00:00+00:00'));
            $id = $this->live();
            self::mockTime(new DateTimeImmutable(self::HAPPENING));

            $body = $this->as($this->owner, 'POST', '/api/events/' . $id . '/end', $sent);

            self::assertSame(200, $this->statusCode(), Json\encode($body));
            self::assertSame(['finished', null], $this->phaseAndLine($body));
            self::assertNull($this->entry(ThankYouEditor::SAVED, $id));
        }
    }

    #[Test]
    public function callingItOffWithALineIsRefusedAndLeavesItLive(): void
    {
        $id = $this->live();
        self::mockTime(new DateTimeImmutable(self::BEFORE_START));

        $this->as($this->owner, 'POST', '/api/events/' . $id . '/end', ['thankYou' => self::LINE]);

        self::assertSame([409, ErrorCode::EventStateInvalid->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertSame(['live', null], $this->phaseAndLine($this->as($this->owner, 'GET', '/api/events/' . $id)));
    }

    #[Test]
    public function endingWithALineOverTheLimitIsRefusedAndEndsNothing(): void
    {
        $id = $this->live();
        self::mockTime(new DateTimeImmutable(self::HAPPENING));

        $this->as($this->owner, 'POST', '/api/events/' . $id . '/end', ['thankYou' => Str\repeat('é', 281)]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('A thank-you can be at most 280 characters.', $this->violation('thankYou'));
        self::assertSame(['happening_now', null], $this->phaseAndLine($this->as($this->owner, 'GET', '/api/events/' . $id)));
    }

    #[Test]
    public function aFinishedEventTakesALineEditsItAndRemovesItSavedEmpty(): void
    {
        $id = $this->live();
        self::mockTime(new DateTimeImmutable(self::AFTER_END));

        $saved = $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => self::LINE]);
        self::assertSame(200, $this->statusCode(), Json\encode($saved));
        self::assertSame(['finished', self::LINE], $this->phaseAndLine($saved));

        $edited = $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => Str\repeat('a', 280)]);
        self::assertSame(['finished', Str\repeat('a', 280)], $this->phaseAndLine($edited));

        $removed = $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => '   ']);
        self::assertSame(['finished', null], $this->phaseAndLine($removed));
        self::assertNotNull($this->entry(ThankYouEditor::REMOVED, $id));
    }

    #[Test]
    public function aLineOverTheLimitIsRefusedAndNotSaved(): void
    {
        $id = $this->live();
        self::mockTime(new DateTimeImmutable(self::AFTER_END));
        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => self::LINE]);

        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => Str\repeat('a', 281)]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('A thank-you can be at most 280 characters.', $this->violation('thankYou'));
        self::assertSame(['finished', self::LINE], $this->phaseAndLine($this->as($this->owner, 'GET', '/api/events/' . $id)));
    }

    #[Test]
    public function noLineIsTakenBeforeItIsFinishedWhilePausedOrOnceCalledOff(): void
    {
        $happening = $this->live();
        $paused = $this->live();
        $calledOff = $this->live();
        $draft = $this->draft();
        $this->as($this->owner, 'POST', '/api/events/' . $calledOff . '/end');
        self::mockTime(new DateTimeImmutable(self::HAPPENING));
        $this->as($this->owner, 'POST', '/api/events/' . $paused . '/pause');
        self::assertSame(200, $this->statusCode());

        foreach ([$happening, $paused, $calledOff, $draft] as $id) {
            $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => self::LINE]);
            self::assertSame([409, ErrorCode::EventStateInvalid->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        }

        self::mockTime(new DateTimeImmutable(self::AFTER_END));
        $this->as($this->owner, 'PUT', '/api/events/' . $calledOff . '/thank-you', ['thankYou' => self::LINE]);
        self::assertSame(409, $this->statusCode(), 'a called-off event takes no line after its end either');
    }

    #[Test]
    public function aMemberWhoCannotEndItReadsTheLineAndIsRefusedTheWrite(): void
    {
        $id = $this->live();
        $reader = $this->member('reader@ire.events', $id, EventRole::CanView);
        self::mockTime(new DateTimeImmutable(self::AFTER_END));
        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => self::LINE]);

        self::assertSame(['finished', self::LINE], $this->phaseAndLine($this->as($reader, 'GET', '/api/events/' . $id)));
        $this->as($reader, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => 'Mine instead']);
        self::assertSame(403, $this->statusCode());
        self::assertSame(['finished', self::LINE], $this->phaseAndLine($this->as($reader, 'GET', '/api/events/' . $id)));
    }

    #[Test]
    public function theGuestsPageShowsTheLineOnlyOnceItIsFinished(): void
    {
        $id = $this->live();
        $token = $this->guest($id);
        self::mockTime(new DateTimeImmutable(self::HAPPENING));
        self::assertSame(['live', null], $this->guestPage($token));

        $this->as($this->owner, 'POST', '/api/events/' . $id . '/end', ['thankYou' => self::LINE]);
        self::assertSame(['finished', self::LINE], $this->guestPage($token));

        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => '<b>https://example.com</b>']);
        self::assertSame(['finished', '<b>https://example.com</b>'], $this->guestPage($token), 'kept as typed, for the page to show as text');

        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => '']);
        self::assertSame(['finished', null], $this->guestPage($token));
    }

    #[Test]
    public function aDeletedEventsLineIs404AndARestoreBringsItBackAsItWas(): void
    {
        $id = $this->live();
        $token = $this->guest($id);
        self::mockTime(new DateTimeImmutable(self::AFTER_END));
        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => self::LINE]);
        $this->as($this->owner, 'DELETE', '/api/events/' . $id, ['name' => self::NAME]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($this->owner, 'GET', '/api/events/' . $id);
        self::assertSame(404, $this->statusCode());
        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => 'Again']);
        self::assertSame(404, $this->statusCode());
        $this->anonymous('/api/guest-links/page', $token);
        self::assertSame(404, $this->statusCode());

        self::service(Restorer::class)->restore(DeletedKind::Event, Uuid::fromString($id), 'Adaeze from support');
        self::em()->clear();

        self::assertSame(['finished', self::LINE], $this->phaseAndLine($this->as($this->owner, 'GET', '/api/events/' . $id)));
        self::assertSame(['finished', self::LINE], $this->guestPage($token));
    }

    #[Test]
    public function thePurgeAtTheDeadlineTakesTheLineWithTheEvent(): void
    {
        $id = $this->live();
        self::mockTime(new DateTimeImmutable(self::AFTER_END));
        $this->as($this->owner, 'PUT', '/api/events/' . $id . '/thank-you', ['thankYou' => self::LINE]);
        $this->as($this->owner, 'DELETE', '/api/events/' . $id, ['name' => self::NAME]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(self::LINE, $this->storedLine($id), 'kept for a restore until the purge');

        self::mockTime(new DateTimeImmutable('2030-12-16T03:00:00+00:00'));
        self::em()->clear();
        self::assertSame(1, self::service(Pruner::class)->prune());

        self::assertFalse(self::service(Connection::class)->fetchOne('SELECT thank_you FROM events WHERE id = :id', ['id' => $id]));
    }

    private function draft(): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('/events'), ['name' => self::NAME, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN', 'hosts' => ['Funmi', 'Tayo']]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function live(): string
    {
        $id = $this->draft();
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function guest(string $eventId): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $eventId . '/guests', ['fullName' => 'Bisi Okafor', 'companions' => []]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT link_token FROM guests WHERE event_id = :id', ['id' => $eventId]));
    }

    /** @return array{0: string, 1: ?string} */
    private function guestPage(#[SensitiveParameter] string $token): array
    {
        $body = $this->anonymous('/api/guest-links/page', $token);
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $event = Type\shape(['thankYou' => Type\nullable(Type\string())], true)->coerce($body['event'] ?? null);

        return [Type\string()->coerce($body['phase'] ?? null), $event['thankYou']];
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array{0: string, 1: ?string}
     */
    private function phaseAndLine(array $body): array
    {
        $event = Type\shape(['phase' => Type\string(), 'thankYou' => Type\nullable(Type\string())], true)->coerce($body['event'] ?? null);

        return [$event['phase'], $event['thankYou']];
    }

    private function storedLine(string $id): ?string
    {
        return Type\nullable(Type\string())->coerce(self::service(Connection::class)->fetchOne('SELECT thank_you FROM events WHERE id = :id', ['id' => $id]));
    }

    private function entry(string $action, string $id): ?AuditEntry
    {
        return self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => Uuid::fromString($id)]);
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        $user->setTimezone('Africa/Lagos');
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $eventId, EventRole $on): User
    {
        $user = $this->account($address);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Member]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $eventId, $on);

        return $user;
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . $rest;
    }

    private function violation(string $field): ?string
    {
        foreach (Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []) as $violation) {
            if ($violation['propertyPath'] === $field) {
                return $violation['message'];
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    private function anonymous(string $path, #[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => $token]));

        return $this->last();
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
