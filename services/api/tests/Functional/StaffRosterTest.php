<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Staff\StaffContactsEraser;
use App\Domain\Staff\StaffRoster;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\Role;
use App\Entity\StaffMember;
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
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** An event's roster: who works it, without making them members (sc-3906). */
final class StaffRosterTest extends ApiTestCase
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
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function anEventWithNobodyOnItHasAnEmptyRoster(): void
    {
        self::assertSame([], $this->roster());
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function addingAPersonPutsThemOnTheRosterWithTheirNumberInE164(): void
    {
        $added = $this->add(['fullName' => '  Kunle Ajayi ', 'mobile' => ['countryCode' => 'NG', 'number' => '0803 111 0009'], 'email' => 'kunle.ajayi@gmail.com']);

        self::assertSame(201, $this->statusCode());
        self::assertSame('Kunle Ajayi', $added['fullName']);
        self::assertSame('+2348031110009', $added['mobile']);
        self::assertSame('kunle.ajayi@gmail.com', $added['email']);
        self::assertSame('none', $added['link']);
        self::assertNull($this->last()['member']);
        self::assertSame(['Kunle Ajayi'], $this->names());
    }

    #[Test]
    public function withoutAMobileNumberTheRowSaysToAddOne(): void
    {
        self::assertSame('no_mobile', $this->add(['fullName' => 'Ada Nnaji'])['link']);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function refused(): iterable
    {
        yield 'a blank name' => [['fullName' => '   '], 'fullName', 'Enter their name.'];
        yield 'a name over 200' => [['fullName' => Str\repeat('a', 201)], 'fullName', 'Shorten the name to 200 characters or fewer.'];
        yield 'a name over 200 marked letters' => [['fullName' => Str\repeat("e\u{0323}\u{0300}", 201)], 'fullName', 'Shorten the name to 200 characters or fewer.'];
        yield 'a name of one letter of many marks' => [['fullName' => 'a' . Str\repeat("\u{0301}", 800)], 'fullName', 'Shorten the name to 200 characters or fewer.'];
        yield 'not a mobile number' => [['fullName' => 'Kemi Ade', 'mobile' => ['countryCode' => 'NG', 'number' => '0803 111']], 'mobile', 'That is not a mobile number for Nigeria. Check it and try again.'];
        yield 'an email without a domain' => [['fullName' => 'Kemi Ade', 'email' => 'kemi.ade@'], 'email', 'That does not look like an email address. Check it has an @ and a domain.'];
    }

    /** @param array<string, mixed> $body */
    #[Test]
    #[DataProvider('refused')]
    public function aWrongFieldIsRefusedBesideItAndNothingIsAdded(array $body, string $field, string $message): void
    {
        $this->as($this->owner, 'POST', $this->staff(), $body);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($field));
        self::assertSame([], $this->roster());
    }

    #[Test]
    public function aNameOf200CharactersIsKept(): void
    {
        $this->add(['fullName' => Str\repeat('a', 200)]);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aNameOf200LettersWithADotAndAToneEachIsKeptAsTyped(): void
    {
        $composed = Str\repeat("\u{1EB9}\u{0300}", 200);
        $decomposed = Str\repeat("e\u{0323}\u{0300}", 200);

        $this->add(['fullName' => $composed]);
        $this->add(['fullName' => $decomposed]);

        self::assertEqualsCanonicalizing([$composed, $decomposed], $this->names());
    }

    #[Test]
    public function aNumberAlreadyOnTheRosterAsksFirstNamingTheFirstInRosterOrder(): void
    {
        $this->add(['fullName' => 'Tolu Bello', 'mobile' => self::number('0803 111 0009')]);
        $this->add(['fullName' => 'Kunle Ajayi', 'mobile' => self::number('08031110009'), 'allowShared' => true]);

        $this->as($this->owner, 'POST', $this->staff(), ['fullName' => 'Funmi Bakare', 'mobile' => self::number('+234 803 111 0009')]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/staff_number_shared', $this->last()['type'] ?? null);
        self::assertSame('Kunle Ajayi', $this->last()['sharedWith'] ?? null);
        self::assertSame(['Kunle Ajayi', 'Tolu Bello'], $this->names());

        $this->add(['fullName' => 'Funmi Bakare', 'mobile' => self::number('0803 111 0009'), 'allowShared' => true]);
        self::assertSame(['Funmi Bakare', 'Kunle Ajayi', 'Tolu Bello'], $this->names());
    }

    #[Test]
    public function aNumberOnAnotherEventsRosterIsNotAsked(): void
    {
        $this->add(['fullName' => 'Tolu Bello', 'mobile' => self::number('08031110009')]);
        $this->eventId = $this->newEvent();

        $this->add(['fullName' => 'Funmi Bakare', 'mobile' => self::number('08031110009')]);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function editAsksWhenTheNumberIsChangedToOneAnotherEntryUses(): void
    {
        $this->add(['fullName' => 'Grace Udo', 'mobile' => self::number('08031110008')]);
        $tolu = $this->add(['fullName' => 'Tolu Bello', 'mobile' => self::number('08031110007')]);

        $this->as($this->owner, 'PUT', $this->staff($tolu['id']), ['fullName' => 'Tolu Bello', 'mobile' => self::number('0803 111 0008')]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('Grace Udo', $this->last()['sharedWith'] ?? null);
        self::assertSame('+2348031110007', $this->entry('Tolu Bello')['mobile']);

        $this->as($this->owner, 'PUT', $this->staff($tolu['id']), ['fullName' => 'Tolu Bello', 'mobile' => self::number('0803 111 0008'), 'allowShared' => true]);
        self::assertSame(200, $this->statusCode());
        self::assertSame('+2348031110008', $this->entry('Tolu Bello')['mobile']);
    }

    #[Test]
    public function editDoesNotAskWhenTheNumberIsUnchanged(): void
    {
        $this->add(['fullName' => 'Grace Udo', 'mobile' => self::number('08031110008')]);
        $kunle = $this->add(['fullName' => 'Kunle Ajayi', 'mobile' => self::number('08031110008'), 'allowShared' => true]);

        $this->as($this->owner, 'PUT', $this->staff($kunle['id']), ['fullName' => 'Kunle A. Ajayi', 'mobile' => self::number('0803 111 0008')]);

        self::assertSame(200, $this->statusCode());
        self::assertSame('Kunle A. Ajayi', $this->last()['staff']['fullName'] ?? null);
    }

    #[Test]
    public function editAsksWhenANumberIsTypedWhereThereWasNone(): void
    {
        $this->add(['fullName' => 'Grace Udo', 'mobile' => self::number('08031110008')]);
        $ada = $this->add(['fullName' => 'Ada Nnaji']);

        $this->as($this->owner, 'PUT', $this->staff($ada['id']), ['fullName' => 'Ada Nnaji', 'mobile' => self::number('08031110008')]);

        self::assertSame(409, $this->statusCode());
    }

    #[Test]
    public function aMembersVerifiedNumberLinksThemAndTheRowKeepsTheTypedName(): void
    {
        $amara = $this->member('amara.obi@ire.events', 'Amara Obi', null);
        $phone = new PhoneNumber(self::em()->find(User::class, $amara->getId()) ?? self::fail('no user'), '+2348035550142', isPrimary: true, countryCode: 'NG');
        $phone->setVerifiedAt(new DateTimeImmutable());
        self::em()->persist($phone);
        self::em()->flush();

        $added = $this->add(['fullName' => 'Mara Obi', 'mobile' => self::number('0803 555 0142')]);

        self::assertSame('Amara Obi', $this->last()['member']);
        self::assertSame('Mara Obi', $added['fullName']);
        self::assertSame($amara->getId()->toRfc4122(), $this->stored($added['id'])->getMember()?->getId()->toRfc4122());
    }

    #[Test]
    public function aMembersVerifiedEmailLinksThem(): void
    {
        $this->member('amara.obi@ire.events', 'Amara Obi', null);

        $this->add(['fullName' => 'Mara Obi', 'email' => 'Amara.Obi@ire.events']);

        self::assertSame('Amara Obi', $this->last()['member']);
    }

    #[Test]
    public function anEntryIsWhoeverVerifiedItsNumberEvenWhenAMemberVerifiedItsEmail(): void
    {
        $outsider = $this->account('kunle@else.where', 'Kunle Ajayi');
        $phone = new PhoneNumber(self::em()->find(User::class, $outsider->getId()) ?? self::fail('no user'), '+2348035550142', isPrimary: true, countryCode: 'NG');
        $phone->setVerifiedAt(new DateTimeImmutable());
        self::em()->persist($phone);
        self::em()->flush();
        $this->member('amara.obi@ire.events', 'Amara Obi', null);

        $added = $this->add(['fullName' => 'Mara Obi', 'mobile' => self::number('0803 555 0142'), 'email' => 'amara.obi@ire.events']);

        self::assertNull($this->last()['member']);
        self::assertNull($this->stored($added['id'])->getMember());
    }

    #[Test]
    public function someoneOutsideTheOrganisationIsNotLinked(): void
    {
        $this->account('amara.obi@else.where', 'Amara Obi');

        $this->add(['fullName' => 'Mara Obi', 'email' => 'amara.obi@else.where']);

        self::assertNull($this->last()['member']);
    }

    #[Test]
    public function beingOnTheRosterMakesNobodyAMemberAndGrantsNothing(): void
    {
        $outsider = $this->account('amara.obi@else.where', 'Amara Obi');
        $linked = $this->member('kemi@ire.events', 'Kemi Ade', null);
        $memberships = self::em()->getRepository(Membership::class)->count([]);
        $grants = self::em()->getRepository(EventPerson::class)->count([]);

        $this->add(['fullName' => 'Amara Obi', 'email' => 'amara.obi@else.where']);
        $this->add(['fullName' => 'Kemi Ade', 'email' => 'kemi@ire.events']);

        self::assertSame($memberships, self::em()->getRepository(Membership::class)->count([]));
        self::assertSame($grants, self::em()->getRepository(EventPerson::class)->count([]));
        $this->as($outsider, 'GET', $this->staff());
        self::assertSame(404, $this->statusCode());
        $this->as($linked, 'GET', $this->staff());
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function removingTakesThemOffTheRoster(): void
    {
        $kunle = $this->add(['fullName' => 'Kunle Ajayi']);
        $this->add(['fullName' => 'Grace Udo']);

        $this->as($this->owner, 'DELETE', $this->staff($kunle['id']));

        self::assertSame(204, $this->statusCode());
        self::assertSame(['Grace Udo'], $this->names());
    }

    #[Test]
    public function onceTheEventHasFinishedRemoveIsRefusedAndEditStays(): void
    {
        $kunle = $this->add(['fullName' => 'Kunle Ajayi', 'mobile' => self::number('08031110009')]);
        $this->finish();

        $this->as($this->owner, 'DELETE', $this->staff($kunle['id']));
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/event_concluded', $this->last()['type'] ?? null);
        self::assertSame(['Kunle Ajayi'], $this->names());

        $this->as($this->owner, 'PUT', $this->staff($kunle['id']), ['fullName' => 'Kunle Ajayi', 'mobile' => self::number('08031110010')]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function thirtyDaysAfterTheEventTheContactsAreErasedAndTheEntriesStay(): void
    {
        $amara = $this->member('amara.obi@ire.events', 'Amara Obi', null);
        $kunle = $this->add(['fullName' => 'Kunle Ajayi', 'mobile' => self::number('08031110009'), 'email' => 'amara.obi@ire.events']);
        $this->add(['fullName' => 'Ada Nnaji']);
        $this->finish();

        self::mockTime(new DateTimeImmutable('2027-04-06T00:00:00Z'));
        self::assertSame(0, self::service(StaffContactsEraser::class)->eraseDue());

        self::mockTime(new DateTimeImmutable('2027-04-07T01:00:00Z'));
        self::assertSame(2, self::service(StaffContactsEraser::class)->eraseDue());

        $rows = $this->roster();
        self::assertSame(['Ada Nnaji', 'Kunle Ajayi'], Vec\map($rows, static fn (array $row): mixed => $row['fullName']));
        foreach ($rows as $row) {
            self::assertNull($row['mobile']);
            self::assertNull($row['email']);
            self::assertSame('erased', $row['link']);
        }
        self::assertNull($this->stored($kunle['id'])->getMember());
        self::assertNotNull(self::em()->find(User::class, $amara->getId())?->getPrimaryEmailAddress());

        $audited = self::em()->getRepository(AuditEntry::class)->findBy(['action' => StaffContactsEraser::ERASED]);
        self::assertCount(1, $audited);
        self::assertSame(['erased' => [null, 2]], $audited[0]->getChanges());
        self::assertSame(0, self::service(StaffContactsEraser::class)->eraseDue());
    }

    #[Test]
    public function afterTheErasureEditKeepsTheNameAndIgnoresContacts(): void
    {
        $kunle = $this->add(['fullName' => 'Kunle Ajayi', 'mobile' => self::number('08031110009')]);
        $this->finish();
        self::mockTime(new DateTimeImmutable('2027-05-01T00:00:00Z'));
        self::service(StaffContactsEraser::class)->eraseDue();

        $this->as($this->owner, 'PUT', $this->staff($kunle['id']), ['fullName' => 'Kunle Ajayi Jr', 'mobile' => self::number('08031110009'), 'email' => 'k@example.com']);

        self::assertSame(200, $this->statusCode());
        $row = $this->entry('Kunle Ajayi Jr');
        self::assertNull($row['mobile']);
        self::assertNull($row['email']);
        self::assertSame('erased', $row['link']);
    }

    #[Test]
    public function everyAddEditAndRemoveIsAuditedWithoutContactDetails(): void
    {
        $kunle = $this->add(['fullName' => 'Kunle Ajayi', 'mobile' => self::number('08031110009'), 'email' => 'kunle@example.com']);
        $this->as($this->owner, 'PUT', $this->staff($kunle['id']), ['fullName' => 'Kunle Ajayi', 'email' => 'kunle@example.org']);
        $this->as($this->owner, 'DELETE', $this->staff($kunle['id']));

        foreach ([StaffRoster::ADDED, StaffRoster::EDITED, StaffRoster::REMOVED] as $action) {
            $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => $action]);
            self::assertCount(1, $entries, $action);
            self::assertSame($kunle['id'], $entries[0]->getSubjectId()->toRfc4122());
            self::assertSame($this->owner->getId()->toRfc4122(), $entries[0]->getActorId()?->toRfc4122());
            self::assertSame([], $entries[0]->getChanges());
        }
    }

    #[Test]
    public function eachChangeIsPublishedAsTheWholeRoster(): void
    {
        $this->add(['fullName' => 'Kunle Ajayi']);

        $topic = 'events/' . $this->eventId . '/staff';
        $update = self::service(RecordingHub::class)->lastOn($topic) ?? self::fail('nothing published');
        self::assertSame([$topic], $update->getTopics());
        self::assertSame(['Kunle Ajayi'], Vec\map(Type\shape(['staff' => Type\vec(Type\shape(['fullName' => Type\string()], true))])->coerce(Json\decode($update->getData()))['staff'], static fn (array $row): string => $row['fullName']));
    }

    #[Test]
    public function aStaffReadHolderIsGivenATokenForTheRoster(): void
    {
        $body = $this->as($this->owner, 'POST', $this->staff() . '/subscriptions');

        self::assertSame(200, $this->statusCode());
        self::assertIsString($body['token'] ?? null);
    }

    #[Test]
    public function canViewSeesTheRosterButCannotChangeIt(): void
    {
        $kunle = $this->add(['fullName' => 'Kunle Ajayi']);
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        $this->as($viewer, 'GET', $this->staff());
        self::assertSame(200, $this->statusCode());

        foreach ([
            ['POST', $this->staff(), ['fullName' => 'Grace Udo']],
            ['PUT', $this->staff($kunle['id']), ['fullName' => 'Kunle']],
            ['DELETE', $this->staff($kunle['id']), null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method);
        }

        self::assertSame(['Kunle Ajayi'], $this->names());
    }

    #[Test]
    public function canEditChangesTheRoster(): void
    {
        $editor = $this->member('tunde@ire.events', 'Tunde Bakare', EventRole::CanEdit);

        $this->as($editor, 'POST', $this->staff(), ['fullName' => 'Grace Udo']);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aMemberWithNoRoleOnTheEventIsNotFound(): void
    {
        $this->as($this->member('kemi@ire.events', 'Kemi Ade', null), 'GET', $this->staff());

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'GET', $this->staff());
        self::assertSame(404, $this->statusCode());
        $this->as($stranger, 'POST', $this->staff(), ['fullName' => 'Grace Udo']);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function anEntryOnAnotherEventIsNotFoundThroughThisOne(): void
    {
        $kunle = $this->add(['fullName' => 'Kunle Ajayi']);
        $this->eventId = $this->newEvent();

        $this->as($this->owner, 'DELETE', $this->staff($kunle['id']));

        self::assertSame(404, $this->statusCode());
    }

    /** @return array{countryCode: string, number: string} */
    private static function number(string $typed): array
    {
        return ['countryCode' => 'NG', 'number' => $typed];
    }

    /** Live, then the clock past its end. */
    private function finish(): void
    {
        $event = self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
        $event->makeLive(new DateTimeImmutable());
        self::em()->flush();
        self::mockTime(new DateTimeImmutable('2027-03-07T12:00:00Z'));
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array{id: string, fullName: string, mobile: ?string, email: ?string, link: string, ...}
     */
    private function add(array $body): array
    {
        $answer = $this->as($this->owner, 'POST', $this->staff(), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return self::row($answer['staff'] ?? null);
    }

    /** @return list<array{id: string, fullName: string, mobile: ?string, email: ?string, link: string, ...}> */
    private function roster(): array
    {
        return Vec\map(Type\vec(Type\mixed())->coerce($this->as($this->owner, 'GET', $this->staff())['staff'] ?? null), self::row(...));
    }

    /** @return list<string> */
    private function names(): array
    {
        return Vec\map($this->roster(), static fn (array $row): string => $row['fullName']);
    }

    /** @return array{id: string, fullName: string, mobile: ?string, email: ?string, link: string, ...} */
    private function entry(string $name): array
    {
        foreach ($this->roster() as $row) {
            if ($row['fullName'] === $name) {
                return $row;
            }
        }

        self::fail('nobody called ' . $name);
    }

    /** @return array{id: string, fullName: string, mobile: ?string, email: ?string, link: string, ...} */
    private static function row(mixed $raw): array
    {
        return Type\shape([
            'id' => Type\string(),
            'fullName' => Type\string(),
            'mobile' => Type\nullable(Type\string()),
            'email' => Type\nullable(Type\string()),
            'link' => Type\string(),
        ], true)->coerce($raw);
    }

    private function stored(string $id): StaffMember
    {
        self::em()->clear();

        return self::em()->find(StaffMember::class, Uuid::fromString($id)) ?? self::fail('no entry');
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2027-03-06T16:00',
            'endsAt' => '2027-03-07T02:00',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function staff(?string $id = null): string
    {
        return '/api/events/' . $this->eventId . '/staff' . (null === $id ? '' : '/' . $id);
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

    private function member(string $address, string $name, ?EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
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
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
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
