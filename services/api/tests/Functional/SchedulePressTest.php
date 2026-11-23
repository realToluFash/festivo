<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Messaging\NotificationPreferenceSetter;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\RunOfShow\Card\RunOfShowCard;
use App\Domain\RunOfShow\ScheduleEditor;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\SchedulePress;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Double\Messaging\RecordingPushSender;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\TestWith;
use Psl\Dict;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Done, Start now and Skip on the night screen (sc-3895): one item Now per track, idempotent presses, and the state replayed in the order they were pressed. */
final class SchedulePressTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private User $colleague;

    private Organisation $organisation;

    private string $eventId;

    private int $keys = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent('2027-03-06T16:00', '2027-03-07T02:00', 'Africa/Lagos');
        $this->colleague = $this->member('tunde@ire.events', 'Tunde Bello', EventRole::CanEdit);
        self::mockTime(new DateTimeImmutable('2027-03-06T18:30:00Z'));
    }

    #[Test]
    public function eachPressIsTimedByThePressersClockAndLeavesThePlannedStart(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00', lengthMinutes: 30);

        self::mockTime(new DateTimeImmutable('2027-03-06T18:12:42Z'));
        $this->press($this->owner, $id, 'start', '2027-03-06T19:12:40+01:00');
        self::assertSame(200, $this->statusCode());

        self::mockTime(new DateTimeImmutable('2027-03-06T18:47:09Z'));
        $this->press($this->owner, $id, 'done', '2027-03-06T19:47:05+01:00');
        self::assertSame(200, $this->statusCode());

        $item = $this->item($id);
        self::assertSame(
            ['2027-03-06T19:00:00+01:00', '2027-03-06T19:12:40+01:00', '2027-03-06T19:47:05+01:00', false],
            [$item['startsAt'], $item['startedAt'], $item['endedAt'], $item['skipped']],
        );
    }

    #[Test]
    public function aPressWhileTheHubIsDownIsKeptAndAnsweredAsUsualAndItsReplayAnswersTheSameAndPublishesNothing(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');
        $hub = self::service(RecordingHub::class);
        $hub->published = [];
        $hub->failuresLeft = 2;

        $first = $this->press($this->owner, $id, 'start', '2027-03-06T19:12:40+01:00', 'hub-down');
        self::assertSame(200, $this->statusCode(), Json\encode($first));
        self::assertSame(0, $hub->failuresLeft);
        $again = $this->press($this->owner, $id, 'start', '2027-03-06T19:12:40+01:00', 'hub-down');
        self::assertSame(200, $this->statusCode(), Json\encode($again));

        self::assertSame($first, $again);
        self::assertSame([], $hub->published);

        self::assertSame('2027-03-06T19:12:40+01:00', $this->item($id)['startedAt']);
        self::assertCount(1, self::em()->getRepository(SchedulePress::class)->findAll());
    }

    #[Test]
    public function aPressWithNoTimeIsTakenAsPressedNow(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');

        $this->press($this->owner, $id, 'start');

        self::assertSame('2027-03-06T19:30:00+01:00', $this->item($id)['startedAt']);
    }

    #[Test]
    public function oneItemIsNowPerTrackAndASecondIsRefusedWithWhoStartedTheFirst(): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00', 'Ballroom');
        $dance = $this->add('First dance', '2027-03-06T19:30', 'Ballroom');
        $carriages = $this->add('Carriages', '2027-03-06T19:30', 'Foyer');

        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:20:00+01:00');
        $refused = $this->press($this->colleague, $dance, 'start', '2027-03-06T19:21:00+01:00');
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/track_busy', $refused['type'] ?? null);
        self::assertSame(['name' => 'Ifeoma Nduka', 'at' => '2027-03-06T19:20:00+01:00'], $refused['superseded_by'] ?? null);
        self::assertNull($this->item($dance)['startedAt']);

        $this->press($this->colleague, $carriages, 'start', '2027-03-06T19:22:00+01:00');
        self::assertSame(200, $this->statusCode());

        $this->press($this->owner, $speeches, 'done', '2027-03-06T19:25:00+01:00');
        $this->press($this->colleague, $dance, 'start', '2027-03-06T19:26:00+01:00');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    #[TestWith(['a-done', 'z-start'])]
    #[TestWith(['z-done', 'a-start'])]
    public function aDoneAndAStartInOneSecondKeepTheirOrderWhicheverKeySortsFirst(string $doneKey, string $startKey): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00', 'Ballroom');
        $dance = $this->add('First dance', '2027-03-06T19:30', 'Ballroom');
        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:05:00.000+01:00');

        $this->press($this->owner, $speeches, 'done', '2027-03-06T19:25:00.100+01:00', $doneKey);
        self::assertSame(200, $this->statusCode());
        $this->press($this->owner, $dance, 'start', '2027-03-06T19:25:00.400+01:00', $startKey);
        self::assertSame(200, $this->statusCode());

        self::assertSame('2027-03-06T19:25:00+01:00', $this->item($speeches)['endedAt']);
        self::assertSame('2027-03-06T19:25:00+01:00', $this->item($dance)['startedAt']);
    }

    #[Test]
    public function aLaterItemCanBeStartedBeforeEarlierOnesHave(): void
    {
        $this->add('Speeches', '2027-03-06T19:00');
        $cake = $this->add('Cake cutting', '2027-03-06T20:00');

        $this->press($this->owner, $cake, 'start', '2027-03-06T19:20:00+01:00');

        self::assertSame(200, $this->statusCode());
        self::assertSame('2027-03-06T19:20:00+01:00', $this->item($cake)['startedAt']);
    }

    #[Test]
    public function anItemAtHalfPastMidnightIsOnTheTrackOfTheNightBefore(): void
    {
        $band = $this->add('Band', '2027-03-06T23:00');
        $carriages = $this->add('Carriages', '2027-03-07T00:30');

        self::mockTime(new DateTimeImmutable('2027-03-06T23:40:00Z'));
        $this->press($this->owner, $band, 'start', '2027-03-06T23:05:00+01:00');
        $refused = $this->press($this->owner, $carriages, 'start', '2027-03-07T00:35:00+01:00');

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/track_busy', $refused['type'] ?? null);
    }

    #[Test]
    public function aSkipTakesNoTimeFreesTheTrackAndEndsTheItem(): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00');
        $dance = $this->add('First dance', '2027-03-06T19:30');

        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:10:00+01:00');
        $this->press($this->owner, $speeches, 'skip', '2027-03-06T19:11:00+01:00');
        self::assertSame(200, $this->statusCode());

        $skipped = $this->item($speeches);
        self::assertSame([true, null, null], [$skipped['skipped'], $skipped['startedAt'], $skipped['endedAt']]);

        $this->press($this->owner, $dance, 'start', '2027-03-06T19:12:00+01:00');
        self::assertSame(200, $this->statusCode());

        $refused = $this->press($this->owner, $speeches, 'start', '2027-03-06T19:13:00+01:00');
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/item_finished', $refused['type'] ?? null);
    }

    #[Test]
    public function anItemIsDoneOnceAndOnlyAfterItStarted(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');

        $refused = $this->press($this->owner, $id, 'done', '2027-03-06T19:10:00+01:00');
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/item_not_started', $refused['type'] ?? null);

        $this->press($this->owner, $id, 'start', '2027-03-06T19:11:00+01:00');
        $this->press($this->owner, $id, 'done', '2027-03-06T19:12:00+01:00');
        $refused = $this->press($this->colleague, $id, 'done', '2027-03-06T19:13:00+01:00');
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/item_finished', $refused['type'] ?? null);
        self::assertSame(['name' => 'Ifeoma Nduka', 'at' => '2027-03-06T19:12:00+01:00'], $refused['superseded_by'] ?? null);
    }

    #[Test]
    public function theSameKeySentAgainAnswersAsTheFirstTimeAndChangesNothing(): void
    {
        $drinks = $this->add('Drinks', '2027-03-06T18:00');
        $this->press($this->owner, $drinks, 'start', '2027-03-06T18:00:00+01:00');
        $this->press($this->owner, $drinks, 'done', '2027-03-06T19:00:00+01:00');
        $id = $this->add('Speeches', '2027-03-06T19:00');
        $hub = self::service(RecordingHub::class);

        $first = $this->press($this->owner, $id, 'start', '2027-03-06T19:10:00+01:00', 'press-1');
        self::assertSame(200, $this->statusCode());
        $published = $hub->published;
        self::assertCount(1, $this->cards());
        $again = $this->press($this->owner, $id, 'start', '2027-03-06T19:10:00+01:00', 'press-1');
        self::assertSame(200, $this->statusCode());

        self::assertSame($first, $again);
        self::assertSame(2, $this->item($id)['version']);
        self::assertSame(3, $this->item($drinks)['version']);
        self::assertSame($published, $hub->published);
        self::assertSame([], $this->cards());
        self::assertCount(3, self::em()->getRepository(SchedulePress::class)->findAll());
        self::assertCount(1, self::em()->getRepository(AuditEntry::class)->findBy(['action' => ScheduleEditor::PRESSED['start'], 'subjectId' => $id]));
        self::assertSame('2027-03-06T19:10:00+01:00', $this->item($id)['startedAt']);
    }

    #[Test]
    public function theSameKeySentAgainAfterItWasSetAsideIsRefusedAgainAndPublishesNothing(): void
    {
        $drinks = $this->add('Drinks', '2027-03-06T17:00', 'Garden');
        $dance = $this->add('First dance', '2027-03-06T18:00', 'Garden');
        $this->press($this->owner, $drinks, 'start', '2027-03-06T17:05:00+01:00');
        $first = $this->press($this->colleague, $dance, 'start', '2027-03-06T17:10:00+01:00', 'busy-1');
        self::assertSame(409, $this->statusCode(), Json\encode($first));
        $hub = self::service(RecordingHub::class);
        $published = $hub->published;

        $again = $this->press($this->colleague, $dance, 'start', '2027-03-06T17:10:00+01:00', 'busy-1');

        self::assertSame(409, $this->statusCode());
        $answered = static fn (array $problem): array => Dict\filter_keys($problem, static fn (int|string $member): bool => 'correlationId' !== $member);
        self::assertSame($answered($first), $answered($again));
        self::assertSame($published, $hub->published);
    }

    #[Test]
    public function aPressChangesTheVersionOfOnlyTheItemsItChanges(): void
    {
        $drinks = $this->add('Drinks', '2027-03-06T18:00');
        $this->press($this->owner, $drinks, 'start', '2027-03-06T18:00:00+01:00');
        $this->press($this->owner, $drinks, 'done', '2027-03-06T19:00:00+01:00');
        self::assertSame(3, $this->item($drinks)['version']);
        $speeches = $this->add('Speeches', '2027-03-06T19:00');
        self::assertSame(1, $this->item($speeches)['version']);

        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:10:00+01:00');

        self::assertSame(3, $this->item($drinks)['version']);
        self::assertSame(2, $this->item($speeches)['version']);
        $this->as($this->owner, 'PUT', $this->items($drinks), ['title' => 'Welcome drinks', 'startsAt' => '2027-03-06T18:00'], ifMatch: '"3"');
        self::assertSame(200, $this->statusCode());
        $refused = $this->as($this->owner, 'PUT', $this->items($speeches), ['title' => 'Toasts', 'startsAt' => '2027-03-06T19:00'], ifMatch: '"1"');
        self::assertSame(412, $this->statusCode());
        self::assertSame('https://soirely.com/errors/precondition_failed', $refused['type'] ?? null);
    }

    #[Test]
    public function theSameKeyWithAnotherPressIsRefused(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');

        $this->press($this->owner, $id, 'start', '2027-03-06T19:10:00+01:00', 'press-1');
        $refused = $this->press($this->owner, $id, 'skip', '2027-03-06T19:10:00+01:00', 'press-1');

        self::assertSame(422, $this->statusCode());
        self::assertSame('https://soirely.com/errors/idempotency_key_reused', $refused['type'] ?? null);
        self::assertFalse($this->item($id)['skipped']);
    }

    #[Test]
    public function aPressWithoutAKeyIsRefused(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');

        $refused = $this->as($this->owner, 'POST', $this->items($id) . '/presses', ['kind' => 'start']);

        self::assertSame(400, $this->statusCode());
        self::assertSame('https://soirely.com/errors/idempotency_key_required', $refused['type'] ?? null);
        self::assertNull($this->item($id)['startedAt']);
    }

    #[Test]
    public function aLateEarlierPressOverturnsALaterOneAlreadyApplied(): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00');

        $this->press($this->colleague, $speeches, 'start', '2027-03-06T19:05:00+01:00', 'tunde-1');
        self::assertSame('2027-03-06T19:05:00+01:00', $this->item($speeches)['startedAt']);

        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:02:00+01:00', 'ifeoma-1');
        self::assertSame(200, $this->statusCode());
        self::assertSame('2027-03-06T19:02:00+01:00', $this->item($speeches)['startedAt']);

        $update = self::service(RecordingHub::class)->lastOn('events/' . $this->eventId . '/schedule') ?? self::fail('nothing published');
        $published = Type\shape(['items' => Type\vec(Type\shape(['startedAt' => Type\nullable(Type\string())], true))], true)->coerce(Json\decode($update->getData()));
        self::assertSame('2027-03-06T19:02:00+01:00', $published['items'][0]['startedAt']);

        $refused = $this->press($this->colleague, $speeches, 'start', '2027-03-06T19:05:00+01:00', 'tunde-1');
        self::assertSame(409, $this->statusCode());
        self::assertSame(['name' => 'Ifeoma Nduka', 'at' => '2027-03-06T19:02:00+01:00'], $refused['superseded_by'] ?? null);
    }

    #[Test]
    public function aLatePressThatWouldChangeAnotherItemIsRefusedAndNeverCounts(): void
    {
        $drinks = $this->add('Welcome drinks', '2027-03-06T17:00');
        $speeches = $this->add('Speeches', '2027-03-06T18:00');
        $dance = $this->add('First dance', '2027-03-06T19:00');
        $this->press($this->owner, $drinks, 'start', '2027-03-06T17:05:00+01:00');
        $this->press($this->owner, $drinks, 'done', '2027-03-06T17:50:00+01:00');
        $this->press($this->colleague, $speeches, 'start', '2027-03-06T18:00:00+01:00');
        $this->press($this->colleague, $speeches, 'done', '2027-03-06T18:40:00+01:00');

        $refused = $this->press($this->colleague, $dance, 'start', '2027-03-06T16:00:00+01:00', 'offline-1');

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/track_busy', $refused['type'] ?? null);
        self::assertSame(['name' => 'Ifeoma Nduka', 'at' => '2027-03-06T17:05:00+01:00'], $refused['superseded_by'] ?? null);
        self::assertSame(['2027-03-06T17:05:00+01:00', '2027-03-06T17:50:00+01:00'], [$this->item($drinks)['startedAt'], $this->item($drinks)['endedAt']]);
        self::assertSame(['2027-03-06T18:00:00+01:00', '2027-03-06T18:40:00+01:00'], [$this->item($speeches)['startedAt'], $this->item($speeches)['endedAt']]);
        self::assertNull($this->item($dance)['startedAt']);

        $this->press($this->owner, $dance, 'start', '2027-03-06T19:02:00+01:00');
        self::assertSame(200, $this->statusCode());
        self::assertSame('2027-03-06T19:02:00+01:00', $this->item($dance)['startedAt']);

        $again = $this->press($this->colleague, $dance, 'start', '2027-03-06T16:00:00+01:00', 'offline-1');
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/track_busy', $again['type'] ?? null);
        self::assertSame(['name' => 'Ifeoma Nduka', 'at' => '2027-03-06T17:05:00+01:00'], $again['superseded_by'] ?? null);
        self::assertSame('2027-03-06T19:02:00+01:00', $this->item($dance)['startedAt']);
    }

    #[Test]
    public function aLatePressThatWouldReviveAStartRefusedEarlierIsRefused(): void
    {
        $drinks = $this->add('Welcome drinks', '2027-03-06T17:00');
        $speeches = $this->add('Speeches', '2027-03-06T18:00');
        $this->press($this->owner, $drinks, 'start', '2027-03-06T17:05:00+01:00');
        $this->press($this->colleague, $speeches, 'start', '2027-03-06T17:10:00+01:00');
        self::assertSame(409, $this->statusCode());
        $this->press($this->owner, $drinks, 'done', '2027-03-06T17:30:00+01:00');

        $refused = $this->press($this->owner, $drinks, 'done', '2027-03-06T17:08:00+01:00');

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/track_busy', $refused['type'] ?? null);
        self::assertSame(['name' => 'Tunde Bello', 'at' => '2027-03-06T17:10:00+01:00'], $refused['superseded_by'] ?? null);
        self::assertSame('2027-03-06T17:30:00+01:00', $this->item($drinks)['endedAt']);
        self::assertNull($this->item($speeches)['startedAt']);
    }

    #[Test]
    public function aReplayedPressThatLosesIsRefusedWithThePressItLostTo(): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00');

        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:02:00+01:00');
        $refused = $this->press($this->colleague, $speeches, 'start', '2027-03-06T19:05:00+01:00');

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/item_started', $refused['type'] ?? null);
        self::assertSame(['name' => 'Ifeoma Nduka', 'at' => '2027-03-06T19:02:00+01:00'], $refused['superseded_by'] ?? null);
        self::assertSame('2027-03-06T19:02:00+01:00', $this->item($speeches)['startedAt']);
    }

    #[Test]
    public function aPressTimeIsClampedToTheServersClockAndTheEventsStart(): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00');
        $dance = $this->add('First dance', '2027-03-06T19:30', 'Garden');

        $this->press($this->owner, $speeches, 'start', '2027-03-06T21:00:00+01:00');
        self::assertSame('2027-03-06T19:30:05+01:00', $this->item($speeches)['startedAt']);

        $this->press($this->owner, $dance, 'start', '2027-03-06T09:00:00+01:00');
        self::assertSame('2027-03-06T16:00:00+01:00', $this->item($dance)['startedAt']);
    }

    #[Test]
    public function withoutManageNothingCanBePressed(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');
        $viewer = $this->member('viewer@ire.events', 'Kemi Ade', EventRole::CanView);

        $this->press($viewer, $id, 'start');

        self::assertSame(403, $this->statusCode());
        self::assertNull($this->item($id)['startedAt']);
    }

    #[Test]
    public function eachPressThatCountsIsInTheAuditLog(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');

        $this->press($this->owner, $id, 'start');
        $this->press($this->owner, $id, 'skip');

        foreach ([ScheduleEditor::PRESSED['start'], ScheduleEditor::PRESSED['skip']] as $action) {
            $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => $action]);
            self::assertCount(1, $entries, $action);
            self::assertSame($id, $entries[0]->getSubjectId()->toRfc4122());
        }
    }

    #[Test]
    public function aPressSendsTheTracksCardToEachPersonWhoHasPressedThere(): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00', 'Ballroom', 40);
        $this->add('First dance', '2027-03-06T19:30', 'Ballroom');
        $this->add('Carriages', '2027-03-06T19:30', 'Foyer');

        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:27:00+01:00');

        self::assertSame([[
            'to' => $this->owner->getId()->toRfc4122(),
            'title' => 'Owambe · Ballroom',
            'lines' => ['Speeches · since 19:27', 'Next: First dance · about 20:07', 'As of 19:30'],
            'place' => '/app/events/' . $this->eventId . '/schedule?track=2027-03-06%7CBallroom',
            'silent' => true,
            'category' => NotificationCategory::EventDay,
            'collapseKey' => RunOfShowCard::key($this->eventId, '2027-03-06', 'Ballroom'),
        ]], $this->cards());

        self::mockTime(new DateTimeImmutable('2027-03-06T19:05:00Z'));
        $this->press($this->colleague, $speeches, 'done', '2027-03-06T20:04:00+01:00');

        self::assertSame(
            [[$this->owner->getId()->toRfc4122(), ['Nothing is on', 'Next: First dance · about 20:05', 'As of 20:05']], [$this->colleague->getId()->toRfc4122(), ['Nothing is on', 'Next: First dance · about 20:05', 'As of 20:05']]],
            Vec\map($this->cards(), static fn (array $card): array => [$card['to'], $card['lines']]),
        );
    }

    #[Test]
    public function aTracksLastItemDoneOrSkippedSaysThatsEverything(): void
    {
        $speeches = $this->add('Speeches', '2027-03-06T19:00', 'Ballroom');
        $dance = $this->add('First dance', '2027-03-06T19:30', 'Ballroom');

        $this->press($this->owner, $speeches, 'start', '2027-03-06T19:05:00+01:00');
        $this->press($this->owner, $speeches, 'done', '2027-03-06T19:20:00+01:00');
        $this->press($this->owner, $dance, 'skip', '2027-03-06T19:21:00+01:00');

        self::assertSame(['That’s everything.'], Vec\map($this->cards(), static fn (array $card): array => $card['lines'])[0] ?? null);
    }

    #[Test]
    public function aLongTitleKeepsItsFirst39AndAnEllipsisAndTheTimeWhole(): void
    {
        $title = 'Speeches from the father of the bride, the maid of honour, and the best man';
        $id = $this->add($title, '2027-03-06T19:00', 'Ballroom');

        $this->press($this->owner, $id, 'start', '2027-03-06T19:10:00+01:00');

        self::assertSame('Speeches from the father of the bride, … · since 19:10', $this->cards()[0]['lines'][0] ?? null);
    }

    #[Test]
    public function withEventDayPushOffNoCardComes(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00', 'Ballroom');
        self::service(NotificationPreferenceSetter::class)->set($this->owner, NotificationCategory::EventDay, NotificationChannel::Push, false);

        $this->press($this->owner, $id, 'start');

        self::assertSame([], $this->cards());
    }

    #[Test]
    public function aPresserWhoNoLongerManagesTheRunOfShowGetsNoCard(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00', 'Ballroom');
        $this->press($this->colleague, $id, 'start', '2027-03-06T19:10:00+01:00');
        $this->cards();
        $person = self::em()->getRepository(EventPerson::class)->findOneBy(['event' => $this->eventId]) ?? self::fail('not on the event');
        $person->setRole(EventRole::CanView);
        self::em()->flush();

        $this->press($this->owner, $id, 'done', '2027-03-06T19:20:00+01:00');

        self::assertSame([$this->owner->getId()->toRfc4122()], Vec\map($this->cards(), static fn (array $card): string => $card['to']));
    }

    #[Test]
    public function eachPressKeepsWhetherItWasMadeFromTheCard(): void
    {
        $id = $this->add('Speeches', '2027-03-06T19:00');

        $this->as($this->owner, 'POST', $this->items($id) . '/presses', ['kind' => 'start', 'fromCard' => true], 'from-card');
        $this->press($this->owner, $id, 'done');

        self::assertSame(
            [true, false],
            Vec\map(self::em()->getRepository(SchedulePress::class)->findBy([], ['pressedAt' => 'ASC']), static fn (SchedulePress $press): bool => $press->isFromCard()),
        );
    }

    /**
     * What the worker sends from the presses so far, each sent once.
     *
     * @return list<array{to: string, title: string, lines: list<string>, place: ?string, silent: bool, category: NotificationCategory, collapseKey: ?string}>
     */
    private function cards(): array
    {
        self::drainNotifications();

        $pushes = self::service(RecordingPushSender::class);
        $sent = Vec\map($pushes->sent, static fn (array $push): array => [
            'to' => $push['recipient']->id->toRfc4122(),
            'title' => $push['notification']->subject,
            'lines' => $push['notification']->lines,
            'place' => $push['notification']->place,
            'silent' => $push['notification']->silent,
            'category' => $push['category'],
            'collapseKey' => $push['collapseKey'],
        ]);
        $pushes->sent = [];

        $owner = $this->owner->getId()->toRfc4122();

        return Vec\sort($sent, static fn (array $a, array $b): int => [$a['to'] !== $owner, $a['to']] <=> [$b['to'] !== $owner, $b['to']]);
    }

    private function add(string $title, string $startsAt, ?string $place = null, ?int $lengthMinutes = null): string
    {
        $answer = $this->as($this->owner, 'POST', $this->items(), ['title' => $title, 'startsAt' => $startsAt, 'place' => $place, 'lengthMinutes' => $lengthMinutes]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['itemId'] ?? null);
    }

    /** @return array<string, mixed> */
    private function press(User $user, string $itemId, string $kind, ?string $pressedAt = null, ?string $key = null): array
    {
        $key ??= 'key-' . ++$this->keys;

        return $this->as($user, 'POST', $this->items($itemId) . '/presses', ['kind' => $kind] + (null === $pressedAt ? [] : ['pressedAt' => $pressedAt]), $key);
    }

    /** @return array<string, mixed> */
    private function item(string $id): array
    {
        $answer = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/schedule');
        $items = Type\shape(['items' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)->coerce($answer['schedule'] ?? null)['items'];

        foreach ($items as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }

        self::fail('no item ' . $id . ' in ' . Json\encode(Vec\map($items, static fn (array $one): mixed => $one['id'])));
    }

    private function newEvent(string $startsAt, string $endsAt, string $zone): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => $startsAt,
            'endsAt' => $endsAt,
            'timeZone' => $zone,
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function items(?string $id = null): string
    {
        return '/api/events/' . $this->eventId . '/schedule/items' . (null === $id ? '' : '/' . $id);
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, EventRole $on): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Member]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $key = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ] + (null === $key ? [] : ['HTTP_IDEMPOTENCY_KEY' => $key]) + (null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch]), content: null === $body ? null : Json\encode($body));

        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
