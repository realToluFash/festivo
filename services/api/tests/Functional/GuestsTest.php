<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestAdder;
use App\Domain\Guest\GuestEditor;
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
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

final class GuestsTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

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
        $this->eventId = $this->newEvent($this->owner, $this->organisation);
    }

    #[Test]
    public function anEventStartsWithNobody(): void
    {
        $list = $this->as($this->owner, 'GET', $this->guests());

        self::assertSame(200, $this->statusCode());
        self::assertSame(['guests' => [], 'counts' => ['people' => 0, 'guests' => 0, 'companions' => 0]], $list);
    }

    #[Test]
    public function aGuestIsKeptAsTypedWithNoReplyAndTheirCompanionsUnderThem(): void
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), [
            'fullName' => '  ' . self::ADAEZE . ' ',
            'email' => ' adaeze@example.com ',
            'mobile' => ['countryCode' => 'NG', 'number' => '0803 123 4567'],
            'companions' => [['fullName' => 'Obi Okonkwo'], ['fullName' => '  '], []],
        ]);

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $guest = Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
        self::assertSame([self::ADAEZE, 'adaeze@example.com', '+2348031234567', 'noReply'], [$guest['fullName'], $guest['email'], $guest['mobile'], $guest['reply']]);
        self::assertSame(
            [['Obi Okonkwo', 'held'], [null, 'held'], [null, 'held']],
            Vec\map(Type\vec(Type\shape(['fullName' => Type\nullable(Type\string()), 'state' => Type\string()], true))->coerce($guest['companions']), static fn (array $companion): array => [$companion['fullName'], $companion['state']]),
        );

        $list = $this->as($this->owner, 'GET', $this->guests());
        self::assertSame(['people' => 4, 'guests' => 1, 'companions' => 3], $list['counts'] ?? null);
        self::assertSame([$guest], $list['guests'] ?? null);
    }

    #[Test]
    public function onlyTheNameIsNeeded(): void
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Bisi', 'email' => '', 'mobile' => ['countryCode' => 'NG', 'number' => ' ']]);

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $guest = Type\shape(['email' => Type\nullable(Type\string()), 'mobile' => Type\nullable(Type\string()), 'companions' => Type\vec(Type\mixed())], true)->coerce($body['guest'] ?? null);
        self::assertSame([null, null, []], [$guest['email'], $guest['mobile'], $guest['companions']]);
    }

    /** @return iterable<string, array{array<string, mixed>, array<string, string>}> */
    public static function refusals(): iterable
    {
        yield 'a blank name' => [['fullName' => '   '], ['fullName' => 'Enter their full name.']];
        yield 'a name too long' => [['fullName' => Str\repeat('a', 201)], ['fullName' => 'Shorten the name to 200 characters or fewer.']];
        yield 'not an email address' => [['fullName' => 'Bisi', 'email' => 'bisi.example.com'], ['email' => 'That does not look like an email address. Check it has an @ and a domain.']];
        yield 'a number too short' => [['fullName' => 'Bisi', 'mobile' => ['countryCode' => 'NG', 'number' => '0803']], ['mobile' => 'That number looks too short for Nigeria. Check it and try again.']];
        yield 'a companion named too long' => [['fullName' => 'Bisi', 'companions' => [['fullName' => 'Obi'], ['fullName' => Str\repeat('b', 201)]]], ['companions[1].fullName' => 'Shorten the name to 200 characters or fewer.']];
        yield 'eleven companions' => [['fullName' => 'Bisi', 'companions' => Vec\fill(11, [])], ['companions' => '10 companions is the most one guest can bring.']];
        yield 'everything at once' => [['fullName' => '', 'email' => 'nope', 'mobile' => ['countryCode' => 'NG', 'number' => '0803']], [
            'fullName' => 'Enter their full name.',
            'email' => 'That does not look like an email address. Check it has an @ and a domain.',
            'mobile' => 'That number looks too short for Nigeria. Check it and try again.',
        ]];
    }

    /**
     * @param array<string, mixed>  $guest
     * @param array<string, string> $expected
     */
    #[Test]
    #[DataProvider('refusals')]
    public function aGuestThatIsNotOneAddsNothing(array $guest, array $expected): void
    {
        $this->as($this->owner, 'POST', $this->guests(), $guest);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($expected, $this->violations());
        self::assertSame(0, $this->people());
    }

    #[Test]
    public function aNameAlreadyOnTheListIsAskedAboutAndAddedOnlyWhenTheHostSaysSo(): void
    {
        $this->add(['fullName' => 'Adaeze Okonkwo']);

        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'ADAÉZÉ  okonkwo', 'companions' => [[]]]);
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/guest_already_listed', $this->last()['type'] ?? null);
        self::assertSame('ADAÉZÉ  okonkwo is already on the list', $this->last()['detail'] ?? null);
        self::assertSame(1, $this->people());

        $this->add(['fullName' => 'ADAÉZÉ  okonkwo', 'companions' => [[]], 'allowDuplicate' => true]);
        self::assertSame(['people' => 3, 'guests' => 2, 'companions' => 1], $this->as($this->owner, 'GET', $this->guests())['counts'] ?? null);
    }

    #[Test]
    public function aCompanionsNameIsNotAGuestsAlreadyOnTheList(): void
    {
        $this->add(['fullName' => 'Bisi', 'companions' => [['fullName' => 'Tunde Bakare']]]);

        $this->add(['fullName' => 'Tunde Bakare']);

        self::assertSame(3, $this->people());
    }

    #[Test]
    public function everyAddIsAuditedWithWhoAndWhenAndNoNameOrContact(): void
    {
        $guest = $this->add(['fullName' => 'Bisi Adewale', 'email' => 'bisi@example.com', 'mobile' => ['countryCode' => 'NG', 'number' => '08031234567'], 'companions' => [['fullName' => 'Tunde Adewale']]]);

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestAdder::ADDED]);
        self::assertCount(2, $entries);
        self::assertContains($guest['id'], Vec\map($entries, static fn (AuditEntry $entry): string => $entry->getSubjectId()->toRfc4122()));
        foreach ($entries as $entry) {
            self::assertSame($this->owner->getId()->toRfc4122(), $entry->getActorId()?->toRfc4122());
            self::assertSame([], $entry->getChanges());
        }
    }

    #[Test]
    public function eachAddIsPublishedAsTheWholeList(): void
    {
        $this->add(['fullName' => 'Bisi']);

        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/guests'], $update->getTopics());
        self::assertTrue($update->isPrivate());
        $viewer = $this->member('ada@ire.events', SeededRole::Member, EventRole::CanView);
        self::assertSame($this->as($viewer, 'GET', $this->guests()), Json\decode($update->getData()));
    }

    #[Test]
    public function aSubscriptionNamesThisEventsListAlone(): void
    {
        $body = $this->as($this->owner, 'POST', $this->guests() . '/subscriptions');

        self::assertSame(200, $this->statusCode());
        $token = new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($body['token'] ?? null));
        self::assertInstanceOf(UnencryptedToken::class, $token);
        self::assertSame(['subscribe' => ['events/' . $this->eventId . '/guests']], $token->claims()->get('mercure'));
    }

    /** @return iterable<string, array{EventRole}> */
    public static function rolesThatCannotAdd(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('rolesThatCannotAdd')]
    public function onlyGuestsManageAdds(EventRole $role): void
    {
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        $this->as($viewer, 'POST', $this->guests(), ['fullName' => 'Bisi']);

        self::assertSame(403, $this->statusCode());
        self::assertSame(0, $this->people());
    }

    #[Test]
    public function anotherOrganisationsEventAndOneThatDoesNotExistAreTheSameNotFound(): void
    {
        $guest = $this->add(['fullName' => 'Ngozi Eze']);
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $answers = [];
        foreach ([$this->guests(), '/api/events/0193f5a8-0000-7000-8000-000000000000/guests'] as $path) {
            foreach (['GET' => null, 'POST' => ['fullName' => 'Bisi']] as $method => $body) {
                $this->as($stranger, $method, $path, $body);
                $answers[] = [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];
            }
        }
        foreach (['GET' => null, 'PUT' => ['fullName' => 'Bisi']] as $method => $body) {
            $this->as($stranger, $method, $this->guest($guest), $body, '"1"');
            $answers[] = [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];
        }

        self::assertSame(404, $answers[0][0]);
        self::assertSame(Vec\fill(6, $answers[0]), $answers);
        self::assertSame(1, $this->people());
        $details = $this->details($this->as($this->owner, 'GET', $this->guest($guest)));
        self::assertSame('Ngozi Eze', $details['fullName']);
    }

    #[Test]
    public function aGuestsDetailsSayWhenAndByWhomTheyWereAddedWithAnETag(): void
    {
        $guest = $this->add(['fullName' => 'Bisi Adewale', 'email' => 'bisi@example.com', 'companions' => [['fullName' => 'Tunde Adewale'], []]]);

        $body = $this->as($this->owner, 'GET', $this->guest($guest));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame('"1"', $this->client->getResponse()->headers->get('ETag'));
        $details = $this->details($body);
        self::assertSame(['Bisi Adewale', 'bisi@example.com', null, 'noReply'], [$details['fullName'], $details['email'], $details['mobile'], $details['reply']]);
        self::assertSame($guest['companions'], $details['companions']);
        $added = Type\shape(['at' => Type\string(), 'by' => Type\nullable(Type\string())])->coerce($details['added']);
        self::assertSame('Person', $added['by']);
        self::assertNotFalse(DateTimeImmutable::createFromFormat(\DATE_ATOM, $added['at']));
    }

    #[Test]
    public function withGuestsReadAloneTheListAndTheDetailsLeaveOutEmailAndMobile(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'email' => 'bisi@example.com', 'mobile' => ['countryCode' => 'NG', 'number' => '08031234567']]);

        foreach ([EventRole::CanView, EventRole::CanCheckIn] as $index => $role) {
            $viewer = $this->member("viewer{$index}@ire.events", SeededRole::Member, $role);

            $row = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($viewer, 'GET', $this->guests())['guests'] ?? null)[0] ?? [];
            $details = $this->details($this->as($viewer, 'GET', $this->guest($guest)));

            self::assertSame(200, $this->statusCode());
            foreach ([$row, $details] as $answer) {
                self::assertArrayNotHasKey('email', $answer);
                self::assertArrayNotHasKey('mobile', $answer);
                self::assertSame('Bisi', $answer['fullName'] ?? null);
            }
        }
    }

    #[Test]
    public function aSaveCorrectsTheGuestAndTheirCompanionsAndRaisesTheVersion(): void
    {
        $guest = $this->add(['fullName' => 'Bisi Adewal', 'email' => 'bisi@example.com', 'companions' => [['fullName' => 'Tunde'], [], ['fullName' => 'Gone']]]);
        [$tunde, $unnamed] = $this->companionIds($guest);

        $body = $this->as($this->owner, 'PUT', $this->guest($guest), [
            'fullName' => 'Bisi Adewale',
            'email' => '',
            'mobile' => ['countryCode' => 'NG', 'number' => '0803 123 4567'],
            'companions' => [['id' => $unnamed, 'fullName' => 'Chidi Adewale'], ['id' => $tunde, 'fullName' => 'Tunde Adewale'], ['fullName' => 'Ngozi']],
        ], '"1"');

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame('"2"', $this->client->getResponse()->headers->get('ETag'));
        $details = $this->details($body);
        self::assertSame(['Bisi Adewale', null, '+2348031234567'], [$details['fullName'], $details['email'], $details['mobile']]);
        $companions = Type\vec(Type\shape(['id' => Type\string(), 'fullName' => Type\nullable(Type\string())], true))->coerce($details['companions']);
        self::assertSame(['Chidi Adewale', 'Tunde Adewale', 'Ngozi'], Vec\map($companions, static fn (array $one): ?string => $one['fullName']));
        self::assertSame([$unnamed, $tunde], [$companions[0]['id'], $companions[1]['id']]);
        self::assertSame(4, $this->people());
        self::assertSame($this->details($body), $this->details($this->as($this->owner, 'GET', $this->guest($guest))));
    }

    #[Test]
    public function aSaveIsAuditedByTheFieldsItChangedAndHoldsNoneOfTheirValues(): void
    {
        $guest = $this->add(['fullName' => 'Bisi Adewal', 'email' => 'bisi@example.com', 'mobile' => ['countryCode' => 'NG', 'number' => '08031234567'], 'companions' => [['fullName' => 'Tunde']]]);
        [$tunde] = $this->companionIds($guest);

        $this->as($this->owner, 'PUT', $this->guest($guest), [
            'fullName' => 'Bisi Adewale',
            'email' => 'bisi.adewale@example.com',
            'mobile' => ['countryCode' => 'NG', 'number' => '08031234567'],
            'companions' => [['id' => $tunde, 'fullName' => 'Tunde Adewale']],
        ], '"1"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestEditor::UPDATED]);
        self::assertCount(1, $entries);
        self::assertSame($guest['id'], $entries[0]->getSubjectId()->toRfc4122());
        self::assertSame($this->owner->getId()->toRfc4122(), $entries[0]->getActorId()?->toRfc4122());
        self::assertSame(['fullName' => [null, null], 'email' => [null, null], 'companions' => [null, null]], $entries[0]->getChanges());
        $recorded = Json\encode($entries[0]->getChanges());
        foreach (['Bisi', 'Tunde', 'example.com', '803'] as $value) {
            self::assertStringNotContainsString($value, $recorded);
        }
    }

    #[Test]
    public function aSaveWithNothingChangedWritesNothing(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'email' => 'bisi@example.com', 'companions' => [['fullName' => 'Tunde']]]);
        [$tunde] = $this->companionIds($guest);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => ' Bisi ', 'email' => 'bisi@example.com', 'companions' => [['id' => $tunde, 'fullName' => 'Tunde']]], '"1"');

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('"1"', $this->client->getResponse()->headers->get('ETag'));
        self::assertSame([], self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestEditor::UPDATED]));
    }

    #[Test]
    public function aSaveWithoutIfMatchIs428AndOneAgainstAnOlderVersionIs412(): void
    {
        $guest = $this->add(['fullName' => 'Bisi']);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale']);
        self::assertSame(428, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale'], '"1"');
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Okafor'], '"1"');
        self::assertSame(412, $this->statusCode());
        self::assertSame('Bisi Adewale', $this->details($this->as($this->owner, 'GET', $this->guest($guest)))['fullName']);
    }

    #[Test]
    public function aNewNameAlreadyOnTheListIsAskedAboutAndTheGuestsOwnIsNot(): void
    {
        $this->add(['fullName' => 'Adaeze Okonkwo']);
        $guest = $this->add(['fullName' => 'Bisi']);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'adaeze okonkwo'], '"1"');
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/guest_already_listed', $this->last()['type'] ?? null);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'adaeze okonkwo', 'allowDuplicate' => true], '"1"');
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Adaeze Okonkwo'], '"2"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /**
     * @param array<string, mixed>  $guest
     * @param array<string, string> $expected
     */
    #[Test]
    #[DataProvider('refusals')]
    public function aSaveThatIsNotAGuestChangesNothing(array $guest, array $expected): void
    {
        $listed = $this->add(['fullName' => 'Bisi']);

        $this->as($this->owner, 'PUT', $this->guest($listed), $guest, '"1"');

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($expected, $this->violations());
        self::assertSame('Bisi', $this->details($this->as($this->owner, 'GET', $this->guest($listed)))['fullName']);
    }

    #[Test]
    public function aCompanionOfAnotherGuestIsNotOneToKeep(): void
    {
        $other = $this->add(['fullName' => 'Adaeze', 'companions' => [['fullName' => 'Obi']]]);
        $guest = $this->add(['fullName' => 'Bisi']);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'companions' => [['id' => $this->companionIds($other)[0], 'fullName' => 'Obi']]], '"1"');

        self::assertSame(422, $this->statusCode());
        self::assertSame(['companions[0].id' => 'That companion is not with this guest. Open the guest again.'], $this->violations());
        self::assertSame(3, $this->people());
    }

    #[Test]
    #[DataProvider('rolesThatCannotAdd')]
    public function onlyGuestsManageSaves(EventRole $role): void
    {
        $guest = $this->add(['fullName' => 'Bisi']);
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        $this->as($viewer, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale'], '"1"');

        self::assertSame(403, $this->statusCode());
        self::assertSame('Bisi', $this->details($this->as($this->owner, 'GET', $this->guest($guest)))['fullName']);
    }

    #[Test]
    public function aCompanionAnotherEventsGuestAndOneRemovedAreNotFound(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'companions' => [['fullName' => 'Tunde']]]);
        $elsewhere = $this->newEvent($this->owner, $this->organisation);
        $paths = [
            $this->guests() . '/' . $this->companionIds($guest)[0],
            '/api/events/' . $elsewhere . '/guests/' . Type\string()->coerce($guest['id']),
            $this->guests() . '/0193f5a8-0000-7000-8000-000000000000',
            $this->guests() . '/not-an-id',
        ];

        foreach ($paths as $path) {
            $this->as($this->owner, 'GET', $path);
            self::assertSame(404, $this->statusCode(), $path);
            $this->as($this->owner, 'PUT', $path, ['fullName' => 'Bisi'], '"1"');
            self::assertSame(404, $this->statusCode(), $path);
        }
    }

    #[Test]
    public function eachSaveIsPublishedAsTheWholeListWithoutContacts(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'email' => 'bisi@example.com']);
        $published = Iter\count(self::service(RecordingHub::class)->published);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale', 'email' => 'bisi@example.com'], '"1"');

        $hub = self::service(RecordingHub::class)->published;
        self::assertCount($published + 1, $hub);
        $update = Iter\last($hub) ?? self::fail('nothing published');
        self::assertStringNotContainsString('bisi@example.com', $update->getData());
        self::assertStringContainsString('Bisi Adewale', $update->getData());
    }

    /**
     * @param array<string, mixed> $guest
     *
     * @return array<string, mixed>
     */
    private function add(array $guest): array
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), $guest);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
    }

    private function people(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM guests'));
    }

    private function newEvent(User $by, Organisation $organisation): string
    {
        $body = $this->as($by, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
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

    /** @param array<string, mixed> $guest */
    private function guest(array $guest): string
    {
        return $this->guests() . '/' . Type\string()->coerce($guest['id'] ?? null);
    }

    /**
     * @param array<string, mixed> $guest
     *
     * @return list<string>
     */
    private function companionIds(array $guest): array
    {
        return Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($guest['companions'] ?? []), static fn (array $one): string => $one['id']);
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function details(array $body): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
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
