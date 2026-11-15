<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** A guest's and each companion's allergies, diet and access needs (sc-3777). */
final class GuestNeedsTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const array NONE = [
        'allergies' => [],
        'diet' => [],
        'access' => [],
        'otherAllergy' => null,
        'otherDiet' => null,
        'otherAccess' => null,
        'note' => null,
    ];

    private const string NOTE = 'Carries an EpiPen in her bag';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function aGuestAndEachCompanionKeepTheirOwnNeedsAsCodesInTheListsOrder(): void
    {
        $guest = $this->add([
            'fullName' => 'Bisi Adewale',
            'needs' => ['allergies' => ['tree_nuts', 'peanuts', 'other', 'peanuts'], 'diet' => ['halal'], 'otherAllergy' => '  Kiwi  ', 'otherDiet' => 'dropped, Other is not ticked', 'note' => ' ' . self::NOTE . ' '],
            'companions' => [['fullName' => 'Tunde', 'needs' => ['access' => ['other', 'step_free'], 'otherAccess' => 'A chair by the door']], ['fullName' => 'Kemi']],
        ]);

        $expected = [
            [...self::NONE, 'allergies' => ['peanuts', 'tree_nuts', 'other'], 'diet' => ['halal'], 'otherAllergy' => 'Kiwi', 'note' => self::NOTE],
            [...self::NONE, 'access' => ['step_free', 'other'], 'otherAccess' => 'A chair by the door'],
            self::NONE,
        ];
        self::assertSame($expected, $this->needsOf($guest));
        self::assertSame($expected, $this->needsOf($this->row()));
        self::assertSame($expected, $this->needsOf($this->details($this->as($this->owner, 'GET', $this->guest($guest)))));
    }

    /** @return iterable<string, array{array<string, mixed>, array<string, string>}> */
    public static function refusals(): iterable
    {
        yield 'Other allergy ticked with no words' => [['needs' => ['allergies' => ['other'], 'otherAllergy' => '   ']], ['needs.otherAllergy' => 'Say which']];
        yield 'Other diet too long' => [['needs' => ['diet' => ['other'], 'otherDiet' => Str\repeat('é', 101)]], ['needs.otherDiet' => 'Shorten it to 100 characters or fewer.']];
        yield 'Other access ticked with no words, on a companion' => [['companions' => [[], ['needs' => ['access' => ['other']]]]], ['companions[1].needs.otherAccess' => 'Say which']];
        yield 'a note too long' => [['needs' => ['note' => Str\repeat('n', 501)]], ['needs.note' => 'Shorten the note to 500 characters or fewer.']];
        yield 'an allergen not in the list' => [['needs' => ['allergies' => ['peanuts', 'shellfish']]], ['needs.allergies' => 'Choose from the list.']];
        yield 'a diet not in the list' => [['needs' => ['diet' => ['keto']]], ['needs.diet' => 'Choose from the list.']];
        yield 'an access need not in the list' => [['needs' => ['access' => ['lift']]], ['needs.access' => 'Choose from the list.']];
        yield 'every problem at once' => [['fullName' => '', 'needs' => ['allergies' => ['other'], 'diet' => ['other'], 'otherDiet' => Str\repeat('d', 101)]], [
            'fullName' => 'Enter their full name.',
            'needs.otherAllergy' => 'Say which',
            'needs.otherDiet' => 'Shorten it to 100 characters or fewer.',
        ]];
    }

    /** @param array<string, string> $expected */
    #[Test]
    #[DataProvider('refusals')]
    public function needsThatAreNotFactsSaveNothing(mixed $guest, array $expected): void
    {
        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Bisi', ...Type\dict(Type\string(), Type\mixed())->coerce($guest)]);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($expected, $this->violations());
        self::assertSame(0, $this->rows('guests'));
        self::assertSame(0, $this->rows('guest_needs'));
    }

    #[Test]
    public function aRefusalNamesTheFieldAndNeverCarriesWhatWasSent(): void
    {
        $long = 'Kiwi ' . Str\repeat('and more kiwi ', 10);
        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Bisi', 'needs' => ['allergies' => ['other', 'shellfish'], 'otherAllergy' => $long, 'note' => self::NOTE . Str\repeat('!', 500)]]);

        self::assertSame(422, $this->statusCode());
        $body = (string) $this->client->getResponse()->getContent();
        foreach (['Kiwi', 'shellfish', 'EpiPen'] as $sent) {
            self::assertStringNotContainsString($sent, $body);
        }

        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Bisi', 'needs' => ['allergies' => 'peanuts']]);
        self::assertSame(422, $this->statusCode());
        self::assertStringNotContainsString('peanuts', (string) $this->client->getResponse()->getContent());
    }

    #[Test]
    public function aSaveReplacesTheNeedsItSendsAndKeepsThoseItLeavesOut(): void
    {
        $guest = $this->add([
            'fullName' => 'Bisi',
            'needs' => ['allergies' => ['milk'], 'note' => self::NOTE],
            'companions' => [['fullName' => 'Tunde', 'needs' => ['diet' => ['vegan']]], ['fullName' => 'Kemi', 'needs' => ['diet' => ['kosher']]]],
        ]);
        [$tunde, $kemi] = $this->companionIds($guest);

        $saved = $this->details($this->as($this->owner, 'PUT', $this->guest($guest), [
            'fullName' => 'Bisi',
            'needs' => ['diet' => ['other'], 'otherDiet' => 'Low salt'],
            'companions' => [['id' => $tunde, 'fullName' => 'Tunde'], ['id' => $kemi, 'fullName' => 'Kemi', 'needs' => []], ['fullName' => 'Ngozi', 'needs' => ['allergies' => ['eggs']]]],
        ], '"1"'));

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([
            [...self::NONE, 'diet' => ['other'], 'otherDiet' => 'Low salt'],
            [...self::NONE, 'diet' => ['vegan']],
            self::NONE,
            [...self::NONE, 'allergies' => ['eggs']],
        ], $this->needsOf($saved));

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'companions' => [['id' => $tunde, 'fullName' => 'Tunde']]], '"2"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[...self::NONE, 'diet' => ['other'], 'otherDiet' => 'Low salt'], [...self::NONE, 'diet' => ['vegan']]], $this->needsOf($this->row()));
        self::assertSame(2, $this->rows('guest_needs'), 'a removed companion takes their needs with them');
    }

    #[Test]
    public function aSaveThatChangesOnlyNeedsRaisesTheVersionAndOneThatChangesNothingDoesNot(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'needs' => ['allergies' => ['milk']]]);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'needs' => ['allergies' => ['milk']]], '"1"');
        self::assertSame('"1"', $this->client->getResponse()->headers->get('ETag'));

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'needs' => ['allergies' => ['milk', 'eggs']]], '"1"');
        self::assertSame('"2"', $this->client->getResponse()->headers->get('ETag'));
    }

    #[Test]
    public function eachChangeToNeedsIsAuditedAsNeedsChangedWithoutTheirValues(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'needs' => ['allergies' => ['other'], 'otherAllergy' => 'Kiwi', 'note' => self::NOTE], 'companions' => [['fullName' => 'Tunde']]]);
        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'needs' => ['diet' => ['halal']], 'companions' => [['id' => $this->companionIds($guest)[0], 'fullName' => 'Tunde']]], '"1"');

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestNeedsRecord::CHANGED]);
        self::assertCount(2, $entries, 'the guest added with needs, then changed; the companion with none is not');
        foreach ($entries as $entry) {
            self::assertSame($guest['id'], $entry->getSubjectId()->toRfc4122());
            self::assertSame([], $entry->getChanges());
        }

        $logged = Type\string()->coerce(self::em()->getConnection()->fetchOne("SELECT string_agg(action || ' ' || changes::text, ' ') FROM audit_entries"));
        foreach (['Kiwi', 'EpiPen', 'halal', 'other'] as $value) {
            self::assertStringNotContainsString($value, $logged);
        }
    }

    #[Test]
    public function withGuestsReadAloneNoNeedsAreSentAndTheLiveListCarriesNone(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'needs' => ['allergies' => ['milk']], 'companions' => [['fullName' => 'Tunde', 'needs' => ['diet' => ['vegan']]]]]);
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);

        foreach ([$this->as($viewer, 'GET', $this->guests())['guests'] ?? null, [$this->details($this->as($viewer, 'GET', $this->guest($guest)))]] as $answer) {
            self::assertSame(200, $this->statusCode());
            $host = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($answer)[0] ?? [];
            self::assertArrayNotHasKey('needs', $host);
            self::assertArrayNotHasKey('needs', Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($host['companions'] ?? [])[0] ?? []);
        }
    }

    #[Test]
    public function onlyGuestsManageRecordsNeeds(): void
    {
        $guest = $this->add(['fullName' => 'Bisi']);
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);

        $this->as($viewer, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'needs' => ['allergies' => ['milk']]], '"1"');

        self::assertSame(403, $this->statusCode());
        self::assertSame(0, $this->rows('guest_needs'));
    }

    #[Test]
    public function theHeadcountCountsEachCodeOnceForEachPersonWithIt(): void
    {
        $this->add(['fullName' => 'Bisi', 'needs' => ['allergies' => ['peanuts', 'milk'], 'diet' => ['halal']], 'companions' => [['fullName' => 'Tunde', 'needs' => ['allergies' => ['peanuts'], 'access' => ['step_free']]]]]);
        $this->add(['fullName' => 'Kemi', 'needs' => ['allergies' => ['other'], 'otherAllergy' => 'Kiwi']]);
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);

        $headcount = Type\shape(['byDietaryNeed' => Type\mixed()], true)->coerce($this->as($viewer, 'GET', '/api/events/' . $this->eventId . '/headcount')['headcount'] ?? null);

        self::assertSame(['addsUp' => false, 'needs' => [
            ['kind' => 'allergen', 'code' => 'peanuts', 'people' => 2],
            ['kind' => 'allergen', 'code' => 'milk', 'people' => 1],
            ['kind' => 'allergen', 'code' => 'other', 'people' => 1],
            ['kind' => 'diet', 'code' => 'halal', 'people' => 1],
            ['kind' => 'access', 'code' => 'step_free', 'people' => 1],
        ]], $headcount['byDietaryNeed']);
    }

    #[Test]
    public function aDeletedEventsNeedsAreInNoReadAndComeBackWithARestore(): void
    {
        $this->add(['fullName' => 'Bisi', 'needs' => ['allergies' => ['milk']]]);
        self::em()->getConnection()->executeStatement('UPDATE events SET deleted_at = NOW() WHERE id = :id', ['id' => $this->eventId]);

        foreach (['/guests', '/headcount'] as $read) {
            $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . $read);
            self::assertSame(404, $this->statusCode(), $read);
        }

        self::em()->getConnection()->executeStatement('UPDATE events SET deleted_at = NULL WHERE id = :id', ['id' => $this->eventId]);
        self::assertSame([[...self::NONE, 'allergies' => ['milk']]], $this->needsOf($this->row()));
    }

    #[Test]
    public function needsGoWithTheirGuest(): void
    {
        $this->add(['fullName' => 'Bisi', 'needs' => ['allergies' => ['milk']], 'companions' => [['fullName' => 'Tunde', 'needs' => ['diet' => ['vegan']]]]]);
        self::assertSame(2, $this->rows('guest_needs'));

        self::em()->getConnection()->executeStatement('DELETE FROM guests WHERE host_id IS NULL');

        self::assertSame(0, $this->rows('guest_needs'));
    }

    #[Test]
    public function aGuestWithNoNeedsIsAddedAndSavedAsBefore(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'companions' => [['fullName' => 'Tunde']]]);
        self::assertSame([self::NONE, self::NONE], $this->needsOf($guest));

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale', 'companions' => [['id' => $this->companionIds($guest)[0], 'fullName' => 'Tunde']]], '"1"');
        self::assertSame(200, $this->statusCode());
        self::assertSame(0, $this->rows('guest_needs'));
        self::assertSame([], self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestNeedsRecord::CHANGED]));
    }

    /** @return list<mixed> the host's, then each companion's, without who changed them last (GuestPageNeedsTest) */
    private function needsOf(mixed $guest): array
    {
        $guest = Type\dict(Type\string(), Type\mixed())->coerce($guest);
        $recorded = static fn (mixed $needs): mixed => null === $needs ? null : Dict\filter_keys(Type\dict(Type\string(), Type\mixed())->coerce($needs), static fn (string $key): bool => 'changed' !== $key);

        return [$recorded($guest['needs'] ?? null), ...Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($guest['companions'] ?? []), static fn (array $companion): mixed => $recorded($companion['needs'] ?? null))];
    }

    /** @return array<string, mixed> */
    private function row(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->guests())['guests'] ?? null)[0] ?? [];
    }

    /** @return array<string, mixed> */
    private function add(mixed $guest): array
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), Type\dict(Type\string(), Type\mixed())->coerce($guest));
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
    }

    private function rows(string $table): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM ' . $table));
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    private function guest(mixed $guest): string
    {
        return $this->guests() . '/' . Type\shape(['id' => Type\string()], true)->coerce($guest)['id'];
    }

    /** @return list<string> */
    private function companionIds(mixed $guest): array
    {
        $companions = Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string()], true))], true)->coerce($guest)['companions'];

        return Vec\map($companions, static fn (array $one): string => $one['id']);
    }

    /** @return array<string, mixed> */
    private function details(mixed $body): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Type\shape(['guest' => Type\mixed()], true)->coerce($body)['guest']);
    }

    /** @return array<string, string> */
    private function violations(): array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);
        $byPath = [];

        foreach ($violations as $violation) {
            $byPath[$violation['propertyPath']] = $violation['message'];
        }

        return $byPath;
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
