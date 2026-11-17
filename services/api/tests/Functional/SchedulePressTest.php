<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\RunOfShow\ScheduleEditor;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\SchedulePress;
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
use PHPUnit\Framework\Attributes\TestWith;
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
        $id = $this->add('Speeches', '2027-03-06T19:00');

        $this->press($this->owner, $id, 'start', '2027-03-06T19:10:00+01:00', 'press-1');
        self::assertSame(200, $this->statusCode());
        $this->press($this->owner, $id, 'start', '2027-03-06T19:10:00+01:00', 'press-1');
        self::assertSame(200, $this->statusCode());

        self::assertCount(1, self::em()->getRepository(SchedulePress::class)->findAll());
        self::assertSame('2027-03-06T19:10:00+01:00', $this->item($id)['startedAt']);
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
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $key = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ] + (null === $key ? [] : ['HTTP_IDEMPOTENCY_KEY' => $key]), content: null === $body ? null : Json\encode($body));

        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
