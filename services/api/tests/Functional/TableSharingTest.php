<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
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
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mercure\Update;

/** Share tables with guests (sc-4022): the switch and Share by, the timeline's milestone, what each kind of guest's page shows, the signal that keeps an open page current, and who may change it. */
final class TableSharingTest extends ApiTestCase
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
        self::mockTime(new DateTimeImmutable('2030-06-03T10:00:00+01:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function sharingAndStoppingAreSwitchesEveryOpenPlanHears(): void
    {
        self::assertSame(['sharedAt' => null, 'shareBy' => null], $this->sharingNow());

        $this->share(['shared' => true]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['sharedAt' => '2030-06-03T10:00:00+01:00', 'shareBy' => null], $this->sharingIn($this->last()));
        self::assertContains('events/' . $this->eventId . '/seating', $this->topicsPublished());
        self::assertContains('events/' . $this->eventId . '/guest-pages', $this->topicsPublished());

        self::mockTime(new DateTimeImmutable('2030-06-04T10:00:00+01:00'));
        $this->share(['shared' => true]);
        self::assertSame('2030-06-03T10:00:00+01:00', $this->sharingNow()['sharedAt'], 'sharing again keeps the day it was first shared');

        $this->share(['shared' => false]);

        self::assertSame(200, $this->statusCode());
        self::assertNull($this->sharingNow()['sharedAt']);
    }

    #[Test]
    public function shareByIsADayFromTodayToTheDayBeforeTheEventInItsZone(): void
    {
        $this->share(['shareBy' => '2030-06-02']);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['shareBy' => 'Choose today or a later date.'], $this->violations());

        $this->share(['shareBy' => '2030-06-12']);
        self::assertSame(['shareBy' => 'Choose a date before the event.'], $this->violations());

        $this->share(['shareBy' => '12 June']);
        self::assertSame(['shareBy' => 'Choose a valid date.'], $this->violations());
        self::assertNull($this->sharingNow()['shareBy']);

        $this->share(['shareBy' => '2030-06-03']);
        self::assertSame(200, $this->statusCode());
        $this->share(['shareBy' => '2030-06-11']);
        self::assertSame('2030-06-11', $this->sharingNow()['shareBy']);

        $this->share(['shareBy' => null]);
        self::assertNull($this->sharingNow()['shareBy']);
    }

    #[Test]
    public function aShareByThatHasPassedStaysWithNothingShared(): void
    {
        $this->share(['shareBy' => '2030-06-05']);
        self::mockTime(new DateTimeImmutable('2030-06-08T10:00:00+01:00'));

        self::assertSame(['sharedAt' => null, 'shareBy' => '2030-06-05'], $this->sharingNow());
        self::assertSame([['Share tables', '2030-06-05T23:59:59+01:00', 'you', 'seating', false]], $this->seatingMilestones());
    }

    #[Test]
    public function theTimelineShowsShareTablesByUntilSharedAndTablesSharedAfter(): void
    {
        self::assertSame([], $this->seatingMilestones(), 'no Share by, no milestone');

        $this->share(['shareBy' => '2030-06-10']);
        self::assertSame([['Share tables', '2030-06-10T23:59:59+01:00', 'you', 'seating', false]], $this->seatingMilestones());

        $this->share(['shared' => true]);
        self::assertSame([['Tables shared', '2030-06-03T10:00:00+01:00', 'you', 'seating', true]], $this->seatingMilestones(), 'done, so the clients mark it passed rather than overdue');

        $this->share(['shared' => false]);
        self::assertSame([['Share tables', '2030-06-10T23:59:59+01:00', 'you', 'seating', false]], $this->seatingMilestones(), 'Stop sharing brings the saved date back');
    }

    #[Test]
    public function aSeatedComingGuestSeesTheirTableOnlyWhileTablesAreShared(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', reply: 'coming');
        $this->seat($ada, $table);
        $token = $this->token($ada);

        self::assertArrayNotHasKey('seating', $this->open($token), 'before sharing the page has no seating field');

        $this->share(['shared' => true]);
        self::assertSame(['seat' => ['kind' => 'table', 'name' => 'Table 1', 'section' => null], 'elsewhere' => []], $this->open($token)['seating'] ?? null);

        $this->share(['shared' => false]);
        self::assertArrayNotHasKey('seating', $this->open($token), 'after Stop sharing the page has no seating field');
    }

    #[Test]
    public function aSeatInARowCarriesItsNumberAndItsSection(): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/sections', ['name' => 'Balcony']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $section = $this->idOf('sections', 'Balcony');
        $row = Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/rows')['rowId'] ?? null);
        $this->as($this->owner, 'PATCH', $this->plan() . '/rows/' . $row, ['sectionId' => $section], '"' . $this->versionOf('rows', $row) . '"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $ada = $this->guest('Ada Obi', reply: 'coming');
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $ada, 'kind' => 'row', 'placeId' => $row, 'seat' => 4, 'justGuest' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->share(['shared' => true]);

        self::assertSame(['seat' => ['kind' => 'row', 'name' => 'A', 'seat' => 4, 'section' => 'Balcony'], 'elsewhere' => []], $this->open($this->token($ada))['seating'] ?? null);
    }

    #[Test]
    public function eachCompanionSeatedElsewhereHasALineAndNobodyElseIsNamed(): void
    {
        $four = $this->addTable();
        $six = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Kemi Okonkwo', null, 'Chidi Obi', 'Tunde Obi'], reply: 'coming');
        $this->seat($ada, $four, justGuest: true);
        $this->seat($this->companionId('Chidi Obi'), $four, justGuest: true);
        $this->seat($this->companionId('Kemi Okonkwo'), $six, justGuest: true);
        $this->seat($this->unnamedCompanionId($ada), $six, justGuest: true);
        $this->seat($this->guest('Bola Ade', reply: 'coming'), $four);
        $this->share(['shared' => true]);

        $seating = $this->open($this->token($ada))['seating'] ?? null;

        self::assertSame([
            'seat' => ['kind' => 'table', 'name' => 'Table 1', 'section' => null],
            'elsewhere' => [
                ['name' => 'Kemi Okonkwo', 'seat' => ['kind' => 'table', 'name' => 'Table 2', 'section' => null]],
                ['name' => null, 'seat' => ['kind' => 'table', 'name' => 'Table 2', 'section' => null]],
            ],
        ], $seating, 'Chidi at the same table and unseated Tunde get no line');
        self::assertStringNotContainsString('Bola', Json\encode($this->last()), 'a tablemate is never named');
    }

    #[Test]
    public function maybeNotComingAndUnseatedGuestsSeeNothingAboutSeating(): void
    {
        $table = $this->addTable();
        $maybe = $this->guest('Maybe Ade', reply: 'coming');
        $this->seat($maybe, $table);
        $this->reply($maybe, 'maybe');
        $notComing = $this->guest('Gone Ade', reply: 'coming');
        $this->seat($notComing, $table);
        $this->reply($notComing, 'notComing');
        $unseated = $this->guest('Standing Ade', reply: 'coming');
        $this->share(['shared' => true]);

        foreach ([$maybe, $notComing, $unseated] as $guest) {
            self::assertArrayNotHasKey('seating', $this->open($this->token($guest)));
        }
    }

    #[Test]
    public function aChangeToThePlanTellsOpenGuestPagesToAskAgainOnlyWhileShared(): void
    {
        $table = $this->addTable();
        $other = $this->addTable();
        $ada = $this->guest('Ada Obi', reply: 'coming');
        $this->seat($ada, $table);

        $this->seat($ada, $other);
        self::assertNotContains('events/' . $this->eventId . '/guest-pages', $this->topicsPublished(), 'nothing to tell before sharing');

        $this->share(['shared' => true]);
        $hub = self::service(RecordingHub::class);
        $hub->published = [];
        $this->seat($ada, $table);

        $signal = Iter\last(Vec\filter($hub->published, fn (Update $update): bool => $update->getTopics() === ['events/' . $this->eventId . '/guest-pages'])) ?? self::fail('no guest page signal');
        self::assertSame('[]', $signal->getData(), 'the signal carries no guest data');
        self::assertSame(['kind' => 'table', 'name' => 'Table 1', 'section' => null], Type\dict(Type\string(), Type\mixed())->coerce($this->open($this->token($ada))['seating'] ?? null)['seat'] ?? null);
    }

    #[Test]
    public function aSharedSeatedGuestMarkedNotComingTellsOpenGuestPagesToAskAgain(): void
    {
        $ada = $this->guest('Ada Obi', reply: 'coming');
        $this->seat($ada, $this->addTable());
        $this->share(['shared' => true]);
        $hub = self::service(RecordingHub::class);
        $hub->published = [];

        $this->reply($ada, 'notComing');

        self::assertContains('events/' . $this->eventId . '/guest-pages', $this->topicsPublished(), 'freeing the chair tells the open page');
        self::assertArrayNotHasKey('seating', $this->open($this->token($ada)));
    }

    #[Test]
    public function aGuestLinkGetsAHubTokenForItsEventsSignalAndAnUnknownOneDoesNot(): void
    {
        $token = $this->token($this->guest('Ada Obi'));

        $this->anonymous('/api/guest-links/subscriptions', ['token' => $token]);
        self::assertSame(200, $this->statusCode());
        self::assertIsString($this->last()['token'] ?? null);

        $this->anonymous('/api/guest-links/subscriptions', ['token' => Str\reverse($token)]);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function withoutSeatingManageSharingCanBeSeenButNotChanged(): void
    {
        $this->share(['shareBy' => '2030-06-10']);
        $viewer = $this->member('ada@ire.events', EventRole::CanView);

        $this->as($viewer, 'GET', $this->plan());
        self::assertSame(200, $this->statusCode());
        self::assertSame(['sharedAt' => null, 'shareBy' => '2030-06-10'], $this->sharingIn($this->last()));

        $this->as($viewer, 'PATCH', $this->plan() . '/sharing', ['shared' => true]);
        self::assertSame(403, $this->statusCode());
        self::assertNull($this->sharingNow()['sharedAt']);
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'PATCH', $this->plan() . '/sharing', ['shared' => true]);

        self::assertSame(404, $this->statusCode());
        self::assertNull($this->sharingNow()['sharedAt']);
    }

    /** @param array<string, mixed> $fields */
    private function share(array $fields): void
    {
        $this->as($this->owner, 'PATCH', $this->plan() . '/sharing', $fields);
    }

    /** @return array{sharedAt: ?string, shareBy: ?string} */
    private function sharingNow(): array
    {
        return $this->sharingIn($this->as($this->owner, 'GET', $this->plan()));
    }

    /**
     * @param array<string, mixed> $answer
     *
     * @return array{sharedAt: ?string, shareBy: ?string}
     */
    private function sharingIn(array $answer): array
    {
        $seating = Type\shape(['plan' => Type\shape(['sharing' => Type\shape(['sharedAt' => Type\nullable(Type\string()), 'shareBy' => Type\nullable(Type\string())])], true)], true)->coerce($answer['seating'] ?? null);

        return $seating['plan']['sharing'];
    }

    /** @return list<array{0: string, 1: string, 2: string, 3: string, 4: bool}> each seating milestone's title, instant, owner, area and whether it is done */
    private function seatingMilestones(): array
    {
        $timeline = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/timeline');
        $milestones = Type\vec(Type\shape(['at' => Type\string(), 'title' => Type\string(), 'owner' => Type\string(), 'area' => Type\string(), 'done' => Type\bool()], true))->coerce($timeline['milestones'] ?? null);

        return Vec\map(
            Vec\filter($milestones, static fn (array $one): bool => 'seating' === $one['area']),
            static fn (array $one): array => [$one['title'], $one['at'], $one['owner'], $one['area'], $one['done']],
        );
    }

    /** @return list<string> */
    private function topicsPublished(): array
    {
        return Type\vec(Type\string())->coerce(Vec\flatten(Vec\map(self::service(RecordingHub::class)->published, static fn (Update $update): array => $update->getTopics())));
    }

    /** @param list<?string> $companions */
    private function guest(string $name, array $companions = [], ?string $reply = null): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['guest' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['guest']['id'];

        if (null !== $reply) {
            $this->reply($id, $reply);
        }

        return $id;
    }

    private function reply(string $guest, string $answer): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/record-reply', ['answer' => $answer, 'how' => 'phone', 'replace' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function companionId(string $name): string
    {
        $one = Iter\first(Vec\filter($this->guestsInPlan(), static fn (array $guest): bool => $name === $guest['fullName'])) ?? self::fail('no ' . $name);

        return Type\string()->coerce($one['id']);
    }

    private function unnamedCompanionId(string $lead): string
    {
        $one = Iter\first(Vec\filter($this->guestsInPlan(), static fn (array $guest): bool => null === $guest['fullName'] && $lead === $guest['leadId'])) ?? self::fail('no unnamed companion');

        return Type\string()->coerce($one['id']);
    }

    /** @return list<array<string, mixed>> */
    private function guestsInPlan(): array
    {
        $plan = Type\shape(['plan' => Type\shape(['guests' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)], true)->coerce($this->as($this->owner, 'GET', $this->plan())['seating'] ?? null);

        return $plan['plan']['guests'];
    }

    private function seat(string $guest, string $table, bool $justGuest = false): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $guest, 'kind' => 'table', 'placeId' => $table, 'seat' => null, 'justGuest' => $justGuest]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function addTable(): string
    {
        return Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round'])['tableId'] ?? null);
    }

    private function idOf(string $list, string $name): string
    {
        $plan = Type\shape(['plan' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->as($this->owner, 'GET', $this->plan())['seating'] ?? null);
        $one = Iter\first(Vec\filter(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan['plan'][$list] ?? null), static fn (array $item): bool => $name === $item['name'])) ?? self::fail('no ' . $name . ' in ' . $list);

        return Type\string()->coerce($one['id']);
    }

    private function versionOf(string $list, string $id): int
    {
        $plan = Type\shape(['plan' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->as($this->owner, 'GET', $this->plan())['seating'] ?? null);

        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan['plan'][$list] ?? null) as $item) {
            if ($item['id'] === $id) {
                return Type\int()->coerce($item['version']);
            }
        }

        self::fail('no ' . $id . ' in ' . $list);
    }

    private function token(string $guest): string
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    /** @return array<string, mixed> */
    private function open(#[SensitiveParameter] string $token): array
    {
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $this->last();
    }

    /** @param array<string, mixed> $body */
    private function anonymous(string $path, #[SensitiveParameter] array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
    }

    /** @return array<string, string> */
    private function violations(): array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return Iter\reduce($violations, static fn (array $all, array $one): array => [...$all, $one['propertyPath'] => $one['message']], []);
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2030-06-12T16:00',
            'endsAt' => '2030-06-13T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['event' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['event']['id'];
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

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
