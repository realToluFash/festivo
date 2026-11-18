<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\RealtimeTopic;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** When a course's picks close (sc-3905): the event's Reply by, else its start, on every course that asks guests anything, and on the timeline. */
final class PicksCloseTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string START = '2030-11-14T16:00:00+00:00';

    private const string REPLY_BY = '2030-10-19T23:59:59+01:00';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2030-10-14T09:00:00+00:00'));
        $this->owner = self::service(UserRegistrar::class)->register('owner@ire.events', 'Ifeoma Nduka', self::PASSWORD)->user;
        self::onboard($this->owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->live();
    }

    #[Test]
    public function withoutReplyByACourseGuestsChooseClosesAtTheEventsStart(): void
    {
        $main = $this->course('Main');
        $this->dish($main, 'Jollof rice');

        self::assertSame(['at' => self::START, 'source' => 'start', 'closed' => false], $this->closeOf('Main'));
        self::assertSame([['at' => self::START, 'title' => 'Picks close', 'area' => 'menu', 'action' => ['label' => 'Menu', 'link' => '/app/events/' . $this->eventId . '/menu']]], $this->picksMilestones());
    }

    #[Test]
    public function replyByClosesEveryCourseAtTheEndOfItsDayAndTheMenuIsRepublished(): void
    {
        $this->dish($this->course('Starter'), 'Pepper soup');
        $this->dish($this->course('Main'), 'Jollof rice');

        $this->patch(['replyBy' => '2030-10-19']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $close = ['at' => self::REPLY_BY, 'source' => 'replyBy', 'closed' => false];
        self::assertSame([$close, $close], [$this->closeOf('Starter'), $this->closeOf('Main')]);
        self::assertSame([self::REPLY_BY], Vec\map($this->picksMilestones(), static fn (array $one): string => $one['at']));

        $update = self::service(RecordingHub::class)->lastOn(RealtimeTopic::EventMenu->for($this->eventId)) ?? self::fail('nothing published');
        self::assertSame([$close, $close], Vec\map($this->coursesOf(Json\decode($update->getData())), static fn (array $course): mixed => $course['picksClose']));

        $this->patch(['replyBy' => null]);
        self::assertSame('start', Type\shape(['source' => Type\string()], true)->coerce($this->closeOf('Main'))['source']);
    }

    #[Test]
    public function aCourseIsClosedFromItsCloseOn(): void
    {
        $this->dish($this->course('Main'), 'Jollof rice');
        $this->patch(['replyBy' => '2030-10-19']);

        self::mockTime(new DateTimeImmutable('2030-10-19T23:59:58+01:00'));
        self::assertFalse($this->closeOf('Main')['closed'] ?? null);

        self::mockTime(new DateTimeImmutable('2030-10-19T23:59:59+01:00'));
        self::assertTrue($this->closeOf('Main')['closed'] ?? null);
    }

    #[Test]
    public function theEventsStartClosesAtItsTimeNotItsDay(): void
    {
        $this->dish($this->course('Main'), 'Jollof rice');

        self::mockTime(new DateTimeImmutable('2030-11-14T15:59:59+00:00'));
        self::assertFalse($this->closeOf('Main')['closed'] ?? null);

        self::mockTime(new DateTimeImmutable(self::START));
        self::assertTrue($this->closeOf('Main')['closed'] ?? null);
    }

    #[Test]
    public function aCourseThatAsksNothingOrIsNotShownToGuestsHasNoClose(): void
    {
        $this->course('Dessert');
        $set = $this->course('Small chops');
        $this->dish($set, 'Puff-puff');
        $this->same($set, 'Small chops');

        self::assertSame([null, null], [$this->closeOf('Dessert'), $this->closeOf('Small chops')]);
        self::assertSame([], $this->picksMilestones());
    }

    #[Test]
    public function aSetCourseWhoseDishAsksTheWayCloses(): void
    {
        $set = $this->course('Main');
        $dish = $this->dish($set, 'Jollof rice');
        $this->same($set, 'Main');

        $this->as('POST', $this->path('/dishes/' . $dish . '/variants'), ['variants' => [
            ['name' => 'Chicken', 'for' => 'everyone', 'containsNone' => true],
            ['name' => 'Children’s portion', 'for' => 'children', 'containsNone' => true],
        ]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertNull($this->closeOf('Main'));

        $this->as('POST', $this->path('/dishes/' . $dish . '/variants'), ['variants' => [
            ['name' => 'Fish', 'for' => 'everyone', 'containsNone' => true],
        ]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('start', Type\shape(['source' => Type\string()], true)->coerce($this->closeOf('Main'))['source']);
    }

    private function course(string $name): string
    {
        $answer = $this->as('POST', $this->path('/courses'), ['name' => $name, 'servedAt' => null]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['courseId'] ?? null);
    }

    private function dish(string $courseId, string $name): string
    {
        $answer = $this->as('POST', $this->path('/courses/' . $courseId . '/dishes'), ['name' => $name, 'containsNone' => true, 'onlyForEvent' => true]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['dishId'] ?? null);
    }

    private function same(string $courseId, string $name): void
    {
        $this->as('PUT', $this->path('/courses/' . $courseId), ['name' => $name, 'servedAt' => null, 'answer' => 'same', 'skippable' => false]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return ?array<string, mixed> */
    private function closeOf(string $course): ?array
    {
        $read = $this->as('GET', $this->path());
        self::assertSame(200, $this->statusCode(), Json\encode($read));

        foreach ($this->coursesOf($read['menu'] ?? null) as $one) {
            if ($one['name'] === $course) {
                return null === $one['picksClose'] ? null : Type\dict(Type\string(), Type\mixed())->coerce($one['picksClose']);
            }
        }

        self::fail('no course ' . $course);
    }

    /** @return list<array{name: string, picksClose: mixed, ...}> */
    private function coursesOf(mixed $menu): array
    {
        return Type\shape(['courses' => Type\vec(Type\shape(['name' => Type\string(), 'picksClose' => Type\mixed()], true))], true)->coerce($menu)['courses'];
    }

    /** @return list<array{at: string, title: string, area: string, action: mixed}> */
    private function picksMilestones(): array
    {
        $body = $this->as('GET', '/api/events/' . $this->eventId . '/timeline');
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $all = Type\vec(Type\shape(['at' => Type\string(), 'title' => Type\string(), 'area' => Type\string(), 'action' => Type\mixed()], true))->coerce($body['milestones'] ?? null);

        return Vec\values(Vec\map(
            Vec\filter($all, static fn (array $one): bool => 'Picks close' === $one['title']),
            static fn (array $one): array => ['at' => $one['at'], 'title' => $one['title'], 'area' => $one['area'], 'action' => $one['action']],
        ));
    }

    /**
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function patch(array $fields): array
    {
        $this->as('GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');

        return $this->as('PATCH', '/api/events/' . $this->eventId, $fields, $tag);
    }

    private function live(): string
    {
        $body = $this->as('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Europe/London', 'currency' => 'GBP']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as('POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function path(string $rest = ''): string
    {
        return '/api/events/' . $this->eventId . '/menu' . $rest;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(string $method, string $path, ?array $body = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
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
