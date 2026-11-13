<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\Reply\GuestAnswers;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

final class GuestAnswersTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

    /** 16:00 in Lagos, an hour ahead of UTC. */
    private const string START = '2030-11-14T15:00:00+00:00';

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
    public function openingThePageManyTimesRecordsNothing(): void
    {
        $token = $this->token($this->add(self::ADAEZE, ['Obi Okonkwo']));
        $list = $this->as($this->owner, 'GET', $this->guests());
        $published = Iter\count(self::service(RecordingHub::class)->published);

        $page = $this->open($token);
        $this->open($token);
        $this->open($token);

        self::assertSame(200, $this->statusCode());
        self::assertSame(['fullName' => self::ADAEZE, 'reply' => null, 'companions' => 1], $page['guest'] ?? null);
        self::assertSame(true, $page['answersOpen'] ?? null);
        self::assertSame($list, $this->as($this->owner, 'GET', $this->guests()));
        self::assertSame($published, Iter\count(self::service(RecordingHub::class)->published));
    }

    #[Test]
    public function thePageSaysWhenAndWhereInTheEventsZone(): void
    {
        self::service(Connection::class)->executeStatement("UPDATE events SET venue_name = 'The Civic Centre', venue_address = 'Ozumba Mbadiwe Ave, Victoria Island, Lagos' WHERE id = :id", ['id' => $this->eventId]);

        $page = $this->open($this->token($this->add(self::ADAEZE)));

        self::assertSame('2030-11-14T16:00:00+01:00', $page['event']['startsAt'] ?? null);
        self::assertSame('Africa/Lagos', $page['event']['timeZone'] ?? null);
        self::assertSame(['name' => 'The Civic Centre', 'address' => 'Ozumba Mbadiwe Ave, Victoria Island, Lagos'], $page['event']['venue'] ?? null);
    }

    /** @return iterable<string, array{string, string}> */
    public static function answers(): iterable
    {
        yield 'Coming' => ['coming', 'coming'];
        yield 'Not coming' => ['notComing', 'held'];
        yield 'Not sure yet' => ['maybe', 'held'];
    }

    #[Test]
    #[DataProvider('answers')]
    public function eachAnswerIsRecordedWithItsDateAndWhereItWasGiven(string $answer, string $companion): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);

        $page = $this->reply($this->token($guest), $answer);

        self::assertSame(200, $this->statusCode(), Json\encode($page));
        self::assertSame(['answer' => $answer, 'at' => '2026-10-17T14:20:00+01:00'], $page['guest']['reply'] ?? null);
        $row = $this->row($guest);
        self::assertSame([$answer, '2026-10-17T14:20:00+01:00', 'guestPage'], [$row['reply'], $row['repliedAt'], $row['replySource']]);
        self::assertSame([$companion], Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($row['companions']), static fn (array $one): mixed => $one['state']));
    }

    #[Test]
    public function aChangeReplacesTheReplyAndTheSameAnswerAgainKeepsItsDate(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);

        $this->reply($token, 'maybe');
        self::mockTime(new DateTimeImmutable('2026-10-19T09:00:00+00:00'));
        $this->reply($token, 'coming');
        $published = Iter\count(self::service(RecordingHub::class)->published);
        self::mockTime(new DateTimeImmutable('2026-10-21T09:00:00+00:00'));
        $again = $this->reply($token, 'coming');

        self::assertSame(['answer' => 'coming', 'at' => '2026-10-19T10:00:00+01:00'], $again['guest']['reply'] ?? null);
        self::assertSame(['coming', '2026-10-19T10:00:00+01:00'], [$this->row($guest)['reply'], $this->row($guest)['repliedAt']]);
        self::assertSame($published, Iter\count(self::service(RecordingHub::class)->published));
        self::assertSame(1, Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM guests WHERE host_id IS NULL')));
    }

    #[Test]
    public function onTwoDevicesTheAnswerSentLastIsTheReply(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);
        $this->open($token);
        $this->open($token);

        $this->reply($token, 'coming');
        $this->reply($token, 'notComing');

        self::assertSame('notComing', $this->row($guest)['reply']);
    }

    #[Test]
    public function aReplySentAtTheStartInTheEventsZoneIsRefused409AndRecordsNothing(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);

        self::mockTime(new DateTimeImmutable(self::START)->modify('-1 second'));
        self::assertSame(true, $this->open($token)['answersOpen'] ?? null);
        $this->reply($token, 'maybe');
        self::assertSame(200, $this->statusCode());

        self::mockTime(new DateTimeImmutable(self::START));
        $this->reply($token, 'coming');

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::RepliesClosed->type(), $this->last()['type'] ?? null);
        self::assertSame('maybe', $this->row($guest)['reply']);
        $page = $this->open($token);
        self::assertSame(false, $page['answersOpen'] ?? null);
        self::assertSame('maybe', $page['guest']['reply']['answer'] ?? null);
    }

    /** @return iterable<string, array{string}> */
    public static function notOffered(): iterable
    {
        yield 'No reply' => ['noReply'];
        yield 'a word the page does not use' => ['yes'];
        yield 'empty' => [''];
    }

    #[Test]
    #[DataProvider('notOffered')]
    public function anAnswerThePageDoesNotOfferIsRefused422AndTheReplyStays(string $answer): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);
        $this->reply($token, 'coming');

        $this->reply($token, $answer);

        self::assertSame(422, $this->statusCode());
        self::assertSame('answer', $this->last()['violations'][0]['propertyPath'] ?? null);
        self::assertSame('coming', $this->row($guest)['reply']);
    }

    #[Test]
    public function aLinkThatDoesNotWorkAnswers404AsAnUnknownTokenAndRecordsNothing(): void
    {
        $guest = $this->add(self::ADAEZE);
        $replaced = $this->token($guest);
        $this->as($this->owner, 'POST', $this->guests() . '/' . $guest . '/link/replace');
        $list = $this->as($this->owner, 'GET', $this->guests());

        $answers = [];
        foreach (['unknown' => Str\repeat('a', 43), 'replaced' => $replaced, 'malformed' => 'x'] as $token) {
            $this->reply($token, 'coming');
            $body = $this->last();
            unset($body['correlationId']);
            $answers[] = [$this->statusCode(), $body];
        }

        self::assertSame(404, $answers[0][0]);
        self::assertSame([$answers[0], $answers[0], $answers[0]], $answers);
        self::assertSame($list, $this->as($this->owner, 'GET', $this->guests()));
    }

    #[Test]
    public function aPausedEventBeforeItsStartKeepsTheAnswerAndRefusesAReply409EventPaused(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);
        $this->reply($token, 'maybe');
        $this->lifecycle('pause');

        $page = $this->open($token);
        $this->reply($token, 'coming');

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::EventPaused->type(), $this->last()['type'] ?? null);
        self::assertSame(['paused', false, false], [$page['phase'] ?? null, $page['started'] ?? null, $page['answersOpen'] ?? null]);
        self::assertSame('maybe', $page['guest']['reply']['answer'] ?? null);
        self::assertSame('maybe', $this->row($guest)['reply']);
    }

    #[Test]
    public function aPausedEventAfterItsStartIsStillPausedAndRefusesAReply409EventPaused(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);
        $this->reply($token, 'coming');
        self::mockTime(new DateTimeImmutable(self::START)->modify('+1 hour'));
        $this->lifecycle('pause');

        $page = $this->open($token);
        $this->reply($token, 'notComing');

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::EventPaused->type(), $this->last()['type'] ?? null);
        self::assertSame(['paused', true, false], [$page['phase'] ?? null, $page['started'] ?? null, $page['answersOpen'] ?? null]);
        self::assertSame('coming', $this->row($guest)['reply']);
    }

    #[Test]
    public function resumingBeforeTheStartOpensAnswersAgain(): void
    {
        $token = $this->token($this->add(self::ADAEZE));
        $this->lifecycle('pause');
        $this->lifecycle('resume');

        $page = $this->open($token);
        $this->reply($token, 'coming');

        self::assertSame(['live', false, true], [$page['phase'] ?? null, $page['started'] ?? null, $page['answersOpen'] ?? null]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aCalledOffEventRefusesAReply409EventConcluded(): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);
        $this->reply($token, 'coming');
        $this->lifecycle('end');

        $page = $this->open($token);
        $this->reply($token, 'notComing');

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::EventConcluded->type(), $this->last()['type'] ?? null);
        self::assertSame(['calledOff', false, false], [$page['phase'] ?? null, $page['started'] ?? null, $page['answersOpen'] ?? null]);
        self::assertSame('coming', $this->row($guest)['reply']);
    }

    /** @return iterable<string, array{string}> */
    public static function finishes(): iterable
    {
        yield 'ended by the host after its start' => ['end'];
        yield 'past its end' => ['clock'];
        yield 'paused past its end' => ['pause'];
    }

    #[Test]
    #[DataProvider('finishes')]
    public function aFinishedEventKeepsTheAnswerAndRefusesAReply409EventConcluded(string $how): void
    {
        $guest = $this->add(self::ADAEZE);
        $token = $this->token($guest);
        $this->reply($token, 'coming');
        self::mockTime(new DateTimeImmutable(self::START)->modify('+1 hour'));

        if ('clock' !== $how) {
            $this->lifecycle($how);
        }

        self::mockTime(new DateTimeImmutable(self::START)->modify('end' === $how ? '+2 hours' : '+11 hours'));
        $page = $this->open($token);
        $this->reply($token, 'notComing');

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::EventConcluded->type(), $this->last()['type'] ?? null);
        self::assertSame(['finished', true, false], [$page['phase'] ?? null, $page['started'] ?? null, $page['answersOpen'] ?? null]);
        self::assertSame('coming', $page['guest']['reply']['answer'] ?? null);
        self::assertSame('coming', $this->row($guest)['reply']);
    }

    #[Test]
    public function aDeletedEventADraftAndAnUnknownTokenAnswerTheSame404(): void
    {
        $deleted = $this->token($this->add(self::ADAEZE));
        $draft = $this->draft('Draft party');
        $drafted = Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT link_token FROM guests WHERE event_id = :id', ['id' => $draft]));
        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId, ['name' => "Amara & Tobi's wedding"]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();

        foreach (['page', 'reply'] as $path) {
            $answers = [];
            foreach ([Str\repeat('a', 43), $deleted, $drafted] as $token) {
                $this->anonymous('/api/guest-links/' . $path, ['token' => $token, 'answer' => 'coming']);
                $body = $this->last();
                unset($body['correlationId']);
                $answers[] = [$this->statusCode(), $body];
            }

            self::assertSame(404, $answers[0][0], $path);
            self::assertSame([$answers[0], $answers[0], $answers[0]], $answers, $path);
        }
    }

    #[Test]
    public function aReplyIsPublishedPrivatelyToThisEventsListAlone(): void
    {
        $guest = $this->add(self::ADAEZE);

        $this->reply($this->token($guest), 'coming');

        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/guests'], $update->getTopics());
        self::assertTrue($update->isPrivate());
        self::assertSame($this->as($this->owner, 'GET', $this->guests()), Json\decode($update->getData()));
    }

    #[Test]
    public function aSubscriberWithoutGuestsReadOnThisEventIsGivenNoToken(): void
    {
        $elsewhere = $this->live('Owambe');
        $outsider = $this->member('ada@ire.events', SeededRole::Member, null);
        self::onEvent($outsider, $elsewhere, EventRole::Lead);

        $this->as($outsider, 'POST', $this->guests() . '/subscriptions');
        self::assertNotSame(200, $this->statusCode());
        self::assertArrayNotHasKey('token', $this->last());

        $this->as($outsider, 'POST', $this->guests($elsewhere) . '/subscriptions');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function eachAnswerIsAuditedWithNoNameOrAnswer(): void
    {
        $this->reply($this->token($this->add(self::ADAEZE)), 'coming');

        $changes = self::em()->getConnection()->fetchFirstColumn('SELECT changes FROM audit_entries WHERE action = :action', ['action' => GuestAnswers::ANSWERED]);
        self::assertCount(1, $changes);
        self::assertStringNotContainsString('coming', Type\string()->coerce($changes[0]));
    }

    /** @param list<string> $companions */
    private function add(string $name, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    /** @return array<string, mixed> */
    private function row(string $guest): array
    {
        $list = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->guests())['guests'] ?? null);

        return Iter\search($list, static fn (array $row): bool => $row['id'] === $guest) ?? self::fail('no such guest');
    }

    private function token(string $guest): string
    {
        $body = $this->as($this->owner, 'GET', $this->guests() . '/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    /** @return array<string, mixed> */
    private function open(#[SensitiveParameter] string $token): array
    {
        return $this->anonymous('/api/guest-links/page', ['token' => $token]);
    }

    /** @return array<string, mixed> */
    private function reply(#[SensitiveParameter] string $token, string $answer): array
    {
        return $this->anonymous('/api/guest-links/reply', ['token' => $token, 'answer' => $answer]);
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

    private function lifecycle(string $action): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/' . $action);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function draft(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        $this->as($this->owner, 'POST', $this->guests($id), ['fullName' => 'Bisi Adewale', 'companions' => []]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return $id;
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

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
