<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
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

final class ReplyByTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

    private const string START = '2030-11-14T16:00:00+00:00';

    private const string NOW = '2030-10-20T09:00:00+00:00';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2030-03-01T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function anEventWithoutReplyByStaysOpenUntilItsStart(): void
    {
        $token = $this->token($this->add(self::ADAEZE));
        $event = $this->event();

        self::assertSame([true, true, true, true], [Iter\contains_key($event, 'replyBy'), Iter\contains_key($event, 'repliesCloseAt'), Iter\contains_key($event, 'repliesClosedOn'), Iter\contains_key($this->open($token), 'answersClosedOn')]);
        self::assertSame([null, null, null], [$event['replyBy'] ?? null, $event['repliesCloseAt'] ?? null, $event['repliesClosedOn'] ?? null]);
        $page = $this->open($token);
        self::assertSame([null, true, null], [$page['event']['replyBy'] ?? null, $page['answersOpen'] ?? null, $page['answersClosedOn'] ?? null]);
        self::assertSame([], Vec\filter($this->milestones(), static fn (array $one): bool => 'Replies close' === $one['title']));
    }

    #[Test]
    public function aReplyByOnOrAfterTheStartIsRefusedAndSavesNothing(): void
    {
        foreach (['2030-11-14', '2030-11-20'] as $day) {
            $this->patch(['replyBy' => $day]);

            self::assertSame(422, $this->statusCode());
            self::assertSame(['replyBy', 'Choose a date before the event starts.'], [$this->last()['violations'][0]['propertyPath'] ?? null, $this->last()['violations'][0]['message'] ?? null]);
        }

        $this->patch(['replyBy' => '14 Nov']);
        self::assertSame([422, 'replyBy'], [$this->statusCode(), $this->last()['violations'][0]['propertyPath'] ?? null]);
        self::assertNull($this->event()['replyBy'] ?? null);
    }

    #[Test]
    public function theEventSaysWhenRepliesCloseAndClearingItRemovesTheDeadline(): void
    {
        $saved = $this->patch(['replyBy' => '2030-11-13']);

        self::assertSame(200, $this->statusCode(), Json\encode($saved));
        self::assertSame(['2030-11-13', '2030-11-13T23:59:59+00:00', null], [$saved['event']['replyBy'] ?? null, $saved['event']['repliesCloseAt'] ?? null, $saved['event']['repliesClosedOn'] ?? null]);
        self::assertSame(
            [['at' => '2030-11-13T23:59:59+00:00', 'title' => 'Replies close', 'owner' => 'automatic', 'area' => 'guests']],
            Vec\filter($this->milestones(), static fn (array $one): bool => 'Replies close' === $one['title']),
        );

        $cleared = $this->patch(['replyBy' => null]);

        self::assertSame([null, null], [$cleared['event']['replyBy'] ?? null, $cleared['event']['repliesCloseAt'] ?? null]);
    }

    /** @return iterable<string, array{string, string}> */
    public static function changesOfClocks(): iterable
    {
        yield 'the day the clocks go forward' => ['2030-03-31', '2030-03-31T23:59:59+01:00'];
        yield 'the day before the clocks go back' => ['2030-10-26', '2030-10-26T23:59:59+01:00'];
        yield 'the day the clocks go back' => ['2030-10-27', '2030-10-27T23:59:59+00:00'];
    }

    #[Test]
    #[DataProvider('changesOfClocks')]
    public function answersCloseAtTheLastSecondOfReplyByInTheEventsZone(string $day, string $closesAt): void
    {
        $token = $this->token($this->add(self::ADAEZE));
        self::assertSame($closesAt, $this->patch(['replyBy' => $day])['event']['repliesCloseAt'] ?? null);

        self::mockTime(new DateTimeImmutable($closesAt)->modify('-1 second'));
        self::assertSame(true, $this->open($token)['answersOpen'] ?? null);
        $this->reply($token, 'maybe');
        self::assertSame(200, $this->statusCode());

        self::mockTime(new DateTimeImmutable($closesAt));
        $this->reply($token, 'coming');

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::RepliesClosed->type(), $this->last()['type'] ?? null);
        $page = $this->open($token);
        self::assertSame([false, $day, 'maybe'], [$page['answersOpen'] ?? null, $page['answersClosedOn'] ?? null, $page['guest']['reply']['answer'] ?? null]);
        self::assertSame($day, $this->event()['repliesClosedOn'] ?? null);
    }

    #[Test]
    public function lettingOneGuestChangeTheirReplyOpensItForThemAloneUntilTheStart(): void
    {
        $adaeze = $this->add(self::ADAEZE);
        $bisi = $this->add('Bisi Adewale');
        $this->patch(['replyBy' => '2030-10-19']);
        self::mockTime(new DateTimeImmutable(self::NOW));

        $reopened = $this->as($this->owner, 'POST', $this->guests() . '/' . $adaeze . '/reopen-replies');
        $again = $this->as($this->owner, 'POST', $this->guests() . '/' . $adaeze . '/reopen-replies');

        self::assertSame(200, $this->statusCode(), Json\encode($again));
        self::assertSame(['by' => 'Person', 'at' => '2030-10-20T10:00:00+01:00'], $reopened['guest']['repliesReopened'] ?? null);
        self::assertSame($reopened['guest']['repliesReopened'], $again['guest']['repliesReopened'] ?? null);
        $page = $this->open($this->token($adaeze));
        self::assertSame([true, null], [$page['answersOpen'] ?? null, $page['answersClosedOn'] ?? null]);
        $this->reply($this->token($adaeze), 'coming');
        self::assertSame(200, $this->statusCode());
        $this->reply($this->token($bisi), 'coming');
        self::assertSame(409, $this->statusCode());
        self::assertNull($this->row($bisi)['repliesReopened'] ?? null);

        self::mockTime(new DateTimeImmutable(self::START));
        $this->reply($this->token($adaeze), 'notComing');
        self::assertSame(409, $this->statusCode());
    }

    #[Test]
    public function onlyAMemberWhoManagesGuestsCanReopenOne(): void
    {
        $adaeze = $this->add(self::ADAEZE);
        $stranger = $this->account('stranger@elsewhere.events');

        $this->as($stranger, 'POST', $this->guests() . '/' . $adaeze . '/reopen-replies');

        self::assertSame(404, $this->statusCode());
        self::assertNull($this->row($adaeze)['repliesReopened'] ?? null);
    }

    #[Test]
    public function movingReplyByEarlierClosesRepliesOnTheDayOfTheSaveAndMovingItLaterReopensThem(): void
    {
        $token = $this->token($this->add(self::ADAEZE));
        $this->patch(['replyBy' => '2030-11-01']);
        self::mockTime(new DateTimeImmutable(self::NOW));

        self::assertSame(['2030-10-10', '2030-10-20'], $this->closed($this->patch(['replyBy' => '2030-10-10'])));
        self::assertSame([false, '2030-10-20'], [$this->open($token)['answersOpen'] ?? null, $this->open($token)['answersClosedOn'] ?? null]);

        self::mockTime(new DateTimeImmutable('2030-10-21T09:00:00+00:00'));
        self::assertSame(['2030-10-05', '2030-10-20'], $this->closed($this->patch(['replyBy' => '2030-10-05'])));

        self::assertSame(['2030-10-25', null], $this->closed($this->patch(['replyBy' => '2030-10-25'])));
        self::assertSame(true, $this->open($token)['answersOpen'] ?? null);

        self::assertSame(['2030-10-21', null], $this->closed($this->patch(['replyBy' => '2030-10-21'])));
        self::mockTime(new DateTimeImmutable('2030-10-22T09:00:00+00:00'));
        self::assertSame('2030-10-21', $this->event()['repliesClosedOn'] ?? null);
    }

    /** @return iterable<string, array{string, string, ?string}> */
    public static function startsMovedOntoReplyBy(): iterable
    {
        yield 'to tomorrow' => ['2030-10-21T16:00', '2030-10-20', null];
        yield 'to today' => ['2030-10-20T18:00', '2030-10-19', '2030-10-20'];
    }

    #[Test]
    #[DataProvider('startsMovedOntoReplyBy')]
    public function aStartMovedOntoReplyByMovesItToTheDayBefore(string $startsAt, string $replyBy, ?string $closedOn): void
    {
        $this->patch(['replyBy' => '2030-11-10']);
        self::mockTime(new DateTimeImmutable(self::NOW));

        $saved = $this->patch(['startsAt' => $startsAt]);

        self::assertSame(200, $this->statusCode(), Json\encode($saved));
        self::assertSame([$replyBy, $closedOn], $this->closed($saved));
    }

    #[Test]
    public function aStartMovedLaterLeavesReplyByAlone(): void
    {
        $this->patch(['replyBy' => '2030-11-10']);

        self::assertSame(['2030-11-10', null], $this->closed($this->patch(['startsAt' => '2030-11-20T16:00', 'endsAt' => '2030-11-21T02:00'])));
    }

    #[Test]
    public function aComingGuestCanStillTellTheKitchenAfterReplyByAndNothingElseChanges(): void
    {
        $adaeze = $this->add(self::ADAEZE, ['Obi Okonkwo']);
        $token = $this->token($adaeze);
        $obi = Type\string()->coerce($this->open($token)['guest']['companions'][0]['id'] ?? null);
        $this->anonymous('/api/guest-links/reply', ['token' => $token, 'answer' => 'coming', 'companions' => [['id' => $obi, 'fullName' => 'Obi Okonkwo', 'coming' => true]]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $repliedAt = $this->open($token)['guest']['reply']['at'] ?? null;
        $this->patch(['replyBy' => '2030-10-19']);
        self::mockTime(new DateTimeImmutable(self::NOW));

        $page = $this->anonymous('/api/guest-links/needs', ['token' => $token, 'needs' => ['diet' => ['halal']], 'companions' => [['id' => $obi, 'needs' => ['allergies' => ['peanuts']]]]]);

        self::assertSame(200, $this->statusCode(), Json\encode($page));
        self::assertSame(['halal'], $page['guest']['needs']['diet'] ?? null);
        self::assertSame(['peanuts'], $page['guest']['companions'][0]['needs']['allergies'] ?? null);
        self::assertSame(['coming', $repliedAt, false], [$page['guest']['reply']['answer'] ?? null, $page['guest']['reply']['at'] ?? null, $page['answersOpen'] ?? null]);
        self::assertSame('coming', $this->row($adaeze)['reply']);

        $this->anonymous('/api/guest-links/needs', ['token' => $token, 'companions' => [['id' => $adaeze, 'needs' => ['diet' => ['vegan']]]]]);
        self::assertSame([422, 'companions[0].id'], [$this->statusCode(), $this->last()['violations'][0]['propertyPath'] ?? null]);

        self::mockTime(new DateTimeImmutable(self::START));
        $this->anonymous('/api/guest-links/needs', ['token' => $token, 'needs' => ['diet' => []]]);
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::RepliesClosed->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aGuestWhoIsNotComingCannotTellTheKitchen(): void
    {
        $token = $this->token($this->add('Bisi Adewale'));
        $this->reply($token, 'maybe');

        $this->anonymous('/api/guest-links/needs', ['token' => $token, 'needs' => ['diet' => ['halal']]]);

        self::assertSame([422, 'answer'], [$this->statusCode(), $this->last()['violations'][0]['propertyPath'] ?? null]);
    }

    /** @return array{mixed, mixed} */
    private function closed(array $saved): array
    {
        self::assertSame(200, $this->statusCode(), Json\encode($saved));

        return [$saved['event']['replyBy'] ?? null, $saved['event']['repliesClosedOn'] ?? null];
    }

    /** @return array<string, mixed> */
    private function patch(array $fields): array
    {
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');

        return $this->as($this->owner, 'PATCH', '/api/events/' . $this->eventId, $fields, $tag);
    }

    /** @return array<string, mixed> */
    private function event(): array
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['event'] ?? null);
    }

    /** @return list<array{at: string, title: string, owner: string, area: string}> */
    private function milestones(): array
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/timeline');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Vec\map(
            Type\vec(Type\shape(['at' => Type\string(), 'title' => Type\string(), 'owner' => Type\string(), 'area' => Type\string()], true))->coerce($body['milestones'] ?? null),
            static fn (array $one): array => ['at' => $one['at'], 'title' => $one['title'], 'owner' => $one['owner'], 'area' => $one['area']],
        );
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

    /** @return array<string, mixed> */
    private function anonymous(string $path, #[SensitiveParameter] array $body): array
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));

        return $this->last();
    }

    private function live(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Europe/London', 'currency' => 'GBP']);
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

    /** @return array<string, mixed> */
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
