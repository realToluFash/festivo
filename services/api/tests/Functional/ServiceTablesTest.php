<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\StaffRoster;
use App\Domain\Staff\Station\ServiceTables;
use App\Domain\Staff\VerifiedContactOwners;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\PhoneNumber;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\SectionColour;
use App\Enum\StationKind;
use App\Enum\TableShape;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\EmailAddressRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffStationRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** sc-4002: working the floor reaches the tables of your own section and of a section nobody is on; running it reaches every table. */
final class ServiceTablesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private User $waiter;

    private User $other;

    private SeatingTable $theirs;

    private SeatingTable $yours;

    private SeatingTable $nobodys;

    private SeatingTable $unverified;

    private StaffMember $bisiOnA;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->waiter = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->other = $this->account('kemi@lagoslights.example', 'Kemi');
        $this->verifiedPhone($this->waiter, '+2348035550142', verified: true);
        $this->verifiedPhone($this->waiter, '+2348035550143', verified: false);
        $this->verifiedEmail($this->other);

        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2027-03-06T16:00', 'endsAt' => '2027-03-07T02:00']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $event = self::em()->find(Event::class, Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id']) ?? self::fail('no event');
        $plan = new SeatingPlan($event, null, 2000, 2000, null);
        self::em()->persist($plan);

        $this->yours = $this->table($event, $plan, 'Section A', new StaffDetails('Bisi', '+2348035550142', null));
        $this->theirs = $this->table($event, $plan, 'Section B', new StaffDetails('Kemi', null, 'kemi@lagoslights.example'));
        $this->nobodys = $this->table($event, $plan, 'Section C', null);
        $this->unverified = $this->table($event, $plan, 'Section D', new StaffDetails('Bisi', '+2348035550143', null));
        self::em()->flush();
        $this->bisiOnA = $this->onSection('Section A');
    }

    #[Test]
    public function workingTheFloorReachesYourSectionAndOneNobodyIsOnButNotSomebodyElses(): void
    {
        $grants = Grants::fromOutside(EventRole::CanWorkFloor);

        self::assertNull($this->bisiOnA->getMember(), 'Bisi holds no membership, so the roster links no member, as in production');
        $this->assertReaches($grants, $this->waiter, $this->yours, null);
        $this->assertReaches($grants, $this->waiter, $this->nobodys, null);
        $this->assertReaches($grants, $this->waiter, $this->theirs, ErrorCode::TableNotYours);
        $this->assertReaches($grants, $this->other, $this->theirs, null);
    }

    #[Test]
    public function aNumberTheyHaveNotVerifiedDoesNotMakeTheSectionTheirs(): void
    {
        $this->assertReaches(Grants::fromOutside(EventRole::CanWorkFloor), $this->waiter, $this->unverified, ErrorCode::TableNotYours);
    }

    #[Test]
    public function runningTheFloorReachesEveryTable(): void
    {
        foreach ([Grants::fromOutside(EventRole::CanRunFloor), Grants::onEvent(EventRole::CanEdit), Grants::onEvent(EventRole::Lead), Grants::everything()] as $grants) {
            $this->assertReaches($grants, $this->waiter, $this->theirs, null);
        }
    }

    #[Test]
    public function thePassAndTheReadingRolesReachNoTable(): void
    {
        foreach ([Grants::fromOutside(EventRole::CanWorkPass), Grants::onEvent(EventRole::CanView), Grants::fromOutside(EventRole::CanCheckIn)] as $grants) {
            $this->assertReaches($grants, $this->waiter, $this->nobodys, ErrorCode::PermissionRequired);
        }
    }

    private function assertReaches(Grants $grants, User $user, SeatingTable $table, ?ErrorCode $refusal): void
    {
        try {
            new ServiceTables(self::service(StaffStationRepository::class), self::service(StaffMemberRepository::class), self::service(VerifiedContactOwners::class))->requireYours($grants, $user, $table);
            self::assertNull($refusal, $table->getName() . ' should be refused');
        } catch (ApiException $refused) {
            self::assertSame($refusal, $refused->errorCode, $table->getName());
            self::assertSame(403, $refused->getCode());
        }
    }

    private function table(Event $event, SeatingPlan $plan, string $name, ?StaffDetails $on): SeatingTable
    {
        $section = new SeatingSection($plan, $name, NameNormaliser::key($name), SectionColour::Blue, null);
        self::em()->persist($section);
        $station = new StaffStation($event, StationKind::Section, $name, NameNormaliser::key($name), $section, 0);
        self::em()->persist($station);

        if (null !== $on) {
            self::service(StaffRoster::class)->add($event, $on, null, null, $this->owner, allowShared: true)->setStation($station);
        }

        $table = new SeatingTable($plan, $name . ' T1', NameNormaliser::key($name . ' T1'), TableShape::Round, 100, 100, null);
        $table->setSection($section);
        self::em()->persist($table);

        return $table;
    }

    private function onSection(string $name): StaffMember
    {
        $station = self::service(StaffStationRepository::class)->findOneBy(['name' => $name]) ?? self::fail('no station ' . $name);

        return self::service(StaffMemberRepository::class)->findOnStation($station)[0] ?? self::fail('nobody on ' . $name);
    }

    /** @param non-empty-string $number */
    private function verifiedPhone(User $user, string $number, bool $verified): void
    {
        $phone = new PhoneNumber($user, $number, isPrimary: false, countryCode: 'NG');
        $phone->setVerifiedAt($verified ? new DateTimeImmutable() : null);
        self::em()->persist($phone);
        self::em()->flush();
    }

    private function verifiedEmail(User $user): void
    {
        foreach (self::service(EmailAddressRepository::class)->findBy(['user' => $user]) as $address) {
            $address->setVerifiedAt($address->getVerifiedAt() ?? new DateTimeImmutable());
        }
        self::em()->flush();
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
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
