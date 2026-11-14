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
use Psl\Dict;
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
        $obi = $this->companionsOn($token)[0]['id'] ?? self::fail('no companion');
        self::assertSame([
            'fullName' => self::ADAEZE,
            'reply' => null,
            'places' => 1,
            'companions' => [['id' => $obi, 'fullName' => 'Obi Okonkwo', 'coming' => true, 'namedByGuest' => false]],
        ], $page['guest'] ?? null);
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

    /** @return iterable<string, array{string, string, array<string, int>}> */
    public static function answers(): iterable
    {
        yield 'Coming' => ['coming', 'coming', ['accepted' => 2, 'maybe' => 0, 'held' => 0, 'declined' => 0]];
        yield 'Not coming' => ['notComing', 'held', ['accepted' => 0, 'maybe' => 0, 'held' => 1, 'declined' => 1]];
        yield 'Not sure yet' => ['maybe', 'held', ['accepted' => 0, 'maybe' => 1, 'held' => 1, 'declined' => 0]];
    }

    /** @param array<string, int> $headcount */
    #[Test]
    #[DataProvider('answers')]
    public function eachAnswerIsRecordedWithItsDateAndWhereItWasGiven(string $answer, string $companion, array $headcount): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);

        $page = $this->reply($this->token($guest), $answer);

        self::assertSame(200, $this->statusCode(), Json\encode($page));
        self::assertSame(['answer' => $answer, 'at' => '2026-10-17T14:20:00+01:00'], $page['guest']['reply'] ?? null);
        $row = $this->row($guest);
        self::assertSame([$answer, '2026-10-17T14:20:00+01:00', 'guestPage'], [$row['reply'], $row['repliedAt'], $row['replySource']]);
        self::assertSame([$companion], Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($row['companions']), static fn (array $one): mixed => $one['state']));
        $counts = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/headcount')['headcount']['counts'] ?? null);
        self::assertSame($headcount, Dict\select_keys($counts, Vec\keys($headcount)));
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

        $update = self::service(RecordingHub::class)->lastOn('events/' . $this->eventId . '/guests') ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/guests'], $update->getTopics());
        self::assertTrue($update->isPrivate());
        $viewer = $this->member('ada@ire.events', SeededRole::Member, EventRole::CanView);
        self::assertSame($this->as($viewer, 'GET', $this->guests()), Json\decode($update->getData()));
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

    #[Test]
    public function thePageListsTheNamedCompanionsAndCountsEveryPlace(): void
    {
        $token = $this->token($this->add(self::ADAEZE, ['Chidi Okonkwo-Williams', null]));

        $guest = Type\shape(['places' => Type\int(), 'companions' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)->coerce($this->open($token)['guest'] ?? null);

        self::assertSame(2, $guest['places']);
        self::assertCount(1, $guest['companions']);
        self::assertSame(['Chidi Okonkwo-Williams', true, false], [$guest['companions'][0]['fullName'] ?? null, $guest['companions'][0]['coming'] ?? null, $guest['companions'][0]['namedByGuest'] ?? null]);
    }

    /** @return iterable<string, array{string, bool, string, array<string, int>}> */
    public static function companionChoices(): iterable
    {
        yield 'Coming, companion left Coming' => ['coming', true, 'coming', ['accepted' => 2, 'held' => 0, 'declined' => 0]];
        yield 'Coming, companion marked Not coming' => ['coming', false, 'notComing', ['accepted' => 1, 'held' => 0, 'declined' => 1]];
        yield 'Not sure yet, companion left Coming' => ['maybe', true, 'held', ['accepted' => 0, 'held' => 1, 'declined' => 0]];
        yield 'Not sure yet, companion marked Not coming' => ['maybe', false, 'held', ['accepted' => 0, 'held' => 1, 'declined' => 0]];
        yield 'Not coming, companion left Coming' => ['notComing', true, 'held', ['accepted' => 0, 'held' => 1, 'declined' => 1]];
        yield 'Not coming, companion marked Not coming' => ['notComing', false, 'held', ['accepted' => 0, 'held' => 1, 'declined' => 1]];
    }

    /** @param array<string, int> $headcount */
    #[Test]
    #[DataProvider('companionChoices')]
    public function aCompanionIsNotComingOnlyWhenTheGuestIsComingAndUntickedThemAndTheCountsMoveWithIt(string $answer, bool $coming, string $state, array $headcount): void
    {
        $guest = $this->add(self::ADAEZE, ['Chidi Okonkwo-Williams']);
        $token = $this->token($guest);
        $chidi = $this->companionsOn($token)[0]['id'] ?? self::fail('no companion');

        $this->answerWith($token, $answer, [['id' => $chidi, 'fullName' => 'Chidi Okonkwo-Williams', 'coming' => $coming]]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([$state], $this->states($guest));
        $counts = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/headcount')['headcount']['counts'] ?? null);
        self::assertSame($headcount, Dict\select_keys($counts, Vec\keys($headcount)));
    }

    #[Test]
    public function backToComingEachCompanionIsAsTheGuestLastChose(): void
    {
        $guest = $this->add(self::ADAEZE, ['Chidi Okonkwo-Williams', 'Nneka Okonkwo-Williams']);
        $token = $this->token($guest);
        [$chidi, $nneka] = Vec\map($this->companionsOn($token), static fn (array $one): mixed => $one['id']);
        $this->answerWith($token, 'coming', [
            ['id' => $chidi, 'fullName' => 'Chidi Okonkwo-Williams', 'coming' => true],
            ['id' => $nneka, 'fullName' => 'Nneka Okonkwo-Williams', 'coming' => false],
        ]);

        $this->reply($token, 'maybe');
        self::assertSame(['held', 'held'], $this->states($guest));

        $this->reply($token, 'coming');
        self::assertSame(['coming', 'notComing'], $this->states($guest));
    }

    #[Test]
    public function aNameTheGuestAddsFillsAnUnnamedPlaceAndOneBeyondThePlacesIsRefused422(): void
    {
        $guest = $this->add(self::ADAEZE, ['Chidi Okonkwo-Williams', null]);
        $token = $this->token($guest);

        $this->answerWith($token, 'coming', [['fullName' => 'Nneka Okonkwo-Williams', 'coming' => true], ['fullName' => 'Ike Okonkwo-Williams', 'coming' => true]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('companions', $this->last()['violations'][0]['propertyPath'] ?? null);
        $unnamed = Type\dict(Type\string(), Type\mixed())->coerce($this->row($guest)['companions'][1] ?? null);
        self::assertArrayHasKey('fullName', $unnamed);
        self::assertNull($unnamed['fullName']);
        self::assertSame('noReply', $this->row($guest)['reply']);

        $this->answerWith($token, 'coming', [['fullName' => '  Nneka Okonkwo-Williams ', 'coming' => true]]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['Chidi Okonkwo-Williams', 'Nneka Okonkwo-Williams'], Vec\map($this->companionsOn($token), static fn (array $one): mixed => $one['fullName']));
        self::assertSame(2, Type\shape(['places' => Type\int()], true)->coerce($this->open($token)['guest'] ?? null)['places']);
    }

    #[Test]
    public function aBlankNameAndACompanionOfAnotherGuestAreRefused422(): void
    {
        $token = $this->token($this->add(self::ADAEZE, [null]));
        $other = $this->token($this->add('Bisi Adewale', ['Tunde Adewale']));
        $tunde = $this->companionsOn($other)[0]['id'] ?? self::fail('no companion');

        $this->answerWith($token, 'coming', [['fullName' => '   ', 'coming' => true]]);
        self::assertSame([422, 'companions[0].fullName'], [$this->statusCode(), $this->last()['violations'][0]['propertyPath'] ?? null]);

        $this->answerWith($token, 'coming', [['id' => $tunde, 'fullName' => 'Mine now', 'coming' => true]]);
        self::assertSame([422, 'companions[0].id'], [$this->statusCode(), $this->last()['violations'][0]['propertyPath'] ?? null]);
    }

    #[Test]
    public function aGuestsRenameIsNamedByTheGuestUntilTheHostChangesTheName(): void
    {
        $guest = $this->add(self::ADAEZE, ['Chidi Okonkwo Wiliams']);
        $token = $this->token($guest);
        $chidi = $this->companionsOn($token)[0]['id'] ?? self::fail('no companion');

        $this->answerWith($token, 'coming', [['id' => $chidi, 'fullName' => 'Chidi Okonkwo-Williams', 'coming' => true]]);

        $companion = $this->row($guest)['companions'][0] ?? self::fail('no companion');
        self::assertSame(['Chidi Okonkwo-Williams', true], [$companion['fullName'] ?? null, $companion['namedByGuest'] ?? null]);
        self::assertTrue($this->companionsOn($token)[0]['namedByGuest'] ?? null);

        $this->as($this->owner, 'PUT', $this->guests() . '/' . $guest, ['fullName' => self::ADAEZE, 'companions' => [['id' => $chidi, 'fullName' => 'Chidi Okonkwo-Williams']]], '"1"');
        self::assertTrue($this->row($guest)['companions'][0]['namedByGuest'] ?? null, 'the host saving the same name keeps whose it is');

        $this->as($this->owner, 'PUT', $this->guests() . '/' . $guest, ['fullName' => self::ADAEZE, 'companions' => [['id' => $chidi, 'fullName' => 'Chief Chidi Okonkwo-Williams']]], '"1"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertFalse($this->row($guest)['companions'][0]['namedByGuest'] ?? null);
    }

    #[Test]
    public function aGuestWithNoPlacesRepliesAsBeforeAndTheHostsNamesStayUnlessTheGuestChangesThem(): void
    {
        $alone = $this->token($this->add('Bisi Adewale'));
        $this->reply($alone, 'coming');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $guest = $this->add(self::ADAEZE, ['Chidi Okonkwo-Williams']);
        $this->reply($this->token($guest), 'coming');
        self::assertSame(['Chidi Okonkwo-Williams', false], [$this->row($guest)['companions'][0]['fullName'] ?? null, $this->row($guest)['companions'][0]['namedByGuest'] ?? null]);
    }

    /** @return list<array<string, mixed>> */
    private function companionsOn(#[SensitiveParameter] string $token): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->open($token)['guest']['companions'] ?? null);
    }

    /** @return list<mixed> */
    private function states(string $guest): array
    {
        return Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->row($guest)['companions']), static fn (array $one): mixed => $one['state']);
    }

    /**
     * @param list<array<string, mixed>> $companions
     *
     * @return array<string, mixed>
     */
    private function answerWith(#[SensitiveParameter] string $token, string $answer, array $companions): array
    {
        return $this->anonymous('/api/guest-links/reply', ['token' => $token, 'answer' => $answer, 'companions' => $companions]);
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
     * @param array<string, mixed> $body
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
