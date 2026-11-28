<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedPdfMaker;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Changes since the latest copy, its milestone and the changes page (sc-30692). */
final class KitchenChangesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private MenuCourse $main;

    private MenuDish $jollof;

    private MenuDish $egusi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-03T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live();
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $this->main = new MenuCourse($event, 'Main', null, 0);
        $this->jollof = new MenuDish($this->main, null, 'Jollof rice', null, ['celery'], [], 0);
        $this->egusi = new MenuDish($this->main, null, 'Pounded yam and egusi', null, ['milk'], [], 1);

        foreach ([$this->main, $this->jollof, $this->egusi] as $row) {
            self::em()->persist($row);
        }

        self::em()->flush();
        self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');
    }

    #[Test]
    public function theListOpensOnceACopyIsRecordedAndSaysEachChangeUnderTheNamesRule(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        self::assertNull($this->final()['changes'], 'no copy, no list');

        $this->give();
        self::assertSame([], $this->lines());
        self::assertSame('2026-10-03T10:00:00+01:00', Type\shape(['since' => Type\string()], true)->coerce($this->final()['changes'])['since']);

        $this->records($this->personId('Chidi Okonkwo'), ['sesame']);
        self::assertSame(['allergyNew:Chidi Okonkwo:1'], $this->lines());
        self::assertArrayNotHasKey('guest', Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($this->final()['changes'])['lines'] ?? null)[0]);

        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::GuestsManage);
        self::assertSame(['allergyNew::1'], $this->lines());
    }

    #[Test]
    public function aCopyGivenWithoutGuestsManageStillFindsEachChangePersonByPersonAndHoldsNoName(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['peanuts']);
        $directory = self::service(WithholdingMembershipDirectory::class);
        $directory->withhold(Permission::GuestsManage);
        $this->give();
        $directory->restore();
        self::assertStringNotContainsString('Chidi', Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT sheet::text FROM kitchen_copies')));
        self::assertSame([], $this->lines());

        $this->records($this->personId('Chidi Okonkwo'), []);
        $this->records($this->personId('Bisi Adewale'), ['peanuts']);

        self::assertSame(['allergyNew:Bisi Adewale:1', 'allergyGone:Chidi Okonkwo:1'], $this->lines());
    }

    #[Test]
    public function anotherAllergyRewordedIsFoundAgainstACopyGivenWithoutGuestsManage(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['other'], 'Kiwi');
        $directory = self::service(WithholdingMembershipDirectory::class);
        $directory->withhold(Permission::GuestsManage);
        $this->give();
        $directory->restore();

        $this->records($this->personId('Chidi Okonkwo'), ['other'], 'Mango');

        self::assertSame(['allergyNew:Chidi Okonkwo:1', 'allergyGone:Chidi Okonkwo:1'], $this->lines());
    }

    #[Test]
    public function aCourseThatClosesIsSeenWhenTheEventsOwnTimelineIsReadAndNotByTheEventsList(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->give();
        self::service(Connection::class)->executeStatement('UPDATE kitchen_copies SET sheet = jsonb_set(sheet, \'{coming}\', \'99\')');

        $this->as('GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events');
        self::assertStringNotContainsString('Give the changes to the kitchen', (string) $this->client->getResponse()->getContent());

        self::assertNotNull($this->changesMilestone());
    }

    #[Test]
    public function theTimelineIsStillReadWhenTheSheetCannotBeComparedWithItsCopy(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->give();
        self::service(Connection::class)->executeStatement('UPDATE kitchen_copies SET sheet = jsonb_set(sheet, \'{coming}\', \'"many"\')');

        self::assertNull($this->changesMilestone());
    }

    #[Test]
    public function theChangesPageComesFirstAndAnErasedGuestBecomesACountOnIt(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->give();
        $this->records($this->personId('Chidi Okonkwo'), ['sesame']);
        self::mockTime(new DateTimeImmutable('2026-10-04T09:00:00+00:00'));
        $this->give();
        $copy = $this->copyIds()[1];

        $html = $this->copyHtml($copy);
        self::assertStringContainsString('<section class="changes"><h1>Changes since ', $html);
        self::assertStringContainsString('<li>New allergy: Sesame (Chidi Okonkwo)</li>', $html);
        self::assertLessThan(Str\search($html, '<header class="head">'), Str\search($html, '<section class="changes">'), 'before the sheet');
        self::assertStringNotContainsString('<section class="changes">', $this->copyHtml($this->copyIds()[0]), 'a first copy has none');

        $bisi = $this->personId('Bisi Adewale');
        $this->as('DELETE', '/api/events/' . $this->eventId . '/guests/' . $bisi);
        $this->as('POST', '/api/events/' . $this->eventId . '/guests/' . $bisi . '/erasure');
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        $html = $this->copyHtml($copy);
        self::assertStringContainsString('<li>New allergy: Sesame (1 guest)</li>', $html);
        self::assertStringNotContainsString('Chidi', Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT sheet::text FROM kitchen_copies WHERE id = :id', ['id' => $copy])));
        self::assertContains('allergyGone::1', $this->lines(), 'erased since the copy: a count');
    }

    #[Test]
    public function theCountLineOnThePdfPutsAColonAfterTheDishAsTheWebDoes(): void
    {
        $line = self::service(TranslatorInterface::class)->trans('kitchen_sheet.changes.count', ['dish' => 'Pepper soup', 'old' => 50, 'new' => 52], 'messages', 'en');

        self::assertSame('Pepper soup: 50 to 52', $line);
    }

    #[Test]
    public function theMilestoneComesBackWhenTheSheetFirstDiffersDueOnTheDayAndEndsWithACopy(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->due('2026-10-05');
        $this->give();
        self::assertNull($this->changesMilestone());

        self::mockTime(new DateTimeImmutable('2026-10-04T09:00:00+00:00'));
        $this->change(['sesame']);
        self::mockTime(new DateTimeImmutable('2026-10-09T09:00:00+00:00'));
        self::assertSame('2026-10-05T23:59:00+01:00', $this->changesMilestone()['at'] ?? null, 'came back before the day, read after it: still due on the day');

        $this->due('2026-10-12');
        self::assertSame('2026-10-12T23:59:00+01:00', $this->changesMilestone()['at'] ?? null, 'moved');
        $this->due(null);
        self::assertSame('2030-11-14T16:00:00+01:00', $this->changesMilestone()['at'] ?? null, 'cleared: the start');

        $this->change([]);
        self::assertNull($this->changesMilestone(), 'every change moved back');

        $this->change(['fish']);
        self::assertNotNull($this->changesMilestone(), 'back after a new change');
        $this->give();
        self::assertNull($this->changesMilestone(), 'a copy');
    }

    #[Test]
    public function aMilestoneThatCameBackAfterTheDayIsDueAtTheStartAndGoneOnceItStarts(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->due('2026-10-05');
        $this->give();

        self::mockTime(new DateTimeImmutable('2026-10-06T09:00:00+00:00'));
        $this->change(['sesame']);
        self::assertSame('2030-11-14T16:00:00+01:00', $this->changesMilestone()['at'] ?? null);

        self::mockTime(new DateTimeImmutable('2030-11-14T15:00:00+00:00'));
        self::assertNull($this->changesMilestone());
        self::assertSame(['allergyNew:Chidi Okonkwo:1'], $this->lines(), 'the list still shows');
    }

    #[Test]
    public function theMilestoneIsGoneOnACalledOffEventAndItsCalendarEntryMovesWithTheDate(): void
    {
        $this->as('GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/calendar-feed');
        $path = Type\shape(['path' => Type\string()], true)->coerce($this->last())['path'];
        $uid = 'UID:milestone-' . $this->eventId . '-menu.kitchen_changes@soirely';
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->due('2026-10-10');
        $this->give();
        $this->change(['sesame']);
        [$first] = self::entries($this->feed($path), $uid);

        $this->due('2026-10-20');
        $moved = self::entries($this->feed($path), $uid);
        self::assertCount(1, $moved);
        self::assertStringContainsString('DTSTART;TZID=Africa/Lagos:20261020T235900', $moved[0]);
        self::assertGreaterThan(self::sequence($first), self::sequence($moved[0]));

        $this->as('POST', '/api/events/' . $this->eventId . '/end');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertNull($this->changesMilestone());
    }

    /** @param list<string> $allergies recorded by the host, through the request that marks the event */
    private function change(array $allergies): void
    {
        $this->records($this->personId('Chidi Okonkwo'), $allergies);
        $this->as('GET', $this->sheetPath());
    }

    /** @return list<string> kind:who:count */
    private function lines(): array
    {
        $changes = Type\shape(['lines' => Type\vec(Type\shape(['kind' => Type\string(), 'who' => Type\nullable(Type\string()), 'count' => Type\int()], true))], true)->coerce($this->final()['changes']);

        return Vec\map($changes['lines'], static fn (array $line): string => Str\join([$line['kind'], $line['who'] ?? '', (string) $line['count']], ':'));
    }

    /** @return array<string, mixed>|null */
    private function changesMilestone(): ?array
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/timeline');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $milestones = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->last()['milestones'] ?? null);

        return Iter\search($milestones, static fn (array $one): bool => 'Give the changes to the kitchen' === ($one['title'] ?? null));
    }

    private function due(?string $day): void
    {
        $this->as('PUT', $this->duePath(), ['due' => $day]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function give(): void
    {
        $this->as('POST', $this->sheetPath() . '/copies');
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
    }

    private function copyHtml(string $copy, string $language = 'en'): string
    {
        $this->as('POST', $this->copyPath($copy), language: $language);
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());

        return self::service(ScriptedPdfMaker::class)->html ?? self::fail('no html');
    }

    /** @return list<string> oldest first */
    private function copyIds(): array
    {
        return Vec\reverse(Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($this->final()['copies']), static fn (array $copy): string => $copy['id']));
    }

    /** @return array<string, mixed> */
    private function final(): array
    {
        $this->as('GET', $this->sheetPath());
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['finalNumbers' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->last())['finalNumbers'];
    }

    private function feed(string $path): string
    {
        $this->client->request('GET', $path);
        self::assertSame(200, $this->statusCode());

        return Str\replace((string) $this->client->getResponse()->getContent(), "\r\n ", '');
    }

    /** @return list<string> */
    private static function entries(string $calendar, string $uid): array
    {
        return Vec\filter(Str\split($calendar, 'BEGIN:VEVENT'), static fn (string $entry): bool => Str\contains($entry, $uid . "\r\n"));
    }

    private static function sequence(string $entry): int
    {
        return Type\int()->coerce(Regex\first_match($entry, '/SEQUENCE:(\d+)/', Regex\capture_groups([1]))[1] ?? self::fail('no sequence'));
    }

    private function duePath(): string
    {
        return '/api/events/' . $this->eventId . '/menu/final-numbers';
    }

    private function sheetPath(): string
    {
        return '/api/events/' . $this->eventId . '/menu/kitchen-sheet';
    }

    private function copyPath(string $copy): string
    {
        return $this->sheetPath() . '/copies/' . $copy . '/pdf';
    }

    /** @param list<array{fullName: ?string}> $companions */
    private function coming(array $companions): string
    {
        $this->as('POST', '/api/events/' . $this->eventId . '/guests', ['fullName' => 'Bisi Adewale', 'companions' => Vec\map($companions, static fn (array $one): array => ['fullName' => $one['fullName']])]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $guestId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
        $this->as('GET', '/api/events/' . $this->eventId . '/guests/' . $guestId . '/link');
        $token = Str\after(Type\string()->coerce($this->last()['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $listed = Type\vec(Type\shape(['id' => Type\string()], true))->coerce(Type\mixed_dict()->coerce($this->last()['guest'] ?? null)['companions'] ?? []);
        $this->anonymous('/api/guest-links/reply', [
            'token' => $token,
            'answer' => 'coming',
            'needs' => ['allergies' => []],
            'companions' => Vec\map_with_key($listed, static fn (int $at, array $companion): array => ['id' => $companion['id'], 'fullName' => $companions[$at]['fullName'], 'coming' => true]),
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $token;
    }

    private function personId(string $name): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM guests WHERE full_name = :name', ['name' => $name]));
    }

    /** @param list<string> $allergies */
    private function records(string $guestId, array $allergies, ?string $other = null): void
    {
        $person = self::em()->find(Guest::class, Uuid::fromString($guestId)) ?? self::fail('no guest');
        $none = GuestNeeds::none();
        $needs = new GuestNeeds([...$none->codes, NeedKind::Allergen->value => $allergies], [...$none->others, NeedKind::Allergen->value => $other], null);
        self::service(GuestNeedsRecord::class)->write($person, $needs, $this->owner);
        self::em()->flush();
    }

    /** @param array<string, mixed> $body */
    private function anonymous(string $path, #[SensitiveParameter] array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
    }

    private function live(): string
    {
        $this->as('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $id = Type\shape(['id' => Type\string()], true)->coerce($this->last()['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as('POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, string>     $headers
     */
    private function as(string $method, string $path, ?array $body = null, string $language = 'en', array $headers = []): void
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => $language,
            ...$headers,
        ], content: null === $body ? null : Json\encode($body));
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw || !Str\starts_with($raw, '{') ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
