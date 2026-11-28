<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\RunOfShow\ScheduleEditor;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Permission;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class ScheduleCourseTest extends ApiTestCase
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
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent('2027-03-06T16:00', '2027-03-07T02:00', 'Africa/Lagos');
    }

    #[Test]
    public function anItemLinksToOneCourseAndShowsItsName(): void
    {
        $main = $this->course('Main course', '20:30', 1);

        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);

        self::assertSame(['id' => $main, 'name' => 'Main course'], $item['course']);
        self::assertFalse($item['courseNotice']);
    }

    #[Test]
    public function aLinkedCoursesServedTimeIsItsItemsStartAndFollowsIt(): void
    {
        $main = $this->course('Main course', '20:30', 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);
        self::assertSame('21:15', $this->menuCourse($main)['servedAt']);

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:45'], '"1"');

        self::assertSame(200, $this->statusCode());
        self::assertSame('21:45', $this->menuCourse($main)['servedAt']);
    }

    #[Test]
    public function theMenuExposesTheLinkedItemWithItsTimes(): void
    {
        $main = $this->course('Main course', null, 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);

        $linked = $this->menuCourse($main)['scheduleItem'];

        self::assertSame([$item['id'], 'Mains go out', '2027-03-06T21:15:00+01:00', null, null], [$linked['id'], $linked['title'], $linked['plannedAt'], $linked['startedAt'], $linked['endedAt']]);
        self::assertArrayHasKey('expectedAt', $linked);
    }

    #[Test]
    public function aCourseOnAnotherItemMovesItsLinkAndTheOldItemKeepsItsTitleAndTime(): void
    {
        $main = $this->course('Main course', null, 1);
        $first = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);
        $second = $this->add(['title' => 'Plates out', 'startsAt' => '2027-03-06T21:30']);

        $this->as($this->owner, 'PUT', $this->items($second['id']), ['title' => 'Plates out', 'startsAt' => '2027-03-06T21:30', 'courseId' => $main], '"1"');

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $schedule = $this->schedule()['items'];
        $items = [];

        foreach ($schedule as $one) {
            $items[Type\string()->coerce($one['id'])] = $one;
        }

        self::assertNull($items[$first['id']]['course']);
        self::assertSame(['Mains go out', '2027-03-06T21:15:00+01:00'], [$items[$first['id']]['title'], $items[$first['id']]['startsAt']]);
        self::assertSame($main, $items[$second['id']]['course']['id']);
        self::assertFalse($items[$first['id']]['courseNotice']);
        self::assertSame('21:30', $this->menuCourse($main)['servedAt']);
    }

    #[Test]
    public function clearingTheCourseKeepsTheTimeItLastShowedAndRaisesNoNotice(): void
    {
        $main = $this->course('Main course', '20:30', 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => null], '"1"');

        self::assertSame(200, $this->statusCode());
        $only = $this->only();
        self::assertNull($only['course']);
        self::assertFalse($only['courseNotice']);
        self::assertSame('21:15', $this->menuCourse($main)['servedAt']);
        self::assertNull($this->menuCourse($main)['scheduleItem']);
        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $main, ['name' => 'Main course', 'servedAt' => '19:00', 'answer' => 'choose', 'skippable' => false]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('19:00', $this->menuCourse($main)['servedAt']);
    }

    #[Test]
    public function aSaveThatLeavesServedAtOutKeepsAnUnlinkedCoursesTime(): void
    {
        $main = $this->course('Main course', '20:30', 1);

        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $main, ['name' => 'The mains', 'answer' => 'choose', 'skippable' => false]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['The mains', '20:30'], [$this->menuCourse($main)['name'], $this->menuCourse($main)['servedAt']]);
    }

    #[Test]
    public function deletingTheItemKeepsTheCoursesTime(): void
    {
        $main = $this->course('Main course', '20:30', 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);

        $this->as($this->owner, 'DELETE', $this->items($item['id']));

        self::assertSame(200, $this->statusCode());
        self::assertSame('21:15', $this->menuCourse($main)['servedAt']);
        self::assertNull($this->menuCourse($main)['scheduleItem']);
    }

    #[Test]
    public function aLinkedCoursesOtherServedTimeIsRefused409AndItsOtherDetailsStillSave(): void
    {
        $main = $this->course('Main course', null, 1);
        $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);
        $path = '/api/events/' . $this->eventId . '/menu/courses/' . $main;

        $refused = $this->as($this->owner, 'PUT', $path, ['name' => 'Main course', 'servedAt' => '19:00', 'answer' => 'choose', 'skippable' => false]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/menu_course_linked', $refused['type'] ?? null);
        self::assertSame('21:15', $this->menuCourse($main)['servedAt']);

        $this->as($this->owner, 'PUT', $path, ['name' => 'The mains', 'answer' => 'choose', 'skippable' => true]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['The mains', '21:15'], [$this->menuCourse($main)['name'], $this->menuCourse($main)['servedAt']]);
    }

    #[Test]
    public function movingTheItemPublishesTheMenuAndARenameAfterItStillSavesWithoutServedAt(): void
    {
        $main = $this->course('Main course', null, 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:45'], '"1"');

        $topic = 'events/' . $this->eventId . '/menu';
        $update = self::service(RecordingHub::class)->lastOn($topic) ?? self::fail('the menu was not published');
        self::assertStringContainsString('21:45', $update->getData());

        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $main, ['name' => 'The mains', 'answer' => 'choose', 'skippable' => false]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['The mains', '21:45'], [$this->menuCourse($main)['name'], $this->menuCourse($main)['servedAt']]);
    }

    #[Test]
    public function renamingOrRemovingALinkedCoursePublishesTheSchedule(): void
    {
        $main = $this->course('Main course', null, 1);
        $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);
        $topic = 'events/' . $this->eventId . '/schedule';
        $hub = self::service(RecordingHub::class);

        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $main, ['name' => 'The mains', 'answer' => 'choose', 'skippable' => false]);
        self::assertStringContainsString('The mains', ($hub->lastOn($topic) ?? self::fail('the schedule was not published'))->getData());

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/menu/courses/' . $main);
        self::assertStringContainsString('"courseNotice":true', ($hub->lastOn($topic) ?? self::fail('the schedule was not published'))->getData());
    }

    #[Test]
    public function aCourseTakenFromItsHolderIsRecordedOnTheHolderToo(): void
    {
        $main = $this->course('Main course', null, 1);
        $first = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);
        $second = $this->add(['title' => 'Plates out', 'startsAt' => '2027-03-06T21:30']);

        $this->as($this->owner, 'PUT', $this->items($second['id']), ['title' => 'Plates out', 'startsAt' => '2027-03-06T21:30', 'courseId' => $main], '"1"');

        $recorded = self::em()->getRepository(AuditEntry::class)->findBy(['action' => ScheduleEditor::CHANGED, 'subjectId' => Uuid::fromString(Type\string()->coerce($first['id']))]);
        self::assertCount(1, $recorded);
        self::assertSame(['course' => ['Main course', null]], $recorded[0]->getChanges());
    }

    #[Test]
    public function aCourseWithNoItemKeepsItsOwnServedTime(): void
    {
        $main = $this->course('Main course', '20:30', 1);

        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $main, ['name' => 'Main course', 'servedAt' => '19:00', 'answer' => 'choose', 'skippable' => false]);

        self::assertSame(200, $this->statusCode());
        self::assertSame('19:00', $this->menuCourse($main)['servedAt']);
    }

    #[Test]
    public function removingTheCourseUnlinksTheItemAndRaisesTheNoticeUntilDismissed(): void
    {
        $main = $this->course('Main course', null, 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/menu/courses/' . $main);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $only = $this->only();
        self::assertSame([null, true, 'Mains go out', '2027-03-06T21:15:00+01:00'], [$only['course'], $only['courseNotice'], $only['title'], $only['startsAt']]);

        $this->as($this->owner, 'DELETE', $this->items($item['id']) . '/course-notice');

        self::assertSame(200, $this->statusCode());
        self::assertFalse($this->only()['courseNotice']);
    }

    #[Test]
    public function aSaveFromTheFormEndsTheNotice(): void
    {
        $main = $this->course('Main course', null, 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);
        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/menu/courses/' . $main);
        $version = '"' . $this->only()['version'] . '"';

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15'], $version);

        self::assertSame(200, $this->statusCode());
        self::assertFalse($this->only()['courseNotice']);
    }

    #[Test]
    public function aSaveThatLeavesCourseOutKeepsTheLink(): void
    {
        $main = $this->course('Main course', null, 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Mains', 'startsAt' => '2027-03-06T21:15'], '"1"');

        self::assertSame(200, $this->statusCode());
        self::assertSame($main, $this->only()['course']['id']);
    }

    #[Test]
    public function sendingCourseWithoutMenuReadIsRefused403AndTheLinkStays(): void
    {
        $main = $this->course('Main course', null, 1);
        $item = $this->add(['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => $main]);
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MenuRead);

        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Mains go out', 'startsAt' => '2027-03-06T21:15', 'courseId' => null], '"1"');

        self::assertSame(403, $this->statusCode());
        $this->as($this->owner, 'PUT', $this->items($item['id']), ['title' => 'Mains', 'startsAt' => '2027-03-06T21:15'], '"1"');
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Mains', $main], [$this->only()['title'], $this->only()['course']['id']]);
    }

    #[Test]
    public function aCourseFromAnotherEventIsRefused(): void
    {
        $this->as($this->owner, 'POST', $this->items(), ['title' => 'Mains', 'startsAt' => '2027-03-06T21:15', 'courseId' => '0194f5a0-0000-7000-8000-000000000000']);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame("Choose a course from this event's menu.", $this->violation('courseId'));
    }

    #[Test]
    public function aItemWithNoCourseBehavesAsBefore(): void
    {
        $item = $this->add(['title' => 'Speeches', 'startsAt' => '2027-03-06T19:00']);

        self::assertSame([null, false], [$item['course'], $item['courseNotice']]);
    }

    private function course(string $name, ?string $servedAt, int $position): string
    {
        $event = self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
        $course = new MenuCourse($event, $name, $servedAt, $position);
        self::em()->persist($course);
        self::em()->flush();

        return $course->getId()->toRfc4122();
    }

    /** @return array<string, mixed> */
    private function menuCourse(string $id): array
    {
        $menu = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/menu');

        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($menu['menu'] ?? null)['courses'] ?? []) as $course) {
            if ($course['id'] === $id) {
                return $course;
            }
        }

        self::fail('the course is not on the menu');
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function add(array $body): array
    {
        $answer = $this->as($this->owner, 'POST', $this->items(), $body);
        $id = Type\string()->coerce($answer['itemId'] ?? null);

        foreach ($this->itemsOf($answer['schedule'] ?? null) as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }

        self::fail('the added item is not in the answer: ' . Json\encode($answer));
    }

    /** @return array<string, mixed> */
    private function only(): array
    {
        $items = $this->schedule()['items'];
        self::assertCount(1, $items);

        return $items[0];
    }

    /** @return array{timeZone: string, earliest: string, latest: string, itemsMaximum: int, items: list<array<string, mixed>>} */
    private function schedule(): array
    {
        $answer = $this->as($this->owner, 'GET', $this->path());

        return Type\shape([
            'timeZone' => Type\string(),
            'earliest' => Type\string(),
            'latest' => Type\string(),
            'itemsMaximum' => Type\int(),
            'items' => Type\vec(Type\dict(Type\string(), Type\mixed())),
        ])->coerce($answer['schedule'] ?? null);
    }

    /** @return list<array<string, mixed>> */
    private function itemsOf(mixed $schedule): array
    {
        return Type\shape(['items' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)->coerce($schedule)['items'];
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

    private function path(): string
    {
        return '/api/events/' . $this->eventId . '/schedule';
    }

    private function items(?string $id = null): string
    {
        return $this->path() . '/items' . (null === $id ? '' : '/' . $id);
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        foreach ($violations as $violation) {
            if ($violation['propertyPath'] === $path) {
                return $violation['message'];
            }
        }

        return null;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

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
        ] + (null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch]), content: null === $body ? null : Json\encode($body));

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
